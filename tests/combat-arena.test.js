import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import * as THREE from 'three';
import { WebSocket } from 'ws';
import { createGameServer } from '../server/index.js';
import { COMBAT_ROOM_PREFIX, isCombatRoom } from '../server/wsHub.js';
import { sfx } from '../src/core/audio.js';
import { GameState } from '../src/core/gameState.js';
import { HudManager } from '../src/ui/HudManager.js';
import { TouchControls } from '../src/ui/TouchControls.js';
import { createCombatPocketRooms } from '../src/world/CombatArena3D.js';
import {
  COMBAT_ARENA_BOUNDS,
  COMBAT_ARENA_CENTER,
  COMBAT_ARENA_OBSTACLES,
  COMBAT_MIN_SOLO_BOTS,
  COMBAT_PICKUP_SPOTS,
  COMBAT_SPAWN_POINTS,
  COMBAT_WAITING_CENTER,
  CombatMatchController,
  getCombatArenaColliders
} from '../src/world/CombatEngine.js';
import {
  COMBAT_MODES,
  COMBAT_WEAPONS,
  animateCombatWeaponMesh,
  buildCombatWeaponMesh,
  createCombatVfxPool,
  getCombatWeaponById,
  getDefaultWeaponForMode,
  getSharedWeaponAssetStats,
  getWeaponsByMode
} from '../src/world/CombatWeapons.js';
import { buildLabWorld } from '../src/world/LabBuilder.js';
import { MAP_ITEM_CATALOG, createDefaultMap } from '../src/world/mapSchema.js';
import {
  COMBAT_KILL_COIN_BONUS,
  COMBAT_MAX_COINS_PER_MATCH,
  COMBAT_PARTICIPATION_COINS,
  COMBAT_VICTORY_COINS,
  computeCombatCoinReward
} from '../src/world/ShopCatalog.js';

function openWs(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const onErr = (err) => {
      cleanup();
      reject(err);
    };
    const onOpen = () => {
      cleanup();
      resolve(ws);
    };
    const cleanup = () => {
      ws.off('error', onErr);
      ws.off('open', onOpen);
    };
    ws.on('error', onErr);
    ws.on('open', onOpen);
  });
}

function waitForMessage(ws, predicate, timeoutMs = 4500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', onMsg);
      reject(new Error('Timeout attente message WebSocket combat'));
    }, timeoutMs);
    const onMsg = (raw) => {
      let data = null;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (predicate(data)) {
        clearTimeout(timer);
        ws.off('message', onMsg);
        resolve(data);
      }
    };
    ws.on('message', onMsg);
  });
}

function makeFakeElement(tag = 'div') {
  const classes = new Set();
  const listeners = new Map();
  const children = [];
  let innerHTMLValue = '';
  const el = {
    tagName: tag.toUpperCase(),
    style: {},
    dataset: {},
    textContent: '',
    value: '',
    disabled: false,
    children,
    classList: {
      add(...names) {
        for (const n of names) classes.add(n);
      },
      remove(...names) {
        for (const n of names) classes.delete(n);
      },
      toggle(name, force) {
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
      contains(name) {
        return classes.has(name);
      }
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const list = listeners.get(type);
      if (!list) return;
      const idx = list.indexOf(fn);
      if (idx >= 0) list.splice(idx, 1);
    },
    dispatchEvent(evt) {
      const e = evt || { type: 'click', preventDefault() {}, stopPropagation() {} };
      for (const fn of listeners.get(e.type) || []) {
        fn(e);
      }
    },
    click() {
      el.dispatchEvent({ type: 'click', preventDefault() {}, stopPropagation() {} });
    },
    setAttribute(k, v) {
      el[`attr_${k}`] = String(v);
    },
    getAttribute(k) {
      return el[`attr_${k}`] ?? null;
    },
    setPointerCapture() {},
    releasePointerCapture() {},
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 120, height: 120, right: 120, bottom: 120 };
    },
    appendChild(child) {
      children.push(child);
      return child;
    },
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    },
    set innerHTML(val) {
      innerHTMLValue = String(val);
    },
    get innerHTML() {
      return innerHTMLValue;
    },
    getContext() {
      return {
        clearRect() {},
        fillRect() {},
        strokeRect() {},
        beginPath() {},
        arc() {},
        fill() {},
        stroke() {},
        moveTo() {},
        lineTo() {},
        closePath() {},
        fillText() {},
        drawImage() {},
        createImageData() {
          return { data: new Uint8ClampedArray(16) };
        },
        putImageData() {},
        setLineDash() {},
        measureText(t) {
          return { width: String(t || '').length * 8 };
        },
        save() {},
        restore() {},
        translate() {},
        rotate() {}
      };
    }
  };
  return el;
}

