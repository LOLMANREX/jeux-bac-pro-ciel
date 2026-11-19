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
  applyBattlePassSkin,
  applySessionDivineSkin,
  applyShopSkin,
  ASCENSION_SPECIALTIES,
  buildStudentAvatarMesh,
  DEFAULT_SKIN,
  disposeObject3D,
  isUltimateSecretSkinId,
  ULTIMATE_SECRET_SKIN,
  ULTIMATE_SECRET_SKIN_ID
} from '../world/AvatarBuilder.js';
import { buildPetMesh } from '../world/PetBuilder.js';
import {
  getRarityMeta,
  getShopItemById,
  SHOP_ACCESSORIES,
  SHOP_PETS,
  SHOP_SKINS
} from '../world/ShopCatalog.js';
import { pickRandomSkin, renderSkinControls } from './SkinCustomizer.js';

export const LOCKER_CATEGORIES = [
  { id: 'skins', label: 'Skins', icon: '👕' },
  { id: 'pets', label: 'Pets 3D', icon: '🐾' },
  { id: 'accessories', label: 'Accessoires / Auras', icon: '✨' },
  { id: 'badges', label: 'Badges & Titres', icon: '🏅' }
];

export const LOCKER_FILTERS = [
  { id: 'all', label: 'Tous' },
  { id: 'owned', label: 'Possédés' },
  { id: 'locked', label: 'À débloquer' }
];

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildBadgeEntries(gameState = {}) {
  const profile = gameState.profile || {};
  const completedCount = Number(profile.completedCount) || 0;
  const average = typeof profile.average === 'number' ? profile.average : null;
  const prestige = Math.max(0, Number(gameState.prestigeCount ?? profile.prestigeCount) || 0);
  const vip = Boolean(gameState.vipChambreAccess ?? profile.vipChambreAccess);
  const diploma = Boolean(profile.diplomaEarned);
  const rankLabel = profile.rankLabel || 'Apprenti CIEL';
  const unlockedDivines = Array.isArray(gameState.unlockedDivineSkins)
    ? gameState.unlockedDivineSkins.length
    : 0;

  return [
    {
      id: 'badge_rank_active',
      category: 'badges',
      source: 'badge',
      name: `Titre : ${rankLabel}`,
      icon: '🎓',
      rarity: 'common',
      rarityMeta: getRarityMeta('common'),
      description: 'Titre officiel affiché sur votre profil et le classement de la classe CIEL.',
      owned: true,
      equipped: true,
      price: 0
    },
    {
      id: 'badge_tp_starter',
      category: 'badges',
      source: 'badge',
      name: 'Technicien Atelier U300',
      icon: '🔧',
      rarity: 'common',
      rarityMeta: getRarityMeta('common'),
      description: 'Débloqué dès 1 TP 3D validé avec une note d’au moins 10/20.',
      owned: completedCount >= 1,
      equipped: completedCount >= 1,
      price: 0
    },
    {
      id: 'badge_bac_pro',
      category: 'badges',
      source: 'badge',
      name: 'Diplôme BAC PRO CIEL',
      icon: '📜',
      rarity: 'rare',
      rarityMeta: getRarityMeta('rare'),
      description: 'Obtenu en validant l’ensemble des TPs fondamentaux de l’Atelier CIEL.',
      owned: diploma,
      equipped: diploma,
      price: 0
    },
    {
      id: 'badge_mention_tb',
      category: 'badges',
      source: 'badge',
      name: 'Mention Très Bien (≥ 16/20)',
      icon: '🌟',
      rarity: 'epic',
      rarityMeta: getRarityMeta('epic'),
      description: 'Récompense une moyenne générale supérieure ou égale à 16/20 sur les TPs.',
      owned: average !== null && average >= 16,
      equipped: average !== null && average >= 16,
      price: 0
    },
    {
      id: 'badge_vip_pass',
      category: 'badges',
      source: 'badge',
      name: 'Accès VIP Passe CIEL',
      icon: '🔑',
      rarity: 'epic',
      rarityMeta: getRarityMeta('epic'),
      description: 'Badge doré débloqué avec l’accès VIP du Passe de Combat CIEL.',
      owned: vip,
      equipped: vip,
      price: 0
    },
    {
      id: 'badge_ascension',
      category: 'badges',
      source: 'badge',
      name: `Ascension Prestige ×${Math.max(1, prestige)}`,
      icon: '⚡',
      rarity: 'legendary',
      rarityMeta: getRarityMeta('legendary'),
      description: 'Accomplissez une Ascension 20/20 pour obtenir un skin Divin et ce badge légendaire.',
      owned: prestige > 0 || unlockedDivines > 0,
      equipped: prestige > 0 || unlockedDivines > 0,
      price: 0
    }
  ];
}

