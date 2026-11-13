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
    label: 'TP 2 — Banc Électronique & Sonde 3D',
    shortLabel: 'TP 2 Élec 3D',
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
    label: 'TP 4 — Baie 19" & Configuration VLAN 3D',
    shortLabel: 'TP 4 VLAN 3D',
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
    label: 'TP 4 — Brassage Baie 19" & Console VLAN 3D',
    shortLabel: 'TP 4 Brassage 3D',
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
    label: 'TP 6 — Régie Audiovisuelle & DMX 3D',
    shortLabel: 'TP 6 Régie AV 3D',
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
    label: 'TP 6 — Console Mixage & Éclairage DMX 3D',
    shortLabel: 'TP 6 Studio DMX 3D',
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
    label: 'Bureau individuel',
    shortLabel: 'Bureau élève',
    icon: '🗄️',
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
    label: 'Îlot central réseau (multipostes)',
    shortLabel: 'Îlot réseau',
    icon: '🔀',
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
    label: 'Bureau professeur',
    shortLabel: 'Bureau prof',
    icon: '📋',
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
    label: 'PC fixe Gamer/Cyber (boîtier vitré + double écran)',
    shortLabel: 'Poste Cyber',
    icon: '🖥️',
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
    label: 'Poste PC ouvert (maintenance)',
    shortLabel: 'PC Ouvert',
    icon: '🔧',
    defaultW: 1.25,
    defaultD: 1.8,
    defaultH: 1.35,
    defaultColor: '#a78bfa',
    collides: true,
    supportTop: 0.84
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

