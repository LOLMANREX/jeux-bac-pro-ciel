import * as THREE from 'three';
import { sfx } from '../core/audio.js';
import {
  createWorkbench3D,
  makeCanvasScreen,
  buildFlexibleCable,
  createEsdMatTexture
} from './Workbench3DHost.js';

export const PATCH_STAGES = [
  {
    id: 1,
    name: '1. Brassage RJ45 Cat.6A',
    brief:
      'Reliez chaque prise du bandeau de brassage au port du Switch Core correspondant (respectez les VLANs et les liens Uplink 10G), puis activez la certification de lien.',
    panelPorts: [
      { id: 'PP-01', label: 'Banc Atelier (Admin)', targetPort: 'SW-01', media: 'cat6a', vlan: 10 },
      { id: 'PP-02', label: 'Mesure / Oscilloscopes', targetPort: 'SW-02', media: 'cat6a', vlan: 20 },
      { id: 'PP-03', label: 'Postes Cybersécurité', targetPort: 'SW-03', media: 'cat6a', vlan: 30 },
      { id: 'PP-04', label: 'Îlot Réseau & VM', targetPort: 'SW-SFP1', media: 'sfp10g', vlan: 'TRUNK' }
    ],
    switchPorts: [
      { id: 'SW-01', label: 'Gi1/0/1 • VLAN 10', media: 'cat6a', poe: false },
      { id: 'SW-02', label: 'Gi1/0/2 • VLAN 20', media: 'cat6a', poe: false },
      { id: 'SW-03', label: 'Gi1/0/3 • VLAN 30', media: 'cat6a', poe: false },
      { id: 'SW-SFP1', label: 'Te1/1/1 • SFP+ 10G TRUNK', media: 'sfp10g', poe: false }
    ],
    requireCleanFiber: false,
    requireRedundantPsu: false
  },
  {
    id: 2,
    name: '2. Fibre Optique & Baie Ondulée',
    brief:
      'Raccordez le coeur de réseau vers les armoires distantes en Fibre OS2 LC/APC : nettoyez les ferrules, sélectionnez le câble optique et activez la double alimentation ondulée.',
    panelPorts: [
      { id: 'FO-A', label: 'Fibre OS2 -> Armoire Distribution', targetPort: 'CORE-SFP1', media: 'fiber', vlan: 'TRUNK' },
      { id: 'FO-B', label: 'Fibre OS2 -> Baie Sécurité', targetPort: 'CORE-SFP2', media: 'fiber', vlan: 'TRUNK' },
      { id: 'MGMT', label: 'IPMI / iDRAC Serveurs', targetPort: 'CORE-MGMT', media: 'cat6a', vlan: 99 },
      { id: 'AP-HALL', label: 'Borne Wi-Fi 6E Hall (PoE+)', targetPort: 'CORE-POE', media: 'cat6a', vlan: 20 }
    ],
    switchPorts: [
      { id: 'CORE-SFP1', label: 'SFP+1 • OS2 Uplink 10G', media: 'fiber', poe: false },
      { id: 'CORE-SFP2', label: 'SFP+2 • OS2 Uplink 10G', media: 'fiber', poe: false },
      { id: 'CORE-MGMT', label: 'Gi0/0 • Out-of-Band VLAN 99', media: 'cat6a', poe: false },
      { id: 'CORE-POE', label: 'Gi1/0/24 • PoE+ 30W', media: 'cat6a', poe: true }
    ],
    requireCleanFiber: true,
    requireRedundantPsu: true
  }
];

export function evaluatePatchConfiguration(stage, state) {
  const links = state?.links || {};
  const mediaUsed = state?.mediaUsed || {};
  let correctLinks = 0;
  let correctMedia = 0;
  const details = [];

  for (const pp of stage.panelPorts) {
    const chosenTarget = links[pp.id];
    const chosenMedia = mediaUsed[pp.id];
    const targetOk = chosenTarget === pp.targetPort;
    const mediaOk = chosenMedia === pp.media;
    if (targetOk) correctLinks += 1;
    if (mediaOk) correctMedia += 1;
    if (!targetOk) {
      details.push(`${pp.id} : port switch attendu ${pp.targetPort} (reçu ${chosenTarget || 'non brassé'})`);
    } else if (!mediaOk) {
      details.push(`${pp.id} : cordon inadapté (attendu ${pp.media.toUpperCase()})`);
    }
  }

  let bonusChecks = 0;
  let bonusTotal = 0;
  if (stage.requireCleanFiber) {
    bonusTotal += 1;
    if (state?.fiberCleaned) bonusChecks += 1;
    else details.push('Ferrules optiques non nettoyées avant raccordement');
  }
  if (stage.requireRedundantPsu) {
    bonusTotal += 1;
    if (state?.psuBEnabled) bonusChecks += 1;
    else details.push('Alimentation redondante UPS-B non enclenchée');
  }

  const maxPoints = stage.panelPorts.length * 2 + bonusTotal;
  const earned = correctLinks + correctMedia + bonusChecks;
  const score = Math.round((earned / Math.max(1, maxPoints)) * 20);
  return {
    score,
    correctLinks,
    totalPorts: stage.panelPorts.length,
    correctMedia,
    details,
    passed: score >= 12
  };
}

