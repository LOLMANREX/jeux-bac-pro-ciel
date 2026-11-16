import { createDmxLightingGame } from './DmxLightingGame.js';
import { createStudioRegieGame } from './StudioRegieGame.js';

function toFiniteNumber(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function clampScore20(raw) {
  const n = toFiniteNumber(raw, 0);
  return Math.max(0, Math.min(20, Math.round(n * 2) / 2));
}

export const AV_STAGES = [
  {
    id: 1,
    name: '1. Plateau Caméra & Éclairage DMX',
    brief:
      'Préparez le plateau fond vert : calibrez la balance des blancs à 5600K (lumière du jour), réglez le projecteur Key DMX entre 70% et 85% et activez l’éclairage uniforme du fond vert.',
    teacherTip:
      'Professeur CIEL : Calibrez la caméra sur 5600K (lumière du jour), ajustez le Key Light DMX entre 70% et 85% et allumez le rétro-éclairage du cyclorama fond vert.',
    kind: 'lighting',
    targetKelvin: 5600,
    kelvinTol: 200,
    minKeyDimmer: 70,
    maxKeyDimmer: 85
  },
  {
    id: 2,
    name: '2. Console Audio & Cabines Studio',
    brief:
      'En régie audio, activez l’alimentation fantôme +48V pour le micro statique XLR, le filtre coupe-bas 80 Hz et ajustez le gain pour obtenir un niveau nominal entre -14 et -10 dBFS.',
    teacherTip:
      'Professeur CIEL : Un microphone statique XLR nécessite impérativement le +48V fantôme ! Activez aussi le filtre coupe-bas 80 Hz et stabilisez la modulation entre -14 et -10 dBFS.',
    kind: 'audio',
    minDb: -14,
    maxDb: -10
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
    const kelvin = toFiniteNumber(safeState.kelvin, 3200);
    const keyDimmer = toFiniteNumber(safeState.keyDimmer, 0);
    const targetKelvin = toFiniteNumber(safeStage.targetKelvin, 5600);
    const kelvinTol = toFiniteNumber(safeStage.kelvinTol, 200);
    const minKeyDimmer = toFiniteNumber(safeStage.minKeyDimmer, 70);
    const maxKeyDimmer = toFiniteNumber(safeStage.maxKeyDimmer, 85);

    const kelvinOk = Math.abs(kelvin - targetKelvin) <= kelvinTol;
    const dimmerOk = keyDimmer >= minKeyDimmer && keyDimmer <= maxKeyDimmer;
    const chromaOk = Boolean(safeState.chromaBacklight);

    if (kelvinOk) pts += 1;
    else details.push(`Balance des blancs à ${kelvin}K (cible ${targetKelvin}K ±${kelvinTol}K)`);
    if (dimmerOk) pts += 1;
    else details.push(`Intensité Key Light à ${keyDimmer}% (cible ${minKeyDimmer}-${maxKeyDimmer}%)`);
    if (chromaOk) pts += 1;
    else details.push('Éclairage fond vert désactivé (ombres portées détectées)');

    const score = Math.max(0, Math.min(20, Math.round((pts / 3) * 20)));
    return {
      score,
      details,
      passed: score >= 13,
      teacherTip: safeStage.teacherTip || ''
    };
  }

  if (safeStage.kind === 'audio') {
    let pts = 0;
    const gain = toFiniteNumber(safeState.gain, 0);
    const db =
      safeState.db !== undefined && Number.isFinite(Number(safeState.db))
        ? Number(safeState.db)
        : -32 + gain * 0.4;
    const minDb = toFiniteNumber(safeStage.minDb, -14);
    const maxDb = toFiniteNumber(safeStage.maxDb, -10);

    if (safeState.phantom48v) pts += 1;
    else details.push('Alimentation fantôme +48V désactivée : micro statique muet');
    if (safeState.highPass80) pts += 1;
    else details.push('Filtre coupe-bas 80 Hz inactif (bruits de manipulation présents)');
    if (db >= minDb && db <= maxDb) pts += 1;
    else details.push(`Niveau crête à ${db.toFixed(1)} dBFS (cible ${minDb} à ${maxDb} dBFS)`);

    const score = Math.max(0, Math.min(20, Math.round((pts / 3) * 20)));
    return {
      score,
      details,
      passed: score >= 13,
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
  const score = Math.max(0, Math.min(20, Math.round((ok / routes.length) * 20)));
  return {
    score,
    details,
    passed: score >= 13,
    teacherTip: safeStage.teacherTip || ''
  };
}

export function computeAvStudioScore3D(metrics = {}) {
  const m = metrics && typeof metrics === 'object' ? metrics : {};
  const chroma = Math.max(0, Math.min(100, toFiniteNumber(m.chromaUniformity, 0)));
  const chromaOk = chroma >= 85;
  const lightPts = chromaOk ? 5.5 : (chroma / 100) * 4.5;

  const kelvin = toFiniteNumber(m.kelvin, 3200);
  const kelvinDiff = Math.abs(kelvin - 5600);
  const wbOk = kelvinDiff <= 250;
  const wbPts = wbOk ? 2.5 : Math.max(0, 2 - kelvinDiff / 1200);

  const focus = Math.max(0, Math.min(100, toFiniteNumber(m.focusSharpness, 0)));
  const focusOk = focus >= 85;
  const irisOk = Boolean(m.irisOk);
  const camPts = (focusOk ? 3.5 : (focus / 100) * 3.5) + (irisOk ? 2.5 : 0.8);

  let audioPts = 0;
  if (m.phantom48v) audioPts += 1.5;
  if (m.highPass80) audioPts += 1.5;
  const db = toFiniteNumber(m.audioMasterDb, -32);
  const dbOk = db >= -14.5 && db <= -9.5;
  if (dbOk) audioPts += 3;
  else if (db >= -18 && db <= -6) audioPts += 1.5;

  const allConsignesMet = chromaOk && wbOk && focusOk && irisOk && Boolean(m.phantom48v) && Boolean(m.highPass80) && dbOk;
  const elapsed = Math.max(0, toFiniteNumber(m.elapsedSec, 120));
  const bonus = allConsignesMet ? 0 : elapsed < 120 ? 1 : elapsed < 180 ? 0.5 : 0;

  const raw = allConsignesMet ? 20 : lightPts + wbPts + camPts + audioPts + bonus;
  const score = clampScore20(raw);
  const xp = Math.max(0, Math.round(score * 16 + (score >= 16 ? 70 : 0)));
  return { score, xp };
}

export function createAudioVisualGame(api, opts = {}) {
  if (opts && opts.initialStage === 1) {
    return createStudioRegieGame(api);
  }
  return createDmxLightingGame(api);
}
