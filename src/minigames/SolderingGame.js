import { sfx } from '../core/audio.js';

export const SOLDER_STAGES = [
  {
    id: 1,
    name: '1. Connecteur J1',
    brief:
      'Réglez le fer entre 340°C et 365°C (sans plomb SAC305), allumez l’extracteur de fumées, puis maintenez le clic sur chaque pastille et relâchez dans la zone VERTE !',
    pads: [
      { id: 'P1', label: 'VCC', x: 180, y: 190, r: 22, mass: 1.0, state: 'empty' },
      { id: 'P2', label: 'TX', x: 280, y: 190, r: 22, mass: 1.0, state: 'empty' },
      { id: 'P3', label: 'RX', x: 380, y: 190, r: 22, mass: 1.0, state: 'empty' },
      { id: 'P4', label: 'GND', x: 480, y: 190, r: 22, mass: 1.35, state: 'empty' }
    ],
    bridges: []
  },
  {
    id: 2,
    name: '2. Composants & Plan GND',
    brief:
      'Attention : les pastilles reliées au plan de masse (GND) dissipent plus vite la chaleur ! Adaptez votre temps de chauffe et reprenez tout défaut à la tresse.',
    pads: [
      { id: 'R1A', label: 'R1', x: 170, y: 140, r: 20, mass: 1.0, state: 'empty' },
      { id: 'R1B', label: 'R1', x: 310, y: 140, r: 20, mass: 1.0, state: 'empty' },
      { id: 'C1A', label: 'C1+', x: 170, y: 245, r: 20, mass: 1.0, state: 'empty' },
      { id: 'C1B', label: 'GND', x: 310, y: 245, r: 22, mass: 1.55, state: 'empty' },
      { id: 'D1A', label: 'D1', x: 470, y: 140, r: 20, mass: 1.0, state: 'empty' },
      { id: 'D1B', label: 'GND', x: 470, y: 245, r: 22, mass: 1.55, state: 'empty' }
    ],
    bridges: []
  },
  {
    id: 3,
    name: '3. CMS SOIC-8 & Tresse',
    brief:
      'Un pont de soudure court-circuite les broches 2 et 3 du microcontrôleur ! Utilisez d’abord la tresse à dessouder, puis brasez proprement les 6 broches CMS.',
    pads: [
      { id: 'U1', label: '1', x: 200, y: 135, r: 17, mass: 0.9, state: 'good' },
      { id: 'U2', label: '2', x: 270, y: 135, r: 17, mass: 0.9, state: 'bridge' },
      { id: 'U3', label: '3', x: 340, y: 135, r: 17, mass: 0.9, state: 'bridge' },
      { id: 'U4', label: '4', x: 410, y: 135, r: 17, mass: 0.9, state: 'empty' },
      { id: 'U5', label: '5', x: 200, y: 255, r: 17, mass: 0.9, state: 'empty' },
      { id: 'U6', label: '6', x: 270, y: 255, r: 17, mass: 0.9, state: 'empty' },
      { id: 'U7', label: '7', x: 340, y: 255, r: 17, mass: 0.9, state: 'empty' },
      { id: 'U8', label: '8', x: 410, y: 255, r: 17, mass: 1.3, state: 'empty' }
    ],
    bridges: [['U2', 'U3']]
  }
];

export function evaluateSolderStage(pads, tempC, fumeExtractorOn, reworkCount) {
  const allGood = pads.every((p) => p.state === 'good');
  const tempOk = tempC >= 335 && tempC <= 370;
  let ratio = 0;
  if (allGood) ratio += 0.7;
  if (tempOk) ratio += 0.15;
  if (fumeExtractorOn) ratio += 0.15;
  ratio = Math.max(0.4, ratio - Math.min(0.15, reworkCount * 0.02));
  return { allGood, tempOk, ratio };
}

