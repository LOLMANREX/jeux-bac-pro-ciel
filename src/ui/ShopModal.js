import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { sfx } from '../core/audio.js';
import {
  applyShopSkin,
  buildStudentAvatarMesh,
  DEFAULT_SKIN,
  disposeObject3D
} from '../world/AvatarBuilder.js';
import { buildPetMesh } from '../world/PetBuilder.js';
import {
  getRarityMeta,
  getShopItemById,
  getShopItemsByCategory,
  SHOP_CATEGORIES
} from '../world/ShopCatalog.js';

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildShopViewModel(gameState = {}, category = 'skins', selectedId = null) {
  const validCat = SHOP_CATEGORIES.some((c) => c.id === category) ? category : 'skins';
  const coins = Math.max(0, Math.floor(Number(gameState.coins ?? gameState.profile?.coins) || 0));
  const ownedList = Array.isArray(gameState.ownedItems)
    ? gameState.ownedItems
    : Array.isArray(gameState.profile?.ownedItems)
      ? gameState.profile.ownedItems
      : [];
  const ownedSet = new Set(ownedList);
  const equippedSkin = gameState.equippedSkin ?? gameState.profile?.equippedSkin ?? gameState.skin?.shopSkinId ?? null;
  const equippedPet = gameState.equippedPet ?? gameState.profile?.equippedPet ?? gameState.skin?.equippedPet ?? null;
  const equippedTrail = gameState.equippedTrail ?? gameState.profile?.equippedTrail ?? gameState.skin?.equippedTrail ?? null;

  const rawItems = getShopItemsByCategory(validCat);
  const items = rawItems.map((item) => {
    const owned = ownedSet.has(item.id);
    const equipped =
      (item.category === 'skins' && equippedSkin === item.id) ||
      (item.category === 'pets' && equippedPet === item.id) ||
      (item.category === 'accessories' && equippedTrail === item.id);
    const canAfford = coins >= item.price;
    const rarityMeta = getRarityMeta(item.rarity);
    return {
      ...item,
      owned,
      equipped,
      canAfford,
      rarityMeta
    };
  });

  const selectedItem =
    items.find((it) => it.id === selectedId) ||
    items.find((it) => it.equipped) ||
    items[0] ||
    null;

  return {
    coins,
    ownedItems: [...ownedSet],
    equippedSkin,
    equippedPet,
    equippedTrail,
    categories: SHOP_CATEGORIES,
    activeCategory: validCat,
    items,
    selectedItem
  };
}

