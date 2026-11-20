import {
  FORMATIVE_POLES,
  FORMATIVE_TP_CATALOG,
  evaluateFormativeTp,
  getFormativePoleById,
  getFormativeTpById,
  sanitizeFormativeAnswers
} from '../../core/formativeCatalog.js';

function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const VALID_POLE_FILTERS = ['all', ...FORMATIVE_POLES.map((p) => p.id)];
const VALID_STATUS_FILTERS = ['all', 'todo', 'in_progress', 'validated'];

export class FormativeApp {
  constructor(options = {}) {
    this.gameState = options.gameState;
    this.onSubmitProgress = options.onSubmitProgress || null;
    this.onOpenTools = options.onOpenTools || null;
    this.onReward = options.onReward || null;
    this.onToast = options.onToast || null;

    this.containerEl = null;
    this.activePoleFilter = 'all';
    this.activeStatusFilter = 'all';
    this.activeTpId = null;
    this.lastRewardBanner = null;
    this._saveTimers = new Map();
    this._inFlightClaims = new Set();
    this._draftInputs = new Map();
    this._orderingBuffers = new Map();
    this._swapSelection = new Map();
  }

  mount(containerEl, params = {}) {
    this.containerEl = containerEl;
    if (params?.tpId && getFormativeTpById(params.tpId)) {
      this.activeTpId = params.tpId;
      this.lastRewardBanner = null;
    }
    if (params?.pole && VALID_POLE_FILTERS.includes(params.pole)) {
      this.activePoleFilter = params.pole;
      this.activeTpId = null;
    }
    this.render();
  }

  unmount() {
    for (const timer of this._saveTimers.values()) {
      clearTimeout(timer);
    }
    this._saveTimers.clear();
    this.containerEl = null;
  }

  canGoBack() {
    return Boolean(this.activeTpId);
  }

  goBack() {
    if (this.activeTpId) {
      this.activeTpId = null;
      this.lastRewardBanner = null;
      this.render();
      return true;
    }
    return false;
  }

  _getStoredEntry(tpId) {
    if (typeof this.gameState?.getFormativeEntry === 'function') {
      return this.gameState.getFormativeEntry(tpId);
    }
    const map = this.gameState?.formativeProgress || this.gameState?.profile?.formativeProgress || {};
    return map[tpId] || { tpId, answers: {}, rewarded: false };
  }

  _isTpRewarded(tpId) {
    const rewardedList =
      this.gameState?.formativeRewardedTps ||
      this.gameState?.profile?.formativeRewardedTps ||
      [];
    if (Array.isArray(rewardedList) && rewardedList.includes(tpId)) return true;
    return Boolean(this._getStoredEntry(tpId)?.rewarded);
  }

  _getAnswersForTp(tpId) {
    const entry = this._getStoredEntry(tpId);
    return sanitizeFormativeAnswers(tpId, entry?.answers || {});
  }

  _updateTpAnswer(tpId, questionId, value, immediateSave = true) {
    const tp = getFormativeTpById(tpId);
    if (!tp) return;
    const currentAnswers = this._getAnswersForTp(tpId);
    const nextAnswers = { ...currentAnswers };
    if (
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)
    ) {
      delete nextAnswers[questionId];
    } else {
      nextAnswers[questionId] = value;
    }
    const cleanAnswers = sanitizeFormativeAnswers(tpId, nextAnswers);
    const evalRes = evaluateFormativeTp(tpId, cleanAnswers);
    const alreadyRewarded = this._isTpRewarded(tpId);

    this.gameState?.setFormativeProgress?.(
      tpId,
      {
        tpId,
        answers: cleanAnswers,
        completionPct: evalRes.completionPct,
        scoreOutOf20: evalRes.scoreOutOf20,
        status: evalRes.status,
        validated: evalRes.validated,
        rewarded: alreadyRewarded,
        updatedAt: new Date().toISOString()
      },
      { rewarded: alreadyRewarded }
    );

    if (this.activeTpId === tpId) {
      this._refreshTpViewState(tp, evalRes, cleanAnswers);
    } else {
      this.render();
    }

