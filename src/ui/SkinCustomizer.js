import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { sfx } from '../core/audio.js';
import {
  BATTLE_PASS_SKIN_CATALOG,
  getBattlePassTierSpec,
  isYanfufuUsername,
  normalizeBattlePassTierList,
  YANFUFU_VIP_TIER
} from '../core/battlePassSkins.js';
import {
  ASCENSION_SPECIALTIES,
  buildStudentAvatarMesh,
  disposeObject3D,
  isUltimateSecretSkinId,
  SKIN_OPTIONS,
  ULTIMATE_SECRET_SKIN,
  ULTIMATE_SECRET_SKIN_ID
} from '../world/AvatarBuilder.js';
import { createStudioPedestalMaterials } from '../world/RealisticMaterials.js';

export const LOCKED_SECRET_SKIN_LABEL =
  '❓ Skin Secret — Réunis tous les skins divins pour percer ce mystère';

export function pickRandomSkin() {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)].id;
  return {
    outfitStyle: pick(SKIN_OPTIONS.outfitStyles),
    outfitColor: pick(SKIN_OPTIONS.outfitColors),
    hat: pick(SKIN_OPTIONS.hats),
    skinTone: pick(SKIN_OPTIONS.skinTones),
    pantsColor: pick(SKIN_OPTIONS.pantsColors),
    divineSpecialty: null,
    battlePassTier: null
  };
}

export function getCasierDivineEntries(gameState = {}) {
  const skin = gameState.skin || {};
  const unlockedSet = new Set([
    ...(Array.isArray(gameState.unlockedDivineSkins) ? gameState.unlockedDivineSkins : []),
    ...(Array.isArray(gameState.profile?.unlockedDivineSkins)
      ? gameState.profile.unlockedDivineSkins
      : [])
  ]);
  const username = gameState.account?.username || gameState.profile?.name || '';
  const unlockedBpTiers = normalizeBattlePassTierList([
    ...(Array.isArray(gameState.unlockedBattlePassTiers) ? gameState.unlockedBattlePassTiers : []),
    ...(Array.isArray(gameState.profile?.unlockedBattlePassTiers)
      ? gameState.profile.unlockedBattlePassTiers
      : []),
    ...(Array.isArray(gameState.account?.unlockedBattlePassTiers)
      ? gameState.account.unlockedBattlePassTiers
      : []),
    ...(isYanfufuUsername(username) ? [YANFUFU_VIP_TIER] : [])
  ]);
  const secretUnlocked = Boolean(
    gameState.secretSkinUnlocked ||
      gameState.account?.secretSkinUnlocked ||
      gameState.profile?.secretSkinUnlocked ||
      (ASCENSION_SPECIALTIES.length > 0 &&
        ASCENSION_SPECIALTIES.every((spec) => unlockedSet.has(spec.id)))
  );
  const isSecretActive = Boolean(
    secretUnlocked && (skin.secretSkin || isUltimateSecretSkinId(skin.divineSpecialty))
  );
  const activeDivine = isSecretActive ? ULTIMATE_SECRET_SKIN_ID : skin.divineSpecialty || '';
  const rawBpSpec = !activeDivine
    ? getBattlePassTierSpec(skin.battlePassTier ?? gameState.selectedSkin)
    : null;
  const activeBattlePassTier =
    rawBpSpec && unlockedBpTiers.includes(rawBpSpec.tier) ? rawBpSpec.tier : null;

  const specialties = ASCENSION_SPECIALTIES.map((spec) => {
    const unlocked = unlockedSet.has(spec.id);
    return {
      id: spec.id,
      unlocked,
      active: activeDivine === spec.id,
      label: unlocked ? `${spec.icon} Dieu ${spec.shortLabel}` : `🔒 ${spec.icon} ${spec.shortLabel}`,
      title: unlocked
        ? `Skin Divin débloqué : ${spec.label}`
        : `Débloqué en réussissant l'Ascension 20/20 (${spec.label})`
    };
  });

  const battlePassEntries = BATTLE_PASS_SKIN_CATALOG.filter((item) =>
    unlockedBpTiers.includes(item.tier)
  ).map((item) => ({
    id: item.id,
    tier: item.tier,
    unlocked: true,
    active: activeBattlePassTier === item.tier,
    label: `${item.icon} ${item.shortName} (P.${item.tier})`,
    title: `${item.name} — ${item.stat}`
  }));

  const secretEntry = secretUnlocked
    ? {
        id: ULTIMATE_SECRET_SKIN_ID,
        unlocked: true,
        masked: false,
        active: isSecretActive,
        isSecret: true,
        label: `${ULTIMATE_SECRET_SKIN.icon} ${ULTIMATE_SECRET_SKIN.shortLabel}`,
        title: `Skin Secret Ultime débloqué : ${ULTIMATE_SECRET_SKIN.label}`
      }
    : {
        id: 'secret_locked',
        unlocked: false,
        masked: true,
        active: false,
        isSecret: true,
        label: LOCKED_SECRET_SKIN_LABEL,
        title: LOCKED_SECRET_SKIN_LABEL
      };

  return {
    activeDivine,
    activeBattlePassTier,
    standardActive: !activeDivine && !activeBattlePassTier,
    specialties,
    battlePassEntries,
    unlockedBattlePassTiers: unlockedBpTiers,
    secretEntry,
    secretUnlocked
  };
}

