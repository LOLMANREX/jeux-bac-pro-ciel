import * as THREE from 'three';
import { TP_CATALOG, EXTRA_STATIONS } from '../core/gameState.js';
import { CielOsDesktop } from '../minigames/CielOsDesktop.js';
import { createNpcTeacher } from './NpcTeacher.js';
import { createRealisticMaterialPack } from './RealisticMaterials.js';
import { attachImportedModel } from './ModelImporter.js';
import { SpatialCullingEngine, SpatialHash } from './SpatialCulling.js';
import { computeRackExitPosition, computeRackInteriorPosition } from './SurvivalEngine.js';
import {
  SLAB_THICKNESS,
  buildWalkableSurfaceData,
  clampFloor,
  computeEffectiveFloorOpenings,
  computeSlabRectangles,
  computeStairGeometry,
  createDefaultMap,
  getCatalogItem,
  getDynamicMapColliders,
  getFloorBaseY,
  getZonePolygonPoints,
  isPcDeskObject,
  normalizeMapData,
  subtractDoorsFromWalls
} from './mapSchema.js';

const ALL_STATIONS_MAP = new Map([...TP_CATALOG, ...EXTRA_STATIONS].map((s) => [s.id, s]));

function disposeNodeTree(root) {
  if (!root) return;
  const disposeMat = (mat) => {
    if (!mat || mat.userData?.managedByMaterialPack) return;
    if (mat.map) mat.map.dispose();
    if (mat.roughnessMap) mat.roughnessMap.dispose();
    if (mat.bumpMap) mat.bumpMap.dispose();
    if (mat.emissiveMap) mat.emissiveMap.dispose();
    mat.dispose();
  };
  root.traverse((obj) => {
    if (obj.geometry) {
      obj.geometry.dispose();
    }
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        for (const m of obj.material) disposeMat(m);
      } else {
        disposeMat(obj.material);
      }
    }
  });
}

function makeCanvasTexture(width, height, drawFn) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return new THREE.Texture();
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext?.('2d');
  if (ctx) {
    drawFn(ctx, width, height);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function makeDoorSignTexture(label, accent = '#0284c7') {
  return makeCanvasTexture(512, 112, (ctx, w, h) => {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 4;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.fillStyle = accent;
    ctx.fillRect(3, 3, 16, h - 6);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(label || 'SALLE CIEL').slice(0, 26), w / 2 + 8, h / 2);
  });
}

function makePerforatedRackDoorTexture() {
  return makeCanvasTexture(512, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(148, 163, 184, 0.07)';
    for (let y = 0; y < h; y += 6) {
      ctx.fillRect(0, y, w, 2);
    }

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 18;
    ctx.strokeRect(9, 9, w - 18, h - 18);

    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000000';

    for (let y = 148; y <= 650; y += 44) {
      ctx.beginPath();
      ctx.roundRect(42, y, w - 84, 24, 9);
      ctx.fill();
      for (let x = 58; x <= w - 58; x += 26) {
        ctx.beginPath();
        ctx.arc(x, y + 33, 6.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let row = 0; row < 4; row++) {
      const gyTop = 44 + row * 22;
      const gyBot = 708 + row * 26;
      for (let col = 56; col <= w - 56; col += 24) {
        ctx.beginPath();
        ctx.arc(col, gyTop, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(col, gyBot, 6.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (let y = 824; y <= 964; y += 34) {
      ctx.beginPath();
      ctx.roundRect(54, y, w - 108, 14, 6);
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
    ctx.lineWidth = 2;
    for (let y = 148; y <= 650; y += 44) {
      ctx.strokeRect(42, y, w - 84, 24);
    }
  });
}

function makeOrientationMapTexture(mapData) {
  return makeCanvasTexture(1024, 680, (ctx, w, h) => {
    const b = mapData.bounds;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 5;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(16, 16, w - 32, 68);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🗺️ PLAN D’ORIENTATION — ${String(mapData.name || 'PLATEAU CIEL').slice(0, 34).toUpperCase()}`, 34, 50);

    const padX = 48;
    const padY = 108;
    const mapW = w - 96;
    const mapH = h - 148;
    const toPxX = (wx) => padX + ((wx - b.minX) / Math.max(1, b.width)) * mapW;
    const toPxY = (wz) => padY + ((wz - b.minZ) / Math.max(1, b.depth)) * mapH;

    ctx.fillStyle = '#eef2f6';
    ctx.fillRect(padX, padY, mapW, mapH);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.strokeRect(padX, padY, mapW, mapH);

    for (const z of mapData.zones || []) {
      if (z.code === 'U300' && !Array.isArray(z.points)) continue;
      const pts = getZonePolygonPoints(z);
      if (pts.length < 3) continue;
      ctx.beginPath();
      pts.forEach((p, idx) => {
        const px = toPxX(p.x);
        const py = toPxY(p.z);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fillStyle = `${z.color || '#0284c7'}24`;
      ctx.fill();
      ctx.strokeStyle = z.color || '#0284c7';
      ctx.lineWidth = 2;
      ctx.stroke();

      const lx = toPxX(z.x);
      const ly = toPxY(z.z);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 19px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(z.code || '', lx, ly - 10);
      ctx.fillStyle = '#475569';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText(z.shortName || '', lx, ly + 12);
    }

    const wallSegments = subtractDoorsFromWalls(mapData.walls || []);
    ctx.lineCap = 'round';
    for (const wall of wallSegments) {
      if (wall.kind === 'door_single' || wall.kind === 'door_double') continue;
      ctx.strokeStyle = wall.kind === 'glazed' ? '#0284c7' : '#334155';
      ctx.lineWidth = wall.kind === 'solid' ? 4 : 2.5;
      ctx.beginPath();
      ctx.moveTo(toPxX(wall.x1), toPxY(wall.z1));
      ctx.lineTo(toPxX(wall.x2), toPxY(wall.z2));
      ctx.stroke();
    }

    const sp = mapData.spawn || { x: 0, z: 0 };
    const hx = toPxX(sp.x);
    const hy = toPxY(sp.z);
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(hx, hy, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0369a1';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPAWN', hx, hy + 20);
  });
}

function makeAvMonitorTexture() {
  return makeCanvasTexture(256, 160, (ctx, w, h) => {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(10, 10, 112, 82);
    ctx.fillRect(134, 10, 112, 82);
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(16, 16, 100, 70);
    ctx.fillStyle = '#059669';
    ctx.fillRect(140, 16, 100, 70);
    ctx.fillStyle = '#334155';
    ctx.fillRect(10, 104, w - 20, 46);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(18, 114, 150, 10);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(18, 130, 195, 10);
  });
}

function makeStationLabelSprite(title, icon, color) {
  const tex = makeCanvasTexture(512, 160, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(10, 17, 32, 0.88)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(12, 18, w - 24, h - 36, 22);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${icon} ${String(title || '').slice(0, 26)}`, w / 2, h / 2);
  });
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.7, 0.84, 1);
  return sprite;
}

function makeScopeTexture() {
  return makeCanvasTexture(256, 160, (ctx, w, h) => {
    ctx.fillStyle = '#041224';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#1e3a5f';
    for (let gx = 0; gx < w; gx += 32) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (let gy = 0; gy < h; gy += 32) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const y = h / 2 + Math.sin(x * 0.08) * 44;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });
}

function makeWhiteboardTexture() {
  return makeCanvasTexture(512, 280, (ctx, w, h) => {
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.fillStyle = '#0284c7';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('BAC PRO CIEL — ARCHITECTURE RÉSEAU', 26, 42);
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 3;
    ctx.strokeRect(38, 72, 120, 68);
    ctx.strokeRect(205, 72, 110, 68);
    ctx.strokeRect(360, 72, 114, 68);
    ctx.beginPath();
    ctx.moveTo(158, 106);
    ctx.lineTo(205, 106);
    ctx.moveTo(315, 106);
    ctx.lineTo(360, 106);
    ctx.stroke();
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('VLAN 10', 62, 112);
    ctx.fillText('SW L3', 234, 112);
    ctx.fillText('FW SOC', 385, 112);
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText('U = R × I  •  192.168.10.0/24', 38, 200);
    ctx.fillStyle = '#059669';
    ctx.fillText('ESD / EPI obligatoire à l’atelier', 38, 236);
  });
}

function makeSocScreenTexture(label = 'SOC MONITORING • U305') {
  return makeCanvasTexture(512, 220, (ctx, w, h) => {
    ctx.fillStyle = '#1f0812';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#fda4af';
    ctx.font = 'bold 26px monospace';
    ctx.fillText(String(label || 'SOC MONITORING').slice(0, 26), 30, 56);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '20px monospace';
    ctx.fillText('IDS / PARE-FEU : ACTIF', 30, 114);
    ctx.fillText('QUARANTAINE : 0 MENACE ACTIVE', 30, 156);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '16px monospace';
    ctx.fillText('TRAFIC VLAN SURVEILLÉ EN TEMPS RÉEL', 30, 192);
  });
}

function formatRankOrdinal(rank) {
  return rank === 1 ? '1er' : `${rank}e`;
}

function truncateBoardText(ctx, text, maxWidth) {
  const str = String(text || '');
  if (ctx.measureText(str).width <= maxWidth) return str;
  let cut = str;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

const WALL_MOUNT_CLEARANCE = 0.015;

function createWallLeaderboardBoard(parent, obj, mats) {
  const W = 1280;
  const H = 744;
  let canvas = null;
  let ctx = null;
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    ctx = canvas.getContext?.('2d') || null;
  }

  const texture = canvas ? new THREE.CanvasTexture(canvas) : new THREE.Texture();
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const boardW = Math.max(1.8, Math.min(5.2, Number(obj.w) || 3.45));
  const scaleFactor = boardW / 3.48;
  const boardGroup = new THREE.Group();
  boardGroup.position.set(0, 2.28, 0.05 + WALL_MOUNT_CLEARANCE);
  boardGroup.scale.set(scaleFactor, scaleFactor, 1);

  const glowFrame = new THREE.Mesh(
    new THREE.BoxGeometry(3.48, 2.12, 0.06),
    mats.brushedMetalMat
  );
  glowFrame.position.z = -0.02;
  boardGroup.add(glowFrame);

  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(3.38, 2.02, 0.1),
    mats.darkMetalMat
  );
  boardGroup.add(bezel);

  const headerLed = new THREE.Mesh(
    new THREE.BoxGeometry(3.22, 0.03, 0.02),
    new THREE.MeshStandardMaterial({ color: '#0284c7', metalness: 0.35, roughness: 0.3 })
  );
  headerLed.position.set(0, 0.97, 0.06);
  boardGroup.add(headerLed);

  const screenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3.24, 1.88),
    new THREE.MeshBasicMaterial({ map: texture })
  );
  screenMesh.position.z = 0.062;
  boardGroup.add(screenMesh);

  parent.add(boardGroup);

  let lastSignature = '';

  function update(entries = [], localPlayerName = '') {
    const safeList = Array.isArray(entries) ? entries : [];
    const sorted = [...safeList].sort((a, b) => {
      const avgA = typeof a.average === 'number' ? a.average : -1;
      const avgB = typeof b.average === 'number' ? b.average : -1;
      if (avgB !== avgA) return avgB - avgA;
      const xpDiff = (b.xp || 0) - (a.xp || 0);
      if (xpDiff !== 0) return xpDiff;
      return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
    });

    const topRows = sorted.slice(0, 8);
    const localKey = String(localPlayerName || '').trim().toLowerCase();
    const onlineTotal = sorted.filter((r) => r.online).length;
    const signature =
      topRows
        .map(
          (r, idx) =>
            `${idx + 1}:${r.name}:${typeof r.average === 'number' ? r.average.toFixed(1) : '--'}:${r.xp || 0}:${r.online ? 1 : 0}:${r.diplomaEarned ? 1 : 0}`
        )
        .join('|') + `||${onlineTotal}/${sorted.length}||${localKey}`;

    if (signature === lastSignature) return;
    lastSignature = signature;
    if (!ctx) return;

    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#060d1e');
    bgGrad.addColorStop(1, '#0b1730');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(34, 211, 238, 0.45)';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, W - 20, H - 20);

    const headGrad = ctx.createLinearGradient(18, 18, W - 18, 96);
    headGrad.addColorStop(0, '#082f49');
    headGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.roundRect(22, 20, W - 44, 78, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 29px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏆 TABLEAU DE CLASSEMENT EN DIRECT - BAC PRO CIEL', 40, 59);

    ctx.fillStyle = onlineTotal > 0 ? 'rgba(16, 185, 129, 0.18)' : 'rgba(100, 116, 139, 0.22)';
    ctx.strokeStyle = onlineTotal > 0 ? '#10b981' : '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(W - 300, 36, 256, 46, 23);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = onlineTotal > 0 ? '#10b981' : '#94a3b8';
    ctx.beginPath();
    ctx.arc(W - 274, 59, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = onlineTotal > 0 ? '#a7f3d0' : '#cbd5e1';
    ctx.font = 'bold 19px system-ui, -apple-system, sans-serif';
    ctx.fillText(`${onlineTotal} en ligne • ${sorted.length} classé(s)`, W - 256, 59);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
    ctx.fillText('RANG', 44, 126);
    ctx.fillText('ÉLÈVE', 165, 126);
    ctx.fillText('STATUT', 660, 126);
    ctx.fillText('MOYENNE', 900, 126);
    ctx.textAlign = 'right';
    ctx.fillText('XP', W - 48, 126);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(28, 146);
    ctx.lineTo(W - 28, 146);
    ctx.stroke();

    if (topRows.length === 0) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.beginPath();
      ctx.roundRect(44, 240, W - 88, 180, 18);
      ctx.fill();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.stroke();

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('En attente des premiers résultats de TP...', W / 2, 315);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '22px system-ui, -apple-system, sans-serif';
      ctx.fillText('Explorez le Plateau U300 et validez un TP pour entrer au classement !', W / 2, 365);
    } else {
      topRows.forEach((entry, idx) => {
        const rank = idx + 1;
        const rowY = 158 + idx * 66;
        const rowH = 58;
        const isSelf = localKey && String(entry.name || '').trim().toLowerCase() === localKey;

        ctx.fillStyle = isSelf
          ? 'rgba(6, 182, 212, 0.22)'
          : idx % 2 === 0
            ? 'rgba(15, 23, 42, 0.88)'
            : 'rgba(22, 34, 58, 0.72)';
        ctx.beginPath();
        ctx.roundRect(26, rowY, W - 52, rowH, 12);
        ctx.fill();

        if (isSelf) {
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        } else if (rank <= 3) {
          ctx.strokeStyle =
            rank === 1
              ? 'rgba(251, 191, 36, 0.55)'
              : rank === 2
                ? 'rgba(203, 213, 225, 0.45)'
                : 'rgba(251, 146, 60, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        const rankColor =
          rank === 1 ? '#fbbf24' : rank === 2 ? '#e2e8f0' : rank === 3 ? '#fb923c' : '#38bdf8';
        ctx.fillStyle = rankColor;
        ctx.beginPath();
        ctx.roundRect(42, rowY + 10, 92, 38, 10);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(formatRankOrdinal(rank), 88, rowY + rowH / 2);

        const displayName = entry.diplomaEarned ? `${entry.name} 🎓` : String(entry.name || 'Élève');
        ctx.fillStyle = isSelf ? '#67e8f9' : '#f8fafc';
        ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(truncateBoardText(ctx, displayName, 460), 165, rowY + rowH / 2);

        const isOnline = Boolean(entry.online);
        ctx.fillStyle = isOnline ? 'rgba(16, 185, 129, 0.16)' : 'rgba(100, 116, 139, 0.18)';
        ctx.strokeStyle = isOnline ? 'rgba(16, 185, 129, 0.6)' : 'rgba(100, 116, 139, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(654, rowY + 11, 186, 36, 18);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isOnline ? '#10b981' : '#64748b';
        ctx.beginPath();
        ctx.arc(678, rowY + rowH / 2, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isOnline ? '#6ee7b7' : '#cbd5e1';
        ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(isOnline ? 'En ligne' : 'Hors ligne', 696, rowY + rowH / 2);

        const hasAvg = typeof entry.average === 'number';
        const avgColor = !hasAvg ? '#94a3b8' : entry.average >= 10 ? '#34d399' : '#fb7185';
        ctx.fillStyle = avgColor;
        ctx.font = 'bold 26px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(hasAvg ? `${entry.average.toFixed(1)} / 20` : '-- / 20', 900, rowY + rowH / 2);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 25px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${entry.xp || 0} XP`, W - 48, rowY + rowH / 2);
      });
    }

    const meIndex = localKey
      ? sorted.findIndex((r) => String(r.name || '').trim().toLowerCase() === localKey)
      : -1;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(26, H - 48, W - 52, 30, 8);
    ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    if (meIndex >= 0) {
      const me = sorted[meIndex];
      const meAvg = typeof me.average === 'number' ? `${me.average.toFixed(1)} / 20` : '-- / 20';
      ctx.fillStyle = '#67e8f9';
      ctx.fillText(
        `Votre position : ${formatRankOrdinal(meIndex + 1)} sur ${sorted.length}  •  Moyenne : ${meAvg}  •  ${me.xp || 0} XP`,
        W / 2,
        H - 33
      );
    } else {
      ctx.fillText('Actualisation automatique en temps réel • Bac Pro CIEL', W / 2, H - 33);
    }

    texture.needsUpdate = true;
  }

  update([], '');

  return {
    group: boardGroup,
    update
  };
}

function buildWorkbenchMesh(w, d, topHeight = 0.82, mats, useTechTop = false) {
  const grp = new THREE.Group();
  const topMat = useTechTop ? mats.techBenchMat : mats.oakDeskMat;
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, d), topMat);
  top.position.y = topHeight;
  top.castShadow = true;
  top.receiveShadow = true;
  grp.add(top);

  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.02, 0.026, d + 0.02),
    mats.deskEdgeMat
  );
  trim.position.y = topHeight - 0.032;
  trim.castShadow = false;
  trim.receiveShadow = false;
  grp.add(trim);

  const lx = Math.max(0.12, w / 2 - 0.1);
  const lz = Math.max(0.12, d / 2 - 0.1);
  for (const [px, pz] of [
    [-lx, -lz],
    [lx, -lz],
    [-lx, lz],
    [lx, lz]
  ]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, topHeight, 0.06), mats.legMat);
    leg.position.set(px, topHeight / 2, pz);
    leg.castShadow = false;
    leg.receiveShadow = false;
    grp.add(leg);
  }
  return grp;
}