export class ShopPreview3D {
  constructor(canvas, width = 320, height = 340) {
    this.canvas = canvas;
    this.width = width;
    this.height = height;
    this.active = false;
    this.initialized = false;
    this.yaw = 0.4;
    this.yawVelocity = 0;
    this.dragging = false;
    this.lastMouseX = 0;
    this.animId = null;
    this.previewObj = null;
    this.previewGroup = null;
    this.currentItemId = null;
    this.currentCategory = null;
    this.ringMesh = null;
    this.accentLight = null;
    this._pmrem = null;
    this._envRt = null;
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
      this.renderer.toneMappingExposure = 1.08;

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(38, this.width / this.height, 0.1, 24);
      this.camera.position.set(0, 1.22, 3.35);
      this.camera.lookAt(0, 0.92, 0);

      this._pmrem = new THREE.PMREMGenerator(this.renderer);
      const roomEnv = new RoomEnvironment();
      this._envRt = this._pmrem.fromScene(roomEnv, 0.04);
      roomEnv.dispose();
      this.scene.environment = this._envRt.texture;
      this.scene.environmentIntensity = 0.78;

      const hemi = new THREE.HemisphereLight('#f8fafc', '#0f172a', 1.15);
      const key = new THREE.DirectionalLight('#ffffff', 1.6);
      key.position.set(2.2, 4.2, 3.0);
      const fill = new THREE.DirectionalLight('#7dd3fc', 0.75);
      fill.position.set(-2.5, 2.0, 2.2);
      this.accentLight = new THREE.PointLight('#fbbf24', 2.4, 7);
      this.accentLight.position.set(0, 0.6, 1.4);
      this.scene.add(hemi, key, fill, this.accentLight);

      const podium = new THREE.Mesh(
        new THREE.CylinderGeometry(0.84, 0.96, 0.14, 32),
        new THREE.MeshStandardMaterial({
          color: '#0f172a',
          metalness: 0.75,
          roughness: 0.28
        })
      );
      podium.position.y = -0.07;
      this.scene.add(podium);

      this.ringMesh = new THREE.Mesh(
        new THREE.RingGeometry(0.76, 0.85, 40),
        new THREE.MeshBasicMaterial({
          color: '#38bdf8',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.92
        })
      );
      this.ringMesh.rotation.x = -Math.PI / 2;
      this.ringMesh.position.y = 0.012;
      this.scene.add(this.ringMesh);

      this._onPointerDown = (e) => {
        this.dragging = true;
        this.lastMouseX = e.clientX;
      };
      this._onPointerMove = (e) => {
        if (!this.dragging || !this.active) return;
        const dx = e.clientX - this.lastMouseX;
        this.lastMouseX = e.clientX;
        this.yaw += dx * 0.014;
        this.yawVelocity = dx * 0.04;
      };
      this._onPointerUp = () => {
        this.dragging = false;
      };
      this.canvas.addEventListener('pointerdown', this._onPointerDown);
      window.addEventListener('pointermove', this._onPointerMove);
      window.addEventListener('pointerup', this._onPointerUp);
    } catch {
      this.renderer = null;
    }
  }

  _clearPreview() {
    if (this.previewGroup && this.scene) {
      this.scene.remove(this.previewGroup);
    }
    if (this.previewObj?.dispose) {
      this.previewObj.dispose();
    } else if (this.previewGroup) {
      disposeObject3D(this.previewGroup);
    }
    this.previewObj = null;
    this.previewGroup = null;
  }

  showItem(item, baseSkin = DEFAULT_SKIN) {
    this._init();
    if (!this.scene || !item) return;
    const rarity = getRarityMeta(item.rarity);
    if (this.ringMesh?.material) {
      this.ringMesh.material.color.set(rarity.color);
    }
    if (this.accentLight) {
      this.accentLight.color.set(rarity.color);
    }

    if (this.currentItemId === item.id && this.previewGroup) {
      return;
    }
    this._clearPreview();
    this.currentItemId = item.id;
    this.currentCategory = item.category;

    if (item.category === 'pets') {
      const pet = buildPetMesh(item.id);
      pet.group.scale.setScalar(1.45);
      pet.group.position.y = 0.08;
      this.previewObj = pet;
      this.previewGroup = pet.group;
      this.scene.add(pet.group);
      if (this.camera) {
        this.camera.position.set(0, 0.92, 2.55);
        this.camera.lookAt(0, 0.62, 0);
      }
    } else if (item.category === 'skins') {
      const skinCfg = applyShopSkin(baseSkin || DEFAULT_SKIN, item.id);
      const av = buildStudentAvatarMesh(skinCfg);
      this.previewObj = av;
      this.previewGroup = av.group;
      this.scene.add(av.group);
      if (this.camera) {
        this.camera.position.set(0, 1.24, 3.35);
        this.camera.lookAt(0, 0.95, 0);
      }
    } else {
      const skinCfg = { ...(baseSkin || DEFAULT_SKIN), equippedTrail: item.id };
      const av = buildStudentAvatarMesh(skinCfg);
      this.previewObj = av;
      this.previewGroup = av.group;
      this.scene.add(av.group);
      if (this.camera) {
        this.camera.position.set(0, 1.24, 3.45);
        this.camera.lookAt(0, 0.95, 0);
      }
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
        this.yaw += dt * 0.68 + this.yawVelocity * dt;
        this.yawVelocity *= 0.9;
      }
      if (this.previewGroup) {
        this.previewGroup.rotation.y = this.yaw;
      }
      if (this.currentCategory === 'pets' && this.previewObj?.animateParts) {
        this.previewObj.animateParts(elapsed, 0.85);
      } else if (this.previewObj?.updateEffects) {
        this.previewObj.updateEffects(elapsed);
      }
      this.renderer.render(this.scene, this.camera);
      this.animId = requestAnimationFrame(tick);
    };
    this.animId = requestAnimationFrame(tick);
  }

  dispose() {
    this.setActive(false);
    if (this._onPointerDown) this.canvas?.removeEventListener?.('pointerdown', this._onPointerDown);
    if (this._onPointerMove) window.removeEventListener('pointermove', this._onPointerMove);
    if (this._onPointerUp) window.removeEventListener('pointerup', this._onPointerUp);
    this._clearPreview();
    this._envRt?.dispose?.();
    this._pmrem?.dispose?.();
    this.renderer?.dispose?.();
    this.renderer = null;
    this.initialized = false;
  }
}

