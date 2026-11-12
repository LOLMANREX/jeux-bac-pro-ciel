const FAQ_ITEMS = [
  {
    q: '💻 Comment jouer sur PC ?',
    a: 'Déplacez-vous avec ZQSD ou les flèches, appuyez sur Espace pour sauter et Maintenir Shift pour courir. Cliquez dans la vue 3D pour verrouiller la souris (caméra), appuyez sur E devant M. Fortin ou un poste pour interagir, V pour changer de vue (1ère / 3ème personne), T pour le chat et Tab pour le classement.'
  },
  {
    q: '📱 Comment jouer sur Mobile ou Tablette ?',
    a: 'Utilisez le joystick analogique en bas à gauche pour marcher/courir proportionnellement, glissez le doigt sur la moitié droite de l’écran pour orienter la caméra et appuyez sur les gros boutons à droite pour Interagir, Sauter, activer le Sprint ou changer de vue. Le mode paysage est conseillé.'
  },
  {
    q: '⚡ Comment fonctionnent les 5 TP et la moyenne sur 20 ?',
    a: 'Approchez-vous des 5 postes de l’atelier (Oscilloscope, Brasure PCB, Électronique, Antivirus, VM & VLAN) ou utilisez l’accès rapide. Chaque TP terminé attribue une note sur 20 et de l’XP. Obtenez au moins 10/20 aux 5 TP pour décrocher le diplôme BAC PRO CIEL et votre mention.'
  },
  {
    q: '🌐 Comment fonctionnent le multijoueur, les skins et le classement ?',
    a: 'Tous les joueurs qui lancent une Partie Rapide rejoignent la salle commune « salle-e204 ». Votre skin 3D personnalisé est synchronisé instantanément avec toute la classe. Consultez le podium et les notes globales à tout moment avec le bouton 🏆 Classement (ou Tab sur PC).'
  },
  {
    q: '🔄 Que faire si j’ai choisi la mauvaise plateforme au démarrage ?',
    a: 'Cliquez à tout moment sur le bouton « Plateforme » dans le menu principal ou dans la barre supérieure du jeu pour basculer instantanément entre le Mode PC et le Mode Mobile / Tablette.'
  }
];

