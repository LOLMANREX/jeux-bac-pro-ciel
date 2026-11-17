import { TP_CATALOG } from '../core/gameState.js';
import {
  createDefaultMap,
  getCatalogItem,
  getDynamicMapColliders,
  getZoneAtPositionInMap,
  subtractDoorsFromWalls
} from './mapSchema.js';

export const SURVIVAL_MIN_PLAYERS = 2;
export const SURVIVAL_MIC_NOISE_THRESHOLD = 0.28;
export const SURVIVAL_MIC_SCREAM_THRESHOLD = 0.48;
export const SURVIVAL_MIC_HEAR_RANGE = 18;
export const SURVIVAL_VISION_RANGE = 14;
export const SURVIVAL_VISION_COS = Math.cos((65 * Math.PI) / 180);
export const SURVIVAL_CAPTURE_RADIUS = 1.28;
export const SURVIVAL_PATROL_SPEED = 2.65;
export const SURVIVAL_INVESTIGATE_SPEED = 3.35;
export const SURVIVAL_CHASE_SPEED = 4.45;

export function getSurvivalRequiredTps(mapData = null) {
  const src = mapData || createDefaultMap();
  const seen = new Set();
  const list = [];
  for (const obj of src.objects || []) {
    const cat = getCatalogItem(obj.type);
    if (cat?.tpId && !seen.has(cat.tpId)) {
      seen.add(cat.tpId);
      list.push(cat.tpId);
    }
  }
  if (list.length > 0) return list;
  return TP_CATALOG.map((t) => t.id);
}

export function getSurvivalHidingSpots(mapData = null) {
  const src = mapData || createDefaultMap();
  const spots = [];
  for (const obj of src.objects || []) {
    if (obj.type !== 'hiding_rack') continue;
    const rad = ((Number(obj.rotation) || 0) * Math.PI) / 180;
    const d = Number(obj.d) || 0.78;
    const exitDist = d * 0.5 + 0.68;
    spots.push({
      id: obj.id,
      label: obj.label || 'Baie de Brassage (Cachette)',
      x: Number(obj.x) || 0,
      z: Number(obj.z) || 0,
      rotation: Number(obj.rotation) || 0,
      rad,
      w: Number(obj.w) || 1.1,
      d,
      exitX: Number(((Number(obj.x) || 0) + Math.sin(rad) * exitDist).toFixed(2)),
      exitZ: Number(((Number(obj.z) || 0) + Math.cos(rad) * exitDist).toFixed(2))
    });
  }
  return spots;
}

export function getSurvivalDoors(mapData = null) {
  const src = mapData || createDefaultMap();
  const doors = [];
  for (const obj of src.objects || []) {
    if (obj.type !== 'survival_door') continue;
    doors.push({
      id: obj.id,
      label: obj.label || 'Porte de Mini-Jeu Survie',
      x: Number(obj.x) || 0,
      z: Number(obj.z) || 0,
      rotation: Number(obj.rotation) || 0
    });
  }
  return doors;
}

export function pointCollidesWithColliders(nx, nz, colliders = [], bounds = null, radius = 0.34) {
  if (bounds) {
    if (
      nx - radius < bounds.minX + 0.12 ||
      nx + radius > bounds.maxX - 0.12 ||
      nz - radius < bounds.minZ + 0.12 ||
      nz + radius > bounds.maxZ - 0.12
    ) {
      return true;
    }
  }
  for (const c of colliders) {
    if (typeof c.cx === 'number') {
      const dx = nx - c.cx;
      const dz = nz - c.cz;
      const along = dx * c.ux + dz * c.uz;
      const perp = -dx * c.uz + dz * c.ux;
      if (Math.abs(along) < c.hw + radius && Math.abs(perp) < c.hd + radius) {
        return true;
      }
      continue;
    }
    if (
      nx + radius > c.minX &&
      nx - radius < c.maxX &&
      nz + radius > c.minZ &&
      nz - radius < c.maxZ
    ) {
      return true;
    }
  }
  return false;
}

export function getSolidWallColliders(mapData = null) {
  const src = mapData || createDefaultMap();
  const resolved = subtractDoorsFromWalls(src.walls || []);
  const solid = [];
  for (const w of resolved) {
    if (w.kind !== 'solid') continue;
    const dx = w.x2 - w.x1;
    const dz = w.z2 - w.z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.15) continue;
    const cx = (w.x1 + w.x2) / 2;
    const cz = (w.z1 + w.z2) / 2;
    const halfT = (w.thickness || 0.18) / 2;
    if (Math.abs(dz) < 0.02) {
      solid.push({
        minX: Math.min(w.x1, w.x2),
        maxX: Math.max(w.x1, w.x2),
        minZ: cz - halfT,
        maxZ: cz + halfT
      });
    } else if (Math.abs(dx) < 0.02) {
      solid.push({
        minX: cx - halfT,
        maxX: cx + halfT,
        minZ: Math.min(w.z1, w.z2),
        maxZ: Math.max(w.z1, w.z2)
      });
    } else {
      solid.push({
        cx,
        cz,
        hw: len / 2,
        hd: halfT,
        ux: dx / len,
        uz: dz / len
      });
    }
  }
  return solid;
}