export class ShopModal {
  constructor({ gameState, onBuyItem, onEquipItem, onClose } = {}) {
    this.gameState = gameState;
    this.onBuyItem = onBuyItem;
    this.onEquipItem = onEquipItem;
    this.onClose = onClose;
    this.activeCategory = 'skins';
    this.selectedId = null;
    this.busy = false;
    this.feedback = null;

    this.backdropEl = document.getElementById('shop-modal');
    this.tabsEl = document.getElementById('shop-tabs');
    this.gridEl = document.getElementById('shop-items-grid');
    this.balanceEl = document.getElementById('shop-balance-value');
    this.rarityEl = document.getElementById('shop-preview-rarity');
    this.nameEl = document.getElementById('shop-preview-name');
    this.descEl = document.getElementById('shop-preview-desc');
    this.priceEl = document.getElementById('shop-preview-price');
    this.actionBtn = document.getElementById('shop-btn-action');
    this.unequipBtn = document.getElementById('shop-btn-unequip');
    this.summaryEl = document.getElementById('shop-equipped-summary');
    this.feedbackEl = document.getElementById('shop-feedback');
    this.closeBtn = document.getElementById('shop-modal-close');

    const canvas = document.getElementById('shop-preview-canvas');
    this.preview = canvas ? new ShopPreview3D(canvas, 300, 320) : null;

    this._bindEvents();
  }

  _bindEvents() {
    this.closeBtn?.addEventListener('click', () => {
      sfx.click?.();
      this.close();
    });
    this.backdropEl?.addEventListener('click', (e) => {
      if (e.target === this.backdropEl) {
        this.close();
      }
    });
    this.actionBtn?.addEventListener('click', () => this._handlePrimaryAction());
    this.unequipBtn?.addEventListener('click', () => this._handleUnequipAction());
  }

  isOpen() {
    return Boolean(this.backdropEl && !this.backdropEl.classList.contains('hidden'));
  }

  open(initialCategory = null, initialItemId = null) {
    if (!this.backdropEl) return false;
    this.busy = false;
    const directItem = initialItemId ? getShopItemById(initialItemId) : null;
    if (directItem) {
      this.activeCategory = directItem.category;
      this.selectedId = directItem.id;
    } else if (initialCategory && SHOP_CATEGORIES.some((c) => c.id === initialCategory)) {
      this.activeCategory = initialCategory;
      this.selectedId = null;
    }
    this.feedback = null;
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
    if (!SHOP_CATEGORIES.some((c) => c.id === category)) return;
    this.activeCategory = category;
    this.selectedId = null;
    this.feedback = null;
    this.refresh();
  }

