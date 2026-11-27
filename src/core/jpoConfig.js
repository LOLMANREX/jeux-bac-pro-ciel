import { getStationTeleportInMap } from '../world/mapSchema.js';
import { TP_STATION_LAYOUT } from '../world/plateauLayout.js';

export const JPO_ROOM_STORAGE_KEY = 'ciel_jpo_salle';
export const JPO_KIOSK_STORAGE_KEY = 'ciel_jpo_kiosk';
export const JPO_KIOSK_IDLE_MS = 60000;
export const JPO_DEMO_COINS = 500;
export const JPO_ROOM_IDS = ['standard', 'cyber', 'reseau', 'elec'];

export const JPO_ROOMS = {
  standard: {
    id: 'standard',
    label: 'Mode normal',
    shortLabel: 'Standard',
    badgeCode: 'STD',
    poleLabel: 'Atelier CIEL 3D complet',
    roomCode: 'U300',
    icon: '🏫',
    accent: '#38bdf8',
    tpId: null,
    tpShortLabel: null,
    tpLabel: null,
    demoCoins: 0,
    visitorPrefix: null,
    description: 'Jeu complet sans restriction avec menu principal et connexion élève.'
  },
  cyber: {
    id: 'cyber',
    label: 'Salle Cybersécurité',
    shortLabel: 'Cybersécurité',
    badgeCode: 'CYBER',
    poleLabel: 'Pôle Cybersécurité • SOC (U305)',
    roomCode: 'U305',
    icon: '🛡️',
    accent: '#f43f5e',
    tpId: 'antivirus',
    tpShortLabel: 'TP Cyber SOC',
    tpLabel: 'TP Cybersécurité & Défense SOC 3D',
    demoCoins: 500,
    visitorPrefix: 'Visiteur_Cyber',
    description: 'Spawn direct au pôle Cyber (U305) + TP Cyber SOC pré-activé + 500 CIEL Coins de démo.'
  },
  reseau: {
    id: 'reseau',
    label: 'Salle Réseaux & Infrastructure',
    shortLabel: 'Réseaux',
    badgeCode: 'RÉSEAU',
    poleLabel: 'Pôle Réseaux & Infrastructure (U307)',
    roomCode: 'U307',
    icon: '🌐',
    accent: '#34d399',
    tpId: 'vmvlan',
    tpShortLabel: 'TP VLAN 802.1Q',
    tpLabel: 'TP Configuration VLAN 802.1Q, Trunk & Routage 3D',
    demoCoins: 500,
    visitorPrefix: 'Visiteur_Reseau',
    description: 'Spawn direct au pôle Réseau (U307) + TP VLAN 802.1Q pré-activé + 500 CIEL Coins de démo.'
  },
  elec: {
    id: 'elec',
    label: 'Salle Électronique & Embarqué',
    shortLabel: 'Électronique',
    badgeCode: 'ÉLEC',
    poleLabel: 'Pôle Électronique & Embarqué (U302)',
    roomCode: 'U302',
    icon: '⚡',
    accent: '#fbbf24',
    tpId: 'electronics',
    tpShortLabel: 'TP Électronique 3D',
    tpLabel: 'TP Breadboard, Multimètre & Résistances 3D',
    demoCoins: 500,
    visitorPrefix: 'Visiteur_Elec',
    description: 'Spawn direct au pôle Électronique (U302) + TP Électronique 3D pré-activé + 500 CIEL Coins de démo.'
  }
};

export function normalizeJpoRoom(raw) {
  const clean = String(raw || '').trim().toLowerCase();
  return JPO_ROOM_IDS.includes(clean) ? clean : 'standard';
}

export function getJpoRoomConfig(roomId) {
  return JPO_ROOMS[normalizeJpoRoom(roomId)];
}

export function isJpoRoomActive(roomId) {
  return normalizeJpoRoom(roomId) !== 'standard';
}

export function readJpoConfig(storage = globalThis?.localStorage) {
  try {
    if (!storage || typeof storage.getItem !== 'function') {
      return { room: 'standard', kiosk: false };
    }
    const rawRoom = storage.getItem(JPO_ROOM_STORAGE_KEY);
    const rawKiosk = storage.getItem(JPO_KIOSK_STORAGE_KEY);
    return {
      room: normalizeJpoRoom(rawRoom),
      kiosk: rawKiosk === '1'
    };
  } catch {
    return { room: 'standard', kiosk: false };
  }
}

