import * as THREE from 'three';
import { TP_CATALOG, EXTRA_STATIONS } from '../core/gameState.js';
import {
  WORLD_BOUNDS,
  PLATEAU_ZONES,
  PLATEAU_FURNITURE_BOXES,
  buildPlateauWalls,
  getStaticWallColliders,
  getPlateauFurnitureColliders
} from './plateauLayout.js';

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
    ctx.fillText(label, w / 2 + 6, h / 2);
  });
}

function makeOrientationMapTexture() {
  return makeCanvasTexture(1024, 680, (ctx, w, h) => {
    ctx.fillStyle = '#071022';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 5;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    ctx.fillStyle = '#0f2344';
    ctx.fillRect(16, 16, w - 32, 68);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🗺️ PLAN D’ORIENTATION — PLATEAU U300 (FILIÈRE CIEL)', 38, 50);

    const padX = 48;
    const padY = 108;
    const mapW = w - 96;
    const mapH = h - 148;
    const toPxX = (wx) => padX + ((wx - WORLD_BOUNDS.minX) / WORLD_BOUNDS.width) * mapW;
    const toPxY = (wz) => padY + ((wz - WORLD_BOUNDS.minZ) / WORLD_BOUNDS.depth) * mapH;

    ctx.fillStyle = '#0c1830';
    ctx.fillRect(padX, padY, mapW, mapH);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.strokeRect(padX, padY, mapW, mapH);

    for (const z of PLATEAU_ZONES) {
      if (z.id === 'U300' || z.id === 'U309' || z.id === 'U311' || z.id === 'U308') continue;
      const x1 = toPxX(z.bounds.minX);
      const y1 = toPxY(z.bounds.minZ);
      const rw = toPxX(z.bounds.maxX) - x1;
      const rh = toPxY(z.bounds.maxZ) - y1;
      ctx.fillStyle = `${z.color}26`;
      ctx.fillRect(x1 + 2, y1 + 2, rw - 4, rh - 4);
      ctx.strokeStyle = z.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x1 + 2, y1 + 2, rw - 4, rh - 4);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(z.code, x1 + rw / 2, y1 + rh / 2 - 11);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText(z.shortName, x1 + rw / 2, y1 + rh / 2 + 12);
    }

    const hx = toPxX(-3.95);
    const hy = toPxY(0.65);
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(hx, hy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#67e8f9';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText('HALL U300', hx - 58, hy + 26);
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
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${icon} ${title}`, w / 2, h / 2);
  });
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.7, 0.84, 1);
  return sprite;
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

function createWallLeaderboardBoard(scene) {
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
  texture.anisotropy = 4;

  const boardGroup = new THREE.Group();
  boardGroup.position.set(-2.51, 2.28, 0.28);
  boardGroup.rotation.y = -Math.PI / 2;

  const glowFrame = new THREE.Mesh(
    new THREE.BoxGeometry(3.48, 2.12, 0.06),
    new THREE.MeshBasicMaterial({ color: '#06b6d4' })
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

  scene.add(boardGroup);

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
      ctx.fillText('Actualisation automatique en temps réel • Plateau U300 - BAC PRO CIEL', W / 2, H - 33);
    }

    texture.needsUpdate = true;
  }

  update([], '');

  return {
    group: boardGroup,
    update
  };
}

export function buildLabWorld(scene) {
  const plateauWalls = buildPlateauWalls();
  const colliders = [...getStaticWallColliders(plateauWalls), ...getPlateauFurnitureColliders()];
  const interactables = [];
  const animatedRefs = {
    rings: [],
    leds: []
  };

  const H = WORLD_BOUNDS.height;

  const floorTex = makeFloorTexture();
  floorTex.wrapS = THREE.RepeatWrapping;
  floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(13, 12);

  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_BOUNDS.width, WORLD_BOUNDS.depth),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.72, metalness: 0.12 })
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  for (const z of PLATEAU_ZONES) {
    if (z.id === 'U300') continue;
    const rw = z.bounds.maxX - z.bounds.minX;
    const rd = z.bounds.maxZ - z.bounds.minZ;
    const padMat = new THREE.MeshBasicMaterial({
      color: z.color,
      transparent: true,
      opacity: z.id === 'ESCALIER' ? 0.14 : 0.06
    });
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(0.5, rw - 0.3), Math.max(0.5, rd - 0.3)), padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set((z.bounds.minX + z.bounds.maxX) / 2, 0.008, (z.bounds.minZ + z.bounds.maxZ) / 2);
    scene.add(pad);
  }

  const ceilingMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_BOUNDS.width, WORLD_BOUNDS.depth),
    new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.9 })
  );
  ceilingMesh.rotation.x = Math.PI / 2;
  ceilingMesh.position.y = H;
  scene.add(ceilingMesh);

  const ledPanelMat = new THREE.MeshBasicMaterial({ color: '#e0f2fe' });
  const ledFrameMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.5 });
  for (let lx = -9.5; lx <= 9.5; lx += 4.75) {
    for (let lz = -9.0; lz <= 9.0; lz += 6.0) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.07, 0.6), ledFrameMat);
      frame.position.set(lx, H - 0.05, lz);
      scene.add(frame);
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.48), ledPanelMat);
      panel.rotation.x = Math.PI / 2;
      panel.position.set(lx, H - 0.09, lz);
      scene.add(panel);
    }
  }

  const wallMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.85 });
  const dadoMat = new THREE.MeshStandardMaterial({ color: '#162238', roughness: 0.8 });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#0ea5e9', emissive: '#0284c7', emissiveIntensity: 0.25 });
  const mullionMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.7, roughness: 0.3 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#93c5fd',
    transparent: true,
    opacity: 0.22,
    roughness: 0.1,
    metalness: 0.15,
    side: THREE.DoubleSide
  });

  function addDoorSign(cx, cz, y, rotY, label, thickness) {
    const tex = makeDoorSignTexture(label);
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(1.46, 0.34, thickness + 0.1),
      new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.6, roughness: 0.3 })
    );
    housing.position.set(cx, y, cz);
    housing.rotation.y = rotY;
    scene.add(housing);

    const f1 = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.29), mat);
    f1.position.set(0, 0, (thickness + 0.1) / 2 + 0.004);
    housing.add(f1);

    const f2 = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.29), mat);
    f2.rotation.y = Math.PI;
    f2.position.set(0, 0, -(thickness + 0.1) / 2 - 0.004);
    housing.add(f2);
  }

  for (const seg of plateauWalls) {
    if (seg.type === 'plaque') continue;

    if (seg.type === 'diagonal' || seg.type === 'diagonalDoor') {
      const dx = seg.x2 - seg.x1;
      const dz = seg.z2 - seg.z1;
      const len = Math.hypot(dx, dz);
      const cx = (seg.x1 + seg.x2) / 2;
      const cz = (seg.z1 + seg.z2) / 2;
      const angle = -Math.atan2(dz, dx);

      if (seg.type === 'diagonalDoor') {
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(len, H - 2.4, seg.thickness), wallMat);
        lintel.position.set(cx, 2.4 + (H - 2.4) / 2, cz);
        lintel.rotation.y = angle;
        scene.add(lintel);
        addDoorSign(cx, cz, 2.66, angle, seg.sign || 'U304', seg.thickness);
      } else {
        const dado = new THREE.Mesh(new THREE.BoxGeometry(len, 1.05, seg.thickness), dadoMat);
        dado.position.set(cx, 0.525, cz);
        dado.rotation.y = angle;
        scene.add(dado);

        const glass = new THREE.Mesh(new THREE.BoxGeometry(len, 2.0, 0.04), glassMat);
        glass.position.set(cx, 2.05, cz);
        glass.rotation.y = angle;
        scene.add(glass);

        const topW = new THREE.Mesh(new THREE.BoxGeometry(len, H - 3.05, seg.thickness), wallMat);
        topW.position.set(cx, 3.05 + (H - 3.05) / 2, cz);
        topW.rotation.y = angle;
        scene.add(topW);
      }
      continue;
    }

    const len = seg.to - seg.from;
    const mid = (seg.from + seg.to) / 2;
    const isXAligned = seg.axis === 'z';
    const w = isXAligned ? len : seg.thickness;
    const d = isXAligned ? seg.thickness : len;
    const cx = isXAligned ? mid : seg.fixed;
    const cz = isXAligned ? seg.fixed : mid;

    if (seg.style === 'lintel') {
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(w, H - 2.4, d), wallMat);
      lintel.position.set(cx, 2.4 + (H - 2.4) / 2, cz);
      lintel.castShadow = true;
      scene.add(lintel);

      const jamW = isXAligned ? 0.06 : d;
      const jamD = isXAligned ? w : 0.06;
      const postA = new THREE.Mesh(new THREE.BoxGeometry(isXAligned ? 0.07 : seg.thickness + 0.03, 2.4, isXAligned ? seg.thickness + 0.03 : 0.07), mullionMat);
      postA.position.set(isXAligned ? seg.from + 0.03 : cx, 1.2, isXAligned ? cz : seg.from + 0.03);
      scene.add(postA);

      const postB = new THREE.Mesh(new THREE.BoxGeometry(isXAligned ? 0.07 : seg.thickness + 0.03, 2.4, isXAligned ? seg.thickness + 0.03 : 0.07), mullionMat);
      postB.position.set(isXAligned ? seg.to - 0.03 : cx, 1.2, isXAligned ? cz : seg.to - 0.03);
      scene.add(postB);

      if (seg.sign) {
        addDoorSign(cx, cz, 2.66, isXAligned ? 0 : Math.PI / 2, seg.sign, seg.thickness);
      }
      void jamW;
      void jamD;
      continue;
    }

    if (seg.style === 'stairWest') {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), dadoMat);
      panel.position.set(cx, H / 2, cz);
      panel.castShadow = true;
      panel.receiveShadow = true;
      scene.add(panel);
      continue;
    }

    if (seg.style === 'glazed' || seg.style === 'stairSouth') {
      const dado = new THREE.Mesh(new THREE.BoxGeometry(w, 1.05, d), dadoMat);
      dado.position.set(cx, 0.525, cz);
      dado.receiveShadow = true;
      scene.add(dado);

      const gw = isXAligned ? len : 0.04;
      const gd = isXAligned ? 0.04 : len;
      const glass = new THREE.Mesh(new THREE.BoxGeometry(gw, 2.0, gd), glassMat);
      glass.position.set(cx, 2.05, cz);
      scene.add(glass);

      const topW = new THREE.Mesh(new THREE.BoxGeometry(w, H - 3.05, d), wallMat);
      topW.position.set(cx, 3.05 + (H - 3.05) / 2, cz);
      scene.add(topW);

      const midRail = new THREE.Mesh(new THREE.BoxGeometry(w + 0.01, 0.06, d + 0.01), mullionMat);
      midRail.position.set(cx, 1.06, cz);
      scene.add(midRail);

      const topRail = new THREE.Mesh(new THREE.BoxGeometry(w + 0.01, 0.06, d + 0.01), mullionMat);
      topRail.position.set(cx, 3.04, cz);
      scene.add(topRail);
      continue;
    }

    const solid = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), wallMat);
    solid.position.set(cx, H / 2, cz);
    solid.castShadow = true;
    solid.receiveShadow = true;
    scene.add(solid);

    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(isXAligned ? len : d + 0.02, 0.06, isXAligned ? d + 0.02 : len),
      trimMat
    );
    trim.position.set(cx, 0.06, cz);
    scene.add(trim);
  }

  {
    const stairGroup = new THREE.Group();
    const stepMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.7 });
    const railMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.85, roughness: 0.25 });
    for (let s = 0; s < 10; s++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, 0.34), stepMat);
      step.position.set(-1.35, 0.1 + s * 0.22, -1.2 + s * 0.31);
      stairGroup.add(step);
    }
    const landing = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.24, 1.3), stepMat);
    landing.position.set(-0.3, 2.3, 1.35);
    stairGroup.add(landing);
    for (let s = 0; s < 8; s++) {
      const step2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, 0.3), stepMat);
      step2.position.set(0.85, 2.52 + s * 0.22, 0.65 - s * 0.28);
      stairGroup.add(step2);
    }
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 8), railMat);
    rail.rotation.x = Math.PI / 2 - 0.58;
    rail.position.set(-0.58, 1.85, 0.15);
    stairGroup.add(rail);
    scene.add(stairGroup);
  }

  const wallLeaderboard = createWallLeaderboardBoard(scene);

  {
    const mapTex = makeOrientationMapTexture();
    const mapMat = new THREE.MeshBasicMaterial({ map: mapTex });
    const spots = [
      { x: -7.5, y: 2.25, z: -3.07, rotY: 0 },
      { x: -0.3, y: 2.25, z: 2.24, rotY: 0 }
    ];
    for (const sp of spots) {
      const grp = new THREE.Group();
      grp.position.set(sp.x, sp.y, sp.z);
      grp.rotation.y = sp.rotY;
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(2.86, 1.92, 0.07),
        new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.6, roughness: 0.35 })
      );
      grp.add(frame);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(2.74, 1.8), mapMat);
      face.position.z = 0.04;
      grp.add(face);
      scene.add(grp);
    }
  }

  const boxById = new Map(PLATEAU_FURNITURE_BOXES.map((b) => [b.id, b]));
  const deskTopMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5, metalness: 0.15 });
  const legMat = new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.7, roughness: 0.35 });
  const screenCaseMat = new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.4 });

  function createWorkbench(x, z, w, d, topHeight = 0.82, accentColor = '#38bdf8') {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, d), deskTopMat);
    top.position.y = topHeight;
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);

    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.02, 0.025, d + 0.02),
      new THREE.MeshBasicMaterial({ color: accentColor })
    );
    trim.position.y = topHeight - 0.03;
    group.add(trim);

    const lx = w / 2 - 0.1;
    const lz = d / 2 - 0.1;
    for (const [px, pz] of [
      [-lx, -lz],
      [lx, -lz],
      [-lx, lz],
      [lx, lz]
    ]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, topHeight, 0.06), legMat);
      leg.position.set(px, topHeight / 2, pz);
      group.add(leg);
    }
    scene.add(group);
    return group;
  }

  function createRackTower(x, z, w, d, h = 2.15, ledOffsetPhase = 0, ledColor = '#10b981') {
    const grp = new THREE.Group();
    grp.position.set(x, 0, z);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.55, roughness: 0.35 })
    );
    body.position.y = h / 2;
    body.castShadow = true;
    grp.add(body);
    for (let i = 0; i < 6; i++) {
      const led = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.04, 0.04),
        new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? ledColor : '#38bdf8' })
      );
      led.position.set(-w * 0.25 + (i % 3) * 0.16, 0.45 + i * 0.26, d / 2 + 0.015);
      grp.add(led);
      animatedRefs.leds.push({ mesh: led, phase: ledOffsetPhase + i * 0.7, alert: false });
    }
    scene.add(grp);
    return grp;
  }

  function attachStationMarker(stationDef, parentGroup, radius = 2.6, ySprite = 2.55) {
    const ringGeo = new THREE.RingGeometry(0.68, 0.86, 36);
    const ringMat = new THREE.MeshBasicMaterial({
      color: stationDef.color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.86
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.03, 0);
    parentGroup.add(ring);
    animatedRefs.rings.push({ id: stationDef.id, ring, baseColor: stationDef.color });

    const label = makeStationLabelSprite(stationDef.shortTitle || stationDef.title, stationDef.icon, stationDef.color);
    label.position.set(0, ySprite, 0);
    parentGroup.add(label);

    interactables.push({
      id: stationDef.id,
      label: `[E] ${stationDef.title} (${stationDef.room})`,
      type: 'tp',
      tp: stationDef,
      position: new THREE.Vector3(stationDef.position.x, 0, stationDef.position.z),
      interactRadius: stationDef.interactRadius || radius,
      ring,
      mesh: parentGroup
    });
  }

  {
    const tp = TP_CATALOG.find((t) => t.id === 'soldering');
    const b = boxById.get('soldering');
    const bench = createWorkbench(b.x, b.z, b.w, b.d, 0.84, tp.color);
    const mat = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.02, 1.4), new THREE.MeshStandardMaterial({ color: '#0369a1' }));
    mat.position.y = 0.88;
    bench.add(mat);
    const unit = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.24, 0.35), new THREE.MeshStandardMaterial({ color: '#ea580c' }));
    unit.position.set(0, 1.0, -0.7);
    bench.add(unit);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.45, 4), legMat);
    hood.rotation.y = Math.PI / 4;
    hood.position.set(0, 2.2, 0);
    bench.add(hood);
    attachStationMarker(tp, bench, 2.6, 2.65);

    const wBench = boxById.get('u301_west');
    createWorkbench(wBench.x, wBench.z, wBench.w, wBench.d, 0.84, '#fb923c');
    const nBench = boxById.get('u301_north');
    createWorkbench(nBench.x, nBench.z, nBench.w, nBench.d, 0.84, '#fb923c');
  }

  {
    const tpScope = TP_CATALOG.find((t) => t.id === 'oscilloscope');
    const bScope = boxById.get('oscilloscope');
    const scopeDesk = createWorkbench(bScope.x, bScope.z, bScope.w, bScope.d, 0.84, tpScope.color);
    const scopeTex = makeCanvasTexture(256, 160, (ctx, w, h) => {
      ctx.fillStyle = '#041224';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#1e3a5f';
      for (let gx = 0; gx < w; gx += 32) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const y = h / 2 + Math.sin(x * 0.08) * 46;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
    const scopeChassis = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.42, 0.9), screenCaseMat);
    scopeChassis.position.set(0, 1.09, 0);
    scopeDesk.add(scopeChassis);
    const scopeScr = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.3), new THREE.MeshBasicMaterial({ map: scopeTex }));
    scopeScr.rotation.y = Math.PI / 2;
    scopeScr.position.set(0.31, 1.12, 0);
    scopeDesk.add(scopeScr);
    attachStationMarker(tpScope, scopeDesk, 2.5, 2.55);

    const tpElec = TP_CATALOG.find((t) => t.id === 'electronics');
    const bElec = boxById.get('electronics');
    const elecDesk = createWorkbench(bElec.x, bElec.z, bElec.w, bElec.d, 0.84, tpElec.color);
    const bread = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.8), new THREE.MeshStandardMaterial({ color: '#f8fafc' }));
    bread.position.set(0, 0.9, 0);
    elecDesk.add(bread);
    const psu = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.42), new THREE.MeshStandardMaterial({ color: '#334155' }));
    psu.position.set(0, 1.02, -0.75);
    elecDesk.add(psu);
    attachStationMarker(tpElec, elecDesk, 2.5, 2.55);

    const nb = boxById.get('u302_north');
    createWorkbench(nb.x, nb.z, nb.w, nb.d, 0.84, '#22d3ee');
  }

  {
    const stAv = EXTRA_STATIONS.find((s) => s.id === 'audiovisual');
    const bAv = boxById.get('audiovisual');
    const avDesk = createWorkbench(bAv.x, bAv.z, bAv.w, bAv.d, 0.82, stAv.color);
    const dualMon = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.48, 0.07), screenCaseMat);
    dualMon.position.set(0, 1.24, -0.2);
    avDesk.add(dualMon);
    const monFace = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 0.4),
      new THREE.MeshBasicMaterial({ color: '#ec4899' })
    );
    monFace.position.set(0, 1.24, -0.16);
    avDesk.add(monFace);
    attachStationMarker(stAv, avDesk, 2.8, 2.6);

    const bGs = boxById.get('u303_greenscreen');
    const gsWall = new THREE.Mesh(
      new THREE.BoxGeometry(bGs.w, 2.9, 0.22),
      new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.9 })
    );
    gsWall.position.set(bGs.x, 1.45, bGs.z);
    scene.add(gsWall);

    for (const camKey of ['u303_cam1', 'u303_cam2']) {
      const bc = boxById.get(camKey);
      const tripod = new THREE.Group();
      tripod.position.set(bc.x, 0, bc.z);
      const legCol = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.25, 1.4, 6), legMat);
      legCol.position.y = 0.7;
      tripod.add(legCol);
      const camBody = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.5), screenCaseMat);
      camBody.position.y = 1.5;
      tripod.add(camBody);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.24, 12), legMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, 1.5, -0.32);
      tripod.add(lens);
      scene.add(tripod);
    }
  }

  {
    const stStudio = EXTRA_STATIONS.find((s) => s.id === 'studio');
    const bStudio = boxById.get('studio');
    const studioDesk = createWorkbench(bStudio.x, bStudio.z, bStudio.w, bStudio.d, 0.82, stStudio.color);
    const mixer = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.14, 0.65), new THREE.MeshStandardMaterial({ color: '#312e81' }));
    mixer.position.set(0, 0.92, 0.1);
    mixer.rotation.x = 0.18;
    studioDesk.add(mixer);
    const spkL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.38, 0.24), screenCaseMat);
    spkL.position.set(-0.85, 1.15, -0.35);
    studioDesk.add(spkL);
    const spkR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.38, 0.24), screenCaseMat);
    spkR.position.set(0.85, 1.15, -0.35);
    studioDesk.add(spkR);
    attachStationMarker(stStudio, studioDesk, 2.7, 2.55);

    for (const bid of ['u304_booth1', 'u304_booth2', 'u304_booth3', 'u304_booth4']) {
      const bb = boxById.get(bid);
      const booth = createWorkbench(bb.x, bb.z, bb.w, bb.d, 0.78, '#e879f9');
      const acousticBack = new THREE.Mesh(
        new THREE.BoxGeometry(bb.w, 1.45, 0.12),
        new THREE.MeshStandardMaterial({ color: '#4c1d95', roughness: 0.95 })
      );
      acousticBack.position.set(0, 1.5, bb.d / 2 - 0.08);
      booth.add(acousticBack);
    }
  }

  {
    const stPatch = EXTRA_STATIONS.find((s) => s.id === 'patchrack');
    const bPatch = boxById.get('patchrack');
    const patchGroup = createRackTower(bPatch.x, bPatch.z, bPatch.w, bPatch.d, 2.1, 0.2, '#38bdf8');
    attachStationMarker(stPatch, patchGroup, 2.3, 2.5);

    const br1 = boxById.get('chambre_rack1');
    createRackTower(br1.x, br1.z, br1.w, br1.d, 2.1, 1.1, '#10b981');
    const br3 = boxById.get('chambre_rack3');
    createRackTower(br3.x, br3.z, br3.w, br3.d, 2.1, 2.3, '#10b981');

    const bUps = boxById.get('chambre_ups');
    const ups = new THREE.Mesh(new THREE.BoxGeometry(bUps.w, 1.4, bUps.d), new THREE.MeshStandardMaterial({ color: '#1e293b' }));
    ups.position.set(bUps.x, 0.7, bUps.z);
    scene.add(ups);

    const bClim = boxById.get('chambre_clim');
    const clim = new THREE.Mesh(new THREE.BoxGeometry(bClim.w, 1.85, bClim.d), new THREE.MeshStandardMaterial({ color: '#cbd5e1' }));
    clim.position.set(bClim.x, 0.925, bClim.z);
    scene.add(clim);

    const b309 = boxById.get('u309_rack');
    createRackTower(b309.x, b309.z, b309.w, b309.d, 1.9, 0.6, '#38bdf8');
    const b311 = boxById.get('u311_panel');
    createRackTower(b311.x, b311.z, b311.w, b311.d, 1.8, 1.4, '#f59e0b');
  }

  {
    const tpVm = TP_CATALOG.find((t) => t.id === 'vmvlan');
    const bVm = boxById.get('vmvlan');
    const vmGroup = createRackTower(bVm.x, bVm.z, bVm.w, bVm.d, 2.25, 0.4, '#34d399');
    attachStationMarker(tpVm, vmGroup, 2.8, 2.65);

    for (let i = 1; i <= 6; i++) {
      const bi = boxById.get(`u307_il${i}`);
      const island = createWorkbench(bi.x, bi.z, bi.w, bi.d, 0.78, '#34d399');
      const m1 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.36, 0.05), screenCaseMat);
      m1.position.set(-0.45, 1.15, 0);
      island.add(m1);
      const m2 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.36, 0.05), screenCaseMat);
      m2.position.set(0.45, 1.15, 0);
      island.add(m2);
    }
  }

  {
    const stHw = EXTRA_STATIONS.find((s) => s.id === 'hardware');
    const bHw = boxById.get('hardware');
    const hwBench = createWorkbench(bHw.x, bHw.z, bHw.w, bHw.d, 0.84, stHw.color);
    const esdMat = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.02, 1.6), new THREE.MeshStandardMaterial({ color: '#4c1d95' }));
    esdMat.position.y = 0.89;
    hwBench.add(esdMat);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.48, 0.48), screenCaseMat);
    tower.position.set(0, 1.14, 0);
    hwBench.add(tower);
    attachStationMarker(stHw, hwBench, 2.8, 2.55);

    const bDiag = boxById.get('u306_diag');
    const diagBench = createWorkbench(bDiag.x, bDiag.z, bDiag.w, bDiag.d, 0.84, '#a78bfa');
    const diagTower = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.48, 0.48), screenCaseMat);
    diagTower.position.set(0, 1.14, -0.35);
    diagBench.add(diagTower);

    const bSh = boxById.get('u306_shelf');
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(bSh.w, 2.0, bSh.d), new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.4 }));
    shelf.position.set(bSh.x, 1.0, bSh.z);
    scene.add(shelf);
  }

  {
    const tpAv = TP_CATALOG.find((t) => t.id === 'antivirus');
    const bSoc = boxById.get('antivirus');
    const socDesk = createWorkbench(bSoc.x, bSoc.z, bSoc.w, bSoc.d, 0.82, tpAv.color);
    const alertLed = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 12, 12),
      new THREE.MeshBasicMaterial({ color: '#f43f5e' })
    );
    alertLed.position.set(0.85, 1.35, -0.35);
    socDesk.add(alertLed);
    animatedRefs.leds.push({ mesh: alertLed, phase: 0, alert: true });

    const socTex = makeCanvasTexture(512, 220, (ctx, w, h) => {
      ctx.fillStyle = '#1f0812';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 4;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = '#fda4af';
      ctx.font = 'bold 28px monospace';
      ctx.fillText('SOC MONITORING • U305', 34, 60);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '20px monospace';
      ctx.fillText('IDS / PARE-FEU : ACTIF', 34, 122);
      ctx.fillText('QUARANTAINE : 0 MENACE ACTIVE', 34, 166);
    });
    const wallScreen = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 1.65), new THREE.MeshBasicMaterial({ map: socTex }));
    wallScreen.rotation.y = Math.PI;
    wallScreen.position.set(7.8, 2.35, 11.98);
    scene.add(wallScreen);

    attachStationMarker(tpAv, socDesk, 2.7, 2.55);

    for (const did of ['u305_desk1', 'u305_desk2', 'u305_desk3', 'u305_desk4']) {
      const bd = boxById.get(did);
      const dsk = createWorkbench(bd.x, bd.z, bd.w, bd.d, 0.78, '#f43f5e');
      const sc = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.42, 0.06), screenCaseMat);
      sc.position.set(0, 1.18, 0);
      dsk.add(sc);
    }
  }

  function updateStationBadges(grades = {}) {
    for (const item of animatedRefs.rings) {
      const g = grades[item.id];
      const passed = typeof g === 'number' && g >= 10;
      item.ring.material.color.set(passed ? '#10b981' : item.baseColor);
    }
  }

  function update(elapsed) {
    for (let i = 0; i < animatedRefs.rings.length; i++) {
      const r = animatedRefs.rings[i].ring;
      const pulse = 1 + Math.sin(elapsed * 2.5 + i) * 0.04;
      r.scale.set(pulse, pulse, 1);
    }
    for (const led of animatedRefs.leds) {
      const blink = Math.sin(elapsed * (led.alert ? 9 : 4.5) + led.phase) > 0;
      led.mesh.visible = blink;
    }
  }

  function updateLeaderboardBoard(entries = [], localPlayerName = '') {
    wallLeaderboard.update(entries, localPlayerName);
  }

  return {
    colliders,
    interactables,
    update,
    updateStationBadges,
    updateLeaderboardBoard
  };
}