export const T568B_ORDER = [
  { id: 'WO', pin: 1, name: 'Blanc-Orange', hex: 0xfef3c7, stripe: 0xf97316, css: '#fb923c' },
  { id: 'O', pin: 2, name: 'Orange', hex: 0xf97316, stripe: null, css: '#f97316' },
  { id: 'WG', pin: 3, name: 'Blanc-Vert', hex: 0xdcfce7, stripe: 0x16a34a, css: '#4ade80' },
  { id: 'BL', pin: 4, name: 'Bleu', hex: 0x2563eb, stripe: null, css: '#3b82f6' },
  { id: 'WBL', pin: 5, name: 'Blanc-Bleu', hex: 0xdbeafe, stripe: 0x2563eb, css: '#60a5fa' },
  { id: 'G', pin: 6, name: 'Vert', hex: 0x16a34a, stripe: null, css: '#22c55e' },
  { id: 'WBR', pin: 7, name: 'Blanc-Marron', hex: 0xf3e8d2, stripe: 0x78350f, css: '#b45309' },
  { id: 'BR', pin: 8, name: 'Marron', hex: 0x78350f, stripe: null, css: '#92400e' }
];

export function computePatchPanelScore3D(metrics = {}) {
  const matchedWires = Math.max(0, Math.min(8, metrics.t568bMatches ?? 0));
  const wirePts = (matchedWires / 8) * 6;
  const crimpPts = metrics.crimped ? (matchedWires === 8 ? 2 : 0.8) : 0;

  const totalLinks = Math.max(1, metrics.totalLinks ?? 6);
  const patchCorrect = Math.max(0, Math.min(totalLinks, metrics.patchCorrect ?? 0));
  const colorCorrect = Math.max(0, Math.min(totalLinks, metrics.colorCorrect ?? 0));
  const patchPts = (patchCorrect / totalLinks) * 6 + (colorCorrect / totalLinks) * 2.5;

  const tidyPts = metrics.guidesUsed ? 1.5 : 0;
  const testPts = metrics.continuityPassed ? 2 : metrics.testerRun ? 0.8 : 0;

  const elapsed = metrics.elapsedSec ?? 90;
  const timeBonus = elapsed < 80 ? 1 : elapsed < 140 ? 0.4 : 0;
  const raw = wirePts + crimpPts + patchPts + tidyPts + testPts + timeBonus;
  return Math.max(0, Math.min(20, Math.round(raw * 2) / 2));
}

export function computeRackVlanScore3D(metrics = {}) {
  const totalCables = Math.max(1, metrics.totalCables ?? 4);
  const matchedCables = Math.max(0, Math.min(totalCables, metrics.matchedCables ?? 0));
  const mediaOk = Math.max(0, Math.min(totalCables, metrics.mediaOk ?? 0));
  const cablePts = (matchedCables / totalCables) * 5.5 + (mediaOk / totalCables) * 2.5;
  const bonusPts = (metrics.fiberCleaned ? 1 : 0) + (metrics.psuRedundant ? 1 : 0);
  const vlansOk = Math.max(0, Math.min(3, metrics.vlansConfigured ?? 0));
  const portsOk = Math.max(0, Math.min(4, metrics.portsConfigured ?? 0));
  const pingTotal = Math.max(1, metrics.pingTotal ?? 3);
  const pingOk = Math.max(0, Math.min(pingTotal, metrics.pingSuccessCount ?? 0));
  const netPts = (vlansOk / 3) * 3 + (portsOk / 4) * 3 + (pingOk / pingTotal) * 3;
  const penalty = Math.min(3, (metrics.cableErrors ?? 0) * 0.5);
  const timeBonus = (metrics.elapsedSec ?? 180) < 160 ? 1 : 0;
  const score = Math.max(0, Math.min(20, Math.round((cablePts + bonusPts + netPts + timeBonus - penalty) * 2) / 2));
  const xp = Math.round(score * 16 + (score >= 16 ? 70 : 0));
  return { score, xp };
}

const CORD_PALETTE = [
  { id: 'blue', label: 'Bleu Admin', hex: 0x3b82f6, css: '#3b82f6' },
  { id: 'green', label: 'Vert Atelier', hex: 0x22c55e, css: '#22c55e' },
  { id: 'amber', label: 'Jaune VoIP / PoE', hex: 0xf59e0b, css: '#f59e0b' },
  { id: 'purple', label: 'Violet Uplink 10G', hex: 0xa855f7, css: '#a855f7' }
];

