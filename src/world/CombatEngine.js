import {
  COMBAT_MODES,
  COMBAT_WEAPONS,
  getCombatWeaponById,
  getDefaultWeaponForMode,
  getWeaponsByMode
} from './CombatWeapons.js';
import { pointCollidesWithColliders } from './SurvivalEngine.js';

export const COMBAT_WAITING_CENTER = { x: 56, z: 24 };
export const COMBAT_ARENA_CENTER = { x: 56, z: 68 };
export const COMBAT_ARENA_BOUNDS = {
  minX: 40,
  maxX: 72,
  minZ: 54,
  maxZ: 82,
  width: 32,
  depth: 28,
  height: 5.8
};

export const COMBAT_MIN_PLAYERS = 1;
export const COMBAT_MIN_SOLO_BOTS = 3;
export const COMBAT_MATCH_DURATION_SEC = 150;
export const COMBAT_KILL_LIMIT = 10;
export const COMBAT_RESPAWN_DELAY_MS = 3000;
export const COMBAT_SPAWN_PROTECT_MS = 1400;
export const COMBAT_MAX_HP = 100;
export const COMBAT_PICKUP_HEAL = 35;
export const COMBAT_PICKUP_RESPAWN_MS = 15000;

export const COMBAT_BOT_NAMES = [
  'Bot_FibreOptic',
  'Bot_PingZero',
  'Bot_Switch24',
  'Bot_Sertisseur',
  'Bot_CyberSOC'
];

const RAW_ARENA_OBSTACLES = [
  { id: 'obs_core_w', ox: -2.4, oz: 0, w: 1.5, d: 3.2, height: 2.35, kind: 'rack', color: '#0284c7', label: 'Baie Cœur A' },
  { id: 'obs_core_e', ox: 2.4, oz: 0, w: 1.5, d: 3.2, height: 2.35, kind: 'rack', color: '#0284c7', label: 'Baie Cœur B' },
  { id: 'obs_rack_nw', ox: -7.5, oz: -5.2, w: 3.0, d: 1.35, height: 2.25, kind: 'rack', color: '#0ea5e9', label: 'Baie Tactique NW' },
  { id: 'obs_rack_ne', ox: 7.5, oz: -5.2, w: 3.0, d: 1.35, height: 2.25, kind: 'rack', color: '#0ea5e9', label: 'Baie Tactique NE' },
  { id: 'obs_rack_sw', ox: -7.5, oz: 5.2, w: 3.0, d: 1.35, height: 2.25, kind: 'rack', color: '#0ea5e9', label: 'Baie Tactique SW' },
  { id: 'obs_rack_se', ox: 7.5, oz: 5.2, w: 3.0, d: 1.35, height: 2.25, kind: 'rack', color: '#0ea5e9', label: 'Baie Tactique SE' },
  { id: 'obs_crate_n', ox: 0, oz: -6.8, w: 2.2, d: 1.3, height: 1.18, kind: 'crate', color: '#f59e0b', label: 'Caisse UPS Nord' },
  { id: 'obs_crate_s', ox: 0, oz: 6.8, w: 2.2, d: 1.3, height: 1.18, kind: 'crate', color: '#f59e0b', label: 'Caisse UPS Sud' },
  { id: 'obs_crate_w', ox: -10.6, oz: 0, w: 1.35, d: 2.4, height: 1.18, kind: 'crate', color: '#10b981', label: 'Caisse Switch Ouest' },
  { id: 'obs_crate_e', ox: 10.6, oz: 0, w: 1.35, d: 2.4, height: 1.18, kind: 'crate', color: '#10b981', label: 'Caisse Switch Est' },
  { id: 'obs_pil_nw', ox: -5.2, oz: -10.0, w: 1.3, d: 1.3, height: 4.8, kind: 'pillar', color: '#6366f1', label: 'Pilier Réseau NW' },
  { id: 'obs_pil_ne', ox: 5.2, oz: -10.0, w: 1.3, d: 1.3, height: 4.8, kind: 'pillar', color: '#6366f1', label: 'Pilier Réseau NE' },
  { id: 'obs_pil_sw', ox: -5.2, oz: 10.0, w: 1.3, d: 1.3, height: 4.8, kind: 'pillar', color: '#6366f1', label: 'Pilier Réseau SW' },
  { id: 'obs_pil_se', ox: 5.2, oz: 10.0, w: 1.3, d: 1.3, height: 4.8, kind: 'pillar', color: '#6366f1', label: 'Pilier Réseau SE' }
];

export const COMBAT_ARENA_OBSTACLES = RAW_ARENA_OBSTACLES.map((o) => {
  const x = COMBAT_ARENA_CENTER.x + o.ox;
  const z = COMBAT_ARENA_CENTER.z + o.oz;
  return {
    ...o,
    x,
    z,
    minX: Number((x - o.w / 2).toFixed(3)),
    maxX: Number((x + o.w / 2).toFixed(3)),
    minZ: Number((z - o.d / 2).toFixed(3)),
    maxZ: Number((z + o.d / 2).toFixed(3)),
    minY: 0,
    maxY: o.height
  };
});

