import * as THREE from 'three';

export const COMBAT_MODES = {
  guns: {
    id: 'guns',
    label: 'Mode Fusils (Distance)',
    shortLabel: 'Fusils',
    icon: '🔫'
  },
  melee: {
    id: 'melee',
    label: 'Mode Mêlée (Corps-à-corps)',
    shortLabel: 'Mêlée',
    icon: '⚔️'
  }
};

export const COMBAT_WEAPONS = [
  {
    id: 'fiber_rifle',
    mode: 'guns',
    slot: 1,
    name: 'Fusil d’Assaut Fibre Optique',
    shortName: 'Fibre Optique',
    icon: '🔵',
    damage: 20,
    fireRateMs: 135,
    magSize: 24,
    reloadMs: 1450,
    range: 36,
    pellets: 1,
    spread: 0.014,
    auto: true,
    beamColor: '#22d3ee',
    sparkColor: '#67e8f9',
    style: 'laser',
    crosshairType: 'tactical_cyan',
    ads: {
      fov: 48,
      sensitivityMult: 0.65,
      spreadMult: 0.3,
      sightType: 'holo',
      hipPos: [0.23, -0.21, -0.44],
      adsPos: [0, -0.118, -0.33],
      adsRot: [0, 0, 0]
    },
    description: 'Cadence rapide, faisceaux laser cyan précis, viseur holographique réflexe.'
  },
  {
    id: 'udp_shotgun',
    mode: 'guns',
    slot: 2,
    name: 'Fusil à Pompe Paquets UDP',
    shortName: 'Pompe UDP',
    icon: '🟠',
    damage: 14,
    fireRateMs: 760,
    magSize: 8,
    reloadMs: 1850,
    range: 15,
    pellets: 6,
    spread: 0.11,
    auto: false,
    beamColor: '#f59e0b',
    sparkColor: '#fde047',
    style: 'packet',
    crosshairType: 'shotgun_spread',
    ads: {
      fov: 56,
      sensitivityMult: 0.78,
      spreadMult: 0.72,
      sightType: 'ring',
      hipPos: [0.24, -0.22, -0.45],
      adsPos: [0, -0.112, -0.35],
      adsRot: [0, 0, 0]
    },
    description: 'Projette une salve de 6 paquets IP lumineux en cône, viseur anneau néon.'
  },
  {
    id: 'ping_sniper',
    mode: 'guns',
    slot: 3,
    name: 'Sniper Ping 0ms (Oscillo-Railgun)',
    shortName: 'Sniper 0ms',
    icon: '🟣',
    damage: 78,
    fireRateMs: 1150,
    magSize: 5,
    reloadMs: 2100,
    range: 46,
    pellets: 1,
    spread: 0.002,
    auto: false,
    beamColor: '#a855f7',
    sparkColor: '#e879f9',
    style: 'sine_rail',
    crosshairType: 'sniper_fine',
    ads: {
      fov: 20,
      sensitivityMult: 0.3,
      spreadMult: 0.06,
      sightType: 'oscillo_scope',
      hipPos: [0.24, -0.22, -0.47],
      adsPos: [0, -0.125, -0.28],
      adsRot: [0, 0, 0]
    },
    description: 'Railgun longue portée avec lunette d’oscilloscope graduée ms/div.'
  },
  {
    id: 'plasma_solder_pistol',
    mode: 'guns',
    slot: 4,
    name: 'Pistolet à Souder Plasma',
    shortName: 'Pistolet Plasma',
    icon: '🟠',
    damage: 24,
    fireRateMs: 220,
    magSize: 15,
    reloadMs: 920,
    range: 26,
    pellets: 1,
    spread: 0.018,
    auto: false,
    beamColor: '#fb923c',
    sparkColor: '#fdba74',
    style: 'plasma',
    crosshairType: 'plasma_compact',
    ads: {
      fov: 54,
      sensitivityMult: 0.72,
      spreadMult: 0.34,
      sightType: 'iron_3dot',
      hipPos: [0.21, -0.19, -0.39],
      adsPos: [0, -0.078, -0.31],
      adsRot: [0, 0, 0]
    },
    description: 'Léger, nerveux, buse plasma incandescente et mire mécanique 3 points.'
  },
  {
    id: 'solder_iron_blade',
    mode: 'melee',
    slot: 1,
    name: 'Fer à Souder Incandescent',
    shortName: 'Fer à Souder',
    icon: '🔥',
    damage: 26,
    fireRateMs: 270,
    magSize: 0,
    reloadMs: 0,
    range: 2.35,
    arcCos: 0.35,
    knockback: 1.2,
    dashDist: 0.35,
    aoeRadius: 0,
    beamColor: '#fb923c',
    sparkColor: '#fde047',
    style: 'melee',
    crosshairType: 'melee_arc',
    ads: {
      fov: 64,
      sensitivityMult: 0.88,
      spreadMult: 1,
      sightType: 'melee_guard',
      hipPos: [0.23, -0.21, -0.43],
      adsPos: [0.02, -0.11, -0.34],
      adsRot: [0.18, 0.42, 0.82]
    },
    description: 'Frappes très rapides avec panne rougeoyante et garde frontale.'
  },
  {
    id: 'rj45_crimper_heavy',
    mode: 'melee',
    slot: 2,
    name: 'Pince à Sertir RJ45 Géante',
    shortName: 'Pince RJ45',
    icon: '🛠️',
    damage: 54,
    fireRateMs: 680,
    magSize: 0,
    reloadMs: 0,
    range: 2.65,
    arcCos: 0.45,
    knockback: 4.8,
    dashDist: 0.25,
    aoeRadius: 0,
    beamColor: '#ef4444',
    sparkColor: '#fca5a5',
    style: 'melee',
    crosshairType: 'melee_arc',
    ads: {
      fov: 64,
      sensitivityMult: 0.86,
      spreadMult: 1,
      sightType: 'melee_guard',
      hipPos: [0.25, -0.22, -0.44],
      adsPos: [0.01, -0.12, -0.34],
      adsRot: [0.24, 0.3, 0.72]
    },
    description: 'Mâchoires crantées haute puissance avec arc bleu et fort recul.'
  },
  {
    id: 'ddr5_katana',
    mode: 'melee',
    slot: 3,
    name: 'Katana Barrette RAM DDR5',
    shortName: 'Katana DDR5',
    icon: '⚡',
    damage: 34,
    fireRateMs: 330,
    magSize: 0,
    reloadMs: 0,
    range: 2.75,
    arcCos: 0.25,
    knockback: 1.8,
    dashDist: 2.1,
    aoeRadius: 0,
    beamColor: '#38bdf8',
    sparkColor: '#67e8f9',
    style: 'melee',
    crosshairType: 'melee_arc',
    ads: {
      fov: 64,
      sensitivityMult: 0.88,
      spreadMult: 1,
      sightType: 'melee_guard',
      hipPos: [0.24, -0.23, -0.42],
      adsPos: [-0.04, -0.14, -0.34],
      adsRot: [0.12, 0.36, 0.92]
    },
    description: 'Lame PCB DDR5 avec puces SMD, dissipateur RGB et dash avant.'
  },
  {
    id: 'switch24_hammer',
    mode: 'melee',
    slot: 4,
    name: 'Marteau Switch 24 Ports',
    shortName: 'Marteau 24P',
    icon: '🔨',
    damage: 62,
    fireRateMs: 820,
    magSize: 0,
    reloadMs: 0,
    range: 3.1,
    arcCos: -0.25,
    knockback: 3.6,
    dashDist: 0.4,
    aoeRadius: 2.6,
    beamColor: '#10b981',
    sparkColor: '#34d399',
    style: 'melee',
    crosshairType: 'melee_arc',
    ads: {
      fov: 64,
      sensitivityMult: 0.85,
      spreadMult: 1,
      sightType: 'melee_guard',
      hipPos: [0.26, -0.24, -0.46],
      adsPos: [0.02, -0.15, -0.36],
      adsRot: [0.2, 0.38, 0.85]
    },
    description: 'Boîtier Switch rackable 1U 24 ports monté sur masse à large impact.'
  }
];

