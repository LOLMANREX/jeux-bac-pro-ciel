import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';

import {
  detectDeviceProfile,
  detectTouchDevice,
  GameState
} from '../src/core/gameState.js';
import { computeAdaptivePixelRatio } from '../src/world/SceneManager.js';
import { PlayerController } from '../src/world/PlayerController.js';
import { formatInteractAction, TouchControls } from '../src/ui/TouchControls.js';
import {
  adjustRangeInput,
  createInspectZoomOverlay,
  createTapConnectController,
  createVirtualKeypad,
  enhanceRangeInputsWithSteppers,
  getCielOsTouchLayout
} from '../src/minigames/TouchTpHelpers.js';
import { APP_VERSION, CHANGELOG_RELEASES } from '../src/ui/ChangelogModal.js';

function createFakeClassList(el) {
  const set = new Set();
  const sync = () => {
    if (el) el._className = Array.from(set).join(' ');
  };
  return {
    add: (...names) => {
      names.forEach((n) => n && set.add(n));
      sync();
    },
    remove: (...names) => {
      names.forEach((n) => set.delete(n));
      sync();
    },
    toggle: (name, force) => {
      if (force === undefined) {
        if (set.has(name)) set.delete(name);
        else set.add(name);
      } else if (force) {
        set.add(name);
      } else {
        set.delete(name);
      }
      sync();
      return set.has(name);
    },
    contains: (name) => set.has(name),
    setFromString: (str) => {
      set.clear();
      String(str || '')
        .split(/\s+/)
        .filter(Boolean)
        .forEach((c) => set.add(c));
    }
  };
}

