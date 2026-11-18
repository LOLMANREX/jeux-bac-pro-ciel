import { sfx } from '../core/audio.js';
import { getBattlePassSkinId } from '../core/battlePassSkins.js';
import { getAllTps } from '../core/gameState.js';
import { DEFAULT_ROOM } from '../core/network.js';
import { ASCENSION_SPECIALTIES, ULTIMATE_SECRET_SKIN_ID } from '../world/AvatarBuilder.js';
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
      onOpenShop,
      onOpenLeaderboard,
      onLogout,
      onAccountRestored
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
    this.onOpenShop = onOpenShop;
    this.onOpenLeaderboard = onOpenLeaderboard;
    this.onLogout = onLogout;
    this.onAccountRestored = onAccountRestored;

    this.root = document.getElementById('start-screen');
    this.views = {
      home: document.getElementById('menu-view-home'),
      skin: document.getElementById('menu-view-skin')
    };

    this.nameInput = document.getElementById('player-name-input');
    this.authGuestView = document.getElementById('auth-guest-view');
    this.authSessionCard = document.getElementById('auth-session-card');
    this.authTabLogin = document.getElementById('auth-tab-login');
    this.authTabRegister = document.getElementById('auth-tab-register');
    this.authLoginForm = document.getElementById('auth-login-form');
    this.authRegisterForm = document.getElementById('auth-register-form');
    this.loginUserEl = document.getElementById('auth-login-username');
    this.loginPassEl = document.getElementById('auth-login-password');
    this.regUserEl = document.getElementById('auth-register-username');
    this.regPassEl = document.getElementById('auth-register-password');
    this.regConfirmEl = document.getElementById('auth-register-confirm');
    this.authFeedbackEl = document.getElementById('auth-feedback');
    this.connectedUsernameEl = document.getElementById('auth-connected-username');
    this.connectedMetaEl = document.getElementById('auth-connected-meta');
    this.logoutBtn = document.getElementById('menu-btn-logout');
    this.activeAuthTab = 'login';
    this.authBusy = false;

    this.previewTag = document.getElementById('preview-player-tag');
    this.badgeNameEl = document.getElementById('menu-badge-name');
    this.badgeLevelEl = document.getElementById('menu-badge-level');
    this.badgeAvgEl = document.getElementById('menu-badge-avg');
    this.badgeCoinsEl = document.getElementById('menu-badge-coins');

    this.roomSelect = document.getElementById('room-select');
    this.roomsModal = document.getElementById('rooms-modal');
    this.joinForm = document.getElementById('join-form');
    this.customRoomInput = document.getElementById('custom-room-input');
    this.roomsListEl = document.getElementById('rooms-list');
    this.statusEl = document.getElementById('start-server-status');
    this.platformBtn = document.getElementById('menu-btn-platform');

    this.visible = true;
    this.skinIds = {
      divine: 'skin-divine-list',
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
    this.syncAuthUi();
    this.syncPlayerBadge();
    this._bindEvents();
    this.gameState.subscribe(() => {
      if (this.visible) {
        this.syncAuthUi();
        this.syncPlayerBadge();
      }
    });

    this.pollTimer = null;
    this.healthPending = false;
    this.roomsPending = false;
    this._startPolling();
    this._restoreSessionOnStartup();
  }

  async _restoreSessionOnStartup() {
    const token = this.network.getAuthToken();
    if (!token) {
      this.syncAuthUi();
      return;
    }
    const res = await this.network.fetchCurrentAccount(token);
    if (res.ok && res.account) {
      this.gameState.setAccount(res.account, res.token || token, res.profile);
      if (this.nameInput) this.nameInput.value = res.account.username;
      this.preview?.rebuild?.();
      this.renderSkinUi();
      this.syncAuthUi();
      this.syncPlayerBadge();
      this.onAccountRestored?.(res.account, res.profile);
    } else if (res.status === 401) {
      this.gameState.clearAccount();
      if (this.nameInput) this.nameInput.value = '';
      this.preview?.rebuild?.();
      this.renderSkinUi();
      this.syncAuthUi();
      this.syncPlayerBadge();
    }
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
    if (this.loginUserEl && saved) this.loginUserEl.value = saved;
    this.syncPlayerBadge();
  }

  switchAuthTab(tabName) {
    this.activeAuthTab = tabName === 'register' ? 'register' : 'login';
    this.authTabLogin?.classList.toggle('active', this.activeAuthTab === 'login');
    this.authTabLogin?.setAttribute('aria-selected', String(this.activeAuthTab === 'login'));
    this.authTabRegister?.classList.toggle('active', this.activeAuthTab === 'register');
    this.authTabRegister?.setAttribute('aria-selected', String(this.activeAuthTab === 'register'));
    this.authLoginForm?.classList.toggle('hidden', this.activeAuthTab !== 'login');
    this.authRegisterForm?.classList.toggle('hidden', this.activeAuthTab !== 'register');
    this.showAuthFeedback('', 'info');
    this.syncPlayerBadge();
  }

  showAuthFeedback(message, type = 'error') {
    if (!this.authFeedbackEl) return;
    if (!message) {
      this.authFeedbackEl.textContent = '';
      this.authFeedbackEl.className = 'aaa-auth-feedback hidden';
      return;
    }
    this.authFeedbackEl.textContent = message;
    this.authFeedbackEl.className = `aaa-auth-feedback ${type}`;
  }

  syncAuthUi() {
    const isAuth = this.gameState.isAuthenticated();
    this.authGuestView?.classList.toggle('hidden', isAuth);
    this.authSessionCard?.classList.toggle('hidden', !isAuth);

    if (isAuth && this.gameState.account) {
      const acc = this.gameState.account;
      if (this.nameInput) this.nameInput.value = acc.username;
      if (this.connectedUsernameEl) {
        this.connectedUsernameEl.textContent = acc.username;
      }
      if (this.connectedMetaEl) {
        const allTps = getAllTps();
        const grades = this.gameState.profile?.grades || acc.tpScores || {};
        const tps20 = allTps.filter((tp) => Number(grades[tp.id]) === 20).length;
        const divines = (this.gameState.unlockedDivineSkins || []).length;
        const secretTag = this.gameState.secretSkinUnlocked ? ' • 🌌 Skin Secret' : '';
        const bpTiers = this.gameState.unlockedBattlePassTiers || [];
        const vipTag = bpTiers.length
          ? ` • 🔑 Passe VIP (P.${bpTiers.join(',')})`
          : '';
        this.connectedMetaEl.textContent = `🏆 ${tps20}/${allTps.length} TP à 20/20 • ⚡ ${divines}/${ASCENSION_SPECIALTIES.length} Skins Divins${secretTag}${vipTag}`;
      }
    }
  }

  syncPlayerBadge() {
    const activeTyped =
      this.activeAuthTab === 'register'
        ? this.regUserEl?.value?.trim()
        : this.loginUserEl?.value?.trim();
    const displayName =
      (this.gameState.isAuthenticated() && this.gameState.account?.username) ||
      activeTyped ||
      this.nameInput?.value?.trim() ||
      this.gameState.profile.name ||
      'Eleve_CIEL';
    if (this.nameInput) {
      this.nameInput.value = displayName === 'Eleve_CIEL' ? '' : displayName;
    }
    const lookupKey = displayName.toLowerCase();
    const lbMatch = (this.gameState.leaderboard || []).find(
      (row) => row.name?.toLowerCase() === lookupKey
    );
    const sameProfile = this.gameState.profile.name?.toLowerCase() === lookupKey;
    const stats = lbMatch || (sameProfile ? this.gameState.profile : null);

    const xp = Number.isFinite(stats?.xp) ? stats.xp : 0;
    const level = Math.max(1, Math.floor(xp / 100) + 1);
    const avg = typeof stats?.average === 'number' ? `${stats.average.toFixed(1)}/20` : '--/20';

    const coins = Math.max(0, Math.floor(Number(stats?.coins ?? this.gameState.coins ?? this.gameState.profile?.coins) || 0));

    if (this.previewTag) this.previewTag.textContent = displayName;
    if (this.badgeNameEl) this.badgeNameEl.textContent = displayName;
    if (this.badgeLevelEl) this.badgeLevelEl.textContent = `Niv. ${level}`;
    if (this.badgeAvgEl) this.badgeAvgEl.textContent = avg;
    if (this.badgeCoinsEl) this.badgeCoinsEl.textContent = `🪙 ${coins} CC`;
  }

  renderSkinUi() {
    renderSkinControls(this.skinIds, this.gameState, (updatedSkin) => {
      this.preview?.rebuild?.();
      if (this.gameState.isAuthenticated()) {
        const nextSel = updatedSkin?.secretSkin
          ? ULTIMATE_SECRET_SKIN_ID
          : updatedSkin?.divineSpecialty ||
            (updatedSkin?.battlePassTier
              ? getBattlePassSkinId(updatedSkin.battlePassTier)
              : 'standard');
        this.network.saveAccount({
          selectedSkin: nextSel,
          avatarCustomization: updatedSkin,
          unlockedDivineSkins: this.gameState.unlockedDivineSkins
        });
      }
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

  async _submitLogin() {
    if (this.authBusy) return false;
    const username = this.loginUserEl?.value?.trim() || '';
    const password = this.loginPassEl?.value?.trim() || '';
    if (!username || !password) {
      this.showAuthFeedback('Veuillez renseigner votre identifiant et votre mot de passe.', 'error');
      return false;
    }
    this.authBusy = true;
    this.showAuthFeedback('Connexion au compte élève...', 'info');
    try {
      const res = await this.network.loginAccount({ username, password });
      if (!res.ok || !res.account) {
        this.showAuthFeedback(res.error || 'Identifiant ou mot de passe incorrect.', 'error');
        return false;
      }
      sfx.interact();
      this.gameState.setAccount(res.account, res.token, res.profile);
      if (this.loginPassEl) this.loginPassEl.value = '';
      this.showAuthFeedback('', 'info');
      this.preview?.rebuild?.();
      this.renderSkinUi();
      this.syncAuthUi();
      this.syncPlayerBadge();
      this.onAccountRestored?.(res.account, res.profile);
      return true;
    } finally {
      this.authBusy = false;
    }
  }

  async _submitRegister() {
    if (this.authBusy) return false;
    const username = this.regUserEl?.value?.trim() || '';
    const password = this.regPassEl?.value?.trim() || '';
    const confirmPassword = this.regConfirmEl?.value?.trim() || '';
    if (!username || username.length < 2) {
      this.showAuthFeedback('Veuillez choisir un identifiant de 2 à 22 caractères.', 'error');
      return false;
    }
    if (!password || password.length < 3) {
      this.showAuthFeedback('Le mot de passe doit contenir au moins 3 caractères.', 'error');
      return false;
    }
    if (password !== confirmPassword) {
      this.showAuthFeedback('La confirmation du mot de passe ne correspond pas.', 'error');
      return false;
    }
    this.authBusy = true;
    this.showAuthFeedback('Création de votre compte élève...', 'info');
    try {
      const cleanCustomSkin = { ...this.gameState.skin };
      delete cleanCustomSkin.divineSpecialty;
      const res = await this.network.registerAccount({
        username,
        password,
        confirmPassword,
        avatarCustomization: cleanCustomSkin,
        selectedSkin: 'standard'
      });
      if (!res.ok || !res.account) {
        this.showAuthFeedback(res.error || 'Impossible de créer le compte.', 'error');
        return false;
      }
      sfx.interact();
      this.gameState.setAccount(res.account, res.token, res.profile);
      if (this.regPassEl) this.regPassEl.value = '';
      if (this.regConfirmEl) this.regConfirmEl.value = '';
      this.showAuthFeedback('', 'info');
      this.preview?.rebuild?.();
      this.renderSkinUi();
      this.syncAuthUi();
      this.syncPlayerBadge();
      this.onAccountRestored?.(res.account, res.profile);
      return true;
    } finally {
      this.authBusy = false;
    }
  }

  handleLogout() {
    sfx.click();
    this.network.logoutAccount();
    this.gameState.clearAccount();
    if (this.loginPassEl) this.loginPassEl.value = '';
    if (this.regPassEl) this.regPassEl.value = '';
    if (this.regConfirmEl) this.regConfirmEl.value = '';
    this.showAuthFeedback('Vous êtes déconnecté de votre compte élève.', 'info');
    this.preview?.rebuild?.();
    this.renderSkinUi();
    this.syncAuthUi();
    this.syncPlayerBadge();
    this.onLogout?.();
  }

  _bindEvents() {
    this.authTabLogin?.addEventListener('click', () => {
      sfx.click();
      this.switchAuthTab('login');
    });

    this.authTabRegister?.addEventListener('click', () => {
      sfx.click();
      this.switchAuthTab('register');
    });

    this.loginUserEl?.addEventListener('input', () => this.syncPlayerBadge());
    this.regUserEl?.addEventListener('input', () => this.syncPlayerBadge());
    this.nameInput?.addEventListener('input', () => this.syncPlayerBadge());

    this.authLoginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this._submitLogin();
    });

    this.authRegisterForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this._submitRegister();
    });

    this.logoutBtn?.addEventListener('click', () => {
      this.handleLogout();
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

    document.getElementById('nav-btn-shop')?.addEventListener('click', () => {
      sfx.click();
      this.onOpenShop?.();
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

    document.getElementById('menu-btn-replay-intro')?.addEventListener('click', () => {
      this._launchWithRoom(this.roomSelect?.value || DEFAULT_ROOM, false, true);
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
      const randomSkin = pickRandomSkin();
      this.gameState.setSkin(randomSkin);
      this.preview?.rebuild?.();
      this.renderSkinUi();
      if (this.gameState.isAuthenticated()) {
        this.network.saveAccount({
          selectedSkin: 'standard',
          avatarCustomization: this.gameState.skin,
          unlockedDivineSkins: this.gameState.unlockedDivineSkins
        });
      }
    });
  }

  async _launchWithRoom(room, startVr = false, forceIntro = false) {
    if (!this.gameState.isAuthenticated()) {
      const hasInput =
        this.activeAuthTab === 'register'
          ? Boolean(this.regUserEl?.value?.trim() && this.regPassEl?.value?.trim())
          : Boolean(this.loginUserEl?.value?.trim() && this.loginPassEl?.value?.trim());
      if (hasInput) {
        const ok =
          this.activeAuthTab === 'register'
            ? await this._submitRegister()
            : await this._submitLogin();
        if (!ok) return;
      } else {
        this.showView('home');
        this.showAuthFeedback(
          'Veuillez vous connecter ou créer un compte élève pour rejoindre le Plateau U300.',
          'error'
        );
        return;
      }
    }

    const name =
      this.gameState.account?.username ||
      this.nameInput?.value?.trim() ||
      'Eleve_CIEL';
    const targetRoom = String(room || '').trim() || DEFAULT_ROOM;
    localStorage.setItem('ciel_player_name', name);
    sfx.interact();
    this.closeRoomsModal();
    this.hide();
    if (startVr && this.onStartVr) {
      this.onStartVr({ name, room: targetRoom, skin: this.gameState.skin, forceIntro: Boolean(forceIntro) });
    } else {
      this.onStartGame?.({ name, room: targetRoom, skin: this.gameState.skin, forceIntro: Boolean(forceIntro) });
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
    this.syncAuthUi();
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
