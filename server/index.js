import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import {
  GameStore,
  MapStore,
  ALL_TP_IDS,
  TP_IDS,
  TP_LABELS,
  hasAllTpsAt20InScores,
  sanitizeName
} from './store.js';
import {
  FORMATIVE_POLES,
  FORMATIVE_TP_CATALOG
} from '../src/core/formativeCatalog.js';
import {
  SHOP_CATALOG,
  SHOP_CATEGORIES,
  SHOP_RARITIES
} from '../src/world/ShopCatalog.js';
import { attachWsHub, isCreatorPseudo, isPrivateDebugRoom } from './wsHub.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const STUDENT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function safePasswordEqual(input, expected) {
  const hashA = crypto.createHash('sha256').update(String(input || '')).digest();
  const hashB = crypto.createHash('sha256').update(String(expected || '')).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function createGameServer(options = {}) {
  const accountsPath =
    options.accountsPath !== undefined
      ? options.accountsPath
      : options.dbPath === null
        ? null
        : options.dbPath !== undefined
          ? path.join(path.dirname(options.dbPath), 'accounts.json')
          : path.join(__dirname, 'data', 'accounts.json');

  const dbPath =
    options.dbPath === undefined
      ? null
      : options.dbPath;

  const mapPath =
    options.mapPath !== undefined
      ? options.mapPath
      : options.dbPath === null && options.accountsPath === undefined
        ? null
        : options.dbPath
          ? path.join(path.dirname(options.dbPath), 'map.json')
          : path.join(__dirname, 'data', 'map.json');

  const distDir = options.distDir || path.join(ROOT_DIR, 'dist');

  const store = new GameStore(dbPath, { accountsPath });
  const mapStore = new MapStore(mapPath);
  const adminPassword = options.adminPassword || process.env.ADMIN_PASSWORD || 'Louisetjade1102';
  const studentTokenSecret =
    options.studentTokenSecret ||
    process.env.STUDENT_TOKEN_SECRET ||
    `ciel-v49-secret-${adminPassword}`;
  const adminTokens = new Map();
  const studentTokens = new Map();

  const createStudentSessionToken = (account) => {
    const adminAcc = store.getAdminAccount(account.username || account.id);
    const pw = adminAcc?.password || '';
    const payloadRaw = JSON.stringify({
      id: account.id,
      u: account.username,
      iat: Date.now()
    });
    const payloadB64 = Buffer.from(payloadRaw, 'utf8').toString('base64url');
    const sig = crypto
      .createHmac('sha256', `${studentTokenSecret}:${pw}`)
      .update(payloadB64)
      .digest('base64url');
    const token = `${payloadB64}.${sig}`;
    studentTokens.set(token, {
      id: account.id,
      username: account.username,
      expiresAt: Date.now() + STUDENT_SESSION_TTL_MS
    });
    return token;
  };

  const verifyStudentSessionToken = (rawToken) => {
    const token = String(rawToken || '').trim();
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length === 2) {
      try {
        const parsed = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
        const adminAcc = store.getAdminAccount(parsed.id || parsed.u);
        if (!adminAcc) {
          studentTokens.delete(token);
          return null;
        }
        const expectedSig = crypto
          .createHmac('sha256', `${studentTokenSecret}:${adminAcc.password || ''}`)
          .update(parts[0])
          .digest('base64url');
        if (safePasswordEqual(parts[1], expectedSig)) {
          return adminAcc.username;
        }
        studentTokens.delete(token);
        return null;
      } catch {
        studentTokens.delete(token);
        return null;
      }
    }
    const cached = studentTokens.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      const adminAcc = store.getAdminAccount(cached.id || cached.username);
      if (adminAcc) return adminAcc.username;
    }
    studentTokens.delete(token);
    return null;
  };

  const extractStudentToken = (req) => {
    const headerToken = req.headers['x-auth-token'] || req.headers['x-session-token'];
    const authHeader = req.headers.authorization;
    const bearer =
      typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7).trim()
        : '';
    return String(
      headerToken || bearer || req.body?.token || req.query?.token || ''
    ).trim();
  };

  const resolveStudentFromRequest = (req) => {
    const token = extractStudentToken(req);
    if (token) {
      const verifiedUser = verifyStudentSessionToken(token);
      if (verifiedUser) return verifiedUser;
    }
    if (req.body?.username && req.body?.password !== undefined) {
      const check = store.loginAccount({
        username: req.body.username,
        password: req.body.password
      });
      if (check.ok) return check.account.username;
    }
    return null;
  };

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '50mb' }));
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    next();
  });

  const server = http.createServer(app);
  const wsHub = attachWsHub(
    server,
    store,
    mapStore,
    options.survivalOptions || {},
    options.combatOptions || {}
  );

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      game: 'Atelier CIEL 3D',
      playersOnline: wsHub.getOnlineCount(),
      tps: TP_IDS,
      allTps: ALL_TP_IDS,
      allTpsCount: ALL_TP_IDS.length,
      timestamp: new Date().toISOString()
    });
  });

  app.post('/api/auth/register', (req, res) => {
    const result = store.registerAccount(req.body || {});
    if (!result.ok) {
      return res.status(result.status || 400).json({ error: result.error });
    }
    const token = createStudentSessionToken(result.account);
    return res.status(201).json({
      ok: true,
      token,
      account: result.account,
      profile: result.profile
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const result = store.loginAccount(req.body || {});
    if (!result.ok) {
      return res.status(result.status || 401).json({ error: result.error });
    }
    const token = createStudentSessionToken(result.account);
    return res.json({
      ok: true,
      token,
      account: result.account,
      profile: result.profile
    });
  });

  app.get('/api/auth/me', (req, res) => {
    const username = resolveStudentFromRequest(req);
    if (!username) {
      return res.status(401).json({ error: 'Session élève invalide ou expirée' });
    }
    const account = store.getPublicAccount(username);
    const profile = store.getPublicProfile(username.toLowerCase());
    if (!account) {
      return res.status(401).json({ error: 'Compte élève introuvable' });
    }
    return res.json({
      ok: true,
      account,
      profile
    });
  });

  app.post('/api/account/save', (req, res) => {
    const username = resolveStudentFromRequest(req);
    if (!username) {
      return res.status(401).json({ error: 'Authentification élève requise' });
    }
    const result = store.saveAccountData(username, req.body || {});
    if (!result.ok) {
      return res.status(result.status || 400).json({ error: result.error });
    }
    if (result.profile) {
      wsHub.notifySkinUpdated(result.profile);
    }
    return res.json({
      ok: true,
      account: result.account,
      profile: result.profile
    });
  });

  const resolveAuthorizedEconomyTarget = (req, rawCandidateName = req.body?.name) => {
    const tokenUser = resolveStudentFromRequest(req);
    const bodyName = typeof rawCandidateName === 'string' ? rawCandidateName.trim() : '';
    if (tokenUser) {
      const lowerBody = bodyName.toLowerCase();
      const isDefaultPlaceholder = !lowerBody || lowerBody === 'eleve_ciel';
      if (!isDefaultPlaceholder && lowerBody !== tokenUser.toLowerCase()) {
        return {
          ok: false,
          status: 403,
          error: 'Session élève incompatible avec le compte ciblé.'
        };
      }
      return { ok: true, target: tokenUser };
    }
    if (!bodyName) {
      return {
        ok: false,
        status: 401,
        error: 'Authentification ou pseudo élève requis.'
      };
    }
    if (store.getAdminAccount(bodyName)) {
      return {
        ok: false,
        status: 401,
        error: 'Jeton de session requis pour ce compte élève.'
      };
    }
    return { ok: true, target: bodyName };
  };

  app.get('/api/shop/catalog', (_req, res) => {
    res.json({
      ok: true,
      catalog: SHOP_CATALOG,
      categories: SHOP_CATEGORIES,
      rarities: SHOP_RARITIES
    });
  });

  app.post('/api/shop/buy', (req, res) => {
    const auth = resolveAuthorizedEconomyTarget(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ ok: false, error: auth.error });
    }
    const { itemId } = req.body || {};
    const result = store.buyShopItem(auth.target, itemId);
    if (!result.ok) {
      return res.status(result.status || 400).json({ ok: false, error: result.error });
    }
    if (result.profile) {
      wsHub.notifyProfileUpdated?.(result.profile);
    }
    return res.json(result);
  });

  app.post('/api/shop/equip', (req, res) => {
    const auth = resolveAuthorizedEconomyTarget(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ ok: false, error: auth.error });
    }
    const result = store.equipShopItem(auth.target, req.body || {});
    if (!result.ok) {
      return res.status(result.status || 400).json({ ok: false, error: result.error });
    }
    if (result.profile) {
      wsHub.notifySkinUpdated(result.profile);
      wsHub.notifyProfileUpdated?.(result.profile);
    }
    return res.json(result);
  });

  app.post('/api/economy/arcade', (req, res) => {
    const auth = resolveAuthorizedEconomyTarget(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ ok: false, error: auth.error });
    }
    const result = store.recordArcadeScore(auth.target, req.body || {});
    if (!result.ok) {
      return res.status(result.status || 400).json({ ok: false, error: result.error });
    }
    if (result.profile) {
      wsHub.notifyCoinsEarned?.(result.profile, {
        coinsEarned: result.coinsEarned,
        source: 'arcade',
        gameId: result.gameId,
        isNewRecord: result.isNewRecord
      });
    }
    return res.json(result);
  });

  app.post('/api/economy/survival', (req, res) => {
    const auth = resolveAuthorizedEconomyTarget(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ ok: false, error: auth.error });
    }
    const result = store.recordSurvivalReward(auth.target, req.body || {});
    if (!result.ok) {
      return res.status(result.status || 400).json({ ok: false, error: result.error });
    }
    if (result.profile) {
      wsHub.notifyCoinsEarned?.(result.profile, {
        coinsEarned: result.coinsEarned,
        source: 'survival',
        outcome: result.outcome
      });
    }
    return res.json(result);
  });

  app.post('/api/economy/combat', (req, res) => {
    const auth = resolveAuthorizedEconomyTarget(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ ok: false, error: auth.error });
    }
    const result = store.recordCombatReward(auth.target, req.body || {});
    if (!result.ok) {
      return res.status(result.status || 400).json({ ok: false, error: result.error });
    }
    if (result.profile) {
      wsHub.notifyCoinsEarned?.(result.profile, {
        coinsEarned: result.coinsEarned,
        source: 'combat',
        won: result.won,
        kills: result.kills
      });
    }
    return res.json(result);
  });

  app.get('/api/formative/catalog', (_req, res) => {
    res.json({
      ok: true,
      poles: FORMATIVE_POLES,
      tps: FORMATIVE_TP_CATALOG
    });
  });

  app.get('/api/formative/progress', (req, res) => {
    const auth = resolveAuthorizedEconomyTarget(req, req.query?.name);
    if (!auth.ok) {
      return res.status(auth.status).json({ ok: false, error: auth.error });
    }
    const account = store.getPublicAccount(auth.target);
    const lookupName = account?.username || sanitizeName(auth.target);
    const profile = store.getPublicProfile(lookupName.toLowerCase());
    const source = profile || account || {};
    return res.json({
      ok: true,
      formativeProgress: source.formativeProgress || {},
      formativeRewardedTps: Array.isArray(source.formativeRewardedTps)
        ? source.formativeRewardedTps
        : [],
      coins: Number(source.coins) || 0,
      xp: Number(source.xp) || 0
    });
  });

  app.post('/api/formative/submit', (req, res) => {
    const auth = resolveAuthorizedEconomyTarget(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ ok: false, error: auth.error });
    }
    const result = store.recordFormativeProgress(auth.target, {
      tpId: req.body?.tpId,
      answers: req.body?.answers
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({ ok: false, error: result.error });
    }
    if (result.profile) {
      if (result.coinsEarned > 0) {
        wsHub.notifyCoinsEarned?.(result.profile, {
          coinsEarned: result.coinsEarned,
          xpEarned: result.xpEarned,
          source: 'formative',
          tpId: result.tpId,
          tpTitle: result.tpTitle
        });
      } else {
        wsHub.notifyProfileUpdated?.(result.profile);
      }
    }
    return res.json(result);
  });

  app.get('/api/map', (_req, res) => {
    res.json(mapStore.getMap());
  });

  app.get('/api/rooms', (_req, res) => {
    res.json({
      rooms: wsHub.getRoomsSummary()
    });
  });

  app.get('/api/leaderboard', (_req, res) => {
    res.json({
      leaderboard: wsHub.getEnrichedLeaderboard(50)
    });
  });

  app.get('/api/profile/:name', (req, res) => {
    const profile = store.getOrCreatePlayer(req.params.name);
    res.json({ profile });
  });

  app.post('/api/profile/skin', (req, res) => {
    const { name, skin } = req.body || {};
    if (!name || !skin || typeof skin !== 'object') {
      return res.status(400).json({ error: 'Paramètres invalides' });
    }
    const profile = store.updatePlayerSkin(name, skin);
    wsHub.notifySkinUpdated(profile);
    res.json({ profile });
  });

  app.post('/api/quest/accept', (req, res) => {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Nom requis' });
    const profile = store.acceptQuest(name);
    res.json({ profile });
  });

  const handleRecordTpScore = (req, res) => {
    const { name, tpId, score, durationSec, skin } = req.body || {};
    if (!name || !ALL_TP_IDS.includes(tpId)) {
      return res.status(400).json({ error: 'Paramètres invalides' });
    }
    const result = store.recordTpScore(name, tpId, score, durationSec, skin);
    wsHub.notifyScore(name, tpId, result);
    if (result.coinsEarned > 0 && result.profile) {
      wsHub.notifyCoinsEarned?.(result.profile, {
        coinsEarned: result.coinsEarned,
        source: 'tp',
        tpId,
        score: result.score,
        isFirstValidation: result.isFirstValidation
      });
    }
    res.json(result);
  };

  app.post('/api/score', handleRecordTpScore);
  app.post('/api/tp', handleRecordTpScore);

  app.post('/api/celebration', (req, res) => {
    const { name, room, tpId, tpLabel, specialty } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: 'Pseudo requis' });
    }
    if (!isCreatorPseudo(name) && !isPrivateDebugRoom(room)) {
      return res.status(403).json({ error: 'Pouvoir réservé au Créateur Louis ou au Serveur Privé Debug' });
    }
    const celebration = wsHub.triggerCelebration({
      playerName: name,
      room: room || 'plateau-u300',
      tpId: tpId || 'oscilloscope',
      tpLabel,
      specialty,
      reason: isPrivateDebugRoom(room) ? 'debug' : 'creator'
    });
    return res.json({ ok: true, celebration });
  });

  app.post('/api/celebration/ascend', (req, res) => {
    const { name, room, specialty, celebrationId } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: 'Pseudo requis' });
    }
    const existingProfile = store.getPublicProfile(name.toLowerCase());
    const canAscend =
      hasAllTpsAt20InScores(existingProfile?.grades || {}) ||
      isCreatorPseudo(name) ||
      isPrivateDebugRoom(room);
    if (!canAscend) {
      return res.status(403).json({
        error: 'Ascension réservée aux élèves ayant obtenu 20/20 sur tous les TPs du jeu.'
      });
    }
    const ascension = wsHub.triggerAscension({
      playerName: name,
      room: room || 'plateau-u300',
      specialty: specialty || 'cyber',
      celebrationId
    });
    const profile = store.getPublicProfile(name.toLowerCase());
    const account = store.getPublicAccount(name);
    return res.json({ ok: true, ascension, profile, account });
  });

  app.post('/api/debug/validate-all', (req, res) => {
    const { name, skin, room, triggerCelebration } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: 'Pseudo requis' });
    }
    const result = store.validateAllTps(name, skin);
    const celebration =
      triggerCelebration === false ? null : wsHub.notifyValidateAll(name, result, room);
    return res.json({ ok: true, ...result, celebration });
  });

  app.post('/api/debug/reset', (req, res) => {
    const { name } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: 'Pseudo requis' });
    }
    store.getOrCreatePlayer(name);
    const profile = store.resetPlayer(name);
    wsHub.notifyPlayerReset(profile);
    return res.json({ ok: true, profile });
  });

  app.get('/api/suggestions', (_req, res) => {
    res.json({
      suggestions: store.getSuggestions()
    });
  });

  app.post('/api/suggestions', (req, res) => {
    const { author, message } = req.body || {};
    const suggestion = store.addSuggestion(author, message);
    if (!suggestion) {
      return res.status(400).json({
        error: 'Veuillez renseigner votre nom / pseudo ainsi que votre suggestion.'
      });
    }
    return res.status(201).json({ ok: true, suggestion });
  });

  app.post('/api/pigeons', (req, res) => {
    const { playerName, platform } = req.body || {};
    const pigeon = store.addPigeon(playerName, platform);
    return res.status(201).json({ ok: true, pigeon });
  });

  const requireAdmin = (req, res, next) => {
    const headerToken = req.headers['x-admin-token'];
    const authHeader = req.headers.authorization;
    const bearer =
      typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7).trim()
        : '';
    const token = String(headerToken || bearer || '').trim();
    const expiresAt = token ? adminTokens.get(token) : null;
    if (!expiresAt || expiresAt <= Date.now()) {
      if (token) adminTokens.delete(token);
      return res.status(401).json({ error: 'Authentification administrateur requise' });
    }
    adminTokens.set(token, Date.now() + ADMIN_SESSION_TTL_MS);
    req.adminToken = token;
    return next();
  };

  app.post('/api/admin/login', (req, res) => {
    const { password } = req.body || {};
    if (!password || !safePasswordEqual(password, adminPassword)) {
      return res.status(401).json({ error: 'Mot de passe administrateur incorrect' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    adminTokens.set(token, Date.now() + ADMIN_SESSION_TTL_MS);
    return res.json({ ok: true, token, expiresInMs: ADMIN_SESSION_TTL_MS });
  });

  app.post('/api/admin/debug-session', requireAdmin, (req, res) => {
    const requestedRoom = String(req.body?.room || '').trim();
    const room =
      requestedRoom && isPrivateDebugRoom(requestedRoom)
        ? requestedRoom
        : `priv-debug-${crypto.randomBytes(3).toString('hex')}`;
    const debugUrl = `/?debug=1&room=${encodeURIComponent(room)}`;
    return res.json({
      ok: true,
      isolated: true,
      room,
      debugUrl,
      badge: '🛠️ SERVEUR PRIVÉ DEBUG'
    });
  });

  app.get('/api/admin/accounts', requireAdmin, (_req, res) => {
    const accounts = wsHub.getAllEnrichedAccounts();
    return res.json({
      ok: true,
      accounts,
      total: accounts.length,
      tpIds: TP_IDS,
      allTpIds: ALL_TP_IDS,
      tpLabels: TP_LABELS
    });
  });

  const handleAdminUpdatePassword = (req, res) => {
    const target = req.params.target || req.params.name;
    const newPassword = req.body?.password ?? req.body?.newPassword;
    if (!newPassword || String(newPassword).trim().length < 3) {
      return res.status(400).json({
        error: 'Le nouveau mot de passe doit contenir au moins 3 caractères.'
      });
    }
    try {
      const account = store.updateAccountPassword(target, newPassword);
      if (!account) {
        return res.status(404).json({ error: 'Compte élève introuvable' });
      }
      return res.json({ ok: true, account });
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Mot de passe invalide' });
    }
  };

  app.post('/api/admin/accounts/:target/password', requireAdmin, handleAdminUpdatePassword);
  app.put('/api/admin/accounts/:target/password', requireAdmin, handleAdminUpdatePassword);
  app.patch('/api/admin/accounts/:target', requireAdmin, handleAdminUpdatePassword);
  app.post('/api/admin/players/:name/password', requireAdmin, handleAdminUpdatePassword);

  app.post('/api/admin/accounts/:target/reset', requireAdmin, (req, res) => {
    const result = store.resetAccount(req.params.target);
    if (!result || !result.profile) {
      return res.status(404).json({ error: 'Compte élève introuvable' });
    }
    wsHub.notifyPlayerReset(result.profile);
    return res.json({ ok: true, account: result.account, profile: result.profile });
  });

  const handleAdminBattlePassUpdate = (req, res) => {
    const result = store.adminUpdateAccountBattlePass(req.params.target, req.body || {});
    if (!result) {
      return res.status(404).json({ error: 'Compte élève introuvable' });
    }
    if (result.profile) {
      if (wsHub.notifyAccountUpdated) {
        wsHub.notifyAccountUpdated(result.profile);
      } else {
        wsHub.notifySkinUpdated(result.profile);
      }
    }
    return res.json({ ok: true, account: result.account, profile: result.profile });
  };

  app.post('/api/admin/accounts/:target/battlepass', requireAdmin, handleAdminBattlePassUpdate);
  app.post('/api/admin/accounts/:target/special-skins', requireAdmin, handleAdminBattlePassUpdate);

  app.delete('/api/admin/accounts/:target', requireAdmin, (req, res) => {
    const deleted = store.deleteAccount(req.params.target);
    if (!deleted) {
      return res.status(404).json({ error: 'Compte élève introuvable' });
    }
    wsHub.disconnectPlayer(deleted.username);
    return res.json({ ok: true, name: deleted.username, username: deleted.username, id: deleted.id });
  });

  app.get('/api/admin/players', requireAdmin, (_req, res) => {
    const players = wsHub.getAllEnrichedPlayers();
    const accounts = wsHub.getAllEnrichedAccounts();
    const onlineCount = players.filter((p) => p.online).length;
    const totalPlaytimeSeconds = players.reduce((acc, p) => acc + (p.playtimeSeconds || 0), 0);
    res.json({
      players,
      accounts,
      summary: {
        totalPlayers: players.length,
        totalAccounts: accounts.length,
        onlineCount,
        totalPlaytimeSeconds
      },
      tpIds: TP_IDS,
      tpLabels: TP_LABELS
    });
  });

  app.post('/api/admin/players/:name/reset', requireAdmin, (req, res) => {
    const profile = store.resetPlayer(req.params.name);
    if (!profile) {
      return res.status(404).json({ error: 'Élève introuvable' });
    }
    wsHub.notifyPlayerReset(profile);
    return res.json({ ok: true, profile });
  });

  app.delete('/api/admin/players/:name', requireAdmin, (req, res) => {
    const targetName = req.params.name;
    const deleted = store.deletePlayer(targetName);
    if (!deleted) {
      return res.status(404).json({ error: 'Élève introuvable' });
    }
    wsHub.disconnectPlayer(targetName);
    return res.json({ ok: true, name: targetName });
  });

  app.delete('/api/admin/suggestions/:id', requireAdmin, (req, res) => {
    const deleted = store.deleteSuggestion(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Suggestion introuvable' });
    }
    return res.json({ ok: true, id: req.params.id });
  });

  app.get('/api/admin/pigeons', requireAdmin, (_req, res) => {
    const pigeons = store.getPigeons();
    return res.json({ pigeons, total: pigeons.length });
  });

  app.delete('/api/admin/pigeons', requireAdmin, (_req, res) => {
    store.clearPigeons();
    return res.json({ ok: true });
  });

  app.delete('/api/admin/pigeons/:id', requireAdmin, (req, res) => {
    const deleted = store.deletePigeon(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Entrée introuvable' });
    }
    return res.json({ ok: true, id: req.params.id });
  });

  app.put('/api/admin/map', requireAdmin, (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : null;
    const candidate = body?.map && typeof body.map === 'object' ? body.map : body;
    if (!candidate || typeof candidate !== 'object' || !Array.isArray(candidate.walls) || !Array.isArray(candidate.objects)) {
      return res.status(400).json({ error: 'Format de carte JSON invalide (murs ou objets manquants)' });
    }
    const saved = mapStore.saveMap(candidate);
    wsHub.broadcastMapUpdated(saved);
    return res.json({ ok: true, map: saved });
  });

  if (fs.existsSync(distDir)) {
    const setNoCacheHtml = (res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    };

    app.get(['/admin', '/admin/'], (req, res, next) => {
      const adminHtml = path.join(distDir, 'admin.html');
      if (!fs.existsSync(adminHtml)) return next();
      setNoCacheHtml(res);
      return res.sendFile(adminHtml);
    });

    app.use(
      express.static(distDir, {
        maxAge: '1h',
        setHeaders: (res, filePath) => {
          const base = path.basename(filePath);
          if (base === 'index.html' || base === 'admin.html') {
            setNoCacheHtml(res);
          }
        }
      })
    );
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
      setNoCacheHtml(res);
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res
        .status(200)
        .send(
          '<h1>Serveur Atelier CIEL 3D actif</h1><p>Lancez <code>npm run build</code> puis rechargez, ou ouvrez le client Vite.</p>'
        );
    });
  }

  return { app, server, store, mapStore, wsHub };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  const PORT = Number(process.env.PORT || 3000);
  const { server, store } = createGameServer();
  if (store.migratedToV411) {
    console.log('[Atelier CIEL 3D] Migration v4.11 : reset global des comptes, notes et skins divins effectué.');
  }
  server.listen(PORT, () => {
    console.log(`[Atelier CIEL 3D] Serveur prêt sur http://localhost:${PORT}`);
  });
}
