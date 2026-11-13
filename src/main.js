import './styles/main.css';
import './styles/minigames.css';

import * as THREE from 'three';
import { sfx } from './core/audio.js';
import { GameState, getTpById, getStationById, QUICK_EMOTES, TP_CATALOG } from './core/gameState.js';
import { NetworkClient } from './core/network.js';
import { SceneManager } from './world/SceneManager.js';
import {
  createDefaultMap,
  getStationTeleportInMap,
  getZoneAtPositionInMap,
  normalizeMapData
} from './world/mapSchema.js';
import { buildLabWorld } from './world/LabBuilder.js';
import { PlayerController } from './world/PlayerController.js';
import {
  createSpeechBubble,
  RemotePlayersManager,
  showSpeechBubble,
  updateSpeechBubble
} from './world/RemotePlayers.js';
import {
  buildStudentAvatarMesh,
  createVoiceIndicatorSprite,
  disposeObject3D,
  updateVoiceIndicatorSprite
} from './world/AvatarBuilder.js';
import { ProximityVoiceChat } from './network/ProximityVoiceChat.js';
import { VRManager } from './vr/VRManager.js';
import { HudManager } from './ui/HudManager.js';
import { MainMenu } from './ui/MainMenu.js';
import { DialogueModal } from './ui/DialogueModal.js';
import { ChangelogModal } from './ui/ChangelogModal.js';
import { TouchControls } from './ui/TouchControls.js';
import { PlatformModal } from './ui/PlatformModal.js';
import { FaqModal } from './ui/FaqModal.js';
import { BattlePassModal } from './ui/BattlePassModal.js';
import { MiniGameModal } from './minigames/MiniGameModal.js';
import { createOscilloscopeGame } from './minigames/OscilloscopeGame.js';
import { createSolderingGame } from './minigames/SolderingGame.js';
import { createElectronicsGame } from './minigames/ElectronicsGame.js';
import { createAntivirusGame } from './minigames/AntivirusGame.js';
import { createVlanConfigGame } from './minigames/VlanConfigGame.js';
import { createPatchPanelGame } from './minigames/PatchPanelGame.js';
import { createPcHardwareGame } from './minigames/PcHardwareGame.js';
import { createDmxLightingGame } from './minigames/DmxLightingGame.js';
import { createStudioRegieGame } from './minigames/StudioRegieGame.js';

const MINIGAME_FACTORIES = {
  oscilloscope: createOscilloscopeGame,
  soldering: createSolderingGame,
  electronics: createElectronicsGame,
  antivirus: createAntivirusGame,
  vmvlan: createVlanConfigGame,
  patchrack: createPatchPanelGame,
  hardware: createPcHardwareGame,
  audiovisual: createDmxLightingGame,
  studio: createStudioRegieGame
};

const extraStationGrades = {};

const gameState = new GameState();
const network = new NetworkClient();

const canvas = document.getElementById('game-canvas');
const sceneMgr = new SceneManager(canvas);
sceneMgr.setQuality(gameState.quality);
sceneMgr.setFov(gameState.fov);

let currentMapData = createDefaultMap();
const lab = buildLabWorld(sceneMgr.scene, currentMapData, { maxAnisotropy: sceneMgr.getMaxAnisotropy() });
sceneMgr.updateWorldBounds(currentMapData.bounds);

const player = new PlayerController(sceneMgr.camera, canvas, lab.colliders, {
  onJump: () => sfx.jump()
});
player.setBounds(currentMapData.bounds);
player.setSensitivity(gameState.mouseSens);
player.setCameraMode(gameState.cameraMode);
player.setTouchMode(gameState.touchMode);

let localAvatar = null;
const localBubble = createSpeechBubble(2.94);
const localVoiceIndicator = createVoiceIndicatorSprite(2.78);

let vrManager = null;
let latestVoiceState = {};

