import {
  MIN_FLOOR,
  MAX_FLOOR,
  clampFloor,
  createDefaultMap,
  formatFloorLabel,
  formatFloorShortLabel,
  getCatalogItem,
  getZoneAtPositionInMap,
  getZonePolygonPoints,
  normalizeMapData,
  subtractDoorsFromWalls
} from '../../world/mapSchema.js';
import { TP_CATALOG, EXTRA_STATIONS } from '../../core/gameState.js';

const STATION_META = new Map([...TP_CATALOG, ...EXTRA_STATIONS].map((s) => [s.id, s]));

function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function getAvailableFloors(mapData) {
  const src = mapData && typeof mapData === 'object' ? mapData : createDefaultMap();
  const walls = Array.isArray(src.walls) ? src.walls : [];
  const zones = Array.isArray(src.zones) ? src.zones : [];
  const objects = Array.isArray(src.objects) ? src.objects : [];
  const openings = Array.isArray(src.openings) ? src.openings : [];
  const counts = new Map();
  for (let fl = MIN_FLOOR; fl <= MAX_FLOOR; fl++) {
    counts.set(fl, 0);
  }
  const inc = (fl) => {
    const clamped = clampFloor(fl);
    counts.set(clamped, (counts.get(clamped) || 0) + 1);
  };
  for (const w of walls) {
    if (w) inc(w.floor ?? 0);
  }
  for (const z of zones) {
    if (z) inc(z.floor ?? 0);
  }
  for (const o of objects) {
    if (!o) continue;
    const fl = clampFloor(o.floor ?? 0);
    inc(fl);
    const cat = getCatalogItem(o.type);
    if (cat?.isStair) {
      const tfl = clampFloor(o.targetFloor ?? fl + 1);
      if (tfl !== fl) inc(tfl);
    }
  }
  for (const op of openings) {
    if (op) inc(op.floor ?? 0);
  }
  const out = [];
  for (let fl = MIN_FLOOR; fl <= MAX_FLOOR; fl++) {
    const itemCount = counts.get(fl) || 0;
    out.push({
      floor: fl,
      label: formatFloorLabel(fl),
      shortLabel: formatFloorShortLabel(fl),
      itemCount,
      hasContent: itemCount > 0
    });
  }
  return out;
}

export function worldToScreen(wx, wz, view = {}) {
  const cx = Number(view.centerX) || 0;
  const cz = Number(view.centerZ) || 0;
  const scale = Math.max(0.0001, Number(view.pxPerMeter) || 1);
  const w = Number(view.width) || 0;
  const h = Number(view.height) || 0;
  return {
    x: w * 0.5 + (Number(wx) - cx) * scale,
    y: h * 0.5 + (Number(wz) - cz) * scale
  };
}

export function screenToWorld(sx, sy, view = {}) {
  const cx = Number(view.centerX) || 0;
  const cz = Number(view.centerZ) || 0;
  const scale = Math.max(0.0001, Number(view.pxPerMeter) || 1);
  const w = Number(view.width) || 0;
  const h = Number(view.height) || 0;
  return {
    x: cx + (Number(sx) - w * 0.5) / scale,
    z: cz + (Number(sy) - h * 0.5) / scale
  };
}

export function clampZoomScale(pxPerMeter, bounds = {}, width = 640, height = 420) {
  const bw =
    Number(bounds?.width) ||
    Math.abs((Number(bounds?.maxX) || 0) - (Number(bounds?.minX) || 0)) ||
    26;
  const bd =
    Number(bounds?.depth) ||
    Math.abs((Number(bounds?.maxZ) || 0) - (Number(bounds?.minZ) || 0)) ||
    24.4;
  const w = Math.max(1, Number(width) || 640);
  const h = Math.max(1, Number(height) || 420);
  const minScale = Math.max(0.16, Math.min(w, h) / Math.max(20, Math.max(bw, bd) * 1.12));
  const maxScale = 80;
  const val = Number(pxPerMeter);
  if (!Number.isFinite(val)) return Math.min(maxScale, minScale);
  return Math.min(maxScale, Math.max(minScale, val));
}