export function normalizeMapData(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const bSrc = src.bounds && typeof src.bounds === 'object' ? src.bounds : {};
  const width = clampNum(bSrc.width, 8, 200, 26);
  const depth = clampNum(bSrc.depth, 8, 200, 24.4);
  const height = clampNum(bSrc.height, 3, 12, 4.6);
  const minX = -width / 2;
  const maxX = width / 2;
  const minZ = -depth / 2;
  const maxZ = depth / 2;

  const rawWalls = Array.isArray(src.walls) ? src.walls : [];
  const validKinds = new Set(['solid', 'glazed', 'door_single', 'door_double']);
  const walls = [];
  for (let i = 0; i < rawWalls.length && i < 2000; i++) {
    const w = rawWalls[i];
    if (!w || typeof w !== 'object') continue;
    const x1 = clampNum(w.x1, minX - 1, maxX + 1, 0);
    const z1 = clampNum(w.z1, minZ - 1, maxZ + 1, 0);
    const x2 = clampNum(w.x2, minX - 1, maxX + 1, 0);
    const z2 = clampNum(w.z2, minZ - 1, maxZ + 1, 0);
    if (Math.hypot(x2 - x1, z2 - z1) < 0.15) continue;
    const kind = validKinds.has(w.kind) ? w.kind : 'solid';
    walls.push({
      id: cleanText(w.id, 32, `w-${i + 1}`),
      kind,
      x1: Number(x1.toFixed(2)),
      z1: Number(z1.toFixed(2)),
      x2: Number(x2.toFixed(2)),
      z2: Number(z2.toFixed(2)),
      thickness: Number(clampNum(w.thickness, 0.08, 0.8, 0.18).toFixed(2)),
      height: Number(clampNum(w.height, 2.2, height, height).toFixed(2)),
      color: cleanColor(w.color, kind === 'glazed' ? '#38bdf8' : '#1e293b'),
      doorLabel: cleanText(w.doorLabel, 48, '')
    });
  }

  const rawZones = Array.isArray(src.zones) ? src.zones : [];
  const zones = [];
  for (let i = 0; i < rawZones.length && i < 300; i++) {
    const z = rawZones[i];
    if (!z || typeof z !== 'object') continue;
    const code = cleanText(z.code, 16, `Z${i + 1}`);
    const shortName = cleanText(z.shortName, 28, 'Salle CIEL');
    const color = cleanColor(z.color, '#38bdf8');
    const baseZone = {
      id: cleanText(z.id, 24, `zone-${i + 1}`),
      code,
      shortName,
      fullLabel: cleanText(z.fullLabel, 64, `${code} - ${shortName}`),
      badgeText: cleanText(z.badgeText, 44, `📍 ${code} - ${shortName}`),
      color
    };

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

  const rawObjects = Array.isArray(src.objects) ? src.objects : [];
  const objects = [];
  let spawnFromObjects = null;
  const maxObjW = Math.max(120, width);
  const maxObjD = Math.max(120, depth);
  for (let i = 0; i < rawObjects.length && i < 2500; i++) {
    const o = rawObjects[i];
    if (!o || typeof o !== 'object') continue;
    const cat = getCatalogItem(o.type);
    if (!cat) continue;
    const ox = clampNum(o.x, minX, maxX, 0);
    const oz = clampNum(o.z, minZ, maxZ, 0);
    const rotDeg = ((Number(o.rotation) || 0) % 360 + 360) % 360;
    const ow = clampNum(o.w, 0.2, maxObjW, cat.defaultW);
    const od = clampNum(o.d, 0.1, maxObjD, cat.defaultD);
    const normObj = {
      id: cleanText(o.id, 32, `obj-${i + 1}`),
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
    if (cat.type === 'spawn_point') {
      spawnFromObjects = normObj;
    }
    objects.push(normObj);
  }

  const spSrc = src.spawn && typeof src.spawn === 'object' ? src.spawn : {};
  const spX = spawnFromObjects ? spawnFromObjects.x : clampNum(spSrc.x, minX + 0.6, maxX - 0.6, 0);
  const spZ = spawnFromObjects ? spawnFromObjects.z : clampNum(spSrc.z, minZ + 0.6, maxZ - 0.6, 2);
  const spYaw = spawnFromObjects
    ? (-(spawnFromObjects.rotation * Math.PI) / 180)
    : Number.isFinite(Number(spSrc.yaw))
      ? Number(spSrc.yaw)
      : 0;

  return {
    version: 1,
    name: cleanText(src.name, 64, 'Carte Atelier CIEL 3D'),
    updatedAt: src.updatedAt || new Date().toISOString(),
    bounds: { minX, maxX, minZ, maxZ, width, depth, height },
    spawn: {
      x: Number(spX.toFixed(2)),
      y: 1.68,
      z: Number(spZ.toFixed(2)),
      yaw: Number(spYaw.toFixed(3))
    },
    zones,
    walls,
    objects
  };
}

export function subtractDoorsFromWalls(walls = []) {
  const doors = walls.filter((w) => w.kind === 'door_single' || w.kind === 'door_double');
  const resolved = [...doors];

  for (const w of walls) {
    if (w.kind === 'door_single' || w.kind === 'door_double') continue;
    const dx = w.x2 - w.x1;
    const dz = w.z2 - w.z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.15) continue;
    const ux = dx / len;
    const uz = dz / len;
    const cuts = [];

    for (const d of doors) {
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
  fallbackRotation = null
}) {
  const candidates = subtractDoorsFromWalls(walls).filter(
    (w) => w.kind !== 'door_single' && w.kind !== 'door_double'
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

export function getDynamicMapColliders(mapData) {
  const colliders = [];
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

    if (Math.abs(dz) < 0.02) {
      colliders.push({
        minX: Math.min(w.x1, w.x2),
        maxX: Math.max(w.x1, w.x2),
        minZ: cz - halfT,
        maxZ: cz + halfT
      });
    } else if (Math.abs(dx) < 0.02) {
      colliders.push({
        minX: cx - halfT,
        maxX: cx + halfT,
        minZ: Math.min(w.z1, w.z2),
        maxZ: Math.max(w.z1, w.z2)
      });
    } else {
      colliders.push({
        cx,
        cz,
        hw: len / 2,
        hd: halfT,
        ux: dx / len,
        uz: dz / len
      });
    }
  }

  for (const o of mapData?.objects || []) {
    const cat = getCatalogItem(o.type);
    if (!cat || !cat.collides) continue;
    const hw = (o.w || cat.defaultW) / 2;
    const hd = (o.d || cat.defaultD) / 2;
    const deg = ((o.rotation || 0) % 360 + 360) % 360;
    const rad = (deg * Math.PI) / 180;
    if (Math.abs(deg) < 0.5 || Math.abs(deg - 180) < 0.5) {
      colliders.push({ minX: o.x - hw, maxX: o.x + hw, minZ: o.z - hd, maxZ: o.z + hd });
    } else if (Math.abs(deg - 90) < 0.5 || Math.abs(deg - 270) < 0.5) {
      colliders.push({ minX: o.x - hd, maxX: o.x + hd, minZ: o.z - hw, maxZ: o.z + hw });
    } else {
      colliders.push({
        cx: o.x,
        cz: o.z,
        hw,
        hd,
        ux: Math.cos(rad),
        uz: -Math.sin(rad)
      });
    }
  }

  return colliders;
}

export function getZoneAtPositionInMap(mapData, x, z) {
  const px = Number(x) || 0;
  const pz = Number(z) || 0;
  const zones = Array.isArray(mapData?.zones) ? mapData.zones : [];
  let best = null;
  let bestArea = Infinity;

  for (const zone of zones) {
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
  return {
    id: 'U300',
    code: 'U300',
    shortName: 'Couloir Central',
    fullLabel: 'Plateau U300 - Filière CIEL',
    badgeText: '📍 U300 - Couloir Central',
    color: '#38bdf8'
  };
}

export function getStationTeleportInMap(mapData, targetId) {
  const objects = Array.isArray(mapData?.objects) ? mapData.objects : [];
  const targetObj = objects.find((o) => {
    const cat = getCatalogItem(o.type);
    return cat?.tpId === targetId;
  });

  if (!targetObj) {
    const sp = mapData?.spawn || { x: 0, z: 2 };
    return {
      pos: { x: sp.x, z: sp.z },
      lookAt: { x: sp.x, z: sp.z - 2 },
      label: targetId
    };
  }

  const rad = ((targetObj.rotation || 0) * Math.PI) / 180;
  const hd = (targetObj.d || 1) * 0.5;
  const offsetDist = hd + 0.9;
  const px = targetObj.x + Math.sin(rad) * offsetDist;
  const pz = targetObj.z + Math.cos(rad) * offsetDist;
  const b = mapData?.bounds || WORLD_BOUNDS;
  const clampedX = Math.max(b.minX + 0.7, Math.min(b.maxX - 0.7, px));
  const clampedZ = Math.max(b.minZ + 0.7, Math.min(b.maxZ - 0.7, pz));
  return {
    pos: { x: clampedX, z: clampedZ },
    lookAt: { x: targetObj.x, z: targetObj.z },
    label: targetObj.label || targetId
  };
}
