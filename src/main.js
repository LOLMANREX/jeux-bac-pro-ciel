import './styles/main.css';
import './styles/minigames.css';

import * as THREE from 'three';
import { sfx } from './core/audio.js';
import { FORTIN_POS, GameState, getTpById, TP_CATALOG } from './core/gameState.js';
import { NetworkClient } from './core/network.js';
import { SceneManager } from './world/SceneManager.js';
import { buildLabWorld } from './world/LabBuilder.js';
import { createNpcFortin } from './world/NpcFortin.js';
import { PlayerController } from './world/PlayerController.js';
import { RemotePlayersManager } from './world/RemotePlayers.js';
import { HudManager } from './ui/HudManager.js';
import { DialogueModal } from './ui/DialogueModal.js';
import { MiniGameModal } from './minigames/MiniGameModal.js';
import { createOscilloscopeGame } from './minigames/OscilloscopeGame.js';
import { createSolderingGame } from './minigames/SolderingGame.js';
import { createElectronicsGame } from './minigames/ElectronicsGame.js';
import { createAntivirusGame } from './minigames/AntivirusGame.js';
import { createVmVlanGame } from './minigames/VmVlanGame.js';

const MINIGAME_FACTORIES = {
  oscilloscope: createOscilloscopeGame,
  soldering: createSolderingGame,
  electronics: createElectronicsGame,
  antivirus: createAntivirusGame,
  vmvlan: createVmVlanGame
};

const gameState = new GameState();
const network = new NetworkClient();

const canvas = document.getElementById('game-canvas');
const sceneMgr = new SceneManager(canvas);
sceneMgr.setQuality(gameState.quality);
sceneMgr.setFov(gameState.fov);

const lab = buildLabWorld(sceneMgr.scene);
const fortin = createNpcFortin(sceneMgr.scene);
const allColliders = [...lab.colliders, fortin.collider];
const allInteractables = [fortin.interactable, ...lab.interactables];

const player = new PlayerController(sceneMgr.camera, canvas, allColliders);
player.setSensitivity(gameState.mouseSens);
const remotePlayers = new RemotePlayersManager(sceneMgr.scene);

const dialogueModal = new DialogueModal();
const miniGameModal = new MiniGameModal();

let joined = false;
let modalOpen = false;
let nearestTarget = null;

function setModalActive(active, pauseScene = false) {
  modalOpen = active;
  player.setEnabled(joined && !active);
  sceneMgr.setPaused(pauseScene);
}

function openTp(tpId) {
  const tp = getTpById(tpId);
  const factory = MINIGAME_FACTORIES[tpId];
  if (!tp || !factory) return;

  if (!gameState.profile.questAccepted) {
    gameState.profile.questAccepted = true;
    network.acceptQuest(gameState.profile.name);
  }

  sfx.interact();
  network.sendActivity(`En ${tp.shortTitle}`);
  setModalActive(true, true);

  miniGameModal.open(tpId, factory, {
    onComplete: ({ tpId: doneId, score, durationSec }) => {
      // Optimistically update locally in case offline
      const p = { ...gameState.profile, grades: { ...gameState.profile.grades } };
      const prev = typeof p.grades[doneId] === 'number' ? p.grades[doneId] : -1;
      if (score > prev) p.grades[doneId] = score;
      const vals = Object.values(p.grades);
      p.average = vals.length
        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
        : null;
      p.completedCount = vals.filter((v) => v >= 10).length;
      p.diplomaEarned = p.completedCount === TP_CATALOG.length;
      gameState.setProfile(p);
      lab.updateStationBadges(p.grades);

      network.submitScore(gameState.profile.name, doneId, score, durationSec);
    },
    onClose: ({ replayTpId } = {}) => {
      network.sendActivity('Dans l’atelier');
      setModalActive(false, false);
      if (replayTpId) {
        openTp(replayTpId);
      }
    }
  });
}

function openFortinDialogue() {
  sfx.interact();
  network.sendActivity('Parle à M. Fortin');
  setModalActive(true, false);
  dialogueModal.open(gameState, {
    onAcceptQuest: () => {
      gameState.setProfile({ ...gameState.profile, questAccepted: true });
      network.acceptQuest(gameState.profile.name);
      hud.toast('Quêtes de M. Fortin acceptées ! Choisissez un poste de TP.');
    },
    onTeleportTp: (tpId) => {
      teleportNearTarget(tpId);
    },
    onClose: () => {
      network.sendActivity('Dans l’atelier');
      setModalActive(false, false);
    }
  });
}

function teleportNearTarget(id) {
  if (id === 'fortin') {
    player.teleportTo({ x: 0, z: 0.9 }, FORTIN_POS);
    hud.toast('Devant M. Fortin — Appuyez sur E pour lui parler');
    return;
  }
  const tp = getTpById(id);
  if (!tp) return;
  const offset = { x: tp.position.x, z: tp.position.z };
  if (tp.position.x < -4) offset.x += 2.3;
  else if (tp.position.x > 4) offset.x -= 2.3;
  else offset.z += 2.3;
  player.teleportTo(offset, tp.position);
  hud.toast(`${tp.icon} Devant ${tp.title} — Appuyez sur E pour lancer le TP`);
}

const hud = new HudManager(gameState, network, {
  onQualityChange: (q) => sceneMgr.setQuality(q),
  onFovChange: (fov) => sceneMgr.setFov(fov),
  onSensitivityChange: (s) => player.setSensitivity(s),
  onQuickNav: (id) => teleportNearTarget(id),
  onModalOpen: (isOpen) => setModalActive(isOpen, false)
});

