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
    {
      onStartGame,
      onStartVr,
      onOpenSettings,
      onOpenPlatform,
      onOpenFaq,
      onOpenChangelog,
      onOpenBattlePass,
      onOpenLeaderboard
    }
  ) {
    this.gameState = gameState;
    this.network = network;
    this.onStartGame = onStartGame;
    this.onStartVr = onStartVr;
    this.onOpenSettings = onOpenSettings;
    this.onOpenPlatform = onOpenPlatform;
    this.onOpenFaq = onOpenFaq;
    this.onOpenChangelog = onOpenChangelog;
    this.onOpenBattlePass = onOpenBattlePass;
    this.onOpenLeaderboard = onOpenLeaderboard;

    this.root = document.getElementById('start-screen');
    this.views = {
      home: document.getElementById('menu-view-home'),
      skin: document.getElementById('menu-view-skin')
    };

    this.nameInput = document.getElementById('player-name-input');
    this.previewTag = document.getElementById('preview-player-tag');
    this.badgeNameEl = document.getElementById('menu-badge-name');
    this.badgeLevelEl = document.getElementById('menu-badge-level');
    this.badgeAvgEl = document.getElementById('menu-badge-avg');

    this.roomSelect = document.getElementById('room-select');
    this.roomsModal = document.getElementById('rooms-modal');
    this.joinForm = document.getElementById('join-form');
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
        520,
        540,
        { interactivePodium: true, studioMode: 'daylight' }
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
      if (this.isRoomsModalOpen()) {
        this.refreshRooms(true);
      }
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
    const avg = typeof stats?.average === 'number' ? `${stats.average.toFixed(1)}/20` : '--/20';

    if (this.previewTag) this.previewTag.textContent = displayName;
    if (this.badgeNameEl) this.badgeNameEl.textContent = displayName;
    if (this.badgeLevelEl) this.badgeLevelEl.textContent = `Niv. ${level}`;
    if (this.badgeAvgEl) this.badgeAvgEl.textContent = avg;
  }

  renderSkinUi() {
    renderSkinControls(this.skinIds, this.gameState, () => {
      this.preview?.rebuild?.();
    });
  }

  selectRoom(roomCode) {
    const clean = String(roomCode || '').trim() || DEFAULT_ROOM;
    if (!this.roomSelect) return;
    const exists = Array.from(this.roomSelect.options).some((opt) => opt.value === clean);
    if (!exists) {
      const opt = document.createElement('option');
      opt.value = clean;
      opt.textContent = `Salle : ${clean}`;
      this.roomSelect.appendChild(opt);
    }
    this.roomSelect.value = clean;
  }

  isRoomsModalOpen() {
    return Boolean(this.roomsModal && !this.roomsModal.classList.contains('hidden'));
  }

  openRoomsModal() {
    this.roomsModal?.classList.remove('hidden');
    this.refreshRooms();
  }

  closeRoomsModal() {
    if (!this.roomsModal || this.roomsModal.classList.contains('hidden')) return false;
    this.roomsModal.classList.add('hidden');
    return true;
  }

  _bindEvents() {
    this.nameInput?.addEventListener('input', () => {
      this.syncPlayerBadge();
    });

    document.getElementById('menu-btn-quickplay')?.addEventListener('click', () => {
      this._launchWithRoom(this.roomSelect?.value || DEFAULT_ROOM, false);
    });

    document.getElementById('menu-btn-vr')?.addEventListener('click', () => {
      this._launchWithRoom(this.roomSelect?.value || DEFAULT_ROOM, true);
    });

    document.querySelectorAll('[data-nav]').forEach((tab) => {
      tab.addEventListener('click', () => {
        sfx.click();
        const target = tab.dataset.nav;
        if (target === 'skin') this.renderSkinUi();
        this.showView(target);
      });
    });

    document.getElementById('nav-btn-battlepass')?.addEventListener('click', () => {
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

    document.getElementById('menu-btn-leaderboard')?.addEventListener('click', () => {
      sfx.click();
      this.onOpenLeaderboard?.();
    });

    document.getElementById('menu-btn-rooms')?.addEventListener('click', () => {
      sfx.click();
      this.openRoomsModal();
    });

    document.getElementById('rooms-modal-close')?.addEventListener('click', () => {
      sfx.click();
      this.closeRoomsModal();
    });

    this.roomsModal?.addEventListener('click', (e) => {
      if (e.target === this.roomsModal) this.closeRoomsModal();
    });

    this.updatePlatformButton(this.gameState.touchMode);

    document.querySelectorAll('[data-back]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sfx.click();
        this.showView(btn.dataset.back);
      });
    });

    document.getElementById('btn-select-custom-room')?.addEventListener('click', () => {
      const code = this.customRoomInput?.value?.trim() || 'salle-perso';
      sfx.click();
      this.selectRoom(code);
      this.closeRoomsModal();
    });

    this.joinForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const room = this.customRoomInput?.value?.trim() || 'salle-perso';
      this.selectRoom(room);
      this.closeRoomsModal();
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

  _launchWithRoom(room, startVr = false) {
    const name = this.nameInput?.value?.trim() || 'Eleve_CIEL';
    const targetRoom = String(room || '').trim() || DEFAULT_ROOM;
    localStorage.setItem('ciel_player_name', name);
    sfx.interact();
    this.closeRoomsModal();
    this.hide();
    if (startVr && this.onStartVr) {
      this.onStartVr({ name, room: targetRoom, skin: this.gameState.skin });
    } else {
      this.onStartGame?.({ name, room: targetRoom, skin: this.gameState.skin });
    }
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
        <div class="aaa-room-actions">
          <button type="button" class="btn-hud btn-sm select-room-btn" data-room="${escapeHtml(r.room)}">Choisir</button>
          <button type="button" class="aaa-join-mini-btn join-room-btn" data-room="${escapeHtml(r.room)}">Rejoindre ▶</button>
        </div>
      </div>`
        )
        .join('');

      this.roomsListEl.querySelectorAll('.select-room-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          sfx.click();
          this.selectRoom(btn.dataset.room);
          this.closeRoomsModal();
        });
      });

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
        this.statusEl.innerHTML = `<span class="dot online"></span><span>En ligne • <strong>${count}</strong> joueur(s)</span>`;
      } else if (health?.timeout) {
        this.statusEl.innerHTML = '<span class="dot warn"></span><span>Serveur lent • Mode solo</span>';
      } else {
        this.statusEl.innerHTML = '<span class="dot error"></span><span>Hors ligne • Mode solo</span>';
      }
    } catch {
      this.statusEl.innerHTML = '<span class="dot error"></span><span>Hors ligne • Mode solo</span>';
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
    this.platformBtn.textContent = touchMode ? '📱' : '💻';
    this.platformBtn.title = touchMode
      ? 'Plateforme : Mobile / Tablette (cliquer pour changer)'
      : 'Plateforme : PC (cliquer pour changer)';
  }

  hide() {
    this.visible = false;
    this._stopPolling();
    this.preview?.setActive?.(false);
    this.closeRoomsModal();
    this.root?.classList.add('hidden');
  }
}
