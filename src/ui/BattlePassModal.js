import { DEFAULT_SKIN } from '../world/AvatarBuilder.js';
import { SkinPreview3D } from './SkinCustomizer.js';

export const PIGEON_TROLL_COPY = {
  icon: '🐦',
  title: "T'est un pigeon",
  subtitle: 'Tu croyais vraiment acheter les perms Admin et des skins pour 10 € ? Retourne faire tes TPs en salle U300 😂🐦',
  closeLabel: 'Rouuu-rouuu, j’ai compris'
};

const RARITY_META = {
  rare: { label: 'RARE', accents: ['#38bdf8', '#2563eb'] },
  epic: { label: 'ÉPIQUE', accents: ['#c084fc', '#7c3aed'] },
  legendary: { label: 'LÉGENDAIRE', accents: ['#fbbf24', '#f59e0b'] },
  mythic: { label: 'MYTHIQUE', accents: ['#22d3ee', '#f43f5e'] },
  ultimate: { label: 'ULTIME', accents: ['#fde047', '#f59e0b'] }
};

const MATERIAL_LABELS = {
  matrix: 'Fibre Noire Mate & Liserés Matrix',
  cyber_gold: 'Fibre Sombre & Finitions Or 24K',
  chrome_rgb: 'Chrome Poli & Bandes LED RGB',
  carbon_neon: 'Armure Carbone & Néon Émeraude',
  gold24k: 'Or Massif 24 Carats Réfléchissant',
  diamond: 'Cristal Diamant Facetté Émissif'
};

const ACCESSORY_LABELS = {
  cyber_visor: 'Visière Cyber & Antennes 3D',
  vr_gold: 'Casque VR Or 24 Carats + Écran LED',
  cisco_drone: 'Mini-Drone Switch Cisco Orbital',
  jetpack_rgb: 'Jetpack Double Réacteur RGB',
  rtx_fans: 'Module RTX 5090 Ti Double Ventilateur',
  vip_badge: 'Badge VIP Or & Clé Flottante 3D',
  gold_halo: 'Halo Doré 3D Rayonnant',
  royal_crown: 'Couronne Royale Dorée à 6 Gemmes'
};

const PARTICLE_LABELS = {
  matrix: 'Cascade de cubes Matrix verts',
  sparks_gold: 'Étincelles dorées en orbite 3D',
  lightning_cyan: 'Aura d’éclairs cyan rotatifs'
};