const WEAPON_BY_ID = new Map(COMBAT_WEAPONS.map((w) => [w.id, w]));

const SHARED_GEOM_CACHE = new Map();
const SHARED_MAT_CACHE = new Map();

function sharedGeom(key, factory) {
  let g = SHARED_GEOM_CACHE.get(key);
  if (!g) {
    g = factory();
    SHARED_GEOM_CACHE.set(key, g);
  }
  return g;
}

function sharedMat(key, factory) {
  let m = SHARED_MAT_CACHE.get(key);
  if (!m) {
    m = factory();
    SHARED_MAT_CACHE.set(key, m);
  }
  return m;
}

function getPalette() {
  return {
    matteBlack: sharedMat('matteBlack', () => new THREE.MeshStandardMaterial({ color: '#0b1120', roughness: 0.42, metalness: 0.65 })),
    gunmetal: sharedMat('gunmetal', () => new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.3, metalness: 0.85 })),
    brushedSteel: sharedMat('brushedSteel', () => new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.24, metalness: 0.92 })),
    darkRubber: sharedMat('darkRubber', () => new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.85, metalness: 0.12 })),
    insulatedBlue: sharedMat('insulatedBlue', () => new THREE.MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.58, metalness: 0.18 })),
    insulatedYellow: sharedMat('insulatedYellow', () => new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.52, metalness: 0.2 })),
    copperCoil: sharedMat('copperCoil', () => new THREE.MeshStandardMaterial({ color: '#c26a2b', roughness: 0.28, metalness: 0.9 })),
    pcbBlack: sharedMat('pcbBlack', () => new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.35, metalness: 0.45 })),
    smdChip: sharedMat('smdChip', () => new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.28, metalness: 0.55 })),
    goldPin: sharedMat('goldPin', () => new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.22, metalness: 0.95, emissive: '#78350f', emissiveIntensity: 0.25 })),
    cyanGlow: sharedMat('cyanGlow', () => new THREE.MeshBasicMaterial({ color: '#22d3ee' })),
    cyanGlass: sharedMat('cyanGlass', () => new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })),
    limeRingGlow: sharedMat('limeRingGlow', () => new THREE.MeshBasicMaterial({ color: '#a3e635' })),
    amberGlow: sharedMat('amberGlow', () => new THREE.MeshBasicMaterial({ color: '#f59e0b' })),
    yellowGlow: sharedMat('yellowGlow', () => new THREE.MeshBasicMaterial({ color: '#fde047' })),
    purpleGlow: sharedMat('purpleGlow', () => new THREE.MeshBasicMaterial({ color: '#a855f7' })),
    plasmaOrangeGlow: sharedMat('plasmaOrangeGlow', () => new THREE.MeshBasicMaterial({ color: '#fb923c' })),
    hotTipGlow: sharedMat('hotTipGlow', () => new THREE.MeshBasicMaterial({ color: '#ff4500' })),
    arcBlueGlow: sharedMat('arcBlueGlow', () => new THREE.MeshBasicMaterial({ color: '#60a5fa', transparent: true, opacity: 0.85 })),
    greenLedGlow: sharedMat('greenLedGlow', () => new THREE.MeshBasicMaterial({ color: '#22c55e' })),
    orangeLedGlow: sharedMat('orangeLedGlow', () => new THREE.MeshBasicMaterial({ color: '#f97316' })),
    portDark: sharedMat('portDark', () => new THREE.MeshStandardMaterial({ color: '#020617', roughness: 0.6, metalness: 0.3 })),
    lensGlass: sharedMat('lensGlass', () => new THREE.MeshStandardMaterial({ color: '#38bdf8', roughness: 0.08, metalness: 0.2, emissive: '#0284c7', emissiveIntensity: 0.55 })),
    redDotGlow: sharedMat('redDotGlow', () => new THREE.MeshBasicMaterial({ color: '#ff2e4c', side: THREE.DoubleSide })),
    holoRingGlow: sharedMat('holoRingGlow', () => new THREE.MeshBasicMaterial({ color: '#22d3ee', transparent: true, opacity: 0.88, side: THREE.DoubleSide }))
  };
}

const WEAPON_VR_ERGONOMICS = {
  fiber_rifle: {
    gripOffset: { x: 0, y: -0.062, z: 0.01 },
    foregripOffset: { x: 0, y: 0.004, z: -0.36 },
    sightOffset: { x: 0, y: 0.129, z: -0.12 },
    vrPitchOffset: -0.6,
    recoil: { kickZ: 0.036, pitchX: 0.075, twoHandMult: 0.34 },
    haptic: { intensity: 0.68, durationMs: 42 }
  },
  udp_shotgun: {
    gripOffset: { x: 0, y: -0.056, z: 0.025 },
    foregripOffset: { x: 0, y: -0.014, z: -0.35 },
    sightOffset: { x: 0, y: 0.116, z: -0.1 },
    vrPitchOffset: -0.6,
    recoil: { kickZ: 0.078, pitchX: 0.17, twoHandMult: 0.38 },
    haptic: { intensity: 0.92, durationMs: 68 }
  },
  ping_sniper: {
    gripOffset: { x: 0, y: -0.058, z: 0.01 },
    foregripOffset: { x: 0, y: 0.004, z: -0.44 },
    sightOffset: { x: 0, y: 0.122, z: -0.13 },
    vrPitchOffset: -0.6,
    recoil: { kickZ: 0.085, pitchX: 0.19, twoHandMult: 0.32 },
    haptic: { intensity: 0.96, durationMs: 78 }
  },
  plasma_solder_pistol: {
    gripOffset: { x: 0, y: -0.052, z: 0.0 },
    foregripOffset: { x: 0, y: -0.048, z: -0.085 },
    sightOffset: { x: 0, y: 0.08, z: -0.11 },
    vrPitchOffset: -0.6,
    recoil: { kickZ: 0.032, pitchX: 0.085, twoHandMult: 0.42 },
    haptic: { intensity: 0.58, durationMs: 36 }
  },
  solder_iron_blade: {
    gripOffset: { x: 0, y: 0, z: -0.05 },
    foregripOffset: { x: 0, y: 0, z: -0.17 },
    sightOffset: { x: 0, y: 0.02, z: -0.18 },
    vrPitchOffset: -0.48,
    recoil: { kickZ: 0.02, pitchX: 0.04, twoHandMult: 0.5 },
    haptic: { intensity: 0.78, durationMs: 48 }
  },
  rj45_crimper_heavy: {
    gripOffset: { x: 0, y: -0.07, z: -0.03 },
    foregripOffset: { x: 0, y: 0.02, z: -0.12 },
    sightOffset: { x: 0, y: 0.12, z: -0.16 },
    vrPitchOffset: -0.48,
    recoil: { kickZ: 0.025, pitchX: 0.05, twoHandMult: 0.5 },
    haptic: { intensity: 0.88, durationMs: 56 }
  },
  ddr5_katana: {
    gripOffset: { x: 0, y: 0.01, z: 0 },
    foregripOffset: { x: 0, y: -0.06, z: 0 },
    sightOffset: { x: 0, y: 0.48, z: 0 },
    vrPitchOffset: -0.28,
    recoil: { kickZ: 0.018, pitchX: 0.04, twoHandMult: 0.5 },
    haptic: { intensity: 0.82, durationMs: 50 }
  },
  switch24_hammer: {
    gripOffset: { x: 0, y: -0.01, z: 0 },
    foregripOffset: { x: 0, y: 0.24, z: 0 },
    sightOffset: { x: 0, y: 0.58, z: -0.08 },
    vrPitchOffset: -0.28,
    recoil: { kickZ: 0.025, pitchX: 0.06, twoHandMult: 0.5 },
    haptic: { intensity: 0.94, durationMs: 65 }
  }
};

