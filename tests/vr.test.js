import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { WebSocket } from 'ws';
import { createGameServer } from '../server/index.js';
import { buildArticulatedVRHand } from '../src/vr/VRHandBuilder.js';
import { createTpSpatialPanel, createVrDebugPanel, createWristHudPanel } from '../src/vr/VRHudPanel.js';
import { VRManager } from '../src/vr/VRManager.js';
import { attachRemoteVrVisuals, buildStudentAvatarMesh } from '../src/world/AvatarBuilder.js';
import { CombatMatchController } from '../src/world/CombatEngine.js';
import { COMBAT_WEAPONS, getCombatWeaponById } from '../src/world/CombatWeapons.js';
import { buildLabWorld } from '../src/world/LabBuilder.js';
import { createDefaultMap } from '../src/world/mapSchema.js';
import { VariationTableSession, getVariationSheetHitBoxes } from '../src/minigames/VariationTableGame.js';
import { PlayerController } from '../src/world/PlayerController.js';
import { RemotePlayersManager } from '../src/world/RemotePlayers.js';
import { SceneManager, pickLabInteractable } from '../src/world/SceneManager.js';
import { buildShopViewModel } from '../src/ui/ShopModal.js';
import { SHOP_PETS } from '../src/world/ShopCatalog.js';
import { createSurvivalPocketRooms, getDetentionCameraHitBoxes } from '../src/world/SurvivalArena3D.js';
import {
  computeRackExitPosition,
  computeRackInteriorPosition,
  hasFullMapLineOfSight,
  pointCollidesWithColliders,
  resolveSurvivalIntroPlacement
} from '../src/world/SurvivalEngine.js';

function waitForMsg(sock, predicate, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      sock.off('message', handler);
      reject(new Error('Timeout waiting for WS message'));
    }, timeoutMs);
    const handler = (raw) => {
      const msg = JSON.parse(raw.toString('utf8'));
      if (predicate(msg)) {
        clearTimeout(timer);
        sock.off('message', handler);
        resolve(msg);
      }
    };
    sock.on('message', handler);
  });
}

function createFakeDomStubs() {
  const prevWin = globalThis.window;
  const prevDoc = globalThis.document;
  const noop = () => {};
  const fakeCanvas = {
    addEventListener: noop,
    requestPointerLock: noop
  };
  globalThis.window = {
    addEventListener: noop,
    removeEventListener: noop
  };
  globalThis.document = {
    pointerLockElement: null,
    exitPointerLock: noop,
    addEventListener: noop
  };
  return {
    canvas: fakeCanvas,
    restore() {
      if (prevWin === undefined) delete globalThis.window;
      else globalThis.window = prevWin;
      if (prevDoc === undefined) delete globalThis.document;
      else globalThis.document = prevDoc;
    }
  };
}

test('VRHandBuilder construit des mains articulées à 3 phalanges pour tous les skins et gère contrôleur + hand-tracking', () => {
  const skins = [
    { style: 'standard', outfitColor: '#0284c7' },
    { style: 'gold24k', outfitColor: '#fbbf24' },
    { style: 'diamond' },
    { style: 'matrix' },
    { style: 'carbon_neon' },
    { style: 'chrome_rgb' },
    { style: 'cyber_gold' },
    { divineSpecialty: 'cyber' },
    { divineSpecialty: 'audiovisuel' },
    { secretSkin: true }
  ];

  for (const skin of skins) {
    const leftHand = buildArticulatedVRHand({ handedness: 'left', skin });
    const rightHand = buildArticulatedVRHand({ handedness: 'right', skin });

    assert.equal(Object.keys(leftHand.fingers).length, 5);
    assert.equal(Object.keys(rightHand.fingers).length, 5);
    assert.ok(leftHand.fingers.thumb.distalPivot);
    assert.ok(leftHand.fingers.index.distalPivot);
    assert.ok(leftHand.fingers.index.basePivot.position.x > 0);
    assert.ok(rightHand.fingers.index.basePivot.position.x < 0);

    leftHand.setPose({ trigger: 0, grip: 0, thumb: 0, elapsed: 0.2, immediate: true });
    const openIndexX = leftHand.fingers.index.basePivot.rotation.x;
    const openPinkyX = leftHand.fingers.pinky.basePivot.rotation.x;

    leftHand.setPose({ trigger: 1, grip: 1, thumb: 1, elapsed: 0.6 });
    assert.ok(leftHand.fingers.index.basePivot.rotation.x < openIndexX);
    assert.ok(leftHand.fingers.pinky.basePivot.rotation.x < openPinkyX);
    assert.ok(leftHand.fingers.middle.midPivot.rotation.x < -0.5);
    assert.ok(leftHand.fingers.middle.distalPivot.rotation.x < -0.2);

    rightHand.setPose({
      fingers: { thumb: 0.2, index: 0.95, middle: 0.1, ring: 0.85, pinky: 0.9 },
      immediate: true,
      elapsed: 1.0
    });
    const pose = rightHand.getPose();
    assert.ok(pose.index > 0.9);
    assert.ok(pose.middle < 0.2);
    assert.ok(pose.ring > 0.8);

    leftHand.applySkin({ secretSkin: true });
    leftHand.dispose();
    rightHand.dispose();
  }
});

test('AvatarBuilder & RemotePlayers gèrent le suivi 3-points, doigts individuels, bras à 2 segments et smartwatch distante', () => {
  const avatar = buildStudentAvatarMesh({ style: 'cyber_gold', hat: 'glasses' });
  avatar.setFirstPersonVrHidden(true);
  assert.equal(avatar.headGroup.visible, false);
  assert.equal(avatar.leftArm.visible, false);
  assert.equal(avatar.rightArm.visible, false);

  avatar.setFirstPersonVrHidden(false);
  assert.equal(avatar.headGroup.visible, true);

  const tracker = attachRemoteVrVisuals(avatar, { divineSpecialty: 'reseaux' });
  assert.ok(tracker.remoteWatch);
  assert.ok(tracker.remoteVisorGroup);

  const scene = new THREE.Scene();
  const remoteMgr = new RemotePlayersManager(scene);
  remoteMgr.upsertPeer({
    id: 'vr-peer-1',
    name: 'Alice_VR',
    x: 2,
    y: 0,
    z: -3,
    yaw: 0.5
  });

  const vrDataOn = {
    active: true,
    head: { px: 0.05, py: 1.64, pz: -0.02, qx: 0, qy: 0.2588, qz: 0, qw: 0.9659 },
    leftHand: {
      px: -0.32,
      py: 1.15,
      pz: -0.35,
      qx: 0,
      qy: 0,
      qz: 0,
      qw: 1,
      trigger: 0.8,
      grip: 0.4,
      thumb: 0.2,
      fingers: { thumb: 0.2, index: 0.8, middle: 0.4, ring: 0.4, pinky: 0.9 }
    },
    rightHand: {
      px: 0.34,
      py: 1.22,
      pz: -0.4,
      qx: 0,
      qy: 0,
      qz: 0,
      qw: 1,
      trigger: 1,
      grip: 0.9,
      thumb: 1,
      fingers: { thumb: 1, index: 1, middle: 0.9, ring: 0.9, pinky: 0.9 }
    }
  };

  remoteMgr.movePeer('vr-peer-1', 2.2, 0, -2.8, 0.6, vrDataOn);
  for (let i = 0; i < 15; i++) {
    remoteMgr.update(0.016, i * 0.016);
  }
  const peer = remoteMgr.peers.get('vr-peer-1');
  assert.equal(peer.vrTracker.vrRoot.visible, true);
  assert.equal(peer.vrTracker.remoteVisorGroup.visible, true);
  assert.equal(peer.leftArm.visible, false);
  assert.equal(peer.rightArm.visible, false);
  assert.ok(peer.vrTracker.leftHand.root.position.y > 0.9);
  assert.ok(peer.vrTracker.leftHand.getPose().pinky > 0.8);

  remoteMgr.movePeer('vr-peer-1', 2.2, 0, -2.8, 0.6, null);
  remoteMgr.update(0.016, 1.0);
  assert.equal(peer.vrTracker.vrRoot.visible, false);
  assert.equal(peer.vrTracker.remoteVisorGroup.visible, false);
  assert.equal(peer.leftArm.visible, true);
  assert.equal(peer.rightArm.visible, true);

  tracker.dispose();
  remoteMgr.clearAll();
});

test('VRHudPanel Smartwatch initialise la minimap U300, les participants et l’état de connexion en temps réel', () => {
  const mapData = createDefaultMap();
  const wrist = createWristHudPanel({ name: 'Lucas_VR', mapData });

  assert.equal(wrist.hasMiniMapData(), true);
  assert.ok(wrist.getMiniMapBounds().width > 10);
  assert.ok(wrist.statusRim);

  wrist.setMapData(mapData);
  wrist.updateMiniMap({
    playerPos: { x: -3.95, z: 0.65 },
    playerYaw: -1.35,
    currentZone: { id: 'U300', badgeText: '📍 U300 - Couloir Central', color: '#22d3ee' },
    peers: [
      { id: 'p1', name: 'Emma', color: '#34d399', x: 1.5, z: -2.0 },
      { id: 'p2', name: 'Noah', color: '#fbbf24', x: -7.0, z: 6.5 }
    ]
  });
  wrist.updateState({
    connectionState: 'connected',
    onlineCount: 3,
    pingMs: 14,
    micEnabled: true,
    isSpeaking: true,
    nearbySpeakers: [{ name: 'Emma', distance: 4.2 }]
  });

  const st = wrist.getState();
  assert.equal(st.connectionState, 'connected');
  assert.equal(st.onlineCount, 3);
  assert.equal(st.peersCount, 2);
  assert.equal(st.micEnabled, true);
  assert.equal(st.isSpeaking, true);
  assert.equal(st.playerPos.x, -3.95);

  wrist.setForceVisible(true);
  wrist.updateVisibility(new THREE.Vector3(0, 1.6, 1), 0.016);
  assert.equal(wrist.group.visible, true);
  wrist.dispose();

  const tpPanel = createTpSpatialPanel();
  assert.ok(tpPanel.screenMesh);
  tpPanel.dispose();
});

