import assert from 'node:assert/strict';
import test from 'node:test';
import { OSCILLO_STAGES, evaluateOscilloscopeStage, computeOscilloBenchScore } from '../src/minigames/OscilloscopeGame.js';
import { evaluateSolderStage, computeSolderingScore3D } from '../src/minigames/SolderingGame.js';
import {
  computeResistorOhms,
  simulateDividerCircuit,
  simulateLedCircuit,
  computeElectronicsScore3D
} from '../src/minigames/ElectronicsGame.js';
import { AV_STAGES, evaluateAntivirusStage, computeSocDefenseScore3D } from '../src/minigames/AntivirusGame.js';
import { VMVLAN_STAGES, evaluateVmVlanStage, computeVlanConfigScore3D } from '../src/minigames/VmVlanGame.js';
import { computeHardwareScore3D } from '../src/minigames/PcHardwareGame.js';
import { computeRackVlanScore3D, computePatchPanelScore3D } from '../src/minigames/PatchRackGame.js';
import {
  AV_STAGES as AV_AUDIO_STAGES,
  evaluateAvStage,
  computeAvStudioScore3D
} from '../src/minigames/AudioVisualGame.js';
import {
  FIXTURE_SPECS,
  DAISY_LINKS,
  evaluateDmxConfiguration,
  computeDmxScore3D
} from '../src/minigames/DmxLightingGame.js';
import {
  STUDIO_PATCH_LINKS,
  CUE_LIST,
  computeStudioAudioDb,
  evaluateStudioRegieState,
  computeStudioRegieScore3D
} from '../src/minigames/StudioRegieGame.js';

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

test('Notation /20 & XP des 6 ateliers TPs 3D interactifs', () => {
  const s1 = computeSolderingScore3D({
    pads: Array.from({ length: 8 }, () => ({ state: 'good' })),
    tempC: 350,
    fumeExtractorOn: true,
    burnCount: 0,
    reworkCount: 0,
    powerTestedOk: true,
    durationSec: 85
  });
  assert.equal(s1, 20);

  const s2 = computeOscilloBenchScore({
    gndAttached: true,
    tp1Stabilized: true,
    tp2Probed: true,
    tp3Probed: true,
    componentReplaced: true,
    tp3VerifiedAfterRepair: true,
    mistakes: 0,
    durationSec: 95
  });
  assert.equal(s2, 20);

  const s3 = computeHardwareScore3D({
    esdWorn: true,
    cpuInstalled: true,
    socketClosed: true,
    pasteApplied: true,
    coolerInstalled: true,
    ramDualChannel: true,
    ramCount: 2,
    nvmeInstalled: true,
    gpuInstalled: true,
    cablesConnected: true,
    postPassed: true,
    esdMistakes: 0,
    failedPosts: 0,
    elapsedSec: 120
  });
  assert.equal(s3.score, 20);
  assert.ok(s3.xp >= 350);

  const s4 = computeRackVlanScore3D({
    totalCables: 4,
    matchedCables: 4,
    mediaOk: 4,
    fiberCleaned: true,
    psuRedundant: true,
    vlansConfigured: 3,
    portsConfigured: 4,
    pingSuccessCount: 3,
    pingTotal: 3,
    cableErrors: 0,
    elapsedSec: 140
  });
  assert.equal(s4.score, 20);

  const s5 = computeSocDefenseScore3D({
    isolatedCompromised: true,
    firewallBlockedCount: 3,
    firewallTotal: 3,
    cvePatchedCount: 3,
    cveTotal: 3,
    edrScanDone: true,
    integrityRemaining: 95,
    mistakes: 0,
    elapsedSec: 90
  });
  assert.equal(s5.score, 20);

  const s6 = computeAvStudioScore3D({
    kelvin: 5600,
    chromaUniformity: 96,
    focusSharpness: 95,
    irisOk: true,
    audioMasterDb: -12,
    phantom48v: true,
    highPass80: true,
    elapsedSec: 110
  });
  assert.equal(s6.score, 20);
});

