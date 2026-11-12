import { sfx } from '../core/audio.js';

export const PATCH_STAGES = [
  {
    id: 1,
    name: '1. Brassage RJ45 Cat.6A',
    brief:
      'Reliez chaque prise murale du Plateau U300 au port du Switch Core correspondant (respectez les VLANs et les liens Uplink 10G), puis activez la certification de lien.',
    panelPorts: [
      { id: 'PP-01', label: 'U301 - Banc Soudure (Admin)', targetPort: 'SW-01', media: 'cat6a', vlan: 10 },
      { id: 'PP-02', label: 'U302 - Mesure / Oscilloscopes', targetPort: 'SW-02', media: 'cat6a', vlan: 20 },
      { id: 'PP-03', label: 'U305 - SOC Cybersécurité', targetPort: 'SW-03', media: 'cat6a', vlan: 30 },
      { id: 'PP-04', label: 'U307 - Îlots Réseau & VM', targetPort: 'SW-SFP1', media: 'sfp10g', vlan: 'TRUNK' }
    ],
    switchPorts: [
      { id: 'SW-01', label: 'Gi1/0/1 • VLAN 10', media: 'cat6a', poe: false },
      { id: 'SW-02', label: 'Gi1/0/2 • VLAN 20', media: 'cat6a', poe: false },
      { id: 'SW-03', label: 'Gi1/0/3 • VLAN 30', media: 'cat6a', poe: false },
      { id: 'SW-SFP1', label: 'Te1/1/1 • SFP+ 10G TRUNK', media: 'sfp10g', poe: false }
    ],
    requireCleanFiber: false,
    requireRedundantPsu: false
  },
  {
    id: 2,
    name: '2. Fibre Optique & Baie Ondulée',
    brief:
      'Raccordez le coeur de réseau de la Chambre vers les armoires U307 et U305 en Fibre OS2 LC/APC : nettoyez les ferrules, sélectionnez le câble optique et activez la double alimentation ondulée.',
    panelPorts: [
      { id: 'FO-A', label: 'Fibre OS2 -> Armoire U307', targetPort: 'CORE-SFP1', media: 'fiber', vlan: 'TRUNK' },
      { id: 'FO-B', label: 'Fibre OS2 -> Baie SOC U305', targetPort: 'CORE-SFP2', media: 'fiber', vlan: 'TRUNK' },
      { id: 'MGMT', label: 'IPMI / iDRAC Serveurs Chambre', targetPort: 'CORE-MGMT', media: 'cat6a', vlan: 99 },
      { id: 'AP-HALL', label: 'Borne Wi-Fi 6E Hall U300 (PoE+)', targetPort: 'CORE-POE', media: 'cat6a', vlan: 20 }
    ],
    switchPorts: [
      { id: 'CORE-SFP1', label: 'SFP+1 • OS2 Uplink 10G', media: 'fiber', poe: false },
      { id: 'CORE-SFP2', label: 'SFP+2 • OS2 Uplink 10G', media: 'fiber', poe: false },
      { id: 'CORE-MGMT', label: 'Gi0/0 • Out-of-Band VLAN 99', media: 'cat6a', poe: false },
      { id: 'CORE-POE', label: 'Gi1/0/24 • PoE+ 30W', media: 'cat6a', poe: true }
    ],
    requireCleanFiber: true,
    requireRedundantPsu: true
  }
];

export function evaluatePatchConfiguration(stage, state) {
  const links = state?.links || {};
  const mediaUsed = state?.mediaUsed || {};
  let correctLinks = 0;
  let correctMedia = 0;
  const details = [];

  for (const pp of stage.panelPorts) {
    const chosenTarget = links[pp.id];
    const chosenMedia = mediaUsed[pp.id];
    const targetOk = chosenTarget === pp.targetPort;
    const mediaOk = chosenMedia === pp.media;
    if (targetOk) correctLinks += 1;
    if (mediaOk) correctMedia += 1;
    if (!targetOk) {
      details.push(`${pp.id} : port switch attendu ${pp.targetPort} (reçu ${chosenTarget || 'non brassé'})`);
    } else if (!mediaOk) {
      details.push(`${pp.id} : cordon inadapté (attendu ${pp.media.toUpperCase()})`);
    }
  }

  let bonusChecks = 0;
  let bonusTotal = 0;
  if (stage.requireCleanFiber) {
    bonusTotal += 1;
    if (state?.fiberCleaned) bonusChecks += 1;
    else details.push('Ferrules optiques non nettoyées avant raccordement');
  }
  if (stage.requireRedundantPsu) {
    bonusTotal += 1;
    if (state?.psuBEnabled) bonusChecks += 1;
    else details.push('Alimentation redondante UPS-B non enclenchée');
  }

  const maxPoints = stage.panelPorts.length * 2 + bonusTotal;
  const earned = correctLinks + correctMedia + bonusChecks;
  const score = Math.round((earned / Math.max(1, maxPoints)) * 20);
  return {
    score,
    correctLinks,
    totalPorts: stage.panelPorts.length,
    correctMedia,
    details,
    passed: score >= 12
  };
}

