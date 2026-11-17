import * as THREE from 'three';
import { drawVariationWorksheetCanvas, getVariationSheetHitBoxes } from '../minigames/VariationTableGame.js';
import { getCatalogItem, getZonePolygonPoints, subtractDoorsFromWalls } from './mapSchema.js';

function makeRoomCanvasTexture(width, height, drawFn) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  if (typeof drawFn === 'function') {
    drawFn(ctx, width, height);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
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

function buildStudentDeskAndChair(parent, cx, cz, woodMat, metalMat, darkMat, seatMat) {
  const grp = new THREE.Group();
  grp.position.set(cx, 0, cz);

  const top = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.06, 0.84), woodMat);
  top.position.set(0, 0.76, 0);
  top.castShadow = true;
  top.receiveShadow = true;
  grp.add(top);

  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.03, 0.56), darkMat);
  shelf.position.set(0, 0.58, -0.02);
  grp.add(shelf);

  for (const [lx, lz] of [
    [-0.7, -0.34],
    [0.7, -0.34],
    [-0.7, 0.34],
    [0.7, 0.34]
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.74, 8), metalMat);
    leg.position.set(lx, 0.37, lz);
    grp.add(leg);
  }

  const chair = new THREE.Group();
  chair.position.set(0, 0, 0.72);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.055, 0.52), seatMat);
  seat.position.set(0, 0.45, 0);
  chair.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.44, 0.05), seatMat);
  back.position.set(0, 0.72, 0.24);
  chair.add(back);
  for (const [cxOff, czOff] of [
    [-0.22, -0.2],
    [0.22, -0.2],
    [-0.22, 0.2],
    [0.22, 0.2]
  ]) {
    const cLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.44, 8), metalMat);
    cLeg.position.set(cxOff, 0.22, czOff);
    chair.add(cLeg);
  }
  grp.add(chair);

  parent.add(grp);
  return grp;
}

export function computeSurvivalIntroShot(
  progress = 0,
  aiPos = { x: 1.8, z: -1.2 },
  spawnPos = { x: -3.95, z: 0.65 },
  elapsed = 0
) {
  const p = Math.max(0, Math.min(1, Number(progress) || 0));
  const sx = Number.isFinite(Number(spawnPos?.x)) ? Number(spawnPos.x) : -3.95;
  const sz = Number.isFinite(Number(spawnPos?.z)) ? Number(spawnPos.z) : 0.65;
  const ax = Number.isFinite(Number(aiPos?.x)) ? Number(aiPos.x) : 1.8;
  const az = Number.isFinite(Number(aiPos?.z)) ? Number(aiPos.z) : -1.2;
  const dx = ax - sx;
  const dz = az - sz;
  const dist = Math.max(1, Math.hypot(dx, dz));
  const ux = dx / dist;
  const uz = dz / dist;

  const briefingText = 'Survivez, terminez tous les TPs et ne faites aucun bruit au micro...';

  if (p < 0.28) {
    const localP = p / 0.28;
    const rawFlicker = Math.sin(elapsed * 42) * Math.cos(elapsed * 19);
    const flicker = localP < 0.35 ? (rawFlicker > 0.1 ? 0.92 : 0.22) : Math.max(0.14, 0.78 - localP * 0.55);
    const camPos = {
      x: sx - ux * localP * 0.65,
      y: 1.68 + Math.sin(localP * Math.PI) * 0.22,
      z: sz - uz * localP * 0.65
    };
    const camLook = {
      x: (sx + ax) * 0.5,
      y: 2.25 - localP * 0.7,
      z: (sz + az) * 0.5
    };
    return {
      phaseIndex: 0,
      phaseLabel: '⚡ COUPURE ÉLECTRIQUE — ALERTE INTRUSION',
      briefingText,
      flicker,
      redThreat: 0.28 + localP * 0.66,
      camPos,
      camLook
    };
  }

  if (p < 0.76) {
    const localP = (p - 0.28) / 0.48;
    const ease = localP < 0.5 ? 2 * localP * localP : 1 - Math.pow(-2 * localP + 2, 2) / 2;
    const startX = (sx + ax) * 0.5;
    const startZ = (sz + az) * 0.5;
    const endX = ax - ux * 2.15;
    const endZ = az - uz * 2.15;
    const camPos = {
      x: startX + (endX - startX) * ease + Math.sin(localP * Math.PI) * 0.35,
      y: 1.52 - ease * 0.22,
      z: startZ + (endZ - startZ) * ease
    };
    const camLook = {
      x: ax,
      y: 1.48 + ease * 0.12,
      z: az
    };
    const flicker = 0.72 + Math.sin(elapsed * 16) * 0.2;
    return {
      phaseIndex: 1,
      phaseLabel: '👁️ PROFESSEUR CIEL EN MODE TRAQUE !',
      briefingText,
      flicker,
      redThreat: 0.95,
      camPos,
      camLook
    };
  }

  const localP = (p - 0.76) / 0.24;
  const ease = localP < 0.5 ? 2 * localP * localP : 1 - Math.pow(-2 * localP + 2, 2) / 2;
  const fromX = ax - ux * 2.15;
  const fromZ = az - uz * 2.15;
  const camPos = {
    x: fromX + (sx - fromX) * ease,
    y: 1.3 + (1.68 - 1.3) * ease,
    z: fromZ + (sz - fromZ) * ease
  };
  const camLook = {
    x: ax,
    y: 1.56,
    z: az
  };
  return {
    phaseIndex: 2,
    phaseLabel: '🔦 PRÉPAREZ-VOUS — LA TRAQUE COMMENCE',
    briefingText,
    flicker: 0.88,
    redThreat: 0.72 * (1 - ease) + 0.18,
    camPos,
    camLook
  };
}

