import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  cloneShowcase,
  getBattlePassSkinId,
  getBattlePassTierSpec,
  hasVipChambreAccess,
  isBattlePassSkinId,
  isYanfufuUsername,
  normalizeBattlePassTierList,
  YANFUFU_VIP_TIER
} from '../src/core/battlePassSkins.js';
import { createDefaultMap, normalizeMapData } from '../src/world/mapSchema.js';
import {
  ARCADE_GAME_RULES,
  computeArcadeCoinReward,
  computeDetentionTableCoinReward,
  computeSurvivalCoinReward,
  computeTpCoinReward,
  getShopAccessoryById,
  getShopItemById,
  getShopPetById,
  getShopSkinById,
  isShopAccessoryId,
  isShopPetId,
  isShopSkinId,
  SHOP_CATALOG
} from '../src/world/ShopCatalog.js';

export const TP_IDS = ['oscilloscope', 'soldering', 'electronics', 'antivirus', 'vmvlan'];

export const EXTRA_TP_IDS = ['patchrack', 'hardware', 'audiovisual', 'studio'];

export const ALL_TP_IDS = [...TP_IDS, ...EXTRA_TP_IDS];

export const ACCOUNTS_MIGRATION_VERSION = '4.11';

export function hasAllTpsAt20InScores(scores = {}) {
  if (!scores || typeof scores !== 'object') return false;
  return ALL_TP_IDS.length > 0 && ALL_TP_IDS.every((id) => Number(scores[id]) === 20);
}

export const TP_LABELS = {
  oscilloscope: 'TP Oscilloscope & Diagnostic 3D',
  soldering: 'TP Brasure PCB 3D',
  electronics: 'TP Électronique & Mesures 3D',
  antivirus: 'TP Cybersécurité SOC 3D',
  vmvlan: 'TP Réseau Baie & VLAN 3D',
  patchrack: 'TP Brassage Baie 19" & VLAN 3D',
  hardware: 'TP Assemblage Hardware PC 3D',
  audiovisual: 'TP Régie Audiovisuelle & DMX 3D',
  studio: 'TP Studio Audio & DMX 3D'
};

export const DIVINE_SPECIALTY_IDS = ['cyber', 'reseaux', 'electronique', 'systemes', 'audiovisuel'];

export const ULTIMATE_SECRET_SKIN_ID = 'architecte_supreme';

const ULTIMATE_SECRET_SKIN_COLOR = '#c084fc';

const VALID_DIVINE_SPECIALTIES = new Set(DIVINE_SPECIALTY_IDS);

const SECRET_SKIN_ALIASES = new Set([
  'architecte_supreme',
  'secret',
  'secret_ultime',
  'ultimate',
  'entite_quantique'
]);

const DIVINE_SPECIALTY_COLORS = {
  cyber: '#f43f5e',
  reseaux: '#38bdf8',
  electronique: '#fbbf24',
  systemes: '#a855f7',
  audiovisuel: '#ec4899'
};

const DIVINE_SPECIALTY_ALIASES = {
  cyber: 'cyber',
  antivirus: 'cyber',
  soc: 'cyber',
  pentest: 'cyber',
  cybersecurite: 'cyber',
  reseaux: 'reseaux',
  reseau: 'reseaux',
  vmvlan: 'reseaux',
  patchrack: 'reseaux',
  network: 'reseaux',
  fibre: 'reseaux',
  electronique: 'electronique',
  soldering: 'electronique',
  oscilloscope: 'electronique',
  electronics: 'electronique',
  soudure: 'electronique',
  brasure: 'electronique',
  systemes: 'systemes',
  systeme: 'systemes',
  hardware: 'systemes',
  linux: 'systemes',
  serveurs: 'systemes',
  audiovisuel: 'audiovisuel',
  audiovisual: 'audiovisuel',
  studio: 'audiovisuel',
  dmx: 'audiovisuel',
  regie: 'audiovisuel',
  son: 'audiovisuel',
  video: 'audiovisuel'
};

export function isSecretUltimateSkinId(raw) {
  if (!raw) return false;
  const clean = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^divine[_:-]/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return SECRET_SKIN_ALIASES.has(clean);
}

export function resolveDivineSpecialtyId(raw) {
  if (!raw) return null;
  const clean = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^divine[_:-]/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!clean || clean === 'standard' || clean === 'default' || clean === 'none') return null;
  if (VALID_DIVINE_SPECIALTIES.has(clean)) return clean;
  if (DIVINE_SPECIALTY_ALIASES[clean]) return DIVINE_SPECIALTY_ALIASES[clean];
  return null;
}

export function hasAllDivineSpecialties(rawList) {
  const normalized = normalizeDivineSkinList(rawList);
  return DIVINE_SPECIALTY_IDS.every((id) => normalized.includes(id));
}

const AVATAR_COLORS = [
  '#22d3ee',
  '#34d399',
  '#fbbf24',
  '#a78bfa',
  '#fb7185',
  '#38bdf8',
  '#4ade80'
];

export const DEFAULT_SKIN = {
  outfitColor: '#22d3ee',
  outfitStyle: 'blouse',
  hat: 'glasses',
  skinTone: '#f1c29b',
  pantsColor: '#1e293b'
};

const VALID_STYLES = new Set(['blouse', 'hoodie', 'cyber']);
const VALID_HATS = new Set(['none', 'cap', 'headset', 'glasses']);

function isValidHex(val) {
  return /^#[0-9a-fA-F]{6}$/.test(String(val || ''));
}