export function getWeaponVrErgonomics(weaponId) {
  return WEAPON_VR_ERGONOMICS[weaponId] || WEAPON_VR_ERGONOMICS.fiber_rifle;
}

function addPart(parent, geomKey, geomFactory, mat, pos, rot = null, name = '') {
  const mesh = new THREE.Mesh(sharedGeom(geomKey, geomFactory), mat);
  mesh.position.set(pos[0], pos[1], pos[2]);
  if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

export function getSharedWeaponAssetStats() {
  return {
    geometries: SHARED_GEOM_CACHE.size,
    materials: SHARED_MAT_CACHE.size
  };
}

export function getCombatWeaponById(weaponId) {
  if (!weaponId || typeof weaponId !== 'string') return null;
  return WEAPON_BY_ID.get(weaponId.trim()) || null;
}

export function getWeaponsByMode(mode = 'guns') {
  const cleanMode = mode === 'melee' ? 'melee' : 'guns';
  return COMBAT_WEAPONS.filter((w) => w.mode === cleanMode);
}

export function getDefaultWeaponForMode(mode = 'guns') {
  const list = getWeaponsByMode(mode);
  return list[0] || COMBAT_WEAPONS[0];
}

export function buildCombatWeaponMesh(weaponId, { viewModel = false } = {}) {
  const spec = getCombatWeaponById(weaponId) || COMBAT_WEAPONS[0];
  const pal = getPalette();
  const group = new THREE.Group();
  group.name = `combat-weapon-${spec.id}`;

  const animParts = {};
  let muzzleOffset = { x: 0, y: 0.04, z: -0.5 };

  if (spec.id === 'fiber_rifle') {
    addPart(group, 'fr_body', () => new THREE.BoxGeometry(0.068, 0.092, 0.42), pal.matteBlack, [0, 0.02, -0.14], null, 'chassis');
    addPart(group, 'fr_upper', () => new THREE.BoxGeometry(0.056, 0.026, 0.48), pal.gunmetal, [0, 0.074, -0.18]);
    addPart(group, 'fr_rail', () => new THREE.BoxGeometry(0.032, 0.012, 0.36), pal.matteBlack, [0, 0.091, -0.16]);

    addPart(group, 'fr_shroud_l', () => new THREE.BoxGeometry(0.012, 0.054, 0.28), pal.matteBlack, [-0.03, 0.044, -0.44]);
    addPart(group, 'fr_shroud_r', () => new THREE.BoxGeometry(0.012, 0.054, 0.28), pal.matteBlack, [0.03, 0.044, -0.44]);
    addPart(group, 'fr_shroud_b', () => new THREE.BoxGeometry(0.056, 0.014, 0.28), pal.matteBlack, [0, 0.014, -0.44]);
    for (let i = 0; i < 4; i++) {
      addPart(group, 'fr_rib', () => new THREE.BoxGeometry(0.064, 0.012, 0.014), pal.gunmetal, [0, 0.072, -0.34 - i * 0.065]);
    }
    const strandA = addPart(group, 'fr_strand', () => new THREE.CylinderGeometry(0.0055, 0.0055, 0.34, 8), pal.cyanGlow, [-0.012, 0.05, -0.44], [Math.PI / 2, 0, 0], 'fiber-strand-a');
    const strandB = addPart(group, 'fr_strand', () => new THREE.CylinderGeometry(0.0055, 0.0055, 0.34, 8), pal.cyanGlow, [0.012, 0.05, -0.44], [Math.PI / 2, 0, 0], 'fiber-strand-b');
    const strandC = addPart(group, 'fr_strand', () => new THREE.CylinderGeometry(0.0055, 0.0055, 0.34, 8), pal.cyanGlow, [0, 0.034, -0.44], [Math.PI / 2, 0, 0], 'fiber-strand-c');
    animParts.fiberStrands = [strandA, strandB, strandC];

    addPart(group, 'fr_muzzle', () => new THREE.CylinderGeometry(0.016, 0.02, 0.07, 10), pal.brushedSteel, [0, 0.044, -0.61], [Math.PI / 2, 0, 0]);
    addPart(group, 'fr_mag', () => new THREE.BoxGeometry(0.042, 0.16, 0.068), pal.matteBlack, [0, -0.082, -0.19], [0.22, 0, 0]);
    addPart(group, 'fr_mag_gauge', () => new THREE.BoxGeometry(0.046, 0.11, 0.014), pal.cyanGlow, [0, -0.078, -0.18], [0.22, 0, 0]);
    addPart(group, 'fr_grip', () => new THREE.BoxGeometry(0.042, 0.115, 0.052), pal.darkRubber, [0, -0.065, 0.01], [0.28, 0, 0]);

    addPart(group, 'fr_stock_top', () => new THREE.BoxGeometry(0.038, 0.02, 0.22), pal.matteBlack, [0, 0.052, 0.16]);
    addPart(group, 'fr_stock_bot', () => new THREE.BoxGeometry(0.03, 0.018, 0.2), pal.gunmetal, [0, -0.012, 0.15], [-0.22, 0, 0]);
    addPart(group, 'fr_stock_pad', () => new THREE.BoxGeometry(0.046, 0.11, 0.022), pal.darkRubber, [0, 0.012, 0.26]);

    const holoGroup = new THREE.Group();
    holoGroup.name = 'sight-holo';
    holoGroup.position.set(0, 0.118, -0.12);
    addPart(holoGroup, 'holo_base', () => new THREE.BoxGeometry(0.048, 0.016, 0.076), pal.matteBlack, [0, -0.018, 0]);
    addPart(holoGroup, 'holo_post_l', () => new THREE.BoxGeometry(0.007, 0.044, 0.054), pal.matteBlack, [-0.022, 0.01, 0]);
    addPart(holoGroup, 'holo_post_r', () => new THREE.BoxGeometry(0.007, 0.044, 0.054), pal.matteBlack, [0.022, 0.01, 0]);
    addPart(holoGroup, 'holo_top', () => new THREE.BoxGeometry(0.052, 0.007, 0.054), pal.matteBlack, [0, 0.033, 0]);
    addPart(holoGroup, 'holo_glass', () => new THREE.PlaneGeometry(0.038, 0.038), pal.cyanGlass, [0, 0.011, 0]);
    addPart(holoGroup, 'holo_ring', () => new THREE.RingGeometry(0.0085, 0.0102, 20), pal.holoRingGlow, [0, 0.011, 0.002]);
    addPart(holoGroup, 'holo_dot', () => new THREE.CircleGeometry(0.0026, 12), pal.redDotGlow, [0, 0.011, 0.0024]);
    addPart(holoGroup, 'holo_chev_l', () => new THREE.BoxGeometry(0.011, 0.002, 0.002), pal.cyanGlow, [-0.0045, 0.004, 0.002], [0, 0, 0.65]);
    addPart(holoGroup, 'holo_chev_r', () => new THREE.BoxGeometry(0.011, 0.002, 0.002), pal.cyanGlow, [0.0045, 0.004, 0.002], [0, 0, -0.65]);
    group.add(holoGroup);
    animParts.sight = holoGroup;

    muzzleOffset = { x: 0, y: 0.044, z: -0.65 };
  } else if (spec.id === 'udp_shotgun') {
    addPart(group, 'udp_body', () => new THREE.BoxGeometry(0.086, 0.102, 0.38), pal.matteBlack, [0, 0.02, -0.12], null, 'chassis');
    addPart(group, 'udp_barrel_l', () => new THREE.CylinderGeometry(0.021, 0.022, 0.42, 10), pal.gunmetal, [-0.023, 0.048, -0.4], [Math.PI / 2, 0, 0]);
    addPart(group, 'udp_barrel_r', () => new THREE.CylinderGeometry(0.021, 0.022, 0.42, 10), pal.gunmetal, [0.023, 0.048, -0.4], [Math.PI / 2, 0, 0]);
    addPart(group, 'udp_heatsink', () => new THREE.BoxGeometry(0.072, 0.016, 0.32), pal.brushedSteel, [0, 0.074, -0.38]);
    for (let i = 0; i < 5; i++) {
      addPart(group, 'udp_fin', () => new THREE.BoxGeometry(0.078, 0.024, 0.01), pal.matteBlack, [0, 0.068, -0.25 - i * 0.06]);
    }
    addPart(group, 'udp_tube', () => new THREE.CylinderGeometry(0.015, 0.015, 0.36, 8), pal.gunmetal, [0, -0.008, -0.38], [Math.PI / 2, 0, 0]);

    const pumpGroup = new THREE.Group();
    pumpGroup.name = 'pump-slide';
    pumpGroup.position.set(0, -0.012, -0.35);
    addPart(pumpGroup, 'udp_pump_body', () => new THREE.BoxGeometry(0.088, 0.056, 0.17), pal.darkRubber, [0, 0, 0]);
    addPart(pumpGroup, 'udp_pump_glow', () => new THREE.BoxGeometry(0.092, 0.014, 0.13), pal.amberGlow, [0, 0, 0]);
    group.add(pumpGroup);
    animParts.pump = pumpGroup;

    for (let s = 0; s < 4; s++) {
      addPart(group, 'udp_cart', () => new THREE.BoxGeometry(0.014, 0.044, 0.024), pal.amberGlow, [0.048, 0.02, -0.06 - s * 0.036]);
      addPart(group, 'udp_cart_cap', () => new THREE.BoxGeometry(0.016, 0.014, 0.024), pal.goldPin, [0.048, 0.044, -0.06 - s * 0.036]);
    }
    addPart(group, 'udp_grip', () => new THREE.BoxGeometry(0.048, 0.11, 0.06), pal.darkRubber, [0, -0.058, 0.03], [0.32, 0, 0]);
    addPart(group, 'udp_stock', () => new THREE.BoxGeometry(0.064, 0.094, 0.22), pal.matteBlack, [0, -0.01, 0.16]);

    const ringGroup = new THREE.Group();
    ringGroup.name = 'sight-ring';
    ringGroup.position.set(0, 0.112, -0.1);
    addPart(ringGroup, 'ring_base', () => new THREE.BoxGeometry(0.052, 0.014, 0.04), pal.matteBlack, [0, -0.026, 0]);
    addPart(ringGroup, 'ring_outer', () => new THREE.TorusGeometry(0.028, 0.0045, 8, 20), pal.gunmetal, [0, 0.004, 0]);
    addPart(ringGroup, 'ring_neon', () => new THREE.TorusGeometry(0.022, 0.0026, 8, 20), pal.limeRingGlow, [0, 0.004, 0.002]);
    addPart(ringGroup, 'ring_dot', () => new THREE.CircleGeometry(0.0025, 8), pal.yellowGlow, [0, 0.004, 0.002]);
    group.add(ringGroup);
    animParts.sight = ringGroup;

    muzzleOffset = { x: 0, y: 0.048, z: -0.62 };
  } else if (spec.id === 'ping_sniper') {
    addPart(group, 'sn_chassis', () => new THREE.BoxGeometry(0.068, 0.094, 0.48), pal.matteBlack, [0, 0.02, -0.14], null, 'chassis');
    addPart(group, 'sn_rail_top', () => new THREE.BoxGeometry(0.024, 0.02, 0.62), pal.gunmetal, [0, 0.064, -0.56]);
    addPart(group, 'sn_rail_bot', () => new THREE.BoxGeometry(0.024, 0.02, 0.62), pal.gunmetal, [0, 0.022, -0.56]);
    addPart(group, 'sn_core_beam', () => new THREE.BoxGeometry(0.012, 0.014, 0.58), pal.cyanGlow, [0, 0.043, -0.55]);

    const coils = [];
    for (let c = 0; c < 6; c++) {
      const zPos = -0.34 - c * 0.088;
      addPart(group, 'sn_coil_cu', () => new THREE.BoxGeometry(0.066, 0.056, 0.022), pal.copperCoil, [0, 0.043, zPos]);
      const glowBand = addPart(group, 'sn_coil_gl', () => new THREE.BoxGeometry(0.072, 0.016, 0.012), pal.purpleGlow, [0, 0.043, zPos]);
      coils.push(glowBand);
    }
    animParts.coils = coils;

    addPart(group, 'sn_osc_frame', () => new THREE.BoxGeometry(0.014, 0.052, 0.095), pal.gunmetal, [-0.038, 0.036, -0.14]);
    addPart(group, 'sn_osc_screen', () => new THREE.BoxGeometry(0.006, 0.038, 0.078), pal.cyanGlow, [-0.044, 0.036, -0.14], null, 'side-oscilloscope');

    addPart(group, 'sn_bipod_l', () => new THREE.CylinderGeometry(0.007, 0.007, 0.18, 6), pal.brushedSteel, [-0.036, -0.012, -0.46], [Math.PI / 2, 0, 0.12]);
    addPart(group, 'sn_bipod_r', () => new THREE.CylinderGeometry(0.007, 0.007, 0.18, 6), pal.brushedSteel, [0.036, -0.012, -0.46], [Math.PI / 2, 0, -0.12]);

    const scopeGroup = new THREE.Group();
    scopeGroup.name = 'sight-oscillo-scope';
    scopeGroup.position.set(0, 0.122, -0.13);
    addPart(scopeGroup, 'sn_mount_f', () => new THREE.BoxGeometry(0.03, 0.036, 0.024), pal.gunmetal, [0, -0.028, -0.07]);
    addPart(scopeGroup, 'sn_mount_b', () => new THREE.BoxGeometry(0.03, 0.036, 0.024), pal.gunmetal, [0, -0.028, 0.05]);
    addPart(scopeGroup, 'sn_scope_tube', () => new THREE.CylinderGeometry(0.024, 0.022, 0.28, 12), pal.matteBlack, [0, 0, 0], [Math.PI / 2, 0, 0]);
    addPart(scopeGroup, 'sn_scope_bell', () => new THREE.CylinderGeometry(0.034, 0.024, 0.07, 12), pal.gunmetal, [0, 0, -0.16], [Math.PI / 2, 0, 0]);
    addPart(scopeGroup, 'sn_scope_eye', () => new THREE.CylinderGeometry(0.026, 0.022, 0.05, 12), pal.darkRubber, [0, 0, 0.14], [Math.PI / 2, 0, 0]);
    addPart(scopeGroup, 'sn_lens_f', () => new THREE.CylinderGeometry(0.029, 0.029, 0.008, 12), pal.lensGlass, [0, 0, -0.195], [Math.PI / 2, 0, 0]);
    addPart(scopeGroup, 'sn_lens_b', () => new THREE.CylinderGeometry(0.021, 0.021, 0.008, 12), pal.cyanGlass, [0, 0, 0.165], [Math.PI / 2, 0, 0]);
    addPart(scopeGroup, 'sn_ret_h', () => new THREE.BoxGeometry(0.026, 0.0014, 0.0014), pal.cyanGlow, [0, 0, 0.169]);
    addPart(scopeGroup, 'sn_ret_v', () => new THREE.BoxGeometry(0.0014, 0.026, 0.0014), pal.cyanGlow, [0, 0, 0.169]);
    addPart(scopeGroup, 'sn_ret_dot', () => new THREE.CircleGeometry(0.0022, 10), pal.redDotGlow, [0, 0, 0.17]);
    group.add(scopeGroup);
    animParts.sight = scopeGroup;

    addPart(group, 'sn_mag', () => new THREE.BoxGeometry(0.04, 0.12, 0.08), pal.gunmetal, [0, -0.066, -0.18]);
    addPart(group, 'sn_grip', () => new THREE.BoxGeometry(0.042, 0.11, 0.052), pal.darkRubber, [0, -0.06, 0.01], [0.24, 0, 0]);
    addPart(group, 'sn_stock', () => new THREE.BoxGeometry(0.052, 0.088, 0.24), pal.matteBlack, [0, 0.01, 0.18]);

    muzzleOffset = { x: 0, y: 0.043, z: -0.9 };
  } else if (spec.id === 'plasma_solder_pistol') {
    addPart(group, 'pp_slide', () => new THREE.BoxGeometry(0.052, 0.068, 0.26), pal.matteBlack, [0, 0.036, -0.11], null, 'chassis');
    addPart(group, 'pp_frame', () => new THREE.BoxGeometry(0.044, 0.036, 0.22), pal.gunmetal, [0, 0.002, -0.09]);
    for (let v = 0; v < 4; v++) {
      addPart(group, 'pp_vent', () => new THREE.BoxGeometry(0.056, 0.014, 0.018), pal.plasmaOrangeGlow, [0, 0.044, -0.07 - v * 0.042]);
    }
    addPart(group, 'pp_collar', () => new THREE.CylinderGeometry(0.02, 0.024, 0.045, 10), pal.brushedSteel, [0, 0.036, -0.255], [Math.PI / 2, 0, 0]);
    const nozzle = addPart(group, 'pp_nozzle', () => new THREE.ConeGeometry(0.016, 0.095, 10), pal.hotTipGlow, [0, 0.036, -0.32], [-Math.PI / 2, 0, 0], 'plasma-nozzle');
    animParts.hotTip = nozzle;

    addPart(group, 'pp_grip', () => new THREE.BoxGeometry(0.042, 0.12, 0.054), pal.darkRubber, [0, -0.052, 0.0], [0.24, 0, 0]);
    addPart(group, 'pp_cell', () => new THREE.BoxGeometry(0.034, 0.034, 0.048), pal.plasmaOrangeGlow, [0, -0.112, 0.018], [0.24, 0, 0]);

    const ironGroup = new THREE.Group();
    ironGroup.name = 'sight-iron-3dot';
    ironGroup.position.set(0, 0.074, 0);
    addPart(ironGroup, 'pp_rear_l', () => new THREE.BoxGeometry(0.01, 0.015, 0.012), pal.matteBlack, [-0.015, 0.004, 0.01]);
    addPart(ironGroup, 'pp_rear_r', () => new THREE.BoxGeometry(0.01, 0.015, 0.012), pal.matteBlack, [0.015, 0.004, 0.01]);
    addPart(ironGroup, 'pp_dot_l', () => new THREE.BoxGeometry(0.005, 0.005, 0.004), pal.plasmaOrangeGlow, [-0.015, 0.006, 0.016]);
    addPart(ironGroup, 'pp_dot_r', () => new THREE.BoxGeometry(0.005, 0.005, 0.004), pal.plasmaOrangeGlow, [0.015, 0.006, 0.016]);
    addPart(ironGroup, 'pp_front_post', () => new THREE.BoxGeometry(0.007, 0.016, 0.012), pal.matteBlack, [0, 0.004, -0.22]);
    addPart(ironGroup, 'pp_dot_f', () => new THREE.BoxGeometry(0.005, 0.005, 0.005), pal.redDotGlow, [0, 0.006, -0.214]);
    group.add(ironGroup);
    animParts.sight = ironGroup;

    muzzleOffset = { x: 0, y: 0.036, z: -0.37 };
  } else if (spec.id === 'solder_iron_blade') {
    addPart(group, 'si_handle', () => new THREE.CylinderGeometry(0.024, 0.027, 0.22, 12), pal.insulatedBlue, [0, 0, -0.05], [Math.PI / 2, 0, 0]);
    addPart(group, 'si_grip_band', () => new THREE.CylinderGeometry(0.0265, 0.0265, 0.09, 12), pal.darkRubber, [0, 0, -0.07], [Math.PI / 2, 0, 0]);
    addPart(group, 'si_cable_boot', () => new THREE.CylinderGeometry(0.014, 0.009, 0.08, 8), pal.darkRubber, [0, -0.01, 0.09], [Math.PI / 2 + 0.22, 0, 0]);
    addPart(group, 'si_collar', () => new THREE.CylinderGeometry(0.032, 0.025, 0.038, 12), pal.matteBlack, [0, 0, -0.175], [Math.PI / 2, 0, 0]);
    addPart(group, 'si_barrel', () => new THREE.CylinderGeometry(0.015, 0.018, 0.26, 10), pal.brushedSteel, [0, 0, -0.32], [Math.PI / 2, 0, 0]);
    for (let f = 0; f < 5; f++) {
      addPart(group, 'si_fin', () => new THREE.CylinderGeometry(0.025, 0.025, 0.008, 10), pal.gunmetal, [0, 0, -0.22 - f * 0.026], [Math.PI / 2, 0, 0]);
    }
    const hotTip = addPart(group, 'si_tip', () => new THREE.ConeGeometry(0.016, 0.135, 10), pal.hotTipGlow, [0, 0, -0.515], [-Math.PI / 2, 0, 0], 'solder-tip');
    animParts.hotTip = hotTip;
    muzzleOffset = { x: 0, y: 0, z: -0.59 };
  } else if (spec.id === 'rj45_crimper_heavy') {
    addPart(group, 'cr_grip_l', () => new THREE.BoxGeometry(0.034, 0.25, 0.056), pal.insulatedYellow, [-0.034, -0.07, -0.03], [0, 0, 0.2]);
    addPart(group, 'cr_grip_l_trim', () => new THREE.BoxGeometry(0.038, 0.12, 0.044), pal.darkRubber, [-0.038, -0.09, -0.03], [0, 0, 0.2]);
    addPart(group, 'cr_grip_r', () => new THREE.BoxGeometry(0.034, 0.25, 0.056), pal.insulatedYellow, [0.034, -0.07, -0.03], [0, 0, -0.2]);
    addPart(group, 'cr_grip_r_trim', () => new THREE.BoxGeometry(0.038, 0.12, 0.044), pal.darkRubber, [0.038, -0.09, -0.03], [0, 0, -0.2]);

    addPart(group, 'cr_pivot', () => new THREE.CylinderGeometry(0.028, 0.028, 0.072, 12), pal.matteBlack, [0, 0.06, -0.08], [0, 0, Math.PI / 2]);
    addPart(group, 'cr_spring', () => new THREE.CylinderGeometry(0.012, 0.012, 0.07, 8), pal.brushedSteel, [0, -0.015, -0.04], [0, 0, Math.PI / 2]);

    addPart(group, 'cr_head_base', () => new THREE.BoxGeometry(0.145, 0.11, 0.18), pal.brushedSteel, [0, 0.09, -0.16]);
    addPart(group, 'cr_jaw_l', () => new THREE.BoxGeometry(0.042, 0.095, 0.16), pal.gunmetal, [-0.052, 0.12, -0.28], [0, -0.14, 0]);
    addPart(group, 'cr_jaw_r', () => new THREE.BoxGeometry(0.042, 0.095, 0.16), pal.gunmetal, [0.052, 0.12, -0.28], [0, 0.14, 0]);
    addPart(group, 'cr_die_slot', () => new THREE.BoxGeometry(0.052, 0.052, 0.06), pal.portDark, [0, 0.11, -0.22]);

    const arc = addPart(group, 'cr_arc', () => new THREE.BoxGeometry(0.082, 0.012, 0.012), pal.arcBlueGlow, [0, 0.13, -0.32], [0, 0, 0.15], 'electric-arc');
    animParts.arc = arc;
    muzzleOffset = { x: 0, y: 0.12, z: -0.38 };
  } else if (spec.id === 'ddr5_katana') {
    addPart(group, 'kt_hilt', () => new THREE.CylinderGeometry(0.021, 0.024, 0.23, 10), pal.darkRubber, [0, 0.01, 0]);
    for (let w = 0; w < 5; w++) {
      addPart(group, 'kt_wrap', () => new THREE.TorusGeometry(0.023, 0.004, 6, 12), pal.cyanGlow, [0, -0.08 + w * 0.042, 0], [Math.PI / 2, 0, 0]);
    }
    addPart(group, 'kt_tsuba', () => new THREE.BoxGeometry(0.13, 0.024, 0.072), pal.goldPin, [0, 0.132, 0], null, 'gold-dimm-tsuba');
    addPart(group, 'kt_tsuba_notch', () => new THREE.BoxGeometry(0.028, 0.028, 0.076), pal.matteBlack, [0, 0.132, 0]);

    addPart(group, 'kt_blade', () => new THREE.BoxGeometry(0.016, 0.68, 0.062), pal.pcbBlack, [0, 0.48, 0], null, 'pcb-blade');
    addPart(group, 'kt_tip', () => new THREE.ConeGeometry(0.032, 0.11, 4), pal.pcbBlack, [0, 0.87, 0], [0, Math.PI / 4, 0]);

    for (let ch = 0; ch < 6; ch++) {
      const cy = 0.22 + ch * 0.095;
      addPart(group, 'kt_smd', () => new THREE.BoxGeometry(0.024, 0.062, 0.036), pal.smdChip, [0, cy, 0.002]);
    }
    addPart(group, 'kt_gold_edge', () => new THREE.BoxGeometry(0.018, 0.56, 0.012), pal.goldPin, [0, 0.45, 0.032]);
    const rgbSpine = addPart(group, 'kt_rgb_spine', () => new THREE.BoxGeometry(0.014, 0.68, 0.018), pal.cyanGlow, [0, 0.48, -0.036], null, 'rgb-heatsink');
    animParts.rgbEdge = rgbSpine;

    group.rotation.x = viewModel ? -Math.PI * 0.24 : -Math.PI * 0.32;
    muzzleOffset = { x: 0, y: 0.88, z: -0.05 };
  } else {
    addPart(group, 'sw_shaft', () => new THREE.CylinderGeometry(0.022, 0.025, 0.68, 10), pal.brushedSteel, [0, 0.22, 0]);
    addPart(group, 'sw_grip', () => new THREE.CylinderGeometry(0.027, 0.027, 0.22, 10), pal.darkRubber, [0, -0.01, 0]);

    addPart(group, 'sw_chassis', () => new THREE.BoxGeometry(0.36, 0.12, 0.19), pal.matteBlack, [0, 0.58, 0], null, 'switch-1u-head');
    addPart(group, 'sw_ear_l', () => new THREE.BoxGeometry(0.026, 0.11, 0.02), pal.brushedSteel, [-0.192, 0.58, -0.085]);
    addPart(group, 'sw_ear_r', () => new THREE.BoxGeometry(0.026, 0.11, 0.02), pal.brushedSteel, [0.192, 0.58, -0.085]);
    addPart(group, 'sw_face', () => new THREE.BoxGeometry(0.34, 0.1, 0.016), pal.gunmetal, [0, 0.58, -0.095]);

    const leds = [];
    for (let col = 0; col < 12; col++) {
      const px = -0.145 + col * 0.0265;
      addPart(group, 'sw_port', () => new THREE.BoxGeometry(0.018, 0.022, 0.016), pal.portDark, [px, 0.6, -0.102]);
      addPart(group, 'sw_port', () => new THREE.BoxGeometry(0.018, 0.022, 0.016), pal.portDark, [px, 0.56, -0.102]);
      if (col % 2 === 0) {
        const led = addPart(
          group,
          'sw_led',
          () => new THREE.BoxGeometry(0.01, 0.008, 0.008),
          col % 4 === 0 ? pal.greenLedGlow : pal.orangeLedGlow,
          [px, 0.622, -0.105],
          null,
          `switch-led-${col}`
        );
        leds.push(led);
      }
    }
    animParts.leds = leds;

    group.rotation.x = -Math.PI * 0.28;
    muzzleOffset = { x: 0, y: 0.62, z: -0.16 };
  }

  const vrErgonomics = getWeaponVrErgonomics(spec.id);
  const gripOffset = { ...vrErgonomics.gripOffset };
  const foregripOffset = { ...vrErgonomics.foregripOffset };
  const sightOffset = { ...vrErgonomics.sightOffset };

  const gripAnchor = new THREE.Object3D();
  gripAnchor.name = 'gripAnchor';
  gripAnchor.position.set(gripOffset.x, gripOffset.y, gripOffset.z);
  group.add(gripAnchor);

  const muzzle = new THREE.Object3D();
  muzzle.name = 'muzzle';
  muzzle.position.set(muzzleOffset.x, muzzleOffset.y, muzzleOffset.z);
  muzzle.rotation.order = 'XYZ';
  muzzle.rotation.set(-group.rotation.x, Math.PI, 0);
  group.add(muzzle);

  const sightAnchor = new THREE.Object3D();
  sightAnchor.name = 'sightAnchor';
  sightAnchor.position.set(sightOffset.x, sightOffset.y, sightOffset.z);
  sightAnchor.rotation.order = 'XYZ';
  sightAnchor.rotation.set(-group.rotation.x, Math.PI, 0);
  group.add(sightAnchor);

  const foregripAnchor = new THREE.Object3D();
  foregripAnchor.name = 'foregripAnchor';
  foregripAnchor.position.set(foregripOffset.x, foregripOffset.y, foregripOffset.z);
  group.add(foregripAnchor);

  group.scale.setScalar(viewModel ? 0.96 : 0.86);

  return {
    group,
    weaponId: spec.id,
    spec,
    muzzleOffset,
    gripOffset,
    foregripOffset,
    sightOffset,
    vrErgonomics,
    muzzle,
    gripAnchor,
    sightAnchor,
    foregripAnchor,
    animParts,
    dispose: () => {
      group.parent?.remove(group);
    }
  };
}

export function animateCombatWeaponMesh(weaponObj, { elapsed = 0, recoil = 0, pumpPhase = 0 } = {}) {
  if (!weaponObj?.animParts) return;
  const parts = weaponObj.animParts;

  if (parts.fiberStrands) {
    const pulse = 0.85 + 0.3 * Math.sin(elapsed * 8.5);
    for (let i = 0; i < parts.fiberStrands.length; i++) {
      parts.fiberStrands[i].scale.set(pulse, 1, pulse);
    }
  }
  if (parts.pump) {
    const slide = Math.sin(Math.min(1, Math.max(0, pumpPhase)) * Math.PI) * 0.085 + recoil * 0.03;
    parts.pump.position.z = -0.35 + slide;
  }
  if (parts.coils) {
    for (let i = 0; i < parts.coils.length; i++) {
      const s = 0.92 + 0.16 * Math.sin(elapsed * 7 - i * 0.65);
      parts.coils[i].scale.set(s, 1, 1);
    }
  }
  if (parts.hotTip) {
    const s = 0.96 + 0.08 * Math.sin(elapsed * 12);
    parts.hotTip.scale.set(s, 1, s);
  }
  if (parts.arc) {
    const flicker = Math.sin(elapsed * 38) > -0.15;
    parts.arc.visible = flicker;
    parts.arc.rotation.z = Math.sin(elapsed * 29) * 0.35;
  }
  if (parts.rgbEdge) {
    const s = 0.95 + 0.1 * Math.sin(elapsed * 9);
    parts.rgbEdge.scale.set(s, 1, 1);
  }
  if (parts.leds) {
    const stepIdx = Math.floor(elapsed * 6);
    for (let i = 0; i < parts.leds.length; i++) {
      parts.leds[i].visible = ((stepIdx + i * 3) % 4) !== 0;
    }
  }
}

export function createCombatVfxPool(scene) {
  const beamPool = [];
  const sinePool = [];
  const sparkPool = [];
  const slashPool = [];

  const beamGeom = new THREE.CylinderGeometry(0.018, 0.018, 1, 6);
  for (let i = 0; i < 36; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: '#22d3ee',
      transparent: true,
      opacity: 0.9
    });
    const mesh = new THREE.Mesh(beamGeom, mat);
    mesh.visible = false;
    scene?.add?.(mesh);
    beamPool.push({ mesh, mat, ttl: 0, maxTtl: 0.14 });
  }

  const sinePointCount = 28;
  for (let i = 0; i < 4; i++) {
    const positions = new Float32Array(sinePointCount * 3);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: '#a855f7',
      transparent: true,
      opacity: 0.95
    });
    const line = new THREE.Line(geom, mat);
    line.visible = false;
    line.frustumCulled = false;
    scene?.add?.(line);
    sinePool.push({ line, geom, positions, mat, ttl: 0, maxTtl: 0.32 });
  }

  const sparkGeom = new THREE.BoxGeometry(0.048, 0.048, 0.048);
  for (let i = 0; i < 48; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: '#fde047',
      transparent: true,
      opacity: 0.95
    });
    const mesh = new THREE.Mesh(sparkGeom, mat);
    mesh.visible = false;
    scene?.add?.(mesh);
    sparkPool.push({ mesh, mat, vx: 0, vy: 0, vz: 0, ttl: 0, maxTtl: 0.28 });
  }

  const slashGeom = new THREE.RingGeometry(0.55, 1.05, 18, 1, Math.PI * 0.08, Math.PI * 0.84);
  slashGeom.rotateX(-Math.PI / 2);
  for (let i = 0; i < 8; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    const mesh = new THREE.Mesh(slashGeom, mat);
    mesh.visible = false;
    scene?.add?.(mesh);
    slashPool.push({ mesh, mat, ttl: 0, maxTtl: 0.2, startYaw: 0 });
  }

  const _vStart = new THREE.Vector3();
  const _vEnd = new THREE.Vector3();
  const _vDir = new THREE.Vector3();
  const _vMid = new THREE.Vector3();
  const _vSide = new THREE.Vector3();
  const _vUp = new THREE.Vector3(0, 1, 0);
  const _qA = new THREE.Quaternion();

  function acquireSlot(pool) {
    let oldest = pool[0];
    for (let i = 0; i < pool.length; i++) {
      if (pool[i].ttl <= 0) return pool[i];
      if (pool[i].ttl < oldest.ttl) oldest = pool[i];
    }
    return oldest;
  }

  let particleScale = 1.0;

  function setParticleScale(scale = 1.0) {
    const n = Number(scale);
    particleScale = Number.isFinite(n) ? Math.max(0.25, Math.min(1.0, n)) : 1.0;
  }

  function spawnImpactSparks(x, y, z, colorHex = '#fde047', count = 6) {
    const scaled = Math.round((Number(count) || 6) * particleScale);
    const n = Math.max(1, Math.min(12, scaled | 0));
    for (let i = 0; i < n; i++) {
      const slot = acquireSlot(sparkPool);
      const ang = (i / n) * Math.PI * 2 + (i % 3) * 0.35;
      const spd = 2.1 + (i % 4) * 0.95;
      slot.mesh.position.set(x, y, z);
      slot.mesh.scale.setScalar(1);
      slot.mat.color.set(colorHex);
      slot.mat.opacity = 1;
      slot.vx = Math.cos(ang) * spd;
      slot.vy = 1.6 + (i % 3) * 0.85;
      slot.vz = Math.sin(ang) * spd;
      slot.ttl = 0.26;
      slot.maxTtl = 0.26;
      slot.mesh.visible = true;
    }
  }

  function spawnShot(weaponId, sx, sy, sz, ex, ey, ez) {
    const spec = getCombatWeaponById(weaponId) || COMBAT_WEAPONS[0];
    _vStart.set(sx, sy, sz);
    _vEnd.set(ex, ey, ez);
    _vDir.subVectors(_vEnd, _vStart);
    const len = _vDir.length();
    if (len < 0.05) return;
    _vDir.divideScalar(len);
    _vMid.addVectors(_vStart, _vEnd).multiplyScalar(0.5);

    const beamSlot = acquireSlot(beamPool);
    _qA.setFromUnitVectors(_vUp, _vDir);
    beamSlot.mesh.position.copy(_vMid);
    beamSlot.mesh.quaternion.copy(_qA);
    const thick = spec.style === 'sine_rail' ? 1.55 : spec.style === 'packet' ? 1.3 : 1.0;
    beamSlot.mesh.scale.set(thick, len, thick);
    beamSlot.mat.color.set(spec.beamColor || '#22d3ee');
    beamSlot.mat.opacity = 0.95;
    beamSlot.maxTtl = spec.style === 'sine_rail' ? 0.28 : 0.13;
    beamSlot.ttl = beamSlot.maxTtl;
    beamSlot.mesh.visible = true;

    if (spec.style === 'sine_rail') {
      const sSlot = acquireSlot(sinePool);
      _vSide.crossVectors(_vDir, _vUp);
      if (_vSide.lengthSq() < 0.001) {
        _vSide.set(1, 0, 0);
      } else {
        _vSide.normalize();
      }
      for (let i = 0; i < sinePointCount; i++) {
        const t = i / (sinePointCount - 1);
        const amp = Math.sin(t * Math.PI * 8) * 0.14 * Math.sin(t * Math.PI);
        const px = sx + (ex - sx) * t + _vSide.x * amp;
        const py = sy + (ey - sy) * t + Math.cos(t * Math.PI * 8) * 0.05;
        const pz = sz + (ez - sz) * t + _vSide.z * amp;
        sSlot.positions[i * 3] = px;
        sSlot.positions[i * 3 + 1] = py;
        sSlot.positions[i * 3 + 2] = pz;
      }
      sSlot.geom.attributes.position.needsUpdate = true;
      sSlot.mat.color.set(spec.beamColor || '#a855f7');
      sSlot.mat.opacity = 1;
      sSlot.ttl = sSlot.maxTtl;
      sSlot.line.visible = true;
    }

    spawnImpactSparks(ex, ey, ez, spec.sparkColor || '#fde047', spec.style === 'packet' ? 3 : 5);
  }

  function spawnMeleeSlash(weaponId, ox, oy, oz, yaw = 0) {
    const spec = getCombatWeaponById(weaponId) || getDefaultWeaponForMode('melee');
    const slot = acquireSlot(slashPool);
    const radiusScale = spec.aoeRadius > 0 ? spec.aoeRadius * 0.8 : (spec.range || 2.4) * 0.55;
    slot.mesh.position.set(
      ox - Math.sin(yaw) * 0.72,
      oy,
      oz - Math.cos(yaw) * 0.72
    );
    slot.mesh.rotation.set(0, yaw, 0);
    slot.mesh.scale.setScalar(Math.max(0.6, radiusScale));
    slot.mat.color.set(spec.beamColor || '#38bdf8');
    slot.mat.opacity = 0.92;
    slot.ttl = slot.maxTtl;
    slot.mesh.visible = true;

    spawnImpactSparks(
      ox - Math.sin(yaw) * 1.1,
      oy,
      oz - Math.cos(yaw) * 1.1,
      spec.sparkColor || '#fde047',
      6
    );
  }

  function update(dt = 0.016) {
    const step = Math.max(0.001, Math.min(0.1, Number(dt) || 0.016));
    for (let i = 0; i < beamPool.length; i++) {
      const b = beamPool[i];
      if (b.ttl <= 0) continue;
      b.ttl -= step;
      if (b.ttl <= 0) {
        b.mesh.visible = false;
      } else {
        b.mat.opacity = Math.max(0, b.ttl / b.maxTtl);
      }
    }
    for (let i = 0; i < sinePool.length; i++) {
      const s = sinePool[i];
      if (s.ttl <= 0) continue;
      s.ttl -= step;
      if (s.ttl <= 0) {
        s.line.visible = false;
      } else {
        s.mat.opacity = Math.max(0, s.ttl / s.maxTtl);
      }
    }
    for (let i = 0; i < sparkPool.length; i++) {
      const sp = sparkPool[i];
      if (sp.ttl <= 0) continue;
      sp.ttl -= step;
      if (sp.ttl <= 0) {
        sp.mesh.visible = false;
      } else {
        sp.vy -= 9.8 * step;
        sp.mesh.position.x += sp.vx * step;
        sp.mesh.position.y = Math.max(0.04, sp.mesh.position.y + sp.vy * step);
        sp.mesh.position.z += sp.vz * step;
        sp.mat.opacity = Math.max(0, sp.ttl / sp.maxTtl);
        sp.mesh.scale.setScalar(0.4 + 0.6 * (sp.ttl / sp.maxTtl));
      }
    }
    for (let i = 0; i < slashPool.length; i++) {
      const sl = slashPool[i];
      if (sl.ttl <= 0) continue;
      sl.ttl -= step;
      if (sl.ttl <= 0) {
        sl.mesh.visible = false;
      } else {
        sl.mat.opacity = Math.max(0, sl.ttl / sl.maxTtl);
      }
    }
  }

  function clear() {
    for (const b of beamPool) {
      b.ttl = 0;
      b.mesh.visible = false;
    }
    for (const s of sinePool) {
      s.ttl = 0;
      s.line.visible = false;
    }
    for (const sp of sparkPool) {
      sp.ttl = 0;
      sp.mesh.visible = false;
    }
    for (const sl of slashPool) {
      sl.ttl = 0;
      sl.mesh.visible = false;
    }
  }

  function dispose() {
    clear();
    beamGeom.dispose();
    sparkGeom.dispose();
    slashGeom.dispose();
    for (const b of beamPool) {
      b.mesh.parent?.remove(b.mesh);
      b.mat.dispose();
    }
    for (const s of sinePool) {
      s.line.parent?.remove(s.line);
      s.geom.dispose();
      s.mat.dispose();
    }
    for (const sp of sparkPool) {
      sp.mesh.parent?.remove(sp.mesh);
      sp.mat.dispose();
    }
    for (const sl of slashPool) {
      sl.mesh.parent?.remove(sl.mesh);
      sl.mat.dispose();
    }
  }

  return {
    spawnShot,
    spawnMeleeSlash,
    spawnImpactSparks,
    setParticleScale,
    update,
    clear,
    getPoolStats: () => ({
      beams: beamPool.length,
      sineRails: sinePool.length,
      sparks: sparkPool.length,
      slashes: slashPool.length
    }),
    dispose
  };
}
