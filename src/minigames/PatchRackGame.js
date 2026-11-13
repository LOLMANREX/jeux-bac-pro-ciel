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

export function computeRackVlanScore3D(metrics = {}) {
  const totalCables = Math.max(1, metrics.totalCables || 4);
  const matchedCables = Math.min(totalCables, metrics.matchedCables || 0);
  const mediaOk = Math.min(totalCables, metrics.mediaOk || 0);
  const cablePts = (matchedCables / totalCables) * 5 + (mediaOk / totalCables) * 3;
  const hwBonus = (metrics.fiberCleaned ? 1 : 0) + (metrics.psuRedundant ? 1 : 0);
  const vlanPts = Math.min(3, metrics.vlansConfigured || 0);
  const portPts = Math.min(4, metrics.portsConfigured || 0);
  const pingRatio = (metrics.pingTotal || 0) > 0 ? (metrics.pingSuccessCount || 0) / metrics.pingTotal : 0;
  const pingPts = pingRatio * 3;

  const raw = cablePts + hwBonus + vlanPts + portPts + pingPts;
  const errors = Math.max(0, metrics.cableErrors || 0);
  const elapsed = metrics.elapsedSec || 0;
  const timePenalty = elapsed > 260 ? Math.min(2, (elapsed - 260) / 100) : 0;
  const score = Math.max(0, Math.min(20, Math.round(raw - errors * 0.6 - timePenalty)));
  const xp = Math.max(45, Math.round(score * 16 + (pingRatio >= 1 ? 65 : 0)));
  const accuracy = Math.round((score / 20) * 100);
  return { score, xp, accuracy };
}

const RACK_PORTS_DEF = [
  {
    panelId: 'PP-01',
    panelLabel: 'Prise 01 • Poste Professeur',
    expectedSwitch: 'Gi0/1',
    expectedMedia: 'blue',
    expectedMode: 'ACCESS',
    expectedVlan: 10,
    vlanName: 'ADMIN',
    subnet: '192.168.10.10'
  },
  {
    panelId: 'PP-02',
    panelLabel: 'Prise 02 • Bancs Atelier',
    expectedSwitch: 'Gi0/2',
    expectedMedia: 'green',
    expectedMode: 'ACCESS',
    expectedVlan: 20,
    vlanName: 'ATELIER',
    subnet: '192.168.20.10'
  },
  {
    panelId: 'PP-03',
    panelLabel: 'Prise 03 • Borne Invités',
    expectedSwitch: 'Gi0/3',
    expectedMedia: 'yellow',
    expectedMode: 'ACCESS',
    expectedVlan: 30,
    vlanName: 'INVITES',
    subnet: '192.168.30.10'
  },
  {
    panelId: 'PP-04',
    panelLabel: 'Fibre Uplink • Routeur & VMs',
    expectedSwitch: 'Te0/1',
    expectedMedia: 'fiber',
    expectedMode: 'TRUNK',
    expectedVlan: '10,20,30',
    vlanName: 'TRUNK 802.1Q',
    subnet: '192.168.1.254'
  }
];

const CORD_PALETTE = [
  { id: 'blue', icon: '🔵', label: 'RJ45 Bleu (V10)', hex: 0x2563eb },
  { id: 'green', icon: '🟢', label: 'RJ45 Vert (V20)', hex: 0x16a34a },
  { id: 'yellow', icon: '🟡', label: 'RJ45 Jaune (V30)', hex: 0xeab308 },
  { id: 'fiber', icon: '🟣', label: 'Fibre SFP+ (Trunk)', hex: 0xa855f7 }
];