// Networking bindings
network.on('status', ({ connected }) => {
  hud.setNetworkStatus(connected);
});

network.on('welcome', (msg) => {
  gameState.setProfile(msg.profile);
  lab.updateStationBadges(msg.profile.grades);
  remotePlayers.setPeers(msg.peers);
  hud.setNetworkStatus(true, msg.onlineCount);
  (msg.chatHistory || []).forEach((m) => hud.appendChatMessage(m));
  hud.toast(`Connecté en ${msg.room} (${msg.onlineCount} élève(s) en ligne)`, 'success');
});

network.on('profile_updated', ({ profile }) => {
  gameState.setProfile(profile);
  lab.updateStationBadges(profile.grades);
});

network.on('score_recorded', (res) => {
  gameState.setProfile(res.profile);
  lab.updateStationBadges(res.profile.grades);
  hud.toast(`+${res.xpGain} XP enregistrés sur le serveur !`, 'success');
});

network.on('player_joined', ({ player: p, onlineCount }) => {
  remotePlayers.upsertPeer(p);
  hud.setNetworkStatus(true, onlineCount);
  hud.toast(`${p.name} a rejoint l’atelier !`);
});

network.on('player_moved', ({ id, x, y, z, yaw }) => {
  remotePlayers.movePeer(id, x, y, z, yaw);
});

network.on('player_activity', ({ id, activity }) => {
  remotePlayers.setActivity(id, activity);
});

network.on('player_left', ({ id, name, onlineCount }) => {
  remotePlayers.removePeer(id);
  hud.setNetworkStatus(true, onlineCount);
  if (name) hud.toast(`${name} a quitté la salle.`);
});

network.on('chat_message', ({ message }) => {
  hud.appendChatMessage(message);
});

// Proximity & Interaction detection
function interactWith(target) {
  if (!target) return;
  if (target.id === 'fortin') openFortinDialogue();
  else openTp(target.id);
}

window.addEventListener('keydown', (e) => {
  if (!joined || modalOpen) return;
  if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
  if (e.code === 'KeyE' && nearestTarget) {
    e.preventDefault();
    interactWith(nearestTarget);
  }
});

document.getElementById('interact-prompt')?.addEventListener('click', () => {
  if (!joined || modalOpen || !nearestTarget) return;
  interactWith(nearestTarget);
});

// Click interaction & pointer lock on 3D canvas
const raycaster = new THREE.Raycaster();
let downPos = { x: 0, y: 0 };
canvas.addEventListener('mousedown', (e) => {
  downPos = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('mouseup', (e) => {
  if (!joined || modalOpen || e.button !== 0) return;
  const dragDist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
  if (dragDist > 6) return;

  // Check if clicking near a station / Fortin
  const ndc = new THREE.Vector2(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1
  );
  raycaster.setFromCamera(ndc, sceneMgr.camera);
  for (const item of allInteractables) {
    const hits = raycaster.intersectObject(item.mesh, true);
    if (hits.length > 0 && hits[0].distance < 7.5) {
      interactWith(item);
      return;
    }
  }

  // Otherwise enter smooth pointer-lock camera if desired
  player.requestPointerLock();
});

// Main 3D update loop
sceneMgr.addUpdater((dt, elapsed) => {
  player.update(dt);
  lab.update(elapsed);
  fortin.update(elapsed, player.position, gameState.profile.diplomaEarned);
  remotePlayers.update(dt);

  if (joined && !modalOpen) {
    network.sendMove(player.position.x, 0, player.position.z, player.yaw);

    // Find nearest interactable
    let best = null;
    let bestDist = Infinity;
    for (const item of allInteractables) {
      const dx = player.position.x - item.position.x;
      const dz = player.position.z - item.position.z;
      const d = Math.hypot(dx, dz);
      if (d <= item.interactRadius && d < bestDist) {
        best = item;
        bestDist = d;
      }
    }
    nearestTarget = best;
    hud.setInteractPrompt(best);
  }
});

sceneMgr.start();

// Start screen & server health probe
const startScreen = document.getElementById('start-screen');
const joinForm = document.getElementById('join-form');
const nameInput = document.getElementById('player-name-input');
const roomSelect = document.getElementById('room-select');
const startStatus = document.getElementById('start-server-status');

nameInput.value = localStorage.getItem('ciel_player_name') || '';

network.checkHealth().then((health) => {
  if (health?.ok) {
    startStatus.innerHTML = `<span class="dot online"></span> Serveur CIEL en ligne (${health.playersOnline} joueur(s) connecté(s))`;
  } else {
    startStatus.innerHTML = `<span class="dot"></span> Mode local prêt (serveur en attente)`;
  }
});

joinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = nameInput.value.trim() || 'Eleve_CIEL';
  const room = roomSelect.value || 'salle-e204';
  localStorage.setItem('ciel_player_name', name);

  sfx.interact();
  gameState.room = room;
  gameState.setProfile({ ...gameState.profile, name });
  joined = true;

  startScreen.classList.add('hidden');
  hud.show();
  player.setEnabled(true);
  network.connect(name, room);

  // Orient player cleanly toward M. Fortin at start
  player.teleportTo({ x: 0, z: 6.2 }, FORTIN_POS);

  setTimeout(() => {
    hud.toast('Approchez-vous de M. Fortin et appuyez sur E pour commencer !');
  }, 500);
});
