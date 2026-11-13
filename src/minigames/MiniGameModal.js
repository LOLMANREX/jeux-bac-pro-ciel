import { sfx } from '../core/audio.js';
import { getStationById } from '../core/gameState.js';

export class MiniGameModal {
  constructor() {
    this.backdrop = document.getElementById('minigame-modal');
    this.iconEl = document.getElementById('mg-icon');
    this.subtitleEl = document.getElementById('mg-subtitle');
    this.titleEl = document.getElementById('mg-title');
    this.stagePillsEl = document.getElementById('mg-stage-pills');
    this.timerEl = document.getElementById('mg-timer');
    this.contentEl = document.getElementById('mg-content');
    this.exitBtn = document.getElementById('mg-exit-btn');

    this.activeGame = null;
    this.activeTpId = null;
    this.timerInterval = null;
    this.startTimeMs = 0;
    this.onCloseCallback = null;
    this.onFinishCallback = null;

    this.exitBtn.addEventListener('click', () => {
      sfx.click();
      this.close();
    });
  }

  open(tpId, createGameFn, { onComplete, onClose }) {
    const tp = getStationById(tpId);
    if (!tp) return;
    this.cleanupActive();

    this.activeTpId = tpId;
    this.onFinishCallback = onComplete;
    this.onCloseCallback = onClose;

    this.iconEl.textContent = tp.icon;
    this.subtitleEl.textContent = `BAC PRO CIEL • ATELIER 3D • ${tp.pole.toUpperCase()}`;
    this.titleEl.textContent = tp.title;
    this.backdrop.classList.add('tp3d-mode');
    this.backdrop.classList.remove('hidden');
    requestAnimationFrame(() => {
      this.backdrop.classList.add('tp3d-visible');
    });

    this.startTimeMs = Date.now();
    this._updateTimer();
    this.timerInterval = setInterval(() => this._updateTimer(), 1000);

    const api = {
      container: this.contentEl,
      setStages: (stages, activeIdx, onSelect) => {
        this.stagePillsEl.innerHTML = '';
        stages.forEach((item, idx) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `stage-pill ${idx === activeIdx ? 'active' : ''}`;
          const label =
            typeof item === 'string'
              ? item
              : item?.score != null
                ? `${item.name} (${item.score}/20)`
                : item?.name || '';
          btn.textContent = label;
          btn.addEventListener('click', () => {
            sfx.click();
            onSelect?.(idx);
          });
          this.stagePillsEl.appendChild(btn);
        });
      },
      finishTp: (scoreOutOf20, summaryHtml) => {
        const durationSec = Math.max(1, Math.round((Date.now() - this.startTimeMs) / 1000));
        const finalScore = Math.max(0, Math.min(20, Math.round(scoreOutOf20 * 10) / 10));
        if (finalScore >= 10) sfx.success();
        else sfx.error();

        this.onFinishCallback?.({
          tpId: this.activeTpId,
          score: finalScore,
          durationSec
        });

        this._showResultScreen(tp, finalScore, durationSec, summaryHtml);
      }
    };

    this.activeGame = createGameFn(api);
  }

  _showResultScreen(tp, score, durationSec, summaryHtml) {
    this.cleanupActive();
    const passed = score >= 10;
    const estXp = Math.round(score * 15) + 30;
    const mention =
      score >= 18
        ? 'Félicitations du Professeur CIEL !'
        : score >= 15
          ? 'Très solide maîtrise CIEL !'
          : score >= 10
            ? 'TP Validé — Continuez ainsi !'
            : 'TP non validé (< 10/20) — Recommencez pour améliorer votre note.';

    this.contentEl.innerHTML = `
      <div class="mg-result-backdrop">
        <div class="mg-result-card">
          <div class="mg-result-badge ${passed ? 'pass' : 'fail'}">
            <div class="mg-result-score">${score.toFixed(1)}<span>/20</span></div>
            <div class="mg-result-xp">+${estXp} XP</div>
            <div class="mg-result-status">${passed ? '✅ COMPÉTENCE VALIDÉE' : '⚠️ À RETRAVAILLER'}</div>
          </div>
          <h3>${tp.icon} ${tp.title}</h3>
          <p class="mg-result-prof">👨‍🏫 <strong>Professeur CIEL :</strong> « ${mention} »</p>
          <div class="mg-result-meta">⏱️ Temps réalisé : <strong>${this._formatSec(durationSec)}</strong></div>
          <div class="mg-result-summary">${summaryHtml || ''}</div>
          <div class="mg-result-actions">
            <button id="mg-replay-btn" class="btn-hud">🔄 Refaire le TP</button>
            <button id="mg-back-3d-btn" class="btn-primary">Retour à l'atelier 3D ▶</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('mg-back-3d-btn')?.addEventListener('click', () => {
      sfx.click();
      this.close();
    });
    document.getElementById('mg-replay-btn')?.addEventListener('click', () => {
      sfx.click();
      this.onCloseCallback?.({ replayTpId: tp.id });
    });
  }

  _updateTimer() {
    const sec = Math.floor((Date.now() - this.startTimeMs) / 1000);
    this.timerEl.textContent = this._formatSec(sec);
  }

  _formatSec(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  cleanupActive() {
    if (this.activeGame && typeof this.activeGame.destroy === 'function') {
      this.activeGame.destroy();
    }
    this.activeGame = null;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  close() {
    this.cleanupActive();
    this.backdrop.classList.remove('tp3d-visible', 'tp3d-mode');
    this.backdrop.classList.add('hidden');
    this.contentEl.innerHTML = '';
    this.stagePillsEl.innerHTML = '';
    this.onCloseCallback?.({});
  }
}