export function createRackVlanWorkshop3D(api, opts = {}) {
  const startPhase = opts.initialMode === 'vlan' ? 'vlan' : 'patch';

  const bench = createWorkbench3D(api.container, {
    cameraPos: startPhase === 'vlan' ? [0.45, 0.72, 0.92] : [-0.08, 0.85, 1.24],
    lookAt: startPhase === 'vlan' ? [0.35, 0.25, 0.0] : [-0.05, 0.42, -0.04],
    fov: 38,
    hasEsdMat: false
  });

  const esdTex = createEsdMatTexture('#1e293b', '#38bdf8');
  const deskPad = new THREE.Mesh(
    new THREE.BoxGeometry(1.75, 0.012, 0.96),
    new THREE.MeshStandardMaterial({ map: esdTex, roughness: 0.72 })
  );
  deskPad.position.set(0, 0.006, 0.02);
  deskPad.receiveShadow = true;
  bench.scene.add(deskPad);

  const rackMetal = new THREE.MeshStandardMaterial({ color: 0x1f242d, roughness: 0.42, metalness: 0.72 });
  const railMetal = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.85 });
  const faceplateMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.48, metalness: 0.4 });

  const rackGroup = new THREE.Group();
  rackGroup.position.set(-0.32, 0.012, -0.10);
  bench.scene.add(rackGroup);

  const rackBase = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.025, 0.46), rackMetal);
  rackBase.position.y = 0.0125;
  rackBase.castShadow = true;
  const rackTop = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.025, 0.46), rackMetal);
  rackTop.position.y = 0.82;
  rackTop.castShadow = true;
  const rackBack = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.8, 0.02), rackMetal);
  rackBack.position.set(0, 0.41, -0.22);
  const rackSideL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.8, 0.44), rackMetal);
  rackSideL.position.set(-0.32, 0.41, 0);
  const rackSideR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.8, 0.44), rackMetal);
  rackSideR.position.set(0.32, 0.41, 0);
  rackGroup.add(rackBase, rackTop, rackBack, rackSideL, rackSideR);

  const railL = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.78, 0.014), railMetal);
  railL.position.set(-0.295, 0.415, 0.21);
  const railR = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.78, 0.014), railMetal);
  railR.position.set(0.295, 0.415, 0.21);
  rackGroup.add(railL, railR);

  const ppChassis = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.095, 0.28), faceplateMat);
  ppChassis.position.set(0, 0.69, 0.07);
  ppChassis.castShadow = true;
  rackGroup.add(ppChassis);

  const ppLabelScreen = makeCanvasScreen(512, 80, (ctx, w, h) => {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('BANDEAU DE BRASSAGE CAT.6A / FIBRE', 14, 28);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 18px monospace';
    ['PP-01 (V10)', 'PP-02 (V20)', 'PP-03 (V30)', 'PP-04 (FO)'].forEach((lbl, idx) => {
      ctx.fillText(lbl, 16 + idx * 124, 62);
    });
  });
  const ppLabelPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.52, 0.042),
    new THREE.MeshBasicMaterial({ map: ppLabelScreen.texture })
  );
  ppLabelPlane.position.set(0, 0.718, 0.212);
  rackGroup.add(ppLabelPlane);

  const panelPortMeshes = {};
  const panelPortWorldPos = {};
  RACK_PORTS_DEF.forEach((def, idx) => {
    const x = -0.18 + idx * 0.12;
    const isFiber = def.panelId === 'PP-04';
    const socket = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.028, 0.018),
      new THREE.MeshStandardMaterial({ color: isFiber ? 0x6b21a8 : 0x334155, roughness: 0.35 })
    );
    socket.position.set(x, 0.668, 0.212);
    rackGroup.add(socket);

    const ledMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: 0x22c55e, emissiveIntensity: 0 });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 10, 8), ledMat);
    led.position.set(x + 0.022, 0.678, 0.218);
    rackGroup.add(led);

    panelPortMeshes[def.panelId] = { mesh: socket, ledMat, x, y: 0.668, z: 0.224 };
    panelPortWorldPos[def.panelId] = new THREE.Vector3(-0.32 + x, 0.012 + 0.668, -0.10 + 0.224);
  });

  const switchChassis = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.11, 0.34),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.65 })
  );
  switchChassis.position.set(0, 0.50, 0.04);
  switchChassis.castShadow = true;
  rackGroup.add(switchChassis);

  const swLabelScreen = makeCanvasScreen(512, 80, (ctx, w, h) => {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 19px monospace';
    ctx.fillText('SW-CORE L3 24P + SFP+ 10G (MANAGEABLE)', 14, 28);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 16px monospace';
    ['Gi0/1', 'Gi0/2', 'Gi0/3', 'Te0/1(FO)', 'CONS'].forEach((lbl, idx) => {
      ctx.fillText(lbl, 18 + idx * 98, 62);
    });
  });
  const swLabelPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.52, 0.042),
    new THREE.MeshBasicMaterial({ map: swLabelScreen.texture })
  );
  swLabelPlane.position.set(0, 0.532, 0.212);
  rackGroup.add(swLabelPlane);

  const switchPortIds = ['Gi0/1', 'Gi0/2', 'Gi0/3', 'Te0/1'];
  const switchPortMeshes = {};
  const switchPortWorldPos = {};
  switchPortIds.forEach((swId, idx) => {
    const x = -0.18 + idx * 0.105;
    const isSfp = swId === 'Te0/1';
    const portBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.028, 0.018),
      new THREE.MeshStandardMaterial({ color: isSfp ? 0x581c87 : 0x475569, roughness: 0.35 })
    );
    portBox.position.set(x, 0.478, 0.212);
    rackGroup.add(portBox);

    const ledMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x22c55e, emissiveIntensity: 0 });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.005, 10, 8), ledMat);
    led.position.set(x, 0.502, 0.216);
    rackGroup.add(led);

    switchPortMeshes[swId] = { mesh: portBox, ledMat, x, y: 0.478, z: 0.224 };
    switchPortWorldPos[swId] = new THREE.Vector3(-0.32 + x, 0.012 + 0.478, -0.10 + 0.224);
  });

  for (let i = 0; i < 6; i++) {
    const deco = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.018, 0.012),
      new THREE.MeshStandardMaterial({ color: 0x334155 })
    );
    deco.position.set(0.16 + (i % 3) * 0.03, i < 3 ? 0.49 : 0.468, 0.212);
    rackGroup.add(deco);
  }

  const consolePortMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.032, 0.024, 0.018),
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 })
  );
  consolePortMesh.position.set(0.24, 0.478, 0.212);
  rackGroup.add(consolePortMesh);

  const routerChassis = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.12, 0.38),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.45, metalness: 0.5 })
  );
  routerChassis.position.set(0, 0.30, 0.02);
  routerChassis.castShadow = true;
  rackGroup.add(routerChassis);

  const routerScreen = makeCanvasScreen(400, 90, (ctx, w, h) => {
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('RTR-FW-01 & HYPERVISEUR', 14, 30);
    ctx.fillStyle = '#4ade80';
    ctx.font = '15px monospace';
    ctx.fillText('● INTER-VLAN 802.1Q ACTIF', 14, 62);
  });
  const routerDisplay = new THREE.Mesh(
    new THREE.PlaneGeometry(0.46, 0.085),
    new THREE.MeshBasicMaterial({ map: routerScreen.texture })
  );
  routerDisplay.position.set(0, 0.30, 0.212);
  rackGroup.add(routerDisplay);

  const upsChassis = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.13, 0.40),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45, metalness: 0.55 })
  );
  upsChassis.position.set(0, 0.11, 0.01);
  upsChassis.castShadow = true;
  rackGroup.add(upsChassis);

  const psuLedMat = new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x22c55e, emissiveIntensity: 0.1 });
  const psuBBtn = new THREE.Mesh(
    new THREE.BoxGeometry(0.065, 0.036, 0.022),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.35 })
  );
  psuBBtn.position.set(0.18, 0.11, 0.212);
  const psuBLed = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 10), psuLedMat);
  psuBLed.position.set(0.13, 0.11, 0.216);
  rackGroup.add(psuBBtn, psuBLed);

  const fiberCleaner = new THREE.Group();
  fiberCleaner.position.set(0.16, 0.025, 0.26);
  const fcBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.14, 16),
    new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.35 })
  );
  fcBody.rotation.z = Math.PI / 2;
  const fcTip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.005, 0.009, 0.035, 12),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
  );
  fcTip.rotation.z = Math.PI / 2;
  fcTip.position.x = -0.085;
  fiberCleaner.add(fcBody, fcTip);
  bench.scene.add(fiberCleaner);

  const laptopGroup = new THREE.Group();
  laptopGroup.position.set(0.42, 0.014, 0.10);
  laptopGroup.rotation.y = -0.35;
  bench.scene.add(laptopGroup);

  const laptopBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.018, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.32, metalness: 0.72 })
  );
  laptopBase.position.y = 0.009;
  laptopBase.castShadow = true;
  const keyboardPatch = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.004, 0.15),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 })
  );
  keyboardPatch.position.set(0, 0.018, -0.02);
  laptopGroup.add(laptopBase, keyboardPatch);

  const laptopLidGroup = new THREE.Group();
  laptopLidGroup.position.set(0, 0.018, -0.135);
  laptopLidGroup.rotation.x = -0.22;
  laptopGroup.add(laptopLidGroup);

  const laptopLidShell = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.27, 0.012),
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.35, metalness: 0.7 })
  );
  laptopLidShell.position.set(0, 0.135, 0);
  laptopLidShell.castShadow = true;
  laptopLidGroup.add(laptopLidShell);

  const consoleCable = buildFlexibleCable(
    [
      [-0.32 + 0.24, 0.012 + 0.478, -0.10 + 0.224],
      [0.06, 0.18, 0.18],
      [0.24, 0.03, 0.14]
    ],
    0x38bdf8,
    0.0055
  );
  bench.scene.add(consoleCable.mesh);

  const state = {
    phase: startPhase,
    selectedCord: 'blue',
    selectedPanelId: null,
    fiberCleaned: false,
    psuBEnabled: false,
    cableErrors: 0,
    links: {},
    mediaUsed: {},
    cableMeshes: {},
    vlans: {
      10: { name: 'ADMIN', configured: false },
      20: { name: 'ATELIER', configured: false },
      30: { name: 'INVITES', configured: false }
    },
    portConfigs: {
      'Gi0/1': { mode: 'ACCESS', vlan: '1' },
      'Gi0/2': { mode: 'ACCESS', vlan: '1' },
      'Gi0/3': { mode: 'ACCESS', vlan: '1' },
      'Te0/1': { mode: 'ACCESS', vlan: '1' }
    },
    pingResults: [],
    terminalLines: [
      'CielOS Switch Console v15.2 (ttyS0)',
      'Connecté via câble Console RJ45 bleu',
      '> Utilisez la console pour créer les VLANs 10/20/30',
      'SW-CORE#'
    ],
    finished: false,
    camId: startPhase === 'vlan' ? 'laptop' : 'rack'
  };

  const CAM_VIEWS = [
    { id: 'rack', label: 'Vue Baie 19"', pos: [-0.08, 0.85, 1.24], lookAt: [-0.05, 0.42, -0.04], fov: 38 },
    { id: 'ports', label: 'Zoom Brassage', pos: [-0.32, 0.64, 0.58], lookAt: [-0.32, 0.57, 0.08], fov: 34 },
    { id: 'laptop', label: 'Console Laptop', pos: [0.45, 0.72, 0.92], lookAt: [0.35, 0.25, 0.0], fov: 38 }
  ];

  function selectCamera(id) {
    const v = CAM_VIEWS.find((c) => c.id === id);
    if (!v) return;
    state.camId = id;
    bench.setCameraView(v.pos, v.lookAt, v.fov);
    bench.setCameras(CAM_VIEWS, id, selectCamera);
  }

  const laptopScreen = makeCanvasScreen(640, 400, (ctx, w, h, st) => {
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, 36);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('PUTTY / SERIAL COM3 — SW-CORE (9600 baud)', 14, 24);

    ctx.font = '14px monospace';
    const lines = (st?.lines || []).slice(-13);
    lines.forEach((line, idx) => {
      ctx.fillStyle = line.includes('OK') || line.includes('0% loss') ? '#4ade80' : line.includes('ERR') || line.includes('timeout') ? '#f87171' : '#e2e8f0';
      ctx.fillText(line, 16, 66 + idx * 24);
    });
  });

  const laptopDisplay = new THREE.Mesh(
    new THREE.PlaneGeometry(0.39, 0.245),
    new THREE.MeshBasicMaterial({ map: laptopScreen.texture })
  );
  laptopDisplay.position.set(0, 0.135, 0.008);
  laptopLidGroup.add(laptopDisplay);

  function pushTerm(line) {
    state.terminalLines.push(line);
    if (state.terminalLines.length > 40) state.terminalLines.shift();
    laptopScreen.update({ lines: state.terminalLines });
  }
  laptopScreen.update({ lines: state.terminalLines });

  const activePulses = [];

  function spawnCablePacket(panelId, colorHex, ok = true) {
    const cableRec = state.cableMeshes[panelId];
    if (!cableRec) return;
    const curve = cableRec.cable.getCurve();
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.013, 12, 10),
      new THREE.MeshBasicMaterial({ color: colorHex })
    );
    bench.scene.add(orb);
    activePulses.push({
      mesh: orb,
      curve,
      t: 0,
      speed: ok ? 1.45 : 1.0,
      ok
    });
  }

  function clearCableForPanel(panelId) {
    if (state.cableMeshes[panelId]) {
      bench.scene.remove(state.cableMeshes[panelId].cable.mesh);
      delete state.cableMeshes[panelId];
    }
    delete state.links[panelId];
    delete state.mediaUsed[panelId];
  }

  function createOrUpdateCable(panelId, switchId, mediaId) {
    for (const [existingPanel, existingSw] of Object.entries(state.links)) {
      if (existingSw === switchId && existingPanel !== panelId) {
        clearCableForPanel(existingPanel);
      }
    }
    clearCableForPanel(panelId);

    const start = panelPortWorldPos[panelId].clone();
    const end = switchPortWorldPos[switchId].clone();
    const sagX = ((panelId.charCodeAt(4) || 49) - 50) * 0.02;
    const mid1 = start.clone().lerp(end, 0.3).add(new THREE.Vector3(sagX, -0.02, 0.085));
    const mid2 = start.clone().lerp(end, 0.7).add(new THREE.Vector3(sagX, -0.02, 0.085));

    const cordDef = CORD_PALETTE.find((c) => c.id === mediaId) || CORD_PALETTE[0];
    const cable = buildFlexibleCable([start, mid1, mid2, end], cordDef.hex, mediaId === 'fiber' ? 0.0042 : 0.0065, cordDef.hex);
    bench.scene.add(cable.mesh);

    state.links[panelId] = switchId;
    state.mediaUsed[panelId] = mediaId;
    state.cableMeshes[panelId] = { cable, switchId, mediaId };
    updatePortLeds();
  }

  function updatePortLeds() {
    for (const pid of Object.keys(panelPortMeshes)) {
      const hasLink = Boolean(state.links[pid]);
      panelPortMeshes[pid].ledMat.emissiveIntensity = hasLink ? 1.8 : 0;
    }
    for (const swId of Object.keys(switchPortMeshes)) {
      const pair = Object.entries(state.links).find(([, s]) => s === swId);
      if (!pair) {
        switchPortMeshes[swId].ledMat.emissiveIntensity = 0;
      } else {
        const def = RACK_PORTS_DEF.find((d) => d.panelId === pair[0]);
        const media = state.mediaUsed[pair[0]];
        const good = def && def.expectedSwitch === swId && def.expectedMedia === media;
        switchPortMeshes[swId].ledMat.emissive.setHex(good ? 0x22c55e : 0xf97316);
        switchPortMeshes[swId].ledMat.emissiveIntensity = 2.0;
      }
    }
    psuLedMat.emissiveIntensity = state.psuBEnabled ? 2.2 : 0.1;
  }

  function computeMetrics() {
    let matchedCables = 0;
    let mediaOk = 0;
    for (const def of RACK_PORTS_DEF) {
      if (state.links[def.panelId] === def.expectedSwitch) matchedCables += 1;
      if (state.mediaUsed[def.panelId] === def.expectedMedia) mediaOk += 1;
    }
    let vlansConfigured = 0;
    if (state.vlans[10].configured) vlansConfigured += 1;
    if (state.vlans[20].configured) vlansConfigured += 1;
    if (state.vlans[30].configured) vlansConfigured += 1;

    let portsConfigured = 0;
    for (const def of RACK_PORTS_DEF) {
      const pc = state.portConfigs[def.expectedSwitch];
      if (!pc) continue;
      if (def.expectedMode === 'ACCESS' && pc.mode === 'ACCESS' && Number(pc.vlan) === def.expectedVlan) {
        portsConfigured += 1;
      } else if (def.expectedMode === 'TRUNK' && pc.mode === 'TRUNK') {
        const list = String(pc.vlan).split(/[,\s;]+/).map((n) => parseInt(n, 10));
        if ([10, 20, 30].every((id) => list.includes(id))) portsConfigured += 1;
      }
    }

    const pingSuccessCount = state.pingResults.filter((p) => p.ok).length;
    return {
      totalCables: RACK_PORTS_DEF.length,
      matchedCables,
      mediaOk,
      fiberCleaned: state.fiberCleaned,
      psuRedundant: state.psuBEnabled,
      vlansConfigured,
      portsConfigured,
      pingSuccessCount,
      pingTotal: 3,
      cableErrors: state.cableErrors,
      elapsedSec: bench.getElapsedSec()
    };
  }

  function runPingSimulation() {
    const targets = [
      { vlan: 10, ip: '192.168.10.10', panelId: 'PP-01', swId: 'Gi0/1', color: 0x3b82f6 },
      { vlan: 20, ip: '192.168.20.10', panelId: 'PP-02', swId: 'Gi0/2', color: 0x22c55e },
      { vlan: 30, ip: '192.168.30.10', panelId: 'PP-03', swId: 'Gi0/3', color: 0xeab308 }
    ];
    const uplinkPlugged = state.links['PP-04'] === 'Te0/1' && state.mediaUsed['PP-04'] === 'fiber';
    const trunkCfg = state.portConfigs['Te0/1'];
    const trunkVlans = String(trunkCfg.vlan).split(/[,\s;]+/).map((n) => parseInt(n, 10));
    const trunkOk = trunkCfg.mode === 'TRUNK' && [10, 20, 30].every((v) => trunkVlans.includes(v));

    state.pingResults = targets.map((t) => {
      const patched = state.links[t.panelId] === t.swId;
      const vlanOn = state.vlans[t.vlan]?.configured;
      const pc = state.portConfigs[t.swId];
      const portOk = pc.mode === 'ACCESS' && Number(pc.vlan) === t.vlan;
      const ok = Boolean(patched && uplinkPlugged && vlanOn && portOk && trunkOk);
      if (state.cableMeshes[t.panelId]) {
        spawnCablePacket(t.panelId, ok ? t.color : 0xef4444, ok);
      }
      if (ok && state.cableMeshes['PP-04']) {
        spawnCablePacket('PP-04', 0xa855f7, true);
      }
      pushTerm(`SW-CORE# ping ${t.ip}`);
      pushTerm(ok ? `Reply from ${t.ip}: bytes=32 time=1ms (0% loss) OK` : `Request timed out (${!patched ? 'câble débranché' : !vlanOn ? 'VLAN inactif' : 'Access/Trunk incorrect'}) ERR`);
      return { vlan: t.vlan, ip: t.ip, ok };
    });

    const okCount = state.pingResults.filter((r) => r.ok).length;
    if (okCount === 3) {
      sfx.success();
      bench.showToast('3/3 Pings Inter-VLAN réussis ! Paquets visibles sur les jarretières 3D.', 'success');
    } else {
      sfx.error();
      bench.showToast(`Test Ping : ${okCount}/3 réussis. Vérifiez câbles, Trunk Te0/1 et ports VLAN.`, 'error');
    }
    renderSideDrawer();
    refreshHud();
  }

  function applyQuickVlanPreset() {
    state.vlans[10].configured = true;
    state.vlans[20].configured = true;
    state.vlans[30].configured = true;
    pushTerm('SW-CORE(config)# vlan 10,20,30 -> ADMIN / ATELIER / INVITES OK');
    sfx.click();
    renderSideDrawer();
    refreshHud();
  }

  function renderSideDrawer() {
    if (state.phase !== 'vlan') {
      bench.setSideDrawer('');
      return;
    }

    const html = `
      <h4>Console Switch — SW-CORE</h4>
      <div style="font-size:12px;color:#475569;margin-bottom:8px;">
        Créez les VLANs 10/20/30, assignez les ports Access & Trunk 802.1Q, puis lancez le test Ping 3D.
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
        ${[10, 20, 30]
          .map((vid) => {
            const v = state.vlans[vid];
            return `<button class="tp3d-tool-btn ${v.configured ? 'active' : ''}" data-toggle-vlan="${vid}">
              ${v.configured ? '✔ ' : '+ '}VLAN ${vid} (${v.name})
            </button>`;
          })
          .join('')}
        <button class="tp3d-tool-btn" id="btn-all-vlans">Créer les 3 VLANs</button>
      </div>
      <div style="display:grid;gap:6px;margin-bottom:10px;">
        ${switchPortIds
          .map((swId) => {
            const pc = state.portConfigs[swId];
            return `
              <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;background:rgba(255,255,255,0.65);padding:6px 8px;border-radius:10px;border:1px solid rgba(148,163,184,0.3);font-size:12px;">
                <strong>${swId}</strong>
                <select data-port-mode="${swId}" style="border-radius:6px;padding:3px 6px;border:1px solid #cbd5e1;font-size:12px;">
                  <option value="ACCESS" ${pc.mode === 'ACCESS' ? 'selected' : ''}>ACCESS</option>
                  <option value="TRUNK" ${pc.mode === 'TRUNK' ? 'selected' : ''}>TRUNK 802.1Q</option>
                </select>
                <input data-port-vlan="${swId}" value="${pc.vlan}" style="width:74px;border-radius:6px;padding:3px 6px;border:1px solid #cbd5e1;font-size:12px;font-family:monospace;" placeholder="10" />
              </div>
            `;
          })
          .join('')}
      </div>
      <div style="display:flex;gap:6px;margin-bottom:8px;">
        <input id="cli-input-cmd" placeholder="Ex: ping 192.168.10.10" style="flex:1;padding:6px 8px;border-radius:8px;border:1px solid #cbd5e1;font-size:12px;font-family:monospace;" />
        <button class="tp3d-tool-btn active" id="btn-cli-send">Exec</button>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="tp3d-act-btn primary" id="btn-run-ping-3d" style="width:100%;">Lancer Test Ping 3D</button>
      </div>
      ${
        state.pingResults.length
          ? `<div style="margin-top:8px;font-size:12px;display:grid;gap:4px;">
              ${state.pingResults
                .map(
                  (r) =>
                    `<div style="color:${r.ok ? '#15803d' : '#b91c1c'};font-weight:700;">
                      ${r.ok ? '✔' : '✘'} VLAN ${r.vlan} (${r.ip}) — ${r.ok ? 'Connecté (1ms)' : 'Échec'}
                    </div>`
                )
                .join('')}
            </div>`
          : ''
      }
    `;

    const drawerEl = bench.setSideDrawer(html);
    if (!drawerEl) return;

    drawerEl.querySelectorAll('[data-toggle-vlan]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const vid = Number(btn.getAttribute('data-toggle-vlan'));
        state.vlans[vid].configured = !state.vlans[vid].configured;
        pushTerm(`SW-CORE(config)# ${state.vlans[vid].configured ? '' : 'no '}vlan ${vid} name ${state.vlans[vid].name}`);
        sfx.click();
        renderSideDrawer();
        refreshHud();
      });
    });

    drawerEl.querySelector('#btn-all-vlans')?.addEventListener('click', applyQuickVlanPreset);

    drawerEl.querySelectorAll('[data-port-mode]').forEach((sel) => {
      sel.addEventListener('change', () => {
        const swId = sel.getAttribute('data-port-mode');
        state.portConfigs[swId].mode = sel.value;
        pushTerm(`SW-CORE(config-if)# int ${swId} -> switchport mode ${sel.value.toLowerCase()}`);
        sfx.click();
        refreshHud();
      });
    });

    drawerEl.querySelectorAll('[data-port-vlan]').forEach((inp) => {
      inp.addEventListener('change', () => {
        const swId = inp.getAttribute('data-port-vlan');
        state.portConfigs[swId].vlan = inp.value.trim();
        pushTerm(`SW-CORE(config-if)# int ${swId} -> vlan ${state.portConfigs[swId].vlan}`);
        sfx.click();
        refreshHud();
      });
    });

    const runCli = () => {
      const inp = drawerEl.querySelector('#cli-input-cmd');
      const cmd = String(inp?.value || '').trim();
      if (!cmd) return;
      pushTerm(`SW-CORE# ${cmd}`);
      const low = cmd.toLowerCase();
      if (low.startsWith('vlan ')) {
        const id = parseInt(low.replace('vlan ', ''), 10);
        if (state.vlans[id]) {
          state.vlans[id].configured = true;
          pushTerm(`VLAN ${id} (${state.vlans[id].name}) activé OK`);
        }
      } else if (low.startsWith('ping')) {
        runPingSimulation();
        return;
      } else if (low === 'show vlan') {
        Object.entries(state.vlans).forEach(([k, v]) => pushTerm(`VLAN ${k} ${v.name} : ${v.configured ? 'ACTIVE' : 'DOWN'}`));
      } else {
        pushTerm('Commande exécutée.');
      }
      if (inp) inp.value = '';
      renderSideDrawer();
      refreshHud();
    };

    drawerEl.querySelector('#btn-cli-send')?.addEventListener('click', runCli);
    drawerEl.querySelector('#cli-input-cmd')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runCli();
    });
    drawerEl.querySelector('#btn-run-ping-3d')?.addEventListener('click', runPingSimulation);
  }

  function finishWorkshop() {
    if (state.finished) return;
    state.finished = true;
    const m = computeMetrics();
    const res = computeRackVlanScore3D(m);
    sfx.success();
    api.finishTp(
      res.score,
      `
        <p>Audit Baie 19" & Configuration VLAN 3D terminé en <strong>${Math.round(bench.getElapsedSec())}s</strong> :</p>
        <ul>
          <li>Brassage physique 3D : <strong>${m.matchedCables}/${m.totalCables}</strong> liens corrects (${m.mediaOk}/${m.totalCables} médias exacts)</li>
          <li>Fibre nettoyée / Alimentation redondante UPS-B : <strong>${m.fiberCleaned ? 'Oui' : 'Non'} / ${m.psuRedundant ? 'Oui' : 'Non'}</strong></li>
          <li>VLANs 10/20/30 & Ports Switch : <strong>${m.vlansConfigured}/3 VLANs · ${m.portsConfigured}/4 ports</strong></li>
          <li>Tests Ping Inter-VLAN 3D : <strong>${m.pingSuccessCount}/3</strong></li>
        </ul>
      `
    );
  }

  function refreshHud() {
    const m = computeMetrics();
    if (state.phase === 'patch') {
      bench.setInstruction(
        'PHASE 1 · BRASSAGE 3D',
        state.selectedPanelId
          ? `Port sélectionné : ${state.selectedPanelId} → Cliquez un port sur le Switch`
          : 'Cliquez un port du Bandeau (haut), puis son port cible sur le Switch',
        'Nettoyez la fibre (stylo violet) pour PP-04/Te0/1 et enclenchez UPS-B en bas de la baie avant de passer à la console VLAN.'
      );
      bench.setTools(
        [
          ...CORD_PALETTE.map((c) => ({ id: c.id, icon: c.icon, label: c.label })),
          { id: 'fiber-clean', icon: '🖊️', label: state.fiberCleaned ? '✔ Fibre nettoyée' : 'Nettoyer Fibre' }
        ],
        state.selectedCord,
        (id) => {
          if (id === 'fiber-clean') {
            state.fiberCleaned = true;
            sfx.click();
            bench.showToast('Ferrules optiques SFP+ nettoyées au stylo nettoyant !', 'success');
            refreshHud();
          } else {
            state.selectedCord = id;
            sfx.click();
            refreshHud();
          }
        }
      );
    } else {
      bench.setInstruction(
        'PHASE 2 · CONSOLE VLAN 3D',
        'Configurez les VLANs 10/20/30 & le Trunk 802.1Q puis lancez Ping 3D',
        'Ports Access : Gi0/1→10, Gi0/2→20, Gi0/3→30 | Port Trunk Fibre : Te0/1→10,20,30.'
      );
      bench.setTools([], null);
    }

    bench.setAccuracy(`Liens ${m.matchedCables}/4 · VLANs ${m.vlansConfigured}/3 · Pings ${m.pingSuccessCount}/3`);

    const actions = [{ id: 'reset', label: 'Réinitialiser', onClick: resetAll }];
    if (state.phase === 'patch') {
      actions.push({
        id: 'to-vlan',
        label: 'Ouvrir Console Laptop',
        primary: m.matchedCables >= 4,
        onClick: () => {
          state.phase = 'vlan';
          selectCamera('laptop');
          renderSideDrawer();
          refreshHud();
        }
      });
    } else {
      actions.push({
        id: 'to-patch',
        label: 'Retour Baie 19"',
        onClick: () => {
          state.phase = 'patch';
          selectCamera('rack');
          renderSideDrawer();
          refreshHud();
        }
      });
      actions.push({
        id: 'finish-tp4',
        label: 'Valider Baie & VLANs',
        primary: true,
        onClick: finishWorkshop
      });
    }
    bench.setActions(actions);
  }

  function resetAll() {
    Object.keys(state.links).forEach((pid) => clearCableForPanel(pid));
    state.selectedPanelId = null;
    state.fiberCleaned = false;
    state.psuBEnabled = false;
    state.cableErrors = 0;
    state.vlans[10].configured = false;
    state.vlans[20].configured = false;
    state.vlans[30].configured = false;
    for (const swId of switchPortIds) {
      state.portConfigs[swId] = { mode: 'ACCESS', vlan: '1' };
    }
    state.pingResults = [];
    state.finished = false;
    updatePortLeds();
    renderSideDrawer();
    refreshHud();
  }

  for (const def of RACK_PORTS_DEF) {
    const pm = panelPortMeshes[def.panelId];
    bench.addInteractive(pm.mesh, {
      label: `${def.panelId} — ${def.panelLabel} (Clic pour sélectionner / débrancher)`,
      onClick: () => {
        if (state.phase !== 'patch') {
          state.phase = 'patch';
          renderSideDrawer();
        }
        if (state.links[def.panelId]) {
          clearCableForPanel(def.panelId);
          updatePortLeds();
          sfx.click();
          bench.showToast(`Cordon retiré de ${def.panelId}.`, 'info');
          refreshHud();
          return;
        }
        state.selectedPanelId = def.panelId;
        sfx.click();
        bench.showToast(`${def.panelId} sélectionné — cliquez sur un port Switch (${switchPortIds.join(', ')}).`, 'info');
        refreshHud();
      }
    });
  }

  for (const swId of switchPortIds) {
    const sm = switchPortMeshes[swId];
    bench.addInteractive(sm.mesh, {
      label: `Port Switch ${swId}`,
      onClick: () => {
        if (!state.selectedPanelId) {
          bench.showToast('Sélectionnez d’abord un port sur le Bandeau de Brassage en haut de la baie.', 'info');
          return;
        }
        if (swId === 'Te0/1' && state.selectedCord === 'fiber' && !state.fiberCleaned) {
          bench.showToast('Conseil optique : nettoyez d’abord la jarretière avec le stylo violet sur la table !', 'info');
        }
        const def = RACK_PORTS_DEF.find((d) => d.panelId === state.selectedPanelId);
        createOrUpdateCable(state.selectedPanelId, swId, state.selectedCord);
        if (def && (def.expectedSwitch !== swId || def.expectedMedia !== state.selectedCord)) {
          state.cableErrors += 1;
          sfx.error();
          bench.showToast(
            `${state.selectedPanelId} → ${swId} connecté (LED orange : vérifiez le port ou type de cordon ${def.expectedMedia.toUpperCase()}).`,
            'error'
          );
        } else {
          sfx.click();
          bench.spawnPulseRing(switchPortWorldPos[swId], '#22c55e', 0.055);
          bench.showToast(`Lien certifié : ${state.selectedPanelId} ↔ ${swId} (Link UP !).`, 'success');
        }
        state.selectedPanelId = null;
        refreshHud();
      }
    });
  }

  bench.addInteractive(fiberCleaner, {
    label: 'Stylo Nettoyant Fibre Optique',
    onClick: () => {
      state.fiberCleaned = true;
      state.selectedCord = 'fiber';
      sfx.click();
      bench.showToast('Ferrules optiques nettoyées et câble Fibre sélectionné !', 'success');
      refreshHud();
    }
  });

  bench.addInteractive(psuBBtn, {
    label: 'Interrupteur Onduleur Redondant UPS-B',
    onClick: () => {
      state.psuBEnabled = !state.psuBEnabled;
      updatePortLeds();
      sfx.click();
      bench.showToast(state.psuBEnabled ? 'Alimentation redondante UPS-B activée (Vert) !' : 'UPS-B désactivé.', state.psuBEnabled ? 'success' : 'info');
      refreshHud();
    }
  });

  bench.addInteractive(laptopLidShell, {
    label: 'PC Portable Console Switch (Clic pour configurer VLANs)',
    onClick: () => {
      state.phase = 'vlan';
      selectCamera('laptop');
      renderSideDrawer();
      refreshHud();
    }
  });

  bench.addFloatingTag(() => new THREE.Vector3(-0.32, 0.78, 0.14), 'Bandeau Brassage', 'pp');
  bench.addFloatingTag(() => new THREE.Vector3(-0.32, 0.56, 0.14), 'Switch Core L3', 'sw');
  bench.addFloatingTag(() => new THREE.Vector3(-0.14, 0.15, 0.14), 'UPS-B', 'ups');
  bench.addFloatingTag(() => new THREE.Vector3(0.42, 0.30, 0.02), 'Laptop Console', 'lap');

  bench.setCameras(CAM_VIEWS, state.camId, selectCamera);

  bench.addUpdate((dt) => {
    for (let i = activePulses.length - 1; i >= 0; i--) {
      const p = activePulses[i];
      p.t += dt * p.speed;
      const limit = p.ok ? 1 : 0.48;
      if (p.t >= limit) {
        bench.scene.remove(p.mesh);
        activePulses.splice(i, 1);
      } else {
        const pt = p.curve.getPoint(p.t);
        p.mesh.position.copy(pt);
      }
    }
  });

  renderSideDrawer();
  refreshHud();

  return {
    destroy: () => bench.destroy()
  };
}

export function createPatchRackGame(api) {
  return createRackVlanWorkshop3D(api, { initialMode: 'patch' });
}
