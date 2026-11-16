import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createDefaultMap, normalizeMapData } from '../src/world/mapSchema.js';

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

export const DIVINE_SPECIALTY_IDS = ['cyber', 'reseaux', 'electronique', 'systemes'];

const VALID_DIVINE_SPECIALTIES = new Set(DIVINE_SPECIALTY_IDS);

const DIVINE_SPECIALTY_COLORS = {
  cyber: '#f43f5e',
  reseaux: '#38bdf8',
  electronique: '#fbbf24',
  systemes: '#a855f7'
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
  audiovisual: 'systemes',
  studio: 'systemes',
  serveurs: 'systemes'
};

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
  const divineSpec = resolveDivineSpecialtyId(s.divineSpecialty);
  const baseOutfit = isValidHex(fallbackColor) ? fallbackColor : DEFAULT_SKIN.outfitColor;
  const cleaned = {
    outfitColor: isValidHex(s.outfitColor)
      ? s.outfitColor
      : divineSpec
        ? DIVINE_SPECIALTY_COLORS[divineSpec]
        : baseOutfit,
    outfitStyle: VALID_STYLES.has(s.outfitStyle)
      ? s.outfitStyle
      : divineSpec
        ? 'cyber'
        : DEFAULT_SKIN.outfitStyle,
    hat: VALID_HATS.has(s.hat) ? s.hat : DEFAULT_SKIN.hat,
    skinTone: isValidHex(s.skinTone) ? s.skinTone : DEFAULT_SKIN.skinTone,
    pantsColor: isValidHex(s.pantsColor) ? s.pantsColor : DEFAULT_SKIN.pantsColor
  };
  if (s.creatorAura) {
    cleaned.creatorAura = true;
  }
  if (divineSpec) {
    cleaned.divineSpecialty = divineSpec;
  }
  return cleaned;
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
  const values = TP_IDS.map((id) => grades[id]).filter((v) => typeof v === 'number');
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
    const defColor = isValidHex(base.color) ? base.color : hashColor(username);
    const avatarCustomization = sanitizeSkin(base.avatarCustomization || base.skin, defColor);

    const rawSelected =
      typeof base.selectedSkin === 'string' && base.selectedSkin.trim()
        ? base.selectedSkin.trim()
        : avatarCustomization.divineSpecialty || 'standard';
    const selectedDivine = resolveDivineSpecialtyId(rawSelected);
    let selectedSkin = 'standard';
    if (selectedDivine && unlockedDivineSkins.includes(selectedDivine)) {
      selectedSkin = selectedDivine;
      avatarCustomization.divineSpecialty = selectedDivine;
      avatarCustomization.outfitColor = DIVINE_SPECIALTY_COLORS[selectedDivine];
      avatarCustomization.outfitStyle = 'cyber';
    } else if (
      rawSelected &&
      !selectedDivine &&
      rawSelected !== 'standard' &&
      rawSelected !== 'default'
    ) {
      selectedSkin = rawSelected;
      delete avatarCustomization.divineSpecialty;
    } else {
      selectedSkin = 'standard';
      delete avatarCustomization.divineSpecialty;
    }

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
      tpScores,
      unlockedDivineSkins,
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
      tpScores: { ...norm.tpScores },
      unlockedDivineSkins: [...norm.unlockedDivineSkins],
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
        unlockedDivineSkins: norm.unlockedDivineSkins,
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
    const selectedSkin =
      normPlayer.skin?.divineSpecialty && unlocked.includes(normPlayer.skin.divineSpecialty)
        ? normPlayer.skin.divineSpecialty
        : 'standard';
    const nextAvatarCustom = { ...normPlayer.skin };
    if (selectedSkin === 'standard') {
      delete nextAvatarCustom.divineSpecialty;
    }
    existing.tpScores = { ...normPlayer.grades };
    existing.unlockedDivineSkins = unlocked;
    existing.selectedSkin = selectedSkin;
    existing.avatarCustomization = nextAvatarCustom;
    existing.xp = normPlayer.xp;
    existing.bestTimes = { ...normPlayer.bestTimes };
    existing.questAccepted = normPlayer.questAccepted;
    existing.ascensionTriggered = Boolean(existing.ascensionTriggered || normPlayer.ascensionTriggered);
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
    if (skin.divineSpecialty && !unlockedDivineSkins.includes(skin.divineSpecialty)) {
      delete skin.divineSpecialty;
    }
    const color = skin.outfitColor || fallbackColor;
    const selectedSkin =
      skin.divineSpecialty && unlockedDivineSkins.includes(skin.divineSpecialty)
        ? skin.divineSpecialty
        : 'standard';
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

    return {
      name,
      color,
      skin,
      unlockedDivineSkins,
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
                  const normAcc = this._normalizeAccount(item);
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
      if (needsMigrationResetSave) {
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
      tpScores: { ...norm.tpScores },
      tpsAt20Count,
      allTpsTotal: ALL_TP_IDS.length,
      completedCount: profile?.completedCount ?? 0,
      average: profile?.average ?? computeAverage(norm.tpScores),
      xp: norm.xp,
      unlockedDivineSkins: [...norm.unlockedDivineSkins],
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
    const account = this._normalizeAccount({
      id: `acc_${crypto.randomUUID().slice(0, 12)}`,
      username,
      password,
      createdAt: nowIso,
      tpScores: {},
      unlockedDivineSkins: [],
      selectedSkin: 'standard',
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
    const account = this.accounts.get(key);
    if (!account || account.password !== password) {
      return {
        ok: false,
        status: 401,
        error: 'Identifiant ou mot de passe incorrect.'
      };
    }

    const nowIso = new Date().toISOString();
    account.lastLogin = nowIso;
    account.lastSeen = nowIso;
    account.updatedAt = nowIso;
    this._syncPlayerFromAccount(account);
    this._save();

    return {
      ok: true,
      status: 200,
      account: this._buildPublicAccountObject(account),
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

    const incomingCustom = payload.avatarCustomization || payload.skin;
    if (incomingCustom && typeof incomingCustom === 'object') {
      account.avatarCustomization = sanitizeSkin(
        { ...account.avatarCustomization, ...incomingCustom },
        account.avatarCustomization.outfitColor
      );
      const customDivineSpec = account.avatarCustomization.divineSpecialty;
      if (!incomingCustom.divineSpecialty && payload.selectedSkin === undefined) {
        delete account.avatarCustomization.divineSpecialty;
        account.selectedSkin = 'standard';
      } else if (customDivineSpec) {
        if (allTps20 && !account.unlockedDivineSkins.includes(customDivineSpec)) {
          account.unlockedDivineSkins.push(customDivineSpec);
        }
        if (account.unlockedDivineSkins.includes(customDivineSpec)) {
          account.selectedSkin = customDivineSpec;
        } else {
          delete account.avatarCustomization.divineSpecialty;
          account.selectedSkin = 'standard';
        }
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
      } else {
        const specId = resolveDivineSpecialtyId(payload.selectedSkin);
        if (specId) {
          if (allTps20 && !account.unlockedDivineSkins.includes(specId)) {
            account.unlockedDivineSkins.push(specId);
          }
          if (account.unlockedDivineSkins.includes(specId)) {
            account.selectedSkin = specId;
            account.avatarCustomization = sanitizeSkin(
              {
                ...account.avatarCustomization,
                outfitColor: DIVINE_SPECIALTY_COLORS[specId],
                outfitStyle: 'cyber',
                divineSpecialty: specId
              },
              DIVINE_SPECIALTY_COLORS[specId]
            );
          } else {
            account.selectedSkin = 'standard';
            delete account.avatarCustomization.divineSpecialty;
          }
        } else if (typeof payload.selectedSkin === 'string') {
          account.selectedSkin = payload.selectedSkin.trim().slice(0, 32) || 'standard';
        }
      }
    }

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
    if (hasAll20) {
      player.ascensionTriggered = true;
    }
    if (equip) {
      player.selectedSkin = specId;
      player.skin = sanitizeSkin(
        {
          ...player.skin,
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
        this.data.players[key] = this._normalizePlayer(
          {
            name,
            color: skin.outfitColor,
            skin,
            unlockedDivineSkins: [],
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
      const nextSkin = sanitizeSkin(rawSkin, current.color);
      if (nextSkin.divineSpecialty && !current.unlockedDivineSkins.includes(nextSkin.divineSpecialty)) {
        delete nextSkin.divineSpecialty;
      }
      current.skin = nextSkin;
      current.color = nextSkin.outfitColor;
      current.selectedSkin = nextSkin.divineSpecialty || 'standard';
      current.avatarCustomization = { ...nextSkin };
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
    const nextSkin = sanitizeSkin(rawSkin, player.color);
    if (nextSkin.divineSpecialty && !player.unlockedDivineSkins.includes(nextSkin.divineSpecialty)) {
      delete nextSkin.divineSpecialty;
    }
    player.skin = nextSkin;
    player.color = nextSkin.outfitColor;
    player.selectedSkin = nextSkin.divineSpecialty || 'standard';
    player.avatarCustomization = { ...nextSkin };
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

    if (isNewBest) {
      player.grades[tpId] = score;
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
    const allTpsAt20 = hasAllTpsAt20InScores(player.grades);
    const firstTimeAllAt20 =
      allTpsAt20 &&
      !player.ascensionTriggered &&
      player.unlockedDivineSkins.length === 0;
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
      isNewBest,
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
      if (!player.bestTimes[id]) {
        player.bestTimes[id] = 45;
      }
    }
    player.xp = Math.max(player.xp + 1750, 3150);
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
    this.data.players[key] = this._normalizePlayer(
      {
        name: current.name,
        color: cleanSkin.outfitColor || current.color,
        skin: cleanSkin,
        unlockedDivineSkins: [],
        selectedSkin: 'standard',
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
      existingAcc.selectedSkin = 'standard';
      const custom = { ...existingAcc.avatarCustomization };
      delete custom.divineSpecialty;
      existingAcc.avatarCustomization = sanitizeSkin(custom);
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
      unlockedDivineSkins: [...norm.unlockedDivineSkins],
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
