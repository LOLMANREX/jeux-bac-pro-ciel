import {
  PLATEAU_SPAWN,
  PLATEAU_TEACHER_POS,
  PLATEAU_ZONES,
  TP_STATION_LAYOUT,
  EXTRA_STATIONS,
  PLATEAU_FURNITURE_BOXES,
  WORLD_BOUNDS,
  buildPlateauWalls
} from './plateauLayout.js';

export const MIN_FLOOR = -2;
export const MAX_FLOOR = 8;
export const DEFAULT_CAMPUS_SIZE = 1000;
export const MAX_MAP_SIZE = 2000;
export const CAMPUS_SIZE_PRESETS = [250, 500, 1000, 2000];
export const DEFAULT_FLOOR_HEIGHT = 3.8;
export const SLAB_THICKNESS = 0.22;

export function clampFloor(f) {
  const n = Math.round(Number(f));
  if (!Number.isFinite(n)) return 0;
  return Math.max(MIN_FLOOR, Math.min(MAX_FLOOR, n));
}

export function formatFloorLabel(f) {
  const fl = clampFloor(f);
  if (fl < 0) return `Sous-sol (${fl})`;
  if (fl === 0) return 'RDC (0)';
  return `Étage ${fl}`;
}

export function formatFloorShortLabel(f) {
  const fl = clampFloor(f);
  if (fl < 0) return `SS (${fl})`;
  if (fl === 0) return 'RDC';
  return `R+${fl}`;
}

export function getFloorBaseY(mapData, floor = 0) {
  const fh = Number(mapData?.floorHeight) || DEFAULT_FLOOR_HEIGHT;
  return clampFloor(floor) * fh;
}

export function getFloorFromY(mapData, y = 0) {
  const fh = Number(mapData?.floorHeight) || DEFAULT_FLOOR_HEIGHT;
  return clampFloor(Math.floor(((Number(y) || 0) + 0.5) / fh));
}

export const MAP_ITEM_CATEGORIES = [
  { id: 'arch', label: 'A. Architecture & Salles' },
  { id: 'stations', label: 'B. Bornes TP & PNJ' },
  { id: 'furniture', label: 'C. Mobilier Scolaire' },
  { id: 'tech', label: 'D. Matériel CIEL & Déco' }
];

