import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as THREE from 'three';
import { WebSocket } from 'ws';
import { createGameServer } from '../server/index.js';
import { formatCelebrationBanner, isCreatorPseudo, isPrivateDebugRoom } from '../server/wsHub.js';
import { buildPrivateDebugUrl, requestPrivateDebugSession } from '../src/admin.js';
import { APP_VERSION, CHANGELOG_RELEASES } from '../src/ui/ChangelogModal.js';
import { formatWorldCelebrationBanner } from '../src/ui/HudManager.js';
import { buildStudentAvatarMesh, isCreatorLouis, normalizeSkin } from '../src/world/AvatarBuilder.js';
import { createWorldCelebrationRig } from '../src/world/SceneManager.js';

function waitForWsMsg(sock, predicate, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      sock.off('message', handler);
      reject(new Error('Timeout waiting for WS message'));
    }, timeoutMs);
    const handler = (raw) => {
      const msg = JSON.parse(raw.toString('utf8'));
      if (predicate(msg)) {
        clearTimeout(timer);
        sock.off('message', handler);
        resolve(msg);
      }
    };
    sock.on('message', handler);
  });
}

function assertNoWsMsg(sock, predicate, waitMs = 220) {
  return new Promise((resolve, reject) => {
    const handler = (raw) => {
      const msg = JSON.parse(raw.toString('utf8'));
      if (predicate(msg)) {
        clearTimeout(timer);
        sock.off('message', handler);
        reject(new Error(`Unexpected WS message: ${msg.type}`));
      }
    };
    const timer = setTimeout(() => {
      sock.off('message', handler);
      resolve();
    }, waitMs);
    sock.on('message', handler);
  });
}