test('VRManager & PlayerController gèrent la locomotion fluide, le snap-turn, la protection local-floor et la smartwatch sans fuite', async () => {
  const stubs = createFakeDomStubs();
  const mockScene = new THREE.Scene();
  const mockCam = new THREE.PerspectiveCamera(72, 1.77, 0.1, 100);
  let presentingState = false;
  const mockSceneMgr = {
    scene: mockScene,
    camera: mockCam,
    renderer: null,
    setVrPresentingState(val) {
      presentingState = Boolean(val);
      mockCam.near = presentingState ? 0.03 : 0.1;
    },
    bindVrManager() {}
  };

  let vr = null;
  try {
    const mapData = createDefaultMap();
    const colliders = [{ minX: -1.5, maxX: 1.5, minZ: -1.0, maxZ: 0.0 }];
    const player = new PlayerController(mockCam, stubs.canvas, colliders);
    player.setBounds(mapData.bounds);
    player.teleportTo({ x: 0, z: 2.0 }, { x: 0, z: -1.0 });

    let enterCount = 0;
    let exitCount = 0;
    vr = new VRManager(mockSceneMgr, player, {
      skin: { style: 'gold24k' },
      playerName: 'Tester_VR',
      mapData,
      onEnterVr: () => {
        enterCount += 1;
      },
      onExitVr: () => {
        exitCount += 1;
      }
    });

    assert.equal(vr.wristPanel.group.parent, vr.slots.left.hand.root);
    assert.equal(vr.enterSimulationMode(), true);
    assert.equal(enterCount, 1);
    assert.equal(vr.isVrActive(), true);

    const startZ = player.position.z;
    vr.setSimInput({ lx: 0, ly: -1, grip: 0.7, mouseTrigger: true });
    vr.update(0.1, 0.1, 100);
    assert.ok(player.position.z < startZ);
    assert.equal(player.position.y, player.groundY);
    assert.equal(vr.vrRig.position.y, 0);

    vr.setSimInput({ lx: 1, ly: 0 });
    const afterForwardX = player.position.x;
    vr.update(0.1, 0.2, 200);
    assert.ok(player.position.x > afterForwardX);

    const yawBeforeSnap = player.yaw;
    vr.setSimInput({ lx: 0, ly: 0, rx: 0.9 });
    vr.update(0.016, 0.25, 250);
    assert.notEqual(player.yaw, yawBeforeSnap);
    assert.equal(vr.vrRig.position.y, 0);

    player.setVrPose({ x: 0, z: 0.5 });
    const slideRes = player.moveHorizontally(0.3, -0.4);
    assert.equal(slideRes.movedX, true);
    assert.equal(slideRes.movedZ, false);
    assert.equal(player.position.y, player.groundY);
    assert.equal(vr.vrRig.position.y, 0);

    const watchVis = vr.toggleWristWatchSim();
    assert.equal(watchVis, true);
    assert.equal(vr.wristPanel.group.visible, true);

    vr.updateMiniMap({
      playerPos: player.position,
      playerYaw: player.yaw,
      peers: [{ id: 'p1', name: 'Camarade', color: '#34d399', x: 1, z: 1 }]
    });
    vr.updateHudInfo({ connectionState: 'connected', onlineCount: 2, pingMs: 12 });
    assert.equal(vr.wristPanel.getState().onlineCount, 2);
    assert.equal(vr.wristPanel.getState().peersCount, 1);

    const sync = vr.getVrSyncPayload();
    assert.equal(sync.active, true);
    assert.ok(sync.head.py > 1);
    assert.equal(sync.rightHand.trigger, 1);
    assert.ok(sync.rightHand.fingers);

    vr.simMode = false;
    mockCam.position.y = -0.6;
    vr._stabilizeFloor();
    assert.ok(vr.vrRig.position.y > 0.8);
    vr.simMode = true;
    mockCam.position.y = 1.65;
    vr._stabilizeFloor();
    assert.equal(vr.vrRig.position.y, 0);

    await vr.exitVr();
    assert.equal(exitCount, 1);
    assert.equal(vr.isVrActive(), false);
    assert.deepEqual(vr.getVrSyncPayload(), { active: false });
  } finally {
    vr?.dispose?.();
    stubs.restore();
  }
});

test('Serveur WebSocket valide, normalise et diffuse vrData (tête, mains, doigts) en cross-play avec joueurs non-VR', async () => {
  const { server, wsHub } = createGameServer({ dbPath: null });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const wsUrl = `ws://127.0.0.1:${port}/ws`;

  const c1 = new WebSocket(wsUrl);
  const c2 = new WebSocket(wsUrl);
  let c3 = null;

  try {
    await Promise.all([
      new Promise((res) => c1.once('open', res)),
      new Promise((res) => c2.once('open', res))
    ]);

    const w1P = waitForMsg(c1, (m) => m.type === 'welcome');
    c1.send(JSON.stringify({ type: 'join', name: 'AliceVR', room: 'plateau-u300', skin: { style: 'diamond' } }));
    await w1P;

    const w2P = waitForMsg(c2, (m) => m.type === 'welcome');
    const c1SawC2P = waitForMsg(c1, (m) => m.type === 'player_joined' && m.player?.name === 'BobPC');
    c2.send(JSON.stringify({ type: 'join', name: 'BobPC', room: 'plateau-u300', skin: { style: 'standard' } }));
    await Promise.all([w2P, c1SawC2P]);

    const c2MoveP = waitForMsg(c2, (m) => m.type === 'player_moved' && m.vrData?.active === true);
    c1.send(
      JSON.stringify({
        type: 'move',
        x: 1.5,
        y: 0,
        z: -2.4,
        yaw: 0.75,
        vrData: {
          active: true,
          head: { px: 0.02, py: 1.66, pz: -0.01, qx: 0, qy: 0, qz: 0, qw: 0 },
          leftHand: {
            px: -0.28,
            py: 1.12,
            pz: -0.34,
            qx: 0,
            qy: 0,
            qz: 0,
            qw: 1,
            grip: 0.8,
            trigger: 0.2,
            thumb: 1,
            fingers: { thumb: 0.9, index: 0.2, middle: 0.8, ring: 0.7, pinky: 1.4 }
          },
          rightHand: {
            px: 0.29,
            py: 1.24,
            pz: -0.41,
            qx: 0,
            qy: 0,
            qz: 0,
            qw: 1,
            grip: 0.1,
            trigger: 1.5,
            thumb: 0
          }
        }
      })
    );
    const moveMsg = await c2MoveP;
    assert.equal(moveMsg.vrData.active, true);
    assert.equal(moveMsg.vrData.head.py, 1.66);
    assert.equal(moveMsg.vrData.head.qw, 1);
    assert.equal(moveMsg.vrData.leftHand.fingers.pinky, 1);
    assert.equal(moveMsg.vrData.leftHand.fingers.ring, 0.7);
    assert.equal(moveMsg.vrData.rightHand.trigger, 1);

    const c1MoveFromPcP = waitForMsg(c1, (m) => m.type === 'player_moved' && !m.vrData);
    c2.send(JSON.stringify({ type: 'move', x: 3.1, y: 0, z: 1.2, yaw: 0 }));
    const pcMoveMsg = await c1MoveFromPcP;
    assert.equal(pcMoveMsg.x, 3.1);
    assert.equal(pcMoveMsg.vrData, null);

    c3 = new WebSocket(wsUrl);
    await new Promise((res) => c3.once('open', res));
    const w3P = waitForMsg(c3, (m) => m.type === 'welcome');
    c3.send(JSON.stringify({ type: 'join', name: 'ChloeLate', room: 'plateau-u300', skin: { style: 'standard' } }));
    const w3 = await w3P;
    const alicePeer = w3.peers.find((p) => p.name === 'AliceVR');
    const bobPeer = w3.peers.find((p) => p.name === 'BobPC');
    assert.equal(alicePeer.vrData?.active, true);
    assert.equal(alicePeer.vrData.leftHand.fingers.ring, 0.7);
    assert.equal(bobPeer.vrData, null);
  } finally {
    c3?.close();
    c1.close();
    c2.close();
    wsHub.close();
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('v4.15 : pickLabInteractable et VRManager raycastent sans crash sur des bornes contenant THREE.Sprite', () => {
  const stubs = createFakeDomStubs();
  const mockScene = new THREE.Scene();
  const mockCam = new THREE.PerspectiveCamera(72, 1.77, 0.1, 180);
  const mockSceneMgr = {
    scene: mockScene,
    camera: mockCam,
    renderer: null,
    getFps: () => 72,
    getXrErrors: () => [],
    setVrPresentingState() {},
    bindVrManager() {}
  };

  const stationGrp = new THREE.Group();
  stationGrp.position.set(0, 0, -2.5);
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4), new THREE.MeshBasicMaterial());
  box.position.y = 0.6;
  stationGrp.add(box);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial());
  sprite.position.set(0, 2.2, 0);
  stationGrp.add(sprite);
  mockScene.add(stationGrp);
  mockScene.updateMatrixWorld(true);

  const interactables = [
    {
      id: 'teacher',
      label: 'Professeur CIEL',
      position: new THREE.Vector3(0, 0, -2.5),
      interactRadius: 3.1,
      mesh: stationGrp
    }
  ];

  const rawRay = new THREE.Raycaster(new THREE.Vector3(0, 0.6, 0), new THREE.Vector3(0, 0, -1));
  assert.equal(rawRay.camera, null);
  const safePick = pickLabInteractable(rawRay, interactables, [], 5);
  assert.equal(safePick?.item?.id, 'teacher');

  let vr = null;
  try {
    const mapData = createDefaultMap();
    const player = new PlayerController(mockCam, stubs.canvas, []);
    player.setBounds(mapData.bounds);
    player.teleportTo({ x: 0, z: 0 }, { x: 0, z: -2.5 });
    vr = new VRManager(mockSceneMgr, player, {
      playerName: 'SpriteSafeVR',
      mapData,
      getInteractables: () => interactables,
      getOccluders: () => []
    });
    assert.equal(vr.enterSimulationMode(), true);
    vr.update(0.016, 0.1, 100);
    assert.equal(vr.raycaster.camera, mockCam);
    assert.equal(vr.debugPanel.group.visible, false);
    vr.setDebugPanelEnabled(true);
    vr.update(0.016, 0.12, 120);
    assert.equal(vr.debugPanel.group.visible, true);
    assert.ok(vr.debugPanel.getState().frameCount >= 1);
  } finally {
    vr?.dispose?.();
    stubs.restore();
  }
});

