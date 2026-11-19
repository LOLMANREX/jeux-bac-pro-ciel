import * as THREE from 'three';

export const DEFAULT_CHUNK_SIZE = 16;
export const DEFAULT_HASH_CELL_SIZE = 8;

export const CULLING_QUALITY_PROFILES = {
  potato: {
    structureDist: 56,
    detailDist: 22,
    maxIndoorFloorDelta: 2
  },
  eco: {
    structureDist: 78,
    detailDist: 30,
    maxIndoorFloorDelta: 2
  },
  balanced: {
    structureDist: 110,
    detailDist: 42,
    maxIndoorFloorDelta: 2
  },
  high: {
    structureDist: 180,
    detailDist: 68,
    maxIndoorFloorDelta: 2
  }
};

export class SpatialHash {
  constructor(cellSize = DEFAULT_HASH_CELL_SIZE, floorHeight = 3.8) {
    this.cellSize = Math.max(2, Number(cellSize) || DEFAULT_HASH_CELL_SIZE);
    this.floorHeight = Number(floorHeight) || 3.8;
    this._colliderCells = new Map();
    this._interactableCells = new Map();
    this._occluderCells = new Map();
    this._floors = new Set([0]);
    this._stamp = 0;
    this._colliderCount = 0;
    this._interactableCount = 0;
    this._occluderCount = 0;
  }

  _cellKey(gx, gz, floor) {
    const fl = Math.max(-8, Math.min(120, Math.round(floor || 0))) + 8;
    const cx = Math.max(-2048, Math.min(2047, gx)) + 2048;
    const cz = Math.max(-2048, Math.min(2047, gz)) + 2048;
    return fl * 16777216 + cx * 4096 + cz;
  }

  clear() {
    this._colliderCells.clear();
    this._interactableCells.clear();
    this._occluderCells.clear();
    this._floors.clear();
    this._floors.add(0);
    this._stamp = 0;
    this._colliderCount = 0;
    this._interactableCount = 0;
    this._occluderCount = 0;
  }

  _insertWrapped(map, minX, maxX, minZ, maxZ, minFloor, maxFloor, wrap) {
    const cs = this.cellSize;
    const gx0 = Math.floor(minX / cs);
    const gx1 = Math.floor(maxX / cs);
    const gz0 = Math.floor(minZ / cs);
    const gz1 = Math.floor(maxZ / cs);
    for (let fl = minFloor; fl <= maxFloor; fl++) {
      this._floors.add(fl);
      for (let gx = gx0; gx <= gx1; gx++) {
        for (let gz = gz0; gz <= gz1; gz++) {
          const key = this._cellKey(gx, gz, fl);
          let bucket = map.get(key);
          if (!bucket) {
            bucket = [];
            map.set(key, bucket);
          }
          bucket.push(wrap);
        }
      }
    }
  }

  insertCollider(c) {
    if (!c || typeof c !== 'object') return;
    let minX;
    let maxX;
    let minZ;
    let maxZ;
    if (typeof c.cx === 'number') {
      const ext = Math.hypot(c.hw || 0, c.hd || 0);
      minX = c.cx - ext;
      maxX = c.cx + ext;
      minZ = c.cz - ext;
      maxZ = c.cz + ext;
    } else {
      minX = Number(c.minX) || 0;
      maxX = Number(c.maxX) || 0;
      minZ = Number(c.minZ) || 0;
      maxZ = Number(c.maxZ) || 0;
    }
    const fh = this.floorHeight;
    let minFloor = Number.isFinite(Number(c.floor)) ? Math.round(Number(c.floor)) : 0;
    let maxFloor = minFloor;
    if (Number.isFinite(Number(c.minY)) && Number.isFinite(Number(c.maxY))) {
      minFloor = Math.floor((Number(c.minY) + 0.05) / fh);
      maxFloor = Math.floor((Number(c.maxY) - 0.05) / fh);
      if (maxFloor < minFloor) maxFloor = minFloor;
    }
    const wrap = { data: c, stamp: 0 };
    this._colliderCount++;
    this._insertWrapped(
      this._colliderCells,
      minX - 0.65,
      maxX + 0.65,
      minZ - 0.65,
      maxZ + 0.65,
      minFloor,
      maxFloor,
      wrap
    );
  }

