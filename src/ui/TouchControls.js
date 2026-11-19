export function formatInteractAction(target) {
  if (!target) {
    return { icon: '👆', shortLabel: 'Interagir', fullLabel: 'Interagir' };
  }
  const lbl = String(target.label || '').trim();
  if (target.id === 'teacher') {
    return {
      icon: '👨‍🏫',
      shortLabel: 'Parler',
      fullLabel: lbl || 'Parler au Professeur CIEL'
    };
  }
  if (target.type === 'pc_station' || /PC|CIEL OS/i.test(lbl)) {
    return {
      icon: '🖥️',
      shortLabel: 'Utiliser PC',
      fullLabel: lbl || 'Utiliser le PC (CIEL OS)'
    };
  }
  if (target.type === 'hiding_rack' || /Baie|Cacher/i.test(lbl)) {
    return {
      icon: '🗄️',
      shortLabel: 'Baie',
      fullLabel: lbl || 'Baie de Brassage'
    };
  }
  if (target.type === 'shop_kiosk' || /Boutique/i.test(lbl)) {
    return {
      icon: '🛒',
      shortLabel: 'Boutique',
      fullLabel: lbl || 'Ouvrir la Boutique CIEL'
    };
  }
  if (target.type === 'combat_door' || /ARÈNE DE COMBAT/i.test(lbl)) {
    return {
      icon: '⚔️',
      shortLabel: 'Arène',
      fullLabel: lbl || 'Entrer — Arène de Combat CIEL'
    };
  }
  if (target.type === 'combat_lobby_mode') {
    return {
      icon: '🔄',
      shortLabel: 'Mode',
      fullLabel: lbl || 'Changer Mode (Fusils / Mêlée)'
    };
  }
  if (target.type === 'combat_lobby_ready') {
    return {
      icon: '⚔️',
      shortLabel: 'Lancer',
      fullLabel: lbl || 'Prêt / Lancer l’Arène'
    };
  }
  if (target.type === 'combat_lobby_exit') {
    return {
      icon: '🚪',
      shortLabel: 'Quitter',
      fullLabel: lbl || 'Quitter le Lobby Combat'
    };
  }
  return {
    icon: '👆',
    shortLabel: 'Interagir',
    fullLabel: lbl || 'Lancer le TP'
  };
}

export class TouchControls {
  constructor(player, handlers = {}) {
    this.player = player;
    this.handlers = handlers;

    this.rootEl = document.getElementById('touch-controls');
    this.joyZone = document.getElementById('touch-joystick-zone');
    this.joyBase = document.getElementById('touch-joystick-base');
    this.joyKnob = document.getElementById('touch-joystick-knob');
    this.lookZone = document.getElementById('touch-look-zone');
    this.hudTopEl = document.querySelector('.hud-top');
    this.hudActionsEl = document.querySelector('.hud-actions');

    this.btnContextInteract = document.getElementById('touch-context-interact');
    this.btnInteract = document.getElementById('touch-btn-interact');
    this.btnJump = document.getElementById('touch-btn-jump');
    this.btnSprint = document.getElementById('touch-btn-sprint');
    this.btnCamera = document.getElementById('touch-btn-camera');
    this.btnMic = document.getElementById('touch-btn-mic');
    this.combatPadEl = document.getElementById('touch-combat-pad');
    this.btnCombatFire = document.getElementById('touch-btn-fire');
    this.btnCombatReload = document.getElementById('touch-btn-reload');
    this.btnCombatWeaponNext = document.getElementById('touch-btn-weapon-next');
    this.combatModeActive = false;
    this.combatModeKind = 'guns';

    this.visible = false;
    this.joyPointerId = null;
    this.joyOrigin = { x: 0, y: 0 };
    this.joyRadius = 46;

    this.lookPointerId = null;
    this.lookLast = { x: 0, y: 0 };
    this.lookStart = { x: 0, y: 0 };
    this.lookMoved = 0;

    this.sprintActive = false;
    this.currentTarget = null;
    this._cleanups = [];

    this._bindJoystick();
    this._bindLookZone();
    this._bindActionButtons();

    const onBlur = () => this.resetInputs();
    window.addEventListener('blur', onBlur);
    this._cleanups.push(() => window.removeEventListener('blur', onBlur));
  }

  setVisible(show) {
    this.visible = Boolean(show);
    if (this.rootEl) {
      this.rootEl.classList.toggle('hidden', !this.visible);
    }
    if (!this.visible) {
      this.resetInputs();
    }
    if (this.combatPadEl) {
      this.combatPadEl.classList.toggle('hidden', !(this.visible && this.combatModeActive));
    }
    this.setInteractTarget(this.currentTarget);
  }

