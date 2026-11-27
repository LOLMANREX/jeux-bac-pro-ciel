import { sfx } from '../core/audio.js';
import {
  getJpoMissionBriefing,
  JPO_BRIEFING_RESUME_LABEL,
  JPO_BRIEFING_START_LABEL
} from '../core/jpoConfig.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export class JpoBriefingModal {
  constructor() {
    this.backdrop = document.getElementById('jpo-briefing-modal');
    this.cardEl = document.getElementById('jpo-briefing-card');
    this.titleEl = document.getElementById('jpo-briefing-title');
    this.introEl = document.getElementById('jpo-briefing-intro');
    this.stepsEl = document.getElementById('jpo-briefing-steps');
    this.startBtn = document.getElementById('jpo-briefing-start-btn');
    this.closeBtn = document.getElementById('jpo-briefing-close');

    this._open = false;
    this._mode = 'start';
    this._onStart = null;
    this._onCancel = null;

    this.startBtn?.addEventListener('click', () => this.confirmPrimary());
    this.closeBtn?.addEventListener('click', () => this.dismiss());
    this.backdrop?.addEventListener('click', (e) => {
      if (e.target === this.backdrop) {
        this.dismiss();
      }
    });
  }

  isOpen() {
    return this._open;
  }

  open(tpKey, { mode = 'start', onStart = null, onCancel = null } = {}) {
    const briefing = getJpoMissionBriefing(tpKey);
    if (!briefing || !this.backdrop) return false;

    this._mode = mode === 'help' ? 'help' : 'start';
    this._onStart = typeof onStart === 'function' ? onStart : null;
    this._onCancel = typeof onCancel === 'function' ? onCancel : null;
    this._open = true;

    this.cardEl?.style?.setProperty?.('--jpo-accent', briefing.accent || '#38bdf8');
    if (this.titleEl) this.titleEl.textContent = briefing.title;
    if (this.introEl) this.introEl.textContent = briefing.intro;
    if (this.stepsEl) {
      const steps = Array.isArray(briefing.steps) ? briefing.steps.slice(0, 3) : [];
      this.stepsEl.innerHTML = steps
        .map(
          (step, idx) => `
          <li class="jpo-briefing-step">
            <span class="jpo-briefing-num">${escapeHtml(step.num ?? idx + 1)}</span>
            <span class="jpo-briefing-step-ico" aria-hidden="true">${escapeHtml(step.icon || '')}</span>
            <span class="jpo-briefing-step-text">
              <strong>${escapeHtml(step.lead)}</strong> ${escapeHtml(step.text)}
            </span>
          </li>`
        )
        .join('');
    }
    if (this.startBtn) {
      this.startBtn.textContent =
        this._mode === 'help' ? JPO_BRIEFING_RESUME_LABEL : JPO_BRIEFING_START_LABEL;
    }

    this.backdrop.classList.remove('hidden');
    return true;
  }

  confirmPrimary() {
    if (!this._open) return false;
    sfx.click();
    const mode = this._mode;
    const cb = this._onStart;
    this.close();
    if (mode === 'start') {
      cb?.();
    }
    return true;
  }

  dismiss() {
    if (!this._open) return false;
    sfx.click();
    const mode = this._mode;
    const cb = this._onCancel;
    this.close();
    if (mode === 'start') {
      cb?.();
    }
    return true;
  }

  close() {
    this._open = false;
    this._onStart = null;
    this._onCancel = null;
    this.backdrop?.classList?.add('hidden');
  }
}
