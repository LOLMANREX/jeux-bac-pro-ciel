import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { WebSocket } from 'ws';
import { createGameServer } from '../server/index.js';
import { GameStore, TP_IDS } from '../server/store.js';
import { buildWebSocketUrl } from '../src/core/network.js';

test('GameStore enregistre les notes /20 et débloque le diplôme après 5 TPs >= 10', () => {
  const store = new GameStore(null); // in-memory mode
  const profile = store.getOrCreatePlayer('Lucas_CIEL');
  assert.equal(profile.name, 'Lucas_CIEL');
  assert.equal(profile.diplomaEarned, false);

  TP_IDS.forEach((tpId, i) => {
    store.recordTpScore('Lucas_CIEL', tpId, 14 + i, 90);
  });

  const updated = store.getOrCreatePlayer('Lucas_CIEL');
  assert.equal(updated.completedCount, 5);
  assert.equal(updated.average, 16);
  assert.equal(updated.diplomaEarned, true);
  assert.ok(updated.xp > 0);
});

test('Serveur HTTP + WebSocket multijoueur synchronise 2 élèves en temps réel', async () => {
  const { server, wsHub } = createGameServer({ dbPath: null });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const wsUrl = `ws://127.0.0.1:${port}/ws`;

  try {
    // Health endpoint
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const health = await healthRes.json();
    assert.equal(health.ok, true);

    // Connect two multiplayer clients
    const ws1 = new WebSocket(wsUrl);
    const ws2 = new WebSocket(wsUrl);

    const nextMsg = (sock, matchType) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${matchType}`)), 3000);
        const handler = (raw) => {
          const msg = JSON.parse(raw.toString('utf8'));
          if (msg.type === matchType) {
            clearTimeout(timer);
            sock.off('message', handler);
            resolve(msg);
          }
        };
        sock.on('message', handler);
      });

    await Promise.all([
      new Promise((r) => ws1.once('open', r)),
      new Promise((r) => ws2.once('open', r))
    ]);

    const p1Welcome = nextMsg(ws1, 'welcome');
    ws1.send(JSON.stringify({ type: 'join', name: 'Alice', room: 'salle-e204' }));
    const w1 = await p1Welcome;
    assert.equal(w1.profile.name, 'Alice');

    const p1SeesP2 = nextMsg(ws1, 'player_joined');
    const p2Welcome = nextMsg(ws2, 'welcome');
    ws2.send(
      JSON.stringify({
        type: 'join',
        name: 'Bob',
        room: 'salle-e204',
        skin: { outfitColor: '#10b981', outfitStyle: 'cyber', hat: 'headset' }
      })
    );

    const [joinedMsg, w2] = await Promise.all([p1SeesP2, p2Welcome]);
    assert.equal(joinedMsg.player.name, 'Bob');
    assert.equal(joinedMsg.player.skin.outfitStyle, 'cyber');
    assert.equal(joinedMsg.player.skin.hat, 'headset');
    assert.equal(w2.peers.length, 1);
    assert.equal(w2.peers[0].name, 'Alice');

    // Movement + jump Y sync
    const p1SeesMove = nextMsg(ws1, 'player_moved');
    ws2.send(JSON.stringify({ type: 'move', x: 3.5, y: 0.95, z: -2.1, yaw: 1.2 }));
    const moved = await p1SeesMove;
    assert.equal(moved.x, 3.5);
    assert.equal(moved.y, 0.95);
    assert.equal(moved.z, -2.1);

    // Rooms list API
    const roomsRes = await fetch(`${baseUrl}/api/rooms`);
    const roomsData = await roomsRes.json();
    const e204 = roomsData.rooms.find((r) => r.room === 'salle-e204');
    assert.equal(e204.count, 2);

    // Score submission over WS
    const scoreRecorded = nextMsg(ws1, 'score_recorded');
    ws1.send(JSON.stringify({ type: 'submit_score', tpId: 'oscilloscope', score: 18, durationSec: 45 }));
    const rec = await scoreRecorded;
    assert.equal(rec.score, 18);
    assert.equal(rec.profile.grades.oscilloscope, 18);

    // Leaderboard check
    const lbRes = await fetch(`${baseUrl}/api/leaderboard`);
    const lb = await lbRes.json();
    assert.equal(lb.leaderboard[0].name, 'Alice');
    assert.equal(lb.leaderboard[0].online, true);

    const p1SkinUpdate = nextMsg(ws1, 'player_skin_updated');
    const p1LbSkinUpdate = nextMsg(ws1, 'leaderboard_updated');
    ws2.send(
      JSON.stringify({
        type: 'update_skin',
        skin: { outfitColor: '#f43f5e', outfitStyle: 'hoodie', hat: 'cap' }
      })
    );
    const [skinEv, lbAfterSkin] = await Promise.all([p1SkinUpdate, p1LbSkinUpdate]);
    assert.equal(skinEv.skin.outfitColor, '#f43f5e');
    assert.equal(skinEv.skin.outfitStyle, 'hoodie');
    assert.equal(skinEv.skin.hat, 'cap');
    const bobEntry = lbAfterSkin.leaderboard.find((e) => e.name === 'Bob');
    assert.equal(bobEntry.skin.outfitColor, '#f43f5e');

    const p1Emote = nextMsg(ws1, 'player_emote');
    ws2.send(JSON.stringify({ type: 'emote', emoteId: 'wave', label: '👋 Salut !' }));
    const emoteEv = await p1Emote;
    assert.equal(emoteEv.label, '👋 Salut !');

    const p2Announcement = nextMsg(ws2, 'tp_announcement');
    const p2Stats = nextMsg(ws2, 'player_stats_updated');
    ws1.send(JSON.stringify({ type: 'submit_score', tpId: 'vmvlan', score: 17, durationSec: 55 }));
    const [ann, stats] = await Promise.all([p2Announcement, p2Stats]);
    assert.ok(ann.message.includes('Alice'));
    assert.ok(ann.message.includes('17/20'));
    assert.equal(stats.profile.average, 17.5);

    ws1.close();
    ws2.close();
  } finally {
    wsHub.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('GameStore assure la rétrocompatibilité db.json et persiste skin, moyenne et diplômes', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ciel-store-'));
  const tmpDb = path.join(tmpDir, 'db.json');
  try {
    fs.writeFileSync(
      tmpDb,
      JSON.stringify({
        players: {
          louis: {
            name: 'Louis',
            color: '#a78bfa',
            xp: 241,
            questAccepted: true,
            grades: { soldering: 12.7 },
            bestTimes: { soldering: 48 },
            diplomaEarned: false,
            updatedAt: '2026-11-12T20:17:23.572Z'
          }
        }
      })
    );

    const store = new GameStore(tmpDb);
    const legacy = store.getOrCreatePlayer('Louis');
    assert.equal(legacy.name, 'Louis');
    assert.equal(legacy.xp, 241);
    assert.equal(legacy.average, 12.7);
    assert.equal(legacy.skin.outfitColor, '#a78bfa');
    assert.deepEqual(legacy.diplomas, []);

    store.updatePlayerSkin('Louis', {
      outfitColor: '#10b981',
      outfitStyle: 'cyber',
      hat: 'headset'
    });
    for (const id of ['oscilloscope', 'electronics', 'antivirus', 'vmvlan']) {
      store.recordTpScore('Louis', id, 17, 40);
    }

    const reloaded = new GameStore(tmpDb);
    const persisted = reloaded.getOrCreatePlayer('Louis');
    assert.equal(persisted.skin.outfitColor, '#10b981');
    assert.equal(persisted.skin.outfitStyle, 'cyber');
    assert.equal(persisted.diplomaEarned, true);
    assert.ok(persisted.average > 15);
    assert.ok(persisted.diplomas.length >= 1);

    const lb = reloaded.getLeaderboard(10);
    assert.equal(lb[0].rank, 1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('buildWebSocketUrl gère HTTPS/WSS et HTTP/WS dynamiquement sans port codé en dur', () => {
  assert.equal(
    buildWebSocketUrl({ protocol: 'https:', host: 'ciel.monlycee.fr' }),
    'wss://ciel.monlycee.fr/ws'
  );
  assert.equal(
    buildWebSocketUrl({ protocol: 'http:', host: '192.168.1.50:8080' }),
    'ws://192.168.1.50:8080/ws'
  );
});

test('Multi-onglet : deux connexions avec le même pseudo coexistent avec suffixe #2 dans salle-e204', async () => {
  const { server, wsHub } = createGameServer({ dbPath: null });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const wsUrl = `ws://127.0.0.1:${port}/ws`;

  try {
    const ws1 = new WebSocket(wsUrl);
    const ws2 = new WebSocket(wsUrl);

    const waitType = (sock, type) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout ${type}`)), 3000);
        const handler = (raw) => {
          const msg = JSON.parse(raw.toString('utf8'));
          if (msg.type === type) {
            clearTimeout(timer);
            sock.off('message', handler);
            resolve(msg);
          }
        };
        sock.on('message', handler);
      });

    await Promise.all([
      new Promise((r) => ws1.once('open', r)),
      new Promise((r) => ws2.once('open', r))
    ]);

    const w1Promise = waitType(ws1, 'welcome');
    ws1.send(JSON.stringify({ type: 'join', name: 'Lucas' }));
    const w1 = await w1Promise;
    assert.equal(w1.room, 'salle-e204');
    assert.equal(w1.profile.name, 'Lucas');

    const w2Promise = waitType(ws2, 'welcome');
    const p1Joined = waitType(ws1, 'player_joined');
    ws2.send(JSON.stringify({ type: 'join', name: 'Lucas' }));
    const [w2, joined] = await Promise.all([w2Promise, p1Joined]);

    assert.equal(w2.room, 'salle-e204');
    assert.equal(w2.profile.name, 'Lucas#2');
    assert.equal(w2.onlineCount, 2);
    assert.equal(w2.peers.length, 1);
    assert.equal(joined.player.name, 'Lucas#2');
    assert.equal(joined.onlineCount, 2);
    assert.equal(ws1.readyState, WebSocket.OPEN);
    assert.equal(ws2.readyState, WebSocket.OPEN);

    const pongPromise = waitType(ws2, 'pong');
    ws2.send(JSON.stringify({ type: 'ping' }));
    const pong = await pongPromise;
    assert.equal(pong.onlineCount, 2);
    assert.equal(pong.totalOnline, 2);

    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.ok((healthRes.headers.get('cache-control') || '').includes('no-store'));
    const health = await healthRes.json();
    assert.equal(health.playersOnline, 2);

    ws1.close();
    ws2.close();
  } finally {
    wsHub.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