export function buildLockerViewModel(gameState = {}, options = {}) {
  const category = LOCKER_CATEGORIES.some((c) => c.id === options.category)
    ? options.category
    : 'skins';
  const filter = LOCKER_FILTERS.some((f) => f.id === options.filter) ? options.filter : 'all';
  const selectedId = options.selectedId || null;

  const coins = Math.max(0, Math.floor(Number(gameState.coins ?? gameState.profile?.coins) || 0));
  const ownedList = Array.isArray(gameState.ownedItems)
    ? gameState.ownedItems
    : Array.isArray(gameState.profile?.ownedItems)
      ? gameState.profile.ownedItems
      : [];
  const ownedSet = new Set(ownedList);

  const skin = gameState.skin || DEFAULT_SKIN;
  const equippedSkin =
    gameState.equippedSkin ?? gameState.profile?.equippedSkin ?? skin.shopSkinId ?? null;
  const equippedPet =
    gameState.equippedPet ?? gameState.profile?.equippedPet ?? skin.equippedPet ?? null;
  const equippedTrail =
    gameState.equippedTrail ?? gameState.profile?.equippedTrail ?? skin.equippedTrail ?? null;

  const unlockedDivineSet = new Set([
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
        ASCENSION_SPECIALTIES.every((spec) => unlockedDivineSet.has(spec.id)))
  );

  const isSecretActive = Boolean(
    secretUnlocked && (skin.secretSkin || isUltimateSecretSkinId(skin.divineSpecialty))
  );
  const activeDivine = isSecretActive ? ULTIMATE_SECRET_SKIN_ID : skin.divineSpecialty || null;
  const rawBpSpec = !activeDivine
    ? getBattlePassTierSpec(skin.battlePassTier ?? gameState.selectedSkin)
    : null;
  const activeBpTier =
    rawBpSpec && unlockedBpTiers.includes(rawBpSpec.tier) ? rawBpSpec.tier : null;
  const standardActive = !activeDivine && !activeBpTier && !equippedSkin;

  const skinItems = [
    {
      id: 'standard',
      category: 'skins',
      source: 'standard',
      name: 'Tenue Standard CIEL',
      icon: '👕',
      rarity: 'common',
      rarityMeta: getRarityMeta('common'),
      description: 'Tenue personnalisable (style, couleurs, chapeau) visible en direct par toute la classe.',
      owned: true,
      equipped: standardActive,
      price: 0,
      shopCategory: null
    },
    ...SHOP_SKINS.map((item) => ({
      ...item,
      source: 'shop',
      shopCategory: 'skins',
      owned: ownedSet.has(item.id),
      equipped: !activeDivine && !activeBpTier && equippedSkin === item.id,
      rarityMeta: getRarityMeta(item.rarity)
    })),
    ...BATTLE_PASS_SKIN_CATALOG.filter((bp) => unlockedBpTiers.includes(bp.tier)).map((bp) => ({
      id: bp.id,
      category: 'skins',
      source: 'battlepass',
      tier: bp.tier,
      name: `${bp.name} (P.${bp.tier})`,
      icon: bp.icon || '🎖️',
      rarity: 'epic',
      rarityMeta: getRarityMeta('epic'),
      description: bp.stat || 'Skin exclusif du Passe de Combat CIEL.',
      owned: true,
      equipped: activeBpTier === bp.tier,
      price: 0,
      shopCategory: null
    })),
    ...ASCENSION_SPECIALTIES.map((spec) => {
      const unlocked = unlockedDivineSet.has(spec.id);
      return {
        id: spec.id,
        category: 'skins',
        source: 'divine',
        name: unlocked ? `Dieu ${spec.shortLabel}` : `Divin ${spec.shortLabel}`,
        icon: spec.icon || '⚡',
        rarity: 'legendary',
        rarityMeta: getRarityMeta('legendary'),
        description: unlocked
          ? `Skin Divin débloqué : ${spec.label}.`
          : `Débloqué en réussissant l’Ascension 20/20 (${spec.label}).`,
        owned: unlocked,
        equipped: activeDivine === spec.id,
        price: 0,
        shopCategory: null
      };
    }),
    {
      id: ULTIMATE_SECRET_SKIN_ID,
      category: 'skins',
      source: 'secret',
      name: secretUnlocked ? ULTIMATE_SECRET_SKIN.shortLabel : 'Skin Secret Ultime',
      icon: secretUnlocked ? ULTIMATE_SECRET_SKIN.icon : '❓',
      rarity: 'legendary',
      rarityMeta: getRarityMeta('legendary'),
      description: secretUnlocked
        ? `Skin Secret Ultime débloqué : ${ULTIMATE_SECRET_SKIN.label}.`
        : 'Réunis tous les skins divins pour débloquer ce mystère.',
      owned: secretUnlocked,
      equipped: isSecretActive,
      price: 0,
      shopCategory: null
    }
  ];

  const petItems = SHOP_PETS.map((item) => ({
    ...item,
    source: 'shop',
    shopCategory: 'pets',
    owned: ownedSet.has(item.id),
    equipped: equippedPet === item.id,
    rarityMeta: getRarityMeta(item.rarity)
  }));

  const accessoryItems = SHOP_ACCESSORIES.map((item) => ({
    ...item,
    source: 'shop',
    shopCategory: 'accessories',
    owned: ownedSet.has(item.id),
    equipped: equippedTrail === item.id,
    rarityMeta: getRarityMeta(item.rarity)
  }));

  const badgeItems = buildBadgeEntries(gameState);

  const byCategory = {
    skins: skinItems,
    pets: petItems,
    accessories: accessoryItems,
    badges: badgeItems
  };

  const categories = LOCKER_CATEGORIES.map((cat) => {
    const list = byCategory[cat.id] || [];
    return {
      ...cat,
      unlockedCount: list.filter((it) => it.owned).length,
      totalCount: list.length
    };
  });

  const shopTotalItems = SHOP_SKINS.length + SHOP_PETS.length + SHOP_ACCESSORIES.length;
  const shopUnlockedCount = [...ownedSet].filter((id) => Boolean(getShopItemById(id))).length;

  const allCategoryItems = byCategory[category] || [];
  const filteredItems = allCategoryItems.filter((it) => {
    if (filter === 'owned') return it.owned;
    if (filter === 'locked') return !it.owned;
    return true;
  });

  const selectedItem =
    filteredItems.find((it) => it.id === selectedId) ||
    allCategoryItems.find((it) => it.id === selectedId) ||
    filteredItems.find((it) => it.equipped) ||
    filteredItems[0] ||
    allCategoryItems[0] ||
    null;

  const activeSkinEntry = skinItems.find((s) => s.equipped);
  const activePetEntry = petItems.find((p) => p.equipped);
  const activeAccEntry = accessoryItems.find((a) => a.equipped);

  return {
    coins,
    ownedItems: [...ownedSet],
    equippedSkin,
    equippedPet,
    equippedTrail,
    selectedSkin: gameState.selectedSkin || 'standard',
    categories,
    filters: LOCKER_FILTERS,
    activeCategory: category,
    activeFilter: filter,
    totalUnlocked: shopUnlockedCount,
    totalItems: shopTotalItems,
    categoryUnlocked: allCategoryItems.filter((it) => it.owned).length,
    categoryTotal: allCategoryItems.length,
    allCategoryItems,
    items: filteredItems,
    selectedItem,
    equippedSummary: {
      skinName: activeSkinEntry?.name || 'Tenue Standard CIEL',
      petName: activePetEntry?.name || 'Aucun',
      accessoryName: activeAccEntry?.name || 'Aucun',
      rankLabel: gameState.profile?.rankLabel || 'Apprenti CIEL'
    }
  };
}