export function extractMapEntities(mapData, floor = 0) {
  const fl = clampFloor(floor);
  const src = mapData && typeof mapData === 'object' ? mapData : createDefaultMap();
  const rawZones = Array.isArray(src.zones) ? src.zones : [];
  const rawWalls = Array.isArray(src.walls) ? src.walls : [];
  const rawObjects = Array.isArray(src.objects) ? src.objects : [];

  const zones = [];
  for (const z of rawZones) {
    if (!z || clampFloor(z.floor ?? 0) !== fl) continue;
    const pts = getZonePolygonPoints(z);
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    zones.push({
      ...z,
      floor: fl,
      points: pts,
      minX,
      maxX,
      minZ,
      maxZ
    });
  }

  const floorWalls = rawWalls.filter((w) => w && clampFloor(w.floor ?? 0) === fl);
  const walls = subtractDoorsFromWalls(floorWalls).map((seg) => ({
    ...seg,
    floor: fl,
    minX: Math.min(Number(seg.x1) || 0, Number(seg.x2) || 0),
    maxX: Math.max(Number(seg.x1) || 0, Number(seg.x2) || 0),
    minZ: Math.min(Number(seg.z1) || 0, Number(seg.z2) || 0),
    maxZ: Math.max(Number(seg.z1) || 0, Number(seg.z2) || 0)
  }));

  const stairs = [];
  const teachers = [];
  const tpStations = [];
  const specialDoors = [];

  for (const obj of rawObjects) {
    if (!obj || typeof obj !== 'object') continue;
    const cat = getCatalogItem(obj.type);
    const objFloor = clampFloor(obj.floor ?? 0);
    const isStair = Boolean(cat?.isStair);
    const targetFloor = isStair ? clampFloor(obj.targetFloor ?? objFloor + 1) : objFloor;
    const touchesFloor = objFloor === fl || (isStair && targetFloor === fl);
    if (!touchesFloor) continue;

    if (isStair) {
      stairs.push({
        ...obj,
        floor: objFloor,
        targetFloor,
        isArrival: objFloor !== fl && targetFloor === fl
      });
      continue;
    }

    if (obj.type === 'npc_teacher') {
      teachers.push({
        ...obj,
        floor: objFloor,
        label: obj.label || 'Professeur CIEL'
      });
      continue;
    }

    if (obj.type === 'combat_door' || obj.type === 'survival_door') {
      specialDoors.push({
        ...obj,
        floor: objFloor,
        kind: obj.type
      });
      continue;
    }

    if (cat?.tpId) {
      const meta = STATION_META.get(cat.tpId) || null;
      tpStations.push({
        ...obj,
        floor: objFloor,
        tpId: cat.tpId,
        icon: meta?.icon || cat.icon || '🖥️',
        title: meta?.title || obj.label || cat.shortLabel || cat.tpId,
        shortTitle: meta?.shortTitle || obj.label || cat.shortLabel || cat.tpId,
        room: meta?.room || '',
        color: obj.color || meta?.color || cat.defaultColor || '#38bdf8'
      });
    }
  }

  return {
    floor: fl,
    zones,
    walls,
    stairs,
    teachers,
    tpStations,
    specialDoors
  };
}

export function computeWaypointNavigation(playerPos, playerFloor = 0, waypoint = null) {
  if (!waypoint || !playerPos) return null;
  const px = Number(playerPos.x);
  const pz = Number(playerPos.z);
  const wx = Number(waypoint.x);
  const wz = Number(waypoint.z);
  if (
    !Number.isFinite(px) ||
    !Number.isFinite(pz) ||
    !Number.isFinite(wx) ||
    !Number.isFinite(wz)
  ) {
    return null;
  }
  const dx = wx - px;
  const dz = wz - pz;
  const distanceMeters = Math.hypot(dx, dz);
  const pFloor = clampFloor(playerFloor ?? 0);
  const wFloor = clampFloor(waypoint.floor ?? pFloor);
  const deltaFloor = wFloor - pFloor;
  const bearingRad = Math.atan2(dz, dx);
  const floorInstruction =
    deltaFloor > 0
      ? `Monter ${deltaFloor} étage${deltaFloor > 1 ? 's' : ''} (${formatFloorShortLabel(wFloor)})`
      : deltaFloor < 0
        ? `Descendre ${Math.abs(deltaFloor)} étage${Math.abs(deltaFloor) > 1 ? 's' : ''} (${formatFloorShortLabel(wFloor)})`
        : 'Même étage';
  return {
    distanceMeters,
    deltaFloor,
    bearingRad,
    floorInstruction
  };
}

export class CampusMapApp {
  constructor(options = {}) {
    this.mapData = normalizeMapData(options.mapData || createDefaultMap());
    this.waypoint = options.initialWaypoint
      ? {
          x: Number(options.initialWaypoint.x) || 0,
          z: Number(options.initialWaypoint.z) || 0,
          floor: clampFloor(options.initialWaypoint.floor ?? 0),
          label: String(options.initialWaypoint.label || 'Repère')
        }
      : null;
    this.onWaypointChange = options.onWaypointChange || null;
    this.onSelectTp = options.onSelectTp || null;

    this.selectedFloor = 0;
    this.followPlayerFloor = true;
    this.liveState = {
      playerPos: null,
      playerYaw: 0,
      playerFloor: 0,
      currentZone: null,
      peers: [],
      teacherPos: null
    };
    this.view = {
      centerX: 0,
      centerZ: 0,
      pxPerMeter: 16,
      width: 640,
      height: 420
    };
    this._dpr = 1;
    this._hasInitialFit = false;
    this._entityCache = new Map();
    this._pointers = new Map();
    this._dragMoved = 0;
    this._wasPinching = false;

    this.containerEl = null;
    this.canvasEl = null;
    this.ctx = null;
    this._resizeObserver = null;
    this._cleanupFns = [];
  }

  _getEntitiesForFloor(floor) {
    const fl = clampFloor(floor);
    if (!this._entityCache.has(fl)) {
      this._entityCache.set(fl, extractMapEntities(this.mapData, fl));
    }
    return this._entityCache.get(fl);
  }

