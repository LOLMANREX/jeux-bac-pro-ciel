export function createTapConnectController({ onSelect, onConnect, onCancel } = {}) {
  let selectedSourceId = null;
  let draggingSourceId = null;

  return {
    tap(id, meta = null) {
      if (id === null || id === undefined) return { action: 'none', source: selectedSourceId };
      if (selectedSourceId === null) {
        selectedSourceId = id;
        onSelect?.(id, meta);
        return { action: 'select', source: id };
      }
      if (selectedSourceId === id) {
        selectedSourceId = null;
        onCancel?.(id, meta);
        return { action: 'cancel', source: null };
      }
      const src = selectedSourceId;
      selectedSourceId = null;
      onConnect?.(src, id, meta);
      return { action: 'connect', source: src, target: id };
    },
    startDrag(sourceId, meta = null) {
      draggingSourceId = sourceId;
      selectedSourceId = sourceId;
      onSelect?.(sourceId, meta);
    },
    dropOn(targetId, meta = null) {
      const src = draggingSourceId;
      draggingSourceId = null;
      if (src !== null && src !== undefined && targetId !== null && targetId !== undefined && src !== targetId) {
        selectedSourceId = null;
        onConnect?.(src, targetId, meta);
        return { action: 'connect', source: src, target: targetId };
      }
      selectedSourceId = null;
      return { action: 'cancel', source: null };
    },
    cancel() {
      const prev = selectedSourceId;
      selectedSourceId = null;
      draggingSourceId = null;
      if (prev !== null) onCancel?.(prev, null);
    },
    getSelected() {
      return selectedSourceId;
    }
  };
}

export function adjustRangeInput(inputEl, direction, customStep = null) {
  if (!inputEl) return NaN;
  const dir = direction >= 0 ? 1 : -1;
  const rawStep =
    customStep !== null && customStep !== undefined
      ? Number(customStep)
      : Number(inputEl.dataset?.fineStep || inputEl.step || 1);
  const step = Number.isFinite(rawStep) && rawStep > 0 ? rawStep : 1;
  const min = inputEl.min !== undefined && inputEl.min !== '' ? Number(inputEl.min) : -Infinity;
  const max = inputEl.max !== undefined && inputEl.max !== '' ? Number(inputEl.max) : Infinity;
  const cur = Number(inputEl.value);
  const base = Number.isFinite(cur) ? cur : Number.isFinite(min) ? min : 0;
  const stepStr = String(step);
  const decimals = stepStr.includes('.') ? stepStr.split('.')[1].length : 0;
  const factor = Math.pow(10, decimals);
  let next = Math.round((base + dir * step) * factor) / factor;
  if (Number.isFinite(min)) next = Math.max(min, next);
  if (Number.isFinite(max)) next = Math.min(max, next);
  inputEl.value = String(next);
  if (typeof Event !== 'undefined' && typeof inputEl.dispatchEvent === 'function') {
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
  }
  return next;
}

