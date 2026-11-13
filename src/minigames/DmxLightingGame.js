import * as THREE from 'three';
import { sfx } from '../core/audio.js';
import { buildStudentAvatarMesh } from '../world/AvatarBuilder.js';
import {
  createWorkbench3D,
  makeCanvasScreen,
  buildFlexibleCable
} from './Workbench3DHost.js';

export function computeDmxScore3D(metrics = {}) {
  const hasStage1Metrics =
    metrics.cablesConnected !== undefined || metrics.terminatorInstalled !== undefined;

  if (hasStage1Metrics) {
    const cables = Math.max(0, Math.min(4, metrics.cablesConnected ?? 0));
    const cablePts = (cables / 4) * 4;
    const termPts = metrics.terminatorInstalled ? 2 : 0;

    const exactAddr = Math.max(0, Math.min(4, metrics.exactAddressesCount ?? 0));
    const addrPts = (exactAddr / 4) * 4 + (metrics.dmxNoOverlap ? 1 : 0);

    const matchedFixtures = Math.max(0, Math.min(4, metrics.matchedFixtures ?? 0));
    const aim = Math.max(0, Math.min(4, metrics.aimScore ?? 0));
    const scenePts = (matchedFixtures / 4) * 6 + (aim / 4) * 2;

    const elapsed = metrics.elapsedSec ?? 120;
    const bonus = elapsed < 100 ? 1 : elapsed < 160 ? 0.5 : 0;
    const raw = cablePts + termPts + addrPts + scenePts + bonus;
    return Math.max(0, Math.min(20, Math.round(raw * 2) / 2));
  }

  const noConflicts = Boolean(metrics.dmxNoOverlap);
  const conflictPts = noConflicts ? 5 : Math.max(0, 5 - (metrics.overlapCount ?? 2) * 2);
  const matchedFixtures = Math.max(0, Math.min(4, metrics.matchedFixtures ?? 0));
  const faderPts = (matchedFixtures / 4) * 10;
  const aimPts = Math.max(0, Math.min(4, metrics.aimScore ?? 0));
  const elapsed = metrics.elapsedSec ?? 90;
  const bonus = elapsed < 80 ? 1 : elapsed < 140 ? 0.5 : 0;
  const raw = conflictPts + faderPts + aimPts + bonus;
  return Math.max(0, Math.min(20, Math.round(raw * 2) / 2));
}

