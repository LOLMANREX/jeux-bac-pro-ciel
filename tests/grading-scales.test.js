import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  toSafeNumber,
  roundHalfUp,
  finalizeGrade20,
  createGradeBreakdown,
  renderBreakdownHtml,
  buildBreakdownLines
} from '../src/core/grading.js';
import {
  OSCILLO_STAGES,
  evaluateOscilloscopeStage,
  evaluateOscilloBenchScore,
  computeOscilloBenchScore
} from '../src/minigames/OscilloscopeGame.js';
import {
  SOLDER_STAGES,
  evaluateSolderStage,
  evaluateSolderingScore3D,
  computeSolderingScore3D
} from '../src/minigames/SolderingGame.js';
import { computeElectronicsScore3D } from '../src/minigames/ElectronicsGame.js';
import {
  AV_STAGES as AV_CYBER_STAGES,
  evaluateAntivirusStage,
  computeSocDefenseScore3D
} from '../src/minigames/AntivirusGame.js';
import {
  VMVLAN_STAGES,
  evaluateVmVlanStage,
  evaluateVlanConfigScore3D,
  computeVlanConfigScore3D
} from '../src/minigames/VlanConfigGame.js';
import {
  PATCH_STAGES,
  evaluatePatchConfiguration,
  evaluatePatchPanelScore3D,
  computePatchPanelScore3D,
  computeRackVlanScore3D
} from '../src/minigames/PatchRackGame.js';
import {
  HARDWARE_STAGES,
  evaluateHardwareBuild,
  computeHardwareScore3D
} from '../src/minigames/PcHardwareGame.js';
import {
  FIXTURE_SPECS,
  DAISY_LINKS,
  evaluateDmxConfiguration,
  evaluateDmxScore3D,
  computeDmxScore3D
} from '../src/minigames/DmxLightingGame.js';
import {
  AV_STAGES as AV_AUDIO_STAGES,
  evaluateAvStage,
  computeAvStudioScore3D
} from '../src/minigames/AudioVisualGame.js';
import {
  STUDIO_PATCH_LINKS,
  CUE_LIST,
  evaluateStudioRegieState,
  evaluateStudioRegieScore3D,
  computeStudioRegieScore3D
} from '../src/minigames/StudioRegieGame.js';
import { computeAverage, GameStore } from '../server/store.js';
import { computeTpCoinReward } from '../src/world/ShopCatalog.js';
import { createTpSpatialPanel } from '../src/vr/VRHudPanel.js';

test('v4.25 Moteur de notation commun : arrondi généreux, seuil 19.25, anti-NaN et HTML/VR breakdown', () => {
  assert.equal(toSafeNumber(Number.NaN, 5), 5);
  assert.equal(toSafeNumber('18.5', 0), 18.5);
  assert.equal(roundHalfUp(18.01), 18.5);
  assert.equal(roundHalfUp(19.0), 19);

  assert.equal(finalizeGrade20(19.25, { hasCriticalError: false }), 20);
  assert.equal(finalizeGrade20(19.5, { hasCriticalError: false }), 20);
  assert.equal(finalizeGrade20(19.6, { hasCriticalError: true }), 19.5);
  assert.equal(finalizeGrade20(Number.NaN), 0);
  assert.equal(finalizeGrade20(999), 20);
  assert.equal(finalizeGrade20(-40), 0);

  const bd = createGradeBreakdown({
    items: [
      { label: 'Critère A <test>', earned: 10, max: 10 },
      { label: 'Critère B', earned: 9.25, max: 10 }
    ],
    penalties: [{ label: 'Micro-erreur', points: 0, forgivenCount: 1 }],
    rawScore: 19.25,
    finalScore: 20,
    hasCriticalError: false,
    tip: 'Aucune'
  });
  assert.equal(bd.totalMax, 20);
  assert.equal(bd.roundedTo20, true);
  assert.equal(bd.isPerfect, true);

  const html = renderBreakdownHtml(bd);
  assert.ok(html.includes('Critère A &lt;test&gt;'));
  assert.ok(html.includes('10 / 10 pts'));
  assert.ok(html.includes('0 pt (droit à l’erreur)'));
  assert.ok(html.includes('→ 20 / 20'));

  const lines = buildBreakdownLines(bd);
  assert.ok(lines.some((l) => l.includes('Critère A <test> : 10/10 pts')));
  assert.ok(lines.some((l) => l.includes('Arrondi généreux')));
});

