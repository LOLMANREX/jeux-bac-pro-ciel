import './styles/main.css';
import './styles/minigames.css';

import * as THREE from 'three';
import { sfx } from './core/audio.js';
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
import { PlayerController } from './world/PlayerController.js';
import {
  createSpeechBubble,
  RemotePlayersManager,
  showSpeechBubble,
  updateSpeechBubble
} from './world/RemotePlayers.js';
import {
  applySessionDivineSkin,
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
  getOccluders: () => lab.solidWallMeshes,
  getNearestInteractable: () => nearestTarget,
  onHoverInteractable: (item) => lab.setHoveredInteractable?.(item),
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
let privateDebugMode = false;
let lastCelebrationAt = 0;

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
          sfx.playSecretUnlockFanfare?.();
          hud?.showSecretSkinAnnouncement?.({
            playerName,
            bannerText: formatSecretSkinAnnouncement(playerName)
          });
        }
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

  if (miniGameModal?.backdrop && !miniGameModal.backdrop.classList.contains('hidden')) {
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
    localAvatar.setFirstPersonVrHidden?.(false);
  }
  if (!vrManager?.isVrActive?.()) {
    sceneMgr.applyCinematicShot('dialogue', sceneMgr.clock.elapsedTime, teacherPos, winnerSpot);
  }

  sfx.interact();
  hud?.showAscensionDialogue?.({
    ...payload,
    playerName,
    isWinner,
    choiceTimeoutMs: payload.choiceTimeoutMs || 15000,
    defaultSpecialty: payload.tpId || 'cyber',
    onTimeout: (fallbackSpec) => {
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

      const allTpsAt20 = hasAllTpsAt20(p.grades, allTps);
      const firstTimeAllAt20 = !wasAllAt20 && allTpsAt20;
      network.submitScore(gameState.profile.name, doneId, safeScore, durationSec, gameState.skin);
      network.saveAccount({
        tpScores: p.grades,
        unlockedDivineSkins: gameState.unlockedDivineSkins,
        selectedSkin: gameState.skin?.secretSkin
          ? ULTIMATE_SECRET_SKIN_ID
          : gameState.skin?.divineSpecialty || 'standard',
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
    const selectedId = skin?.secretSkin
      ? ULTIMATE_SECRET_SKIN_ID
      : skin?.divineSpecialty || 'standard';
    sessionDivineSpecialty = selectedId === 'standard' ? null : selectedId;
    rebuildLocalAvatar(skin);
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
        selectedSkin: gameState.skin?.secretSkin
          ? ULTIMATE_SECRET_SKIN_ID
          : gameState.skin?.divineSpecialty || 'standard',
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
      const zInfo = getZoneAtPositionInMap(currentMapData, pos.x, pos.z);
      hud?.setCurrentZone?.(zInfo);
      network.sendMove(pos.x, 0, pos.z, player.yaw, true);
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
  joined = false;
  modalOpen = false;
  subModalActive = false;
  privateDebugMode = false;
  setDesktopHoveredInteractable?.(null);
  crosshairEl?.classList.remove('interact-ready');
  canvas.style.cursor = '';
  player.setSpeedMultiplier(1);
  player.setNoclip(false);
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
  sessionDivineSpecialty = gameState.skin?.secretSkin
    ? ULTIMATE_SECRET_SKIN_ID
    : gameState.skin?.divineSpecialty || null;
  rebuildLocalAvatar(gameState.skin);
  lab.updateStationBadges(profile.grades);
  mainMenu?.renderSkinUi?.();
  hud?.refresh?.();
  syncWallLeaderboard();
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
  network.logoutAccount();
  gameState.clearAccount();
  returnToMainMenu(true);
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

function interactWith(target) {
  if (!target) return;
  if (target.id === 'teacher') openTeacherDialogue(target.dialogue || '');
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
  return pickLabInteractable(raycaster, lab.interactables, lab.solidWallMeshes, 7.5);
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

let downPos = { x: 0, y: 0 };
canvas.addEventListener('mousedown', (e) => {
  downPos = { x: e.clientX, y: e.clientY };
  if (vrManager?.isVrActive?.() && vrManager.simMode && e.button === 0) {
    vrManager.setSimInput({ mouseTrigger: true });
  }
});
canvas.addEventListener('mousemove', (e) => {
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
  if (!vrManager?.isVrActive?.()) {
    setDesktopHoveredInteractable(null);
  }
});
window.addEventListener('blur', () => {
  lastCursorPos = null;
  setDesktopHoveredInteractable(null);
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
  const step = vrOn || activeCinematic ? null : player.update(dt);
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
    for (const item of lab.interactables) {
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

    if (!vrOn && !gameState.touchMode && elapsed - lastHoverPollAt >= 0.08) {
      lastHoverPollAt = elapsed;
      if (document.pointerLockElement === canvas) {
        setDesktopHoveredInteractable(getRayHitInteractable(null, null));
      } else if (lastCursorPos) {
        setDesktopHoveredInteractable(getRayHitInteractable(lastCursorPos.x, lastCursorPos.y));
      }
    } else if (vrOn || gameState.touchMode) {
      hoveredInteractable = null;
      canvas.style.cursor = '';
    }

    const promptTarget = activeCinematic
      ? null
      : (!vrOn && document.pointerLockElement === canvas && hoveredInteractable)
        ? hoveredInteractable
        : best;
    hud?.setInteractPrompt?.(promptTarget);
    crosshairEl?.classList.toggle('interact-ready', Boolean(!activeCinematic && (hoveredInteractable || best)));
    touchControls?.setInteractTarget?.(activeCinematic ? null : best);
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
    lab.updateStationBadges(gameState.profile.grades);
  },
  onLogout: () => {
    sessionDivineSpecialty = null;
    rebuildLocalAvatar(gameState.skin);
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