export function renderSkinControls(ids, gameState, onChanged) {
  const skin = gameState.skin;
  const divineElId = ids.divine || (ids.style === 'hud-skin-style-list' ? 'hud-skin-divine-list' : 'skin-divine-list');
  const divineEl = document.getElementById(divineElId);
  if (divineEl) {
    const casier = getCasierDivineEntries(gameState);
    const stdBtn = `<button type="button" class="btn-chip divine-chip-std ${casier.standardActive ? 'active' : ''}" data-divine="standard">👕 Tenue Standard</button>`;
    const vipBtns = casier.battlePassEntries
      .map(
        (entry) =>
          `<button type="button" class="btn-chip divine-chip-btn divine-chip-vip unlocked ${entry.active ? 'active' : ''}" data-divine="${entry.id}" title="${entry.title}">${entry.label}</button>`
      )
      .join('');
    const specBtns = casier.specialties
      .map((entry) =>
        entry.unlocked
          ? `<button type="button" class="btn-chip divine-chip-btn unlocked ${entry.active ? 'active' : ''}" data-divine="${entry.id}" title="${entry.title}">${entry.label}</button>`
          : `<button type="button" class="btn-chip divine-chip-btn locked" data-divine="${entry.id}" disabled title="${entry.title}">${entry.label}</button>`
      )
      .join('');
    const sec = casier.secretEntry;
    const secretBtn = sec.unlocked
      ? `<button type="button" class="btn-chip divine-chip-secret unlocked ${sec.active ? 'active' : ''}" data-divine="${sec.id}" title="${sec.title}">${sec.label}</button>`
      : `<button type="button" class="btn-chip divine-chip-secret locked" data-divine="${sec.id}" disabled title="${sec.title}">${sec.label}</button>`;
    divineEl.innerHTML = stdBtn + vipBtns + specBtns + secretBtn;
    divineEl.querySelectorAll('button:not([disabled])').forEach((btn) => {
      btn.addEventListener('click', () => {
        sfx.click();
        const choice = btn.dataset.divine;
        gameState.equipDivineSkin(choice === 'standard' ? null : choice);
        renderSkinControls(ids, gameState, onChanged);
        onChanged?.(gameState.skin);
      });
    });
  }

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
    this.studioMode = options.studioMode || (this.showcaseGold ? 'gold' : 'daylight');
    this.active = false;
    this.yaw = 0.35;
    this.yawVelocity = 0;
    this.dragging = false;
    this.lastMouseX = 0;
    this.avatarGroup = null;
    this.avatarData = null;
    this.podiumRings = [];
    this.neonLights = [];
    this._pedestalMats = null;
    this._pmrem = null;
    this._envRt = null;
    this.initialized = false;
    this.animId = null;
  }

  _init() {
    if (this.initialized || !this.canvas) return;
    this.initialized = true;

    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
      const dprCap = (typeof window !== 'undefined' && window.innerWidth < 768) ? 1.15 : 1.5;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
      this.renderer.setSize(this.width, this.height, false);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = this.showcaseGold ? 1.05 : 1.0;

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

      if (this.showcaseGold) {
        const hemi = new THREE.HemisphereLight('#f8fafc', '#0f172a', 1.3);
        this.scene.add(hemi);
        const dir = new THREE.DirectionalLight('#ffffff', 1.7);
        dir.position.set(2.2, 4.4, 3.2);
        this.scene.add(dir);

        const leftColor = '#fbbf24';
        const rightColor = '#38bdf8';
        const baseGlowColor = '#f59e0b';

        const leftRim = new THREE.DirectionalLight(leftColor, 1.35);
        leftRim.position.set(-2.1, 1.65, -1.1);
        this.scene.add(leftRim);

        const rightRim = new THREE.DirectionalLight(rightColor, 1.2);
        rightRim.position.set(2.1, 1.45, -1.0);
        this.scene.add(rightRim);

        const underGlow = new THREE.PointLight(baseGlowColor, 2.3, 4.4);
        underGlow.position.set(0, 0.2, 0.2);
        this.scene.add(underGlow);

        this.neonLights = [leftRim, rightRim, underGlow];

        const base = new THREE.Mesh(
          new THREE.CylinderGeometry(0.92, 1.08, 0.14, 6),
          new THREE.MeshStandardMaterial({
            color: '#1c1204',
            roughness: 0.26,
            metalness: 0.88,
            emissive: '#451a03',
            emissiveIntensity: 0.5
          })
        );
        base.position.y = -0.07;
        this.scene.add(base);

        const topCap = new THREE.Mesh(
          new THREE.CylinderGeometry(0.84, 0.86, 0.03, 32),
          new THREE.MeshStandardMaterial({
            color: '#111827',
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
          opacity: 0.13,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.84, 1.85, 32, 1, true), beamMat);
        beam.position.y = 0.92;
        this.scene.add(beam);

        this.podiumRings = [outerRing, innerRing, beam];
      } else {
        this._pmrem = new THREE.PMREMGenerator(this.renderer);
        const roomEnv = new RoomEnvironment();
        this._envRt = this._pmrem.fromScene(roomEnv, 0.04);
        roomEnv.dispose();
        this.scene.environment = this._envRt.texture;
        this.scene.environmentIntensity = 0.72;

        const hemi = new THREE.HemisphereLight('#f8fafc', '#d6d3cd', 1.05);
        this.scene.add(hemi);

        const keyLight = new THREE.DirectionalLight('#fff7eb', 1.55);
        keyLight.position.set(2.4, 4.6, 3.2);
        this.scene.add(keyLight);

        const skyFill = new THREE.DirectionalLight('#e0f2fe', 0.65);
        skyFill.position.set(-2.5, 2.2, 2.0);
        this.scene.add(skyFill);

        const backRim = new THREE.DirectionalLight('#ffffff', 0.55);
        backRim.position.set(0, 3.0, -3.2);
        this.scene.add(backRim);

        const maxAniso = this.renderer.capabilities?.getMaxAnisotropy?.() || 8;
        this._pedestalMats = createStudioPedestalMaterials(maxAniso);

        if (isStudio) {
          const base = new THREE.Mesh(
            new THREE.CylinderGeometry(0.92, 1.04, 0.13, 36),
            this._pedestalMats.concreteMat
          );
          base.position.y = -0.065;
          this.scene.add(base);

          const collar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.87, 0.91, 0.024, 36),
            this._pedestalMats.trimMetalMat
          );
          collar.position.y = -0.002;
          this.scene.add(collar);

          const oakDeck = new THREE.Mesh(
            new THREE.CylinderGeometry(0.84, 0.85, 0.032, 36),
            this._pedestalMats.oakMat
          );
          oakDeck.position.y = 0.012;
          this.scene.add(oakDeck);
        } else {
          const pedestal = new THREE.Mesh(
            new THREE.CylinderGeometry(0.75, 0.85, 0.09, 32),
            this._pedestalMats.concreteMat
          );
          pedestal.position.y = -0.045;
          this.scene.add(pedestal);

          const collar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.73, 0.74, 0.018, 32),
            this._pedestalMats.trimMetalMat
          );
          collar.position.y = -0.004;
          this.scene.add(collar);

          const oakCap = new THREE.Mesh(
            new THREE.CylinderGeometry(0.7, 0.72, 0.025, 32),
            this._pedestalMats.oakMat
          );
          oakCap.position.y = 0.005;
          this.scene.add(oakCap);
        }
      }

      if (this.canvas.style) {
        this.canvas.style.touchAction = 'none';
      }
      let activeDragPointerId = null;
      this._onPointerDown = (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (activeDragPointerId !== null) return;
        e.preventDefault?.();
        activeDragPointerId = e.pointerId ?? 0;
        this.canvas.setPointerCapture?.(e.pointerId);
        this.dragging = true;
        this.yawVelocity = 0;
        this.lastMouseX = e.clientX;
      };
      this._onPointerMove = (e) => {
        if (!this.dragging || !this.active) return;
        if (activeDragPointerId !== null && (e.pointerId ?? 0) !== activeDragPointerId) return;
        const dx = e.clientX - this.lastMouseX;
        this.lastMouseX = e.clientX;
        const delta = dx * 0.014;
        this.yaw += delta;
        this.yawVelocity = delta * 0.7;
      };
      this._onEndDrag = (e) => {
        if (activeDragPointerId !== null && e.pointerId !== undefined && e.pointerId !== activeDragPointerId) return;
        if (activeDragPointerId !== null) {
          this.canvas.releasePointerCapture?.(activeDragPointerId);
        }
        activeDragPointerId = null;
        this.dragging = false;
      };
      this.canvas.addEventListener('pointerdown', this._onPointerDown);
      window.addEventListener('pointermove', this._onPointerMove);
      window.addEventListener('pointerup', this._onEndDrag);
      window.addEventListener('pointercancel', this._onEndDrag);

      this.rebuild();

      this._tick = (now = 0) => {
        if (!this.active || !this.renderer || !this.scene || !this.camera) {
          this.animId = null;
          return;
        }
        this.animId = requestAnimationFrame(this._tick);
        if (typeof document !== 'undefined' && document.hidden) return;
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
      if (this.active) {
        this._tick();
      }
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

  isAnimating() {
    return this.active && this.animId !== null;
  }

  setActive(active) {
    this.active = Boolean(active);
    if (this.active) {
      this._init();
      this.rebuild();
      if (this._tick && this.animId === null) {
        this.animId = requestAnimationFrame(this._tick);
      }
    } else if (this.animId !== null) {
      this.dragging = false;
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  dispose() {
    this.setActive(false);
    if (this._onPointerDown) this.canvas?.removeEventListener?.('pointerdown', this._onPointerDown);
    if (this._onPointerMove) window.removeEventListener('pointermove', this._onPointerMove);
    if (this._onEndDrag) {
      window.removeEventListener('pointerup', this._onEndDrag);
      window.removeEventListener('pointercancel', this._onEndDrag);
    }
    if (this.avatarGroup && this.scene) {
      this.scene.remove(this.avatarGroup);
      disposeObject3D(this.avatarGroup);
      this.avatarGroup = null;
    }
    this._pedestalMats?.dispose?.();
    this._envRt?.dispose?.();
    this._pmrem?.dispose?.();
    this.renderer?.dispose?.();
    this.renderer = null;
    this.initialized = false;
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