export function hasLineOfSight(x1, z1, x2, z2, wallColliders = [], stepSize = 0.28) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.25) return true;
  const steps = Math.max(2, Math.ceil(dist / stepSize));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = x1 + dx * t;
    const pz = z1 + dz * t;
    if (pointCollidesWithColliders(px, pz, wallColliders, null, 0.08)) {
      return false;
    }
  }
  return true;
}

export function buildNavGrid(mapData = null, desiredCellSize = 0.45, agentRadius = 0.3) {
  const src = mapData || createDefaultMap();
  const b = src.bounds || { minX: -13, maxX: 13, minZ: -12.2, maxZ: 12.2, width: 26, depth: 24.4 };
  const maxSpan = Math.max(b.width || 26, b.depth || 24.4);
  const cellSize = Math.max(desiredCellSize, Math.min(1.2, maxSpan / 64));
  const cols = Math.max(4, Math.floor((b.maxX - b.minX) / cellSize) + 1);
  const rows = Math.max(4, Math.floor((b.maxZ - b.minZ) / cellSize) + 1);
  const colliders = getDynamicMapColliders(src);
  const blocked = new Uint8Array(cols * rows);

  for (let r = 0; r < rows; r++) {
    const wz = b.minZ + r * cellSize;
    for (let c = 0; c < cols; c++) {
      const wx = b.minX + c * cellSize;
      if (pointCollidesWithColliders(wx, wz, colliders, b, agentRadius)) {
        blocked[r * cols + c] = 1;
      }
    }
  }

  return {
    bounds: b,
    cellSize,
    cols,
    rows,
    blocked,
    colliders,
    solidWalls: getSolidWallColliders(src),
    toGrid(wx, wz) {
      return [
        Math.max(0, Math.min(cols - 1, Math.round((wx - b.minX) / cellSize))),
        Math.max(0, Math.min(rows - 1, Math.round((wz - b.minZ) / cellSize)))
      ];
    },
    toWorld(gx, gz) {
      return [
        Number((b.minX + gx * cellSize).toFixed(3)),
        Number((b.minZ + gz * cellSize).toFixed(3))
      ];
    },
    isWalkable(gx, gz) {
      if (gx < 0 || gx >= cols || gz < 0 || gz >= rows) return false;
      return blocked[gz * cols + gx] === 0;
    }
  };
}

export function findNearestWalkableCell(grid, wx, wz, maxRing = 8) {
  const [gx0, gz0] = grid.toGrid(wx, wz);
  if (grid.isWalkable(gx0, gz0)) return [gx0, gz0];
  let best = null;
  let bestDistSq = Infinity;
  for (let rad = 1; rad <= maxRing; rad++) {
    for (let dz = -rad; dz <= rad; dz++) {
      for (let dx = -rad; dx <= rad; dx++) {
        if (Math.abs(dx) !== rad && Math.abs(dz) !== rad) continue;
        const cx = gx0 + dx;
        const cz = gz0 + dz;
        if (!grid.isWalkable(cx, cz)) continue;
        const [rx, rz] = grid.toWorld(cx, cz);
        const dSq = (rx - wx) ** 2 + (rz - wz) ** 2;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          best = [cx, cz];
        }
      }
    }
    if (best) return best;
  }
  return null;
}

