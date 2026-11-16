import * as THREE from 'three';
import { sfx } from '../core/audio.js';
import { buildStudentAvatarMesh } from '../world/AvatarBuilder.js';
import {
  buildFlexibleCable,
  createWorkbench3D,
  makeCanvasScreen
} from './Workbench3DHost.js';

function toSafeNum(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function clamp20(raw) {
  const n = toSafeNum(raw, 0);
  return Math.max(0, Math.min(20, Math.round(n * 2) / 2));
}

export const STUDIO_PATCH_LINKS = [
  {
    id: 0,
    fromId: 'CAM1_SDI_OUT',
    toId: 'ATEM_SDI1_IN',
    label: 'Caméra 1 SDI OUT → ATEM SDI-1 IN',
    color: '#0ea5e9',
    kind: 'sdi'
  },
  {
    id: 1,
    fromId: 'MIC_XLR_OUT',
    toId: 'MIXER_XLR1_IN',
    label: 'Micro Cravate XLR → Console Entrée 1',
    color: '#a855f7',
    kind: 'xlr'
  },
  {
    id: 2,
    fromId: 'ATEM_PGM_OUT',
    toId: 'WALL_PGM_IN',
    label: 'ATEM Sortie PGM → Mur Multiview SDI',
    color: '#f43f5e',
    kind: 'sdi'
  }
];

export const CUE_LIST = [
  { id: 0, target: 'CAM-1', label: 'Top 1 : Ouverture sur Caméra 1 (Présentateur)' },
  { id: 1, target: 'CAM-2', label: 'Top 2 : Bascule Caméra 2 (Plan large plateau)' },
  { id: 2, target: 'CAM-1', label: 'Top 3 : Retour Caméra 1 (Conclusion Direct)' }
];

export const STUDIO_CUE_LIST = CUE_LIST;

export function computeStudioAudioDb(state = {}) {
  const s = state && typeof state === 'object' ? state : {};
  if (s.xlrMicConnected === false || !s.phantom48v) return -48;
  const cravate = Math.max(0, Math.min(100, toSafeNum(s.micCravate, 44)));
  const ambiance = Math.max(0, Math.min(100, toSafeNum(s.micAmbiance, 24)));
  const music = Math.max(0, Math.min(100, toSafeNum(s.music, 36)));
  const master = Math.max(0, Math.min(100, toSafeNum(s.masterAudio, 72)));
  const mix = cravate * 0.68 + ambiance * 0.22 + music * 0.18;
  const masterScale = master / 100;
  const hpfOffset = s.hpf80 ? 0.4 : 0;
  const db = -42 + mix * masterScale * 0.58 + hpfOffset;
  return Math.max(-52, Math.min(2, Math.round(db * 10) / 10));
}

export function evaluateStudioRegieState(state = {}) {
  const s = state && typeof state === 'object' ? state : {};
  let cablesConnected = STUDIO_PATCH_LINKS.length;
  let sdiCam1Ok = true;
  let xlrMicOk = true;
  let sdiPgmOk = true;

  if (s.cablesDone instanceof Set) {
    cablesConnected = s.cablesDone.size;
    sdiCam1Ok = s.cablesDone.has(0);
    xlrMicOk = s.cablesDone.has(1);
    sdiPgmOk = s.cablesDone.has(2);
  } else if (Array.isArray(s.cablesDone)) {
    const set = new Set(s.cablesDone);
    cablesConnected = set.size;
    sdiCam1Ok = set.has(0);
    xlrMicOk = set.has(1);
    sdiPgmOk = set.has(2);
  } else if (s.cablesConnected !== undefined) {
    cablesConnected = Math.max(0, Math.min(STUDIO_PATCH_LINKS.length, Math.round(toSafeNum(s.cablesConnected, 0))));
    sdiCam1Ok = cablesConnected >= 1;
    xlrMicOk = cablesConnected >= 2;
    sdiPgmOk = cablesConnected >= 3;
  }
  cablesConnected = Math.max(0, Math.min(STUDIO_PATCH_LINKS.length, cablesConnected));
  const patchAllOk = cablesConnected === STUDIO_PATCH_LINKS.length;

  const focus = Math.max(0, Math.min(100, toSafeNum(s.focus, 32)));
  const iris = Math.max(0, Math.min(100, toSafeNum(s.iris, 26)));
  const kelvin = Math.max(2000, Math.min(9000, toSafeNum(s.kelvin, 3600)));
  const chromaKey = Math.max(0, Math.min(100, toSafeNum(s.chromaKey, 38)));

  const focusOk = Math.abs(focus - 72) <= 8;
  const irisOk = Math.abs(iris - 56) <= 9;
  const wbOk = Math.abs(kelvin - 5600) <= 250;
  const chromaOk = chromaKey >= 74 && chromaKey <= 94;

  const phantom48v = Boolean(s.phantom48v);
  const hpf80 = Boolean(s.hpf80);
  const peakDb = computeStudioAudioDb({ ...s, xlrMicConnected: xlrMicOk });
  const audioLevelOk = xlrMicOk && phantom48v && peakDb >= -14.5 && peakDb <= -9.5;
  const audioClipping = peakDb > -3;

  let cuesCompleted = 0;
  if (s.cuesDone instanceof Set) {
    cuesCompleted = s.cuesDone.size;
  } else if (Array.isArray(s.cuesDone)) {
    cuesCompleted = new Set(s.cuesDone).size;
  } else if (s.cuesCompleted !== undefined) {
    cuesCompleted = Math.max(0, Math.min(3, Math.round(toSafeNum(s.cuesCompleted, 0))));
  }
  cuesCompleted = Math.max(0, Math.min(CUE_LIST.length, cuesCompleted));

  const opticsAllOk = focusOk && irisOk && wbOk && chromaOk;
  const audioAllOk = xlrMicOk && phantom48v && hpf80 && audioLevelOk && !audioClipping;
  const atemAllOk = patchAllOk && cuesCompleted === CUE_LIST.length;
  const allValid = patchAllOk && opticsAllOk && audioAllOk && atemAllOk;

  let teacherAdvice = '';
  if (!patchAllOk) {
    teacherAdvice = `Professeur CIEL : « Commence par câbler les liaisons SDI & XLR du studio : Caméra 1 → ATEM, Micro Cravate → Console Audio, puis ATEM PGM → Mur Multiview (${cablesConnected}/3). »`;
  } else if (!opticsAllOk) {
    teacherAdvice =
      'Professeur CIEL : « Règle maintenant l’optique de la Caméra 1 (Focus ~72%, Iris ~56%, Balance des Blancs 5600K) puis ajuste le seuil Chroma Key entre 74% et 94% pour incruster le fond vert ! »';
  } else if (!audioAllOk) {
    if (!phantom48v || !hpf80) {
      teacherAdvice =
        'Professeur CIEL : « Sur la console audio, enclenche l’alimentation fantôme +48V pour le micro statique ainsi que le filtre coupe-bas HPF 80 Hz contre les bruits graves ! »';
    } else {
      teacherAdvice = `Professeur CIEL : « Ajuste les faders Micro Cravate et Master Mix pour stabiliser le VU-mètre dans la plage broadcast -14 à -10 dBFS (actuel : ${peakDb.toFixed(1)} dBFS). »`;
    }
  } else if (!atemAllOk) {
    const nextCue = CUE_LIST[Math.min(CUE_LIST.length - 1, toSafeNum(s.cueIdx, cuesCompleted))];
    teacherAdvice = `Professeur CIEL : « Câblage, optique et son prêts pour le direct ! Sur le mélangeur ATEM, sélectionne ${nextCue?.target || 'CAM-1'} en Preview puis appuie sur CUT / TAKE (${cuesCompleted}/3 tops). »`;
  } else {
    teacherAdvice =
      'Professeur CIEL : « Réalisation broadcast irréprochable : Routage SDI/XLR 3/3, Caméra 5600K, Chroma Key net, Mixage -12 dBFS et 3/3 Tops ATEM validés. Clôture le direct pour obtenir 20/20 ! »';
  }

  return {
    cablesConnected,
    sdiCam1Ok,
    xlrMicOk,
    sdiPgmOk,
    patchAllOk,
    focusOk,
    irisOk,
    wbOk,
    chromaOk,
    phantom48v,
    hpf80,
    peakDb,
    audioLevelOk,
    audioClipping,
    cuesCompleted,
    opticsAllOk,
    audioAllOk,
    atemAllOk,
    allValid,
    teacherAdvice
  };
}

export function computeStudioRegieScore3D(metrics = {}) {
  const m = metrics && typeof metrics === 'object' ? metrics : {};
  const hasPatchMetrics = m.cablesConnected !== undefined || m.patchAllOk !== undefined;
  const cables = hasPatchMetrics
    ? Math.max(0, Math.min(STUDIO_PATCH_LINKS.length, toSafeNum(m.cablesConnected, m.patchAllOk ? 3 : 0)))
    : STUDIO_PATCH_LINKS.length;
  const patchOk = hasPatchMetrics ? Boolean(m.patchAllOk || cables >= STUDIO_PATCH_LINKS.length) : true;

  const focusOk = Boolean(m.focusOk);
  const irisOk = Boolean(m.irisOk);
  const wbOk = m.wbOk === undefined ? true : Boolean(m.wbOk);
  const chromaOk = Boolean(m.chromaOk);

  const phantom48v = Boolean(m.phantom48v);
  const hpf80 = Boolean(m.hpf80);
  const audioClipping = Boolean(m.audioClipping);
  const audioInZone = Boolean(m.audioLevelOk) && !audioClipping;
  const cues = Math.max(0, Math.min(3, toSafeNum(m.cuesCompleted, 0)));

  const allMet =
    patchOk &&
    focusOk &&
    irisOk &&
    wbOk &&
    chromaOk &&
    phantom48v &&
    hpf80 &&
    audioInZone &&
    cues >= 3;

  if (allMet) {
    return 20;
  }

  const elapsed = Math.max(0, toSafeNum(m.elapsedSec, 95));
  const bonus = elapsed < 90 ? 0.5 : 0;

  if (hasPatchMetrics) {
    const patchPts = (cables / STUDIO_PATCH_LINKS.length) * 4.0;
    const camPts =
      (focusOk ? 1.5 : 0.3) +
      (irisOk ? 1.5 : 0.3) +
      (wbOk ? 1.0 : 0.2) +
      (chromaOk ? 1.5 : 0.3);
    let audioPts = 0;
    if (phantom48v) audioPts += 1.0;
    if (hpf80) audioPts += 1.0;
    if (audioInZone) audioPts += 3.0;
    else if (!audioClipping) audioPts += 1.0;
    const atemPts = (cues / 3) * 5.0;
    return clamp20(patchPts + camPts + audioPts + atemPts + bonus);
  }

  const camPts =
    (focusOk ? 2.0 : 0.5) +
    (irisOk ? 2.0 : 0.5) +
    (wbOk ? 1.5 : 0.3) +
    (chromaOk ? 2.5 : 0.5);

  let audioPts = 0;
  if (phantom48v) audioPts += 1.25;
  if (hpf80) audioPts += 1.25;
  if (audioInZone) audioPts += 4.0;
  else if (!audioClipping) audioPts += 1.5;

  const atemPts = (cues / 3) * 5.5;
  const raw = camPts + audioPts + atemPts + bonus;
  return clamp20(raw);
}

const CAM_VIEWS = [
  { id: 'overview', label: 'Vue Régie Globale', pos: [0.02, 0.96, 1.58], lookAt: [0.02, 0.34, -0.05], fov: 41 },
  { id: 'cabling', label: 'Patch SDI & XLR', pos: [-0.04, 0.72, 0.98], lookAt: [-0.04, 0.14, 0.0], fov: 42 },
  { id: 'camera', label: 'Objectif Caméra & Fond Vert', pos: [-0.18, 0.48, 0.52], lookAt: [-0.56, 0.28, -0.12], fov: 36 },
  { id: 'audio', label: 'Console Audio & VU-Mètres', pos: [0.04, 0.52, 0.72], lookAt: [0.04, 0.1, 0.22], fov: 35 },
  { id: 'atem', label: 'Multiview & Mélangeur ATEM', pos: [0.42, 0.62, 0.92], lookAt: [0.24, 0.3, -0.08], fov: 38 }
];

export function createStudioRegieGame(api) {
  const bench = createWorkbench3D(api.container, {
    cameraPos: CAM_VIEWS[0].pos,
    lookAt: CAM_VIEWS[0].lookAt,
    fov: CAM_VIEWS[0].fov,
    hasEsdMat: false,
    benchColor: '#1e293b',
    wallColor: '#0f172a',
    background: '#162032',
    envIntensity: 0.58
  });

  const studioDeskTop = new THREE.Mesh(
    new THREE.BoxGeometry(2.02, 0.014, 1.08),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.42, metalness: 0.25 })
  );
  studioDeskTop.position.set(0, 0.007, 0.05);
  studioDeskTop.receiveShadow = true;
  bench.scene.add(studioDeskTop);

  const oakConsoleTrim = new THREE.Mesh(
    new THREE.BoxGeometry(2.04, 0.022, 0.045),
    new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.52, metalness: 0.08 })
  );
  oakConsoleTrim.position.set(0, 0.011, 0.59);
  bench.scene.add(oakConsoleTrim);

  const state = {
    camId: 'overview',
    selectedPort: null,
    cablesDone: new Set(),
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

  function evaluateRegie() {
    return evaluateStudioRegieState(state);
  }

  const cycloFloor = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.012, 0.34),
    new THREE.MeshStandardMaterial({ color: 0x16a34a, emissive: 0x000000, roughness: 0.85 })
  );
  cycloFloor.position.set(-0.56, 0.018, -0.29);
  cycloFloor.receiveShadow = true;
  bench.scene.add(cycloFloor);

  const greenBackdrop = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.38, 0.022),
    new THREE.MeshStandardMaterial({ color: 0x16a34a, emissive: 0x000000, roughness: 0.85 })
  );
  greenBackdrop.position.set(-0.56, 0.21, -0.45);
  bench.scene.add(greenBackdrop);

  bench.addInteractive(greenBackdrop, {
    label: () => `Cyclorama Fond Vert (Chroma Key: ${state.chromaKey}% — Cliquer pour calibrer à 84%)`,
    cursor: 'pointer',
    highlightTargets: [greenBackdrop, cycloFloor],
    onClick: () => {
      state.chromaKey = 84;
      sfx.dmxAddressBeep(true);
      bench.showToast('Incrustation Chroma Key calibrée à 84% (Fond vert uniforme)', 'success');
      syncStudio3D();
      refreshUi();
    }
  });

  const softboxDiffuserMats = [];
  for (const sx of [-0.84, -0.28]) {
    const standPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.008, 0.42, 8),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 })
    );
    standPole.position.set(sx, 0.22, -0.24);
    const softbox = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.08, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 })
    );
    softbox.position.set(sx, 0.43, -0.24);
    softbox.lookAt(-0.56, 0.22, -0.34);
    const diffMat = new THREE.MeshStandardMaterial({
      color: 0xfef9c3,
      emissive: 0xfef9c3,
      emissiveIntensity: 0.65,
      roughness: 0.3
    });
    softboxDiffuserMats.push(diffMat);
    const diffuser = new THREE.Mesh(
      new THREE.PlaneGeometry(0.095, 0.065),
      diffMat
    );
    diffuser.position.z = 0.017;
    softbox.add(diffuser);
    bench.scene.add(standPole, softbox);
  }

  const studioSpot = new THREE.SpotLight(0xfff4de, 1.4, 1.8, Math.PI / 3.5, 0.5, 1.0);
  studioSpot.position.set(-0.56, 0.62, -0.08);
  const studioSpotTarget = new THREE.Object3D();
  studioSpotTarget.position.set(-0.56, 0.16, -0.35);
  bench.scene.add(studioSpot, studioSpotTarget);
  studioSpot.target = studioSpotTarget;

  const studioPresenter = buildStudentAvatarMesh({
    outfitColor: '#0284c7',
    outfitStyle: 'blouse',
    hat: 'none',
    skinTone: '#f1c29b',
    pantsColor: '#1e293b'
  });
  studioPresenter.group.scale.setScalar(0.155);
  studioPresenter.group.position.set(-0.56, 0.024, -0.34);
  bench.scene.add(studioPresenter.group);

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
    const scr = makeCanvasScreen(
      m.id === 'PGM' ? 420 : 280,
      m.id === 'PGM' ? 256 : 168,
      (ctx, w, h) => {
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, w, h);
      }
    );
    const bezel = new THREE.Mesh(
      new THREE.BoxGeometry(m.w + 0.018, m.h + 0.018, 0.008),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: 0x000000, roughness: 0.4 })
    );
    bezel.position.set(m.x, m.y, 0.025);
    wallGroup.add(bezel);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(m.w, m.h),
      new THREE.MeshBasicMaterial({ map: scr.texture })
    );
    mesh.position.set(m.x, m.y, 0.031);
    wallGroup.add(mesh);
    monitors[m.id] = scr;

    if (m.id === 'CAM-1' || m.id === 'CAM-2') {
      bench.addInteractive(mesh, {
        label: `Moniteur ${m.id} (Cliquer pour envoyer ${m.id} en Preview ATEM)`,
        cursor: 'pointer',
        highlightTargets: [bezel, mesh],
        onClick: () => {
          state.previewSrc = m.id;
          sfx.sdiPatch();
          bench.showToast(`${m.id} routée vers le bus Preview ATEM`, 'info');
          syncStudio3D();
          refreshUi();
        }
      });
    } else if (m.id === 'KEY') {
      bench.addInteractive(mesh, {
        label: () => `Moniteur Incrustation Chroma Key (${state.chromaKey}% — Cliquer pour calibrer à 84%)`,
        cursor: 'pointer',
        highlightTargets: [bezel, mesh],
        onClick: () => {
          state.chromaKey = 84;
          sfx.dmxAddressBeep(true);
          bench.showToast('Seuil Chroma Key ajusté à 84% (incrustation propre)', 'success');
          syncStudio3D();
          refreshUi();
        }
      });
    } else if (m.id === 'PGM') {
      bench.addInteractive(mesh, {
        label: () => `Moniteur Antenne PGM (${state.pgmSrc}) — Cliquer pour CUT / TAKE`,
        cursor: 'pointer',
        highlightTargets: [bezel, mesh],
        onClick: () => executeTakeCut()
      });
    }
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
    new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: 0x000000, roughness: 0.38, metalness: 0.65 })
  );
  camBody.position.set(0, 0.3, 0.04);
  camBody.castShadow = true;
  camRig.add(camBody);

  const tallyMat = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x000000, emissiveIntensity: 0.8 });
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

  const matteBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.1, 0.045),
    new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.55, metalness: 0.35 })
  );
  matteBox.position.set(0, 0.3, -0.225);
  camRig.add(matteBox);

  const camHandle = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.025, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.7 })
  );
  camHandle.position.set(0, 0.39, 0.02);
  camRig.add(camHandle);

  const focusRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.058, 0.058, 0.03, 20),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x000000, roughness: 0.35, metalness: 0.45 })
  );
  focusRing.rotation.x = Math.PI / 2;
  focusRing.position.set(0, 0.3, -0.18);
  camRig.add(focusRing);

  const irisRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.058, 0.058, 0.028, 20),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0x000000, roughness: 0.35, metalness: 0.45 })
  );
  irisRing.rotation.x = Math.PI / 2;
  irisRing.position.set(0, 0.3, -0.14);
  camRig.add(irisRing);

  const wbRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.057, 0.057, 0.026, 20),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0x000000, roughness: 0.35, metalness: 0.35 })
  );
  wbRing.rotation.x = Math.PI / 2;
  wbRing.position.set(0, 0.3, -0.1);
  camRig.add(wbRing);

  let lastTickAt = 0;
  const playThrottledTick = (ratio) => {
    const now = performance.now();
    if (now - lastTickAt > 55) {
      lastTickAt = now;
      sfx.faderTick(ratio);
    }
  };

  const lensPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0.06);
  let focusDragAcc = 0;
  bench.addInteractive(focusRing, {
    label: () => `Bague Focus / Mise au point (${state.focus}% — Cible 72%)`,
    cursor: 'ew-resize',
    dragPlane: lensPlane,
    highlightTargets: [focusRing],
    onDragStart: () => {
      focusDragAcc = 0;
    },
    onClick: () => {
      state.focus = 72;
      sfx.dmxAddressBeep(true);
      bench.showToast('Mise au point Focus verrouillée à 72% (Netteté optimale)', 'success');
      syncStudio3D();
      refreshUi();
    },
    onDragMove: (_pt, dx) => {
      focusDragAcc += dx * 0.45;
      if (Math.abs(focusDragAcc) >= 1) {
        const delta = Math.trunc(focusDragAcc);
        focusDragAcc -= delta;
        state.focus = Math.max(0, Math.min(100, state.focus + delta));
        playThrottledTick(state.focus / 100);
        syncStudio3D();
        syncLiveUiWithoutRebuild();
      }
    },
    onDragEnd: () => refreshUi()
  });

  let irisDragAcc = 0;
  bench.addInteractive(irisRing, {
    label: () => `Bague Iris / Diaphragme (${state.iris}% — Cible 56%)`,
    cursor: 'ew-resize',
    dragPlane: lensPlane,
    highlightTargets: [irisRing],
    onDragStart: () => {
      irisDragAcc = 0;
    },
    onClick: () => {
      state.iris = 56;
      sfx.dmxAddressBeep(true);
      bench.showToast('Diaphragme Iris calibré à 56% (Exposition nominale)', 'success');
      syncStudio3D();
      refreshUi();
    },
    onDragMove: (_pt, dx) => {
      irisDragAcc += dx * 0.45;
      if (Math.abs(irisDragAcc) >= 1) {
        const delta = Math.trunc(irisDragAcc);
        irisDragAcc -= delta;
        state.iris = Math.max(0, Math.min(100, state.iris + delta));
        playThrottledTick(state.iris / 100);
        syncStudio3D();
        syncLiveUiWithoutRebuild();
      }
    },
    onDragEnd: () => refreshUi()
  });

  let wbDragAcc = 0;
  bench.addInteractive(wbRing, {
    label: () => `Bague Balance des Blancs (${state.kelvin}K — Cible 5600K)`,
    cursor: 'ew-resize',
    dragPlane: lensPlane,
    highlightTargets: [wbRing],
    onDragStart: () => {
      wbDragAcc = 0;
    },
    onClick: () => {
      state.kelvin = 5600;
      sfx.dmxAddressBeep(true);
      bench.showToast('Balance des blancs calibrée à 5600K (Lumière du jour)', 'success');
      syncStudio3D();
      refreshUi();
    },
    onDragMove: (_pt, dx) => {
      wbDragAcc += dx * 16;
      if (Math.abs(wbDragAcc) >= 50) {
        const steps = Math.trunc(wbDragAcc / 50);
        wbDragAcc -= steps * 50;
        state.kelvin = Math.max(2800, Math.min(7200, state.kelvin + steps * 50));
        playThrottledTick((state.kelvin - 2800) / 4400);
        syncStudio3D();
        syncLiveUiWithoutRebuild();
      }
    },
    onDragEnd: () => refreshUi()
  });

  bench.addInteractive(camBody, {
    label: 'Caméra Broadcast CAM-1 (Cliquer pour cadrer sur l’objectif)',
    cursor: 'pointer',
    onClick: () => {
      sfx.click();
      setCameraById('camera');
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

  const vuScreen = makeCanvasScreen(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);
  });
  const vuBezel = new THREE.Mesh(
    new THREE.BoxGeometry(0.252, 0.102, 0.008),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x000000, roughness: 0.4 })
  );
  vuBezel.rotation.x = -Math.PI / 2 + 0.15;
  vuBezel.position.set(0.16, 0.083, -0.07);
  audioGroup.add(vuBezel);
  const vuMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.09),
    new THREE.MeshBasicMaterial({ map: vuScreen.texture })
  );
  vuMesh.rotation.x = -Math.PI / 2 + 0.15;
  vuMesh.position.set(0.16, 0.089, -0.07);
  audioGroup.add(vuMesh);

  bench.addInteractive(vuMesh, {
    label: () => `VU-Mètre Broadcast (${evaluateRegie().peakDb.toFixed(1)} dBFS — Cliquer pour tester le 1 kHz)`,
    cursor: 'pointer',
    highlightTargets: [vuBezel, vuMesh],
    onClick: () => {
      const ev = evaluateRegie();
      sfx.audioTestTone(ev.xlrMicOk ? ev.peakDb : -48);
      bench.showToast(
        !ev.xlrMicOk
          ? 'Branchez d’abord le câble Micro Cravate XLR → Console Entrée 1 !'
          : `Niveau crête : ${ev.peakDb.toFixed(1)} dBFS (${ev.audioLevelOk ? 'Optimal -14 à -10 dBFS' : 'Ajustez les faders et +48V'})`,
        ev.audioLevelOk ? 'success' : 'info'
      );
    }
  });

  const audioFaderPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
    new THREE.Vector3(0, Math.cos(0.15), Math.sin(0.15)).normalize(),
    new THREE.Vector3(0.04, 0.102, 0.22)
  );
  const audioFaderDefs = [
    { key: 'micCravate', label: 'Micro Cravate', target: 78, x: -0.23, color: 0x38bdf8 },
    { key: 'micAmbiance', label: 'Micro Ambiance', target: 25, x: -0.13, color: 0x60a5fa },
    { key: 'music', label: 'Musique Générique', target: 25, x: -0.03, color: 0xa855f7 },
    { key: 'masterAudio', label: 'Master Mix', target: 80, x: 0.07, color: 0xef4444 }
  ];

  const audioKnobs = [];
  for (const af of audioFaderDefs) {
    const track = new THREE.Mesh(
      new THREE.BoxGeometry(0.024, 0.012, 0.165),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x000000 })
    );
    track.position.set(af.x, 0.078, 0.03);
    track.rotation.x = 0.15;
    audioGroup.add(track);

    const knob = new THREE.Mesh(
      new THREE.BoxGeometry(0.046, 0.026, 0.03),
      new THREE.MeshStandardMaterial({ color: af.color, emissive: 0x000000, roughness: 0.3 })
    );
    knob.position.set(af.x, 0.092, 0.03);
    knob.rotation.x = 0.15;
    knob.castShadow = true;
    audioGroup.add(knob);
    audioKnobs.push({ def: af, knob, track });

    let audioDragAcc = 0;
    const applyAudioFaderFromDrag = (planePt, dy) => {
      let nextVal = state[af.key];
      if (planePt && Number.isFinite(planePt.z)) {
        const localZ = planePt.z - audioGroup.position.z;
        const ratio = Math.max(0, Math.min(1, (0.095 - localZ) / 0.13));
        nextVal = Math.round(ratio * 100);
      } else {
        audioDragAcc -= dy * 0.65;
        if (Math.abs(audioDragAcc) >= 1) {
          const step = Math.trunc(audioDragAcc);
          audioDragAcc -= step;
          nextVal = Math.max(0, Math.min(100, state[af.key] + step));
        }
      }
      if (nextVal !== state[af.key]) {
        state[af.key] = nextVal;
        playThrottledTick(nextVal / 100);
        syncStudio3D();
        syncLiveUiWithoutRebuild();
      }
    };

    bench.addInteractive(knob, {
      label: () => `Fader ${af.label} (${state[af.key]}%)`,
      cursor: 'ns-resize',
      dragPlane: audioFaderPlane,
      highlightTargets: [knob],
      onDragStart: () => {
        audioDragAcc = 0;
      },
      onDragMove: (planePt, _dx, dy) => applyAudioFaderFromDrag(planePt, dy),
      onDragEnd: () => refreshUi()
    });

    bench.addInteractive(track, {
      label: () => `Piste Fader ${af.label} (Cliquer ou glisser)`,
      cursor: 'ns-resize',
      dragPlane: audioFaderPlane,
      highlightTargets: [knob],
      onDragStart: () => {
        audioDragAcc = 0;
      },
      onClick: (_hit, info) => {
        if (info?.planePoint && Number.isFinite(info.planePoint.z)) {
          const localZ = info.planePoint.z - audioGroup.position.z;
          const ratio = Math.max(0, Math.min(1, (0.095 - localZ) / 0.13));
          state[af.key] = Math.round(ratio * 100);
          sfx.faderTick(ratio);
          syncStudio3D();
          refreshUi();
        }
      },
      onDragMove: (planePt, _dx, dy) => applyAudioFaderFromDrag(planePt, dy),
      onDragEnd: () => refreshUi()
    });
  }

  function togglePhantom48v() {
    state.phantom48v = !state.phantom48v;
    sfx.phantomPowerTone(state.phantom48v);
    bench.showToast(
      state.phantom48v
        ? 'Alimentation fantôme +48V activée sur l’entrée XLR Micro Cravate'
        : 'Alimentation fantôme +48V coupée (micro statique muet)',
      state.phantom48v ? 'success' : 'info'
    );
    syncStudio3D();
    refreshUi();
  }

  function toggleHpf80() {
    state.hpf80 = !state.hpf80;
    sfx.snap();
    bench.showToast(
      state.hpf80
        ? 'Filtre coupe-bas HPF 80 Hz activé (plosives et ronflements filtrés)'
        : 'Filtre coupe-bas HPF 80 Hz désactivé',
      state.hpf80 ? 'success' : 'info'
    );
    syncStudio3D();
    refreshUi();
  }

  const btn48Mat = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x000000, emissiveIntensity: 0 });
  const btn48 = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.024, 0.044), btn48Mat);
  btn48.position.set(0.2, 0.083, 0.045);
  audioGroup.add(btn48);
  bench.addInteractive(btn48, {
    label: () => `+48V Alimentation Fantôme (${state.phantom48v ? 'ACTIF' : 'OFF'})`,
    cursor: 'pointer',
    onClick: togglePhantom48v
  });

  const btnHpfMat = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x000000, emissiveIntensity: 0 });
  const btnHpf = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.024, 0.044), btnHpfMat);
  btnHpf.position.set(0.2, 0.083, 0.105);
  audioGroup.add(btnHpf);
  bench.addInteractive(btnHpf, {
    label: () => `Filtre Coupe-Bas HPF 80 Hz (${state.hpf80 ? 'ACTIF' : 'OFF'})`,
    cursor: 'pointer',
    onClick: toggleHpf80
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
    const mat = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x000000, emissiveIntensity: 0 });
    const btn = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.026, 0.062), mat);
    btn.position.set(s.x, 0.079, -0.035);
    atemGroup.add(btn);
    srcButtons[s.id] = mat;

    bench.addInteractive(btn, {
      label: `Sélection Preview ${s.id}`,
      cursor: 'pointer',
      onClick: () => {
        state.previewSrc = s.id;
        sfx.sdiPatch();
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
  const cutBtn = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.028, 0.072), cutBtnMat);
  cutBtn.position.set(0, 0.076, 0.075);
  atemGroup.add(cutBtn);

  const studioPorts = {};
  const studioCableGroup = new THREE.Group();
  bench.scene.add(studioCableGroup);

  function getValidStudioTargetPort(fromId) {
    if (!fromId) return null;
    for (const lk of STUDIO_PATCH_LINKS) {
      if (state.cablesDone.has(lk.id)) continue;
      if (lk.fromId === fromId) return lk.toId;
      if (lk.toId === fromId) return lk.fromId;
    }
    return null;
  }

  function createStudioPort(parent, localPos, portId, label, baseHex) {
    const holder = new THREE.Group();
    holder.position.copy(localPos);
    parent.add(holder);

    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.024, 16),
      new THREE.MeshStandardMaterial({
        color: baseHex,
        emissive: 0x000000,
        emissiveIntensity: 0,
        roughness: 0.32,
        metalness: 0.72
      })
    );
    ring.rotation.x = Math.PI / 2;
    holder.add(ring);

    const hitMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.038, 10, 10),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    holder.add(hitMesh);

    const anchor = new THREE.Object3D();
    holder.add(anchor);
    studioPorts[portId] = { mesh: ring, anchor, label, baseHex };

    bench.addInteractive(holder, {
      label: `Connecteur ${label}`,
      cursor: 'pointer',
      highlightTargets: [ring],
      onClick: () => handleStudioPortClick(portId)
    });
    return holder;
  }

  const micStageBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.045, 0.09),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.55 })
  );
  micStageBox.position.set(-0.28, 0.036, -0.11);
  bench.scene.add(micStageBox);

  createStudioPort(camRig, new THREE.Vector3(0.082, 0.28, 0.04), 'CAM1_SDI_OUT', 'Caméra 1 SDI OUT', 0x0ea5e9);
  createStudioPort(micStageBox, new THREE.Vector3(0.04, 0.028, 0.03), 'MIC_XLR_OUT', 'Micro Cravate XLR OUT', 0xa855f7);
  createStudioPort(audioGroup, new THREE.Vector3(-0.26, 0.075, -0.145), 'MIXER_XLR1_IN', 'Console Audio XLR-1 IN', 0xa855f7);
  createStudioPort(atemGroup, new THREE.Vector3(-0.12, 0.072, -0.14), 'ATEM_SDI1_IN', 'ATEM SDI-1 IN', 0x0ea5e9);
  createStudioPort(atemGroup, new THREE.Vector3(0.12, 0.072, -0.14), 'ATEM_PGM_OUT', 'ATEM PGM SDI OUT', 0xf43f5e);
  createStudioPort(wallGroup, new THREE.Vector3(0.28, 0.045, 0.036), 'WALL_PGM_IN', 'Mur Multiview SDI IN', 0xf43f5e);

  function rebuildStudioCables() {
    while (studioCableGroup.children.length > 0) {
      const child = studioCableGroup.children.pop();
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of mats) m.dispose?.();
      }
    }
    bench.scene.updateMatrixWorld(true);
    for (const lk of STUDIO_PATCH_LINKS) {
      if (!state.cablesDone.has(lk.id)) continue;
      const pA = new THREE.Vector3();
      const pB = new THREE.Vector3();
      studioPorts[lk.fromId].anchor.getWorldPosition(pA);
      studioPorts[lk.toId].anchor.getWorldPosition(pB);
      const mid = pA.clone().lerp(pB, 0.5);
      mid.y = Math.max(0.04, Math.min(pA.y, pB.y) - 0.03);
      mid.z += 0.05;
      const cableObj = buildFlexibleCable([pA, mid, pB], lk.color, 0.0085, lk.color);
      studioCableGroup.add(cableObj.mesh);
    }
  }

  function handleStudioPortClick(portId) {
    if (!state.selectedPort) {
      state.selectedPort = portId;
      sfx.cableSelect();
      const nextId = getValidStudioTargetPort(portId);
      const hint = nextId ? ` → cliquez maintenant ${studioPorts[nextId]?.label}` : '';
      bench.showToast(`Connecteur ${studioPorts[portId]?.label} sélectionné${hint}`, 'info');
      syncStudio3D();
      refreshUi();
      return;
    }

    if (state.selectedPort === portId) {
      state.selectedPort = null;
      sfx.click();
      syncStudio3D();
      refreshUi();
      return;
    }

    const a = state.selectedPort;
    const b = portId;
    const matched = STUDIO_PATCH_LINKS.find(
      (lk) => (lk.fromId === a && lk.toId === b) || (lk.fromId === b && lk.toId === a)
    );
    state.selectedPort = null;

    if (matched && !state.cablesDone.has(matched.id)) {
      state.cablesDone.add(matched.id);
      if (matched.kind === 'xlr') sfx.xlrPlug();
      else sfx.sdiPatch();
      const pTarget = new THREE.Vector3();
      studioPorts[b]?.anchor.getWorldPosition(pTarget);
      bench.spawnPulseRing(pTarget, matched.color, 0.08);
      if (state.cablesDone.size === STUDIO_PATCH_LINKS.length) {
        sfx.stageComplete();
      }
      bench.showToast(`Liaison branchée : ${matched.label}`, 'success');
      rebuildStudioCables();
      syncStudio3D();
    } else if (matched && state.cablesDone.has(matched.id)) {
      sfx.click();
      bench.showToast(`Liaison déjà connectée : ${matched.label}`, 'info');
      syncStudio3D();
    } else {
      sfx.error();
      bench.showToast('Branchement incompatible : respectez SDI Vidéo vs XLR Audio !', 'error');
      syncStudio3D();
    }
    refreshUi();
  }

  function connectNextStudioCable() {
    const nextLink = STUDIO_PATCH_LINKS.find((lk) => !state.cablesDone.has(lk.id));
    if (!nextLink) {
      sfx.stageComplete();
      bench.showToast('Toutes les liaisons SDI & XLR du plateau sont déjà connectées (3/3) !', 'success');
      return;
    }
    state.selectedPort = null;
    state.cablesDone.add(nextLink.id);
    if (nextLink.kind === 'xlr') sfx.xlrPlug();
    else sfx.sdiPatch();
    const pTarget = new THREE.Vector3();
    studioPorts[nextLink.toId]?.anchor.getWorldPosition(pTarget);
    bench.spawnPulseRing(pTarget, nextLink.color, 0.08);
    if (state.cablesDone.size === STUDIO_PATCH_LINKS.length) {
      sfx.stageComplete();
    }
    bench.showToast(`Liaison branchée : ${nextLink.label}`, 'success');
    rebuildStudioCables();
    syncStudio3D();
    refreshUi();
  }

  function executeTakeCut() {
    const evBefore = evaluateRegie();
    if (!evBefore.sdiCam1Ok || !evBefore.sdiPgmOk) {
      sfx.error();
      bench.showToast('Branchez d’abord les câbles vidéo SDI-1 et ATEM PGM avant de commuter à l’antenne !', 'error');
      return;
    }
    const curCue = CUE_LIST[state.cueIdx];
    const prevPgm = state.pgmSrc;
    state.pgmSrc = state.previewSrc;
    state.previewSrc = prevPgm === state.pgmSrc ? (state.pgmSrc === 'CAM-1' ? 'CAM-2' : 'CAM-1') : prevPgm;

    if (curCue && state.pgmSrc === curCue.target && !state.cuesDone.has(curCue.id)) {
      state.cuesDone.add(curCue.id);
      bench.showToast(`Top validé : ${curCue.label}`, 'success');
      if (state.cueIdx < CUE_LIST.length - 1) {
        state.cueIdx += 1;
        const nextTarget = CUE_LIST[state.cueIdx]?.target;
        if (nextTarget) state.previewSrc = nextTarget;
      }
      sfx.atemCut();
      sfx.stageComplete();
    } else {
      bench.showToast(`Direct basculé sur ${state.pgmSrc} (Prochain attendu : ${curCue?.target || 'CAM-1'})`, 'info');
      sfx.atemCut();
    }
    syncStudio3D();
    refreshUi();
  }

  bench.addInteractive(cutBtn, {
    label: 'Mélangeur ATEM : CUT / TAKE vers PGM Direct',
    cursor: 'pointer',
    onClick: executeTakeCut
  });

  function calibrateOpticsAndChroma() {
    state.focus = 72;
    state.iris = 56;
    state.kelvin = 5600;
    state.chromaKey = 84;
    sfx.dmxAddressBeep(true);
    sfx.stageComplete();
    bench.showToast('Optique Caméra (Focus 72%, Iris 56%, 5600K) & Chroma Key (84%) calibrés !', 'success');
    syncStudio3D();
    refreshUi();
  }

  function calibrateAudioConsole() {
    if (!state.cablesDone.has(1)) {
      state.cablesDone.add(1);
      rebuildStudioCables();
    }
    state.phantom48v = true;
    state.hpf80 = true;
    state.micCravate = 78;
    state.micAmbiance = 25;
    state.music = 25;
    state.masterAudio = 80;
    const db = computeStudioAudioDb({ ...state, xlrMicConnected: true });
    sfx.phantomPowerTone(true);
    sfx.audioTestTone(db);
    bench.showToast(`Console Audio calibrée : +48V ON, HPF 80Hz ON, Mix à ${db.toFixed(1)} dBFS !`, 'success');
    syncStudio3D();
    refreshUi();
  }

  function drawNoSignalScreen(scr, title, hint) {
    const { ctx, canvas, texture } = scr;
    const w = canvas.width;
    const h = canvas.height;
    const bars = ['#e2e8f0', '#eab308', '#22d3ee', '#22c55e', '#d946ef', '#ef4444', '#2563eb'];
    const bw = w / bars.length;
    for (let i = 0; i < bars.length; i++) {
      ctx.fillStyle = bars[i];
      ctx.fillRect(i * bw, 0, bw + 1, h * 0.72);
    }
    ctx.fillStyle = 'rgba(2, 6, 23, 0.86)';
    ctx.fillRect(0, h * 0.25, w, h * 0.5);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(title, w / 2, h * 0.45);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(hint, w / 2, h * 0.62);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(2,6,23,0.9)';
    ctx.fillRect(0, h - 28, w, 28);
    ctx.fillStyle = '#f87171';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`NO SIGNAL • ${hint}`, 10, h - 10);
    texture.needsUpdate = true;
  }

  function drawCamera1Scene(scr, chromaMode, ev) {
    if (!ev.sdiCam1Ok) {
      drawNoSignalScreen(scr, 'NO SIGNAL SDI-1', 'BRANCHEZ CAM-1 -> ATEM');
      return;
    }
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

    if (!ev.sdiPgmOk) {
      drawNoSignalScreen(monitors['PGM'], 'NO SIGNAL PGM', 'RELIER ATEM PGM -> MUR');
    } else if (state.pgmSrc === 'CAM-1') {
      drawCamera1Scene(monitors['PGM'], true, ev);
    } else {
      drawCam2(monitors['PGM'], state.vuPhase);
    }
    const pgm = monitors['PGM'];
    pgm.ctx.strokeStyle = ev.sdiPgmOk ? '#ef4444' : '#f59e0b';
    pgm.ctx.lineWidth = 8;
    pgm.ctx.strokeRect(4, 4, pgm.canvas.width - 8, pgm.canvas.height - 8);
    pgm.ctx.fillStyle = ev.sdiPgmOk ? '#ef4444' : '#b45309';
    pgm.ctx.fillRect(10, 10, 134, 26);
    pgm.ctx.fillStyle = '#ffffff';
    pgm.ctx.font = 'bold 15px monospace';
    pgm.ctx.fillText(ev.sdiPgmOk ? `PGM • ${state.pgmSrc}` : 'PGM • OFF', 16, 28);
    pgm.texture.needsUpdate = true;

    const { ctx, canvas, texture } = vuScreen;
    ctx.fillStyle = '#050b14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const db = ev.xlrMicOk ? ev.peakDb + Math.sin(state.vuPhase * 4) * 0.8 : -52;
    const norm = Math.max(0, Math.min(1, (db + 48) / 50));
    const segs = 16;
    const activeSegs = ev.xlrMicOk && state.phantom48v ? Math.round(norm * segs) : 0;
    for (let i = 0; i < segs; i++) {
      ctx.fillStyle =
        i >= activeSegs ? '#1e293b' : i >= 13 ? '#ef4444' : i >= 10 ? '#eab308' : '#22c55e';
      ctx.fillRect(12 + i * 14, 34, 10, 26);
      ctx.fillRect(12 + i * 14, 66, 10, 26);
    }
    ctx.fillStyle = !ev.xlrMicOk
      ? '#f87171'
      : ev.audioLevelOk
      ? '#4ade80'
      : ev.audioClipping
      ? '#ef4444'
      : '#fbbf24';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(
      !ev.xlrMicOk
        ? 'VU: MIC XLR DEBRANCHE'
        : `VU: ${ev.peakDb.toFixed(1)} dBFS ${ev.audioLevelOk ? '(OPTIMAL)' : ev.audioClipping ? '(CLIP ROUGE!)' : ''}`,
      12,
      24
    );
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '13px monospace';
    ctx.fillText(
      `XLR:${ev.xlrMicOk ? 'OK' : 'NON'}  +48V:${state.phantom48v ? 'ON' : 'OFF'}  HPF80:${state.hpf80 ? 'ON' : 'OFF'}`,
      12,
      114
    );
    texture.needsUpdate = true;
  }

  function syncStudio3D() {
    const ev = evaluateRegie();
    focusRing.rotation.z = (state.focus / 100) * 1.8;
    irisRing.rotation.z = (state.iris / 100) * 1.8;
    wbRing.rotation.z = ((state.kelvin - 2800) / 4400) * 1.8;

    const wbNorm = (state.kelvin - 2800) / 4400;
    const lightCol = new THREE.Color().setHSL(0.08 + wbNorm * 0.48, Math.abs(wbNorm - 0.64) * 0.75, 0.72);
    const irisInt = 0.55 + (state.iris / 100) * 1.4;
    studioSpot.color.copy(lightCol);
    studioSpot.intensity = irisInt;
    for (const dm of softboxDiffuserMats) {
      dm.color.copy(lightCol);
      dm.emissive.copy(lightCol);
      dm.emissiveIntensity = 0.35 + (state.iris / 100) * 0.65;
    }

    const camOnAir = ev.sdiPgmOk && state.pgmSrc === 'CAM-1';
    tallyMat.color.setHex(camOnAir ? 0xef4444 : 0x334155);
    tallyMat.emissive.setHex(camOnAir ? 0xef4444 : 0x000000);
    tallyMat.emissiveIntensity = camOnAir ? 0.85 : 0;

    for (const item of audioKnobs) {
      const val = state[item.def.key];
      const localZ = 0.095 - (val / 100) * 0.13;
      item.knob.position.z = localZ;
      item.knob.position.y = 0.092 - (localZ - 0.03) * Math.sin(0.15);
    }

    btn48Mat.color.setHex(state.phantom48v ? 0x22c55e : 0x334155);
    btn48Mat.emissive.setHex(state.phantom48v ? 0x15803d : 0x000000);
    btn48Mat.emissiveIntensity = state.phantom48v ? 0.65 : 0;

    btnHpfMat.color.setHex(state.hpf80 ? 0x38bdf8 : 0x334155);
    btnHpfMat.emissive.setHex(state.hpf80 ? 0x0284c7 : 0x000000);
    btnHpfMat.emissiveIntensity = state.hpf80 ? 0.65 : 0;

    for (const s of atemSources) {
      const mat = srcButtons[s.id];
      const isPgm = ev.sdiPgmOk && state.pgmSrc === s.id;
      const isPrev = state.previewSrc === s.id;
      mat.color.setHex(isPgm ? 0xef4444 : isPrev ? 0x22c55e : 0x334155);
      mat.emissive.setHex(isPgm ? 0x991b1b : isPrev ? 0x15803d : 0x000000);
      mat.emissiveIntensity = isPgm || isPrev ? 0.65 : 0;
    }

    const validNext = getValidStudioTargetPort(state.selectedPort);
    for (const [pid, port] of Object.entries(studioPorts)) {
      const isSel = state.selectedPort === pid;
      const isNext = validNext === pid;
      const isConn = STUDIO_PATCH_LINKS.some(
        (lk) => state.cablesDone.has(lk.id) && (lk.fromId === pid || lk.toId === pid)
      );
      port.mesh.material.color.setHex(
        isSel ? 0xfbbf24 : isNext ? 0x22d3ee : isConn ? 0x22c55e : port.baseHex
      );
      port.mesh.material.emissive.setHex(
        isSel ? 0xf59e0b : isNext ? 0x06b6d4 : isConn ? 0x15803d : 0x000000
      );
      port.mesh.material.emissiveIntensity = isSel ? 0.85 : isNext ? 0.8 : isConn ? 0.45 : 0;
    }

    drawMultiviewAndVu();
  }

  function setCameraById(id) {
    const cam = CAM_VIEWS.find((c) => c.id === id) || CAM_VIEWS[0];
    state.camId = cam.id;
    bench.resetInteractionState?.();
    bench.setCameraView(cam.pos, cam.lookAt, cam.fov);
    bench.setCameras(CAM_VIEWS, cam.id, setCameraById);
  }

  function computeCurrentEstimatedScore(ev) {
    return computeStudioRegieScore3D({
      cablesConnected: ev.cablesConnected,
      patchAllOk: ev.patchAllOk,
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
  }

  let lastStageKey = '';
  function syncStagesBar(ev) {
    const stageIdx = !ev.patchAllOk ? 0 : !ev.opticsAllOk ? 1 : !ev.audioAllOk ? 2 : 3;
    const stages = [
      { name: `1. Câblage SDI/XLR (${ev.cablesConnected}/3)` },
      { name: `2. Optique & Chroma (${ev.opticsAllOk ? 'OK' : 'À régler'})` },
      { name: `3. Audio (${ev.xlrMicOk ? `${ev.peakDb.toFixed(0)} dBFS` : 'XLR?'})` },
      { name: `4. Direct ATEM (${ev.cuesCompleted}/3)` }
    ];
    const nextKey = `${stageIdx}|${stages.map((s) => s.name).join('|')}`;
    if (nextKey === lastStageKey) return;
    lastStageKey = nextKey;
    api.setStages(stages, stageIdx, (idx) => {
      if (idx === 0) setCameraById('cabling');
      else if (idx === 1) setCameraById('camera');
      else if (idx === 2) setCameraById('audio');
      else setCameraById('atem');
    });
  }

  function syncLiveUiWithoutRebuild() {
    const ev = evaluateRegie();
    const estScore = computeCurrentEstimatedScore(ev);
    const subMsg = state.selectedPort
      ? `Connecteur sélectionné : ${studioPorts[state.selectedPort]?.label} — cliquez la prise destination.`
      : ev.teacherAdvice;
    bench.setInstruction(
      'ATELIER RÉGIE BROADCAST, CAMÉRA & MIXAGE SON 3D',
      `SDI/XLR ${ev.cablesConnected}/3 • PGM: ${ev.sdiPgmOk ? state.pgmSrc : 'OFF'} • Son: ${ev.xlrMicOk ? `${ev.peakDb.toFixed(1)} dBFS` : 'OFF'} • Tops ${ev.cuesCompleted}/3`,
      subMsg
    );
    bench.setAccuracy(`Note est. ${estScore.toFixed(1)}/20`);
    syncStagesBar(ev);

    const profEl = api.container.querySelector('#studio-prof-advice');
    if (profEl) profEl.textContent = ev.teacherAdvice;

    const optBtn = api.container.querySelector('#studio-cal-optics');
    if (optBtn) {
      optBtn.textContent = ev.opticsAllOk ? '✔ Optique OK' : 'Auto-Calibrer';
      optBtn.className = `av-btn compact ${ev.opticsAllOk ? 'success' : 'primary'}`;
    }
    const audBtn = api.container.querySelector('#studio-cal-audio');
    if (audBtn) {
      audBtn.textContent = ev.audioAllOk ? '✔ Son -12 dB OK' : 'Calibrer -12 dB';
      audBtn.className = `av-btn compact ${ev.audioAllOk ? 'success' : 'purple'}`;
    }

    const dbEl = api.container.querySelector('#studio-db-header');
    if (dbEl) {
      dbEl.textContent = `3. MIXAGE AUDIO (${ev.xlrMicOk ? `${ev.peakDb.toFixed(1)} dBFS` : 'XLR NON BRANCHÉ'} ${ev.audioLevelOk ? '✔ OPTIMAL' : ''})`;
      dbEl.style.color = ev.audioLevelOk ? '#4ade80' : ev.audioClipping || !ev.xlrMicOk ? '#f87171' : '#c084fc';
    }

    const checks = {
      focus: ev.focusOk,
      iris: ev.irisOk,
      kelvin: ev.wbOk,
      chromaKey: ev.chromaOk
    };
    for (const key of ['focus', 'iris', 'kelvin', 'chromaKey', 'micCravate', 'micAmbiance', 'music', 'masterAudio']) {
      const span = api.container.querySelector(`[data-cam-val="${key}"]`);
      if (span) {
        span.textContent = key === 'kelvin' ? `${state[key]}K` : `${state[key]}%`;
        if (key in checks) {
          span.style.color = checks[key] ? '#4ade80' : '#fbbf24';
        }
      }
      const inp = api.container.querySelector(`input[data-cam="${key}"]`);
      if (inp && document.activeElement !== inp) {
        inp.value = String(state[key]);
      }
    }
    const curCue = CUE_LIST[state.cueIdx];
    bench.setVrExtras?.({
      statusLines: [
        `Audio: ${ev.xlrMicOk ? `${ev.peakDb.toFixed(1)} dBFS` : 'XLR?'} | ${curCue ? curCue.label : 'Tous les Tops ATEM validés ✔'}`
      ]
    });
    bench.refreshDrawerControls?.();
  }

  function updateSidebar() {
    const ev = evaluateRegie();
    const curCue = CUE_LIST[state.cueIdx];

    const patchRows = STUDIO_PATCH_LINKS.map((lk) => {
      const ok = state.cablesDone.has(lk.id);
      return `<div class="av-link-row ${ok ? 'ok' : 'pending'}"><span>${lk.label}</span><strong>${ok ? '✔ Relié' : 'À relier'}</strong></div>`;
    }).join('');

    const drawer = bench.setSideDrawer(`
      <div class="av-drawer-shell">
        <div id="studio-prof-advice" class="av-prof-banner">${ev.teacherAdvice}</div>

        <div class="av-step-header">
          <span class="av-step-title cyan">1. PATCH SDI & XLR STUDIO (${ev.cablesConnected}/3)</span>
          <button type="button" id="studio-patch-btn" class="av-btn compact ${ev.patchAllOk ? 'success' : 'primary'}">${ev.patchAllOk ? '✔ Patch 3/3 OK' : '🔌 Relier câble'}</button>
        </div>
        <div class="av-link-list">${patchRows}</div>

        <div class="av-step-header">
          <span class="av-step-title cyan">2. OPTIQUE CAMÉRA & CHROMA KEY</span>
          <button type="button" id="studio-cal-optics" class="av-btn compact ${ev.opticsAllOk ? 'success' : 'primary'}">${ev.opticsAllOk ? '✔ Optique OK' : 'Auto-Calibrer'}</button>
        </div>
        <label class="av-slider-row">
          <span class="av-slider-lbl">Focus (72%)</span>
          <input type="range" min="0" max="100" value="${state.focus}" data-cam="focus" data-vr-label="Focus (72%)" data-vr-unit="%" />
          <span data-cam-val="focus" class="av-slider-val" style="color:${ev.focusOk ? '#4ade80' : '#fbbf24'};">${state.focus}%</span>
        </label>
        <label class="av-slider-row">
          <span class="av-slider-lbl">Iris (56%)</span>
          <input type="range" min="0" max="100" value="${state.iris}" data-cam="iris" data-vr-label="Iris (56%)" data-vr-unit="%" />
          <span data-cam-val="iris" class="av-slider-val" style="color:${ev.irisOk ? '#4ade80' : '#fbbf24'};">${state.iris}%</span>
        </label>
        <label class="av-slider-row">
          <span class="av-slider-lbl">WB (5600K)</span>
          <input type="range" min="2800" max="7200" step="50" value="${state.kelvin}" data-cam="kelvin" data-vr-label="WB (5600K)" data-vr-unit="K" />
          <span data-cam-val="kelvin" class="av-slider-val" style="color:${ev.wbOk ? '#4ade80' : '#fbbf24'};">${state.kelvin}K</span>
        </label>
        <label class="av-slider-row">
          <span class="av-slider-lbl">Chroma (84%)</span>
          <input type="range" min="0" max="100" value="${state.chromaKey}" data-cam="chromaKey" data-vr-label="Chroma (84%)" data-vr-unit="%" />
          <span data-cam-val="chromaKey" class="av-slider-val" style="color:${ev.chromaOk ? '#4ade80' : '#fbbf24'};">${state.chromaKey}%</span>
        </label>

        <div class="av-step-header">
          <span id="studio-db-header" class="av-step-title purple" style="color:${ev.audioLevelOk ? '#4ade80' : ev.audioClipping || !ev.xlrMicOk ? '#f87171' : '#c084fc'};">3. MIXAGE AUDIO (${ev.xlrMicOk ? `${ev.peakDb.toFixed(1)} dBFS` : 'XLR?'} ${ev.audioLevelOk ? '✔ OPTIMAL' : ''})</span>
          <button type="button" id="studio-cal-audio" class="av-btn compact ${ev.audioAllOk ? 'success' : 'purple'}">${ev.audioAllOk ? '✔ Son -12 dB OK' : 'Calibrer -12 dB'}</button>
        </div>
        <div class="av-btn-row">
          <button type="button" data-btn="48v" class="av-btn ${state.phantom48v ? 'success' : 'neutral'}">+48V (${state.phantom48v ? 'ON' : 'OFF'})</button>
          <button type="button" data-btn="hpf" class="av-btn ${state.hpf80 ? 'primary' : 'neutral'}">HPF 80Hz (${state.hpf80 ? 'ON' : 'OFF'})</button>
        </div>
        <label class="av-slider-row">
          <span class="av-slider-lbl">Cravate (78%)</span>
          <input type="range" min="0" max="100" value="${state.micCravate}" data-cam="micCravate" data-vr-label="Cravate (78%)" data-vr-unit="%" />
          <span data-cam-val="micCravate" class="av-slider-val">${state.micCravate}%</span>
        </label>
        <label class="av-slider-row">
          <span class="av-slider-lbl">Ambiance (25%)</span>
          <input type="range" min="0" max="100" value="${state.micAmbiance}" data-cam="micAmbiance" data-vr-label="Ambiance (25%)" data-vr-unit="%" />
          <span data-cam-val="micAmbiance" class="av-slider-val">${state.micAmbiance}%</span>
        </label>
        <label class="av-slider-row">
          <span class="av-slider-lbl">Musique (25%)</span>
          <input type="range" min="0" max="100" value="${state.music}" data-cam="music" data-vr-label="Musique (25%)" data-vr-unit="%" />
          <span data-cam-val="music" class="av-slider-val">${state.music}%</span>
        </label>
        <label class="av-slider-row">
          <span class="av-slider-lbl">Master (80%)</span>
          <input type="range" min="0" max="100" value="${state.masterAudio}" data-cam="masterAudio" data-vr-label="Master (80%)" data-vr-unit="%" />
          <span data-cam-val="masterAudio" class="av-slider-val">${state.masterAudio}%</span>
        </label>

        <div class="av-step-header">
          <span class="av-step-title rose">4. RÉALISATION ATEM (${ev.cuesCompleted}/3)</span>
          <button type="button" id="studio-side-cut" class="av-btn compact danger">CUT / TAKE (${state.previewSrc})</button>
        </div>
        <div class="av-cue-box">
          ${CUE_LIST.map((c) => {
            const done = state.cuesDone.has(c.id);
            const active = c.id === curCue?.id && !done;
            return `<div class="av-cue-row ${done ? 'done' : active ? 'active' : ''}">${done ? '✔ ' : active ? '► ' : ''}${c.label}</div>`;
          }).join('')}
        </div>
      </div>
    `);

    if (!drawer) return;
    drawer.querySelector('#studio-patch-btn')?.addEventListener('click', connectNextStudioCable);
    drawer.querySelector('#studio-cal-optics')?.addEventListener('click', calibrateOpticsAndChroma);
    drawer.querySelector('#studio-cal-audio')?.addEventListener('click', calibrateAudioConsole);
    drawer.querySelector('#studio-side-cut')?.addEventListener('click', executeTakeCut);

    drawer.querySelectorAll('[data-cam]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const key = inp.dataset.cam;
        state[key] = Number(inp.value);
        playThrottledTick(Number(inp.value) / (Number(inp.max) || 100));
        syncStudio3D();
        syncLiveUiWithoutRebuild();
      });
      inp.addEventListener('change', () => refreshUi());
    });
    const b48 = drawer.querySelector('[data-btn="48v"]');
    if (b48) {
      b48.addEventListener('click', togglePhantom48v);
    }
    const bhpf = drawer.querySelector('[data-btn="hpf"]');
    if (bhpf) {
      bhpf.addEventListener('click', toggleHpf80);
    }
  }

  function submitStudioTp() {
    if (state.submitted) return;
    state.submitted = true;
    const finalEv = evaluateRegie();
    const finalScore = computeStudioRegieScore3D({
      cablesConnected: finalEv.cablesConnected,
      patchAllOk: finalEv.patchAllOk,
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
    api.finishTp(
      finalScore,
      `
        <p>Atelier Régie Broadcast, Caméra & Mixage Son évalué par le <strong>Professeur CIEL</strong> :</p>
        <ul>
          <li>Liaisons SDI & XLR plateau : <strong>${finalEv.cablesConnected}/3 câbles raccordés</strong></li>
          <li>Optique Caméra & Fond Vert : <strong>${finalEv.focusOk && finalEv.irisOk && finalEv.wbOk ? 'Optique 5600K OK ✔' : 'Optique à affiner'} • Chroma Key ${finalEv.chromaOk ? 'Propre ✔' : 'Incomplet'}</strong></li>
          <li>Console Audio Broadcast : <strong>${finalEv.xlrMicOk ? `${finalEv.peakDb.toFixed(1)} dBFS` : 'Micro débranché'} (${finalEv.audioLevelOk ? 'Dans la cible -14 à -10 dBFS ✔' : 'Hors plage'}) • +48V ${state.phantom48v ? 'ON' : 'OFF'} • HPF 80Hz ${state.hpf80 ? 'ON' : 'OFF'}</strong></li>
          <li>Conduite Direct ATEM : <strong>${finalEv.cuesCompleted}/3 tops d’antenne exécutés</strong></li>
        </ul>
      `
    );
  }

  function refreshUi() {
    const ev = evaluateRegie();
    const estScore = computeCurrentEstimatedScore(ev);
    syncStagesBar(ev);

    const subMsg = state.selectedPort
      ? `Connecteur sélectionné : ${studioPorts[state.selectedPort]?.label} — cliquez la prise destination.`
      : ev.teacherAdvice;

    bench.setInstruction(
      'ATELIER RÉGIE BROADCAST, CAMÉRA & MIXAGE SON 3D',
      `SDI/XLR ${ev.cablesConnected}/3 • PGM: ${ev.sdiPgmOk ? state.pgmSrc : 'OFF'} • Son: ${ev.xlrMicOk ? `${ev.peakDb.toFixed(1)} dBFS` : 'OFF'} • Tops ${ev.cuesCompleted}/3`,
      subMsg
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
        sfx.sdiPatch();
        syncStudio3D();
        refreshUi();
      }
    );

    bench.setActions([
      {
        id: 'patch-step-btn',
        label: ev.patchAllOk ? 'Patch SDI/XLR OK' : `Câbler SDI/XLR (${ev.cablesConnected}/3)`,
        primary: !ev.patchAllOk,
        onClick: connectNextStudioCable
      },
      {
        id: 'take-btn',
        label: `CUT / TAKE (${state.previewSrc})`,
        primary: ev.patchAllOk && ev.cuesCompleted < 3,
        danger: true,
        onClick: executeTakeCut
      },
      {
        id: 'finish-btn',
        label: 'Clôturer Direct',
        primary: ev.allValid,
        disabled: state.submitted,
        onClick: submitStudioTp
      }
    ]);

    updateSidebar();
  }

  bench.addFloatingTag([0.14, 0.56, -0.35], 'Mur Multiview (Cam1 / Cam2 / Key / PGM)', 'info');
  bench.addFloatingTag([-0.56, 0.44, 0.08], 'Caméra Focus / Iris / WB', 'info');
  bench.addFloatingTag([0.04, 0.16, 0.22], 'Console Audio & VU-Mètres', 'info');
  bench.addFloatingTag([0.62, 0.15, 0.22], 'Mélangeur ATEM', 'info');

  let talkPhase = 0;
  let drawAccum = 0;
  const unsubTick = bench.addUpdate((dt) => {
    state.vuPhase += dt * 3;
    talkPhase += dt;
    drawAccum += dt;
    studioPresenter.group.rotation.y = Math.sin(talkPhase * 0.9) * 0.16;
    if (studioPresenter.rightArm) studioPresenter.rightArm.rotation.x = -0.3 + Math.sin(talkPhase * 2.2) * 0.18;
    if (drawAccum >= 0.045) {
      drawAccum = 0;
      drawMultiviewAndVu();
    }
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