export const COMBAT_SPAWN_POINTS = [
  { x: COMBAT_ARENA_CENTER.x - 13.0, z: COMBAT_ARENA_CENTER.z - 11.0 },
  { x: COMBAT_ARENA_CENTER.x + 13.0, z: COMBAT_ARENA_CENTER.z - 11.0 },
  { x: COMBAT_ARENA_CENTER.x - 13.0, z: COMBAT_ARENA_CENTER.z + 11.0 },
  { x: COMBAT_ARENA_CENTER.x + 13.0, z: COMBAT_ARENA_CENTER.z + 11.0 },
  { x: COMBAT_ARENA_CENTER.x, z: COMBAT_ARENA_CENTER.z - 11.5 },
  { x: COMBAT_ARENA_CENTER.x, z: COMBAT_ARENA_CENTER.z + 11.5 },
  { x: COMBAT_ARENA_CENTER.x - 13.5, z: COMBAT_ARENA_CENTER.z },
  { x: COMBAT_ARENA_CENTER.x + 13.5, z: COMBAT_ARENA_CENTER.z }
];

export const COMBAT_PICKUP_SPOTS = [
  { id: 'pickup_center', x: COMBAT_ARENA_CENTER.x, z: COMBAT_ARENA_CENTER.z, label: 'Condensateur +35 PV' },
  { id: 'pickup_west', x: COMBAT_ARENA_CENTER.x - 7.2, z: COMBAT_ARENA_CENTER.z, label: 'Batterie +35 PV' },
  { id: 'pickup_east', x: COMBAT_ARENA_CENTER.x + 7.2, z: COMBAT_ARENA_CENTER.z, label: 'Batterie +35 PV' },
  { id: 'pickup_north', x: COMBAT_ARENA_CENTER.x, z: COMBAT_ARENA_CENTER.z - 9.6, label: 'Batterie +35 PV' }
];

export function getCombatArenaColliders() {
  return COMBAT_ARENA_OBSTACLES.map((o) => ({
    id: o.id,
    minX: o.minX,
    maxX: o.maxX,
    minZ: o.minZ,
    maxZ: o.maxZ,
    height: o.height,
    kind: o.kind
  }));
}

function raycastAabb3D(ox, oy, oz, dx, dy, dz, box, maxDist) {
  let tmin = 0;
  let tmax = maxDist;

  if (Math.abs(dx) < 1e-7) {
    if (ox < box.minX || ox > box.maxX) return null;
  } else {
    let t1 = (box.minX - ox) / dx;
    let t2 = (box.maxX - ox) / dx;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }

  const minY = box.minY ?? 0;
  const maxY = box.maxY ?? box.height ?? 3;
  if (Math.abs(dy) < 1e-7) {
    if (oy < minY || oy > maxY) return null;
  } else {
    let t1 = (minY - oy) / dy;
    let t2 = (maxY - oy) / dy;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }

  if (Math.abs(dz) < 1e-7) {
    if (oz < box.minZ || oz > box.maxZ) return null;
  } else {
    let t1 = (box.minZ - oz) / dz;
    let t2 = (box.maxZ - oz) / dz;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }

  return tmin >= 0 && tmin <= maxDist ? tmin : null;
}

function raycastFighterCylinder(ox, oy, oz, dx, dy, dz, fighter, maxDist) {
  const rx = ox - fighter.x;
  const rz = oz - fighter.z;
  const r = 0.45;
  const a = dx * dx + dz * dz;
  const b = 2 * (rx * dx + rz * dz);
  const c = rx * rx + rz * rz - r * r;

  let tHit = null;
  if (a < 1e-6) {
    if (c <= 0 && dy !== 0) {
      const ty = dy > 0 ? (0.05 - oy) / dy : (1.82 - oy) / dy;
      if (ty >= 0 && ty <= maxDist) tHit = ty;
    }
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sqrtD = Math.sqrt(disc);
      const t1 = (-b - sqrtD) / (2 * a);
      const t2 = (-b + sqrtD) / (2 * a);
      const cand = t1 >= 0 ? t1 : t2 >= 0 ? t2 : -1;
      if (cand >= 0 && cand <= maxDist) {
        tHit = cand;
      }
    }
  }
  if (tHit === null) return null;
  const hitY = oy + dy * tHit;
  if (hitY < 0 || hitY > 1.86) return null;
  return { t: tHit, hitY, headshot: hitY >= 1.38 };
}

function clampArenaTargetPos(x, z, colliders, bounds, radius = 0.42) {
  const cx = Number(x);
  const cz = Number(z);
  const safeX = Number.isFinite(cx) ? Math.max(bounds.minX + radius + 0.2, Math.min(bounds.maxX - radius - 0.2, cx)) : COMBAT_ARENA_CENTER.x;
  const safeZ = Number.isFinite(cz) ? Math.max(bounds.minZ + radius + 0.2, Math.min(bounds.maxZ - radius - 0.2, cz)) : COMBAT_ARENA_CENTER.z;
  if (!pointCollidesWithColliders(safeX, safeZ, colliders, bounds, radius)) {
    return { x: safeX, z: safeZ };
  }
  return null;
}

