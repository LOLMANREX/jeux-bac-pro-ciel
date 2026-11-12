import fs from 'node:fs';
import path from 'node:path';

export const TP_IDS = ['oscilloscope', 'soldering', 'electronics', 'antivirus', 'vmvlan'];

export const TP_LABELS = {
  oscilloscope: 'TP Oscilloscope',
  soldering: 'TP Brasure',
  electronics: 'TP Électronique',
  antivirus: 'TP Antivirus',
  vmvlan: 'TP Réseau VM & VLAN'
};

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

export function sanitizeName(rawName) {
  const cleaned = String(rawName || '')
    .trim()
    .replace(/[^\p{L}\p{N}_\- ]/gu, '')
    .slice(0, 18);
  return cleaned || 'Eleve_CIEL';
}

export function sanitizeSkin(raw, fallbackColor = DEFAULT_SKIN.outfitColor) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const baseOutfit = isValidHex(fallbackColor) ? fallbackColor : DEFAULT_SKIN.outfitColor;
  return {
    outfitColor: isValidHex(s.outfitColor) ? s.outfitColor : baseOutfit,
    outfitStyle: VALID_STYLES.has(s.outfitStyle) ? s.outfitStyle : DEFAULT_SKIN.outfitStyle,
    hat: VALID_HATS.has(s.hat) ? s.hat : DEFAULT_SKIN.hat,
    skinTone: isValidHex(s.skinTone) ? s.skinTone : DEFAULT_SKIN.skinTone,
    pantsColor: isValidHex(s.pantsColor) ? s.pantsColor : DEFAULT_SKIN.pantsColor
  };
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
    list.push('Tableau d’Excellence M. Fortin');
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
  constructor(dbFilePath) {
    this.dbFilePath = dbFilePath;
    this.data = { players: {} };
    if (this.dbFilePath) {
      this._load();
    }
  }

  _normalizePlayer(raw, fallbackKey = 'Eleve_CIEL') {
    const base = raw && typeof raw === 'object' ? raw : {};
    const name = sanitizeName(base.name || fallbackKey);
    const fallbackColor = isValidHex(base.color) ? base.color : hashColor(name);
    const skin = sanitizeSkin(base.skin, fallbackColor);
    const color = skin.outfitColor || fallbackColor;
    const grades = {};
    if (base.grades && typeof base.grades === 'object') {
      for (const id of TP_IDS) {
        if (typeof base.grades[id] === 'number' && Number.isFinite(base.grades[id])) {
          grades[id] = Math.max(0, Math.min(20, Math.round(base.grades[id] * 10) / 10));
        }
      }
    }
    const bestTimes = {};
    if (base.bestTimes && typeof base.bestTimes === 'object') {
      for (const id of TP_IDS) {
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

    return {
      name,
      color,
      skin,
      xp,
      questAccepted: Boolean(base.questAccepted),
      grades,
      bestTimes,
      average,
      diplomaEarned,
      diplomas,
      updatedAt: base.updatedAt || new Date().toISOString()
    };
  }

  _load() {
    try {
      if (fs.existsSync(this.dbFilePath)) {
        const raw = fs.readFileSync(this.dbFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.players === 'object') {
          const normalizedPlayers = {};
          for (const [k, val] of Object.entries(parsed.players)) {
            const norm = this._normalizePlayer(val, k);
            normalizedPlayers[norm.name.toLowerCase()] = norm;
          }
          this.data = { players: normalizedPlayers };
        }
      }
    } catch {
      this.data = { players: {} };
    }
  }

  _save() {
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

  getOrCreatePlayer(rawName, rawSkin = null) {
    const name = sanitizeName(rawName);
    const key = name.toLowerCase();
    let changed = false;

    if (!this.data.players[key]) {
      const defColor = hashColor(name);
      const skin = sanitizeSkin(rawSkin, defColor);
      this.data.players[key] = this._normalizePlayer(
        {
          name,
          color: skin.outfitColor,
          skin,
          xp: 0,
          questAccepted: false,
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
    } else if (rawSkin && typeof rawSkin === 'object') {
      const current = this._normalizePlayer(this.data.players[key], name);
      const nextSkin = sanitizeSkin(rawSkin, current.color);
      current.skin = nextSkin;
      current.color = nextSkin.outfitColor;
      current.updatedAt = new Date().toISOString();
      this.data.players[key] = current;
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
    player.skin = nextSkin;
    player.color = nextSkin.outfitColor;
    player.updatedAt = new Date().toISOString();
    this.data.players[key] = player;
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
    this._save();
    return this.getPublicProfile(key);
  }

  recordTpScore(rawName, tpId, rawScore, durationSec = 0, rawSkin = null) {
    if (!TP_IDS.includes(tpId)) {
      throw new Error(`TP inconnu: ${tpId}`);
    }
    const name = sanitizeName(rawName);
    const key = name.toLowerCase();
    this.getOrCreatePlayer(name, rawSkin);
    const player = this._normalizePlayer(this.data.players[key], name);

    const score = Math.max(0, Math.min(20, Math.round(Number(rawScore) * 10) / 10));
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
    player.updatedAt = new Date().toISOString();
    this.data.players[key] = player;
    this._save();

    return {
      profile: this.getPublicProfile(key),
      xpGain,
      isNewBest,
      score,
      completedCount
    };
  }

  _buildProfileObject(p) {
    const norm = this._normalizePlayer(p);
    const completedCount = TP_IDS.filter(
      (id) => typeof norm.grades[id] === 'number' && norm.grades[id] >= 10
    ).length;
    return {
      name: norm.name,
      color: norm.color,
      skin: norm.skin,
      xp: norm.xp,
      questAccepted: norm.questAccepted,
      grades: { ...norm.grades },
      bestTimes: { ...norm.bestTimes },
      average: norm.average,
      completedCount,
      diplomaEarned: norm.diplomaEarned,
      diplomas: [...norm.diplomas],
      mention: computeMention(norm.average),
      rankLabel: computeRankLabel(completedCount, norm.average, norm.diplomaEarned),
      updatedAt: norm.updatedAt
    };
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
}
