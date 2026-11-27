import { getStationTeleportInMap, normalizeMapData } from '../world/mapSchema.js';
import { TP_STATION_LAYOUT } from '../world/plateauLayout.js';

export const JPO_ROOM_STORAGE_KEY = 'ciel_jpo_salle';
export const JPO_KIOSK_STORAGE_KEY = 'ciel_jpo_kiosk';
export const JPO_KIOSK_IDLE_MS = 60000;
export const JPO_DEMO_COINS = 0;
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
    demoCoins: 0,
    visitorPrefix: 'Visiteur_Cyber',
    description: 'Salle Cybersécurité dédiée et fermée (U305) • Accès direct sans compte • TP Cyber SOC prêt à lancer.'
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
    demoCoins: 0,
    visitorPrefix: 'Visiteur_Reseau',
    description: 'Salle Réseaux & Infrastructure dédiée et fermée (U307) • Accès direct sans compte • TP VLAN 802.1Q prêt à lancer.'
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
    demoCoins: 0,
    visitorPrefix: 'Visiteur_Elec',
    description: 'Salle Électronique & Embarqué dédiée et fermée (U302) • Accès direct sans compte • TP Électronique 3D prêt à lancer.'
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

export function isJpoActive(storage = globalThis?.localStorage) {
  return isJpoRoomActive(readJpoConfig(storage).room);
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

export function getJpoHudVisibility(roomId, kiosk = false) {
  const isJpo = isJpoRoomActive(roomId);
  return {
    isJpo,
    requireAuth: !isJpo,
    showBanner: isJpo || Boolean(kiosk),
    showNewVisitBtn: isJpo || Boolean(kiosk),
    showCoins: !isJpo,
    showShop: !isJpo,
    showMinimap: !isJpo,
    showQuestPanel: !isJpo,
    showTopBar: !isJpo
  };
}

function buildJpoRoomObjects(roomId) {
  if (roomId === 'cyber') {
    return [
      { id: 'jpo-tp-antivirus', floor: 0, type: 'tp_antivirus', x: 0, z: -2.0, rotation: 0, w: 2.4, d: 1.3, color: '#f43f5e', label: 'TP Cyber SOC 3D' },
      { id: 'jpo-cyber-soc-wall', floor: 0, type: 'soc_wall_screen', x: 0, z: -5.82, rotation: 0, w: 4.4, d: 0.16, label: 'SOC CYBER • SURVEILLANCE' },
      { id: 'jpo-cyber-rack-l', floor: 0, type: 'net_rack_19', x: -4.6, z: -4.9, rotation: 0 },
      { id: 'jpo-cyber-rack-r', floor: 0, type: 'net_rack_19', x: 4.6, z: -4.9, rotation: 0 },
      { id: 'jpo-cyber-ups', floor: 0, type: 'net_ups', x: 3.3, z: -5.0, rotation: 0 },
      { id: 'jpo-cyber-bench-l', floor: 0, type: 'workbench_large', x: -4.4, z: 0.4, rotation: 90, w: 3.4, d: 1.1 },
      { id: 'jpo-cyber-bench-r', floor: 0, type: 'workbench_large', x: 4.4, z: 0.4, rotation: 270, w: 3.4, d: 1.1 },
      { id: 'jpo-cyber-sw-l', floor: 0, type: 'net_switch_stack', x: -4.4, z: 0.4, rotation: 90 },
      { id: 'jpo-cyber-sw-r', floor: 0, type: 'net_switch_stack', x: 4.4, z: 0.4, rotation: 270 },
      { id: 'jpo-cyber-chair-l', floor: 0, type: 'chair_student', x: -3.1, z: 0.4, rotation: 270 },
      { id: 'jpo-cyber-chair-r', floor: 0, type: 'chair_student', x: 3.1, z: 0.4, rotation: 90 },
      { id: 'jpo-cyber-cab', floor: 0, type: 'metal_cabinet', x: -4.9, z: 4.9, rotation: 0 },
      { id: 'jpo-cyber-wb', floor: 0, type: 'whiteboard', x: 0, z: 5.82, rotation: 180 }
    ];
  }
  if (roomId === 'reseau') {
    return [
      { id: 'jpo-tp-vmvlan', floor: 0, type: 'tp_vmvlan', x: 0, z: -2.2, rotation: 0, w: 2.2, d: 1.0, color: '#34d399', label: 'TP VLAN 802.1Q 3D' },
      { id: 'jpo-net-patch-l', floor: 0, type: 'net_patch_wall', x: -2.8, z: -5.82, rotation: 0 },
      { id: 'jpo-net-patch-r', floor: 0, type: 'net_patch_wall', x: 2.8, z: -5.82, rotation: 0 },
      { id: 'jpo-net-rack-l', floor: 0, type: 'net_rack_19', x: -4.6, z: -4.9, rotation: 0 },
      { id: 'jpo-net-rack-r', floor: 0, type: 'net_rack_19', x: 4.6, z: -4.9, rotation: 0 },
      { id: 'jpo-net-ups', floor: 0, type: 'net_ups', x: -3.4, z: -5.0, rotation: 0 },
      { id: 'jpo-net-bench-l', floor: 0, type: 'workbench_large', x: -4.4, z: 0.6, rotation: 90, w: 3.4, d: 1.1 },
      { id: 'jpo-net-bench-r', floor: 0, type: 'workbench_large', x: 4.4, z: 0.6, rotation: 270, w: 3.4, d: 1.1 },
      { id: 'jpo-net-sw-l', floor: 0, type: 'net_switch_stack', x: -4.4, z: 0.6, rotation: 90 },
      { id: 'jpo-net-sw-r', floor: 0, type: 'net_switch_stack', x: 4.4, z: 0.6, rotation: 270 },
      { id: 'jpo-net-chair-l', floor: 0, type: 'chair_student', x: -3.1, z: 0.6, rotation: 270 },
      { id: 'jpo-net-chair-r', floor: 0, type: 'chair_student', x: 3.1, z: 0.6, rotation: 90 },
      { id: 'jpo-net-wb', floor: 0, type: 'whiteboard', x: 0, z: -5.82, rotation: 0 },
      { id: 'jpo-net-cab', floor: 0, type: 'metal_cabinet', x: 4.9, z: 4.9, rotation: 180 }
    ];
  }
  return [
    { id: 'jpo-tp-electronics', floor: 0, type: 'tp_electronics', x: 0, z: -2.0, rotation: 0, w: 2.4, d: 1.3, color: '#fbbf24', label: 'TP Électronique 3D' },
    { id: 'jpo-elec-bench-lt', floor: 0, type: 'elec_bench', x: -4.4, z: -1.6, rotation: 90, w: 2.6, d: 1.0 },
    { id: 'jpo-elec-bench-lb', floor: 0, type: 'elec_bench', x: -4.4, z: 1.8, rotation: 90, w: 2.6, d: 1.0 },
    { id: 'jpo-elec-bench-rt', floor: 0, type: 'elec_bench', x: 4.4, z: -1.6, rotation: 270, w: 2.6, d: 1.0 },
    { id: 'jpo-elec-bench-rb', floor: 0, type: 'elec_bench', x: 4.4, z: 1.8, rotation: 270, w: 2.6, d: 1.0 },
    { id: 'jpo-elec-scope', floor: 0, type: 'elec_scope_unit', x: -4.4, z: -1.6, rotation: 90 },
    { id: 'jpo-elec-multi', floor: 0, type: 'elec_multimeter', x: -4.4, z: 1.8, rotation: 90 },
    { id: 'jpo-elec-solder', floor: 0, type: 'elec_solder_unit', x: 4.4, z: -1.6, rotation: 270 },
    { id: 'jpo-elec-fume', floor: 0, type: 'elec_fume_extractor', x: 4.4, z: 1.8, rotation: 270 },
    { id: 'jpo-elec-cab-l', floor: 0, type: 'metal_cabinet', x: -4.7, z: -5.0, rotation: 0 },
    { id: 'jpo-elec-cab-r', floor: 0, type: 'metal_cabinet', x: 4.7, z: -5.0, rotation: 0 },
    { id: 'jpo-elec-wb', floor: 0, type: 'whiteboard', x: 0, z: -5.82, rotation: 0 }
  ];
}

export function createJpoRoomMap(roomId) {
  const cleanId = normalizeJpoRoom(roomId);
  if (!isJpoRoomActive(cleanId)) return null;
  const cfg = getJpoRoomConfig(cleanId);
  const normalized = normalizeMapData({
    id: `jpo-room-${cleanId}`,
    name: cfg.label,
    bounds: {
      minX: -6,
      maxX: 6,
      minZ: -6,
      maxZ: 6,
      width: 12,
      depth: 12,
      height: 4.0
    },
    floorHeight: 4.0,
    floors: [{ index: 0, label: 'RDC (0)', hasFullSlab: true, hasCeiling: true }],
    spawn: { x: 0, z: 2.6, yaw: 0, floor: 0 },
    zones: [
      {
        id: `jpo-${cfg.roomCode}`,
        floor: 0,
        code: cfg.roomCode,
        shortName: cfg.shortLabel,
        fullLabel: cfg.poleLabel,
        badgeText: `📍 ${cfg.roomCode} - ${cfg.shortLabel}`,
        color: cfg.accent,
        x: 0,
        z: 0,
        w: 11.4,
        d: 11.4
      }
    ],
    walls: [
      { id: 'jpo-wall-n', floor: 0, kind: 'solid', x1: -6, z1: -6, x2: 6, z2: -6, thickness: 0.24, height: 4.0, color: '#1e293b' },
      { id: 'jpo-wall-s', floor: 0, kind: 'solid', x1: -6, z1: 6, x2: 6, z2: 6, thickness: 0.24, height: 4.0, color: '#1e293b' },
      { id: 'jpo-wall-w', floor: 0, kind: 'solid', x1: -6, z1: -6, x2: -6, z2: 6, thickness: 0.24, height: 4.0, color: '#1e293b' },
      { id: 'jpo-wall-e', floor: 0, kind: 'solid', x1: 6, z1: -6, x2: 6, z2: 6, thickness: 0.24, height: 4.0, color: '#1e293b' }
    ],
    objects: buildJpoRoomObjects(cleanId)
  });
  return {
    ...normalized,
    id: `jpo-room-${cleanId}`,
    name: cfg.label,
    jpoIsolated: true
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
