import * as THREE from 'three';
import { sfx } from '../core/audio.js';
import {
  createWorkbench3D,
  makeCanvasScreen,
  buildFlexibleCable,
  createEsdMatTexture
} from './Workbench3DHost.js';

export const VMVLAN_STAGES = [
  {
    id: 1,
    name: '1. 2 VLANs & 2 VMs',
    brief:
      'Déployez 2 VMs sur l’hyperviseur (sans dépasser ses ressources), créez les VLANs 10 (ADMIN) et 20 (ELEVES), configurez les ports Access/Trunk 802.1Q et activez le routage Inter-VLAN.',
    hostLimits: { cpu: 8, ram: 16, disk: 250 },
    requiredVlans: [
      { id: 10, name: 'ADMIN', subnet: '192.168.10.0/24', gw: '192.168.10.254' },
      { id: 20, name: 'ELEVES', subnet: '192.168.20.0/24', gw: '192.168.20.254' }
    ],
    requiredVms: [
      { role: 'SRV-ADMIN', os: 'Debian 12', minCpu: 2, minRam: 4, minDisk: 40, vlan: 10 },
      { role: 'PC-ELEVE-VM', os: 'Ubuntu Desktop', minCpu: 2, minRam: 4, minDisk: 30, vlan: 20 }
    ],
    portsSpec: [
      { port: 'Gi0/1', desc: 'Lien Hyperviseur (Multi-VM)', expectedMode: 'TRUNK', expectedVlans: [10, 20] },
      { port: 'Gi0/2', desc: 'Lien Routeur (Router-on-a-Stick)', expectedMode: 'TRUNK', expectedVlans: [10, 20] },
      { port: 'Gi0/3', desc: 'PC Professeur (VLAN 10)', expectedMode: 'ACCESS', expectedPvid: 10 },
      { port: 'Gi0/4', desc: 'Poste TP Élève (VLAN 20)', expectedMode: 'ACCESS', expectedPvid: 20 }
    ],
    requiredAcls: [],
    pingTests: [
      { from: 'PC Prof (VLAN 10)', to: 'VM SRV-ADMIN (VLAN 10)', srcVlan: 10, dstVlan: 10, expectReachable: true },
      { from: 'Poste Élève (VLAN 20)', to: 'VM SRV-ADMIN (VLAN 10)', srcVlan: 20, dstVlan: 10, expectReachable: true }
    ]
  },
  {
    id: 2,
    name: '2. Infra 3 VLANs + DMZ',
    brief:
      'Architecture d’entreprise : ajoutez le VLAN 30 (DMZ), déployez 3 VMs (AD/DHCP, Serveur Web DMZ, Poste Audit) sur les bons VLANs et configurez tous les Trunks et passerelles.',
    hostLimits: { cpu: 12, ram: 24, disk: 400 },
    requiredVlans: [
      { id: 10, name: 'ADMIN', subnet: '192.168.10.0/24', gw: '192.168.10.254' },
      { id: 20, name: 'CLIENT', subnet: '192.168.20.0/24', gw: '192.168.20.254' },
      { id: 30, name: 'DMZ', subnet: '192.168.30.0/24', gw: '192.168.30.254' }
    ],
    requiredVms: [
      { role: 'VM-AD-DHCP', os: 'Windows Server', minCpu: 4, minRam: 8, minDisk: 80, vlan: 10 },
      { role: 'VM-WEB-DMZ', os: 'Debian 12', minCpu: 2, minRam: 4, minDisk: 40, vlan: 30 },
      { role: 'VM-CLIENT-01', os: 'Ubuntu Desktop', minCpu: 2, minRam: 4, minDisk: 40, vlan: 20 }
    ],
    portsSpec: [
      { port: 'Gi0/1', desc: 'Uplink Hyperviseur (3 VLANs)', expectedMode: 'TRUNK', expectedVlans: [10, 20, 30] },
      { port: 'Gi0/2', desc: 'Uplink Routeur Inter-VLAN', expectedMode: 'TRUNK', expectedVlans: [10, 20, 30] },
      { port: 'Gi0/3', desc: 'Poste Admin', expectedMode: 'ACCESS', expectedPvid: 10 },
      { port: 'Gi0/4', desc: 'Poste Client', expectedMode: 'ACCESS', expectedPvid: 20 },
      { port: 'Gi0/5', desc: 'Sonde / Backup DMZ', expectedMode: 'ACCESS', expectedPvid: 30 }
    ],
    requiredAcls: [],
    pingTests: [
      { from: 'Poste Client (VLAN 20)', to: 'VM-WEB-DMZ (VLAN 30)', srcVlan: 20, dstVlan: 30, expectReachable: true },
      { from: 'Poste Admin (VLAN 10)', to: 'VM-AD-DHCP (VLAN 10)', srcVlan: 10, dstVlan: 10, expectReachable: true }
    ]
  },
  {
    id: 3,
    name: '3. Cyber VLAN + Pare-feu ACL',
    brief:
      'TP Sécurité Complet : déployez le pare-feu pfSense en VM + serveurs, configurez le Trunk double-switch 802.1Q et écrivez les règles ACL : VLAN 20 (Élèves) doit joindre la DMZ (30) MAIS être bloqué vers ADMIN (10) !',
    hostLimits: { cpu: 16, ram: 32, disk: 500 },
    requiredVlans: [
      { id: 10, name: 'ADMIN', subnet: '192.168.10.0/24', gw: '192.168.10.254' },
      { id: 20, name: 'ELEVES', subnet: '192.168.20.0/24', gw: '192.168.20.254' },
      { id: 30, name: 'DMZ', subnet: '192.168.30.0/24', gw: '192.168.30.254' }
    ],
    requiredVms: [
      { role: 'VM-PFSENSE', os: 'pfSense / OPNsense', minCpu: 2, minRam: 4, minDisk: 30, vlan: 10 },
      { role: 'VM-SRV-FICHIERS', os: 'Debian 12', minCpu: 4, minRam: 8, minDisk: 100, vlan: 10 },
      { role: 'VM-WEB-PORTAIL', os: 'Debian 12', minCpu: 2, minRam: 4, minDisk: 40, vlan: 30 }
    ],
    portsSpec: [
      { port: 'Gi0/1', desc: 'Trunk Hyperviseur', expectedMode: 'TRUNK', expectedVlans: [10, 20, 30] },
      { port: 'Gi0/2', desc: 'Trunk Switch Accès', expectedMode: 'TRUNK', expectedVlans: [10, 20, 30] },
      { port: 'Gi0/3', desc: 'Trunk Routeur/Pare-feu', expectedMode: 'TRUNK', expectedVlans: [10, 20, 30] },
      { port: 'Gi0/4', desc: 'Poste Prof (ADMIN)', expectedMode: 'ACCESS', expectedPvid: 10 },
      { port: 'Gi0/5', desc: 'Salle Élèves (VLAN 20)', expectedMode: 'ACCESS', expectedPvid: 20 }
    ],
    requiredAcls: [
      { src: 20, dst: 10, action: 'DENY' },
      { src: 20, dst: 30, action: 'ALLOW' }
    ],
    pingTests: [
      { from: 'Salle Élèves (VLAN 20)', to: 'VM-WEB-PORTAIL (VLAN 30)', srcVlan: 20, dstVlan: 30, expectReachable: true },
      { from: 'Salle Élèves (VLAN 20)', to: 'VM-SRV-FICHIERS (VLAN 10)', srcVlan: 20, dstVlan: 10, expectReachable: false },
      { from: 'Poste Prof (VLAN 10)', to: 'VM-SRV-FICHIERS (VLAN 10)', srcVlan: 10, dstVlan: 10, expectReachable: true }
    ]
  }
];

