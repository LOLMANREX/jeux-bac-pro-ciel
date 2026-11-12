import { sfx } from '../core/audio.js';

export const AV_STAGES = [
  {
    id: 1,
    name: '1. Plateau Caméra & Éclairage DMX (U303)',
    brief:
      'Préparez le plateau fond vert U303 : calibrez la balance des blancs à 5600K (lumière du jour), réglez le projecteur Key DMX entre 70% et 85% et activez l’éclairage uniforme du fond vert.',
    kind: 'lighting',
    targetKelvin: 5600,
    kelvinTol: 200,
    minKeyDimmer: 70,
    maxKeyDimmer: 85
  },
  {
    id: 2,
    name: '2. Console Audio & Cabines Studio (U304)',
    brief:
      'En régie audio U304, activez l’alimentation fantôme +48V pour le micro statique XLR, le filtre coupe-bas 80 Hz et ajustez le gain pour obtenir un niveau nominal entre -14 et -10 dBFS.',
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

export function createAudioVisualGame(api, opts = {}) {
  const root = document.createElement('div');
  root.className = 'av-game-root';

  let activeStageIdx = Math.max(0, Math.min(AV_STAGES.length - 1, opts.initialStage ?? 0));
  const stageStates = [
    { kelvin: 3200, keyDimmer: 45, chromaBacklight: false, score: null },
    { gain: 30, phantom48v: false, highPass80: false, score: null },
    { routing: {}, score: null }
  ];

  function syncTabs() {
    api.setStages(
      AV_STAGES.map((st, idx) => ({
        name: st.name,
        score: stageStates[idx].score
      })),
      activeStageIdx,
      (idx) => {
        activeStageIdx = idx;
        render();
      }
    );
  }

  function validate() {
    const stage = AV_STAGES[activeStageIdx];
    const state = stageStates[activeStageIdx];
    const res = evaluateAvStage(stage, state);
    state.score = res.score;
    if (res.passed) sfx.success();
    else sfx.error();
    syncTabs();

    const nextPending = stageStates.findIndex((s, i) => i !== activeStageIdx && s.score === null);
    if (res.passed && nextPending >= 0) {
      activeStageIdx = nextPending;
      render();
      return;
    }

    const done = stageStates.map((s) => s.score).filter((s) => s !== null);
    if (done.length === AV_STAGES.length) {
      const avg = Math.round(done.reduce((a, b) => a + b, 0) / done.length);
      api.finishTp(
        avg,
        `
          <p>Validation des pôles audiovisuels <strong>U303 & U304</strong> :</p>
          <ul>
            ${AV_STAGES.map((s, i) => `<li><strong>${s.name}</strong> : ${stageStates[i].score}/20</li>`).join('')}
          </ul>
        `
      );
      return;
    }
    render(res);
  }

  function render(lastEval = null) {
    const stage = AV_STAGES[activeStageIdx];
    const state = stageStates[activeStageIdx];
    let bodyHtml = '';

    if (stage.kind === 'lighting') {
      const chromaPreview = state.chromaBacklight ? '#10b981' : '#065f46';
      const tint = state.kelvin < 4500 ? 'rgba(245,158,11,0.18)' : state.kelvin > 6200 ? 'rgba(56,189,248,0.18)' : 'rgba(255,255,255,0.06)';
      bodyHtml = `
        <div class="av-preview-box" style="background:${chromaPreview}; box-shadow: inset 0 0 40px ${tint}">
          <span>Plateau U303 • ${state.kelvin}K • Key ${state.keyDimmer}%</span>
        </div>
        <div class="av-controls">
          <label>Balance des blancs caméra : <strong>${state.kelvin} K</strong>
            <input type="range" id="av-kelvin" min="3000" max="7000" step="100" value="${state.kelvin}" />
          </label>
          <label>Variateur DMX Key Light : <strong>${state.keyDimmer}%</strong>
            <input type="range" id="av-dimmer" min="10" max="100" step="5" value="${state.keyDimmer}" />
          </label>
          <button class="mg-btn ${state.chromaBacklight ? 'ok' : ''}" id="av-chroma-btn">
            ${state.chromaBacklight ? '✅ Projecteurs Fond Vert actifs' : '🟩 Activer éclairage uniforme Fond Vert'}
          </button>
        </div>
      `;
    } else if (stage.kind === 'audio') {
      const db = -32 + state.gain * 0.4;
      const pct = Math.max(4, Math.min(100, ((db + 36) / 36) * 100));
      const meterColor = db > -6 ? '#ef4444' : db >= -14 && db <= -10 ? '#10b981' : '#f59e0b';
      bodyHtml = `
        <div class="av-vu-wrap">
          <div class="av-vu-bar"><div class="av-vu-fill" style="width:${pct}%; background:${meterColor}"></div></div>
          <span class="av-vu-readout">${state.phantom48v ? `${db.toFixed(1)} dBFS` : '-∞ dBFS (Micro sans +48V)'}</span>
        </div>
        <div class="av-controls">
          <label>Gain Préampli XLR : <strong>${state.gain}</strong>
            <input type="range" id="av-gain" min="0" max="80" step="1" value="${state.gain}" />
          </label>
          <div class="av-toggles">
            <button class="mg-btn ${state.phantom48v ? 'ok' : ''}" id="av-48v-btn">
              ${state.phantom48v ? '✅ Alimentation +48V Active' : '🎙 Activer +48V Fantôme'}
            </button>
            <button class="mg-btn ${state.highPass80 ? 'ok' : ''}" id="av-hp-btn">
              ${state.highPass80 ? '✅ Coupe-bas 80 Hz Actif' : '🎛 Activer Filtre Coupe-bas 80 Hz'}
            </button>
          </div>
        </div>
      `;
    } else {
      bodyHtml = `
        <div class="av-matrix">
          ${stage.routes
            .map(
              (r) => `
            <div class="av-matrix-row">
              <strong>${r.label}</strong>
              <div class="av-matrix-sources">
                ${stage.sources
                  .map(
                    (src) => `
                  <button class="mg-btn ${state.routing[r.id] === src.id ? 'active' : ''}" data-out="${r.id}" data-src="${src.id}">
                    ${src.label}
                  </button>
                `
                  )
                  .join('')}
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `;
    }

    root.innerHTML = `
      <div class="mg-card">
        <p class="patch-brief">${stage.brief}</p>
        ${bodyHtml}
        ${
          lastEval
            ? `<div class="patch-eval ${lastEval.passed ? 'pass' : 'fail'}">
                <strong>Score étape : ${lastEval.score}/20</strong>
                ${lastEval.details.length ? `<ul>${lastEval.details.map((d) => `<li>${d}</li>`).join('')}</ul>` : '<span> Configuration audiovisuelle conforme !</span>'}
              </div>`
            : ''
        }
        <div class="patch-actions">
          <button class="mg-btn mg-primary" id="btn-av-validate">Valider l’étape régie</button>
        </div>
      </div>
    `;

    root.querySelector('#av-kelvin')?.addEventListener('input', (e) => {
      state.kelvin = Number(e.target.value);
      render();
    });
    root.querySelector('#av-dimmer')?.addEventListener('input', (e) => {
      state.keyDimmer = Number(e.target.value);
      render();
    });
    root.querySelector('#av-chroma-btn')?.addEventListener('click', () => {
      state.chromaBacklight = !state.chromaBacklight;
      sfx.click();
      render();
    });
    root.querySelector('#av-gain')?.addEventListener('input', (e) => {
      state.gain = Number(e.target.value);
      render();
    });
    root.querySelector('#av-48v-btn')?.addEventListener('click', () => {
      state.phantom48v = !state.phantom48v;
      sfx.click();
      render();
    });
    root.querySelector('#av-hp-btn')?.addEventListener('click', () => {
      state.highPass80 = !state.highPass80;
      sfx.click();
      render();
    });
    root.querySelectorAll('[data-out]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.routing[btn.dataset.out] = btn.dataset.src;
        sfx.click();
        render();
      });
    });
    root.querySelector('#btn-av-validate')?.addEventListener('click', validate);
  }

  syncTabs();
  render();
  api.container.appendChild(root);

  return {
    destroy() {
      root.remove();
    }
  };
}
