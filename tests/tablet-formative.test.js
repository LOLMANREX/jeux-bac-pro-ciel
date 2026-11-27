import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import * as THREE from 'three';
import { WebSocket } from 'ws';
import { createGameServer } from '../server/index.js';
import { GameStore } from '../server/store.js';
import {
  FORMATIVE_POLES,
  FORMATIVE_TP_CATALOG,
  computeFormativeStats,
  evaluateFormativeTp,
  evaluateQuestionAnswer,
  getFormativeTpById,
  normalizeShortAnswer
} from '../src/core/formativeCatalog.js';
import { GameState } from '../src/core/gameState.js';
import { APP_VERSION, CHANGELOG_RELEASES } from '../src/ui/ChangelogModal.js';
import { PlateauMiniMap } from '../src/ui/PlateauMiniMap.js';
import { TABLET_APPS_META, TabletOS, shouldHandleTabShortcut } from '../src/ui/TabletOS.js';
import {
  CampusMapApp,
  clampZoomScale,
  computeWaypointNavigation,
  extractMapEntities,
  getAvailableFloors,
  screenToWorld,
  worldToScreen
} from '../src/ui/tablet/CampusMapApp.js';
import {
  calculateIpv4Subnet,
  decodeResistor4Band,
  filterCommandMemo
} from '../src/ui/tablet/CielToolsLogic.js';
import { buildGradesSummary } from '../src/ui/tablet/GradesApp.js';
import { createTpSpatialPanel, createWristHudPanel } from '../src/vr/VRHudPanel.js';
import { VRManager } from '../src/vr/VRManager.js';
import { PlayerController } from '../src/world/PlayerController.js';
import { createCampusMap, createDefaultMap } from '../src/world/mapSchema.js';

function createMockCanvasContext() {
  const ops = [];
  const texts = [];
  const grad = () => ({ addColorStop() {} });
  return {
    ops,
    texts,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineCap: 'butt',
    font: '12px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    clearRect(...args) {
      ops.push(['clearRect', ...args]);
    },
    fillRect(...args) {
      ops.push(['fillRect', ...args]);
    },
    strokeRect(...args) {
      ops.push(['strokeRect', ...args]);
    },
    beginPath() {
      ops.push(['beginPath']);
    },
    closePath() {
      ops.push(['closePath']);
    },
    moveTo(...args) {
      ops.push(['moveTo', ...args]);
    },
    lineTo(...args) {
      ops.push(['lineTo', ...args]);
    },
    arc(...args) {
      ops.push(['arc', ...args]);
    },
    arcTo(...args) {
      ops.push(['arcTo', ...args]);
    },
    rect(...args) {
      ops.push(['rect', ...args]);
    },
    roundRect(...args) {
      ops.push(['roundRect', ...args]);
    },
    fill() {
      ops.push(['fill']);
    },
    stroke() {
      ops.push(['stroke']);
    },
    clip() {
      ops.push(['clip']);
    },
    save() {
      ops.push(['save']);
    },
    restore() {
      ops.push(['restore']);
    },
    translate(...args) {
      ops.push(['translate', ...args]);
    },
    rotate(...args) {
      ops.push(['rotate', ...args]);
    },
    setTransform(...args) {
      ops.push(['setTransform', ...args]);
    },
    setLineDash(arr) {
      ops.push(['setLineDash', arr]);
    },
    drawImage(...args) {
      ops.push(['drawImage', args.length]);
    },
    fillText(txt, x, y) {
      texts.push(String(txt));
      ops.push(['fillText', String(txt), x, y]);
    },
    measureText(txt) {
      return { width: String(txt || '').length * 7 };
    },
    createLinearGradient() {
      return grad();
    }
  };
}

function toCamelCase(kebab) {
  return String(kebab).replace(/-([a-z0-9])/g, (_m, c) => c.toUpperCase());
}