function rebuildLocalAvatar(skin) {
  if (localAvatar?.group) {
    localAvatar.group.remove(localBubble);
    localAvatar.group.remove(localVoiceIndicator);
    sceneMgr.scene.remove(localAvatar.group);
    disposeObject3D(localAvatar.group, new Set([localBubble, localVoiceIndicator]));
  }
  localAvatar = buildStudentAvatarMesh(skin);
  localAvatar.group.add(localBubble);
  localAvatar.group.add(localVoiceIndicator);
  localAvatar.setFirstPersonVrHidden?.(Boolean(vrManager?.isVrActive?.()));
  sceneMgr.scene.add(localAvatar.group);
  player.setAvatar(localAvatar);
  vrManager?.setSkin?.(skin);
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
let battlePassModal = null;

const voiceChat = new ProximityVoiceChat(network, {
  mode: gameState.voiceMode,
  tpBehavior: gameState.voiceTpMode,
  volume: gameState.voiceVolume,
  onToast: (msg, type) => hud?.toast?.(msg, type),
  onStateChange: (state) => {
    latestVoiceState = state || {};
    hud?.syncVoiceUi?.(state);
    touchControls?.syncVoiceUi?.(state);
    vrManager?.updateHudInfo?.({
      micEnabled: Boolean(latestVoiceState.micEnabled),
      isSpeaking: Boolean(latestVoiceState.isSpeaking)
    });
  }
});

vrManager = new VRManager(sceneMgr, player, {
  skin: gameState.skin,
  playerName: gameState.profile?.name || 'Eleve_CIEL',
  getInteractables: () => lab.interactables,
  getNearestInteractable: () => nearestTarget,
  onInteract: (item) => interactWith(item),
  onToggleMic: () => voiceChat.toggleMicrophone(),
  onEnterVr: () => {
    localAvatar?.setFirstPersonVrHidden?.(true);
    player.setAvatarVisible(true);
    player.setEnabled(false);
    touchControls?.setVisible(false);
    vrManager.setSkin(gameState.skin);
    if (joined) {
      network.sendMove(player.position.x, 0, player.position.z, player.yaw, true, vrManager.getVrSyncPayload());
    }
  },
  onExitVr: () => {
    if (miniGameModal?.backdrop && !miniGameModal.backdrop.classList.contains('hidden')) {
      miniGameModal.close();
    }
    localAvatar?.setFirstPersonVrHidden?.(false);
    player.setEnabled(joined && !modalOpen);
    player._applyCamera?.();
    touchControls?.setVisible(joined && !modalOpen && gameState.touchMode);
    if (joined) {
      network.sendMove(player.position.x, 0, player.position.z, player.yaw, true, { active: false });
    }
  },
  onStateChange: (st) => hud?.syncVrUi?.(st),
  onToast: (msg, type) => hud?.toast?.(msg, type)
});
sceneMgr.addAlwaysUpdater((dt, elapsed) => {
  vrManager?.update(dt, elapsed);
});

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
  battlePassModal = new BattlePassModal({
    getBaseSkin: () => gameState.skin,
    onPurchaseAttempt: () => {
      const playerName =
        document.getElementById('player-name-input')?.value?.trim() ||
        localStorage.getItem('ciel_player_name')?.trim() ||
        '';
      const platform = gameState.touchMode ? 'Mobile' : 'PC';
      fetch('/api/pigeons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, platform }),
        keepalive: true
      }).catch(() => {});
    }
  });
} catch (err) {
  console.warn('Modale Passe de Combat:', err);
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

function getSpawnPose(mapData) {
  const sp = mapData?.spawn || { x: 0, z: 2, yaw: 0 };
  const yaw = typeof sp.yaw === 'number' ? sp.yaw : 0;
  return {
    pos: { x: sp.x, z: sp.z },
    lookAt: { x: sp.x - Math.sin(yaw) * 4, z: sp.z - Math.cos(yaw) * 4 },
    yaw
  };
}

function applyMapData(rawMap, liveUpdate = false) {
  if (!rawMap) return;
  currentMapData = normalizeMapData(rawMap);
  lab.rebuildWorld(currentMapData);
  lab.updateStationBadges(gameState.profile.grades);
  sceneMgr.updateWorldBounds(currentMapData.bounds);
  player.setColliders(lab.colliders);
  player.setBounds(currentMapData.bounds);
  hud?.miniMap?.setMapData?.(currentMapData);
  hud?.setMapData?.(currentMapData);
  syncWallLeaderboard();

  if (liveUpdate && joined) {
    const b = currentMapData.bounds;
    const pos = player.position;
    const outOfBounds =
      pos.x < b.minX + 0.5 || pos.x > b.maxX - 0.5 || pos.z < b.minZ + 0.5 || pos.z > b.maxZ - 0.5;
    if (outOfBounds || player._collides?.(pos.x, pos.z)) {
      const pose = getSpawnPose(currentMapData);
      player.teleportTo(pose.pos, pose.lookAt);
    }
    const zone = getZoneAtPositionInMap(currentMapData, player.position.x, player.position.z);
    lastZoneId = zone.id;
    hud?.setCurrentZone?.(zone);
  }
}

async function fetchInitialMap() {
  const remoteMap = await network.fetchMap(3500);
  if (remoteMap) {
    applyMapData(remoteMap, false);
  }
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
  const vrOn = Boolean(vrManager?.isVrActive?.());
  player.setEnabled(joined && !active && !vrOn);
  touchControls?.setVisible(joined && !active && !vrOn && gameState.touchMode);
  sceneMgr.setPaused(pauseScene);
}

let activeCameraTweenId = 0;

function animateCameraPose(targetPos, lookAtPos, durationMs = 420) {
  const tweenId = ++activeCameraTweenId;
  const startPos = sceneMgr.camera.position.clone();
  const startQuat = sceneMgr.camera.quaternion.clone();
  const dummyCam = sceneMgr.camera.clone();
  dummyCam.position.copy(targetPos);
  dummyCam.lookAt(lookAtPos);
  const endQuat = dummyCam.quaternion.clone();
  const t0 = performance.now();

  return new Promise((resolve) => {
    const step = (now) => {
      if (tweenId !== activeCameraTweenId) {
        resolve(false);
        return;
      }
      const p = Math.min(1, (now - t0) / Math.max(1, durationMs));
      const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      sceneMgr.camera.position.lerpVectors(startPos, targetPos, ease);
      sceneMgr.camera.quaternion.slerpQuaternions(startQuat, endQuat, ease);
      sceneMgr.renderer.render(sceneMgr.scene, sceneMgr.camera);
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        resolve(true);
      }
    };
    requestAnimationFrame(step);
  });
}

