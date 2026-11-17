import './styles/main.css';
import './styles/minigames.css';

import * as THREE from 'three';
import { sfx } from './core/audio.js';
import { getBattlePassSkinId } from './core/battlePassSkins.js';
import {
  GameState,
  getAllTps,
  getTpById,
  getStationById,
  hasAllDivineSpecialties,
  hasAllTpsAt20,
  QUICK_EMOTES,
  TP_CATALOG
} from './core/gameState.js';
import { NetworkClient } from './core/network.js';
import { SceneManager, computeAscensionGatheringLayout, pickLabInteractable } from './world/SceneManager.js';
import {
  createDefaultMap,
  getStationTeleportInMap,
  getZoneAtPositionInMap,
  normalizeMapData
} from './world/mapSchema.js';
import { buildLabWorld } from './world/LabBuilder.js';
import { createHorrorTeacher } from './world/NpcTeacher.js';
import { computeSurvivalIntroShot, createSurvivalPocketRooms } from './world/SurvivalArena3D.js';
import { SURVIVAL_MIN_PLAYERS } from './world/SurvivalEngine.js';
import { PlayerController } from './world/PlayerController.js';
import {
  createSpeechBubble,
  RemotePlayersManager,
  showSpeechBubble,
  updateSpeechBubble
} from './world/RemotePlayers.js';
import {
  applySessionDivineSkin,
  ASCENSION_SPECIALTIES,
  buildStudentAvatarMesh,
  createVoiceIndicatorSprite,
  disposeObject3D,
  isCreatorLouis,
  resolveAscensionSpecialty,
  ULTIMATE_SECRET_SKIN_ID,
  updateVoiceIndicatorSprite
} from './world/AvatarBuilder.js';
import { ProximityVoiceChat } from './network/ProximityVoiceChat.js';
import { VRManager } from './vr/VRManager.js';
import {
  HudManager,
  formatAscensionBanner,
  formatSecretSkinAnnouncement,
  formatWorldCelebrationBanner
} from './ui/HudManager.js';
import { MainMenu } from './ui/MainMenu.js';
import { DialogueModal } from './ui/DialogueModal.js';
import { ChangelogModal } from './ui/ChangelogModal.js';
import { TouchControls } from './ui/TouchControls.js';
import { PlatformModal } from './ui/PlatformModal.js';
import { FaqModal } from './ui/FaqModal.js';
import { BattlePassModal } from './ui/BattlePassModal.js';
import { MiniGameModal } from './minigames/MiniGameModal.js';
import { VariationTableSession } from './minigames/VariationTableGame.js';
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

function getDynamicAllTps() {
  return getAllTps().filter((item) => Boolean(MINIGAME_FACTORIES[item.id]));
}

const extraStationGrades = {};

const gameState = new GameState();
const network = new NetworkClient();

const canvas = document.getElementById('game-canvas');
const sceneMgr = new SceneManager(canvas);
sceneMgr.setQuality(gameState.quality);
sceneMgr.setFov(gameState.fov);

let currentMapData = createDefaultMap();
const lab = buildLabWorld(sceneMgr.scene, currentMapData, { maxAnisotropy: sceneMgr.getMaxAnisotropy() });
const survivalArena = createSurvivalPocketRooms(sceneMgr.scene, currentMapData);
const horrorTeacher = createHorrorTeacher(sceneMgr.scene, { visible: false });
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
let sessionDivineSpecialty = null;
let activeCinematic = null;

function getSelectedSkinIdFromSkin(skin = gameState.skin) {
  if (skin?.secretSkin) return ULTIMATE_SECRET_SKIN_ID;
  if (skin?.divineSpecialty) return skin.divineSpecialty;
  if (skin?.battlePassTier) return getBattlePassSkinId(skin.battlePassTier);
  return 'standard';
}

function getEffectiveSessionSkin(baseSkin = gameState.skin) {
  if (sessionDivineSpecialty) {
    return applySessionDivineSkin(baseSkin, sessionDivineSpecialty);
  }
  return baseSkin;
}

