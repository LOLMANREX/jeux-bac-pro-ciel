import { TP_CATALOG, EXTRA_STATIONS } from '../core/gameState.js';
import {
  createDefaultMap,
  getCatalogItem,
  normalizeMapData,
  subtractDoorsFromWalls
} from '../world/mapSchema.js';

const STATION_META = new Map([...TP_CATALOG, ...EXTRA_STATIONS].map((s) => [s.id, s]));

export class PlateauMiniMap {
  constructor(canvas, initialMapData = null) {
    this.canvas = canvas;
    this.ctx = canvas?.getContext?.('2d') || null;
    this.w = canvas?.width || 248;
    this.h = canvas?.height || 232;
    this.pad = 10;
    this.mapData = normalizeMapData(initialMapData || createDefaultMap());
    this.baseCanvas = null;
    this._buildBaseLayer();
  }

  setMapData(mapData) {
    this.mapData = normalizeMapData(mapData || createDefaultMap());
    this._buildBaseLayer();
  }

  _toCanvas(wx, wz) {
    const b = this.mapData.bounds;
    const drawW = this.w - this.pad * 2;
    const drawH = this.h - this.pad * 2;
    const scale = Math.min(drawW / Math.max(1, b.width), drawH / Math.max(1, b.depth));
    const offsetX = this.pad + (drawW - b.width * scale) / 2;
    const offsetY = this.pad + (drawH - b.depth * scale) / 2;
    const cx = offsetX + (wx - b.minX) * scale;
    const cy = offsetY + (wz - b.minZ) * scale;
    return [cx, cy];
  }

  _buildBaseLayer() {
    if (!this.ctx || typeof document === 'undefined') return;
    const off = document.createElement('canvas');
    off.width = this.w;
    off.height = this.h;
    const octx = off.getContext('2d');
    if (!octx) return;

    const b = this.mapData.bounds;
    const isLargeMap = Math.max(b.width, b.depth) >= 60;

    octx.fillStyle = '#070f20';
    octx.fillRect(0, 0, this.w, this.h);

    const [bx1, by1] = this._toCanvas(b.minX, b.minZ);
    const [bx2, by2] = this._toCanvas(b.maxX, b.maxZ);
    octx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    octx.lineWidth = 1;
    octx.strokeRect(bx1, by1, bx2 - bx1, by2 - by1);

    for (const z of this.mapData.zones || []) {
      if (z.code === 'U300') continue;
      const [x1, y1] = this._toCanvas(z.x - z.w / 2, z.z - z.d / 2);
      const [x2, y2] = this._toCanvas(z.x + z.w / 2, z.z + z.d / 2);
      octx.fillStyle = z.id === 'ESCALIER' ? 'rgba(100, 116, 139, 0.28)' : `${z.color || '#38bdf8'}18`;
      octx.fillRect(x1, y1, x2 - x1, y2 - y1);
    }

    const wallSegments = subtractDoorsFromWalls(this.mapData.walls || []);
    octx.lineCap = 'square';
    for (const seg of wallSegments) {
      if (seg.kind === 'door_single' || seg.kind === 'door_double') continue;
      const [x1, y1] = this._toCanvas(seg.x1, seg.z1);
      const [x2, y2] = this._toCanvas(seg.x2, seg.z2);
      const isGlazed = seg.kind === 'glazed';
      octx.strokeStyle = isGlazed ? '#38bdf8' : '#94a3b8';
      const thick = (seg.thickness || 0.18) > 0.22 ? 2.4 : 1.5;
      octx.lineWidth = isLargeMap ? Math.max(1, thick * 0.65) : thick;
      octx.beginPath();
      octx.moveTo(x1, y1);
      octx.lineTo(x2, y2);
      octx.stroke();
    }

    for (const obj of this.mapData.objects || []) {
      const cat = getCatalogItem(obj.type);
      if (!cat?.tpId) continue;
      const st = STATION_META.get(cat.tpId);
      const [sx, sy] = this._toCanvas(obj.x, obj.z);
      octx.fillStyle = obj.color || st?.color || '#38bdf8';
      octx.beginPath();
      octx.arc(sx, sy, obj.type === 'npc_teacher' ? (isLargeMap ? 2.8 : 3.2) : isLargeMap ? 2.3 : 2.7, 0, Math.PI * 2);
      octx.fill();
    }

    octx.textAlign = 'center';
    octx.textBaseline = 'middle';
    for (const z of this.mapData.zones || []) {
      if (z.id === 'U309' || z.id === 'U311' || z.id === 'U308') continue;
      const [x1, y1] = this._toCanvas(z.x - z.w / 2, z.z - z.d / 2);
      const [x2, y2] = this._toCanvas(z.x + z.w / 2, z.z + z.d / 2);
      const rw = x2 - x1;
      const rh = y2 - y1;
      if (rw < 10 || rh < 8) continue;
      const [lx, ly] = this._toCanvas(z.x, z.z);
      const fontSize = isLargeMap ? Math.max(7.5, Math.min(9.5, rw * 0.26)) : 9.5;
      octx.font = `bold ${fontSize.toFixed(1)}px system-ui, sans-serif`;
      octx.fillStyle = z.id === 'ESCALIER' ? '#cbd5e1' : '#e2e8f0';
      octx.fillText(z.code || '', lx, ly);
    }

    this.baseCanvas = off;
  }

  render({ playerPos, playerYaw = 0, currentZone = null, peers = [] } = {}) {
    if (!this.ctx || !this.baseCanvas) return;
    const ctx = this.ctx;
    ctx.drawImage(this.baseCanvas, 0, 0);

    if (currentZone && currentZone.code !== 'U300' && currentZone.id !== 'U300') {
      const minX = typeof currentZone.x === 'number' ? currentZone.x - (currentZone.w || 2) / 2 : currentZone.bounds?.minX;
      const maxX = typeof currentZone.x === 'number' ? currentZone.x + (currentZone.w || 2) / 2 : currentZone.bounds?.maxX;
      const minZ = typeof currentZone.z === 'number' ? currentZone.z - (currentZone.d || 2) / 2 : currentZone.bounds?.minZ;
      const maxZ = typeof currentZone.z === 'number' ? currentZone.z + (currentZone.d || 2) / 2 : currentZone.bounds?.maxZ;
      if (typeof minX === 'number' && typeof minZ === 'number') {
        const [x1, y1] = this._toCanvas(minX, minZ);
        const [x2, y2] = this._toCanvas(maxX, maxZ);
        ctx.fillStyle = `${currentZone.color || '#22d3ee'}2a`;
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
        ctx.strokeStyle = currentZone.color || '#22d3ee';
        ctx.lineWidth = 1.6;
        ctx.strokeRect(x1 + 0.5, y1 + 0.5, x2 - x1 - 1, y2 - y1 - 1);
      }
    }

    for (const p of peers) {
      const [px, py] = this._toCanvas(p.x, p.z);
      ctx.fillStyle = p.color || '#34d399';
      ctx.beginPath();
      ctx.arc(px, py, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (playerPos) {
      const [ux, uy] = this._toCanvas(playerPos.x, playerPos.z);
      const angle = Math.atan2(-Math.cos(playerYaw), -Math.sin(playerYaw));

      ctx.save();
      ctx.translate(ux, uy);
      ctx.rotate(angle);

      ctx.fillStyle = 'rgba(34, 211, 238, 0.24)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 15, -0.48, 0.48);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#22d3ee';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(6.5, 0);
      ctx.lineTo(-4.5, -4);
      ctx.lineTo(-2.5, 0);
      ctx.lineTo(-4.5, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}