export function findPathAStar(grid, startX, startZ, goalX, goalZ) {
  const startCell = findNearestWalkableCell(grid, startX, startZ, 10);
  const goalCell = findNearestWalkableCell(grid, goalX, goalZ, 10);
  if (!startCell || !goalCell) return [];

  const [sx, sz] = startCell;
  const [tx, tz] = goalCell;
  const total = grid.cols * grid.rows;
  if (sx === tx && sz === tz) {
    const [wx, wz] = grid.toWorld(tx, tz);
    return [{ x: wx, z: wz }];
  }

  const gScore = new Float32Array(total);
  gScore.fill(Infinity);
  const fScore = new Float32Array(total);
  fScore.fill(Infinity);
  const cameFrom = new Int32Array(total);
  cameFrom.fill(-1);
  const closed = new Uint8Array(total);
  const inOpen = new Uint8Array(total);

  const startIdx = sz * grid.cols + sx;
  const goalIdx = tz * grid.cols + tx;
  gScore[startIdx] = 0;
  fScore[startIdx] = Math.hypot(tx - sx, tz - sz);

  const heap = [startIdx];
  inOpen[startIdx] = 1;

  const swap = (i, j) => {
    const tmp = heap[i];
    heap[i] = heap[j];
    heap[j] = tmp;
  };
  const pushHeap = (idx) => {
    heap.push(idx);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (fScore[heap[p]] <= fScore[heap[i]]) break;
      swap(i, p);
      i = p;
    }
  };
  const popHeap = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      const n = heap.length;
      while (true) {
        let best = i;
        const l = i * 2 + 1;
        const r = l + 1;
        if (l < n && fScore[heap[l]] < fScore[heap[best]]) best = l;
        if (r < n && fScore[heap[r]] < fScore[heap[best]]) best = r;
        if (best === i) break;
        swap(i, best);
        i = best;
      }
    }
    return top;
  };

  const dirs = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2]
  ];

  let found = false;
  let iter = 0;
  const maxIter = total * 4;

  while (heap.length > 0 && iter++ < maxIter) {
    const cur = popHeap();
    inOpen[cur] = 0;
    if (cur === goalIdx) {
      found = true;
      break;
    }
    closed[cur] = 1;
    const cx = cur % grid.cols;
    const cz = Math.floor(cur / grid.cols);

    for (const [dx, dz, cost] of dirs) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (!grid.isWalkable(nx, nz)) continue;
      if (dx !== 0 && dz !== 0) {
        if (!grid.isWalkable(cx + dx, cz) || !grid.isWalkable(cx, cz + dz)) {
          continue;
        }
      }
      const nIdx = nz * grid.cols + nx;
      if (closed[nIdx]) continue;
      const tentativeG = gScore[cur] + cost;
      if (tentativeG < gScore[nIdx]) {
        cameFrom[nIdx] = cur;
        gScore[nIdx] = tentativeG;
        fScore[nIdx] = tentativeG + Math.hypot(tx - nx, tz - nz);
        if (!inOpen[nIdx]) {
          inOpen[nIdx] = 1;
          pushHeap(nIdx);
        }
      }
    }
  }

  if (!found) return [];

  const rawPts = [];
  let cur = goalIdx;
  while (cur !== -1) {
    const gx = cur % grid.cols;
    const gz = Math.floor(cur / grid.cols);
    const [wx, wz] = grid.toWorld(gx, gz);
    rawPts.push({ x: wx, z: wz });
    if (cur === startIdx) break;
    cur = cameFrom[cur];
  }
  rawPts.reverse();
  if (rawPts.length <= 2) return rawPts.slice(1);

  const smoothed = [];
  let anchorIdx = 0;
  while (anchorIdx < rawPts.length - 1) {
    let furthest = anchorIdx + 1;
    for (let probe = rawPts.length - 1; probe > anchorIdx + 1; probe--) {
      const a = rawPts[anchorIdx];
      const b = rawPts[probe];
      if (!segmentHitsGrid(grid, a.x, a.z, b.x, b.z)) {
        furthest = probe;
        break;
      }
    }
    smoothed.push(rawPts[furthest]);
    anchorIdx = furthest;
  }
  return smoothed;
}

function segmentHitsGrid(grid, x1, z1, x2, z2) {
  const dist = Math.hypot(x2 - x1, z2 - z1);
  const steps = Math.max(2, Math.ceil(dist / (grid.cellSize * 0.45)));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = x1 + (x2 - x1) * t;
    const pz = z1 + (z2 - z1) * t;
    const [gx, gz] = grid.toGrid(px, pz);
    if (!grid.isWalkable(gx, gz)) return true;
  }
  return false;
}

export function extractSurvivalWaypoints(mapData, grid) {
  const src = mapData || createDefaultMap();
  const candidates = [];

  const addCandidate = (id, x, z, label = '') => {
    const cell = findNearestWalkableCell(grid, x, z, 6);
    if (!cell) return;
    const [wx, wz] = grid.toWorld(cell[0], cell[1]);
    if (candidates.some((c) => Math.hypot(c.x - wx, c.z - wz) < 1.8)) return;
    candidates.push({ id, x: wx, z: wz, label });
  };

  for (const z of src.zones || []) {
    addCandidate(`zone:${z.id}`, z.x, z.z, z.shortName || z.code || z.id);
  }
  for (const obj of src.objects || []) {
    const cat = getCatalogItem(obj.type);
    if (!cat?.tpId) continue;
    const rad = ((Number(obj.rotation) || 0) * Math.PI) / 180;
    const off = (Number(obj.d) || 1) * 0.5 + 0.9;
    addCandidate(
      `tp:${cat.tpId}`,
      (Number(obj.x) || 0) + Math.sin(rad) * off,
      (Number(obj.z) || 0) + Math.cos(rad) * off,
      obj.label || cat.shortLabel
    );
  }

  const b = grid.bounds;
  for (const fx of [0.2, 0.5, 0.8]) {
    for (const fz of [0.2, 0.5, 0.8]) {
      addCandidate(
        `grid:${fx}:${fz}`,
        b.minX + (b.maxX - b.minX) * fx,
        b.minZ + (b.maxZ - b.minZ) * fz,
        'Couloir'
      );
    }
  }

  if (candidates.length === 0) {
    const sp = src.spawn || { x: 0, z: 0 };
    addCandidate('spawn', sp.x, sp.z, 'Hall');
  }
  return candidates;
}

