import { sfx } from '../core/audio.js';
import { DEFAULT_ROOM } from '../core/network.js';
import { pickRandomSkin, renderSkinControls, SkinPreview3D } from './SkinCustomizer.js';

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export class MainMenu {
  constructor(
    gameState,
    network,
    { onStartGame, onOpenSettings, onOpenPlatform, onOpenFaq, onOpenChangelog, onOpenBattlePass }
  ) {
    this.gameState = gameState;
    this.network = network;
    this.onStartGame = onStartGame;
    this.onOpenSettings = onOpenSettings;
    this.onOpenPlatform = onOpenPlatform;
    this.onOpenFaq = onOpenFaq;
    this.onOpenChangelog = onOpenChangelog;
    this.onOpenBattlePass = onOpenBattlePass;

    this.root = document.getElementById('start-screen');
    this.views = {
      home: document.getElementById('menu-view-home'),
      skin: document.getElementById('menu-view-skin')
    };

    this.nameInput = document.getElementById('player-name-input');
    this.previewTag = document.getElementById('preview-player-tag');
    this.previewRankEl = document.getElementById('preview-player-rank');
    this.badgeNameEl = document.getElementById('menu-badge-name');
    this.badgeLevelEl = document.getElementById('menu-badge-level');
    this.badgeXpBarEl = document.getElementById('menu-badge-xp-bar');
    this.badgeXpEl = document.getElementById('menu-badge-xp');
    this.badgeAvgEl = document.getElementById('menu-badge-avg');

    this.joinForm = document.getElementById('join-form');
    this.roomSelect = document.getElementById('room-select');
    this.customRoomWrap = document.getElementById('custom-room-wrap');
    this.customRoomInput = document.getElementById('custom-room-input');
    this.roomsListEl = document.getElementById('rooms-list');
    this.statusEl = document.getElementById('start-server-status');
    this.platformBtn = document.getElementById('menu-btn-platform');

    this.visible = true;
    this.skinIds = {
      style: 'skin-style-list',
      color: 'skin-color-list',
      hat: 'skin-hat-list',
      tone: 'skin-tone-list',
      pants: 'skin-pants-list'
    };

    try {
      this.preview = new SkinPreview3D(
        document.getElementById('skin-preview-canvas'),
        () => this.gameState.skin,
        420,
        460,
        { interactivePodium: true }
      );
      this.preview.setActive(true);
    } catch (err) {
      console.warn('Aperçu 3D indisponible:', err);
      this.preview = null;
    }

    this._initName();
    this.renderSkinUi();
    this.syncPlayerBadge();
    this._bindEvents();
    this.gameState.subscribe(() => {
      if (this.visible) this.syncPlayerBadge();
    });

    this.pollTimer = null;
    this.healthPending = false;
    this.roomsPending = false;
    this._startPolling();
  }

  _startPolling() {
    this._stopPolling();
    this.refreshHealth();
    this.refreshRooms();
    this.pollTimer = setInterval(() => {
      if (!this.visible) return;
      this.refreshHealth();
      this.refreshRooms(true);
    }, 4000);
  }

  _stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  _initName() {
    const saved = localStorage.getItem('ciel_player_name') || '';
    if (this.nameInput) this.nameInput.value = saved;
    this.syncPlayerBadge();
  }

  syncPlayerBadge() {
    const typed = this.nameInput?.value?.trim() || '';
    const displayName = typed || this.gameState.profile.name || 'Eleve_CIEL';
    const lookupKey = displayName.toLowerCase();
    const lbMatch = (this.gameState.leaderboard || []).find(
      (row) => row.name?.toLowerCase() === lookupKey
    );
    const sameProfile = this.gameState.profile.name?.toLowerCase() === lookupKey;
    const stats = lbMatch || (sameProfile ? this.gameState.profile : null);

    const xp = Number.isFinite(stats?.xp) ? stats.xp : 0;
    const level = Math.max(1, Math.floor(xp / 100) + 1);
    const xpPct = Math.max(0, Math.min(100, xp % 100));
    const avg = typeof stats?.average === 'number' ? `${stats.average.toFixed(1)} / 20` : '-- / 20';
    const rankLabel = stats?.rankLabel || 'Apprenti CIEL';

    if (this.previewTag) this.previewTag.textContent = displayName;
    if (this.previewRankEl) this.previewRankEl.textContent = rankLabel.toUpperCase();
    if (this.badgeNameEl) this.badgeNameEl.textContent = displayName;
    if (this.badgeLevelEl) this.badgeLevelEl.textContent = `Niv. ${level}`;
    if (this.badgeXpBarEl) this.badgeXpBarEl.style.width = `${xpPct}%`;
    if (this.badgeXpEl) this.badgeXpEl.textContent = `${xp} XP`;
    if (this.badgeAvgEl) this.badgeAvgEl.textContent = avg;
  }

  renderSkinUi() {
    renderSkinControls(this.skinIds, this.gameState, () => {
      this.preview?.rebuild?.();
    });
  }

  _bindEvents() {
    this.nameInput?.addEventListener('input', () => {
      this.syncPlayerBadge();
    });

    document.getElementById('menu-btn-quickplay')?.addEventListener('click', () => {
      this._launchWithRoom(DEFAULT_ROOM);
    });

    document.querySelectorAll('[data-nav]').forEach((tab) => {
      tab.addEventListener('click', () => {
        sfx.click();
        const target = tab.dataset.nav;
        if (target === 'skin') this.renderSkinUi();
        this.showView(target);
      });
    });

    document.getElementById('podium-skin-shortcut')?.addEventListener('click', () => {
      sfx.click();
      this.renderSkinUi();
      this.showView('skin');
    });

    document.getElementById('nav-btn-battlepass')?.addEventListener('click', () => {
      sfx.click();
      this.onOpenBattlePass?.();
    });

    document.getElementById('menu-btn-battlepass')?.addEventListener('click', () => {
      sfx.click();
      this.onOpenBattlePass?.();
    });

    document.getElementById('menu-btn-settings')?.addEventListener('click', () => {
      sfx.click();
      this.onOpenSettings?.();
    });

    this.platformBtn?.addEventListener('click', () => {
      sfx.click();
      this.onOpenPlatform?.();
    });

    document.getElementById('menu-btn-faq')?.addEventListener('click', () => {
      sfx.click();
      this.onOpenFaq?.();
    });

    document.getElementById('menu-btn-changelog')?.addEventListener('click', () => {
      sfx.click();
      this.onOpenChangelog?.();
    });

    this.updatePlatformButton(this.gameState.touchMode);

    document.querySelectorAll('[data-back]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sfx.click();
        this.showView(btn.dataset.back);
      });
    });

    this.roomSelect?.addEventListener('change', () => {
      this.customRoomWrap?.classList.toggle('hidden', this.roomSelect.value !== 'custom');
    });

    this.joinForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      let room = this.roomSelect?.value || DEFAULT_ROOM;
      if (room === 'custom') {
        room = this.customRoomInput?.value?.trim() || 'salle-perso';
      }
      this._launchWithRoom(room);
    });

    document.getElementById('btn-refresh-rooms')?.addEventListener('click', () => {
      sfx.click();
      this.refreshRooms();
    });

    document.getElementById('btn-skin-random')?.addEventListener('click', () => {
      sfx.click();
      this.gameState.setSkin(pickRandomSkin());
      this.preview?.rebuild?.();
      this.renderSkinUi();
    });
  }

  _launchWithRoom(room) {
    const name = this.nameInput?.value?.trim() || 'Eleve_CIEL';
    localStorage.setItem('ciel_player_name', name);
    sfx.interact();
    this.hide();
    this.onStartGame?.({ name, room, skin: this.gameState.skin });
  }

  showView(name) {
    const viewName = this.views[name] ? name : 'home';
    Object.entries(this.views).forEach(([k, el]) => {
      el?.classList.toggle('hidden', k !== viewName);
    });
    document.querySelectorAll('[data-nav]').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.nav === viewName);
    });
  }

  async refreshRooms(silent = false) {
    if (!this.roomsListEl || this.roomsPending) return;
    this.roomsPending = true;
    if (!silent) {
      this.roomsListEl.innerHTML = '<p class="hint-mini">Recherche des salles actives...</p>';
    }
    try {
      const rooms = await this.network.fetchRooms(3000);
      if (!rooms || rooms.length === 0) {
        this.roomsListEl.innerHTML = '<p class="hint-mini">Aucune salle active — Plateau U300 prêt !</p>';
        return;
      }
      this.roomsListEl.innerHTML = rooms
        .map(
          (r) => `
      <div class="room-row aaa-room-row">
        <div class="aaa-room-meta">
          <strong>🏫 ${escapeHtml(r.room)}</strong>
          <div class="hint-mini">${r.count} élève(s) : ${
            r.players?.length ? r.players.map((p) => escapeHtml(p)).join(', ') : 'Salle prête'
          }</div>
        </div>
        <button type="button" class="aaa-join-mini-btn join-room-btn" data-room="${escapeHtml(r.room)}">Rejoindre ▶</button>
      </div>`
        )
        .join('');

      this.roomsListEl.querySelectorAll('.join-room-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          this._launchWithRoom(btn.dataset.room);
        });
      });
    } catch {
      if (!silent) {
        this.roomsListEl.innerHTML = '<p class="hint-mini">Impossible de récupérer les salles.</p>';
      }
    } finally {
      this.roomsPending = false;
    }
  }

  async refreshHealth() {
    if (!this.statusEl || this.healthPending) return;
    this.healthPending = true;
    try {
      const health = await this.network.checkHealth(3000);
      if (health?.ok) {
        const count = Number.isFinite(health.playersOnline) ? health.playersOnline : 0;
        this.statusEl.innerHTML = `<span class="dot online"></span> Serveur CIEL en ligne — <strong>${count}</strong> joueur(s) connecté(s)`;
      } else if (health?.timeout) {
        this.statusEl.innerHTML =
          '<span class="dot warn"></span> Serveur lent (timeout 3s) — Mode solo disponible';
      } else {
        const reason = health?.error ? ` (${escapeHtml(health.error)})` : '';
        this.statusEl.innerHTML = `<span class="dot error"></span> Serveur hors ligne${reason} — Mode solo local`;
      }
    } catch {
      this.statusEl.innerHTML =
        '<span class="dot error"></span> Serveur hors ligne — Mode solo local';
    } finally {
      this.healthPending = false;
    }
  }

  show() {
    this.visible = true;
    this.root?.classList.remove('hidden');
    this.renderSkinUi();
    this.syncPlayerBadge();
    this.preview?.setActive?.(true);
    this.updatePlatformButton(this.gameState.touchMode);
    this.showView('home');
    this._startPolling();
  }

  updatePlatformButton(touchMode) {
    if (!this.platformBtn) return;
    this.platformBtn.textContent = touchMode ? 'PLATEFORME 📱' : 'PLATEFORME 💻';
  }

  hide() {
    this.visible = false;
    this._stopPolling();
    this.preview?.setActive?.(false);
    this.root?.classList.add('hidden');
  }
}