export const MAP_ITEM_CATALOG = [
  {
    type: 'wall_solid',
    category: 'arch',
    subGroup: 'Murs & Structure',
    label: 'Mur plein',
    shortLabel: 'Mur plein',
    icon: '🧱',
    isWall: true,
    wallKind: 'solid',
    defaultW: 4.0,
    defaultD: 0.2,
    defaultH: 4.6,
    defaultColor: '#1e293b',
    collides: true
  },
  {
    type: 'wall_glazed',
    category: 'arch',
    subGroup: 'Murs & Structure',
    label: 'Cloison vitrée / Fenêtre',
    shortLabel: 'Cloison vitrée',
    icon: '🪟',
    isWall: true,
    wallKind: 'glazed',
    defaultW: 4.0,
    defaultD: 0.18,
    defaultH: 4.6,
    defaultColor: '#38bdf8',
    collides: true
  },
  {
    type: 'door_single',
    category: 'arch',
    subGroup: 'Murs & Structure',
    label: 'Porte simple',
    shortLabel: 'Porte simple',
    icon: '🚪',
    isWall: true,
    wallKind: 'door_single',
    defaultW: 1.3,
    defaultD: 0.18,
    defaultH: 4.6,
    defaultColor: '#0ea5e9',
    collides: false
  },
  {
    type: 'door_double',
    category: 'arch',
    subGroup: 'Murs & Structure',
    label: 'Porte double',
    shortLabel: 'Porte double',
    icon: '🏛️',
    isWall: true,
    wallKind: 'door_double',
    defaultW: 2.0,
    defaultD: 0.18,
    defaultH: 4.6,
    defaultColor: '#22d3ee',
    collides: false
  },
  {
    type: 'zone_room',
    category: 'arch',
    subGroup: 'Salles & Signalétique',
    label: 'Zone de Salle / Sol (Rectangle)',
    shortLabel: 'Zone Rect.',
    icon: '▭',
    isZone: true,
    defaultW: 6.0,
    defaultD: 5.0,
    defaultH: 0.02,
    defaultColor: '#38bdf8',
    collides: false
  },
  {
    type: 'zone_polygon',
    category: 'arch',
    subGroup: 'Salles & Signalétique',
    label: 'Zone Polygonale (Forme libre / L)',
    shortLabel: 'Zone Polygonale (L)',
    icon: '📐',
    isZonePolygon: true,
    defaultW: 6.0,
    defaultD: 5.0,
    defaultH: 0.02,
    defaultColor: '#38bdf8',
    collides: false
  },
  {
    type: 'spawn_point',
    category: 'arch',
    subGroup: 'Salles & Signalétique',
    label: 'Point de Spawn',
    shortLabel: 'Spawn Joueurs',
    icon: '📍',
    isSpawn: true,
    defaultW: 1.0,
    defaultD: 1.0,
    defaultH: 0.2,
    defaultColor: '#10b981',
    collides: false
  },
  {
    type: 'leaderboard',
    category: 'arch',
    subGroup: 'Salles & Signalétique',
    label: 'Tableau de Classement Mural 3D',
    shortLabel: 'Classement 3D',
    icon: '🏆',
    defaultW: 3.45,
    defaultD: 0.24,
    defaultH: 2.1,
    defaultColor: '#06b6d4',
    collides: false,
    wallMount: true
  },
  {
    type: 'wall_map_board',
    category: 'arch',
    subGroup: 'Salles & Signalétique',
    label: 'Panneau Plan d’Orientation',
    shortLabel: 'Plan Mural',
    icon: '🗺️',
    defaultW: 2.86,
    defaultD: 0.14,
    defaultH: 1.9,
    defaultColor: '#38bdf8',
    collides: false,
    wallMount: true
  },
  {
    type: 'stair_block',
    category: 'arch',
    subGroup: 'Salles & Structure',
    label: 'Cage d’escalier 3D',
    shortLabel: 'Escalier 3D',
    icon: '🪜',
    defaultW: 4.2,
    defaultD: 3.66,
    defaultH: 4.4,
    defaultColor: '#64748b',
    collides: true
  },
  {
    type: 'wall_exterior',
    category: 'arch',
    subGroup: 'Murs & Structure',
    label: 'Mur extérieur épais (Façade)',
    shortLabel: 'Mur extérieur',
    icon: '🏢',
    isWall: true,
    wallKind: 'exterior',
    defaultW: 6.0,
    defaultD: 0.3,
    defaultH: 3.8,
    defaultColor: '#334155',
    collides: true
  },
  {
    type: 'wall_window_bay',
    category: 'arch',
    subGroup: 'Murs & Structure',
    label: 'Grande baie vitrée',
    shortLabel: 'Baie vitrée',
    icon: '🪟',
    isWall: true,
    wallKind: 'window_bay',
    defaultW: 4.5,
    defaultD: 0.2,
    defaultH: 3.8,
    defaultColor: '#38bdf8',
    collides: true
  },
  {
    type: 'railing_guard',
    category: 'arch',
    subGroup: 'Murs & Structure',
    label: 'Garde-corps / Mezzanine',
    shortLabel: 'Garde-corps',
    icon: '🚧',
    isWall: true,
    wallKind: 'railing',
    defaultW: 3.0,
    defaultD: 0.12,
    defaultH: 1.08,
    defaultColor: '#94a3b8',
    collides: true
  },
  {
    type: 'stair_straight',
    category: 'arch',
    subGroup: 'Escaliers & Trémies',
    label: 'Escalier 3D Droit (Rampe + Marches)',
    shortLabel: 'Escalier Droit',
    icon: '📶',
    isStair: true,
    stairStyle: 'straight',
    defaultW: 1.8,
    defaultD: 4.6,
    defaultH: 3.8,
    defaultColor: '#64748b',
    collides: false
  },
  {
    type: 'stair_l',
    category: 'arch',
    subGroup: 'Escaliers & Trémies',
    label: 'Escalier 3D en L (Quart tournant)',
    shortLabel: 'Escalier en L',
    icon: '📐',
    isStair: true,
    stairStyle: 'l_shape',
    defaultW: 3.6,
    defaultD: 3.6,
    defaultH: 3.8,
    defaultColor: '#64748b',
    collides: false
  },
  {
    type: 'stair_u',
    category: 'arch',
    subGroup: 'Escaliers & Trémies',
    label: 'Escalier 3D en U (Double volée)',
    shortLabel: 'Escalier en U',
    icon: '🔁',
    isStair: true,
    stairStyle: 'u_shape',
    defaultW: 3.6,
    defaultD: 4.2,
    defaultH: 3.8,
    defaultColor: '#64748b',
    collides: false
  },
  {
    type: 'pillar_column',
    category: 'arch',
    subGroup: 'Murs & Structure',
    label: 'Poteau structurel',
    shortLabel: 'Poteau',
    icon: '🏛️',
    defaultW: 0.45,
    defaultD: 0.45,
    defaultH: 3.8,
    defaultColor: '#94a3b8',
    collides: true
  },
  {
    type: 'slab_opening',
    category: 'arch',
    subGroup: 'Escaliers & Trémies',
    label: 'Trémie / Ouverture de dalle',
    shortLabel: 'Trémie dalle',
    icon: '🕳️',
    isOpening: true,
    defaultW: 2.2,
    defaultD: 4.6,
    defaultH: 0.24,
    defaultColor: '#f59e0b',
    collides: false
  },
  {
    type: 'floor_slab',
    category: 'arch',
    subGroup: 'Escaliers & Trémies',
    label: 'Dalle de sol / Mezzanine',
    shortLabel: 'Dalle / Mezza',
    icon: '🧱',
    isSlab: true,
    defaultW: 10.0,
    defaultD: 10.0,
    defaultH: 0.22,
    defaultColor: '#94a3b8',
    collides: false
  },
  {
    type: 'room_builder',
    category: 'arch',
    subGroup: 'Construction Rapide',
    label: 'Salle / Bâtiment Express (4 murs + sol)',
    shortLabel: 'Salle Express',
    icon: '🏗️',
    isRoomBuilder: true,
    defaultW: 12.0,
    defaultD: 8.0,
    defaultH: 3.8,
    defaultColor: '#38bdf8',
    collides: false
  },
  {
    type: 'courtyard_zone',
    category: 'arch',
    subGroup: 'Extérieur & Campus',
    label: 'Zone extérieure (Cour du lycée)',
    shortLabel: 'Cour extérieure',
    icon: '🌳',
    isZone: true,
    isOutdoor: true,
    surfaceKind: 'concrete',
    defaultW: 20.0,
    defaultD: 16.0,
    defaultH: 0.02,
    defaultColor: '#22c55e',
    collides: false
  },
  {
    type: 'exterior_asphalt',
    category: 'arch',
    subGroup: 'Extérieur & Campus',
    label: 'Pinceau Bitume / Parking',
    shortLabel: 'Bitume / Parking',
    icon: '🛣️',
    isZone: true,
    isOutdoor: true,
    surfaceKind: 'asphalt',
    defaultW: 32.0,
    defaultD: 22.0,
    defaultH: 0.02,
    defaultColor: '#334155',
    collides: false
  },
  {
    type: 'exterior_concrete',
    category: 'arch',
    subGroup: 'Extérieur & Campus',
    label: 'Pinceau Cour en Béton / Parvis',
    shortLabel: 'Cour Béton',
    icon: '⬜',
    isZone: true,
    isOutdoor: true,
    surfaceKind: 'concrete',
    defaultW: 28.0,
    defaultD: 20.0,
    defaultH: 0.02,
    defaultColor: '#94a3b8',
    collides: false
  },
  {
    type: 'exterior_grass',
    category: 'arch',
    subGroup: 'Extérieur & Campus',
    label: 'Pinceau Pelouse / Espace Vert',
    shortLabel: 'Pelouse',
    icon: '🌿',
    isZone: true,
    isOutdoor: true,
    surfaceKind: 'grass',
    defaultW: 30.0,
    defaultD: 24.0,
    defaultH: 0.02,
    defaultColor: '#22c55e',
    collides: false
  },
  {
    type: 'exterior_path',
    category: 'arch',
    subGroup: 'Extérieur & Campus',
    label: 'Pinceau Allée / Chemin Piéton',
    shortLabel: 'Allée Piétonne',
    icon: '🚶',
    isZone: true,
    isOutdoor: true,
    surfaceKind: 'path',
    defaultW: 20.0,
    defaultD: 4.0,
    defaultH: 0.02,
    defaultColor: '#cbd5e1',
    collides: false
  },
  {
    type: 'exterior_sport',
    category: 'arch',
    subGroup: 'Extérieur & Campus',
    label: 'Pinceau Terrain de Sport',
    shortLabel: 'Terrain Sport',
    icon: '🏀',
    isZone: true,
    isOutdoor: true,
    surfaceKind: 'sport',
    defaultW: 40.0,
    defaultD: 22.0,
    defaultH: 0.02,
    defaultColor: '#ea580c',
    collides: false
  },
  {
    type: 'tp_soldering',
    category: 'stations',
    subGroup: 'Bornes de TP (Ateliers 3D)',
    label: 'TP 1 — Brasure & Soudure PCB 3D',
    shortLabel: 'TP 1 Brasure 3D',
    icon: '🔥',
    tpId: 'soldering',
    interactRadius: 2.6,
    defaultW: 1.5,
    defaultD: 2.8,
    defaultH: 2.2,
    defaultColor: '#fb923c',
    collides: true,
    supportTop: 0.84
  },
  {
    type: 'tp_oscilloscope',
    category: 'stations',
    subGroup: 'Bornes de TP (Ateliers 3D)',
    label: 'TP 2 — Oscilloscope & Diagnostic Élec 3D',
    shortLabel: 'TP 2 Oscillo 3D',
    icon: '〰️',
    tpId: 'oscilloscope',
    interactRadius: 2.6,
    defaultW: 1.4,
    defaultD: 2.6,
    defaultH: 1.5,
    defaultColor: '#22d3ee',
    collides: true,
    supportTop: 0.84
  },
  {
    type: 'tp_electronics',
    category: 'stations',
    subGroup: 'Bornes de TP (Ateliers 3D)',
    label: 'TP — Breadboard, Multimètre & Résistances 3D',
    shortLabel: 'TP Élec Breadboard',
    icon: '⚡',
    tpId: 'electronics',
    interactRadius: 2.6,
    defaultW: 1.4,
    defaultD: 2.6,
    defaultH: 1.4,
    defaultColor: '#fbbf24',
    collides: true,
    supportTop: 0.84
  },
  {
    type: 'tp_antivirus',
    category: 'stations',
    subGroup: 'Bornes de TP (Ateliers 3D)',
    label: 'TP 5 — Cybersécurité & Défense SOC 3D',
    shortLabel: 'TP 5 Cyber SOC 3D',
    icon: '🛡️',
    tpId: 'antivirus',
    interactRadius: 2.7,
    defaultW: 2.2,
    defaultD: 1.3,
    defaultH: 1.6,
    defaultColor: '#f43f5e',
    collides: true,
    supportTop: 0.82
  },
  {
    type: 'tp_vmvlan',
    category: 'stations',
    subGroup: 'Bornes de TP (Ateliers 3D)',
    label: 'TP 4B — Configuration VLAN 802.1Q, Trunk & Routage 3D',
    shortLabel: 'TP VLAN 802.1Q 3D',
    icon: '🌐',
    tpId: 'vmvlan',
    interactRadius: 2.8,
    defaultW: 1.0,
    defaultD: 2.4,
    defaultH: 2.25,
    defaultColor: '#34d399',
    collides: true
  },
  {
    type: 'tp_patchrack',
    category: 'stations',
    subGroup: 'Bornes de TP (Ateliers 3D)',
    label: 'TP 4A — Sertissage RJ45 & Brassage Baie Serveur 19" 3D',
    shortLabel: 'TP Brassage RJ45 3D',
    icon: '🔌',
    tpId: 'patchrack',
    interactRadius: 2.4,
    defaultW: 1.05,
    defaultD: 0.65,
    defaultH: 2.1,
    defaultColor: '#38bdf8',
    collides: true
  },
  {
    type: 'tp_hardware',
    category: 'stations',
    subGroup: 'Bornes de TP (Ateliers 3D)',
    label: 'TP 3 — Assemblage & Diagnostic PC 3D',
    shortLabel: 'TP 3 Montage PC 3D',
    icon: '🖥️',
    tpId: 'hardware',
    interactRadius: 2.8,
    defaultW: 1.4,
    defaultD: 2.6,
    defaultH: 1.5,
    defaultColor: '#a78bfa',
    collides: true,
    supportTop: 0.84
  },
  {
    type: 'tp_audiovisual',
    category: 'stations',
    subGroup: 'Bornes de TP (Ateliers 3D)',
    label: 'TP 6A — Éclairage Scénique, Câblage XLR & DMX512 3D',
    shortLabel: 'TP DMX512 3D',
    icon: '🎬',
    tpId: 'audiovisual',
    interactRadius: 2.8,
    defaultW: 2.2,
    defaultD: 1.4,
    defaultH: 1.6,
    defaultColor: '#f472b6',
    collides: true,
    supportTop: 0.82
  },
  {
    type: 'tp_studio',
    category: 'stations',
    subGroup: 'Bornes de TP (Ateliers 3D)',
    label: 'TP 6B — Régie Broadcast, Caméra & Mixage Son 3D',
    shortLabel: 'TP Régie Broadcast 3D',
    icon: '🎙️',
    tpId: 'studio',
    interactRadius: 2.7,
    defaultW: 2.2,
    defaultD: 1.3,
    defaultH: 1.5,
    defaultColor: '#e879f9',
    collides: true,
    supportTop: 0.82
  },
  {
    type: 'npc_teacher',
    category: 'stations',
    subGroup: 'PNJ',
    label: 'PNJ Professeur CIEL',
    shortLabel: 'Professeur CIEL',
    icon: '👨‍🏫',
    tpId: 'teacher',
    interactRadius: 3.1,
    defaultW: 1.1,
    defaultD: 1.1,
    defaultH: 2.4,
    defaultColor: '#fbbf24',
    collides: true
  },
  {
    type: 'survival_door',
    category: 'stations',
    subGroup: 'Mode Survie Horreur',
    label: 'Porte de Mini-Jeu Survie',
    shortLabel: 'Porte Survie',
    icon: '🚪',
    interactRadius: 2.6,
    defaultW: 1.7,
    defaultD: 0.42,
    defaultH: 2.7,
    defaultColor: '#e11d48',
    collides: false,
    isSurvivalDoor: true
  },
  {
    type: 'combat_door',
    category: 'stations',
    subGroup: 'Arène de Combat CIEL',
    label: 'Arène de Combat CIEL',
    shortLabel: 'Arène Combat',
    icon: '⚔️',
    interactRadius: 2.6,
    defaultW: 1.7,
    defaultD: 0.42,
    defaultH: 2.7,
    defaultColor: '#06b6d4',
    collides: false,
    isCombatDoor: true
  },
  {
    type: 'chair_student',
    category: 'furniture',
    subGroup: 'Assises & Bureaux',
    label: 'Chaise d’élève / Fauteuil de bureau',
    shortLabel: 'Chaise',
    icon: '🪑',
    defaultW: 0.6,
    defaultD: 0.6,
    defaultH: 0.95,
    defaultColor: '#334155',
    collides: false
  },
  {
    type: 'desk_individual',
    category: 'furniture',
    subGroup: 'Assises & Bureaux',
    label: 'Bureau individuel (PC CIEL OS)',
    shortLabel: 'Bureau élève',
    icon: '🗄️',
    interactRadius: 2.35,
    isPcDesk: true,
    defaultW: 1.4,
    defaultD: 0.78,
    defaultH: 0.78,
    defaultColor: '#1e293b',
    collides: true,
    supportTop: 0.78
  },
  {
    type: 'workbench_large',
    category: 'furniture',
    subGroup: 'Établis & Paillasses',
    label: 'Grand établi d’atelier',
    shortLabel: 'Grand établi',
    icon: '🛠️',
    defaultW: 3.6,
    defaultD: 1.25,
    defaultH: 0.84,
    defaultColor: '#fb923c',
    collides: true,
    supportTop: 0.84
  },
  {
    type: 'elec_bench',
    category: 'furniture',
    subGroup: 'Établis & Paillasses',
    label: 'Paillasse d’électronique',
    shortLabel: 'Paillasse élec',
    icon: '🔋',
    defaultW: 2.8,
    defaultD: 1.05,
    defaultH: 1.45,
    defaultColor: '#22d3ee',
    collides: true,
    supportTop: 0.84
  },
  {
    type: 'network_island',
    category: 'furniture',
    subGroup: 'Îlots & Salles',
    label: 'Îlot central réseau (multipostes CIEL OS)',
    shortLabel: 'Îlot réseau',
    icon: '🔀',
    interactRadius: 2.55,
    isPcDesk: true,
    defaultW: 2.0,
    defaultD: 1.05,
    defaultH: 1.25,
    defaultColor: '#34d399',
    collides: true,
    supportTop: 0.78
  },
  {
    type: 'desk_teacher',
    category: 'furniture',
    subGroup: 'Assises & Bureaux',
    label: 'Bureau professeur (PC CIEL OS)',
    shortLabel: 'Bureau prof',
    icon: '📋',
    interactRadius: 2.45,
    isPcDesk: true,
    defaultW: 1.85,
    defaultD: 0.9,
    defaultH: 0.78,
    defaultColor: '#0284c7',
    collides: true,
    supportTop: 0.78
  },
  {
    type: 'whiteboard',
    category: 'furniture',
    subGroup: 'Salles & Rangement',
    label: 'Tableau blanc / Écran projecteur mural',
    shortLabel: 'Tableau blanc',
    icon: '📽️',
    defaultW: 2.6,
    defaultD: 0.16,
    defaultH: 1.5,
    defaultColor: '#f8fafc',
    collides: false,
    wallMount: true
  },
  {
    type: 'metal_cabinet',
    category: 'furniture',
    subGroup: 'Salles & Rangement',
    label: 'Armoire métallique',
    shortLabel: 'Armoire',
    icon: '🗃️',
    defaultW: 1.2,
    defaultD: 0.56,
    defaultH: 1.95,
    defaultColor: '#64748b',
    collides: true
  },
  {
    type: 'av_greenscreen',
    category: 'tech',
    subGroup: 'Studio Audiovisuel',
    label: 'Fond vert (Green screen sur structure)',
    shortLabel: 'Fond vert',
    icon: '🟩',
    defaultW: 4.0,
    defaultD: 0.9,
    defaultH: 2.85,
    defaultColor: '#16a34a',
    collides: true
  },
  {
    type: 'av_camera',
    category: 'tech',
    subGroup: 'Studio Audiovisuel',
    label: 'Caméra pro sur trépied',
    shortLabel: 'Caméra trépied',
    icon: '📹',
    defaultW: 0.75,
    defaultD: 0.75,
    defaultH: 1.65,
    defaultColor: '#f472b6',
    collides: true
  },
  {
    type: 'av_led_light',
    category: 'tech',
    subGroup: 'Studio Audiovisuel',
    label: 'Projecteur LED sur pied',
    shortLabel: 'Projecteur LED',
    icon: '💡',
    defaultW: 0.65,
    defaultD: 0.65,
    defaultH: 2.05,
    defaultColor: '#fde047',
    collides: true
  },
  {
    type: 'av_mixer',
    category: 'tech',
    subGroup: 'Studio Audiovisuel',
    label: 'Table de mixage / Régie',
    shortLabel: 'Table mixage',
    icon: '🎚️',
    defaultW: 1.1,
    defaultD: 0.62,
    defaultH: 0.25,
    defaultColor: '#a855f7',
    collides: false,
    surfaceProp: true
  },
  {
    type: 'av_mic_stand',
    category: 'tech',
    subGroup: 'Studio Audiovisuel',
    label: 'Micro studio',
    shortLabel: 'Micro studio',
    icon: '🎤',
    defaultW: 0.45,
    defaultD: 0.45,
    defaultH: 1.55,
    defaultColor: '#e879f9',
    collides: false
  },
  {
    type: 'net_rack_19',
    category: 'tech',
    subGroup: 'Réseau & Serveurs',
    label: 'Baie serveur 19 pouces (LEDs animées)',
    shortLabel: 'Baie 19"',
    icon: '🗄️',
    defaultW: 1.0,
    defaultD: 0.6,
    defaultH: 2.15,
    defaultColor: '#10b981',
    collides: true
  },
  {
    type: 'hiding_rack',
    category: 'tech',
    subGroup: 'Mode Survie Horreur',
    label: 'Baie de Brassage (Cachette)',
    shortLabel: 'Baie Cachette',
    icon: '🗄️',
    interactRadius: 2.3,
    defaultW: 1.1,
    defaultD: 0.78,
    defaultH: 2.2,
    defaultColor: '#38bdf8',
    collides: true,
    isHidingSpot: true
  },
  {
    type: 'net_patch_wall',
    category: 'tech',
    subGroup: 'Réseau & Serveurs',
    label: 'Rack de brassage mural',
    shortLabel: 'Rack mural',
    icon: '🧲',
    defaultW: 0.85,
    defaultD: 0.35,
    defaultH: 0.9,
    defaultColor: '#38bdf8',
    collides: false,
    wallMount: true
  },
  {
    type: 'net_switch_stack',
    category: 'tech',
    subGroup: 'Réseau & Serveurs',
    label: 'Routeur / Switch empilé',
    shortLabel: 'Switch L3',
    icon: '📡',
    defaultW: 0.65,
    defaultD: 0.42,
    defaultH: 0.32,
    defaultColor: '#22d3ee',
    collides: false,
    surfaceProp: true
  },
  {
    type: 'net_ups',
    category: 'tech',
    subGroup: 'Réseau & Serveurs',
    label: 'Onduleur (UPS)',
    shortLabel: 'Onduleur',
    icon: '⚡',
    defaultW: 0.52,
    defaultD: 0.56,
    defaultH: 1.4,
    defaultColor: '#f59e0b',
    collides: true
  },
  {
    type: 'pc_gamer_cyber',
    category: 'tech',
    subGroup: 'Hardware & Cyber',
    label: 'PC fixe Gamer/Cyber (boîtier vitré + double écran CIEL OS)',
    shortLabel: 'Poste Cyber',
    icon: '🖥️',
    interactRadius: 2.45,
    isPcDesk: true,
    defaultW: 1.8,
    defaultD: 1.1,
    defaultH: 1.35,
    defaultColor: '#f43f5e',
    collides: true,
    supportTop: 0.78
  },
  {
    type: 'pc_open_maint',
    category: 'tech',
    subGroup: 'Hardware & Cyber',
    label: 'Poste PC ouvert (maintenance & CIEL OS)',
    shortLabel: 'PC Ouvert',
    icon: '🔧',
    interactRadius: 2.45,
    isPcDesk: true,
    defaultW: 1.25,
    defaultD: 1.8,
    defaultH: 1.35,
    defaultColor: '#a78bfa',
    collides: true,
    supportTop: 0.84
  },
  {
    type: 'pc_ciel_os',
    category: 'tech',
    subGroup: 'Hardware & Cyber',
    label: 'Poste PC CIEL OS (Bureau + Arcade Mini-Jeux)',
    shortLabel: 'Poste CIEL OS',
    icon: '🕹️',
    interactRadius: 2.45,
    isPcDesk: true,
    defaultW: 1.5,
    defaultD: 0.85,
    defaultH: 1.35,
    defaultColor: '#38bdf8',
    collides: true,
    supportTop: 0.78
  },
  {
    type: 'soc_wall_screen',
    category: 'tech',
    subGroup: 'Hardware & Cyber',
    label: 'Écran de monitoring SOC mural',
    shortLabel: 'Écran SOC',
    icon: '📺',
    defaultW: 3.6,
    defaultD: 0.16,
    defaultH: 1.65,
    defaultColor: '#f43f5e',
    collides: false,
    wallMount: true
  },
  {
    type: 'elec_solder_unit',
    category: 'tech',
    subGroup: 'Électronique',
    label: 'Station de soudure / Fer à souder',
    shortLabel: 'Station soudure',
    icon: '🔥',
    defaultW: 0.42,
    defaultD: 0.36,
    defaultH: 0.28,
    defaultColor: '#fb923c',
    collides: false,
    surfaceProp: true
  },
  {
    type: 'elec_scope_unit',
    category: 'tech',
    subGroup: 'Électronique',
    label: 'Oscilloscope numérique sur table',
    shortLabel: 'Oscilloscope',
    icon: '📈',
    defaultW: 0.56,
    defaultD: 0.36,
    defaultH: 0.34,
    defaultColor: '#facc15',
    collides: false,
    surfaceProp: true
  },
  {
    type: 'elec_multimeter',
    category: 'tech',
    subGroup: 'Électronique',
    label: 'Multimètre',
    shortLabel: 'Multimètre',
    icon: '📟',
    defaultW: 0.24,
    defaultD: 0.3,
    defaultH: 0.12,
    defaultColor: '#eab308',
    collides: false,
    surfaceProp: true
  },
  {
    type: 'elec_fume_extractor',
    category: 'tech',
    subGroup: 'Électronique',
    label: 'Extracteur de fumée',
    shortLabel: 'Extracteur',
    icon: '💨',
    defaultW: 0.42,
    defaultD: 0.36,
    defaultH: 0.36,
    defaultColor: '#94a3b8',
    collides: false,
    surfaceProp: true
  }
];