const FIXTURE_SPECS = [
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

const DAISY_LINKS = [
  { id: 0, fromId: 'CONSOLE_OUT', toId: 'P0_IN', label: 'Pupitre DMX OUT → PAR-1 IN' },
  { id: 1, fromId: 'P0_OUT', toId: 'P1_IN', label: 'PAR-1 OUT → MOV-2 IN' },
  { id: 2, fromId: 'P1_OUT', toId: 'P2_IN', label: 'MOV-2 OUT → MOV-3 IN' },
  { id: 3, fromId: 'P2_OUT', toId: 'P3_IN', label: 'MOV-3 OUT → PAR-4 IN' }
];

const CAM_VIEWS = [
  { id: 'overview', label: 'Vue Scène Globale', pos: [0.0, 1.0, 1.66], lookAt: [0, 0.36, -0.05], fov: 42 },
  { id: 'cabling', label: 'Câblage XLR & Bouchon', pos: [0.06, 0.88, 1.15], lookAt: [0.04, 0.56, -0.22], fov: 40 },
  { id: 'address', label: 'Écrans Arrière DMX', pos: [0.0, 0.78, -1.28], lookAt: [0, 0.62, -0.36], fov: 38 },
  { id: 'console', label: 'Pupitre Faders DMX', pos: [0.0, 0.56, 0.82], lookAt: [0, 0.08, 0.25], fov: 36 }
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
    envIntensity: 0.48
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
    const cablesConnected = state.cablesDone.size;
    const daisyOk = cablesConnected === DAISY_LINKS.length && state.terminatorInstalled;

    let overlaps = 0;
    const conflictingIds = new Set();
    for (let i = 0; i < state.fixtures.length; i++) {
      for (let j = i + 1; j < state.fixtures.length; j++) {
        if (Math.abs(state.fixtures[i].addr - state.fixtures[j].addr) < 8) {
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
      const fx = state.fixtures[i];
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

    return {
      cablesConnected,
      daisyOk,
      overlaps,
      conflictingIds,
      dmxNoOverlap: overlaps === 0,
      exactAddressesCount,
      matchedFixtures,
      aimScore,
      fixtureResults
    };
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

  function createXlrSocket(parent, localPos, portId, label) {
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.019, 0.019, 0.018, 16),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.35, metalness: 0.75 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(localPos);
    parent.add(ring);

    const worldAnchor = new THREE.Object3D();
    worldAnchor.position.copy(localPos);
    parent.add(worldAnchor);
    xlrPorts[portId] = { mesh: ring, anchor: worldAnchor, label };

    bench.addInteractive(ring, {
      label: `Port XLR ${label}`,
      cursor: 'pointer',
      onClick: () => handlePortClick(portId)
    });
    return ring;
  }

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

    createXlrSocket(podBox, new THREE.Vector3(-0.055, -0.02, -0.055), `P${i}_IN`, `${sp.code} DMX IN`);
    createXlrSocket(podBox, new THREE.Vector3(0.055, -0.02, -0.055), `P${i}_OUT`, `${sp.code} DMX OUT`);

    const rearScreen = makeCanvasScreen(192, 96, (ctx, w, h) => {
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, w, h);
    });
    const rearScrMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.11, 0.052),
      new THREE.MeshBasicMaterial({ map: rearScreen.texture })
    );
    rearScrMesh.rotation.y = Math.PI;
    rearScrMesh.position.set(0, 0.028, -0.052);
    podBox.add(rearScrMesh);

    const minusBtn = new THREE.Mesh(
      new THREE.BoxGeometry(0.026, 0.02, 0.012),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4 })
    );
    minusBtn.position.set(0.042, -0.02, -0.053);
    podBox.add(minusBtn);
    bench.addInteractive(minusBtn, {
      label: `${sp.code} Adresse -4`,
      cursor: 'pointer',
      onClick: () => {
        state.selectedFixture = i;
        state.fixtures[i].addr = Math.max(1, state.fixtures[i].addr - 4);
        sfx.click();
        syncDmx3D();
        refreshUi();
      }
    });

    const plusBtn = new THREE.Mesh(
      new THREE.BoxGeometry(0.026, 0.02, 0.012),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 })
    );
    plusBtn.position.set(-0.042, -0.02, -0.053);
    podBox.add(plusBtn);
    bench.addInteractive(plusBtn, {
      label: `${sp.code} Adresse +4`,
      cursor: 'pointer',
      onClick: () => {
        state.selectedFixture = i;
        state.fixtures[i].addr = Math.min(480, state.fixtures[i].addr + 4);
        sfx.click();
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
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.34, metalness: 0.78 })
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

    fixtureObjects.push({ panGroup, tiltGroup, lensMat, coneMat, spot, rearScreen });
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

  const termBenchPlug = new THREE.Group();
  termBenchPlug.position.set(0, 0.095, 0.02);
  splitterGroup.add(termBenchPlug);

  const termCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.055, 16),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3, metalness: 0.65 })
  );
  termCap.rotation.x = Math.PI / 2;
  termBenchPlug.add(termCap);

  const termTip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.02, 16),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.25, metalness: 0.85 })
  );
  termTip.rotation.x = Math.PI / 2;
  termTip.position.z = 0.032;
  termBenchPlug.add(termTip);

  function installTerminator() {
    if (state.terminatorInstalled) return;
    state.terminatorInstalled = true;
    termBenchPlug.visible = false;
    mountedTermPlug.visible = true;
    bench.spawnSparks([0.62, 0.85, -0.44], { color: 0x22c55e, count: 16, speed: 1.1 });
    sfx.success();
    syncDmx3D();
    refreshUi();
  }

  bench.addInteractive(termBenchPlug, {
    label: 'Bouchon Terminaison DMX 120 Ω (Cliquer pour brancher sur PAR-4 OUT)',
    cursor: 'pointer',
    onClick: installTerminator
  });

  const mountedTermPlug = termBenchPlug.clone();
  mountedTermPlug.position.set(0.625, 0.834, -0.45);
  mountedTermPlug.visible = false;
  bench.scene.add(mountedTermPlug);

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

  createXlrSocket(consoleGroup, new THREE.Vector3(-0.38, 0.052, -0.155), 'CONSOLE_OUT', 'Pupitre DMX OUT');

  const lcdScreen = makeCanvasScreen(420, 140, (ctx, w, h) => {
    ctx.fillStyle = '#061524';
    ctx.fillRect(0, 0, w, h);
  });
  const lcdMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.092),
    new THREE.MeshBasicMaterial({ map: lcdScreen.texture })
  );
  lcdMesh.rotation.x = -Math.PI / 2 + 0.14;
  lcdMesh.position.set(-0.26, 0.095, -0.055);
  consoleGroup.add(lcdMesh);

  const faderDefs = [
    { key: 'master', label: 'Master', max: 100, color: 0xf8fafc, x: -0.02 },
    { key: 'r', label: 'Rouge R', max: 255, color: 0xef4444, x: 0.075 },
    { key: 'g', label: 'Vert G', max: 255, color: 0x22c55e, x: 0.17 },
    { key: 'b', label: 'Bleu B', max: 255, color: 0x3b82f6, x: 0.265 },
    { key: 'pan', label: 'Pan X', max: 100, color: 0xf59e0b, x: 0.36 },
    { key: 'tilt', label: 'Tilt Y', max: 100, color: 0xa855f7, x: 0.44 }
  ];

  const faderKnobs = [];
  const faderPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.095);
  for (const fd of faderDefs) {
    const slot = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.01, 0.17),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 })
    );
    slot.position.set(fd.x, 0.088, 0.015);
    slot.rotation.x = 0.14;
    consoleGroup.add(slot);

    const knob = new THREE.Mesh(
      new THREE.BoxGeometry(0.044, 0.024, 0.028),
      new THREE.MeshStandardMaterial({ color: fd.color, roughness: 0.3, metalness: 0.25 })
    );
    knob.position.set(fd.x, 0.1, 0.015);
    knob.castShadow = true;
    consoleGroup.add(knob);
    faderKnobs.push({ def: fd, knob });

    bench.addInteractive(knob, {
      label: `Fader DMX ${fd.label}`,
      cursor: 'ns-resize',
      dragPlane: faderPlane,
      onDragMove: (_pt, _dx, dy) => {
        const fx = state.fixtures[state.selectedFixture];
        const step = (-dy / 120) * fd.max;
        fx[fd.key] = Math.max(0, Math.min(fd.max, Math.round(fx[fd.key] + step)));
        syncDmx3D();
        refreshUi();
      }
    });
  }

  const fixBtns = [];
  for (let i = 0; i < 4; i++) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x000000 });
    const btn = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.02, 0.042), mat);
    btn.position.set(-0.37 + i * 0.085, 0.085, 0.085);
    consoleGroup.add(btn);
    fixBtns.push(mat);

    bench.addInteractive(btn, {
      label: `Sélection ${FIXTURE_SPECS[i].code}`,
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
    if (portId === 'P3_OUT' && state.cablesDone.size === DAISY_LINKS.length && !state.terminatorInstalled) {
      installTerminator();
      return;
    }

    if (!state.selectedPort) {
      state.selectedPort = portId;
      sfx.click();
      bench.showToast(`Port ${xlrPorts[portId]?.label} sélectionné — cliquez la prise suivante`, 'info');
      syncDmx3D();
      refreshUi();
      return;
    }

    if (state.selectedPort === portId) {
      state.selectedPort = null;
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
      sfx.snap();
      bench.showToast(`Câble XLR relié : ${matched.label}`, 'success');
      rebuildXlrCables();
      syncDmx3D();
    } else {
      sfx.error();
      bench.showToast('Ordre Daisy-Chain incorrect : reliez OUT → IN en série', 'error');
      syncDmx3D();
    }
    refreshUi();
  }

  function connectNextXlr() {
    const nextLink = DAISY_LINKS.find((lk) => !state.cablesDone.has(lk.id));
    if (nextLink) {
      state.cablesDone.add(nextLink.id);
      sfx.snap();
      bench.showToast(`Câble XLR relié : ${nextLink.label}`, 'success');
      rebuildXlrCables();
      syncDmx3D();
      refreshUi();
    } else if (!state.terminatorInstalled) {
      installTerminator();
    }
  }

  function rebuildXlrCables() {
    while (cableGroup.children.length > 0) {
      const child = cableGroup.children.pop();
      if (child.geometry) child.geometry.dispose();
    }
    bench.scene.updateMatrixWorld(true);
    for (const lk of DAISY_LINKS) {
      if (!state.cablesDone.has(lk.id)) continue;
      const pA = new THREE.Vector3();
      const pB = new THREE.Vector3();
      xlrPorts[lk.fromId].anchor.getWorldPosition(pA);
      xlrPorts[lk.toId].anchor.getWorldPosition(pB);
      const mid = pA.clone().lerp(pB, 0.5);
      mid.y -= lk.id === 0 ? 0.12 : 0.08;
      mid.z -= 0.05;
      const cableObj = buildFlexibleCable([pA, mid, pB], '#0ea5e9', 0.0085, '#0284c7');
      cableGroup.add(cableObj.mesh);
    }
  }

  function drawLcdScreen(ev) {
    const { ctx, canvas, texture } = lcdScreen;
    ctx.fillStyle = '#061524';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = ev.matchedFixtures === 4 ? '#22c55e' : '#38bdf8';
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

  function drawRearFixtureScreen(i, ev) {
    const scr = fixtureObjects[i].rearScreen;
    const { ctx, canvas, texture } = scr;
    const fx = state.fixtures[i];
    const sp = FIXTURE_SPECS[i];
    const ok = fx.addr === sp.targetAddr && !ev.conflictingIds.has(i);

    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = ok ? '#22c55e' : '#ef4444';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`${sp.code} CIBLE: A${String(sp.targetAddr).padStart(3, '0')}`, 12, 26);

    ctx.fillStyle = ok ? '#4ade80' : '#fbbf24';
    ctx.font = 'bold 34px monospace';
    ctx.fillText(`A${String(fx.addr).padStart(3, '0')}`, 42, 72);
    texture.needsUpdate = true;
  }

  function syncDmx3D() {
    const ev = evaluateDmx();
    const curFx = state.fixtures[state.selectedFixture];

    for (const item of faderKnobs) {
      const ratio = curFx[item.def.key] / item.def.max;
      item.knob.position.z = 0.085 - ratio * 0.14;
    }

    for (let i = 0; i < 4; i++) {
      const active = i === state.selectedFixture;
      fixBtns[i].color.setHex(active ? 0x38bdf8 : 0x334155);
      fixBtns[i].emissive.setHex(active ? 0x0284c7 : 0x000000);

      const fx = state.fixtures[i];
      const obj = fixtureObjects[i];
      obj.panGroup.rotation.y = ((fx.pan - 50) / 50) * 0.72;
      obj.tiltGroup.rotation.x = 0.42 + (fx.tilt / 100) * 0.75;

      const cableActive = state.cablesDone.has(i);
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

      drawRearFixtureScreen(i, ev);
    }

    for (const [pid, port] of Object.entries(xlrPorts)) {
      const isSel = state.selectedPort === pid;
      port.mesh.material.color.setHex(isSel ? 0xfbbf24 : 0x38bdf8);
      port.mesh.material.emissive.setHex(isSel ? 0xf59e0b : 0x000000);
      port.mesh.material.emissiveIntensity = isSel ? 0.7 : 0;
    }

    drawLcdScreen(ev);
  }

  function setCameraById(id) {
    const cam = CAM_VIEWS.find((c) => c.id === id) || CAM_VIEWS[0];
    state.camId = cam.id;
    bench.setCameraView(cam.pos, cam.lookAt, cam.fov);
    bench.setCameras(CAM_VIEWS, cam.id, setCameraById);
  }

  function updateSidebar() {
    const ev = evaluateDmx();
    const selSpec = FIXTURE_SPECS[state.selectedFixture];
    const fx = state.fixtures[state.selectedFixture];

    const linkRows = DAISY_LINKS.map((lk) => {
      const ok = state.cablesDone.has(lk.id);
      return `<div style="display:flex;justify-content:space-between;padding:3px 6px;border-radius:4px;background:rgba(15,23,42,0.55);color:${
        ok ? '#4ade80' : '#cbd5e1'
      };"><span>${lk.label}</span><span>${ok ? 'OK' : 'À relier'}</span></div>`;
    }).join('');

    const fixCards = FIXTURE_SPECS.map((sp, i) => {
      const res = ev.fixtureResults[i];
      const f = state.fixtures[i];
      const active = i === state.selectedFixture;
      return `<div data-sel="${i}" style="padding:5px 7px;border-radius:6px;cursor:pointer;background:${
        active ? 'rgba(56,189,248,0.22)' : 'rgba(15,23,42,0.55)'
      };border:1px solid ${res.ok ? 'rgba(34,197,94,0.6)' : res.addrExact ? 'rgba(56,189,248,0.45)' : 'rgba(239,68,68,0.6)'};">
        <div style="display:flex;justify-content:space-between;font-weight:700;">
          <span>${sp.code} (${sp.role})</span>
          <span style="color:${res.addrExact ? '#4ade80' : '#fbbf24'};">A${String(f.addr).padStart(3, '0')} / cible A${String(sp.targetAddr).padStart(3, '0')}</span>
        </div>
        <div style="font-size:10px;color:${res.ok ? '#4ade80' : '#cbd5e1'};">${res.ok ? 'Scène DMX conforme OK' : sp.hint}</div>
      </div>`;
    }).join('');

    const drawer = bench.setSideDrawer(`
      <div style="display:flex;flex-direction:column;gap:6px;font-size:11px;">
        <div style="font-weight:800;color:#38bdf8;font-size:12px;">1. DAISY-CHAIN XLR (${ev.cablesConnected}/4) & 120 Ω</div>
        <div style="display:flex;flex-direction:column;gap:3px;">${linkRows}</div>
        <div style="display:flex;gap:4px;">
          <button id="dmx-next-xlr" style="flex:1;padding:5px;border-radius:5px;border:none;background:#0284c7;color:#fff;font-weight:700;cursor:pointer;">${
            ev.cablesConnected < 4 ? 'Relier câble XLR suivant' : state.terminatorInstalled ? 'Bus XLR + 120Ω OK' : 'Brancher Bouchon 120 Ω'
          }</button>
        </div>

        <div style="font-weight:800;color:#a855f7;font-size:12px;margin-top:2px;">2. ADRESSAGE & 3. SCÈNE DMX512</div>
        <div style="display:flex;flex-direction:column;gap:4px;">${fixCards}</div>

        <div style="padding:6px;border-radius:6px;background:rgba(15,23,42,0.86);color:#f8fafc;border:1px solid #334155;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <strong>${selSpec.code} Adresse :</strong>
            <div style="display:flex;gap:4px;align-items:center;">
              <button data-addr="-4" style="padding:2px 6px;border-radius:4px;border:1px solid #475569;background:#1e293b;color:#fff;cursor:pointer;">-4</button>
              <button data-addr="-1" style="padding:2px 6px;border-radius:4px;border:1px solid #475569;background:#1e293b;color:#fff;cursor:pointer;">-1</button>
              <span style="font-family:monospace;font-weight:700;color:#38bdf8;min-width:44px;text-align:center;">A${String(fx.addr).padStart(3, '0')}</span>
              <button data-addr="1" style="padding:2px 6px;border-radius:4px;border:1px solid #475569;background:#1e293b;color:#fff;cursor:pointer;">+1</button>
              <button data-addr="4" style="padding:2px 6px;border-radius:4px;border:1px solid #475569;background:#1e293b;color:#fff;cursor:pointer;">+4</button>
            </div>
          </div>
          ${faderDefs
            .map(
              (fd) => `
            <label style="display:flex;align-items:center;gap:6px;margin-top:2px;">
              <span style="width:52px;color:#cbd5e1;">${fd.label}</span>
              <input type="range" min="0" max="${fd.max}" value="${fx[fd.key]}" data-fader="${fd.key}" style="flex:1;" />
              <span style="width:28px;text-align:right;font-family:monospace;">${fx[fd.key]}</span>
            </label>`
            )
            .join('')}
        </div>
      </div>
    `);

    if (!drawer) return;
    const xlrBtn = drawer.querySelector('#dmx-next-xlr');
    if (xlrBtn) xlrBtn.addEventListener('click', connectNextXlr);

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
        fxCur.addr = Math.max(1, Math.min(500, fxCur.addr + delta));
        sfx.snap();
        syncDmx3D();
        refreshUi();
      });
    });
    drawer.querySelectorAll('[data-fader]').forEach((inp) => {
      inp.addEventListener('input', () => {
        state.fixtures[state.selectedFixture][inp.dataset.fader] = Number(inp.value);
        syncDmx3D();
        const span = inp.nextElementSibling;
        if (span) span.textContent = inp.value;
      });
      inp.addEventListener('change', () => refreshUi());
    });
  }

  function syncStagesBar(ev) {
    const stepIdx = !ev.daisyOk
      ? 0
      : ev.exactAddressesCount < 4 || !ev.dmxNoOverlap
      ? 1
      : 2;
    api.setStages(
      [
        { name: `1. XLR & 120 Ω (${ev.cablesConnected}/4)` },
        { name: `2. Adressage (${ev.exactAddressesCount}/4)` },
        { name: `3. Faders & Scène (${ev.matchedFixtures}/4)` }
      ],
      stepIdx,
      (idx) => {
        if (idx === 0) setCameraById('cabling');
        else if (idx === 1) setCameraById('address');
        else setCameraById('console');
      }
    );
  }

  function refreshUi() {
    const ev = evaluateDmx();
    const estScore = computeDmxScore3D({
      cablesConnected: ev.cablesConnected,
      terminatorInstalled: state.terminatorInstalled,
      exactAddressesCount: ev.exactAddressesCount,
      dmxNoOverlap: ev.dmxNoOverlap,
      overlapCount: ev.overlaps,
      matchedFixtures: ev.matchedFixtures,
      aimScore: ev.aimScore,
      elapsedSec: (performance.now() - state.startMs) / 1000
    });

    const stepSub = state.selectedPort
      ? `Port sélectionné : ${xlrPorts[state.selectedPort]?.label} — cliquez le port suivant sur le Truss ou Pupitre.`
      : '1) Câblez les 4 liens XLR en série + bouchon 120 Ω  2) Réglez A001/A009/A017/A025  3) Glissez les faders RGB/Pan/Tilt.';

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
        id: 'finish-btn',
        label: 'Valider Scène DMX',
        primary: ev.daisyOk && ev.matchedFixtures >= 3,
        disabled: state.submitted,
        onClick: () => {
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
          if (finalScore >= 12) sfx.success();
          else sfx.error();
          api.finishTp(
            finalScore,
            `
              <p>Plateforme Éclairage DMX512 évaluée :</p>
              <ul>
                <li>Liaison série XLR-5 : <strong>${finalEv.cablesConnected}/4 câbles</strong> • Bouchon 120 Ω : <strong>${state.terminatorInstalled ? 'Installé' : 'Absent'}</strong></li>
                <li>Adressage DMX sans conflit : <strong>${finalEv.exactAddressesCount}/4 adresses exactes</strong> (Conflits : ${finalEv.overlaps})</li>
                <li>Restitution chromatique & orientation : <strong>${finalEv.matchedFixtures}/4 projecteurs conformes</strong></li>
              </ul>
            `
          );
        }
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
        const cableActive = state.cablesDone.has(i);
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
