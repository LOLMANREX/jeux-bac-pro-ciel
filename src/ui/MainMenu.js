import { sfx } from '../core/audio.js';
import { DEFAULT_ROOM } from '../core/network.js';
import { pickRandomSkin, renderSkinControls, SkinPreview3D } from './SkinCustomizer.js';

export class MainMenu {
  constructor(gameState, network, { onStartGame, onOpenSettings }) {
    this.gameState = gameState;
    this.network = network;
    this.onStartGame = onStartGame;
    this.onOpenSettings = onOpenSettings;

    this.root = document.getElementById('start-screen');
    this.views = {
      home: document.getElementById('menu-view-home'),
      play: document.getElementById('join-form'),
      join: document.getElementById('menu-view-join'),
      skin: document.getElementById('menu-view-skin')
    };

    this.nameInput = document.getElementById('player-name-input');
    this.previewTag = document.getElementById('preview-player-tag');
    this.roomSelect = document.getElementById('room-select');
    this.customRoomWrap = document.getElementById('custom-room-wrap');
    this.customRoomInput = document.getElementById('custom-room-input');
    this.roomsListEl = document.getElementById('rooms-list');
    this.directRoomInput = document.getElementById('direct-room-input');
    this.statusEl = document.getElementById('start-server-status');

    this.visible = true;
    this.skinIds = {
      style: 'skin-style-list',
      color: 'skin-color-list',
      hat: 'skin-hat-list',
      tone: 'skin-tone-list',
      pants: 'skin-pants-list'
    };

    this.preview = new SkinPreview3D(
      document.getElementById('skin-preview-canvas'),
      () => this.gameState.skin,
      320,
      380
    );
    this.preview.setActive(true);

    this._initName();
    this.renderSkinUi();
    this._bindEvents();
    this.pollTimer = null;
    this._startPolling();
  }

  _startPolling() {
    this._stopPolling();
    this.refreshHealth();
    this.pollTimer = setInterval(() => {
      if (!this.visible) return;
      this.refreshHealth();
      if (!this.views.join.classList.contains('hidden')) {
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
    this.nameInput.value = saved;
    this.previewTag.textContent = saved || 'Eleve_CIEL';
  }

  renderSkinUi() {
    renderSkinControls(this.skinIds, this.gameState, () => {
      this.preview.rebuild();
    });
  }

  _bindEvents() {
    this.nameInput.addEventListener('input', () => {
      const val = this.nameInput.value.trim();
      this.previewTag.textContent = val || 'Eleve_CIEL';
    });

    document.getElementById('menu-btn-quickplay')?.addEventListener('click', () => {
      this._launchWithRoom(DEFAULT_ROOM);
    });

    document.getElementById('menu-btn-play').addEventListener('click', () => {
      sfx.click();
      this.roomSelect.value = DEFAULT_ROOM;
      this.customRoomWrap.classList.add('hidden');
      this.showView('play');
    });

    document.getElementById('menu-btn-join').addEventListener('click', () => {
      sfx.click();
      this.showView('join');
      this.refreshRooms();
    });

    document.getElementById('menu-btn-skin').addEventListener('click', () => {
      sfx.click();
      this.renderSkinUi();
      this.showView('skin');
    });

    document.getElementById('menu-btn-settings').addEventListener('click', () => {
      sfx.click();
      this.onOpenSettings?.();
    });

    document.querySelectorAll('[data-back]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sfx.click();
        this.showView(btn.dataset.back);
      });
    });

    this.roomSelect.addEventListener('change', () => {
      this.customRoomWrap.classList.toggle('hidden', this.roomSelect.value !== 'custom');
    });

    this.views.play.addEventListener('submit', (e) => {
      e.preventDefault();
      let room = this.roomSelect.value;
      if (room === 'custom') {
        room = this.customRoomInput.value.trim() || 'salle-perso';
      }
      this._launchWithRoom(room);
    });

    document.getElementById('btn-refresh-rooms').addEventListener('click', () => {
      sfx.click();
      this.refreshRooms();
    });

    document.getElementById('btn-direct-join').addEventListener('click', () => {
      const code = this.directRoomInput.value.trim() || DEFAULT_ROOM;
      this._launchWithRoom(code);
    });

    document.getElementById('btn-skin-random').addEventListener('click', () => {
      sfx.click();
      this.gameState.setSkin(pickRandomSkin());
      this.preview.rebuild();
      this.renderSkinUi();
    });
  }

  _launchWithRoom(room) {
    const name = this.nameInput.value.trim() || 'Eleve_CIEL';
    localStorage.setItem('ciel_player_name', name);
    sfx.interact();
    this.hide();
    this.onStartGame?.({ name, room, skin: this.gameState.skin });
  }

  showView(name) {
    Object.entries(this.views).forEach(([k, el]) => {
      el?.classList.toggle('hidden', k !== name);
    });
  }

  async refreshRooms(silent = false) {
    if (!silent) {
      this.roomsListEl.innerHTML = '<p class="hint-mini">Recherche des salles actives...</p>';
    }
    const rooms = await this.network.fetchRooms();
    if (!rooms || rooms.length === 0) {
      this.roomsListEl.innerHTML = '<p class="hint-mini">Aucune salle détectée pour le moment.</p>';
      return;
    }
    this.roomsListEl.innerHTML = rooms
      .map(
        (r) => `
      <div class="room-row">
        <div>
          <strong>🏫 ${r.room}</strong>
          <div class="hint-mini">${r.count} élève(s) : ${r.players.length ? r.players.join(', ') : 'Salle prête'}</div>
        </div>
        <button type="button" class="btn-primary btn-sm join-room-btn" data-room="${r.room}">Rejoindre</button>
      </div>`
      )
      .join('');

    this.roomsListEl.querySelectorAll('.join-room-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._launchWithRoom(btn.dataset.room);
      });
    });
  }

  async refreshHealth() {
    const health = await this.network.checkHealth();
    if (health?.ok) {
      this.statusEl.innerHTML = `<span class="dot online"></span> Serveur CIEL connecté — <strong>${health.playersOnline}</strong> joueur(s) en ligne`;
    } else {
      const reason = health?.error ? ` (${health.error})` : '';
      this.statusEl.innerHTML = `<span class="dot error"></span> Serveur multijoueur inaccessible${reason} — Mode solo local`;
    }
  }

  show() {
    this.visible = true;
    this.root.classList.remove('hidden');
    this.renderSkinUi();
    this.preview.setActive(true);
    this.showView('home');
    this._startPolling();
  }

  hide() {
    this.visible = false;
    this._stopPolling();
    this.preview.setActive(false);
    this.root.classList.add('hidden');
  }
}