test('v4.15 : SceneManager garantit boucle WebXR unique, éclairage complet, clearColor jour et isolation des erreurs', () => {
  const listeners = new Map();
  let loopFn = null;
  let renderCalls = 0;
  let lastClearColor = null;
  let activeRt = null;
  const xrListeners = new Map();

  const mockRenderer = {
    xr: {
      enabled: false,
      isPresenting: false,
      setReferenceSpaceType() {},
      addEventListener(type, fn) {
        xrListeners.set(type, fn);
      },
      removeEventListener(type) {
        xrListeners.delete(type);
      }
    },
    autoClear: false,
    toneMapping: null,
    toneMappingExposure: 1,
    shadowMap: { enabled: false, type: null },
    setClearColor(col) {
      lastClearColor = col;
    },
    setPixelRatio() {},
    setSize() {},
    getRenderTarget() {
      return activeRt;
    },
    setRenderTarget(rt) {
      activeRt = rt;
    },
    setAnimationLoop(fn) {
      loopFn = fn;
    },
    render(scene, cam) {
      renderCalls += 1;
      assert.ok(scene);
      assert.ok(cam);
    }
  };

  const mockCanvas = {
    addEventListener(type, fn) {
      listeners.set(type, fn);
    },
    removeEventListener(type) {
      listeners.delete(type);
    }
  };

  const sm = new SceneManager(mockCanvas, { renderer: mockRenderer, skipEnvironment: true });
  try {
    assert.equal(mockRenderer.xr.enabled, true);
    assert.equal(lastClearColor, '#cfe4f7');
    const lightTypes = sm.scene.children.filter((c) => c.isLight).map((l) => l.type);
    assert.ok(lightTypes.includes('AmbientLight'));
    assert.ok(lightTypes.includes('HemisphereLight'));
    assert.ok(lightTypes.includes('DirectionalLight'));

    sm.setCustomRenderTarget(new THREE.Scene(), () => {});
    sm.addUpdater(() => {
      throw new Error('Boom updater test');
    });

    sm.start();
    assert.equal(typeof loopFn, 'function');

    mockRenderer.xr.isPresenting = true;
    xrListeners.get('sessionstart')?.();
    assert.equal(sm.vrPresenting, true);
    assert.equal(sm.customRenderScene, null);
    assert.equal(sm.camera.near, 0.05);

    activeRt = { isXRRenderTarget: false };
    loopFn();
    assert.equal(renderCalls, 1);
    assert.equal(activeRt, null);
    assert.ok(sm.getXrErrors().some((e) => e.includes('Boom updater test')));

    activeRt = { isXRRenderTarget: true };
    loopFn();
    assert.equal(renderCalls, 2);
    assert.equal(activeRt.isXRRenderTarget, true);

    listeners.get('webglcontextlost')?.({ preventDefault() {} });
    assert.ok(sm.getXrErrors().some((e) => e.includes('WebGL context lost')));
  } finally {
    sm.dispose();
  }
});

test('v4.15 : VRManager gère session WebXR local-floor (y=0), fallback local (y=1.65), spawn dégagé et panneau debug 3D', async () => {
  const stubs = createFakeDomStubs();
  const prevNav = globalThis.navigator;
  const mockScene = new THREE.Scene();
  const mockCam = new THREE.PerspectiveCamera(72, 1.77, 0.1, 100);
  let setSessionCalls = 0;
  let refSpaceConfigured = null;
  let xrPresenting = false;
  let allowLocalFloor = true;

  const mockXr = {
    enabled: false,
    get isPresenting() {
      return xrPresenting;
    },
    setReferenceSpaceType(t) {
      refSpaceConfigured = t;
    },
    getController() {
      return new THREE.Group();
    },
    getControllerGrip() {
      return new THREE.Group();
    },
    getHand() {
      return new THREE.Group();
    },
    addEventListener() {},
    removeEventListener() {},
    async setSession(sess) {
      setSessionCalls += 1;
      xrPresenting = true;
      await sess.requestReferenceSpace(refSpaceConfigured);
    }
  };

  const mockSceneMgr = {
    scene: mockScene,
    camera: mockCam,
    renderer: {
      xr: mockXr,
      setRenderTarget() {}
    },
    getFps: () => 90,
    getXrErrors: () => [],
    setVrPresentingState(val) {
      mockCam.near = val ? 0.05 : 0.1;
    },
    bindVrManager() {}
  };

  const makeMockSession = (supportsLocalFloor) => {
    const endListeners = [];
    return {
      addEventListener(t, fn) {
        if (t === 'end') endListeners.push(fn);
      },
      async requestReferenceSpace(type) {
        if (type === 'local-floor' && !supportsLocalFloor) {
          throw new Error('local-floor unsupported');
        }
        return {};
      },
      async end() {
        xrPresenting = false;
        endListeners.forEach((fn) => fn());
      }
    };
  };

  globalThis.navigator = {
    xr: {
      async isSessionSupported() {
        return true;
      },
      async requestSession() {
        return makeMockSession(allowLocalFloor);
      }
    }
  };

  let vr = null;
  try {
    const mapData = createDefaultMap();
    const player = new PlayerController(mockCam, stubs.canvas, [{ minX: -1, maxX: 1, minZ: -1, maxZ: 1 }]);
    player.setBounds(mapData.bounds);
    player.teleportTo({ x: 0, z: 0 }, { x: 0, z: -2 });

    vr = new VRManager(mockSceneMgr, player, {
      playerName: 'QuestTester',
      mapData
    });

    assert.equal(await vr.enterVr(), true);
    assert.equal(mockXr.enabled, true);
    assert.equal(setSessionCalls, 1);
    assert.equal(vr.xrReferenceSpaceType, 'local-floor');
    assert.equal(vr.vrRig.position.y, 0);
    assert.equal(vr.vrRig.position.x, -3.95);
    assert.equal(vr.vrRig.position.z, 0.65);
    assert.equal(mockCam.near, 0.05);
    assert.ok(mockCam.far >= 180);
    assert.equal(vr.debugPanel.group.visible, false);
    vr.setPrivateDebug(true);
    assert.equal(vr.debugPanel.group.visible, true);
    vr.update(0.016, 0.2, 200);
    const dbgState1 = vr.debugPanel.getState();
    assert.equal(dbgState1.xrPresenting, true);
    assert.equal(dbgState1.referenceSpace, 'local-floor');
    assert.equal(dbgState1.fps, 90);
    await vr.exitVr();
    assert.equal(vr.debugPanel.group.visible, false);

    allowLocalFloor = false;
    setSessionCalls = 0;
    assert.equal(await vr.enterVr(), true);
    assert.equal(setSessionCalls, 1);
    assert.equal(vr.xrReferenceSpaceType, 'local');
    assert.equal(vr.vrRig.position.y, 1.65);
    assert.equal(vr.debugPanel.group.visible, true);
    vr.update(0.016, 0.4, 400);
    assert.equal(vr.debugPanel.getState().referenceSpace, 'local');
    await vr.exitVr();

    const standaloneDebug = createVrDebugPanel();
    assert.equal(standaloneDebug.group.visible, false);
    standaloneDebug.setVisible(true);
    assert.equal(standaloneDebug.group.visible, true);
    standaloneDebug.updateState({
      xrPresenting: true,
      referenceSpace: 'local-floor',
      rigPos: { x: 1.2, y: 0, z: -0.5 },
      fps: 72,
      frameCount: 42,
      errors: ['[webgl] test err']
    }, Date.now(), true);
    assert.equal(standaloneDebug.getState().errors.length, 1);
    standaloneDebug.dispose();
  } finally {
    vr?.dispose?.();
    if (prevNav === undefined) delete globalThis.navigator;
    else globalThis.navigator = prevNav;
    stubs.restore();
  }
});

