export const APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined'
    ? __APP_VERSION__
    : 'v2.0 - Patch Multijoueur & Classement';

export const BUILD_TIME_ISO =
  typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString();

export function formatBuildTime(iso = BUILD_TIME_ISO) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export const CHANGELOG_RELEASES = [
  {
    version: 'v2.0 — Patch Multijoueur & Classement',
    tag: 'DERNIÈRE MÀJ',
    date: 'Novembre 2026',
    items: [
      'Mode multijoueur temps réel WebSocket (salles partagées, déplacements 3D fluides, emotes/chat).',
      'Synchronisation live des skins personnalisés (tenues, couleurs, accessoires) entre tous les joueurs.',
      'Nouveau tableau de classement (Leaderboard touche Tab) avec moyennes de TP (/20) et XP.',
      'Affichage de l’état de la connexion serveur en direct, reconnexion auto et support multi-onglet.'
    ]
  },
  {
    version: 'v1.0 — Lancement Atelier CIEL 3D',
    tag: 'INITIAL',
    date: 'Novembre 2026',
    items: [
      'Atelier 3D BAC PRO CIEL en salle E204 avec M. Fortin (boîte de dialogue interactive).',
      '5 mini-jeux métiers : Oscilloscope, Brasure PCB, Électronique, Antivirus et VM/VLAN.',
      'Vue 1ère et 3ème personne (touche V), saut (Espace) et réglages FOV.'
    ]
  }
];

export class ChangelogModal {
  constructor() {
    this.modal = document.getElementById('changelog-modal');
    this.versionSubtitle = document.getElementById('changelog-build-meta');
    this.listEl = document.getElementById('changelog-list');
    this.closeBtn = document.getElementById('changelog-close');
    this.doneBtn = document.getElementById('changelog-done-btn');
    this.onCloseCallback = null;

    this._renderBadges();
    this._renderReleases();
    this._bindEvents();
  }

  _renderBadges() {
    const buildLabel = formatBuildTime();
    const html = `
      <span class="vb-main">🏷️ ${APP_VERSION}</span>
      <span class="vb-meta">Build ${buildLabel} • Notes de MÀJ</span>
    `;
    ['menu-version-badge', 'hud-version-badge'].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.innerHTML = html;
    });
    if (this.versionSubtitle) {
      this.versionSubtitle.textContent = `${APP_VERSION} • Compilé le ${buildLabel}`;
    }
  }

  _renderReleases() {
    if (!this.listEl) return;
    this.listEl.innerHTML = CHANGELOG_RELEASES.map(
      (rel, idx) => `
      <section class="changelog-release ${idx === 0 ? 'latest' : ''}">
        <div class="changelog-rel-head">
          <h3>${rel.version}</h3>
          <span class="changelog-tag ${idx === 0 ? 'latest' : ''}">${rel.tag} • ${rel.date}</span>
        </div>
        <ul class="changelog-items">
          ${rel.items.map((item) => `<li>${item}</li>`).join('')}
        </ul>
      </section>`
    ).join('');
  }

  _bindEvents() {
    this.closeBtn?.addEventListener('click', () => this.close());
    this.doneBtn?.addEventListener('click', () => this.close());
    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });
  }

  isOpen() {
    return Boolean(this.modal && !this.modal.classList.contains('hidden'));
  }

  open(onClose = null) {
    this.onCloseCallback = onClose;
    this.modal?.classList.remove('hidden');
  }

  close() {
    if (!this.isOpen()) return false;
    this.modal?.classList.add('hidden');
    const cb = this.onCloseCallback;
    this.onCloseCallback = null;
    cb?.();
    return true;
  }
}
