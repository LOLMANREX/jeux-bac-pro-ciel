import { toSafeNumber, finalizeGrade20, createGradeBreakdown } from '../core/grading.js';
import { createDmxLightingGame } from './DmxLightingGame.js';
import { createStudioRegieGame } from './StudioRegieGame.js';

export const AV_STAGES = [
  {
    id: 1,
    name: '1. Plateau Caméra & Éclairage DMX',
    brief:
      'Préparez le plateau fond vert : calibrez la balance des blancs à 5600K (lumière du jour), réglez le projecteur Key DMX entre 65% et 90% et activez l’éclairage uniforme du fond vert.',
    teacherTip:
      'Professeur CIEL : Calibrez la caméra sur 5600K (lumière du jour), ajustez le Key Light DMX entre 65% et 90% et allumez le rétro-éclairage du cyclorama fond vert.',
    kind: 'lighting',
    targetKelvin: 5600,
    kelvinTol: 300,
    minKeyDimmer: 65,
    maxKeyDimmer: 90
  },
  {
    id: 2,
    name: '2. Console Audio & Cabines Studio',
    brief:
      'En régie audio, activez l’alimentation fantôme +48V pour le micro statique XLR, le filtre coupe-bas 80 Hz et ajustez le gain pour obtenir un niveau nominal entre -15 et -9 dBFS.',
    teacherTip:
      'Professeur CIEL : Un microphone statique XLR nécessite impérativement le +48V fantôme ! Activez aussi le filtre coupe-bas 80 Hz et stabilisez la modulation entre -15 et -9 dBFS.',
    kind: 'audio',
    minDb: -15,
    maxDb: -9
  },
  {
    id: 3,
    name: '3. Matrice SDI / NDI Régie',
    brief:
      'Routez les sources vidéo/audio vers les sorties de la régie centrale : Caméra A -> Live PGM, Caméra B -> Enregistreur SSD, Slides HDMI PC -> Écran Retour Plateau.',
    teacherTip:
      'Professeur CIEL : Sur la grille de commutation SDI/HDMI, envoyez la Caméra A vers le Direct PGM, la Caméra B vers l’enregistreur SSD et le PC Slides vers le retour plateau.',
    kind: 'matrix',
    routes: [
      { id: 'out-pgm', label: 'Sortie 1 : Diffusion Live PGM', expected: 'cam-a' },
      { id: 'out-rec', label: 'Sortie 2 : Enregistreur HyperDeck SSD', expected: 'cam-b' },
      { id: 'out-mon', label: 'Sortie 3 : Moniteur Retour Plateau', expected: 'pc-slides' }
    ],
    sources: [
      { id: 'cam-a', label: 'Caméra A (SDI-1)' },
      { id: 'cam-b', label: 'Caméra B (SDI-2)' },
      { id: 'pc-slides', label: 'PC Slides (HDMI/NDI)' }
    ]
  }
];

export function evaluateAvStage(stage, state = {}) {
  const safeStage = stage && typeof stage === 'object' ? stage : AV_STAGES[0];
  const safeState = state && typeof state === 'object' ? state : {};
  const details = [];

  if (safeStage.kind === 'lighting') {
    let pts = 0;
    const kelvin = toSafeNumber(safeState.kelvin, 3200);
    const keyDimmer = toSafeNumber(safeState.keyDimmer, 0);
    const targetKelvin = toSafeNumber(safeStage.targetKelvin, 5600);
    const kelvinTol = toSafeNumber(safeStage.kelvinTol, 300);
    const minKeyDimmer = toSafeNumber(safeStage.minKeyDimmer, 65);
    const maxKeyDimmer = toSafeNumber(safeStage.maxKeyDimmer, 90);

    const kelvinOk = Math.abs(kelvin - targetKelvin) <= kelvinTol;
    const dimmerOk = keyDimmer >= minKeyDimmer && keyDimmer <= maxKeyDimmer;
    const chromaOk = Boolean(safeState.chromaBacklight);

    if (kelvinOk) pts += 1;
    else details.push(`Balance des blancs à ${kelvin}K (cible ${targetKelvin}K ±${kelvinTol}K)`);
    if (dimmerOk) pts += 1;
    else details.push(`Intensité Key Light à ${keyDimmer}% (cible ${minKeyDimmer}-${maxKeyDimmer}%)`);
    if (chromaOk) pts += 1;
    else details.push('Éclairage fond vert désactivé (ombres portées détectées)');

    const score = finalizeGrade20((pts / 3) * 20, { hasCriticalError: pts < 3 });
    return {
      score,
      details,
      passed: score >= 10,
      teacherTip: safeStage.teacherTip || ''
    };
  }

  if (safeStage.kind === 'audio') {
    let pts = 0;
    const gain = toSafeNumber(safeState.gain, 0);
    const db =
      safeState.db !== undefined && Number.isFinite(Number(safeState.db))
        ? Number(safeState.db)
        : -32 + gain * 0.4;
    const minDb = toSafeNumber(safeStage.minDb, -15);
    const maxDb = toSafeNumber(safeStage.maxDb, -9);

    if (safeState.phantom48v) pts += 1;
    else details.push('Alimentation fantôme +48V désactivée : micro statique muet');
    if (safeState.highPass80) pts += 1;
    else details.push('Filtre coupe-bas 80 Hz inactif (bruits de manipulation présents)');
    if (db >= minDb && db <= maxDb) pts += 1;
    else details.push(`Niveau crête à ${db.toFixed(1)} dBFS (cible ${minDb} à ${maxDb} dBFS)`);

    const score = finalizeGrade20((pts / 3) * 20, { hasCriticalError: pts < 3 });
    return {
      score,
      details,
      passed: score >= 10,
      teacherTip: safeStage.teacherTip || ''
    };
  }

  let ok = 0;
  const routes = Array.isArray(safeStage.routes) && safeStage.routes.length > 0 ? safeStage.routes : AV_STAGES[2].routes;
  const routing = safeState.routing && typeof safeState.routing === 'object' ? safeState.routing : {};
  for (const r of routes) {
    if (routing[r.id] === r.expected) ok += 1;
    else details.push(`${r.label} : source routée incorrecte`);
  }
  const score = finalizeGrade20((ok / routes.length) * 20, { hasCriticalError: ok < routes.length });
  return {
    score,
    details,
    passed: score >= 10,
    teacherTip: safeStage.teacherTip || ''
  };
}