test('v4.17 : Bras VR multijoueur jamais croisés quel que soit le yaw & orientation ergonomique CIEL Watch + masquage debug', () => {
  const stubs = createFakeDomStubs();
  const mockScene = new THREE.Scene();
  const mockCam = new THREE.PerspectiveCamera(72, 1.77, 0.1, 180);
  const mockSceneMgr = {
    scene: mockScene,
    camera: mockCam,
    renderer: null,
    getFps: () => 60,
    getXrErrors: () => [],
    setVrPresentingState() {},
    bindVrManager() {}
  };

  let vr = null;
  let remoteMgr = null;
  try {
    const mapData = createDefaultMap();
    const player = new PlayerController(mockCam, stubs.canvas, []);
    player.setBounds(mapData.bounds);
    vr = new VRManager(mockSceneMgr, player, {
      playerName: 'WatchErgonomieVR',
      mapData
    });

    assert.equal(vr.debugPanel.group.visible, false);
    assert.equal(vr.enterSimulationMode(), true);
    assert.equal(vr.debugPanel.group.visible, false);
    assert.equal(vr.toggleDebugPanel(), true);
    assert.equal(vr.debugPanel.group.visible, true);
    assert.equal(vr.toggleDebugPanel(), false);
    assert.equal(vr.debugPanel.group.visible, false);

    assert.ok(vr.wristPanel.group.position.x > 0.02);
    assert.ok(vr.wristPanel.group.position.y > 0.02);
    assert.ok(vr.wristPanel.group.position.z > 0.04);

    const watchNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(vr.wristPanel.group.quaternion);
    const watchRight = new THREE.Vector3(1, 0, 0).applyQuaternion(vr.wristPanel.group.quaternion);
    const radialAngleDeg = THREE.MathUtils.radToDeg(Math.atan2(watchNormal.x, watchNormal.y));
    assert.ok(radialAngleDeg >= 35 && radialAngleDeg <= 46, `Angle radial attendu 35-46°, obtenu ${radialAngleDeg}`);
    assert.ok(watchNormal.z > 0.15);
    assert.ok(watchRight.z < -0.9);

    vr.toggleWristWatchSim();
    for (let i = 0; i < 20; i++) {
      vr.update(0.05, i * 0.05, i * 50);
    }
    assert.equal(vr.wristPanel.group.visible, true);

    vr.wristPanel.group.updateMatrixWorld(true);
    const watchWorldPos = new THREE.Vector3();
    const watchWorldNormal = new THREE.Vector3(0, 0, 1);
    const watchWorldQuat = new THREE.Quaternion();
    vr.wristPanel.screenMesh.getWorldPosition(watchWorldPos);
    vr.wristPanel.screenMesh.getWorldQuaternion(watchWorldQuat);
    watchWorldNormal.applyQuaternion(watchWorldQuat).normalize();
    const rayOrigin = watchWorldPos.clone().addScaledVector(watchWorldNormal, 0.35);
    const rayDir = watchWorldNormal.clone().negate();
    const ray = new THREE.Raycaster(rayOrigin, rayDir, 0.01, 2);
    ray.camera = mockCam;
    const hits = ray.intersectObject(vr.wristPanel.screenMesh, false);
    assert.equal(hits.length, 1);
    assert.ok(hits[0].uv);

    stubs.restore();
    remoteMgr = new RemotePlayersManager(mockScene);
    const yAxis = new THREE.Vector3(0, 1, 0);
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 0.6]) {
      const peerId = `vr-yaw-${yaw.toFixed(2)}`;
      const leftRel = new THREE.Vector3(-0.3, 1.2, -0.38).applyAxisAngle(yAxis, yaw);
      const rightRel = new THREE.Vector3(0.3, 1.2, -0.38).applyAxisAngle(yAxis, yaw);
      remoteMgr.upsertPeer({
        id: peerId,
        name: 'Eleve_VR',
        x: 0,
        y: 0,
        z: 0,
        yaw,
        vrData: {
          active: true,
          head: { px: 0, py: 1.65, pz: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
          leftHand: { px: leftRel.x, py: leftRel.y, pz: leftRel.z, qx: 0, qy: 0, qz: 0, qw: 1 },
          rightHand: { px: rightRel.x, py: rightRel.y, pz: rightRel.z, qx: 0, qy: 0, qz: 0, qw: 1 }
        }
      });
      const peer = remoteMgr.peers.get(peerId);
      peer.group.rotation.y = yaw + Math.PI;
      remoteMgr.update(0.05, 0.1);

      const leftUpperInPlayerSpace = peer.vrTracker.leftArmSeg.upper.position.clone().applyAxisAngle(yAxis, -yaw);
      const rightUpperInPlayerSpace = peer.vrTracker.rightArmSeg.upper.position.clone().applyAxisAngle(yAxis, -yaw);
      const leftElbowInPlayerSpace = peer.vrTracker.leftArmSeg.elbow.position.clone().applyAxisAngle(yAxis, -yaw);
      const rightElbowInPlayerSpace = peer.vrTracker.rightArmSeg.elbow.position.clone().applyAxisAngle(yAxis, -yaw);

      assert.ok(leftUpperInPlayerSpace.x < -0.15, `Bras gauche croisé pour yaw=${yaw}: x=${leftUpperInPlayerSpace.x}`);
      assert.ok(rightUpperInPlayerSpace.x > 0.15, `Bras droit croisé pour yaw=${yaw}: x=${rightUpperInPlayerSpace.x}`);
      assert.ok(leftElbowInPlayerSpace.x < -0.15);
      assert.ok(rightElbowInPlayerSpace.x > 0.15);
      assert.ok(peer.vrTracker.remoteWatch.position.x > 0.015);
    }
  } finally {
    remoteMgr?.clearAll?.();
    vr?.dispose?.();
    stubs.restore();
  }
});