function buildRackMesh(w, d, h = 2.15, ledOffsetPhase = 0, ledColor = '#10b981', mats, animatedRefs) {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    mats.darkMetalMat
  );
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  grp.add(body);

  const glassDoor = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.84, h * 0.86, 0.03),
    mats.rackGlassMat
  );
  glassDoor.position.set(0, h / 2, d / 2 + 0.01);
  grp.add(glassDoor);

  for (let i = 0; i < 6; i++) {
    const tray = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, 0.07, 0.04), mats.brushedMetalMat);
    tray.position.set(0, 0.38 + i * 0.27, d / 2 - 0.01);
    grp.add(tray);

    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.036, 0.04),
      new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? ledColor : '#38bdf8' })
    );
    led.position.set(-w * 0.24 + (i % 3) * (w * 0.2), 0.38 + i * 0.27, d / 2 + 0.02);
    grp.add(led);
    animatedRefs.leds.push({ mesh: led, phase: ledOffsetPhase + i * 0.7, alert: false });
  }
  return grp;
}

function findSupportingSurfaceHeight(obj, supportBoxes) {
  const objFloor = clampFloor(obj.floor ?? 0);
  for (const box of supportBoxes) {
    if (box.id === obj.id) continue;
    if (clampFloor(box.floor ?? 0) !== objFloor) continue;
    const dx = obj.x - box.x;
    const dz = obj.z - box.z;
    const cos = Math.cos(box.rad);
    const sin = Math.sin(box.rad);
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    if (Math.abs(lx) <= box.hw + 0.08 && Math.abs(lz) <= box.hd + 0.08) {
      return box.supportTop;
    }
  }
  return null;
}

function createPropMountGroup(obj, supportHeight, mats) {
  const grp = new THREE.Group();
  let mountY = supportHeight;
  if (mountY === null) {
    mountY = 0.78;
    const base = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.55, obj.w + 0.2), 0.05, Math.max(0.55, obj.d + 0.2)), mats.oakDeskMat);
    base.position.y = 0.755;
    base.castShadow = false;
    base.receiveShadow = false;
    grp.add(base);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.12, 0.75, 10), mats.legMat);
    post.position.y = 0.375;
    post.castShadow = false;
    post.receiveShadow = false;
    grp.add(post);
  }
  return { grp, mountY };
}

function sliceRectByChunks(rect, chunkSize = 16) {
  const out = [];
  if (!rect || rect.maxX <= rect.minX + 0.01 || rect.maxZ <= rect.minZ + 0.01) return out;
  const xStart = Math.floor(rect.minX / chunkSize);
  const xEnd = Math.floor((rect.maxX - 0.001) / chunkSize);
  const zStart = Math.floor(rect.minZ / chunkSize);
  const zEnd = Math.floor((rect.maxZ - 0.001) / chunkSize);
  for (let cx = xStart; cx <= xEnd; cx++) {
    const x0 = Math.max(rect.minX, cx * chunkSize);
    const x1 = Math.min(rect.maxX, (cx + 1) * chunkSize);
    if (x1 - x0 <= 0.01) continue;
    for (let cz = zStart; cz <= zEnd; cz++) {
      const z0 = Math.max(rect.minZ, cz * chunkSize);
      const z1 = Math.min(rect.maxZ, (cz + 1) * chunkSize);
      if (z1 - z0 <= 0.01) continue;
      out.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, cx, cz });
    }
  }
  return out;
}

function makeCampusSkyTexture() {
  return makeCanvasTexture(64, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, '#3b82c4');
    grad.addColorStop(0.35, '#7bb7ea');
    grad.addColorStop(0.52, '#cfe4f7');
    grad.addColorStop(0.56, '#d9e9f5');
    grad.addColorStop(1.0, '#a3b8a0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
}

function createChunkedHorizontalTile(minX, maxX, minZ, maxZ, fullBounds, mat, y, isCeiling = false) {
  const w = maxX - minX;
  const d = maxZ - minZ;
  const geo = new THREE.PlaneGeometry(w, d);
  const uv = geo.attributes?.uv;
  if (uv && fullBounds && fullBounds.width > 0 && fullBounds.depth > 0) {
    const u0 = (minX - fullBounds.minX) / fullBounds.width;
    const u1 = (maxX - fullBounds.minX) / fullBounds.width;
    const v0 = (fullBounds.maxZ - maxZ) / fullBounds.depth;
    const v1 = (fullBounds.maxZ - minZ) / fullBounds.depth;
    const du = u1 - u0;
    const dv = v1 - v0;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, u0 + uv.getX(i) * du, v0 + uv.getY(i) * dv);
    }
    uv.needsUpdate = true;
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = isCeiling ? Math.PI / 2 : -Math.PI / 2;
  mesh.position.set((minX + maxX) * 0.5, y, (minZ + maxZ) * 0.5);
  mesh.receiveShadow = !isCeiling;
  return mesh;
}