test('Scoring /20 des ateliers séparés (Électronique, Brassage, VLAN CLI, DMX512, Régie Studio)', () => {
  const elecScore = computeElectronicsScore3D({
    multimeterChecked: true,
    ledStatus: 'ok',
    dividerOk: true,
    dividerVout: 3.33,
    powerTested: true,
    elapsedSec: 90
  });
  assert.equal(elecScore.score, 20);

  const patchScore = computePatchPanelScore3D({
    t568bMatches: 8,
    crimped: true,
    patchCorrect: 6,
    colorCorrect: 6,
    totalLinks: 6,
    guidesUsed: true,
    testerRun: true,
    continuityPassed: true,
    elapsedSec: 60
  });
  assert.equal(patchScore, 20);

  const vlanScore = computeVlanConfigScore3D({
    vlansCreated: 3,
    accessPortsOk: 3,
    trunkConfigured: true,
    gatewaysOk: 3,
    probeRun: true,
    pingOk: true,
    tracerouteOk: true,
    elapsedSec: 70
  });
  assert.equal(vlanScore, 20);

  const dmxScore = computeDmxScore3D({
    cablesConnected: 4,
    terminatorInstalled: true,
    exactAddressesCount: 4,
    dmxNoOverlap: true,
    overlapCount: 0,
    matchedFixtures: 4,
    aimScore: 4,
    elapsedSec: 65
  });
  assert.equal(dmxScore, 20);

  const regieScore = computeStudioRegieScore3D({
    focusOk: true,
    irisOk: true,
    wbOk: true,
    chromaOk: true,
    audioLevelOk: true,
    audioClipping: false,
    phantom48v: true,
    hpf80: true,
    cuesCompleted: 3,
    elapsedSec: 70
  });
  assert.equal(regieScore, 20);
});

test('v4.10 DMX Lighting : validation daisy-chain XLR 120Ω, adressage 8ch, score 20/20 et bornes anti-NaN', () => {
  const incompleteEval = evaluateDmxConfiguration({
    cablesDone: new Set([0, 1]),
    terminatorInstalled: false,
    fixtures: FIXTURE_SPECS.map((sp) => ({ ...sp.target, addr: sp.startAddr }))
  });
  assert.equal(incompleteEval.daisyOk, false);
  assert.equal(incompleteEval.dmxNoOverlap, false);
  assert.equal(incompleteEval.allValid, false);
  assert.ok(incompleteEval.teacherAdvice.includes('Professeur CIEL'));

  const perfectFixtures = FIXTURE_SPECS.map((sp) => ({ ...sp.target, addr: sp.targetAddr }));
  const perfectEval = evaluateDmxConfiguration({
    cablesDone: new Set(DAISY_LINKS.map((l) => l.id)),
    terminatorInstalled: true,
    fixtures: perfectFixtures
  });
  assert.equal(perfectEval.daisyOk, true);
  assert.equal(perfectEval.dmxNoOverlap, true);
  assert.equal(perfectEval.exactAddressesCount, 4);
  assert.equal(perfectEval.matchedFixtures, 4);
  assert.equal(perfectEval.allValid, true);

  const fullScore = computeDmxScore3D({
    ...perfectEval,
    elapsedSec: 95
  });
  assert.equal(fullScore, 20);

  const nanScore = computeDmxScore3D({
    cablesConnected: Number.NaN,
    terminatorInstalled: false,
    exactAddressesCount: undefined,
    dmxNoOverlap: false,
    matchedFixtures: Number.POSITIVE_INFINITY,
    aimScore: Number.NaN,
    elapsedSec: 'invalid'
  });
  assert.equal(Number.isFinite(nanScore), true);
  assert.ok(nanScore >= 0 && nanScore <= 20);
});