export const CATALOG_BY_TYPE = new Map(MAP_ITEM_CATALOG.map((item) => [item.type, item]));

export function getCatalogItem(type) {
  return CATALOG_BY_TYPE.get(type) || null;
}

export function isPcDeskObject(objOrType) {
  const type = typeof objOrType === 'string' ? objOrType : objOrType?.type;
  const cat = getCatalogItem(type);
  return Boolean(cat?.isPcDesk);
}

function clampNum(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function cleanColor(c, fallback = '#38bdf8') {
  return /^#[0-9a-fA-F]{6}$/.test(String(c || '').trim()) ? String(c).trim() : fallback;
}

export function getZonePolygonPoints(zone) {
  if (Array.isArray(zone?.points) && zone.points.length >= 3) {
    return zone.points.map((p) => ({
      x: Number(p.x) || 0,
      z: Number(p.z) || 0
    }));
  }
  const cx = Number(zone?.x) || 0;
  const cz = Number(zone?.z) || 0;
  const hw = Math.max(0.4, (Number(zone?.w ?? zone?.width) || 4) / 2);
  const hd = Math.max(0.4, (Number(zone?.d ?? zone?.depth) || 4) / 2);
  return [
    { x: Number((cx - hw).toFixed(2)), z: Number((cz - hd).toFixed(2)) },
    { x: Number((cx + hw).toFixed(2)), z: Number((cz - hd).toFixed(2)) },
    { x: Number((cx + hw).toFixed(2)), z: Number((cz + hd).toFixed(2)) },
    { x: Number((cx - hw).toFixed(2)), z: Number((cz + hd).toFixed(2)) }
  ];
}

export function computePolygonArea(points = []) {
  if (!Array.isArray(points) || points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.z - b.x * a.z;
  }
  return Math.abs(sum) * 0.5;
}

export function computePolygonCentroid(points = []) {
  if (!Array.isArray(points) || points.length === 0) return { x: 0, z: 0 };
  if (points.length < 3) {
    const sx = points.reduce((s, p) => s + p.x, 0) / points.length;
    const sz = points.reduce((s, p) => s + p.z, 0) / points.length;
    return { x: Number(sx.toFixed(2)), z: Number(sz.toFixed(2)) };
  }
  let signedArea = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < points.length; i++) {
    const p0 = points[i];
    const p1 = points[(i + 1) % points.length];
    const cross = p0.x * p1.z - p1.x * p0.z;
    signedArea += cross;
    cx += (p0.x + p1.x) * cross;
    cz += (p0.z + p1.z) * cross;
  }
  signedArea *= 0.5;
  if (Math.abs(signedArea) < 1e-5) {
    const sx = points.reduce((s, p) => s + p.x, 0) / points.length;
    const sz = points.reduce((s, p) => s + p.z, 0) / points.length;
    return { x: Number(sx.toFixed(2)), z: Number(sz.toFixed(2)) };
  }
  return {
    x: Number((cx / (6 * signedArea)).toFixed(2)),
    z: Number((cz / (6 * signedArea)).toFixed(2))
  };
}

