import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
import {
  ASCENSION_SPECIALTIES,
  applySessionDivineSkin,
  resolveAscensionSpecialty,
  ULTIMATE_SECRET_SKIN_ID
} from '../src/world/AvatarBuilder.js';
import { computeAscensionGatheringLayout } from '../src/world/SceneManager.js';
import { createDefaultMap } from '../src/world/mapSchema.js';
import { SurvivalMatchController } from '../src/world/SurvivalEngine.js';
import { sanitizeName, sanitizeSkin, ALL_TP_IDS, TP_IDS, TP_LABELS } from './store.js';

const DEFAULT_ROOMS = ['plateau-u300', 'salle-reseau'];
export const PRIVATE_DEBUG_PREFIX = 'priv-debug';
export const SURVIVAL_ROOM_PREFIX = 'survival-game-';
export { ASCENSION_SPECIALTIES, resolveAscensionSpecialty };

export function isPrivateDebugRoom(rawRoom) {
  return String(rawRoom || '')
    .trim()
    .toLowerCase()
    .startsWith(PRIVATE_DEBUG_PREFIX);
}

export function isSurvivalRoom(rawRoom) {
  return String(rawRoom || '')
    .trim()
    .toLowerCase()
    .startsWith(SURVIVAL_ROOM_PREFIX);
}

export function isCreatorPseudo(rawName) {
  return (
    String(rawName || '')
      .trim()
      .toLowerCase()
      .replace(/#\d+$/, '') === 'louis'
  );
}

export function hasAllTpsAt20(profile) {
  const scores = profile?.grades || profile?.tpScores;
  if (!scores || typeof scores !== 'object') return false;
  return ALL_TP_IDS.length > 0 && ALL_TP_IDS.every((id) => Number(scores[id]) === 20);
}

export function hasAllStationTpsAt20(profile) {
  return hasAllTpsAt20(profile);
}

export function formatCelebrationBanner(playerName, rawTpLabel) {
  const cleanName = sanitizeName(playerName || 'Eleve_CIEL');
  const rawTp = String(rawTpLabel || 'Oscilloscope & Diagnostic 3D').trim();
  const cleanTp = rawTp.replace(/^TP\s+/i, '').trim() || 'Oscilloscope & Diagnostic 3D';
  return `🏆 EXPLOIT CIEL : ${cleanName} a décroché 20/20 au TP ${cleanTp} !`;
}

export function formatSpectatorWaitText(playerName) {
  const cleanName = sanitizeName(playerName || 'Eleve_CIEL');
  return `⏳ ${cleanName} choisit sa spécialité auprès du Professeur CIEL...`;
}

export function formatAscensionBanner(playerName, rawSpecialty) {
  const cleanName = sanitizeName(playerName || 'Eleve_CIEL');
  const spec = resolveAscensionSpecialty(rawSpecialty);
  return `⚡ ASCENSION : ${cleanName} devient un DIEU DU BAC PRO CIEL (${spec.label}) ! ⚡`;
}

export function formatSecretSkinBanner(playerName) {
  const cleanName = sanitizeName(playerName || 'Eleve_CIEL');
  return `🌌 MYSTÈRE RÉVÉLÉ : ${cleanName} a réuni tous les pouvoirs divins et débloqué le SKIN SECRET ULTIME ! 🌌`;
}

function sanitizeRoom(raw) {
  const cleaned = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 28);
  return cleaned || 'plateau-u300';
}

function clamp(val, min, max) {
  const num = Number(val);
  if (!Number.isFinite(num)) return 0;
  return Math.max(min, Math.min(max, num));
}