export class LockerPreview3D {
  constructor(canvas, width = 340, height = 380) {
    this.canvas = canvas;
    this.width = width;
    this.height = height;
    this.active = false;
    this.initialized = false;
    this.yaw = 0.35;
    this.yawVelocity = 0;
    this.dragging = false;
    this.lastPointerX = 0;
    this.animId = null;
    this.stageGroup = null;
    this.avatarObj = null;
    this.petObj = null;
    this.ringMesh = null;
    this.accentLight = null;
    this._pmrem = null;
    this._envRt = null;
    this._lastSig = '';
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
      this.renderer.toneMappingExposure = 1.1;

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(38, this.width / this.height, 0.1, 28);
      this.camera.position.set(0, 1.24, 3.65);
      this.camera.lookAt(0, 0.92, 0);

      this._pmrem = new THREE.PMREMGenerator(this.renderer);
      const roomEnv = new RoomEnvironment();
      this._envRt = this._pmrem.fromScene(roomEnv, 0.04);
      roomEnv.dispose();
      this.scene.environment = this._envRt.texture;
      this.scene.environmentIntensity = 0.82;

      const hemi = new THREE.HemisphereLight('#f8fafc', '#0f172a', 1.18);
      const key = new THREE.DirectionalLight('#ffffff', 1.65);
      key.position.set(2.4, 4.4, 3.2);
      const fill = new THREE.DirectionalLight('#38bdf8', 0.85);
      fill.position.set(-2.6, 2.2, 2.0);
      this.accentLight = new THREE.PointLight('#38bdf8', 2.2, 8);
      this.accentLight.position.set(0, 0.7, 1.5);
      this.scene.add(hemi, key, fill, this.accentLight);

      const podium = new THREE.Mesh(
        new THREE.CylinderGeometry(1.06, 1.22, 0.14, 36),
        new THREE.MeshStandardMaterial({
          color: '#0f172a',
          metalness: 0.78,
          roughness: 0.25
        })
      );
      podium.position.y = -0.07;
      this.scene.add(podium);

      this.ringMesh = new THREE.Mesh(
        new THREE.RingGeometry(0.96, 1.08, 44),
        new THREE.MeshBasicMaterial({
          color: '#38bdf8',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.92
        })
      );
      this.ringMesh.rotation.x = -Math.PI / 2;
      this.ringMesh.position.y = 0.014;
      this.scene.add(this.ringMesh);

      this.stageGroup = new THREE.Group();
      this.scene.add(this.stageGroup);

      this.canvas.style.touchAction = 'none';
      this._onPointerDown = (e) => {
        this.dragging = true;
        this.lastPointerX = e.clientX;
        this.canvas.setPointerCapture?.(e.pointerId);
      };
      this._onPointerMove = (e) => {
        if (!this.dragging || !this.active) return;
        const dx = e.clientX - this.lastPointerX;
        this.lastPointerX = e.clientX;
        this.yaw += dx * 0.015;
        this.yawVelocity = dx * 0.045;
      };
      this._onStopDrag = () => {
        this.dragging = false;
      };
      this.canvas.addEventListener('pointerdown', this._onPointerDown);
      this.canvas.addEventListener('pointermove', this._onPointerMove);
      this.canvas.addEventListener('pointerup', this._onStopDrag);
      this.canvas.addEventListener('pointercancel', this._onStopDrag);
      window.addEventListener('pointerup', this._onStopDrag);
    } catch {
      this.renderer = null;
    }
  }

  _clearStage() {
    if (!this.stageGroup) return;
    if (this.avatarObj) {
      this.stageGroup.remove(this.avatarObj.group);
      if (this.avatarObj.dispose) this.avatarObj.dispose();
      else disposeObject3D(this.avatarObj.group);
      this.avatarObj = null;
    }
    if (this.petObj) {
      this.stageGroup.remove(this.petObj.group);
      if (this.petObj.dispose) this.petObj.dispose();
      else disposeObject3D(this.petObj.group);
      this.petObj = null;
    }
  }

  renderLoadout(baseSkin = DEFAULT_SKIN, previewItem = null, equippedPetId = null, equippedTrailId = null) {
    this._init();
    if (!this.scene || !this.stageGroup) return;

    const rarityColor = previewItem?.rarityMeta?.color || '#38bdf8';
    if (this.ringMesh?.material) this.ringMesh.material.color.set(rarityColor);
    if (this.accentLight) this.accentLight.color.set(rarityColor);

    let effectiveSkin = { ...(baseSkin || DEFAULT_SKIN) };
    let effectivePetId = equippedPetId || effectiveSkin.equippedPet || null;
    let effectiveTrailId = equippedTrailId || effectiveSkin.equippedTrail || null;

    if (previewItem) {
      if (previewItem.category === 'skins') {
        if (previewItem.source === 'shop') {
          effectiveSkin = applyShopSkin(effectiveSkin, previewItem.id);
        } else if (previewItem.source === 'divine' || previewItem.source === 'secret') {
          effectiveSkin = applySessionDivineSkin(effectiveSkin, previewItem.id);
        } else if (previewItem.source === 'battlepass' && previewItem.tier) {
          effectiveSkin = applyBattlePassSkin(effectiveSkin, previewItem.tier);
        } else if (previewItem.source === 'standard') {
          delete effectiveSkin.shopSkinId;
          delete effectiveSkin.divineSpecialty;
          delete effectiveSkin.secretSkin;
          delete effectiveSkin.battlePassTier;
          delete effectiveSkin.showcase;
        }
      } else if (previewItem.category === 'pets') {
        effectivePetId = previewItem.id;
      } else if (previewItem.category === 'accessories') {
        effectiveTrailId = previewItem.id;
      }
    }

    if (effectiveTrailId) {
      effectiveSkin.equippedTrail = effectiveTrailId;
    } else {
      delete effectiveSkin.equippedTrail;
    }

    const sig = JSON.stringify({
      skin: effectiveSkin,
      pet: effectivePetId || ''
    });
    if (sig === this._lastSig && this.avatarObj) return;
    this._lastSig = sig;

    this._clearStage();
    const av = buildStudentAvatarMesh(effectiveSkin);
    av.group.position.set(effectivePetId ? -0.18 : 0, 0, 0);
    this.stageGroup.add(av.group);
    this.avatarObj = av;

    if (effectivePetId) {
      const pet = buildPetMesh(effectivePetId);
      pet.group.scale.setScalar(0.95);
      pet.group.position.set(0.68, 0.08, 0.14);
      this.stageGroup.add(pet.group);
      this.petObj = pet;
    }
  }

  isAnimating() {
    return this.active && this.animId !== null;
  }

  setActive(active) {
    this.active = Boolean(active);
    if (!this.active) {
      this.dragging = false;
      if (this.animId !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.animId);
        this.animId = null;
      }
      return;
    }
    this._init();
    if (!this.renderer || this.animId !== null) return;
    let lastMs = performance.now();
    const tick = (now) => {
      if (!this.active) {
        this.animId = null;
        return;
      }
      if (typeof document !== 'undefined' && document.hidden) {
        this.animId = requestAnimationFrame(tick);
        return;
      }
      const dt = Math.min(0.05, Math.max(0.004, (now - lastMs) / 1000));
      lastMs = now;
      const elapsed = now * 0.001;
      if (!this.dragging) {
        this.yaw += dt * 0.45 + this.yawVelocity * dt;
        this.yawVelocity *= 0.9;
      }
      if (this.stageGroup) {
        this.stageGroup.rotation.y = this.yaw;
      }
      if (this.avatarObj?.updateEffects) {
        this.avatarObj.updateEffects(elapsed);
      }
      if (this.petObj?.animateParts) {
        this.petObj.animateParts(elapsed, 0.85);
      }
      this.renderer.render(this.scene, this.camera);
      this.animId = requestAnimationFrame(tick);
    };
    this.animId = requestAnimationFrame(tick);
  }

  dispose() {
    this.setActive(false);
    if (this._onPointerDown) this.canvas?.removeEventListener?.('pointerdown', this._onPointerDown);
    if (this._onPointerMove) this.canvas?.removeEventListener?.('pointermove', this._onPointerMove);
    if (this._onStopDrag) {
      this.canvas?.removeEventListener?.('pointerup', this._onStopDrag);
      this.canvas?.removeEventListener?.('pointercancel', this._onStopDrag);
      window.removeEventListener('pointerup', this._onStopDrag);
    }
    this._clearStage();
    this._envRt?.dispose?.();
    this._pmrem?.dispose?.();
    this.renderer?.dispose?.();
    this.renderer = null;
    this.initialized = false;
  }
}

