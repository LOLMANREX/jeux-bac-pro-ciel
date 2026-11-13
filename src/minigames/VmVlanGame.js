import { createRackVlanWorkshop3D } from './PatchRackGame.js';

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

export function createVmVlanGame(api) {
  return createRackVlanWorkshop3D(api, { initialMode: 'vlan' });
}
