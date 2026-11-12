import './styles/main.css';
import './styles/minigames.css';

import * as THREE from 'three';
import { sfx } from './core/audio.js';
import { GameState, getTpById, getStationById, QUICK_EMOTES, TEACHER_POS, TP_CATALOG } from './core/gameState.js';
import { NetworkClient } from './core/network.js';
import { SceneManager } from './world/SceneManager.js';
import { PLATEAU_SPAWN, getZoneAtPosition, getStationTeleportSpot } from './world/plateauLayout.js';
import { buildLabWorld } from './world/LabBuilder.js';
import { createNpcTeacher } from './world/NpcTeacher.js';
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
import { createPatchRackGame } from './minigames/PatchRackGame.js';
import { createPcHardwareGame } from './minigames/PcHardwareGame.js';
import { createAudioVisualGame } from './minigames/AudioVisualGame.js';

const MINIGAME_FACTORIES = {
  oscilloscope: createOscilloscopeGame,
  soldering: createSolderingGame,
  electronics: createElectronicsGame,
  antivirus: createAntivirusGame,
  vmvlan: createVmVlanGame,
  patchrack: createPatchRackGame,
  hardware: createPcHardwareGame,
  audiovisual: (api) => createAudioVisualGame(api, { initialStage: 0 }),
  studio: (api) => createAudioVisualGame(api, { initialStage: 1 })
};

const extraStationGrades = {};

const gameState = new GameState();
const network = new NetworkClient();

const canvas = document.getElementById('game-canvas');
const sceneMgr = new SceneManager(canvas);
sceneMgr.setQuality(gameState.quality);
sceneMgr.setFov(gameState.fov);

const lab = buildLabWorld(sceneMgr.scene);
const teacher = createNpcTeacher(sceneMgr.scene);
const allColliders = [...lab.colliders, teacher.collider];
const allInteractables = [teacher.interactable, ...lab.interactables];

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

let joined = false;
let modalOpen = false;
let subModalActive = false;
let nearestTarget = null;
let wallLeaderboardPending = false;

function syncWallLeaderboard(entries = gameState.leaderboard) {
  lab.updateLeaderboardBoard?.(entries, gameState.profile.name);
}

async function refreshWallLeaderboard() {
  if (wallLeaderboardPending) return;
  wallLeaderboardPending = true;
  try {
    const list = await network.fetchLeaderboard(3000);
    if (Array.isArray(list) && (list.length > 0 || gameState.leaderboard.length === 0)) {
      gameState.setLeaderboard(list);
      syncWallLeaderboard(list);
    }
  } finally {
    wallLeaderboardPending = false;
  }
}

function setModalActive(active, pauseScene = false, lockActivity = false) {
  modalOpen = active;
  subModalActive = lockActivity;
  player.setEnabled(joined && !active);
  touchControls?.setVisible(joined && !active && gameState.touchMode);
  sceneMgr.setPaused(pauseScene);
}

function openTp(tpId) {
  const tp = getStationById(tpId);
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
      if (getTpById(doneId)) {
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
        lab.updateStationBadges({ ...p.grades, ...extraStationGrades });

        network.submitScore(gameState.profile.name, doneId, score, durationSec, gameState.skin);
        setTimeout(() => refreshWallLeaderboard(), 450);
      } else {
        extraStationGrades[doneId] = Math.max(extraStationGrades[doneId] ?? 0, score);
        lab.updateStationBadges({ ...gameState.profile.grades, ...extraStationGrades });
        hud.toast(`${tp.icon} Atelier ${tp.shortTitle} terminé (${score.toFixed(1)}/20) !`, score >= 10 ? 'success' : 'info');
      }
    },
    onClose: ({ replayTpId } = {}) => {
      network.sendActivity('Sur le Plateau U300');
      setModalActive(false, false, false);
      if (replayTpId) {
        openTp(replayTpId);
      }
    }
  });
}

function openTeacherDialogue() {
  sfx.interact();
  network.sendActivity('Parle au Professeur CIEL');
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
  const spot = getStationTeleportSpot(id);
  if (!spot) return;
  player.teleportTo(spot.pos, spot.lookAt);
  const zone = getZoneAtPosition(player.position.x, player.position.z);
  hud?.setCurrentZone?.(zone);
  network.sendMove(player.position.x, 0, player.position.z, player.yaw, true);
  network.sendZone(zone.id, zone.badgeText.replace('📍 ', ''));
  if (id === 'teacher') {
    hud.toast('Devant le Professeur CIEL (Hall U300) — Appuyez sur E pour lui parler');
    return;
  }
  const st = getStationById(id);
  if (st) {
    hud.toast(`${st.icon} Salle ${st.room} : ${st.shortTitle} — Appuyez sur E pour commencer`);
  }
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
  syncWallLeaderboard(msg.leaderboard || []);
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
  syncWallLeaderboard();
});