  insertInteractable(item) {
    if (!item) return;
    const px = Number(item.position?.x ?? item.x) || 0;
    const pz = Number(item.position?.z ?? item.z) || 0;
    const py = Number(item.position?.y ?? item.y) || 0;
    const floor = Number.isFinite(Number(item.floor))
      ? Math.round(Number(item.floor))
      : Math.floor((py + 0.5) / this.floorHeight);
    const rad = Math.max(3.5, Number(item.interactRadius) || 3.5);
    const wrap = { data: item, stamp: 0 };
    this._interactableCount++;
    this._insertWrapped(
      this._interactableCells,
      px - rad,
      px + rad,
      pz - rad,
      pz + rad,
      floor,
      floor,
      wrap
    );
  }

  insertOccluder(mesh, box3 = null, floor = 0) {
    if (!mesh) return;
    let b = box3;
    if (!b) {
      b = new THREE.Box3().setFromObject(mesh);
    }
    const fh = this.floorHeight;
    let minFloor = Math.round(Number(floor) || 0);
    let maxFloor = minFloor;
    if (!b.isEmpty()) {
      minFloor = Math.floor((b.min.y + 0.05) / fh);
      maxFloor = Math.floor((b.max.y - 0.05) / fh);
      if (maxFloor < minFloor) maxFloor = minFloor;
    }
    const wrap = { data: mesh, stamp: 0 };
    this._occluderCount++;
    this._insertWrapped(
      this._occluderCells,
      b.min.x - 0.5,
      b.max.x + 0.5,
      b.min.z - 0.5,
      b.max.z + 0.5,
      minFloor,
      maxFloor,
      wrap
    );
  }

