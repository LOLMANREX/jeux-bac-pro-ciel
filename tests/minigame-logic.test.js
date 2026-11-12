import assert from 'node:assert/strict';
import test from 'node:test';
import { OSCILLO_STAGES, evaluateOscilloscopeStage } from '../src/minigames/OscilloscopeGame.js';
import { evaluateSolderStage } from '../src/minigames/SolderingGame.js';
import {
  computeResistorOhms,
  simulateDividerCircuit,
  simulateLedCircuit
} from '../src/minigames/ElectronicsGame.js';
import { AV_STAGES, evaluateAntivirusStage } from '../src/minigames/AntivirusGame.js';
import { VMVLAN_STAGES, evaluateVmVlanStage } from '../src/minigames/VmVlanGame.js';

test('Oscilloscope : valide la calibration et les mesures sinusoïdales et PWM', () => {
  const s1 = evaluateOscilloscopeStage(
    OSCILLO_STAGES[0],
    { vPerDiv: 1, timePerDivMs: 0.5, triggerLevel: 0.5, coupling: 'DC', ch2Enabled: false },
    { freq: 1000, upp: 6.0 }
  );
  assert.equal(s1.passed, true);

  const s2BadCoupling = evaluateOscilloscopeStage(
    OSCILLO_STAGES[1],
    { vPerDiv: 1, timePerDivMs: 0.5, triggerLevel: 2.0, coupling: 'AC', ch2Enabled: false },
    { freq: 500, duty: 25 }
  );
  assert.equal(s2BadCoupling.passed, false);
});

test('Brasure : exige pastilles brillantes, bonne température et extracteur EPI', () => {
  const pads = [
    { id: 'P1', state: 'good' },
    { id: 'P2', state: 'good' }
  ];
  assert.equal(evaluateSolderStage(pads, 350, true, 0).allGood, true);
  assert.equal(evaluateSolderStage(pads, 260, true, 0).tempOk, false);
  assert.equal(evaluateSolderStage([{ id: 'P1', state: 'bridge' }], 350, true, 0).allGood, false);
});

test('Électronique : code couleur, Loi d’Ohm LED et pont diviseur 5V -> 3.3V', () => {
  // Jaune (4), Violet (7), Marron (x10) = 470 ohms
  const r470 = computeResistorOhms(4, 7, 1);
  assert.equal(r470, 470);

  const ledOk = simulateLedCircuit(12, 2.0, r470, true);
  assert.equal(ledOk.status, 'ok');
  assert.ok(ledOk.currentMa > 20 && ledOk.currentMa < 23);

  const ledRev = simulateLedCircuit(12, 2.0, r470, false);
  assert.equal(ledRev.status, 'reversed');

  const ledBurn = simulateLedCircuit(12, 2.0, 10, true);
  assert.equal(ledBurn.status, 'burned');

  const divOk = simulateDividerCircuit(5.0, 1000, 2000);
  assert.equal(divOk.ok, true);
  assert.equal(divOk.vout, 3.33);
});

test('Antivirus : bloque la validation tant que virus, port ou tâche planifiée restent actifs', () => {
  const st = AV_STAGES[2];
  const state = {
    avInstalled: true,
    avUpdated: true,
    scanDone: true,
    processes: st.processes.map((p) => ({ ...p, alive: p.legit })),
    ports: st.ports.map((p) => ({ ...p, open: !p.bad })),
    startup: st.startup.map((s) => ({ ...s, enabled: !s.bad })),
    files: st.files.map((f) => ({ ...f, quarantined: f.bad }))
  };
  assert.equal(evaluateAntivirusStage(state).clean, true);

  state.processes[1].alive = true; // svch0st.exe still alive
  assert.equal(evaluateAntivirusStage(state).clean, false);
});

test('VM & VLAN : valide une architecture complète 3 VLANs + Trunk 802.1Q + ACL Pare-feu', () => {
  const st = VMVLAN_STAGES[2];
  const validCfg = {
    vms: [
      { role: 'VM-PFSENSE', name: 'VM-PFSENSE', cpu: 2, ram: 4, disk: 30, vlan: 10, started: true },
      { role: 'VM-SRV-FICHIERS', name: 'VM-SRV-FICHIERS', cpu: 4, ram: 8, disk: 100, vlan: 10, started: true },
      { role: 'VM-WEB-PORTAIL', name: 'VM-WEB-PORTAIL', cpu: 2, ram: 4, disk: 40, vlan: 30, started: true }
    ],
    vlans: st.requiredVlans.map((v) => ({ ...v, enabled: true })),
    ports: [
      { port: 'Gi0/1', mode: 'TRUNK', allowedVlans: '10,20,30', pvid: 1 },
      { port: 'Gi0/2', mode: 'TRUNK', allowedVlans: '10,20,30', pvid: 1 },
      { port: 'Gi0/3', mode: 'TRUNK', allowedVlans: '10,20,30', pvid: 1 },
      { port: 'Gi0/4', mode: 'ACCESS', pvid: 10, allowedVlans: '' },
      { port: 'Gi0/5', mode: 'ACCESS', pvid: 20, allowedVlans: '' }
    ],
    gateways: {
      10: { enabled: true, ip: '192.168.10.254' },
      20: { enabled: true, ip: '192.168.20.254' },
      30: { enabled: true, ip: '192.168.30.254' }
    },
    acls: [
      { src: 20, dst: 10, action: 'DENY' },
      { src: 20, dst: 30, action: 'ALLOW' }
    ]
  };

  const okRes = evaluateVmVlanStage(st, validCfg);
  assert.equal(okRes.passed, true, `Erreurs inattendues: ${okRes.errors.join('; ')}`);

  // If ACL allows VLAN 20 -> 10, security check must fail!
  validCfg.acls[0].action = 'ALLOW';
  const badAclRes = evaluateVmVlanStage(st, validCfg);
  assert.equal(badAclRes.passed, false);
});