export class CombatMatchController {
  constructor(options = {}) {
    this.roomId = options.roomId || 'combat-arena-local';
    this.minPlayers = Math.max(1, Number(options.minPlayers) || COMBAT_MIN_PLAYERS);
    this.matchDurationSec = Math.max(30, Number(options.matchDurationSec) || COMBAT_MATCH_DURATION_SEC);
    this.killLimit = Math.max(1, Number(options.killLimit) || COMBAT_KILL_LIMIT);
    this.respawnDelayMs = Math.max(400, Number(options.respawnDelayMs) || COMBAT_RESPAWN_DELAY_MS);
    this.botCount = Math.max(0, Number.isFinite(Number(options.botCount)) ? Number(options.botCount) : COMBAT_MIN_SOLO_BOTS);
    this.bounds = { ...COMBAT_ARENA_BOUNDS };
    this.colliders = getCombatArenaColliders();

    this.phase = 'idle';
    this.mode = 'guns';
    const initialBots = options.botsEnabled !== undefined
      ? Boolean(options.botsEnabled)
      : options.fillBots !== undefined
        ? Boolean(options.fillBots)
        : true;
    this.botsEnabled = initialBots;
    this.fillBots = initialBots;
    this.matchId = 0;
    this.startedAt = 0;
    this.endsAt = 0;
    this.endedInfo = null;

    this.lobbyPlayers = new Map();
    this.fighters = new Map();
    this.pickups = [];
    this.killfeed = [];
  }

  resetToIdle() {
    this.phase = 'idle';
    this.startedAt = 0;
    this.endsAt = 0;
    this.endedInfo = null;
    this.fighters.clear();
    this.pickups = [];
    this.killfeed = [];
    for (const lp of this.lobbyPlayers.values()) {
      lp.ready = false;
    }
  }

  _sanitizeWeaponForMode(weaponId, mode = this.mode) {
    const w = getCombatWeaponById(weaponId);
    if (w && w.mode === mode) return w.id;
    return getDefaultWeaponForMode(mode).id;
  }

  joinLobby(player = {}) {
    if (!player?.id) return null;
    const prev = this.lobbyPlayers.get(player.id);
    const entry = {
      id: player.id,
      name: String(player.name || 'Eleve_CIEL').slice(0, 20),
      color: player.color || '#38bdf8',
      skin: player.skin || null,
      weaponId: this._sanitizeWeaponForMode(prev?.weaponId || player.weaponId, this.mode),
      ready: Boolean(prev?.ready)
    };
    this.lobbyPlayers.set(player.id, entry);
    if (this.phase === 'idle' || this.phase === 'ended') {
      this.phase = 'lobby';
      this.endedInfo = null;
    }
    return entry;
  }

  setMode(mode = 'guns') {
    if (this.phase === 'active') return false;
    const nextMode = mode === 'melee' ? 'melee' : 'guns';
    this.mode = nextMode;
    const defWeapon = getDefaultWeaponForMode(nextMode).id;
    for (const lp of this.lobbyPlayers.values()) {
      lp.weaponId = this._sanitizeWeaponForMode(lp.weaponId, nextMode) || defWeapon;
    }
    return true;
  }

  setBotsEnabled(enabled = true) {
    if (this.phase === 'active') return false;
    const next = Boolean(enabled);
    this.botsEnabled = next;
    this.fillBots = next;
    return true;
  }

  setFillBots(enabled = true) {
    return this.setBotsEnabled(enabled);
  }

  setPlayerGuard(playerId, guarding = false) {
    if (this.phase !== 'active' || this.mode !== 'melee') return false;
    const f = this.fighters.get(playerId);
    if (!f || !f.alive) return false;
    f.guarding = Boolean(guarding);
    return true;
  }

  setPlayerWeapon(playerId, weaponId) {
    const spec = getCombatWeaponById(weaponId);
    if (!spec) return false;
    if (this.phase === 'active') {
      const f = this.fighters.get(playerId);
      if (!f || spec.mode !== this.mode) return false;
      f.weaponId = spec.id;
      f.ammo = spec.magSize;
      f.maxAmmo = spec.magSize;
      f.reloadingUntil = 0;
      return true;
    }
    const lp = this.lobbyPlayers.get(playerId);
    if (!lp) return false;
    if (spec.mode !== this.mode) {
      this.setMode(spec.mode);
    }
    lp.weaponId = spec.id;
    return true;
  }

  setReady(playerId, ready = true, now = Date.now()) {
    const entry = this.lobbyPlayers.get(playerId);
    if (!entry) return { ok: false, autoStarted: false };
    entry.ready = Boolean(ready);
    const autoStarted = this.canAutoStart() ? this.startMatch(now) : false;
    return { ok: true, autoStarted };
  }

  canAutoStart() {
    if (this.phase !== 'lobby') return false;
    if (this.lobbyPlayers.size < this.minPlayers) return false;
    for (const lp of this.lobbyPlayers.values()) {
      if (!lp.ready) return false;
    }
    return true;
  }

  leaveLobby(playerId) {
    this.lobbyPlayers.delete(playerId);
    const f = this.fighters.get(playerId);
    if (f) {
      this.fighters.delete(playerId);
    }
    let endedOutcome = null;
    if (this.phase === 'active') {
      let humanCount = 0;
      for (const fighter of this.fighters.values()) {
        if (!fighter.isBot) humanCount++;
      }
      if (humanCount === 0) {
        endedOutcome = this.finishMatch('aborted', Date.now(), 'Tous les élèves ont quitté l’arène.');
      }
    } else if (this.lobbyPlayers.size === 0) {
      this.resetToIdle();
    }
    return { endedOutcome };
  }

