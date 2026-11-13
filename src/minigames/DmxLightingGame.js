import * as THREE from 'three';
import { sfx } from '../core/audio.js';
import {
  createWorkbench3D,
  makeCanvasScreen,
  buildFlexibleCable,
  createEsdMatTexture
} from './Workbench3DHost.js';

export function computeDmxScore3D(metrics = {}) {
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
    x: -0.54,
    startAddr: 1,
    targetAddr: 1,
    target: { master: 85, r: 245, g: 235, b: 220, pan: 58, tilt: 55 },
    hint: 'Blanc chaud neutre orienté sur le sujet (Pan ~58, Tilt ~55, Master ~85)'
  },
  {
    id: 1,
    code: 'PAR-2',
    role: 'Fill Bleu (Ambiance)',
    x: -0.18,
    startAddr: 3,
    targetAddr: 5,
    target: { master: 75, r: 40, g: 130, b: 255, pan: 52, tilt: 50 },
    hint: 'Bleu studio (B ~255, R < 80) + Adresse sans conflit'
  },
  {
    id: 2,
    code: 'MOV-3',
    role: 'Contre Ambre/Magenta',
    x: 0.18,
    startAddr: 9,
    targetAddr: 9,
    target: { master: 80, r: 255, g: 60, b: 170, pan: 46, tilt: 52 },
    hint: 'Magenta scénique (R ~255, B ~170, G < 90)'
  },
  {
    id: 3,
    code: 'PAR-4',
    role: 'Wash Fond Vert/Cyan',
    x: 0.54,
    startAddr: 10,
    targetAddr: 13,
    target: { master: 80, r: 25, g: 235, b: 140, pan: 42, tilt: 48 },
    hint: 'Émeraude/Cyan fond (G ~235, R < 70) + Adresse >= CH 013'
  }
];

const CAM_VIEWS = [
  { id: 'overview', label: 'Vue Scène & Pupitre', pos: [0.02, 0.96, 1.62], lookAt: [0, 0.36, -0.05], fov: 42 },
  { id: 'truss', label: 'Pont Lumière Truss', pos: [0.0, 0.72, 1.05], lookAt: [0, 0.54, -0.34], fov: 40 },
  { id: 'decoder', label: 'Décodeur DMX512', pos: [-0.62, 0.44, 0.62], lookAt: [-0.62, 0.1, 0.14], fov: 35 },
  { id: 'console', label: 'Pupitre Faders DMX', pos: [0.16, 0.52, 0.74], lookAt: [0.16, 0.08, 0.24], fov: 36 }
];