  setCombatMode(active, { mode = 'guns', weaponShortName = '' } = {}) {
    this.combatModeActive = Boolean(active);
    this.combatModeKind = mode === 'melee' ? 'melee' : 'guns';
    if (this.combatPadEl) {
      this.combatPadEl.classList.toggle('hidden', !(this.visible && this.combatModeActive));
    }
    if (this.btnCombatFire) {
      const ico = this.btnCombatFire.querySelector('.tb-ico');
      const lbl = this.btnCombatFire.querySelector('.tb-lbl');
      if (ico) ico.textContent = this.combatModeKind === 'melee' ? '⚔️' : '🔫';
      if (lbl) lbl.textContent = this.combatModeKind === 'melee' ? 'FRAPPER' : 'TIRER';
    }
    if (this.btnCombatReload) {
      this.btnCombatReload.classList.toggle('hidden', this.combatModeKind === 'melee');
    }
    if (this.btnCombatWeaponNext) {
      const lbl = this.btnCombatWeaponNext.querySelector('.tb-lbl');
      if (lbl) lbl.textContent = weaponShortName ? String(weaponShortName).slice(0, 10) : 'Arme';
    }
  }

  resetInputs() {
    this.joyPointerId = null;
    this.lookPointerId = null;
    this.player.setMoveVector(0, 0);
    if (this.joyKnob) {
      this.joyKnob.style.transform = 'translate(0px, 0px)';
    }
    this.joyBase?.classList.remove('active');
  }

  syncCameraMode(mode) {
    if (!this.btnCamera) return;
    const isThird = mode === 'third';
    this.btnCamera.innerHTML = `<span class="tb-ico">🎥</span><span class="tb-lbl">${isThird ? '3ème' : '1ère'}</span>`;
    this.btnCamera.classList.toggle('active', isThird);
  }

  syncSprintUi() {
    this.btnSprint?.classList.toggle('active', this.sprintActive);
  }

  syncVoiceUi(voiceState = {}) {
    if (!this.btnMic) return;
    const ico = this.btnMic.querySelector('.tb-ico');
    const lbl = this.btnMic.querySelector('.tb-lbl');
    const micOn = Boolean(voiceState.micEnabled);
    const transmitting = Boolean(voiceState.transmitting);
    const speaking = Boolean(voiceState.isSpeaking);
    const inTpMuted = Boolean(voiceState.inTp && voiceState.tpBehavior === 'mute');
    const err = Boolean(voiceState.errorMessage && !micOn);

    this.btnMic.classList.toggle('active', micOn && !inTpMuted);
    this.btnMic.classList.toggle('speaking', speaking);
    this.btnMic.classList.toggle('mic-error', err);

    if (err) {
      if (ico) ico.textContent = '⚠️';
      if (lbl) lbl.textContent = 'Micro bloqué';
    } else if (inTpMuted) {
      if (ico) ico.textContent = '🔇';
      if (lbl) lbl.textContent = 'Micro TP';
    } else if (speaking) {
      if (ico) ico.textContent = '🔴';
      if (lbl) lbl.textContent = 'En direct';
    } else if (voiceState.mode === 'ptt' && micOn) {
      if (ico) ico.textContent = transmitting ? '🎙️' : '🎤';
      if (lbl) lbl.textContent = transmitting ? 'PTT ON' : 'Maintenir';
    } else if (micOn) {
      if (ico) ico.textContent = '🎙️';
      if (lbl) lbl.textContent = 'Micro ON';
    } else {
      if (ico) ico.textContent = '🔇';
      if (lbl) lbl.textContent = voiceState.mode === 'ptt' ? 'Parler (PTT)' : 'Micro OFF';
    }
  }

  setInteractTarget(target) {
    this.currentTarget = target || null;
    const available = Boolean(this.currentTarget);
    const info = formatInteractAction(this.currentTarget);

    if (this.btnInteract) {
      this.btnInteract.classList.toggle('ready', available);
      this.btnInteract.disabled = !available;
      const ico = this.btnInteract.querySelector('.tb-ico');
      const lbl = this.btnInteract.querySelector('.tb-lbl');
      if (ico) ico.textContent = info.icon;
      if (lbl) lbl.textContent = info.shortLabel;
    }

    if (this.btnContextInteract) {
      this.btnContextInteract.classList.toggle('hidden', !(available && this.visible));
      const ico = this.btnContextInteract.querySelector('.tci-ico');
      const main = this.btnContextInteract.querySelector('.tci-main');
      const sub = this.btnContextInteract.querySelector('.tci-sub');
      if (ico) ico.textContent = info.icon;
      if (main) main.textContent = `${info.icon} Interagir`;
      if (sub) sub.textContent = available ? info.fullLabel : '';
    }
  }

