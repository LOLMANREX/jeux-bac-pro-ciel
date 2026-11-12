import { sfx } from '../core/audio.js';

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
      { port: 'Gi0/2', desc: 'Trunk Switch Accès B12', expectedMode: 'TRUNK', expectedVlans: [10, 20, 30] },
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

  // 1. Host resource budget
  const usedCpu = cfg.vms.reduce((s, v) => s + Number(v.cpu || 0), 0);
  const usedRam = cfg.vms.reduce((s, v) => s + Number(v.ram || 0), 0);
  const usedDisk = cfg.vms.reduce((s, v) => s + Number(v.disk || 0), 0);
  if (usedCpu > stage.hostLimits.cpu) errors.push(`Surcharge vCPU (${usedCpu}/${stage.hostLimits.cpu}).`);
  if (usedRam > stage.hostLimits.ram) errors.push(`Surcharge RAM (${usedRam}/${stage.hostLimits.ram} Go).`);
  if (usedDisk > stage.hostLimits.disk) errors.push(`Surcharge Disque (${usedDisk}/${stage.hostLimits.disk} Go).`);

  // 2. VMs presence, resources, VLAN & running
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

  // 3. VLAN definitions
  for (const rv of stage.requiredVlans) {
    const v = cfg.vlans.find((x) => Number(x.id) === rv.id);
    if (!v || !v.enabled) {
      errors.push(`VLAN ${rv.id} (${rv.name}) absent ou inactif sur le switch.`);
    }
  }

  // 4. Switch ports Access / Trunk 802.1Q
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

  // 5. Router Inter-VLAN & Gateways
  for (const rv of stage.requiredVlans) {
    const gwObj = cfg.gateways[rv.id];
    if (!gwObj || !gwObj.enabled || gwObj.ip.trim() !== rv.gw) {
      errors.push(`Sous-interface Routeur VLAN ${rv.id} : activez et réglez la passerelle ${rv.gw}.`);
    }
  }

  // 6. Explicit required ACLs
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

  // 7. End-to-end Ping simulations
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
  let stageIdx = 0;
  const stageScores = [0, 0, 0];
  let activeTab = 'vms'; // 'vms' | 'vlans' | 'router' | 'cli'
  let cfg = null;
  let simPacketPhase = 0;
  let animId = null;
  let lastEval = null;

  function loadStage(idx) {
    stageIdx = idx;
    const st = VMVLAN_STAGES[idx];
    lastEval = null;
    cfg = {
      vms: st.requiredVms.map((r, i) => ({
        role: r.role,
        name: r.role,
        os: r.os,
        cpu: 1,
        ram: 2,
        disk: 20,
        vlan: i === 0 ? 10 : 1, // deliberately misconfigured VLAN 1 initially
        started: false
      })),
      vlans: st.requiredVlans.map((rv, i) => ({
        id: rv.id,
        name: rv.name,
        subnet: rv.subnet,
        enabled: i === 0 // only VLAN 10 enabled initially
      })),
      ports: st.portsSpec.map((ps) => ({
        port: ps.port,
        desc: ps.desc,
        mode: 'ACCESS',
        pvid: 1,
        allowedVlans: '10'
      })),
      gateways: Object.fromEntries(
        st.requiredVlans.map((rv) => [rv.id, { enabled: false, ip: rv.gw }])
      ),
      acls:
        st.requiredAcls.length > 0
          ? [{ src: 20, dst: 10, action: 'ALLOW' }, { src: 20, dst: 30, action: 'ALLOW' }]
          : []
    };
  }

  function render() {
    const st = VMVLAN_STAGES[stageIdx];
    api.setStages(
      VMVLAN_STAGES.map((s, i) => (stageScores[i] > 0 ? `✅ ${s.name}` : s.name)),
      stageIdx,
      (idx) => {
        loadStage(idx);
        render();
      }
    );

    const usedCpu = cfg.vms.reduce((s, v) => s + Number(v.cpu), 0);
    const usedRam = cfg.vms.reduce((s, v) => s + Number(v.ram), 0);
    const usedDisk = cfg.vms.reduce((s, v) => s + Number(v.disk), 0);

    api.container.innerHTML = `
      <div class="mg-brief">${st.brief}</div>
      <div class="vmvlan-layout">
        <div class="vmvlan-topo-col">
          <div class="panel-box">
            <h4>🗺️ Topologie Temps Réel &amp; Flux 802.1Q</h4>
            <canvas id="topo-canvas" width="520" height="260"></canvas>
            <div class="host-bars">
              <div class="hbar">
                <span>vCPU: <strong>${usedCpu}/${st.hostLimits.cpu}</strong></span>
                <div class="progress-track"><div class="progress-fill ${usedCpu > st.hostLimits.cpu ? 'over' : ''}" style="width:${Math.min(100, (usedCpu / st.hostLimits.cpu) * 100)}%"></div></div>
              </div>
              <div class="hbar">
                <span>RAM: <strong>${usedRam}/${st.hostLimits.ram} Go</strong></span>
                <div class="progress-track"><div class="progress-fill ${usedRam > st.hostLimits.ram ? 'over' : ''}" style="width:${Math.min(100, (usedRam / st.hostLimits.ram) * 100)}%"></div></div>
              </div>
              <div class="hbar">
                <span>SSD: <strong>${usedDisk}/${st.hostLimits.disk} Go</strong></span>
                <div class="progress-track"><div class="progress-fill ${usedDisk > st.hostLimits.disk ? 'over' : ''}" style="width:${Math.min(100, (usedDisk / st.hostLimits.disk) * 100)}%"></div></div>
              </div>
            </div>
          </div>

          <div class="panel-box">
            <h4>🧪 Tests Réseau &amp; Diagnostic</h4>
            <div id="vmvlan-ping-box" class="ping-box">
              ${
                lastEval
                  ? lastEval.pingResults
                      .map(
                        (r) => `<div class="ping-line ${r.passed ? 'ok' : 'fail'}">
                          ${r.passed ? '✅' : '❌'} ${r.from} ➔ ${r.to} :
                          <strong>${r.actualReachable ? 'PING OK' : r.blockedByAcl ? 'BLOQUÉ (ACL)' : 'ÉCHEC'}</strong>
                        </div>`
                      )
                      .join('')
                  : '<div class="hint-mini">Configurez Hyperviseur, Switch 802.1Q et Routeur puis lancez le test !</div>'
              }
            </div>
            <div id="vmvlan-feedback" class="mg-feedback ${lastEval ? (lastEval.passed ? 'pass' : 'fail') : 'hidden'}">
              ${lastEval && !lastEval.passed ? lastEval.errors.map((e) => `<div>• ${e}</div>`).join('') : lastEval?.passed ? '✅ Infrastructure VM & VLAN 100% opérationnelle !' : ''}
            </div>
            <div class="panel-actions">
              <button type="button" id="vmvlan-test-btn" class="btn-primary">▶ Simuler Ping &amp; Valider</button>
            </div>
          </div>
        </div>

        <div class="vmvlan-cfg-col">
          <div class="os-tabs">
            <button type="button" class="os-tab ${activeTab === 'vms' ? 'active' : ''}" data-tab="vms">🖥️ Hyperviseur VMs</button>
            <button type="button" class="os-tab ${activeTab === 'vlans' ? 'active' : ''}" data-tab="vlans">🔀 Switch &amp; VLAN 802.1Q</button>
            <button type="button" class="os-tab ${activeTab === 'router' ? 'active' : ''}" data-tab="router">🛡️ Routeur &amp; ACL</button>
            <button type="button" class="os-tab ${activeTab === 'cli' ? 'active' : ''}" data-tab="cli">💻 Config CLI</button>
          </div>
          <div id="vmvlan-tab-body" class="panel-box vmvlan-tab-body"></div>
        </div>
      </div>
    `;

    renderConfigTab(st);
    bindMainEvents(st);
  }

  function renderConfigTab(st) {
    const body = document.getElementById('vmvlan-tab-body');
    if (!body) return;

    if (activeTab === 'vms') {
      body.innerHTML = `
        <p class="hint-mini">Allouez les ressources de chaque VM selon le cahier des charges, attachez le bon VLAN sur la carte réseau virtuelle (<code>vNIC</code>) et démarrez la VM.</p>
        <div class="vm-cards">
          ${cfg.vms
            .map((vm, i) => {
              const req = st.requiredVms[i];
              return `
              <div class="vm-card">
                <div class="vm-head">
                  <strong>${vm.name}</strong> <span class="badge-os">${vm.os}</span>
                  <span class="req-hint">Min: ${req.minCpu}vCPU / ${req.minRam}Go / ${req.minDisk}Go • VLAN ${req.vlan}</span>
                </div>
                <div class="vm-controls">
                  <label>vCPU <input type="number" min="1" max="8" class="vm-cpu" data-i="${i}" value="${vm.cpu}" /></label>
                  <label>RAM (Go) <input type="number" min="1" max="16" class="vm-ram" data-i="${i}" value="${vm.ram}" /></label>
                  <label>SSD (Go) <input type="number" min="10" max="200" step="10" class="vm-disk" data-i="${i}" value="${vm.disk}" /></label>
                  <label>vNIC VLAN
                    <select class="vm-vlan" data-i="${i}">
                      <option value="1" ${vm.vlan === 1 ? 'selected' : ''}>VLAN 1 (Défaut)</option>
                      ${st.requiredVlans.map((rv) => `<option value="${rv.id}" ${vm.vlan === rv.id ? 'selected' : ''}>VLAN ${rv.id} (${rv.name})</option>`).join('')}
                    </select>
                  </label>
                  <button type="button" class="btn-sm ${vm.started ? 'btn-primary' : 'btn-hud'} vm-start-btn" data-i="${i}">
                    ${vm.started ? '🟢 Démarrée' : '▶ Démarrer'}
                  </button>
                </div>
              </div>`;
            })
            .join('')}
        </div>
      `;

      body.querySelectorAll('.vm-cpu').forEach((el) =>
        el.addEventListener('change', (e) => {
          cfg.vms[Number(e.target.dataset.i)].cpu = Number(e.target.value);
          render();
        })
      );
      body.querySelectorAll('.vm-ram').forEach((el) =>
        el.addEventListener('change', (e) => {
          cfg.vms[Number(e.target.dataset.i)].ram = Number(e.target.value);
          render();
        })
      );
      body.querySelectorAll('.vm-disk').forEach((el) =>
        el.addEventListener('change', (e) => {
          cfg.vms[Number(e.target.dataset.i)].disk = Number(e.target.value);
          render();
        })
      );
      body.querySelectorAll('.vm-vlan').forEach((el) =>
        el.addEventListener('change', (e) => {
          sfx.click();
          cfg.vms[Number(e.target.dataset.i)].vlan = Number(e.target.value);
          render();
        })
      );
      body.querySelectorAll('.vm-start-btn').forEach((el) =>
        el.addEventListener('click', () => {
          sfx.interact();
          const vm = cfg.vms[Number(el.dataset.i)];
          vm.started = !vm.started;
          render();
        })
      );
    } else if (activeTab === 'vlans') {
      body.innerHTML = `
        <h4>1. Base des VLANs (Switch L2)</h4>
        <div class="vlan-toggles">
          ${cfg.vlans
            .map(
              (v, i) => `
            <label class="vlan-pill ${v.enabled ? 'on' : ''}">
              <input type="checkbox" class="vlan-enable" data-i="${i}" ${v.enabled ? 'checked' : ''} />
              VLAN ${v.id} — <strong>${v.name}</strong> (${v.subnet})
            </label>`
            )
            .join('')}
        </div>
        <h4>2. Configuration des Ports Switch (Access vs Trunk 802.1Q)</h4>
        <table class="os-table">
          <thead><tr><th>Port</th><th>Raccordement</th><th>Mode</th><th>PVID / VLANs autorisés</th></tr></thead>
          <tbody>
            ${cfg.ports
              .map(
                (p, i) => `
              <tr>
                <td><strong>${p.port}</strong></td>
                <td>${p.desc}</td>
                <td>
                  <select class="port-mode" data-i="${i}">
                    <option value="ACCESS" ${p.mode === 'ACCESS' ? 'selected' : ''}>ACCESS</option>
                    <option value="TRUNK" ${p.mode === 'TRUNK' ? 'selected' : ''}>TRUNK 802.1Q</option>
                  </select>
                </td>
                <td>
                  ${
                    p.mode === 'ACCESS'
                      ? `<select class="port-pvid" data-i="${i}">
                          <option value="1" ${p.pvid === 1 ? 'selected' : ''}>VLAN 1</option>
                          ${st.requiredVlans.map((rv) => `<option value="${rv.id}" ${p.pvid === rv.id ? 'selected' : ''}>VLAN ${rv.id} (${rv.name})</option>`).join('')}
                        </select>`
                      : `<input type="text" class="port-allowed" data-i="${i}" value="${p.allowedVlans}" placeholder="Ex: 10,20,30" />`
                  }
                </td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      `;

      body.querySelectorAll('.vlan-enable').forEach((el) =>
        el.addEventListener('change', (e) => {
          sfx.click();
          cfg.vlans[Number(e.target.dataset.i)].enabled = e.target.checked;
          render();
        })
      );
      body.querySelectorAll('.port-mode').forEach((el) =>
        el.addEventListener('change', (e) => {
          sfx.click();
          cfg.ports[Number(e.target.dataset.i)].mode = e.target.value;
          render();
        })
      );
      body.querySelectorAll('.port-pvid').forEach((el) =>
        el.addEventListener('change', (e) => {
          cfg.ports[Number(e.target.dataset.i)].pvid = Number(e.target.value);
        })
      );
      body.querySelectorAll('.port-allowed').forEach((el) =>
        el.addEventListener('input', (e) => {
          cfg.ports[Number(e.target.dataset.i)].allowedVlans = e.target.value;
        })
      );
    } else if (activeTab === 'router') {
      body.innerHTML = `
        <h4>1. Sous-interfaces Routeur-on-a-Stick (Passerelles Inter-VLAN)</h4>
        <table class="os-table">
          <thead><tr><th>VLAN</th><th>Sous-interface</th><th>IP Passerelle attendue</th><th>Actif</th></tr></thead>
          <tbody>
            ${st.requiredVlans
              .map((rv) => {
                const gw = cfg.gateways[rv.id];
                return `
                <tr>
                  <td>VLAN ${rv.id} (${rv.name})</td>
                  <td><code>Gi0/0.${rv.id}</code></td>
                  <td><input type="text" class="gw-ip" data-vid="${rv.id}" value="${gw.ip}" /></td>
                  <td><input type="checkbox" class="gw-en" data-vid="${rv.id}" ${gw.enabled ? 'checked' : ''} /></td>
                </tr>`;
              })
              .join('')}
          </tbody>
        </table>

        <h4>2. Règles Pare-feu / ACL Inter-VLAN</h4>
        ${
          cfg.acls.length === 0
            ? '<p class="hint-mini">Aucune restriction ACL imposée sur ce niveau (routage ouvert entre tous les VLANs).</p>'
            : `<table class="os-table">
                <thead><tr><th>Source</th><th>Destination</th><th>Action Pare-feu</th></tr></thead>
                <tbody>
                  ${cfg.acls
                    .map(
                      (a, idx) => `
                    <tr>
                      <td>VLAN ${a.src}</td>
                      <td>VLAN ${a.dst}</td>
                      <td>
                        <select class="acl-action" data-i="${idx}">
                          <option value="ALLOW" ${a.action === 'ALLOW' ? 'selected' : ''}>✅ ALLOW (Autoriser)</option>
                          <option value="DENY" ${a.action === 'DENY' ? 'selected' : ''}>🛡️ DENY (Bloquer)</option>
                        </select>
                      </td>
                    </tr>`
                    )
                    .join('')}
                </tbody>
              </table>`
        }
      `;

      body.querySelectorAll('.gw-ip').forEach((el) =>
        el.addEventListener('input', (e) => {
          cfg.gateways[Number(e.target.dataset.vid)].ip = e.target.value;
        })
      );
      body.querySelectorAll('.gw-en').forEach((el) =>
        el.addEventListener('change', (e) => {
          sfx.click();
          cfg.gateways[Number(e.target.dataset.vid)].enabled = e.target.checked;
        })
      );
      body.querySelectorAll('.acl-action').forEach((el) =>
        el.addEventListener('change', (e) => {
          sfx.click();
          cfg.acls[Number(e.target.dataset.i)].action = e.target.value;
        })
      );
    } else {
      // Live generated Cisco IOS / Proxmox CLI config
      const cliLines = [
        '! === CONFIGURATION SWITCH CORE L2 ===',
        ...cfg.vlans
          .filter((v) => v.enabled)
          .map((v) => `vlan ${v.id}\n name ${v.name}`),
        ...cfg.ports.map((p) =>
          p.mode === 'TRUNK'
            ? `interface ${p.port}\n switchport mode trunk\n switchport trunk allowed vlan ${p.allowedVlans}`
            : `interface ${p.port}\n switchport mode access\n switchport access vlan ${p.pvid}`
        ),
        '! === ROUTEUR INTER-VLAN (DOT1Q) ===',
        ...Object.entries(cfg.gateways)
          .filter(([, g]) => g.enabled)
          .map(
            ([vid, g]) =>
              `interface Gi0/0.${vid}\n encapsulation dot1Q ${vid}\n ip address ${g.ip} 255.255.255.0`
          )
      ];
      body.innerHTML = `<pre class="cli-preview">${cliLines.join('\n')}</pre>`;
    }
  }

  function bindMainEvents(st) {
    document.querySelectorAll('.vmvlan-cfg-col .os-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        sfx.click();
        activeTab = btn.dataset.tab;
        render();
      });
    });

    document.getElementById('vmvlan-test-btn')?.addEventListener('click', () => {
      lastEval = evaluateVmVlanStage(st, cfg);
      if (lastEval.passed) {
        sfx.success();
        stageScores[stageIdx] = 1;
        render();
        setTimeout(() => {
          if (stageIdx < VMVLAN_STAGES.length - 1) {
            loadStage(stageIdx + 1);
            activeTab = 'vms';
            render();
          } else {
            const avg = stageScores.reduce((a, b) => a + b, 0) / VMVLAN_STAGES.length;
            api.finishTp(
              avg * 20,
              `<ul>
                <li>✅ Provisioning Hyperviseur &amp; allocation ressources VMs maîtrisés</li>
                <li>✅ Segmentation VLAN 802.1Q (Ports Access &amp; Trunks) validée</li>
                <li>✅ Routage Inter-VLAN (Router-on-a-Stick) &amp; ACL Pare-feu opérationnels</li>
              </ul>`
            );
          }
        }, 950);
      } else {
        sfx.error();
        render();
      }
    });
  }

  function drawTopo() {
    animId = requestAnimationFrame(drawTopo);
    const canvas = document.getElementById('topo-canvas');
    if (!canvas || !cfg) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    simPacketPhase = (simPacketPhase + 0.016) % 1;

    ctx.fillStyle = '#07101f';
    ctx.fillRect(0, 0, w, h);

    // Nodes positions
    const sw = { x: 260, y: 145 };
    const hyp = { x: 95, y: 55 };
    const rtr = { x: 425, y: 55 };
    const pc1 = { x: 110, y: 228 };
    const pc2 = { x: 410, y: 228 };

    // Links
    const drawLink = (a, b, label, trunk = false) => {
      ctx.strokeStyle = trunk ? '#22d3ee' : '#64748b';
      ctx.lineWidth = trunk ? 4 : 2.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(mx - 32, my - 10, 64, 18);
      ctx.fillStyle = trunk ? '#22d3ee' : '#cbd5e1';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, mx, my + 3);
    };

    const p1 = cfg.ports[0];
    const p2 = cfg.ports[stageIdx === 2 ? 2 : 1];
    const pAdmin = cfg.ports[stageIdx === 2 ? 3 : 2];
    const pEleve = cfg.ports[stageIdx === 2 ? 4 : 3];
    drawLink(hyp, sw, p1?.mode === 'TRUNK' ? 'TRUNK 802.1Q' : `ACC V${p1?.pvid}`, p1?.mode === 'TRUNK');
    drawLink(rtr, sw, p2?.mode === 'TRUNK' ? 'TRUNK 802.1Q' : `ACC V${p2?.pvid}`, p2?.mode === 'TRUNK');
    drawLink(pc1, sw, pAdmin?.mode === 'TRUNK' ? 'TRUNK' : `V${pAdmin?.pvid || 1}`, pAdmin?.mode === 'TRUNK');
    drawLink(pc2, sw, pEleve?.mode === 'TRUNK' ? 'TRUNK' : `V${pEleve?.pvid || 1}`, pEleve?.mode === 'TRUNK');

    // Animated packet dot if lastEval ran or steady heartbeat
    const px = hyp.x + (sw.x - hyp.x) * simPacketPhase;
    const py = hyp.y + (sw.y - hyp.y) * simPacketPhase;
    ctx.fillStyle = lastEval?.passed ? '#10b981' : '#fbbf24';
    ctx.beginPath();
    ctx.arc(px, py, 5.5, 0, Math.PI * 2);
    ctx.fill();

    const drawNode = (pos, title, sub, col) => {
      ctx.fillStyle = '#111c33';
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(pos.x - 66, pos.y - 24, 132, 48, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(title, pos.x, pos.y - 3);
      ctx.fillStyle = col;
      ctx.font = '10px monospace';
      ctx.fillText(sub, pos.x, pos.y + 14);
    };

    const runningVms = cfg.vms.filter((v) => v.started).length;
    drawNode(hyp, '🖥️ Hyperviseur', `${runningVms}/${cfg.vms.length} VMs actives`, '#38bdf8');
    drawNode(rtr, '🛡️ Routeur/ACL', 'Inter-VLAN Dot1Q', '#a78bfa');
    drawNode(sw, '🔀 Switch L2', `${cfg.vlans.filter((v) => v.enabled).length} VLANs actifs`, '#34d399');
    drawNode(pc1, '💻 Poste Admin', 'VLAN 10', '#fbbf24');
    drawNode(pc2, '💻 Poste Élèves', 'VLAN 20', '#fb7185');
  }

  loadStage(0);
  render();
  animId = requestAnimationFrame(drawTopo);

  return {
    destroy() {
      if (animId) cancelAnimationFrame(animId);
    }
  };
}
