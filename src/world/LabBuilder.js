import * as THREE from 'three';
import { TP_CATALOG, EXTRA_STATIONS } from '../core/gameState.js';
import { createNpcTeacher } from './NpcTeacher.js';
import {
  createDefaultMap,
  getCatalogItem,
  getDynamicMapColliders,
  getZonePolygonPoints,
  normalizeMapData,
  subtractDoorsFromWalls
} from './mapSchema.js';

const ALL_STATIONS_MAP = new Map([...TP_CATALOG, ...EXTRA_STATIONS].map((s) => [s.id, s]));

function disposeNodeTree(root) {
  if (!root) return;
  const disposeMat = (mat) => {
    if (!mat) return;
    if (mat.map) mat.map.dispose();
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
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function makeFloorTexture() {
  return makeCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#141e33';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#1f2e4a';
    ctx.lineWidth = 2;
    for (let x = 0; x <= w; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.fillRect(0, 0, 10, 10);
  });
}

function makeDoorSignTexture(label, accent = '#38bdf8') {
  return makeCanvasTexture(512, 112, (ctx, w, h) => {
    ctx.fillStyle = '#071124';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = accent;
    ctx.fillRect(4, 4, 14, h - 8);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(label || 'SALLE CIEL').slice(0, 26), w / 2 + 6, h / 2);
  });
}

function makeOrientationMapTexture(mapData) {
  return makeCanvasTexture(1024, 680, (ctx, w, h) => {
    const b = mapData.bounds;
    ctx.fillStyle = '#071022';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 5;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    ctx.fillStyle = '#0f2344';
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

    ctx.fillStyle = '#0c1830';
    ctx.fillRect(padX, padY, mapW, mapH);
    ctx.strokeStyle = '#475569';
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
      ctx.fillStyle = `${z.color || '#38bdf8'}26`;
      ctx.fill();
      ctx.strokeStyle = z.color || '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      const lx = toPxX(z.x);
      const ly = toPxY(z.z);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 19px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(z.code || '', lx, ly - 10);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText(z.shortName || '', lx, ly + 12);
    }

    const wallSegments = subtractDoorsFromWalls(mapData.walls || []);
    ctx.lineCap = 'round';
    for (const wall of wallSegments) {
      if (wall.kind === 'door_single' || wall.kind === 'door_double') continue;
      ctx.strokeStyle = wall.kind === 'glazed' ? '#38bdf8' : '#cbd5e1';
      ctx.lineWidth = wall.kind === 'solid' ? 4 : 2.5;
      ctx.beginPath();
      ctx.moveTo(toPxX(wall.x1), toPxY(wall.z1));
      ctx.lineTo(toPxX(wall.x2), toPxY(wall.z2));
      ctx.stroke();
    }

    const sp = mapData.spawn || { x: 0, z: 0 };
    const hx = toPxX(sp.x);
    const hy = toPxY(sp.z);
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(hx, hy, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#67e8f9';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPAWN', hx, hy + 20);
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

function createWallLeaderboardBoard(parent, obj) {
  const W = 1280;
  const H = 744;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const boardW = Math.max(1.8, Math.min(5.2, Number(obj.w) || 3.45));
  const scaleFactor = boardW / 3.48;
  const boardGroup = new THREE.Group();
  boardGroup.position.set(0, 2.28, 0);
  boardGroup.scale.set(scaleFactor, scaleFactor, 1);

  const glowFrame = new THREE.Mesh(
    new THREE.BoxGeometry(3.48, 2.12, 0.06),
    new THREE.MeshBasicMaterial({ color: obj.color || '#06b6d4' })
  );
  glowFrame.position.z = -0.02;
  boardGroup.add(glowFrame);

  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(3.38, 2.02, 0.1),
    new THREE.MeshStandardMaterial({ color: '#0b1324', metalness: 0.65, roughness: 0.35 })
  );
  boardGroup.add(bezel);

  const headerLed = new THREE.Mesh(
    new THREE.BoxGeometry(3.22, 0.03, 0.02),
    new THREE.MeshBasicMaterial({ color: '#22d3ee' })
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

function buildWorkbenchMesh(w, d, topHeight = 0.82, accentColor = '#38bdf8', mats) {
  const grp = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, d), mats.deskTopMat);
  top.position.y = topHeight;
  top.castShadow = true;
  top.receiveShadow = true;
  grp.add(top);

  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.02, 0.026, d + 0.02),
    new THREE.MeshBasicMaterial({ color: accentColor })
  );
  trim.position.y = topHeight - 0.032;
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
    grp.add(leg);
  }
  return grp;
}