export function saveJpoConfig({ room, kiosk } = {}, storage = globalThis?.localStorage) {
  const current = readJpoConfig(storage);
  const nextRoom = room !== undefined ? normalizeJpoRoom(room) : current.room;
  const nextKiosk = kiosk !== undefined ? Boolean(kiosk) : current.kiosk;
  try {
    if (storage && typeof storage.setItem === 'function') {
      storage.setItem(JPO_ROOM_STORAGE_KEY, nextRoom);
      storage.setItem(JPO_KIOSK_STORAGE_KEY, nextKiosk ? '1' : '0');
    }
  } catch {
    return { room: nextRoom, kiosk: nextKiosk };
  }
  return { room: nextRoom, kiosk: nextKiosk };
}

export function createJpoVisitorName(roomId, randomFn = Math.random) {
  const cfg = getJpoRoomConfig(roomId);
  const suffix = Math.floor(100 + Math.max(0, Math.min(0.9999, Number(randomFn()) || 0)) * 900);
  if (!cfg.visitorPrefix) {
    return `Visiteur_CIEL_${suffix}`;
  }
  return `${cfg.visitorPrefix}_${suffix}`;
}

export function resolveJpoSpawnPose(mapData, roomId) {
  const cfg = getJpoRoomConfig(roomId);
  if (cfg.tpId) {
    const objects = Array.isArray(mapData?.objects) ? mapData.objects : [];
    const hasStationObj = objects.some((o) => {
      if (!o || !o.type) return false;
      const t = String(o.type);
      return t === cfg.tpId || t.includes(cfg.tpId);
    });
    if (hasStationObj) {
      const spot = getStationTeleportInMap(mapData, cfg.tpId);
      if (spot?.pos) {
        return {
          pos: spot.pos,
          lookAt: spot.lookAt,
          roomCode: cfg.roomCode,
          tpId: cfg.tpId
        };
      }
    }
    const fallbackLayout = TP_STATION_LAYOUT[cfg.tpId];
    if (fallbackLayout) {
      return {
        pos: { x: fallbackLayout.teleport.x, y: 0, z: fallbackLayout.teleport.z, floor: 0 },
        lookAt: { x: fallbackLayout.position.x, y: 1.35, z: fallbackLayout.position.z },
        roomCode: cfg.roomCode,
        tpId: cfg.tpId
      };
    }
  }
  const sp = mapData?.spawn || { x: -3.95, z: 0.65, yaw: 0, floor: 0 };
  const yaw = typeof sp.yaw === 'number' ? sp.yaw : 0;
  return {
    pos: { x: sp.x, y: 0, z: sp.z, floor: sp.floor ?? 0 },
    lookAt: { x: sp.x - Math.sin(yaw) * 4, z: sp.z - Math.cos(yaw) * 4 },
    roomCode: cfg.roomCode,
    tpId: cfg.tpId
  };
}

export function createKioskIdleController({
  timeoutMs = JPO_KIOSK_IDLE_MS,
  onTimeout,
  nowFn = () => Date.now(),
  setIntervalFn = globalThis.setInterval,
  clearIntervalFn = globalThis.clearInterval
} = {}) {
  const safeTimeout = Math.max(1000, Number(timeoutMs) || JPO_KIOSK_IDLE_MS);
  let lastActivityAt = nowFn();
  let timerId = null;
  let active = false;

  const touch = () => {
    lastActivityAt = nowFn();
  };

  const getRemainingMs = () => {
    const elapsed = Math.max(0, nowFn() - lastActivityAt);
    return Math.max(0, safeTimeout - elapsed);
  };

  const tick = () => {
    if (!active) return false;
    const remaining = getRemainingMs();
    if (remaining <= 0) {
      lastActivityAt = nowFn();
      onTimeout?.();
      return true;
    }
    return false;
  };

  const start = () => {
    if (timerId !== null && typeof clearIntervalFn === 'function') {
      clearIntervalFn(timerId);
      timerId = null;
    }
    active = true;
    lastActivityAt = nowFn();
    if (typeof setIntervalFn === 'function') {
      timerId = setIntervalFn(tick, 1000);
    }
  };

  const stop = () => {
    active = false;
    if (timerId !== null && typeof clearIntervalFn === 'function') {
      clearIntervalFn(timerId);
      timerId = null;
    }
  };

  const isActive = () => active;

  return { start, stop, touch, tick, getRemainingMs, isActive };
}
