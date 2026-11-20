import {
  MEMO_CATEGORIES,
  RESISTOR_BAND_COLORS,
  calculateIpv4Subnet,
  decodeResistor4Band,
  filterCommandMemo
} from './CielToolsLogic.js';

function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export class CielToolsApp {
  constructor(options = {}) {
    this.onToast = options.onToast || null;
    this.containerEl = null;
    this.activeTab = 'subnet';

    this.ipInput = '192.168.10.45';
    this.cidrInput = '26';

    this.band1 = 'brown';
    this.band2 = 'black';
    this.bandMult = 'red';
    this.bandTol = 'gold';

    this.memoCategory = 'all';
    this.memoQuery = '';
  }

  mount(containerEl, params = {}) {
    this.containerEl = containerEl;
    if (params?.tab && ['subnet', 'resistor', 'memo'].includes(params.tab)) {
      this.activeTab = params.tab;
    }
    this.render();
  }

  unmount() {
    this.containerEl = null;
  }

  render() {
    if (!this.containerEl) return;

    this.containerEl.innerHTML = `
      <div class="tls-app">
        <div class="tls-head">
          <div>
            <div class="fmt-kicker">BOÎTE À OUTILS TECHNICIEN BAC PRO CIEL</div>
            <h2>🧰 Outils CIEL</h2>
          </div>
          <div class="tls-tabs">
            <button type="button" class="tls-tab ${this.activeTab === 'subnet' ? 'active' : ''}" data-tool-tab="subnet">🌐 Calculateur IPv4/CIDR</button>
            <button type="button" class="tls-tab ${this.activeTab === 'resistor' ? 'active' : ''}" data-tool-tab="resistor">🎨 Code Couleur Résistances</button>
            <button type="button" class="tls-tab ${this.activeTab === 'memo' ? 'active' : ''}" data-tool-tab="memo">🐧 Mémo Linux &amp; Cisco</button>
          </div>
        </div>
        <div id="tls-tab-body" class="tls-body"></div>
      </div>
    `;

    this.containerEl.querySelectorAll('[data-tool-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.dataset.toolTab;
        this.render();
      });
    });

    const bodyEl = this.containerEl.querySelector('#tls-tab-body');
    if (this.activeTab === 'subnet') this._renderSubnet(bodyEl);
    else if (this.activeTab === 'resistor') this._renderResistor(bodyEl);
    else this._renderMemo(bodyEl);
  }

  _renderSubnet(bodyEl) {
    if (!bodyEl) return;
    const res = calculateIpv4Subnet(this.ipInput, this.cidrInput);

    const presets = [
      { ip: '192.168.10.45', cidr: '26' },
      { ip: '10.20.0.15', cidr: '16' },
      { ip: '172.16.4.99', cidr: '24' },
      { ip: '192.168.1.250', cidr: '30' }
    ];

    bodyEl.innerHTML = `
      <div class="tls-card">
        <div class="tls-subnet-form">
          <label class="tls-field">
            <span>Adresse IPv4</span>
            <input id="tls-ip-input" type="text" value="${escapeHtml(this.ipInput)}" placeholder="192.168.10.45" />
          </label>
          <label class="tls-field">
            <span>CIDR ou Masque</span>
            <input id="tls-cidr-input" type="text" value="${escapeHtml(this.cidrInput)}" placeholder="26 ou 255.255.255.192" />
          </label>
        </div>
        <div class="tls-presets-row">
          ${presets.map((p) => `<button type="button" class="tls-preset-btn" data-ip="${p.ip}" data-cidr="${p.cidr}">${p.ip}/${p.cidr}</button>`).join('')}
        </div>
        <div id="tls-subnet-result" class="tls-subnet-result"></div>
      </div>
    `;

    const paintResult = () => {
      const box = bodyEl.querySelector('#tls-subnet-result');
      if (!box) return;
      const calc = calculateIpv4Subnet(this.ipInput, this.cidrInput);
      if (!calc.ok) {
        box.innerHTML = `<div class="tls-error">${escapeHtml(calc.error)}</div>`;
        return;
      }
      box.innerHTML = `
        <div class="tls-result-grid">
          <div class="tls-res-item"><span>Adresse Réseau</span><strong>${escapeHtml(calc.network)}/${calc.cidr}</strong></div>
          <div class="tls-res-item"><span>Masque Décimal</span><strong>${escapeHtml(calc.mask)}</strong></div>
          <div class="tls-res-item"><span>Broadcast</span><strong>${escapeHtml(calc.broadcast)}</strong></div>
          <div class="tls-res-item"><span>Wildcard</span><strong>${escapeHtml(calc.wildcard)}</strong></div>
          <div class="tls-res-item"><span>Premier Hôte</span><strong>${escapeHtml(calc.firstHost)}</strong></div>
          <div class="tls-res-item"><span>Dernier Hôte</span><strong>${escapeHtml(calc.lastHost)}</strong></div>
          <div class="tls-res-item highlight"><span>Hôtes utilisables</span><strong>${calc.usableHosts.toLocaleString('fr-FR')}</strong></div>
          <div class="tls-res-item"><span>Portée / Classe</span><strong>${escapeHtml(calc.scope)} (${escapeHtml(calc.ipClass)})</strong></div>
        </div>
        <div class="tls-binary-row">Masque binaire : <code>${escapeHtml(calc.maskBinary)}</code></div>
      `;
    };

    paintResult();

    const ipEl = bodyEl.querySelector('#tls-ip-input');
    const cidrEl = bodyEl.querySelector('#tls-cidr-input');
    ipEl?.addEventListener('input', () => {
      this.ipInput = ipEl.value;
      paintResult();
    });
    cidrEl?.addEventListener('input', () => {
      this.cidrInput = cidrEl.value;
      paintResult();
    });
    bodyEl.querySelectorAll('.tls-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.ipInput = btn.dataset.ip;
        this.cidrInput = btn.dataset.cidr;
        if (ipEl) ipEl.value = this.ipInput;
        if (cidrEl) cidrEl.value = this.cidrInput;
        paintResult();
      });
    });
  }

  _renderResistor(bodyEl) {
    if (!bodyEl) return;
    const digitColors = RESISTOR_BAND_COLORS.filter((c) => c.digit !== null);
    const multColors = RESISTOR_BAND_COLORS.filter((c) => c.multiplier !== null);
    const tolColors = RESISTOR_BAND_COLORS.filter((c) => c.tolerancePct !== null);
    const decoded = decodeResistor4Band(this.band1, this.band2, this.bandMult, this.bandTol);

    const buildOpts = (list, selectedId, mode) =>
      list
        .map((c) => {
          const extra =
            mode === 'digit'
              ? c.digit
              : mode === 'mult'
                ? `×${c.multiplier}`
                : `±${c.tolerancePct}%`;
          return `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${escapeHtml(c.label)} (${extra})</option>`;
        })
        .join('');

    const [h1, h2, hm, ht] = decoded.ok
      ? decoded.hexColors
      : ['#78350f', '#111827', '#dc2626', '#d97706'];

    bodyEl.innerHTML = `
      <div class="tls-card">
        <div class="tls-resistor-stage">
          <svg viewBox="0 0 360 96" class="tls-resistor-svg" aria-label="Aperçu résistance 4 anneaux">
            <line x1="12" y1="48" x2="82" y2="48" stroke="#94a3b8" stroke-width="8" stroke-linecap="round" />
            <line x1="278" y1="48" x2="348" y2="48" stroke="#94a3b8" stroke-width="8" stroke-linecap="round" />
            <rect x="78" y="20" width="204" height="56" rx="18" fill="#e5c89e" stroke="#b48a5a" stroke-width="2.5" />
            <rect x="108" y="20" width="18" height="56" fill="${h1}" />
            <rect x="144" y="20" width="18" height="56" fill="${h2}" />
            <rect x="180" y="20" width="18" height="56" fill="${hm}" />
            <rect x="234" y="20" width="18" height="56" fill="${ht}" />
          </svg>
          <div class="tls-resistor-readout">
            <div class="tls-res-val">${decoded.ok ? escapeHtml(decoded.formatted) : '-- Ω'}</div>
            <div class="tls-res-tol">${decoded.ok ? `${escapeHtml(decoded.toleranceLabel)} (${escapeHtml(decoded.minFormatted)} — ${escapeHtml(decoded.maxFormatted)})` : ''}</div>
          </div>
        </div>

        <div class="tls-bands-grid">
          <label class="tls-field">
            <span>Anneau 1 (1er chiffre)</span>
            <select id="tls-r-b1">${buildOpts(digitColors, this.band1, 'digit')}</select>
          </label>
          <label class="tls-field">
            <span>Anneau 2 (2e chiffre)</span>
            <select id="tls-r-b2">${buildOpts(digitColors, this.band2, 'digit')}</select>
          </label>
          <label class="tls-field">
            <span>Anneau 3 (Multiplicateur)</span>
            <select id="tls-r-bm">${buildOpts(multColors, this.bandMult, 'mult')}</select>
          </label>
          <label class="tls-field">
            <span>Anneau 4 (Tolérance)</span>
            <select id="tls-r-bt">${buildOpts(tolColors, this.bandTol, 'tol')}</select>
          </label>
        </div>
      </div>
    `;

    bodyEl.querySelector('#tls-r-b1')?.addEventListener('change', (e) => {
      this.band1 = e.target.value;
      this._renderResistor(bodyEl);
    });
    bodyEl.querySelector('#tls-r-b2')?.addEventListener('change', (e) => {
      this.band2 = e.target.value;
      this._renderResistor(bodyEl);
    });
    bodyEl.querySelector('#tls-r-bm')?.addEventListener('change', (e) => {
      this.bandMult = e.target.value;
      this._renderResistor(bodyEl);
    });
    bodyEl.querySelector('#tls-r-bt')?.addEventListener('change', (e) => {
      this.bandTol = e.target.value;
      this._renderResistor(bodyEl);
    });
  }

  _renderMemo(bodyEl) {
    if (!bodyEl) return;
    const catBtns = MEMO_CATEGORIES.map(
      (c) =>
        `<button type="button" class="fmt-filter-pill ${this.memoCategory === c.id ? 'active' : ''}" data-memo-cat="${c.id}">${escapeHtml(c.label)}</button>`
    ).join('');

    bodyEl.innerHTML = `
      <div class="tls-card">
        <div class="tls-memo-toolbar">
          <input id="tls-memo-search" type="text" value="${escapeHtml(this.memoQuery)}" placeholder="Rechercher commande, port, VLAN, fibre..." />
          <div class="fmt-filter-row">${catBtns}</div>
        </div>
        <div id="tls-memo-list" class="tls-memo-list"></div>
      </div>
    `;

    const paintList = () => {
      const listEl = bodyEl.querySelector('#tls-memo-list');
      if (!listEl) return;
      const entries = filterCommandMemo(this.memoQuery, this.memoCategory);
      listEl.innerHTML =
        entries.length === 0
          ? '<div class="fmt-empty-state">Aucune entrée ne correspond à votre recherche.</div>'
          : entries
              .map(
                (it) => `
              <div class="tls-memo-item">
                <div class="tls-memo-head">
                  <strong>${escapeHtml(it.title)}</strong>
                  <button type="button" class="tls-copy-btn" data-copy-cmd="${escapeHtml(it.cmd)}">📋 Copier</button>
                </div>
                <code class="tls-memo-cmd">${escapeHtml(it.cmd)}</code>
                <p>${escapeHtml(it.desc)}</p>
              </div>`
              )
              .join('');

      listEl.querySelectorAll('[data-copy-cmd]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const txt = btn.dataset.copyCmd || '';
          navigator?.clipboard?.writeText?.(txt).catch(() => {});
          this.onToast?.(`📋 Copié : ${txt}`, 'info');
        });
      });
    };

    paintList();

    const searchEl = bodyEl.querySelector('#tls-memo-search');
    searchEl?.addEventListener('input', () => {
      this.memoQuery = searchEl.value;
      paintList();
    });
    bodyEl.querySelectorAll('[data-memo-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.memoCategory = btn.dataset.memoCat || 'all';
        this._renderMemo(bodyEl);
      });
    });
  }
}
