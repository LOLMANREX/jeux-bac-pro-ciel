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
  constructor(canvas, getSkinFn, width = 280, height = 320, options = {}) {
    this.canvas = canvas;
    this.getSkinFn = getSkinFn;
    this.width = width;
    this.height = height;
    this.interactivePodium = Boolean(options.interactivePodium);
    this.showcaseGold = Boolean(options.showcaseGold);
    this.active = false;
    this.yaw = 0.35;
    this.yawVelocity = 0;
    this.dragging = false;
    this.lastMouseX = 0;
    this.avatarGroup = null;
    this.avatarData = null;
    this.podiumRings = [];
    this.neonLights = [];
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
      const isStudio = this.interactivePodium || this.showcaseGold;
      this.camera = new THREE.PerspectiveCamera(
        this.showcaseGold ? 38 : (isStudio ? 36 : 40),
        this.width / this.height,
        0.1,
        24
      );
      this.camera.position.set(
        0,
        this.showcaseGold ? 1.24 : (isStudio ? 1.18 : 1.15),
        this.showcaseGold ? 3.85 : (isStudio ? 3.55 : 3.2)
      );
      this.camera.lookAt(0, this.showcaseGold ? 0.98 : (isStudio ? 0.92 : 0.95), 0);

      const hemi = new THREE.HemisphereLight('#f8fafc', '#0f172a', isStudio ? 1.3 : 1.1);
      this.scene.add(hemi);
      const dir = new THREE.DirectionalLight('#ffffff', this.showcaseGold ? 1.7 : (isStudio ? 1.45 : 1.3));
      dir.position.set(2.2, 4.4, 3.2);
      this.scene.add(dir);

      if (isStudio) {
        const leftColor = this.showcaseGold ? '#fbbf24' : '#22d3ee';
        const rightColor = this.showcaseGold ? '#38bdf8' : '#a855f7';
        const baseGlowColor = this.showcaseGold ? '#f59e0b' : '#06b6d4';

        const leftRim = new THREE.PointLight(leftColor, this.showcaseGold ? 3.2 : 2.8, 8);
        leftRim.position.set(-2.1, 1.65, -1.1);
        this.scene.add(leftRim);

        const rightRim = new THREE.PointLight(rightColor, this.showcaseGold ? 2.8 : 2.6, 8);
        rightRim.position.set(2.1, 1.45, -1.0);
        this.scene.add(rightRim);

        const underGlow = new THREE.PointLight(baseGlowColor, 2.3, 4.4);
        underGlow.position.set(0, 0.2, 0.2);
        this.scene.add(underGlow);

        if (this.showcaseGold) {
          const studioTop = new THREE.SpotLight('#fef08a', 2.4, 10, Math.PI / 4, 0.55);
          studioTop.position.set(0, 3.8, 1.4);
          this.scene.add(studioTop);
          const frontFill = new THREE.PointLight('#fde68a', 1.3, 6);
          frontFill.position.set(0, 1.4, 2.5);
          this.scene.add(frontFill);
        }

        this.neonLights = [leftRim, rightRim, underGlow];

        const base = new THREE.Mesh(
          new THREE.CylinderGeometry(0.92, 1.08, 0.14, 6),
          new THREE.MeshStandardMaterial({
            color: this.showcaseGold ? '#1c1204' : '#091124',
            roughness: 0.26,
            metalness: 0.88,
            emissive: this.showcaseGold ? '#451a03' : '#082f49',
            emissiveIntensity: 0.5
          })
        );
        base.position.y = -0.07;
        this.scene.add(base);

        const topCap = new THREE.Mesh(
          new THREE.CylinderGeometry(0.84, 0.86, 0.03, 32),
          new THREE.MeshStandardMaterial({
            color: this.showcaseGold ? '#111827' : '#0f172a',
            roughness: 0.18,
            metalness: 0.92
          })
        );
        topCap.position.y = 0.005;
        this.scene.add(topCap);

        const outerRingMat = new THREE.MeshBasicMaterial({
          color: leftColor,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.95
        });
        const outerRing = new THREE.Mesh(new THREE.RingGeometry(0.83, 0.91, 48), outerRingMat);
        outerRing.rotation.x = -Math.PI / 2;
        outerRing.position.y = 0.024;
        this.scene.add(outerRing);

        const innerRingMat = new THREE.MeshBasicMaterial({
          color: rightColor,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85
        });
        const innerRing = new THREE.Mesh(new THREE.RingGeometry(0.64, 0.69, 6), innerRingMat);
        innerRing.rotation.x = -Math.PI / 2;
        innerRing.position.y = 0.026;
        this.scene.add(innerRing);

        const beamMat = new THREE.MeshBasicMaterial({
          color: leftColor,
          transparent: true,
          opacity: this.showcaseGold ? 0.13 : 0.11,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.84, 1.85, 32, 1, true), beamMat);
        beam.position.y = 0.92;
        this.scene.add(beam);

        this.podiumRings = [outerRing, innerRing, beam];
      } else {
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
      }

      this.canvas.addEventListener('mousedown', (e) => {
        this.dragging = true;
        this.yawVelocity = 0;
        this.lastMouseX = e.clientX;
      });
      window.addEventListener('mouseup', () => {
        this.dragging = false;
      });
      window.addEventListener('mousemove', (e) => {
        if (!this.dragging || !this.active) return;
        const dx = e.clientX - this.lastMouseX;
        this.lastMouseX = e.clientX;
        const delta = dx * 0.014;
        this.yaw += delta;
        this.yawVelocity = delta * 0.7;
      });
      this.canvas.addEventListener(
        'touchstart',
        (e) => {
          if (!this.active || !e.touches[0]) return;
          e.preventDefault();
          this.dragging = true;
          this.yawVelocity = 0;
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
          const delta = dx * 0.014;
          this.yaw += delta;
          this.yawVelocity = delta * 0.7;
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

      const tick = (now = 0) => {
        this.animId = requestAnimationFrame(tick);
        if (!this.active || !this.renderer || !this.scene || !this.camera) return;
        const t = now * 0.001;
        if (!this.dragging) {
          if (Math.abs(this.yawVelocity) > 0.0005) {
            this.yaw += this.yawVelocity;
            this.yawVelocity *= 0.92;
          } else {
            this.yaw += this.interactivePodium || this.showcaseGold ? 0.007 : 0.008;
          }
        }
        if (this.avatarGroup) this.avatarGroup.rotation.y = this.yaw;
        this.avatarData?.updateEffects?.(t);
        if ((this.interactivePodium || this.showcaseGold) && this.podiumRings.length >= 3) {
          this.podiumRings[1].rotation.z = t * 0.55;
          this.podiumRings[2].material.opacity = 0.08 + Math.sin(t * 2.4) * 0.04;
          if (this.neonLights[2]) {
            this.neonLights[2].intensity = 2.1 + Math.sin(t * 3.1) * 0.6;
          }
        }
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

  setShowcaseAccent(primaryHex, secondaryHex) {
    if (!this.initialized) return;
    if (this.podiumRings.length >= 3) {
      this.podiumRings[0].material.color.set(primaryHex);
      this.podiumRings[1].material.color.set(secondaryHex);
      this.podiumRings[2].material.color.set(primaryHex);
    }
    if (this.neonLights.length >= 3) {
      this.neonLights[0].color.set(primaryHex);
      this.neonLights[1].color.set(secondaryHex);
      this.neonLights[2].color.set(primaryHex);
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
    this.avatarData = buildStudentAvatarMesh(this.getSkinFn());
    this.avatarGroup = this.avatarData.group;
    this.avatarGroup.rotation.y = this.yaw;
    this.scene.add(this.avatarGroup);
    this.avatarData.updateEffects?.(performance.now() * 0.001);
    if (this.renderer && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
