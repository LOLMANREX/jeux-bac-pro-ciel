import { sfx } from '../core/audio.js';

export const HARDWARE_STAGES = [
  {
    id: 1,
    name: '1. Montage Station ESD',
    brief:
      'Enfilez d’abord le bracelet antistatique (ESD), installez chaque composant dans le bon emplacement (CPU + pâte thermique, RAM Dual-Channel A2/B2, NVMe M.2, Alimentation ATX) avant de lancer le POST.',
    type: 'assembly',
    requireEsd: true,
    slots: [
      { id: 'socket', label: 'Socket LGA1700', expectedPart: 'cpu', hint: 'Processeur + pâte thermique' },
      { id: 'dimm', label: 'Slots RAM A2 + B2', expectedPart: 'ram', hint: 'Barrettes Dual-Channel DDR5' },
      { id: 'm2', label: 'Port M.2 PCIe 4.0', expectedPart: 'nvme', hint: 'SSD NVMe Système' },
      { id: 'atx', label: 'Baie Alimentation & 24+8 pins', expectedPart: 'psu', hint: 'Bloc ATX 650W 80+ Gold' }
    ],
    parts: [
      { id: 'cpu', label: 'CPU Core i5 + Pâte thermique' },
      { id: 'ram', label: 'Kit 2x16 Go DDR5' },
      { id: 'nvme', label: 'SSD NVMe 1 To' },
      { id: 'psu', label: 'Alim ATX 650W' }
    ]
  },
  {
    id: 2,
    name: '2. Diagnostic POST & Pannes',
    brief:
      'Trois postes de l’atelier U306 sont en panne. Analysez les bips POST et symptômes matériels puis choisissez le diagnostic exact pour chaque machine.',
    type: 'diag',
    cases: [
      {
        id: 'pc-a',
        title: 'Poste U306-04 : 3 bips courts + LED orange DRAM',
        symptom: 'Les ventilateurs tournent mais aucun affichage. La carte mère émet 3 bips courts.',
        options: [
          { id: 'ram', label: 'Barrette RAM mal clipsée / défectueuse (nettoyer & réenclencher en A2/B2)' },
          { id: 'disk', label: 'SSD NVMe non formaté' },
          { id: 'lan', label: 'Câble RJ45 débranché' }
        ],
        expected: 'ram'
      },
      {
        id: 'pc-b',
        title: 'Poste U306-07 : Extinction brutale à 98°C après 2 minutes',
        symptom: 'Le BIOS indique CPU Temp 98°C dès le démarrage et le ventilateur ventirad est figé.',
        options: [
          { id: 'bios', label: 'Pile CMOS CR2032 usée' },
          { id: 'cooling', label: 'Ventirad débranché (CPU_FAN) / absence de pâte thermique' },
          { id: 'gpu', label: 'Pilote écran manquant' }
        ],
        expected: 'cooling'
      },
      {
        id: 'pc-c',
        title: 'Poste U306-11 : Message "No Bootable Device Found"',
        symptom: 'Le POST réussit (1 bip court) mais le PC boucle sur l’UEFI sans démarrer Windows/Linux.',
        options: [
          { id: 'psu', label: 'Câble HDMI branché sur la carte mère' },
          { id: 'boot', label: 'SSD M.2 déconnecté ou ordre de boot UEFI corrompu' },
          { id: 'esd', label: 'Touche Verr Num désactivée' }
        ],
        expected: 'boot'
      }
    ]
  }
];

export function evaluateHardwareBuild(stage, state) {
  const details = [];
  if (stage.type === 'assembly') {
    let points = 0;
    const maxPoints = stage.slots.length + 1;
    if (state?.esdStrap) points += 1;
    else details.push('Bracelet antistatique ESD oublié avant manipulation des composants !');

    const placements = state?.placements || {};
    for (const slot of stage.slots) {
      if (placements[slot.id] === slot.expectedPart) {
        points += 1;
      } else {
        details.push(`${slot.label} : composant incorrect ou manquant (${slot.hint})`);
      }
    }
    const score = Math.round((points / maxPoints) * 20);
    return { score, details, passed: score >= 12 };
  }

  const answers = state?.answers || {};
  let ok = 0;
  for (const c of stage.cases) {
    if (answers[c.id] === c.expected) ok += 1;
    else details.push(`${c.title} : diagnostic incorrect`);
  }
  const score = Math.round((ok / stage.cases.length) * 20);
  return { score, details, passed: score >= 12 };
}