  _queryMap(map, minX, maxX, minZ, maxZ, minFloor, maxFloor, out = []) {
    out.length = 0;
    const stamp = ++this._stamp;
    const cs = this.cellSize;
    const gx0 = Math.floor(minX / cs);
    const gx1 = Math.floor(maxX / cs);
    const gz0 = Math.floor(minZ / cs);
    const gz1 = Math.floor(maxZ / cs);
    for (let fl = minFloor; fl <= maxFloor; fl++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        for (let gz = gz0; gz <= gz1; gz++) {
          const bucket = map.get(this._cellKey(gx, gz, fl));
          if (!bucket) continue;
          for (let i = 0; i < bucket.length; i++) {
            const w = bucket[i];
            if (w.stamp === stamp) continue;
            w.stamp = stamp;
            out.push(w.data);
          }
        }
      }
    }
    return out;
  }

  queryColliders(x, z, radius = 0.9, floor = null, out = []) {
    const px = Number(x) || 0;
    const pz = Number(z) || 0;
    const r = Math.max(0.2, Number(radius) || 0.9);
    if (floor === null || floor === undefined) {
      let minFl = 0;
      let maxFl = 0;
      for (const fl of this._floors) {
        if (fl < minFl) minFl = fl;
        if (fl > maxFl) maxFl = fl;
      }
      return this._queryMap(this._colliderCells, px - r, px + r, pz - r, pz + r, minFl, maxFl, out);
    }
    const fl = Math.round(Number(floor) || 0);
    return this._queryMap(this._colliderCells, px - r, px + r, pz - r, pz + r, fl - 1, fl + 1, out);
  }

  queryInteractables(x, z, radius = 8.0, floor = null, out = []) {
    const px = Number(x) || 0;
    const pz = Number(z) || 0;
    const r = Math.max(1.0, Number(radius) || 8.0);
    if (floor === null || floor === undefined) {
      let minFl = 0;
      let maxFl = 0;
      for (const fl of this._floors) {
        if (fl < minFl) minFl = fl;
        if (fl > maxFl) maxFl = fl;
      }
      return this._queryMap(this._interactableCells, px - r, px + r, pz - r, pz + r, minFl, maxFl, out);
    }
    const fl = Math.round(Number(floor) || 0);
    return this._queryMap(this._interactableCells, px - r, px + r, pz - r, pz + r, fl - 1, fl + 1, out);
  }

  queryOccluders(origin, dir, maxDist = 10, floor = null, out = []) {
    if (!origin || !dir) {
      out.length = 0;
      return out;
    }
    const d = Math.max(1.0, Number(maxDist) || 10);
    const x1 = origin.x;
    const z1 = origin.z;
    const x2 = x1 + dir.x * d;
    const z2 = z1 + dir.z * d;
    const minX = Math.min(x1, x2) - 0.5;
    const maxX = Math.max(x1, x2) + 0.5;
    const minZ = Math.min(z1, z2) - 0.5;
    const maxZ = Math.max(z1, z2) + 0.5;
    const fl =
      floor === null || floor === undefined
        ? Math.floor(((origin.y || 0) + 0.5) / this.floorHeight)
        : Math.round(Number(floor) || 0);
    return this._queryMap(this._occluderCells, minX, maxX, minZ, maxZ, fl - 1, fl + 1, out);
  }

  queryOccludersAt(x, z, radius = 8.0, floor = null, out = []) {
    const px = Number(x) || 0;
    const pz = Number(z) || 0;
    const r = Math.max(1.0, Number(radius) || 8.0);
    if (floor === null || floor === undefined) {
      let minFl = 0;
      let maxFl = 0;
      for (const fl of this._floors) {
        if (fl < minFl) minFl = fl;
        if (fl > maxFl) maxFl = fl;
      }
      return this._queryMap(this._occluderCells, px - r, px + r, pz - r, pz + r, minFl, maxFl, out);
    }
    const fl = Math.round(Number(floor) || 0);
    return this._queryMap(this._occluderCells, px - r, px + r, pz - r, pz + r, fl - 1, fl + 1, out);
  }

  getStats() {
    return {
      colliderCells: this._colliderCells.size,
      interactableCells: this._interactableCells.size,
      occluderCells: this._occluderCells.size,
      colliderCount: this._colliderCount,
      interactableCount: this._interactableCount,
      occluderCount: this._occluderCount
    };
  }
}

const MAX_OCC_INTERVALS = 96;
const _occStarts = new Float64Array(MAX_OCC_INTERVALS);
const _occEnds = new Float64Array(MAX_OCC_INTERVALS);

function normalizeAngle(a) {
  let r = a;
  while (r > Math.PI) r -= Math.PI * 2;
  while (r < -Math.PI) r += Math.PI * 2;
  return r;
}