export function enhanceRangeInputsWithSteppers(rootEl, { onStep } = {}) {
  if (!rootEl || typeof rootEl.querySelectorAll !== 'function' || typeof document === 'undefined') {
    return () => {};
  }
  const activeIntervals = new Set();
  const activeTimeouts = new Set();
  const cleanups = [];

  const inputs = Array.from(rootEl.querySelectorAll('input[type="range"]'));
  for (const inp of inputs) {
    if (inp.dataset?.stepperBound === '1' || inp.dataset?.noStepper === '1') continue;
    if (inp.dataset) inp.dataset.stepperBound = '1';

    const wrap = document.createElement('div');
    wrap.className = 'tp-stepper-wrap';
    const parent = inp.parentNode;
    if (!parent) continue;
    parent.insertBefore(wrap, inp);

    const makeStepBtn = (dir, text, ariaLabel) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `tp3d-step-btn ${dir < 0 ? 'minus' : 'plus'}`;
      btn.textContent = text;
      btn.setAttribute('aria-label', ariaLabel);
      btn.dataset.stepperBtn = '1';
      btn.dataset.stepDir = String(dir);

      let holdTimeout = null;
      let holdInterval = null;
      let activePid = null;
      let handledPointer = false;

      const stopHold = () => {
        if (holdTimeout !== null) {
          clearTimeout(holdTimeout);
          activeTimeouts.delete(holdTimeout);
          holdTimeout = null;
        }
        if (holdInterval !== null) {
          clearInterval(holdInterval);
          activeIntervals.delete(holdInterval);
          holdInterval = null;
        }
        activePid = null;
        btn.classList.remove('pressed');
      };

      const stepOnce = () => {
        const val = adjustRangeInput(inp, dir);
        onStep?.(val, inp, dir);
      };

      const onDown = (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault?.();
        e.stopPropagation?.();
        handledPointer = true;
        stopHold();
        activePid = e.pointerId ?? 0;
        btn.classList.add('pressed');
        stepOnce();
        holdTimeout = setTimeout(() => {
          holdTimeout = null;
          holdInterval = setInterval(() => {
            stepOnce();
          }, 90);
          activeIntervals.add(holdInterval);
        }, 360);
        activeTimeouts.add(holdTimeout);
      };

      const onEnd = (e) => {
        if (activePid !== null && e.pointerId !== undefined && e.pointerId !== activePid) return;
        stopHold();
      };

      const onClick = (e) => {
        if (handledPointer) {
          handledPointer = false;
          return;
        }
        e.preventDefault?.();
        e.stopPropagation?.();
        stepOnce();
      };

      btn.addEventListener('pointerdown', onDown);
      btn.addEventListener('pointerup', onEnd);
      btn.addEventListener('pointercancel', onEnd);
      btn.addEventListener('pointerleave', onEnd);
      btn.addEventListener('click', onClick);
      cleanups.push(() => {
        stopHold();
        btn.removeEventListener('pointerdown', onDown);
        btn.removeEventListener('pointerup', onEnd);
        btn.removeEventListener('pointercancel', onEnd);
        btn.removeEventListener('pointerleave', onEnd);
        btn.removeEventListener('click', onClick);
      });
      return btn;
    };

    const minusBtn = makeStepBtn(-1, '−', 'Diminuer le réglage');
    const plusBtn = makeStepBtn(1, '+', 'Augmenter le réglage');
    wrap.appendChild(minusBtn);
    wrap.appendChild(inp);
    wrap.appendChild(plusBtn);
  }

  return () => {
    for (const t of activeTimeouts) clearTimeout(t);
    activeTimeouts.clear();
    for (const iv of activeIntervals) clearInterval(iv);
    activeIntervals.clear();
    while (cleanups.length > 0) {
      const fn = cleanups.pop();
      try {
        fn();
      } catch {}
    }
  };
}