async function openTp(tpId, stationItem = null) {
  const tp = getStationById(tpId);
  const factory = MINIGAME_FACTORIES[tpId];
  if (!tp || !factory) return;

  if (!gameState.profile.questAccepted) {
    gameState.profile.questAccepted = true;
    network.acceptQuest(gameState.profile.name);
  }

  sfx.interact();
  network.sendActivity(`En ${tp.shortTitle}`);
  voiceChat.setInTp(true);
  setModalActive(true, true, true);

  if (stationItem?.position && !vrManager?.isVrActive?.()) {
    const stPos = stationItem.position;
    const dx = player.position.x - stPos.x;
    const dz = player.position.z - stPos.z;
    const len = Math.max(0.4, Math.hypot(dx, dz));
    const camPos = new THREE.Vector3(
      stPos.x + (dx / len) * 1.35,
      1.68,
      stPos.z + (dz / len) * 1.35
    );
    const lookTarget = new THREE.Vector3(stPos.x, 1.02, stPos.z);
    await animateCameraPose(camPos, lookTarget, 380);
  }

  miniGameModal.open(tpId, factory, {
    vrManager,
    onComplete: ({ tpId: doneId, score, durationSec }) => {
      const p = { ...gameState.profile, grades: { ...gameState.profile.grades } };
      const prev = typeof p.grades[doneId] === 'number' ? p.grades[doneId] : -1;
      if (score > prev) p.grades[doneId] = score;
      const coreVals = TP_CATALOG.map((item) => p.grades[item.id]).filter((v) => typeof v === 'number');
      p.average = coreVals.length
        ? Math.round((coreVals.reduce((a, b) => a + b, 0) / coreVals.length) * 10) / 10
        : null;
      p.completedCount = coreVals.filter((v) => v >= 10).length;
      p.diplomaEarned = p.completedCount === TP_CATALOG.length;
      gameState.setProfile(p);
      lab.updateStationBadges(p.grades);

      network.submitScore(gameState.profile.name, doneId, score, durationSec, gameState.skin);
      setTimeout(() => refreshWallLeaderboard(), 420);
      if (!getTpById(doneId)) {
        hud.toast(`${tp.icon} Atelier ${tp.shortTitle} validé (${score.toFixed(1)}/20) !`, score >= 10 ? 'success' : 'info');
      }
    },
    onClose: ({ replayTpId } = {}) => {
      if (replayTpId) {
        openTp(replayTpId, null);
        return;
      }
      network.sendActivity('Dans l’atelier');
      voiceChat.setInTp(false);
      setModalActive(false, false, false);
      if (!vrManager?.isVrActive?.()) {
        player._applyCamera?.();
      }
    }
  });
}

