import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  JPO_DEMO_COINS,
  JPO_KIOSK_IDLE_MS,
  JPO_KIOSK_STORAGE_KEY,
  JPO_ROOM_STORAGE_KEY,
  JPO_ROOMS,
  createJpoRoomMap,
  createJpoVisitorName,
  createKioskIdleController,
  getJpoHudVisibility,
  getJpoRoomConfig,
  isJpoRoomActive,
  normalizeJpoRoom,
  readJpoConfig,
  resolveJpoSpawnPose,
  saveJpoConfig
} from '../src/core/jpoConfig.js';
import { createDefaultMap, getDynamicMapColliders } from '../src/world/mapSchema.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, val) {
      map.set(key, String(val));
    },
    removeItem(key) {
      map.delete(key);
    }
  };
}

function scanJsComments(src) {
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
    if (ch === "'" || ch === '"') {
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
      wordBuf = '';
      lastNonWsToken = q;
      continue;
    }
    if (ch === '`') {
      tplStack.push('tpl');
      wordBuf = '';
      lastNonWsToken = '`';
      i++;
      continue;
    }
    if (ch === '/' && next === '/') {
      comments.push({ line, kind: '//' });
      const nl = src.indexOf('\n', i);
      i = nl === -1 ? n : nl;
      continue;
    }
    if (ch === '/' && next === '*') {
      comments.push({ line, kind: '/*' });
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (ch === '/' && (regexAllowedAfter.has(lastNonWsToken) || regexKeywordAfter.has(wordBuf))) {
      i++;
      let inClass = false;
      while (i < n) {
        if (src[i] === '\\') {
          i += 2;
          continue;
        }
        if (src[i] === '[') inClass = true;
        else if (src[i] === ']') inClass = false;
        else if (src[i] === '/' && !inClass) {
          i++;
          while (i < n && /[a-z]/i.test(src[i])) i++;
          break;
        } else if (src[i] === '\n') {
          line++;
          break;
        }
        i++;
      }
      wordBuf = '';
      lastNonWsToken = '/';
      continue;
    }
    if (tplStack.length > 0 && tplStack[tplStack.length - 1] !== 'tpl') {
      if (ch === '{') {
        tplStack[tplStack.length - 1]++;
      } else if (ch === '}') {
        tplStack[tplStack.length - 1]--;
        if (tplStack[tplStack.length - 1] === 0) {
          tplStack.pop();
          if (tplStack[tplStack.length - 1] === 'expr') {
            tplStack.pop();
          }
          lastNonWsToken = '}';
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
}

function scanCssComments(src) {
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
      out.push({ line });
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    i++;
  }
  return out;
}

function scanHtmlComments(src) {
  const out = [];
  const marker = '<' + '!--';
  let idx = 0;
  while ((idx = src.indexOf(marker, idx)) !== -1) {
    out.push({ line: src.slice(0, idx).split('\n').length });
    idx += marker.length;
  }
  return out;
}

test('jpoConfig : constantes, normalisation et persistance localStorage', () => {
  assert.equal(JPO_ROOM_STORAGE_KEY, 'ciel_jpo_salle');
  assert.equal(JPO_KIOSK_STORAGE_KEY, 'ciel_jpo_kiosk');
  assert.equal(JPO_KIOSK_IDLE_MS, 60000);
  assert.equal(JPO_DEMO_COINS, 0);

  assert.equal(normalizeJpoRoom('CYBER'), 'cyber');
  assert.equal(normalizeJpoRoom('reseau'), 'reseau');
  assert.equal(normalizeJpoRoom('elec'), 'elec');
  assert.equal(normalizeJpoRoom('inconnue'), 'standard');
  assert.equal(isJpoRoomActive('standard'), false);
  assert.equal(isJpoRoomActive('cyber'), true);

  const storage = createMemoryStorage();
  assert.deepEqual(readJpoConfig(storage), { room: 'standard', kiosk: false });

  saveJpoConfig({ room: 'cyber', kiosk: true }, storage);
  assert.equal(storage.getItem('ciel_jpo_salle'), 'cyber');
  assert.equal(storage.getItem('ciel_jpo_kiosk'), '1');
  assert.deepEqual(readJpoConfig(storage), { room: 'cyber', kiosk: true });

  saveJpoConfig({ room: 'elec' }, storage);
  assert.deepEqual(readJpoConfig(storage), { room: 'elec', kiosk: true });

  const visitor = createJpoVisitorName('reseau', () => 0.5);
  assert.ok(visitor.startsWith('Visiteur_Reseau_'));
  assert.equal(getJpoRoomConfig('cyber').tpId, 'antivirus');
  assert.equal(getJpoRoomConfig('reseau').tpId, 'vmvlan');
  assert.equal(getJpoRoomConfig('elec').tpId, 'electronics');
  assert.equal(JPO_ROOMS.cyber.demoCoins, 0);
  assert.equal(JPO_ROOMS.reseau.demoCoins, 0);
  assert.equal(JPO_ROOMS.elec.demoCoins, 0);
});

test('jpoConfig : resolveJpoSpawnPose place directement au pôle Cyber, Réseau et Élec', () => {
  const defaultMap = createDefaultMap();
  const cyberPose = resolveJpoSpawnPose(defaultMap, 'cyber');
  assert.equal(cyberPose.roomCode, 'U305');
  assert.equal(cyberPose.tpId, 'antivirus');
  assert.ok(Math.abs(cyberPose.pos.x - 7.8) < 3.5);
  assert.ok(cyberPose.pos.z > 3.5);

  const reseauPose = resolveJpoSpawnPose(defaultMap, 'reseau');
  assert.equal(reseauPose.roomCode, 'U307');
  assert.equal(reseauPose.tpId, 'vmvlan');
  assert.ok(reseauPose.pos.x < -2.9);
  assert.ok(reseauPose.pos.z > 1.8);

  const elecPose = resolveJpoSpawnPose(defaultMap, 'elec');
  assert.equal(elecPose.roomCode, 'U302');
  assert.equal(elecPose.tpId, 'electronics');
  assert.ok(elecPose.pos.z < -3.0);
});

test('jpoConfig : createKioskIdleController réinitialise après 60s et reporte sur activité', () => {
  let now = 1000;
  let timeouts = 0;
  let intervalFn = null;
  let cleared = false;

  const ctrl = createKioskIdleController({
    timeoutMs: 60000,
    onTimeout: () => {
      timeouts++;
    },
    nowFn: () => now,
    setIntervalFn: (fn) => {
      intervalFn = fn;
      return 42;
    },
    clearIntervalFn: (id) => {
      if (id === 42) cleared = true;
    }
  });

  ctrl.start();
  assert.equal(ctrl.isActive(), true);
  assert.equal(typeof intervalFn, 'function');

  now += 45000;
  assert.equal(ctrl.tick(), false);
  assert.equal(ctrl.getRemainingMs(), 15000);
  assert.equal(timeouts, 0);

  ctrl.touch();
  assert.equal(ctrl.getRemainingMs(), 60000);

  now += 60000;
  assert.equal(ctrl.tick(), true);
  assert.equal(timeouts, 1);

  ctrl.stop();
  assert.equal(ctrl.isActive(), false);
  assert.equal(cleared, true);
});

test('Portes Ouvertes v4.39 : visibilité HUD, salle dédiée fermée et préservation du mode standard', () => {
  assert.equal(createJpoRoomMap('standard'), null);
  assert.equal(createJpoRoomMap('unknown'), null);

  const stdVis = getJpoHudVisibility('standard', false);
  assert.deepEqual(stdVis, {
    isJpo: false,
    requireAuth: true,
    showBanner: false,
    showNewVisitBtn: false,
    showCoins: true,
    showShop: true,
    showMinimap: true,
    showQuestPanel: true,
    showTopBar: true
  });

  const stdMap = createDefaultMap();
  assert.ok(stdMap.zones.length >= 6);
  assert.ok(stdMap.walls.length >= 10);

  const expectedTpType = {
    cyber: 'tp_antivirus',
    reseau: 'tp_vmvlan',
    elec: 'tp_electronics'
  };

  for (const roomId of ['cyber', 'reseau', 'elec']) {
    const jpoVis = getJpoHudVisibility(roomId, false);
    assert.deepEqual(jpoVis, {
      isJpo: true,
      requireAuth: false,
      showBanner: true,
      showNewVisitBtn: true,
      showCoins: false,
      showShop: false,
      showMinimap: false,
      showQuestPanel: false,
      showTopBar: false
    });

    const roomMap = createJpoRoomMap(roomId);
    assert.ok(roomMap, `Salle dédiée manquante pour ${roomId}`);
    assert.equal(roomMap.jpoIsolated, true);
    assert.equal(roomMap.bounds.width, 12);
    assert.equal(roomMap.bounds.depth, 12);
    assert.equal(roomMap.walls.length, 4);
    assert.ok(roomMap.walls.every((w) => w.kind === 'solid'));
    assert.equal(roomMap.zones.length, 1);

    const doorTypes = new Set(['door_single', 'door_double', 'survival_door', 'combat_door']);
    assert.equal(
      roomMap.objects.some((o) => doorTypes.has(o.type)),
      false,
      `Aucune porte de sortie ne doit exister dans la salle ${roomId}`
    );

    const tpObj = roomMap.objects.find((o) => o.type === expectedTpType[roomId]);
    assert.ok(tpObj, `Poste TP ${expectedTpType[roomId]} manquant dans la salle ${roomId}`);

    const pose = resolveJpoSpawnPose(roomMap, roomId);
    assert.ok(pose.pos.x > roomMap.bounds.minX && pose.pos.x < roomMap.bounds.maxX);
    assert.ok(pose.pos.z > roomMap.bounds.minZ && pose.pos.z < roomMap.bounds.maxZ);

    const colliders = getDynamicMapColliders(roomMap);
    const perimeterWallColliders = colliders.filter(
      (c) => Math.abs(c.minX - (-6)) < 0.4 || Math.abs(c.maxX - 6) < 0.4 || Math.abs(c.minZ - (-6)) < 0.4 || Math.abs(c.maxZ - 6) < 0.4
    );
    assert.ok(perimeterWallColliders.length >= 4, `Colliders de fermeture manquants pour ${roomId}`);
  }
});

test('Portes Ouvertes v4.39 : contournement login, HUD épuré, isolation LabBuilder, zéro commentaire et zéro nom interdit', () => {
  const adminHtml = fs.readFileSync(path.resolve('admin.html'), 'utf8');
  for (const needle of [
    'id="admin-tab-jpo"',
    'id="admin-panel-jpo"',
    'id="jpo-active-status-card"',
    'id="jpo-room-selector"',
    'data-jpo-room="standard"',
    'data-jpo-room="cyber"',
    'data-jpo-room="reseau"',
    'data-jpo-room="elec"',
    'id="jpo-kiosk-toggle"',
    'Activer le Mode Kiosque',
    'id="btn-jpo-launch"',
    'Lancer le jeu dans cette salle',
    'Salle dédiée fermée',
    'Zéro connexion'
  ]) {
    assert.ok(adminHtml.includes(needle), `Élément manquant dans admin.html : ${needle}`);
  }
  assert.equal(adminHtml.includes('500 🪙 CC démo'), false);
  assert.deepEqual(scanHtmlComments(adminHtml), []);

  const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');
  for (const needle of [
    'id="hud-jpo-banner"',
    'id="hud-jpo-room-label"',
    'id="btn-jpo-open-tp"',
    'id="btn-jpo-new-visit"',
    'Nouvelle visite'
  ]) {
    assert.ok(indexHtml.includes(needle), `Élément manquant dans index.html : ${needle}`);
  }
  assert.deepEqual(scanHtmlComments(indexHtml), []);

  const hudActionsMatch = indexHtml.match(/<div class="hud-actions">([\s\S]*?)<\/div>/);
  assert.ok(hudActionsMatch);
  const hudActionButtons = hudActionsMatch[1].match(/<button\b/g) || [];
  assert.equal(hudActionButtons.length, 2);

  const mainMenuSrc = fs.readFileSync(path.resolve('src/ui/MainMenu.js'), 'utf8');
  assert.ok(mainMenuSrc.includes('isJpoRoomActive(initialJpoCfg.room)'));
  assert.ok(mainMenuSrc.includes('isJpoRoomActive(jpoCfg.room)'));

  const hudSrc = fs.readFileSync(path.resolve('src/ui/HudManager.js'), 'utf8');
  assert.ok(hudSrc.includes('getJpoHudVisibility'));
  assert.ok(hudSrc.includes("classList.toggle('jpo-active'"));
  assert.ok(hudSrc.includes("classList.toggle('jpo-mode'"));

  const mainSrc = fs.readFileSync(path.resolve('src/main.js'), 'utf8');
  assert.ok(mainSrc.includes('createJpoRoomMap'));
  assert.ok(mainSrc.includes('if (isJpoDemoActive()) {\n    return;\n  }'));
  assert.ok(mainSrc.includes('if (isJpoDemoActive()) return false;'));

  const labSrc = fs.readFileSync(path.resolve('src/world/LabBuilder.js'), 'utf8');
  assert.ok(labSrc.includes('skipCombatFallback'));

  const mainCss = fs.readFileSync(path.resolve('src/styles/main.css'), 'utf8');
  assert.ok(mainCss.includes('.hud.jpo-active .hud-top'));
  assert.ok(mainCss.includes('.hud.jpo-active #minimap-panel'));
  assert.ok(mainCss.includes('.hud.jpo-active #hud-coins-pill'));

  const forbiddenPattern = new RegExp('for' + 'tin', 'i');
  for (const rel of [
    'src/core/jpoConfig.js',
    'src/admin/admin.js',
    'src/ui/MainMenu.js',
    'src/ui/HudManager.js',
    'src/main.js',
    'src/world/LabBuilder.js',
    'src/ui/ChangelogModal.js',
    'vite.config.js',
    'tests/jpo-doors.test.js'
  ]) {
    const txt = fs.readFileSync(path.resolve(rel), 'utf8');
    assert.deepEqual(scanJsComments(txt), [], `Commentaire JS détecté dans ${rel}`);
    assert.equal(forbiddenPattern.test(txt), false, `Nom interdit détecté dans ${rel}`);
  }

  for (const cssRel of ['src/admin/admin.css', 'src/styles/main.css']) {
    const css = fs.readFileSync(path.resolve(cssRel), 'utf8');
    assert.deepEqual(scanCssComments(css), [], `Commentaire CSS détecté dans ${cssRel}`);
    assert.equal(forbiddenPattern.test(css), false, `Nom interdit détecté dans ${cssRel}`);
  }

  assert.equal(forbiddenPattern.test(adminHtml), false);
  assert.equal(forbiddenPattern.test(indexHtml), false);
});