export class LockerModal {
  constructor({
    gameState,
    onEquipShopItem,
    onEquipDivineSkin,
    onStandardSkinChange,
    onOpenShopItem,
    onClose
  } = {}) {
    this.gameState = gameState;
    this.onEquipShopItem = onEquipShopItem;
    this.onEquipDivineSkin = onEquipDivineSkin;
    this.onStandardSkinChange = onStandardSkinChange;
    this.onOpenShopItem = onOpenShopItem;
    this.onClose = onClose;

    this.activeCategory = 'skins';
    this.activeFilter = 'all';
    this.selectedId = null;
    this.busy = false;
    this.feedback = null;
    this.customizerOpen = false;

    this.backdropEl = document.getElementById('skin-modal');
    this.tabsEl = document.getElementById('locker-tabs');
    this.filtersEl = document.getElementById('locker-filters');
    this.counterEl = document.getElementById('locker-unlocked-counter');
    this.coinsEl = document.getElementById('locker-balance-value');
    this.gridEl = document.getElementById('locker-items-grid');
    this.rarityEl = document.getElementById('locker-preview-rarity');
    this.nameEl = document.getElementById('locker-preview-name');
    this.descEl = document.getElementById('locker-preview-desc');
    this.statusEl = document.getElementById('locker-preview-status');
    this.feedbackEl = document.getElementById('locker-feedback');
    this.actionBtn = document.getElementById('locker-btn-action');
    this.unequipBtn = document.getElementById('locker-btn-unequip');
    this.shopShortcutBtn = document.getElementById('locker-btn-shop');
    this.summaryEl = document.getElementById('locker-equipped-summary');
    this.customizerWrap = document.getElementById('locker-standard-customizer');
    this.toggleCustomizerBtn = document.getElementById('locker-btn-customize-toggle');
    this.closeBtn = document.getElementById('hud-skin-close');
    this.doneBtn = document.getElementById('btn-hud-skin-done');
    this.randomBtn = document.getElementById('btn-hud-skin-random');

    this.skinIds = {
      divine: 'hud-skin-divine-list',
      style: 'hud-skin-style-list',
      color: 'hud-skin-color-list',
      hat: 'hud-skin-hat-list',
      tone: 'hud-skin-tone-list',
      pants: 'hud-skin-pants-list'
    };

    const canvas = document.getElementById('hud-skin-preview-canvas');
    this.preview = canvas ? new LockerPreview3D(canvas, 340, 360) : null;

    this._bindEvents();
  }