    if (immediateSave) {
      this._scheduleSubmit(tpId, cleanAnswers, 80);
    } else {
      this._scheduleSubmit(tpId, cleanAnswers, 450);
    }
  }

  _scheduleSubmit(tpId, answers, delayMs = 200) {
    const prevTimer = this._saveTimers.get(tpId);
    if (prevTimer) clearTimeout(prevTimer);
    const timer = setTimeout(() => {
      this._saveTimers.delete(tpId);
      this._submitToServer(tpId, answers);
    }, delayMs);
    this._saveTimers.set(tpId, timer);
  }

  async _submitToServer(tpId, answers) {
    if (!this.onSubmitProgress) return null;
    if (this._inFlightClaims.has(tpId)) return null;
    const evalRes = evaluateFormativeTp(tpId, answers);
    const needLock = evalRes.validated && !this._isTpRewarded(tpId);
    if (needLock) this._inFlightClaims.add(tpId);
    try {
      const res = await this.onSubmitProgress(tpId, answers);
      if (res?.ok) {
        if (res.coinsEarned > 0 || res.xpEarned > 0) {
          this.lastRewardBanner = {
            tpId,
            kind: 'earned',
            coinsEarned: res.coinsEarned,
            xpEarned: res.xpEarned,
            message: `🎉 TP validé à 100 % ! +${res.coinsEarned} 🪙 CC et +${res.xpEarned} XP attribués.`
          };
          this.onReward?.(res);
        } else if (evalRes.validated && res.alreadyRewarded && !this.lastRewardBanner) {
          this.lastRewardBanner = {
            tpId,
            kind: 'already',
            coinsEarned: 0,
            xpEarned: 0,
            message: '✅ TP validé à 100 % (récompense déjà attribuée précédemment).'
          };
        }
        if (this.containerEl && this.activeTpId === tpId) {
          const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
          const isEditingShort =
            activeEl &&
            activeEl.tagName === 'INPUT' &&
            activeEl.classList?.contains('fmt-short-input');
          if (!isEditingShort) {
            this._refreshTpViewState(getFormativeTpById(tpId), evaluateFormativeTp(tpId, this._getAnswersForTp(tpId)), this._getAnswersForTp(tpId));
          }
        }
      }
      return res;
    } finally {
      this._inFlightClaims.delete(tpId);
    }
  }

  _refreshTpViewState(tp, evalRes, answers) {
    if (!this.containerEl || !tp) return;
    const segBar = this.containerEl.querySelector('.fmt-segmented-bar');
    if (segBar) {
      segBar.innerHTML = evalRes.results
        .map(
          (r, idx) =>
            `<button type="button" class="fmt-seg fmt-seg-${r.status}" data-scroll-q="${escapeHtml(r.questionId)}" title="Question ${idx + 1}">Q${idx + 1}</button>`
        )
        .join('');
      this._bindSegmentButtons();
    }
    const pctLabel = this.containerEl.querySelector('#fmt-tp-pct');
    if (pctLabel) {
      pctLabel.textContent = `${evalRes.correctCount}/${evalRes.totalQuestions} (${evalRes.completionPct} %) • ${evalRes.scoreOutOf20.toFixed(1)}/20`;
    }

    const rewarded = this._isTpRewarded(tp.id);
    const rewardChip = this.containerEl.querySelector('#fmt-tp-reward-chip');
    if (rewardChip) {
      rewardChip.textContent = rewarded
        ? '✅ Récompense reçue'
        : `🪙 +${tp.rewardCoins} CC • +${tp.rewardXp} XP`;
      rewardChip.className = `fmt-reward-chip ${rewarded ? 'is-claimed' : ''}`;
    }

    const bannerHost = this.containerEl.querySelector('#fmt-reward-banner-host');
    if (bannerHost) {
      if (this.lastRewardBanner && this.lastRewardBanner.tpId === tp.id) {
        bannerHost.innerHTML = `<div class="fmt-reward-banner ${this.lastRewardBanner.kind}">${escapeHtml(this.lastRewardBanner.message)}</div>`;
      } else if (evalRes.validated && rewarded) {
        bannerHost.innerHTML = `<div class="fmt-reward-banner already">✅ TP validé à 100 % • Récompense de ${tp.rewardCoins} 🪙 CC déjà créditée sur votre compte.</div>`;
      } else {
        bannerHost.innerHTML = '';
      }
    }

    evalRes.results.forEach((res) => {
      const card = this.containerEl.querySelector(`[data-q-card="${res.questionId}"]`);
      if (!card) return;
      card.classList.remove('status-unanswered', 'status-correct', 'status-incorrect');
      card.classList.add(`status-${res.status}`);
      const badge = card.querySelector('.fmt-q-badge');
      if (badge) {
        badge.className = `fmt-q-badge status-${res.status}`;
        badge.textContent =
          res.status === 'correct'
            ? '✅ Bonne réponse'
            : res.status === 'incorrect'
              ? '❌ À corriger'
              : '⚪ Non répondu';
      }
      const fb = card.querySelector('.fmt-q-feedback');
      if (fb) {
        if (res.status === 'correct') {
          fb.className = 'fmt-q-feedback is-correct';
          fb.textContent = '✅ Validé ! Réponse exacte enregistrée.';
        } else if (res.status === 'incorrect') {
          fb.className = 'fmt-q-feedback is-incorrect';
          fb.textContent = `💡 Indice : ${res.hint || 'Vérifiez vos calculs ou les commandes dans Outils CIEL.'}`;
        } else {
          fb.className = 'fmt-q-feedback is-empty';
          fb.textContent = '';
        }
      }
    });

    for (const q of tp.questions) {
      if (q.type === 'mcq_single') {
        const chosen = answers[q.id] || '';
        const btns = this.containerEl.querySelectorAll(`[data-q-id="${q.id}"][data-opt-id]`);
        btns.forEach((b) => b.classList.toggle('selected', b.dataset.optId === chosen));
      } else if (q.type === 'mcq_multi') {
        const chosen = new Set(Array.isArray(answers[q.id]) ? answers[q.id] : []);
        const btns = this.containerEl.querySelectorAll(`[data-q-id="${q.id}"][data-multi-id]`);
        btns.forEach((b) => {
          const on = chosen.has(b.dataset.multiId);
          b.classList.toggle('selected', on);
          const chk = b.querySelector('.fmt-chk-box');
          if (chk) chk.textContent = on ? '☑' : '☐';
        });
      }
    }
  }

  render() {
    if (!this.containerEl) return;
    if (this.activeTpId) {
      this._renderTpSheet(this.activeTpId);
    } else {
      this._renderCatalog();
    }
  }

  _renderCatalog() {
    const items = FORMATIVE_TP_CATALOG.map((tp) => {
      const answers = this._getAnswersForTp(tp.id);
      const evalRes = evaluateFormativeTp(tp.id, answers);
      const rewarded = this._isTpRewarded(tp.id);
      const validated = evalRes.validated || (rewarded && Boolean(this._getStoredEntry(tp.id)?.validated));
      const status = validated ? 'validated' : evalRes.status;
      const pct = validated ? 100 : evalRes.completionPct;
      return { tp, evalRes, rewarded, validated, status, pct };
    });

    const filtered = items.filter((it) => {
      if (this.activePoleFilter !== 'all' && it.tp.pole !== this.activePoleFilter) return false;
      if (this.activeStatusFilter !== 'all' && it.status !== this.activeStatusFilter) return false;
      return true;
    });

    const totalValidated = items.filter((it) => it.validated).length;
    const totalCoinsEarned = items.reduce((a, it) => a + (it.rewarded ? it.tp.rewardCoins : 0), 0);
    const totalCoinsAll = items.reduce((a, it) => a + it.tp.rewardCoins, 0);

    const poleBtns = [
      { id: 'all', label: 'Tous les pôles', icon: '📚' },
      ...FORMATIVE_POLES.map((p) => ({ id: p.id, label: p.shortLabel, icon: p.icon }))
    ]
      .map(
        (p) =>
          `<button type="button" class="fmt-filter-pill ${this.activePoleFilter === p.id ? 'active' : ''}" data-pole-filter="${p.id}">${p.icon} ${escapeHtml(p.label)}</button>`
      )
      .join('');

    const statusBtns = [
      { id: 'all', label: 'Tous statuts' },
      { id: 'todo', label: 'À faire' },
      { id: 'in_progress', label: 'En cours' },
      { id: 'validated', label: 'Validé' }
    ]
      .map(
        (st) =>
          `<button type="button" class="fmt-status-pill ${this.activeStatusFilter === st.id ? 'active' : ''}" data-status-filter="${st.id}">${escapeHtml(st.label)}</button>`
      )
      .join('');

    const cardsHtml =
      filtered.length === 0
        ? '<div class="fmt-empty-state">Aucun TP ne correspond à ces filtres.</div>'
        : filtered
            .map(({ tp, evalRes, rewarded, validated, status, pct }) => {
              const pole = getFormativePoleById(tp.pole);
              const statusLabel =
                status === 'validated' ? 'Validé' : status === 'in_progress' ? 'En cours' : 'À faire';
              const actionLabel =
                status === 'validated'
                  ? 'Revoir le TP'
                  : status === 'in_progress'
                    ? 'Continuer'
                    : 'Démarrer';
              return `
                <article class="fmt-tp-card status-${status}" data-open-tp="${escapeHtml(tp.id)}">
                  <div class="fmt-tp-card-head">
                    <span class="fmt-pole-tag" style="--pole-color: ${pole?.color || '#38bdf8'}">${pole?.icon || '📘'} ${escapeHtml(pole?.shortLabel || '')}</span>
                    <span class="fmt-status-badge status-${status}">${statusLabel}</span>
                  </div>
                  <div class="fmt-tp-title-row">
                    <span class="fmt-tp-ico">${tp.icon}</span>
                    <h3>${escapeHtml(tp.title)}</h3>
                  </div>
                  <p class="fmt-tp-desc">${escapeHtml(tp.context)}</p>
                  <div class="fmt-tp-meta">
                    <span>⏱️ ~${tp.durationMin} min</span>
                    <span>❓ ${tp.questions.length} blocs</span>
                    <span class="fmt-tp-reward ${rewarded ? 'claimed' : ''}">${rewarded ? '✅ Récompense reçue' : `🪙 +${tp.rewardCoins} CC • +${tp.rewardXp} XP`}</span>
                  </div>
                  <div class="fmt-tp-progress-row">
                    <div class="fmt-progress-track">
                      <div class="fmt-progress-fill status-${status}" style="width: ${pct}%"></div>
                    </div>
                    <span class="fmt-progress-pct">${pct}% (${validated ? tp.questions.length : evalRes.correctCount}/${tp.questions.length})</span>
                  </div>
                  <div class="fmt-tp-card-foot">
                    <span class="fmt-tp-score">${evalRes.answeredCount > 0 || validated ? `Note : ${validated ? '20.0' : evalRes.scoreOutOf20.toFixed(1)}/20` : 'Non commencé'}</span>
                    <button type="button" class="fmt-open-btn" data-open-tp="${escapeHtml(tp.id)}">${actionLabel} ▶</button>
                  </div>
                </article>
              `;
            })
            .join('');

    this.containerEl.innerHTML = `
      <div class="fmt-app">
        <div class="fmt-hero-bar">
          <div>
            <div class="fmt-kicker">ESPACE TRAVAUX PRATIQUES • BAC PRO CIEL</div>
            <h2>📝 CIEL Formative — TP Interactifs &amp; Correction en Direct</h2>
          </div>
          <div class="fmt-hero-stats">
            <div class="fmt-stat-chip"><strong>${totalValidated}/${items.length}</strong><span>Validés</span></div>
            <div class="fmt-stat-chip gold"><strong>${totalCoinsEarned}/${totalCoinsAll}</strong><span>🪙 CC gagnés</span></div>
          </div>
        </div>

        <div class="fmt-filters-block">
          <div class="fmt-filter-row">${poleBtns}</div>
          <div class="fmt-filter-row">${statusBtns}</div>
        </div>

        <div class="fmt-tp-grid">${cardsHtml}</div>
      </div>
    `;

    this.containerEl.querySelectorAll('[data-pole-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activePoleFilter = btn.dataset.poleFilter || 'all';
        this.render();
      });
    });
    this.containerEl.querySelectorAll('[data-status-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeStatusFilter = btn.dataset.statusFilter || 'all';
        this.render();
      });
    });
    this.containerEl.querySelectorAll('[data-open-tp]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.dataset.openTp;
        if (id) {
          this.activeTpId = id;
          this.lastRewardBanner = null;
          this.render();
        }
      });
    });
  }

  _bindSegmentButtons() {
    if (!this.containerEl) return;
    this.containerEl.querySelectorAll('[data-scroll-q]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const qId = btn.dataset.scrollQ;
        const card = this.containerEl?.querySelector(`[data-q-card="${qId}"]`);
        card?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      });
    });
  }

  _renderQuestionBody(tpId, q, idx, answer, res) {
    if (q.type === 'mcq_single') {
      const selected = answer || '';
      const opts = q.options
        .map(
          (o) => `
          <button type="button" class="fmt-mcq-opt ${selected === o.id ? 'selected' : ''}" data-q-id="${escapeHtml(q.id)}" data-opt-id="${escapeHtml(o.id)}">
            <span class="fmt-radio-dot"></span>
            <span>${escapeHtml(o.label)}</span>
          </button>`
        )
        .join('');
      return `<div class="fmt-mcq-list">${opts}</div>`;
    }

    if (q.type === 'mcq_multi') {
      const selectedSet = new Set(Array.isArray(answer) ? answer : []);
      const opts = q.options
        .map((o) => {
          const on = selectedSet.has(o.id);
          return `
            <button type="button" class="fmt-mcq-opt multi ${on ? 'selected' : ''}" data-q-id="${escapeHtml(q.id)}" data-multi-id="${escapeHtml(o.id)}">
              <span class="fmt-chk-box">${on ? '☑' : '☐'}</span>
              <span>${escapeHtml(o.label)}</span>
            </button>`;
        })
        .join('');
      return `<div class="fmt-mcq-list">${opts}</div>`;
    }

    if (q.type === 'short_text') {
      const key = `${tpId}:${q.id}`;
      const val = this._draftInputs.has(key) ? this._draftInputs.get(key) : String(answer || '');
      return `
        <div class="fmt-short-row">
          <input type="text" class="fmt-short-input" data-short-q="${escapeHtml(q.id)}" value="${escapeHtml(val)}" placeholder="${escapeHtml(q.placeholder || 'Votre réponse...')}" maxlength="120" autocomplete="off" spellcheck="false" />
          <button type="button" class="fmt-validate-btn" data-validate-short="${escapeHtml(q.id)}">Valider ✓</button>
        </div>
      `;
    }

    if (q.type === 'ordering') {
      const bufKey = `${tpId}:${q.id}`;
      let orderIds = this._orderingBuffers.get(bufKey);
      if (!Array.isArray(orderIds) || orderIds.length !== q.items.length) {
        orderIds =
          Array.isArray(answer) && answer.length === q.items.length
            ? [...answer]
            : q.items.map((it) => it.id);
        this._orderingBuffers.set(bufKey, orderIds);
      }
      const itemMap = new Map(q.items.map((it) => [it.id, it]));
      const swapIdx = this._swapSelection.get(bufKey) ?? null;
      const rows = orderIds
        .map((itemId, pos) => {
          const item = itemMap.get(itemId);
          return `
            <div class="fmt-order-item ${swapIdx === pos ? 'swap-active' : ''}" data-order-q="${escapeHtml(q.id)}" data-order-pos="${pos}">
              <span class="fmt-order-num">${pos + 1}</span>
              <span class="fmt-order-lbl">${escapeHtml(item?.label || itemId)}</span>
              <div class="fmt-order-actions">
                <button type="button" class="fmt-step-btn" data-order-move="up" data-order-q="${escapeHtml(q.id)}" data-pos="${pos}" ${pos === 0 ? 'disabled' : ''} title="Monter">▲</button>
                <button type="button" class="fmt-step-btn" data-order-move="down" data-order-q="${escapeHtml(q.id)}" data-pos="${pos}" ${pos === orderIds.length - 1 ? 'disabled' : ''} title="Descendre">▼</button>
              </div>
            </div>
          `;
        })
        .join('');
      return `
        <div class="fmt-order-list">${rows}</div>
        <div class="fmt-order-foot">
          <button type="button" class="fmt-validate-btn" data-validate-order="${escapeHtml(q.id)}">Vérifier l’ordre ✓</button>
        </div>
      `;
    }

    if (q.type === 'matching') {
      const currentPairs = answer && typeof answer === 'object' ? answer : {};
      const rows = q.leftItems
        .map((left) => {
          const curRight = currentPairs[left.id] || '';
          const opts = [
            `<option value="">-- Choisir --</option>`,
            ...q.rightItems.map(
              (r) =>
                `<option value="${escapeHtml(r.id)}" ${curRight === r.id ? 'selected' : ''}>${escapeHtml(r.label)}</option>`
            )
          ].join('');
          return `
            <div class="fmt-match-row">
              <span class="fmt-match-left">${escapeHtml(left.label)}</span>
              <span class="fmt-match-arrow">→</span>
              <select class="fmt-match-select" data-match-q="${escapeHtml(q.id)}" data-match-left="${escapeHtml(left.id)}">${opts}</select>
            </div>
          `;
        })
        .join('');
      return `<div class="fmt-match-list">${rows}</div>`;
    }

    return '';
  }

  _renderTpSheet(tpId) {
    const tp = getFormativeTpById(tpId);
    if (!tp) {
      this.activeTpId = null;
      this._renderCatalog();
      return;
    }
    const pole = getFormativePoleById(tp.pole);
    const answers = this._getAnswersForTp(tpId);
    const evalRes = evaluateFormativeTp(tpId, answers);
    const rewarded = this._isTpRewarded(tpId);

    const segsHtml = evalRes.results
      .map(
        (r, idx) =>
          `<button type="button" class="fmt-seg fmt-seg-${r.status}" data-scroll-q="${escapeHtml(r.questionId)}" title="Question ${idx + 1}">Q${idx + 1}</button>`
      )
      .join('');

    const questionsHtml = tp.questions
      .map((q, idx) => {
        const res = evalRes.results[idx];
        const statusBadge =
          res.status === 'correct'
            ? '✅ Bonne réponse'
            : res.status === 'incorrect'
              ? '❌ À corriger'
              : '⚪ Non répondu';
        const fbHtml =
          res.status === 'correct'
            ? '<div class="fmt-q-feedback is-correct">✅ Validé ! Réponse exacte enregistrée.</div>'
            : res.status === 'incorrect'
              ? `<div class="fmt-q-feedback is-incorrect">💡 Indice : ${escapeHtml(res.hint || '')}</div>`
              : '<div class="fmt-q-feedback is-empty"></div>';
        return `
          <section class="fmt-question-card status-${res.status}" data-q-card="${escapeHtml(q.id)}">
            <div class="fmt-q-head">
              <span class="fmt-q-num">Question ${idx + 1} / ${tp.questions.length}</span>
              <span class="fmt-q-badge status-${res.status}">${statusBadge}</span>
            </div>
            <h4 class="fmt-q-prompt">${escapeHtml(q.prompt)}</h4>
            <div class="fmt-q-body">${this._renderQuestionBody(tpId, q, idx, answers[q.id], res)}</div>
            ${fbHtml}
          </section>
        `;
      })
      .join('');

    const bannerHtml =
      this.lastRewardBanner && this.lastRewardBanner.tpId === tpId
        ? `<div class="fmt-reward-banner ${this.lastRewardBanner.kind}">${escapeHtml(this.lastRewardBanner.message)}</div>`
        : evalRes.validated && rewarded
          ? `<div class="fmt-reward-banner already">✅ TP validé à 100 % • Récompense de ${tp.rewardCoins} 🪙 CC déjà créditée sur votre compte.</div>`
          : '';

    this.containerEl.innerHTML = `
      <div class="fmt-sheet">
        <div class="fmt-sheet-topbar">
          <button type="button" id="fmt-btn-back-catalog" class="fmt-back-btn">← Catalogue</button>
          <div class="fmt-sheet-title-wrap">
            <span class="fmt-pole-tag" style="--pole-color: ${pole?.color || '#38bdf8'}">${pole?.icon || ''} ${escapeHtml(pole?.label || '')}</span>
            <h2>${tp.icon} ${escapeHtml(tp.title)}</h2>
          </div>
          <div class="fmt-sheet-actions">
            <button type="button" id="fmt-btn-open-tools" class="fmt-tools-shortcut">🧰 Outils CIEL</button>
            <span id="fmt-tp-reward-chip" class="fmt-reward-chip ${rewarded ? 'is-claimed' : ''}">
              ${rewarded ? '✅ Récompense reçue' : `🪙 +${tp.rewardCoins} CC • +${tp.rewardXp} XP`}
            </span>
          </div>
        </div>

        <div class="fmt-segmented-wrap">
          <div class="fmt-segmented-head">
            <span>Progression en direct</span>
            <strong id="fmt-tp-pct">${evalRes.correctCount}/${evalRes.totalQuestions} (${evalRes.completionPct} %) • ${evalRes.scoreOutOf20.toFixed(1)}/20</strong>
          </div>
          <div class="fmt-segmented-bar">${segsHtml}</div>
        </div>

        <div id="fmt-reward-banner-host">${bannerHtml}</div>

        <div class="fmt-context-card">
          <div class="fmt-context-title">📋 Mise en situation professionnelle</div>
          <p>${escapeHtml(tp.context)}</p>
          ${tp.diagram ? `<pre class="fmt-diagram">${escapeHtml(tp.diagram)}</pre>` : ''}
        </div>

        <div class="fmt-questions-stack">${questionsHtml}</div>
      </div>
    `;

    this.containerEl.querySelector('#fmt-btn-back-catalog')?.addEventListener('click', () => {
      this.activeTpId = null;
      this.lastRewardBanner = null;
      this.render();
    });

    this.containerEl.querySelector('#fmt-btn-open-tools')?.addEventListener('click', () => {
      this.onOpenTools?.();
    });

    this._bindSegmentButtons();

    this.containerEl.querySelectorAll('[data-opt-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const qId = btn.dataset.qId;
        const optId = btn.dataset.optId;
        if (qId && optId) this._updateTpAnswer(tpId, qId, optId, true);
      });
    });

    this.containerEl.querySelectorAll('[data-multi-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const qId = btn.dataset.qId;
        const optId = btn.dataset.multiId;
        if (!qId || !optId) return;
        const cur = new Set(Array.isArray(this._getAnswersForTp(tpId)[qId]) ? this._getAnswersForTp(tpId)[qId] : []);
        if (cur.has(optId)) cur.delete(optId);
        else cur.add(optId);
        this._updateTpAnswer(tpId, qId, [...cur], true);
      });
    });

    this.containerEl.querySelectorAll('[data-short-q]').forEach((input) => {
      const qId = input.dataset.shortQ;
      const key = `${tpId}:${qId}`;
      input.addEventListener('input', () => {
        this._draftInputs.set(key, input.value);
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this._draftInputs.set(key, input.value);
          this._updateTpAnswer(tpId, qId, input.value.trim(), true);
        }
      });
    });

    this.containerEl.querySelectorAll('[data-validate-short]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const qId = btn.dataset.validateShort;
        const input = this.containerEl?.querySelector(`[data-short-q="${qId}"]`);
        const val = input ? input.value : '';
        this._draftInputs.set(`${tpId}:${qId}`, val);
        this._updateTpAnswer(tpId, qId, String(val).trim(), true);
      });
    });

    this.containerEl.querySelectorAll('[data-order-move]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const qId = btn.dataset.orderQ;
        const pos = Number(btn.dataset.pos);
        const dir = btn.dataset.orderMove === 'up' ? -1 : 1;
        const bufKey = `${tpId}:${qId}`;
        const arr = [...(this._orderingBuffers.get(bufKey) || [])];
        const targetPos = pos + dir;
        if (targetPos < 0 || targetPos >= arr.length) return;
        const tmp = arr[pos];
        arr[pos] = arr[targetPos];
        arr[targetPos] = tmp;
        this._orderingBuffers.set(bufKey, arr);
        this._swapSelection.delete(bufKey);
        this._updateTpAnswer(tpId, qId, arr, true);
        this.render();
      });
    });

    this.containerEl.querySelectorAll('[data-validate-order]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const qId = btn.dataset.validateOrder;
        const arr = this._orderingBuffers.get(`${tpId}:${qId}`);
        if (Array.isArray(arr)) {
          this._updateTpAnswer(tpId, qId, [...arr], true);
        }
      });
    });

    this.containerEl.querySelectorAll('[data-match-q]').forEach((sel) => {
      sel.addEventListener('change', () => {
        const qId = sel.dataset.matchQ;
        const leftId = sel.dataset.matchLeft;
        const cur = { ...(this._getAnswersForTp(tpId)[qId] || {}) };
        if (sel.value) cur[leftId] = sel.value;
        else delete cur[leftId];
        this._updateTpAnswer(tpId, qId, cur, true);
      });
    });
  }
}