export function createSolderingGame(api) {
  let stageIdx = 0;
  const stageScores = [0, 0, 0];
  let tempC = 280; // start too cold so player adjusts it!
  let fumeExtractorOn = false;
  let tool = 'iron'; // 'iron' | 'wick'
  let pads = [];
  let bridges = [];
  let reworkCount = 0;
  let animId = null;

  const pointer = { x: 320, y: 190, down: false };
  let activePad = null;
  let heatProgress = 0; // 0 to 1
  const smokeParticles = [];

  const finishHeat = () => {
    if (!pointer.down) return;
    pointer.down = false;
    if (!activePad) return;

    const pad = activePad;
    activePad = null;

    if (tempC < 320 || heatProgress < 0.45) {
      pad.state = 'cold';
      sfx.error();
    } else if (tempC > 395 || heatProgress > 0.85) {
      pad.state = 'burnt';
      sfx.error();
    } else {
      pad.state = 'good';
      sfx.interact();
    }
    heatProgress = 0;
    updateStats();
  };

  function loadStage(idx) {
    stageIdx = idx;
    const st = SOLDER_STAGES[idx];
    pads = st.pads.map((p) => ({ ...p }));
    bridges = st.bridges.map((b) => [...b]);
    activePad = null;
    heatProgress = 0;
  }

  function render() {
    const st = SOLDER_STAGES[stageIdx];
    api.setStages(
      SOLDER_STAGES.map((s, i) => (stageScores[i] > 0 ? `✅ ${s.name}` : s.name)),
      stageIdx,
      (idx) => {
        loadStage(idx);
        render();
      }
    );

    api.container.innerHTML = `
      <div class="mg-grid-2">
        <div class="solder-left">
          <div class="mg-brief">${st.brief}</div>
          <div class="pcb-canvas-wrap">
            <canvas id="pcb-canvas" width="640" height="370"></canvas>
          </div>
          <div class="solder-legend">
            <span>⚪ À braser</span>
            <span class="leg-good">✨ Cône brillant (OK)</span>
            <span class="leg-cold">🧊 Soudure froide</span>
            <span class="leg-hot">🔥 Brûlée / Pont</span>
          </div>
        </div>

        <div class="solder-right">
          <div class="panel-box">
            <h4>🌡️ Station de Brasage</h4>
            <div class="ctrl-row">
              <label>Température consigne : <strong id="temp-readout">${tempC}°C</strong>
                <span id="temp-zone" class="zone-badge"></span>
              </label>
              <input id="sd-temp" type="range" min="230" max="430" step="5" value="${tempC}" />
              <div class="hint-mini">Plage recommandée SAC305 sans plomb : 340°C – 365°C</div>
            </div>

            <div class="ctrl-row inline">
              <label>
                <input id="sd-fume" type="checkbox" ${fumeExtractorOn ? 'checked' : ''} />
                💨 Extracteur de fumées (EPI obligatoire)
              </label>
            </div>

            <div class="ctrl-row">
              <label>Outil actif</label>
              <div class="btn-group">
                <button type="button" id="tool-iron" class="btn-chip ${tool === 'iron' ? 'active' : ''}">🔥 Fer + Étain</button>
                <button type="button" id="tool-wick" class="btn-chip ${tool === 'wick' ? 'active' : ''}">🧶 Tresse à dessouder</button>
              </div>
            </div>
          </div>

          <div class="panel-box">
            <h4>🔍 Inspection Qualité</h4>
            <div id="sd-stats" class="sd-stats"></div>
            <div id="sd-feedback" class="mg-feedback hidden"></div>
            <div class="panel-actions">
              <button type="button" id="sd-validate-btn" class="btn-primary">Contrôler le PCB ▶</button>
            </div>
          </div>
        </div>
      </div>
    `;

    bindEvents();
    updateTempBadge();
    updateStats();
  }

  function updateTempBadge() {
    const el = document.getElementById('temp-zone');
    if (!el) return;
    if (tempC < 335) {
      el.textContent = 'Trop froid';
      el.className = 'zone-badge cold';
    } else if (tempC <= 370) {
      el.textContent = 'Optimal SAC305';
      el.className = 'zone-badge ok';
    } else {
      el.textContent = 'Surchauffe !';
      el.className = 'zone-badge hot';
    }
  }

  function updateStats() {
    const el = document.getElementById('sd-stats');
    if (!el) return;
    const goodCount = pads.filter((p) => p.state === 'good').length;
    const badCount = pads.filter((p) => ['cold', 'burnt', 'bridge'].includes(p.state)).length;
    el.innerHTML = `
      <div>Pastilles conformes : <strong>${goodCount} / ${pads.length}</strong></div>
      <div>Défauts / Ponts restants : <strong class="${badCount > 0 ? 'txt-danger' : 'txt-ok'}">${badCount}</strong></div>
    `;
  }

  function findPadAt(x, y) {
    return pads.find((p) => Math.hypot(p.x - x, p.y - y) <= p.r + 8) || null;
  }

  function clearBridgeForPad(padId) {
    bridges = bridges.filter((pair) => {
      if (pair.includes(padId)) {
        pair.forEach((pid) => {
          const p = pads.find((x) => x.id === pid);
          if (p && p.state === 'bridge') p.state = 'empty';
        });
        return false;
      }
      return true;
    });
  }

  function bindEvents() {
    const tempInput = document.getElementById('sd-temp');
    const tempReadout = document.getElementById('temp-readout');
    tempInput?.addEventListener('input', () => {
      tempC = Number(tempInput.value);
      tempReadout.textContent = `${tempC}°C`;
      updateTempBadge();
    });

    document.getElementById('sd-fume')?.addEventListener('change', (e) => {
      sfx.click();
      fumeExtractorOn = e.target.checked;
    });

    const btnIron = document.getElementById('tool-iron');
    const btnWick = document.getElementById('tool-wick');
    btnIron?.addEventListener('click', () => {
      sfx.click();
      tool = 'iron';
      btnIron.classList.add('active');
      btnWick.classList.remove('active');
    });
    btnWick?.addEventListener('click', () => {
      sfx.click();
      tool = 'wick';
      btnWick.classList.add('active');
      btnIron.classList.remove('active');
    });

    const canvas = document.getElementById('pcb-canvas');
    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * canvas.width,
        y: ((e.clientY - rect.top) / rect.height) * canvas.height
      };
    };

    canvas?.addEventListener('mousemove', (e) => {
      const pos = getPos(e);
      pointer.x = pos.x;
      pointer.y = pos.y;
    });

    canvas?.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const pos = getPos(e);
      pointer.x = pos.x;
      pointer.y = pos.y;
      pointer.down = true;
      const pad = findPadAt(pos.x, pos.y);
      if (!pad) return;

      if (tool === 'wick') {
        if (pad.state !== 'empty') {
          sfx.solderSizzle();
          if (pad.state === 'bridge') clearBridgeForPad(pad.id);
          pad.state = 'empty';
          reworkCount++;
          updateStats();
        }
        return;
      }

      if (pad.state === 'empty') {
        activePad = pad;
        heatProgress = 0;
        sfx.solderSizzle();
      }
    });

    window.removeEventListener('mouseup', finishHeat);
    window.addEventListener('mouseup', finishHeat);

    document.getElementById('sd-validate-btn')?.addEventListener('click', () => {
      const fb = document.getElementById('sd-feedback');
      const res = evaluateSolderStage(pads, tempC, fumeExtractorOn, reworkCount);
      const msgs = [];
      if (!res.allGood) msgs.push('Toutes les pastilles doivent présenter un cône brillant (sans pont ni soudure froide).');
      if (!res.tempOk) msgs.push('Réglez la station entre 335°C et 370°C pour l’alliage sans plomb.');
      if (!fumeExtractorOn) msgs.push('Activez l’extracteur de fumées pour respecter les consignes EPI !');

      if (msgs.length === 0) {
        sfx.success();
        stageScores[stageIdx] = res.ratio;
        fb.className = 'mg-feedback pass';
        fb.textContent = '✅ Inspection optique IPC-A-610 validée !';
        if (stageIdx < SOLDER_STAGES.length - 1) {
          setTimeout(() => {
            loadStage(stageIdx + 1);
            render();
          }, 850);
        } else {
          const avg = stageScores.reduce((a, b) => a + b, 0) / SOLDER_STAGES.length;
          api.finishTp(
            avg * 20,
            `<ul>
              <li>✅ Température sans plomb maîtrisée (${tempC}°C)</li>
              <li>✅ Extracteur de fumées activé (EPI)</li>
              <li>✅ Nettoyage à la tresse & brasures CMS conformes</li>
            </ul>`
          );
        }
      } else {
        sfx.error();
        fb.className = 'mg-feedback fail';
        fb.innerHTML = msgs.map((m) => `<div>• ${m}</div>`).join('');
      }
    });
  }

  let lastTime = performance.now();
  function loop(now) {
    animId = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    // Update heating
    if (pointer.down && activePad && tool === 'iron') {
      const tempFactor = Math.max(0.35, (tempC - 220) / 145);
      heatProgress += (dt * 0.72 * tempFactor) / activePad.mass;

      if (Math.random() < 0.35) {
        smokeParticles.push({
          x: activePad.x + (Math.random() - 0.5) * 10,
          y: activePad.y - 6,
          vx: fumeExtractorOn ? 38 : (Math.random() - 0.5) * 12,
          vy: fumeExtractorOn ? -24 : -34,
          life: 1
        });
      }

      if (heatProgress >= 1.02) {
        activePad.state = 'burnt';
        sfx.error();
        activePad = null;
        pointer.down = false;
        heatProgress = 0;
        updateStats();
      }
    }

    for (let i = smokeParticles.length - 1; i >= 0; i--) {
      const sp = smokeParticles[i];
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.life -= dt * 1.1;
      if (sp.life <= 0) smokeParticles.splice(i, 1);
    }

    drawPcb();
  }

  function drawPcb() {
    const canvas = document.getElementById('pcb-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // PCB substrate
    ctx.fillStyle = '#0f5132';
    ctx.fillRect(0, 0, w, h);

    // Subtle PCB grid & copper traces
    ctx.strokeStyle = '#198754';
    ctx.lineWidth = 6;
    pads.forEach((p, idx) => {
      if (idx + 1 < pads.length && idx % 2 === 0) {
        const next = pads[idx + 1];
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(next.x, next.y);
        ctx.stroke();
      }
    });

    // Fume extractor hood indicator on top-right
    ctx.fillStyle = fumeExtractorOn ? '#0284c7' : '#334155';
    ctx.fillRect(w - 110, 12, 96, 36);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(fumeExtractorOn ? '💨 EXTRACTEUR ON' : 'EXTRACTEUR OFF', w - 62, 34);

    // If stage 3 draw SOIC-8 IC body
    if (stageIdx === 2) {
      ctx.fillStyle = '#111827';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.fillRect(175, 158, 260, 74);
      ctx.strokeRect(175, 158, 260, 74);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('STM32-CIEL SOIC8', 305, 200);
    }

    // Draw bridges
    for (const [idA, idB] of bridges) {
      const a = pads.find((p) => p.id === idA);
      const b = pads.find((p) => p.id === idB);
      if (a && b) {
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 18;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // Draw pads
    for (const pad of pads) {
      // Copper/gold outer ring
      ctx.beginPath();
      ctx.arc(pad.x, pad.y, pad.r, 0, Math.PI * 2);
      ctx.fillStyle = pad.state === 'burnt' ? '#3f1d1d' : '#eab308';
      ctx.fill();

      // Solder fill based on state
      if (pad.state === 'good') {
        const grad = ctx.createRadialGradient(pad.x - 4, pad.y - 4, 2, pad.x, pad.y, pad.r - 2);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.5, '#cbd5e1');
        grad.addColorStop(1, '#64748b');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pad.x, pad.y, pad.r - 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (pad.state === 'cold') {
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(pad.x + 3, pad.y - 2, pad.r - 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (pad.state === 'bridge') {
        ctx.fillStyle = '#94a3b8';
        ctx.beginPath();
        ctx.arc(pad.x, pad.y, pad.r - 1, 0, Math.PI * 2);
        ctx.fill();
      } else if (pad.state === 'burnt') {
        ctx.fillStyle = '#1c1917';
        ctx.beginPath();
        ctx.arc(pad.x, pad.y, pad.r - 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Empty hole + pin
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(pad.x, pad.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(pad.x, pad.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#dcfce7';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(pad.label, pad.x, pad.y + pad.r + 16);
    }

    // Active heat progress arc
    if (activePad) {
      const cx = activePad.x;
      const cy = activePad.y;
      const r = activePad.r + 11;

      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.7)';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      // Optimal green arc zone indicator (0.45 to 0.85)
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2 + 0.45 * Math.PI * 2, -Math.PI / 2 + 0.85 * Math.PI * 2);
      ctx.stroke();

      const col = heatProgress < 0.45 ? '#38bdf8' : heatProgress <= 0.85 ? '#10b981' : '#ef4444';
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + heatProgress * Math.PI * 2);
      ctx.stroke();
    }

    // Smoke particles
    for (const sp of smokeParticles) {
      ctx.fillStyle = `rgba(226, 232, 240, ${sp.life * 0.45})`;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 6 + (1 - sp.life) * 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw soldering tool at pointer
    ctx.save();
    ctx.translate(pointer.x, pointer.y);
    if (tool === 'iron') {
      ctx.rotate(-0.55);
      ctx.fillStyle = tempC >= 335 ? '#fb923c' : '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(14, -6);
      ctx.lineTo(14, 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#475569';
      ctx.fillRect(14, -5, 40, 10);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(54, -8, 52, 16);
    } else {
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(38, -22);
      ctx.stroke();
    }
    ctx.restore();
  }

  loadStage(0);
  render();
  animId = requestAnimationFrame(loop);

  return {
    destroy() {
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('mouseup', finishHeat);
    }
  };
}