  _bindEvents() {
    this.closeBtn?.addEventListener('click', () => {
      sfx.click?.();
      this.close();
    });
    this.doneBtn?.addEventListener('click', () => {
      sfx.click?.();
      this.close();
    });
    this.backdropEl?.addEventListener('click', (e) => {
      if (e.target === this.backdropEl) {
        this.close();
      }
    });
    this.actionBtn?.addEventListener('click', () => this._handleEquipToggle(true));
    this.unequipBtn?.addEventListener('click', () => this._handleEquipToggle(false));
    this.shopShortcutBtn?.addEventListener('click', () => {
      const vm = buildLockerViewModel(this.gameState, {
        category: this.activeCategory,
        filter: this.activeFilter,
        selectedId: this.selectedId
      });
      const sel = vm.selectedItem;
      sfx.click?.();
      this.close();
      this.onOpenShopItem?.(sel?.shopCategory || sel?.category || 'skins', sel?.source === 'shop' ? sel.id : null);
    });
    this.toggleCustomizerBtn?.addEventListener('click', () => {
      sfx.click?.();
      this.customizerOpen = !this.customizerOpen;
      this.refresh();
    });
    this.randomBtn?.addEventListener('click', () => {
      sfx.click?.();
      this.gameState.setSkin(pickRandomSkin());
      this.onStandardSkinChange?.(this.gameState.skin);
      this.refresh();
    });
  }

