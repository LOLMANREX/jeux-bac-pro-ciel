import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as THREE from 'three';
import {
  JPO_AUTO_START_TP,
  JPO_BRIEFING_RESUME_LABEL,
  JPO_BRIEFING_START_LABEL,
  JPO_DEMO_COINS,
  JPO_HELP_BUTTON_LABEL,
  JPO_INTERACT_PROMPT_TEXT,
  JPO_KIOSK_IDLE_MS,
  JPO_KIOSK_STORAGE_KEY,
  JPO_MISSION_BRIEFINGS,
  JPO_ROOM_STORAGE_KEY,
  JPO_ROOMS,
  JPO_WELCOME_BADGE,
  JPO_WELCOME_PLAY_LABEL,
  JPO_WELCOME_SCREENS,
  createJpoRoomMap,
  createJpoVisitorName,
  createKioskIdleController,
  getJpoHudVisibility,
  getJpoMissionBriefing,
  getJpoRoomConfig,
  getJpoWelcomeScreen,
  isJpoActive,
  isJpoRoomActive,
  normalizeJpoRoom,
  buildJpoRoomUrl,
  readJpoConfigFromSearch,
  readJpoConfig,
  resolveJpoSpawnPose,
  saveJpoConfig,
  shouldShowJpoWelcome
} from '../src/core/jpoConfig.js';
import {
  JPO_AV_TARGET,
  evaluateJpoAudiovisuelState
} from '../src/minigames/JpoAudiovisuelGame.js';
import { JpoBriefingModal } from '../src/ui/JpoBriefingModal.js';
import { JpoWelcomeModal } from '../src/ui/JpoWelcomeModal.js';
import { buildLabWorld } from '../src/world/LabBuilder.js';
import { createDefaultMap, getDynamicMapColliders, normalizeMapData } from '../src/world/mapSchema.js';

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
  assert.equal(getJpoRoomConfig('elec').tpId, 'soldering');
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
  assert.equal(elecPose.tpId, 'soldering');
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
    elec: 'tp_soldering',
    audiovisuel: 'tp_audiovisual'
  };

  for (const roomId of ['cyber', 'reseau', 'elec', 'audiovisuel']) {
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
    'id="jpo-room-links"'
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

test('Portes Ouvertes v4.40 : absence totale du portail Arène de Combat en mode JPO et préservation en mode standard', () => {
  const mem = createMemoryStorage();
  assert.equal(isJpoActive(mem), false);
  mem.setItem('ciel_jpo_salle', 'standard');
  assert.equal(isJpoActive(mem), false);
  for (const roomId of ['cyber', 'reseau', 'elec', 'audiovisuel']) {
    mem.setItem('ciel_jpo_salle', roomId);
    assert.equal(isJpoActive(mem), true);
  }

  for (const roomId of ['cyber', 'reseau', 'elec', 'audiovisuel']) {
    const rawJpoMap = createJpoRoomMap(roomId);
    const normalizedJpoMap = normalizeMapData(rawJpoMap);
    assert.equal(normalizedJpoMap.jpoIsolated, true);
    assert.equal(normalizedJpoMap.id, `jpo-room-${roomId}`);

    const lab = buildLabWorld(new THREE.Scene(), rawJpoMap, { hideSprites: true });
    try {
      assert.equal(lab.combatDoors.length, 0, `Aucun portail combat ne doit exister en salle ${roomId}`);
      assert.equal(
        lab.interactables.some(
          (it) => it?.type === 'combat_door' || /AR[ÈE]NE DE COMBAT/i.test(String(it?.label || ''))
        ),
        false,
        `Aucun trigger Arène de Combat ne doit exister dans interactables pour ${roomId}`
      );

      lab.rebuildWorld(createJpoRoomMap(roomId));
      assert.equal(lab.combatDoors.length, 0);
      assert.equal(
        lab.interactables.some((it) => it?.type === 'combat_door'),
        false
      );
    } finally {
      lab.dispose();
    }
  }

  const prevDesc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const mockLocalStorage = createMemoryStorage();
  const prevLocDesc = Object.getOwnPropertyDescriptor(globalThis, 'location');
  const mockLocation = { search: '' };
  Object.defineProperty(globalThis, 'location', { configurable: true, writable: true, value: mockLocation });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: mockLocalStorage
  });
  try {
    for (const roomId of ['cyber', 'reseau', 'elec', 'audiovisuel']) {
      mockLocation.search = `?salle=${roomId}`;
      assert.equal(isJpoActive(), true);
      const mapWithCombatDoor = createDefaultMap();
      assert.ok(mapWithCombatDoor.objects.some((o) => o.type === 'combat_door'));

      const labWithStorage = buildLabWorld(new THREE.Scene(), mapWithCombatDoor, { hideSprites: true });
      try {
        assert.equal(labWithStorage.combatDoors.length, 0);
        assert.equal(
          labWithStorage.interactables.some((it) => it?.type === 'combat_door'),
          false
        );
      } finally {
        labWithStorage.dispose();
      }
    }

    mockLocation.search = '';
    mockLocalStorage.setItem('ciel_jpo_salle', 'cyber');
    assert.equal(isJpoActive(), false);

    const stdLab = buildLabWorld(new THREE.Scene(), createDefaultMap(), { hideSprites: true });
    try {
      assert.ok(stdLab.combatDoors.length >= 1);
      assert.ok(stdLab.interactables.some((it) => it?.type === 'combat_door'));
    } finally {
      stdLab.dispose();
    }

    const fallbackMap = createDefaultMap();
    fallbackMap.objects = fallbackMap.objects.filter((o) => o.type !== 'combat_door');
    const stdFallbackLab = buildLabWorld(new THREE.Scene(), fallbackMap, { hideSprites: true });
    try {
      assert.ok(stdFallbackLab.combatDoors.length >= 1);
      assert.ok(stdFallbackLab.interactables.some((it) => it?.type === 'combat_door'));
    } finally {
      stdFallbackLab.dispose();
    }
  } finally {
    if (prevLocDesc) {
      Object.defineProperty(globalThis, 'location', prevLocDesc);
    } else {
      delete globalThis.location;
    }
    if (prevDesc) {
      Object.defineProperty(globalThis, 'localStorage', prevDesc);
    } else {
      delete globalThis.localStorage;
    }
  }

  const mainSrc = fs.readFileSync(path.resolve('src/main.js'), 'utf8');
  assert.ok(mainSrc.includes('if (!joined || activeCinematic || isJpoDemoActive() || (!privateDebugMode && isJpoActive())) return;'));
  assert.ok(mainSrc.includes("return lab.interactables.filter((it) => it?.type !== 'combat_door');"));
  assert.ok(mainSrc.includes('skipCombatFallback: initialJpoActive'));

  const hudSrc = fs.readFileSync(path.resolve('src/ui/HudManager.js'), 'utf8');
  assert.ok(hudSrc.includes("if (!target || this.detentionHudHidden || (this.isJpoActive() && target.type === 'combat_door'))"));
});

