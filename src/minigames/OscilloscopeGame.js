import { sfx } from '../core/audio.js';

export const OSCILLO_STAGES = [
  {
    id: 1,
    name: '1. Signal Sinusoïdal',
    brief:
      'Stabilisez le signal sinusoïdal du GBF grâce au Trigger, réglez V/div et ms/div pour afficher 2 à 5 périodes propres, puis mesurez sa fréquence et sa tension crête-à-crête (Upp).',
    signalType: 'sine',
    freqHz: 1000, // T = 1 ms
    uppV: 6.0, // +/- 3V
    dcOffsetV: 0,
    dutyCycle: 50,
    requireCoupling: 'DC',
    needCh2: false,
    questionType: 'freq_upp',
    hint: 'La période T vaut 1 ms (= 1 division si Base de temps = 1 ms/div). f = 1/T = 1000 Hz, Upp = 6 V.'
  },
  {
    id: 2,
    name: '2. Signal PWM (Microcontrôleur)',
    brief:
      'Mesurez ce signal logique PWM 0–5V issu d’un ESP32. Restez en couplage DC, verrouillez le Trigger entre 1V et 4V, puis relevez la fréquence et le rapport cyclique (%).',
    signalType: 'pwm',
    freqHz: 500, // T = 2 ms
    uppV: 5.0, // 0V to 5V
    dcOffsetV: 2.5,
    dutyCycle: 25,
    requireCoupling: 'DC',
    needCh2: false,
    questionType: 'pwm',
    hint: 'En DC, un PWM 0–5V oscille autour de +2.5V. Placez le Trigger vers +2.0V. 1 période = 2 ms => 500 Hz, état haut = 0.5 ms => 25%.'
  },
  {
    id: 3,
    name: '3. Diagnostic Dual-Trace (CH1/CH2)',
    brief:
      'Activez le canal CH2 pour comparer l’entrée (CH1) et la sortie filtrée (CH2). Mesurez l’ondulation résiduelle sur CH2 et posez le bon diagnostic de panne.',
    signalType: 'ripple',
    freqHz: 100, // T = 10 ms
    uppV: 10.0,
    dcOffsetV: 0,
    dutyCycle: 50,
    ch2RippleV: 2.4,
    ch2DcV: 5.0,
    requireCoupling: 'DC',
    needCh2: true,
    questionType: 'diagnostic',
    correctDiag: 'cap_fault',
    hint: 'Activez CH2, réglez la base de temps sur 5 ms/div. La sortie redressée présente une forte ondulation de 2.4V : le condensateur de filtrage est HS !'
  }
];

