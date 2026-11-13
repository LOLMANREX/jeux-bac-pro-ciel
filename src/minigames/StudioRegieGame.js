import * as THREE from 'three';
import { sfx } from '../core/audio.js';
import {
  createWorkbench3D,
  makeCanvasScreen,
  createEsdMatTexture
} from './Workbench3DHost.js';

export function computeStudioRegieScore3D(metrics = {}) {
  const camSharp = Boolean(metrics.focusOk);
  const irisOk = Boolean(metrics.irisOk);
  const chromaOk = Boolean(metrics.chromaOk);
  const camPts = (camSharp ? 2.5 : 0.8) + (irisOk ? 2 : 0.6) + (chromaOk ? 2 : 0.5);

  const audioInZone = Boolean(metrics.audioLevelOk) && !metrics.audioClipping;
  let audioPts = 0;
  if (metrics.phantom48v) audioPts += 1.5;
  if (metrics.hpf80) audioPts += 1;
  if (audioInZone) audioPts += 4;
  else if (!metrics.audioClipping) audioPts += 1.5;

  const cues = Math.max(0, Math.min(3, metrics.cuesCompleted ?? 0));
  const atemPts = (cues / 3) * 6;

  const elapsed = metrics.elapsedSec ?? 95;
  const bonus = elapsed < 85 ? 1 : elapsed < 140 ? 0.5 : 0;

  const raw = camPts + audioPts + atemPts + bonus;
  return Math.max(0, Math.min(20, Math.round(raw * 2) / 2));
}

const CUE_LIST = [
  { id: 0, target: 'CAM-A', label: 'Cue 1 : Prendre CAM-A (Présentateur)' },
  { id: 1, target: 'SLIDES', label: 'Cue 2 : Envoyer SLIDES (Schéma CIEL)' },
  { id: 2, target: 'CAM-B', label: 'Cue 3 : Basculer sur CAM-B (Plan Atelier)' }
];

