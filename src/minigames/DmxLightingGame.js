import * as THREE from 'three';
import { sfx } from '../core/audio.js';
import { buildStudentAvatarMesh } from '../world/AvatarBuilder.js';
import {
  createWorkbench3D,
  makeCanvasScreen,
  buildFlexibleCable
} from './Workbench3DHost.js';

function toSafeNum(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function clamp20(raw) {
  const n = toSafeNum(raw, 0);
  return Math.max(0, Math.min(20, Math.round(n * 2) / 2));
}

export const FIXTURE_SPECS = [
  {
    id: 0,
    code: 'PAR-1',
    role: 'Key Light (Face)',
    x: -0.57,
    startAddr: 1,
    targetAddr: 1,
    target: { master: 90, r: 255, g: 235, b: 210, pan: 58, tilt: 56 },
    hint: 'Blanc chaud centré : Master ~90, R ~255, G ~235, B ~210, Pan ~58, Tilt ~56'
  },
  {
    id: 1,
    code: 'MOV-2',
    role: 'Fill Bleu Studio',
    x: -0.19,
    startAddr: 4,
    targetAddr: 9,
    target: { master: 80, r: 30, g: 120, b: 255, pan: 52, tilt: 52 },
    hint: 'Bleu profond : Master ~80, R < 75, B ~255, Pan ~52, Tilt ~52'
  },
  {
    id: 2,
    code: 'MOV-3',
    role: 'Contre Magenta',
    x: 0.19,
    startAddr: 17,
    targetAddr: 17,
    target: { master: 85, r: 255, g: 50, b: 190, pan: 46, tilt: 52 },
    hint: 'Magenta scénique : Master ~85, R ~255, G < 95, B ~190, Pan ~46, Tilt ~52'
  },
  {
    id: 3,
    code: 'PAR-4',
    role: 'Wash Émeraude',
    x: 0.57,
    startAddr: 20,
    targetAddr: 25,
    target: { master: 80, r: 20, g: 240, b: 145, pan: 42, tilt: 50 },
    hint: 'Émeraude plateau : Master ~80, R < 65, G ~240, B ~145, Pan ~42, Tilt ~50'
  }
];

export const DMX_FIXTURE_SPECS = FIXTURE_SPECS;

export const DAISY_LINKS = [
  { id: 0, fromId: 'CONSOLE_OUT', toId: 'P0_IN', label: 'Pupitre DMX OUT → PAR-1 IN' },
  { id: 1, fromId: 'P0_OUT', toId: 'P1_IN', label: 'PAR-1 OUT → MOV-2 IN' },
  { id: 2, fromId: 'P1_OUT', toId: 'P2_IN', label: 'MOV-2 OUT → MOV-3 IN' },
  { id: 3, fromId: 'P2_OUT', toId: 'P3_IN', label: 'MOV-3 OUT → PAR-4 IN' }
];

export const DMX_DAISY_LINKS = DAISY_LINKS;

export function evaluateDmxConfiguration(state = {}) {
  const s = state && typeof state === 'object' ? state : {};
  let cablesConnected = 0;
  if (s.cablesDone instanceof Set) {
    cablesConnected = s.cablesDone.size;
  } else if (Array.isArray(s.cablesDone)) {
    cablesConnected = new Set(s.cablesDone).size;
  } else if (s.cablesConnected !== undefined) {
    cablesConnected = Math.max(0, Math.min(4, Math.round(toSafeNum(s.cablesConnected, 0))));
  }
  cablesConnected = Math.max(0, Math.min(DAISY_LINKS.length, cablesConnected));
  const terminatorInstalled = Boolean(s.terminatorInstalled);
  const daisyOk = cablesConnected === DAISY_LINKS.length && terminatorInstalled;

  const rawFixtures = Array.isArray(s.fixtures) ? s.fixtures : [];
  const fixtures = FIXTURE_SPECS.map((sp, idx) => {
    const raw = rawFixtures[idx] && typeof rawFixtures[idx] === 'object' ? rawFixtures[idx] : {};
    return {
      addr: Math.max(1, Math.min(512, Math.round(toSafeNum(raw.addr, sp.startAddr)))),
      master: Math.max(0, Math.min(100, Math.round(toSafeNum(raw.master, 20)))),
      r: Math.max(0, Math.min(255, Math.round(toSafeNum(raw.r, 120)))),
      g: Math.max(0, Math.min(255, Math.round(toSafeNum(raw.g, 120)))),
      b: Math.max(0, Math.min(255, Math.round(toSafeNum(raw.b, 120)))),
      pan: Math.max(0, Math.min(100, Math.round(toSafeNum(raw.pan, 25)))),
      tilt: Math.max(0, Math.min(100, Math.round(toSafeNum(raw.tilt, 25))))
    };
  });

  let overlaps = 0;
  const conflictingIds = new Set();
  for (let i = 0; i < fixtures.length; i++) {
    for (let j = i + 1; j < fixtures.length; j++) {
      if (Math.abs(fixtures[i].addr - fixtures[j].addr) < 8) {
        overlaps += 1;
        conflictingIds.add(i);
        conflictingIds.add(j);
      }
    }
  }

  let exactAddressesCount = 0;
  let matchedFixtures = 0;
  let aimScore = 0;
  const fixtureResults = [];

  for (let i = 0; i < FIXTURE_SPECS.length; i++) {
    const sp = FIXTURE_SPECS[i];
    const fx = fixtures[i];
    const t = sp.target;

    const addrExact = fx.addr === sp.targetAddr;
    if (addrExact) exactAddressesCount += 1;
    const addrClean = !conflictingIds.has(i);

    const colorOk =
      fx.master >= 60 &&
      Math.abs(fx.r - t.r) <= 55 &&
      Math.abs(fx.g - t.g) <= 55 &&
      Math.abs(fx.b - t.b) <= 55;
    const aimOk = Math.abs(fx.pan - t.pan) <= 18 && Math.abs(fx.tilt - t.tilt) <= 18;
    if (aimOk) aimScore += 1;

    const ok = daisyOk && addrClean && addrExact && colorOk && aimOk;
    if (ok) matchedFixtures += 1;
    fixtureResults.push({ ok, colorOk, aimOk, addrExact, addrClean });
  }

  const dmxNoOverlap = overlaps === 0;
  const allValid = daisyOk && dmxNoOverlap && exactAddressesCount === 4 && matchedFixtures === 4;

  let teacherAdvice = '';
  if (!daisyOk) {
    if (cablesConnected < 4) {
      teacherAdvice = `Professeur CIEL : « Relie en série (Daisy-Chain XLR) la sortie du pupitre vers PAR-1, puis chaque projecteur OUT → IN (${cablesConnected}/4 câblés). »`;
    } else {
      teacherAdvice = 'Professeur CIEL : « Les 4 liaisons XLR sont branchées ! Installe maintenant le bouchon de terminaison 120 Ω sur la sortie de PAR-4 pour supprimer les échos DMX. »';
    }
  } else if (exactAddressesCount < 4 || !dmxNoOverlap) {
    teacherAdvice = `Professeur CIEL : « Chaque projecteur utilise 8 canaux DMX512. Configure les adresses cibles sans chevauchement : A001, A009, A017 et A025 (${exactAddressesCount}/4 exactes). »`;
  } else if (matchedFixtures < 4) {
    teacherAdvice = `Professeur CIEL : « Bus et adressage DMX impeccables ! Règle maintenant Master, RGB, Pan et Tilt sur les 4 projecteurs (${matchedFixtures}/4 conformes). »`;
  } else {
    teacherAdvice = 'Professeur CIEL : « Parfait ! Le bus XLR 120 Ω, l’adressage DMX512 et les 4 projecteurs sont 100 % conformes. Valide la scène pour décrocher 20/20 ! »';
  }

  return {
    cablesConnected,
    terminatorInstalled,
    daisyOk,
    overlaps,
    conflictingIds,
    dmxNoOverlap,
    exactAddressesCount,
    matchedFixtures,
    aimScore,
    fixtureResults,
    allValid,
    teacherAdvice
  };
}

export function computeDmxScore3D(metrics = {}) {
  const m = metrics && typeof metrics === 'object' ? metrics : {};
  const hasStage1Metrics =
    m.cablesConnected !== undefined || m.terminatorInstalled !== undefined;

  if (hasStage1Metrics) {
    const cables = Math.max(0, Math.min(4, toSafeNum(m.cablesConnected, 0)));
    const termOk = Boolean(m.terminatorInstalled);
    const exactAddr = Math.max(0, Math.min(4, toSafeNum(m.exactAddressesCount, 0)));
    const noOverlap = Boolean(m.dmxNoOverlap);
    const matchedFixtures = Math.max(0, Math.min(4, toSafeNum(m.matchedFixtures, 0)));
    const aim = Math.max(0, Math.min(4, toSafeNum(m.aimScore, 0)));

    const cablePts = (cables / 4) * 4.5;
    const termPts = termOk ? 2.0 : 0;
    const addrPts = (exactAddr / 4) * 4.0 + (noOverlap ? 1.5 : 0);
    const scenePts = (matchedFixtures / 4) * 6.0 + (aim / 4) * 2.0;

    const allMet =
      cables >= 4 &&
      termOk &&
      exactAddr >= 4 &&
      noOverlap &&
      matchedFixtures >= 4 &&
      aim >= 4;

    if (allMet) {
      return 20;
    }

    const elapsed = Math.max(0, toSafeNum(m.elapsedSec, 120));
    const bonus = elapsed < 100 ? 0.5 : 0;
    const raw = cablePts + termPts + addrPts + scenePts + bonus;
    return clamp20(raw);
  }

  const noConflicts = Boolean(m.dmxNoOverlap);
  const overlapCount = Math.max(0, toSafeNum(m.overlapCount, 2));
  const conflictPts = noConflicts ? 5 : Math.max(0, 5 - overlapCount * 2);
  const matchedFixtures = Math.max(0, Math.min(4, toSafeNum(m.matchedFixtures, 0)));
  const faderPts = (matchedFixtures / 4) * 11;
  const aimPts = Math.max(0, Math.min(4, toSafeNum(m.aimScore, 0)));

  if (noConflicts && matchedFixtures >= 4 && aimPts >= 4) {
    return 20;
  }

  const elapsed = Math.max(0, toSafeNum(m.elapsedSec, 90));
  const bonus = elapsed < 80 ? 0.5 : 0;
  const raw = conflictPts + faderPts + aimPts + bonus;
  return clamp20(raw);
}

const CAM_VIEWS = [
  { id: 'overview', label: 'Vue Scène Globale', pos: [0.0, 1.02, 1.66], lookAt: [0, 0.38, -0.05], fov: 42 },
  { id: 'cabling', label: 'Câblage XLR & Bouchon', pos: [0.06, 0.96, 1.12], lookAt: [0.04, 0.62, -0.24], fov: 40 },
  { id: 'address', label: 'Écrans Arrière DMX', pos: [0.0, 0.82, -1.26], lookAt: [0, 0.64, -0.36], fov: 38 },
  { id: 'console', label: 'Pupitre Faders DMX', pos: [0.0, 0.58, 0.84], lookAt: [0, 0.08, 0.25], fov: 36 }
];

export function createDmxLightingGame(api) {
  const bench = createWorkbench3D(api.container, {
    cameraPos: CAM_VIEWS[0].pos,
    lookAt: CAM_VIEWS[0].lookAt,
    fov: CAM_VIEWS[0].fov,
    hasEsdMat: false,
    benchColor: '#1e293b',
    wallColor: '#0f172a',
    background: '#162032',
    envIntensity: 0.52
  });

  const regieCarpet = new THREE.Mesh(
    new THREE.BoxGeometry(2.04, 0.012, 1.12),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85, metalness: 0.08 })
  );
  regieCarpet.position.set(0, 0.006, 0.04);
  regieCarpet.receiveShadow = true;
  bench.scene.add(regieCarpet);

  const stageFloor = new THREE.Mesh(
    new THREE.BoxGeometry(1.58, 0.05, 0.62),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.36, metalness: 0.32 })
  );
  stageFloor.position.set(0, 0.032, -0.22);
  stageFloor.receiveShadow = true;
  stageFloor.castShadow = true;
  bench.scene.add(stageFloor);

  const stageRim = new THREE.Mesh(
    new THREE.BoxGeometry(1.61, 0.016, 0.64),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.45, roughness: 0.3 })
  );
  stageRim.position.set(0, 0.016, -0.22);
  bench.scene.add(stageRim);

  const artistAvatar = buildStudentAvatarMesh({
    outfitColor: '#f8fafc',
    outfitStyle: 'cyber',
    hat: 'headset',
    skinTone: '#f1c29b',
    pantsColor: '#1e293b'
  });
  artistAvatar.group.scale.setScalar(0.24);
  artistAvatar.group.position.set(0, 0.058, -0.22);
  bench.scene.add(artistAvatar.group);

  const micStandPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.005, 0.32, 10),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.25 })
  );
  micStandPole.position.set(0.07, 0.22, -0.15);
  const micHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.013, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.85, roughness: 0.22 })
  );
  micHead.position.set(0.055, 0.38, -0.16);
  bench.scene.add(micStandPole, micHead);

  const state = {
    camId: 'overview',
    selectedFixture: 0,
    selectedPort: null,
    cablesDone: new Set(),
    terminatorInstalled: false,
    fixtures: FIXTURE_SPECS.map((sp) => ({
      addr: sp.startAddr,
      master: 20,
      r: 120,
      g: 120,
      b: 120,
      pan: 25,
      tilt: 25
    })),
    glitchPhase: 0,
    startMs: performance.now(),
    submitted: false
  };

  function evaluateDmx() {
    return evaluateDmxConfiguration(state);
  }

  const trussGroup = new THREE.Group();
  trussGroup.position.set(0, 0.014, -0.38);
  bench.scene.add(trussGroup);

  const metalMat = new THREE.MeshStandardMaterial({ color: 0xdbe3ed, roughness: 0.24, metalness: 0.88 });
  for (const tx of [-0.82, 0.82]) {
    for (const tz of [-0.025, 0.025]) {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.88, 10), metalMat);
      tube.position.set(tx, 0.44, tz);
      tube.castShadow = true;
      trussGroup.add(tube);
    }
    const basePlate = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.14), metalMat);
    basePlate.position.set(tx, 0.01, 0);
    trussGroup.add(basePlate);
  }
  for (const oy of [-0.024, 0.024]) {
    for (const oz of [-0.024, 0.024]) {
      const chord = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 1.72, 10), metalMat);
      chord.rotation.z = Math.PI / 2;
      chord.position.set(0, 0.86 + oy, oz);
      chord.castShadow = true;
      trussGroup.add(chord);
    }
  }
  for (let i = -7; i <= 7; i++) {
    const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.072, 6), metalMat);
    brace.position.set(i * 0.105, 0.86, 0.024);
    brace.rotation.z = i % 2 === 0 ? 0.65 : -0.65;
    trussGroup.add(brace);
  }

  const xlrPorts = {};
  const fixtureObjects = [];

  function createXlrSocket(parent, localPos, portId, label, isInput = false) {
    const baseHex = isInput ? 0x38bdf8 : 0x0ea5e9;
    const holder = new THREE.Group();
    holder.position.copy(localPos);
    parent.add(holder);

    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.022, 18),
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
      new THREE.SphereGeometry(0.036, 10, 10),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    holder.add(hitMesh);

    const worldAnchor = new THREE.Object3D();
    holder.add(worldAnchor);
    xlrPorts[portId] = { mesh: ring, anchor: worldAnchor, label, baseHex };

    bench.addInteractive(holder, {
      label: `Port XLR ${label}`,
      cursor: 'pointer',
      highlightTargets: [ring],
      onClick: () => handlePortClick(portId)
    });
    return holder;
  }

  function makeButtonLabelTexture(text, bgHex = '#334155', fgHex = '#f8fafc') {
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, 96, 64);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 92, 60);
    ctx.fillStyle = fgHex;
    ctx.font = 'bold 34px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 48, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function isFixtureChainPowered(idx) {
    for (let k = 0; k <= idx; k++) {
      if (!state.cablesDone.has(k)) return false;
    }
    return true;
  }

  function getValidNextTargetPort(fromPortId) {
    if (!fromPortId) return null;
    for (const lk of DAISY_LINKS) {
      if (state.cablesDone.has(lk.id)) continue;
      if (lk.fromId === fromPortId) return lk.toId;
      if (lk.toId === fromPortId) return lk.fromId;
    }
    return null;
  }

  const minusBtnTex = bench.track(makeButtonLabelTexture('-1', '#334155', '#f8fafc'));
  const plusBtnTex = bench.track(makeButtonLabelTexture('+1', '#0284c7', '#ffffff'));

  for (let i = 0; i < FIXTURE_SPECS.length; i++) {
    const sp = FIXTURE_SPECS[i];
    const mount = new THREE.Group();
    mount.position.set(sp.x, 0.82, 0.02);
    trussGroup.add(mount);

    const podBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.11, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.38, metalness: 0.65 })
    );
    podBox.position.set(0, 0.02, -0.02);
    podBox.castShadow = true;
    mount.add(podBox);

    createXlrSocket(podBox, new THREE.Vector3(-0.064, 0.062, 0.016), `P${i}_IN`, `${sp.code} DMX IN`, true);
    createXlrSocket(podBox, new THREE.Vector3(0.064, 0.062, 0.016), `P${i}_OUT`, `${sp.code} DMX OUT`, false);

    const rearScreen = makeCanvasScreen(192, 96, (ctx, w, h) => {
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, w, h);
    });
    const rearBezel = new THREE.Mesh(
      new THREE.BoxGeometry(0.128, 0.064, 0.008),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: 0x000000, roughness: 0.4 })
    );
    rearBezel.position.set(0, 0.024, -0.051);
    podBox.add(rearBezel);
    const rearScrMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.116, 0.054),
      new THREE.MeshBasicMaterial({ map: rearScreen.texture })
    );
    rearScrMesh.rotation.y = Math.PI;
    rearScrMesh.position.set(0, 0.024, -0.056);
    podBox.add(rearScrMesh);

    bench.addInteractive(rearScrMesh, {
      label: () => `${sp.code} Écran DMX (Cliquer pour calibrer A${String(sp.targetAddr).padStart(3, '0')})`,
      cursor: 'pointer',
      highlightTargets: [rearBezel, rearScrMesh],
      onClick: () => {
        state.selectedFixture = i;
        state.fixtures[i].addr = sp.targetAddr;
        sfx.dmxAddressBeep(true);
        bench.showToast(`${sp.code} adressé sur A${String(sp.targetAddr).padStart(3, '0')} !`, 'success');
        syncDmx3D();
        refreshUi();
      }
    });

    const frontScreen = makeCanvasScreen(192, 72, (ctx, w, h) => {
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, w, h);
    });
    const frontBezel = new THREE.Mesh(
      new THREE.BoxGeometry(0.132, 0.052, 0.008),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: 0x000000, roughness: 0.4 })
    );
    frontBezel.position.set(0, 0.015, 0.051);
    podBox.add(frontBezel);
    const frontScrMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.122, 0.044),
      new THREE.MeshBasicMaterial({ map: frontScreen.texture })
    );
    frontScrMesh.position.set(0, 0.015, 0.056);
    podBox.add(frontScrMesh);

    bench.addInteractive(frontScrMesh, {
      label: () => `${sp.code} OLED DMX (Cliquer pour adresser A${String(sp.targetAddr).padStart(3, '0')})`,
      cursor: 'pointer',
      highlightTargets: [frontBezel, frontScrMesh],
      onClick: () => {
        state.selectedFixture = i;
        state.fixtures[i].addr = sp.targetAddr;
        sfx.dmxAddressBeep(true);
        bench.showToast(`${sp.code} adressé sur A${String(sp.targetAddr).padStart(3, '0')} !`, 'success');
        syncDmx3D();
        refreshUi();
      }
    });

    const minusBtn = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.024, 0.016),
      new THREE.MeshStandardMaterial({ map: minusBtnTex, emissive: 0x000000, roughness: 0.4 })
    );
    minusBtn.position.set(0.038, -0.032, -0.054);
    podBox.add(minusBtn);
    bench.addInteractive(minusBtn, {
      label: `${sp.code} Adresse -1`,
      cursor: 'pointer',
      onClick: () => {
        state.selectedFixture = i;
        state.fixtures[i].addr = Math.max(1, state.fixtures[i].addr - 1);
        sfx.dmxAddressBeep(state.fixtures[i].addr === sp.targetAddr);
        syncDmx3D();
        refreshUi();
      }
    });

    const plusBtn = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.024, 0.016),
      new THREE.MeshStandardMaterial({ map: plusBtnTex, emissive: 0x000000, roughness: 0.4 })
    );
    plusBtn.position.set(-0.038, -0.032, -0.054);
    podBox.add(plusBtn);
    bench.addInteractive(plusBtn, {
      label: `${sp.code} Adresse +1`,
      cursor: 'pointer',
      onClick: () => {
        state.selectedFixture = i;
        state.fixtures[i].addr = Math.min(505, state.fixtures[i].addr + 1);
        sfx.dmxAddressBeep(state.fixtures[i].addr === sp.targetAddr);
        syncDmx3D();
        refreshUi();
      }
    });

    const panGroup = new THREE.Group();
    panGroup.position.y = -0.06;
    mount.add(panGroup);

    const yoke = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.09, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.65 })
    );
    yoke.position.y = -0.045;
    panGroup.add(yoke);

    const tiltGroup = new THREE.Group();
    tiltGroup.position.set(0, -0.06, 0.01);
    panGroup.add(tiltGroup);

    const headBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.056, 0.12, 16),
      new THREE.MeshStandardMaterial({ color: 0x111827, emissive: 0x000000, roughness: 0.34, metalness: 0.78 })
    );
    headBody.rotation.x = Math.PI / 2;
    headBody.castShadow = true;
    tiltGroup.add(headBody);

    const lensMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.8
    });
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.044, 16), lensMat);
    lens.position.set(0, 0, 0.062);
    tiltGroup.add(lens);

    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.25, 0.84, 18, 1, true), coneMat);
    cone.rotation.x = -Math.PI / 2;
    cone.position.set(0, 0, 0.48);
    tiltGroup.add(cone);

    const spot = new THREE.SpotLight(0xffffff, 2.0, 2.8, Math.PI / 5, 0.45, 1.2);
    spot.position.set(0, 0, 0.06);
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, 0, 1.0);
    tiltGroup.add(spotTarget);
    spot.target = spotTarget;
    tiltGroup.add(spot);

    bench.addInteractive(headBody, {
      label: `Projecteur ${sp.code} (${sp.role})`,
      cursor: 'pointer',
      onClick: () => {
        state.selectedFixture = i;
        sfx.click();
        syncDmx3D();
        refreshUi();
      }
    });

    fixtureObjects.push({ panGroup, tiltGroup, lensMat, coneMat, spot, rearScreen, frontScreen, podBox });
  }

  function buildTerminatorPlugMesh() {
    const plugGrp = new THREE.Group();
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, 0.058, 16),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0x000000, roughness: 0.3, metalness: 0.65 })
    );
    cap.rotation.x = Math.PI / 2;
    plugGrp.add(cap);
    const tip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.019, 0.019, 0.022, 16),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0x000000, roughness: 0.25, metalness: 0.85 })
    );
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 0.032;
    plugGrp.add(tip);
    return { plugGrp, cap, tip };
  }

  const splitterGroup = new THREE.Group();
  splitterGroup.position.set(0.74, 0.014, -0.05);
  bench.scene.add(splitterGroup);

  const splitterBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.08, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.42, metalness: 0.55 })
  );
  splitterBox.position.y = 0.04;
  splitterBox.castShadow = true;
  splitterGroup.add(splitterBox);

  const { plugGrp: termBenchPlug, cap: termCap, tip: termTip } = buildTerminatorPlugMesh();
  termBenchPlug.position.set(0, 0.095, 0.02);
  splitterGroup.add(termBenchPlug);

  const { plugGrp: mountedTermPlug } = buildTerminatorPlugMesh();
  mountedTermPlug.position.set(0.064, 0.062, 0.042);
  mountedTermPlug.visible = false;
  fixtureObjects[3].podBox.add(mountedTermPlug);

  function installTerminator() {
    if (state.terminatorInstalled) return;
    state.terminatorInstalled = true;
    state.selectedPort = null;
    termBenchPlug.visible = false;
    mountedTermPlug.visible = true;
    const pTerm = new THREE.Vector3();
    xlrPorts.P3_OUT.anchor.getWorldPosition(pTerm);
    bench.spawnSparks(pTerm, { color: 0x22c55e, count: 16, speed: 1.1 });
    bench.spawnPulseRing(pTerm, '#22c55e', 0.09);
    sfx.xlrPlug();
    if (state.cablesDone.size === DAISY_LINKS.length) {
      sfx.stageComplete();
    }
    bench.showToast('Bouchon de terminaison DMX 120 Ω verrouillé sur PAR-4 OUT !', 'success');
    syncDmx3D();
    refreshUi();
  }

  bench.addInteractive(termBenchPlug, {
    label: 'Bouchon Terminaison DMX 120 Ω (Cliquer pour brancher sur PAR-4 OUT)',
    cursor: 'pointer',
    enabled: () => !state.terminatorInstalled,
    highlightTargets: [termCap, termTip],
    onClick: installTerminator
  });

  const consoleGroup = new THREE.Group();
  consoleGroup.position.set(0.0, 0.014, 0.26);
  bench.scene.add(consoleGroup);

  const consoleBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.082, 0.32),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.42, metalness: 0.62 })
  );
  consoleBody.position.y = 0.041;
  consoleBody.rotation.x = 0.14;
  consoleBody.castShadow = true;
  consoleGroup.add(consoleBody);

  createXlrSocket(consoleGroup, new THREE.Vector3(-0.38, 0.068, -0.145), 'CONSOLE_OUT', 'Pupitre DMX OUT', false);

  const lcdScreen = makeCanvasScreen(420, 140, (ctx, w, h) => {
    ctx.fillStyle = '#061524';
    ctx.fillRect(0, 0, w, h);
  });
  const lcdBezel = new THREE.Mesh(
    new THREE.BoxGeometry(0.334, 0.104, 0.008),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: 0x000000, roughness: 0.4 })
  );
  lcdBezel.rotation.x = -Math.PI / 2 + 0.14;
  lcdBezel.position.set(-0.26, 0.092, -0.055);
  consoleGroup.add(lcdBezel);
  const lcdMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.092),
    new THREE.MeshBasicMaterial({ map: lcdScreen.texture })
  );
  lcdMesh.rotation.x = -Math.PI / 2 + 0.14;
  lcdMesh.position.set(-0.26, 0.098, -0.055);
  consoleGroup.add(lcdMesh);

  bench.addInteractive(lcdMesh, {
    label: () => {
      const sp = FIXTURE_SPECS[state.selectedFixture];
      return `Écran DMX Console : Adresser ${sp.code} sur A${String(sp.targetAddr).padStart(3, '0')}`;
    },
    cursor: 'pointer',
    highlightTargets: [lcdBezel, lcdMesh],
    onClick: () => {
      const sp = FIXTURE_SPECS[state.selectedFixture];
      state.fixtures[state.selectedFixture].addr = sp.targetAddr;
      sfx.dmxAddressBeep(true);
      bench.showToast(`${sp.code} adressé sur A${String(sp.targetAddr).padStart(3, '0')} !`, 'success');
      syncDmx3D();
      refreshUi();
    }
  });

  const consoleMinusBtn = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.02, 0.036),
    new THREE.MeshStandardMaterial({ map: minusBtnTex, emissive: 0x000000, roughness: 0.35 })
  );
  consoleMinusBtn.position.set(-0.37, 0.088, 0.022);
  consoleMinusBtn.rotation.x = 0.14;
  consoleGroup.add(consoleMinusBtn);
  bench.addInteractive(consoleMinusBtn, {
    label: () => `${FIXTURE_SPECS[state.selectedFixture].code} Adresse DMX -1`,
    cursor: 'pointer',
    onClick: () => {
      const i = state.selectedFixture;
      const sp = FIXTURE_SPECS[i];
      state.fixtures[i].addr = Math.max(1, state.fixtures[i].addr - 1);
      sfx.dmxAddressBeep(state.fixtures[i].addr === sp.targetAddr);
      syncDmx3D();
      refreshUi();
    }
  });

  const consolePlusBtn = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.02, 0.036),
    new THREE.MeshStandardMaterial({ map: plusBtnTex, emissive: 0x000000, roughness: 0.35 })
  );
  consolePlusBtn.position.set(-0.305, 0.088, 0.022);
  consolePlusBtn.rotation.x = 0.14;
  consoleGroup.add(consolePlusBtn);
  bench.addInteractive(consolePlusBtn, {
    label: () => `${FIXTURE_SPECS[state.selectedFixture].code} Adresse DMX +1`,
    cursor: 'pointer',
    onClick: () => {
      const i = state.selectedFixture;
      const sp = FIXTURE_SPECS[i];
      state.fixtures[i].addr = Math.min(505, state.fixtures[i].addr + 1);
      sfx.dmxAddressBeep(state.fixtures[i].addr === sp.targetAddr);
      syncDmx3D();
      refreshUi();
    }
  });

  const consoleCalAddrTex = bench.track(makeButtonLabelTexture('A*', '#15803d', '#ffffff'));
  const consoleCalAddrBtn = new THREE.Mesh(
    new THREE.BoxGeometry(0.068, 0.02, 0.036),
    new THREE.MeshStandardMaterial({ map: consoleCalAddrTex, emissive: 0x000000, roughness: 0.35 })
  );
  consoleCalAddrBtn.position.set(-0.228, 0.088, 0.022);
  consoleCalAddrBtn.rotation.x = 0.14;
  consoleGroup.add(consoleCalAddrBtn);
  bench.addInteractive(consoleCalAddrBtn, {
    label: () => `Régler adresse cible ${FIXTURE_SPECS[state.selectedFixture].code} (A${String(FIXTURE_SPECS[state.selectedFixture].targetAddr).padStart(3, '0')})`,
    cursor: 'pointer',
    onClick: () => {
      const i = state.selectedFixture;
      const sp = FIXTURE_SPECS[i];
      state.fixtures[i].addr = sp.targetAddr;
      sfx.dmxAddressBeep(true);
      bench.showToast(`${sp.code} adressé sur A${String(sp.targetAddr).padStart(3, '0')} !`, 'success');
      syncDmx3D();
      refreshUi();
    }
  });

  const faderDefs = [
    { key: 'master', label: 'Master', max: 100, color: 0xf8fafc, x: -0.02 },
    { key: 'r', label: 'Rouge R', max: 255, color: 0xef4444, x: 0.075 },
    { key: 'g', label: 'Vert G', max: 255, color: 0x22c55e, x: 0.17 },
    { key: 'b', label: 'Bleu B', max: 255, color: 0x3b82f6, x: 0.265 },
    { key: 'pan', label: 'Pan X', max: 100, color: 0xf59e0b, x: 0.36 },
    { key: 'tilt', label: 'Tilt Y', max: 100, color: 0xa855f7, x: 0.44 }
  ];

  const faderKnobs = [];
  const faderPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
    new THREE.Vector3(0, Math.cos(0.14), Math.sin(0.14)).normalize(),
    new THREE.Vector3(0, 0.105, 0.26)
  );
  let lastFaderTickMs = 0;

  for (const fd of faderDefs) {
    const slot = new THREE.Mesh(
      new THREE.BoxGeometry(0.026, 0.012, 0.175),
      new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x000000, roughness: 0.6 })
    );
    slot.position.set(fd.x, 0.088, 0.015);
    slot.rotation.x = 0.14;
    consoleGroup.add(slot);

    const knob = new THREE.Mesh(
      new THREE.BoxGeometry(0.048, 0.026, 0.032),
      new THREE.MeshStandardMaterial({ color: fd.color, emissive: 0x000000, roughness: 0.3, metalness: 0.25 })
    );
    knob.position.set(fd.x, 0.102, 0.015);
    knob.rotation.x = 0.14;
    knob.castShadow = true;
    consoleGroup.add(knob);
    faderKnobs.push({ def: fd, knob, slot });

    let dragAccum = 0;
    const applyFaderFromDrag = (planePt, dy) => {
      const fx = state.fixtures[state.selectedFixture];
      let nextVal = fx[fd.key];
      if (planePt && Number.isFinite(planePt.z)) {
        const localZ = planePt.z - consoleGroup.position.z;
        const ratio = Math.max(0, Math.min(1, (0.085 - localZ) / 0.14));
        nextVal = Math.round(ratio * fd.max);
      } else {
        dragAccum += (-dy / 110) * fd.max;
        if (Math.abs(dragAccum) >= 1) {
          const step = Math.trunc(dragAccum);
          dragAccum -= step;
          nextVal = Math.max(0, Math.min(fd.max, fx[fd.key] + step));
        }
      }
      if (nextVal !== fx[fd.key]) {
        fx[fd.key] = nextVal;
        const now = performance.now();
        if (now - lastFaderTickMs > 55) {
          lastFaderTickMs = now;
          sfx.faderTick(nextVal / fd.max);
        }
        syncDmx3D();
        syncLiveUiWithoutRebuild();
      }
    };

    bench.addInteractive(knob, {
      label: () => `Fader DMX ${fd.label} (${state.fixtures[state.selectedFixture][fd.key]}/${fd.max})`,
      cursor: 'ns-resize',
      dragPlane: faderPlane,
      highlightTargets: [knob],
      onDragStart: () => {
        dragAccum = 0;
      },
      onDragMove: (planePt, _dx, dy) => applyFaderFromDrag(planePt, dy),
      onDragEnd: () => refreshUi()
    });

    bench.addInteractive(slot, {
      label: () => `Piste Fader ${fd.label} (Cliquer ou glisser)`,
      cursor: 'ns-resize',
      dragPlane: faderPlane,
      highlightTargets: [knob],
      onDragStart: () => {
        dragAccum = 0;
      },
      onClick: (_hit, info) => {
        if (info?.planePoint && Number.isFinite(info.planePoint.z)) {
          const localZ = info.planePoint.z - consoleGroup.position.z;
          const ratio = Math.max(0, Math.min(1, (0.085 - localZ) / 0.14));
          state.fixtures[state.selectedFixture][fd.key] = Math.round(ratio * fd.max);
          sfx.faderTick(ratio);
          syncDmx3D();
          refreshUi();
        }
      },
      onDragMove: (planePt, _dx, dy) => applyFaderFromDrag(planePt, dy),
      onDragEnd: () => refreshUi()
    });
  }

  const fixBtns = [];
  for (let i = 0; i < 4; i++) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x000000, emissiveIntensity: 0.4 });
    const btn = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.022, 0.044), mat);
    btn.position.set(-0.37 + i * 0.085, 0.086, 0.085);
    consoleGroup.add(btn);
    fixBtns.push(mat);

    bench.addInteractive(btn, {
      label: `Sélection ${FIXTURE_SPECS[i].code} (${FIXTURE_SPECS[i].role})`,
      cursor: 'pointer',
      onClick: () => {
        state.selectedFixture = i;
        sfx.click();
        syncDmx3D();
        refreshUi();
      }
    });
  }

  const cableGroup = new THREE.Group();
  bench.scene.add(cableGroup);

  function handlePortClick(portId) {
    if (portId === 'P3_OUT' && !state.selectedPort) {
      if (state.cablesDone.size === DAISY_LINKS.length && !state.terminatorInstalled) {
        installTerminator();
        return;
      }
      if (!state.terminatorInstalled) {
        sfx.cableSelect();
        bench.showToast('PAR-4 DMX OUT : réservez cette sortie pour le bouchon 120 Ω (ou cliquez le bouchon rouge/or) !', 'info');
        return;
      }
      sfx.click();
      bench.showToast('Terminaison DMX 120 Ω déjà verrouillée sur PAR-4 OUT.', 'info');
      return;
    }

    if (!state.selectedPort) {
      state.selectedPort = portId;
      sfx.cableSelect();
      const targetId = getValidNextTargetPort(portId);
      const targetHint = targetId ? ` → reliez maintenant à ${xlrPorts[targetId]?.label}` : '';
      bench.showToast(`Port ${xlrPorts[portId]?.label} sélectionné${targetHint}`, 'info');
      syncDmx3D();
      refreshUi();
      return;
    }

    if (state.selectedPort === portId) {
      state.selectedPort = null;
      sfx.click();
      syncDmx3D();
      refreshUi();
      return;
    }

    const a = state.selectedPort;
    const b = portId;
    const matched = DAISY_LINKS.find(
      (lk) => (lk.fromId === a && lk.toId === b) || (lk.fromId === b && lk.toId === a)
    );
    state.selectedPort = null;
    if (matched && !state.cablesDone.has(matched.id)) {
      state.cablesDone.add(matched.id);
      sfx.xlrPlug();
      const pTarget = new THREE.Vector3();
      xlrPorts[b]?.anchor.getWorldPosition(pTarget);
      bench.spawnPulseRing(pTarget, '#38bdf8', 0.08);
      if (state.cablesDone.size === DAISY_LINKS.length && state.terminatorInstalled) {
        sfx.stageComplete();
      }
      bench.showToast(`Câble XLR relié : ${matched.label}`, 'success');
      rebuildXlrCables();
      syncDmx3D();
    } else if (matched && state.cablesDone.has(matched.id)) {
      sfx.click();
      bench.showToast(`Liaison XLR déjà branchée : ${matched.label}`, 'info');
      syncDmx3D();
    } else {
      sfx.error();
      bench.showToast('Ordre Daisy-Chain incorrect : reliez chaque sortie OUT vers l’entrée IN suivante', 'error');
      syncDmx3D();
    }
    refreshUi();
  }

  function connectNextXlr() {
    const nextLink = DAISY_LINKS.find((lk) => !state.cablesDone.has(lk.id));
    if (nextLink) {
      state.selectedPort = null;
      state.cablesDone.add(nextLink.id);
      sfx.xlrPlug();
      const pTarget = new THREE.Vector3();
      xlrPorts[nextLink.toId]?.anchor.getWorldPosition(pTarget);
      bench.spawnPulseRing(pTarget, '#38bdf8', 0.08);
      bench.showToast(`Câble XLR relié : ${nextLink.label}`, 'success');
      rebuildXlrCables();
      syncDmx3D();
      refreshUi();
    } else if (!state.terminatorInstalled) {
      installTerminator();
    } else {
      sfx.stageComplete();
      bench.showToast('Bus DMX512 complet (4/4 câbles XLR + terminaison 120 Ω)', 'success');
    }
  }

  function applyTargetToFixture(idx) {
    const sp = FIXTURE_SPECS[idx];
    if (!sp) return;
    state.selectedFixture = idx;
    state.fixtures[idx].addr = sp.targetAddr;
    state.fixtures[idx].master = sp.target.master;
    state.fixtures[idx].r = sp.target.r;
    state.fixtures[idx].g = sp.target.g;
    state.fixtures[idx].b = sp.target.b;
    state.fixtures[idx].pan = sp.target.pan;
    state.fixtures[idx].tilt = sp.target.tilt;
    sfx.dmxAddressBeep(true);
    const evAfter = evaluateDmx();
    if (evAfter.allValid) sfx.stageComplete();
    bench.showToast(`${sp.code} calibré (A${String(sp.targetAddr).padStart(3, '0')} + Scène RGB/Pan/Tilt)`, 'success');
    syncDmx3D();
    refreshUi();
  }

  function rebuildXlrCables() {
    while (cableGroup.children.length > 0) {
      const child = cableGroup.children.pop();
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of mats) m.dispose?.();
      }
    }
    bench.scene.updateMatrixWorld(true);
    for (const lk of DAISY_LINKS) {
      if (!state.cablesDone.has(lk.id)) continue;
      const pA = new THREE.Vector3();
      const pB = new THREE.Vector3();
      xlrPorts[lk.fromId].anchor.getWorldPosition(pA);
      xlrPorts[lk.toId].anchor.getWorldPosition(pB);
      const mid = pA.clone().lerp(pB, 0.5);
      mid.y += lk.id === 0 ? -0.06 : 0.04;
      mid.z += lk.id === 0 ? 0.04 : 0.02;
      const cableObj = buildFlexibleCable([pA, mid, pB], '#0ea5e9', 0.0085, '#0284c7');
      cableGroup.add(cableObj.mesh);
    }
  }

  function drawLcdScreen(ev) {
    const { ctx, canvas, texture } = lcdScreen;
    ctx.fillStyle = '#061524';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = ev.allValid ? '#22c55e' : '#38bdf8';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

    const cur = state.fixtures[state.selectedFixture];
    const sp = FIXTURE_SPECS[state.selectedFixture];
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`PUPITRE DMX512 • ${sp.code} (CH ${String(cur.addr).padStart(3, '0')})`, 14, 28);

    ctx.fillStyle = ev.daisyOk ? '#4ade80' : '#fbbf24';
    ctx.font = '15px monospace';
    ctx.fillText(
      `BUS XLR: ${ev.cablesConnected}/4  120Ω: ${state.terminatorInstalled ? 'OK' : 'ABSENT'}`,
      14,
      58
    );

    ctx.fillStyle = ev.dmxNoOverlap && ev.exactAddressesCount === 4 ? '#4ade80' : '#f87171';
    ctx.fillText(
      `ADRESSAGE: ${ev.exactAddressesCount}/4 EXACT  CONFLITS: ${ev.overlaps}`,
      14,
      84
    );

    ctx.fillStyle = ev.matchedFixtures === 4 ? '#4ade80' : '#e2e8f0';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(
      `SCENE: ${ev.matchedFixtures}/4 PROJECTEURS CONFORMES`,
      14,
      118
    );
    texture.needsUpdate = true;
  }

  function drawFixtureScreens(i, ev) {
    const fx = state.fixtures[i];
    const sp = FIXTURE_SPECS[i];
    const ok = fx.addr === sp.targetAddr && !ev.conflictingIds.has(i);
    const isSel = i === state.selectedFixture;

    const rear = fixtureObjects[i].rearScreen;
    rear.ctx.fillStyle = '#020617';
    rear.ctx.fillRect(0, 0, rear.canvas.width, rear.canvas.height);
    rear.ctx.strokeStyle = ok ? '#22c55e' : isSel ? '#38bdf8' : '#ef4444';
    rear.ctx.lineWidth = 4;
    rear.ctx.strokeRect(2, 2, rear.canvas.width - 4, rear.canvas.height - 4);
    rear.ctx.fillStyle = '#94a3b8';
    rear.ctx.font = 'bold 15px monospace';
    rear.ctx.fillText(`${sp.code} CIBLE: A${String(sp.targetAddr).padStart(3, '0')}`, 12, 26);
    rear.ctx.fillStyle = ok ? '#4ade80' : '#fbbf24';
    rear.ctx.font = 'bold 34px monospace';
    rear.ctx.fillText(`A${String(fx.addr).padStart(3, '0')}`, 42, 72);
    rear.texture.needsUpdate = true;

    const front = fixtureObjects[i].frontScreen;
    front.ctx.fillStyle = '#020617';
    front.ctx.fillRect(0, 0, front.canvas.width, front.canvas.height);
    front.ctx.strokeStyle = ok ? '#22c55e' : isSel ? '#38bdf8' : '#f59e0b';
    front.ctx.lineWidth = 4;
    front.ctx.strokeRect(2, 2, front.canvas.width - 4, front.canvas.height - 4);
    front.ctx.fillStyle = isSel ? '#38bdf8' : '#94a3b8';
    front.ctx.font = 'bold 15px monospace';
    front.ctx.fillText(`${sp.code} • CIBLE A${String(sp.targetAddr).padStart(3, '0')}`, 10, 22);
    front.ctx.fillStyle = ok ? '#4ade80' : '#fbbf24';
    front.ctx.font = 'bold 30px monospace';
    front.ctx.fillText(`A${String(fx.addr).padStart(3, '0')}`, 14, 58);
    front.ctx.fillStyle = ok ? '#4ade80' : '#f87171';
    front.ctx.font = 'bold 16px monospace';
    front.ctx.fillText(ok ? 'OK' : 'EDIT', 128, 56);
    front.texture.needsUpdate = true;
  }

  function syncDmx3D() {
    const ev = evaluateDmx();
    const curFx = state.fixtures[state.selectedFixture];

    for (const item of faderKnobs) {
      const ratio = curFx[item.def.key] / item.def.max;
      const localZ = 0.085 - ratio * 0.14;
      item.knob.position.z = localZ;
      item.knob.position.y = 0.102 - (localZ - 0.015) * Math.sin(0.14);
    }

    for (let i = 0; i < 4; i++) {
      const active = i === state.selectedFixture;
      fixBtns[i].color.setHex(active ? 0x38bdf8 : 0x334155);
      fixBtns[i].emissive.setHex(active ? 0x0284c7 : 0x000000);
      fixBtns[i].emissiveIntensity = active ? 0.65 : 0;

      const fx = state.fixtures[i];
      const obj = fixtureObjects[i];
      obj.panGroup.rotation.y = ((fx.pan - 50) / 50) * 0.72;
      obj.tiltGroup.rotation.x = 0.42 + (fx.tilt / 100) * 0.75;

      const cableActive = isFixtureChainPowered(i);
      const signalClean = ev.daisyOk && !ev.conflictingIds.has(i);
      const jitter = cableActive && !signalClean ? (Math.sin(state.glitchPhase * 18 + i) > 0 ? 0.35 : 0.9) : 1.0;

      const c = new THREE.Color(fx.r / 255, fx.g / 255, fx.b / 255);
      const intensity = cableActive ? (fx.master / 100) * jitter : 0.05;
      obj.lensMat.color.copy(c);
      obj.lensMat.emissive.copy(c);
      obj.lensMat.emissiveIntensity = cableActive ? 0.25 + intensity * 1.4 : 0.05;
      obj.coneMat.color.copy(c);
      obj.coneMat.opacity = cableActive ? intensity * 0.28 : 0;
      obj.spot.color.copy(c);
      obj.spot.intensity = cableActive ? intensity * 3.8 : 0;

      drawFixtureScreens(i, ev);
    }

    const validNextPort = getValidNextTargetPort(state.selectedPort);
    for (const [pid, port] of Object.entries(xlrPorts)) {
      const isSel = state.selectedPort === pid;
      const isNextHint = validNextPort === pid;
      const isConnected = DAISY_LINKS.some(
        (lk) => state.cablesDone.has(lk.id) && (lk.fromId === pid || lk.toId === pid)
      ) || (pid === 'P3_OUT' && state.terminatorInstalled);
      port.mesh.material.color.setHex(
        isSel ? 0xfbbf24 : isNextHint ? 0x22d3ee : isConnected ? 0x22c55e : port.baseHex
      );
      port.mesh.material.emissive.setHex(
        isSel ? 0xf59e0b : isNextHint ? 0x06b6d4 : isConnected ? 0x15803d : 0x000000
      );
      port.mesh.material.emissiveIntensity = isSel ? 0.85 : isNextHint ? 0.8 : isConnected ? 0.45 : 0;
    }

    drawLcdScreen(ev);
  }

  function setCameraById(id) {
    const cam = CAM_VIEWS.find((c) => c.id === id) || CAM_VIEWS[0];
    state.camId = cam.id;
    bench.resetInteractionState?.();
    bench.setCameraView(cam.pos, cam.lookAt, cam.fov);
    bench.setCameras(CAM_VIEWS, cam.id, setCameraById);
  }

  function computeCurrentEstimatedScore(ev) {
    return computeDmxScore3D({
      cablesConnected: ev.cablesConnected,
      terminatorInstalled: state.terminatorInstalled,
      exactAddressesCount: ev.exactAddressesCount,
      dmxNoOverlap: ev.dmxNoOverlap,
      overlapCount: ev.overlaps,
      matchedFixtures: ev.matchedFixtures,
      aimScore: ev.aimScore,
      elapsedSec: (performance.now() - state.startMs) / 1000
    });
  }

  let lastStageKey = '';
  function syncStagesBar(ev) {
    const stepIdx = !ev.daisyOk
      ? 0
      : ev.exactAddressesCount < 4 || !ev.dmxNoOverlap
      ? 1
      : 2;
    const stages = [
      { name: `1. XLR & 120 Ω (${ev.cablesConnected}/4)` },
      { name: `2. Adressage (${ev.exactAddressesCount}/4)` },
      { name: `3. Faders & Scène (${ev.matchedFixtures}/4)` }
    ];
    const nextKey = `${stepIdx}|${stages.map((s) => s.name).join('|')}`;
    if (nextKey === lastStageKey) return;
    lastStageKey = nextKey;
    api.setStages(stages, stepIdx, (idx) => {
      if (idx === 0) setCameraById('cabling');
      else if (idx === 1) setCameraById('address');
      else setCameraById('console');
    });
  }

  function syncLiveUiWithoutRebuild() {
    const ev = evaluateDmx();
    const estScore = computeCurrentEstimatedScore(ev);
    const stepSub = state.selectedPort
      ? `Port sélectionné : ${xlrPorts[state.selectedPort]?.label} — cliquez le port suivant sur le Truss ou Pupitre.`
      : ev.teacherAdvice;

    bench.setInstruction(
      'ATELIER DMX512, CÂBLAGE XLR & SCÈNE 3D',
      `XLR ${ev.cablesConnected}/4 • 120Ω ${state.terminatorInstalled ? 'OK' : 'NON'} • Adresses ${ev.exactAddressesCount}/4 • Scène ${ev.matchedFixtures}/4`,
      stepSub
    );
    bench.setAccuracy(`Note est. ${estScore.toFixed(1)}/20`);
    syncStagesBar(ev);

    const profEl = api.container.querySelector('#dmx-prof-advice');
    if (profEl) profEl.textContent = ev.teacherAdvice;

    const selCurFx = state.fixtures[state.selectedFixture];
    const selCurSp = FIXTURE_SPECS[state.selectedFixture];
    const curAddrEl = api.container.querySelector('[data-addr-cur]');
    if (curAddrEl) {
      curAddrEl.textContent = `A${String(selCurFx.addr).padStart(3, '0')}`;
      curAddrEl.style.color = selCurFx.addr === selCurSp.targetAddr ? '#4ade80' : '#38bdf8';
    }

    for (let i = 0; i < FIXTURE_SPECS.length; i++) {
      const sp = FIXTURE_SPECS[i];
      const res = ev.fixtureResults[i];
      const f = state.fixtures[i];
      const cardEl = api.container.querySelector(`[data-fix-card="${i}"]`);
      if (cardEl) {
        cardEl.classList.toggle('ok', res.ok);
        cardEl.style.borderColor = res.ok
          ? 'rgba(34,197,94,0.75)'
          : res.addrExact
          ? 'rgba(56,189,248,0.55)'
          : 'rgba(239,68,68,0.65)';
      }
      const addrBadge = api.container.querySelector(`[data-fix-addr="${i}"]`);
      if (addrBadge) {
        addrBadge.textContent = `A${String(f.addr).padStart(3, '0')} / A${String(sp.targetAddr).padStart(3, '0')}`;
        addrBadge.style.color = res.addrExact && res.addrClean ? '#4ade80' : '#fbbf24';
      }
      const statusLine = api.container.querySelector(`[data-fix-status="${i}"]`);
      if (statusLine) {
        statusLine.textContent = res.ok ? '✔ Scène DMX conforme OK' : sp.hint;
        statusLine.style.color = res.ok ? '#4ade80' : '#cbd5e1';
      }
    }

    const curFx = state.fixtures[state.selectedFixture];
    for (const fd of faderDefs) {
      const span = api.container.querySelector(`[data-fader-val="${fd.key}"]`);
      if (span) span.textContent = String(curFx[fd.key]);
      const inp = api.container.querySelector(`input[data-fader="${fd.key}"]`);
      if (inp && document.activeElement !== inp) {
        inp.value = String(curFx[fd.key]);
      }
    }
    bench.refreshDrawerControls?.();
  }

  function updateSidebar() {
    const ev = evaluateDmx();
    const selSpec = FIXTURE_SPECS[state.selectedFixture];
    const fx = state.fixtures[state.selectedFixture];
    const selTarget = selSpec.target;

    const linkRows = DAISY_LINKS.map((lk) => {
      const ok = state.cablesDone.has(lk.id);
      return `<div class="av-link-row ${ok ? 'ok' : 'pending'}"><span>${lk.label}</span><strong>${ok ? '✔ Relié' : 'À relier'}</strong></div>`;
    }).join('');

    const fixCards = FIXTURE_SPECS.map((sp, i) => {
      const res = ev.fixtureResults[i];
      const f = state.fixtures[i];
      const active = i === state.selectedFixture;
      return `<div data-fix-card="${i}" data-sel="${i}" data-active="${active ? '1' : '0'}" data-vr-label="${sp.code} A${String(f.addr).padStart(3, '0')}" class="av-fix-card ${active ? 'active' : ''} ${res.ok ? 'ok' : ''}" style="border-color:${
        res.ok ? 'rgba(34,197,94,0.75)' : res.addrExact ? 'rgba(56,189,248,0.55)' : 'rgba(239,68,68,0.65)'
      };">
        <div class="av-fix-head">
          <span>${sp.code} (${sp.role})</span>
          <span data-fix-addr="${i}" style="font-family:monospace;color:${res.addrExact && res.addrClean ? '#4ade80' : '#fbbf24'};">A${String(f.addr).padStart(3, '0')} / A${String(sp.targetAddr).padStart(3, '0')}</span>
        </div>
        <div data-fix-status="${i}" class="av-fix-status" style="color:${res.ok ? '#4ade80' : '#cbd5e1'};">${res.ok ? '✔ Scène DMX conforme OK' : sp.hint}</div>
      </div>`;
    }).join('');

    const drawer = bench.setSideDrawer(`
      <div class="av-drawer-shell">
        <div id="dmx-prof-advice" class="av-prof-banner">${ev.teacherAdvice}</div>

        <div class="av-step-header">
          <span class="av-step-title cyan">1. DAISY-CHAIN XLR (${ev.cablesConnected}/4) & 120 Ω</span>
        </div>
        <div class="av-link-list">${linkRows}</div>
        <div class="av-btn-row">
          <button type="button" id="dmx-next-xlr" class="av-btn ${ev.daisyOk ? 'success' : 'primary'}">${
            ev.cablesConnected < 4 ? `🔌 Relier câble XLR (${ev.cablesConnected}/4)` : state.terminatorInstalled ? '✔ Bus XLR + Bouchon 120 Ω OK' : '🛡️ Brancher Bouchon 120 Ω'
          }</button>
        </div>

        <div class="av-step-header">
          <span class="av-step-title purple">2. ADRESSAGE & 3. SCÈNE DMX512 (${ev.matchedFixtures}/4)</span>
        </div>
        <div class="av-fix-list">${fixCards}</div>

        <div class="av-control-card">
          <div class="av-control-head">
            <strong>${selSpec.code} (Cible A${String(selSpec.targetAddr).padStart(3, '0')})</strong>
            <div class="av-addr-controls">
              <button type="button" class="av-mini-btn" data-addr="-4">-4</button>
              <button type="button" class="av-mini-btn" data-addr="-1">-1</button>
              <span data-addr-cur class="av-addr-readout" style="color:${fx.addr === selSpec.targetAddr ? '#4ade80' : '#38bdf8'};">A${String(fx.addr).padStart(3, '0')}</span>
              <button type="button" class="av-mini-btn" data-addr="1">+1</button>
              <button type="button" class="av-mini-btn" data-addr="4">+4</button>
              <button type="button" id="dmx-preset-fix" class="av-btn primary compact" title="Appliquer les valeurs cibles sur ${selSpec.code}">Calibrer ${selSpec.code}</button>
            </div>
          </div>
          ${faderDefs
            .map(
              (fd) => `
            <label class="av-slider-row">
              <span class="av-slider-lbl">${fd.label} <small>(${selTarget[fd.key]})</small></span>
              <input type="range" min="0" max="${fd.max}" value="${fx[fd.key]}" data-fader="${fd.key}" />
              <span data-fader-val="${fd.key}" class="av-slider-val">${fx[fd.key]}</span>
            </label>`
            )
            .join('')}
        </div>
      </div>
    `);

    if (!drawer) return;
    const xlrBtn = drawer.querySelector('#dmx-next-xlr');
    if (xlrBtn) xlrBtn.addEventListener('click', connectNextXlr);

    const presetBtn = drawer.querySelector('#dmx-preset-fix');
    if (presetBtn) {
      presetBtn.addEventListener('click', () => applyTargetToFixture(state.selectedFixture));
    }

    drawer.querySelectorAll('[data-sel]').forEach((el) => {
      el.addEventListener('click', () => {
        state.selectedFixture = Number(el.dataset.sel);
        sfx.click();
        syncDmx3D();
        refreshUi();
      });
    });
    drawer.querySelectorAll('[data-addr]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const delta = Number(btn.dataset.addr);
        const fxCur = state.fixtures[state.selectedFixture];
        fxCur.addr = Math.max(1, Math.min(505, fxCur.addr + delta));
        sfx.dmxAddressBeep(fxCur.addr === selSpec.targetAddr);
        syncDmx3D();
        refreshUi();
      });
    });
    drawer.querySelectorAll('[data-fader]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const key = inp.dataset.fader;
        const val = Number(inp.value);
        state.fixtures[state.selectedFixture][key] = val;
        const now = performance.now();
        if (now - lastFaderTickMs > 65) {
          lastFaderTickMs = now;
          sfx.faderTick(val / (Number(inp.max) || 100));
        }
        syncDmx3D();
        syncLiveUiWithoutRebuild();
      });
      inp.addEventListener('change', () => refreshUi());
    });
  }

  function submitDmxTp() {
    if (state.submitted) return;
    state.submitted = true;
    const finalEv = evaluateDmx();
    const finalScore = computeDmxScore3D({
      cablesConnected: finalEv.cablesConnected,
      terminatorInstalled: state.terminatorInstalled,
      exactAddressesCount: finalEv.exactAddressesCount,
      dmxNoOverlap: finalEv.dmxNoOverlap,
      overlapCount: finalEv.overlaps,
      matchedFixtures: finalEv.matchedFixtures,
      aimScore: finalEv.aimScore,
      elapsedSec: (performance.now() - state.startMs) / 1000
    });
    api.finishTp(
      finalScore,
      `
        <p>Plateforme Éclairage Scénique DMX512 évaluée par le <strong>Professeur CIEL</strong> :</p>
        <ul>
          <li>Liaison série XLR-5 : <strong>${finalEv.cablesConnected}/4 câbles</strong> • Bouchon 120 Ω : <strong>${state.terminatorInstalled ? 'Installé ✔' : 'Absent'}</strong></li>
          <li>Adressage DMX512 sans conflit : <strong>${finalEv.exactAddressesCount}/4 adresses exactes</strong> (Conflits : ${finalEv.overlaps})</li>
          <li>Restitution chromatique & orientation lyres : <strong>${finalEv.matchedFixtures}/4 projecteurs conformes</strong></li>
        </ul>
      `
    );
  }

  function refreshUi() {
    const ev = evaluateDmx();
    const estScore = computeCurrentEstimatedScore(ev);

    const stepSub = state.selectedPort
      ? `Port sélectionné : ${xlrPorts[state.selectedPort]?.label} — cliquez le port suivant sur le Truss ou Pupitre.`
      : ev.teacherAdvice;

    bench.setInstruction(
      'ATELIER DMX512, CÂBLAGE XLR & SCÈNE 3D',
      `XLR ${ev.cablesConnected}/4 • 120Ω ${state.terminatorInstalled ? 'OK' : 'NON'} • Adresses ${ev.exactAddressesCount}/4 • Scène ${ev.matchedFixtures}/4`,
      stepSub
    );
    bench.setAccuracy(`Note est. ${estScore.toFixed(1)}/20`);
    syncStagesBar(ev);

    bench.setTools(
      FIXTURE_SPECS.map((sp, i) => ({
        id: String(i),
        icon: String(i + 1),
        label: sp.code,
        disabled: false
      })),
      String(state.selectedFixture),
      (toolId) => {
        state.selectedFixture = Number(toolId);
        sfx.click();
        syncDmx3D();
        refreshUi();
      }
    );

    bench.setActions([
      {
        id: 'xlr-step-btn',
        label:
          ev.cablesConnected < 4
            ? `Câbler XLR (${ev.cablesConnected}/4)`
            : !state.terminatorInstalled
            ? 'Installer Bouchon 120 Ω'
            : 'Bus DMX 120 Ω OK',
        primary: !ev.daisyOk,
        onClick: connectNextXlr
      },
      {
        id: 'calibrate-cur-btn',
        label: `Calibrer ${FIXTURE_SPECS[state.selectedFixture].code}`,
        primary: ev.daisyOk && !ev.fixtureResults[state.selectedFixture]?.ok,
        onClick: () => applyTargetToFixture(state.selectedFixture)
      },
      {
        id: 'finish-btn',
        label: 'Valider Scène DMX',
        primary: ev.allValid,
        disabled: state.submitted,
        onClick: submitDmxTp
      }
    ]);

    updateSidebar();
  }

  bench.addFloatingTag([0, 0.96, -0.38], 'Pont Lumière & Ports XLR', 'info');
  bench.addFloatingTag([0.74, 0.16, -0.05], 'Bouchon DMX 120 Ω', 'info');
  bench.addFloatingTag([0, 0.17, 0.26], 'Pupitre Faders DMX512', 'info');

  let artistPhase = 0;
  const unsubTick = bench.addUpdate((dt) => {
    state.glitchPhase += dt;
    artistPhase += dt;
    artistAvatar.group.rotation.y = Math.sin(artistPhase * 1.1) * 0.22;
    if (artistAvatar.leftArm) artistAvatar.leftArm.rotation.x = -0.35 + Math.sin(artistPhase * 2.4) * 0.25;
    if (artistAvatar.rightArm) artistAvatar.rightArm.rotation.x = -0.55 + Math.cos(artistPhase * 2.0) * 0.2;
    const ev = evaluateDmx();
    if (!ev.daisyOk || !ev.dmxNoOverlap) {
      for (let i = 0; i < 4; i++) {
        const obj = fixtureObjects[i];
        const fx = state.fixtures[i];
        const cableActive = isFixtureChainPowered(i);
        const signalClean = ev.daisyOk && !ev.conflictingIds.has(i);
        const jitter = cableActive && !signalClean ? (Math.sin(state.glitchPhase * 18 + i) > 0 ? 0.35 : 0.9) : 1.0;
        const intensity = cableActive ? (fx.master / 100) * jitter : 0.05;
        obj.lensMat.emissiveIntensity = cableActive ? 0.25 + intensity * 1.4 : 0.05;
        obj.coneMat.opacity = cableActive ? intensity * 0.28 : 0;
        obj.spot.intensity = cableActive ? intensity * 3.8 : 0;
      }
    }
  });

  syncDmx3D();
  setCameraById('overview');
  refreshUi();

  return {
    destroy: () => {
      unsubTick();
      bench.destroy();
    }
  };
}