  _collectAllPois() {
    const pois = [];
    for (const obj of this.mapData.objects || []) {
      if (!obj || typeof obj !== 'object') continue;
      const cat = getCatalogItem(obj.type);
      const fl = clampFloor(obj.floor ?? 0);
      if (obj.type === 'npc_teacher') {
        pois.push({
          id: obj.id || 'teacher',
          kind: 'teacher',
          icon: '👨‍🏫',
          label: 'Professeur CIEL',
          floor: fl,
          x: Number(obj.x) || 0,
          z: Number(obj.z) || 0,
          color: '#fbbf24',
          tpId: null
        });
      } else if (cat?.tpId) {
        const meta = STATION_META.get(cat.tpId) || null;
        pois.push({
          id: obj.id || cat.tpId,
          kind: 'tp',
          icon: meta?.icon || cat.icon || '🖥️',
          label: meta?.shortTitle || obj.label || cat.shortLabel || cat.tpId,
          room: meta?.room || '',
          floor: fl,
          x: Number(obj.x) || 0,
          z: Number(obj.z) || 0,
          color: obj.color || meta?.color || cat.defaultColor || '#38bdf8',
          tpId: cat.tpId
        });
      }
    }
    pois.sort((a, b) => {
      if (a.kind === 'teacher' && b.kind !== 'teacher') return -1;
      if (b.kind === 'teacher' && a.kind !== 'teacher') return 1;
      return a.floor - b.floor;
    });
    return pois;
  }

  _clampViewCenter() {
    const b = this.mapData?.bounds || { minX: -13, maxX: 13, minZ: -12.2, maxZ: 12.2 };
    const padX = Math.max(8, (b.width || 26) * 0.2);
    const padZ = Math.max(8, (b.depth || 24.4) * 0.2);
    this.view.centerX = Math.max(b.minX - padX, Math.min(b.maxX + padX, this.view.centerX));
    this.view.centerZ = Math.max(b.minZ - padZ, Math.min(b.maxZ + padZ, this.view.centerZ));
  }

  _syncCanvasSize() {
    if (!this.canvasEl) return;
    const wrap = this.canvasEl.parentElement;
    const cssW = Math.max(240, wrap?.clientWidth || this.canvasEl.clientWidth || 640);
    const cssH = Math.max(240, wrap?.clientHeight || this.canvasEl.clientHeight || 420);
    const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
    const targetW = Math.round(cssW * dpr);
    const targetH = Math.round(cssH * dpr);
    if (this.canvasEl.width !== targetW || this.canvasEl.height !== targetH) {
      this.canvasEl.width = targetW;
      this.canvasEl.height = targetH;
    }
    this._dpr = dpr;
    this.view.width = cssW;
    this.view.height = cssH;
    if (!this._hasInitialFit) {
      this._hasInitialFit = true;
      this.fitCampusView({ skipRender: true });
    } else {
      this.view.pxPerMeter = clampZoomScale(
        this.view.pxPerMeter,
        this.mapData.bounds,
        this.view.width,
        this.view.height
      );
    }
  }

  _syncFloorStripUi() {
    if (!this.containerEl) return;
    const pFloor = clampFloor(this.liveState.playerFloor ?? 0);
    this.containerEl.querySelectorAll('.cmap-floor-btn').forEach((btn) => {
      const fl = Number(btn.dataset.floor);
      btn.classList.toggle('active', fl === this.selectedFloor);
      btn.classList.toggle('is-player-floor', fl === pFloor);
    });
    const followBtn = this.containerEl.querySelector('#cmap-btn-follow');
    if (followBtn) {
      followBtn.classList.toggle('active', this.followPlayerFloor);
      followBtn.style.borderColor = this.followPlayerFloor ? '#34d399' : '';
      followBtn.style.color = this.followPlayerFloor ? '#6ee7b7' : '';
    }
  }