test('v4.10 Studio Régie Vidéo/Son : patch SDI/XLR, optique 5600K, audio -12 dBFS, ATEM 20/20 et anti-NaN', () => {
  const unpatchedAudioDb = computeStudioAudioDb({
    xlrMicConnected: false,
    phantom48v: true,
    hpf80: true,
    micCravate: 78,
    micAmbiance: 28,
    music: 25,
    masterAudio: 80
  });
  assert.equal(unpatchedAudioDb, -48);

  const unpatchedEval = evaluateStudioRegieState({
    cablesDone: new Set([0]),
    focus: 72,
    iris: 56,
    kelvin: 5600,
    chromaKey: 84,
    phantom48v: true,
    hpf80: true,
    micCravate: 78,
    micAmbiance: 28,
    music: 25,
    masterAudio: 80,
    cuesDone: new Set([0])
  });
  assert.equal(unpatchedEval.patchAllOk, false);
  assert.equal(unpatchedEval.audioLevelOk, false);
  assert.equal(unpatchedEval.allValid, false);
  assert.ok(unpatchedEval.teacherAdvice.includes('Professeur CIEL'));

  const perfectState = {
    cablesDone: new Set(STUDIO_PATCH_LINKS.map((l) => l.id)),
    focus: 72,
    iris: 56,
    kelvin: 5600,
    chromaKey: 84,
    phantom48v: true,
    hpf80: true,
    micCravate: 78,
    micAmbiance: 28,
    music: 25,
    masterAudio: 80,
    cuesDone: new Set(CUE_LIST.map((c) => c.id))
  };
  const perfectEval = evaluateStudioRegieState(perfectState);
  assert.equal(perfectEval.patchAllOk, true);
  assert.equal(perfectEval.opticsAllOk, true);
  assert.equal(perfectEval.audioAllOk, true);
  assert.equal(perfectEval.atemAllOk, true);
  assert.equal(perfectEval.allValid, true);
  assert.ok(perfectEval.peakDb >= -14.5 && perfectEval.peakDb <= -9.5);

  const fullScore = computeStudioRegieScore3D({
    ...perfectEval,
    elapsedSec: 120
  });
  assert.equal(fullScore, 20);

  const nanScore = computeStudioRegieScore3D({
    cablesConnected: Number.NaN,
    cuesCompleted: 999,
    elapsedSec: undefined
  });
  assert.equal(Number.isFinite(nanScore), true);
  assert.ok(nanScore >= 0 && nanScore <= 20);
});

test('v4.10 AudioVisualGame : étapes plateau/audio/matrice et protection bornes [0, 20]', () => {
  const s1 = evaluateAvStage(AV_AUDIO_STAGES[0], { kelvin: 5600, keyDimmer: 78, chromaBacklight: true });
  const s2 = evaluateAvStage(AV_AUDIO_STAGES[1], { phantom48v: true, highPass80: true, db: -12 });
  const s3 = evaluateAvStage(AV_AUDIO_STAGES[2], {
    routing: { 'out-pgm': 'cam-a', 'out-rec': 'cam-b', 'out-mon': 'pc-slides' }
  });
  assert.equal(s1.score, 20);
  assert.equal(s2.score, 20);
  assert.equal(s3.score, 20);
  assert.ok(s1.teacherTip.includes('Professeur CIEL'));

  const clamped = computeAvStudioScore3D({
    kelvin: Number.NaN,
    chromaUniformity: 500,
    focusSharpness: undefined,
    irisOk: true,
    audioMasterDb: Number.NaN,
    phantom48v: true,
    highPass80: true,
    elapsedSec: Number.NaN
  });
  assert.equal(Number.isFinite(clamped.score), true);
  assert.ok(clamped.score >= 0 && clamped.score <= 20);
  assert.equal(Number.isFinite(clamped.xp), true);
  assert.ok(clamped.xp >= 0);
});
