import './styles/main.css';
import './styles/minigames.css';

import * as THREE from 'three';
import { sfx } from './core/audio.js';
import { FORTIN_POS, GameState, getTpById, QUICK_EMOTES, TP_CATALOG } from './core/gameState.js';
import { NetworkClient } from './core/network.js';
import { SceneManager } from './world/SceneManager.js';
import { buildLabWorld } from './world/LabBuilder.js';
import { createNpcFortin } from './world/NpcFortin.js';
import { PlayerController } from './world/PlayerController.js';
import {
  createSpeechBubble,
  RemotePlayersManager,
  showSpeechBubble,
  updateSpeechBubble
} from './world/RemotePlayers.js';
import { buildStudentAvatarMesh, disposeObject3D } from './world/AvatarBuilder.js';
import { HudManager } from './ui/HudManager.js';
import { MainMenu } from './ui/MainMenu.js';
import { DialogueModal } from './ui/DialogueModal.js';
import { ChangelogModal } from './ui/ChangelogModal.js';
import { TouchControls } from './ui/TouchControls.js';
import { PlatformModal } from './ui/PlatformModal.js';
import { FaqModal } from './ui/FaqModal.js';
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

const player = new PlayerController(sceneMgr.camera, canvas, allColliders, {
  onJump: () => sfx.jump()
});
player.setSensitivity(gameState.mouseSens);
player.setCameraMode(gameState.cameraMode);
player.setTouchMode(gameState.touchMode);

let localAvatar = null;
const localBubble = createSpeechBubble(2.94);

function rebuildLocalAvatar(skin) {
  if (localAvatar?.group) {
    localAvatar.group.remove(localBubble);
    sceneMgr.scene.remove(localAvatar.group);
    disposeObject3D(localAvatar.group, new Set([localBubble]));
  }
  localAvatar = buildStudentAvatarMesh(skin);
  localAvatar.group.add(localBubble);
  sceneMgr.scene.add(localAvatar.group);
  player.setAvatar(localAvatar);
}
rebuildLocalAvatar(gameState.skin);
player.setAvatarVisible(false);

const remotePlayers = new RemotePlayersManager(sceneMgr.scene);

let hud = null;
let mainMenu = null;
let platformModal = null;
let touchControls = null;
let dialogueModal = null;
let miniGameModal = null;
let changelogModal = null;
let faqModal = null;

try {
  dialogueModal = new DialogueModal();
  miniGameModal = new MiniGameModal();
} catch (err) {
  console.warn('Modales de dialogue/TP:', err);
}

try {
  changelogModal = new ChangelogModal();
} catch (err) {
  console.warn('Modale changelog:', err);
}

try {
  faqModal = new FaqModal({
    getDefaultAuthor: () =>
      document.getElementById('player-name-input')?.value?.trim() ||
      gameState.profile.name ||
      localStorage.getItem('ciel_player_name') ||
      '',
    onToast: (msg, type) => hud?.toast?.(msg, type)
  });
} catch (err) {
  console.warn('Modale FAQ:', err);
}

document.getElementById('menu-version-badge')?.addEventListener('click', () => {
  sfx.click();
  changelogModal?.open?.();
});

document.getElementById('hud-version-badge')?.addEventListener('click', () => {
  sfx.click();
  setModalActive(true, false, false);
  if (changelogModal) {
    changelogModal.open(() => setModalActive(false, false, false));
  } else {
    setModalActive(false, false, false);
  }
});

let joined = false;
let modalOpen = false;
let subModalActive = false;
let nearestTarget = null;

function setModalActive(active, pauseScene = false, lockActivity = false) {
  modalOpen = active;
  subModalActive = lockActivity;
  player.setEnabled(joined && !active);
  touchControls?.setVisible(joined && !active && gameState.touchMode);
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
  setModalActive(true, true, true);

  miniGameModal.open(tpId, factory, {
    onComplete: ({ tpId: doneId, score, durationSec }) => {
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

      network.submitScore(gameState.profile.name, doneId, score, durationSec, gameState.skin);
    },
    onClose: ({ replayTpId } = {}) => {
      network.sendActivity('Dans l’atelier');
      setModalActive(false, false, false);
      if (replayTpId) {
        openTp(replayTpId);
      }
    }
  });
}

function openFortinDialogue() {
  sfx.interact();
  network.sendActivity('Parle à M. Fortin');
  setModalActive(true, false, true);
  dialogueModal.open(gameState, {
    onAcceptQuest: () => {
      gameState.setProfile({ ...gameState.profile, questAccepted: true });
      network.acceptQuest(gameState.profile.name);
      hud.toast('Programme des TP démarré ! Choisissez un poste de TP.');
    },
    onTeleportTp: (tpId) => {
      teleportNearTarget(tpId);
    },
    onClose: () => {
      network.sendActivity('Dans l’atelier');
      setModalActive(false, false, false);
    }
  });
}