export function isPointInPolygon(px, pz, points = []) {
  if (!Array.isArray(points) || points.length < 3) return false;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const zi = points[i].z;
    const xj = points[j].x;
    const zj = points[j].z;
    const intersect =
      (zi > pz) !== (zj > pz) &&
      px < ((xj - xi) * (pz - zi)) / (zj - zi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function cleanText(raw, maxLen = 80, fallback = '') {
  const txt = String(raw ?? fallback)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLen);
  return txt || fallback;
}

export function createDefaultMap() {
  const walls = [];
  const legacy = buildPlateauWalls();
  let wallIdx = 1;

  for (const seg of legacy) {
    if (seg.type === 'plaque') continue;
    if (seg.type === 'diagonal' || seg.type === 'diagonalDoor') {
      walls.push({
        id: `w-${wallIdx++}`,
        kind: seg.type === 'diagonalDoor' ? 'door_single' : seg.style === 'glazed' ? 'glazed' : 'solid',
        x1: Number(seg.x1.toFixed(2)),
        z1: Number(seg.z1.toFixed(2)),
        x2: Number(seg.x2.toFixed(2)),
        z2: Number(seg.z2.toFixed(2)),
        thickness: Number((seg.thickness || 0.18).toFixed(2)),
        height: WORLD_BOUNDS.height,
        color: seg.type === 'diagonalDoor' ? '#0ea5e9' : seg.style === 'glazed' ? '#38bdf8' : '#1e293b',
        doorLabel: seg.sign || ''
      });
      continue;
    }

    const isX = seg.axis === 'z';
    const x1 = isX ? seg.from : seg.fixed;
    const z1 = isX ? seg.fixed : seg.from;
    const x2 = isX ? seg.to : seg.fixed;
    const z2 = isX ? seg.fixed : seg.to;
    const isDoor = seg.style === 'lintel';
    const len = Math.hypot(x2 - x1, z2 - z1);
    const kind = isDoor
      ? len >= 1.65
        ? 'door_double'
        : 'door_single'
      : seg.style === 'glazed' || seg.style === 'stairSouth'
        ? 'glazed'
        : 'solid';

    walls.push({
      id: `w-${wallIdx++}`,
      kind,
      x1: Number(x1.toFixed(2)),
      z1: Number(z1.toFixed(2)),
      x2: Number(x2.toFixed(2)),
      z2: Number(z2.toFixed(2)),
      thickness: Number((seg.thickness || 0.18).toFixed(2)),
      height: WORLD_BOUNDS.height,
      color: isDoor ? '#0ea5e9' : kind === 'glazed' ? '#38bdf8' : '#1e293b',
      doorLabel: seg.sign || ''
    });
  }

  const zones = PLATEAU_ZONES.filter((z) => z.id !== 'U300' && z.id !== 'ESCALIER').map((z) => ({
    id: z.id,
    code: z.code,
    shortName: z.shortName,
    fullLabel: z.fullLabel,
    badgeText: z.badgeText,
    color: z.color,
    x: Number(((z.bounds.minX + z.bounds.maxX) / 2).toFixed(2)),
    z: Number(((z.bounds.minZ + z.bounds.maxZ) / 2).toFixed(2)),
    w: Number((z.bounds.maxX - z.bounds.minX).toFixed(2)),
    d: Number((z.bounds.maxZ - z.bounds.minZ).toFixed(2))
  }));

  const boxById = new Map(PLATEAU_FURNITURE_BOXES.map((b) => [b.id, b]));
  const objects = [
    {
      id: 'obj-spawn',
      type: 'spawn_point',
      x: PLATEAU_SPAWN.x,
      z: PLATEAU_SPAWN.z,
      rotation: 270,
      w: 1.0,
      d: 1.0,
      color: '#10b981',
      label: 'Spawn Hall U300'
    },
    {
      id: 'obj-leaderboard',
      type: 'leaderboard',
      x: -2.51,
      z: 0.28,
      rotation: 270,
      w: 3.45,
      d: 0.24,
      color: '#06b6d4',
      label: 'Classement Live'
    },
    {
      id: 'obj-mapboard-north',
      type: 'wall_map_board',
      x: -7.5,
      z: -3.07,
      rotation: 0,
      w: 2.86,
      d: 0.14,
      color: '#38bdf8',
      label: 'Plan U300 Nord'
    },
    {
      id: 'obj-mapboard-south',
      type: 'wall_map_board',
      x: -0.3,
      z: 2.24,
      rotation: 0,
      w: 2.86,
      d: 0.14,
      color: '#38bdf8',
      label: 'Plan U300 Sud'
    },
    {
      id: 'obj-stair-central',
      type: 'stair_block',
      x: -0.3,
      z: 0.28,
      rotation: 0,
      w: 4.2,
      d: 3.66,
      color: '#64748b',
      label: 'Cage d’escalier'
    },
    {
      id: 'obj-teacher',
      type: 'npc_teacher',
      x: PLATEAU_TEACHER_POS.x,
      z: PLATEAU_TEACHER_POS.z,
      rotation: 0,
      w: 1.1,
      d: 1.1,
      color: '#fbbf24',
      label: 'Professeur CIEL',
      dialogue: ''
    },
    {
      id: 'obj-tp-soldering',
      type: 'tp_soldering',
      x: TP_STATION_LAYOUT.soldering.position.x,
      z: TP_STATION_LAYOUT.soldering.position.z,
      rotation: 90,
      w: 2.8,
      d: 1.5,
      color: '#fb923c',
      label: 'TP Brasure (U301)'
    },
    {
      id: 'obj-tp-oscilloscope',
      type: 'tp_oscilloscope',
      x: TP_STATION_LAYOUT.oscilloscope.position.x,
      z: TP_STATION_LAYOUT.oscilloscope.position.z,
      rotation: 90,
      w: 2.6,
      d: 1.4,
      color: '#22d3ee',
      label: 'TP Oscilloscope (U302)'
    },
    {
      id: 'obj-tp-electronics',
      type: 'tp_electronics',
      x: TP_STATION_LAYOUT.electronics.position.x,
      z: TP_STATION_LAYOUT.electronics.position.z,
      rotation: 270,
      w: 2.6,
      d: 1.4,
      color: '#fbbf24',
      label: 'TP Électronique (U302)'
    },
    {
      id: 'obj-tp-antivirus',
      type: 'tp_antivirus',
      x: TP_STATION_LAYOUT.antivirus.position.x,
      z: TP_STATION_LAYOUT.antivirus.position.z,
      rotation: 180,
      w: 2.2,
      d: 1.3,
      color: '#f43f5e',
      label: 'TP Antivirus SOC (U305)'
    },
    {
      id: 'obj-tp-vmvlan',
      type: 'tp_vmvlan',
      x: TP_STATION_LAYOUT.vmvlan.position.x,
      z: TP_STATION_LAYOUT.vmvlan.position.z,
      rotation: 90,
      w: 2.4,
      d: 1.0,
      color: '#34d399',
      label: 'TP VM & VLAN (U307)'
    }
  ];

  const extraTypeMap = {
    patchrack: 'tp_patchrack',
    hardware: 'tp_hardware',
    audiovisual: 'tp_audiovisual',
    studio: 'tp_studio'
  };
  for (const st of EXTRA_STATIONS) {
    const b = boxById.get(st.id);
    const isRot90 = st.id === 'hardware';
    const isRot180 = st.id === 'patchrack';
    const rw = isRot90 ? b?.d || 2.6 : b?.w || 1.5;
    const rd = isRot90 ? b?.w || 1.4 : b?.d || 1.3;
    objects.push({
      id: `obj-tp-${st.id}`,
      type: extraTypeMap[st.id] || 'tp_patchrack',
      x: st.position.x,
      z: st.position.z,
      rotation: isRot90 ? 90 : isRot180 ? 180 : 0,
      w: rw,
      d: rd,
      color: st.color,
      label: `${st.shortTitle} (${st.room})`
    });
  }

  const decorMap = [
    ['u301_west', 'workbench_large', 90, '#fb923c', 'Établi Brasure Ouest'],
    ['u301_north', 'workbench_large', 0, '#fb923c', 'Établi Brasure Nord'],
    ['u302_north', 'elec_bench', 0, '#22d3ee', 'Paillasse Mesures U302'],
    ['u303_greenscreen', 'av_greenscreen', 0, '#16a34a', 'Fond vert U303'],
    ['u303_cam1', 'av_camera', 180, '#f472b6', 'Caméra 1'],
    ['u303_cam2', 'av_camera', 180, '#f472b6', 'Caméra 2'],
    ['u304_booth1', 'desk_individual', 0, '#e879f9', 'Cabine Studio 1'],
    ['u304_booth2', 'desk_individual', 0, '#e879f9', 'Cabine Studio 2'],
    ['u304_booth3', 'desk_individual', 0, '#e879f9', 'Cabine Studio 3'],
    ['u304_booth4', 'desk_individual', 0, '#e879f9', 'Cabine Studio 4'],
    ['chambre_rack1', 'net_rack_19', 180, '#10b981', 'Baie 19" A'],
    ['chambre_rack3', 'net_rack_19', 180, '#10b981', 'Baie 19" C'],
    ['chambre_ups', 'net_ups', 180, '#f59e0b', 'Onduleur Chambre'],
    ['chambre_clim', 'metal_cabinet', 180, '#94a3b8', 'Climatisation Chambre'],
    ['u309_rack', 'net_rack_19', 90, '#38bdf8', 'Baie U309'],
    ['u311_panel', 'net_patch_wall', 90, '#f59e0b', 'Brassage U311'],
    ['u307_il1', 'network_island', 0, '#34d399', 'Îlot 069/070'],
    ['u307_il2', 'network_island', 0, '#34d399', 'Îlot 071/072'],
    ['u307_il3', 'network_island', 0, '#34d399', 'Îlot 073/074'],
    ['u307_il4', 'network_island', 0, '#34d399', 'Îlot 075/076'],
    ['u307_il5', 'network_island', 0, '#34d399', 'Îlot 077/078'],
    ['u307_il6', 'network_island', 0, '#34d399', 'Îlot 079/080'],
    ['u306_diag', 'pc_open_maint', 270, '#a78bfa', 'Banc Diagnostic PC'],
    ['u306_shelf', 'metal_cabinet', 180, '#64748b', 'Armoire Stockage U306'],
    ['u305_desk1', 'pc_gamer_cyber', 0, '#f43f5e', 'Poste SOC 1'],
    ['u305_desk2', 'pc_gamer_cyber', 0, '#f43f5e', 'Poste SOC 2'],
    ['u305_desk3', 'pc_gamer_cyber', 0, '#f43f5e', 'Poste SOC 3'],
    ['u305_desk4', 'pc_gamer_cyber', 0, '#f43f5e', 'Poste SOC 4']
  ];
  for (const [boxId, type, rotation, color, label] of decorMap) {
    const b = boxById.get(boxId);
    if (!b) continue;
    const swapDims = rotation === 90 || rotation === 270;
    objects.push({
      id: `obj-${boxId}`,
      type,
      x: b.x,
      z: b.z,
      rotation,
      w: swapDims ? b.d : b.w,
      d: swapDims ? b.w : b.d,
      color,
      label
    });
  }

  objects.push({
    id: 'obj-u305-soc-screen',
    type: 'soc_wall_screen',
    x: 7.8,
    z: 11.98,
    rotation: 180,
    w: 3.8,
    d: 0.16,
    color: '#f43f5e',
    label: 'Mur SOC U305'
  });

  objects.push({
    id: 'obj-survival-door',
    type: 'survival_door',
    x: 0.6,
    z: -1.85,
    rotation: 180,
    w: 1.7,
    d: 0.42,
    color: '#e11d48',
    label: 'Porte Survie Horreur'
  });

  objects.push({
    id: 'obj-combat-door',
    type: 'combat_door',
    x: -1.3,
    z: -1.85,
    rotation: 180,
    w: 1.7,
    d: 0.42,
    color: '#06b6d4',
    label: '⚔️ ARÈNE DE COMBAT CIEL'
  });

  const hidingRacks = [
    ['obj-hide-u301', -11.8, -4.0, 90, 'Baie Cachette U301'],
    ['obj-hide-u302', 1.65, -4.1, 270, 'Baie Cachette U302'],
    ['obj-hide-u303', 12.1, -4.1, 270, 'Baie Cachette U303'],
    ['obj-hide-u304', 12.2, -2.4, 270, 'Baie Cachette U304'],
    ['obj-hide-u305', 12.1, 4.5, 270, 'Baie Cachette U305'],
    ['obj-hide-u306', -2.2, 4.5, 90, 'Baie Cachette U306'],
    ['obj-hide-u307', -12.1, 11.4, 0, 'Baie Cachette U307']
  ];
  for (const [id, hx, hz, rot, label] of hidingRacks) {
    objects.push({
      id,
      type: 'hiding_rack',
      x: hx,
      z: hz,
      rotation: rot,
      w: 1.1,
      d: 0.78,
      color: '#38bdf8',
      label
    });
  }

  return normalizeMapData({
    version: 1,
    name: 'Plateau U300 — Filière CIEL',
    bounds: WORLD_BOUNDS,
    spawn: {
      x: PLATEAU_SPAWN.x,
      y: PLATEAU_SPAWN.y,
      z: PLATEAU_SPAWN.z,
      yaw: -1.35
    },
    zones,
    walls,
    objects
  });
}

export function createEmptyMap() {
  const hw = 13;
  const hd = 12.2;
  return normalizeMapData({
    version: 1,
    name: 'Nouvelle Carte Sandbox CIEL',
    bounds: WORLD_BOUNDS,
    spawn: { x: 0, y: 1.68, z: 4, yaw: 0 },
    zones: [
      {
        id: 'Z1',
        code: 'U300',
        shortName: 'Zone Principale',
        fullLabel: 'Zone Principale Atelier CIEL',
        badgeText: '📍 U300 - Zone Principale',
        color: '#38bdf8',
        x: 0,
        z: 0,
        w: 16,
        d: 14
      }
    ],
    walls: [
      { id: 'w-north', kind: 'solid', x1: -hw, z1: -hd, x2: hw, z2: -hd, thickness: 0.28, height: 4.6, color: '#1e293b', doorLabel: '' },
      { id: 'w-south', kind: 'solid', x1: -hw, z1: hd, x2: hw, z2: hd, thickness: 0.28, height: 4.6, color: '#1e293b', doorLabel: '' },
      { id: 'w-west', kind: 'solid', x1: -hw, z1: -hd, x2: -hw, z2: hd, thickness: 0.28, height: 4.6, color: '#1e293b', doorLabel: '' },
      { id: 'w-east', kind: 'solid', x1: hw, z1: -hd, x2: hw, z2: hd, thickness: 0.28, height: 4.6, color: '#1e293b', doorLabel: '' }
    ],
    objects: [
      {
        id: 'obj-spawn',
        type: 'spawn_point',
        x: 0,
        z: 4,
        rotation: 0,
        w: 1.0,
        d: 1.0,
        color: '#10b981',
        label: 'Spawn'
      },
      {
        id: 'obj-teacher',
        type: 'npc_teacher',
        x: 0,
        z: -1.5,
        rotation: 0,
        w: 1.1,
        d: 1.1,
        color: '#fbbf24',
        label: 'Professeur CIEL',
        dialogue: ''
      },
      {
        id: 'obj-leaderboard',
        type: 'leaderboard',
        x: 0,
        z: -11.95,
        rotation: 0,
        w: 3.45,
        d: 0.24,
        color: '#06b6d4',
        label: 'Classement Live'
      }
    ]
  });
}

export function createCampusMap(size = DEFAULT_CAMPUS_SIZE) {
  const s = clampNum(size, 60, MAX_MAP_SIZE, DEFAULT_CAMPUS_SIZE);
  const half = s / 2;
  return normalizeMapData({
    version: 2,
    name: `Campus Lycée CIEL ${s}m × ${s}m`,
    floorHeight: DEFAULT_FLOOR_HEIGHT,
    bounds: {
      minX: -half,
      maxX: half,
      minZ: -half,
      maxZ: half,
      width: s,
      depth: s,
      height: DEFAULT_FLOOR_HEIGHT
    },
    floors: [
      { index: 0, label: 'RDC (0)', hasFullSlab: true, hasCeiling: false }
    ],
    spawn: { x: 0, y: 1.68, z: 4, yaw: 0, floor: 0 },
    bookmarks: [
      { id: 'bm-center', label: 'Atelier CIEL (Centre)', x: 0, z: 0, floor: 0, zoom: 14 },
      { id: 'bm-cour', label: 'Cour Centrale', x: 0, z: 36, floor: 0, zoom: 6 }
    ],
    zones: [],
    walls: [],
    objects: [
      {
        id: 'obj-spawn',
        type: 'spawn_point',
        floor: 0,
        x: 0,
        z: 4,
        rotation: 0,
        w: 1.0,
        d: 1.0,
        color: '#10b981',
        label: 'Spawn Campus'
      }
    ]
  });
}

export function normalizeMapData(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const bSrc = src.bounds && typeof src.bounds === 'object' ? src.bounds : {};
  const width = clampNum(bSrc.width, 8, MAX_MAP_SIZE, 26);
  const depth = clampNum(bSrc.depth, 8, MAX_MAP_SIZE, 24.4);
  const minX = -width / 2;
  const maxX = width / 2;
  const minZ = -depth / 2;
  const maxZ = depth / 2;

  const rawWalls = Array.isArray(src.walls) ? src.walls : [];
  const rawZones = Array.isArray(src.zones) ? src.zones : [];
  const rawObjects = Array.isArray(src.objects) ? src.objects : [];
  const rawOpenings = Array.isArray(src.openings) ? src.openings : [];
  const rawFloorsInput = Array.isArray(src.floors) ? src.floors : [];

  const hasMultiFloor =
    rawFloorsInput.length > 1 ||
    rawFloorsInput.some((f) => clampFloor(typeof f === 'object' ? f?.index : f) !== 0) ||
    rawWalls.some((w) => w && w.floor !== undefined && clampFloor(w.floor) !== 0) ||
    rawZones.some((z) => z && z.floor !== undefined && clampFloor(z.floor) !== 0) ||
    rawOpenings.some((op) => op && op.floor !== undefined && clampFloor(op.floor) !== 0) ||
    rawObjects.some((o) => {
      if (!o || typeof o !== 'object') return false;
      if (o.floor !== undefined && clampFloor(o.floor) !== 0) return true;
      const c = getCatalogItem(o.type);
      return Boolean(c?.isStair || c?.isOpening || c?.isSlab);
    }) ||
    src.floorHeight !== undefined ||
    bSrc.floorHeight !== undefined;

  const defaultH = hasMultiFloor ? DEFAULT_FLOOR_HEIGHT : 4.6;
  const fallbackFh = bSrc.height !== undefined ? clampNum(bSrc.height, 2.8, 6.0, defaultH) : defaultH;
  const floorHeight = Number(clampNum(src.floorHeight ?? bSrc.floorHeight, 2.8, 6.0, fallbackFh).toFixed(2));
  const height = Number(clampNum(bSrc.height, 2.8, 12, floorHeight).toFixed(2));

  const validKinds = new Set([
    'solid',
    'glazed',
    'exterior',
    'window_bay',
    'railing',
    'door_single',
    'door_double'
  ]);
  const walls = [];
  for (let i = 0; i < rawWalls.length && i < 50000; i++) {
    const w = rawWalls[i];
    if (!w || typeof w !== 'object') continue;
    const x1 = clampNum(w.x1, minX - 1, maxX + 1, 0);
    const z1 = clampNum(w.z1, minZ - 1, maxZ + 1, 0);
    const x2 = clampNum(w.x2, minX - 1, maxX + 1, 0);
    const z2 = clampNum(w.z2, minZ - 1, maxZ + 1, 0);
    if (Math.hypot(x2 - x1, z2 - z1) < 0.15) continue;
    const kind = validKinds.has(w.kind) ? w.kind : 'solid';
    const floor = clampFloor(w.floor ?? 0);
    const defThick = kind === 'exterior' ? 0.3 : kind === 'railing' ? 0.12 : 0.18;
    const wHeight =
      kind === 'railing'
        ? clampNum(w.height, 0.7, 1.8, 1.08)
        : clampNum(w.height, 2.2, Math.max(height, floorHeight), height);
    walls.push({
      id: cleanText(w.id, 36, `w-${i + 1}`),
      floor,
      kind,
      x1: Number(x1.toFixed(2)),
      z1: Number(z1.toFixed(2)),
      x2: Number(x2.toFixed(2)),
      z2: Number(z2.toFixed(2)),
      thickness: Number(clampNum(w.thickness, 0.08, 0.8, defThick).toFixed(2)),
      height: Number(wHeight.toFixed(2)),
      color: cleanColor(
        w.color,
        kind === 'glazed' || kind === 'window_bay'
          ? '#38bdf8'
          : kind === 'railing'
            ? '#94a3b8'
            : kind === 'exterior'
              ? '#334155'
              : '#1e293b'
      ),
      doorLabel: cleanText(w.doorLabel, 48, '')
    });
  }

  const validSurfaces = new Set(['asphalt', 'concrete', 'grass', 'path', 'sport']);
  const zones = [];
  for (let i = 0; i < rawZones.length && i < 4000; i++) {
    const z = rawZones[i];
    if (!z || typeof z !== 'object') continue;
    const floor = clampFloor(z.floor ?? 0);
    const outdoor = Boolean(z.outdoor || z.isOutdoor);
    const surfaceKind = validSurfaces.has(z.surfaceKind) ? z.surfaceKind : '';
    const code = cleanText(z.code, 16, outdoor ? 'COUR' : `Z${i + 1}`);
    const shortName = cleanText(z.shortName, 28, outdoor ? 'Cour Extérieure' : 'Salle CIEL');
    const color = cleanColor(z.color, outdoor ? '#22c55e' : '#38bdf8');
    const baseZone = {
      id: cleanText(z.id, 32, `zone-${i + 1}`),
      floor,
      outdoor,
      code,
      shortName,
      fullLabel: cleanText(z.fullLabel, 64, `${code} - ${shortName}`),
      badgeText: cleanText(z.badgeText, 44, `📍 ${code} - ${shortName}`),
      color
    };
    if (surfaceKind) {
      baseZone.surfaceKind = surfaceKind;
    }

    if (Array.isArray(z.points) && z.points.length >= 3) {
      const pts = [];
      let bMinX = Infinity;
      let bMaxX = -Infinity;
      let bMinZ = Infinity;
      let bMaxZ = -Infinity;
      for (const p of z.points) {
        if (!p || typeof p !== 'object') continue;
        const px = Number(clampNum(p.x, minX, maxX, 0).toFixed(2));
        const pz = Number(clampNum(p.z, minZ, maxZ, 0).toFixed(2));
        pts.push({ x: px, z: pz });
        if (px < bMinX) bMinX = px;
        if (px > bMaxX) bMaxX = px;
        if (pz < bMinZ) bMinZ = pz;
        if (pz > bMaxZ) bMaxZ = pz;
      }
      if (pts.length >= 3) {
        const centroid = computePolygonCentroid(pts);
        zones.push({
          ...baseZone,
          x: centroid.x,
          z: centroid.z,
          w: Number(Math.max(0.8, bMaxX - bMinX).toFixed(2)),
          d: Number(Math.max(0.8, bMaxZ - bMinZ).toFixed(2)),
          points: pts
        });
        continue;
      }
    }

    const zw = clampNum(z.w ?? z.width, 0.8, width, 4);
    const zd = clampNum(z.d ?? z.depth, 0.8, depth, 4);
    const zx = clampNum(z.x, minX, maxX, 0);
    const zz = clampNum(z.z, minZ, maxZ, 0);
    zones.push({
      ...baseZone,
      x: Number(zx.toFixed(2)),
      z: Number(zz.toFixed(2)),
      w: Number(zw.toFixed(2)),
      d: Number(zd.toFixed(2))
    });
  }

  const objects = [];
  let spawnFromObjects = null;
  const maxObjW = Math.max(120, width);
  const maxObjD = Math.max(120, depth);
  for (let i = 0; i < rawObjects.length && i < 50000; i++) {
    const o = rawObjects[i];
    if (!o || typeof o !== 'object') continue;
    const cat = getCatalogItem(o.type);
    if (!cat) continue;
    const floor = clampFloor(o.floor ?? 0);
    const ox = clampNum(o.x, minX, maxX, 0);
    const oz = clampNum(o.z, minZ, maxZ, 0);
    const rotDeg = ((Number(o.rotation) || 0) % 360 + 360) % 360;
    const ow = clampNum(o.w, 0.2, maxObjW, cat.defaultW);
    const od = clampNum(o.d, 0.1, maxObjD, cat.defaultD);
    const normObj = {
      id: cleanText(o.id, 36, `obj-${i + 1}`),
      floor,
      type: cat.type,
      x: Number(ox.toFixed(2)),
      z: Number(oz.toFixed(2)),
      rotation: Number(rotDeg.toFixed(1)),
      w: Number(ow.toFixed(2)),
      d: Number(od.toFixed(2)),
      color: cleanColor(o.color, cat.defaultColor),
      label: cleanText(o.label, 48, cat.shortLabel),
      dialogue: o.dialogue ? cleanText(o.dialogue, 420, '') : ''
    };
    if (cat.isStair) {
      const defTarget = floor < MAX_FLOOR ? floor + 1 : floor - 1;
      normObj.stairStyle = o.stairStyle || cat.stairStyle || 'straight';
      normObj.targetFloor = clampFloor(o.targetFloor ?? defTarget);
      normObj.steps = Math.round(clampNum(o.steps, 8, 28, 16));
      normObj.hasRailings = o.hasRailings !== false;
      normObj.turnDir = Number(o.turnDir) === -1 ? -1 : 1;
      normObj.autoOpening = o.autoOpening !== false;
    }
    if (cat.type === 'spawn_point') {
      spawnFromObjects = normObj;
    }
    objects.push(normObj);
  }

  const openings = [];
  for (let i = 0; i < rawOpenings.length && i < 3000; i++) {
    const op = rawOpenings[i];
    if (!op || typeof op !== 'object') continue;
    const floor = clampFloor(op.floor ?? 0);
    openings.push({
      id: cleanText(op.id, 36, `open-${i + 1}`),
      floor,
      x: Number(clampNum(op.x, minX, maxX, 0).toFixed(2)),
      z: Number(clampNum(op.z, minZ, maxZ, 0).toFixed(2)),
      w: Number(clampNum(op.w, 0.5, width, 2.2).toFixed(2)),
      d: Number(clampNum(op.d, 0.5, depth, 4.2).toFixed(2)),
      rotation: Number((((Number(op.rotation) || 0) % 360 + 360) % 360).toFixed(1)),
      autoFromStairId: op.autoFromStairId ? cleanText(op.autoFromStairId, 36, '') : ''
    });
  }

  const rawBookmarks = Array.isArray(src.bookmarks) ? src.bookmarks : [];
  const bookmarks = [];
  for (let i = 0; i < rawBookmarks.length && i < 64; i++) {
    const bm = rawBookmarks[i];
    if (!bm || typeof bm !== 'object') continue;
    bookmarks.push({
      id: cleanText(bm.id, 36, `bm-${i + 1}`),
      label: cleanText(bm.label, 36, `Repère ${i + 1}`),
      x: Number(clampNum(bm.x, minX, maxX, 0).toFixed(2)),
      z: Number(clampNum(bm.z, minZ, maxZ, 0).toFixed(2)),
      floor: clampFloor(bm.floor ?? 0),
      zoom: Number(clampNum(bm.zoom, 0.22, 220, 12).toFixed(2))
    });
  }

  const floorMetaMap = new Map();
  const ensureFloor = (fl, overrides = null) => {
    const idx = clampFloor(fl);
    if (!floorMetaMap.has(idx)) {
      floorMetaMap.set(idx, {
        index: idx,
        label: formatFloorLabel(idx),
        hasFullSlab: true,
        hasCeiling: true
      });
    }
    if (overrides && typeof overrides === 'object') {
      const cur = floorMetaMap.get(idx);
      const customLabel =
        typeof overrides.label === 'string' && overrides.label.trim()
          ? overrides.label
          : typeof overrides.name === 'string' && overrides.name.trim()
            ? overrides.name
            : '';
      if (customLabel) {
        cur.label = cleanText(customLabel, 32, cur.label);
      }
      if (overrides.hasFullSlab !== undefined) cur.hasFullSlab = Boolean(overrides.hasFullSlab);
      if (overrides.hasCeiling !== undefined) cur.hasCeiling = Boolean(overrides.hasCeiling);
    }
  };
  ensureFloor(0);
  for (const rf of rawFloorsInput) {
    if (typeof rf === 'number') ensureFloor(rf);
    else if (rf && typeof rf === 'object') ensureFloor(rf.index ?? rf.floor ?? 0, rf);
  }
  for (const w of walls) ensureFloor(w.floor);
  for (const z of zones) ensureFloor(z.floor);
  for (const o of objects) {
    ensureFloor(o.floor);
    if (o.targetFloor !== undefined) ensureFloor(o.targetFloor);
  }
  for (const op of openings) ensureFloor(op.floor);

  const floors = [...floorMetaMap.values()].sort((a, b) => a.index - b.index);

  const spSrc = src.spawn && typeof src.spawn === 'object' ? src.spawn : {};
  const spFloor = spawnFromObjects ? spawnFromObjects.floor : clampFloor(spSrc.floor ?? 0);
  const spX = spawnFromObjects ? spawnFromObjects.x : clampNum(spSrc.x, minX + 0.6, maxX - 0.6, 0);
  const spZ = spawnFromObjects ? spawnFromObjects.z : clampNum(spSrc.z, minZ + 0.6, maxZ - 0.6, 2);
  const spYaw = spawnFromObjects
    ? (-(spawnFromObjects.rotation * Math.PI) / 180)
    : Number.isFinite(Number(spSrc.yaw))
      ? Number(spSrc.yaw)
      : 0;
  const spY = Number((spFloor * floorHeight + 1.68).toFixed(2));

  const out = {
    version: floors.length > 1 || hasMultiFloor ? 2 : 1,
    name: cleanText(src.name, 64, 'Carte Atelier CIEL 3D'),
    updatedAt: src.updatedAt || new Date().toISOString(),
    floorHeight,
    bounds: { minX, maxX, minZ, maxZ, width, depth, height },
    floors,
    spawn: {
      x: Number(spX.toFixed(2)),
      y: spY,
      z: Number(spZ.toFixed(2)),
      yaw: Number(spYaw.toFixed(3)),
      floor: spFloor
    },
    zones,
    walls,
    objects
  };
  if (openings.length > 0) {
    out.openings = openings;
  }
  if (bookmarks.length > 0) {
    out.bookmarks = bookmarks;
  }
  return out;
}

export function subtractDoorsFromWalls(walls = []) {
  const doors = walls.filter((w) => w.kind === 'door_single' || w.kind === 'door_double');
  const resolved = [...doors];

  for (const w of walls) {
    if (w.kind === 'door_single' || w.kind === 'door_double') continue;
    const wFloor = clampFloor(w.floor ?? 0);
    const dx = w.x2 - w.x1;
    const dz = w.z2 - w.z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.15) continue;
    const ux = dx / len;
    const uz = dz / len;
    const cuts = [];

    for (const d of doors) {
      if (clampFloor(d.floor ?? 0) !== wFloor) continue;
      const ddx = d.x2 - d.x1;
      const ddz = d.z2 - d.z1;
      const dLen = Math.hypot(ddx, ddz);
      if (dLen < 0.2) continue;
      const dux = ddx / dLen;
      const duz = ddz / dLen;
      const dotAlign = Math.abs(dux * ux + duz * uz);
      if (dotAlign < 0.92) continue;
      const mx = (d.x1 + d.x2) / 2;
      const mz = (d.z1 + d.z2) / 2;
      const perpDist = Math.abs((mx - w.x1) * -uz + (mz - w.z1) * ux);
      if (perpDist > 0.32) continue;

      const t1 = (d.x1 - w.x1) * ux + (d.z1 - w.z1) * uz;
      const t2 = (d.x2 - w.x1) * ux + (d.z2 - w.z1) * uz;
      const cStart = Math.max(0, Math.min(t1, t2));
      const cEnd = Math.min(len, Math.max(t1, t2));
      if (cEnd - cStart > 0.15) {
        cuts.push([cStart, cEnd]);
      }
    }

    if (cuts.length === 0) {
      resolved.push(w);
      continue;
    }

    cuts.sort((a, b) => a[0] - b[0]);
    const merged = [cuts[0]];
    for (let i = 1; i < cuts.length; i++) {
      const last = merged[merged.length - 1];
      if (cuts[i][0] <= last[1] + 0.05) {
        last[1] = Math.max(last[1], cuts[i][1]);
      } else {
        merged.push(cuts[i]);
      }
    }

    let cursor = 0;
    let pieceIdx = 1;
    for (const [cs, ce] of merged) {
      if (cs - cursor > 0.08) {
        resolved.push({
          ...w,
          id: `${w.id}-p${pieceIdx++}`,
          x1: w.x1 + ux * cursor,
          z1: w.z1 + uz * cursor,
          x2: w.x1 + ux * cs,
          z2: w.z1 + uz * cs
        });
      }
      cursor = Math.max(cursor, ce);
    }
    if (len - cursor > 0.08) {
      resolved.push({
        ...w,
        id: `${w.id}-p${pieceIdx++}`,
        x1: w.x1 + ux * cursor,
        z1: w.z1 + uz * cursor,
        x2: w.x2,
        z2: w.z2
      });
    }
  }

  return resolved;
}