export function evaluateMicVolumeForAI({
  micEnabled = false,
  level = 0,
  rms = 0,
  distance = Infinity,
  noiseThreshold = SURVIVAL_MIC_NOISE_THRESHOLD,
  screamThreshold = SURVIVAL_MIC_SCREAM_THRESHOLD,
  hearRange = SURVIVAL_MIC_HEAR_RANGE
} = {}) {
  const numLevel = Number(level);
  const numRms = Number(rms);
  const effectiveLevel = Math.max(
    0,
    Math.min(1, Number.isFinite(numLevel) && numLevel > 0 ? numLevel : Number.isFinite(numRms) ? numRms * 4.5 : 0)
  );
  if (!micEnabled || !Number.isFinite(distance) || distance > hearRange) {
    return { heard: false, severity: 'silent', level: effectiveLevel, state: null };
  }
  if (effectiveLevel >= screamThreshold || (effectiveLevel >= noiseThreshold && distance <= hearRange * 0.65)) {
    return { heard: true, severity: 'scream', level: effectiveLevel, state: 'chase' };
  }
  if (effectiveLevel >= noiseThreshold) {
    return { heard: true, severity: 'noise', level: effectiveLevel, state: 'investigate' };
  }
  return { heard: false, severity: 'silent', level: effectiveLevel, state: null };
}

export class SurvivalMatchController {
  constructor(mapData = null, options = {}) {
    this.roomId = options.roomId || 'plateau-u300';
    this.minPlayers = Math.max(2, Number(options.minPlayers) || SURVIVAL_MIN_PLAYERS);
    this.graceMs = Number.isFinite(Number(options.graceMs)) ? Number(options.graceMs) : 1800;
    this.captureRadius = Number.isFinite(Number(options.captureRadius))
      ? Number(options.captureRadius)
      : SURVIVAL_CAPTURE_RADIUS;
    this.phase = 'idle';
    this.matchId = null;
    this.startedAt = 0;
    this.aiGraceUntil = 0;
    this.endedAt = 0;
    this.outcome = null;
    this.lobbyPlayers = new Map();
    this.participants = new Map();
    this.requiredTps = [];
    this.completedTps = new Set();
    this.hidingSpots = [];
    this.waypoints = [];
    this.navGrid = null;
    this.radarRevealUntil = 0;
    this.ai = {
      x: 7.5,
      z: 7.5,
      yaw: 0,
      state: 'patrol',
      targetPlayerId: null,
      targetPos: null,
      path: [],
      lastPathAt: 0,
      lastHeardAt: 0,
      heardSourceName: '',
      recentWaypoints: [],
      stuckTimer: 0,
      lastProgressPos: { x: 7.5, z: 7.5 },
      alertMessage: 'Patrouille dans les couloirs...'
    };
    this.setMapData(mapData || createDefaultMap());
  }

  setMapData(rawMap) {
    this.mapData = rawMap || createDefaultMap();
    this.navGrid = buildNavGrid(this.mapData);
    this.requiredTps = getSurvivalRequiredTps(this.mapData);
    this.hidingSpots = getSurvivalHidingSpots(this.mapData);
    this.waypoints = extractSurvivalWaypoints(this.mapData, this.navGrid);
    if (this.phase === 'idle' || this.phase === 'lobby') {
      const spawnPt = this._pickInitialAiSpawn();
      this.ai.x = spawnPt.x;
      this.ai.z = spawnPt.z;
      this.ai.lastProgressPos = { x: spawnPt.x, z: spawnPt.z };
    }
  }

  _pickInitialAiSpawn() {
    const sp = this.mapData?.spawn || { x: -3.95, z: 0.65 };
    let best = null;
    let bestDist = -1;
    for (const wp of this.waypoints) {
      const d = Math.hypot(wp.x - sp.x, wp.z - sp.z);
      if (d > bestDist) {
        bestDist = d;
        best = wp;
      }
    }
    if (best) return { x: best.x, z: best.z };
    return { x: 7.6, z: 7.8 };
  }

  joinLobby(player = {}) {
    if (!player?.id) return { ok: false, reason: 'invalid_player' };
    const id = String(player.id);
    if (this.lobbyPlayers.has(id)) {
      const existing = this.lobbyPlayers.get(id);
      existing.name = player.name || existing.name;
      existing.color = player.color || existing.color;
      return { ok: true, joined: true, autoStarted: false };
    }
    this.lobbyPlayers.set(id, {
      id,
      name: player.name || 'Élève',
      color: player.color || '#22d3ee',
      ready: false,
      joinedAt: Date.now()
    });
    if (this.phase === 'idle') {
      this.phase = 'lobby';
    }
    return { ok: true, joined: true, autoStarted: false };
  }

  leaveLobby(playerId) {
    const id = String(playerId || '');
    const removedLobby = this.lobbyPlayers.delete(id);
    let endedOutcome = null;

    if (this.phase === 'active' && this.participants.has(id)) {
      this.participants.delete(id);
      const alive = this.getAliveParticipants();
      if (this.participants.size === 0) {
        this.resetToIdle();
      } else if (alive.length === 0) {
        endedOutcome = this._finishMatch('defeat', Date.now());
      }
    } else if (this.lobbyPlayers.size === 0 && (this.phase === 'lobby' || this.phase === 'victory' || this.phase === 'defeat')) {
      this.resetToIdle();
    }
    return { removed: removedLobby, endedOutcome };
  }

