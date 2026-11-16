export const YANFUFU_VIP_TIER = 7;

export const BATTLE_PASS_SKIN_CATALOG = [
  {
    tier: 1,
    id: 'bp_tier_1',
    rarity: 'rare',
    rarityLabel: 'RARE',
    name: 'Skin « Hackeur Matrix »',
    shortName: 'Hackeur Matrix',
    icon: '💚',
    stat: '💚 Aura Matrix 3D • Vision binaire verte',
    desc: 'Tenue noire mate avec liserés néon vert fluo, visière cyber verte et aura de particules Matrix animées en 3D.',
    accentColor: '#22c55e',
    vipChambreAccess: false,
    showcase: {
      materialTheme: 'matrix',
      accessories: ['cyber_visor'],
      particles: 'matrix',
      visorColor: '#22c55e'
    },
    aliases: ['bp_tier_1', 'vip_tier_1', 'tier_1', 'matrix', 'hackeur_matrix']
  },
  {
    tier: 2,
    id: 'bp_tier_2',
    rarity: 'epic',
    rarityLabel: 'ÉPIQUE',
    name: 'Accessoire 3D « Casque VR Or 24 Carats »',
    shortName: 'Casque VR Or 24K',
    icon: '🥽',
    stat: '🥽 Or 24 Carats • Écran frontal LED cyan',
    desc: 'Modèle 3D doré brillant vissé sur la tête avec écran LED lumineux pour coder vos TPs en immersion totale.',
    accentColor: '#fbbf24',
    vipChambreAccess: false,
    showcase: {
      materialTheme: 'cyber_gold',
      accessories: ['vr_gold'],
      particles: null
    },
    aliases: ['bp_tier_2', 'vip_tier_2', 'tier_2', 'vr_gold']
  },
  {
    tier: 3,
    id: 'bp_tier_3',
    rarity: 'epic',
    rarityLabel: 'ÉPIQUE',
    name: 'Compagnon 3D « Mini-Drone Switch Cisco »',
    shortName: 'Drone Switch Cisco',
    icon: '🛸',
    stat: '🛸 Drone orbital • LEDs Cisco temps réel',
    desc: 'Mini-switch Cisco autonome équipé de LEDs clignotantes qui flotte et gravite au-dessus de votre épaule.',
    accentColor: '#38bdf8',
    vipChambreAccess: false,
    showcase: {
      materialTheme: null,
      accessories: ['cisco_drone'],
      particles: null
    },
    aliases: ['bp_tier_3', 'vip_tier_3', 'tier_3', 'cisco_drone']
  },
  {
    tier: 4,
    id: 'bp_tier_4',
    rarity: 'legendary',
    rarityLabel: 'LÉGENDAIRE',
    name: 'Skin « Ingénieur Réseau RGB »',
    shortName: 'Ingénieur RGB',
    icon: '🚀',
    stat: '🚀 Jetpack RGB dorsal • Liserés LED cycliques',
    desc: 'Blouse de labo chromée réfléchissante avec bandes LED animées à 16M de couleurs + Jetpack RGB dans le dos.',
    accentColor: '#22d3ee',
    vipChambreAccess: false,
    showcase: {
      materialTheme: 'chrome_rgb',
      accessories: ['jetpack_rgb'],
      particles: null
    },
    aliases: ['bp_tier_4', 'vip_tier_4', 'tier_4', 'chrome_rgb']
  },
  {
    tier: 5,
    id: 'bp_tier_5',
    rarity: 'epic',
    rarityLabel: 'ÉPIQUE',
    name: 'Titre & Aura « Roi de la Brasure U301 »',
    shortName: 'Roi Brasure U301',
    icon: '🔥',
    stat: '🔥 +500% de précision au fer à souder',
    desc: 'Étincelles d’étain dorées en 3D autour du personnage + bonus +500% de précision au fer à souder.',
    accentColor: '#f59e0b',
    vipChambreAccess: false,
    showcase: {
      materialTheme: 'cyber_gold',
      accessories: ['cyber_visor'],
      particles: 'sparks_gold',
      visorColor: '#fbbf24'
    },
    aliases: ['bp_tier_5', 'vip_tier_5', 'tier_5', 'roi_brasure']
  },
  {
    tier: 6,
    id: 'bp_tier_6',
    rarity: 'legendary',
    rarityLabel: 'LÉGENDAIRE',
    name: 'Skin « Cyborg RTX 5090 Ti »',
    shortName: 'Cyborg RTX 5090 Ti',
    icon: '⚡',
    stat: '⚡ Armure Carbone • Double turbine 12000 RPM',
    desc: 'Armure métallique noire et verte, visière cyber 3D à antennes et ventilateurs lumineux rotatifs dans le dos.',
    accentColor: '#4ade80',
    vipChambreAccess: false,
    showcase: {
      materialTheme: 'carbon_neon',
      accessories: ['cyber_visor', 'rtx_fans'],
      particles: null,
      visorColor: '#4ade80'
    },
    aliases: ['bp_tier_6', 'vip_tier_6', 'tier_6', 'rtx_5090']
  },
  {
    tier: 7,
    id: 'bp_tier_7',
    rarity: 'legendary',
    rarityLabel: 'LÉGENDAIRE',
    name: 'Passe VIP « Clé Maîtresse Baie Serveur »',
    shortName: 'Passe VIP Clé Maîtresse',
    icon: '🔑',
    stat: '🔑 Badge VIP Or 3D • Accès illimité Chambre',
    desc: 'Badge doré 3D sur le torse, clé maîtresse flottante et accès illimité à la salle Chambre.',
    accentColor: '#fbbf24',
    vipChambreAccess: true,
    showcase: {
      materialTheme: 'cyber_gold',
      accessories: ['vip_badge', 'cisco_drone'],
      particles: 'sparks_gold'
    },
    aliases: [
      'bp_tier_7',
      'vip_tier_7',
      'vip_7',
      'tier_7',
      'vip_baie_serveur',
      'cle_maitresse',
      'passe_vip_7'
    ]
  },
  {
    tier: 8,
    id: 'bp_tier_8',
    rarity: 'mythic',
    rarityLabel: 'MYTHIQUE',
    name: 'Boost Ultime « Moyenne 20/20 Automatique »',
    shortName: 'Halo Doré 20/20',
    icon: '👼',
    stat: '👼 Halo doré 3D • Validation instantanée des TPs',
    desc: 'Armure Or 24K + Halo doré flottant en 3D et validation instantanée à 20/20 de tous les TPs.',
    accentColor: '#fde047',
    vipChambreAccess: false,
    showcase: {
      materialTheme: 'gold24k',
      accessories: ['gold_halo'],
      particles: 'sparks_gold'
    },
    aliases: ['bp_tier_8', 'vip_tier_8', 'tier_8', 'halo_20']
  },
  {
    tier: 9,
    id: 'bp_tier_9',
    rarity: 'mythic',
    rarityLabel: 'MYTHIQUE',
    name: 'Skin « Boss Final CIEL — Armure Diamant »',
    shortName: 'Armure Diamant',
    icon: '💎',
    stat: '💎 Cristal Diamant facetté • Éclairs cyan 3D',
    desc: 'Corps entièrement texturé cristal/diamant bleu brillant avec aura d’éclairs cyan tournant en 3D.',
    accentColor: '#22d3ee',
    vipChambreAccess: false,
    showcase: {
      materialTheme: 'diamond',
      accessories: ['cyber_visor', 'jetpack_rgb'],
      particles: 'lightning_cyan',
      visorColor: '#e0f2fe'
    },
    aliases: ['bp_tier_9', 'vip_tier_9', 'tier_9', 'diamond']
  },
  {
    tier: 10,
    id: 'bp_tier_10',
    rarity: 'ultimate',
    rarityLabel: 'ULTIME',
    ultimate: true,
    name: '👑 PERM ADMIN COMPLÈTE + Couronne Royale 3D',
    shortName: 'Couronne Royale 3D',
    icon: '👑',
    stat: '👑 Couronne 3D • Panel /admin & Contrôle Serveur',
    desc: 'Couronne dorée 3D flottante + armure Or 24K + accès total au panel /admin, kick/ban des élèves et contrôle du serveur !',
    accentColor: '#fbbf24',
    vipChambreAccess: true,
    showcase: {
      materialTheme: 'gold24k',
      accessories: ['royal_crown', 'vr_gold', 'jetpack_rgb'],
      particles: 'sparks_gold'
    },
    aliases: ['bp_tier_10', 'vip_tier_10', 'tier_10', 'royal_crown']
  }
];