export const WALL_MOUNT_SNAP_RADIUS = 0.8;

export function computeWallSnap({
  px,
  pz,
  walls = [],
  maxRadius = WALL_MOUNT_SNAP_RADIUS,
  fallbackRotation = null,
  floor = undefined
}) {
  const floorFilter = floor === undefined ? null : clampFloor(floor);
  const candidates = subtractDoorsFromWalls(walls).filter(
    (w) =>
      w.kind !== 'door_single' &&
      w.kind !== 'door_double' &&
      w.kind !== 'railing' &&
      (floorFilter === null || clampFloor(w.floor ?? 0) === floorFilter)
  );
  let best = null;
  let bestDist = maxRadius;

  for (const w of candidates) {
    const dx = w.x2 - w.x1;
    const dz = w.z2 - w.z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.15) continue;

    const ux = dx / len;
    const uz = dz / len;
    const nx0 = -uz;
    const nz0 = ux;

    const t = Math.max(0, Math.min(len, (px - w.x1) * ux + (pz - w.z1) * uz));
    const projX = w.x1 + ux * t;
    const projZ = w.z1 + uz * t;
    const dist = Math.hypot(px - projX, pz - projZ);
    if (dist > bestDist) continue;

    const signedPerp = (px - w.x1) * nx0 + (pz - w.z1) * nz0;
    let sideSign;
    if (Math.abs(signedPerp) >= 1e-4) {
      sideSign = signedPerp >= 0 ? 1 : -1;
    } else if (Number.isFinite(fallbackRotation)) {
      const fbRad = (fallbackRotation * Math.PI) / 180;
      const dot = Math.sin(fbRad) * nx0 + Math.cos(fbRad) * nz0;
      sideSign = dot >= 0 ? 1 : -1;
    } else {
      const toCenterDot = -projX * nx0 + -projZ * nz0;
      sideSign = toCenterDot >= 0 ? 1 : -1;
    }

    const nx = nx0 * sideSign;
    const nz = nz0 * sideSign;
    const wallThickness = Math.max(0.08, Number(w.thickness) || 0.18);
    const snapX = Number((projX + nx * (wallThickness / 2)).toFixed(2));
    const snapZ = Number((projZ + nz * (wallThickness / 2)).toFixed(2));
    const rawDeg = ((Math.atan2(nx, nz) * 180) / Math.PI % 360 + 360) % 360;
    const rotRounded = Number(rawDeg.toFixed(1));
    const rotation = rotRounded >= 360 ? 0 : rotRounded;

    bestDist = dist;
    best = {
      wall: w,
      x: snapX,
      z: snapZ,
      projX: Number(projX.toFixed(2)),
      projZ: Number(projZ.toFixed(2)),
      nx,
      nz,
      rotation,
      wallThickness,
      dist
    };
  }

  return best;
}

