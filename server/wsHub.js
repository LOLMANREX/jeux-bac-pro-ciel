import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
import { sanitizeName, TP_IDS } from './store.js';

const DEFAULT_ROOMS = ['salle-e204', 'salle-reseau'];

function sanitizeRoom(raw) {
  const cleaned = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 22);
  return cleaned || 'salle-e204';
}

function sanitizeSkin(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const hexOk = (v, fallback) => (/^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? String(v) : fallback);
  const styles = new Set(['blouse', 'hoodie', 'cyber']);
  const hats = new Set(['none', 'cap', 'headset', 'glasses']);
  return {
    outfitColor: hexOk(s.outfitColor, '#22d3ee'),
    outfitStyle: styles.has(s.outfitStyle) ? s.outfitStyle : 'blouse',
    hat: hats.has(s.hat) ? s.hat : 'glasses',
    skinTone: hexOk(s.skinTone, '#f1c29b'),
    pantsColor: hexOk(s.pantsColor, '#1e293b')
  };
}

function clamp(val, min, max) {
  const num = Number(val);
  if (!Number.isFinite(num)) return 0;
  return Math.max(min, Math.min(max, num));
}

export function attachWsHub(httpServer, store) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Map(); // ws -> clientState
  const roomChats = new Map(); // roomId -> array of recent chat items

  function getRoomPeers(roomId, excludeWs = null) {
    const peers = [];
    for (const [sock, state] of clients.entries()) {
      if (sock !== excludeWs && state.room === roomId && sock.readyState === 1) {
        peers.push({ sock, state });
      }
    }
    return peers;
  }

  function broadcastToRoom(roomId, payload, excludeWs = null) {
    const raw = JSON.stringify(payload);
    for (const { sock } of getRoomPeers(roomId, excludeWs)) {
      sock.send(raw);
    }
  }

  function pushChat(roomId, msg) {
    if (!roomChats.has(roomId)) roomChats.set(roomId, []);
    const list = roomChats.get(roomId);
    list.push(msg);
    if (list.length > 30) list.shift();
  }

  wss.on('connection', (ws) => {
    const clientId = crypto.randomUUID().slice(0, 8);
    const state = {
      id: clientId,
      name: null,
      room: 'salle-e204',
      x: 0,
      y: 0,
      z: 6.5,
      yaw: 0,
      activity: 'Connexion...',
      color: '#22d3ee',
      skin: sanitizeSkin(null)
    };
    clients.set(ws, state);

    ws.on('message', (rawBuffer) => {
      let msg;
      try {
        msg = JSON.parse(rawBuffer.toString('utf8'));
      } catch {
        return;
      }
      if (!msg || typeof msg.type !== 'string') return;

      switch (msg.type) {
        case 'join': {
          const name = sanitizeName(msg.name);
          const room = sanitizeRoom(msg.room);
          const skin = sanitizeSkin(msg.skin);
          const profile = store.getOrCreatePlayer(name);

          state.name = profile.name;
          state.color = skin.outfitColor || profile.color;
          state.skin = skin;
          state.room = room;
          state.activity = 'Dans l’atelier';
          state.x = clamp(msg.x ?? 0, -14, 14);
          state.y = 0;
          state.z = clamp(msg.z ?? 6.5, -11, 11);
          state.yaw = Number.isFinite(Number(msg.yaw)) ? Number(msg.yaw) : 0;

          const peers = getRoomPeers(room, ws).map(({ state: p }) => ({
            id: p.id,
            name: p.name,
            color: p.color,
            skin: p.skin,
            x: p.x,
            y: p.y,
            z: p.z,
            yaw: p.yaw,
            activity: p.activity
          }));

          ws.send(
            JSON.stringify({
              type: 'welcome',
              id: state.id,
              room,
              profile,
              peers,
              chatHistory: roomChats.get(room) || [],
              onlineCount: peers.length + 1
            })
          );

          broadcastToRoom(
            room,
            {
              type: 'player_joined',
              player: {
                id: state.id,
                name: state.name,
                color: state.color,
                skin: state.skin,
                x: state.x,
                y: state.y,
                z: state.z,
                yaw: state.yaw,
                activity: state.activity
              },
              onlineCount: peers.length + 1
            },
            ws
          );
          break;
        }

        case 'move': {
          if (!state.name) return;
          state.x = clamp(msg.x, -14, 14);
          state.y = clamp(msg.y ?? 0, 0, 3);
          state.z = clamp(msg.z, -11, 11);
          state.yaw = Number.isFinite(Number(msg.yaw)) ? Number(msg.yaw) : state.yaw;

          broadcastToRoom(
            state.room,
            {
              type: 'player_moved',
              id: state.id,
              x: state.x,
              y: state.y,
              z: state.z,
              yaw: state.yaw
            },
            ws
          );
          break;
        }

        case 'activity': {
          if (!state.name) return;
          state.activity = String(msg.activity || 'Dans l’atelier').slice(0, 36);
          broadcastToRoom(
            state.room,
            {
              type: 'player_activity',
              id: state.id,
              activity: state.activity
            },
            ws
          );
          break;
        }

        case 'accept_quest': {
          if (!state.name) return;
          const profile = store.acceptQuest(state.name);
          ws.send(JSON.stringify({ type: 'profile_updated', profile }));
          break;
        }

        case 'submit_score': {
          if (!state.name) return;
          if (!TP_IDS.includes(msg.tpId)) return;
          const result = store.recordTpScore(
            state.name,
            msg.tpId,
            msg.score,
            msg.durationSec
          );
          ws.send(
            JSON.stringify({
              type: 'score_recorded',
              tpId: msg.tpId,
              ...result
            })
          );

          if (result.score >= 16 || result.profile.diplomaEarned) {
            const sysMsg = {
              id: crypto.randomUUID().slice(0, 8),
              system: true,
              author: 'M. Fortin',
              text: result.profile.diplomaEarned
                ? `Félicitations à ${state.name} qui décroche le BAC PRO CIEL (${result.profile.average}/20) !`
                : `Bravo ${state.name} pour son ${result.score}/20 au TP ${msg.tpId.toUpperCase()} !`,
              at: new Date().toISOString()
            };
            pushChat(state.room, sysMsg);
            broadcastToRoom(state.room, { type: 'chat_message', message: sysMsg });
          }
          break;
        }

        case 'chat': {
          if (!state.name) return;
          const text = String(msg.text || '').trim().slice(0, 160);
          if (!text) return;
          const chatMsg = {
            id: crypto.randomUUID().slice(0, 8),
            system: false,
            author: state.name,
            color: state.color,
            text,
            at: new Date().toISOString()
          };
          pushChat(state.room, chatMsg);
          broadcastToRoom(state.room, { type: 'chat_message', message: chatMsg });
          break;
        }

        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong', t: Date.now() }));
          break;
        }
      }
    });

    ws.on('close', () => {
      const leaving = clients.get(ws);
      clients.delete(ws);
      if (leaving && leaving.name) {
        const remaining = getRoomPeers(leaving.room).length;
        broadcastToRoom(leaving.room, {
          type: 'player_left',
          id: leaving.id,
          name: leaving.name,
          onlineCount: remaining
        });
      }
    });
  });

  return {
    getOnlineCount: () => {
      let count = 0;
      for (const s of clients.values()) {
        if (s.name) count++;
      }
      return count;
    },
    getRoomsSummary: () => {
      const map = new Map();
      for (const def of DEFAULT_ROOMS) {
        map.set(def, { room: def, count: 0, players: [] });
      }
      for (const s of clients.values()) {
        if (!s.name) continue;
        if (!map.has(s.room)) map.set(s.room, { room: s.room, count: 0, players: [] });
        const entry = map.get(s.room);
        entry.count++;
        entry.players.push(s.name);
      }
      return [...map.values()];
    },
    close: () => wss.close()
  };
}