export function createDmxLightingGame(api) {
  const bench = createWorkbench3D(api.container, {
    cameraPos: CAM_VIEWS[0].pos,
    lookAt: CAM_VIEWS[0].lookAt,
    fov: CAM_VIEWS[0].fov,
    hasEsdMat: false
  });

  const esdTex = createEsdMatTexture();
  const stageDeck = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.014, 1.0),
    new THREE.MeshStandardMaterial({ map: esdTex, roughness: 0.68, metalness: 0.08 })
  );
  stageDeck.position.set(0, 0.007, 0.05);
  stageDeck.receiveShadow = true;
  bench.scene.add(stageDeck);

  const stagePlatform = new THREE.Mesh(
    new THREE.BoxGeometry(1.48, 0.04, 0.56),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6, metalness: 0.2 })
  );
  stagePlatform.position.set(0, 0.032, -0.22);
  stagePlatform.receiveShadow = true;
  bench.scene.add(stagePlatform);

  const presenterGroup = new THREE.Group();
  presenterGroup.position.set(0, 0.052, -0.22);
  bench.scene.add(presenterGroup);
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.08, 0.24, 16),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.65 })
  );
  torso.position.y = 0.12;
  torso.castShadow = true;
  presenterGroup.add(torso);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.55 })
  );
  head.position.y = 0.295;
  head.castShadow = true;
  presenterGroup.add(head);

  const state = {
    camId: 'overview',
    selectedFixture: 0,
    fixtures: FIXTURE_SPECS.map((sp) => ({
      addr: sp.startAddr,
      master: 25,
      r: 120,
      g: 120,
      b: 120,
      pan: 25,
      tilt: 25
    })),
    startMs: performance.now(),
    submitted: false
  };

  function getAddressOverlaps() {
    let overlaps = 0;
    const conflictingIds = new Set();
    for (let i = 0; i < state.fixtures.length; i++) {
      for (let j = i + 1; j < state.fixtures.length; j++) {
        const a1 = state.fixtures[i].addr;
        const a2 = state.fixtures[j].addr;
        if (Math.abs(a1 - a2) < 4) {
          overlaps += 1;
          conflictingIds.add(i);
          conflictingIds.add(j);
        }
      }
    }
    return { overlaps, conflictingIds };
  }

  function evaluateDmx() {
    const { overlaps, conflictingIds } = getAddressOverlaps();
    let matchedFixtures = 0;
    let aimScore = 0;
    const fixtureResults = [];

    for (let i = 0; i < FIXTURE_SPECS.length; i++) {
      const sp = FIXTURE_SPECS[i];
      const fx = state.fixtures[i];
      const t = sp.target;

      const colorOk =
        fx.master >= 60 &&
        Math.abs(fx.r - t.r) <= 55 &&
        Math.abs(fx.g - t.g) <= 55 &&
        Math.abs(fx.b - t.b) <= 55;
      const aimOk = Math.abs(fx.pan - t.pan) <= 18 && Math.abs(fx.tilt - t.tilt) <= 18;
      if (aimOk) aimScore += 1;
      const addrClean = !conflictingIds.has(i);
      const ok = colorOk && aimOk && addrClean;
      if (ok) matchedFixtures += 1;
      fixtureResults.push({ ok, colorOk, aimOk, addrClean });
    }

    return {
      overlaps,
      conflictingIds,
      dmxNoOverlap: overlaps === 0,
      matchedFixtures,
      aimScore,
      fixtureResults
    };
  }

  const trussGroup = new THREE.Group();
  trussGroup.position.set(0, 0.014, -0.38);
  bench.scene.add(trussGroup);

  const metalMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.28, metalness: 0.85 });
  const leftTower = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.84, 0.05), metalMat);
  leftTower.position.set(-0.78, 0.42, 0);
  leftTower.castShadow = true;
  trussGroup.add(leftTower);

  const rightTower = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.84, 0.05), metalMat);
  rightTower.position.set(0.78, 0.42, 0);
  rightTower.castShadow = true;
  trussGroup.add(rightTower);

  const topBeam = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.055, 0.055), metalMat);
  topBeam.position.set(0, 0.83, 0);
  topBeam.castShadow = true;
  trussGroup.add(topBeam);

  const dmxDataCable = buildFlexibleCable(
    new THREE.Vector3(-0.62, 0.08, 0.14),
    new THREE.Vector3(-0.76, 0.78, -0.38),
    0x0ea5e9,
    0.007,
    0.08
  );
  bench.scene.add(dmxDataCable);

  const fixtureObjects = [];
  for (let i = 0; i < FIXTURE_SPECS.length; i++) {
    const sp = FIXTURE_SPECS[i];
    const mount = new THREE.Group();
    mount.position.set(sp.x, 0.79, 0.02);
    trussGroup.add(mount);

    const clamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.04, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.7 })
    );
    mount.add(clamp);

    const panGroup = new THREE.Group();
    panGroup.position.y = -0.04;
    mount.add(panGroup);

    const yoke = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.09, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.65 })
    );
    yoke.position.y = -0.045;
    panGroup.add(yoke);

    const tiltGroup = new THREE.Group();
    tiltGroup.position.set(0, -0.06, 0.01);
    panGroup.add(tiltGroup);

    const headBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.056, 0.12, 16),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.35, metalness: 0.75 })
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
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.25, 0.82, 18, 1, true), coneMat);
    cone.rotation.x = -Math.PI / 2;
    cone.position.set(0, 0, 0.47);
    tiltGroup.add(cone);

    const spot = new THREE.SpotLight(0xffffff, 2.2, 2.8, Math.PI / 5, 0.45, 1.2);
    spot.position.set(0, 0, 0.06);
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, 0, 1.0);
    tiltGroup.add(spotTarget);
    spot.target = spotTarget;
    tiltGroup.add(spot);

    bench.addInteractive(mount, {
      label: `Projecteur ${sp.code} (${sp.role})`,
      cursor: 'pointer',
      onClick: () => {
        state.selectedFixture = i;
        sfx.click();
        refreshUi();
      }
    });

    fixtureObjects.push({ panGroup, tiltGroup, lensMat, coneMat, spot });
  }

  const decoderGroup = new THREE.Group();
  decoderGroup.position.set(-0.62, 0.014, 0.14);
  bench.scene.add(decoderGroup);

  const decoderBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.1, 0.24),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.42, metalness: 0.55 })
  );
  decoderBox.position.y = 0.05;
  decoderBox.castShadow = true;
  decoderGroup.add(decoderBox);

  const decoderScreen = makeCanvasScreen(384, 180);
  const decScreenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.28, 0.12),
    new THREE.MeshBasicMaterial({ map: decoderScreen.texture })
  );
  decScreenMesh.rotation.x = -Math.PI / 2;
  decScreenMesh.position.set(0, 0.102, -0.03);
  decoderGroup.add(decScreenMesh);

  const dipSwitches = [];
  for (let i = 0; i < 4; i++) {
    const sx = -0.09 + i * 0.06;
    const sw = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.022, 0.036),
      new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.35 })
    );
    sw.position.set(sx, 0.11, 0.07);
    decoderGroup.add(sw);
    dipSwitches.push(sw);

    bench.addInteractive(sw, {
      label: `DIP DMX ${FIXTURE_SPECS[i].code} (+4 canaux)`,
      cursor: 'pointer',
      onClick: () => {
        state.selectedFixture = i;
        const fx = state.fixtures[i];
        const nextAddr = fx.addr >= 17 ? 1 : fx.addr + 4;
        fx.addr = nextAddr;
        sfx.snap();
        syncFixtures3D();
        refreshUi();
      }
    });
  }

  const consoleGroup = new THREE.Group();
  consoleGroup.position.set(0.16, 0.014, 0.24);
  bench.scene.add(consoleGroup);

  const consoleDeck = new THREE.Mesh(
    new THREE.BoxGeometry(0.84, 0.08, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.42, metalness: 0.65 })
  );
  consoleDeck.position.y = 0.04;
  consoleDeck.rotation.x = 0.16;
  consoleDeck.castShadow = true;
  consoleGroup.add(consoleDeck);

  const faderDefs = [
    { key: 'master', label: 'Master', max: 100, color: 0xf8fafc, x: -0.3 },
    { key: 'r', label: 'Rouge R', max: 255, color: 0xef4444, x: -0.18 },
    { key: 'g', label: 'Vert G', max: 255, color: 0x22c55e, x: -0.06 },
    { key: 'b', label: 'Bleu B', max: 255, color: 0x3b82f6, x: 0.06 },
    { key: 'pan', label: 'Pan X', max: 100, color: 0xf59e0b, x: 0.18 },
    { key: 'tilt', label: 'Tilt Y', max: 100, color: 0xa855f7, x: 0.3 }
  ];

  const faderKnobs = [];
  const faderPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.09);

  for (const fd of faderDefs) {
    const slot = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, 0.01, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 })
    );
    slot.position.set(fd.x, 0.084, 0);
    slot.rotation.x = 0.16;
    consoleGroup.add(slot);

    const knob = new THREE.Mesh(
      new THREE.BoxGeometry(0.048, 0.026, 0.03),
      new THREE.MeshStandardMaterial({ color: fd.color, roughness: 0.3, metalness: 0.25 })
    );
    knob.position.set(fd.x, 0.098, 0);
    knob.castShadow = true;
    consoleGroup.add(knob);
    faderKnobs.push({ def: fd, knob });

    bench.addInteractive(knob, {
      label: `Fader DMX ${fd.label} (Glisser avant/arrière)`,
      cursor: 'ns-resize',
      dragPlane: faderPlane,
      onDragMove: (_pt, _dx, dy) => {
        const fx = state.fixtures[state.selectedFixture];
        const step = (dy / 140) * fd.max;
        fx[fd.key] = Math.max(0, Math.min(fd.max, Math.round(fx[fd.key] + step)));
        syncFixtures3D();
        refreshUi();
      }
    });
  }

  const fixBtns = [];
  for (let i = 0; i < 4; i++) {
    const btnMat = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x000000 });
    const btn = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.02, 0.036), btnMat);
    btn.position.set(-0.27 + i * 0.18, 0.072, 0.115);
    consoleGroup.add(btn);
    fixBtns.push(btnMat);

    bench.addInteractive(btn, {
      label: `Sélectionner ${FIXTURE_SPECS[i].code}`,
      cursor: 'pointer',
      onClick: () => {
        state.selectedFixture = i;
        sfx.click();
        syncFixtures3D();
        refreshUi();
      }
    });
  }

  function syncFixtures3D() {
    const ev = evaluateDmx();
    const curFx = state.fixtures[state.selectedFixture];

    for (const item of faderKnobs) {
      const ratio = curFx[item.def.key] / item.def.max;
      item.knob.position.z = 0.075 - ratio * 0.15;
    }

    for (let i = 0; i < 4; i++) {
      const active = i === state.selectedFixture;
      fixBtns[i].color.setHex(active ? 0x38bdf8 : 0x334155);
      fixBtns[i].emissive.setHex(active ? 0x0284c7 : 0x000000);

      const conflict = ev.conflictingIds.has(i);
      dipSwitches[i].material.color.setHex(conflict ? 0xef4444 : 0x22c55e);

      const fx = state.fixtures[i];
      const obj = fixtureObjects[i];
      const panAngle = ((fx.pan - 50) / 50) * 0.72;
      const tiltAngle = 0.42 + (fx.tilt / 100) * 0.75;
      obj.panGroup.rotation.y = panAngle;
      obj.tiltGroup.rotation.x = tiltAngle;

      const c = new THREE.Color(fx.r / 255, fx.g / 255, fx.b / 255);
      const intensity = (fx.master / 100) * (conflict ? 0.55 : 1.0);
      obj.lensMat.color.copy(c);
      obj.lensMat.emissive.copy(c);
      obj.lensMat.emissiveIntensity = 0.25 + intensity * 1.4;
      obj.coneMat.color.copy(c);
      obj.coneMat.opacity = intensity * 0.26;
      obj.spot.color.copy(c);
      obj.spot.intensity = intensity * 3.8;
    }

    drawDecoderScreen(ev);
  }

  function drawDecoderScreen(ev) {
    const { ctx, canvas, texture } = decoderScreen;
    ctx.fillStyle = '#07111e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = ev.dmxNoOverlap ? '#22c55e' : '#ef4444';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('DECODEUR DMX512 (4 CH / PROJ)', 14, 28);

    state.fixtures.forEach((fx, i) => {
      const conflict = ev.conflictingIds.has(i);
      ctx.fillStyle = conflict ? '#f87171' : '#4ade80';
      ctx.font = 'bold 17px monospace';
      const endCh = fx.addr + 3;
      ctx.fillText(
        `${FIXTURE_SPECS[i].code}: CH ${String(fx.addr).padStart(3, '0')}-${String(endCh).padStart(3, '0')} ${conflict ? 'CONFLIT!' : 'OK'}`,
        16,
        58 + i * 26
      );
    });

    ctx.fillStyle = ev.dmxNoOverlap ? '#4ade80' : '#fbbf24';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(
      ev.dmxNoOverlap ? 'BUS DMX PROPRE - 0 COLLISION' : 'CLIQUEZ LES DIP ROUGES POUR DECALER',
      14,
      166
    );
    texture.needsUpdate = true;
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

    const fixCards = FIXTURE_SPECS.map((sp, i) => {
      const res = ev.fixtureResults[i];
      const f = state.fixtures[i];
      const active = i === state.selectedFixture;
      return `<div data-sel="${i}" style="padding:5px 7px;border-radius:6px;cursor:pointer;background:${
        active ? 'rgba(56,189,248,0.2)' : 'rgba(15,23,42,0.55)'
      };border:1px solid ${res.ok ? 'rgba(34,197,94,0.55)' : res.addrClean ? 'rgba(148,163,184,0.35)' : 'rgba(239,68,68,0.7)'};">
        <div style="display:flex;justify-content:space-between;font-weight:700;">
          <span>${sp.code} (${sp.role})</span>
          <span style="color:${res.addrClean ? '#38bdf8' : '#f87171'};">CH ${String(f.addr).padStart(3, '0')}</span>
        </div>
        <div style="font-size:10px;color:${res.ok ? '#4ade80' : '#cbd5e1'};">${res.ok ? 'Calibré OK' : sp.hint}</div>
      </div>`;
    }).join('');

    const drawer = bench.setSideDrawer(`
      <div style="display:flex;flex-direction:column;gap:7px;font-size:11px;">
        <div style="font-weight:800;color:#38bdf8;font-size:12px;">PROJECTEURS & ADRESSAGE DMX512</div>
        <div style="display:flex;flex-direction:column;gap:4px;">${fixCards}</div>

        <div style="padding:7px;border-radius:6px;background:rgba(15,23,42,0.7);border:1px solid #334155;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <strong>${selSpec.code} • Adresse DMX</strong>
            <div style="display:flex;gap:4px;">
              <button data-addr="-1" style="padding:2px 7px;border-radius:4px;border:1px solid #475569;background:#1e293b;color:#fff;cursor:pointer;">-1</button>
              <span style="font-family:monospace;font-weight:700;color:#38bdf8;min-width:46px;text-align:center;">CH ${String(fx.addr).padStart(3, '0')}</span>
              <button data-addr="1" style="padding:2px 7px;border-radius:4px;border:1px solid #475569;background:#1e293b;color:#fff;cursor:pointer;">+1</button>
            </div>
          </div>
          ${faderDefs
            .map(
              (fd) => `
            <label style="display:flex;align-items:center;gap:6px;margin-top:3px;">
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
    drawer.querySelectorAll('[data-sel]').forEach((el) => {
      el.addEventListener('click', () => {
        state.selectedFixture = Number(el.dataset.sel);
        sfx.click();
        syncFixtures3D();
        refreshUi();
      });
    });
    drawer.querySelectorAll('[data-addr]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const delta = Number(btn.dataset.addr);
        const fxCur = state.fixtures[state.selectedFixture];
        fxCur.addr = Math.max(1, Math.min(500, fxCur.addr + delta));
        sfx.snap();
        syncFixtures3D();
        refreshUi();
      });
    });
    drawer.querySelectorAll('[data-fader]').forEach((inp) => {
      inp.addEventListener('input', () => {
        state.fixtures[state.selectedFixture][inp.dataset.fader] = Number(inp.value);
        syncFixtures3D();
        const span = inp.nextElementSibling;
        if (span) span.textContent = inp.value;
      });
      inp.addEventListener('change', () => refreshUi());
    });
  }

  function refreshUi() {
    const ev = evaluateDmx();
    const estScore = computeDmxScore3D({
      dmxNoOverlap: ev.dmxNoOverlap,
      overlapCount: ev.overlaps,
      matchedFixtures: ev.matchedFixtures,
      aimScore: ev.aimScore,
      elapsedSec: (performance.now() - state.startMs) / 1000
    });

    bench.setInstruction(
      'ATELIER ÉCLAIRAGE SCÉNIQUE DMX512 3D',
      `Conflits DMX: ${ev.overlaps} • Projecteurs calibrés: ${ev.matchedFixtures}/4`,
      'Supprimez les collisions d’adresses DMX (4 canaux/projecteur) sur le décodeur, puis réglez RGB, Master, Pan & Tilt de chaque PAR.'
    );
    bench.setAccuracy(`Note est. ${estScore.toFixed(1)}/20`);

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
        syncFixtures3D();
        refreshUi();
      }
    );

    bench.setActions([
      {
        id: 'auto-addr-btn',
        label: 'Décaler adresse +4',
        primary: !ev.dmxNoOverlap,
        onClick: () => {
          const fx = state.fixtures[state.selectedFixture];
          fx.addr = fx.addr >= 17 ? 1 : fx.addr + 4;
          sfx.snap();
          syncFixtures3D();
          refreshUi();
        }
      },
      {
        id: 'finish-btn',
        label: 'Valider Scène DMX',
        primary: ev.dmxNoOverlap && ev.matchedFixtures >= 3,
        disabled: state.submitted,
        onClick: () => {
          if (state.submitted) return;
          state.submitted = true;
          const finalEv = evaluateDmx();
          const finalScore = computeDmxScore3D({
            dmxNoOverlap: finalEv.dmxNoOverlap,
            overlapCount: finalEv.overlaps,
            matchedFixtures: finalEv.matchedFixtures,
            aimScore: finalEv.aimScore,
            elapsedSec: (performance.now() - state.startMs) / 1000
          });
          const xp = Math.round(60 + finalScore * 6);
          if (finalScore >= 12) sfx.success();
          else sfx.error();
          api.onComplete?.({
            score: finalScore,
            xp,
            summary: `DMX ${finalEv.dmxNoOverlap ? '0 conflit' : `${finalEv.overlaps} conflits`} • ${finalEv.matchedFixtures}/4 projecteurs calibrés`
          });
        }
      }
    ]);

    updateSidebar();
  }

  bench.addFloatingTag([0, 0.92, -0.38], 'Pont Lumière DMX512', 'info');
  bench.addFloatingTag([-0.62, 0.18, 0.14], 'Décodeur & DIP DMX', 'info');
  bench.addFloatingTag([0.16, 0.16, 0.24], 'Pupitre Faders DMX', 'info');

  syncFixtures3D();
  setCameraById('overview');
  refreshUi();

  return {
    destroy: () => {
      bench.destroy();
    }
  };
}