export function cloneShowcase(rawShowcase) {
  if (!rawShowcase || typeof rawShowcase !== 'object') return null;
  const out = {};
  if (typeof rawShowcase.materialTheme === 'string' && rawShowcase.materialTheme) {
    out.materialTheme = rawShowcase.materialTheme;
  } else {
    out.materialTheme = null;
  }
  out.accessories = Array.isArray(rawShowcase.accessories)
    ? rawShowcase.accessories.filter((a) => typeof a === 'string' && a.trim())
    : [];
  out.particles = typeof rawShowcase.particles === 'string' && rawShowcase.particles
    ? rawShowcase.particles
    : null;
  if (typeof rawShowcase.visorColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(rawShowcase.visorColor)) {
    out.visorColor = rawShowcase.visorColor;
  }
  return out;
}

export function getBattlePassTierSpec(rawInput) {
  if (rawInput === null || rawInput === undefined || rawInput === '') return null;
  if (typeof rawInput === 'number' && Number.isFinite(rawInput)) {
    return BATTLE_PASS_SKIN_CATALOG.find((t) => t.tier === Math.round(rawInput)) || null;
  }
  if (typeof rawInput === 'object') {
    if (rawInput.tier) return getBattlePassTierSpec(rawInput.tier);
    if (rawInput.id) return getBattlePassTierSpec(rawInput.id);
    return null;
  }
  const clean = String(rawInput)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!clean) return null;
  const numMatch = clean.match(/^(?:bp_tier_|vip_tier_|vip_|tier_)?(\d+)$/);
  if (numMatch) {
    const n = Number(numMatch[1]);
    return BATTLE_PASS_SKIN_CATALOG.find((t) => t.tier === n) || null;
  }
  return BATTLE_PASS_SKIN_CATALOG.find((t) => t.id === clean || t.aliases.includes(clean)) || null;
}

export function getBattlePassSkinId(tierNum) {
  const spec = getBattlePassTierSpec(tierNum);
  return spec ? spec.id : null;
}

export function isBattlePassSkinId(rawInput) {
  return Boolean(getBattlePassTierSpec(rawInput));
}

export function normalizeBattlePassTierList(rawList) {
  if (!Array.isArray(rawList)) return [];
  const seen = new Set();
  for (const item of rawList) {
    const spec = getBattlePassTierSpec(item);
    if (spec) seen.add(spec.tier);
  }
  return [...seen].sort((a, b) => a - b);
}

export function isYanfufuUsername(rawName) {
  return (
    String(rawName || '')
      .trim()
      .toLowerCase()
      .replace(/#\d+$/, '') === 'yanfufu'
  );
}

export function hasVipChambreAccess(unlockedTiers = [], rawName = '') {
  if (isYanfufuUsername(rawName)) return true;
  const list = normalizeBattlePassTierList(unlockedTiers);
  return list.some((tierNum) => Boolean(getBattlePassTierSpec(tierNum)?.vipChambreAccess));
}