export function computeAvStudioScore3D(metrics = {}) {
  const m = metrics && typeof metrics === 'object' ? metrics : {};
  const chroma = Math.max(0, Math.min(100, toSafeNumber(m.chromaUniformity, 0)));
  const chromaOk = chroma >= 80;
  const lightPts = chromaOk ? 5.5 : (chroma / 100) * 4.5;

  const kelvin = toSafeNumber(m.kelvin, 3200);
  const kelvinDiff = Math.abs(kelvin - 5600);
  const wbOk = kelvinDiff <= 350;
  const wbPts = wbOk ? 2.5 : Math.max(0, 2 - kelvinDiff / 1200);

  const focus = Math.max(0, Math.min(100, toSafeNumber(m.focusSharpness, 0)));
  const focusOk = focus >= 80;
  const irisOk = Boolean(m.irisOk);
  const focusPts = focusOk ? 3.5 : (focus / 100) * 3.5;
  const irisPts = irisOk ? 2.5 : 0.8;

  const phantom48v = Boolean(m.phantom48v);
  const highPass80 = Boolean(m.highPass80);
  const db = toSafeNumber(m.audioMasterDb, -32);
  const dbOk = db >= -15.5 && db <= -8.5;
  const p48Pts = phantom48v ? 1.5 : 0;
  const hpfPts = highPass80 ? 1.5 : 0;
  const dbPts = dbOk ? 3.0 : db >= -19 && db <= -5 ? 1.5 : 0;

  const allConsignesMet = chromaOk && wbOk && focusOk && irisOk && phantom48v && highPass80 && dbOk;
  const elapsed = Math.max(0, toSafeNumber(m.elapsedSec, 120));
  const bonus = allConsignesMet ? 0 : elapsed <= 300 ? 1 : elapsed <= 450 ? 0.5 : 0;

  const rawScore = allConsignesMet
    ? 20
    : Math.min(20, lightPts + wbPts + focusPts + irisPts + p48Pts + hpfPts + dbPts + bonus);
  const score = allConsignesMet ? 20 : finalizeGrade20(rawScore, { hasCriticalError: !allConsignesMet });
  const xp = Math.max(0, Math.round(score * 16 + (score >= 16 ? 70 : 0)));

  const breakdown = createGradeBreakdown({
    items: [
      { label: `Uniformité fond vert (${Math.round(chroma)}%)`, earned: lightPts, max: 5.5 },
      { label: `Balance des blancs (${Math.round(kelvin)}K)`, earned: wbPts, max: 2.5 },
      { label: `Netteté Focus (${Math.round(focus)}%)`, earned: focusPts, max: 3.5 },
      { label: 'Exposition Iris caméra', earned: irisPts, max: 2.5 },
      { label: 'Alimentation fantôme +48V', earned: p48Pts, max: 1.5 },
      { label: 'Filtre coupe-bas HPF 80 Hz', earned: hpfPts, max: 1.5 },
      { label: `Niveau audio (${db.toFixed(1)} dBFS)`, earned: dbPts, max: 3.0 }
    ],
    bonuses: !allConsignesMet && bonus > 0 ? [{ label: 'Rythme confortable', points: bonus, detail: `${Math.round(elapsed)}s` }] : [],
    rawScore,
    finalScore: score,
    hasCriticalError: !allConsignesMet
  });

  return { score, xp, rawScore, breakdown };
}

export function createAudioVisualGame(api, opts = {}) {
  if (opts && opts.initialStage === 1) {
    return createStudioRegieGame(api);
  }
  return createDmxLightingGame(api);
}
