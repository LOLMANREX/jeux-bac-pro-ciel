import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import * as THREE from 'three';
import { WebSocket } from 'ws';
import { createGameServer } from '../server/index.js';
import { GameStore } from '../server/gameStore.js';
import {
  Ciel2048Game,
  CielBlocksGame,
  CielMinesweeperGame,
  CyberSnakeGame,
  FlappyPacketGame,
  NetworkBreakoutGame
} from '../src/minigames/CielOsGames.js';
import { buildShopViewModel } from '../src/ui/ShopModal.js';
import { applyShopSkin, buildStudentAvatarMesh } from '../src/world/AvatarBuilder.js';
import { buildLabWorld } from '../src/world/LabBuilder.js';
import { createDefaultMap } from '../src/world/mapSchema.js';
import { buildPetMesh } from '../src/world/PetBuilder.js';
import { RemotePlayersManager } from '../src/world/RemotePlayers.js';
import {
  ARCADE_GAME_RULES,
  ARCADE_NEW_RECORD_BONUS,
  computeArcadeCoinReward,
  computeDetentionTableCoinReward,
  computeSurvivalCoinReward,
  computeTpCoinReward,
  DETENTION_TABLE_COIN_REWARD,
  MAX_DETENTION_TABLES_PER_MATCH,
  SHOP_ACCESSORIES,
  SHOP_CATALOG,
  SHOP_CATEGORIES,
  SHOP_PETS,
  SHOP_RARITIES,
  SHOP_SKINS,
  SURVIVAL_DEFEAT_COINS,
  SURVIVAL_VICTORY_COINS
} from '../src/world/ShopCatalog.js';

function openWs(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

function waitForMsg(sock, predicate, timeoutMs = 3500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      sock.off('message', handler);
      reject(new Error('Timeout waiting for WS message'));
    }, timeoutMs);
    const handler = (raw) => {
      let parsed = null;
      try {
        parsed = JSON.parse(raw.toString('utf8'));
      } catch {
        return;
      }
      if (predicate(parsed)) {
        clearTimeout(timer);
        sock.off('message', handler);
        resolve(parsed);
      }
    };
    sock.on('message', handler);
  });
}

async function apiJson(baseUrl, pathname, { method = 'GET', body = null, token = null } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  return { status: res.status, data };
}

test('v4.24 : catalogue Boutique structuré par raretés, prix équilibrés (150..2500 CC) et conformité lore CIEL', () => {
  assert.deepEqual(Object.keys(SHOP_RARITIES), ['common', 'rare', 'epic', 'legendary']);
  assert.equal(SHOP_CATEGORIES.length, 3);
  assert.ok(SHOP_SKINS.length >= 8);
  assert.ok(SHOP_PETS.length >= 6);
  assert.ok(SHOP_ACCESSORIES.length >= 4);

  const forbiddenNameRe = new RegExp(`for${'tin'}`, 'i');
  const ids = new Set();
  for (const item of SHOP_CATALOG) {
    assert.ok(!ids.has(item.id), `Doublon ID boutique: ${item.id}`);
    ids.add(item.id);
    assert.ok(SHOP_RARITIES[item.rarity], `Rareté invalide: ${item.rarity}`);
    assert.ok(item.price >= 150 && item.price <= 2500, `Prix hors plage: ${item.id}=${item.price}`);
    assert.ok(!forbiddenNameRe.test(`${item.name} ${item.description}`));
  }

  const raritiesPresent = new Set(SHOP_CATALOG.map((it) => it.rarity));
  for (const rar of ['common', 'rare', 'epic', 'legendary']) {
    assert.ok(raritiesPresent.has(rar));
  }
});