export function parseVlanList(str) {
  return String(str || '')
    .split(/[\s,;]+/)
    .map((n) => parseInt(n, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function evaluateVmVlanStage(stage, cfg) {
  const errors = [];

  const usedCpu = cfg.vms.reduce((s, v) => s + Number(v.cpu || 0), 0);
  const usedRam = cfg.vms.reduce((s, v) => s + Number(v.ram || 0), 0);
  const usedDisk = cfg.vms.reduce((s, v) => s + Number(v.disk || 0), 0);
  if (usedCpu > stage.hostLimits.cpu) errors.push(`Surcharge vCPU (${usedCpu}/${stage.hostLimits.cpu}).`);
  if (usedRam > stage.hostLimits.ram) errors.push(`Surcharge RAM (${usedRam}/${stage.hostLimits.ram} Go).`);
  if (usedDisk > stage.hostLimits.disk) errors.push(`Surcharge Disque (${usedDisk}/${stage.hostLimits.disk} Go).`);

  for (const req of stage.requiredVms) {
    const vm = cfg.vms.find((v) => v.role === req.role || v.name === req.role);
    if (!vm) {
      errors.push(`VM manquante : ${req.role} (VLAN ${req.vlan}).`);
      continue;
    }
    if (!vm.started) errors.push(`Démarrez la VM ${vm.name} sur l’hyperviseur.`);
    if (Number(vm.vlan) !== req.vlan) errors.push(`${vm.name} doit être rattachée au VLAN ${req.vlan} (actuel: ${vm.vlan}).`);
    if (Number(vm.cpu) < req.minCpu || Number(vm.ram) < req.minRam || Number(vm.disk) < req.minDisk) {
      errors.push(`Ressources insuffisantes pour ${vm.name} (min ${req.minCpu} vCPU, ${req.minRam} Go RAM, ${req.minDisk} Go).`);
    }
  }

  for (const rv of stage.requiredVlans) {
    const v = cfg.vlans.find((x) => Number(x.id) === rv.id);
    if (!v || !v.enabled) {
      errors.push(`VLAN ${rv.id} (${rv.name}) absent ou inactif sur le switch.`);
    }
  }

  for (const spec of stage.portsSpec) {
    const p = cfg.ports.find((x) => x.port === spec.port);
    if (!p) {
      errors.push(`Port ${spec.port} non configuré.`);
      continue;
    }
    if (p.mode !== spec.expectedMode) {
      errors.push(`Port ${spec.port} (${spec.desc}) doit être en mode ${spec.expectedMode} (actuel: ${p.mode}).`);
    } else if (spec.expectedMode === 'ACCESS' && Number(p.pvid) !== spec.expectedPvid) {
      errors.push(`Port ${spec.port} Access doit avoir le PVID VLAN ${spec.expectedPvid}.`);
    } else if (spec.expectedMode === 'TRUNK') {
      const allowed = parseVlanList(p.allowedVlans);
      const missing = spec.expectedVlans.filter((vid) => !allowed.includes(vid));
      if (missing.length > 0) {
        errors.push(`Trunk ${spec.port} : autorisez aussi les VLAN(s) ${missing.join(', ')}.`);
      }
    }
  }

  for (const rv of stage.requiredVlans) {
    const gwObj = cfg.gateways[rv.id];
    if (!gwObj || !gwObj.enabled || gwObj.ip.trim() !== rv.gw) {
      errors.push(`Sous-interface Routeur VLAN ${rv.id} : activez et réglez la passerelle ${rv.gw}.`);
    }
  }

  for (const reqAcl of stage.requiredAcls) {
    const found = cfg.acls.find(
      (a) =>
        Number(a.src) === reqAcl.src &&
        Number(a.dst) === reqAcl.dst &&
        a.action === reqAcl.action
    );
    if (!found) {
      errors.push(`Règle ACL requise manquante : ${reqAcl.action} VLAN ${reqAcl.src} → VLAN ${reqAcl.dst}.`);
    }
  }

  const pingResults = stage.pingTests.map((test) => {
    const sameVlan = test.srcVlan === test.dstVlan;
    const srcVlanOn = cfg.vlans.find((x) => Number(x.id) === test.srcVlan)?.enabled;
    const dstVlanOn = cfg.vlans.find((x) => Number(x.id) === test.dstVlan)?.enabled;
    const srcAccessPort = cfg.ports.find(
      (p) => p.mode === 'ACCESS' && Number(p.pvid) === test.srcVlan
    );
    const dstVmUp = cfg.vms.some((v) => Number(v.vlan) === test.dstVlan && v.started);

    const hypTrunk = cfg.ports.find((p) => p.port === 'Gi0/1');
    const rtrTrunk = cfg.ports.find((p) => p.port === (stage.id === 3 ? 'Gi0/3' : 'Gi0/2'));

    const hypOk =
      hypTrunk?.mode === 'TRUNK' &&
      parseVlanList(hypTrunk.allowedVlans).includes(test.dstVlan);

    const rtrOk =
      sameVlan ||
      (rtrTrunk?.mode === 'TRUNK' &&
        parseVlanList(rtrTrunk.allowedVlans).includes(test.srcVlan) &&
        parseVlanList(rtrTrunk.allowedVlans).includes(test.dstVlan) &&
        cfg.gateways[test.srcVlan]?.enabled &&
        cfg.gateways[test.dstVlan]?.enabled &&
        cfg.gateways[test.srcVlan]?.ip?.trim() === stage.requiredVlans.find((v) => v.id === test.srcVlan)?.gw &&
        cfg.gateways[test.dstVlan]?.ip?.trim() === stage.requiredVlans.find((v) => v.id === test.dstVlan)?.gw);

    const aclRule = cfg.acls.find(
      (a) => Number(a.src) === test.srcVlan && Number(a.dst) === test.dstVlan
    );
    const blockedByAcl = aclRule?.action === 'DENY';

    const actualReachable = Boolean(
      srcVlanOn && dstVlanOn && srcAccessPort && dstVmUp && hypOk && rtrOk && !blockedByAcl
    );
    const testPassed = actualReachable === test.expectReachable;

    if (!testPassed) {
      if (test.expectReachable && !actualReachable) {
        errors.push(`Ping échoué : ${test.from} → ${test.to}.`);
      } else if (!test.expectReachable && actualReachable) {
        errors.push(`Faille sécurité : ${test.from} atteint encore ${test.to} ! Ajoutez une règle ACL DENY.`);
      }
    }

    return {
      ...test,
      actualReachable,
      blockedByAcl,
      passed: testPassed
    };
  });

  return {
    passed: errors.length === 0 && pingResults.every((p) => p.passed),
    errors: [...new Set(errors)],
    pingResults
  };
}

export function computeVlanConfigScore3D(metrics = {}) {
  const vlansOk = Math.max(0, Math.min(3, metrics.vlansCreated ?? 0));
  const trunkOk = metrics.trunkConfigured ? 1 : 0;
  const gwOk = Math.max(0, Math.min(3, metrics.gatewaysOk ?? 0));
  const stpPts = metrics.stpResolved ? 4 : 0;
  const probePts = metrics.pingOk ? 3 : metrics.probeRun ? 1 : 0;

  const vlanPts = (vlansOk / 3) * 5;
  const trunkPts = trunkOk * 3;
  const gwPts = (gwOk / 3) * 4;

  const elapsed = metrics.elapsedSec ?? 120;
  const bonus = elapsed < 90 ? 1 : elapsed < 150 ? 0.5 : 0;
  const raw = vlanPts + trunkPts + gwPts + stpPts + probePts + bonus;
  return Math.max(0, Math.min(20, Math.round(raw * 2) / 2));
}

const CAM_VIEWS = [
  { id: 'overview', label: 'Vue Architecture', pos: [0.04, 1.15, 1.5], lookAt: [0.04, 0.24, -0.02], fov: 40 },
  { id: 'console', label: 'Laptop CLI Console', pos: [-0.55, 0.54, 0.62], lookAt: [-0.55, 0.19, 0.08], fov: 35 },
  { id: 'campus', label: 'Maquette Campus 3D', pos: [0.46, 0.72, 0.92], lookAt: [0.34, 0.16, 0.02], fov: 36 }
];

export function createVmVlanGame(api) {
  const bench = createWorkbench3D(api.container, {
    cameraPos: CAM_VIEWS[0].pos,
    lookAt: CAM_VIEWS[0].lookAt,
    fov: CAM_VIEWS[0].fov,
    hasEsdMat: false
  });

  const esdTex = createEsdMatTexture();
  const deskMat = new THREE.Mesh(
    new THREE.BoxGeometry(1.88, 0.01, 0.98),
    new THREE.MeshStandardMaterial({ map: esdTex, roughness: 0.7, metalness: 0.08 })
  );
  deskMat.position.set(0, 0.006, 0.06);
  deskMat.receiveShadow = true;
  bench.scene.add(deskMat);

  const state = {
    camId: 'overview',
    selectedRoom: 'admin',
    vlans: { 10: true, 20: false, 30: false },
    ports: {
      'Gi0/1': { mode: 'ACCESS', pvid: 1, allowed: [] },
      'Gi0/2': { mode: 'ACCESS', pvid: 1, allowed: [] },
      'Gi0/3': { mode: 'ACCESS', pvid: 1, allowed: [] },
      'Gi0/24': { mode: 'ACCESS', pvid: 1, allowed: [] }
    },
    gateways: {
      10: { ip: '192.168.10.254', mask: '255.255.255.0', up: true },
      20: { ip: '192.168.20.1', mask: '255.255.0.0', up: false },
      30: { ip: '0.0.0.0', mask: '255.255.255.0', up: false }
    },
    stpResolved: false,
    cliHistory: [
      'SW-CORE-L3# show spanning-tree summary',
      '! ALERTE: Boucle STP active sur Gi0/11 <-> Gi0/12 (Tempête Broadcast)',
      '! VLAN 20 (ATELIER) et VLAN 30 (CYBER) absents ou non routés.',
      'SW-CORE-L3#'
    ],
    probeRunCount: 0,
    lastPingOk: false,
    packets: [],
    startMs: performance.now(),
    submitted: false
  };

  function evaluateTopology() {
    const vlansCreated = [10, 20, 30].filter((v) => state.vlans[v]).length;
    const g1 = state.ports['Gi0/1'];
    const g2 = state.ports['Gi0/2'];
    const g3 = state.ports['Gi0/3'];
    const g24 = state.ports['Gi0/24'];

    const adminOk = state.vlans[10] && g1.mode === 'ACCESS' && g1.pvid === 10;
    const atelierOk = state.vlans[20] && g2.mode === 'ACCESS' && g2.pvid === 20;
    const cyberOk = state.vlans[30] && g3.mode === 'ACCESS' && g3.pvid === 30;
    const trunkConfigured =
      g24.mode === 'TRUNK' && [10, 20, 30].every((v) => g24.allowed.includes(v));

    const gw10Ok = state.gateways[10].up && state.gateways[10].ip === '192.168.10.254' && state.gateways[10].mask === '255.255.255.0';
    const gw20Ok = state.gateways[20].up && state.gateways[20].ip === '192.168.20.254' && state.gateways[20].mask === '255.255.255.0';
    const gw30Ok = state.gateways[30].up && state.gateways[30].ip === '192.168.30.254' && state.gateways[30].mask === '255.255.255.0';
    const gatewaysOk = [gw10Ok, gw20Ok, gw30Ok].filter(Boolean).length;

    const fullRouteOk = adminOk && atelierOk && cyberOk && trunkConfigured && gatewaysOk === 3 && state.stpResolved;
    return {
      vlansCreated,
      adminOk,
      atelierOk,
      cyberOk,
      trunkConfigured,
      gw10Ok,
      gw20Ok,
      gw30Ok,
      gatewaysOk,
      fullRouteOk
    };
  }

  const laptopGroup = new THREE.Group();
  laptopGroup.position.set(-0.56, 0.012, 0.16);
  laptopGroup.rotation.y = 0.24;
  bench.scene.add(laptopGroup);

  const laptopBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.022, 0.32),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.65 })
  );
  laptopBase.position.y = 0.011;
  laptopBase.castShadow = true;
  laptopGroup.add(laptopBase);

  const keyPad = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.004, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.65 })
  );
  keyPad.position.set(0, 0.023, 0.02);
  laptopGroup.add(keyPad);

  const lidGroup = new THREE.Group();
  lidGroup.position.set(0, 0.022, -0.15);
  lidGroup.rotation.x = -0.32;
  laptopGroup.add(lidGroup);

  const lidShell = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.3, 0.014),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.6 })
  );
  lidShell.position.set(0, 0.15, 0);
  lidShell.castShadow = true;
  lidGroup.add(lidShell);

  const laptopScreen = makeCanvasScreen(512, 320);
  const screenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.26),
    new THREE.MeshBasicMaterial({ map: laptopScreen.texture })
  );
  screenMesh.position.set(0, 0.15, 0.009);
  lidGroup.add(screenMesh);

  bench.addInteractive(laptopGroup, {
    label: 'Laptop Console Admin (Zoom CLI)',
    cursor: 'pointer',
    onClick: () => {
      setCameraById('console');
      sfx.click();
    }
  });

  const stackGroup = new THREE.Group();
  stackGroup.position.set(-0.28, 0.012, -0.26);
  bench.scene.add(stackGroup);

  const l3Switch = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.07, 0.24),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.72 })
  );
  l3Switch.position.y = 0.035;
  l3Switch.castShadow = true;
  stackGroup.add(l3Switch);

  const routerBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.065, 0.24),
    new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.35, metalness: 0.7 })
  );
  routerBox.position.y = 0.105;
  routerBox.castShadow = true;
  stackGroup.add(routerBox);

  const consoleCable = buildFlexibleCable(
    new THREE.Vector3(-0.34, 0.03, 0.12),
    new THREE.Vector3(-0.14, 0.04, -0.14),
    0x38bdf8,
    0.007,
    0.04
  );
  bench.scene.add(consoleCable);

  const campusGroup = new THREE.Group();
  campusGroup.position.set(0.36, 0.012, 0.04);
  bench.scene.add(campusGroup);

  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.03, 0.76),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6, metalness: 0.25 })
  );
  plinth.position.y = 0.015;
  plinth.receiveShadow = true;
  campusGroup.add(plinth);

  const ROOM_DEFS = [
    { id: 'core', label: 'Cœur L3 / Routeur', pos: [0, 0.03, -0.02], size: [0.22, 0.16, 0.22], baseColor: 0x38bdf8 },
    { id: 'admin', label: 'Administration (VLAN 10)', pos: [-0.28, 0.03, 0.2], size: [0.22, 0.11, 0.18], baseColor: 0x3b82f6 },
    { id: 'atelier', label: 'Atelier (VLAN 20)', pos: [0.28, 0.03, 0.2], size: [0.22, 0.11, 0.18], baseColor: 0x22c55e },
    { id: 'cyber', label: 'Labo Cyber (VLAN 30)', pos: [0.28, 0.03, -0.22], size: [0.22, 0.11, 0.18], baseColor: 0xa855f7 }
  ];

  const roomMeshes = {};
  for (const r of ROOM_DEFS) {
    const group = new THREE.Group();
    group.position.set(r.pos[0], r.pos[1], r.pos[2]);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.4,
      metalness: 0.45,
      emissive: 0x000000
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(r.size[0], r.size[1], r.size[2]), bodyMat);
    body.position.y = r.size[1] / 2;
    body.castShadow = true;
    group.add(body);

    const roofMat = new THREE.MeshStandardMaterial({
      color: r.baseColor,
      emissive: r.baseColor,
      emissiveIntensity: 0.4,
      roughness: 0.3
    });
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(r.size[0] * 0.86, 0.014, r.size[2] * 0.86),
      roofMat
    );
    roof.position.y = r.size[1] + 0.008;
    group.add(roof);

    campusGroup.add(group);
    roomMeshes[r.id] = { group, bodyMat, roofMat, def: r };

    bench.addInteractive(group, {
      label: r.label,
      cursor: 'pointer',
      onClick: () => {
        state.selectedRoom = r.id;
        sfx.click();
        refreshUi();
      }
    });
  }

  function makeConduit(aPos, bPos) {
    const start = new THREE.Vector3(aPos[0], 0.06, aPos[2]);
    const end = new THREE.Vector3(bPos[0], 0.06, bPos[2]);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    mid.y = 0.075;
    const curve = new THREE.CatmullRomCurve3([start, mid, end]);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 0.5,
      roughness: 0.3
    });
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.012, 8, false), mat);
    campusGroup.add(mesh);
    return { mesh, mat, curve };
  }

  const conduits = {
    admin: makeConduit([-0.28, 0, 0.2], [0, 0, -0.02]),
    atelier: makeConduit([0.28, 0, 0.2], [0, 0, -0.02]),
    cyber: makeConduit([0.28, 0, -0.22], [0, 0, -0.02]),
    stpLoop: makeConduit([-0.28, 0, 0.2], [0.28, 0, 0.2])
  };

  function spawnPacketFlow(fromId, toId, success) {
    const routeCurves = [];
    if (fromId !== 'core' && conduits[fromId]) {
      routeCurves.push({ curve: conduits[fromId].curve, reverse: false });
    }
    if (toId !== 'core' && conduits[toId]) {
      routeCurves.push({ curve: conduits[toId].curve, reverse: true });
    }
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 12, 12),
      new THREE.MeshBasicMaterial({ color: success ? 0x22c55e : 0xef4444 })
    );
    campusGroup.add(orb);
    state.packets.push({
      orb,
      segments: routeCurves,
      segIdx: 0,
      t: 0,
      success
    });
  }

  function appendCli(line) {
    state.cliHistory.push(line);
    if (state.cliHistory.length > 14) state.cliHistory.shift();
  }

  function runCliCommand(rawCmd) {
    const cmd = String(rawCmd || '').trim();
    if (!cmd) return;
    const lower = cmd.toLowerCase();
    appendCli(`SW-CORE-L3# ${cmd}`);

    if (lower === 'help' || lower === '?') {
      appendCli('Cmds: vlan <10|20|30>, int <gi0/1..3|gi0/24>, trunk, access <id>,');
      appendCli('      gw <10|20|30> <ip>, stp fix, ping <10|20|30>, traceroute, show');
    } else if (/^vlan\s+(10|20|30)$/.test(lower)) {
      const id = Number(lower.match(/^vlan\s+(10|20|30)$/)[1]);
      state.vlans[id] = true;
      appendCli(`VLAN ${id} créé et activé (active).`);
      sfx.snap();
    } else if (lower.includes('stp') || lower.includes('spanning') || lower.includes('shut gi0/12')) {
      state.stpResolved = true;
      appendCli('STP Guard & Shutdown Gi0/12 : Boucle Spanning-Tree neutralisée.');
      sfx.success();
    } else if (/^access\s+gi0\/(1|2|3)\s+(10|20|30)$/.test(lower)) {
      const m = lower.match(/^access\s+gi0\/(1|2|3)\s+(10|20|30)$/);
      const pName = `Gi0/${m[1]}`;
      const vid = Number(m[2]);
      state.ports[pName] = { mode: 'ACCESS', pvid: vid, allowed: [] };
      appendCli(`${pName} -> switchport mode access, vlan ${vid}.`);
      sfx.snap();
    } else if (lower.includes('trunk') && lower.includes('gi0/24')) {
      state.ports['Gi0/24'] = { mode: 'TRUNK', pvid: 1, allowed: [10, 20, 30] };
      appendCli('Gi0/24 -> switchport mode trunk, allowed vlan 10,20,30.');
      sfx.snap();
    } else if (/^gw\s+(10|20|30)\s+([0-9.]+)$/.test(lower)) {
      const m = lower.match(/^gw\s+(10|20|30)\s+([0-9.]+)$/);
      const vid = Number(m[1]);
      state.gateways[vid] = { ip: m[2], mask: '255.255.255.0', up: true };
      appendCli(`interface Vlan${vid}: ip ${m[2]} 255.255.255.0 (no shut).`);
      sfx.snap();
    } else if (lower.startsWith('ping') || lower.startsWith('traceroute')) {
      triggerNetworkProbe(lower.startsWith('traceroute') ? 'traceroute' : 'ping');
      return;
    } else if (lower.startsWith('show')) {
      const ev = evaluateTopology();
      appendCli(`VLANs OK:${ev.vlansCreated}/3 | Trunk:${ev.trunkConfigured ? 'OK' : 'KO'} | GW:${ev.gatewaysOk}/3 | STP:${state.stpResolved ? 'OK' : 'LOOP'}`);
    } else {
      appendCli('% Commande non reconnue. Tapez "help" ou utilisez les raccourcis.');
      sfx.error();
    }
    syncTopology3D();
    refreshUi();
  }

  function triggerNetworkProbe(kind = 'ping') {
    state.probeRunCount += 1;
    const ev = evaluateTopology();
    state.lastPingOk = ev.fullRouteOk;

    if (ev.fullRouteOk) {
      if (kind === 'traceroute') {
        appendCli('traceroute 192.168.30.10: 1) 192.168.10.254 0.8ms -> 2) 192.168.30.10 1.4ms');
      } else {
        appendCli('PING 192.168.30.10: 5/5 paquets reçus (TTL=127, 1.1 ms) [OK]');
      }
      spawnPacketFlow('admin', 'cyber', true);
      spawnPacketFlow('atelier', 'admin', true);
      sfx.success();
    } else {
      const reason = !state.stpResolved
        ? 'Tempête Broadcast STP !'
        : !ev.trunkConfigured
        ? 'Trunk 802.1Q manquant sur Gi0/24'
        : ev.gatewaysOk < 3
        ? 'Passerelle Inter-VLAN incorrecte'
        : 'VLAN/Port Access manquant';
      appendCli(`ECHEC ${kind.toUpperCase()} -> ${reason}`);
      spawnPacketFlow('admin', 'cyber', false);
      sfx.error();
    }
    syncTopology3D();
    refreshUi();
  }

  function syncTopology3D() {
    const ev = evaluateTopology();

    function statusHex(isOk, partial) {
      if (!state.stpResolved) return 0xef4444;
      if (isOk) return 0x22c55e;
      if (partial) return 0xf59e0b;
      return 0xef4444;
    }

    const adminCol = statusHex(ev.adminOk && ev.gw10Ok, state.vlans[10]);
    const atelierCol = statusHex(ev.atelierOk && ev.gw20Ok, state.vlans[20]);
    const cyberCol = statusHex(ev.cyberOk && ev.gw30Ok, state.vlans[30]);
    const coreCol = statusHex(ev.trunkConfigured && ev.gatewaysOk === 3, ev.trunkConfigured || ev.gatewaysOk > 0);

    conduits.admin.mat.color.setHex(adminCol);
    conduits.admin.mat.emissive.setHex(adminCol);
    conduits.atelier.mat.color.setHex(atelierCol);
    conduits.atelier.mat.emissive.setHex(atelierCol);
    conduits.cyber.mat.color.setHex(cyberCol);
    conduits.cyber.mat.emissive.setHex(cyberCol);

    if (state.stpResolved) {
      conduits.stpLoop.mat.color.setHex(0x334155);
      conduits.stpLoop.mat.emissive.setHex(0x000000);
      conduits.stpLoop.mat.emissiveIntensity = 0;
    } else {
      conduits.stpLoop.mat.color.setHex(0xef4444);
      conduits.stpLoop.mat.emissive.setHex(0xef4444);
      conduits.stpLoop.mat.emissiveIntensity = 0.85;
    }

    roomMeshes.admin.roofMat.color.setHex(adminCol);
    roomMeshes.admin.roofMat.emissive.setHex(adminCol);
    roomMeshes.atelier.roofMat.color.setHex(atelierCol);
    roomMeshes.atelier.roofMat.emissive.setHex(atelierCol);
    roomMeshes.cyber.roofMat.color.setHex(cyberCol);
    roomMeshes.cyber.roofMat.emissive.setHex(cyberCol);
    roomMeshes.core.roofMat.color.setHex(coreCol);
    roomMeshes.core.roofMat.emissive.setHex(coreCol);
  }

  function drawLaptopScreen() {
    const { ctx, canvas, texture } = laptopScreen;
    ctx.fillStyle = '#050b14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(4, 4, canvas.width - 8, 28);
    ctx.fillStyle = '#04121f';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('CONSOLE SSH • SW-CORE-L3 (IOS 15.2)', 12, 23);

    ctx.font = '12px monospace';
    const lines = state.cliHistory.slice(-12);
    lines.forEach((line, idx) => {
      if (line.includes('ALERTE') || line.includes('ECHEC')) ctx.fillStyle = '#f87171';
      else if (line.includes('[OK]') || line.includes('neutralisée')) ctx.fillStyle = '#4ade80';
      else if (line.startsWith('SW-CORE')) ctx.fillStyle = '#38bdf8';
      else ctx.fillStyle = '#e2e8f0';
      ctx.fillText(line.slice(0, 62), 12, 52 + idx * 21);
    });
    texture.needsUpdate = true;
  }

  function setCameraById(id) {
    const cam = CAM_VIEWS.find((c) => c.id === id) || CAM_VIEWS[0];
    state.camId = cam.id;
    bench.setCameraView(cam.pos, cam.lookAt, cam.fov);
    bench.setCameras(CAM_VIEWS, cam.id, setCameraById);
  }

  function updateSidebar() {
    const ev = evaluateTopology();
    const drawer = bench.setSideDrawer(`
      <div style="display:flex;flex-direction:column;gap:8px;font-size:11px;">
        <div style="font-weight:800;color:#38bdf8;font-size:12px;">TOPOLOGIE LOGIQUE & CLI L3</div>
        <div style="padding:6px 8px;border-radius:6px;background:${
          state.stpResolved ? 'rgba(34,197,94,0.16)' : 'rgba(239,68,68,0.22)'
        };border:1px solid ${state.stpResolved ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.6)'};">
          <strong>Boucle STP (Gi0/11 ↔ Gi0/12) :</strong> ${
            state.stpResolved ? '<span style="color:#4ade80;">Corrigée</span>' : '<span style="color:#f87171;">TEMPÊTE ACTIVE</span>'
          }
          ${!state.stpResolved ? '<button data-cmd="stp fix" style="margin-top:4px;width:100%;padding:4px;border-radius:4px;border:none;background:#ef4444;color:#fff;font-weight:700;cursor:pointer;">Bloquer boucle (shut Gi0/12)</button>' : ''}
        </div>

        <div style="font-weight:700;color:#e2e8f0;">1. VLANs & Ports Access / Trunk 802.1Q</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
          <button data-act="vlan20" style="padding:5px;border-radius:5px;border:1px solid #334155;background:${state.vlans[20] ? '#14532d' : '#1e293b'};color:#fff;cursor:pointer;">VLAN 20 ATELIER (${state.vlans[20] ? 'ON' : 'OFF'})</button>
          <button data-act="vlan30" style="padding:5px;border-radius:5px;border:1px solid #334155;background:${state.vlans[30] ? '#14532d' : '#1e293b'};color:#fff;cursor:pointer;">VLAN 30 CYBER (${state.vlans[30] ? 'ON' : 'OFF'})</button>
          <button data-act="acc1" style="padding:5px;border-radius:5px;border:1px solid #334155;background:${ev.adminOk ? '#14532d' : '#1e293b'};color:#fff;cursor:pointer;">Gi0/1 → VLAN 10</button>
          <button data-act="acc2" style="padding:5px;border-radius:5px;border:1px solid #334155;background:${ev.atelierOk ? '#14532d' : '#1e293b'};color:#fff;cursor:pointer;">Gi0/2 → VLAN 20</button>
          <button data-act="acc3" style="padding:5px;border-radius:5px;border:1px solid #334155;background:${ev.cyberOk ? '#14532d' : '#1e293b'};color:#fff;cursor:pointer;">Gi0/3 → VLAN 30</button>
          <button data-act="trunk24" style="padding:5px;border-radius:5px;border:1px solid #334155;background:${ev.trunkConfigured ? '#14532d' : '#1e293b'};color:#fff;cursor:pointer;">Gi0/24 Trunk 802.1Q</button>
        </div>

        <div style="font-weight:700;color:#e2e8f0;">2. Interfaces SVI / Passerelles L3 (/24)</div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <button data-act="gw20" style="padding:5px 7px;border-radius:5px;border:1px solid #334155;background:${ev.gw20Ok ? '#14532d' : '#1e293b'};color:#fff;text-align:left;cursor:pointer;">Vlan20: ${state.gateways[20].ip} (${state.gateways[20].mask}) → <strong>Fix .20.254/24</strong></button>
          <button data-act="gw30" style="padding:5px 7px;border-radius:5px;border:1px solid #334155;background:${ev.gw30Ok ? '#14532d' : '#1e293b'};color:#fff;text-align:left;cursor:pointer;">Vlan30: ${state.gateways[30].ip} → <strong>Activer .30.254/24</strong></button>
        </div>

        <div style="font-weight:700;color:#e2e8f0;">3. Console CLI directe</div>
        <form id="cli-form" style="display:flex;gap:4px;">
          <input id="cli-input" type="text" placeholder="ex: vlan 20, ping 192.168.30.10, help" style="flex:1;padding:5px 7px;border-radius:5px;border:1px solid #334155;background:#0f172a;color:#f8fafc;font-family:monospace;font-size:11px;" />
          <button type="submit" style="padding:5px 9px;border-radius:5px;border:none;background:#0284c7;color:#fff;font-weight:700;cursor:pointer;">CLI</button>
        </form>
      </div>
    `);

    if (!drawer) return;
    drawer.querySelectorAll('[data-cmd]').forEach((b) => {
      b.addEventListener('click', () => runCliCommand(b.dataset.cmd));
    });
    const actMap = {
      vlan20: 'vlan 20',
      vlan30: 'vlan 30',
      acc1: 'access gi0/1 10',
      acc2: 'access gi0/2 20',
      acc3: 'access gi0/3 30',
      trunk24: 'trunk gi0/24 10,20,30',
      gw20: 'gw 20 192.168.20.254',
      gw30: 'gw 30 192.168.30.254'
    };
    drawer.querySelectorAll('[data-act]').forEach((b) => {
      b.addEventListener('click', () => runCliCommand(actMap[b.dataset.act]));
    });
    const form = drawer.querySelector('#cli-form');
    const inp = drawer.querySelector('#cli-input');
    if (form && inp) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        runCliCommand(inp.value);
        inp.value = '';
      });
    }
  }

  function refreshUi() {
    const ev = evaluateTopology();
    const estScore = computeVlanConfigScore3D({
      vlansCreated: ev.vlansCreated,
      trunkConfigured: ev.trunkConfigured,
      gatewaysOk: ev.gatewaysOk,
      stpResolved: state.stpResolved,
      probeRun: state.probeRunCount > 0,
      pingOk: state.lastPingOk,
      elapsedSec: (performance.now() - state.startMs) / 1000
    });

    bench.setInstruction(
      'ATELIER VLAN, STP & ROUTAGE L3 3D',
      `VLANs ${ev.vlansCreated}/3 • Passerelles ${ev.gatewaysOk}/3 • STP ${state.stpResolved ? 'OK' : 'BOUCLE'}`,
      'Résolvez la boucle Spanning-Tree rouge sur la maquette 3D, déployez les VLANs 10/20/30, le Trunk 802.1Q et les passerelles /24 puis lancez Ping & Traceroute.'
    );
    bench.setAccuracy(`Note est. ${estScore.toFixed(1)}/20`);

    bench.setTools(
      [
        { id: 'ping', icon: 'P', label: 'Ping Inter-VLAN', disabled: false },
        { id: 'trace', icon: 'T', label: 'Traceroute 3D', disabled: false }
      ],
      'ping',
      (toolId) => {
        triggerNetworkProbe(toolId === 'trace' ? 'traceroute' : 'ping');
      }
    );

    bench.setActions([
      {
        id: 'ping-btn',
        label: 'Lancer Ping 3D',
        primary: !state.lastPingOk,
        onClick: () => triggerNetworkProbe('ping')
      },
      {
        id: 'trace-btn',
        label: 'Traceroute 3D',
        primary: false,
        onClick: () => triggerNetworkProbe('traceroute')
      },
      {
        id: 'finish-btn',
        label: 'Valider Architecture',
        primary: state.lastPingOk,
        disabled: state.submitted,
        onClick: () => {
          if (state.submitted) return;
          state.submitted = true;
          const finalEv = evaluateTopology();
          const finalScore = computeVlanConfigScore3D({
            vlansCreated: finalEv.vlansCreated,
            trunkConfigured: finalEv.trunkConfigured,
            gatewaysOk: finalEv.gatewaysOk,
            stpResolved: state.stpResolved,
            probeRun: state.probeRunCount > 0,
            pingOk: state.lastPingOk,
            elapsedSec: (performance.now() - state.startMs) / 1000
          });
          const xp = Math.round(65 + finalScore * 6.5);
          if (finalScore >= 12) sfx.success();
          else sfx.error();
          api.onComplete?.({
            score: finalScore,
            xp,
            summary: `VLANs ${finalEv.vlansCreated}/3 • Trunk ${finalEv.trunkConfigured ? 'OK' : 'KO'} • STP ${state.stpResolved ? 'OK' : 'KO'} • Ping ${state.lastPingOk ? 'OK' : 'KO'}`
          });
        }
      }
    ]);

    drawLaptopScreen();
    updateSidebar();
  }

  bench.addFloatingTag([-0.56, 0.38, 0.16], 'Laptop Console CLI', 'info');
  bench.addFloatingTag([0.36, 0.25, -0.02], 'Maquette Topologique 3D', 'info');

  const unsubTick = bench.onTick((dt) => {
    for (let i = state.packets.length - 1; i >= 0; i--) {
      const pkt = state.packets[i];
      if (!pkt.segments.length) {
        campusGroup.remove(pkt.orb);
        state.packets.splice(i, 1);
        continue;
      }
      pkt.t += dt * 1.45;
      if (pkt.t >= 1) {
        if (!pkt.success && pkt.segIdx === 0) {
          bench.spawnSparks([0.36, 0.12, 0.02], { color: 0xef4444, count: 10, speed: 1.0 });
          campusGroup.remove(pkt.orb);
          state.packets.splice(i, 1);
          continue;
        }
        pkt.t = 0;
        pkt.segIdx += 1;
        if (pkt.segIdx >= pkt.segments.length) {
          campusGroup.remove(pkt.orb);
          state.packets.splice(i, 1);
          continue;
        }
      }
      const seg = pkt.segments[pkt.segIdx];
      const u = seg.reverse ? 1 - pkt.t : pkt.t;
      const pt = seg.curve.getPoint(Math.max(0, Math.min(1, u)));
      pkt.orb.position.copy(pt).add(new THREE.Vector3(0, 0.03, 0));
    }
  });

  syncTopology3D();
  setCameraById('overview');
  refreshUi();

  return {
    destroy: () => {
      unsubTick();
      bench.destroy();
    }
  };
}

export const createVlanConfigGame = createVmVlanGame;