test('v4.18 : SceneManager WebXR autorise customRenderScene + VRManager selectstart, slider, clavier VR, main tactile, dialogue & Ascension', () => {
  const panel = createTpSpatialPanel();
  try {
    let curTemp = 280;
    let submittedCmd = null;
    let typedVal = '';
    let zoomDelta = 0;
    let orbitDelta = 0;
    let exitCalled = false;

    panel.updateState({
      mode: 'workbench',
      tpId: 'soldering',
      tpTitle: '🔥 Fer à Souder PCB 3D',
      tools: [
        { id: 't1', icon: '1', label: 'Outil 1' },
        { id: 't2', icon: '2', label: 'Outil 2' },
        { id: 't3', icon: '3', label: 'Outil 3' },
        { id: 't4', icon: '4', label: 'Outil 4' },
        { id: 't5', icon: '5', label: 'Outil 5' },
        { id: 't6', icon: '6', label: 'Outil 6' },
        { id: 't7', icon: '7', label: 'Outil 7' }
      ],
      cameras: [
        { id: 'global', label: 'Vue Globale' },
        { id: 'pcb', label: 'Zoom PCB' }
      ],
      vrSliders: [
        {
          id: 'solder_temp',
          label: 'Temp Fer',
          min: 260,
          max: 420,
          step: 5,
          value: curTemp,
          onSetValue: (v) => {
            curTemp = v;
          }
        }
      ],
      textInput: {
        value: '',
        placeholder: 'CLI...',
        onInput: (v) => {
          typedVal = v;
        },
        onSubmit: (v) => {
          submittedCmd = v;
        }
      },
      cliPresets: [{ label: 'ping', cmd: 'ping', submit: true }],
      onAdjustZoom: (d) => {
        zoomDelta = d;
      },
      onAdjustOrbit: (d) => {
        orbitDelta = d;
      },
      onExitTp: () => {
        exitCalled = true;
      }
    }, { immediate: true });

    const boxes = panel.getHitBoxes();
    assert.ok(boxes.some((b) => b.id === 'vr_tool_t7'));
    assert.ok(boxes.some((b) => b.id === 'vr_tp_exit'));
    assert.ok(boxes.some((b) => b.id === 'vr_zoom_in'));
    assert.ok(boxes.some((b) => b.id === 'vr_orbit_cw'));

    const sliderBox = boxes.find((b) => b.id === 'vr_sl_solder_temp_track');
    assert.ok(sliderBox);
    const midU = (sliderBox.x + sliderBox.w * 0.5) / panel.canvasW;
    const midV = 1 - (sliderBox.y + sliderBox.h * 0.5) / panel.canvasH;
    const hitSlider = panel.hitTestUv({ x: midU, y: midV });
    assert.equal(hitSlider.id, 'vr_sl_solder_temp_track');
    hitSlider.onDragUv({ x: midU, y: midV });
    assert.equal(curTemp, 340);

    const kbdTab = boxes.find((b) => b.id === 'vr_tab_keyboard');
    assert.ok(kbdTab);
    kbdTab.onClick();
    const kbdBoxes = panel.getHitBoxes();
    for (const ch of ['p', 'i', 'n', 'g']) {
      const k = kbdBoxes.find((b) => b.id === `vr_kbd_${ch}`);
      assert.ok(k, `Touche virtuelle ${ch} manquante`);
      k.onClick();
    }
    assert.equal(typedVal, 'ping');
    kbdBoxes.find((b) => b.id === 'vr_kbd_enter').onClick();
    assert.equal(submittedCmd, 'ping');

    const zoomBox = kbdBoxes.find((b) => b.id === 'vr_zoom_in');
    zoomBox.onClick();
    assert.ok(zoomDelta < 0);
    kbdBoxes.find((b) => b.id === 'vr_orbit_cw').onClick();
    assert.ok(orbitDelta > 0);
    kbdBoxes.find((b) => b.id === 'vr_tp_exit').onClick();
    assert.equal(exitCalled, true);

    let chosenSpec = null;
    panel.updateState({
      mode: 'ascension',
      ascension: {
        phase: 'dialogue',
        headline: 'CHOIX DIVIN',
        speech: 'Bravo 20/20',
        isWinner: true,
        countdownSec: 15,
        collection: [{ id: 'cyber', label: 'Cyber', unlocked: false }],
        choices: [{ id: 'cyber', icon: '🛡️', label: 'Cyber' }],
        onChooseSpecialty: (id) => {
          chosenSpec = id;
        }
      }
    }, { immediate: true });
    panel.getHitBoxes().find((b) => b.id === 'vr_asc_choice_cyber').onClick();
    assert.equal(chosenSpec, 'cyber');
  } finally {
    panel.dispose();
  }

  let loopFn = null;
  let renderedScene = null;
  const xrListeners = new Map();
  const ctrlListeners = [new Map(), new Map()];
  const mockControllers = [0, 1].map((idx) => {
    const grp = new THREE.Group();
    grp.addEventListener = (type, fn) => ctrlListeners[idx].set(type, fn);
    return grp;
  });
  const mockGrips = [new THREE.Group(), new THREE.Group()];
  const mockRenderer = {
    xr: {
      enabled: false,
      isPresenting: false,
      setReferenceSpaceType() {},
      addEventListener(t, fn) {
        xrListeners.set(t, fn);
      },
      removeEventListener(t) {
        xrListeners.delete(t);
      },
      getController(i) {
        return mockControllers[i];
      },
      getControllerGrip(i) {
        return mockGrips[i];
      }
    },
    autoClear: false,
    toneMapping: null,
    toneMappingExposure: 1,
    shadowMap: { enabled: false, type: null },
    setClearColor() {},
    setPixelRatio() {},
    setSize() {},
    getRenderTarget() {
      return null;
    },
    setRenderTarget() {},
    setAnimationLoop(fn) {
      loopFn = fn;
    },
    render(scene) {
      renderedScene = scene;
    }
  };
  const mockCanvas = {
    addEventListener() {},
    removeEventListener() {},
    requestPointerLock() {}
  };

  const stubs = createFakeDomStubs();
  const sm = new SceneManager(mockCanvas, { renderer: mockRenderer, skipEnvironment: true });
  let vr = null;
  try {
    const player = new PlayerController(sm.camera, mockCanvas, []);
    vr = new VRManager(sm, player, { playerName: 'TesterVR', mapData: createDefaultMap() });
    sm.start();
    mockRenderer.xr.isPresenting = true;
    xrListeners.get('sessionstart')?.();
    assert.equal(sm.vrPresenting, true);

    vr.active = true;
    vr.simMode = false;
    ctrlListeners[0].get('connected')?.({ data: { handedness: 'left', gamepad: { buttons: [], axes: [] } } });
    ctrlListeners[1].get('connected')?.({ data: { handedness: 'right', gamepad: { buttons: [], axes: [] } } });

    const wbScene = new THREE.Scene();
    let stepCount = 0;
    sm.setCustomRenderTarget(wbScene, () => {
      stepCount += 1;
    });

    let exitedByTrigger = false;
    vr.attachTpContext({
      scene: wbScene,
      interactiveMeshes: [],
      requestExit: () => {
        exitedByTrigger = true;
      },
      getSnapshot: () => ({
        tpId: 'soldering',
        tpTitle: '🔥 TP Brasure PCB 3D',
        timer: '00:12',
        accuracy: '20.0 / 20',
        briefTitle: 'Étape 1',
        briefSub: 'Test XR',
        tools: [{ id: 'iron', icon: '🔥', label: 'Fer' }],
        actions: [],
        drawerControls: []
      })
    });

    loopFn();
    assert.equal(renderedScene, wbScene);
    assert.equal(stepCount, 1);

    const exitBox = vr.tpPanel.getHitBoxes().find((b) => b.id === 'vr_tp_exit');
    assert.ok(exitBox);
    const exU = (exitBox.x + exitBox.w / 2) / vr.tpPanel.canvasW;
    const exV = 1 - (exitBox.y + exitBox.h / 2) / vr.tpPanel.canvasH;
    const localBtn = new THREE.Vector3(
      (exU - 0.5) * vr.tpPanel.screenWidth,
      (exV - 0.5) * vr.tpPanel.screenHeight,
      0
    );
    vr.tpPanel.screenMesh.updateWorldMatrix(true, false);
    const worldBtn = localBtn.clone().applyMatrix4(vr.tpPanel.screenMesh.matrixWorld);
    mockControllers[1].position.copy(worldBtn).add(new THREE.Vector3(0, 0, 0.5));
    mockControllers[1].rotation.set(0, 0, 0);
    mockControllers[1].lookAt(worldBtn);
    mockControllers[1].rotateY(Math.PI);
    mockControllers[1].updateMatrixWorld(true);

    ctrlListeners[1].get('selectstart')?.();
    vr.update(0.016, 0.05, 50);
    ctrlListeners[1].get('selectend')?.();
    assert.equal(exitedByTrigger, true);

    let dlgChoiceClicked = false;
    vr.openWorldSpatialPanel('dialogue', {
      title: 'Professeur CIEL',
      dialogue: {
        speaker: 'Professeur CIEL',
        lines: ['Bienvenue en VR !'],
        choices: [
          {
            id: 'go',
            label: 'Démarrer',
            primary: true,
            onSelect: () => {
              dlgChoiceClicked = true;
            }
          }
        ]
      }
    });
    const dlgBox = vr.worldPanel.getHitBoxes().find((b) => b.id === 'vr_dlg_choice_0');
    assert.ok(dlgBox);
    const dgU = (dlgBox.x + dlgBox.w / 2) / vr.worldPanel.canvasW;
    const dgV = 1 - (dlgBox.y + dlgBox.h / 2) / vr.worldPanel.canvasH;
    vr.worldPanel.screenMesh.updateWorldMatrix(true, false);
    const dlgWorldPos = new THREE.Vector3(
      (dgU - 0.5) * vr.worldPanel.screenWidth,
      (dgV - 0.5) * vr.worldPanel.screenHeight,
      0.012
    ).applyMatrix4(vr.worldPanel.screenMesh.matrixWorld);

    const tipObj = vr.slots.right.hand.fingers.index.tip;
    vr.update(0.016, 0.08, 80);
    const curTipWorld = new THREE.Vector3();
    tipObj.getWorldPosition(curTipWorld);
    mockGrips[1].position.add(dlgWorldPos.clone().sub(curTipWorld));
    mockGrips[1].updateMatrixWorld(true);
    vr.update(0.016, 0.1, 100);
    assert.equal(dlgChoiceClicked, true);
    vr.closeWorldSpatialPanel();
  } finally {
    vr?.dispose?.();
    sm.dispose?.();
    stubs.restore();
  }
});

