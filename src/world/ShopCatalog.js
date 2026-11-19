export const SHOP_RARITIES = {
  common: {
    id: 'common',
    label: 'Commun',
    color: '#94a3b8',
    bgColor: 'rgba(148, 163, 184, 0.18)',
    borderColor: '#64748b',
    glowColor: '#cbd5e1',
    order: 1
  },
  rare: {
    id: 'rare',
    label: 'Rare',
    color: '#38bdf8',
    bgColor: 'rgba(56, 189, 248, 0.18)',
    borderColor: '#0284c7',
    glowColor: '#7dd3fc',
    order: 2
  },
  epic: {
    id: 'epic',
    label: 'Épique',
    color: '#c084fc',
    bgColor: 'rgba(192, 132, 252, 0.2)',
    borderColor: '#9333ea',
    glowColor: '#e879f9',
    order: 3
  },
  legendary: {
    id: 'legendary',
    label: 'Légendaire',
    color: '#fbbf24',
    bgColor: 'rgba(251, 191, 36, 0.24)',
    borderColor: '#d97706',
    glowColor: '#fde68a',
    order: 4
  }
};

export const SHOP_CATEGORIES = [
  { id: 'skins', label: 'Skins Exclusifs', shortLabel: 'Skins', icon: '👕' },
  { id: 'pets', label: 'Compagnons Pets 3D', shortLabel: 'Pets 3D', icon: '🐾' },
  { id: 'accessories', label: 'Accessoires & Auras', shortLabel: 'Accessoires', icon: '✨' }
];

