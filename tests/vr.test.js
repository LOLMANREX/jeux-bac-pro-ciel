import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { WebSocket } from 'ws';
import { createGameServer } from '../server/index.js';
import { buildArticulatedVRHand } from '../src/vr/VRHandBuilder.js';
import { createTpSpatialPanel, createWristHudPanel } from '../src/vr/VRHudPanel.js';
import { VRManager } from '../src/vr/VRManager.js';
import { attachRemoteVrVisuals, buildStudentAvatarMesh } from '../src/world/AvatarBuilder.js';

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

test('buildArticulatedVRHand construit 5 doigts articulés gauche/droite pour tous les skins et anime le curl', () => {
  const styles = ['standard', 'gold24k', 'diamond', 'matrix', 'carbon_neon', 'chrome_rgb', 'cyber_gold'];
  for (const style of styles) {
    const leftHand = buildArticulatedVRHand({ handedness: 'left', skin: { style, outfitColor: '#0284c7' } });
    const rightHand = buildArticulatedVRHand({ handedness: 'right', skin: { style, outfitColor: '#10b981' } });

    assert.equal(Object.keys(leftHand.fingers).length, 5);
    assert.equal(Object.keys(rightHand.fingers).length, 5);
    assert.ok(leftHand.fingers.thumb);
    assert.ok(leftHand.fingers.index);
    assert.ok(leftHand.fingers.index.basePivot.position.x > 0);
    assert.ok(rightHand.fingers.index.basePivot.position.x < 0);

    leftHand.setPose({ trigger: 0, grip: 0, thumb: 0, elapsed: 0.2 });
    const openIndexX = leftHand.fingers.index.basePivot.rotation.x;
    const openPinkyX = leftHand.fingers.pinky.basePivot.rotation.x;

    leftHand.setPose({ trigger: 1, grip: 1, thumb: 1, elapsed: 0.6 });
    const closedIndexX = leftHand.fingers.index.basePivot.rotation.x;
    const closedPinkyX = leftHand.fingers.pinky.basePivot.rotation.x;
    const closedMiddleDistX = leftHand.fingers.middle.midPivot.rotation.x;

    assert.ok(closedIndexX < openIndexX);
    assert.ok(closedPinkyX < openPinkyX);
    assert.ok(closedMiddleDistX < -0.5);

    leftHand.applySkin({ style: 'gold24k' }, 1.2);
    leftHand.dispose();
    rightHand.dispose();
  }
});

test('AvatarBuilder gère le masquage 1ère personne VR et le suivi 3-points distant sans casser les joueurs non-VR', () => {
  const avatar = buildStudentAvatarMesh({ style: 'cyber_gold', hat: 'vr_headset' });
  assert.ok(avatar.headGroup);

  avatar.setFirstPersonVrHidden(true);
  assert.equal(avatar.headGroup.visible, false);
  assert.equal(avatar.leftArm.visible, false);
  assert.equal(avatar.rightArm.visible, false);

  avatar.setFirstPersonVrHidden(false);
  assert.equal(avatar.headGroup.visible, true);
  assert.equal(avatar.leftArm.visible, true);
  assert.equal(avatar.rightArm.visible, true);

  const tracker = attachRemoteVrVisuals(avatar, { style: 'matrix' });
  avatar.group.position.set(2, 0, -3);

  const vrDataOn = {
    active: true,
    head: { px: 0.1, py: 1.62, pz: -0.05, qx: 0, qy: 0.2588, qz: 0, qw: 0.9659 },
    leftHand: { px: -0.32, py: 1.15, pz: -0.35, qx: 0, qy: 0, qz: 0, qw: 1, trigger: 0.8, grip: 0.4, thumb: 0.2 },
    rightHand: { px: 0.34, py: 1.22, pz: -0.4, qx: 0, qy: 0, qz: 0, qw: 1, trigger: 1, grip: 0.9, thumb: 1 }
  };
  for (let i = 0; i < 20; i++) {
    tracker.update(vrDataOn, 0.016, i * 0.016);
  }
  assert.equal(tracker.vrRoot.visible, true);
  assert.equal(avatar.leftArm.visible, false);
  assert.equal(avatar.rightArm.visible, false);
  assert.ok(tracker.leftHand.root.position.y > 0.9);
  assert.ok(tracker.rightHand.root.position.y > 0.9);

  tracker.update({ active: false }, 0.016, 1.0);
  assert.equal(tracker.vrRoot.visible, false);
  assert.equal(avatar.leftArm.visible, true);
  assert.equal(avatar.rightArm.visible, true);

  tracker.dispose();
});

test('VRHudPanel hitTestUv détecte les boutons sur la montre poignet et le panneau TP spatial', () => {
  const wrist = createWristHudPanel({ name: 'Lucas' });
  wrist.setForceVisible(true);
  wrist.updateVisibility(new THREE.Vector3(0, 1.6, 1), 0.016);
  assert.equal(wrist.group.visible, true);
  wrist.dispose();

  const tpPanel = createTpSpatialPanel();
  let exited = false;
  let selectedStage = -1;
  let replayed = false;
  tpPanel.updateState({
    tpTitle: 'TP Test VR',
    stages: [{ name: 'Étape 1' }, { name: 'Étape 2' }],
    activeStageIdx: 0,
    onSelectStage: (i) => {
      selectedStage = i;
    },
    onExitTp: () => {
      exited = true;
    },
    tools: [{ id: 't1', icon: '🔧', label: 'Outil' }],
    actions: [{ label: 'Valider', primary: true, onClick: () => {} }]
  });
  assert.ok(tpPanel.screenMesh);
  assert.equal(selectedStage, -1);
  assert.equal(exited, false);

  tpPanel.updateState({
    result: {
      score: 17.5,
      xp: 292,
      duration: '01:12',
      mention: 'Très solide maîtrise CIEL !',
      onReplay: () => {
        replayed = true;
      },
      onExit: () => {
        exited = true;
      }
    }
  });
  assert.equal(replayed, false);
  tpPanel.dispose();
});