test('VR WebXR v4.20 : renderToTarget POV Live sous WebXR, surfaces salle de colle 3D (laser + toucher main) & intro survie', () => {
  const noop = () => {};
  const fakeGrad = () => ({ addColorStop: noop });
  const fakeCtx = {
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    font: '12px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    lineCap: 'butt',
    globalAlpha: 1,
    save: noop,
    restore: noop,
    clip: noop,
    clearRect: noop,
    fillRect: noop,
    strokeRect: noop,
    fillText: noop,
    strokeText: noop,
    beginPath: noop,
    closePath: noop,
    rect: noop,
    roundRect: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    bezierCurveTo: noop,
    arc: noop,
    arcTo: noop,
    ellipse: noop,
    fill: noop,
    stroke: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    setLineDash: noop,
    drawImage: noop,
    createPattern: () => ({}),
    createLinearGradient: fakeGrad,
    createRadialGradient: fakeGrad,
    measureText: (txt) => ({ width: String(txt || '').length * 8 }),
    getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray((w || 4) * (h || 4) * 4) }),
    putImageData: noop
  };

  let xrRenderSnapshot = null;
  let activeTarget = 'xr-framebuffer';
  const targetCalls = [];
  const xrListeners = new Map();
  const ctrlListeners = [new Map(), new Map()];
  const mockControllers = [0, 1].map((idx) => {
    const grp = new THREE.Group();
    grp.addEventListener = (type, fn) => ctrlListeners[idx].set(type, fn);
    return grp;
  });
  const mockGrips = [new THREE.Group(), new THREE.Group()];
  const mockRenderer = {
    xr: {
      enabled: true,
      isPresenting: true,
      setReferenceSpaceType() {},
      addEventListener(t, fn) {
        xrListeners.set(t, fn);
      },
      removeEventListener(t) {
        xrListeners.delete(t);
      },
      getController(i) {
        return mockControllers[i];
      },
      getControllerGrip(i) {
        return mockGrips[i];
      }
    },
    autoClear: false,
    toneMapping: null,
    toneMappingExposure: 1,
    shadowMap: { enabled: false, autoUpdate: true, type: null },
    setClearColor() {},
    setPixelRatio() {},
    setSize() {},
    clear() {},
    getRenderTarget() {
      return activeTarget;
    },
    setRenderTarget(rt) {
      activeTarget = rt;
      targetCalls.push(rt);
    },
    setAnimationLoop() {},
    render(_scene, cam) {
      xrRenderSnapshot = {
        xrEnabledDuringPass: mockRenderer.xr.enabled,
        camera: cam,
        targetDuringPass: activeTarget
      };
    }
  };

  const stubs = createFakeDomStubs();
  globalThis.document.createElement = (tag) =>
    tag === 'canvas' ? { width: 256, height: 256, getContext: () => fakeCtx } : { addEventListener: noop };
  const mapData = createDefaultMap();
  const sm = new SceneManager(stubs.canvas, { renderer: mockRenderer, skipEnvironment: true });
  let pocket = null;
  let vr = null;

  try {
    pocket = createSurvivalPocketRooms(sm.scene, mapData);
    const hiddenMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshBasicMaterial());
    sm.scene.add(hiddenMesh);

    const povCam = pocket.povCamera;
    povCam.position.set(2, 1.65, -2);
    let sawHiddenInvisible = null;
    const origRender = mockRenderer.render;
    mockRenderer.render = (sc, cam) => {
      sawHiddenInvisible = hiddenMesh.visible;
      origRender(sc, cam);
    };

    const okRt = sm.renderToTarget(pocket.povRenderTarget, povCam, {
      hiddenObjects: [hiddenMesh],
      ambientBoost: 0.4,
      fogFar: 32
    });
    assert.equal(okRt, true);
    assert.equal(xrRenderSnapshot.xrEnabledDuringPass, false);
    assert.equal(xrRenderSnapshot.camera, povCam);
    assert.equal(xrRenderSnapshot.targetDuringPass, pocket.povRenderTarget);
    assert.equal(sawHiddenInvisible, false);
    assert.equal(hiddenMesh.visible, true);
    assert.equal(mockRenderer.xr.enabled, true);
    assert.equal(mockRenderer.shadowMap.autoUpdate, true);
    assert.equal(mockRenderer.getRenderTarget(), 'xr-framebuffer');
    assert.ok(targetCalls.includes(pocket.povRenderTarget));

    let optionPicked = -1;
    let camNextCount = 0;
    const vt = new VariationTableSession();
    pocket.updateDetentionMathSheet(vt.getVrSnapshot({}), true);
    const surfaces = pocket.getDetentionInteractiveSurfaces({
      onSelectOption: (idx) => {
        optionPicked = idx;
      },
      onPrevCamera: () => {},
      onNextCamera: () => {
        camNextCount += 1;
      }
    });

    const player = new PlayerController(sm.camera, stubs.canvas, []);
    vr = new VRManager(sm, player, {
      playerName: 'TesterVR420',
      mapData,
      getWorldInteractiveSurfaces: () => surfaces
    });
    vr.active = true;
    vr.simMode = false;
    ctrlListeners[0].get('connected')?.({ data: { handedness: 'left', gamepad: { buttons: [], axes: [] } } });
    ctrlListeners[1].get('connected')?.({ data: { handedness: 'right', gamepad: { buttons: [], axes: [] } } });

    const detCfg = pocket.getDetentionRoomConfig();
    const introApplied = vr.applySurvivalIntroPose(detCfg.spawn.x, detCfg.spawn.z, detCfg.lookAt);
    assert.equal(introApplied, true);

    const boardNextBox = getDetentionCameraHitBoxes(1024, 122, 'board').find((b) => b.id === 'cam_next');
    assert.ok(boardNextBox);
    const boardSurf = surfaces.find((s) => s.id === 'detention_board_cam_bar');
    boardSurf.mesh.updateWorldMatrix(true, false);
    const bU = (boardNextBox.x + boardNextBox.w / 2) / 1024;
    const bV = 1 - (boardNextBox.y + boardNextBox.h / 2) / 122;
    const localBoardPt = new THREE.Vector3(
      (bU - 0.5) * boardSurf.width,
      (bV - 0.5) * boardSurf.height,
      0
    );
    const worldBoardPt = localBoardPt.clone().applyMatrix4(boardSurf.mesh.matrixWorld);
    const worldBoardOrigin = new THREE.Vector3(localBoardPt.x, localBoardPt.y, 0.45).applyMatrix4(
      boardSurf.mesh.matrixWorld
    );
    vr.vrRig.updateMatrixWorld(true);
    mockControllers[1].position.copy(vr.vrRig.worldToLocal(worldBoardOrigin.clone()));
    mockControllers[1].updateMatrixWorld(true);
    mockControllers[1].lookAt(worldBoardPt);
    mockControllers[1].rotateY(Math.PI);
    mockControllers[1].updateMatrixWorld(true);

    ctrlListeners[1].get('selectstart')?.();
    vr.update(0.016, 0.2, 200);
    ctrlListeners[1].get('selectend')?.();
    assert.equal(camNextCount, 1);

    mockControllers[1].position.set(100, 100, 100);
    mockControllers[1].updateMatrixWorld(true);
    vr.update(0.016, 0.25, 250);

    const sheetBox0 = getVariationSheetHitBoxes(1024, 768)[0];
    assert.ok(sheetBox0);
    const mathSurf = surfaces.find((s) => s.id === 'detention_math_sheet');
    mathSurf.mesh.updateWorldMatrix(true, false);
    const sU = (sheetBox0.x + sheetBox0.w / 2) / 1024;
    const sV = 1 - (sheetBox0.y + sheetBox0.h / 2) / 768;
    const sheetTouchWorld = new THREE.Vector3(
      (sU - 0.5) * mathSurf.width,
      (sV - 0.5) * mathSurf.height,
      0.01
    ).applyMatrix4(mathSurf.mesh.matrixWorld);

    vr.vrRig.updateMatrixWorld(true);
    const tipObj = vr.slots.right.hand.fingers.index.tip;
    const curTipWorld = new THREE.Vector3();
    tipObj.getWorldPosition(curTipWorld);
    const curTipLocalRig = vr.vrRig.worldToLocal(curTipWorld.clone());
    const targetTipLocalRig = vr.vrRig.worldToLocal(sheetTouchWorld.clone());
    mockGrips[1].position.add(targetTipLocalRig.sub(curTipLocalRig));
    mockGrips[1].updateMatrixWorld(true);
    vr.update(0.016, 0.3, 300);
    assert.equal(optionPicked, 0);

    let introSkipTriggered = false;
    vr.openWorldSpatialPanel('survival_intro', {
      title: 'SURVIE HORREUR',
      survivalIntro: {
        title: 'COUPURE DE COURANT',
        subtitle: 'Phase 1',
        briefing: 'Survivez, terminez tous les TPs et ne faites aucun bruit au micro.',
        progress: 0.5,
        onSkip: () => {
          introSkipTriggered = true;
        }
      }
    });
    vr.worldPanel.getHitBoxes().find((b) => b.id === 'vr_surv_intro_skip')?.onClick?.();
    assert.equal(introSkipTriggered, true);
    vr.closeWorldSpatialPanel();
  } finally {
    pocket?.dispose?.();
    vr?.dispose?.();
    sm.dispose?.();
    stubs.restore();
  }
});