function buildRackMesh(w, d, h = 2.15, ledOffsetPhase = 0, ledColor = '#10b981', mats, animatedRefs) {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.58, roughness: 0.34 })
  );
  body.position.y = h / 2;
  body.castShadow = true;
  grp.add(body);

  const glassDoor = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.84, h * 0.86, 0.03),
    new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.2,
      roughness: 0.15,
      metalness: 0.3
    })
  );
  glassDoor.position.set(0, h / 2, d / 2 + 0.01);
  grp.add(glassDoor);

  for (let i = 0; i < 6; i++) {
    const tray = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, 0.07, 0.04), mats.mullionMat);
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
  for (const box of supportBoxes) {
    if (box.id === obj.id) continue;
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
    const base = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.55, obj.w + 0.2), 0.05, Math.max(0.55, obj.d + 0.2)), mats.deskTopMat);
    base.position.y = 0.755;
    grp.add(base);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.12, 0.75, 10), mats.legMat);
    post.position.y = 0.375;
    grp.add(post);
  }
  return { grp, mountY };
}

export function buildLabWorld(scene, initialMapData = null, options = {}) {
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  const colliders = [];
  const interactables = [];
  const teacherRefs = [];
  const animatedRefs = {
    rings: [],
    leds: []
  };
  let leaderboardBoards = [];
  let currentMapData = normalizeMapData(initialMapData || createDefaultMap());
  let lastLeaderboardEntries = [];
  let lastLocalPlayerName = '';
  let lastGrades = {};
  const showSprites = !options.hideSprites;

  function makeMats() {
    return {
      deskTopMat: new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5, metalness: 0.15 }),
      legMat: new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.7, roughness: 0.35 }),
      screenCaseMat: new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.45, roughness: 0.35 }),
      mullionMat: new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.7, roughness: 0.3 }),
      dadoMat: new THREE.MeshStandardMaterial({ color: '#162238', roughness: 0.8 }),
      trimMat: new THREE.MeshStandardMaterial({ color: '#0ea5e9', emissive: '#0284c7', emissiveIntensity: 0.25 })
    };
  }

  function addDoorSign(parentGroup, cx, cz, y, rotY, thickness, label, accent = '#38bdf8') {
    const tex = makeDoorSignTexture(label, accent);
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(1.46, 0.34, thickness + 0.1),
      new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.6, roughness: 0.3 })
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

  function attachStationMarker(stationDef, obj, parentGroup, radius = 2.6, ySprite = 2.55) {
    const color = obj.color || stationDef.color || '#38bdf8';
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
      label: `[E] ${obj.label || stationDef.title}`,
      type: 'tp',
      tp: stationDef,
      position: new THREE.Vector3(obj.x, 0, obj.z),
      interactRadius: radius,
      ring,
      mesh: parentGroup
    });
  }

  function renderMapIntoGroup(mapData) {
    const mats = makeMats();
    const b = mapData.bounds;
    const H = b.height || 4.6;
    const centerX = (b.minX + b.maxX) / 2;
    const centerZ = (b.minZ + b.maxZ) / 2;

    const floorTex = makeFloorTexture();
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(Math.max(2, Math.round(b.width / 2)), Math.max(2, Math.round(b.depth / 2)));

    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(b.width, b.depth),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.72, metalness: 0.12 })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(centerX, 0, centerZ);
    floorMesh.receiveShadow = true;
    worldGroup.add(floorMesh);

    for (const z of mapData.zones || []) {
      if (z.code === 'U300' && !Array.isArray(z.points)) continue;
      const pts = getZonePolygonPoints(z);
      if (pts.length < 3) continue;
      const shape = new THREE.Shape();
      pts.forEach((p, idx) => {
        if (idx === 0) shape.moveTo(p.x, -p.z);
        else shape.lineTo(p.x, -p.z);
      });
      shape.closePath();
      const pad = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshBasicMaterial({
          color: z.color || '#38bdf8',
          transparent: true,
          opacity: z.code === 'ESC' || z.id === 'ESCALIER' ? 0.14 : 0.065,
          side: THREE.DoubleSide
        })
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(0, 0.008, 0);
      worldGroup.add(pad);
    }

    const ceilingMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(b.width, b.depth),
      new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.9 })
    );
    ceilingMesh.rotation.x = Math.PI / 2;
    ceilingMesh.position.set(centerX, H, centerZ);
    worldGroup.add(ceilingMesh);

    const ledPanelMat = new THREE.MeshBasicMaterial({ color: '#e0f2fe' });
    const ledFrameMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.5 });
    const ledPositions = [];
    for (let lx = b.minX + 3.2; lx <= b.maxX - 2.2; lx += 4.75) {
      for (let lz = b.minZ + 3.0; lz <= b.maxZ - 2.0; lz += 6.0) {
        ledPositions.push([lx, lz]);
      }
    }
    if (ledPositions.length > 0) {
      const frameGeo = new THREE.BoxGeometry(1.6, 0.07, 0.6);
      const panelGeo = new THREE.PlaneGeometry(1.45, 0.48);
      const framesInst = new THREE.InstancedMesh(frameGeo, ledFrameMat, ledPositions.length);
      const panelsInst = new THREE.InstancedMesh(panelGeo, ledPanelMat, ledPositions.length);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < ledPositions.length; i++) {
        const [lx, lz] = ledPositions[i];
        dummy.position.set(lx, H - 0.05, lz);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        framesInst.setMatrixAt(i, dummy.matrix);
        dummy.position.set(lx, H - 0.09, lz);
        dummy.rotation.set(Math.PI / 2, 0, 0);
        dummy.updateMatrix();
        panelsInst.setMatrixAt(i, dummy.matrix);
      }
      framesInst.instanceMatrix.needsUpdate = true;
      panelsInst.instanceMatrix.needsUpdate = true;
      worldGroup.add(framesInst);
      worldGroup.add(panelsInst);
    }

    const wallSegments = subtractDoorsFromWalls(mapData.walls || []);
    const glassBaseMat = {
      transparent: true,
      opacity: 0.24,
      roughness: 0.1,
      metalness: 0.15,
      side: THREE.DoubleSide
    };

    for (const seg of wallSegments) {
      const dx = seg.x2 - seg.x1;
      const dz = seg.z2 - seg.z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.12) continue;
      const cx = (seg.x1 + seg.x2) / 2;
      const cz = (seg.z1 + seg.z2) / 2;
      const angle = -Math.atan2(dz, dx);
      const wallH = Math.max(2.6, Math.min(H, seg.height || H));
      const thick = Math.max(0.08, seg.thickness || 0.18);

      if (seg.kind === 'door_single' || seg.kind === 'door_double') {
        const grp = new THREE.Group();
        grp.position.set(cx, 0, cz);
        grp.rotation.y = angle;

        const doorH = 2.4;
        const lintelH = Math.max(0.25, wallH - doorH);
        const lintelMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.85 });
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(len, lintelH, thick), lintelMat);
        lintel.position.y = doorH + lintelH / 2;
        lintel.castShadow = true;
        grp.add(lintel);

        const jambThick = Math.min(0.09, len * 0.15);
        for (const sx of [-len / 2 + jambThick / 2, len / 2 - jambThick / 2]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(jambThick, doorH, thick + 0.03), mats.mullionMat);
          post.position.set(sx, doorH / 2, 0);
          grp.add(post);
        }

        const headerBar = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, thick + 0.04), mats.mullionMat);
        headerBar.position.set(0, doorH - 0.03, 0);
        grp.add(headerBar);

        if (seg.doorLabel) {
          addDoorSign(grp, 0, 0, Math.min(2.66, wallH - 0.34), 0, thick, seg.doorLabel, seg.color || '#38bdf8');
        }
        worldGroup.add(grp);
        continue;
      }

      if (seg.kind === 'glazed') {
        const grp = new THREE.Group();
        grp.position.set(cx, 0, cz);
        grp.rotation.y = angle;

        const dadoH = 1.05;
        const glassH = Math.max(0.5, wallH - 2.6);
        const topStart = dadoH + glassH;
        const topH = Math.max(0.3, wallH - topStart);

        const dado = new THREE.Mesh(new THREE.BoxGeometry(len, dadoH, thick), mats.dadoMat);
        dado.position.y = dadoH / 2;
        dado.receiveShadow = true;
        grp.add(dado);

        const glass = new THREE.Mesh(
          new THREE.BoxGeometry(len, glassH, 0.045),
          new THREE.MeshStandardMaterial({ color: seg.color || '#93c5fd', ...glassBaseMat })
        );
        glass.position.y = dadoH + glassH / 2;
        grp.add(glass);

        const topWall = new THREE.Mesh(
          new THREE.BoxGeometry(len, topH, thick),
          new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.85 })
        );
        topWall.position.y = topStart + topH / 2;
        grp.add(topWall);

        const midRail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, thick + 0.015), mats.mullionMat);
        midRail.position.y = dadoH + 0.01;
        grp.add(midRail);

        const topRail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, thick + 0.015), mats.mullionMat);
        topRail.position.y = topStart - 0.01;
        grp.add(topRail);

        worldGroup.add(grp);
        continue;
      }

      const grp = new THREE.Group();
      grp.position.set(cx, 0, cz);
      grp.rotation.y = angle;

      const solidMat = new THREE.MeshStandardMaterial({ color: seg.color || '#1e293b', roughness: 0.85 });
      const solid = new THREE.Mesh(new THREE.BoxGeometry(len, wallH, thick), solidMat);
      solid.position.y = wallH / 2;
      solid.castShadow = true;
      solid.receiveShadow = true;
      grp.add(solid);

      const trim = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, thick + 0.02), mats.trimMat);
      trim.position.y = 0.05;
      grp.add(trim);

      worldGroup.add(grp);
    }

    const supportBoxes = [];
    for (const o of mapData.objects || []) {
      const cat = getCatalogItem(o.type);
      if (cat?.supportTop) {
        supportBoxes.push({
          id: o.id,
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

    for (const obj of mapData.objects || []) {
      const cat = getCatalogItem(obj.type);
      if (!cat) continue;
      const w = Math.max(0.2, obj.w || cat.defaultW || 1);
      const d = Math.max(0.2, obj.d || cat.defaultD || 1);
      const color = obj.color || cat.defaultColor || '#38bdf8';
      const rotRad = ((obj.rotation || 0) * Math.PI) / 180;

      if (obj.type === 'npc_teacher') {
        const res = createNpcTeacher(worldGroup, {
          x: obj.x,
          z: obj.z,
          rotation: obj.rotation || 0,
          label: obj.label || 'Professeur CIEL',
          dialogue: obj.dialogue || '',
          interactRadius: cat.interactRadius || 3.1
        });
        teacherRefs.push(res);
        interactables.push(res.interactable);
        continue;
      }

      const grp = new THREE.Group();
      grp.position.set(obj.x, 0, obj.z);
      grp.rotation.y = rotRad;
      worldGroup.add(grp);

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
        const lb = createWallLeaderboardBoard(grp, obj);
        leaderboardBoards.push(lb);
        continue;
      }

      if (obj.type === 'wall_map_board') {
        const frameW = Math.max(1.4, w);
        const frameH = frameW * 0.65;
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(frameW, frameH, 0.07),
          mats.screenCaseMat
        );
        frame.position.y = 2.25;
        grp.add(frame);
        const face = new THREE.Mesh(
          new THREE.PlaneGeometry(frameW - 0.12, frameH - 0.12),
          new THREE.MeshBasicMaterial({ map: orientTex })
        );
        face.position.set(0, 2.25, 0.04);
        grp.add(face);
        continue;
      }

      if (obj.type === 'stair_block') {
        const stepMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.7 });
        const railMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.85, roughness: 0.25 });
        const sx = w / 4.2;
        const sz = d / 3.66;
        for (let s = 0; s < 10; s++) {
          const step = new THREE.Mesh(new THREE.BoxGeometry(1.4 * sx, 0.2, 0.34 * sz), stepMat);
          step.position.set(-1.05 * sx, 0.1 + s * 0.22, (-1.48 + s * 0.31) * sz);
          grp.add(step);
        }
        const landing = new THREE.Mesh(new THREE.BoxGeometry(3.6 * sx, 0.24, 1.3 * sz), stepMat);
        landing.position.set(0, 2.3, 1.07 * sz);
        grp.add(landing);
        for (let s = 0; s < 8; s++) {
          const step2 = new THREE.Mesh(new THREE.BoxGeometry(1.4 * sx, 0.2, 0.3 * sz), stepMat);
          step2.position.set(1.15 * sx, 2.52 + s * 0.22, (0.37 - s * 0.28) * sz);
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
          const bench = buildWorkbenchMesh(w, d, 0.84, color, mats);
          grp.add(bench);
          const esd = new THREE.Mesh(
            new THREE.BoxGeometry(Math.min(w * 0.72, 1.4), 0.02, Math.min(d * 0.72, 1.05)),
            new THREE.MeshStandardMaterial({ color: '#0369a1' })
          );
          esd.position.y = 0.88;
          grp.add(esd);
          const unit = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.34), new THREE.MeshStandardMaterial({ color: '#ea580c' }));
          unit.position.set(-w * 0.22, 1.0, 0);
          grp.add(unit);
          const hood = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.45, 4), mats.legMat);
          hood.rotation.y = Math.PI / 4;
          hood.position.set(0, 2.2, 0);
          grp.add(hood);
          attachStationMarker(stationDef, obj, grp, cat.interactRadius || 2.6, 2.65);
          continue;
        }

        if (obj.type === 'tp_oscilloscope') {
          const bench = buildWorkbenchMesh(w, d, 0.84, color, mats);
          grp.add(bench);
          const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.42, 0.56), mats.screenCaseMat);
          chassis.position.set(0, 1.09, 0);
          grp.add(chassis);
          const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.3), new THREE.MeshBasicMaterial({ map: makeScopeTexture() }));
          scr.position.set(0, 1.12, 0.29);
          grp.add(scr);
          attachStationMarker(stationDef, obj, grp, cat.interactRadius || 2.6, 2.55);
          continue;
        }

        if (obj.type === 'tp_electronics') {
          const bench = buildWorkbenchMesh(w, d, 0.84, color, mats);
          grp.add(bench);
          const bread = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.05, 0.5), new THREE.MeshStandardMaterial({ color: '#f8fafc' }));
          bread.position.set(0.15, 0.9, 0.05);
          grp.add(bread);
          const psu = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.42), mats.mullionMat);
          psu.position.set(-0.65, 1.02, -0.1);
          grp.add(psu);
          attachStationMarker(stationDef, obj, grp, cat.interactRadius || 2.6, 2.55);
          continue;
        }

        if (obj.type === 'tp_antivirus') {
          const desk = buildWorkbenchMesh(w, d, 0.82, color, mats);
          grp.add(desk);
          const mon = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w * 0.72, 1.4), 0.52, 0.06), mats.screenCaseMat);
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
          const bench = buildWorkbenchMesh(w, d, 0.84, color, mats);
          grp.add(bench);
          const esd = new THREE.Mesh(
            new THREE.BoxGeometry(Math.min(w * 0.75, 1.6), 0.02, Math.min(d * 0.72, 0.85)),
            new THREE.MeshStandardMaterial({ color: '#4c1d95' })
          );
          esd.position.y = 0.89;
          grp.add(esd);
          const tower = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.48, 0.24), mats.screenCaseMat);
          tower.position.set(-w * 0.2, 1.14, 0);
          grp.add(tower);
          attachStationMarker(stationDef, obj, grp, cat.interactRadius || 2.8, 2.55);
          continue;
        }

        if (obj.type === 'tp_audiovisual') {
          const desk = buildWorkbenchMesh(w, d, 0.82, color, mats);
          grp.add(desk);
          const dualMon = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w * 0.74, 1.45), 0.5, 0.07), mats.screenCaseMat);
          dualMon.position.set(0, 1.24, -0.2);
          grp.add(dualMon);
          const monFace = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.68, 1.34), 0.42), new THREE.MeshBasicMaterial({ color: '#ec4899' }));
          monFace.position.set(0, 1.24, -0.158);
          grp.add(monFace);
          attachStationMarker(stationDef, obj, grp, cat.interactRadius || 2.8, 2.6);
          continue;
        }

        if (obj.type === 'tp_studio') {
          const desk = buildWorkbenchMesh(w, d, 0.82, color, mats);
          grp.add(desk);
          const mixer = new THREE.Mesh(new THREE.BoxGeometry(Math.min(w * 0.62, 1.25), 0.14, 0.62), new THREE.MeshStandardMaterial({ color: '#312e81' }));
          mixer.position.set(0, 0.92, 0.1);
          mixer.rotation.x = 0.18;
          grp.add(mixer);
          for (const sx of [-Math.min(w * 0.38, 0.85), Math.min(w * 0.38, 0.85)]) {
            const spk = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.38, 0.24), mats.screenCaseMat);
            spk.position.set(sx, 1.15, -0.32);
            grp.add(spk);
          }
          attachStationMarker(stationDef, obj, grp, cat.interactRadius || 2.7, 2.55);
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
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.46), new THREE.MeshStandardMaterial({ color }));
        seat.position.y = 0.48;
        grp.add(seat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.46, 0.06), new THREE.MeshStandardMaterial({ color }));
        back.position.set(0, 0.74, -0.2);
        grp.add(back);
        continue;
      }

      if (obj.type === 'desk_individual' || obj.type === 'desk_teacher' || obj.type === 'workbench_large' || obj.type === 'elec_bench' || obj.type === 'network_island') {
        const topH = obj.type === 'workbench_large' || obj.type === 'elec_bench' ? 0.84 : 0.78;
        const bench = buildWorkbenchMesh(w, d, topH, color, mats);
        grp.add(bench);

        if (obj.type === 'desk_individual') {
          if (String(obj.label || '').toLowerCase().includes('studio')) {
            const acoustic = new THREE.Mesh(
              new THREE.BoxGeometry(w, 1.4, 0.12),
              new THREE.MeshStandardMaterial({ color: '#4c1d95', roughness: 0.95 })
            );
            acoustic.position.set(0, 1.48, d / 2 - 0.08);
            grp.add(acoustic);
          } else {
            const mon = new THREE.Mesh(new THREE.BoxGeometry(Math.min(0.65, w * 0.55), 0.36, 0.05), mats.screenCaseMat);
            mon.position.set(0, topH + 0.32, -d * 0.2);
            grp.add(mon);
          }
        } else if (obj.type === 'desk_teacher') {
          const mod = new THREE.Mesh(new THREE.BoxGeometry(w - 0.18, 0.46, 0.05), mats.dadoMat);
          mod.position.set(0, 0.52, d / 2 - 0.08);
          grp.add(mod);
          for (const mx of [-0.36, 0.36]) {
            const mon = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.38, 0.05), mats.screenCaseMat);
            mon.position.set(mx, topH + 0.34, -0.15);
            grp.add(mon);
          }
        } else if (obj.type === 'elec_bench') {
          const riser = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, 0.46, 0.28), mats.mullionMat);
          riser.position.set(0, topH + 0.26, -d * 0.3);
          grp.add(riser);
          const dial = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.24), new THREE.MeshBasicMaterial({ map: makeScopeTexture() }));
          dial.position.set(-w * 0.2, topH + 0.28, -d * 0.3 + 0.145);
          grp.add(dial);
        } else if (obj.type === 'network_island') {
          for (const mx of [-Math.min(0.45, w * 0.22), Math.min(0.45, w * 0.22)]) {
            const mon = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.36, 0.05), mats.screenCaseMat);
            mon.position.set(mx, topH + 0.32, 0);
            grp.add(mon);
          }
        }
        continue;
      }

      if (obj.type === 'whiteboard') {
        const boardW = Math.max(1.2, w);
        const boardH = Math.min(1.6, Math.max(1.1, cat.defaultH || 1.5));
        const frame = new THREE.Mesh(new THREE.BoxGeometry(boardW, boardH, 0.08), mats.legMat);
        frame.position.y = 1.65;
        grp.add(frame);
        const face = new THREE.Mesh(
          new THREE.PlaneGeometry(boardW - 0.1, boardH - 0.1),
          new THREE.MeshBasicMaterial({ map: makeWhiteboardTexture() })
        );
        face.position.set(0, 1.65, 0.045);
        grp.add(face);
        const tray = new THREE.Mesh(new THREE.BoxGeometry(boardW * 0.7, 0.05, 0.12), mats.mullionMat);
        tray.position.set(0, 1.65 - boardH / 2, 0.07);
        grp.add(tray);
        continue;
      }

      if (obj.type === 'metal_cabinet') {
        const cabH = 1.98;
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(w, cabH, d),
          new THREE.MeshStandardMaterial({ color: color || '#64748b', metalness: 0.55, roughness: 0.38 })
        );
        body.position.y = cabH / 2;
        body.castShadow = true;
        grp.add(body);
        const seam = new THREE.Mesh(new THREE.BoxGeometry(0.02, cabH * 0.9, 0.02), mats.screenCaseMat);
        seam.position.set(0, cabH / 2, d / 2 + 0.008);
        grp.add(seam);
        continue;
      }

      if (obj.type === 'av_greenscreen') {
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(w, 2.85, Math.min(0.24, d)),
          new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.92 })
        );
        wall.position.y = 1.425;
        grp.add(wall);
        for (const px of [-w / 2 + 0.06, w / 2 - 0.06]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.95, 8), mats.mullionMat);
          post.position.set(px, 1.475, 0);
          grp.add(post);
          const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, Math.max(0.75, d)), mats.mullionMat);
          foot.position.set(px, 0.025, 0);
          grp.add(foot);
        }
        continue;
      }

      if (obj.type === 'av_camera') {
        const legCol = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.25, 1.38, 6), mats.legMat);
        legCol.position.y = 0.69;
        grp.add(legCol);
        const camBody = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.5), mats.screenCaseMat);
        camBody.position.y = 1.48;
        grp.add(camBody);
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.26, 12), mats.mullionMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(0, 1.48, 0.34);
        grp.add(lens);
        const tally = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), new THREE.MeshBasicMaterial({ color: '#ef4444' }));
        tally.position.set(0, 1.65, 0.2);
        grp.add(tally);
        continue;
      }

      if (obj.type === 'av_led_light') {
        const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.26, 1.65, 6), mats.legMat);
        stand.position.y = 0.825;
        grp.add(stand);
        const housing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.42, 0.14), mats.screenCaseMat);
        housing.position.set(0, 1.82, 0);
        housing.rotation.x = 0.18;
        grp.add(housing);
        const face = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.36), new THREE.MeshBasicMaterial({ color: '#fef9c3' }));
        face.position.set(0, 0, 0.075);
        housing.add(face);
        continue;
      }

      if (obj.type === 'av_mic_stand') {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.04, 14), mats.screenCaseMat);
        base.position.y = 0.02;
        grp.add(base);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.38, 8), mats.legMat);
        pole.position.y = 0.71;
        grp.add(pole);
        const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.56, 8), mats.legMat);
        boom.rotation.x = Math.PI / 2 - 0.35;
        boom.position.set(0, 1.44, 0.14);
        grp.add(boom);
        const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.16, 10), new THREE.MeshStandardMaterial({ color: color || '#e879f9' }));
        mic.position.set(0, 1.5, 0.34);
        grp.add(mic);
        continue;
      }

      if (obj.type === 'net_rack_19') {
        const rack = buildRackMesh(w, d, 2.15, (obj.x + obj.z) * 0.2, color || '#10b981', mats, animatedRefs);
        grp.add(rack);
        continue;
      }

      if (obj.type === 'net_patch_wall') {
        const chassis = new THREE.Mesh(new THREE.BoxGeometry(w, 0.85, Math.min(0.42, d)), mats.screenCaseMat);
        chassis.position.y = 1.55;
        grp.add(chassis);
        for (let r = 0; r < 3; r++) {
          const strip = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, 0.09, 0.04), mats.mullionMat);
          strip.position.set(0, 1.32 + r * 0.22, Math.min(0.42, d) / 2 + 0.01);
          grp.add(strip);
          const led = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 0.03), new THREE.MeshBasicMaterial({ color: color || '#38bdf8' }));
          led.position.set(-w * 0.28, 1.32 + r * 0.22, Math.min(0.42, d) / 2 + 0.028);
          grp.add(led);
          animatedRefs.leds.push({ mesh: led, phase: r * 0.9, alert: false });
        }
        continue;
      }

      if (obj.type === 'net_ups') {
        const ups = new THREE.Mesh(new THREE.BoxGeometry(w, 1.4, d), mats.screenCaseMat);
        ups.position.y = 0.7;
        ups.castShadow = true;
        grp.add(ups);
        const lcd = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, 0.14, 0.03), new THREE.MeshBasicMaterial({ color: color || '#f59e0b' }));
        lcd.position.set(0, 1.15, d / 2 + 0.01);
        grp.add(lcd);
        continue;
      }

      if (obj.type === 'pc_gamer_cyber') {
        const bench = buildWorkbenchMesh(w, d, 0.78, color || '#f43f5e', mats);
        grp.add(bench);
        const monL = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.38, 0.05), mats.screenCaseMat);
        monL.position.set(-0.36, 1.16, -0.15);
        monL.rotation.y = 0.14;
        grp.add(monL);
        const monR = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.38, 0.05), mats.screenCaseMat);
        monR.position.set(0.32, 1.16, -0.15);
        monR.rotation.y = -0.14;
        grp.add(monR);
        const tower = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.48, 0.44), mats.screenCaseMat);
        tower.position.set(w * 0.36, 1.04, -0.05);
        grp.add(tower);
        const rgb = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.36, 0.36), new THREE.MeshBasicMaterial({ color: '#ec4899' }));
        rgb.position.set(w * 0.36 - 0.125, 1.04, -0.05);
        grp.add(rgb);
        continue;
      }

      if (obj.type === 'pc_open_maint') {
        const bench = buildWorkbenchMesh(w, d, 0.84, color || '#a78bfa', mats);
        grp.add(bench);
        const esd = new THREE.Mesh(new THREE.BoxGeometry(w * 0.75, 0.02, d * 0.72), new THREE.MeshStandardMaterial({ color: '#4c1d95' }));
        esd.position.y = 0.89;
        grp.add(esd);
        const openCase = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.09, 0.48), mats.mullionMat);
        openCase.position.set(0, 0.94, 0.05);
        grp.add(openCase);
        const mobo = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.3), new THREE.MeshStandardMaterial({ color: '#047857' }));
        mobo.position.set(-0.04, 0.995, 0.05);
        grp.add(mobo);
        const gpu = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.05), new THREE.MeshStandardMaterial({ color: '#38bdf8' }));
        gpu.position.set(0, 1.03, 0.12);
        grp.add(gpu);
        continue;
      }

      if (obj.type === 'soc_wall_screen') {
        const sw = Math.max(1.8, w);
        const sh = Math.max(1.2, Math.min(2.1, sw * 0.45));
        const frame = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.12, sh + 0.12, 0.08), mats.screenCaseMat);
        frame.position.y = 2.35;
        grp.add(frame);
        const screen = new THREE.Mesh(
          new THREE.PlaneGeometry(sw, sh),
          new THREE.MeshBasicMaterial({ map: makeSocScreenTexture(obj.label || 'SOC MONITORING') })
        );
        screen.position.set(0, 2.35, 0.045);
        grp.add(screen);
        continue;
      }

      const sh = cat.surfaceProp ? findSupportingSurfaceHeight(obj, supportBoxes) : null;
      const { grp: propGrp, mountY } = createPropMountGroup(obj, sh, mats);
      grp.add(propGrp);

      if (obj.type === 'av_mixer') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, d), new THREE.MeshStandardMaterial({ color: '#312e81' }));
        body.position.set(0, mountY + 0.08, 0);
        body.rotation.x = 0.14;
        propGrp.add(body);
        for (let f = -2; f <= 2; f++) {
          const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.24), new THREE.MeshBasicMaterial({ color: f === 0 ? '#ec4899' : '#22d3ee' }));
          ledStrip.position.set(f * (w * 0.15), 0.08, 0);
          body.add(ledStrip);
        }
        continue;
      }

      if (obj.type === 'net_switch_stack') {
        for (let s = 0; s < 2; s++) {
          const sw = new THREE.Mesh(new THREE.BoxGeometry(w, 0.11, d), mats.screenCaseMat);
          sw.position.set(0, mountY + 0.06 + s * 0.13, 0);
          propGrp.add(sw);
          const bar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: color || '#22d3ee' }));
          bar.position.set(0, 0, d / 2 + 0.01);
          sw.add(bar);
        }
        continue;
      }

      if (obj.type === 'elec_solder_unit') {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.3), new THREE.MeshStandardMaterial({ color: '#ea580c' }));
        box.position.set(0, mountY + 0.11, 0);
        propGrp.add(box);
        const iron = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.26, 8), mats.legMat);
        iron.rotation.z = Math.PI / 3;
        iron.position.set(0.22, mountY + 0.14, 0.06);
        propGrp.add(iron);
        continue;
      }

      if (obj.type === 'elec_scope_unit') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.32), mats.screenCaseMat);
        body.position.set(0, mountY + 0.16, 0);
        propGrp.add(body);
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.2), new THREE.MeshBasicMaterial({ map: makeScopeTexture() }));
        scr.position.set(-0.04, mountY + 0.17, 0.165);
        propGrp.add(scr);
        continue;
      }

      if (obj.type === 'elec_multimeter') {
        const mm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.28), new THREE.MeshStandardMaterial({ color: '#eab308' }));
        mm.position.set(0, mountY + 0.06, 0);
        mm.rotation.x = 0.2;
        propGrp.add(mm);
        const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.09), new THREE.MeshBasicMaterial({ color: '#0f172a' }));
        lcd.rotation.x = -Math.PI / 2;
        lcd.position.set(0, 0.045, -0.04);
        mm.add(lcd);
        continue;
      }

      if (obj.type === 'elec_fume_extractor') {
        const unit = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 0.3), mats.mullionMat);
        unit.position.set(0, mountY + 0.17, 0);
        propGrp.add(unit);
        const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 16), mats.screenCaseMat);
        fan.rotation.x = Math.PI / 2;
        fan.position.set(0, mountY + 0.18, 0.16);
        propGrp.add(fan);
        continue;
      }

      const fallback = new THREE.Mesh(
        new THREE.BoxGeometry(w, cat.defaultH || 0.8, d),
        new THREE.MeshStandardMaterial({ color })
      );
      fallback.position.y = (cat.defaultH || 0.8) / 2;
      grp.add(fallback);
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
  }

  function rebuildWorld(nextMapData) {
    colliders.length = 0;
    interactables.length = 0;
    teacherRefs.length = 0;
    animatedRefs.rings.length = 0;
    animatedRefs.leds.length = 0;
    leaderboardBoards = [];

    disposeNodeTree(worldGroup);
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

  function update(elapsed, playerPos = null, diplomaEarned = false) {
    for (let i = 0; i < animatedRefs.rings.length; i++) {
      const r = animatedRefs.rings[i].ring;
      const pulse = 1 + Math.sin(elapsed * 2.5 + i) * 0.04;
      r.scale.set(pulse, pulse, 1);
    }
    for (const led of animatedRefs.leds) {
      const blink = Math.sin(elapsed * (led.alert ? 9 : 4.5) + led.phase) > 0;
      led.mesh.visible = blink;
    }
    for (const tr of teacherRefs) {
      tr.update(elapsed, playerPos, diplomaEarned);
    }
  }

  function dispose() {
    disposeNodeTree(worldGroup);
    while (worldGroup.children.length > 0) {
      worldGroup.remove(worldGroup.children[0]);
    }
    scene.remove(worldGroup);
  }

  rebuildWorld(currentMapData);

  return {
    colliders,
    interactables,
    get mapData() {
      return currentMapData;
    },
    teacherRefs,
    update,
    updateStationBadges,
    updateLeaderboardBoard,
    rebuildWorld,
    dispose
  };
}