export function isChunkOccludedByWalls(camX, camZ, chunk, floorWalls = []) {
  if (!chunk || !Array.isArray(floorWalls) || floorWalls.length === 0) return false;
  const b = chunk.box;
  if (!b) return false;

  const minX = b.min.x;
  const maxX = b.max.x;
  const minZ = b.min.z;
  const maxZ = b.max.z;

  if (camX >= minX - 1.2 && camX <= maxX + 1.2 && camZ >= minZ - 1.2 && camZ <= maxZ + 1.2) {
    return false;
  }

  const qx = camX < minX ? minX : camX > maxX ? maxX : camX;
  const qz = camZ < minZ ? minZ : camZ > maxZ ? maxZ : camZ;
  const distSq = (camX - qx) * (camX - qx) + (camZ - qz) * (camZ - qz);
  if (distSq < 4.0) return false;

  const centerX = (minX + maxX) * 0.5;
  const centerZ = (minZ + maxZ) * 0.5;
  const baseAngle = Math.atan2(centerZ - camZ, centerX - camX);

  const a0 = normalizeAngle(Math.atan2(minZ - camZ, minX - camX) - baseAngle);
  const a1 = normalizeAngle(Math.atan2(minZ - camZ, maxX - camX) - baseAngle);
  const a2 = normalizeAngle(Math.atan2(maxZ - camZ, maxX - camX) - baseAngle);
  const a3 = normalizeAngle(Math.atan2(maxZ - camZ, minX - camX) - baseAngle);

  let spanMin = a0;
  let spanMax = a0;
  if (a1 < spanMin) spanMin = a1;
  if (a1 > spanMax) spanMax = a1;
  if (a2 < spanMin) spanMin = a2;
  if (a2 > spanMax) spanMax = a2;
  if (a3 < spanMin) spanMin = a3;
  if (a3 > spanMax) spanMax = a3;

  if (spanMax - spanMin >= Math.PI * 0.9) return false;

  let count = 0;
  for (let i = 0; i < floorWalls.length; i++) {
    const w = floorWalls[i];
    if (!w || (w.kind !== 'solid' && w.kind !== 'exterior')) continue;
    const x1 = w.x1;
    const z1 = w.z1;
    const x2 = w.x2;
    const z2 = w.z2;
    const wdx = x2 - x1;
    const wdz = z2 - z1;

    const camSide = (camX - x1) * wdz - (camZ - z1) * wdx;
    if (Math.abs(camSide) < 0.08) continue;

    const s0 = (minX - x1) * wdz - (minZ - z1) * wdx;
    if (s0 * camSide >= 0) continue;
    const s1 = (maxX - x1) * wdz - (minZ - z1) * wdx;
    if (s1 * camSide >= 0) continue;
    const s2 = (maxX - x1) * wdz - (maxZ - z1) * wdx;
    if (s2 * camSide >= 0) continue;
    const s3 = (minX - x1) * wdz - (maxZ - z1) * wdx;
    if (s3 * camSide >= 0) continue;

    let d1 = normalizeAngle(Math.atan2(z1 - camZ, x1 - camX) - baseAngle);
    let d2 = normalizeAngle(Math.atan2(z2 - camZ, x2 - camX) - baseAngle);
    if (Math.abs(d2 - d1) >= Math.PI) continue;
    if (d1 > d2) {
      const tmp = d1;
      d1 = d2;
      d2 = tmp;
    }
    if (d2 < spanMin || d1 > spanMax) continue;
    if (count < MAX_OCC_INTERVALS) {
      _occStarts[count] = d1 < spanMin ? spanMin : d1;
      _occEnds[count] = d2 > spanMax ? spanMax : d2;
      count++;
    }
  }

  if (count === 0) return false;

  for (let i = 1; i < count; i++) {
    const s = _occStarts[i];
    const e = _occEnds[i];
    let j = i - 1;
    while (j >= 0 && _occStarts[j] > s) {
      _occStarts[j + 1] = _occStarts[j];
      _occEnds[j + 1] = _occEnds[j];
      j--;
    }
    _occStarts[j + 1] = s;
    _occEnds[j + 1] = e;
  }

  let covered = spanMin;
  for (let i = 0; i < count; i++) {
    if (_occStarts[i] > covered + 0.004) {
      return false;
    }
    if (_occEnds[i] > covered) {
      covered = _occEnds[i];
    }
    if (covered >= spanMax - 0.004) {
      return true;
    }
  }
  return covered >= spanMax - 0.004;
}