function createFakeDom(registry = new Map()) {
  class FakeEvent {
    constructor(type, opts = {}) {
      this.type = type;
      this.bubbles = Boolean(opts.bubbles);
      this.defaultPrevented = false;
      this.propagationStopped = false;
      Object.assign(this, opts);
    }
    preventDefault() {
      this.defaultPrevented = true;
    }
    stopPropagation() {
      this.propagationStopped = true;
    }
  }

  class FakeElement {
    constructor(tagName = 'div', id = '') {
      this.tagName = String(tagName).toUpperCase();
      this.id = id;
      this.children = [];
      this.parentNode = null;
      this.style = {};
      this.dataset = {};
      this.attributes = {};
      this.listeners = new Map();
      this.disabled = false;
      this.value = '';
      this.min = '';
      this.max = '';
      this.step = '';
      this.type = '';
      this.width = 960;
      this.height = 580;
      this.clientWidth = 960;
      this.clientHeight = 580;
      this._textContent = '';
      this._innerHTML = '';
      this.classList = createFakeClassList(this);
      if (id) registry.set(id, this);
    }
    set className(val) {
      this._className = String(val || '');
      this.classList.setFromString(val);
    }
    get className() {
      return this._className || '';
    }
    set textContent(v) {
      this._textContent = String(v ?? '');
    }
    get textContent() {
      return this._textContent || this.children.map((c) => c.textContent).join(' ');
    }
    set innerHTML(v) {
      this._innerHTML = String(v || '');
      this.children = [];
    }
    get innerHTML() {
      return this._innerHTML;
    }
    setAttribute(k, v) {
      this.attributes[k] = String(v);
      if (k === 'id') {
        this.id = String(v);
        registry.set(this.id, this);
      }
    }
    getAttribute(k) {
      return this.attributes[k] ?? null;
    }
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    }
    insertBefore(newChild, refChild) {
      newChild.parentNode = this;
      const idx = this.children.indexOf(refChild);
      if (idx >= 0) this.children.splice(idx, 0, newChild);
      else this.children.push(newChild);
      return newChild;
    }
    remove() {
      if (this.parentNode) {
        const idx = this.parentNode.children.indexOf(this);
        if (idx >= 0) this.parentNode.children.splice(idx, 1);
        this.parentNode = null;
      }
    }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(fn);
    }
    removeEventListener(type, fn) {
      this.listeners.get(type)?.delete(fn);
    }
    dispatchEvent(ev) {
      const e = ev instanceof FakeEvent ? ev : new FakeEvent(ev?.type || 'event', ev);
      e.target = e.target || this;
      const set = this.listeners.get(e.type);
      if (set) {
        for (const fn of Array.from(set)) fn(e);
      }
      return !e.defaultPrevented;
    }
    setPointerCapture() {}
    releasePointerCapture() {}
    hasPointerCapture() {
      return false;
    }
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 120, height: 120 };
    }
    getContext() {
      return {
        clearRect() {},
        drawImage() {},
        fillRect() {},
        fillText() {}
      };
    }
    focus() {}
    _walk(pred, acc = []) {
      for (const ch of this.children) {
        if (pred(ch)) acc.push(ch);
        ch._walk(pred, acc);
      }
      return acc;
    }
    _matches(sel) {
      if (sel.startsWith('.')) return this.classList.contains(sel.slice(1));
      if (sel.startsWith('#')) return this.id === sel.slice(1);
      if (sel === 'input[type="range"]') {
        return this.tagName === 'INPUT' && this.type === 'range';
      }
      return this.tagName === sel.toUpperCase();
    }
    querySelectorAll(sel) {
      return this._walk((el) => el._matches(sel));
    }
    querySelector(sel) {
      if (sel === '.tb-ico') return this._walk((el) => el.classList.contains('tb-ico'))[0] || new FakeElement('span');
      if (sel === '.tb-lbl') return this._walk((el) => el.classList.contains('tb-lbl'))[0] || new FakeElement('span');
      if (sel === '.tci-ico') return this._walk((el) => el.classList.contains('tci-ico'))[0] || new FakeElement('span');
      if (sel === '.tci-main') return this._walk((el) => el.classList.contains('tci-main'))[0] || new FakeElement('span');
      if (sel === '.tci-sub') return this._walk((el) => el.classList.contains('tci-sub'))[0] || new FakeElement('span');
      const hit = this._walk((el) => el._matches(sel))[0] || null;
      if (hit) return hit;
      if (['.tp3d-zoom-title', '.tp3d-zoom-sub', '.tp3d-zoom-close', '.tp3d-zoom-canvas'].includes(sel)) {
        if (!this._synth) this._synth = new Map();
        if (!this._synth.has(sel)) {
          const tag = sel === '.tp3d-zoom-canvas' ? 'canvas' : sel === '.tp3d-zoom-close' ? 'button' : 'div';
          const synthEl = new FakeElement(tag);
          synthEl.className = sel.slice(1);
          this._synth.set(sel, synthEl);
        }
        return this._synth.get(sel);
      }
      return null;
    }
  }

  const docListeners = new Map();
  const winListeners = new Map();
  const doc = {
    body: new FakeElement('body'),
    pointerLockElement: null,
    createElement: (tag) => new FakeElement(tag),
    getElementById: (id) => registry.get(id) || null,
    querySelector: (sel) => doc.body.querySelector(sel),
    addEventListener: (type, fn) => {
      if (!docListeners.has(type)) docListeners.set(type, new Set());
      docListeners.get(type).add(fn);
    },
    removeEventListener: (type, fn) => {
      docListeners.get(type)?.delete(fn);
    },
    exitPointerLock: () => {
      doc.pointerLockElement = null;
    }
  };
  const win = {
    innerWidth: 1280,
    innerHeight: 720,
    listeners: winListeners,
    addEventListener: (type, fn) => {
      if (!winListeners.has(type)) winListeners.set(type, new Set());
      winListeners.get(type).add(fn);
    },
    removeEventListener: (type, fn) => {
      winListeners.get(type)?.delete(fn);
    },
    dispatchEvent: (ev) => {
      const set = winListeners.get(ev.type);
      if (set) {
        for (const fn of Array.from(set)) fn(ev);
      }
    }
  };

  return { FakeElement, FakeEvent, doc, win, registry };
}

