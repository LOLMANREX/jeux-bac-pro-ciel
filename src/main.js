import './styles/main.css';
import './styles/minigames.css';
import './styles/tablet.css';

import * as THREE from 'three';
import { sfx } from './core/audio.js';
import { getBattlePassSkinId } from './core/battlePassSkins.js';
import {
  detectDeviceProfile,
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
import { SceneManager, computeAscensionGatheringLayout, computeZoneVisibility, pickLabInteractable } from './world/SceneManager.js';
import {
  createDefaultMap,
  formatFloorShortLabel,
  getDynamicMapColliders,
  getStationTeleportInMap,
  getZoneAtPositionInMap,
  normalizeMapData
} from './world/mapSchema.js';
import { buildLabWorld } from './world/LabBuilder.js';
import { createHorrorTeacher } from './world/NpcTeacher.js';
import { computeSurvivalIntroShot, createSurvivalPocketRooms } from './world/SurvivalArena3D.js';
import {
  SURVIVAL_MIN_PLAYERS,
  computeRackExitPosition,
  computeRackInteriorPosition,
  resolveSurvivalIntroPlacement
} from './world/SurvivalEngine.js';
import { createCombatPocketRooms } from './world/CombatArena3D.js';
import {
  animateCombatWeaponMesh,
  buildCombatWeaponMesh,
  createCombatVfxPool,
  getCombatWeaponById,
  getDefaultWeaponForMode,
  getWeaponsByMode
} from './world/CombatWeapons.js';
import { PlayerController } from './world/PlayerController.js';
import { METAL_PIPE, computeLaunchVelocity, computeTumble } from './core/metalPipe.js';
import { MetalPipeImpactFx, buildMetalPipeBatMesh } from './world/MetalPipeBat.js';
import { buildPetMesh } from './world/PetBuilder.js';
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
  DEFAULT_SKIN,
  disposeObject3D,
  isCreatorLouis,
  resolveAscensionSpecialty,
  ULTIMATE_SECRET_SKIN_ID,
  updateVoiceIndicatorSprite
} from './world/AvatarBuilder.js';
import {
  getShopItemById,
  isShopAccessoryId,
  isShopPetId,
  isShopSkinId
} from './world/ShopCatalog.js';
import {
  createJpoRoomMap,
  createJpoVisitorName,
  createKioskIdleController,
  getJpoMissionBriefing,
  getJpoRoomConfig,
  isJpoActive,
  isJpoRoomActive,
  JPO_AUTO_START_TP,
  JPO_DEMO_COINS,
  JPO_KIOSK_IDLE_MS,
  readJpoConfig,
  resolveJpoSpawnPose,
  shouldShowJpoWelcome
} from './core/jpoConfig.js';
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
import { buildShopViewModel, ShopModal } from './ui/ShopModal.js';
import { buildLockerViewModel, LockerModal } from './ui/LockerModal.js';
import { TabletOS, shouldHandleTabShortcut } from './ui/TabletOS.js';
import { JpoBriefingModal } from './ui/JpoBriefingModal.js';
import { JpoWelcomeModal } from './ui/JpoWelcomeModal.js';
import { MiniGameModal } from './minigames/MiniGameModal.js';
import { getCielOsTouchLayout } from './minigames/TouchTpHelpers.js';
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
import { createJpoAudiovisuelGame } from './minigames/JpoAudiovisuelGame.js';

const MINIGAME_FACTORIES = {
  oscilloscope: createOscilloscopeGame,
  soldering: createSolderingGame,
  electronics: createElectronicsGame,
  antivirus: createAntivirusGame,
  vmvlan: createVlanConfigGame,
  patchrack: createPatchPanelGame,
  hardware: createPcHardwareGame,
  audiovisual: (api) => (api?.isJpo ? createJpoAudiovisuelGame(api) : createDmxLightingGame(api)),
  studio: createStudioRegieGame
};

function getDynamicAllTps() {
  return getAllTps().filter((item) => Boolean(MINIGAME_FACTORIES[item.id]));
}

const extraStationGrades = {};

const gameState = new GameState();
const network = new NetworkClient();

const canvas = document.getElementById('game-canvas');
const initialDeviceProfile = detectDeviceProfile();
const lowResWorld = Boolean(initialDeviceProfile.isMobile || initialDeviceProfile.isVr);
const sceneMgr = new SceneManager(canvas, { deviceProfile: initialDeviceProfile, quality: gameState.quality });
sceneMgr.setDeviceProfile(initialDeviceProfile);
sceneMgr.setAutoFpsGuard(gameState.autoFpsGuard !== false);
sceneMgr.setQuality(gameState.quality);
sceneMgr.setFov(gameState.fov);

const initialPrivateDebugRequested = (() => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search || '');
  const debugFlag = params.get('debug') === '1' || params.get('mode') === 'debug';
  const roomParam = String(params.get('room') || '').trim();
  return Boolean(debugFlag || roomParam.toLowerCase().startsWith('priv-debug'));
})();
const initialJpoConfig = readJpoConfig();
const initialJpoActive = Boolean(!initialPrivateDebugRequested && isJpoRoomActive(initialJpoConfig.room));
let currentMapData = initialJpoActive ? createJpoRoomMap(initialJpoConfig.room) : createDefaultMap();
let standardMapData = initialJpoActive ? null : currentMapData;
const lab = buildLabWorld(sceneMgr.scene, currentMapData, {
  maxAnisotropy: sceneMgr.getMaxAnisotropy(),
  lowRes: lowResWorld,
  skipCombatFallback: initialJpoActive
});
const survivalArena = createSurvivalPocketRooms(sceneMgr.scene, currentMapData);
const combatArena = createCombatPocketRooms(sceneMgr.scene, { lowRes: lowResWorld });
const combatVfx = createCombatVfxPool(sceneMgr.scene);
const combatViewWeaponRoot = new THREE.Group();
combatViewWeaponRoot.visible = false;
sceneMgr.scene.add(combatViewWeaponRoot);
const combatViewWeaponHolder = new THREE.Group();
combatViewWeaponHolder.position.set(0.24, -0.21, -0.44);
combatViewWeaponRoot.add(combatViewWeaponHolder);
const _combatRayOrigin = new THREE.Vector3();
const _combatRayDir = new THREE.Vector3();
const _combatMuzzleWorld = new THREE.Vector3();
const horrorTeacher = createHorrorTeacher(sceneMgr.scene, { visible: false });
sceneMgr.updateWorldBounds(currentMapData.bounds);

let activeWorldMode = 'hall';
function applyActiveZoneCulling(mode = 'hall') {
  activeWorldMode = mode || 'hall';
  const vis = computeZoneVisibility(activeWorldMode);
  lab.setVisible?.(vis.labVisible);
  combatArena.setZoneVisibility?.(vis.combatZone);
  survivalArena.setZoneVisibility?.(vis.survivalZone);
  sceneMgr.requestShadowUpdate?.();
}

let effectiveQualityTier = gameState.quality || 'high';
const _cullPlayerPosScratch = { x: 0, y: 0, z: 0 };
const _cullOptsScratch = { currentFloor: 0, isVr: false, quality: effectiveQualityTier };
const _petOwnerPosScratch = { x: 0, y: 0, z: 0 };
const _nearbyInteractScratch = [];
const _nearbyOccluderScratch = [];
const _vrInteractScratch = [];
const _vrOccluderScratch = [];
const _nearbySurfacesScratch = [];

sceneMgr.onQualityChange((q) => {
  effectiveQualityTier = q.effectiveQuality || 'balanced';
  lab.setQualityProfile?.({
    textureThrottleMult: q.textureThrottleMult,
    lowResPc: q.isMobile || q.isVr || effectiveQualityTier === 'potato' || effectiveQualityTier === 'eco',
    tier: effectiveQualityTier
  });
  combatVfx.setParticleScale?.(q.particleScale);
});
sceneMgr.setQuality(gameState.quality);
sceneMgr.precompileShaders();
applyActiveZoneCulling('hall');

const player = new PlayerController(sceneMgr.camera, canvas, lab.colliders, {
  onJump: () => sfx.jump()
});
player.setWalkableSurfaces?.(lab.walkableSurfaces);
player.setSpatialHash?.(lab.spatialHash);
player.setBounds(currentMapData.bounds);
player.setSensitivity(gameState.mouseSens);
player.setTouchSensitivity(gameState.touchSens);
player.setCameraMode(gameState.cameraMode);
player.setTouchMode(gameState.touchMode);

let joined = false;
let localAvatar = null;
const metalPipe = {
  equipped: false,
  localObj: null,
  viewRoot: new THREE.Group(),
  viewHolder: new THREE.Group(),
  viewObj: null,
  swingUntil: 0,
  launch: null,
  lastSeed: null,
  lastAttackAt: 0
};
metalPipe.viewRoot.visible = false;
metalPipe.viewRoot.add(metalPipe.viewHolder);
sceneMgr.scene.add(metalPipe.viewRoot);
const metalPipeFx = new MetalPipeImpactFx(sceneMgr.scene);
let localPet = null;
let localPetId = null;
const localBubble = createSpeechBubble(2.94);
const localVoiceIndicator = createVoiceIndicatorSprite(2.78);

let vrManager = null;
let latestVoiceState = {};
let sessionDivineSpecialty = null;
let activeCinematic = null;
const vrCoinGainState = { amount: 0, until: 0 };

function syncLocalPet(rawPetId) {
  const nextId = isShopPetId(rawPetId) ? rawPetId : null;
  if (localPetId === nextId && Boolean(localPet) === Boolean(nextId)) {
    return;
  }
  if (localPet) {
    if (localPet.group) {
      sceneMgr.scene.remove(localPet.group);
    }
    localPet.dispose?.();
    localPet = null;
  }
  localPetId = nextId;
  if (nextId) {
    localPet = buildPetMesh(nextId);
    localPet.snapToOwner(player.position, player.yaw);
    localPet.group.visible = joined;
    sceneMgr.scene.add(localPet.group);
  }
}

