import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import * as THREE from 'three';
import { WebSocket } from 'ws';
import { createGameServer } from '../server/index.js';
import { createDefaultMap } from '../src/world/mapSchema.js';
import { buildLabWorld } from '../src/world/LabBuilder.js';
import { createHorrorTeacher } from '../src/world/NpcTeacher.js';
import { createSurvivalPocketRooms } from '../src/world/SurvivalArena3D.js';
import {
  SURVIVAL_CAPTURE_RADIUS,
  SURVIVAL_MIC_NOISE_THRESHOLD,
  SURVIVAL_MIC_SCREAM_THRESHOLD,
  SURVIVAL_MIN_PLAYERS,
  SurvivalMatchController,
  buildNavGrid,
  evaluateMicVolumeForAI,
  findPathAStar,
  getSurvivalDoors,
  getSurvivalHidingSpots,
  getSurvivalRequiredTps,
  pointCollidesWithColliders
} from '../src/world/SurvivalEngine.js';
import {
  VariationTableSession,
  checkVariationAnswer,
  generateVariationExercise,
  renderVariationTableMarkup
} from '../src/minigames/VariationTableGame.js';
import { createTpSpatialPanel } from '../src/vr/VRHudPanel.js';

function openWs(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const onErr = (err) => {
      cleanup();
      reject(err);
    };
    const onOpen = () => {
      cleanup();
      resolve(ws);
    };
    const cleanup = () => {
      ws.off('error', onErr);
      ws.off('open', onOpen);
    };
    ws.on('error', onErr);
    ws.on('open', onOpen);
  });
}

function waitForMessage(ws, predicate, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', onMsg);
      reject(new Error('Timeout attente message WebSocket'));
    }, timeoutMs);
    const onMsg = (raw) => {
      let data = null;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (predicate(data)) {
        clearTimeout(timer);
        ws.off('message', onMsg);
        resolve(data);
      }
    };
    ws.on('message', onMsg);
  });
}

test('SurvivalEngine : A* pathfinding contourne les murs sans traverser ni boucler', () => {
  const map = createDefaultMap();
  const grid = buildNavGrid(map);
  assert.ok(grid.cols > 10 && grid.rows > 10);

  const path = findPathAStar(grid, -8.5, -8.5, 8.5, 8.5);
  assert.ok(Array.isArray(path) && path.length >= 2);
  for (const pt of path) {
    assert.equal(pointCollidesWithColliders(pt.x, pt.z, grid.colliders, 0.12), false);
  }

  assert.ok(getSurvivalDoors(map).length >= 1);
  assert.ok(getSurvivalHidingSpots(map).length >= 4);
  assert.ok(getSurvivalRequiredTps(map).length >= 5);
});

test('SurvivalEngine : écoute micro RMS à travers les murs, cachette Baie de Brassage & capture -> défaite', () => {
  const map = createDefaultMap();
  const ctrl = new SurvivalMatchController(map, { roomId: 'test-surv', graceMs: 0, captureRadius: 1.35 });

  assert.equal(SURVIVAL_MIN_PLAYERS, 2);

  ctrl.joinLobby({ id: 'p1', name: 'Alice' });
  const r1 = ctrl.setReady('p1', true, 1000);
  assert.equal(r1.autoStarted, false);
  assert.equal(ctrl.phase, 'lobby');

  ctrl.joinLobby({ id: 'p2', name: 'Bob' });
  const r2 = ctrl.setReady('p2', true, 1200);
  assert.equal(r2.autoStarted, true);
  assert.equal(ctrl.phase, 'active');

  ctrl.ai.x = 0.2;
  ctrl.ai.z = 0.2;
  ctrl.updatePlayerPose('p1', -6.5, -1.5, 0);
  ctrl.updatePlayerPose('p2', 7.5, 7.5, 0);

  const silentEval = evaluateMicVolumeForAI({ micEnabled: true, level: 0.1, distance: 5 });
  assert.equal(silentEval.heard, false);

  const screamEval = evaluateMicVolumeForAI({
    micEnabled: true,
    level: SURVIVAL_MIC_SCREAM_THRESHOLD + 0.1,
    distance: 10
  });
  assert.equal(screamEval.heard, true);
  assert.equal(screamEval.state, 'chase');

  const loudRes = ctrl.reportMicNoise(
    'p1',
    { micEnabled: true, level: SURVIVAL_MIC_SCREAM_THRESHOLD + 0.12, rms: 0.2 },
    2000
  );
  assert.equal(loudRes.heard, true);
  assert.equal(ctrl.ai.state, 'chase');
  assert.equal(ctrl.ai.targetPlayerId, 'p1');
  assert.ok(ctrl.ai.path.length >= 1);

  const rack = ctrl.hidingSpots[0];
  assert.ok(rack);
  ctrl.reportMicNoise('p1', { micEnabled: false, level: 0, rms: 0 }, 2100);
  const hideRes = ctrl.setPlayerHiding('p1', rack.id);
  assert.equal(hideRes.ok, true);
  assert.equal(ctrl.ai.state, 'patrol');
  assert.equal(ctrl.ai.targetPlayerId, null);

  ctrl.ai.x = rack.x;
  ctrl.ai.z = rack.z;
  const stepSilent = ctrl.step(0.1, 2200);
  assert.equal(stepSilent.caught.length, 0);

  ctrl.setPlayerHiding('p1', null);
  ctrl.updatePlayerPose('p1', 0, 0, 0);
  ctrl.updatePlayerPose('p2', 0, 0, 0);
  ctrl.ai.x = 0;
  ctrl.ai.z = SURVIVAL_CAPTURE_RADIUS * 0.4;
  const stepCatch = ctrl.step(0.1, 2400);
  assert.equal(stepCatch.caught.length, 2);
  assert.ok(stepCatch.ended);
  assert.equal(stepCatch.ended.outcome, 'defeat');
});

