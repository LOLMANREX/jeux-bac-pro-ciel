import { sfx } from '../core/audio.js';
import {
  getJpoWelcomeScreen,
  JPO_WELCOME_BADGE,
  JPO_WELCOME_CONFIG_LABEL,
  JPO_WELCOME_PLAY_LABEL
} from '../core/jpoConfig.js';

export class JpoWelcomeModal {
  constructor() {
    this.backdrop = document.getElementById('jpo-welcome-screen');
    this.cardEl = document.getElementById('jpo-welcome-card');
    this.badgeEl = document.getElementById('jpo-welcome-badge');
    this.titleEl = document.getElementById('jpo-welcome-title');
    this.subtitleEl = document.getElementById('jpo-welcome-subtitle');
    this.playBtn = document.getElementById('jpo-welcome-play-btn');
    this.configLink = document.getElementById('jpo-welcome-config-link');

    this._open = false;
    this._roomId = null;
    this._onPlay = null;

    this.playBtn?.addEventListener('click', () => this.startPlay());
  }

  isOpen() {
    return this._open;
  }

  open(roomId, { onPlay = null } = {}) {
    const spec = getJpoWelcomeScreen(roomId);
    if (!spec || !this.backdrop) return false;

    this._open = true;
    this._roomId = spec.roomId;
    this._onPlay = typeof onPlay === 'function' ? onPlay : null;

    const accent = spec.accent || '#38bdf8';
    this.cardEl?.style?.setProperty?.('--jpo-accent', accent);
    this.backdrop?.style?.setProperty?.('--jpo-accent', accent);

    if (this.badgeEl) this.badgeEl.textContent = JPO_WELCOME_BADGE;
    if (this.titleEl) this.titleEl.textContent = spec.title;
    if (this.subtitleEl) this.subtitleEl.textContent = spec.subtitle;
    if (this.playBtn) this.playBtn.textContent = JPO_WELCOME_PLAY_LABEL;
    if (this.configLink) this.configLink.textContent = JPO_WELCOME_CONFIG_LABEL;

    this.backdrop.classList?.remove('hidden');
    document?.body?.classList?.add?.('jpo-welcome-open');
    return true;
  }

  startPlay() {
    if (!this._open) return false;
    if (typeof sfx?.interact === 'function') {
      sfx.interact();
    } else {
      sfx?.click?.();
    }
    const cb = this._onPlay;
    this.close();
    cb?.();
    return true;
  }

  close() {
    this._open = false;
    this._roomId = null;
    this._onPlay = null;
    this.backdrop?.classList?.add('hidden');
    document?.body?.classList?.remove?.('jpo-welcome-open');
  }
}