export function evaluateOscilloscopeStage(stage, controls, answers) {
  const periodSec = 1 / stage.freqHz;
  const visibleTimeSec = controls.timePerDivMs * 1e-3 * 10;
  const visiblePeriods = visibleTimeSec / periodSec;
  const totalVoltsSpan = controls.vPerDiv * 8;
  const signalHeightRatio = stage.uppV / totalVoltsSpan;

  // Trigger lock check
  const minV = stage.signalType === 'pwm' ? 0 : -stage.uppV / 2;
  const maxV = stage.signalType === 'pwm' ? stage.uppV : stage.uppV / 2;
  const effectiveMin = controls.coupling === 'AC' ? -stage.uppV / 2 : minV;
  const effectiveMax = controls.coupling === 'AC' ? stage.uppV / 2 : maxV;

  const triggerLocked =
    controls.triggerLevel > effectiveMin + 0.25 &&
    controls.triggerLevel < effectiveMax - 0.25;

  const couplingOk = !stage.requireCoupling || controls.coupling === stage.requireCoupling;
  const ch2Ok = !stage.needCh2 || controls.ch2Enabled;
  const framingOk = visiblePeriods >= 1.2 && visiblePeriods <= 6.5 && signalHeightRatio >= 0.3 && signalHeightRatio <= 0.96;

  const issues = [];
  if (!triggerLocked) issues.push('Le Trigger ne coupe pas le signal (courbe instable).');
  if (!couplingOk) issues.push(`Le couplage doit être sur ${stage.requireCoupling} pour une mesure fidèle.`);
  if (!ch2Ok) issues.push('Activez le canal CH2 pour observer la sortie.');
  if (!framingOk) issues.push('Ajustez Base de temps / V/div pour bien cadrer 2 à 5 périodes.');

  // Answers check
  let answerScore = 0;
  if (stage.questionType === 'freq_upp') {
    const fErr = Math.abs(Number(answers.freq) - stage.freqHz) / stage.freqHz;
    const uErr = Math.abs(Number(answers.upp) - stage.uppV) / stage.uppV;
    if (fErr <= 0.08) answerScore += 0.5;
    else issues.push(`Fréquence inexacte (attendu ~${stage.freqHz} Hz).`);
    if (uErr <= 0.1) answerScore += 0.5;
    else issues.push(`Amplitude Upp inexacte (attendu ~${stage.uppV} V).`);
  } else if (stage.questionType === 'pwm') {
    const fErr = Math.abs(Number(answers.freq) - stage.freqHz) / stage.freqHz;
    const dErr = Math.abs(Number(answers.duty) - stage.dutyCycle);
    if (fErr <= 0.08) answerScore += 0.5;
    else issues.push(`Fréquence PWM inexacte (attendu ${stage.freqHz} Hz).`);
    if (dErr <= 4) answerScore += 0.5;
    else issues.push(`Rapport cyclique inexact (attendu ${stage.dutyCycle}%).`);
  } else if (stage.questionType === 'diagnostic') {
    const rErr = Math.abs(Number(answers.ripple) - stage.ch2RippleV);
    if (rErr <= 0.4) answerScore += 0.45;
    else issues.push(`Ondulation ΔU sur CH2 inexacte (attendu ~${stage.ch2RippleV} V).`);
    if (answers.diag === stage.correctDiag) answerScore += 0.55;
    else issues.push('Diagnostic de panne incorrect sur CH2.');
  }

  let calibScore = 0;
  if (triggerLocked) calibScore += 0.35;
  if (couplingOk) calibScore += 0.2;
  if (ch2Ok) calibScore += 0.15;
  if (framingOk) calibScore += 0.3;

  const totalRatio = calibScore * 0.45 + answerScore * 0.55;
  return {
    passed: issues.length === 0,
    ratio: totalRatio,
    triggerLocked,
    issues
  };
}