const PATCH_SPECS = [
  { panelIdx: 0, panelLabel: 'P01', switchIdx: 0, switchLabel: 'S01', color: 'blue', service: 'Admin Poste 1' },
  { panelIdx: 1, panelLabel: 'P02', switchIdx: 1, switchLabel: 'S02', color: 'blue', service: 'Admin Serveur' },
  { panelIdx: 4, panelLabel: 'P05', switchIdx: 4, switchLabel: 'S05', color: 'green', service: 'Atelier Banc 1' },
  { panelIdx: 5, panelLabel: 'P06', switchIdx: 5, switchLabel: 'S06', color: 'green', service: 'Atelier Banc 2' },
  { panelIdx: 8, panelLabel: 'P09', switchIdx: 8, switchLabel: 'S09', color: 'amber', service: 'Borne Wi-Fi PoE' },
  { panelIdx: 11, panelLabel: 'P12', switchIdx: 11, switchLabel: 'S12', color: 'purple', service: 'Uplink Baie' }
];

const CAM_VIEWS = [
  { id: 'overview', label: 'Vue Atelier', pos: [0.02, 1.18, 1.56], lookAt: [0.04, 0.34, -0.05], fov: 41 },
  { id: 'crimp', label: 'Sertissage RJ45', pos: [-0.56, 0.44, 0.56], lookAt: [-0.54, 0.08, 0.1], fov: 35 },
  { id: 'rack', label: 'Baie 19" Brassage', pos: [0.24, 0.52, 0.96], lookAt: [0.24, 0.44, -0.18], fov: 37 },
  { id: 'tester', label: 'Testeur Continuité', pos: [0.68, 0.46, 0.64], lookAt: [0.62, 0.12, 0.14], fov: 34 }
];

