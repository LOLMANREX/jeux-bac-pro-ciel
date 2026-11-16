import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { WebSocket } from 'ws';
import { createGameServer } from '../server/index.js';
import { buildArticulatedVRHand } from '../src/vr/VRHandBuilder.js';
import { createTpSpatialPanel, createWristHudPanel } from '../src/vr/VRHudPanel.js';
import { VRManager } from '../src/vr/VRManager.js';
import { attachRemoteVrVisuals, buildStudentAvatarMesh } from '../src/world/AvatarBuilder.js';
import { createDefaultMap } from '../src/world/mapSchema.js';
import { PlayerController } from '../src/world/PlayerController.js';
import { RemotePlayersManager } from '../src/world/RemotePlayers.js';

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
