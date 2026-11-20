import { computeFormativeStats } from '../core/formativeCatalog.js';
import { CampusMapApp } from './tablet/CampusMapApp.js';
import { CielToolsApp } from './tablet/CielToolsApp.js';
import { FormativeApp } from './tablet/FormativeApp.js';
import { GradesApp } from './tablet/GradesApp.js';

function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function shouldHandleTabShortcut(ctx = {}) {
  const {
    joined = false,
    isTyping = false,
    subModalActive = false,
    isDetentionSeated = false,
    isOtherModalOpen = false,
    inCombatMatch = false,
    tabletOpen = false
  } = ctx || {};
  if (!joined || isTyping || subModalActive || isDetentionSeated) return false;
  if (inCombatMatch) return false;
  if (isOtherModalOpen && !tabletOpen) return false;
  return true;
}

export const TABLET_APPS_META = [
  {
    id: 'formative',
    title: 'CIEL Formative',
    subtitle: 'TP interactifs & correction live',
    icon: '📝',
    accent: '#38bdf8'
  },
  {
    id: 'map',
    title: 'Campus Map',
    subtitle: 'Plan multi-étages & repères',
    icon: '🗺️',
    accent: '#10b981'
  },
  {
    id: 'grades',
    title: 'Notes & Suivi',
    subtitle: 'Moyenne /20 & badges CIEL',
    icon: '📊',
    accent: '#fbbf24'
  },
  {
    id: 'tools',
    title: 'Outils CIEL',
    subtitle: 'IP/CIDR, Résistances & Mémo',
    icon: '🧰',
    accent: '#a855f7'
  }
];