export function cleanUsernameInput(rawName) {
  return String(rawName || '')
    .trim()
    .replace(/[^\p{L}\p{N}_\- #]/gu, '')
    .slice(0, 22);
}

export function sanitizeName(rawName) {
  const cleaned = cleanUsernameInput(rawName);
  return cleaned || 'Eleve_CIEL';
}

function sanitizeSuggestionText(raw, maxLen) {
  return String(raw || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function sanitizeSkin(raw, fallbackColor = DEFAULT_SKIN.outfitColor) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const wantSecret = Boolean(s.secretSkin || isSecretUltimateSkinId(s.divineSpecialty));
  const divineSpec = wantSecret ? null : resolveDivineSpecialtyId(s.divineSpecialty);
  const bpSpec =
    !wantSecret && !divineSpec
      ? getBattlePassTierSpec(s.battlePassTier ?? s.vipPassId)
      : null;
  const shopSpec =
    !wantSecret && !divineSpec && !bpSpec
      ? getShopSkinById(s.shopSkinId || s.equippedSkin)
      : null;
  const baseOutfit = isValidHex(fallbackColor) ? fallbackColor : DEFAULT_SKIN.outfitColor;
  const cleaned = {
    outfitColor: isValidHex(s.outfitColor)
      ? s.outfitColor
      : wantSecret
        ? ULTIMATE_SECRET_SKIN_COLOR
        : divineSpec
          ? DIVINE_SPECIALTY_COLORS[divineSpec]
          : bpSpec
            ? bpSpec.accentColor
            : shopSpec
              ? shopSpec.outfitColor
              : baseOutfit,
    outfitStyle: VALID_STYLES.has(s.outfitStyle)
      ? s.outfitStyle
      : wantSecret || divineSpec || bpSpec || shopSpec
        ? 'cyber'
        : DEFAULT_SKIN.outfitStyle,
    hat: VALID_HATS.has(s.hat) ? s.hat : DEFAULT_SKIN.hat,
    skinTone: isValidHex(s.skinTone) ? s.skinTone : DEFAULT_SKIN.skinTone,
    pantsColor: isValidHex(s.pantsColor) ? s.pantsColor : DEFAULT_SKIN.pantsColor
  };
  if (s.creatorAura) {
    cleaned.creatorAura = true;
  }
  if (isShopPetId(s.equippedPet)) {
    cleaned.equippedPet = s.equippedPet;
  }
  if (isShopAccessoryId(s.equippedTrail)) {
    cleaned.equippedTrail = s.equippedTrail;
  }
  if (wantSecret) {
    cleaned.divineSpecialty = ULTIMATE_SECRET_SKIN_ID;
    cleaned.secretSkin = true;
  } else if (divineSpec) {
    cleaned.divineSpecialty = divineSpec;
  } else if (bpSpec) {
    cleaned.battlePassTier = bpSpec.tier;
    cleaned.outfitColor = bpSpec.accentColor;
    cleaned.outfitStyle = 'cyber';
    cleaned.showcase = cloneShowcase(bpSpec.showcase);
  } else if (shopSpec) {
    cleaned.shopSkinId = shopSpec.id;
    cleaned.outfitColor = shopSpec.outfitColor;
    cleaned.pantsColor = shopSpec.pantsColor || cleaned.pantsColor;
  }
  return cleaned;
}

export function normalizeOwnedItems(rawList) {
  if (!Array.isArray(rawList)) return [];
  const out = [];
  for (const item of rawList) {
    const clean = String(item || '').trim();
    if (clean && getShopItemById(clean) && !out.includes(clean)) {
      out.push(clean);
    }
  }
  return out;
}

export function normalizeValidatedTps(rawList, grades = {}) {
  const out = [];
  if (Array.isArray(rawList)) {
    for (const item of rawList) {
      const clean = String(item || '').trim();
      if (ALL_TP_IDS.includes(clean) && !out.includes(clean)) {
        out.push(clean);
      }
    }
  }
  if (grades && typeof grades === 'object') {
    for (const tpId of ALL_TP_IDS) {
      if (typeof grades[tpId] === 'number' && grades[tpId] >= 10 && !out.includes(tpId)) {
        out.push(tpId);
      }
    }
  }
  return out;
}

export function normalizeArcadeHighScores(rawObj) {
  const out = {};
  if (rawObj && typeof rawObj === 'object') {
    for (const gameId of Object.keys(ARCADE_GAME_RULES)) {
      const val = Math.floor(Number(rawObj[gameId]) || 0);
      if (val > 0 && val <= ARCADE_GAME_RULES[gameId].maxValidScore) {
        out[gameId] = val;
      }
    }
  }
  return out;
}

export function normalizeDivineSkinList(rawList) {
  if (!Array.isArray(rawList)) return [];
  const out = [];
  for (const item of rawList) {
    const id = resolveDivineSpecialtyId(item);
    if (id && !out.includes(id)) {
      out.push(id);
    }
  }
  return out;
}

export function computeAverage(grades = {}) {
  const values = TP_IDS.map((id) => grades[id])
    .filter((v) => typeof v === 'number' && Number.isFinite(v))
    .map((v) => Math.max(0, Math.min(20, v)));
  if (values.length === 0) return null;
  const sum = values.reduce((acc, n) => acc + n, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

export function computeMention(avg) {
  if (avg === null || avg === undefined) return 'En cours';
  if (avg >= 16) return 'Mention Très Bien';
  if (avg >= 14) return 'Mention Bien';
  if (avg >= 12) return 'Mention Assez Bien';
  if (avg >= 10) return 'Admis (BAC PRO CIEL)';
  return 'À consolider';
}

export function computeDiplomas(grades = {}, average = null, diplomaEarned = false) {
  const completedCount = TP_IDS.filter(
    (id) => typeof grades[id] === 'number' && grades[id] >= 10
  ).length;
  const earned = Boolean(diplomaEarned) || completedCount === TP_IDS.length;
  if (!earned) return [];
  const avg = average ?? computeAverage(grades);
  const mention = computeMention(avg);
  const list = [`BAC PRO CIEL — ${mention}`];
  if (avg !== null && avg >= 16) {
    list.push('Tableau d’Excellence Professeur CIEL');
  }
  return list;
}

export function computeRankLabel(completedCount, average, diplomaEarned) {
  if (diplomaEarned) {
    if (average !== null && average >= 16) return 'Major CIEL';
    if (average !== null && average >= 14) return 'Diplômé (Bien)';
    return 'Diplômé CIEL';
  }
  if (completedCount >= 3) return 'Technicien Confirmé';
  if (completedCount >= 1) return 'Technicien Junior';
  return 'Apprenti CIEL';
}

function hashColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function compareProfiles(a, b) {
  const avgA = typeof a.average === 'number' ? a.average : -1;
  const avgB = typeof b.average === 'number' ? b.average : -1;
  if (avgB !== avgA) return avgB - avgA;
  if (b.xp !== a.xp) return b.xp - a.xp;
  if (b.completedCount !== a.completedCount) return b.completedCount - a.completedCount;
  return a.name.localeCompare(b.name, 'fr');
}

export class GameStore {
  constructor(dbFilePath, options = {}) {
    const isAccountsTarget =
      typeof dbFilePath === 'string' && path.basename(dbFilePath) === 'accounts.json';
    this.accountsFilePath =
      options.accountsPath !== undefined
        ? options.accountsPath
        : isAccountsTarget
          ? dbFilePath
          : null;
    this.dbFilePath = isAccountsTarget ? null : dbFilePath || null;
    this.data = { players: {}, suggestions: [], pigeons: [] };
    this.accounts = new Map();
    this._arcadeClaimHistory = new Map();
    this._survivalMatchClaimed = new Map();
    this.migratedToV411 = false;
    if (this.accountsFilePath || this.dbFilePath) {
      this._load();
    }
  }

  _normalizeGrades(rawGrades) {
    const grades = {};
    if (rawGrades && typeof rawGrades === 'object') {
      for (const id of ALL_TP_IDS) {
        if (typeof rawGrades[id] === 'number' && Number.isFinite(rawGrades[id])) {
          grades[id] = Math.max(0, Math.min(20, Math.round(rawGrades[id] * 10) / 10));
        }
      }
    }
    return grades;
  }

  _normalizeAccount(raw, fallbackKey = 'Eleve_CIEL') {
    const base = raw && typeof raw === 'object' ? raw : {};
    const username = sanitizeName(base.username || base.name || fallbackKey);
    const id = String(base.id || '').trim() || `acc_${crypto.randomUUID().slice(0, 12)}`;
    const password = String(base.password ?? '');
    const nowIso = new Date().toISOString();
    const createdAt = base.createdAt || nowIso;
    const updatedAt = base.updatedAt || createdAt;
    const lastLogin = base.lastLogin || updatedAt;
    const lastSeen = base.lastSeen || updatedAt;
    const tpScores = this._normalizeGrades(base.tpScores || base.grades || {});
    const unlockedDivineSkins = normalizeDivineSkinList(base.unlockedDivineSkins);
    const secretSkinUnlocked = hasAllDivineSpecialties(unlockedDivineSkins);
    const unlockedBattlePassTiers = normalizeBattlePassTierList(base.unlockedBattlePassTiers);
    let autoGrantYanfufuVip = false;
    if (isYanfufuUsername(username) && !unlockedBattlePassTiers.includes(YANFUFU_VIP_TIER)) {
      unlockedBattlePassTiers.push(YANFUFU_VIP_TIER);
      unlockedBattlePassTiers.sort((a, b) => a - b);
      autoGrantYanfufuVip = true;
    }
    const vipChambreAccess = hasVipChambreAccess(unlockedBattlePassTiers, username);
    const introSeen = Boolean(base.introSeen);
    const prestigeCount = Number.isFinite(Number(base.prestigeCount))
      ? Math.max(0, Math.round(Number(base.prestigeCount)))
      : 0;
    const defColor = isValidHex(base.color) ? base.color : hashColor(username);
    const avatarCustomization = sanitizeSkin(base.avatarCustomization || base.skin, defColor);

    const coins = Number.isFinite(Number(base.coins))
      ? Math.max(0, Math.floor(Number(base.coins)))
      : 0;
    const ownedItems = normalizeOwnedItems(base.ownedItems);
    const validatedTps = normalizeValidatedTps(base.validatedTps, tpScores);
    const arcadeHighScores = normalizeArcadeHighScores(base.arcadeHighScores);

    const rawEqSkin = base.equippedSkin || avatarCustomization.shopSkinId || null;
    const equippedSkin =
      rawEqSkin && isShopSkinId(rawEqSkin) && ownedItems.includes(rawEqSkin) ? rawEqSkin : null;
    const rawEqPet = base.equippedPet || avatarCustomization.equippedPet || null;
    const equippedPet =
      rawEqPet && isShopPetId(rawEqPet) && ownedItems.includes(rawEqPet) ? rawEqPet : null;
    const rawEqTrail = base.equippedTrail || avatarCustomization.equippedTrail || null;
    const equippedTrail =
      rawEqTrail && isShopAccessoryId(rawEqTrail) && ownedItems.includes(rawEqTrail)
        ? rawEqTrail
        : null;

    if (equippedPet) {
      avatarCustomization.equippedPet = equippedPet;
    } else {
      delete avatarCustomization.equippedPet;
    }
    if (equippedTrail) {
      avatarCustomization.equippedTrail = equippedTrail;
    } else {
      delete avatarCustomization.equippedTrail;
    }

    const rawSelected =
      typeof base.selectedSkin === 'string' && base.selectedSkin.trim()
        ? base.selectedSkin.trim()
        : avatarCustomization.divineSpecialty ||
          (avatarCustomization.battlePassTier
            ? getBattlePassSkinId(avatarCustomization.battlePassTier)
            : equippedSkin || 'standard');
    const wantSecret =
      Boolean(avatarCustomization.secretSkin) || isSecretUltimateSkinId(rawSelected);
    const selectedDivine = wantSecret ? null : resolveDivineSpecialtyId(rawSelected);
    const selectedBpSpec =
      !wantSecret && !selectedDivine
        ? getBattlePassTierSpec(rawSelected) ||
          getBattlePassTierSpec(avatarCustomization.battlePassTier)
        : null;
    const selectedShopSpec =
      !wantSecret && !selectedDivine && !selectedBpSpec
        ? getShopSkinById(rawSelected) || (equippedSkin ? getShopSkinById(equippedSkin) : null)
        : null;
    let selectedSkin = 'standard';
    if (wantSecret && secretSkinUnlocked) {
      selectedSkin = ULTIMATE_SECRET_SKIN_ID;
      avatarCustomization.divineSpecialty = ULTIMATE_SECRET_SKIN_ID;
      avatarCustomization.secretSkin = true;
      avatarCustomization.outfitColor = ULTIMATE_SECRET_SKIN_COLOR;
      avatarCustomization.outfitStyle = 'cyber';
      delete avatarCustomization.battlePassTier;
      delete avatarCustomization.showcase;
      delete avatarCustomization.shopSkinId;
    } else if (selectedDivine && unlockedDivineSkins.includes(selectedDivine)) {
      selectedSkin = selectedDivine;
      avatarCustomization.divineSpecialty = selectedDivine;
      delete avatarCustomization.secretSkin;
      delete avatarCustomization.battlePassTier;
      delete avatarCustomization.showcase;
      delete avatarCustomization.shopSkinId;
      avatarCustomization.outfitColor = DIVINE_SPECIALTY_COLORS[selectedDivine];
      avatarCustomization.outfitStyle = 'cyber';
    } else if (selectedBpSpec && unlockedBattlePassTiers.includes(selectedBpSpec.tier)) {
      selectedSkin = selectedBpSpec.id;
      avatarCustomization.battlePassTier = selectedBpSpec.tier;
      avatarCustomization.outfitColor = selectedBpSpec.accentColor;
      avatarCustomization.outfitStyle = 'cyber';
      avatarCustomization.showcase = cloneShowcase(selectedBpSpec.showcase);
      delete avatarCustomization.divineSpecialty;
      delete avatarCustomization.secretSkin;
      delete avatarCustomization.shopSkinId;
    } else if (selectedShopSpec && ownedItems.includes(selectedShopSpec.id)) {
      selectedSkin = selectedShopSpec.id;
      avatarCustomization.shopSkinId = selectedShopSpec.id;
      avatarCustomization.outfitColor = selectedShopSpec.outfitColor;
      avatarCustomization.pantsColor = selectedShopSpec.pantsColor || avatarCustomization.pantsColor;
      avatarCustomization.outfitStyle = 'cyber';
      delete avatarCustomization.divineSpecialty;
      delete avatarCustomization.secretSkin;
      delete avatarCustomization.battlePassTier;
      delete avatarCustomization.showcase;
    } else if (
      autoGrantYanfufuVip &&
      (!rawSelected || rawSelected === 'standard' || rawSelected === 'default')
    ) {
      const yanSpec = getBattlePassTierSpec(YANFUFU_VIP_TIER);
      selectedSkin = yanSpec.id;
      avatarCustomization.battlePassTier = yanSpec.tier;
      avatarCustomization.outfitColor = yanSpec.accentColor;
      avatarCustomization.outfitStyle = 'cyber';
      avatarCustomization.showcase = cloneShowcase(yanSpec.showcase);
      delete avatarCustomization.divineSpecialty;
      delete avatarCustomization.secretSkin;
      delete avatarCustomization.shopSkinId;
    } else if (
      rawSelected &&
      !selectedDivine &&
      !isSecretUltimateSkinId(rawSelected) &&
      !isBattlePassSkinId(rawSelected) &&
      !isShopSkinId(rawSelected) &&
      rawSelected !== 'standard' &&
      rawSelected !== 'default'
    ) {
      selectedSkin = rawSelected;
      delete avatarCustomization.divineSpecialty;
      delete avatarCustomization.secretSkin;
      delete avatarCustomization.battlePassTier;
      delete avatarCustomization.showcase;
      delete avatarCustomization.shopSkinId;
    } else {
      selectedSkin = 'standard';
      delete avatarCustomization.divineSpecialty;
      delete avatarCustomization.secretSkin;
      delete avatarCustomization.battlePassTier;
      delete avatarCustomization.showcase;
      delete avatarCustomization.shopSkinId;
    }

    const finalEquippedSkin = isShopSkinId(selectedSkin) ? selectedSkin : null;

    const bestTimes = {};
    if (base.bestTimes && typeof base.bestTimes === 'object') {
      for (const tpId of ALL_TP_IDS) {
        if (typeof base.bestTimes[tpId] === 'number' && base.bestTimes[tpId] > 0) {
          bestTimes[tpId] = Math.round(base.bestTimes[tpId]);
        }
      }
    }
    const scoreVals = Object.values(tpScores);
    const minXpFromScores = scoreVals.reduce((acc, sc) => acc + Math.round(sc * 15) + 50, 0);
    const rawXp = Number.isFinite(Number(base.xp)) ? Math.max(0, Math.round(Number(base.xp))) : 0;
    const xp = Math.max(rawXp, minXpFromScores);
    const playtimeSeconds = Number.isFinite(Number(base.playtimeSeconds))
      ? Math.max(0, Math.round(Number(base.playtimeSeconds)))
      : 0;
    const questAccepted = Boolean(base.questAccepted) || scoreVals.length > 0;
    const ascensionTriggered = Boolean(base.ascensionTriggered);

    return {
      id,
      username,
      password,
      createdAt,
      introSeen,
      tpScores,
      unlockedDivineSkins,
      secretSkinUnlocked,
      unlockedBattlePassTiers,
      vipChambreAccess,
      prestigeCount,
      coins,
      ownedItems,
      equippedSkin: finalEquippedSkin,
      equippedPet,
      equippedTrail,
      validatedTps,
      arcadeHighScores,
      selectedSkin,
      avatarCustomization,
      xp,
      bestTimes,
      questAccepted,
      ascensionTriggered,
      playtimeSeconds,
      lastLogin,
      lastSeen,
      updatedAt
    };
  }

  _serializeAccount(acc) {
    const norm = this._normalizeAccount(acc);
    return {
      id: norm.id,
      username: norm.username,
      password: norm.password,
      createdAt: norm.createdAt,
      introSeen: norm.introSeen,
      tpScores: { ...norm.tpScores },
      unlockedDivineSkins: [...norm.unlockedDivineSkins],
      secretSkinUnlocked: norm.secretSkinUnlocked,
      unlockedBattlePassTiers: [...norm.unlockedBattlePassTiers],
      vipChambreAccess: norm.vipChambreAccess,
      prestigeCount: norm.prestigeCount,
      coins: norm.coins,
      ownedItems: [...norm.ownedItems],
      equippedSkin: norm.equippedSkin,
      equippedPet: norm.equippedPet,
      equippedTrail: norm.equippedTrail,
      validatedTps: [...norm.validatedTps],
      arcadeHighScores: { ...norm.arcadeHighScores },
      selectedSkin: norm.selectedSkin,
      avatarCustomization: { ...norm.avatarCustomization },
      xp: norm.xp,
      bestTimes: { ...norm.bestTimes },
      questAccepted: norm.questAccepted,
      ascensionTriggered: norm.ascensionTriggered,
      playtimeSeconds: norm.playtimeSeconds,
      lastLogin: norm.lastLogin,
      lastSeen: norm.lastSeen,
      updatedAt: norm.updatedAt
    };
  }

  _syncPlayerFromAccount(acc) {
    const norm = this._normalizeAccount(acc);
    const key = norm.username.toLowerCase();
    this.accounts.set(key, norm);
    this.data.players[key] = this._normalizePlayer(
      {
        name: norm.username,
        color: norm.avatarCustomization.outfitColor,
        skin: norm.avatarCustomization,
        introSeen: norm.introSeen,
        unlockedDivineSkins: norm.unlockedDivineSkins,
        secretSkinUnlocked: norm.secretSkinUnlocked,
        unlockedBattlePassTiers: norm.unlockedBattlePassTiers,
        vipChambreAccess: norm.vipChambreAccess,
        prestigeCount: norm.prestigeCount,
        coins: norm.coins,
        ownedItems: norm.ownedItems,
        equippedSkin: norm.equippedSkin,
        equippedPet: norm.equippedPet,
        equippedTrail: norm.equippedTrail,
        validatedTps: norm.validatedTps,
        arcadeHighScores: norm.arcadeHighScores,
        selectedSkin: norm.selectedSkin,
        avatarCustomization: norm.avatarCustomization,
        xp: norm.xp,
        questAccepted: norm.questAccepted,
        ascensionTriggered: norm.ascensionTriggered,
        grades: norm.tpScores,
        bestTimes: norm.bestTimes,
        createdAt: norm.createdAt,
        lastLogin: norm.lastLogin,
        lastSeen: norm.lastSeen,
        playtimeSeconds: norm.playtimeSeconds,
        updatedAt: norm.updatedAt
      },
      norm.username
    );
  }

  _syncAccountFromPlayer(player) {
    if (!player?.name) return;
    const key = player.name.toLowerCase();
    const existing = this.accounts.get(key);
    if (!existing) return;
    const normPlayer = this._normalizePlayer(player, player.name);
    const unlocked = normalizeDivineSkinList([
      ...(existing.unlockedDivineSkins || []),
      ...(normPlayer.unlockedDivineSkins || [])
    ]);
    const secretUnlocked = hasAllDivineSpecialties(unlocked);
    const unlockedBp = normalizeBattlePassTierList([
      ...(existing.unlockedBattlePassTiers || []),
      ...(normPlayer.unlockedBattlePassTiers || []),
      ...(isYanfufuUsername(player.name) ? [YANFUFU_VIP_TIER] : [])
    ]);
    const ownedItems = normalizeOwnedItems([
      ...(existing.ownedItems || []),
      ...(normPlayer.ownedItems || [])
    ]);
    const wantSecret =
      Boolean(normPlayer.skin?.secretSkin) ||
      isSecretUltimateSkinId(normPlayer.selectedSkin || normPlayer.skin?.divineSpecialty);
    const bpSpec = getBattlePassTierSpec(
      normPlayer.skin?.battlePassTier ?? normPlayer.selectedSkin
    );
    const shopSpec = getShopSkinById(
      normPlayer.equippedSkin || normPlayer.skin?.shopSkinId || normPlayer.selectedSkin
    );
    let selectedSkin = 'standard';
    const nextAvatarCustom = { ...normPlayer.skin };
    if (wantSecret && secretUnlocked) {
      selectedSkin = ULTIMATE_SECRET_SKIN_ID;
      nextAvatarCustom.divineSpecialty = ULTIMATE_SECRET_SKIN_ID;
      nextAvatarCustom.secretSkin = true;
      delete nextAvatarCustom.battlePassTier;
      delete nextAvatarCustom.showcase;
      delete nextAvatarCustom.shopSkinId;
    } else if (
      normPlayer.skin?.divineSpecialty &&
      unlocked.includes(normPlayer.skin.divineSpecialty)
    ) {
      selectedSkin = normPlayer.skin.divineSpecialty;
      delete nextAvatarCustom.secretSkin;
      delete nextAvatarCustom.battlePassTier;
      delete nextAvatarCustom.showcase;
      delete nextAvatarCustom.shopSkinId;
    } else if (bpSpec && unlockedBp.includes(bpSpec.tier)) {
      selectedSkin = bpSpec.id;
      nextAvatarCustom.battlePassTier = bpSpec.tier;
      nextAvatarCustom.outfitColor = bpSpec.accentColor;
      nextAvatarCustom.outfitStyle = 'cyber';
      nextAvatarCustom.showcase = cloneShowcase(bpSpec.showcase);
      delete nextAvatarCustom.divineSpecialty;
      delete nextAvatarCustom.secretSkin;
      delete nextAvatarCustom.shopSkinId;
    } else if (shopSpec && ownedItems.includes(shopSpec.id)) {
      selectedSkin = shopSpec.id;
      nextAvatarCustom.shopSkinId = shopSpec.id;
      nextAvatarCustom.outfitColor = shopSpec.outfitColor;
      nextAvatarCustom.pantsColor = shopSpec.pantsColor || nextAvatarCustom.pantsColor;
      nextAvatarCustom.outfitStyle = 'cyber';
      delete nextAvatarCustom.divineSpecialty;
      delete nextAvatarCustom.secretSkin;
      delete nextAvatarCustom.battlePassTier;
      delete nextAvatarCustom.showcase;
    } else {
      delete nextAvatarCustom.divineSpecialty;
      delete nextAvatarCustom.secretSkin;
      delete nextAvatarCustom.battlePassTier;
      delete nextAvatarCustom.showcase;
      delete nextAvatarCustom.shopSkinId;
    }
    const equippedPet =
      normPlayer.equippedPet && ownedItems.includes(normPlayer.equippedPet)
        ? normPlayer.equippedPet
        : null;
    const equippedTrail =
      normPlayer.equippedTrail && ownedItems.includes(normPlayer.equippedTrail)
        ? normPlayer.equippedTrail
        : null;
    if (equippedPet) {
      nextAvatarCustom.equippedPet = equippedPet;
    } else {
      delete nextAvatarCustom.equippedPet;
    }
    if (equippedTrail) {
      nextAvatarCustom.equippedTrail = equippedTrail;
    } else {
      delete nextAvatarCustom.equippedTrail;
    }
    existing.introSeen = Boolean(existing.introSeen || normPlayer.introSeen);
    existing.tpScores = { ...normPlayer.grades };
    existing.unlockedDivineSkins = unlocked;
    existing.secretSkinUnlocked = secretUnlocked;
    existing.unlockedBattlePassTiers = unlockedBp;
    existing.vipChambreAccess = hasVipChambreAccess(unlockedBp, player.name);
    existing.prestigeCount = Math.max(0, Number(normPlayer.prestigeCount) || 0);
    existing.coins = Math.max(0, Math.floor(Number(normPlayer.coins) || 0));
    existing.ownedItems = ownedItems;
    existing.equippedSkin = isShopSkinId(selectedSkin) ? selectedSkin : null;
    existing.equippedPet = equippedPet;
    existing.equippedTrail = equippedTrail;
    existing.validatedTps = normalizeValidatedTps(normPlayer.validatedTps, normPlayer.grades);
    existing.arcadeHighScores = normalizeArcadeHighScores(normPlayer.arcadeHighScores);
    existing.selectedSkin = selectedSkin;
    existing.avatarCustomization = nextAvatarCustom;
    existing.xp = normPlayer.xp;
    existing.bestTimes = { ...normPlayer.bestTimes };
    existing.questAccepted = normPlayer.questAccepted;
    existing.ascensionTriggered = Boolean(normPlayer.ascensionTriggered);
    existing.playtimeSeconds = normPlayer.playtimeSeconds;
    existing.lastLogin = normPlayer.lastLogin;
    existing.lastSeen = normPlayer.lastSeen;
    existing.updatedAt = normPlayer.updatedAt;
    this.accounts.set(key, existing);
  }

  _normalizePlayer(raw, fallbackKey = 'Eleve_CIEL') {
    const base = raw && typeof raw === 'object' ? raw : {};
    const name = sanitizeName(base.name || base.username || fallbackKey);
    const fallbackColor = isValidHex(base.color) ? base.color : hashColor(name);
    const skin = sanitizeSkin(base.skin || base.avatarCustomization, fallbackColor);
    const grades = this._normalizeGrades(base.grades || base.tpScores);
    const unlockedDivineSkins = normalizeDivineSkinList(
      Array.isArray(base.unlockedDivineSkins) ? base.unlockedDivineSkins : []
    );
    const secretSkinUnlocked = hasAllDivineSpecialties(unlockedDivineSkins);
    const unlockedBattlePassTiers = normalizeBattlePassTierList(base.unlockedBattlePassTiers);
    let autoGrantYanfufuVip = false;
    if (isYanfufuUsername(name) && !unlockedBattlePassTiers.includes(YANFUFU_VIP_TIER)) {
      unlockedBattlePassTiers.push(YANFUFU_VIP_TIER);
      unlockedBattlePassTiers.sort((a, b) => a - b);
      autoGrantYanfufuVip = true;
    }
    const vipChambreAccess = hasVipChambreAccess(unlockedBattlePassTiers, name);

    const coins = Number.isFinite(Number(base.coins))
      ? Math.max(0, Math.floor(Number(base.coins)))
      : 0;
    const ownedItems = normalizeOwnedItems(base.ownedItems);
    const validatedTps = normalizeValidatedTps(base.validatedTps, grades);
    const arcadeHighScores = normalizeArcadeHighScores(base.arcadeHighScores);

    const rawEqSkin = base.equippedSkin || skin.shopSkinId || null;
    const equippedSkin =
      rawEqSkin && isShopSkinId(rawEqSkin) && ownedItems.includes(rawEqSkin) ? rawEqSkin : null;
    const rawEqPet = base.equippedPet || skin.equippedPet || null;
    const equippedPet =
      rawEqPet && isShopPetId(rawEqPet) && ownedItems.includes(rawEqPet) ? rawEqPet : null;
    const rawEqTrail = base.equippedTrail || skin.equippedTrail || null;
    const equippedTrail =
      rawEqTrail && isShopAccessoryId(rawEqTrail) && ownedItems.includes(rawEqTrail)
        ? rawEqTrail
        : null;

    if (equippedPet) {
      skin.equippedPet = equippedPet;
    } else {
      delete skin.equippedPet;
    }
    if (equippedTrail) {
      skin.equippedTrail = equippedTrail;
    } else {
      delete skin.equippedTrail;
    }

    const wantSecret =
      Boolean(skin.secretSkin) ||
      isSecretUltimateSkinId(skin.divineSpecialty) ||
      isSecretUltimateSkinId(base.selectedSkin);
    const bpSpec =
      !wantSecret && !skin.divineSpecialty
        ? getBattlePassTierSpec(skin.battlePassTier ?? base.selectedSkin)
        : null;
    const shopSpec =
      !wantSecret && !skin.divineSpecialty && !bpSpec
        ? getShopSkinById(equippedSkin || base.selectedSkin || skin.shopSkinId)
        : null;

    let selectedSkin = 'standard';
    if (wantSecret && secretSkinUnlocked) {
      selectedSkin = ULTIMATE_SECRET_SKIN_ID;
      skin.divineSpecialty = ULTIMATE_SECRET_SKIN_ID;
      skin.secretSkin = true;
      skin.outfitColor = ULTIMATE_SECRET_SKIN_COLOR;
      skin.outfitStyle = 'cyber';
      delete skin.battlePassTier;
      delete skin.showcase;
      delete skin.shopSkinId;
    } else if (skin.divineSpecialty && unlockedDivineSkins.includes(skin.divineSpecialty)) {
      selectedSkin = skin.divineSpecialty;
      delete skin.secretSkin;
      delete skin.battlePassTier;
      delete skin.showcase;
      delete skin.shopSkinId;
    } else if (bpSpec && unlockedBattlePassTiers.includes(bpSpec.tier)) {
      selectedSkin = bpSpec.id;
      skin.battlePassTier = bpSpec.tier;
      skin.outfitColor = bpSpec.accentColor;
      skin.outfitStyle = 'cyber';
      skin.showcase = cloneShowcase(bpSpec.showcase);
      delete skin.divineSpecialty;
      delete skin.secretSkin;
      delete skin.shopSkinId;
    } else if (shopSpec && ownedItems.includes(shopSpec.id)) {
      selectedSkin = shopSpec.id;
      skin.shopSkinId = shopSpec.id;
      skin.outfitColor = shopSpec.outfitColor;
      skin.pantsColor = shopSpec.pantsColor || skin.pantsColor;
      skin.outfitStyle = 'cyber';
      delete skin.divineSpecialty;
      delete skin.secretSkin;
      delete skin.battlePassTier;
      delete skin.showcase;
    } else if (
      autoGrantYanfufuVip &&
      (!base.selectedSkin || base.selectedSkin === 'standard' || base.selectedSkin === 'default')
    ) {
      const yanSpec = getBattlePassTierSpec(YANFUFU_VIP_TIER);
      selectedSkin = yanSpec.id;
      skin.battlePassTier = yanSpec.tier;
      skin.outfitColor = yanSpec.accentColor;
      skin.outfitStyle = 'cyber';
      skin.showcase = cloneShowcase(yanSpec.showcase);
      delete skin.divineSpecialty;
      delete skin.secretSkin;
      delete skin.shopSkinId;
    } else {
      delete skin.divineSpecialty;
      delete skin.secretSkin;
      delete skin.battlePassTier;
      delete skin.showcase;
      delete skin.shopSkinId;
    }
    const finalEquippedSkin = isShopSkinId(selectedSkin) ? selectedSkin : null;
    const color = skin.outfitColor || fallbackColor;
    const bestTimes = {};
    if (base.bestTimes && typeof base.bestTimes === 'object') {
      for (const id of ALL_TP_IDS) {
        if (typeof base.bestTimes[id] === 'number' && base.bestTimes[id] > 0) {
          bestTimes[id] = Math.round(base.bestTimes[id]);
        }
      }
    }
    const average = computeAverage(grades);
    const completedCount = TP_IDS.filter(
      (id) => typeof grades[id] === 'number' && grades[id] >= 10
    ).length;
    const diplomaEarned = Boolean(base.diplomaEarned) || completedCount === TP_IDS.length;
    const diplomas = computeDiplomas(grades, average, diplomaEarned);
    const xp = Number.isFinite(Number(base.xp)) ? Math.max(0, Math.round(Number(base.xp))) : 0;
    const nowIso = new Date().toISOString();
    const updatedAt = base.updatedAt || nowIso;
    const createdAt = base.createdAt || updatedAt;
    const lastLogin = base.lastLogin || updatedAt;
    const lastSeen = base.lastSeen || updatedAt;
    const playtimeSeconds = Number.isFinite(Number(base.playtimeSeconds))
      ? Math.max(0, Math.round(Number(base.playtimeSeconds)))
      : 0;
    const prestigeCount = Number.isFinite(Number(base.prestigeCount))
      ? Math.max(0, Math.round(Number(base.prestigeCount)))
      : 0;

    return {
      name,
      color,
      skin,
      introSeen: Boolean(base.introSeen),
      unlockedDivineSkins,
      secretSkinUnlocked,
      unlockedBattlePassTiers,
      vipChambreAccess,
      prestigeCount,
      coins,
      ownedItems,
      equippedSkin: finalEquippedSkin,
      equippedPet,
      equippedTrail,
      validatedTps,
      arcadeHighScores,
      selectedSkin,
      avatarCustomization: { ...skin },
      tpScores: { ...grades },
      xp,
      questAccepted: Boolean(base.questAccepted),
      ascensionTriggered: Boolean(base.ascensionTriggered),
      grades,
      bestTimes,
      average,
      diplomaEarned,
      diplomas,
      createdAt,
      lastLogin,
      lastSeen,
      playtimeSeconds,
      updatedAt
    };
  }

  _normalizeSuggestion(raw) {
    const base = raw && typeof raw === 'object' ? raw : {};
    const author = sanitizeSuggestionText(base.author, 40);
    const message = sanitizeSuggestionText(base.message, 400);
    if (!author || !message) return null;
    const id = sanitizeSuggestionText(base.id, 24) || crypto.randomUUID().slice(0, 10);
    const createdAt = base.createdAt || new Date().toISOString();
    return { id, author, message, createdAt };
  }

  _normalizePigeon(raw) {
    const base = raw && typeof raw === 'object' ? raw : {};
    const playerName = sanitizeSuggestionText(base.playerName, 40) || 'Élève Anonyme';
    const platformRaw = sanitizeSuggestionText(base.platform, 24);
    const platform = /mobile|tactile|touch|tablette/i.test(platformRaw) ? 'Mobile' : platformRaw || 'PC';
    const id = sanitizeSuggestionText(base.id, 24) || crypto.randomUUID().slice(0, 10);
    const createdAt = base.createdAt || new Date().toISOString();
    return { id, playerName, platform, createdAt };
  }

  _load() {
    this.data = { players: {}, suggestions: [], pigeons: [] };
    this.accounts = new Map();

    if (this.accountsFilePath) {
      let needsMigrationResetSave = false;
      let needsGrantSave = false;
      this.migratedToV411 = false;
      try {
        if (fs.existsSync(this.accountsFilePath)) {
          const raw = fs.readFileSync(this.accountsFilePath, 'utf8');
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed.suggestions)) {
              this.data.suggestions = parsed.suggestions
                .map((s) => this._normalizeSuggestion(s))
                .filter(Boolean);
            }
            if (Array.isArray(parsed.pigeons)) {
              this.data.pigeons = parsed.pigeons
                .map((p) => this._normalizePigeon(p))
                .filter(Boolean);
            }
            const isMigratedV411 =
              parsed.version === ACCOUNTS_MIGRATION_VERSION &&
              parsed.resetV411Done === true;
            if (isMigratedV411 && Array.isArray(parsed.accounts)) {
              for (const item of parsed.accounts) {
                if (item && typeof item === 'object') {
                  const rawTiers = normalizeBattlePassTierList(item.unlockedBattlePassTiers);
                  const normAcc = this._normalizeAccount(item);
                  if (
                    isYanfufuUsername(normAcc.username) &&
                    (!rawTiers.includes(YANFUFU_VIP_TIER) || !item.vipChambreAccess)
                  ) {
                    needsGrantSave = true;
                  }
                  this._syncPlayerFromAccount(normAcc);
                }
              }
            } else {
              this.accounts = new Map();
              this.data.players = {};
              needsMigrationResetSave = true;
              this.migratedToV411 = true;
            }
          } else {
            needsMigrationResetSave = true;
            this.migratedToV411 = true;
          }
        } else {
          needsMigrationResetSave = true;
          this.migratedToV411 = true;
        }
      } catch {
        this.data = { players: {}, suggestions: [], pigeons: [] };
        this.accounts = new Map();
        needsMigrationResetSave = true;
        this.migratedToV411 = true;
      }
      if (needsMigrationResetSave || needsGrantSave) {
        this._save();
      }
      return;
    }

    try {
      if (this.dbFilePath && fs.existsSync(this.dbFilePath)) {
        const raw = fs.readFileSync(this.dbFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const normalizedPlayers = {};
          if (parsed.players && typeof parsed.players === 'object') {
            for (const [k, val] of Object.entries(parsed.players)) {
              const norm = this._normalizePlayer(val, k);
              normalizedPlayers[norm.name.toLowerCase()] = norm;
            }
          }
          const normalizedSuggestions = Array.isArray(parsed.suggestions)
            ? parsed.suggestions.map((s) => this._normalizeSuggestion(s)).filter(Boolean)
            : [];
          const normalizedPigeons = Array.isArray(parsed.pigeons)
            ? parsed.pigeons.map((p) => this._normalizePigeon(p)).filter(Boolean)
            : [];
          this.data = {
            players: normalizedPlayers,
            suggestions: normalizedSuggestions,
            pigeons: normalizedPigeons
          };
        }
      }
    } catch {
      this.data = { players: {}, suggestions: [], pigeons: [] };
    }
  }

  _save() {
    if (this.accountsFilePath) {
      try {
        fs.mkdirSync(path.dirname(this.accountsFilePath), { recursive: true });
        const payload = {
          version: ACCOUNTS_MIGRATION_VERSION,
          resetDone: true,
          resetV411Done: true,
          accounts: [...this.accounts.values()].map((acc) => this._serializeAccount(acc)),
          suggestions: this.data.suggestions,
          pigeons: this.data.pigeons
        };
        const tmp = `${this.accountsFilePath}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
        fs.renameSync(tmp, this.accountsFilePath);
      } catch {
        return;
      }
      return;
    }

    if (!this.dbFilePath) return;
    try {
      fs.mkdirSync(path.dirname(this.dbFilePath), { recursive: true });
      const tmp = `${this.dbFilePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tmp, this.dbFilePath);
    } catch {
      return;
    }
  }

  _findAccountKey(rawTarget) {
    const clean = String(rawTarget || '').trim();
    if (!clean) return null;
    const lower = clean.toLowerCase();
    if (this.accounts.has(lower)) return lower;
    const sanitized = cleanUsernameInput(clean).toLowerCase();
    if (sanitized && this.accounts.has(sanitized)) return sanitized;
    for (const [k, acc] of this.accounts.entries()) {
      if (acc.id === clean || acc.id.toLowerCase() === lower) {
        return k;
      }
    }
    return null;
  }

  _buildPublicAccountObject(acc) {
    const norm = this._normalizeAccount(acc);
    const key = norm.username.toLowerCase();
    const profile = this.getPublicProfile(key);
    const tpsAt20Count = ALL_TP_IDS.filter((id) => Number(norm.tpScores[id]) === 20).length;
    return {
      id: norm.id,
      username: norm.username,
      createdAt: norm.createdAt,
      introSeen: norm.introSeen,
      tpScores: { ...norm.tpScores },
      tpsAt20Count,
      allTpsTotal: ALL_TP_IDS.length,
      completedCount: profile?.completedCount ?? 0,
      average: profile?.average ?? computeAverage(norm.tpScores),
      xp: norm.xp,
      coins: norm.coins,
      ownedItems: [...norm.ownedItems],
      equippedSkin: norm.equippedSkin,
      equippedPet: norm.equippedPet,
      equippedTrail: norm.equippedTrail,
      validatedTps: [...norm.validatedTps],
      arcadeHighScores: { ...norm.arcadeHighScores },
      unlockedDivineSkins: [...norm.unlockedDivineSkins],
      secretSkinUnlocked: norm.secretSkinUnlocked,
      unlockedBattlePassTiers: [...norm.unlockedBattlePassTiers],
      vipChambreAccess: Boolean(norm.vipChambreAccess),
      prestigeCount: norm.prestigeCount,
      selectedSkin: norm.selectedSkin,
      avatarCustomization: { ...norm.avatarCustomization },
      ascensionTriggered: norm.ascensionTriggered,
      lastLogin: norm.lastLogin,
      lastSeen: norm.lastSeen,
      playtimeSeconds: norm.playtimeSeconds,
      updatedAt: norm.updatedAt
    };
  }

  _buildAdminAccountObject(acc) {
    const pub = this._buildPublicAccountObject(acc);
    return {
      ...pub,
      password: String(acc.password ?? '')
    };
  }

  getPublicAccount(target) {
    const key = this._findAccountKey(target);
    if (!key) return null;
    return this._buildPublicAccountObject(this.accounts.get(key));
  }

  getAccountByUsername(target) {
    const pub = this.getPublicAccount(target);
    if (!pub) return null;
    return {
      ...pub,
      grades: { ...pub.tpScores }
    };
  }

  getAdminAccount(target) {
    const key = this._findAccountKey(target);
    if (!key) return null;
    return this._buildAdminAccountObject(this.accounts.get(key));
  }

  getAllAccounts() {
    return [...this.accounts.values()]
      .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))
      .map((acc) => this._buildAdminAccountObject(acc));
  }

  registerAccount(rawInput = {}) {
    const username = cleanUsernameInput(rawInput.username || rawInput.identifiant || rawInput.name);
    if (!username || username.length < 2) {
      return {
        ok: false,
        status: 400,
        error: 'Veuillez choisir un identifiant valide (2 à 22 caractères).'
      };
    }
    const key = username.toLowerCase();
    if (this.accounts.has(key)) {
      return {
        ok: false,
        status: 409,
        error: 'Cet identifiant est déjà utilisé par un autre élève.'
      };
    }
    const password = String(rawInput.password ?? '').trim();
    if (password.length < 3) {
      return {
        ok: false,
        status: 400,
        error: 'Le mot de passe doit contenir au moins 3 caractères.'
      };
    }
    const confirmVal =
      rawInput.confirmPassword ?? rawInput.passwordConfirm ?? rawInput.confirm;
    if (confirmVal !== undefined && String(confirmVal).trim() !== password) {
      return {
        ok: false,
        status: 400,
        error: 'La confirmation du mot de passe ne correspond pas.'
      };
    }

    const nowIso = new Date().toISOString();
    const defColor = hashColor(username);
    const customSkin = sanitizeSkin(
      rawInput.avatarCustomization || rawInput.skin || DEFAULT_SKIN,
      defColor
    );
    delete customSkin.divineSpecialty;
    delete customSkin.secretSkin;
    delete customSkin.battlePassTier;
    delete customSkin.showcase;
    const isYanfufu = isYanfufuUsername(username);
    const yanSpec = isYanfufu ? getBattlePassTierSpec(YANFUFU_VIP_TIER) : null;
    if (yanSpec) {
      customSkin.battlePassTier = yanSpec.tier;
      customSkin.outfitColor = yanSpec.accentColor;
      customSkin.outfitStyle = 'cyber';
      customSkin.showcase = cloneShowcase(yanSpec.showcase);
    }
    const account = this._normalizeAccount({
      id: `acc_${crypto.randomUUID().slice(0, 12)}`,
      username,
      password,
      createdAt: nowIso,
      introSeen: false,
      tpScores: {},
      unlockedDivineSkins: [],
      secretSkinUnlocked: false,
      unlockedBattlePassTiers: isYanfufu ? [YANFUFU_VIP_TIER] : [],
      vipChambreAccess: isYanfufu,
      prestigeCount: 0,
      selectedSkin: yanSpec ? yanSpec.id : 'standard',
      avatarCustomization: customSkin,
      xp: 0,
      bestTimes: {},
      questAccepted: false,
      ascensionTriggered: false,
      playtimeSeconds: 0,
      lastLogin: nowIso,
      lastSeen: nowIso,
      updatedAt: nowIso
    });

    this._syncPlayerFromAccount(account);
    this._save();

    return {
      ok: true,
      status: 201,
      account: this._buildPublicAccountObject(account),
      adminAccount: this._buildAdminAccountObject(account),
      profile: this.getPublicProfile(key)
    };
  }

  loginAccount(rawInput = {}) {
    const rawUser = rawInput.username || rawInput.identifiant || rawInput.name || '';
    const key = this._findAccountKey(rawUser);
    const password = String(rawInput.password ?? '').trim();
    if (!key) {
      return {
        ok: false,
        status: 401,
        error: 'Identifiant ou mot de passe incorrect.'
      };
    }
    const existing = this.accounts.get(key);
    if (!existing || existing.password !== password) {
      return {
        ok: false,
        status: 401,
        error: 'Identifiant ou mot de passe incorrect.'
      };
    }

    const nowIso = new Date().toISOString();
    existing.lastLogin = nowIso;
    existing.lastSeen = nowIso;
    existing.updatedAt = nowIso;
    const account = this._normalizeAccount(existing);
    this._syncPlayerFromAccount(account);
    this._save();

    const persisted = this.accounts.get(key) || account;
    return {
      ok: true,
      status: 200,
      account: this._buildPublicAccountObject(persisted),
      profile: this.getPublicProfile(key)
    };
  }

  saveAccountData(target, payload = {}) {
    const key = this._findAccountKey(target);
    if (!key) {
      return {
        ok: false,
        status: 404,
        error: 'Compte élève introuvable.'
      };
    }
    const account = this._normalizeAccount(this.accounts.get(key));

    if (payload.introSeen !== undefined) {
      account.introSeen = Boolean(payload.introSeen);
    }

    const incomingScores = payload.tpScores || payload.grades;
    if (incomingScores && typeof incomingScores === 'object') {
      for (const tpId of ALL_TP_IDS) {
        if (typeof incomingScores[tpId] === 'number' && Number.isFinite(incomingScores[tpId])) {
          const val = Math.max(0, Math.min(20, Math.round(incomingScores[tpId] * 10) / 10));
          const prev = typeof account.tpScores[tpId] === 'number' ? account.tpScores[tpId] : -1;
          if (val > prev) {
            account.tpScores[tpId] = val;
          }
        }
      }
    }

    if (payload.tpId && ALL_TP_IDS.includes(payload.tpId) && payload.score !== undefined) {
      const parsedScore = Number(payload.score);
      if (Number.isFinite(parsedScore)) {
        const val = Math.max(0, Math.min(20, Math.round(parsedScore * 10) / 10));
        const prev = typeof account.tpScores[payload.tpId] === 'number' ? account.tpScores[payload.tpId] : -1;
        if (val > prev) {
          account.tpScores[payload.tpId] = val;
        }
      }
    }

    const allTps20 = hasAllTpsAt20InScores(account.tpScores);

    if (allTps20) {
      if (Array.isArray(payload.unlockedDivineSkins)) {
        const merged = normalizeDivineSkinList([
          ...account.unlockedDivineSkins,
          ...payload.unlockedDivineSkins
        ]);
        account.unlockedDivineSkins = merged;
      }
      if (payload.unlockDivineSkin || payload.divineSpecialty) {
        const unlockedSpec = resolveDivineSpecialtyId(
          payload.unlockDivineSkin || payload.divineSpecialty
        );
        if (unlockedSpec && !account.unlockedDivineSkins.includes(unlockedSpec)) {
          account.unlockedDivineSkins.push(unlockedSpec);
        }
      }
    }

    account.secretSkinUnlocked = hasAllDivineSpecialties(account.unlockedDivineSkins);
    if (isYanfufuUsername(account.username) && !account.unlockedBattlePassTiers.includes(YANFUFU_VIP_TIER)) {
      account.unlockedBattlePassTiers.push(YANFUFU_VIP_TIER);
      account.unlockedBattlePassTiers.sort((a, b) => a - b);
    }
    account.vipChambreAccess = hasVipChambreAccess(account.unlockedBattlePassTiers, account.username);

    const incomingCustom = payload.avatarCustomization || payload.skin;
    if (incomingCustom && typeof incomingCustom === 'object') {
      const wantCustomSecret = Boolean(
        incomingCustom.secretSkin || isSecretUltimateSkinId(incomingCustom.divineSpecialty)
      );
      account.avatarCustomization = sanitizeSkin(
        { ...account.avatarCustomization, ...incomingCustom },
        account.avatarCustomization.outfitColor
      );
      const customDivineSpec = account.avatarCustomization.divineSpecialty;
      const customBpSpec = getBattlePassTierSpec(account.avatarCustomization.battlePassTier);
      const customShopSpec = getShopSkinById(account.avatarCustomization.shopSkinId);
      if (
        !incomingCustom.divineSpecialty &&
        !incomingCustom.secretSkin &&
        !incomingCustom.battlePassTier &&
        !incomingCustom.shopSkinId &&
        payload.selectedSkin === undefined
      ) {
        delete account.avatarCustomization.divineSpecialty;
        delete account.avatarCustomization.secretSkin;
        delete account.avatarCustomization.battlePassTier;
        delete account.avatarCustomization.showcase;
        delete account.avatarCustomization.shopSkinId;
        account.equippedSkin = null;
        account.selectedSkin = 'standard';
      } else if (wantCustomSecret) {
        delete account.avatarCustomization.battlePassTier;
        delete account.avatarCustomization.showcase;
        delete account.avatarCustomization.shopSkinId;
        account.equippedSkin = null;
        if (account.secretSkinUnlocked) {
          account.selectedSkin = ULTIMATE_SECRET_SKIN_ID;
          account.avatarCustomization.divineSpecialty = ULTIMATE_SECRET_SKIN_ID;
          account.avatarCustomization.secretSkin = true;
        } else {
          delete account.avatarCustomization.divineSpecialty;
          delete account.avatarCustomization.secretSkin;
          account.selectedSkin = 'standard';
        }
      } else if (customDivineSpec) {
        delete account.avatarCustomization.secretSkin;
        delete account.avatarCustomization.battlePassTier;
        delete account.avatarCustomization.showcase;
        delete account.avatarCustomization.shopSkinId;
        account.equippedSkin = null;
        if (allTps20 && !account.unlockedDivineSkins.includes(customDivineSpec)) {
          account.unlockedDivineSkins.push(customDivineSpec);
          account.secretSkinUnlocked = hasAllDivineSpecialties(account.unlockedDivineSkins);
        }
        if (account.unlockedDivineSkins.includes(customDivineSpec)) {
          account.selectedSkin = customDivineSpec;
        } else {
          delete account.avatarCustomization.divineSpecialty;
          account.selectedSkin = 'standard';
        }
      } else if (customBpSpec) {
        delete account.avatarCustomization.divineSpecialty;
        delete account.avatarCustomization.secretSkin;
        delete account.avatarCustomization.shopSkinId;
        account.equippedSkin = null;
        if (account.unlockedBattlePassTiers.includes(customBpSpec.tier)) {
          account.selectedSkin = customBpSpec.id;
          account.avatarCustomization.battlePassTier = customBpSpec.tier;
          account.avatarCustomization.outfitColor = customBpSpec.accentColor;
          account.avatarCustomization.outfitStyle = 'cyber';
          account.avatarCustomization.showcase = cloneShowcase(customBpSpec.showcase);
        } else {
          delete account.avatarCustomization.battlePassTier;
          delete account.avatarCustomization.showcase;
          account.selectedSkin = 'standard';
        }
      } else if (customShopSpec) {
        delete account.avatarCustomization.divineSpecialty;
        delete account.avatarCustomization.secretSkin;
        delete account.avatarCustomization.battlePassTier;
        delete account.avatarCustomization.showcase;
        if (account.ownedItems.includes(customShopSpec.id)) {
          account.selectedSkin = customShopSpec.id;
          account.equippedSkin = customShopSpec.id;
          account.avatarCustomization.shopSkinId = customShopSpec.id;
          account.avatarCustomization.outfitColor = customShopSpec.outfitColor;
          account.avatarCustomization.pantsColor = customShopSpec.pantsColor || account.avatarCustomization.pantsColor;
          account.avatarCustomization.outfitStyle = 'cyber';
        } else {
          delete account.avatarCustomization.shopSkinId;
          account.equippedSkin = null;
          account.selectedSkin = 'standard';
        }
      }
      if (account.avatarCustomization.equippedPet && !account.ownedItems.includes(account.avatarCustomization.equippedPet)) {
        delete account.avatarCustomization.equippedPet;
        account.equippedPet = null;
      } else if (account.avatarCustomization.equippedPet) {
        account.equippedPet = account.avatarCustomization.equippedPet;
      }
      if (account.avatarCustomization.equippedTrail && !account.ownedItems.includes(account.avatarCustomization.equippedTrail)) {
        delete account.avatarCustomization.equippedTrail;
        account.equippedTrail = null;
      } else if (account.avatarCustomization.equippedTrail) {
        account.equippedTrail = account.avatarCustomization.equippedTrail;
      }
    }

    if (payload.selectedSkin !== undefined) {
      if (
        payload.selectedSkin === null ||
        payload.selectedSkin === '' ||
        payload.selectedSkin === 'standard' ||
        payload.selectedSkin === 'default'
      ) {
        account.selectedSkin = 'standard';
        delete account.avatarCustomization.divineSpecialty;
        delete account.avatarCustomization.secretSkin;
        delete account.avatarCustomization.battlePassTier;
        delete account.avatarCustomization.showcase;
      } else if (isSecretUltimateSkinId(payload.selectedSkin)) {
        account.secretSkinUnlocked = hasAllDivineSpecialties(account.unlockedDivineSkins);
        delete account.avatarCustomization.battlePassTier;
        delete account.avatarCustomization.showcase;
        if (account.secretSkinUnlocked) {
          account.selectedSkin = ULTIMATE_SECRET_SKIN_ID;
          account.avatarCustomization = sanitizeSkin(
            {
              ...account.avatarCustomization,
              outfitColor: ULTIMATE_SECRET_SKIN_COLOR,
              outfitStyle: 'cyber',
              divineSpecialty: ULTIMATE_SECRET_SKIN_ID,
              secretSkin: true
            },
            ULTIMATE_SECRET_SKIN_COLOR
          );
        } else {
          account.selectedSkin = 'standard';
          delete account.avatarCustomization.divineSpecialty;
          delete account.avatarCustomization.secretSkin;
        }
      } else {
        const bpSpec = getBattlePassTierSpec(payload.selectedSkin);
        const specId = bpSpec ? null : resolveDivineSpecialtyId(payload.selectedSkin);
        if (bpSpec) {
          if (account.unlockedBattlePassTiers.includes(bpSpec.tier)) {
            account.selectedSkin = bpSpec.id;
            const cleanCustom = { ...account.avatarCustomization };
            delete cleanCustom.divineSpecialty;
            delete cleanCustom.secretSkin;
            account.avatarCustomization = sanitizeSkin(
              {
                ...cleanCustom,
                outfitColor: bpSpec.accentColor,
                outfitStyle: 'cyber',
                battlePassTier: bpSpec.tier,
                showcase: cloneShowcase(bpSpec.showcase)
              },
              bpSpec.accentColor
            );
          } else {
            account.selectedSkin = 'standard';
            delete account.avatarCustomization.divineSpecialty;
            delete account.avatarCustomization.secretSkin;
            delete account.avatarCustomization.battlePassTier;
            delete account.avatarCustomization.showcase;
          }
        } else if (specId) {
          if (allTps20 && !account.unlockedDivineSkins.includes(specId)) {
            account.unlockedDivineSkins.push(specId);
            account.secretSkinUnlocked = hasAllDivineSpecialties(account.unlockedDivineSkins);
          }
          if (account.unlockedDivineSkins.includes(specId)) {
            account.selectedSkin = specId;
            const cleanCustom = { ...account.avatarCustomization };
            delete cleanCustom.secretSkin;
            delete cleanCustom.battlePassTier;
            delete cleanCustom.showcase;
            account.avatarCustomization = sanitizeSkin(
              {
                ...cleanCustom,
                outfitColor: DIVINE_SPECIALTY_COLORS[specId],
                outfitStyle: 'cyber',
                divineSpecialty: specId
              },
              DIVINE_SPECIALTY_COLORS[specId]
            );
          } else {
            account.selectedSkin = 'standard';
            delete account.avatarCustomization.divineSpecialty;
            delete account.avatarCustomization.secretSkin;
            delete account.avatarCustomization.battlePassTier;
            delete account.avatarCustomization.showcase;
          }
        } else if (isShopSkinId(payload.selectedSkin)) {
          const shopSpec = getShopSkinById(payload.selectedSkin);
          if (shopSpec && account.ownedItems.includes(shopSpec.id)) {
            account.selectedSkin = shopSpec.id;
            account.equippedSkin = shopSpec.id;
            const cleanCustom = { ...account.avatarCustomization };
            delete cleanCustom.divineSpecialty;
            delete cleanCustom.secretSkin;
            delete cleanCustom.battlePassTier;
            delete cleanCustom.showcase;
            account.avatarCustomization = sanitizeSkin(
              {
                ...cleanCustom,
                outfitColor: shopSpec.outfitColor,
                pantsColor: shopSpec.pantsColor,
                outfitStyle: 'cyber',
                shopSkinId: shopSpec.id
              },
              shopSpec.outfitColor
            );
          } else {
            account.selectedSkin = 'standard';
            account.equippedSkin = null;
            delete account.avatarCustomization.divineSpecialty;
            delete account.avatarCustomization.secretSkin;
            delete account.avatarCustomization.battlePassTier;
            delete account.avatarCustomization.showcase;
            delete account.avatarCustomization.shopSkinId;
          }
        } else {
          account.selectedSkin = 'standard';
          account.equippedSkin = null;
          delete account.avatarCustomization.divineSpecialty;
          delete account.avatarCustomization.secretSkin;
          delete account.avatarCustomization.battlePassTier;
          delete account.avatarCustomization.showcase;
          delete account.avatarCustomization.shopSkinId;
        }
      }
    }

    if (payload.equippedPet !== undefined) {
      if (payload.equippedPet && account.ownedItems.includes(payload.equippedPet) && isShopPetId(payload.equippedPet)) {
        account.equippedPet = payload.equippedPet;
        account.avatarCustomization.equippedPet = payload.equippedPet;
      } else {
        account.equippedPet = null;
        delete account.avatarCustomization.equippedPet;
      }
    }

    if (payload.equippedTrail !== undefined) {
      if (payload.equippedTrail && account.ownedItems.includes(payload.equippedTrail) && isShopAccessoryId(payload.equippedTrail)) {
        account.equippedTrail = payload.equippedTrail;
        account.avatarCustomization.equippedTrail = payload.equippedTrail;
      } else {
        account.equippedTrail = null;
        delete account.avatarCustomization.equippedTrail;
      }
    }

    account.secretSkinUnlocked = hasAllDivineSpecialties(account.unlockedDivineSkins);
    account.updatedAt = new Date().toISOString();
    account.lastSeen = account.updatedAt;
    const normalized = this._normalizeAccount(account);
    this._syncPlayerFromAccount(normalized);
    this._save();

    return {
      ok: true,
      status: 200,
      account: this._buildPublicAccountObject(normalized),
      profile: this.getPublicProfile(key)
    };
  }

  unlockDivineSkin(rawName, rawSpecialty, equip = true, options = {}) {
    const specId = resolveDivineSpecialtyId(rawSpecialty) || 'cyber';
    const name = sanitizeName(rawName);
    const key = name.toLowerCase();
    this.getOrCreatePlayer(name);
    const player = this._normalizePlayer(this.data.players[key], name);
    const hasAll20 = hasAllTpsAt20InScores(player.grades);
    if (!hasAll20 && !options.allowCreator) {
      return this.getPublicProfile(key);
    }

    const unlocked = normalizeDivineSkinList([...(player.unlockedDivineSkins || []), specId]);
    player.unlockedDivineSkins = unlocked;
    player.secretSkinUnlocked = hasAllDivineSpecialties(unlocked);
    if (hasAll20) {
      player.grades = {};
      player.tpScores = {};
      player.average = null;
      player.completedCount = 0;
      player.diplomaEarned = false;
      player.diplomas = [];
      player.ascensionTriggered = false;
      player.prestigeCount = (player.prestigeCount || 0) + 1;
    }
    if (equip) {
      player.selectedSkin = specId;
      const baseSkin = { ...player.skin };
      delete baseSkin.secretSkin;
      player.skin = sanitizeSkin(
        {
          ...baseSkin,
          outfitColor: DIVINE_SPECIALTY_COLORS[specId],
          outfitStyle: 'cyber',
          divineSpecialty: specId
        },
        DIVINE_SPECIALTY_COLORS[specId]
      );
      player.color = player.skin.outfitColor;
      player.avatarCustomization = { ...player.skin };
    }
    player.updatedAt = new Date().toISOString();
    this.data.players[key] = player;
    this._syncAccountFromPlayer(player);
    this._save();
    return this.getPublicProfile(key);
  }

  updateAccountPassword(target, newPassword) {
    const key = this._findAccountKey(target);
    if (!key) return null;
    const cleanPw = String(newPassword ?? '').trim();
    if (cleanPw.length < 3) {
      throw new Error('Le nouveau mot de passe doit contenir au moins 3 caractères.');
    }
    const account = this.accounts.get(key);
    account.password = cleanPw;
    account.updatedAt = new Date().toISOString();
    this.accounts.set(key, account);
    this._save();
    return this._buildAdminAccountObject(account);
  }

  resetAccount(target) {
    const key = this._findAccountKey(target) || this._findPlayerKey(target);
    if (!key) return null;
    const acc = this.accounts.get(key);
    const targetName = acc ? acc.username : key;
    const profile = this.resetPlayer(targetName);
    const updatedAcc = this.accounts.get(key);
    return {
      account: updatedAcc ? this._buildAdminAccountObject(updatedAcc) : null,
      profile
    };
  }

  deleteAccount(target) {
    const key = this._findAccountKey(target) || this._findPlayerKey(target);
    if (!key) return null;
    const acc = this.accounts.get(key);
    const player = this.data.players[key];
    const username = acc?.username || player?.name || String(target);
    const id = acc?.id || null;
    this.accounts.delete(key);
    delete this.data.players[key];
    this._save();
    return { deleted: true, username, id };
  }

  _applyPlayerSkinSelection(player, rawSkin) {
    const nextSkin = sanitizeSkin(rawSkin, player.color);
    const secretUnlocked = hasAllDivineSpecialties(player.unlockedDivineSkins);
    const unlockedBp = normalizeBattlePassTierList([
      ...(player.unlockedBattlePassTiers || []),
      ...(isYanfufuUsername(player.name) ? [YANFUFU_VIP_TIER] : [])
    ]);
    const ownedItems = normalizeOwnedItems(player.ownedItems);
    player.unlockedBattlePassTiers = unlockedBp;
    player.vipChambreAccess = hasVipChambreAccess(unlockedBp, player.name);
    player.ownedItems = ownedItems;
    const wantSecret = Boolean(
      nextSkin.secretSkin || isSecretUltimateSkinId(nextSkin.divineSpecialty)
    );
    const bpSpec =
      !wantSecret && !nextSkin.divineSpecialty
        ? getBattlePassTierSpec(nextSkin.battlePassTier)
        : null;
    const shopSpec =
      !wantSecret && !nextSkin.divineSpecialty && !bpSpec
        ? getShopSkinById(nextSkin.shopSkinId || rawSkin?.shopSkinId || rawSkin?.equippedSkin)
        : null;
    if (wantSecret) {
      delete nextSkin.battlePassTier;
      delete nextSkin.showcase;
      delete nextSkin.shopSkinId;
      if (secretUnlocked) {
        nextSkin.divineSpecialty = ULTIMATE_SECRET_SKIN_ID;
        nextSkin.secretSkin = true;
        nextSkin.outfitColor = ULTIMATE_SECRET_SKIN_COLOR;
        nextSkin.outfitStyle = 'cyber';
      } else {
        delete nextSkin.divineSpecialty;
        delete nextSkin.secretSkin;
      }
    } else if (nextSkin.divineSpecialty) {
      delete nextSkin.battlePassTier;
      delete nextSkin.showcase;
      delete nextSkin.secretSkin;
      delete nextSkin.shopSkinId;
      if (!player.unlockedDivineSkins.includes(nextSkin.divineSpecialty)) {
        delete nextSkin.divineSpecialty;
      }
    } else if (bpSpec && unlockedBp.includes(bpSpec.tier)) {
      nextSkin.battlePassTier = bpSpec.tier;
      nextSkin.outfitColor = bpSpec.accentColor;
      nextSkin.outfitStyle = 'cyber';
      nextSkin.showcase = cloneShowcase(bpSpec.showcase);
      delete nextSkin.divineSpecialty;
      delete nextSkin.secretSkin;
      delete nextSkin.shopSkinId;
    } else if (shopSpec && ownedItems.includes(shopSpec.id)) {
      nextSkin.shopSkinId = shopSpec.id;
      nextSkin.outfitColor = shopSpec.outfitColor;
      nextSkin.pantsColor = shopSpec.pantsColor || nextSkin.pantsColor;
      nextSkin.outfitStyle = 'cyber';
      delete nextSkin.divineSpecialty;
      delete nextSkin.secretSkin;
      delete nextSkin.battlePassTier;
      delete nextSkin.showcase;
    } else {
      delete nextSkin.divineSpecialty;
      delete nextSkin.secretSkin;
      delete nextSkin.battlePassTier;
      delete nextSkin.showcase;
      delete nextSkin.shopSkinId;
    }
    if (nextSkin.equippedPet && !ownedItems.includes(nextSkin.equippedPet)) {
      delete nextSkin.equippedPet;
    } else if (!nextSkin.equippedPet && player.equippedPet && ownedItems.includes(player.equippedPet)) {
      nextSkin.equippedPet = player.equippedPet;
    }
    if (nextSkin.equippedTrail && !ownedItems.includes(nextSkin.equippedTrail)) {
      delete nextSkin.equippedTrail;
    } else if (!nextSkin.equippedTrail && player.equippedTrail && ownedItems.includes(player.equippedTrail)) {
      nextSkin.equippedTrail = player.equippedTrail;
    }
    player.skin = nextSkin;
    player.color = nextSkin.outfitColor;
    player.equippedSkin = nextSkin.shopSkinId || null;
    player.equippedPet = nextSkin.equippedPet || null;
    player.equippedTrail = nextSkin.equippedTrail || null;
    player.selectedSkin = nextSkin.secretSkin
      ? ULTIMATE_SECRET_SKIN_ID
      : nextSkin.divineSpecialty ||
        (nextSkin.battlePassTier
          ? getBattlePassSkinId(nextSkin.battlePassTier)
          : nextSkin.shopSkinId || 'standard');
    player.avatarCustomization = { ...nextSkin };
  }

  getOrCreatePlayer(rawName, rawSkin = null) {
    const name = sanitizeName(rawName);
    const key = name.toLowerCase();
    let changed = false;

    if (!this.data.players[key]) {
      const existingAcc = this.accounts.get(key);
      if (existingAcc) {
        this._syncPlayerFromAccount(existingAcc);
        changed = true;
      } else {
        const defColor = hashColor(name);
        const skin = sanitizeSkin(rawSkin, defColor);
        delete skin.divineSpecialty;
        delete skin.secretSkin;
        delete skin.battlePassTier;
        delete skin.showcase;
        const isYanfufu = isYanfufuUsername(name);
        this.data.players[key] = this._normalizePlayer(
          {
            name,
            color: skin.outfitColor,
            skin,
            introSeen: false,
            unlockedDivineSkins: [],
            secretSkinUnlocked: false,
            unlockedBattlePassTiers: [],
            vipChambreAccess: isYanfufu,
            prestigeCount: 0,
            selectedSkin: 'standard',
            xp: 0,
            questAccepted: false,
            ascensionTriggered: false,
            grades: {},
            bestTimes: {},
            average: null,
            diplomaEarned: false,
            diplomas: [],
            updatedAt: new Date().toISOString()
          },
          name
        );
        changed = true;
      }
    } else if (rawSkin && typeof rawSkin === 'object') {
      const current = this._normalizePlayer(this.data.players[key], name);
      this._applyPlayerSkinSelection(current, rawSkin);
      current.updatedAt = new Date().toISOString();
      this.data.players[key] = current;
      this._syncAccountFromPlayer(current);
      changed = true;
    }

    if (changed) this._save();
    return this.getPublicProfile(key);
  }

  updatePlayerSkin(rawName, rawSkin) {
    const name = sanitizeName(rawName);
    const key = name.toLowerCase();
    this.getOrCreatePlayer(name);
    const player = this._normalizePlayer(this.data.players[key], name);
    this._applyPlayerSkinSelection(player, rawSkin);
    player.updatedAt = new Date().toISOString();
    this.data.players[key] = player;
    this._syncAccountFromPlayer(player);
    this._save();
    return this.getPublicProfile(key);
  }

  acceptQuest(rawName) {
    const name = sanitizeName(rawName);
    const key = name.toLowerCase();
    this.getOrCreatePlayer(name);
    const player = this._normalizePlayer(this.data.players[key], name);
    player.questAccepted = true;
    player.updatedAt = new Date().toISOString();
    this.data.players[key] = player;
    this._syncAccountFromPlayer(player);
    this._save();
    return this.getPublicProfile(key);
  }

  recordTpScore(rawName, tpId, rawScore, durationSec = 0, rawSkin = null) {
    if (!ALL_TP_IDS.includes(tpId)) {
      throw new Error(`TP inconnu: ${tpId}`);
    }
    const name = sanitizeName(rawName);
    const key = name.toLowerCase();
    this.getOrCreatePlayer(name, rawSkin);
    const player = this._normalizePlayer(this.data.players[key], name);

    const parsedScore = Number(rawScore);
    const score = Number.isFinite(parsedScore)
      ? Math.max(0, Math.min(20, Math.round(parsedScore * 10) / 10))
      : 0;
    const prevScore = typeof player.grades[tpId] === 'number' ? player.grades[tpId] : 0;
    const isNewBest = score > prevScore || typeof player.grades[tpId] !== 'number';
    const wasValidatedBefore =
      player.validatedTps.includes(tpId) || (typeof player.grades[tpId] === 'number' && prevScore >= 10);
    const isFirstValidation = score >= 10 && !wasValidatedBefore;

    if (isNewBest) {
      player.grades[tpId] = score;
    }
    if (score >= 10 && !player.validatedTps.includes(tpId)) {
      player.validatedTps.push(tpId);
    }

    const cleanDuration = Math.max(1, Math.round(Number(durationSec) || 0));
    if (
      cleanDuration > 0 &&
      (!player.bestTimes[tpId] || (isNewBest && cleanDuration < player.bestTimes[tpId]))
    ) {
      player.bestTimes[tpId] = cleanDuration;
    }

    const xpGain = Math.round(score * 15) + (isNewBest ? 50 : 15);
    player.xp += xpGain;
    player.questAccepted = true;

    const completedCount = TP_IDS.filter(
      (id) => typeof player.grades[id] === 'number' && player.grades[id] >= 10
    ).length;
    player.average = computeAverage(player.grades);
    if (completedCount === TP_IDS.length) {
      player.diplomaEarned = true;
    }
    player.diplomas = computeDiplomas(player.grades, player.average, player.diplomaEarned);

    const coinReward = computeTpCoinReward({
      score,
      isFirstValidation,
      average: player.average
    });
    const coinsEarned = coinReward.totalCoins;
    player.coins = Math.max(0, (player.coins || 0) + coinsEarned);

    const allTpsAt20 = hasAllTpsAt20InScores(player.grades);
    const firstTimeAllAt20 = allTpsAt20 && !player.ascensionTriggered;
    if (firstTimeAllAt20) {
      player.ascensionTriggered = true;
    }
    player.updatedAt = new Date().toISOString();
    this.data.players[key] = player;
    this._syncAccountFromPlayer(player);
    this._save();

    return {
      profile: this.getPublicProfile(key),
      xpGain,
      coinsEarned,
      coinBreakdown: coinReward,
      coins: player.coins,
      isNewBest,
      isFirstValidation,
      score,
      completedCount,
      allTpsAt20,
      firstTimeAllAt20
    };
  }

  validateAllTps(rawName, rawSkin = null) {
    const name = sanitizeName(rawName);
    const key = name.toLowerCase();
    this.getOrCreatePlayer(name, rawSkin);
    const player = this._normalizePlayer(this.data.players[key], name);
    for (const id of ALL_TP_IDS) {
      player.grades[id] = 20;
      if (!player.validatedTps.includes(id)) {
        player.validatedTps.push(id);
      }
      if (!player.bestTimes[id]) {
        player.bestTimes[id] = 45;
      }
    }
    player.xp = Math.max(player.xp + 1750, 3150);
    player.coins = Math.max(player.coins || 0, 1200);
    player.questAccepted = true;
    player.ascensionTriggered = true;
    player.average = computeAverage(player.grades);
    player.diplomaEarned = true;
    player.diplomas = computeDiplomas(player.grades, player.average, true);
    player.updatedAt = new Date().toISOString();
    this.data.players[key] = player;
    this._syncAccountFromPlayer(player);
    this._save();
    return {
      profile: this.getPublicProfile(key),
      score: 20,
      completedCount: TP_IDS.length
    };
  }

  awardCoins(target, amount, reason = 'reward') {
    const cleanAmount = Math.max(0, Math.min(10000, Math.floor(Number(amount) || 0)));
    const accKey = this._findAccountKey(target);
    const name = accKey ? this.accounts.get(accKey).username : sanitizeName(target);
    const key = name.toLowerCase();
    this.getOrCreatePlayer(name);
    const player = this._normalizePlayer(this.data.players[key], name);
    player.coins = Math.max(0, (player.coins || 0) + cleanAmount);
    player.updatedAt = new Date().toISOString();
    this.data.players[key] = player;
    this._syncAccountFromPlayer(player);
    this._save();
    const profile = this.getPublicProfile(key);
    const account = this.getPublicAccount(key);
    return {
      ok: true,
      reason,
      coinsEarned: cleanAmount,
      coins: profile.coins,
      profile,
      account
    };
  }

  recordSurvivalReward(target, { outcome = 'defeat', solvedTables = 0, matchId = null } = {}) {
    const accKey = this._findAccountKey(target);
    const name = accKey ? this.accounts.get(accKey).username : sanitizeName(target);
    const key = name.toLowerCase();
    const now = Date.now();
    let tracker = this._survivalMatchClaimed.get(key);
    if (!tracker) {
      tracker = { matchIds: new Set(), timestamps: [] };
      this._survivalMatchClaimed.set(key, tracker);
    }
    tracker.timestamps = tracker.timestamps.filter((ts) => ts >= now - 60000);
    if (tracker.timestamps.length >= 6) {
      return {
        ok: false,
        status: 429,
        error: 'Trop de récompenses Survie réclamées en peu de temps (anti-triche).'
      };
    }
    const cleanMatchId = matchId ? String(matchId).trim() : '';
    if (cleanMatchId && tracker.matchIds.has(cleanMatchId)) {
      return {
        ok: false,
        status: 409,
        error: 'Récompense déjà attribuée pour cette partie Survie.'
      };
    }
    this.getOrCreatePlayer(name);
    const player = this._normalizePlayer(this.data.players[key], name);
    const reward = computeSurvivalCoinReward({ outcome, solvedTables });
    if (cleanMatchId) {
      tracker.matchIds.add(cleanMatchId);
      if (tracker.matchIds.size > 100) {
        const oldest = tracker.matchIds.values().next().value;
        tracker.matchIds.delete(oldest);
      }
    }
    tracker.timestamps.push(now);
    player.coins = Math.max(0, (player.coins || 0) + reward.totalCoins);
    player.xp = Math.max(0, (player.xp || 0) + (outcome === 'victory' ? 200 : 60));
    player.updatedAt = new Date().toISOString();
    this.data.players[key] = player;
    this._syncAccountFromPlayer(player);
    this._save();
    const profile = this.getPublicProfile(key);
    const account = this.getPublicAccount(key);
    return {
      ok: true,
      status: 200,
      outcome: outcome === 'victory' ? 'victory' : 'defeat',
      coinsEarned: reward.totalCoins,
      baseCoins: reward.baseCoins,
      detentionBonus: reward.detentionBonus,
      solvedTables: reward.solvedTables,
      coins: profile.coins,
      profile,
      account
    };
  }

  recordDetentionTableReward(target, { solvedInMatch = 0 } = {}) {
    const accKey = this._findAccountKey(target);
    const name = accKey ? this.accounts.get(accKey).username : sanitizeName(target);
    const key = name.toLowerCase();
    this.getOrCreatePlayer(name);
    const player = this._normalizePlayer(this.data.players[key], name);
    const coinsEarned = computeDetentionTableCoinReward({ solvedInMatch });
    if (coinsEarned > 0) {
      player.coins = Math.max(0, (player.coins || 0) + coinsEarned);
      player.xp = Math.max(0, (player.xp || 0) + 25);
      player.updatedAt = new Date().toISOString();
      this.data.players[key] = player;
      this._syncAccountFromPlayer(player);
      this._save();
    }
    const profile = this.getPublicProfile(key);
    const account = this.getPublicAccount(key);
    return {
      ok: true,
      status: 200,
      coinsEarned,
      capped: coinsEarned === 0,
      coins: profile.coins,
      profile,
      account
    };
  }

  recordArcadeScore(target, { gameId, score } = {}) {
    const cleanGameId = String(gameId || '').trim();
    const rule = ARCADE_GAME_RULES[cleanGameId];
    const numScore = Math.floor(Number(score) || 0);
    if (!rule || !Number.isFinite(numScore) || numScore <= 0 || numScore > rule.maxValidScore) {
      return {
        ok: false,
        status: 400,
        error: 'Score mini-jeu invalide ou hors limites anti-triche.'
      };
    }

    const accKey = this._findAccountKey(target);
    const name = accKey ? this.accounts.get(accKey).username : sanitizeName(target);
    const key = name.toLowerCase();
    const now = Date.now();
    const recentClaims = (this._arcadeClaimHistory.get(key) || []).filter((ts) => ts >= now - 30000);
    if (recentClaims.length >= 12) {
      this._arcadeClaimHistory.set(key, recentClaims);
      return {
        ok: false,
        status: 429,
        error: 'Trop de parties enregistrées en peu de temps (anti-triche).'
      };
    }
    recentClaims.push(now);
    this._arcadeClaimHistory.set(key, recentClaims);

    this.getOrCreatePlayer(name);
    const player = this._normalizePlayer(this.data.players[key], name);

    const prevBest = Number(player.arcadeHighScores[cleanGameId]) || 0;
    const isNewRecord = numScore > prevBest;
    if (isNewRecord) {
      player.arcadeHighScores[cleanGameId] = numScore;
    }

    const reward = computeArcadeCoinReward({
      gameId: cleanGameId,
      score: numScore,
      isNewRecord
    });
    const coinsEarned = reward.totalCoins;
    player.coins = Math.max(0, (player.coins || 0) + coinsEarned);
    player.xp = Math.max(0, (player.xp || 0) + Math.round(coinsEarned * 2));
    player.updatedAt = new Date().toISOString();
    this.data.players[key] = player;
    this._syncAccountFromPlayer(player);
    this._save();

    const profile = this.getPublicProfile(key);
    const account = this.getPublicAccount(key);
    return {
      ok: true,
      status: 200,
      gameId: cleanGameId,
      gameLabel: rule.label,
      score: numScore,
      isNewRecord,
      highScore: player.arcadeHighScores[cleanGameId] || numScore,
      coinsEarned,
      baseCoins: reward.baseCoins,
      recordBonus: reward.recordBonus,
      coins: profile.coins,
      profile,
      account
    };
  }

  buyShopItem(target, itemId) {
    const item = getShopItemById(itemId);
    if (!item) {
      return {
        ok: false,
        status: 404,
        error: 'Article introuvable dans le catalogue de la boutique.'
      };
    }

    const accKey = this._findAccountKey(target);
    const name = accKey ? this.accounts.get(accKey).username : sanitizeName(target);
    const key = name.toLowerCase();
    this.getOrCreatePlayer(name);
    const player = this._normalizePlayer(this.data.players[key], name);

    if (player.ownedItems.includes(item.id)) {
      return {
        ok: false,
        status: 409,
        error: 'Vous possédez déjà cet article dans votre inventaire.'
      };
    }

    const currentCoins = Math.max(0, Math.floor(Number(player.coins) || 0));
    if (currentCoins < item.price) {
      return {
        ok: false,
        status: 400,
        error: `Solde de CIEL Coins insuffisant (${currentCoins} / ${item.price} 🪙 CC).`
      };
    }

    player.coins = currentCoins - item.price;
    player.ownedItems.push(item.id);
    player.updatedAt = new Date().toISOString();
    this.data.players[key] = player;
    this._syncAccountFromPlayer(player);
    this._save();

    const profile = this.getPublicProfile(key);
    const account = this.getPublicAccount(key);
    return {
      ok: true,
      status: 200,
      item,
      coins: profile.coins,
      ownedItems: profile.ownedItems,
      profile,
      account
    };
  }

  equipShopItem(target, { itemId, category = null, equip = true } = {}) {
    const accKey = this._findAccountKey(target);
    const name = accKey ? this.accounts.get(accKey).username : sanitizeName(target);
    const key = name.toLowerCase();
    this.getOrCreatePlayer(name);
    const player = this._normalizePlayer(this.data.players[key], name);

    const cleanId = String(itemId || '').trim();
    const isUnequip =
      equip === false || !cleanId || cleanId === 'none' || cleanId === 'standard' || cleanId === 'default';

    if (isUnequip) {
      const targetItem = cleanId ? getShopItemById(cleanId) : null;
      const targetCat = category || targetItem?.category || 'skins';
      if (targetCat === 'pets') {
        player.equippedPet = null;
        delete player.skin.equippedPet;
      } else if (targetCat === 'accessories') {
        player.equippedTrail = null;
        delete player.skin.equippedTrail;
      } else {
        player.equippedSkin = null;
        player.selectedSkin = 'standard';
        delete player.skin.shopSkinId;
        delete player.skin.divineSpecialty;
        delete player.skin.secretSkin;
        delete player.skin.battlePassTier;
        delete player.skin.showcase;
      }
    } else {
      const item = getShopItemById(cleanId);
      if (!item) {
        return {
          ok: false,
          status: 404,
          error: 'Article introuvable dans la boutique.'
        };
      }
      if (!player.ownedItems.includes(item.id)) {
        return {
          ok: false,
          status: 403,
          error: 'Vous devez acheter cet article avant de pouvoir l’équiper.'
        };
      }
      if (item.category === 'skins') {
        player.equippedSkin = item.id;
        player.selectedSkin = item.id;
        delete player.skin.divineSpecialty;
        delete player.skin.secretSkin;
        delete player.skin.battlePassTier;
        delete player.skin.showcase;
        player.skin.shopSkinId = item.id;
        player.skin.outfitColor = item.outfitColor;
        player.skin.pantsColor = item.pantsColor || player.skin.pantsColor;
        player.skin.outfitStyle = 'cyber';
        player.color = item.outfitColor;
      } else if (item.category === 'pets') {
        player.equippedPet = item.id;
        player.skin.equippedPet = item.id;
      } else if (item.category === 'accessories') {
        player.equippedTrail = item.id;
        player.skin.equippedTrail = item.id;
      }
    }

    player.avatarCustomization = { ...player.skin };
    player.updatedAt = new Date().toISOString();
    this.data.players[key] = player;
    this._syncAccountFromPlayer(player);
    this._save();

    const profile = this.getPublicProfile(key);
    const account = this.getPublicAccount(key);
    return {
      ok: true,
      status: 200,
      equippedSkin: profile.equippedSkin,
      equippedPet: profile.equippedPet,
      equippedTrail: profile.equippedTrail,
      skin: profile.skin,
      profile,
      account
    };
  }

  _findPlayerKey(rawName) {
    const rawKey = String(rawName || '').trim().toLowerCase();
    if (rawKey && this.data.players[rawKey]) return rawKey;
    const sanitizedKey = sanitizeName(rawName).toLowerCase();
    if (sanitizedKey && this.data.players[sanitizedKey]) return sanitizedKey;
    return null;
  }

  recordLogin(rawName) {
    const name = sanitizeName(rawName);
    const key = name.toLowerCase();
    this.getOrCreatePlayer(name);
    const player = this._normalizePlayer(this.data.players[key], name);
    const nowIso = new Date().toISOString();
    player.lastLogin = nowIso;
    player.lastSeen = nowIso;
    player.updatedAt = nowIso;
    this.data.players[key] = player;
    this._syncAccountFromPlayer(player);
    this._save();
    return this.getPublicProfile(key);
  }

  addPlaytime(rawName, seconds) {
    const key = this._findPlayerKey(rawName);
    if (!key) return null;
    const addSec = Math.max(0, Math.round(Number(seconds) || 0));
    const player = this._normalizePlayer(this.data.players[key], key);
    const nowIso = new Date().toISOString();
    player.playtimeSeconds += addSec;
    player.lastSeen = nowIso;
    player.updatedAt = nowIso;
    this.data.players[key] = player;
    this._syncAccountFromPlayer(player);
    this._save();
    return this.getPublicProfile(key);
  }

  resetPlayer(rawName) {
    const key = this._findPlayerKey(rawName) || this._findAccountKey(rawName);
    if (!key) return null;
    const existingAcc = this.accounts.get(key);
    const current = this.data.players[key]
      ? this._normalizePlayer(this.data.players[key], key)
      : this._normalizePlayer({ name: existingAcc?.username || rawName }, rawName);
    const nowIso = new Date().toISOString();
    const cleanSkin = { ...current.skin };
    delete cleanSkin.divineSpecialty;
    delete cleanSkin.secretSkin;
    delete cleanSkin.battlePassTier;
    delete cleanSkin.showcase;
    delete cleanSkin.shopSkinId;
    delete cleanSkin.equippedPet;
    delete cleanSkin.equippedTrail;
    const isYanfufu = isYanfufuUsername(current.name);
    const preservedBpTiers = isYanfufu ? [YANFUFU_VIP_TIER] : [];
    const yanSpec = isYanfufu ? getBattlePassTierSpec(YANFUFU_VIP_TIER) : null;
    if (yanSpec) {
      cleanSkin.battlePassTier = yanSpec.tier;
      cleanSkin.outfitColor = yanSpec.accentColor;
      cleanSkin.outfitStyle = 'cyber';
      cleanSkin.showcase = cloneShowcase(yanSpec.showcase);
    }
    this.data.players[key] = this._normalizePlayer(
      {
        name: current.name,
        color: cleanSkin.outfitColor || current.color,
        skin: cleanSkin,
        introSeen: current.introSeen,
        unlockedDivineSkins: [],
        secretSkinUnlocked: false,
        unlockedBattlePassTiers: preservedBpTiers,
        vipChambreAccess: isYanfufu,
        prestigeCount: 0,
        coins: 0,
        ownedItems: [],
        equippedSkin: null,
        equippedPet: null,
        equippedTrail: null,
        validatedTps: [],
        arcadeHighScores: {},
        selectedSkin: yanSpec ? yanSpec.id : 'standard',
        xp: 0,
        questAccepted: false,
        ascensionTriggered: false,
        grades: {},
        bestTimes: {},
        average: null,
        diplomaEarned: false,
        diplomas: [],
        createdAt: current.createdAt,
        lastLogin: current.lastLogin,
        lastSeen: nowIso,
        playtimeSeconds: 0,
        updatedAt: nowIso
      },
      current.name
    );
    if (existingAcc) {
      existingAcc.tpScores = {};
      existingAcc.unlockedDivineSkins = [];
      existingAcc.secretSkinUnlocked = false;
      existingAcc.unlockedBattlePassTiers = [...preservedBpTiers];
      existingAcc.vipChambreAccess = isYanfufu;
      existingAcc.prestigeCount = 0;
      existingAcc.coins = 0;
      existingAcc.ownedItems = [];
      existingAcc.equippedSkin = null;
      existingAcc.equippedPet = null;
      existingAcc.equippedTrail = null;
      existingAcc.validatedTps = [];
      existingAcc.arcadeHighScores = {};
      existingAcc.selectedSkin = yanSpec ? yanSpec.id : 'standard';
      existingAcc.avatarCustomization = sanitizeSkin(cleanSkin);
      existingAcc.xp = 0;
      existingAcc.bestTimes = {};
      existingAcc.questAccepted = false;
      existingAcc.ascensionTriggered = false;
      existingAcc.playtimeSeconds = 0;
      existingAcc.lastSeen = nowIso;
      existingAcc.updatedAt = nowIso;
      this.accounts.set(key, existingAcc);
    }
    this._save();
    return this.getPublicProfile(key);
  }

  adminUpdateAccountBattlePass(target, payload = {}) {
    const key = this._findAccountKey(target) || this._findPlayerKey(target);
    if (!key) return null;
    let account = this.accounts.get(key) ? this._normalizeAccount(this.accounts.get(key)) : null;
    const player = this.data.players[key]
      ? this._normalizePlayer(this.data.players[key], key)
      : null;
    const username = account?.username || player?.name || String(target);
    const isYanfufu = isYanfufuUsername(username);
    let tiers = normalizeBattlePassTierList([
      ...(account?.unlockedBattlePassTiers || player?.unlockedBattlePassTiers || []),
      ...(isYanfufu ? [YANFUFU_VIP_TIER] : [])
    ]);

    if (Array.isArray(payload.unlockedBattlePassTiers)) {
      tiers = normalizeBattlePassTierList([
        ...payload.unlockedBattlePassTiers,
        ...(isYanfufu ? [YANFUFU_VIP_TIER] : [])
      ]);
    }

    const grantSpec = getBattlePassTierSpec(payload.grantTier ?? payload.tier);
    if (grantSpec && !tiers.includes(grantSpec.tier)) {
      tiers.push(grantSpec.tier);
      tiers.sort((a, b) => a - b);
    }

    const revokeSpec = getBattlePassTierSpec(payload.revokeTier);
    if (revokeSpec) {
      if (!(isYanfufu && revokeSpec.tier === YANFUFU_VIP_TIER)) {
        tiers = tiers.filter((t) => t !== revokeSpec.tier);
      }
    }

    const baseSkin = sanitizeSkin(
      account?.avatarCustomization || player?.skin || DEFAULT_SKIN,
      player?.color || hashColor(username)
    );
    let selectedSkin = account?.selectedSkin || player?.selectedSkin || 'standard';

    const equipReq = payload.equipTier ?? payload.selectedSkin;
    if (equipReq === 'standard' || equipReq === null || equipReq === false) {
      selectedSkin = 'standard';
      delete baseSkin.battlePassTier;
      delete baseSkin.showcase;
      delete baseSkin.divineSpecialty;
      delete baseSkin.secretSkin;
    } else if (grantSpec && payload.equip !== false) {
      selectedSkin = grantSpec.id;
      baseSkin.battlePassTier = grantSpec.tier;
      baseSkin.outfitColor = grantSpec.accentColor;
      baseSkin.outfitStyle = 'cyber';
      baseSkin.showcase = cloneShowcase(grantSpec.showcase);
      delete baseSkin.divineSpecialty;
      delete baseSkin.secretSkin;
    } else if (equipReq !== undefined) {
      const eqBpSpec = getBattlePassTierSpec(equipReq);
      if (eqBpSpec && tiers.includes(eqBpSpec.tier)) {
        selectedSkin = eqBpSpec.id;
        baseSkin.battlePassTier = eqBpSpec.tier;
        baseSkin.outfitColor = eqBpSpec.accentColor;
        baseSkin.outfitStyle = 'cyber';
        baseSkin.showcase = cloneShowcase(eqBpSpec.showcase);
        delete baseSkin.divineSpecialty;
        delete baseSkin.secretSkin;
      }
    } else {
      const currentBp = getBattlePassTierSpec(baseSkin.battlePassTier ?? selectedSkin);
      if (currentBp && !tiers.includes(currentBp.tier)) {
        selectedSkin = 'standard';
        delete baseSkin.battlePassTier;
        delete baseSkin.showcase;
      }
    }

    const nowIso = new Date().toISOString();
    const vipChambreAccess = hasVipChambreAccess(tiers, username);

    if (account) {
      account.unlockedBattlePassTiers = tiers;
      account.vipChambreAccess = vipChambreAccess;
      account.selectedSkin = selectedSkin;
      account.avatarCustomization = sanitizeSkin(baseSkin, baseSkin.outfitColor);
      account.updatedAt = nowIso;
      account = this._normalizeAccount(account);
      this._syncPlayerFromAccount(account);
    } else if (player) {
      player.unlockedBattlePassTiers = tiers;
      player.vipChambreAccess = vipChambreAccess;
      player.selectedSkin = selectedSkin;
      player.skin = sanitizeSkin(baseSkin, baseSkin.outfitColor);
      player.color = player.skin.outfitColor;
      player.avatarCustomization = { ...player.skin };
      player.updatedAt = nowIso;
      this.data.players[key] = this._normalizePlayer(player, username);
    }

    this._save();
    return {
      account: account ? this._buildAdminAccountObject(this.accounts.get(key) || account) : null,
      profile: this.getPublicProfile(key)
    };
  }

  deletePlayer(rawName) {
    const key = this._findPlayerKey(rawName) || this._findAccountKey(rawName);
    if (!key) return false;
    delete this.data.players[key];
    this.accounts.delete(key);
    this._save();
    return true;
  }

  _buildProfileObject(p) {
    const norm = this._normalizePlayer(p);
    const completedCount = TP_IDS.filter(
      (id) => typeof norm.grades[id] === 'number' && norm.grades[id] >= 10
    ).length;
    const tpsAt20Count = ALL_TP_IDS.filter(
      (id) => typeof norm.grades[id] === 'number' && norm.grades[id] === 20
    ).length;
    return {
      name: norm.name,
      color: norm.color,
      skin: norm.skin,
      introSeen: Boolean(norm.introSeen),
      unlockedDivineSkins: [...norm.unlockedDivineSkins],
      secretSkinUnlocked: Boolean(norm.secretSkinUnlocked),
      unlockedBattlePassTiers: [...norm.unlockedBattlePassTiers],
      vipChambreAccess: Boolean(norm.vipChambreAccess),
      prestigeCount: Number(norm.prestigeCount) || 0,
      coins: norm.coins,
      ownedItems: [...norm.ownedItems],
      equippedSkin: norm.equippedSkin,
      equippedPet: norm.equippedPet,
      equippedTrail: norm.equippedTrail,
      validatedTps: [...norm.validatedTps],
      arcadeHighScores: { ...norm.arcadeHighScores },
      selectedSkin: norm.selectedSkin,
      avatarCustomization: { ...norm.skin },
      tpScores: { ...norm.grades },
      tpsAt20Count,
      allTpsTotal: ALL_TP_IDS.length,
      xp: norm.xp,
      questAccepted: norm.questAccepted,
      ascensionTriggered: Boolean(norm.ascensionTriggered),
      grades: { ...norm.grades },
      bestTimes: { ...norm.bestTimes },
      average: norm.average,
      completedCount,
      diplomaEarned: norm.diplomaEarned,
      diplomas: [...norm.diplomas],
      mention: computeMention(norm.average),
      rankLabel: computeRankLabel(completedCount, norm.average, norm.diplomaEarned),
      createdAt: norm.createdAt,
      lastLogin: norm.lastLogin,
      lastSeen: norm.lastSeen,
      playtimeSeconds: norm.playtimeSeconds,
      updatedAt: norm.updatedAt
    };
  }

  getAllPlayers() {
    return this._getSortedBase();
  }

  _getSortedBase() {
    return Object.keys(this.data.players)
      .map((k) => this._buildProfileObject(this.data.players[k]))
      .sort(compareProfiles)
      .map((profile, idx) => ({ ...profile, rank: idx + 1 }));
  }

  getPublicProfile(key) {
    const normKey = String(key || '').toLowerCase();
    const p = this.data.players[normKey];
    if (!p) return null;
    const sorted = this._getSortedBase();
    return sorted.find((entry) => entry.name.toLowerCase() === normKey) || this._buildProfileObject(p);
  }

  getLeaderboard(limit = 50) {
    return this._getSortedBase().slice(0, limit);
  }

  getSuggestions() {
    const list = Array.isArray(this.data.suggestions) ? this.data.suggestions : [];
    return [...list].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  }

  addSuggestion(rawAuthor, rawMessage) {
    const author = sanitizeSuggestionText(rawAuthor, 40);
    const message = sanitizeSuggestionText(rawMessage, 400);
    if (!author || !message) {
      return null;
    }
    if (!Array.isArray(this.data.suggestions)) {
      this.data.suggestions = [];
    }
    const entry = {
      id: crypto.randomUUID().slice(0, 10),
      author,
      message,
      createdAt: new Date().toISOString()
    };
    this.data.suggestions.unshift(entry);
    if (this.data.suggestions.length > 200) {
      this.data.suggestions = this.data.suggestions.slice(0, 200);
    }
    this._save();
    return entry;
  }

  deleteSuggestion(id) {
    if (!Array.isArray(this.data.suggestions)) return false;
    const cleanId = String(id || '').trim();
    const before = this.data.suggestions.length;
    this.data.suggestions = this.data.suggestions.filter((s) => s.id !== cleanId);
    if (this.data.suggestions.length === before) return false;
    this._save();
    return true;
  }

  getPigeons() {
    const list = Array.isArray(this.data.pigeons) ? this.data.pigeons : [];
    return [...list].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  }

  addPigeon(rawPlayerName, rawPlatform) {
    if (!Array.isArray(this.data.pigeons)) {
      this.data.pigeons = [];
    }
    const entry = this._normalizePigeon({
      id: crypto.randomUUID().slice(0, 10),
      playerName: rawPlayerName,
      platform: rawPlatform,
      createdAt: new Date().toISOString()
    });
    this.data.pigeons.unshift(entry);
    if (this.data.pigeons.length > 500) {
      this.data.pigeons = this.data.pigeons.slice(0, 500);
    }
    this._save();
    return entry;
  }

  deletePigeon(id) {
    if (!Array.isArray(this.data.pigeons)) return false;
    const cleanId = String(id || '').trim();
    const before = this.data.pigeons.length;
    this.data.pigeons = this.data.pigeons.filter((p) => p.id !== cleanId);
    if (this.data.pigeons.length === before) return false;
    this._save();
    return true;
  }

  clearPigeons() {
    this.data.pigeons = [];
    this._save();
    return true;
  }
}

export class MapStore {
  constructor(mapFilePath) {
    this.mapFilePath = mapFilePath;
    this.mapData = createDefaultMap();
    this._load();
  }

  _load() {
    if (!this.mapFilePath) return;
    try {
      if (fs.existsSync(this.mapFilePath)) {
        const raw = fs.readFileSync(this.mapFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.mapData = normalizeMapData(parsed);
        }
      }
    } catch {
      this.mapData = createDefaultMap();
    }
  }

  _save() {
    if (!this.mapFilePath) return;
    try {
      fs.mkdirSync(path.dirname(this.mapFilePath), { recursive: true });
      const tmp = `${this.mapFilePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.mapData, null, 2), 'utf8');
      fs.renameSync(tmp, this.mapFilePath);
    } catch {
      return;
    }
  }

  getMap() {
    return this.mapData;
  }

  saveMap(rawMap) {
    const next = normalizeMapData({
      ...rawMap,
      updatedAt: new Date().toISOString()
    });
    this.mapData = next;
    this._save();
    return this.mapData;
  }
}
