import { getStationTeleportInMap, normalizeMapData } from '../world/mapSchema.js';
import { EXTRA_STATIONS, TP_STATION_LAYOUT } from '../world/plateauLayout.js';

export const JPO_ROOM_STORAGE_KEY = 'ciel_jpo_salle';
export const JPO_KIOSK_STORAGE_KEY = 'ciel_jpo_kiosk';
export const JPO_KIOSK_IDLE_MS = 60000;
export const JPO_DEMO_COINS = 0;
export const JPO_AUTO_START_TP = false;
export const JPO_INTERACT_PROMPT_TEXT = "Appuyez sur [E] pour démarrer l'activité";
export const JPO_BRIEFING_START_LABEL = "🚀 C'est parti !";
export const JPO_BRIEFING_RESUME_LABEL = "✅ Reprendre l'activité";
export const JPO_HELP_BUTTON_LABEL = '❓ Aide / Consignes';
export const JPO_WELCOME_BADGE = 'PORTES OUVERTES • BAC PRO CIEL';
export const JPO_WELCOME_PLAY_LABEL = '🎮 Jouer';
export const JPO_ROOM_IDS = ['standard', 'cyber', 'reseau', 'elec', 'audiovisuel'];

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
    tpId: 'soldering',
    tpShortLabel: 'TP Brasure 3D',
    tpLabel: 'TP Brasure & Soudure PCB 3D',
    demoCoins: 0,
    visitorPrefix: 'Visiteur_Elec',
    description: 'Salle Électronique & Embarqué dédiée et fermée (U302) • Accès direct sans compte • TP Brasure 3D prêt à lancer.'
  },
  audiovisuel: {
    id: 'audiovisuel',
    label: 'Salle Audiovisuel',
    shortLabel: 'Audiovisuel',
    badgeCode: 'AUDIOVISUEL',
    poleLabel: 'Pôle Audiovisuel & Scénique (U303)',
    roomCode: 'U303',
    icon: '🎬',
    accent: '#a855f7',
    tpId: 'audiovisual',
    tpShortLabel: 'TP Audiovisuel',
    tpLabel: 'TP Son, Lumière DMX & Régie Vidéo',
    demoCoins: 0,
    visitorPrefix: 'Visiteur_AV',
    description: 'Salle Audiovisuel & Scénique dédiée et fermée (U303) • Accès direct sans compte • TP Audiovisuel prêt à lancer.'
  }
};

export function normalizeJpoRoom(raw) {
  const clean = String(raw || '').trim().toLowerCase();
  return JPO_ROOM_IDS.includes(clean) ? clean : 'standard';
}

export function getJpoRoomConfig(roomId) {
  return JPO_ROOMS[normalizeJpoRoom(roomId)];
}