  isOpen() {
    return Boolean(this.backdropEl && !this.backdropEl.classList.contains('hidden'));
  }

  open(initialCategory = null) {
    if (!this.backdropEl) return false;
    this.busy = false;
    this.feedback = null;
    if (initialCategory && LOCKER_CATEGORIES.some((c) => c.id === initialCategory)) {
      this.activeCategory = initialCategory;
      this.selectedId = null;
    }
    this.backdropEl.classList.remove('hidden');
    this.preview?.setActive(true);
    this.refresh();
    return true;
  }

  close() {
    this.preview?.setActive(false);
    if (!this.backdropEl || this.backdropEl.classList.contains('hidden')) return false;
    this.busy = false;
    this.backdropEl.classList.add('hidden');
    this.onClose?.();
    return true;
  }

  selectCategory(category) {
    if (!LOCKER_CATEGORIES.some((c) => c.id === category)) return;
    this.activeCategory = category;
    this.selectedId = null;
    this.feedback = null;
    this.refresh();
  }

  selectFilter(filter) {
    if (!LOCKER_FILTERS.some((f) => f.id === filter)) return;
    this.activeFilter = filter;
    this.selectedId = null;
    this.refresh();
  }

  selectItem(itemId) {
    this.selectedId = itemId;
    this.feedback = null;
    this.refresh();
  }

  setFeedback(message, kind = 'info') {
    this.feedback = message ? { message: String(message), kind } : null;
    if (this.feedbackEl) {
      if (!this.feedback) {
        this.feedbackEl.textContent = '';
        this.feedbackEl.className = 'shop-feedback hidden';
      } else {
        this.feedbackEl.textContent = this.feedback.message;
        this.feedbackEl.className = `shop-feedback ${this.feedback.kind}`;
      }
    }
  }