function teleportNearTarget(id) {
  if (id === 'fortin') {
    player.teleportTo({ x: 0, z: 0.9 }, FORTIN_POS);
    network.sendMove(player.position.x, 0, player.position.z, player.yaw, true);
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
  network.sendMove(player.position.x, 0, player.position.z, player.yaw, true);
  hud.toast(`${tp.icon} Devant ${tp.title} — Appuyez sur E pour lancer le TP`);
}

hud = new HudManager(gameState, network, {
  onQualityChange: (q) => sceneMgr.setQuality(q),
  onFovChange: (fov) => sceneMgr.setFov(fov),
  onCameraModeChange: (mode) => {
    player.setCameraMode(mode);
    touchControls?.syncCameraMode(mode);
  },
  onTouchModeChange: (active) => {
    player.setTouchMode(active);
    touchControls?.setVisible(joined && !modalOpen && active);
    mainMenu?.updatePlatformButton?.(active);
    platformModal?.syncActiveChoice?.(active);
  },
  onOpenPlatform: () => {
    if (!platformModal) return;
    setModalActive(true, false, false);
    platformModal.open(gameState.touchMode, () => setModalActive(false, false, false), true);
  },
  onOpenFaq: () => {
    if (!faqModal) return;
    setModalActive(true, false, false);
    faqModal.open('list', () => setModalActive(false, false, false));
  },
  onSensitivityChange: (s) => player.setSensitivity(s),
  onQuickNav: (id) => teleportNearTarget(id),
  onModalOpen: (isOpen) => setModalActive(isOpen, false, false),
  onSkinChange: (skin) => {
    rebuildLocalAvatar(skin);
    network.sendSkinUpdate(skin);
  },
  onLocalChatSent: (text) => {
    showSpeechBubble(localBubble, text, { isEmote: false, color: gameState.skin.outfitColor });
  },
  onLocalEmote: (emote) => {
    showSpeechBubble(localBubble, emote.label, { isEmote: true, color: gameState.skin.outfitColor });
  },
  onReturnToMenu: () => returnToMainMenu()
});

function toggleCameraMode() {
  sfx.click();
  const next = gameState.cameraMode === 'third' ? 'first' : 'third';
  gameState.setCameraMode(next);
  player.setCameraMode(next);
  hud?.syncCameraUi?.();
  touchControls?.syncCameraMode(next);
  hud?.toast?.(next === 'third' ? '🎥 Caméra 3ème personne' : '🎥 Caméra 1ère personne');
}

try {
  touchControls = new TouchControls(player, {
    onInteract: () => {
      if (joined && !modalOpen && nearestTarget) interactWith(nearestTarget);
    },
    onToggleCamera: () => {
      if (joined && !modalOpen) toggleCameraMode();
    },
    onTapLookZone: (x, y) => {
      if (joined && !modalOpen) tryRaycastInteract(x, y);
    }
  });
  touchControls.syncCameraMode(gameState.cameraMode);
} catch (err) {
  console.warn('Contrôles tactiles indisponibles:', err);
}

function returnToMainMenu() {
  joined = false;
  modalOpen = false;
  subModalActive = false;
  player.setEnabled(false);
  player.setAvatarVisible(false);
  touchControls?.setVisible(false);
  network.disconnect();
  remotePlayers.clearAll();
  hud?.hide?.();
  mainMenu?.show?.();
}

let notifiedNetError = false;

network.on('status', (status) => {
  hud.setNetworkStatus(status);
  if (status.state === 'reconnecting' && !notifiedNetError) {
    notifiedNetError = true;
    hud.toast(
      `Connexion WebSocket perdue (${status.error || 'erreur réseau'}) — Reconnexion auto...`,
      'error'
    );
  }
});

network.on('pong', ({ onlineCount }) => {
  if (typeof onlineCount === 'number') {
    hud.setNetworkStatus({ state: 'connected', connected: true }, onlineCount);
  }
});

network.on('welcome', (msg) => {
  const requestedName = gameState.profile.name;
  notifiedNetError = false;
  gameState.setProfile(msg.profile);
  lab.updateStationBadges(msg.profile.grades);
  remotePlayers.setPeers(msg.peers);
  gameState.setRoomRoster(msg.roomRoster || []);
  gameState.setLeaderboard(msg.leaderboard || []);
  remotePlayers.syncLeaderboardRanks(msg.leaderboard || []);
  hud.setNetworkStatus({ state: 'connected', connected: true }, msg.onlineCount);
  hud.clearChat();
  (msg.chatHistory || []).forEach((m) => hud.appendChatMessage(m, false));
  if (requestedName && msg.profile?.name && requestedName !== msg.profile.name) {
    hud.toast(`Multi-onglet détecté : connecté sous "${msg.profile.name}"`, 'info');
  }
  hud.toast(`Connecté en ${msg.room} (${msg.onlineCount} élève(s) en ligne)`, 'success');
});

network.on('profile_updated', ({ profile }) => {
  gameState.setProfile(profile);
  lab.updateStationBadges(profile.grades);
});

network.on('profile_reset', ({ profile, message }) => {
  gameState.setProfile(profile);
  lab.updateStationBadges(profile.grades);
  hud.toast(message || 'Votre progression a été réinitialisée par l’administrateur.', 'error');
});

network.on('account_deleted', ({ message }) => {
  returnToMainMenu();
  hud.toast(message || 'Votre compte a été supprimé par l’administrateur.', 'error');
});

network.on('score_recorded', (res) => {
  gameState.setProfile(res.profile);
  lab.updateStationBadges(res.profile.grades);
  hud.toast(`+${res.xpGain} XP enregistrés sur le serveur !`, 'success');
});

network.on('player_joined', ({ player: p, onlineCount, roomRoster }) => {
  remotePlayers.upsertPeer(p);
  if (roomRoster) gameState.setRoomRoster(roomRoster);
  hud.setNetworkStatus(true, onlineCount);
  hud.toast(`${p.name} a rejoint l’atelier !`);
});

network.on('player_moved', ({ id, x, y, z, yaw }) => {
  remotePlayers.movePeer(id, x, y, z, yaw);
});

network.on('player_skin_updated', ({ id, skin }) => {
  remotePlayers.setSkin(id, skin);
});

network.on('player_activity', ({ id, activity, roomRoster }) => {
  remotePlayers.setActivity(id, activity);
  if (roomRoster) gameState.setRoomRoster(roomRoster);
});

network.on('player_stats_updated', ({ id, profile }) => {
  remotePlayers.setStats(id, profile);
});

network.on('player_emote', ({ id, label, color }) => {
  remotePlayers.showBubble(id, label, { isEmote: true, color });
});

network.on('tp_announcement', ({ playerId, tpLabel, score, diplomaEarned, message, color }) => {
  sfx.interact();
  hud.toast(diplomaEarned ? `🎓 ${message}` : `📢 ${message}`, diplomaEarned ? 'success' : 'info');
  if (playerId) {
    remotePlayers.showBubble(playerId, `${score}/20 au ${tpLabel} !`, {
      isEmote: true,
      color: diplomaEarned ? '#fbbf24' : color || '#22d3ee'
    });
  }
});

network.on('leaderboard_updated', ({ leaderboard }) => {
  gameState.setLeaderboard(leaderboard);
  remotePlayers.syncLeaderboardRanks(leaderboard);
  const me = leaderboard?.find(
    (row) => row.name?.toLowerCase() === gameState.profile.name?.toLowerCase()
  );
  if (me && (me.rank !== gameState.profile.rank || me.rankLabel !== gameState.profile.rankLabel)) {
    gameState.setProfile({ ...gameState.profile, rank: me.rank, rankLabel: me.rankLabel });
  }
});

network.on('player_left', ({ id, name, onlineCount, roomRoster }) => {
  remotePlayers.removePeer(id);
  if (roomRoster) gameState.setRoomRoster(roomRoster);
  hud.setNetworkStatus(true, onlineCount);
  if (name) hud.toast(`${name} a quitté la salle.`);
});

network.on('chat_message', ({ message }) => {
  hud.appendChatMessage(message, true);
  if (!message.system && message.playerId && message.playerId !== network.clientId) {
    remotePlayers.showBubble(message.playerId, message.text, {
      isEmote: false,
      color: message.color || '#22d3ee'
    });
  }
});

function interactWith(target) {
  if (!target) return;
  if (target.id === 'fortin') openFortinDialogue();
  else openTp(target.id);
}

window.addEventListener('keydown', (e) => {
  const isTyping =
    e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);

  if (e.code === 'Escape' && !subModalActive) {
    if (changelogModal?.close?.() || faqModal?.close?.() || platformModal?.close?.()) {
      e.preventDefault();
      return;
    }
    if (joined && (hud.closeLeaderboard() || hud.closeSkinModal() || hud.closeSettings())) {
      e.preventDefault();
      return;
    }
  }

  if (e.code === 'Tab' && joined && !subModalActive && !isTyping) {
    if (
      !hud.isSettingsOpen() &&
      !hud.isSkinOpen() &&
      !changelogModal?.isOpen?.() &&
      !faqModal?.isOpen?.() &&
      !platformModal?.isOpen?.()
    ) {
      e.preventDefault();
      sfx.click();
      hud.toggleLeaderboard();
      return;
    }
  }

  if (!joined || modalOpen || isTyping) return;

  if (e.code === 'KeyE' && nearestTarget) {
    e.preventDefault();
    interactWith(nearestTarget);
  } else if (e.code === 'KeyV') {
    e.preventDefault();
    toggleCameraMode();
  } else if (e.code === 'KeyT') {
    e.preventDefault();
    player.clearKeys();
    hud.toggleChat(true, true);
  } else if (e.code.startsWith('Digit') || e.code.startsWith('Numpad')) {
    const num = Number(e.code.replace('Digit', '').replace('Numpad', ''));
    if (num >= 1 && num <= QUICK_EMOTES.length) {
      e.preventDefault();
      hud.triggerEmote(num - 1);
    }
  }
});

