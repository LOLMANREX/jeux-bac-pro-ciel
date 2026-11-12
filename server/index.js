import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { GameStore, TP_IDS } from './store.js';
import { attachWsHub } from './wsHub.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

export function createGameServer(options = {}) {
  const dbPath =
    options.dbPath === undefined
      ? path.join(__dirname, 'data', 'db.json')
      : options.dbPath;
  const distDir = options.distDir || path.join(ROOT_DIR, 'dist');

  const store = new GameStore(dbPath);
  const app = express();
  app.use(express.json());

  const server = http.createServer(app);
  const wsHub = attachWsHub(server, store);

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      game: 'Atelier CIEL 3D',
      playersOnline: wsHub.getOnlineCount(),
      tps: TP_IDS,
      timestamp: new Date().toISOString()
    });
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

  app.post('/api/score', (req, res) => {
    const { name, tpId, score, durationSec, skin } = req.body || {};
    if (!name || !TP_IDS.includes(tpId)) {
      return res.status(400).json({ error: 'Paramètres invalides' });
    }
    const result = store.recordTpScore(name, tpId, score, durationSec, skin);
    wsHub.notifyScore(name, tpId, result);
    res.json(result);
  });

  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir, { maxAge: '1h' }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
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

  return { app, server, store, wsHub };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isMain) {
  const PORT = Number(process.env.PORT || 3000);
  const { server } = createGameServer();
  server.listen(PORT, () => {
    console.log(`[Atelier CIEL 3D] Serveur prêt sur http://localhost:${PORT}`);
  });
}