  setReady(playerId, ready, nowMs = Date.now()) {
    const id = String(playerId || '');
    const entry = this.lobbyPlayers.get(id);
    if (!entry) return { ok: false, autoStarted: false };
    entry.ready = Boolean(ready);
    if (this.phase === 'lobby' && this.canAutoStart()) {
      this.startMatch(nowMs);
      return { ok: true, autoStarted: true };
    }
    return { ok: true, autoStarted: false };
  }

  canAutoStart() {
    if (this.phase !== 'lobby') return false;
    if (this.lobbyPlayers.size < this.minPlayers) return false;
    for (const p of this.lobbyPlayers.values()) {
      if (!p.ready) return false;
    }
    return true;
  }

  startMatch(nowMs = Date.now()) {
    this.phase = 'active';
    this.matchId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    this.startedAt = nowMs;
    this.aiGraceUntil = nowMs + this.graceMs;
    this.endedAt = 0;
    this.outcome = null;
    this.completedTps.clear();
    this.participants.clear();
    this.radarRevealUntil = 0;

    const sp = this.mapData?.spawn || { x: -3.95, z: 0.65 };
    for (const lp of this.lobbyPlayers.values()) {
      this.participants.set(lp.id, {
        id: lp.id,
        name: lp.name,
        color: lp.color,
        status: 'alive',
        x: Number(sp.x) || 0,
        z: Number(sp.z) || 0,
        yaw: 0,
        hiddenRackId: null,
        micEnabled: false,
        micLevel: 0,
        micRms: 0,
        lastNoiseAt: 0,
        detentionSolvedCount: 0,
        caughtAt: 0
      });
    }

    const aiSpawn = this._pickInitialAiSpawn();
    this.ai = {
      x: aiSpawn.x,
      z: aiSpawn.z,
      yaw: 0,
      state: 'patrol',
      targetPlayerId: null,
      targetPos: null,
      path: [],
      lastPathAt: 0,
      lastHeardAt: 0,
      heardSourceName: '',
      recentWaypoints: [],
      stuckTimer: 0,
      lastProgressPos: { x: aiSpawn.x, z: aiSpawn.z },
      alertMessage: 'Le Professeur CIEL commence sa ronde...'
    };
    this._pickNextPatrolTarget();
    return this.getPublicSnapshot(nowMs);
  }

  resetToIdle() {
    this.phase = this.lobbyPlayers.size > 0 ? 'lobby' : 'idle';
    this.matchId = null;
    this.outcome = null;
    this.completedTps.clear();
    this.participants.clear();
    this.radarRevealUntil = 0;
    for (const p of this.lobbyPlayers.values()) {
      p.ready = false;
    }
    const aiSpawn = this._pickInitialAiSpawn();
    this.ai.x = aiSpawn.x;
    this.ai.z = aiSpawn.z;
    this.ai.state = 'patrol';
    this.ai.targetPlayerId = null;
    this.ai.targetPos = null;
    this.ai.path = [];
  }

  getAliveParticipants() {
    const out = [];
    for (const p of this.participants.values()) {
      if (p.status === 'alive') out.push(p);
    }
    return out;
  }

  getDetainedParticipants() {
    const out = [];
    for (const p of this.participants.values()) {
      if (p.status === 'detained') out.push(p);
    }
    return out;
  }

  updatePlayerPose(playerId, x, z, yaw = 0) {
    const p = this.participants.get(String(playerId || ''));
    if (!p || p.status !== 'alive') return;
    if (p.hiddenRackId) return;
    if (Number.isFinite(Number(x))) p.x = Number(x);
    if (Number.isFinite(Number(z))) p.z = Number(z);
    if (Number.isFinite(Number(yaw))) p.yaw = Number(yaw);
  }

  setPlayerHiding(playerId, rackId = null) {
    const p = this.participants.get(String(playerId || ''));
    if (!p || p.status !== 'alive') return { ok: false };
    if (!rackId) {
      const prevRack = this.hidingSpots.find((s) => s.id === p.hiddenRackId);
      p.hiddenRackId = null;
      if (prevRack) {
        p.x = prevRack.exitX;
        p.z = prevRack.exitZ;
      }
      return { ok: true, hidden: false, rackId: null, exitPos: prevRack ? { x: prevRack.exitX, z: prevRack.exitZ } : null };
    }
    const rack = this.hidingSpots.find((s) => s.id === rackId);
    if (!rack) return { ok: false };
    p.hiddenRackId = rack.id;
    p.x = rack.x;
    p.z = rack.z;
    p.yaw = rack.rad;

    if (this.ai.targetPlayerId === p.id && !this._isPlayerNoisy(p)) {
      this.ai.targetPlayerId = null;
      this.ai.state = 'patrol';
      this.ai.targetPos = null;
      this.ai.path = [];
      this.ai.alertMessage = 'Trace perdue — reprise de la patrouille.';
      this._pickNextPatrolTarget();
    }
    return { ok: true, hidden: true, rackId: rack.id, rack };
  }

