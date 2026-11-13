import * as THREE from 'three';
import { sfx } from '../core/audio.js';
import {
  createWorkbench3D,
  makeCanvasScreen,
  createEsdMatTexture
} from './Workbench3DHost.js';

export function computeStudioRegieScore3D(metrics = {}) {
  const wbOk = metrics.wbOk === undefined ? true : Boolean(metrics.wbOk);
  const camPts =
    (metrics.focusOk ? 2 : 0.5) +
    (metrics.irisOk ? 2 : 0.5) +
    (wbOk ? 1.5 : 0.3) +
    (metrics.chromaOk ? 2.5 : 0.5);

  const audioInZone = Boolean(metrics.audioLevelOk) && !metrics.audioClipping;
  let audioPts = 0;
  if (metrics.phantom48v) audioPts += 1;
  if (metrics.hpf80) audioPts += 1;
  if (audioInZone) audioPts += 4;
  else if (!metrics.audioClipping) audioPts += 1.5;

  const cues = Math.max(0, Math.min(3, metrics.cuesCompleted ?? 0));
  const atemPts = (cues / 3) * 5;

  const elapsed = metrics.elapsedSec ?? 95;
  const bonus = elapsed < 90 ? 1 : elapsed < 150 ? 0.5 : 0;

  const raw = camPts + audioPts + atemPts + bonus;
  return Math.max(0, Math.min(20, Math.round(raw * 2) / 2));
}

const CUE_LIST = [
  { id: 0, target: 'CAM-1', label: 'Top 1 : Ouverture sur Caméra 1 (Présentateur)' },
  { id: 1, target: 'CAM-2', label: 'Top 2 : Bascule Caméra 2 (Plan large plateau)' },
  { id: 2, target: 'CAM-1', label: 'Top 3 : Retour Caméra 1 (Conclusion Direct)' }
];

const CAM_VIEWS = [
  { id: 'overview', label: 'Vue Régie Globale', pos: [0.02, 0.96, 1.58], lookAt: [0.02, 0.34, -0.05], fov: 41 },
  { id: 'camera', label: 'Objectif Caméra & Fond Vert', pos: [-0.56, 0.56, 0.72], lookAt: [-0.56, 0.3, -0.06], fov: 36 },
  { id: 'audio', label: 'Console Audio & VU-Mètres', pos: [0.04, 0.5, 0.7], lookAt: [0.04, 0.1, 0.22], fov: 35 },
  { id: 'atem', label: 'Multiview & Mélangeur ATEM', pos: [0.42, 0.62, 0.92], lookAt: [0.24, 0.3, -0.08], fov: 38 }
];