function createFakeClassList(el) {
  const set = new Set();
  const sync = () => {
    if (el) el._className = Array.from(set).join(' ');
  };
  return {
    add: (...names) => {
      for (const n of names) {
        if (n) set.add(n);
      }
      sync();
    },
    remove: (...names) => {
      for (const n of names) {
        set.delete(n);
      }
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

function parseAttributes(attrStr) {
  const attrs = {};
  const re = /([a-zA-Z0-9_:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(attrStr || ''))) {
    const key = m[1];
    const val = m[2] ?? m[3] ?? m[4] ?? '';
    attrs[key] = val;
  }
  return attrs;
}

function matchesSimpleSelector(el, selector) {
  let rest = String(selector || '').trim();
  if (!rest) return false;
  if (rest.includes(' ')) {
    const parts = rest.split(/\s+/).filter(Boolean);
    const last = parts[parts.length - 1];
    if (!matchesSimpleSelector(el, last)) return false;
    let cur = el.parentNode;
    let idx = parts.length - 2;
    while (cur && idx >= 0) {
      if (matchesSimpleSelector(cur, parts[idx])) idx--;
      cur = cur.parentNode;
    }
    return idx < 0;
  }
  const tagMatch = rest.match(/^([a-zA-Z0-9-]+)/);
  if (tagMatch) {
    if (el.tagName !== tagMatch[1].toUpperCase()) return false;
    rest = rest.slice(tagMatch[0].length);
  }
  while (rest.length > 0) {
    if (rest[0] === '#') {
      const m = rest.match(/^#([a-zA-Z0-9_-]+)/);
      if (!m || el.id !== m[1]) return false;
      rest = rest.slice(m[0].length);
    } else if (rest[0] === '.') {
      const m = rest.match(/^\.([a-zA-Z0-9_-]+)/);
      if (!m || !el.classList.contains(m[1])) return false;
      rest = rest.slice(m[0].length);
    } else if (rest[0] === '[') {
      const m = rest.match(/^\[([a-zA-Z0-9_:-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/);
      if (!m) return false;
      const attrName = m[1];
      const expected = m[2] ?? m[3] ?? m[4];
      const actual = el.getAttribute(attrName);
      if (actual === null) return false;
      if (expected !== undefined && actual !== expected) return false;
      rest = rest.slice(m[0].length);
    } else {
      return false;
    }
  }
  return true;
}

function matchesSelector(el, selector) {
  return String(selector || '')
    .split(',')
    .some((part) => matchesSimpleSelector(el, part));
}

function setupMockDom() {
  const prevDocument = globalThis.document;
  const prevWindow = globalThis.window;
  const prevStorage = globalThis.localStorage;

  const storageMap = new Map();
  globalThis.localStorage = {
    getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k)
  };

  const VOID_TAGS = new Set(['input', 'br', 'hr', 'img', 'meta', 'link']);
  const docListeners = new Map();
  const winListeners = new Map();

  class MockElement {
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
      this.width = 640;
      this.height = 420;
      this.clientWidth = 640;
      this.clientHeight = 420;
      this._textContent = '';
      this._innerHTML = '';
      this._ctx = null;
      this.classList = createFakeClassList(this);
      if (id) this.attributes.id = id;
    }
    get parentElement() {
      return this.parentNode;
    }
    set className(val) {
      this._className = String(val || '');
      this.attributes.class = this._className;
      this.classList.setFromString(val);
    }
    get className() {
      return this._className || '';
    }
    set textContent(v) {
      this._textContent = String(v ?? '');
      this.children = [];
    }
    get textContent() {
      if (this.children.length > 0) {
        return this.children.map((c) => c.textContent).join(' ');
      }
      return this._textContent;
    }
    set innerHTML(html) {
      const str = String(html || '');
      this._innerHTML = str;
      this._textContent = '';
      this.children = [];
      const stack = [this];
      const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^>]*)?)\s*(\/?)>/g;
      let lastIndex = 0;
      let m;
      while ((m = tagRe.exec(str))) {
        const textChunk = str.slice(lastIndex, m.index).trim();
        if (textChunk && stack.length > 0) {
          const top = stack[stack.length - 1];
          top._textContent = top._textContent ? `${top._textContent} ${textChunk}` : textChunk;
        }
        lastIndex = tagRe.lastIndex;
        const isClosing = m[1] === '/';
        const tag = m[2].toLowerCase();
        const attrRaw = m[3] || '';
        const isSelfClosing = m[4] === '/' || VOID_TAGS.has(tag);
        if (isClosing) {
          for (let i = stack.length - 1; i >= 1; i--) {
            if (stack[i].tagName === tag.toUpperCase()) {
              stack.length = i;
              break;
            }
          }
          continue;
        }
        const child = new MockElement(tag);
        const attrs = parseAttributes(attrRaw);
        for (const [k, v] of Object.entries(attrs)) {
          child.setAttribute(k, v);
        }
        const parent = stack[stack.length - 1];
        parent.appendChild(child);
        if (!isSelfClosing) {
          stack.push(child);
        }
      }
      const tail = str.slice(lastIndex).trim();
      if (tail && stack.length > 0) {
        const top = stack[stack.length - 1];
        top._textContent = top._textContent ? `${top._textContent} ${tail}` : tail;
      }
    }
    get innerHTML() {
      return this._innerHTML;
    }
    setAttribute(k, v) {
      const key = String(k);
      const val = String(v);
      this.attributes[key] = val;
      if (key === 'id') this.id = val;
      else if (key === 'class') this.className = val;
      else if (key === 'value') this.value = val;
      else if (key === 'disabled') this.disabled = true;
      else if (key.startsWith('data-')) {
        this.dataset[toCamelCase(key.slice(5))] = val;
      }
    }
    getAttribute(k) {
      if (k === 'id') return this.id || null;
      if (k === 'class') return this.className || null;
      if (k in this.attributes) return this.attributes[k];
      return null;
    }
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(fn);
    }
    removeEventListener(type, fn) {
      this.listeners.get(type)?.delete(fn);
    }
    dispatchEvent(ev) {
      const eventObj = ev || { type: 'click' };
      if (!eventObj.target) eventObj.target = this;
      if (!eventObj.preventDefault) eventObj.preventDefault = () => {};
      if (!eventObj.stopPropagation) eventObj.stopPropagation = () => {};
      const list = this.listeners.get(eventObj.type);
      if (list) {
        for (const fn of list) fn(eventObj);
      }
      return true;
    }
    click() {
      this.dispatchEvent({ type: 'click', target: this });
    }
    querySelectorAll(selector) {
      const out = [];
      const walk = (node) => {
        for (const child of node.children) {
          if (matchesSelector(child, selector)) out.push(child);
          walk(child);
        }
      };
      walk(this);
      return out;
    }
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }
    getContext(kind) {
      if (kind !== '2d') return null;
      if (!this._ctx) this._ctx = createMockCanvasContext();
      return this._ctx;
    }
    getBoundingClientRect() {
      return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight };
    }
  }

  const rootOverlay = new MockElement('div', 'tablet-os-overlay');
  rootOverlay.className = 'tablet-os-overlay hidden';

  globalThis.document = {
    activeElement: null,
    createElement: (tag) => new MockElement(tag),
    getElementById: (id) => (id === 'tablet-os-overlay' ? rootOverlay : null),
    addEventListener: (type, fn) => {
      if (!docListeners.has(type)) docListeners.set(type, new Set());
      docListeners.get(type).add(fn);
    },
    removeEventListener: (type, fn) => docListeners.get(type)?.delete(fn)
  };
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener: (type, fn) => {
      if (!winListeners.has(type)) winListeners.set(type, new Set());
      winListeners.get(type).add(fn);
    },
    removeEventListener: (type, fn) => winListeners.get(type)?.delete(fn)
  };

  return {
    MockElement,
    rootOverlay,
    restore() {
      globalThis.document = prevDocument;
      globalThis.window = prevWindow;
      globalThis.localStorage = prevStorage;
    }
  };
}

function buildValidAnswersForTp(tp) {
  const answers = {};
  for (const q of tp.questions) {
    if (q.type === 'mcq_single') answers[q.id] = q.correctOption;
    else if (q.type === 'mcq_multi') answers[q.id] = [...q.correctOptions];
    else if (q.type === 'short_text') answers[q.id] = q.acceptedAnswers[0];
    else if (q.type === 'ordering') answers[q.id] = [...q.correctOrder];
    else if (q.type === 'matching') answers[q.id] = { ...q.correctPairs };
  }
  return answers;
}

function openWs(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

function waitForWsMsg(ws, predicate, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', onMsg);
      reject(new Error('Timeout waiting for WS message'));
    }, timeoutMs);
    const onMsg = (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString('utf8'));
      } catch {
        return;
      }
      if (predicate(msg)) {
        clearTimeout(timer);
        ws.off('message', onMsg);
        resolve(msg);
      }
    };
    ws.on('message', onMsg);
  });
}