export class SpatialCullingEngine {
  constructor(options = {}) {
    this.chunkSize = Math.max(4, Number(options.chunkSize) || DEFAULT_CHUNK_SIZE);
    this.floorHeight = Number(options.floorHeight) || 3.8;
    this.quality = CULLING_QUALITY_PROFILES[options.quality] ? options.quality : 'high';
    this.chunksMap = new Map();
    this.chunks = [];
    this.opaqueWallsByFloor = new Map();
    this.openingsByFloor = new Map();
    this.outdoorZones = [];
    this.editorCutoffFloor = null;
    this.editorFilterMode = 'all';

    this._frustum = new THREE.Frustum();
    this._projScreenMatrix = new THREE.Matrix4();
    this._camPos = new THREE.Vector3();
    this._camDir = new THREE.Vector3();
    this._paddedBox = new THREE.Box3();
    this._tempBox = new THREE.Box3();
    this._statsScratch = {
      visibleChunks: 0,
      totalChunks: 0,
      culledFrustum: 0,
      culledFloor: 0,
      culledDistance: 0,
      culledOcclusion: 0,
      visibleDetailChunks: 0,
      currentFloor: 0
    };
  }

  _makeChunkKey(cx, cz, floor) {
    return `${floor}:${cx}:${cz}`;
  }

  getOrCreateChunk(x, z, floor = 0) {
    const fl = Math.round(Number(floor) || 0);
    const cx = Math.floor((Number(x) || 0) / this.chunkSize);
    const cz = Math.floor((Number(z) || 0) / this.chunkSize);
    const key = this._makeChunkKey(cx, cz, fl);
    let chunk = this.chunksMap.get(key);
    if (chunk) return chunk;

    const minX = cx * this.chunkSize;
    const maxX = minX + this.chunkSize;
    const minZ = cz * this.chunkSize;
    const maxZ = minZ + this.chunkSize;
    const minY = fl * this.floorHeight - 0.25;
    const maxY = (fl + 1) * this.floorHeight + 0.5;

    const root = new THREE.Group();
    root.name = `chunk-${fl}-${cx}-${cz}`;
    root.matrixAutoUpdate = false;

    const structureGroup = new THREE.Group();
    structureGroup.name = `chunk-struct-${fl}-${cx}-${cz}`;
    structureGroup.matrixAutoUpdate = false;

    const detailGroup = new THREE.Group();
    detailGroup.name = `chunk-detail-${fl}-${cx}-${cz}`;
    detailGroup.matrixAutoUpdate = false;

    root.add(structureGroup);
    root.add(detailGroup);

    chunk = {
      key,
      cx,
      cz,
      floor: fl,
      minX,
      maxX,
      minZ,
      maxZ,
      minY,
      maxY,
      centerX: (minX + maxX) * 0.5,
      centerY: (minY + maxY) * 0.5,
      centerZ: (minZ + maxZ) * 0.5,
      box: new THREE.Box3(
        new THREE.Vector3(minX, minY, minZ),
        new THREE.Vector3(maxX, maxY, maxZ)
      ),
      root,
      structureGroup,
      detailGroup,
      visible: true,
      detailsVisible: true,
      cullReason: 'none',
      hasOutdoor: false,
      hasOpening: false
    };
    this.chunksMap.set(key, chunk);
    this.chunks.push(chunk);
    return chunk;
  }

  addNode(node, x, z, floor = 0, category = 'detail') {
    if (!node) return null;
    const chunk = this.getOrCreateChunk(x, z, floor);
    if (category === 'structure') {
      chunk.structureGroup.add(node);
    } else {
      chunk.detailGroup.add(node);
    }
    node.userData = node.userData || {};
    node.userData.__chunk = chunk;
    return chunk;
  }

  registerOpaqueWall(seg) {
    if (!seg || (seg.kind !== 'solid' && seg.kind !== 'exterior')) return;
    const fl = Math.round(Number(seg.floor) || 0);
    let list = this.opaqueWallsByFloor.get(fl);
    if (!list) {
      list = [];
      this.opaqueWallsByFloor.set(fl, list);
    }
    list.push(seg);
  }

  registerOpening(op) {
    if (!op) return;
    const fl = Math.round(Number(op.floor) || 0);
    let list = this.openingsByFloor.get(fl);
    if (!list) {
      list = [];
      this.openingsByFloor.set(fl, list);
    }
    list.push(op);
  }