  _pickClearSpawn(excludeId = null, idxHint = 0) {
    let bestPt = COMBAT_SPAWN_POINTS[idxHint % COMBAT_SPAWN_POINTS.length];
    let bestScore = -Infinity;
    for (let i = 0; i < COMBAT_SPAWN_POINTS.length; i++) {
      const pt = COMBAT_SPAWN_POINTS[(i + idxHint) % COMBAT_SPAWN_POINTS.length];
      let minEnemyDist = 99;
      for (const f of this.fighters.values()) {
        if (f.id === excludeId || !f.alive) continue;
        const d = Math.hypot(f.x - pt.x, f.z - pt.z);
        if (d < minEnemyDist) minEnemyDist = d;
      }
      if (minEnemyDist > bestScore) {
        bestScore = minEnemyDist;
        bestPt = pt;
      }
    }
    const dx = COMBAT_ARENA_CENTER.x - bestPt.x;
    const dz = COMBAT_ARENA_CENTER.z - bestPt.z;
    return {
      x: bestPt.x,
      z: bestPt.z,
      yaw: Math.atan2(-dx, -dz)
    };
  }

  startMatch(now = Date.now()) {
    if (this.lobbyPlayers.size < this.minPlayers) return false;
    this.matchId += 1;
    this.phase = 'active';
    this.startedAt = now;
    this.endsAt = now + this.matchDurationSec * 1000;
    this.endedInfo = null;
    this.fighters.clear();
    this.killfeed = [];

    this.pickups = COMBAT_PICKUP_SPOTS.map((p) => ({
      id: p.id,
      x: p.x,
      z: p.z,
      label: p.label,
      active: true,
      respawnAt: 0
    }));

    const modeWeapons = getWeaponsByMode(this.mode);
    let idx = 0;
    for (const lp of this.lobbyPlayers.values()) {
      const wSpec = getCombatWeaponById(this._sanitizeWeaponForMode(lp.weaponId, this.mode)) || modeWeapons[0];
      const sp = this._pickClearSpawn(lp.id, idx++);
      this.fighters.set(lp.id, {
        id: lp.id,
        name: lp.name,
        color: lp.color,
        skin: lp.skin,
        isBot: false,
        x: sp.x,
        y: 0,
        z: sp.z,
        yaw: sp.yaw,
        hp: COMBAT_MAX_HP,
        maxHp: COMBAT_MAX_HP,
        alive: true,
        respawnAt: 0,
        spawnProtectUntil: now + COMBAT_SPAWN_PROTECT_MS,
        weaponId: wSpec.id,
        ammo: wSpec.magSize,
        maxAmmo: wSpec.magSize,
        reloadingUntil: 0,
        lastAttackAt: 0,
        kills: 0,
        deaths: 0,
        streak: 0,
        bestStreak: 0,
        damageDealt: 0,
        guarding: false
      });
    }

    const humanCount = this.fighters.size;
    const botsActive = Boolean(this.botsEnabled && this.fillBots);
    const neededBots = botsActive
      ? (humanCount === 1 ? Math.max(COMBAT_MIN_SOLO_BOTS, this.botCount) : this.botCount)
      : 0;
    for (let b = 0; b < neededBots; b++) {
      const botId = `bot-${this.matchId}-${b + 1}`;
      const wSpec = modeWeapons[b % modeWeapons.length] || modeWeapons[0];
      const sp = this._pickClearSpawn(botId, idx++);
      this.fighters.set(botId, {
        id: botId,
        name: COMBAT_BOT_NAMES[b % COMBAT_BOT_NAMES.length],
        color: b % 2 === 0 ? '#f43f5e' : '#f59e0b',
        skin: { style: 'cyber', color: b % 2 === 0 ? '#e11d48' : '#d97706', hat: 'visor' },
        isBot: true,
        x: sp.x,
        y: 0,
        z: sp.z,
        yaw: sp.yaw,
        hp: COMBAT_MAX_HP,
        maxHp: COMBAT_MAX_HP,
        alive: true,
        respawnAt: 0,
        spawnProtectUntil: now + COMBAT_SPAWN_PROTECT_MS,
        weaponId: wSpec.id,
        ammo: wSpec.magSize,
        maxAmmo: wSpec.magSize,
        reloadingUntil: 0,
        lastAttackAt: 0,
        kills: 0,
        deaths: 0,
        streak: 0,
        bestStreak: 0,
        damageDealt: 0,
        botPhase: b * 1.37,
        strafeSign: b % 2 === 0 ? 1 : -1
      });
    }
    return true;
  }

  updatePlayerPose(playerId, x, z, yaw = 0, y = 0) {
    if (this.phase !== 'active') return false;
    const f = this.fighters.get(playerId);
    if (!f || f.isBot || !f.alive) return false;
    const nx = Number(x);
    const nz = Number(z);
    if (!Number.isFinite(nx) || !Number.isFinite(nz)) return false;
    f.x = Math.max(this.bounds.minX + 0.35, Math.min(this.bounds.maxX - 0.35, nx));
    f.z = Math.max(this.bounds.minZ + 0.35, Math.min(this.bounds.maxZ - 0.35, nz));
    f.y = Number.isFinite(Number(y)) ? Math.max(0, Math.min(3, Number(y))) : 0;
    if (Number.isFinite(Number(yaw))) f.yaw = Number(yaw);
    return true;
  }

  reloadWeapon(playerId, now = Date.now()) {
    if (this.phase !== 'active' || this.mode !== 'guns') return { ok: false };
    const f = this.fighters.get(playerId);
    if (!f || !f.alive) return { ok: false };
    const spec = getCombatWeaponById(f.weaponId) || getDefaultWeaponForMode('guns');
    if (spec.magSize <= 0 || f.ammo >= spec.magSize) return { ok: false };
    if (f.reloadingUntil > now) return { ok: false };
    f.reloadingUntil = now + spec.reloadMs;
    return { ok: true, reloadMs: spec.reloadMs, weaponId: spec.id };
  }