test('Combat Door, mapSchema et LabBuilder préservent map.json et plateauLayout sans régression', () => {
  const combatDoorCat = MAP_ITEM_CATALOG.find((item) => item.type === 'combat_door');
  assert.ok(combatDoorCat);
  assert.equal(combatDoorCat.type, 'combat_door');

  const defaultMap = createDefaultMap();
  const defaultDoorObj = defaultMap.objects.find((o) => o.type === 'combat_door');
  assert.ok(defaultDoorObj);

  const scene = new THREE.Scene();
  const lab = buildLabWorld(scene, defaultMap, { hideSprites: true });
  try {
    assert.ok(Array.isArray(lab.combatDoors));
    assert.ok(lab.combatDoors.length >= 1);
    const door = lab.combatDoors[0];
    assert.equal(door.type, 'combat_door');
    assert.ok(lab.interactables.some((it) => it.type === 'combat_door'));

    const fallbackMap = createDefaultMap();
    fallbackMap.objects = fallbackMap.objects.filter((o) => o.type !== 'combat_door');
    const labFallback = buildLabWorld(new THREE.Scene(), fallbackMap, { hideSprites: true });
    try {
      assert.ok(labFallback.combatDoors.length >= 1);
    } finally {
      labFallback.dispose();
    }
  } finally {
    lab.dispose();
  }

  assert.equal(fs.existsSync(path.resolve('server/data/map.json')), false);
  assert.equal(fs.existsSync(path.resolve('server/data/db.json')), false);
});

test('CombatWeapons & CombatArena3D : 8 armes CIEL, pool VFX sans fuite et structure statique optimisée', () => {
  assert.equal(COMBAT_MODES.guns.id, 'guns');
  assert.equal(COMBAT_MODES.melee.id, 'melee');
  assert.equal(COMBAT_WEAPONS.length, 8);

  const guns = getWeaponsByMode('guns');
  const melee = getWeaponsByMode('melee');
  assert.equal(guns.length, 4);
  assert.equal(melee.length, 4);

  for (const expectedId of [
    'fiber_rifle',
    'udp_shotgun',
    'ping_sniper',
    'plasma_solder_pistol',
    'solder_iron_blade',
    'rj45_crimper_heavy',
    'ddr5_katana',
    'switch24_hammer'
  ]) {
    const spec = getCombatWeaponById(expectedId);
    assert.ok(spec);
    const fpsObj = buildCombatWeaponMesh(expectedId, { viewModel: true });
    assert.ok(fpsObj.group instanceof THREE.Group);
    assert.ok(fpsObj.muzzleOffset);
    assert.ok(fpsObj.group.children.length >= 2);
    fpsObj.dispose();

    const worldObj = buildCombatWeaponMesh(expectedId, { viewModel: false });
    assert.ok(worldObj.group instanceof THREE.Group);
    worldObj.dispose();
  }

  assert.equal(getDefaultWeaponForMode('guns').mode, 'guns');
  assert.equal(getDefaultWeaponForMode('melee').mode, 'melee');

  const scene = new THREE.Scene();
  const vfx = createCombatVfxPool(scene);
  const stats = vfx.getPoolStats();
  assert.equal(stats.beams, 36);
  assert.equal(stats.sineRails, 4);
  assert.equal(stats.sparks, 48);
  assert.equal(stats.slashes, 8);

  vfx.spawnShot('ping_sniper', 50, 1.5, 65, 60, 1.5, 65);
  vfx.spawnShot('udp_shotgun', 50, 1.5, 65, 58, 1.4, 67);
  vfx.spawnMeleeSlash('ddr5_katana', 55, 1.35, 68, 0.4);
  vfx.update(0.05);
  vfx.update(0.4);
  assert.deepEqual(vfx.getPoolStats(), stats);
  vfx.clear();
  vfx.dispose();

  const arenaScene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(70, 1.6, 0.1, 160);
  cam.position.set(COMBAT_ARENA_CENTER.x, 1.65, COMBAT_ARENA_CENTER.z);
  const arena = createCombatPocketRooms(arenaScene);
  try {
    let staticMeshCount = 0;
    arena.staticGroup.traverse((node) => {
      if (node === arena.staticGroup) return;
      staticMeshCount += 1;
      assert.equal(node.matrixAutoUpdate, false);
    });
    assert.ok(staticMeshCount >= 20);

    const waitCfg = arena.getWaitingRoomConfig();
    assert.equal(waitCfg.interactables.length, 4);
    assert.ok(waitCfg.interactables.some((it) => it.type === 'combat_lobby_bots'));
    assert.ok(Math.abs(waitCfg.spawn.x - COMBAT_WAITING_CENTER.x) < 12);

    const arenaCfg = arena.getArenaConfig();
    assert.equal(arenaCfg.bounds.minX, COMBAT_ARENA_BOUNDS.minX);
    assert.equal(arenaCfg.colliders.length, getCombatArenaColliders().length);

    arena.updateWaitingBoard({ mode: 'melee', fillBots: true, lobbyPlayers: [{ name: 'Alice', ready: true }] }, true);
    arena.updateArena(
      {
        mode: 'guns',
        timeLeftSec: 120,
        pickups: COMBAT_PICKUP_SPOTS.map((p) => ({ id: p.id, x: p.x, z: p.z, active: true })),
        fighters: [
          { id: 'bot-1', name: 'Bot1', isBot: true, alive: true, x: COMBAT_ARENA_CENTER.x + 3, z: COMBAT_ARENA_CENTER.z, yaw: 0, hp: 75, maxHp: 100, weaponId: 'fiber_rifle' }
        ],
        scoreboard: [{ id: 'bot-1', name: 'Bot1', kills: 1, deaths: 0 }]
      },
      0.016,
      1.2,
      cam
    );
    assert.equal(arena.botAvatars.size, 1);
    arena.triggerBotAttackAnim('bot-1');
    arena.clearCombatants();
    assert.equal(arena.botAvatars.size, 0);
  } finally {
    arena.dispose();
  }
});