const CAM_VIEWS = [
  { id: 'overview', label: 'Vue Régie Globale', pos: [0.02, 0.94, 1.54], lookAt: [0.02, 0.34, -0.05], fov: 41 },
  { id: 'camera', label: 'Caméra Broadcast', pos: [-0.56, 0.58, 0.72], lookAt: [-0.56, 0.32, 0.04], fov: 36 },
  { id: 'audio', label: 'Console Mixage Audio', pos: [0.04, 0.52, 0.68], lookAt: [0.04, 0.1, 0.22], fov: 35 },
  { id: 'atem', label: 'Mélangeur ATEM & Multiview', pos: [0.46, 0.62, 0.88], lookAt: [0.34, 0.3, -0.05], fov: 37 }
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
    new THREE.BoxGeometry(1.9, 0.014, 1.0),
    new THREE.MeshStandardMaterial({ map: esdTex, roughness: 0.7, metalness: 0.08 })
  );
  deskMesh.position.set(0, 0.007, 0.05);
  deskMesh.receiveShadow = true;
  bench.scene.add(deskMesh);

  const state = {
    camId: 'overview',
    focus: 35,
    iris: 28,
    chromaKey: 42,
    phantom48v: false,
    hpf80: false,
    mic1: 42,
    mic2: 20,
    music: 38,
    masterAudio: 70,
    previewSrc: 'CAM-A',
    pgmSrc: 'CAM-B',
    cueIdx: 0,
    cuesDone: new Set(),
    vuPhase: 0,
    startMs: performance.now(),
    submitted: false
  };

  function computeAudioDb() {
    if (!state.phantom48v) return -48;
    const voiceGain = state.mic1 * 0.55 + state.mic2 * 0.18 + state.music * 0.15;
    const masterScale = state.masterAudio / 100;
    const db = -44 + voiceGain * masterScale * 0.62;
    return Math.max(-52, Math.min(2, db));
  }

  function evaluateRegie() {
    const focusDiff = Math.abs(state.focus - 72);
    const irisDiff = Math.abs(state.iris - 56);
    const focusOk = focusDiff <= 9;
    const irisOk = irisDiff <= 10;
    const chromaOk = state.chromaKey >= 72;

    const peakDb = computeAudioDb();
    const audioLevelOk = state.phantom48v && peakDb >= -14.5 && peakDb <= -9.5;
    const audioClipping = peakDb > -3;
    const cuesCompleted = state.cuesDone.size;

    return {
      focusOk,
      irisOk,
      chromaOk,
      peakDb,
      audioLevelOk,
      audioClipping,
      cuesCompleted
    };
  }

  const wallGroup = new THREE.Group();
  wallGroup.position.set(0.08, 0.014, -0.34);
  bench.scene.add(wallGroup);

  const wallStand = new THREE.Mesh(
    new THREE.BoxGeometry(1.36, 0.46, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45, metalness: 0.6 })
  );
  wallStand.position.y = 0.25;
  wallStand.castShadow = true;
  wallGroup.add(wallStand);

  const monitorDefs = [
    { id: 'CAM-A', label: 'CAM-A', x: -0.46, y: 0.34, w: 0.36, h: 0.21 },
    { id: 'CAM-B', label: 'CAM-B', x: -0.46, y: 0.12, w: 0.36, h: 0.21 },
    { id: 'SLIDES', label: 'SLIDES', x: -0.04, y: 0.12, w: 0.36, h: 0.21 },
    { id: 'PGM', label: 'PGM DIRECT', x: 0.34, y: 0.25, w: 0.56, h: 0.34 }
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

  const tripodLegMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.7 });
  for (const angle of [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.3, 10), tripodLegMat);
    leg.position.set(Math.sin(angle) * 0.08, 0.14, Math.cos(angle) * 0.08);
    leg.rotation.z = Math.sin(angle) * 0.35;
    leg.rotation.x = -Math.cos(angle) * 0.35;
    camRig.add(leg);
  }

  const camBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.12, 0.24),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.65 })
  );
  camBody.position.set(0, 0.32, 0.04);
  camBody.castShadow = true;
  camRig.add(camBody);

  const tallyMat = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x000000 });
  const tallyLight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.02), tallyMat);
  tallyLight.position.set(0, 0.39, -0.05);
  camRig.add(tallyLight);

  const lensBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.052, 0.14, 18),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.32, metalness: 0.8 })
  );
  lensBarrel.rotation.x = Math.PI / 2;
  lensBarrel.position.set(0, 0.32, -0.14);
  camRig.add(lensBarrel);

  const focusRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.054, 0.054, 0.032, 20),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.35, metalness: 0.45 })
  );
  focusRing.rotation.x = Math.PI / 2;
  focusRing.position.set(0, 0.32, -0.16);
  camRig.add(focusRing);

  const irisRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.028, 20),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.45 })
  );
  irisRing.rotation.x = Math.PI / 2;
  irisRing.position.set(0, 0.32, -0.11);
  camRig.add(irisRing);

  const lensPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0.06);
  bench.addInteractive(focusRing, {
    label: 'Bague Focus Caméra (Glisser G/D)',
    cursor: 'ew-resize',
    dragPlane: lensPlane,
    onDragMove: (_pt, dx) => {
      state.focus = Math.max(0, Math.min(100, Math.round(state.focus + dx * 0.45)));
      syncStudio3D();
      refreshUi();
    }
  });
  bench.addInteractive(irisRing, {
    label: 'Bague Iris / Exposition (Glisser G/D)',
    cursor: 'ew-resize',
    dragPlane: lensPlane,
    onDragMove: (_pt, dx) => {
      state.iris = Math.max(0, Math.min(100, Math.round(state.iris + dx * 0.45)));
      syncStudio3D();
      refreshUi();
    }
  });

  const audioGroup = new THREE.Group();
  audioGroup.position.set(0.04, 0.014, 0.22);
  bench.scene.add(audioGroup);

  const mixerBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.075, 0.32),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.55 })
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
    { key: 'mic1', label: 'Micro 1', x: -0.22, color: 0x38bdf8 },
    { key: 'mic2', label: 'Micro 2', x: -0.12, color: 0x60a5fa },
    { key: 'music', label: 'Musique', x: -0.02, color: 0xa855f7 },
    { key: 'masterAudio', label: 'Master', x: 0.08, color: 0xef4444 }
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
      label: `Fader Audio ${af.label} (Glisser)`,
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
  const btn48 = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.02, 0.04), btn48Mat);
  btn48.position.set(0.19, 0.082, 0.05);
  audioGroup.add(btn48);
  bench.addInteractive(btn48, {
    label: 'Bouton +48V Alimentation Fantôme',
    cursor: 'pointer',
    onClick: () => {
      state.phantom48v = !state.phantom48v;
      sfx.snap();
      syncStudio3D();
      refreshUi();
    }
  });

  const btnHpfMat = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x000000 });
  const btnHpf = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.02, 0.04), btnHpfMat);
  btnHpf.position.set(0.19, 0.082, 0.105);
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
  atemGroup.position.set(0.6, 0.014, 0.22);
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
    { id: 'CAM-A', x: -0.12 },
    { id: 'CAM-B', x: 0.0 },
    { id: 'SLIDES', x: 0.12 }
  ];
  for (const s of atemSources) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x000000 });
    const btn = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.024, 0.055), mat);
    btn.position.set(s.x, 0.078, -0.03);
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
  const cutBtn = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.026, 0.065), cutBtnMat);
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
    label: 'ATEM CUT / TAKE vers PGM Direct',
    cursor: 'pointer',
    onClick: executeTakeCut
  });

  function drawFeed(scr, kind, ev, pulse) {
    const { ctx, canvas, texture } = scr;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    if (kind === 'CAM-A') {
      ctx.fillStyle = state.chromaKey >= 72 ? '#0f172a' : '#166534';
      ctx.fillRect(0, 0, w, h);
      const expFactor = 0.45 + (state.iris / 100) * 1.15;
      const sharpErr = Math.abs(state.focus - 72);
      ctx.save();
      ctx.globalAlpha = Math.max(0.35, Math.min(1, expFactor));
      ctx.fillStyle = sharpErr > 12 ? 'rgba(226,232,240,0.45)' : '#e2e8f0';
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.36, 22 + sharpErr * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(w * 0.36, h * 0.5, w * 0.28, h * 0.42);
      ctx.restore();
      ctx.fillStyle = sharpErr <= 9 ? '#4ade80' : '#fbbf24';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`CAM-A • FOCUS:${state.focus}% IRIS:${state.iris}%`, 10, h - 12);
    } else if (kind === 'CAM-B') {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(24, h * 0.55, w - 48, 12);
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('CAM-B • PLAN LARGE ATELIER', 10, h - 12);
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.strokeRect(12, 12, w - 24, h - 24);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('BAC PRO CIEL 3D', 24, 52);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '13px monospace';
      ctx.fillText('DIRECT STUDIO • DIFFUSION', 24, 86);
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(24, 108, 48 + Math.sin(pulse) * 16, 8);
    }
    texture.needsUpdate = true;
  }

  function drawMultiviewAndVu() {
    const ev = evaluateRegie();
    drawFeed(monitors['CAM-A'], 'CAM-A', ev, state.vuPhase);
    drawFeed(monitors['CAM-B'], 'CAM-B', ev, state.vuPhase);
    drawFeed(monitors['SLIDES'], 'SLIDES', ev, state.vuPhase);

    drawFeed(monitors['PGM'], state.pgmSrc, ev, state.vuPhase);
    const pgm = monitors['PGM'];
    pgm.ctx.strokeStyle = '#ef4444';
    pgm.ctx.lineWidth = 8;
    pgm.ctx.strokeRect(4, 4, pgm.canvas.width - 8, pgm.canvas.height - 8);
    pgm.ctx.fillStyle = '#ef4444';
    pgm.ctx.fillRect(10, 10, 92, 26);
    pgm.ctx.fillStyle = '#ffffff';
    pgm.ctx.font = 'bold 15px monospace';
    pgm.ctx.fillText(`PGM ${state.pgmSrc}`, 16, 28);
    pgm.texture.needsUpdate = true;

    const { ctx, canvas, texture } = vuScreen;
    ctx.fillStyle = '#050b14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const db = ev.peakDb + Math.sin(state.vuPhase * 4) * 1.1;
    const norm = Math.max(0, Math.min(1, (db + 48) / 50));
    const segs = 16;
    const activeSegs = Math.round(norm * segs);
    for (let i = 0; i < segs; i++) {
      ctx.fillStyle =
        i >= activeSegs ? '#1e293b' : i >= 13 ? '#ef4444' : i >= 10 ? '#22c55e' : '#38bdf8';
      ctx.fillRect(12 + i * 14, 34, 10, 26);
      ctx.fillRect(12 + i * 14, 66, 10, 26);
    }
    ctx.fillStyle = ev.audioLevelOk ? '#4ade80' : ev.audioClipping ? '#ef4444' : '#fbbf24';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(
      `PEAK: ${ev.peakDb.toFixed(1)} dBFS ${ev.audioLevelOk ? '(OK)' : ev.audioClipping ? '(CLIP!)' : ''}`,
      12,
      24
    );
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '13px monospace';
    ctx.fillText(`+48V:${state.phantom48v ? 'ON' : 'OFF'}  HPF80:${state.hpf80 ? 'ON' : 'OFF'}`, 12, 114);
    texture.needsUpdate = true;
  }

  function syncStudio3D() {
    focusRing.rotation.z = (state.focus / 100) * 1.6;
    irisRing.rotation.z = (state.iris / 100) * 1.6;

    const camOnAir = state.pgmSrc === 'CAM-A';
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
      <div style="display:flex;flex-direction:column;gap:7px;font-size:11px;">
        <div style="font-weight:800;color:#38bdf8;font-size:12px;">1. CAMÉRA & FOND VERT</div>
        <label style="display:flex;align-items:center;gap:6px;">
          <span style="width:66px;">Focus (72%)</span>
          <input type="range" min="0" max="100" value="${state.focus}" data-cam="focus" style="flex:1;" />
          <span style="width:32px;color:${ev.focusOk ? '#4ade80' : '#fbbf24'};">${state.focus}%</span>
        </label>
        <label style="display:flex;align-items:center;gap:6px;">
          <span style="width:66px;">Iris (56%)</span>
          <input type="range" min="0" max="100" value="${state.iris}" data-cam="iris" style="flex:1;" />
          <span style="width:32px;color:${ev.irisOk ? '#4ade80' : '#fbbf24'};">${state.iris}%</span>
        </label>
        <label style="display:flex;align-items:center;gap:6px;">
          <span style="width:66px;">Chroma (&ge;72)</span>
          <input type="range" min="0" max="100" value="${state.chromaKey}" data-cam="chromaKey" style="flex:1;" />
          <span style="width:32px;color:${ev.chromaOk ? '#4ade80' : '#fbbf24'};">${state.chromaKey}%</span>
        </label>

        <div style="font-weight:800;color:#a855f7;font-size:12px;margin-top:2px;">2. MIXAGE SON (${ev.peakDb.toFixed(1)} dBFS)</div>
        <div style="display:flex;gap:4px;">
          <button data-btn="48v" style="flex:1;padding:4px;border-radius:4px;border:1px solid #334155;background:${state.phantom48v ? '#14532d' : '#1e293b'};color:#fff;cursor:pointer;">+48V (${state.phantom48v ? 'ON' : 'OFF'})</button>
          <button data-btn="hpf" style="flex:1;padding:4px;border-radius:4px;border:1px solid #334155;background:${state.hpf80 ? '#14532d' : '#1e293b'};color:#fff;cursor:pointer;">HPF 80Hz (${state.hpf80 ? 'ON' : 'OFF'})</button>
        </div>
        <label style="display:flex;align-items:center;gap:6px;">
          <span style="width:66px;">Micro 1</span>
          <input type="range" min="0" max="100" value="${state.mic1}" data-cam="mic1" style="flex:1;" />
          <span style="width:32px;">${state.mic1}%</span>
        </label>
        <label style="display:flex;align-items:center;gap:6px;">
          <span style="width:66px;">Master</span>
          <input type="range" min="0" max="100" value="${state.masterAudio}" data-cam="masterAudio" style="flex:1;" />
          <span style="width:32px;">${state.masterAudio}%</span>
        </label>

        <div style="font-weight:800;color:#ef4444;font-size:12px;margin-top:2px;">3. CONDUCTEUR ATEM (${ev.cuesCompleted}/3)</div>
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
        if (valSpan) valSpan.textContent = `${inp.value}%`;
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
      chromaOk: ev.chromaOk,
      audioLevelOk: ev.audioLevelOk,
      audioClipping: ev.audioClipping,
      phantom48v: state.phantom48v,
      hpf80: state.hpf80,
      cuesCompleted: ev.cuesCompleted,
      elapsedSec: (performance.now() - state.startMs) / 1000
    });

    bench.setInstruction(
      'ATELIER RÉGIE VIDÉO & MIXAGE SON 3D',
      `PGM: ${state.pgmSrc} • Cues ${ev.cuesCompleted}/3 • Son ${ev.peakDb.toFixed(1)} dBFS`,
      'Réglez Focus/Iris/Chroma sur la caméra, calibrez le son entre -14 et -10 dBFS (+48V + HPF), et enchaînez les 3 Cues sur l’ATEM.'
    );
    bench.setAccuracy(`Note est. ${estScore.toFixed(1)}/20`);

    bench.setTools(
      atemSources.map((s) => ({
        id: s.id,
        icon: s.id === 'SLIDES' ? 'S' : s.id.slice(-1),
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
        primary: ev.cuesCompleted === 3 && ev.audioLevelOk,
        disabled: state.submitted,
        onClick: () => {
          if (state.submitted) return;
          state.submitted = true;
          const finalEv = evaluateRegie();
          const finalScore = computeStudioRegieScore3D({
            focusOk: finalEv.focusOk,
            irisOk: finalEv.irisOk,
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
            summary: `Cues ATEM ${finalEv.cuesCompleted}/3 • Son ${finalEv.peakDb.toFixed(1)} dBFS • Focus ${finalEv.focusOk ? 'OK' : 'Flou'}`
          });
        }
      }
    ]);

    updateSidebar();
  }

  bench.addFloatingTag([0.08, 0.56, -0.34], 'Mur Multiview PGM', 'info');
  bench.addFloatingTag([-0.56, 0.46, 0.08], 'Caméra Focus/Iris', 'info');
  bench.addFloatingTag([0.04, 0.16, 0.22], 'Console Audio', 'info');
  bench.addFloatingTag([0.6, 0.15, 0.22], 'Mélangeur ATEM', 'info');

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
