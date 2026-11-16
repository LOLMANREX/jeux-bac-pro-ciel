import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import * as THREE from 'three';
import { WebSocket } from 'ws';
import { createGameServer } from '../server/index.js';
import { ALL_TP_IDS, ULTIMATE_SECRET_SKIN_ID } from '../server/store.js';
import {
  ASCENSION_SPECIALTIES,
  formatAscensionBanner,
  formatCelebrationBanner,
  formatSecretSkinBanner,
  formatSpectatorWaitText,
  hasAllTpsAt20,
  isCreatorPseudo,
  isPrivateDebugRoom,
  resolveAscensionSpecialty
} from '../server/wsHub.js';
import { buildPrivateDebugUrl, requestPrivateDebugSession } from '../src/admin.js';
import {
  GameState,
  getAllTps,
  hasAllDivineSpecialties,
  hasAllTpsAt20 as clientHasAllTpsAt20
} from '../src/core/gameState.js';
import { APP_VERSION, CHANGELOG_RELEASES } from '../src/ui/ChangelogModal.js';
import {
  buildIntroCinematicSteps,
  formatAscensionBanner as formatHudAscensionBanner,
  formatSecretSkinAnnouncement,
  formatSpectatorWaitMessage,
  formatWorldCelebrationBanner
} from '../src/ui/HudManager.js';
import {
  LOCKED_SECRET_SKIN_LABEL,
  getCasierDivineEntries
} from '../src/ui/SkinCustomizer.js';
import {
  ULTIMATE_SECRET_SKIN,
  applySessionDivineSkin,
  buildStudentAvatarMesh,
  isCreatorLouis,
  isUltimateSecretSkinId,
  normalizeSkin
} from '../src/world/AvatarBuilder.js';
import { RemotePlayersManager } from '../src/world/RemotePlayers.js';
import {
  INTRO_CINEMATIC_SHOTS,
  computeAscensionGatheringLayout,
  createWorldCelebrationRig
} from '../src/world/SceneManager.js';

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