document.getElementById('interact-prompt')?.addEventListener('click', () => {
  if (!joined || modalOpen || !nearestTarget) return;
  interactWith(nearestTarget);
});

const raycaster = new THREE.Raycaster();
function tryRaycastInteract(clientX, clientY) {
  const ndc = new THREE.Vector2(
    (clientX / window.innerWidth) * 2 - 1,
    -(clientY / window.innerHeight) * 2 + 1
  );
  raycaster.setFromCamera(ndc, sceneMgr.camera);
  for (const item of allInteractables) {
    const hits = raycaster.intersectObject(item.mesh, true);
    if (hits.length > 0 && hits[0].distance < 7.5) {
      interactWith(item);
      return true;
    }
  }
  return false;
}

let downPos = { x: 0, y: 0 };
canvas.addEventListener('mousedown', (e) => {
  downPos = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('mouseup', (e) => {
  if (!joined || modalOpen || e.button !== 0 || gameState.touchMode) return;
  const dragDist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
  if (dragDist > 6) return;

  if (tryRaycastInteract(e.clientX, e.clientY)) return;

  player.requestPointerLock();
});

sceneMgr.addUpdater((dt, elapsed) => {
  lab.update(elapsed);
  fortin.update(elapsed, joined ? player.position : null, gameState.profile.diplomaEarned);
  remotePlayers.update(dt);
  updateSpeechBubble(localBubble, dt);

  if (!joined) {
    const angle = elapsed * 0.14;
    sceneMgr.camera.position.set(Math.sin(angle) * 9.5, 3.2, Math.cos(angle) * 7.5 + 1.2);
    sceneMgr.camera.lookAt(0, 1.3, -2.2);
    return;
  }

  const step = player.update(dt);

  if (!modalOpen) {
    const jumpY = Math.max(0, player.position.y - player.groundY);
    network.sendMove(
      player.position.x,
      jumpY,
      player.position.z,
      player.yaw,
      Boolean(step?.landed)
    );

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
    hud?.setInteractPrompt?.(best);
    touchControls?.setInteractTarget?.(best);
  }
});

sceneMgr.start();

mainMenu = new MainMenu(gameState, network, {
  onOpenSettings: () => hud?.openSettingsModal?.(),
  onOpenPlatform: () => platformModal?.open?.(gameState.touchMode, null, true),
  onOpenFaq: () => faqModal?.open?.('list'),
  onStartGame: ({ name, room, skin }) => {
    const cleanRoom = room || 'salle-e204';
    notifiedNetError = false;
    gameState.room = cleanRoom;
    gameState.setProfile({ ...gameState.profile, name, skin });
    rebuildLocalAvatar(skin);
    joined = true;

    hud.show();
    player.setAvatarVisible(true);
    player.setCameraMode(gameState.cameraMode);
    player.setTouchMode(gameState.touchMode);
    player.setEnabled(true);
    touchControls?.syncCameraMode?.(gameState.cameraMode);
    touchControls?.setVisible?.(gameState.touchMode);
    player.teleportTo({ x: 0, z: 6.2 }, FORTIN_POS);
    network.connect(name, cleanRoom, skin, {
      x: 0,
      y: 0,
      z: 6.2,
      yaw: player.yaw
    });

    setTimeout(() => {
      hud?.toast?.(
        gameState.touchMode
          ? 'Approchez-vous de M. Fortin et touchez Parler pour commencer !'
          : 'Approchez-vous de M. Fortin et appuyez sur E pour commencer !'
      );
    }, 500);
  }
});

try {
  platformModal = new PlatformModal({
    onSelect: (mode) => {
      sfx.click();
      const isMobile = mode === 'mobile';
      gameState.setTouchMode(isMobile);
      player.setTouchMode(isMobile);
      hud?.syncTouchUi?.();
      mainMenu?.updatePlatformButton?.(isMobile);
      hud?.toast?.(
        isMobile
          ? '📱 Mode Mobile / Tablette activé (contrôles tactiles)'
          : '💻 Mode PC activé (Clavier ZQSD + Souris)'
      );
    }
  });
  platformModal.open(gameState.touchMode, null, false);
} catch (err) {
  console.warn('Sélecteur de plateforme indisponible:', err);
}
