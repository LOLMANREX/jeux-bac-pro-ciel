import { detectTouchDevice } from '../core/gameState.js';

export class PlatformModal {
  constructor({ onSelect } = {}) {
    this.onSelect = onSelect;
    this.modal = document.getElementById('platform-modal');
    this.cardPc = document.getElementById('platform-card-pc');
    this.cardMobile = document.getElementById('platform-card-mobile');
    this.closeBtn = document.getElementById('platform-close');
    this.badgePc = document.getElementById('platform-rec-pc');
    this.badgeMobile = document.getElementById('platform-rec-mobile');
    this.onCloseCallback = null;

    this._syncRecommendedBadge();
    this._bindEvents();
  }

  _syncRecommendedBadge() {
    const isTouch = detectTouchDevice();
    this.badgePc?.classList.toggle('hidden', isTouch);
    this.badgeMobile?.classList.toggle('hidden', !isTouch);
  }

  syncActiveChoice(touchMode) {
    this.cardPc?.classList.toggle('selected', !touchMode);
    this.cardMobile?.classList.toggle('selected', Boolean(touchMode));
  }

  _bindEvents() {
    this.cardPc?.addEventListener('click', () => {
      this._choose('pc');
    });
    this.cardMobile?.addEventListener('click', () => {
      this._choose('mobile');
    });
    this.closeBtn?.addEventListener('click', () => this.close());
  }

  _choose(mode) {
    const isMobile = mode === 'mobile';
    this.syncActiveChoice(isMobile);
    this.close();
    this.onSelect?.(mode);
  }

  isOpen() {
    return Boolean(this.modal && !this.modal.classList.contains('hidden'));
  }

  open(touchMode = false, onClose = null, allowCloseBtn = true) {
    this.onCloseCallback = onClose;
    this.syncActiveChoice(touchMode);
    if (this.closeBtn) {
      this.closeBtn.classList.toggle('hidden', !allowCloseBtn);
    }
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