function rotatedRectToWorldAabb(cx, cz, minLx, maxLx, minLz, maxLz, cos, sin) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const corners = [
    [minLx, minLz],
    [maxLx, minLz],
    [maxLx, maxLz],
    [minLx, maxLz]
  ];
  for (let i = 0; i < 4; i++) {
    const lx = corners[i][0];
    const lz = corners[i][1];
    const wx = cx + lx * cos + lz * sin;
    const wz = cz - lx * sin + lz * cos;
    if (wx < minX) minX = wx;
    if (wx > maxX) maxX = wx;
    if (wz < minZ) minZ = wz;
    if (wz > maxZ) maxZ = wz;
  }
  return {
    minX: Number(minX.toFixed(3)),
    maxX: Number(maxX.toFixed(3)),
    minZ: Number(minZ.toFixed(3)),
    maxZ: Number(maxZ.toFixed(3))
  };
}

function makeWorldColliderFromLocalBox(cx, cz, cos, sin, minLx, maxLx, minLz, maxLz, minY, maxY, floor) {
  const hw = Math.max(0.03, (maxLx - minLx) * 0.5);
  const hd = Math.max(0.03, (maxLz - minLz) * 0.5);
  const lcx = (minLx + maxLx) * 0.5;
  const lcz = (minLz + maxLz) * 0.5;
  const wcx = cx + lcx * cos + lcz * sin;
  const wcz = cz - lcx * sin + lcz * cos;
  return {
    cx: Number(wcx.toFixed(3)),
    cz: Number(wcz.toFixed(3)),
    hw: Number(hw.toFixed(3)),
    hd: Number(hd.toFixed(3)),
    ux: cos,
    uz: -sin,
    minY: Number(minY.toFixed(3)),
    maxY: Number(maxY.toFixed(3)),
    floor
  };
}

export function computeStairGeometry(stairObj, floorHeight = DEFAULT_FLOOR_HEIGHT) {
  const cat = getCatalogItem(stairObj?.type);
  const fh = Number(floorHeight) || DEFAULT_FLOOR_HEIGHT;
  const floor = clampFloor(stairObj?.floor ?? 0);
  const defTarget = floor < MAX_FLOOR ? floor + 1 : floor - 1;
  const targetFloor = clampFloor(stairObj?.targetFloor ?? defTarget);
  const baseY = floor * fh;
  const topY = targetFloor * fh;
  const style = stairObj?.stairStyle || cat?.stairStyle || 'straight';
  const w = Math.max(1.2, Number(stairObj?.w) || cat?.defaultW || 1.8);
  const d = Math.max(1.8, Number(stairObj?.d) || cat?.defaultD || 4.2);
  const x = Number(stairObj?.x) || 0;
  const z = Number(stairObj?.z) || 0;
  const deg = ((Number(stairObj?.rotation) || 0) % 360 + 360) % 360;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const steps = Math.max(6, Math.min(32, Math.round(Number(stairObj?.steps) || 16)));
  const hasRailings = stairObj?.hasRailings !== false;
  const turnDir = Number(stairObj?.turnDir) === -1 ? -1 : 1;
  const apron = 0.34;
  const railH = 1.04;
  const railT = 0.08;

  const flights = [];
  const landings = [];
  const steps3d = [];
  const handrails3d = [];
  const sideColliders = [];
  const openingRects = [];

  if (style === 'l_shape') {
    const runW = Math.min(w * 0.5, Math.max(1.15, w * 0.44));
    const f1MinX = turnDir === 1 ? -w * 0.5 : w * 0.5 - runW;
    const f1MaxX = f1MinX + runW;
    const f1MinZ = -d * 0.5;
    const f1MaxZ = d * 0.5 - runW;
    const midY = (baseY + topY) * 0.5;
    const steps1 = Math.max(4, Math.floor(steps / 2));
    const steps2 = Math.max(4, steps - steps1);

    flights.push({
      minLx: f1MinX,
      maxLx: f1MaxX,
      minLz: f1MinZ - apron,
      maxLz: f1MaxZ + 0.25,
      climbStart: f1MinZ,
      climbEnd: f1MaxZ,
      startY: baseY,
      endY: midY,
      axis: 'z',
      dir: 1
    });

    const step1Depth = Math.max(0.18, (f1MaxZ - f1MinZ) / steps1);
    const step1Rise = (midY - baseY) / steps1;
    const f1Cx = (f1MinX + f1MaxX) * 0.5;
    for (let i = 0; i < steps1; i++) {
      const sy = baseY + (i + 0.5) * step1Rise;
      const sz = f1MinZ + (i + 0.5) * step1Depth;
      steps3d.push({
        lx: f1Cx,
        ly: sy,
        lz: sz,
        w: runW - 0.08,
        h: Math.max(0.12, Math.abs(step1Rise) + 0.04),
        d: step1Depth + 0.03
      });
    }

    const landMinZ = d * 0.5 - runW;
    const landMaxZ = d * 0.5;
    landings.push({
      lx: f1Cx,
      ly: midY - 0.11,
      lz: (landMinZ + landMaxZ) * 0.5,
      w: runW,
      h: 0.22,
      d: runW,
      surfaceY: midY
    });
    flights.push({
      minLx: f1MinX,
      maxLx: f1MaxX,
      minLz: landMinZ - 0.05,
      maxLz: landMaxZ + 0.05,
      climbStart: landMinZ,
      climbEnd: landMaxZ,
      startY: midY,
      endY: midY,
      axis: 'z',
      dir: 1
    });

    const f2MinX = turnDir === 1 ? f1MaxX : -w * 0.5;
    const f2MaxX = turnDir === 1 ? w * 0.5 : f1MinX;
    const f2MinZ = landMinZ;
    const f2MaxZ = landMaxZ;
    const f2ClimbStart = turnDir === 1 ? f2MinX : f2MaxX;
    const f2ClimbEnd = turnDir === 1 ? f2MaxX : f2MinX;
    flights.push({
      minLx: turnDir === 1 ? f2MinX - 0.25 : f2MinX - apron,
      maxLx: turnDir === 1 ? f2MaxX + apron : f2MaxX + 0.25,
      minLz: f2MinZ,
      maxLz: f2MaxZ,
      climbStart: f2ClimbStart,
      climbEnd: f2ClimbEnd,
      startY: midY,
      endY: topY,
      axis: 'x',
      dir: turnDir
    });

    const f2Span = Math.max(0.5, f2MaxX - f2MinX);
    const step2W = f2Span / steps2;
    const step2Rise = (topY - midY) / steps2;
    const f2Cz = (f2MinZ + f2MaxZ) * 0.5;
    for (let i = 0; i < steps2; i++) {
      const sy = midY + (i + 0.5) * step2Rise;
      const sx = turnDir === 1 ? f2MinX + (i + 0.5) * step2W : f2MaxX - (i + 0.5) * step2W;
      steps3d.push({
        lx: sx,
        ly: sy,
        lz: f2Cz,
        w: step2W + 0.03,
        h: Math.max(0.12, Math.abs(step2Rise) + 0.04),
        d: runW - 0.08
      });
    }

    if (hasRailings) {
      const outerX = turnDir === 1 ? -w * 0.5 + 0.04 : w * 0.5 - 0.04;
      handrails3d.push({
        x1: outerX,
        y1: baseY + railH,
        z1: f1MinZ,
        x2: outerX,
        y2: midY + railH,
        z2: landMaxZ
      });
      handrails3d.push({
        x1: f1MinX + 0.04,
        y1: midY + railH,
        z1: landMaxZ - 0.04,
        x2: f1MaxX - 0.04,
        y2: midY + railH,
        z2: landMaxZ - 0.04
      });
      handrails3d.push({
        x1: f2ClimbStart,
        y1: midY + railH,
        z1: landMaxZ - 0.04,
        x2: f2ClimbEnd,
        y2: topY + railH,
        z2: landMaxZ - 0.04
      });
      const innerEdgeX = turnDir === 1 ? f1MaxX - 0.04 : f1MinX + 0.04;
      handrails3d.push({
        x1: innerEdgeX,
        y1: baseY + railH,
        z1: f1MinZ,
        x2: innerEdgeX,
        y2: midY + railH,
        z2: f1MaxZ
      });
      handrails3d.push({
        x1: f2ClimbStart,
        y1: midY + railH,
        z1: landMinZ + 0.04,
        x2: f2ClimbEnd,
        y2: topY + railH,
        z2: landMinZ + 0.04
      });
    }

    if (hasRailings) {
      const maxGuardY = Math.max(baseY, topY) + railH;
      const minGuardY = Math.min(baseY, topY);
      const highY = Math.max(baseY, topY);
      const highFloor = topY >= baseY ? targetFloor : floor;
      const outerSideX = turnDir === 1 ? f1MinX : f1MaxX - railT;
      sideColliders.push(
        makeWorldColliderFromLocalBox(
          x,
          z,
          cos,
          sin,
          outerSideX,
          outerSideX + railT,
          f1MinZ,
          landMaxZ,
          minGuardY,
          maxGuardY,
          floor
        )
      );
      sideColliders.push(
        makeWorldColliderFromLocalBox(
          x,
          z,
          cos,
          sin,
          -w * 0.5,
          w * 0.5,
          landMaxZ - railT,
          landMaxZ,
          minGuardY,
          maxGuardY,
          floor
        )
      );
      const innerColX = turnDir === 1 ? f1MaxX - railT : f1MinX;
      sideColliders.push(
        makeWorldColliderFromLocalBox(
          x,
          z,
          cos,
          sin,
          innerColX,
          innerColX + railT,
          f1MinZ,
          f1MaxZ,
          minGuardY,
          maxGuardY,
          floor
        )
      );
      sideColliders.push(
        makeWorldColliderFromLocalBox(
          x,
          z,
          cos,
          sin,
          f2MinX,
          f2MaxX,
          f2MinZ,
          f2MinZ + railT,
          minGuardY,
          maxGuardY,
          floor
        )
      );
      if (topY >= baseY) {
        sideColliders.push(
          makeWorldColliderFromLocalBox(
            x,
            z,
            cos,
            sin,
            f1MinX,
            f1MaxX,
            f1MinZ,
            f1MinZ + railT,
            highY,
            highY + railH,
            highFloor
          )
        );
      } else {
        const capMinX = turnDir === 1 ? f2MaxX - railT : f2MinX;
        const capMaxX = turnDir === 1 ? f2MaxX : f2MinX + railT;
        sideColliders.push(
          makeWorldColliderFromLocalBox(
            x,
            z,
            cos,
            sin,
            capMinX,
            capMaxX,
            f2MinZ,
            f2MaxZ,
            highY,
            highY + railH,
            highFloor
          )
        );
      }
    }

    openingRects.push(rotatedRectToWorldAabb(x, z, f1MinX, f1MaxX, f1MinZ, landMaxZ, cos, sin));
    openingRects.push(rotatedRectToWorldAabb(x, z, f2MinX, f2MaxX, f2MinZ, f2MaxZ, cos, sin));
  } else if (style === 'u_shape') {
    const landingD = Math.min(d * 0.36, Math.max(1.15, w * 0.34));
    const flightD = Math.max(1.0, d - landingD);
    const gapW = Math.min(0.24, w * 0.08);
    const flightW = (w - gapW) * 0.5;
    const f1MinX = turnDir === 1 ? -w * 0.5 : w * 0.5 - flightW;
    const f1MaxX = f1MinX + flightW;
    const f2MinX = turnDir === 1 ? w * 0.5 - flightW : -w * 0.5;
    const f2MaxX = f2MinX + flightW;
    const fMinZ = -d * 0.5;
    const fMaxZ = -d * 0.5 + flightD;
    const landMinZ = fMaxZ;
    const landMaxZ = d * 0.5;
    const midY = (baseY + topY) * 0.5;
    const steps1 = Math.max(4, Math.floor(steps / 2));
    const steps2 = Math.max(4, steps - steps1);

    flights.push({
      minLx: f1MinX,
      maxLx: f1MaxX,
      minLz: fMinZ - apron,
      maxLz: fMaxZ + 0.25,
      climbStart: fMinZ,
      climbEnd: fMaxZ,
      startY: baseY,
      endY: midY,
      axis: 'z',
      dir: 1
    });

    const step1Depth = Math.max(0.18, flightD / steps1);
    const step1Rise = (midY - baseY) / steps1;
    const f1Cx = (f1MinX + f1MaxX) * 0.5;
    for (let i = 0; i < steps1; i++) {
      steps3d.push({
        lx: f1Cx,
        ly: baseY + (i + 0.5) * step1Rise,
        lz: fMinZ + (i + 0.5) * step1Depth,
        w: flightW - 0.06,
        h: Math.max(0.12, Math.abs(step1Rise) + 0.04),
        d: step1Depth + 0.03
      });
    }

    landings.push({
      lx: 0,
      ly: midY - 0.11,
      lz: (landMinZ + landMaxZ) * 0.5,
      w,
      h: 0.22,
      d: landingD,
      surfaceY: midY
    });
    flights.push({
      minLx: -w * 0.5,
      maxLx: w * 0.5,
      minLz: landMinZ - 0.05,
      maxLz: landMaxZ + 0.05,
      climbStart: landMinZ,
      climbEnd: landMaxZ,
      startY: midY,
      endY: midY,
      axis: 'z',
      dir: 1
    });

    flights.push({
      minLx: f2MinX,
      maxLx: f2MaxX,
      minLz: fMinZ - apron,
      maxLz: fMaxZ + 0.25,
      climbStart: fMaxZ,
      climbEnd: fMinZ,
      startY: midY,
      endY: topY,
      axis: 'z',
      dir: -1
    });

    const step2Depth = Math.max(0.18, flightD / steps2);
    const step2Rise = (topY - midY) / steps2;
    const f2Cx = (f2MinX + f2MaxX) * 0.5;
    for (let i = 0; i < steps2; i++) {
      steps3d.push({
        lx: f2Cx,
        ly: midY + (i + 0.5) * step2Rise,
        lz: fMaxZ - (i + 0.5) * step2Depth,
        w: flightW - 0.06,
        h: Math.max(0.12, Math.abs(step2Rise) + 0.04),
        d: step2Depth + 0.03
      });
    }

    if (hasRailings) {
      handrails3d.push({
        x1: f1MinX + (turnDir === 1 ? 0.04 : flightW - 0.04),
        y1: baseY + railH,
        z1: fMinZ,
        x2: f1MinX + (turnDir === 1 ? 0.04 : flightW - 0.04),
        y2: midY + railH,
        z2: fMaxZ
      });
      handrails3d.push({
        x1: f2MinX + (turnDir === 1 ? flightW - 0.04 : 0.04),
        y1: midY + railH,
        z1: fMaxZ,
        x2: f2MinX + (turnDir === 1 ? flightW - 0.04 : 0.04),
        y2: topY + railH,
        z2: fMinZ
      });
      handrails3d.push({
        x1: -w * 0.5 + 0.04,
        y1: midY + railH,
        z1: landMaxZ - 0.04,
        x2: w * 0.5 - 0.04,
        y2: midY + railH,
        z2: landMaxZ - 0.04
      });
      handrails3d.push({
        x1: 0,
        y1: baseY + railH,
        z1: fMinZ,
        x2: 0,
        y2: midY + railH,
        z2: fMaxZ
      });
      handrails3d.push({
        x1: 0,
        y1: midY + railH,
        z1: fMaxZ,
        x2: 0,
        y2: topY + railH,
        z2: fMinZ
      });
    }

    if (hasRailings) {
      const maxGuardY = Math.max(baseY, topY) + railH;
      const minGuardY = Math.min(baseY, topY);
      const highY = Math.max(baseY, topY);
      const highFloor = topY >= baseY ? targetFloor : floor;
      sideColliders.push(
        makeWorldColliderFromLocalBox(
          x,
          z,
          cos,
          sin,
          -w * 0.5,
          -w * 0.5 + railT,
          -d * 0.5,
          d * 0.5,
          minGuardY,
          maxGuardY,
          floor
        )
      );
      sideColliders.push(
        makeWorldColliderFromLocalBox(
          x,
          z,
          cos,
          sin,
          w * 0.5 - railT,
          w * 0.5,
          -d * 0.5,
          d * 0.5,
          minGuardY,
          maxGuardY,
          floor
        )
      );
      sideColliders.push(
        makeWorldColliderFromLocalBox(
          x,
          z,
          cos,
          sin,
          -w * 0.5,
          w * 0.5,
          d * 0.5 - railT,
          d * 0.5,
          minGuardY,
          maxGuardY,
          floor
        )
      );
      sideColliders.push(
        makeWorldColliderFromLocalBox(
          x,
          z,
          cos,
          sin,
          -Math.max(0.08, gapW * 0.5 + 0.03),
          Math.max(0.08, gapW * 0.5 + 0.03),
          fMinZ,
          fMaxZ,
          minGuardY,
          maxGuardY,
          floor
        )
      );
      if (topY >= baseY) {
        sideColliders.push(
          makeWorldColliderFromLocalBox(
            x,
            z,
            cos,
            sin,
            f1MinX,
            f1MaxX,
            fMinZ,
            fMinZ + railT,
            highY,
            highY + railH,
            highFloor
          )
        );
      } else {
        sideColliders.push(
          makeWorldColliderFromLocalBox(
            x,
            z,
            cos,
            sin,
            f2MinX,
            f2MaxX,
            fMinZ,
            fMinZ + railT,
            highY,
            highY + railH,
            highFloor
          )
        );
      }
    }
    openingRects.push(rotatedRectToWorldAabb(x, z, -w * 0.5, w * 0.5, -d * 0.5, d * 0.5, cos, sin));
  } else {
    const fMinZ = -d * 0.5;
    const fMaxZ = d * 0.5;
    flights.push({
      minLx: -w * 0.5,
      maxLx: w * 0.5,
      minLz: fMinZ - apron,
      maxLz: fMaxZ + apron,
      climbStart: fMinZ,
      climbEnd: fMaxZ,
      startY: baseY,
      endY: topY,
      axis: 'z',
      dir: 1
    });

    const stepDepth = Math.max(0.18, d / steps);
    const stepRise = (topY - baseY) / steps;
    for (let i = 0; i < steps; i++) {
      steps3d.push({
        lx: 0,
        ly: baseY + (i + 0.5) * stepRise,
        lz: fMinZ + (i + 0.5) * stepDepth,
        w: w - 0.12,
        h: Math.max(0.12, Math.abs(stepRise) + 0.04),
        d: stepDepth + 0.03
      });
    }

    if (hasRailings) {
      for (const sx of [-w * 0.5 + 0.04, w * 0.5 - 0.04]) {
        handrails3d.push({
          x1: sx,
          y1: baseY + railH,
          z1: fMinZ,
          x2: sx,
          y2: topY + railH,
          z2: fMaxZ
        });
      }
    }

    if (hasRailings) {
      const maxGuardY = Math.max(baseY, topY) + railH;
      const minGuardY = Math.min(baseY, topY);
      const highY = Math.max(baseY, topY);
      const highFloor = topY >= baseY ? targetFloor : floor;
      sideColliders.push(
        makeWorldColliderFromLocalBox(
          x,
          z,
          cos,
          sin,
          -w * 0.5,
          -w * 0.5 + railT,
          fMinZ,
          fMaxZ,
          minGuardY,
          maxGuardY,
          floor
        )
      );
      sideColliders.push(
        makeWorldColliderFromLocalBox(
          x,
          z,
          cos,
          sin,
          w * 0.5 - railT,
          w * 0.5,
          fMinZ,
          fMaxZ,
          minGuardY,
          maxGuardY,
          floor
        )
      );
      if (topY >= baseY) {
        sideColliders.push(
          makeWorldColliderFromLocalBox(
            x,
            z,
            cos,
            sin,
            -w * 0.5,
            w * 0.5,
            fMinZ,
            fMinZ + railT,
            highY,
            highY + railH,
            highFloor
          )
        );
      } else {
        sideColliders.push(
          makeWorldColliderFromLocalBox(
            x,
            z,
            cos,
            sin,
            -w * 0.5,
            w * 0.5,
            fMaxZ - railT,
            fMaxZ,
            highY,
            highY + railH,
            highFloor
          )
        );
      }
    }
    openingRects.push(rotatedRectToWorldAabb(x, z, -w * 0.5, w * 0.5, -d * 0.5, d * 0.5, cos, sin));
  }

  const worldBounds = rotatedRectToWorldAabb(x, z, -w * 0.5, w * 0.5, -d * 0.5, d * 0.5, cos, sin);

  return {
    id: stairObj?.id || 'stair',
    style,
    floor,
    targetFloor,
    baseY,
    topY,
    totalRise: topY - baseY,
    x,
    z,
    w,
    d,
    rad,
    cos,
    sin,
    turnDir,
    steps,
    hasRailings,
    flights,
    landings,
    steps3d,
    handrails3d,
    sideColliders,
    autoOpeningRect: openingRects[0] || worldBounds,
    autoOpeningRects: openingRects,
    worldBounds
  };
}