test('Ouverture/Fermeture Tab & TabletOS : shouldHandleTabShortcut, open/close/toggle, solde CC temps réel, connexion serveur et navigation 4 apps', () => {
  assert.equal(shouldHandleTabShortcut(), false);
  assert.equal(shouldHandleTabShortcut({ joined: false }), false);
  assert.equal(shouldHandleTabShortcut({ joined: true, isTyping: true }), false);
  assert.equal(shouldHandleTabShortcut({ joined: true, subModalActive: true }), false);
  assert.equal(shouldHandleTabShortcut({ joined: true, isDetentionSeated: true }), false);
  assert.equal(shouldHandleTabShortcut({ joined: true, inCombatMatch: true }), false);
  assert.equal(shouldHandleTabShortcut({ joined: true, isOtherModalOpen: true, tabletOpen: false }), false);
  assert.equal(shouldHandleTabShortcut({ joined: true }), true);
  assert.equal(shouldHandleTabShortcut({ joined: true, isOtherModalOpen: true, tabletOpen: true }), true);

  const dom = setupMockDom();
  let tablet = null;
  try {
    const gs = new GameState();
    gs.setProfile({ name: 'Lucas_CIEL', coins: 150 });
    let openCalls = 0;
    let closeCalls = 0;

    tablet = new TabletOS({
      gameState: gs,
      rootEl: dom.rootOverlay,
      onOpen: () => {
        openCalls += 1;
      },
      onClose: () => {
        closeCalls += 1;
      }
    });

    assert.equal(tablet.isOpen(), false);
    assert.equal(dom.rootOverlay.classList.contains('hidden'), true);
    assert.equal(dom.rootOverlay.querySelector('#tablet-coins-val').textContent, '150');

    assert.equal(tablet.open(), true);
    assert.equal(tablet.isOpen(), true);
    assert.equal(openCalls, 1);
    assert.equal(dom.rootOverlay.classList.contains('hidden'), false);

    const tiles = dom.rootOverlay.querySelectorAll('[data-launch-app]');
    assert.equal(TABLET_APPS_META.length, 4);
    assert.equal(tiles.length, 4);
    assert.deepEqual(
      tiles.map((t) => t.dataset.launchApp),
      ['formative', 'map', 'grades', 'tools']
    );

    gs.setProfile({ coins: 675 });
    assert.equal(dom.rootOverlay.querySelector('#tablet-coins-val').textContent, '675');

    tablet.setConnectionStatus({
      state: 'connected',
      connected: true,
      onlineCount: 4,
      pingMs: 18
    });
    assert.equal(dom.rootOverlay.querySelector('#tablet-conn-text').textContent, 'Connecté (4) • 18ms');

    tablet.setConnectionStatus({ state: 'connecting', connected: false });
    assert.equal(dom.rootOverlay.querySelector('#tablet-conn-text').textContent, 'Connexion...');

    tablet.setConnectionStatus({ state: 'error', connected: false });
    assert.equal(dom.rootOverlay.querySelector('#tablet-conn-text').textContent, 'Hors ligne');

    tablet.setConnectionStatus({ state: 'solo', connected: false });
    assert.equal(dom.rootOverlay.querySelector('#tablet-conn-text').textContent, 'Mode Solo');

    assert.equal(tablet.openApp('formative'), true);
    assert.equal(tablet.activeApp, 'formative');
    assert.equal(tablet.openApp('map'), true);
    assert.equal(tablet.activeApp, 'map');
    tablet.updateLiveMap({ playerPos: { x: -3.95, z: 0.65 }, playerFloor: 0 });
    const wpSet = tablet.setWaypoint({ x: 2.5, z: -1.5, floor: 0, label: 'Poste TP1' });
    assert.equal(wpSet.label, 'Poste TP1');
    assert.equal(tablet.getWaypoint().label, 'Poste TP1');
    tablet.clearWaypoint();
    assert.equal(tablet.getWaypoint(), null);

    assert.equal(tablet.openApp('grades'), true);
    assert.equal(tablet.activeApp, 'grades');
    assert.equal(tablet.openApp('tools'), true);
    assert.equal(tablet.activeApp, 'tools');

    assert.equal(tablet.goBack(), true);
    assert.equal(tablet.activeApp, 'grades');

    tablet.goHome();
    assert.equal(tablet.activeApp, null);
    const launchTiles = dom.rootOverlay.querySelectorAll('[data-launch-app]');
    assert.equal(launchTiles.length, 4);
    launchTiles[0].click();
    assert.equal(tablet.activeApp, 'formative');
    tablet.goHome();

    assert.equal(tablet.goBack(), true);
    assert.equal(tablet.isOpen(), false);
    assert.equal(closeCalls, 1);
    assert.equal(dom.rootOverlay.classList.contains('hidden'), true);

    assert.equal(tablet.toggle(), true);
    assert.equal(tablet.isOpen(), true);
    assert.equal(tablet.toggle(), false);
    assert.equal(tablet.isOpen(), false);
    assert.equal(closeCalls, 2);
  } finally {
    tablet?.destroy();
    dom.restore();
  }
});

test('CIEL Formative : 4 pôles, 8 TP couvrant tous les types, normalizeShortAnswer, évaluation et computeFormativeStats', () => {
  assert.equal(FORMATIVE_POLES.length, 4);
  assert.deepEqual(
    FORMATIVE_POLES.map((p) => p.id),
    ['reseaux', 'electronique', 'cyber', 'fibre']
  );
  assert.equal(FORMATIVE_TP_CATALOG.length, 8);

  const seenTypes = new Set();
  for (const tp of FORMATIVE_TP_CATALOG) {
    assert.ok(tp.questions.length >= 4);
    for (const q of tp.questions) seenTypes.add(q.type);
  }
  for (const expectedType of ['mcq_single', 'mcq_multi', 'short_text', 'ordering', 'matching']) {
    assert.equal(seenTypes.has(expectedType), true, `Type manquant : ${expectedType}`);
  }

  assert.equal(normalizeShortAnswer('  OTDR '), 'otdr');
  assert.equal(normalizeShortAnswer('Électricité'), 'electricite');
  assert.equal(normalizeShortAnswer('  sudo   systemctl   restart  ssh  '), 'sudo systemctl restart ssh');
  assert.equal(normalizeShortAnswer('150 Ω'), '150 ohm');
  assert.equal(normalizeShortAnswer('9 µm'), '9 um');
  assert.equal(normalizeShortAnswer('pinMode( 9 , OUTPUT )'), 'pinmode(9,output)');
  assert.equal(normalizeShortAnswer('255.255.255.192;;'), '255.255.255.192');

  const tp1 = getFormativeTpById('fmt_ip_cidr');
  const tp4 = getFormativeTpById('fmt_dmx_signaux');

  assert.equal(evaluateQuestionAnswer(tp1.questions[2], '').status, 'unanswered');
  assert.equal(evaluateQuestionAnswer(tp1.questions[2], '62').status, 'correct');
  const wrongMcq = evaluateQuestionAnswer(tp1.questions[2], '30');
  assert.equal(wrongMcq.status, 'incorrect');
  assert.ok(wrongMcq.hint.length > 0);

  assert.equal(evaluateQuestionAnswer(tp1.questions[3], []).status, 'unanswered');
  assert.equal(evaluateQuestionAnswer(tp1.questions[3], ['c', 'a', 'b']).status, 'correct');
  assert.equal(evaluateQuestionAnswer(tp1.questions[3], ['a', 'd']).status, 'incorrect');

  assert.equal(evaluateQuestionAnswer(tp1.questions[0], '   ').status, 'unanswered');
  assert.equal(evaluateQuestionAnswer(tp1.questions[0], '255.255.255.192;').status, 'correct');
  const wrongShort = evaluateQuestionAnswer(tp1.questions[0], '255.255.255.0');
  assert.equal(wrongShort.status, 'incorrect');
  assert.ok(wrongShort.hint.includes('192'));

  assert.equal(evaluateQuestionAnswer(tp1.questions[4], ['data', 'segment']).status, 'unanswered');
  assert.equal(
    evaluateQuestionAnswer(tp1.questions[4], ['data', 'segment', 'packet', 'frame']).status,
    'correct'
  );
  assert.equal(
    evaluateQuestionAnswer(tp1.questions[4], ['frame', 'segment', 'packet', 'data']).status,
    'incorrect'
  );

  const matchQ = tp4.questions.find((q) => q.type === 'matching');
  assert.equal(evaluateQuestionAnswer(matchQ, { pin2: 'd_minus' }).status, 'unanswered');
  assert.equal(evaluateQuestionAnswer(matchQ, matchQ.correctPairs).status, 'correct');
  assert.equal(
    evaluateQuestionAnswer(matchQ, { ...matchQ.correctPairs, pin2: 'd_plus' }).status,
    'incorrect'
  );

  const partialAnswers = buildValidAnswersForTp(tp1);
  delete partialAnswers.q5_osi;
  const partialEval = evaluateFormativeTp('fmt_ip_cidr', partialAnswers);
  assert.equal(partialEval.correctCount, 4);
  assert.equal(partialEval.totalQuestions, 5);
  assert.equal(partialEval.completionPct, 80);
  assert.equal(partialEval.scoreOutOf20, 16);
  assert.equal(partialEval.validated, false);
  assert.equal(partialEval.status, 'in_progress');

  const fullProgress = {};
  const rewardedIds = [];
  for (const tp of FORMATIVE_TP_CATALOG) {
    const ans = buildValidAnswersForTp(tp);
    const fullEval = evaluateFormativeTp(tp.id, ans);
    assert.equal(fullEval.completionPct, 100);
    assert.equal(fullEval.scoreOutOf20, 20);
    assert.equal(fullEval.validated, true);
    assert.equal(fullEval.status, 'validated');
    fullProgress[tp.id] = { tpId: tp.id, answers: ans, validated: true, rewarded: true, completionPct: 100 };
    rewardedIds.push(tp.id);
  }

  const partialStats = computeFormativeStats(
    {
      fmt_ip_cidr: { tpId: 'fmt_ip_cidr', answers: buildValidAnswersForTp(tp1), validated: true, rewarded: true },
      fmt_vlan_trunk: {
        tpId: 'fmt_vlan_trunk',
        answers: buildValidAnswersForTp(getFormativeTpById('fmt_vlan_trunk')),
        validated: true,
        rewarded: true
      }
    },
    ['fmt_ip_cidr', 'fmt_vlan_trunk']
  );
  assert.equal(partialStats.validatedCount, 2);
  assert.equal(partialStats.averageScore, 20);
  assert.equal(partialStats.byPole.find((p) => p.id === 'reseaux').validated, 2);
  assert.equal(partialStats.badges.find((b) => b.id === 'first_tp').unlocked, true);
  assert.equal(partialStats.badges.find((b) => b.id === 'pole_reseaux').unlocked, true);
  assert.equal(partialStats.badges.find((b) => b.id === 'half_way').unlocked, false);

  const allStats = computeFormativeStats(fullProgress, rewardedIds);
  assert.equal(allStats.validatedCount, 8);
  assert.equal(allStats.overallPct, 100);
  assert.equal(allStats.averageScore, 20);
  assert.equal(allStats.badges.every((b) => b.unlocked), true);
});

