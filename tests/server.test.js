import assert from 'node:assert/strict';
import test from 'node:test';
import { WebSocket } from 'ws';
import { createGameServer } from '../server/index.js';
import { GameStore, TP_IDS } from '../server/store.js';

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
    ws2.send(JSON.stringify({ type: 'join', name: 'Bob', room: 'salle-e204' }));

    const [joinedMsg, w2] = await Promise.all([p1SeesP2, p2Welcome]);
    assert.equal(joinedMsg.player.name, 'Bob');
    assert.equal(w2.peers.length, 1);
    assert.equal(w2.peers[0].name, 'Alice');

    // Movement sync
    const p1SeesMove = nextMsg(ws1, 'player_moved');
    ws2.send(JSON.stringify({ type: 'move', x: 3.5, y: 0, z: -2.1, yaw: 1.2 }));
    const moved = await p1SeesMove;
    assert.equal(moved.x, 3.5);
    assert.equal(moved.z, -2.1);

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

    ws1.close();
    ws2.close();
  } finally {
    wsHub.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