test('Portes Ouvertes v4.41 : spawn libre sans auto-lancement, briefing vulgarisé (E), aide & lisibilité HUD JPO', () => {
  assert.equal(JPO_AUTO_START_TP, false);
  assert.equal(JPO_INTERACT_PROMPT_TEXT, "Appuyez sur [E] pour démarrer l'activité");
  assert.equal(JPO_BRIEFING_START_LABEL, "🚀 C'est parti !");
  assert.equal(JPO_BRIEFING_RESUME_LABEL, "✅ Reprendre l'activité");
  assert.equal(JPO_HELP_BUTTON_LABEL, '❓ Aide / Consignes');

  assert.deepEqual(Object.keys(JPO_MISSION_BRIEFINGS).sort(), ['antivirus', 'audiovisual', 'soldering', 'vmvlan']);

  const cyberBrief = getJpoMissionBriefing('tp_antivirus');
  assert.equal(cyberBrief.title, '🛡️ Mission Cyber : Protège le réseau du lycée !');
  assert.equal(cyberBrief.intro, 'Un pirate attaque les ordinateurs du lycée. Ton objectif en 3 étapes simples :');
  assert.equal(cyberBrief.steps.length, 3);
  assert.equal(cyberBrief.steps[0].lead, 'Coupe le câble');
  assert.equal(cyberBrief.steps[1].lead, 'Bloque les intrus');
  assert.equal(cyberBrief.steps[2].lead, "Lance l'antivirus");
  assert.equal(getJpoMissionBriefing('antivirus'), cyberBrief);
  assert.equal(getJpoMissionBriefing('cyber'), cyberBrief);

  const netBrief = getJpoMissionBriefing('tp_vmvlan');
  assert.equal(netBrief.title, '🌐 Mission Réseau : Connecte les salles du lycée !');
  assert.equal(netBrief.intro, "Les ordinateurs de l'étage n'ont plus d'Internet. Ton objectif en 3 étapes simples :");
  assert.equal(netBrief.steps.length, 3);
  assert.equal(netBrief.steps[0].lead, 'Branche et configure');
  assert.equal(netBrief.steps[1].lead, 'Sépare les réseaux');
  assert.equal(netBrief.steps[2].lead, 'Vérifie que tout passe au vert');
  assert.equal(getJpoMissionBriefing('vmvlan'), netBrief);
  assert.equal(getJpoMissionBriefing('reseau'), netBrief);

  const elecBrief = getJpoMissionBriefing('tp_soldering');
  assert.equal(elecBrief.title, '🔥 Mission Brasure : Soude ta carte électronique !');
  assert.equal(elecBrief.intro, 'Une carte électronique attend ses composants. Ton objectif en 3 étapes simples :');
  assert.equal(elecBrief.steps.length, 3);
  assert.equal(elecBrief.steps[0].lead, 'Prépare et chauffe');
  assert.equal(elecBrief.steps[1].lead, 'Positionne et brase');
  assert.equal(elecBrief.steps[2].lead, 'Contrôle et teste');
  assert.equal(getJpoMissionBriefing('soldering'), elecBrief);
  assert.equal(getJpoMissionBriefing('elec'), elecBrief);
  assert.equal(JPO_MISSION_BRIEFINGS.elec, elecBrief);

  assert.equal(getJpoMissionBriefing('standard'), null);
  assert.equal(getJpoMissionBriefing('unknown'), null);

  const makeMockEl = (id) => {
    const classes = new Set(['hidden']);
    const listeners = new Map();
    const styles = new Map();
    return {
      id,
      textContent: '',
      innerHTML: '',
      style: {
        setProperty: (k, v) => styles.set(k, v),
        getPropertyValue: (k) => styles.get(k) || ''
      },
      classList: {
        add: (...names) => names.forEach((n) => classes.add(n)),
        remove: (...names) => names.forEach((n) => classes.delete(n)),
        toggle: (name, force) => {
          if (force === undefined) {
            if (classes.has(name)) classes.delete(name);
            else classes.add(name);
          } else if (force) {
            classes.add(name);
          } else {
            classes.delete(name);
          }
          return classes.has(name);
        },
        contains: (name) => classes.has(name)
      },
      addEventListener: (ev, fn) => {
        if (!listeners.has(ev)) listeners.set(ev, []);
        listeners.get(ev).push(fn);
      },
      trigger: (ev, eventObj = {}) => {
        for (const fn of listeners.get(ev) || []) {
          fn(eventObj);
        }
      }
    };
  };

  const elements = new Map([
    ['jpo-briefing-modal', makeMockEl('jpo-briefing-modal')],
    ['jpo-briefing-card', makeMockEl('jpo-briefing-card')],
    ['jpo-briefing-title', makeMockEl('jpo-briefing-title')],
    ['jpo-briefing-intro', makeMockEl('jpo-briefing-intro')],
    ['jpo-briefing-steps', makeMockEl('jpo-briefing-steps')],
    ['jpo-briefing-start-btn', makeMockEl('jpo-briefing-start-btn')],
    ['jpo-briefing-close', makeMockEl('jpo-briefing-close')]
  ]);

  const prevDocDesc = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    writable: true,
    value: {
      getElementById: (id) => elements.get(id) || null
    }
  });
  try {
    const modal = new JpoBriefingModal();
    assert.equal(modal.isOpen(), false);
    assert.equal(modal.open('standard'), false);
    assert.equal(modal.isOpen(), false);

    let starts = 0;
    let cancels = 0;
    assert.equal(
      modal.open('antivirus', {
        mode: 'start',
        onStart: () => starts++,
        onCancel: () => cancels++
      }),
      true
    );
    assert.equal(modal.isOpen(), true);
    assert.equal(elements.get('jpo-briefing-modal').classList.contains('hidden'), false);
    assert.equal(elements.get('jpo-briefing-title').textContent, '🛡️ Mission Cyber : Protège le réseau du lycée !');
    assert.equal(elements.get('jpo-briefing-start-btn').textContent, "🚀 C'est parti !");
    assert.ok(elements.get('jpo-briefing-steps').innerHTML.includes('Coupe le câble'));

    elements.get('jpo-briefing-start-btn').trigger('click');
    assert.equal(starts, 1);
    assert.equal(cancels, 0);
    assert.equal(modal.isOpen(), false);
    assert.equal(elements.get('jpo-briefing-modal').classList.contains('hidden'), true);

    assert.equal(
      modal.open('vmvlan', {
        mode: 'start',
        onStart: () => starts++,
        onCancel: () => cancels++
      }),
      true
    );
    elements.get('jpo-briefing-close').trigger('click');
    assert.equal(starts, 1);
    assert.equal(cancels, 1);
    assert.equal(modal.isOpen(), false);

    assert.equal(modal.open('soldering', { mode: 'help', onStart: () => starts++ }), true);
    assert.equal(elements.get('jpo-briefing-start-btn').textContent, "✅ Reprendre l'activité");
    elements.get('jpo-briefing-start-btn').trigger('click');
    assert.equal(starts, 1);
    assert.equal(modal.isOpen(), false);
  } finally {
    if (prevDocDesc) {
      Object.defineProperty(globalThis, 'document', prevDocDesc);
    } else {
      delete globalThis.document;
    }
  }

  const mainSrc = fs.readFileSync(path.resolve('src/main.js'), 'utf8');
  assert.equal(mainSrc.includes('tpAutoTimer'), false);
  assert.equal(mainSrc.includes('tpAutoOpened'), false);
  assert.ok(mainSrc.includes('if (jpoDemo && !skipBriefing && jpoBriefingModal && getJpoMissionBriefing(tpId))'));
  assert.ok(mainSrc.includes('jpoBriefingModal.open(tpId'));

  const hudSrc = fs.readFileSync(path.resolve('src/ui/HudManager.js'), 'utf8');
  assert.ok(hudSrc.includes('JPO_INTERACT_PROMPT_TEXT'));
  assert.ok(hudSrc.includes('▶ Démarrer l’activité'));
  assert.ok(hudSrc.includes("if (!target || this.detentionHudHidden || (this.isJpoActive() && target.type === 'combat_door'))"));

  const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');
  for (const needle of [
    'id="jpo-briefing-modal"',
    'id="jpo-briefing-card"',
    'id="jpo-briefing-title"',
    'id="jpo-briefing-steps"',
    'id="jpo-briefing-start-btn"',
    'id="mg-jpo-help-btn"',
    '❓ Aide / Consignes'
  ]) {
    assert.ok(indexHtml.includes(needle), `Élément JPO manquant dans index.html : ${needle}`);
  }
  assert.deepEqual(scanHtmlComments(indexHtml), []);

  const hudActionsMatch = indexHtml.match(/<div class="hud-actions">([\s\S]*?)<\/div>/);
  assert.ok(hudActionsMatch);
  const hudActionButtons = hudActionsMatch[1].match(/<button\b/g) || [];
  assert.equal(hudActionButtons.length, 2);

  const mainCss = fs.readFileSync(path.resolve('src/styles/main.css'), 'utf8');
  for (const cssNeedle of [
    'body.jpo-mode .interact-prompt',
    '.jpo-briefing-card',
    '.jpo-briefing-start-btn',
    '.mg-jpo-help-btn',
    'body.jpo-mode .tp3d-brief-bar',
    'body.jpo-mode .tp3d-side-drawer'
  ]) {
    assert.ok(mainCss.includes(cssNeedle), `Règle CSS manquante dans main.css : ${cssNeedle}`);
  }
  assert.deepEqual(scanCssComments(mainCss), []);

  const forbiddenPattern = new RegExp('for' + 'tin', 'i');
  for (const rel of [
    'src/core/jpoConfig.js',
    'src/ui/JpoBriefingModal.js',
    'src/ui/HudManager.js',
    'src/main.js',
    'src/minigames/MiniGameModal.js',
    'src/minigames/AntivirusGame.js',
    'src/minigames/VlanConfigGame.js',
    'src/minigames/ElectronicsGame.js',
    'src/ui/ChangelogModal.js',
    'vite.config.js',
    'tests/jpo-doors.test.js'
  ]) {
    const txt = fs.readFileSync(path.resolve(rel), 'utf8');
    assert.deepEqual(scanJsComments(txt), [], `Commentaire JS détecté dans ${rel}`);
    assert.equal(forbiddenPattern.test(txt), false, `Nom interdit détecté dans ${rel}`);
  }
});

