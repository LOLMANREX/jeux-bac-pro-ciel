import assert from 'node:assert/strict';
import test from 'node:test';
import { WebSocket } from 'ws';
import { createGameServer } from '../server/index.js';
import {
  METAL_PIPE,
  computeLaunchVelocity,
  computeTumble,
  validateMetalPipeHit
} from '../src/core/metalPipe.js';

test('Metal Pipe Bat : vitesse de lancement plafonnée à 3 mètres et rotation qui se stabilise', () => {
  const v = computeLaunchVelocity(99);
  const apex = (v * v) / (2 * METAL_PIPE.gravity);
  assert.ok(apex <= METAL_PIPE.launchHeight + 0.001);
  assert.ok(apex >= METAL_PIPE.launchHeight - 0.05);
  for (const seed of [0, 0.2, 0.5, 0.77, 0.99]) {
    const end = computeTumble(METAL_PIPE.durationMs, METAL_PIPE.durationMs, seed);
    assert.equal(end.done, true);
    assert.ok(Math.abs(Math.sin(end.x)) < 1e-6);
    assert.ok(Math.abs(Math.sin(end.z)) < 1e-6);
    const mid = computeTumble(METAL_PIPE.durationMs * 0.3, METAL_PIPE.durationMs, seed);
    assert.ok(Math.abs(mid.x) > 0.5);
  }
});

test('Metal Pipe Bat : validation de coup (portée, recharge, soi-même, cible déjà projetée)', () => {
  const attacker = { x: 0, y: 0, z: 0, pipeLastHitAt: 0 };
  const near = { x: 2, y: 0, z: 0, pipeLaunchUntil: 0 };
  const now = Date.now();
  assert.equal(validateMetalPipeHit({ attacker, target: near, now }).ok, true);
  assert.equal(validateMetalPipeHit({ attacker, target: attacker, now }).ok, false);
  assert.equal(validateMetalPipeHit({ attacker, target: { x: 40, y: 0, z: 0 }, now }).ok, false);
  assert.equal(
    validateMetalPipeHit({ attacker, target: { ...near, pipeLaunchUntil: now + 500 }, now }).ok,
    false
  );
  assert.equal(
    validateMetalPipeHit({ attacker: { ...attacker, pipeLastHitAt: now - 100 }, target: near, now }).ok,
    false
  );
});

test('Metal Pipe Bat : seuls les administrateurs munis d’un laissez-passer serveur peuvent frapper', async () => {
  const { server } = createGameServer({ dbPath: null, adminPassword: 'pipe-secret' });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const wsUrl = `ws://127.0.0.1:${port}/ws`;
  const sockets = [];

  const collect = (sock) => {
    const log = [];
    sock.on('message', (raw) => log.push(JSON.parse(raw.toString('utf8'))));
    return log;
  };
  const waitFor = async (log, type, ms = 1500) => {
    const start = Date.now();
    while (Date.now() - start < ms) {
      const found = log.find((m) => m.type === type);
      if (found) return found;
      await new Promise((r) => setTimeout(r, 15));
    }
    return null;
  };
  const connect = async (name) => {
    const sock = new WebSocket(wsUrl);
    sockets.push(sock);
    const log = collect(sock);
    await new Promise((r) => sock.once('open', r));
    sock.send(JSON.stringify({ type: 'join', name, room: 'plateau-u300' }));
    const welcome = await waitFor(log, 'welcome');
    assert.ok(welcome);
    return { sock, log, id: welcome.id || welcome.clientId || welcome.selfId };
  };

  try {
    const denied = await fetch(`${baseUrl}/api/admin/metal-pipe/pass`, { method: 'POST' });
    assert.equal(denied.status, 401);

    const login = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'pipe-secret' })
    }).then((r) => r.json());
    const passRes = await fetch(`${baseUrl}/api/admin/metal-pipe/pass`, {
      method: 'POST',
      headers: { 'x-admin-token': login.token }
    }).then((r) => r.json());
    assert.ok(passRes.pass);

    const victim = await connect('Victime');
    const normal = await connect('Eleve');
    const admin = await connect('AdminBat');
    assert.ok(victim.id && admin.id);

    normal.sock.send(JSON.stringify({ type: 'metal_pipe_equip', enabled: true, pass: 'faux' }));
    assert.ok(await waitFor(normal.log, 'metal_pipe_denied'));
    normal.sock.send(JSON.stringify({ type: 'metal_pipe_hit', targetId: victim.id }));
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(victim.log.some((m) => m.type === 'metal_pipe_launch'), false);

    admin.sock.send(JSON.stringify({ type: 'metal_pipe_equip', enabled: true, pass: passRes.pass }));
    await new Promise((r) => setTimeout(r, 200));
    const equipped = victim.log.find((m) => m.type === 'metal_pipe_equipped' && m.id === admin.id);
    assert.equal(equipped.enabled, true);

    admin.sock.send(JSON.stringify({ type: 'metal_pipe_hit', targetId: victim.id }));
    const launch = await waitFor(victim.log, 'metal_pipe_launch');
    assert.ok(launch);
    assert.equal(launch.targetId, victim.id);
    assert.equal(launch.height, METAL_PIPE.launchHeight);

    admin.sock.send(JSON.stringify({ type: 'metal_pipe_hit', targetId: victim.id }));
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(victim.log.filter((m) => m.type === 'metal_pipe_launch').length, 1);

    await fetch(`${baseUrl}/api/admin/metal-pipe/pass`, {
      method: 'DELETE',
      headers: { 'x-admin-token': login.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pass: passRes.pass })
    });
    await new Promise((r) => setTimeout(r, 1000));
    admin.sock.send(JSON.stringify({ type: 'metal_pipe_hit', targetId: victim.id }));
    assert.ok(await waitFor(admin.log, 'metal_pipe_denied'));
  } finally {
    for (const s of sockets) s.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