test('Sécurité Backend & Anti-Doublon : HTTP /api/formative/*, anti-triche /api/account/save, WS formative_submit et dbPath: null', async () => {
  const { server, wsHub } = createGameServer({ dbPath: null });
  let ws = null;
  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    const wsUrl = `ws://127.0.0.1:${port}/ws`;

    const catRes = await fetch(`${baseUrl}/api/formative/catalog`);
    assert.equal(catRes.status, 200);
    const catData = await catRes.json();
    assert.equal(catData.ok, true);
    assert.equal(catData.poles.length, 4);
    assert.equal(catData.tps.length, 8);

    const regA = await (
      await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'Alice_CIEL', password: 'Password123' })
      })
    ).json();
    assert.equal(regA.ok, true);
    const tokenA = regA.token;
    const initialCoins = regA.profile.coins;
    const initialXp = regA.profile.xp;

    const regB = await (
      await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'Bob_CIEL', password: 'Password456' })
      })
    ).json();
    const tokenB = regB.token;

    const tp1 = getFormativeTpById('fmt_ip_cidr');
    const partialAns = { q1_mask: '255.255.255.192', q3_hosts: '62' };
    const partialRes = await fetch(`${baseUrl}/api/formative/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({ tpId: 'fmt_ip_cidr', answers: partialAns, name: 'Alice_CIEL' })
    });
    assert.equal(partialRes.status, 200);
    const partialBody = await partialRes.json();
    assert.equal(partialBody.ok, true);
    assert.equal(partialBody.coinsEarned, 0);
    assert.equal(partialBody.xpEarned, 0);
    assert.equal(partialBody.rewardGranted, false);
    assert.equal(partialBody.evaluation.validated, false);
    assert.equal(partialBody.coins, initialCoins);

    const getProgRes = await fetch(`${baseUrl}/api/formative/progress?name=Alice_CIEL`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.equal(getProgRes.status, 200);
    const getProgData = await getProgRes.json();
    assert.deepEqual(getProgData.formativeProgress.fmt_ip_cidr.answers, partialAns);
    assert.deepEqual(getProgData.formativeRewardedTps, []);

    const cheatRes = await fetch(`${baseUrl}/api/account/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        coins: 999999,
        xp: 999999,
        formativeRewardedTps: ['fmt_ip_cidr', 'fmt_vlan_trunk'],
        formativeProgress: {
          fmt_ip_cidr: { validated: true, rewarded: true, completionPct: 100 }
        }
      })
    });
    assert.equal(cheatRes.status, 200);
    const cheatData = await cheatRes.json();
    assert.equal(cheatData.profile.coins, initialCoins);
    assert.equal(cheatData.profile.xp, initialXp);
    assert.deepEqual(cheatData.profile.formativeRewardedTps, []);
    assert.equal(cheatData.profile.formativeProgress.fmt_ip_cidr.validated, false);

    const fullAns = buildValidAnswersForTp(tp1);
    const firstWinRes = await fetch(`${baseUrl}/api/formative/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({ tpId: 'fmt_ip_cidr', answers: fullAns, name: 'Alice_CIEL' })
    });
    assert.equal(firstWinRes.status, 200);
    const firstWinData = await firstWinRes.json();
    assert.equal(firstWinData.ok, true);
    assert.equal(firstWinData.rewardGranted, true);
    assert.equal(firstWinData.alreadyRewarded, false);
    assert.equal(firstWinData.coinsEarned, tp1.rewardCoins);
    assert.equal(firstWinData.xpEarned, tp1.rewardXp);
    assert.equal(firstWinData.coins, initialCoins + tp1.rewardCoins);
    assert.equal(firstWinData.xp, initialXp + tp1.rewardXp);

    const secondWinRes = await fetch(`${baseUrl}/api/formative/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({ tpId: 'fmt_ip_cidr', answers: fullAns, name: 'Alice_CIEL' })
    });
    assert.equal(secondWinRes.status, 200);
    const secondWinData = await secondWinRes.json();
    assert.equal(secondWinData.coinsEarned, 0);
    assert.equal(secondWinData.xpEarned, 0);
    assert.equal(secondWinData.rewardGranted, false);
    assert.equal(secondWinData.alreadyRewarded, true);
    assert.equal(secondWinData.coins, initialCoins + tp1.rewardCoins);

    ws = await openWs(wsUrl);
    const welcomeP = waitForWsMsg(ws, (m) => m.type === 'welcome');
    ws.send(JSON.stringify({ type: 'join', name: 'Alice_CIEL', room: 'plateau-u300' }));
    await welcomeP;

    const wsSubP = waitForWsMsg(ws, (m) => m.type === 'formative_submit_result');
    ws.send(JSON.stringify({ type: 'formative_submit', tpId: 'fmt_ip_cidr', answers: fullAns }));
    const wsSubData = await wsSubP;
    assert.equal(wsSubData.ok, true);
    assert.equal(wsSubData.coinsEarned, 0);
    assert.equal(wsSubData.xpEarned, 0);
    assert.equal(wsSubData.rewardGranted, false);
    assert.equal(wsSubData.alreadyRewarded, true);
    assert.equal(wsSubData.coins, initialCoins + tp1.rewardCoins);

    const badTpRes = await fetch(`${baseUrl}/api/formative/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`
      },
      body: JSON.stringify({ tpId: 'tp_invalide_999', answers: {} })
    });
    assert.equal(badTpRes.status, 400);

    const wrongTokenRes = await fetch(`${baseUrl}/api/formative/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`
      },
      body: JSON.stringify({ tpId: 'fmt_ip_cidr', answers: fullAns, name: 'Alice_CIEL' })
    });
    assert.equal(wrongTokenRes.status, 403);
  } finally {
    ws?.close();
    wsHub.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Persistance disque Formative : sauvegarde partielle et récompense conservées après rechargement GameStore', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ciel-fmt-disk-'));
  const dbPath = path.join(tmpDir, 'db.json');
  const accountsPath = path.join(tmpDir, 'accounts.json');
  const mapPath = path.join(tmpDir, 'map.json');
  try {
    let startCoins = 0;
    const tp1 = getFormativeTpById('fmt_ip_cidr');
    const { server, wsHub } = createGameServer({ dbPath, accountsPath, mapPath });
    try {
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const { port } = server.address();
      const baseUrl = `http://127.0.0.1:${port}`;

      const reg = await (
        await fetch(`${baseUrl}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'Disk_CIEL', password: 'DiskPass77' })
        })
      ).json();
      const token = reg.token;
      startCoins = reg.profile.coins;

      await fetch(`${baseUrl}/api/formative/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tpId: 'fmt_ip_cidr', answers: buildValidAnswersForTp(tp1) })
      });

      await fetch(`${baseUrl}/api/formative/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tpId: 'fmt_vlan_trunk', answers: { q1_std: '802.1q' } })
      });
    } finally {
      wsHub.close();
      await new Promise((resolve) => server.close(resolve));
    }

    const reloadedStore = new GameStore(dbPath, { accountsPath });
    const reloadedProfile = reloadedStore.getPublicProfile('disk_ciel');
    const reloadedAccount = reloadedStore.getPublicAccount('Disk_CIEL');
    assert.ok(reloadedProfile);
    assert.ok(reloadedAccount);
    assert.equal(reloadedProfile.coins, startCoins + tp1.rewardCoins);
    assert.equal(reloadedProfile.coins, reloadedAccount.coins);
    assert.ok(reloadedProfile.formativeRewardedTps.includes('fmt_ip_cidr'));
    assert.equal(reloadedProfile.formativeProgress.fmt_ip_cidr.validated, true);
    assert.deepEqual(reloadedProfile.formativeProgress.fmt_vlan_trunk.answers, { q1_std: '802.1q' });

    const replayAfterReload = reloadedStore.recordFormativeProgress('Disk_CIEL', {
      tpId: 'fmt_ip_cidr',
      answers: buildValidAnswersForTp(tp1)
    });
    assert.equal(replayAfterReload.coinsEarned, 0);
    assert.equal(replayAfterReload.rewardGranted, false);
    assert.equal(replayAfterReload.alreadyRewarded, true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Outils CIEL : calculateIpv4Subnet, decodeResistor4Band et filterCommandMemo', () => {
  const s24 = calculateIpv4Subnet('192.168.1.42/24');
  assert.equal(s24.ok, true);
  assert.equal(s24.cidr, 24);
  assert.equal(s24.mask, '255.255.255.0');
  assert.equal(s24.network, '192.168.1.0');
  assert.equal(s24.broadcast, '192.168.1.255');
  assert.equal(s24.usableHosts, 254);

  const s26 = calculateIpv4Subnet('192.168.10.45/26');
  assert.equal(s26.ok, true);
  assert.equal(s26.cidr, 26);
  assert.equal(s26.mask, '255.255.255.192');
  assert.equal(s26.wildcard, '0.0.0.63');
  assert.equal(s26.network, '192.168.10.0');
  assert.equal(s26.broadcast, '192.168.10.63');
  assert.equal(s26.firstHost, '192.168.10.1');
  assert.equal(s26.lastHost, '192.168.10.62');
  assert.equal(s26.usableHosts, 62);

  const s30 = calculateIpv4Subnet('10.0.0.5', 30);
  assert.equal(s30.ok, true);
  assert.equal(s30.usableHosts, 2);
  assert.equal(s30.firstHost, '10.0.0.5');
  assert.equal(s30.lastHost, '10.0.0.6');

  const s31 = calculateIpv4Subnet('10.0.0.1', 31);
  assert.equal(s31.ok, true);
  assert.equal(s31.usableHosts, 2);
  assert.equal(s31.network, '10.0.0.0');
  assert.equal(s31.broadcast, '10.0.0.1');
  assert.equal(s31.firstHost, '10.0.0.0');
  assert.equal(s31.lastHost, '10.0.0.1');

  const s32 = calculateIpv4Subnet('172.16.8.9', 32);
  assert.equal(s32.ok, true);
  assert.equal(s32.usableHosts, 1);
  assert.equal(s32.firstHost, '172.16.8.9');
  assert.equal(s32.lastHost, '172.16.8.9');

  const sDecMask = calculateIpv4Subnet('192.168.10.45', '255.255.255.192');
  assert.equal(sDecMask.ok, true);
  assert.equal(sDecMask.cidr, 26);
  assert.equal(sDecMask.usableHosts, 62);

  assert.equal(calculateIpv4Subnet('999.1.1.1', 24).ok, false);
  assert.equal(calculateIpv4Subnet('192.168.1.1', '255.0.255.0').ok, false);

  const r1k = decodeResistor4Band('brown', 'black', 'red', 'gold');
  assert.equal(r1k.ok, true);
  assert.equal(r1k.ohms, 1000);
  assert.equal(r1k.formatted, '1 kΩ');
  assert.equal(r1k.toleranceLabel, '±5 %');

  const r4k7 = decodeResistor4Band('yellow', 'violet', 'red', 'brown');
  assert.equal(r4k7.ok, true);
  assert.equal(r4k7.ohms, 4700);
  assert.equal(r4k7.formatted, '4,7 kΩ');
  assert.equal(r4k7.toleranceLabel, '±1 %');

  const r220 = decodeResistor4Band('red', 'red', 'brown', 'gold');
  assert.equal(r220.ok, true);
  assert.equal(r220.ohms, 220);
  assert.equal(r220.formatted, '220 Ω');
  assert.equal(r220.toleranceLabel, '±5 %');

  assert.equal(decodeResistor4Band('gold', 'black', 'red', 'gold').ok, false);

  const ciscoList = filterCommandMemo('', 'cisco');
  assert.ok(ciscoList.length >= 3);
  assert.ok(ciscoList.every((e) => e.category === 'cisco'));

  const trunkSearch = filterCommandMemo('802.1Q', 'cisco');
  assert.ok(trunkSearch.some((e) => e.id === 'cmd_cisco_trunk'));

  const ufwSearch = filterCommandMemo('pare-feu', 'linux_sys');
  assert.ok(ufwSearch.some((e) => e.id === 'cmd_ufw'));
});

test('Campus Map Multi-Étages (2000m×2000m), PlateauMiniMap waypoint, Montre VR & Panneau Spatial Tablette VR', () => {
  const dom = setupMockDom();
  let wrist = null;
  let tpPanel = null;
  let vr = null;
  try {
    const campus2000 = createCampusMap(2000);
    assert.equal(campus2000.bounds.width, 2000);
    assert.equal(campus2000.bounds.depth, 2000);

    const floors = getAvailableFloors(campus2000);
    assert.equal(floors.length, 11);
    assert.equal(floors[0].floor, -2);
    assert.equal(floors[0].label, 'Sous-sol (-2)');
    assert.equal(floors[floors.length - 1].floor, 8);
    assert.equal(floors[floors.length - 1].label, 'Étage 8');

    const view = { centerX: 125, centerZ: -340, pxPerMeter: 0.45, width: 640, height: 420 };
    const ptScreen = worldToScreen(680, -790, view);
    const ptBack = screenToWorld(ptScreen.x, ptScreen.y, view);
    assert.ok(Math.abs(ptBack.x - 680) < 1e-6);
    assert.ok(Math.abs(ptBack.z - -790) < 1e-6);

    const minZoom = clampZoomScale(0.01, campus2000.bounds, 640, 420);
    const maxZoom = clampZoomScale(999, campus2000.bounds, 640, 420);
    assert.ok(minZoom >= 0.16 && minZoom < 1);
    assert.equal(maxZoom, 80);

    const defaultMap = createDefaultMap();
    const defEnts = extractMapEntities(defaultMap, 0);
    assert.ok(defEnts.zones.length > 0);
    assert.ok(defEnts.walls.length > 0);
    assert.ok(defEnts.teachers.length >= 1);
    assert.ok(defEnts.tpStations.length >= 5);

    const multiFloorMap = {
      ...campus2000,
      zones: [
        { id: 'Z_SS2', code: 'SS2', shortName: 'Local Technique', floor: -2, x: 10, z: 10, w: 8, d: 8, color: '#38bdf8' },
        { id: 'Z_E8', code: 'E801', shortName: 'Terrasse Antennes', floor: 8, x: -20, z: 30, w: 12, d: 10, color: '#10b981' }
      ],
      walls: [
        { id: 'W_E8', floor: 8, x1: -26, z1: 25, x2: -14, z2: 25, thickness: 0.2, kind: 'interior' }
      ],
      objects: [
        { id: 'ST_7_8', type: 'stair_straight', floor: 7, targetFloor: 8, x: 0, z: 0 },
        { id: 'TP_E8', type: 'tp_oscilloscope', floor: 8, x: -20, z: 30 }
      ]
    };
    const entsFloor8 = extractMapEntities(multiFloorMap, 8);
    assert.equal(entsFloor8.zones.length, 1);
    assert.equal(entsFloor8.walls.length, 1);
    assert.equal(entsFloor8.stairs.length, 1);
    assert.equal(entsFloor8.stairs[0].isArrival, true);
    assert.equal(entsFloor8.tpStations.length, 1);

    const navSame = computeWaypointNavigation({ x: 0, z: 0 }, 0, { x: 3, z: 4, floor: 0 });
    assert.equal(Math.round(navSame.distanceMeters), 5);
    assert.equal(navSame.deltaFloor, 0);
    assert.equal(navSame.floorInstruction, 'Même étage');

    const navUp = computeWaypointNavigation({ x: 0, z: 0 }, 0, { x: 0, z: 10, floor: 3 });
    assert.equal(navUp.deltaFloor, 3);
    assert.ok(navUp.floorInstruction.includes('Monter 3 étages'));

    const mapHost = dom.MockElement ? new dom.MockElement('div') : globalThis.document.createElement('div');
    let wpNotified = null;
    const mapApp = new CampusMapApp({
      mapData: multiFloorMap,
      onWaypointChange: (wp) => {
        wpNotified = wp;
      }
    });
    mapApp.mount(mapHost);
    mapApp.setFloor(8);
    assert.equal(mapApp.selectedFloor, 8);
    const setWp = mapApp.setWaypoint({ x: -20, z: 30, floor: 8, label: 'Terrasse E8' });
    assert.equal(setWp.floor, 8);
    assert.equal(wpNotified.label, 'Terrasse E8');
    mapApp.render();
    assert.ok(mapApp.ctx.ops.length > 10);
    mapApp.clearWaypoint();
    assert.equal(mapApp.getWaypoint(), null);
    assert.equal(wpNotified, null);
    mapApp.unmount();

    const miniCanvas = globalThis.document.createElement('canvas');
    miniCanvas.width = 248;
    miniCanvas.height = 232;
    const miniMap = new PlateauMiniMap(miniCanvas, defaultMap);
    miniMap.render({
      playerPos: { x: -3.95, z: 0.65 },
      playerYaw: 0,
      floor: 0,
      waypoint: { x: 4, z: -2, floor: 0, label: 'Oscilloscope' }
    });
    assert.ok(miniMap.ctx.ops.some((op) => op[0] === 'setLineDash'));

    wrist = createWristHudPanel({ name: 'VR_Student', mapData: defaultMap });
    const wristBoxes = wrist.getHitBoxes();
    const expectedWristIds = ['btn_mic', 'btn_tablet', 'btn_shop', 'btn_locker', 'btn_vr_exit'];
    for (const id of expectedWristIds) {
      const box = wristBoxes.find((b) => b.id === id);
      assert.ok(box, `Bouton montre VR manquant : ${id}`);
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.w <= 512 && box.y + box.h <= 480);
    }
    for (let i = 0; i < wristBoxes.length; i++) {
      for (let j = i + 1; j < wristBoxes.length; j++) {
        const a = wristBoxes[i];
        const b = wristBoxes[j];
        const overlaps = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
        assert.equal(overlaps, false, `Chevauchement montre VR entre ${a.id} et ${b.id}`);
      }
    }

    const mockScene = new THREE.Scene();
    const mockCam = new THREE.PerspectiveCamera(72, 1.77, 0.1, 100);
    const mockSceneMgr = {
      scene: mockScene,
      camera: mockCam,
      renderer: null,
      setVrPresentingState() {},
      bindVrManager() {}
    };
    const stubCanvas = globalThis.document.createElement('canvas');
    const player = new PlayerController(mockCam, stubCanvas, []);
    vr = new VRManager(mockSceneMgr, player, { playerName: 'VR_Student', mapData: defaultMap });
    vr.enterSimulationMode();

    const spatial = vr.openTabletSpatialPanel({
      playerName: 'VR_Student',
      coins: 320,
      mapData: defaultMap,
      formativeProgress: {},
      formativeRewardedTps: []
    });
    assert.ok(spatial);
    assert.equal(vr.isTabletSpatialPanelOpen(), true);
    assert.equal(spatial.getState().mode, 'tablet');

    const hitIds = (panel) => new Set(panel.getHitBoxes().map((b) => b.id));
    const clickBox = (panel, id) => {
      const box = panel.getHitBoxes().find((b) => b.id === id);
      assert.ok(box, `Hitbox manquante : ${id}`);
      const uv = {
        x: (box.x + box.w / 2) / panel.canvasW,
        y: 1 - (box.y + box.h / 2) / panel.canvasH
      };
      const tested = panel.hitTestUv(uv);
      assert.equal(tested.id, id);
      box.onClick(uv);
    };

    const homeIds = hitIds(spatial);
    assert.ok(homeIds.has('vr_tablet_tile_formative'));
    assert.ok(homeIds.has('vr_tablet_tile_map'));
    assert.ok(homeIds.has('vr_tablet_tile_grades'));
    assert.ok(homeIds.has('vr_tablet_tile_tools'));
    assert.ok(homeIds.has('vr_tablet_nav_back'));
    assert.ok(homeIds.has('vr_tablet_nav_home'));
    assert.ok(homeIds.has('vr_tablet_nav_close'));

    clickBox(spatial, 'vr_tablet_tile_formative');
    assert.ok(hitIds(spatial).has('vr_tablet_fmt_open_fmt_ip_cidr'));
    clickBox(spatial, 'vr_tablet_fmt_open_fmt_ip_cidr');
    assert.ok(hitIds(spatial).has('vr_tablet_fmt_back'));
    clickBox(spatial, 'vr_tablet_nav_back');
    assert.ok(hitIds(spatial).has('vr_tablet_fmt_open_fmt_ip_cidr'));

    clickBox(spatial, 'vr_tablet_nav_home');
    assert.ok(hitIds(spatial).has('vr_tablet_tile_map'));

    clickBox(spatial, 'vr_tablet_tile_map');
    assert.ok(hitIds(spatial).has('vr_tablet_map_fl_up'));

    clickBox(spatial, 'vr_tablet_nav_home');
    clickBox(spatial, 'vr_tablet_tile_grades');
    assert.ok(hitIds(spatial).has('vr_tablet_nav_back'));

    clickBox(spatial, 'vr_tablet_nav_home');
    clickBox(spatial, 'vr_tablet_tile_tools');
    assert.ok(hitIds(spatial).has('vr_tablet_tools_tab_subnet'));
    assert.ok(hitIds(spatial).has('vr_tablet_tools_tab_resistor'));
    assert.ok(hitIds(spatial).has('vr_tablet_tools_tab_memo'));
    clickBox(spatial, 'vr_tablet_tools_tab_resistor');
    assert.ok(hitIds(spatial).has('vr_tablet_tools_band_0_next'));
    clickBox(spatial, 'vr_tablet_tools_tab_memo');
    assert.ok(hitIds(spatial).has('vr_tablet_tools_memo_cat_cisco'));

    clickBox(spatial, 'vr_tablet_nav_back');
    assert.ok(hitIds(spatial).has('vr_tablet_tile_formative'));

    clickBox(spatial, 'vr_tablet_nav_close');
    assert.equal(vr.isTabletSpatialPanelOpen(), false);

    tpPanel = createTpSpatialPanel();
    tpPanel.updateState({ mode: 'tablet', tablet: { app: 'tools', playerName: 'VR_Solo' } }, { immediate: true });
    assert.equal(tpPanel.getState().mode, 'tablet');
    assert.ok(hitIds(tpPanel).has('vr_tablet_tools_tab_subnet'));
  } finally {
    tpPanel?.dispose();
    wrist?.dispose();
    vr?.dispose();
    dom.restore();
  }
});

test('Notes & Suivi : buildGradesSummary calcule moyenne Formative, moyenne Atelier 3D, moyenne générale et badges', () => {
  const tp1 = getFormativeTpById('fmt_ip_cidr');
  const tp2 = getFormativeTpById('fmt_vlan_trunk');
  const gs = {
    formativeProgress: {
      fmt_ip_cidr: {
        tpId: 'fmt_ip_cidr',
        answers: buildValidAnswersForTp(tp1),
        validated: true,
        rewarded: true
      },
      fmt_vlan_trunk: {
        tpId: 'fmt_vlan_trunk',
        answers: { q1_std: '802.1q', q2_ios: 'switchport access vlan 20' },
        validated: false,
        rewarded: false
      }
    },
    formativeRewardedTps: ['fmt_ip_cidr'],
    profile: {
      grades: {
        oscilloscope: 18,
        soldering: 16
      }
    }
  };

  const summary = buildGradesSummary(gs);
  assert.equal(summary.formative.averageScore, 15);
  assert.equal(summary.workshopAverage, 17);
  assert.equal(summary.workshopCompletedCount, 2);
  assert.equal(summary.globalAverage, 16);
  assert.ok(summary.mention.includes('Très Bien'));
  assert.equal(summary.unlockedBadgesCount, 1);
  assert.equal(summary.totalBadgesCount, 7);
});

test('Audit automatisé v4.36 : zéro commentaire JS/CSS/HTML, zéro nom interdit, DOM IDs tablette, 2 boutons .hud-actions et version v4.36', () => {
  const scanJsComments = (src) => {
    const comments = [];
    let i = 0;
    const n = src.length;
    let line = 1;
    let lastNonWsToken = '';
    let wordBuf = '';
    const tplStack = [];
    const regexAllowedAfter = new Set([
      '', '(', '[', '{', ',', ';', ':', '=', '!', '&', '|', '?', '+', '-', '*', '%', '^', '~', '<', '>', '\n'
    ]);
    const regexKeywordAfter = new Set([
      'return', 'typeof', 'void', 'delete', 'throw', 'case', 'in', 'of', 'instanceof', 'new', 'else', 'do', 'yield', 'await'
    ]);

    while (i < n) {
      const ch = src[i];
      const next = src[i + 1];
      if (ch === '\n') {
        line++;
        i++;
        continue;
      }
      if (tplStack.length > 0 && tplStack[tplStack.length - 1] === 'tpl') {
        if (ch === '\\') {
          i += 2;
          continue;
        }
        if (ch === '`') {
          tplStack.pop();
          lastNonWsToken = '`';
          i++;
          continue;
        }
        if (ch === '$' && next === '{') {
          tplStack.push('expr', 1);
          lastNonWsToken = '{';
          i += 2;
          continue;
        }
        i++;
        continue;
      }
      if (ch === ' ' || ch === '\t' || ch === '\r') {
        i++;
        continue;
      }
      if (ch === '/' && next === '/') {
        comments.push({ line, text: src.slice(i, i + 40) });
        const end = src.indexOf('\n', i + 2);
        i = end === -1 ? n : end;
        continue;
      }
      if (ch === '/' && next === '*') {
        comments.push({ line, text: src.slice(i, i + 40) });
        const closeIdx = src.indexOf('*/', i + 2);
        i = closeIdx === -1 ? n : closeIdx + 2;
        continue;
      }
      if (ch === '"' || ch === "'") {
        const q = ch;
        i++;
        while (i < n) {
          if (src[i] === '\\') {
            i += 2;
            continue;
          }
          if (src[i] === '\n') line++;
          if (src[i] === q) {
            i++;
            break;
          }
          i++;
        }
        lastNonWsToken = q;
        wordBuf = '';
        continue;
      }
      if (ch === '`') {
        tplStack.push('tpl');
        i++;
        wordBuf = '';
        continue;
      }
      if (ch === '/') {
        const canRegex = regexAllowedAfter.has(lastNonWsToken) || regexKeywordAfter.has(wordBuf);
        if (canRegex) {
          i++;
          let inClass = false;
          while (i < n) {
            if (src[i] === '\\') {
              i += 2;
              continue;
            }
            if (src[i] === '[') {
              inClass = true;
              i++;
              continue;
            }
            if (src[i] === ']') {
              inClass = false;
              i++;
              continue;
            }
            if (src[i] === '\n') break;
            if (src[i] === '/' && !inClass) {
              i++;
              break;
            }
            i++;
          }
          while (i < n && /[a-z]/i.test(src[i])) i++;
          lastNonWsToken = '/';
          wordBuf = '';
          continue;
        }
      }
      if (tplStack.length >= 2 && tplStack[tplStack.length - 2] === 'expr') {
        if (ch === '{') tplStack[tplStack.length - 1]++;
        else if (ch === '}') {
          tplStack[tplStack.length - 1]--;
          if (tplStack[tplStack.length - 1] === 0) {
            tplStack.pop();
            tplStack.pop();
            lastNonWsToken = '}';
            wordBuf = '';
            i++;
            continue;
          }
        }
      }
      if (/[a-zA-Z0-9_$]/.test(ch)) {
        let j = i;
        while (j < n && /[a-zA-Z0-9_$]/.test(src[j])) j++;
        wordBuf = src.slice(i, j);
        lastNonWsToken = wordBuf;
        i = j;
        continue;
      }
      wordBuf = '';
      lastNonWsToken = ch;
      i++;
    }
    return comments;
  };

  const scanCssComments = (src) => {
    const out = [];
    let i = 0;
    let line = 1;
    while (i < src.length) {
      const ch = src[i];
      if (ch === '\n') {
        line++;
        i++;
        continue;
      }
      if (ch === '"' || ch === "'") {
        const q = ch;
        i++;
        while (i < src.length) {
          if (src[i] === '\\') {
            i += 2;
            continue;
          }
          if (src[i] === '\n') line++;
          if (src[i] === q) {
            i++;
            break;
          }
          i++;
        }
        continue;
      }
      if (ch === '/' && src[i + 1] === '*') {
        out.push({ line, text: src.slice(i, i + 40) });
        const end = src.indexOf('*/', i + 2);
        i = end === -1 ? src.length : end + 2;
        continue;
      }
      i++;
    }
    return out;
  };

  const scanHtmlComments = (src) => {
    const out = [];
    const marker = '<' + '!--';
    let idx = 0;
    while ((idx = src.indexOf(marker, idx)) !== -1) {
      out.push({ line: src.slice(0, idx).split('\n').length });
      idx += marker.length;
    }
    return out;
  };

  const jsFiles = [
    'src/core/formativeCatalog.js',
    'src/core/gameState.js',
    'src/core/network.js',
    'src/main.js',
    'src/ui/ChangelogModal.js',
    'src/ui/HudManager.js',
    'src/ui/PlateauMiniMap.js',
    'src/ui/TabletOS.js',
    'src/ui/TouchControls.js',
    'src/ui/tablet/CampusMapApp.js',
    'src/ui/tablet/CielToolsApp.js',
    'src/ui/tablet/CielToolsLogic.js',
    'src/ui/tablet/FormativeApp.js',
    'src/ui/tablet/GradesApp.js',
    'src/vr/VRHudPanel.js',
    'src/vr/VRManager.js',
    'server/index.js',
    'server/store.js',
    'server/wsHub.js',
    'vite.config.js',
    'tests/tablet-formative.test.js'
  ];

  const forbiddenPattern = new RegExp('for' + 'tin', 'i');

  for (const rel of jsFiles) {
    const txt = fs.readFileSync(path.resolve(rel), 'utf8');
    const foundComments = scanJsComments(txt);
    assert.deepEqual(foundComments, [], `Commentaire détecté dans ${rel}`);
    assert.equal(forbiddenPattern.test(txt), false, `Nom interdit détecté dans ${rel}`);
  }

  const tabletCss = fs.readFileSync(path.resolve('src/styles/tablet.css'), 'utf8');
  assert.deepEqual(scanCssComments(tabletCss), [], 'Commentaire CSS détecté dans src/styles/tablet.css');
  assert.equal(forbiddenPattern.test(tabletCss), false);

  const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');
  assert.deepEqual(scanHtmlComments(indexHtml), [], 'Commentaire HTML détecté dans index.html');
  assert.equal(forbiddenPattern.test(indexHtml), false);

  for (const domId of ['tablet-os-overlay', 'touch-btn-tablet', 'btn-tablet-settings']) {
    assert.ok(indexHtml.includes(`id="${domId}"`), `ID manquant dans index.html : ${domId}`);
  }

  const hudActionsMatch = indexHtml.match(/<div class="hud-actions">([\s\S]*?)<\/div>/);
  assert.ok(hudActionsMatch, 'Bloc .hud-actions introuvable dans index.html');
  const hudActionButtons = hudActionsMatch[1].match(/<button\b/g) || [];
  assert.equal(hudActionButtons.length, 2);

  const viteSrc = fs.readFileSync(path.resolve('vite.config.js'), 'utf8');
  assert.ok(viteSrc.includes('v4.41'));
  assert.ok(APP_VERSION.startsWith('v4.41'));
  assert.ok(CHANGELOG_RELEASES[0].version.startsWith('v4.41'));
  assert.equal(CHANGELOG_RELEASES[0].tag, 'DERNIÈRE MÀJ');
});
