import { sfx } from '../core/audio.js';

export const PIGEON_TROLL_COPY = {
  icon: '🐦',
  title: "T'est un pigeon",
  subtitle:
    'Tu croyais vraiment acheter les perms Admin et des skins pour 10 € ? Retourne faire tes TPs en salle U300 😂🐦',
  closeLabel: 'Rouuu-rouuu, j’ai compris'
};

export const BATTLE_PASS_TIERS = [
  {
    tier: 1,
    name: 'Skin « Hackeur Matrix »',
    category: 'SKIN EXCLUSIF',
    rarity: 'epic',
    rarityLabel: 'ÉPIQUE',
    description: 'Tenue noire furtive & néons verts matriciels',
    icon: '🕶️',
    accent: '#22c55e',
    svg: `<svg viewBox="0 0 64 64" class="bp-svg"><rect x="14" y="10" width="36" height="44" rx="8" fill="#052e16" stroke="#22c55e" stroke-width="2.5"/><path d="M22 24h20M22 32h14M22 40h20" stroke="#4ade80" stroke-width="3" stroke-linecap="round"/><circle cx="44" cy="40" r="4" fill="#22c55e"/></svg>`
  },
  {
    tier: 2,
    name: 'Casque VR Or Massif 24 Carats',
    category: 'ACCESSOIRE TÊTE',
    rarity: 'rare',
    rarityLabel: 'ULTRA RARE',
    description: 'Visière holographique plaquée or 24K',
    icon: '🥽',
    accent: '#fbbf24',
    svg: `<svg viewBox="0 0 64 64" class="bp-svg"><rect x="10" y="20" width="44" height="24" rx="9" fill="#78350f" stroke="#fbbf24" stroke-width="2.5"/><rect x="15" y="25" width="34" height="14" rx="5" fill="#fde68a"/><path d="M18 32h10l4-4 4 8 4-4h8" fill="none" stroke="#92400e" stroke-width="2.5" stroke-linecap="round"/></svg>`
  },
  {
    tier: 3,
    name: 'Titre « Roi de la Brasure U301 »',
    category: 'TITRE EXCLUSIF',
    rarity: 'rare',
    rarityLabel: 'ULTRA RARE',
    description: 'Badge doré affiché dans le classement & le hall',
    icon: '🔥',
    accent: '#fb923c',
    svg: `<svg viewBox="0 0 64 64" class="bp-svg"><path d="M12 44L18 18l14 10 14-10 6 26H12z" fill="#7c2d12" stroke="#fb923c" stroke-width="2.5" stroke-linejoin="round"/><circle cx="18" cy="15" r="3.5" fill="#fdba74"/><circle cx="32" cy="12" r="4" fill="#fde047"/><circle cx="46" cy="15" r="3.5" fill="#fdba74"/></svg>`
  },
  {
    tier: 4,
    name: 'Skin « Ingénieur Réseau RGB »',
    category: 'SKIN EXCLUSIF',
    rarity: 'epic',
    rarityLabel: 'ÉPIQUE',
    description: 'Blouse dorée animée à LEDs RJ45 synchronisées',
    icon: '🌈',
    accent: '#38bdf8',
    svg: `<svg viewBox="0 0 64 64" class="bp-svg"><path d="M16 14h32l6 14-8 6v20H18V34l-8-6 6-14z" fill="#1e293b" stroke="#38bdf8" stroke-width="2.5"/><path d="M24 14l8 12 8-12" fill="none" stroke="#fbbf24" stroke-width="2.5"/><circle cx="32" cy="40" r="6" fill="#22d3ee"/></svg>`
  },
  {
    tier: 5,
    name: 'Fers à souder auto-guidés',
    category: 'AVANTAGE TP',
    rarity: 'legendary',
    rarityLabel: 'LÉGENDAIRE',
    description: 'Précision robotisée instantanée à 350°C sans pont',
    icon: '🤖',
    accent: '#f43f5e',
    svg: `<svg viewBox="0 0 64 64" class="bp-svg"><path d="M14 50L44 20l6 6-30 30H14v-6z" fill="#4c0519" stroke="#fb7185" stroke-width="2.5"/><path d="M44 20l8-8" stroke="#fde047" stroke-width="4" stroke-linecap="round"/><circle cx="52" cy="12" r="4" fill="#fbbf24"/></svg>`
  },
  {
    tier: 6,
    name: 'Skin « Cyborg RTX 5090 Ti »',
    category: 'SKIN EXCLUSIF',
    rarity: 'legendary',
    rarityLabel: 'LÉGENDAIRE',
    description: 'Armure ventilée triple turbine 600W + Ray Tracing',
    icon: '🦾',
    accent: '#a855f7',
    svg: `<svg viewBox="0 0 64 64" class="bp-svg"><rect x="10" y="18" width="44" height="28" rx="6" fill="#2e1065" stroke="#c084fc" stroke-width="2.5"/><circle cx="24" cy="32" r="8" fill="#0f172a" stroke="#22d3ee" stroke-width="2"/><circle cx="42" cy="32" r="8" fill="#0f172a" stroke="#c084fc" stroke-width="2"/><circle cx="24" cy="32" r="3" fill="#22d3ee"/><circle cx="42" cy="32" r="3" fill="#c084fc"/></svg>`
  },
  {
    tier: 7,
    name: 'Clé de la Baie Serveur (Chambre)',
    category: 'ACCÈS VIP',
    rarity: 'legendary',
    rarityLabel: 'LÉGENDAIRE',
    description: 'Badge magnétique rouge accès illimité baies 42U',
    icon: '🔑',
    accent: '#ef4444',
    svg: `<svg viewBox="0 0 64 64" class="bp-svg"><circle cx="22" cy="32" r="11" fill="#450a0a" stroke="#f87171" stroke-width="2.5"/><circle cx="22" cy="32" r="4" fill="#fca5a5"/><path d="M33 32h21M44 32v8M51 32v11" stroke="#f87171" stroke-width="3.5" stroke-linecap="round"/></svg>`
  },
  {
    tier: 8,
    name: 'Boost « 20/20 garanti à tous les TPs »',
    category: 'BOOST DIVIN',
    rarity: 'mythic',
    rarityLabel: 'MYTHIQUE',
    description: 'Multiplicateur de moyenne générale × 999 sur U300',
    icon: '📈',
    accent: '#10b981',
    svg: `<svg viewBox="0 0 64 64" class="bp-svg"><rect x="10" y="12" width="44" height="40" rx="8" fill="#022c22" stroke="#34d399" stroke-width="2.5"/><path d="M16 40l10-10 8 6 14-16" fill="none" stroke="#6ee7b7" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><text x="32" y="48" text-anchor="middle" fill="#a7f3d0" font-size="11" font-weight="900">20/20</text></svg>`
  },
  {
    tier: 9,
    name: 'Skin Mythique « Boss Final CIEL »',
    category: 'SKIN MYTHIQUE',
    rarity: 'mythic',
    rarityLabel: 'MYTHIQUE',
    description: 'Armure Diamant prismatique avec aura électrique',
    icon: '💎',
    accent: '#22d3ee',
    svg: `<svg viewBox="0 0 64 64" class="bp-svg"><polygon points="32,8 54,24 44,54 20,54 10,24" fill="#083344" stroke="#67e8f9" stroke-width="2.5"/><polygon points="32,14 46,26 32,48 18,26" fill="#22d3ee" opacity="0.55"/></svg>`
  },
  {
    tier: 10,
    name: '⚡ PERM ADMIN COMPLÈTE + Contrôle du Serveur & Ban des élèves',
    category: 'PALIER ULTIME',
    rarity: 'ultimate',
    rarityLabel: 'ADMIN DIEU',
    description: 'Console /admin débloquée, kick/ban des camarades & super-pouvoirs U300',
    icon: '👑',
    accent: '#fbbf24',
    ultimate: true,
    svg: `<svg viewBox="0 0 64 64" class="bp-svg"><circle cx="32" cy="32" r="26" fill="#451a03" stroke="#fbbf24" stroke-width="3"/><path d="M35 12L18 35h13l-3 17 18-24H33l2-16z" fill="#fde047" stroke="#f59e0b" stroke-width="1.5" stroke-linejoin="round"/></svg>`
  }
];