  registerOutdoorZone(zone) {
    if (!zone) return;
    this.outdoorZones.push({
      minX: Number(zone.minX ?? (zone.x - (zone.w || 4) * 0.5)),
      maxX: Number(zone.maxX ?? (zone.x + (zone.w || 4) * 0.5)),
      minZ: Number(zone.minZ ?? (zone.z - (zone.d || 4) * 0.5)),
      maxZ: Number(zone.maxZ ?? (zone.z + (zone.d || 4) * 0.5)),
      floor: Math.round(Number(zone.floor) || 0)
    });
  }

  finalize(worldGroup = null) {
    for (let i = 0; i < this.chunks.length; i++) {
      const chunk = this.chunks[i];
      if (worldGroup && chunk.root.parent !== worldGroup) {
        worldGroup.add(chunk.root);
      }
      chunk.root.updateMatrixWorld(true);
      this._tempBox.makeEmpty();
      this._tempBox.setFromObject(chunk.root);
      if (!this._tempBox.isEmpty()) {
        chunk.box.union(this._tempBox);
      }
      chunk.centerX = (chunk.box.min.x + chunk.box.max.x) * 0.5;
      chunk.centerY = (chunk.box.min.y + chunk.box.max.y) * 0.5;
      chunk.centerZ = (chunk.box.min.z + chunk.box.max.z) * 0.5;

      chunk.hasOutdoor = false;
      for (let oz = 0; oz < this.outdoorZones.length; oz++) {
        const z = this.outdoorZones[oz];
        if (
          z.maxX >= chunk.box.min.x - 1 &&
          z.minX <= chunk.box.max.x + 1 &&
          z.maxZ >= chunk.box.min.z - 1 &&
          z.minZ <= chunk.box.max.z + 1
        ) {
          chunk.hasOutdoor = true;
          break;
        }
      }

      chunk.hasOpening = false;
      const ops = this.openingsByFloor.get(chunk.floor);
      const opsAbove = this.openingsByFloor.get(chunk.floor + 1);
      if (ops) {
        for (let k = 0; k < ops.length; k++) {
          const op = ops[k];
          if (
            op.maxX >= chunk.box.min.x - 2 &&
            op.minX <= chunk.box.max.x + 2 &&
            op.maxZ >= chunk.box.min.z - 2 &&
            op.minZ <= chunk.box.max.z + 2
          ) {
            chunk.hasOpening = true;
            break;
          }
        }
      }
      if (!chunk.hasOpening && opsAbove) {
        for (let k = 0; k < opsAbove.length; k++) {
          const op = opsAbove[k];
          if (
            op.maxX >= chunk.box.min.x - 2 &&
            op.minX <= chunk.box.max.x + 2 &&
            op.maxZ >= chunk.box.min.z - 2 &&
            op.minZ <= chunk.box.max.z + 2
          ) {
            chunk.hasOpening = true;
            break;
          }
        }
      }
    }
    this._statsScratch.totalChunks = this.chunks.length;
    this._statsScratch.visibleChunks = this.chunks.length;
    this._statsScratch.visibleDetailChunks = this.chunks.length;
  }

  setQuality(quality = 'high') {
    this.quality = CULLING_QUALITY_PROFILES[quality] ? quality : 'balanced';
  }

  setEditorFloorCutoff(cutoffFloor = null, mode = 'all') {
    this.editorCutoffFloor =
      cutoffFloor === null || cutoffFloor === undefined ? null : Math.round(Number(cutoffFloor) || 0);
    this.editorFilterMode = mode === 'only' || mode === 'upTo' ? mode : 'all';
  }