export function computeEffectiveFloorOpenings(mapData) {
  const fh = Number(mapData?.floorHeight) || DEFAULT_FLOOR_HEIGHT;
  const list = [];
  for (const op of mapData?.openings || []) {
    const hw = Math.max(0.25, (Number(op.w) || 2) * 0.5);
    const hd = Math.max(0.25, (Number(op.d) || 2) * 0.5);
    const rad = ((Number(op.rotation) || 0) * Math.PI) / 180;
    const rect = rotatedRectToWorldAabb(op.x || 0, op.z || 0, -hw, hw, -hd, hd, Math.cos(rad), Math.sin(rad));
    list.push({
      id: op.id,
      floor: clampFloor(op.floor ?? 0),
      ...rect,
      autoFromStairId: op.autoFromStairId || ''
    });
  }
  for (const o of mapData?.objects || []) {
    const cat = getCatalogItem(o.type);
    if (!cat) continue;
    if (cat.isOpening) {
      const hw = Math.max(0.25, (Number(o.w) || cat.defaultW) * 0.5);
      const hd = Math.max(0.25, (Number(o.d) || cat.defaultD) * 0.5);
      const rad = ((Number(o.rotation) || 0) * Math.PI) / 180;
      const rect = rotatedRectToWorldAabb(o.x || 0, o.z || 0, -hw, hw, -hd, hd, Math.cos(rad), Math.sin(rad));
      list.push({
        id: o.id,
        floor: clampFloor(o.floor ?? 0),
        ...rect,
        autoFromStairId: ''
      });
    } else if (cat.isStair && o.autoOpening !== false) {
      const geom = computeStairGeometry(o, fh);
      const upFloor = Math.max(geom.floor, geom.targetFloor);
      if (upFloor !== geom.floor || geom.targetFloor !== geom.floor) {
        for (let r = 0; r < geom.autoOpeningRects.length; r++) {
          list.push({
            id: `auto-open-${o.id}-${r}`,
            floor: upFloor,
            ...geom.autoOpeningRects[r],
            autoFromStairId: o.id
          });
        }
      }
    }
  }
  return list;
}

export function computeSlabRectangles(bounds, openings = [], customSlabs = null) {
  let rects = Array.isArray(customSlabs) && customSlabs.length > 0
    ? customSlabs.map((s) => ({
        minX: Number(s.minX),
        maxX: Number(s.maxX),
        minZ: Number(s.minZ),
        maxZ: Number(s.maxZ)
      }))
    : [
        {
          minX: Number(bounds.minX),
          maxX: Number(bounds.maxX),
          minZ: Number(bounds.minZ),
          maxZ: Number(bounds.maxZ)
        }
      ];

  for (let i = 0; i < openings.length; i++) {
    const op = openings[i];
    if (!op) continue;
    const next = [];
    for (let j = 0; j < rects.length; j++) {
      const r = rects[j];
      const ox0 = Math.max(r.minX, op.minX);
      const ox1 = Math.min(r.maxX, op.maxX);
      const oz0 = Math.max(r.minZ, op.minZ);
      const oz1 = Math.min(r.maxZ, op.maxZ);
      if (ox1 - ox0 <= 0.04 || oz1 - oz0 <= 0.04) {
        next.push(r);
        continue;
      }
      if (ox0 - r.minX > 0.04) {
        next.push({ minX: r.minX, maxX: ox0, minZ: r.minZ, maxZ: r.maxZ });
      }
      if (r.maxX - ox1 > 0.04) {
        next.push({ minX: ox1, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ });
      }
      if (oz0 - r.minZ > 0.04) {
        next.push({ minX: ox0, maxX: ox1, minZ: r.minZ, maxZ: oz0 });
      }
      if (r.maxZ - oz1 > 0.04) {
        next.push({ minX: ox0, maxX: ox1, minZ: oz1, maxZ: r.maxZ });
      }
    }
    rects = next;
  }
  return rects;
}

export function buildWalkableSurfaceData(mapData) {
  const norm = mapData?.bounds && Array.isArray(mapData?.floors) ? mapData : normalizeMapData(mapData);
  const fh = Number(norm.floorHeight) || DEFAULT_FLOOR_HEIGHT;
  const openings = computeEffectiveFloorOpenings(norm);
  const openingsByFloor = new Map();
  for (const op of openings) {
    if (!openingsByFloor.has(op.floor)) openingsByFloor.set(op.floor, []);
    openingsByFloor.get(op.floor).push(op);
  }

  const slabsByFloor = new Map();
  const customSlabsByFloor = new Map();
  for (const o of norm.objects || []) {
    if (o.type !== 'floor_slab') continue;
    const fl = clampFloor(o.floor ?? 0);
    if (!customSlabsByFloor.has(fl)) customSlabsByFloor.set(fl, []);
    const hw = (o.w || 10) * 0.5;
    const hd = (o.d || 10) * 0.5;
    const rad = ((o.rotation || 0) * Math.PI) / 180;
    customSlabsByFloor.get(fl).push(
      rotatedRectToWorldAabb(o.x, o.z, -hw, hw, -hd, hd, Math.cos(rad), Math.sin(rad))
    );
  }

  const outdoorZonesByFloor = new Map();
  for (const z of norm.zones || []) {
    if (!z.outdoor) continue;
    const fl = clampFloor(z.floor ?? 0);
    if (!outdoorZonesByFloor.has(fl)) outdoorZonesByFloor.set(fl, []);
    outdoorZonesByFloor.get(fl).push({
      minX: z.x - z.w * 0.5,
      maxX: z.x + z.w * 0.5,
      minZ: z.z - z.d * 0.5,
      maxZ: z.z + z.d * 0.5
    });
  }

  const slabFloors = [];
  for (const flMeta of norm.floors || [{ index: 0, hasFullSlab: true }]) {
    const fl = clampFloor(flMeta.index);
    const flOpenings = openingsByFloor.get(fl) || [];
    const customSlabs = customSlabsByFloor.get(fl) || [];
    let rects = [];
    if (flMeta.hasFullSlab !== false) {
      const outdoorCuts = fl > 0 ? outdoorZonesByFloor.get(0) || [] : [];
      rects = computeSlabRectangles(norm.bounds, [...flOpenings, ...outdoorCuts]);
    } else if (customSlabs.length > 0) {
      rects = computeSlabRectangles(norm.bounds, flOpenings, customSlabs);
    }
    const baseY = fl * fh;
    slabsByFloor.set(fl, { floor: fl, y: baseY, rects });
    slabFloors.push({ floor: fl, y: baseY, rects });
  }
  slabFloors.sort((a, b) => a.floor - b.floor);

  const stairs = [];
  for (const o of norm.objects || []) {
    const cat = getCatalogItem(o.type);
    if (cat?.isStair) {
      stairs.push(computeStairGeometry(o, fh));
    }
  }

  const minFloor = slabFloors.length > 0 ? slabFloors[0].floor : 0;
  const maxFloor = slabFloors.length > 0 ? slabFloors[slabFloors.length - 1].floor : 0;
  const minSurfaceY = minFloor * fh;

  return {
    bounds: norm.bounds,
    floorHeight: fh,
    minFloor,
    maxFloor,
    minSurfaceY,
    slabFloors,
    slabsByFloor,
    openingsByFloor,
    stairs
  };
}