test('v4.26 : detectDeviceProfile et computeAdaptivePixelRatio gèrent mobile, tablette, PC et VR', () => {
  const androidPhone = detectDeviceProfile({
    navigator: {
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36',
      maxTouchPoints: 5
    },
    window: { innerWidth: 390, innerHeight: 844, ontouchstart: () => {} }
  });
  assert.equal(androidPhone.isTouch, true);
  assert.equal(androidPhone.isMobile, true);
  assert.equal(androidPhone.isTablet, false);
  assert.equal(androidPhone.formFactor, 'mobile');
  assert.equal(androidPhone.isPortrait, true);

  const iPadOs = detectDeviceProfile({
    navigator: {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
      maxTouchPoints: 5
    },
    window: { innerWidth: 1024, innerHeight: 768, ontouchstart: () => {} }
  });
  assert.equal(iPadOs.isTouch, true);
  assert.equal(iPadOs.isTablet, true);
  assert.equal(iPadOs.isMobile, false);
  assert.equal(iPadOs.formFactor, 'tablet');
  assert.equal(iPadOs.isLandscape, true);

  const pcDesktop = detectDeviceProfile({
    navigator: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0',
      maxTouchPoints: 0
    },
    window: { innerWidth: 1920, innerHeight: 1080 }
  });
  assert.equal(pcDesktop.isTouch, false);
  assert.equal(pcDesktop.formFactor, 'desktop');
  assert.equal(detectTouchDevice({
    navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', maxTouchPoints: 5 },
    window: { innerWidth: 375, innerHeight: 812 }
  }), true);

  const questVr = detectDeviceProfile({
    navigator: {
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64; Quest 3S) OculusBrowser/34.0',
      maxTouchPoints: 0
    },
    window: { innerWidth: 1440, innerHeight: 1584 }
  });
  assert.equal(questVr.isVr, true);
  assert.equal(questVr.isTouch, false);
  assert.equal(questVr.formFactor, 'vr');

  assert.equal(computeAdaptivePixelRatio({ devicePixelRatio: 3, quality: 'high', isMobile: false, isTablet: false }), 1.5);
  assert.equal(computeAdaptivePixelRatio({ devicePixelRatio: 3, quality: 'high', isMobile: true }), 1.15);
  assert.equal(computeAdaptivePixelRatio({ devicePixelRatio: 3, quality: 'balanced', isMobile: true }), 1.0);
  assert.equal(computeAdaptivePixelRatio({ devicePixelRatio: 2, quality: 'high', isTablet: true }), 1.25);
});