export function createPatchRackGame(api) {
  const bench = createWorkbench3D(api.container, {
    cameraPos: CAM_VIEWS[0].pos,
    lookAt: CAM_VIEWS[0].lookAt,
    fov: CAM_VIEWS[0].fov,
    hasEsdMat: false
  });

  const esdTex = createEsdMatTexture();
  const matMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.88, 0.01, 0.96),
    new THREE.MeshStandardMaterial({ map: esdTex, roughness: 0.72, metalness: 0.06 })
  );
  matMesh.position.set(0, 0.006, 0.08);
  matMesh.receiveShadow = true;
  bench.scene.add(matMesh);

  const initialOrder = [1, 0, 3, 2, 4, 5, 7, 6];
  const state = {
    camId: 'overview',
    wireSlots: initialOrder.map((idx) => T568B_ORDER[idx]),
    selectedSlot: null,
    crimped: false,
    crimpAnim: 0,
    activeCordColor: 'blue',
    selectedPanelIdx: null,
    links: {},
    guidesUsed: false,
    testerRunning: false,
    testerRunCount: 0,
    testerStep: -1,
    testerTimer: 0,
    testerPassed: false,
    startMs: performance.now(),
    submitted: false
  };

  function countT568bMatches() {
    let ok = 0;
    for (let i = 0; i < 8; i++) {
      if (state.wireSlots[i].id === T568B_ORDER[i].id) ok += 1;
    }
    return ok;
  }

  function evaluatePatchProgress() {
    let patchCorrect = 0;
    let colorCorrect = 0;
    for (const spec of PATCH_SPECS) {
      const link = state.links[spec.panelIdx];
      if (link && link.switchIdx === spec.switchIdx) {
        patchCorrect += 1;
        if (link.color === spec.color) colorCorrect += 1;
      }
    }
    return { patchCorrect, colorCorrect };
  }

  const crimpGroup = new THREE.Group();
  crimpGroup.position.set(-0.54, 0.012, 0.1);
  bench.scene.add(crimpGroup);

  const jigBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.028, 0.34),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.52, metalness: 0.35 })
  );
  jigBase.position.y = 0.014;
  jigBase.castShadow = true;
  jigBase.receiveShadow = true;
  crimpGroup.add(jigBase);

  const rj45Housing = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.036, 0.1),
    new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      roughness: 0.14,
      metalness: 0.05,
      transmission: 0.55,
      transparent: true,
      opacity: 0.8
    })
  );
  rj45Housing.position.set(0, 0.046, -0.09);
  crimpGroup.add(rj45Housing);

  const jacket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.038, 0.11, 18),
    new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5, metalness: 0.08 })
  );
  jacket.rotation.x = Math.PI / 2;
  jacket.position.set(0, 0.042, 0.11);
  jacket.castShadow = true;
  crimpGroup.add(jacket);

  const goldPins = [];
  const wireMeshes = [];
  const slotX = [-0.07, -0.05, -0.03, -0.01, 0.01, 0.03, 0.05, 0.07];

  for (let i = 0; i < 8; i++) {
    const pin = new THREE.Mesh(
      new THREE.BoxGeometry(0.011, 0.008, 0.026),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.25, metalness: 0.88 })
    );
    pin.position.set(slotX[i], 0.065, -0.11);
    crimpGroup.add(pin);
    goldPins.push(pin);

    const wGroup = new THREE.Group();
    const coreMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.1 });
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.0068, 0.0068, 0.15, 10), coreMat);
    core.rotation.x = Math.PI / 2;
    core.castShadow = true;
    wGroup.add(core);

    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.014, 0.12), stripeMat);
    wGroup.add(stripe);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.011, 0.0022, 8, 16),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0.008, 0.01);
    ring.visible = false;
    wGroup.add(ring);

    wGroup.position.set(slotX[i], 0.046, -0.01);
    crimpGroup.add(wGroup);
    wireMeshes.push({ group: wGroup, coreMat, stripe, stripeMat, ring, slotIdx: i });

    bench.addInteractive(wGroup, {
      label: `Fil broche ${i + 1}`,
      cursor: 'pointer',
      onClick: () => {
        if (state.crimped) {
          state.crimped = false;
        }
        if (state.selectedSlot === null) {
          state.selectedSlot = i;
          sfx.click();
        } else if (state.selectedSlot === i) {
          state.selectedSlot = null;
        } else {
          const a = state.selectedSlot;
          const tmp = state.wireSlots[a];
          state.wireSlots[a] = state.wireSlots[i];
          state.wireSlots[i] = tmp;
          state.selectedSlot = null;
          sfx.snap();
        }
        syncWiresAndCrimp();
        refreshUi();
      }
    });
  }

  const crimperPivot = new THREE.Group();
  crimperPivot.position.set(-0.22, 0.12, -0.09);
  crimpGroup.add(crimperPivot);

  const crimperArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.026, 0.055),
    new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.35, metalness: 0.55 })
  );
  crimperArm.position.set(0.11, 0.01, 0);
  crimperArm.castShadow = true;
  crimperPivot.add(crimperArm);

  const crimperJaw = new THREE.Mesh(
    new THREE.BoxGeometry(0.17, 0.022, 0.044),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.25, metalness: 0.88 })
  );
  crimperJaw.position.set(0.22, -0.012, 0);
  crimperPivot.add(crimperJaw);

  function triggerCrimp() {
    state.crimped = true;
    state.crimpAnim = 1;
    const matches = countT568bMatches();
    bench.spawnSparks([-0.54, 0.08, 0.01], {
      color: matches === 8 ? 0x22c55e : 0xfbbf24,
      count: 14,
      speed: 1.1
    });
    if (matches === 8) sfx.success();
    else sfx.snap();
    syncWiresAndCrimp();
    refreshUi();
  }

  bench.addInteractive(crimperPivot, {
    label: 'Pince à sertir RJ45 (Cliquer pour sertir)',
    cursor: 'pointer',
    onClick: triggerCrimp
  });

  function syncWiresAndCrimp() {
    for (let i = 0; i < 8; i++) {
      const spec = state.wireSlots[i];
      const item = wireMeshes[i];
      item.coreMat.color.setHex(spec.hex);
      if (spec.stripe) {
        item.stripe.visible = true;
        item.stripeMat.color.setHex(spec.stripe);
      } else {
        item.stripe.visible = false;
      }
      const isSel = state.selectedSlot === i;
      item.ring.visible = isSel;
      item.group.position.y = isSel ? 0.068 : 0.046;
      goldPins[i].position.y = state.crimped ? 0.056 : 0.066;
    }
  }

  const rackGroup = new THREE.Group();
  rackGroup.position.set(0.18, 0.012, -0.22);
  bench.scene.add(rackGroup);

  const railMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45, metalness: 0.72 });
  const rackLeft = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.78, 0.34), railMat);
  rackLeft.position.set(-0.34, 0.39, 0);
  rackLeft.castShadow = true;
  rackGroup.add(rackLeft);

  const rackRight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.78, 0.34), railMat);
  rackRight.position.set(0.34, 0.39, 0);
  rackRight.castShadow = true;
  rackGroup.add(rackRight);

  const rackTop = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.03, 0.34), railMat);
  rackTop.position.set(0, 0.78, 0);
  rackGroup.add(rackTop);

  const rackBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.76, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.75, metalness: 0.25 })
  );
  rackBack.position.set(0, 0.38, -0.16);
  rackGroup.add(rackBack);

  const panelBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, 0.14, 0.24),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.38, metalness: 0.65 })
  );
  panelBody.position.set(0, 0.6, -0.02);
  panelBody.castShadow = true;
  rackGroup.add(panelBody);

  const switchBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, 0.15, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x1d3557, roughness: 0.32, metalness: 0.72 })
  );
  switchBody.position.set(0, 0.28, -0.01);
  switchBody.castShadow = true;
  rackGroup.add(switchBody);

  const guideGroup = new THREE.Group();
  rackGroup.add(guideGroup);
  const guideMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.75 });
  const guideRings = [];
  for (const gx of [-0.305, 0.305]) {
    for (const gy of [0.54, 0.36]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.006, 10, 20), guideMat.clone());
      ring.rotation.y = Math.PI / 2;
      ring.position.set(gx, gy, 0.13);
      guideGroup.add(ring);
      guideRings.push(ring);
    }
  }
  bench.addInteractive(guideGroup, {
    label: 'Guides-câbles latéraux (Peignage propre)',
    cursor: 'pointer',
    onClick: () => {
      state.guidesUsed = !state.guidesUsed;
      sfx.click();
      rebuildCables();
      refreshUi();
    }
  });

  const panelSockets = [];
  const switchSockets = [];
  const panelLeds = [];
  const switchLeds = [];

  for (let i = 0; i < 12; i++) {
    const px = -0.25 + i * 0.045;
    const pSock = new THREE.Mesh(
      new THREE.BoxGeometry(0.032, 0.038, 0.024),
      new THREE.MeshStandardMaterial({ color: 0x0b1220, roughness: 0.4, metalness: 0.5 })
    );
    pSock.position.set(px, 0.59, 0.1);
    rackGroup.add(pSock);
    panelSockets.push(pSock);

    const pLedMat = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x000000 });
    const pLed = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 8), pLedMat);
    pLed.position.set(px, 0.625, 0.108);
    rackGroup.add(pLed);
    panelLeds.push(pLedMat);

    const sSock = new THREE.Mesh(
      new THREE.BoxGeometry(0.032, 0.038, 0.024),
      new THREE.MeshStandardMaterial({ color: 0x0b1220, roughness: 0.4, metalness: 0.5 })
    );
    sSock.position.set(px, 0.27, 0.13);
    rackGroup.add(sSock);
    switchSockets.push(sSock);

    const sLedMat = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x000000 });
    const sLed = new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 8), sLedMat);
    sLed.position.set(px, 0.305, 0.138);
    rackGroup.add(sLed);
    switchLeds.push(sLedMat);

    bench.addInteractive(pSock, {
      label: `Bandeau Port P${String(i + 1).padStart(2, '0')}`,
      cursor: 'pointer',
      onClick: () => {
        if (state.links[i]) {
          delete state.links[i];
          sfx.click();
          rebuildCables();
          refreshUi();
          return;
        }
        state.selectedPanelIdx = state.selectedPanelIdx === i ? null : i;
        sfx.click();
        refreshUi();
      }
    });

    bench.addInteractive(sSock, {
      label: `Switch Port S${String(i + 1).padStart(2, '0')}`,
      cursor: 'pointer',
      onClick: () => {
        if (state.selectedPanelIdx === null) {
          for (const k of Object.keys(state.links)) {
            if (state.links[k].switchIdx === i) {
              delete state.links[k];
              sfx.click();
              rebuildCables();
              refreshUi();
              return;
            }
          }
          return;
        }
        const pIdx = state.selectedPanelIdx;
        for (const k of Object.keys(state.links)) {
          if (state.links[k].switchIdx === i) delete state.links[k];
        }
        state.links[pIdx] = { switchIdx: i, color: state.activeCordColor };
        state.selectedPanelIdx = null;
        sfx.snap();
        rebuildCables();
        refreshUi();
      }
    });
  }

  const cableGroup = new THREE.Group();
  rackGroup.add(cableGroup);

  function rebuildCables() {
    while (cableGroup.children.length > 0) {
      const child = cableGroup.children.pop();
      if (child.geometry) child.geometry.dispose();
    }

    for (let i = 0; i < 12; i++) {
      panelLeds[i].color.setHex(0x334155);
      panelLeds[i].emissive.setHex(0x000000);
      switchLeds[i].color.setHex(0x334155);
      switchLeds[i].emissive.setHex(0x000000);
    }

    for (const r of guideRings) {
      r.material.color.setHex(state.guidesUsed ? 0x22c55e : 0x475569);
    }

    const usedSwitches = new Set();
    for (const key of Object.keys(state.links)) {
      const pIdx = Number(key);
      const link = state.links[pIdx];
      const pal = CORD_PALETTE.find((c) => c.id === link.color) || CORD_PALETTE[0];
      const pPos = panelSockets[pIdx].position;
      const sPos = switchSockets[link.switchIdx].position;
      usedSwitches.add(link.switchIdx);

      const start = new THREE.Vector3(pPos.x, pPos.y, pPos.z + 0.015);
      const end = new THREE.Vector3(sPos.x, sPos.y, sPos.z + 0.015);
      let cableMesh;
      if (state.guidesUsed) {
        const sideX = pIdx < 6 ? -0.305 : 0.305;
        const curve = new THREE.CatmullRomCurve3([
          start,
          new THREE.Vector3(start.x, start.y - 0.03, start.z + 0.045),
          new THREE.Vector3(sideX, 0.54, 0.13),
          new THREE.Vector3(sideX, 0.36, 0.13),
          new THREE.Vector3(end.x, end.y + 0.03, end.z + 0.045),
          end
        ]);
        cableMesh = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 36, 0.008, 8, false),
          new THREE.MeshStandardMaterial({ color: pal.hex, roughness: 0.42, metalness: 0.08 })
        );
      } else {
        cableMesh = buildFlexibleCable(start, end, pal.hex, 0.008, 0.12);
      }
      cableGroup.add(cableMesh);

      const spec = PATCH_SPECS.find((sp) => sp.panelIdx === pIdx);
      const isOk = spec && spec.switchIdx === link.switchIdx && spec.color === link.color;
      const ledHex = isOk ? 0x22c55e : 0xf59e0b;
      panelLeds[pIdx].color.setHex(ledHex);
      panelLeds[pIdx].emissive.setHex(ledHex);
      switchLeds[link.switchIdx].color.setHex(ledHex);
      switchLeds[link.switchIdx].emissive.setHex(ledHex);
    }
  }

  const testerGroup = new THREE.Group();
  testerGroup.position.set(0.62, 0.012, 0.14);
  bench.scene.add(testerGroup);

  const testerBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.09, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.45 })
  );
  testerBox.position.y = 0.045;
  testerBox.castShadow = true;
  testerGroup.add(testerBox);

  const testerScreen = makeCanvasScreen(320, 200);
  const testerScreenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.2, 0.12),
    new THREE.MeshBasicMaterial({ map: testerScreen.texture })
  );
  testerScreenMesh.rotation.x = -Math.PI / 2;
  testerScreenMesh.position.set(0, 0.091, -0.05);
  testerGroup.add(testerScreenMesh);

  const testerLeds = [];
  for (let i = 0; i < 9; i++) {
    const lx = -0.088 + i * 0.022;
    const mat = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x000000 });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.007, 10, 10), mat);
    led.position.set(lx, 0.092, 0.075);
    testerGroup.add(led);
    testerLeds.push(mat);
  }

  function runContinuityTest() {
    state.testerRunCount += 1;
    state.testerRunning = true;
    state.testerStep = 0;
    state.testerTimer = 0;
    const t568bOk = countT568bMatches() === 8;
    const { patchCorrect } = evaluatePatchProgress();
    state.testerPassed = t568bOk && state.crimped && patchCorrect === PATCH_SPECS.length;
    sfx.click();
    refreshUi();
  }

  bench.addInteractive(testerGroup, {
    label: 'Testeur de continuité RJ45 (Lancer séquence 1-8+G)',
    cursor: 'pointer',
    onClick: runContinuityTest
  });

  function drawTesterScreen() {
    const { ctx, canvas, texture } = testerScreen;
    ctx.fillStyle = '#071422';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('TESTEUR RJ45 T568B', 16, 30);

    const matches = countT568bMatches();
    const { patchCorrect } = evaluatePatchProgress();
    ctx.fillStyle = matches === 8 ? '#4ade80' : '#fbbf24';
    ctx.font = '16px monospace';
    ctx.fillText(`MAP: ${matches}/8 PINS  SERTI: ${state.crimped ? 'OUI' : 'NON'}`, 16, 62);
    ctx.fillStyle = patchCorrect === PATCH_SPECS.length ? '#4ade80' : '#f8fafc';
    ctx.fillText(`BAIE: ${patchCorrect}/${PATCH_SPECS.length} LIENS`, 16, 90);

    let statusText = 'PRET - CLIQUER POUR TESTER';
    let statusColor = '#94a3b8';
    if (state.testerRunning) {
      const pinName = state.testerStep === 8 ? 'G (BLINDAGE)' : `BROCHE ${state.testerStep + 1}`;
      statusText = `SCAN EN COURS: ${pinName}`;
      statusColor = '#38bdf8';
    } else if (state.testerRunCount > 0) {
      if (state.testerPassed) {
        statusText = 'PASS - CERTIFIE CAT.6A';
        statusColor = '#4ade80';
      } else {
        statusText = 'DEFAUT CROISEMENT / LIEN';
        statusColor = '#f87171';
      }
    }
    ctx.fillStyle = statusColor;
    ctx.font = 'bold 18px monospace';
    ctx.fillText(statusText, 16, 134);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '14px monospace';
    ctx.fillText('1  2  3  4  5  6  7  8  G', 18, 176);
    texture.needsUpdate = true;
  }

  function updateTesterLeds(dt) {
    if (state.testerRunning) {
      state.testerTimer += dt;
      if (state.testerTimer >= 0.22) {
        state.testerTimer = 0;
        state.testerStep += 1;
        sfx.click();
        if (state.testerStep > 8) {
          state.testerRunning = false;
          state.testerStep = -1;
          if (state.testerPassed) sfx.success();
          else sfx.error();
          refreshUi();
        }
      }
    }

    for (let i = 0; i < 9; i++) {
      let hex = 0x1e293b;
      if (state.testerRunning) {
        if (i === state.testerStep) {
          const pinOk = i === 8 ? state.crimped : state.wireSlots[i].id === T568B_ORDER[i].id;
          hex = pinOk ? 0x22c55e : 0xef4444;
        }
      } else if (state.testerRunCount > 0) {
        if (state.testerPassed) {
          hex = 0x22c55e;
        } else if (i < 8) {
          hex = state.wireSlots[i].id === T568B_ORDER[i].id ? 0x22c55e : 0xef4444;
        } else {
          hex = state.crimped ? 0x22c55e : 0xef4444;
        }
      }
      testerLeds[i].color.setHex(hex);
      testerLeds[i].emissive.setHex(hex === 0x1e293b ? 0x000000 : hex);
    }
    drawTesterScreen();
  }

  function setCameraById(id) {
    const cam = CAM_VIEWS.find((c) => c.id === id) || CAM_VIEWS[0];
    state.camId = cam.id;
    bench.setCameraView(cam.pos, cam.lookAt, cam.fov);
    bench.setCameras(CAM_VIEWS, cam.id, setCameraById);
  }

  function updateSidebar() {
    const matches = countT568bMatches();
    const { patchCorrect, colorCorrect } = evaluatePatchProgress();

    const pinRows = state.wireSlots
      .map((w, i) => {
        const expected = T568B_ORDER[i];
        const ok = w.id === expected.id;
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 7px;border-radius:6px;background:${
          state.selectedSlot === i ? 'rgba(56,189,248,0.22)' : 'rgba(15,23,42,0.55)'
        };border:1px solid ${ok ? 'rgba(34,197,94,0.45)' : 'rgba(245,158,11,0.4)'};font-size:11px;cursor:pointer;" data-slot="${i}">
          <span><strong style="color:#94a3b8;">P${i + 1}</strong> <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${w.css};margin:0 4px;"></span>${w.name}</span>
          <span style="color:${ok ? '#4ade80' : '#fbbf24'};">${ok ? 'OK' : '→ ' + expected.name}</span>
        </div>`;
      })
      .join('');

    const patchRows = PATCH_SPECS.map((sp) => {
      const link = state.links[sp.panelIdx];
      const linkedOk = link && link.switchIdx === sp.switchIdx;
      const colorOk = linkedOk && link.color === sp.color;
      const pal = CORD_PALETTE.find((c) => c.id === sp.color);
      return `<div style="display:flex;justify-content:space-between;padding:4px 6px;border-radius:6px;background:rgba(15,23,42,0.5);font-size:11px;">
        <span><strong>${sp.panelLabel} → ${sp.switchLabel}</strong> <span style="color:${pal.css};">(${pal.label.split(' ')[0]})</span></span>
        <span style="color:${colorOk ? '#4ade80' : linkedOk ? '#fbbf24' : '#94a3b8'};">${
        colorOk ? 'OK' : linkedOk ? 'Couleur' : 'Non brassé'
      }</span>
      </div>`;
    }).join('');

    const drawer = bench.setSideDrawer(`
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div style="font-weight:800;color:#38bdf8;font-size:12px;">1. ORDRE T568B (${matches}/8) — ${state.crimped ? 'SERTI' : 'À SERTIR'}</div>
        <div style="font-size:11px;color:#cbd5e1;">Cliquez deux fils (en 3D ou ici) pour les permuter puis actionnez la pince rouge.</div>
        <div style="display:flex;flex-direction:column;gap:3px;">${pinRows}</div>
        <div style="font-weight:800;color:#a855f7;font-size:12px;margin-top:4px;">2. PLAN DE BRASSAGE (${patchCorrect}/${PATCH_SPECS.length})</div>
        <div style="display:flex;flex-direction:column;gap:3px;">${patchRows}</div>
        <div style="font-size:11px;color:${state.guidesUsed ? '#4ade80' : '#94a3b8'};">Guides-câbles latéraux : ${state.guidesUsed ? 'Peignage propre actif' : 'Non utilisés (cliquez anneaux 3D)'}</div>
      </div>
    `);
    if (drawer) {
      drawer.querySelectorAll('[data-slot]').forEach((el) => {
        el.addEventListener('click', () => {
          const idx = Number(el.dataset.slot);
          if (state.crimped) state.crimped = false;
          if (state.selectedSlot === null) {
            state.selectedSlot = idx;
          } else if (state.selectedSlot === idx) {
            state.selectedSlot = null;
          } else {
            const tmp = state.wireSlots[state.selectedSlot];
            state.wireSlots[state.selectedSlot] = state.wireSlots[idx];
            state.wireSlots[idx] = tmp;
            state.selectedSlot = null;
            sfx.snap();
          }
          syncWiresAndCrimp();
          refreshUi();
        });
      });
    }
  }

  function refreshUi() {
    const matches = countT568bMatches();
    const { patchCorrect, colorCorrect } = evaluatePatchProgress();
    const estScore = computePatchPanelScore3D({
      t568bMatches: matches,
      crimped: state.crimped,
      patchCorrect,
      colorCorrect,
      totalLinks: PATCH_SPECS.length,
      guidesUsed: state.guidesUsed,
      testerRun: state.testerRunCount > 0,
      continuityPassed: state.testerPassed,
      elapsedSec: (performance.now() - state.startMs) / 1000
    });

    bench.setInstruction(
      'ATELIER BRASSAGE & SERTISSAGE 3D',
      `T568B ${matches}/8 • Brassage ${patchCorrect}/${PATCH_SPECS.length}`,
      state.selectedPanelIdx !== null
        ? `Prise P${String(state.selectedPanelIdx + 1).padStart(2, '0')} sélectionnée : cliquez sur le port Switch cible.`
        : 'Ordonnez les 8 fils T568B, sertissez la prise RJ45, brassez les 6 cordons dans la baie et lancez le testeur.'
    );
    bench.setAccuracy(`Note est. ${estScore.toFixed(1)}/20`);

    bench.setTools(
      CORD_PALETTE.map((c) => ({
        id: c.id,
        icon: 'C',
        label: `Cordon ${c.label}`,
        disabled: false
      })),
      state.activeCordColor,
      (toolId) => {
        state.activeCordColor = toolId;
        sfx.click();
        refreshUi();
      }
    );

    bench.setActions([
      {
        id: 'crimp-btn',
        label: state.crimped ? 'Re-sertir RJ45' : 'Sertir fiche RJ45',
        primary: !state.crimped,
        onClick: triggerCrimp
      },
      {
        id: 'guides-btn',
        label: state.guidesUsed ? 'Guides-câbles : ON' : 'Guides-câbles : OFF',
        primary: false,
        onClick: () => {
          state.guidesUsed = !state.guidesUsed;
          sfx.click();
          rebuildCables();
          refreshUi();
        }
      },
      {
        id: 'test-btn',
        label: 'Tester continuité',
        primary: state.crimped && patchCorrect === PATCH_SPECS.length && !state.testerPassed,
        onClick: runContinuityTest
      },
      {
        id: 'finish-btn',
        label: 'Valider le TP',
        primary: state.testerPassed,
        disabled: state.submitted,
        onClick: () => {
          if (state.submitted) return;
          state.submitted = true;
          const finalEval = evaluatePatchProgress();
          const finalScore = computePatchPanelScore3D({
            t568bMatches: countT568bMatches(),
            crimped: state.crimped,
            patchCorrect: finalEval.patchCorrect,
            colorCorrect: finalEval.colorCorrect,
            totalLinks: PATCH_SPECS.length,
            guidesUsed: state.guidesUsed,
            testerRun: state.testerRunCount > 0,
            continuityPassed: state.testerPassed,
            elapsedSec: (performance.now() - state.startMs) / 1000
          });
          const xp = Math.round(60 + finalScore * 6);
          if (finalScore >= 12) sfx.success();
          else sfx.error();
          api.onComplete?.({
            score: finalScore,
            xp,
            summary: `T568B ${countT568bMatches()}/8 • Brassage ${finalEval.patchCorrect}/${PATCH_SPECS.length} • Continuité ${state.testerPassed ? 'OK' : 'À revoir'}`
          });
        }
      }
    ]);

    updateSidebar();
  }

  bench.addFloatingTag([-0.54, 0.14, 0.1], 'Jig Sertissage T568B', 'info');
  bench.addFloatingTag([0.18, 0.84, -0.22], 'Baie 19" Brassage', 'info');
  bench.addFloatingTag([0.62, 0.16, 0.14], 'Testeur RJ45 1-8+G', 'info');

  const unsubTick = bench.onTick((dt) => {
    if (state.crimpAnim > 0) {
      state.crimpAnim = Math.max(0, state.crimpAnim - dt * 2.4);
      crimperPivot.rotation.z = -Math.sin(state.crimpAnim * Math.PI) * 0.28;
    } else {
      crimperPivot.rotation.z = state.crimped ? -0.06 : 0.18;
    }
    updateTesterLeds(dt);
  });

  syncWiresAndCrimp();
  rebuildCables();
  setCameraById('overview');
  refreshUi();

  return {
    destroy: () => {
      unsubTick();
      bench.destroy();
    }
  };
}

export const createPatchPanelGame = createPatchRackGame;