test('Portes Ouvertes v4.42 : écran d’accueil Borne Kiosque au lancement & reset, absence en standard, correctif ATH TP et zéro commentaire', () => {
  assert.equal(JPO_WELCOME_BADGE, 'PORTES OUVERTES • BAC PRO CIEL');
  assert.equal(JPO_WELCOME_PLAY_LABEL, '🎮 Jouer');
  assert.deepEqual(Object.keys(JPO_WELCOME_SCREENS).sort(), ['audiovisuel', 'cyber', 'elec', 'reseau']);

  assert.equal(shouldShowJpoWelcome('standard'), false);
  assert.equal(shouldShowJpoWelcome('unknown'), false);
  assert.equal(getJpoWelcomeScreen('standard'), null);
  assert.equal(getJpoWelcomeScreen('unknown'), null);

  const expectedWelcome = {
    cyber: {
      title: '🛡️ Bienvenue sur le TP Cybersécurité',
      subtitle: 'Découvrez comment protéger un réseau informatique contre une cyberattaque en quelques clics.'
    },
    reseau: {
      title: '🌐 Bienvenue sur le TP Réseaux & Systèmes',
      subtitle: "Apprenez à connecter et sécuriser les équipements réseau d'un bâtiment."
    },
    elec: {
      title: '⚡ Bienvenue sur le TP Électronique & Embarqué',
      subtitle: "Explorez le fonctionnement d'un circuit électronique et réalisez vos premiers réglages."
    },
    audiovisuel: {
      title: '🎬 Bienvenue sur le TP Audiovisuel',
      subtitle: "Découvrez comment piloter le son, la lumière DMX et la régie vidéo d'un événement."
    }
  };

  for (const roomId of ['cyber', 'reseau', 'elec', 'audiovisuel']) {
    assert.equal(shouldShowJpoWelcome(roomId), true);
    const spec = getJpoWelcomeScreen(roomId);
    assert.ok(spec);
    assert.equal(spec.title, expectedWelcome[roomId].title);
    assert.equal(spec.subtitle, expectedWelcome[roomId].subtitle);
  }

  const makeMockEl = (id, initialClasses = ['hidden']) => {
    const classes = new Set(initialClasses);
    const listeners = new Map();
    const styles = new Map();
    return {
      id,
      textContent: '',
      style: {
        setProperty: (k, v) => styles.set(k, v),
        getPropertyValue: (k) => styles.get(k) || ''
      },
      classList: {
        add: (...names) => names.forEach((n) => classes.add(n)),
        remove: (...names) => names.forEach((n) => classes.delete(n)),
        toggle: (name, force) => {
          if (force === undefined) {
            if (classes.has(name)) classes.delete(name);
            else classes.add(name);
          } else if (force) {
            classes.add(name);
          } else {
            classes.delete(name);
          }
          return classes.has(name);
        },
        contains: (name) => classes.has(name)
      },
      addEventListener: (ev, fn) => {
        if (!listeners.has(ev)) listeners.set(ev, []);
        listeners.get(ev).push(fn);
      },
      trigger: (ev, eventObj = {}) => {
        for (const fn of listeners.get(ev) || []) {
          fn(eventObj);
        }
      }
    };
  };

  const bodyEl = makeMockEl('body', []);
  const elements = new Map([
    ['jpo-welcome-screen', makeMockEl('jpo-welcome-screen')],
    ['jpo-welcome-card', makeMockEl('jpo-welcome-card')],
    ['jpo-welcome-badge', makeMockEl('jpo-welcome-badge')],
    ['jpo-welcome-title', makeMockEl('jpo-welcome-title')],
    ['jpo-welcome-subtitle', makeMockEl('jpo-welcome-subtitle')],
    ['jpo-welcome-play-btn', makeMockEl('jpo-welcome-play-btn')]
  ]);

  const prevDocDesc = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    writable: true,
    value: {
      body: bodyEl,
      getElementById: (id) => elements.get(id) || null
    }
  });
  try {
    const modal = new JpoWelcomeModal();
    assert.equal(modal.isOpen(), false);
    assert.equal(modal.open('standard'), false);
    assert.equal(modal.isOpen(), false);
    assert.equal(bodyEl.classList.contains('jpo-welcome-open'), false);

    let playCalls = 0;
    for (const roomId of ['cyber', 'reseau', 'elec', 'audiovisuel']) {
      assert.equal(modal.open(roomId, { onPlay: () => playCalls++ }), true);
      assert.equal(modal.isOpen(), true);
      assert.equal(elements.get('jpo-welcome-screen').classList.contains('hidden'), false);
      assert.equal(bodyEl.classList.contains('jpo-welcome-open'), true);
      assert.equal(elements.get('jpo-welcome-badge').textContent, 'PORTES OUVERTES • BAC PRO CIEL');
      assert.equal(elements.get('jpo-welcome-title').textContent, expectedWelcome[roomId].title);
      assert.equal(elements.get('jpo-welcome-subtitle').textContent, expectedWelcome[roomId].subtitle);
      assert.equal(elements.get('jpo-welcome-play-btn').textContent, '🎮 Jouer');

      elements.get('jpo-welcome-play-btn').trigger('click');
      assert.equal(modal.isOpen(), false);
      assert.equal(elements.get('jpo-welcome-screen').classList.contains('hidden'), true);
      assert.equal(bodyEl.classList.contains('jpo-welcome-open'), false);
    }
    assert.equal(playCalls, 4);

    modal.close();
    assert.equal(modal.open('cyber', { onPlay: () => playCalls++ }), true);
    assert.equal(modal.isOpen(), true);
    assert.equal(elements.get('jpo-welcome-screen').classList.contains('hidden'), false);
    elements.get('jpo-welcome-play-btn').trigger('click');
    assert.equal(playCalls, 5);
  } finally {
    if (prevDocDesc) {
      Object.defineProperty(globalThis, 'document', prevDocDesc);
    } else {
      delete globalThis.document;
    }
  }

  const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');
  for (const needle of [
    'id="jpo-welcome-screen"',
    'id="jpo-welcome-card"',
    'id="jpo-welcome-badge"',
    'id="jpo-welcome-title"',
    'id="jpo-welcome-subtitle"',
    'id="jpo-welcome-play-btn"',
    'PORTES OUVERTES • BAC PRO CIEL',
    'ZQSD / Flèches',
    'Souris',
    '🎮 Jouer'
  ]) {
    assert.ok(indexHtml.includes(needle), `Élément manquant dans index.html : ${needle}`);
  }
  assert.deepEqual(scanHtmlComments(indexHtml), []);

  const mainSrc = fs.readFileSync(path.resolve('src/main.js'), 'utf8');
  for (const mainNeedle of [
    'JpoWelcomeModal',
    'openJpoWelcomeOverlay',
    'shouldShowJpoWelcome',
    'player.requestPointerLock',
    'jpoWelcomeModal?.isOpen?.()',
    'jpoWelcomeModal?.close?.()'
  ]) {
    assert.ok(mainSrc.includes(mainNeedle), `Logique manquante dans src/main.js : ${mainNeedle}`);
  }

  const mainCss = fs.readFileSync(path.resolve('src/styles/main.css'), 'utf8');
  for (const cssNeedle of [
    '.jpo-welcome-screen',
    'body.jpo-mode.jpo-welcome-open #game-canvas',
    'body.jpo-mode .tp3d-cameras',
    'body.jpo-mode .tp3d-zoom-bar',
    'body.jpo-mode .tp3d-zoom-btn',
    'body.jpo-mode .tp3d-bottom-dock'
  ]) {
    assert.ok(mainCss.includes(cssNeedle), `Règle CSS manquante dans main.css : ${cssNeedle}`);
  }
  assert.deepEqual(scanCssComments(mainCss), []);

  const forbiddenPattern = new RegExp('for' + 'tin', 'i');
  for (const rel of [
    'src/core/jpoConfig.js',
    'src/ui/JpoWelcomeModal.js',
    'src/ui/JpoBriefingModal.js',
    'src/ui/HudManager.js',
    'src/main.js',
    'src/ui/ChangelogModal.js',
    'vite.config.js',
    'tests/jpo-doors.test.js'
  ]) {
    const txt = fs.readFileSync(path.resolve(rel), 'utf8');
    assert.deepEqual(scanJsComments(txt), [], `Commentaire JS détecté dans ${rel}`);
    assert.equal(forbiddenPattern.test(txt), false, `Nom interdit détecté dans ${rel}`);
  }
});