test('VR WebXR v4.21 : Salle de Colle hauteur assise, 6DoF libre, snap-turn joystick droit, joystick gauche bloqué, zéro ATH & intro sans murs', () => {
  const noop = () => {};
  const fakeCtx = {
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    font: '12px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    lineCap: 'butt',
    globalAlpha: 1,
    save: noop,
    restore: noop,
    clip: noop,
    clearRect: noop,
    fillRect: noop,
    strokeRect: noop,
    fillText: noop,
    strokeText: noop,
    beginPath: noop,
    closePath: noop,
    rect: noop,
    roundRect: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    bezierCurveTo: noop,
    arc: noop,
    arcTo: noop,
    ellipse: noop,
    fill: noop,
    stroke: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    setLineDash: noop,
    drawImage: noop,
    createPattern: () => ({}),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    measureText: (txt) => ({ width: String(txt || '').length * 8 }),
    getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray((w || 4) * (h || 4) * 4) }),
    putImageData: noop
  };

  const leftAxes = [0, 0, 0.85, -0.9];
  const rightAxes = [0, 0, 0, 0];
  const ctrlListeners = [new Map(), new Map()];
  const mockControllers = [0, 1].map((idx) => {
    const grp = new THREE.Group();
    grp.addEventListener = (type, fn) => ctrlListeners[idx].set(type, fn);
    return grp;
  });
  const mockGrips = [new THREE.Group(), new THREE.Group()];
  const mockRenderer = {
    xr: {
      enabled: true,
      isPresenting: true,
      setReferenceSpaceType() {},
      addEventListener() {},
      removeEventListener() {},
      getController(i) {
        return mockControllers[i];
      },
      getControllerGrip(i) {
        return mockGrips[i];
      }
    },
    autoClear: true,
    toneMapping: null,
    toneMappingExposure: 1,
    shadowMap: { enabled: false, autoUpdate: true, type: null },
    setClearColor() {},
    setPixelRatio() {},
    setSize() {},
    clear() {},
    getRenderTarget() {
      return null;
    },
    setRenderTarget() {},
    setAnimationLoop() {},
    render() {}
  };

  const stubs = createFakeDomStubs();
  globalThis.document.createElement = (tag) =>
    tag === 'canvas' ? { width: 256, height: 256, getContext: () => fakeCtx } : { addEventListener: noop };
  const mapData = createDefaultMap();
  const sm = new SceneManager(stubs.canvas, { renderer: mockRenderer, skipEnvironment: true });
  let pocket = null;
  let vr = null;

  try {
    pocket = createSurvivalPocketRooms(sm.scene, mapData);
    const detCfg = pocket.getDetentionRoomConfig();
    const player = new PlayerController(sm.camera, stubs.canvas, detCfg.colliders);
    player.setBounds(detCfg.bounds);

    vr = new VRManager(sm, player, {
      playerName: 'TesterVR421',
      mapData,
      isPrivateDebug: true,
      debugOverlayEnabled: true
    });
    vr.active = true;
    vr.simMode = false;
    vr.xrReferenceSpaceType = 'local-floor';
    vr._mountVrRigForWorld(false);
    ctrlListeners[0].get('connected')?.({ data: { handedness: 'left', gamepad: { buttons: [], axes: leftAxes } } });
    ctrlListeners[1].get('connected')?.({ data: { handedness: 'right', gamepad: { buttons: [], axes: rightAxes } } });

    const placement = resolveSurvivalIntroPlacement(mapData);
    vr.applySurvivalIntroPose(placement.spawnPos.x, placement.spawnPos.z, placement.aiPos, {
      colliders: placement.colliders,
      bounds: placement.bounds
    });
    const introWorldPos = new THREE.Vector3();
    sm.camera.getWorldPosition(introWorldPos);
    assert.equal(
      pointCollidesWithColliders(introWorldPos.x, introWorldPos.z, placement.colliders, placement.bounds, 0.32),
      false
    );
    assert.equal(
      hasFullMapLineOfSight(
        introWorldPos.x,
        introWorldPos.z,
        placement.aiPos.x,
        placement.aiPos.z,
        placement.colliders,
        placement.bounds,
        0.2,
        0.16
      ),
      true
    );

    sm.camera.position.set(0, 1.62, 0);
    const seatY = detCfg.vrSeatEyeY || detCfg.pcEye.y;
    vr.setSeatedMode(true, { x: detCfg.spawn.x, y: seatY, z: detCfg.spawn.z, yaw: 0 });
    vr.setDetentionHudHidden(true);

    vr.wristPanel.setForceVisible(true);
    vr.update(0.016, 0.1, 100);
    assert.equal(vr.wristPanel.group.visible, false);
    assert.equal(vr.debugPanel.group.visible, false);

    const headWorld = new THREE.Vector3();
    sm.camera.getWorldPosition(headWorld);
    assert.ok(Math.abs(headWorld.y - seatY) < 0.03);
    const seatedX = headWorld.x;
    const seatedZ = headWorld.z;

    for (let f = 1; f <= 5; f++) {
      vr.update(0.05, f * 0.05, 100 + f * 50);
    }
    sm.camera.getWorldPosition(headWorld);
    assert.ok(Math.abs(headWorld.x - seatedX) < 0.01);
    assert.ok(Math.abs(headWorld.z - seatedZ) < 0.01);

    sm.camera.rotation.set(-0.42, 0.35, 0, 'YXZ');
    vr.update(0.016, 0.4, 400);
    assert.ok(Math.abs(sm.camera.rotation.x + 0.42) < 0.001);
    assert.ok(Math.abs(sm.camera.rotation.y - 0.35) < 0.001);

    const yawBeforeSnap = vr.vrRig.rotation.y;
    rightAxes[2] = 0.92;
    vr.update(0.016, 0.5, 500);
    assert.notEqual(vr.vrRig.rotation.y, yawBeforeSnap);
    rightAxes[2] = 0;

    vr.setDetentionHudHidden(false);
    vr.setSeatedMode(false);
    vr.wristPanel.setForceVisible(true);
    vr.update(0.016, 0.6, 600);
    assert.equal(vr.wristPanel.group.visible, true);
    assert.equal(vr.debugPanel.group.visible, true);

    vr.enterSimulationMode();
    vr.setSeatedMode(true, { x: detCfg.spawn.x, y: seatY, z: detCfg.spawn.z, yaw: 0 });
    vr.setSimInput({ lx: 1, ly: -1 });
    vr.update(0.1, 0.7, 700);
    sm.camera.getWorldPosition(headWorld);
    assert.ok(Math.abs(headWorld.y - seatY) < 0.03);
    assert.ok(Math.abs(headWorld.x - detCfg.spawn.x) < 0.01);
    assert.ok(Math.abs(headWorld.z - detCfg.spawn.z) < 0.01);

    const simYawBefore = vr.vrRig.rotation.y;
    vr.setSimInput({ lx: 0, ly: 0, rx: -0.95 });
    vr.update(0.016, 0.8, 1200);
    assert.notEqual(vr.vrRig.rotation.y, simYawBefore);
  } finally {
    pocket?.dispose?.();
    vr?.dispose?.();
    sm.dispose?.();
    stubs.restore();
  }
});

test('VR WebXR v4.22 : interaction sur tous les PC de bureaux (raycast écran 3D direct & panneau miroir CIEL OS + joysticks)', () => {
  const stubs = createFakeDomStubs();
  const mockScene = new THREE.Scene();
  const mockCam = new THREE.PerspectiveCamera(72, 1.77, 0.1, 180);
  const mockSceneMgr = {
    scene: mockScene,
    camera: mockCam,
    renderer: null,
    getFps: () => 72,
    getXrErrors: () => [],
    setVrPresentingState() {},
    bindVrManager() {}
  };

  const mapData = createDefaultMap();
  const lab = buildLabWorld(mockScene, mapData, { hideSprites: true });
  let vr = null;

  try {
    const player = new PlayerController(mockCam, stubs.canvas, lab.colliders);
    player.setBounds(mapData.bounds);

    vr = new VRManager(mockSceneMgr, player, {
      playerName: 'GamerVR422',
      mapData,
      getInteractables: () => lab.interactables,
      getWorldInteractiveSurfaces: () => lab.pcInteractiveSurfaces,
      onInteract: (item) => {
        if (item.type === 'ciel_os_pc') {
          vr.openCielOsPanel(item.pcStation);
        }
      }
    });

    assert.equal(vr.enterSimulationMode(), true);
    const pcStation = lab.pcStations[0];
    assert.ok(pcStation);

    const snakeBox = pcStation.desktop.getHitBoxes().find((b) => b.id === 'desk_icon_snake');
    assert.ok(snakeBox);
    const surf = pcStation.surfaces[0];
    assert.ok(surf);
    const uv = {
      x: (snakeBox.x + snakeBox.w / 2) / pcStation.desktop.width,
      y: 1 - (snakeBox.y + snakeBox.h / 2) / pcStation.desktop.height
    };
    const hit3d = surf.hitTestUv(uv);
    assert.equal(hit3d.id, 'desk_icon_snake');
    hit3d.onClick(uv);
    assert.equal(pcStation.desktop.activeAppId, 'snake');

    const panel = vr.openCielOsPanel(pcStation);
    assert.ok(panel);
    assert.equal(vr.activePcStation, pcStation);
    assert.equal(panel.getState().mode, 'ciel_os');
    assert.equal(panel.getState().activeAppId, 'snake');

    const snakeGame = pcStation.desktop.getGameInstance('snake');
    assert.deepEqual(snakeGame.nextDir, { x: 1, y: 0 });
    vr.setSimInput({ lx: 0, ly: -0.95 });
    vr.update(0.05, 0.2, 200);
    assert.deepEqual(snakeGame.nextDir, { x: 0, y: -1 });

    const termIcon = panel.getHitBoxes().find((b) => b.id === 'desk_icon_terminal');
    assert.ok(termIcon);
    termIcon.onClick();
    assert.equal(pcStation.desktop.activeAppId, 'terminal');

    assert.equal(vr.closeCielOsPanel(), true);
    assert.equal(vr.activePcStation, null);
    assert.equal(pcStation.isActiveSession, false);
  } finally {
    vr?.dispose?.();
    lab.dispose();
    stubs.restore();
  }
});

test('VR WebXR v4.24 : montre VR CIEL Coins, bouton Boutique, panneau spatial Boutique 3D & borne kiosque', () => {
  const stubs = createFakeDomStubs();
  const mockScene = new THREE.Scene();
  const mockCam = new THREE.PerspectiveCamera(72, 1.77, 0.1, 180);
  const mockSceneMgr = {
    scene: mockScene,
    camera: mockCam,
    renderer: null,
    getFps: () => 72,
    getXrErrors: () => [],
    setVrPresentingState() {},
    bindVrManager() {}
  };

  const mapData = createDefaultMap();
  const lab = buildLabWorld(mockScene, mapData, { hideSprites: true });
  let vr = null;

  try {
    const player = new PlayerController(mockCam, stubs.canvas, lab.colliders);
    player.setBounds(mapData.bounds);

    let openShopTriggered = 0;
    vr = new VRManager(mockSceneMgr, player, {
      playerName: 'ShopperVR424',
      mapData,
      getInteractables: () => lab.interactables,
      onOpenShop: () => {
        openShopTriggered += 1;
      }
    });

    assert.equal(vr.enterSimulationMode(), true);
    vr.updateHudInfo({
      coins: 650,
      coinGainAmount: 150,
      coinGainUntil: Date.now() + 3000
    });
    const wristHits = vr.wristPanel.getHitBoxes();
    const shopWatchBtn = wristHits.find((b) => b.id === 'btn_shop');
    assert.ok(shopWatchBtn);

    vr.options.onOpenShop?.();
    assert.equal(openShopTriggered, 1);

    const kiosk = lab.interactables.find((it) => it.type === 'shop_kiosk');
    assert.equal(kiosk, undefined);

    let activeCat = 'skins';
    let closeCalls = 0;
    const makeShopPayload = (cat, selId) => ({
      ...buildShopViewModel(
        {
          coins: 1200,
          ownedItems: ['shop_neon_tech'],
          equippedSkin: null,
          equippedPet: null,
          equippedTrail: null
        },
        cat,
        selId
      ),
      onSelectCategory: (nextCat) => {
        activeCat = nextCat;
      },
      onSelectItem: () => {},
      onBuy: () => {},
      onEquip: () => {},
      onClose: () => {
        closeCalls += 1;
        vr.closeShopSpatialPanel();
      }
    });

    const panel = vr.openShopSpatialPanel(makeShopPayload('skins', 'shop_neon_tech'));
    assert.ok(panel);
    assert.equal(panel.getState().mode, 'shop');
    assert.ok(vr.shopPreviewGroup);
    assert.equal(vr.shopPreviewKind, 'skins');

    const rotBefore = vr.shopPreviewGroup.rotation.y;
    vr.update(0.05, 0.2, 200);
    assert.ok(vr.shopPreviewGroup.rotation.y > rotBefore);

    const hitIds = new Set(panel.getHitBoxes().map((b) => b.id));
    assert.ok(hitIds.has('vr_shop_cat_skins'));
    assert.ok(hitIds.has('vr_shop_cat_pets'));
    assert.ok(hitIds.has('vr_shop_cat_accessories'));
    assert.ok(hitIds.has('vr_shop_item_shop_neon_tech'));
    assert.ok(hitIds.has('vr_shop_equip'));
    assert.ok(hitIds.has('vr_shop_close'));

    panel.getHitBoxes().find((b) => b.id === 'vr_shop_cat_pets').onClick();
    assert.equal(activeCat, 'pets');

    vr.updateShopSpatialPanel(makeShopPayload('pets', SHOP_PETS[0].id));
    assert.equal(vr.shopPreviewKind, 'pets');
    assert.equal(vr.shopPreviewItemId, SHOP_PETS[0].id);
    assert.ok(vr.shopPreviewObject);

    panel.getHitBoxes().find((b) => b.id === 'vr_shop_close').onClick();
    assert.equal(closeCalls, 1);
    assert.equal(vr.shopPreviewGroup, null);
    assert.equal(vr.worldPanel, null);
  } finally {
    vr?.dispose?.();
    lab.dispose();
    stubs.restore();
  }
});