  async _handleEquipToggle(equip = true, explicitItem = null) {
    if (this.busy) return;
    const vm = buildLockerViewModel(this.gameState, {
      category: this.activeCategory,
      filter: this.activeFilter,
      selectedId: this.selectedId
    });
    const item = explicitItem || vm.selectedItem;
    if (!item || item.source === 'badge') return;

    if (!item.owned && equip) {
      sfx.error?.();
      this.setFeedback('🔒 Article non débloqué. Ouvrez la Boutique CIEL pour l’acquérir.', 'error');
      return;
    }

    sfx.click?.();
    this.busy = true;
    this.refresh();
    try {
      if (item.source === 'shop') {
        const res = await this.onEquipShopItem?.(item, Boolean(equip));
        if (res?.ok) {
          this.setFeedback(
            equip ? `✅ ${item.name} équipé !` : `↩️ ${item.name} retiré.`,
            equip ? 'success' : 'info'
          );
        } else {
          sfx.error?.();
          this.setFeedback(res?.error || 'Synchronisation Casier impossible.', 'error');
        }
      } else if (item.source === 'standard') {
        const res = await this.onEquipShopItem?.({ id: 'standard', category: 'skins' }, false);
        this.onEquipDivineSkin?.(null);
        this.setFeedback(res?.ok === false ? res.error : '✅ Tenue Standard équipée.', res?.ok === false ? 'error' : 'success');
      } else if (item.source === 'divine' || item.source === 'battlepass' || item.source === 'secret') {
        this.onEquipDivineSkin?.(equip ? item.id : null);
        this.setFeedback(
          equip ? `✨ ${item.name} équipé !` : '↩️ Retour à la Tenue Standard.',
          'success'
        );
      }
    } finally {
      this.busy = false;
      this.refresh();
    }
  }