test('v4.24 : gains CIEL Coins TPs 3D exacts (25/50/100 + 50 première validation) et persistance atomique serveur', async () => {
  const r10First = computeTpCoinReward({ score: 10, isFirstValidation: true });
  assert.equal(r10First.baseCoins, 25);
  assert.equal(r10First.firstValidationBonus, 50);
  assert.equal(r10First.totalCoins, 75);

  const r10Replay = computeTpCoinReward({ score: 10, isFirstValidation: false });
  assert.equal(r10Replay.baseCoins, 25);
  assert.equal(r10Replay.firstValidationBonus, 0);
  assert.equal(r10Replay.totalCoins, 25);

  const r15First = computeTpCoinReward({ score: 15, isFirstValidation: true });
  assert.equal(r15First.baseCoins, 50);
  assert.equal(r15First.firstValidationBonus, 50);
  assert.equal(r15First.totalCoins, 100);

  const r20First = computeTpCoinReward({ score: 20, isFirstValidation: true });
  assert.equal(r20First.baseCoins, 100);
  assert.equal(r20First.firstValidationBonus, 50);
  assert.equal(r20First.totalCoins, 150);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ciel-econ-tp-'));
  const dbPath = path.join(tmpDir, 'db.json');
  const accountsPath = path.join(tmpDir, 'accounts.json');
  const mapPath = path.join(tmpDir, 'map.json');
  const { server, wsHub } = createGameServer({ dbPath, accountsPath, mapPath });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const reg = await apiJson(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { username: 'EconStudent', password: 'secret-tp-pass' }
    });
    assert.equal(reg.status, 201);
    assert.equal(reg.data.profile.coins, 0);

    const tp1 = await apiJson(baseUrl, '/api/tp', {
      method: 'POST',
      body: { name: 'EconStudent', tpId: 'oscilloscope', score: 10, durationSec: 42 }
    });
    assert.equal(tp1.status, 200);
    assert.equal(tp1.data.coinsEarned, 75);
    assert.equal(tp1.data.coinBreakdown.firstValidationBonus, 50);
    assert.equal(tp1.data.profile.coins, 75);
    assert.deepEqual(tp1.data.profile.validatedTps, ['oscilloscope']);

    const tp1Replay = await apiJson(baseUrl, '/api/tp', {
      method: 'POST',
      body: { name: 'EconStudent', tpId: 'oscilloscope', score: 10, durationSec: 40 }
    });
    assert.equal(tp1Replay.status, 200);
    assert.equal(tp1Replay.data.coinsEarned, 25);
    assert.equal(tp1Replay.data.coinBreakdown.firstValidationBonus, 0);
    assert.equal(tp1Replay.data.profile.coins, 100);

    const tp2 = await apiJson(baseUrl, '/api/tp', {
      method: 'POST',
      body: { name: 'EconStudent', tpId: 'soldering', score: 15, durationSec: 38 }
    });
    assert.equal(tp2.status, 200);
    assert.equal(tp2.data.coinsEarned, 100);
    assert.equal(tp2.data.profile.coins, 200);

    const tp3 = await apiJson(baseUrl, '/api/tp', {
      method: 'POST',
      body: { name: 'EconStudent', tpId: 'electronics', score: 20, durationSec: 35 }
    });
    assert.equal(tp3.status, 200);
    assert.equal(tp3.data.coinsEarned, 150);
    assert.equal(tp3.data.profile.coins, 350);

    const reloaded = new GameStore(dbPath, { accountsPath });
    const savedProfile = reloaded.getPublicProfile('econstudent');
    const savedAccount = reloaded.getPublicAccount('EconStudent');
    assert.equal(savedProfile.coins, 350);
    assert.equal(savedAccount.coins, 350);
    assert.deepEqual(savedProfile.validatedTps, ['oscilloscope', 'soldering', 'electronics']);
  } finally {
    wsHub.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('v4.24 : gains Mode Survie Horreur (150 victoire / 40 défaite / +15 tableau plafonné) HTTP + WS', async () => {
  assert.equal(SURVIVAL_VICTORY_COINS, 150);
  assert.equal(SURVIVAL_DEFEAT_COINS, 40);
  assert.equal(DETENTION_TABLE_COIN_REWARD, 15);
  assert.equal(MAX_DETENTION_TABLES_PER_MATCH, 6);

  const vic = computeSurvivalCoinReward({ outcome: 'victory', solvedTables: 2 });
  assert.equal(vic.totalCoins, 180);
  const capped = computeSurvivalCoinReward({ outcome: 'defeat', solvedTables: 99 });
  assert.equal(capped.solvedTables, 6);
  assert.equal(capped.totalCoins, 40 + 6 * 15);

  for (let i = 0; i < MAX_DETENTION_TABLES_PER_MATCH; i++) {
    assert.equal(computeDetentionTableCoinReward({ solvedInMatch: i }), 15);
  }
  assert.equal(computeDetentionTableCoinReward({ solvedInMatch: 6 }), 0);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ciel-econ-surv-'));
  const dbPath = path.join(tmpDir, 'db.json');
  const accountsPath = path.join(tmpDir, 'accounts.json');
  const mapPath = path.join(tmpDir, 'map.json');
  const { server, wsHub } = createGameServer({
    dbPath,
    accountsPath,
    mapPath,
    survivalOptions: { minPlayers: 1, graceMs: 0, introDurationMs: 2500, postEndResetMs: 5000 }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const wsUrl = `ws://127.0.0.1:${port}/ws`;

  let ws = null;
  try {
    const reg = await apiJson(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { username: 'SurvHero', password: 'surv-password-1' }
    });
    assert.equal(reg.status, 201);
    const token = reg.data.token;

    const firstMatch = await apiJson(baseUrl, '/api/economy/survival', {
      method: 'POST',
      token,
      body: { outcome: 'defeat', solvedTables: 0, matchId: 'match-unique-001' }
    });
    assert.equal(firstMatch.status, 200);
    assert.equal(firstMatch.data.coinsEarned, 40);
    assert.equal(firstMatch.data.coins, 40);

    const dupMatch = await apiJson(baseUrl, '/api/economy/survival', {
      method: 'POST',
      token,
      body: { outcome: 'victory', solvedTables: 0, matchId: 'match-unique-001' }
    });
    assert.equal(dupMatch.status, 409);

    ws = await openWs(wsUrl);
    const welcomeP = waitForMsg(ws, (m) => m.type === 'welcome');
    ws.send(JSON.stringify({ type: 'join', name: 'SurvHero', room: 'plateau-u300' }));
    await welcomeP;

    const switchedP = waitForMsg(ws, (m) => m.type === 'room_switched');
    ws.send(JSON.stringify({ type: 'survival_join' }));
    await switchedP;

    const startedP = waitForMsg(ws, (m) => m.type === 'survival_started');
    ws.send(JSON.stringify({ type: 'survival_ready', ready: true }));
    const started = await startedP;

    const caughtP = waitForMsg(ws, (m) => m.type === 'survival_caught');
    ws.send(
      JSON.stringify({
        type: 'move',
        x: started.state.ai.x,
        y: 0,
        z: started.state.ai.z,
        yaw: 0
      })
    );
    const caughtMsg = await caughtP;
    assert.equal(caughtMsg.coinsEarned, 40);

    for (let idx = 1; idx <= 7; idx++) {
      const pulseP = waitForMsg(ws, (m) => m.type === 'survival_detention_pulse');
      ws.send(JSON.stringify({ type: 'survival_detention_solved' }));
      const pulse = await pulseP;
      assert.equal(pulse.detentionSolvedCount, idx);
      if (idx <= 6) {
        assert.equal(pulse.coinsEarned, 15);
        assert.equal(pulse.capped, false);
      } else {
        assert.equal(pulse.coinsEarned, 0);
        assert.equal(pulse.capped, true);
      }
    }

    const restartedP = waitForMsg(ws, (m) => m.type === 'survival_started');
    ws.send(JSON.stringify({ type: 'survival_restart' }));
    const restarted = await restartedP;

    const requiredTps = restarted.state.requiredTps || ['oscilloscope', 'soldering', 'electronics', 'antivirus', 'vmvlan'];
    const endedP = waitForMsg(ws, (m) => m.type === 'survival_ended');
    for (const tpId of requiredTps) {
      ws.send(JSON.stringify({ type: 'survival_tp_done', tpId, score: 20 }));
    }
    const endedMsg = await endedP;
    assert.equal(endedMsg.ended.outcome, 'victory');
    const finalCoins = Object.values(endedMsg.ended.coinRewards || {})[0]?.coins;
    assert.equal(finalCoins, 40 + 40 + 6 * 15 + 150);
  } finally {
    if (ws && ws.readyState <= 1) ws.close();
    wsHub.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('v4.24 : mini-jeux CIEL OS (6 jeux), bonus nouveau record et validation anti-triche serveur', async () => {
  const gameCtors = [
    [CyberSnakeGame, 'snake', 140, 32],
    [CielMinesweeperGame, 'minesweeper', 90, 22],
    [CielBlocksGame, 'tetris', 1000, 35],
    [NetworkBreakoutGame, 'breakout', 400, 35],
    [FlappyPacketGame, 'flappy', 25, 45],
    [Ciel2048Game, 'game2048', 2048, 45]
  ];

  for (const [Ctor, gameId, sampleScore, expectedBase] of gameCtors) {
    let emitted = null;
    const game = new Ctor({
      onGameEnd: (id, score, meta) => {
        emitted = { gameId: id, score, ...meta };
      }
    });
    game.score = sampleScore;
    game._emitGameEnd(true);
    assert.ok(emitted);
    assert.equal(emitted.gameId, gameId);
    assert.equal(emitted.score, sampleScore);

    const calc = computeArcadeCoinReward({ gameId, score: sampleScore, isNewRecord: false });
    assert.equal(calc.valid, true);
    assert.equal(calc.baseCoins, expectedBase);
    assert.ok(ARCADE_GAME_RULES[gameId]);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ciel-econ-arcade-'));
  const dbPath = path.join(tmpDir, 'db.json');
  const accountsPath = path.join(tmpDir, 'accounts.json');
  const mapPath = path.join(tmpDir, 'map.json');
  const { server, wsHub } = createGameServer({ dbPath, accountsPath, mapPath });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const reg = await apiJson(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { username: 'ArcadePro', password: 'arcade-pass-1' }
    });
    const token = reg.data.token;

    const regSpam = await apiJson(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { username: 'ArcadeSpam', password: 'arcade-pass-2' }
    });
    const spamToken = regSpam.data.token;

    const noAuth = await apiJson(baseUrl, '/api/economy/arcade', {
      method: 'POST',
      body: { name: 'ArcadePro', gameId: 'snake', score: 150 }
    });
    assert.equal(noAuth.status, 401);

    const wrongTarget = await apiJson(baseUrl, '/api/economy/arcade', {
      method: 'POST',
      token,
      body: { name: 'ArcadeSpam', gameId: 'snake', score: 150 }
    });
    assert.equal(wrongTarget.status, 403);

    const zeroScore = await apiJson(baseUrl, '/api/economy/arcade', {
      method: 'POST',
      token,
      body: { gameId: 'snake', score: 0 }
    });
    assert.equal(zeroScore.status, 400);

    const cheatScore = await apiJson(baseUrl, '/api/economy/arcade', {
      method: 'POST',
      token,
      body: { gameId: 'snake', score: 999999 }
    });
    assert.equal(cheatScore.status, 400);

    const badGame = await apiJson(baseUrl, '/api/economy/arcade', {
      method: 'POST',
      token,
      body: { gameId: 'cheat_hack', score: 100 }
    });
    assert.equal(badGame.status, 400);

    const r1 = await apiJson(baseUrl, '/api/economy/arcade', {
      method: 'POST',
      token,
      body: { gameId: 'snake', score: 140 }
    });
    assert.equal(r1.status, 200);
    assert.equal(r1.data.isNewRecord, true);
    assert.equal(r1.data.coinsEarned, 32 + ARCADE_NEW_RECORD_BONUS);
    assert.equal(r1.data.coins, 47);

    const r2 = await apiJson(baseUrl, '/api/economy/arcade', {
      method: 'POST',
      token,
      body: { gameId: 'snake', score: 60 }
    });
    assert.equal(r2.status, 200);
    assert.equal(r2.data.isNewRecord, false);
    assert.equal(r2.data.coinsEarned, 20);
    assert.equal(r2.data.coins, 67);

    let lastStatus = 200;
    for (let i = 0; i < 14; i++) {
      const burst = await apiJson(baseUrl, '/api/economy/arcade', {
        method: 'POST',
        token: spamToken,
        body: { gameId: 'flappy', score: 5 + i }
      });
      lastStatus = burst.status;
    }
    assert.equal(lastStatus, 429);
  } finally {
    wsHub.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('v4.24 : boutique HTTP/WS (refus solde insuffisant, achat, doublon, équipement persistant et sync multijoueur)', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ciel-shop-buy-'));
  const dbPath = path.join(tmpDir, 'db.json');
  const accountsPath = path.join(tmpDir, 'accounts.json');
  const mapPath = path.join(tmpDir, 'map.json');
  const { server, store, wsHub } = createGameServer({ dbPath, accountsPath, mapPath });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const wsUrl = `ws://127.0.0.1:${port}/ws`;

  let wsA = null;
  let wsB = null;
  try {
    const regA = await apiJson(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: { username: 'BuyerAlice', password: 'buyer-pass-1' }
    });
    const tokenA = regA.data.token;

    const catRes = await apiJson(baseUrl, '/api/shop/catalog');
    assert.equal(catRes.status, 200);
    assert.equal(catRes.data.catalog.length, SHOP_CATALOG.length);

    const tooPoor = await apiJson(baseUrl, '/api/shop/buy', {
      method: 'POST',
      token: tokenA,
      body: { itemId: 'shop_neon_tech' }
    });
    assert.equal(tooPoor.status, 400);

    const unownedEquip = await apiJson(baseUrl, '/api/shop/equip', {
      method: 'POST',
      token: tokenA,
      body: { itemId: 'shop_neon_tech', equip: true }
    });
    assert.equal(unownedEquip.status, 403);

    store.awardCoins('BuyerAlice', 1500, 'test');

    const buySkin = await apiJson(baseUrl, '/api/shop/buy', {
      method: 'POST',
      token: tokenA,
      body: { itemId: 'shop_neon_tech' }
    });
    assert.equal(buySkin.status, 200);
    assert.equal(buySkin.data.coins, 1350);

    const dupBuy = await apiJson(baseUrl, '/api/shop/buy', {
      method: 'POST',
      token: tokenA,
      body: { itemId: 'shop_neon_tech' }
    });
    assert.equal(dupBuy.status, 409);

    const buyPet = await apiJson(baseUrl, '/api/shop/buy', {
      method: 'POST',
      token: tokenA,
      body: { itemId: 'pet_drone_quadri' }
    });
    assert.equal(buyPet.status, 200);
    assert.equal(buyPet.data.coins, 450);

    const buyAcc = await apiJson(baseUrl, '/api/shop/buy', {
      method: 'POST',
      token: tokenA,
      body: { itemId: 'acc_holo_visor' }
    });
    assert.equal(buyAcc.status, 200);
    assert.equal(buyAcc.data.coins, 270);

    wsA = await openWs(wsUrl);
    const wA = waitForMsg(wsA, (m) => m.type === 'welcome');
    wsA.send(JSON.stringify({ type: 'join', name: 'BuyerAlice', room: 'plateau-u300' }));
    await wA;

    wsB = await openWs(wsUrl);
    const wB = waitForMsg(wsB, (m) => m.type === 'welcome');
    wsB.send(JSON.stringify({ type: 'join', name: 'ViewerBob', room: 'plateau-u300' }));
    await wB;

    const pSkinOnB = waitForMsg(
      wsB,
      (m) => m.type === 'player_skin_updated' && m.name === 'BuyerAlice' && m.equippedSkin === 'shop_neon_tech'
    );
    wsA.send(JSON.stringify({ type: 'shop_equip', itemId: 'shop_neon_tech', equip: true }));
    const skinEv = await pSkinOnB;
    assert.equal(skinEv.skin.shopSkinId, 'shop_neon_tech');

    const pPetOnB = waitForMsg(
      wsB,
      (m) => m.type === 'player_skin_updated' && m.name === 'BuyerAlice' && m.equippedPet === 'pet_drone_quadri'
    );
    wsA.send(JSON.stringify({ type: 'shop_equip', itemId: 'pet_drone_quadri', equip: true }));
    await pPetOnB;

    const pAccOnB = waitForMsg(
      wsB,
      (m) => m.type === 'player_skin_updated' && m.name === 'BuyerAlice' && m.equippedTrail === 'acc_holo_visor'
    );
    wsA.send(JSON.stringify({ type: 'shop_equip', itemId: 'acc_holo_visor', equip: true }));
    const finalEv = await pAccOnB;
    assert.equal(finalEv.equippedSkin, 'shop_neon_tech');
    assert.equal(finalEv.equippedPet, 'pet_drone_quadri');
    assert.equal(finalEv.equippedTrail, 'acc_holo_visor');

    const pUnequipPetOnB = waitForMsg(
      wsB,
      (m) => m.type === 'player_skin_updated' && m.name === 'BuyerAlice' && m.equippedPet === null
    );
    wsA.send(
      JSON.stringify({ type: 'shop_equip', itemId: 'pet_drone_quadri', category: 'pets', equip: false })
    );
    await pUnequipPetOnB;

    const reloaded = new GameStore(dbPath, { accountsPath });
    const prof = reloaded.getPublicProfile('buyeralice');
    assert.equal(prof.coins, 270);
    assert.deepEqual(prof.ownedItems, ['shop_neon_tech', 'pet_drone_quadri', 'acc_holo_visor']);
    assert.equal(prof.equippedSkin, 'shop_neon_tech');
    assert.equal(prof.equippedPet, null);
    assert.equal(prof.equippedTrail, 'acc_holo_visor');
  } finally {
    if (wsA && wsA.readyState <= 1) wsA.close();
    if (wsB && wsB.readyState <= 1) wsB.close();
    wsHub.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('v4.24 : builders 3D (8 skins, 6 pets optimisés FPS, accessoires), RemotePlayers pets, ShopModal ViewModel & borne 3D', () => {
  const scene = new THREE.Scene();
  const mapData = createDefaultMap();
  const lab = buildLabWorld(scene, mapData, { hideSprites: true });
  const remotePlayers = new RemotePlayersManager(scene);

  try {
    for (const skinSpec of SHOP_SKINS) {
      const av = buildStudentAvatarMesh(applyShopSkin({}, skinSpec.id));
      assert.equal(av.hasShopSkin(), true, `Skin manquant: ${skinSpec.id}`);
      assert.equal(av.getShopSkinId(), skinSpec.id);
      av.updateEffects(0.42);
    }

    for (const accSpec of SHOP_ACCESSORIES) {
      const av = buildStudentAvatarMesh({ equippedTrail: accSpec.id });
      assert.equal(av.hasShopAccessory(), true, `Accessoire manquant: ${accSpec.id}`);
      assert.equal(av.getShopAccessoryId(), accSpec.id);
      av.updateEffects(0.42);
    }

    for (const petSpec of SHOP_PETS) {
      const pet = buildPetMesh(petSpec.id);
      assert.equal(pet.petId, petSpec.id);
      let frozenCount = 0;
      pet.group.traverse((child) => {
        if (child.isMesh && child.matrixAutoUpdate === false) {
          frozenCount++;
        }
      });
      if (petSpec.id !== 'pet_cube_holo') {
        assert.ok(frozenCount >= 1, `Meshes statiques figés attendus pour pet ${petSpec.id}`);
      }
      pet.snapToOwner(new THREE.Vector3(0, 0, 0), 0);
      pet.update(0.016, 0.5, new THREE.Vector3(2.2, 0, -1.5), 0.5);
      assert.ok(Number.isFinite(pet.group.position.x));
      pet.dispose();
    }

    remotePlayers.upsertPeer({
      id: 'peer-shop-1',
      name: 'Chloe',
      x: 1,
      y: 0,
      z: 2,
      yaw: 0.4,
      skin: { shopSkinId: 'shop_cyber_samurai', equippedPet: 'pet_laser_falcon', equippedTrail: 'acc_quantum_wings' },
      equippedPet: 'pet_laser_falcon'
    });
    const peer = remotePlayers.peers.get('peer-shop-1');
    assert.ok(peer.petMesh);
    assert.equal(peer.equippedPet, 'pet_laser_falcon');
    remotePlayers.update(0.016, 1.0);
    remotePlayers.setPeerPovHidden('peer-shop-1', true);
    assert.equal(peer.petMesh.group.visible, false);
    remotePlayers.setPeerPovHidden('peer-shop-1', false);
    assert.equal(peer.petMesh.group.visible, true);
    remotePlayers.removePeer('peer-shop-1');
    assert.equal(remotePlayers.peers.has('peer-shop-1'), false);

    assert.ok(Array.isArray(lab.shopKiosks) && lab.shopKiosks.length >= 1);
    const kiosk = lab.interactables.find((it) => it.type === 'shop_kiosk');
    assert.ok(kiosk);
    assert.equal(kiosk.label, '[E] 🛒 Ouvrir la Boutique CIEL');

    const vm = buildShopViewModel(
      {
        coins: 500,
        ownedItems: ['shop_neon_tech', 'pet_cube_holo'],
        equippedSkin: 'shop_neon_tech',
        equippedPet: null,
        equippedTrail: null
      },
      'skins'
    );
    assert.equal(vm.coins, 500);
    const neonRow = vm.items.find((it) => it.id === 'shop_neon_tech');
    assert.equal(neonRow.owned, true);
    assert.equal(neonRow.equipped, true);
    const goldRow = vm.items.find((it) => it.id === 'shop_overclocked_gold');
    assert.equal(goldRow.owned, false);
    assert.equal(goldRow.canAfford, false);
  } finally {
    remotePlayers.clearAll();
    lab.dispose();
  }
});