export const BATTLE_PASS_TIERS = [
  {
    tier: 1,
    rarity: 'rare',
    rarityLabel: 'RARE',
    name: 'Skin « Hackeur Matrix »',
    stat: '💚 Aura Matrix 3D • Vision binaire verte',
    desc: 'Tenue noire mate avec liserés néon vert fluo, visière cyber verte et aura de particules Matrix animées en 3D.',
    showcase: {
      materialTheme: 'matrix',
      accessories: ['cyber_visor'],
      particles: 'matrix',
      visorColor: '#22c55e'
    },
    iconSvg:
      '<svg viewBox="0 0 64 64" fill="none"><rect x="10" y="14" width="44" height="36" rx="8" fill="#052e16" stroke="#22c55e" stroke-width="2.5"/><path d="M18 27l7 5-7 5M29 37h14" stroke="#4ade80" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="48" cy="21" r="2.5" fill="#4ade80"/></svg>'
  },
  {
    tier: 2,
    rarity: 'epic',
    rarityLabel: 'ÉPIQUE',
    name: 'Accessoire 3D « Casque VR Or 24 Carats »',
    stat: '🥽 Or 24 Carats • Écran frontal LED cyan',
    desc: 'Modèle 3D doré brillant vissé sur la tête avec écran LED lumineux pour coder vos TPs en immersion totale.',
    showcase: {
      materialTheme: 'cyber_gold',
      accessories: ['vr_gold'],
      particles: null
    },
    iconSvg:
      '<svg viewBox="0 0 64 64" fill="none"><rect x="8" y="20" width="48" height="24" rx="8" fill="#78350f" stroke="#fbbf24" stroke-width="3"/><rect x="14" y="25" width="36" height="12" rx="4" fill="#083344" stroke="#22d3ee" stroke-width="2"/><path d="M22 31h20" stroke="#67e8f9" stroke-width="3" stroke-linecap="round"/></svg>'
  },
  {
    tier: 3,
    rarity: 'epic',
    rarityLabel: 'ÉPIQUE',
    name: 'Compagnon 3D « Mini-Drone Switch Cisco »',
    stat: '🛸 Drone orbital • LEDs Cisco temps réel',
    desc: 'Mini-switch Cisco autonome équipé de LEDs clignotantes qui flotte et gravite au-dessus de votre épaule.',
    showcase: {
      materialTheme: null,
      accessories: ['cisco_drone'],
      particles: null
    },
    iconSvg:
      '<svg viewBox="0 0 64 64" fill="none"><rect x="12" y="24" width="40" height="16" rx="4" fill="#0c4a6e" stroke="#38bdf8" stroke-width="2.5"/><circle cx="20" cy="32" r="2.5" fill="#22c55e"/><circle cx="28" cy="32" r="2.5" fill="#22d3ee"/><circle cx="36" cy="32" r="2.5" fill="#fbbf24"/><circle cx="44" cy="32" r="2.5" fill="#22c55e"/><path d="M24 44h16" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/></svg>'
  },
  {
    tier: 4,
    rarity: 'legendary',
    rarityLabel: 'LÉGENDAIRE',
    name: 'Skin « Ingénieur Réseau RGB »',
    stat: '🚀 Jetpack RGB dorsal • Liserés LED cycliques',
    desc: 'Blouse de labo chromée réfléchissante avec bandes LED animées à 16M de couleurs + Jetpack RGB dans le dos.',
    showcase: {
      materialTheme: 'chrome_rgb',
      accessories: ['jetpack_rgb'],
      particles: null
    },
    iconSvg:
      '<svg viewBox="0 0 64 64" fill="none"><path d="M20 16h24v26H20z" rx="4" fill="#334155" stroke="#e2e8f0" stroke-width="2.5"/><path d="M16 20h6v18h-6zM42 20h6v18h-6z" fill="#0f172a" stroke="#22d3ee" stroke-width="2"/><path d="M17 41l2 10 2-10M43 41l2 10 2-10" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round"/></svg>'
  },
  {
    tier: 5,
    rarity: 'epic',
    rarityLabel: 'ÉPIQUE',
    name: 'Titre & Aura « Roi de la Brasure U301 »',
    stat: '🔥 +500% de précision au fer à souder',
    desc: 'Étincelles d’étain dorées en 3D autour du personnage + bonus +500% de précision au fer à souder.',
    showcase: {
      materialTheme: 'cyber_gold',
      accessories: ['cyber_visor'],
      particles: 'sparks_gold',
      visorColor: '#fbbf24'
    },
    iconSvg:
      '<svg viewBox="0 0 64 64" fill="none"><path d="M16 48l16-16 14-14" stroke="#fbbf24" stroke-width="4" stroke-linecap="round"/><path d="M40 12l12 12-6 6-12-12 6-6z" fill="#fde047" stroke="#f59e0b" stroke-width="2"/><circle cx="16" cy="48" r="5" fill="#fb923c"/><circle cx="48" cy="40" r="3" fill="#fde047"/></svg>'
  },
  {
    tier: 6,
    rarity: 'legendary',
    rarityLabel: 'LÉGENDAIRE',
    name: 'Skin « Cyborg RTX 5090 Ti »',
    stat: '⚡ Armure Carbone • Double turbine 12000 RPM',
    desc: 'Armure métallique noire et verte, visière cyber 3D à antennes et ventilateurs lumineux rotatifs dans le dos.',
    showcase: {
      materialTheme: 'carbon_neon',
      accessories: ['cyber_visor', 'rtx_fans'],
      particles: null,
      visorColor: '#4ade80'
    },
    iconSvg:
      '<svg viewBox="0 0 64 64" fill="none"><rect x="10" y="16" width="44" height="32" rx="6" fill="#090d16" stroke="#4ade80" stroke-width="2.5"/><circle cx="24" cy="32" r="9" fill="#052e16" stroke="#22c55e" stroke-width="2.5"/><circle cx="42" cy="32" r="9" fill="#052e16" stroke="#22c55e" stroke-width="2.5"/><path d="M24 25v14M17 32h14M42 25v14M35 32h14" stroke="#86efac" stroke-width="2"/></svg>'
  },
  {
    tier: 7,
    rarity: 'legendary',
    rarityLabel: 'LÉGENDAIRE',
    name: 'Passe VIP « Clé Maîtresse Baie Serveur »',
    stat: '🔑 Badge VIP Or 3D • Accès illimité Chambre',
    desc: 'Badge doré 3D sur le torse, clé maîtresse flottante et accès illimité à la salle Chambre.',
    showcase: {
      materialTheme: 'cyber_gold',
      accessories: ['vip_badge', 'cisco_drone'],
      particles: 'sparks_gold'
    },
    iconSvg:
      '<svg viewBox="0 0 64 64" fill="none"><circle cx="23" cy="30" r="10" fill="#451a03" stroke="#fbbf24" stroke-width="3"/><path d="M33 30h21v6h-5v6h-6v-6H33" stroke="#fde047" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  },
  {
    tier: 8,
    rarity: 'mythic',
    rarityLabel: 'MYTHIQUE',
    name: 'Boost Ultime « Moyenne 20/20 Automatique »',
    stat: '👼 Halo doré 3D • Validation instantanée des TPs',
    desc: 'Armure Or 24K + Halo doré flottant en 3D et validation instantanée à 20/20 de tous les TPs.',
    showcase: {
      materialTheme: 'gold24k',
      accessories: ['gold_halo'],
      particles: 'sparks_gold'
    },
    iconSvg:
      '<svg viewBox="0 0 64 64" fill="none"><ellipse cx="32" cy="18" rx="18" ry="6" fill="none" stroke="#fde047" stroke-width="4"/><text x="32" y="47" text-anchor="middle" fill="#fde047" font-size="18" font-weight="900" font-family="Orbitron,sans-serif">20/20</text></svg>'
  },
  {
    tier: 9,
    rarity: 'mythic',
    rarityLabel: 'MYTHIQUE',
    name: 'Skin « Boss Final CIEL — Armure Diamant »',
    stat: '💎 Cristal Diamant facetté • Éclairs cyan 3D',
    desc: 'Corps entièrement texturé cristal/diamant bleu brillant avec aura d’éclairs cyan tournant en 3D.',
    showcase: {
      materialTheme: 'diamond',
      accessories: ['cyber_visor', 'jetpack_rgb'],
      particles: 'lightning_cyan',
      visorColor: '#e0f2fe'
    },
    iconSvg:
      '<svg viewBox="0 0 64 64" fill="none"><polygon points="32,10 52,24 32,54 12,24" fill="#0891b2" stroke="#67e8f9" stroke-width="2.5"/><path d="M12 24h40M32 10l-9 14 9 30 9-30-9-14z" stroke="#ecfeff" stroke-width="2"/></svg>'
  },
  {
    tier: 10,
    rarity: 'ultimate',
    rarityLabel: 'ULTIME',
    ultimate: true,
    name: '👑 PERM ADMIN COMPLÈTE + Couronne Royale 3D',
    stat: '👑 Couronne 3D • Panel /admin & Contrôle Serveur',
    desc: 'Couronne dorée 3D flottante + armure Or 24K + accès total au panel /admin, kick/ban des élèves et contrôle du serveur !',
    showcase: {
      materialTheme: 'gold24k',
      accessories: ['royal_crown', 'vr_gold', 'jetpack_rgb'],
      particles: 'sparks_gold'
    },
    iconSvg:
      '<svg viewBox="0 0 64 64" fill="none"><path d="M10 46l4-24 12 10 6-18 6 18 12-10 4 24H10z" fill="#fbbf24" stroke="#fef08a" stroke-width="2.5" stroke-linejoin="round"/><rect x="12" y="46" width="40" height="7" rx="3" fill="#b45309" stroke="#fde047" stroke-width="2"/><circle cx="32" cy="14" r="3" fill="#f43f5e"/><circle cx="14" cy="22" r="2.5" fill="#22d3ee"/><circle cx="50" cy="22" r="2.5" fill="#22d3ee"/></svg>'
  }
];

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function buildFeaturePills(tier) {
  const pills = [];
  const sc = tier.showcase || {};
  if (sc.materialTheme && MATERIAL_LABELS[sc.materialTheme]) {
    pills.push({ label: 'Matériau', value: MATERIAL_LABELS[sc.materialTheme] });
  }
  if (Array.isArray(sc.accessories)) {
    for (const acc of sc.accessories) {
      if (ACCESSORY_LABELS[acc]) {
        pills.push({ label: 'Modèle 3D', value: ACCESSORY_LABELS[acc] });
      }
    }
  }
  if (sc.particles && PARTICLE_LABELS[sc.particles]) {
    pills.push({ label: 'Particules', value: PARTICLE_LABELS[sc.particles] });
  }
  return pills;
}

export class BattlePassModal {
  constructor({ onPurchaseAttempt = null, getBaseSkin = null } = {}) {
    this.onPurchaseAttempt = typeof onPurchaseAttempt === 'function' ? onPurchaseAttempt : null;
    this.getBaseSkin = typeof getBaseSkin === 'function' ? getBaseSkin : null;
    this.modal = document.getElementById('battlepass-modal');
    this.closeBtn = document.getElementById('bp-close-btn');
    this.trackEl = document.getElementById('bp-track-list');
    this.scrollLeftBtn = document.getElementById('bp-scroll-left');
    this.scrollRightBtn = document.getElementById('bp-scroll-right');
    this.previewCanvas = document.getElementById('bp-preview-canvas');
    this.detailsEl = document.getElementById('bp-preview-details');
    this.stageRarityEl = document.getElementById('bp-stage-rarity');

    this.trollModal = document.getElementById('pigeon-troll-modal');
    this.trollTitleEl = document.getElementById('pigeon-troll-title');
    this.trollSubEl = document.getElementById('pigeon-troll-sub');
    this.trollCloseBtn = document.getElementById('pigeon-troll-close');

    this.activeTier = 1;
    this.preview = this.previewCanvas
      ? new SkinPreview3D(this.previewCanvas, () => this._getActiveShowcaseSkin(), 320, 360, {
          interactivePodium: true,
          showcaseGold: true
        })
      : null;

    this._renderTrack();
    this._renderDetails(BATTLE_PASS_TIERS[0]);
    this._bindEvents();
  }

  _getTier(tierNum) {
    return BATTLE_PASS_TIERS.find((t) => t.tier === Number(tierNum)) || BATTLE_PASS_TIERS[0];
  }

  _getActiveShowcaseSkin() {
    const base = this.getBaseSkin ? this.getBaseSkin() : DEFAULT_SKIN;
    const tier = this._getTier(this.activeTier);
    return {
      ...base,
      outfitStyle: tier.showcase?.materialTheme ? 'cyber' : base.outfitStyle,
      showcase: tier.showcase
    };
  }

  _renderTrack() {
    if (!this.trackEl) return;
    this.trackEl.innerHTML = BATTLE_PASS_TIERS.map(
      (item) => `
      <article class="bp-tier-card rarity-${item.rarity}${item.ultimate ? ' tier-ultimate' : ''}${
        item.tier === this.activeTier ? ' is-active' : ''
      }" data-tier="${item.tier}" tabindex="0">
        <div class="bp-tier-top">
          <span class="bp-tier-num">PALIER ${item.tier}</span>
          <span class="bp-rarity-pill rarity-${item.rarity}">${escapeHtml(item.rarityLabel)}</span>
          <button type="button" class="bp-tier-lock-btn" title="Débloquer avec le Passe (10 €)">🔒</button>
        </div>
        <div class="bp-tier-icon">${item.iconSvg}</div>
        <h4 class="bp-tier-title">${escapeHtml(item.name)}</h4>
        <div class="bp-tier-stat">${escapeHtml(item.stat)}</div>
        <p class="bp-tier-desc">${escapeHtml(item.desc)}</p>
      </article>
    `
    ).join('');
  }

  _renderDetails(tier) {
    if (this.stageRarityEl) {
      this.stageRarityEl.className = `bp-rarity-pill rarity-${tier.rarity}`;
      this.stageRarityEl.textContent = tier.rarityLabel;
    }
    if (!this.detailsEl) return;
    const pills = buildFeaturePills(tier);
    this.detailsEl.innerHTML = `
      <div class="bp-details-top">
        <span class="bp-details-tier">PALIER ${tier.tier} / ${BATTLE_PASS_TIERS.length} • ÉQUIPÉ SUR L'APERÇU 3D</span>
        <span class="bp-rarity-pill rarity-${tier.rarity}">${escapeHtml(tier.rarityLabel)}</span>
      </div>
      <h3 class="bp-details-title">${escapeHtml(tier.name)}</h3>
      <div class="bp-stat-chip">${escapeHtml(tier.stat)}</div>
      <p class="bp-details-desc">${escapeHtml(tier.desc)}</p>
      <div class="bp-feature-list">
        ${pills
          .map(
            (p) => `
          <div class="bp-feature-row">
            <span class="bp-feature-tag">${escapeHtml(p.label)}</span>
            <span class="bp-feature-val">${escapeHtml(p.value)}</span>
          </div>`
          )
          .join('')}
      </div>
      <button type="button" class="bp-buy-btn bp-details-buy">
        <span class="bp-buy-shine" aria-hidden="true"></span>
        💳 ACHETER LE PASSE PREMIUM — 10,00 € (Débloquer dès maintenant)
      </button>
    `;
  }

  selectTier(tierNum, forceRebuild = false) {
    const tier = this._getTier(tierNum);
    const changed = tier.tier !== this.activeTier;
    this.activeTier = tier.tier;

    if (this.trackEl) {
      this.trackEl.querySelectorAll('.bp-tier-card').forEach((card) => {
        card.classList.toggle('is-active', Number(card.dataset.tier) === tier.tier);
      });
    }

    if (changed || forceRebuild) {
      this._renderDetails(tier);
      const meta = RARITY_META[tier.rarity] || RARITY_META.ultimate;
      const accents = meta?.accents || ['#fbbf24', '#38bdf8'];
      this.preview?.rebuild();
      this.preview?.setShowcaseAccent(accents[0], accents[1]);
    }
  }

  _bindEvents() {
    if (this.trollTitleEl) this.trollTitleEl.textContent = PIGEON_TROLL_COPY.title;
    if (this.trollSubEl) this.trollSubEl.textContent = PIGEON_TROLL_COPY.subtitle;
    if (this.trollCloseBtn) this.trollCloseBtn.textContent = PIGEON_TROLL_COPY.closeLabel;

    this.closeBtn?.addEventListener('click', () => this.close());
    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
        return;
      }
      if (e.target.closest('.bp-buy-btn, .bp-tier-lock-btn')) {
        this.openTrollModal();
        return;
      }
      const card = e.target.closest('.bp-tier-card');
      if (card) {
        this.selectTier(Number(card.dataset.tier));
      }
    });

    this.trackEl?.addEventListener('pointerover', (e) => {
      const card = e.target.closest('.bp-tier-card');
      if (card) this.selectTier(Number(card.dataset.tier));
    });
    this.trackEl?.addEventListener('focusin', (e) => {
      const card = e.target.closest('.bp-tier-card');
      if (card) this.selectTier(Number(card.dataset.tier));
    });

    this.scrollLeftBtn?.addEventListener('click', () => {
      this.trackEl?.scrollBy({ left: -320, behavior: 'smooth' });
    });
    this.scrollRightBtn?.addEventListener('click', () => {
      this.trackEl?.scrollBy({ left: 320, behavior: 'smooth' });
    });

    this.trollCloseBtn?.addEventListener('click', () => this.closeTrollModal());
    this.trollModal?.addEventListener('click', (e) => {
      if (e.target === this.trollModal) this.closeTrollModal();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.trollModal && !this.trollModal.classList.contains('hidden')) {
          this.closeTrollModal();
        } else if (this.modal && !this.modal.classList.contains('hidden')) {
          this.close();
        }
      } else if (
        (e.key === 'ArrowRight' || e.key === 'ArrowLeft') &&
        this.modal &&
        !this.modal.classList.contains('hidden') &&
        this.trollModal?.classList.contains('hidden')
      ) {
        const delta = e.key === 'ArrowRight' ? 1 : -1;
        const next = Math.max(1, Math.min(BATTLE_PASS_TIERS.length, this.activeTier + delta));
        this.selectTier(next);
        const card = this.trackEl?.querySelector(`.bp-tier-card[data-tier="${next}"]`);
        card?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
      }
    });
  }

  open() {
    this.modal?.classList.remove('hidden');
    if (this.preview) {
      this.preview.setActive(true);
      this.selectTier(this.activeTier, true);
    }
  }

  close() {
    this.modal?.classList.add('hidden');
    this.preview?.setActive(false);
  }

  openTrollModal() {
    try {
      this.onPurchaseAttempt?.();
    } catch {}
    this.trollModal?.classList.remove('hidden');
  }

  closeTrollModal() {
    this.trollModal?.classList.add('hidden');
  }
}