  _syncWaypointCardUi() {
    if (!this.containerEl) return;
    const card = this.containerEl.querySelector('#cmap-wp-card');
    if (!card) return;
    if (!this.waypoint) {
      card.innerHTML = `
        <strong>📍 Repère GPS</strong>
        <span>Cliquez sur le plan ou un point d’intérêt pour placer un repère.</span>
      `;
      return;
    }
    const nav = computeWaypointNavigation(
      this.liveState.playerPos,
      this.liveState.playerFloor,
      this.waypoint
    );
    const distLine = nav
      ? `${Math.round(nav.distanceMeters)} m • ${escapeHtml(nav.floorInstruction)}`
      : `${escapeHtml(formatFloorLabel(this.waypoint.floor))}`;
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <strong>📍 ${escapeHtml(this.waypoint.label || 'Repère')}</strong>
        <button type="button" id="cmap-wp-clear" class="cmap-tool-btn" style="min-height:26px;padding:2px 8px;">✕ Effacer</button>
      </div>
      <span>${escapeHtml(formatFloorShortLabel(this.waypoint.floor))} • ${distLine}</span>
    `;
    const clearBtn = card.querySelector('#cmap-wp-clear');
    clearBtn?.addEventListener('click', () => this.clearWaypoint());
  }

  _autoNameWaypoint(wx, wz, floor) {
    const ents = this._getEntitiesForFloor(floor);
    const threshold = Math.max(2.2, 16 / Math.max(0.5, this.view.pxPerMeter));
    let bestLabel = '';
    let bestDist = threshold;

    const teacherPos =
      this.liveState.teacherPos && clampFloor(floor) === 0
        ? this.liveState.teacherPos
        : ents.teachers[0];
    if (teacherPos) {
      const td = Math.hypot(wx - Number(teacherPos.x), wz - Number(teacherPos.z));
      if (td <= bestDist) {
        bestDist = td;
        bestLabel = '👨‍🏫 Professeur CIEL';
      }
    }
    for (const tp of ents.tpStations) {
      const d = Math.hypot(wx - Number(tp.x), wz - Number(tp.z));
      if (d <= bestDist) {
        bestDist = d;
        bestLabel = `${tp.icon} ${tp.shortTitle}`;
      }
    }
    if (bestLabel) return bestLabel;

    const zone = getZoneAtPositionInMap(this.mapData, wx, wz, floor);
    const matchesRealZone = (this.mapData.zones || []).some(
      (z) => z.id === zone?.id && clampFloor(z.floor ?? 0) === clampFloor(floor)
    );
    if (matchesRealZone && zone) {
      return `${zone.code} - ${zone.shortName}`;
    }
    return `Repère ${formatFloorShortLabel(floor)} (${wx.toFixed(0)}m, ${wz.toFixed(0)}m)`;
  }

  mount(containerEl) {
    this.unmount();
    this.containerEl = containerEl;
    if (!containerEl) return;

    const floors = getAvailableFloors(this.mapData);
    const pois = this._collectAllPois();

    const floorButtonsHtml = floors
      .map(
        (f) =>
          `<button type="button" class="cmap-floor-btn ${f.floor === this.selectedFloor ? 'active' : ''} ${f.hasContent ? 'has-content' : ''}" data-floor="${f.floor}" title="${escapeHtml(f.label)} (${f.itemCount} éléments)">${escapeHtml(f.shortLabel)}</button>`
      )
      .join('');

    const poisHtml =
      pois.length === 0
        ? '<span style="font-size:0.78rem;color:#94a3b8;">Aucun point d’intérêt sur cette carte.</span>'
        : pois
            .map(
              (p, idx) =>
                `<button type="button" class="cmap-poi-btn" data-poi-idx="${idx}">
                  <span>${p.icon} ${escapeHtml(p.label)}</span>
                  <small style="float:right;color:#7dd3fc;">${escapeHtml(formatFloorShortLabel(p.floor))}</small>
                </button>`
            )
            .join('');

    containerEl.innerHTML = `
      <div class="cmap-app">
        <div class="cmap-toolbar">
          <div class="cmap-floor-strip">${floorButtonsHtml}</div>
          <div class="cmap-actions" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
            <button type="button" id="cmap-btn-follow" class="cmap-tool-btn">Suivre mon étage</button>
            <button type="button" id="cmap-btn-zoom-in" class="cmap-tool-btn" title="Zoomer">+</button>
            <button type="button" id="cmap-btn-zoom-out" class="cmap-tool-btn" title="Dézoomer">−</button>
            <button type="button" id="cmap-btn-center" class="cmap-tool-btn">Centrer</button>
            <button type="button" id="cmap-btn-fit" class="cmap-tool-btn">Vue campus</button>
          </div>
        </div>
        <div class="cmap-main-split">
          <div class="cmap-canvas-wrap">
            <canvas class="cmap-canvas"></canvas>
          </div>
          <aside class="cmap-sidebar">
            <div id="cmap-wp-card" class="cmap-wp-card"></div>
            <div class="cmap-legend" style="font-size:0.74rem;color:#cbd5e1;display:grid;grid-template-columns:1fr 1fr;gap:4px;">
              <span>🔹 Joueur</span>
              <span>👨‍🏫 Prof. CIEL</span>
              <span>🟣 Bornes TP</span>
              <span>🟢 Camarades</span>
              <span>🪜 Escaliers</span>
              <span>📍 Repère</span>
            </div>
            <div class="cmap-poi-list">${poisHtml}</div>
          </aside>
        </div>
      </div>
    `;

    this.canvasEl = containerEl.querySelector('.cmap-canvas');
    this.ctx = this.canvasEl?.getContext?.('2d') || null;
    this._hasInitialFit = false;
    this._syncCanvasSize();
    this._syncFloorStripUi();
    this._syncWaypointCardUi();

    containerEl.querySelectorAll('.cmap-floor-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const fl = Number(btn.dataset.floor);
        this.followPlayerFloor = false;
        this.setFloor(fl);
      });
    });

    containerEl.querySelector('#cmap-btn-follow')?.addEventListener('click', () => {
      this.followPlayerFloor = !this.followPlayerFloor;
      if (this.followPlayerFloor && this.liveState.playerFloor !== undefined) {
        this.setFloor(this.liveState.playerFloor);
      } else {
        this._syncFloorStripUi();
      }
    });

    containerEl.querySelector('#cmap-btn-zoom-in')?.addEventListener('click', () => {
      this.view.pxPerMeter = clampZoomScale(
        this.view.pxPerMeter * 1.35,
        this.mapData.bounds,
        this.view.width,
        this.view.height
      );
      this.render();
    });

    containerEl.querySelector('#cmap-btn-zoom-out')?.addEventListener('click', () => {
      this.view.pxPerMeter = clampZoomScale(
        this.view.pxPerMeter / 1.35,
        this.mapData.bounds,
        this.view.width,
        this.view.height
      );
      this.render();
    });

    containerEl.querySelector('#cmap-btn-center')?.addEventListener('click', () => {
      this.centerOnPlayer();
    });

    containerEl.querySelector('#cmap-btn-fit')?.addEventListener('click', () => {
      this.fitCampusView();
    });

    containerEl.querySelectorAll('.cmap-poi-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.poiIdx);
        const poi = pois[idx];
        if (!poi) return;
        this.followPlayerFloor = false;
        this.selectedFloor = clampFloor(poi.floor);
        this.view.centerX = poi.x;
        this.view.centerZ = poi.z;
        this.view.pxPerMeter = clampZoomScale(
          Math.max(this.view.pxPerMeter, 18),
          this.mapData.bounds,
          this.view.width,
          this.view.height
        );
        this.setWaypoint({
          x: poi.x,
          z: poi.z,
          floor: poi.floor,
          label: `${poi.icon} ${poi.label}`
        });
        this._syncFloorStripUi();
        if (poi.tpId) {
          this.onSelectTp?.(poi.tpId);
        }
      });
    });

    this._bindCanvasInteractions();
    this.render();
  }

  _bindCanvasInteractions() {
    if (!this.canvasEl) return;
    const canvas = this.canvasEl;

    const getLocalPos = (ev) => {
      const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
      return {
        x: (ev.clientX ?? 0) - rect.left,
        y: (ev.clientY ?? 0) - rect.top
      };
    };

    const onPointerDown = (e) => {
      const pos = getLocalPos(e);
      if (this._pointers.size === 0) {
        this._dragMoved = 0;
        this._wasPinching = false;
      }
      this._pointers.set(e.pointerId ?? 0, pos);
      if (this._pointers.size >= 2) {
        this._wasPinching = true;
      }
      canvas.style.cursor = 'grabbing';
      try {
        canvas.setPointerCapture?.(e.pointerId);
      } catch {}
    };

    const onPointerMove = (e) => {
      const pid = e.pointerId ?? 0;
      if (!this._pointers.has(pid)) return;
      const cur = getLocalPos(e);
      if (this._pointers.size >= 2) {
        const entries = [...this._pointers.entries()];
        const [idA, oldA] = entries[0];
        const [idB, oldB] = entries[1];
        this._pointers.set(pid, cur);
        const newA = pid === idA ? cur : oldA;
        const newB = pid === idB ? cur : oldB;
        const oldDist = Math.hypot(oldA.x - oldB.x, oldA.y - oldB.y);
        const newDist = Math.hypot(newA.x - newB.x, newA.y - newB.y);
        if (oldDist > 4 && newDist > 4) {
          const oldMidX = (oldA.x + oldB.x) * 0.5;
          const oldMidY = (oldA.y + oldB.y) * 0.5;
          const newMidX = (newA.x + newB.x) * 0.5;
          const newMidY = (newA.y + newB.y) * 0.5;
          const before = screenToWorld(oldMidX, oldMidY, this.view);
          const nextScale = clampZoomScale(
            this.view.pxPerMeter * (newDist / oldDist),
            this.mapData.bounds,
            this.view.width,
            this.view.height
          );
          this.view.pxPerMeter = nextScale;
          this.view.centerX = before.x - (newMidX - this.view.width * 0.5) / nextScale;
          this.view.centerZ = before.z - (newMidY - this.view.height * 0.5) / nextScale;
          this._clampViewCenter();
          this._dragMoved = 999;
          this.render();
        }
        return;
      }

      const prev = this._pointers.get(pid);
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      this._dragMoved += Math.hypot(dx, dy);
      this.view.centerX -= dx / Math.max(0.0001, this.view.pxPerMeter);
      this.view.centerZ -= dy / Math.max(0.0001, this.view.pxPerMeter);
      this._clampViewCenter();
      this._pointers.set(pid, cur);
      this.render();
    };

    const onPointerUp = (e) => {
      const pid = e.pointerId ?? 0;
      const isSingleTap =
        e.type === 'pointerup' &&
        this._pointers.size === 1 &&
        !this._wasPinching &&
        this._dragMoved < 6 &&
        (e.button === undefined || e.button === 0);
      if (isSingleTap) {
        const pos = getLocalPos(e);
        const worldPt = screenToWorld(pos.x, pos.y, this.view);
        const b = this.mapData.bounds;
        const wx = Math.max(b.minX, Math.min(b.maxX, worldPt.x));
        const wz = Math.max(b.minZ, Math.min(b.maxZ, worldPt.z));
        const label = this._autoNameWaypoint(wx, wz, this.selectedFloor);
        this.setWaypoint({
          x: Number(wx.toFixed(2)),
          z: Number(wz.toFixed(2)),
          floor: this.selectedFloor,
          label
        });
      }
      this._pointers.delete(pid);
      if (this._pointers.size === 0) {
        this._wasPinching = false;
        this._dragMoved = 0;
        canvas.style.cursor = 'grab';
      }
    };

    const onWheel = (e) => {
      e.preventDefault();
      const pos = getLocalPos(e);
      const before = screenToWorld(pos.x, pos.y, this.view);
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const nextScale = clampZoomScale(
        this.view.pxPerMeter * factor,
        this.mapData.bounds,
        this.view.width,
        this.view.height
      );
      this.view.pxPerMeter = nextScale;
      this.view.centerX = before.x - (pos.x - this.view.width * 0.5) / nextScale;
      this.view.centerZ = before.z - (pos.y - this.view.height * 0.5) / nextScale;
      this._clampViewCenter();
      this.render();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    this._cleanupFns.push(() => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
    });

    if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
      this._resizeObserver = new ResizeObserver(() => {
        this._syncCanvasSize();
        this.render();
      });
      this._resizeObserver.observe(canvas.parentElement);
    } else if (typeof window !== 'undefined') {
      const onResize = () => {
        this._syncCanvasSize();
        this.render();
      };
      window.addEventListener('resize', onResize);
      this._cleanupFns.push(() => window.removeEventListener('resize', onResize));
    }
  }

  unmount() {
    for (const fn of this._cleanupFns) {
      fn();
    }
    this._cleanupFns = [];
    this._resizeObserver?.disconnect?.();
    this._resizeObserver = null;
    this._pointers.clear();
    this.containerEl = null;
    this.canvasEl = null;
    this.ctx = null;
  }

  setMapData(mapData) {
    const prevW = this.mapData?.bounds?.width || 26;
    const prevD = this.mapData?.bounds?.depth || 24.4;
    this.mapData = normalizeMapData(mapData || createDefaultMap());
    this._entityCache.clear();
    const nextW = this.mapData.bounds.width;
    const nextD = this.mapData.bounds.depth;
    if (Math.abs(nextW - prevW) > 1 || Math.abs(nextD - prevD) > 1) {
      this._hasInitialFit = false;
    }
    if (this.containerEl) {
      const curContainer = this.containerEl;
      this.mount(curContainer);
    } else {
      this.fitCampusView({ skipRender: true });
    }
  }

  updateLive({ playerPos, playerYaw, playerFloor, currentZone, peers, teacherPos } = {}) {
    if (playerPos !== undefined) {
      this.liveState.playerPos = playerPos
        ? { x: Number(playerPos.x) || 0, z: Number(playerPos.z) || 0 }
        : null;
    }
    if (typeof playerYaw === 'number' && Number.isFinite(playerYaw)) {
      this.liveState.playerYaw = playerYaw;
    }
    if (playerFloor !== undefined && playerFloor !== null) {
      this.liveState.playerFloor = clampFloor(playerFloor);
      if (this.followPlayerFloor && this.selectedFloor !== this.liveState.playerFloor) {
        this.selectedFloor = this.liveState.playerFloor;
        this._syncFloorStripUi();
      }
    }
    if (currentZone !== undefined) {
      this.liveState.currentZone = currentZone;
    }
    if (Array.isArray(peers)) {
      this.liveState.peers = peers;
    }
    if (teacherPos !== undefined) {
      this.liveState.teacherPos = teacherPos;
    }
    this._syncFloorStripUi();
    this._syncWaypointCardUi();
    this.render();
  }

  setFloor(floor) {
    this.selectedFloor = clampFloor(floor);
    this._syncFloorStripUi();
    this.render();
  }

  fitCampusView(opts = {}) {
    const b = this.mapData?.bounds || { minX: -13, maxX: 13, minZ: -12.2, maxZ: 12.2, width: 26, depth: 24.4 };
    this.view.centerX = (b.minX + b.maxX) * 0.5;
    this.view.centerZ = (b.minZ + b.maxZ) * 0.5;
    const fitScale =
      Math.min(this.view.width, this.view.height) /
      Math.max(20, Math.max(b.width, b.depth) * 1.12);
    this.view.pxPerMeter = clampZoomScale(fitScale, b, this.view.width, this.view.height);
    if (!opts?.skipRender) {
      this.render();
    }
  }

  centerOnPlayer() {
    if (this.liveState.playerPos) {
      this.view.centerX = this.liveState.playerPos.x;
      this.view.centerZ = this.liveState.playerPos.z;
      this.selectedFloor = clampFloor(this.liveState.playerFloor ?? this.selectedFloor);
      this.view.pxPerMeter = clampZoomScale(
        Math.max(this.view.pxPerMeter, 14),
        this.mapData.bounds,
        this.view.width,
        this.view.height
      );
      this._syncFloorStripUi();
      this.render();
      return;
    }
    this.fitCampusView();
  }

  setWaypoint(wp) {
    if (!wp || !Number.isFinite(Number(wp.x)) || !Number.isFinite(Number(wp.z))) {
      this.clearWaypoint();
      return null;
    }
    this.waypoint = {
      x: Number(wp.x),
      z: Number(wp.z),
      floor: clampFloor(wp.floor ?? this.selectedFloor),
      label: String(wp.label || 'Repère')
    };
    this._syncWaypointCardUi();
    this.onWaypointChange?.({ ...this.waypoint });
    this.render();
    return { ...this.waypoint };
  }

  clearWaypoint() {
    this.waypoint = null;
    this._syncWaypointCardUi();
    this.onWaypointChange?.(null);
    this.render();
  }

  getWaypoint() {
    return this.waypoint ? { ...this.waypoint } : null;
  }

  render() {
    const ctx = this.ctx;
    if (!ctx || !this.canvasEl) return;

    const w = this.view.width;
    const h = this.view.height;
    const dpr = this._dpr || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#040915';
    ctx.fillRect(0, 0, w, h);

    const scale = Math.max(0.16, this.view.pxPerMeter);
    const halfWorldW = (w * 0.5) / scale;
    const halfWorldH = (h * 0.5) / scale;
    const cullPad = 12 / scale;
    const visMinX = this.view.centerX - halfWorldW - cullPad;
    const visMaxX = this.view.centerX + halfWorldW + cullPad;
    const visMinZ = this.view.centerZ - halfWorldH - cullPad;
    const visMaxZ = this.view.centerZ + halfWorldH + cullPad;

    const gridSteps = [1, 2, 5, 10, 25, 50, 100, 250, 500];
    let stepM = 1;
    for (const s of gridSteps) {
      if (s * scale >= 32) {
        stepM = s;
        break;
      }
      stepM = s;
    }
    const b = this.mapData.bounds;
    const gStartX = Math.floor(Math.max(b.minX, visMinX) / stepM) * stepM;
    const gEndX = Math.ceil(Math.min(b.maxX, visMaxX) / stepM) * stepM;
    const gStartZ = Math.floor(Math.max(b.minZ, visMinZ) / stepM) * stepM;
    const gEndZ = Math.ceil(Math.min(b.maxZ, visMaxZ) / stepM) * stepM;

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = gStartX; gx <= gEndX; gx += stepM) {
      const p1 = worldToScreen(gx, Math.max(b.minZ, visMinZ), this.view);
      const p2 = worldToScreen(gx, Math.min(b.maxZ, visMaxZ), this.view);
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
    }
    for (let gz = gStartZ; gz <= gEndZ; gz += stepM) {
      const p1 = worldToScreen(Math.max(b.minX, visMinX), gz, this.view);
      const p2 = worldToScreen(Math.min(b.maxX, visMaxX), gz, this.view);
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
    }
    ctx.stroke();

    const tl = worldToScreen(b.minX, b.minZ, this.view);
    const br = worldToScreen(b.maxX, b.maxZ, this.view);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

    const ents = this._getEntitiesForFloor(this.selectedFloor);

    for (const z of ents.zones) {
      if (z.maxX < visMinX || z.minX > visMaxX || z.maxZ < visMinZ || z.minZ > visMaxZ) continue;
      if (z.code === 'U300' && !Array.isArray(z.points)) continue;
      const pts = z.points;
      if (!pts || pts.length < 3) continue;
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const sp = worldToScreen(pts[i].x, pts[i].z, this.view);
        if (i === 0) ctx.moveTo(sp.x, sp.y);
        else ctx.lineTo(sp.x, sp.y);
      }
      ctx.closePath();
      ctx.fillStyle = `${z.color || '#38bdf8'}20`;
      ctx.fill();
      ctx.strokeStyle = `${z.color || '#38bdf8'}66`;
      ctx.lineWidth = 1;
      ctx.stroke();

      const sw = (z.maxX - z.minX) * scale;
      const sh = (z.maxZ - z.minZ) * scale;
      if (sw >= 28 && sh >= 18) {
        const center = worldToScreen(z.x, z.z, this.view);
        ctx.fillStyle = '#e2e8f0';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${Math.min(13, Math.max(9, Math.round(sw * 0.14)))}px system-ui, sans-serif`;
        ctx.fillText(z.code || '', center.x, center.y - (sh >= 42 ? 6 : 0));
        if (sh >= 42 && sw >= 64 && z.shortName) {
          ctx.fillStyle = '#94a3b8';
          ctx.font = '10px system-ui, sans-serif';
          ctx.fillText(z.shortName, center.x, center.y + 8);
        }
      }
    }

    ctx.lineCap = 'round';
    for (const seg of ents.walls) {
      if (seg.maxX < visMinX || seg.minX > visMaxX || seg.maxZ < visMinZ || seg.minZ > visMaxZ) {
        continue;
      }
      const p1 = worldToScreen(seg.x1, seg.z1, this.view);
      const p2 = worldToScreen(seg.x2, seg.z2, this.view);
      const isDoor = seg.kind === 'door_single' || seg.kind === 'door_double';
      const isGlazed = seg.kind === 'glazed' || seg.kind === 'window_bay';
      if (isDoor) {
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = Math.max(1.5, Math.min(3.5, scale * 0.14));
        ctx.setLineDash([4, 3]);
      } else if (seg.kind === 'railing') {
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = Math.max(1.2, Math.min(3, scale * 0.12));
        ctx.setLineDash([3, 3]);
      } else {
        ctx.setLineDash([]);
        ctx.strokeStyle = isGlazed ? '#38bdf8' : seg.kind === 'exterior' ? '#cbd5e1' : '#94a3b8';
        ctx.lineWidth = Math.max(1.4, Math.min(6, (seg.thickness || 0.18) * scale));
      }
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    for (const st of ents.stairs) {
      const r = Math.max(st.w || 2, st.d || 2) * 0.6;
      if (st.x + r < visMinX || st.x - r > visMaxX || st.z + r < visMinZ || st.z - r > visMaxZ) {
        continue;
      }
      const sp = worldToScreen(st.x, st.z, this.view);
      ctx.fillStyle = st.isArrival ? 'rgba(245, 158, 11, 0.32)' : 'rgba(245, 158, 11, 0.72)';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(sp.x - 10, sp.y - 10, 20, 20, 5) : ctx.rect(sp.x - 10, sp.y - 10, 20, 20);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = '#fef3c7';
      ctx.fillText('🪜', sp.x, sp.y + 0.5);
      if (scale >= 6) {
        const dest = st.isArrival ? st.floor : st.targetFloor;
        ctx.font = 'bold 9px system-ui, sans-serif';
        ctx.fillStyle = '#fde68a';
        ctx.fillText(`→${formatFloorShortLabel(dest)}`, sp.x, sp.y + 17);
      }
    }

    for (const door of ents.specialDoors) {
      if (door.x + 1.5 < visMinX || door.x - 1.5 > visMaxX || door.z + 1.5 < visMinZ || door.z - 1.5 > visMaxZ) {
        continue;
      }
      const sp = worldToScreen(door.x, door.z, this.view);
      const isCombat = door.kind === 'combat_door';
      ctx.fillStyle = isCombat ? '#0891b2' : '#be123c';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(isCombat ? '⚔️' : '🚪', sp.x, sp.y + 0.5);
    }

    for (const tp of ents.tpStations) {
      const r = Math.max(tp.w || 1.5, tp.d || 1.5) * 0.6;
      if (tp.x + r < visMinX || tp.x - r > visMaxX || tp.z + r < visMinZ || tp.z - r > visMaxZ) {
        continue;
      }
      const sp = worldToScreen(tp.x, tp.z, this.view);
      ctx.fillStyle = tp.color || '#38bdf8';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, scale >= 6 ? 7 : 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (scale >= 5) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(tp.shortTitle, sp.x, sp.y + 9);
      }
    }

    const activeTeachers =
      this.liveState.teacherPos && this.selectedFloor === 0
        ? [
            {
              x: Number(this.liveState.teacherPos.x) || 0,
              z: Number(this.liveState.teacherPos.z) || 0,
              label: 'Professeur CIEL'
            }
          ]
        : ents.teachers;
    for (const t of activeTeachers) {
      if (t.x + 1.5 < visMinX || t.x - 1.5 > visMaxX || t.z + 1.5 < visMinZ || t.z - 1.5 > visMaxZ) {
        continue;
      }
      const sp = worldToScreen(t.x, t.z, this.view);
      ctx.fillStyle = '#fbbf24';
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.fillText('👨‍🏫', sp.x, sp.y + 0.5);
      if (scale >= 4) {
        ctx.textBaseline = 'top';
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.fillStyle = '#fde68a';
        ctx.fillText('Professeur CIEL', sp.x, sp.y + 11);
      }
    }

    for (const peer of this.liveState.peers || []) {
      const px = Number(peer.x);
      const pz = Number(peer.z);
      if (!Number.isFinite(px) || !Number.isFinite(pz)) continue;
      if (px + 2 < visMinX || px - 2 > visMaxX || pz + 2 < visMinZ || pz - 2 > visMaxZ) continue;
      const pFloor = clampFloor(peer.floor ?? 0);
      const sameFloor = pFloor === this.selectedFloor;
      const sp = worldToScreen(px, pz, this.view);
      ctx.save();
      ctx.globalAlpha = sameFloor ? 1 : 0.45;
      ctx.fillStyle = peer.color || '#34d399';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sameFloor ? 5.5 : 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.fillStyle = '#e2e8f0';
      const badge = sameFloor ? '' : ` [${formatFloorShortLabel(pFloor)}]`;
      ctx.fillText(`${String(peer.name || 'Élève').slice(0, 14)}${badge}`, sp.x, sp.y - 7);
      ctx.restore();
    }

    if (this.waypoint) {
      const wpPos = worldToScreen(this.waypoint.x, this.waypoint.z, this.view);
      const wpSameFloor = clampFloor(this.waypoint.floor) === this.selectedFloor;
      if (this.liveState.playerPos) {
        const plPos = worldToScreen(this.liveState.playerPos.x, this.liveState.playerPos.z, this.view);
        ctx.save();
        ctx.setLineDash([6, 5]);
        ctx.strokeStyle = wpSameFloor ? '#f472b6' : 'rgba(244, 114, 182, 0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(plPos.x, plPos.y);
        ctx.lineTo(wpPos.x, wpPos.y);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha = wpSameFloor ? 1 : 0.6;
      ctx.fillStyle = 'rgba(236, 72, 153, 0.25)';
      ctx.beginPath();
      ctx.arc(wpPos.x, wpPos.y, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ec4899';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wpPos.x, wpPos.y);
      ctx.lineTo(wpPos.x - 6, wpPos.y - 13);
      ctx.arc(wpPos.x, wpPos.y - 14, 6, Math.PI, 0, false);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.fillStyle = '#fbcfe8';
      const flSuffix = wpSameFloor ? '' : ` (${formatFloorShortLabel(this.waypoint.floor)})`;
      ctx.fillText(`${this.waypoint.label || 'Repère'}${flSuffix}`, wpPos.x, wpPos.y + 6);
      ctx.restore();
    }

    if (this.liveState.playerPos) {
      const plFloor = clampFloor(this.liveState.playerFloor ?? 0);
      const sameFloor = plFloor === this.selectedFloor;
      const pp = worldToScreen(this.liveState.playerPos.x, this.liveState.playerPos.z, this.view);
      const yaw = Number(this.liveState.playerYaw) || 0;
      const angle = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
      ctx.save();
      ctx.globalAlpha = sameFloor ? 1 : 0.42;
      ctx.translate(pp.x, pp.y);
      ctx.rotate(angle);

      ctx.fillStyle = 'rgba(34, 211, 238, 0.28)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 22, -0.48, 0.48);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#22d3ee';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(9, 0);
      ctx.lineTo(-6, -5.5);
      ctx.lineTo(-3.2, 0);
      ctx.lineTo(-6, 5.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = 'rgba(6, 12, 26, 0.85)';
    ctx.fillRect(10, 10, 146, 26);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, 146, 26);
    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${formatFloorShortLabel(this.selectedFloor)} • ${stepM}m/grille`, 18, 23);
    ctx.restore();
  }
}
