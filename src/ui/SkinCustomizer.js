import * as THREE from 'three';
import { sfx } from '../core/audio.js';
import { buildStudentAvatarMesh, disposeObject3D, SKIN_OPTIONS } from '../world/AvatarBuilder.js';

export function pickRandomSkin() {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)].id;
  return {
    outfitStyle: pick(SKIN_OPTIONS.outfitStyles),
    outfitColor: pick(SKIN_OPTIONS.outfitColors),
    hat: pick(SKIN_OPTIONS.hats),
    skinTone: pick(SKIN_OPTIONS.skinTones),
    pantsColor: pick(SKIN_OPTIONS.pantsColors)
  };
}

export function renderSkinControls(ids, gameState, onChanged) {
  const skin = gameState.skin;

  const renderGroup = (elId, items, activeId, buildItemHtml, onPick) => {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = items.map((item) => buildItemHtml(item, item.id === activeId)).join('');
    el.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        sfx.click();
        onPick(btn.dataset.val);
        renderSkinControls(ids, gameState, onChanged);
        onChanged?.(gameState.skin);
      });
    });
  };

  renderGroup(
    ids.style,
    SKIN_OPTIONS.outfitStyles,
    skin.outfitStyle,
    (s, active) =>
      `<button type="button" class="btn-chip ${active ? 'active' : ''}" data-val="${s.id}">${s.name}</button>`,
    (val) => gameState.setSkin({ outfitStyle: val })
  );

  renderGroup(
    ids.color,
    SKIN_OPTIONS.outfitColors,
    skin.outfitColor,
    (c, active) =>
      `<button type="button" class="swatch ${active ? 'active' : ''}" style="background:${c.id}" title="${c.name}" data-val="${c.id}"></button>`,
    (val) => gameState.setSkin({ outfitColor: val })
  );

  renderGroup(
    ids.hat,
    SKIN_OPTIONS.hats,
    skin.hat,
    (h, active) =>
      `<button type="button" class="btn-chip ${active ? 'active' : ''}" data-val="${h.id}">${h.name}</button>`,
    (val) => gameState.setSkin({ hat: val })
  );

  renderGroup(
    ids.tone,
    SKIN_OPTIONS.skinTones,
    skin.skinTone,
    (t, active) =>
      `<button type="button" class="swatch ${active ? 'active' : ''}" style="background:${t.id}" title="${t.name}" data-val="${t.id}"></button>`,
    (val) => gameState.setSkin({ skinTone: val })
  );

  renderGroup(
    ids.pants,
    SKIN_OPTIONS.pantsColors,
    skin.pantsColor,
    (p, active) =>
      `<button type="button" class="swatch ${active ? 'active' : ''}" style="background:${p.id}" title="${p.name}" data-val="${p.id}"></button>`,
    (val) => gameState.setSkin({ pantsColor: val })
  );
}

export class SkinPreview3D {
  constructor(canvas, getSkinFn, width = 280, height = 320) {
    this.canvas = canvas;
    this.getSkinFn = getSkinFn;
    this.width = width;
    this.height = height;
    this.active = false;
    this.yaw = 0.35;
    this.dragging = false;
    this.lastMouseX = 0;
    this.avatarGroup = null;
    this.initialized = false;
    this.animId = null;
  }

  _init() {
    if (this.initialized || !this.canvas) return;
    this.initialized = true;

    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(this.width, this.height, false);

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(40, this.width / this.height, 0.1, 20);
      this.camera.position.set(0, 1.15, 3.2);
      this.camera.lookAt(0, 0.95, 0);

      const hemi = new THREE.HemisphereLight('#f8fafc', '#1e293b', 1.1);
      this.scene.add(hemi);
      const dir = new THREE.DirectionalLight('#ffffff', 1.3);
      dir.position.set(2, 4, 3);
      this.scene.add(dir);

      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.75, 0.85, 0.1, 32),
        new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.4, metalness: 0.5 })
      );
      pedestal.position.y = -0.05;
      this.scene.add(pedestal);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.72, 0.78, 32),
        new THREE.MeshBasicMaterial({ color: '#22d3ee', side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.01;
      this.scene.add(ring);

      this.canvas.addEventListener('mousedown', (e) => {
        this.dragging = true;
        this.lastMouseX = e.clientX;
      });
      window.addEventListener('mouseup', () => {
        this.dragging = false;
      });
      window.addEventListener('mousemove', (e) => {
        if (!this.dragging || !this.active) return;
        const dx = e.clientX - this.lastMouseX;
        this.lastMouseX = e.clientX;
        this.yaw += dx * 0.014;
      });
      this.canvas.addEventListener(
        'touchstart',
        (e) => {
          if (!this.active || !e.touches[0]) return;
          e.preventDefault();
          this.dragging = true;
          this.lastMouseX = e.touches[0].clientX;
        },
        { passive: false }
      );
      window.addEventListener(
        'touchmove',
        (e) => {
          if (!this.dragging || !this.active || !e.touches[0]) return;
          const dx = e.touches[0].clientX - this.lastMouseX;
          this.lastMouseX = e.touches[0].clientX;
          this.yaw += dx * 0.014;
        },
        { passive: true }
      );
      window.addEventListener('touchend', () => {
        this.dragging = false;
      });
      window.addEventListener('touchcancel', () => {
        this.dragging = false;
      });

      this.rebuild();

      const tick = () => {
        this.animId = requestAnimationFrame(tick);
        if (!this.active || !this.renderer || !this.scene || !this.camera) return;
        if (!this.dragging) this.yaw += 0.008;
        if (this.avatarGroup) this.avatarGroup.rotation.y = this.yaw;
        this.renderer.render(this.scene, this.camera);
      };
      tick();
    } catch (err) {
      this.initialized = false;
      this.renderer = null;
      this.scene = null;
      this.camera = null;
      console.warn('WebGL aperçu 3D indisponible:', err);
    }
  }

  setActive(active) {
    this.active = Boolean(active);
    if (this.active) {
      this._init();
      this.rebuild();
    }
  }

  rebuild() {
    if (!this.scene) return;
    if (this.avatarGroup) {
      this.scene.remove(this.avatarGroup);
      disposeObject3D(this.avatarGroup);
    }
    const { group } = buildStudentAvatarMesh(this.getSkinFn());
    this.avatarGroup = group;
    this.avatarGroup.rotation.y = this.yaw;
    this.scene.add(this.avatarGroup);
    if (this.renderer && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
