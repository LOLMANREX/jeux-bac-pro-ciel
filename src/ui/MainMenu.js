import * as THREE from 'three';
import { sfx } from '../core/audio.js';
import { buildStudentAvatarMesh, SKIN_OPTIONS } from '../world/AvatarBuilder.js';

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
    this.animId = null;
    this.previewYaw = 0.35;
    this.previewDragging = false;
    this.lastMouseX = 0;
    this.avatarGroup = null;

    this._initName();
    this._initPreview3D();
    this._renderSkinControls();
    this._bindEvents();
    this.refreshHealth();
  }

  _initName() {
    const saved = localStorage.getItem('ciel_player_name') || '';
    this.nameInput.value = saved;
    this.previewTag.textContent = saved || 'Eleve_CIEL';
  }

  _initPreview3D() {
    const canvas = document.getElementById('skin-preview-canvas');
    if (!canvas) return;
    this.previewRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.previewRenderer.setSize(320, 380, false);

    this.previewScene = new THREE.Scene();
    this.previewCamera = new THREE.PerspectiveCamera(40, 320 / 380, 0.1, 20);
    this.previewCamera.position.set(0, 1.15, 3.2);
    this.previewCamera.lookAt(0, 0.95, 0);

    const hemi = new THREE.HemisphereLight('#f8fafc', '#1e293b', 1.1);
    this.previewScene.add(hemi);
    const dir = new THREE.DirectionalLight('#ffffff', 1.3);
    dir.position.set(2, 4, 3);
    this.previewScene.add(dir);

    // Pedestal
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.85, 0.1, 32),
      new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.4, metalness: 0.5 })
    );
    pedestal.position.y = -0.05;
    this.previewScene.add(pedestal);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 0.78, 32),
      new THREE.MeshBasicMaterial({ color: '#22d3ee', side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    this.previewScene.add(ring);

    this.rebuildPreviewAvatar();

    canvas.addEventListener('mousedown', (e) => {
      this.previewDragging = true;
      this.lastMouseX = e.clientX;
    });
    window.addEventListener('mouseup', () => {
      this.previewDragging = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.previewDragging || !this.visible) return;
      const dx = e.clientX - this.lastMouseX;
      this.lastMouseX = e.clientX;
      this.previewYaw += dx * 0.014;
    });

    const tick = () => {
      this.animId = requestAnimationFrame(tick);
      if (!this.visible) return;
      if (!this.previewDragging) {
        this.previewYaw += 0.008;
      }
      if (this.avatarGroup) {
        this.avatarGroup.rotation.y = this.previewYaw;
      }
      this.previewRenderer.render(this.previewScene, this.previewCamera);
    };
    tick();
  }

  rebuildPreviewAvatar() {
    if (!this.previewScene) return;
    if (this.avatarGroup) {
      this.previewScene.remove(this.avatarGroup);
    }
    const { group } = buildStudentAvatarMesh(this.gameState.skin);
    this.avatarGroup = group;
    this.previewScene.add(this.avatarGroup);
  }

  _renderSkinControls() {
    const skin = this.gameState.skin;

    const styleList = document.getElementById('skin-style-list');
    styleList.innerHTML = SKIN_OPTIONS.outfitStyles
      .map(
        (s) =>
          `<button type="button" class="btn-chip ${skin.outfitStyle === s.id ? 'active' : ''}" data-style="${s.id}">${s.name}</button>`
      )
      .join('');
    styleList.querySelectorAll('button').forEach((btn) =>
      btn.addEventListener('click', () => {
        sfx.click();
        this.gameState.setSkin({ outfitStyle: btn.dataset.style });
        this.rebuildPreviewAvatar();
        this._renderSkinControls();
      })
    );

    const colorList = document.getElementById('skin-color-list');
    colorList.innerHTML = SKIN_OPTIONS.outfitColors
      .map(
        (c) =>
          `<button type="button" class="swatch ${skin.outfitColor === c.id ? 'active' : ''}" style="background:${c.id}" title="${c.name}" data-col="${c.id}"></button>`
      )
      .join('');
    colorList.querySelectorAll('button').forEach((btn) =>
      btn.addEventListener('click', () => {
        sfx.click();
        this.gameState.setSkin({ outfitColor: btn.dataset.col });
        this.rebuildPreviewAvatar();
        this._renderSkinControls();
      })
    );

    const hatList = document.getElementById('skin-hat-list');
    hatList.innerHTML = SKIN_OPTIONS.hats
      .map(
        (h) =>
          `<button type="button" class="btn-chip ${skin.hat === h.id ? 'active' : ''}" data-hat="${h.id}">${h.name}</button>`
      )
      .join('');
    hatList.querySelectorAll('button').forEach((btn) =>
      btn.addEventListener('click', () => {
        sfx.click();
        this.gameState.setSkin({ hat: btn.dataset.hat });
        this.rebuildPreviewAvatar();
        this._renderSkinControls();
      })
    );

    const toneList = document.getElementById('skin-tone-list');
    toneList.innerHTML = SKIN_OPTIONS.skinTones
      .map(
        (t) =>
          `<button type="button" class="swatch ${skin.skinTone === t.id ? 'active' : ''}" style="background:${t.id}" title="${t.name}" data-tone="${t.id}"></button>`
      )
      .join('');
    toneList.querySelectorAll('button').forEach((btn) =>
      btn.addEventListener('click', () => {
        sfx.click();
        this.gameState.setSkin({ skinTone: btn.dataset.tone });
        this.rebuildPreviewAvatar();
        this._renderSkinControls();
      })
    );

    const pantsList = document.getElementById('skin-pants-list');
    pantsList.innerHTML = SKIN_OPTIONS.pantsColors
      .map(
        (p) =>
          `<button type="button" class="swatch ${skin.pantsColor === p.id ? 'active' : ''}" style="background:${p.id}" title="${p.name}" data-pants="${p.id}"></button>`
      )
      .join('');
    pantsList.querySelectorAll('button').forEach((btn) =>
      btn.addEventListener('click', () => {
        sfx.click();
        this.gameState.setSkin({ pantsColor: btn.dataset.pants });
        this.rebuildPreviewAvatar();
        this._renderSkinControls();
      })
    );
  }

  _bindEvents() {
    this.nameInput.addEventListener('input', () => {
      const val = this.nameInput.value.trim();
      this.previewTag.textContent = val || 'Eleve_CIEL';
    });

    document.getElementById('menu-btn-play').addEventListener('click', () => {
      sfx.click();
      this.showView('play');
    });

    document.getElementById('menu-btn-join').addEventListener('click', () => {
      sfx.click();
      this.showView('join');
      this.refreshRooms();
    });

    document.getElementById('menu-btn-skin').addEventListener('click', () => {
      sfx.click();
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
      const code = this.directRoomInput.value.trim() || 'salle-e204';
      this._launchWithRoom(code);
    });

    document.getElementById('btn-skin-random').addEventListener('click', () => {
      sfx.click();
      const pick = (arr) => arr[Math.floor(Math.random() * arr.length)].id;
      this.gameState.setSkin({
        outfitStyle: pick(SKIN_OPTIONS.outfitStyles),
        outfitColor: pick(SKIN_OPTIONS.outfitColors),
        hat: pick(SKIN_OPTIONS.hats),
        skinTone: pick(SKIN_OPTIONS.skinTones),
        pantsColor: pick(SKIN_OPTIONS.pantsColors)
      });
      this.rebuildPreviewAvatar();
      this._renderSkinControls();
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

  async refreshRooms() {
    this.roomsListEl.innerHTML = '<p class="hint-mini">Recherche des salles actives...</p>';
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
      this.statusEl.innerHTML = `<span class="dot online"></span> Serveur CIEL en ligne (${health.playersOnline} joueur(s) connecté(s))`;
    } else {
      this.statusEl.innerHTML = `<span class="dot"></span> Mode local prêt (serveur en attente)`;
    }
  }

  show() {
    this.visible = true;
    this.root.classList.remove('hidden');
    this.showView('home');
    this.refreshHealth();
  }

  hide() {
    this.visible = false;
    this.root.classList.add('hidden');
  }
}
