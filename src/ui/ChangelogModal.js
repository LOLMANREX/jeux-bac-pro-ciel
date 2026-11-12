export const APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined'
    ? __APP_VERSION__
    : 'v2.6 - HUD épuré & Tableau de classement mural 3D';

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
    version: 'v2.6 — HUD épuré & Tableau de classement mural 3D',
    date: '12/11/2026',
    tag: 'DERNIÈRE MÀJ',
    items: [
      'Épure complète du HUD en jeu : conservation des 3 boutons essentiels alignés en haut à droite (Chat, Paramètres, Menu principal) sur PC comme sur Mobile.',
      'Intégration d’un grand écran numérique 3D directement fixé sur le mur principal de la salle E204 affichant le classement en direct (« 🏆 CLASSEMENT EN DIRECT - BAC PRO CIEL »).',
      'Mise à jour temps réel du tableau 3D via CanvasTexture optimisée (rang, pseudo, moyenne /20, XP et pastille En ligne / Hors ligne) sans impact sur les FPS.'
    ]
  },
  {
    version: 'v2.5 — Posts & Rapports joueurs + Admin complet',
    tag: 'HISTORIQUE',
    date: '12/11/2026',
    items: [
      'Refonte complète de la fenêtre communautaire en « Posts & Rapports » (menu principal et HUD) avec uniquement 2 onglets : « Rapports des utilisateurs » (triés du plus récent au plus ancien) et « Créer un post ».',
      'Suppression complète de l’ancien onglet FAQ basique et validation obligatoire du nom/pseudo lors de l’envoi d’un post.',
      'Réorganisation complète de la console /admin en deux sections par onglets : Gestion des Utilisateurs (statut, temps cumulé en heures/minutes, dernière connexion, XP, notes de TP, moyenne /20, réinitialisation et suppression) et Gestion des Posts / Rapports avec modération.'
    ]
  },
  {
    version: 'v2.4 — Correctif démarrage & connexion serveur',
    tag: 'HISTORIQUE',
    date: '12/11/2026',
    items: [
      'Correction critique au démarrage : résolution d’une référence circulaire à l’initialisation du HUD qui bloquait l’écran d’accueil.',
      'Rétablissement immédiat de l’aperçu 3D en direct du personnage sur le menu principal avec protection WebGL.',
      'Ajout d’un timeout strict de 3 secondes (AbortController) sur /api/health et /api/rooms pour ne plus jamais bloquer sur « Connexion au serveur CIEL… ».',
      'Isolation des modales secondaires (Plateforme, FAQ, Changelog) dans des blocs protégés : le lancement d’une partie reste toujours possible.'
    ]
  },
  {
    version: 'v2.3 — Sélecteur PC/Mobile, FAQ & Boîte à idées',
    tag: 'HISTORIQUE',
    date: '12/11/2026',
    items: [
      'Écran de choix de plateforme (Mode PC ou Mode Mobile / Tablette) dès l’ouverture et réouvrable à tout moment.',
      'Nouvel onglet communautaire « FAQ & Idées » avec tutoriel complet et mur persistant de suggestions des joueurs.',
      'Contrôles tactiles multi-touch complets (joystick analogique gauche, caméra au doigt à droite, boutons d’action et UI 100 % responsive).',
      'Console d’administration sécurisée sur /admin (suivi du temps de jeu, réinitialisation, suppression et modération des idées).'
    ]
  },
  {
    version: 'v2.0 — Patch Multijoueur & Classement',
    tag: 'HISTORIQUE',
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