export const SHOP_SKINS = [
  {
    id: 'shop_neon_tech',
    category: 'skins',
    name: 'Technicien Néon',
    rarity: 'common',
    price: 150,
    icon: '💡',
    description: 'Veste technique à bandes électroluminescentes cyan pour le câblage en salle serveur.',
    outfitStyle: 'cyber',
    outfitColor: '#06b6d4',
    pantsColor: '#0f172a',
    hat: 'glasses',
    accentColor: '#22d3ee',
    emissiveColor: '#06b6d4',
    visorColor: '#67e8f9',
    trimColor: '#38bdf8'
  },
  {
    id: 'shop_agent_soc',
    category: 'skins',
    name: 'Agent SOC',
    rarity: 'common',
    price: 280,
    icon: '🛡️',
    description: 'Tenue d’analyste Security Operations Center avec casque tactique et écusson pare-feu.',
    outfitStyle: 'hoodie',
    outfitColor: '#1e293b',
    pantsColor: '#090d16',
    hat: 'headset',
    accentColor: '#38bdf8',
    emissiveColor: '#0284c7',
    visorColor: '#38bdf8',
    trimColor: '#60a5fa'
  },
  {
    id: 'shop_fiber_eng',
    category: 'skins',
    name: 'Ingénieur Fibre Optique',
    rarity: 'rare',
    price: 450,
    icon: '🌐',
    description: 'Blouse photonique traversée de brins laser haute vitesse 100 Gbps et lunettes de réflectométrie.',
    outfitStyle: 'lab',
    outfitColor: '#0284c7',
    pantsColor: '#1e293b',
    hat: 'vr',
    accentColor: '#7dd3fc',
    emissiveColor: '#22d3ee',
    visorColor: '#38bdf8',
    trimColor: '#e0f2fe'
  },
  {
    id: 'shop_steampunk_copper',
    category: 'skins',
    name: 'Steampunk Cuivre',
    rarity: 'rare',
    price: 650,
    icon: '⚙️',
    description: 'Armure d’horloger-électronicien en cuivre brossé, bobines de laiton et manomètres analogiques.',
    outfitStyle: 'sport',
    outfitColor: '#b45309',
    pantsColor: '#451a03',
    hat: 'cap',
    accentColor: '#f59e0b',
    emissiveColor: '#d97706',
    visorColor: '#fcd34d',
    trimColor: '#fde68a'
  },
  {
    id: 'shop_hacker_matrix',
    category: 'skins',
    name: 'Hacker Matrix',
    rarity: 'epic',
    price: 950,
    icon: '💻',
    description: 'Manteau sombre codé en flux binaire vert phosphoré avec lunettes terminales cryptées.',
    outfitStyle: 'cyber',
    outfitColor: '#052e16',
    pantsColor: '#022c22',
    hat: 'glasses',
    accentColor: '#10b981',
    emissiveColor: '#22c55e',
    visorColor: '#4ade80',
    trimColor: '#86efac'
  },
  {
    id: 'shop_network_astro',
    category: 'skins',
    name: 'Astronaute Réseau',
    rarity: 'epic',
    price: 1300,
    icon: '👨‍🚀',
    description: 'Combinaison orbitale SatCom avec visière télémétrique et propulseur dorsal de liaison satellite.',
    outfitStyle: 'lab',
    outfitColor: '#f1f5f9',
    pantsColor: '#334155',
    hat: 'vr',
    accentColor: '#38bdf8',
    emissiveColor: '#60a5fa',
    visorColor: '#22d3ee',
    trimColor: '#93c5fd'
  },
  {
    id: 'shop_cyber_samurai',
    category: 'skins',
    name: 'Cyber-Samouraï',
    rarity: 'legendary',
    price: 1850,
    icon: '⚔️',
    description: 'Armure néo-féodale carbone & néon carmin équipée de plaques énergétiques et lame katana optique.',
    outfitStyle: 'cyber',
    outfitColor: '#991b1b',
    pantsColor: '#111827',
    hat: 'crown',
    accentColor: '#f43f5e',
    emissiveColor: '#fb7185',
    visorColor: '#fda4af',
    trimColor: '#fecdd3'
  },
  {
    id: 'shop_overclocked_gold',
    category: 'skins',
    name: 'Overclocked Gold',
    rarity: 'legendary',
    price: 2500,
    icon: '👑',
    description: 'Exosquelette plaqué or 24 carats refroidi à l’azote liquide avec circuits surcadencés à 8 GHz.',
    outfitStyle: 'cyber',
    outfitColor: '#f59e0b',
    pantsColor: '#1c1917',
    hat: 'crown',
    accentColor: '#fde047',
    emissiveColor: '#fbbf24',
    visorColor: '#fef08a',
    trimColor: '#ffffff'
  }
];

export const SHOP_PETS = [
  {
    id: 'pet_cube_holo',
    category: 'pets',
    name: 'Cube Hologramme',
    rarity: 'common',
    price: 200,
    icon: '🧊',
    description: 'Tesseract quantique flottant qui tourne en lévitation et projette des octets lumineux.',
    motionType: 'float',
    primaryColor: '#22d3ee',
    accentColor: '#a855f7',
    emissiveColor: '#38bdf8'
  },
  {
    id: 'pet_router_wifi7',
    category: 'pets',
    name: 'Petit Routeur Wi-Fi 7',
    rarity: 'rare',
    price: 400,
    icon: '📡',
    description: 'Mini-routeur quad-bande à pattes articulées, 4 antennes orientables et LEDs de trafic réseau.',
    motionType: 'walk',
    primaryColor: '#0284c7',
    accentColor: '#10b981',
    emissiveColor: '#34d399'
  },
  {
    id: 'pet_bot_rack1u',
    category: 'pets',
    name: 'Bot Serveur Rack 1U',
    rarity: 'rare',
    price: 600,
    icon: '🖥️',
    description: 'Châssis serveur 1U autonome sur pattes mécaniques avec écran facial LED et ports SFP+ clignotants.',
    motionType: 'walk',
    primaryColor: '#334155',
    accentColor: '#38bdf8',
    emissiveColor: '#22d3ee'
  },
  {
    id: 'pet_drone_quadri',
    category: 'pets',
    name: 'Mini-Drone Quadri',
    rarity: 'epic',
    price: 900,
    icon: '🚁',
    description: 'Quadricoptère d’inspection thermique à 4 rotors rapides et nacelle caméra stabilisée.',
    motionType: 'hover',
    primaryColor: '#6366f1',
    accentColor: '#22d3ee',
    emissiveColor: '#818cf8'
  },
  {
    id: 'pet_cyber_k9',
    category: 'pets',
    name: 'Berger Cyber-K9',
    rarity: 'epic',
    price: 1400,
    icon: '🐕',
    description: 'Chien robotique quadrupède inspiré de la robotique industrielle, fidèle éclaireur de l’atelier.',
    motionType: 'trot',
    primaryColor: '#f59e0b',
    accentColor: '#38bdf8',
    emissiveColor: '#22d3ee'
  },
  {
    id: 'pet_laser_falcon',
    category: 'pets',
    name: 'Faucon Laser',
    rarity: 'legendary',
    price: 2200,
    icon: '🦅',
    description: 'Rapace bionique aux ailes photoniques articulées qui plane majestueusement autour de vous.',
    motionType: 'soar',
    primaryColor: '#f43f5e',
    accentColor: '#fbbf24',
    emissiveColor: '#fb7185'
  }
];