test('Portes Ouvertes v4.43 : suppression Config salle / /admin et ajout complet de la 4e salle Audiovisuel', () => {
  const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');
  for (const forbidden of ['btn-jpo-config', 'jpo-welcome-config-link', 'Config salle', '/admin']) {
    assert.equal(indexHtml.includes(forbidden), false, `Élément interdit présent dans index.html : ${forbidden}`);
  }

  const jpoCfgSrc = fs.readFileSync(path.resolve('src/core/jpoConfig.js'), 'utf8');
  assert.equal(jpoCfgSrc.includes('JPO_WELCOME_CONFIG_LABEL'), false);
  assert.equal(jpoCfgSrc.includes('Config salle'), false);

  const welcomeModalSrc = fs.readFileSync(path.resolve('src/ui/JpoWelcomeModal.js'), 'utf8');
  assert.equal(welcomeModalSrc.includes('JPO_WELCOME_CONFIG_LABEL'), false);
  assert.equal(welcomeModalSrc.includes('jpo-welcome-config-link'), false);
  assert.equal(welcomeModalSrc.includes('/admin'), false);

  const mainCss = fs.readFileSync(path.resolve('src/styles/main.css'), 'utf8');
  assert.equal(mainCss.includes('.jpo-welcome-config-link'), false);
  assert.equal(mainCss.includes('.jpo-welcome-footer'), false);
  assert.ok(mainCss.includes('.jpo-av-drawer'));

  const mainSrc = fs.readFileSync(path.resolve('src/main.js'), 'utf8');
  assert.equal(mainSrc.includes('#jpo-welcome-screen a'), false);
  assert.ok(mainSrc.includes('createJpoAudiovisuelGame'));
  assert.ok(mainSrc.includes('api?.isJpo ? createJpoAudiovisuelGame(api) : createDmxLightingGame(api)'));

  const adminHtml = fs.readFileSync(path.resolve('admin.html'), 'utf8');
  assert.ok(adminHtml.includes('id="jpo-room-links"'));
  assert.ok(fs.readFileSync(path.resolve('src/admin/admin.js'), 'utf8').includes("'audiovisuel'"));

  const adminCss = fs.readFileSync(path.resolve('src/admin/admin.css'), 'utf8');
  assert.ok(adminCss.includes('.jpo-room-card[data-jpo-room="audiovisuel"].active'));

  const storage = createMemoryStorage();
  saveJpoConfig({ room: 'audiovisuel', kiosk: true }, storage);
  assert.equal(storage.getItem('ciel_jpo_salle'), 'audiovisuel');
  assert.deepEqual(readJpoConfig(storage), { room: 'audiovisuel', kiosk: true });
  assert.equal(normalizeJpoRoom('AUDIOVISUEL'), 'audiovisuel');
  assert.equal(isJpoRoomActive('audiovisuel'), true);

  const avCfg = getJpoRoomConfig('audiovisuel');
  assert.equal(avCfg.id, 'audiovisuel');
  assert.equal(avCfg.badgeCode, 'AUDIOVISUEL');
  assert.equal(avCfg.roomCode, 'U303');
  assert.equal(avCfg.tpId, 'audiovisual');
  assert.ok(createJpoVisitorName('audiovisuel', () => 0.5).startsWith('Visiteur_AV_'));

  const avWelcome = getJpoWelcomeScreen('audiovisuel');
  assert.equal(avWelcome.title, '🎬 Bienvenue sur le TP Audiovisuel');
  assert.equal(
    avWelcome.subtitle,
    "Découvrez comment piloter le son, la lumière DMX et la régie vidéo d'un événement."
  );

  const avBrief = getJpoMissionBriefing('audiovisuel');
  assert.equal(avBrief, getJpoMissionBriefing('audiovisual'));
  assert.equal(avBrief, getJpoMissionBriefing('tp_audiovisual'));
  assert.equal(avBrief.title, '🎬 Mission Audiovisuel : Pilote le spectacle en direct !');
  assert.equal(avBrief.steps.length, 3);

  const avMap = createJpoRoomMap('audiovisuel');
  assert.equal(avMap.jpoIsolated, true);
  assert.equal(avMap.bounds.width, 12);
  assert.equal(avMap.bounds.depth, 12);
  assert.ok(avMap.objects.some((o) => o.type === 'tp_audiovisual'));
  assert.ok(avMap.objects.some((o) => o.type === 'av_led_light'));
  assert.ok(avMap.objects.some((o) => o.type === 'av_mixer'));
  assert.ok(avMap.objects.some((o) => o.type === 'av_camera'));

  const avLab = buildLabWorld(new THREE.Scene(), avMap, { hideSprites: true });
  try {
    assert.equal(avLab.combatDoors.length, 0);
    const avInteractables = avLab.interactables.filter((it) => it?.type === 'tp');
    assert.ok(avInteractables.length >= 1);
    assert.ok(avInteractables.every((it) => it.tpId === 'audiovisual'));
  } finally {
    avLab.dispose();
  }

  const avPose = resolveJpoSpawnPose(avMap, 'audiovisuel');
  assert.equal(avPose.roomCode, 'U303');
  assert.equal(avPose.tpId, 'audiovisual');

  const evInit = evaluateJpoAudiovisuelState({
    micOn: false,
    audioLevel: 35,
    dmxPower: false,
    dmxIntensity: 30,
    dmxPreset: 'concert',
    videoSource: 'CAM-2',
    videoLive: false
  });
  assert.equal(evInit.completedSteps, 0);
  assert.equal(evInit.allValid, false);
  assert.ok(evInit.score < 10);

  const evAudioOnly = evaluateJpoAudiovisuelState({
    micOn: true,
    audioLevel: JPO_AV_TARGET.minAudio + 5,
    dmxPower: false,
    dmxIntensity: 30,
    dmxPreset: 'concert',
    videoSource: 'CAM-2',
    videoLive: false
  });
  assert.equal(evAudioOnly.audioOk, true);
  assert.equal(evAudioOnly.completedSteps, 1);

  const evPerfect = evaluateJpoAudiovisuelState({
    micOn: true,
    audioLevel: 75,
    dmxPower: true,
    dmxIntensity: 85,
    dmxPreset: 'spectacle',
    videoSource: 'CAM-1',
    videoLive: true
  });
  assert.equal(evPerfect.audioOk, true);
  assert.equal(evPerfect.dmxOk, true);
  assert.equal(evPerfect.videoOk, true);
  assert.equal(evPerfect.completedSteps, 3);
  assert.equal(evPerfect.allValid, true);
  assert.equal(evPerfect.score, 20);

  const forbiddenPattern = new RegExp('for' + 'tin', 'i');
  for (const rel of [
    'src/core/jpoConfig.js',
    'src/ui/JpoWelcomeModal.js',
    'src/ui/JpoBriefingModal.js',
    'src/ui/HudManager.js',
    'src/minigames/JpoAudiovisuelGame.js',
    'src/admin/admin.js',
    'src/world/LabBuilder.js',
    'src/main.js',
    'src/ui/ChangelogModal.js',
    'vite.config.js',
    'tests/jpo-doors.test.js'
  ]) {
    const txt = fs.readFileSync(path.resolve(rel), 'utf8');
    assert.deepEqual(scanJsComments(txt), [], `Commentaire JS détecté dans ${rel}`);
    assert.equal(forbiddenPattern.test(txt), false, `Nom interdit détecté dans ${rel}`);
  }
  assert.deepEqual(scanHtmlComments(adminHtml), []);
  assert.deepEqual(scanHtmlComments(indexHtml), []);
  assert.deepEqual(scanCssComments(adminCss), []);
  assert.deepEqual(scanCssComments(mainCss), []);
});