  _updateJoystickFromClient(clientX, clientY) {
    const dx = clientX - this.joyOrigin.x;
    const dy = clientY - this.joyOrigin.y;
    const maxR = this.joyRadius || 46;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, maxR);
    const angle = dist > 0 ? Math.atan2(dy, dx) : 0;
    const kx = Math.cos(angle) * clamped;
    const ky = Math.sin(angle) * clamped;

    if (this.joyKnob) {
      this.joyKnob.style.transform = `translate(${kx}px, ${ky}px)`;
    }

    const norm = clamped / maxR;
    if (norm < 0.08) {
      this.player.setMoveVector(0, 0);
      return;
    }
    const scaled = (norm - 0.08) / 0.92;
    const nx = dist > 0 ? (dx / dist) * scaled : 0;
    const ny = dist > 0 ? (dy / dist) * scaled : 0;
    this.player.setMoveVector(nx, -ny);
  }

  _initJoyOrigin(clientX = null, clientY = null) {
    if (!this.joyBase) return;
    const rect = this.joyBase.getBoundingClientRect?.();
    if (rect && rect.width > 0) {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
        const distFromCenter = Math.hypot(clientX - cx, clientY - cy);
        if (distFromCenter <= rect.width * 0.72) {
          this.joyOrigin = { x: cx, y: cy };
        } else {
          this.joyOrigin = { x: clientX, y: clientY };
        }
      } else {
        this.joyOrigin = { x: cx, y: cy };
      }
      this.joyRadius = Math.max(34, rect.width * 0.42);
    } else if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
      this.joyOrigin = { x: clientX, y: clientY };
      this.joyRadius = 46;
    }
    this.joyBase.classList.add('active');
  }

  _bindJoystick() {
    if (!this.joyZone) return;

    const onDown = (e) => {
      if (!this.visible || !this.player.enabled) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (this.joyPointerId !== null) return;
      e.preventDefault?.();
      this.joyPointerId = e.pointerId ?? 0;
      this.joyZone.setPointerCapture?.(e.pointerId);
      this._initJoyOrigin(e.clientX, e.clientY);
      this._updateJoystickFromClient(e.clientX, e.clientY);
    };

    const onMove = (e) => {
      if (this.joyPointerId === null) return;
      if ((e.pointerId ?? 0) !== this.joyPointerId) return;
      e.preventDefault?.();
      this._updateJoystickFromClient(e.clientX, e.clientY);
    };

    const onUp = (e) => {
      if (this.joyPointerId === null) return;
      if ((e.pointerId ?? 0) !== this.joyPointerId) return;
      this.joyZone.releasePointerCapture?.(e.pointerId);
      this.joyPointerId = null;
      this.player.setMoveVector(0, 0);
      if (this.joyKnob) this.joyKnob.style.transform = 'translate(0px, 0px)';
      this.joyBase?.classList.remove('active');
    };

    this.joyZone.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    this._cleanups.push(() => {
      this.joyZone.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    });
  }

  _isUiOverlayTouch(clientX, clientY, target) {
    if (
      target &&
      typeof target.closest === 'function' &&
      target.closest(
        '.hud-top, .hud-brand, .hud-actions, button, a, input, select, textarea, .quest-panel, .chat-drawer, .modal-backdrop, .dialogue-overlay, .touch-context-interact'
      )
    ) {
      return true;
    }
    const boxes = [this.hudActionsEl, this.hudTopEl];
    for (const el of boxes) {
      if (!el || typeof el.getBoundingClientRect !== 'function') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (clientX >= r.left - 6 && clientX <= r.right + 6 && clientY >= r.top - 6 && clientY <= r.bottom + 6) {
        return true;
      }
    }
    return false;
  }

  _bindLookZone() {
    if (!this.lookZone) return;

    const onDown = (e) => {
      if (!this.visible || !this.player.enabled) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (this._isUiOverlayTouch(e.clientX, e.clientY, e.target)) return;
      if (this.lookPointerId !== null) return;
      e.preventDefault?.();
      this.lookPointerId = e.pointerId ?? 0;
      this.lookZone.setPointerCapture?.(e.pointerId);
      this.lookLast = { x: e.clientX, y: e.clientY };
      this.lookStart = { x: e.clientX, y: e.clientY };
      this.lookMoved = 0;
    };

    const onMove = (e) => {
      if (this.lookPointerId === null) return;
      if ((e.pointerId ?? 0) !== this.lookPointerId) return;
      e.preventDefault?.();
      const dx = e.clientX - this.lookLast.x;
      const dy = e.clientY - this.lookLast.y;
      this.lookLast = { x: e.clientX, y: e.clientY };
      this.lookMoved += Math.hypot(dx, dy);
      this.player.lookDelta(dx, dy);
    };

    const onUp = (e) => {
      if (this.lookPointerId === null) return;
      if ((e.pointerId ?? 0) !== this.lookPointerId) return;
      this.lookZone.releasePointerCapture?.(e.pointerId);
      if (this.lookMoved < 12) {
        this.handlers.onTapLookZone?.(e.clientX, e.clientY);
      }
      this.lookPointerId = null;
    };

    this.lookZone.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    this._cleanups.push(() => {
      this.lookZone.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    });
  }

  _bindPressAction(btn, action) {
    if (!btn) return;
    let handledPointer = false;

    const onDown = (e) => {
      if (!this.visible) return;
      if (btn.disabled) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault?.();
      e.stopPropagation?.();
      handledPointer = true;
      btn.classList.add('pressed');
      action();
    };

    const clearPress = () => btn.classList.remove('pressed');

    const onClick = (e) => {
      if (handledPointer) {
        handledPointer = false;
        return;
      }
      if (btn.disabled) return;
      e.stopPropagation?.();
      action();
    };

    btn.addEventListener('pointerdown', onDown);
    btn.addEventListener('pointerup', clearPress);
    btn.addEventListener('pointercancel', clearPress);
    btn.addEventListener('pointerleave', clearPress);
    btn.addEventListener('click', onClick);

    this._cleanups.push(() => {
      btn.removeEventListener('pointerdown', onDown);
      btn.removeEventListener('pointerup', clearPress);
      btn.removeEventListener('pointercancel', clearPress);
      btn.removeEventListener('pointerleave', clearPress);
      btn.removeEventListener('click', onClick);
    });
  }

  _bindActionButtons() {
    this._bindPressAction(this.btnJump, () => {
      this.player.triggerJump();
    });

    this._bindPressAction(this.btnInteract, () => {
      this.handlers.onInteract?.();
    });

    this._bindPressAction(this.btnContextInteract, () => {
      this.handlers.onInteract?.();
    });

    this._bindPressAction(this.btnSprint, () => {
      this.sprintActive = !this.sprintActive;
      this.player.setSprint(this.sprintActive);
      this.syncSprintUi();
    });

    this._bindPressAction(this.btnCamera, () => {
      this.handlers.onToggleCamera?.();
    });

    this._bindPressAction(this.btnCombatReload, () => {
      this.handlers.onCombatReload?.();
    });

    this._bindPressAction(this.btnCombatWeaponNext, () => {
      this.handlers.onCombatCycleWeapon?.();
    });

    if (this.btnCombatFire) {
      const onDown = (e) => {
        if (!this.visible || !this.combatModeActive) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault?.();
        e.stopPropagation?.();
        this.btnCombatFire.classList.add('pressed');
        this.handlers.onCombatFireStart?.();
      };
      const onUp = () => {
        this.btnCombatFire.classList.remove('pressed');
        this.handlers.onCombatFireEnd?.();
      };
      this.btnCombatFire.addEventListener('pointerdown', onDown);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      this._cleanups.push(() => {
        this.btnCombatFire.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      });
    }

    if (this.btnMic) {
      let handledPointer = false;
      const onDown = (e) => {
        if (!this.visible) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault?.();
        e.stopPropagation?.();
        handledPointer = true;
        this.btnMic.classList.add('pressed');
        if (this.handlers.getVoiceMode?.() === 'ptt') {
          this.handlers.onVoicePttStart?.();
        } else {
          this.handlers.onVoiceToggle?.();
        }
      };

      const endMic = () => {
        this.btnMic.classList.remove('pressed');
        if (this.handlers.getVoiceMode?.() === 'ptt') {
          this.handlers.onVoicePttEnd?.();
        }
      };

      const onClick = (e) => {
        if (handledPointer) {
          handledPointer = false;
          return;
        }
        e.stopPropagation?.();
        this.handlers.onVoiceToggle?.();
      };

      this.btnMic.addEventListener('pointerdown', onDown);
      this.btnMic.addEventListener('pointerup', endMic);
      this.btnMic.addEventListener('pointercancel', endMic);
      this.btnMic.addEventListener('click', onClick);

      this._cleanups.push(() => {
        this.btnMic.removeEventListener('pointerdown', onDown);
        this.btnMic.removeEventListener('pointerup', endMic);
        this.btnMic.removeEventListener('pointercancel', endMic);
        this.btnMic.removeEventListener('click', onClick);
      });
    }
  }

  destroy() {
    this.resetInputs();
    while (this._cleanups.length > 0) {
      const fn = this._cleanups.pop();
      try {
        fn();
      } catch {}
    }
  }
}