export function createStudioRegieGame(api) {
  const bench = createWorkbench3D(api.container, {
    cameraPos: CAM_VIEWS[0].pos,
    lookAt: CAM_VIEWS[0].lookAt,
    fov: CAM_VIEWS[0].fov,
    hasEsdMat: false
  });

  const esdTex = createEsdMatTexture();
  const deskMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.94, 0.014, 1.04),
    new THREE.MeshStandardMaterial({ map: esdTex, roughness: 0.7, metalness: 0.08 })
  );
  deskMesh.position.set(0, 0.007, 0.05);
  deskMesh.receiveShadow = true;
  bench.scene.add(deskMesh);

  const state = {
    camId: 'overview',
    focus: 32,
    iris: 26,
    kelvin: 3600,
    chromaKey: 38,
    phantom48v: false,
    hpf80: false,
    micCravate: 44,
    micAmbiance: 24,
    music: 36,
    masterAudio: 72,
    previewSrc: 'CAM-1',
    pgmSrc: 'CAM-2',
    cueIdx: 0,
    cuesDone: new Set(),
    vuPhase: 0,
    startMs: performance.now(),
    submitted: false
  };

  function computeAudioDb() {
    if (!state.phantom48v) return -48;
    const mix = state.micCravate * 0.54 + state.micAmbiance * 0.24 + state.music * 0.16;
    const masterScale = state.masterAudio / 100;
    const db = -44 + mix * masterScale * 0.62;
    return Math.max(-52, Math.min(2, db));
  }

  function evaluateRegie() {
    const focusOk = Math.abs(state.focus - 72) <= 8;
    const irisOk = Math.abs(state.iris - 56) <= 9;
    const wbOk = Math.abs(state.kelvin - 5600) <= 250;
    const chromaOk = state.chromaKey >= 74 && state.chromaKey <= 94;

    const peakDb = computeAudioDb();
    const audioLevelOk = state.phantom48v && peakDb >= -14.5 && peakDb <= -9.5;
    const audioClipping = peakDb > -3;
    const cuesCompleted = state.cuesDone.size;

    return {
      focusOk,
      irisOk,
      wbOk,
      chromaOk,
      peakDb,
      audioLevelOk,
      audioClipping,
      cuesCompleted
    };
  }

  const greenBackdrop = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.36, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.85 })
  );
  greenBackdrop.position.set(-0.56, 0.2, -0.44);
  bench.scene.add(greenBackdrop);

  const miniPresenter = new THREE.Group();
  miniPresenter.position.set(-0.56, 0.014, -0.34);
  bench.scene.add(miniPresenter);
  const pBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.044, 0.14, 12),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 })
  );
  pBody.position.y = 0.08;
  miniPresenter.add(pBody);
  const pHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.55 })
  );
  pHead.position.y = 0.18;
  miniPresenter.add(pHead);

  const wallGroup = new THREE.Group();
  wallGroup.position.set(0.14, 0.014, -0.35);
  bench.scene.add(wallGroup);

  const wallFrame = new THREE.Mesh(
    new THREE.BoxGeometry(1.26, 0.48, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45, metalness: 0.6 })
  );
  wallFrame.position.y = 0.26;
  wallFrame.castShadow = true;
  wallGroup.add(wallFrame);

  const monitorDefs = [
    { id: 'CAM-1', x: -0.42, y: 0.36, w: 0.34, h: 0.19 },
    { id: 'CAM-2', x: -0.42, y: 0.14, w: 0.34, h: 0.19 },
    { id: 'KEY', x: -0.04, y: 0.14, w: 0.34, h: 0.19 },
    { id: 'PGM', x: 0.28, y: 0.27, w: 0.56, h: 0.34 }
  ];

  const monitors = {};
  for (const m of monitorDefs) {
    const scr = makeCanvasScreen(m.id === 'PGM' ? 420 : 280, m.id === 'PGM' ? 256 : 168);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(m.w, m.h),
      new THREE.MeshBasicMaterial({ map: scr.texture })
    );
    mesh.position.set(m.x, m.y, 0.028);
    wallGroup.add(mesh);
    monitors[m.id] = scr;
  }

  const camRig = new THREE.Group();
  camRig.position.set(-0.56, 0.014, 0.08);
  bench.scene.add(camRig);

  const tripodMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.72 });
  for (const angle of [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.28, 10), tripodMat);
    leg.position.set(Math.sin(angle) * 0.075, 0.13, Math.cos(angle) * 0.075);
    leg.rotation.z = Math.sin(angle) * 0.35;
    leg.rotation.x = -Math.cos(angle) * 0.35;
    camRig.add(leg);
  }

  const camBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.12, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.38, metalness: 0.65 })
  );
  camBody.position.set(0, 0.3, 0.04);
  camBody.castShadow = true;
  camRig.add(camBody);

  const tallyMat = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x000000 });
  const tallyLight = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.02, 0.02), tallyMat);
  tallyLight.position.set(0, 0.37, -0.05);
  camRig.add(tallyLight);

  const lensBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.052, 0.16, 18),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.32, metalness: 0.8 })
  );
  lensBarrel.rotation.x = Math.PI / 2;
  lensBarrel.position.set(0, 0.3, -0.14);
  camRig.add(lensBarrel);

  const focusRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.028, 20),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.35, metalness: 0.45 })
  );
  focusRing.rotation.x = Math.PI / 2;
  focusRing.position.set(0, 0.3, -0.18);
  camRig.add(focusRing);

  const irisRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.026, 20),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.45 })
  );
  irisRing.rotation.x = Math.PI / 2;
  irisRing.position.set(0, 0.3, -0.14);
  camRig.add(irisRing);

  const wbRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.054, 0.054, 0.024, 20),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.35 })
  );
  wbRing.rotation.x = Math.PI / 2;
  wbRing.position.set(0, 0.3, -0.1);
  camRig.add(wbRing);

  const lensPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0.06);
  bench.addInteractive(focusRing, {
    label: 'Bague Focus / Mise au point (Glisser G/D)',
    cursor: 'ew-resize',
    dragPlane: lensPlane,
    onDragMove: (_pt, dx) => {
      state.focus = Math.max(0, Math.min(100, Math.round(state.focus + dx * 0.45)));
      syncStudio3D();
      refreshUi();
    }
  });
  bench.addInteractive(irisRing, {
    label: 'Bague Iris / Diaphragme (Glisser G/D)',
    cursor: 'ew-resize',
    dragPlane: lensPlane,
    onDragMove: (_pt, dx) => {
      state.iris = Math.max(0, Math.min(100, Math.round(state.iris + dx * 0.45)));
      syncStudio3D();
      refreshUi();
    }
  });
  bench.addInteractive(wbRing, {
    label: 'Bague Balance des Blancs Kelvin (Glisser G/D)',
    cursor: 'ew-resize',
    dragPlane: lensPlane,
    onDragMove: (_pt, dx) => {
      state.kelvin = Math.max(2800, Math.min(7200, Math.round((state.kelvin + dx * 16) / 50) * 50));
      syncStudio3D();
      refreshUi();
    }
  });

  const audioGroup = new THREE.Group();
  audioGroup.position.set(0.04, 0.014, 0.22);
  bench.scene.add(audioGroup);

  const mixerBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, 0.075, 0.32),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.44, metalness: 0.56 })
  );
  mixerBody.position.y = 0.038;
  mixerBody.rotation.x = 0.15;
  mixerBody.castShadow = true;
  audioGroup.add(mixerBody);

  const vuScreen = makeCanvasScreen(256, 128);
  const vuMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.09),
    new THREE.MeshBasicMaterial({ map: vuScreen.texture })
  );
  vuMesh.rotation.x = -Math.PI / 2 + 0.15;
  vuMesh.position.set(0.16, 0.088, -0.07);
  audioGroup.add(vuMesh);

  const audioFaderPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.09);
  const audioFaderDefs = [
    { key: 'micCravate', label: 'Micro Cravate', x: -0.23, color: 0x38bdf8 },
    { key: 'micAmbiance', label: 'Micro Ambiance', x: -0.13, color: 0x60a5fa },
    { key: 'music', label: 'Musique Générique', x: -0.03, color: 0xa855f7 },
    { key: 'masterAudio', label: 'Master Mix', x: 0.07, color: 0xef4444 }
  ];

  const audioKnobs = [];
  for (const af of audioFaderDefs) {
    const track = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.01, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x0f172a })
    );
    track.position.set(af.x, 0.078, 0.03);
    track.rotation.x = 0.15;
    audioGroup.add(track);

    const knob = new THREE.Mesh(
      new THREE.BoxGeometry(0.044, 0.024, 0.028),
      new THREE.MeshStandardMaterial({ color: af.color, roughness: 0.3 })
    );
    knob.position.set(af.x, 0.092, 0.03);
    knob.castShadow = true;
    audioGroup.add(knob);
    audioKnobs.push({ def: af, knob });

    bench.addInteractive(knob, {
      label: `Fader ${af.label}`,
      cursor: 'ns-resize',
      dragPlane: audioFaderPlane,
      onDragMove: (_pt, _dx, dy) => {
        state[af.key] = Math.max(0, Math.min(100, Math.round(state[af.key] + dy * 0.65)));
        syncStudio3D();
        refreshUi();
      }
    });
  }

  const btn48Mat = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x000000 });
  const btn48 = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.02, 0.04), btn48Mat);
  btn48.position.set(0.2, 0.082, 0.045);
  audioGroup.add(btn48);
  bench.addInteractive(btn48, {
    label: '+48V Alimentation Fantôme',
    cursor: 'pointer',
    onClick: () => {
      state.phantom48v = !state.phantom48v;
      sfx.snap();
      syncStudio3D();
      refreshUi();
    }
  });

  const btnHpfMat = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x000000 });
  const btnHpf = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.02, 0.04), btnHpfMat);
  btnHpf.position.set(0.2, 0.082, 0.105);
  audioGroup.add(btnHpf);
  bench.addInteractive(btnHpf, {
    label: 'Filtre Coupe-Bas 80 Hz',
    cursor: 'pointer',
    onClick: () => {
      state.hpf80 = !state.hpf80;
      sfx.snap();
      syncStudio3D();
      refreshUi();
    }
  });

  const atemGroup = new THREE.Group();
  atemGroup.position.set(0.62, 0.014, 0.22);
  bench.scene.add(atemGroup);

  const atemBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.07, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.38, metalness: 0.68 })
  );
  atemBody.position.y = 0.035;
  atemBody.rotation.x = 0.15;
  atemBody.castShadow = true;
  atemGroup.add(atemBody);

  const srcButtons = {};
  const atemSources = [
    { id: 'CAM-1', x: -0.09 },
    { id: 'CAM-2', x: 0.09 }
  ];
  for (const s of atemSources) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x000000 });
    const btn = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.024, 0.058), mat);
    btn.position.set(s.x, 0.078, -0.035);
    atemGroup.add(btn);
    srcButtons[s.id] = mat;

    bench.addInteractive(btn, {
      label: `Sélection Preview ${s.id}`,
      cursor: 'pointer',
      onClick: () => {
        state.previewSrc = s.id;
        sfx.click();
        syncStudio3D();
        refreshUi();
      }
    });
  }

  const cutBtnMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0x991b1b,
    emissiveIntensity: 0.7
  });
  const cutBtn = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.026, 0.068), cutBtnMat);
  cutBtn.position.set(0, 0.075, 0.075);
  atemGroup.add(cutBtn);

  function executeTakeCut() {
    state.pgmSrc = state.previewSrc;
    const curCue = CUE_LIST[state.cueIdx];
    if (curCue && state.pgmSrc === curCue.target) {
      state.cuesDone.add(curCue.id);
      if (state.cueIdx < CUE_LIST.length - 1) state.cueIdx += 1;
      sfx.success();
    } else {
      sfx.snap();
    }
    syncStudio3D();
    refreshUi();
  }

  bench.addInteractive(cutBtn, {
    label: 'Mélangeur ATEM : CUT / TAKE vers PGM Direct',
    cursor: 'pointer',
    onClick: executeTakeCut
  });

  function drawCamera1Scene(scr, chromaMode, ev) {
    const { ctx, canvas, texture } = scr;
    const w = canvas.width;
    const h = canvas.height;

    const wbErr = state.kelvin - 5600;
    const sharpErr = Math.abs(state.focus - 72);
    const expScale = Math.max(0.35, Math.min(1.25, 0.42 + (state.iris / 100) * 1.15));

    if (chromaMode && ev.chromaOk) {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#1e3a5f');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(56,189,248,0.45)';
      ctx.lineWidth = 2;
      ctx.strokeRect(18, 18, w - 36, h - 56);
    } else if (chromaMode) {
      ctx.fillStyle = state.chromaKey > 94 ? '#020617' : '#15803d';
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = '#166534';
      ctx.fillRect(0, 0, w, h);
    }

    ctx.save();
    if (sharpErr > 10) {
      ctx.globalAlpha = 0.55;
    }
    if (chromaMode && !ev.chromaOk && state.chromaKey <= 94) {
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 8;
      ctx.strokeRect(w * 0.35, h * 0.47, w * 0.3, h * 0.44);
    }

    const rTint = Math.max(160, Math.min(255, Math.round(235 * expScale - wbErr * 0.02)));
    const bTint = Math.max(160, Math.min(255, Math.round(235 * expScale + wbErr * 0.02)));
    ctx.fillStyle = `rgb(${rTint}, ${Math.round(230 * expScale)}, ${bTint})`;
    const rBlur = 21 + sharpErr * 0.28;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.34, rBlur, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(w * 0.36, h * 0.48, w * 0.28, h * 0.42);
    ctx.restore();

    if (Math.abs(wbErr) > 350) {
      ctx.fillStyle = wbErr < 0 ? 'rgba(249,115,22,0.2)' : 'rgba(56,189,248,0.22)';
      ctx.fillRect(0, 0, w, h);
    }

    ctx.fillStyle = 'rgba(2,6,23,0.78)';
    ctx.fillRect(0, h - 28, w, 28);
    ctx.fillStyle = chromaMode ? (ev.chromaOk ? '#4ade80' : '#fbbf24') : ev.focusOk && ev.irisOk && ev.wbOk ? '#4ade80' : '#38bdf8';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(
      chromaMode
        ? `APERCU FOND VERT • CHROMA ${state.chromaKey}% ${ev.chromaOk ? 'PROPRE' : state.chromaKey > 94 ? 'TROP FORT' : 'BORDURE VERTE'}`
        : `CAM-1 • F:${state.focus}% I:${state.iris}% WB:${state.kelvin}K`,
      10,
      h - 10
    );
    texture.needsUpdate = true;
  }

  function drawCam2(scr, pulse) {
    const { ctx, canvas, texture } = scr;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(24, h * 0.52, w - 48, 22);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(w * 0.35, h * 0.32, w * 0.3, 18);
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(30, h * 0.68, 60 + Math.sin(pulse) * 18, 8);
    ctx.fillStyle = 'rgba(2,6,23,0.78)';
    ctx.fillRect(0, h - 28, w, 28);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('CAM-2 • PLAN LARGE STUDIO CIEL', 10, h - 10);
    texture.needsUpdate = true;
  }

  function drawMultiviewAndVu() {
    const ev = evaluateRegie();
    drawCamera1Scene(monitors['CAM-1'], false, ev);
    drawCam2(monitors['CAM-2'], state.vuPhase);
    drawCamera1Scene(monitors['KEY'], true, ev);

    if (state.pgmSrc === 'CAM-1') {
      drawCamera1Scene(monitors['PGM'], true, ev);
    } else {
      drawCam2(monitors['PGM'], state.vuPhase);
    }
    const pgm = monitors['PGM'];
    pgm.ctx.strokeStyle = '#ef4444';
    pgm.ctx.lineWidth = 8;
    pgm.ctx.strokeRect(4, 4, pgm.canvas.width - 8, pgm.canvas.height - 8);
    pgm.ctx.fillStyle = '#ef4444';
    pgm.ctx.fillRect(10, 10, 122, 26);
    pgm.ctx.fillStyle = '#ffffff';
    pgm.ctx.font = 'bold 15px monospace';
    pgm.ctx.fillText(`PGM • ${state.pgmSrc}`, 16, 28);
    pgm.texture.needsUpdate = true;

    const { ctx, canvas, texture } = vuScreen;
    ctx.fillStyle = '#050b14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const db = ev.peakDb + Math.sin(state.vuPhase * 4) * 1.0;
    const norm = Math.max(0, Math.min(1, (db + 48) / 50));
    const segs = 16;
    const activeSegs = Math.round(norm * segs);
    for (let i = 0; i < segs; i++) {
      ctx.fillStyle =
        i >= activeSegs ? '#1e293b' : i >= 13 ? '#ef4444' : i >= 10 ? '#eab308' : '#22c55e';
      ctx.fillRect(12 + i * 14, 34, 10, 26);
      ctx.fillRect(12 + i * 14, 66, 10, 26);
    }
    ctx.fillStyle = ev.audioLevelOk ? '#4ade80' : ev.audioClipping ? '#ef4444' : '#fbbf24';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(
      `VU: ${ev.peakDb.toFixed(1)} dBFS ${ev.audioLevelOk ? '(OPTIMAL)' : ev.audioClipping ? '(CLIP ROUGE!)' : ''}`,
      12,
      24
    );
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '13px monospace';
    ctx.fillText(`+48V:${state.phantom48v ? 'ON' : 'OFF'}  HPF80:${state.hpf80 ? 'ON' : 'OFF'}`, 12, 114);
    texture.needsUpdate = true;
  }

  function syncStudio3D() {
    focusRing.rotation.z = (state.focus / 100) * 1.8;
    irisRing.rotation.z = (state.iris / 100) * 1.8;
    wbRing.rotation.z = ((state.kelvin - 2800) / 4400) * 1.8;

    const camOnAir = state.pgmSrc === 'CAM-1';
    tallyMat.color.setHex(camOnAir ? 0xef4444 : 0x334155);
    tallyMat.emissive.setHex(camOnAir ? 0xef4444 : 0x000000);

    for (const item of audioKnobs) {
      const val = state[item.def.key];
      item.knob.position.z = 0.095 - (val / 100) * 0.13;
    }

    btn48Mat.color.setHex(state.phantom48v ? 0x22c55e : 0x334155);
    btn48Mat.emissive.setHex(state.phantom48v ? 0x15803d : 0x000000);
    btnHpfMat.color.setHex(state.hpf80 ? 0x38bdf8 : 0x334155);
    btnHpfMat.emissive.setHex(state.hpf80 ? 0x0284c7 : 0x000000);

    for (const s of atemSources) {
      const mat = srcButtons[s.id];
      const isPgm = state.pgmSrc === s.id;
      const isPrev = state.previewSrc === s.id;
      mat.color.setHex(isPgm ? 0xef4444 : isPrev ? 0x22c55e : 0x334155);
      mat.emissive.setHex(isPgm ? 0x991b1b : isPrev ? 0x15803d : 0x000000);
    }
  }

  function setCameraById(id) {
    const cam = CAM_VIEWS.find((c) => c.id === id) || CAM_VIEWS[0];
    state.camId = cam.id;
    bench.setCameraView(cam.pos, cam.lookAt, cam.fov);
    bench.setCameras(CAM_VIEWS, cam.id, setCameraById);
  }

  function updateSidebar() {
    const ev = evaluateRegie();
    const curCue = CUE_LIST[state.cueIdx];

    const drawer = bench.setSideDrawer(`
      <div style="display:flex;flex-direction:column;gap:6px;font-size:11px;">
        <div style="font-weight:800;color:#38bdf8;font-size:12px;">1. OPTIQUE CAMÉRA BROADCAST</div>
        <label style="display:flex;align-items:center;gap:6px;">
          <span style="width:74px;">Focus (72%)</span>
          <input type="range" min="0" max="100" value="${state.focus}" data-cam="focus" style="flex:1;" />
          <span style="width:36px;color:${ev.focusOk ? '#4ade80' : '#fbbf24'};">${state.focus}%</span>
        </label>
        <label style="display:flex;align-items:center;gap:6px;">
          <span style="width:74px;">Iris (56%)</span>
          <input type="range" min="0" max="100" value="${state.iris}" data-cam="iris" style="flex:1;" />
          <span style="width:36px;color:${ev.irisOk ? '#4ade80' : '#fbbf24'};">${state.iris}%</span>
        </label>
        <label style="display:flex;align-items:center;gap:6px;">
          <span style="width:74px;">WB (5600K)</span>
          <input type="range" min="2800" max="7200" step="50" value="${state.kelvin}" data-cam="kelvin" style="flex:1;" />
          <span style="width:42px;color:${ev.wbOk ? '#4ade80' : '#fbbf24'};">${state.kelvin}K</span>
        </label>

        <div style="font-weight:800;color:#22c55e;font-size:12px;margin-top:2px;">2. INCRUSTATION CHROMA KEY</div>
        <label style="display:flex;align-items:center;gap:6px;">
          <span style="width:74px;">Seuil (74-94)</span>
          <input type="range" min="0" max="100" value="${state.chromaKey}" data-cam="chromaKey" style="flex:1;" />
          <span style="width:36px;color:${ev.chromaOk ? '#4ade80' : '#fbbf24'};">${state.chromaKey}%</span>
        </label>

        <div style="font-weight:800;color:#a855f7;font-size:12px;margin-top:2px;">3. MIXAGE AUDIO (${ev.peakDb.toFixed(1)} dBFS)</div>
        <div style="display:flex;gap:4px;">
          <button data-btn="48v" style="flex:1;padding:4px;border-radius:4px;border:1px solid #334155;background:${state.phantom48v ? '#14532d' : '#1e293b'};color:#fff;cursor:pointer;">+48V (${state.phantom48v ? 'ON' : 'OFF'})</button>
          <button data-btn="hpf" style="flex:1;padding:4px;border-radius:4px;border:1px solid #334155;background:${state.hpf80 ? '#14532d' : '#1e293b'};color:#fff;cursor:pointer;">HPF 80Hz (${state.hpf80 ? 'ON' : 'OFF'})</button>
        </div>
        <label style="display:flex;align-items:center;gap:6px;">
          <span style="width:74px;">Cravate</span>
          <input type="range" min="0" max="100" value="${state.micCravate}" data-cam="micCravate" style="flex:1;" />
          <span style="width:36px;">${state.micCravate}%</span>
        </label>
        <label style="display:flex;align-items:center;gap:6px;">
          <span style="width:74px;">Ambiance</span>
          <input type="range" min="0" max="100" value="${state.micAmbiance}" data-cam="micAmbiance" style="flex:1;" />
          <span style="width:36px;">${state.micAmbiance}%</span>
        </label>
        <label style="display:flex;align-items:center;gap:6px;">
          <span style="width:74px;">Musique</span>
          <input type="range" min="0" max="100" value="${state.music}" data-cam="music" style="flex:1;" />
          <span style="width:36px;">${state.music}%</span>
        </label>
        <label style="display:flex;align-items:center;gap:6px;">
          <span style="width:74px;">Master Mix</span>
          <input type="range" min="0" max="100" value="${state.masterAudio}" data-cam="masterAudio" style="flex:1;" />
          <span style="width:36px;">${state.masterAudio}%</span>
        </label>

        <div style="font-weight:800;color:#ef4444;font-size:12px;margin-top:2px;">RÉALISATION ATEM (${ev.cuesCompleted}/3)</div>
        <div style="padding:5px 7px;border-radius:5px;background:rgba(15,23,42,0.65);border:1px solid #334155;">
          ${CUE_LIST.map((c) => {
            const done = state.cuesDone.has(c.id);
            const active = c.id === curCue?.id && !done;
            return `<div style="color:${done ? '#4ade80' : active ? '#38bdf8' : '#94a3b8'};">${done ? '[OK] ' : active ? '► ' : ''}${c.label}</div>`;
          }).join('')}
        </div>
      </div>
    `);

    if (!drawer) return;
    drawer.querySelectorAll('[data-cam]').forEach((inp) => {
      inp.addEventListener('input', () => {
        state[inp.dataset.cam] = Number(inp.value);
        syncStudio3D();
        const valSpan = inp.nextElementSibling;
        if (valSpan) {
          valSpan.textContent = inp.dataset.cam === 'kelvin' ? `${inp.value}K` : `${inp.value}%`;
        }
      });
      inp.addEventListener('change', () => refreshUi());
    });
    const b48 = drawer.querySelector('[data-btn="48v"]');
    if (b48) {
      b48.addEventListener('click', () => {
        state.phantom48v = !state.phantom48v;
        sfx.snap();
        syncStudio3D();
        refreshUi();
      });
    }
    const bhpf = drawer.querySelector('[data-btn="hpf"]');
    if (bhpf) {
      bhpf.addEventListener('click', () => {
        state.hpf80 = !state.hpf80;
        sfx.snap();
        syncStudio3D();
        refreshUi();
      });
    }
  }

  function refreshUi() {
    const ev = evaluateRegie();
    const estScore = computeStudioRegieScore3D({
      focusOk: ev.focusOk,
      irisOk: ev.irisOk,
      wbOk: ev.wbOk,
      chromaOk: ev.chromaOk,
      audioLevelOk: ev.audioLevelOk,
      audioClipping: ev.audioClipping,
      phantom48v: state.phantom48v,
      hpf80: state.hpf80,
      cuesCompleted: ev.cuesCompleted,
      elapsedSec: (performance.now() - state.startMs) / 1000
    });

    bench.setInstruction(
      'ATELIER RÉGIE BROADCAST, CAMÉRA & MIXAGE SON 3D',
      `PGM: ${state.pgmSrc} • Chroma: ${ev.chromaOk ? 'OK' : state.chromaKey + '%'} • Son: ${ev.peakDb.toFixed(1)} dBFS • Tops ${ev.cuesCompleted}/3`,
      '1) Réglez Focus, Iris et 5600K sur la caméra  2) Calibrez le Chroma Key fond vert  3) Mixez le son (-14/-10 dBFS) et lancez les 3 tops ATEM.'
    );
    bench.setAccuracy(`Note est. ${estScore.toFixed(1)}/20`);

    bench.setTools(
      atemSources.map((s) => ({
        id: s.id,
        icon: s.id.slice(-1),
        label: `Preview ${s.id}`,
        disabled: false
      })),
      state.previewSrc,
      (id) => {
        state.previewSrc = id;
        sfx.click();
        syncStudio3D();
        refreshUi();
      }
    );

    bench.setActions([
      {
        id: 'take-btn',
        label: `CUT / TAKE (${state.previewSrc})`,
        primary: ev.cuesCompleted < 3,
        danger: true,
        onClick: executeTakeCut
      },
      {
        id: 'finish-btn',
        label: 'Clôturer Direct',
        primary: ev.cuesCompleted === 3 && ev.audioLevelOk && ev.chromaOk,
        disabled: state.submitted,
        onClick: () => {
          if (state.submitted) return;
          state.submitted = true;
          const finalEv = evaluateRegie();
          const finalScore = computeStudioRegieScore3D({
            focusOk: finalEv.focusOk,
            irisOk: finalEv.irisOk,
            wbOk: finalEv.wbOk,
            chromaOk: finalEv.chromaOk,
            audioLevelOk: finalEv.audioLevelOk,
            audioClipping: finalEv.audioClipping,
            phantom48v: state.phantom48v,
            hpf80: state.hpf80,
            cuesCompleted: finalEv.cuesCompleted,
            elapsedSec: (performance.now() - state.startMs) / 1000
          });
          const xp = Math.round(65 + finalScore * 6.5);
          if (finalScore >= 12) sfx.success();
          else sfx.error();
          api.onComplete?.({
            score: finalScore,
            xp,
            summary: `Optique ${finalEv.focusOk && finalEv.irisOk && finalEv.wbOk ? 'OK' : 'À revoir'} • Chroma ${finalEv.chromaOk ? 'OK' : 'KO'} • Son ${finalEv.peakDb.toFixed(1)} dBFS • Tops ${finalEv.cuesCompleted}/3`
          });
        }
      }
    ]);

    updateSidebar();
  }

  bench.addFloatingTag([0.14, 0.56, -0.35], 'Mur Multiview (Cam1 / Cam2 / Key / PGM)', 'info');
  bench.addFloatingTag([-0.56, 0.44, 0.08], 'Caméra Focus / Iris / WB', 'info');
  bench.addFloatingTag([0.04, 0.16, 0.22], 'Console Audio & VU-Mètres', 'info');
  bench.addFloatingTag([0.62, 0.15, 0.22], 'Mélangeur ATEM', 'info');

  const unsubTick = bench.onTick((dt) => {
    state.vuPhase += dt * 3;
    drawMultiviewAndVu();
  });

  syncStudio3D();
  setCameraById('overview');
  refreshUi();

  return {
    destroy: () => {
      unsubTick();
      bench.destroy();
    }
  };
}