function escapeHtml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export class FaqModal {
  constructor({ getDefaultAuthor, onToast } = {}) {
    this.getDefaultAuthor = getDefaultAuthor;
    this.onToast = onToast;

    this.modal = document.getElementById('faq-modal');
    this.closeBtn = document.getElementById('faq-close');
    this.tabFaq = document.getElementById('faq-tab-faq');
    this.tabIdeas = document.getElementById('faq-tab-ideas');
    this.panelFaq = document.getElementById('faq-panel-faq');
    this.panelIdeas = document.getElementById('faq-panel-ideas');
    this.faqListEl = document.getElementById('faq-questions-list');

    this.form = document.getElementById('faq-form');
    this.authorInput = document.getElementById('faq-author-input');
    this.messageInput = document.getElementById('faq-message-input');
    this.charCountEl = document.getElementById('faq-char-count');
    this.errorEl = document.getElementById('faq-form-error');
    this.submitBtn = document.getElementById('faq-submit-btn');
    this.wallEl = document.getElementById('suggestions-wall');

    this.onCloseCallback = null;
    this.activeTab = 'faq';

    this._renderFaq();
    this._bindEvents();
  }

  _renderFaq() {
    if (!this.faqListEl) return;
    this.faqListEl.innerHTML = FAQ_ITEMS.map(
      (item) => `
      <article class="faq-item">
        <h3>${escapeHtml(item.q)}</h3>
        <p>${escapeHtml(item.a)}</p>
      </article>`
    ).join('');
  }

  _switchTab(tab) {
    this.activeTab = tab === 'ideas' ? 'ideas' : 'faq';
    this.tabFaq?.classList.toggle('active', this.activeTab === 'faq');
    this.tabIdeas?.classList.toggle('active', this.activeTab === 'ideas');
    this.panelFaq?.classList.toggle('hidden', this.activeTab !== 'faq');
    this.panelIdeas?.classList.toggle('hidden', this.activeTab !== 'ideas');
    if (this.activeTab === 'ideas') {
      this._prefillAuthor();
      this.loadSuggestions();
    }
  }

  _prefillAuthor() {
    if (!this.authorInput || this.authorInput.value.trim()) return;
    const candidate = String(this.getDefaultAuthor?.() || '').trim();
    if (candidate && candidate !== 'Eleve_CIEL') {
      this.authorInput.value = candidate;
    }
  }

  async loadSuggestions() {
    if (!this.wallEl) return;
    this.wallEl.innerHTML = '<p class="hint-mini">Chargement des suggestions...</p>';
    try {
      const res = await fetch('/api/suggestions');
      const data = await res.json();
      const list = Array.isArray(data.suggestions) ? data.suggestions : [];
      if (list.length === 0) {
        this.wallEl.innerHTML =
          '<p class="hint-mini">Aucune idée publiée pour l’instant. Soyez le premier à proposer une amélioration !</p>';
        return;
      }
      this.wallEl.innerHTML = list
        .map(
          (s) => `
          <article class="suggestion-card">
            <div class="suggestion-head">
              <span class="suggestion-author">💡 ${escapeHtml(s.author)}</span>
              <span class="suggestion-date">${formatDate(s.createdAt)}</span>
            </div>
            <p class="suggestion-body">${escapeHtml(s.message)}</p>
          </article>`
        )
        .join('');
    } catch {
      this.wallEl.innerHTML = '<p class="hint-mini">Impossible de charger les propositions pour le moment.</p>';
    }
  }

  _bindEvents() {
    this.closeBtn?.addEventListener('click', () => this.close());
    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    this.tabFaq?.addEventListener('click', () => this._switchTab('faq'));
    this.tabIdeas?.addEventListener('click', () => this._switchTab('ideas'));

    this.messageInput?.addEventListener('input', () => {
      if (this.charCountEl) {
        this.charCountEl.textContent = `${this.messageInput.value.length} / 400`;
      }
    });

    this.form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      this.errorEl?.classList.add('hidden');
      const author = this.authorInput?.value.trim() || '';
      const message = this.messageInput?.value.trim() || '';

      if (!author) {
        if (this.errorEl) {
          this.errorEl.textContent = '⚠️ Le champ « Votre nom / pseudo » est obligatoire.';
          this.errorEl.classList.remove('hidden');
        }
        this.authorInput?.focus();
        return;
      }
      if (!message) {
        if (this.errorEl) {
          this.errorEl.textContent = '⚠️ Veuillez décrire votre idée ou suggestion avant d’envoyer.';
          this.errorEl.classList.remove('hidden');
        }
        this.messageInput?.focus();
        return;
      }

      if (this.submitBtn) this.submitBtn.disabled = true;
      try {
        const res = await fetch('/api/suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author, message })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (this.errorEl) {
            this.errorEl.textContent = data.error || 'Erreur lors de l’envoi de votre proposition.';
            this.errorEl.classList.remove('hidden');
          }
          return;
        }
        if (this.messageInput) this.messageInput.value = '';
        if (this.charCountEl) this.charCountEl.textContent = '0 / 400';
        this.onToast?.('💡 Merci ! Votre idée a bien été publiée.', 'success');
        await this.loadSuggestions();
      } catch {
        if (this.errorEl) {
          this.errorEl.textContent = 'Impossible de joindre le serveur pour publier l’idée.';
          this.errorEl.classList.remove('hidden');
        }
      } finally {
        if (this.submitBtn) this.submitBtn.disabled = false;
      }
    });
  }

  isOpen() {
    return Boolean(this.modal && !this.modal.classList.contains('hidden'));
  }

  open(defaultTab = 'faq', onClose = null) {
    this.onCloseCallback = onClose;
    this.errorEl?.classList.add('hidden');
    this._prefillAuthor();
    this._switchTab(defaultTab);
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