export const JPO_MISSION_BRIEFINGS = {
  antivirus: {
    tpId: 'antivirus',
    roomId: 'cyber',
    objectType: 'tp_antivirus',
    icon: '🛡️',
    accent: '#f43f5e',
    shortTitle: 'Mission Cyber : Protège le réseau du lycée',
    title: '🛡️ Mission Cyber : Protège le réseau du lycée !',
    intro: 'Un pirate attaque les ordinateurs du lycée. Ton objectif en 3 étapes simples :',
    steps: [
      {
        num: 1,
        icon: '🔌',
        lead: 'Coupe le câble',
        text: "du PC infecté (clique sur l'élément rouge ou le bouton « Isoler le PC ») pour stopper le virus."
      },
      {
        num: 2,
        icon: '🧱',
        lead: 'Bloque les intrus',
        text: 'en activant les protections du pare-feu dans le panneau à droite.'
      },
      {
        num: 3,
        icon: '🧼',
        lead: "Lance l'antivirus",
        text: '(bouton bleu en bas à droite) pour nettoyer le système et remonter la barre verte à 100 %.'
      }
    ]
  },
  vmvlan: {
    tpId: 'vmvlan',
    roomId: 'reseau',
    objectType: 'tp_vmvlan',
    icon: '🌐',
    accent: '#34d399',
    shortTitle: 'Mission Réseau : Connecte les salles du lycée',
    title: '🌐 Mission Réseau : Connecte les salles du lycée !',
    intro: "Les ordinateurs de l'étage n'ont plus d'Internet. Ton objectif en 3 étapes simples :",
    steps: [
      {
        num: 1,
        icon: '🔧',
        lead: 'Branche et configure',
        text: 'les équipements réseau (switch / routeur) sur le bureau 3D.'
      },
      {
        num: 2,
        icon: '🔀',
        lead: 'Sépare les réseaux',
        text: "(élèves et professeurs) à l'aide des boutons guidés à droite."
      },
      {
        num: 3,
        icon: '✅',
        lead: 'Vérifie que tout passe au vert',
        text: 'pour rétablir la connexion.'
      }
    ]
  },
  soldering: {
    tpId: 'soldering',
    roomId: 'elec',
    objectType: 'tp_soldering',
    icon: '🔥',
    accent: '#fbbf24',
    shortTitle: 'Mission Brasure : Soude ta carte électronique',
    title: '🔥 Mission Brasure : Soude ta carte électronique !',
    intro: 'Une carte électronique attend ses composants. Ton objectif en 3 étapes simples :',
    steps: [
      {
        num: 1,
        icon: '🌡️',
        lead: 'Prépare et chauffe',
        text: 'le fer à souder à la bonne température.'
      },
      {
        num: 2,
        icon: '🔥',
        lead: 'Positionne et brase',
        text: "les composants sur la carte avec l'étain."
      },
      {
        num: 3,
        icon: '💡',
        lead: 'Contrôle et teste',
        text: 'tes soudures pour allumer la carte.'
      }
    ]
  },
  audiovisual: {
    tpId: 'audiovisual',
    roomId: 'audiovisuel',
    objectType: 'tp_audiovisual',
    icon: '🎬',
    accent: '#a855f7',
    shortTitle: 'Mission Audiovisuel : Pilote le spectacle en direct',
    title: '🎬 Mission Audiovisuel : Pilote le spectacle en direct !',
    intro: 'Le spectacle du lycée va commencer. Ton objectif en 3 étapes simples :',
    steps: [
      {
        num: 1,
        icon: '🎙️',
        lead: 'Règle le son',
        text: 'en allumant le micro de scène et en plaçant le volume dans la zone verte.'
      },
      {
        num: 2,
        icon: '💡',
        lead: 'Pilote les lumières',
        text: "en allumant les projecteurs DMX et en choisissant l'ambiance du spectacle."
      },
      {
        num: 3,
        icon: '📺',
        lead: 'Valide la vidéo',
        text: 'en sélectionnant la caméra de la scène puis en lançant la diffusion en direct.'
      }
    ]
  }
};

Object.defineProperty(JPO_MISSION_BRIEFINGS, 'elec', {
  get: () => JPO_MISSION_BRIEFINGS.soldering,
  enumerable: false,
  configurable: true
});

export function getJpoMissionBriefing(key) {
  const raw = String(key || '').trim().toLowerCase();
  if (!raw) return null;
  const clean = raw.startsWith('tp_') ? raw.slice(3) : raw;
  if (JPO_MISSION_BRIEFINGS[clean]) {
    return JPO_MISSION_BRIEFINGS[clean];
  }
  const roomCfg = JPO_ROOMS[clean];
  if (roomCfg?.tpId && JPO_MISSION_BRIEFINGS[roomCfg.tpId]) {
    return JPO_MISSION_BRIEFINGS[roomCfg.tpId];
  }
  return null;
}

export const JPO_WELCOME_SCREENS = {
  cyber: {
    roomId: 'cyber',
    icon: '🛡️',
    accent: '#f43f5e',
    title: '🛡️ Bienvenue sur le TP Cybersécurité',
    subtitle: 'Découvrez comment protéger un réseau informatique contre une cyberattaque en quelques clics.'
  },
  reseau: {
    roomId: 'reseau',
    icon: '🌐',
    accent: '#34d399',
    title: '🌐 Bienvenue sur le TP Réseaux & Systèmes',
    subtitle: "Apprenez à connecter et sécuriser les équipements réseau d'un bâtiment."
  },
  elec: {
    roomId: 'elec',
    icon: '⚡',
    accent: '#fbbf24',
    title: '⚡ Bienvenue sur le TP Électronique & Embarqué',
    subtitle: "Explorez le fonctionnement d'un circuit électronique et réalisez vos premiers réglages."
  },
  audiovisuel: {
    roomId: 'audiovisuel',
    icon: '🎬',
    accent: '#a855f7',
    title: '🎬 Bienvenue sur le TP Audiovisuel',
    subtitle: "Découvrez comment piloter le son, la lumière DMX et la régie vidéo d'un événement."
  }
};

