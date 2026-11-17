import * as THREE from 'three';
import { TP_CATALOG } from '../core/gameState.js';
import { getCatalogItem, getZonePolygonPoints, subtractDoorsFromWalls } from './mapSchema.js';

function makeRoomCanvasTexture(width, height, drawFn) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  drawFn(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  return { canvas, ctx, tex };
}

function buildEnclosedRoom(group, cx, cz, w, d, h, wallColor, floorColor, accentColor) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.72, metalness: 0.12 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  floor.receiveShadow = true;
  group.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.88 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(cx, h, cz);
  group.add(ceiling);

  const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.78, metalness: 0.15 });
  const thick = 0.24;
  const defs = [
    [cx, h / 2, cz - d / 2, w, h, thick],
    [cx, h / 2, cz + d / 2, w, h, thick],
    [cx - w / 2, h / 2, cz, thick, h, d],
    [cx + w / 2, h / 2, cz, thick, h, d]
  ];
  for (const [wx, wy, wz, bw, bh, bd] of defs) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), wallMat);
    wall.position.set(wx, wy, wz);
    wall.receiveShadow = true;
    group.add(wall);
  }

  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(w - 0.3, 0.08, 0.06),
    new THREE.MeshBasicMaterial({ color: accentColor })
  );
  trim.position.set(cx, h - 0.18, cz - d / 2 + 0.15);
  group.add(trim);
}