  setAllVisible(visible = true) {
    const v = Boolean(visible);
    for (let i = 0; i < this.chunks.length; i++) {
      const ch = this.chunks[i];
      ch.visible = v;
      ch.detailsVisible = v;
      ch.cullReason = v ? 'none' : 'disabled';
      ch.root.visible = v;
      ch.structureGroup.visible = v;
      ch.detailGroup.visible = v;
    }
    this._statsScratch.totalChunks = this.chunks.length;
    this._statsScratch.visibleChunks = v ? this.chunks.length : 0;
    this._statsScratch.visibleDetailChunks = v ? this.chunks.length : 0;
    this._statsScratch.culledFrustum = 0;
    this._statsScratch.culledFloor = 0;
    this._statsScratch.culledDistance = 0;
    this._statsScratch.culledOcclusion = 0;
    return this._statsScratch;
  }

  _isCamInOutdoor(camX, camZ) {
    for (let i = 0; i < this.outdoorZones.length; i++) {
      const z = this.outdoorZones[i];
      if (camX >= z.minX && camX <= z.maxX && camZ >= z.minZ && camZ <= z.maxZ) {
        return true;
      }
    }
    return false;
  }

  _hasOpeningNearCam(camX, camZ, floor) {
    const ops = this.openingsByFloor.get(floor);
    if (ops) {
      for (let i = 0; i < ops.length; i++) {
        const op = ops[i];
        if (camX >= op.minX - 4 && camX <= op.maxX + 4 && camZ >= op.minZ - 4 && camZ <= op.maxZ + 4) {
          return true;
        }
      }
    }
    const opsUp = this.openingsByFloor.get(floor + 1);
    if (opsUp) {
      for (let i = 0; i < opsUp.length; i++) {
        const op = opsUp[i];
        if (camX >= op.minX - 4 && camX <= op.maxX + 4 && camZ >= op.minZ - 4 && camZ <= op.maxZ + 4) {
          return true;
        }
      }
    }
    return false;
  }

