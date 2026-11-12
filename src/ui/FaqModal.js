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
    this.tabList = document.getElementById('posts-tab-list');
    this.tabCreate = document.getElementById('posts-tab-create');
    this.panelList = document.getElementById('posts-panel-list');
    this.panelCreate = document.getElementById('posts-panel-create');

    this.form = document.getElementById('faq-form');
    this.authorInput = document.getElementById('faq-author-input');
    this.messageInput = document.getElementById('faq-message-input');
    this.charCountEl = document.getElementById('faq-char-count');
    this.errorEl = document.getElementById('faq-form-error');
    this.submitBtn = document.getElementById('faq-submit-btn');
    this.wallEl = document.getElementById('suggestions-wall');

    this.onCloseCallback = null;
    this.activeTab = 'list';

    this._bindEvents();
  }

  _clearErrors() {
    this.errorEl?.classList.add('hidden');
    this.authorInput?.classList.remove('faq-input-error');
    this.messageInput?.classList.remove('faq-input-error');
  }

  _showError(text, targetInput = null) {
    if (this.errorEl) {
      this.errorEl.textContent = text;
      this.errorEl.classList.remove('hidden');
    }
    if (targetInput) {
      targetInput.classList.add('faq-input-error');
      targetInput.focus();
    }
  }

  _switchTab(tab) {
    this.activeTab = tab === 'create' ? 'create' : 'list';
    this.tabList?.classList.toggle('active', this.activeTab === 'list');
    this.tabCreate?.classList.toggle('active', this.activeTab === 'create');
    this.panelList?.classList.toggle('hidden', this.activeTab !== 'list');
    this.panelCreate?.classList.toggle('hidden', this.activeTab !== 'create');
    this._clearErrors();
    if (this.activeTab === 'list') {
      this.loadSuggestions();
    } else {
      this._prefillAuthor();
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
    this.wallEl.innerHTML = '<p class="hint-mini">Chargement des rapports...</p>';
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch('/api/suggestions', { signal: controller.signal });
      const data = await res.json();
      const raw = Array.isArray(data.suggestions) ? data.suggestions : [];
      const list = [...raw].sort(
        (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
      );
      if (list.length === 0) {
        this.wallEl.innerHTML =
          '<p class="hint-mini">Aucun post ou rapport publié pour le moment. Ouvrez « Créer un post » pour envoyer le premier message !</p>';
        return;
      }
      this.wallEl.innerHTML = list
        .map(
          (s) => `
          <article class="suggestion-card">
            <div class="suggestion-head">
              <span class="suggestion-author">📝 ${escapeHtml(s.author)}</span>
              <span class="suggestion-date">${formatDate(s.createdAt)}</span>
            </div>
            <p class="suggestion-body">${escapeHtml(s.message)}</p>
          </article>`
        )
        .join('');
    } catch {
      this.wallEl.innerHTML =
        '<p class="hint-mini">Impossible de charger les rapports pour le moment.</p>';
    } finally {
      clearTimeout(timerId);
    }
  }

  _bindEvents() {
    this.closeBtn?.addEventListener('click', () => this.close());
    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    this.tabList?.addEventListener('click', () => this._switchTab('list'));
    this.tabCreate?.addEventListener('click', () => this._switchTab('create'));

    this.authorInput?.addEventListener('input', () => {
      this.authorInput.classList.remove('faq-input-error');
    });

    this.messageInput?.addEventListener('input', () => {
      this.messageInput.classList.remove('faq-input-error');
      if (this.charCountEl) {
        this.charCountEl.textContent = `${this.messageInput.value.length} / 400`;
      }
    });

    this.form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      this._clearErrors();
      const author = this.authorInput?.value.trim() || '';
      const message = this.messageInput?.value.trim() || '';

      if (!author) {
        this._showError('⚠️ Le champ « Votre nom / pseudo » est obligatoire.', this.authorInput);
        return;
      }
      if (!message) {
        this._showError('⚠️ Veuillez saisir votre message / rapport avant d’envoyer.', this.messageInput);
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
          this._showError(data.error || 'Erreur lors de la publication du post.');
          return;
        }
        if (this.messageInput) this.messageInput.value = '';
        if (this.charCountEl) this.charCountEl.textContent = '0 / 400';
        this.onToast?.('✅ Votre post a été publié !', 'success');
        this._switchTab('list');
      } catch {
        this._showError('Impossible de joindre le serveur pour envoyer le post.');
      } finally {
        if (this.submitBtn) this.submitBtn.disabled = false;
      }
    });
  }

  isOpen() {
    return Boolean(this.modal && !this.modal.classList.contains('hidden'));
  }

  open(defaultTab = 'list', onClose = null) {
    this.onCloseCallback = onClose;
    this._clearErrors();
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