function getSelectedSkinIdFromSkin(skin = gameState.skin) {
  if (skin?.secretSkin) return ULTIMATE_SECRET_SKIN_ID;
  if (skin?.divineSpecialty) return skin.divineSpecialty;
  if (skin?.battlePassTier) return getBattlePassSkinId(skin.battlePassTier);
  if (skin?.shopSkinId) return skin.shopSkinId;
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
  metalPipe.localObj = null;
  refreshMetalPipeLocal();
  vrManager?.setSkin?.(effectiveSkin);
  syncLocalPet(effectiveSkin?.equippedPet || gameState.equippedPet || null);
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
let jpoBriefingModal = null;
let jpoWelcomeModal = null;
let changelogModal = null;
let faqModal = null;
let battlePassModal = null;
let shopModal = null;
let lockerModal = null;
let tabletOS = null;
let activeCampusWaypoint = null;
let lastTabletMapSyncAt = 0;
let vrShopCategory = 'skins';
let vrShopSelectedId = null;
let vrShopFeedback = null;
let vrLockerCategory = 'skins';
let vrLockerFilter = 'all';
let vrLockerSelectedId = null;
let vrLockerFeedback = null;
let lastCoinDedupKey = '';
let lastCoinDedupAt = 0;

const jpoState = {
  roomId: 'standard',
  roomConfig: null,
  kiosk: false,
  demoCoins: 0,
  hasMovedSinceSpawn: false,
  idleController: null,
  idleDisplayTimer: null,
  activityBound: false,
  lastMoveTouchAt: 0
};

function isJpoDemoActive() {
  return Boolean(jpoState.roomConfig && isJpoRoomActive(jpoState.roomId));
}

function handleJpoUserActivity(isPointerMove = false) {
  jpoState.hasMovedSinceSpawn = true;
  if (!jpoState.kiosk || !jpoState.idleController) return;
  if (isPointerMove) {
    const now = Date.now();
    if (now - jpoState.lastMoveTouchAt < 500) return;
    jpoState.lastMoveTouchAt = now;
  }
  jpoState.idleController.touch();
  hud?.setJpoIdleCountdown?.(null);
}

const onJpoActivityImmediate = () => handleJpoUserActivity(false);
const onJpoActivityMove = () => handleJpoUserActivity(true);

function bindKioskActivityListeners() {
  if (jpoState.activityBound || typeof window === 'undefined') return;
  jpoState.activityBound = true;
  window.addEventListener('pointerdown', onJpoActivityImmediate, { passive: true, capture: true });
  window.addEventListener('keydown', onJpoActivityImmediate, { passive: true, capture: true });
  window.addEventListener('touchstart', onJpoActivityImmediate, { passive: true, capture: true });
  window.addEventListener('wheel', onJpoActivityImmediate, { passive: true, capture: true });
  window.addEventListener('pointermove', onJpoActivityMove, { passive: true, capture: true });
}

function unbindKioskActivityListeners() {
  if (!jpoState.activityBound || typeof window === 'undefined') return;
  jpoState.activityBound = false;
  window.removeEventListener('pointerdown', onJpoActivityImmediate, { capture: true });
  window.removeEventListener('keydown', onJpoActivityImmediate, { capture: true });
  window.removeEventListener('touchstart', onJpoActivityImmediate, { capture: true });
  window.removeEventListener('wheel', onJpoActivityImmediate, { capture: true });
  window.removeEventListener('pointermove', onJpoActivityMove, { capture: true });
}

function stopKioskMode() {
  if (jpoState.idleDisplayTimer) {
    clearInterval(jpoState.idleDisplayTimer);
    jpoState.idleDisplayTimer = null;
  }
  jpoState.idleController?.stop?.();
  jpoState.idleController = null;
  unbindKioskActivityListeners();
  hud?.setJpoIdleCountdown?.(null);
}

function startKioskMode() {
  stopKioskMode();
  if (!jpoState.kiosk) return;
  bindKioskActivityListeners();
  jpoState.idleController = createKioskIdleController({
    timeoutMs: JPO_KIOSK_IDLE_MS,
    onTimeout: () => {
      if (joined && jpoState.kiosk && !jpoWelcomeModal?.isOpen?.()) {
        resetJpoVisit('inactivity');
      }
    }
  });
  jpoState.idleController.start();
  jpoState.idleDisplayTimer = setInterval(() => {
    if (!joined || !jpoState.kiosk || !jpoState.idleController || jpoWelcomeModal?.isOpen?.()) {
      hud?.setJpoIdleCountdown?.(null);
      return;
    }
    const sec = Math.ceil(jpoState.idleController.getRemainingMs() / 1000);
    hud?.setJpoIdleCountdown?.(sec <= 15 && sec > 0 ? sec : null);
  }, 1000);
}

function openJpoWelcomeOverlay(roomId) {
  if (!shouldShowJpoWelcome(roomId) || !jpoWelcomeModal) return false;
  if (typeof document !== 'undefined' && document.pointerLockElement) {
    document.exitPointerLock?.();
  }
  setModalActive(true, false, true);
  return jpoWelcomeModal.open(roomId, {
    onPlay: () => {
      setModalActive(false, false, false);
      jpoState.idleController?.touch?.();
      hud?.setJpoIdleCountdown?.(null);
      if (!gameState.touchMode && !vrManager?.isVrActive?.()) {
        try {
          player.requestPointerLock?.();
        } catch {}
      }
      if (jpoState.roomConfig) {
        hud?.toast?.(
          `${jpoState.roomConfig.icon} ${jpoState.roomConfig.label} — Approchez-vous du poste et appuyez sur [E] pour démarrer l'activité !`,
          'success'
        );
      }
    }
  });
}

function openJpoFeaturedTp() {
  const tpId = jpoState.roomConfig?.tpId;
  if (!tpId || !joined) return;
  if (jpoWelcomeModal?.isOpen?.()) return;
  if (jpoBriefingModal?.isOpen?.()) return;
  if (miniGameModal?.backdrop && !miniGameModal.backdrop.classList.contains('hidden')) {
    return;
  }
  const stationItem =
    (lab?.interactables || []).find((it) => it && (it.tpId === tpId || it.id === tpId)) || null;
  openTp(tpId, stationItem);
}

function resetJpoVisit(reason = 'manual') {
  jpoWelcomeModal?.close?.();
  jpoBriefingModal?.close?.();
  activeCameraTweenId++;
  tpOpenSeqId++;
  if (typeof document !== 'undefined' && document.pointerLockElement) {
    document.exitPointerLock?.();
  }
  tabletOS?.close?.({ restoreControls: false });
  shopModal?.close?.();
  lockerModal?.close?.();
  battlePassModal?.close?.();
  changelogModal?.close?.();
  faqModal?.close?.();
  platformModal?.close?.();
  dialogueModal?.close?.();
  if (miniGameModal?.backdrop && !miniGameModal.backdrop.classList.contains('hidden')) {
    miniGameModal.close();
  }
  hud?.closeAllModals?.();
  closeCielOsPc({ restoreCamera: false });
  setModalActive(false, false, false);

  const cfg = readJpoConfig();
  jpoState.kiosk = Boolean(cfg.kiosk);

  if (isJpoRoomActive(cfg.room)) {
    const roomCfg = getJpoRoomConfig(cfg.room);
    const visitorName = createJpoVisitorName(roomCfg.id);
    const baseSkin = { ...DEFAULT_SKIN };
    network.disconnect();
    remotePlayers.clearAll();
    startGameSession(
      {
        name: visitorName,
        room: 'plateau-u300',
        skin: baseSkin,
        jpoRoom: roomCfg.id
      },
      false
    );
    setTimeout(() => {
      hud?.toast?.(
        reason === 'inactivity'
          ? `⏱️ Session réinitialisée après 60s d’inactivité — Bienvenue en ${roomCfg.label} !`
          : `🔄 Nouvelle visite — Bienvenue en ${roomCfg.label} !`,
        'info'
      );
    }, 180);
    return;
  }

  returnToMainMenu(true);
  mainMenu?.handleLogout?.();
}

function handleCoinReward({
  coinsEarned = 0,
  source = 'reward',
  label = '',
  profile = null,
  isNewRecord = false
} = {}) {
  if (isJpoDemoActive()) {
    return;
  }
  if (profile) {
    gameState.setProfile(profile);
  }
  const n = Math.max(0, Math.floor(Number(coinsEarned) || 0));
  lab.setLocalCoins?.(gameState.coins ?? gameState.profile?.coins ?? 0);
  hud?.refresh?.();
  shopModal?.refresh?.();
  lockerModal?.refresh?.();
  tabletOS?.refresh?.();
  refreshVrTabletSpatialPanel?.();
  mainMenu?.syncPlayerBadge?.();
  if (n <= 0) {
    syncVrWatchHud();
    return;
  }
  const now = Date.now();
  const dedupKey = `${source}:${n}:${gameState.coins}`;
  if (dedupKey === lastCoinDedupKey && now - lastCoinDedupAt < 1200) {
    syncVrWatchHud();
    return;
  }
  lastCoinDedupKey = dedupKey;
  lastCoinDedupAt = now;

  sfx.coinEarned?.();
  hud?.showCoinGain?.(n, label);
  vrCoinGainState.amount = n;
  vrCoinGainState.until = now + 3600;
  syncVrWatchHud();
  if (isNewRecord) {
    hud?.toast?.(`🏆 Nouveau record ! +${n} 🪙 CC gagnés !`, 'success');
  }
}

async function buyShopItemAction(item) {
  if (!item?.id) return { ok: false, error: 'Article invalide.' };
  if (isJpoDemoActive()) {
    return { ok: false, error: 'Boutique indisponible en mode Portes Ouvertes.' };
  }
  if (gameState.authToken && !network.getAuthToken()) {
    network.setAuthToken(gameState.authToken);
  }
  const playerName = gameState.account?.username || gameState.profile?.name || 'Eleve_CIEL';
  const res = await network.buyShopItem(item.id, playerName);
  if (res?.ok) {
    sfx.shopPurchase?.();
    if (res.profile) {
      gameState.setProfile(res.profile);
    } else {
      gameState.applyEconomySnapshot(res);
    }
    lab.setLocalCoins?.(gameState.coins);
    hud?.refresh?.();
    mainMenu?.syncPlayerBadge?.();
    shopModal?.refresh?.();
    lockerModal?.refresh?.();
    syncVrWatchHud();
  }
  return res;
}

async function equipShopItemAction(item, equip = true) {
  if (isJpoDemoActive()) {
    const itemId = item?.id || null;
    const category = item?.category || null;
    if (category === 'skins' || (itemId && isShopSkinId(itemId))) {
      gameState.equipDivineSkin(equip && itemId ? itemId : null);
    } else if (category === 'pets' || (itemId && isShopPetId(itemId))) {
      const nextPet = equip && itemId && gameState.hasOwnedItem(itemId) ? itemId : null;
      gameState.setSkin({ ...gameState.skin, equippedPet: nextPet });
    } else if (category === 'accessories' || (itemId && isShopAccessoryId(itemId))) {
      const nextTrail = equip && itemId && gameState.hasOwnedItem(itemId) ? itemId : null;
      gameState.setSkin({ ...gameState.skin, equippedTrail: nextTrail });
    }
    sessionDivineSpecialty = gameState.skin?.secretSkin
      ? ULTIMATE_SECRET_SKIN_ID
      : gameState.skin?.divineSpecialty || null;
    rebuildLocalAvatar(gameState.skin);
    network.sendSkinUpdate(gameState.skin);
    hud?._refreshInGameSkinUi?.();
    mainMenu?.renderSkinUi?.();
    mainMenu?.preview?.rebuild?.();
    battlePassModal?.refresh?.();
    shopModal?.refresh?.();
    lockerModal?.refresh?.();
    syncVrWatchHud();
    return { ok: true };
  }
  if (gameState.authToken && !network.getAuthToken()) {
    network.setAuthToken(gameState.authToken);
  }
  const playerName = gameState.account?.username || gameState.profile?.name || 'Eleve_CIEL';
  const res = await network.equipShopItem({
    itemId: item?.id || null,
    category: item?.category || null,
    equip: Boolean(equip),
    name: playerName
  });
  if (res?.ok) {
    if (res.profile) {
      gameState.setProfile(res.profile);
    } else {
      gameState.applyEconomySnapshot(res);
    }
    sessionDivineSpecialty = gameState.skin?.secretSkin
      ? ULTIMATE_SECRET_SKIN_ID
      : gameState.skin?.divineSpecialty || null;
    rebuildLocalAvatar(gameState.skin);
    network.sendSkinUpdate(gameState.skin);
    hud?._refreshInGameSkinUi?.();
    mainMenu?.renderSkinUi?.();
    mainMenu?.preview?.rebuild?.();
    battlePassModal?.refresh?.();
    shopModal?.refresh?.();
    lockerModal?.refresh?.();
    syncVrWatchHud();
  }
  return res;
}

function buildVrShopPanelPayload() {
  const vm = buildShopViewModel(gameState, vrShopCategory, vrShopSelectedId);
  if (vm.selectedItem) {
    vrShopSelectedId = vm.selectedItem.id;
  }
  return {
    ...vm,
    title: '🛒 BOUTIQUE CIEL — SKINS, PETS 3D & AURAS',
    feedback: vrShopFeedback,
    onSelectCategory: (cat) => {
      vrShopCategory = cat;
      vrShopSelectedId = null;
      vrShopFeedback = null;
      vrManager?.updateShopSpatialPanel?.(buildVrShopPanelPayload());
    },
    onSelectItem: (itemId) => {
      vrShopSelectedId = itemId;
      vrShopFeedback = null;
      vrManager?.updateShopSpatialPanel?.(buildVrShopPanelPayload());
    },
    onBuy: async (item) => {
      if (!item.owned && !item.canAfford) {
        const missing = Math.max(0, item.price - vm.coins);
        vrShopFeedback = {
          message: `🔒 Solde insuffisant (${vm.coins}/${item.price} CC, manque ${missing})`,
          kind: 'error'
        };
        vrManager?.updateShopSpatialPanel?.(buildVrShopPanelPayload());
        return;
      }
      const res = await buyShopItemAction(item);
      vrShopFeedback = res?.ok
        ? { message: `✅ ${item.name} acheté !`, kind: 'success' }
        : { message: res?.error || 'Achat impossible.', kind: 'error' };
      vrManager?.updateShopSpatialPanel?.(buildVrShopPanelPayload());
    },
    onEquip: async (item, eq) => {
      const res = await equipShopItemAction(item, eq);
      vrShopFeedback = res?.ok
        ? { message: eq ? `✨ ${item.name} équipé !` : `↩️ ${item.name} retiré.`, kind: 'success' }
        : { message: res?.error || 'Équipement impossible.', kind: 'error' };
      vrManager?.updateShopSpatialPanel?.(buildVrShopPanelPayload());
    },
    onClose: () => {
      vrManager?.closeShopSpatialPanel?.();
    }
  };
}

function buildVrLockerPanelPayload() {
  const vm = buildLockerViewModel(gameState, {
    category: vrLockerCategory,
    filter: vrLockerFilter,
    selectedId: vrLockerSelectedId
  });
  if (vm.selectedItem) {
    vrLockerSelectedId = vm.selectedItem.id;
  }
  return {
    ...vm,
    title: '🎨 CASIER CIEL — SKINS, PETS 3D & ACCESSOIRES',
    feedback: vrLockerFeedback,
    onSelectCategory: (cat) => {
      vrLockerCategory = cat;
      vrLockerSelectedId = null;
      vrLockerFeedback = null;
      vrManager?.updateLockerSpatialPanel?.(buildVrLockerPanelPayload());
    },
    onSelectFilter: (flt) => {
      vrLockerFilter = flt;
      vrLockerSelectedId = null;
      vrLockerFeedback = null;
      vrManager?.updateLockerSpatialPanel?.(buildVrLockerPanelPayload());
    },
    onSelectItem: (itemId) => {
      vrLockerSelectedId = itemId;
      vrLockerFeedback = null;
      vrManager?.updateLockerSpatialPanel?.(buildVrLockerPanelPayload());
    },
    onEquip: async (item, eq) => {
      if (item.source === 'shop') {
        const res = await equipShopItemAction(item, eq);
        vrLockerFeedback = res?.ok
          ? { message: eq ? `✅ ${item.name} équipé !` : `↩️ ${item.name} retiré.`, kind: 'success' }
          : { message: res?.error || 'Équipement impossible.', kind: 'error' };
      } else if (item.source === 'standard') {
        await equipShopItemAction({ id: 'standard', category: 'skins' }, false);
        gameState.equipDivineSkin(null);
        rebuildLocalAvatar(gameState.skin);
        network.sendSkinUpdate(gameState.skin);
        vrLockerFeedback = { message: '✅ Tenue Standard équipée.', kind: 'success' };
      } else if (item.source === 'divine' || item.source === 'battlepass' || item.source === 'secret') {
        gameState.equipDivineSkin(eq ? item.id : null);
        rebuildLocalAvatar(gameState.skin);
        network.sendSkinUpdate(gameState.skin);
        vrLockerFeedback = {
          message: eq ? `✨ ${item.name} équipé !` : '↩️ Retour à la Tenue Standard.',
          kind: 'success'
        };
      }
      vrManager?.updateLockerSpatialPanel?.(buildVrLockerPanelPayload());
    },
    onOpenShopItem: (cat, itemId) => {
      vrManager?.closeLockerSpatialPanel?.();
      openShopUi(cat || 'skins', itemId || null);
    },
    onClose: () => {
      vrManager?.closeLockerSpatialPanel?.();
    }
  };
}

function openShopUi(initialCategory = 'skins', initialItemId = null) {
  if (isJpoDemoActive()) return false;
  hud?.closeSettings?.();
  lockerModal?.close?.();
  tabletOS?.close?.({ restoreControls: false });
  if (typeof document !== 'undefined' && document.pointerLockElement) {
    document.exitPointerLock?.();
  }
  if (vrManager?.isVrActive?.()) {
    vrShopCategory = initialCategory || 'skins';
    vrShopSelectedId = initialItemId || null;
    vrShopFeedback = null;
    vrManager.openShopSpatialPanel(buildVrShopPanelPayload());
    return true;
  }
  if (!shopModal) return false;
  if (joined) {
    setModalActive(true, false, true);
  }
  shopModal.open(initialCategory, initialItemId);
  return true;
}

function openLockerUi(initialCategory = 'skins') {
  hud?.closeSettings?.();
  shopModal?.close?.();
  tabletOS?.close?.({ restoreControls: false });
  if (typeof document !== 'undefined' && document.pointerLockElement) {
    document.exitPointerLock?.();
  }
  if (vrManager?.isVrActive?.()) {
    vrLockerCategory = initialCategory || 'skins';
    vrLockerFilter = 'all';
    vrLockerSelectedId = null;
    vrLockerFeedback = null;
    vrManager.openLockerSpatialPanel(buildVrLockerPanelPayload());
    return true;
  }
  if (!lockerModal) return false;
  if (joined) {
    setModalActive(true, false, false);
  }
  lockerModal.open(initialCategory);
  return true;
}

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
  getInteractables: () =>
    activeWorldMode === 'hall' &&
    !survivalState.inWaitingRoom &&
    !combatState.inWaitingRoom &&
    !combatState.inActiveMatch &&
    !survivalState.detained &&
    !survivalState.inDefeatDetention &&
    !survivalState.introActive &&
    !survivalState.hiddenRack
      ? lab.getNearbyInteractables(player.position.x, player.position.z, 6.5, player.getCurrentFloor(), _vrInteractScratch)
      : getActiveInteractables(),
  getWorldInteractiveSurfaces: () => getActiveWorldSurfaces(),
  getOccluders: () =>
    activeWorldMode === 'hall' &&
    !survivalState.inWaitingRoom &&
    !combatState.inWaitingRoom &&
    !combatState.inActiveMatch &&
    !survivalState.detained &&
    !survivalState.inDefeatDetention &&
    !survivalState.introActive &&
    !survivalState.hiddenRack
      ? lab.getNearbyOccludersAt(player.position.x, player.position.z, 7.5, player.getCurrentFloor(), _vrOccluderScratch)
      : lab.solidWallMeshes,
  getNearestInteractable: () => nearestTarget,
  onHoverInteractable: (item) => lab.setHoveredInteractable?.(item),
  onInteract: (item) => interactWith(item),
  onToggleMic: () => voiceChat.toggleMicrophone(),
  onOpenShop: () => openShopUi('skins'),
  onOpenLocker: () => openLockerUi('skins'),
  onOpenTablet: () => openTabletUi(),
  onOpenChangelog: () => changelogModal?.open?.(),
  onEnterVr: () => {
    activeCameraTweenId++;
    mainMenu?.hide?.();
    mainMenu?.preview?.setActive?.(false);
    hud?.skinPreview?.setActive?.(false);
    platformModal?.close?.();
    changelogModal?.close?.();
    faqModal?.close?.();
    battlePassModal?.close?.();
    shopModal?.close?.();
    lockerModal?.close?.();
    tabletOS?.close?.({ restoreControls: false });
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
    hud?.hideCombatLobby?.();
    hud?.hideCombatHud?.();
    hud?.hideCombatEndOverlay?.();
    if (miniGameModal?.backdrop && !miniGameModal.backdrop.classList.contains('hidden')) {
      miniGameModal.close();
    }
    vrManager.closeTabletSpatialPanel?.();
    closeCielOsPc({ restoreCamera: false });
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
    syncCombatPanelMode();
    if (combatState.inActiveMatch) {
      const myFighter = getLocalCombatFighter();
      vrManager.setCombatMode(true, {
        mode: combatState.mode,
        weaponId: myFighter?.weaponId || combatState.selectedWeaponId,
        callbacks: getCombatVrCallbacks()
      });
    }
    if (survivalState.detained || survivalState.inDefeatDetention) {
      const detCfg = survivalArena.getDetentionRoomConfig();
      const seatEyeY = detCfg.vrSeatEyeY || detCfg.pcEye?.y || 1.28;
      vrManager.setSeatedMode?.(true, {
        x: detCfg.spawn.x,
        y: seatEyeY,
        z: detCfg.spawn.z,
        yaw: 0,
        pitch: -0.08
      });
      vrManager.setDetentionHudHidden?.(true);
      hud?.setDetentionHudHidden?.(true);
    } else {
      vrManager.setSeatedMode?.(false);
      vrManager.setDetentionHudHidden?.(false);
    }
    if (joined) {
      network.sendMove(
        player.position.x,
        player.getFeetY(),
        player.position.z,
        player.yaw,
        true,
        vrManager.getVrSyncPayload(),
        player.getCurrentFloor()
      );
    }
  },
  onExitVr: () => {
    if (typeof document !== 'undefined' && document.body?.classList) {
      document.body.classList.remove('vr-presenting');
    }
    if (miniGameModal?.backdrop && !miniGameModal.backdrop.classList.contains('hidden')) {
      miniGameModal.close();
    }
    vrManager.closeTabletSpatialPanel?.();
    closeCielOsPc({ restoreCamera: false });
    player.setVrMode?.(false);
    localAvatar?.setFirstPersonVrHidden?.(false);
    vrManager.setSeatedMode?.(false);
    vrManager.setDetentionHudHidden?.(false);
    const seatedDet = isDetentionSeatedActive();
    player.setEnabled(joined && !modalOpen);
    if (seatedDet) {
      applyDetentionPcCamera();
      hud?.setDetentionHudHidden?.(true);
    } else {
      player.setSeated?.(false);
      player._applyCamera?.();
    }
    touchControls?.setVisible(joined && !modalOpen && !seatedDet && gameState.touchMode);
    vrManager.setCombatMode(false);
    syncSurvivalPanelMode();
    syncCombatPanelMode();
    if (combatState.inActiveMatch && combatState.snapshot) {
      hud?.updateCombatHud?.(combatState.snapshot, network.clientId);
      const wSpec = getCombatWeaponById(combatState.selectedWeaponId);
      touchControls?.setCombatMode?.(true, { mode: combatState.mode, weaponShortName: wSpec?.shortName || '' });
    }
    if (joined) {
      network.sendMove(
        player.position.x,
        player.getFeetY(),
        player.position.z,
        player.yaw,
        true,
        { active: false },
        player.getCurrentFloor()
      );
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
  jpoBriefingModal = new JpoBriefingModal();
  jpoWelcomeModal = new JpoWelcomeModal();
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

try {
  shopModal = new ShopModal({
    gameState,
    onBuyItem: (item) => buyShopItemAction(item),
    onEquipItem: (item, eq) => equipShopItemAction(item, eq),
    onClose: () => {
      if (joined) {
        setModalActive(false, false, false);
      }
    }
  });
} catch (err) {
  console.warn('Modale Boutique:', err);
}

try {
  lockerModal = new LockerModal({
    gameState,
    onEquipShopItem: (item, eq) => equipShopItemAction(item, eq),
    onEquipDivineSkin: (specId) => {
      gameState.equipDivineSkin(specId);
      const skin = gameState.skin;
      const selectedId = getSelectedSkinIdFromSkin(skin);
      sessionDivineSpecialty = skin?.secretSkin
        ? ULTIMATE_SECRET_SKIN_ID
        : skin?.divineSpecialty || null;
      rebuildLocalAvatar(skin);
      battlePassModal?.refresh?.();
      shopModal?.refresh?.();
      mainMenu?.renderSkinUi?.();
      network.sendSkinUpdate(skin);
      network.saveAccount({
        selectedSkin: selectedId,
        avatarCustomization: skin,
        unlockedDivineSkins: gameState.unlockedDivineSkins
      });
    },
    onStandardSkinChange: (skin) => {
      const selectedId = getSelectedSkinIdFromSkin(skin);
      sessionDivineSpecialty = skin?.secretSkin
        ? ULTIMATE_SECRET_SKIN_ID
        : skin?.divineSpecialty || null;
      rebuildLocalAvatar(skin);
      battlePassModal?.refresh?.();
      mainMenu?.renderSkinUi?.();
      network.sendSkinUpdate(skin);
      network.saveAccount({
        selectedSkin: selectedId,
        avatarCustomization: skin,
        unlockedDivineSkins: gameState.unlockedDivineSkins
      });
    },
    onOpenShopItem: (category, itemId) => {
      openShopUi(category || 'skins', itemId || null);
    },
    onClose: () => {
      if (joined) {
        setModalActive(false, false, false);
      }
    }
  });
} catch (err) {
  console.warn('Modale Casier:', err);
}

function isOtherModalBlockingTablet() {
  return Boolean(
    activeCinematic ||
      survivalState.introActive ||
      survivalState.inWaitingRoom ||
      combatState.inWaitingRoom ||
      hud?.isSettingsOpen?.() ||
      hud?.isSkinOpen?.() ||
      hud?.isLeaderboardOpen?.() ||
      shopModal?.isOpen?.() ||
      lockerModal?.isOpen?.() ||
      battlePassModal?.isOpen?.() ||
      changelogModal?.isOpen?.() ||
      faqModal?.isOpen?.() ||
      platformModal?.isOpen?.() ||
      (dialogueModal?.backdrop && !dialogueModal.backdrop.classList.contains('hidden')) ||
      (miniGameModal?.backdrop && !miniGameModal.backdrop.classList.contains('hidden'))
  );
}

function buildVrTabletPanelPayload(extra = {}) {
  const curFloor = player.getCurrentFloor();
  return {
    title: '📱 TABLETTE INTERACTIVE CIEL',
    playerName: gameState.account?.username || gameState.profile?.name || 'Eleve_CIEL',
    connectionState: hud?.lastConnectionState || (network.connected ? 'connected' : 'solo'),
    onlineCount: hud?.lastOnlineCount || 1,
    pingMs: network.lastPingMs,
    coins: Math.max(0, Math.floor(Number(gameState.coins ?? gameState.profile?.coins) || 0)),
    batteryPct: tabletOS?.batteryPct ?? 96,
    formativeProgress: gameState.formativeProgress || {},
    formativeRewardedTps: gameState.formativeRewardedTps || [],
    grades: gameState.profile?.grades || {},
    gameState,
    mapData: currentMapData,
    playerPos: { x: player.position.x, y: player.getFeetY(), z: player.position.z },
    playerYaw: player.yaw,
    playerFloor: curFloor,
    peers: remotePlayers.getMiniMapPeers(),
    teacherPos: getTeacherPosFromMap(currentMapData),
    waypoint: activeCampusWaypoint,
    onWaypointChange: (wp) => {
      activeCampusWaypoint = wp || null;
      tabletOS?.setWaypoint?.(activeCampusWaypoint);
      syncVrWatchHud();
    },
    onSubmitFormativeAnswer: async (tpId, _qId, _val, nextAnswers) => {
      if (isJpoDemoActive()) return;
      const playerName = gameState.account?.username || gameState.profile?.name || 'Eleve_CIEL';
      const res = await network.submitFormativeProgress(tpId, nextAnswers, playerName);
      if (res?.ok) {
        if (res.profile) {
          gameState.setProfile(res.profile);
        }
        if (res.coinsEarned > 0 || res.xpEarned > 0) {
          handleCoinReward({
            coinsEarned: res.coinsEarned,
            source: 'formative',
            label: res.tpTitle || 'TP CIEL Formative',
            profile: res.profile
          });
          hud?.toast?.(`🎉 TP Formative validé ! +${res.coinsEarned} 🪙 CC • +${res.xpEarned} XP`, 'success');
        }
        refreshVrTabletSpatialPanel();
      }
    },
    onClose: () => {
      vrManager?.closeTabletSpatialPanel?.();
    },
    ...extra
  };
}

function refreshVrTabletSpatialPanel() {
  if (!vrManager?.isVrActive?.() || !vrManager?.isTabletSpatialPanelOpen?.()) return;
  vrManager.updateTabletSpatialPanel(buildVrTabletPanelPayload());
}

function openTabletUi(appId = null) {
  if (!joined) return false;
  hud?.closeSettings?.();
  shopModal?.close?.();
  lockerModal?.close?.();
  if (typeof document !== 'undefined' && document.pointerLockElement) {
    document.exitPointerLock?.();
  }
  if (vrManager?.isVrActive?.()) {
    vrManager.openTabletSpatialPanel(buildVrTabletPanelPayload(appId ? { app: appId } : {}));
    return true;
  }
  if (!tabletOS) return false;
  tabletOS.open(appId);
  return true;
}

function toggleTabletUi() {
  if (!joined) return false;
  if (vrManager?.isVrActive?.()) {
    if (vrManager.isTabletSpatialPanelOpen?.()) {
      vrManager.closeTabletSpatialPanel();
      return false;
    }
    return openTabletUi();
  }
  if (!tabletOS) return false;
  if (tabletOS.isOpen()) {
    tabletOS.close();
    return false;
  }
  return openTabletUi();
}

try {
  tabletOS = new TabletOS({
    gameState,
    network,
    mapData: currentMapData,
    onOpen: () => {
      hud?.closeSettings?.();
      shopModal?.close?.();
      lockerModal?.close?.();
      combatState.fireHeld = false;
      player.clearKeys?.();
      if (typeof document !== 'undefined' && document.pointerLockElement) {
        document.exitPointerLock?.();
      }
      if (joined) {
        setModalActive(true, false, false);
      }
    },
    onClose: ({ restoreControls = true } = {}) => {
      if (restoreControls && joined && !isOtherModalBlockingTablet()) {
        setModalActive(false, false, false);
      }
    },
    onFormativeReward: (res) => {
      handleCoinReward({
        coinsEarned: res?.coinsEarned || 0,
        source: 'formative',
        label: res?.tpTitle || 'TP CIEL Formative',
        profile: res?.profile || null
      });
      if (res?.coinsEarned > 0 || res?.xpEarned > 0) {
        hud?.toast?.(
          `🎉 TP Formative validé ! +${res.coinsEarned || 0} 🪙 CC • +${res.xpEarned || 0} XP`,
          'success'
        );
      }
    },
    onWaypointChange: (wp) => {
      activeCampusWaypoint = wp || null;
      syncVrWatchHud();
    },
    onSelectTpStation: (tpId) => {
      if (tpId) {
        tabletOS?.close?.();
        teleportNearTarget(tpId);
      }
    },
    onToast: (msg, type) => hud?.toast?.(msg, type)
  });
} catch (err) {
  console.warn('Tablette CIEL indisponible:', err);
}

lab.setArcadeGameEndHandler?.(async ({ gameId, score, difficulty, won, elapsedSec, desktop }) => {
  if (isJpoDemoActive()) return;
  if (!Number.isFinite(Number(score)) || Number(score) <= 0) return;
  const playerName = gameState.account?.username || gameState.profile?.name || 'Eleve_CIEL';
  const res = await network.submitArcadeScore(gameId, score, playerName, {
    difficulty: difficulty || null,
    won: Boolean(won),
    elapsedSec: elapsedSec ?? null
  });
  if (res?.ok) {
    handleCoinReward({
      coinsEarned: res.coinsEarned,
      source: 'arcade',
      label: res.isNewRecord ? 'Nouveau Record !' : res.gameLabel,
      profile: res.profile,
      isNewRecord: res.isNewRecord
    });
    desktop?.setCoins?.(res.coins);
    if (res.coinsEarned > 0) {
      desktop?.showCoinToast?.(res.coinsEarned, res.isNewRecord ? 'Nouveau Record !' : res.gameLabel);
    }
  }
});

document.getElementById('menu-version-badge')?.addEventListener('click', () => {
  sfx.click();
  changelogModal?.open?.();
});

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
  introAiPos: { x: -4.95, z: -2.35, yaw: 0.32 },
  introMapContext: null,
  detained: false,
  inDefeatDetention: false,
  hiddenRack: null,
  hiddenSpot: null,
  snapshot: null,
  lobbyModalOpen: false,
  detentionModalOpen: false,
  detentionMinimized: false,
  detentionCamIndex: 0,
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

function isCombatInstanceRoom(roomId = gameState.room) {
  return String(roomId || '').trim().toLowerCase().startsWith('combat-arena-');
}

function isDetentionSeatedActive() {
  return Boolean(
    (survivalState.detained || survivalState.inDefeatDetention) &&
      survivalState.jumpscareUntil <= Date.now()
  );
}

function applyRoomInstanceFilter(roomId = gameState.room, snap = survivalState.snapshot, kind = 'survival') {
  if (kind === 'combat' && combatState.inActiveMatch && Array.isArray(snap?.fighters)) {
    const allowedIds = snap.fighters.filter((f) => !f.isBot).map((f) => f.id).filter(Boolean);
    remotePlayers.setInstanceFilter(allowedIds);
    return;
  }
  if (survivalState.inActiveMatch && Array.isArray(snap?.participants)) {
    const allowedIds = snap.participants.map((p) => p.id).filter(Boolean);
    remotePlayers.setInstanceFilter(allowedIds);
    return;
  }
  if (!isSurvivalInstanceRoom(roomId) && !isCombatInstanceRoom(roomId)) {
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
  if (combatState.inWaitingRoom && !combatState.inActiveMatch) {
    return combatArena.getWaitingRoomConfig().interactables;
  }
  if (combatState.inActiveMatch) {
    return [];
  }
  if (survivalState.hiddenRack) {
    return [];
  }
  if (isJpoDemoActive() || (!privateDebugMode && isJpoActive())) {
    return lab.interactables.filter((it) => it?.type !== 'combat_door');
  }
  return lab.interactables;
}

function getActiveWorldSurfaces() {
  if (isDetentionSeatedActive()) {
    return survivalArena.getDetentionInteractiveSurfaces({
      onSelectOption: (idx) => submitDetentionOption(idx),
      onPrevCamera: () => cycleDetentionCamera(-1),
      onNextCamera: () => cycleDetentionCamera(1),
      onExitDetention: () => exitDetentionAndReturnToHall(),
      onRestartSurvival: () => restartSurvivalFromDetention()
    });
  }
  if ((survivalState.inWaitingRoom && !survivalState.inActiveMatch) || (combatState.inWaitingRoom && !combatState.inActiveMatch) || combatState.inActiveMatch) {
    return [];
  }
  const allSurfaces = lab.pcInteractiveSurfaces || [];
  if (allSurfaces.length === 0) return allSurfaces;
  _nearbySurfacesScratch.length = 0;
  const curFloor = player.getCurrentFloor();
  const px = player.position.x;
  const pz = player.position.z;
  for (let i = 0; i < allSurfaces.length; i++) {
    const surf = allSurfaces[i];
    const st = surf?.pcStation;
    if (!st) continue;
    if (st.chunk && (!st.chunk.visible || !st.chunk.detailsVisible)) continue;
    if (Math.abs((st.floor ?? 0) - curFloor) > 1) continue;
    const dx = (st.position?.x || 0) - px;
    const dz = (st.position?.z || 0) - pz;
    if (dx * dx + dz * dz <= 64) {
      _nearbySurfacesScratch.push(surf);
    }
  }
  return _nearbySurfacesScratch;
}

function applyDetentionPcCamera() {
  if (vrManager?.isVrActive?.()) return;
  const cfg = survivalArena.getDetentionRoomConfig();
  const eye = cfg.pcEye || { x: cfg.spawn.x, y: 1.28, z: cfg.spawn.z };
  player.setSeated?.(true, {
    x: eye.x,
    y: eye.y,
    z: eye.z,
    lookAt: cfg.lookAt
  });
}

function teleportWithWorldMode(pos, lookAt, mode = 'hall') {
  applyActiveZoneCulling(mode);
  if (mode === 'waiting') {
    player.setSeated?.(false);
    vrManager?.setSeatedMode?.(false);
    const cfg = survivalArena.getWaitingRoomConfig();
    player.setWalkableSurfaces?.(null);
    player.setSpatialHash?.(null);
    player.setColliders(cfg.colliders);
    player.setBounds(cfg.bounds);
    player.teleportTo(cfg.spawn, cfg.lookAt);
    vrManager?.syncWorldTeleport?.(cfg.spawn.x, cfg.spawn.z, player.yaw, 0);
    return;
  }
  if (mode === 'combat_waiting') {
    player.setSeated?.(false);
    vrManager?.setSeatedMode?.(false);
    const cfg = combatArena.getWaitingRoomConfig();
    player.setWalkableSurfaces?.(null);
    player.setSpatialHash?.(null);
    player.setColliders(cfg.colliders);
    player.setBounds(cfg.bounds);
    player.teleportTo(cfg.spawn, cfg.lookAt);
    vrManager?.syncWorldTeleport?.(cfg.spawn.x, cfg.spawn.z, player.yaw, 0);
    return;
  }
  if (mode === 'combat_arena') {
    player.setSeated?.(false);
    vrManager?.setSeatedMode?.(false);
    const cfg = combatArena.getArenaConfig();
    player.setWalkableSurfaces?.(null);
    player.setSpatialHash?.(null);
    player.setColliders(cfg.colliders);
    player.setBounds(cfg.bounds);
    const sp = pos || cfg.spawn;
    const lk = lookAt || cfg.lookAt;
    player.teleportTo(sp, lk);
    vrManager?.syncWorldTeleport?.(sp.x, sp.z, player.yaw, 0);
    return;
  }
  if (mode === 'detention') {
    const cfg = survivalArena.getDetentionRoomConfig();
    const seatEyeY = cfg.vrSeatEyeY || cfg.pcEye?.y || 1.28;
    player.setWalkableSurfaces?.(null);
    player.setSpatialHash?.(null);
    player.setColliders(cfg.colliders);
    player.setBounds(cfg.bounds);
    player.teleportTo(cfg.spawn, cfg.lookAt);
    if (vrManager?.isVrActive?.()) {
      player.setSeated?.(true, {
        x: cfg.spawn.x,
        y: seatEyeY,
        z: cfg.spawn.z,
        lookAt: cfg.lookAt
      });
      vrManager.setSeatedMode?.(true, {
        x: cfg.spawn.x,
        y: seatEyeY,
        z: cfg.spawn.z,
        yaw: 0,
        pitch: -0.08
      });
    } else {
      applyDetentionPcCamera();
    }
    return;
  }
  player.setSeated?.(false);
  vrManager?.setSeatedMode?.(false);
  player.setWalkableSurfaces?.(lab.walkableSurfaces);
  player.setSpatialHash?.(lab.spatialHash);
  player.setColliders(lab.colliders);
  player.setBounds(currentMapData.bounds);
  const pose = pos ? { pos, lookAt: lookAt || { x: pos.x, z: pos.z - 4 } } : getSpawnPose(currentMapData);
  player.teleportTo(pose.pos, pose.lookAt);
  vrManager?.syncWorldTeleport?.(pose.pos.x, pose.pos.z, player.yaw, player.surfaceY);
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
}

const _povLookTmp = new THREE.Vector3();
const _povDirTmp = new THREE.Vector3();
const _povQuatTmp = new THREE.Quaternion();
const _povHiddenScratch = [];

function renderDetentionLivePov(_dt, elapsed) {
  if (!isDetentionSeatedActive()) return;
  if (!survivalArena?.povCamera) return;
  survivalArena.updateDetentionClock?.(elapsed);
  const povStep = 0.045 * Math.min(2.5, Math.max(1, sceneMgr.textureThrottleMult || 1));
  if (elapsed - survivalState.lastPovRenderAt < povStep) return;
  survivalState.lastPovRenderAt = elapsed;

  const snap = survivalState.snapshot;
  const info = buildDetentionCameraInfo(snap);
  survivalState.activeCameraInfo = info;
  survivalArena.updateDetentionCameraBar(info, false);
  hud?.hideDetention3dHud?.();

  if (!survivalArena.povRenderTarget) {
    survivalArena.setLivePovActive(false);
    survivalArena.updateSurveillanceScreen(snap || {});
    return;
  }
  survivalArena.setLivePovActive(true);

  const povCam = survivalArena.povCamera;
  const hiddenObjects = _povHiddenScratch;
  hiddenObjects.length = 0;
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

  const restoreLabHidden = activeWorldMode === 'detention' && lab.worldGroup && !lab.worldGroup.visible;
  try {
    if (restoreLabHidden) {
      lab.setVisible?.(true);
    }
    sceneMgr.renderToTarget(survivalArena.povRenderTarget, povCam, {
      hiddenObjects,
      ambientBoost,
      fogFar: 28,
      flashlightPose: {
        position: povCam.position,
        target: _povLookTmp,
        intensity: flashIntensity,
        color: flashColor
      }
    });
  } finally {
    if (restoreLabHidden) {
      lab.setVisible?.(false);
    }
    hiddenObjects.length = 0;
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
  dialogueModal?.close?.();
  if (miniGameModal?.backdrop && !miniGameModal.backdrop.classList.contains('hidden')) {
    miniGameModal.close();
  }
  setModalActive(false, false, false);
  touchControls?.setVisible(false);
  hud?.setDetentionHudHidden?.(true);
  vrManager?.setDetentionHudHidden?.(true);
  teleportWithWorldMode(null, null, 'detention');
  player.setEnabled(joined && !modalOpen && !vrManager?.isVrActive?.());

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
    hud?.hideDetention3dHud?.();
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
      vrManager.applySurvivalIntroPose?.(
        player.position.x,
        player.position.z,
        survivalState.introAiPos,
        survivalState.introMapContext
      );
      vrManager.openWorldSpatialPanel(
        'survival_intro',
        { survivalIntro: buildVrIntroState(progress) },
        { dist: 1.38, yOffset: -0.32 }
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
      vrManager.openWorldSpatialPanel(
        'survival_hidden',
        { survivalHidden: buildVrHiddenState(snap) },
        { dist: 0.48, yOffset: -0.44, scale: 0.42 }
      );
    } else {
      setModalActive(false, false, false);
      touchControls?.setVisible?.(false);
      player.setEnabled(true);
      const aiD = snap?.ai
        ? Math.hypot((snap.ai.x || 0) - player.position.x, (snap.ai.z || 0) - player.position.z)
        : null;
      hud?.showHidingOverlay?.({
        noiseLevel: survivalState.noiseLevel,
        micEnabled: Boolean(latestVoiceState.micEnabled),
        aiState: snap?.ai?.state || 'patrol',
        aiDist: aiD
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
  player.setSeated?.(false);
  vrManager?.setSeatedMode?.(false);
  vrManager?.setDetentionHudHidden?.(false);
  hud?.setDetentionHudHidden?.(false);
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

function exitDetentionAndReturnToHall() {
  sfx.click();
  network.sendSurvivalLeave();
  closeSurvivalEndCinematic({ skipSendReturn: true });
}

function restartSurvivalFromDetention() {
  sfx.click();
  if (network.connected) {
    network.sendSurvivalRestart?.();
  } else {
    exitDetentionAndReturnToHall();
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
    const spot = survivalState.hiddenSpot || survivalState.hiddenRack;
    sfx.stopRackServerHum?.();
    sfx.playLockerDoorSound?.(false);
    network.sendSurvivalHide(null);
    survivalState.hiddenRack = null;
    survivalState.hiddenSpot = null;
    player.setHidingInRack?.(false);
    hud?.hideHidingOverlay?.();
    sceneMgr.restoreNormalExposure?.();
    if (vrManager?.isVrActive?.()) {
      vrManager.closeWorldSpatialPanel?.();
    }
    setModalActive(false, false, false);
    const rotRad = Number.isFinite(Number(spot?.rotRad))
      ? Number(spot.rotRad)
      : Number.isFinite(Number(spot?.rad))
        ? Number(spot.rad)
        : Number.isFinite(Number(spot?.rotation))
          ? Number(spot.rotation)
          : 0;
    const computedExit = computeRackExitPosition(
      spot || {},
      lab.colliders,
      currentMapData?.bounds,
      player.radius || 0.42
    );
    const safeExit = player.resolveUnstuckPosition(computedExit.x, computedExit.z, rotRad);
    const lookTarget = {
      x: safeExit.x + Math.sin(rotRad) * 2.0,
      z: safeExit.z + Math.cos(rotRad) * 2.0
    };
    player.setMovementLocked(false);
    player.setEnabled(!vrManager?.isVrActive?.());
    player.setAvatarVisible(true);
    player.teleportTo(safeExit, lookTarget);
    if (vrManager?.isVrActive?.()) {
      vrManager.exitHidingRackVr?.(safeExit.x, safeExit.z, player.yaw);
    } else {
      vrManager?.syncWorldTeleport?.(safeExit.x, safeExit.z, player.yaw);
    }
    return;
  }
  const rackId = target?.id;
  const spot = lab.hidingSpots?.find((s) => s.id === rackId) || target || null;
  if (!spot) return;
  sfx.playLockerDoorSound?.(true);
  sfx.startRackServerHum?.();
  if (miniGameModal?.backdrop && !miniGameModal.backdrop.classList.contains('hidden')) {
    miniGameModal.close();
  }
  const spotX = Number.isFinite(Number(spot.x))
    ? Number(spot.x)
    : Number.isFinite(Number(spot.position?.x))
      ? Number(spot.position.x)
      : player.position.x;
  const spotZ = Number.isFinite(Number(spot.z))
    ? Number(spot.z)
    : Number.isFinite(Number(spot.position?.z))
      ? Number(spot.position.z)
      : player.position.z;
  const rotRad = Number.isFinite(Number(spot.rotRad))
    ? Number(spot.rotRad)
    : Number.isFinite(Number(spot.rad))
      ? Number(spot.rad)
      : Number.isFinite(Number(spot.rotation))
        ? Number(spot.rotation)
        : 0;
  const computedExit = computeRackExitPosition(
    { x: spotX, z: spotZ, rotRad, w: spot.w, d: spot.d },
    lab.colliders,
    currentMapData?.bounds,
    player.radius || 0.42
  );
  const interior = computeRackInteriorPosition({
    x: spotX,
    z: spotZ,
    rotRad,
    w: spot.w,
    d: spot.d
  });
  survivalState.hiddenRack = target;
  survivalState.hiddenSpot = {
    ...spot,
    x: spotX,
    z: spotZ,
    rotRad,
    rad: rotRad,
    interiorPos: interior,
    exitX: computedExit.x,
    exitZ: computedExit.z
  };
  player.setHidingInRack?.(true, interior);
  if (vrManager?.isVrActive?.()) {
    vrManager.enterHidingRackVr?.(interior.x, interior.z, interior.baseYaw, interior.y);
  }
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

  player.setSeated?.(false);
  vrManager?.setSeatedMode?.(false);
  vrManager?.setDetentionHudHidden?.(false);
  hud?.setDetentionHudHidden?.(false);
  if (vrManager?.isVrActive?.()) {
    vrManager.closeWorldSpatialPanel?.();
  }
  setModalActive(false, false, false);
  teleportWithWorldMode(null, null, 'hall');
  player.setMovementLocked(true);
  lab.setTeacherVisible?.(false);

  const introPlacement = resolveSurvivalIntroPlacement(
    currentMapData,
    snapshot?.introSpawn || player.position
  );
  if (introPlacement?.spawnPos) {
    player.teleportTo(introPlacement.spawnPos, introPlacement.aiPos);
    vrManager?.syncWorldTeleport?.(introPlacement.spawnPos.x, introPlacement.spawnPos.z, player.yaw);
  }
  const introAi = introPlacement?.aiPos || { x: -4.95, z: -2.35, yaw: 0.32 };
  survivalState.introAiPos = introAi;
  survivalState.introMapContext = {
    colliders: introPlacement?.colliders || getDynamicMapColliders(currentMapData),
    bounds: introPlacement?.bounds || currentMapData.bounds,
    mapData: currentMapData
  };
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
  closeCielOsPc({ restoreCamera: false });
  survivalState.introActive = false;
  hud?.hideSurvivalIntroOverlay?.();
  sfx.stopRackServerHum?.();
  player.setHidingInRack?.(false);
  if (vrManager) vrManager.hidingInRack = false;
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
  sfx.stopRackServerHum?.();
  player.setHidingInRack?.(false);
  if (vrManager) vrManager.hidingInRack = false;
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
    player.setSeated?.(false);
    vrManager?.setSeatedMode?.(false);
    vrManager?.setDetentionHudHidden?.(false);
    hud?.setDetentionHudHidden?.(false);
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
    player.setSeated?.(false);
    vrManager?.setSeatedMode?.(false);
    vrManager?.setDetentionHudHidden?.(false);
    hud?.setDetentionHudHidden?.(false);
    player.setMovementLocked(false);
    teleportWithWorldMode(null, null, 'hall');
    player.setEnabled(joined && !modalOpen && !vrManager?.isVrActive?.());
    touchControls?.setVisible(joined && !modalOpen && !vrManager?.isVrActive?.() && gameState.touchMode);
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
  player.setSeated?.(false);
  vrManager?.setSeatedMode?.(false);
  vrManager?.setDetentionHudHidden?.(false);
  hud?.setDetentionHudHidden?.(false);
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
  survivalState.introMapContext = null;
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
  sfx.stopRackServerHum?.();
  player.setHidingInRack?.(false);
  if (vrManager) vrManager.hidingInRack = false;
  sceneMgr.setHorrorAtmosphere?.(false, 0, 1);
  lab.setHorrorLighting?.(false, 1);
  lab.setTeacherVisible?.(true);
  horrorTeacher.root.visible = false;
  player.setSeated?.(false);
  vrManager?.setSeatedMode?.(false);
  vrManager?.setDetentionHudHidden?.(false);
  player.setMovementLocked(false);
  player.setWalkableSurfaces?.(lab.walkableSurfaces);
  player.setSpatialHash?.(lab.spatialHash);
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
    const shot = computeSurvivalIntroShot(
      progress,
      survivalState.introAiPos,
      player.position,
      elapsed,
      survivalState.introMapContext
    );
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

  if (survivalState.detained) {
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
  if (!survivalState.detained && !survivalState.inDefeatDetention) {
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
  } else {
    hud?.hideSurvivalHud?.();
  }

  if (survivalState.hiddenRack) {
    if (vrManager?.isVrActive?.()) {
      vrManager.updateWorldSpatialPanel?.({ survivalHidden: buildVrHiddenState(snap) });
    } else {
      hud?.showHidingOverlay?.({
        noiseLevel: survivalState.noiseLevel,
        micEnabled: Boolean(mic.micEnabled),
        aiState,
        aiDist
      });
    }
  }
}

const combatState = {
  phase: 'idle',
  mode: 'guns',
  inWaitingRoom: false,
  inActiveMatch: false,
  lobbyModalOpen: false,
  snapshot: null,
  selectedWeaponId: 'fiber_rifle',
  viewWeaponObj: null,
  viewWeaponId: null,
  fireHeld: false,
  lastFireClientAt: 0,
  recoilAmount: 0,
  swingAnim: 0,
  pumpAnim: 0,
  adsHeld: false,
  adsTouchToggle: false,
  adsProgress: 0,
  lastGuardSent: false,
  lastFovApplied: null,
  localAlive: true,
  lastLocalHp: 100,
  endData: null,
  scoreboardOpen: false
};

function getCombatBotsEnabledFromSnap(snap = combatState.snapshot) {
  if (!snap) return true;
  if (snap.botsEnabled !== undefined) return Boolean(snap.botsEnabled);
  return snap.fillBots !== false;
}

function toggleCombatBots() {
  sfx.click();
  const cur = getCombatBotsEnabledFromSnap(combatState.snapshot);
  network.sendCombatFillBots(!cur);
}

function resetCombatAdsState() {
  combatState.adsHeld = false;
  combatState.adsTouchToggle = false;
  combatState.adsProgress = 0;
  combatState.pumpAnim = 0;
  if (combatState.lastGuardSent) {
    combatState.lastGuardSent = false;
    network.sendCombatGuard?.(false);
  }
  player.setAdsSensitivityMultiplier?.(1.0);
  if (combatState.lastFovApplied !== null) {
    combatState.lastFovApplied = null;
    sceneMgr.setFov?.(gameState.fov);
  }
  touchControls?.setCombatAdsActive?.(false);
  hud?.updateSniperScope?.({ active: false });
  hud?.updateCombatCrosshair?.({ active: false });
}

function getLocalCombatFighter(snap = combatState.snapshot) {
  if (!snap || !network.clientId) return null;
  const fighters = Array.isArray(snap.fighters) ? snap.fighters : [];
  return fighters.find((f) => f.id === network.clientId) || null;
}

function getCombatVrCallbacks() {
  return {
    onAttack: (payload) => triggerLocalCombatAttack(payload),
    onReload: () => {
      sfx.playCombatReload?.();
      network.sendCombatReload?.();
    },
    onCycleWeapon: () => cycleCombatWeapon(1),
    onGuardChange: (guarding) => network.sendCombatGuard?.(Boolean(guarding))
  };
}

function syncCombatViewWeapon(weaponId = null) {
  const cleanId = weaponId ? String(weaponId) : null;
  if (vrManager?.isVrActive?.()) {
    vrManager.setCombatWeaponModel?.(cleanId);
  }
  if (combatState.viewWeaponId === cleanId && Boolean(combatState.viewWeaponObj) === Boolean(cleanId)) {
    return;
  }
  if (combatState.viewWeaponObj) {
    combatState.viewWeaponObj.group.parent?.remove(combatState.viewWeaponObj.group);
    combatState.viewWeaponObj.dispose?.();
    combatState.viewWeaponObj = null;
  }
  combatState.viewWeaponId = cleanId;
  if (!cleanId) return;
  const obj = buildCombatWeaponMesh(cleanId, { viewModel: true });
  combatViewWeaponHolder.add(obj.group);
  combatState.viewWeaponObj = obj;
}

function buildVrCombatLobbyState(snap = combatState.snapshot) {
  const mode = snap?.mode === 'melee' ? 'melee' : 'guns';
  const players = Array.isArray(snap?.lobbyPlayers) ? snap.lobbyPlayers : [];
  const me = players.find((p) => p.id === network.clientId);
  const weapons = getWeaponsByMode(mode);
  const botsEnabled = getCombatBotsEnabledFromSnap(snap);
  return {
    mode,
    botsEnabled,
    fillBots: botsEnabled,
    players,
    weapons,
    selectedWeaponId: me?.weaponId || combatState.selectedWeaponId || weapons[0]?.id,
    localReady: Boolean(me?.ready),
    onSelectMode: (nextMode) => {
      sfx.click();
      network.sendCombatMode(nextMode);
    },
    onToggleBots: () => toggleCombatBots(),
    onSelectWeapon: (wid) => {
      sfx.click();
      selectCombatWeapon(wid);
    },
    onToggleReady: () => toggleCombatReady(),
    onLeave: () => leaveCombatArena()
  };
}

function syncCombatPanelMode() {
  if (!joined) return;
  const vrOn = Boolean(vrManager?.isVrActive?.());
  const snap = combatState.snapshot;

  if (combatState.inWaitingRoom && !combatState.inActiveMatch) {
    combatState.lobbyModalOpen = true;
    if (vrOn) {
      hud?.hideCombatLobby?.();
      vrManager.openWorldSpatialPanel('combat_lobby', { combatLobby: buildVrCombatLobbyState(snap) });
    } else {
      setModalActive(true, false, true);
      hud?.showCombatLobby?.(snap || { mode: combatState.mode, fillBots: true }, network.clientId);
    }
    return;
  }

  if (combatState.phase === 'ended' && combatState.endData) {
    if (vrOn) {
      hud?.hideCombatEndOverlay?.();
      vrManager.openWorldSpatialPanel('combat_end', { combatEnd: combatState.endData });
    } else {
      setModalActive(true, false, true);
      hud?.showCombatEndOverlay?.(combatState.endData);
    }
  }
}

function enterCombatLobby() {
  if (!joined || activeCinematic || isJpoDemoActive() || (!privateDebugMode && isJpoActive())) return;
  if (!network.connected) {
    hud?.toast?.('⚠️ Connectez-vous au serveur pour entrer dans l’Arène de Combat CIEL.', 'error');
    return;
  }
  sfx.interact();
  player.setSeated?.(false);
  vrManager?.setSeatedMode?.(false);
  combatState.inWaitingRoom = true;
  combatState.lobbyModalOpen = true;
  combatState.inActiveMatch = false;
  combatState.endData = null;
  combatState.phase = 'lobby';
  teleportWithWorldMode(null, null, 'combat_waiting');
  network.sendCombatJoin();
  network.sendActivity('Lobby Arène Combat CIEL');
  combatArena.updateWaitingBoard(combatState.snapshot || { mode: 'guns', fillBots: true, lobbyPlayers: [] }, true);
  syncCombatPanelMode();
}

function leaveCombatArena() {
  sfx.click();
  const inCombatRoom = isCombatInstanceRoom(gameState.room);
  resetCombatClientFull();
  setModalActive(false, false, false);
  network.sendCombatLeave();
  if (!inCombatRoom) {
    teleportWithWorldMode(null, null, 'hall');
  }
  network.sendActivity('Dans l’atelier');
}

function toggleCombatReady() {
  const players = combatState.snapshot?.lobbyPlayers || [];
  const me = players.find((p) => p.id === network.clientId);
  const nextReady = !Boolean(me?.ready);
  sfx.click();
  network.sendCombatReady(nextReady);
}

function selectCombatWeapon(weaponId) {
  const spec = getCombatWeaponById(weaponId);
  if (!spec) return;
  combatState.selectedWeaponId = spec.id;
  if (combatState.inActiveMatch) {
    syncCombatViewWeapon(spec.id);
    const vrOn = Boolean(vrManager?.isVrActive?.());
    if (!vrOn) {
      touchControls?.setCombatMode?.(true, {
        mode: combatState.mode,
        weaponShortName: spec.shortName
      });
    }
  }
  network.sendCombatWeapon(spec.id);
}

function cycleCombatWeapon(step = 1) {
  const list = getWeaponsByMode(combatState.mode);
  if (list.length === 0) return;
  const curId = combatState.selectedWeaponId;
  const idx = Math.max(0, list.findIndex((w) => w.id === curId));
  const next = list[(idx + step + list.length) % list.length];
  if (next) {
    sfx.click();
    selectCombatWeapon(next.id);
  }
}

function triggerLocalCombatAttack(customPayload = null) {
  if (!combatState.inActiveMatch || !combatState.localAlive || modalOpen) return false;
  const me = getLocalCombatFighter();
  const activeWeaponId = customPayload?.weaponId || me?.weaponId || combatState.selectedWeaponId || getDefaultWeaponForMode(combatState.mode).id;
  const spec = getCombatWeaponById(activeWeaponId) || getDefaultWeaponForMode(combatState.mode);
  const now = performance.now();
  if (now - combatState.lastFireClientAt < spec.fireRateMs * 0.92) return false;

  if (combatState.mode === 'guns') {
    if (me?.reloading) return false;
    if (me && spec.magSize > 0 && (me.ammo ?? 0) <= 0) {
      sfx.playCombatReload?.();
      network.sendCombatReload?.();
      combatState.lastFireClientAt = now;
      return false;
    }
  }

  const vrActive = Boolean(vrManager?.isVrActive?.());
  let origin = customPayload?.origin;
  let dir = customPayload?.dir;
  if (vrActive) {
    if (!origin || !dir) {
      const muzzleRay = vrManager.getCombatMuzzleRay?.(_combatRayOrigin, _combatRayDir);
      if (!muzzleRay) return false;
      origin = { x: _combatRayOrigin.x, y: _combatRayOrigin.y, z: _combatRayOrigin.z };
      dir = { x: _combatRayDir.x, y: _combatRayDir.y, z: _combatRayDir.z };
    }
  } else if (!origin || !dir) {
    sceneMgr.camera.getWorldPosition(_combatRayOrigin);
    sceneMgr.camera.getWorldDirection(_combatRayDir);
    origin = { x: _combatRayOrigin.x, y: _combatRayOrigin.y, z: _combatRayOrigin.z };
    dir = { x: _combatRayDir.x, y: _combatRayDir.y, z: _combatRayDir.z };
  }

  combatState.lastFireClientAt = now;
  if (combatState.mode === 'melee') {
    combatState.swingAnim = 1;
  } else {
    combatState.recoilAmount = 1;
    if (spec.id === 'udp_shotgun') {
      combatState.pumpAnim = 1;
    }
  }

  const adsActive = customPayload?.ads !== undefined
    ? Boolean(customPayload.ads)
    : vrActive
      ? Boolean(vrManager.combatAdsActive)
      : combatState.adsProgress > 0.35;
  const twoHandedActive = customPayload?.twoHanded !== undefined
    ? Boolean(customPayload.twoHanded)
    : Boolean(vrActive && vrManager.combatTwoHanded);

  network.sendCombatAttack({
    weaponId: spec.id,
    origin,
    dir,
    isVrSwing: Boolean(customPayload?.isVrSwing),
    isVrShot: Boolean(customPayload?.isVrShot || vrActive),
    ads: adsActive,
    twoHanded: twoHandedActive
  });
  return true;
}

function startCombatMatchClient(snapshot) {
  combatState.snapshot = snapshot;
  combatState.phase = 'active';
  combatState.mode = snapshot?.mode === 'melee' ? 'melee' : 'guns';
  const me = getLocalCombatFighter(snapshot);
  const isParticipant = Boolean(combatState.inWaitingRoom || me);
  combatState.inWaitingRoom = false;
  combatState.lobbyModalOpen = false;
  hud?.hideCombatLobby?.();
  hud?.hideCombatEndOverlay?.();
  if (!isParticipant) return;

  combatState.inActiveMatch = true;
  combatState.endData = null;
  combatState.fireHeld = false;
  resetCombatAdsState();
  combatState.localAlive = true;
  combatState.lastLocalHp = me?.hp ?? 100;
  combatState.selectedWeaponId = me?.weaponId || getDefaultWeaponForMode(combatState.mode).id;

  if (vrManager?.isVrActive?.()) {
    vrManager.closeWorldSpatialPanel?.();
  } else if (gameState.cameraMode === 'third') {
    gameState.setCameraMode('first');
    player.setCameraMode('first');
    hud?.syncCameraUi?.();
    touchControls?.syncCameraMode?.('first');
  }
  setModalActive(false, false, false);
  applyRoomInstanceFilter(gameState.room, snapshot, 'combat');
  sceneMgr.setCombatAtmosphere?.(true);

  const spawnPos = me ? { x: me.x, z: me.z } : combatArena.getArenaConfig().spawn;
  const lookPt = me
    ? { x: me.x - Math.sin(me.yaw || 0) * 4, z: me.z - Math.cos(me.yaw || 0) * 4 }
    : combatArena.getArenaConfig().lookAt;
  teleportWithWorldMode(spawnPos, lookPt, 'combat_arena');

  syncCombatViewWeapon(combatState.selectedWeaponId);
  const wSpec = getCombatWeaponById(combatState.selectedWeaponId);
  if (vrManager?.isVrActive?.()) {
    vrManager.setCombatMode?.(true, {
      mode: combatState.mode,
      weaponId: combatState.selectedWeaponId,
      callbacks: getCombatVrCallbacks()
    });
  } else {
    hud?.updateCombatHud?.(snapshot, network.clientId);
    touchControls?.setCombatMode?.(true, {
      mode: combatState.mode,
      weaponShortName: wSpec?.shortName || ''
    });
    touchControls?.setVisible?.(joined && !modalOpen && gameState.touchMode);
  }
  network.sendActivity(combatState.mode === 'melee' ? 'Arène Combat (Mêlée)' : 'Arène Combat (Fusils)');
  syncVrWatchHud();
  hud?.toast?.(
    combatState.mode === 'melee'
      ? '⚔️ ARÈNE MÊLÉE CIEL ! Éliminez vos adversaires au corps-à-corps !'
      : '🔫 ARÈNE FUSILS CIEL ! Viser et tirer (touches 1-4 changer d’arme, R recharger) !',
    'success'
  );
}

function endCombatMatchClient(ended, snapshot) {
  const wasParticipating = combatState.inActiveMatch || combatState.inWaitingRoom;
  combatState.snapshot = snapshot || combatState.snapshot;
  combatState.inActiveMatch = false;
  combatState.inWaitingRoom = false;
  combatState.lobbyModalOpen = false;
  combatState.fireHeld = false;
  resetCombatAdsState();
  combatState.phase = 'ended';
  combatViewWeaponRoot.visible = false;
  syncCombatViewWeapon(null);
  combatVfx.clear();
  remotePlayers.clearAllCombatWeapons();
  hud?.hideCombatHud?.();
  touchControls?.setCombatMode?.(false);
  vrManager?.setCombatMode?.(false);

  if (!wasParticipating) {
    combatState.phase = 'idle';
    return;
  }

  const myReward = ended?.coinRewards?.[network.clientId] || {};
  const won = Boolean(ended?.winnerId && ended.winnerId === network.clientId);
  const endData = {
    won,
    reason: ended?.reason || 'Manche terminée !',
    coinsEarned: myReward.coinsEarned || 0,
    scoreboard: Array.isArray(ended?.scoreboard) ? ended.scoreboard : snapshot?.scoreboard || [],
    localId: network.clientId,
    onReplay: () => {
      sfx.click();
      hud?.hideCombatEndOverlay?.();
      if (vrManager?.isVrActive?.()) vrManager.closeWorldSpatialPanel?.();
      network.sendCombatRestart?.();
    },
    onExit: () => leaveCombatArena()
  };
  combatState.endData = endData;
  syncCombatPanelMode();
  syncVrWatchHud();
}

function resetCombatClientFull() {
  combatState.phase = 'idle';
  combatState.inWaitingRoom = false;
  combatState.inActiveMatch = false;
  combatState.lobbyModalOpen = false;
  combatState.snapshot = null;
  combatState.fireHeld = false;
  resetCombatAdsState();
  combatState.localAlive = true;
  combatState.endData = null;
  combatState.scoreboardOpen = false;
  combatViewWeaponRoot.visible = false;
  syncCombatViewWeapon(null);
  combatVfx.clear();
  combatArena.clearCombatants();
  remotePlayers.clearAllCombatWeapons();
  remotePlayers.setInstanceFilter(null);
  sceneMgr.setCombatAtmosphere?.(false);
  touchControls?.setCombatMode?.(false);
  vrManager?.setCombatMode?.(false);
  hud?.hideAllCombatUi?.();
  player.setWalkableSurfaces?.(lab.walkableSurfaces);
  player.setSpatialHash?.(lab.spatialHash);
  player.setColliders(lab.colliders);
  player.setBounds(currentMapData.bounds);
  if (vrManager?.isVrActive?.()) {
    vrManager.closeWorldSpatialPanel?.();
  }
}

function syncVrWatchHud(extra = {}) {
  if (!vrManager?.isVrActive?.()) return;
  const zone = getZoneAtPositionInMap(currentMapData, player.position.x, player.position.z, player.getCurrentFloor());
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
  const combatExtra = {};
  if (combatState.inActiveMatch) {
    const cSnap = combatState.snapshot;
    const me = getLocalCombatFighter(cSnap);
    const wSpec = getCombatWeaponById(me?.weaponId || combatState.selectedWeaponId) || getDefaultWeaponForMode(combatState.mode);
    const leftSec = Math.max(0, Math.round(Number(cSnap?.timeLeftSec) || 0));
    const min = String(Math.floor(leftSec / 60)).padStart(2, '0');
    const sec = String(leftSec % 60).padStart(2, '0');
    combatExtra.combatStatus = {
      active: true,
      mode: combatState.mode,
      timerText: `${min}:${sec}`,
      hp: me?.hp ?? 100,
      maxHp: me?.maxHp ?? 100,
      ammo: me?.ammo ?? wSpec?.magSize ?? 0,
      maxAmmo: me?.maxAmmo ?? wSpec?.magSize ?? 0,
      reloading: Boolean(me?.reloading),
      weaponName: wSpec?.name || 'Arme CIEL',
      kills: me?.kills || 0,
      killLimit: cSnap?.killLimit || 10,
      deaths: me?.deaths || 0,
      streak: me?.streak || 0
    };
    if (!extra.targetHint && !survExtra.targetHint) {
      combatExtra.targetHint = `${combatState.mode === 'melee' ? '⚔️' : '🔫'} ${me?.kills || 0}/${cSnap?.killLimit || 10} Élim • ❤️ ${Math.round(me?.hp ?? 100)}`;
    }
  } else {
    combatExtra.combatStatus = null;
  }
  vrManager.updateHudInfo({
    name: gameState.profile.name,
    zoneLabel: zone.badgeText,
    zoneColor: zone.color || '#22d3ee',
    average: gameState.profile.average,
    completedCount: gameState.profile.completedCount || 0,
    totalTps: TP_CATALOG.length,
    xp: gameState.profile.xp,
    coins: Math.max(0, Math.floor(Number(gameState.coins ?? gameState.profile?.coins) || 0)),
    coinGainAmount: vrCoinGainState.amount,
    coinGainUntil: vrCoinGainState.until,
    micEnabled: Boolean(latestVoiceState.micEnabled),
    isSpeaking: Boolean(latestVoiceState.isSpeaking),
    nearbySpeakers: latestVoiceState.nearbySpeakers || [],
    connectionState: hud?.lastConnectionState || (network.connected ? 'connected' : 'solo'),
    onlineCount: hud?.lastOnlineCount || 1,
    pingMs: network.lastPingMs,
    floor: player.getCurrentFloor(),
    waypoint: activeCampusWaypoint,
    ...survExtra,
    ...combatExtra,
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
    network.sendMove(
      player.position.x,
      player.getFeetY(),
      player.position.z,
      player.yaw,
      true,
      undefined,
      player.getCurrentFloor()
    );
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
  const sp = mapData?.spawn || { x: 0, z: 2, yaw: 0, floor: 0 };
  const yaw = typeof sp.yaw === 'number' ? sp.yaw : 0;
  return {
    pos: { x: sp.x, z: sp.z, floor: sp.floor ?? 0 },
    lookAt: { x: sp.x - Math.sin(yaw) * 4, z: sp.z - Math.cos(yaw) * 4 },
    yaw
  };
}

function applyMapData(rawMap, liveUpdate = false) {
  if (!rawMap) return;
  closeCielOsPc({ restoreCamera: false });
  currentMapData = normalizeMapData(rawMap);
  lab.rebuildWorld(currentMapData, {
    skipCombatFallback: Boolean(currentMapData?.jpoIsolated || isJpoDemoActive())
  });
  survivalArena?.setMapData?.(currentMapData);
  if (survivalState.introMapContext) {
    survivalState.introMapContext = {
      colliders: getDynamicMapColliders(currentMapData),
      bounds: currentMapData.bounds,
      mapData: currentMapData
    };
  }
  lab.updateStationBadges(gameState.profile.grades);
  sceneMgr.updateWorldBounds(currentMapData.bounds);
  if (!survivalState.inWaitingRoom && !survivalState.detained && !combatState.inWaitingRoom && !combatState.inActiveMatch) {
    player.setWalkableSurfaces?.(lab.walkableSurfaces);
    player.setSpatialHash?.(lab.spatialHash);
    player.setColliders(lab.colliders);
    player.setBounds(currentMapData.bounds);
  }
  hud?.miniMap?.setMapData?.(currentMapData);
  hud?.setMapData?.(currentMapData);
  tabletOS?.setMapData?.(currentMapData);
  syncWallLeaderboard();

  if (liveUpdate && joined) {
    const b = currentMapData.bounds;
    const pos = player.position;
    const outOfBounds =
      pos.x < b.minX + 0.5 || pos.x > b.maxX - 0.5 || pos.z < b.minZ + 0.5 || pos.z > b.maxZ - 0.5;
    if (outOfBounds || player._collides?.(pos.x, pos.z, player.getFeetY())) {
      const pose = getSpawnPose(currentMapData);
      player.teleportTo(pose.pos, pose.lookAt);
    }
    const zone = getZoneAtPositionInMap(currentMapData, player.position.x, player.position.z, player.getCurrentFloor());
    lastZoneId = zone.id;
    hud?.setCurrentZone?.(zone);
  }
}

async function fetchInitialMap() {
  if (isJpoDemoActive() || (initialJpoActive && !joined)) return;
  const remoteMap = await network.fetchMap(3500);
  if (remoteMap) {
    if (isJpoDemoActive()) return;
    applyMapData(remoteMap, false);
    standardMapData = currentMapData;
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
  touchControls?.setVisible(joined && !active && !vrOn && !isDetentionSeatedActive() && gameState.touchMode);
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

async function openTp(tpId, stationItem = null, { skipBriefing = false } = {}) {
  const tp = getStationById(tpId);
  const factory = MINIGAME_FACTORIES[tpId];
  if (!tp || !factory) return;

  const jpoDemo = isJpoDemoActive();
  if (jpoDemo && !skipBriefing && jpoBriefingModal && getJpoMissionBriefing(tpId)) {
    lab.setHoveredInteractable?.(null);
    hoveredInteractable = null;
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    sfx.interact();
    setModalActive(true, !survivalState.inActiveMatch, true);
    jpoBriefingModal.open(tpId, {
      mode: 'start',
      onStart: () => {
        openTp(tpId, stationItem, { skipBriefing: true });
      },
      onCancel: () => {
        setModalActive(false, false, false);
      }
    });
    return;
  }

  const openSeq = ++tpOpenSeqId;
  lab.setHoveredInteractable?.(null);
  hoveredInteractable = null;

  if (!gameState.profile.questAccepted) {
    gameState.profile.questAccepted = true;
    if (!jpoDemo) {
      network.acceptQuest(gameState.profile.name);
    }
  }

  sfx.interact();
  if (!jpoDemo) {
    network.sendActivity(`En ${tp.shortTitle}`);
  }
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
    sceneMgr,
    jpoMode: jpoDemo,
    onOpenHelp: jpoDemo ? () => jpoBriefingModal?.open?.(tpId, { mode: 'help' }) : null,
    onComplete: ({ tpId: doneId, score, durationSec }) => {
      const safeScore = Number.isFinite(Number(score))
        ? Math.max(0, Math.min(20, Math.round(Number(score) * 10) / 10))
        : 0;
      const allTps = getDynamicAllTps();
      const wasAllAt20 = hasAllTpsAt20(gameState.profile.grades, allTps);
      const p = { ...gameState.profile, grades: { ...gameState.profile.grades } };
      const prev = typeof p.grades[doneId] === 'number' ? p.grades[doneId] : -1;
      if (safeScore > prev) p.grades[doneId] = safeScore;
      const coreVals = TP_CATALOG.map((item) => p.grades[item.id])
        .filter((v) => typeof v === 'number' && Number.isFinite(v))
        .map((v) => Math.max(0, Math.min(20, v)));
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
      if (isJpoDemoActive()) {
        hud.toast(`${tp.icon} ${tp.shortTitle} terminé : ${safeScore.toFixed(1)}/20 !`, safeScore >= 10 ? 'success' : 'info');
        return;
      }
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
      jpoBriefingModal?.close?.();
      if (replayTpId) {
        openTp(replayTpId, null, { skipBriefing: true });
        return;
      }
      if (!isJpoDemoActive()) {
        network.sendActivity('Dans l’atelier');
      }
      voiceChat.setInTp(false);
      setModalActive(false, false, false);
      sceneMgr.resumeRenderLoop?.();
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

let activePcSession = null;
let cielOsDom = null;
let cielOsTouchRepeatTimer = null;
let lastCielOsPadKey = '';

function clearCielOsTouchRepeat() {
  if (cielOsTouchRepeatTimer) {
    clearInterval(cielOsTouchRepeatTimer);
    cielOsTouchRepeatTimer = null;
  }
}

function syncCielOsTouchPad(force = false) {
  if (!cielOsDom?.touchPad) return;
  const visible = Boolean(activePcSession && gameState.touchMode && !vrManager?.isVrActive?.());
  cielOsDom.touchPad.classList.toggle('hidden', !visible);
  if (!visible) {
    clearCielOsTouchRepeat();
    lastCielOsPadKey = '';
    return;
  }
  const desktop = activePcSession.pcStation?.desktop;
  const appId = desktop?.activeAppId || null;
  const flagActive = appId === 'minesweeper' ? Boolean(desktop?.games?.get?.('minesweeper')?.flagMode) : false;
  const key = `${appId || 'desktop'}:${flagActive ? '1' : '0'}`;
  if (!force && key === lastCielOsPadKey) return;
  lastCielOsPadKey = key;
  clearCielOsTouchRepeat();

  const layout = getCielOsTouchLayout(appId);
  cielOsDom.touchDpad.classList.toggle('hidden', !layout.showDpad);
  cielOsDom.touchDpad.dataset.repeat = layout.dpadRepeat ? '1' : '0';
  if (cielOsDom.touchHint) {
    cielOsDom.touchHint.textContent = layout.hint || '';
  }
  if (cielOsDom.touchActions) {
    cielOsDom.touchActions.innerHTML = '';
    for (const act of layout.actions || []) {
      const btn = document.createElement('button');
      btn.type = 'button';
      const isToggled = act.toggle && appId === 'minesweeper' && flagActive;
      btn.className = `ciel-os-touch-btn${act.primary ? ' primary' : ''}${isToggled ? ' active' : ''}`;
      btn.textContent = act.label;
      btn.dataset.actionId = act.id;
      const fireAction = () => {
        const curDesktop = activePcSession?.pcStation?.desktop;
        if (!curDesktop) return;
        if (act.terminalCmd) {
          curDesktop.executeTerminalCommand?.(act.terminalCmd);
        } else if (act.code) {
          curDesktop.handleKeyDown?.(act.code, act.key || act.code);
        }
        curDesktop.redraw?.();
        syncCielOsTouchPad(true);
      };
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.add('pressed');
        fireAction();
      });
      const release = () => btn.classList.remove('pressed');
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('pointerleave', release);
      cielOsDom.touchActions.appendChild(btn);
    }
  }
}

function ensureCielOsOverlayUi() {
  if (cielOsDom || typeof document === 'undefined' || !document.body) return cielOsDom;

  const bar = document.createElement('div');
  bar.id = 'ciel-os-session-bar';
  bar.className = 'ciel-os-session-bar hidden';
  bar.innerHTML = `
    <div class="ciel-os-bar-left">
      <span class="ciel-os-bar-badge">🖥️ CIEL OS 4.26</span>
      <span id="ciel-os-bar-title" class="ciel-os-bar-title">Poste PC</span>
      <span class="ciel-os-bar-hint">Touchez ou cliquez l’écran • Plein Écran Confort recommandé sur mobile</span>
    </div>
    <div class="ciel-os-bar-actions">
      <button type="button" id="ciel-os-btn-comfort" class="ciel-os-bar-btn primary">⛶ Mode Plein Écran Confort</button>
      <button type="button" id="ciel-os-btn-exit" class="ciel-os-bar-btn danger">✕ Quitter le PC</button>
    </div>
  `;
  document.body.appendChild(bar);

  const comfortBackdrop = document.createElement('div');
  comfortBackdrop.id = 'ciel-os-comfort-backdrop';
  comfortBackdrop.className = 'ciel-os-comfort-backdrop hidden';
  comfortBackdrop.innerHTML = `
    <div class="ciel-os-comfort-frame">
      <canvas id="ciel-os-comfort-canvas" width="1024" height="640"></canvas>
    </div>
  `;
  document.body.appendChild(comfortBackdrop);

  const touchPad = document.createElement('div');
  touchPad.id = 'ciel-os-touch-pad';
  touchPad.className = 'ciel-os-touch-pad hidden';
  touchPad.innerHTML = `
    <div id="ciel-os-touch-dpad" class="ciel-os-touch-dpad hidden">
      <button type="button" class="ciel-os-dpad-btn up" data-key-code="ArrowUp" aria-label="Haut">▲</button>
      <button type="button" class="ciel-os-dpad-btn left" data-key-code="ArrowLeft" aria-label="Gauche">◀</button>
      <button type="button" class="ciel-os-dpad-btn right" data-key-code="ArrowRight" aria-label="Droite">▶</button>
      <button type="button" class="ciel-os-dpad-btn down" data-key-code="ArrowDown" aria-label="Bas">▼</button>
    </div>
    <div class="ciel-os-touch-right">
      <div id="ciel-os-touch-hint" class="ciel-os-touch-hint"></div>
      <div id="ciel-os-touch-actions" class="ciel-os-touch-actions"></div>
    </div>
  `;
  document.body.appendChild(touchPad);

  const comfortCanvas = comfortBackdrop.querySelector('#ciel-os-comfort-canvas');
  if (comfortCanvas?.style) {
    comfortCanvas.style.touchAction = 'none';
  }
  const comfortCtx = comfortCanvas?.getContext?.('2d') || null;
  const btnComfort = bar.querySelector('#ciel-os-btn-comfort');
  const btnExit = bar.querySelector('#ciel-os-btn-exit');
  const titleEl = bar.querySelector('#ciel-os-bar-title');
  const touchDpad = touchPad.querySelector('#ciel-os-touch-dpad');
  const touchActions = touchPad.querySelector('#ciel-os-touch-actions');
  const touchHint = touchPad.querySelector('#ciel-os-touch-hint');

  touchDpad?.querySelectorAll('[data-key-code]').forEach((btn) => {
    const code = btn.dataset.keyCode;
    const stepKey = () => {
      const desktop = activePcSession?.pcStation?.desktop;
      if (!desktop) return;
      desktop.handleKeyDown?.(code, code);
      desktop.redraw?.();
    };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.classList.add('pressed');
      stepKey();
      clearCielOsTouchRepeat();
      if (touchDpad.dataset.repeat === '1') {
        cielOsTouchRepeatTimer = setInterval(stepKey, 125);
      }
    });
    const endPress = () => {
      btn.classList.remove('pressed');
      clearCielOsTouchRepeat();
    };
    btn.addEventListener('pointerup', endPress);
    btn.addEventListener('pointercancel', endPress);
    btn.addEventListener('pointerleave', endPress);
  });

  btnComfort?.addEventListener('click', () => {
    sfx.osClick?.();
    toggleCielOsComfortMode();
  });

  btnExit?.addEventListener('click', () => {
    sfx.osWindowClose?.();
    closeCielOsPc();
  });

  const eventToComfortUv = (ev) => {
    if (!comfortCanvas) return null;
    const rect = comfortCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const u = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (ev.clientY - rect.top) / rect.height));
    return { x: u, y: v };
  };

  let comfortActivePointerId = null;
  comfortCanvas?.addEventListener('pointermove', (ev) => {
    if (!activePcSession?.comfortMode) return;
    if (comfortActivePointerId !== null && ev.pointerId !== comfortActivePointerId && ev.pointerType !== 'mouse') return;
    const uv = eventToComfortUv(ev);
    if (uv) activePcSession.pcStation.desktop.handlePointerMoveUv(uv);
  });

  comfortCanvas?.addEventListener('pointerdown', (ev) => {
    if (!activePcSession?.comfortMode) return;
    ev.preventDefault();
    comfortActivePointerId = ev.pointerId ?? 0;
    comfortCanvas.setPointerCapture?.(ev.pointerId);
    const uv = eventToComfortUv(ev);
    if (uv) {
      activePcSession.pcStation.desktop.handlePointerDownUv(uv, ev.button ?? 0);
      syncCielOsTouchPad(true);
    }
  });

  const endComfortPointer = (ev) => {
    if (!activePcSession?.comfortMode) return;
    if (comfortActivePointerId !== null && ev.pointerId !== undefined && ev.pointerId !== comfortActivePointerId) return;
    comfortActivePointerId = null;
    if (comfortCanvas.hasPointerCapture?.(ev.pointerId)) {
      comfortCanvas.releasePointerCapture?.(ev.pointerId);
    }
    const uv = eventToComfortUv(ev);
    if (uv) {
      activePcSession.pcStation.desktop.handlePointerUpUv(uv, ev.button ?? 0);
      syncCielOsTouchPad(true);
    }
  };
  comfortCanvas?.addEventListener('pointerup', endComfortPointer);
  comfortCanvas?.addEventListener('pointercancel', endComfortPointer);

  comfortCanvas?.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
  });

  cielOsDom = {
    bar,
    comfortBackdrop,
    comfortCanvas,
    comfortCtx,
    btnComfort,
    btnExit,
    titleEl,
    touchPad,
    touchDpad,
    touchActions,
    touchHint
  };
  return cielOsDom;
}

function toggleCielOsComfortMode(forceState = null) {
  if (!activePcSession) return false;
  const dom = ensureCielOsOverlayUi();
  activePcSession.comfortMode =
    typeof forceState === 'boolean' ? forceState : !activePcSession.comfortMode;
  if (dom) {
    dom.comfortBackdrop.classList.toggle('hidden', !activePcSession.comfortMode);
    if (dom.btnComfort) {
      dom.btnComfort.textContent = activePcSession.comfortMode
        ? '🖥️ Vue Écran 3D Bureau'
        : '⛶ Mode Plein Écran Confort';
    }
  }
  syncCielOsTouchPad(true);
  return activePcSession.comfortMode;
}

function closeCielOsPc({ restoreCamera = true } = {}) {
  clearCielOsTouchRepeat();
  lastCielOsPadKey = '';
  if (vrManager?.activePcStation) {
    vrManager.closeCielOsPanel();
  }
  if (!activePcSession) return false;
  const prev = activePcSession;
  activePcSession = null;
  if (prev.pcStation) {
    prev.pcStation.desktop?.gameInstances?.get?.('minesweeper')?.saveInProgressSnapshot?.();
    prev.pcStation.isActiveSession = false;
  }
  if (cielOsDom) {
    cielOsDom.bar.classList.add('hidden');
    cielOsDom.comfortBackdrop.classList.add('hidden');
    cielOsDom.touchPad?.classList.add('hidden');
  }
  activeCameraTweenId++;
  network.sendActivity('Dans l’atelier');
  setModalActive(false, false, false);
  if (restoreCamera && !vrManager?.isVrActive?.()) {
    player._applyCamera?.();
  }
  return true;
}

async function openCielOsPc(target) {
  if (!target) return false;
  const pcStation =
    target.pcStation || lab.getPcStationById?.(target.pcId || target.objId || target.id);
  if (!pcStation?.desktop) return false;

  pcStation.desktop.setPlayerName(gameState.profile.name || 'Eleve_CIEL');
  sfx.osBoot?.();
  network.sendActivity(`Sur PC (${pcStation.label})`);

  if (vrManager?.isVrActive?.()) {
    pcStation.desktop.onToggleComfort = () => {
      vrManager.closeCielOsPanel();
    };
    vrManager.openCielOsPanel(pcStation, {
      onExit: () => {
        network.sendActivity('Dans l’atelier');
      }
    });
    return true;
  }

  const openSeq = ++tpOpenSeqId;
  lab.setHoveredInteractable?.(null);
  hoveredInteractable = null;
  if (document.pointerLockElement === canvas) {
    document.exitPointerLock?.();
  }

  const startInComfort = Boolean(gameState.touchMode);
  activePcSession = {
    pcStation,
    comfortMode: startInComfort,
    target
  };
  pcStation.isActiveSession = true;
  pcStation.desktop.onRequestExit = () => closeCielOsPc();
  pcStation.desktop.onToggleComfort = () => toggleCielOsComfortMode();

  const dom = ensureCielOsOverlayUi();
  if (dom) {
    if (dom.titleEl) dom.titleEl.textContent = pcStation.label;
    if (dom.btnComfort) {
      dom.btnComfort.textContent = startInComfort
        ? '🖥️ Vue Écran 3D Bureau'
        : '⛶ Mode Plein Écran Confort';
    }
    dom.bar.classList.remove('hidden');
    dom.comfortBackdrop.classList.toggle('hidden', !startInComfort);
  }
  syncCielOsTouchPad(true);

  setModalActive(true, false, true);

  if (!startInComfort) {
    const focusPose = pcStation.getCameraFocusPose?.(player.position);
    if (focusPose?.camPos && focusPose?.lookAt) {
      await animateCameraPose(focusPose.camPos, focusPose.lookAt, 340);
      if (openSeq !== tpOpenSeqId || !joined || !activePcSession) return false;
    }
  }
  pcStation.desktop.redraw();
  return true;
}

const _ndcCenter = new THREE.Vector2(0, 0);
const _ndcScratch = new THREE.Vector2();

function pickActivePcScreenUv(clientX, clientY) {
  if (!activePcSession?.pcStation?.screenMeshes?.length) return null;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  _ndcScratch.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(_ndcScratch, sceneMgr.camera);
  for (const sm of activePcSession.pcStation.screenMeshes) {
    sm.updateWorldMatrix(true, false);
  }
  const hits = raycaster.intersectObjects(activePcSession.pcStation.screenMeshes, false);
  if (hits.length > 0 && hits[0].uv) {
    return hits[0].uv;
  }
  return null;
}

function teleportNearTarget(id) {
  const spot = getStationTeleportInMap(currentMapData, id);
  if (!spot) return;
  player.teleportTo(spot.pos, spot.lookAt);
  if (vrManager?.isVrActive?.()) {
    vrManager._mountVrRigForWorld?.(vrManager.simMode);
  }
  const zone = getZoneAtPositionInMap(currentMapData, player.position.x, player.position.z, player.getCurrentFloor());
  hud?.setCurrentZone?.(zone);
  network.sendMove(
    player.position.x,
    player.getFeetY(),
    player.position.z,
    player.yaw,
    true,
    vrManager?.isVrActive?.() ? vrManager.getVrSyncPayload() : undefined,
    player.getCurrentFloor()
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
  onAutoFpsGuardChange: (enabled) => sceneMgr.setAutoFpsGuard(enabled),
  onPerfMonitorChange: (enabled) => hud?.setPerfMonitorVisible?.(enabled),
  onFovChange: (fov) => sceneMgr.setFov(fov),
  onCameraModeChange: (mode) => {
    player.setCameraMode(mode);
    touchControls?.syncCameraMode(mode);
  },
  onTouchModeChange: (active) => {
    player.setTouchMode(active);
    sceneMgr.setDeviceProfile(detectDeviceProfile());
    touchControls?.setVisible(joined && !modalOpen && !vrManager?.isVrActive?.() && !isDetentionSeatedActive() && active);
    mainMenu?.updatePlatformButton?.(active);
    platformModal?.syncActiveChoice?.(active);
    syncCielOsTouchPad(true);
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
  onOpenShop: () => openShopUi('skins'),
  onOpenLocker: () => openLockerUi('skins'),
  onOpenTablet: () => openTabletUi(),
  onCloseTablet: (opts) => tabletOS?.close?.(opts) || false,
  onCloseLocker: () => lockerModal?.close?.() || false,
  onRefreshLocker: () => lockerModal?.refresh?.(),
  onOpenChangelog: () => changelogModal?.open?.(),
  onSensitivityChange: (s) => player.setSensitivity(s),
  onTouchSensitivityChange: (s) => player.setTouchSensitivity(s),
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
      const pos = DEBUG_ZONE_SPOTS[code] || (mapZone ? { x: mapZone.x || 0, z: mapZone.z || 0, floor: mapZone.floor ?? 0 } : { x: -3.95, z: 0.65, floor: 0 });
      player.teleportTo(pos, { x: pos.x, z: pos.z - 2 });
      if (vrManager?.isVrActive?.()) {
        vrManager._mountVrRigForWorld?.(vrManager.simMode);
      }
      const zInfo = getZoneAtPositionInMap(currentMapData, pos.x, pos.z, player.getCurrentFloor());
      hud?.setCurrentZone?.(zInfo);
      network.sendMove(
        pos.x,
        player.getFeetY(),
        pos.z,
        player.yaw,
        true,
        vrManager?.isVrActive?.() ? vrManager.getVrSyncPayload() : undefined,
        player.getCurrentFloor()
      );
      network.sendZone(zInfo.id, zInfo.badgeText.replace('📍 ', ''));
      hud?.toast?.(`📍 Téléporté vers ${zInfo.badgeText}`);
    }
  },
  onReturnToMenu: () => returnToMainMenu(false),
  onJpoOpenTp: () => openJpoFeaturedTp(),
  onJpoNewVisit: () => resetJpoVisit('manual'),
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
  onToggleEndInspect: () => {
    if (survivalState.inDefeatDetention) {
      hud?.hideDetention3dHud?.();
    }
  },
  onCloseEnd: () => closeSurvivalEndCinematic()
});

hud?.bindCombatHandlers?.({
  onSelectMode: (mode) => {
    sfx.click();
    network.sendCombatMode(mode);
  },
  onToggleBots: () => toggleCombatBots(),
  onSelectWeapon: (wid) => {
    sfx.click();
    selectCombatWeapon(wid);
  },
  onToggleReady: () => toggleCombatReady(),
  onLeaveLobby: () => leaveCombatArena(),
  onLeaveArena: () => leaveCombatArena(),
  onToggleScoreboard: () => {
    combatState.scoreboardOpen = !combatState.scoreboardOpen;
    hud?.toggleCombatScoreboard?.(combatState.scoreboardOpen, combatState.snapshot, network.clientId);
  },
  onReplay: () => {
    if (combatState.endData?.onReplay) {
      combatState.endData.onReplay();
    } else {
      sfx.click();
      hud?.hideCombatEndOverlay?.();
      network.sendCombatRestart?.();
    }
  },
  onExitArena: () => leaveCombatArena()
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
    onToggleTablet: () => {
      if (joined && !subModalActive && !isDetentionSeatedActive()) toggleTabletUi();
    },
    onTapLookZone: (x, y) => {
      if (joined && !modalOpen) tryRaycastInteract(x, y);
    },
    onCombatFireStart: () => {
      if (!joined || !combatState.inActiveMatch || modalOpen) return;
      combatState.fireHeld = true;
      triggerLocalCombatAttack();
    },
    onCombatFireEnd: () => {
      combatState.fireHeld = false;
    },
    onCombatReload: () => {
      if (!joined || !combatState.inActiveMatch) return;
      sfx.playCombatReload?.();
      network.sendCombatReload?.();
    },
    onCombatCycleWeapon: () => {
      if (!joined || !combatState.inActiveMatch) return;
      cycleCombatWeapon(1);
    },
    onCombatToggleAds: (active) => {
      if (!joined || !combatState.inActiveMatch) return;
      combatState.adsTouchToggle = Boolean(active);
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
  jpoWelcomeModal?.close?.();
  jpoBriefingModal?.close?.();
  stopKioskMode();
  hud?.setJpoMode?.({ roomConfig: null, kiosk: false });
  activeCameraTweenId++;
  tpOpenSeqId++;
  tabletOS?.close?.({ restoreControls: false });
  activeCampusWaypoint = null;
  closeCielOsPc({ restoreCamera: false });
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
  resetCombatClientFull();
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
  if (localPet?.group) localPet.group.visible = false;
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
  tabletOS?.setConnectionStatus?.({
    state: status?.state || (status?.connected ? 'connected' : 'solo'),
    connected: Boolean(status?.connected),
    room: gameState.room,
    pingMs: network.lastPingMs
  });
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
    tabletOS?.setConnectionStatus?.({
      state: 'connected',
      connected: true,
      onlineCount,
      pingMs: network.lastPingMs
    });
  }
});

network.on('welcome', (msg) => {
  const requestedName = gameState.profile.name;
  notifiedNetError = false;
  gameState.room = msg.room || gameState.room;
  gameState.setProfile(msg.profile);
  if (isJpoDemoActive()) {
    jpoState.demoCoins = 0;
    gameState.applyEconomySnapshot({
      coins: 0,
      ownedItems: [],
      equippedSkin: null,
      equippedPet: null,
      equippedTrail: null
    });
  }
  sessionDivineSpecialty = gameState.skin?.secretSkin
    ? ULTIMATE_SECRET_SKIN_ID
    : gameState.skin?.divineSpecialty || null;
  rebuildLocalAvatar(gameState.skin);
  battlePassModal?.refresh?.();
  shopModal?.refresh?.();
  lockerModal?.refresh?.();
  tabletOS?.refresh?.();
  refreshVrTabletSpatialPanel?.();
  lab.setLocalCoins?.(gameState.coins);
  mainMenu?.syncAuthUi?.();
  mainMenu?.renderSkinUi?.();
  hud?._refreshInGameSkinUi?.();
  lab.updateStationBadges(msg.profile.grades);
  remotePlayers.setInstanceFilter(null);
  remotePlayers.setPeers(msg.peers);
  for (const mp of msg.peers || []) {
    if (mp?.metalPipe) remotePlayers.setMetalPipe(mp.id, true);
  }
  metalPipe.equipped = false;
  refreshMetalPipeLocal();
  syncMetalPipeEquip();
  gameState.setRoomRoster(msg.roomRoster || []);
  gameState.setLeaderboard(msg.leaderboard || []);
  remotePlayers.syncLeaderboardRanks(msg.leaderboard || []);
  syncWallLeaderboard(msg.leaderboard || []);
  hud.setNetworkStatus({ state: 'connected', connected: true }, msg.onlineCount);
  tabletOS?.setConnectionStatus?.({
    state: 'connected',
    connected: true,
    onlineCount: msg.onlineCount,
    room: gameState.room,
    pingMs: network.lastPingMs
  });
  tabletOS?.refresh?.();
  hud.clearChat();
  (msg.chatHistory || []).forEach((m) => hud.appendChatMessage(m, false));
  voiceChat.onRoomJoined(msg.peers || []);
  if (msg.survivalState) {
    survivalState.snapshot = msg.survivalState;
    survivalState.phase = msg.survivalState.phase || 'idle';
  }
  if (msg.combatState) {
    combatState.snapshot = msg.combatState;
    combatState.phase = msg.combatState.phase || 'idle';
    combatState.mode = msg.combatState.mode === 'melee' ? 'melee' : 'guns';
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
  if (msg.combatState) {
    combatState.snapshot = msg.combatState;
    combatState.phase = msg.combatState.phase || 'idle';
    combatState.mode = msg.combatState.mode === 'melee' ? 'melee' : 'guns';
  }
  if (!isSurvivalInstanceRoom(msg.room)) {
    if (!isCombatInstanceRoom(msg.room)) {
      remotePlayers.setInstanceFilter(null);
    }
    if (survivalState.phase === 'ended' || survivalState.inDefeatDetention) {
      closeSurvivalEndCinematic({ skipSendReturn: true });
    }
  }
  if (!isCombatInstanceRoom(msg.room)) {
    if (combatState.inActiveMatch || combatState.inWaitingRoom || combatState.phase === 'ended') {
      resetCombatClientFull();
      setModalActive(false, false, false);
      teleportWithWorldMode(null, null, 'hall');
    }
  }
  remotePlayers.setPeers(msg.peers || []);
  remotePlayers.syncLeaderboardRanks(gameState.leaderboard || []);
  gameState.setRoomRoster(msg.roomRoster || []);
  hud.setNetworkStatus({ state: 'connected', connected: true }, msg.onlineCount);
  tabletOS?.setConnectionStatus?.({
    state: 'connected',
    connected: true,
    onlineCount: msg.onlineCount,
    room: gameState.room,
    pingMs: network.lastPingMs
  });
  tabletOS?.refresh?.();
  hud.clearChat();
  (msg.chatHistory || []).forEach((m) => hud.appendChatMessage(m, false));
  voiceChat.onRoomJoined(msg.peers || []);
  if (survivalState.inWaitingRoom && msg.survivalState) {
    survivalArena.updateWaitingBoard(msg.survivalState, true);
    syncSurvivalPanelMode();
  }
  if (combatState.inWaitingRoom && msg.combatState) {
    combatArena.updateWaitingBoard(msg.combatState, true);
    syncCombatPanelMode();
  }
  syncVrWatchHud();
  if (isSurvivalInstanceRoom(msg.room)) {
    hud.toast('🔒 Instance Survie isolée prête (participants uniquement).', 'info');
  } else if (isCombatInstanceRoom(msg.room)) {
    hud.toast('⚔️ Instance Arène de Combat isolée prête !', 'info');
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
  shopModal?.refresh?.();
  lockerModal?.refresh?.();
  tabletOS?.refresh?.();
  refreshVrTabletSpatialPanel?.();
  lab.setLocalCoins?.(gameState.coins);
  mainMenu?.syncAuthUi?.();
  mainMenu?.renderSkinUi?.();
  hud?._refreshInGameSkinUi?.();
  hud?.refresh?.();
  syncWallLeaderboard();
  syncVrWatchHud();
});

network.on('coins_earned', (msg) => {
  const sourceLabels = {
    tp: 'TP 3D',
    survival: msg?.outcome === 'victory' ? 'Victoire Survie' : 'Survie Horreur',
    detention: 'Tableau de variation',
    combat: msg?.won ? 'Victoire Arène Combat' : 'Arène Combat CIEL',
    formative: 'TP CIEL Formative',
    arcade: msg?.isNewRecord ? 'Nouveau Record !' : msg?.gameLabel || 'Mini-Jeu PC',
    debug: 'Debug'
  };
  handleCoinReward({
    coinsEarned: msg?.coinsEarned,
    source: msg?.source || 'reward',
    label: sourceLabels[msg?.source] || '',
    profile: msg?.profile || null,
    isNewRecord: Boolean(msg?.isNewRecord)
  });
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
  shopModal?.refresh?.();
  lockerModal?.refresh?.();
  tabletOS?.refresh?.();
  refreshVrTabletSpatialPanel?.();
  lab.setLocalCoins?.(gameState.coins);
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
  if (isJpoDemoActive()) return;
  applyMapData(map, true);
  standardMapData = currentMapData;
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
  if (res.coinsEarned > 0) {
    handleCoinReward({
      coinsEarned: res.coinsEarned,
      source: 'tp',
      label: res.isFirstValidation ? '1ère validation !' : 'TP 3D',
      profile: res.profile
    });
    hud.toast(`+${res.xpGain} XP • +${res.coinsEarned} 🪙 CC enregistrés sur le serveur !`, 'success');
  } else {
    syncVrWatchHud();
    hud.toast(`+${res.xpGain} XP enregistrés sur le serveur !`, 'success');
  }
});

network.on('player_joined', ({ player: p, onlineCount, roomRoster }) => {
  remotePlayers.upsertPeer(p);
  if (p?.metalPipe) remotePlayers.setMetalPipe(p.id, true);
  voiceChat.onPeerJoined(p);
  if (roomRoster) gameState.setRoomRoster(roomRoster);
  hud.setNetworkStatus(true, onlineCount);
  refreshWallLeaderboard();
  hud.toast(`${p.name} a rejoint l’atelier !`);
});

network.on('player_moved', ({ id, x, y, z, yaw, floor, vrData }) => {
  remotePlayers.movePeer(id, x, y, z, yaw, vrData, floor);
});

network.on('player_skin_updated', ({ id, skin, equippedSkin, equippedPet, equippedTrail }) => {
  const merged = skin ? { ...skin } : {};
  if (equippedSkin !== undefined && equippedSkin) merged.shopSkinId = equippedSkin;
  if (equippedPet !== undefined) {
    if (equippedPet) merged.equippedPet = equippedPet;
    else delete merged.equippedPet;
  }
  if (equippedTrail !== undefined) {
    if (equippedTrail) merged.equippedTrail = equippedTrail;
    else delete merged.equippedTrail;
  }
  remotePlayers.setSkin(id, merged);
});

function readMetalPipeStorage() {
  try {
    return {
      pass: localStorage.getItem(METAL_PIPE.passStorageKey) || '',
      equipped: localStorage.getItem(METAL_PIPE.equipStorageKey) === '1'
    };
  } catch {
    return { pass: '', equipped: false };
  }
}

function refreshMetalPipeLocal() {
  if (metalPipe.localObj) {
    metalPipe.localObj.parent?.remove(metalPipe.localObj);
    disposeObject3D(metalPipe.localObj);
    metalPipe.localObj = null;
  }
  if (metalPipe.viewObj) {
    metalPipe.viewHolder.remove(metalPipe.viewObj);
    disposeObject3D(metalPipe.viewObj);
    metalPipe.viewObj = null;
  }
  if (!metalPipe.equipped) return;
  if (localAvatar?.rightArm) {
    const bat = buildMetalPipeBatMesh();
    bat.position.set(0, -0.3, -0.08);
    localAvatar.rightArm.add(bat);
    metalPipe.localObj = bat;
  }
  const view = buildMetalPipeBatMesh();
  view.rotation.x = -0.5;
  view.scale.setScalar(1.1);
  metalPipe.viewHolder.add(view);
  metalPipe.viewObj = view;
}

function syncMetalPipeEquip() {
  const stored = readMetalPipeStorage();
  const wants = Boolean(stored.pass && stored.equipped);
  if (wants) {
    network.sendMetalPipeEquip(true, stored.pass);
  } else if (metalPipe.equipped) {
    network.sendMetalPipeEquip(false);
  }
}

function findMetalPipeTarget() {
  const fx = -Math.sin(player.yaw);
  const fz = -Math.cos(player.yaw);
  let best = null;
  let bestDist = Infinity;
  for (const peer of remotePlayers.peers.values()) {
    if (!peer.group?.visible || peer.tumble) continue;
    const dx = peer.group.position.x - player.position.x;
    const dz = peer.group.position.z - player.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > METAL_PIPE.hitRange || dist < 0.001) continue;
    if (dist > 1.1 && (dx * fx + dz * fz) / dist < 0.35) continue;
    if (Math.abs(peer.group.position.y - player.getFeetY()) > 2.4) continue;
    if (dist < bestDist) {
      bestDist = dist;
      best = peer;
    }
  }
  return best;
}

function tryMetalPipeAttack() {
  if (!joined || !metalPipe.equipped || modalOpen || metalPipe.launch) return false;
  if (vrManager?.isVrActive?.() || combatState.inActiveMatch || combatState.inWaitingRoom) return false;
  if (document.pointerLockElement !== canvas) return false;
  const nowMs = Date.now();
  if (nowMs - metalPipe.lastAttackAt < METAL_PIPE.cooldownMs) return true;
  metalPipe.lastAttackAt = nowMs;
  metalPipe.swingUntil = nowMs + METAL_PIPE.swingMs;
  const target = findMetalPipeTarget();
  if (target) network.sendMetalPipeHit(target.id);
  return true;
}

function startLocalMetalPipeLaunch(msg) {
  if (!joined || metalPipe.launch) return;
  if (player.seated || player.hidingInRack || vrManager?.isVrActive?.()) return;
  metalPipe.launch = {
    start: performance.now(),
    duration: Number(msg.durationMs) || METAL_PIPE.durationMs,
    seed: Number(msg.seed) || 0.5,
    wasLocked: player.movementLocked
  };
  player.setMovementLocked(true);
  player.velocityY = computeLaunchVelocity(msg.height);
  player.isGrounded = false;
}

function finishLocalMetalPipeLaunch() {
  const launch = metalPipe.launch;
  metalPipe.launch = null;
  if (localAvatar?.group) {
    localAvatar.group.rotation.x = 0;
    localAvatar.group.rotation.z = 0;
  }
  sceneMgr.camera.rotation.z = 0;
  if (launch) player.setMovementLocked(launch.wasLocked);
}

function updateMetalPipeLocal(dt) {
  metalPipeFx.update(dt);
  const nowMs = Date.now();
  const launch = metalPipe.launch;
  if (launch) {
    const elapsed = performance.now() - launch.start;
    const tum = computeTumble(elapsed, launch.duration, launch.seed);
    if (localAvatar?.group) {
      localAvatar.group.rotation.x = tum.x;
      localAvatar.group.rotation.z = tum.z;
      localAvatar.group.rotation.y += tum.y;
    }
    sceneMgr.camera.rotation.z = Math.sin(elapsed * 0.025) * 0.14 * (1 - Math.min(1, elapsed / launch.duration));
    const landed = elapsed > 450 && player.isGrounded;
    if (landed || elapsed >= METAL_PIPE.hardCapMs || !joined) {
      finishLocalMetalPipeLaunch();
    }
  }
  const swinging = nowMs < metalPipe.swingUntil;
  if (metalPipe.equipped && metalPipe.localObj && localAvatar?.rightArm && !launch) {
    localAvatar.rightArm.rotation.x = swinging ? -2.1 : -0.62;
  }
  const showView =
    joined &&
    metalPipe.equipped &&
    Boolean(metalPipe.viewObj) &&
    gameState.cameraMode !== 'third' &&
    !vrManager?.isVrActive?.() &&
    !combatState.inActiveMatch &&
    !modalOpen;
  metalPipe.viewRoot.visible = showView;
  if (showView) {
    metalPipe.viewRoot.position.copy(sceneMgr.camera.position);
    metalPipe.viewRoot.quaternion.copy(sceneMgr.camera.quaternion);
    const progress = swinging ? 1 - (metalPipe.swingUntil - nowMs) / METAL_PIPE.swingMs : 0;
    const arc = Math.sin(progress * Math.PI);
    metalPipe.viewHolder.position.set(0.3 - arc * 0.2, -0.32 + arc * 0.08, -0.5 - arc * 0.1);
    metalPipe.viewHolder.rotation.set(-arc * 1.35, 0, arc * 0.55);
  }
}

function handleMetalPipeLaunch(msg) {
  if (!msg || msg.seed === metalPipe.lastSeed) return;
  metalPipe.lastSeed = msg.seed;
  const targetIsLocal = msg.targetId === network.clientId;
  const targetPeer = remotePlayers.peers.get(msg.targetId);
  const impactPos = new THREE.Vector3(
    targetIsLocal ? player.position.x : targetPeer?.group?.position.x ?? msg.x,
    (targetIsLocal ? player.getFeetY() : targetPeer?.group?.position.y ?? msg.y) + 1.1,
    targetIsLocal ? player.position.z : targetPeer?.group?.position.z ?? msg.z
  );
  metalPipeFx.spawn(impactPos);
  const dist = impactPos.distanceTo(sceneMgr.camera.position);
  sfx.playMetalPipeImpact(Math.max(0.3, Math.min(1, 1 - dist / 45)));
  if (msg.attackerId !== network.clientId) {
    remotePlayers.triggerMetalPipeSwing(msg.attackerId, METAL_PIPE.swingMs);
  }
  if (targetIsLocal) {
    startLocalMetalPipeLaunch(msg);
    showSpeechBubble(localBubble, '💥 CLANG !', { isEmote: true, color: '#facc15' });
  } else {
    remotePlayers.startTumble(msg.targetId, Number(msg.durationMs) || METAL_PIPE.durationMs, Number(msg.seed) || 0.5);
    remotePlayers.showBubble(msg.targetId, '💥 CLANG !', { isEmote: true, color: '#facc15' });
  }
}

window.addEventListener('storage', (e) => {
  if (e.key === METAL_PIPE.passStorageKey || e.key === METAL_PIPE.equipStorageKey) {
    syncMetalPipeEquip();
  }
});

network.on('metal_pipe_equipped', ({ id, enabled }) => {
  if (id === network.clientId) {
    metalPipe.equipped = Boolean(enabled);
    refreshMetalPipeLocal();
    if (enabled) hud?.toast?.('🔩 Metal Pipe Bat équipé (clic gauche pour frapper)', 'success');
  } else {
    remotePlayers.setMetalPipe(id, enabled);
  }
});

network.on('metal_pipe_denied', () => {
  metalPipe.equipped = false;
  refreshMetalPipeLocal();
  try {
    localStorage.removeItem(METAL_PIPE.equipStorageKey);
  } catch {}
  hud?.toast?.('🔒 Metal Pipe Bat réservé aux administrateurs', 'error');
});

network.on('metal_pipe_launch', handleMetalPipeLaunch);

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

network.on('combat_state', ({ state }) => {
  if (!state) return;
  combatState.snapshot = state;
  combatState.phase = state.phase || 'idle';
  combatState.mode = state.mode === 'melee' ? 'melee' : 'guns';
  if (combatState.inWaitingRoom && !combatState.inActiveMatch) {
    const me = (state.lobbyPlayers || []).find((p) => p.id === network.clientId);
    if (me?.weaponId) {
      combatState.selectedWeaponId = me.weaponId;
    } else {
      const defW = getDefaultWeaponForMode(combatState.mode);
      if (getCombatWeaponById(combatState.selectedWeaponId)?.mode !== combatState.mode) {
        combatState.selectedWeaponId = defW.id;
      }
    }
    combatArena.updateWaitingBoard(state, true);
    syncCombatPanelMode();
  }
  if (combatState.inActiveMatch) {
    const me = getLocalCombatFighter(state);
    if (me?.weaponId && me.weaponId !== combatState.selectedWeaponId) {
      combatState.selectedWeaponId = me.weaponId;
      syncCombatViewWeapon(me.weaponId);
    }
    if (!vrManager?.isVrActive?.()) {
      hud?.updateCombatHud?.(state, network.clientId);
      const wSpec = getCombatWeaponById(combatState.selectedWeaponId);
      touchControls?.setCombatMode?.(true, {
        mode: combatState.mode,
        weaponShortName: wSpec?.shortName || ''
      });
    }
  }
});

network.on('combat_started', ({ state }) => {
  if (!state) return;
  startCombatMatchClient(state);
});

network.on('combat_tick', ({ state }) => {
  if (!state) return;
  combatState.snapshot = state;
  combatState.phase = state.phase || 'active';
  combatState.mode = state.mode === 'melee' ? 'melee' : 'guns';
  if (!combatState.inActiveMatch) return;

  const me = getLocalCombatFighter(state);
  if (me) {
    const wasAlive = combatState.localAlive;
    combatState.localAlive = Boolean(me.alive);
    if (me.alive && !wasAlive) {
      player.teleportTo(
        { x: me.x, z: me.z },
        { x: me.x - Math.sin(me.yaw || 0) * 4, z: me.z - Math.cos(me.yaw || 0) * 4 }
      );
      if (vrManager?.isVrActive?.()) {
        vrManager.syncWorldTeleport?.(me.x, me.z, me.yaw);
      }
      combatState.lastLocalHp = me.hp;
      hud?.toast?.('⚡ Réapparition dans l’arène !', 'info');
    } else if (me.alive && me.hp < combatState.lastLocalHp) {
      sfx.playCombatHurt?.();
      hud?.triggerCombatDamageFlash?.();
      combatState.lastLocalHp = me.hp;
    } else if (me.alive && me.hp > combatState.lastLocalHp + 2) {
      sfx.playCombatPickup?.();
      combatState.lastLocalHp = me.hp;
    } else {
      combatState.lastLocalHp = me.hp;
    }
    if (me.weaponId && me.weaponId !== combatState.selectedWeaponId) {
      combatState.selectedWeaponId = me.weaponId;
      syncCombatViewWeapon(me.weaponId);
    }
  }

  const fighters = Array.isArray(state.fighters) ? state.fighters : [];
  for (const f of fighters) {
    if (!f.isBot && f.id !== network.clientId) {
      remotePlayers.setPeerCombatWeapon(f.id, f.alive ? f.weaponId : null);
    }
  }

  if (!vrManager?.isVrActive?.()) {
    hud?.updateCombatHud?.(state, network.clientId);
    if (combatState.scoreboardOpen) {
      hud?.toggleCombatScoreboard?.(true, state, network.clientId);
    }
    const wSpec = getCombatWeaponById(combatState.selectedWeaponId);
    touchControls?.setCombatMode?.(true, {
      mode: combatState.mode,
      weaponShortName: wSpec?.shortName || ''
    });
  } else {
    syncVrWatchHud();
  }
});

network.on('combat_attack_fx', (msg) => {
  if (!msg) return;
  if (msg.state) {
    combatState.snapshot = msg.state;
  }
  if (!combatState.inActiveMatch) return;

  const vrActive = Boolean(vrManager?.isVrActive?.());
  const isLocalAttacker = msg.attackerId === network.clientId;
  const spec = getCombatWeaponById(msg.weaponId) || getDefaultWeaponForMode(combatState.mode);
  if (msg.mode === 'melee') {
    sfx.playCombatMelee?.(spec.id);
    if (msg.attackerPos) {
      combatVfx.spawnMeleeSlash(spec.id, msg.attackerPos.x, 1.35, msg.attackerPos.z, msg.attackerPos.yaw || 0);
    }
  } else {
    sfx.playCombatShot?.(spec.id);
    const rays = Array.isArray(msg.rays) ? msg.rays : [];
    const useExactWorldRay = Boolean(msg.isVrShot) || (isLocalAttacker && vrActive);
    const activeWObj = !useExactWorldRay && gameState.cameraMode !== 'third' ? combatState.viewWeaponObj : null;
    let hasMuzzleOrigin = false;
    if (!useExactWorldRay && isLocalAttacker && activeWObj?.group && activeWObj?.muzzleOffset) {
      activeWObj.group.updateMatrixWorld(true);
      _combatMuzzleWorld.set(activeWObj.muzzleOffset.x, activeWObj.muzzleOffset.y, activeWObj.muzzleOffset.z);
      activeWObj.group.localToWorld(_combatMuzzleWorld);
      hasMuzzleOrigin = true;
    }
    for (const r of rays) {
      const sx = hasMuzzleOrigin ? _combatMuzzleWorld.x : r.sx;
      const sy = hasMuzzleOrigin ? _combatMuzzleWorld.y : r.sy;
      const sz = hasMuzzleOrigin ? _combatMuzzleWorld.z : r.sz;
      combatVfx.spawnShot(spec.id, sx, sy, sz, r.ex, r.ey, r.ez);
    }
  }

  if (msg.attackerId && !isLocalAttacker) {
    if (String(msg.attackerId).startsWith('bot-')) {
      combatArena.triggerBotAttackAnim(msg.attackerId);
    } else {
      remotePlayers.triggerPeerAttackAnim(msg.attackerId);
    }
  }

  const hits = Array.isArray(msg.hits) ? msg.hits : [];
  let localHit = false;
  let localKilled = false;
  let localHeadshot = false;
  let localDamage = 0;
  let lastHitPos = null;
  let localWasHit = false;
  for (const h of hits) {
    const victimId = h.targetId || h.victimId;
    if (isLocalAttacker && victimId && victimId !== network.clientId) {
      localHit = true;
      localDamage += Number(h.damage) || 0;
      if (h.killed) localKilled = true;
      if (h.headshot) localHeadshot = true;
      if (Number.isFinite(Number(h.hitX)) && Number.isFinite(Number(h.hitY)) && Number.isFinite(Number(h.hitZ))) {
        lastHitPos = { x: Number(h.hitX), y: Number(h.hitY), z: Number(h.hitZ) };
      }
    }
    if (victimId === network.clientId) {
      localWasHit = true;
    }
  }
  if (localHit) {
    sfx.playCombatHitmarker?.(localKilled);
    if (vrActive) {
      vrManager.triggerCombatHitFeedback?.({
        killed: localKilled,
        headshot: localHeadshot,
        damage: localDamage,
        hitPos: lastHitPos
      });
    } else {
      hud?.triggerCombatHitmarker?.(localKilled);
    }
  }
  if (localWasHit) {
    sfx.playCombatHurt?.();
    if (vrActive) {
      vrManager.pulseBothHands?.(0.75, 110);
    } else {
      hud?.triggerCombatDamageFlash?.();
    }
  }

  if (combatState.localAlive && (isLocalAttacker || localWasHit)) {
    const me = getLocalCombatFighter(msg.state);
    if (me && me.alive) {
      const dx = me.x - player.position.x;
      const dz = me.z - player.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.2 && dist < 4.5) {
        player.moveHorizontally?.(dx, dz);
        if (vrManager?.isVrActive?.()) {
          vrManager.syncWorldTeleport?.(player.position.x, player.position.z);
        }
      }
    }
  }

  if (msg.state && !vrManager?.isVrActive?.()) {
    hud?.updateCombatHud?.(msg.state, network.clientId);
  }
});

network.on('combat_ended', ({ ended, state }) => {
  endCombatMatchClient(ended, state);
});

function interactWith(target) {
  if (!target) return;
  if (target.id === 'teacher') openTeacherDialogue(target.dialogue || '');
  else if (target.type === 'survival_door') enterSurvivalLobby();
  else if (target.type === 'combat_door') {
    if (!isJpoDemoActive() && (privateDebugMode || !isJpoActive())) {
      enterCombatLobby();
    }
  }
  else if (target.type === 'hiding_rack') toggleHidingInRack(target);
  else if (target.type === 'survival_lobby_console') toggleSurvivalReady();
  else if (target.type === 'survival_lobby_exit') leaveSurvivalLobby();
  else if (target.type === 'combat_lobby_mode') {
    sfx.click();
    const nextMode = combatState.mode === 'melee' ? 'guns' : 'melee';
    network.sendCombatMode(nextMode);
  } else if (target.type === 'combat_lobby_bots') {
    toggleCombatBots();
  } else if (target.type === 'combat_lobby_ready') toggleCombatReady();
  else if (target.type === 'combat_lobby_exit') leaveCombatArena();
  else if (target.type === 'survival_detention_terminal') openDetentionTerminal();
  else if (target.type === 'survival_detention_exit') exitDetentionAndReturnToHall();
  else if (target.type === 'ciel_os_pc') openCielOsPc(target);
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

  if (activePcSession && !isTyping) {
    if (e.code === 'Escape') {
      e.preventDefault();
      closeCielOsPc();
      return;
    }
    const handled = activePcSession.pcStation?.desktop?.handleKeyDown?.(e.code, e.key);
    if (handled) {
      e.preventDefault();
      return;
    }
  }

  if (jpoWelcomeModal?.isOpen?.() && !isTyping) {
    const onWelcomeControl = Boolean(e.target?.closest?.('#jpo-welcome-screen button'));
    if (!onWelcomeControl && (e.code === 'Enter' || e.code === 'Space')) {
      e.preventDefault();
      jpoWelcomeModal.startPlay();
    }
    return;
  }

  if (jpoBriefingModal?.isOpen?.() && !isTyping) {
    if (e.code === 'Escape') {
      e.preventDefault();
      jpoBriefingModal.dismiss();
      return;
    }
    const onBriefingBtn = Boolean(e.target?.closest?.('#jpo-briefing-modal button'));
    if (!onBriefingBtn && (e.code === 'Enter' || e.code === 'Space')) {
      e.preventDefault();
      jpoBriefingModal.confirmPrimary();
      return;
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
      tabletOS?.close?.() ||
      battlePassModal?.closeTrollModal?.() ||
      battlePassModal?.close?.() ||
      shopModal?.close?.() ||
      lockerModal?.close?.() ||
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

  if (e.code === 'Tab' && joined && !subModalActive && !isTyping && !isDetentionSeatedActive()) {
    if (combatState.inActiveMatch) {
      e.preventDefault();
      if (!e.repeat) {
        combatState.scoreboardOpen = true;
        hud?.toggleCombatScoreboard?.(true, combatState.snapshot, network.clientId);
      }
      return;
    }
    if (
      !isJpoDemoActive() &&
      shouldHandleTabShortcut({
        joined,
        isTyping,
        subModalActive,
        isDetentionSeated: isDetentionSeatedActive(),
        isOtherModalOpen: isOtherModalBlockingTablet(),
        inCombatMatch: combatState.inActiveMatch,
        tabletOpen: Boolean(tabletOS?.isOpen?.())
      })
    ) {
      e.preventDefault();
      if (!e.repeat) {
        sfx.click();
        toggleTabletUi();
      }
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
    if (e.code === 'BracketLeft') {
      e.preventDefault();
      cycleDetentionCamera(-1);
      return;
    }
    if (e.code === 'BracketRight') {
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

  if (combatState.inActiveMatch) {
    if (e.code === 'KeyR' && !e.repeat) {
      e.preventDefault();
      sfx.playCombatReload?.();
      network.sendCombatReload?.();
      return;
    }
    if ((e.code.startsWith('Digit') || e.code.startsWith('Numpad')) && !e.repeat) {
      const slotNum = Number(e.code.replace('Digit', '').replace('Numpad', ''));
      const list = getWeaponsByMode(combatState.mode);
      if (slotNum >= 1 && slotNum <= list.length) {
        e.preventDefault();
        sfx.click();
        selectCombatWeapon(list[slotNum - 1].id);
        return;
      }
    }
  }

  if (e.code === 'KeyE' && nearestTarget) {
    e.preventDefault();
    interactWith(nearestTarget);
  } else if (e.code === 'KeyC') {
    e.preventDefault();
    toggleCameraMode();
  } else if (e.code === 'KeyT' && !isJpoDemoActive()) {
    e.preventDefault();
    player.clearKeys();
    hud.toggleChat(true, true);
  } else if (e.code === 'KeyM' && !isJpoDemoActive()) {
    e.preventDefault();
    sfx.click();
    hud.toggleMinimap();
  } else if (!isJpoDemoActive() && (e.code.startsWith('Digit') || e.code.startsWith('Numpad'))) {
    const num = Number(e.code.replace('Digit', '').replace('Numpad', ''));
    if (num >= 1 && num <= QUICK_EMOTES.length) {
      e.preventDefault();
      hud.triggerEmote(num - 1);
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Tab' && combatState.inActiveMatch) {
    combatState.scoreboardOpen = false;
    hud?.toggleCombatScoreboard?.(false);
  }
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
  combatState.fireHeld = false;
  if (combatState.scoreboardOpen) {
    combatState.scoreboardOpen = false;
    hud?.toggleCombatScoreboard?.(false);
  }
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

function getRayHitInteractable(clientX = null, clientY = null, { allowTouch = false, maxDist = 7.5 } = {}) {
  if (!joined || modalOpen || (!allowTouch && gameState.touchMode) || vrManager?.isVrActive?.()) return null;
  if (document.pointerLockElement === canvas || clientX === null || clientY === null) {
    raycaster.setFromCamera(_ndcCenter, sceneMgr.camera);
  } else {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    _ndcScratch.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(_ndcScratch, sceneMgr.camera);
  }
  if (activeWorldMode === 'hall' && !survivalState.inWaitingRoom && !combatState.inWaitingRoom && !combatState.inActiveMatch && !survivalState.detained && !survivalState.inDefeatDetention && !survivalState.introActive && !survivalState.hiddenRack) {
    const curFloor = player.getCurrentFloor();
    const candidates = lab.getNearbyInteractables(player.position.x, player.position.z, maxDist + 2.5, curFloor, _nearbyInteractScratch);
    const occluders = lab.getNearbyOccluders(raycaster.ray.origin, raycaster.ray.direction, maxDist, curFloor, _nearbyOccluderScratch);
    return pickLabInteractable(raycaster, candidates, occluders, maxDist);
  }
  return pickLabInteractable(raycaster, getActiveInteractables(), lab.solidWallMeshes, maxDist);
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
  const item = getRayHitInteractable(clientX, clientY, { allowTouch: true, maxDist: 8.5 });
  if (!item) return false;
  setDesktopHoveredInteractable(null);
  interactWith(item);
  return true;
}

function pickDetentionSurfaceAt(clientX = null, clientY = null) {
  if (!joined || !isDetentionSeatedActive() || vrManager?.isVrActive?.()) return null;
  const surfaces = getActiveWorldSurfaces();
  if (!surfaces.length) return null;
  if (document.pointerLockElement === canvas || clientX === null || clientY === null) {
    raycaster.setFromCamera(_ndcCenter, sceneMgr.camera);
  } else {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    _ndcScratch.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(_ndcScratch, sceneMgr.camera);
  }
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

function updateDetentionSurfaceHover(clientX = null, clientY = null) {
  const surfaces = getActiveWorldSurfaces();
  const hit = pickDetentionSurfaceAt(clientX, clientY);
  for (const surf of surfaces) {
    surf.setHovered?.(hit && hit.surf === surf ? hit.btn.id : null);
  }
  if (!vrManager?.isVrActive?.() && isDetentionSeatedActive()) {
    canvas.style.cursor = hit && document.pointerLockElement !== canvas ? 'pointer' : '';
  }
  return hit;
}

let downPos = { x: 0, y: 0 };
canvas.addEventListener('mousedown', (e) => {
  downPos = { x: e.clientX, y: e.clientY };
  if (vrManager?.isVrActive?.() && vrManager.simMode && e.button === 0) {
    vrManager.setSimInput({ mouseTrigger: true });
    return;
  }
  if (activePcSession && !activePcSession.comfortMode && !vrManager?.isVrActive?.()) {
    const uv = pickActivePcScreenUv(e.clientX, e.clientY);
    if (uv) {
      e.preventDefault();
      activePcSession.pcStation.desktop.handlePointerDownUv(uv, e.button);
      return;
    }
  }
  if (e.button === 0 && tryMetalPipeAttack()) {
    return;
  }
  if (
    joined &&
    combatState.inActiveMatch &&
    !modalOpen &&
    !gameState.touchMode &&
    !vrManager?.isVrActive?.() &&
    !isDetentionSeatedActive()
  ) {
    if (e.button === 0) {
      if (document.pointerLockElement !== canvas) {
        player.requestPointerLock?.();
      }
      combatState.fireHeld = true;
      triggerLocalCombatAttack();
    } else if (e.button === 2) {
      e.preventDefault();
      combatState.adsHeld = true;
    }
  }
});
canvas.addEventListener('mousemove', (e) => {
  if (activePcSession && !activePcSession.comfortMode && !vrManager?.isVrActive?.()) {
    const uv = pickActivePcScreenUv(e.clientX, e.clientY);
    if (uv) {
      canvas.style.cursor = 'pointer';
      activePcSession.pcStation.desktop.handlePointerMoveUv(uv);
    } else {
      canvas.style.cursor = '';
    }
    return;
  }
  if (isDetentionSeatedActive() && !vrManager?.isVrActive?.()) {
    if (document.pointerLockElement === canvas) {
      updateDetentionSurfaceHover(null, null);
    } else {
      lastCursorPos = { x: e.clientX, y: e.clientY };
      if (!player.dragging) {
        updateDetentionSurfaceHover(e.clientX, e.clientY);
      }
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
  if (!vrManager?.isVrActive?.()) {
    setDesktopHoveredInteractable(null);
  }
});
window.addEventListener('blur', () => {
  lastCursorPos = null;
  combatState.fireHeld = false;
  combatState.adsHeld = false;
  setDesktopHoveredInteractable(null);
});
canvas.addEventListener('contextmenu', (e) => {
  if ((vrManager?.isVrActive?.() && vrManager.simMode) || isDetentionSeatedActive() || activePcSession || combatState.inActiveMatch) {
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
  if (e.button === 0) {
    combatState.fireHeld = false;
  }
  if (e.button === 2) {
    combatState.adsHeld = false;
  }
  if (vrManager?.simMode && e.button === 0) {
    vrManager.setSimInput({ mouseTrigger: false });
  }
});
canvas.addEventListener('mouseup', (e) => {
  if (activePcSession && !activePcSession.comfortMode && !vrManager?.isVrActive?.()) {
    const uv = pickActivePcScreenUv(e.clientX, e.clientY);
    if (uv) {
      activePcSession.pcStation.desktop.handlePointerUpUv(uv, e.button);
    }
    return;
  }
  if (isDetentionSeatedActive() && !vrManager?.isVrActive?.() && e.button === 0) {
    const isLocked = document.pointerLockElement === canvas;
    const dragDist = isLocked ? 0 : Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
    if (dragDist <= 6) {
      const hit = pickDetentionSurfaceAt(isLocked ? null : e.clientX, isLocked ? null : e.clientY);
      if (hit?.btn) {
        hit.btn.onClick?.(hit.uv);
      } else if (!isLocked && !gameState.touchMode) {
        player.requestPointerLock();
      }
    }
    return;
  }
  if (combatState.inActiveMatch && e.button === 0 && !vrManager?.isVrActive?.() && !gameState.touchMode) {
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

let pcTouchPointerId = null;
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') return;
  if (activePcSession && !activePcSession.comfortMode && !vrManager?.isVrActive?.()) {
    const uv = pickActivePcScreenUv(e.clientX, e.clientY);
    if (uv) {
      e.preventDefault();
      pcTouchPointerId = e.pointerId;
      canvas.setPointerCapture?.(e.pointerId);
      activePcSession.pcStation.desktop.handlePointerDownUv(uv, 0);
      syncCielOsTouchPad(true);
    }
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse' || e.pointerId !== pcTouchPointerId) return;
  if (!activePcSession || activePcSession.comfortMode || vrManager?.isVrActive?.()) {
    pcTouchPointerId = null;
    return;
  }
  const uv = pickActivePcScreenUv(e.clientX, e.clientY);
  if (uv) activePcSession.pcStation.desktop.handlePointerMoveUv(uv);
});
const endPcTouchPointer = (e) => {
  if (e.pointerType === 'mouse' || e.pointerId !== pcTouchPointerId) return;
  pcTouchPointerId = null;
  if (canvas.hasPointerCapture?.(e.pointerId)) {
    canvas.releasePointerCapture?.(e.pointerId);
  }
  if (activePcSession && !activePcSession.comfortMode && !vrManager?.isVrActive?.()) {
    const uv = pickActivePcScreenUv(e.clientX, e.clientY);
    if (uv) {
      activePcSession.pcStation.desktop.handlePointerUpUv(uv, 0);
      syncCielOsTouchPad(true);
    }
  }
};
canvas.addEventListener('pointerup', endPcTouchPointer);
canvas.addEventListener('pointercancel', endPcTouchPointer);

let detTouchId = null;
let detTouchLast = { x: 0, y: 0 };
let detTouchMoved = 0;
canvas.addEventListener(
  'touchstart',
  (e) => {
    if (!joined || !isDetentionSeatedActive() || vrManager?.isVrActive?.()) return;
    const t = e.changedTouches[0];
    if (!t || detTouchId !== null) return;
    e.preventDefault();
    detTouchId = t.identifier;
    detTouchLast = { x: t.clientX, y: t.clientY };
    detTouchMoved = 0;
  },
  { passive: false }
);
canvas.addEventListener(
  'touchmove',
  (e) => {
    if (detTouchId === null) return;
    if (!isDetentionSeatedActive() || vrManager?.isVrActive?.()) {
      detTouchId = null;
      return;
    }
    for (const t of e.changedTouches) {
      if (t.identifier === detTouchId) {
        e.preventDefault();
        const dx = t.clientX - detTouchLast.x;
        const dy = t.clientY - detTouchLast.y;
        detTouchLast = { x: t.clientX, y: t.clientY };
        detTouchMoved += Math.hypot(dx, dy);
        player.lookDelta(dx, dy);
        break;
      }
    }
  },
  { passive: false }
);
const endDetTouch = (e) => {
  if (detTouchId === null) return;
  for (const t of e.changedTouches) {
    if (t.identifier === detTouchId) {
      detTouchId = null;
      if (detTouchMoved < 10 && isDetentionSeatedActive() && !vrManager?.isVrActive?.()) {
        const hit = pickDetentionSurfaceAt(t.clientX, t.clientY);
        if (hit?.btn) {
          hit.btn.onClick?.(hit.uv);
        }
      }
      break;
    }
  }
};
canvas.addEventListener('touchend', endDetTouch);
canvas.addEventListener('touchcancel', endDetTouch);

let lastZoneId = '';
let lastMiniMapDrawAt = 0;
let lastDebugStatsAt = 0;
let lastPerfMonAt = 0;
let lastVrWatchSyncAt = 0;
let lastTouchRayAt = 0;
let cachedTouchLookTarget = null;
let lastCrosshairReady = false;
let lastCanvasCursor = '';
let lastShadowPlayerX = NaN;
let lastShadowPlayerY = NaN;
let lastShadowPlayerZ = NaN;
let lastDynamicShadowAt = 0;

sceneMgr.addUpdater((dt, elapsed) => {
  const vrActivePre = Boolean(vrManager?.isVrActive?.());
  combatVfx.update(dt);
  if (activePcSession?.comfortMode && cielOsDom?.comfortCtx && activePcSession.pcStation?.canvas) {
    cielOsDom.comfortCtx.drawImage(activePcSession.pcStation.canvas, 0, 0);
  }
  if (activePcSession) {
    syncCielOsTouchPad(false);
  }
  localAvatar?.updateEffects?.(elapsed);
  if (localPet) {
    if (joined && !survivalState.hiddenSpot && !survivalState.hiddenRack && !isDetentionSeatedActive() && !combatState.inActiveMatch) {
      localPet.group.visible = true;
      _petOwnerPosScratch.x = player.position.x;
      _petOwnerPosScratch.y = player.getFeetY();
      _petOwnerPosScratch.z = player.position.z;
      localPet.update(dt, elapsed, _petOwnerPosScratch, player.yaw);
    } else {
      localPet.group.visible = false;
    }
  }
  remotePlayers.update(dt, elapsed);
  updateSpeechBubble(localBubble, dt);

  if (!joined) {
    combatViewWeaponRoot.visible = false;
    if (!vrActivePre) {
      const angle = elapsed * 0.14;
      const sp = currentMapData?.spawn || { x: -2.0, z: -0.5, floor: 0 };
      const spFloorY = (Number(sp.floor) || 0) * (Number(currentMapData?.floorHeight) || 3.8);
      const farSpawn = Math.abs(sp.x) > 15 || Math.abs(sp.z) > 15 || Math.abs(spFloorY) > 0.1;
      const lookX = farSpawn ? sp.x : -2.0;
      const lookZ = farSpawn ? sp.z : -0.5;
      sceneMgr.camera.position.set(lookX - 2.5 + Math.sin(angle) * 6.5, spFloorY + 4.2, lookZ + 0.5 + Math.cos(angle) * 6.5);
      sceneMgr.camera.lookAt(lookX, spFloorY + 1.4, lookZ);
      _cullOptsScratch.currentFloor = Number(sp.floor) || 0;
      _cullOptsScratch.isVr = false;
      _cullOptsScratch.quality = effectiveQualityTier;
      lab.updateCulling?.(sceneMgr.camera, null, _cullOptsScratch);
      if (activeWorldMode === 'hall') {
        lab.update(elapsed, null, gameState.profile.diplomaEarned, sceneMgr.camera);
      }
    }
    return;
  }

  const vrOn = Boolean(vrManager?.isVrActive?.());
  if (vrOn) {
    vrManager.update(dt, elapsed);
  }
  const seatedDet = isDetentionSeatedActive();
  const step = vrOn || activeCinematic || survivalState.introActive ? null : player.update(dt);
  updateMetalPipeLocal(dt);

  if (combatState.inWaitingRoom && combatState.snapshot) {
    combatArena.updateWaitingBoard(combatState.snapshot, false);
  }
  if (combatState.inActiveMatch) {
    combatArena.updateArena(combatState.snapshot, dt, elapsed, sceneMgr.camera);
    combatState.recoilAmount = Math.max(0, combatState.recoilAmount - dt * 5.2);
    combatState.swingAnim = Math.max(0, combatState.swingAnim - dt * 4.5);
    combatState.pumpAnim = Math.max(0, combatState.pumpAnim - dt * 3.1);

    const me = getLocalCombatFighter();
    const activeWId = me?.weaponId || combatState.selectedWeaponId || getDefaultWeaponForMode(combatState.mode).id;
    const wSpec = getCombatWeaponById(activeWId) || getDefaultWeaponForMode(combatState.mode);
    const adsSpec = wSpec?.ads || {
      fov: 54,
      sensitivityMult: 0.72,
      sightType: 'holo',
      hipPos: [0.24, -0.21, -0.44],
      adsPos: [0, -0.11, -0.34],
      adsRot: [0, 0, 0]
    };

    const canAds = Boolean(combatState.localAlive && !modalOpen && !vrOn && gameState.cameraMode !== 'third' && !me?.reloading);
    const adsWanted = Boolean((combatState.adsHeld || combatState.adsTouchToggle) && canAds);
    const adsTarget = adsWanted ? 1 : 0;
    combatState.adsProgress += (adsTarget - combatState.adsProgress) * Math.min(1, dt * 13);
    if (combatState.adsProgress < 0.004 && adsTarget === 0) combatState.adsProgress = 0;
    if (combatState.adsProgress > 0.996 && adsTarget === 1) combatState.adsProgress = 1;

    if (!vrOn) {
      const baseFov = Number(gameState.fov) || 68;
      const targetFov = baseFov + (adsSpec.fov - baseFov) * combatState.adsProgress;
      if (combatState.lastFovApplied === null || Math.abs(targetFov - combatState.lastFovApplied) > 0.04) {
        combatState.lastFovApplied = targetFov;
        sceneMgr.camera.fov = targetFov;
        sceneMgr.camera.updateProjectionMatrix();
      }
      const sensMult = 1 + ((adsSpec.sensitivityMult || 0.7) - 1) * combatState.adsProgress;
      player.setAdsSensitivityMultiplier?.(sensMult);
    }

    let guardingNow = false;
    if (!vrOn) {
      guardingNow = Boolean(combatState.mode === 'melee' && combatState.adsProgress > 0.45 && combatState.localAlive);
      if (guardingNow !== combatState.lastGuardSent) {
        combatState.lastGuardSent = guardingNow;
        network.sendCombatGuard?.(guardingNow);
      }
    }

    let inMeleeRange = false;
    let scopeTargetDist = null;
    const fighters = Array.isArray(combatState.snapshot?.fighters) ? combatState.snapshot.fighters : [];
    if (!vrOn && combatState.localAlive && fighters.length > 0) {
      sceneMgr.camera.getWorldPosition(_combatRayOrigin);
      sceneMgr.camera.getWorldDirection(_combatRayDir);
      if (combatState.mode === 'melee') {
        const rangeLimit = (wSpec?.range || 2.5) + 0.25;
        for (let i = 0; i < fighters.length; i++) {
          const f = fighters[i];
          if (!f.alive || f.id === network.clientId) continue;
          const dx = f.x - player.position.x;
          const dz = f.z - player.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist <= rangeLimit) {
            const dot = dist > 0.05 ? (dx * _combatRayDir.x + dz * _combatRayDir.z) / dist : 1;
            if (dot >= (wSpec?.arcCos ?? 0.2)) {
              inMeleeRange = true;
              break;
            }
          }
        }
      } else if (wSpec?.id === 'ping_sniper' && combatState.adsProgress > 0.5) {
        let bestDist = Infinity;
        for (let i = 0; i < fighters.length; i++) {
          const f = fighters[i];
          if (!f.alive || f.id === network.clientId) continue;
          const vx = f.x - _combatRayOrigin.x;
          const vy = 1.25 - _combatRayOrigin.y;
          const vz = f.z - _combatRayOrigin.z;
          const proj = vx * _combatRayDir.x + vy * _combatRayDir.y + vz * _combatRayDir.z;
          if (proj <= 0.5 || proj > 60) continue;
          const px = vx - _combatRayDir.x * proj;
          const py = vy - _combatRayDir.y * proj;
          const pz = vz - _combatRayDir.z * proj;
          if (px * px + py * py + pz * pz <= 1.25 && proj < bestDist) {
            bestDist = proj;
          }
        }
        if (Number.isFinite(bestDist)) scopeTargetDist = bestDist;
      }
    }

    const sniperScopeVisible = Boolean(!vrOn && combatState.localAlive && wSpec?.id === 'ping_sniper' && combatState.adsProgress > 0.72);
    if (!vrOn) {
      const moveSpread = step?.moving ? 5 : 0;
      const recoilSpread = combatState.recoilAmount * (wSpec?.id === 'udp_shotgun' ? 14 : 10);
      const baseGap = wSpec?.id === 'udp_shotgun' ? 14 : wSpec?.id === 'ping_sniper' ? 5 : wSpec?.id === 'plasma_solder_pistol' ? 4 : 7;
      hud?.updateCombatCrosshair?.({
        active: Boolean(combatState.localAlive && !modalOpen),
        weaponId: wSpec?.id,
        mode: combatState.mode,
        spreadPx: baseGap + moveSpread + recoilSpread,
        adsActive: combatState.adsProgress > 0.45,
        inMeleeRange,
        guarding: guardingNow
      });
      hud?.updateSniperScope?.({
        active: sniperScopeVisible,
        elapsed,
        targetDistance: scopeTargetDist
      });
    }

    if (combatState.fireHeld && combatState.localAlive && !modalOpen && !vrOn) {
      if (wSpec?.auto || combatState.mode === 'melee') {
        triggerLocalCombatAttack();
      }
    }
    const showFpsWeapon = Boolean(!vrOn && combatState.localAlive && combatState.viewWeaponObj && gameState.cameraMode !== 'third' && !sniperScopeVisible);
    combatViewWeaponRoot.visible = showFpsWeapon;
    if (showFpsWeapon) {
      combatViewWeaponRoot.position.copy(sceneMgr.camera.position);
      combatViewWeaponRoot.quaternion.copy(sceneMgr.camera.quaternion);
      const adsT = combatState.adsProgress;
      const bobMult = 1 - adsT * 0.82;
      const speedBob = (step?.moving ? Math.sin(elapsed * 11) * 0.012 : Math.sin(elapsed * 2.1) * 0.003) * bobMult;
      const reloadDip = me?.reloading ? -0.14 : 0;
      const swingRotX = combatState.swingAnim > 0 ? -Math.sin(combatState.swingAnim * Math.PI) * 1.15 : 0;
      const swingRotZ = combatState.swingAnim > 0 ? Math.sin(combatState.swingAnim * Math.PI) * 0.42 : 0;
      const hip = adsSpec.hipPos || [0.24, -0.21, -0.44];
      const aim = adsSpec.adsPos || [0, -0.11, -0.34];
      const aimRot = adsSpec.adsRot || [0, 0, 0];
      const recoilKick = combatState.recoilAmount * (1 - adsT * 0.45);
      combatViewWeaponHolder.position.set(
        hip[0] + (aim[0] - hip[0]) * adsT - combatState.swingAnim * 0.08,
        hip[1] + (aim[1] - hip[1]) * adsT + speedBob + reloadDip,
        hip[2] + (aim[2] - hip[2]) * adsT + recoilKick * 0.065 - combatState.swingAnim * 0.14
      );
      combatViewWeaponHolder.rotation.set(
        aimRot[0] * adsT + recoilKick * 0.14 + swingRotX,
        aimRot[1] * adsT,
        aimRot[2] * adsT + swingRotZ
      );
      animateCombatWeaponMesh(combatState.viewWeaponObj, {
        elapsed,
        recoil: combatState.recoilAmount,
        pumpPhase: combatState.pumpAnim
      });
      combatViewWeaponRoot.updateMatrixWorld(true);
    }
  } else {
    combatViewWeaponRoot.visible = false;
    if (combatState.lastFovApplied !== null || combatState.adsProgress > 0) {
      resetCombatAdsState();
    }
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
  const curFloor = player.getCurrentFloor();
  const feetY = player.getFeetY();
  if (activeWorldMode === 'hall' || (survivalState.inActiveMatch && !survivalState.detained)) {
    _cullPlayerPosScratch.x = player.position.x;
    _cullPlayerPosScratch.y = feetY;
    _cullPlayerPosScratch.z = player.position.z;
    _cullOptsScratch.currentFloor = curFloor;
    _cullOptsScratch.isVr = vrOn;
    _cullOptsScratch.quality = effectiveQualityTier;
    sceneMgr.updateShadowAnchor?.(player.position.x, player.position.z);
    const sdx = player.position.x - lastShadowPlayerX;
    const sdy = feetY - lastShadowPlayerY;
    const sdz = player.position.z - lastShadowPlayerZ;
    const playerMovedForShadow =
      !Number.isFinite(lastShadowPlayerX) || sdx * sdx + sdy * sdy + sdz * sdz > 0.0025;
    const hasActiveRemoteShadow = (remotePlayers.peers?.size || 0) > 0 || Boolean(horrorTeacher?.root?.visible);
    if ((playerMovedForShadow || hasActiveRemoteShadow) && elapsed - lastDynamicShadowAt >= 0.065) {
      lastShadowPlayerX = player.position.x;
      lastShadowPlayerY = feetY;
      lastShadowPlayerZ = player.position.z;
      lastDynamicShadowAt = elapsed;
      sceneMgr.requestShadowUpdate?.();
    }
    lab.updateCulling?.(sceneMgr.camera, _cullPlayerPosScratch, _cullOptsScratch);
    lab.update(elapsed, player.position, gameState.profile.diplomaEarned, sceneMgr.camera);
  }

  updateVoiceIndicatorSprite(localVoiceIndicator, dt, voiceChat.isSpeaking);
  voiceChat.update(player.position, player.yaw, remotePlayers.peers);
  const currentZone = getZoneAtPositionInMap(currentMapData, player.position.x, player.position.z, curFloor);
  if (currentZone.id !== lastZoneId) {
    lastZoneId = currentZone.id;
    hud?.setCurrentZone?.(currentZone);
    network.sendZone(currentZone.id, currentZone.badgeText.replace('📍 ', ''));
    if (currentZone.id === 'CHAMBRE' && gameState.hasVipChambreAccess?.()) {
      hud?.toast?.('🔑 Accès VIP Clé Maîtresse — Bienvenue en Chambre Baie Serveur !', 'success');
    }
  }

  if (vrOn && elapsed - lastVrWatchSyncAt >= 0.1) {
    lastVrWatchSyncAt = elapsed;
    syncVrWatchHud();
  }

  if (!vrOn && elapsed - lastMiniMapDrawAt >= 0.05) {
    lastMiniMapDrawAt = elapsed;
    hud?.updateMiniMap?.({
      playerPos: player.position,
      playerYaw: player.yaw,
      currentZone,
      peers: remotePlayers.getMiniMapPeers(),
      floor: curFloor,
      waypoint: activeCampusWaypoint
    });
  }

  if (
    (tabletOS?.isOpen?.() || (vrOn && vrManager?.isTabletSpatialPanelOpen?.())) &&
    elapsed - lastTabletMapSyncAt >= 0.1
  ) {
    lastTabletMapSyncAt = elapsed;
    const livePayload = {
      playerPos: { x: player.position.x, y: feetY, z: player.position.z },
      playerYaw: player.yaw,
      playerFloor: curFloor,
      currentZone,
      peers: remotePlayers.getMiniMapPeers(),
      teacherPos: getTeacherPosFromMap(currentMapData)
    };
    if (tabletOS?.isOpen?.()) {
      tabletOS.updateLiveMap(livePayload);
    }
    if (vrOn && vrManager?.isTabletSpatialPanelOpen?.()) {
      vrManager.updateTabletSpatialPanel({
        ...livePayload,
        coins: Math.max(0, Math.floor(Number(gameState.coins ?? gameState.profile?.coins) || 0)),
        connectionState: hud?.lastConnectionState || (network.connected ? 'connected' : 'solo'),
        onlineCount: hud?.lastOnlineCount || 1,
        pingMs: network.lastPingMs
      });
    }
  }

  if (!vrOn && gameState.perfMonitor && elapsed - lastPerfMonAt >= 0.25) {
    lastPerfMonAt = elapsed;
    const baseMetrics = sceneMgr.getPerformanceMetrics();
    const cullStats = lab.getCullingStats?.();
    if (cullStats) {
      baseMetrics.visibleChunks = cullStats.visibleChunks;
      baseMetrics.totalChunks = cullStats.totalChunks;
      baseMetrics.floorLabel = formatFloorShortLabel(curFloor);
    }
    hud?.updatePerfMonitor?.(baseMetrics);
  }

  if (!vrOn && privateDebugMode && elapsed - lastDebugStatsAt >= 0.15) {
    lastDebugStatsAt = elapsed;
    hud?.updateDebugStats?.({
      fps: sceneMgr.getFps(),
      pingMs: network.lastPingMs,
      pos: player.position,
      socketState: network.getSocketDebugState()
    });
  }

  if (!modalOpen) {
    network.sendMove(
      player.position.x,
      feetY,
      player.position.z,
      player.yaw,
      Boolean(step?.landed),
      vrOn ? vrManager.getVrSyncPayload() : undefined,
      curFloor
    );

    let bestPrimary = null;
    let bestPrimaryDistSq = Infinity;
    let bestProp = null;
    let bestPropDistSq = Infinity;
    const activeInter =
      activeWorldMode === 'hall' && !survivalState.inWaitingRoom && !combatState.inWaitingRoom && !combatState.inActiveMatch && !survivalState.detained && !survivalState.inDefeatDetention && !survivalState.introActive && !survivalState.hiddenRack
        ? lab.getNearbyInteractables(player.position.x, player.position.z, 6.0, curFloor, _nearbyInteractScratch)
        : getActiveInteractables();
    for (let i = 0; i < activeInter.length; i++) {
      const item = activeInter[i];
      const itemY = Number(item.position.y) || 0;
      if (Math.abs(feetY - itemY) > 2.35) continue;
      const dx = player.position.x - item.position.x;
      const dz = player.position.z - item.position.z;
      const dSq = dx * dx + dz * dz;
      const rad = item.interactRadius;
      if (dSq > rad * rad) continue;
      if (item.isProp) {
        if (dSq < bestPropDistSq) {
          bestProp = item;
          bestPropDistSq = dSq;
        }
      } else if (dSq < bestPrimaryDistSq) {
        bestPrimary = item;
        bestPrimaryDistSq = dSq;
      }
    }
    const best = bestPrimary || bestProp;
    let touchLookTarget = null;
    if (!vrOn && gameState.touchMode && !seatedDet && !activeCinematic && !survivalState.introActive && !best) {
      if (elapsed - lastTouchRayAt >= 0.1) {
        lastTouchRayAt = elapsed;
        cachedTouchLookTarget = getRayHitInteractable(null, null, { allowTouch: true, maxDist: 4.5 });
      }
      touchLookTarget = cachedTouchLookTarget;
    } else {
      cachedTouchLookTarget = null;
    }
    const activeTouchTarget = best || touchLookTarget;
    nearestTarget = gameState.touchMode ? activeTouchTarget : best;

    if (!vrOn && seatedDet && elapsed - lastHoverPollAt >= 0.08) {
      lastHoverPollAt = elapsed;
      if (document.pointerLockElement === canvas) {
        updateDetentionSurfaceHover(null, null);
      } else if (lastCursorPos && !player.dragging) {
        updateDetentionSurfaceHover(lastCursorPos.x, lastCursorPos.y);
      }
    } else if (!vrOn && !gameState.touchMode && !seatedDet && !survivalState.introActive && elapsed - lastHoverPollAt >= 0.08) {
      lastHoverPollAt = elapsed;
      if (document.pointerLockElement === canvas) {
        setDesktopHoveredInteractable(getRayHitInteractable(null, null));
      } else if (lastCursorPos) {
        setDesktopHoveredInteractable(getRayHitInteractable(lastCursorPos.x, lastCursorPos.y));
      }
    } else if (vrOn || gameState.touchMode || seatedDet || survivalState.introActive) {
      hoveredInteractable = null;
      if (!seatedDet && lastCanvasCursor !== '') {
        lastCanvasCursor = '';
        canvas.style.cursor = '';
      }
    }

    const promptTarget = activeCinematic || seatedDet || survivalState.introActive
      ? null
      : (!vrOn && document.pointerLockElement === canvas && hoveredInteractable)
        ? hoveredInteractable
        : (gameState.touchMode ? activeTouchTarget : best);
    if (!vrOn) {
      hud?.setInteractPrompt?.(promptTarget);
      const nextReady = Boolean(!activeCinematic && !seatedDet && !survivalState.introActive && (hoveredInteractable || promptTarget));
      if (nextReady !== lastCrosshairReady) {
        lastCrosshairReady = nextReady;
        crosshairEl?.classList.toggle('interact-ready', nextReady);
      }
      touchControls?.setInteractTarget?.(activeCinematic || seatedDet || survivalState.introActive ? null : activeTouchTarget);
    }
  }
});

sceneMgr.start();
if (!initialJpoActive) {
  fetchInitialMap();
  refreshWallLeaderboard();
}

const leaderboardPollInterval = setInterval(() => {
  if (joined && !subModalActive && !isJpoDemoActive()) {
    refreshWallLeaderboard();
  }
}, 12000);

const voiceModalPollInterval = setInterval(() => {
  if (joined && subModalActive) {
    voiceChat.update(player.position, player.yaw, remotePlayers.peers);
  }
}, 180);

window.addEventListener('beforeunload', () => {
  clearInterval(leaderboardPollInterval);
  clearInterval(voiceModalPollInterval);
  if (vrAscCountdownTimer) {
    clearInterval(vrAscCountdownTimer);
    vrAscCountdownTimer = null;
  }
  if (cielOsTouchRepeatTimer) {
    clearInterval(cielOsTouchRepeatTimer);
    cielOsTouchRepeatTimer = null;
  }
  shopModal?.preview?.dispose?.();
  lockerModal?.preview?.dispose?.();
  tabletOS?.destroy?.();
  stopKioskMode();
  network.disconnect?.();
});

function startGameSession(
  { name, room, skin, privateDebug = false, forceIntro = false, jpoRoom = null },
  startVr = false
) {
  jpoWelcomeModal?.close?.();
  jpoBriefingModal?.close?.();
  const cleanRoom = room || 'plateau-u300';
  const isDebugRoom = Boolean(
    privateDebug || String(cleanRoom).toLowerCase().startsWith('priv-debug')
  );
  privateDebugMode = isDebugRoom;
  notifiedNetError = false;
  gameState.room = cleanRoom;

  const activeJpo = Boolean(!isDebugRoom && jpoRoom && isJpoRoomActive(jpoRoom));
  if (activeJpo) {
    jpoState.roomId = jpoRoom;
    jpoState.roomConfig = getJpoRoomConfig(jpoRoom);
    jpoState.demoCoins = 0;
    jpoState.hasMovedSinceSpawn = false;
    const expectedMapId = `jpo-room-${jpoRoom}`;
    if (!currentMapData?.jpoIsolated || currentMapData.id !== expectedMapId || lab.combatDoors.length > 0) {
      const jpoMap = createJpoRoomMap(jpoRoom);
      if (jpoMap) {
        currentMapData = jpoMap;
        lab.rebuildWorld(currentMapData, { skipCombatFallback: true });
        sceneMgr.updateWorldBounds(currentMapData.bounds);
        sceneMgr.requestShadowUpdate?.();
        player.setWalkableSurfaces?.(lab.walkableSurfaces);
        player.setSpatialHash?.(lab.spatialHash);
        player.setColliders(lab.colliders);
        player.setBounds(currentMapData.bounds);
      }
    }
    gameState.applyEconomySnapshot({
      coins: 0,
      ownedItems: [],
      equippedSkin: null,
      equippedPet: null,
      equippedTrail: null
    });
    gameState.setProfile({
      ...gameState.profile,
      name,
      skin,
      grades: {},
      average: null,
      completedCount: 0,
      diplomaEarned: false,
      xp: 0,
      questAccepted: true,
      coins: 0,
      ownedItems: [],
      equippedSkin: null,
      equippedPet: null,
      equippedTrail: null
    });
    lab.updateStationBadges({});
  } else {
    jpoState.roomId = 'standard';
    jpoState.roomConfig = null;
    jpoState.demoCoins = 0;
    jpoState.hasMovedSinceSpawn = false;
    if (currentMapData?.jpoIsolated) {
      applyMapData(standardMapData || createDefaultMap(), false);
      fetchInitialMap();
    }
    gameState.setProfile({ ...gameState.profile, name, skin });
  }

  rebuildLocalAvatar(skin);
  lab.setLocalCoins?.(activeJpo ? 0 : gameState.coins);
  shopModal?.refresh?.();
  joined = true;

  hud.show();
  hud.setPrivateDebugMode(isDebugRoom, cleanRoom);
  hud?.setJpoMode?.({
    roomConfig: activeJpo ? jpoState.roomConfig : null,
    kiosk: activeJpo || (!isDebugRoom && jpoState.kiosk)
  });
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
  if (!activeJpo) {
    hud?.miniMap?.setMapData?.(currentMapData);
    hud?.setMapData?.(currentMapData);
  }
  const pose = activeJpo ? resolveJpoSpawnPose(currentMapData, jpoState.roomId) : getSpawnPose(currentMapData);
  player.teleportTo(pose.pos, pose.lookAt);
  const startZone = getZoneAtPositionInMap(currentMapData, pose.pos.x, pose.pos.z);
  lastZoneId = startZone.id;
  hud?.setCurrentZone?.(startZone);
  if (activeJpo) {
    network.disconnect();
    remotePlayers.clearAll();
    hud?.setNetworkStatus?.({ state: 'disconnected', connected: false }, 1);
  } else {
    network.connect(name, cleanRoom, skin, {
      x: pose.pos.x,
      y: 0,
      z: pose.pos.z,
      yaw: player.yaw,
      zoneId: startZone.id,
      zoneLabel: startZone.badgeText.replace('📍 ', '')
    });
    refreshWallLeaderboard();
  }

  if (!isDebugRoom && jpoState.kiosk) {
    startKioskMode();
  } else {
    stopKioskMode();
  }

  const shouldRunIntro =
    !startVr &&
    !isDebugRoom &&
    !activeJpo &&
    (Boolean(forceIntro) || (gameState.isAuthenticated() && gameState.account?.introSeen === false));

  if (startVr) {
    vrManager?.enterVr?.();
  } else if (activeJpo) {
    if (JPO_AUTO_START_TP) {
      openJpoFeaturedTp();
    } else if (shouldShowJpoWelcome(jpoState.roomId)) {
      openJpoWelcomeOverlay(jpoState.roomId);
    }
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
  onOpenShop: () => openShopUi('skins'),
  onOpenLeaderboard: () => hud?.openLeaderboard?.(),
  onStartGame: (params) => startGameSession(params, false),
  onStartVr: (params) => startGameSession(params, true),
  onAccountRestored: () => {
    sessionDivineSpecialty = gameState.skin?.secretSkin
      ? ULTIMATE_SECRET_SKIN_ID
      : gameState.skin?.divineSpecialty || null;
    rebuildLocalAvatar(gameState.skin);
    battlePassModal?.refresh?.();
    shopModal?.refresh?.();
    lab.setLocalCoins?.(gameState.coins);
    lab.updateStationBadges(gameState.profile.grades);
  },
  onLogout: () => {
    sessionDivineSpecialty = null;
    rebuildLocalAvatar(gameState.skin);
    battlePassModal?.refresh?.();
    shopModal?.refresh?.();
    lab.setLocalCoins?.(0);
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
      sceneMgr.setDeviceProfile(detectDeviceProfile());
      hud?.syncTouchUi?.();
      mainMenu?.updatePlatformButton?.(isMobile);
      hud?.toast?.(
        isMobile
          ? '📱 Mode Mobile / Tablette activé (contrôles tactiles)'
          : '💻 Mode PC activé (Clavier ZQSD + Souris)'
      );
    }
  });
  if (!initialJpoActive && !initialPrivateDebugRequested) {
    platformModal.open(gameState.touchMode, null, false, Boolean(vrManager?.isVrActive?.()));
  }
} catch (err) {
  console.warn('Sélecteur de plateforme indisponible:', err);
}

if (typeof window !== 'undefined') {
  const handleViewportProfileChange = () => {
    sceneMgr.setDeviceProfile(detectDeviceProfile());
    hud?.syncViewportClasses?.();
  };
  window.addEventListener('resize', handleViewportProfileChange, { passive: true });
  window.addEventListener('orientationchange', handleViewportProfileChange, { passive: true });
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

(function checkAutoLaunchJpoMode() {
  if (typeof window === 'undefined' || joined) return;
  const cfg = readJpoConfig();
  jpoState.kiosk = Boolean(cfg.kiosk);
  if (!isJpoRoomActive(cfg.room)) return;
  platformModal?.close?.();
  mainMenu?.hide?.();
  startGameSession(
    {
      name: createJpoVisitorName(cfg.room),
      room: 'plateau-u300',
      skin: { ...DEFAULT_SKIN },
      jpoRoom: cfg.room
    },
    false
  );
})();