  _hasLineOfSightChest(x1, z1, x2, z2) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.08) return true;
    const ux = dx / dist;
    const uz = dz / dist;
    for (const obs of COMBAT_ARENA_OBSTACLES) {
      const hitT = raycastAabb3D(x1, 1.05, z1, ux, 0, uz, obs, dist);
      if (hitT !== null && hitT < dist) return false;
    }
    return true;
  }

  _pushKillfeed(attacker, victim, weaponSpec, headshot = false, now = Date.now()) {
    this.killfeed.unshift({
      id: `${now}-${attacker.id}-${victim.id}`,
      killerId: attacker.id,
      killerName: attacker.name,
      victimId: victim.id,
      victimName: victim.name,
      weaponId: weaponSpec.id,
      weaponName: weaponSpec.shortName,
      icon: weaponSpec.icon,
      headshot: Boolean(headshot),
      at: now
    });
    if (this.killfeed.length > 6) {
      this.killfeed.length = 6;
    }
  }

  _applyDamage(attacker, victim, rawDamage, weaponSpec, headshot = false, now = Date.now()) {
    if (!victim.alive || now < victim.spawnProtectUntil) return null;
    let finalRaw = rawDamage;
    let guarded = false;
    if (this.mode === 'melee' && victim.guarding) {
      const toAtkX = attacker.x - victim.x;
      const toAtkZ = attacker.z - victim.z;
      const toLen = Math.hypot(toAtkX, toAtkZ);
      if (toLen > 0.05) {
        const vfX = -Math.sin(victim.yaw || 0);
        const vfZ = -Math.cos(victim.yaw || 0);
        const frontDot = (vfX * toAtkX + vfZ * toAtkZ) / toLen;
        if (frontDot >= 0.2) {
          finalRaw *= 0.5;
          guarded = true;
        }
      }
    }
    const dmg = Math.max(1, Math.round(finalRaw));
    victim.hp = Math.max(0, victim.hp - dmg);
    attacker.damageDealt += dmg;
    const killed = victim.hp <= 0;
    if (killed) {
      victim.alive = false;
      victim.hp = 0;
      victim.guarding = false;
      victim.respawnAt = now + this.respawnDelayMs;
      victim.deaths += 1;
      victim.streak = 0;
      attacker.kills += 1;
      attacker.streak += 1;
      if (attacker.streak > attacker.bestStreak) {
        attacker.bestStreak = attacker.streak;
      }
      this._pushKillfeed(attacker, victim, weaponSpec, headshot, now);
    }
    return {
      targetId: victim.id,
      targetName: victim.name,
      damage: dmg,
      remainingHp: victim.hp,
      killed,
      headshot,
      guarded
    };
  }

  _moveEntity(entity, dx, dz, radius = 0.42) {
    let nx = entity.x;
    let nz = entity.z;
    if (dx !== 0 && !pointCollidesWithColliders(nx + dx, nz, this.colliders, this.bounds, radius)) {
      nx += dx;
    }
    if (dz !== 0 && !pointCollidesWithColliders(nx, nz + dz, this.colliders, this.bounds, radius)) {
      nz += dz;
    }
    const moved = Math.hypot(nx - entity.x, nz - entity.z);
    entity.x = nx;
    entity.z = nz;
    return moved;
  }

  _applyKnockback(victim, dirX, dirZ, dist) {
    if (!victim || dist <= 0.05) return;
    const steps = Math.max(2, Math.ceil(dist / 0.25));
    const stepD = dist / steps;
    for (let i = 0; i < steps; i++) {
      const m = this._moveEntity(victim, dirX * stepD, dirZ * stepD, 0.42);
      if (m < 0.01) break;
    }
  }

  handleAttack(attackerId, payload = {}, now = Date.now()) {
    if (this.phase !== 'active') return { ok: false, reason: 'inactive' };
    const attacker = this.fighters.get(attackerId);
    if (!attacker || !attacker.alive) return { ok: false, reason: 'dead' };

    const requestedWeapon = getCombatWeaponById(payload.weaponId);
    if (requestedWeapon && requestedWeapon.mode === this.mode && requestedWeapon.id !== attacker.weaponId) {
      attacker.weaponId = requestedWeapon.id;
      attacker.ammo = requestedWeapon.magSize;
      attacker.maxAmmo = requestedWeapon.magSize;
      attacker.reloadingUntil = 0;
    }
    const spec = getCombatWeaponById(attacker.weaponId) || getDefaultWeaponForMode(this.mode);
    if (spec.mode !== this.mode) return { ok: false, reason: 'wrong_mode' };

    const cooldown = spec.fireRateMs * 0.85;
    if (now - attacker.lastAttackAt < cooldown) {
      return { ok: false, reason: 'cooldown' };
    }

    attacker.spawnProtectUntil = 0;

    if (this.mode === 'guns') {
      if (attacker.reloadingUntil > now) {
        return { ok: false, reason: 'reloading' };
      }
      if (spec.magSize > 0 && attacker.ammo <= 0) {
        attacker.reloadingUntil = now + spec.reloadMs;
        return { ok: false, reason: 'empty_reloading' };
      }
      if (spec.magSize > 0) {
        attacker.ammo = Math.max(0, attacker.ammo - 1);
        if (attacker.ammo === 0) {
          attacker.reloadingUntil = now + spec.reloadMs;
        }
      }
    }

    attacker.lastAttackAt = now;

    const rawOrig = payload.origin || {};
    const ox = Number.isFinite(Number(rawOrig.x)) ? Number(rawOrig.x) : attacker.x;
    const oy = Number.isFinite(Number(rawOrig.y)) ? Math.max(0.4, Math.min(2.4, Number(rawOrig.y))) : 1.52;
    const oz = Number.isFinite(Number(rawOrig.z)) ? Number(rawOrig.z) : attacker.z;

    const rawDir = payload.dir || {};
    let dx = Number(rawDir.x);
    let dy = Number(rawDir.y);
    let dz = Number(rawDir.z);
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(dz) || Math.hypot(dx, dy, dz) < 0.05) {
      dx = -Math.sin(attacker.yaw);
      dy = 0;
      dz = -Math.cos(attacker.yaw);
    }
    const dirLen = Math.hypot(dx, dy, dz) || 1;
    dx /= dirLen;
    dy /= dirLen;
    dz /= dirLen;

    const rays = [];
    const hits = [];
    let ended = null;

    if (this.mode === 'guns') {
      const pellets = Math.max(1, spec.pellets || 1);
      const adsMult = payload.ads ? (spec.ads?.spreadMult ?? 0.35) : 1;
      const spread = (Number(spec.spread) || 0) * adsMult;
      const rightX = -dz;
      const rightZ = dx;
      const rLen = Math.hypot(rightX, rightZ) || 1;
      const rxU = rightX / rLen;
      const rzU = rightZ / rLen;

      for (let p = 0; p < pellets; p++) {
        let sx = dx;
        let sy = dy;
        let sz = dz;
        if (spread > 0) {
          const offsetScale = pellets > 1 ? ((p / (pellets - 1)) - 0.5) * 1.7 : (Math.random() - 0.5) * 0.6;
          const vScale = pellets > 1 ? (((p % 3) - 1) * 0.45) : (Math.random() - 0.5) * 0.5;
          sx += rxU * spread * offsetScale;
          sy += spread * vScale;
          sz += rzU * spread * offsetScale;
          const sl = Math.hypot(sx, sy, sz) || 1;
          sx /= sl;
          sy /= sl;
          sz /= sl;
        }

        let maxD = spec.range;
        for (const obs of COMBAT_ARENA_OBSTACLES) {
          const wallT = raycastAabb3D(ox, oy, oz, sx, sy, sz, obs, maxD);
          if (wallT !== null && wallT < maxD) {
            maxD = wallT;
          }
        }

        let bestTarget = null;
        let bestHit = null;
        for (const target of this.fighters.values()) {
          if (target.id === attacker.id || !target.alive) continue;
          const res = raycastFighterCylinder(ox, oy, oz, sx, sy, sz, target, maxD);
          if (res && (!bestHit || res.t < bestHit.t)) {
            bestHit = res;
            bestTarget = target;
          }
        }

        const hitDist = bestHit ? bestHit.t : maxD;
        const ex = ox + sx * hitDist;
        const ey = Math.max(0.05, oy + sy * hitDist);
        const ez = oz + sz * hitDist;
        rays.push({ sx: ox, sy: oy, sz: oz, ex, ey, ez, hit: Boolean(bestTarget) });

        if (bestTarget) {
          const mult = bestHit.headshot && spec.id === 'ping_sniper' ? 1.28 : bestHit.headshot ? 1.15 : 1.0;
          const dmgRes = this._applyDamage(attacker, bestTarget, spec.damage * mult, spec, bestHit.headshot, now);
          if (dmgRes) hits.push(dmgRes);
        }
      }
    } else {
      const fLen = Math.hypot(dx, dz) || 1;
      const fx = dx / fLen;
      const fz = dz / fLen;

      if (spec.dashDist > 0.5) {
        const steps = 6;
        const stepD = spec.dashDist / steps;
        for (let i = 0; i < steps; i++) {
          const moved = this._moveEntity(attacker, fx * stepD, fz * stepD, 0.42);
          if (moved < 0.01) break;
        }
      }

      const effectiveRange = spec.range + (payload.isVrSwing ? 0.25 : 0);
      for (const target of this.fighters.values()) {
        if (target.id === attacker.id || !target.alive) continue;
        const tx = target.x - attacker.x;
        const tz = target.z - attacker.z;
        const dist = Math.hypot(tx, tz);
        const limit = spec.aoeRadius > 0 ? Math.max(effectiveRange, spec.aoeRadius) : effectiveRange;
        if (dist > limit) continue;
        if (dist > 0.15 && spec.aoeRadius <= 0) {
          const dot = (tx * fx + tz * fz) / dist;
          if (dot < (spec.arcCos ?? 0.25)) continue;
        }
        if (!this._hasLineOfSightChest(attacker.x, attacker.z, target.x, target.z)) continue;
        const dmgRes = this._applyDamage(attacker, target, spec.damage, spec, false, now);
        if (dmgRes) {
          hits.push(dmgRes);
          if (spec.knockback > 0 && dist > 0.05 && !dmgRes.killed) {
            this._applyKnockback(target, tx / dist, tz / dist, Math.min(2.6, spec.knockback * 0.48));
          }
        }
      }
    }

    if (attacker.kills >= this.killLimit && this.phase === 'active') {
      ended = this.finishMatch('kill_limit', now, `${attacker.name} atteint ${this.killLimit} éliminations !`);
    }

    return {
      ok: true,
      attackerId: attacker.id,
      attackerPos: { x: attacker.x, z: attacker.z, yaw: attacker.yaw },
      weaponId: spec.id,
      mode: this.mode,
      rays,
      hits,
      ended
    };
  }

  _stepBots(dt, now) {
    const events = [];
    for (const bot of this.fighters.values()) {
      if (!bot.isBot || !bot.alive) continue;
      const spec = getCombatWeaponById(bot.weaponId) || getDefaultWeaponForMode(this.mode);

      if (bot.reloadingUntil > 0 && now >= bot.reloadingUntil) {
        bot.reloadingUntil = 0;
        bot.ammo = spec.magSize;
      }

      let nearestEnemy = null;
      let nearestEnemyDist = Infinity;
      for (const other of this.fighters.values()) {
        if (other.id === bot.id || !other.alive) continue;
        const d = Math.hypot(other.x - bot.x, other.z - bot.z);
        if (d < nearestEnemyDist) {
          nearestEnemyDist = d;
          nearestEnemy = other;
        }
      }

      let goalX = COMBAT_ARENA_CENTER.x + Math.cos(now * 0.001 + bot.botPhase) * 6;
      let goalZ = COMBAT_ARENA_CENTER.z + Math.sin(now * 0.001 + bot.botPhase) * 6;
      if (bot.hp < 52) {
        let bestPack = null;
        let bestPackDist = Infinity;
        for (const pk of this.pickups) {
          if (!pk.active) continue;
          const d = Math.hypot(pk.x - bot.x, pk.z - bot.z);
          if (d < bestPackDist) {
            bestPackDist = d;
            bestPack = pk;
          }
        }
        if (bestPack) {
          goalX = bestPack.x;
          goalZ = bestPack.z;
        }
      } else if (nearestEnemy) {
        goalX = nearestEnemy.x;
        goalZ = nearestEnemy.z;
      }

      const toGoalX = goalX - bot.x;
      const toGoalZ = goalZ - bot.z;
      const goalDist = Math.hypot(toGoalX, toGoalZ) || 1;
      const gxU = toGoalX / goalDist;
      const gzU = toGoalZ / goalDist;
      const strafeX = -gzU * bot.strafeSign;
      const strafeZ = gxU * bot.strafeSign;

      let moveDirX = gxU;
      let moveDirZ = gzU;
      let moveSpeed = this.mode === 'melee' ? 4.55 : 3.75;

      if (this.mode === 'guns' && nearestEnemy) {
        if (nearestEnemyDist < 5.5) {
          moveDirX = -gxU * 0.7 + strafeX * 0.7;
          moveDirZ = -gzU * 0.7 + strafeZ * 0.7;
        } else if (nearestEnemyDist < 14) {
          moveDirX = strafeX * 0.9 + gxU * 0.2;
          moveDirZ = strafeZ * 0.9 + gzU * 0.2;
        } else {
          moveDirX = gxU * 0.88 + strafeX * 0.3;
          moveDirZ = gzU * 0.88 + strafeZ * 0.3;
        }
      } else if (this.mode === 'melee' && nearestEnemy) {
        moveDirX = gxU * 0.92 + strafeX * 0.25;
        moveDirZ = gzU * 0.92 + strafeZ * 0.25;
      }

      const mLen = Math.hypot(moveDirX, moveDirZ) || 1;
      moveDirX /= mLen;
      moveDirZ /= mLen;

      const moved = this._moveEntity(bot, moveDirX * moveSpeed * dt, moveDirZ * moveSpeed * dt, 0.42);
      if (moved < moveSpeed * dt * 0.2) {
        bot.strafeSign *= -1;
        this._moveEntity(bot, strafeX * moveSpeed * dt, strafeZ * moveSpeed * dt, 0.42);
      }

      if (nearestEnemy) {
        const ex = nearestEnemy.x - bot.x;
        const ez = nearestEnemy.z - bot.z;
        bot.yaw = Math.atan2(-ex, -ez);

        const attackReadyAt = bot.lastAttackAt + Math.max(spec.fireRateMs * 1.45, this.mode === 'guns' ? 380 : 480);
        const inRange =
          this.mode === 'guns'
            ? nearestEnemyDist <= Math.min(26, spec.range * 0.88)
            : nearestEnemyDist <= spec.range * 0.92;

        if (inRange && now >= attackReadyAt && this._hasLineOfSightChest(bot.x, bot.z, nearestEnemy.x, nearestEnemy.z)) {
          const eLen = Math.hypot(ex, ez) || 1;
          const aimJitter = this.mode === 'guns' ? 0.065 : 0;
          const jx = (Math.sin(now * 0.013 + bot.botPhase) * aimJitter);
          const jz = (Math.cos(now * 0.017 + bot.botPhase) * aimJitter);
          const atkRes = this.handleAttack(
            bot.id,
            {
              weaponId: spec.id,
              origin: { x: bot.x, y: 1.44, z: bot.z },
              dir: { x: ex / eLen + jx, y: 0, z: ez / eLen + jz }
            },
            now
          );
          if (atkRes.ok) {
            events.push(atkRes);
            if (atkRes.ended) break;
          }
        }
      }
    }
    return events;
  }

  step(dt = 0.08, now = Date.now()) {
    if (this.phase !== 'active') {
      return { attackEvents: [], ended: null };
    }

    for (const f of this.fighters.values()) {
      if (!f.alive && now >= f.respawnAt) {
        const sp = this._pickClearSpawn(f.id, Math.floor(now / 100) % COMBAT_SPAWN_POINTS.length);
        const spec = getCombatWeaponById(f.weaponId) || getDefaultWeaponForMode(this.mode);
        f.x = sp.x;
        f.y = 0;
        f.z = sp.z;
        f.yaw = sp.yaw;
        f.hp = COMBAT_MAX_HP;
        f.alive = true;
        f.ammo = spec.magSize;
        f.reloadingUntil = 0;
        f.lastAttackAt = now;
        f.spawnProtectUntil = now + COMBAT_SPAWN_PROTECT_MS;
      } else if (f.alive && f.reloadingUntil > 0 && now >= f.reloadingUntil) {
        const spec = getCombatWeaponById(f.weaponId) || getDefaultWeaponForMode(this.mode);
        f.reloadingUntil = 0;
        f.ammo = spec.magSize;
      }
    }

    for (const pk of this.pickups) {
      if (!pk.active && now >= pk.respawnAt) {
        pk.active = true;
        pk.respawnAt = 0;
      }
      if (!pk.active) continue;
      for (const f of this.fighters.values()) {
        if (!f.alive || f.hp >= COMBAT_MAX_HP) continue;
        if (Math.hypot(f.x - pk.x, f.z - pk.z) <= 1.15) {
          f.hp = Math.min(COMBAT_MAX_HP, f.hp + COMBAT_PICKUP_HEAL);
          pk.active = false;
          pk.respawnAt = now + COMBAT_PICKUP_RESPAWN_MS;
          break;
        }
      }
    }

    const attackEvents = this._stepBots(dt, now);
    let ended = this.phase === 'ended' ? this.endedInfo : null;

    if (!ended && now >= this.endsAt) {
      ended = this.finishMatch('time_up', now, 'Temps écoulé !');
    }

    return { attackEvents, ended };
  }

  getLeaderboard() {
    return [...this.fighters.values()]
      .map((f) => ({
        id: f.id,
        name: f.name,
        isBot: f.isBot,
        kills: f.kills,
        deaths: f.deaths,
        streak: f.streak,
        bestStreak: f.bestStreak,
        damageDealt: f.damageDealt,
        weaponId: f.weaponId
      }))
      .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths || b.damageDealt - a.damageDealt);
  }

  finishMatch(reasonCode = 'time_up', now = Date.now(), reasonText = '') {
    if (this.phase === 'ended' && this.endedInfo) {
      return this.endedInfo;
    }
    this.phase = 'ended';
    const scoreboard = this.getLeaderboard();
    const winner = scoreboard[0] || null;
    this.endedInfo = {
      matchId: this.matchId,
      mode: this.mode,
      reasonCode,
      reason: reasonText || (winner ? `${winner.name} remporte l’Arène CIEL !` : 'Manche terminée.'),
      winnerId: winner?.id || null,
      winnerName: winner?.name || null,
      durationSec: this.startedAt ? Math.max(1, Math.round((now - this.startedAt) / 1000)) : 0,
      scoreboard
    };
    return this.endedInfo;
  }

  getPublicSnapshot(now = Date.now()) {
    const lobbyPlayers = [...this.lobbyPlayers.values()].map((lp) => ({ ...lp }));
    const fighters = [...this.fighters.values()].map((f) => ({
      id: f.id,
      name: f.name,
      color: f.color,
      skin: f.skin,
      isBot: f.isBot,
      x: Number(f.x.toFixed(2)),
      y: Number((f.y || 0).toFixed(2)),
      z: Number(f.z.toFixed(2)),
      yaw: Number((f.yaw || 0).toFixed(3)),
      hp: f.hp,
      maxHp: f.maxHp,
      alive: f.alive,
      respawnRemainingMs: !f.alive ? Math.max(0, f.respawnAt - now) : 0,
      spawnProtected: Boolean(f.alive && now < f.spawnProtectUntil),
      weaponId: f.weaponId,
      ammo: f.ammo,
      maxAmmo: f.maxAmmo,
      reloading: Boolean(f.reloadingUntil > now),
      kills: f.kills,
      deaths: f.deaths,
      streak: f.streak,
      guarding: Boolean(f.guarding)
    }));

    const timeLeftSec =
      this.phase === 'active'
        ? Math.max(0, Math.ceil((this.endsAt - now) / 1000))
        : this.matchDurationSec;

    return {
      roomId: this.roomId,
      phase: this.phase,
      mode: this.mode,
      modeMeta: COMBAT_MODES[this.mode] || COMBAT_MODES.guns,
      botsEnabled: Boolean(this.botsEnabled),
      fillBots: Boolean(this.botsEnabled),
      matchId: this.matchId,
      minPlayers: this.minPlayers,
      killLimit: this.killLimit,
      durationSec: this.matchDurationSec,
      timeLeftSec,
      lobbyPlayers,
      readyCount: lobbyPlayers.filter((p) => p.ready).length,
      fighters,
      scoreboard: this.getLeaderboard(),
      pickups: this.pickups.map((pk) => ({ id: pk.id, x: pk.x, z: pk.z, active: pk.active })),
      killfeed: this.killfeed.slice(0, 5),
      availableWeapons: getWeaponsByMode(this.mode).map((w) => ({ ...w })),
      allWeapons: COMBAT_WEAPONS.map((w) => ({ ...w })),
      ended: this.endedInfo
    };
  }
}