function openTeacherDialogue(customDialogue = '') {
  sfx.interact();
  network.sendActivity('Parle au Professeur CIEL');
  setModalActive(true, false, true);
  dialogueModal.open(gameState, {
    customDialogue,
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
  const spot = getStationTeleportInMap(currentMapData, id);
  if (!spot) return;
  player.teleportTo(spot.pos, spot.lookAt);
  if (vrManager?.isVrActive?.()) {
    vrManager._mountVrRigForWorld?.(vrManager.simMode);
  }
  const zone = getZoneAtPositionInMap(currentMapData, player.position.x, player.position.z);
  hud?.setCurrentZone?.(zone);
  network.sendMove(
    player.position.x,
    0,
    player.position.z,
    player.yaw,
    true,
    vrManager?.isVrActive?.() ? vrManager.getVrSyncPayload() : undefined
  );
  network.sendZone(zone.id, zone.badgeText.replace('📍 ', ''));
  if (id === 'teacher') {
    hud.toast('Devant le Professeur CIEL — Appuyez sur E pour lui parler');
    return;
  }
  const st = getStationById(id);
  if (st) {
    hud.toast(`${st.icon} ${spot.label || st.shortTitle} — Appuyez sur E pour commencer`);
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
    platformModal.open(
      gameState.touchMode,
      () => setModalActive(false, false, false),
      true,
      Boolean(vrManager?.isVrActive?.())
    );
  },
  onToggleVr: () => {
    vrManager?.toggleVr?.();
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
  onVoiceToggle: () => {
    voiceChat.toggleMicrophone();
  },
  onVoiceModeChange: (mode) => {
    voiceChat.setMode(mode);
  },
  onVoiceTpModeChange: (behavior) => {
    voiceChat.setTpBehavior(behavior);
  },
  onVoiceVolumeChange: (vol) => {
    voiceChat.setVolume(vol);
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
    },
    getVoiceMode: () => gameState.voiceMode,
    onVoiceToggle: () => {
      if (joined) voiceChat.toggleMicrophone();
    },
    onVoicePttStart: () => {
      if (joined) voiceChat.startPushToTalk();
    },
    onVoicePttEnd: () => {
      voiceChat.stopPushToTalk();
    }
  });
  touchControls.syncCameraMode(gameState.cameraMode);
  voiceChat._emitState();
  hud?.syncVrUi?.(vrManager?.getPublicState?.());
} catch (err) {
  console.warn('Contrôles tactiles indisponibles:', err);
}

function returnToMainMenu() {
  if (vrManager?.isVrActive?.()) {
    vrManager.exitVr();
  }
  joined = false;
  modalOpen = false;
  subModalActive = false;
  voiceChat.setInTp(false);
  voiceChat.disconnect();
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
  voiceChat.onRoomJoined(msg.peers || []);
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

network.on('map_updated', ({ map }) => {
  if (!map) return;
  applyMapData(map, true);
  hud?.toast?.('🗺️ Carte mise à jour en direct par l’administrateur !', 'success');
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
  voiceChat.onPeerJoined(p);
  if (roomRoster) gameState.setRoomRoster(roomRoster);
  hud.setNetworkStatus(true, onlineCount);
  refreshWallLeaderboard();
  hud.toast(`${p.name} a rejoint l’atelier !`);
});

network.on('player_moved', ({ id, x, y, z, yaw, vrData }) => {
  remotePlayers.movePeer(id, x, y, z, yaw, vrData);
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
  voiceChat.removePeer(id);
  if (roomRoster) gameState.setRoomRoster(roomRoster);
  hud.setNetworkStatus(true, onlineCount);
  refreshWallLeaderboard();
  if (name) hud.toast(`${name} a quitté la salle.`);
});

network.on('voice_state', (msg) => {
  remotePlayers.setVoiceState(msg.id, msg);
  voiceChat.onPeerVoiceState(msg);
});

network.on('rtc_offer', (msg) => {
  voiceChat.handleOffer(msg);
});

network.on('rtc_answer', (msg) => {
  voiceChat.handleAnswer(msg);
});

network.on('rtc_ice_candidate', (msg) => {
  voiceChat.handleIceCandidate(msg);
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
  if (target.id === 'teacher') openTeacherDialogue(target.dialogue || '');
  else openTp(target.id, target);
}

window.addEventListener('keydown', (e) => {
  const isTyping =
    e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);

  if (e.code === 'F9' && !e.repeat) {
    e.preventDefault();
    if (!joined) return;
    vrManager?.toggleVr?.();
    return;
  }

  if (joined && !isTyping && vrManager?.isVrActive?.() && vrManager.simMode) {
    vrManager.setSimKey(e.code, true);
    if (e.code === 'KeyH' && !e.repeat) {
      e.preventDefault();
      vrManager.toggleWristWatchSim();
      return;
    }
    if (e.code === 'KeyF') {
      vrManager.setSimInput({ grip: 1 });
    }
    if (e.code === 'KeyG') {
      vrManager.setSimInput({ thumb: 1 });
    }
  }

  if (e.code === 'Escape' && !subModalActive) {
    if (
      battlePassModal?.closeTrollModal?.() ||
      battlePassModal?.close?.() ||
      changelogModal?.close?.() ||
      faqModal?.close?.() ||
      platformModal?.close?.() ||
      mainMenu?.closeRoomsModal?.() ||
      hud?.closeLeaderboard?.() ||
      hud?.closeSettings?.()
    ) {
      e.preventDefault();
      return;
    }
    if (joined && hud?.closeSkinModal?.()) {
      e.preventDefault();
      return;
    }
  }

  if (e.code === 'Tab' && joined && !subModalActive && !isTyping) {
    if (
      !hud.isSettingsOpen() &&
      !hud.isSkinOpen() &&
      !battlePassModal?.isOpen?.() &&
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

  if (joined && !isTyping && e.code === 'KeyV' && !e.repeat && !hud.isSettingsOpen() && !hud.isSkinOpen()) {
    e.preventDefault();
    if (gameState.voiceMode === 'ptt') {
      voiceChat.startPushToTalk();
    } else {
      voiceChat.toggleMicrophone();
    }
    return;
  }

  if (!joined || modalOpen || isTyping) return;

  if (e.code === 'KeyE' && nearestTarget) {
    e.preventDefault();
    interactWith(nearestTarget);
  } else if (e.code === 'KeyC') {
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

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyV' && gameState.voiceMode === 'ptt') {
    voiceChat.stopPushToTalk();
  }
  if (vrManager?.simMode) {
    vrManager.setSimKey(e.code, false);
    if (e.code === 'KeyF') vrManager.setSimInput({ grip: 0 });
    if (e.code === 'KeyG') vrManager.setSimInput({ thumb: 0 });
  }
});

window.addEventListener('blur', () => {
  voiceChat.stopPushToTalk();
  vrManager?.setSimInput?.({ trigger: 0, grip: 0, thumb: 0, mouseTrigger: false });
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
  for (const item of lab.interactables) {
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
  if (vrManager?.isVrActive?.() && vrManager.simMode && e.button === 0) {
    vrManager.setSimInput({ mouseTrigger: true });
  }
});
canvas.addEventListener('contextmenu', (e) => {
  if (vrManager?.isVrActive?.() && vrManager.simMode) {
    e.preventDefault();
  }
});
window.addEventListener('mousemove', (e) => {
  if (!vrManager?.isVrActive?.() || !vrManager.simMode) return;
  if (document.pointerLockElement === canvas || (e.buttons & 2) !== 0) {
    vrManager.setSimInput({ lookDx: e.movementX, lookDy: e.movementY });
  }
});
window.addEventListener('mouseup', (e) => {
  if (vrManager?.simMode && e.button === 0) {
    vrManager.setSimInput({ mouseTrigger: false });
  }
});
canvas.addEventListener('mouseup', (e) => {
  if (!joined || modalOpen || e.button !== 0 || gameState.touchMode) return;
  if (vrManager?.isVrActive?.() && vrManager.simMode) return;
  const dragDist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
  if (dragDist > 6) return;

  if (tryRaycastInteract(e.clientX, e.clientY)) return;

  player.requestPointerLock();
});

let lastZoneId = '';
let lastMiniMapDrawAt = 0;

sceneMgr.addUpdater((dt, elapsed) => {
  lab.update(elapsed, joined ? player.position : null, gameState.profile.diplomaEarned);
  remotePlayers.update(dt, elapsed);
  updateSpeechBubble(localBubble, dt);

  if (!joined) {
    if (!vrManager?.isVrActive?.()) {
      const angle = elapsed * 0.14;
      const sp = currentMapData?.spawn || { x: -2.0, z: -0.5 };
      const farSpawn = Math.abs(sp.x) > 15 || Math.abs(sp.z) > 15;
      const lookX = farSpawn ? sp.x : -2.0;
      const lookZ = farSpawn ? sp.z : -0.5;
      sceneMgr.camera.position.set(lookX - 2.5 + Math.sin(angle) * 6.5, 4.2, lookZ + 0.5 + Math.cos(angle) * 6.5);
      sceneMgr.camera.lookAt(lookX, 1.4, lookZ);
    }
    return;
  }

  const vrOn = Boolean(vrManager?.isVrActive?.());
  const step = vrOn ? null : player.update(dt);
  updateVoiceIndicatorSprite(localVoiceIndicator, dt, voiceChat.isSpeaking);
  voiceChat.update(player.position, player.yaw, remotePlayers.peers);
  const currentZone = getZoneAtPositionInMap(currentMapData, player.position.x, player.position.z);
  if (currentZone.id !== lastZoneId) {
    lastZoneId = currentZone.id;
    hud?.setCurrentZone?.(currentZone);
    network.sendZone(currentZone.id, currentZone.badgeText.replace('📍 ', ''));
  }

  if (vrOn) {
    vrManager.updateHudInfo({
      name: gameState.profile.name,
      zoneLabel: currentZone.badgeText,
      average: gameState.profile.average,
      xp: gameState.profile.xp,
      micEnabled: Boolean(latestVoiceState.micEnabled),
      isSpeaking: Boolean(latestVoiceState.isSpeaking)
    });
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
    const jumpY = vrOn ? 0 : Math.max(0, player.position.y - player.groundY);
    network.sendMove(
      player.position.x,
      jumpY,
      player.position.z,
      player.yaw,
      Boolean(step?.landed),
      vrOn ? vrManager.getVrSyncPayload() : undefined
    );

    let best = null;
    let bestDist = Infinity;
    for (const item of lab.interactables) {
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
fetchInitialMap();
refreshWallLeaderboard();

setInterval(() => {
  if (joined && !subModalActive) {
    refreshWallLeaderboard();
  }
}, 12000);

setInterval(() => {
  if (joined && subModalActive) {
    voiceChat.update(player.position, player.yaw, remotePlayers.peers);
  }
}, 180);

function startGameSession({ name, room, skin }, startVr = false) {
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
  hud?.miniMap?.setMapData?.(currentMapData);
  hud?.setMapData?.(currentMapData);
  const pose = getSpawnPose(currentMapData);
  player.teleportTo(pose.pos, pose.lookAt);
  const startZone = getZoneAtPositionInMap(currentMapData, pose.pos.x, pose.pos.z);
  lastZoneId = startZone.id;
  hud?.setCurrentZone?.(startZone);
  network.connect(name, cleanRoom, skin, {
    x: pose.pos.x,
    y: 0,
    z: pose.pos.z,
    yaw: player.yaw,
    zoneId: startZone.id,
    zoneLabel: startZone.badgeText.replace('📍 ', '')
  });
  refreshWallLeaderboard();

  if (startVr) {
    vrManager?.enterVr?.();
  } else {
    setTimeout(() => {
      hud?.toast?.(
        gameState.touchMode
          ? 'Bienvenue sur le Plateau U300 ! Touchez Parler devant le Professeur CIEL.'
          : 'Bienvenue sur le Plateau U300 ! Appuyez sur E devant le Professeur CIEL.'
      );
    }, 500);
  }
}

mainMenu = new MainMenu(gameState, network, {
  onOpenSettings: () => hud?.openSettingsModal?.(),
  onOpenPlatform: () => platformModal?.open?.(gameState.touchMode, null, true, Boolean(vrManager?.isVrActive?.())),
  onOpenFaq: () => faqModal?.open?.('list'),
  onOpenChangelog: () => changelogModal?.open?.(),
  onOpenBattlePass: () => battlePassModal?.open?.(),
  onOpenLeaderboard: () => hud?.openLeaderboard?.(),
  onStartGame: (params) => startGameSession(params, false),
  onStartVr: (params) => startGameSession(params, true)
});

try {
  platformModal = new PlatformModal({
    onSelect: (mode) => {
      sfx.click();
      if (mode === 'vr') {
        gameState.setTouchMode(false);
        player.setTouchMode(false);
        hud?.syncTouchUi?.();
        mainMenu?.updatePlatformButton?.(false);
        if (joined) {
          vrManager?.enterVr?.();
        } else {
          hud?.toast?.('🥽 Mode VR sélectionné : cliquez sur « MODE VR (QUEST / WEBXR) » pour démarrer !', 'success');
        }
        return;
      }
      if (vrManager?.isVrActive?.()) {
        vrManager.exitVr();
      }
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
  platformModal.open(gameState.touchMode, null, false, Boolean(vrManager?.isVrActive?.()));
} catch (err) {
  console.warn('Sélecteur de plateforme indisponible:', err);
}