test('v4.25 TP Oscilloscope : 20/20 atteignable en temps normal et avec 2 micro-erreurs corrigées', () => {
  const normalPerfect = evaluateOscilloBenchScore({
    gndAttached: true,
    tp1Stabilized: true,
    tp2Probed: true,
    tp3Probed: true,
    componentReplaced: true,
    tp3VerifiedAfterRepair: true,
    mistakes: 2,
    durationSec: 260
  });
  assert.equal(normalPerfect.score, 20);
  assert.equal(normalPerfect.breakdown.totalMax, 20);

  const slowRealistic = computeOscilloBenchScore({
    gndAttached: true,
    tp1Stabilized: true,
    tp2Probed: true,
    tp3Probed: true,
    componentReplaced: true,
    tp3VerifiedAfterRepair: true,
    mistakes: 1,
    durationSec: 520
  });
  assert.equal(slowRealistic, 20);

  const missingRepair = evaluateOscilloBenchScore({
    gndAttached: true,
    tp1Stabilized: true,
    tp2Probed: true,
    tp3Probed: true,
    componentReplaced: false,
    tp3VerifiedAfterRepair: false,
    mistakes: 0,
    durationSec: 90
  });
  assert.ok(missingRepair.score < 20);
  assert.ok(missingRepair.breakdown.tip.length > 0);

  const stageOk = evaluateOscilloscopeStage(
    OSCILLO_STAGES[0],
    { vPerDiv: 2, timePerDivMs: 0.5, triggerLevel: 0.5, coupling: 'DC', ch2Enabled: false },
    { freq: 1080, upp: 5.4 }
  );
  assert.equal(stageOk.passed, true);

  const nanScore = computeOscilloBenchScore({ mistakes: Number.NaN, durationSec: 'invalid' });
  assert.ok(Number.isFinite(nanScore) && nanScore >= 0 && nanScore <= 20);
});

test('v4.25 TP Brasure PCB : 20/20 accessible avec température réaliste, reprises et temps VR confortable', () => {
  const cleanPads = [...SOLDER_STAGES[0].pads, ...SOLDER_STAGES[1].pads].map((p) => ({
    ...p,
    state: 'good'
  }));

  const vrRealistic = evaluateSolderingScore3D({
    pads: cleanPads,
    tempC: 372,
    fumeExtractorOn: true,
    burnCount: 0,
    reworkCount: 2,
    powerTestedOk: true,
    durationSec: 340
  });
  assert.equal(vrRealistic.score, 20);
  assert.equal(vrRealistic.breakdown.totalMax, 20);

  const slowClean = computeSolderingScore3D({
    pads: cleanPads,
    tempC: 350,
    fumeExtractorOn: true,
    burnCount: 0,
    reworkCount: 1,
    powerTestedOk: true,
    durationSec: 600
  });
  assert.equal(slowClean, 20);

  const missingExtractor = evaluateSolderingScore3D({
    pads: cleanPads,
    tempC: 350,
    fumeExtractorOn: false,
    burnCount: 0,
    reworkCount: 0,
    powerTestedOk: true,
    durationSec: 90
  });
  assert.ok(missingExtractor.score < 20);

  const stCheck = evaluateSolderStage(cleanPads, 372, true, 2);
  assert.equal(stCheck.allGood, true);
  assert.equal(stCheck.tempOk, true);
  assert.equal(stCheck.ratio, 1);

  const nanScore = computeSolderingScore3D({
    pads: cleanPads,
    tempC: Number.NaN,
    burnCount: Number.NaN,
    reworkCount: undefined,
    durationSec: Number.POSITIVE_INFINITY
  });
  assert.ok(Number.isFinite(nanScore) && nanScore >= 0 && nanScore <= 20);
});