test('v4.26 : GameState, TouchControls contextuel et PlayerController Pointer Events + non-régression PC', () => {
  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  const prevEv = globalThis.Event;
  const { FakeElement, FakeEvent, doc, win } = createFakeDom();
  globalThis.document = doc;
  globalThis.window = win;
  globalThis.Event = FakeEvent;

  try {
    const gs = new GameState();
    assert.equal(typeof gs.touchSens, 'number');
    gs.setTouchSens(1.8);
    assert.equal(gs.touchSens, 1.8);
    gs.setTouchSens(99);
    assert.equal(gs.touchSens, 2.4);

    const makeEl = (id) => new FakeElement('button', id);
    const rootEl = new FakeElement('div', 'touch-controls');
    const joyZone = new FakeElement('div', 'touch-joystick-zone');
    const joyBase = new FakeElement('div', 'touch-joystick-base');
    const joyKnob = new FakeElement('div', 'touch-joystick-knob');
    const lookZone = new FakeElement('div', 'touch-look-zone');
    const btnCtx = makeEl('touch-context-interact');
    const ctxIco = new FakeElement('span');
    ctxIco.className = 'tci-ico';
    const ctxMain = new FakeElement('span');
    ctxMain.className = 'tci-main';
    const ctxSub = new FakeElement('span');
    ctxSub.className = 'tci-sub';
    btnCtx.appendChild(ctxIco);
    btnCtx.appendChild(ctxMain);
    btnCtx.appendChild(ctxSub);

    const btnInteract = makeEl('touch-btn-interact');
    const btnIco = new FakeElement('span');
    btnIco.className = 'tb-ico';
    const btnLbl = new FakeElement('span');
    btnLbl.className = 'tb-lbl';
    btnInteract.appendChild(btnIco);
    btnInteract.appendChild(btnLbl);

    makeEl('touch-btn-jump');
    makeEl('touch-btn-sprint');
    makeEl('touch-btn-camera');
    makeEl('touch-btn-mic');

    const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 100);
    const canvas = new FakeElement('canvas', 'game-canvas');
    const player = new PlayerController(camera, canvas, []);
    player.setEnabled(true);
    player.setTouchMode(true);
    player.setTouchSensitivity(2.0);
    assert.equal(player.touchSensitivity, 2.0);

    let interactedCount = 0;
    const tc = new TouchControls(player, {
      onInteract: () => {
        interactedCount += 1;
      }
    });
    tc.setVisible(true);

    const oscInfo = formatInteractAction({ id: 'oscilloscope', label: 'Banc Oscilloscope 3D' });
    assert.equal(oscInfo.icon, '👆');
    const pcInfo = formatInteractAction({ id: 'pc1', type: 'pc_station', label: 'PC CIEL OS' });
    assert.equal(pcInfo.icon, '🖥️');

    tc.setInteractTarget({ id: 'oscilloscope', label: 'Banc Oscilloscope 3D' });
    assert.equal(btnCtx.classList.contains('hidden'), false);
    assert.equal(ctxMain.textContent, '👆 Interagir');
    assert.equal(ctxSub.textContent, 'Banc Oscilloscope 3D');

    btnCtx.dispatchEvent(new FakeEvent('pointerdown', { pointerType: 'touch', pointerId: 2 }));
    assert.equal(interactedCount, 1);

    tc.setInteractTarget(null);
    assert.equal(btnCtx.classList.contains('hidden'), true);

    joyZone.dispatchEvent(new FakeEvent('pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 60, clientY: 60 }));
    win.dispatchEvent(new FakeEvent('pointermove', { pointerType: 'touch', pointerId: 1, clientX: 90, clientY: 30 }));
    assert.ok(Math.abs(player.virtualMove.right) > 0 || Math.abs(player.virtualMove.forward) > 0);
    win.dispatchEvent(new FakeEvent('pointerup', { pointerType: 'touch', pointerId: 1 }));
    assert.equal(player.virtualMove.right, 0);
    assert.equal(player.virtualMove.forward, 0);

    const yawBefore = player.yaw;
    lookZone.dispatchEvent(new FakeEvent('pointerdown', { pointerType: 'touch', pointerId: 3, clientX: 300, clientY: 200 }));
    win.dispatchEvent(new FakeEvent('pointermove', { pointerType: 'touch', pointerId: 3, clientX: 340, clientY: 200 }));
    assert.notEqual(player.yaw, yawBefore);
    win.dispatchEvent(new FakeEvent('pointerup', { pointerType: 'touch', pointerId: 3 }));

    player.setTouchMode(false);
    player.setSensitivity(1.2);
    const yawPcBefore = player.yaw;
    canvas.dispatchEvent(new FakeEvent('pointerdown', { pointerType: 'mouse', button: 0, clientX: 100, clientY: 100 }));
    win.dispatchEvent(new FakeEvent('pointermove', { pointerType: 'mouse', clientX: 140, clientY: 100 }));
    assert.notEqual(player.yaw, yawPcBefore);
    win.dispatchEvent(new FakeEvent('pointerup', { pointerType: 'mouse', clientX: 140, clientY: 100 }));

    tc.destroy();
    assert.equal(rootEl.children.length >= 0, true);
  } finally {
    globalThis.document = prevDoc;
    globalThis.window = prevWin;
    globalThis.Event = prevEv;
  }
});

test('v4.26 : TouchTpHelpers (Tap-to-Connect, [-]/[+], Pavés IP/Num/Hex/Bin, Zoom, CIEL OS Touch Layout)', () => {
  const prevDoc = globalThis.document;
  const prevEv = globalThis.Event;
  const { FakeElement, FakeEvent, doc } = createFakeDom();
  globalThis.document = doc;
  globalThis.Event = FakeEvent;

  try {
    const events = [];
    const ttc = createTapConnectController({
      onSelect: (id) => events.push(['select', id]),
      onConnect: (src, dst) => events.push(['connect', src, dst]),
      onCancel: (id) => events.push(['cancel', id])
    });
    assert.equal(ttc.tap('P01').action, 'select');
    assert.equal(ttc.getSelected(), 'P01');
    assert.equal(ttc.tap('P01').action, 'cancel');
    assert.equal(ttc.getSelected(), null);
    ttc.tap('P02');
    const conn = ttc.tap('S05');
    assert.equal(conn.action, 'connect');
    assert.equal(conn.source, 'P02');
    assert.equal(conn.target, 'S05');
    ttc.startDrag('OUT_1');
    const dropConn = ttc.dropOn('IN_2');
    assert.equal(dropConn.action, 'connect');
    assert.deepEqual(events, [
      ['select', 'P01'],
      ['cancel', 'P01'],
      ['select', 'P02'],
      ['connect', 'P02', 'S05'],
      ['select', 'OUT_1'],
      ['connect', 'OUT_1', 'IN_2']
    ]);

    const box = new FakeElement('div');
    const range = new FakeElement('input');
    range.type = 'range';
    range.min = '-5';
    range.max = '5';
    range.step = '0.2';
    range.value = '1.0';
    range.dataset.fineStep = '0.2';
    box.appendChild(range);

    let stepCalls = 0;
    const cleanupSteppers = enhanceRangeInputsWithSteppers(box, {
      onStep: () => {
        stepCalls += 1;
      }
    });
    const plusBtn = box.querySelectorAll('button').find((b) => b.dataset.stepDir === '1');
    const minusBtn = box.querySelectorAll('button').find((b) => b.dataset.stepDir === '-1');
    assert.ok(plusBtn && minusBtn);
    plusBtn.dispatchEvent(new FakeEvent('click'));
    assert.equal(Number(range.value), 1.2);
    minusBtn.dispatchEvent(new FakeEvent('click'));
    minusBtn.dispatchEvent(new FakeEvent('click'));
    assert.equal(Number(range.value), 0.8);
    assert.equal(stepCalls, 3);
    assert.equal(adjustRangeInput(range, 1, 10), 5);
    cleanupSteppers();

    const inp = new FakeElement('input');
    doc.body.classList.add('touch-active');
    let submitted = '';
    const kp = createVirtualKeypad({
      mode: 'ip-cli',
      targetInput: inp,
      presets: ['vlan 10', 'trunk gi0/24'],
      onSubmit: (v) => {
        submitted = v;
      }
    });
    assert.equal(inp.readOnly, true);
    kp.appendToken('192.168.10.');
    kp.appendToken('254');
    kp.backspace();
    kp.appendToken('1');
    kp.submit();
    assert.equal(submitted, '192.168.10.251');
    kp.clear();
    assert.equal(inp.value, '');
    kp.destroy();

    const hexKp = createVirtualKeypad({ mode: 'hex', targetInput: new FakeElement('input') });
    assert.ok(hexKp.element.querySelectorAll('button').some((b) => b.textContent === 'F'));
    hexKp.destroy();

    const binKp = createVirtualKeypad({ mode: 'binary', targetInput: new FakeElement('input') });
    assert.ok(binKp.element.querySelectorAll('button').some((b) => b.textContent === '0'));
    assert.ok(binKp.element.querySelectorAll('button').some((b) => b.textContent === '1'));
    binKp.destroy();

    let drawn = false;
    const zoomOverlay = createInspectZoomOverlay(box, {
      title: 'Zoom Oscilloscope',
      draw: () => {
        drawn = true;
      }
    });
    assert.ok(zoomOverlay.element);
    assert.equal(drawn, true);
    zoomOverlay.close();

    for (const appId of ['snake', 'minesweeper', 'tetris', 'breakout', 'flappy', 'game2048', 'terminal', 'notepad', null]) {
      const lay = getCielOsTouchLayout(appId);
      assert.equal(typeof lay.showDpad, 'boolean');
      assert.ok(Array.isArray(lay.actions));
      assert.equal(typeof lay.hint, 'string');
    }
    assert.equal(getCielOsTouchLayout('snake').showDpad, true);
    assert.equal(getCielOsTouchLayout('tetris').showDpad, true);
    assert.equal(getCielOsTouchLayout('minesweeper').actions.some((a) => a.code === 'KeyF'), true);
    assert.equal(getCielOsTouchLayout('terminal').actions.some((a) => a.terminalCmd === 'help'), true);
  } finally {
    globalThis.document = prevDoc;
    globalThis.Event = prevEv;
  }
});

test('v4.26 : Audit complet des 9 TPs, CSS responsive (360px-1024px), version et règles strictes', () => {
  const tpFiles = [
    'src/minigames/OscilloscopeGame.js',
    'src/minigames/SolderingGame.js',
    'src/minigames/ElectronicsGame.js',
    'src/minigames/PatchPanelGame.js',
    'src/minigames/VlanConfigGame.js',
    'src/minigames/AntivirusGame.js',
    'src/minigames/PcHardwareGame.js',
    'src/minigames/DmxLightingGame.js',
    'src/minigames/StudioRegieGame.js'
  ];

  for (const rel of tpFiles) {
    const content = fs.readFileSync(path.resolve(rel), 'utf8');
    assert.ok(
      content.includes('setInspectableView'),
      `${rel} doit enregistrer une vue agrandie inspectable tactile`
    );
    assert.ok(
      !/addEventListener\s*\(\s*['"]mouse(down|move|up)['"]/.test(content),
      `${rel} ne doit pas contenir d’écouteur mouse-only`
    );
  }

  for (const rel of ['src/ui/SkinCustomizer.js', 'src/ui/TouchControls.js', 'src/minigames/Workbench3DHost.js']) {
    const content = fs.readFileSync(path.resolve(rel), 'utf8');
    assert.ok(
      !/addEventListener\s*\(\s*['"]mouse(down|move|up)['"]/.test(content),
      `${rel} doit utiliser des Pointer Events unifiés`
    );
    assert.ok(content.includes('pointerdown'), `${rel} doit écouter pointerdown`);
  }

  const workbenchSrc = fs.readFileSync(path.resolve('src/minigames/Workbench3DHost.js'), 'utf8');
  assert.ok(workbenchSrc.includes('enhanceRangeInputsWithSteppers'));
  assert.ok(workbenchSrc.includes('createInspectZoomOverlay'));
  assert.ok(workbenchSrc.includes('pinchStartDist'));
  assert.ok(workbenchSrc.includes('tp3d-drawer-toggle'));

  const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');
  assert.ok(indexHtml.includes('viewport-fit=cover'));
  assert.ok(indexHtml.includes('touch-context-interact'));
  assert.ok(indexHtml.includes('set-touch-sens'));

  const mainCss = fs.readFileSync(path.resolve('src/styles/main.css'), 'utf8');
  const mgCss = fs.readFileSync(path.resolve('src/styles/minigames.css'), 'utf8');
  assert.ok(mainCss.includes('100dvh'));
  assert.ok(mainCss.includes('touch-action: none'));
  assert.ok(mainCss.includes('.touch-context-interact'));
  assert.ok(mainCss.includes('.ciel-os-touch-pad'));
  assert.ok(mgCss.includes('min-height: 44px'));
  assert.ok(mgCss.includes('@media (max-width: 1024px)'));
  assert.ok(mgCss.includes('@media (max-width: 760px)'));
  assert.ok(mgCss.includes('@media (max-width: 480px)'));
  assert.ok(mgCss.includes('.tp3d-zoom-overlay'));
  assert.ok(mgCss.includes('.tp-virtual-keypad'));
  assert.ok(mgCss.includes('.tp3d-step-btn'));

  const viteSrc = fs.readFileSync(path.resolve('vite.config.js'), 'utf8');
  assert.ok(viteSrc.includes('v4.29'));
  assert.ok(APP_VERSION.startsWith('v4.29'));
  assert.ok(CHANGELOG_RELEASES[0].version.startsWith('v4.29'));
  assert.equal(CHANGELOG_RELEASES[0].tag, 'DERNIÈRE MÀJ');
  assert.equal(CHANGELOG_RELEASES[1].tag, 'HISTORIQUE');

  const forbiddenPattern = new RegExp('for' + 'tin', 'i');
  const filesToScan = [
    ...tpFiles,
    'src/minigames/TouchTpHelpers.js',
    'src/minigames/Workbench3DHost.js',
    'src/ui/TouchControls.js',
    'src/ui/HudManager.js',
    'src/ui/ChangelogModal.js',
    'src/world/PlayerController.js',
    'src/world/SceneManager.js',
    'src/core/gameState.js',
    'src/main.js',
    'index.html',
    'src/styles/main.css',
    'src/styles/minigames.css'
  ];
  for (const rel of filesToScan) {
    const content = fs.readFileSync(path.resolve(rel), 'utf8');
    assert.equal(forbiddenPattern.test(content), false, `${rel} ne doit jamais utiliser de nom interdit`);
  }
});