test('SurvivalEngine : victoire coopérative lorsque 100 % des TPs sont validés', () => {
  const map = createDefaultMap();
  const ctrl = new SurvivalMatchController(map, { roomId: 'test-win', graceMs: 0 });
  ctrl.joinLobby({ id: 'p1', name: 'Alice' });
  ctrl.joinLobby({ id: 'p2', name: 'Bob' });
  ctrl.setReady('p1', true, 1000);
  ctrl.setReady('p2', true, 1050);

  const reqs = [...ctrl.requiredTps];
  assert.ok(reqs.length >= 5);
  for (let i = 0; i < reqs.length - 1; i++) {
    const res = ctrl.completeTp(reqs[i], 'p1', 15, 2000 + i * 100);
    assert.equal(res.accepted, true);
    assert.equal(res.victory, false);
  }
  const finalRes = ctrl.completeTp(reqs[reqs.length - 1], 'p2', 18, 3000);
  assert.equal(finalRes.accepted, true);
  assert.equal(finalRes.victory, true);
  assert.equal(finalRes.ended.outcome, 'victory');
});

test('VariationTableGame : génération infinie, vérification & session Heure de Colle', () => {
  const session = new VariationTableSession();
  for (let i = 0; i < 6; i++) {
    const ex = generateVariationExercise(i);
    assert.ok(ex.fxLabel.startsWith('f(x)'));
    assert.equal(ex.options.length, 4);
    assert.ok(renderVariationTableMarkup(ex).includes('vt-table'));

    const badIdx = (ex.correctIndex + 1) % 4;
    assert.equal(checkVariationAnswer(ex, badIdx).correct, false);
    assert.equal(checkVariationAnswer(ex, ex.correctIndex).correct, true);
  }

  const cur = session.current;
  const okRes = session.submit(cur.correctIndex);
  assert.equal(okRes.correct, true);
  assert.equal(session.solvedCount, 1);
  assert.equal(session.streak, 1);
  const vrSnap = session.getVrSnapshot({ completedTps: 2, totalTps: 5 });
  assert.equal(vrSnap.solvedCount, 1);
  assert.equal(vrSnap.completedTps, 2);
});

function installFakeCanvasDocument() {
  const prevDoc = globalThis.document;
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
  globalThis.document = {
    createElement: (tag) =>
      tag === 'canvas'
        ? {
            width: 256,
            height: 256,
            getContext: () => fakeCtx
          }
        : { addEventListener: noop }
  };
  return () => {
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
  };
}

test('3D & VR : LabBuilder, NpcTeacher Horreur, SurvivalArena3D et VRHudPanel modes survie/colle', () => {
  const restoreDoc = installFakeCanvasDocument();
  try {
    const map = createDefaultMap();
    const scene = new THREE.Scene();
    const lab = buildLabWorld(scene, map);
    assert.ok(lab.survivalDoors.length >= 1);
    assert.ok(lab.hidingSpots.length >= 4);
    lab.setHorrorLighting(true, 0.7);
    lab.setHorrorLighting(false, 1.0);
    lab.setTeacherVisible(false);
    lab.setTeacherVisible(true);
    lab.dispose();

    const teacher = createHorrorTeacher(scene, { visible: true });
    teacher.snapTo(4, -4, 0.5);
    teacher.setTargetState({ x: 5, z: -4, yaw: 1.2, state: 'chase' });
    teacher.update(0.05, 1.0);
    teacher.dispose();

    const pocket = createSurvivalPocketRooms(scene, map);
    assert.ok(pocket.getWaitingRoomConfig().interactables.length >= 2);
    assert.ok(pocket.getDetentionRoomConfig().interactables.length >= 1);
    pocket.updateWaitingBoard({ lobbyPlayers: [], minPlayers: 2 }, true);
    pocket.updateSurveillanceScreen(
      { completedTps: ['oscilloscope'], requiredTps: ['oscilloscope'], participants: [], ai: { x: 0, z: 0, state: 'patrol' } },
      true
    );
    pocket.dispose();

    const panel = createTpSpatialPanel();
    let toggledReady = false;
    panel.updateState(
      {
        mode: 'survival_lobby',
        survivalLobby: {
          players: [{ id: 'a', name: 'Alice', ready: false }],
          minPlayers: 2,
          localReady: false,
          onToggleReady: () => {
            toggledReady = true;
          },
          onToggleMic: () => {},
          onLeave: () => {}
        }
      },
      { immediate: true }
    );
    const readyBtn = panel.getHitBoxes().find((b) => b.id === 'vr_surv_ready');
    assert.ok(readyBtn);
    readyBtn.onClick?.();
    assert.equal(toggledReady, true);

    let selectedOpt = -1;
    const vt = new VariationTableSession();
    panel.updateState(
      {
        mode: 'detention',
        detention: vt.getVrSnapshot({
          onSelectOption: (idx) => {
            selectedOpt = idx;
          },
          onClose: () => {}
        })
      },
      { immediate: true }
    );
    const optBtn = panel.getHitBoxes().find((b) => b.id === 'vr_dt_opt_2');
    assert.ok(optBtn);
    optBtn.onClick?.();
    assert.equal(selectedOpt, 2);

    panel.updateState({ mode: 'jumpscare', jumpscare: { title: 'Test', subtitle: 'Sub' } }, { immediate: true });
    panel.updateState(
      {
        mode: 'survival_end',
        survivalEnd: { victory: true, reason: 'Ok', completedTps: 5, totalTps: 5, onContinue: () => {} }
      },
      { immediate: true }
    );
    assert.ok(panel.getHitBoxes().some((b) => b.id === 'vr_surv_end_ok'));
    panel.dispose();
  } finally {
    restoreDoc();
  }
});

