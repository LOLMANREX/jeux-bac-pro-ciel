import { detectTouchDevice } from '../core/gameState.js';

export class PlatformModal {
  constructor({ onSelect } = {}) {
    this.onSelect = onSelect;
    this.modal = document.getElementById('platform-modal');
    this.cardPc = document.getElementById('platform-card-pc');
    this.cardMobile = document.getElementById('platform-card-mobile');
    this.cardVr = document.getElementById('platform-card-vr');
    this.closeBtn = document.getElementById('platform-close');
    this.badgePc = document.getElementById('platform-rec-pc');
    this.badgeMobile = document.getElementById('platform-rec-mobile');
    this.badgeVr = document.getElementById('platform-rec-vr');
    this.onCloseCallback = null;

    this._syncRecommendedBadge();
    this._bindEvents();
  }

  _syncRecommendedBadge() {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const isVrDevice = /OculusBrowser|Quest|Meta Quest/i.test(ua);
    const hasXr = typeof navigator !== 'undefined' && Boolean(navigator.xr);
    const isTouch = !isVrDevice && detectTouchDevice();
    this.badgePc?.classList.toggle('hidden', isTouch || isVrDevice);
    this.badgeMobile?.classList.toggle('hidden', !isTouch || isVrDevice);
    this.badgeVr?.classList.toggle('hidden', !isVrDevice && !hasXr);
  }

  syncActiveChoice(touchMode, vrMode = false) {
    this.cardPc?.classList.toggle('selected', !touchMode && !vrMode);
    this.cardMobile?.classList.toggle('selected', Boolean(touchMode) && !vrMode);
    this.cardVr?.classList.toggle('selected', Boolean(vrMode));
  }

  _bindEvents() {
    this.cardPc?.addEventListener('click', () => {
      this._choose('pc');
    });
    this.cardMobile?.addEventListener('click', () => {
      this._choose('mobile');
    });
    this.cardVr?.addEventListener('click', () => {
      this._choose('vr');
    });
    this.closeBtn?.addEventListener('click', () => this.close());
  }

  _choose(mode) {
    const isMobile = mode === 'mobile';
    const isVr = mode === 'vr';
    this.syncActiveChoice(isMobile, isVr);
    this.close();
    this.onSelect?.(mode);
  }

  isOpen() {
    return Boolean(this.modal && !this.modal.classList.contains('hidden'));
  }

  open(touchMode = false, onClose = null, allowCloseBtn = true, vrMode = false) {
    this.onCloseCallback = onClose;
    this.syncActiveChoice(touchMode, vrMode);
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