export function getJpoWelcomeScreen(roomId) {
  const clean = normalizeJpoRoom(roomId);
  if (!isJpoRoomActive(clean)) return null;
  return JPO_WELCOME_SCREENS[clean] || null;
}

export function shouldShowJpoWelcome(roomId) {
  return isJpoRoomActive(roomId);
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
    const fallbackLayout = TP_STATION_LAYOUT[cfg.tpId] || EXTRA_STATIONS.find((s) => s.id === cfg.tpId);
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
  if (roomId === 'audiovisuel') {
    return [
      { id: 'jpo-tp-audiovisual', floor: 0, type: 'tp_audiovisual', x: 0, z: -2.0, rotation: 0, w: 2.4, d: 1.3, color: '#a855f7', label: 'TP Audiovisuel & Régie 3D' },
      { id: 'jpo-av-wall-screen', floor: 0, type: 'soc_wall_screen', x: 0, z: -5.82, rotation: 0, w: 4.6, d: 0.16, label: 'RÉGIE AUDIOVISUELLE • SON • DMX • VIDÉO' },
      { id: 'jpo-av-light-nl', floor: 0, type: 'av_led_light', x: -3.6, z: -4.4, rotation: 30 },
      { id: 'jpo-av-light-nr', floor: 0, type: 'av_led_light', x: 3.6, z: -4.4, rotation: 330 },
      { id: 'jpo-av-light-sl', floor: 0, type: 'av_led_light', x: -4.2, z: 3.8, rotation: 150 },
      { id: 'jpo-av-light-sr', floor: 0, type: 'av_led_light', x: 4.2, z: 3.8, rotation: 210 },
      { id: 'jpo-av-cam-l', floor: 0, type: 'av_camera', x: -2.4, z: -4.1, rotation: 15 },
      { id: 'jpo-av-cam-r', floor: 0, type: 'av_camera', x: 2.4, z: -4.1, rotation: 345 },
      { id: 'jpo-av-greenscreen', floor: 0, type: 'av_greenscreen', x: 0, z: 5.2, rotation: 180, w: 4.4, d: 0.8 },
      { id: 'jpo-av-bench-l', floor: 0, type: 'workbench_large', x: -4.5, z: 0.2, rotation: 90, w: 3.2, d: 1.1 },
      { id: 'jpo-av-mixer-l', floor: 0, type: 'av_mixer', x: -4.5, z: 0.2, rotation: 90, label: 'Console Son / Régie Audio' },
      { id: 'jpo-av-chair-l', floor: 0, type: 'chair_student', x: -3.2, z: 0.2, rotation: 270 },
      { id: 'jpo-av-bench-r', floor: 0, type: 'workbench_large', x: 4.5, z: 0.2, rotation: 270, w: 3.2, d: 1.1 },
      { id: 'jpo-av-mixer-r', floor: 0, type: 'av_mixer', x: 4.5, z: 0.2, rotation: 270, label: 'Pupitre Lumière DMX & Vidéo' },
      { id: 'jpo-av-chair-r', floor: 0, type: 'chair_student', x: 3.2, z: 0.2, rotation: 90 },
      { id: 'jpo-av-mic', floor: 0, type: 'av_mic_stand', x: 0, z: 3.9, rotation: 180 },
      { id: 'jpo-av-rack', floor: 0, type: 'net_rack_19', x: -4.8, z: -4.9, rotation: 0 },
      { id: 'jpo-av-cab', floor: 0, type: 'metal_cabinet', x: 4.8, z: -4.9, rotation: 0 }
    ];
  }
  return [
    { id: 'jpo-tp-soldering', floor: 0, type: 'tp_soldering', x: 0, z: -2.0, rotation: 0, w: 2.4, d: 1.3, color: '#fb923c', label: 'TP Brasure 3D' },
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