  update(camera, playerPos = null, options = {}) {
    const total = this.chunks.length;
    const stats = this._statsScratch;
    stats.totalChunks = total;
    stats.visibleChunks = 0;
    stats.culledFrustum = 0;
    stats.culledFloor = 0;
    stats.culledDistance = 0;
    stats.culledOcclusion = 0;
    stats.visibleDetailChunks = 0;

    if (!camera || total === 0) {
      stats.visibleChunks = total;
      stats.visibleDetailChunks = total;
      return stats;
    }

    if (camera.parent && typeof camera.parent.updateMatrixWorld === 'function') {
      camera.parent.updateMatrixWorld(true);
    } else {
      camera.updateMatrixWorld?.(true);
    }
    if (camera.matrixWorldInverse && camera.matrixWorld) {
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    }
    this._projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this._frustum.setFromProjectionMatrix(this._projScreenMatrix);
    if (typeof camera.getWorldPosition === 'function') {
      camera.getWorldPosition(this._camPos);
    } else if (camera.position) {
      this._camPos.copy(camera.position);
    }

    const camX = this._camPos.x;
    const camY = this._camPos.y;
    const camZ = this._camPos.z;
    const currentFloor = Number.isFinite(Number(options.currentFloor))
      ? Math.round(Number(options.currentFloor))
      : playerPos && Number.isFinite(Number(playerPos.y))
        ? Math.floor((Number(playerPos.y) + 0.5) / this.floorHeight)
        : Math.floor((camY + 0.5) / this.floorHeight);
    stats.currentFloor = currentFloor;

    const qualityId = options.quality || this.quality;
    const profile = CULLING_QUALITY_PROFILES[qualityId] || CULLING_QUALITY_PROFILES.balanced;
    const structDist = Number.isFinite(Number(options.structureDist))
      ? Number(options.structureDist)
      : profile.structureDist;
    const detailDist = Number.isFinite(Number(options.detailDist))
      ? Number(options.detailDist)
      : profile.detailDist;
    const structDistSq = structDist * structDist;
    const detailDistSq = detailDist * detailDist;
    const maxFloorDelta = Number.isFinite(Number(options.maxIndoorFloorDelta))
      ? Number(options.maxIndoorFloorDelta)
      : profile.maxIndoorFloorDelta;

    const isVr = Boolean(options.isVr);
    const isOutdoor = Boolean(options.isOutdoor) || this._isCamInOutdoor(camX, camZ);
    const camNearOpening = this._hasOpeningNearCam(camX, camZ, currentFloor);
    const floorWalls = this.opaqueWallsByFloor.get(currentFloor) || null;
    const enableOcclusion = options.enableOcclusion !== false && !isOutdoor && Boolean(floorWalls && floorWalls.length > 0);
    const enableFloorCulling = options.enableFloorCulling !== false && !isOutdoor && !camNearOpening;

    for (let i = 0; i < total; i++) {
      const ch = this.chunks[i];

      if (this.editorCutoffFloor !== null && this.editorFilterMode !== 'all') {
        const hideByEditor =
          this.editorFilterMode === 'only'
            ? ch.floor !== this.editorCutoffFloor
            : ch.floor > this.editorCutoffFloor;
        if (hideByEditor) {
          ch.visible = false;
          ch.detailsVisible = false;
          ch.cullReason = 'floor';
          ch.root.visible = false;
          stats.culledFloor++;
          continue;
        }
      }

      const b = ch.box;
      const qx = camX < b.min.x ? b.min.x : camX > b.max.x ? b.max.x : camX;
      const qy = camY < b.min.y ? b.min.y : camY > b.max.y ? b.max.y : camY;
      const qz = camZ < b.min.z ? b.min.z : camZ > b.max.z ? b.max.z : camZ;
      const dx = camX - qx;
      const dy = camY - qy;
      const dz = camZ - qz;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq > structDistSq) {
        ch.visible = false;
        ch.detailsVisible = false;
        ch.cullReason = 'distance';
        ch.root.visible = false;
        stats.culledDistance++;
        continue;
      }

      let inFrustum;
      if (isVr) {
        this._paddedBox.copy(b).expandByScalar(0.75);
        inFrustum = this._frustum.intersectsBox(this._paddedBox);
      } else {
        inFrustum = this._frustum.intersectsBox(b);
      }
      if (!inFrustum) {
        ch.visible = false;
        ch.detailsVisible = false;
        ch.cullReason = 'frustum';
        ch.root.visible = false;
        stats.culledFrustum++;
        continue;
      }

      if (
        enableFloorCulling &&
        !ch.hasOutdoor &&
        !ch.hasOpening &&
        Math.abs(ch.floor - currentFloor) >= maxFloorDelta
      ) {
        ch.visible = false;
        ch.detailsVisible = false;
        ch.cullReason = 'floor';
        ch.root.visible = false;
        stats.culledFloor++;
        continue;
      }

      if (
        enableOcclusion &&
        ch.floor === currentFloor &&
        !ch.hasOutdoor &&
        distSq > 4.0 &&
        isChunkOccludedByWalls(camX, camZ, ch, floorWalls)
      ) {
        ch.visible = false;
        ch.detailsVisible = false;
        ch.cullReason = 'occlusion';
        ch.root.visible = false;
        stats.culledOcclusion++;
        continue;
      }

      const showDetails =
        distSq <= detailDistSq &&
        (ch.floor === currentFloor ||
          isOutdoor ||
          ch.hasOutdoor ||
          camNearOpening ||
          ch.hasOpening);
      ch.visible = true;
      ch.detailsVisible = showDetails;
      ch.cullReason = 'none';
      ch.root.visible = true;
      ch.structureGroup.visible = true;
      ch.detailGroup.visible = showDetails;
      stats.visibleChunks++;
      if (showDetails) stats.visibleDetailChunks++;
    }

    return stats;
  }

  getStats() {
    return this._statsScratch;
  }

  dispose() {
    this.chunksMap.clear();
    this.chunks.length = 0;
    this.opaqueWallsByFloor.clear();
    this.openingsByFloor.clear();
    this.outdoorZones.length = 0;
  }
}
