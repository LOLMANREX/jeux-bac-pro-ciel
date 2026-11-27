import * as THREE from 'three';
import { sfx } from '../core/audio.js';
import { toSafeNumber, finalizeGrade20, createGradeBreakdown } from '../core/grading.js';
import {
  createWorkbench3D,
  makeCanvasScreen,
  buildFlexibleCable
} from './Workbench3DHost.js';
import { createVirtualKeypad } from './TouchTpHelpers.js';

function makeCanvasTexture(width, height, drawFn) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

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

export function evaluateVlanConfigScore3D(metrics = {}) {
  const m = metrics && typeof metrics === 'object' ? metrics : {};
  const elapsed = Math.max(0, toSafeNumber(m.elapsedSec, 120));
  const timePts = elapsed <= 300 ? 0.5 : elapsed <= 480 ? 0.25 : 0;

  if (m.accessPortsOk !== undefined || m.tracerouteOk !== undefined) {
    const vlansOk = Math.max(0, Math.min(3, toSafeNumber(m.vlansCreated, 0)));
    const accOk = Math.max(0, Math.min(3, toSafeNumber(m.accessPortsOk, 0)));
    const trunkOk = Boolean(m.trunkConfigured);
    const gwOk = Math.max(0, Math.min(3, toSafeNumber(m.gatewaysOk, 0)));
    const pingOk = Boolean(m.pingOk);
    const traceOk = Boolean(m.tracerouteOk);
    const probeRun = Boolean(m.probeRun);

    const vlanPts = (vlansOk / 3) * 4.0;
    const accPts = (accOk / 3) * 4.0;
    const trunkPts = trunkOk ? 3.5 : 0;
    const gwPts = (gwOk / 3) * 4.0;
    const pingPts = pingOk ? 2.5 : probeRun ? 1.0 : 0;
    const tracePts = traceOk ? 1.5 : 0;

    const rawScore = vlanPts + accPts + trunkPts + gwPts + pingPts + tracePts + timePts;
    const hasCriticalError = vlansOk < 3 || accOk < 3 || !trunkOk || gwOk < 3 || !pingOk || !traceOk;
    const score = finalizeGrade20(rawScore, { hasCriticalError });

    const items = [
      { label: `Création VLAN 10 / 20 / 30 (${vlansOk}/3)`, earned: vlanPts, max: 4.0 },
      { label: `Ports Access Gi0/1..3 (${accOk}/3)`, earned: accPts, max: 4.0 },
      { label: 'Trunk 802.1Q sur Gi0/24', earned: trunkPts, max: 3.5 },
      { label: `Passerelles Inter-VLAN /24 (${gwOk}/3)`, earned: gwPts, max: 4.0 },
      { label: 'Test Ping 3D Inter-VLAN', earned: pingPts, max: 2.5 },
      { label: 'Test Traceroute 3D', earned: tracePts, max: 1.5 },
      { label: 'Rythme de configuration', earned: timePts, max: 0.5, detail: `${Math.round(elapsed)}s` }
    ];

    let tip = '';
    if (vlansOk < 3) tip = 'Activez les 3 VLANs (10, 20 et 30).';
    else if (accOk < 3) tip = 'Assignez Gi0/1→10, Gi0/2→20 et Gi0/3→30 en mode Access.';
    else if (!trunkOk) tip = 'Passez le port Gi0/24 en mode Trunk 802.1Q (VLANs 10,20,30).';
    else if (gwOk < 3) tip = 'Corrigez les passerelles .20.254/24 et .30.254/24.';
    else if (!pingOk || !traceOk) tip = 'Exécutez Ping 3D et Traceroute 3D pour valider le routage.';

    const breakdown = createGradeBreakdown({
      items,
      rawScore,
      finalScore: score,
      hasCriticalError,
      tip
    });

    return { score, rawScore, breakdown };
  }

  const vlansOk = Math.max(0, Math.min(3, toSafeNumber(m.vlansCreated, 0)));
  const trunkOk = Boolean(m.trunkConfigured);
  const gwOk = Math.max(0, Math.min(3, toSafeNumber(m.gatewaysOk, 0)));
  const stpOk = Boolean(m.stpResolved);
  const pingOk = Boolean(m.pingOk);
  const probeRun = Boolean(m.probeRun);

  const vlanPts = (vlansOk / 3) * 5.0;
  const trunkPts = trunkOk ? 3.5 : 0;
  const gwPts = (gwOk / 3) * 4.0;
  const stpPts = stpOk ? 4.0 : 0;
  const probePts = pingOk ? 3.0 : probeRun ? 1.0 : 0;

  const rawScore = vlanPts + trunkPts + gwPts + stpPts + probePts + timePts;
  const hasCriticalError = vlansOk < 3 || !trunkOk || gwOk < 3 || !stpOk || !pingOk;
  const score = finalizeGrade20(rawScore, { hasCriticalError });

  const breakdown = createGradeBreakdown({
    items: [
      { label: `VLANs configurés (${vlansOk}/3)`, earned: vlanPts, max: 5.0 },
      { label: 'Trunk 802.1Q', earned: trunkPts, max: 3.5 },
      { label: `Passerelles /24 (${gwOk}/3)`, earned: gwPts, max: 4.0 },
      { label: 'Convergence Spanning-Tree (STP)', earned: stpPts, max: 4.0 },
      { label: 'Diagnostic Ping 3D', earned: probePts, max: 3.0 },
      { label: 'Rythme de configuration', earned: timePts, max: 0.5, detail: `${Math.round(elapsed)}s` }
    ],
    rawScore,
    finalScore: score,
    hasCriticalError
  });

  return { score, rawScore, breakdown };
}

export function computeVlanConfigScore3D(metrics = {}) {
  return evaluateVlanConfigScore3D(metrics).score;
}

const CAM_VIEWS = [
  { id: 'overview', label: 'Vue Bureau Admin', pos: [0.02, 1.06, 1.62], lookAt: [0.02, 0.28, -0.06], fov: 41 },
  { id: 'console', label: 'PC Portable Console', pos: [-0.55, 0.54, 0.64], lookAt: [-0.55, 0.19, 0.08], fov: 35 },
  { id: 'campus', label: 'Maquette Infrastructure 3D', pos: [0.42, 0.78, 0.94], lookAt: [0.34, 0.16, 0.0], fov: 37 }
];