test('CombatMatchController : Solo avec 3+ bots IA, modes Fusils & Mêlée, occlusion, knockback, dash, respawn & récompenses', () => {
  const ctrl = new CombatMatchController({
    roomId: 'combat-arena-unit',
    killLimit: 3,
    respawnDelayMs: 600,
    matchDurationSec: 60
  });

  ctrl.joinLobby({ id: 'p1', name: 'EleveTest', color: '#22d3ee' });
  ctrl.setMode('guns');
  ctrl.setFillBots(true);
  ctrl.setPlayerWeapon('p1', 'ping_sniper');

  const now0 = 10000;
  const readyRes = ctrl.setReady('p1', true, now0);
  assert.equal(readyRes.autoStarted, true);
  assert.equal(ctrl.phase, 'active');

  const bots = Array.from(ctrl.fighters.values()).filter((f) => f.isBot);
  assert.ok(bots.length >= COMBAT_MIN_SOLO_BOTS);

  const p1 = ctrl.fighters.get('p1');
  const targetBot = bots[0];
  p1.x = COMBAT_ARENA_CENTER.x;
  p1.z = COMBAT_ARENA_CENTER.z;
  p1.spawnProtectUntil = 0;

  targetBot.x = COMBAT_ARENA_CENTER.x;
  targetBot.z = COMBAT_ARENA_CENTER.z - 5;
  targetBot.spawnProtectUntil = 0;

  const blockObs = COMBAT_ARENA_OBSTACLES[0];
  p1.x = blockObs.minX - 1.5;
  p1.z = (blockObs.minZ + blockObs.maxZ) / 2;
  targetBot.x = blockObs.maxX + 1.5;
  targetBot.z = (blockObs.minZ + blockObs.maxZ) / 2;
  const blockedShot = ctrl.handleAttack('p1', {
    weaponId: 'ping_sniper',
    origin: { x: p1.x, y: 1.5, z: p1.z },
    dir: { x: 1, y: 0, z: 0 }
  }, now0 + 1500);
  assert.equal(blockedShot.ok, true);
  assert.equal(blockedShot.hits.length, 0);

  p1.x = COMBAT_SPAWN_POINTS[0].x;
  p1.z = COMBAT_SPAWN_POINTS[0].z;
  targetBot.x = p1.x;
  targetBot.z = p1.z - 4.0;
  targetBot.hp = 100;

  const udpShot = ctrl.handleAttack('p1', {
    weaponId: 'udp_shotgun',
    origin: { x: p1.x, y: 1.5, z: p1.z },
    dir: { x: 0, y: 0, z: -1 }
  }, now0 + 3500);
  assert.equal(udpShot.ok, true);
  assert.equal(udpShot.rays.length, 6);
  assert.ok(udpShot.hits.length >= 1);
  assert.ok(targetBot.hp < 100 || !targetBot.alive);

  const sniperKillShot = ctrl.handleAttack('p1', {
    weaponId: 'ping_sniper',
    origin: { x: p1.x, y: 1.78, z: p1.z },
    dir: { x: 0, y: 0, z: -1 }
  }, now0 + 5500);
  assert.equal(sniperKillShot.ok, true);
  assert.ok(p1.kills >= 1);
  assert.equal(targetBot.alive, false);

  const stepMid = ctrl.step(0.1, now0 + 6200);
  assert.equal(targetBot.alive, true);
  assert.equal(targetBot.hp, 100);
  assert.ok(Array.isArray(stepMid.attackEvents));

  const pkSpot = COMBAT_PICKUP_SPOTS[0];
  p1.hp = 40;
  p1.x = pkSpot.x;
  p1.z = pkSpot.z;
  ctrl.step(0.05, now0 + 6300);
  assert.equal(p1.hp, 75);

  const ctrlMelee = new CombatMatchController({ roomId: 'combat-melee-unit', killLimit: 2 });
  ctrlMelee.joinLobby({ id: 'm1', name: 'MeleePlayer' });
  ctrlMelee.setMode('melee');
  ctrlMelee.setFillBots(true);
  ctrlMelee.setPlayerWeapon('m1', 'ddr5_katana');
  ctrlMelee.setReady('m1', true, 20000);

  const m1 = ctrlMelee.fighters.get('m1');
  const mBot = Array.from(ctrlMelee.fighters.values()).find((f) => f.isBot);
  m1.x = COMBAT_ARENA_CENTER.x;
  m1.z = COMBAT_ARENA_CENTER.z + 3.2;
  m1.spawnProtectUntil = 0;
  mBot.x = COMBAT_ARENA_CENTER.x;
  mBot.z = COMBAT_ARENA_CENTER.z + 0.1;
  mBot.spawnProtectUntil = 0;

  const m1ZBefore = m1.z;
  const katanaHit = ctrlMelee.handleAttack('m1', {
    weaponId: 'ddr5_katana',
    origin: { x: m1.x, y: 1.5, z: m1.z },
    dir: { x: 0, y: 0, z: -1 },
    isVrSwing: true
  }, 21000);
  assert.equal(katanaHit.ok, true);
  assert.ok(m1.z < m1ZBefore);
  assert.ok(katanaHit.hits.length >= 1);

  ctrlMelee.setPlayerWeapon('m1', 'rj45_crimper_heavy');
  m1.x = COMBAT_ARENA_CENTER.x;
  m1.z = COMBAT_ARENA_CENTER.z + 1.5;
  mBot.x = COMBAT_ARENA_CENTER.x;
  mBot.z = COMBAT_ARENA_CENTER.z;
  mBot.alive = true;
  mBot.hp = 100;
  mBot.spawnProtectUntil = 0;
  const botZBefore = mBot.z;
  const rjHit = ctrlMelee.handleAttack('m1', {
    weaponId: 'rj45_crimper_heavy',
    origin: { x: m1.x, y: 1.5, z: m1.z },
    dir: { x: 0, y: 0, z: -1 }
  }, 23000);
  assert.equal(rjHit.ok, true);
  assert.ok(mBot.z < botZBefore);

  const winReward = computeCombatCoinReward({ won: true, kills: 5 });
  assert.equal(winReward.baseCoins, COMBAT_VICTORY_COINS);
  assert.equal(winReward.killBonus, 5 * COMBAT_KILL_COIN_BONUS);
  assert.equal(winReward.totalCoins, 170);

  const cappedReward = computeCombatCoinReward({ won: true, kills: 50 });
  assert.equal(cappedReward.totalCoins, COMBAT_MAX_COINS_PER_MATCH);

  const partReward = computeCombatCoinReward({ won: false, kills: 2 });
  assert.equal(partReward.totalCoins, COMBAT_PARTICIPATION_COINS + 20);
});