export function createSurvivalPocketRooms(scene, mapData = null) {
  const root = new THREE.Group();
  root.name = 'survival-pocket-rooms';
  scene.add(root);

  let bounds = mapData?.bounds || { minX: -13, maxX: 13, minZ: -12.2, maxZ: 12.2, width: 26, depth: 24.4 };

  const waitCenter = { x: 0, z: (bounds.maxZ || 12.2) + 24 };
  const waitW = 10;
  const waitD = 10;
  const waitH = 3.8;
  const waitGroup = new THREE.Group();
  root.add(waitGroup);
  buildEnclosedRoom(waitGroup, waitCenter.x, waitCenter.z, waitW, waitD, waitH, '#111827', '#0f172a', '#e11d48');

  const waitLight = new THREE.PointLight('#38bdf8', 2.4, 16);
  waitLight.position.set(waitCenter.x, 3.3, waitCenter.z);
  waitGroup.add(waitLight);

  const waitAlertLight = new THREE.PointLight('#e11d48', 1.4, 12);
  waitAlertLight.position.set(waitCenter.x, 2.8, waitCenter.z - 3.6);
  waitGroup.add(waitAlertLight);

  const lobbyScreen = makeRoomCanvasTexture(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = '#07101f';
    ctx.fillRect(0, 0, w, h);
  });
  const lobbyBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 2.6),
    new THREE.MeshBasicMaterial({ map: lobbyScreen?.tex || null })
  );
  lobbyBoard.position.set(waitCenter.x, 2.15, waitCenter.z - waitD / 2 + 0.18);
  waitGroup.add(lobbyBoard);

  const readyPillar = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 1.15, 0.7),
    new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.65, roughness: 0.35 })
  );
  readyPillar.position.set(waitCenter.x - 1.5, 0.58, waitCenter.z - 2.6);
  waitGroup.add(readyPillar);

  const readyTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.08, 0.5),
    new THREE.MeshBasicMaterial({ color: '#10b981' })
  );
  readyTop.position.set(waitCenter.x - 1.5, 1.19, waitCenter.z - 2.6);
  waitGroup.add(readyTop);

  const exitPortal = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 2.3, 0.18),
    new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.45 })
  );
  exitPortal.position.set(waitCenter.x + 2.4, 1.15, waitCenter.z - 4.75);
  waitGroup.add(exitPortal);

  const detCenter = { x: 0, z: (bounds.maxZ || 12.2) + 52 };
  const detW = 10;
  const detD = 10;
  const detH = 3.8;
  const detGroup = new THREE.Group();
  root.add(detGroup);
  buildEnclosedRoom(detGroup, detCenter.x, detCenter.z, detW, detD, detH, '#1b141a', '#111319', '#f43f5e');

  const detLight = new THREE.PointLight('#fbbf24', 1.6, 15);
  detLight.position.set(detCenter.x, 3.3, detCenter.z);
  detGroup.add(detLight);

  const detRedLight = new THREE.PointLight('#ef4444', 1.1, 12);
  detRedLight.position.set(detCenter.x, 3.0, detCenter.z - 3.6);
  detGroup.add(detRedLight);

  const survScreen = makeRoomCanvasTexture(1024, 640, (ctx, w, h) => {
    ctx.fillStyle = '#030812';
    ctx.fillRect(0, 0, w, h);
  });
  const survFrame = new THREE.Mesh(
    new THREE.BoxGeometry(5.6, 3.3, 0.12),
    new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.7, roughness: 0.3 })
  );
  survFrame.position.set(detCenter.x, 2.15, detCenter.z - detD / 2 + 0.16);
  detGroup.add(survFrame);

  const survMonitor = new THREE.Mesh(
    new THREE.PlaneGeometry(5.3, 3.05),
    new THREE.MeshBasicMaterial({ map: survScreen?.tex || null })
  );
  survMonitor.position.set(detCenter.x, 2.15, detCenter.z - detD / 2 + 0.24);
  detGroup.add(survMonitor);

  const deskMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.55 });
  const detDesk = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.78, 0.9), deskMat);
  detDesk.position.set(detCenter.x, 0.39, detCenter.z + 0.35);
  detGroup.add(detDesk);

  const termBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 0.52, 0.08),
    new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.6 })
  );
  termBody.position.set(detCenter.x, 1.06, detCenter.z + 0.08);
  detGroup.add(termBody);

  const termScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.74, 0.44),
    new THREE.MeshBasicMaterial({ color: '#0ea5e9' })
  );
  termScreen.position.set(detCenter.x, 1.06, detCenter.z + 0.125);
  detGroup.add(termScreen);

  for (let b = -3; b <= 3; b++) {
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 2.4, 8),
      new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.85, roughness: 0.25 })
    );
    bar.position.set(detCenter.x + detW / 2 - 0.14, 1.5, detCenter.z + b * 0.42);
    detGroup.add(bar);
  }

  const waitingInteractables = [
    {
      id: 'survival-lobby-ready',
      type: 'survival_lobby_console',
      label: '[E] ✅ Prêt / Panneau Salon Survie',
      position: new THREE.Vector3(waitCenter.x - 1.5, 0, waitCenter.z - 2.6),
      interactRadius: 2.6,
      mesh: readyPillar
    },
    {
      id: 'survival-lobby-exit',
      type: 'survival_lobby_exit',
      label: '[E] 🚪 Quitter le Salon Survie',
      position: new THREE.Vector3(waitCenter.x + 2.4, 0, waitCenter.z - 4.2),
      interactRadius: 2.6,
      mesh: exitPortal
    }
  ];

  const detentionInteractables = [
    {
      id: 'survival-detention-terminal',
      type: 'survival_detention_terminal',
      label: '[E] 📐 Terminal Heure de Colle (Tableaux de Variation)',
      position: new THREE.Vector3(detCenter.x, 0, detCenter.z + 0.35),
      interactRadius: 3.0,
      mesh: detDesk
    }
  ];

  let currentMap = mapData;
  let lastLobbyDrawMs = 0;
  let lastSurvDrawMs = 0;

  function setMapData(nextMap) {
    if (!nextMap) return;
    currentMap = nextMap;
    bounds = nextMap.bounds || bounds;
  }

  function updateWaitingBoard(snapshot, force = false) {
    if (!lobbyScreen?.ctx || !lobbyScreen?.tex) return;
    const now = Date.now();
    if (!force && now - lastLobbyDrawMs < 150) return;
    lastLobbyDrawMs = now;

    const { ctx } = lobbyScreen;
    const W = 1024;
    const H = 512;
    ctx.fillStyle = '#060c19';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, W - 20, H - 20);

    ctx.fillStyle = '#fb7185';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText('🚪 SALON D’ATTENTE — MODE SURVIE HORREUR', 38, 64);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText('Terminez 100 % des TPs en coop tout en échappant au Professeur CIEL !', 38, 106);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 21px system-ui, sans-serif';
    ctx.fillText('🎙️ Attention : le Professeur CIEL vous entend si vous criez au micro !', 38, 140);

    const players = Array.isArray(snapshot?.lobbyPlayers) ? snapshot.lobbyPlayers : [];
    const readyCnt = Number(snapshot?.readyCount) || 0;
    const minP = Number(snapshot?.minPlayers) || 2;

    ctx.fillStyle = readyCnt >= minP ? '#34d399' : '#38bdf8';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(
      `Joueurs dans le salon : ${players.length} (${readyCnt} prêt(s) • minimum ${minP} requis)`,
      38,
      194
    );

    players.slice(0, 8).forEach((p, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const px = 38 + col * 475;
      const py = 224 + row * 64;
      ctx.fillStyle = p.ready ? 'rgba(6, 78, 59, 0.72)' : 'rgba(30, 41, 59, 0.8)';
      ctx.fillRect(px, py, 450, 50);
      ctx.strokeStyle = p.ready ? '#34d399' : '#64748b';
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, 450, 50);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillText(String(p.name || 'Élève').slice(0, 20), px + 16, py + 33);
      ctx.fillStyle = p.ready ? '#6ee7b7' : '#fbbf24';
      ctx.textAlign = 'right';
      ctx.fillText(p.ready ? '✅ PRÊT' : '⏳ EN ATTENTE', px + 434, py + 33);
      ctx.textAlign = 'left';
    });

    lobbyScreen.tex.needsUpdate = true;
  }

  function updateSurveillanceScreen(snapshot, force = false) {
    if (!survScreen?.ctx || !survScreen?.tex) return;
    const now = Date.now();
    if (!force && now - lastSurvDrawMs < 110) return;
    lastSurvDrawMs = now;

    const { ctx } = survScreen;
    const W = 1024;
    const H = 640;
    ctx.fillStyle = '#030812';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 5;
    ctx.strokeRect(8, 8, W - 16, H - 16);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(14, 14, W - 28, 64);

    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(42, 46, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 24px monospace';
    ctx.fillText('REC • VIDÉOSURVEILLANCE ATELIER U300', 64, 54);

    const doneCnt = snapshot?.completedTps?.length || 0;
    const totalCnt = snapshot?.requiredTps?.length || 5;
    const aliveCnt = snapshot?.aliveCount ?? 0;
    const detCnt = snapshot?.detainedCount ?? 0;
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'right';
    ctx.fillText(`TPs: ${doneCnt}/${totalCnt} • VIVANTS: ${aliveCnt} • COLLÉS: ${detCnt}`, W - 30, 54);
    ctx.textAlign = 'left';

    const mapX = 34;
    const mapY = 96;
    const mapW = W - 68;
    const mapH = H - 150;
    const b = currentMap?.bounds || bounds;
    const scale = Math.min(mapW / Math.max(1, b.width), mapH / Math.max(1, b.depth));
    const offX = mapX + (mapW - b.width * scale) / 2;
    const offY = mapY + (mapH - b.depth * scale) / 2;
    const toPx = (wx, wz) => [offX + (wx - b.minX) * scale, offY + (wz - b.minZ) * scale];

    ctx.fillStyle = '#061124';
    ctx.fillRect(mapX, mapY, mapW, mapH);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(mapX, mapY, mapW, mapH);

    for (const z of currentMap?.zones || []) {
      const pts = getZonePolygonPoints(z);
      if (pts.length < 3) continue;
      ctx.beginPath();
      pts.forEach((p, idx) => {
        const [px, py] = toPx(p.x, p.z);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fillStyle = 'rgba(30, 41, 59, 0.35)';
      ctx.fill();
    }

    const wallSegs = subtractDoorsFromWalls(currentMap?.walls || []);
    ctx.lineCap = 'round';
    for (const seg of wallSegs) {
      if (seg.kind === 'door_single' || seg.kind === 'door_double') continue;
      const [x1, y1] = toPx(seg.x1, seg.z1);
      const [x2, y2] = toPx(seg.x2, seg.z2);
      ctx.strokeStyle = seg.kind === 'glazed' ? '#38bdf8' : '#94a3b8';
      ctx.lineWidth = seg.kind === 'solid' ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    const doneSet = new Set(snapshot?.completedTps || []);
    for (const obj of currentMap?.objects || []) {
      const cat = getCatalogItem(obj.type);
      const [ox, oy] = toPx(obj.x, obj.z);
      if (cat?.tpId) {
        const isDone = doneSet.has(cat.tpId);
        ctx.fillStyle = isDone ? '#10b981' : '#fbbf24';
        ctx.beginPath();
        ctx.arc(ox, oy, 7, 0, Math.PI * 2);
        ctx.fill();
      } else if (obj.type === 'hiding_rack') {
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(ox - 5, oy - 5, 10, 10);
      }
    }

    for (const p of snapshot?.participants || []) {
      if (p.status !== 'alive') continue;
      const [px, py] = toPx(p.x, p.z);
      ctx.fillStyle = p.hiddenRackId ? '#fde047' : '#34d399';
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(
        `${p.name}${p.hiddenRackId ? ' (Caché)' : ''}`,
        px + 12,
        py + 5
      );
    }

    if (snapshot?.ai) {
      const [ax, ay] = toPx(snapshot.ai.x, snapshot.ai.z);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.beginPath();
      ctx.arc(ax, ay, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(ax, ay, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fecdd3';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(`👁️ PROF. CIEL [${String(snapshot.ai.state || 'patrol').toUpperCase()}]`, ax + 14, ay + 6);
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let sy = mapY; sy < mapY + mapH; sy += 8) {
      ctx.fillRect(mapX, sy, mapW, 2);
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText('🟢 Survivant   🟡 Caché en Baie de Brassage   🔴 Professeur CIEL   ✅ TP Fait', 34, H - 22);

    survScreen.tex.needsUpdate = true;
  }

  function getWaitingRoomConfig() {
    return {
      spawn: { x: waitCenter.x, z: waitCenter.z + 2.2 },
      lookAt: { x: waitCenter.x, z: waitCenter.z - 4.0 },
      bounds: {
        minX: waitCenter.x - waitW / 2 + 0.3,
        maxX: waitCenter.x + waitW / 2 - 0.3,
        minZ: waitCenter.z - waitD / 2 + 0.3,
        maxZ: waitCenter.z + waitD / 2 - 0.3,
        width: waitW,
        depth: waitD,
        height: waitH
      },
      colliders: [
        {
          minX: waitCenter.x - 2.1,
          maxX: waitCenter.x - 0.9,
          minZ: waitCenter.z - 3.0,
          maxZ: waitCenter.z - 2.2
        }
      ],
      interactables: waitingInteractables
    };
  }

  function getDetentionRoomConfig() {
    return {
      spawn: { x: detCenter.x, z: detCenter.z + 1.45 },
      lookAt: { x: detCenter.x, z: detCenter.z - 4.2 },
      teacherSpot: { x: detCenter.x + 2.1, z: detCenter.z - 2.4 },
      bounds: {
        minX: detCenter.x - 0.85,
        maxX: detCenter.x + 0.85,
        minZ: detCenter.z + 0.95,
        maxZ: detCenter.z + 2.15,
        width: detW,
        depth: detD,
        height: detH
      },
      colliders: [],
      interactables: detentionInteractables
    };
  }

  function dispose() {
    lobbyScreen?.tex?.dispose?.();
    survScreen?.tex?.dispose?.();
    root.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose?.();
      }
    });
    root.parent?.remove(root);
  }

  return {
    root,
    setMapData,
    updateWaitingBoard,
    updateSurveillanceScreen,
    getWaitingRoomConfig,
    getDetentionRoomConfig,
    dispose
  };
}
