export class TouchControls {
  constructor(player, handlers = {}) {
    this.player = player;
    this.handlers = handlers;

    this.rootEl = document.getElementById('touch-controls');
    this.joyZone = document.getElementById('touch-joystick-zone');
    this.joyBase = document.getElementById('touch-joystick-base');
    this.joyKnob = document.getElementById('touch-joystick-knob');
    this.lookZone = document.getElementById('touch-look-zone');

    this.btnInteract = document.getElementById('touch-btn-interact');
    this.btnJump = document.getElementById('touch-btn-jump');
    this.btnSprint = document.getElementById('touch-btn-sprint');
    this.btnCamera = document.getElementById('touch-btn-camera');

    this.visible = false;
    this.joyTouchId = null;
    this.joyMouseActive = false;
    this.joyOrigin = { x: 0, y: 0 };
    this.joyRadius = 46;

    this.lookTouchId = null;
    this.lookLast = { x: 0, y: 0 };
    this.lookStart = { x: 0, y: 0 };
    this.lookMoved = 0;

    this.sprintActive = false;

    this._bindJoystick();
    this._bindLookZone();
    this._bindActionButtons();
    window.addEventListener('blur', () => this.resetInputs());
  }

  setVisible(show) {
    this.visible = Boolean(show);
    if (this.rootEl) {
      this.rootEl.classList.toggle('hidden', !this.visible);
    }
    if (!this.visible) {
      this.resetInputs();
    }
  }

  resetInputs() {
    this.joyTouchId = null;
    this.joyMouseActive = false;
    this.lookTouchId = null;
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

  setInteractTarget(target) {
    if (!this.btnInteract) return;
    const available = Boolean(target);
    this.btnInteract.classList.toggle('ready', available);
    this.btnInteract.disabled = !available;
    const lbl = this.btnInteract.querySelector('.tb-lbl');
    if (lbl) {
      if (!target) lbl.textContent = 'Interagir';
      else if (target.id === 'fortin') lbl.textContent = 'Parler';
      else lbl.textContent = 'Lancer TP';
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

  _initJoyOrigin() {
    if (!this.joyBase) return;
    const rect = this.joyBase.getBoundingClientRect();
    this.joyOrigin = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
    this.joyRadius = Math.max(32, rect.width * 0.42);
    this.joyBase.classList.add('active');
  }

  _bindJoystick() {
    if (!this.joyZone) return;

    this.joyZone.addEventListener(
      'touchstart',
      (e) => {
        if (!this.visible || !this.player.enabled) return;
        e.preventDefault();
        if (this.joyTouchId !== null) return;
        const touch = e.changedTouches[0];
        if (!touch) return;
        this.joyTouchId = touch.identifier;
        this._initJoyOrigin();
        this._updateJoystickFromClient(touch.clientX, touch.clientY);
      },
      { passive: false }
    );

    window.addEventListener(
      'touchmove',
      (e) => {
        if (this.joyTouchId === null) return;
        for (const t of e.changedTouches) {
          if (t.identifier === this.joyTouchId) {
            e.preventDefault();
            this._updateJoystickFromClient(t.clientX, t.clientY);
            break;
          }
        }
      },
      { passive: false }
    );

    const endTouchJoy = (e) => {
      if (this.joyTouchId === null) return;
      for (const t of e.changedTouches) {
        if (t.identifier === this.joyTouchId) {
          this.joyTouchId = null;
          this.player.setMoveVector(0, 0);
          if (this.joyKnob) this.joyKnob.style.transform = 'translate(0px, 0px)';
          this.joyBase?.classList.remove('active');
          break;
        }
      }
    };

    window.addEventListener('touchend', endTouchJoy);
    window.addEventListener('touchcancel', endTouchJoy);

    this.joyZone.addEventListener('mousedown', (e) => {
      if (!this.visible || !this.player.enabled || e.button !== 0) return;
      e.preventDefault();
      this.joyMouseActive = true;
      this._initJoyOrigin();
      this._updateJoystickFromClient(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.joyMouseActive) return;
      this._updateJoystickFromClient(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
      if (!this.joyMouseActive) return;
      this.joyMouseActive = false;
      this.player.setMoveVector(0, 0);
      if (this.joyKnob) this.joyKnob.style.transform = 'translate(0px, 0px)';
      this.joyBase?.classList.remove('active');
    });
  }

  _bindLookZone() {
    if (!this.lookZone) return;

    this.lookZone.addEventListener(
      'touchstart',
      (e) => {
        if (!this.visible || !this.player.enabled) return;
        e.preventDefault();
        if (this.lookTouchId !== null) return;
        const t = e.changedTouches[0];
        if (!t) return;
        this.lookTouchId = t.identifier;
        this.lookLast = { x: t.clientX, y: t.clientY };
        this.lookStart = { x: t.clientX, y: t.clientY };
        this.lookMoved = 0;
      },
      { passive: false }
    );

    window.addEventListener(
      'touchmove',
      (e) => {
        if (this.lookTouchId === null) return;
        for (const t of e.changedTouches) {
          if (t.identifier === this.lookTouchId) {
            e.preventDefault();
            const dx = t.clientX - this.lookLast.x;
            const dy = t.clientY - this.lookLast.y;
            this.lookLast = { x: t.clientX, y: t.clientY };
            this.lookMoved += Math.hypot(dx, dy);
            this.player.lookDelta(dx, dy);
            break;
          }
        }
      },
      { passive: false }
    );

    const endLook = (e) => {
      if (this.lookTouchId === null) return;
      for (const t of e.changedTouches) {
        if (t.identifier === this.lookTouchId) {
          if (this.lookMoved < 10) {
            this.handlers.onTapLookZone?.(t.clientX, t.clientY);
          }
          this.lookTouchId = null;
          break;
        }
      }
    };

    window.addEventListener('touchend', endLook);
    window.addEventListener('touchcancel', endLook);
  }

  _bindPressAction(btn, action) {
    if (!btn) return;
    let handledTouch = false;

    btn.addEventListener(
      'touchstart',
      (e) => {
        if (!this.visible) return;
        e.preventDefault();
        e.stopPropagation();
        handledTouch = true;
        btn.classList.add('pressed');
        action();
      },
      { passive: false }
    );

    const clearPress = () => btn.classList.remove('pressed');
    btn.addEventListener('touchend', clearPress);
    btn.addEventListener('touchcancel', clearPress);

    btn.addEventListener('click', (e) => {
      if (handledTouch) {
        handledTouch = false;
        return;
      }
      e.stopPropagation();
      action();
    });
  }

  _bindActionButtons() {
    this._bindPressAction(this.btnJump, () => {
      this.player.triggerJump();
    });

    this._bindPressAction(this.btnInteract, () => {
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
  }
}
