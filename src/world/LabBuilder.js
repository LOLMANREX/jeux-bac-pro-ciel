import * as THREE from 'three';
import { TP_CATALOG } from '../core/gameState.js';

function makeCanvasTexture(width, height, drawFn) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePosterTexture(title, lines, accent) {
  return makeCanvasTexture(512, 360, (ctx, w, h) => {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    ctx.fillStyle = accent;
    ctx.fillRect(8, 8, w - 16, 62);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.fillText(title, 26, 48);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '22px monospace';
    lines.forEach((line, i) => {
      ctx.fillText(line, 28, 118 + i * 44);
    });
  });
}

function makeFloorTexture() {
  return makeCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#182338';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#24344f';
    ctx.lineWidth = 3;
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
    ctx.fillStyle = 'rgba(34, 211, 238, 0.12)';
    ctx.fillRect(0, 0, 8, 8);
  });
}

function makeStationLabelSprite(title, icon, color) {
  const tex = makeCanvasTexture(512, 160, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(10, 17, 32, 0.86)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(12, 18, w - 24, h - 36, 22);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${icon} ${title}`, w / 2, h / 2);
  });
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.8, 0.88, 1);
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
  boardGroup.position.set(7.7, 2.78, -10.72);

  const glowFrame = new THREE.Mesh(
    new THREE.BoxGeometry(5.76, 3.5, 0.08),
    new THREE.MeshBasicMaterial({ color: '#06b6d4' })
  );
  glowFrame.position.z = -0.02;
  boardGroup.add(glowFrame);

  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(5.6, 3.34, 0.14),
    new THREE.MeshStandardMaterial({ color: '#0b1324', metalness: 0.65, roughness: 0.35 })
  );
  boardGroup.add(bezel);

  const headerLed = new THREE.Mesh(
    new THREE.BoxGeometry(5.36, 0.04, 0.03),
    new THREE.MeshBasicMaterial({ color: '#22d3ee' })
  );
  headerLed.position.set(0, 1.62, 0.08);
  boardGroup.add(headerLed);

  const screenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(5.36, 3.12),
    new THREE.MeshBasicMaterial({ map: texture })
  );
  screenMesh.position.z = 0.085;
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

    ctx.strokeStyle = 'rgba(34, 211, 238, 0.06)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= W; gx += 64) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, H);
      ctx.stroke();
    }
    for (let gy = 0; gy <= H; gy += 64) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(W, gy);
      ctx.stroke();
    }

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
    ctx.font = 'bold 31px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏆 CLASSEMENT EN DIRECT - BAC PRO CIEL', 44, 59);

    ctx.fillStyle = onlineTotal > 0 ? 'rgba(16, 185, 129, 0.18)' : 'rgba(100, 116, 139, 0.22)';
    ctx.strokeStyle = onlineTotal > 0 ? '#10b981' : '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(W - 310, 36, 266, 46, 23);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = onlineTotal > 0 ? '#10b981' : '#94a3b8';
    ctx.beginPath();
    ctx.arc(W - 282, 59, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = onlineTotal > 0 ? '#a7f3d0' : '#cbd5e1';
    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${onlineTotal} en ligne • ${sorted.length} classé(s)`, W - 264, 59);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
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
      ctx.fillText('Terminez un poste de TP pour apparaître automatiquement au classement !', W / 2, 365);
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
      ctx.fillText('Actualisation automatique en temps réel • Salle BAC PRO CIEL', W / 2, H - 33);
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
  const colliders = []; // { minX, maxX, minZ, maxZ }
  const interactables = []; // { id, label, type, position, interactRadius, ring, mesh }
  const animatedRefs = {
    rings: [],
    leds: [],
    virusScreenMat: null,
    scopeScreenTex: null
  };

  const addBoxCollider = (cx, cz, w, d) => {
    colliders.push({
      minX: cx - w / 2,
      maxX: cx + w / 2,
      minZ: cz - d / 2,
      maxZ: cz + d / 2
    });
  };

  // Floor
  const floorTex = makeFloorTexture();
  floorTex.wrapS = THREE.RepeatWrapping;
  floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(7, 5.5);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 22),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.72, metalness: 0.1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Ceiling & light panels
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 22),
    new THREE.MeshStandardMaterial({ color: '#0e172a', roughness: 0.9 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 5.4;
  scene.add(ceiling);

  const lightPanelMat = new THREE.MeshBasicMaterial({ color: '#e0f2fe' });
  for (let x = -8; x <= 8; x += 8) {
    for (let z = -5; z <= 5; z += 5) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.7), lightPanelMat);
      panel.position.set(x, 5.32, z);
      scene.add(panel);
    }
  }

  // Walls
  const wallMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.82 });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#0ea5e9', roughness: 0.4, metalness: 0.4 });

  const walls = [
    { x: 0, z: -11, w: 28, d: 0.4 },
    { x: 0, z: 11, w: 28, d: 0.4 },
    { x: -14, z: 0, w: 0.4, d: 22 },
    { x: 14, z: 0, w: 0.4, d: 22 }
  ];
  walls.forEach((w) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w.w, 5.4, w.d), wallMat);
    mesh.position.set(w.x, 2.7, w.z);
    mesh.receiveShadow = true;
    scene.add(mesh);

    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(w.w > 1 ? w.w : 0.44, 0.1, w.d > 1 ? w.d : 0.44),
      trimMat
    );
    strip.position.set(w.x, 0.14, w.z);
    scene.add(strip);
  });

  const boardTex = makeCanvasTexture(1024, 420, (ctx, w, h) => {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, w - 14, h - 14);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 46px system-ui, sans-serif';
    ctx.fillText('BAC PRO CIEL — SALLE E204', 46, 78);

    ctx.fillStyle = '#0284c7';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.fillText('Cybersécurité • Informatique & Réseaux • Électronique', 46, 126);

    ctx.fillStyle = '#1e293b';
    ctx.font = '26px monospace';
    ctx.fillText('1. Oscilloscope : Trigger, Base de temps & PWM', 52, 192);
    ctx.fillText('2. Brasure PCB : 350°C sans plomb + Extracteur', 52, 236);
    ctx.fillText('3. Électronique : Loi d’Ohm U=RI & Multimètre', 52, 280);
    ctx.fillText('4. Cyberdéfense : Isolation + Antivirus EDR', 52, 324);
    ctx.fillText('5. Réseaux : Hyperviseur VM + VLAN 802.1Q', 52, 368);
  });
  const whiteboard = new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 2.7, 0.12),
    new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.35 })
  );
  whiteboard.position.set(0, 2.7, -10.74);
  scene.add(whiteboard);

  const wallLeaderboard = createWallLeaderboardBoard(scene);

  // Educational CIEL Posters on side walls
  const posters = [
    {
      pos: [-13.74, 2.7, -4.5],
      rotY: Math.PI / 2,
      tex: makePosterTexture(
        'LOI D’OHM & LED',
        ['U = R × I', 'P = U × I', 'R_LED = (U_alim - U_f) / I', 'Anode (+) = patte longue'],
        '#fbbf24'
      )
    },
    {
      pos: [-13.74, 2.7, 3.5],
      rotY: Math.PI / 2,
      tex: makePosterTexture(
        'BRASURE SANS PLOMB',
        ['Alliage SAC305 : 340-365°C', 'Chauffer pastille + patte', 'Cône brillant & concave', 'EPI : Extracteur actif'],
        '#fb923c'
      )
    },
    {
      pos: [13.74, 2.7, -4.5],
      rotY: -Math.PI / 2,
      tex: makePosterTexture(
        'VLAN 802.1Q & MODÈLE OSI',
        ['L2 : Switch / Trame 802.1Q', 'ACCESS : 1 VLAN (Poste)', 'TRUNK : Multi-VLAN (Uplink)', 'L3 : Routeur Inter-VLAN'],
        '#34d399'
      )
    },
    {
      pos: [13.74, 2.7, 3.5],
      rotY: -Math.PI / 2,
      tex: makePosterTexture(
        'RÉFLEXES CYBER CIEL',
        ['1. Isoler la carte réseau', '2. Tuer processus suspects', '3. MAJ Signatures Antivirus', '4. Quarantaine & Audit'],
        '#f43f5e'
      )
    }
  ];
  posters.forEach((p) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 2.2),
      new THREE.MeshStandardMaterial({ map: p.tex, roughness: 0.5 })
    );
    mesh.position.set(...p.pos);
    mesh.rotation.y = p.rotY;
    scene.add(mesh);
  });

  // Shared desk builder
  const legMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.6, roughness: 0.4 });
  const topMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.6 });
  const darkTopMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.55 });

  function createDesk(x, z, rotY = 0, dark = false) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;

    const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 1.3), dark ? darkTopMat : topMat);
    top.position.y = 0.86;
    top.castShadow = true;
    top.receiveShadow = true;
    g.add(top);

    [
      [-1.15, -0.52],
      [1.15, -0.52],
      [-1.15, 0.52],
      [1.15, 0.52]
    ].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.84, 0.08), legMat);
      leg.position.set(lx, 0.42, lz);
      leg.castShadow = true;
      g.add(leg);
    });

    scene.add(g);
    return g;
  }

  createDesk(0, -3.5, 0, true);
  addBoxCollider(0, -3.5, 2.8, 1.5);

  // Helper for station floor beacon + label
  function attachStationMarker(tp, deskGroup, yLabel = 2.15) {
    const ringGeo = new THREE.RingGeometry(1.15, 1.32, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: tp.color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.72
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(tp.position.x, 0.03, tp.position.z);
    scene.add(ring);

    const sprite = makeStationLabelSprite(tp.shortTitle, tp.icon, tp.color);
    sprite.position.set(0, yLabel, 0);
    deskGroup.add(sprite);

    animatedRefs.rings.push({ ring, baseColor: tp.color, id: tp.id });

    interactables.push({
      id: tp.id,
      type: 'tp',
      label: `${tp.icon} Ouvrir ${tp.title}`,
      position: new THREE.Vector3(tp.position.x, 0.9, tp.position.z),
      interactRadius: 2.9,
      ring,
      mesh: deskGroup
    });
  }

  // STATION 1: OSCILLOSCOPE (-8.5, -4.5)
  {
    const tp = TP_CATALOG[0];
    const desk = createDesk(tp.position.x, tp.position.z, Math.PI / 2);
    addBoxCollider(tp.position.x, tp.position.z, 1.5, 2.8);

    // DSO body
    const scope = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.55, 0.45),
      new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.4 })
    );
    scope.position.set(0, 1.18, -0.1);
    scope.castShadow = true;
    desk.add(scope);

    const scopeTex = makeCanvasTexture(256, 160, (ctx, w, h) => {
      ctx.fillStyle = '#041f1e';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.25)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const y = h / 2 + Math.sin((x / w) * Math.PI * 6) * 45;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.56, 0.36),
      new THREE.MeshBasicMaterial({ map: scopeTex })
    );
    screen.position.set(-0.1, 1.2, 0.13);
    desk.add(screen);

    // GBF Signal generator next to it
    const gbf = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.28, 0.42),
      new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.5 })
    );
    gbf.position.set(0.85, 1.05, 0);
    desk.add(gbf);

    attachStationMarker(tp, desk);
  }

  // STATION 2: BRASURE (-8.5, 3.5)
  {
    const tp = TP_CATALOG[1];
    const desk = createDesk(tp.position.x, tp.position.z, Math.PI / 2);
    addBoxCollider(tp.position.x, tp.position.z, 1.5, 2.8);

    // ESD Mat
    const mat = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.02, 0.85),
      new THREE.MeshStandardMaterial({ color: '#0369a1', roughness: 0.7 })
    );
    mat.position.set(0, 0.92, 0.05);
    desk.add(mat);

    // PCB
    const pcb = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.03, 0.42),
      new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.4 })
    );
    pcb.position.set(0, 0.94, 0.1);
    desk.add(pcb);

    // Soldering station + glowing tip
    const station = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.24, 0.36),
      new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.45 })
    );
    station.position.set(-0.75, 1.03, -0.15);
    desk.add(station);

    const ironTip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.005, 0.35, 8),
      new THREE.MeshBasicMaterial({ color: '#fb923c' })
    );
    ironTip.position.set(-0.48, 1.15, 0.1);
    ironTip.rotation.z = -0.5;
    desk.add(ironTip);

    // Fume extractor fan
    const extractor = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.42, 0.24),
      new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.6 })
    );
    extractor.position.set(0.68, 1.12, -0.2);
    desk.add(extractor);

    attachStationMarker(tp, desk);
  }

  // STATION 3: ÉLECTRONIQUE (0, -7.2)
  {
    const tp = TP_CATALOG[2];
    const desk = createDesk(tp.position.x, tp.position.z, 0);
    addBoxCollider(tp.position.x, tp.position.z, 2.8, 1.5);

    const breadboard = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.04, 0.42),
      new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.5 })
    );
    breadboard.position.set(0, 0.93, 0.15);
    desk.add(breadboard);

    // Glowing LEDs on breadboard
    const ledColors = ['#ef4444', '#22c55e', '#facc15'];
    ledColors.forEach((col, i) => {
      const led = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 10, 10),
        new THREE.MeshBasicMaterial({ color: col })
      );
      led.position.set(-0.18 + i * 0.18, 0.99, 0.15);
      desk.add(led);
    });

    // Benchtop power supply
    const psu = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.36, 0.4),
      new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.5 })
    );
    psu.position.set(-0.8, 1.09, -0.15);
    desk.add(psu);

    // Multimeter
    const multi = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.08, 0.4),
      new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.45 })
    );
    multi.position.set(0.75, 0.95, 0.1);
    desk.add(multi);

    attachStationMarker(tp, desk);
  }

  // STATION 4: PC INFECTÉ / ANTIVIRUS (8.5, 3.5)
  {
    const tp = TP_CATALOG[3];
    const desk = createDesk(tp.position.x, tp.position.z, -Math.PI / 2, true);
    addBoxCollider(tp.position.x, tp.position.z, 1.5, 2.8);

    // Infected Monitor
    const monitorStand = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.35, 0.14),
      legMat
    );
    monitorStand.position.set(0, 1.05, -0.15);
    desk.add(monitorStand);

    const monitorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 0.65, 0.07),
      new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.4 })
    );
    monitorFrame.position.set(0, 1.38, -0.12);
    desk.add(monitorFrame);

    const virusTex = makeCanvasTexture(256, 160, (ctx, w, h) => {
      ctx.fillStyle = '#450a0a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(14, 18, 228, 34);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('!! ALERTE VIRUS !!', 26, 42);
      ctx.fillStyle = '#fca5a5';
      ctx.font = '15px monospace';
      ctx.fillText('Trojan.Win32.CIEL', 24, 88);
      ctx.fillText('CPU: 99%  NET: OUT', 24, 118);
    });
    const virusScreenMat = new THREE.MeshBasicMaterial({ map: virusTex });
    animatedRefs.virusScreenMat = virusScreenMat;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.54), virusScreenMat);
    screen.position.set(0, 1.38, -0.08);
    desk.add(screen);

    // PC Tower with flashing red LED
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.72, 0.65),
      new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.5 })
    );
    tower.position.set(0.85, 1.26, -0.05);
    desk.add(tower);

    const alertLed = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 8, 8),
      new THREE.MeshBasicMaterial({ color: '#f43f5e' })
    );
    alertLed.position.set(0.85, 1.52, 0.29);
    desk.add(alertLed);
    animatedRefs.leds.push({ mesh: alertLed, phase: 0, alert: true });

    attachStationMarker(tp, desk, 2.3);
  }

  // STATION 5: BAIE SERVEUR VM & VLAN (8.5, -4.5)
  {
    const tp = TP_CATALOG[4];
    const desk = createDesk(tp.position.x, tp.position.z, -Math.PI / 2, true);
    addBoxCollider(tp.position.x, tp.position.z, 1.7, 3.0);

    // 19-inch server rack right beside the desk
    const rack = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 2.35, 0.9),
      new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.5, roughness: 0.35 })
    );
    rack.position.set(1.35, 1.18, 0);
    rack.castShadow = true;
    desk.add(rack);

    for (let u = 0; u < 6; u++) {
      const led = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.04, 0.04),
        new THREE.MeshBasicMaterial({ color: u % 2 === 0 ? '#10b981' : '#38bdf8' })
      );
      led.position.set(1.35 - 0.22 + (u % 3) * 0.14, 0.55 + u * 0.28, 0.46);
      desk.add(led);
      animatedRefs.leds.push({ mesh: led, phase: u * 1.1, alert: false });
    }

    // Network admin monitor
    const netTex = makeCanvasTexture(256, 160, (ctx, w, h) => {
      ctx.fillStyle = '#022c22';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 3;
      ctx.strokeRect(20, 22, 70, 44);
      ctx.strokeRect(164, 22, 70, 44);
      ctx.strokeRect(92, 98, 72, 42);
      ctx.beginPath();
      ctx.moveTo(55, 66);
      ctx.lineTo(128, 98);
      ctx.moveTo(199, 66);
      ctx.lineTo(128, 98);
      ctx.stroke();
      ctx.fillStyle = '#a7f3d0';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('VLAN 10/20/30', 76, 18);
    });
    const monitor = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.58, 0.06),
      new THREE.MeshStandardMaterial({ color: '#1e293b' })
    );
    monitor.position.set(-0.15, 1.35, -0.15);
    desk.add(monitor);

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.86, 0.48),
      new THREE.MeshBasicMaterial({ map: netTex })
    );
    screen.position.set(-0.15, 1.35, -0.11);
    desk.add(screen);

    attachStationMarker(tp, desk, 2.55);
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