  _isPlayerNoisy(p) {
    if (!p?.micEnabled) return false;
    return p.micLevel >= SURVIVAL_MIC_NOISE_THRESHOLD;
  }

  reportMicNoise(playerId, { micEnabled = false, level = 0, rms = 0 } = {}, nowMs = Date.now()) {
    const p = this.participants.get(String(playerId || ''));
    if (!p) return { heard: false };
    p.micEnabled = Boolean(micEnabled);
    p.micRms = Math.max(0, Number(rms) || 0);
    p.micLevel = Math.max(0, Math.min(1, Number(level) || p.micRms * 4.5));
    if (this.phase !== 'active' || p.status !== 'alive' || nowMs < this.aiGraceUntil) {
      return { heard: false };
    }
    const dist = Math.hypot(p.x - this.ai.x, p.z - this.ai.z);
    const evalRes = evaluateMicVolumeForAI({
      micEnabled: p.micEnabled,
      level: p.micLevel,
      rms: p.micRms,
      distance: dist
    });
    if (!evalRes.heard) {
      return evalRes;
    }

    p.lastNoiseAt = nowMs;
    this.ai.lastHeardAt = nowMs;
    this.ai.heardSourceName = p.name;

    if (evalRes.state === 'chase') {
      this.ai.state = 'chase';
      this.ai.targetPlayerId = p.id;
      this.ai.targetPos = { x: p.x, z: p.z };
      this.ai.path = findPathAStar(this.navGrid, this.ai.x, this.ai.z, p.x, p.z);
      this.ai.lastPathAt = nowMs;
      this.ai.alertMessage = `🚨 ${p.name} entendu au micro (${Math.round(dist)}m) !`;
    } else if (this.ai.state !== 'chase') {
      this.ai.state = 'investigate';
      this.ai.targetPlayerId = null;
      this.ai.targetPos = { x: p.x, z: p.z };
      this.ai.path = findPathAStar(this.navGrid, this.ai.x, this.ai.z, p.x, p.z);
      this.ai.lastPathAt = nowMs;
      this.ai.alertMessage = `👂 Bruit suspect détecté vers ${p.name}...`;
    }
    return evalRes;
  }

  completeTp(tpId, byPlayerId = null, score = 20, nowMs = Date.now()) {
    if (this.phase !== 'active') return { accepted: false };
    const cleanId = String(tpId || '').trim();
    if (!cleanId) return { accepted: false };
    if (!this.requiredTps.includes(cleanId) && this.requiredTps.length > 0) {
      return { accepted: false };
    }
    if (Number(score) < 10) {
      return { accepted: false, reason: 'score_too_low' };
    }
    const already = this.completedTps.has(cleanId);
    this.completedTps.add(cleanId);

    const byPlayer = this.participants.get(String(byPlayerId || ''));
    if (!already && byPlayer && this.ai.state === 'patrol') {
      this.ai.state = 'investigate';
      this.ai.targetPos = { x: byPlayer.x, z: byPlayer.z };
      this.ai.path = findPathAStar(this.navGrid, this.ai.x, this.ai.z, byPlayer.x, byPlayer.z);
      this.ai.lastPathAt = nowMs;
      this.ai.alertMessage = `⚠️ Activité détectée sur un TP !`;
    }

    const allDone = this.requiredTps.every((id) => this.completedTps.has(id));
    if (allDone) {
      const ended = this._finishMatch('victory', nowMs);
      return { accepted: true, added: !already, victory: true, ended };
    }
    return {
      accepted: true,
      added: !already,
      victory: false,
      completedCount: this.completedTps.size,
      totalRequired: this.requiredTps.length
    };
  }

  recordDetentionSolved(playerId, nowMs = Date.now()) {
    const p = this.participants.get(String(playerId || ''));
    if (!p || p.status !== 'detained') return null;
    p.detentionSolvedCount += 1;
    this.radarRevealUntil = Math.max(this.radarRevealUntil, nowMs + 6000);
    return {
      playerId: p.id,
      playerName: p.name,
      detentionSolvedCount: p.detentionSolvedCount,
      radarRevealUntil: this.radarRevealUntil
    };
  }

  _finishMatch(outcome, nowMs = Date.now()) {
    this.phase = outcome;
    this.outcome = outcome;
    this.endedAt = nowMs;
    const survivors = this.getAliveParticipants().map((p) => ({ id: p.id, name: p.name }));
    const detained = this.getDetainedParticipants().map((p) => ({
      id: p.id,
      name: p.name,
      detentionSolvedCount: p.detentionSolvedCount
    }));
    return {
      matchId: this.matchId,
      outcome,
      completedTps: [...this.completedTps],
      requiredTps: [...this.requiredTps],
      durationSec: Math.max(1, Math.round((nowMs - this.startedAt) / 1000)),
      survivors,
      detained
    };
  }