test('v4.25 TP Électronique : 20/20 accessible avec 1 surintensité corrigée et temps confortable', () => {
  const realistic = computeElectronicsScore3D({
    multimeterChecked: true,
    ledStatus: 'ok',
    dividerOk: true,
    dividerVout: 3.33,
    powerTested: true,
    burnCount: 1,
    elapsedSec: 380
  });
  assert.equal(realistic.score, 20);
  assert.equal(realistic.breakdown.totalMax, 20);

  const slow = computeElectronicsScore3D({
    multimeterChecked: true,
    ledStatus: 'ok',
    dividerOk: true,
    dividerVout: 3.33,
    powerTested: true,
    burnCount: 0,
    elapsedSec: 520
  });
  assert.equal(slow.score, 20);

  const missingDivider = computeElectronicsScore3D({
    multimeterChecked: true,
    ledStatus: 'ok',
    dividerOk: false,
    dividerVout: 4.5,
    powerTested: true,
    burnCount: 0,
    elapsedSec: 90
  });
  assert.ok(missingDivider.score < 20);

  const nanScore = computeElectronicsScore3D({
    dividerVout: Number.NaN,
    burnCount: Number.NaN,
    elapsedSec: Number.NaN
  });
  assert.ok(Number.isFinite(nanScore.score) && nanScore.score >= 0 && nanScore.score <= 20);
});

test('v4.25 TP Cybersécurité SOC : 20/20 accessible sans pénalité punitive sur intégrité >= 60% et 1 erreur corrigée', () => {
  const realistic = computeSocDefenseScore3D({
    isolatedCompromised: true,
    firewallBlockedCount: 3,
    firewallTotal: 3,
    cvePatchedCount: 3,
    cveTotal: 3,
    edrScanDone: true,
    integrityRemaining: 64,
    mistakes: 1,
    elapsedSec: 310
  });
  assert.equal(realistic.score, 20);
  assert.equal(realistic.breakdown.totalMax, 20);

  const unpatched = computeSocDefenseScore3D({
    isolatedCompromised: true,
    firewallBlockedCount: 3,
    firewallTotal: 3,
    cvePatchedCount: 2,
    cveTotal: 3,
    edrScanDone: true,
    integrityRemaining: 95,
    mistakes: 0,
    elapsedSec: 90
  });
  assert.ok(unpatched.score < 20);

  const st = AV_CYBER_STAGES[0];
  assert.equal(
    evaluateAntivirusStage({
      avInstalled: true,
      avUpdated: true,
      scanDone: true,
      processes: st.processes.map((p) => ({ ...p, alive: p.legit })),
      ports: st.ports.map((p) => ({ ...p, open: !p.bad })),
      startup: [],
      files: st.files.map((f) => ({ ...f, quarantined: f.bad }))
    }).clean,
    true
  );

  const nanScore = computeSocDefenseScore3D({
    firewallBlockedCount: Number.NaN,
    integrityRemaining: Number.NaN,
    mistakes: Number.NaN,
    elapsedSec: undefined
  });
  assert.ok(Number.isFinite(nanScore.score) && nanScore.score >= 0 && nanScore.score <= 20);
});

