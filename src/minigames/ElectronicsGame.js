import { sfx } from '../core/audio.js';

export const COLOR_CODES = [
  { name: 'Noir', digit: 0, mult: 1, hex: '#111827' },
  { name: 'Marron', digit: 1, mult: 10, hex: '#78350f' },
  { name: 'Rouge', digit: 2, mult: 100, hex: '#dc2626' },
  { name: 'Orange', digit: 3, mult: 1000, hex: '#f97316' },
  { name: 'Jaune', digit: 4, mult: 10000, hex: '#facc15' },
  { name: 'Vert', digit: 5, mult: 100000, hex: '#16a34a' },
  { name: 'Bleu', digit: 6, mult: 1000000, hex: '#2563eb' },
  { name: 'Violet', digit: 7, mult: 10000000, hex: '#9333ea' },
  { name: 'Gris', digit: 8, mult: null, hex: '#64748b' },
  { name: 'Blanc', digit: 9, mult: null, hex: '#f8fafc' }
];

export function computeResistorOhms(b1, b2, b3MultIdx) {
  const mult = COLOR_CODES[b3MultIdx]?.mult;
  if (!mult) return 0;
  return (b1 * 10 + b2) * mult;
}

export function formatOhms(ohms) {
  if (ohms >= 1000000) return `${(ohms / 1000000).toFixed(2).replace(/\.00$/, '')} MΩ`;
  if (ohms >= 1000) return `${(ohms / 1000).toFixed(2).replace(/\.00$/, '')} kΩ`;
  return `${ohms} Ω`;
}

export function simulateLedCircuit(vcc, ledUf, ohms, ledForwardPolarity) {
  if (!ledForwardPolarity) {
    return { status: 'reversed', currentMa: 0, vLed: 0, message: 'LED polarisée en inverse : aucun courant ne passe (0 mA).' };
  }
  if (ohms <= 0) {
    return { status: 'burned', currentMa: 999, vLed: vcc, message: 'Court-circuit ! Résistance nulle : la LED a grillé instantanément !' };
  }
  const currentMa = ((vcc - ledUf) / ohms) * 1000;
  if (currentMa > 32) {
    return {
      status: 'burned',
      currentMa: Math.round(currentMa * 10) / 10,
      vLed: ledUf,
      message: `Surintensité (${currentMa.toFixed(1)} mA > 30 mA) ! La LED a grillé !`
    };
  }
  if (currentMa < 6) {
    return {
      status: 'dim',
      currentMa: Math.round(currentMa * 10) / 10,
      vLed: ledUf,
      message: `Courant trop faible (${currentMa.toFixed(1)} mA). La LED éclaire à peine (visez 15–22 mA).`
    };
  }
  return {
    status: 'ok',
    currentMa: Math.round(currentMa * 10) / 10,
    vLed: ledUf,
    message: `Circuit nominal ! Courant mesuré : ${currentMa.toFixed(1)} mA — LED allumée !`
  };
}

export function simulateDividerCircuit(vin, r1Ohms, r2Ohms) {
  if (r1Ohms <= 0 || r2Ohms <= 0) return { vout: 0, ok: false, message: 'Résistances invalides.' };
  const vout = vin * (r2Ohms / (r1Ohms + r2Ohms));
  const ok = vout >= 3.1 && vout <= 3.45;
  return {
    vout: Math.round(vout * 100) / 100,
    ok,
    message: ok
      ? `Parfait ! Vout = ${vout.toFixed(2)} V (compatible entrée GPIO 3.3V ESP32).`
      : vout > 3.45
        ? `DANGER : Vout = ${vout.toFixed(2)} V (> 3.45 V) risque de détruire l'ESP32 !`
        : `Vout = ${vout.toFixed(2)} V trop faible pour détecter un niveau logique HAUT.`
  };
}