  _pickNextPatrolTarget() {
    if (this.waypoints.length === 0) return;
    const recentSet = new Set(this.ai.recentWaypoints);
    const candidates = this.waypoints.filter((w) => !recentSet.has(w.id));
    const pool = candidates.length > 0 ? candidates : this.waypoints;

    let best = null;
    let bestScore = -Infinity;
    for (const wp of pool) {
      const dist = Math.hypot(wp.x - this.ai.x, wp.z - this.ai.z);
      if (dist < 2.2 && pool.length > 1) continue;
      const jitter = Math.random() * 4.5;
      const score = dist * 0.7 + jitter;
      if (score > bestScore) {
        bestScore = score;
        best = wp;
      }
    }
    if (!best) best = pool[Math.floor(Math.random() * pool.length)];
    if (!best) return;

    this.ai.recentWaypoints.push(best.id);
    const maxRecent = Math.max(2, Math.floor(this.waypoints.length * 0.6));
    while (this.ai.recentWaypoints.length > maxRecent) {
      this.ai.recentWaypoints.shift();
    }

    this.ai.targetPos = { x: best.x, z: best.z };
    this.ai.path = findPathAStar(this.navGrid, this.ai.x, this.ai.z, best.x, best.z);
    if (this.ai.path.length === 0) {
      this.ai.path = [{ x: best.x, z: best.z }];
    }
  }

  _canSeePlayer(p) {
    if (!p || p.status !== 'alive') return false;
    if (p.hiddenRackId && !this._isPlayerNoisy(p)) return false;
    const dx = p.x - this.ai.x;
    const dz = p.z - this.ai.z;
    const dist = Math.hypot(dx, dz);
    if (dist > SURVIVAL_VISION_RANGE) return false;
    if (dist > 2.0) {
      const fx = Math.sin(this.ai.yaw);
      const fz = Math.cos(this.ai.yaw);
      const dot = (dx * fx + dz * fz) / dist;
      if (dot < SURVIVAL_VISION_COS && this.ai.targetPlayerId !== p.id) {
        return false;
      }
    }
    return hasLineOfSight(this.ai.x, this.ai.z, p.x, p.z, this.navGrid.solidWalls);
  }

  step(dt = 0.1, nowMs = Date.now()) {
    if (this.phase !== 'active') return { caught: [], ended: null };
    const safeDt = Math.max(0.01, Math.min(0.3, Number(dt) || 0.1));
    const caughtEvents = [];

    if (nowMs < this.aiGraceUntil) {
      return { caught: [], ended: null };
    }

    const alive = this.getAliveParticipants();
    if (alive.length === 0) {
      return { caught: [], ended: this._finishMatch('defeat', nowMs) };
    }

    let visibleTarget = null;
    let visibleDist = Infinity;
    for (const p of alive) {
      if (this._canSeePlayer(p)) {
        const d = Math.hypot(p.x - this.ai.x, p.z - this.ai.z);
        if (d < visibleDist) {
          visibleDist = d;
          visibleTarget = p;
        }
      }
    }

    if (visibleTarget) {
      this.ai.state = 'chase';
      this.ai.targetPlayerId = visibleTarget.id;
      this.ai.targetPos = { x: visibleTarget.x, z: visibleTarget.z };
      this.ai.alertMessage = `👁️ ${visibleTarget.name} en vue — POURSUITE !`;
      if (nowMs - this.ai.lastPathAt >= 320 || this.ai.path.length === 0) {
        this.ai.path = findPathAStar(this.navGrid, this.ai.x, this.ai.z, visibleTarget.x, visibleTarget.z);
        this.ai.lastPathAt = nowMs;
      }
    } else if (this.ai.state === 'chase' && this.ai.targetPlayerId) {
      const target = this.participants.get(this.ai.targetPlayerId);
      const targetStillNoisy = target && target.status === 'alive' && this._isPlayerNoisy(target) && Math.hypot(target.x - this.ai.x, target.z - this.ai.z) <= SURVIVAL_MIC_HEAR_RANGE;
      if (target && target.status === 'alive' && target.hiddenRackId && !targetStillNoisy) {
        this.ai.targetPlayerId = null;
        this.ai.state = 'patrol';
        this.ai.targetPos = null;
        this.ai.path = [];
        this.ai.alertMessage = 'Trace perdue — retour en patrouille.';
        this._pickNextPatrolTarget();
      } else if (target && target.status === 'alive' && targetStillNoisy) {
        this.ai.targetPos = { x: target.x, z: target.z };
        if (nowMs - this.ai.lastPathAt >= 280) {
          this.ai.path = findPathAStar(this.navGrid, this.ai.x, this.ai.z, target.x, target.z);
          this.ai.lastPathAt = nowMs;
        }
      } else if (!target || target.status !== 'alive' || this.ai.path.length === 0) {
        this.ai.state = 'investigate';
        this.ai.targetPlayerId = null;
        this.ai.alertMessage = 'Recherche de l’élève...';
      }
    }

    if (this.ai.path.length === 0) {
      if (this.ai.state === 'investigate') {
        this.ai.state = 'patrol';
        this.ai.targetPlayerId = null;
        this.ai.alertMessage = 'Patrouille dans les couloirs...';
      }
      this._pickNextPatrolTarget();
    }

    const moveSpeed =
      this.ai.state === 'chase'
        ? SURVIVAL_CHASE_SPEED
        : this.ai.state === 'investigate'
          ? SURVIVAL_INVESTIGATE_SPEED
          : SURVIVAL_PATROL_SPEED;

    let remainingMove = moveSpeed * safeDt;
    while (remainingMove > 0.001 && this.ai.path.length > 0) {
      const nextPt = this.ai.path[0];
      const dx = nextPt.x - this.ai.x;
      const dz = nextPt.z - this.ai.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= 0.16) {
        this.ai.x = nextPt.x;
        this.ai.z = nextPt.z;
        this.ai.path.shift();
        continue;
      }
      this.ai.yaw = Math.atan2(dx, dz);
      const stepDist = Math.min(remainingMove, dist);
      this.ai.x += (dx / dist) * stepDist;
      this.ai.z += (dz / dist) * stepDist;
      remainingMove -= stepDist;
    }