export const SHOP_ACCESSORIES = [
  {
    id: 'acc_holo_visor',
    category: 'accessories',
    name: 'Visière Tactique Holo',
    rarity: 'common',
    price: 180,
    icon: '🥽',
    description: 'Visière HUD translucide projetant les constantes réseau devant les yeux de votre avatar.',
    subType: 'visor',
    primaryColor: '#22d3ee',
    accentColor: '#38bdf8',
    emissiveColor: '#06b6d4'
  },
  {
    id: 'acc_binary_aura',
    category: 'accessories',
    name: 'Aura Flux Binaire',
    rarity: 'rare',
    price: 500,
    icon: '🔢',
    description: 'Anneau orbital de bits et paquets lumineux émeraude gravitant autour de l’élève.',
    subType: 'aura',
    primaryColor: '#10b981',
    accentColor: '#34d399',
    emissiveColor: '#22c55e'
  },
  {
    id: 'acc_neon_circuit_trail',
    category: 'accessories',
    name: 'Sillage Circuit Néon',
    rarity: 'epic',
    price: 850,
    icon: '⚡',
    description: 'Traînée énergétique cyber-violette et cyan générant des impulsions au sol en marchant.',
    subType: 'trail',
    primaryColor: '#a855f7',
    accentColor: '#22d3ee',
    emissiveColor: '#c084fc'
  },
  {
    id: 'acc_cyber_halo_ears',
    category: 'accessories',
    name: 'Casque Cyber-Holo Pro',
    rarity: 'epic',
    price: 1150,
    icon: '🎧',
    description: 'Arceau acoustique néon rose & cyan surmonté d’un halo géométrique flottant.',
    subType: 'headgear',
    primaryColor: '#ec4899',
    accentColor: '#22d3ee',
    emissiveColor: '#f472b6'
  },
  {
    id: 'acc_quantum_wings',
    category: 'accessories',
    name: 'Ailes & Couronne Plasma',
    rarity: 'legendary',
    price: 1650,
    icon: '🪽',
    description: 'Paire d’ailes vectorielles plasma dorées et couronne énergétique de haute maîtrise.',
    subType: 'wings',
    primaryColor: '#fbbf24',
    accentColor: '#f43f5e',
    emissiveColor: '#fde047'
  }
];

export const SHOP_CATALOG = [...SHOP_SKINS, ...SHOP_PETS, ...SHOP_ACCESSORIES];

const CATALOG_BY_ID = new Map(SHOP_CATALOG.map((item) => [item.id, item]));
const SKIN_MAP = new Map(SHOP_SKINS.map((item) => [item.id, item]));
const PET_MAP = new Map(SHOP_PETS.map((item) => [item.id, item]));
const ACCESSORY_MAP = new Map(SHOP_ACCESSORIES.map((item) => [item.id, item]));