test('v4.25 TP VLAN 802.1Q : 20/20 garanti même en temps long VR (plus de plafond bloqué à 19/20)', () => {
  const slowActive = evaluateVlanConfigScore3D({
    vlansCreated: 3,
    accessPortsOk: 3,
    trunkConfigured: true,
    gatewaysOk: 3,
    probeRun: true,
    pingOk: true,
    tracerouteOk: true,
    elapsedSec: 540
  });
  assert.equal(slowActive.score, 20);
  assert.equal(slowActive.breakdown.totalMax, 20);

  const slowLegacy = computeVlanConfigScore3D({
    vlansCreated: 3,
    trunkConfigured: true,
    gatewaysOk: 3,
    stpResolved: true,
    probeRun: true,
    pingOk: true,
    elapsedSec: 540
  });
  assert.equal(slowLegacy, 20);

  const missingTrunk = evaluateVlanConfigScore3D({
    vlansCreated: 3,
    accessPortsOk: 3,
    trunkConfigured: false,
    gatewaysOk: 3,
    probeRun: true,
    pingOk: true,
    tracerouteOk: false,
    elapsedSec: 80
  });
  assert.ok(missingTrunk.score < 20);

  const st0 = VMVLAN_STAGES[0];
  const stageCheck = evaluateVmVlanStage(st0, {
    vms: [
      { role: 'SRV-ADMIN', name: 'SRV-ADMIN', cpu: 2, ram: 4, disk: 40, vlan: 10, started: true },
      { role: 'PC-ELEVE-VM', name: 'PC-ELEVE-VM', cpu: 2, ram: 4, disk: 30, vlan: 20, started: true }
    ],
    vlans: st0.requiredVlans.map((v) => ({ ...v, enabled: true })),
    ports: [
      { port: 'Gi0/1', mode: 'TRUNK', allowedVlans: '10,20', pvid: 1 },
      { port: 'Gi0/2', mode: 'TRUNK', allowedVlans: '10,20', pvid: 1 },
      { port: 'Gi0/3', mode: 'ACCESS', pvid: 10, allowedVlans: '' },
      { port: 'Gi0/4', mode: 'ACCESS', pvid: 20, allowedVlans: '' }
    ],
    gateways: {
      10: { enabled: true, ip: '192.168.10.254' },
      20: { enabled: true, ip: '192.168.20.254' }
    },
    acls: []
  });
  assert.equal(stageCheck.passed, true);

  const nanScore = computeVlanConfigScore3D({
    vlansCreated: Number.NaN,
    accessPortsOk: Number.NaN,
    gatewaysOk: Number.NaN,
    elapsedSec: Number.NaN
  });
  assert.ok(Number.isFinite(nanScore) && nanScore >= 0 && nanScore <= 20);
});

test('v4.25 TP Baie de Brassage & Sertissage : 20/20 accessible en temps long et Rack/VLAN corrigé', () => {
  const patchRealistic = evaluatePatchPanelScore3D({
    t568bMatches: 8,
    crimped: true,
    patchCorrect: 6,
    colorCorrect: 6,
    totalLinks: 6,
    guidesUsed: true,
    testerRun: true,
    continuityPassed: true,
    elapsedSec: 500
  });
  assert.equal(patchRealistic.score, 20);
  assert.equal(patchRealistic.breakdown.totalMax, 20);

  const rackRealistic = computeRackVlanScore3D({
    totalCables: 4,
    matchedCables: 4,
    mediaOk: 4,
    fiberCleaned: true,
    psuRedundant: true,
    vlansConfigured: 3,
    portsConfigured: 4,
    pingSuccessCount: 3,
    pingTotal: 3,
    cableErrors: 2,
    elapsedSec: 520
  });
  assert.equal(rackRealistic.score, 20);
  assert.equal(rackRealistic.breakdown.totalMax, 20);

  const incompletePatch = computePatchPanelScore3D({
    t568bMatches: 8,
    crimped: true,
    patchCorrect: 5,
    colorCorrect: 5,
    totalLinks: 6,
    guidesUsed: true,
    testerRun: true,
    continuityPassed: false,
    elapsedSec: 60
  });
  assert.ok(incompletePatch < 20);

  const stPass = evaluatePatchConfiguration(PATCH_STAGES[0], {
    links: { 'PP-01': 'SW-01', 'PP-02': 'SW-02', 'PP-03': 'SW-03', 'PP-04': 'SW-SFP1' },
    mediaUsed: { 'PP-01': 'cat6a', 'PP-02': 'cat6a', 'PP-03': 'cat6a', 'PP-04': 'sfp10g' }
  });
  assert.equal(stPass.score, 20);
  assert.equal(stPass.passed, true);

  const nanPatch = computePatchPanelScore3D({ t568bMatches: Number.NaN, elapsedSec: Number.NaN });
  const nanRack = computeRackVlanScore3D({ matchedCables: Number.NaN, cableErrors: Number.NaN });
  assert.ok(Number.isFinite(nanPatch) && nanPatch >= 0 && nanPatch <= 20);
  assert.ok(Number.isFinite(nanRack.score) && nanRack.score >= 0 && nanRack.score <= 20);
});

