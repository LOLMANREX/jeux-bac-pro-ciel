import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { GameStore, MapStore, ALL_TP_IDS, TP_IDS, TP_LABELS } from './store.js';
import { attachWsHub } from './wsHub.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function safePasswordEqual(input, expected) {
  const hashA = crypto.createHash('sha256').update(String(input || '')).digest();
  const hashB = crypto.createHash('sha256').update(String(expected || '')).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function createGameServer(options = {}) {
  const dbPath =
    options.dbPath === undefined
      ? path.join(__dirname, 'data', 'db.json')
      : options.dbPath;
  const mapPath =
    options.mapPath !== undefined
      ? options.mapPath
      : dbPath === null
        ? null
        : path.join(path.dirname(dbPath), 'map.json');
  const distDir = options.distDir || path.join(ROOT_DIR, 'dist');

  const store = new GameStore(dbPath);
  const mapStore = new MapStore(mapPath);
  const adminPassword = options.adminPassword || process.env.ADMIN_PASSWORD || 'Louisetjade1102';
  const adminTokens = new Map();
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '4mb' }));
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    next();
  });

  const server = http.createServer(app);
  const wsHub = attachWsHub(server, store);

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      game: 'Atelier CIEL 3D',
      playersOnline: wsHub.getOnlineCount(),
      tps: TP_IDS,
      allTps: ALL_TP_IDS,
      timestamp: new Date().toISOString()
    });
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
    res.json(result);
  };

  app.post('/api/score', handleRecordTpScore);
  app.post('/api/tp', handleRecordTpScore);

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

  app.get('/api/admin/players', requireAdmin, (_req, res) => {
    const players = wsHub.getAllEnrichedPlayers();
    const onlineCount = players.filter((p) => p.online).length;
    const totalPlaytimeSeconds = players.reduce((acc, p) => acc + (p.playtimeSeconds || 0), 0);
    res.json({
      players,
      summary: {
        totalPlayers: players.length,
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
  const { server } = createGameServer();
  server.listen(PORT, () => {
    console.log(`[Atelier CIEL 3D] Serveur prêt sur http://localhost:${PORT}`);
  });
}