test('Serveur WebSocket & HTTP /api/economy/combat : lobby 3D, bots IA, élimination, récompenses CIEL Coins & anti-duplication', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atelier-combat-'));
  const { server, wsHub, store } = createGameServer({
    port: 0,
    dbPath: null,
    accountsPath: path.join(tmpDir, 'accounts.json'),
    mapPath: path.join(tmpDir, 'map.json'),
    enableAccessLog: false,
    combatOptions: {
      matchDurationSec: 45,
      killLimit: 1,
      respawnDelayMs: 400,
      botCount: 3,
      postEndResetMs: 120
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const wsUrl = `ws://127.0.0.1:${port}/ws`;
  let ws = null;

  try {
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'CombattantCIEL', password: 'Password123!' })
    });
    assert.equal(regRes.status, 201);
    const regData = await regRes.json();
    const token = regData.token;
    assert.ok(token);

    const noAuthEco = await fetch(`${baseUrl}/api/economy/combat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ won: true, kills: 3, matchId: 'unauth-1' })
    });
    assert.equal(noAuthEco.status, 401);

    const okEco = await fetch(`${baseUrl}/api/economy/combat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ won: false, kills: 2, matchId: 'http-match-1' })
    });
    assert.equal(okEco.status, 200);
    const okEcoData = await okEco.json();
    assert.equal(okEcoData.coinsEarned, COMBAT_PARTICIPATION_COINS + 20);

    const dupEco = await fetch(`${baseUrl}/api/economy/combat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ won: true, kills: 5, matchId: 'http-match-1' })
    });
    assert.equal(dupEco.status, 409);

    ws = await openWs(wsUrl);
    const welcomeP = waitForMessage(ws, (m) => m.type === 'welcome');
    ws.send(JSON.stringify({ type: 'join', name: 'CombattantCIEL', room: 'plateau-u300' }));
    const welcomeMsg = await welcomeP;
    const playerId = welcomeMsg.id;

    const switchedP = waitForMessage(ws, (m) => m.type === 'room_switched' && isCombatRoom(m.room));
    ws.send(JSON.stringify({ type: 'combat_join' }));
    const switchedMsg = await switchedP;
    assert.ok(switchedMsg.room.startsWith(COMBAT_ROOM_PREFIX));

    const ctrl = wsHub.getCombatController(switchedMsg.room);
    assert.ok(ctrl);

    const weaponP = waitForMessage(ws, (m) => m.type === 'combat_state' && m.state?.lobbyPlayers?.some((p) => p.weaponId === 'ping_sniper'));
    ws.send(JSON.stringify({ type: 'combat_weapon', weaponId: 'ping_sniper' }));
    await weaponP;

    const startedP = waitForMessage(ws, (m) => m.type === 'combat_started');
    ws.send(JSON.stringify({ type: 'combat_ready', ready: true }));
    const startedMsg = await startedP;
    assert.equal(startedMsg.state.phase, 'active');
    assert.equal(startedMsg.state.fighters.length, 4);

    const botTarget = Array.from(ctrl.fighters.values()).find((f) => f.isBot);
    assert.ok(botTarget);
    botTarget.spawnProtectUntil = 0;
    botTarget.hp = 50;
    botTarget.x = COMBAT_ARENA_CENTER.x;
    botTarget.z = COMBAT_ARENA_CENTER.z - 3;

    const humanFighter = ctrl.fighters.get(playerId);
    humanFighter.x = COMBAT_ARENA_CENTER.x;
    humanFighter.z = COMBAT_ARENA_CENTER.z;
    humanFighter.spawnProtectUntil = 0;

    ws.send(JSON.stringify({ type: 'move', x: humanFighter.x, y: 0, z: humanFighter.z, yaw: 0 }));

    const endedP = waitForMessage(ws, (m) => m.type === 'combat_ended', 5000);
    const fxP = waitForMessage(ws, (m) => m.type === 'combat_attack_fx' && m.attackerId === playerId, 3000);
    ws.send(
      JSON.stringify({
        type: 'combat_attack',
        weaponId: 'ping_sniper',
        origin: { x: humanFighter.x, y: 1.5, z: humanFighter.z },
        dir: { x: 0, y: 0, z: -1 }
      })
    );
    const fxMsg = await fxP;
    assert.equal(fxMsg.weaponId, 'ping_sniper');
    assert.ok(fxMsg.hits.length >= 1);

    const endedMsg = await endedP;
    assert.equal(endedMsg.ended.winnerId, playerId);
    const coinsReward = endedMsg.ended.coinRewards?.[playerId];
    assert.ok(coinsReward);
    assert.equal(coinsReward.coinsEarned, COMBAT_VICTORY_COINS + COMBAT_KILL_COIN_BONUS);

    const finalProfile = store.getPublicProfile('combattantciel');
    assert.ok(finalProfile.coins >= okEcoData.coinsEarned + coinsReward.coinsEarned);

    const returnP = waitForMessage(ws, (m) => m.type === 'room_switched' && m.room === 'plateau-u300');
    ws.send(JSON.stringify({ type: 'combat_leave' }));
    const returnMsg = await returnP;
    assert.equal(returnMsg.room, 'plateau-u300');
  } finally {
    if (ws && ws.readyState <= 1) ws.close();
    wsHub?.close?.();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('DOM index.html, HudManager, TouchControls & Audio Combat sont complets et sans erreur', () => {
  const html = fs.readFileSync(path.resolve('index.html'), 'utf8');
  for (const id of [
    'combat-lobby-modal',
    'combat-mode-guns-btn',
    'combat-mode-melee-btn',
    'combat-bots-toggle-btn',
    'combat-lobby-weapons',
    'combat-lobby-ready-btn',
    'combat-hud',
    'combat-hp-fill',
    'combat-weapon-slots',
    'combat-scoreboard-overlay',
    'combat-end-overlay',
    'touch-combat-pad',
    'touch-btn-fire',
    'touch-btn-reload',
    'touch-btn-weapon-next'
  ]) {
    assert.ok(html.includes(`id="${id}"`), `Missing DOM element #${id}`);
  }

  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  const fakeIds = new Map();
  const getEl = (id) => {
    if (!fakeIds.has(id)) fakeIds.set(id, makeFakeElement('div'));
    return fakeIds.get(id);
  };

  globalThis.document = {
    body: makeFakeElement('body'),
    getElementById: getEl,
    createElement: (tag) => makeFakeElement(tag),
    querySelector: (sel) => getEl(sel),
    querySelectorAll: () => [],
    addEventListener: () => {}
  };
  globalThis.window = {
    innerWidth: 800,
    innerHeight: 600,
    addEventListener: () => {},
    matchMedia: () => ({ matches: false, addEventListener: () => {} })
  };

  try {
    const gs = new GameState();
    const dummyNet = {
      wsUrl: '/ws',
      lastPingMs: 8,
      fetchLeaderboard: async () => [],
      reconnectNow() {},
      sendEmote() {},
      sendChat() {}
    };
    const hud = new HudManager(gs, dummyNet, {});
    let modeSelected = null;
    let readyCalls = 0;
    hud.bindCombatHandlers({
      onSelectMode: (m) => {
        modeSelected = m;
      },
      onToggleReady: () => {
        readyCalls += 1;
      }
    });
    getEl('combat-mode-melee-btn').click();
    getEl('combat-lobby-ready-btn').click();
    assert.equal(modeSelected, 'melee');
    assert.equal(readyCalls, 1);

    hud.showCombatLobby({
      mode: 'guns',
      fillBots: true,
      lobbyPlayers: [{ id: 'p1', name: 'Alice', ready: false, weaponId: 'fiber_rifle' }]
    }, 'p1');
    assert.equal(getEl('combat-lobby-modal').classList.contains('hidden'), false);

    hud.updateCombatHud({
      mode: 'guns',
      timeLeftSec: 95,
      killLimit: 10,
      fighters: [
        { id: 'p1', hp: 80, maxHp: 100, alive: true, weaponId: 'fiber_rifle', ammo: 18, kills: 2, deaths: 1, streak: 2 }
      ],
      killfeed: [{ killerName: 'Alice', victimName: 'Bot', icon: '🔫' }]
    }, 'p1');
    assert.equal(getEl('combat-hud').classList.contains('hidden'), false);
    assert.equal(getEl('combat-hp-text').textContent, '80 / 100');

    hud.triggerCombatDamageFlash();
    assert.equal(getEl('combat-damage-flash').classList.contains('active'), true);
    hud.toggleCombatScoreboard(true, { scoreboard: [{ id: 'p1', name: 'Alice', kills: 2, deaths: 1 }] }, 'p1');
    assert.equal(getEl('combat-scoreboard-overlay').classList.contains('hidden'), false);
    hud.showCombatEndOverlay({ won: true, reason: 'Fin', coinsEarned: 140, scoreboard: [], localId: 'p1' });
    assert.equal(getEl('combat-end-overlay').classList.contains('hidden'), false);
    hud.hideAllCombatUi();
    assert.equal(getEl('combat-hud').classList.contains('hidden'), true);

    let fired = 0;
    let reloaded = 0;
    let cycled = 0;
    const fakePlayer = {
      setMoveVector() {},
      setMovementInput() {},
      setSprinting() {},
      addLookDelta() {},
      triggerJump() {}
    };
    const tc = new TouchControls(fakePlayer, {
      onCombatFireStart: () => {
        fired += 1;
      },
      onCombatReload: () => {
        reloaded += 1;
      },
      onCombatCycleWeapon: () => {
        cycled += 1;
      }
    });
    tc.setVisible(true);
    tc.setCombatMode(true, { mode: 'guns', weaponShortName: 'Fibre' });
    assert.equal(getEl('touch-combat-pad').classList.contains('hidden'), false);
    getEl('touch-btn-fire').dispatchEvent({ type: 'pointerdown', pointerId: 1, preventDefault() {}, stopPropagation() {} });
    getEl('touch-btn-reload').dispatchEvent({ type: 'click', preventDefault() {}, stopPropagation() {} });
    getEl('touch-btn-weapon-next').dispatchEvent({ type: 'click', preventDefault() {}, stopPropagation() {} });
    assert.equal(fired, 1);
    assert.equal(reloaded, 1);
    assert.equal(cycled, 1);
    tc.setCombatMode(false);
    assert.equal(getEl('touch-combat-pad').classList.contains('hidden'), true);
    hud.hideAllCombatUi();

    assert.equal(typeof sfx.playCombatShot, 'function');
    assert.equal(typeof sfx.playCombatMelee, 'function');
    assert.equal(typeof sfx.playCombatHitmarker, 'function');
    assert.equal(typeof sfx.playCombatReload, 'function');
    assert.equal(typeof sfx.playCombatPickup, 'function');
    assert.equal(typeof sfx.playCombatHurt, 'function');
  } finally {
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
    if (prevWin === undefined) delete globalThis.window;
    else globalThis.window = prevWin;
  }
});