function rebuildLocalAvatar(skin) {
  const effectiveSkin = getEffectiveSessionSkin(skin);
  if (localAvatar?.group) {
    localAvatar.group.remove(localBubble);
    localAvatar.group.remove(localVoiceIndicator);
    sceneMgr.scene.remove(localAvatar.group);
    disposeObject3D(localAvatar.group, new Set([localBubble, localVoiceIndicator]));
  }
  localAvatar = buildStudentAvatarMesh(effectiveSkin);
  localAvatar.group.add(localBubble);
  localAvatar.group.add(localVoiceIndicator);
  localAvatar.setFirstPersonVrHidden?.(Boolean(vrManager?.isVrActive?.()));
  sceneMgr.scene.add(localAvatar.group);
  player.setAvatar(localAvatar);
  vrManager?.setSkin?.(effectiveSkin);
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
  inputDeviceId: gameState.audioInputId,
  outputDeviceId: gameState.audioOutputId,
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
sfx.setOutputDevice?.(gameState.audioOutputId);

vrManager = new VRManager(sceneMgr, player, {
  skin: gameState.skin,
  playerName: gameState.profile?.name || 'Eleve_CIEL',
  mapData: currentMapData,
  getInteractables: () => getActiveInteractables(),
  getWorldInteractiveSurfaces: () => getActiveWorldSurfaces(),
  getOccluders: () => lab.solidWallMeshes,
  getNearestInteractable: () => nearestTarget,
  onHoverInteractable: (item) => lab.setHoveredInteractable?.(item),
  onInteract: (item) => interactWith(item),
  onToggleMic: () => voiceChat.toggleMicrophone(),
  onEnterVr: () => {
    activeCameraTweenId++;
    mainMenu?.hide?.();
    mainMenu?.preview?.setActive?.(false);
    hud?.skinPreview?.setActive?.(false);
    platformModal?.close?.();
    changelogModal?.close?.();
    faqModal?.close?.();
    battlePassModal?.close?.();
    dialogueModal?.close?.();
    hud?.hideIntroCinematic?.();
    hud?.hideAscensionDialogue?.();
    hud?.closeAllModals?.();
    hud?.hideSurvivalLobby?.();
    hud?.hideSurvivalIntroOverlay?.();
    hud?.hideHidingOverlay?.();
    hud?.hideJumpscareOverlay?.();
    hud?.hideDetentionModal?.();
    hud?.hideDetention3dHud?.();
    hud?.hideSurvivalEndOverlay?.();
    if (miniGameModal?.backdrop && !miniGameModal.backdrop.classList.contains('hidden')) {
      miniGameModal.close();
    }
    if (typeof document !== 'undefined' && document.body?.classList) {
      document.body.classList.add('vr-presenting');
    }
    setModalActive(false, false, false);
    player.setVrMode?.(true);
    localAvatar?.setFirstPersonVrHidden?.(true);
    player.setAvatarVisible(true);
    player.setEnabled(false);
    touchControls?.setVisible(false);
    vrManager.setSkin(getEffectiveSessionSkin(gameState.skin));
    vrManager.setMapData(currentMapData);
    syncSurvivalPanelMode();
    if (survivalState.detained || survivalState.inDefeatDetention) {
      const detCfg = survivalArena.getDetentionRoomConfig();
      vrManager.syncWorldTeleport?.(detCfg.spawn.x, detCfg.spawn.z, 0);
    }
    if (joined) {
      network.sendMove(player.position.x, 0, player.position.z, player.yaw, true, vrManager.getVrSyncPayload());
    }
  },
  onExitVr: () => {
    if (typeof document !== 'undefined' && document.body?.classList) {
      document.body.classList.remove('vr-presenting');
    }
    if (miniGameModal?.backdrop && !miniGameModal.backdrop.classList.contains('hidden')) {
      miniGameModal.close();
    }
    player.setVrMode?.(false);
    localAvatar?.setFirstPersonVrHidden?.(false);
    const seatedDet = isDetentionSeatedActive();
    player.setEnabled(joined && !modalOpen && !seatedDet);
    if (seatedDet) {
      applyDetentionPcCamera();
      hud?.showDetention3dHud?.(survivalState.activeCameraInfo || {});
    } else {
      player._applyCamera?.();
    }
    touchControls?.setVisible(joined && !modalOpen && !seatedDet && gameState.touchMode);
    syncSurvivalPanelMode();
    if (joined) {
      network.sendMove(player.position.x, 0, player.position.z, player.yaw, true, { active: false });
    }
  },
  onStateChange: (st) => hud?.syncVrUi?.(st),
  onToast: (msg, type) => hud?.toast?.(msg, type)
});
sceneMgr.addBeforeRender((dt, elapsed) => {
  if (joined) {
    renderDetentionLivePov(dt, elapsed);
  }
});
sceneMgr.addAlwaysUpdater((dt, elapsed) => {
  if (!joined || sceneMgr.paused) {
    if (joined && sceneMgr.paused) {
      syncVrWatchHud();
    }
    vrManager?.update(dt, elapsed);
  }
  if (joined) {
    updateSurvivalLoop(dt, elapsed);
  }
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
    getUnlockedTiers: () => gameState.unlockedBattlePassTiers || [],
    getSelectedSkin: () => gameState.selectedSkin || getSelectedSkinIdFromSkin(gameState.skin),
    onEquipTier: (choice) => {
      const targetSkin = choice === 'standard' ? null : getBattlePassSkinId(choice);
      gameState.equipBattlePassSkin(targetSkin);
      const updatedSkin = gameState.skin;
      const selectedId = getSelectedSkinIdFromSkin(updatedSkin);
      sessionDivineSpecialty = updatedSkin?.secretSkin
        ? ULTIMATE_SECRET_SKIN_ID
        : updatedSkin?.divineSpecialty || null;
      rebuildLocalAvatar(updatedSkin);
      mainMenu?.renderSkinUi?.();
      mainMenu?.preview?.rebuild?.();
      hud?._refreshInGameSkinUi?.();
      network.sendSkinUpdate(updatedSkin);
      if (gameState.isAuthenticated()) {
        network.saveAccount({
          selectedSkin: selectedId,
          avatarCustomization: updatedSkin,
          unlockedDivineSkins: gameState.unlockedDivineSkins
        });
      }
      hud?.toast?.(
        choice === 'standard'
          ? '👕 Tenue Standard équipée.'
          : `🔑 Skin Passe VIP Palier ${choice} équipé !`,
        choice === 'standard' ? 'info' : 'success'
      );
    },
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
let privateDebugMode = false;
let lastCelebrationAt = 0;
let vrAscCountdownTimer = null;

function buildVrAscCollection(unlockedList = gameState.unlockedDivineSkins) {
  const unlockedSet = new Set(Array.isArray(unlockedList) ? unlockedList : []);
  return ASCENSION_SPECIALTIES.map((s) => ({
    id: s.id,
    label: s.shortLabel || s.label,
    unlocked: unlockedSet.has(s.id)
  }));
}

function clearVrAscCountdown() {
  if (vrAscCountdownTimer) {
    clearInterval(vrAscCountdownTimer);
    vrAscCountdownTimer = null;
  }
}

const survivalState = {
  phase: 'idle',
  inWaitingRoom: false,
  inActiveMatch: false,
  introActive: false,
  introStartedAt: 0,
  introDurationMs: 5600,
  introAiPos: { x: 1.8, z: -1.2, yaw: -Math.PI / 2 },
  detained: false,
  inDefeatDetention: false,
  hiddenRack: null,
  hiddenSpot: null,
  snapshot: null,
  lobbyModalOpen: false,
  detentionModalOpen: false,
  detentionMinimized: false,
  detentionCamIndex: 0,
  detentionLookYaw: 0,
  detentionLookPitch: 0,
  detentionDraggingLook: false,
  detentionDragLast: { x: 0, y: 0 },
  savedCameraMode: null,
  lastPovRenderAt: 0,
  activeCameraInfo: null,
  jumpscareUntil: 0,
  jumpscareTimer: null,
  endTimer: null,
  variationSession: null,
  announcedTps: new Set(),
  lastStepSoundAt: 0,
  lastHeartbeatAt: 0,
  lastMicSentAt: 0,
  noiseLevel: 0,
  aiPrevState: 'patrol'
};

function isSurvivalInstanceRoom(roomId = gameState.room) {
  return String(roomId || '').trim().toLowerCase().startsWith('survival-game-');
}

function isDetentionSeatedActive() {
  return Boolean(
    (survivalState.detained || survivalState.inDefeatDetention) &&
      survivalState.jumpscareUntil <= Date.now()
  );
}

function applyRoomInstanceFilter(roomId = gameState.room, snap = survivalState.snapshot) {
  if (survivalState.inActiveMatch && Array.isArray(snap?.participants)) {
    const allowedIds = snap.participants.map((p) => p.id).filter(Boolean);
    remotePlayers.setInstanceFilter(allowedIds);
    return;
  }
  if (!isSurvivalInstanceRoom(roomId)) {
    remotePlayers.setInstanceFilter(null);
  }
}

function getActiveInteractables() {
  if (survivalState.detained || survivalState.inDefeatDetention || survivalState.introActive) {
    return [];
  }
  if (survivalState.inWaitingRoom && !survivalState.inActiveMatch) {
    return survivalArena.getWaitingRoomConfig().interactables;
  }
  if (survivalState.hiddenRack) {
    return [];
  }
  return lab.interactables;
}

function getActiveWorldSurfaces() {
  if (!isDetentionSeatedActive()) return [];
  return survivalArena.getDetentionInteractiveSurfaces({
    onSelectOption: (idx) => submitDetentionOption(idx),
    onPrevCamera: () => cycleDetentionCamera(-1),
    onNextCamera: () => cycleDetentionCamera(1)
  });
}

function applyDetentionPcCamera() {
  if (vrManager?.isVrActive?.()) return;
  const cfg = survivalArena.getDetentionRoomConfig();
  const eye = cfg.pcEye || { x: cfg.spawn.x, y: 1.38, z: cfg.spawn.z + 0.3 };
  const baseLook = cfg.lookAt || { x: cfg.spawn.x, y: 1.04, z: cfg.spawn.z - 1.2 };
  sceneMgr.camera.position.set(eye.x, eye.y, eye.z);
  const baseDx = baseLook.x - eye.x;
  const baseDy = baseLook.y - eye.y;
  const baseDz = baseLook.z - eye.z;
  const baseDist = Math.max(0.5, Math.hypot(baseDx, baseDz));
  const baseYaw = Math.atan2(-baseDx, -baseDz);
  const basePitch = Math.atan2(baseDy, baseDist);
  sceneMgr.camera.rotation.order = 'YXZ';
  sceneMgr.camera.rotation.set(
    Math.max(-0.62, Math.min(0.45, basePitch + survivalState.detentionLookPitch)),
    baseYaw + survivalState.detentionLookYaw,
    0,
    'YXZ'
  );
}

function teleportWithWorldMode(pos, lookAt, mode = 'hall') {
  if (mode === 'waiting') {
    const cfg = survivalArena.getWaitingRoomConfig();
    player.setColliders(cfg.colliders);
    player.setBounds(cfg.bounds);
    player.teleportTo(cfg.spawn, cfg.lookAt);
    vrManager?.syncWorldTeleport?.(cfg.spawn.x, cfg.spawn.z, player.yaw);
    return;
  }
  if (mode === 'detention') {
    const cfg = survivalArena.getDetentionRoomConfig();
    player.setColliders(cfg.colliders);
    player.setBounds(cfg.bounds);
    player.teleportTo(cfg.spawn, cfg.lookAt);
    vrManager?.syncWorldTeleport?.(cfg.spawn.x, cfg.spawn.z, 0);
    if (!vrManager?.isVrActive?.()) {
      applyDetentionPcCamera();
    }
    return;
  }
  player.setColliders(lab.colliders);
  player.setBounds(currentMapData.bounds);
  const pose = pos ? { pos, lookAt: lookAt || { x: pos.x, z: pos.z - 4 } } : getSpawnPose(currentMapData);
  player.teleportTo(pose.pos, pose.lookAt);
  vrManager?.syncWorldTeleport?.(pose.pos.x, pose.pos.z, player.yaw);
}

function getLocalSurvivalParticipant(snap = survivalState.snapshot) {
  if (!snap || !network.clientId) return null;
  const parts = Array.isArray(snap.participants) ? snap.participants : [];
  return parts.find((p) => p.id === network.clientId) || null;
}

function buildVrLobbyState(snap = survivalState.snapshot) {
  const players = Array.isArray(snap?.lobbyPlayers) ? snap.lobbyPlayers : [];
  const minP = Math.max(SURVIVAL_MIN_PLAYERS, Number(snap?.minPlayers) || SURVIVAL_MIN_PLAYERS);
  const readyCount = players.filter((p) => p.ready).length;
  const me = players.find((p) => p.id === network.clientId);
  return {
    players,
    minPlayers: minP,
    readyCount,
    playerCount: players.length,
    localReady: Boolean(me?.ready),
    micEnabled: Boolean(latestVoiceState.micEnabled),
    statusText:
      players.length < minP
        ? `Instance Survie : ${players.length}/${minP} joueur minimum pour démarrer`
        : `${readyCount}/${players.length} joueur(s) prêt(s) — lancement imminent`,
    onToggleReady: () => toggleSurvivalReady(),
    onToggleMic: () => voiceChat.toggleMicrophone(),
    onLeave: () => leaveSurvivalLobby()
  };
}

function buildVrIntroState(progress = 0, phaseLabel = '⚡ COUPURE ÉLECTRIQUE — ALERTE INTRUSION') {
  return {
    phaseLabel,
    briefingText: 'Survivez, terminez tous les TPs et ne faites aucun bruit au micro...',
    progress,
    onSkip: () => finishSurvivalIntroCinematic()
  };
}

function buildVrHiddenState(snap = survivalState.snapshot) {
  const aiState = snap?.ai?.state || 'patrol';
  const aiStateLabel =
    aiState === 'chase' ? '🚨 POURSUITE' : aiState === 'investigate' ? '👂 Recherche bruit' : '👣 Patrouille';
  return {
    rackLabel: survivalState.hiddenRack?.label || 'Baie de Brassage (Cachette)',
    micEnabled: Boolean(latestVoiceState.micEnabled),
    noiseLevel: survivalState.noiseLevel || 0,
    aiState,
    aiStateLabel,
    completedTps: snap?.completedTps?.length || 0,
    totalTps: snap?.requiredTps?.length || TP_CATALOG.length,
    alertText:
      (survivalState.noiseLevel || 0) >= 0.28
        ? '⚠️ Trop de bruit au micro ! Coupez votre micro !'
        : '🤫 Silence maintenu — le Professeur CIEL ne vous voit pas.',
    onToggleMic: () => voiceChat.toggleMicrophone(),
    onExitRack: () => toggleHidingInRack(survivalState.hiddenRack)
  };
}

function getDetentionCameraTargets(snap = survivalState.snapshot) {
  const parts = Array.isArray(snap?.participants) ? snap.participants : [];
  const aliveTeammates = parts.filter((p) => p.id !== network.clientId && p.status === 'alive');
  if (aliveTeammates.length > 0) {
    return aliveTeammates.map((p) => ({
      kind: 'peer',
      id: p.id,
      name: p.name || 'Coéquipier',
      participant: p
    }));
  }
  return [
    { kind: 'ai_patrol', id: 'ai_patrol', name: 'Professeur CIEL (Patrouille)' },
    { kind: 'cctv_u300', id: 'cctv_u300', name: 'Caméra Surveillance Atelier U300' }
  ];
}

function buildDetentionCameraInfo(snap = survivalState.snapshot) {
  const targets = getDetentionCameraTargets(snap);
  const idx = ((survivalState.detentionCamIndex % targets.length) + targets.length) % targets.length;
  const target = targets[idx];
  const completedTps = snap?.completedTps?.length || 0;
  const totalTps = snap?.requiredTps?.length || TP_CATALOG.length;
  const aliveCount = snap?.aliveCount ?? 0;

  if (target.kind === 'peer') {
    const p = target.participant;
    const peerPose = remotePlayers.getPeerPoseForPov(target.id);
    const zoneLabel = peerPose?.zoneLabel || 'Atelier U300';
    const act = peerPose?.activity || 'Dans l’atelier';
    const status = p.hiddenRackId
      ? `🟡 CACHÉ EN BAIE • ${zoneLabel}`
      : act && act !== 'Dans l’atelier'
        ? `🔧 ${act} • ${zoneLabel}`
        : `🟢 EN VIE • ${zoneLabel}`;
    return {
      target,
      label: target.name,
      status,
      camIndex: idx,
      camCount: targets.length,
      completedTps,
      totalTps,
      aliveCount
    };
  }

  if (target.kind === 'ai_patrol') {
    const aiSt = snap?.ai?.state || 'patrol';
    const stText =
      aiSt === 'chase'
        ? '🚨 POURSUITE ACTIVE'
        : aiSt === 'investigate'
          ? '👂 ENQUÊTE BRUIT'
          : '👁️ PATROUILLE U300';
    return {
      target,
      label: 'Professeur CIEL',
      status: `${stText} • ${snap?.ai?.zoneCode || 'U300'}`,
      camIndex: idx,
      camCount: targets.length,
      completedTps,
      totalTps,
      aliveCount
    };
  }

  return {
    target,
    label: 'Caméra Hall U300',
    status: '📹 BALAYAGE AUTO ATELIER',
    camIndex: idx,
    camCount: targets.length,
    completedTps,
    totalTps,
    aliveCount
  };
}

function cycleDetentionCamera(delta = 1) {
  const targets = getDetentionCameraTargets(survivalState.snapshot);
  if (targets.length === 0) return;
  survivalState.detentionCamIndex =
    (((survivalState.detentionCamIndex + delta) % targets.length) + targets.length) % targets.length;
  sfx.click();
  const info = buildDetentionCameraInfo(survivalState.snapshot);
  survivalState.activeCameraInfo = info;
  survivalArena.updateDetentionCameraBar(info, true);
  if (!vrManager?.isVrActive?.()) {
    hud?.showDetention3dHud?.(info);
  }
}

const _povLookTmp = new THREE.Vector3();
const _povDirTmp = new THREE.Vector3();
const _povQuatTmp = new THREE.Quaternion();

function renderDetentionLivePov(_dt, elapsed) {
  if (!isDetentionSeatedActive()) return;
  if (!survivalArena?.povCamera) return;
  survivalArena.updateDetentionClock?.(elapsed);
  if (elapsed - survivalState.lastPovRenderAt < 0.032) return;
  survivalState.lastPovRenderAt = elapsed;

  const snap = survivalState.snapshot;
  const info = buildDetentionCameraInfo(snap);
  survivalState.activeCameraInfo = info;
  survivalArena.updateDetentionCameraBar(info, false);
  if (!vrManager?.isVrActive?.() && !survivalState.inDefeatDetention) {
    hud?.showDetention3dHud?.(info);
  }

  if (!survivalArena.povRenderTarget) {
    survivalArena.setLivePovActive(false);
    survivalArena.updateSurveillanceScreen(snap || {});
    return;
  }
  survivalArena.setLivePovActive(true);

  const povCam = survivalArena.povCamera;
  const hiddenObjects = [];
  if (localAvatar?.group) hiddenObjects.push(localAvatar.group);
  if (vrManager?.vrRig) hiddenObjects.push(vrManager.vrRig);

  let povPeerHiddenId = null;
  let ambientBoost = 0.24;
  let flashColor = '#e2f1ff';
  let flashIntensity = 3.5;

  const target = info.target;
  if (target.kind === 'peer') {
    const p = target.participant;
    const peerPose = remotePlayers.getPeerPoseForPov(target.id);
    povPeerHiddenId = target.id;
    remotePlayers.setPeerPovHidden(povPeerHiddenId, true);

    if (p.hiddenRackId) {
      const rack = (lab.hidingSpots || []).find((s) => s.id === p.hiddenRackId);
      if (rack) {
        const fx = Math.sin(rack.rad);
        const fz = Math.cos(rack.rad);
        const camX = rack.x + fx * ((rack.d || 0.78) * 0.5 + 0.14);
        const camZ = rack.z + fz * ((rack.d || 0.78) * 0.5 + 0.14);
        povCam.position.set(camX, 1.44, camZ);
        povCam.lookAt(camX + fx * 6, 1.32, camZ + fz * 6);
      } else {
        const px = peerPose ? peerPose.position.x : p.x || 0;
        const pz = peerPose ? peerPose.position.z : p.z || 0;
        povCam.position.set(px, 1.48, pz);
        povCam.rotation.set(-0.06, p.yaw || 0, 0, 'YXZ');
      }
    } else if (peerPose?.vrData?.active && peerPose.vrData.head) {
      const h = peerPose.vrData.head;
      povCam.position.set(
        peerPose.position.x + (Number(h.px) || 0),
        Math.max(0.7, Number(h.py) || 1.62),
        peerPose.position.z + (Number(h.pz) || 0)
      );
      _povQuatTmp.set(h.qx || 0, h.qy || 0, h.qz || 0, h.qw ?? 1);
      povCam.quaternion.copy(_povQuatTmp);
    } else {
      const px = peerPose ? peerPose.position.x : Number(p.x) || 0;
      const py = peerPose ? peerPose.position.y : 0;
      const pz = peerPose ? peerPose.position.z : Number(p.z) || 0;
      const yaw = peerPose ? peerPose.yaw : Number(p.yaw) || 0;
      povCam.position.set(px, py + 1.62, pz);
      povCam.rotation.order = 'YXZ';
      povCam.rotation.set(-0.06, yaw, 0, 'YXZ');
    }
  } else if (target.kind === 'ai_patrol') {
    const aiPose = snap?.ai || {
      x: horrorTeacher.root.position.x,
      z: horrorTeacher.root.position.z,
      yaw: horrorTeacher.root.rotation.y
    };
    const aiYaw = Number(aiPose.yaw) || 0;
    const fx = Math.sin(aiYaw);
    const fz = Math.cos(aiYaw);
    const ax = Number(aiPose.x) || 0;
    const az = Number(aiPose.z) || 0;
    povCam.position.set(ax + fx * 0.36, 1.72, az + fz * 0.36);
    povCam.lookAt(ax + fx * 6, 1.54, az + fz * 6);
    if (horrorTeacher?.root) hiddenObjects.push(horrorTeacher.root);
    flashColor = '#fecaca';
    flashIntensity = 3.8;
    ambientBoost = 0.28;
  } else {
    povCam.position.set(-3.8, 3.35, -1.8);
    povCam.rotation.order = 'YXZ';
    povCam.rotation.set(-0.34, Math.sin(elapsed * 0.52) * 1.1, 0, 'YXZ');
    ambientBoost = 0.38;
    flashIntensity = 4.2;
  }

  povCam.updateMatrixWorld(true);
  povCam.getWorldDirection(_povDirTmp);
  _povLookTmp.copy(povCam.position).addScaledVector(_povDirTmp, 7);

  try {
    sceneMgr.renderToTarget(survivalArena.povRenderTarget, povCam, {
      hiddenObjects,
      ambientBoost,
      fogFar: 28,
      flashlightPose: {
        position: povCam.position.clone(),
        target: _povLookTmp.clone(),
        intensity: flashIntensity,
        color: flashColor
      }
    });
  } finally {
    if (povPeerHiddenId) {
      remotePlayers.setPeerPovHidden(povPeerHiddenId, false);
    }
  }
}

function buildDetentionPayload(snap = survivalState.snapshot) {
  if (!survivalState.variationSession) {
    survivalState.variationSession = new VariationTableSession();
  }
  const camInfo = buildDetentionCameraInfo(snap);
  return survivalState.variationSession.getVrSnapshot({
    completedTps: snap?.completedTps?.length || 0,
    totalTps: snap?.requiredTps?.length || TP_CATALOG.length,
    survivorsCount: snap?.aliveCount ?? 0,
    detainedCount: snap?.detainedCount ?? 0,
    aiState: snap?.ai?.state || 'patrol',
    camLabel: camInfo.label,
    camStatus: camInfo.status,
    camIndex: camInfo.camIndex,
    camCount: camInfo.camCount,
    onPrevCamera: () => cycleDetentionCamera(-1),
    onNextCamera: () => cycleDetentionCamera(1),
    onSelectOption: (idx) => submitDetentionOption(idx),
    onClose: () => minimizeDetentionTerminal()
  });
}

function enterDetentionClassroom3D(isDefeat = false) {
  if (!joined) return;
  if (!survivalState.savedCameraMode) {
    survivalState.savedCameraMode = gameState.cameraMode;
  }
  survivalState.detentionLookYaw = 0;
  survivalState.detentionLookPitch = 0;
  survivalState.detentionDraggingLook = false;
  survivalState.lastPovRenderAt = 0;
  survivalState.detained = !isDefeat;
  survivalState.inDefeatDetention = Boolean(isDefeat);
  survivalState.detentionMinimized = true;
  survivalState.detentionModalOpen = false;

  if (document.pointerLockElement === canvas) {
    document.exitPointerLock?.();
  }
  if (!vrManager?.isVrActive?.() && gameState.cameraMode !== 'first') {
    player.setCameraMode('first');
  }
  setModalActive(false, false, false);
  player.setEnabled(false);
  player.setMovementLocked(true);
  touchControls?.setVisible(false);
  teleportWithWorldMode(null, null, 'detention');

  const payload = buildDetentionPayload(survivalState.snapshot);
  survivalArena.updateDetentionMathSheet(payload, true);
  const camInfo = buildDetentionCameraInfo(survivalState.snapshot);
  survivalState.activeCameraInfo = camInfo;
  survivalArena.updateDetentionCameraBar(camInfo, true);
  survivalArena.setLivePovActive(Boolean(survivalArena.povRenderTarget));

  if (vrManager?.isVrActive?.()) {
    vrManager.closeWorldSpatialPanel?.();
  } else {
    hud?.hideDetentionModal?.();
    if (!isDefeat) {
      hud?.showDetention3dHud?.(camInfo);
    }
  }
}

function syncSurvivalPanelMode() {
  if (!joined) return;
  const vrOn = Boolean(vrManager?.isVrActive?.());
  const snap = survivalState.snapshot;

  if (survivalState.jumpscareUntil > Date.now()) {
    if (vrOn) {
      vrManager.openWorldSpatialPanel(
        'jumpscare',
        {
          jumpscare: {
            title: '☠️ PROFESSEUR CIEL VOUS A ATTRAPÉ !',
            subtitle: 'Téléportation en Salle d’Heure de Colle...'
          }
        },
        { dist: 0.72, yOffset: 0.02 }
      );
    } else {
      hud?.triggerJumpscareOverlay?.();
    }
    return;
  }

  if (survivalState.introActive && survivalState.inActiveMatch) {
    const progress = Math.min(
      1,
      Math.max(0, (performance.now() - survivalState.introStartedAt) / Math.max(1, survivalState.introDurationMs))
    );
    if (vrOn) {
      hud?.hideSurvivalIntroOverlay?.();
      vrManager.applySurvivalIntroPose?.(player.position.x, player.position.z, survivalState.introAiPos);
      vrManager.openWorldSpatialPanel(
        'survival_intro',
        { survivalIntro: buildVrIntroState(progress) },
        { dist: 1.48, yOffset: -0.22 }
      );
    } else {
      hud?.showSurvivalIntroOverlay?.({ progress });
    }
    return;
  }

  if (survivalState.inWaitingRoom && !survivalState.inActiveMatch) {
    survivalState.lobbyModalOpen = true;
    if (vrOn) {
      hud?.hideSurvivalLobby?.();
      vrManager.openWorldSpatialPanel('survival_lobby', { survivalLobby: buildVrLobbyState(snap) });
    } else {
      setModalActive(true, false, true);
      hud?.showSurvivalLobby?.(snap || {}, network.clientId, Boolean(latestVoiceState.micEnabled));
    }
    return;
  }

  if (survivalState.hiddenRack && survivalState.inActiveMatch) {
    if (vrOn) {
      hud?.hideHidingOverlay?.();
      vrManager.openWorldSpatialPanel('survival_hidden', { survivalHidden: buildVrHiddenState(snap) });
    } else {
      setModalActive(true, false, true);
      hud?.showHidingOverlay?.({
        noiseLevel: survivalState.noiseLevel,
        micEnabled: Boolean(latestVoiceState.micEnabled),
        aiState: snap?.ai?.state || 'patrol'
      });
    }
    return;
  }

  if ((survivalState.detained && survivalState.inActiveMatch) || survivalState.inDefeatDetention) {
    enterDetentionClassroom3D(survivalState.inDefeatDetention);
  }
}

function enterSurvivalLobby() {
  if (!joined || activeCinematic) return;
  if (!network.connected) {
    hud?.toast?.('⚠️ Connectez-vous au serveur pour lancer le Mode Survie Horreur.', 'error');
    return;
  }
  sfx.interact();
  survivalState.inWaitingRoom = true;
  survivalState.lobbyModalOpen = true;
  teleportWithWorldMode(null, null, 'waiting');
  network.sendSurvivalJoin();
  network.sendActivity('Salon Survie Horreur');
  survivalArena.updateWaitingBoard(
    survivalState.snapshot || { lobbyPlayers: [], minPlayers: SURVIVAL_MIN_PLAYERS },
    true
  );
  syncSurvivalPanelMode();
}

function leaveSurvivalLobby() {
  survivalState.inWaitingRoom = false;
  survivalState.lobbyModalOpen = false;
  hud?.hideSurvivalLobby?.();
  if (vrManager?.isVrActive?.()) {
    vrManager.closeWorldSpatialPanel?.();
  }
  setModalActive(false, false, false);
  network.sendSurvivalLeave();
  if (!survivalState.inActiveMatch) {
    teleportWithWorldMode(null, null, 'hall');
    network.sendActivity('Dans l’atelier');
  }
}

function toggleSurvivalReady() {
  const players = survivalState.snapshot?.lobbyPlayers || [];
  const me = players.find((p) => p.id === network.clientId);
  const nextReady = !Boolean(me?.ready);
  sfx.click();
  network.sendSurvivalReady(nextReady);
}

function toggleHidingInRack(target) {
  if (!joined || activeCinematic || survivalState.detained || survivalState.introActive) return;
  if (!survivalState.inActiveMatch) {
    hud?.toast?.('🗄️ Baie de Brassage (Cachette) : servez-vous en pendant la traque du Professeur CIEL !', 'info');
    return;
  }
  if (survivalState.hiddenRack) {
    const spot = survivalState.hiddenSpot;
    sfx.playLockerDoorSound?.(false);
    network.sendSurvivalHide(null);
    survivalState.hiddenRack = null;
    survivalState.hiddenSpot = null;
    player.setMovementLocked(false);
    hud?.hideHidingOverlay?.();
    if (vrManager?.isVrActive?.()) {
      vrManager.closeWorldSpatialPanel?.();
    }
    setModalActive(false, false, false);
    if (spot) {
      player.teleportTo({ x: spot.exitX, z: spot.exitZ }, { x: spot.exitX, z: spot.exitZ - 2 });
      vrManager?.syncWorldTeleport?.(spot.exitX, spot.exitZ, player.yaw);
    }
    return;
  }
  const rackId = target?.id;
  const spot = lab.hidingSpots?.find((s) => s.id === rackId) || null;
  if (!spot) return;
  sfx.playLockerDoorSound?.(true);
  if (miniGameModal?.backdrop && !miniGameModal.backdrop.classList.contains('hidden')) {
    miniGameModal.close();
  }
  survivalState.hiddenRack = target;
  survivalState.hiddenSpot = spot;
  player.setMovementLocked(true);
  player.teleportTo({ x: spot.x, z: spot.z }, { x: spot.exitX, z: spot.exitZ });
  vrManager?.syncWorldTeleport?.(spot.x, spot.z, player.yaw);
  network.sendSurvivalHide(spot.id);
  syncSurvivalPanelMode();
}

function openDetentionTerminal() {
  if (!survivalState.detained) return;
  sfx.interact();
  enterDetentionClassroom3D(false);
}

function minimizeDetentionTerminal() {
  survivalState.detentionMinimized = true;
  survivalState.detentionModalOpen = false;
  hud?.hideDetentionModal?.();
  if (vrManager?.isVrActive?.()) {
    vrManager.closeWorldSpatialPanel?.();
  }
  setModalActive(false, false, false);
  player.setMovementLocked(true);
}

function submitDetentionOption(optionIndex) {
  if (!survivalState.variationSession) {
    survivalState.variationSession = new VariationTableSession();
  }
  const res = survivalState.variationSession.submit(optionIndex);
  if (res.correct) {
    sfx.success?.();
    if (survivalState.detained && survivalState.inActiveMatch) {
      network.sendSurvivalDetentionSolved();
    }
  } else {
    sfx.error?.();
  }
  const payload = buildDetentionPayload(survivalState.snapshot);
  survivalArena.updateDetentionMathSheet(payload, true);
  if (vrManager?.isVrActive?.() && vrManager.worldPanel) {
    vrManager.updateWorldSpatialPanel?.({ detention: payload });
  }
}

function finishSurvivalIntroCinematic() {
  if (!survivalState.introActive) return;
  survivalState.introActive = false;
  hud?.hideSurvivalIntroOverlay?.();
  if (vrManager?.isVrActive?.()) {
    vrManager.closeWorldSpatialPanel?.();
  }
  setModalActive(false, false, false);
  player.setMovementLocked(false);
  player.setEnabled(!vrManager?.isVrActive?.());
  teleportWithWorldMode(null, null, 'hall');
  const aiSnap = survivalState.snapshot?.ai;
  if (aiSnap) {
    horrorTeacher.snapTo(aiSnap.x, aiSnap.z, aiSnap.yaw || 0);
    horrorTeacher.setTargetState({
      x: aiSnap.x,
      z: aiSnap.z,
      yaw: aiSnap.yaw || 0,
      state: aiSnap.state || 'patrol'
    });
  }
  sceneMgr.setHorrorAtmosphere?.(true, 0.2, 1.0);
  lab.setHorrorLighting?.(true, 1.0);
  hud?.toast?.('☠️ LA TRAQUE COMMENCE ! Terminez 100 % des TPs sans vous faire attraper !', 'error');
  syncVrWatchHud();
}

function startSurvivalMatchClient(snapshot) {
  if (survivalState.endTimer) {
    clearTimeout(survivalState.endTimer);
    survivalState.endTimer = null;
  }
  if (survivalState.jumpscareTimer) {
    clearTimeout(survivalState.jumpscareTimer);
    survivalState.jumpscareTimer = null;
  }
  survivalState.snapshot = snapshot;
  survivalState.phase = 'active';
  survivalState.announcedTps = new Set(snapshot?.completedTps || []);
  const isParticipant = Boolean(
    survivalState.inWaitingRoom ||
      (snapshot?.participants || []).some((p) => p.id === network.clientId)
  );
  survivalState.inWaitingRoom = false;
  survivalState.lobbyModalOpen = false;
  hud?.hideSurvivalLobby?.();
  hud?.hideSurvivalEndOverlay?.();
  if (!isParticipant) return;

  survivalState.inActiveMatch = true;
  survivalState.detained = false;
  survivalState.inDefeatDetention = false;
  survivalState.hiddenRack = null;
  survivalState.hiddenSpot = null;
  survivalState.detentionModalOpen = false;
  survivalState.detentionMinimized = false;
  survivalState.detentionCamIndex = 0;
  survivalState.jumpscareUntil = 0;
  survivalState.variationSession = new VariationTableSession();
  applyRoomInstanceFilter(gameState.room, snapshot);

  if (vrManager?.isVrActive?.()) {
    vrManager.closeWorldSpatialPanel?.();
  }
  setModalActive(false, false, false);
  teleportWithWorldMode(null, null, 'hall');
  player.setMovementLocked(true);
  lab.setTeacherVisible?.(false);

  const introAi = { x: 1.8, z: -1.2, yaw: -Math.PI / 2 };
  survivalState.introAiPos = introAi;
  horrorTeacher.snapTo(introAi.x, introAi.z, introAi.yaw);
  horrorTeacher.setTargetState({ ...introAi, state: 'chase' });
  horrorTeacher.root.visible = true;

  survivalState.introActive = true;
  survivalState.introStartedAt = performance.now();
  survivalState.introDurationMs = Math.max(2500, Number(snapshot?.introDurationMs) || 5600);

  sceneMgr.setHorrorAtmosphere?.(true, 0.35, 0.9);
  lab.setHorrorLighting?.(true, 0.85);
  sfx.playSurvivalIntroAlarm?.();
  sfx.startHorrorAmbience?.();
  network.sendActivity('Survie : Traque du Professeur CIEL');
  syncSurvivalPanelMode();
  syncVrWatchHud();
}

function triggerLocalCaughtJumpscare(snapshot) {
  if (!survivalState.inActiveMatch) return;
  if (survivalState.jumpscareTimer) {
    clearTimeout(survivalState.jumpscareTimer);
  }
  if (miniGameModal?.backdrop && !miniGameModal.backdrop.classList.contains('hidden')) {
    miniGameModal.close();
  }
  survivalState.introActive = false;
  hud?.hideSurvivalIntroOverlay?.();
  survivalState.hiddenRack = null;
  survivalState.hiddenSpot = null;
  survivalState.detained = true;
  survivalState.inDefeatDetention = false;
  survivalState.detentionMinimized = true;
  survivalState.jumpscareUntil = Date.now() + 1750;
  hud?.hideHidingOverlay?.();
  sfx.playJumpscareSound?.();
  vrManager?.pulseBothHands?.(1.0, 450);
  player.setMovementLocked(true);
  syncSurvivalPanelMode();

  survivalState.jumpscareTimer = setTimeout(() => {
    survivalState.jumpscareTimer = null;
    survivalState.jumpscareUntil = 0;
    hud?.hideJumpscareOverlay?.();
    if (!joined) return;
    if (survivalState.inActiveMatch) {
      network.sendActivity('En Salle de Colle 3D (Maths & POV)');
      enterDetentionClassroom3D(false);
    } else if (survivalState.inDefeatDetention) {
      enterDetentionClassroom3D(true);
    }
  }, 1750);
}

function showSurvivalEndUi(endData) {
  if (vrManager?.isVrActive?.()) {
    vrManager.openWorldSpatialPanel('survival_end', { survivalEnd: endData });
  } else {
    if (endData.victory) {
      setModalActive(true, false, true);
    }
    hud?.showSurvivalEndOverlay?.(endData);
  }
  syncVrWatchHud();
}

function endSurvivalMatchClient(ended, snapshot) {
  if (survivalState.endTimer) {
    clearTimeout(survivalState.endTimer);
    survivalState.endTimer = null;
  }
  const wasParticipating =
    survivalState.inActiveMatch ||
    survivalState.detained ||
    survivalState.inWaitingRoom ||
    survivalState.inDefeatDetention;
  survivalState.snapshot = snapshot || survivalState.snapshot;
  survivalState.introActive = false;
  survivalState.inActiveMatch = false;
  survivalState.inWaitingRoom = false;
  survivalState.lobbyModalOpen = false;
  survivalState.hiddenRack = null;
  survivalState.hiddenSpot = null;
  survivalState.phase = 'ended';

  sfx.stopHorrorAmbience?.();
  if (miniGameModal?.backdrop && !miniGameModal.backdrop.classList.contains('hidden')) {
    miniGameModal.close();
  }
  hud?.hideSurvivalLobby?.();
  hud?.hideSurvivalIntroOverlay?.();
  hud?.hideHidingOverlay?.();
  hud?.hideDetentionModal?.();
  hud?.hideDetention3dHud?.();
  hud?.hideSurvivalHud?.();

  if (!wasParticipating) {
    if (survivalState.jumpscareTimer) {
      clearTimeout(survivalState.jumpscareTimer);
      survivalState.jumpscareTimer = null;
    }
    survivalState.jumpscareUntil = 0;
    hud?.hideJumpscareOverlay?.();
    sceneMgr.setHorrorAtmosphere?.(false, 0, 1);
    lab.setHorrorLighting?.(false, 1);
    horrorTeacher.root.visible = false;
    lab.setTeacherVisible?.(true);
    survivalState.detained = false;
    survivalState.inDefeatDetention = false;
    survivalState.phase = 'idle';
    player.setMovementLocked(false);
    return;
  }

  const victory = ended?.outcome === 'victory';
  const totalTps = snapshot?.requiredTps?.length || TP_CATALOG.length;
  const completedTps = snapshot?.completedTps?.length || 0;
  const survivorsCount = snapshot?.aliveCount ?? 0;
  const detainedCount = snapshot?.detainedCount ?? 0;
  const durationSec = Math.round(Number(ended?.durationSec) || 0);

  const endData = {
    victory,
    reason:
      ended?.reason ||
      (victory
        ? 'Les survivants ont terminé 100 % des TPs ! Toute la classe est libérée.'
        : 'Tous les élèves ont été attrapés et placés en heure de colle par le Professeur CIEL.'),
    completedTps,
    totalTps,
    survivorsCount,
    detainedCount,
    durationSec,
    onContinue: () => closeSurvivalEndCinematic()
  };

  if (victory) {
    if (survivalState.jumpscareTimer) {
      clearTimeout(survivalState.jumpscareTimer);
      survivalState.jumpscareTimer = null;
    }
    survivalState.jumpscareUntil = 0;
    hud?.hideJumpscareOverlay?.();
    sceneMgr.setHorrorAtmosphere?.(false, 0, 1);
    lab.setHorrorLighting?.(false, 1);
    sfx.playHorrorVictory?.();
    survivalState.detained = false;
    survivalState.inDefeatDetention = false;
    horrorTeacher.root.visible = false;
    lab.setTeacherVisible?.(true);
    if (survivalState.savedCameraMode) {
      player.setCameraMode(survivalState.savedCameraMode);
      survivalState.savedCameraMode = null;
    }
    player.setMovementLocked(false);
    teleportWithWorldMode(null, null, 'hall');
    showSurvivalEndUi(endData);
    return;
  }

  sfx.playHorrorDefeat?.();
  survivalState.detained = false;
  survivalState.inDefeatDetention = true;
  sceneMgr.setHorrorAtmosphere?.(true, 0.22, 0.9, 26);
  lab.setHorrorLighting?.(true, 0.85);
  lab.setTeacherVisible?.(false);
  if (snapshot?.ai) {
    horrorTeacher.snapTo(snapshot.ai.x, snapshot.ai.z, snapshot.ai.yaw || 0);
    horrorTeacher.setTargetState({
      x: snapshot.ai.x,
      z: snapshot.ai.z,
      yaw: snapshot.ai.yaw || 0,
      state: snapshot.ai.state || 'patrol'
    });
  }
  horrorTeacher.root.visible = true;

  const remainingJumpscare = survivalState.jumpscareUntil - Date.now();
  if (remainingJumpscare > 50) {
    survivalState.endTimer = setTimeout(() => {
      survivalState.endTimer = null;
      survivalState.jumpscareUntil = 0;
      hud?.hideJumpscareOverlay?.();
      if (!joined || !survivalState.inDefeatDetention) return;
      enterDetentionClassroom3D(true);
      showSurvivalEndUi(endData);
    }, remainingJumpscare);
  } else {
    survivalState.jumpscareUntil = 0;
    hud?.hideJumpscareOverlay?.();
    enterDetentionClassroom3D(true);
    showSurvivalEndUi(endData);
  }
}

function closeSurvivalEndCinematic({ skipSendReturn = false } = {}) {
  if (survivalState.endTimer) {
    clearTimeout(survivalState.endTimer);
    survivalState.endTimer = null;
  }
  if (survivalState.jumpscareTimer) {
    clearTimeout(survivalState.jumpscareTimer);
    survivalState.jumpscareTimer = null;
  }
  hud?.hideSurvivalEndOverlay?.();
  hud?.hideDetention3dHud?.();
  if (vrManager?.isVrActive?.()) {
    vrManager.closeWorldSpatialPanel?.();
  }
  sceneMgr.setHorrorAtmosphere?.(false, 0, 1);
  lab.setHorrorLighting?.(false, 1);
  horrorTeacher.root.visible = false;
  lab.setTeacherVisible?.(true);
  survivalState.detained = false;
  survivalState.inDefeatDetention = false;
  survivalState.inActiveMatch = false;
  survivalState.inWaitingRoom = false;
  survivalState.introActive = false;
  survivalState.jumpscareUntil = 0;
  survivalState.phase = 'idle';
  remotePlayers.setInstanceFilter(null);
  if (survivalState.savedCameraMode) {
    player.setCameraMode(survivalState.savedCameraMode);
    survivalState.savedCameraMode = null;
  }
  player.setMovementLocked(false);
  teleportWithWorldMode(null, null, 'hall');
  setModalActive(false, false, false);
  if (!skipSendReturn && isSurvivalInstanceRoom(gameState.room)) {
    network.sendSurvivalReturn?.();
  }
  network.sendActivity('Dans l’atelier');
}

function resetSurvivalClientFull() {
  if (survivalState.jumpscareTimer) {
    clearTimeout(survivalState.jumpscareTimer);
    survivalState.jumpscareTimer = null;
  }
  if (survivalState.endTimer) {
    clearTimeout(survivalState.endTimer);
    survivalState.endTimer = null;
  }
  survivalState.phase = 'idle';
  survivalState.inWaitingRoom = false;
  survivalState.inActiveMatch = false;
  survivalState.introActive = false;
  survivalState.detained = false;
  survivalState.inDefeatDetention = false;
  survivalState.hiddenRack = null;
  survivalState.hiddenSpot = null;
  survivalState.snapshot = null;
  survivalState.lobbyModalOpen = false;
  survivalState.detentionModalOpen = false;
  survivalState.detentionMinimized = false;
  survivalState.jumpscareUntil = 0;
  survivalState.variationSession = null;
  remotePlayers.setInstanceFilter(null);
  if (survivalState.savedCameraMode) {
    player.setCameraMode(survivalState.savedCameraMode);
    survivalState.savedCameraMode = null;
  }
  sfx.stopHorrorAmbience?.();
  sceneMgr.setHorrorAtmosphere?.(false, 0, 1);
  lab.setHorrorLighting?.(false, 1);
  lab.setTeacherVisible?.(true);
  horrorTeacher.root.visible = false;
  player.setMovementLocked(false);
  player.setColliders(lab.colliders);
  player.setBounds(currentMapData.bounds);
  hud?.hideAllSurvivalUi?.();
  if (vrManager?.isVrActive?.()) {
    vrManager.closeWorldSpatialPanel?.();
  }
}

function updateSurvivalLoop(dt, elapsed) {
  if (survivalState.inWaitingRoom && !survivalState.inActiveMatch) {
    survivalArena.updateWaitingBoard(survivalState.snapshot);
    return;
  }

  if (survivalState.inDefeatDetention) {
    const snap = survivalState.snapshot;
    sceneMgr.setHorrorAtmosphere?.(true, 0.22, 0.9, 26);
    lab.setHorrorLighting?.(true, 0.85);
    horrorTeacher.update(dt, elapsed);
    survivalArena.updateDetentionClock?.(elapsed);
    return;
  }

  if (!survivalState.inActiveMatch) return;

  const snap = survivalState.snapshot;

  if (survivalState.introActive) {
    const progress = Math.min(
      1,
      Math.max(0, (performance.now() - survivalState.introStartedAt) / Math.max(1, survivalState.introDurationMs))
    );
    const shot = computeSurvivalIntroShot(progress, survivalState.introAiPos, player.position, elapsed);
    sceneMgr.setHorrorAtmosphere?.(true, shot.redThreat, shot.flicker);
    lab.setHorrorLighting?.(true, shot.flicker);
    horrorTeacher.update(dt, elapsed);
    if (vrManager?.isVrActive?.()) {
      vrManager.updateWorldSpatialPanel?.({ survivalIntro: buildVrIntroState(progress, shot.phaseLabel) });
    } else {
      sceneMgr.camera.position.set(shot.camPos.x, shot.camPos.y, shot.camPos.z);
      sceneMgr.camera.lookAt(shot.camLook.x, shot.camLook.y, shot.camLook.z);
      hud?.updateSurvivalIntroOverlay?.({
        phaseLabel: shot.phaseLabel,
        briefingText: shot.briefingText,
        progress
      });
    }
    if (progress >= 1) {
      finishSurvivalIntroCinematic();
    }
    return;
  }

  const flicker =
    Math.sin(elapsed * 19.3) * Math.sin(elapsed * 7.1) > 0.72
      ? 0.34
      : 0.86 + Math.sin(elapsed * 3.1) * 0.12;
  const aiDist = Math.hypot(
    (horrorTeacher.root.position.x || 0) - player.position.x,
    (horrorTeacher.root.position.z || 0) - player.position.z
  );
  const aiState = snap?.ai?.state || 'patrol';
  const threat = Math.max(
    0,
    Math.min(1, (14 - aiDist) / 12 + (aiState === 'chase' ? 0.42 : aiState === 'investigate' ? 0.18 : 0))
  );

  sceneMgr.setHorrorAtmosphere?.(
    true,
    survivalState.detained ? 0.12 : threat,
    survivalState.detained ? 0.92 : flicker,
    survivalState.detained ? 26 : null
  );
  lab.setHorrorLighting?.(true, flicker);
  horrorTeacher.update(dt, elapsed);
  survivalArena.updateDetentionClock?.(elapsed);

  if (survivalState.detained && !vrManager?.isVrActive?.()) {
    const payload = buildDetentionPayload(snap);
    survivalArena.updateDetentionMathSheet(payload, false);
  }

  if (!survivalState.detained && survivalState.jumpscareUntil <= Date.now()) {
    const stepInterval = aiState === 'chase' ? 0.34 : aiState === 'investigate' ? 0.48 : 0.68;
    if (aiDist < 18 && elapsed - survivalState.lastStepSoundAt >= stepInterval) {
      survivalState.lastStepSoundAt = elapsed;
      sfx.playHeavyFootstep?.(aiDist, 18);
    }
    const hbInterval = Math.max(0.28, 0.62 - threat * 0.3);
    if ((aiDist < 12 || aiState === 'chase') && elapsed - survivalState.lastHeartbeatAt >= hbInterval) {
      survivalState.lastHeartbeatAt = elapsed;
      sfx.playHorrorHeartbeat?.(Math.max(0.25, threat));
    }
  }

  voiceChat.sampleMicLevel?.();
  const mic = voiceChat.getMicMetrics?.() || {
    micEnabled: Boolean(latestVoiceState.micEnabled),
    level: 0,
    rms: 0
  };
  survivalState.noiseLevel = mic.level || 0;
  if (elapsed - survivalState.lastMicSentAt >= 0.16 && !survivalState.detained) {
    survivalState.lastMicSentAt = elapsed;
    network.sendSurvivalMic?.({
      micEnabled: Boolean(mic.micEnabled),
      level: mic.level || 0,
      rms: mic.rms || 0
    });
  }

  const completedCnt = snap?.completedTps?.length || 0;
  const totalCnt = snap?.requiredTps?.length || TP_CATALOG.length;
  hud?.updateSurvivalHud?.({
    completedTps: completedCnt,
    totalTps: totalCnt,
    survivorsCount: snap?.aliveCount ?? 0,
    detainedCount: snap?.detainedCount ?? 0,
    aiState,
    noiseLevel: survivalState.noiseLevel,
    micEnabled: Boolean(mic.micEnabled),
    detained: survivalState.detained,
    detentionMinimized: survivalState.detentionMinimized
  });

  if (survivalState.hiddenRack) {
    if (vrManager?.isVrActive?.()) {
      vrManager.updateWorldSpatialPanel?.({ survivalHidden: buildVrHiddenState(snap) });
    } else {
      hud?.showHidingOverlay?.({
        noiseLevel: survivalState.noiseLevel,
        micEnabled: Boolean(mic.micEnabled),
        aiState
      });
    }
  }
}

function syncVrWatchHud(extra = {}) {
  if (!vrManager?.isVrActive?.()) return;
  const zone = getZoneAtPositionInMap(currentMapData, player.position.x, player.position.z);
  const survSnap = survivalState.snapshot;
  const survExtra = {};
  if (survivalState.inActiveMatch) {
    const done = survSnap?.completedTps?.length || 0;
    const tot = survSnap?.requiredTps?.length || TP_CATALOG.length;
    const st = survSnap?.ai?.state || 'patrol';
    survExtra.survivalStatus = {
      active: true,
      phase: survivalState.phase,
      completedTps: done,
      totalTps: tot,
      aiState: st,
      noiseLevel: survivalState.noiseLevel || 0,
      detained: survivalState.detained
    };
    if (!extra.targetHint) {
      survExtra.targetHint = `☠️ ${done}/${tot} TPs • ${st === 'chase' ? 'POURSUITE !' : st === 'investigate' ? 'Bruit !' : 'Survie'}`;
    }
  } else {
    survExtra.survivalStatus = null;
  }
  vrManager.updateHudInfo({
    name: gameState.profile.name,
    zoneLabel: zone.badgeText,
    zoneColor: zone.color || '#22d3ee',
    average: gameState.profile.average,
    completedCount: gameState.profile.completedCount || 0,
    totalTps: TP_CATALOG.length,
    xp: gameState.profile.xp,
    micEnabled: Boolean(latestVoiceState.micEnabled),
    isSpeaking: Boolean(latestVoiceState.isSpeaking),
    nearbySpeakers: latestVoiceState.nearbySpeakers || [],
    connectionState: hud?.lastConnectionState || (network.connected ? 'connected' : 'solo'),
    onlineCount: hud?.lastOnlineCount || 1,
    pingMs: network.lastPingMs,
    ...survExtra,
    ...extra
  });
}

const DEBUG_ZONE_SPOTS = {
  U300: { x: -3.95, z: 0.65 },
  U301: { x: -8.0, z: -7.5 },
  U302: { x: 0.0, z: -7.5 },
  U303: { x: 7.0, z: -7.5 },
  U304: { x: 8.5, z: 0.0 },
  U305: { x: 8.0, z: 8.0 },
  U306: { x: 0.0, z: 8.5 },
  U307: { x: -8.0, z: 7.0 },
  CHAMBRE: { x: -10.0, z: -0.5 },
  U308: { x: 1.45, z: 4.45 },
  U309: { x: -6.35, z: -0.5 },
  U311: { x: -5.65, z: 1.12 }
};

function getTeacherPosFromMap(mapData = currentMapData) {
  const teacherObj = (mapData?.objects || []).find((o) => o.type === 'npc_teacher');
  if (teacherObj && Number.isFinite(Number(teacherObj.x)) && Number.isFinite(Number(teacherObj.z))) {
    return { x: Number(teacherObj.x), z: Number(teacherObj.z) };
  }
  return { x: -3.35, z: -1.35 };
}

function endAscensionCinematic() {
  clearVrAscCountdown();
  if (activeCinematic?.endTimer) {
    clearTimeout(activeCinematic.endTimer);
  }
  if (activeCinematic?.playerId) {
    remotePlayers.setLevitation(activeCinematic.playerId, 0);
  }
  if (localAvatar?.group) {
    localAvatar.group.position.y = 0;
  }
  activeCinematic = null;
  const vrOn = Boolean(vrManager?.isVrActive?.());
  if (vrOn) {
    vrManager.closeWorldSpatialPanel?.();
  }
  player._syncAvatarVisibility?.();
  player.setEnabled(joined && !modalOpen && !vrOn);
  touchControls?.setVisible(joined && !modalOpen && !vrOn && gameState.touchMode);
  if (!vrOn) {
    player._applyCamera?.();
  }
}

function endIntroCinematic(skipped = false) {
  hud?.hideIntroCinematic?.();
  if (activeCinematic?.phase === 'intro') {
    activeCinematic = null;
  }
  const vrOn = Boolean(vrManager?.isVrActive?.());
  player._syncAvatarVisibility?.();
  player.setEnabled(joined && !modalOpen && !vrOn);
  touchControls?.setVisible(joined && !modalOpen && !vrOn && gameState.touchMode);
  if (!vrOn) {
    player._applyCamera?.();
  }
  if (gameState.isAuthenticated() && !gameState.introSeen) {
    gameState.setIntroSeen(true);
    network.saveAccount({ introSeen: true });
  }
  if (joined) {
    hud?.toast?.(
      skipped
        ? '🎬 Visite guidée terminée — Parlez au Professeur CIEL (touche E) ou choisissez un TP !'
        : '🎓 Visite terminée ! Visez 20/20 sur tous les TPs pour commencer votre Ascension.',
      'success'
    );
  }
}

function startIntroCinematic(manualReplay = false) {
  if (!joined) return;
  if (activeCinematic && activeCinematic.phase !== 'intro') return;
  if (vrManager?.isVrActive?.()) {
    if (manualReplay) {
      hud?.toast?.('🎬 Quittez le mode VR (F9) pour lancer la visite guidée cinématique.', 'info');
    }
    return;
  }
  if (miniGameModal?.backdrop && !miniGameModal.backdrop.classList.contains('hidden')) {
    miniGameModal.close();
  }
  dialogueModal?.close?.();
  hud?.closeAllModals?.();
  modalOpen = false;
  subModalActive = false;
  sceneMgr.setPaused(false);
  if (document.pointerLockElement === canvas) {
    document.exitPointerLock?.();
  }

  const teacherPos = getTeacherPosFromMap(currentMapData);
  activeCinematic = {
    phase: 'intro',
    stepIndex: 0,
    stepStartedAt: performance.now(),
    teacherPos
  };
  player.clearKeys?.();
  player.setEnabled(false);
  touchControls?.setVisible(false);
  sceneMgr.applyIntroCinematicShot(0, 0, sceneMgr.clock.elapsedTime, teacherPos);
  sfx.playIntroChime?.();
  hud?.showIntroCinematic?.({
    playerName: gameState.profile.name,
    onStepChange: (idx) => {
      if (activeCinematic?.phase === 'intro') {
        activeCinematic.stepIndex = idx;
        activeCinematic.stepStartedAt = performance.now();
      }
    },
    onFinish: ({ skipped }) => {
      endIntroCinematic(skipped);
    }
  });
}

function runAscensionPhase(payload = {}) {
  clearVrAscCountdown();
  hud?.hideAscensionDialogue?.();
  hud?.hideIntroCinematic?.();
  const playerName = payload.playerName || activeCinematic?.playerName || gameState.profile.name || 'Eleve_CIEL';
  const spec = resolveAscensionSpecialty(payload.specialty || payload.tpId || 'cyber');
  const isWinner = Boolean(
    (payload.playerId && network.clientId && payload.playerId === network.clientId) ||
      activeCinematic?.isWinner ||
      (!payload.playerId && playerName.toLowerCase() === gameState.profile.name?.toLowerCase())
  );
  const teacherPos = activeCinematic?.teacherPos || getTeacherPosFromMap(currentMapData);
  const winnerSpot = payload.center || activeCinematic?.winnerSpot || {
    x: teacherPos.x - 0.8,
    y: 0,
    z: teacherPos.z + 0.1
  };
  const bannerText = payload.bannerText || formatAscensionBanner(playerName, spec.id);

  if (activeCinematic?.endTimer) {
    clearTimeout(activeCinematic.endTimer);
  }
  activeCinematic = {
    ...(activeCinematic || {}),
    id: payload.id || activeCinematic?.id || 'ascension',
    phase: 'ascension',
    isWinner,
    playerId: payload.playerId || activeCinematic?.playerId || null,
    playerName,
    specialty: spec.id,
    teacherPos,
    winnerSpot,
    endTimer: null
  };

  sfx.playAscensionFanfare(spec.id);
  let secretUnlockedNow = false;

  if (isWinner) {
    const allTps = getDynamicAllTps();
    const allTpsAt20 = hasAllTpsAt20(gameState.profile.grades, allTps);
    const canUnlock =
      allTpsAt20 || (Boolean(payload.persisted) && isCreatorLouis(gameState.profile.name));
    sessionDivineSpecialty = spec.id;
    if (canUnlock) {
      const hadSecretBefore = Boolean(gameState.secretSkinUnlocked);
      gameState.unlockDivineSkin(spec.id, true);
      if (payload.persisted) {
        if (payload.prestigeReset) {
          gameState.resetPrestigeProgress();
          hud?.toast?.('🔄 Cycle de Prestige activé : vos TPs repartent à zéro pour débloquer les autres Skins Divins !', 'info');
        }
      } else {
        if (allTpsAt20) {
          gameState.resetPrestigeProgress();
          hud?.toast?.('🔄 Cycle de Prestige activé : vos TPs repartent à zéro pour débloquer les autres Skins Divins !', 'info');
        }
        const hasAllNow = hasAllDivineSpecialties(gameState.unlockedDivineSkins);
        if (!hadSecretBefore && hasAllNow) {
          secretUnlockedNow = true;
          sfx.playSecretUnlockFanfare?.();
          hud?.showSecretSkinAnnouncement?.({
            playerName,
            bannerText: formatSecretSkinAnnouncement(playerName)
          });
        }
        network.saveAccount({
          tpScores: gameState.profile.grades,
          unlockedDivineSkins: gameState.unlockedDivineSkins,
          unlockDivineSkin: spec.id,
          selectedSkin: getSelectedSkinIdFromSkin(gameState.skin),
          avatarCustomization: gameState.skin
        });
      }
      rebuildLocalAvatar(gameState.skin);
      lab.updateStationBadges(gameState.profile.grades);
      mainMenu?.renderSkinUi?.();
      hud?.refresh?.();
    } else {
      rebuildLocalAvatar(gameState.skin);
    }
    if (localAvatar?.group) {
      localAvatar.group.visible = true;
    }
    if (gameState.cameraMode === 'first' && !vrManager?.isVrActive?.()) {
      gameState.setCameraMode('third');
      player.setCameraMode('third');
      hud?.syncCameraUi?.();
      touchControls?.syncCameraMode?.('third');
    }
    showSpeechBubble(localBubble, `⚡ DIEU CIEL (${spec.shortLabel}) !`, {
      isEmote: true,
      color: spec.primaryColor
    });
    syncVrWatchHud({ targetHint: `👑 DIEU CIEL (${spec.shortLabel})` });
  } else if (payload.playerId) {
    remotePlayers.setDivineSkin(payload.playerId, spec.id);
    remotePlayers.showBubble(payload.playerId, `⚡ DIEU CIEL (${spec.shortLabel}) !`, {
      isEmote: true,
      color: spec.primaryColor
    });
  }

  const levDurationSec = Math.max(1.8, (Number(payload.levitationDurationMs) || 3800) / 1000);
  const applaudMs = Math.max(2000, Number(payload.applaudDurationMs) || 8000);

  sceneMgr.triggerAscension({
    duration: levDurationSec + applaudMs / 1000,
    levitationDuration: levDurationSec,
    specialty: spec.id,
    center: winnerSpot,
    targetAvatar: isWinner ? localAvatar : null
  });

  if (vrManager?.isVrActive?.()) {
    const colList = buildVrAscCollection(gameState.unlockedDivineSkins);
    vrManager.openWorldSpatialPanel('ascension', {
      title: '👑 ASCENSION DU BAC PRO CIEL',
      onExitTp: () => endAscensionCinematic(),
      ascension: {
        phase: 'ascension',
        title: '👑 ASCENSION DU BAC PRO CIEL',
        headline: bannerText,
        speech: isWinner
          ? `Félicitations ! La tenue divine ${spec.label} et le Cycle de Prestige ont été activés sur votre compte.`
          : `Félicitations à ${playerName} qui devient Dieu du Bac Pro CIEL (${spec.label}) !`,
        isWinner,
        chosenSpecialty: spec.id,
        collection: colList,
        secretSkinUnlocked: Boolean(secretUnlockedNow || payload.secretSkinUnlocked || gameState.secretSkinUnlocked),
        canApplaud: !isWinner,
        onApplaud: () => {
          sfx.click();
          network.sendApplaud?.(activeCinematic?.id);
        },
        onClose: () => endAscensionCinematic()
      }
    });
  }

  hud?.showWorldCelebration?.({
    ...payload,
    playerName,
    specialty: spec.id,
    tpLabel: spec.label,
    bannerText,
    durationMs: Math.round(levDurationSec * 1000) + applaudMs
  });

  activeCinematic.endTimer = setTimeout(() => {
    endAscensionCinematic();
    hud?.showWorldCelebration?.({
      ...payload,
      playerName,
      specialty: spec.id,
      tpLabel: spec.label,
      bannerText,
      durationMs: applaudMs
    });
  }, Math.round(levDurationSec * 1000));
}

function handleLocalSpecialtyChoice(specialtyId = 'cyber') {
  const spec = resolveAscensionSpecialty(specialtyId);
  const celebId = activeCinematic?.id || '';
  const sent = network.sendAscensionChoice(spec.id, celebId);
  if (!sent) {
    runAscensionPhase({
      id: celebId,
      playerId: network.clientId,
      playerName: gameState.profile.name,
      specialty: spec.id
    });
  }
}

function runWorldCelebration(payload = {}) {
  const now = Date.now();
  if (now - lastCelebrationAt < 1200) return;
  lastCelebrationAt = now;
  clearVrAscCountdown();

  if (miniGameModal?._isOpen || (miniGameModal?.backdrop && !miniGameModal.backdrop.classList.contains('hidden'))) {
    miniGameModal.close();
  }
  dialogueModal?.close?.();
  hud?.closeAllModals?.();
  modalOpen = false;
  subModalActive = false;
  sceneMgr.setPaused(false);

  const playerName = payload.playerName || gameState.profile.name || 'Eleve_CIEL';
  const myNameLower = (gameState.profile.name || '').toLowerCase();
  const isWinner = Boolean(
    (payload.playerId && network.clientId && payload.playerId === network.clientId) ||
      (!payload.playerId && (!payload.playerName || payload.playerName.toLowerCase() === myNameLower)) ||
      (payload.playerName && payload.playerName.toLowerCase() === myNameLower)
  );

  const teacherPos = payload.teacherPos || getTeacherPosFromMap(currentMapData);
  const peerIds = [network.clientId || 'local', ...remotePlayers.peers.keys()].filter(Boolean);
  const winnerId = payload.playerId || (isWinner ? network.clientId || 'local' : peerIds[0]);
  const layout =
    payload.placements && Array.isArray(payload.placements) && payload.placements.length > 0
      ? payload
      : computeAscensionGatheringLayout(teacherPos, winnerId, peerIds);

  const winnerSpot = layout.winnerSpot || {
    x: Number((teacherPos.x - 0.8).toFixed(2)),
    y: 0,
    z: Number((teacherPos.z + 0.1).toFixed(2)),
    yaw: Math.PI
  };
  const stageCenter = layout.stageCenter || {
    x: Number((teacherPos.x - 0.4).toFixed(2)),
    z: Number((teacherPos.z + 0.05).toFixed(2))
  };

  if (isWinner) {
    player.teleportTo(
      { x: winnerSpot.x, z: winnerSpot.z },
      { x: stageCenter.x, z: stageCenter.z + 2.0 }
    );
  } else {
    const myPlacement = (layout.placements || []).find(
      (pl) => pl.id && pl.id === network.clientId && pl.role === 'spectator'
    );
    const fallbackSpecPos = myPlacement || {
      x: Number((stageCenter.x - 0.45).toFixed(2)),
      z: Number((stageCenter.z + 1.85).toFixed(2))
    };
    player.teleportTo({ x: fallbackSpecPos.x, z: fallbackSpecPos.z }, stageCenter);
  }
  if (vrManager?.isVrActive?.()) {
    vrManager._mountVrRigForWorld?.(vrManager.simMode);
  }

  for (const pl of layout.placements || []) {
    if (pl.id && pl.id !== network.clientId) {
      remotePlayers.teleportPeer(pl.id, pl.x, pl.y || 0, pl.z, pl.yaw);
    }
  }

  if (joined) {
    network.sendMove(player.position.x, 0, player.position.z, player.yaw, true);
  }

  if (activeCinematic?.endTimer) {
    clearTimeout(activeCinematic.endTimer);
  }
  activeCinematic = {
    id: payload.id || 'celeb-20',
    phase: 'dialogue',
    isWinner,
    playerId: payload.playerId || (isWinner ? network.clientId : null),
    playerName,
    teacherPos,
    winnerSpot,
    stageCenter,
    endTimer: null
  };

  player.setEnabled(false);
  touchControls?.setVisible(false);
  if (localAvatar?.group) {
    localAvatar.group.position.set(player.position.x, 0, player.position.z);
    localAvatar.group.rotation.y = player.yaw + Math.PI;
    localAvatar.group.visible = true;
    localAvatar.setFirstPersonVrHidden?.(Boolean(vrManager?.isVrActive?.()));
  }
  if (!vrManager?.isVrActive?.()) {
    sceneMgr.applyCinematicShot('dialogue', sceneMgr.clock.elapsedTime, teacherPos, winnerSpot);
  }

  sfx.interact();
  const choiceTimeoutMs = payload.choiceTimeoutMs || 15000;
  if (vrManager?.isVrActive?.()) {
    const unlockedList = Array.isArray(payload.unlockedDivineSkins)
      ? payload.unlockedDivineSkins
      : isWinner
        ? gameState.unlockedDivineSkins
        : [];
    const colList = buildVrAscCollection(unlockedList);
    let secLeft = Math.ceil(choiceTimeoutMs / 1000);
    const speechText =
      payload.dialogueText ||
      `Félicitations solennelles à ${playerName} pour son 20/20 intégral au Bac Pro CIEL ! Choisissez votre Voie Divine ci-dessous :`;
    const vrAscState = {
      phase: 'dialogue',
      title: '👑 L’ASCENSION DU BAC PRO CIEL',
      headline: isWinner ? '🌟 CHOISISSEZ VOTRE VOIE DIVINE !' : `👀 ${playerName} choisit sa Voie Divine...`,
      speech: speechText,
      winnerName: playerName,
      isWinner,
      chosenSpecialty: null,
      countdownSec: secLeft,
      collection: colList,
      choices: ASCENSION_SPECIALTIES.map((s) => ({
        id: s.id,
        icon: s.icon,
        label: s.shortLabel || s.label
      })),
      secretSkinUnlocked: Boolean(gameState.secretSkinUnlocked),
      onChooseSpecialty: (specId) => {
        clearVrAscCountdown();
        handleLocalSpecialtyChoice(specId);
      },
      onClose: () => endAscensionCinematic()
    };
    vrManager.openWorldSpatialPanel('ascension', {
      title: '👑 L’ASCENSION DU BAC PRO CIEL',
      onExitTp: () => endAscensionCinematic(),
      ascension: vrAscState
    });
    vrAscCountdownTimer = setInterval(() => {
      secLeft = Math.max(0, secLeft - 1);
      if (activeCinematic?.phase === 'dialogue') {
        vrAscState.countdownSec = secLeft;
        vrManager.updateWorldSpatialPanel({ ascension: { ...vrAscState } });
      } else {
        clearVrAscCountdown();
      }
    }, 1000);
  }

  hud?.showAscensionDialogue?.({
    ...payload,
    playerName,
    isWinner,
    choiceTimeoutMs,
    defaultSpecialty: payload.tpId || 'cyber',
    onTimeout: (fallbackSpec) => {
      clearVrAscCountdown();
      if (isWinner) {
        handleLocalSpecialtyChoice(fallbackSpec);
      } else {
        runAscensionPhase({
          id: payload.id,
          playerId: payload.playerId,
          playerName,
          specialty: fallbackSpec,
          center: winnerSpot
        });
      }
    }
  });
}

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
  survivalArena?.setMapData?.(currentMapData);
  lab.updateStationBadges(gameState.profile.grades);
  sceneMgr.updateWorldBounds(currentMapData.bounds);
  if (!survivalState.inWaitingRoom && !survivalState.detained) {
    player.setColliders(lab.colliders);
    player.setBounds(currentMapData.bounds);
  }
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
  if (active) {
    lab.setHoveredInteractable?.(null);
    hoveredInteractable = null;
    canvas.style.cursor = '';
    crosshairEl?.classList.remove('interact-ready');
  }
  const vrOn = Boolean(vrManager?.isVrActive?.());
  player.setEnabled(joined && !active && !vrOn);
  touchControls?.setVisible(joined && !active && !vrOn && gameState.touchMode);
  sceneMgr.setPaused(pauseScene);
}

let activeCameraTweenId = 0;

function animateCameraPose(targetPos, lookAtPos, durationMs = 420) {
  if (vrManager?.isVrActive?.() || sceneMgr.renderer.xr?.isPresenting) {
    return Promise.resolve(false);
  }
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
      if (tweenId !== activeCameraTweenId || vrManager?.isVrActive?.() || sceneMgr.renderer.xr?.isPresenting) {
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

let tpOpenSeqId = 0;

async function openTp(tpId, stationItem = null) {
  const tp = getStationById(tpId);
  const factory = MINIGAME_FACTORIES[tpId];
  if (!tp || !factory) return;

  const openSeq = ++tpOpenSeqId;
  lab.setHoveredInteractable?.(null);
  hoveredInteractable = null;

  if (!gameState.profile.questAccepted) {
    gameState.profile.questAccepted = true;
    network.acceptQuest(gameState.profile.name);
  }

  sfx.interact();
  network.sendActivity(`En ${tp.shortTitle}`);
  voiceChat.setInTp(true);
  setModalActive(true, !survivalState.inActiveMatch, true);

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
    if (openSeq !== tpOpenSeqId || !joined || activeCinematic) return;
  }

  miniGameModal.open(tpId, factory, {
    vrManager,
    onComplete: ({ tpId: doneId, score, durationSec }) => {
      const safeScore = Number.isFinite(Number(score))
        ? Math.max(0, Math.min(20, Math.round(Number(score) * 10) / 10))
        : 0;
      const allTps = getDynamicAllTps();
      const wasAllAt20 = hasAllTpsAt20(gameState.profile.grades, allTps);
      const p = { ...gameState.profile, grades: { ...gameState.profile.grades } };
      const prev = typeof p.grades[doneId] === 'number' ? p.grades[doneId] : -1;
      if (safeScore > prev) p.grades[doneId] = safeScore;
      const coreVals = TP_CATALOG.map((item) => p.grades[item.id]).filter((v) => typeof v === 'number');
      p.average = coreVals.length
        ? Math.round((coreVals.reduce((a, b) => a + b, 0) / coreVals.length) * 10) / 10
        : null;
      p.completedCount = coreVals.filter((v) => v >= 10).length;
      p.diplomaEarned = p.completedCount === TP_CATALOG.length;
      gameState.setProfile(p);
      lab.updateStationBadges(p.grades);
      syncVrWatchHud();

      const allTpsAt20 = hasAllTpsAt20(p.grades, allTps);
      const firstTimeAllAt20 = !wasAllAt20 && allTpsAt20;
      network.submitScore(gameState.profile.name, doneId, safeScore, durationSec, gameState.skin);
      if (
        survivalState.inActiveMatch &&
        safeScore >= 10 &&
        !survivalState.snapshot?.completedTps?.includes(doneId)
      ) {
        network.sendSurvivalTpDone(doneId, safeScore);
      }
      network.saveAccount({
        tpScores: p.grades,
        unlockedDivineSkins: gameState.unlockedDivineSkins,
        selectedSkin: getSelectedSkinIdFromSkin(gameState.skin),
        avatarCustomization: gameState.skin
      });
      if (firstTimeAllAt20 && !network.connected) {
        runWorldCelebration({
          playerName: gameState.profile.name,
          tpId: doneId,
          tpLabel: tp.title || tp.shortTitle,
          reason: 'all_tps_20'
        });
      }
      setTimeout(() => refreshWallLeaderboard(), 420);
      if (safeScore === 20 && !allTpsAt20) {
        hud.toast(
          `🏆 20/20 obtenu sur ${tp.shortTitle} ! Validez les ${allTps.length} TPs à 20/20 pour l'Ascension.`,
          'success'
        );
      } else if (!getTpById(doneId)) {
        hud.toast(`${tp.icon} Atelier ${tp.shortTitle} validé (${safeScore.toFixed(1)}/20) !`, safeScore >= 10 ? 'success' : 'info');
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
    vrManager,
    customDialogue,
    onAcceptQuest: () => {
      gameState.setProfile({ ...gameState.profile, questAccepted: true });
      network.acceptQuest(gameState.profile.name);
      hud.toast('Programme des TP démarré ! Choisissez un poste de TP.');
      syncVrWatchHud();
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
    const selectedId = getSelectedSkinIdFromSkin(skin);
    sessionDivineSpecialty = skin?.secretSkin
      ? ULTIMATE_SECRET_SKIN_ID
      : skin?.divineSpecialty || null;
    rebuildLocalAvatar(skin);
    battlePassModal?.refresh?.();
    network.sendSkinUpdate(skin);
    network.saveAccount({
      selectedSkin: selectedId,
      avatarCustomization: skin,
      unlockedDivineSkins: gameState.unlockedDivineSkins
    });
  },
  onReplayIntro: () => {
    startIntroCinematic(true);
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
  onAudioPanelToggle: (open) => {
    if (open) {
      voiceChat.refreshDevices();
      voiceChat.startMicTest();
    } else {
      voiceChat.stopMicTest();
    }
  },
  onAudioRefreshDevices: () => {
    voiceChat.refreshDevices();
  },
  onAudioInputChange: async (deviceId) => {
    const res = await voiceChat.setInputDevice(deviceId);
    if (res?.switched) {
      hud?.toast?.(
        deviceId ? '🎙️ Microphone mis à jour sans coupure.' : '🎙️ Microphone système par défaut actif.',
        'success'
      );
    }
  },
  onAudioOutputChange: async (deviceId) => {
    const [voiceRes, sfxRes] = await Promise.all([
      voiceChat.setOutputDevice(deviceId),
      sfx.setOutputDevice(deviceId)
    ]);
    const supported = Boolean(voiceRes?.supported || sfxRes?.supported);
    if (!supported && deviceId) {
      hud?.toast?.('Sortie audio gérée par le système (setSinkId non supporté).', 'info');
    } else {
      hud?.toast?.(
        deviceId ? '🔊 Sortie audio mise à jour.' : '🔊 Sortie audio système par défaut.',
        'success'
      );
    }
  },
  onAudioMicTestToggle: () => {
    if (voiceChat.meterActive) {
      voiceChat.stopMicTest();
    } else {
      voiceChat.startMicTest();
    }
  },
  onSampleMicLevel: () => voiceChat.sampleMicLevel(),
  onDebugToggleVrPanel: () => vrManager?.toggleDebugPanel?.(),
  onApplaud: () => {
    const cheers = [
      '👏🎉 Bravo Dieu CIEL 20/20 ! ⚡',
      '👏🔥 GG Ascension 20/20 ! ✨',
      '🥳👏 Félicitations 20/20 ! 🎉',
      '🏆👏 Masterclass CIEL 20/20 ! ✨'
    ];
    const label = cheers[Math.floor(Math.random() * cheers.length)];
    network.sendEmote('applaud', label);
    showSpeechBubble(localBubble, label, { isEmote: true, color: '#fbbf24' });
  },
  onSelectAscensionSpecialty: (specialtyId) => {
    handleLocalSpecialtyChoice(specialtyId);
  },
  onTriggerCreatorCelebration: () => {
    const sent = network.sendCreatorCelebration('oscilloscope', 'Excellence BAC PRO CIEL 3D', false);
    if (!sent) {
      runWorldCelebration({
        playerName: gameState.profile.name,
        tpLabel: 'Excellence BAC PRO CIEL 3D',
        reason: 'creator'
      });
    }
    hud?.toast?.('👑 Cinématique d’Ascension 20/20 déclenchée pour la classe !', 'success');
  },
  onToggleCreatorAura: (enabled) => {
    const nextSkin = { ...gameState.skin };
    if (enabled) {
      nextSkin.creatorAura = true;
    } else {
      delete nextSkin.creatorAura;
    }
    gameState.setSkin(nextSkin);
    localAvatar?.setCreatorAura?.(enabled);
    network.sendCreatorAura(enabled);
    network.sendSkinUpdate(nextSkin);
    if (enabled && gameState.cameraMode === 'first' && !vrManager?.isVrActive?.()) {
      gameState.setCameraMode('third');
      player.setCameraMode('third');
      hud?.syncCameraUi?.();
      touchControls?.syncCameraMode?.('third');
    }
    hud?.toast?.(
      enabled
        ? '👑 Aura Lumineuse Dorée 3D activée et synchronisée en multijoueur !'
        : '👑 Aura Lumineuse Dorée 3D désactivée.'
    );
  },
  onDebugCelebrate: () => {
    const sent = network.sendDebugAction('celebrate', { tpId: 'oscilloscope' });
    if (!sent) {
      runWorldCelebration({
        playerName: gameState.profile.name,
        tpLabel: 'Oscilloscope & Diagnostic 3D',
        reason: 'debug'
      });
    }
  },
  onDebugValidateAll: () => {
    const nextGrades = { ...gameState.profile.grades };
    getDynamicAllTps().forEach((tp) => {
      nextGrades[tp.id] = 20;
    });
    const nextProfile = {
      ...gameState.profile,
      grades: nextGrades,
      average: 20,
      completedCount: TP_CATALOG.length,
      diplomaEarned: true,
      xp: Math.max((gameState.profile.xp || 0) + 1750, 3150),
      questAccepted: true
    };
    gameState.setProfile(nextProfile);
    lab.updateStationBadges(nextGrades);
    const sent = network.sendDebugAction('validate_all');
    if (!sent) {
      runWorldCelebration({
        playerName: gameState.profile.name,
        tpId: 'oscilloscope',
        reason: 'all_tps_20'
      });
      fetch('/api/debug/validate-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: gameState.profile.name,
          skin: gameState.skin,
          triggerCelebration: true
        })
      }).catch(() => {});
    }
    if (gameState.isAuthenticated()) {
      network.saveAccount({
        tpScores: nextGrades,
        unlockedDivineSkins: gameState.unlockedDivineSkins,
        selectedSkin: getSelectedSkinIdFromSkin(gameState.skin),
        avatarCustomization: gameState.skin
      });
    }
    hud?.toast?.('💯 Tous les TPs ont été validés à 20/20 (Mode Debug) !', 'success');
  },
  onDebugResetProgress: () => {
    sessionDivineSpecialty = null;
    gameState.unlockedDivineSkins = [];
    gameState.secretSkinUnlocked = false;
    gameState.prestigeCount = 0;
    gameState.equipDivineSkin(null);
    endAscensionCinematic();
    hud?.hideIntroCinematic?.();
    hud?.hideAscensionDialogue?.();
    hud?.hideWorldCelebration?.();
    hud?.hideSecretSkinAnnouncement?.();
    rebuildLocalAvatar(gameState.skin);
    const resetProfile = {
      ...gameState.profile,
      unlockedDivineSkins: [],
      secretSkinUnlocked: false,
      prestigeCount: 0,
      selectedSkin: 'standard',
      grades: {},
      average: null,
      completedCount: 0,
      diplomaEarned: false,
      xp: 0,
      questAccepted: false
    };
    gameState.setProfile(resetProfile);
    lab.updateStationBadges({});
    network.sendDebugAction('reset_progress');
    fetch('/api/debug/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: gameState.profile.name })
    }).catch(() => {});
    hud?.toast?.('🔄 Progression de test réinitialisée à zéro.', 'info');
  },
  onDebugSpeedChange: (mult) => {
    player.setSpeedMultiplier(mult);
    hud?.toast?.(`⚡ Vitesse de déplacement : ${mult}×`);
  },
  onDebugNoclipToggle: (enabled) => {
    player.setNoclip(enabled);
    hud?.toast?.(enabled ? '👻 Mode Noclip activé (traversée des murs)' : '🧱 Collisions standard rétablies');
  },
  onDebugTeleport: (targetVal) => {
    const val = String(targetVal || '');
    if (val.startsWith('tp:')) {
      teleportNearTarget(val.slice(3));
      return;
    }
    if (val.startsWith('zone:')) {
      const code = val.slice(5);
      const mapZone = (currentMapData?.zones || []).find((z) => z.code === code || z.id === code);
      const pos = DEBUG_ZONE_SPOTS[code] || (mapZone ? { x: mapZone.x || 0, z: mapZone.z || 0 } : { x: -3.95, z: 0.65 });
      player.teleportTo(pos, { x: pos.x, z: pos.z - 2 });
      if (vrManager?.isVrActive?.()) {
        vrManager._mountVrRigForWorld?.(vrManager.simMode);
      }
      const zInfo = getZoneAtPositionInMap(currentMapData, pos.x, pos.z);
      hud?.setCurrentZone?.(zInfo);
      network.sendMove(
        pos.x,
        0,
        pos.z,
        player.yaw,
        true,
        vrManager?.isVrActive?.() ? vrManager.getVrSyncPayload() : undefined
      );
      network.sendZone(zInfo.id, zInfo.badgeText.replace('📍 ', ''));
      hud?.toast?.(`📍 Téléporté vers ${zInfo.badgeText}`);
    }
  },
  onReturnToMenu: () => returnToMainMenu(false),
  onLogout: () => {
    returnToMainMenu(true);
    mainMenu?.handleLogout?.();
    hud?.toast?.('🚪 Vous êtes déconnecté de votre compte élève.', 'info');
  }
});

hud?.bindSurvivalHandlers?.({
  onToggleReady: () => toggleSurvivalReady(),
  onLeaveLobby: () => leaveSurvivalLobby(),
  onToggleMic: () => voiceChat.toggleMicrophone(),
  onExitRack: () => toggleHidingInRack(survivalState.hiddenRack),
  onDetentionOption: (idx) => submitDetentionOption(idx),
  onMinimizeDetention: () => minimizeDetentionTerminal(),
  onOpenDetention: () => openDetentionTerminal(),
  onSkipSurvivalIntro: () => finishSurvivalIntroCinematic(),
  onPrevDetentionCamera: () => cycleDetentionCamera(-1),
  onNextDetentionCamera: () => cycleDetentionCamera(1),
  onToggleEndInspect: (compact) => {
    if (survivalState.inDefeatDetention) {
      if (compact) {
        hud?.showDetention3dHud?.(survivalState.activeCameraInfo || {});
      } else {
        hud?.hideDetention3dHud?.();
      }
    }
  },
  onCloseEnd: () => closeSurvivalEndCinematic()
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
  hud?.setVrManager?.(vrManager);
  hud?.syncVrUi?.(vrManager?.getPublicState?.());
} catch (err) {
  console.warn('Contrôles tactiles indisponibles:', err);
}

function returnToMainMenu(isLogout = false) {
  activeCameraTweenId++;
  tpOpenSeqId++;
  if (vrManager?.isVrActive?.()) {
    vrManager.exitVr();
  }
  if (miniGameModal?.backdrop && !miniGameModal.backdrop.classList.contains('hidden')) {
    miniGameModal.close();
  }
  dialogueModal?.close?.();
  if (isLogout) {
    sessionDivineSpecialty = null;
  } else {
    sessionDivineSpecialty = gameState.skin?.secretSkin
      ? ULTIMATE_SECRET_SKIN_ID
      : gameState.skin?.divineSpecialty || null;
  }
  hud?.hideIntroCinematic?.();
  hud?.hideSecretSkinAnnouncement?.();
  endAscensionCinematic();
  resetSurvivalClientFull();
  joined = false;
  modalOpen = false;
  subModalActive = false;
  privateDebugMode = false;
  setDesktopHoveredInteractable?.(null);
  crosshairEl?.classList.remove('interact-ready');
  canvas.style.cursor = '';
  player.setSpeedMultiplier(1);
  player.setNoclip(false);
  vrManager?.setPrivateDebug?.(false);
  hud?.setPrivateDebugMode?.(false);
  voiceChat.setInTp(false);
  voiceChat.disconnect();
  player.setEnabled(false);
  player.setAvatarVisible(false);
  touchControls?.setVisible(false);
  network.disconnect();
  remotePlayers.clearAll();
  rebuildLocalAvatar(gameState.skin);
  player.setAvatarVisible(false);
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
  gameState.room = msg.room || gameState.room;
  gameState.setProfile(msg.profile);
  sessionDivineSpecialty = gameState.skin?.secretSkin
    ? ULTIMATE_SECRET_SKIN_ID
    : gameState.skin?.divineSpecialty || null;
  rebuildLocalAvatar(gameState.skin);
  battlePassModal?.refresh?.();
  mainMenu?.syncAuthUi?.();
  mainMenu?.renderSkinUi?.();
  hud?._refreshInGameSkinUi?.();
  lab.updateStationBadges(msg.profile.grades);
  remotePlayers.setInstanceFilter(null);
  remotePlayers.setPeers(msg.peers);
  gameState.setRoomRoster(msg.roomRoster || []);
  gameState.setLeaderboard(msg.leaderboard || []);
  remotePlayers.syncLeaderboardRanks(msg.leaderboard || []);
  syncWallLeaderboard(msg.leaderboard || []);
  hud.setNetworkStatus({ state: 'connected', connected: true }, msg.onlineCount);
  hud.clearChat();
  (msg.chatHistory || []).forEach((m) => hud.appendChatMessage(m, false));
  voiceChat.onRoomJoined(msg.peers || []);
  if (msg.survivalState) {
    survivalState.snapshot = msg.survivalState;
    survivalState.phase = msg.survivalState.phase || 'idle';
  }
  if (requestedName && msg.profile?.name && requestedName !== msg.profile.name) {
    hud.toast(`Multi-onglet détecté : connecté sous "${msg.profile.name}"`, 'info');
  }
  hud.toast(`Connecté en ${msg.room} (${msg.onlineCount} élève(s) en ligne)`, 'success');
});

network.on('room_switched', (msg) => {
  if (!msg?.room) return;
  gameState.room = msg.room;
  if (msg.survivalState) {
    survivalState.snapshot = msg.survivalState;
    survivalState.phase = msg.survivalState.phase || 'idle';
  }
  if (!isSurvivalInstanceRoom(msg.room)) {
    remotePlayers.setInstanceFilter(null);
    if (survivalState.phase === 'ended' || survivalState.inDefeatDetention) {
      closeSurvivalEndCinematic({ skipSendReturn: true });
    }
  }
  remotePlayers.setPeers(msg.peers || []);
  remotePlayers.syncLeaderboardRanks(gameState.leaderboard || []);
  gameState.setRoomRoster(msg.roomRoster || []);
  hud.setNetworkStatus({ state: 'connected', connected: true }, msg.onlineCount);
  hud.clearChat();
  (msg.chatHistory || []).forEach((m) => hud.appendChatMessage(m, false));
  voiceChat.onRoomJoined(msg.peers || []);
  if (survivalState.inWaitingRoom && msg.survivalState) {
    survivalArena.updateWaitingBoard(msg.survivalState, true);
    syncSurvivalPanelMode();
  }
  syncVrWatchHud();
  if (isSurvivalInstanceRoom(msg.room)) {
    hud.toast('🔒 Instance Survie isolée prête (participants uniquement).', 'info');
  } else {
    hud.toast(`🏫 Retour dans la salle principale ${msg.room} !`, 'success');
  }
});

network.on('profile_updated', ({ profile }) => {
  gameState.setProfile(profile);
  sessionDivineSpecialty = gameState.skin?.secretSkin
    ? ULTIMATE_SECRET_SKIN_ID
    : gameState.skin?.divineSpecialty || null;
  rebuildLocalAvatar(gameState.skin);
  lab.updateStationBadges(profile.grades);
  battlePassModal?.refresh?.();
  mainMenu?.syncAuthUi?.();
  mainMenu?.renderSkinUi?.();
  hud?._refreshInGameSkinUi?.();
  hud?.refresh?.();
  syncWallLeaderboard();
  syncVrWatchHud();
});

network.on('profile_reset', ({ profile, message }) => {
  sessionDivineSpecialty = null;
  gameState.unlockedDivineSkins = [];
  gameState.secretSkinUnlocked = false;
  gameState.prestigeCount = 0;
  gameState.equipDivineSkin(null);
  endAscensionCinematic();
  hud?.hideIntroCinematic?.();
  hud?.hideAscensionDialogue?.();
  hud?.hideWorldCelebration?.();
  hud?.hideSecretSkinAnnouncement?.();
  gameState.setProfile(profile);
  rebuildLocalAvatar(gameState.skin);
  battlePassModal?.refresh?.();
  mainMenu?.syncAuthUi?.();
  mainMenu?.renderSkinUi?.();
  hud?._refreshInGameSkinUi?.();
  lab.updateStationBadges(profile.grades);
  refreshWallLeaderboard();
  syncVrWatchHud();
  hud.toast(message || 'Votre progression a été réinitialisée par l’administrateur.', 'error');
});

network.on('map_updated', ({ map }) => {
  if (!map) return;
  applyMapData(map, true);
  hud?.toast?.('🗺️ Carte mise à jour en direct par l’administrateur !', 'success');
});

network.on('account_deleted', ({ message }) => {
  network.logoutAccount();
  gameState.clearAccount();
  returnToMainMenu(true);
  hud.toast(message || 'Votre compte a été supprimé par l’administrateur.', 'error');
});

network.on('score_recorded', (res) => {
  gameState.setProfile(res.profile);
  lab.updateStationBadges(res.profile.grades);
  refreshWallLeaderboard();
  syncVrWatchHud();
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

network.on('creator_aura_updated', ({ id, enabled }) => {
  if (id === network.clientId) {
    localAvatar?.setCreatorAura?.(enabled);
  } else {
    remotePlayers.setCreatorAura(id, enabled);
  }
});

network.on('world_celebration', (payload) => {
  runWorldCelebration(payload);
  if (payload?.playerId && payload.playerId !== network.clientId) {
    remotePlayers.showBubble(payload.playerId, '🏆 20/20 INTÉGRAL ! 🎉', {
      isEmote: true,
      color: '#fbbf24'
    });
  }
});

network.on('world_ascension', (payload) => {
  runAscensionPhase(payload);
});

network.on('secret_skin_unlocked', (payload) => {
  sfx.playSecretUnlockFanfare?.();
  hud?.showSecretSkinAnnouncement?.(payload);
  const isMe = Boolean(
    (payload?.playerId && network.clientId && payload.playerId === network.clientId) ||
      (payload?.playerName &&
        payload.playerName.toLowerCase() === gameState.profile.name?.toLowerCase())
  );
  if (isMe) {
    gameState.secretSkinUnlocked = true;
    gameState.profile = { ...gameState.profile, secretSkinUnlocked: true };
    if (gameState.account) {
      gameState.account = { ...gameState.account, secretSkinUnlocked: true };
    }
    mainMenu?.renderSkinUi?.();
    if (vrManager?.isVrActive?.()) {
      vrManager.setSkin(getEffectiveSessionSkin(gameState.skin));
      vrManager.updateWorldSpatialPanel?.({
        ascension: vrManager.worldPanel?.getState?.()?.ascension
          ? { ...vrManager.worldPanel.getState().ascension, secretSkinUnlocked: true }
          : undefined
      });
      syncVrWatchHud({ targetHint: '🌌 SKIN SECRET ULTIME DÉBLOQUÉ !' });
    }
    hud?.toast?.('🌌 SKIN SECRET ULTIME débloqué dans votre casier !', 'success');
    showSpeechBubble(localBubble, '🌌 SKIN SECRET ULTIME ! 🌌', {
      isEmote: true,
      color: '#e879f9'
    });
  } else if (payload?.playerId) {
    remotePlayers.showBubble(payload.playerId, '🌌 SKIN SECRET ULTIME ! 🌌', {
      isEmote: true,
      color: '#e879f9'
    });
  }
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

network.on('survival_state', ({ state }) => {
  if (!state) return;
  survivalState.snapshot = state;
  survivalState.phase = state.phase || 'idle';
  if (survivalState.inWaitingRoom && state.phase !== 'active') {
    survivalArena.updateWaitingBoard(state, true);
    if (vrManager?.isVrActive?.()) {
      vrManager.updateWorldSpatialPanel?.({ survivalLobby: buildVrLobbyState(state) });
    } else if (survivalState.lobbyModalOpen) {
      hud?.showSurvivalLobby?.(state, network.clientId, Boolean(latestVoiceState.micEnabled));
    }
  }
});

network.on('survival_started', ({ state }) => {
  if (!state) return;
  startSurvivalMatchClient(state);
});

network.on('survival_tick', ({ state }) => {
  if (!state) return;
  survivalState.snapshot = state;
  survivalState.phase = state.phase || 'active';
  if (survivalState.inActiveMatch && state.ai && !survivalState.introActive) {
    horrorTeacher.setTargetState({
      x: state.ai.x,
      z: state.ai.z,
      yaw: state.ai.yaw,
      state: state.ai.state
    });
    if (state.ai.state === 'chase' && survivalState.aiPrevState !== 'chase') {
      sfx.playHorrorAlert?.();
    }
    survivalState.aiPrevState = state.ai.state;
  }
});

network.on('survival_noise_alert', ({ playerId, playerName, severity, state }) => {
  if (state) survivalState.snapshot = state;
  if (!survivalState.inActiveMatch) return;
  if (playerId === network.clientId) {
    hud?.toast?.(
      severity === 'scream'
        ? '🔊 CRI DÉTECTÉ ! Le Professeur CIEL fonce vers vous à travers les murs !'
        : '👂 Bruit détecté au micro : le Professeur CIEL approche !',
      'error'
    );
  } else if (playerName) {
    hud?.toast?.(`⚠️ ${playerName} a fait du bruit au micro (${severity}) !`, 'info');
  }
});

network.on('survival_caught', ({ playerId, playerName, state }) => {
  if (state) survivalState.snapshot = state;
  if (!survivalState.inActiveMatch) return;
  if (playerId === network.clientId) {
    triggerLocalCaughtJumpscare(state);
  } else if (playerName) {
    hud?.toast?.(`☠️ ${playerName} a été attrapé par le Professeur CIEL et envoyé en Heure de Colle !`, 'error');
  }
});

network.on('survival_tp_completed', ({ tpId, playerName, state }) => {
  if (state) survivalState.snapshot = state;
  if (!survivalState.inActiveMatch) return;
  const doneCnt = state?.completedTps?.length || 0;
  const totalCnt = state?.requiredTps?.length || TP_CATALOG.length;
  if (tpId && !survivalState.announcedTps.has(tpId)) {
    survivalState.announcedTps.add(tpId);
    sfx.success?.();
    hud?.toast?.(`✅ ${playerName || 'Un élève'} a validé un TP Survie (${doneCnt}/${totalCnt}) !`, 'success');
  }
});

network.on('survival_detention_pulse', ({ playerName, state }) => {
  if (state) survivalState.snapshot = state;
  if (!survivalState.inActiveMatch) return;
  if (!survivalState.detained) {
    hud?.toast?.(`📡 ${playerName || 'Un élève collé'} a résolu un tableau de variation : radar activé !`, 'info');
  }
});

network.on('survival_ended', ({ ended, state }) => {
  endSurvivalMatchClient(ended, state);
});

function interactWith(target) {
  if (!target) return;
  if (target.id === 'teacher') openTeacherDialogue(target.dialogue || '');
  else if (target.type === 'survival_door') enterSurvivalLobby();
  else if (target.type === 'hiding_rack') toggleHidingInRack(target);
  else if (target.type === 'survival_lobby_console') toggleSurvivalReady();
  else if (target.type === 'survival_lobby_exit') leaveSurvivalLobby();
  else if (target.type === 'survival_detention_terminal') openDetentionTerminal();
  else openTp(target.tpId || target.id, target);
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

  if (activeCinematic?.phase === 'intro' && !subModalActive) {
    if (e.code === 'Escape') {
      e.preventDefault();
      endIntroCinematic(true);
      return;
    }
    const onIntroBtn = Boolean(e.target?.closest?.('#intro-cinematic-overlay button'));
    if (!onIntroBtn && (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight')) {
      e.preventDefault();
      sfx.click();
      hud?._stepIntro?.(1);
      return;
    }
    if (!onIntroBtn && e.code === 'ArrowLeft') {
      e.preventDefault();
      sfx.click();
      hud?._stepIntro?.(-1);
      return;
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

  if (joined && !isTyping && isDetentionSeatedActive()) {
    if (e.code === 'ArrowLeft') {
      e.preventDefault();
      cycleDetentionCamera(-1);
      return;
    }
    if (e.code === 'ArrowRight') {
      e.preventDefault();
      cycleDetentionCamera(1);
      return;
    }
    if (e.code.startsWith('Digit') || e.code.startsWith('Numpad')) {
      const optNum = Number(e.code.replace('Digit', '').replace('Numpad', ''));
      if (optNum >= 1 && optNum <= 4) {
        e.preventDefault();
        submitDetentionOption(optNum - 1);
        return;
      }
    }
  }

  if (joined && !isTyping && survivalState.hiddenRack && e.code === 'KeyE' && !e.repeat) {
    e.preventDefault();
    toggleHidingInRack(survivalState.hiddenRack);
    return;
  }

  if (!joined || modalOpen || isTyping || isDetentionSeatedActive() || survivalState.introActive) return;

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
const crosshairEl = document.getElementById('crosshair');
let hoveredInteractable = null;
let lastHoverPollAt = 0;
let lastCursorPos = null;

function getRayHitInteractable(clientX = null, clientY = null) {
  if (!joined || modalOpen || gameState.touchMode || vrManager?.isVrActive?.()) return null;
  if (document.pointerLockElement === canvas || clientX === null || clientY === null) {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), sceneMgr.camera);
  } else {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(ndc, sceneMgr.camera);
  }
  return pickLabInteractable(raycaster, getActiveInteractables(), lab.solidWallMeshes, 7.5);
}

function setDesktopHoveredInteractable(item) {
  const nextItem = item || null;
  if (nextItem === hoveredInteractable) {
    canvas.style.cursor = nextItem && document.pointerLockElement !== canvas ? 'pointer' : '';
    return;
  }
  hoveredInteractable = nextItem;
  lab.setHoveredInteractable?.(hoveredInteractable);
  canvas.style.cursor = hoveredInteractable && document.pointerLockElement !== canvas ? 'pointer' : '';
}

function tryRaycastInteract(clientX, clientY) {
  const item = getRayHitInteractable(clientX, clientY);
  if (!item) return false;
  setDesktopHoveredInteractable(null);
  interactWith(item);
  return true;
}

function pickDetentionSurfaceAt(clientX, clientY) {
  if (!joined || !isDetentionSeatedActive() || vrManager?.isVrActive?.()) return null;
  const surfaces = getActiveWorldSurfaces();
  if (!surfaces.length) return null;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(ndc, sceneMgr.camera);
  let best = null;
  for (const surf of surfaces) {
    if (!surf?.mesh || surf.mesh.visible === false) continue;
    surf.mesh.updateWorldMatrix(true, false);
    const hits = raycaster.intersectObject(surf.mesh, false);
    if (hits.length > 0 && hits[0].uv) {
      const btn = surf.hitTestUv?.(hits[0].uv);
      if (btn && (!best || hits[0].distance < best.distance)) {
        best = { surf, btn, uv: hits[0].uv, distance: hits[0].distance };
      }
    }
  }
  return best;
}

function updateDetentionSurfaceHover(clientX, clientY) {
  const surfaces = getActiveWorldSurfaces();
  const hit = pickDetentionSurfaceAt(clientX, clientY);
  for (const surf of surfaces) {
    surf.setHovered?.(hit && hit.surf === surf ? hit.btn.id : null);
  }
  if (!vrManager?.isVrActive?.() && isDetentionSeatedActive()) {
    canvas.style.cursor = hit ? 'pointer' : '';
  }
  return hit;
}

let downPos = { x: 0, y: 0 };
canvas.addEventListener('mousedown', (e) => {
  downPos = { x: e.clientX, y: e.clientY };
  if (isDetentionSeatedActive() && !vrManager?.isVrActive?.() && e.button === 2) {
    survivalState.detentionDraggingLook = true;
    survivalState.detentionDragLast = { x: e.clientX, y: e.clientY };
    return;
  }
  if (vrManager?.isVrActive?.() && vrManager.simMode && e.button === 0) {
    vrManager.setSimInput({ mouseTrigger: true });
  }
});
canvas.addEventListener('mousemove', (e) => {
  if (isDetentionSeatedActive() && !vrManager?.isVrActive?.()) {
    if (survivalState.detentionDraggingLook) {
      const dx = e.clientX - survivalState.detentionDragLast.x;
      const dy = e.clientY - survivalState.detentionDragLast.y;
      survivalState.detentionDragLast = { x: e.clientX, y: e.clientY };
      survivalState.detentionLookYaw = Math.max(-0.55, Math.min(0.55, survivalState.detentionLookYaw - dx * 0.004));
      survivalState.detentionLookPitch = Math.max(-0.45, Math.min(0.4, survivalState.detentionLookPitch - dy * 0.004));
      applyDetentionPcCamera();
    } else {
      updateDetentionSurfaceHover(e.clientX, e.clientY);
    }
    return;
  }
  if (document.pointerLockElement === canvas) return;
  lastCursorPos = { x: e.clientX, y: e.clientY };
  if (!joined || modalOpen || gameState.touchMode || vrManager?.isVrActive?.()) {
    setDesktopHoveredInteractable(null);
    return;
  }
  setDesktopHoveredInteractable(getRayHitInteractable(e.clientX, e.clientY));
});
canvas.addEventListener('mouseleave', () => {
  lastCursorPos = null;
  survivalState.detentionDraggingLook = false;
  if (!vrManager?.isVrActive?.()) {
    setDesktopHoveredInteractable(null);
  }
});
window.addEventListener('blur', () => {
  lastCursorPos = null;
  survivalState.detentionDraggingLook = false;
  setDesktopHoveredInteractable(null);
});
canvas.addEventListener('contextmenu', (e) => {
  if ((vrManager?.isVrActive?.() && vrManager.simMode) || isDetentionSeatedActive()) {
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
  if (e.button === 2) {
    survivalState.detentionDraggingLook = false;
  }
  if (vrManager?.simMode && e.button === 0) {
    vrManager.setSimInput({ mouseTrigger: false });
  }
});
canvas.addEventListener('mouseup', (e) => {
  if (isDetentionSeatedActive() && !vrManager?.isVrActive?.() && e.button === 0) {
    const dragDist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
    if (dragDist <= 8) {
      const hit = pickDetentionSurfaceAt(e.clientX, e.clientY);
      if (hit?.btn) {
        hit.btn.onClick?.(hit.uv);
      }
    }
    return;
  }
  if (!joined || modalOpen || e.button !== 0 || gameState.touchMode) return;
  if (vrManager?.isVrActive?.() && vrManager.simMode) return;
  const isLocked = document.pointerLockElement === canvas;
  const dragDist = isLocked ? 0 : Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
  if (dragDist > 6) return;

  if (tryRaycastInteract(isLocked ? null : e.clientX, isLocked ? null : e.clientY)) return;

  if (!isLocked) {
    player.requestPointerLock();
  }
});

let lastZoneId = '';
let lastMiniMapDrawAt = 0;
let lastDebugStatsAt = 0;

sceneMgr.addUpdater((dt, elapsed) => {
  lab.update(elapsed, joined ? player.position : null, gameState.profile.diplomaEarned);
  localAvatar?.updateEffects?.(elapsed);
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
  if (vrOn) {
    vrManager.update(dt, elapsed);
  }
  const seatedDet = isDetentionSeatedActive();
  const step = vrOn || activeCinematic || survivalState.introActive || seatedDet ? null : player.update(dt);
  if (seatedDet && !vrOn) {
    applyDetentionPcCamera();
  }
  if (activeCinematic && !vrOn) {
    if (activeCinematic.phase === 'intro') {
      const stepProgress = Math.min(
        1,
        Math.max(0, (performance.now() - activeCinematic.stepStartedAt) / 9500)
      );
      sceneMgr.applyIntroCinematicShot(
        activeCinematic.stepIndex,
        stepProgress,
        elapsed,
        activeCinematic.teacherPos
      );
    } else {
      sceneMgr.applyCinematicShot(
        activeCinematic.phase,
        elapsed,
        activeCinematic.teacherPos,
        activeCinematic.winnerSpot
      );
      if (
        activeCinematic.phase === 'ascension' &&
        !activeCinematic.isWinner &&
        activeCinematic.playerId
      ) {
        remotePlayers.setLevitation(activeCinematic.playerId, sceneMgr.getAscensionLevitation());
      }
    }
  }
  updateVoiceIndicatorSprite(localVoiceIndicator, dt, voiceChat.isSpeaking);
  voiceChat.update(player.position, player.yaw, remotePlayers.peers);
  const currentZone = getZoneAtPositionInMap(currentMapData, player.position.x, player.position.z);
  if (currentZone.id !== lastZoneId) {
    lastZoneId = currentZone.id;
    hud?.setCurrentZone?.(currentZone);
    network.sendZone(currentZone.id, currentZone.badgeText.replace('📍 ', ''));
    if (currentZone.id === 'CHAMBRE' && gameState.hasVipChambreAccess?.()) {
      hud?.toast?.('🔑 Accès VIP Clé Maîtresse — Bienvenue en Chambre Baie Serveur !', 'success');
    }
  }

  if (vrOn) {
    syncVrWatchHud();
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

  if (privateDebugMode && elapsed - lastDebugStatsAt >= 0.15) {
    lastDebugStatsAt = elapsed;
    hud?.updateDebugStats?.({
      fps: sceneMgr.getFps(),
      pingMs: network.lastPingMs,
      pos: player.position,
      socketState: network.getSocketDebugState()
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

    let bestPrimary = null;
    let bestPrimaryDist = Infinity;
    let bestProp = null;
    let bestPropDist = Infinity;
    for (const item of getActiveInteractables()) {
      const dx = player.position.x - item.position.x;
      const dz = player.position.z - item.position.z;
      const d = Math.hypot(dx, dz);
      if (d > item.interactRadius) continue;
      if (item.isProp) {
        if (d < bestPropDist) {
          bestProp = item;
          bestPropDist = d;
        }
      } else if (d < bestPrimaryDist) {
        bestPrimary = item;
        bestPrimaryDist = d;
      }
    }
    const best = bestPrimary || bestProp;
    nearestTarget = best;

    if (!vrOn && !gameState.touchMode && !seatedDet && !survivalState.introActive && elapsed - lastHoverPollAt >= 0.08) {
      lastHoverPollAt = elapsed;
      if (document.pointerLockElement === canvas) {
        setDesktopHoveredInteractable(getRayHitInteractable(null, null));
      } else if (lastCursorPos) {
        setDesktopHoveredInteractable(getRayHitInteractable(lastCursorPos.x, lastCursorPos.y));
      }
    } else if (vrOn || gameState.touchMode || seatedDet || survivalState.introActive) {
      hoveredInteractable = null;
      if (!seatedDet) {
        canvas.style.cursor = '';
      }
    }

    const promptTarget = activeCinematic || seatedDet || survivalState.introActive
      ? null
      : (!vrOn && document.pointerLockElement === canvas && hoveredInteractable)
        ? hoveredInteractable
        : best;
    hud?.setInteractPrompt?.(promptTarget);
    crosshairEl?.classList.toggle('interact-ready', Boolean(!activeCinematic && !seatedDet && !survivalState.introActive && (hoveredInteractable || best)));
    touchControls?.setInteractTarget?.(activeCinematic || seatedDet || survivalState.introActive ? null : best);
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

function startGameSession(
  { name, room, skin, privateDebug = false, forceIntro = false },
  startVr = false
) {
  const cleanRoom = room || 'plateau-u300';
  const isDebugRoom = Boolean(
    privateDebug || String(cleanRoom).toLowerCase().startsWith('priv-debug')
  );
  privateDebugMode = isDebugRoom;
  notifiedNetError = false;
  gameState.room = cleanRoom;
  gameState.setProfile({ ...gameState.profile, name, skin });
  rebuildLocalAvatar(skin);
  joined = true;

  hud.show();
  hud.setPrivateDebugMode(isDebugRoom, cleanRoom);
  vrManager?.setPrivateDebug?.(isDebugRoom);
  hud?.syncDebugVrPanelBtn?.(Boolean(vrManager?.debugOverlayEnabled));
  player.setSpeedMultiplier(1);
  player.setNoclip(false);
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

  const shouldRunIntro =
    !startVr &&
    !isDebugRoom &&
    (Boolean(forceIntro) || (gameState.isAuthenticated() && gameState.account?.introSeen === false));

  if (startVr) {
    vrManager?.enterVr?.();
  } else if (shouldRunIntro) {
    startIntroCinematic(Boolean(forceIntro));
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
  onStartVr: (params) => startGameSession(params, true),
  onAccountRestored: () => {
    sessionDivineSpecialty = gameState.skin?.secretSkin
      ? ULTIMATE_SECRET_SKIN_ID
      : gameState.skin?.divineSpecialty || null;
    rebuildLocalAvatar(gameState.skin);
    battlePassModal?.refresh?.();
    lab.updateStationBadges(gameState.profile.grades);
  },
  onLogout: () => {
    sessionDivineSpecialty = null;
    rebuildLocalAvatar(gameState.skin);
    battlePassModal?.refresh?.();
    lab.updateStationBadges({});
  }
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

(function checkAutoLaunchPrivateDebug() {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search || '');
  const debugFlag = params.get('debug') === '1' || params.get('mode') === 'debug';
  const roomParam = String(params.get('room') || '').trim();
  if (!debugFlag && !roomParam.toLowerCase().startsWith('priv-debug')) return;
  const targetRoom =
    roomParam && roomParam.toLowerCase().startsWith('priv-debug')
      ? roomParam
      : `priv-debug-${Math.random().toString(36).slice(2, 8)}`;
  const savedName =
    params.get('name')?.trim() ||
    localStorage.getItem('ciel_player_name')?.trim() ||
    'Admin_Debug';
  platformModal?.close?.();
  mainMenu?.hide?.();
  startGameSession(
    {
      name: savedName,
      room: targetRoom,
      skin: gameState.skin,
      privateDebug: true
    },
    false
  );
  setTimeout(() => {
    hud?.toast?.('🛠️ Serveur Privé (Mode Debug) actif — Salon isolé des élèves publics', 'success');
  }, 350);
})();