export class BattlePassModal {
  constructor() {
    this.modal = document.getElementById('battlepass-modal');
    this.trackEl = document.getElementById('bp-track-list');
    this.closeBtn = document.getElementById('bp-close-btn');
    this.scrollLeftBtn = document.getElementById('bp-scroll-left');
    this.scrollRightBtn = document.getElementById('bp-scroll-right');
    this.buyButtons = document.querySelectorAll('.bp-buy-btn');

    this.trollModal = document.getElementById('pigeon-troll-modal');
    this.trollTitleEl = document.getElementById('pigeon-troll-title');
    this.trollSubEl = document.getElementById('pigeon-troll-sub');
    this.trollCloseBtn = document.getElementById('pigeon-troll-close');

    this.onCloseCallback = null;
    this._renderTiers();
    this._renderTrollCopy();
    this._bindEvents();
  }

  _renderTiers() {
    if (!this.trackEl) return;
    this.trackEl.innerHTML = BATTLE_PASS_TIERS.map(
      (t) => `
      <button
        type="button"
        class="bp-tier-card rarity-${t.rarity} ${t.ultimate ? 'tier-ultimate' : ''}"
        data-bp-tier="${t.tier}"
        style="--bp-accent:${t.accent}"
      >
        <div class="bp-tier-top">
          <span class="bp-tier-num">PALIER ${t.tier}</span>
          <span class="bp-rarity-pill">${t.rarityLabel}</span>
        </div>
        <div class="bp-art-box">
          ${t.svg}
          <span class="bp-art-emoji">${t.icon}</span>
          <span class="bp-lock-badge" title="Verrouillé — Passe Premium requis">🔒</span>
        </div>
        <div class="bp-card-cat">${t.category}</div>
        <div class="bp-card-title">${t.name}</div>
        <div class="bp-card-desc">${t.description}</div>
      </button>`
    ).join('');
  }