    const progDist = Math.hypot(
      this.ai.x - this.ai.lastProgressPos.x,
      this.ai.z - this.ai.lastProgressPos.z
    );
    if (progDist < 0.08) {
      this.ai.stuckTimer += safeDt;
      if (this.ai.stuckTimer > 1.0) {
        this.ai.stuckTimer = 0;
        this.ai.path = [];
        this.ai.state = 'patrol';
        this.ai.targetPlayerId = null;
        this._pickNextPatrolTarget();
      }
    } else {
      this.ai.stuckTimer = 0;
      this.ai.lastProgressPos = { x: this.ai.x, z: this.ai.z };
    }

    for (const p of alive) {
      const hiddenSilent = Boolean(p.hiddenRackId && !this._isPlayerNoisy(p));
      if (hiddenSilent) continue;
      const dist = Math.hypot(p.x - this.ai.x, p.z - this.ai.z);
      if (dist <= this.captureRadius) {
        const canGrabThroughRack = Boolean(p.hiddenRackId && this._isPlayerNoisy(p));
        const losOk = canGrabThroughRack || hasLineOfSight(this.ai.x, this.ai.z, p.x, p.z, this.navGrid.solidWalls);
        if (losOk) {
          p.status = 'detained';
          p.hiddenRackId = null;
          p.caughtAt = nowMs;
          caughtEvents.push({
            playerId: p.id,
            playerName: p.name,
            x: p.x,
            z: p.z,
            at: nowMs
          });
          if (this.ai.targetPlayerId === p.id) {
            this.ai.targetPlayerId = null;
            this.ai.state = 'patrol';
            this.ai.path = [];
            this._pickNextPatrolTarget();
          }
        }
      }
    }

    let ended = null;
    if (caughtEvents.length > 0 && this.getAliveParticipants().length === 0) {
      ended = this._finishMatch('defeat', nowMs);
    }

    return { caught: caughtEvents, ended };
  }

  getPublicSnapshot(nowMs = Date.now()) {
    const aiZone = getZoneAtPositionInMap(this.mapData, this.ai.x, this.ai.z);
    const lobbyList = [...this.lobbyPlayers.values()].map((p) => ({ ...p }));
    const readyCount = lobbyList.filter((p) => p.ready).length;
    const participantList = [...this.participants.values()].map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      status: p.status,
      x: Number(p.x.toFixed(2)),
      z: Number(p.z.toFixed(2)),
      yaw: Number((p.yaw || 0).toFixed(3)),
      hiddenRackId: p.hiddenRackId,
      micEnabled: p.micEnabled,
      micLevel: Number((p.micLevel || 0).toFixed(2)),
      detentionSolvedCount: p.detentionSolvedCount
    }));
    return {
      roomId: this.roomId,
      phase: this.phase,
      matchId: this.matchId,
      outcome: this.outcome,
      minPlayers: this.minPlayers,
      lobbyPlayers: lobbyList,
      readyCount,
      lobbyCount: lobbyList.length,
      participants: participantList,
      aliveCount: participantList.filter((p) => p.status === 'alive').length,
      detainedCount: participantList.filter((p) => p.status === 'detained').length,
      requiredTps: [...this.requiredTps],
      completedTps: [...this.completedTps],
      radarActive: nowMs < this.radarRevealUntil,
      radarRevealUntil: this.radarRevealUntil,
      graceActive: this.phase === 'active' && nowMs < this.aiGraceUntil,
      ai: {
        x: Number(this.ai.x.toFixed(2)),
        z: Number(this.ai.z.toFixed(2)),
        yaw: Number((this.ai.yaw || 0).toFixed(3)),
        state: this.ai.state,
        targetPlayerId: this.ai.targetPlayerId,
        zoneCode: aiZone?.code || 'U300',
        alertMessage: this.ai.alertMessage
      }
    };
  }
}