test('v4.7 : Cinématique Mondiale 20/20 diffuse world_celebration à toute la salle et anime les feux d’artifice 3D', async () => {
  const banner = formatCelebrationBanner('Lucas_CIEL', 'TP Oscilloscope & Diagnostic 3D');
  assert.equal(
    banner,
    '🏆 EXPLOIT CIEL : Lucas_CIEL a décroché 20/20 au TP Oscilloscope & Diagnostic 3D !'
  );
  assert.equal(
    formatWorldCelebrationBanner('Emma', 'Brasure PCB 3D'),
    '🏆 EXPLOIT CIEL : Emma a décroché 20/20 au TP Brasure PCB 3D !'
  );

  const scene = new THREE.Scene();
  const rig = createWorldCelebrationRig(scene);
  assert.equal(rig.isActive(), false);
  const info = rig.trigger({ duration: 8, center: { x: -2, z: 1 } });
  assert.equal(info.active, true);
  assert.equal(info.duration, 8);
  assert.ok(info.particleCount >= 100);
  assert.ok(info.fireworkCount >= 4);
  assert.ok(info.lightCount >= 3);
  assert.equal(rig.root.visible, true);
  assert.equal(rig.update(1.0, 1.0), true);
  assert.ok(rig.dynamicLights[0].intensity > 0);
  assert.equal(rig.update(7.5, 8.5), false);
  assert.equal(rig.isActive(), false);
  assert.equal(rig.root.visible, false);

  const { server, wsHub } = createGameServer({ dbPath: null });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const wsUrl = `ws://127.0.0.1:${port}/ws`;

  const ws1 = new WebSocket(wsUrl);
  const ws2 = new WebSocket(wsUrl);

  try {
    await Promise.all([
      new Promise((r) => ws1.once('open', r)),
      new Promise((r) => ws2.once('open', r))
    ]);

    const w1P = waitForWsMsg(ws1, (m) => m.type === 'welcome');
    ws1.send(JSON.stringify({ type: 'join', name: 'Alice20', room: 'plateau-u300' }));
    await w1P;

    const w2P = waitForWsMsg(ws2, (m) => m.type === 'welcome');
    ws2.send(JSON.stringify({ type: 'join', name: 'BobSpectateur', room: 'plateau-u300' }));
    await w2P;

    const c1CelebP = waitForWsMsg(ws1, (m) => m.type === 'world_celebration');
    const c2CelebP = waitForWsMsg(ws2, (m) => m.type === 'world_celebration');
    ws1.send(
      JSON.stringify({
        type: 'submit_score',
        tpId: 'oscilloscope',
        score: 20,
        durationSec: 52
      })
    );

    const [celeb1, celeb2] = await Promise.all([c1CelebP, c2CelebP]);
    assert.equal(celeb1.score, 20);
    assert.equal(celeb2.playerName, 'Alice20');
    assert.ok(celeb2.bannerText.includes('🏆 EXPLOIT CIEL : Alice20 a décroché 20/20 au TP'));
    assert.equal(celeb2.durationMs, 8000);
  } finally {
    ws1.close();
    ws2.close();
    wsHub.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('v4.7 : Pouvoir Exclusif Créateur réservé à Louis (insensible à la casse) et synchronisation Aura Dorée 3D', async () => {
  assert.equal(isCreatorLouis('Louis'), true);
  assert.equal(isCreatorLouis('louis'), true);
  assert.equal(isCreatorLouis('  LOUIS '), true);
  assert.equal(isCreatorPseudo('Louis'), true);
  assert.equal(isCreatorLouis('Lucas'), false);
  assert.equal(isCreatorPseudo('Camille'), false);

  const skinWithAura = normalizeSkin({ outfitColor: '#fbbf24', creatorAura: true });
  assert.equal(skinWithAura.creatorAura, true);
  const avatar = buildStudentAvatarMesh(skinWithAura);
  assert.equal(avatar.hasCreatorAura(), true);
  assert.equal(avatar.creatorAuraGroup.visible, true);
  avatar.updateEffects(1.25);
  avatar.setCreatorAura(false);
  assert.equal(avatar.hasCreatorAura(), false);
  avatar.setCreatorAura(true);
  assert.equal(avatar.hasCreatorAura(), true);

  const { server, wsHub } = createGameServer({ dbPath: null });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const wsUrl = `ws://127.0.0.1:${port}/ws`;

  const wsLouis = new WebSocket(wsUrl);
  const wsPeer = new WebSocket(wsUrl);

  try {
    await Promise.all([
      new Promise((r) => wsLouis.once('open', r)),
      new Promise((r) => wsPeer.once('open', r))
    ]);

    const wLouisP = waitForWsMsg(wsLouis, (m) => m.type === 'welcome');
    wsLouis.send(JSON.stringify({ type: 'join', name: 'lOuIs', room: 'plateau-u300' }));
    await wLouisP;

    const wPeerP = waitForWsMsg(wsPeer, (m) => m.type === 'welcome');
    wsPeer.send(JSON.stringify({ type: 'join', name: 'EleveClasse', room: 'plateau-u300' }));
    await wPeerP;

    const peerSeesAura = waitForWsMsg(wsPeer, (m) => m.type === 'creator_aura_updated');
    wsLouis.send(JSON.stringify({ type: 'creator_aura', enabled: true }));
    const auraEv = await peerSeesAura;
    assert.equal(auraEv.enabled, true);
    assert.equal(auraEv.skin.creatorAura, true);

    const peerSeesCeleb = waitForWsMsg(wsPeer, (m) => m.type === 'world_celebration');
    wsLouis.send(JSON.stringify({ type: 'trigger_celebration', tpId: 'soldering' }));
    const celebEv = await peerSeesCeleb;
    assert.equal(celebEv.reason, 'creator');
    assert.ok(celebEv.bannerText.includes('20/20'));
  } finally {
    wsLouis.close();
    wsPeer.close();
    wsHub.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('v4.7 : Serveur Privé Debug isolé des salons publics et outils de validation 20/20 + reset', async () => {
  assert.equal(isPrivateDebugRoom('priv-debug-a1b2c3'), true);
  assert.equal(isPrivateDebugRoom('plateau-u300'), false);
  const builtUrl = buildPrivateDebugUrl('priv-debug-test01');
  assert.equal(builtUrl, '/?debug=1&room=priv-debug-test01');

  const { server, wsHub } = createGameServer({ dbPath: null });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const wsUrl = `ws://127.0.0.1:${port}/ws`;

  let wsPublic = null;
  let wsPrivate = null;

  try {
    const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: process.env.ADMIN_PASSWORD || 'Louisetjade1102' })
    });
    const { token } = await loginRes.json();

    const dbgSession = await requestPrivateDebugSession(async (url, opts) => {
      const r = await fetch(`${baseUrl}${url}`, {
        ...opts,
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token
        }
      });
      return r.json();
    });
    assert.equal(dbgSession.ok, true);
    assert.equal(dbgSession.isolated, true);
    assert.ok(dbgSession.room.startsWith('priv-debug-'));
    assert.equal(dbgSession.badge, '🛠️ SERVEUR PRIVÉ DEBUG');

    wsPublic = new WebSocket(wsUrl);
    wsPrivate = new WebSocket(wsUrl);
    await Promise.all([
      new Promise((r) => wsPublic.once('open', r)),
      new Promise((r) => wsPrivate.once('open', r))
    ]);

    const wPubP = waitForWsMsg(wsPublic, (m) => m.type === 'welcome');
    wsPublic.send(JSON.stringify({ type: 'join', name: 'ElevePublic', room: 'plateau-u300' }));
    await wPubP;

    const wPrivP = waitForWsMsg(wsPrivate, (m) => m.type === 'welcome');
    wsPrivate.send(JSON.stringify({ type: 'join', name: 'ProfDebug', room: dbgSession.room }));
    await wPrivP;

    const roomsRes = await fetch(`${baseUrl}/api/rooms`);
    const roomsData = await roomsRes.json();
    assert.equal(
      roomsData.rooms.some((r) => r.room === dbgSession.room),
      false
    );

    const privCelebP = waitForWsMsg(wsPrivate, (m) => m.type === 'world_celebration');
    const pubNoCelebP = assertNoWsMsg(wsPublic, (m) => m.type === 'world_celebration');
    wsPrivate.send(JSON.stringify({ type: 'debug_action', action: 'celebrate', tpId: 'antivirus' }));
    const privCeleb = await privCelebP;
    await pubNoCelebP;
    assert.equal(privCeleb.reason, 'debug');

    const valP = waitForWsMsg(wsPrivate, (m) => m.type === 'profile_updated' && m.profile?.average === 20);
    wsPrivate.send(JSON.stringify({ type: 'debug_action', action: 'validate_all' }));
    const valMsg = await valP;
    assert.equal(valMsg.profile.average, 20);
    assert.equal(valMsg.profile.completedCount, 5);
    assert.equal(valMsg.profile.diplomaEarned, true);

    const rstP = waitForWsMsg(wsPrivate, (m) => m.type === 'profile_updated' && m.profile?.xp === 0);
    wsPrivate.send(JSON.stringify({ type: 'debug_action', action: 'reset_progress' }));
    const rstMsg = await rstP;
    assert.equal(rstMsg.profile.xp, 0);
    assert.equal(rstMsg.profile.average, null);
    assert.equal(rstMsg.profile.diplomaEarned, false);
  } finally {
    wsPublic?.close();
    wsPrivate?.close();
    wsHub.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('v4.7 : DOM index.html, admin.html et ChangelogModal exposent tous les éléments requis', () => {
  assert.ok(APP_VERSION.startsWith('v4.7'));
  assert.ok(CHANGELOG_RELEASES[0].version.startsWith('v4.7'));
  assert.equal(CHANGELOG_RELEASES[0].tag, 'DERNIÈRE MÀJ');
  assert.equal(CHANGELOG_RELEASES[1].tag, 'HISTORIQUE');

  const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');
  for (const id of [
    'world-celebration-banner',
    'world-celebration-text',
    'btn-celebration-applaud',
    'btn-creator-power',
    'creator-power-popover',
    'btn-creator-celebrate',
    'btn-creator-aura',
    'hud-private-debug-badge',
    'debug-tools-panel',
    'btn-debug-celebrate',
    'btn-debug-validate-all',
    'btn-debug-reset-progress',
    'btn-debug-noclip',
    'debug-teleport-select'
  ]) {
    assert.ok(indexHtml.includes(`id="${id}"`), `ID manquant dans index.html: ${id}`);
  }

  const adminHtml = fs.readFileSync(path.resolve('admin.html'), 'utf8');
  assert.ok(adminHtml.includes('id="btn-launch-private-debug"'));
  assert.ok(adminHtml.includes('Lancer une partie sur Serveur Privé (Mode Debug)'));
});