network.on('profile_reset', ({ profile, message }) => {
  gameState.setProfile(profile);
  lab.updateStationBadges(profile.grades);
  refreshWallLeaderboard();
  hud.toast(message || 'Votre progression a été réinitialisée par l’administrateur.', 'error');
});

network.on('account_deleted', ({ message }) => {
  returnToMainMenu();
  hud.toast(message || 'Votre compte a été supprimé par l’administrateur.', 'error');
});

network.on('score_recorded', (res) => {
  gameState.setProfile(res.profile);
  lab.updateStationBadges(res.profile.grades);
  refreshWallLeaderboard();
  hud.toast(`+${res.xpGain} XP enregistrés sur le serveur !`, 'success');
});

network.on('player_joined', ({ player: p, onlineCount, roomRoster }) => {
  remotePlayers.upsertPeer(p);
  if (roomRoster) gameState.setRoomRoster(roomRoster);
  hud.setNetworkStatus(true, onlineCount);
  refreshWallLeaderboard();
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

network.on('player_zone', ({ id, zoneId, zoneLabel, roomRoster }) => {
  remotePlayers.setZone(id, zoneId, zoneLabel);
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
  syncWallLeaderboard(leaderboard);
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
  refreshWallLeaderboard();
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
  if (target.id === 'teacher') openTeacherDialogue();
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
  } else if (e.code === 'KeyM') {
    e.preventDefault();
    sfx.click();
    hud.toggleMinimap();
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

let lastZoneId = '';
let lastMiniMapDrawAt = 0;

sceneMgr.addUpdater((dt, elapsed) => {
  lab.update(elapsed);
  teacher.update(elapsed, joined ? player.position : null, gameState.profile.diplomaEarned);
  remotePlayers.update(dt);
  updateSpeechBubble(localBubble, dt);

  if (!joined) {
    const angle = elapsed * 0.14;
    sceneMgr.camera.position.set(-4.5 + Math.sin(angle) * 6.5, 4.2, Math.cos(angle) * 6.5);
    sceneMgr.camera.lookAt(-2.0, 1.4, -0.5);
    return;
  }

  const step = player.update(dt);
  const currentZone = getZoneAtPosition(player.position.x, player.position.z);
  if (currentZone.id !== lastZoneId) {
    lastZoneId = currentZone.id;
    hud?.setCurrentZone?.(currentZone);
    network.sendZone(currentZone.id, currentZone.badgeText.replace('📍 ', ''));
  }

  if (elapsed - lastMiniMapDrawAt >= 0.05) {
    lastMiniMapDrawAt = elapsed;
    hud?.updateMiniMap?.({
      playerPos: player.position,
      playerYaw: player.yaw,
      currentZone,
      peers: remotePlayers.getMiniMapPeers()
    });
  }

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
refreshWallLeaderboard();

setInterval(() => {
  if (joined && !subModalActive) {
    refreshWallLeaderboard();
  }
}, 12000);

mainMenu = new MainMenu(gameState, network, {
  onOpenSettings: () => hud?.openSettingsModal?.(),
  onOpenPlatform: () => platformModal?.open?.(gameState.touchMode, null, true),
  onOpenFaq: () => faqModal?.open?.('list'),
  onStartGame: ({ name, room, skin }) => {
    const cleanRoom = room || 'plateau-u300';
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
    player.teleportTo(PLATEAU_SPAWN, PLATEAU_SPAWN.lookAt);
    const startZone = getZoneAtPosition(PLATEAU_SPAWN.x, PLATEAU_SPAWN.z);
    lastZoneId = startZone.id;
    hud?.setCurrentZone?.(startZone);
    network.connect(name, cleanRoom, skin, {
      x: PLATEAU_SPAWN.x,
      y: 0,
      z: PLATEAU_SPAWN.z,
      yaw: player.yaw,
      zoneId: startZone.id,
      zoneLabel: startZone.badgeText.replace('📍 ', '')
    });
    refreshWallLeaderboard();

    setTimeout(() => {
      hud?.toast?.(
        gameState.touchMode
          ? 'Bienvenue sur le Plateau U300 ! Touchez Parler devant le Professeur CIEL.'
          : 'Bienvenue sur le Plateau U300 ! Appuyez sur E devant le Professeur CIEL.'
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