test('Portes Ouvertes v4.44 : régie audiovisuelle 3D enrichie, TP Brasure en salle elec, styles JPO et zéro commentaire', () => {
  const elecCfg = getJpoRoomConfig('elec');
  assert.equal(elecCfg.tpId, 'soldering');
  assert.equal(elecCfg.tpShortLabel, 'TP Brasure 3D');

  const elecMap = createJpoRoomMap('elec');
  assert.equal(elecMap.jpoIsolated, true);
  assert.ok(elecMap.objects.some((o) => o.type === 'tp_soldering'));
  assert.equal(elecMap.objects.some((o) => o.type === 'tp_electronics'), false);

  const elecLab = buildLabWorld(new THREE.Scene(), elecMap, { hideSprites: true });
  try {
    assert.equal(elecLab.combatDoors.length, 0);
    const elecInteractables = elecLab.interactables.filter((it) => it?.type === 'tp');
    assert.ok(elecInteractables.length >= 1);
    assert.ok(elecInteractables.every((it) => it.tpId === 'soldering'));
  } finally {
    elecLab.dispose();
  }

  const stdMap = createDefaultMap();
  assert.ok(stdMap.objects.some((o) => o.type === 'tp_electronics'));
  assert.ok(stdMap.objects.some((o) => o.type === 'tp_soldering'));

  const solderBrief = getJpoMissionBriefing('elec');
  assert.equal(solderBrief, JPO_MISSION_BRIEFINGS.elec);
  assert.equal(solderBrief, JPO_MISSION_BRIEFINGS.soldering);
  assert.equal(solderBrief, getJpoMissionBriefing('tp_soldering'));
  assert.equal(solderBrief.title, '🔥 Mission Brasure : Soude ta carte électronique !');
  assert.equal(solderBrief.steps[0].lead, 'Prépare et chauffe');
  assert.equal(solderBrief.steps[1].lead, 'Positionne et brase');
  assert.equal(solderBrief.steps[2].lead, 'Contrôle et teste');

  const jpoAvSrc = fs.readFileSync(path.resolve('src/minigames/JpoAudiovisuelGame.js'), 'utf8');
  for (const needle of [
    'RÉGIE SCÉNIQUE • BAC PRO CIEL',
    'THREE.AdditiveBlending',
    'THREE.SpotLight',
    'spotXs = [-0.54, -0.18, 0.18, 0.54]',
    'CAM 1 • SCÈNE',
    'CAM 2 • PUBLIC',
    'PGM / EN DIRECT',
    'PREVIEW',
    'ON AIR',
    'vuColumns',
    'rackLeds',
    'faderKnobs'
  ]) {
    assert.ok(jpoAvSrc.includes(needle), `Élément 3D manquant dans JpoAudiovisuelGame.js : ${needle}`);
  }

  const mainCss = fs.readFileSync(path.resolve('src/styles/main.css'), 'utf8');
  for (const cssNeedle of [
    'body.jpo-mode .tp3d-side-drawer .tp3d-drawer-section',
    'body.jpo-mode .tp3d-side-drawer .tp3d-drawer-title',
    'body.jpo-mode .tp3d-side-drawer .tp-hold-btn'
  ]) {
    assert.ok(mainCss.includes(cssNeedle), `Règle CSS manquante dans main.css : ${cssNeedle}`);
  }

  const adminHtml = fs.readFileSync(path.resolve('admin.html'), 'utf8');

  const forbiddenPattern = new RegExp('for' + 'tin', 'i');
  for (const rel of [
    'src/core/jpoConfig.js',
    'src/minigames/JpoAudiovisuelGame.js',
    'src/minigames/SolderingGame.js',
    'src/ui/ChangelogModal.js',
    'vite.config.js',
    'tests/jpo-doors.test.js'
  ]) {
    const txt = fs.readFileSync(path.resolve(rel), 'utf8');
    assert.deepEqual(scanJsComments(txt), [], `Commentaire JS détecté dans ${rel}`);
    assert.equal(forbiddenPattern.test(txt), false, `Nom interdit détecté dans ${rel}`);
  }
  assert.deepEqual(scanHtmlComments(adminHtml), []);
  assert.deepEqual(scanCssComments(mainCss), []);
});