test('WebSocket wsHub : matchmaking 2 joueurs minimum, alerte micro & victoire survie sans fuite de ressources', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ciel-survival-ws-'));
  const { server, wsHub, store } = createGameServer({
    dbPath: null,
    accountsPath: path.join(tmpDir, 'accounts.json'),
    mapPath: null,
    survivalOptions: { minPlayers: 2, graceMs: 0, postEndResetMs: 5000 }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const wsUrl = `ws://127.0.0.1:${port}/ws`;

  let ws1 = null;
  let ws2 = null;
  try {
    ws1 = await openWs(wsUrl);
    const w1 = waitForMessage(ws1, (m) => m.type === 'welcome');
    ws1.send(JSON.stringify({ type: 'join', name: 'Surv_Alice', room: 'surv-room' }));
    const welcome1 = await w1;
    assert.ok(welcome1.survivalState);

    ws2 = await openWs(wsUrl);
    const w2 = waitForMessage(ws2, (m) => m.type === 'welcome');
    ws2.send(JSON.stringify({ type: 'join', name: 'Surv_Bob', room: 'surv-room' }));
    await w2;

    const joinState1 = waitForMessage(ws1, (m) => m.type === 'survival_state' && m.state.lobbyCount === 1);
    ws1.send(JSON.stringify({ type: 'survival_join' }));
    await joinState1;

    const ready1 = waitForMessage(ws1, (m) => m.type === 'survival_state' && m.state.readyCount === 1);
    ws1.send(JSON.stringify({ type: 'survival_ready', ready: true }));
    const readySnap1 = await ready1;
    assert.equal(readySnap1.state.phase, 'lobby');

    const joinState2 = waitForMessage(ws2, (m) => m.type === 'survival_state' && m.state.lobbyCount === 2);
    ws2.send(JSON.stringify({ type: 'survival_join' }));
    await joinState2;

    const startedP1 = waitForMessage(ws1, (m) => m.type === 'survival_started');
    const startedP2 = waitForMessage(ws2, (m) => m.type === 'survival_started');
    ws2.send(JSON.stringify({ type: 'survival_ready', ready: true }));
    const [s1, s2] = await Promise.all([startedP1, startedP2]);
    assert.equal(s1.state.phase, 'active');
    assert.equal(s2.state.phase, 'active');
    assert.equal(s1.state.participants.length, 2);

    const noiseAlert = waitForMessage(ws1, (m) => m.type === 'survival_noise_alert');
    ws1.send(
      JSON.stringify({
        type: 'move',
        x: s1.state.ai.x + 1,
        y: 0,
        z: s1.state.ai.z + 1,
        yaw: 0
      })
    );
    ws1.send(
      JSON.stringify({
        type: 'survival_mic',
        micEnabled: true,
        level: Math.max(SURVIVAL_MIC_NOISE_THRESHOLD + 0.35, 0.72),
        rms: 0.25
      })
    );
    const alertMsg = await noiseAlert;
    assert.equal(alertMsg.playerName, 'Surv_Alice');

    const endPromise = waitForMessage(ws1, (m) => m.type === 'survival_ended');
    for (const tpId of s1.state.requiredTps) {
      ws1.send(JSON.stringify({ type: 'survival_tp_done', tpId, score: 20 }));
    }
    const endMsg = await endPromise;
    assert.equal(endMsg.ended.outcome, 'victory');
  } finally {
    if (ws1 && ws1.readyState <= 1) ws1.close();
    if (ws2 && ws2.readyState <= 1) ws2.close();
    wsHub?.close?.();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