export function createPcHardwareGame(api) {
  const root = document.createElement('div');
  root.className = 'hw-game-root';

  let activeStageIdx = 0;
  let selectedPart = null;
  const stageStates = [
    { esdStrap: false, placements: {}, score: null },
    { answers: {}, score: null }
  ];

  function syncTabs() {
    api.setStages(
      HARDWARE_STAGES.map((st, idx) => ({
        name: st.name,
        score: stageStates[idx].score
      })),
      activeStageIdx,
      (idx) => {
        activeStageIdx = idx;
        selectedPart = null;
        render();
      }
    );
  }

  function validate() {
    const stage = HARDWARE_STAGES[activeStageIdx];
    const state = stageStates[activeStageIdx];
    const res = evaluateHardwareBuild(stage, state);
    state.score = res.score;
    if (res.passed) sfx.success();
    else sfx.error();
    syncTabs();

    if (activeStageIdx === 0 && stageStates[1].score === null && res.passed) {
      activeStageIdx = 1;
      selectedPart = null;
      render();
      return;
    }

    const done = stageStates.map((s) => s.score).filter((s) => s !== null);
    if (done.length === HARDWARE_STAGES.length) {
      const avg = Math.round(done.reduce((a, b) => a + b, 0) / done.length);
      api.finishTp(
        avg,
        `
          <p>Validation de l’atelier matériel <strong>U306</strong> :</p>
          <ul>
            ${HARDWARE_STAGES.map((s, i) => `<li><strong>${s.name}</strong> : ${stageStates[i].score}/20</li>`).join('')}
          </ul>
        `
      );
      return;
    }
    render(res);
  }

  function render(lastEval = null) {
    const stage = HARDWARE_STAGES[activeStageIdx];
    const state = stageStates[activeStageIdx];

    if (stage.type === 'assembly') {
      root.innerHTML = `
        <div class="mg-card">
          <p class="patch-brief">${stage.brief}</p>
          <div class="hw-esd-bar">
            <button class="mg-btn ${state.esdStrap ? 'ok' : ''}" id="btn-esd-strap">
              ${state.esdStrap ? '✅ Bracelet ESD relié à la terre' : '⚡ Mettre le bracelet antistatique ESD'}
            </button>
          </div>
          <div class="hw-assembly-grid">
            <div class="hw-tray">
              <h4>Composants sur tapis ESD</h4>
              ${stage.parts
                .map((p) => {
                  const placed = Object.values(state.placements).includes(p.id);
                  return `
                    <button class="mg-btn hw-part-btn ${selectedPart === p.id ? 'active' : ''}" data-part="${p.id}">
                      ${placed ? '✔ ' : ''}${p.label}
                    </button>
                  `;
                })
                .join('')}
            </div>
            <div class="hw-chassis">
              <h4>Carte mère & Boîtier ATX</h4>
              ${stage.slots
                .map((slot) => {
                  const currentId = state.placements[slot.id];
                  const partLabel = stage.parts.find((p) => p.id === currentId)?.label || 'Emplacement vide';
                  return `
                    <button class="hw-slot-btn ${currentId ? 'filled' : ''}" data-slot="${slot.id}">
                      <strong>${slot.label}</strong>
                      <span>${partLabel}</span>
                    </button>
                  `;
                })
                .join('')}
            </div>
          </div>
          ${
            lastEval
              ? `<div class="patch-eval ${lastEval.passed ? 'pass' : 'fail'}">
                  <strong>Score étape : ${lastEval.score}/20</strong>
                  ${lastEval.details.length ? `<ul>${lastEval.details.map((d) => `<li>${d}</li>`).join('')}</ul>` : '<span> POST validé : 1 bip court !</span>'}
                </div>`
              : ''
          }
          <div class="patch-actions">
            <button class="mg-btn" id="btn-hw-reset">Vider boîtier</button>
            <button class="mg-btn mg-primary" id="btn-hw-validate">Démarrer & Tester le POST</button>
          </div>
        </div>
      `;

      root.querySelector('#btn-esd-strap')?.addEventListener('click', () => {
        state.esdStrap = !state.esdStrap;
        sfx.click();
        render();
      });
      root.querySelectorAll('[data-part]').forEach((b) => {
        b.addEventListener('click', () => {
          selectedPart = selectedPart === b.dataset.part ? null : b.dataset.part;
          sfx.click();
          render();
        });
      });
      root.querySelectorAll('[data-slot]').forEach((b) => {
        b.addEventListener('click', () => {
          if (!selectedPart) return;
          for (const [k, v] of Object.entries(state.placements)) {
            if (v === selectedPart) delete state.placements[k];
          }
          state.placements[b.dataset.slot] = selectedPart;
          selectedPart = null;
          sfx.click();
          render();
        });
      });
      root.querySelector('#btn-hw-reset')?.addEventListener('click', () => {
        state.placements = {};
        selectedPart = null;
        render();
      });
      root.querySelector('#btn-hw-validate')?.addEventListener('click', validate);
      return;
    }

    root.innerHTML = `
      <div class="mg-card">
        <p class="patch-brief">${stage.brief}</p>
        <div class="hw-diag-list">
          ${stage.cases
            .map(
              (c) => `
            <div class="hw-diag-case">
              <h4>${c.title}</h4>
              <p>${c.symptom}</p>
              <div class="hw-diag-options">
                ${c.options
                  .map(
                    (opt) => `
                  <button class="mg-btn ${state.answers[c.id] === opt.id ? 'active' : ''}" data-case="${c.id}" data-opt="${opt.id}">
                    ${opt.label}
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
        ${
          lastEval
            ? `<div class="patch-eval ${lastEval.passed ? 'pass' : 'fail'}">
                <strong>Score étape : ${lastEval.score}/20</strong>
                ${lastEval.details.length ? `<ul>${lastEval.details.map((d) => `<li>${d}</li>`).join('')}</ul>` : '<span> Toutes les pannes sont résolues !</span>'}
              </div>`
            : ''
        }
        <div class="patch-actions">
          <button class="mg-btn mg-primary" id="btn-hw-validate">Valider le diagnostic U306</button>
        </div>
      </div>
    `;

    root.querySelectorAll('[data-case]').forEach((b) => {
      b.addEventListener('click', () => {
        state.answers[b.dataset.case] = b.dataset.opt;
        sfx.click();
        render();
      });
    });
    root.querySelector('#btn-hw-validate')?.addEventListener('click', validate);
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