export function createVirtualKeypad({
  mode = 'ip-cli',
  targetInput = null,
  presets = null,
  onSubmit = null,
  onChange = null
} = {}) {
  const el = document.createElement('div');
  el.className = 'tp-virtual-keypad';
  el.dataset.keypadMode = mode;

  let systemKeyboardEnabled = false;
  const applyInputGuard = () => {
    if (!targetInput) return;
    const isTouch = typeof document !== 'undefined' && document.body?.classList?.contains('touch-active');
    if (isTouch && !systemKeyboardEnabled) {
      targetInput.setAttribute?.('inputmode', 'none');
      targetInput.inputMode = 'none';
      targetInput.readOnly = true;
    } else {
      targetInput.removeAttribute?.('inputmode');
      targetInput.inputMode = 'text';
      targetInput.readOnly = false;
    }
  };
  applyInputGuard();

  const notifyChange = () => {
    if (!targetInput) return;
    if (typeof Event !== 'undefined' && typeof targetInput.dispatchEvent === 'function') {
      targetInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    onChange?.(targetInput.value);
  };

  const appendToken = (tok) => {
    if (!targetInput) return '';
    targetInput.value = `${targetInput.value || ''}${tok}`;
    notifyChange();
    return targetInput.value;
  };

  const backspace = () => {
    if (!targetInput) return '';
    const v = String(targetInput.value || '');
    targetInput.value = v.slice(0, Math.max(0, v.length - 1));
    notifyChange();
    return targetInput.value;
  };

  const clear = () => {
    if (!targetInput) return '';
    targetInput.value = '';
    notifyChange();
    return '';
  };

  const submit = () => {
    const val = String(targetInput?.value || '');
    if (onSubmit) {
      onSubmit(val);
    } else if (targetInput?.closest) {
      const form = targetInput.closest('form');
      if (form && typeof Event !== 'undefined') {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    }
    return val;
  };

  const defaultIpCliPresets = [
    'vlan ',
    'access gi0/',
    'trunk gi0/24',
    'gw ',
    '192.168.',
    '.254',
    'ping',
    'traceroute',
    'show',
    'help'
  ];

  const activePresets = Array.isArray(presets) && presets.length > 0
    ? presets
    : mode === 'ip-cli'
      ? defaultIpCliPresets
      : [];

  if (activePresets.length > 0) {
    const presetRow = document.createElement('div');
    presetRow.className = 'tp-keypad-presets';
    for (const p of activePresets) {
      const item = typeof p === 'string' ? { label: p.trim() || p, token: p, autoSubmit: false } : p;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tp-keypad-btn preset';
      btn.dataset.keypadBtn = '1';
      btn.textContent = item.label;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (item.replace) {
          clear();
        }
        appendToken(item.token ?? item.label);
        if (item.autoSubmit) {
          submit();
        }
      });
      presetRow.appendChild(btn);
    }
    el.appendChild(presetRow);
  }

  let keys = [];
  if (mode === 'binary') {
    keys = ['0', '1', ' ', '⌫', 'Effacer', '↵ OK'];
  } else if (mode === 'hex') {
    keys = [
      '0', '1', '2', '3',
      '4', '5', '6', '7',
      '8', '9', 'A', 'B',
      'C', 'D', 'E', 'F',
      ':', '⌫', 'Effacer', '↵ OK'
    ];
  } else if (mode === 'numeric') {
    keys = [
      '1', '2', '3', '4',
      '5', '6', '7', '8',
      '9', '0', '.', '⌫',
      'Effacer', '↵ OK'
    ];
  } else {
    keys = [
      '1', '2', '3', '.',
      '4', '5', '6', '/',
      '7', '8', '9', '0',
      ' ', '⌫', 'Effacer', '↵ Valider'
    ];
  }

  const grid = document.createElement('div');
  grid.className = `tp-keypad-grid mode-${mode}`;
  for (const k of keys) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.keypadBtn = '1';
    const isAction = k === '⌫' || k === 'Effacer' || k.startsWith('↵');
    btn.className = `tp-keypad-btn ${k.startsWith('↵') ? 'submit' : isAction ? 'action' : ''}`;
    btn.textContent = k === ' ' ? 'Espace' : k;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (k === '⌫') backspace();
      else if (k === 'Effacer') clear();
      else if (k.startsWith('↵')) submit();
      else appendToken(k);
    });
    grid.appendChild(btn);
  }
  el.appendChild(grid);

  if (targetInput && mode === 'ip-cli') {
    const footer = document.createElement('div');
    footer.className = 'tp-keypad-footer';
    const kbBtn = document.createElement('button');
    kbBtn.type = 'button';
    kbBtn.className = 'tp-keypad-btn os-kb-toggle';
    kbBtn.dataset.keypadBtn = '1';
    const syncKbLabel = () => {
      kbBtn.textContent = systemKeyboardEnabled ? '⌨️ Masquer clavier OS' : '⌨️ Clavier OS';
    };
    syncKbLabel();
    kbBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      systemKeyboardEnabled = !systemKeyboardEnabled;
      applyInputGuard();
      syncKbLabel();
      if (systemKeyboardEnabled) {
        targetInput.focus?.();
      }
    });
    footer.appendChild(kbBtn);
    el.appendChild(footer);
  }

  return {
    element: el,
    appendToken,
    backspace,
    clear,
    submit,
    setSystemKeyboard(enabled) {
      systemKeyboardEnabled = Boolean(enabled);
      applyInputGuard();
    },
    destroy() {
      el.remove();
    }
  };
}