test('v4.29 : Désactivation Bots IA (0 bot solo & multi), Réticules Dynamiques, Visée ADS, Lunette Oscilloscope & 8 Modèles 3D Refondus', async () => {
  const soloCtrl = new CombatMatchController({ roomId: 'combat-solo-nobots', botCount: 3 });
  soloCtrl.joinLobby({ id: 'solo1', name: 'SoloTrain', color: '#22d3ee' });
  soloCtrl.setBotsEnabled(false);
  const preSnap = soloCtrl.getPublicSnapshot();
  assert.equal(preSnap.botsEnabled, false);
  assert.equal(preSnap.fillBots, false);
  const soloStart = soloCtrl.setReady('solo1', true, 10000);
  assert.equal(soloStart.autoStarted, true);
  const soloBots = [...soloCtrl.fighters.values()].filter((f) => f.isBot);
  assert.equal(soloBots.length, 0);
  assert.equal(soloCtrl.fighters.size, 1);

  const duoCtrl = new CombatMatchController({ roomId: 'combat-duo-nobots', botCount: 4 });
  duoCtrl.joinLobby({ id: 'a', name: 'EleveA' });
  duoCtrl.joinLobby({ id: 'b', name: 'EleveB' });
  duoCtrl.setMode('melee');
  duoCtrl.setBotsEnabled(false);
  duoCtrl.setReady('a', true, 12000);
  const duoStart = duoCtrl.setReady('b', true, 12100);
  assert.equal(duoStart.autoStarted, true);
  assert.equal([...duoCtrl.fighters.values()].filter((f) => f.isBot).length, 0);
  assert.equal(duoCtrl.fighters.size, 2);

  const fa = duoCtrl.fighters.get('a');
  const fb = duoCtrl.fighters.get('b');
  fa.x = COMBAT_ARENA_CENTER.x;
  fa.z = COMBAT_ARENA_CENTER.z + 1.4;
  fa.yaw = 0;
  fa.spawnProtectUntil = 0;
  fb.x = COMBAT_ARENA_CENTER.x;
  fb.z = COMBAT_ARENA_CENTER.z;
  fb.yaw = Math.PI;
  fb.spawnProtectUntil = 0;
  duoCtrl.setPlayerGuard('b', true);
  const guardedHit = duoCtrl.handleAttack('a', {
    weaponId: 'solder_iron_blade',
    origin: { x: fa.x, y: 1.5, z: fa.z },
    dir: { x: 0, y: 0, z: -1 }
  }, 13000);
  assert.equal(guardedHit.ok, true);
  assert.equal(guardedHit.hits[0].guarded, true);
  assert.equal(guardedHit.hits[0].damage, 13);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atelier-combat-v429-'));
  const { server, wsHub } = createGameServer({
    port: 0,
    dbPath: null,
    accountsPath: path.join(tmpDir, 'accounts.json'),
    mapPath: path.join(tmpDir, 'map.json'),
    enableAccessLog: false,
    combatOptions: { botCount: 3, matchDurationSec: 45, killLimit: 5 }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const ws = await openWs(`ws://127.0.0.1:${port}/ws`);
  try {
    const joinedP = waitForMessage(ws, (m) => m.type === 'welcome');
    ws.send(JSON.stringify({ type: 'join', name: 'TestNoBots', room: 'plateau-u300' }));
    await joinedP;

    const joinStateP = waitForMessage(ws, (m) => m.type === 'combat_state');
    ws.send(JSON.stringify({ type: 'combat_join' }));
    const joinState = await joinStateP;
    assert.equal(joinState.state.botsEnabled, true);

    const toggleOffP = waitForMessage(ws, (m) => m.type === 'combat_state' && m.state?.botsEnabled === false);
    ws.send(JSON.stringify({ type: 'combat_fill_bots', botsEnabled: false, fillBots: false }));
    const toggledOff = await toggleOffP;
    assert.equal(toggledOff.state.botsEnabled, false);
    assert.equal(toggledOff.state.fillBots, false);

    const startedP = waitForMessage(ws, (m) => m.type === 'combat_started');
    ws.send(JSON.stringify({ type: 'combat_ready', ready: true }));
    const started = await startedP;
    assert.equal(started.state.botsEnabled, false);
    assert.equal(started.state.fighters.filter((f) => f.isBot).length, 0);
  } finally {
    ws.close();
    wsHub.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  for (const spec of COMBAT_WEAPONS) {
    assert.ok(spec.ads);
    assert.ok(spec.ads.fov > 0 && spec.ads.fov <= 70);
    assert.ok(spec.ads.sensitivityMult > 0 && spec.ads.sensitivityMult <= 1);
    const w1 = buildCombatWeaponMesh(spec.id, { viewModel: true });
    assert.ok(w1.group.children.length >= 6);
    animateCombatWeaponMesh(w1, { elapsed: 1.25, recoil: 0.5, pumpPhase: 0.4 });
    w1.dispose();
  }
  const statsAfterPass1 = getSharedWeaponAssetStats();
  for (const spec of COMBAT_WEAPONS) {
    const w2 = buildCombatWeaponMesh(spec.id, { viewModel: false });
    w2.dispose();
  }
  const statsAfterPass2 = getSharedWeaponAssetStats();
  assert.deepEqual(statsAfterPass2, statsAfterPass1);

  const arena = createCombatPocketRooms(new THREE.Scene());
  try {
    arena.updateWaitingBoard({ mode: 'guns', botsEnabled: false, lobbyPlayers: [] }, true);
    const botsConsole = arena.getWaitingRoomConfig().interactables.find((it) => it.type === 'combat_lobby_bots');
    assert.ok(botsConsole);
    assert.match(botsConsole.label, /DÉSACTIVÉS/);
    arena.updateWaitingBoard({ mode: 'guns', botsEnabled: true, lobbyPlayers: [] }, true);
    assert.match(botsConsole.label, /ACTIVÉS/);
  } finally {
    arena.dispose();
  }

  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  const elements = new Map();
  const getEl = (id) => {
    if (!elements.has(id)) elements.set(id, makeFakeElement(id.includes('canvas') || id.includes('wave') ? 'canvas' : 'div'));
    return elements.get(id);
  };
  globalThis.document = {
    body: makeFakeElement('body'),
    getElementById: (id) => getEl(id),
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => makeFakeElement(tag),
    addEventListener() {},
    removeEventListener() {}
  };
  globalThis.window = {
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener() {},
    removeEventListener() {}
  };
  try {
    const hud = new HudManager(new GameState(), { wsUrl: '/ws', fetchLeaderboard: async () => [] }, {});
    for (const spec of COMBAT_WEAPONS) {
      const ch = hud.updateCombatCrosshair({
        active: true,
        weaponId: spec.id,
        mode: spec.mode,
        spreadPx: 12,
        adsActive: false,
        inMeleeRange: spec.mode === 'melee'
      });
      assert.equal(ch.active, true);
      assert.equal(ch.hiddenForAds, false);
    }
    const chAds = hud.updateCombatCrosshair({
      active: true,
      weaponId: 'ping_sniper',
      mode: 'guns',
      spreadPx: 6,
      adsActive: true
    });
    assert.equal(chAds.hiddenForAds, true);
    assert.equal(getEl('combat-crosshair').classList.contains('ads-hidden'), true);

    hud.updateSniperScope({ active: true, elapsed: 1.5, targetDistance: 24.6 });
    assert.equal(getEl('combat-sniper-scope').classList.contains('hidden'), false);
    assert.equal(getEl('combat-scope-dist').textContent, '24.6 m');
    hud.updateSniperScope({ active: false });
    assert.equal(getEl('combat-sniper-scope').classList.contains('hidden'), true);

    let adsToggled = null;
    const tc = new TouchControls(
      { setMoveVector() {}, setMovementInput() {}, setSprinting() {}, addLookDelta() {}, triggerJump() {} },
      { onCombatToggleAds: (v) => { adsToggled = v; } }
    );
    tc.setVisible(true);
    tc.setCombatMode(true, { mode: 'guns', weaponShortName: 'Sniper' });
    getEl('touch-btn-aim').dispatchEvent({ type: 'click', preventDefault() {}, stopPropagation() {} });
    assert.equal(adsToggled, true);
    getEl('touch-btn-aim').dispatchEvent({ type: 'click', preventDefault() {}, stopPropagation() {} });
    assert.equal(adsToggled, false);
  } finally {
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
    if (prevWin === undefined) delete globalThis.window;
    else globalThis.window = prevWin;
  }
});