test('VRManager gère le mode Simulation VR PC, les poses de synchronisation 3-points et la bascule TP', async () => {
  const mockScene = new THREE.Scene();
  const mockCam = new THREE.PerspectiveCamera(72, 1.77, 0.1, 100);
  const mockSceneMgr = {
    scene: mockScene,
    camera: mockCam,
    renderer: null,
    envRenderTarget: null,
    setCustomRenderTarget() {}
  };
  const mockPlayer = {
    position: new THREE.Vector3(0, 0, 2),
    groundY: 0,
    yaw: 0,
    speed: 4,
    keys: new Set(),
    _collides: () => false,
    _applyCamera() {}
  };

  let enterCalled = 0;
  let exitCalled = 0;
  const vr = new VRManager(mockSceneMgr, mockPlayer, {
    skin: { style: 'gold24k' },
    playerName: 'Tester_VR',
    onEnterVr: () => {
      enterCalled += 1;
    },
    onExitVr: () => {
      exitCalled += 1;
    }
  });

  const started = vr.enterSimulationMode();
  assert.equal(started, true);
  assert.equal(enterCalled, 1);
  assert.equal(vr.isVrActive(), true);

  vr.setSimInput({ grip: 1, thumb: 0.5, mouseTrigger: true });
  vr.setSimKey('KeyW', true);
  vr.update(0.05, 0.5, 500);
  assert.ok(mockPlayer.position.z < 2);

  const sync = vr.getVrSyncPayload();
  assert.equal(sync.active, true);
  assert.ok(typeof sync.head.py === 'number' && sync.head.py > 1);
  assert.equal(sync.rightHand.trigger, 1);
  assert.equal(sync.rightHand.grip, 1);

  const tpScene = new THREE.Scene();
  let exitReq = false;
  vr.attachTpContext({
    scene: tpScene,
    interactiveMeshes: [],
    requestExit: () => {
      exitReq = true;
    },
    getSnapshot: () => ({ tpTitle: 'TP Oscillo', badge: 'STEP 1', briefTitle: 'Mesure', briefSub: 'Test' })
  });
  assert.equal(vr.vrRig.parent, tpScene);
  assert.equal(vr.vrRig.position.y, -0.82);

  vr.detachTpContext();
  assert.equal(vr.vrRig.parent, mockScene);
  assert.equal(exitReq, false);

  await vr.exitVr();
  assert.equal(exitCalled, 1);
  assert.equal(vr.isVrActive(), false);
  assert.deepEqual(vr.getVrSyncPayload(), { active: false });
});

test('Serveur WebSocket valide, stocke et diffuse vrData 3-points en cross-play avec joueurs non-VR', async () => {
  const { server, wsHub } = createGameServer({ dbPath: null });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const wsUrl = `ws://127.0.0.1:${port}/ws`;

  const c1 = new WebSocket(wsUrl);
  const c2 = new WebSocket(wsUrl);

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
          head: { px: 0.02, py: 1.66, pz: -0.01, qx: 0, qy: 0.2, qz: 0, qw: 0.979 },
          leftHand: { px: -0.28, py: 1.12, pz: -0.34, qx: 0, qy: 0, qz: 0, qw: 1, grip: 0.8, trigger: 0.2, thumb: 1 },
          rightHand: { px: 0.29, py: 1.24, pz: -0.41, qx: 0, qy: 0, qz: 0, qw: 1, grip: 0.1, trigger: 1.5, thumb: 0 }
        }
      })
    );
    const moveMsg = await c2MoveP;
    assert.equal(moveMsg.vrData.active, true);
    assert.equal(moveMsg.vrData.head.py, 1.66);
    assert.equal(moveMsg.vrData.rightHand.trigger, 1);

    const c1MoveFromPcP = waitForMsg(c1, (m) => m.type === 'player_moved' && !m.vrData);
    c2.send(JSON.stringify({ type: 'move', x: 3.1, y: 0, z: 1.2, yaw: 0 }));
    const pcMoveMsg = await c1MoveFromPcP;
    assert.equal(pcMoveMsg.x, 3.1);
    assert.equal(pcMoveMsg.vrData, null);

    const c3 = new WebSocket(wsUrl);
    await new Promise((res) => c3.once('open', res));
    const w3P = waitForMsg(c3, (m) => m.type === 'welcome');
    c3.send(JSON.stringify({ type: 'join', name: 'ChloeLate', room: 'plateau-u300', skin: { style: 'standard' } }));
    const w3 = await w3P;
    const alicePeer = w3.peers.find((p) => p.name === 'AliceVR');
    const bobPeer = w3.peers.find((p) => p.name === 'BobPC');
    assert.equal(alicePeer.vrData?.active, true);
    assert.equal(bobPeer.vrData, null);
    c3.close();
  } finally {
    c1.close();
    c2.close();
    wsHub.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