test('Portes Ouvertes v4.45 : sublimation 3D des TP Cyber SOC, Réseau VLAN et Brasure PCB sans régression et zéro commentaire', () => {
  const avSrc = fs.readFileSync(path.resolve('src/minigames/AntivirusGame.js'), 'utf8');
  for (const needle of [
    'CENTRE CYBERDÉFENSE • BAC PRO CIEL',
    'socRackLeds',
    'nodeActivityLeds',
    'beamPulses',
    'fwShieldWire',
    'edrShieldDome',
    'edrShieldWire',
    '#soc-iso',
    '#soc-fw-185',
    '#soc-fw-91',
    '#soc-fw-4444',
    '#soc-edr-scan'
  ]) {
    assert.ok(avSrc.includes(needle), `Élément manquant dans AntivirusGame.js : ${needle}`);
  }

  const vlanSrc = fs.readFileSync(path.resolve('src/minigames/VlanConfigGame.js'), 'utf8');
  for (const needle of [
    'INFRASTRUCTURE RÉSEAU • BAC PRO CIEL',
    'PATCH PANEL 19" CAT6A',
    'switchPortLeds',
    'CatmullRomCurve3',
    'TubeGeometry',
    'campusPortLeds',
    'runCliCommand',
    'triggerNetworkProbe',
    '#cli-form',
    '#cli-input'
  ]) {
    assert.ok(vlanSrc.includes(needle), `Élément manquant dans VlanConfigGame.js : ${needle}`);
  }

  const solderSrc = fs.readFileSync(path.resolve('src/minigames/SolderingGame.js'), 'utf8');
  for (const needle of [
    'POSTE BRASURE ÉLECTRONIQUE • BAC PRO CIEL',
    'THREE.SpotLight',
    'helpingHandsGroup',
    'THREE.Points',
    'fluxSmokePoints',
    'pcbTestLight',
    'ironTipLight',
    '#solder-rng-temp',
    '#solder-hold-btn',
    'data-pad-id'
  ]) {
    assert.ok(solderSrc.includes(needle), `Élément manquant dans SolderingGame.js : ${needle}`);
  }

  const forbiddenPattern = new RegExp('for' + 'tin', 'i');
  for (const rel of [
    'src/minigames/AntivirusGame.js',
    'src/minigames/VlanConfigGame.js',
    'src/minigames/SolderingGame.js',
    'src/ui/ChangelogModal.js',
    'vite.config.js',
    'tests/jpo-doors.test.js',
    'tests/tablet-formative.test.js',
    'tests/mobile-tp.test.js',
    'tests/celebration-debug.test.js'
  ]) {
    const txt = fs.readFileSync(path.resolve(rel), 'utf8');
    assert.deepEqual(scanJsComments(txt), [], `Commentaire JS détecté dans ${rel}`);
    assert.equal(forbiddenPattern.test(txt), false, `Nom interdit détecté dans ${rel}`);
  }
});

