import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import * as THREE from 'three';
import { WebSocket } from 'ws';
import { createGameServer } from '../server/index.js';
import { SURVIVAL_ROOM_PREFIX, isSurvivalRoom } from '../server/wsHub.js';
import { sfx } from '../src/core/audio.js';
import { GameState } from '../src/core/gameState.js';
import { HudManager } from '../src/ui/HudManager.js';
import { createDefaultMap, getDynamicMapColliders } from '../src/world/mapSchema.js';
import { buildLabWorld } from '../src/world/LabBuilder.js';
import { createHorrorTeacher } from '../src/world/NpcTeacher.js';
import { PlayerController } from '../src/world/PlayerController.js';
import { RemotePlayersManager } from '../src/world/RemotePlayers.js';
import {
  computeSurvivalIntroShot,
  createSurvivalPocketRooms,
  getDetentionCameraHitBoxes,
  getDetentionDeskExitHitBoxes
} from '../src/world/SurvivalArena3D.js';
import {
  SURVIVAL_CAPTURE_RADIUS,
  SURVIVAL_MIC_NOISE_THRESHOLD,
  SURVIVAL_MIC_SCREAM_THRESHOLD,
  SURVIVAL_MIN_PLAYERS,
  SurvivalMatchController,
  buildNavGrid,
  computeRackExitPosition,
  computeRackInteriorPosition,
  evaluateMicVolumeForAI,
  findPathAStar,
  getSurvivalDoors,
  getSurvivalHidingSpots,
  getSurvivalRequiredTps,
  hasFullMapLineOfSight,
  pointCollidesWithColliders,
  resolveSurvivalIntroPlacement
} from '../src/world/SurvivalEngine.js';
import {
  VariationTableSession,
  checkVariationAnswer,
  drawVariationWorksheetCanvas,
  generateVariationExercise,
  getVariationSheetHitBoxes,
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

test('SurvivalEngine : lancement dès 1 joueur, intro horrifique, écoute micro RMS, cachette Baie de Brassage & capture -> défaite', () => {
  const map = createDefaultMap();
  assert.equal(SURVIVAL_MIN_PLAYERS, 1);

  const soloCtrl = new SurvivalMatchController(map, { roomId: 'test-solo', graceMs: 0, introDurationMs: 4200 });
  soloCtrl.joinLobby({ id: 'solo1', name: 'SoloAlice' });
  const rSolo = soloCtrl.setReady('solo1', true, 1000);
  assert.equal(rSolo.autoStarted, true);
  assert.equal(soloCtrl.phase, 'active');
  const soloSnapDuringIntro = soloCtrl.getPublicSnapshot(1500);
  assert.equal(soloSnapDuringIntro.minPlayers, 1);
  assert.equal(soloSnapDuringIntro.introActive, true);
  const soloSnapAfterIntro = soloCtrl.getPublicSnapshot(5300);
  assert.equal(soloSnapAfterIntro.introActive, false);

  const ctrl = new SurvivalMatchController(map, {
    roomId: 'test-surv',
    minPlayers: 2,
    graceMs: 0,
    captureRadius: 1.35
  });

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
    const detCfg = pocket.getDetentionRoomConfig();
    assert.ok(detCfg.interactables.length >= 1);
    assert.ok(detCfg.pcEye && Number.isFinite(detCfg.pcEye.y));
    assert.ok(pocket.mathSheetMesh);
    assert.ok(pocket.deskCamMesh);
    assert.ok(pocket.boardCamMesh);
    assert.ok(pocket.survMonitor);
    assert.ok(pocket.povRenderTarget);
    assert.ok(pocket.povCamera && pocket.povCamera.isPerspectiveCamera);

    pocket.updateWaitingBoard({ lobbyPlayers: [], minPlayers: 1 }, true);
    pocket.updateSurveillanceScreen(
      { completedTps: ['oscilloscope'], requiredTps: ['oscilloscope'], participants: [], ai: { x: 0, z: 0, state: 'patrol' } },
      true
    );
    pocket.setLivePovActive(true);
    assert.equal(pocket.survMonitor.material.map, pocket.povRenderTarget.texture);
    pocket.setLivePovActive(false);

    const introShot = computeSurvivalIntroShot(0.35, { x: 2, z: -1 }, { x: -7, z: -2 }, 1.25);
    assert.ok(introShot.briefingText.includes('Survivez'));
    assert.ok(introShot.briefingText.includes('micro'));
    assert.ok(introShot.camPos && introShot.camLook);

    const vt = new VariationTableSession();
    const dtSnapDesk = vt.getVrSnapshot({});
    const sheetCanvas = globalThis.document.createElement('canvas');
    sheetCanvas.width = 1024;
    sheetCanvas.height = 768;
    const sheetRender = drawVariationWorksheetCanvas(sheetCanvas.getContext('2d'), 1024, 768, dtSnapDesk, 'sheet_opt_1');
    assert.equal(sheetRender.hitBoxes.length, 4);
    assert.equal(getVariationSheetHitBoxes(1024, 768).length, 4);
    assert.equal(getDetentionCameraHitBoxes(512, 340, 'desk').length, 2);
    assert.equal(getDetentionCameraHitBoxes(1024, 122, 'board').length, 2);

    let deskSelected = -1;
    let camDelta = 0;
    let deskExited = false;
    let deskRestarted = false;
    const surfaces = pocket.getDetentionInteractiveSurfaces({
      onSelectOption: (idx) => {
        deskSelected = idx;
      },
      onPrevCamera: () => {
        camDelta -= 1;
      },
      onNextCamera: () => {
        camDelta += 1;
      },
      onExitDetention: () => {
        deskExited = true;
      },
      onRestartSurvival: () => {
        deskRestarted = true;
      }
    });
    assert.equal(surfaces.length, 4);
    assert.equal(pocket.povRenderTarget.width, 512);
    assert.equal(pocket.povRenderTarget.height, 288);
    assert.ok(pocket.deskExitMesh);

    const exitSurf = surfaces.find((s) => s.id === 'detention_desk_exit_btn');
    assert.ok(exitSurf);
    const exitBoxes = getDetentionDeskExitHitBoxes(384, 256);
    assert.equal(exitBoxes.length, 2);
    const restartBox = exitBoxes.find((b) => b.action === 'restart');
    const exitBox = exitBoxes.find((b) => b.action === 'exit');
    const restartHit = exitSurf.hitTestUv({
      x: (restartBox.x + restartBox.w / 2) / 384,
      y: 1 - (restartBox.y + restartBox.h / 2) / 256
    });
    assert.ok(restartHit);
    restartHit.onClick();
    assert.equal(deskRestarted, true);

    const exitHit = exitSurf.hitTestUv({
      x: (exitBox.x + exitBox.w / 2) / 384,
      y: 1 - (exitBox.y + exitBox.h / 2) / 256
    });
    assert.ok(exitHit);
    exitHit.onClick();
    assert.equal(deskExited, true);
    const mathSurf = surfaces.find((s) => s.id === 'detention_math_sheet');
    const sheetBox2 = getVariationSheetHitBoxes(1024, 768)[2];
    const mathHit = mathSurf.hitTestUv({
      x: (sheetBox2.x + sheetBox2.w / 2) / 1024,
      y: 1 - (sheetBox2.y + sheetBox2.h / 2) / 768
    });
    assert.ok(mathHit);
    mathHit.onClick();
    assert.equal(deskSelected, 2);

    const boardSurf = surfaces.find((s) => s.id === 'detention_board_cam_bar');
    const boardNextBox = getDetentionCameraHitBoxes(1024, 122, 'board').find((b) => b.id === 'cam_next');
    const boardHit = boardSurf.hitTestUv({
      x: (boardNextBox.x + boardNextBox.w / 2) / 1024,
      y: 1 - (boardNextBox.y + boardNextBox.h / 2) / 122
    });
    assert.ok(boardHit);
    boardHit.onClick();
    assert.equal(camDelta, 1);

    pocket.updateDetentionMathSheet(dtSnapDesk, true);
    pocket.updateDetentionCameraBar({ modeLabel: 'COÉQUIPIER LIVE', targetName: 'Bob', aliveCount: 1, totalSurvivors: 2 }, true);
    pocket.updateDetentionClock(25);
    pocket.dispose();

    const remoteMgr = new RemotePlayersManager(scene);
    remoteMgr.upsertPeer({ id: 'p1', name: 'Surv_1', x: 2, y: 0, z: -3, yaw: 0.7 });
    remoteMgr.upsertPeer({ id: 'p2', name: 'Public_2', x: 5, y: 0, z: 4, yaw: -0.4 });
    assert.equal(remoteMgr.peers.size, 2);
    remoteMgr.setInstanceFilter(['p1']);
    assert.equal(remoteMgr.peers.has('p1'), true);
    assert.equal(remoteMgr.peers.has('p2'), false);
    remoteMgr.upsertPeer({ id: 'p2', name: 'Public_2', x: 5, y: 0, z: 4, yaw: -0.4 });
    assert.equal(remoteMgr.peers.has('p2'), false);
    const povPose = remoteMgr.getPeerPoseForPov('p1');
    assert.equal(povPose.name, 'Surv_1');
    remoteMgr.setPeerPovHidden('p1', true);
    assert.equal(remoteMgr.peers.get('p1').group.visible, false);
    remoteMgr.setPeerPovHidden('p1', false);
    assert.equal(remoteMgr.peers.get('p1').group.visible, true);
    remoteMgr.setInstanceFilter(null);
    remoteMgr.clearAll();

    assert.doesNotThrow(() => {
      sfx.playElectricCrackle(0, 0.05, 0.08);
      sfx.playSurvivalIntroAlarm();
    });

    const panel = createTpSpatialPanel();
    let skippedIntro = false;
    panel.updateState(
      {
        mode: 'survival_intro',
        survivalIntro: {
          title: 'TRAQUE DU PROFESSEUR CIEL',
          subtitle: introShot.phaseLabel,
          briefing: introShot.briefingText,
          progress: 0.4,
          onSkip: () => {
            skippedIntro = true;
          }
        }
      },
      { immediate: true }
    );
    const skipIntroBtn = panel.getHitBoxes().find((b) => b.id === 'vr_surv_intro_skip');
    assert.ok(skipIntroBtn);
    skipIntroBtn.onClick?.();
    assert.equal(skippedIntro, true);

    let toggledReady = false;
    panel.updateState(
      {
        mode: 'survival_lobby',
        survivalLobby: {
          players: [{ id: 'a', name: 'Alice', ready: false }],
          minPlayers: 1,
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
    let camPrevClicked = false;
    let camNextClicked = false;
    panel.updateState(
      {
        mode: 'detention',
        detention: vt.getVrSnapshot({
          camLabel: 'COÉQUIPIER — Bob',
          onSelectOption: (idx) => {
            selectedOpt = idx;
          },
          onPrevCamera: () => {
            camPrevClicked = true;
          },
          onNextCamera: () => {
            camNextClicked = true;
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
    panel.getHitBoxes().find((b) => b.id === 'vr_dt_cam_prev')?.onClick?.();
    panel.getHitBoxes().find((b) => b.id === 'vr_dt_cam_next')?.onClick?.();
    assert.equal(camPrevClicked, true);
    assert.equal(camNextClicked, true);

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

test('WebSocket wsHub : matchmaking 2 joueurs, instance isolée, alerte micro & victoire survie sans fuite de ressources', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ciel-survival-ws-'));
  const { server, wsHub } = createGameServer({
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

    const switched1 = waitForMessage(ws1, (m) => m.type === 'room_switched');
    const joinState1 = waitForMessage(ws1, (m) => m.type === 'survival_state' && m.state.lobbyCount === 1);
    ws1.send(JSON.stringify({ type: 'survival_join' }));
    const [sw1] = await Promise.all([switched1, joinState1]);
    assert.equal(isSurvivalRoom(sw1.room), true);
    assert.ok(sw1.room.startsWith(SURVIVAL_ROOM_PREFIX));

    const ready1 = waitForMessage(ws1, (m) => m.type === 'survival_state' && m.state.readyCount === 1);
    ws1.send(JSON.stringify({ type: 'survival_ready', ready: true }));
    const readySnap1 = await ready1;
    assert.equal(readySnap1.state.phase, 'lobby');

    const switched2 = waitForMessage(ws2, (m) => m.type === 'room_switched');
    const joinState2 = waitForMessage(ws2, (m) => m.type === 'survival_state' && m.state.lobbyCount === 2);
    ws2.send(JSON.stringify({ type: 'survival_join' }));
    const [sw2] = await Promise.all([switched2, joinState2]);
    assert.equal(sw2.room, sw1.room);

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

    const ret1 = waitForMessage(ws1, (m) => m.type === 'room_switched' && m.room === 'surv-room');
    ws1.send(JSON.stringify({ type: 'survival_return' }));
    const retMsg1 = await ret1;
    assert.equal(retMsg1.room, 'surv-room');
  } finally {
    if (ws1 && ws1.readyState <= 1) ws1.close();
    if (ws2 && ws2.readyState <= 1) ws2.close();
    wsHub?.close?.();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('WebSocket wsHub v4.20 : lancement à 1 joueur minimum, isolation totale hors plateau-u300 & retour automatique', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ciel-survival-solo-iso-'));
  const { server, wsHub } = createGameServer({
    dbPath: null,
    accountsPath: path.join(tmpDir, 'accounts.json'),
    mapPath: null,
    survivalOptions: { graceMs: 0, introDurationMs: 2800, postEndResetMs: 180 }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const wsUrl = `ws://127.0.0.1:${port}/ws`;

  let wsSolo = null;
  let wsPublic = null;
  try {
    wsPublic = await openWs(wsUrl);
    const wPub = waitForMessage(wsPublic, (m) => m.type === 'welcome');
    wsPublic.send(JSON.stringify({ type: 'join', name: 'PublicWatcher', room: 'plateau-u300' }));
    await wPub;

    wsSolo = await openWs(wsUrl);
    const wSolo = waitForMessage(wsSolo, (m) => m.type === 'welcome');
    const pubSawSolo = waitForMessage(wsPublic, (m) => m.type === 'player_joined' && m.player?.name === 'SoloRunner');
    wsSolo.send(JSON.stringify({ type: 'join', name: 'SoloRunner', room: 'plateau-u300' }));
    const [welcomeSolo, joinedMsg] = await Promise.all([wSolo, pubSawSolo]);
    assert.equal(welcomeSolo.survivalState.minPlayers, 1);
    const soloId = joinedMsg.player.id;

    const leakedToPublic = [];
    wsPublic.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (
          msg.type === 'survival_started' ||
          msg.type === 'survival_state' ||
          msg.type === 'survival_ended' ||
          msg.type === 'survival_noise_alert' ||
          (msg.type === 'player_moved' && msg.id === soloId)
        ) {
          leakedToPublic.push(msg.type);
        }
      } catch {
        return;
      }
    });

    const pubLeftPromise = waitForMessage(wsPublic, (m) => m.type === 'player_left' && m.id === soloId);
    const soloSwitchPromise = waitForMessage(wsSolo, (m) => m.type === 'room_switched');
    wsSolo.send(JSON.stringify({ type: 'survival_join' }));
    const [, soloSwitched] = await Promise.all([pubLeftPromise, soloSwitchPromise]);
    assert.equal(isSurvivalRoom(soloSwitched.room), true);
    assert.equal(soloSwitched.originRoom, 'plateau-u300');
    assert.equal(soloSwitched.peers.length, 0);

    const summaryRooms = wsHub.getRoomsSummary();
    assert.equal(summaryRooms.some((r) => isSurvivalRoom(r.room)), false);

    const soloStartedPromise = waitForMessage(wsSolo, (m) => m.type === 'survival_started');
    wsSolo.send(JSON.stringify({ type: 'survival_ready', ready: true }));
    const soloStarted = await soloStartedPromise;
    assert.equal(soloStarted.state.phase, 'active');
    assert.equal(soloStarted.state.minPlayers, 1);
    assert.equal(soloStarted.state.introDurationMs, 2800);
    assert.equal(soloStarted.state.participants.length, 1);

    wsSolo.send(JSON.stringify({ type: 'move', x: 3.5, y: 0, z: -2.5, yaw: 1.1 }));

    const soloEndedPromise = waitForMessage(wsSolo, (m) => m.type === 'survival_ended');
    const autoReturnPromise = waitForMessage(wsSolo, (m) => m.type === 'room_switched' && m.room === 'plateau-u300');
    const pubRejoinPromise = waitForMessage(wsPublic, (m) => m.type === 'player_joined' && m.player?.id === soloId);

    for (const tpId of soloStarted.state.requiredTps) {
      wsSolo.send(JSON.stringify({ type: 'survival_tp_done', tpId, score: 20 }));
    }
    const soloEnded = await soloEndedPromise;
    assert.equal(soloEnded.ended.outcome, 'victory');
    assert.deepEqual(leakedToPublic, []);

    const [retSwitched, rejoinedPub] = await Promise.all([autoReturnPromise, pubRejoinPromise]);
    assert.equal(retSwitched.room, 'plateau-u300');
    assert.equal(retSwitched.peers.length, 1);
    assert.equal(retSwitched.peers[0].name, 'PublicWatcher');
    assert.equal(rejoinedPub.player.name, 'SoloRunner');
  } finally {
    if (wsSolo && wsSolo.readyState <= 1) wsSolo.close();
    if (wsPublic && wsPublic.readyState <= 1) wsPublic.close();
    wsHub?.close?.();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

function createHudDomMock() {
  const prevWin = globalThis.window;
  const prevDoc = globalThis.document;
  const prevLoc = globalThis.localStorage;
  const prevNav = globalThis.navigator;
  const winListeners = new Map();
  const docListeners = new Map();
  const makeClassList = (initial = []) => {
    const set = new Set(initial);
    return {
      add: (...cls) => cls.forEach((c) => set.add(c)),
      remove: (...cls) => cls.forEach((c) => set.delete(c)),
      toggle: (c, force) => {
        if (force === undefined) {
          if (set.has(c)) {
            set.delete(c);
            return false;
          }
          set.add(c);
          return true;
        }
        if (force) set.add(c);
        else set.delete(c);
        return Boolean(force);
      },
      contains: (c) => set.has(c)
    };
  };

  const elements = new Map();
  const makeEl = (id = '', initialClasses = []) => {
    const children = [];
    const el = {
      id,
      tagName: 'DIV',
      value: '',
      textContent: '',
      innerHTML: '',
      title: '',
      disabled: false,
      checked: false,
      width: 256,
      height: 256,
      style: {},
      dataset: {},
      classList: makeClassList(initialClasses),
      children,
      appendChild(child) {
        children.push(child);
        return child;
      },
      remove() {
        const idx = children.indexOf(this);
        if (idx >= 0) children.splice(idx, 1);
      },
      addEventListener() {},
      removeEventListener() {},
      focus() {},
      blur() {},
      querySelectorAll() {
        return [];
      },
      querySelector() {
        return null;
      },
      closest() {
        return null;
      },
      getContext() {
        const noop = () => {};
        const grad = () => ({ addColorStop: noop });
        return {
          fillStyle: '#000',
          strokeStyle: '#000',
          lineWidth: 1,
          font: '12px sans-serif',
          textAlign: 'left',
          textBaseline: 'alphabetic',
          lineCap: 'butt',
          globalAlpha: 1,
          clearRect: noop,
          fillRect: noop,
          strokeRect: noop,
          fillText: noop,
          strokeText: noop,
          beginPath: noop,
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
          save: noop,
          restore: noop,
          clip: noop,
          closePath: noop,
          createPattern: () => ({}),
          createLinearGradient: grad,
          createRadialGradient: grad,
          measureText: (txt) => ({ width: String(txt || '').length * 8 }),
          getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray((w || 4) * (h || 4) * 4) }),
          putImageData: noop
        };
      },
      getBoundingClientRect() {
        return { left: 0, top: 0, width: 1280, height: 720 };
      }
    };
    if (id) elements.set(id, el);
    return el;
  };

  const hiddenIds = [
    'hud',
    'net-error-banner',
    'room-roster-popover',
    'audio-settings-popover',
    'btn-creator-power',
    'creator-power-popover',
    'world-celebration-banner',
    'secret-skin-banner',
    'intro-cinematic-overlay',
    'ascension-cinematic-dialogue',
    'hud-private-debug-badge',
    'debug-tools-panel',
    'leaderboard-modal',
    'settings-modal',
    'skin-modal',
    'voice-nearby-bar',
    'interact-prompt',
    'orientation-hint',
    'chat-drawer',
    'survival-horror-vignette',
    'survival-hud-bar',
    'survival-detention-open-btn',
    'survival-lobby-modal',
    'survival-hide-overlay',
    'survival-jumpscare-overlay',
    'survival-detention-modal',
    'survival-end-overlay',
    'survival-intro-overlay',
    'survival-detention-3d-hud'
  ];
  for (const id of hiddenIds) makeEl(id, ['hidden']);
  const bodyEl = makeEl('body', []);

  globalThis.localStorage = {
    store: new Map(),
    getItem(k) {
      return this.store.get(k) ?? null;
    },
    setItem(k, v) {
      this.store.set(k, String(v));
    }
  };
  globalThis.window = {
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push(fn);
    },
    removeEventListener() {}
  };
  globalThis.document = {
    body: bodyEl,
    pointerLockElement: null,
    activeElement: null,
    exitPointerLock() {
      this.pointerLockElement = null;
    },
    getElementById(id) {
      return elements.get(id) || makeEl(id, []);
    },
    createElement(tag) {
      return makeEl('', [tag]);
    },
    querySelectorAll() {
      return [];
    },
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    }
  };
  if (!globalThis.navigator) {
    globalThis.navigator = { maxTouchPoints: 0 };
  }

  return {
    elements,
    bodyEl,
    winListeners,
    docListeners,
    restore() {
      if (prevWin === undefined) delete globalThis.window;
      else globalThis.window = prevWin;
      if (prevDoc === undefined) delete globalThis.document;
      else globalThis.document = prevDoc;
      if (prevLoc === undefined) delete globalThis.localStorage;
      else globalThis.localStorage = prevLoc;
      if (prevNav === undefined) delete globalThis.navigator;
      else globalThis.navigator = prevNav;
    }
  };
}

test('v4.21 : Cinématique intro Survie Horreur sans aucune traversée de murs (U300 & carte avec cloison)', () => {
  const map = createDefaultMap();
  const placement = resolveSurvivalIntroPlacement(map);
  assert.ok(placement.spawnPos && placement.aiPos);
  assert.equal(
    hasFullMapLineOfSight(
      placement.spawnPos.x,
      placement.spawnPos.z,
      placement.aiPos.x,
      placement.aiPos.z,
      placement.colliders,
      placement.bounds,
      0.36
    ),
    true
  );

  for (let i = 0; i <= 50; i++) {
    const p = i / 50;
    const shot = computeSurvivalIntroShot(p, placement.aiPos, placement.spawnPos, p * 5.6, {
      colliders: placement.colliders,
      bounds: placement.bounds
    });
    assert.equal(
      pointCollidesWithColliders(shot.camPos.x, shot.camPos.z, placement.colliders, placement.bounds, 0.32),
      false,
      `Collision murale détectée à p=${p.toFixed(2)}`
    );
    assert.equal(
      hasFullMapLineOfSight(
        shot.camPos.x,
        shot.camPos.z,
        shot.camLook.x,
        shot.camLook.z,
        placement.colliders,
        placement.bounds,
        0.2,
        0.16
      ),
      true,
      `Ligne de vue obstruée à p=${p.toFixed(2)}`
    );
  }

  const wallBlockMap = {
    ...map,
    walls: [
      ...map.walls,
      { id: 'w-test-block', kind: 'solid', x1: -2, z1: -0.5, x2: 2, z2: -0.5, thickness: 0.24, height: 4.2 }
    ]
  };
  const customColliders = getDynamicMapColliders(wallBlockMap);
  const blockedShot = computeSurvivalIntroShot(
    0.55,
    { x: 0, z: -2.5 },
    { x: 0, z: 2.5 },
    2.5,
    { colliders: customColliders, bounds: wallBlockMap.bounds }
  );
  assert.equal(
    pointCollidesWithColliders(blockedShot.camPos.x, blockedShot.camPos.z, customColliders, wallBlockMap.bounds, 0.32),
    false
  );
  assert.equal(
    hasFullMapLineOfSight(
      blockedShot.camPos.x,
      blockedShot.camPos.z,
      blockedShot.camLook.x,
      blockedShot.camLook.z,
      customColliders,
      wallBlockMap.bounds,
      0.2,
      0.16
    ),
    true
  );
});

test('v4.21 : Salle de Colle PC — Caméra libre assise (souris, PointerLock, flèches), ZQSD bloqué, raycast feuille & Zéro ATH', () => {
  const restoreCanvasDoc = installFakeCanvasDocument();
  const mockDom = createHudDomMock();
  const canvasListeners = new Map();
  const fakeCanvas = {
    width: 1280,
    height: 720,
    style: {},
    addEventListener(type, fn) {
      if (!canvasListeners.has(type)) canvasListeners.set(type, []);
      canvasListeners.get(type).push(fn);
    },
    requestPointerLock() {
      globalThis.document.pointerLockElement = fakeCanvas;
    }
  };

  let pocket = null;
  try {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(72, 16 / 9, 0.1, 140);
    const map = createDefaultMap();
    pocket = createSurvivalPocketRooms(scene, map);
    const detCfg = pocket.getDetentionRoomConfig();

    const player = new PlayerController(camera, fakeCanvas, detCfg.colliders);
    player.setBounds(detCfg.bounds);
    player.setEnabled(true);
    player.setSeated(true, {
      x: detCfg.pcEye.x,
      y: detCfg.pcEye.y,
      z: detCfg.pcEye.z,
      lookAt: detCfg.lookAt
    });

    const startX = player.position.x;
    const startY = player.position.y;
    const startZ = player.position.z;
    assert.equal(startY, detCfg.pcEye.y);

    const onKeyDown = mockDom.winListeners.get('keydown') || [];
    const onKeyUp = mockDom.winListeners.get('keyup') || [];
    for (const code of ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space']) {
      onKeyDown.forEach((fn) => fn({ code, preventDefault() {} }));
    }
    player.update(0.15);
    assert.equal(player.position.x, startX);
    assert.equal(player.position.y, startY);
    assert.equal(player.position.z, startZ);
    for (const code of ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space']) {
      onKeyUp.forEach((fn) => fn({ code }));
    }

    const yaw0 = player.yaw;
    const pitch0 = player.pitch;
    onKeyDown.forEach((fn) => fn({ code: 'ArrowLeft', preventDefault() {} }));
    onKeyDown.forEach((fn) => fn({ code: 'ArrowUp', preventDefault() {} }));
    player.update(0.2);
    assert.ok(player.yaw > yaw0);
    assert.ok(player.pitch > pitch0);
    onKeyUp.forEach((fn) => fn({ code: 'ArrowLeft' }));
    onKeyUp.forEach((fn) => fn({ code: 'ArrowUp' }));

    const onCanvasDown = canvasListeners.get('mousedown') || [];
    const onWinMove = mockDom.winListeners.get('mousemove') || [];
    const onWinUp = mockDom.winListeners.get('mouseup') || [];
    onCanvasDown.forEach((fn) => fn({ button: 0, clientX: 500, clientY: 360 }));
    onWinMove.forEach((fn) => fn({ clientX: 680, clientY: 500, movementX: 0, movementY: 0 }));
    onWinUp.forEach((fn) => fn({ button: 0 }));
    assert.notEqual(player.yaw, yaw0);

    fakeCanvas.requestPointerLock();
    const yawLocked = player.yaw;
    onWinMove.forEach((fn) => fn({ movementX: -260, movementY: 180, clientX: 680, clientY: 500 }));
    assert.ok(player.yaw > yawLocked);

    pocket.mathSheetMesh.updateWorldMatrix(true, false);
    const sheetWorld = new THREE.Vector3();
    pocket.mathSheetMesh.getWorldPosition(sheetWorld);
    camera.position.set(detCfg.pcEye.x, detCfg.pcEye.y, detCfg.pcEye.z);
    camera.lookAt(sheetWorld);
    camera.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    const sheetHits = ray.intersectObject(pocket.mathSheetMesh, false);
    assert.ok(sheetHits.length > 0 && sheetHits[0].uv);

    player.setSeated(false);
    assert.equal(player.seated, false);
    assert.equal(player.position.y, player.groundY);

    const gs = new GameState();
    const dummyNet = {
      wsUrl: '/ws',
      lastPingMs: 8,
      fetchLeaderboard: async () => [],
      reconnectNow() {},
      sendEmote() {},
      sendChat() {}
    };
    const hud = new HudManager(gs, dummyNet, {});
    hud.show();
    assert.equal(mockDom.elements.get('hud').classList.contains('hidden'), false);

    hud.setDetentionHudHidden(true);
    assert.equal(mockDom.bodyEl.classList.contains('survival-detention-active'), true);
    assert.equal(mockDom.elements.get('hud').classList.contains('hidden'), true);
    assert.equal(mockDom.elements.get('survival-hud-bar').classList.contains('hidden'), true);
    assert.equal(mockDom.elements.get('survival-detention-modal').classList.contains('hidden'), true);
    assert.equal(mockDom.elements.get('survival-detention-3d-hud').classList.contains('hidden'), true);

    hud.showDetention3dHud({ label: 'Bob' });
    hud.updateSurvivalHud({ detained: true, detentionMinimized: true });
    hud.showDetentionModal({});
    hud.toast('Ne doit pas apparaître');
    assert.equal(mockDom.elements.get('survival-detention-3d-hud').classList.contains('hidden'), true);
    assert.equal(mockDom.elements.get('survival-hud-bar').classList.contains('hidden'), true);
    assert.equal(mockDom.elements.get('survival-detention-modal').classList.contains('hidden'), true);
    assert.equal(mockDom.elements.get('toast-container').children.length, 0);

    hud.setDetentionHudHidden(false);
    assert.equal(mockDom.bodyEl.classList.contains('survival-detention-active'), false);
    assert.equal(mockDom.elements.get('hud').classList.contains('hidden'), false);
  } finally {
    pocket?.dispose?.();
    mockDom.restore();
    restoreCanvasDoc();
  }
});

test('v4.23 : Sortie dégagée des Baies de Brassage (1.15m devant la porte, sans collision, sans écran noir ni NaN)', () => {
  const restoreCanvasDoc = installFakeCanvasDocument();
  const mockDom = createHudDomMock();
  const fakeCanvas = {
    width: 1280,
    height: 720,
    style: {},
    addEventListener() {},
    requestPointerLock() {}
  };

  let lab = null;
  try {
    const map = createDefaultMap();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(72, 16 / 9, 0.1, 140);
    lab = buildLabWorld(scene, map, { hideSprites: true });

    assert.ok(lab.hidingSpots.length >= 4);
    const engineSpots = getSurvivalHidingSpots(map);
    assert.equal(engineSpots.length, lab.hidingSpots.length);

    const player = new PlayerController(camera, fakeCanvas, lab.colliders);
    player.setBounds(map.bounds);
    player.setEnabled(true);

    for (const spot of lab.hidingSpots) {
      assert.ok(Number.isFinite(spot.x));
      assert.ok(Number.isFinite(spot.z));
      assert.ok(Number.isFinite(spot.exitX));
      assert.ok(Number.isFinite(spot.exitZ));
      assert.ok(Number.isFinite(spot.rotRad));

      const distExit = Math.hypot(spot.exitX - spot.x, spot.exitZ - spot.z);
      assert.ok(distExit >= 1.1, `Sortie trop proche pour ${spot.id}: ${distExit}`);
      assert.equal(
        pointCollidesWithColliders(spot.exitX, spot.exitZ, lab.colliders, map.bounds, 0.42),
        false,
        `Collision à la sortie de la baie ${spot.id}`
      );

      player.setMovementLocked(true);
      player.teleportTo({ x: spot.x, z: spot.z }, { x: spot.exitX, z: spot.exitZ });
      assert.ok(Number.isFinite(player.position.x) && Number.isFinite(player.position.z));
      assert.ok(Number.isFinite(camera.position.x) && Number.isFinite(camera.position.z));

      const exitComputed = computeRackExitPosition(spot, lab.colliders, map.bounds, player.radius);
      const safeExit = player.resolveUnstuckPosition(exitComputed.x, exitComputed.z, spot.rotRad);
      player.setMovementLocked(false);
      player.setEnabled(true);
      player.teleportTo(safeExit, {
        x: safeExit.x + Math.sin(spot.rotRad) * 2.0,
        z: safeExit.z + Math.cos(spot.rotRad) * 2.0
      });

      assert.equal(player.movementLocked, false);
      assert.equal(player.enabled, true);
      assert.equal(player._collides(player.position.x, player.position.z), false);
      assert.ok(Number.isFinite(player.yaw));
    }

    const gs = new GameState();
    const dummyNet = {
      wsUrl: '/ws',
      lastPingMs: 8,
      fetchLeaderboard: async () => [],
      reconnectNow() {},
      sendEmote() {},
      sendChat() {}
    };
    const hud = new HudManager(gs, dummyNet, {});
    hud.showHidingOverlay({ noiseLevel: 0.1, micEnabled: true, aiState: 'patrol' });
    const hideOverlay = mockDom.elements.get('survival-hide-overlay');
    assert.equal(hideOverlay.classList.contains('hidden'), false);
    assert.equal(hideOverlay.style.display, 'flex');
    assert.equal(hideOverlay.style.opacity, '1');

    hud.hideHidingOverlay();
    assert.equal(hideOverlay.classList.contains('hidden'), true);
    assert.equal(hideOverlay.style.opacity, '0');
    assert.equal(hideOverlay.style.display, 'none');
  } finally {
    lab?.dispose?.();
    mockDom.restore();
    restoreCanvasDoc();
  }
});

test('v4.23 : Heure de Colle 3D en Solo (1 joueur) — capture sans écran de défaite bloquant, patrouille live du Professeur CIEL & relance/sortie via wsHub', async () => {
  const map = createDefaultMap();
  const soloCtrl = new SurvivalMatchController(map, {
    roomId: 'test-solo-detention',
    minPlayers: 1,
    graceMs: 0,
    captureRadius: 1.35
  });
  soloCtrl.joinLobby({ id: 'solo1', name: 'SoloStudent' });
  const rStart = soloCtrl.setReady('solo1', true, 1000);
  assert.equal(rStart.autoStarted, true);
  assert.equal(soloCtrl.phase, 'active');

  soloCtrl.updatePlayerPose('solo1', 0, 0, 0);
  soloCtrl.ai.x = 0;
  soloCtrl.ai.z = SURVIVAL_CAPTURE_RADIUS * 0.35;
  const catchStep = soloCtrl.step(0.1, 2000);
  assert.equal(catchStep.caught.length, 1);
  assert.equal(catchStep.caught[0].playerId, 'solo1');
  assert.equal(catchStep.ended, null);
  assert.equal(soloCtrl.phase, 'active');
  assert.equal(soloCtrl.isSoloDetentionActive(), true);

  const aiPosBefore = { x: soloCtrl.ai.x, z: soloCtrl.ai.z };
  for (let i = 1; i <= 15; i++) {
    const patrolStep = soloCtrl.step(0.15, 2000 + i * 150);
    assert.equal(patrolStep.ended, null);
  }
  assert.equal(soloCtrl.ai.state, 'patrol');
  assert.ok(
    Math.hypot(soloCtrl.ai.x - aiPosBefore.x, soloCtrl.ai.z - aiPosBefore.z) > 0.4,
    'Le Professeur CIEL doit continuer sa patrouille dans l’atelier pendant l’heure de colle solo'
  );

  const solvedPulse = soloCtrl.recordDetentionSolved('solo1', 5000);
  assert.ok(solvedPulse);
  assert.equal(solvedPulse.detentionSolvedCount, 1);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ciel-survival-solo-colle-'));
  const { server, wsHub } = createGameServer({
    dbPath: null,
    accountsPath: path.join(tmpDir, 'accounts.json'),
    mapPath: null,
    survivalOptions: { minPlayers: 1, graceMs: 0, introDurationMs: 2500, postEndResetMs: 5000 }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const wsUrl = `ws://127.0.0.1:${port}/ws`;

  let wsSolo = null;
  try {
    wsSolo = await openWs(wsUrl);
    const wSolo = waitForMessage(wsSolo, (m) => m.type === 'welcome');
    wsSolo.send(JSON.stringify({ type: 'join', name: 'SoloCollePlayer', room: 'plateau-u300' }));
    await wSolo;

    const switchedPromise = waitForMessage(wsSolo, (m) => m.type === 'room_switched');
    wsSolo.send(JSON.stringify({ type: 'survival_join' }));
    await switchedPromise;

    const startedPromise = waitForMessage(wsSolo, (m) => m.type === 'survival_started');
    wsSolo.send(JSON.stringify({ type: 'survival_ready', ready: true }));
    const startedMsg = await startedPromise;
    assert.equal(startedMsg.state.phase, 'active');

    let unexpectedEnd = false;
    const onMsgCheckEnd = (raw) => {
      try {
        const d = JSON.parse(raw.toString());
        if (d.type === 'survival_ended') unexpectedEnd = true;
      } catch {}
    };
    wsSolo.on('message', onMsgCheckEnd);

    const caughtPromise = waitForMessage(wsSolo, (m) => m.type === 'survival_caught');
    wsSolo.send(
      JSON.stringify({
        type: 'move',
        x: startedMsg.state.ai.x,
        y: 0,
        z: startedMsg.state.ai.z,
        yaw: 0
      })
    );
    const caughtMsg = await caughtPromise;
    assert.equal(caughtMsg.detainedCount, 1);
    assert.equal(caughtMsg.aliveCount, 0);
    assert.equal(caughtMsg.state.soloDetained, true);
    assert.equal(caughtMsg.state.phase, 'active');

    const tickDuringDetention = await waitForMessage(
      wsSolo,
      (m) => m.type === 'survival_tick' && m.state?.soloDetained === true
    );
    assert.equal(tickDuringDetention.state.phase, 'active');
    assert.equal(unexpectedEnd, false);
    wsSolo.off('message', onMsgCheckEnd);

    const restartedPromise = waitForMessage(wsSolo, (m) => m.type === 'survival_started');
    wsSolo.send(JSON.stringify({ type: 'survival_restart' }));
    const restartedMsg = await restartedPromise;
    assert.equal(restartedMsg.state.phase, 'active');
    assert.equal(restartedMsg.state.aliveCount, 1);
    assert.equal(restartedMsg.state.detainedCount, 0);

    const returnedPromise = waitForMessage(wsSolo, (m) => m.type === 'room_switched' && m.room === 'plateau-u300');
    wsSolo.send(JSON.stringify({ type: 'survival_leave' }));
    const returnedMsg = await returnedPromise;
    assert.equal(returnedMsg.room, 'plateau-u300');
  } finally {
    if (wsSolo && wsSolo.readyState <= 1) wsSolo.close();
    wsHub?.close?.();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('v4.28 : Baies de Brassage Perforées 3D — intérieur, LEDs, visibilité sans voile noir, rotation ±45°/±20° & sortie 1.15m', () => {
  const defaultMap = createDefaultMap();
  const scene = new THREE.Scene();
  const lab = buildLabWorld(scene, defaultMap, { hideSprites: true });

  const prevWin = globalThis.window;
  const prevDoc = globalThis.document;
  const noop = () => {};
  const fakeCanvas = { addEventListener: noop, requestPointerLock: noop };
  globalThis.window = { addEventListener: noop, removeEventListener: noop };
  globalThis.document = {
    pointerLockElement: null,
    exitPointerLock: noop,
    addEventListener: noop,
    getElementById: () => null
  };

  try {
    assert.ok(lab.hidingSpots.length >= 1);
    const spot = lab.hidingSpots[0];
    assert.equal(spot.hasInterior, true);
    assert.ok(spot.interiorLeds && spot.interiorLeds.length === 8);
    assert.ok(spot.perforatedDoor);
    assert.equal(spot.perforatedDoor.userData.isPerforatedDoor, true);
    assert.equal(spot.perforatedDoor.castShadow, false);
    assert.equal(spot.perforatedDoor.material.transparent, true);
    assert.ok(spot.perforatedDoor.material.alphaTest >= 0.4);
    assert.equal(spot.perforatedDoor.material.side, THREE.DoubleSide);

    const interior = computeRackInteriorPosition({
      x: spot.x,
      z: spot.z,
      rotRad: spot.rotRad,
      w: spot.w,
      d: spot.d
    });
    assert.equal(interior.y, 1.52);
    assert.ok(Math.abs(interior.maxYawDelta - Math.PI / 4) < 0.01);
    assert.ok(Math.abs(interior.maxPitchDelta - (20 * Math.PI) / 180) < 0.01);

    const exit = computeRackExitPosition(
      { x: spot.x, z: spot.z, rotRad: spot.rotRad, w: spot.w, d: spot.d },
      lab.colliders,
      defaultMap.bounds,
      0.42
    );
    assert.equal(pointCollidesWithColliders(exit.x, exit.z, lab.colliders, defaultMap.bounds, 0.42), false);

    const cam = new THREE.PerspectiveCamera(72, 1.6, 0.1, 150);
    const player = new PlayerController(cam, fakeCanvas, lab.colliders);
    player.setBounds(defaultMap.bounds);
    player.setEnabled(true);

    player.setHidingInRack(true, interior);
    assert.equal(player.hidingInRack, true);
    assert.equal(player.movementLocked, true);
    assert.ok(Math.hypot(player.position.x - interior.x, player.position.z - interior.z) < 0.01);
    assert.equal(player.position.y, interior.y);

    player.keys.add('ArrowLeft');
    player.keys.add('ArrowUp');
    for (let i = 0; i < 20; i++) {
      player.update(0.1);
    }
    player.keys.delete('ArrowLeft');
    player.keys.delete('ArrowUp');
    assert.ok(Math.abs(player.yaw - interior.baseYaw) > 0.05);
    assert.ok(Math.abs(player.yaw - interior.baseYaw) <= interior.maxYawDelta + 0.001);
    assert.ok(Math.abs(player.pitch) > 0.02);
    assert.ok(Math.abs(player.pitch) <= interior.maxPitchDelta + 0.001);

    player.keys.add('KeyW');
    player.update(0.1);
    player.keys.delete('KeyW');
    assert.ok(Math.hypot(player.position.x - interior.x, player.position.z - interior.z) < 0.001);

    player.setHidingInRack(false);
    player.teleportTo(
      { x: exit.x, z: exit.z },
      { x: exit.x - Math.sin(exit.yaw || 0) * 4, z: exit.z - Math.cos(exit.yaw || 0) * 4 }
    );
    assert.equal(player.hidingInRack, false);
    assert.equal(player.movementLocked, false);
    assert.ok(Number.isFinite(player.position.x) && Number.isFinite(player.position.y) && Number.isFinite(player.position.z));
    assert.ok(Math.hypot(player.position.x - exit.x, player.position.z - exit.z) < 0.02);

    const css = fs.readFileSync(path.resolve('src/styles/main.css'), 'utf8');
    const hideBlockMatch = css.match(/\.survival-hide-overlay\s*\{[^}]+\}/);
    assert.ok(hideBlockMatch);
    assert.ok(hideBlockMatch[0].includes('radial-gradient'));
    assert.ok(hideBlockMatch[0].includes('pointer-events: none'));

    assert.equal(typeof sfx.startRackServerHum, 'function');
    assert.equal(typeof sfx.stopRackServerHum, 'function');
  } finally {
    lab.dispose();
    if (prevWin === undefined) delete globalThis.window;
    else globalThis.window = prevWin;
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
  }
});