  selectItem(itemId) {
    const item = getShopItemById(itemId);
    if (!item) return;
    this.activeCategory = item.category;
    this.selectedId = item.id;
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

  async _handlePrimaryAction() {
    if (this.busy) return;
    const vm = buildShopViewModel(this.gameState, this.activeCategory, this.selectedId);
    const item = vm.selectedItem;
    if (!item) {
      this.setFeedback('Sélectionnez d’abord un article dans la boutique.', 'error');
      return;
    }

    if (!item.owned && !item.canAfford) {
      const missing = Math.max(0, item.price - vm.coins);
      sfx.error?.();
      this.setFeedback(
        `🔒 Solde insuffisant : ${vm.coins} / ${item.price} 🪙 CC (il vous manque ${missing} CC).`,
        'error'
      );
      return;
    }

    if (item.owned && item.equipped) {
      sfx.click?.();
      this.setFeedback(`✅ ${item.name} est déjà équipé sur votre avatar.`, 'info');
      return;
    }

    sfx.click?.();
    this.busy = true;
    this.refresh();
    try {
      if (!item.owned) {
        const res = await this.onBuyItem?.(item);
        if (res?.ok) {
          this.setFeedback(`✅ ${item.name} acheté ! Cliquez sur « Équiper » ou ouvrez votre Casier.`, 'success');
        } else {
          sfx.error?.();
          this.setFeedback(res?.error || 'Achat impossible. Vérifiez votre connexion et votre solde.', 'error');
        }
      } else if (!item.equipped) {
        const res = await this.onEquipItem?.(item, true);
        if (res?.ok) {
          this.setFeedback(`✨ ${item.name} équipé !`, 'success');
        } else {
          sfx.error?.();
          this.setFeedback(res?.error || 'Équipement impossible.', 'error');
        }
      }
    } catch (err) {
      sfx.error?.();
      this.setFeedback(err?.message || 'Erreur lors de la transaction Boutique.', 'error');
    } finally {
      this.busy = false;
      this.refresh();
    }
  }

  async _handleUnequipAction() {
    if (this.busy) return;
    const vm = buildShopViewModel(this.gameState, this.activeCategory, this.selectedId);
    const item = vm.selectedItem;
    if (!item || !item.equipped) return;

    sfx.click?.();
    this.busy = true;
    this.refresh();
    try {
      const res = await this.onEquipItem?.(item, false);
      if (res?.ok) {
        this.setFeedback(`↩️ ${item.name} retiré.`, 'info');
      } else {
        this.setFeedback(res?.error || 'Impossible de retirer cet article.', 'error');
      }
    } finally {
      this.busy = false;
      this.refresh();
    }
  }

  refresh() {
    if (!this.backdropEl) return;
    const vm = buildShopViewModel(this.gameState, this.activeCategory, this.selectedId);
    if (vm.selectedItem) {
      this.selectedId = vm.selectedItem.id;
    }

    if (this.balanceEl) {
      this.balanceEl.textContent = `${vm.coins} CC`;
    }

    if (this.tabsEl) {
      this.tabsEl.innerHTML = vm.categories
        .map(
          (cat) =>
            `<button type="button" class="shop-tab-btn ${cat.id === vm.activeCategory ? 'active' : ''}" data-shop-cat="${cat.id}">${cat.icon} ${escapeHtml(cat.label)}</button>`
        )
        .join('');
      this.tabsEl.querySelectorAll('[data-shop-cat]').forEach((btn) => {
        btn.addEventListener('click', () => {
          sfx.click?.();
          this.selectCategory(btn.dataset.shopCat);
        });
      });
    }

    if (this.gridEl) {
      this.gridEl.innerHTML = vm.items
        .map((item) => {
          const isSelected = vm.selectedItem?.id === item.id;
          const badge = item.equipped
            ? '<span class="shop-card-status equipped">ÉQUIPÉ</span>'
            : item.owned
              ? '<span class="shop-card-status owned">POSSÉDÉ</span>'
              : `<span class="shop-card-price ${item.canAfford ? '' : 'locked'}">🪙 ${item.price} CC</span>`;
          return `
            <button type="button" class="shop-item-card rarity-${item.rarity} ${isSelected ? 'selected' : ''} ${item.equipped ? 'equipped' : ''}" data-shop-item="${item.id}">
              <div class="shop-card-top">
                <span class="shop-card-rarity" style="color:${item.rarityMeta.color};border-color:${item.rarityMeta.borderColor};background:${item.rarityMeta.bgColor}">${escapeHtml(item.rarityMeta.label)}</span>
                ${badge}
              </div>
              <div class="shop-card-icon">${item.icon}</div>
              <div class="shop-card-name">${escapeHtml(item.name)}</div>
            </button>
          `;
        })
        .join('');
      this.gridEl.querySelectorAll('[data-shop-item]').forEach((btn) => {
        btn.addEventListener('click', () => {
          sfx.click?.();
          this.selectItem(btn.dataset.shopItem);
        });
      });
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
      if (this.descEl) this.descEl.textContent = sel.description;
      if (this.priceEl) {
        this.priceEl.textContent = sel.equipped
          ? '✅ Actuellement équipé'
          : sel.owned
            ? '📦 Dans votre inventaire'
            : `🪙 Prix : ${sel.price} CIEL Coins`;
      }
      if (this.actionBtn) {
        this.actionBtn.disabled = this.busy;
        this.actionBtn.classList.toggle('is-locked', !sel.owned && !sel.canAfford);
        this.actionBtn.classList.toggle('is-equipped', Boolean(sel.equipped));
        this.actionBtn.textContent = this.busy
          ? '⏳ Traitement...'
          : sel.equipped
            ? '✅ Équipé'
            : sel.owned
              ? '✨ Équiper'
              : sel.canAfford
                ? `🛒 Acheter (${sel.price} 🪙)`
                : `🔒 Solde insuffisant (${sel.price} 🪙)`;
      }
      if (this.unequipBtn) {
        this.unequipBtn.classList.toggle('hidden', !sel.equipped);
        this.unequipBtn.disabled = this.busy;
      }
      if (this.isOpen()) {
        this.preview?.showItem(sel, this.gameState?.skin || DEFAULT_SKIN);
      }
    }

    if (this.summaryEl) {
      const sName = vm.equippedSkin ? getShopItemById(vm.equippedSkin)?.name || 'Skin Boutique' : 'Tenue Standard';
      const pName = vm.equippedPet ? getShopItemById(vm.equippedPet)?.name || 'Pet' : 'Aucun';
      const aName = vm.equippedTrail ? getShopItemById(vm.equippedTrail)?.name || 'Accessoire' : 'Aucun';
      this.summaryEl.innerHTML = `
        <span>👕 Skin : <strong>${escapeHtml(sName)}</strong></span>
        <span>🐾 Pet 3D : <strong>${escapeHtml(pName)}</strong></span>
        <span>✨ Accessoire : <strong>${escapeHtml(aName)}</strong></span>
      `;
    }

    this.setFeedback(this.feedback?.message || '', this.feedback?.kind || 'info');
  }
}