test('Portes Ouvertes v4.47 : racine toujours en jeu standard, salles pilotées par URL isolée et zéro commentaire', () => {
  const prevLoc = Object.getOwnPropertyDescriptor(globalThis, 'location');
  const prevStore = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const store = createMemoryStorage();
  store.setItem('ciel_jpo_salle', 'cyber');
  store.setItem('ciel_jpo_kiosk', '1');
  const loc = { search: '' };
  Object.defineProperty(globalThis, 'location', { configurable: true, writable: true, value: loc });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: store });
  try {
    assert.deepEqual(readJpoConfig(), { room: 'standard', kiosk: false });
    assert.equal(isJpoActive(), false);
    loc.search = '?salle=inconnue';
    assert.equal(isJpoActive(), false);
    for (const roomId of ['cyber', 'reseau', 'elec', 'audiovisuel']) {
      loc.search = `?salle=${roomId}`;
      assert.deepEqual(readJpoConfig(), { room: roomId, kiosk: true });
      assert.equal(isJpoActive(), true);
      loc.search = `?salle=${roomId}&kiosk=0`;
      assert.deepEqual(readJpoConfig(), { room: roomId, kiosk: false });
      assert.equal(buildJpoRoomUrl(roomId, 'https://ciel.lolman.ovh'), `https://ciel.lolman.ovh/?salle=${roomId}`);
    }
    assert.deepEqual(readJpoConfigFromSearch(''), { room: 'standard', kiosk: false });
  } finally {
    if (prevLoc) Object.defineProperty(globalThis, 'location', prevLoc);
    else delete globalThis.location;
    if (prevStore) Object.defineProperty(globalThis, 'localStorage', prevStore);
    else delete globalThis.localStorage;
  }

  const adminJs = fs.readFileSync(path.resolve('src/admin/admin.js'), 'utf8');
  const adminHtml = fs.readFileSync(path.resolve('admin.html'), 'utf8');
  const mainJs = fs.readFileSync(path.resolve('src/main.js'), 'utf8');
  assert.ok(adminJs.includes('copyBtn'));
  assert.ok(adminJs.includes("openLink.target = '_blank'"));
  assert.ok(adminJs.includes('📋 Copier le lien'));
  assert.ok(adminJs.includes('🚀 Ouvrir cette salle'));
  assert.equal(adminJs.includes('saveJpoConfig'), false);
  assert.ok(adminHtml.includes('id="jpo-room-links"'));
  assert.equal(mainJs.includes('saveJpoConfig'), false);
  for (const rel of ['src/admin/admin.js', 'src/core/jpoConfig.js', 'tests/jpo-doors.test.js']) {
    const txt = fs.readFileSync(path.resolve(rel), 'utf8');
    assert.deepEqual(scanJsComments(txt), [], `Commentaire JS détecté dans ${rel}`);
  }
  assert.deepEqual(scanHtmlComments(adminHtml), []);
  assert.deepEqual(scanCssComments(fs.readFileSync(path.resolve('src/admin/admin.css'), 'utf8')), []);
});
