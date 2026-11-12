import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
import { sanitizeName, sanitizeSkin, TP_IDS, TP_LABELS } from './store.js';

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

function clamp(val, min, max) {
  const num = Number(val);
  if (!Number.isFinite(num)) return 0;
  return Math.max(min, Math.min(max, num));
}

export function attachWsHub(httpServer, store) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Map();
  const roomChats = new Map();

  function getRoomPeers(roomId, excludeWs = null) {
    const peers = [];
    for (const [sock, state] of clients.entries()) {
      if (sock !== excludeWs && state.name && state.room === roomId && sock.readyState === 1) {
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

  function broadcastToAll(payload, excludeWs = null) {
    const raw = JSON.stringify(payload);
    for (const [sock, state] of clients.entries()) {
      if (sock !== excludeWs && state.name && sock.readyState === 1) {
        sock.send(raw);
      }
    }
  }

  function buildOnlineMap() {
    const map = new Map();
    for (const [sock, s] of clients.entries()) {
      if (!s.name || sock.readyState !== 1) continue;
      map.set(s.name.toLowerCase(), {
        id: s.id,
        name: s.name,
        room: s.room,
        activity: s.activity
      });
    }
    return map;
  }

  function getEnrichedLeaderboard(limit = 50) {
    const onlineMap = buildOnlineMap();
    return store.getLeaderboard(limit).map((entry) => {
      const active = onlineMap.get(entry.name.toLowerCase());
      return {
        ...entry,
        online: Boolean(active),
        onlineRoom: active ? active.room : null,
        onlineActivity: active ? active.activity : null
      };
    });
  }

  function getRoomRoster(roomId) {
    const roster = [];
    for (const [sock, s] of clients.entries()) {
      if (!s.name || s.room !== roomId || sock.readyState !== 1) continue;
      const profile = store.getPublicProfile(s.name.toLowerCase());
      roster.push({
        id: s.id,
        name: s.name,
        color: s.color,
        activity: s.activity,
        average: profile?.average ?? null,
        completedCount: profile?.completedCount ?? 0,
        diplomaEarned: Boolean(profile?.diplomaEarned),
        rank: profile?.rank ?? null
      });
    }
    return roster;
  }

  function buildPeerPayload(state, profile) {
    return {
      id: state.id,
      name: state.name,
      color: state.color,
      skin: state.skin,
      x: state.x,
      y: state.y,
      z: state.z,
      yaw: state.yaw,
      activity: state.activity,
      xp: profile?.xp ?? 0,
      average: profile?.average ?? null,
      completedCount: profile?.completedCount ?? 0,
      diplomaEarned: Boolean(profile?.diplomaEarned),
      rank: profile?.rank ?? null,
      rankLabel: profile?.rankLabel ?? 'Apprenti CIEL'
    };
  }

  function pushChat(roomId, msg) {
    if (!roomChats.has(roomId)) roomChats.set(roomId, []);
    const list = roomChats.get(roomId);
    list.push(msg);
    if (list.length > 40) list.shift();
  }

  function broadcastLeaderboard(excludeWs = null) {
    broadcastToAll(
      {
        type: 'leaderboard_updated',
        leaderboard: getEnrichedLeaderboard(50)
      },
      excludeWs
    );
  }

  function announceScoreInRoom(state, tpId, result, excludeWs = null) {
    const tpLabel = TP_LABELS[tpId] || tpId;
    const message = result.profile.diplomaEarned
      ? `${state.name} a obtenu ${result.score}/20 au ${tpLabel} et décroche le BAC PRO CIEL (${result.profile.average}/20) !`
      : `${state.name} a obtenu ${result.score}/20 au ${tpLabel} !`;

    broadcastToRoom(
      state.room,
      {
        type: 'tp_announcement',
        playerId: state.id,
        playerName: state.name,
        color: state.color,
        tpId,
        tpLabel,
        score: result.score,
        xpGain: result.xpGain,
        isNewBest: result.isNewBest,
        diplomaEarned: result.profile.diplomaEarned,
        average: result.profile.average,
        message
      },
      excludeWs
    );

    broadcastToRoom(
      state.room,
      {
        type: 'player_stats_updated',
        id: state.id,
        profile: {
          xp: result.profile.xp,
          average: result.profile.average,
          completedCount: result.profile.completedCount,
          diplomaEarned: result.profile.diplomaEarned,
          rank: result.profile.rank,
          rankLabel: result.profile.rankLabel
        }
      },
      excludeWs
    );

    if (result.score >= 16 || result.profile.diplomaEarned) {
      const sysMsg = {
        id: crypto.randomUUID().slice(0, 8),
        system: true,
        author: 'M. Fortin',
        text: result.profile.diplomaEarned
          ? `Félicitations à ${state.name} qui décroche le BAC PRO CIEL (${result.profile.average}/20) !`
          : `Bravo ${state.name} pour son ${result.score}/20 au ${tpLabel} !`,
        at: new Date().toISOString()
      };
      pushChat(state.room, sysMsg);
      broadcastToRoom(state.room, { type: 'chat_message', message: sysMsg });
    }
  }

  wss.on('connection', (ws) => {
    const clientId = crypto.randomUUID().slice(0, 8);
    const state = {
      id: clientId,
      name: null,
      room: 'salle-e204',
      x: 0,
      y: 0,
      z: 6.2,
      yaw: 0,
      activity: 'Dans l’atelier',
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
          const incomingSkin = msg.skin && typeof msg.skin === 'object' ? msg.skin : null;
          const profile = store.getOrCreatePlayer(name, incomingSkin);
          const skin = sanitizeSkin(profile.skin, profile.color);

          state.name = profile.name;
          state.skin = skin;
          state.color = skin.outfitColor || profile.color;
          state.room = room;
          state.activity = 'Dans l’atelier';
          state.x = clamp(msg.x ?? 0, -14, 14);
          state.y = clamp(msg.y ?? 0, 0, 3);
          state.z = clamp(msg.z ?? 6.2, -11, 11);
          state.yaw = Number.isFinite(Number(msg.yaw)) ? Number(msg.yaw) : 0;

          const peers = getRoomPeers(room, ws).map(({ state: p }) => {
            const pProfile = store.getPublicProfile(p.name.toLowerCase());
            return buildPeerPayload(p, pProfile);
          });
          const roomRoster = getRoomRoster(room);

          ws.send(
            JSON.stringify({
              type: 'welcome',
              id: state.id,
              room,
              profile,
              peers,
              roomRoster,
              chatHistory: roomChats.get(room) || [],
              onlineCount: peers.length + 1,
              leaderboard: getEnrichedLeaderboard(50)
            })
          );

          broadcastToRoom(
            room,
            {
              type: 'player_joined',
              player: buildPeerPayload(state, profile),
              onlineCount: peers.length + 1,
              roomRoster
            },
            ws
          );

          broadcastLeaderboard(ws);
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

        case 'update_skin': {
          if (!state.name) return;
          const profile = store.updatePlayerSkin(state.name, msg.skin);
          state.skin = profile.skin;
          state.color = profile.color;

          ws.send(JSON.stringify({ type: 'profile_updated', profile }));

          broadcastToRoom(
            state.room,
            {
              type: 'player_skin_updated',
              id: state.id,
              name: state.name,
              skin: state.skin,
              color: state.color
            },
            ws
          );
          broadcastLeaderboard();
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
              activity: state.activity,
              roomRoster: getRoomRoster(state.room)
            },
            ws
          );
          broadcastLeaderboard();
          break;
        }

        case 'emote': {
          if (!state.name) return;
          const label = String(msg.label || '').trim().slice(0, 36);
          const emoteId = String(msg.emoteId || '').trim().slice(0, 16);
          if (!label) return;
          broadcastToRoom(
            state.room,
            {
              type: 'player_emote',
              id: state.id,
              name: state.name,
              color: state.color,
              emoteId,
              label
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

          announceScoreInRoom(state, msg.tpId, result, ws);
          broadcastLeaderboard();
          break;
        }

        case 'chat': {
          if (!state.name) return;
          const text = String(msg.text || '').trim().slice(0, 160);
          if (!text) return;
          const chatMsg = {
            id: crypto.randomUUID().slice(0, 8),
            system: false,
            playerId: state.id,
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
        const roomRoster = getRoomRoster(leaving.room);
        broadcastToRoom(leaving.room, {
          type: 'player_left',
          id: leaving.id,
          name: leaving.name,
          onlineCount: roomRoster.length,
          roomRoster
        });
        broadcastLeaderboard();
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
    getEnrichedLeaderboard,
    notifySkinUpdated: (profile) => {
      if (!profile?.name) return;
      const key = profile.name.toLowerCase();
      for (const [sock, s] of clients.entries()) {
        if (s.name && s.name.toLowerCase() === key && sock.readyState === 1) {
          s.skin = profile.skin;
          s.color = profile.color;
          broadcastToRoom(
            s.room,
            {
              type: 'player_skin_updated',
              id: s.id,
              name: s.name,
              skin: s.skin,
              color: s.color
            },
            sock
          );
        }
      }
      broadcastLeaderboard();
    },
    notifyScore: (name, tpId, result) => {
      const key = String(name || '').toLowerCase();
      for (const [sock, s] of clients.entries()) {
        if (s.name && s.name.toLowerCase() === key && sock.readyState === 1) {
          announceScoreInRoom(s, tpId, result, sock);
        }
      }
      broadcastLeaderboard();
    },
    close: () => wss.close()
  };
}
