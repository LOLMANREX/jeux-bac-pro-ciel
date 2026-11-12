import fs from 'node:fs';
import path from 'node:path';

export const TP_IDS = ['oscilloscope', 'soldering', 'electronics', 'antivirus', 'vmvlan'];

const AVATAR_COLORS = [
  '#22d3ee',
  '#34d399',
  '#fbbf24',
  '#a78bfa',
  '#fb7185',
  '#38bdf8',
  '#4ade80'
];

export function sanitizeName(rawName) {
  const cleaned = String(rawName || '')
    .trim()
    .replace(/[^\p{L}\p{N}_\- ]/gu, '')
    .slice(0, 18);
  return cleaned || 'Eleve_CIEL';
}

export function computeAverage(grades = {}) {
  const values = TP_IDS.map((id) => grades[id]).filter((v) => typeof v === 'number');
  if (values.length === 0) return null;
  const sum = values.reduce((acc, n) => acc + n, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

function hashColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export class GameStore {
  constructor(dbFilePath) {
    this.dbFilePath = dbFilePath;
    this.data = { players: {} };
    if (this.dbFilePath) {
      this._load();
    }
  }

  _load() {
    try {
      if (fs.existsSync(this.dbFilePath)) {
        const raw = fs.readFileSync(this.dbFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.players === 'object') {
          this.data = parsed;
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
      // Ignored if filesystem unavailable in ephemeral environments
    }
  }

  getOrCreatePlayer(rawName) {
    const name = sanitizeName(rawName);
    const key = name.toLowerCase();
    if (!this.data.players[key]) {
      this.data.players[key] = {
        name,
        color: hashColor(name),
        xp: 0,
        questAccepted: false,
        grades: {},
        bestTimes: {},
        diplomaEarned: false,
        updatedAt: new Date().toISOString()
      };
      this._save();
    }
    return this.getPublicProfile(key);
  }

  acceptQuest(rawName) {
    const name = sanitizeName(rawName);
    const key = name.toLowerCase();
    this.getOrCreatePlayer(name);
    this.data.players[key].questAccepted = true;
    this.data.players[key].updatedAt = new Date().toISOString();
    this._save();
    return this.getPublicProfile(key);
  }

  recordTpScore(rawName, tpId, rawScore, durationSec = 0) {
    if (!TP_IDS.includes(tpId)) {
      throw new Error(`TP inconnu: ${tpId}`);
    }
    const name = sanitizeName(rawName);
    const key = name.toLowerCase();
    this.getOrCreatePlayer(name);
    const player = this.data.players[key];

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
    if (completedCount === TP_IDS.length) {
      player.diplomaEarned = true;
    }

    player.updatedAt = new Date().toISOString();
    this._save();

    return {
      profile: this.getPublicProfile(key),
      xpGain,
      isNewBest,
      score,
      completedCount
    };
  }

  getPublicProfile(key) {
    const p = this.data.players[key];
    if (!p) return null;
    const average = computeAverage(p.grades);
    const completedCount = TP_IDS.filter(
      (id) => typeof p.grades[id] === 'number' && p.grades[id] >= 10
    ).length;
    return {
      name: p.name,
      color: p.color,
      xp: p.xp,
      questAccepted: Boolean(p.questAccepted),
      grades: { ...p.grades },
      bestTimes: { ...p.bestTimes },
      average,
      completedCount,
      diplomaEarned: Boolean(p.diplomaEarned),
      updatedAt: p.updatedAt
    };
  }

  getLeaderboard(limit = 20) {
    return Object.keys(this.data.players)
      .map((key) => this.getPublicProfile(key))
      .sort((a, b) => {
        if (b.completedCount !== a.completedCount) {
          return b.completedCount - a.completedCount;
        }
        const avgA = a.average ?? -1;
        const avgB = b.average ?? -1;
        if (avgB !== avgA) return avgB - avgA;
        return b.xp - a.xp;
      })
      .slice(0, limit);
  }
}