export function createVlanConfigGame(api) {
  const isJpo = Boolean(
    api?.isJpo || (typeof document !== 'undefined' && document.body?.classList?.contains('jpo-mode'))
  );
  const bench = createWorkbench3D(api.container, {
    cameraPos: CAM_VIEWS[0].pos,
    lookAt: CAM_VIEWS[0].lookAt,
    fov: CAM_VIEWS[0].fov,
    hasEsdMat: false,
    background: '#101c30',
    wallColor: '#15243c',
    benchColor: '#1b2940',
    benchWidth: 4.2,
    benchDepth: 2.0,
    envIntensity: 0.92
  });

  const studioKeyLight = new THREE.PointLight('#f0f9ff', 2.4, 9, 1.4);
  studioKeyLight.position.set(-1.5, 1.9, 1.4);
  bench.scene.add(studioKeyLight);

  const rackAccentLight = new THREE.PointLight('#38bdf8', 1.8, 8, 1.4);
  rackAccentLight.position.set(1.6, 1.65, -0.9);
  bench.scene.add(rackAccentLight);

  const campusBounceLight = new THREE.PointLight('#38bdf8', 1.0, 4.5, 1.5);
  campusBounceLight.position.set(0.36, 0.72, 0.22);
  bench.scene.add(campusBounceLight);

  const darkMetalMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.36, metalness: 0.68 })
  );
  const chassisSlateMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.38, metalness: 0.56 })
  );
  const brushedAluMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.26, metalness: 0.82 })
  );

  const netWallTex = bench.track(
    makeCanvasTexture(1024, 512, (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0c172a');
      grad.addColorStop(0.55, '#162844');
      grad.addColorStop(1, '#0d1729');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      for (let x = 0; x < w; x += 40) {
        ctx.fillStyle = x % 80 === 0 ? 'rgba(15, 23, 42, 0.58)' : 'rgba(30, 41, 59, 0.34)';
        ctx.fillRect(x, 0, 24, h);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.14)';
        ctx.fillRect(x + 24, 0, 2, h);
      }

      ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.fillRect(0, 44, w, 5);
      ctx.fillStyle = 'rgba(34, 197, 94, 0.16)';
      ctx.fillRect(0, h - 48, w, 5);
    })
  );
  const netBackWall = new THREE.Mesh(
    bench.track(new THREE.PlaneGeometry(5.8, 2.8)),
    bench.track(new THREE.MeshStandardMaterial({ map: netWallTex, roughness: 0.64, metalness: 0.14 }))
  );
  netBackWall.position.set(0, 1.25, -1.04);
  netBackWall.receiveShadow = true;
  bench.scene.add(netBackWall);

  const netWallBarMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0ea5e9', emissiveIntensity: 1.0 })
  );
  const netTopStrip = new THREE.Mesh(bench.track(new THREE.BoxGeometry(3.4, 0.018, 0.024)), netWallBarMat);
  netTopStrip.position.set(0, 0.86, -1.01);
  bench.scene.add(netTopStrip);
  const netBotStrip = new THREE.Mesh(bench.track(new THREE.BoxGeometry(3.4, 0.016, 0.024)), netWallBarMat);
  netBotStrip.position.set(0, 0.42, -1.01);
  bench.scene.add(netBotStrip);

  const netSignFrame = new THREE.Mesh(bench.track(new THREE.BoxGeometry(1.70, 0.25, 0.04)), darkMetalMat);
  netSignFrame.position.set(0, 0.64, -1.01);
  bench.scene.add(netSignFrame);

  const netSignScreen = makeCanvasScreen(760, 120, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, w, 0);
    bg.addColorStop(0, '#0a1324');
    bg.addColorStop(0.5, '#132a4c');
    bg.addColorStop(1, '#0a1324');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('INFRASTRUCTURE RÉSEAU • BAC PRO CIEL', w / 2, 54);

    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText('SWITCH L3 802.1Q  •  BAIE DE BRASSAGE 19"  •  ROUTAGE INTER-VLAN', w / 2, 90);
    ctx.textAlign = 'left';
  });
  bench.track(netSignScreen.texture);
  const netSignFace = new THREE.Mesh(
    bench.track(new THREE.PlaneGeometry(1.62, 0.21)),
    bench.track(new THREE.MeshBasicMaterial({ map: netSignScreen.texture }))
  );
  netSignFace.position.set(0, 0.64, -0.988);
  bench.scene.add(netSignFace);

  const deskPadTex = bench.track(
    makeCanvasTexture(1024, 512, (ctx, w, h) => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.lineWidth = 1.5;
      for (let x = 0; x <= w; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, w - 20, h - 20);

      const zones = [
        { x: 26, y: 185, zw: 340, zh: 295, color: '#38bdf8', title: 'CONSOLE SSH' },
        { x: 110, y: 26, zw: 370, zh: 145, color: '#f59e0b', title: 'BAIE 19" SW-L3' },
        { x: 495, y: 26, zw: 500, zh: 454, color: '#22c55e', title: 'MAQUETTE VLAN 802.1Q' }
      ];
      for (const z of zones) {
        ctx.strokeStyle = z.color;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(z.x, z.y, z.zw, z.zh);
        ctx.fillStyle = z.color;
        ctx.font = 'bold 16px monospace';
        ctx.fillText(z.title, z.x + 12, z.y + z.zh - 14);
      }
    })
  );
  const deskPad = new THREE.Mesh(
    bench.track(new THREE.BoxGeometry(2.12, 0.01, 1.12)),
    bench.track(new THREE.MeshStandardMaterial({ map: deskPadTex, roughness: 0.72, metalness: 0.1 }))
  );
  deskPad.position.set(0, 0.005, 0.04);
  deskPad.receiveShadow = true;
  bench.scene.add(deskPad);

  const grommetOuterGeo = bench.track(new THREE.CylinderGeometry(0.036, 0.036, 0.014, 16));
  const grommetHoleGeo = bench.track(new THREE.CylinderGeometry(0.022, 0.022, 0.016, 16));
  for (const gx of [-0.68, 0, 0.68]) {
    const grommet = new THREE.Mesh(grommetOuterGeo, brushedAluMat);
    grommet.position.set(gx, 0.009, -0.44);
    bench.scene.add(grommet);
    const hole = new THREE.Mesh(grommetHoleGeo, darkMetalMat);
    hole.position.set(gx, 0.01, -0.44);
    bench.scene.add(hole);
  }

  const state = {
    camId: 'overview',
    selectedNode: 'admin',
    vlans: {
      10: { name: 'ADMIN', active: false },
      20: { name: 'ATELIER', active: false },
      30: { name: 'INVITES', active: false }
    },
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
    cliHistory: [
      'SW-COEUR-L3# show vlan brief',
      '! Seul le VLAN 1 (default) est actif. VLANs 10/20/30 absents.',
      '! Lien Trunk 802.1Q Gi0/24 vers Pare-feu en mode ACCESS.',
      '! Passerelles Vlan20 (192.168.20.1/16) & Vlan30 (0.0.0.0) en erreur.',
      'SW-COEUR-L3#'
    ],
    probeRunCount: 0,
    lastPingOk: false,
    lastTraceOk: false,
    packets: [],
    startMs: performance.now(),
    submitted: false
  };

  function evaluateTopology() {
    const vlansCreated = [10, 20, 30].filter((v) => state.vlans[v].active).length;
    const g1 = state.ports['Gi0/1'];
    const g2 = state.ports['Gi0/2'];
    const g3 = state.ports['Gi0/3'];
    const g24 = state.ports['Gi0/24'];

    const acc1Ok = state.vlans[10].active && g1.mode === 'ACCESS' && g1.pvid === 10;
    const acc2Ok = state.vlans[20].active && g2.mode === 'ACCESS' && g2.pvid === 20;
    const acc3Ok = state.vlans[30].active && g3.mode === 'ACCESS' && g3.pvid === 30;
    const accessPortsOk = [acc1Ok, acc2Ok, acc3Ok].filter(Boolean).length;

    const trunkConfigured =
      g24.mode === 'TRUNK' && [10, 20, 30].every((v) => g24.allowed.includes(v));

    const gw10Ok = state.gateways[10].up && state.gateways[10].ip === '192.168.10.254' && state.gateways[10].mask === '255.255.255.0';
    const gw20Ok = state.gateways[20].up && state.gateways[20].ip === '192.168.20.254' && state.gateways[20].mask === '255.255.255.0';
    const gw30Ok = state.gateways[30].up && state.gateways[30].ip === '192.168.30.254' && state.gateways[30].mask === '255.255.255.0';
    const gatewaysOk = [gw10Ok, gw20Ok, gw30Ok].filter(Boolean).length;

    const fullRouteOk = vlansCreated === 3 && accessPortsOk === 3 && trunkConfigured && gatewaysOk === 3;
    return {
      vlansCreated,
      acc1Ok,
      acc2Ok,
      acc3Ok,
      accessPortsOk,
      trunkConfigured,
      gw10Ok,
      gw20Ok,
      gw30Ok,
      gatewaysOk,
      fullRouteOk
    };
  }

  const laptopGroup = new THREE.Group();
  laptopGroup.position.set(-0.56, 0.012, 0.18);
  laptopGroup.rotation.y = 0.24;
  bench.scene.add(laptopGroup);

  const laptopBase = new THREE.Mesh(
    bench.track(new THREE.BoxGeometry(0.46, 0.022, 0.32)),
    bench.track(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.36, metalness: 0.72 }))
  );
  laptopBase.position.y = 0.011;
  laptopBase.castShadow = true;
  laptopGroup.add(laptopBase);

  const kbTex = bench.track(
    makeCanvasTexture(512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0, 0, w, h);
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 14; c++) {
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(14 + c * 35, 16 + r * 44, 28, 34);
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
          ctx.strokeRect(14 + c * 35, 16 + r * 44, 28, 34);
        }
      }
    })
  );
  const keyPad = new THREE.Mesh(
    bench.track(new THREE.BoxGeometry(0.4, 0.005, 0.16)),
    bench.track(new THREE.MeshStandardMaterial({ map: kbTex, roughness: 0.55 }))
  );
  keyPad.position.set(0, 0.023, -0.01);
  laptopGroup.add(keyPad);

  const trackPad = new THREE.Mesh(
    bench.track(new THREE.BoxGeometry(0.13, 0.003, 0.075)),
    darkMetalMat
  );
  trackPad.position.set(0, 0.023, 0.105);
  laptopGroup.add(trackPad);

  const laptopLed = new THREE.Mesh(
    bench.track(new THREE.SphereGeometry(0.005, 8, 8)),
    bench.track(new THREE.MeshStandardMaterial({ color: '#22c55e', emissive: '#22c55e', emissiveIntensity: 1.4 }))
  );
  laptopLed.position.set(0.19, 0.024, 0.135);
  laptopGroup.add(laptopLed);

  const lidGroup = new THREE.Group();
  lidGroup.position.set(0, 0.022, -0.15);
  lidGroup.rotation.x = -0.32;
  laptopGroup.add(lidGroup);

  const lidShell = new THREE.Mesh(
    bench.track(new THREE.BoxGeometry(0.46, 0.3, 0.014)),
    bench.track(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.32, metalness: 0.68 }))
  );
  lidShell.position.set(0, 0.15, 0);
  lidShell.castShadow = true;
  lidGroup.add(lidShell);

  const lidTrim = new THREE.Mesh(
    bench.track(new THREE.BoxGeometry(0.47, 0.31, 0.006)),
    brushedAluMat
  );
  lidTrim.position.set(0, 0.15, -0.006);
  lidGroup.add(lidTrim);

  const laptopScreen = makeCanvasScreen(540, 336, (ctx, w, h) => {
    ctx.fillStyle = '#050b14';
    ctx.fillRect(0, 0, w, h);
  });
  bench.track(laptopScreen.texture);
  const screenMesh = new THREE.Mesh(
    bench.track(new THREE.PlaneGeometry(0.42, 0.26)),
    bench.track(new THREE.MeshBasicMaterial({ map: laptopScreen.texture }))
  );
  screenMesh.position.set(0, 0.15, 0.009);
  lidGroup.add(screenMesh);

  bench.addInteractive(laptopGroup, {
    label: 'PC Portable Console (Zoom CLI)',
    cursor: 'pointer',
    onClick: () => {
      setCameraById('console');
      sfx.click();
    }
  });

  const stackGroup = new THREE.Group();
  stackGroup.position.set(-0.34, 0.012, -0.34);
  bench.scene.add(stackGroup);

  const rackSideGeo = bench.track(new THREE.BoxGeometry(0.022, 0.31, 0.27));
  for (const sx of [-0.236, 0.236]) {
    const side = new THREE.Mesh(rackSideGeo, darkMetalMat);
    side.position.set(sx, 0.155, 0);
    side.castShadow = true;
    stackGroup.add(side);
  }
  const rackTop = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.494, 0.018, 0.27)), darkMetalMat);
  rackTop.position.set(0, 0.305, 0);
  rackTop.castShadow = true;
  stackGroup.add(rackTop);

  const rackBack = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.45, 0.295, 0.014)), chassisSlateMat);
  rackBack.position.set(0, 0.152, -0.128);
  stackGroup.add(rackBack);

  const rackRailGeo = bench.track(new THREE.BoxGeometry(0.016, 0.29, 0.016));
  for (const rx of [-0.222, 0.222]) {
    const rail = new THREE.Mesh(rackRailGeo, brushedAluMat);
    rail.position.set(rx, 0.15, 0.128);
    stackGroup.add(rail);
  }

  const l3Switch = new THREE.Mesh(
    bench.track(new THREE.BoxGeometry(0.42, 0.072, 0.24)),
    bench.track(new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.72 }))
  );
  l3Switch.position.y = 0.055;
  l3Switch.castShadow = true;
  stackGroup.add(l3Switch);

  const switchBay = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.32, 0.042, 0.01)), chassisSlateMat);
  switchBay.position.set(-0.03, 0.055, 0.118);
  stackGroup.add(switchBay);

  const consolePortRing = new THREE.Mesh(
    bench.track(new THREE.BoxGeometry(0.032, 0.028, 0.016)),
    bench.track(new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.7 }))
  );
  consolePortRing.position.set(0.165, 0.055, 0.122);
  stackGroup.add(consolePortRing);

  const switchPortLeds = [];
  const ambientRackLeds = [];
  const rj45PocketGeo = bench.track(new THREE.BoxGeometry(0.018, 0.018, 0.008));
  const portLedGeo = bench.track(new THREE.BoxGeometry(0.013, 0.008, 0.006));
  for (let p = 0; p < 12; p++) {
    const px = -0.168 + p * 0.026;
    const pocket = new THREE.Mesh(rj45PocketGeo, darkMetalMat);
    pocket.position.set(px, 0.047, 0.122);
    stackGroup.add(pocket);

    const ledMat = bench.track(
      new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 0.85 })
    );
    const portLed = new THREE.Mesh(portLedGeo, ledMat);
    portLed.position.set(px, 0.064, 0.124);
    stackGroup.add(portLed);
    switchPortLeds.push({ idx: p, mat: ledMat, pos: new THREE.Vector3(px - 0.34, 0.06, -0.216) });
    if (p >= 3 && p <= 10) {
      ambientRackLeds.push({ mat: ledMat, phase: p * 0.65 });
    }
  }

  const routerBox = new THREE.Mesh(
    bench.track(new THREE.BoxGeometry(0.42, 0.068, 0.24)),
    bench.track(new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.34, metalness: 0.72 }))
  );
  routerBox.position.y = 0.145;
  routerBox.castShadow = true;
  stackGroup.add(routerBox);

  const routerOled = new THREE.Mesh(
    bench.track(new THREE.BoxGeometry(0.12, 0.024, 0.008)),
    bench.track(new THREE.MeshStandardMaterial({ color: '#0ea5e9', emissive: '#0284c7', emissiveIntensity: 0.75 }))
  );
  routerOled.position.set(-0.12, 0.145, 0.121);
  stackGroup.add(routerOled);

  const routerLeds = [];
  const routerLedGeo = bench.track(new THREE.SphereGeometry(0.0055, 8, 8));
  for (let rp = 0; rp < 4; rp++) {
    const rx = 0.02 + rp * 0.034;
    const rPocket = new THREE.Mesh(rj45PocketGeo, darkMetalMat);
    rPocket.position.set(rx, 0.142, 0.121);
    stackGroup.add(rPocket);

    const rLedMat = bench.track(
      new THREE.MeshStandardMaterial({ color: '#f59e0b', emissive: '#d97706', emissiveIntensity: 0.8 })
    );
    const rLed = new THREE.Mesh(routerLedGeo, rLedMat);
    rLed.position.set(rx, 0.16, 0.124);
    stackGroup.add(rLed);
    routerLeds.push(rLedMat);
  }

  const patchPanelBody = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.42, 0.066, 0.22)), darkMetalMat);
  patchPanelBody.position.set(0, 0.235, -0.01);
  patchPanelBody.castShadow = true;
  stackGroup.add(patchPanelBody);

  const ppLabelTex = bench.track(
    makeCanvasTexture(512, 64, (ctx, w, h) => {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('PATCH PANEL 19" CAT6A • 01 02 03 04 ... 12', 16, 40);
    })
  );
  const ppStrip = new THREE.Mesh(
    bench.track(new THREE.PlaneGeometry(0.38, 0.02)),
    bench.track(new THREE.MeshBasicMaterial({ map: ppLabelTex }))
  );
  ppStrip.position.set(0, 0.256, 0.102);
  stackGroup.add(ppStrip);

  for (let kp = 0; kp < 12; kp++) {
    const kx = -0.168 + kp * 0.026;
    const keyJack = new THREE.Mesh(rj45PocketGeo, chassisSlateMat);
    keyJack.position.set(kx, 0.226, 0.102);
    stackGroup.add(keyJack);
  }

  const cableGuideBar = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.4, 0.008, 0.032)), brushedAluMat);
  cableGuideBar.position.set(0, 0.194, 0.125);
  stackGroup.add(cableGuideBar);

  const consoleCable = buildFlexibleCable(
    [
      [-0.36, 0.03, 0.14],
      [-0.29, 0.025, -0.01],
      [-0.22, 0.04, -0.14],
      [-0.175, 0.065, -0.216]
    ],
    '#38bdf8',
    0.007,
    '#0284c7'
  );
  bench.track(consoleCable.mesh.geometry);
  bench.track(consoleCable.mat);
  bench.scene.add(consoleCable.mesh);

  const patchCordSpecs = [
    {
      color: '#3b82f6',
      pts: [
        [-0.508, 0.238, -0.235],
        [-0.535, 0.195, -0.175],
        [-0.535, 0.115, -0.175],
        [-0.508, 0.060, -0.216]
      ]
    },
    {
      color: '#22c55e',
      pts: [
        [-0.482, 0.238, -0.235],
        [-0.505, 0.190, -0.165],
        [-0.505, 0.110, -0.165],
        [-0.482, 0.060, -0.216]
      ]
    },
    {
      color: '#a855f7',
      pts: [
        [-0.456, 0.238, -0.235],
        [-0.475, 0.185, -0.155],
        [-0.475, 0.105, -0.155],
        [-0.456, 0.060, -0.216]
      ]
    },
    {
      color: '#f59e0b',
      pts: [
        [-0.222, 0.060, -0.216],
        [-0.175, 0.085, -0.175],
        [-0.185, 0.125, -0.175],
        [-0.222, 0.154, -0.216]
      ]
    },
    {
      color: '#0ea5e9',
      pts: [
        [-0.12, 0.04, -0.35],
        [0.0, 0.018, -0.44],
        [0.18, 0.018, -0.36],
        [0.24, 0.03, -0.18]
      ]
    }
  ];
  for (const pcs of patchCordSpecs) {
    const pCurve = new THREE.CatmullRomCurve3(pcs.pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    const pMesh = new THREE.Mesh(
      bench.track(new THREE.TubeGeometry(pCurve, 22, 0.0055, 8, false)),
      bench.track(new THREE.MeshStandardMaterial({ color: pcs.color, roughness: 0.38, metalness: 0.15 }))
    );
    pMesh.castShadow = true;
    bench.scene.add(pMesh);
  }

  const campusGroup = new THREE.Group();
  campusGroup.position.set(0.36, 0.012, 0.04);
  bench.scene.add(campusGroup);

  const plinthTex = bench.track(
    makeCanvasTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#0c1526';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
      ctx.lineWidth = 2;
      for (let p = 0; p <= w; p += 32) {
        ctx.beginPath();
        ctx.moveTo(p, 0);
        ctx.lineTo(p, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, p);
        ctx.lineTo(w, p);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 4;
      ctx.strokeRect(8, 8, w - 16, h - 16);
    })
  );
  const plinth = new THREE.Mesh(
    bench.track(new THREE.BoxGeometry(0.96, 0.03, 0.78)),
    bench.track(new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.55, metalness: 0.35 }))
  );
  plinth.position.y = 0.015;
  plinth.receiveShadow = true;
  campusGroup.add(plinth);

  const plinthTop = new THREE.Mesh(
    bench.track(new THREE.PlaneGeometry(0.94, 0.76)),
    bench.track(new THREE.MeshStandardMaterial({ map: plinthTex, roughness: 0.6, metalness: 0.15 }))
  );
  plinthTop.rotation.x = -Math.PI / 2;
  plinthTop.position.y = 0.031;
  plinthTop.receiveShadow = true;
  campusGroup.add(plinthTop);

  const NODE_DEFS = [
    { id: 'core', label: 'Switch Cœur L3', pos: [0, 0.03, 0.0], size: [0.22, 0.14, 0.22], baseColor: 0x38bdf8 },
    { id: 'firewall', label: 'Pare-feu / Routeur', pos: [-0.29, 0.03, -0.22], size: [0.2, 0.15, 0.18], baseColor: 0xf43f5e },
    { id: 'admin', label: 'Postes Admin (VLAN 10)', pos: [-0.29, 0.03, 0.21], size: [0.22, 0.11, 0.18], baseColor: 0x3b82f6 },
    { id: 'atelier', label: 'Postes Atelier (VLAN 20)', pos: [0.29, 0.03, 0.21], size: [0.22, 0.11, 0.18], baseColor: 0x22c55e },
    { id: 'wifi', label: 'Bornes Wi-Fi (VLAN 30)', pos: [0.29, 0.03, -0.22], size: [0.22, 0.11, 0.18], baseColor: 0xa855f7 }
  ];

  const nodeMeshes = {};
  const campusPortLeds = { core: [], firewall: [], stations: [] };
  const campusNodeBodyMat = bench.track(
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.38, metalness: 0.52 })
  );
  const stationBodyGeo = bench.track(new THREE.BoxGeometry(0.22, 0.11, 0.18));
  const stationRoofGeo = bench.track(new THREE.BoxGeometry(0.22 * 0.86, 0.014, 0.18 * 0.86));
  const coreLedGeo = bench.track(new THREE.BoxGeometry(0.02, 0.012, 0.006));
  const fwLedGeo = bench.track(new THREE.SphereGeometry(0.009, 8, 8));
  const miniMonGeo = bench.track(new THREE.BoxGeometry(0.11, 0.07, 0.012));
  const miniMonFaceGeo = bench.track(new THREE.PlaneGeometry(0.092, 0.052));
  const wifiAntGeo = bench.track(new THREE.CylinderGeometry(0.005, 0.007, 0.07, 8));
  for (const n of NODE_DEFS) {
    const group = new THREE.Group();
    group.position.set(n.pos[0], n.pos[1], n.pos[2]);

    const isStation = n.id === 'admin' || n.id === 'atelier' || n.id === 'wifi';
    const body = new THREE.Mesh(
      isStation ? stationBodyGeo : bench.track(new THREE.BoxGeometry(n.size[0], n.size[1], n.size[2])),
      campusNodeBodyMat
    );
    body.position.y = n.size[1] / 2;
    body.castShadow = true;
    group.add(body);

    const roofMat = bench.track(
      new THREE.MeshStandardMaterial({
        color: n.baseColor,
        emissive: n.baseColor,
        emissiveIntensity: 0.45,
        roughness: 0.3
      })
    );
    const roof = new THREE.Mesh(
      isStation ? stationRoofGeo : bench.track(new THREE.BoxGeometry(n.size[0] * 0.86, 0.014, n.size[2] * 0.86)),
      roofMat
    );
    roof.position.y = n.size[1] + 0.008;
    group.add(roof);

    if (n.id === 'core') {
      const face = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.18, 0.045, 0.008)), darkMetalMat);
      face.position.set(0, 0.07, 0.112);
      group.add(face);
      for (let cl = 0; cl < 4; cl++) {
        const lMat = bench.track(
          new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0284c7', emissiveIntensity: 1.0 })
        );
        const lMesh = new THREE.Mesh(coreLedGeo, lMat);
        lMesh.position.set(-0.054 + cl * 0.036, 0.07, 0.118);
        group.add(lMesh);
        campusPortLeds.core.push(lMat);
      }
    } else if (n.id === 'firewall') {
      const fwBar = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.16, 0.02, 0.01)), brushedAluMat);
      fwBar.position.set(0, 0.09, 0.092);
      group.add(fwBar);
      for (let fl = 0; fl < 2; fl++) {
        const lMat = bench.track(
          new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 1.0 })
        );
        const lMesh = new THREE.Mesh(fwLedGeo, lMat);
        lMesh.position.set(-0.04 + fl * 0.08, 0.05, 0.094);
        group.add(lMesh);
        campusPortLeds.firewall.push(lMat);
      }
    } else if (n.id === 'admin' || n.id === 'atelier') {
      const miniMon = new THREE.Mesh(miniMonGeo, darkMetalMat);
      miniMon.position.set(-0.03, n.size[1] + 0.055, -0.02);
      miniMon.rotation.x = -0.12;
      group.add(miniMon);
      const monGlowMat = bench.track(
        new THREE.MeshStandardMaterial({ color: n.baseColor, emissive: n.baseColor, emissiveIntensity: 0.75 })
      );
      const monFace = new THREE.Mesh(miniMonFaceGeo, monGlowMat);
      monFace.position.set(-0.03, n.size[1] + 0.055, -0.012);
      monFace.rotation.x = -0.12;
      group.add(monFace);
      campusPortLeds.stations.push({ id: n.id, mat: monGlowMat });
    } else if (n.id === 'wifi') {
      const apRingMat = bench.track(
        new THREE.MeshStandardMaterial({ color: '#a855f7', emissive: '#a855f7', emissiveIntensity: 0.85 })
      );
      const apRing = new THREE.Mesh(bench.track(new THREE.TorusGeometry(0.042, 0.006, 8, 20)), apRingMat);
      apRing.rotation.x = Math.PI / 2;
      apRing.position.set(0, n.size[1] + 0.018, 0.02);
      group.add(apRing);
      campusPortLeds.stations.push({ id: 'wifi', mat: apRingMat });
      for (const ax of [-0.05, 0.05]) {
        const ant = new THREE.Mesh(wifiAntGeo, brushedAluMat);
        ant.position.set(ax, n.size[1] + 0.045, -0.04);
        group.add(ant);
      }
    }

    campusGroup.add(group);
    nodeMeshes[n.id] = { group, roofMat, def: n };

    bench.addInteractive(group, {
      label: n.label,
      cursor: 'pointer',
      onClick: () => {
        state.selectedNode = n.id;
        sfx.click();
        refreshUi();
      }
    });
  }

  function makeLinkPipe(aPos, bPos) {
    const start = new THREE.Vector3(aPos[0], 0.065, aPos[2]);
    const end = new THREE.Vector3(bPos[0], 0.065, bPos[2]);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    mid.y = 0.095;
    const curve = new THREE.CatmullRomCurve3([start, mid, end]);
    const mat = bench.track(
      new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xef4444,
        emissiveIntensity: 0.55,
        roughness: 0.3
      })
    );
    const mesh = new THREE.Mesh(bench.track(new THREE.TubeGeometry(curve, 24, 0.013, 8, false)), mat);
    campusGroup.add(mesh);
    return { mesh, mat, curve };
  }

  const pipes = {
    admin: makeLinkPipe([-0.29, 0, 0.21], [0, 0, 0.0]),
    atelier: makeLinkPipe([0.29, 0, 0.21], [0, 0, 0.0]),
    wifi: makeLinkPipe([0.29, 0, -0.22], [0, 0, 0.0]),
    trunkFw: makeLinkPipe([-0.29, 0, -0.22], [0, 0, 0.0])
  };

  const packetOrbGeo = bench.track(new THREE.SphereGeometry(0.022, 12, 12));
  const packetOkMat = bench.track(new THREE.MeshBasicMaterial({ color: 0x22c55e }));
  const packetErrMat = bench.track(new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  function spawnPacketFlow(segmentsSpec, success) {
    const orb = new THREE.Mesh(packetOrbGeo, success ? packetOkMat : packetErrMat);
    campusGroup.add(orb);
    state.packets.push({
      orb,
      segments: segmentsSpec,
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
    appendCli(`SW-COEUR-L3# ${cmd}`);

    if (lower === 'help' || lower === '?') {
      appendCli('Cmds: vlan <10|20|30>, access <gi0/1..3> <10|20|30>,');
      appendCli('      trunk gi0/24, gw <10|20|30> <ip>, ping, traceroute');
    } else if (/^vlan\s+(10|20|30)$/.test(lower)) {
      const id = Number(lower.match(/^vlan\s+(10|20|30)$/)[1]);
      state.vlans[id].active = true;
      appendCli(`VLAN ${id} (${state.vlans[id].name}) créé et actif.`);
      sfx.snap();
    } else if (/^access\s+gi0\/(1|2|3)\s+(10|20|30)$/.test(lower)) {
      const m = lower.match(/^access\s+gi0\/(1|2|3)\s+(10|20|30)$/);
      const pName = `Gi0/${m[1]}`;
      const vid = Number(m[2]);
      state.ports[pName] = { mode: 'ACCESS', pvid: vid, allowed: [] };
      appendCli(`${pName} -> switchport mode access, switchport access vlan ${vid}.`);
      sfx.snap();
    } else if (lower.includes('trunk') && (lower.includes('gi0/24') || lower.includes('802.1q'))) {
      state.ports['Gi0/24'] = { mode: 'TRUNK', pvid: 1, allowed: [10, 20, 30] };
      appendCli('Gi0/24 -> encapsulation dot1q, mode trunk (VLANs 10,20,30).');
      sfx.snap();
    } else if (/^gw\s+(10|20|30)\s+([0-9.]+)$/.test(lower)) {
      const m = lower.match(/^gw\s+(10|20|30)\s+([0-9.]+)$/);
      const vid = Number(m[1]);
      state.gateways[vid] = { ip: m[2], mask: '255.255.255.0', up: true };
      appendCli(`interface Vlan${vid}: ip address ${m[2]} 255.255.255.0 (no shut).`);
      sfx.snap();
    } else if (lower.startsWith('ping')) {
      triggerNetworkProbe('ping');
      return;
    } else if (lower.startsWith('traceroute') || lower.startsWith('tracert')) {
      triggerNetworkProbe('traceroute');
      return;
    } else if (lower.startsWith('show')) {
      const ev = evaluateTopology();
      appendCli(`VLANs:${ev.vlansCreated}/3 | Access:${ev.accessPortsOk}/3 | Trunk:${ev.trunkConfigured ? 'OK' : 'KO'} | GW:${ev.gatewaysOk}/3`);
    } else {
      appendCli('% Syntaxe invalide. Tapez "help" ou utilisez les raccourcis.');
      sfx.error();
    }
    syncTopology3D();
    refreshUi();
  }

  function triggerNetworkProbe(kind = 'ping') {
    state.probeRunCount += 1;
    const ev = evaluateTopology();

    if (ev.fullRouteOk) {
      if (kind === 'traceroute') {
        state.lastTraceOk = true;
        appendCli('traceroute 192.168.30.10 (Admin -> Pare-feu -> Wi-Fi):');
        appendCli('  1  192.168.10.254  0.6 ms  |  2  192.168.30.254  1.1 ms  [OK]');
      } else {
        state.lastPingOk = true;
        appendCli('PING 192.168.20.10: 5/5 paquets reçus (TTL=127, 0.9 ms) [OK]');
      }
      spawnPacketFlow(
        [
          { curve: pipes.admin.curve, reverse: false },
          { curve: pipes.trunkFw.curve, reverse: true },
          { curve: pipes.trunkFw.curve, reverse: false },
          { curve: pipes.atelier.curve, reverse: true }
        ],
        true
      );
      spawnPacketFlow(
        [
          { curve: pipes.admin.curve, reverse: false },
          { curve: pipes.trunkFw.curve, reverse: true },
          { curve: pipes.trunkFw.curve, reverse: false },
          { curve: pipes.wifi.curve, reverse: true }
        ],
        true
      );
      sfx.success();
    } else {
      const reason =
        ev.vlansCreated < 3
          ? 'VLANs 10/20/30 incomplets'
          : ev.accessPortsOk < 3
          ? 'Ports Access Gi0/1..3 mal assignés'
          : !ev.trunkConfigured
          ? 'Trunk 802.1Q manquant sur Gi0/24'
          : 'Passerelle /24 erronée sur Vlan20 ou Vlan30';
      appendCli(`ECHEC ${kind.toUpperCase()} -> ${reason}`);
      spawnPacketFlow([{ curve: pipes.admin.curve, reverse: false }], false);
      sfx.error();
    }
    syncTopology3D();
    refreshUi();
  }

  function syncTopology3D() {
    const ev = evaluateTopology();

    function statusHex(isOk, partial) {
      if (isOk) return 0x22c55e;
      if (partial) return 0xf59e0b;
      return 0xef4444;
    }

    const adminCol = statusHex(ev.acc1Ok && ev.gw10Ok, state.vlans[10].active);
    const atelierCol = statusHex(ev.acc2Ok && ev.gw20Ok, state.vlans[20].active);
    const wifiCol = statusHex(ev.acc3Ok && ev.gw30Ok, state.vlans[30].active);
    const trunkCol = statusHex(ev.trunkConfigured && ev.gatewaysOk === 3, ev.trunkConfigured || ev.gatewaysOk > 0);

    pipes.admin.mat.color.setHex(adminCol);
    pipes.admin.mat.emissive.setHex(adminCol);
    pipes.atelier.mat.color.setHex(atelierCol);
    pipes.atelier.mat.emissive.setHex(atelierCol);
    pipes.wifi.mat.color.setHex(wifiCol);
    pipes.wifi.mat.emissive.setHex(wifiCol);
    pipes.trunkFw.mat.color.setHex(trunkCol);
    pipes.trunkFw.mat.emissive.setHex(trunkCol);

    nodeMeshes.admin.roofMat.color.setHex(adminCol);
    nodeMeshes.admin.roofMat.emissive.setHex(adminCol);
    nodeMeshes.atelier.roofMat.color.setHex(atelierCol);
    nodeMeshes.atelier.roofMat.emissive.setHex(atelierCol);
    nodeMeshes.wifi.roofMat.color.setHex(wifiCol);
    nodeMeshes.wifi.roofMat.emissive.setHex(wifiCol);
    nodeMeshes.firewall.roofMat.color.setHex(trunkCol);
    nodeMeshes.firewall.roofMat.emissive.setHex(trunkCol);
    nodeMeshes.core.roofMat.color.setHex(ev.fullRouteOk ? 0x22c55e : 0x38bdf8);
    nodeMeshes.core.roofMat.emissive.setHex(ev.fullRouteOk ? 0x22c55e : 0x38bdf8);

    const gi1Col = statusHex(ev.acc1Ok, state.vlans[10].active || state.ports['Gi0/1'].pvid === 10);
    const gi2Col = statusHex(ev.acc2Ok, state.vlans[20].active || state.ports['Gi0/2'].pvid === 20);
    const gi3Col = statusHex(ev.acc3Ok, state.vlans[30].active || state.ports['Gi0/3'].pvid === 30);
    const gi24Col = statusHex(ev.trunkConfigured, ev.vlansCreated > 0);
    switchPortLeds.forEach((sl) => {
      let col = 0x22c55e;
      if (sl.idx === 0) col = gi1Col;
      else if (sl.idx === 1) col = gi2Col;
      else if (sl.idx === 2) col = gi3Col;
      else if (sl.idx === 11) col = gi24Col;
      else col = ev.vlansCreated > 0 ? 0x22c55e : 0xf59e0b;
      sl.mat.color.setHex(col);
      sl.mat.emissive.setHex(col);
    });

    routerLeds.forEach((rl, i) => {
      const gwOk = i === 0 ? ev.gw10Ok : i === 1 ? ev.gw20Ok : i === 2 ? ev.gw30Ok : ev.trunkConfigured;
      const c = gwOk ? 0x22c55e : 0xf59e0b;
      rl.color.setHex(c);
      rl.emissive.setHex(c);
    });

    if (campusPortLeds.core.length >= 4) {
      [gi1Col, gi2Col, gi3Col, gi24Col].forEach((c, idx) => {
        campusPortLeds.core[idx].color.setHex(c);
        campusPortLeds.core[idx].emissive.setHex(c);
      });
    }
    campusPortLeds.firewall.forEach((fm) => {
      fm.color.setHex(trunkCol);
      fm.emissive.setHex(trunkCol);
    });
    campusPortLeds.stations.forEach((st) => {
      const c = st.id === 'admin' ? adminCol : st.id === 'atelier' ? atelierCol : wifiCol;
      st.mat.color.setHex(c);
      st.mat.emissive.setHex(c);
    });

    campusBounceLight.color.setHex(ev.fullRouteOk ? 0x22c55e : 0x38bdf8);
    netWallBarMat.color.setHex(ev.fullRouteOk ? 0x22c55e : 0x38bdf8);
    netWallBarMat.emissive.setHex(ev.fullRouteOk ? 0x16a34a : 0x0ea5e9);
  }

  let lastCliSig = '';
  let lastLaptopDrawMs = -Infinity;
  let laptopScreenDirty = false;
  function drawLaptopScreen(force = false) {
    const cliSig = state.cliHistory.join('\n');
    if (cliSig === lastCliSig && !laptopScreenDirty) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!force && now - lastLaptopDrawMs < 84) {
      laptopScreenDirty = true;
      return;
    }
    lastCliSig = cliSig;
    laptopScreenDirty = false;
    lastLaptopDrawMs = now;
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
    ctx.fillText('TERMINAL CONSOLE • SW-COEUR-L3 (9600 BAUD)', 12, 23);

    ctx.font = '12px monospace';
    const lines = state.cliHistory.slice(-13);
    lines.forEach((line, idx) => {
      if (line.includes('ECHEC') || line.includes('erreur')) ctx.fillStyle = '#f87171';
      else if (line.includes('[OK]') || line.includes('actif') || line.includes('dot1q')) ctx.fillStyle = '#4ade80';
      else if (line.startsWith('SW-COEUR')) ctx.fillStyle = '#38bdf8';
      else ctx.fillStyle = '#e2e8f0';
      ctx.fillText(line.slice(0, 65), 12, 52 + idx * 21);
    });
    texture.needsUpdate = true;
  }

  function setCameraById(id) {
    const cam = CAM_VIEWS.find((c) => c.id === id) || CAM_VIEWS[0];
    state.camId = cam.id;
    bench.setCameraView(cam.pos, cam.lookAt, cam.fov);
    bench.setCameras(CAM_VIEWS, cam.id, setCameraById);
  }

  let keypadCleanup = null;
  let keypadExpanded =
    typeof document !== 'undefined' && Boolean(document.body?.classList?.contains('touch-active'));

  bench.setInspectableView?.({
    title: 'Terminal Console SW-COEUR-L3',
    subtitle: 'Affichage agrandi CLI IOS & diagnostic VLAN',
    label: '🔎 Zoom Console',
    canvas: laptopScreen.canvas
  });

  function updateSidebar() {
    keypadCleanup?.();
    keypadCleanup = null;
    const ev = evaluateTopology();
    const recentCli = state.cliHistory.slice(-4);
    const drawer = bench.setSideDrawer(
      isJpo
        ? `
      <div style="display:flex;flex-direction:column;gap:10px;background:rgba(15,23,42,0.94);color:#f8fafc;padding:12px;border-radius:12px;border:1px solid #334155;">
        <div style="font-weight:800;color:#38bdf8;">1. SÉPARER LES RÉSEAUX (${ev.vlansCreated}/3)</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
          <button type="button" class="tp-connect-btn ${state.vlans[10].active ? 'done' : ''}" data-cmd="vlan 10" data-active="${state.vlans[10].active ? '1' : '0'}" style="justify-content:center;padding:8px 4px;">Profs</button>
          <button type="button" class="tp-connect-btn ${state.vlans[20].active ? 'done' : ''}" data-cmd="vlan 20" data-active="${state.vlans[20].active ? '1' : '0'}" style="justify-content:center;padding:8px 4px;">Élèves</button>
          <button type="button" class="tp-connect-btn ${state.vlans[30].active ? 'done' : ''}" data-cmd="vlan 30" data-active="${state.vlans[30].active ? '1' : '0'}" style="justify-content:center;padding:8px 4px;">Wi-Fi</button>
        </div>

        <div style="font-weight:800;color:#22c55e;">2. BRANCHER LES SALLES (${ev.accessPortsOk}/3)</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
          <button type="button" class="tp-connect-btn ${ev.acc1Ok ? 'done' : ''}" data-cmd="access gi0/1 10" data-active="${ev.acc1Ok ? '1' : '0'}">Relier Profs</button>
          <button type="button" class="tp-connect-btn ${ev.acc2Ok ? 'done' : ''}" data-cmd="access gi0/2 20" data-active="${ev.acc2Ok ? '1' : '0'}">Relier Élèves</button>
          <button type="button" class="tp-connect-btn ${ev.acc3Ok ? 'done' : ''}" data-cmd="access gi0/3 30" data-active="${ev.acc3Ok ? '1' : '0'}">Relier Wi-Fi</button>
          <button type="button" class="tp-connect-btn ${ev.trunkConfigured ? 'done' : ''}" data-cmd="trunk gi0/24" data-active="${ev.trunkConfigured ? '1' : '0'}">Lien Internet</button>
        </div>

        <div style="font-weight:800;color:#f59e0b;">3. RÉTABLIR INTERNET (${ev.gatewaysOk}/3)</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button type="button" class="tp-connect-btn ${ev.gw20Ok ? 'done' : ''}" data-cmd="gw 20 192.168.20.254" data-active="${ev.gw20Ok ? '1' : '0'}">${ev.gw20Ok ? '✅ Internet Élèves actif' : '🌐 Activer Internet Élèves'}</button>
          <button type="button" class="tp-connect-btn ${ev.gw30Ok ? 'done' : ''}" data-cmd="gw 30 192.168.30.254" data-active="${ev.gw30Ok ? '1' : '0'}">${ev.gw30Ok ? '✅ Internet Wi-Fi actif' : '📶 Activer Internet Wi-Fi'}</button>
        </div>
      </div>
    `
        : `
      <div style="display:flex;flex-direction:column;gap:8px;font-size:12px;background:rgba(15,23,42,0.92);color:#f8fafc;padding:9px 10px;border-radius:10px;border:1px solid #334155;">
        <div style="font-weight:800;color:#38bdf8;font-size:12px;">1. SEGMENTATION VLAN (${ev.vlansCreated}/3)</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
          <button type="button" class="tp-connect-btn ${state.vlans[10].active ? 'done' : ''}" data-cmd="vlan 10" data-active="${state.vlans[10].active ? '1' : '0'}" style="justify-content:center;padding:8px 4px;">VLAN 10</button>
          <button type="button" class="tp-connect-btn ${state.vlans[20].active ? 'done' : ''}" data-cmd="vlan 20" data-active="${state.vlans[20].active ? '1' : '0'}" style="justify-content:center;padding:8px 4px;">VLAN 20</button>
          <button type="button" class="tp-connect-btn ${state.vlans[30].active ? 'done' : ''}" data-cmd="vlan 30" data-active="${state.vlans[30].active ? '1' : '0'}" style="justify-content:center;padding:8px 4px;">VLAN 30</button>
        </div>

        <div style="font-weight:800;color:#22c55e;font-size:12px;">2. PORTS ACCESS (${ev.accessPortsOk}/3) & TRUNK 802.1Q</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
          <button type="button" class="tp-connect-btn ${ev.acc1Ok ? 'done' : ''}" data-cmd="access gi0/1 10" data-active="${ev.acc1Ok ? '1' : '0'}">Gi0/1 → VLAN 10</button>
          <button type="button" class="tp-connect-btn ${ev.acc2Ok ? 'done' : ''}" data-cmd="access gi0/2 20" data-active="${ev.acc2Ok ? '1' : '0'}">Gi0/2 → VLAN 20</button>
          <button type="button" class="tp-connect-btn ${ev.acc3Ok ? 'done' : ''}" data-cmd="access gi0/3 30" data-active="${ev.acc3Ok ? '1' : '0'}">Gi0/3 → VLAN 30</button>
          <button type="button" class="tp-connect-btn ${ev.trunkConfigured ? 'done' : ''}" data-cmd="trunk gi0/24" data-active="${ev.trunkConfigured ? '1' : '0'}">Gi0/24 Trunk</button>
        </div>

        <div style="font-weight:800;color:#f59e0b;font-size:12px;">3. PASSERELLES INTER-VLAN (/24)</div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <button type="button" class="tp-connect-btn ${ev.gw20Ok ? 'done' : ''}" data-cmd="gw 20 192.168.20.254" data-active="${ev.gw20Ok ? '1' : '0'}">Vlan20: ${state.gateways[20].ip} → <strong>.20.254/24</strong></button>
          <button type="button" class="tp-connect-btn ${ev.gw30Ok ? 'done' : ''}" data-cmd="gw 30 192.168.30.254" data-active="${ev.gw30Ok ? '1' : '0'}">Vlan30: ${state.gateways[30].ip} → <strong>.30.254/24</strong></button>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
          <span style="font-weight:800;color:#e2e8f0;font-size:12px;">TERMINAL CLI</span>
          <button type="button" id="vlan-keypad-toggle" class="av-mini-btn">${keypadExpanded ? 'Masquer pavé' : '⌨️ Pavé IP/CLI'}</button>
        </div>
        <div style="background:#020617;border:1px solid #1e293b;border-radius:6px;padding:6px 8px;font-family:monospace;font-size:10px;color:#cbd5e1;line-height:1.35;">
          ${recentCli.map((ln) => `<div>${ln}</div>`).join('')}
        </div>
        <form id="cli-form" style="display:flex;gap:6px;">
          <input id="cli-input" type="text" placeholder="ex: vlan 10, gw 20 192.168.20.254" style="flex:1;min-height:44px;padding:6px 8px;border-radius:6px;border:1px solid #334155;background:#0f172a;color:#f8fafc;font-family:monospace;font-size:12px;" />
          <button type="submit" style="min-width:52px;min-height:44px;padding:6px 10px;border-radius:6px;border:none;background:#0284c7;color:#fff;font-weight:700;cursor:pointer;">CLI</button>
        </form>
        <div id="vlan-keypad-mount"></div>
      </div>
    `
    );

    if (!drawer) return;
    drawer.querySelectorAll('[data-cmd]').forEach((b) => {
      b.addEventListener('click', () => runCliCommand(b.dataset.cmd));
    });
    const form = drawer.querySelector('#cli-form');
    const inp = drawer.querySelector('#cli-input');
    const toggleBtn = drawer.querySelector('#vlan-keypad-toggle');
    const mount = drawer.querySelector('#vlan-keypad-mount');
    toggleBtn?.addEventListener('click', () => {
      keypadExpanded = !keypadExpanded;
      updateSidebar();
    });
    if (form && inp) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        runCliCommand(inp.value);
        inp.value = '';
      });
      if (keypadExpanded && mount) {
        const kp = createVirtualKeypad({
          mode: 'ip-cli',
          targetInput: inp,
          presets: [
            'vlan 10',
            'vlan 20',
            'vlan 30',
            'trunk gi0/24',
            'gw 20 192.168.20.254',
            'gw 30 192.168.30.254',
            'ping'
          ],
          onSubmit: (cmd) => {
            runCliCommand(cmd);
            inp.value = '';
          }
        });
        mount.appendChild(kp.element);
        keypadCleanup = () => kp.destroy();
      }
    }
  }

  function refreshUi() {
    const ev = evaluateTopology();
    const estScore = computeVlanConfigScore3D({
      vlansCreated: ev.vlansCreated,
      accessPortsOk: ev.accessPortsOk,
      trunkConfigured: ev.trunkConfigured,
      gatewaysOk: ev.gatewaysOk,
      probeRun: state.probeRunCount > 0,
      pingOk: state.lastPingOk,
      tracerouteOk: state.lastTraceOk,
      elapsedSec: (performance.now() - state.startMs) / 1000
    });

    const stageIdx = ev.vlansCreated < 3
      ? 0
      : ev.accessPortsOk < 3 || !ev.trunkConfigured
      ? 1
      : 2;
    api.setStages(
      isJpo
        ? [
            { name: `1. Séparer les réseaux (${ev.vlansCreated}/3)` },
            { name: '2. Brancher les salles' },
            { name: '3. Tout passer au vert' }
          ]
        : [
            { name: `1. VLANs (${ev.vlansCreated}/3)` },
            { name: `2. Ports & Trunk 802.1Q` },
            { name: `3. Passerelles & Ping` }
          ],
      stageIdx,
      (idx) => {
        if (idx === 0) setCameraById('console');
        else if (idx === 1) setCameraById('overview');
        else setCameraById('campus');
      }
    );

    if (isJpo) {
      if (ev.vlansCreated < 3) {
        bench.setInstruction(
          'ÉTAPE 1 / 3',
          `Sépare les réseaux du lycée : Profs, Élèves et Wi-Fi (${ev.vlansCreated}/3)`,
          'Clique sur les 3 boutons « Profs », « Élèves » et « Wi-Fi » en haut du panneau à droite.'
        );
      } else if (ev.accessPortsOk < 3 || !ev.trunkConfigured) {
        bench.setInstruction(
          'ÉTAPE 2 / 3',
          'Branche chaque salle et le lien principal Internet',
          'Clique sur les 4 boutons de branchement dans la section 2 à droite.'
        );
      } else if (ev.gatewaysOk < 3) {
        bench.setInstruction(
          'ÉTAPE 3 / 3',
          'Rétablis l’accès Internet pour les salles Élèves et Wi-Fi',
          'Clique sur « Activer Internet Élèves » et « Activer Internet Wi-Fi » à droite.'
        );
      } else if (!state.lastPingOk || !state.lastTraceOk) {
        bench.setInstruction(
          'PRESQUE FINI !',
          'Teste la connexion pour faire passer tous les câbles au vert !',
          'Clique sur « Tester la connexion » puis « Vérifier le parcours » en bas.'
        );
      } else {
        bench.setInstruction(
          'MISSION RÉUSSIE !',
          'Tout est au vert : les ordinateurs du lycée ont retrouvé Internet !',
          'Clique sur « Terminer la mission » en bas à droite.'
        );
      }
      bench.setAccuracy(`Progression : ${Math.round((estScore / 20) * 100)} %`);
    } else {
      bench.setInstruction(
        'ATELIER CONFIGURATION VLAN 802.1Q, TRUNK & ROUTAGE 3D',
        `VLANs ${ev.vlansCreated}/3 • Access ${ev.accessPortsOk}/3 • Trunk ${ev.trunkConfigured ? '802.1Q OK' : 'NON'} • GW ${ev.gatewaysOk}/3`,
        '1) Créez VLAN 10/20/30  2) Assignez les ports Access + Trunk 802.1Q Gi0/24  3) Corrigez .20.254 & .30.254 puis lancez Ping & Traceroute.'
      );
      bench.setAccuracy(`Note est. ${estScore.toFixed(1)}/20`);
    }

    bench.setTools(
      isJpo
        ? [
            { id: 'ping', icon: '📡', label: 'Tester la connexion', disabled: false },
            { id: 'trace', icon: '🛣️', label: 'Vérifier le parcours', disabled: false }
          ]
        : [
            { id: 'ping', icon: 'P', label: 'Test Ping 3D', disabled: false },
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
        label: isJpo ? '📡 Tester la connexion' : 'Lancer Ping 3D',
        primary: !state.lastPingOk,
        onClick: () => triggerNetworkProbe('ping')
      },
      {
        id: 'trace-btn',
        label: isJpo ? '🛣️ Vérifier le parcours' : 'Traceroute 3D',
        primary: state.lastPingOk && !state.lastTraceOk,
        onClick: () => triggerNetworkProbe('traceroute')
      },
      {
        id: 'finish-btn',
        label: isJpo ? '✅ Terminer la mission' : 'Valider Configuration',
        primary: state.lastPingOk && state.lastTraceOk,
        disabled: state.submitted,
        onClick: () => {
          if (state.submitted) return;
          state.submitted = true;
          const finalEv = evaluateTopology();
          const evalRes = evaluateVlanConfigScore3D({
            vlansCreated: finalEv.vlansCreated,
            accessPortsOk: finalEv.accessPortsOk,
            trunkConfigured: finalEv.trunkConfigured,
            gatewaysOk: finalEv.gatewaysOk,
            probeRun: state.probeRunCount > 0,
            pingOk: state.lastPingOk,
            tracerouteOk: state.lastTraceOk,
            elapsedSec: (performance.now() - state.startMs) / 1000
          });
          if (evalRes.score >= 10) sfx.success();
          else sfx.error();
          api.finishTp(
            evalRes.score,
            `
              <p>Atelier Configuration VLAN 802.1Q & Routage évalué :</p>
              <ul>
                <li>Création VLAN 10 / 20 / 30 : <strong>${finalEv.vlansCreated}/3 actifs</strong></li>
                <li>Ports Access & Trunk 802.1Q : <strong>${finalEv.accessPortsOk}/3 ports Access • Trunk Gi0/24 ${finalEv.trunkConfigured ? 'OK ✔' : 'Incomplet'}</strong></li>
                <li>Routage Inter-VLAN & Diagnostic : <strong>${finalEv.gatewaysOk}/3 passerelles /24 • Ping ${state.lastPingOk ? 'OK ✔' : 'KO'} • Traceroute ${state.lastTraceOk ? 'OK ✔' : 'KO'}</strong></li>
              </ul>
            `,
            evalRes.breakdown
          );
        }
      },
      {
        id: 'hint-vlan-btn',
        label: isJpo ? '💡 Astuce' : '💡 Indice',
        onClick: () => {
          bench.showToast(
            isJpo
              ? '1) Clique sur Profs, Élèves, Wi-Fi  2) Branche les 4 boutons  3) Active Internet Élèves et Wi-Fi  4) Teste la connexion !'
              : 'Activez VLAN 10/20/30, assignez Gi0/1→10, Gi0/2→20, Gi0/3→30, Gi0/24 en Trunk, corrigez .20.254 et .30.254 puis Ping + Traceroute !',
            'info'
          );
        }
      },
      {
        id: 'reset-vlan-btn',
        label: isJpo ? '🔄 Recommencer' : '🔄 Réinitialiser',
        onClick: () => {
          state.vlans = {
            10: { name: 'ADMIN', active: false },
            20: { name: 'ATELIER', active: false },
            30: { name: 'INVITES', active: false }
          };
          state.ports = {
            'Gi0/1': { mode: 'ACCESS', pvid: 1, allowed: [] },
            'Gi0/2': { mode: 'ACCESS', pvid: 1, allowed: [] },
            'Gi0/3': { mode: 'ACCESS', pvid: 1, allowed: [] },
            'Gi0/24': { mode: 'ACCESS', pvid: 1, allowed: [] }
          };
          state.gateways = {
            10: { ip: '192.168.10.254', mask: '255.255.255.0', up: true },
            20: { ip: '192.168.20.1', mask: '255.255.0.0', up: false },
            30: { ip: '0.0.0.0', mask: '255.255.255.0', up: false }
          };
          state.cliHistory = [
            'SW-COEUR-L3# show vlan brief',
            '! Réinitialisation effectuée. VLANs 10/20/30 inactifs.',
            'SW-COEUR-L3#'
          ];
          state.probeRunCount = 0;
          state.lastPingOk = false;
          state.lastTraceOk = false;
          state.submitted = false;
          syncTopology3D();
          sfx.click();
          bench.showToast('Configuration switch VLAN réinitialisée.', 'info');
          refreshUi();
        }
      }
    ]);

    drawLaptopScreen();
    updateSidebar();
    bench.setVrExtras?.({
      terminalLines: state.cliHistory.slice(-3),
      cliPresets: [
        { label: 'vlan 10 / 20 / 30', cmd: 'vlan ', submit: false },
        { label: 'trunk gi0/24', cmd: 'trunk gi0/24', submit: true },
        { label: 'gw 20 .20.254', cmd: 'gw 20 192.168.20.254', submit: true },
        { label: 'gw 30 .30.254', cmd: 'gw 30 192.168.30.254', submit: true },
        { label: 'ping / trace', cmd: 'ping', submit: true }
      ],
      statusLines: [
        `VLANs: ${ev.vlansCreated}/3 | Access: ${ev.accessPortsOk}/3 | Trunk: ${ev.trunkConfigured ? 'OK' : 'Non'} | GW: ${ev.gatewaysOk}/3`
      ]
    });
  }

  bench.addFloatingTag([-0.56, 0.38, 0.18], 'PC Portable Console SSH', 'info');
  bench.addFloatingTag([-0.34, 0.34, -0.34], 'Baie 19" • Switch L3', 'info');
  bench.addFloatingTag([0.36, 0.25, 0.0], 'Maquette Infra 3D', 'info');

  const _pktOffset = new THREE.Vector3(0, 0.03, 0);
  const unsubTick = bench.addUpdate((dt, elapsed) => {
    if (laptopScreenDirty) {
      drawLaptopScreen(false);
    }
    ambientRackLeds.forEach((al) => {
      al.mat.emissiveIntensity = 0.4 + 0.75 * Math.abs(Math.sin(elapsed * 3.8 + al.phase));
    });
    for (let i = state.packets.length - 1; i >= 0; i--) {
      const pkt = state.packets[i];
      if (!pkt.segments.length) {
        campusGroup.remove(pkt.orb);
        state.packets.splice(i, 1);
        continue;
      }
      pkt.t += dt * 1.5;
      if (pkt.t >= 1) {
        if (!pkt.success && pkt.segIdx === 0) {
          bench.spawnSparks([0.36, 0.12, 0.0], { color: 0xef4444, count: 10, speed: 1.0 });
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
      pkt.orb.position.copy(pt).add(_pktOffset);
    }
  });

  bench.freezeStatic([]);
  syncTopology3D();
  setCameraById('overview');
  refreshUi();

  return {
    destroy: () => {
      keypadCleanup?.();
      keypadCleanup = null;
      for (const pkt of state.packets) {
        campusGroup.remove(pkt.orb);
      }
      state.packets.length = 0;
      unsubTick();
      bench.destroy();
    }
  };
}

export const createVmVlanGame = createVlanConfigGame;