export function createOscilloscopeGame(api) {
  let currentStageIdx = 0;
  const stageScores = [0, 0, 0];
  let hintsUsed = 0;
  let animId = null;
  let driftPhase = 0;

  const controls = {
    vPerDiv: 2,
    timePerDivMs: 1,
    triggerLevel: 4.5, // intentionally unlocked at start!
    coupling: 'DC',
    ch2Enabled: false,
    ch2VPerDiv: 2,
    cursorsOn: true,
    cursorX1: 0.25,
    cursorX2: 0.45
  };

  function render() {
    const stage = OSCILLO_STAGES[currentStageIdx];
    api.setStages(
      OSCILLO_STAGES.map((s, i) => (stageScores[i] > 0 ? `✅ ${s.name}` : s.name)),
      currentStageIdx,
      (idx) => {
        currentStageIdx = idx;
        resetControlsForStage(OSCILLO_STAGES[idx]);
        render();
      }
    );

    api.container.innerHTML = `
      <div class="mg-grid-2">
        <div class="scope-left">
          <div class="mg-brief">${stage.brief}</div>
          <div class="scope-screen-wrap">
            <canvas id="scope-canvas" width="660" height="400"></canvas>
            <div class="scope-overlay-readout" id="scope-readout"></div>
          </div>
          <div class="scope-cursors-bar">
            <label><input type="checkbox" id="sc-cursors" ${controls.cursorsOn ? 'checked' : ''} /> Curseurs de mesure Δt / ΔV</label>
            <div class="cursor-sliders ${controls.cursorsOn ? '' : 'hidden'}" id="cursor-sliders">
              <span>C1</span><input id="sc-c1" type="range" min="0.05" max="0.95" step="0.01" value="${controls.cursorX1}" />
              <span>C2</span><input id="sc-c2" type="range" min="0.05" max="0.95" step="0.01" value="${controls.cursorX2}" />
            </div>
          </div>
        </div>

        <div class="scope-right">
          <div class="panel-box">
            <h4>🎛️ Réglages Oscilloscope</h4>
            <div class="ctrl-row">
              <label>Sensibilité CH1 (V/div)</label>
              <div class="btn-group" id="vdiv-group">
                ${[0.5, 1, 2, 5]
                  .map(
                    (v) =>
                      `<button type="button" class="btn-chip ${controls.vPerDiv === v ? 'active' : ''}" data-v="${v}">${v} V</button>`
                  )
                  .join('')}
              </div>
            </div>
            <div class="ctrl-row">
              <label>Base de temps (ms/div)</label>
              <div class="btn-group" id="tdiv-group">
                ${[0.2, 0.5, 1, 2, 5]
                  .map(
                    (t) =>
                      `<button type="button" class="btn-chip ${controls.timePerDivMs === t ? 'active' : ''}" data-t="${t}">${t} ms</button>`
                  )
                  .join('')}
              </div>
            </div>
            <div class="ctrl-row">
              <label>Couplage d'entrée</label>
              <div class="btn-group" id="coupling-group">
                ${['DC', 'AC']
                  .map(
                    (c) =>
                      `<button type="button" class="btn-chip ${controls.coupling === c ? 'active' : ''}" data-c="${c}">${c}</button>`
                  )
                  .join('')}
              </div>
            </div>
            <div class="ctrl-row">
              <label>Niveau Trigger : <strong id="trig-val">${controls.triggerLevel.toFixed(1)} V</strong></label>
              <input id="sc-trigger" type="range" min="-6" max="6" step="0.2" value="${controls.triggerLevel}" />
            </div>
            <div class="ctrl-row inline">
              <label><input type="checkbox" id="sc-ch2" ${controls.ch2Enabled ? 'checked' : ''} /> Activer Canal CH2 (Sortie)</label>
            </div>
          </div>

          <div class="panel-box">
            <h4>📏 Relevé de Mesures</h4>
            ${renderQuestionFields(stage)}
            <div id="sc-feedback" class="mg-feedback hidden"></div>
            <div class="panel-actions">
              <button type="button" id="sc-hint-btn" class="btn-hud btn-sm">💡 Indice Prof</button>
              <button type="button" id="sc-validate-btn" class="btn-primary">Valider la mesure ▶</button>
            </div>
          </div>
        </div>
      </div>
    `;

    bindEvents(stage);
  }

  function resetControlsForStage(stage) {
    controls.triggerLevel = stage.id === 1 ? 4.5 : stage.id === 2 ? -2.0 : 5.6;
    controls.coupling = stage.id === 2 ? 'AC' : 'DC';
    controls.ch2Enabled = false;
    controls.vPerDiv = 2;
    controls.timePerDivMs = stage.id === 3 ? 1 : 2;
  }

  function renderQuestionFields(stage) {
    if (stage.questionType === 'freq_upp') {
      return `
        <div class="field-row">
          <label for="ans-freq">Fréquence mesurée (Hz)</label>
          <input id="ans-freq" type="number" placeholder="Ex: 1000" />
        </div>
        <div class="field-row">
          <label for="ans-upp">Amplitude crête-à-crête Upp (V)</label>
          <input id="ans-upp" type="number" step="0.1" placeholder="Ex: 6.0" />
        </div>
      `;
    }
    if (stage.questionType === 'pwm') {
      return `
        <div class="field-row">
          <label for="ans-freq">Fréquence PWM (Hz)</label>
          <input id="ans-freq" type="number" placeholder="Ex: 500" />
        </div>
        <div class="field-row">
          <label for="ans-duty">Rapport cyclique (%)</label>
          <input id="ans-duty" type="number" placeholder="Ex: 25" />
        </div>
      `;
    }
    return `
      <div class="field-row">
        <label for="ans-ripple">Ondulation mesurée sur CH2 ΔU (V)</label>
        <input id="ans-ripple" type="number" step="0.1" placeholder="Ex: 2.4" />
      </div>
      <div class="field-row">
        <label for="ans-diag">Diagnostic de panne</label>
        <select id="ans-diag">
          <option value="">-- Choisir un diagnostic --</option>
          <option value="ok">Circuit nominal (aucune panne)</option>
          <option value="cap_fault">Condensateur de filtrage défectueux (forte ondulation)</option>
          <option value="short">Court-circuit franc à la masse (0 V)</option>
        </select>
      </div>
    `;
  }

  function bindEvents(stage) {
    document.querySelectorAll('#vdiv-group .btn-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        sfx.click();
        controls.vPerDiv = Number(btn.dataset.v);
        document.querySelectorAll('#vdiv-group .btn-chip').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    document.querySelectorAll('#tdiv-group .btn-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        sfx.click();
        controls.timePerDivMs = Number(btn.dataset.t);
        document.querySelectorAll('#tdiv-group .btn-chip').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    document.querySelectorAll('#coupling-group .btn-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        sfx.click();
        controls.coupling = btn.dataset.c;
        document.querySelectorAll('#coupling-group .btn-chip').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    const trigInput = document.getElementById('sc-trigger');
    const trigLabel = document.getElementById('trig-val');
    trigInput?.addEventListener('input', () => {
      controls.triggerLevel = Number(trigInput.value);
      trigLabel.textContent = `${controls.triggerLevel.toFixed(1)} V`;
    });

    document.getElementById('sc-ch2')?.addEventListener('change', (e) => {
      sfx.click();
      controls.ch2Enabled = e.target.checked;
    });

    document.getElementById('sc-cursors')?.addEventListener('change', (e) => {
      controls.cursorsOn = e.target.checked;
      document.getElementById('cursor-sliders')?.classList.toggle('hidden', !controls.cursorsOn);
    });
    document.getElementById('sc-c1')?.addEventListener('input', (e) => {
      controls.cursorX1 = Number(e.target.value);
    });
    document.getElementById('sc-c2')?.addEventListener('input', (e) => {
      controls.cursorX2 = Number(e.target.value);
    });

    const fb = document.getElementById('sc-feedback');
    document.getElementById('sc-hint-btn')?.addEventListener('click', () => {
      sfx.interact();
      hintsUsed++;
      fb.className = 'mg-feedback info';
      fb.textContent = `👨‍🏫 Professeur CIEL : ${stage.hint}`;
    });

    document.getElementById('sc-validate-btn')?.addEventListener('click', () => {
      const answers = {
        freq: document.getElementById('ans-freq')?.value,
        upp: document.getElementById('ans-upp')?.value,
        duty: document.getElementById('ans-duty')?.value,
        ripple: document.getElementById('ans-ripple')?.value,
        diag: document.getElementById('ans-diag')?.value
      };

      const res = evaluateOscilloscopeStage(stage, controls, answers);
      if (res.passed) {
        sfx.success();
        stageScores[currentStageIdx] = Math.max(0.5, 1 - hintsUsed * 0.06);
        fb.className = 'mg-feedback pass';
        fb.innerHTML = '✅ Mesure et réglages parfaits !';

        if (currentStageIdx < OSCILLO_STAGES.length - 1) {
          setTimeout(() => {
            currentStageIdx++;
            resetControlsForStage(OSCILLO_STAGES[currentStageIdx]);
            render();
          }, 850);
        } else {
          const avg = stageScores.reduce((a, b) => a + b, 0) / OSCILLO_STAGES.length;
          const finalGrade = Math.min(20, Math.max(10, avg * 20));
          api.finishTp(
            finalGrade,
            `<ul>
              <li>✅ Signal sinusoïdal calibré et mesuré (1 kHz / 6 Upp)</li>
              <li>✅ Signal PWM analysé en couplage DC (500 Hz / 25%)</li>
              <li>✅ Diagnostic Dual-Trace CH1/CH2 réussi</li>
            </ul>`
          );
        }
      } else {
        sfx.error();
        fb.className = 'mg-feedback fail';
        fb.innerHTML = res.issues.map((m) => `<div>• ${m}</div>`).join('');
      }
    });
  }

  function sampleWave(stage, tSec, channel = 1) {
    const period = 1 / stage.freqHz;
    if (channel === 1) {
      if (stage.signalType === 'sine') {
        return (stage.uppV / 2) * Math.sin(2 * Math.PI * stage.freqHz * tSec);
      }
      if (stage.signalType === 'pwm') {
        const phase = ((tSec % period) + period) % period;
        const raw = phase < period * (stage.dutyCycle / 100) ? stage.uppV : 0;
        return controls.coupling === 'AC' ? raw - stage.uppV * (stage.dutyCycle / 100) : raw;
      }
      if (stage.signalType === 'ripple') {
        return (stage.uppV / 2) * Math.sin(2 * Math.PI * stage.freqHz * tSec);
      }
    } else if (stage.signalType === 'ripple') {
      // Full-wave rectified + faulty capacitor ripple (2*f)
      const rectPeriod = period / 2;
      const p = (((tSec % rectPeriod) + rectPeriod) % rectPeriod) / rectPeriod;
      const base = stage.ch2DcV + stage.ch2RippleV * (0.5 - p);
      return controls.coupling === 'AC' ? base - stage.ch2DcV : base;
    }
    return 0;
  }

  function drawLoop() {
    animId = requestAnimationFrame(drawLoop);
    const canvas = document.getElementById('scope-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const stage = OSCILLO_STAGES[currentStageIdx];

    // Check trigger lock
    const minV = stage.signalType === 'pwm' && controls.coupling === 'DC' ? 0 : -stage.uppV / 2;
    const maxV = stage.signalType === 'pwm' && controls.coupling === 'DC' ? stage.uppV : stage.uppV / 2;
    const locked =
      controls.triggerLevel > minV + 0.25 && controls.triggerLevel < maxV - 0.25;

    if (!locked) {
      driftPhase += 0.00045;
    } else {
      driftPhase = 0;
    }

    // Background + grid (10x8 divisions)
    ctx.fillStyle = '#031518';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(34, 211, 238, 0.16)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let j = 0; j <= 8; j++) {
      const y = (j / 8) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Center axes
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.38)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();

    const totalTimeSec = controls.timePerDivMs * 1e-3 * 10;
    const pxPerVolt = h / (8 * controls.vPerDiv);
    const vToY = (v) => h / 2 - v * pxPerVolt;

    // Trigger line
    const trigY = vToY(controls.triggerLevel);
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(0, trigY);
    ctx.lineTo(w, trigY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw CH1
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    for (let px = 0; px < w; px++) {
      const t = (px / w) * totalTimeSec + driftPhase;
      const v = sampleWave(stage, t, 1);
      const y = vToY(v);
      px === 0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
    }
    ctx.stroke();

    // Draw CH2 if enabled
    if (controls.ch2Enabled && stage.needCh2) {
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      for (let px = 0; px < w; px++) {
        const t = (px / w) * totalTimeSec + driftPhase;
        const v = sampleWave(stage, t, 2);
        const y = vToY(v);
        px === 0 ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
      }
      ctx.stroke();
    }

    // Cursors
    const readout = document.getElementById('scope-readout');
    if (controls.cursorsOn) {
      const x1 = controls.cursorX1 * w;
      const x2 = controls.cursorX2 * w;
      ctx.strokeStyle = 'rgba(244, 114, 182, 0.85)';
      ctx.lineWidth = 1.5;
      [x1, x2].forEach((cx) => {
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, h);
        ctx.stroke();
      });

      const dtMs = Math.abs(controls.cursorX2 - controls.cursorX1) * controls.timePerDivMs * 10;
      const fEst = dtMs > 0.001 ? (1000 / dtMs).toFixed(0) : '---';
      if (readout) {
        readout.innerHTML = `
          <span class="tag-cyan">CH1: ${controls.vPerDiv} V/div (${controls.coupling})</span>
          <span class="tag-amber">Base: ${controls.timePerDivMs} ms/div</span>
          <span class="${locked ? 'tag-green' : 'tag-red'}">${locked ? 'TRIG: LOCKED' : 'TRIG: UNLOCKED'}</span>
          <span class="tag-pink">Δt=${dtMs.toFixed(2)} ms (${fEst} Hz)</span>
        `;
      }
    } else if (readout) {
      readout.innerHTML = `
        <span class="tag-cyan">CH1: ${controls.vPerDiv} V/div (${controls.coupling})</span>
        <span class="tag-amber">Base: ${controls.timePerDivMs} ms/div</span>
        <span class="${locked ? 'tag-green' : 'tag-red'}">${locked ? 'TRIG: LOCKED' : 'TRIG: UNLOCKED'}</span>
      `;
    }
  }

  render();
  animId = requestAnimationFrame(drawLoop);

  return {
    destroy() {
      if (animId) cancelAnimationFrame(animId);
    }
  };
}