export const ELEC_STAGES = [
  { id: 1, name: '1. Loi d’Ohm & Code Couleur' },
  { id: 2, name: '2. Pont Diviseur 5V → 3.3V' },
  { id: 3, name: '3. Relais NPN & Roue Libre' }
];

export function createElectronicsGame(api) {
  let stageIdx = 0;
  const stageScores = [0, 0, 0];
  let powerOn = false;

  // Stage 1 state
  let b1 = 1; // Marron (1)
  let b2 = 0; // Noir (0)
  let b3 = 1; // x10 -> 100 ohms initially
  let ledForward = false;

  // Stage 2 state
  let divR1 = 1000;
  let divR2 = 1000;

  // Stage 3 state
  let baseR = 100000;
  let transistorType = 'none'; // 'npn' | 'pnp' | 'none'
  let diodeDir = 'none'; // 'reverse_ok' | 'short' | 'none'
  let relayTested = false;

  function render() {
    api.setStages(
      ELEC_STAGES.map((s, i) => (stageScores[i] > 0 ? `✅ ${s.name}` : s.name)),
      stageIdx,
      (idx) => {
        stageIdx = idx;
        powerOn = false;
        render();
      }
    );

    if (stageIdx === 0) renderStage1();
    else if (stageIdx === 1) renderStage2();
    else renderStage3();
  }

  function renderStage1() {
    const ohms = computeResistorOhms(b1, b2, b3);
    const sim = powerOn ? simulateLedCircuit(12, 2.0, ohms, ledForward) : null;

    api.container.innerHTML = `
      <div class="mg-grid-2">
        <div>
          <div class="mg-brief">
            <strong>Cahier des charges :</strong> Alimentez une LED rouge (<strong>U_f = 2.0 V</strong>,
            <strong>I_cible ≈ 18 à 22 mA</strong>) sous une source de <strong>12 V</strong>.
            Calculez <code>R = (U_alim - U_f) / I</code>, réglez le code couleur 4 anneaux et vérifiez la polarité !
          </div>

          <div class="circuit-board">
            <div class="psu-box">
              <span>⚡ ALIM 12V DC</span>
              <button type="button" id="el-power-btn" class="btn-chip ${powerOn ? 'active' : ''}">
                ${powerOn ? '🟢 SOUS TENSION' : '⚪ HORS TENSION'}
              </button>
            </div>

            <div class="schematic-row">
              <div class="node-pill">+12V</div>
              <div class="wire-line"></div>
              <div class="resistor-visual" title="${formatOhms(ohms)}">
                <span class="band" style="background:${COLOR_CODES[b1].hex}"></span>
                <span class="band" style="background:${COLOR_CODES[b2].hex}"></span>
                <span class="band" style="background:${COLOR_CODES[b3].hex}"></span>
                <span class="band tol" style="background:#ca8a04"></span>
              </div>
              <div class="wire-line"></div>
              <button type="button" id="el-led-flip" class="led-visual ${sim?.status === 'ok' ? 'lit' : sim?.status === 'burned' ? 'burned' : ''}">
                <div class="led-bulb">💡</div>
                <div class="led-pol">${ledForward ? 'Anode (+) → Cathode (-)' : '⚠️ Cathode (-) → Anode (+)'}</div>
                <small>(Cliquer pour inverser)</small>
              </button>
              <div class="wire-line"></div>
              <div class="node-pill">GND (0V)</div>
            </div>

            <div class="multimeter-box">
              <div class="multi-label">📟 MULTIMÈTRE NUMÉRIQUE</div>
              <div class="multi-screen">
                <span>R = ${formatOhms(ohms)}</span>
                <span>I = ${sim ? `${sim.currentMa} mA` : '-- mA'}</span>
                <span>U_LED = ${sim ? `${sim.vLed.toFixed(1)} V` : '-- V'}</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div class="panel-box">
            <h4>🎨 Sélecteur Code Couleur (Résistance : ${formatOhms(ohms)})</h4>
            <div class="ctrl-row">
              <label>1er anneau (Dizaine) : <strong>${COLOR_CODES[b1].name} (${b1})</strong></label>
              <select id="el-b1">${COLOR_CODES.slice(1).map((c) => `<option value="${c.digit}" ${c.digit === b1 ? 'selected' : ''}>${c.digit} — ${c.name}</option>`).join('')}</select>
            </div>
            <div class="ctrl-row">
              <label>2ème anneau (Unité) : <strong>${COLOR_CODES[b2].name} (${b2})</strong></label>
              <select id="el-b2">${COLOR_CODES.map((c) => `<option value="${c.digit}" ${c.digit === b2 ? 'selected' : ''}>${c.digit} — ${c.name}</option>`).join('')}</select>
            </div>
            <div class="ctrl-row">
              <label>3ème anneau (Multiplicateur) : <strong>${COLOR_CODES[b3].name}</strong></label>
              <select id="el-b3">${COLOR_CODES.filter((c) => c.mult).map((c, idx) => `<option value="${idx}" ${idx === b3 ? 'selected' : ''}>× ${formatOhms(c.mult).replace(' Ω', '')} — ${c.name}</option>`).join('')}</select>
            </div>
            <div id="el-feedback" class="mg-feedback ${sim ? (sim.status === 'ok' ? 'pass' : 'fail') : 'hidden'}">
              ${sim ? sim.message : ''}
            </div>
            <div class="panel-actions">
              <button type="button" id="el-validate-btn" class="btn-primary">Valider le montage ▶</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('el-power-btn')?.addEventListener('click', () => {
      sfx.click();
      powerOn = !powerOn;
      renderStage1();
    });
    document.getElementById('el-led-flip')?.addEventListener('click', () => {
      sfx.click();
      ledForward = !ledForward;
      renderStage1();
    });
    document.getElementById('el-b1')?.addEventListener('change', (e) => {
      b1 = Number(e.target.value);
      renderStage1();
    });
    document.getElementById('el-b2')?.addEventListener('change', (e) => {
      b2 = Number(e.target.value);
      renderStage1();
    });
    document.getElementById('el-b3')?.addEventListener('change', (e) => {
      b3 = Number(e.target.value);
      renderStage1();
    });

    document.getElementById('el-validate-btn')?.addEventListener('click', () => {
      const check = simulateLedCircuit(12, 2.0, computeResistorOhms(b1, b2, b3), ledForward);
      if (powerOn && check.status === 'ok') {
        sfx.success();
        stageScores[0] = 1;
        stageIdx = 1;
        powerOn = false;
        render();
      } else {
        sfx.error();
        const fb = document.getElementById('el-feedback');
        fb.className = 'mg-feedback fail';
        fb.textContent = !powerOn
          ? 'Mettez l’alimentation sous tension pour tester le circuit au multimètre !'
          : check.message;
      }
    });
  }

  function renderStage2() {
    const sim = simulateDividerCircuit(5.0, divR1, divR2);
    api.container.innerHTML = `
      <div class="mg-grid-2">
        <div>
          <div class="mg-brief">
            <strong>Adaptation de niveau 5V → 3.3V :</strong> Un capteur sort un signal <strong>5.0 V</strong>,
            mais l'entrée GPIO de votre ESP32 n'accepte que <strong>3.3 V max</strong> (tolérance 3.1V – 3.45V).
            Dimensionnez le pont diviseur : <code>Vout = Vin × R2 / (R1 + R2)</code>.
          </div>

          <div class="circuit-board">
            <div class="psu-box">
              <span>📡 SORTIE CAPTEUR : +5.0 V</span>
              <button type="button" id="el-power-btn" class="btn-chip ${powerOn ? 'active' : ''}">
                ${powerOn ? '🟢 MESURE ACTIVE' : '⚪ ALIM COUPÉE'}
              </button>
            </div>
            <div class="divider-diagram">
              <div class="div-node">Vin = 5.00 V</div>
              <div class="div-comp">R1 (Haut) = <strong>${formatOhms(divR1)}</strong></div>
              <div class="div-mid">──▶ Vout vers GPIO ESP32 = <strong class="${powerOn ? (sim.ok ? 'txt-ok' : 'txt-danger') : ''}">${powerOn ? sim.vout.toFixed(2) + ' V' : '-- V'}</strong></div>
              <div class="div-comp">R2 (Bas vers GND) = <strong>${formatOhms(divR2)}</strong></div>
              <div class="div-node">GND (0 V)</div>
            </div>
          </div>
        </div>

        <div class="panel-box">
          <h4>🔩 Choix des Résistances E24</h4>
          <div class="ctrl-row">
            <label>Résistance R1 (reliée à +5V)</label>
            <select id="div-r1">
              ${[470, 1000, 1500, 2200, 4700, 10000].map((v) => `<option value="${v}" ${v === divR1 ? 'selected' : ''}>${formatOhms(v)}</option>`).join('')}
            </select>
          </div>
          <div class="ctrl-row">
            <label>Résistance R2 (reliée à GND)</label>
            <select id="div-r2">
              ${[470, 1000, 1800, 2000, 3300, 4700, 10000].map((v) => `<option value="${v}" ${v === divR2 ? 'selected' : ''}>${formatOhms(v)}</option>`).join('')}
            </select>
          </div>
          <div id="el-feedback" class="mg-feedback ${powerOn ? (sim.ok ? 'pass' : 'fail') : 'hidden'}">
            ${powerOn ? sim.message : ''}
          </div>
          <div class="panel-actions">
            <button type="button" id="el-validate-btn" class="btn-primary">Valider le pont diviseur ▶</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('el-power-btn')?.addEventListener('click', () => {
      sfx.click();
      powerOn = !powerOn;
      renderStage2();
    });
    document.getElementById('div-r1')?.addEventListener('change', (e) => {
      divR1 = Number(e.target.value);
      renderStage2();
    });
    document.getElementById('div-r2')?.addEventListener('change', (e) => {
      divR2 = Number(e.target.value);
      renderStage2();
    });
    document.getElementById('el-validate-btn')?.addEventListener('click', () => {
      const check = simulateDividerCircuit(5.0, divR1, divR2);
      if (powerOn && check.ok) {
        sfx.success();
        stageScores[1] = 1;
        stageIdx = 2;
        powerOn = false;
        render();
      } else {
        sfx.error();
        const fb = document.getElementById('el-feedback');
        fb.className = 'mg-feedback fail';
        fb.textContent = !powerOn ? 'Activez la mesure pour relever Vout !' : check.message;
      }
    });
  }

  function renderStage3() {
    const rbOk = baseR >= 470 && baseR <= 4700;
    const transOk = transistorType === 'npn';
    const diodeOk = diodeDir === 'reverse_ok';
    const allOk = rbOk && transOk && diodeOk;

    api.container.innerHTML = `
      <div class="mg-grid-2">
        <div>
          <div class="mg-brief">
            <strong>Commande de Relais 12V :</strong> Un GPIO 3.3V ne peut pas alimenter directement une bobine de relais 12V (80 mA).
            Montez un transistor en commutation côté bas (Low-Side), dimensionnez sa résistance de base (<code>470 Ω – 4.7 kΩ</code>),
            et protégez le transistor contre la surtension inductive à la coupure !
          </div>
          <div class="circuit-board">
            <div class="relay-card">
              <div>🔌 Bobine Relais 12V (80 mA)</div>
              <div>🛡️ Diode 1N4007 : <strong>${diodeDir === 'reverse_ok' ? '✅ En parallèle inverse (Cathode au +12V)' : diodeDir === 'short' ? '🔥 Court-circuit direct (+12V → Collecteur)' : '❌ Absente'}</strong></div>
              <div>🔀 Transistor : <strong>${transistorType === 'npn' ? '✅ NPN 2N2222 (Émetteur au GND)' : transistorType === 'pnp' ? '⚠️ PNP mal câblé en Low-Side' : '❌ Non inséré'}</strong></div>
              <div>🎚️ Résistance Base Rb : <strong>${formatOhms(baseR)}</strong></div>
            </div>
          </div>
        </div>

        <div class="panel-box">
          <h4>🧰 Assemblage Étage de Puissance</h4>
          <div class="ctrl-row">
            <label>1. Résistance de Base (Rb)</label>
            <select id="st3-rb">
              ${[100, 1000, 2200, 4700, 100000].map((v) => `<option value="${v}" ${v === baseR ? 'selected' : ''}>${formatOhms(v)}</option>`).join('')}
            </select>
          </div>
          <div class="ctrl-row">
            <label>2. Transistor de commutation (Low-Side)</label>
            <select id="st3-tr">
              <option value="none" ${transistorType === 'none' ? 'selected' : ''}>-- Choisir --</option>
              <option value="npn" ${transistorType === 'npn' ? 'selected' : ''}>NPN 2N2222 (Émetteur à la masse)</option>
              <option value="pnp" ${transistorType === 'pnp' ? 'selected' : ''}>PNP 2N2907 (Émetteur à la masse)</option>
            </select>
          </div>
          <div class="ctrl-row">
            <label>3. Diode de roue libre (1N4007)</label>
            <select id="st3-diode">
              <option value="none" ${diodeDir === 'none' ? 'selected' : ''}>Aucune diode</option>
              <option value="reverse_ok" ${diodeDir === 'reverse_ok' ? 'selected' : ''}>Parallèle bobine : Cathode (bague) vers +12V</option>
              <option value="short" ${diodeDir === 'short' ? 'selected' : ''}>Parallèle bobine : Anode vers +12V (passante)</option>
            </select>
          </div>
          <div id="el-feedback" class="mg-feedback ${relayTested ? (allOk ? 'pass' : 'fail') : 'hidden'}"></div>
          <div class="panel-actions">
            <button type="button" id="el-validate-btn" class="btn-primary">Tester la commutation ▶</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('st3-rb')?.addEventListener('change', (e) => { baseR = Number(e.target.value); });
    document.getElementById('st3-tr')?.addEventListener('change', (e) => { transistorType = e.target.value; });
    document.getElementById('st3-diode')?.addEventListener('change', (e) => { diodeDir = e.target.value; });

    document.getElementById('el-validate-btn')?.addEventListener('click', () => {
      relayTested = true;
      const fb = document.getElementById('el-feedback');
      const errs = [];
      if (!rbOk) errs.push('Rb doit être comprise entre 470 Ω et 4.7 kΩ (sinon pas de saturation ou GPIO surchargé).');
      if (!transOk) errs.push('Pour commuter côté masse (Low-Side), utilisez un transistor NPN (2N2222).');
      if (!diodeOk) errs.push('La diode de roue libre doit bloquer le +12V en régime établi : Cathode vers +12V !');

      if (errs.length === 0) {
        sfx.success();
        stageScores[2] = 1;
        const avg = stageScores.reduce((a, b) => a + b, 0) / ELEC_STAGES.length;
        api.finishTp(
          avg * 20,
          `<ul>
            <li>✅ Loi d’Ohm & code couleur 4 anneaux maîtrisés</li>
            <li>✅ Pont diviseur 5V → 3.3V validé au multimètre</li>
            <li>✅ Commutation NPN + Diode de roue libre validées</li>
          </ul>`
        );
      } else {
        sfx.error();
        fb.className = 'mg-feedback fail';
        fb.innerHTML = errs.map((m) => `<div>• ${m}</div>`).join('');
      }
    });
  }

  render();
  return { destroy() {} };
}