test('v4.8 : Cinématique d’Ascension Dieu du Bac Pro CIEL rassemble la classe autour du Professeur CIEL, gère le choix de spécialité et synchronise l’ascension en mémoire uniquement', async () => {
  assert.equal(
    formatCelebrationBanner('Lucas_CIEL', 'TP Oscilloscope & Diagnostic 3D'),
    '🏆 EXPLOIT CIEL : Lucas_CIEL a décroché 20/20 au TP Oscilloscope & Diagnostic 3D !'
  );
  assert.equal(
    formatWorldCelebrationBanner('Emma', 'Brasure PCB 3D'),
    '🏆 EXPLOIT CIEL : Emma a décroché 20/20 au TP Brasure PCB 3D !'
  );
  assert.equal(
    formatSpectatorWaitText('Alice20'),
    '⏳ Alice20 choisit sa spécialité auprès du Professeur CIEL...'
  );
  assert.equal(
    formatSpectatorWaitMessage('Alice20'),
    '⏳ Alice20 choisit sa spécialité auprès du Professeur CIEL...'
  );
  assert.equal(
    formatAscensionBanner('Alice20', 'cyber'),
    '⚡ ASCENSION : Alice20 devient un DIEU DU BAC PRO CIEL (Cybersécurité & Pentest) ! ⚡'
  );
  assert.equal(
    formatHudAscensionBanner('Alice20', 'reseaux'),
    '⚡ ASCENSION : Alice20 devient un DIEU DU BAC PRO CIEL (Réseaux & Fibre Optique) ! ⚡'
  );

  const layout = computeAscensionGatheringLayout(
    { x: -3.35, z: -1.35 },
    'p-winner',
    ['p-winner', 'p-spec1', 'p-spec2', 'p-spec3']
  );
  assert.equal(layout.winnerSpot.role, 'winner');
  assert.equal(layout.spectatorSpots.length, 3);
  assert.equal(layout.placements.length, 4);

  const scene = new THREE.Scene();
  const dummyAvatar = buildStudentAvatarMesh({ outfitColor: '#22d3ee' });
  const rig = createWorldCelebrationRig(scene);
  assert.equal(rig.isActive(), false);
  const info = rig.triggerAscension({
    duration: 8,
    levitationDuration: 3.8,
    specialty: 'cyber',
    center: { x: -4.15, z: -1.25 },
    targetAvatar: dummyAvatar
  });
  assert.equal(info.active, true);
  assert.equal(info.hasLightBeam, true);
  assert.equal(info.specialty, 'cyber');
  assert.ok(info.particleCount >= 100);
  assert.ok(info.fireworkCount >= 4);
  assert.ok(info.lightCount >= 3);
  assert.equal(rig.root.visible, true);
  assert.equal(rig.beamGroup.visible, true);
  assert.equal(rig.update(1.5, 1.5), true);
  assert.ok(rig.getLevitationOffset() > 0.5);
  assert.ok(dummyAvatar.group.position.y > 0.5);
  assert.ok(rig.dynamicLights[0].intensity > 0);
  assert.equal(rig.update(7.0, 8.5), false);
  assert.equal(rig.isActive(), false);
  assert.equal(rig.getLevitationOffset(), 0);
  assert.equal(dummyAvatar.group.position.y, 0);
  assert.equal(rig.root.visible, false);

  const { server, wsHub, store } = createGameServer({ dbPath: null });
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
    const w1 = await w1P;

    const w2P = waitForWsMsg(ws2, (m) => m.type === 'welcome');
    ws2.send(JSON.stringify({ type: 'join', name: 'BobSpectateur', room: 'plateau-u300' }));
    await w2P;

    for (const tpId of ALL_TP_IDS.filter((id) => id !== 'oscilloscope')) {
      store.recordTpScore('Alice20', tpId, 20, 40);
    }

    const c1CelebP = waitForWsMsg(ws1, (m) => m.type === 'world_celebration');
    const c2CelebP = waitForWsMsg(ws2, (m) => m.type === 'world_celebration');
    ws1.send(
      JSON.stringify({
        type: 'submit_score',
        tpId: 'oscilloscope',
        score: 20,
        durationSec: 48
      })
    );

    const [celeb1, celeb2] = await Promise.all([c1CelebP, c2CelebP]);
    assert.equal(celeb1.reason, 'all_tps_20');
    assert.equal(celeb1.cinematic, 'ascension_20');
    assert.equal(celeb1.phase, 'dialogue');
    assert.equal(celeb1.playerId, w1.id);
    assert.equal(celeb2.playerName, 'Alice20');
    assert.equal(celeb2.questionText, 'Quel a été ton TP préféré durant ton parcours ?');
    assert.equal(
      celeb2.spectatorWaitText,
      '⏳ Alice20 choisit sa spécialité auprès du Professeur CIEL...'
    );
    assert.equal(celeb2.choiceTimeoutMs, 15000);
    assert.equal(celeb2.specialties.length, 5);
    assert.equal(celeb2.placements.length, 2);

    const asc1P = waitForWsMsg(ws1, (m) => m.type === 'world_ascension');
    const asc2P = waitForWsMsg(ws2, (m) => m.type === 'world_ascension');
    ws1.send(
      JSON.stringify({
        type: 'ascension_choice',
        specialty: 'cyber',
        celebrationId: celeb1.id
      })
    );

    const [asc1, asc2] = await Promise.all([asc1P, asc2P]);
    assert.equal(asc1.specialty, 'cyber');
    assert.equal(asc2.specialtyLabel, 'Cybersécurité & Pentest');
    assert.equal(
      asc2.bannerText,
      '⚡ ASCENSION : Alice20 devient un DIEU DU BAC PRO CIEL (Cybersécurité & Pentest) ! ⚡'
    );
    assert.equal(asc2.skin.divineSpecialty, 'cyber');
    assert.equal(asc2.persisted, true);
    assert.equal(asc2.sessionOnly, false);
    assert.equal(asc2.applaudDurationMs, 8000);

    const storedProfile = store.getOrCreatePlayer('Alice20');
    assert.equal(storedProfile.skin.divineSpecialty, 'cyber');
    assert.equal(storedProfile.selectedSkin, 'cyber');
    assert.ok(storedProfile.unlockedDivineSkins.includes('cyber'));
  } finally {
    ws1.close();
    ws2.close();
    wsHub.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('v4.8 / v4.12 : Les 5 Skins Divins de spécialités (Cyber, Réseaux, Électronique, Systèmes, Audiovisuel) génèrent armure holographique, couronne énergétique, aura divine et accessoires 3D', () => {
  assert.equal(ASCENSION_SPECIALTIES.length, 5);
  const expectedIds = ['cyber', 'reseaux', 'electronique', 'systemes', 'audiovisuel'];
  assert.deepEqual(
    ASCENSION_SPECIALTIES.map((s) => s.id),
    expectedIds
  );

  assert.equal(resolveAscensionSpecialty('antivirus').id, 'cyber');
  assert.equal(resolveAscensionSpecialty('vmvlan').id, 'reseaux');
  assert.equal(resolveAscensionSpecialty('soldering').id, 'electronique');
  assert.equal(resolveAscensionSpecialty('hardware').id, 'systemes');
  assert.equal(resolveAscensionSpecialty('audiovisual').id, 'audiovisuel');

  const scene = new THREE.Scene();
  const remoteMgr = new RemotePlayersManager(scene);
  remoteMgr.upsertPeer({ id: 'peer-1', name: 'EleveTest', x: 0, y: 0, z: 0 });

  for (const specId of expectedIds) {
    const sessionSkin = applySessionDivineSkin({ outfitColor: '#22d3ee' }, specId);
    assert.equal(sessionSkin.divineSpecialty, specId);
    const norm = normalizeSkin(sessionSkin);
    assert.equal(norm.divineSpecialty, specId);

    const avatar = buildStudentAvatarMesh(sessionSkin);
    assert.equal(avatar.hasDivineSkin(), true);
    assert.equal(avatar.getDivineSpecialty(), specId);
    assert.equal(avatar.divineSkinGroup.visible, true);
    assert.ok(avatar.divineArmorGroup.children.length > 0);
    assert.ok(avatar.energyCrownGroup.children.length > 0);
    assert.ok(avatar.divineAuraGroup.children.length > 0);
    assert.ok(avatar.specialtyAccessoryGroup.children.length > 0);
    avatar.updateEffects(1.25);

    const appliedSpec = remoteMgr.setDivineSkin('peer-1', specId);
    assert.equal(appliedSpec.id, specId);
    const peer = remoteMgr.peers.get('peer-1');
    assert.equal(peer.skin.divineSpecialty, specId);
    assert.equal(peer.hasDivineSkin(), true);
  }

  remoteMgr.clearAll();
});

test('v4.8 : Pouvoir Exclusif Créateur réservé à Louis (insensible à la casse) et synchronisation Aura Dorée 3D', async () => {
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
    assert.equal(celebEv.cinematic, 'ascension_20');
  } finally {
    wsLouis.close();
    wsPeer.close();
    wsHub.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('v4.8 : Serveur Privé Debug isolé des salons publics et outils de validation 20/20 + reset', async () => {
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
    assert.equal(hasAllTpsAt20(valMsg.profile), true);

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

test('v4.9 : Système de Comptes Élèves, Persistance accounts.json, Skins Divins et Récupération Admin', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ciel-v49-accounts-'));
  const accountsPath = path.join(tmpDir, 'accounts.json');

  const { server, wsHub, store } = createGameServer({ accountsPath });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const wsUrl = `ws://127.0.0.1:${port}/ws`;

  let wsStudent = null;

  try {
    assert.equal(fs.existsSync(accountsPath), true);
    const initialRaw = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
    assert.equal(initialRaw.version, '4.11');
    assert.equal(initialRaw.resetDone, true);
    assert.equal(initialRaw.resetV411Done, true);
    assert.deepEqual(initialRaw.accounts, []);
    assert.equal(store.getAllPlayers().length, 0);

    const regMismatch = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Lucas_CIEL',
        password: 'SecretPassword42',
        confirmPassword: 'AutrePassword'
      })
    });
    assert.equal(regMismatch.status, 400);

    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Lucas_CIEL',
        password: 'SecretPassword42',
        confirmPassword: 'SecretPassword42',
        avatarCustomization: {
          outfitColor: '#10b981',
          outfitStyle: 'hoodie',
          hat: 'headset',
          skinTone: '#f1c29b',
          pantsColor: '#1d4ed8'
        }
      })
    });
    assert.equal(regRes.status, 201);
    const regData = await regRes.json();
    assert.equal(regData.ok, true);
    assert.ok(regData.token);
    assert.equal(regData.account.username, 'Lucas_CIEL');
    assert.equal(regData.account.selectedSkin, 'standard');
    assert.equal(regData.account.avatarCustomization.outfitStyle, 'hoodie');
    assert.deepEqual(regData.account.unlockedDivineSkins, []);
    assert.equal(regData.account.introSeen, false);
    assert.equal(regData.account.secretSkinUnlocked, false);
    assert.equal(regData.account.prestigeCount, 0);

    const dupRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'lucas_ciel',
        password: 'AutrePassword99',
        confirmPassword: 'AutrePassword99'
      })
    });
    assert.equal(dupRes.status, 409);

    const badLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Lucas_CIEL', password: 'WrongPassword' })
    });
    assert.equal(badLoginRes.status, 401);

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'lUcAs_cIeL', password: 'SecretPassword42' })
    });
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.equal(loginData.ok, true);
    assert.ok(loginData.token);
    assert.equal(loginData.account.username, 'Lucas_CIEL');

    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${loginData.token}` }
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.account.username, 'Lucas_CIEL');

    const saveRes = await fetch(`${baseUrl}/api/account/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginData.token}`
      },
      body: JSON.stringify({
        tpScores: {
          oscilloscope: 20,
          soldering: 20,
          electronics: 20,
          antivirus: 20,
          vmvlan: 20,
          patchrack: 20,
          hardware: 20,
          audiovisual: 20,
          studio: 20
        },
        unlockedDivineSkins: ['cyber', 'reseaux'],
        selectedSkin: 'cyber',
        avatarCustomization: {
          outfitColor: '#f43f5e',
          outfitStyle: 'cyber',
          hat: 'headset',
          skinTone: '#f1c29b',
          pantsColor: '#1d4ed8',
          divineSpecialty: 'cyber'
        }
      })
    });
    assert.equal(saveRes.status, 200);
    const saveData = await saveRes.json();
    assert.equal(saveData.account.tpsAt20Count, ALL_TP_IDS.length);
    assert.deepEqual(saveData.account.unlockedDivineSkins, ['cyber', 'reseaux']);
    assert.equal(saveData.account.selectedSkin, 'cyber');
    assert.equal(saveData.account.avatarCustomization.divineSpecialty, 'cyber');

    const diskAccounts = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
    assert.equal(diskAccounts.accounts.length, 1);
    const savedOnDisk = diskAccounts.accounts[0];
    assert.ok(savedOnDisk.id);
    assert.equal(savedOnDisk.username, 'Lucas_CIEL');
    assert.equal(savedOnDisk.password, 'SecretPassword42');
    assert.ok(savedOnDisk.createdAt);
    assert.equal(savedOnDisk.tpScores.oscilloscope, 20);
    assert.deepEqual(savedOnDisk.unlockedDivineSkins, ['cyber', 'reseaux']);
    assert.equal(savedOnDisk.selectedSkin, 'cyber');
    assert.equal(savedOnDisk.avatarCustomization.divineSpecialty, 'cyber');

    const adminLoginRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: process.env.ADMIN_PASSWORD || 'Louisetjade1102' })
    });
    const { token: adminToken } = await adminLoginRes.json();

    const adminAccountsRes = await fetch(`${baseUrl}/api/admin/accounts`, {
      headers: { 'x-admin-token': adminToken }
    });
    assert.equal(adminAccountsRes.status, 200);
    const adminAccountsData = await adminAccountsRes.json();
    assert.equal(adminAccountsData.total, 1);
    assert.equal(adminAccountsData.accounts[0].username, 'Lucas_CIEL');
    assert.equal(adminAccountsData.accounts[0].password, 'SecretPassword42');
    assert.equal(adminAccountsData.accounts[0].tpsAt20Count, ALL_TP_IDS.length);
    assert.deepEqual(adminAccountsData.accounts[0].unlockedDivineSkins, ['cyber', 'reseaux']);

    const pwChangeRes = await fetch(`${baseUrl}/api/admin/accounts/Lucas_CIEL/password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken
      },
      body: JSON.stringify({ password: 'NewRecoveredPass77' })
    });
    assert.equal(pwChangeRes.status, 200);
    const pwChangeData = await pwChangeRes.json();
    assert.equal(pwChangeData.account.password, 'NewRecoveredPass77');

    const oldTokenMeRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${loginData.token}` }
    });
    assert.equal(oldTokenMeRes.status, 401);

    const newLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Lucas_CIEL', password: 'NewRecoveredPass77' })
    });
    assert.equal(newLoginRes.status, 200);

    wsStudent = new WebSocket(wsUrl);
    await new Promise((r) => wsStudent.once('open', r));
    const welcomeP = waitForWsMsg(wsStudent, (m) => m.type === 'welcome');
    wsStudent.send(JSON.stringify({ type: 'join', name: 'Lucas_CIEL', room: 'plateau-u300' }));
    const wStudent = await welcomeP;
    assert.equal(wStudent.profile.skin.divineSpecialty, 'cyber');

    const resetAccRes = await fetch(`${baseUrl}/api/admin/accounts/Lucas_CIEL/reset`, {
      method: 'POST',
      headers: { 'x-admin-token': adminToken }
    });
    assert.equal(resetAccRes.status, 200);
    const resetAccData = await resetAccRes.json();
    assert.deepEqual(resetAccData.account.tpScores, {});
    assert.deepEqual(resetAccData.account.unlockedDivineSkins, []);
    assert.equal(resetAccData.account.selectedSkin, 'standard');
    assert.equal(resetAccData.account.password, 'NewRecoveredPass77');

    const delEventP = waitForWsMsg(wsStudent, (m) => m.type === 'account_deleted');
    const delAccRes = await fetch(`${baseUrl}/api/admin/accounts/Lucas_CIEL`, {
      method: 'DELETE',
      headers: { 'x-admin-token': adminToken }
    });
    assert.equal(delAccRes.status, 200);
    await delEventP;
    await new Promise((r) => wsStudent.once('close', r));

    const afterAccounts = await (
      await fetch(`${baseUrl}/api/admin/accounts`, { headers: { 'x-admin-token': adminToken } })
    ).json();
    assert.equal(afterAccounts.total, 0);
  } finally {
    wsStudent?.close();
    wsHub.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('v4.12 : DOM index.html, admin.html et ChangelogModal exposent tous les éléments requis', () => {
  assert.ok(APP_VERSION.startsWith('v4.17'));
  assert.ok(CHANGELOG_RELEASES[0].version.startsWith('v4.17'));
  assert.equal(CHANGELOG_RELEASES[0].tag, 'DERNIÈRE MÀJ');
  assert.ok(CHANGELOG_RELEASES[1].version.startsWith('v4.16'));
  assert.equal(CHANGELOG_RELEASES[1].tag, 'HISTORIQUE');
  assert.ok(CHANGELOG_RELEASES[2].version.startsWith('v4.15'));
  assert.equal(CHANGELOG_RELEASES[2].tag, 'HISTORIQUE');
  assert.ok(CHANGELOG_RELEASES[3].version.startsWith('v4.14'));
  assert.equal(CHANGELOG_RELEASES[3].tag, 'HISTORIQUE');
  assert.ok(CHANGELOG_RELEASES[4].version.startsWith('v4.12'));
  assert.equal(CHANGELOG_RELEASES[4].tag, 'HISTORIQUE');

  const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');
  for (const id of [
    'auth-box',
    'auth-tab-login',
    'auth-tab-register',
    'auth-login-form',
    'auth-register-form',
    'auth-login-username',
    'auth-login-password',
    'auth-register-username',
    'auth-register-password',
    'auth-register-confirm',
    'auth-session-card',
    'menu-btn-logout',
    'menu-btn-replay-intro',
    'btn-hud-logout',
    'btn-replay-intro',
    'skin-divine-list',
    'hud-skin-divine-list',
    'world-celebration-banner',
    'world-celebration-text',
    'secret-skin-banner',
    'secret-skin-banner-text',
    'intro-cinematic-overlay',
    'intro-step-pill',
    'intro-zone-pill',
    'intro-step-title',
    'intro-dialogue-text',
    'intro-step-dots',
    'btn-intro-prev',
    'btn-intro-next',
    'btn-intro-skip',
    'btn-celebration-applaud',
    'ascension-cinematic-dialogue',
    'ascension-dialogue-speech',
    'ascension-dialogue-question',
    'ascension-collection-status',
    'ascension-choices-grid',
    'ascension-countdown-pill',
    'ascension-spectator-wait',
    'btn-ascension-cyber',
    'btn-ascension-reseaux',
    'btn-ascension-electronique',
    'btn-ascension-systemes',
    'btn-ascension-audiovisuel',
    'btn-creator-power',
    'creator-power-popover',
    'btn-creator-celebrate',
    'btn-creator-aura',
    'hud-private-debug-badge',
    'debug-tools-panel',
    'btn-debug-celebrate',
    'btn-debug-validate-all',
    'btn-debug-reset-progress',
    'btn-debug-vr-panel',
    'btn-debug-noclip',
    'debug-teleport-select',
    'btn-audio-settings',
    'audio-settings-popover',
    'audio-input-select',
    'audio-output-select',
    'audio-mic-meter-fill'
  ]) {
    assert.ok(indexHtml.includes(`id="${id}"`), `ID manquant dans index.html: ${id}`);
  }
  assert.ok(indexHtml.includes('Quel a été ton TP préféré durant ton parcours ?'));
  assert.ok(indexHtml.includes("🎬 Revoir l'intro"));
  assert.ok(indexHtml.includes('🚪 Déconnexion'));

  const adminHtml = fs.readFileSync(path.resolve('admin.html'), 'utf8');
  for (const id of [
    'btn-launch-private-debug',
    'admin-tab-accounts',
    'admin-panel-accounts',
    'search-account-input',
    'accounts-tbody',
    'btn-toggle-all-acc-pw',
    'admin-password-modal',
    'admin-edit-pw-input'
  ]) {
    assert.ok(adminHtml.includes(`id="${id}"`), `ID manquant dans admin.html: ${id}`);
  }
  assert.ok(adminHtml.includes("Comptes Élèves &amp; Récupération d'Accès"));
});

test('v4.10 : Sauvegarde TPs Audiovisuel (audiovisual & studio) dans accounts.json, célébration 20/20 et validate_all Debug', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ciel-v410-av-'));
  const accountsPath = path.join(tmpDir, 'accounts.json');

  const { server, wsHub } = createGameServer({ accountsPath });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const wsUrl = `ws://127.0.0.1:${port}/ws`;

  let wsStudent = null;

  try {
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Av_Student',
        password: 'AudioPassword42',
        confirmPassword: 'AudioPassword42'
      })
    });
    assert.equal(regRes.status, 201);
    const regData = await regRes.json();

    const saveRes = await fetch(`${baseUrl}/api/account/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${regData.token}`
      },
      body: JSON.stringify({
        tpScores: {
          audiovisual: 20,
          studio: 18.5
        },
        tpId: 'studio',
        score: Number.NaN
      })
    });
    assert.equal(saveRes.status, 200);
    const saveData = await saveRes.json();
    assert.equal(saveData.account.tpScores.audiovisual, 20);
    assert.equal(saveData.account.tpScores.studio, 18.5);

    const onDiskBefore = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
    assert.equal(onDiskBefore.accounts[0].tpScores.audiovisual, 20);
    assert.equal(onDiskBefore.accounts[0].tpScores.studio, 18.5);

    wsStudent = new WebSocket(wsUrl);
    await new Promise((r) => wsStudent.once('open', r));
    const welcomeP = waitForWsMsg(wsStudent, (m) => m.type === 'welcome');
    wsStudent.send(JSON.stringify({ type: 'join', name: 'Av_Student', room: 'priv-debug-av' }));
    await welcomeP;

    const noCelebOnPartialP = assertNoWsMsg(wsStudent, (m) => m.type === 'world_celebration');
    const submittedP = waitForWsMsg(wsStudent, (m) => m.type === 'score_recorded');
    wsStudent.send(
      JSON.stringify({
        type: 'submit_score',
        tpId: 'studio',
        score: 20,
        durationSec: 85
      })
    );
    const subMsg = await submittedP;
    await noCelebOnPartialP;
    assert.equal(subMsg.profile.grades.studio, 20);
    assert.deepEqual(subMsg.profile.unlockedDivineSkins, []);

    const validateAllCelebP = waitForWsMsg(wsStudent, (m) => m.type === 'world_celebration');
    const dbgResultP = waitForWsMsg(
      wsStudent,
      (m) => m.type === 'profile_updated' && m.profile?.grades?.audiovisual === 20
    );
    wsStudent.send(JSON.stringify({ type: 'debug_action', action: 'validate_all' }));
    const dbgMsg = await dbgResultP;
    const dbgCeleb = await validateAllCelebP;
    assert.equal(dbgMsg.profile.grades.audiovisual, 20);
    assert.equal(dbgMsg.profile.grades.studio, 20);
    assert.equal(dbgMsg.profile.diplomaEarned, true);
    assert.equal(dbgCeleb.reason, 'all_tps_20');

    const onDiskAfter = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
    assert.equal(onDiskAfter.accounts[0].tpScores.audiovisual, 20);
    assert.equal(onDiskAfter.accounts[0].tpScores.studio, 20);
    assert.equal(onDiskAfter.accounts[0].tpScores.oscilloscope, 20);
  } finally {
    wsStudent?.close();
    wsHub.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('v4.11 : 20/20 sur un seul TP ne débloque PAS de skin divin ni la cinématique — seuls tous les TPs à 20/20 le permettent', async () => {
  const allTps = getAllTps();
  assert.equal(allTps.length, ALL_TP_IDS.length);
  for (const id of [
    'oscilloscope',
    'soldering',
    'electronics',
    'antivirus',
    'vmvlan',
    'patchrack',
    'hardware',
    'audiovisual',
    'studio'
  ]) {
    assert.ok(allTps.some((tp) => tp.id === id), `TP manquant dans getAllTps: ${id}`);
  }

  assert.equal(clientHasAllTpsAt20({ oscilloscope: 20 }, allTps), false);
  assert.equal(
    clientHasAllTpsAt20(
      { oscilloscope: 20, soldering: 20, electronics: 20, antivirus: 20, vmvlan: 20 },
      allTps
    ),
    false
  );
  const fullScores = Object.fromEntries(allTps.map((tp) => [tp.id, 20]));
  assert.equal(clientHasAllTpsAt20(fullScores, allTps), true);

  const gs = new GameState();
  gs.equipDivineSkin('cyber');
  assert.deepEqual(gs.unlockedDivineSkins, []);
  assert.equal(gs.selectedSkin, 'standard');
  assert.equal(gs.skin.divineSpecialty, undefined);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ciel-v411-strict-'));
  const accountsPath = path.join(tmpDir, 'accounts.json');
  const { server, wsHub } = createGameServer({ accountsPath });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const wsUrl = `ws://127.0.0.1:${port}/ws`;

  let wsEleve = null;

  try {
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'EleveTest20',
        password: 'Password2026',
        confirmPassword: 'Password2026'
      })
    });
    assert.equal(regRes.status, 201);
    const regData = await regRes.json();

    wsEleve = new WebSocket(wsUrl);
    await new Promise((r) => wsEleve.once('open', r));
    const welcomeP = waitForWsMsg(wsEleve, (m) => m.type === 'welcome');
    wsEleve.send(JSON.stringify({ type: 'join', name: 'EleveTest20', room: 'plateau-u300' }));
    await welcomeP;

    const noCelebSingleP = assertNoWsMsg(wsEleve, (m) => m.type === 'world_celebration');
    const noAscSingleP = assertNoWsMsg(wsEleve, (m) => m.type === 'world_ascension');
    const singleScoreP = waitForWsMsg(wsEleve, (m) => m.type === 'score_recorded');
    wsEleve.send(
      JSON.stringify({
        type: 'submit_score',
        tpId: 'oscilloscope',
        score: 20,
        durationSec: 40
      })
    );
    const singleScore = await singleScoreP;
    await noCelebSingleP;
    await noAscSingleP;
    assert.equal(singleScore.score, 20);
    assert.equal(singleScore.allTpsAt20, false);
    assert.equal(singleScore.firstTimeAllAt20, false);
    assert.deepEqual(singleScore.profile.unlockedDivineSkins, []);
    assert.equal(singleScore.profile.selectedSkin, 'standard');

    const forgedSaveRes = await fetch(`${baseUrl}/api/account/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${regData.token}`
      },
      body: JSON.stringify({
        tpScores: { oscilloscope: 20, antivirus: 20 },
        unlockedDivineSkins: ['cyber', 'reseaux'],
        unlockDivineSkin: 'cyber',
        selectedSkin: 'cyber',
        avatarCustomization: {
          outfitColor: '#f43f5e',
          outfitStyle: 'cyber',
          hat: 'headset',
          skinTone: '#f1c29b',
          pantsColor: '#1d4ed8',
          divineSpecialty: 'cyber'
        }
      })
    });
    assert.equal(forgedSaveRes.status, 200);
    const forgedSaveData = await forgedSaveRes.json();
    assert.deepEqual(forgedSaveData.account.unlockedDivineSkins, []);
    assert.equal(forgedSaveData.account.selectedSkin, 'standard');
    assert.equal(forgedSaveData.account.avatarCustomization.divineSpecialty, undefined);

    const forgedAscendRes = await fetch(`${baseUrl}/api/celebration/ascend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'EleveTest20',
        room: 'plateau-u300',
        specialty: 'cyber'
      })
    });
    assert.equal(forgedAscendRes.status, 403);

    const noAscSpoofP = assertNoWsMsg(wsEleve, (m) => m.type === 'world_ascension');
    wsEleve.send(JSON.stringify({ type: 'ascension_choice', specialty: 'cyber' }));
    await noAscSpoofP;

    const remainingExceptLast = ALL_TP_IDS.filter(
      (id) => id !== 'oscilloscope' && id !== 'antivirus' && id !== 'studio'
    );
    for (const tpId of remainingExceptLast) {
      const noCelebP = assertNoWsMsg(wsEleve, (m) => m.type === 'world_celebration', 80);
      const recP = waitForWsMsg(wsEleve, (m) => m.type === 'score_recorded' && m.tpId === tpId);
      wsEleve.send(
        JSON.stringify({
          type: 'submit_score',
          tpId,
          score: 20,
          durationSec: 42
        })
      );
      const rec = await recP;
      await noCelebP;
      assert.equal(rec.allTpsAt20, false);
      assert.deepEqual(rec.profile.unlockedDivineSkins, []);
    }

    const finalCelebP = waitForWsMsg(wsEleve, (m) => m.type === 'world_celebration');
    const finalRecP = waitForWsMsg(wsEleve, (m) => m.type === 'score_recorded' && m.tpId === 'studio');
    wsEleve.send(
      JSON.stringify({
        type: 'submit_score',
        tpId: 'studio',
        score: 20,
        durationSec: 55
      })
    );
    const [finalRec, finalCeleb] = await Promise.all([finalRecP, finalCelebP]);
    assert.equal(finalRec.allTpsAt20, true);
    assert.equal(finalRec.firstTimeAllAt20, true);
    assert.equal(finalCeleb.reason, 'all_tps_20');
    assert.equal(finalCeleb.cinematic, 'ascension_20');

    const ascP = waitForWsMsg(wsEleve, (m) => m.type === 'world_ascension');
    wsEleve.send(
      JSON.stringify({
        type: 'ascension_choice',
        specialty: 'electronique',
        celebrationId: finalCeleb.id
      })
    );
    const ascMsg = await ascP;
    assert.equal(ascMsg.specialty, 'electronique');
    assert.equal(ascMsg.persisted, true);
    assert.deepEqual(ascMsg.unlockedDivineSkins, ['electronique']);

    const noReplayCelebP = assertNoWsMsg(wsEleve, (m) => m.type === 'world_celebration');
    const replayRecP = waitForWsMsg(wsEleve, (m) => m.type === 'score_recorded' && m.tpId === 'oscilloscope');
    wsEleve.send(
      JSON.stringify({
        type: 'submit_score',
        tpId: 'oscilloscope',
        score: 20,
        durationSec: 35
      })
    );
    const replayRec = await replayRecP;
    await noReplayCelebP;
    assert.equal(replayRec.firstTimeAllAt20, false);

    const diskAfter = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
    assert.deepEqual(diskAfter.accounts[0].unlockedDivineSkins, ['electronique']);
    assert.equal(diskAfter.accounts[0].selectedSkin, 'electronique');
  } finally {
    wsEleve?.close();
    wsHub.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('v4.11 : Reset global unique au démarrage de accounts.json hérité sans effacer les comptes aux redémarrages suivants', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ciel-v411-migration-'));
  const accountsPath = path.join(tmpDir, 'accounts.json');

  fs.writeFileSync(
    accountsPath,
    JSON.stringify({
      version: '4.9',
      resetDone: true,
      accounts: [
        {
          id: 'acc_legacy1',
          username: 'AncienEleveBugge',
          password: 'OldPassword',
          tpScores: { oscilloscope: 20 },
          unlockedDivineSkins: ['cyber'],
          selectedSkin: 'cyber',
          avatarCustomization: {
            outfitColor: '#f43f5e',
            outfitStyle: 'cyber',
            hat: 'glasses',
            skinTone: '#f1c29b',
            pantsColor: '#1e293b',
            divineSpecialty: 'cyber'
          }
        }
      ],
      suggestions: [
        {
          id: 'sug_1',
          author: 'Prof',
          message: 'Garder les suggestions',
          createdAt: '2026-11-16T10:00:00.000Z'
        }
      ],
      pigeons: []
    }),
    'utf8'
  );

  const srv1 = createGameServer({ accountsPath });
  await new Promise((resolve) => srv1.server.listen(0, resolve));
  const port1 = srv1.server.address().port;
  const baseUrl1 = `http://127.0.0.1:${port1}`;

  try {
    assert.equal(srv1.store.migratedToV411, true);
    assert.equal(srv1.store.getAllAccounts().length, 0);
    assert.equal(srv1.store.getAllPlayers().length, 0);
    assert.equal(srv1.store.getSuggestions().length, 1);

    const diskMigrated = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
    assert.equal(diskMigrated.version, '4.11');
    assert.equal(diskMigrated.resetV411Done, true);
    assert.deepEqual(diskMigrated.accounts, []);

    const regRes = await fetch(`${baseUrl1}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'NouveauEleveV411',
        password: 'CleanPassword411',
        confirmPassword: 'CleanPassword411'
      })
    });
    assert.equal(regRes.status, 201);
  } finally {
    srv1.wsHub.close();
    await new Promise((resolve) => srv1.server.close(resolve));
  }

  const srv2 = createGameServer({ accountsPath });
  await new Promise((resolve) => srv2.server.listen(0, resolve));

  try {
    assert.equal(srv2.store.migratedToV411, false);
    const allAfterRestart = srv2.store.getAllAccounts();
    assert.equal(allAfterRestart.length, 1);
    assert.equal(allAfterRestart[0].username, 'NouveauEleveV411');
    assert.deepEqual(allAfterRestart[0].unlockedDivineSkins, []);
  } finally {
    srv2.wsHub.close();
    await new Promise((resolve) => srv2.server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('v4.12 : Création de compte initialise introSeen=false, cinématique Professeur CIEL et persistance introSeen=true via POST /api/account/save', async () => {
  assert.equal(INTRO_CINEMATIC_SHOTS.length, 5);
  const steps = buildIntroCinematicSteps('EleveIntro');
  assert.equal(steps.length, 5);
  const fullNarrative = steps.map((s) => `${s.title} ${s.text}`).join(' ');
  assert.ok(fullNarrative.includes('Professeur CIEL'));
  assert.ok(fullNarrative.includes('Cyber'));
  assert.ok(fullNarrative.includes('Réseaux'));
  assert.ok(fullNarrative.includes('Électronique'));
  assert.ok(fullNarrative.includes('Systèmes'));
  assert.ok(fullNarrative.includes('Audiovisuel'));
  assert.ok(fullNarrative.includes('20/20'));
  assert.ok(fullNarrative.includes('Cycle de Prestige'));
  assert.ok(!fullNarrative.toLowerCase().includes('architecte suprême'));
  assert.ok(!fullNarrative.toLowerCase().includes('entité quantique'));

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atelier-v412-intro-'));
  const accountsPath = path.join(tmpDir, 'accounts.json');
  const srv1 = createGameServer({ dbPath: null, accountsPath });
  await new Promise((resolve) => srv1.server.listen(0, resolve));
  const port1 = srv1.server.address().port;
  const baseUrl1 = `http://127.0.0.1:${port1}`;

  let token = '';
  try {
    const regRes = await fetch(`${baseUrl1}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'EleveIntro412',
        password: 'PasswordIntro412',
        confirmPassword: 'PasswordIntro412'
      })
    });
    assert.equal(regRes.status, 201);
    const regData = await regRes.json();
    token = regData.token;
    assert.equal(regData.account.introSeen, false);
    assert.equal(regData.account.secretSkinUnlocked, false);
    assert.equal(regData.account.prestigeCount, 0);

    const diskBefore = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
    assert.equal(diskBefore.accounts[0].introSeen, false);

    const saveRes = await fetch(`${baseUrl1}/api/account/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ introSeen: true })
    });
    assert.equal(saveRes.status, 200);
    const saveData = await saveRes.json();
    assert.equal(saveData.account.introSeen, true);

    const meRes = await fetch(`${baseUrl1}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.account.introSeen, true);
  } finally {
    srv1.wsHub.close();
    await new Promise((resolve) => srv1.server.close(resolve));
  }

  const srv2 = createGameServer({ dbPath: null, accountsPath });
  await new Promise((resolve) => srv2.server.listen(0, resolve));
  const port2 = srv2.server.address().port;
  const baseUrl2 = `http://127.0.0.1:${port2}`;
  try {
    const loginRes = await fetch(`${baseUrl2}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'EleveIntro412',
        password: 'PasswordIntro412'
      })
    });
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.equal(loginData.account.introSeen, true);
  } finally {
    srv2.wsHub.close();
    await new Promise((resolve) => srv2.server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('v4.12 : Cycle de Prestige après 20/20 intégral, protection serveur /api/account/save et déblocage automatique du Skin Secret Ultime aux 5 spécialités', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atelier-v412-prestige-'));
  const accountsPath = path.join(tmpDir, 'accounts.json');
  const { server, wsHub, store } = createGameServer({ dbPath: null, accountsPath });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const wsUrl = `ws://127.0.0.1:${port}/ws`;

  const wsHero = new WebSocket(wsUrl);
  const wsSpec = new WebSocket(wsUrl);

  try {
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'PrestigeHero',
        password: 'PrestigePassword412',
        confirmPassword: 'PrestigePassword412'
      })
    });
    assert.equal(regRes.status, 201);
    const regData = await regRes.json();
    const token = regData.token;

    const blockedSaveRes = await fetch(`${baseUrl}/api/account/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        unlockedDivineSkins: ['cyber', ULTIMATE_SECRET_SKIN_ID],
        secretSkinUnlocked: true,
        selectedSkin: ULTIMATE_SECRET_SKIN_ID,
        avatarCustomization: { secretSkin: true }
      })
    });
    assert.equal(blockedSaveRes.status, 200);
    const blockedSaveData = await blockedSaveRes.json();
    assert.equal(blockedSaveData.account.secretSkinUnlocked, false);
    assert.ok(!blockedSaveData.account.unlockedDivineSkins.includes(ULTIMATE_SECRET_SKIN_ID));
    assert.notEqual(blockedSaveData.account.selectedSkin, ULTIMATE_SECRET_SKIN_ID);
    assert.equal(Boolean(blockedSaveData.account.avatarCustomization.secretSkin), false);

    const partialSaveRes = await fetch(`${baseUrl}/api/account/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        unlockedDivineSkins: ['cyber', 'reseaux', 'electronique', 'systemes'],
        secretSkinUnlocked: true,
        selectedSkin: ULTIMATE_SECRET_SKIN_ID,
        avatarCustomization: { secretSkin: true }
      })
    });
    assert.equal(partialSaveRes.status, 200);
    const partialData = await partialSaveRes.json();
    assert.equal(partialData.account.secretSkinUnlocked, false);
    assert.notEqual(partialData.account.selectedSkin, ULTIMATE_SECRET_SKIN_ID);

    store.saveAccountData('PrestigeHero', { unlockedDivineSkins: [] });

    await Promise.all([
      wsHero.readyState === WebSocket.OPEN ? Promise.resolve() : new Promise((r) => wsHero.once('open', r)),
      wsSpec.readyState === WebSocket.OPEN ? Promise.resolve() : new Promise((r) => wsSpec.once('open', r))
    ]);

    const wHeroP = waitForWsMsg(wsHero, (m) => m.type === 'welcome');
    wsHero.send(JSON.stringify({ type: 'join', name: 'PrestigeHero', room: 'plateau-u300' }));
    await wHeroP;

    const wSpecP = waitForWsMsg(wsSpec, (m) => m.type === 'welcome');
    wsSpec.send(JSON.stringify({ type: 'join', name: 'Spectateur412', room: 'plateau-u300' }));
    await wSpecP;

    const cycleOrder = ['cyber', 'reseaux', 'electronique', 'systemes', 'audiovisuel'];
    let xpBeforeAscension = 0;

    for (let i = 0; i < cycleOrder.length; i++) {
      const targetSpec = cycleOrder[i];
      for (const tpId of ALL_TP_IDS.filter((id) => id !== 'oscilloscope')) {
        store.recordTpScore('PrestigeHero', tpId, 20, 45);
      }

      const celebHeroP = waitForWsMsg(wsHero, (m) => m.type === 'world_celebration');
      const celebSpecP = waitForWsMsg(wsSpec, (m) => m.type === 'world_celebration');
      wsHero.send(
        JSON.stringify({
          type: 'submit_score',
          tpId: 'oscilloscope',
          score: 20,
          durationSec: 40
        })
      );
      const [celebHero, celebSpec] = await Promise.all([celebHeroP, celebSpecP]);
      assert.equal(celebHero.reason, 'all_tps_20');
      assert.equal(celebSpec.unlockedDivineSkins.length, i);
      assert.equal(celebHero.secretSkinUnlocked, false);

      const accMid = store.getAccountByUsername('PrestigeHero');
      assert.ok(accMid.xp > xpBeforeAscension);
      xpBeforeAscension = accMid.xp;

      const ascHeroP = waitForWsMsg(wsHero, (m) => m.type === 'world_ascension');
      const ascSpecP = waitForWsMsg(wsSpec, (m) => m.type === 'world_ascension');
      const statsResetP = waitForWsMsg(
        wsHero,
        (m) =>
          m.type === 'player_stats_updated' &&
          m.profile &&
          m.profile.completedCount === 0
      );

      let secretHeroP = null;
      let secretSpecP = null;
      if (i === cycleOrder.length - 1) {
        secretHeroP = waitForWsMsg(wsHero, (m) => m.type === 'secret_skin_unlocked');
        secretSpecP = waitForWsMsg(wsSpec, (m) => m.type === 'secret_skin_unlocked');
      }

      wsHero.send(JSON.stringify({ type: 'ascension_choice', specialty: targetSpec }));
      const [ascHero, ascSpec, statsReset] = await Promise.all([ascHeroP, ascSpecP, statsResetP]);

      assert.equal(ascHero.specialty, targetSpec);
      assert.equal(ascHero.prestigeReset, true);
      assert.equal(ascSpec.prestigeReset, true);
      assert.deepEqual(ascHero.grades, {});
      assert.deepEqual(ascHero.tpScores, {});
      assert.equal(statsReset.profile.completedCount, 0);
      assert.equal(statsReset.profile.average, null);

      const accAfter = store.getAccountByUsername('PrestigeHero');
      assert.equal(accAfter.prestigeCount, i + 1);
      assert.deepEqual(accAfter.tpScores, {});
      assert.deepEqual(accAfter.grades, {});
      assert.equal(accAfter.xp, xpBeforeAscension);
      assert.equal(accAfter.unlockedDivineSkins.includes(targetSpec), true);

      if (i < cycleOrder.length - 1) {
        assert.equal(ascHero.secretSkinUnlocked, false);
        assert.equal(ascHero.justUnlockedSecretSkin, false);
        assert.equal(accAfter.secretSkinUnlocked, false);
      } else {
        assert.equal(ascHero.secretSkinUnlocked, true);
        assert.equal(ascHero.justUnlockedSecretSkin, true);
        assert.equal(accAfter.secretSkinUnlocked, true);
        const [secHero, secSpec] = await Promise.all([secretHeroP, secretSpecP]);
        assert.equal(secHero.secretSkinId, ULTIMATE_SECRET_SKIN_ID);
        assert.equal(
          secSpec.bannerText,
          '🌌 MYSTÈRE RÉVÉLÉ : PrestigeHero a réuni tous les pouvoirs divins et débloqué le SKIN SECRET ULTIME ! 🌌'
        );
      }
    }

    const equipSecretRes = await fetch(`${baseUrl}/api/account/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        selectedSkin: ULTIMATE_SECRET_SKIN_ID,
        avatarCustomization: { secretSkin: true, outfitColor: '#22d3ee' }
      })
    });
    assert.equal(equipSecretRes.status, 200);
    const equipSecretData = await equipSecretRes.json();
    assert.equal(equipSecretData.account.secretSkinUnlocked, true);
    assert.equal(equipSecretData.account.selectedSkin, ULTIMATE_SECRET_SKIN_ID);
    assert.equal(equipSecretData.account.avatarCustomization.secretSkin, true);
  } finally {
    wsHero.close();
    wsSpec.close();
    wsHub.close();
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('v4.12 : Casier masqué/verrouillé, annonce HUD et rendu 3D cosmique multijoueur du Skin Secret Ultime', () => {
  assert.equal(isUltimateSecretSkinId(ULTIMATE_SECRET_SKIN_ID), true);
  assert.equal(hasAllDivineSpecialties(['cyber', 'reseaux']), false);
  assert.equal(
    hasAllDivineSpecialties(['cyber', 'reseaux', 'electronique', 'systemes', 'audiovisuel']),
    true
  );

  assert.equal(
    formatSecretSkinBanner('LouisDev'),
    '🌌 MYSTÈRE RÉVÉLÉ : LouisDev a réuni tous les pouvoirs divins et débloqué le SKIN SECRET ULTIME ! 🌌'
  );
  assert.equal(
    formatSecretSkinAnnouncement('LouisDev'),
    '🌌 MYSTÈRE RÉVÉLÉ : LouisDev a réuni tous les pouvoirs divins et débloqué le SKIN SECRET ULTIME ! 🌌'
  );

  const gs = new GameState();
  gs.unlockDivineSkin('cyber');
  gs.unlockDivineSkin('reseaux');
  gs.unlockDivineSkin('electronique');
  gs.unlockDivineSkin('systemes');
  assert.equal(gs.secretSkinUnlocked, false);

  gs.setSkin({ ...gs.skin, secretSkin: true, divineSpecialty: ULTIMATE_SECRET_SKIN_ID });
  assert.equal(Boolean(gs.skin.secretSkin), false);

  const lockedCasier = getCasierDivineEntries(gs);
  assert.equal(lockedCasier.specialties.length, 5);
  assert.equal(lockedCasier.secretUnlocked, false);
  assert.equal(lockedCasier.secretEntry.unlocked, false);
  assert.equal(lockedCasier.secretEntry.masked, true);
  assert.equal(lockedCasier.secretEntry.label, LOCKED_SECRET_SKIN_LABEL);
  assert.ok(!lockedCasier.secretEntry.label.includes(ULTIMATE_SECRET_SKIN.name));

  gs.unlockDivineSkin('audiovisuel');
  assert.equal(gs.secretSkinUnlocked, true);
  const unlockedCasier = getCasierDivineEntries(gs);
  assert.equal(unlockedCasier.secretUnlocked, true);
  assert.equal(unlockedCasier.secretEntry.unlocked, true);
  assert.equal(unlockedCasier.secretEntry.masked, false);
  assert.equal(unlockedCasier.secretEntry.id, ULTIMATE_SECRET_SKIN_ID);

  const appliedSecret = applySessionDivineSkin({ outfitColor: '#22d3ee' }, ULTIMATE_SECRET_SKIN_ID);
  assert.equal(appliedSecret.secretSkin, true);
  assert.equal(appliedSecret.divineSpecialty, null);

  const avatar = buildStudentAvatarMesh(appliedSecret);
  assert.equal(avatar.hasSecretSkin(), true);
  assert.equal(avatar.secretSkinGroup.visible, true);
  assert.equal(avatar.cosmicWingsGroup.children.length, 2);
  assert.equal(avatar.quantumRingsGroup.children.length, 4);
  assert.ok(avatar.cosmicHaloGroup.children.length > 0);
  assert.equal(avatar.particleTrailGroup.children.length, 36);
  avatar.updateEffects(2.4);

  avatar.setSecretSkin(false);
  assert.equal(avatar.hasSecretSkin(), false);
  assert.equal(avatar.secretSkinGroup.visible, false);

  const scene = new THREE.Scene();
  const remoteMgr = new RemotePlayersManager(scene);
  remoteMgr.upsertPeer({ id: 'peer-secret', name: 'ArchitecteTest', x: 0, y: 0, z: 0 });
  const peerSpec = remoteMgr.setSecretSkin('peer-secret', ULTIMATE_SECRET_SKIN_ID);
  assert.equal(peerSpec.id, ULTIMATE_SECRET_SKIN_ID);
  const peer = remoteMgr.peers.get('peer-secret');
  assert.equal(peer.avatar.hasSecretSkin(), true);
  assert.equal(peer.avatar.secretSkinGroup.visible, true);
  remoteMgr.update(0.016);
});