export function getDetentionCameraHitBoxes(width, height, kind = 'desk') {
  if (kind === 'board') {
    const btnW = 200;
    const btnH = 74;
    return [
      { id: 'cam_prev', action: 'prev', x: 18, y: Math.round((height - btnH) / 2), w: btnW, h: btnH },
      { id: 'cam_next', action: 'next', x: width - btnW - 18, y: Math.round((height - btnH) / 2), w: btnW, h: btnH }
    ];
  }
  const btnW = Math.round((width - 54) / 2);
  const btnH = 88;
  const y = height - btnH - 18;
  return [
    { id: 'cam_prev', action: 'prev', x: 18, y, w: btnW, h: btnH },
    { id: 'cam_next', action: 'next', x: 36 + btnW, y, w: btnW, h: btnH }
  ];
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
  const detW = 9.2;
  const detD = 9.2;
  const detH = 3.6;
  const detGroup = new THREE.Group();
  detGroup.name = 'detention-classroom-3d';
  root.add(detGroup);
  buildEnclosedRoom(detGroup, detCenter.x, detCenter.z, detW, detD, detH, '#1e2636', '#161b26', '#f59e0b');

  const wainscotMat = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.85 });
  const dadoBack = new THREE.Mesh(new THREE.BoxGeometry(detW - 0.3, 1.05, 0.05), wainscotMat);
  dadoBack.position.set(detCenter.x, 0.525, detCenter.z - detD / 2 + 0.14);
  detGroup.add(dadoBack);
  const dadoLeft = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.05, detD - 0.3), wainscotMat);
  dadoLeft.position.set(detCenter.x - detW / 2 + 0.14, 0.525, detCenter.z);
  detGroup.add(dadoLeft);

  const detLight = new THREE.PointLight('#fef3c7', 1.9, 16);
  detLight.position.set(detCenter.x, 3.25, detCenter.z + 0.3);
  detGroup.add(detLight);

  const detRedLight = new THREE.PointLight('#ef4444', 1.15, 12);
  detRedLight.position.set(detCenter.x + 2.5, 2.9, detCenter.z - 3.4);
  detGroup.add(detRedLight);

  const deskLampLight = new THREE.PointLight('#fde68a', 1.45, 4.2);
  deskLampLight.position.set(detCenter.x - 0.12, 1.42, detCenter.z + 0.45);
  detGroup.add(deskLampLight);

  const ceilingFixture = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.08, 0.45),
    new THREE.MeshBasicMaterial({ color: '#fef3c7' })
  );
  ceilingFixture.position.set(detCenter.x, detH - 0.06, detCenter.z + 0.3);
  detGroup.add(ceilingFixture);

  const boardHeaderScreen = makeRoomCanvasTexture(1024, 110, (ctx, w, h) => {
    ctx.fillStyle = '#0f2419';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SALLE D’HEURE DE COLLE 3D • TABLEAU & CAMÉRA POV COÉQUIPIERS', w / 2, h / 2);
  });

  const boardWoodMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.65 });
  const boardSlateMat = new THREE.MeshStandardMaterial({ color: '#0c1f17', roughness: 0.9 });
  const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(5.9, 2.72, 0.08), boardWoodMat);
  boardFrame.position.set(detCenter.x, 1.98, detCenter.z - detD / 2 + 0.16);
  detGroup.add(boardFrame);

  const boardSlate = new THREE.Mesh(new THREE.BoxGeometry(5.68, 2.52, 0.03), boardSlateMat);
  boardSlate.position.set(detCenter.x, 1.98, detCenter.z - detD / 2 + 0.2);
  detGroup.add(boardSlate);

  const boardTray = new THREE.Mesh(new THREE.BoxGeometry(5.76, 0.06, 0.14), boardWoodMat);
  boardTray.position.set(detCenter.x, 0.69, detCenter.z - detD / 2 + 0.25);
  detGroup.add(boardTray);

  const chalkMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.9 });
  for (let c = 0; c < 3; c++) {
    const chalk = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 8), chalkMat);
    chalk.rotation.z = Math.PI / 2;
    chalk.position.set(detCenter.x - 1.9 + c * 0.18, 0.73, detCenter.z - detD / 2 + 0.27);
    detGroup.add(chalk);
  }

  const boardHeaderMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(5.3, 0.34),
    new THREE.MeshBasicMaterial({ map: boardHeaderScreen?.tex || null })
  );
  boardHeaderMesh.position.set(detCenter.x, 3.03, detCenter.z - detD / 2 + 0.23);
  detGroup.add(boardHeaderMesh);

  let povRenderTarget = null;
  if (typeof THREE.WebGLRenderTarget === 'function') {
    povRenderTarget = new THREE.WebGLRenderTarget(640, 360, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true
    });
  }
  const povCamera = new THREE.PerspectiveCamera(72, 16 / 9, 0.1, 140);

  const survScreen = makeRoomCanvasTexture(1024, 576, (ctx, w, h) => {
    ctx.fillStyle = '#030812';
    ctx.fillRect(0, 0, w, h);
  });

  const monitorBezel = new THREE.Mesh(
    new THREE.BoxGeometry(3.72, 2.14, 0.06),
    new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.72, roughness: 0.28 })
  );
  monitorBezel.position.set(detCenter.x, 1.98, detCenter.z - detD / 2 + 0.22);
  detGroup.add(monitorBezel);

  const survMonitorMat = new THREE.MeshBasicMaterial({
    map: povRenderTarget?.texture || survScreen?.tex || null
  });
  const survMonitor = new THREE.Mesh(new THREE.PlaneGeometry(3.52, 1.98), survMonitorMat);
  survMonitor.position.set(detCenter.x, 1.98, detCenter.z - detD / 2 + 0.26);
  survMonitor.name = 'detention-pov-monitor';
  detGroup.add(survMonitor);

  const boardCamW = 3.52;
  const boardCamH = 0.42;
  const boardCamTex = makeRoomCanvasTexture(1024, 122, (ctx, w, h) => {
    ctx.fillStyle = '#071224';
    ctx.fillRect(0, 0, w, h);
  });
  const boardCamMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(boardCamW, boardCamH),
    new THREE.MeshBasicMaterial({ map: boardCamTex?.tex || null })
  );
  boardCamMesh.position.set(detCenter.x, 0.89, detCenter.z - detD / 2 + 0.26);
  boardCamMesh.name = 'detention-board-cam-bar';
  detGroup.add(boardCamMesh);

  const clockGroup = new THREE.Group();
  clockGroup.name = 'detention-wall-clock';
  clockGroup.position.set(detCenter.x + 3.45, 2.86, detCenter.z - detD / 2 + 0.18);
  detGroup.add(clockGroup);

  const clockRim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.36, 0.06, 24),
    new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.7, roughness: 0.3 })
  );
  clockRim.rotation.x = Math.PI / 2;
  clockGroup.add(clockRim);

  const clockFaceTex = makeRoomCanvasTexture(256, 256, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(cx, cy, 118, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 6;
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.sin(ang) * 92, cy - Math.cos(ang) * 92);
      ctx.lineTo(cx + Math.sin(ang) * 108, cy - Math.cos(ang) * 108);
      ctx.lineWidth = i % 3 === 0 ? 5 : 2.5;
      ctx.stroke();
    }
  });
  const clockFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 24),
    new THREE.MeshBasicMaterial({ map: clockFaceTex?.tex || null })
  );
  clockFace.position.z = 0.036;
  clockGroup.add(clockFace);

  const hourPivot = new THREE.Group();
  hourPivot.position.z = 0.042;
  const hourHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.022, 0.16, 0.01),
    new THREE.MeshBasicMaterial({ color: '#0f172a' })
  );
  hourHand.position.y = 0.07;
  hourPivot.add(hourHand);
  clockGroup.add(hourPivot);

  const minutePivot = new THREE.Group();
  minutePivot.position.z = 0.046;
  const minuteHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.016, 0.24, 0.01),
    new THREE.MeshBasicMaterial({ color: '#1e293b' })
  );
  minuteHand.position.y = 0.11;
  minutePivot.add(minuteHand);
  clockGroup.add(minutePivot);

  const secondPivot = new THREE.Group();
  secondPivot.position.z = 0.05;
  const secondHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.009, 0.26, 0.01),
    new THREE.MeshBasicMaterial({ color: '#ef4444' })
  );
  secondHand.position.y = 0.12;
  secondPivot.add(secondHand);
  clockGroup.add(secondPivot);

  const windowGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.04, 2.2),
    new THREE.MeshBasicMaterial({ color: '#1f0b12' })
  );
  windowGlow.position.set(detCenter.x + detW / 2 - 0.13, 1.75, detCenter.z);
  const windowPane = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 2.1, 3.1),
    new THREE.MeshBasicMaterial({ color: '#1e0910' })
  );
  windowPane.position.set(detCenter.x + detW / 2 - 0.13, 1.75, detCenter.z);
  detGroup.add(windowPane);
  detGroup.add(windowGlow);

  for (let b = -3; b <= 3; b++) {
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 2.25, 8),
      new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.85, roughness: 0.25 })
    );
    bar.position.set(detCenter.x + detW / 2 - 0.18, 1.75, detCenter.z + b * 0.44);
    detGroup.add(bar);
  }

  const woodDeskMat = new THREE.MeshStandardMaterial({ color: '#926239', roughness: 0.62 });
  const darkDeskMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.6 });
  const frameMetalMat = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.72, roughness: 0.35 });
  const chairMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.58 });

  const mainDesk = buildStudentDeskAndChair(
    detGroup,
    detCenter.x,
    detCenter.z + 0.5,
    woodDeskMat,
    frameMetalMat,
    darkDeskMat,
    chairMat
  );
  mainDesk.name = 'detention-student-desk';
  buildStudentDeskAndChair(detGroup, detCenter.x - 2.1, detCenter.z + 0.5, woodDeskMat, frameMetalMat, darkDeskMat, chairMat);
  buildStudentDeskAndChair(detGroup, detCenter.x + 2.1, detCenter.z + 0.5, woodDeskMat, frameMetalMat, darkDeskMat, chairMat);

  const penCup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.04, 0.11, 10),
    new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.4 })
  );
  penCup.position.set(detCenter.x - 0.64, 0.845, detCenter.z + 0.28);
  detGroup.add(penCup);

  const penStick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6),
    new THREE.MeshStandardMaterial({ color: '#2563eb' })
  );
  penStick.position.set(detCenter.x - 0.63, 0.9, detCenter.z + 0.28);
  penStick.rotation.z = 0.18;
  detGroup.add(penStick);

  const sheetW = 0.78;
  const sheetH = 0.585;
  const sheetStand = new THREE.Mesh(
    new THREE.BoxGeometry(sheetW + 0.04, 0.025, sheetH + 0.04),
    new THREE.MeshStandardMaterial({ color: '#3b2314', roughness: 0.7 })
  );
  sheetStand.position.set(detCenter.x - 0.14, 0.85, detCenter.z + 0.5);
  sheetStand.rotation.x = 0.34;
  detGroup.add(sheetStand);

  const sheetTex = makeRoomCanvasTexture(1024, 768, (ctx, w, h) => {
    drawVariationWorksheetCanvas(ctx, w, h, {}, null);
  });
  const mathSheetMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(sheetW, sheetH),
    new THREE.MeshBasicMaterial({ map: sheetTex?.tex || null })
  );
  mathSheetMesh.position.set(detCenter.x - 0.14, 0.866, detCenter.z + 0.505);
  mathSheetMesh.rotation.x = -Math.PI / 2 + 0.34;
  mathSheetMesh.name = 'detention-math-sheet-3d';
  detGroup.add(mathSheetMesh);

  const deskCamW = 0.44;
  const deskCamH = 0.3;
  const deskCamHousing = new THREE.Mesh(
    new THREE.BoxGeometry(deskCamW + 0.04, 0.03, deskCamH + 0.04),
    new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.7, roughness: 0.3 })
  );
  deskCamHousing.position.set(detCenter.x + 0.49, 0.87, detCenter.z + 0.46);
  deskCamHousing.rotation.order = 'YXZ';
  deskCamHousing.rotation.y = -0.18;
  deskCamHousing.rotation.x = 0.54;
  detGroup.add(deskCamHousing);

  const deskCamTex = makeRoomCanvasTexture(512, 340, (ctx, w, h) => {
    ctx.fillStyle = '#071224';
    ctx.fillRect(0, 0, w, h);
  });
  const deskCamMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(deskCamW, deskCamH),
    new THREE.MeshBasicMaterial({ map: deskCamTex?.tex || null })
  );
  deskCamMesh.position.set(detCenter.x + 0.49, 0.888, detCenter.z + 0.472);
  deskCamMesh.rotation.order = 'YXZ';
  deskCamMesh.rotation.y = -0.18;
  deskCamMesh.rotation.x = -Math.PI / 2 + 0.54;
  deskCamMesh.name = 'detention-desk-cam-console';
  detGroup.add(deskCamMesh);

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
      label: '[E] 📝 Feuille Tableaux de Variation & Caméra POV',
      position: new THREE.Vector3(detCenter.x, 0, detCenter.z + 0.5),
      interactRadius: 3.0,
      mesh: mainDesk
    }
  ];

  let currentMap = mapData;
  let lastLobbyDrawMs = 0;
  let lastSurvDrawMs = 0;
  let lastSheetDrawMs = 0;
  let lastCamBarDrawMs = 0;
  let hoveredSheetId = null;
  let hoveredDeskCamId = null;
  let hoveredBoardCamId = null;
  let lastDetentionState = {};
  let lastCamInfo = {
    label: '📹 Caméra Surveillance U300',
    status: 'Patrouille Atelier',
    camIndex: 0,
    camCount: 1,
    completedTps: 0,
    totalTps: 5
  };

  function setMapData(nextMap) {
    if (!nextMap) return;
    currentMap = nextMap;
    bounds = nextMap.bounds || bounds;
  }

  function setLivePovActive(active) {
    if (active && povRenderTarget?.texture) {
      if (survMonitorMat.map !== povRenderTarget.texture) {
        survMonitorMat.map = povRenderTarget.texture;
        survMonitorMat.needsUpdate = true;
      }
    } else if (survScreen?.tex) {
      if (survMonitorMat.map !== survScreen.tex) {
        survMonitorMat.map = survScreen.tex;
        survMonitorMat.needsUpdate = true;
      }
    }
  }

  function updateDetentionClock(elapsed = 0) {
    const t = Number(elapsed) || 0;
    secondPivot.rotation.z = -((t % 60) / 60) * Math.PI * 2;
    minutePivot.rotation.z = -((t / 3600) % 1) * Math.PI * 2 - 0.85;
    hourPivot.rotation.z = -((t / 43200) % 1) * Math.PI * 2 - 2.1;
  }

  function updateDetentionMathSheet(detentionSnapshot = lastDetentionState, force = false) {
    lastDetentionState = detentionSnapshot || {};
    const now = Date.now();
    if (!force && now - lastSheetDrawMs < 80) return;
    lastSheetDrawMs = now;
    if (sheetTex?.ctx && sheetTex?.tex) {
      drawVariationWorksheetCanvas(sheetTex.ctx, 1024, 768, lastDetentionState, hoveredSheetId);
      sheetTex.tex.needsUpdate = true;
    }
  }

  function drawCamControls() {
    const info = lastCamInfo || {};
    const idxNum = Math.max(1, (Number(info.camIndex) || 0) + 1);
    const cntNum = Math.max(1, Number(info.camCount) || 1);

    if (boardCamTex?.ctx && boardCamTex?.tex) {
      const ctx = boardCamTex.ctx;
      const W = 1024;
      const H = 122;
      ctx.fillStyle = '#061124';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.strokeRect(3, 3, W - 6, H - 6);

      const boxes = getDetentionCameraHitBoxes(W, H, 'board');
      boxes.forEach((b) => {
        const isHover = hoveredBoardCamId === b.id;
        ctx.fillStyle = isHover ? '#0284c7' : '#172554';
        ctx.strokeStyle = isHover ? '#7dd3fc' : '#38bdf8';
        ctx.lineWidth = isHover ? 3 : 2;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, 12);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.action === 'prev' ? '◀ Cam. Préc.' : 'Cam. Suiv. ▶', b.x + b.w / 2, b.y + b.h / 2);
      });

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(254, 42, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.fillText(
        `LIVE POV [${idxNum}/${cntNum}] : ${String(info.label || 'Caméra').slice(0, 32)}`,
        274,
        42
      );
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 21px monospace';
      ctx.fillText(
        `${String(info.status || 'En direct').slice(0, 44)}  •  TPs: ${info.completedTps || 0}/${info.totalTps || 5}`,
        250,
        84
      );
      ctx.textBaseline = 'alphabetic';
      boardCamTex.tex.needsUpdate = true;
    }

    if (deskCamTex?.ctx && deskCamTex?.tex) {
      const ctx = deskCamTex.ctx;
      const W = 512;
      const H = 340;
      ctx.fillStyle = '#071224';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, W - 8, H - 8);

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(32, 34, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#7dd3fc';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`CAMÉRA POV (${idxNum}/${cntNum})`, 52, 42);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 27px system-ui, sans-serif';
      ctx.fillText(String(info.label || 'Caméra').slice(0, 26), 22, 96);

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 21px system-ui, sans-serif';
      ctx.fillText(String(info.status || 'Patrouille').slice(0, 34), 22, 138);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 19px monospace';
      ctx.fillText(
        `TPs Survie: ${info.completedTps || 0}/${info.totalTps || 5} • Survivants: ${info.aliveCount ?? 0}`,
        22,
        186
      );

      const boxes = getDetentionCameraHitBoxes(W, H, 'desk');
      boxes.forEach((b) => {
        const isHover = hoveredDeskCamId === b.id;
        ctx.fillStyle = isHover ? '#0284c7' : '#172554';
        ctx.strokeStyle = isHover ? '#7dd3fc' : '#38bdf8';
        ctx.lineWidth = isHover ? 4 : 2.5;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, 14);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 24px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.action === 'prev' ? '◀ Préc.' : 'Suiv. ▶', b.x + b.w / 2, b.y + b.h / 2);
      });
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      deskCamTex.tex.needsUpdate = true;
    }
  }

  function updateDetentionCameraBar(camInfo = {}, force = false) {
    lastCamInfo = { ...lastCamInfo, ...camInfo };
    const now = Date.now();
    if (!force && now - lastCamBarDrawMs < 120) return;
    lastCamBarDrawMs = now;
    drawCamControls();
  }

  function hitTestBoxUv(boxes, width, height, uv) {
    if (!uv) return null;
    const px = uv.x * width;
    const py = (1 - uv.y) * height;
    for (const b of boxes) {
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) {
        return b;
      }
    }
    return null;
  }

  function getDetentionInteractiveSurfaces(handlers = {}) {
    const sheetBoxes = getVariationSheetHitBoxes(1024, 768);
    const deskCamBoxes = getDetentionCameraHitBoxes(512, 340, 'desk');
    const boardCamBoxes = getDetentionCameraHitBoxes(1024, 122, 'board');

    return [
      {
        id: 'detention_math_sheet',
        mesh: mathSheetMesh,
        width: sheetW,
        height: sheetH,
        hitTestUv(uv) {
          const hit = hitTestBoxUv(sheetBoxes, 1024, 768, uv);
          if (!hit) return null;
          return {
            id: hit.id,
            label: `Réponse ${['A', 'B', 'C', 'D'][hit.optionIndex] || ''}`,
            onClick: () => handlers.onSelectOption?.(hit.optionIndex)
          };
        },
        setHovered(nextId) {
          if (hoveredSheetId === nextId) return;
          hoveredSheetId = nextId;
          updateDetentionMathSheet(lastDetentionState, true);
        }
      },
      {
        id: 'detention_desk_cam_console',
        mesh: deskCamMesh,
        width: deskCamW,
        height: deskCamH,
        hitTestUv(uv) {
          const hit = hitTestBoxUv(deskCamBoxes, 512, 340, uv);
          if (!hit) return null;
          return {
            id: hit.id,
            label: hit.action === 'prev' ? 'Caméra Précédente' : 'Caméra Suivante',
            onClick: () => (hit.action === 'prev' ? handlers.onPrevCamera?.() : handlers.onNextCamera?.())
          };
        },
        setHovered(nextId) {
          if (hoveredDeskCamId === nextId) return;
          hoveredDeskCamId = nextId;
          drawCamControls();
        }
      },
      {
        id: 'detention_board_cam_bar',
        mesh: boardCamMesh,
        width: boardCamW,
        height: boardCamH,
        hitTestUv(uv) {
          const hit = hitTestBoxUv(boardCamBoxes, 1024, 122, uv);
          if (!hit) return null;
          return {
            id: hit.id,
            label: hit.action === 'prev' ? 'Caméra Précédente' : 'Caméra Suivante',
            onClick: () => (hit.action === 'prev' ? handlers.onPrevCamera?.() : handlers.onNextCamera?.())
          };
        },
        setHovered(nextId) {
          if (hoveredBoardCamId === nextId) return;
          hoveredBoardCamId = nextId;
          drawCamControls();
        }
      }
    ];
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
    ctx.fillText('🚪 SALON D’ATTENTE — INSTANCE SURVIE ISOLÉE', 38, 64);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText('Terminez 100 % des TPs en solo ou coop tout en échappant au Professeur CIEL !', 38, 106);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 21px system-ui, sans-serif';
    ctx.fillText('🎙️ Attention : le Professeur CIEL vous entend si vous criez au micro !', 38, 140);

    const players = Array.isArray(snapshot?.lobbyPlayers) ? snapshot.lobbyPlayers : [];
    const readyCnt = Number(snapshot?.readyCount) || 0;
    const minP = Math.max(1, Number(snapshot?.minPlayers) || 1);

    ctx.fillStyle = readyCnt >= minP ? '#34d399' : '#38bdf8';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(
      `Joueurs dans l’instance : ${players.length} (${readyCnt} prêt(s) • minimum ${minP} requis)`,
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
    const H = 576;
    ctx.fillStyle = '#030812';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 5;
    ctx.strokeRect(8, 8, W - 16, H - 16);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(14, 14, W - 28, 58);

    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(42, 43, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('REC • VIDÉOSURVEILLANCE ATELIER U300', 64, 50);

    const doneCnt = snapshot?.completedTps?.length || 0;
    const totalCnt = snapshot?.requiredTps?.length || 5;
    const aliveCnt = snapshot?.aliveCount ?? 0;
    const detCnt = snapshot?.detainedCount ?? 0;
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'right';
    ctx.fillText(`TPs: ${doneCnt}/${totalCnt} • VIVANTS: ${aliveCnt} • COLLÉS: ${detCnt}`, W - 30, 50);
    ctx.textAlign = 'left';

    const mapX = 34;
    const mapY = 86;
    const mapW = W - 68;
    const mapH = H - 134;
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

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('🟢 Survivant   🟡 Caché en Baie de Brassage   🔴 Professeur CIEL   ✅ TP Fait', 34, H - 20);

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
      spawn: { x: detCenter.x, z: detCenter.z + 1.16 },
      pcEye: { x: detCenter.x, y: 1.38, z: detCenter.z + 1.46 },
      lookAt: { x: detCenter.x, y: 1.04, z: detCenter.z - 0.05 },
      teacherSpot: { x: detCenter.x + 2.4, z: detCenter.z - 2.4 },
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
    boardHeaderScreen?.tex?.dispose?.();
    boardCamTex?.tex?.dispose?.();
    clockFaceTex?.tex?.dispose?.();
    sheetTex?.tex?.dispose?.();
    deskCamTex?.tex?.dispose?.();
    povRenderTarget?.dispose?.();
    root.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose?.();
      }
    });
    root.parent?.remove(root);
  }

  updateDetentionCameraBar(lastCamInfo, true);
  updateDetentionMathSheet({}, true);

  return {
    root,
    detGroup,
    mathSheetMesh,
    deskCamMesh,
    boardCamMesh,
    survMonitor,
    povRenderTarget,
    povCamera,
    setMapData,
    setLivePovActive,
    updateWaitingBoard,
    updateSurveillanceScreen,
    updateDetentionMathSheet,
    updateDetentionCameraBar,
    updateDetentionClock,
    getDetentionInteractiveSurfaces,
    getWaitingRoomConfig,
    getDetentionRoomConfig,
    dispose
  };
}