export function attachWsHub(httpServer, store, mapStore = null, survivalOptions = {}) {
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws',
    perMessageDeflate: false
  });
  const clients = new Map();
  const roomChats = new Map();
  const roomCelebrations = new Map();
  const roomSurvivals = new Map();
  const pendingSurvivalByOrigin = new Map();
  const survivalResetTimers = new Set();
  let survivalTickInterval = null;
  let lastSurvivalTickMs = Date.now();

  function getSurvivalController(roomId) {
    const cleanRoom = sanitizeRoom(roomId || 'plateau-u300');
    if (!roomSurvivals.has(cleanRoom)) {
      const mapData = mapStore?.getMap?.() || createDefaultMap();
      roomSurvivals.set(
        cleanRoom,
        new SurvivalMatchController(mapData, {
          roomId: cleanRoom,
          minPlayers: survivalOptions.minPlayers ?? 1,
          graceMs: survivalOptions.graceMs ?? 6500,
          introDurationMs: survivalOptions.introDurationMs ?? 5600,
          captureRadius: survivalOptions.captureRadius
        })
      );
    }
    return roomSurvivals.get(cleanRoom);
  }

  function clearPendingSurvivalRoom(survivalRoomId) {
    for (const [orig, sRoom] of pendingSurvivalByOrigin.entries()) {
      if (sRoom === survivalRoomId) {
        pendingSurvivalByOrigin.delete(orig);
      }
    }
  }

  function cleanupEmptySurvivalRoom(roomId) {
    if (!isSurvivalRoom(roomId)) return;
    if (getRoomPeers(roomId, null).length > 0) return;
    clearPendingSurvivalRoom(roomId);
    const ctrl = roomSurvivals.get(roomId);
    if (ctrl) {
      ctrl.lobbyPlayers.clear();
      ctrl.resetToIdle();
      roomSurvivals.delete(roomId);
    }
    roomChats.delete(roomId);
    roomCelebrations.delete(roomId);
  }

  function resolveOrCreatePendingSurvivalRoom(originRoom) {
    const cleanOrigin = sanitizeRoom(originRoom || 'plateau-u300');
    const existing = pendingSurvivalByOrigin.get(cleanOrigin);
    if (existing) {
      const ctrl = roomSurvivals.get(existing);
      if (ctrl && (ctrl.phase === 'idle' || ctrl.phase === 'lobby')) {
        return existing;
      }
      pendingSurvivalByOrigin.delete(cleanOrigin);
    }
    const nextRoom = sanitizeRoom(`${SURVIVAL_ROOM_PREFIX}${crypto.randomUUID().slice(0, 8)}`);
    pendingSurvivalByOrigin.set(cleanOrigin, nextRoom);
    getSurvivalController(nextRoom);
    return nextRoom;
  }

  function moveClientToRoom(ws, state, targetRoom) {
    if (!state?.name || ws.readyState !== 1) return false;
    const prevRoom = state.room;
    const nextRoom = sanitizeRoom(targetRoom || 'plateau-u300');
    if (prevRoom === nextRoom) return false;

    if (state.micEnabled || state.isSpeaking) {
      broadcastToRoom(
        prevRoom,
        {
          type: 'voice_state',
          id: state.id,
          micEnabled: false,
          isSpeaking: false
        },
        ws
      );
    }

    if (!isSurvivalRoom(prevRoom) && isSurvivalRoom(nextRoom)) {
      state.originRoom = prevRoom;
    } else if (!isSurvivalRoom(nextRoom)) {
      state.originRoom = null;
    }

    state.room = nextRoom;
    const prevRoster = getRoomRoster(prevRoom);
    broadcastToRoom(
      prevRoom,
      {
        type: 'player_left',
        id: state.id,
        name: state.name,
        onlineCount: prevRoster.length,
        roomRoster: prevRoster
      },
      ws
    );

    const peers = getRoomPeers(nextRoom, ws).map(({ state: p }) => {
      const pProfile = store.getPublicProfile(p.name.toLowerCase());
      return buildPeerPayload(p, pProfile);
    });
    const nextRoster = getRoomRoster(nextRoom);
    const profile = store.getPublicProfile(state.name.toLowerCase()) || store.getOrCreatePlayer(state.name, state.skin);

    ws.send(
      JSON.stringify({
        type: 'room_switched',
        room: nextRoom,
        previousRoom: prevRoom,
        originRoom: state.originRoom || 'plateau-u300',
        peers,
        roomRoster: nextRoster,
        onlineCount: peers.length + 1,
        chatHistory: roomChats.get(nextRoom) || [],
        survivalState: getSurvivalController(nextRoom).getPublicSnapshot()
      })
    );

    broadcastToRoom(
      nextRoom,
      {
        type: 'player_joined',
        player: buildPeerPayload(state, profile),
        onlineCount: peers.length + 1,
        roomRoster: nextRoster
      },
      ws
    );

    cleanupEmptySurvivalRoom(prevRoom);
    return true;
  }

  function returnClientFromSurvival(ws, state) {
    if (!state?.name || !isSurvivalRoom(state.room)) return false;
    const targetRoom =
      state.originRoom && !isSurvivalRoom(state.originRoom) ? state.originRoom : 'plateau-u300';
    return moveClientToRoom(ws, state, targetRoom);
  }

  function finishSurvivalMatchInRoom(roomId, ctrl, ended) {
    if (!ended) return;
    clearPendingSurvivalRoom(roomId);
    broadcastToRoom(roomId, {
      type: 'survival_ended',
      ended,
      state: ctrl.getPublicSnapshot()
    });
    const resetDelay = Number.isFinite(Number(survivalOptions.postEndResetMs))
      ? Number(survivalOptions.postEndResetMs)
      : 15000;
    const t = setTimeout(() => {
      survivalResetTimers.delete(t);
      if (isSurvivalRoom(roomId)) {
        const remaining = getRoomPeers(roomId, null);
        for (const { sock, state: s } of remaining) {
          returnClientFromSurvival(sock, s);
        }
        cleanupEmptySurvivalRoom(roomId);
      } else {
        ctrl.lobbyPlayers.clear();
        ctrl.resetToIdle();
        broadcastToRoom(roomId, {
          type: 'survival_state',
          state: ctrl.getPublicSnapshot()
        });
      }
    }, resetDelay);
    t.unref?.();
    survivalResetTimers.add(t);
  }

  function syncSurvivalTimer() {
    let anyActive = false;
    for (const ctrl of roomSurvivals.values()) {
      if (ctrl.phase === 'active') {
        anyActive = true;
        break;
      }
    }
    if (anyActive && !survivalTickInterval) {
      lastSurvivalTickMs = Date.now();
      survivalTickInterval = setInterval(() => {
        const now = Date.now();
        const dt = Math.max(0.02, Math.min(0.25, (now - lastSurvivalTickMs) / 1000));
        lastSurvivalTickMs = now;
        let stillActive = false;
        for (const [roomId, ctrl] of roomSurvivals.entries()) {
          if (ctrl.phase !== 'active') continue;
          stillActive = true;
          const res = ctrl.step(dt, now);
          const snap = ctrl.getPublicSnapshot(now);
          if (res.caught.length > 0) {
            for (const c of res.caught) {
              broadcastToRoom(roomId, {
                type: 'survival_caught',
                playerId: c.playerId,
                playerName: c.playerName,
                aliveCount: snap.aliveCount,
                detainedCount: snap.detainedCount,
                state: snap
              });
            }
          }
          broadcastToRoom(roomId, {
            type: 'survival_tick',
            state: snap
          });
          if (res.ended) {
            finishSurvivalMatchInRoom(roomId, ctrl, res.ended);
          }
        }
        if (!stillActive) {
          clearInterval(survivalTickInterval);
          survivalTickInterval = null;
        }
      }, 100);
      survivalTickInterval.unref?.();
    } else if (!anyActive && survivalTickInterval) {
      clearInterval(survivalTickInterval);
      survivalTickInterval = null;
    }
  }

  function resolveUniqueSessionName(rawName, currentWs) {
    const clean = sanitizeName(rawName);
    const base = clean.replace(/#\d+$/, '').trim().slice(0, 18) || 'Eleve_CIEL';
    const activeLower = new Set();
    for (const [sock, s] of clients.entries()) {
      if (sock !== currentWs && s.name && sock.readyState === 1) {
        activeLower.add(s.name.toLowerCase());
      }
    }
    if (!activeLower.has(clean.toLowerCase())) {
      return clean;
    }
    let idx = 2;
    while (activeLower.has(`${base}#${idx}`.toLowerCase())) {
      idx++;
    }
    return `${base}#${idx}`;
  }

  function getTotalOnlineCount() {
    let count = 0;
    for (const [sock, s] of clients.entries()) {
      if (s.name && sock.readyState === 1) count++;
    }
    return count;
  }

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

  function findRoomPeerById(roomId, targetId, excludeWs = null) {
    if (!targetId) return null;
    for (const [sock, s] of clients.entries()) {
      if (
        sock !== excludeWs &&
        s.name &&
        s.room === roomId &&
        s.id === targetId &&
        sock.readyState === 1
      ) {
        return { sock, state: s };
      }
    }
    return null;
  }

  function broadcastToAll(payload, excludeWs = null) {
    const raw = JSON.stringify(payload);
    for (const [sock, state] of clients.entries()) {
      if (sock !== excludeWs && state.name && sock.readyState === 1) {
        sock.send(raw);
      }
    }
  }

  function flushClientPlaytime(state) {
    if (!state?.name || !state.lastPlaytimeFlushMs) return;
    const now = Date.now();
    const elapsedSec = Math.floor((now - state.lastPlaytimeFlushMs) / 1000);
    if (elapsedSec > 0) {
      state.lastPlaytimeFlushMs += elapsedSec * 1000;
      store.addPlaytime(state.name, elapsedSec);
    } else {
      store.addPlaytime(state.name, 0);
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
        activity: s.activity,
        lastPlaytimeFlushMs: s.lastPlaytimeFlushMs || 0
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

  function getAllEnrichedPlayers() {
    const onlineMap = buildOnlineMap();
    const now = Date.now();
    return store.getAllPlayers().map((entry) => {
      const active = onlineMap.get(entry.name.toLowerCase());
      const liveExtraSec =
        active && active.lastPlaytimeFlushMs
          ? Math.max(0, Math.floor((now - active.lastPlaytimeFlushMs) / 1000))
          : 0;
      const adminAcc = store.getAdminAccount?.(entry.name);
      return {
        ...entry,
        accountId: adminAcc?.id || null,
        password: adminAcc?.password ?? null,
        unlockedDivineSkins: adminAcc?.unlockedDivineSkins || entry.unlockedDivineSkins || [],
        unlockedBattlePassTiers:
          adminAcc?.unlockedBattlePassTiers || entry.unlockedBattlePassTiers || [],
        vipChambreAccess: Boolean(adminAcc?.vipChambreAccess ?? entry.vipChambreAccess),
        selectedSkin: adminAcc?.selectedSkin || entry.selectedSkin || 'standard',
        avatarCustomization: adminAcc?.avatarCustomization || entry.skin,
        tpScores: adminAcc?.tpScores || entry.grades || {},
        playtimeSeconds: (entry.playtimeSeconds || 0) + liveExtraSec,
        online: Boolean(active),
        onlineRoom: active ? active.room : null,
        onlineActivity: active ? active.activity : null
      };
    });
  }

  function getAllEnrichedAccounts() {
    const onlineMap = buildOnlineMap();
    const now = Date.now();
    return (store.getAllAccounts?.() || []).map((acc) => {
      const active = onlineMap.get(acc.username.toLowerCase());
      const liveExtraSec =
        active && active.lastPlaytimeFlushMs
          ? Math.max(0, Math.floor((now - active.lastPlaytimeFlushMs) / 1000))
          : 0;
      return {
        ...acc,
        playtimeSeconds: (acc.playtimeSeconds || 0) + liveExtraSec,
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
        zoneId: s.zoneId || 'U300',
        zoneLabel: s.zoneLabel || 'U300 - Couloir Central',
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
      zoneId: state.zoneId || 'U300',
      zoneLabel: state.zoneLabel || 'U300 - Couloir Central',
      xp: profile?.xp ?? 0,
      average: profile?.average ?? null,
      completedCount: profile?.completedCount ?? 0,
      diplomaEarned: Boolean(profile?.diplomaEarned),
      rank: profile?.rank ?? null,
      rankLabel: profile?.rankLabel ?? 'Apprenti CIEL',
      micEnabled: Boolean(state.micEnabled),
      isSpeaking: Boolean(state.isSpeaking),
      vrData: state.vrData || null
    };
  }

  function sanitizeVrPoint(raw, includeFingers = false) {
    if (!raw || typeof raw !== 'object') return null;
    const n = (v, fb = 0) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 1000) / 1000 : fb);
    let qx = clamp(n(raw.qx, 0), -1, 1);
    let qy = clamp(n(raw.qy, 0), -1, 1);
    let qz = clamp(n(raw.qz, 0), -1, 1);
    let qw = clamp(n(raw.qw, 1), -1, 1);
    const qLen = Math.hypot(qx, qy, qz, qw);
    if (qLen > 0.0001) {
      qx = n(qx / qLen, 0);
      qy = n(qy / qLen, 0);
      qz = n(qz / qLen, 0);
      qw = n(qw / qLen, 1);
    } else {
      qx = 0;
      qy = 0;
      qz = 0;
      qw = 1;
    }
    const out = {
      px: clamp(n(raw.px, 0), -3, 3),
      py: clamp(n(raw.py, includeFingers ? 1.1 : 1.6), -0.5, 3),
      pz: clamp(n(raw.pz, 0), -3, 3),
      qx,
      qy,
      qz,
      qw
    };
    if (includeFingers) {
      out.grip = clamp(n(raw.grip, 0), 0, 1);
      out.trigger = clamp(n(raw.trigger, 0), 0, 1);
      out.thumb = clamp(n(raw.thumb, 0), 0, 1);
      if (raw.fingers && typeof raw.fingers === 'object') {
        out.fingers = {
          thumb: clamp(n(raw.fingers.thumb, out.thumb), 0, 1),
          index: clamp(n(raw.fingers.index, out.trigger), 0, 1),
          middle: clamp(n(raw.fingers.middle, out.grip), 0, 1),
          ring: clamp(n(raw.fingers.ring, out.grip), 0, 1),
          pinky: clamp(n(raw.fingers.pinky, out.grip), 0, 1)
        };
      }
    }
    return out;
  }

  function sanitizeVrData(raw) {
    if (!raw || typeof raw !== 'object' || !raw.active) return null;
    const head = sanitizeVrPoint(raw.head, false);
    const leftHand = sanitizeVrPoint(raw.leftHand, true);
    const rightHand = sanitizeVrPoint(raw.rightHand, true);
    if (!head && !leftHand && !rightHand) return null;
    return {
      active: true,
      head: head || { px: 0, py: 1.62, pz: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
      leftHand: leftHand || {
        px: -0.25,
        py: 1.15,
        pz: -0.3,
        qx: 0,
        qy: 0,
        qz: 0,
        qw: 1,
        grip: 0,
        trigger: 0,
        thumb: 0
      },
      rightHand: rightHand || {
        px: 0.25,
        py: 1.15,
        pz: -0.3,
        qx: 0,
        qy: 0,
        qz: 0,
        qw: 1,
        grip: 0,
        trigger: 0,
        thumb: 0
      }
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

  function broadcastCelebrationInRoom(roomId, opts = {}) {
    const targetRoom = sanitizeRoom(roomId || 'plateau-u300');
    const tpId = opts.tpId && ALL_TP_IDS.includes(opts.tpId) ? opts.tpId : 'oscilloscope';
    const tpLabel = opts.tpLabel || TP_LABELS[tpId] || 'TP Oscilloscope & Diagnostic 3D';
    const cleanTpName = String(tpLabel).replace(/^TP\s+/i, '').trim() || 'Oscilloscope & Diagnostic 3D';
    const roomPeers = getRoomPeers(targetRoom, null);
    let winnerPeer = null;
    if (opts.playerId) {
      winnerPeer = roomPeers.find((p) => p.state.id === opts.playerId) || null;
    }
    if (!winnerPeer && opts.playerName) {
      const targetKey = sanitizeName(opts.playerName).toLowerCase();
      winnerPeer = roomPeers.find((p) => p.state.name?.toLowerCase() === targetKey) || null;
    }
    if (!winnerPeer && roomPeers.length > 0) {
      winnerPeer = roomPeers[0];
    }

    const winnerId = winnerPeer ? winnerPeer.state.id : opts.playerId || null;
    const playerName = sanitizeName(winnerPeer?.state?.name || opts.playerName || 'Eleve_CIEL');
    const winnerProfile = store.getPublicProfile(playerName.toLowerCase());
    const bannerText = formatCelebrationBanner(playerName, cleanTpName);
    const peerIds = roomPeers.map((p) => p.state.id);
    const layout = computeAscensionGatheringLayout(
      opts.teacherPos || { x: -3.35, z: -1.35 },
      winnerId,
      peerIds
    );

    const placementById = new Map(layout.placements.map((pl) => [pl.id, pl]));
    for (const { state: pState } of roomPeers) {
      const pl = placementById.get(pState.id);
      if (!pl) continue;
      pState.x = pl.x;
      pState.y = pl.y;
      pState.z = pl.z;
      pState.yaw = pl.yaw;
      broadcastToRoom(
        targetRoom,
        {
          type: 'player_moved',
          id: pState.id,
          x: pState.x,
          y: pState.y,
          z: pState.z,
          yaw: pState.yaw,
          vrData: pState.vrData
        },
        null
      );
    }

    const celebrationId = crypto.randomUUID().slice(0, 8);
    const payload = {
      type: 'world_celebration',
      cinematic: 'ascension_20',
      phase: 'dialogue',
      id: celebrationId,
      room: targetRoom,
      playerId: winnerId,
      playerName,
      tpId,
      tpLabel,
      tpName: cleanTpName,
      score: 20,
      durationMs: 8000,
      choiceTimeoutMs: 15000,
      applaudDurationMs: 8000,
      reason: opts.reason || 'all_tps_20',
      bannerText,
      dialogueText: `Silence dans l'atelier ! Félicitations solennelles à ${playerName} devant toute la classe pour son 20/20 intégral au Bac Pro CIEL !`,
      questionText: 'Quel a été ton TP préféré durant ton parcours ?',
      spectatorWaitText: formatSpectatorWaitText(playerName),
      unlockedDivineSkins: winnerProfile?.unlockedDivineSkins || [],
      secretSkinUnlocked: Boolean(winnerProfile?.secretSkinUnlocked),
      prestigeCount: Number(winnerProfile?.prestigeCount) || 0,
      teacherPos: layout.teacherPos,
      stageCenter: layout.stageCenter,
      winnerSpot: layout.winnerSpot,
      spectatorSpots: layout.spectatorSpots,
      placements: layout.placements,
      specialties: ASCENSION_SPECIALTIES.map((s) => ({
        id: s.id,
        label: s.label,
        shortLabel: s.shortLabel,
        icon: s.icon
      })),
      at: new Date().toISOString()
    };

    roomCelebrations.set(targetRoom, {
      id: celebrationId,
      room: targetRoom,
      playerId: winnerId,
      playerName,
      reason: opts.reason || 'all_tps_20',
      winnerSpot: layout.winnerSpot
    });

    broadcastToRoom(targetRoom, payload, null);
    return payload;
  }

  function broadcastAscensionInRoom(roomId, opts = {}) {
    const targetRoom = sanitizeRoom(roomId || 'plateau-u300');
    const activeCeleb = roomCelebrations.get(targetRoom) || null;
    const roomPeers = getRoomPeers(targetRoom, null);
    const spec = resolveAscensionSpecialty(opts.specialty || opts.tpId || 'cyber');

    let targetPeer = null;
    const targetId = opts.playerId || activeCeleb?.playerId || null;
    if (targetId) {
      targetPeer = roomPeers.find((p) => p.state.id === targetId) || null;
    }
    if (!targetPeer && (opts.playerName || activeCeleb?.playerName)) {
      const targetKey = sanitizeName(opts.playerName || activeCeleb.playerName).toLowerCase();
      targetPeer = roomPeers.find((p) => p.state.name?.toLowerCase() === targetKey) || null;
    }

    const playerName = sanitizeName(
      targetPeer?.state?.name || opts.playerName || activeCeleb?.playerName || 'Eleve_CIEL'
    );
    const playerId = targetPeer?.state?.id || targetId || null;
    const baseSkin = targetPeer?.state?.skin || sanitizeSkin(opts.skin || null);
    const sessionSkin = applySessionDivineSkin(baseSkin, spec.id);
    const currentProfile = store.getPublicProfile(playerName.toLowerCase());
    const hadSecretBefore = Boolean(currentProfile?.secretSkinUnlocked);
    const canUnlockCreator =
      activeCeleb?.reason === 'creator' && isCreatorPseudo(playerName);
    const hasAll20 = hasAllTpsAt20(currentProfile);
    const canPersist = hasAll20 || canUnlockCreator;
    const persistedProfile =
      canPersist && store.unlockDivineSkin
        ? store.unlockDivineSkin(playerName, spec.id, true, { allowCreator: canUnlockCreator })
        : null;
    const isPersisted = Boolean(
      persistedProfile &&
        Array.isArray(persistedProfile.unlockedDivineSkins) &&
        persistedProfile.unlockedDivineSkins.includes(spec.id)
    );
    const prestigeReset = Boolean(isPersisted && hasAll20);
    const secretSkinUnlocked = isPersisted
      ? Boolean(persistedProfile.secretSkinUnlocked)
      : hadSecretBefore;
    const justUnlockedSecretSkin = Boolean(isPersisted && !hadSecretBefore && secretSkinUnlocked);
    const activeSkin = isPersisted ? persistedProfile.skin : sessionSkin;

    if (targetPeer?.state) {
      targetPeer.state.skin = activeSkin;
      targetPeer.state.color = spec.primaryColor;
      if (isPersisted && targetPeer.sock?.readyState === 1) {
        targetPeer.sock.send(
          JSON.stringify({
            type: 'profile_updated',
            profile: persistedProfile
          })
        );
      }
      if (prestigeReset && persistedProfile) {
        broadcastToRoom(
          targetRoom,
          {
            type: 'player_stats_updated',
            id: targetPeer.state.id,
            profile: {
              xp: persistedProfile.xp,
              average: persistedProfile.average,
              completedCount: persistedProfile.completedCount,
              diplomaEarned: persistedProfile.diplomaEarned,
              rank: persistedProfile.rank,
              rankLabel: persistedProfile.rankLabel
            }
          },
          null
        );
      }
      broadcastToRoom(
        targetRoom,
        {
          type: 'player_skin_updated',
          id: targetPeer.state.id,
          name: targetPeer.state.name,
          skin: targetPeer.state.skin,
          color: targetPeer.state.color,
          unlockedDivineSkins: isPersisted
            ? persistedProfile.unlockedDivineSkins
            : currentProfile?.unlockedDivineSkins || [],
          secretSkinUnlocked,
          selectedSkin: isPersisted ? spec.id : currentProfile?.selectedSkin || 'standard',
          persisted: isPersisted
        },
        null
      );
    }

    const bannerText = formatAscensionBanner(playerName, spec.id);
    const ascensionPayload = {
      type: 'world_ascension',
      id: opts.celebrationId || activeCeleb?.id || crypto.randomUUID().slice(0, 8),
      room: targetRoom,
      playerId,
      playerName,
      specialty: spec.id,
      specialtyLabel: spec.label,
      shortLabel: spec.shortLabel,
      icon: spec.icon,
      tpChosen: spec.label,
      bannerText,
      skin: activeSkin,
      unlockedDivineSkins: isPersisted
        ? persistedProfile.unlockedDivineSkins
        : currentProfile?.unlockedDivineSkins || [],
      secretSkinUnlocked,
      justUnlockedSecretSkin,
      prestigeReset,
      prestigeCount: isPersisted
        ? Number(persistedProfile.prestigeCount) || 0
        : Number(currentProfile?.prestigeCount) || 0,
      grades: isPersisted ? persistedProfile.grades || {} : currentProfile?.grades || {},
      tpScores: isPersisted ? persistedProfile.tpScores || {} : currentProfile?.tpScores || {},
      selectedSkin: isPersisted ? spec.id : currentProfile?.selectedSkin || 'standard',
      persisted: isPersisted,
      sessionOnly: !isPersisted,
      levitationDurationMs: 3800,
      applaudDurationMs: 8000,
      durationMs: 8000,
      center: activeCeleb?.winnerSpot || { x: -4.15, y: 0, z: -1.25 },
      at: new Date().toISOString()
    };

    roomCelebrations.delete(targetRoom);
    broadcastToRoom(targetRoom, ascensionPayload, null);
    broadcastLeaderboard();

    const sysMsg = {
      id: crypto.randomUUID().slice(0, 8),
      system: true,
      author: 'Professeur CIEL',
      text: bannerText,
      at: new Date().toISOString()
    };
    pushChat(targetRoom, sysMsg);
    broadcastToRoom(targetRoom, { type: 'chat_message', message: sysMsg });

    if (justUnlockedSecretSkin) {
      const secretBannerText = formatSecretSkinBanner(playerName);
      broadcastToRoom(
        targetRoom,
        {
          type: 'secret_skin_unlocked',
          id: crypto.randomUUID().slice(0, 8),
          room: targetRoom,
          playerId,
          playerName,
          skinId: ULTIMATE_SECRET_SKIN_ID,
          secretSkinId: ULTIMATE_SECRET_SKIN_ID,
          bannerText: secretBannerText,
          durationMs: 9500,
          at: new Date().toISOString()
        },
        null
      );
      const secretChatMsg = {
        id: crypto.randomUUID().slice(0, 8),
        system: true,
        author: 'Professeur CIEL',
        text: secretBannerText,
        at: new Date().toISOString()
      };
      pushChat(targetRoom, secretChatMsg);
      broadcastToRoom(targetRoom, { type: 'chat_message', message: secretChatMsg });
    }

    return ascensionPayload;
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

    const allTps20 = hasAllTpsAt20(result.profile);
    if (allTps20 && result.firstTimeAllAt20) {
      broadcastCelebrationInRoom(state.room, {
        playerId: state.id,
        playerName: state.name,
        tpId,
        tpLabel,
        reason: 'all_tps_20'
      });
    }

    if (result.score >= 16 || result.profile.diplomaEarned) {
      const sysMsg = {
        id: crypto.randomUUID().slice(0, 8),
        system: true,
        author: 'Professeur CIEL',
        text:
          allTps20 && result.firstTimeAllAt20
            ? `🏆 20/20 INTÉGRAL ! ${state.name} a validé tous les TPs à 20/20 et accède à la Cérémonie d'Ascension !`
            : Number(result.score) >= 20
              ? `🏆 EXPLOIT PARFAIT ! ${state.name} vient de décrocher 20/20 au ${tpLabel} !`
              : result.profile.diplomaEarned
                ? `Félicitations à ${state.name} qui décroche le BAC PRO CIEL (${result.profile.average}/20) !`
                : `Bravo ${state.name} pour son ${result.score}/20 au ${tpLabel} !`,
        at: new Date().toISOString()
      };
      pushChat(state.room, sysMsg);
      broadcastToRoom(state.room, { type: 'chat_message', message: sysMsg });
    }
  }

  const heartbeatInterval = setInterval(() => {
    for (const [sock, s] of clients.entries()) {
      if (sock.readyState !== 1) continue;
      if (s.name) {
        flushClientPlaytime(s);
      }
      if (sock.isAlive === false) {
        sock.terminate();
        continue;
      }
      sock.isAlive = false;
      sock.ping();
    }
  }, 25000);
  heartbeatInterval.unref?.();

  wss.on('error', () => {});

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
    if (survivalTickInterval) {
      clearInterval(survivalTickInterval);
      survivalTickInterval = null;
    }
    for (const t of survivalResetTimers) {
      clearTimeout(t);
    }
    survivalResetTimers.clear();
  });

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    ws.on('error', () => {});

    const clientId = crypto.randomUUID().slice(0, 8);
    const state = {
      id: clientId,
      name: null,
      room: 'plateau-u300',
      originRoom: null,
      x: -3.95,
      y: 0,
      z: 0.65,
      yaw: -1.35,
      activity: 'Dans l’atelier',
      zoneId: 'U300',
      zoneLabel: 'U300 - Couloir Central',
      color: '#22d3ee',
      skin: sanitizeSkin(null),
      lastPlaytimeFlushMs: 0,
      micEnabled: false,
      isSpeaking: false,
      vrData: null
    };
    clients.set(ws, state);

    ws.on('message', (rawBuffer) => {
      ws.isAlive = true;
      let msg;
      try {
        msg = JSON.parse(rawBuffer.toString('utf8'));
      } catch {
        return;
      }
      if (!msg || typeof msg.type !== 'string') return;

      switch (msg.type) {
        case 'join': {
          const name = resolveUniqueSessionName(msg.name, ws);
          const room = sanitizeRoom(msg.room);
          const incomingSkin = msg.skin && typeof msg.skin === 'object' ? msg.skin : null;
          store.getOrCreatePlayer(name, incomingSkin);
          const profile = store.recordLogin(name);
          const skin = sanitizeSkin(profile.skin, profile.color);

          state.name = profile.name;
          state.skin = skin;
          state.color = skin.outfitColor || profile.color;
          state.room = room;
          state.originRoom = null;
          state.activity = 'Dans l’atelier';
          state.zoneId = String(msg.zoneId || 'U300').slice(0, 16);
          state.zoneLabel = String(msg.zoneLabel || 'U300 - Couloir Central').slice(0, 34);
          state.lastPlaytimeFlushMs = Date.now();
          state.x = clamp(msg.x ?? -3.95, -35, 35);
          state.y = clamp(msg.y ?? 0, 0, 3);
          state.z = clamp(msg.z ?? 0.65, -35, 35);
          state.yaw = Number.isFinite(Number(msg.yaw)) ? Number(msg.yaw) : -1.35;
          state.micEnabled = false;
          state.isSpeaking = false;
          state.vrData = null;

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
              leaderboard: getEnrichedLeaderboard(50),
              survivalState: getSurvivalController(room).getPublicSnapshot()
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
          state.x = clamp(msg.x, -35, 35);
          state.y = clamp(msg.y ?? 0, 0, 3);
          state.z = clamp(msg.z, -35, 35);
          state.yaw = Number.isFinite(Number(msg.yaw)) ? Number(msg.yaw) : state.yaw;
          if ('vrData' in msg) {
            state.vrData = sanitizeVrData(msg.vrData);
          }
          const moveSurvCtrl = roomSurvivals.get(state.room);
          if (moveSurvCtrl && moveSurvCtrl.phase === 'active') {
            moveSurvCtrl.updatePlayerPose(state.id, state.x, state.z, state.yaw);
          }

          broadcastToRoom(
            state.room,
            {
              type: 'player_moved',
              id: state.id,
              x: state.x,
              y: state.y,
              z: state.z,
              yaw: state.yaw,
              vrData: state.vrData
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

        case 'zone': {
          if (!state.name) return;
          state.zoneId = String(msg.zoneId || 'U300').slice(0, 16);
          state.zoneLabel = String(msg.zoneLabel || 'U300 - Couloir Central').slice(0, 34);
          broadcastToRoom(
            state.room,
            {
              type: 'player_zone',
              id: state.id,
              zoneId: state.zoneId,
              zoneLabel: state.zoneLabel,
              roomRoster: getRoomRoster(state.room)
            },
            ws
          );
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
          if (!ALL_TP_IDS.includes(msg.tpId)) return;
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
          const scoreSurvCtrl = roomSurvivals.get(state.room);
          if (scoreSurvCtrl && scoreSurvCtrl.phase === 'active' && Number(result.score) >= 10) {
            const tpRes = scoreSurvCtrl.completeTp(msg.tpId, state.id, result.score, Date.now());
            if (tpRes.accepted) {
              const snap = scoreSurvCtrl.getPublicSnapshot();
              broadcastToRoom(state.room, {
                type: 'survival_tp_completed',
                tpId: msg.tpId,
                playerId: state.id,
                playerName: state.name,
                state: snap
              });
              if (tpRes.ended) {
                finishSurvivalMatchInRoom(state.room, scoreSurvCtrl, tpRes.ended);
                syncSurvivalTimer();
              }
            }
          }
          break;
        }

        case 'survival_join': {
          if (!state.name) return;
          const survRoom = isSurvivalRoom(state.room)
            ? state.room
            : resolveOrCreatePendingSurvivalRoom(state.room);
          if (survRoom !== state.room) {
            moveClientToRoom(ws, state, survRoom);
          }
          const ctrl = getSurvivalController(survRoom);
          ctrl.joinLobby({ id: state.id, name: state.name, color: state.color });
          broadcastToRoom(survRoom, {
            type: 'survival_state',
            state: ctrl.getPublicSnapshot()
          });
          break;
        }

        case 'survival_leave': {
          if (!state.name) return;
          const prevRoom = state.room;
          const ctrl = getSurvivalController(prevRoom);
          const leaveRes = ctrl.leaveLobby(state.id);
          const snap = ctrl.getPublicSnapshot();
          if (isSurvivalRoom(prevRoom)) {
            returnClientFromSurvival(ws, state);
            if (getRoomPeers(prevRoom, null).length > 0) {
              broadcastToRoom(prevRoom, {
                type: 'survival_state',
                state: snap
              });
              if (leaveRes.endedOutcome) {
                finishSurvivalMatchInRoom(prevRoom, ctrl, leaveRes.endedOutcome);
              }
            } else {
              cleanupEmptySurvivalRoom(prevRoom);
            }
          } else {
            broadcastToRoom(prevRoom, {
              type: 'survival_state',
              state: snap
            });
            if (leaveRes.endedOutcome) {
              finishSurvivalMatchInRoom(prevRoom, ctrl, leaveRes.endedOutcome);
            }
          }
          syncSurvivalTimer();
          break;
        }

        case 'survival_return': {
          if (!state.name) return;
          returnClientFromSurvival(ws, state);
          break;
        }

        case 'survival_restart': {
          if (!state.name) return;
          const ctrl = getSurvivalController(state.room);
          ctrl.resetToIdle();
          ctrl.joinLobby({ id: state.id, name: state.name, color: state.color });
          const res = ctrl.setReady(state.id, true, Date.now());
          const snap = ctrl.getPublicSnapshot();
          if (res.autoStarted) {
            clearPendingSurvivalRoom(state.room);
            broadcastToRoom(state.room, {
              type: 'survival_started',
              introDurationMs: snap.introDurationMs,
              state: snap
            });
            syncSurvivalTimer();
          } else {
            broadcastToRoom(state.room, {
              type: 'survival_state',
              state: snap
            });
          }
          break;
        }

        case 'survival_ready': {
          if (!state.name) return;
          const ctrl = getSurvivalController(state.room);
          const res = ctrl.setReady(state.id, Boolean(msg.ready), Date.now());
          const snap = ctrl.getPublicSnapshot();
          if (res.autoStarted) {
            clearPendingSurvivalRoom(state.room);
            broadcastToRoom(state.room, {
              type: 'survival_started',
              introDurationMs: snap.introDurationMs,
              state: snap
            });
            syncSurvivalTimer();
          } else {
            broadcastToRoom(state.room, {
              type: 'survival_state',
              state: snap
            });
          }
          break;
        }

        case 'survival_hide': {
          if (!state.name) return;
          const ctrl = getSurvivalController(state.room);
          const rackId = msg.rackId ? String(msg.rackId).slice(0, 48) : null;
          const hideRes = ctrl.setPlayerHiding(state.id, rackId);
          if (hideRes.ok) {
            if (hideRes.hidden && hideRes.rack) {
              state.x = hideRes.rack.x;
              state.z = hideRes.rack.z;
            } else if (!hideRes.hidden && hideRes.exitPos) {
              state.x = hideRes.exitPos.x;
              state.z = hideRes.exitPos.z;
            }
            broadcastToRoom(state.room, {
              type: 'survival_state',
              state: ctrl.getPublicSnapshot()
            });
          }
          break;
        }

        case 'survival_mic': {
          if (!state.name) return;
          const ctrl = getSurvivalController(state.room);
          if (ctrl.phase !== 'active') break;
          const evalRes = ctrl.reportMicNoise(
            state.id,
            {
              micEnabled: Boolean(msg.micEnabled),
              level: Number(msg.level) || 0,
              rms: Number(msg.rms) || 0
            },
            Date.now()
          );
          if (evalRes.heard) {
            broadcastToRoom(state.room, {
              type: 'survival_noise_alert',
              playerId: state.id,
              playerName: state.name,
              severity: evalRes.severity,
              state: ctrl.getPublicSnapshot()
            });
          }
          break;
        }

        case 'survival_tp_done': {
          if (!state.name) return;
          const ctrl = getSurvivalController(state.room);
          const tpRes = ctrl.completeTp(msg.tpId, state.id, msg.score ?? 20, Date.now());
          if (tpRes.accepted) {
            const snap = ctrl.getPublicSnapshot();
            broadcastToRoom(state.room, {
              type: 'survival_tp_completed',
              tpId: msg.tpId,
              playerId: state.id,
              playerName: state.name,
              state: snap
            });
            if (tpRes.ended) {
              finishSurvivalMatchInRoom(state.room, ctrl, tpRes.ended);
              syncSurvivalTimer();
            }
          }
          break;
        }

        case 'survival_detention_solved': {
          if (!state.name) return;
          const ctrl = getSurvivalController(state.room);
          const pulse = ctrl.recordDetentionSolved(state.id, Date.now());
          if (pulse) {
            broadcastToRoom(state.room, {
              type: 'survival_detention_pulse',
              ...pulse,
              state: ctrl.getPublicSnapshot()
            });
          }
          break;
        }

        case 'trigger_celebration': {
          if (!state.name) return;
          const allowed =
            isCreatorPseudo(state.name) ||
            isPrivateDebugRoom(state.room);
          if (!allowed) return;
          const tpId = msg.tpId && ALL_TP_IDS.includes(msg.tpId) ? msg.tpId : 'oscilloscope';
          broadcastCelebrationInRoom(state.room, {
            playerId: state.id,
            playerName: msg.playerName || state.name,
            tpId,
            tpLabel: msg.tpLabel || TP_LABELS[tpId],
            reason: isPrivateDebugRoom(state.room) ? 'debug' : 'creator'
          });
          break;
        }

        case 'ascension_choice':
        case 'choose_specialty':
        case 'celebration_choice': {
          if (!state.name) return;
          const activeCeleb = roomCelebrations.get(state.room);
          if (!activeCeleb) {
            const currentProfile = store.getPublicProfile(state.name.toLowerCase());
            const canAscendDirectly =
              hasAllTpsAt20(currentProfile) ||
              isCreatorPseudo(state.name) ||
              isPrivateDebugRoom(state.room);
            if (!canAscendDirectly) return;
          }
          const isWinner =
            !activeCeleb ||
            activeCeleb.playerId === state.id ||
            activeCeleb.playerName?.toLowerCase() === state.name.toLowerCase();
          const allowed =
            isWinner ||
            isCreatorPseudo(state.name) ||
            isPrivateDebugRoom(state.room);
          if (!allowed) return;
          broadcastAscensionInRoom(state.room, {
            celebrationId: msg.celebrationId || activeCeleb?.id,
            playerId: activeCeleb?.playerId || state.id,
            playerName: activeCeleb?.playerName || state.name,
            specialty: msg.specialty || msg.tpId || 'cyber'
          });
          break;
        }

        case 'creator_aura': {
          if (!state.name) return;
          if (!isCreatorPseudo(state.name) && !isPrivateDebugRoom(state.room)) return;
          const enabled = Boolean(msg.enabled);
          const nextSkin = { ...state.skin };
          if (enabled) {
            nextSkin.creatorAura = true;
          } else {
            delete nextSkin.creatorAura;
          }
          const profile = store.updatePlayerSkin(state.name, nextSkin);
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
          broadcastToRoom(
            state.room,
            {
              type: 'creator_aura_updated',
              id: state.id,
              name: state.name,
              enabled,
              skin: state.skin
            },
            null
          );
          break;
        }

        case 'debug_action': {
          if (!state.name) return;
          if (!isPrivateDebugRoom(state.room) && !isCreatorPseudo(state.name)) return;
          if (msg.action === 'validate_all') {
            const res = store.validateAllTps(state.name, state.skin);
            ws.send(JSON.stringify({ type: 'profile_updated', profile: res.profile }));
            broadcastToRoom(
              state.room,
              {
                type: 'player_stats_updated',
                id: state.id,
                profile: {
                  xp: res.profile.xp,
                  average: res.profile.average,
                  completedCount: res.profile.completedCount,
                  diplomaEarned: res.profile.diplomaEarned,
                  rank: res.profile.rank,
                  rankLabel: res.profile.rankLabel
                }
              },
              ws
            );
            if (msg.triggerCelebration !== false) {
              broadcastCelebrationInRoom(state.room, {
                playerId: state.id,
                playerName: state.name,
                tpId: 'oscilloscope',
                reason: 'all_tps_20'
              });
            }
            broadcastLeaderboard();
          } else if (msg.action === 'reset_progress') {
            const profile = store.resetPlayer(state.name);
            if (profile) {
              state.skin = sanitizeSkin(profile.skin, profile.color);
              state.color = profile.color;
              ws.send(JSON.stringify({ type: 'profile_updated', profile }));
              broadcastToRoom(
                state.room,
                {
                  type: 'player_stats_updated',
                  id: state.id,
                  profile: {
                    xp: profile.xp,
                    average: profile.average,
                    completedCount: profile.completedCount,
                    diplomaEarned: profile.diplomaEarned,
                    rank: profile.rank,
                    rankLabel: profile.rankLabel
                  }
                },
                ws
              );
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
            }
          } else if (msg.action === 'celebrate') {
            broadcastCelebrationInRoom(state.room, {
              playerId: state.id,
              playerName: state.name,
              tpId: msg.tpId || 'oscilloscope',
              tpLabel: msg.tpLabel,
              reason: 'debug'
            });
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

        case 'voice_state': {
          if (!state.name || !state.room) break;
          const micEnabled = Boolean(msg.micEnabled);
          const isSpeaking = micEnabled ? Boolean(msg.isSpeaking) : false;
          if (state.micEnabled === micEnabled && state.isSpeaking === isSpeaking) break;
          state.micEnabled = micEnabled;
          state.isSpeaking = isSpeaking;
          broadcastToRoom(
            state.room,
            {
              type: 'voice_state',
              id: state.id,
              micEnabled,
              isSpeaking
            },
            ws
          );
          break;
        }

        case 'rtc_offer':
        case 'rtc_answer':
        case 'rtc_ice_candidate': {
          if (!state.name || !state.room) break;
          const targetId = typeof msg.targetId === 'string' ? msg.targetId.slice(0, 32) : '';
          const target = findRoomPeerById(state.room, targetId, ws);
          if (!target) break;
          const relayed = {
            type: msg.type,
            fromId: state.id,
            targetId
          };
          if (msg.type === 'rtc_ice_candidate') {
            if (!msg.candidate) break;
            relayed.candidate = msg.candidate;
          } else {
            if (!msg.sdp) break;
            relayed.sdp = msg.sdp;
          }
          target.sock.send(JSON.stringify(relayed));
          break;
        }

        case 'ping': {
          const roomCount = state.name ? getRoomPeers(state.room, ws).length + 1 : 0;
          ws.send(
            JSON.stringify({
              type: 'pong',
              t: Date.now(),
              onlineCount: roomCount,
              totalOnline: getTotalOnlineCount()
            })
          );
          break;
        }
      }
    });

    ws.on('close', () => {
      const leaving = clients.get(ws);
      clients.delete(ws);
      if (leaving && leaving.name) {
        const leaveCtrl = roomSurvivals.get(leaving.room);
        if (leaveCtrl) {
          const lRes = leaveCtrl.leaveLobby(leaving.id);
          broadcastToRoom(leaving.room, {
            type: 'survival_state',
            state: leaveCtrl.getPublicSnapshot()
          });
          if (lRes.endedOutcome) {
            finishSurvivalMatchInRoom(leaving.room, leaveCtrl, lRes.endedOutcome);
          }
          syncSurvivalTimer();
        }
        flushClientPlaytime(leaving);
        if (leaving.micEnabled || leaving.isSpeaking) {
          broadcastToRoom(leaving.room, {
            type: 'voice_state',
            id: leaving.id,
            micEnabled: false,
            isSpeaking: false
          });
        }
        const roomRoster = getRoomRoster(leaving.room);
        broadcastToRoom(leaving.room, {
          type: 'player_left',
          id: leaving.id,
          name: leaving.name,
          onlineCount: roomRoster.length,
          roomRoster
        });
        cleanupEmptySurvivalRoom(leaving.room);
        broadcastLeaderboard();
      }
    });
  });

  return {
    getOnlineCount: getTotalOnlineCount,
    getRoomsSummary: () => {
      const map = new Map();
      for (const def of DEFAULT_ROOMS) {
        map.set(def, { room: def, count: 0, players: [] });
      }
      for (const s of clients.values()) {
        if (!s.name || isPrivateDebugRoom(s.room) || isSurvivalRoom(s.room)) continue;
        if (!map.has(s.room)) map.set(s.room, { room: s.room, count: 0, players: [] });
        const entry = map.get(s.room);
        entry.count++;
        entry.players.push(s.name);
      }
      return [...map.values()];
    },
    triggerCelebration: (opts = {}) => {
      const room = sanitizeRoom(opts.room || 'plateau-u300');
      return broadcastCelebrationInRoom(room, opts);
    },
    triggerAscension: (opts = {}) => {
      const room = sanitizeRoom(opts.room || 'plateau-u300');
      return broadcastAscensionInRoom(room, opts);
    },
    notifyValidateAll: (name, result, room = '') => {
      const key = String(name || '').toLowerCase();
      let celebrated = null;
      for (const [sock, s] of clients.entries()) {
        if (s.name && s.name.toLowerCase() === key && sock.readyState === 1) {
          broadcastToRoom(
            s.room,
            {
              type: 'player_stats_updated',
              id: s.id,
              profile: {
                xp: result.profile.xp,
                average: result.profile.average,
                completedCount: result.profile.completedCount,
                diplomaEarned: result.profile.diplomaEarned,
                rank: result.profile.rank,
                rankLabel: result.profile.rankLabel
              }
            },
            sock
          );
          if (!celebrated) {
            celebrated = broadcastCelebrationInRoom(s.room, {
              playerId: s.id,
              playerName: s.name,
              tpId: 'oscilloscope',
              reason: 'all_tps_20'
            });
          }
        }
      }
      if (!celebrated && room) {
        celebrated = broadcastCelebrationInRoom(room, {
          playerName: name,
          tpId: 'oscilloscope',
          reason: 'all_tps_20'
        });
      }
      broadcastLeaderboard();
      return celebrated;
    },
    getEnrichedLeaderboard,
    getAllEnrichedPlayers,
    getAllEnrichedAccounts,
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
    notifyAccountUpdated: (profile) => {
      if (!profile?.name) return;
      const key = profile.name.toLowerCase();
      for (const [sock, s] of clients.entries()) {
        if (s.name && s.name.toLowerCase() === key && sock.readyState === 1) {
          s.skin = profile.skin;
          s.color = profile.color;
          sock.send(
            JSON.stringify({
              type: 'profile_updated',
              profile
            })
          );
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
    notifyPlayerReset: (profile) => {
      if (!profile?.name) return;
      const key = profile.name.toLowerCase();
      for (const [sock, s] of clients.entries()) {
        if (s.name && s.name.toLowerCase() === key && sock.readyState === 1) {
          s.lastPlaytimeFlushMs = Date.now();
          sock.send(
            JSON.stringify({
              type: 'profile_reset',
              profile,
              message: 'Votre progression a été réinitialisée par l’administrateur.'
            })
          );
          broadcastToRoom(
            s.room,
            {
              type: 'player_stats_updated',
              id: s.id,
              profile: {
                xp: profile.xp,
                average: profile.average,
                completedCount: profile.completedCount,
                diplomaEarned: profile.diplomaEarned,
                rank: profile.rank,
                rankLabel: profile.rankLabel
              }
            },
            sock
          );
        }
      }
      broadcastLeaderboard();
    },
    disconnectPlayer: (rawName) => {
      const key = String(rawName || '').trim().toLowerCase();
      for (const [sock, s] of clients.entries()) {
        if (s.name && s.name.toLowerCase() === key && sock.readyState === 1) {
          sock.send(
            JSON.stringify({
              type: 'account_deleted',
              message: 'Votre compte élève a été supprimé par l’administrateur.'
            })
          );
          sock.close(4001, 'Compte supprimé par l’administrateur');
        }
      }
      broadcastLeaderboard();
    },
    broadcastMapUpdated: (mapData) => {
      for (const ctrl of roomSurvivals.values()) {
        ctrl.setMapData(mapData);
      }
      broadcastToAll({
        type: 'map_updated',
        map: mapData
      });
    },
    getSurvivalController,
    close: () => {
      clearInterval(heartbeatInterval);
      if (survivalTickInterval) {
        clearInterval(survivalTickInterval);
        survivalTickInterval = null;
      }
      for (const t of survivalResetTimers) {
        clearTimeout(t);
      }
      survivalResetTimers.clear();
      return wss.close();
    }
  };
}
