import { createDmxLightingGame } from './DmxLightingGame.js';
import { createStudioRegieGame } from './StudioRegieGame.js';

export const AV_STAGES = [
  {
    id: 1,
    name: '1. Plateau Caméra & Éclairage DMX',
    brief:
      'Préparez le plateau fond vert : calibrez la balance des blancs à 5600K (lumière du jour), réglez le projecteur Key DMX entre 70% et 85% et activez l’éclairage uniforme du fond vert.',
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
    kind: 'audio',
    minDb: -14,
    maxDb: -10
  },
  {
    id: 3,
    name: '3. Matrice SDI / NDI Régie',
    brief:
      'Routez les sources vidéo/audio vers les sorties de la régie centrale : Caméra A -> Live PGM, Caméra B -> Enregistreur SSD, Slides HDMI PC -> Écran Retour Plateau.',
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

export function evaluateAvStage(stage, state) {
  const details = [];
  if (stage.kind === 'lighting') {
    let pts = 0;
    const kelvinOk = Math.abs((state.kelvin ?? 3200) - stage.targetKelvin) <= stage.kelvinTol;
    const dimmerOk = state.keyDimmer >= stage.minKeyDimmer && state.keyDimmer <= stage.maxKeyDimmer;
    const chromaOk = Boolean(state.chromaBacklight);
    if (kelvinOk) pts += 1;
    else details.push(`Balance des blancs à ${state.kelvin}K (cible ${stage.targetKelvin}K ±${stage.kelvinTol}K)`);
    if (dimmerOk) pts += 1;
    else details.push(`Intensité Key Light à ${state.keyDimmer}% (cible ${stage.minKeyDimmer}-${stage.maxKeyDimmer}%)`);
    if (chromaOk) pts += 1;
    else details.push('Éclairage fond vert désactivé (ombres portées détectées)');
    const score = Math.round((pts / 3) * 20);
    return { score, details, passed: score >= 13 };
  }

  if (stage.kind === 'audio') {
    let pts = 0;
    const db = -32 + (state.gain ?? 0) * 0.4;
    if (state.phantom48v) pts += 1;
    else details.push('Alimentation fantôme +48V désactivée : micro statique muet');
    if (state.highPass80) pts += 1;
    else details.push('Filtre coupe-bas 80 Hz inactif (bruits de manipulation présents)');
    if (db >= stage.minDb && db <= stage.maxDb) pts += 1;
    else details.push(`Niveau crête à ${db.toFixed(1)} dBFS (cible ${stage.minDb} à ${stage.maxDb} dBFS)`);
    const score = Math.round((pts / 3) * 20);
    return { score, details, passed: score >= 13 };
  }

  let ok = 0;
  const routing = state.routing || {};
  for (const r of stage.routes) {
    if (routing[r.id] === r.expected) ok += 1;
    else details.push(`${r.label} : source routée incorrecte`);
  }
  const score = Math.round((ok / stage.routes.length) * 20);
  return { score, details, passed: score >= 13 };
}

export function computeAvStudioScore3D(metrics = {}) {
  const chroma = Math.max(0, Math.min(100, metrics.chromaUniformity ?? 0));
  const lightPts = chroma >= 85 ? 5 : (chroma / 100) * 4.5;
  const kelvinDiff = Math.abs((metrics.kelvin ?? 3200) - 5600);
  const wbPts = kelvinDiff <= 250 ? 2 : Math.max(0, 2 - kelvinDiff / 1200);

  const focus = Math.max(0, Math.min(100, metrics.focusSharpness ?? 0));
  const camPts = (focus / 100) * 3.5 + (metrics.irisOk ? 2.5 : 0.8);

  let audioPts = 0;
  if (metrics.phantom48v) audioPts += 1.5;
  if (metrics.highPass80) audioPts += 1.5;
  const db = metrics.audioMasterDb ?? -32;
  if (db >= -14 && db <= -10) audioPts += 3;
  else if (db >= -18 && db <= -6) audioPts += 1.5;

  const elapsed = metrics.elapsedSec ?? 120;
  const bonus = elapsed < 120 ? 1 : elapsed < 180 ? 0.5 : 0;
  const score = Math.max(0, Math.min(20, Math.round((lightPts + wbPts + camPts + audioPts + bonus) * 2) / 2));
  const xp = Math.round(score * 16 + (score >= 16 ? 70 : 0));
  return { score, xp };
}

export function createAudioVisualGame(api, opts = {}) {
  if (opts.initialStage === 1) {
    return createStudioRegieGame(api);
  }
  return createDmxLightingGame(api);
}
