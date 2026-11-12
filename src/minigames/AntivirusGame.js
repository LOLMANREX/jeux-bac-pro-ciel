import { sfx } from '../core/audio.js';

export const AV_STAGES = [
  {
    id: 1,
    name: '1. Adware & Cheval de Troie',
    brief:
      'Le PC de TP est envahi de popups ! 1) Coupez le réseau pour stopper les malwares, 2) Tuez les processus suspects, 3) Installez l’antivirus CielGuard, mettez à jour sa base et lancez le scan complet !',
    processes: [
      { pid: 412, name: 'explorer.exe', cpu: 2, legit: true, desc: 'Interface Bureau' },
      { pid: 884, name: 'ciel_tp_viewer.exe', cpu: 4, legit: true, desc: 'Lecteur de TP' },
      { pid: 1337, name: 'adware_popup_hd.exe', cpu: 42, legit: false, desc: 'Éditeur inconnu' },
      { pid: 2048, name: 'trojan_facture.exe', cpu: 36, legit: false, desc: 'Temp/Downloads' }
    ],
    ports: [{ port: 8080, label: 'Proxy inconnu OUT', bad: true }],
    startup: [],
    files: [
      { path: 'C:\\Users\\Eleve\\Downloads\\facture_pdf.exe', threat: 'Trojan.Win32.Dropper', bad: true },
      { path: 'C:\\ProgramData\\PopBoost\\adware.dll', threat: 'Adware.Win32.PopBoost', bad: true },
      { path: 'C:\\CIEL\\TP_Cours_Reseau.pdf', threat: 'Sain (Document de cours)', bad: false }
    ]
  },
  {
    id: 2,
    name: '2. Ransomware & Pare-feu',
    brief:
      'Alerte critique : un CryptoLocker chiffre les documents et exfiltre sur le port 4444 ! Isolez le réseau, fermez le port malveillant au pare-feu, tuez le processus chiffreurs, puis nettoyez à l’antivirus.',
    processes: [
      { pid: 310, name: 'winlogon.exe', cpu: 1, legit: true, desc: 'Session Windows' },
      { pid: 720, name: 'CielGuard_Agent', cpu: 3, legit: true, desc: 'Service Sécurité' },
      { pid: 3190, name: 'cryptolocker_v3.exe', cpu: 64, legit: false, desc: 'Chiffrement actif !' },
      { pid: 3402, name: 'ncat_reverse.exe', cpu: 19, legit: false, desc: 'Shell distant C2' }
    ],
    ports: [
      { port: 443, label: 'HTTPS Sortant (Légitime)', bad: false },
      { port: 4444, label: 'Metasploit / C2 Outbound', bad: true },
      { port: 6667, label: 'IRC Botnet Outbound', bad: true }
    ],
    startup: [{ id: 'st1', name: 'RunOnce_Crypto', cmd: 'C:\\Temp\\cryptolocker_v3.exe', bad: true }],
    files: [
      { path: 'C:\\Temp\\cryptolocker_v3.exe', threat: 'Ransom.Win32.Locker', bad: true },
      { path: 'C:\\Temp\\ncat_reverse.exe', threat: 'Backdoor.ReverseShell', bad: true },
      { path: 'C:\\Users\\Eleve\\Desktop\\key_dump.bin', threat: 'Spyware.CredHarvester', bad: true },
      { path: 'C:\\Windows\\System32\\drivers\\tcpip.sys', threat: 'Sain (Pilote Système)', bad: false }
    ]
  },
  {
    id: 3,
    name: '3. Rootkit & Persistance SOC',
    brief:
      'Attention aux noms piégés (typosquatting) comme « svch0st.exe » avec un zéro ! Éliminez le faux processus système, désactivez la tâche planifiée malveillante, bloquez le port C2 et mettez toutes les menaces en quarantaine.',
    processes: [
      { pid: 500, name: 'svchost.exe', cpu: 2, legit: true, desc: 'C:\\Windows\\System32' },
      { pid: 504, name: 'svch0st.exe', cpu: 31, legit: false, desc: 'C:\\Users\\Public\\Temp (PIÈGE !)' },
      { pid: 990, name: 'keylogger_sys.exe', cpu: 18, legit: false, desc: 'Capture clavier' },
      { pid: 1120, name: 'lsass.exe', cpu: 1, legit: true, desc: 'Autorité sécurité locale' }
    ],
    ports: [
      { port: 53, label: 'DNS Standard', bad: false },
      { port: 31337, label: 'Backdoor Rootkit C2', bad: true }
    ],
    startup: [
      { id: 'st2', name: 'WindowsDefenderSvc', cmd: 'C:\\Program Files\\Defender\\svc.exe', bad: false },
      { id: 'st3', name: 'Update_Powershell_B64', cmd: 'powershell -enc JABj...', bad: true }
    ],
    files: [
      { path: 'C:\\Users\\Public\\Temp\\svch0st.exe', threat: 'Trojan.Spy.Masquerade', bad: true },
      { path: 'C:\\ProgramData\\kl\\keylogger_sys.exe', threat: 'Spyware.Keylogger', bad: true },
      { path: 'C:\\Windows\\System32\\svchost.exe', threat: 'Sain (Binaire Microsoft)', bad: false }
    ]
  }
];