  _renderTrollCopy() {
    if (this.trollTitleEl) this.trollTitleEl.textContent = PIGEON_TROLL_COPY.title;
    if (this.trollSubEl) this.trollSubEl.textContent = PIGEON_TROLL_COPY.subtitle;
    if (this.trollCloseBtn) this.trollCloseBtn.textContent = PIGEON_TROLL_COPY.closeLabel;
  }

  _bindEvents() {
    this.closeBtn?.addEventListener('click', () => {
      sfx.click();
      this.close();
    });

    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    this.buyButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.openTrollModal();
      });
    });

    this.trackEl?.addEventListener('click', (e) => {
      const card = e.target.closest('.bp-tier-card');
      if (card) {
        this.openTrollModal();
      }
    });

    this.trackEl?.addEventListener(
      'wheel',
      (e) => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          this.trackEl.scrollLeft += e.deltaY * 1.4;
        }
      },
      { passive: false }
    );

    this.scrollLeftBtn?.addEventListener('click', () => {
      sfx.click();
      this.trackEl?.scrollBy({ left: -340, behavior: 'smooth' });
    });

    this.scrollRightBtn?.addEventListener('click', () => {
      sfx.click();
      this.trackEl?.scrollBy({ left: 340, behavior: 'smooth' });
    });

    this.trollCloseBtn?.addEventListener('click', () => {
      sfx.click();
      this.closeTrollModal();
    });

    this.trollModal?.addEventListener('click', (e) => {
      if (e.target === this.trollModal) {
        this.closeTrollModal();
      }
    });
  }

  isOpen() {
    return Boolean(this.modal && !this.modal.classList.contains('hidden'));
  }

  isTrollOpen() {
    return Boolean(this.trollModal && !this.trollModal.classList.contains('hidden'));
  }

  open(onClose = null) {
    this.onCloseCallback = onClose;
    this.modal?.classList.remove('hidden');
  }

  close() {
    if (!this.isOpen()) return false;
    this.closeTrollModal();
    this.modal?.classList.add('hidden');
    const cb = this.onCloseCallback;
    this.onCloseCallback = null;
    cb?.();
    return true;
  }

  openTrollModal() {
    sfx.error();
    this.trollModal?.classList.remove('hidden');
  }

  closeTrollModal() {
    if (!this.isTrollOpen()) return false;
    this.trollModal?.classList.add('hidden');
    return true;
  }
}