function formatClock() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export class TabletOS {
  constructor(options = {}) {
    this.gameState = options.gameState;
    this.network = options.network;
    this.rootEl =
      options.rootEl ||
      (typeof document !== 'undefined' ? document.getElementById('tablet-os-overlay') : null);
    this.onOpen = options.onOpen || null;
    this.onClose = options.onClose || null;
    this.onFormativeReward = options.onFormativeReward || null;
    this.onWaypointChange = options.onWaypointChange || null;
    this.onSelectTpStation = options.onSelectTpStation || null;
    this.onToast = options.onToast || null;

    this.opened = false;
    this.activeApp = null;
    this.history = [];
    this.connectionStatus = {
      state: 'solo',
      connected: false,
      onlineCount: 1,
      room: 'plateau-u300',
      pingMs: null
    };
    this.lastLiveData = null;
    this.batteryPct = 96;

    this.apps = {
      formative: new FormativeApp({
        gameState: this.gameState,
        onSubmitProgress: async (tpId, answers) => {
          const playerName =
            this.gameState?.account?.username ||
            this.gameState?.profile?.name ||
            'Eleve_CIEL';
          if (typeof this.network?.submitFormativeProgress === 'function') {
            const res = await this.network.submitFormativeProgress(tpId, answers, playerName);
            if (res?.ok && res.profile) {
              this.gameState?.setProfile?.(res.profile);
            }
            return res;
          }
          return null;
        },
        onOpenTools: () => this.openApp('tools'),
        onReward: (res) => this.onFormativeReward?.(res),
        onToast: (msg, kind) => this.onToast?.(msg, kind)
      }),
      map: new CampusMapApp({
        mapData: options.mapData || null,
        onWaypointChange: (wp) => {
          this.onWaypointChange?.(wp);
          if (this.opened && !this.activeApp) {
            this._renderViewport();
          }
        },
        onSelectTp: (tpId) => this.onSelectTpStation?.(tpId)
      }),
      grades: new GradesApp({
        gameState: this.gameState,
        onOpenFormativeTp: (tpId) => this.openApp('formative', { tpId })
      }),
      tools: new CielToolsApp({
        onToast: (msg, kind) => this.onToast?.(msg, kind)
      })
    };

    this._unsubscribe = this.gameState?.subscribe?.(() => {
      this._syncStatusBar();
      if (this.opened && this.activeApp === null) {
        this._renderViewport();
      } else if (this.opened && this.activeApp === 'grades') {
        this.apps.grades.render();
      }
    });

    this._clockTimer =
      typeof setInterval !== 'undefined'
        ? setInterval(() => {
            if (this.opened) this._syncClock();
          }, 15000)
        : null;

    this._buildShell();
  }

  _buildShell() {
    if (!this.rootEl) return;
    this.rootEl.innerHTML = `
      <div class="tablet-chassis" role="document">
        <div class="tablet-camera-dot" aria-hidden="true"></div>
        <div class="tablet-screen">
          <header class="tablet-statusbar">
            <div class="tablet-sb-left">
              <span id="tablet-clock" class="tablet-clock">${formatClock()}</span>
              <span class="tablet-os-badge">CIEL OS Tab</span>
            </div>
            <div class="tablet-sb-right">
              <span id="tablet-conn-pill" class="tablet-conn-pill state-solo">
                <span class="tablet-conn-dot"></span>
                <span id="tablet-conn-text">Mode Solo</span>
              </span>
              <span id="tablet-coins-pill" class="tablet-coins-pill" title="Solde CIEL Coins en temps réel">
                🪙 <strong id="tablet-coins-val">0</strong> CC
              </span>
              <span id="tablet-battery" class="tablet-battery" title="Batterie tablette">${this.batteryPct}% 🔋</span>
            </div>
          </header>

          <main id="tablet-viewport" class="tablet-viewport"></main>

          <footer class="tablet-navbar">
            <button type="button" id="tablet-nav-back" class="tablet-nav-btn" title="Retour">
              <span>◀</span><span>Retour</span>
            </button>
            <button type="button" id="tablet-nav-home" class="tablet-nav-btn primary" title="Accueil de la tablette">
              <span>⌂</span><span>Accueil</span>
            </button>
            <button type="button" id="tablet-nav-close" class="tablet-nav-btn danger" title="Fermer la tablette (Tab / Échap)">
              <span>✕</span><span>Fermer</span>
            </button>
          </footer>
        </div>
      </div>
    `;

    this.clockEl = this.rootEl.querySelector('#tablet-clock');
    this.connPillEl = this.rootEl.querySelector('#tablet-conn-pill');
    this.connTextEl = this.rootEl.querySelector('#tablet-conn-text');
    this.coinsValEl = this.rootEl.querySelector('#tablet-coins-val');
    this.viewportEl = this.rootEl.querySelector('#tablet-viewport');
    this.btnBack = this.rootEl.querySelector('#tablet-nav-back');
    this.btnHome = this.rootEl.querySelector('#tablet-nav-home');
    this.btnClose = this.rootEl.querySelector('#tablet-nav-close');

    this.btnBack?.addEventListener('click', () => this.goBack());
    this.btnHome?.addEventListener('click', () => this.goHome());
    this.btnClose?.addEventListener('click', () => this.close());

    this._onBackdropClick = (e) => {
      if (e.target === this.rootEl) {
        this.close();
      }
    };
    this.rootEl.addEventListener('click', this._onBackdropClick);
    this._syncStatusBar();
  }

  _syncClock() {
    if (this.clockEl) {
      this.clockEl.textContent = formatClock();
    }
  }

  _syncStatusBar() {
    this._syncClock();
    const coins = Math.max(
      0,
      Math.floor(Number(this.gameState?.coins ?? this.gameState?.profile?.coins) || 0)
    );
    if (this.coinsValEl) {
      this.coinsValEl.textContent = String(coins);
    }
    if (this.connPillEl && this.connTextEl) {
      const st = String(this.connectionStatus.state || 'solo');
      this.connPillEl.className = `tablet-conn-pill state-${st}`;
      if (this.connectionStatus.connected) {
        const ping =
          Number.isFinite(Number(this.connectionStatus.pingMs)) && Number(this.connectionStatus.pingMs) > 0
            ? ` • ${Math.round(this.connectionStatus.pingMs)}ms`
            : '';
        this.connTextEl.textContent = `Connecté (${Math.max(1, Number(this.connectionStatus.onlineCount) || 1)})${ping}`;
      } else if (st === 'connecting' || st === 'reconnecting') {
        this.connTextEl.textContent = 'Connexion...';
      } else if (st === 'error') {
        this.connTextEl.textContent = 'Hors ligne';
      } else {
        this.connTextEl.textContent = 'Mode Solo';
      }
    }
  }

  isOpen() {
    return this.opened;
  }

  open(appId = null, params = {}) {
    if (!this.opened) {
      this.opened = true;
      this.rootEl?.classList.remove('hidden');
      this.onOpen?.();
    }
    this._syncStatusBar();
    if (appId && this.apps[appId]) {
      this.openApp(appId, params);
    } else {
      this._renderViewport();
    }
    return true;
  }

  close({ restoreControls = true } = {}) {
    if (!this.opened) return false;
    this.opened = false;
    this._unmountActiveApp();
    this.rootEl?.classList.add('hidden');
    this.onClose?.({ restoreControls });
    return true;
  }

  toggle() {
    if (this.opened) {
      this.close();
      return false;
    }
    this.open();
    return true;
  }

  _unmountActiveApp() {
    if (this.activeApp && this.apps[this.activeApp]?.unmount) {
      this.apps[this.activeApp].unmount();
    }
  }

  openApp(appId, params = {}) {
    if (!this.apps[appId]) return false;
    if (this.activeApp && this.activeApp !== appId) {
      this.history.push(this.activeApp);
    }
    this._unmountActiveApp();
    this.activeApp = appId;
    this._renderViewport(params);
    return true;
  }

  goHome() {
    if (this.activeApp === null) return;
    this._unmountActiveApp();
    this.activeApp = null;
    this.history = [];
    this._renderViewport();
  }

  goBack() {
    if (this.activeApp && typeof this.apps[this.activeApp]?.canGoBack === 'function' && this.apps[this.activeApp].canGoBack()) {
      const handled = this.apps[this.activeApp].goBack();
      if (handled) return true;
    }
    if (this.history.length > 0) {
      const prevApp = this.history.pop();
      this._unmountActiveApp();
      this.activeApp = prevApp;
      this._renderViewport();
      return true;
    }
    if (this.activeApp !== null) {
      this.goHome();
      return true;
    }
    this.close();
    return true;
  }

  _renderViewport(params = {}) {
    if (!this.viewportEl) return;
    if (!this.activeApp) {
      this._renderHomeScreen();
      return;
    }
    this.viewportEl.innerHTML = '<div id="tablet-app-host" class="tablet-app-host"></div>';
    const host = this.viewportEl.querySelector('#tablet-app-host');
    const app = this.apps[this.activeApp];
    if (app && host) {
      app.mount(host, params);
      if (this.activeApp === 'map' && this.lastLiveData) {
        app.updateLive?.(this.lastLiveData);
      }
    }
  }

  _renderHomeScreen() {
    if (!this.viewportEl) return;
    const playerName =
      this.gameState?.account?.username || this.gameState?.profile?.name || 'Eleve_CIEL';
    const stats = computeFormativeStats(
      this.gameState?.formativeProgress || this.gameState?.profile?.formativeProgress || {},
      this.gameState?.formativeRewardedTps || this.gameState?.profile?.formativeRewardedTps || []
    );
    const wp = this.apps.map?.getWaypoint?.() || null;

    const badgesByApp = {
      formative: `${stats.validatedCount}/${stats.totalTps} validés`,
      map: wp ? `📍 ${wp.label}` : 'Multi-étages',
      grades: stats.averageScore !== null ? `${stats.averageScore.toFixed(1)}/20` : '--/20',
      tools: '3 utilitaires'
    };

    const tilesHtml = TABLET_APPS_META.map(
      (app) => `
      <button type="button" class="tablet-app-tile" data-launch-app="${app.id}" style="--app-accent: ${app.accent}">
        <span class="tablet-app-icon">${app.icon}</span>
        <span class="tablet-app-meta">
          <strong>${escapeHtml(app.title)}</strong>
          <small>${escapeHtml(app.subtitle)}</small>
        </span>
        <span class="tablet-app-badge">${escapeHtml(badgesByApp[app.id] || '')}</span>
      </button>`
    ).join('');

    this.viewportEl.innerHTML = `
      <div class="tablet-home">
        <div class="tablet-home-hero">
          <div>
            <div class="tablet-home-kicker">ATELIER CIEL 3D • TABLETTE ÉLÈVE</div>
            <h1>Bonjour, ${escapeHtml(playerName)}</h1>
            <p>Consultez le plan interactif du campus, réalisez vos TP Formative et suivez vos notes en temps réel.</p>
          </div>
          <div class="tablet-home-widgets">
            <div class="tablet-widget-card">
              <span>Formative</span>
              <strong>${stats.overallPct}%</strong>
            </div>
            <div class="tablet-widget-card">
              <span>Moyenne</span>
              <strong>${stats.averageScore !== null ? `${stats.averageScore.toFixed(1)}/20` : '--/20'}</strong>
            </div>
          </div>
        </div>

        <div class="tablet-app-grid">${tilesHtml}</div>

        <div class="tablet-home-tip">
          <span>💡 Raccourci clavier : appuyez sur <kbd>Tab</kbd> pour ouvrir/fermer la tablette à tout moment.</span>
        </div>
      </div>
    `;

    this.viewportEl.querySelectorAll('[data-launch-app]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.launchApp;
        if (id) this.openApp(id);
      });
    });
  }

  refresh() {
    this._syncStatusBar();
    if (!this.opened) return;
    if (this.activeApp === null) {
      this._renderHomeScreen();
    } else if (this.activeApp === 'grades') {
      this.apps.grades.render();
    } else if (this.activeApp === 'formative' && !this.apps.formative.activeTpId) {
      this.apps.formative.render();
    }
  }

  setConnectionStatus(status = {}) {
    this.connectionStatus = { ...this.connectionStatus, ...status };
    this._syncStatusBar();
  }

  setMapData(mapData) {
    this.apps.map?.setMapData?.(mapData);
  }

  updateLiveMap(liveData) {
    this.lastLiveData = liveData;
    if (this.opened && this.activeApp === 'map') {
      this.apps.map?.updateLive?.(liveData);
    }
  }

  getWaypoint() {
    return this.apps.map?.getWaypoint?.() || null;
  }

  setWaypoint(wp) {
    return this.apps.map?.setWaypoint?.(wp) || null;
  }

  clearWaypoint() {
    this.apps.map?.clearWaypoint?.();
  }

  destroy() {
    this._unmountActiveApp();
    if (this._clockTimer) {
      clearInterval(this._clockTimer);
      this._clockTimer = null;
    }
    if (typeof this._unsubscribe === 'function') {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    if (this.rootEl && this._onBackdropClick) {
      this.rootEl.removeEventListener('click', this._onBackdropClick);
    }
  }
}