test('VR WebXR v4.28 : Baie de brassage perforée sans voile opaque & Arène de Combat CIEL (armes, swing bras, panneaux & montre)', () => {
  const stubs = createFakeDomStubs();
  const mockScene = new THREE.Scene();
  const mockCam = new THREE.PerspectiveCamera(72, 1.77, 0.1, 180);
  const mockSceneMgr = {
    scene: mockScene,
    camera: mockCam,
    renderer: null,
    getFps: () => 72,
    getXrErrors: () => [],
    setVrPresentingState() {},
    bindVrManager() {}
  };

  const mapData = createDefaultMap();
  const lab = buildLabWorld(mockScene, mapData, { hideSprites: true });
  let vr = null;

  try {
    const player = new PlayerController(mockCam, stubs.canvas, lab.colliders);
    player.setBounds(mapData.bounds);

    vr = new VRManager(mockSceneMgr, player, {
      playerName: 'CombattantVR',
      mapData,
      getInteractables: () => lab.interactables
    });

    assert.equal(vr.enterSimulationMode(), true);
    vr.update(0.05, 0.1, 1000);

    const spot = lab.hidingSpots[0];
    const interior = computeRackInteriorPosition({
      x: spot.x,
      z: spot.z,
      rotRad: spot.rotRad,
      w: spot.w,
      d: spot.d
    });
    const exit = computeRackExitPosition(
      { x: spot.x, z: spot.z, rotRad: spot.rotRad, w: spot.w, d: spot.d },
      lab.colliders,
      mapData.bounds,
      0.42
    );

    assert.equal(vr.enterHidingRackVr(interior.x, interior.z, interior.baseYaw, interior.y), true);
    assert.equal(vr.hidingInRack, true);
    const rigXBefore = vr.vrRig.position.x;
    const rigZBefore = vr.vrRig.position.z;

    vr.setSimInput({ lx: 1, ly: 1, lookDx: 900, lookDy: -900 });
    vr.update(0.05, 0.15, 1050);
    assert.equal(vr.vrRig.position.x, rigXBefore);
    assert.equal(vr.vrRig.position.z, rigZBefore);
    assert.ok(Math.abs(vr.simLookYaw) <= Math.PI / 4 + 0.001);
    assert.ok(Math.abs(vr.simLookPitch) <= (20 * Math.PI) / 180 + 0.001);

    const hiddenPanel = vr.openWorldSpatialPanel('survival_hidden', {
      survivalHidden: {
        rackLabel: 'Baie Perforée VR',
        noiseLevel: 12,
        threatNear: true,
        onExitRack: () => {}
      }
    });
    assert.ok(hiddenPanel);
    assert.equal(hiddenPanel.group.children[0].visible, false);

    assert.equal(vr.exitHidingRackVr(exit.x, exit.z, exit.yaw), true);
    assert.equal(vr.hidingInRack, false);
    assert.equal(vr.worldPanel, null);
    assert.equal(pointCollidesWithColliders(exit.x, exit.z, lab.colliders, mapData.bounds, 0.42), false);

    let modeClicks = 0;
    let readyClicks = 0;
    const lobbyPanel = vr.openWorldSpatialPanel('combat_lobby', {
      combatLobby: {
        mode: 'guns',
        fillBots: true,
        players: [{ id: 'p1', name: 'CombattantVR', ready: false, weaponId: 'fiber_rifle' }],
        weapons: COMBAT_WEAPONS.filter((w) => w.mode === 'guns'),
        selectedWeaponId: 'fiber_rifle',
        localReady: false,
        onSelectMode: () => {
          modeClicks += 1;
        },
        onToggleReady: () => {
          readyClicks += 1;
        },
        onSelectWeapon: () => {},
        onToggleBots: () => {},
        onLeave: () => {}
      }
    });
    assert.ok(lobbyPanel);
    const lobbyHits = new Set(lobbyPanel.getHitBoxes().map((b) => b.id));
    assert.ok(lobbyHits.has('vr_cbt_mode_guns'));
    assert.ok(lobbyHits.has('vr_cbt_mode_melee'));
    assert.ok(lobbyHits.has('vr_cbt_bots'));
    assert.ok(lobbyHits.has('vr_cbt_ready'));
    assert.ok(lobbyHits.has('vr_cbt_leave'));
    lobbyPanel.getHitBoxes().find((b) => b.id === 'vr_cbt_mode_melee').onClick();
    lobbyPanel.getHitBoxes().find((b) => b.id === 'vr_cbt_ready').onClick();
    assert.equal(modeClicks, 1);
    assert.equal(readyClicks, 1);
    vr.closeWorldSpatialPanel();

    const attacks = [];
    let reloads = 0;
    let cycles = 0;
    vr.setCombatMode(true, {
      mode: 'guns',
      weaponId: 'fiber_rifle',
      callbacks: {
        onAttack: (payload) => attacks.push(payload),
        onReload: () => {
          reloads += 1;
        },
        onCycleWeapon: () => {
          cycles += 1;
        }
      }
    });
    assert.ok(vr.combatWeaponObj);
    assert.equal(vr.combatWeaponObj.weaponId, 'fiber_rifle');

    vr.setSimInput({ mouseTrigger: true });
    vr.update(0.05, 0.25, 1600);
    assert.equal(attacks.length, 1);
    assert.equal(attacks[0].weaponId, 'fiber_rifle');
    assert.equal(attacks[0].isVrSwing, false);
    vr.setSimInput({ mouseTrigger: false });

    vr.setSimInput({ grip: 1 });
    vr.update(0.05, 0.3, 1650);
    assert.equal(cycles, 1);
    vr.setSimInput({ grip: 0 });

    vr.setCombatMode(true, {
      mode: 'melee',
      weaponId: 'ddr5_katana',
      callbacks: {
        onAttack: (payload) => attacks.push(payload),
        onReload: () => {
          reloads += 1;
        },
        onCycleWeapon: () => {
          cycles += 1;
        }
      }
    });
    assert.equal(vr.combatWeaponId, 'ddr5_katana');
    vr.update(0.05, 0.35, 2200);
    vr.simRightPivot.position.x += 0.35;
    vr.simRightPivot.updateMatrixWorld?.(true);
    vr.update(0.05, 0.4, 2260);
    assert.equal(attacks.length, 2);
    assert.equal(attacks[1].weaponId, 'ddr5_katana');
    assert.equal(attacks[1].isVrSwing, true);

    vr.updateHudInfo({
      combatStatus: {
        active: true,
        mode: 'melee',
        timerText: '02:05',
        hp: 90,
        maxHp: 100,
        weaponName: 'Katana RAM DDR5',
        kills: 4,
        killLimit: 10,
        deaths: 1,
        streak: 3
      }
    });
    assert.equal(vr.wristPanel.getState().combatStatus.active, true);

    const endPanel = vr.openWorldSpatialPanel('combat_end', {
      combatEnd: {
        won: true,
        reason: 'Victoire VR !',
        coinsEarned: 160,
        scoreboard: [{ id: 'p1', name: 'CombattantVR', kills: 10, deaths: 2 }],
        localId: 'p1',
        onReplay: () => {},
        onExit: () => {}
      }
    });
    assert.ok(endPanel);
    const endHits = new Set(endPanel.getHitBoxes().map((b) => b.id));
    assert.ok(endHits.has('vr_cbt_replay'));
    assert.ok(endHits.has('vr_cbt_exit'));

    vr.closeWorldSpatialPanel();
    vr.setCombatMode(true, {
      mode: 'guns',
      weaponId: 'ping_sniper',
      callbacks: {
        onAttack: (payload) => attacks.push(payload),
        onReload: () => {
          reloads += 1;
        },
        onCycleWeapon: () => {
          cycles += 1;
        }
      }
    });
    assert.ok(vr.combatReticleGroup);
    vr.simRightPivot.position.set(0, -0.04, -0.22);
    vr.simRightPivot.rotation.set(0, 0, 0);
    vr.simRightPivot.updateMatrixWorld?.(true);
    vr.update(0.05, 0.45, 3100);
    assert.equal(vr.combatWeaponId, 'ping_sniper');
    assert.equal(vr.combatAdsActive, true);
    assert.equal(vr.combatScopeZoomActive, true);

    vr.setCombatMode(false);
    assert.equal(vr.combatWeaponObj, null);
    assert.equal(vr.wristPanel.getState().combatStatus, null);
  } finally {
    vr?.dispose?.();
    lab.dispose();
    stubs.restore();
  }
});