export function getShopItemById(itemId) {
  if (!itemId || typeof itemId !== 'string') return null;
  return CATALOG_BY_ID.get(itemId.trim()) || null;
}

export function getShopSkinById(skinId) {
  if (!skinId || typeof skinId !== 'string') return null;
  return SKIN_MAP.get(skinId.trim()) || null;
}

export function getShopPetById(petId) {
  if (!petId || typeof petId !== 'string') return null;
  return PET_MAP.get(petId.trim()) || null;
}

export function getShopAccessoryById(accId) {
  if (!accId || typeof accId !== 'string') return null;
  return ACCESSORY_MAP.get(accId.trim()) || null;
}

export function isShopSkinId(skinId) {
  return Boolean(getShopSkinById(skinId));
}

export function isShopPetId(petId) {
  return Boolean(getShopPetById(petId));
}

export function isShopAccessoryId(accId) {
  return Boolean(getShopAccessoryById(accId));
}

export function getShopItemsByCategory(category = 'skins') {
  if (category === 'skins') return SHOP_SKINS;
  if (category === 'pets') return SHOP_PETS;
  if (category === 'accessories') return SHOP_ACCESSORIES;
  return SHOP_CATALOG;
}

export function getRarityMeta(rarityId = 'common') {
  return SHOP_RARITIES[rarityId] || SHOP_RARITIES.common;
}

export function computeTpCoinReward({
  score = 0,
  isFirstValidation = false
} = {}) {
  const numScore = Number(score);
  if (!Number.isFinite(numScore) || numScore <= 0) {
    return {
      totalCoins: 0,
      baseCoins: 0,
      firstValidationBonus: 0,
      averageBonus: 0
    };
  }
  const clamped = Math.max(0, Math.min(20, numScore));
  let baseCoins = 0;
  if (clamped < 10) {
    baseCoins = Math.max(5, Math.round((clamped / 10) * 15));
  } else if (clamped <= 15) {
    baseCoins = Math.round(25 + ((clamped - 10) / 5) * 25);
  } else {
    baseCoins = Math.round(50 + ((clamped - 15) / 5) * 50);
  }

  const firstValidationBonus = clamped >= 10 && isFirstValidation ? 50 : 0;
  const averageBonus = 0;

  const totalCoins = baseCoins + firstValidationBonus;
  return {
    totalCoins,
    baseCoins,
    firstValidationBonus,
    averageBonus
  };
}

export const SURVIVAL_VICTORY_COINS = 150;
export const SURVIVAL_DEFEAT_COINS = 40;
export const DETENTION_TABLE_COIN_REWARD = 15;
export const MAX_DETENTION_TABLES_PER_MATCH = 6;
export const COMBAT_VICTORY_COINS = 120;
export const COMBAT_PARTICIPATION_COINS = 40;
export const COMBAT_KILL_COIN_BONUS = 10;
export const COMBAT_MAX_COINS_PER_MATCH = 240;

export function computeCombatCoinReward({ won = false, kills = 0 } = {}) {
  const isWin = Boolean(won);
  const baseCoins = isWin ? COMBAT_VICTORY_COINS : COMBAT_PARTICIPATION_COINS;
  const cleanKills = Math.max(0, Math.floor(Number(kills) || 0));
  const killBonus = Math.min(120, cleanKills * COMBAT_KILL_COIN_BONUS);
  const totalCoins = Math.min(COMBAT_MAX_COINS_PER_MATCH, baseCoins + killBonus);
  return {
    totalCoins,
    baseCoins,
    killBonus,
    kills: cleanKills,
    won: isWin
  };
}