export function evaluateSurfaceAt(surfaceData, x, z, currentFeetY = 0, options = {}) {
  const out = options.out || { found: false, y: 0, onRamp: false, stairId: null, floor: 0 };
  out.found = false;
  out.y = 0;
  out.onRamp = false;
  out.stairId = null;
  out.floor = 0;

  if (!surfaceData) {
    out.found = true;
    return out;
  }

  const maxStepUp = Number.isFinite(Number(options.maxStepUp)) ? Number(options.maxStepUp) : 0.72;
  const ceilingCutoff = (Number(currentFeetY) || 0) + maxStepUp;
  let bestY = -Infinity;
  let bestOnRamp = false;
  let bestStairId = null;
  let bestFloor = surfaceData.minFloor || 0;

  const stairs = surfaceData.stairs || [];
  for (let i = 0; i < stairs.length; i++) {
    const st = stairs[i];
    if (
      x < st.worldBounds.minX - 0.5 ||
      x > st.worldBounds.maxX + 0.5 ||
      z < st.worldBounds.minZ - 0.5 ||
      z > st.worldBounds.maxZ + 0.5
    ) {
      continue;
    }
    const dx = x - st.x;
    const dz = z - st.z;
    const lx = dx * st.cos - dz * st.sin;
    const lz = dx * st.sin + dz * st.cos;
    for (let j = 0; j < st.flights.length; j++) {
      const fl = st.flights[j];
      if (lx < fl.minLx || lx > fl.maxLx || lz < fl.minLz || lz > fl.maxLz) continue;
      let t = 0;
      if (Math.abs(fl.startY - fl.endY) < 1e-4) {
        t = 0;
      } else if (fl.axis === 'x') {
        const span = fl.climbEnd - fl.climbStart;
        t = Math.abs(span) > 1e-4 ? (lx - fl.climbStart) / span : 0;
      } else {
        const span = fl.climbEnd - fl.climbStart;
        t = Math.abs(span) > 1e-4 ? (lz - fl.climbStart) / span : 0;
      }
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
      const sy = fl.startY + (fl.endY - fl.startY) * t;
      if (sy <= ceilingCutoff && sy > bestY) {
        bestY = sy;
        bestOnRamp = true;
        bestStairId = st.id;
        bestFloor = Math.abs(sy - st.topY) < 0.35 ? st.targetFloor : st.floor;
      }
    }
  }

  const slabFloors = surfaceData.slabFloors || [];
  for (let i = 0; i < slabFloors.length; i++) {
    const sf = slabFloors[i];
    if (sf.y > ceilingCutoff) continue;
    if (sf.y < bestY - 1e-4) continue;
    const rects = sf.rects;
    for (let r = 0; r < rects.length; r++) {
      const rc = rects[r];
      if (x >= rc.minX && x <= rc.maxX && z >= rc.minZ && z <= rc.maxZ) {
        if (sf.y > bestY) {
          bestY = sf.y;
          bestOnRamp = false;
          bestStairId = null;
          bestFloor = sf.floor;
        }
        break;
      }
    }
  }

  if (bestY > -Infinity) {
    out.found = true;
    out.y = bestY;
    out.onRamp = bestOnRamp;
    out.stairId = bestStairId;
    out.floor = bestFloor;
    return out;
  }

  out.found = false;
  out.y = surfaceData.minSurfaceY ?? 0;
  out.floor = surfaceData.minFloor ?? 0;
  return out;
}

export function getCeilingHeightAt(surfaceData, x, z, currentFeetY = 0) {
  if (!surfaceData) return 4.6;
  const fh = surfaceData.floorHeight || DEFAULT_FLOOR_HEIGHT;
  let ceilingY = surfaceData.maxFloor * fh + (surfaceData.bounds?.height || fh);
  const slabFloors = surfaceData.slabFloors || [];
  for (let i = 0; i < slabFloors.length; i++) {
    const sf = slabFloors[i];
    if (sf.y <= currentFeetY + 0.65) continue;
    const rects = sf.rects;
    for (let r = 0; r < rects.length; r++) {
      const rc = rects[r];
      if (x >= rc.minX && x <= rc.maxX && z >= rc.minZ && z <= rc.maxZ) {
        const underside = sf.y - SLAB_THICKNESS;
        if (underside < ceilingY) {
          ceilingY = underside;
        }
        break;
      }
    }
  }
  return ceilingY;
}

export function duplicateFloorStructure(mapData, sourceFloor, targetFloor) {
  const srcFl = clampFloor(sourceFloor);
  const dstFl = clampFloor(targetFloor);
  if (srcFl === dstFl) return mapData;
  const clone = JSON.parse(JSON.stringify(mapData));
  const stamp = Date.now();
  let seq = 1;

  const existingFloors = Array.isArray(clone.floors) ? clone.floors : [{ index: 0 }];
  if (!existingFloors.some((f) => clampFloor(typeof f === 'object' ? f.index : f) === dstFl)) {
    existingFloors.push({
      index: dstFl,
      label: formatFloorLabel(dstFl),
      hasFullSlab: true,
      hasCeiling: true
    });
  }
  clone.floors = existingFloors;

  const srcWalls = (clone.walls || []).filter((w) => clampFloor(w.floor ?? 0) === srcFl);
  for (const w of srcWalls) {
    clone.walls.push({
      ...w,
      id: `w-dup-${stamp}-${seq++}`,
      floor: dstFl
    });
  }

  const srcZones = (clone.zones || []).filter((z) => clampFloor(z.floor ?? 0) === srcFl && !z.outdoor);
  for (const z of srcZones) {
    clone.zones.push({
      ...z,
      id: `Z-dup-${stamp}-${seq++}`,
      floor: dstFl
    });
  }

  const srcPillars = (clone.objects || []).filter(
    (o) => clampFloor(o.floor ?? 0) === srcFl && o.type === 'pillar_column'
  );
  for (const p of srcPillars) {
    clone.objects.push({
      ...p,
      id: `obj-dup-${stamp}-${seq++}`,
      floor: dstFl
    });
  }

  return normalizeMapData(clone);
}

export function getDynamicMapColliders(mapData) {
  const colliders = [];
  const fh = Number(mapData?.floorHeight) || DEFAULT_FLOOR_HEIGHT;
  const wallList = subtractDoorsFromWalls(mapData?.walls || []);

  for (const w of wallList) {
    if (w.kind === 'door_single' || w.kind === 'door_double') continue;
    const dx = w.x2 - w.x1;
    const dz = w.z2 - w.z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.15) continue;
    const cx = (w.x1 + w.x2) / 2;
    const cz = (w.z1 + w.z2) / 2;
    const halfT = (w.thickness || 0.18) / 2;
    const floor = clampFloor(w.floor ?? 0);
    const baseY = floor * fh;
    const wh = w.kind === 'railing' ? 1.12 : Number(w.height) || fh;
    const minY = baseY;
    const maxY = baseY + wh;

    if (Math.abs(dz) < 0.02) {
      colliders.push({
        minX: Math.min(w.x1, w.x2),
        maxX: Math.max(w.x1, w.x2),
        minZ: cz - halfT,
        maxZ: cz + halfT,
        minY,
        maxY,
        floor
      });
    } else if (Math.abs(dx) < 0.02) {
      colliders.push({
        minX: cx - halfT,
        maxX: cx + halfT,
        minZ: Math.min(w.z1, w.z2),
        maxZ: Math.max(w.z1, w.z2),
        minY,
        maxY,
        floor
      });
    } else {
      colliders.push({
        cx,
        cz,
        hw: len / 2,
        hd: halfT,
        ux: dx / len,
        uz: dz / len,
        minY,
        maxY,
        floor
      });
    }
  }

  for (const o of mapData?.objects || []) {
    const cat = getCatalogItem(o.type);
    if (!cat) continue;
    if (cat.isStair) {
      const geom = computeStairGeometry(o, fh);
      for (const sc of geom.sideColliders) {
        colliders.push(sc);
      }
      continue;
    }
    if (!cat.collides) continue;
    const floor = clampFloor(o.floor ?? 0);
    const baseY = floor * fh;
    const oh = Number(cat.defaultH) || 1.6;
    const minY = baseY;
    const maxY = baseY + oh;
    const hw = (o.w || cat.defaultW) / 2;
    const hd = (o.d || cat.defaultD) / 2;
    const deg = ((o.rotation || 0) % 360 + 360) % 360;
    const rad = (deg * Math.PI) / 180;
    if (Math.abs(deg) < 0.5 || Math.abs(deg - 180) < 0.5) {
      colliders.push({ minX: o.x - hw, maxX: o.x + hw, minZ: o.z - hd, maxZ: o.z + hd, minY, maxY, floor });
    } else if (Math.abs(deg - 90) < 0.5 || Math.abs(deg - 270) < 0.5) {
      colliders.push({ minX: o.x - hd, maxX: o.x + hd, minZ: o.z - hw, maxZ: o.z + hw, minY, maxY, floor });
    } else {
      colliders.push({
        cx: o.x,
        cz: o.z,
        hw,
        hd,
        ux: Math.cos(rad),
        uz: -Math.sin(rad),
        minY,
        maxY,
        floor
      });
    }
  }

  return colliders;
}

export function getZoneAtPositionInMap(mapData, x, z, floor = 0) {
  const px = Number(x) || 0;
  const pz = Number(z) || 0;
  const targetFloor = clampFloor(floor);
  const zones = Array.isArray(mapData?.zones) ? mapData.zones : [];
  let best = null;
  let bestArea = Infinity;

  for (const zone of zones) {
    const zFloor = clampFloor(zone.floor ?? 0);
    if (zFloor !== targetFloor && !(zone.outdoor && targetFloor >= 0)) continue;
    const pts = getZonePolygonPoints(zone);
    if (isPointInPolygon(px, pz, pts)) {
      const area = computePolygonArea(pts) || (zone.w || 2) * (zone.d || 2);
      if (area < bestArea) {
        bestArea = area;
        best = zone;
      }
    }
  }

  if (best) return best;
  const flBadge = targetFloor !== 0 ? ` (${formatFloorShortLabel(targetFloor)})` : '';
  return {
    id: targetFloor === 0 ? 'U300' : `FLOOR_${targetFloor}`,
    floor: targetFloor,
    code: targetFloor === 0 ? 'U300' : formatFloorShortLabel(targetFloor),
    shortName: targetFloor === 0 ? 'Couloir Central' : formatFloorLabel(targetFloor),
    fullLabel: `Plateau CIEL — ${formatFloorLabel(targetFloor)}`,
    badgeText: `📍 ${targetFloor === 0 ? 'U300 - Couloir Central' : formatFloorLabel(targetFloor)}${flBadge}`,
    color: '#38bdf8'
  };
}

export function getStationTeleportInMap(mapData, targetId) {
  const fh = Number(mapData?.floorHeight) || DEFAULT_FLOOR_HEIGHT;
  const objects = Array.isArray(mapData?.objects) ? mapData.objects : [];
  const targetObj = objects.find((o) => {
    const cat = getCatalogItem(o.type);
    return cat?.tpId === targetId;
  });

  if (!targetObj) {
    const sp = mapData?.spawn || { x: 0, z: 2, floor: 0 };
    const spFloor = clampFloor(sp.floor ?? 0);
    return {
      pos: { x: sp.x, y: spFloor * fh, z: sp.z, floor: spFloor },
      lookAt: { x: sp.x, y: spFloor * fh + 1.4, z: sp.z - 2 },
      label: targetId
    };
  }

  const objFloor = clampFloor(targetObj.floor ?? 0);
  const baseY = objFloor * fh;
  const rad = ((targetObj.rotation || 0) * Math.PI) / 180;
  const hd = (targetObj.d || 1) * 0.5;
  const offsetDist = hd + 0.9;
  const px = targetObj.x + Math.sin(rad) * offsetDist;
  const pz = targetObj.z + Math.cos(rad) * offsetDist;
  const b = mapData?.bounds || WORLD_BOUNDS;
  const clampedX = Math.max(b.minX + 0.7, Math.min(b.maxX - 0.7, px));
  const clampedZ = Math.max(b.minZ + 0.7, Math.min(b.maxZ - 0.7, pz));
  return {
    pos: { x: clampedX, y: baseY, z: clampedZ, floor: objFloor },
    lookAt: { x: targetObj.x, y: baseY + 1.2, z: targetObj.z },
    label: targetObj.label || targetId
  };
}