test('v4.25 TP Montage & Maintenance PC : 20/20 accessible avec 1 erreur ESD + 1 POST raté corrigés et temps réaliste', () => {
  const realistic = computeHardwareScore3D({
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
    esdMistakes: 1,
    failedPosts: 1,
    elapsedSec: 360
  });
  assert.equal(realistic.score, 20);
  assert.equal(realistic.breakdown.totalMax, 20);

  const missingPaste = computeHardwareScore3D({
    esdWorn: true,
    cpuInstalled: true,
    socketClosed: true,
    pasteApplied: false,
    coolerInstalled: true,
    ramDualChannel: true,
    ramCount: 2,
    nvmeInstalled: true,
    gpuInstalled: true,
    cablesConnected: true,
    postPassed: false,
    esdMistakes: 0,
    failedPosts: 0,
    elapsedSec: 90
  });
  assert.ok(missingPaste.score < 20);

  const stage2Half = evaluateHardwareBuild(HARDWARE_STAGES[1], {
    answers: { 'pc-a': 'ram', 'pc-b': 'cooling', 'pc-c': 'psu' }
  });
  assert.equal(stage2Half.passed, true);
  assert.ok(stage2Half.score >= 10 && stage2Half.score < 20);

  const nanScore = computeHardwareScore3D({
    ramCount: Number.NaN,
    esdMistakes: Number.NaN,
    failedPosts: Number.NaN,
    elapsedSec: Number.NaN
  });
  assert.ok(Number.isFinite(nanScore.score) && nanScore.score >= 0 && nanScore.score <= 20);
});

test('v4.25 TP Régie Audiovisuelle DMX512 : tolérances élargies & 20/20 accessible sans speedrun', () => {
  const relaxedFixtures = FIXTURE_SPECS.map((sp) => ({
    addr: sp.targetAddr,
    master: Math.max(58, sp.target.master - 20),
    r: Math.max(0, Math.min(255, sp.target.r + 35)),
    g: Math.max(0, Math.min(255, sp.target.g - 35)),
    b: Math.max(0, Math.min(255, sp.target.b + 25)),
    pan: sp.target.pan + 15,
    tilt: sp.target.tilt - 15
  }));
  const ev = evaluateDmxConfiguration({
    cablesDone: new Set(DAISY_LINKS.map((l) => l.id)),
    terminatorInstalled: true,
    fixtures: relaxedFixtures
  });
  assert.equal(ev.allValid, true);

  const slowScore = evaluateDmxScore3D({
    ...ev,
    elapsedSec: 450
  });
  assert.equal(slowScore.score, 20);
  assert.equal(slowScore.breakdown.totalMax, 20);

  const avStageOk = evaluateAvStage(AV_AUDIO_STAGES[0], {
    kelvin: 5850,
    keyDimmer: 68,
    chromaBacklight: true
  });
  assert.equal(avStageOk.score, 20);

  const av3dOk = computeAvStudioScore3D({
    kelvin: 5900,
    chromaUniformity: 82,
    focusSharpness: 82,
    irisOk: true,
    audioMasterDb: -15,
    phantom48v: true,
    highPass80: true,
    elapsedSec: 420
  });
  assert.equal(av3dOk.score, 20);

  const nanDmx = computeDmxScore3D({
    cablesConnected: Number.NaN,
    exactAddressesCount: Number.NaN,
    matchedFixtures: Number.NaN,
    aimScore: Number.NaN,
    elapsedSec: Number.NaN
  });
  assert.ok(Number.isFinite(nanDmx) && nanDmx >= 0 && nanDmx <= 20);
});