export function computeSurvivalCoinReward({ outcome = 'defeat', solvedTables = 0 } = {}) {
  const isVictory = outcome === 'victory';
  const baseCoins = isVictory ? SURVIVAL_VICTORY_COINS : SURVIVAL_DEFEAT_COINS;
  const clampedSolved = Math.max(
    0,
    Math.min(MAX_DETENTION_TABLES_PER_MATCH, Math.floor(Number(solvedTables) || 0))
  );
  const detentionBonus = clampedSolved * DETENTION_TABLE_COIN_REWARD;
  return {
    totalCoins: baseCoins + detentionBonus,
    baseCoins,
    detentionBonus,
    solvedTables: clampedSolved
  };
}

export function computeDetentionTableCoinReward({ solvedInMatch = 0 } = {}) {
  const count = Math.max(0, Math.floor(Number(solvedInMatch) || 0));
  if (count >= MAX_DETENTION_TABLES_PER_MATCH) {
    return 0;
  }
  return DETENTION_TABLE_COIN_REWARD;
}

export const ARCADE_GAME_RULES = {
  snake: {
    id: 'snake',
    label: 'Cyber Snake',
    maxValidScore: 5000,
    tiers: [
      { min: 10, coins: 10 },
      { min: 60, coins: 20 },
      { min: 140, coins: 32 },
      { min: 240, coins: 45 }
    ]
  },
  minesweeper: {
    id: 'minesweeper',
    label: 'Démineur Réseau',
    maxValidScore: 5000,
    tiers: [
      { min: 20, coins: 10 },
      { min: 90, coins: 22 },
      { min: 200, coins: 35 },
      { min: 320, coins: 45 }
    ]
  },
  tetris: {
    id: 'tetris',
    label: 'CIEL-Blocks',
    maxValidScore: 100000,
    tiers: [
      { min: 80, coins: 10 },
      { min: 400, coins: 22 },
      { min: 1000, coins: 35 },
      { min: 2000, coins: 45 }
    ]
  },
  breakout: {
    id: 'breakout',
    label: 'Casse-Briques Firewall',
    maxValidScore: 30000,
    tiers: [
      { min: 40, coins: 10 },
      { min: 180, coins: 22 },
      { min: 400, coins: 35 },
      { min: 650, coins: 45 }
    ]
  },
  flappy: {
    id: 'flappy',
    label: 'Flappy Packet',
    maxValidScore: 1500,
    tiers: [
      { min: 1, coins: 10 },
      { min: 6, coins: 22 },
      { min: 14, coins: 35 },
      { min: 25, coins: 45 }
    ]
  },
  game2048: {
    id: 'game2048',
    label: '2048 CIEL',
    maxValidScore: 250000,
    tiers: [
      { min: 64, coins: 10 },
      { min: 320, coins: 20 },
      { min: 900, coins: 32 },
      { min: 2048, coins: 45 }
    ]
  }
};

export const ARCADE_NEW_RECORD_BONUS = 15;

export function computeArcadeCoinReward({ gameId, score = 0, isNewRecord = false } = {}) {
  const cleanId = String(gameId || '').trim();
  const rule = ARCADE_GAME_RULES[cleanId];
  const numScore = Math.floor(Number(score) || 0);
  if (!rule || !Number.isFinite(numScore) || numScore <= 0 || numScore > rule.maxValidScore) {
    return {
      valid: false,
      totalCoins: 0,
      baseCoins: 0,
      recordBonus: 0,
      tierIndex: 0
    };
  }

  let baseCoins = 0;
  let tierIndex = 0;
  for (let i = 0; i < rule.tiers.length; i++) {
    if (numScore >= rule.tiers[i].min) {
      baseCoins = rule.tiers[i].coins;
      tierIndex = i + 1;
    }
  }
  if (baseCoins === 0 && numScore > 0) {
    baseCoins = 10;
    tierIndex = 1;
  }

  const recordBonus = baseCoins > 0 && isNewRecord ? ARCADE_NEW_RECORD_BONUS : 0;
  return {
    valid: true,
    totalCoins: baseCoins + recordBonus,
    baseCoins,
    recordBonus,
    tierIndex
  };
}