export function buildLabWorld(scene, initialMapData = null, options = {}) {
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  const colliders = [];
  const interactables = [];
  const solidWallMeshes = [];
  const teacherRefs = [];
  const survivalDoors = [];
  const combatDoors = [];
  const hidingSpots = [];
  let perfRackDoorTex = null;
  const pcStations = [];
  const pcInteractiveSurfaces = [];
  const shopKiosks = [];
  const ceilingPanelMeshes = [];
  const animatedRefs = {
    rings: [],
    leds: [],
    survivalBeacons: [],
    shopHolograms: []
  };
  let leaderboardBoards = [];
  let materialPack = null;
  let currentMapData = normalizeMapData(initialMapData || createDefaultMap());
  let walkableSurfaces = buildWalkableSurfaceData(currentMapData);
  let qualityTier = options.lowRes ? 'eco' : 'high';
  let spatialCulling = null;
  const spatialHash = new SpatialHash(8, Number(currentMapData.floorHeight) || 3.8);
  let cullCalledSinceUpdate = false;
  let lastLeaderboardEntries = [];
  let lastLocalPlayerName = '';
  let lastLocalCoins = 0;
  let arcadeGameEndHandler = null;
  let lastGrades = {};
  let qualityProfile = {
    textureThrottleMult: 1.0,
    lowResPc: Boolean(options.lowRes)
  };
  let pcIdleCursor = 0;
  const showSprites = !options.hideSprites;
  let hoveredItem = null;
  const hoverSnapshot = new Map();
  const hoverHaloMat = new THREE.MeshBasicMaterial({
    color: '#22d3ee',
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.72,
    depthWrite: false
  });
  const hoverHaloMesh = new THREE.Mesh(new THREE.RingGeometry(0.48, 0.62, 32), hoverHaloMat);
  hoverHaloMesh.rotation.x = -Math.PI / 2;
  hoverHaloMesh.position.y = 0.042;
  hoverHaloMesh.visible = false;
  scene.add(hoverHaloMesh);

  function setHoveredInteractable(nextItem) {
    if (hoveredItem === nextItem) return;
    for (const [mat, orig] of hoverSnapshot.entries()) {
      if (mat.emissive && orig.emissive !== undefined) {
        mat.emissive.setHex(orig.emissive);
        mat.emissiveIntensity = orig.emissiveIntensity;
      } else if (mat.color && orig.color !== undefined) {
        mat.color.setHex(orig.color);
      }
    }
    hoverSnapshot.clear();
    if (hoveredItem?.ring?.material) {
      const ringEntry = animatedRefs.rings.find((r) => r.ring === hoveredItem.ring);
      if (ringEntry) {
        const g = lastGrades[ringEntry.id];
        const passed = typeof g === 'number' && g >= 10;
        hoveredItem.ring.material.color.set(passed ? '#10b981' : ringEntry.baseColor);
      }
    }
    hoveredItem = nextItem || null;
    if (!hoveredItem) {
      hoverHaloMesh.visible = false;
      return;
    }
    if (hoveredItem.position) {
      const rScale = hoveredItem.isProp ? 0.9 : 1.45;
      hoverHaloMesh.position.set(
        hoveredItem.position.x,
        (Number(hoveredItem.position.y) || 0) + 0.042,
        hoveredItem.position.z
      );
      hoverHaloMesh.scale.set(rScale, rScale, 1);
      hoverHaloMesh.visible = true;
    }
    if (hoveredItem.ring?.material) {
      hoveredItem.ring.material.color.set('#67e8f9');
    }
    if (Array.isArray(hoveredItem.highlightMats)) {
      for (const mat of hoveredItem.highlightMats) {
        if (!mat || hoverSnapshot.has(mat)) continue;
        if (mat.emissive) {
          hoverSnapshot.set(mat, {
            emissive: mat.emissive.getHex(),
            emissiveIntensity: typeof mat.emissiveIntensity === 'number' ? mat.emissiveIntensity : 0
          });
          mat.emissive.setHex(0x38bdf8);
          mat.emissiveIntensity = Math.max(0.55, (mat.emissiveIntensity || 0) + 0.45);
        } else if (mat.color) {
          hoverSnapshot.set(mat, { color: mat.color.getHex() });
          mat.color.setHex(0x7dd3fc);
        }
      }
    }
  }

  function addDoorSign(parentGroup, cx, cz, y, rotY, thickness, label, accent = '#0284c7', housingMat) {
    const tex = makeDoorSignTexture(label, accent);
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(1.46, 0.34, thickness + 0.1),
      housingMat
    );
    housing.position.set(cx, y, cz);
    housing.rotation.y = rotY;
    parentGroup.add(housing);

    const f1 = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.29), mat);
    f1.position.set(0, 0, (thickness + 0.1) / 2 + 0.004);
    housing.add(f1);

    const f2 = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.29), mat);
    f2.rotation.y = Math.PI;
    f2.position.set(0, 0, -(thickness + 0.1) / 2 - 0.004);
    housing.add(f2);
  }

  function attachStationMarker(stationDef, obj, parentGroup, radius = 2.6, ySprite = 2.55, highlightMats = null) {
    const color = obj.color || stationDef.color || '#0284c7';
    const objFloor = clampFloor(obj.floor ?? 0);
    const baseY = getFloorBaseY(currentMapData, objFloor);
    const ringGeo = new THREE.RingGeometry(0.68, 0.86, 36);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.86
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.03, 0);
    parentGroup.add(ring);
    animatedRefs.rings.push({ id: stationDef.id, ring, baseColor: color });

    if (showSprites) {
      const title = obj.label || stationDef.shortTitle || stationDef.title;
      const sprite = makeStationLabelSprite(title, stationDef.icon, color);
      sprite.position.set(0, ySprite, 0);
      parentGroup.add(sprite);
    }

    interactables.push({
      id: stationDef.id,
      tpId: stationDef.id,
      label: `[E] ${obj.label || stationDef.title}`,
      type: 'tp',
      tp: stationDef,
      position: new THREE.Vector3(obj.x, baseY, obj.z),
      floor: objFloor,
      interactRadius: radius,
      ring,
      mesh: parentGroup,
      highlightMats: Array.isArray(highlightMats) ? highlightMats : null
    });
  }

  function attachCielOsPcToDesk(obj, cat, parentGroup, topH, monitorSpecs, mats, extraHighlightMats = []) {
    const defaultTheme =
      obj.type === 'pc_gamer_cyber'
        ? 'synthwave'
        : obj.type === 'network_island'
          ? 'matrix_green'
          : obj.type === 'pc_open_maint'
            ? 'dark_mode'
            : 'cyber_blue';

    const desktop = new CielOsDesktop({
      stationId: obj.id,
      stationLabel: obj.label || cat.shortLabel || 'Poste PC CIEL',
      playerName: lastLocalPlayerName || 'Eleve_CIEL',
      coins: lastLocalCoins,
      onGameFinished: arcadeGameEndHandler,
      themeId: defaultTheme,
      renderScale: qualityProfile.lowResPc ? 0.5 : 1.0,
      idleThrottleMult: qualityProfile.textureThrottleMult
    });
    desktop.lastIdleDrawAt = -2.0 - (pcStations.length % 10) * 0.23;

    const osTexture = new THREE.CanvasTexture(desktop.canvas);
    osTexture.colorSpace = THREE.SRGBColorSpace;
    osTexture.minFilter = THREE.LinearFilter;
    osTexture.magFilter = THREE.LinearFilter;
    desktop.onChange = () => {
      osTexture.needsUpdate = true;
    };

    const screenMat = new THREE.MeshBasicMaterial({ map: osTexture, side: THREE.FrontSide });
    const bezelMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      roughness: 0.35,
      metalness: 0.65,
      emissive: '#082f49',
      emissiveIntensity: 0.22,
      side: THREE.FrontSide
    });
    const highlightMats = [bezelMat, ...extraHighlightMats];
    const screenMeshes = [];
    const stationSurfaces = [];

    const specs =
      Array.isArray(monitorSpecs) && monitorSpecs.length > 0
        ? monitorSpecs
        : [{ x: 0, y: topH + 0.32, z: -0.15, rotY: 0, w: 0.66, h: 0.41 }];

    specs.forEach((sp, idx) => {
      const mw = sp.w || 0.66;
      const mh = sp.h || 0.41;
      const sw = mw - 0.05;
      const sh = mh - 0.05;
      const monGrp = new THREE.Group();
      monGrp.position.set(sp.x || 0, sp.y || topH + 0.32, sp.z || 0);
      monGrp.rotation.y = sp.rotY || 0;
      parentGroup.add(monGrp);

      const bezel = new THREE.Mesh(new THREE.BoxGeometry(mw, mh, 0.045), bezelMat);
      bezel.castShadow = false;
      bezel.receiveShadow = false;
      monGrp.add(bezel);

      const standH = Math.max(0.08, (sp.y || topH + 0.32) - mh / 2 - topH);
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.07, standH + 0.04, 0.05), mats.darkMetalMat);
      stand.position.set(0, -mh / 2 - standH / 2 + 0.01, -0.01);
      monGrp.add(stand);

      const basePlate = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.016, 0.16), mats.darkMetalMat);
      basePlate.position.set(0, -mh / 2 - standH + 0.008, 0.01);
      monGrp.add(basePlate);

      const frontScreen = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), screenMat);
      frontScreen.position.set(0, 0, 0.025);
      frontScreen.name = `ciel-os-screen-${obj.id}-${idx}-front`;
      monGrp.add(frontScreen);
      screenMeshes.push(frontScreen);

      if (idx === 0) {
        const kbdDir = Math.cos(sp.rotY || 0) >= 0 ? 1 : -1;
        const kbd = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.018, 0.13), mats.darkMetalMat);
        kbd.position.set(sp.x || 0, topH + 0.042, (sp.z || 0) + 0.2 * kbdDir);
        parentGroup.add(kbd);
        const mouse = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.095), mats.darkMetalMat);
        mouse.position.set((sp.x || 0) + 0.26 * kbdDir, topH + 0.042, (sp.z || 0) + 0.2 * kbdDir);
        parentGroup.add(mouse);
      }
    });

    const pcRing = new THREE.Mesh(
      new THREE.RingGeometry(0.52, 0.66, 28),
      new THREE.MeshBasicMaterial({
        color: obj.color || cat.defaultColor || '#38bdf8',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55
      })
    );
    pcRing.rotation.x = -Math.PI / 2;
    pcRing.position.set(0, 0.026, 0);
    parentGroup.add(pcRing);

    const objFloor = clampFloor(obj.floor ?? 0);
    const baseY = getFloorBaseY(currentMapData, objFloor);

    const pcStation = {
      id: obj.id,
      objId: obj.id,
      objType: obj.type,
      label: obj.label || cat.shortLabel || 'Poste PC CIEL OS',
      position: new THREE.Vector3(obj.x, baseY, obj.z),
      floor: objFloor,
      rotation: ((obj.rotation || 0) * Math.PI) / 180,
      desktop,
      canvas: desktop.canvas,
      texture: osTexture,
      group: parentGroup,
      screenMeshes,
      surfaces: stationSurfaces,
      isActiveSession: false,
      getCameraFocusPose(viewerPos = null) {
        parentGroup.updateWorldMatrix(true, true);
        let bestScreen = screenMeshes[0] || null;
        let bestScore = -Infinity;
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        const normal = new THREE.Vector3();
        const bestCenter = new THREE.Vector3(obj.x, baseY + topH + 0.32, obj.z);
        const bestNormal = new THREE.Vector3(0, 0, 1);

        for (const sm of screenMeshes) {
          sm.updateWorldMatrix(true, false);
          sm.getWorldPosition(worldPos);
          sm.getWorldQuaternion(worldQuat);
          normal.set(0, 0, 1).applyQuaternion(worldQuat);
          normal.y = 0;
          if (normal.lengthSq() < 1e-5) normal.set(0, 0, 1);
          else normal.normalize();

          let score = 0;
          if (viewerPos && Number.isFinite(Number(viewerPos.x)) && Number.isFinite(Number(viewerPos.z))) {
            const vx = Number(viewerPos.x) - worldPos.x;
            const vz = Number(viewerPos.z) - worldPos.z;
            const vLen = Math.hypot(vx, vz) || 1;
            score = (vx / vLen) * normal.x + (vz / vLen) * normal.z;
          }
          if (score > bestScore) {
            bestScore = score;
            bestScreen = sm;
            bestCenter.copy(worldPos);
            bestNormal.copy(normal);
          }
        }

        const camDist = 0.54;
        const camPos = new THREE.Vector3(
          bestCenter.x + bestNormal.x * camDist,
          bestCenter.y + 0.02,
          bestCenter.z + bestNormal.z * camDist
        );
        const lookAt = bestCenter.clone();
        return { camPos, lookAt, screenMesh: bestScreen };
      }
    };

    screenMeshes.forEach((sm, sIdx) => {
      const geomParams = sm.geometry?.parameters || {};
      const surf = {
        id: `pc_screen_${obj.id}_${sIdx}`,
        pcId: obj.id,
        pcStation,
        mesh: sm,
        width: geomParams.width || 0.61,
        height: geomParams.height || 0.36,
        hitTestUv: (uv) => desktop.hitTestUv(uv),
        setHovered: (btnId) => desktop.setHovered(btnId)
      };
      stationSurfaces.push(surf);
      pcInteractiveSurfaces.push(surf);
    });

    pcStations.push(pcStation);

    interactables.push({
      id: `pc-${obj.id}`,
      pcId: obj.id,
      objId: obj.id,
      type: 'ciel_os_pc',
      isPcDesk: true,
      isProp: true,
      label: `[E] 🖥️ Utiliser le PC (CIEL OS) — ${obj.label || cat.shortLabel}`,
      shortTitle: obj.label || cat.shortLabel || 'Poste PC CIEL OS',
      position: new THREE.Vector3(obj.x, baseY, obj.z),
      floor: objFloor,
      interactRadius: cat.interactRadius || 2.4,
      ring: pcRing,
      mesh: parentGroup,
      highlightMats,
      pcStation
    });

    return pcStation;
  }

  const _zUnit = new THREE.Vector3(0, 0, 1);
  const _railDir = new THREE.Vector3();

  function buildStaircaseMeshGroup(geom, mats) {
    const grp = new THREE.Group();
    grp.position.set(geom.x, 0, geom.z);
    grp.rotation.y = geom.rad;

    for (let i = 0; i < geom.steps3d.length; i++) {
      const s = geom.steps3d[i];
      const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, s.d), mats.stairTreadMat);
      stepMesh.position.set(s.lx, s.ly, s.lz);
      stepMesh.castShadow = true;
      stepMesh.receiveShadow = true;
      grp.add(stepMesh);
    }

    for (let i = 0; i < geom.landings.length; i++) {
      const ld = geom.landings[i];
      const landMesh = new THREE.Mesh(new THREE.BoxGeometry(ld.w, ld.h, ld.d), mats.concreteMat);
      landMesh.position.set(ld.lx, ld.ly, ld.lz);
      landMesh.castShadow = true;
      landMesh.receiveShadow = true;
      grp.add(landMesh);
    }

    const railH = 1.04;
    for (let i = 0; i < geom.handrails3d.length; i++) {
      const hr = geom.handrails3d[i];
      const dx = hr.x2 - hr.x1;
      const dy = hr.y2 - hr.y1;
      const dz = hr.z2 - hr.z1;
      const spanLen = Math.hypot(dx, dy, dz);
      if (spanLen > 0.05) {
        _railDir.set(dx, dy, dz).normalize();
        const railBar = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, spanLen), mats.brushedMetalMat);
        railBar.position.set((hr.x1 + hr.x2) * 0.5, (hr.y1 + hr.y2) * 0.5, (hr.z1 + hr.z2) * 0.5);
        railBar.quaternion.setFromUnitVectors(_zUnit, _railDir);
        railBar.castShadow = true;
        grp.add(railBar);
      }
      const postCount = spanLen > 2.2 ? 3 : 2;
      for (let p = 0; p < postCount; p++) {
        const t = postCount === 1 ? 0 : p / (postCount - 1);
        const px = hr.x1 + dx * t;
        const py = hr.y1 + dy * t;
        const pz = hr.z1 + dz * t;
        const postMesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, railH, 0.04), mats.brushedMetalMat);
        postMesh.position.set(px, py - railH * 0.5, pz);
        postMesh.castShadow = true;
        grp.add(postMesh);
      }
    }

    return grp;
  }

  function renderMapIntoGroup(mapData) {
    const mats = createRealisticMaterialPack(options.maxAnisotropy || 8, { lowRes: Boolean(options.lowRes) });
    materialPack = mats;
    const b = mapData.bounds;
    const H = b.height || 4.6;
    const floorH = Number(mapData.floorHeight) || H;

    mats.setFloorRepeat(b.width, b.depth);
    mats.setCeilingRepeat(b.width, b.depth);

    spatialCulling = new SpatialCullingEngine({
      chunkSize: 16,
      floorHeight: floorH,
      quality: qualityTier
    });
    spatialHash.floorHeight = floorH;
    spatialHash.clear();

    walkableSurfaces = buildWalkableSurfaceData(mapData);
    const effectiveOpenings = computeEffectiveFloorOpenings(mapData);
    const openingsByFloor = new Map();
    for (const op of effectiveOpenings) {
      spatialCulling.registerOpening(op);
      const opFloor = clampFloor(op.floor);
      if (!openingsByFloor.has(opFloor)) openingsByFloor.set(opFloor, []);
      openingsByFloor.get(opFloor).push(op);
    }

    const outdoorRects = [];
    for (const z of mapData.zones || []) {
      if (z.outdoor || z.code === 'COUR') {
        const r = {
          minX: z.x - (z.w || 4) * 0.5,
          maxX: z.x + (z.w || 4) * 0.5,
          minZ: z.z - (z.d || 4) * 0.5,
          maxZ: z.z + (z.d || 4) * 0.5,
          floor: clampFloor(z.floor ?? 0)
        };
        outdoorRects.push(r);
        spatialCulling.registerOutdoorZone(r);
      }
    }
    for (const o of mapData.objects || []) {
      if (o.type === 'courtyard_zone') {
        const r = {
          minX: o.x - (o.w || 8) * 0.5,
          maxX: o.x + (o.w || 8) * 0.5,
          minZ: o.z - (o.d || 8) * 0.5,
          maxZ: o.z + (o.d || 8) * 0.5,
          floor: clampFloor(o.floor ?? 0)
        };
        outdoorRects.push(r);
        spatialCulling.registerOutdoorZone(r);
      }
    }

    const slabFloors = walkableSurfaces.slabFloors || [];
    const minPresentFloor = slabFloors.length > 0 ? slabFloors[0].floor : 0;
    const maxPresentFloor = slabFloors.length > 0 ? slabFloors[slabFloors.length - 1].floor : 0;
    const frameGeoShared = new THREE.BoxGeometry(1.6, 0.07, 0.6);
    const panelGeoShared = new THREE.PlaneGeometry(1.45, 0.48);
    const dummyLed = new THREE.Object3D();

    const isInsideAnyRect = (px, pz, rectList) => {
      if (!rectList || rectList.length === 0) return false;
      for (let i = 0; i < rectList.length; i++) {
        const r = rectList[i];
        if (px >= r.minX - 0.3 && px <= r.maxX + 0.3 && pz >= r.minZ - 0.3 && pz <= r.maxZ + 0.3) {
          return true;
        }
      }
      return false;
    };

    const floorMetaByIdx = new Map();
    for (const fm of mapData.floors || []) {
      const idx = clampFloor(typeof fm === 'object' ? fm.index : fm);
      floorMetaByIdx.set(idx, typeof fm === 'object' ? fm : { index: idx, hasFullSlab: true, hasCeiling: true });
    }

    const isSparseCampus = Math.max(b.width, b.depth) > 260;

    if (isSparseCampus) {
      const campusSpanX = Math.max(b.width, 400);
      const campusSpanZ = Math.max(b.depth, 400);
      if (mats.campusGroundMat?.map) {
        const repX = Math.max(24, Math.round(campusSpanX / 10));
        const repZ = Math.max(24, Math.round(campusSpanZ / 10));
        mats.campusGroundMat.map.repeat.set(repX, repZ);
        mats.campusGroundMat.roughnessMap?.repeat?.set(repX, repZ);
        mats.campusGroundMat.bumpMap?.repeat?.set(repX, repZ);
      }
      const baseGround = new THREE.Mesh(
        new THREE.PlaneGeometry(campusSpanX, campusSpanZ),
        mats.campusGroundMat
      );
      baseGround.name = 'campus-base-ground';
      baseGround.rotation.x = -Math.PI / 2;
      baseGround.position.set((b.minX + b.maxX) * 0.5, -0.015, (b.minZ + b.maxZ) * 0.5);
      baseGround.receiveShadow = true;
      worldGroup.add(baseGround);

      const horizonMat = new THREE.MeshBasicMaterial({ color: '#9ab697' });
      const horizonSkirt = new THREE.Mesh(
        new THREE.PlaneGeometry(campusSpanX + 1600, campusSpanZ + 1600),
        horizonMat
      );
      horizonSkirt.name = 'campus-horizon-skirt';
      horizonSkirt.rotation.x = -Math.PI / 2;
      horizonSkirt.position.set((b.minX + b.maxX) * 0.5, -0.09, (b.minZ + b.maxZ) * 0.5);
      worldGroup.add(horizonSkirt);

      const skyRadius = Math.max(1200, Math.min(2300, Math.hypot(campusSpanX, campusSpanZ) * 0.72));
      const skyMat = new THREE.MeshBasicMaterial({
        map: makeCampusSkyTexture(),
        side: THREE.BackSide,
        fog: false,
        depthWrite: false
      });
      const skyDome = new THREE.Mesh(new THREE.SphereGeometry(skyRadius, 20, 12), skyMat);
      skyDome.name = 'campus-sky-dome';
      skyDome.position.set((b.minX + b.maxX) * 0.5, 0, (b.minZ + b.maxZ) * 0.5);
      worldGroup.add(skyDome);
    }

    const sparseOccupiedByFloor = new Map();
    const markSparseChunk = (fl, cx, cz) => {
      const f = clampFloor(fl);
      let set = sparseOccupiedByFloor.get(f);
      if (!set) {
        set = new Set();
        sparseOccupiedByFloor.set(f, set);
      }
      set.add(`${cx}:${cz}`);
    };
    const markSparseRect = (fl, minX, maxX, minZ, maxZ) => {
      const cx0 = Math.floor(minX / 16);
      const cx1 = Math.floor(maxX / 16);
      const cz0 = Math.floor(minZ / 16);
      const cz1 = Math.floor(maxZ / 16);
      for (let cx = cx0; cx <= cx1; cx++) {
        for (let cz = cz0; cz <= cz1; cz++) {
          markSparseChunk(fl, cx, cz);
        }
      }
    };

    if (isSparseCampus) {
      for (const w of mapData.walls || []) {
        const fl = clampFloor(w.floor ?? 0);
        const len = Math.hypot(w.x2 - w.x1, w.z2 - w.z1);
        const steps = Math.max(1, Math.ceil(len / 8));
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const px = w.x1 + (w.x2 - w.x1) * t;
          const pz = w.z1 + (w.z2 - w.z1) * t;
          markSparseChunk(fl, Math.floor(px / 16), Math.floor(pz / 16));
        }
      }
      for (const z of mapData.zones || []) {
        if (z.outdoor || z.code === 'COUR') continue;
        const fl = clampFloor(z.floor ?? 0);
        const hw = (z.w || 4) * 0.5;
        const hd = (z.d || 4) * 0.5;
        markSparseRect(fl, z.x - hw, z.x + hw, z.z - hd, z.z + hd);
      }
      for (const o of mapData.objects || []) {
        if (o.type === 'courtyard_zone' || o.type === 'spawn_point') continue;
        const fl = clampFloor(o.floor ?? 0);
        const hw = (o.w || 1) * 0.5;
        const hd = (o.d || 1) * 0.5;
        markSparseRect(fl, o.x - hw, o.x + hw, o.z - hd, o.z + hd);
        const cat = getCatalogItem(o.type);
        if (cat?.isStair && o.targetFloor !== undefined) {
          markSparseRect(clampFloor(o.targetFloor), o.x - hw, o.x + hw, o.z - hd, o.z + hd);
        }
      }
      for (const op of effectiveOpenings) {
        markSparseRect(op.floor, op.minX, op.maxX, op.minZ, op.maxZ);
      }
    }

    for (const flInfo of slabFloors) {
      const fl = flInfo.floor;
      const baseY = flInfo.y;
      const flMeta = floorMetaByIdx.get(fl) || null;
      const hasFloorBelow = fl > minPresentFloor && walkableSurfaces.slabsByFloor.has(fl - 1);
      const flOpenings = openingsByFloor.get(fl) || [];

      if (isSparseCampus) {
        const occSet = sparseOccupiedByFloor.get(fl);
        if (occSet && occSet.size > 0) {
          const ledBuckets = new Map();
          const aboveOpenings = openingsByFloor.get(fl + 1) || null;
          const ceilY = fl === maxPresentFloor ? baseY + H : baseY + floorH - SLAB_THICKNESS;
          const wantCeiling = flMeta?.hasCeiling !== false && (fl !== 0 || maxPresentFloor > 0);
          for (const key of occSet) {
            const sep = key.indexOf(':');
            const cx = Number(key.slice(0, sep));
            const cz = Number(key.slice(sep + 1));
            const chunkRect = {
              minX: Math.max(b.minX, cx * 16),
              maxX: Math.min(b.maxX, (cx + 1) * 16),
              minZ: Math.max(b.minZ, cz * 16),
              maxZ: Math.min(b.maxZ, (cz + 1) * 16)
            };
            if (chunkRect.maxX <= chunkRect.minX + 0.05 || chunkRect.maxZ <= chunkRect.minZ + 0.05) continue;
            const subRects = computeSlabRectangles(chunkRect, flOpenings, [chunkRect]);
            for (const sr of subRects) {
              const midX = (sr.minX + sr.maxX) * 0.5;
              const midZ = (sr.minZ + sr.maxZ) * 0.5;
              const floorTile = createChunkedHorizontalTile(
                sr.minX,
                sr.maxX,
                sr.minZ,
                sr.maxZ,
                b,
                mats.floorMat,
                baseY,
                false
              );
              spatialCulling.addNode(floorTile, midX, midZ, fl, 'structure');
              if (hasFloorBelow && sparseOccupiedByFloor.get(fl - 1)?.has(key)) {
                const soffitTile = createChunkedHorizontalTile(
                  sr.minX,
                  sr.maxX,
                  sr.minZ,
                  sr.maxZ,
                  b,
                  mats.ceilingMat,
                  baseY - SLAB_THICKNESS,
                  true
                );
                spatialCulling.addNode(soffitTile, midX, midZ, fl - 1, 'structure');
              }
            }
            if (wantCeiling && fl === maxPresentFloor) {
              const roofMidX = (chunkRect.minX + chunkRect.maxX) * 0.5;
              const roofMidZ = (chunkRect.minZ + chunkRect.maxZ) * 0.5;
              if (!isInsideAnyRect(roofMidX, roofMidZ, outdoorRects)) {
                const ceilTile = createChunkedHorizontalTile(
                  chunkRect.minX,
                  chunkRect.maxX,
                  chunkRect.minZ,
                  chunkRect.maxZ,
                  b,
                  mats.ceilingMat,
                  baseY + H,
                  true
                );
                spatialCulling.addNode(ceilTile, roofMidX, roofMidZ, fl, 'structure');
              }
            }
            if (wantCeiling) {
              const chunk = spatialCulling.getOrCreateChunk(cx * 16 + 8, cz * 16 + 8, fl);
              for (const ox of [4, 12]) {
                for (const oz of [4, 12]) {
                  const lx = cx * 16 + ox;
                  const lz = cz * 16 + oz;
                  if (lx < b.minX + 1 || lx > b.maxX - 1 || lz < b.minZ + 1 || lz > b.maxZ - 1) continue;
                  if (isInsideAnyRect(lx, lz, aboveOpenings)) continue;
                  if (isInsideAnyRect(lx, lz, outdoorRects)) continue;
                  let arr = ledBuckets.get(chunk);
                  if (!arr) {
                    arr = [];
                    ledBuckets.set(chunk, arr);
                  }
                  arr.push([lx, lz]);
                }
              }
            }
          }
          for (const [chunk, posList] of ledBuckets.entries()) {
            const framesInst = new THREE.InstancedMesh(frameGeoShared, mats.ledFrameMat, posList.length);
            const panelsInst = new THREE.InstancedMesh(panelGeoShared, mats.ledPanelMat, posList.length);
            for (let i = 0; i < posList.length; i++) {
              const [lx, lz] = posList[i];
              dummyLed.position.set(lx, ceilY - 0.05, lz);
              dummyLed.rotation.set(0, 0, 0);
              dummyLed.updateMatrix();
              framesInst.setMatrixAt(i, dummyLed.matrix);
              dummyLed.position.set(lx, ceilY - 0.09, lz);
              dummyLed.rotation.set(Math.PI / 2, 0, 0);
              dummyLed.updateMatrix();
              panelsInst.setMatrixAt(i, dummyLed.matrix);
            }
            framesInst.instanceMatrix.needsUpdate = true;
            panelsInst.instanceMatrix.needsUpdate = true;
            ceilingPanelMeshes.push(panelsInst);
            chunk.structureGroup.add(framesInst);
            chunk.structureGroup.add(panelsInst);
          }
        }
      } else {
        for (const rect of flInfo.rects) {
          const tiles = sliceRectByChunks(rect, 16);
          for (const tile of tiles) {
            const midX = (tile.minX + tile.maxX) * 0.5;
            const midZ = (tile.minZ + tile.maxZ) * 0.5;
            const floorTile = createChunkedHorizontalTile(
              tile.minX,
              tile.maxX,
              tile.minZ,
              tile.maxZ,
              b,
              mats.floorMat,
              baseY,
              false
            );
            spatialCulling.addNode(floorTile, midX, midZ, fl, 'structure');

            if (hasFloorBelow) {
              const soffitTile = createChunkedHorizontalTile(
                tile.minX,
                tile.maxX,
                tile.minZ,
                tile.maxZ,
                b,
                mats.ceilingMat,
                baseY - SLAB_THICKNESS,
                true
              );
              spatialCulling.addNode(soffitTile, midX, midZ, fl - 1, 'structure');
            }
          }
        }
      }

      for (const op of flOpenings) {
        const ox0 = Math.max(b.minX, op.minX);
        const ox1 = Math.min(b.maxX, op.maxX);
        const oz0 = Math.max(b.minZ, op.minZ);
        const oz1 = Math.min(b.maxZ, op.maxZ);
        const ow = ox1 - ox0;
        const od = oz1 - oz0;
        if (ow <= 0.1 || od <= 0.1) continue;
        const curbY = baseY - SLAB_THICKNESS * 0.5;
        const curbBars = [
          { cx: (ox0 + ox1) * 0.5, cz: oz0 + 0.04, w: ow, d: 0.08 },
          { cx: (ox0 + ox1) * 0.5, cz: oz1 - 0.04, w: ow, d: 0.08 },
          { cx: ox0 + 0.04, cz: (oz0 + oz1) * 0.5, w: 0.08, d: od },
          { cx: ox1 - 0.04, cz: (oz0 + oz1) * 0.5, w: 0.08, d: od }
        ];
        for (const cb of curbBars) {
          const curb = new THREE.Mesh(
            new THREE.BoxGeometry(cb.w, SLAB_THICKNESS, cb.d),
            mats.concreteMat
          );
          curb.position.set(cb.cx, curbY, cb.cz);
          curb.receiveShadow = true;
          spatialCulling.addNode(curb, cb.cx, cb.cz, fl, 'structure');
        }
      }

      if (!isSparseCampus && fl === maxPresentFloor && flMeta?.hasCeiling !== false) {
        const roofRects = flMeta?.hasFullSlab === false
          ? computeSlabRectangles(b, outdoorRects, flInfo.rects)
          : computeSlabRectangles(b, outdoorRects, null);
        const roofY = baseY + H;
        for (const rect of roofRects) {
          const tiles = sliceRectByChunks(rect, 16);
          for (const tile of tiles) {
            const ceilTile = createChunkedHorizontalTile(
              tile.minX,
              tile.maxX,
              tile.minZ,
              tile.maxZ,
              b,
              mats.ceilingMat,
              roofY,
              true
            );
            spatialCulling.addNode(ceilTile, (tile.minX + tile.maxX) * 0.5, (tile.minZ + tile.maxZ) * 0.5, fl, 'structure');
          }
        }
      }

      if (!isSparseCampus && flMeta?.hasCeiling !== false) {
        const ceilY = fl === maxPresentFloor ? baseY + H : baseY + floorH - SLAB_THICKNESS;
        const aboveOpenings = openingsByFloor.get(fl + 1) || null;
        const ledStepX = b.width > 60 ? 8.0 : 4.75;
        const ledStepZ = b.depth > 60 ? 8.0 : 6.0;
        const ledBuckets = new Map();

        for (let lx = b.minX + 3.2; lx <= b.maxX - 2.2; lx += ledStepX) {
          for (let lz = b.minZ + 3.0; lz <= b.maxZ - 2.0; lz += ledStepZ) {
            if (isInsideAnyRect(lx, lz, aboveOpenings)) continue;
            if (isInsideAnyRect(lx, lz, outdoorRects)) continue;
            if (flMeta?.hasFullSlab === false && !isInsideAnyRect(lx, lz, flInfo.rects)) continue;
            const chunk = spatialCulling.getOrCreateChunk(lx, lz, fl);
            let arr = ledBuckets.get(chunk);
            if (!arr) {
              arr = [];
              ledBuckets.set(chunk, arr);
            }
            arr.push([lx, lz]);
          }
        }

        for (const [chunk, posList] of ledBuckets.entries()) {
          const framesInst = new THREE.InstancedMesh(frameGeoShared, mats.ledFrameMat, posList.length);
          const panelsInst = new THREE.InstancedMesh(panelGeoShared, mats.ledPanelMat, posList.length);
          for (let i = 0; i < posList.length; i++) {
            const [lx, lz] = posList[i];
            dummyLed.position.set(lx, ceilY - 0.05, lz);
            dummyLed.rotation.set(0, 0, 0);
            dummyLed.updateMatrix();
            framesInst.setMatrixAt(i, dummyLed.matrix);
            dummyLed.position.set(lx, ceilY - 0.09, lz);
            dummyLed.rotation.set(Math.PI / 2, 0, 0);
            dummyLed.updateMatrix();
            panelsInst.setMatrixAt(i, dummyLed.matrix);
          }
          framesInst.instanceMatrix.needsUpdate = true;
          panelsInst.instanceMatrix.needsUpdate = true;
          ceilingPanelMeshes.push(panelsInst);
          chunk.structureGroup.add(framesInst);
          chunk.structureGroup.add(panelsInst);
        }
      }
    }

    const resolveZoneSurfaceMat = (z) => {
      if (z.surfaceKind === 'asphalt') return mats.asphaltMat;
      if (z.surfaceKind === 'grass') return mats.grassMat;
      if (z.surfaceKind === 'path') return mats.pathMat;
      if (z.surfaceKind === 'sport') return mats.sportMat;
      if (z.surfaceKind === 'concrete' || z.outdoor || z.code === 'COUR') return mats.courtyardMat;
      return new THREE.MeshBasicMaterial({
        color: z.color || '#0284c7',
        transparent: true,
        opacity: z.code === 'ESC' || z.id === 'ESCALIER' ? 0.11 : 0.055,
        side: THREE.DoubleSide
      });
    };

    for (const z of mapData.zones || []) {
      if (z.code === 'U300' && !Array.isArray(z.points)) continue;
      const zFloor = clampFloor(z.floor ?? 0);
      const zBaseY = getFloorBaseY(mapData, zFloor);
      const pts = getZonePolygonPoints(z);
      if (pts.length < 3) continue;
      const shape = new THREE.Shape();
      pts.forEach((p, idx) => {
        if (idx === 0) shape.moveTo(p.x, -p.z);
        else shape.lineTo(p.x, -p.z);
      });
      shape.closePath();
      const padMat = resolveZoneSurfaceMat(z);
      const pad = new THREE.Mesh(new THREE.ShapeGeometry(shape), padMat);
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(0, zBaseY + (z.outdoor || z.code === 'COUR' || z.surfaceKind ? 0.012 : 0.008), 0);
      spatialCulling.addNode(pad, Number(z.x) || 0, Number(z.z) || 0, zFloor, 'structure');
    }

    const wallSegments = subtractDoorsFromWalls(mapData.walls || []);
    const chunkedWallSegments = [];
    const maxWallPieceLen = 14;
    for (const seg of wallSegments) {
      const len = Math.hypot(seg.x2 - seg.x1, seg.z2 - seg.z1);
      if (len < 0.12) continue;
      if (len <= maxWallPieceLen || seg.kind === 'door_single' || seg.kind === 'door_double') {
        chunkedWallSegments.push(seg);
        continue;
      }
      const parts = Math.ceil(len / maxWallPieceLen);
      for (let p = 0; p < parts; p++) {
        const t0 = p / parts;
        const t1 = (p + 1) / parts;
        chunkedWallSegments.push({
          ...seg,
          x1: seg.x1 + (seg.x2 - seg.x1) * t0,
          z1: seg.z1 + (seg.z2 - seg.z1) * t0,
          x2: seg.x1 + (seg.x2 - seg.x1) * t1,
          z2: seg.z1 + (seg.z2 - seg.z1) * t1
        });
      }
    }

    for (const seg of chunkedWallSegments) {
      const dx = seg.x2 - seg.x1;
      const dz = seg.z2 - seg.z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.12) continue;
      const cx = (seg.x1 + seg.x2) / 2;
      const cz = (seg.z1 + seg.z2) / 2;
      const angle = -Math.atan2(dz, dx);
      const wallFloor = clampFloor(seg.floor ?? 0);
      const wallBaseY = getFloorBaseY(mapData, wallFloor);
      const wallH = seg.kind === 'railing'
        ? Math.min(H, Math.max(0.95, seg.height || 1.05))
        : Math.max(1.2, Math.min(H, seg.height || H));
      const thick = Math.max(0.08, seg.thickness || 0.18);

      if (seg.kind === 'door_single' || seg.kind === 'door_double') {
        const grp = new THREE.Group();
        grp.position.set(cx, wallBaseY, cz);
        grp.rotation.y = angle;

        const doorH = 2.4;
        const lintelH = Math.max(0.25, wallH - doorH);
        const lintel = new THREE.Mesh(
          new THREE.BoxGeometry(len, lintelH, thick),
          mats.getWallMaterial(len, seg.color)
        );
        lintel.position.y = doorH + lintelH / 2;
        lintel.castShadow = true;
        lintel.receiveShadow = true;
        grp.add(lintel);

        const jambThick = Math.min(0.09, len * 0.15);
        for (const sx of [-len / 2 + jambThick / 2, len / 2 - jambThick / 2]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(jambThick, doorH, thick + 0.03), mats.doorFrameMat);
          post.position.set(sx, doorH / 2, 0);
          post.castShadow = true;
          post.receiveShadow = true;
          grp.add(post);
        }

        const headerBar = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, thick + 0.04), mats.doorFrameMat);
        headerBar.position.set(0, doorH - 0.03, 0);
        headerBar.castShadow = true;
        grp.add(headerBar);

        if (seg.doorLabel) {
          addDoorSign(grp, 0, 0, Math.min(2.66, wallH - 0.34), 0, thick, seg.doorLabel, seg.color || '#0284c7', mats.brushedMetalMat);
        }
        spatialCulling.addNode(grp, cx, cz, wallFloor, 'structure');
        continue;
      }

      if (seg.kind === 'glazed') {
        const grp = new THREE.Group();
        grp.position.set(cx, wallBaseY, cz);
        grp.rotation.y = angle;

        const dadoH = 1.05;
        const glassH = Math.max(0.5, wallH - 2.6);
        const topStart = dadoH + glassH;
        const topH = Math.max(0.3, wallH - topStart);

        const dado = new THREE.Mesh(new THREE.BoxGeometry(len, dadoH, thick), mats.dadoMat);
        dado.position.y = dadoH / 2;
        dado.castShadow = true;
        dado.receiveShadow = true;
        grp.add(dado);

        const glass = new THREE.Mesh(
          new THREE.BoxGeometry(len, glassH, 0.045),
          mats.glassMat
        );
        glass.position.y = dadoH + glassH / 2;
        grp.add(glass);

        const topWall = new THREE.Mesh(
          new THREE.BoxGeometry(len, topH, thick),
          mats.getWallMaterial(len, seg.color)
        );
        topWall.position.y = topStart + topH / 2;
        topWall.castShadow = true;
        topWall.receiveShadow = true;
        grp.add(topWall);

        const midRail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, thick + 0.015), mats.brushedMetalMat);
        midRail.position.y = dadoH + 0.01;
        grp.add(midRail);

        const topRail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, thick + 0.015), mats.brushedMetalMat);
        topRail.position.y = topStart - 0.01;
        grp.add(topRail);

        spatialCulling.addNode(grp, cx, cz, wallFloor, 'structure');
        continue;
      }

      if (seg.kind === 'window_bay') {
        const grp = new THREE.Group();
        grp.position.set(cx, wallBaseY, cz);
        grp.rotation.y = angle;

        const sillH = 0.52;
        const topBeamH = 0.42;
        const glassH = Math.max(0.8, wallH - sillH - topBeamH);

        const sill = new THREE.Mesh(new THREE.BoxGeometry(len, sillH, thick), mats.dadoMat);
        sill.position.y = sillH * 0.5;
        sill.castShadow = true;
        sill.receiveShadow = true;
        grp.add(sill);

        const glass = new THREE.Mesh(new THREE.BoxGeometry(len, glassH, 0.04), mats.glassMat);
        glass.position.y = sillH + glassH * 0.5;
        grp.add(glass);

        const beam = new THREE.Mesh(new THREE.BoxGeometry(len, topBeamH, thick), mats.exteriorWallMat);
        beam.position.y = sillH + glassH + topBeamH * 0.5;
        beam.castShadow = true;
        grp.add(beam);

        const mullionCount = Math.max(2, Math.round(len / 2.2) + 1);
        for (let m = 0; m < mullionCount; m++) {
          const mx = -len * 0.5 + (len * m) / (mullionCount - 1);
          const mul = new THREE.Mesh(new THREE.BoxGeometry(0.06, glassH + 0.04, thick * 0.8), mats.darkMetalMat);
          mul.position.set(mx, sillH + glassH * 0.5, 0);
          grp.add(mul);
        }

        spatialCulling.addNode(grp, cx, cz, wallFloor, 'structure');
        continue;
      }

      if (seg.kind === 'railing') {
        const grp = new THREE.Group();
        grp.position.set(cx, wallBaseY, cz);
        grp.rotation.y = angle;
        const railH = Math.max(0.95, Math.min(1.3, wallH));

        const curb = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, Math.max(0.08, thick)), mats.brushedMetalMat);
        curb.position.y = 0.04;
        grp.add(curb);

        const panel = new THREE.Mesh(new THREE.BoxGeometry(len, railH - 0.16, 0.03), mats.glassMat);
        panel.position.y = railH * 0.5;
        grp.add(panel);

        const topBar = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, Math.max(0.08, thick)), mats.brushedMetalMat);
        topBar.position.y = railH - 0.03;
        topBar.castShadow = true;
        grp.add(topBar);

        const postCount = Math.max(2, Math.round(len / 1.5) + 1);
        for (let p = 0; p < postCount; p++) {
          const px = -len * 0.5 + (len * p) / (postCount - 1);
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, railH, 0.05), mats.darkMetalMat);
          post.position.set(px, railH * 0.5, 0);
          grp.add(post);
        }

        spatialCulling.addNode(grp, cx, cz, wallFloor, 'structure');
        continue;
      }

      const grp = new THREE.Group();
      grp.position.set(cx, wallBaseY, cz);
      grp.rotation.y = angle;

      const useExteriorMat =
        seg.kind === 'exterior' && (!seg.color || seg.color === '#475569' || seg.color === '#94a3b8');
      const solidMat = useExteriorMat ? mats.exteriorWallMat : mats.getWallMaterial(len, seg.color);

      const solid = new THREE.Mesh(new THREE.BoxGeometry(len, wallH, thick), solidMat);
      solid.position.y = wallH / 2;
      solid.castShadow = true;
      solid.receiveShadow = true;
      solid.userData.isSolidWall = true;
      solid.userData.floor = wallFloor;
      grp.add(solid);
      solidWallMeshes.push(solid);
      spatialCulling.registerOpaqueWall({ ...seg, floor: wallFloor });

      const trim = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, thick + 0.02), mats.plinthMat);
      trim.position.y = 0.05;
      trim.receiveShadow = true;
      grp.add(trim);

      spatialCulling.addNode(grp, cx, cz, wallFloor, 'structure');
    }

    const supportBoxes = [];
    for (const o of mapData.objects || []) {
      const cat = getCatalogItem(o.type);
      if (cat?.supportTop) {
        supportBoxes.push({
          id: o.id,
          floor: clampFloor(o.floor ?? 0),
          x: o.x,
          z: o.z,
          hw: (o.w || cat.defaultW) / 2,
          hd: (o.d || cat.defaultD) / 2,
          rad: ((o.rotation || 0) * Math.PI) / 180,
          supportTop: cat.supportTop
        });
      }
    }

    const orientTex = makeOrientationMapTexture(mapData);

    const buildSpecialModeDoor = (obj, w, d, rotRad, cat, objBaseY = 0, objFloor = 0) => {
      const isCombat = obj.type === 'combat_door';
      const doorGrp = new THREE.Group();
      doorGrp.position.set(obj.x, objBaseY, obj.z);
      doorGrp.rotation.y = rotRad;
      const chunk = spatialCulling.addNode(doorGrp, obj.x, obj.z, objFloor, 'detail');

      const accentColor = obj.color || (isCombat ? '#06b6d4' : '#e11d48');
      const doorW = Math.max(1.2, w);
      const doorH = 2.6;
      const doorD = Math.max(0.28, d);
      const frameMat = new THREE.MeshStandardMaterial({
        color: '#1e293b',
        roughness: 0.35,
        metalness: 0.72,
        emissive: '#000000',
        emissiveIntensity: 0
      });
      const leftPost = new THREE.Mesh(new THREE.BoxGeometry(0.16, doorH, doorD), frameMat);
      leftPost.position.set(-doorW / 2 + 0.08, doorH / 2, 0);
      leftPost.castShadow = true;
      doorGrp.add(leftPost);

      const rightPost = new THREE.Mesh(new THREE.BoxGeometry(0.16, doorH, doorD), frameMat);
      rightPost.position.set(doorW / 2 - 0.08, doorH / 2, 0);
      rightPost.castShadow = true;
      doorGrp.add(rightPost);

      const topLintel = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.14, 0.24, doorD + 0.06), frameMat);
      topLintel.position.set(0, doorH + 0.12, 0);
      topLintel.castShadow = true;
      doorGrp.add(topLintel);

      const portalMat = new THREE.MeshBasicMaterial({
        color: accentColor,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide
      });
      const portalPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.max(0.8, doorW - 0.32), doorH - 0.08),
        portalMat
      );
      portalPlane.position.set(0, (doorH - 0.08) / 2, 0);
      doorGrp.add(portalPlane);

      const defaultTitle = isCombat ? '⚔️ ARÈNE DE COMBAT CIEL' : 'SURVIE HORREUR • TRAQUE CIEL';
      const signTex = makeDoorSignTexture(obj.label || defaultTitle, accentColor);
      const signMat = new THREE.MeshBasicMaterial({ map: signTex });
      const signFront = new THREE.Mesh(new THREE.PlaneGeometry(doorW * 0.92, 0.26), signMat);
      signFront.position.set(0, doorH + 0.12, (doorD + 0.06) / 2 + 0.005);
      doorGrp.add(signFront);
      const signBack = new THREE.Mesh(new THREE.PlaneGeometry(doorW * 0.92, 0.26), signMat);
      signBack.rotation.y = Math.PI;
      signBack.position.set(0, doorH + 0.12, -(doorD + 0.06) / 2 - 0.005);
      doorGrp.add(signBack);

      const beaconMat = new THREE.MeshBasicMaterial({ color: isCombat ? '#22d3ee' : '#f43f5e' });
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), beaconMat);
      beacon.position.set(0, doorH + 0.34, 0);
      doorGrp.add(beacon);
      animatedRefs.survivalBeacons.push({ mesh: beacon, portal: portalMat, phase: (obj.x + obj.z) * 0.3, chunk });

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.75, 0.96, 32),
        new THREE.MeshBasicMaterial({ color: accentColor, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      doorGrp.add(ring);

      if (showSprites) {
        const sprite = makeStationLabelSprite(
          obj.label || (isCombat ? 'Arène de Combat CIEL' : 'Mode Survie Horreur'),
          isCombat ? '⚔️' : '🚪',
          accentColor
        );
        sprite.position.set(0, doorH + 0.72, 0);
        doorGrp.add(sprite);
      }

      const doorEntry = {
        id: obj.id,
        type: obj.type,
        label: isCombat
          ? `[E] ⚔️ ${obj.label || 'Entrer — Arène de Combat CIEL'}`
          : `[E] 🚪 ${obj.label || 'Entrer — Mode Survie Horreur'}`,
        position: new THREE.Vector3(obj.x, objBaseY, obj.z),
        floor: objFloor,
        rotation: rotRad,
        interactRadius: cat?.interactRadius || 2.6,
        ring,
        mesh: doorGrp,
        highlightMats: [frameMat]
      };
      if (isCombat) {
        combatDoors.push(doorEntry);
      } else {
        survivalDoors.push(doorEntry);
      }
      interactables.push(doorEntry);
    };

    for (const obj of mapData.objects || []) {
      const cat = getCatalogItem(obj.type);
      if (!cat) continue;
      if (cat.isOpening || obj.type === 'slab_opening') continue;

      const w = Math.max(0.2, obj.w || cat.defaultW || 1);
      const d = Math.max(0.2, obj.d || cat.defaultD || 1);
      const color = obj.color || cat.defaultColor || '#38bdf8';
      const rotRad = ((obj.rotation || 0) * Math.PI) / 180;
      const objFloor = clampFloor(obj.floor ?? 0);
      const objBaseY = getFloorBaseY(mapData, objFloor);

      if (cat.isStair) {
        const geom = computeStairGeometry(obj, floorH);
        const stairGrp = buildStaircaseMeshGroup(geom, mats);
        spatialCulling.addNode(stairGrp, obj.x, obj.z, objFloor, 'structure');
        continue;
      }

      if (obj.type === 'npc_teacher') {
        const chunk = spatialCulling.getOrCreateChunk(obj.x, obj.z, objFloor);
        const res = createNpcTeacher(chunk.detailGroup, {
          x: obj.x,
          y: objBaseY,
          z: obj.z,
          floor: objFloor,
          rotation: obj.rotation || 0,
          label: obj.label || 'Professeur CIEL',
          dialogue: obj.dialogue || '',
          interactRadius: cat.interactRadius || 3.1
        });
        res.chunk = chunk;
        teacherRefs.push(res);
        interactables.push(res.interactable);
        continue;
      }

      if (obj.type === 'survival_door' || obj.type === 'combat_door') {
        buildSpecialModeDoor(obj, w, d, rotRad, cat, objBaseY, objFloor);
        continue;
      }

      if (cat.isCustomModel) {
        const modelGrp = new THREE.Group();
        modelGrp.position.set(obj.x, objBaseY + (Number(obj.elevation) || 0), obj.z);
        modelGrp.rotation.y = rotRad;
        spatialCulling.addNode(modelGrp, obj.x, obj.z, objFloor, 'detail');
        attachImportedModel(modelGrp, mapData.models, obj);
        continue;
      }

      const category =
        obj.type === 'stair_block' ||
        obj.type === 'pillar_column' ||
        obj.type === 'floor_slab' ||
        obj.type === 'courtyard_zone' ||
        obj.type === 'railing_guard' ||
        obj.type === 'wall_exterior' ||
        obj.type === 'wall_window_bay'
          ? 'structure'
          : 'detail';

      const grp = new THREE.Group();
      grp.position.set(obj.x, objBaseY, obj.z);
      grp.rotation.y = rotRad;
      const chunk = spatialCulling.addNode(grp, obj.x, obj.z, objFloor, category);

      if (obj.type === 'pillar_column') {
        const pillarH = Math.max(2.2, H);
        const col = new THREE.Mesh(new THREE.BoxGeometry(w, pillarH, d), mats.concreteMat);
        col.position.y = pillarH * 0.5;
        col.castShadow = true;
        col.receiveShadow = true;
        grp.add(col);
        const capBot = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.14, d + 0.06), mats.brushedMetalMat);
        capBot.position.y = 0.07;
        grp.add(capBot);
        const capTop = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.14, d + 0.06), mats.brushedMetalMat);
        capTop.position.y = pillarH - 0.07;
        grp.add(capTop);
        continue;
      }

      if (obj.type === 'floor_slab') {
        const slabMesh = new THREE.Mesh(new THREE.BoxGeometry(w, SLAB_THICKNESS, d), mats.concreteMat);
        slabMesh.position.y = -SLAB_THICKNESS * 0.5;
        slabMesh.receiveShadow = true;
        grp.add(slabMesh);
        continue;
      }

      if (obj.type === 'courtyard_zone') {
        const deck = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mats.courtyardMat);
        deck.rotation.x = -Math.PI / 2;
        deck.position.y = 0.015;
        deck.receiveShadow = true;
        grp.add(deck);
        continue;
      }

      if (obj.type === 'railing_guard') {
        const railH = 1.04;
        const panel = new THREE.Mesh(new THREE.BoxGeometry(w, railH - 0.14, 0.03), mats.glassMat);
        panel.position.y = railH * 0.5;
        grp.add(panel);
        const topRail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, Math.max(0.08, d)), mats.brushedMetalMat);
        topRail.position.y = railH - 0.03;
        topRail.castShadow = true;
        grp.add(topRail);
        const postCount = Math.max(2, Math.round(w / 1.2) + 1);
        for (let p = 0; p < postCount; p++) {
          const px = -w * 0.5 + (w * p) / (postCount - 1);
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, railH, 0.05), mats.darkMetalMat);
          post.position.set(px, railH * 0.5, 0);
          grp.add(post);
        }
        continue;
      }

      if (obj.type === 'wall_exterior') {
        const solid = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), mats.exteriorWallMat);
        solid.position.y = H * 0.5;
        solid.castShadow = true;
        solid.receiveShadow = true;
        solid.userData.isSolidWall = true;
        solid.userData.floor = objFloor;
        grp.add(solid);
        solidWallMeshes.push(solid);
        const cos = Math.cos(rotRad);
        const sin = Math.sin(rotRad);
        const hw = w * 0.5;
        spatialCulling.registerOpaqueWall({
          kind: 'exterior',
          floor: objFloor,
          x1: obj.x - hw * cos,
          z1: obj.z + hw * sin,
          x2: obj.x + hw * cos,
          z2: obj.z - hw * sin
        });
        continue;
      }

      if (obj.type === 'wall_window_bay') {
        const sillH = 0.52;
        const topBeamH = 0.42;
        const glassH = Math.max(0.8, H - sillH - topBeamH);
        const sill = new THREE.Mesh(new THREE.BoxGeometry(w, sillH, d), mats.dadoMat);
        sill.position.y = sillH * 0.5;
        grp.add(sill);
        const glass = new THREE.Mesh(new THREE.BoxGeometry(w, glassH, 0.04), mats.glassMat);
        glass.position.y = sillH + glassH * 0.5;
        grp.add(glass);
        const beam = new THREE.Mesh(new THREE.BoxGeometry(w, topBeamH, d), mats.exteriorWallMat);
        beam.position.y = sillH + glassH + topBeamH * 0.5;
        grp.add(beam);
        continue;
      }

      const prevRingLen = animatedRefs.rings.length;
      const prevLedLen = animatedRefs.leds.length;
      const prevBeaconLen = animatedRefs.survivalBeacons.length;
      const prevPcLen = pcStations.length;
      const prevInteractLen = interactables.length;

      const finalizeObjChunkTags = () => {
        for (let k = prevRingLen; k < animatedRefs.rings.length; k++) animatedRefs.rings[k].chunk = chunk;
        for (let k = prevLedLen; k < animatedRefs.leds.length; k++) animatedRefs.leds[k].chunk = chunk;
        for (let k = prevBeaconLen; k < animatedRefs.survivalBeacons.length; k++) animatedRefs.survivalBeacons[k].chunk = chunk;
        for (let k = prevPcLen; k < pcStations.length; k++) pcStations[k].chunk = chunk;
        for (let k = prevInteractLen; k < interactables.length; k++) {
          if (interactables[k].floor === undefined) interactables[k].floor = objFloor;
        }
      };

      try {
      if (obj.type === 'hiding_rack') {
        const rackH = 2.18;
        const bodyMat = new THREE.MeshStandardMaterial({
          color: '#0f172a',
          roughness: 0.42,
          metalness: 0.65,
          emissive: '#000000',
          emissiveIntensity: 0
        });
        const interiorMat = new THREE.MeshStandardMaterial({
          color: '#060a12',
          roughness: 0.56,
          metalness: 0.72,
          side: THREE.DoubleSide
        });
        const sideW = 0.08;
        const leftWall = new THREE.Mesh(new THREE.BoxGeometry(sideW, rackH, d), bodyMat);
        leftWall.position.set(-w / 2 + sideW / 2, rackH / 2, 0);
        leftWall.castShadow = true;
        grp.add(leftWall);

        const rightWall = new THREE.Mesh(new THREE.BoxGeometry(sideW, rackH, d), bodyMat);
        rightWall.position.set(w / 2 - sideW / 2, rackH / 2, 0);
        rightWall.castShadow = true;
        grp.add(rightWall);

        const backWall = new THREE.Mesh(new THREE.BoxGeometry(w, rackH, 0.08), bodyMat);
        backWall.position.set(0, rackH / 2, -d / 2 + 0.04);
        backWall.castShadow = true;
        grp.add(backWall);

        const topCap = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), bodyMat);
        topCap.position.set(0, rackH - 0.05, 0);
        grp.add(topCap);

        const innerFloor = new THREE.Mesh(new THREE.BoxGeometry(w - 0.16, 0.04, d - 0.12), interiorMat);
        innerFloor.position.set(0, 0.02, -0.02);
        grp.add(innerFloor);

        const innerBack = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.16, rackH - 0.14), interiorMat);
        innerBack.position.set(0, rackH / 2, -d / 2 + 0.085);
        grp.add(innerBack);

        const innerLeft = new THREE.Mesh(new THREE.PlaneGeometry(d - 0.12, rackH - 0.14), interiorMat);
        innerLeft.rotation.y = Math.PI / 2;
        innerLeft.position.set(-w / 2 + sideW + 0.004, rackH / 2, -0.02);
        grp.add(innerLeft);

        const innerRight = new THREE.Mesh(new THREE.PlaneGeometry(d - 0.12, rackH - 0.14), interiorMat);
        innerRight.rotation.y = -Math.PI / 2;
        innerRight.position.set(w / 2 - sideW - 0.004, rackH / 2, -0.02);
        grp.add(innerRight);

        const railGeo = new THREE.BoxGeometry(0.035, rackH - 0.24, 0.035);
        const railL = new THREE.Mesh(railGeo, mats.brushedMetalMat);
        railL.position.set(-w / 2 + sideW + 0.04, rackH / 2, d / 2 - 0.14);
        grp.add(railL);
        const railR = new THREE.Mesh(railGeo, mats.brushedMetalMat);
        railR.position.set(w / 2 - sideW - 0.04, rackH / 2, d / 2 - 0.14);
        grp.add(railR);

        const interiorLeds = [];
        const ledPalette = ['#22d3ee', '#10b981', '#f59e0b', '#38bdf8'];
        for (let li = 0; li < 8; li++) {
          const ledMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.022, 0.012, 0.014),
            new THREE.MeshBasicMaterial({ color: ledPalette[li % ledPalette.length] })
          );
          if (li < 4) {
            const sideSign = li % 2 === 0 ? -1 : 1;
            ledMesh.position.set(
              sideSign * (w / 2 - sideW - 0.018),
              0.72 + (li % 4) * 0.34,
              -d / 2 + 0.22 + Math.floor(li / 2) * 0.14
            );
          } else {
            ledMesh.position.set(
              -w * 0.28 + (li - 4) * (w * 0.18),
              0.88 + ((li - 4) % 2) * 0.42,
              -d / 2 + 0.098
            );
          }
          grp.add(ledMesh);
          interiorLeds.push(ledMesh);
          animatedRefs.leds.push({ mesh: ledMesh, phase: obj.x * 0.7 + li * 0.9, alert: false });
        }

        const stileW = 0.06;
        const leftStile = new THREE.Mesh(new THREE.BoxGeometry(stileW, rackH - 0.1, 0.04), bodyMat);
        leftStile.position.set(-w / 2 + sideW + stileW / 2 - 0.01, rackH / 2, d / 2 - 0.03);
        grp.add(leftStile);
        const rightStile = new THREE.Mesh(new THREE.BoxGeometry(stileW, rackH - 0.1, 0.04), bodyMat);
        rightStile.position.set(w / 2 - sideW - stileW / 2 + 0.01, rackH / 2, d / 2 - 0.03);
        grp.add(rightStile);
        const topRail = new THREE.Mesh(new THREE.BoxGeometry(w - 0.14, 0.11, 0.04), bodyMat);
        topRail.position.set(0, rackH - 0.11, d / 2 - 0.03);
        grp.add(topRail);
        const botRail = new THREE.Mesh(new THREE.BoxGeometry(w - 0.14, 0.11, 0.04), bodyMat);
        botRail.position.set(0, 0.09, d / 2 - 0.03);
        grp.add(botRail);

        if (!perfRackDoorTex) {
          perfRackDoorTex = makePerforatedRackDoorTexture();
        }
        const doorMat = new THREE.MeshStandardMaterial({
          color: '#1e293b',
          map: perfRackDoorTex,
          roughness: 0.36,
          metalness: 0.72,
          transparent: true,
          alphaTest: 0.45,
          side: THREE.DoubleSide,
          emissive: '#000000',
          emissiveIntensity: 0
        });
        const doorMesh = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.24, rackH - 0.34), doorMat);
        doorMesh.position.set(0, rackH / 2, d / 2 - 0.03);
        doorMesh.castShadow = false;
        doorMesh.userData.isPerforatedDoor = true;
        grp.add(doorMesh);

        for (const vy of [0.15, rackH - 0.16]) {
          const vent = new THREE.Mesh(new THREE.BoxGeometry(w * 0.62, 0.035, 0.02), mats.brushedMetalMat);
          vent.position.set(0, vy, d / 2 - 0.005);
          grp.add(vent);
        }

        const statusLed = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.045, 0.03),
          new THREE.MeshBasicMaterial({ color: obj.color || '#38bdf8' })
        );
        statusLed.position.set(0, rackH - 0.14, d / 2 + 0.01);
        grp.add(statusLed);
        animatedRefs.leds.push({ mesh: statusLed, phase: obj.x * 0.4, alert: false });

        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.62, 0.78, 28),
          new THREE.MeshBasicMaterial({ color: obj.color || '#38bdf8', side: THREE.DoubleSide, transparent: true, opacity: 0.55 })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(0, 0.028, d * 0.55);
        grp.add(ring);

        const exitInfo = computeRackExitPosition(
          { x: obj.x, z: obj.z, rotRad, w, d },
          colliders,
          mapData.bounds,
          0.42
        );
        const interiorPos = computeRackInteriorPosition({ x: obj.x, z: obj.z, rotRad, w, d });
        if (interiorPos) interiorPos.y = (Number(interiorPos.y) || 0) + objBaseY;
        const hideEntry = {
          id: obj.id,
          hidingId: obj.id,
          type: 'hiding_rack',
          label: `[E] 🗄️ Se cacher — ${obj.label || 'Baie de Brassage'}`,
          x: obj.x,
          z: obj.z,
          position: new THREE.Vector3(obj.x, objBaseY, obj.z),
          floor: objFloor,
          rotation: rotRad,
          rotRad,
          rad: rotRad,
          rotationDeg: Number(obj.rotation) || 0,
          w,
          d,
          interiorPos,
          hasInterior: true,
          interiorLeds,
          perforatedDoor: doorMesh,
          exitX: exitInfo.x,
          exitZ: exitInfo.z,
          exitPos: new THREE.Vector3(exitInfo.x, objBaseY, exitInfo.z),
          interactRadius: cat.interactRadius || 2.3,
          ring,
          doorMesh,
          mesh: grp,
          highlightMats: [bodyMat, doorMat]
        };
        hidingSpots.push(hideEntry);
        interactables.push(hideEntry);
        continue;
      }

      if (obj.type === 'spawn_point') {
        const pad = new THREE.Mesh(
          new THREE.RingGeometry(0.42, 0.56, 28),
          new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.42 })
        );
        pad.rotation.x = -Math.PI / 2;
        pad.position.y = 0.02;
        grp.add(pad);
        const arrow = new THREE.Mesh(
          new THREE.ConeGeometry(0.18, 0.32, 3),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 })
        );
        arrow.rotation.x = Math.PI / 2;
        arrow.position.set(0, 0.04, 0.35);
        grp.add(arrow);
        continue;
      }

      if (obj.type === 'leaderboard') {
        const lb = createWallLeaderboardBoard(grp, obj, mats);
        leaderboardBoards.push(lb);
        continue;
      }

      if (obj.type === 'wall_map_board') {
        const frameW = Math.max(1.4, w);
        const frameH = frameW * 0.65;
        const frameD = 0.07;
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(frameW, frameH, frameD),
          mats.brushedMetalMat
        );
        frame.position.set(0, 2.25, WALL_MOUNT_CLEARANCE + frameD / 2);
        grp.add(frame);
        const face = new THREE.Mesh(
          new THREE.PlaneGeometry(frameW - 0.12, frameH - 0.12),
          new THREE.MeshBasicMaterial({ map: orientTex })
        );
        face.position.set(0, 2.25, WALL_MOUNT_CLEARANCE + frameD + 0.005);
        grp.add(face);
        continue;
      }

      if (obj.type === 'stair_block') {
        const stepMat = mats.concreteMat;
        const railMat = mats.brushedMetalMat;
        const sx = w / 4.2;
        const sz = d / 3.66;
        for (let s = 0; s < 10; s++) {
          const step = new THREE.Mesh(new THREE.BoxGeometry(1.4 * sx, 0.2, 0.34 * sz), stepMat);
          step.position.set(-1.05 * sx, 0.1 + s * 0.22, (-1.48 + s * 0.31) * sz);
          step.castShadow = true;
          step.receiveShadow = true;
          grp.add(step);
        }
        const landing = new THREE.Mesh(new THREE.BoxGeometry(3.6 * sx, 0.24, 1.3 * sz), stepMat);
        landing.position.set(0, 2.3, 1.07 * sz);
        landing.castShadow = true;
        landing.receiveShadow = true;
        grp.add(landing);
        for (let s = 0; s < 8; s++) {
          const step2 = new THREE.Mesh(new THREE.BoxGeometry(1.4 * sx, 0.2, 0.3 * sz), stepMat);
          step2.position.set(1.15 * sx, 2.52 + s * 0.22, (0.37 - s * 0.28) * sz);
          step2.castShadow = true;
          step2.receiveShadow = true;
          grp.add(step2);
        }
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.2 * sz, 8), railMat);
        rail.rotation.x = Math.PI / 2 - 0.58;
        rail.position.set(-0.28 * sx, 1.85, -0.13 * sz);
        grp.add(rail);
        continue;
      }

      if (cat.tpId) {
        const stationDef = ALL_STATIONS_MAP.get(cat.tpId) || {
          id: cat.tpId,
          title: obj.label || cat.label,
          shortTitle: obj.label || cat.shortLabel,
          icon: cat.icon,
          color,
          room: ''
        };

        if (obj.type === 'tp_soldering') {
          const bench = buildWorkbenchMesh(w, d, 0.84, mats, true);
          grp.add(bench);
          const esd = new THREE.Mesh(
            new THREE.BoxGeometry(Math.min(w * 0.72, 1.4), 0.02, Math.min(d * 0.72, 1.05)),
            mats.esdMat
          );
          esd.position.y = 0.88;
          grp.add(esd);
          const unit = new THREE.Mesh(
            new THREE.BoxGeometry(0.36, 0.24, 0.34),
            new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.48, metalness: 0.08 })
          );
          unit.position.set(-w * 0.22, 1.0, 0);
          grp.add(unit);
          const hood = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.45, 4), mats.brushedMetalMat);
          hood.rotation.y = Math.PI / 4;
          hood.position.set(0, 2.2, 0);
          grp.add(hood);
          attachStationMarker(stationDef, obj, grp, cat.interactRadius || 2.6, 2.65);
          continue;
        }

        if (obj.type === 'tp_oscilloscope') {
          const bench = buildWorkbenchMesh(w, d, 0.84, mats, true);
          grp.add(bench);
          const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.42, 0.56), mats.lightPlasticMat);
          chassis.position.set(0, 1.09, 0);
          chassis.castShadow = false;
          grp.add(chassis);
          const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.3), new THREE.MeshBasicMaterial({ map: makeScopeTexture() }));
          scr.position.set(0, 1.12, 0.29);
          grp.add(scr);
          attachStationMarker(stationDef, obj, grp, cat.interactRadius || 2.6, 2.55);
          continue;
        }

        if (obj.type === 'tp_electronics') {
          const bench = buildWorkbenchMesh(w, d, 0.84, mats, true);
          grp.add(bench);
          const bread = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.05, 0.5), mats.lightPlasticMat);
          bread.position.set(0.15, 0.9, 0.05);
          grp.add(bread);
          const psu = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.42), mats.brushedMetalMat);
          psu.position.set(-0.65, 1.02, -0.1);
          grp.add(psu);
          attachStationMarker(stationDef, obj, grp, cat.interactRadius || 2.6, 2.55);
          continue;
        }

        if (obj.type === 'tp_antivirus') {
          const desk = buildWorkbenchMesh(w, d, 0.82, mats, false);
          grp.add(desk);
          const mon = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w * 0.72, 1.4), 0.52, 0.06), mats.darkMetalMat);
          mon.position.set(0, 1.24, -0.2);
          grp.add(mon);
          const alertLed = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), new THREE.MeshBasicMaterial({ color: '#f43f5e' }));
          alertLed.position.set(w * 0.36, 1.32, -0.15);
          grp.add(alertLed);
          animatedRefs.leds.push({ mesh: alertLed, phase: 0.1, alert: true });
          attachStationMarker(stationDef, obj, grp, cat.interactRadius || 2.7, 2.55);
          continue;
        }

        if (obj.type === 'tp_vmvlan') {
          const rack = buildRackMesh(w, d, 2.25, 0.4, color, mats, animatedRefs);
          grp.add(rack);
          attachStationMarker(stationDef, obj, grp, cat.interactRadius || 2.8, 2.65);
          continue;
        }

        if (obj.type === 'tp_patchrack') {
          const rack = buildRackMesh(w, d, 2.1, 0.2, color, mats, animatedRefs);
          grp.add(rack);
          attachStationMarker(stationDef, obj, grp, cat.interactRadius || 2.4, 2.5);
          continue;
        }

        if (obj.type === 'tp_hardware') {
          const bench = buildWorkbenchMesh(w, d, 0.84, mats, true);
          grp.add(bench);
          const esd = new THREE.Mesh(
            new THREE.BoxGeometry(Math.min(w * 0.75, 1.6), 0.02, Math.min(d * 0.72, 0.85)),
            mats.esdMat
          );
          esd.position.y = 0.89;
          grp.add(esd);
          const tower = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.48, 0.24), mats.darkMetalMat);
          tower.position.set(-w * 0.2, 1.14, 0);
          grp.add(tower);
          attachStationMarker(stationDef, obj, grp, cat.interactRadius || 2.8, 2.55);
          continue;
        }

        if (obj.type === 'tp_audiovisual') {
          const desk = buildWorkbenchMesh(w, d, 0.82, mats, false);
          grp.add(desk);
          const dualMonMat = new THREE.MeshStandardMaterial({
            color: '#1e293b',
            roughness: 0.42,
            metalness: 0.55,
            emissive: '#000000',
            emissiveIntensity: 0
          });
          const dualMon = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w * 0.74, 1.45), 0.5, 0.07), dualMonMat);
          dualMon.position.set(0, 1.24, -0.2);
          grp.add(dualMon);
          const monFace = new THREE.Mesh(
            new THREE.PlaneGeometry(Math.min(w * 0.68, 1.34), 0.42),
            new THREE.MeshBasicMaterial({ map: makeAvMonitorTexture() })
          );
          monFace.position.set(0, 1.24, -0.158);
          grp.add(monFace);
          const dmxConsoleMat = new THREE.MeshStandardMaterial({
            color: '#0f172a',
            roughness: 0.38,
            metalness: 0.6,
            emissive: '#000000',
            emissiveIntensity: 0
          });
          const dmxConsole = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w * 0.58, 1.1), 0.08, 0.36), dmxConsoleMat);
          dmxConsole.position.set(0, 0.88, 0.2);
          dmxConsole.rotation.x = 0.14;
          grp.add(dmxConsole);
          for (let f = -2; f <= 2; f++) {
            const faderCap = new THREE.Mesh(
              new THREE.BoxGeometry(0.05, 0.03, 0.04),
              new THREE.MeshStandardMaterial({
                color: f === 0 ? '#f472b6' : '#38bdf8',
                emissive: f === 0 ? '#9d174d' : '#0369a1',
                emissiveIntensity: 0.35
              })
            );
            faderCap.position.set(f * 0.14, 0.055, f % 2 === 0 ? -0.05 : 0.05);
            dmxConsole.add(faderCap);
          }
          attachStationMarker(stationDef, obj, grp, cat.interactRadius || 2.8, 2.6, [dualMonMat, dmxConsoleMat]);
          continue;
        }

        if (obj.type === 'tp_studio') {
          const desk = buildWorkbenchMesh(w, d, 0.82, mats, false);
          grp.add(desk);
          const mixerMat = new THREE.MeshStandardMaterial({
            color: '#1e293b',
            roughness: 0.4,
            metalness: 0.58,
            emissive: '#000000',
            emissiveIntensity: 0
          });
          const mixer = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w * 0.62, 1.25), 0.14, 0.62), mixerMat);
          mixer.position.set(0, 0.92, 0.1);
          mixer.rotation.x = 0.18;
          grp.add(mixer);
          for (let f = -3; f <= 3; f++) {
            const strip = new THREE.Mesh(
              new THREE.BoxGeometry(0.04, 0.025, 0.05),
              new THREE.MeshStandardMaterial({
                color: f === 3 ? '#ef4444' : '#e879f9',
                emissive: f === 3 ? '#991b1b' : '#701a75',
                emissiveIntensity: 0.35
              })
            );
            strip.position.set(f * 0.13, 0.08, (f % 2) * 0.06);
            mixer.add(strip);
          }
          const spkHighlightMats = [mixerMat];
          for (const sx of [-Math.min(w * 0.38, 0.85), Math.min(w * 0.38, 0.85)]) {
            const spkMat = new THREE.MeshStandardMaterial({
              color: '#1e293b',
              roughness: 0.5,
              metalness: 0.25,
              emissive: '#000000',
              emissiveIntensity: 0
            });
            const spk = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.38, 0.24), spkMat);
            spk.position.set(sx, 1.15, -0.32);
            grp.add(spk);
            spkHighlightMats.push(spkMat);
          }
          attachStationMarker(stationDef, obj, grp, cat.interactRadius || 2.7, 2.55, spkHighlightMats);
          continue;
        }
      }

      if (obj.type === 'chair_student') {
        const star = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.06, 5), mats.legMat);
        star.position.y = 0.04;
        grp.add(star);
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 8), mats.legMat);
        col.position.y = 0.25;
        grp.add(col);
        const seatMat = mats.getChairSeatMaterial(obj.color || color);
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.46), seatMat);
        seat.position.y = 0.48;
        seat.castShadow = false;
        seat.receiveShadow = false;
        grp.add(seat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.46, 0.06), seatMat);
        back.position.set(0, 0.74, -0.2);
        back.castShadow = false;
        back.receiveShadow = false;
        grp.add(back);
        continue;
      }

      if (obj.type === 'desk_individual' || obj.type === 'desk_teacher' || obj.type === 'workbench_large' || obj.type === 'elec_bench' || obj.type === 'network_island') {
        const useTechTop = obj.type === 'workbench_large' || obj.type === 'elec_bench';
        const topH = useTechTop ? 0.84 : 0.78;
        const bench = buildWorkbenchMesh(w, d, topH, mats, useTechTop);
        grp.add(bench);

        if (obj.type === 'desk_individual') {
          const isStudio = String(obj.label || '').toLowerCase().includes('studio');
          if (isStudio) {
            const acoustic = new THREE.Mesh(
              new THREE.BoxGeometry(w, 1.4, 0.12),
              mats.acousticMat
            );
            acoustic.position.set(0, 1.48, d / 2 - 0.08);
            grp.add(acoustic);
            attachCielOsPcToDesk(
              obj,
              cat,
              grp,
              topH,
              [{ x: 0, y: topH + 0.32, z: 0.08, rotY: Math.PI, w: 0.64, h: 0.39 }],
              mats
            );
          } else {
            attachCielOsPcToDesk(
              obj,
              cat,
              grp,
              topH,
              [{ x: 0, y: topH + 0.32, z: -d * 0.18, rotY: 0, w: Math.min(0.66, w * 0.56), h: 0.4 }],
              mats
            );
          }
        } else if (obj.type === 'desk_teacher') {
          const mod = new THREE.Mesh(new THREE.BoxGeometry(w - 0.18, 0.46, 0.05), mats.oakDeskMat);
          mod.position.set(0, 0.52, d / 2 - 0.08);
          grp.add(mod);
          attachCielOsPcToDesk(
            obj,
            cat,
            grp,
            topH,
            [
              { x: -0.36, y: topH + 0.33, z: -0.15, rotY: 0.08, w: 0.62, h: 0.39 },
              { x: 0.36, y: topH + 0.33, z: -0.15, rotY: -0.08, w: 0.62, h: 0.39 }
            ],
            mats
          );
        } else if (obj.type === 'elec_bench') {
          const riser = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, 0.46, 0.28), mats.brushedMetalMat);
          riser.position.set(0, topH + 0.26, -d * 0.3);
          grp.add(riser);
          const dial = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.24), new THREE.MeshBasicMaterial({ map: makeScopeTexture() }));
          dial.position.set(-w * 0.2, topH + 0.28, -d * 0.3 + 0.145);
          grp.add(dial);
        } else if (obj.type === 'network_island') {
          const mxOff = Math.min(0.45, w * 0.22);
          attachCielOsPcToDesk(
            obj,
            cat,
            grp,
            topH,
            [
              { x: -mxOff, y: topH + 0.32, z: 0.04, rotY: 0, w: 0.62, h: 0.39 },
              { x: mxOff, y: topH + 0.32, z: -0.04, rotY: Math.PI, w: 0.62, h: 0.39 }
            ],
            mats
          );
        }
        continue;
      }

      if (obj.type === 'whiteboard') {
        const boardW = Math.max(1.2, w);
        const boardH = Math.min(1.6, Math.max(1.1, cat.defaultH || 1.5));
        const frameD = 0.08;
        const frame = new THREE.Mesh(new THREE.BoxGeometry(boardW, boardH, frameD), mats.brushedMetalMat);
        frame.position.set(0, 1.65, WALL_MOUNT_CLEARANCE + frameD / 2);
        grp.add(frame);
        const face = new THREE.Mesh(
          new THREE.PlaneGeometry(boardW - 0.1, boardH - 0.1),
          new THREE.MeshBasicMaterial({ map: makeWhiteboardTexture() })
        );
        face.position.set(0, 1.65, WALL_MOUNT_CLEARANCE + frameD + 0.005);
        grp.add(face);
        const tray = new THREE.Mesh(new THREE.BoxGeometry(boardW * 0.7, 0.05, 0.12), mats.brushedMetalMat);
        tray.position.set(0, 1.65 - boardH / 2, WALL_MOUNT_CLEARANCE + frameD + 0.03);
        grp.add(tray);
        continue;
      }

      if (obj.type === 'metal_cabinet') {
        const cabH = 1.98;
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(w, cabH, d),
          mats.cabinetMat
        );
        body.position.y = cabH / 2;
        body.castShadow = true;
        body.receiveShadow = true;
        grp.add(body);
        const seam = new THREE.Mesh(new THREE.BoxGeometry(0.02, cabH * 0.9, 0.02), mats.darkMetalMat);
        seam.position.set(0, cabH / 2, d / 2 + 0.008);
        grp.add(seam);
        continue;
      }

      if (obj.type === 'av_greenscreen') {
        const greenHlMat = new THREE.MeshStandardMaterial({
          color: '#16a34a',
          roughness: 0.82,
          emissive: '#000000',
          emissiveIntensity: 0
        });
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(w, 2.85, Math.min(0.24, d)),
          greenHlMat
        );
        wall.position.y = 1.425;
        wall.castShadow = true;
        grp.add(wall);
        for (const px of [-w / 2 + 0.06, w / 2 - 0.06]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.95, 8), mats.brushedMetalMat);
          post.position.set(px, 1.475, 0);
          grp.add(post);
          const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, Math.max(0.75, d)), mats.brushedMetalMat);
          foot.position.set(px, 0.025, 0);
          grp.add(foot);
        }
        const linkedTpId = obj.z < -3.2 ? 'audiovisual' : 'studio';
        interactables.push({
          id: obj.id,
          tpId: linkedTpId,
          isProp: true,
          label: `[E] ${obj.label || 'Fond Vert Studio'} (Lancer TP AV)`,
          type: 'tp',
          tp: ALL_STATIONS_MAP.get(linkedTpId),
          position: new THREE.Vector3(obj.x, objBaseY, obj.z),
          floor: objFloor,
          interactRadius: 2.3,
          mesh: grp,
          highlightMats: [greenHlMat]
        });
        continue;
      }

      if (obj.type === 'av_camera') {
        const legCol = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.25, 1.38, 6), mats.legMat);
        legCol.position.y = 0.69;
        grp.add(legCol);
        const camHlMat = new THREE.MeshStandardMaterial({
          color: '#1e293b',
          roughness: 0.38,
          metalness: 0.55,
          emissive: '#000000',
          emissiveIntensity: 0
        });
        const camBody = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.5), camHlMat);
        camBody.position.y = 1.48;
        grp.add(camBody);
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.26, 12), mats.darkMetalMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(0, 1.48, 0.34);
        grp.add(lens);
        const tally = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), new THREE.MeshBasicMaterial({ color: '#ef4444' }));
        tally.position.set(0, 1.65, 0.2);
        grp.add(tally);
        const linkedTpId = obj.z < -3.2 ? 'audiovisual' : 'studio';
        interactables.push({
          id: obj.id,
          tpId: linkedTpId,
          isProp: true,
          label: `[E] ${obj.label || 'Caméra Broadcast'} (Lancer TP AV)`,
          type: 'tp',
          tp: ALL_STATIONS_MAP.get(linkedTpId),
          position: new THREE.Vector3(obj.x, objBaseY, obj.z),
          floor: objFloor,
          interactRadius: 1.9,
          mesh: grp,
          highlightMats: [camHlMat]
        });
        continue;
      }

      if (obj.type === 'av_led_light') {
        const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.26, 1.65, 6), mats.legMat);
        stand.position.y = 0.825;
        grp.add(stand);
        const housingMat = new THREE.MeshStandardMaterial({
          color: '#1e293b',
          roughness: 0.42,
          metalness: 0.5,
          emissive: '#000000',
          emissiveIntensity: 0
        });
        const housing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.42, 0.14), housingMat);
        housing.position.set(0, 1.82, 0);
        housing.rotation.x = 0.18;
        grp.add(housing);
        const face = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.36), new THREE.MeshBasicMaterial({ color: '#fffef7' }));
        face.position.set(0, 0, 0.075);
        housing.add(face);
        const linkedTpId = obj.z < -3.2 ? 'audiovisual' : 'studio';
        interactables.push({
          id: obj.id,
          tpId: linkedTpId,
          isProp: true,
          label: `[E] ${obj.label || 'Projecteur DMX / LED'} (Lancer TP AV)`,
          type: 'tp',
          tp: ALL_STATIONS_MAP.get(linkedTpId),
          position: new THREE.Vector3(obj.x, objBaseY, obj.z),
          floor: objFloor,
          interactRadius: 1.9,
          mesh: grp,
          highlightMats: [housingMat]
        });
        continue;
      }

      if (obj.type === 'av_mic_stand') {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.04, 14), mats.darkMetalMat);
        base.position.y = 0.02;
        grp.add(base);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.38, 8), mats.legMat);
        pole.position.y = 0.71;
        grp.add(pole);
        const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.56, 8), mats.legMat);
        boom.rotation.x = Math.PI / 2 - 0.35;
        boom.position.set(0, 1.44, 0.14);
        grp.add(boom);
        const micHlMat = new THREE.MeshStandardMaterial({
          color: '#94a3b8',
          roughness: 0.3,
          metalness: 0.85,
          emissive: '#000000',
          emissiveIntensity: 0
        });
        const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.16, 10), micHlMat);
        mic.position.set(0, 1.5, 0.34);
        grp.add(mic);
        interactables.push({
          id: obj.id,
          tpId: 'studio',
          isProp: true,
          label: `[E] ${obj.label || 'Micro Studio'} (Lancer TP Studio)`,
          type: 'tp',
          tp: ALL_STATIONS_MAP.get('studio'),
          position: new THREE.Vector3(obj.x, objBaseY, obj.z),
          floor: objFloor,
          interactRadius: 1.85,
          mesh: grp,
          highlightMats: [micHlMat]
        });
        continue;
      }

      if (obj.type === 'net_rack_19') {
        const rack = buildRackMesh(w, d, 2.15, (obj.x + obj.z) * 0.2, color || '#10b981', mats, animatedRefs);
        grp.add(rack);
        continue;
      }

      if (obj.type === 'net_patch_wall') {
        const chassisD = Math.min(0.42, d);
        const chassis = new THREE.Mesh(new THREE.BoxGeometry(w, 0.85, chassisD), mats.darkMetalMat);
        chassis.position.set(0, 1.55, WALL_MOUNT_CLEARANCE + chassisD / 2);
        grp.add(chassis);
        for (let r = 0; r < 3; r++) {
          const strip = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, 0.09, 0.04), mats.brushedMetalMat);
          strip.position.set(0, 1.32 + r * 0.22, WALL_MOUNT_CLEARANCE + chassisD + 0.01);
          grp.add(strip);
          const led = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 0.03), new THREE.MeshBasicMaterial({ color: '#10b981' }));
          led.position.set(-w * 0.28, 1.32 + r * 0.22, WALL_MOUNT_CLEARANCE + chassisD + 0.028);
          grp.add(led);
          animatedRefs.leds.push({ mesh: led, phase: r * 0.9, alert: false });
        }
        continue;
      }

      if (obj.type === 'net_ups') {
        const ups = new THREE.Mesh(new THREE.BoxGeometry(w, 1.4, d), mats.darkMetalMat);
        ups.position.y = 0.7;
        ups.castShadow = true;
        ups.receiveShadow = true;
        grp.add(ups);
        const lcd = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, 0.14, 0.03), new THREE.MeshBasicMaterial({ color: '#0284c7' }));
        lcd.position.set(0, 1.15, d / 2 + 0.01);
        grp.add(lcd);
        continue;
      }

      if (obj.type === 'pc_gamer_cyber' || obj.type === 'pc_ciel_os') {
        const bench = buildWorkbenchMesh(w, d, 0.78, mats, false);
        grp.add(bench);
        const tower = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.48, 0.44), mats.darkMetalMat);
        tower.position.set(w * 0.36, 1.04, -0.05);
        grp.add(tower);
        const rgbMat = new THREE.MeshStandardMaterial({
          color: obj.type === 'pc_ciel_os' ? '#38bdf8' : '#0284c7',
          roughness: 0.3,
          metalness: 0.4,
          emissive: obj.type === 'pc_ciel_os' ? '#0284c7' : '#000000',
          emissiveIntensity: obj.type === 'pc_ciel_os' ? 0.35 : 0
        });
        const rgb = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.36, 0.36), rgbMat);
        rgb.position.set(w * 0.36 - 0.125, 1.04, -0.05);
        grp.add(rgb);
        attachCielOsPcToDesk(
          obj,
          cat,
          grp,
          0.78,
          obj.type === 'pc_ciel_os'
            ? [{ x: -0.06, y: 1.14, z: -0.14, rotY: 0, w: 0.72, h: 0.44 }]
            : [
                { x: -0.34, y: 1.14, z: -0.15, rotY: 0.12, w: 0.66, h: 0.41 },
                { x: 0.28, y: 1.14, z: -0.15, rotY: -0.12, w: 0.66, h: 0.41 }
              ],
          mats,
          [rgbMat]
        );
        continue;
      }

      if (obj.type === 'pc_open_maint') {
        const bench = buildWorkbenchMesh(w, d, 0.84, mats, true);
        grp.add(bench);
        const esd = new THREE.Mesh(new THREE.BoxGeometry(w * 0.75, 0.02, d * 0.72), mats.esdMat);
        esd.position.y = 0.89;
        grp.add(esd);
        const openCase = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.09, 0.48), mats.brushedMetalMat);
        openCase.position.set(0.12, 0.94, 0.12);
        grp.add(openCase);
        const mobo = new THREE.Mesh(
          new THREE.BoxGeometry(0.34, 0.03, 0.3),
          new THREE.MeshStandardMaterial({ color: '#047857', roughness: 0.48, metalness: 0.15 })
        );
        mobo.position.set(0.08, 0.995, 0.12);
        grp.add(mobo);
        const gpu = new THREE.Mesh(
          new THREE.BoxGeometry(0.24, 0.08, 0.05),
          new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.38, metalness: 0.55 })
        );
        gpu.position.set(0.12, 1.03, 0.19);
        grp.add(gpu);
        attachCielOsPcToDesk(
          obj,
          cat,
          grp,
          0.84,
          [{ x: -0.12, y: 1.18, z: -0.32, rotY: 0, w: 0.64, h: 0.4 }],
          mats
        );
        continue;
      }

      if (obj.type === 'soc_wall_screen') {
        const sw = Math.max(1.8, w);
        const sh = Math.max(1.2, Math.min(2.1, sw * 0.45));
        const frameD = 0.08;
        const frame = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.12, sh + 0.12, frameD), mats.darkMetalMat);
        frame.position.set(0, 2.35, WALL_MOUNT_CLEARANCE + frameD / 2);
        grp.add(frame);
        const screen = new THREE.Mesh(
          new THREE.PlaneGeometry(sw, sh),
          new THREE.MeshBasicMaterial({ map: makeSocScreenTexture(obj.label || 'SOC MONITORING') })
        );
        screen.position.set(0, 2.35, WALL_MOUNT_CLEARANCE + frameD + 0.005);
        grp.add(screen);
        continue;
      }

      const sh = cat.surfaceProp ? findSupportingSurfaceHeight(obj, supportBoxes) : null;
      const { grp: propGrp, mountY } = createPropMountGroup(obj, sh, mats);
      grp.add(propGrp);

      if (obj.type === 'av_mixer') {
        const mixerHlMat = new THREE.MeshStandardMaterial({
          color: '#1e293b',
          roughness: 0.42,
          metalness: 0.58,
          emissive: '#000000',
          emissiveIntensity: 0
        });
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, d), mixerHlMat);
        body.position.set(0, mountY + 0.08, 0);
        body.rotation.x = 0.14;
        propGrp.add(body);
        for (let f = -2; f <= 2; f++) {
          const ledStrip = new THREE.Mesh(
            new THREE.BoxGeometry(0.05, 0.02, 0.24),
            new THREE.MeshStandardMaterial({ color: f === 0 ? '#0284c7' : '#64748b', roughness: 0.4, metalness: 0.3 })
          );
          ledStrip.position.set(f * (w * 0.15), 0.08, 0);
          body.add(ledStrip);
        }
        interactables.push({
          id: obj.id,
          tpId: 'studio',
          isProp: true,
          label: `[E] ${obj.label || 'Console Mixage Audio'} (Lancer TP Studio)`,
          type: 'tp',
          tp: ALL_STATIONS_MAP.get('studio'),
          position: new THREE.Vector3(obj.x, objBaseY, obj.z),
          floor: objFloor,
          interactRadius: 2.0,
          mesh: grp,
          highlightMats: [mixerHlMat]
        });
        continue;
      }

      if (obj.type === 'net_switch_stack') {
        for (let s = 0; s < 2; s++) {
          const sw = new THREE.Mesh(new THREE.BoxGeometry(w, 0.11, d), mats.darkMetalMat);
          sw.position.set(0, mountY + 0.06 + s * 0.13, 0);
          propGrp.add(sw);
          const bar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: '#10b981' }));
          bar.position.set(0, 0, d / 2 + 0.01);
          sw.add(bar);
        }
        continue;
      }

      if (obj.type === 'elec_solder_unit') {
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(0.34, 0.2, 0.3),
          new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.48, metalness: 0.08 })
        );
        box.position.set(0, mountY + 0.11, 0);
        propGrp.add(box);
        const iron = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.26, 8), mats.legMat);
        iron.rotation.z = Math.PI / 3;
        iron.position.set(0.22, mountY + 0.14, 0.06);
        propGrp.add(iron);
        continue;
      }

      if (obj.type === 'elec_scope_unit') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.32), mats.lightPlasticMat);
        body.position.set(0, mountY + 0.16, 0);
        propGrp.add(body);
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.2), new THREE.MeshBasicMaterial({ map: makeScopeTexture() }));
        scr.position.set(-0.04, mountY + 0.17, 0.165);
        propGrp.add(scr);
        continue;
      }

      if (obj.type === 'elec_multimeter') {
        const mm = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.08, 0.28),
          new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.5, metalness: 0.05 })
        );
        mm.position.set(0, mountY + 0.06, 0);
        mm.rotation.x = 0.2;
        propGrp.add(mm);
        const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.09), new THREE.MeshBasicMaterial({ color: '#94a3b8' }));
        lcd.rotation.x = -Math.PI / 2;
        lcd.position.set(0, 0.045, -0.04);
        mm.add(lcd);
        continue;
      }

      if (obj.type === 'elec_fume_extractor') {
        const unit = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 0.3), mats.lightPlasticMat);
        unit.position.set(0, mountY + 0.17, 0);
        propGrp.add(unit);
        const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 16), mats.darkMetalMat);
        fan.rotation.x = Math.PI / 2;
        fan.position.set(0, mountY + 0.18, 0.16);
        propGrp.add(fan);
        continue;
      }

      const fallback = new THREE.Mesh(
        new THREE.BoxGeometry(w, cat.defaultH || 0.8, d),
        new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 })
      );
      fallback.position.y = (cat.defaultH || 0.8) / 2;
      grp.add(fallback);
      } finally {
        finalizeObjChunkTags();
      }
    }

    if (combatDoors.length === 0) {
      const combatCat = getCatalogItem('combat_door');
      buildSpecialModeDoor(
        {
          id: 'obj-combat-door-fallback',
          type: 'combat_door',
          x: -1.3,
          z: -1.85,
          rotation: 180,
          w: 1.7,
          d: 0.42,
          color: '#06b6d4',
          label: '⚔️ ARÈNE DE COMBAT CIEL'
        },
        1.7,
        0.42,
        Math.PI,
        combatCat,
        0,
        0
      );
    }

    if (ceilingPanelMeshes.length === 0) {
      frameGeoShared.dispose();
      panelGeoShared.dispose();
    }

    for (let i = 0; i < spatialCulling.chunks.length; i++) {
      const ch = spatialCulling.chunks[i];
      if (ch.root.parent !== worldGroup) {
        worldGroup.add(ch.root);
      }
    }

    worldGroup.updateMatrixWorld(true);
    const dynamicNodes = new Set();
    for (const tr of teacherRefs) {
      if (tr?.root) {
        tr.root.traverse((n) => dynamicNodes.add(n));
      }
    }
    for (const h of animatedRefs.shopHolograms) {
      dynamicNodes.add(h);
    }

    const excludedFromBatch = new Set(dynamicNodes);
    for (const r of animatedRefs.rings) {
      if (r?.ring) excludedFromBatch.add(r.ring);
    }
    for (const l of animatedRefs.leds) {
      if (l?.mesh) excludedFromBatch.add(l.mesh);
    }
    for (const sb of animatedRefs.survivalBeacons) {
      if (sb?.mesh) excludedFromBatch.add(sb.mesh);
    }
    for (const pc of pcStations) {
      for (const sm of pc.screenMeshes || []) {
        excludedFromBatch.add(sm);
      }
    }
    const highlightMatSet = new Set();
    for (const it of interactables) {
      if (Array.isArray(it.highlightMats)) {
        for (const hm of it.highlightMats) {
          if (hm) highlightMatSet.add(hm);
        }
      }
      if (it.mesh && typeof it.mesh.traverse === 'function') {
        let keptAnchor = false;
        it.mesh.traverse((n) => {
          if (keptAnchor || !n.isMesh || n.isInstancedMesh) return;
          if (n.geometry?.type === 'BoxGeometry' || n.geometry?.type === 'PlaneGeometry') {
            excludedFromBatch.add(n);
            keptAnchor = true;
          }
        });
      }
    }

    const solidWallSet = new Set(solidWallMeshes);
    const dedupSimpleMats = new Map();
    const resolveBatchedMaterial = (mat) => {
      if (!mat || Array.isArray(mat) || highlightMatSet.has(mat)) return mat;
      if (mat.userData?.managedByMaterialPack) return mat;
      if (!mat.map && !mat.roughnessMap && !mat.bumpMap && !mat.alphaMap && !mat.emissiveMap) {
        if (mat.isMeshBasicMaterial) {
          const key = `basic:${mat.color?.getHexString?.()}:${mat.transparent ? mat.opacity : 1}:${mat.side}`;
          let shared = dedupSimpleMats.get(key);
          if (!shared) {
            shared = mat;
            dedupSimpleMats.set(key, shared);
          }
          return shared;
        }
        if (mat.isMeshStandardMaterial) {
          const key = `std:${mat.color?.getHexString?.()}:${mat.emissive?.getHexString?.()}:${mat.emissiveIntensity}:${mat.roughness}:${mat.metalness}:${mat.transparent ? mat.opacity : 1}:${mat.side}`;
          let shared = dedupSimpleMats.get(key);
          if (!shared) {
            shared = mat;
            dedupSimpleMats.set(key, shared);
          }
          return shared;
        }
      }
      return mat;
    };

    const unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);
    const scaleMat = new THREE.Matrix4();
    const instMat = new THREE.Matrix4();
    let usedUnitBox = false;
    const batchedWallNodes = new Set();

    for (let ci = 0; ci < spatialCulling.chunks.length; ci++) {
      const ch = spatialCulling.chunks[ci];
      const subgroups = [ch.structureGroup, ch.detailGroup];
      for (let si = 0; si < subgroups.length; si++) {
        const sub = subgroups[si];
        const batchBuckets = new Map();
        sub.traverse((node) => {
          if (!node.isMesh || node.isInstancedMesh) return;
          if (excludedFromBatch.has(node)) return;
          if (!node.geometry || node.geometry.type !== 'BoxGeometry') return;
          const p = node.geometry.parameters;
          if (
            !p ||
            (p.widthSegments && p.widthSegments !== 1) ||
            (p.heightSegments && p.heightSegments !== 1) ||
            (p.depthSegments && p.depthSegments !== 1)
          ) {
            return;
          }
          if (!node.material || Array.isArray(node.material) || highlightMatSet.has(node.material)) return;
          const resolvedMat = resolveBatchedMaterial(node.material);
          const isWall = solidWallSet.has(node);
          const key = `${resolvedMat.uuid}|${node.castShadow ? 1 : 0}|${node.receiveShadow ? 1 : 0}|${isWall ? 1 : 0}`;
          let bucket = batchBuckets.get(key);
          if (!bucket) {
            bucket = {
              material: resolvedMat,
              castShadow: Boolean(node.castShadow),
              receiveShadow: Boolean(node.receiveShadow),
              isWall,
              items: []
            };
            batchBuckets.set(key, bucket);
          }
          bucket.items.push(node);
        });

        for (const bucket of batchBuckets.values()) {
          if (bucket.items.length < 2) continue;
          usedUnitBox = true;
          const inst = new THREE.InstancedMesh(unitBoxGeo, bucket.material, bucket.items.length);
          inst.castShadow = bucket.castShadow;
          inst.receiveShadow = bucket.receiveShadow;
          for (let i = 0; i < bucket.items.length; i++) {
            const m = bucket.items[i];
            const p = m.geometry.parameters;
            scaleMat.makeScale(p.width ?? 1, p.height ?? 1, p.depth ?? 1);
            instMat.multiplyMatrices(m.matrixWorld, scaleMat);
            inst.setMatrixAt(i, instMat);
            const origMat = m.material;
            m.parent?.remove(m);
            m.geometry.dispose?.();
            if (origMat && origMat !== bucket.material && !origMat.userData?.managedByMaterialPack) {
              origMat.dispose?.();
            }
            if (bucket.isWall) {
              batchedWallNodes.add(m);
            }
          }
          inst.instanceMatrix.needsUpdate = true;
          inst.computeBoundingBox?.();
          inst.computeBoundingSphere?.();
          inst.updateMatrix();
          inst.matrixAutoUpdate = false;
          inst.userData.floor = ch.floor;
          sub.add(inst);
          if (bucket.isWall) {
            solidWallMeshes.push(inst);
          }
        }
      }
    }

    if (!usedUnitBox) {
      unitBoxGeo.dispose();
    }
    if (batchedWallNodes.size > 0) {
      for (let i = solidWallMeshes.length - 1; i >= 0; i--) {
        if (batchedWallNodes.has(solidWallMeshes[i])) {
          solidWallMeshes.splice(i, 1);
        }
      }
    }

    worldGroup.updateMatrixWorld(true);
    worldGroup.traverse((node) => {
      if (node === worldGroup || dynamicNodes.has(node)) return;
      node.updateMatrix();
      node.matrixAutoUpdate = false;
    });

    spatialCulling.finalize(worldGroup);

    for (let i = 0; i < colliders.length; i++) {
      spatialHash.insertCollider(colliders[i]);
    }
    for (let i = 0; i < teacherRefs.length; i++) {
      if (teacherRefs[i]?.collider) {
        spatialHash.insertCollider(teacherRefs[i].collider);
      }
    }
    for (let i = 0; i < interactables.length; i++) {
      spatialHash.insertInteractable(interactables[i]);
    }
    const occBox = new THREE.Box3();
    for (let i = 0; i < solidWallMeshes.length; i++) {
      const wm = solidWallMeshes[i];
      wm.updateWorldMatrix?.(true, false);
      occBox.setFromObject(wm);
      const fl = Number.isFinite(Number(wm.userData?.floor))
        ? Math.round(Number(wm.userData.floor))
        : Math.floor((occBox.min.y + 0.2) / floorH);
      spatialHash.insertOccluder(wm, occBox, fl);
    }
  }

  function updateStationBadges(grades = {}) {
    lastGrades = grades && typeof grades === 'object' ? { ...grades } : {};
    for (const item of animatedRefs.rings) {
      const g = lastGrades[item.id];
      const passed = typeof g === 'number' && g >= 10;
      item.ring.material.color.set(passed ? '#10b981' : item.baseColor);
    }
  }

  function updateLeaderboardBoard(entries = [], localPlayerName = '') {
    lastLeaderboardEntries = Array.isArray(entries) ? entries : [];
    lastLocalPlayerName = localPlayerName || '';
    for (const board of leaderboardBoards) {
      board.update(lastLeaderboardEntries, lastLocalPlayerName);
    }
    if (lastLocalPlayerName) {
      for (const pc of pcStations) {
        pc.desktop?.setPlayerName?.(lastLocalPlayerName);
      }
    }
  }

  function rebuildWorld(nextMapData) {
    setHoveredInteractable(null);
    colliders.length = 0;
    interactables.length = 0;
    solidWallMeshes.length = 0;
    teacherRefs.length = 0;
    survivalDoors.length = 0;
    combatDoors.length = 0;
    hidingSpots.length = 0;
    perfRackDoorTex = null;
    pcStations.length = 0;
    pcInteractiveSurfaces.length = 0;
    shopKiosks.length = 0;
    ceilingPanelMeshes.length = 0;
    animatedRefs.rings.length = 0;
    animatedRefs.leds.length = 0;
    animatedRefs.survivalBeacons.length = 0;
    animatedRefs.shopHolograms.length = 0;
    leaderboardBoards = [];
    spatialCulling?.dispose?.();
    spatialCulling = null;
    spatialHash.clear();
    cullCalledSinceUpdate = false;

    disposeNodeTree(worldGroup);
    perfRackDoorTex?.dispose?.();
    perfRackDoorTex = null;
    if (materialPack) {
      materialPack.dispose();
      materialPack = null;
    }
    while (worldGroup.children.length > 0) {
      worldGroup.remove(worldGroup.children[0]);
    }

    currentMapData = normalizeMapData(nextMapData || createDefaultMap());
    const dynColliders = getDynamicMapColliders(currentMapData);
    for (const c of dynColliders) colliders.push(c);

    renderMapIntoGroup(currentMapData);
    updateStationBadges(lastGrades);
    updateLeaderboardBoard(lastLeaderboardEntries, lastLocalPlayerName);
    return currentMapData;
  }

  function setTeacherVisible(visible) {
    for (const tr of teacherRefs) {
      if (tr?.root) tr.root.visible = Boolean(visible);
    }
  }

  function setHorrorLighting(horrorActive, flickerStrength = 1) {
    if (materialPack?.ledPanelMat) {
      if (horrorActive) {
        materialPack.ledPanelMat.emissiveIntensity = 0.08 * Math.max(0, flickerStrength);
        materialPack.ledPanelMat.color.set(flickerStrength > 0.45 ? '#7f1d1d' : '#1e293b');
      } else {
        materialPack.ledPanelMat.emissiveIntensity = 1.0;
        materialPack.ledPanelMat.color.set('#ffffff');
      }
    }
    const showPanels = !horrorActive || flickerStrength > 0.25;
    for (let i = 0; i < ceilingPanelMeshes.length; i++) {
      ceilingPanelMeshes[i].visible = showPanels;
    }
  }

  function setVisible(visible) {
    worldGroup.visible = Boolean(visible);
    if (!worldGroup.visible) {
      hoverHaloMesh.visible = false;
    }
  }

  function setQualityProfile(profile = {}) {
    if (Number.isFinite(Number(profile.textureThrottleMult))) {
      qualityProfile.textureThrottleMult = Math.max(0.5, Math.min(6.0, Number(profile.textureThrottleMult)));
    }
    if (profile.lowResPc !== undefined) {
      qualityProfile.lowResPc = Boolean(profile.lowResPc);
    }
    const nextTier = profile.tier || profile.quality;
    if (typeof nextTier === 'string' && nextTier.length > 0) {
      qualityTier = nextTier;
      spatialCulling?.setQuality(qualityTier);
    }
    for (let i = 0; i < pcStations.length; i++) {
      const pc = pcStations[i];
      pc.desktop?.setQualityProfile?.({
        idleThrottleMult: qualityProfile.textureThrottleMult,
        renderScale: pc.isActiveSession ? 1.0 : qualityProfile.lowResPc ? 0.5 : 1.0
      });
    }
  }

  function updateCulling(camera, playerPos = null, opts = {}) {
    cullCalledSinceUpdate = true;
    if (!spatialCulling) {
      return {
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
    return spatialCulling.update(camera, playerPos, opts);
  }

  function getCullingStats() {
    if (!spatialCulling) {
      return {
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
    return spatialCulling.getStats();
  }

  function setEditorFloorCutoff(cutoffFloor = null, mode = 'all') {
    if (!spatialCulling) return;
    spatialCulling.setEditorFloorCutoff(cutoffFloor, mode);
    const cf = spatialCulling.editorCutoffFloor;
    const md = spatialCulling.editorFilterMode;
    for (let i = 0; i < spatialCulling.chunks.length; i++) {
      const ch = spatialCulling.chunks[i];
      const vis =
        cf === null || md === 'all'
          ? true
          : md === 'only'
            ? ch.floor === cf
            : ch.floor <= cf;
      ch.visible = vis;
      ch.detailsVisible = vis;
      ch.root.visible = vis;
      ch.structureGroup.visible = vis;
      ch.detailGroup.visible = vis;
      ch.cullReason = vis ? 'none' : 'floor';
    }
  }

  function getNearbyInteractables(x, z, radius = 8.0, floor = null, out = []) {
    return spatialHash.queryInteractables(x, z, radius, floor, out);
  }

  function getNearbyOccluders(origin, dir, maxDist = 10, floor = null, out = []) {
    return spatialHash.queryOccluders(origin, dir, maxDist, floor, out);
  }

  function getNearbyOccludersAt(x, z, radius = 8.0, floor = null, out = []) {
    return spatialHash.queryOccludersAt(x, z, radius, floor, out);
  }

  function getRenderStats() {
    let meshCount = 0;
    let instancedMeshCount = 0;
    let totalInstances = 0;
    let staticFrozenCount = 0;
    worldGroup.traverse((n) => {
      if (n.isInstancedMesh) {
        instancedMeshCount++;
        totalInstances += n.count || 0;
        if (n.matrixAutoUpdate === false) staticFrozenCount++;
      } else if (n.isMesh) {
        meshCount++;
        if (n.matrixAutoUpdate === false) staticFrozenCount++;
      }
    });
    return {
      meshCount,
      instancedMeshCount,
      totalInstances,
      drawCallEstimate: meshCount + instancedMeshCount,
      staticFrozenCount,
      pcStationCount: pcStations.length,
      chunkCount: spatialCulling ? spatialCulling.chunks.length : 0
    };
  }

  let lastPcUpdateElapsed = 0;
  const _camWorldPos = new THREE.Vector3();
  const _camWorldDir = new THREE.Vector3(0, 0, -1);

  function update(elapsed, playerPos = null, diplomaEarned = false, camera = null) {
    if (!worldGroup.visible) return;
    if (camera && !cullCalledSinceUpdate) {
      updateCulling(camera, playerPos);
    }
    cullCalledSinceUpdate = false;
    const dt = Math.max(0.008, Math.min(0.1, elapsed - lastPcUpdateElapsed || 0.016));
    lastPcUpdateElapsed = elapsed;

    for (let i = 0; i < animatedRefs.rings.length; i++) {
      const entry = animatedRefs.rings[i];
      if (entry.chunk && (!entry.chunk.visible || !entry.chunk.detailsVisible)) continue;
      const r = entry.ring;
      const pulse = 1 + Math.sin(elapsed * 2.5 + i) * 0.04;
      r.scale.set(pulse, pulse, 1);
      r.updateMatrix();
      r.matrixWorldNeedsUpdate = true;
    }
    for (let i = 0; i < animatedRefs.leds.length; i++) {
      const led = animatedRefs.leds[i];
      if (led.chunk && (!led.chunk.visible || !led.chunk.detailsVisible)) continue;
      const blink = Math.sin(elapsed * (led.alert ? 9 : 4.5) + led.phase) > 0;
      if (led.mesh.visible !== blink) {
        led.mesh.visible = blink;
      }
    }
    for (let i = 0; i < animatedRefs.survivalBeacons.length; i++) {
      const sb = animatedRefs.survivalBeacons[i];
      if (sb.chunk && (!sb.chunk.visible || !sb.chunk.detailsVisible)) continue;
      const pulse = 0.5 + 0.5 * Math.sin(elapsed * 4.5 + sb.phase);
      sb.mesh.scale.setScalar(0.85 + pulse * 0.35);
      sb.mesh.updateMatrix();
      sb.mesh.matrixWorldNeedsUpdate = true;
      sb.portal.opacity = 0.28 + pulse * 0.24;
    }
    for (let i = 0; i < teacherRefs.length; i++) {
      const tr = teacherRefs[i];
      if (tr.chunk && (!tr.chunk.visible || !tr.chunk.detailsVisible)) continue;
      if (tr.root?.visible !== false) {
        tr.update(elapsed, playerPos, diplomaEarned);
      }
    }
    for (let i = 0; i < animatedRefs.shopHolograms.length; i++) {
      const h = animatedRefs.shopHolograms[i];
      h.rotation.y = elapsed * 1.4;
      h.position.y = 2.58 + Math.sin(elapsed * 2.6 + i) * 0.05;
    }

    const hasCamera = Boolean(camera && typeof camera.getWorldPosition === 'function');
    if (hasCamera) {
      camera.getWorldPosition(_camWorldPos);
      camera.getWorldDirection(_camWorldDir);
    }
    const hasPlayerPos = Boolean(
      playerPos &&
        Number.isFinite(Number(playerPos.x)) &&
        Number.isFinite(Number(playerPos.z))
    );

    const pcLen = pcStations.length;
    let idleUploadedThisFrame = false;
    for (let k = 0; k < pcLen; k++) {
      const idx = (pcIdleCursor + k) % pcLen;
      const pc = pcStations[idx];
      if (pc.isActiveSession) {
        pc.desktop.setQualityProfile?.({ renderScale: 1.0 });
        pc.desktop.setSleepMode?.(false, true, true);
        pc.desktop.update(dt, elapsed);
        continue;
      }

      if (pc.chunk && (!pc.chunk.visible || !pc.chunk.detailsVisible)) {
        pc.desktop.inView = false;
        pc.desktop.sleepMode = true;
        continue;
      }

      if (hasPlayerPos || hasCamera) {
        const px = hasPlayerPos ? Number(playerPos.x) : _camWorldPos.x;
        const pz = hasPlayerPos ? Number(playerPos.z) : _camWorldPos.z;
        const dx = pc.position.x - px;
        const dz = pc.position.z - pz;
        const distSq = dx * dx + dz * dz;
        if (distSq > 196 && !pc.desktop.dirty) {
          pc.desktop.inView = false;
          pc.desktop.sleepMode = true;
          continue;
        }
        let inView = true;
        if (hasCamera) {
          const vx = pc.position.x - _camWorldPos.x;
          const vy = (pc.position.y || 0) + 1.08 - _camWorldPos.y;
          const vz = pc.position.z - _camWorldPos.z;
          const vLenSq = vx * vx + vy * vy + vz * vz;
          const dot =
            vLenSq > 0.0025
              ? (vx * _camWorldDir.x + vy * _camWorldDir.y + vz * _camWorldDir.z) / Math.sqrt(vLenSq)
              : 1;
          inView = dot > 0.15 && distSq < 256;
        } else {
          inView = distSq < 196;
        }
        const near = distSq < 16.0 && inView;
        const didUpload = pc.desktop.updateIdle(elapsed, {
          focused: false,
          near,
          inView,
          allowIdleUpload: !idleUploadedThisFrame
        });
        if (didUpload) {
          idleUploadedThisFrame = true;
        }
      } else {
        const didUpload = pc.desktop.updateIdle(elapsed, {
          focused: false,
          near: false,
          inView: true,
          allowIdleUpload: !idleUploadedThisFrame
        });
        if (didUpload) {
          idleUploadedThisFrame = true;
        }
      }
    }
    if (pcLen > 0) {
      pcIdleCursor = (pcIdleCursor + 1) % pcLen;
    }
  }

  function setArcadeGameEndHandler(fn) {
    arcadeGameEndHandler = typeof fn === 'function' ? fn : null;
    for (const pc of pcStations) {
      if (pc.desktop) {
        pc.desktop.onGameFinished = arcadeGameEndHandler;
      }
    }
  }

  function setLocalCoins(coins) {
    lastLocalCoins = Math.max(0, Math.floor(Number(coins) || 0));
    for (const pc of pcStations) {
      pc.desktop?.setCoins?.(lastLocalCoins);
    }
  }

  function getPcStationById(id) {
    return pcStations.find((pc) => pc.id === id || `pc-${pc.id}` === id) || null;
  }

  function dispose() {
    setHoveredInteractable(null);
    scene.remove(hoverHaloMesh);
    hoverHaloMesh.geometry.dispose();
    hoverHaloMat.dispose();
    spatialCulling?.dispose?.();
    spatialCulling = null;
    spatialHash.clear();
    ceilingPanelMeshes.length = 0;
    disposeNodeTree(worldGroup);
    perfRackDoorTex?.dispose?.();
    perfRackDoorTex = null;
    if (materialPack) {
      materialPack.dispose();
      materialPack = null;
    }
    while (worldGroup.children.length > 0) {
      worldGroup.remove(worldGroup.children[0]);
    }
    scene.remove(worldGroup);
  }

  rebuildWorld(currentMapData);

  return {
    worldGroup,
    colliders,
    interactables,
    solidWallMeshes,
    survivalDoors,
    combatDoors,
    hidingSpots,
    pcStations,
    pcInteractiveSurfaces,
    shopKiosks,
    spatialHash,
    get spatialCulling() {
      return spatialCulling;
    },
    get walkableSurfaces() {
      return walkableSurfaces;
    },
    getPcStationById,
    setArcadeGameEndHandler,
    setLocalCoins,
    setVisible,
    setQualityProfile,
    getRenderStats,
    updateCulling,
    getCullingStats,
    setEditorFloorCutoff,
    getNearbyInteractables,
    getNearbyOccluders,
    getNearbyOccludersAt,
    get mapData() {
      return currentMapData;
    },
    teacherRefs,
    setTeacherVisible,
    setHorrorLighting,
    setHoveredInteractable,
    update,
    updateStationBadges,
    updateLeaderboardBoard,
    rebuildWorld,
    dispose
  };
}