  refresh() {
    if (!this.backdropEl) return;
    const vm = buildLockerViewModel(this.gameState, {
      category: this.activeCategory,
      filter: this.activeFilter,
      selectedId: this.selectedId
    });
    if (vm.selectedItem) {
      this.selectedId = vm.selectedItem.id;
    }

    if (this.counterEl) {
      this.counterEl.textContent = `📦 ${vm.totalUnlocked} / ${vm.totalItems} objets Boutique débloqués`;
    }
    if (this.coinsEl) {
      this.coinsEl.textContent = `${vm.coins} CC`;
    }

    if (this.tabsEl) {
      this.tabsEl.innerHTML = vm.categories
        .map(
          (cat) =>
            `<button type="button" class="locker-tab-btn ${cat.id === vm.activeCategory ? 'active' : ''}" data-locker-cat="${cat.id}">${cat.icon} ${escapeHtml(cat.label)} <span class="locker-tab-count">${cat.unlockedCount}/${cat.totalCount}</span></button>`
        )
        .join('');
      this.tabsEl.querySelectorAll('[data-locker-cat]').forEach((btn) => {
        btn.addEventListener('click', () => {
          sfx.click?.();
          this.selectCategory(btn.dataset.lockerCat);
        });
      });
    }

    if (this.filtersEl) {
      this.filtersEl.innerHTML = vm.filters
        .map(
          (flt) =>
            `<button type="button" class="locker-filter-btn ${flt.id === vm.activeFilter ? 'active' : ''}" data-locker-filter="${flt.id}">${escapeHtml(flt.label)}</button>`
        )
        .join('');
      this.filtersEl.querySelectorAll('[data-locker-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
          sfx.click?.();
          this.selectFilter(btn.dataset.lockerFilter);
        });
      });
    }

    if (this.gridEl) {
      if (vm.items.length === 0) {
        this.gridEl.innerHTML =
          '<div class="locker-empty">Aucun objet ne correspond à ce filtre dans cette catégorie.</div>';
      } else {
        this.gridEl.innerHTML = vm.items
          .map((item) => {
            const isSelected = vm.selectedItem?.id === item.id;
            const statusHtml = item.equipped
              ? '<span class="shop-card-status equipped">✅ Équipé</span>'
              : item.owned
                ? '<span class="shop-card-status owned">Possédé</span>'
                : item.source === 'shop'
                  ? `<span class="shop-card-price locked">🔒 ${item.price} CC</span>`
                  : '<span class="shop-card-price locked">🔒 Verrouillé</span>';
            const quickAction =
              item.source !== 'badge' && item.owned
                ? `<span class="locker-card-quick">${item.equipped ? 'Cliquer pour retirer' : '1 clic pour équiper'}</span>`
                : item.source === 'shop' && !item.owned
                  ? '<span class="locker-card-quick shop">🛒 Boutique</span>'
                  : '';
            return `
              <button type="button" class="shop-item-card locker-item-card rarity-${item.rarity} ${isSelected ? 'selected' : ''} ${item.equipped ? 'equipped' : ''} ${item.owned ? 'is-owned' : 'is-locked'}" data-locker-item="${item.id}">
                <div class="shop-card-top">
                  <span class="shop-card-rarity" style="color:${item.rarityMeta.color};border-color:${item.rarityMeta.borderColor};background:${item.rarityMeta.bgColor}">${escapeHtml(item.rarityMeta.label)}</span>
                  ${statusHtml}
                </div>
                <div class="shop-card-icon">${item.icon}</div>
                <div class="shop-card-name">${escapeHtml(item.name)}</div>
                ${quickAction}
              </button>
            `;
          })
          .join('');
        this.gridEl.querySelectorAll('[data-locker-item]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const itemId = btn.dataset.lockerItem;
            const clicked = vm.items.find((it) => it.id === itemId);
            if (!clicked) return;
            const wasSelected = this.selectedId === itemId;
            this.selectedId = itemId;
            if (clicked.owned && clicked.source !== 'badge' && wasSelected) {
              this._handleEquipToggle(!clicked.equipped, clicked);
              return;
            }
            sfx.click?.();
            this.refresh();
          });
        });
      }
    }

    if (this.customizerWrap && this.toggleCustomizerBtn) {
      const showToggle = vm.activeCategory === 'skins';
      this.toggleCustomizerBtn.classList.toggle('hidden', !showToggle);
      this.toggleCustomizerBtn.textContent = this.customizerOpen
        ? '🔼 Masquer la personnalisation Tenue Standard'
        : '🎨 Personnaliser Tenue Standard (couleurs, chapeau...)';
      this.customizerWrap.classList.toggle('hidden', !showToggle || !this.customizerOpen);
      if (showToggle && this.customizerOpen) {
        renderSkinControls(this.skinIds, this.gameState, (updatedSkin) => {
          this.onStandardSkinChange?.(updatedSkin);
          this.refresh();
        });
      }
    }

    const sel = vm.selectedItem;
    if (sel) {
      if (this.rarityEl) {
        this.rarityEl.textContent = sel.rarityMeta.label;
        this.rarityEl.style.color = sel.rarityMeta.color;
        this.rarityEl.style.borderColor = sel.rarityMeta.borderColor;
        this.rarityEl.style.background = sel.rarityMeta.bgColor;
      }
      if (this.nameEl) this.nameEl.textContent = `${sel.icon} ${sel.name}`;
      if (this.descEl) this.descEl.textContent = sel.description || '';
      if (this.statusEl) {
        this.statusEl.textContent = sel.equipped
          ? '✅ Actuellement équipé'
          : sel.owned
            ? '📦 Débloqué dans votre Casier'
            : sel.source === 'shop'
              ? `🔒 Disponible en Boutique — ${sel.price} 🪙 CC`
              : '🔒 À débloquer en jeu';
      }
      if (this.actionBtn) {
        const hideEquip = sel.source === 'badge' || !sel.owned || sel.equipped;
        this.actionBtn.classList.toggle('hidden', hideEquip);
        this.actionBtn.disabled = this.busy;
        this.actionBtn.textContent = this.busy ? '⏳ Synchronisation...' : '✨ Équiper';
      }
      if (this.unequipBtn) {
        const canUnequip = sel.source !== 'badge' && sel.source !== 'standard' && sel.equipped;
        this.unequipBtn.classList.toggle('hidden', !canUnequip);
        this.unequipBtn.disabled = this.busy;
      }
      if (this.shopShortcutBtn) {
        const showShop = sel.source === 'shop' && !sel.owned;
        this.shopShortcutBtn.classList.toggle('hidden', !showShop);
      }
      if (this.isOpen()) {
        this.preview?.renderLoadout(
          this.gameState?.skin || DEFAULT_SKIN,
          sel,
          vm.equippedPet,
          vm.equippedTrail
        );
      }
    }

    if (this.summaryEl) {
      this.summaryEl.innerHTML = `
        <span>👕 Skin : <strong>${escapeHtml(vm.equippedSummary.skinName)}</strong></span>
        <span>🐾 Pet 3D : <strong>${escapeHtml(vm.equippedSummary.petName)}</strong></span>
        <span>✨ Accessoire : <strong>${escapeHtml(vm.equippedSummary.accessoryName)}</strong></span>
      `;
    }

    this.setFeedback(this.feedback?.message || '', this.feedback?.kind || 'info');
  }
}
