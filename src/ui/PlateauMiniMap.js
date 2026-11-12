import { TP_CATALOG, EXTRA_STATIONS } from '../core/gameState.js';
import { WORLD_BOUNDS, PLATEAU_ZONES, buildPlateauWalls } from '../world/plateauLayout.js';

export class PlateauMiniMap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas?.getContext?.('2d') || null;
    this.w = canvas?.width || 248;
    this.h = canvas?.height || 232;
    this.pad = 10;
    this.walls = buildPlateauWalls();
    this.baseCanvas = null;
    this._lastZoneId = null;
    this._buildBaseLayer();
  }

  _toCanvas(wx, wz) {
    const drawW = this.w - this.pad * 2;
    const drawH = this.h - this.pad * 2;
    const cx = this.pad + ((wx - WORLD_BOUNDS.minX) / WORLD_BOUNDS.width) * drawW;
    const cy = this.pad + ((wz - WORLD_BOUNDS.minZ) / WORLD_BOUNDS.depth) * drawH;
    return [cx, cy];
  }

  _buildBaseLayer() {
    if (!this.ctx || typeof document === 'undefined') return;
    const off = document.createElement('canvas');
    off.width = this.w;
    off.height = this.h;
    const octx = off.getContext('2d');
    if (!octx) return;

    octx.fillStyle = '#070f20';
    octx.fillRect(0, 0, this.w, this.h);

    for (const z of PLATEAU_ZONES) {
      if (z.id === 'U300') continue;
      const [x1, y1] = this._toCanvas(z.bounds.minX, z.bounds.minZ);
      const [x2, y2] = this._toCanvas(z.bounds.maxX, z.bounds.maxZ);
      octx.fillStyle = z.id === 'ESCALIER' ? 'rgba(100, 116, 139, 0.28)' : `${z.color}18`;
      octx.fillRect(x1, y1, x2 - x1, y2 - y1);
    }

    octx.lineCap = 'square';
    for (const seg of this.walls) {
      if (seg.type === 'plaque' || seg.style === 'lintel' || seg.type === 'diagonalDoor') continue;
      if (seg.type === 'diagonal') {
        const [x1, y1] = this._toCanvas(seg.x1, seg.z1);
        const [x2, y2] = this._toCanvas(seg.x2, seg.z2);
        octx.strokeStyle = '#64748b';
        octx.lineWidth = 2;
        octx.beginPath();
        octx.moveTo(x1, y1);
        octx.lineTo(x2, y2);
        octx.stroke();
        continue;
      }
      const isGlazed = seg.style === 'glazed' || seg.style === 'stairSouth' || seg.style === 'stairWest';
      octx.strokeStyle = isGlazed ? '#38bdf8' : '#94a3b8';
      octx.lineWidth = seg.thickness > 0.22 ? 2.4 : 1.5;
      const [x1, y1] =
        seg.axis === 'z'
          ? this._toCanvas(seg.from, seg.fixed)
          : this._toCanvas(seg.fixed, seg.from);
      const [x2, y2] =
        seg.axis === 'z'
          ? this._toCanvas(seg.to, seg.fixed)
          : this._toCanvas(seg.fixed, seg.to);
      octx.beginPath();
      octx.moveTo(x1, y1);
      octx.lineTo(x2, y2);
      octx.stroke();
    }

    for (const st of [...TP_CATALOG, ...EXTRA_STATIONS]) {
      const [sx, sy] = this._toCanvas(st.position.x, st.position.z);
      octx.fillStyle = st.color || '#38bdf8';
      octx.beginPath();
      octx.arc(sx, sy, 2.7, 0, Math.PI * 2);
      octx.fill();
    }

    octx.textAlign = 'center';
    octx.textBaseline = 'middle';
    for (const z of PLATEAU_ZONES) {
      if (z.id === 'U309' || z.id === 'U311' || z.id === 'U308') continue;
      const [lx, ly] = this._toCanvas(z.labelPos.x, z.labelPos.z);
      octx.font = z.id === 'U300' ? 'bold 8.5px system-ui, sans-serif' : 'bold 9.5px system-ui, sans-serif';
      octx.fillStyle = z.id === 'ESCALIER' ? '#cbd5e1' : '#e2e8f0';
      octx.fillText(z.code, lx, ly);
    }

    this.baseCanvas = off;
  }

  render({ playerPos, playerYaw = 0, currentZone = null, peers = [] } = {}) {
    if (!this.ctx || !this.baseCanvas) return;
    const ctx = this.ctx;
    ctx.drawImage(this.baseCanvas, 0, 0);

    if (currentZone && currentZone.id !== 'U300') {
      const [x1, y1] = this._toCanvas(currentZone.bounds.minX, currentZone.bounds.minZ);
      const [x2, y2] = this._toCanvas(currentZone.bounds.maxX, currentZone.bounds.maxZ);
      ctx.fillStyle = `${currentZone.color || '#22d3ee'}2a`;
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      ctx.strokeStyle = currentZone.color || '#22d3ee';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(x1 + 0.5, y1 + 0.5, x2 - x1 - 1, y2 - y1 - 1);
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