export function createInspectZoomOverlay(rootEl, { title = 'Vue Agrandie', subtitle = '', canvas = null, draw = null, onClose = null } = {}) {
  if (!rootEl || typeof document === 'undefined') {
    return { element: null, close() {} };
  }
  const existing = rootEl.querySelector?.('.tp3d-zoom-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'tp3d-zoom-overlay';
  overlay.innerHTML = `
    <div class="tp3d-zoom-card">
      <div class="tp3d-zoom-head">
        <div>
          <strong class="tp3d-zoom-title"></strong>
          <div class="tp3d-zoom-sub"></div>
        </div>
        <button type="button" class="tp3d-zoom-close">✕ Fermer le zoom</button>
      </div>
      <div class="tp3d-zoom-body">
        <canvas class="tp3d-zoom-canvas" width="960" height="580"></canvas>
      </div>
    </div>
  `;

  const titleEl = overlay.querySelector('.tp3d-zoom-title');
  const subEl = overlay.querySelector('.tp3d-zoom-sub');
  const closeBtn = overlay.querySelector('.tp3d-zoom-close');
  const zoomCanvas = overlay.querySelector('.tp3d-zoom-canvas');
  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = subtitle;

  const ctx = zoomCanvas?.getContext?.('2d') || null;
  let rafId = null;
  let closed = false;

  const renderFrame = () => {
    if (closed) return;
    if (ctx && zoomCanvas) {
      if (typeof draw === 'function') {
        draw(ctx, zoomCanvas.width, zoomCanvas.height);
      } else if (canvas && canvas.width > 0 && canvas.height > 0) {
        if (zoomCanvas.width !== canvas.width * 2 || zoomCanvas.height !== canvas.height * 2) {
          zoomCanvas.width = Math.min(1280, Math.max(640, canvas.width * 2));
          zoomCanvas.height = Math.min(840, Math.max(400, canvas.height * 2));
        }
        ctx.clearRect(0, 0, zoomCanvas.width, zoomCanvas.height);
        ctx.drawImage(canvas, 0, 0, zoomCanvas.width, zoomCanvas.height);
      }
    }
    if (typeof requestAnimationFrame === 'function') {
      rafId = requestAnimationFrame(renderFrame);
    }
  };

  const close = () => {
    if (closed) return;
    closed = true;
    if (rafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    overlay.remove();
    onClose?.();
  };

  closeBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    close();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  rootEl.appendChild(overlay);
  renderFrame();

  return { element: overlay, close };
}

export function getCielOsTouchLayout(activeAppId = null) {
  switch (activeAppId) {
    case 'snake':
      return {
        showDpad: true,
        dpadRepeat: false,
        hint: 'Utilisez le pavé tactile pour diriger le serpent',
        actions: [
          { id: 'turbo', label: '⚡ Turbo', code: 'Space', primary: true },
          { id: 'reset', label: '🔄 Rejouer', code: 'KeyR' }
        ]
      };
    case 'minesweeper':
      return {
        showDpad: false,
        dpadRepeat: false,
        hint: 'Touchez une case pour révéler ou activez le mode Drapeau',
        actions: [
          { id: 'flag', label: '🚩 Drapeau (F)', code: 'KeyF', toggle: true, primary: true },
          { id: 'reset', label: '🔄 Nouvelle grille', code: 'KeyR' }
        ]
      };
    case 'tetris':
      return {
        showDpad: true,
        dpadRepeat: true,
        hint: 'Gauche/Droite/Bas sur le pavé • Pivoter ou Chute directe',
        actions: [
          { id: 'rotate', label: '🔄 Pivoter', code: 'ArrowUp', primary: true },
          { id: 'drop', label: '⏬ Chute', code: 'Space' },
          { id: 'reset', label: '🔄 Rejouer', code: 'KeyR' }
        ]
      };
    case 'breakout':
      return {
        showDpad: true,
        dpadRepeat: true,
        hint: 'Glissez sur l’écran ou utilisez ◀ / ▶ pour déplacer la raquette',
        actions: [
          { id: 'launch', label: '🚀 Lancer Balle', code: 'Space', primary: true },
          { id: 'reset', label: '🔄 Rejouer', code: 'KeyR' }
        ]
      };
    case 'flappy':
      return {
        showDpad: false,
        dpadRepeat: false,
        hint: 'Touchez l’écran ou le bouton Impulsion pour passer les pare-feux',
        actions: [
          { id: 'flap', label: '⬆️ Impulsion IP', code: 'Space', primary: true },
          { id: 'reset', label: '🔄 Rejouer', code: 'KeyR' }
        ]
      };
    case 'game2048':
      return {
        showDpad: true,
        dpadRepeat: false,
        hint: 'Glissez sur la grille ou utilisez le pavé directionnel',
        actions: [
          { id: 'reset', label: '🔄 Rejouer', code: 'KeyR', primary: true }
        ]
      };
    case 'terminal':
      return {
        showDpad: false,
        dpadRepeat: false,
        hint: 'Commandes tactiles rapides CIEL OS Terminal',
        actions: [
          { id: 'cmd_help', label: 'help', terminalCmd: 'help' },
          { id: 'cmd_ping', label: 'ping', terminalCmd: 'ping 192.168.10.254' },
          { id: 'cmd_whoami', label: 'whoami', terminalCmd: 'whoami' },
          { id: 'cmd_matrix', label: 'matrix', terminalCmd: 'matrix', primary: true },
          { id: 'cmd_hack', label: 'hack', terminalCmd: 'hack' },
          { id: 'cmd_cowsay', label: 'cowsay', terminalCmd: 'cowsay CIEL 3D' },
          { id: 'cmd_clear', label: 'clear', terminalCmd: 'clear' }
        ]
      };
    case 'notepad':
      return {
        showDpad: false,
        dpadRepeat: false,
        hint: 'Touchez le bouton Retour ou les notes rapides dans la fenêtre',
        actions: [
          { id: 'backspace', label: '⌫ Effacer', code: 'Backspace' },
          { id: 'enter', label: '↵ Ligne', code: 'Enter' }
        ]
      };
    default:
      return {
        showDpad: false,
        dpadRepeat: false,
        hint: 'Touchez directement les icônes CIEL OS à l’écran',
        actions: []
      };
  }
}