export function createPatchRackGame(api) {
  const root = document.createElement('div');
  root.className = 'patch-game-root';

  let activeStageIdx = 0;
  let activeCableType = 'cat6a';
  let selectedPanelPort = null;
  const stageStates = PATCH_STAGES.map(() => ({
    links: {},
    mediaUsed: {},
    fiberCleaned: false,
    psuBEnabled: false,
    score: null
  }));

  function currentStage() {
    return PATCH_STAGES[activeStageIdx];
  }

  function currentState() {
    return stageStates[activeStageIdx];
  }

  function syncTabs() {
    api.setStages(
      PATCH_STAGES.map((st, idx) => ({
        name: st.name,
        score: stageStates[idx].score
      })),
      activeStageIdx,
      (idx) => {
        activeStageIdx = idx;
        selectedPanelPort = null;
        render();
      }
    );
  }

  function connectPort(switchId) {
    if (!selectedPanelPort) return;
    const state = currentState();
    for (const [pId, swId] of Object.entries(state.links)) {
      if (swId === switchId && pId !== selectedPanelPort) {
        delete state.links[pId];
        delete state.mediaUsed[pId];
      }
    }
    state.links[selectedPanelPort] = switchId;
    state.mediaUsed[selectedPanelPort] = activeCableType;
    selectedPanelPort = null;
    sfx.click();
    render();
  }

  function validateStage() {
    const stage = currentStage();
    const state = currentState();
    const res = evaluatePatchConfiguration(stage, state);
    state.score = res.score;
    if (res.passed) sfx.success();
    else sfx.error();
    syncTabs();

    if (activeStageIdx === 0 && stageStates[1].score === null && res.passed) {
      activeStageIdx = 1;
      selectedPanelPort = null;
      activeCableType = 'fiber';
      render();
      return;
    }

    const doneScores = stageStates.map((s) => s.score).filter((s) => s !== null);
    if (doneScores.length === PATCH_STAGES.length) {
      const avg = Math.round(doneScores.reduce((a, b) => a + b, 0) / PATCH_STAGES.length);
      const summary = `
        <p>Audit de la baie serveur <strong>Chambre U300</strong> terminé :</p>
        <ul>
          ${PATCH_STAGES.map((st, i) => `<li><strong>${st.name}</strong> : ${stageStates[i].score}/20</li>`).join('')}
        </ul>
      `;
      api.finishTp(avg, summary);
      return;
    }
    render(res);
  }

  function render(lastEval = null) {
    const stage = currentStage();
    const state = currentState();
    const cableDefs = [
      { id: 'cat6a', label: 'RJ45 Cat.6A (Cuivre)', color: '#38bdf8' },
      { id: 'sfp10g', label: 'DAC Twinax SFP+ 10G', color: '#f59e0b' },
      { id: 'fiber', label: 'Jarretière Fibre OS2 LC/APC', color: '#a855f7' }
    ];

    root.innerHTML = `
      <div class="mg-card">
        <div class="patch-brief">${stage.brief}</div>
        <div class="patch-toolbar">
          <span class="patch-label">Cordon sélectionné :</span>
          ${cableDefs
            .map(
              (c) => `
            <button class="mg-btn patch-cable-btn ${activeCableType === c.id ? 'active' : ''}" data-cable="${c.id}">
              <span class="patch-dot" style="background:${c.color}"></span>${c.label}
            </button>
          `
            )
            .join('')}
        </div>
        ${
          stage.requireCleanFiber || stage.requireRedundantPsu
            ? `<div class="patch-checks">
                ${
                  stage.requireCleanFiber
                    ? `<button class="mg-btn ${state.fiberCleaned ? 'ok' : ''}" id="btn-clean-fiber">
                        ${state.fiberCleaned ? '✅ Ferrules optiques nettoyées (IPA)' : '🧼 Nettoyer les ferrules optiques'}
                      </button>`
                    : ''
                }
                ${
                  stage.requireRedundantPsu
                    ? `<button class="mg-btn ${state.psuBEnabled ? 'ok' : ''}" id="btn-psu-b">
                        ${state.psuBEnabled ? '⚡ Onduleur UPS-B Enclenché' : '🔌 Activer alimentation secourue UPS-B'}
                      </button>`
                    : ''
                }
              </div>`
            : ''
        }
        <div class="patch-rack-grid">
          <div class="patch-bay">
            <h4>Panneau de brassage (Arrivées Plateau)</h4>
            ${stage.panelPorts
              .map((pp) => {
                const target = state.links[pp.id];
                const media = state.mediaUsed[pp.id];
                const isSelected = selectedPanelPort === pp.id;
                return `
                  <button class="patch-port-row ${isSelected ? 'selected' : ''} ${target ? 'linked' : ''}" data-panel="${pp.id}">
                    <span class="patch-port-id">${pp.id}</span>
                    <span class="patch-port-desc">${pp.label}</span>
                    <span class="patch-port-tag">${target ? `${target} (${(media || '').toUpperCase()})` : 'À brasser'}</span>
                  </button>
                `;
              })
              .join('')}
          </div>
          <div class="patch-bay">
            <h4>Switch Core L3 / Fibre Chambre</h4>
            ${stage.switchPorts
              .map((sw) => {
                const linkedFrom = Object.entries(state.links).find(([, target]) => target === sw.id)?.[0];
                return `
                  <button class="patch-port-row switch-side ${linkedFrom ? 'linked' : ''}" data-switch="${sw.id}">
                    <span class="patch-led ${linkedFrom ? 'on' : ''}"></span>
                    <span class="patch-port-id">${sw.id}</span>
                    <span class="patch-port-desc">${sw.label}</span>
                    <span class="patch-port-tag">${linkedFrom ? `Lié à ${linkedFrom}` : 'Disponible'}</span>
                  </button>
                `;
              })
              .join('')}
          </div>
        </div>
        ${
          lastEval
            ? `<div class="patch-eval ${lastEval.passed ? 'pass' : 'fail'}">
                <strong>Résultat étape : ${lastEval.score}/20</strong>
                ${
                  lastEval.details.length
                    ? `<ul>${lastEval.details.map((d) => `<li>${d}</li>`).join('')}</ul>`
                    : '<span> Tous les liens sont conformes et actifs !</span>'
                }
              </div>`
            : ''
        }
        <div class="patch-actions">
          <button class="mg-btn" id="btn-patch-reset">Réinitialiser brassage</button>
          <button class="mg-btn mg-primary" id="btn-patch-validate">Tester & Certifier la baie</button>
        </div>
      </div>
    `;

    root.querySelectorAll('[data-cable]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeCableType = btn.dataset.cable;
        sfx.click();
        render();
      });
    });
    root.querySelectorAll('[data-panel]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedPanelPort = selectedPanelPort === btn.dataset.panel ? null : btn.dataset.panel;
        sfx.click();
        render();
      });
    });
    root.querySelectorAll('[data-switch]').forEach((btn) => {
      btn.addEventListener('click', () => connectPort(btn.dataset.switch));
    });
    root.querySelector('#btn-clean-fiber')?.addEventListener('click', () => {
      state.fiberCleaned = !state.fiberCleaned;
      sfx.click();
      render();
    });
    root.querySelector('#btn-psu-b')?.addEventListener('click', () => {
      state.psuBEnabled = !state.psuBEnabled;
      sfx.click();
      render();
    });
    root.querySelector('#btn-patch-reset')?.addEventListener('click', () => {
      state.links = {};
      state.mediaUsed = {};
      selectedPanelPort = null;
      render();
    });
    root.querySelector('#btn-patch-validate')?.addEventListener('click', validateStage);
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