export function evaluateAntivirusStage(state) {
  const badProcsAlive = state.processes.filter((p) => !p.legit && p.alive).length;
  const badPortsOpen = state.ports.filter((p) => p.bad && p.open).length;
  const badStartupActive = state.startup.filter((s) => s.bad && s.enabled).length;
  const badFilesLeft = state.files.filter((f) => f.bad && !f.quarantined).length;

  const clean =
    state.avInstalled &&
    state.avUpdated &&
    state.scanDone &&
    badProcsAlive === 0 &&
    badPortsOpen === 0 &&
    badStartupActive === 0 &&
    badFilesLeft === 0;

  return {
    clean,
    badProcsAlive,
    badPortsOpen,
    badStartupActive,
    badFilesLeft
  };
}

export function createAntivirusGame(api) {
  let stageIdx = 0;
  const stageScores = [0, 0, 0];
  let activeTab = 'av'; // 'av' | 'tasks' | 'firewall'
  let mistakes = 0;
  let popupTimer = null;
  let scanTimer = null;
  let popups = [];

  let state = null;

  const POPUP_TEXTS = [
    '⚠️ ALERTE : 428 VIRUS DÉTECTÉS ! CLIQUEZ ICI !',
    '🎁 FÉLICITATIONS ! VOUS AVEZ GAGNÉ UN PC !',
    '🔒 CHIFFREMENT DES FICHIERS EN COURS...',
    '📡 ENVOI DES MOTS DE PASSE VERS 185.x.x.x...'
  ];

  function loadStage(idx) {
    stageIdx = idx;
    const st = AV_STAGES[idx];
    state = {
      networkIsolated: false,
      avInstalled: idx > 0, // Stage 1 installs AV from clean USB!
      avUpdated: false,
      scanning: false,
      scanProgress: 0,
      scanDone: false,
      processes: st.processes.map((p) => ({ ...p, alive: true })),
      ports: st.ports.map((p) => ({ ...p, open: true })),
      startup: st.startup.map((s) => ({ ...s, enabled: true })),
      files: st.files.map((f) => ({ ...f, quarantined: false }))
    };
    popups = [
      { id: 1, text: POPUP_TEXTS[0], x: 35, y: 38 },
      { id: 2, text: POPUP_TEXTS[2], x: 220, y: 120 }
    ];
  }

  function startPopupLoop() {
    if (popupTimer) clearInterval(popupTimer);
    popupTimer = setInterval(() => {
      if (!state) return;
      const aliveBad = state.processes.some((p) => !p.legit && p.alive);
      if (aliveBad && !state.networkIsolated && popups.length < 4) {
        popups.push({
          id: Date.now() + Math.random(),
          text: POPUP_TEXTS[Math.floor(Math.random() * POPUP_TEXTS.length)],
          x: 20 + Math.floor(Math.random() * 240),
          y: 25 + Math.floor(Math.random() * 140)
        });
        renderPopups();
      }
    }, 2600);
  }

  function renderPopups() {
    const layer = document.getElementById('os-popups-layer');
    if (!layer) return;
    layer.innerHTML = popups
      .map(
        (pop) => `
      <div class="virus-popup" style="left:${pop.x}px;top:${pop.y}px">
        <div class="vp-bar">
          <span>⚠️ Alerte Système</span>
          <button type="button" class="vp-close" data-pop="${pop.id}">✕</button>
        </div>
        <div class="vp-body">${pop.text}</div>
      </div>`
      )
      .join('');
    layer.querySelectorAll('.vp-close').forEach((btn) => {
      btn.addEventListener('click', () => {
        sfx.click();
        const id = Number(btn.dataset.pop);
        popups = popups.filter((p) => p.id !== id);
        renderPopups();
      });
    });
  }

  function render() {
    const st = AV_STAGES[stageIdx];
    api.setStages(
      AV_STAGES.map((s, i) => (stageScores[i] > 0 ? `✅ ${s.name}` : s.name)),
      stageIdx,
      (idx) => {
        loadStage(idx);
        render();
      }
    );

    const aliveBadProcs = state.processes.filter((p) => !p.legit && p.alive);
    const cpuTotal = Math.min(
      99,
      state.processes.filter((p) => p.alive).reduce((a, p) => a + p.cpu, 0)
    );
    const ev = evaluateAntivirusStage(state);

    api.container.innerHTML = `
      <div class="mg-brief">${st.brief}</div>
      <div class="ciel-os">
        <div class="os-topbar">
          <div class="os-title">🖥️ <strong>CIEL-OS Workstation</strong></div>
          <div class="os-metrics">
            <span class="${cpuTotal > 50 ? 'txt-danger' : 'txt-ok'}">CPU: ${cpuTotal}%</span>
            <button type="button" id="os-net-btn" class="btn-chip ${state.networkIsolated ? 'active' : 'danger'}">
              ${state.networkIsolated ? '🛡️ Réseau ISOLÉ (Hors-ligne)' : '⚠️ Réseau CONNECTÉ (Fuite !)'}
            </button>
            <span class="${ev.clean ? 'txt-ok' : 'txt-danger'}">
              ${ev.clean ? '✅ PC Sain (100%)' : '☣️ PC Infecté'}
            </span>
          </div>
        </div>

        <div class="os-tabs">
          <button type="button" class="os-tab ${activeTab === 'av' ? 'active' : ''}" data-tab="av">🛡️ Antivirus CielGuard</button>
          <button type="button" class="os-tab ${activeTab === 'tasks' ? 'active' : ''}" data-tab="tasks">📊 Gestionnaire des Tâches (${state.processes.filter((p) => p.alive).length})</button>
          <button type="button" class="os-tab ${activeTab === 'firewall' ? 'active' : ''}" data-tab="firewall">🧱 Pare-feu & Démarrage</button>
        </div>

        <div class="os-workspace">
          <div id="os-tab-body" class="os-tab-body"></div>
          <div id="os-popups-layer" class="os-popups-layer"></div>
        </div>

        <div class="os-footer">
          <div id="av-feedback" class="mg-feedback ${ev.clean ? 'pass' : 'hidden'}">
            ${ev.clean ? '✅ Toutes les menaces ont été éradiquées ! Validez votre intervention.' : ''}
          </div>
          <button type="button" id="av-validate-btn" class="btn-primary">Clôturer l'incident &amp; Valider ▶</button>
        </div>
      </div>
    `;

    renderTabBody(aliveBadProcs.length);
    renderPopups();
    bindOsEvents();
  }

  function renderTabBody(aliveBadCount) {
    const body = document.getElementById('os-tab-body');
    if (!body) return;

    if (activeTab === 'av') {
      if (!state.avInstalled) {
        body.innerHTML = `
          <div class="av-install-box">
            <h4>💾 Aucun Antivirus actif détecté sur ce poste !</h4>
            <p>Branchez la clé USB de dépannage du Professeur CIEL et installez <strong>CielGuard EDR</strong>.</p>
            <button type="button" id="av-install-btn" class="btn-primary">💿 Installer CielGuard EDR (Clé USB)</button>
          </div>
        `;
        document.getElementById('av-install-btn')?.addEventListener('click', () => {
          sfx.interact();
          state.avInstalled = true;
          render();
        });
        return;
      }

      body.innerHTML = `
        <div class="av-panel">
          <div class="av-actions-row">
            <button type="button" id="av-update-btn" class="btn-hud ${state.avUpdated ? 'active' : ''}" ${state.avUpdated ? 'disabled' : ''}>
              ${state.avUpdated ? '✅ Signatures virales à jour' : '⬇️ Mettre à jour les définitions virales'}
            </button>
            <button type="button" id="av-scan-btn" class="btn-primary" ${state.scanning ? 'disabled' : ''}>
              ${state.scanning ? `Analyse en cours... ${state.scanProgress}%` : state.scanDone ? '🔄 Relancer Analyse Complète' : '🔍 Lancer Analyse Complète'}
            </button>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${state.scanProgress}%"></div>
          </div>
          ${
            state.scanDone
              ? `<table class="os-table">
                  <thead><tr><th>Fichier</th><th>Détection</th><th>Action</th></tr></thead>
                  <tbody>
                    ${state.files
                      .map(
                        (f, i) => `
                      <tr>
                        <td><code>${f.path}</code></td>
                        <td class="${f.bad ? 'txt-danger' : 'txt-ok'}">${f.threat}</td>
                        <td>
                          ${
                            f.quarantined
                              ? '<span class="txt-ok">🛡️ En quarantaine</span>'
                              : `<button type="button" class="btn-sm btn-danger av-quar-btn" data-idx="${i}">Mettre en quarantaine</button>`
                          }
                        </td>
                      </tr>`
                      )
                      .join('')}
                  </tbody>
                </table>`
              : `<p class="hint-mini">Mettez à jour la base virale puis lancez une analyse complète pour identifier les fichiers infectés.${aliveBadCount > 0 ? ' Pensez aussi à couper le réseau et tuer les processus actifs.' : ''}</p>`
          }
        </div>
      `;

      document.getElementById('av-update-btn')?.addEventListener('click', () => {
        sfx.interact();
        state.avUpdated = true;
        render();
      });

      document.getElementById('av-scan-btn')?.addEventListener('click', () => {
        if (!state.avUpdated) {
          sfx.error();
          const fb = document.getElementById('av-feedback');
          fb.className = 'mg-feedback fail';
          fb.textContent = 'Mettez d’abord à jour la base virale avant de lancer l’analyse !';
          return;
        }
        sfx.click();
        state.scanning = true;
        state.scanProgress = 0;
        if (scanTimer) clearInterval(scanTimer);
        scanTimer = setInterval(() => {
          state.scanProgress += 20;
          if (state.scanProgress >= 100) {
            clearInterval(scanTimer);
            scanTimer = null;
            state.scanning = false;
            state.scanDone = true;
            sfx.alert();
          }
          render();
        }, 180);
        render();
      });

      body.querySelectorAll('.av-quar-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.idx);
          const file = state.files[idx];
          if (!file) return;
          if (!file.bad) {
            sfx.error();
            mistakes++;
            const fb = document.getElementById('av-feedback');
            fb.className = 'mg-feedback fail';
            fb.textContent = `Attention ! ${file.path} est un fichier sain légitime ! Ne le supprimez pas !`;
            return;
          }
          sfx.interact();
          file.quarantined = true;
          render();
        });
      });
    } else if (activeTab === 'tasks') {
      body.innerHTML = `
        <table class="os-table">
          <thead><tr><th>PID</th><th>Processus</th><th>CPU</th><th>Chemin / Éditeur</th><th>Action</th></tr></thead>
          <tbody>
            ${state.processes
              .filter((p) => p.alive)
              .map(
                (p) => `
              <tr>
                <td>${p.pid}</td>
                <td><strong>${p.name}</strong></td>
                <td class="${p.cpu > 15 ? 'txt-danger' : ''}">${p.cpu}%</td>
                <td>${p.desc}</td>
                <td><button type="button" class="btn-sm btn-danger kill-proc-btn" data-pid="${p.pid}">Tuer</button></td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      `;
      body.querySelectorAll('.kill-proc-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const pid = Number(btn.dataset.pid);
          const proc = state.processes.find((p) => p.pid === pid);
          if (!proc) return;
          if (proc.legit) {
            sfx.error();
            mistakes++;
            const fb = document.getElementById('av-feedback');
            fb.className = 'mg-feedback fail';
            fb.textContent = `Erreur : ${proc.name} est un processus système légitime !`;
            return;
          }
          sfx.interact();
          proc.alive = false;
          popups = [];
          render();
        });
      });
    } else {
      body.innerHTML = `
        <div class="fw-grid">
          <div>
            <h4>Ports réseau ouverts (Pare-feu)</h4>
            <table class="os-table">
              <thead><tr><th>Port</th><th>Service</th><th>État</th></tr></thead>
              <tbody>
                ${state.ports
                  .map(
                    (pt, idx) => `
                  <tr>
                    <td><code>${pt.port}/TCP</code></td>
                    <td>${pt.label}</td>
                    <td>
                      <button type="button" class="btn-sm ${pt.open ? 'btn-danger' : 'btn-hud'} fw-port-btn" data-idx="${idx}">
                        ${pt.open ? 'Ouvert (Bloquer)' : '🛡️ Bloqué'}
                      </button>
                    </td>
                  </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
          <div>
            <h4>Tâches planifiées / Démarrage</h4>
            ${
              state.startup.length === 0
                ? '<p class="hint-mini">Aucune entrée suspecte au démarrage sur ce niveau.</p>'
                : `<table class="os-table">
                    <thead><tr><th>Entrée</th><th>Commande</th><th>État</th></tr></thead>
                    <tbody>
                      ${state.startup
                        .map(
                          (s, idx) => `
                        <tr>
                          <td><strong>${s.name}</strong></td>
                          <td><code>${s.cmd}</code></td>
                          <td>
                            <button type="button" class="btn-sm ${s.enabled ? 'btn-danger' : 'btn-hud'} st-btn" data-idx="${idx}">
                              ${s.enabled ? 'Actif (Désactiver)' : '🛡️ Désactivé'}
                            </button>
                          </td>
                        </tr>`
                        )
                        .join('')}
                    </tbody>
                  </table>`
            }
          </div>
        </div>
      `;

      body.querySelectorAll('.fw-port-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const pt = state.ports[Number(btn.dataset.idx)];
          if (!pt.bad && pt.open) {
            sfx.error();
            mistakes++;
            const fb = document.getElementById('av-feedback');
            fb.className = 'mg-feedback fail';
            fb.textContent = `Ne bloquez pas le port légitime ${pt.port} (${pt.label}) !`;
            return;
          }
          sfx.interact();
          pt.open = !pt.open;
          render();
        });
      });

      body.querySelectorAll('.st-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const item = state.startup[Number(btn.dataset.idx)];
          if (!item.bad && item.enabled) {
            sfx.error();
            mistakes++;
            const fb = document.getElementById('av-feedback');
            fb.className = 'mg-feedback fail';
            fb.textContent = `${item.name} est une tâche légitime !`;
            return;
          }
          sfx.interact();
          item.enabled = !item.enabled;
          render();
        });
      });
    }
  }

  function bindOsEvents() {
    document.getElementById('os-net-btn')?.addEventListener('click', () => {
      sfx.click();
      state.networkIsolated = !state.networkIsolated;
      render();
    });

    document.querySelectorAll('.os-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        sfx.click();
        activeTab = btn.dataset.tab;
        render();
      });
    });

    document.getElementById('av-validate-btn')?.addEventListener('click', () => {
      const ev = evaluateAntivirusStage(state);
      const fb = document.getElementById('av-feedback');
      if (ev.clean) {
        if (!state.networkIsolated) {
          // Good — re-connected after cleaning or kept safe
        }
        sfx.success();
        stageScores[stageIdx] = Math.max(0.65, 1 - mistakes * 0.08);
        if (stageIdx < AV_STAGES.length - 1) {
          loadStage(stageIdx + 1);
          activeTab = 'av';
          render();
        } else {
          const avg = stageScores.reduce((a, b) => a + b, 0) / AV_STAGES.length;
          api.finishTp(
            avg * 20,
            `<ul>
              <li>✅ Réflexe d'isolation réseau appliqué</li>
              <li>✅ Processus malveillants & typosquatting (<code>svch0st.exe</code>) éliminés</li>
              <li>✅ Antivirus CielGuard installé, mis à jour et menaces mises en quarantaine</li>
              <li>✅ Pare-feu et tâches planifiées sécurisés</li>
            </ul>`
          );
        }
      } else {
        sfx.error();
        const errs = [];
        if (!state.avInstalled) errs.push('Installez CielGuard EDR.');
        if (!state.avUpdated) errs.push('Mettez à jour les définitions virales.');
        if (!state.scanDone) errs.push('Lancez l’analyse complète.');
        if (ev.badProcsAlive > 0) errs.push(`${ev.badProcsAlive} processus malveillant(s) encore actif(s).`);
        if (ev.badPortsOpen > 0) errs.push(`${ev.badPortsOpen} port(s) backdoor encore ouvert(s) dans le pare-feu.`);
        if (ev.badStartupActive > 0) errs.push(`${ev.badStartupActive} tâche(s) malveillante(s) active(s) au démarrage.`);
        if (ev.badFilesLeft > 0) errs.push(`${ev.badFilesLeft} fichier(s) infecté(s) non mis en quarantaine.`);
        fb.className = 'mg-feedback fail';
        fb.innerHTML = errs.map((e) => `<div>• ${e}</div>`).join('');
      }
    });
  }

  loadStage(0);
  render();
  startPopupLoop();

  return {
    destroy() {
      if (popupTimer) clearInterval(popupTimer);
      if (scanTimer) clearInterval(scanTimer);
    }
  };
}