test('v4.25 TP Studio Régie Vidéo/Son : somme max 20/20 corrigée (était 19.5) & tolérances confortables', () => {
  const ev = evaluateStudioRegieState({
    cablesDone: new Set(STUDIO_PATCH_LINKS.map((l) => l.id)),
    focus: 80,
    iris: 64,
    kelvin: 5850,
    chromaKey: 72,
    phantom48v: true,
    hpf80: true,
    micCravate: 78,
    micAmbiance: 28,
    music: 25,
    masterAudio: 80,
    cuesDone: new Set(CUE_LIST.map((c) => c.id))
  });
  assert.equal(ev.allValid, true);

  const slowRes = evaluateStudioRegieScore3D({
    ...ev,
    elapsedSec: 480
  });
  assert.equal(slowRes.score, 20);
  assert.equal(slowRes.breakdown.totalMax, 20);

  const partialNoPatch = evaluateStudioRegieScore3D({
    cablesConnected: 2,
    patchAllOk: false,
    focusOk: true,
    irisOk: true,
    wbOk: true,
    chromaOk: true,
    phantom48v: true,
    hpf80: true,
    audioLevelOk: true,
    audioClipping: false,
    cuesCompleted: 3,
    elapsedSec: 120
  });
  assert.ok(partialNoPatch.score < 20 && partialNoPatch.score >= 16);

  const nanStudio = computeStudioRegieScore3D({
    cablesConnected: Number.NaN,
    cuesCompleted: Number.NaN,
    elapsedSec: Number.NaN
  });
  assert.ok(Number.isFinite(nanStudio) && nanStudio >= 0 && nanStudio <= 20);
});

test('v4.25 Moyenne générale, économie CIEL Coins, panneau résultat VR & intégrité des fichiers protégés', () => {
  assert.equal(computeAverage({ oscilloscope: 20, soldering: Number.NaN, electronics: 18 }), 19);
  assert.equal(computeAverage({}), null);

  const coin20 = computeTpCoinReward({ score: 20, isFirstValidation: true });
  assert.equal(coin20.baseCoins, 100);
  assert.equal(coin20.firstValidationBonus, 50);
  assert.equal(coin20.totalCoins, 150);

  const panel = createTpSpatialPanel();
  const evalRes = evaluateOscilloBenchScore({
    gndAttached: true,
    tp1Stabilized: true,
    tp2Probed: true,
    tp3Probed: true,
    componentReplaced: true,
    tp3VerifiedAfterRepair: true,
    mistakes: 1,
    durationSec: 210
  });
  panel.updateState({
    mode: 'result',
    tpId: 'oscilloscope',
    tpTitle: 'TP Oscilloscope',
    result: {
      score: evalRes.score,
      isPerfect: true,
      xp: 330,
      coinsBase: 100,
      duration: '03:30',
      mention: 'Parfait 20/20 !',
      breakdown: evalRes.breakdown,
      summaryLines: buildBreakdownLines(evalRes.breakdown),
      onReplay: () => {},
      onExit: () => {}
    }
  });
  const snap = panel.getState();
  assert.equal(snap.mode, 'result');
  assert.equal(snap.result.isPerfect, true);
  assert.equal(snap.result.breakdown.items.length, 7);
  assert.ok(panel.getHitBoxes().some((b) => b.id === 'vr_tp_replay'));
  assert.ok(panel.getHitBoxes().some((b) => b.id === 'vr_tp_done'));
  panel.dispose();

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ciel-v425-'));
  try {
    const accountsPath = path.join(tmpDir, 'accounts.json');
    const store = new GameStore(null, { accountsPath });
    const rec = store.recordTpScore('Eleve20', 'soldering', 20, 240);
    assert.equal(rec.score, 20);
    assert.equal(rec.coinsEarned, 150);
    assert.equal(rec.profile.average, 20);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const forbidden = ['For', 'tin'].join('').toLowerCase();
  const checkedFiles = [
    'src/core/grading.js',
    'src/minigames/MiniGameModal.js',
    'src/minigames/OscilloscopeGame.js',
    'src/minigames/SolderingGame.js',
    'src/minigames/ElectronicsGame.js',
    'src/minigames/AntivirusGame.js',
    'src/minigames/VlanConfigGame.js',
    'src/minigames/PatchPanelGame.js',
    'src/minigames/PcHardwareGame.js',
    'src/minigames/DmxLightingGame.js',
    'src/minigames/AudioVisualGame.js',
    'src/minigames/StudioRegieGame.js',
    'src/vr/VRHudPanel.js',
    'src/ui/ChangelogModal.js'
  ];
  for (const rel of checkedFiles) {
    const content = fs.readFileSync(path.resolve(rel), 'utf8').toLowerCase();
    assert.equal(content.includes(forbidden), false, `Nom interdit détecté dans ${rel}`);
  }
});
