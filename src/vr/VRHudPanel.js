import * as THREE from 'three';
import {
  FORMATIVE_POLES,
  FORMATIVE_TP_CATALOG,
  computeFormativeStats,
  evaluateFormativeTp,
  getFormativePoleById,
  getFormativeTpById
} from '../core/formativeCatalog.js';
import {
  MEMO_CATEGORIES,
  RESISTOR_BAND_COLORS,
  calculateIpv4Subnet,
  decodeResistor4Band,
  filterCommandMemo
} from '../ui/tablet/CielToolsLogic.js';
import {
  clampZoomScale,
  computeWaypointNavigation,
  extractMapEntities,
  screenToWorld,
  worldToScreen
} from '../ui/tablet/CampusMapApp.js';
import { buildGradesSummary } from '../ui/tablet/GradesApp.js';
import { PlateauMiniMap } from '../ui/PlateauMiniMap.js';
import {
  clampFloor,
  createDefaultMap,
  formatFloorLabel,
  formatFloorShortLabel,
  getCatalogItem,
  getZoneAtPositionInMap,
  normalizeMapData
} from '../world/mapSchema.js';

function roundRectPath(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function wrapTextLines(ctx, text, maxWidth, maxLines = 2) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth) {
      cur = test;
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}

function formatClockText() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function resolveConnectionDisplay(connectionState, onlineCount, pingMs) {
  const st = String(connectionState || 'solo').toLowerCase();
  const count = Number.isFinite(Number(onlineCount)) ? Math.max(0, Number(onlineCount)) : 0;
  const ping = Number.isFinite(Number(pingMs)) && Number(pingMs) > 0 ? ` ${Math.round(pingMs)}ms` : '';
  if (st === 'connected') {
    return {
      label: `CONNECTÉ • ${Math.max(1, count)}${ping}`,
      dotColor: '#10b981',
      rimColor: '#10b981',
      bgColor: 'rgba(6, 78, 59, 0.85)',
      borderColor: '#34d399',
      textColor: '#a7f3d0'
    };
  }
  if (st === 'connecting') {
    return {
      label: 'CONNEXION...',
      dotColor: '#f59e0b',
      rimColor: '#f59e0b',
      bgColor: 'rgba(120, 53, 15, 0.85)',
      borderColor: '#fbbf24',
      textColor: '#fde68a'
    };
  }
  if (st === 'reconnecting' || st === 'error') {
    return {
      label: 'HORS LIGNE',
      dotColor: '#ef4444',
      rimColor: '#ef4444',
      bgColor: 'rgba(127, 29, 29, 0.85)',
      borderColor: '#fb7185',
      textColor: '#fecdd3'
    };
  }
  return {
    label: 'MODE SOLO',
    dotColor: '#38bdf8',
    rimColor: '#22d3ee',
    bgColor: 'rgba(15, 41, 66, 0.9)',
    borderColor: '#38bdf8',
    textColor: '#bae6fd'
  };
}

export function createWristHudPanel(options = {}) {
  const canvasW = 512;
  const canvasH = 480;
  const mapCanvasW = 464;
  const mapCanvasH = 220;

  let canvas = null;
  let ctx = null;
  let texture = null;
  let mapCanvas = null;
  let miniMap = null;
  let currentMapData = normalizeMapData(options.mapData || createDefaultMap());

  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    ctx = canvas.getContext('2d');
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    mapCanvas = document.createElement('canvas');
    mapCanvas.width = mapCanvasW;
    mapCanvas.height = mapCanvasH;
    miniMap = new PlateauMiniMap(mapCanvas, currentMapData);
  } else {
    miniMap = new PlateauMiniMap(null, currentMapData);
  }

  const group = new THREE.Group();

  const strapMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    metalness: 0.25,
    roughness: 0.65
  });
  const caseMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    metalness: 0.82,
    roughness: 0.22
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: '#22d3ee',
    emissive: '#0891b2',
    emissiveIntensity: 1.25,
    metalness: 0.8,
    roughness: 0.18
  });
  const crownMat = new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    metalness: 0.9,
    roughness: 0.15,
    emissive: '#0284c7',
    emissiveIntensity: 0.7
  });

  const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.148, 0.14, 0.014), caseMat);
  bezel.position.z = -0.008;
  group.add(bezel);

  const statusRim = new THREE.Mesh(new THREE.BoxGeometry(0.152, 0.144, 0.006), rimMat);
  statusRim.position.z = -0.004;
  group.add(statusRim);

  const strapTop = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.042, 0.018), strapMat);
  strapTop.position.set(0, 0.078, -0.014);
  strapTop.rotation.x = 0.28;
  group.add(strapTop);

  const strapBottom = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.042, 0.018), strapMat);
  strapBottom.position.set(0, -0.078, -0.014);
  strapBottom.rotation.x = -0.28;
  group.add(strapBottom);

  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.014, 12), crownMat);
  crown.rotation.z = Math.PI / 2;
  crown.position.set(0.079, 0.018, -0.007);
  group.add(crown);

  const screenMat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.98
  });
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.136, 0.128), screenMat);
  screenMesh.position.z = 0.001;
  group.add(screenMesh);

  let hitBoxes = [];
  let hoveredBtnId = null;
  let forceVisible = false;
  let hudSuppressed = false;
  let dirty = true;
  let lastDrawMs = 0;

  const state = {
    name: options.name || 'Eleve_CIEL',
    zoneLabel: '📍 U300 - Couloir Central',
    zoneColor: '#22d3ee',
    average: '-- / 20',
    completedCount: 0,
    totalTps: 5,
    xp: 0,
    coins: 0,
    coinGainAmount: 0,
    coinGainUntil: 0,
    micEnabled: false,
    isSpeaking: false,
    nearbySpeakers: [],
    connectionState: 'solo',
    onlineCount: 1,
    pingMs: null,
    targetHint: '',
    vrLabel: 'Quitter VR',
    playerPos: { x: -3.95, z: 0.65 },
    playerYaw: 0,
    playerFloor: 0,
    currentZone: null,
    peers: [],
    waypoint: null,
    survivalStatus: null,
    combatStatus: null
  };

  const redraw = () => {
    const conn = resolveConnectionDisplay(state.connectionState, state.onlineCount, state.pingMs);
    rimMat.color.set(state.isSpeaking ? '#34d399' : conn.rimColor);
    rimMat.emissive.set(state.isSpeaking ? '#10b981' : conn.rimColor);

    if (!ctx || !texture) {
      hitBoxes = [
        { id: 'btn_mic', x: 12, y: 396, w: 92, h: 64 },
        { id: 'btn_tablet', x: 110, y: 396, w: 92, h: 64 },
        { id: 'btn_shop', x: 208, y: 396, w: 92, h: 64 },
        { id: 'btn_locker', x: 306, y: 396, w: 92, h: 64 },
        { id: 'btn_vr_exit', x: 404, y: 396, w: 92, h: 64 }
      ];
      dirty = false;
      return;
    }

    hitBoxes = [];
    ctx.clearRect(0, 0, canvasW, canvasH);

    roundRectPath(ctx, 4, 4, canvasW - 8, canvasH - 8, 28);
    const bg = ctx.createLinearGradient(0, 0, canvasW, canvasH);
    bg.addColorStop(0, '#050d1d');
    bg.addColorStop(0.5, '#091830');
    bg.addColorStop(1, '#061224');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = state.isSpeaking ? '#34d399' : conn.rimColor;
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`⌚ CIEL WATCH • ${formatClockText()}`, 22, 34);

    const pillW = 196;
    const pillX = canvasW - pillW - 20;
    roundRectPath(ctx, pillX, 14, pillW, 28, 14);
    ctx.fillStyle = conn.bgColor;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = conn.borderColor;
    ctx.stroke();

    ctx.fillStyle = conn.dotColor;
    ctx.beginPath();
    ctx.arc(pillX + 16, 28, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = conn.textColor;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(conn.label.slice(0, 22), pillX + 27, 33);

    roundRectPath(ctx, 20, 50, canvasW - 40, 68, 14);
    ctx.fillStyle = 'rgba(15, 32, 58, 0.92)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 21px system-ui, sans-serif';
    ctx.fillText(String(state.name || 'Élève').slice(0, 16), 34, 78);

    const avgDisplay =
      typeof state.average === 'number'
        ? `${state.average.toFixed(1)}/20`
        : String(state.average || '--/20');
    const doneCnt = Number.isFinite(Number(state.completedCount)) ? Number(state.completedCount) : 0;
    const totalCnt = Number.isFinite(Number(state.totalTps)) && Number(state.totalTps) > 0 ? Number(state.totalTps) : 5;
    const coinVal = Math.max(0, Math.floor(Number(state.coins) || 0));
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`🪙 ${coinVal} CC • ${avgDisplay} • ${doneCnt}/${totalCnt}`, canvasW - 34, 78);
    if (state.coinGainAmount > 0 && Date.now() < (state.coinGainUntil || 0)) {
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText(`+${state.coinGainAmount} 🪙`, canvasW - 34, 98);
    }
    ctx.textAlign = 'left';

    ctx.fillStyle = state.zoneColor || '#38bdf8';
    ctx.font = '600 16px system-ui, sans-serif';
    const subStatus = state.targetHint
      ? String(state.targetHint).slice(0, 44)
      : String(state.zoneLabel || '📍 U300 - Couloir Central').slice(0, 44);
    ctx.fillText(subStatus, 34, 105);

    if (state.survivalStatus?.active) {
      const nl = Math.max(0, Math.min(1, Number(state.survivalStatus.noiseLevel) || 0));
      roundRectPath(ctx, 290, 93, 186, 16, 8);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fill();
      roundRectPath(ctx, 292, 95, Math.max(4, 182 * nl), 12, 6);
      ctx.fillStyle = nl >= 0.45 ? '#ef4444' : nl >= 0.25 ? '#f59e0b' : '#22c55e';
      ctx.fill();
    }

    const mapX = 24;
    const mapY = 128;
    roundRectPath(ctx, mapX - 3, mapY - 3, mapCanvasW + 6, mapCanvasH + 6, 16);
    ctx.fillStyle = '#040a17';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#22d3ee';
    ctx.stroke();

    if (state.combatStatus?.active) {
      const cs = state.combatStatus;
      const hp = Math.max(0, Math.round(Number(cs.hp) || 0));
      const maxHp = Math.max(1, Math.round(Number(cs.maxHp) || 100));
      const hpRatio = Math.max(0, Math.min(1, hp / maxHp));
      roundRectPath(ctx, mapX, mapY, mapCanvasW, mapCanvasH, 13);
      ctx.fillStyle = 'rgba(5, 11, 24, 0.96)';
      ctx.fill();

      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillText(cs.mode === 'melee' ? '⚔️ ARÈNE MÊLÉE CIEL' : '🔫 ARÈNE FUSILS CIEL', mapX + 16, mapY + 30);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fde047';
      ctx.fillText(`⏱️ ${cs.timerText || '02:30'}`, mapX + mapCanvasW - 16, mapY + 30);
      ctx.textAlign = 'left';

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillText(`❤️ SANTÉ : ${hp} / ${maxHp}`, mapX + 16, mapY + 68);
      roundRectPath(ctx, mapX + 16, mapY + 78, mapCanvasW - 32, 24, 8);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      roundRectPath(ctx, mapX + 18, mapY + 80, Math.max(8, (mapCanvasW - 36) * hpRatio), 20, 6);
      ctx.fillStyle = hpRatio > 0.5 ? '#10b981' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444';
      ctx.fill();

      ctx.fillStyle = '#bae6fd';
      ctx.font = 'bold 19px system-ui, sans-serif';
      ctx.fillText(String(cs.weaponName || 'Arme CIEL').slice(0, 28), mapX + 16, mapY + 134);
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 22px monospace';
      ctx.fillText(
        cs.mode === 'melee' ? '∞ Corps-à-corps' : cs.reloading ? '🔄 Rechargement...' : `🔋 ${cs.ammo ?? 0} / ${cs.maxAmmo ?? 0}`,
        mapX + 16,
        mapY + 166
      );
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText(
        `⚔️ Élim: ${cs.kills || 0}/${cs.killLimit || 10}  •  💀 Morts: ${cs.deaths || 0}  •  🔥 ${cs.streak || 0}`,
        mapX + 16,
        mapY + 202
      );
    } else if (miniMap && mapCanvas) {
      const zoneObj =
        state.currentZone ||
        (state.playerPos
          ? getZoneAtPositionInMap(currentMapData, state.playerPos.x, state.playerPos.z)
          : null);
      miniMap.render({
        playerPos: state.playerPos,
        playerYaw: state.playerYaw,
        currentZone: zoneObj,
        peers: Array.isArray(state.peers) ? state.peers : [],
        floor: state.playerFloor,
        waypoint: state.waypoint || null
      });
      ctx.save();
      roundRectPath(ctx, mapX, mapY, mapCanvasW, mapCanvasH, 13);
      ctx.clip();
      ctx.drawImage(mapCanvas, mapX, mapY, mapCanvasW, mapCanvasH);
      ctx.restore();
    }

    const peerCount = Array.isArray(state.peers) ? state.peers.length : 0;
    roundRectPath(ctx, mapX + 10, mapY + 8, 132, 24, 10);
    ctx.fillStyle = 'rgba(7, 15, 32, 0.84)';
    ctx.fill();
    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('🗺️ PLAN U300', mapX + 20, mapY + 24);

    roundRectPath(ctx, mapX + mapCanvasW - 142, mapY + 8, 132, 24, 10);
    ctx.fillStyle = 'rgba(7, 15, 32, 0.84)';
    ctx.fill();
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(`👥 ${peerCount + 1} en salle`, mapX + mapCanvasW - 130, mapY + 24);

    if (state.nearbySpeakers?.length) {
      const names = state.nearbySpeakers
        .slice(0, 2)
        .map((s) => `${s.name} (${Math.round(s.distance)}m)`)
        .join(' • ');
      ctx.fillStyle = '#34d399';
      ctx.font = '600 16px system-ui, sans-serif';
      ctx.fillText(`🔊 ${names}`, 24, 378);
    } else {
      ctx.fillStyle = '#64748b';
      ctx.font = '500 15px system-ui, sans-serif';
      ctx.fillText('🎧 Audio spatial 3D actif (0–18m) • Joystick G: Bouger • D: Snap-Turn', 24, 378);
    }

    const drawBtn = (id, x, y, w, h, label, bgHex, borderHex, textHex) => {
      const hovered = hoveredBtnId === id;
      roundRectPath(ctx, x, y, w, h, 12);
      ctx.fillStyle = hovered ? borderHex : bgHex;
      ctx.fill();
      ctx.lineWidth = hovered ? 3.5 : 2;
      ctx.strokeStyle = borderHex;
      ctx.stroke();
      ctx.fillStyle = hovered ? '#04101f' : textHex;
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + w / 2, y + h / 2, w - 8);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      hitBoxes.push({ id, x, y, w, h });
    };

    const micBg = state.isSpeaking
      ? '#991b1b'
      : state.micEnabled
        ? '#065f46'
        : '#1e293b';
    const micBorder = state.isSpeaking
      ? '#f87171'
      : state.micEnabled
        ? '#34d399'
        : '#38bdf8';
    const micTxt = state.isSpeaking
      ? '🔴 Direct'
      : state.micEnabled
        ? '🎙️ Micro ON'
        : '🔇 Micro OFF';
    const exitTxt = state.vrLabel === 'Quitter Sim VR' ? '🚪 Sim OFF' : `🚪 ${state.vrLabel}`;

    drawBtn('btn_mic', 12, 396, 92, 64, micTxt, micBg, micBorder, '#f8fafc');
    drawBtn('btn_tablet', 110, 396, 92, 64, '📱 Tablette', '#083344', '#22d3ee', '#cffafe');
    drawBtn('btn_shop', 208, 396, 92, 64, '🛒 Boutique', '#78350f', '#fbbf24', '#fef08a');
    drawBtn('btn_locker', 306, 396, 92, 64, '🎨 Casier', '#0c4a6e', '#38bdf8', '#e0f2fe');
    drawBtn('btn_vr_exit', 404, 396, 92, 64, exitTxt, '#3f1d2b', '#fb7185', '#ffe4e6');

    texture.needsUpdate = true;
    dirty = false;
  };

  redraw();

  const worldPos = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  const forward = new THREE.Vector3();
  const toCam = new THREE.Vector3();
  const camToWatch = new THREE.Vector3();

  const updateVisibility = (cameraWorldPos, dt = 0.016, nowMs = Date.now(), cameraWorldDir = null) => {
    if (hudSuppressed) {
      group.visible = false;
      screenMat.opacity = 0;
      return false;
    }
    if (forceVisible) {
      group.visible = true;
      screenMat.opacity = 0.98;
      if (dirty && nowMs - lastDrawMs >= 165) {
        lastDrawMs = nowMs;
        redraw();
      }
      return true;
    }
    group.getWorldPosition(worldPos);
    group.getWorldQuaternion(worldQuat);
    forward.set(0, 0, 1).applyQuaternion(worldQuat).normalize();
    toCam.copy(cameraWorldPos).sub(worldPos).normalize();
    const facing = forward.dot(toCam);
    let camAlign = 1;
    if (cameraWorldDir) {
      camToWatch.copy(toCam).negate();
      camAlign = cameraWorldDir.dot(camToWatch);
    }
    const shouldShow = hoveredBtnId
      ? facing > 0.18
      : cameraWorldDir
        ? group.visible
          ? facing > 0.24 && camAlign > 0.42
          : facing > 0.34 && camAlign > 0.56
        : group.visible
          ? facing > 0.2
          : facing > 0.26;
    if (shouldShow) {
      group.visible = true;
      screenMat.opacity += (0.98 - screenMat.opacity) * Math.min(1, dt * 12);
      if (dirty && nowMs - lastDrawMs >= 165) {
        lastDrawMs = nowMs;
        redraw();
      }
    } else {
      screenMat.opacity += (0 - screenMat.opacity) * Math.min(1, dt * 12);
      if (screenMat.opacity < 0.05) {
        group.visible = false;
      }
    }
    return group.visible;
  };

  const hitTestUv = (uv) => {
    if (!uv || !group.visible) return null;
    const cx = uv.x * canvasW;
    const cy = (1 - uv.y) * canvasH;
    for (const b of hitBoxes) {
      if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) {
        return b;
      }
    }
    return null;
  };

  const setHovered = (id) => {
    if (hoveredBtnId !== id) {
      hoveredBtnId = id;
      redraw();
    }
  };

  const setMapData = (mapData) => {
    if (!mapData) return;
    currentMapData = normalizeMapData(mapData);
    miniMap?.setMapData(currentMapData);
    dirty = true;
    redraw();
  };

  let lastMiniMapSig = '';
  const updateMiniMap = (data = {}) => {
    const px = data.playerPos ? Math.round((Number(data.playerPos.x) || 0) * 10) : null;
    const pz = data.playerPos ? Math.round((Number(data.playerPos.z) || 0) * 10) : null;
    const pyaw = typeof data.playerYaw === 'number' && Number.isFinite(data.playerYaw) ? Math.round(data.playerYaw * 15) : null;
    const zid = data.currentZone?.id || data.currentZone?.badgeText || '';
    const pCnt = Array.isArray(data.peers) ? data.peers.length : -1;
    const fl =
      data.floor !== undefined && data.floor !== null
        ? clampFloor(data.floor)
        : data.playerFloor !== undefined && data.playerFloor !== null
          ? clampFloor(data.playerFloor)
          : state.playerFloor;
    const wp = data.waypoint !== undefined ? data.waypoint : state.waypoint;
    const wpSig = wp
      ? `${Math.round((Number(wp.x) || 0) * 10)},${Math.round((Number(wp.z) || 0) * 10)},${clampFloor(wp.floor ?? 0)}`
      : 'none';
    const sig = `${px}:${pz}:${pyaw}:${zid}:${pCnt}:${fl}:${wpSig}`;
    state.playerFloor = fl;
    if (data.waypoint !== undefined) {
      state.waypoint = data.waypoint;
    }
    if (data.playerPos) {
      state.playerPos = {
        x: Number(data.playerPos.x) || 0,
        z: Number(data.playerPos.z) || 0
      };
    }
    if (typeof data.playerYaw === 'number' && Number.isFinite(data.playerYaw)) {
      state.playerYaw = data.playerYaw;
    }
    if (data.currentZone) {
      state.currentZone = data.currentZone;
      if (data.currentZone.badgeText) {
        state.zoneLabel = data.currentZone.badgeText;
      }
      if (data.currentZone.color) {
        state.zoneColor = data.currentZone.color;
      }
    }
    if (Array.isArray(data.peers)) {
      state.peers = data.peers;
    }
    if (sig === lastMiniMapSig && pCnt <= 0) return;
    lastMiniMapSig = sig;
    dirty = true;
    if (forceVisible) {
      const now = Date.now();
      if (now - lastDrawMs >= 165) {
        lastDrawMs = now;
        redraw();
      }
    }
  };

  const stateJsonCache = new Map();
  const updateState = (next = {}) => {
    let changed = false;
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined) continue;
      if (v && typeof v === 'object') {
        const ser = JSON.stringify(v);
        if (stateJsonCache.get(k) !== ser) {
          stateJsonCache.set(k, ser);
          state[k] = v;
          changed = true;
        }
      } else if (state[k] !== v) {
        state[k] = v;
        stateJsonCache.delete(k);
        changed = true;
      }
    }
    if (changed) {
      dirty = true;
      if (group.visible || forceVisible) {
        const now = Date.now();
        if (now - lastDrawMs >= 165) {
          lastDrawMs = now;
          redraw();
        }
      }
    }
  };

  const setForceVisible = (v) => {
    forceVisible = Boolean(v);
    if (hudSuppressed) {
      group.visible = false;
      screenMat.opacity = 0;
      return;
    }
    if (forceVisible) {
      group.visible = true;
      screenMat.opacity = 0.98;
      if (dirty) redraw();
    }
  };

  const setHudSuppressed = (suppressed) => {
    hudSuppressed = Boolean(suppressed);
    if (hudSuppressed) {
      group.visible = false;
      screenMat.opacity = 0;
    } else if (forceVisible) {
      group.visible = true;
      screenMat.opacity = 0.98;
      if (dirty) redraw();
    }
  };

  const getState = () => ({
    ...state,
    peersCount: Array.isArray(state.peers) ? state.peers.length : 0,
    mapBounds: currentMapData?.bounds || null
  });

  const dispose = () => {
    texture?.dispose?.();
    bezel.geometry.dispose();
    bezel.material.dispose();
    statusRim.geometry.dispose();
    statusRim.material.dispose();
    strapTop.geometry.dispose();
    strapBottom.geometry.dispose();
    strapMat.dispose();
    crown.geometry.dispose();
    crown.material.dispose();
    screenMesh.geometry.dispose();
    screenMesh.material.dispose();
  };

  return {
    group,
    screenMesh,
    statusRim,
    screenWidth: 0.136,
    screenHeight: 0.128,
    hitTestUv,
    setHovered,
    setMapData,
    updateMiniMap,
    updateVisibility,
    setForceVisible,
    setHudSuppressed,
    isHudSuppressed: () => hudSuppressed,
    updateState,
    getState,
    hasMiniMapData: () => Boolean(currentMapData && Array.isArray(currentMapData.zones)),
    getMiniMapBounds: () => currentMapData?.bounds || null,
    getHitBoxes: () => [...hitBoxes],
    dispose
  };
}

const PANEL_SCRATCH_FWD = new THREE.Vector3();
const PANEL_SCRATCH_POS = new THREE.Vector3();

function clampNumber(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function snapSliderValue(raw, min, max, step) {
  const s = Number(step) > 0 ? Number(step) : 1;
  const snapped = min + Math.round((raw - min) / s) * s;
  const clamped = clampNumber(snapped, min, max);
  const decimals = String(s).includes('.') ? String(s).split('.')[1].length : 0;
  return Number(clamped.toFixed(decimals));
}

export function createTpSpatialPanel() {
  const canvasW = 1280;
  const canvasH = 800;
  const screenWidth = 1.38;
  const screenHeight = 0.86;
  let canvas = null;
  let ctx = null;
  let texture = null;

  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    ctx = canvas.getContext('2d');
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
  }

  const group = new THREE.Group();
  group.position.set(0, 0.78, -0.62);
  group.rotation.x = 0.16;

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(1.42, 0.90, 0.018),
    new THREE.MeshStandardMaterial({
      color: '#0f172a',
      metalness: 0.7,
      roughness: 0.28,
      emissive: '#082f49',
      emissiveIntensity: 0.32
    })
  );
  frame.position.z = -0.01;
  group.add(frame);

  const screenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(screenWidth, screenHeight),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.98 })
  );
  group.add(screenMesh);

  let hitBoxes = [];
  let hoveredId = null;
  let redrawTimer = null;
  let lastDrawMs = 0;

  const state = {
    mode: 'workbench',
    activeTab: 'controls',
    drawerPage: 0,
    keyboardShift: false,
    tpId: '',
    tpTitle: 'TP Atelier 3D',
    badge: 'ÉTABLI VR',
    briefTitle: '',
    briefSub: '',
    accuracy: '-- / 20',
    timer: '00:00',
    hoverLabel: '',
    toastText: '',
    stages: [],
    activeStageIdx: 0,
    tools: [],
    activeToolId: null,
    actions: [],
    cameras: [],
    activeCamIdx: 0,
    drawerControls: [],
    vrSliders: [],
    vrButtons: [],
    cliPresets: [],
    terminalLines: [],
    statusLines: [],
    textInput: null,
    result: null,
    dialogue: null,
    ascension: null,
    survivalLobby: null,
    survivalIntro: null,
    survivalHidden: null,
    jumpscare: null,
    detention: null,
    survivalEnd: null,
    combatLobby: null,
    combatEnd: null,
    shop: null,
    locker: null,
    tablet: null,
    onSelectStage: null,
    onSelectTool: null,
    onSelectCamera: null,
    onAdjustZoom: null,
    onAdjustOrbit: null,
    onExitTp: null
  };

  const tabletUi = {
    app: 'home',
    history: [],
    lastSyncedApp: null,
    poleFilter: 'all',
    activeTpId: null,
    lastSyncedTpId: null,
    activeQuestionIdx: 0,
    kbdVisible: false,
    kbdInput: '',
    kbdShift: false,
    localProgress: {},
    localRewarded: [],
    localOrdering: new Map(),
    selectedFloor: 0,
    followFloor: true,
    viewCenterX: 0,
    viewCenterZ: 0,
    pxPerMeter: null,
    mapAutoFitted: false,
    lastMapSig: '',
    waypoint: null,
    lastSyncedWaypointKey: undefined,
    toolTab: 'subnet',
    subnetIp: '192.168.10.45',
    subnetCidr: 26,
    band1: 'brown',
    band2: 'black',
    bandMult: 'red',
    bandTol: 'gold',
    memoCat: 'all',
    memoPage: 0
  };

  const resolveActiveMode = () => {
    if (state.jumpscare) return 'jumpscare';
    if (state.detention) return 'detention';
    if (state.combatEnd) return 'combat_end';
    if (state.combatLobby) return 'combat_lobby';
    if (state.survivalEnd) return 'survival_end';
    if (state.survivalHidden) return 'survival_hidden';
    if (state.survivalIntro) return 'survival_intro';
    if (state.survivalLobby) return 'survival_lobby';
    if (state.shop) return 'shop';
    if (state.locker) return 'locker';
    if (state.tablet) return 'tablet';
    if (state.ascension) return 'ascension';
    if (state.dialogue) return 'dialogue';
    if (state.result) return 'result';
    return state.mode || 'workbench';
  };

  const handleExitAction = (uv) => {
    if (typeof state.combatLobby?.onLeave === 'function') {
      state.combatLobby.onLeave(uv);
      return;
    }
    if (typeof state.combatEnd?.onExit === 'function') {
      state.combatEnd.onExit(uv);
      return;
    }
    if (typeof state.shop?.onClose === 'function') {
      state.shop.onClose(uv);
      return;
    }
    if (typeof state.locker?.onClose === 'function') {
      state.locker.onClose(uv);
      return;
    }
    if (typeof state.tablet?.onClose === 'function') {
      state.tablet.onClose(uv);
      return;
    }
    if (typeof state.survivalIntro?.onSkip === 'function') {
      state.survivalIntro.onSkip(uv);
      return;
    }
    if (typeof state.survivalLobby?.onLeave === 'function') {
      state.survivalLobby.onLeave(uv);
      return;
    }
    if (typeof state.survivalHidden?.onExitRack === 'function') {
      state.survivalHidden.onExitRack(uv);
      return;
    }
    if (typeof state.detention?.onClose === 'function') {
      state.detention.onClose(uv);
      return;
    }
    if (typeof state.survivalEnd?.onContinue === 'function') {
      state.survivalEnd.onContinue(uv);
      return;
    }
    if (typeof state.onExitTp === 'function') {
      state.onExitTp(uv);
      return;
    }
    if (typeof state.dialogue?.onClose === 'function') {
      state.dialogue.onClose(uv);
      return;
    }
    if (typeof state.ascension?.onClose === 'function') {
      state.ascension.onClose(uv);
      return;
    }
    if (typeof state.result?.onExit === 'function') {
      state.result.onExit(uv);
    }
  };

  const appendTextInput = (str) => {
    if (!state.textInput) return;
    const prev = String(state.textInput.value || '');
    const next = prev + str;
    state.textInput.value = next;
    state.textInput.onInput?.(next);
    redraw();
  };

  const setTextInputValue = (next) => {
    if (!state.textInput) return;
    const str = String(next || '');
    state.textInput.value = str;
    state.textInput.onInput?.(str);
    redraw();
  };

  const submitTextInput = (overrideVal = null) => {
    if (!state.textInput) return;
    const val = overrideVal !== null ? String(overrideVal) : String(state.textInput.value || '');
    state.textInput.value = val;
    state.textInput.onSubmit?.(val);
    redraw();
  };

  const redraw = () => {
    if (redrawTimer) {
      clearTimeout(redrawTimer);
      redrawTimer = null;
    }
    lastDrawMs = Date.now();
    hitBoxes = [];
    const activeModeEarly = resolveActiveMode();
    frame.visible = activeModeEarly !== 'survival_hidden';

    if (ctx) {
      ctx.clearRect(0, 0, canvasW, canvasH);
      if (activeModeEarly !== 'survival_hidden') {
        roundRectPath(ctx, 6, 6, canvasW - 12, canvasH - 12, 24);
        const bg = ctx.createLinearGradient(0, 0, 0, canvasH);
        bg.addColorStop(0, '#071326');
        bg.addColorStop(1, '#0b1b34');
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle =
          activeModeEarly === 'ascension'
            ? '#fbbf24'
            : activeModeEarly === 'tablet'
              ? '#22d3ee'
              : '#38bdf8';
        ctx.stroke();
      }
    }

    const addBtn = (
      id,
      x,
      y,
      w,
      h,
      label,
      {
        active = false,
        primary = false,
        danger = false,
        gold = false,
        disabled = false,
        maxChars = 28,
        fontSize = 18,
        onClick = null
      } = {}
    ) => {
      const isHover = !disabled && hoveredId === id;
      if (ctx) {
        roundRectPath(ctx, x, y, w, h, 12);
        ctx.fillStyle = disabled
          ? 'rgba(30, 41, 59, 0.55)'
          : isHover
            ? danger
              ? '#f43f5e'
              : gold
                ? '#f59e0b'
                : primary
                  ? '#34d399'
                  : '#38bdf8'
            : danger
              ? '#7f1d1d'
              : gold
                ? '#78350f'
                : primary
                  ? '#059669'
                  : active
                    ? '#0284c7'
                    : '#172554';
        ctx.fill();
        ctx.lineWidth = isHover || active ? 3 : 1.5;
        ctx.strokeStyle = disabled
          ? '#334155'
          : danger
            ? '#fb7185'
            : gold
              ? '#fbbf24'
              : primary
                ? '#34d399'
                : '#38bdf8';
        ctx.stroke();

        ctx.fillStyle = disabled ? '#64748b' : isHover ? '#04101f' : '#f8fafc';
        ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(label || '').slice(0, maxChars), x + w / 2, y + h / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }

      if (!disabled && onClick) {
        hitBoxes.push({ id, kind: 'button', x, y, w, h, label, onClick });
      }
    };

    const addSlider = (id, x, y, w, h, ctrl) => {
      const min = Number.isFinite(Number(ctrl.min)) ? Number(ctrl.min) : 0;
      const max = Number.isFinite(Number(ctrl.max)) ? Number(ctrl.max) : 100;
      const step = Number.isFinite(Number(ctrl.step)) && Number(ctrl.step) > 0 ? Number(ctrl.step) : 1;
      const currentVal = clampNumber(Number.isFinite(Number(ctrl.value)) ? Number(ctrl.value) : min, min, max);
      const ratio = (currentVal - min) / ((max - min) || 1);
      const labelW = 240;
      const btnW = 46;
      const readoutW = 104;
      const gap = 8;
      const decX = x + labelW + gap;
      const trackX = decX + btnW + gap;
      const trackW = Math.max(120, w - labelW - btnW * 2 - readoutW - gap * 4);
      const incX = trackX + trackW + gap;
      const readX = incX + btnW + gap;
      const trackId = `${id}_track`;
      const isTrackHover = hoveredId === trackId;

      const applyVal = (nextVal) => {
        const snapped = snapSliderValue(nextVal, min, max, step);
        ctrl.value = snapped;
        ctrl.onSetValue?.(snapped);
      };

      const applyUv = (uv) => {
        if (!uv) return;
        const px = uv.x * canvasW;
        const localRatio = clampNumber((px - trackX) / trackW, 0, 1);
        applyVal(min + localRatio * (max - min));
      };

      if (ctx) {
        roundRectPath(ctx, x, y, w, h, 10);
        ctx.fillStyle = 'rgba(15, 32, 58, 0.9)';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = isTrackHover ? '#38bdf8' : 'rgba(56, 189, 248, 0.35)';
        ctx.stroke();

        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 17px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(ctrl.label || ctrl.id || 'Paramètre').slice(0, 22), x + 12, y + h / 2);

        roundRectPath(ctx, trackX, y + h / 2 - 8, trackW, 16, 8);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = isTrackHover ? '#7dd3fc' : '#334155';
        ctx.stroke();

        const fillW = Math.max(10, Math.round(trackW * ratio));
        roundRectPath(ctx, trackX, y + h / 2 - 8, fillW, 16, 8);
        ctx.fillStyle = isTrackHover ? '#34d399' : '#0284c7';
        ctx.fill();

        const knobX = trackX + trackW * ratio;
        ctx.beginPath();
        ctx.arc(knobX, y + h / 2, isTrackHover ? 13 : 11, 0, Math.PI * 2);
        ctx.fillStyle = isTrackHover ? '#fef08a' : '#38bdf8';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#0f172a';
        ctx.stroke();

        const valText =
          typeof ctrl.formatVal === 'function'
            ? String(ctrl.formatVal(currentVal))
            : `${currentVal}`;
        ctx.fillStyle = '#6ee7b7';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(valText.slice(0, 10), readX + readoutW - 10, y + h / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }

      addBtn(`${id}_dec`, decX, y + 3, btnW, h - 6, '−', {
        fontSize: 22,
        onClick: () => applyVal(currentVal - step)
      });

      hitBoxes.push({
        id: trackId,
        kind: 'slider',
        x: trackX,
        y,
        w: trackW,
        h,
        label: ctrl.label || id,
        onClick: applyUv,
        onDragUv: applyUv
      });

      addBtn(`${id}_inc`, incX, y + 3, btnW, h - 6, '+', {
        fontSize: 22,
        onClick: () => applyVal(currentVal + step)
      });
    };

    const mode = resolveActiveMode();

    if (ctx && mode !== 'survival_hidden') {
      const headerColor =
        mode === 'jumpscare'
          ? '#ef4444'
          : mode === 'detention'
            ? '#fb923c'
            : mode === 'combat_lobby' || mode === 'combat_end'
              ? '#22d3ee'
              : mode === 'survival_intro'
                ? '#f43f5e'
                : mode === 'survival_lobby'
                  ? '#f43f5e'
                  : mode === 'survival_end'
                    ? state.survivalEnd?.victory
                      ? '#34d399'
                      : '#f87171'
                    : mode === 'ascension'
                      ? '#fbbf24'
                      : mode === 'shop'
                        ? '#fbbf24'
                        : mode === 'tablet'
                          ? '#22d3ee'
                          : '#38bdf8';
      ctx.fillStyle = headerColor;
      ctx.font = mode === 'tablet' ? 'bold 23px system-ui, sans-serif' : 'bold 26px system-ui, sans-serif';
      const headerTitle =
        mode === 'shop'
          ? state.shop?.title || '🛒 BOUTIQUE CIEL — SKINS, PETS 3D & AURAs'
          : mode === 'locker'
            ? state.locker?.title || '🎨 CASIER CIEL — SKINS, PETS 3D & ACCESSOIRES'
            : mode === 'tablet'
              ? state.tablet?.title || '📱 TABLETTE INTERACTIVE CIEL'
              : mode === 'combat_lobby'
                ? '⚔️ ARÈNE DE COMBAT CIEL — SALON'
                : mode === 'combat_end'
                  ? state.combatEnd?.won
                    ? '🏆 VICTOIRE — ARÈNE DE COMBAT CIEL'
                    : '⚔️ FIN DE MANCHE — ARÈNE CIEL'
                  : mode === 'dialogue'
                    ? state.dialogue?.title || '👨‍🏫 ENTRETIEN PROFESSEUR CIEL'
                    : mode === 'ascension'
                      ? state.ascension?.title || '👑 CÉRÉMONIE D’ASCENSION BAC PRO CIEL'
                      : mode === 'survival_intro'
                        ? '☠️ ALERTE SURVIE HORREUR — INSTANCE ISOLÉE'
                        : mode === 'survival_lobby'
                          ? '☠️ SALON D’ATTENTE — MODE SURVIE HORREUR'
                          : mode === 'jumpscare'
                            ? '☠️ ALERTE CAPTURE — PROFESSEUR CIEL'
                            : mode === 'detention'
                              ? '📝 HEURE DE COLLE 3D — FEUILLE & CAMÉRA POV'
                              : mode === 'survival_end'
                                ? state.survivalEnd?.victory
                                  ? '🏆 VICTOIRE COOPÉRATIVE — SURVIE CIEL'
                                  : '💀 DÉFAITE — CLASSE EN HEURE DE COLLE'
                                : String(state.tpTitle || 'TP Atelier 3D');
      ctx.fillText(headerTitle.slice(0, 48), 24, 46, mode === 'tablet' ? 486 : undefined);
    }

    if (mode === 'workbench' || mode === 'result') {
      if (ctx) {
        roundRectPath(ctx, 686, 16, 132, 44, 10);
        ctx.fillStyle = '#0f2942';
        ctx.fill();
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 21px monospace';
        ctx.fillText(`⏱ ${state.timer}`, 702, 45);

        roundRectPath(ctx, 828, 16, 168, 44, 10);
        ctx.fillStyle = '#064e3b';
        ctx.fill();
        ctx.fillStyle = '#6ee7b7';
        ctx.font = 'bold 21px system-ui, sans-serif';
        ctx.fillText(String(state.accuracy || '-- / 20').slice(0, 14), 844, 45);
      }
    }

    if (mode !== 'jumpscare' && mode !== 'survival_intro' && mode !== 'survival_hidden') {
      const exitLabel =
        mode === 'survival_lobby' || mode === 'combat_lobby'
          ? '🚪 Quitter Salon'
          : mode === 'detention'
            ? '📺 Salle 3D'
            : mode === 'survival_end' || mode === 'combat_end'
              ? '🏫 Hall Principal'
              : mode === 'dialogue' || mode === 'ascension' || mode === 'shop' || mode === 'locker' || mode === 'tablet'
                ? '✕ Fermer'
                : '✕ Quitter le TP';
      const exitId =
        mode === 'shop'
          ? 'vr_shop_close'
          : mode === 'locker'
            ? 'vr_locker_close'
            : mode === 'tablet'
              ? 'vr_tablet_close'
              : 'vr_tp_exit';
      const exitX = mode === 'tablet' ? 1086 : 1006;
      const exitW = mode === 'tablet' ? 170 : 250;
      addBtn(exitId, exitX, 16, exitW, 44, exitLabel, {
        danger: true,
        maxChars: 20,
        fontSize: 19,
        onClick: handleExitAction
      });
    }

    if (mode === 'shop' && state.shop) {
      const sh = state.shop;
      const cats = Array.isArray(sh.categories) ? sh.categories : [
        { id: 'skins', shortLabel: 'Skins', icon: '👕' },
        { id: 'pets', shortLabel: 'Pets 3D', icon: '🐾' },
        { id: 'accessories', shortLabel: 'Accessoires', icon: '✨' }
      ];
      const items = Array.isArray(sh.items) ? sh.items : [];
      const sel = sh.selectedItem || items[0] || null;
      const coinsVal = Math.max(0, Math.floor(Number(sh.coins) || 0));

      if (ctx) {
        roundRectPath(ctx, 730, 16, 256, 44, 10);
        ctx.fillStyle = 'rgba(120, 53, 15, 0.88)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fbbf24';
        ctx.stroke();
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 21px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`🪙 ${coinsVal} CC`, 858, 45);
        ctx.textAlign = 'left';
      }

      const catW = Math.floor((736 - (cats.length - 1) * 10) / Math.max(1, cats.length));
      cats.forEach((cat, idx) => {
        const cx = 28 + idx * (catW + 10);
        addBtn(`vr_shop_cat_${cat.id}`, cx, 78, catW, 48, `${cat.icon || ''} ${cat.shortLabel || cat.label}`, {
          active: sh.activeCategory === cat.id,
          fontSize: 18,
          maxChars: 20,
          onClick: () => sh.onSelectCategory?.(cat.id)
        });
      });

      const gridX = 28;
      const gridY = 140;
      const colW = 362;
      const rowH = 142;
      const gap = 12;
      items.slice(0, 8).forEach((item, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const ix = gridX + col * (colW + gap);
        const iy = gridY + row * (rowH + gap);
        const isSel = sel?.id === item.id;
        const rarColor = item.rarityMeta?.color || '#38bdf8';

        if (ctx) {
          roundRectPath(ctx, ix, iy, colW, rowH, 14);
          ctx.fillStyle = isSel ? 'rgba(12, 42, 74, 0.96)' : 'rgba(15, 29, 52, 0.9)';
          ctx.fill();
          ctx.lineWidth = isSel ? 3 : 1.5;
          ctx.strokeStyle = item.equipped ? '#34d399' : isSel ? '#38bdf8' : rarColor;
          ctx.stroke();

          ctx.fillStyle = rarColor;
          ctx.font = 'bold 14px system-ui, sans-serif';
          ctx.fillText(String(item.rarityMeta?.label || item.rarity || '').toUpperCase(), ix + 16, iy + 28);

          const statusTxt = item.equipped
            ? 'ÉQUIPÉ'
            : item.owned
              ? 'POSSÉDÉ'
              : `${item.price} 🪙`;
          ctx.fillStyle = item.equipped ? '#6ee7b7' : item.owned ? '#7dd3fc' : item.canAfford ? '#fbbf24' : '#f87171';
          ctx.font = 'bold 16px system-ui, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(statusTxt, ix + colW - 16, iy + 28);
          ctx.textAlign = 'left';

          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 21px system-ui, sans-serif';
          ctx.fillText(`${item.icon || ''} ${item.name}`.slice(0, 26), ix + 16, iy + 78);

          ctx.fillStyle = '#94a3b8';
          ctx.font = '14px system-ui, sans-serif';
          ctx.fillText(String(item.description || '').slice(0, 40), ix + 16, iy + 114);
        }

        hitBoxes.push({
          id: `vr_shop_item_${item.id}`,
          kind: 'button',
          x: ix,
          y: iy,
          w: colW,
          h: rowH,
          label: item.name,
          onClick: () => sh.onSelectItem?.(item.id)
        });
      });

      const inspX = 788;
      const inspY = 78;
      const inspW = 468;
      const inspH = 684;
      if (ctx) {
        roundRectPath(ctx, inspX, inspY, inspW, inspH, 16);
        ctx.fillStyle = 'rgba(10, 22, 44, 0.94)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = sel?.rarityMeta?.color || 'rgba(56, 189, 248, 0.45)';
        ctx.stroke();

        if (sel) {
          ctx.fillStyle = sel.rarityMeta?.color || '#38bdf8';
          ctx.font = 'bold 18px system-ui, sans-serif';
          ctx.fillText(String(sel.rarityMeta?.label || '').toUpperCase(), inspX + 24, inspY + 42);

          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 26px system-ui, sans-serif';
          ctx.fillText(`${sel.icon || ''} ${sel.name}`.slice(0, 26), inspX + 24, inspY + 86);

          const descLines = wrapTextLines(ctx, sel.description || '', inspW - 48, 5);
          ctx.fillStyle = '#cbd5e1';
          ctx.font = '18px system-ui, sans-serif';
          descLines.forEach((ln, idx) => {
            ctx.fillText(ln, inspX + 24, inspY + 132 + idx * 28);
          });

          ctx.fillStyle = sel.equipped ? '#34d399' : sel.owned ? '#7dd3fc' : '#fbbf24';
          ctx.font = 'bold 22px system-ui, sans-serif';
          ctx.fillText(
            sel.equipped
              ? '✅ Actuellement équipé'
              : sel.owned
                ? '📦 Dans votre inventaire'
                : `🪙 Prix : ${sel.price} CIEL Coins`,
            inspX + 24,
            inspY + 324
          );

          if (sh.feedback?.message) {
            roundRectPath(ctx, inspX + 24, inspY + 356, inspW - 48, 54, 10);
            ctx.fillStyle = sh.feedback.kind === 'error' ? 'rgba(127, 29, 29, 0.85)' : 'rgba(6, 78, 59, 0.85)';
            ctx.fill();
            ctx.fillStyle = '#f8fafc';
            ctx.font = 'bold 17px system-ui, sans-serif';
            ctx.fillText(String(sh.feedback.message).slice(0, 42), inspX + 38, inspY + 389);
          }

          ctx.fillStyle = '#94a3b8';
          ctx.font = '15px system-ui, sans-serif';
          ctx.fillText('👀 Aperçu 3D rotatif à droite du panneau', inspX + 24, inspY + 454);
        }
      }

      if (sel) {
        if (!sel.owned) {
          addBtn(
            'vr_shop_buy',
            inspX + 24,
            inspY + 500,
            inspW - 48,
            78,
            sel.canAfford ? `🛒 Acheter — ${sel.price} 🪙` : `🔒 Solde insuffisant (${sel.price} 🪙)`,
            {
              gold: sel.canAfford,
              danger: !sel.canAfford,
              fontSize: 22,
              maxChars: 32,
              onClick: () => sh.onBuy?.(sel)
            }
          );
        } else if (!sel.equipped) {
          addBtn('vr_shop_equip', inspX + 24, inspY + 500, inspW - 48, 78, '✨ Équiper', {
            primary: true,
            fontSize: 24,
            onClick: () => sh.onEquip?.(sel, true)
          });
        } else {
          addBtn('vr_shop_unequip', inspX + 24, inspY + 500, inspW - 48, 78, '↩️ Retirer', {
            danger: true,
            fontSize: 24,
            onClick: () => sh.onEquip?.(sel, false)
          });
        }
      }

      if (texture) texture.needsUpdate = true;
      return;
    }

    if (mode === 'locker' && state.locker) {
      const lk = state.locker;
      const cats = Array.isArray(lk.categories) ? lk.categories : [];
      const flts = Array.isArray(lk.filters) ? lk.filters : [];
      const items = Array.isArray(lk.items) ? lk.items : [];
      const sel = lk.selectedItem || items[0] || null;
      const coinsVal = Math.max(0, Math.floor(Number(lk.coins) || 0));

      if (ctx) {
        roundRectPath(ctx, 730, 14, 182, 42, 20);
        ctx.fillStyle = 'rgba(12, 74, 110, 0.9)';
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#e0f2fe';
        ctx.font = 'bold 17px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`📦 ${lk.totalUnlocked || 0}/${lk.totalItems || 18}`, 821, 41);

        roundRectPath(ctx, 922, 14, 150, 42, 20);
        ctx.fillStyle = 'rgba(120, 53, 15, 0.92)';
        ctx.fill();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 19px system-ui, sans-serif';
        ctx.fillText(`🪙 ${coinsVal} CC`, 997, 42);
        ctx.textAlign = 'left';
      }

      cats.forEach((cat, idx) => {
        const active = cat.id === lk.activeCategory;
        addBtn(
          `vr_locker_cat_${cat.id}`,
          26 + idx * 186,
          78,
          178,
          48,
          `${cat.icon || ''} ${cat.label}`,
          {
            primary: active,
            fontSize: 16,
            maxChars: 18,
            onClick: () => lk.onSelectCategory?.(cat.id)
          }
        );
      });

      flts.forEach((flt, idx) => {
        const active = flt.id === lk.activeFilter;
        addBtn(
          `vr_locker_flt_${flt.id}`,
          26 + idx * 150,
          134,
          142,
          38,
          flt.label,
          {
            primary: active,
            fontSize: 15,
            maxChars: 16,
            onClick: () => lk.onSelectFilter?.(flt.id)
          }
        );
      });

      const listX = 26;
      const listY = 182;
      const colW = 362;
      const rowH = 122;
      const gapX = 14;
      const gapY = 12;
      items.slice(0, 8).forEach((item, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const ix = listX + col * (colW + gapX);
        const iy = listY + row * (rowH + gapY);
        const isSel = sel && sel.id === item.id;
        const isHov = hoveredId === `vr_locker_item_${item.id}`;
        const rColor = item.rarityMeta?.color || '#38bdf8';

        if (ctx) {
          roundRectPath(ctx, ix, iy, colW, rowH, 14);
          ctx.fillStyle = isSel
            ? 'rgba(14, 46, 84, 0.96)'
            : isHov
              ? 'rgba(24, 48, 82, 0.92)'
              : 'rgba(15, 23, 42, 0.9)';
          ctx.fill();
          ctx.lineWidth = isSel ? 3 : 1.8;
          ctx.strokeStyle = isSel ? '#38bdf8' : item.equipped ? '#34d399' : rColor;
          ctx.stroke();

          ctx.fillStyle = rColor;
          ctx.font = 'bold 14px system-ui, sans-serif';
          ctx.fillText(String(item.rarityMeta?.label || '').toUpperCase(), ix + 14, iy + 26);

          ctx.textAlign = 'right';
          ctx.fillStyle = item.equipped ? '#34d399' : item.owned ? '#7dd3fc' : '#f87171';
          ctx.font = 'bold 15px system-ui, sans-serif';
          ctx.fillText(
            item.equipped ? '✅ ÉQUIPÉ' : item.owned ? 'POSSÉDÉ' : item.price ? `🔒 ${item.price} CC` : '🔒 VERROUILLÉ',
            ix + colW - 14,
            iy + 26
          );
          ctx.textAlign = 'left';

          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 20px system-ui, sans-serif';
          ctx.fillText(`${item.icon || ''} ${item.name}`.slice(0, 26), ix + 14, iy + 70);

          ctx.fillStyle = '#94a3b8';
          ctx.font = '13px system-ui, sans-serif';
          ctx.fillText(String(item.description || '').slice(0, 40), ix + 14, iy + 102);
        }

        hitBoxes.push({
          id: `vr_locker_item_${item.id}`,
          kind: 'button',
          x: ix,
          y: iy,
          w: colW,
          h: rowH,
          label: item.name,
          onClick: () => lk.onSelectItem?.(item.id)
        });
      });

      const inspX = 788;
      const inspY = 78;
      const inspW = 468;
      const inspH = 684;
      if (ctx) {
        roundRectPath(ctx, inspX, inspY, inspW, inspH, 16);
        ctx.fillStyle = 'rgba(10, 22, 44, 0.94)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = sel?.rarityMeta?.color || 'rgba(56, 189, 248, 0.45)';
        ctx.stroke();

        if (sel) {
          ctx.fillStyle = sel.rarityMeta?.color || '#38bdf8';
          ctx.font = 'bold 18px system-ui, sans-serif';
          ctx.fillText(String(sel.rarityMeta?.label || '').toUpperCase(), inspX + 24, inspY + 42);

          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 26px system-ui, sans-serif';
          ctx.fillText(`${sel.icon || ''} ${sel.name}`.slice(0, 26), inspX + 24, inspY + 86);

          const descLines = wrapTextLines(ctx, sel.description || '', inspW - 48, 5);
          ctx.fillStyle = '#cbd5e1';
          ctx.font = '18px system-ui, sans-serif';
          descLines.forEach((ln, idx) => {
            ctx.fillText(ln, inspX + 24, inspY + 132 + idx * 28);
          });

          ctx.fillStyle = sel.equipped ? '#34d399' : sel.owned ? '#7dd3fc' : '#fbbf24';
          ctx.font = 'bold 22px system-ui, sans-serif';
          ctx.fillText(
            sel.equipped
              ? '✅ Actuellement équipé'
              : sel.owned
                ? '📦 Débloqué dans votre Casier'
                : sel.price
                  ? `🔒 Boutique — ${sel.price} 🪙 CC`
                  : '🔒 À débloquer en jeu',
            inspX + 24,
            inspY + 324
          );

          if (lk.feedback?.message) {
            roundRectPath(ctx, inspX + 24, inspY + 356, inspW - 48, 54, 10);
            ctx.fillStyle = lk.feedback.kind === 'error' ? 'rgba(127, 29, 29, 0.85)' : 'rgba(6, 78, 59, 0.85)';
            ctx.fill();
            ctx.fillStyle = '#f8fafc';
            ctx.font = 'bold 17px system-ui, sans-serif';
            ctx.fillText(String(lk.feedback.message).slice(0, 42), inspX + 38, inspY + 389);
          }

          ctx.fillStyle = '#94a3b8';
          ctx.font = '15px system-ui, sans-serif';
          ctx.fillText('👀 Aperçu 3D rotatif à droite du panneau', inspX + 24, inspY + 454);
        }
      }

      if (sel && sel.source !== 'badge') {
        if (!sel.owned && sel.source === 'shop') {
          addBtn('vr_locker_shop', inspX + 24, inspY + 500, inspW - 48, 78, '🛒 Voir dans la Boutique', {
            gold: true,
            fontSize: 22,
            maxChars: 30,
            onClick: () => lk.onOpenShopItem?.(sel.shopCategory || sel.category, sel.id)
          });
        } else if (sel.owned && !sel.equipped) {
          addBtn('vr_locker_equip', inspX + 24, inspY + 500, inspW - 48, 78, '✨ Équiper', {
            primary: true,
            fontSize: 24,
            onClick: () => lk.onEquip?.(sel, true)
          });
        } else if (sel.owned && sel.equipped && sel.source !== 'standard') {
          addBtn('vr_locker_unequip', inspX + 24, inspY + 500, inspW - 48, 78, '↩️ Retirer', {
            danger: true,
            fontSize: 24,
            onClick: () => lk.onEquip?.(sel, false)
          });
        }
      }

      if (texture) texture.needsUpdate = true;
      return;
    }

    if (mode === 'tablet' && state.tablet) {
      const tb = state.tablet;
      const conn = resolveConnectionDisplay(tb.connectionState, tb.onlineCount, tb.pingMs);
      const coinsVal = Math.max(0, Math.floor(Number(tb.coins) || 0));
      const batteryPct = Math.max(1, Math.min(100, Math.round(Number(tb.batteryPct ?? 96))));
      const playerName = String(tb.playerName || 'Eleve_CIEL');

      if (ctx) {
        roundRectPath(ctx, 520, 16, 94, 42, 10);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 17px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(formatClockText(), 567, 43);

        roundRectPath(ctx, 622, 16, 200, 42, 20);
        ctx.fillStyle = conn.bgColor;
        ctx.fill();
        ctx.strokeStyle = conn.borderColor;
        ctx.stroke();
        ctx.fillStyle = conn.dotColor;
        ctx.beginPath();
        ctx.arc(640, 37, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = conn.textColor;
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(conn.label.slice(0, 20), 652, 42);

        roundRectPath(ctx, 830, 16, 152, 42, 20);
        ctx.fillStyle = 'rgba(120, 53, 15, 0.88)';
        ctx.fill();
        ctx.strokeStyle = '#fbbf24';
        ctx.stroke();
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`🪙 ${coinsVal} CC`, 906, 43);

        roundRectPath(ctx, 990, 16, 86, 42, 10);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.stroke();
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.fillText(`${batteryPct}% 🔋`, 1033, 42);
        ctx.textAlign = 'left';
      }

      const mergedFormativeProgress = {
        ...tabletUi.localProgress,
        ...(tb.formativeProgress || tb.gameState?.formativeProgress || {})
      };
      const mergedRewardedTps = [
        ...new Set([
          ...tabletUi.localRewarded,
          ...(Array.isArray(tb.formativeRewardedTps)
            ? tb.formativeRewardedTps
            : Array.isArray(tb.gameState?.formativeRewardedTps)
              ? tb.gameState.formativeRewardedTps
              : [])
        ])
      ];
      const fmtStats = computeFormativeStats(mergedFormativeProgress, mergedRewardedTps);
      const gradesSummary = buildGradesSummary({
        formativeProgress: mergedFormativeProgress,
        formativeRewardedTps: mergedRewardedTps,
        profile: { grades: tb.grades || tb.gameState?.profile?.grades || {} }
      });

      const navigateTabletApp = (nextApp, pushHistory = true) => {
        if (pushHistory && tabletUi.app && tabletUi.app !== nextApp) {
          tabletUi.history.push(tabletUi.app);
        }
        tabletUi.app = nextApp;
        tabletUi.kbdVisible = false;
        tabletUi.lastSyncedApp = nextApp;
        if (state.tablet) state.tablet.app = nextApp;
        tb.onSelectApp?.(nextApp);
        redraw();
      };

      const activeApp = ['home', 'formative', 'map', 'grades', 'tools'].includes(tabletUi.app)
        ? tabletUi.app
        : 'home';
      const activeWp = tabletUi.waypoint !== undefined && tabletUi.waypoint !== null
        ? tabletUi.waypoint
        : tb.waypoint || null;

      if (activeApp === 'home') {
        const avgDisplay =
          gradesSummary.globalAverage !== null
            ? `${gradesSummary.globalAverage.toFixed(1)}/20`
            : fmtStats.averageScore !== null
              ? `${fmtStats.averageScore.toFixed(1)}/20`
              : '--/20';

        if (ctx) {
          roundRectPath(ctx, 28, 76, 1224, 120, 18);
          const heroBg = ctx.createLinearGradient(28, 76, 1252, 196);
          heroBg.addColorStop(0, 'rgba(14, 116, 144, 0.35)');
          heroBg.addColorStop(1, 'rgba(15, 23, 42, 0.92)');
          ctx.fillStyle = heroBg;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = 'rgba(34, 211, 238, 0.45)';
          ctx.stroke();

          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 14px system-ui, sans-serif';
          ctx.fillText('ATELIER CIEL 3D • TABLETTE ÉLÈVE VR', 52, 106);

          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 28px system-ui, sans-serif';
          ctx.fillText(`Bonjour, ${playerName.slice(0, 24)}`, 52, 142);

          ctx.fillStyle = '#cbd5e1';
          ctx.font = '17px system-ui, sans-serif';
          ctx.fillText(
            'Accédez au plan campus multi-étages, vos TP Formative, notes /20 et outils réseau CIEL.',
            52,
            174
          );

          const widgets = [
            { label: 'Formative', value: `${fmtStats.overallPct}%`, x: 734 },
            { label: 'Moyenne', value: avgDisplay, x: 904 },
            { label: 'Repère GPS', value: activeWp ? activeWp.label : 'Aucun', x: 1074 }
          ];
          for (const wg of widgets) {
            roundRectPath(ctx, wg.x, 92, 158, 88, 12);
            ctx.fillStyle = 'rgba(7, 15, 32, 0.88)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 13px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(wg.label, wg.x + 79, 120);
            ctx.fillStyle = '#22d3ee';
            ctx.font = 'bold 21px system-ui, sans-serif';
            ctx.fillText(String(wg.value).slice(0, 12), wg.x + 79, 156, 144);
          }
          ctx.textAlign = 'left';
        }

        const tiles = [
          {
            id: 'vr_tablet_tile_formative',
            app: 'formative',
            icon: '📝',
            title: 'CIEL Formative',
            sub: 'TP interactifs & correction en direct',
            badge: `${fmtStats.validatedCount}/${fmtStats.totalTps} validés`,
            accent: '#38bdf8'
          },
          {
            id: 'vr_tablet_tile_map',
            app: 'map',
            icon: '🗺️',
            title: 'Campus Map',
            sub: 'Plan multi-étages & repères GPS',
            badge: activeWp ? `📍 ${String(activeWp.label).slice(0, 18)}` : 'Multi-étages',
            accent: '#10b981'
          },
          {
            id: 'vr_tablet_tile_grades',
            app: 'grades',
            icon: '📊',
            title: 'Notes & Suivi',
            sub: 'Moyenne /20, pôles & badges CIEL',
            badge: avgDisplay,
            accent: '#fbbf24'
          },
          {
            id: 'vr_tablet_tile_tools',
            app: 'tools',
            icon: '🧰',
            title: 'Outils CIEL',
            sub: 'IPv4/CIDR, Résistances & Mémo Linux/Cisco',
            badge: '3 utilitaires',
            accent: '#a855f7'
          }
        ];

        tiles.forEach((tile, idx) => {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const tx = 28 + col * 622;
          const ty = 214 + row * 242;
          const tw = 602;
          const th = 224;
          const isHov = hoveredId === tile.id;

          if (ctx) {
            roundRectPath(ctx, tx, ty, tw, th, 18);
            ctx.fillStyle = isHov ? 'rgba(22, 42, 74, 0.96)' : 'rgba(13, 24, 46, 0.92)';
            ctx.fill();
            ctx.lineWidth = isHov ? 3.5 : 2;
            ctx.strokeStyle = tile.accent;
            ctx.stroke();

            roundRectPath(ctx, tx + 26, ty + 62, 100, 100, 22);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = tile.accent;
            ctx.stroke();

            ctx.font = '50px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(tile.icon, tx + 76, ty + 114);

            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = '#f8fafc';
            ctx.font = 'bold 28px system-ui, sans-serif';
            ctx.fillText(tile.title, tx + 148, ty + 88);

            ctx.fillStyle = '#94a3b8';
            ctx.font = '18px system-ui, sans-serif';
            ctx.fillText(tile.sub, tx + 148, ty + 124, 428);

            roundRectPath(ctx, tx + 148, ty + 146, 240, 38, 16);
            ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
            ctx.fill();
            ctx.strokeStyle = tile.accent;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = '#e0f2fe';
            ctx.font = 'bold 17px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(tile.badge, tx + 268, ty + 171, 220);
            ctx.textAlign = 'left';
          }

          hitBoxes.push({
            id: tile.id,
            kind: 'button',
            x: tx,
            y: ty,
            w: tw,
            h: th,
            label: tile.title,
            onClick: () => navigateTabletApp(tile.app)
          });
        });
      } else if (activeApp === 'formative') {
        const activeTp = tabletUi.activeTpId ? getFormativeTpById(tabletUi.activeTpId) : null;

        const saveFmtAnswer = (tpId, qId, val) => {
          const prevEntry = mergedFormativeProgress[tpId] || { answers: {} };
          const nextAnswers = { ...(prevEntry.answers || {}) };
          if (
            val === undefined ||
            val === null ||
            val === '' ||
            (Array.isArray(val) && val.length === 0)
          ) {
            delete nextAnswers[qId];
          } else {
            nextAnswers[qId] = val;
          }
          const evalRes = evaluateFormativeTp(tpId, nextAnswers);
          const nextEntry = {
            tpId,
            answers: nextAnswers,
            completionPct: evalRes.completionPct,
            scoreOutOf20: evalRes.scoreOutOf20,
            status: evalRes.status,
            validated: evalRes.validated,
            rewarded: mergedRewardedTps.includes(tpId),
            updatedAt: new Date().toISOString()
          };
          tabletUi.localProgress[tpId] = nextEntry;
          if (state.tablet?.formativeProgress) {
            state.tablet.formativeProgress[tpId] = nextEntry;
          }
          tb.gameState?.setFormativeProgress?.(tpId, nextEntry);
          tb.onSubmitFormativeAnswer?.(tpId, qId, val, nextAnswers);
          redraw();
        };

        if (!activeTp) {
          const poleFilters = [
            { id: 'all', label: 'Tous pôles' },
            ...FORMATIVE_POLES.map((p) => ({ id: p.id, label: `${p.icon} ${p.shortLabel}` }))
          ];
          poleFilters.forEach((pf, idx) => {
            addBtn(`vr_tablet_fmt_pole_${pf.id}`, 28 + idx * 194, 78, 186, 40, pf.label, {
              active: tabletUi.poleFilter === pf.id,
              fontSize: 15,
              maxChars: 20,
              onClick: () => {
                tabletUi.poleFilter = pf.id;
                redraw();
              }
            });
          });

          if (ctx) {
            ctx.fillStyle = '#fde68a';
            ctx.font = 'bold 18px system-ui, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(
              `${fmtStats.validatedCount}/${fmtStats.totalTps} validés • 🪙 ${fmtStats.totalCoinsEarned} CC`,
              1250,
              104
            );
            ctx.textAlign = 'left';
          }

          const filteredTps = fmtStats.items.filter(
            (it) => tabletUi.poleFilter === 'all' || it.tp.pole === tabletUi.poleFilter
          );
          filteredTps.slice(0, 8).forEach((it, idx) => {
            const col = idx % 2;
            const row = Math.floor(idx / 2);
            const cx = 28 + col * 622;
            const cy = 132 + row * 142;
            const cw = 602;
            const ch = 130;
            const pole = getFormativePoleById(it.tp.pole);
            const isHov = hoveredId === `vr_tablet_fmt_open_${it.tp.id}`;
            if (ctx) {
              roundRectPath(ctx, cx, cy, cw, ch, 14);
              ctx.fillStyle = isHov ? 'rgba(20, 42, 74, 0.96)' : 'rgba(13, 24, 44, 0.92)';
              ctx.fill();
              ctx.lineWidth = isHov ? 3 : 1.8;
              ctx.strokeStyle =
                it.status === 'validated'
                  ? '#10b981'
                  : it.status === 'in_progress'
                    ? '#f59e0b'
                    : pole?.color || '#38bdf8';
              ctx.stroke();

              ctx.fillStyle = pole?.color || '#38bdf8';
              ctx.font = 'bold 13px system-ui, sans-serif';
              ctx.fillText(`${pole?.icon || ''} ${pole?.shortLabel || ''}`, cx + 16, cy + 26);

              ctx.textAlign = 'right';
              ctx.fillStyle =
                it.status === 'validated'
                  ? '#6ee7b7'
                  : it.status === 'in_progress'
                    ? '#fde68a'
                    : '#94a3b8';
              ctx.font = 'bold 14px system-ui, sans-serif';
              ctx.fillText(
                it.status === 'validated'
                  ? '✅ VALIDÉ'
                  : it.status === 'in_progress'
                    ? '⏳ EN COURS'
                    : 'À FAIRE',
                cx + cw - 16,
                cy + 26
              );
              ctx.textAlign = 'left';

              ctx.fillStyle = '#f8fafc';
              ctx.font = 'bold 20px system-ui, sans-serif';
              ctx.fillText(`${it.tp.icon} ${it.tp.title}`.slice(0, 44), cx + 16, cy + 62, cw - 32);

              roundRectPath(ctx, cx + 16, cy + 80, cw - 140, 12, 6);
              ctx.fillStyle = '#070f20';
              ctx.fill();
              if (it.completionPct > 0) {
                roundRectPath(
                  ctx,
                  cx + 16,
                  cy + 80,
                  Math.max(12, Math.round(((cw - 140) * it.completionPct) / 100)),
                  12,
                  6
                );
                ctx.fillStyle = it.status === 'validated' ? '#10b981' : '#f59e0b';
                ctx.fill();
              }
              ctx.fillStyle = '#cbd5e1';
              ctx.font = 'bold 15px system-ui, sans-serif';
              ctx.textAlign = 'right';
              ctx.fillText(`${it.completionPct}%`, cx + cw - 16, cy + 91);
              ctx.textAlign = 'left';

              ctx.fillStyle = '#fbbf24';
              ctx.font = 'bold 14px system-ui, sans-serif';
              ctx.fillText(
                it.rewarded ? '✅ Récompense créditée' : `🪙 +${it.tp.rewardCoins} CC • +${it.tp.rewardXp} XP`,
                cx + 16,
                cy + 116
              );
            }

            hitBoxes.push({
              id: `vr_tablet_fmt_open_${it.tp.id}`,
              kind: 'button',
              x: cx,
              y: cy,
              w: cw,
              h: ch,
              label: it.tp.shortTitle,
              onClick: () => {
                tabletUi.activeTpId = it.tp.id;
                tabletUi.activeQuestionIdx = 0;
                tabletUi.kbdVisible = false;
                tabletUi.lastSyncedTpId = it.tp.id;
                if (state.tablet) state.tablet.activeTpId = it.tp.id;
                redraw();
              }
            });
          });
        } else {
          const answers = mergedFormativeProgress[activeTp.id]?.answers || {};
          const evalRes = evaluateFormativeTp(activeTp.id, answers);
          const qIdx = Math.max(
            0,
            Math.min(activeTp.questions.length - 1, tabletUi.activeQuestionIdx || 0)
          );
          tabletUi.activeQuestionIdx = qIdx;
          const curQ = activeTp.questions[qIdx];
          const curRes = evalRes.results[qIdx] || { status: 'unanswered', hint: '' };

          addBtn('vr_tablet_fmt_back', 28, 76, 166, 42, '◀ Catalogue', {
            fontSize: 17,
            onClick: () => {
              tabletUi.activeTpId = null;
              tabletUi.kbdVisible = false;
              tabletUi.lastSyncedTpId = null;
              if (state.tablet) state.tablet.activeTpId = null;
              redraw();
            }
          });

          if (ctx) {
            ctx.fillStyle = '#f8fafc';
            ctx.font = 'bold 21px system-ui, sans-serif';
            ctx.fillText(`${activeTp.icon} ${activeTp.title}`.slice(0, 52), 210, 104, 710);

            roundRectPath(ctx, 932, 76, 320, 42, 12);
            ctx.fillStyle = evalRes.validated ? 'rgba(6, 78, 59, 0.9)' : 'rgba(15, 32, 58, 0.92)';
            ctx.fill();
            ctx.strokeStyle = evalRes.validated ? '#34d399' : '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = evalRes.validated ? '#6ee7b7' : '#bae6fd';
            ctx.font = 'bold 17px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(
              `${evalRes.correctCount}/${evalRes.totalQuestions} (${evalRes.completionPct}%) • ${evalRes.scoreOutOf20.toFixed(1)}/20`,
              1092,
              103
            );
            ctx.textAlign = 'left';
          }

          const segCount = activeTp.questions.length;
          const segW = Math.floor((1224 - (segCount - 1) * 8) / Math.max(1, segCount));
          evalRes.results.forEach((r, idx) => {
            const sx = 28 + idx * (segW + 8);
            const isActiveQ = idx === qIdx;
            const segLabel = `Q${idx + 1} ${r.status === 'correct' ? '✓' : r.status === 'incorrect' ? '✗' : ''}`;
            addBtn(`vr_tablet_fmt_seg_${idx}`, sx, 126, segW, 38, segLabel.trim(), {
              primary: r.status === 'correct',
              danger: r.status === 'incorrect',
              active: isActiveQ && r.status === 'unanswered',
              fontSize: 16,
              onClick: () => {
                tabletUi.activeQuestionIdx = idx;
                tabletUi.kbdVisible = false;
                if (activeTp.questions[idx]?.type === 'short_text') {
                  tabletUi.kbdInput = String(answers[activeTp.questions[idx].id] || '');
                }
                redraw();
              }
            });
          });

          if (ctx) {
            roundRectPath(ctx, 28, 172, 1224, 72, 12);
            ctx.fillStyle = 'rgba(10, 22, 44, 0.9)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = '#cbd5e1';
            ctx.font = '16px system-ui, sans-serif';
            const ctxLines = wrapTextLines(ctx, activeTp.context, 1180, 2);
            ctxLines.forEach((ln, idx) => {
              ctx.fillText(ln, 44, 200 + idx * 24);
            });
          }

          if (ctx) {
            roundRectPath(ctx, 28, 254, 1224, 448, 16);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle =
              curRes.status === 'correct'
                ? '#10b981'
                : curRes.status === 'incorrect'
                  ? '#ef4444'
                  : '#38bdf8';
            ctx.stroke();
          }

          if (tabletUi.kbdVisible && curQ?.type === 'short_text') {
            if (ctx) {
              ctx.fillStyle = '#94a3b8';
              ctx.font = 'bold 16px system-ui, sans-serif';
              ctx.fillText(`Question ${qIdx + 1}/${segCount} — Saisie Clavier VR`, 48, 286);
              ctx.fillStyle = '#f8fafc';
              ctx.font = 'bold 20px system-ui, sans-serif';
              ctx.fillText(String(curQ.prompt || '').slice(0, 86), 48, 316);

              roundRectPath(ctx, 48, 330, 860, 46, 10);
              ctx.fillStyle = '#040915';
              ctx.fill();
              ctx.strokeStyle = '#22d3ee';
              ctx.lineWidth = 2;
              ctx.stroke();
              ctx.fillStyle = '#f8fafc';
              ctx.font = 'bold 21px monospace';
              ctx.fillText(`> ${String(tabletUi.kbdInput || '').slice(-50)}_`, 64, 360);
            }

            addBtn('vr_tablet_fmt_kbd_cancel', 924, 330, 148, 46, 'Annuler', {
              danger: true,
              fontSize: 17,
              onClick: () => {
                tabletUi.kbdVisible = false;
                redraw();
              }
            });
            addBtn('vr_tablet_fmt_kbd_submit', 1084, 330, 148, 46, 'Valider ✓', {
              primary: true,
              fontSize: 18,
              onClick: () => {
                const val = String(tabletUi.kbdInput || '').trim();
                tabletUi.kbdVisible = false;
                saveFmtAnswer(activeTp.id, curQ.id, val);
              }
            });

            const kRows = [
              ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '.', '/'],
              ['a', 'z', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '(', ')'],
              ['q', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', ',', '-']
            ];
            kRows.forEach((rowKeys, rIdx) => {
              const kW = Math.floor((1184 - (rowKeys.length - 1) * 6) / rowKeys.length);
              const ry = 390 + rIdx * 54;
              rowKeys.forEach((ch, cIdx) => {
                const out = tabletUi.kbdShift ? ch.toUpperCase() : ch;
                addBtn(`vr_tablet_fmt_key_${out}`, 48 + cIdx * (kW + 6), ry, kW, 48, out, {
                  fontSize: 19,
                  onClick: () => {
                    tabletUi.kbdInput = `${tabletUi.kbdInput || ''}${out}`;
                    redraw();
                  }
                });
              });
            });

            const bottomKeys = [
              { id: 'shift', label: tabletUi.kbdShift ? 'MAJ ▲' : 'maj △', w: 100, active: tabletUi.kbdShift, fn: () => { tabletUi.kbdShift = !tabletUi.kbdShift; redraw(); } },
              { id: 'w', label: tabletUi.kbdShift ? 'W' : 'w', w: 72, ch: tabletUi.kbdShift ? 'W' : 'w' },
              { id: 'x', label: tabletUi.kbdShift ? 'X' : 'x', w: 72, ch: tabletUi.kbdShift ? 'X' : 'x' },
              { id: 'c', label: tabletUi.kbdShift ? 'C' : 'c', w: 72, ch: tabletUi.kbdShift ? 'C' : 'c' },
              { id: 'v', label: tabletUi.kbdShift ? 'V' : 'v', w: 72, ch: tabletUi.kbdShift ? 'V' : 'v' },
              { id: 'b', label: tabletUi.kbdShift ? 'B' : 'b', w: 72, ch: tabletUi.kbdShift ? 'B' : 'b' },
              { id: 'n', label: tabletUi.kbdShift ? 'N' : 'n', w: 72, ch: tabletUi.kbdShift ? 'N' : 'n' },
              { id: 'space', label: 'ESPACE', w: 226, ch: ' ' },
              { id: 'bksp', label: '⌫', w: 112, fn: () => { tabletUi.kbdInput = String(tabletUi.kbdInput || '').slice(0, -1); redraw(); } },
              { id: 'clear', label: 'VIDER', w: 116, danger: true, fn: () => { tabletUi.kbdInput = ''; redraw(); } },
              {
                id: 'enter',
                label: 'VALIDER ↵',
                w: 136,
                primary: true,
                fn: () => {
                  const val = String(tabletUi.kbdInput || '').trim();
                  tabletUi.kbdVisible = false;
                  saveFmtAnswer(activeTp.id, curQ.id, val);
                }
              }
            ];
            let kx = 48;
            for (const bk of bottomKeys) {
              addBtn(`vr_tablet_fmt_key_${bk.id}`, kx, 552, bk.w, 50, bk.label, {
                active: Boolean(bk.active),
                primary: Boolean(bk.primary),
                danger: Boolean(bk.danger),
                fontSize: 16,
                onClick:
                  bk.fn ||
                  (() => {
                    tabletUi.kbdInput = `${tabletUi.kbdInput || ''}${bk.ch}`;
                    redraw();
                  })
              });
              kx += bk.w + 6;
            }
          } else if (curQ) {
            if (ctx) {
              ctx.fillStyle = '#94a3b8';
              ctx.font = 'bold 16px system-ui, sans-serif';
              ctx.fillText(`QUESTION ${qIdx + 1} / ${segCount}`, 48, 286);

              ctx.textAlign = 'right';
              ctx.fillStyle =
                curRes.status === 'correct'
                  ? '#6ee7b7'
                  : curRes.status === 'incorrect'
                    ? '#fca5a5'
                    : '#cbd5e1';
              ctx.fillText(
                curRes.status === 'correct'
                  ? '✅ Bonne réponse'
                  : curRes.status === 'incorrect'
                    ? '❌ À corriger'
                    : '⚪ Non répondu',
                1232,
                286
              );
              ctx.textAlign = 'left';

              ctx.fillStyle = '#f8fafc';
              ctx.font = 'bold 21px system-ui, sans-serif';
              const promptLines = wrapTextLines(ctx, curQ.prompt, 1180, 2);
              promptLines.forEach((ln, idx) => {
                ctx.fillText(ln, 48, 322 + idx * 28);
              });
            }

            if (curQ.type === 'mcq_single') {
              const selId = answers[curQ.id] || '';
              (curQ.options || []).slice(0, 4).forEach((opt, idx) => {
                const col = idx % 2;
                const row = Math.floor(idx / 2);
                const bx = 48 + col * 600;
                const by = 390 + row * 94;
                addBtn(`vr_tablet_fmt_opt_${opt.id}`, bx, by, 584, 78, opt.label, {
                  active: selId === opt.id,
                  maxChars: 52,
                  fontSize: 17,
                  onClick: () => saveFmtAnswer(activeTp.id, curQ.id, opt.id)
                });
              });
            } else if (curQ.type === 'mcq_multi') {
              const selSet = new Set(Array.isArray(answers[curQ.id]) ? answers[curQ.id] : []);
              (curQ.options || []).slice(0, 4).forEach((opt, idx) => {
                const col = idx % 2;
                const row = Math.floor(idx / 2);
                const bx = 48 + col * 600;
                const by = 390 + row * 94;
                const on = selSet.has(opt.id);
                addBtn(
                  `vr_tablet_fmt_multi_${opt.id}`,
                  bx,
                  by,
                  584,
                  78,
                  `${on ? '☑' : '☐'} ${opt.label}`,
                  {
                    active: on,
                    maxChars: 52,
                    fontSize: 17,
                    onClick: () => {
                      const nextSet = new Set(selSet);
                      if (nextSet.has(opt.id)) nextSet.delete(opt.id);
                      else nextSet.add(opt.id);
                      saveFmtAnswer(activeTp.id, curQ.id, [...nextSet]);
                    }
                  }
                );
              });
            } else if (curQ.type === 'short_text') {
              const curVal =
                tabletUi.kbdInput && tabletUi.activeQuestionIdx === qIdx
                  ? tabletUi.kbdInput
                  : String(answers[curQ.id] || '');
              if (ctx) {
                roundRectPath(ctx, 48, 412, 760, 68, 12);
                ctx.fillStyle = '#040915';
                ctx.fill();
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.fillStyle = curVal ? '#f8fafc' : '#64748b';
                ctx.font = 'bold 22px monospace';
                ctx.fillText(curVal || curQ.placeholder || 'Saisir votre réponse...', 68, 454, 720);
              }
              addBtn('vr_tablet_fmt_kbd_open', 824, 412, 214, 68, '⌨️ Clavier VR', {
                active: true,
                fontSize: 19,
                onClick: () => {
                  tabletUi.kbdInput = String(answers[curQ.id] || tabletUi.kbdInput || '');
                  tabletUi.kbdVisible = true;
                  redraw();
                }
              });
              addBtn('vr_tablet_fmt_short_submit', 1052, 412, 180, 68, 'Valider ✓', {
                primary: true,
                fontSize: 20,
                onClick: () => {
                  const val = String(tabletUi.kbdInput || answers[curQ.id] || '').trim();
                  saveFmtAnswer(activeTp.id, curQ.id, val);
                }
              });
            } else if (curQ.type === 'ordering') {
              const bufKey = `${activeTp.id}:${curQ.id}`;
              let orderIds = tabletUi.localOrdering.get(bufKey);
              if (!Array.isArray(orderIds) || orderIds.length !== curQ.items.length) {
                orderIds =
                  Array.isArray(answers[curQ.id]) && answers[curQ.id].length === curQ.items.length
                    ? [...answers[curQ.id]]
                    : curQ.items.map((it) => it.id);
                tabletUi.localOrdering.set(bufKey, orderIds);
              }
              const itemMap = new Map(curQ.items.map((it) => [it.id, it]));
              orderIds.slice(0, 4).forEach((id, pos) => {
                const ry = 382 + pos * 52;
                if (ctx) {
                  roundRectPath(ctx, 48, ry, 976, 44, 10);
                  ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
                  ctx.fill();
                  ctx.fillStyle = '#38bdf8';
                  ctx.font = 'bold 18px system-ui, sans-serif';
                  ctx.fillText(`${pos + 1}.`, 66, ry + 28);
                  ctx.fillStyle = '#f8fafc';
                  ctx.font = '17px system-ui, sans-serif';
                  ctx.fillText(String(itemMap.get(id)?.label || id).slice(0, 72), 98, ry + 28);
                }
                addBtn(`vr_tablet_fmt_ord_up_${pos}`, 1036, ry, 88, 44, '▲', {
                  disabled: pos === 0,
                  fontSize: 18,
                  onClick: () => {
                    const next = [...orderIds];
                    const tmp = next[pos];
                    next[pos] = next[pos - 1];
                    next[pos - 1] = tmp;
                    tabletUi.localOrdering.set(bufKey, next);
                    saveFmtAnswer(activeTp.id, curQ.id, next);
                  }
                });
                addBtn(`vr_tablet_fmt_ord_dn_${pos}`, 1134, ry, 88, 44, '▼', {
                  disabled: pos >= orderIds.length - 1,
                  fontSize: 18,
                  onClick: () => {
                    const next = [...orderIds];
                    const tmp = next[pos];
                    next[pos] = next[pos + 1];
                    next[pos + 1] = tmp;
                    tabletUi.localOrdering.set(bufKey, next);
                    saveFmtAnswer(activeTp.id, curQ.id, next);
                  }
                });
              });
              addBtn('vr_tablet_fmt_ord_submit', 420, 594, 440, 42, '✓ Vérifier l’ordre', {
                primary: true,
                fontSize: 17,
                onClick: () => saveFmtAnswer(activeTp.id, curQ.id, [...orderIds])
              });
            } else if (curQ.type === 'matching') {
              const curPairs = answers[curQ.id] && typeof answers[curQ.id] === 'object' ? answers[curQ.id] : {};
              const rightList = curQ.rightItems || [];
              const rightMap = new Map(rightList.map((r) => [r.id, r.label]));
              (curQ.leftItems || []).slice(0, 4).forEach((left, pos) => {
                const ry = 382 + pos * 54;
                const curRightId = curPairs[left.id] || '';
                const curRightLabel = rightMap.get(curRightId) || 'Choisir ↻';
                if (ctx) {
                  roundRectPath(ctx, 48, ry, 480, 46, 10);
                  ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
                  ctx.fill();
                  ctx.fillStyle = '#f8fafc';
                  ctx.font = 'bold 17px system-ui, sans-serif';
                  ctx.fillText(`${left.label} →`, 68, ry + 29, 440);
                }
                addBtn(`vr_tablet_fmt_match_${left.id}`, 544, ry, 688, 46, curRightLabel, {
                  active: Boolean(curRightId),
                  maxChars: 54,
                  fontSize: 16,
                  onClick: () => {
                    const idxNow = rightList.findIndex((r) => r.id === curRightId);
                    const nextRight = rightList[(idxNow + 1) % Math.max(1, rightList.length)];
                    if (nextRight) {
                      saveFmtAnswer(activeTp.id, curQ.id, { ...curPairs, [left.id]: nextRight.id });
                    }
                  }
                });
              });
            }

            if (ctx && curRes.status !== 'unanswered') {
              ctx.fillStyle = curRes.status === 'correct' ? '#6ee7b7' : '#fde68a';
              ctx.font = 'bold 16px system-ui, sans-serif';
              ctx.textAlign = 'center';
              const fbMsg =
                curRes.status === 'correct'
                  ? '✅ Réponse exacte enregistrée !'
                  : `💡 Indice : ${String(curRes.hint || '').slice(0, 62)}`;
              ctx.fillText(fbMsg, 640, 668, 680);
              ctx.textAlign = 'left';
            }

            addBtn('vr_tablet_fmt_q_prev', 48, 644, 210, 44, '◀ Question Préc.', {
              disabled: qIdx <= 0,
              fontSize: 16,
              onClick: () => {
                tabletUi.activeQuestionIdx = Math.max(0, qIdx - 1);
                tabletUi.kbdInput = '';
                redraw();
              }
            });
            addBtn('vr_tablet_fmt_q_next', 1022, 644, 210, 44, 'Question Suiv. ▶', {
              disabled: qIdx >= segCount - 1,
              fontSize: 16,
              onClick: () => {
                tabletUi.activeQuestionIdx = Math.min(segCount - 1, qIdx + 1);
                tabletUi.kbdInput = '';
                redraw();
              }
            });
          }
        }
      } else if (activeApp === 'map') {
        const rawMap = tb.mapData || createDefaultMap();
        if (!tabletUi.cachedMapData || tabletUi.lastMapRef !== rawMap) {
          tabletUi.lastMapRef = rawMap;
          tabletUi.cachedMapData = normalizeMapData(rawMap);
          tabletUi.entityCache = new Map();
          tabletUi.mapAutoFitted = false;
        }
        const mapData = tabletUi.cachedMapData;
        const b = mapData.bounds;
        const playerPos = tb.playerPos || null;
        const playerFloor = clampFloor(tb.playerFloor ?? 0);
        if (tabletUi.followFloor && tb.playerFloor !== undefined) {
          tabletUi.selectedFloor = playerFloor;
        }
        const activeFloor = clampFloor(tabletUi.selectedFloor);

        const mapX = 28;
        const mapY = 130;
        const mapW = 856;
        const mapH = 572;

        const fitMap = () => {
          tabletUi.viewCenterX = (b.minX + b.maxX) * 0.5;
          tabletUi.viewCenterZ = (b.minZ + b.maxZ) * 0.5;
          const fitScale =
            Math.min(mapW, mapH) / Math.max(20, Math.max(b.width, b.depth) * 1.12);
          tabletUi.pxPerMeter = clampZoomScale(fitScale, b, mapW, mapH);
          tabletUi.mapAutoFitted = true;
        };

        if (!tabletUi.mapAutoFitted || tabletUi.pxPerMeter === null) {
          fitMap();
        }

        const mapView = {
          centerX: tabletUi.viewCenterX,
          centerZ: tabletUi.viewCenterZ,
          pxPerMeter: clampZoomScale(tabletUi.pxPerMeter, b, mapW, mapH),
          width: mapW,
          height: mapH
        };
        tabletUi.pxPerMeter = mapView.pxPerMeter;

        const setTabletWaypoint = (wp) => {
          tabletUi.waypoint = wp;
          tabletUi.lastSyncedWaypointKey = wp
            ? `${wp.x},${wp.z},${wp.floor}`
            : 'none';
          if (state.tablet) state.tablet.waypoint = wp;
          tb.onWaypointChange?.(wp);
          redraw();
        };

        addBtn('vr_tablet_map_fl_down', 28, 78, 72, 42, '− Ét.', {
          fontSize: 17,
          onClick: () => {
            tabletUi.followFloor = false;
            tabletUi.selectedFloor = clampFloor(activeFloor - 1);
            redraw();
          }
        });
        if (ctx) {
          roundRectPath(ctx, 108, 78, 128, 42, 10);
          ctx.fillStyle = 'rgba(15, 32, 58, 0.95)';
          ctx.fill();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillStyle = '#e0f2fe';
          ctx.font = 'bold 17px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(formatFloorShortLabel(activeFloor), 172, 105);
          ctx.textAlign = 'left';
        }
        addBtn('vr_tablet_map_fl_up', 244, 78, 72, 42, '+ Ét.', {
          fontSize: 17,
          onClick: () => {
            tabletUi.followFloor = false;
            tabletUi.selectedFloor = clampFloor(activeFloor + 1);
            redraw();
          }
        });
        addBtn('vr_tablet_map_fl_rdc', 324, 78, 84, 42, 'RDC', {
          active: activeFloor === 0,
          fontSize: 17,
          onClick: () => {
            tabletUi.followFloor = false;
            tabletUi.selectedFloor = 0;
            redraw();
          }
        });
        addBtn('vr_tablet_map_follow', 416, 78, 134, 42, 'Suivre', {
          primary: tabletUi.followFloor,
          fontSize: 17,
          onClick: () => {
            tabletUi.followFloor = !tabletUi.followFloor;
            if (tabletUi.followFloor) {
              tabletUi.selectedFloor = playerFloor;
            }
            redraw();
          }
        });
        addBtn('vr_tablet_map_zoom_out', 694, 78, 88, 42, '🔍−', {
          fontSize: 18,
          onClick: () => {
            tabletUi.pxPerMeter = clampZoomScale(tabletUi.pxPerMeter / 1.35, b, mapW, mapH);
            redraw();
          }
        });
        addBtn('vr_tablet_map_zoom_in', 790, 78, 88, 42, '🔍+', {
          fontSize: 18,
          onClick: () => {
            tabletUi.pxPerMeter = clampZoomScale(tabletUi.pxPerMeter * 1.35, b, mapW, mapH);
            redraw();
          }
        });
        addBtn('vr_tablet_map_center', 886, 78, 174, 42, '🎯 Centrer', {
          fontSize: 17,
          onClick: () => {
            if (playerPos) {
              tabletUi.viewCenterX = Number(playerPos.x) || 0;
              tabletUi.viewCenterZ = Number(playerPos.z) || 0;
              tabletUi.selectedFloor = playerFloor;
              tabletUi.pxPerMeter = clampZoomScale(Math.max(tabletUi.pxPerMeter, 14), b, mapW, mapH);
            } else {
              fitMap();
            }
            redraw();
          }
        });
        addBtn('vr_tablet_map_fit', 1068, 78, 184, 42, '🗺️ Campus', {
          fontSize: 17,
          onClick: () => {
            fitMap();
            redraw();
          }
        });

        if (!tabletUi.entityCache.has(activeFloor)) {
          tabletUi.entityCache.set(activeFloor, extractMapEntities(mapData, activeFloor));
        }
        const ents = tabletUi.entityCache.get(activeFloor);

        if (ctx) {
          ctx.save();
          roundRectPath(ctx, mapX, mapY, mapW, mapH, 14);
          ctx.clip();
          ctx.fillStyle = '#040915';
          ctx.fillRect(mapX, mapY, mapW, mapH);
          ctx.translate(mapX, mapY);

          const scale = mapView.pxPerMeter;
          const halfWorldW = (mapW * 0.5) / scale;
          const halfWorldH = (mapH * 0.5) / scale;
          const cullPad = 14 / scale;
          const visMinX = mapView.centerX - halfWorldW - cullPad;
          const visMaxX = mapView.centerX + halfWorldW + cullPad;
          const visMinZ = mapView.centerZ - halfWorldH - cullPad;
          const visMaxZ = mapView.centerZ + halfWorldH + cullPad;

          const gridSteps = [1, 2, 5, 10, 25, 50, 100, 250, 500];
          let stepM = 1;
          for (const s of gridSteps) {
            stepM = s;
            if (s * scale >= 36) break;
          }
          const gStartX = Math.floor(Math.max(b.minX, visMinX) / stepM) * stepM;
          const gEndX = Math.ceil(Math.min(b.maxX, visMaxX) / stepM) * stepM;
          const gStartZ = Math.floor(Math.max(b.minZ, visMinZ) / stepM) * stepM;
          const gEndZ = Math.ceil(Math.min(b.maxZ, visMaxZ) / stepM) * stepM;
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let gx = gStartX; gx <= gEndX; gx += stepM) {
            const p1 = worldToScreen(gx, Math.max(b.minZ, visMinZ), mapView);
            const p2 = worldToScreen(gx, Math.min(b.maxZ, visMaxZ), mapView);
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
          }
          for (let gz = gStartZ; gz <= gEndZ; gz += stepM) {
            const p1 = worldToScreen(Math.max(b.minX, visMinX), gz, mapView);
            const p2 = worldToScreen(Math.min(b.maxX, visMaxX), gz, mapView);
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
          }
          ctx.stroke();

          const bTl = worldToScreen(b.minX, b.minZ, mapView);
          const bBr = worldToScreen(b.maxX, b.maxZ, mapView);
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
          ctx.lineWidth = 2;
          ctx.strokeRect(bTl.x, bTl.y, bBr.x - bTl.x, bBr.y - bTl.y);

          for (const z of ents.zones) {
            if (z.maxX < visMinX || z.minX > visMaxX || z.maxZ < visMinZ || z.minZ > visMaxZ) continue;
            if (z.code === 'U300' && !Array.isArray(z.points)) continue;
            const pts = z.points;
            if (!pts || pts.length < 3) continue;
            ctx.beginPath();
            for (let i = 0; i < pts.length; i++) {
              const sp = worldToScreen(pts[i].x, pts[i].z, mapView);
              if (i === 0) ctx.moveTo(sp.x, sp.y);
              else ctx.lineTo(sp.x, sp.y);
            }
            ctx.closePath();
            ctx.fillStyle = `${z.color || '#38bdf8'}22`;
            ctx.fill();
            ctx.strokeStyle = `${z.color || '#38bdf8'}66`;
            ctx.lineWidth = 1;
            ctx.stroke();

            const sw = (z.maxX - z.minX) * scale;
            const sh = (z.maxZ - z.minZ) * scale;
            if (sw >= 34 && sh >= 22) {
              const center = worldToScreen(z.x, z.z, mapView);
              ctx.fillStyle = '#e2e8f0';
              ctx.font = `bold ${Math.min(16, Math.max(10, Math.round(sw * 0.14)))}px system-ui, sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(z.code || '', center.x, center.y);
            }
          }

          ctx.lineCap = 'round';
          for (const seg of ents.walls) {
            if (seg.maxX < visMinX || seg.minX > visMaxX || seg.maxZ < visMinZ || seg.minZ > visMaxZ) continue;
            const p1 = worldToScreen(seg.x1, seg.z1, mapView);
            const p2 = worldToScreen(seg.x2, seg.z2, mapView);
            const isDoor = seg.kind === 'door_single' || seg.kind === 'door_double';
            const isGlazed = seg.kind === 'glazed' || seg.kind === 'window_bay';
            if (isDoor) {
              ctx.strokeStyle = '#22d3ee';
              ctx.lineWidth = 2.5;
              ctx.setLineDash([5, 4]);
            } else {
              ctx.setLineDash([]);
              ctx.strokeStyle = isGlazed ? '#38bdf8' : seg.kind === 'exterior' ? '#cbd5e1' : '#94a3b8';
              ctx.lineWidth = Math.max(1.5, Math.min(6, (seg.thickness || 0.18) * scale));
            }
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
          ctx.setLineDash([]);

          for (const st of ents.stairs) {
            if (st.x + 2 < visMinX || st.x - 2 > visMaxX || st.z + 2 < visMinZ || st.z - 2 > visMaxZ) continue;
            const sp = worldToScreen(st.x, st.z, mapView);
            ctx.fillStyle = 'rgba(245, 158, 11, 0.85)';
            ctx.fillRect(sp.x - 10, sp.y - 10, 20, 20);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '13px system-ui, sans-serif';
            ctx.fillStyle = '#0f172a';
            ctx.fillText('🪜', sp.x, sp.y + 1);
          }

          for (const tp of ents.tpStations) {
            if (tp.x + 2 < visMinX || tp.x - 2 > visMaxX || tp.z + 2 < visMinZ || tp.z - 2 > visMaxZ) continue;
            const sp = worldToScreen(tp.x, tp.z, mapView);
            ctx.fillStyle = tp.color || '#38bdf8';
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            if (scale >= 6) {
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.font = 'bold 12px system-ui, sans-serif';
              ctx.fillStyle = '#e2e8f0';
              ctx.fillText(tp.shortTitle, sp.x, sp.y + 11);
            }
          }

          const vrTeachers =
            tb.teacherPos && activeFloor === 0
              ? [{ x: Number(tb.teacherPos.x) || 0, z: Number(tb.teacherPos.z) || 0 }]
              : ents.teachers;
          for (const t of vrTeachers) {
            if (t.x + 2 < visMinX || t.x - 2 > visMaxX || t.z + 2 < visMinZ || t.z - 2 > visMaxZ) continue;
            const sp = worldToScreen(t.x, t.z, mapView);
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, 11, 0, Math.PI * 2);
            ctx.fill();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '14px system-ui, sans-serif';
            ctx.fillText('👨‍🏫', sp.x, sp.y + 1);
          }

          for (const peer of tb.peers || []) {
            const px = Number(peer.x);
            const pz = Number(peer.z);
            if (!Number.isFinite(px) || !Number.isFinite(pz)) continue;
            if (px + 2 < visMinX || px - 2 > visMaxX || pz + 2 < visMinZ || pz - 2 > visMaxZ) continue;
            const sameFl = clampFloor(peer.floor ?? 0) === activeFloor;
            const sp = worldToScreen(px, pz, mapView);
            ctx.save();
            ctx.globalAlpha = sameFl ? 1 : 0.45;
            ctx.fillStyle = peer.color || '#34d399';
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          if (activeWp) {
            const wpPt = worldToScreen(activeWp.x, activeWp.z, mapView);
            const wpSameFl = clampFloor(activeWp.floor ?? activeFloor) === activeFloor;
            if (playerPos) {
              const plPt = worldToScreen(playerPos.x, playerPos.z, mapView);
              ctx.save();
              ctx.setLineDash([7, 6]);
              ctx.strokeStyle = wpSameFl ? '#f472b6' : 'rgba(244, 114, 182, 0.55)';
              ctx.lineWidth = 2.5;
              ctx.beginPath();
              ctx.moveTo(plPt.x, plPt.y);
              ctx.lineTo(wpPt.x, wpPt.y);
              ctx.stroke();
              ctx.restore();
            }
            ctx.save();
            ctx.globalAlpha = wpSameFl ? 1 : 0.6;
            ctx.fillStyle = 'rgba(236, 72, 153, 0.28)';
            ctx.beginPath();
            ctx.arc(wpPt.x, wpPt.y, 16, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ec4899';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(wpPt.x, wpPt.y, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.font = 'bold 13px system-ui, sans-serif';
            ctx.fillStyle = '#fbcfe8';
            ctx.fillText(String(activeWp.label || 'Repère'), wpPt.x, wpPt.y + 12);
            ctx.restore();
          }

          if (playerPos) {
            const pp = worldToScreen(playerPos.x, playerPos.z, mapView);
            const yaw = Number(tb.playerYaw) || 0;
            const angle = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
            ctx.save();
            ctx.globalAlpha = playerFloor === activeFloor ? 1 : 0.45;
            ctx.translate(pp.x, pp.y);
            ctx.rotate(angle);
            ctx.fillStyle = 'rgba(34, 211, 238, 0.28)';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, 26, -0.48, 0.48);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#22d3ee';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(11, 0);
            ctx.lineTo(-7, -6);
            ctx.lineTo(-4, 0);
            ctx.lineTo(-7, 6);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }

          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
          ctx.restore();

          roundRectPath(ctx, mapX, mapY, mapW, mapH, 14);
          ctx.lineWidth = 2;
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
          ctx.stroke();
        }

        hitBoxes.push({
          id: 'vr_tablet_map_canvas',
          kind: 'button',
          x: mapX,
          y: mapY,
          w: mapW,
          h: mapH,
          label: 'Placer repère sur carte',
          onClick: (uv) => {
            const lx = uv ? uv.x * canvasW - mapX : mapW * 0.5;
            const ly = uv ? (1 - uv.y) * canvasH - mapY : mapH * 0.5;
            const worldPt = screenToWorld(lx, ly, mapView);
            const wx = Number(Math.max(b.minX, Math.min(b.maxX, worldPt.x)).toFixed(2));
            const wz = Number(Math.max(b.minZ, Math.min(b.maxZ, worldPt.z)).toFixed(2));
            const zone = getZoneAtPositionInMap(mapData, wx, wz, activeFloor);
            const label =
              (mapData.zones || []).some((z) => z.id === zone?.id && clampFloor(z.floor ?? 0) === activeFloor)
                ? `${zone.code} - ${zone.shortName}`
                : `Repère ${formatFloorShortLabel(activeFloor)}`;
            setTabletWaypoint({ x: wx, z: wz, floor: activeFloor, label });
          }
        });

        const navInfo = computeWaypointNavigation(playerPos, playerFloor, activeWp);
        if (ctx) {
          roundRectPath(ctx, 900, 130, 352, 160, 14);
          ctx.fillStyle = activeWp ? 'rgba(131, 24, 67, 0.35)' : 'rgba(10, 22, 44, 0.92)';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = activeWp ? '#f472b6' : 'rgba(56, 189, 248, 0.35)';
          ctx.stroke();

          ctx.fillStyle = '#fbcfe8';
          ctx.font = 'bold 18px system-ui, sans-serif';
          ctx.fillText(
            activeWp ? `📍 ${String(activeWp.label).slice(0, 26)}` : '📍 Repère GPS Campus',
            918,
            162
          );
          ctx.fillStyle = '#e2e8f0';
          ctx.font = '15px system-ui, sans-serif';
          if (activeWp) {
            const line = navInfo
              ? `${Math.round(navInfo.distanceMeters)} m • ${navInfo.floorInstruction}`
              : formatFloorLabel(activeWp.floor);
            ctx.fillText(line.slice(0, 36), 918, 196);
            ctx.fillStyle = '#94a3b8';
            ctx.font = '14px system-ui, sans-serif';
            ctx.fillText(
              `Coord: ${Number(activeWp.x).toFixed(1)}m, ${Number(activeWp.z).toFixed(1)}m`,
              918,
              222
            );
          } else {
            const tipLines = wrapTextLines(
              ctx,
              'Pointez et cliquez sur la carte ou choisissez un poste ci-dessous.',
              316,
              3
            );
            tipLines.forEach((ln, i) => ctx.fillText(ln, 918, 196 + i * 24));
          }
        }
        if (activeWp) {
          addBtn('vr_tablet_map_wp_clear', 918, 238, 316, 40, '✕ Effacer Repère', {
            danger: true,
            fontSize: 16,
            onClick: () => setTabletWaypoint(null)
          });
        }

        const pois = [];
        for (const obj of mapData.objects || []) {
          if (!obj) continue;
          const fl = clampFloor(obj.floor ?? 0);
          if (obj.type === 'npc_teacher') {
            pois.unshift({
              icon: '👨‍🏫',
              label: 'Professeur CIEL',
              floor: fl,
              x: Number(obj.x) || 0,
              z: Number(obj.z) || 0
            });
          } else {
            const cat = getCatalogItem(obj.type);
            if (cat?.tpId) {
              pois.push({
                icon: cat.icon || '🖥️',
                label: obj.label || cat.shortLabel || cat.tpId,
                floor: fl,
                x: Number(obj.x) || 0,
                z: Number(obj.z) || 0
              });
            }
          }
        }
        pois.slice(0, 7).forEach((poi, idx) => {
          addBtn(
            `vr_tablet_map_poi_${idx}`,
            900,
            304 + idx * 56,
            352,
            48,
            `${poi.icon} ${poi.label} (${formatFloorShortLabel(poi.floor)})`,
            {
              maxChars: 34,
              fontSize: 15,
              onClick: () => {
                tabletUi.followFloor = false;
                tabletUi.selectedFloor = poi.floor;
                tabletUi.viewCenterX = poi.x;
                tabletUi.viewCenterZ = poi.z;
                tabletUi.pxPerMeter = clampZoomScale(Math.max(tabletUi.pxPerMeter, 18), b, mapW, mapH);
                setTabletWaypoint({
                  x: poi.x,
                  z: poi.z,
                  floor: poi.floor,
                  label: `${poi.icon} ${poi.label}`
                });
              }
            }
          );
        });
      } else if (activeApp === 'grades') {
        const kpis = [
          {
            label: 'Moyenne Formative',
            value:
              gradesSummary.formative.averageScore !== null
                ? `${gradesSummary.formative.averageScore.toFixed(1)}/20`
                : '--/20',
            hl: false
          },
          {
            label: 'Moyenne Atelier 3D',
            value:
              gradesSummary.workshopAverage !== null
                ? `${gradesSummary.workshopAverage.toFixed(1)}/20`
                : '--/20',
            hl: false
          },
          {
            label: 'Moyenne Générale',
            value:
              gradesSummary.globalAverage !== null
                ? `${gradesSummary.globalAverage.toFixed(1)}/20`
                : '--/20',
            hl: true
          },
          {
            label: 'TP Formative',
            value: `${gradesSummary.formative.validatedCount}/${gradesSummary.formative.totalTps}`,
            hl: false
          },
          {
            label: 'Badges CIEL',
            value: `${gradesSummary.unlockedBadgesCount}/${gradesSummary.totalBadgesCount}`,
            hl: false
          }
        ];

        if (ctx) {
          kpis.forEach((k, idx) => {
            const kx = 28 + idx * 247;
            roundRectPath(ctx, kx, 78, 236, 92, 14);
            ctx.fillStyle = k.hl ? 'rgba(14, 116, 144, 0.38)' : 'rgba(15, 23, 42, 0.92)';
            ctx.fill();
            ctx.lineWidth = k.hl ? 2.5 : 1.5;
            ctx.strokeStyle = k.hl ? '#22d3ee' : 'rgba(148, 163, 184, 0.3)';
            ctx.stroke();
            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 14px system-ui, sans-serif';
            ctx.fillText(k.label, kx + 16, 108);
            ctx.fillStyle = k.hl ? '#22d3ee' : '#f8fafc';
            ctx.font = 'bold 26px system-ui, sans-serif';
            ctx.fillText(k.value, kx + 16, 148);
          });

          roundRectPath(ctx, 28, 186, 600, 514, 16);
          ctx.fillStyle = 'rgba(13, 24, 44, 0.92)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 20px system-ui, sans-serif';
          ctx.fillText('📚 Progression par Pôle CIEL', 48, 222);
          ctx.fillStyle = '#fde68a';
          ctx.font = 'bold 16px system-ui, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(gradesSummary.mention, 608, 222);
          ctx.textAlign = 'left';

          gradesSummary.formative.byPole.forEach((pole, idx) => {
            const py = 246 + idx * 112;
            roundRectPath(ctx, 48, py, 560, 96, 12);
            ctx.fillStyle = 'rgba(7, 15, 32, 0.88)';
            ctx.fill();
            ctx.strokeStyle = pole.color;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = '#f8fafc';
            ctx.font = 'bold 17px system-ui, sans-serif';
            ctx.fillText(`${pole.icon} ${pole.label}`.slice(0, 38), 66, py + 28);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#bae6fd';
            ctx.fillText(`${pole.validated}/${pole.total} (${pole.pct}%)`, 590, py + 28);
            ctx.textAlign = 'left';

            roundRectPath(ctx, 66, py + 44, 524, 14, 7);
            ctx.fillStyle = '#0f172a';
            ctx.fill();
            if (pole.pct > 0) {
              roundRectPath(ctx, 66, py + 44, Math.max(14, Math.round((524 * pole.pct) / 100)), 14, 7);
              ctx.fillStyle = pole.color;
              ctx.fill();
            }
            ctx.fillStyle = '#94a3b8';
            ctx.font = '14px system-ui, sans-serif';
            ctx.fillText(
              `Moyenne pôle : ${pole.averageScore !== null ? `${pole.averageScore.toFixed(1)}/20` : 'En attente'}`,
              66,
              py + 80
            );
          });

          roundRectPath(ctx, 646, 186, 606, 514, 16);
          ctx.fillStyle = 'rgba(13, 24, 44, 0.92)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 20px system-ui, sans-serif';
          ctx.fillText('🏆 Badges de Compétence CIEL', 668, 222);

          gradesSummary.formative.badges.slice(0, 7).forEach((b, idx) => {
            const by = 244 + idx * 63;
            roundRectPath(ctx, 666, by, 566, 54, 10);
            ctx.fillStyle = b.unlocked ? 'rgba(6, 78, 59, 0.55)' : 'rgba(15, 23, 42, 0.85)';
            ctx.fill();
            ctx.strokeStyle = b.unlocked ? '#fbbf24' : '#334155';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = '#f8fafc';
            ctx.font = 'bold 16px system-ui, sans-serif';
            ctx.fillText(`${b.icon} ${b.title}`.slice(0, 34), 682, by + 24);
            ctx.fillStyle = '#94a3b8';
            ctx.font = '13px system-ui, sans-serif';
            ctx.fillText(String(b.desc || '').slice(0, 48), 682, by + 44);
            ctx.textAlign = 'right';
            ctx.fillStyle = b.unlocked ? '#fde047' : '#64748b';
            ctx.font = 'bold 14px system-ui, sans-serif';
            ctx.fillText(b.unlocked ? '🏆 Débloqué' : '🔒 Verrouillé', 1216, by + 32);
            ctx.textAlign = 'left';
          });
        }
      } else if (activeApp === 'tools') {
        const tabs = [
          { id: 'subnet', label: '🌐 Calculateur IPv4 / CIDR' },
          { id: 'resistor', label: '🎨 Code Couleur Résistances' },
          { id: 'memo', label: '🐧 Mémo Linux & Cisco' }
        ];
        tabs.forEach((t, idx) => {
          addBtn(`vr_tablet_tools_tab_${t.id}`, 28 + idx * 414, 78, 396, 46, t.label, {
            active: tabletUi.toolTab === t.id,
            fontSize: 18,
            onClick: () => {
              tabletUi.toolTab = t.id;
              redraw();
            }
          });
        });

        if (tabletUi.toolTab === 'subnet') {
          const presets = [
            { ip: '192.168.10.45', cidr: 26 },
            { ip: '10.20.0.15', cidr: 16 },
            { ip: '172.16.4.99', cidr: 24 },
            { ip: '192.168.1.250', cidr: 30 }
          ];
          presets.forEach((p, idx) => {
            addBtn(`vr_tablet_tools_preset_${idx}`, 28 + idx * 234, 138, 222, 44, `${p.ip}/${p.cidr}`, {
              active: tabletUi.subnetIp === p.ip && tabletUi.subnetCidr === p.cidr,
              fontSize: 16,
              onClick: () => {
                tabletUi.subnetIp = p.ip;
                tabletUi.subnetCidr = p.cidr;
                redraw();
              }
            });
          });
          addBtn('vr_tablet_tools_cidr_dec', 976, 138, 86, 44, '− /', {
            fontSize: 18,
            onClick: () => {
              tabletUi.subnetCidr = Math.max(0, Number(tabletUi.subnetCidr) - 1);
              redraw();
            }
          });
          addBtn('vr_tablet_tools_cidr_inc', 1166, 138, 86, 44, '+ /', {
            fontSize: 18,
            onClick: () => {
              tabletUi.subnetCidr = Math.min(32, Number(tabletUi.subnetCidr) + 1);
              redraw();
            }
          });
          if (ctx) {
            roundRectPath(ctx, 1070, 138, 88, 44, 10);
            ctx.fillStyle = '#0f2942';
            ctx.fill();
            ctx.fillStyle = '#22d3ee';
            ctx.font = 'bold 20px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`/${tabletUi.subnetCidr}`, 1114, 167);
            ctx.textAlign = 'left';
          }

          const calc = calculateIpv4Subnet(tabletUi.subnetIp, tabletUi.subnetCidr);
          if (ctx && calc.ok) {
            const cells = [
              { label: 'Adresse IP / CIDR', value: `${calc.ip}/${calc.cidr}` },
              { label: 'Adresse Réseau', value: `${calc.network}/${calc.cidr}` },
              { label: 'Masque Décimal', value: calc.mask },
              { label: 'Broadcast', value: calc.broadcast },
              { label: 'Wildcard', value: calc.wildcard },
              { label: 'Premier Hôte', value: calc.firstHost },
              { label: 'Dernier Hôte', value: calc.lastHost },
              { label: 'Hôtes Utilisables', value: String(calc.usableHosts) }
            ];
            cells.forEach((c, idx) => {
              const col = idx % 2;
              const row = Math.floor(idx / 2);
              const bx = 28 + col * 622;
              const by = 200 + row * 108;
              roundRectPath(ctx, bx, by, 602, 92, 14);
              ctx.fillStyle = idx === 7 ? 'rgba(6, 78, 59, 0.55)' : 'rgba(13, 24, 44, 0.92)';
              ctx.fill();
              ctx.strokeStyle = idx === 7 ? '#10b981' : 'rgba(56, 189, 248, 0.3)';
              ctx.lineWidth = 1.5;
              ctx.stroke();
              ctx.fillStyle = '#94a3b8';
              ctx.font = 'bold 15px system-ui, sans-serif';
              ctx.fillText(c.label, bx + 20, by + 30);
              ctx.fillStyle = '#f8fafc';
              ctx.font = 'bold 26px monospace';
              ctx.fillText(c.value, bx + 20, by + 68);
            });
            roundRectPath(ctx, 28, 636, 1224, 58, 12);
            ctx.fillStyle = 'rgba(7, 15, 32, 0.9)';
            ctx.fill();
            ctx.fillStyle = '#7dd3fc';
            ctx.font = 'bold 18px monospace';
            ctx.fillText(
              `Binaire : ${calc.maskBinary}  •  ${calc.scope} (${calc.ipClass})`,
              48,
              672
            );
          }
        } else if (tabletUi.toolTab === 'resistor') {
          const digitColors = RESISTOR_BAND_COLORS.filter((c) => c.digit !== null);
          const multColors = RESISTOR_BAND_COLORS.filter((c) => c.multiplier !== null);
          const tolColors = RESISTOR_BAND_COLORS.filter((c) => c.tolerancePct !== null);
          const decoded = decodeResistor4Band(
            tabletUi.band1,
            tabletUi.band2,
            tabletUi.bandMult,
            tabletUi.bandTol
          );
          if (ctx) {
            roundRectPath(ctx, 28, 138, 1224, 156, 16);
            ctx.fillStyle = '#070f20';
            ctx.fill();
            ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 12;
            ctx.beginPath();
            ctx.moveTo(64, 216);
            ctx.lineTo(656, 216);
            ctx.stroke();

            roundRectPath(ctx, 150, 166, 420, 100, 26);
            ctx.fillStyle = '#e5c89e';
            ctx.fill();
            ctx.strokeStyle = '#b48a5a';
            ctx.lineWidth = 3;
            ctx.stroke();

            const hexes = decoded.ok
              ? decoded.hexColors
              : ['#78350f', '#111827', '#dc2626', '#d97706'];
            const bandXs = [210, 286, 362, 476];
            bandXs.forEach((bx, i) => {
              ctx.fillStyle = hexes[i];
              ctx.fillRect(bx, 166, 30, 100);
            });

            ctx.fillStyle = '#fbbf24';
            ctx.font = 'bold 44px system-ui, sans-serif';
            ctx.fillText(decoded.ok ? decoded.formatted : '-- Ω', 710, 212);
            ctx.fillStyle = '#cbd5e1';
            ctx.font = 'bold 20px system-ui, sans-serif';
            ctx.fillText(
              decoded.ok
                ? `${decoded.toleranceLabel} (${decoded.minFormatted} — ${decoded.maxFormatted})`
                : '',
              710,
              254
            );
          }

          const bandSpecs = [
            { key: 'band1', title: 'Anneau 1 (1er chiffre)', list: digitColors },
            { key: 'band2', title: 'Anneau 2 (2e chiffre)', list: digitColors },
            { key: 'bandMult', title: 'Anneau 3 (Multiplicateur)', list: multColors },
            { key: 'bandTol', title: 'Anneau 4 (Tolérance)', list: tolColors }
          ];
          bandSpecs.forEach((bs, idx) => {
            const ry = 314 + idx * 96;
            const curIdx = Math.max(0, bs.list.findIndex((c) => c.id === tabletUi[bs.key]));
            const curColor = bs.list[curIdx] || bs.list[0];
            if (ctx) {
              roundRectPath(ctx, 28, ry, 1224, 82, 12);
              ctx.fillStyle = 'rgba(13, 24, 44, 0.92)';
              ctx.fill();
              ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
              ctx.lineWidth = 1.5;
              ctx.stroke();
              ctx.fillStyle = '#cbd5e1';
              ctx.font = 'bold 19px system-ui, sans-serif';
              ctx.fillText(bs.title, 48, ry + 48);

              roundRectPath(ctx, 430, ry + 16, 300, 50, 10);
              ctx.fillStyle = curColor.hex;
              ctx.fill();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2;
              ctx.stroke();
              ctx.fillStyle = curColor.textColor || '#ffffff';
              ctx.font = 'bold 20px system-ui, sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText(curColor.label, 580, ry + 48);
              ctx.textAlign = 'left';
            }
            addBtn(`vr_tablet_tools_band_${idx}_prev`, 760, ry + 16, 224, 50, '◀ Couleur Préc.', {
              fontSize: 17,
              onClick: () => {
                const nextIdx = (curIdx - 1 + bs.list.length) % bs.list.length;
                tabletUi[bs.key] = bs.list[nextIdx].id;
                redraw();
              }
            });
            addBtn(`vr_tablet_tools_band_${idx}_next`, 1004, ry + 16, 224, 50, 'Couleur Suiv. ▶', {
              fontSize: 17,
              onClick: () => {
                const nextIdx = (curIdx + 1) % bs.list.length;
                tabletUi[bs.key] = bs.list[nextIdx].id;
                redraw();
              }
            });
          });
        } else {
          MEMO_CATEGORIES.forEach((cat, idx) => {
            addBtn(`vr_tablet_tools_memo_cat_${cat.id}`, 28 + idx * 246, 138, 236, 42, cat.label, {
              active: tabletUi.memoCat === cat.id,
              fontSize: 16,
              onClick: () => {
                tabletUi.memoCat = cat.id;
                tabletUi.memoPage = 0;
                redraw();
              }
            });
          });
          const entries = filterCommandMemo('', tabletUi.memoCat);
          const pageCount = Math.max(1, Math.ceil(entries.length / 6));
          const page = Math.max(0, Math.min(pageCount - 1, tabletUi.memoPage || 0));
          tabletUi.memoPage = page;
          const visible = entries.slice(page * 6, (page + 1) * 6);
          if (ctx) {
            visible.forEach((it, idx) => {
              const col = idx % 2;
              const row = Math.floor(idx / 2);
              const mx = 28 + col * 622;
              const my = 194 + row * 148;
              roundRectPath(ctx, mx, my, 602, 136, 12);
              ctx.fillStyle = 'rgba(13, 24, 44, 0.92)';
              ctx.fill();
              ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
              ctx.lineWidth = 1.5;
              ctx.stroke();
              ctx.fillStyle = '#f8fafc';
              ctx.font = 'bold 17px system-ui, sans-serif';
              ctx.fillText(it.title, mx + 16, my + 28, 570);
              roundRectPath(ctx, mx + 16, my + 42, 570, 36, 8);
              ctx.fillStyle = '#020617';
              ctx.fill();
              ctx.fillStyle = '#34d399';
              ctx.font = 'bold 15px monospace';
              ctx.fillText(it.cmd, mx + 26, my + 65, 550);
              ctx.fillStyle = '#94a3b8';
              ctx.font = '14px system-ui, sans-serif';
              const dLines = wrapTextLines(ctx, it.desc, 570, 2);
              dLines.forEach((ln, li) => ctx.fillText(ln, mx + 16, my + 98 + li * 19));
            });
          }
          addBtn('vr_tablet_tools_memo_prev', 410, 646, 180, 44, '◀ Page Préc.', {
            disabled: page <= 0,
            fontSize: 16,
            onClick: () => {
              tabletUi.memoPage = Math.max(0, page - 1);
              redraw();
            }
          });
          if (ctx) {
            ctx.fillStyle = '#cbd5e1';
            ctx.font = 'bold 17px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`Page ${page + 1} / ${pageCount}`, 640, 674);
            ctx.textAlign = 'left';
          }
          addBtn('vr_tablet_tools_memo_next', 690, 646, 180, 44, 'Page Suiv. ▶', {
            disabled: page >= pageCount - 1,
            fontSize: 16,
            onClick: () => {
              tabletUi.memoPage = Math.min(pageCount - 1, page + 1);
              redraw();
            }
          });
        }
      }

      if (ctx) {
        roundRectPath(ctx, 20, 714, canvasW - 40, 68, 14);
        ctx.fillStyle = 'rgba(6, 12, 26, 0.96)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      addBtn('vr_tablet_nav_back', 260, 721, 230, 54, '◀ Retour', {
        fontSize: 20,
        onClick: (uv) => {
          if (tabletUi.app === 'formative' && tabletUi.kbdVisible) {
            tabletUi.kbdVisible = false;
            redraw();
            return;
          }
          if (tabletUi.app === 'formative' && tabletUi.activeTpId) {
            tabletUi.activeTpId = null;
            tabletUi.lastSyncedTpId = null;
            if (state.tablet) state.tablet.activeTpId = null;
            redraw();
            return;
          }
          if (tabletUi.history.length > 0) {
            const prevApp = tabletUi.history.pop();
            navigateTabletApp(prevApp, false);
            return;
          }
          if (tabletUi.app !== 'home') {
            navigateTabletApp('home', false);
            return;
          }
          handleExitAction(uv);
        }
      });
      addBtn('vr_tablet_nav_home', 525, 721, 230, 54, '⌂ Accueil', {
        primary: activeApp === 'home',
        fontSize: 20,
        onClick: () => {
          tabletUi.history = [];
          tabletUi.activeTpId = null;
          navigateTabletApp('home', false);
        }
      });
      addBtn('vr_tablet_nav_close', 790, 721, 230, 54, '✕ Fermer', {
        danger: true,
        fontSize: 20,
        onClick: handleExitAction
      });

      if (texture) texture.needsUpdate = true;
      return;
    }

    if (mode === 'dialogue' && state.dialogue) {
      const dlg = state.dialogue;
      if (ctx) {
        roundRectPath(ctx, 36, 78, canvasW - 72, 578, 18);
        ctx.fillStyle = 'rgba(15, 34, 61, 0.94)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 24px system-ui, sans-serif';
        ctx.fillText(String(dlg.speaker || 'Professeur CIEL').slice(0, 48), 64, 122);

        if (dlg.stepBadge) {
          ctx.fillStyle = '#7dd3fc';
          ctx.font = 'bold 18px system-ui, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(String(dlg.stepBadge).slice(0, 28), canvasW - 64, 122);
          ctx.textAlign = 'left';
        }

        ctx.fillStyle = '#f1f5f9';
        ctx.font = '500 23px system-ui, sans-serif';
        const textLines = [];
        const rawParagraphs = Array.isArray(dlg.lines) ? dlg.lines : [String(dlg.text || '')];
        for (const para of rawParagraphs) {
          const wrapped = wrapTextLines(ctx, para, canvasW - 140, 5);
          textLines.push(...wrapped);
          if (textLines.length >= 10) break;
        }
        textLines.slice(0, 10).forEach((ln, idx) => {
          ctx.fillText(ln, 64, 174 + idx * 34);
        });

        if (Array.isArray(dlg.grades) && dlg.grades.length > 0) {
          const cols = 3;
          const cardW = 368;
          const cardH = 54;
          const startY = 420;
          dlg.grades.slice(0, 9).forEach((g, idx) => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            const gx = 64 + col * (cardW + 14);
            const gy = startY + row * (cardH + 10);
            roundRectPath(ctx, gx, gy, cardW, cardH, 10);
            ctx.fillStyle = g.hasGrade ? 'rgba(6, 78, 59, 0.72)' : 'rgba(30, 41, 59, 0.78)';
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = g.hasGrade ? '#34d399' : '#475569';
            ctx.stroke();
            ctx.fillStyle = '#e2e8f0';
            ctx.font = 'bold 17px system-ui, sans-serif';
            ctx.fillText(String(g.title || '').slice(0, 22), gx + 14, gy + 33);
            ctx.fillStyle = g.hasGrade ? '#6ee7b7' : '#94a3b8';
            ctx.textAlign = 'right';
            ctx.fillText(String(g.scoreText || '--/20'), gx + cardW - 14, gy + 33);
            ctx.textAlign = 'left';
          });
        }
      }

      const choices = Array.isArray(dlg.choices) ? dlg.choices : [];
      if (choices.length > 0) {
        const count = Math.min(6, choices.length);
        const cols = count <= 2 ? count : count <= 4 ? 2 : 3;
        const rows = Math.ceil(count / cols);
        const btnW = Math.floor((canvasW - 72 - (cols - 1) * 14) / cols);
        const btnH = rows > 1 ? 58 : 78;
        const baseY = rows > 1 ? 656 : 684;
        choices.slice(0, count).forEach((ch, idx) => {
          const c = idx % cols;
          const r = Math.floor(idx / cols);
          const bx = 36 + c * (btnW + 14);
          const by = baseY + r * (btnH + 10);
          addBtn(`vr_dlg_choice_${idx}`, bx, by, btnW, btnH, ch.label || `Choix ${idx + 1}`, {
            primary: Boolean(ch.primary),
            maxChars: cols === 3 ? 28 : 38,
            fontSize: cols === 3 ? 17 : 19,
            onClick: () => ch.onSelect?.()
          });
        });
      } else {
        addBtn('vr_dlg_next', 36, 684, 860, 78, dlg.nextLabel || 'Continuer ▶', {
          primary: true,
          maxChars: 34,
          fontSize: 22,
          onClick: () => dlg.onNext?.()
        });
        addBtn('vr_dlg_close', 916, 684, 328, 78, '✖ Fermer', {
          danger: true,
          fontSize: 21,
          onClick: handleExitAction
        });
      }

      if (texture) texture.needsUpdate = true;
      return;
    }

    if (mode === 'ascension' && state.ascension) {
      const asc = state.ascension;
      if (ctx) {
        roundRectPath(ctx, 36, 78, canvasW - 72, 360, 18);
        ctx.fillStyle = asc.phase === 'ascension' ? 'rgba(69, 26, 3, 0.90)' : 'rgba(15, 23, 42, 0.94)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#fbbf24';
        ctx.stroke();

        ctx.fillStyle = '#fde68a';
        ctx.font = 'bold 28px system-ui, sans-serif';
        ctx.fillText(String(asc.headline || '👑 DIEU DU BAC PRO CIEL').slice(0, 56), 64, 126);

        if (asc.countdownSec > 0 && asc.phase === 'dialogue') {
          ctx.fillStyle = '#f87171';
          ctx.font = 'bold 24px monospace';
          ctx.textAlign = 'right';
          ctx.fillText(`⏱️ ${asc.countdownSec}s`, canvasW - 64, 126);
          ctx.textAlign = 'left';
        }

        ctx.fillStyle = '#f8fafc';
        ctx.font = '500 22px system-ui, sans-serif';
        const speechLines = wrapTextLines(ctx, asc.speech || '', canvasW - 140, 4);
        speechLines.forEach((ln, idx) => {
          ctx.fillText(ln, 64, 174 + idx * 32);
        });

        if (Array.isArray(asc.collection) && asc.collection.length > 0) {
          const chipW = 224;
          asc.collection.slice(0, 5).forEach((item, idx) => {
            const cx = 64 + idx * (chipW + 10);
            const cy = 326;
            roundRectPath(ctx, cx, cy, chipW, 56, 12);
            ctx.fillStyle = item.unlocked ? 'rgba(6, 78, 59, 0.85)' : 'rgba(30, 41, 59, 0.72)';
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = item.unlocked ? '#34d399' : '#475569';
            ctx.stroke();
            ctx.fillStyle = item.unlocked ? '#6ee7b7' : '#94a3b8';
            ctx.font = 'bold 17px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(
              `${item.unlocked ? '✅' : '🔒'} ${String(item.label || item.id).slice(0, 16)}`,
              cx + chipW / 2,
              cy + 34
            );
            ctx.textAlign = 'left';
          });
        }

        if (asc.secretSkinUnlocked) {
          ctx.fillStyle = '#f0abfc';
          ctx.font = 'bold 22px system-ui, sans-serif';
          ctx.fillText('🌌 SKIN ULTIME DÉBLOQUÉ : Skin Suprême Glitch (5/5 Voies Divines)', 64, 416);
        }
      }

      const choices = Array.isArray(asc.choices) ? asc.choices : [];
      if (asc.phase === 'dialogue' && asc.isWinner && !asc.chosenSpecialty && choices.length > 0) {
        const count = Math.min(5, choices.length);
        const cardW = Math.floor((canvasW - 72 - (count - 1) * 14) / count);
        choices.slice(0, count).forEach((c, idx) => {
          const cx = 36 + idx * (cardW + 14);
          addBtn(`vr_asc_choice_${c.id}`, cx, 470, cardW, 270, `${c.icon || '✨'} ${c.label || c.id}`, {
            gold: true,
            maxChars: 22,
            fontSize: 20,
            onClick: () => asc.onChooseSpecialty?.(c.id)
          });
        });
      } else {
        if (asc.canApplaud && typeof asc.onApplaud === 'function') {
          addBtn('vr_asc_applaud', 36, 650, 740, 100, '👏 Applaudir l’Élu !', {
            gold: true,
            fontSize: 26,
            onClick: () => asc.onApplaud?.()
          });
          addBtn('vr_asc_close', 796, 650, 448, 100, '✖ Fermer', {
            danger: true,
            fontSize: 24,
            onClick: handleExitAction
          });
        } else {
          addBtn('vr_asc_close', 36, 650, canvasW - 72, 100, '🏫 Retour Atelier 3D / Continuer', {
            primary: true,
            fontSize: 24,
            onClick: handleExitAction
          });
        }
      }

      if (texture) texture.needsUpdate = true;
      return;
    }

    if (mode === 'result' && state.result) {
      const res = state.result;
      const numScore = Number(res.score || 0);
      const passed = numScore >= 10;
      const isPerfect = Boolean(res.isPerfect || numScore >= 20);
      if (ctx) {
        roundRectPath(ctx, 44, 78, canvasW - 88, 578, 22);
        ctx.fillStyle = isPerfect
          ? 'rgba(20, 62, 48, 0.94)'
          : passed
            ? 'rgba(6, 78, 59, 0.88)'
            : 'rgba(127, 29, 29, 0.82)';
        ctx.fill();
        ctx.lineWidth = isPerfect ? 4 : 3;
        ctx.strokeStyle = isPerfect ? '#fbbf24' : passed ? '#34d399' : '#fb7185';
        ctx.stroke();

        if (isPerfect) {
          roundRectPath(ctx, 370, 90, canvasW - 740, 34, 14);
          ctx.fillStyle = '#fbbf24';
          ctx.fill();
          ctx.textAlign = 'center';
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 19px system-ui, sans-serif';
          ctx.fillText('🏆 PARFAIT 20/20 — MAÎTRISE MAXIMALE', canvasW / 2, 113);
        }

        ctx.textAlign = 'center';
        ctx.fillStyle = isPerfect ? '#fde047' : '#f8fafc';
        ctx.font = 'bold 58px system-ui, sans-serif';
        ctx.fillText(`${numScore.toFixed(1)} / 20`, canvasW / 2, isPerfect ? 174 : 158);

        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 24px system-ui, sans-serif';
        const coinTxt = res.coinsBase > 0 ? ` • 🪙 +${res.coinsBase} CC` : '';
        ctx.fillText(
          `+${res.xp || 0} XP${coinTxt} • Temps : ${res.duration || '00:00'}`,
          canvasW / 2,
          isPerfect ? 214 : 200
        );

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '600 21px system-ui, sans-serif';
        ctx.fillText(`Professeur CIEL : ${res.mention || ''}`, canvasW / 2, isPerfect ? 248 : 236);

        const bd = res.breakdown;
        if (bd && Array.isArray(bd.items) && bd.items.length > 0) {
          const boxX = 76;
          const boxY = isPerfect ? 268 : 258;
          const boxW = canvasW - 152;
          const boxH = isPerfect ? 330 : 340;
          roundRectPath(ctx, boxX, boxY, boxW, boxH, 14);
          ctx.fillStyle = 'rgba(7, 15, 32, 0.84)';
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
          ctx.stroke();

          ctx.textAlign = 'left';
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 18px system-ui, sans-serif';
          ctx.fillText('📊 DÉTAIL DU BARÈME (/20)', boxX + 20, boxY + 28);

          const entries = [];
          for (const it of bd.items) {
            const icon = it.status === 'ok' ? '✅' : it.status === 'warn' ? '🟡' : '❌';
            const color = it.status === 'ok' ? '#6ee7b7' : it.status === 'warn' ? '#fde047' : '#fda4af';
            entries.push({
              text: `${icon} ${String(it.label || '').slice(0, 32)}`,
              pts: `${it.earned}/${it.max}`,
              color
            });
          }
          for (const p of bd.penalties || []) {
            const forgiven = p.points <= 0 && p.forgivenCount > 0;
            entries.push({
              text: `${forgiven ? '🎁' : '⚠️'} ${String(p.label || '').slice(0, 32)}`,
              pts: forgiven ? '0 pt' : `-${p.points}`,
              color: forgiven ? '#7dd3fc' : '#fb7185'
            });
          }
          if (bd.roundedTo20) {
            entries.push({
              text: `🎓 Arrondi généreux (${bd.rawScore})`,
              pts: '→ 20/20',
              color: '#fde047'
            });
          }

          const colW = (boxW - 56) / 2;
          const rowStartY = boxY + 56;
          const maxRows = 10;
          entries.slice(0, maxRows).forEach((en, idx) => {
            const col = idx % 2;
            const row = Math.floor(idx / 2);
            const ex = boxX + 20 + col * (colW + 16);
            const ey = rowStartY + row * 44;
            roundRectPath(ctx, ex, ey - 22, colW, 36, 8);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.fill();
            ctx.fillStyle = '#e2e8f0';
            ctx.font = '600 16px system-ui, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(en.text, ex + 10, ey + 2);
            ctx.fillStyle = en.color;
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(en.pts, ex + colW - 10, ey + 2);
          });
          ctx.textAlign = 'left';

          if (!isPerfect && bd.tip) {
            ctx.fillStyle = '#fde68a';
            ctx.font = 'bold 17px system-ui, sans-serif';
            ctx.fillText(`💡 Pour décrocher 20/20 : ${String(bd.tip).slice(0, 74)}`, boxX + 20, boxY + boxH - 18);
          }
        } else {
          const summaryLines = Array.isArray(res.summaryLines) ? res.summaryLines : [];
          ctx.textAlign = 'left';
          ctx.fillStyle = '#cbd5e1';
          ctx.font = '500 20px system-ui, sans-serif';
          summaryLines.slice(0, 7).forEach((ln, idx) => {
            ctx.fillText(`• ${String(ln).slice(0, 90)}`, 86, 312 + idx * 38);
          });
        }

        if (res.all20Unlocked) {
          ctx.textAlign = 'center';
          ctx.fillStyle = '#fde68a';
          ctx.font = 'bold 23px system-ui, sans-serif';
          ctx.fillText('👑 20/20 SUR TOUS LES TPs — CÉRÉMONIE D’ASCENSION DÉBLOQUÉE !', canvasW / 2, 634);
          ctx.textAlign = 'left';
        }
      }

      addBtn('vr_tp_replay', 200, 676, 400, 88, '🔄 Refaire le TP', {
        primary: false,
        fontSize: 24,
        onClick: () => res.onReplay?.()
      });
      addBtn('vr_tp_done', 640, 676, 440, 88, '🏫 Retour Atelier 3D', {
        primary: true,
        fontSize: 24,
        onClick: () => res.onExit?.()
      });
      if (texture) texture.needsUpdate = true;
      return;
    }

    if (mode === 'survival_intro' && state.survivalIntro) {
      const si = state.survivalIntro;
      const prog = Math.max(0, Math.min(1, Number(si.progress) || 0));
      if (ctx) {
        roundRectPath(ctx, 36, 78, canvasW - 72, 558, 22);
        ctx.fillStyle = 'rgba(28, 6, 12, 0.94)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ef4444';
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = '#fb7185';
        ctx.font = 'bold 30px system-ui, sans-serif';
        ctx.fillText(
          String(si.phaseLabel || '⚡ COUPURE ÉLECTRIQUE — ALERTE INTRUSION').slice(0, 56),
          canvasW / 2,
          152
        );

        ctx.fillStyle = '#fecdd3';
        ctx.font = 'bold 34px system-ui, sans-serif';
        ctx.fillText('LA TRAQUE DU PROFESSEUR CIEL COMMENCE', canvasW / 2, 232);

        ctx.fillStyle = '#fef08a';
        ctx.font = '600 26px system-ui, sans-serif';
        const lines = wrapTextLines(
          ctx,
          si.briefingText || 'Survivez, terminez tous les TPs et ne faites aucun bruit au micro...',
          canvasW - 180,
          3
        );
        lines.forEach((ln, idx) => {
          ctx.fillText(ln, canvasW / 2, 316 + idx * 42);
        });

        roundRectPath(ctx, 140, 488, canvasW - 280, 34, 14);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2;
        ctx.stroke();

        roundRectPath(ctx, 144, 492, Math.max(16, Math.round((canvasW - 288) * prog)), 26, 10);
        ctx.fillStyle = '#ef4444';
        ctx.fill();

        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 20px system-ui, sans-serif';
        ctx.fillText(
          'Cachez-vous dans les baies de brassage et surveillez votre micro !',
          canvasW / 2,
          574
        );
        ctx.textAlign = 'left';
      }

      addBtn('vr_surv_intro_skip', 360, 664, canvasW - 720, 96, '⏭️ Passer / Commencer', {
        primary: true,
        fontSize: 25,
        onClick: () => si.onSkip?.()
      });

      if (texture) texture.needsUpdate = true;
      return;
    }

    if (mode === 'survival_lobby' && state.survivalLobby) {
      const sl = state.survivalLobby;
      const players = Array.isArray(sl.players) ? sl.players : [];
      const minP = Math.max(1, Number(sl.minPlayers) || 1);
      const readyCnt = Number(sl.readyCount) || 0;
      const count = players.length;

      if (ctx) {
        roundRectPath(ctx, 36, 78, canvasW - 72, 560, 20);
        ctx.fillStyle = 'rgba(24, 10, 18, 0.94)';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#e11d48';
        ctx.stroke();

        ctx.fillStyle = '#fda4af';
        ctx.font = 'bold 24px system-ui, sans-serif';
        ctx.fillText(
          `Objectif : Terminer 100% des TPs sans vous faire attraper par le Professeur CIEL`,
          64,
          122
        );

        ctx.fillStyle = count >= minP ? '#6ee7b7' : '#fbbf24';
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.fillText(
          String(
            sl.statusText ||
              `Joueurs : ${count} (min. ${minP} requis) • Prêts : ${readyCnt}/${count}`
          ).slice(0, 72),
          64,
          164
        );

        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 18px system-ui, sans-serif';
        ctx.fillText(
          'Attention : Le Professeur CIEL écoute votre microphone à travers les cloisons. Cachez-vous dans les baies de brassage.',
          64,
          198
        );

        players.slice(0, 6).forEach((pl, idx) => {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const bx = 64 + col * 586;
          const by = 224 + row * 124;
          roundRectPath(ctx, bx, by, 562, 106, 14);
          ctx.fillStyle = pl.ready ? 'rgba(6, 78, 59, 0.85)' : 'rgba(30, 41, 59, 0.9)';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = pl.ready ? '#34d399' : '#64748b';
          ctx.stroke();

          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 24px system-ui, sans-serif';
          ctx.fillText(String(pl.name || 'Élève').slice(0, 22), bx + 24, by + 46);

          ctx.fillStyle = pl.ready ? '#6ee7b7' : '#cbd5e1';
          ctx.font = 'bold 20px system-ui, sans-serif';
          ctx.fillText(pl.ready ? '✅ PRÊT POUR LA TRAQUE' : '⏳ EN ATTENTE', bx + 24, by + 82);
        });
      }

      addBtn(
        'vr_surv_ready',
        36,
        662,
        460,
        106,
        sl.localReady ? '⏳ Annuler Prêt' : '⚔️ JE SUIS PRÊT !',
        {
          primary: !sl.localReady,
          active: sl.localReady,
          fontSize: 26,
          onClick: () => sl.onToggleReady?.()
        }
      );
      addBtn(
        'vr_surv_mic',
        516,
        662,
        350,
        106,
        sl.micEnabled ? '🎙️ Micro ON' : '🔇 Micro OFF',
        {
          active: sl.micEnabled,
          fontSize: 23,
          onClick: () => sl.onToggleMic?.()
        }
      );
      addBtn('vr_surv_leave', 886, 662, 358, 106, '🚪 Retour Atelier', {
        danger: true,
        fontSize: 23,
        onClick: () => sl.onLeave?.()
      });

      if (texture) texture.needsUpdate = true;
      return;
    }

    if (mode === 'survival_hidden' && state.survivalHidden) {
      const sh = state.survivalHidden;
      const noise = Math.max(0, Math.min(1, Number(sh.noiseLevel) || 0));

      if (ctx) {
        roundRectPath(ctx, 36, 448, canvasW - 72, 328, 22);
        ctx.fillStyle = 'rgba(7, 13, 24, 0.86)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = noise >= 0.28 ? '#ef4444' : '#38bdf8';
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = noise >= 0.28 ? '#fca5a5' : '#e2e8f0';
        ctx.font = 'bold 28px system-ui, sans-serif';
        ctx.fillText(
          noise >= 0.28
            ? '⚠️ BRUIT MICRO DÉTECTÉ — LE PROFESSEUR APPROCHE !'
            : `🤫 BAIE PERFORÉE — ${String(sh.aiStateLabel || sh.aiState || 'Patrouille').toUpperCase()} • TPs ${sh.completedTps || 0}/${sh.totalTps || 5}`,
          canvasW / 2,
          500
        );

        ctx.textAlign = 'left';
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 21px system-ui, sans-serif';
        ctx.fillText(`Micro RMS : ${Math.round(noise * 100)}% (Seuil 28%) • Regardez dehors par les fentes !`, 84, 548);

        roundRectPath(ctx, 84, 566, canvasW - 168, 38, 12);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#475569';
        ctx.stroke();

        const barW = Math.max(12, Math.round((canvasW - 176) * noise));
        roundRectPath(ctx, 88, 570, barW, 30, 8);
        ctx.fillStyle = noise >= 0.48 ? '#ef4444' : noise >= 0.28 ? '#f59e0b' : '#22c55e';
        ctx.fill();

        const threshX = 88 + Math.round((canvasW - 176) * 0.28);
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(threshX, 560);
        ctx.lineTo(threshX, 610);
        ctx.stroke();
      }

      addBtn(
        'vr_hide_mic',
        84,
        636,
        540,
        104,
        sh.micEnabled ? '🎙️ Couper Micro (Silence)' : '🔇 Activer Micro',
        {
          primary: !sh.micEnabled,
          danger: sh.micEnabled && noise >= 0.28,
          fontSize: 24,
          onClick: () => sh.onToggleMic?.()
        }
      );
      addBtn('vr_hide_exit', 656, 636, 540, 104, '🚪 Sortir de la Baie de Brassage', {
        primary: true,
        fontSize: 24,
        onClick: () => sh.onExitRack?.()
      });

      if (texture) texture.needsUpdate = true;
      return;
    }

    if (mode === 'jumpscare') {
      const js = state.jumpscare || {};
      if (ctx) {
        roundRectPath(ctx, 20, 74, canvasW - 40, canvasH - 96, 24);
        ctx.fillStyle = '#2a0408';
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#ef4444';
        ctx.stroke();

        const cx = canvasW / 2;
        const cy = 340;
        ctx.fillStyle = '#f1f5f9';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 130, 165, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#09090b';
        ctx.beginPath();
        ctx.arc(cx - 48, cy - 34, 28, 0, Math.PI * 2);
        ctx.arc(cx + 48, cy - 34, 28, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(cx - 48, cy - 34, 14, 0, Math.PI * 2);
        ctx.arc(cx + 48, cy - 34, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx - 48, cy - 34, 4, 0, Math.PI * 2);
        ctx.arc(cx + 48, cy - 34, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#09090b';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 72, 62, 48, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.textAlign = 'center';
        ctx.fillStyle = '#fecaca';
        ctx.font = 'bold 46px system-ui, sans-serif';
        ctx.fillText(js.title || '☠️ PROFESSEUR CIEL VOUS A ATTRAPÉ !', cx, 610);
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 28px system-ui, sans-serif';
        ctx.fillText(js.subtitle || 'Téléportation en Salle d’Heure de Colle...', cx, 672);
        ctx.textAlign = 'left';
      }
      if (texture) texture.needsUpdate = true;
      return;
    }

    if (mode === 'detention' && state.detention) {
      const dtState = state.detention;
      const ex = dtState.exercise || {};
      const tbl = ex.table || {};
      const xs = Array.isArray(tbl.xs) ? tbl.xs : ['-∞', '0', '+∞'];
      const signs = Array.isArray(tbl.signs) ? tbl.signs : ['-', '0', '+'];
      const arrows = Array.isArray(tbl.arrows) ? tbl.arrows : ['↘', '0', '↗'];
      const opts = Array.isArray(ex.options) ? ex.options : [];

      if (ctx) {
        roundRectPath(ctx, 36, 76, 740, 48, 12);
        ctx.fillStyle = 'rgba(42, 18, 10, 0.94)';
        ctx.fill();
        ctx.fillStyle = '#fdba74';
        ctx.font = 'bold 19px system-ui, sans-serif';
        ctx.fillText(
          `📝 Résolus : ${dtState.solvedCount || 0} • Surv.: ${dtState.survivorsCount ?? '?'} • TPs: ${dtState.completedTps || 0}/${dtState.totalTps || 5} • 📹 ${String(dtState.camLabel || 'POV Live').slice(0, 22)}`,
          52,
          107
        );

        roundRectPath(ctx, 36, 136, canvasW - 72, 336, 18);
        ctx.fillStyle = 'rgba(12, 24, 44, 0.95)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fb923c';
        ctx.stroke();

        ctx.fillStyle = '#fde68a';
        ctx.font = 'bold 23px system-ui, sans-serif';
        ctx.fillText(`${ex.fxLabel || 'f(x)'}   |   ${ex.fPrimeLabel || "f'(x)"}`, 60, 174);

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.fillText(String(ex.question || 'Complétez le tableau de variations :').slice(0, 74), 60, 212);

        const tx = 60;
        const ty = 232;
        const tw = canvasW - 120;
        const colW = (tw - 130) / Math.max(1, xs.length);
        const rowH = 54;

        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.strokeRect(tx, ty, tw, rowH * 3);
        ctx.beginPath();
        ctx.moveTo(tx + 130, ty);
        ctx.lineTo(tx + 130, ty + rowH * 3);
        ctx.moveTo(tx, ty + rowH);
        ctx.lineTo(tx + tw, ty + rowH);
        ctx.moveTo(tx, ty + rowH * 2);
        ctx.lineTo(tx + tw, ty + rowH * 2);
        ctx.stroke();

        ctx.fillStyle = '#93c5fd';
        ctx.font = 'bold 20px monospace';
        ctx.fillText('x', tx + 44, ty + 35);
        ctx.fillText("f'(x)", tx + 28, ty + rowH + 35);
        ctx.fillText('f(x)', tx + 34, ty + rowH * 2 + 35);

        ctx.textAlign = 'center';
        xs.forEach((xv, i) => {
          const cx = tx + 130 + colW * (i + 0.5);
          ctx.fillStyle = '#f8fafc';
          ctx.fillText(String(xv).slice(0, 8), cx, ty + 35);
        });
        const sStep = (tw - 130) / Math.max(1, signs.length);
        signs.forEach((sv, i) => {
          const cx = tx + 130 + sStep * (i + 0.5);
          ctx.fillStyle = sv === '?' ? '#fbbf24' : sv === '+' ? '#34d399' : sv === '-' ? '#f87171' : '#cbd5e1';
          ctx.fillText(String(sv).slice(0, 6), cx, ty + rowH + 35);
        });
        const aStep = (tw - 130) / Math.max(1, arrows.length);
        arrows.forEach((av, i) => {
          const cx = tx + 130 + aStep * (i + 0.5);
          ctx.fillStyle = av === '?' ? '#fbbf24' : '#38bdf8';
          ctx.fillText(String(av).slice(0, 8), cx, ty + rowH * 2 + 35);
        });
        ctx.textAlign = 'left';

        ctx.fillStyle = dtState.lastCorrect === false ? '#fda4af' : '#6ee7b7';
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.fillText(
          String(
            dtState.feedback ||
              'Résolvez un tableau pour envoyer une impulsion radar aux survivants !'
          ).slice(0, 88),
          60,
          444
        );
      }

      addBtn('vr_dt_cam_prev', 788, 76, 222, 48, '◀ Cam. Préc.', {
        fontSize: 18,
        onClick: () => dtState.onPrevCamera?.()
      });
      addBtn('vr_dt_cam_next', 1022, 76, 222, 48, 'Cam. Suiv. ▶', {
        fontSize: 18,
        onClick: () => dtState.onNextCamera?.()
      });

      opts.slice(0, 4).forEach((optText, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const bx = 36 + col * 612;
        const by = 492 + row * 142;
        const letter = ['A', 'B', 'C', 'D'][idx];
        addBtn(`vr_dt_opt_${idx}`, bx, by, 596, 126, `${letter}) ${String(optText)}`, {
          primary: false,
          maxChars: 72,
          fontSize: 16,
          onClick: () => dtState.onSelectOption?.(idx)
        });
      });

      if (texture) texture.needsUpdate = true;
      return;
    }

    if (mode === 'survival_end' && state.survivalEnd) {
      const se = state.survivalEnd;
      const win = Boolean(se.victory);
      if (ctx) {
        roundRectPath(ctx, 44, 78, canvasW - 88, 566, 22);
        ctx.fillStyle = win ? 'rgba(6, 78, 59, 0.92)' : 'rgba(69, 10, 10, 0.94)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = win ? '#34d399' : '#f87171';
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = win ? '#fde68a' : '#fecaca';
        ctx.font = 'bold 52px system-ui, sans-serif';
        ctx.fillText(
          win ? '🏆 TOUS LES TPs TERMINÉS !' : '💀 CLASSE EN HEURE DE COLLE',
          canvasW / 2,
          184
        );

        ctx.fillStyle = '#f8fafc';
        ctx.font = '600 28px system-ui, sans-serif';
        ctx.fillText(String(se.reason || '').slice(0, 68), canvasW / 2, 256);

        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 26px system-ui, sans-serif';
        ctx.fillText(
          `TPs complétés : ${se.completedTps || 0}/${se.totalTps || 5} • Durée : ${se.durationSec || 0}s`,
          canvasW / 2,
          346
        );
        ctx.fillText(
          `Survivants : ${se.survivorsCount ?? 0} • Élèves collés : ${se.detainedCount ?? 0}`,
          canvasW / 2,
          404
        );
        ctx.textAlign = 'left';
      }

      addBtn('vr_surv_end_ok', 280, 666, canvasW - 560, 102, '🏫 Retourner au Hall Principal', {
        primary: true,
        fontSize: 28,
        onClick: () => se.onContinue?.()
      });

      if (texture) texture.needsUpdate = true;
      return;
    }

    if (mode === 'combat_lobby' && state.combatLobby) {
      const cl = state.combatLobby;
      const combatMode = cl.mode === 'melee' ? 'melee' : 'guns';
      const botsEnabled = cl.botsEnabled !== undefined ? Boolean(cl.botsEnabled) : cl.fillBots !== false;
      const weapons = Array.isArray(cl.weapons) ? cl.weapons : [];
      const players = Array.isArray(cl.players) ? cl.players : [];

      addBtn('vr_cbt_mode_guns', 36, 78, 390, 74, '🔫 Mode Fusils', {
        active: combatMode === 'guns',
        fontSize: 23,
        onClick: () => cl.onSelectMode?.('guns')
      });
      addBtn('vr_cbt_mode_melee', 442, 78, 390, 74, '⚔️ Mode Mêlée', {
        active: combatMode === 'melee',
        fontSize: 23,
        onClick: () => cl.onSelectMode?.('melee')
      });
      addBtn('vr_cbt_bots', 848, 78, 396, 74, botsEnabled ? '🤖 Bots IA : ACTIVÉS' : '🤖 Bots IA : DÉSACTIVÉS', {
        active: botsEnabled,
        danger: !botsEnabled,
        fontSize: 21,
        onClick: () => cl.onToggleBots?.()
      });

      weapons.slice(0, 4).forEach((w, idx) => {
        const bx = 36 + idx * 304;
        addBtn(
          `vr_cbt_w_${w.id}`,
          bx,
          172,
          288,
          136,
          `${w.icon} ${w.shortName}`,
          {
            active: w.id === cl.selectedWeaponId,
            maxChars: 18,
            fontSize: 21,
            onClick: () => cl.onSelectWeapon?.(w.id)
          }
        );
      });

      if (ctx) {
        roundRectPath(ctx, 36, 328, canvasW - 72, 304, 18);
        ctx.fillStyle = 'rgba(6, 16, 34, 0.92)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#22d3ee';
        ctx.stroke();

        ctx.fillStyle = botsEnabled ? '#6ee7b7' : '#fca5a5';
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.fillText(
          `Mode ${combatMode === 'melee' ? 'Mêlée ⚔️' : 'Fusils 🔫'} • ${botsEnabled ? 'Bots IA : ACTIVÉS (3+ bots)' : 'Bots IA : DÉSACTIVÉS (0 bot — Solo / PvP Pur)'}`,
          62,
          368
        );

        players.slice(0, 4).forEach((pl, idx) => {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const px = 62 + col * 580;
          const py = 398 + row * 102;
          roundRectPath(ctx, px, py, 556, 86, 12);
          ctx.fillStyle = pl.ready ? 'rgba(6, 78, 59, 0.85)' : 'rgba(30, 41, 59, 0.9)';
          ctx.fill();
          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 22px system-ui, sans-serif';
          ctx.fillText(`${String(pl.name || 'Élève').slice(0, 20)} ${pl.ready ? '✅ PRÊT' : '⏳'}`, px + 20, py + 50);
        });
      }

      addBtn(
        'vr_cbt_ready',
        36,
        662,
        780,
        106,
        cl.localReady ? '⏳ Annuler Prêt' : '⚔️ PRÊT — ENTRER DANS L’ARÈNE !',
        {
          primary: !cl.localReady,
          active: cl.localReady,
          fontSize: 26,
          onClick: () => cl.onToggleReady?.()
        }
      );
      addBtn('vr_cbt_leave', 836, 662, 408, 106, '🚪 Quitter Lobby', {
        danger: true,
        fontSize: 24,
        onClick: () => cl.onLeave?.()
      });

      if (texture) texture.needsUpdate = true;
      return;
    }

    if (mode === 'combat_end' && state.combatEnd) {
      const ce = state.combatEnd;
      const won = Boolean(ce.won);
      if (ctx) {
        roundRectPath(ctx, 44, 78, canvasW - 88, 556, 22);
        ctx.fillStyle = won ? 'rgba(6, 78, 59, 0.92)' : 'rgba(15, 23, 42, 0.94)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = won ? '#fbbf24' : '#38bdf8';
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = won ? '#fde047' : '#bae6fd';
        ctx.font = 'bold 46px system-ui, sans-serif';
        ctx.fillText(won ? '🏆 VICTOIRE ARÈNE CIEL !' : '⚔️ FIN DE LA MANCHE', canvasW / 2, 146);

        ctx.fillStyle = '#f8fafc';
        ctx.font = '600 24px system-ui, sans-serif';
        ctx.fillText(String(ce.reason || '').slice(0, 62), canvasW / 2, 194);

        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 28px system-ui, sans-serif';
        ctx.fillText(`🪙 +${Math.max(0, Math.round(Number(ce.coinsEarned) || 0))} CIEL Coins gagnés`, canvasW / 2, 242);
        ctx.textAlign = 'left';

        const rows = Array.isArray(ce.scoreboard) ? ce.scoreboard.slice(0, 5) : [];
        rows.forEach((r, idx) => {
          const ry = 278 + idx * 64;
          roundRectPath(ctx, 96, ry, canvasW - 192, 54, 10);
          ctx.fillStyle = idx === 0 ? 'rgba(14, 116, 144, 0.5)' : 'rgba(30, 41, 59, 0.85)';
          ctx.fill();
          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 22px system-ui, sans-serif';
          ctx.fillText(`#${idx + 1} ${String(r.name || '').slice(0, 22)}`, 122, ry + 34);
          ctx.textAlign = 'right';
          ctx.fillStyle = '#34d399';
          ctx.fillText(`⚔️ ${r.kills || 0} / 💀 ${r.deaths || 0}`, canvasW - 122, ry + 34);
          ctx.textAlign = 'left';
        });
      }

      addBtn('vr_cbt_replay', 84, 662, 520, 102, '🔄 Rejouer une Manche', {
        primary: true,
        fontSize: 26,
        onClick: () => ce.onReplay?.()
      });
      addBtn('vr_cbt_exit', 636, 662, 560, 102, '🏫 Retourner au Hall', {
        danger: true,
        fontSize: 26,
        onClick: () => ce.onExit?.()
      });

      if (texture) texture.needsUpdate = true;
      return;
    }

    let cursorY = 72;

    const camList = Array.isArray(state.cameras) ? state.cameras : [];
    const activeCamLabel = camList[state.activeCamIdx]?.label || 'Vue Globale';
    const camBarW = 468;
    const stageAreaW = canvasW - 48 - camBarW - 14;

    if (state.stages.length > 0) {
      const count = Math.min(4, state.stages.length);
      const pillW = Math.floor((stageAreaW - (count - 1) * 8) / count);
      state.stages.slice(0, count).forEach((st, idx) => {
        const lbl =
          typeof st === 'string'
            ? st
            : st?.score != null
              ? `${st.name} (${st.score})`
              : st?.name || `Étape ${idx + 1}`;
        addBtn(`vr_stage_${idx}`, 24 + idx * (pillW + 8), cursorY, pillW, 38, lbl, {
          active: idx === state.activeStageIdx,
          maxChars: 18,
          fontSize: 16,
          onClick: () => state.onSelectStage?.(idx)
        });
      });
    }

    const camBaseX = canvasW - 24 - camBarW;
    addBtn('vr_cam_next', camBaseX, cursorY, 210, 38, `📷 ${activeCamLabel}`, {
      active: camList.length > 1,
      disabled: camList.length === 0 && typeof state.onSelectCamera !== 'function',
      maxChars: 18,
      fontSize: 15,
      onClick: () => state.onSelectCamera?.((state.activeCamIdx + 1) % Math.max(1, camList.length))
    });
    addBtn('vr_zoom_out', camBaseX + 216, cursorY, 68, 38, '🔍−', {
      maxChars: 6,
      fontSize: 16,
      onClick: () => state.onAdjustZoom?.(0.24)
    });
    addBtn('vr_zoom_in', camBaseX + 290, cursorY, 68, 38, '🔍+', {
      maxChars: 6,
      fontSize: 16,
      onClick: () => state.onAdjustZoom?.(-0.24)
    });
    addBtn('vr_orbit_cw', camBaseX + 364, cursorY, 104, 38, '↻ Pivot', {
      maxChars: 10,
      fontSize: 16,
      onClick: () => state.onAdjustOrbit?.(0.52)
    });

    cursorY += 46;

    if (ctx) {
      roundRectPath(ctx, 24, cursorY, canvasW - 48, 104, 14);
      ctx.fillStyle = 'rgba(15, 34, 61, 0.94)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText(`${state.badge} — ${state.briefTitle}`.slice(0, 74), 42, cursorY + 28);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '500 18px system-ui, sans-serif';
      const subLines = wrapTextLines(ctx, state.briefSub, canvasW - 96, 2);
      subLines.forEach((ln, i) => {
        ctx.fillText(ln, 42, cursorY + 55 + i * 22);
      });

      if (state.hoverLabel || state.toastText) {
        ctx.fillStyle = state.hoverLabel ? '#34d399' : '#7dd3fc';
        ctx.font = 'bold 16px system-ui, sans-serif';
        const statusLine = state.hoverLabel ? `🎯 Cible : ${state.hoverLabel}` : `💬 ${state.toastText}`;
        ctx.fillText(statusLine.slice(0, 88), 42, cursorY + 98);
      }
    }

    cursorY += 112;

    if (state.tools.length > 0) {
      const shownTools = state.tools.slice(0, 10);
      const cols = Math.min(5, shownTools.length);
      const rows = Math.ceil(shownTools.length / 5);
      const rowH = rows > 1 ? 38 : 44;
      shownTools.forEach((t, idx) => {
        const row = Math.floor(idx / 5);
        const col = idx % 5;
        const rowCount = row === rows - 1 ? shownTools.length - row * 5 : cols;
        const tW = Math.floor((canvasW - 48 - (rowCount - 1) * 8) / rowCount);
        const bx = 24 + col * (tW + 8);
        const by = cursorY + row * (rowH + 6);
        addBtn(`vr_tool_${t.id}`, bx, by, tW, rowH, `${t.icon || ''} ${t.label || ''}`.trim(), {
          active: t.id === state.activeToolId,
          disabled: Boolean(t.disabled),
          maxChars: 22,
          fontSize: 16,
          onClick: () => state.onSelectTool?.(t.id)
        });
      });
      cursorY += rows * (rowH + 6) + 4;
    }

    if (state.actions.length > 0) {
      const aCount = Math.min(5, state.actions.length);
      const aW = Math.floor((canvasW - 48 - (aCount - 1) * 8) / aCount);
      state.actions.slice(0, aCount).forEach((a, idx) => {
        addBtn(`vr_act_${idx}`, 24 + idx * (aW + 8), cursorY, aW, 44, a.label || 'Action', {
          primary: Boolean(a.primary),
          danger: Boolean(a.danger),
          disabled: Boolean(a.disabled),
          maxChars: 24,
          fontSize: 16,
          onClick: () => a.onClick?.()
        });
      });
      cursorY += 52;
    }

    const allSliders = [];
    const allButtons = [];
    const seenIds = new Set();

    const pushSlider = (s) => {
      const sid = s.id || `sl_${allSliders.length}`;
      if (seenIds.has(sid)) return;
      seenIds.add(sid);
      allSliders.push(s);
    };
    const pushBtn = (b) => {
      const bid = b.id || b.label || `bt_${allButtons.length}`;
      if (seenIds.has(`btn_${bid}`)) return;
      seenIds.add(`btn_${bid}`);
      allButtons.push(b);
    };

    for (const s of state.vrSliders || []) pushSlider(s);
    for (const dc of state.drawerControls || []) {
      if (dc?.kind === 'slider') pushSlider(dc);
      else if (dc) pushBtn(dc);
    }
    for (const vb of state.vrButtons || []) pushBtn(vb);

    const hasKeyboardContext = Boolean(state.textInput) || (state.cliPresets && state.cliPresets.length > 0);
    const activeTab = state.activeTab === 'keyboard' && hasKeyboardContext ? 'keyboard' : 'controls';

    const headerY = cursorY;
    if (ctx) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 15px system-ui, sans-serif';
      const titleStr =
        state.statusLines?.[0] ||
        (activeTab === 'keyboard'
          ? 'TERMINAL & CLAVIER SPATIAL VR'
          : 'COMMANDES & RÉGLAGES PAILLASSE VR');
      ctx.fillText(String(titleStr).slice(0, 58), 26, headerY + 21);
    }

    if (hasKeyboardContext) {
      addBtn('vr_tab_controls', 736, headerY, 176, 32, '🎛️ Contrôles', {
        active: activeTab === 'controls',
        fontSize: 15,
        onClick: () => {
          state.activeTab = 'controls';
          redraw();
        }
      });
      addBtn('vr_tab_keyboard', 920, headerY, 196, 32, '⌨️ Clavier / CLI', {
        active: activeTab === 'keyboard',
        fontSize: 15,
        onClick: () => {
          state.activeTab = 'keyboard';
          redraw();
        }
      });
    }

    const bodyY = headerY + 38;
    const availH = canvasH - 18 - bodyY;

    if (activeTab === 'keyboard' && hasKeyboardContext) {
      const termLines = Array.isArray(state.terminalLines) ? state.terminalLines.slice(-2) : [];
      if (ctx) {
        roundRectPath(ctx, 24, bodyY, canvasW - 48, 56, 10);
        ctx.fillStyle = '#020617';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#334155';
        ctx.stroke();
        ctx.fillStyle = '#34d399';
        ctx.font = '15px monospace';
        termLines.forEach((ln, i) => {
          ctx.fillText(String(ln).slice(0, 96), 36, bodyY + 21 + i * 22);
        });
        if (termLines.length === 0) {
          ctx.fillStyle = '#64748b';
          ctx.fillText('Prêt pour saisie commande / adresse IP en VR...', 36, bodyY + 33);
        }
      }

      const inputY = bodyY + 62;
      if (ctx) {
        roundRectPath(ctx, 24, inputY, canvasW - 224, 42, 10);
        ctx.fillStyle = '#091529';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#38bdf8';
        ctx.stroke();
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 20px monospace';
        const valShow = String(state.textInput?.value || '');
        ctx.fillText(`> ${valShow.slice(-56)}_`, 38, inputY + 27);
      }
      addBtn('vr_kbd_submit_top', canvasW - 190, inputY, 166, 42, 'ENTRÉE ↵', {
        primary: true,
        fontSize: 17,
        onClick: () => submitTextInput()
      });

      const presets = Array.isArray(state.cliPresets) ? state.cliPresets.slice(0, 5) : [];
      let kbdStartY = inputY + 48;
      if (presets.length > 0) {
        const pW = Math.floor((canvasW - 48 - (presets.length - 1) * 8) / presets.length);
        presets.forEach((p, idx) => {
          const pLabel = typeof p === 'string' ? p : p.label || p.cmd;
          const pCmd = typeof p === 'string' ? p : p.cmd || p.label;
          addBtn(`vr_preset_${idx}`, 24 + idx * (pW + 8), kbdStartY, pW, 36, pLabel, {
            active: false,
            maxChars: 20,
            fontSize: 14,
            onClick: () => {
              if (p?.submit !== false) submitTextInput(pCmd);
              else setTextInputValue(pCmd);
            }
          });
        });
        kbdStartY += 42;
      }

      const keyRows = [
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '.', '/'],
        ['a', 'z', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '-', ':'],
        ['q', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', '_']
      ];
      const keyH = Math.min(44, Math.max(34, Math.floor((canvasH - 18 - kbdStartY - 18) / 4)));
      keyRows.forEach((rowKeys, rIdx) => {
        const kW = Math.floor((canvasW - 48 - (rowKeys.length - 1) * 6) / rowKeys.length);
        const ry = kbdStartY + rIdx * (keyH + 5);
        rowKeys.forEach((ch, cIdx) => {
          const out = state.keyboardShift ? ch.toUpperCase() : ch;
          addBtn(`vr_kbd_${out}`, 24 + cIdx * (kW + 6), ry, kW, keyH, out, {
            maxChars: 4,
            fontSize: 18,
            onClick: () => appendTextInput(out)
          });
        });
      });

      const lastRowY = kbdStartY + 3 * (keyH + 5);
      const bottomKeys = [
        { id: 'shift', label: state.keyboardShift ? 'MAJ ▲' : 'maj △', w: 96, active: state.keyboardShift, fn: () => { state.keyboardShift = !state.keyboardShift; redraw(); } },
        { id: 'w', label: state.keyboardShift ? 'W' : 'w', w: 72, ch: state.keyboardShift ? 'W' : 'w' },
        { id: 'x', label: state.keyboardShift ? 'X' : 'x', w: 72, ch: state.keyboardShift ? 'X' : 'x' },
        { id: 'c', label: state.keyboardShift ? 'C' : 'c', w: 72, ch: state.keyboardShift ? 'C' : 'c' },
        { id: 'v', label: state.keyboardShift ? 'V' : 'v', w: 72, ch: state.keyboardShift ? 'V' : 'v' },
        { id: 'b', label: state.keyboardShift ? 'B' : 'b', w: 72, ch: state.keyboardShift ? 'B' : 'b' },
        { id: 'n', label: state.keyboardShift ? 'N' : 'n', w: 72, ch: state.keyboardShift ? 'N' : 'n' },
        { id: 'space', label: 'ESPACE', w: 230, ch: ' ' },
        { id: 'bksp', label: '⌫', w: 110, fn: () => setTextInputValue(String(state.textInput?.value || '').slice(0, -1)) },
        { id: 'clear', label: 'VIDER', w: 120, danger: true, fn: () => setTextInputValue('') },
        { id: 'enter', label: 'VALIDER ↵', w: 170, primary: true, fn: () => submitTextInput() }
      ];
      let kx = 24;
      for (const bk of bottomKeys) {
        addBtn(`vr_kbd_${bk.id}`, kx, lastRowY, bk.w, keyH, bk.label, {
          active: Boolean(bk.active),
          primary: Boolean(bk.primary),
          danger: Boolean(bk.danger),
          maxChars: 12,
          fontSize: 16,
          onClick: bk.fn || (() => appendTextInput(bk.ch))
        });
        kx += bk.w + 6;
      }
    } else {
      const slidersPerPage = allButtons.length > 0 ? 3 : 5;
      const buttonsPerPage = allSliders.length > 0 ? 8 : 12;
      const sliderPages = Math.max(1, Math.ceil(allSliders.length / slidersPerPage));
      const buttonPages = Math.max(1, Math.ceil(allButtons.length / buttonsPerPage));
      const totalPages = Math.max(sliderPages, buttonPages);
      const page = Math.min(state.drawerPage || 0, totalPages - 1);
      state.drawerPage = page;

      if (totalPages > 1) {
        addBtn('vr_drawer_prev', 1124, headerY, 42, 32, '◀', {
          disabled: page <= 0,
          fontSize: 16,
          onClick: () => {
            state.drawerPage = Math.max(0, page - 1);
            redraw();
          }
        });
        if (ctx) {
          ctx.fillStyle = '#cbd5e1';
          ctx.font = 'bold 15px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${page + 1}/${totalPages}`, 1190, headerY + 21);
          ctx.textAlign = 'left';
        }
        addBtn('vr_drawer_next', 1214, headerY, 42, 32, '▶', {
          disabled: page >= totalPages - 1,
          fontSize: 16,
          onClick: () => {
            state.drawerPage = Math.min(totalPages - 1, page + 1);
            redraw();
          }
        });
      }

      let curY = bodyY;
      const pageSliders = allSliders.slice(page * slidersPerPage, (page + 1) * slidersPerPage);
      const sliderH = 42;
      pageSliders.forEach((sl, idx) => {
        if (curY + sliderH <= canvasH - 16) {
          addSlider(`vr_sl_${sl.id || idx}`, 24, curY, canvasW - 48, sliderH, sl);
          curY += sliderH + 6;
        }
      });

      const pageButtons = allButtons.slice(page * buttonsPerPage, (page + 1) * buttonsPerPage);
      if (pageButtons.length > 0 && curY + 42 <= canvasH - 16) {
        const cols = Math.min(4, Math.max(1, pageButtons.length));
        const btnW = Math.floor((canvasW - 48 - (cols - 1) * 8) / cols);
        const rows = Math.ceil(pageButtons.length / cols);
        const remH = canvasH - 18 - curY - (state.textInput ? 48 : 0);
        const btnH = clampNumber(Math.floor((remH - (rows - 1) * 6) / rows), 38, 52);
        pageButtons.forEach((dc, idx) => {
          const row = Math.floor(idx / cols);
          const col = idx % cols;
          const bx = 24 + col * (btnW + 8);
          const by = curY + row * (btnH + 6);
          if (by + btnH <= canvasH - 14) {
            addBtn(`vr_drawer_${idx}`, bx, by, btnW, btnH, dc.label || 'Option', {
              active: Boolean(dc.active),
              primary: Boolean(dc.primary),
              danger: Boolean(dc.danger),
              disabled: Boolean(dc.disabled),
              maxChars: 24,
              fontSize: 16,
              onClick: dc.onClick
            });
          }
        });
        curY += rows * (btnH + 6) + 4;
      }

      if (state.textInput && curY + 42 <= canvasH - 12) {
        const barY = canvasH - 56;
        addBtn(
          'vr_open_kbd',
          24,
          barY,
          canvasW - 48,
          42,
          `⌨️ Ouvrir Clavier VR : "${String(state.textInput.value || state.textInput.placeholder || 'Saisir commande...')}"`,
          {
            active: true,
            maxChars: 68,
            fontSize: 16,
            onClick: () => {
              state.activeTab = 'keyboard';
              redraw();
            }
          }
        );
      } else if (Array.isArray(state.statusLines) && state.statusLines.length > 1 && availH > 60 && ctx) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '15px monospace';
        ctx.fillText(String(state.statusLines[1]).slice(0, 96), 28, canvasH - 22);
      }
    }

    if (texture) texture.needsUpdate = true;
  };

  redraw();

  const hitTestUv = (uv) => {
    if (!uv || !group.visible) return null;
    const cx = uv.x * canvasW;
    const cy = (1 - uv.y) * canvasH;
    for (const b of hitBoxes) {
      if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) {
        return b;
      }
    }
    return null;
  };

  const setHovered = (id) => {
    if (hoveredId !== id) {
      hoveredId = id;
      redraw();
    }
  };

  const updateState = (next = {}, options = {}) => {
    const prevMode = resolveActiveMode();
    let structuralChange = Boolean(options.immediate);
    if (next.mode && next.mode !== prevMode) {
      for (const sk of [
        'survivalLobby',
        'survivalIntro',
        'survivalHidden',
        'jumpscare',
        'detention',
        'survivalEnd',
        'combatLobby',
        'combatEnd',
        'shop',
        'locker',
        'tablet'
      ]) {
        if (!(sk in next) && state[sk]) {
          state[sk] = null;
          structuralChange = true;
        }
      }
    }
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined) continue;
      if (
        k === 'mode' ||
        k === 'result' ||
        k === 'dialogue' ||
        k === 'ascension' ||
        k === 'survivalLobby' ||
        k === 'survivalIntro' ||
        k === 'survivalHidden' ||
        k === 'jumpscare' ||
        k === 'detention' ||
        k === 'survivalEnd' ||
        k === 'combatLobby' ||
        k === 'combatEnd' ||
        k === 'shop' ||
        k === 'locker' ||
        k === 'tablet' ||
        k === 'tools' ||
        k === 'actions' ||
        k === 'stages' ||
        k === 'cameras' ||
        k === 'textInput'
      ) {
        if (state[k] !== v) structuralChange = true;
      }
      state[k] = v;
    }
    if (next.tablet && typeof next.tablet === 'object') {
      const tbNext = next.tablet;
      if (tbNext.app !== undefined && tbNext.app !== tabletUi.lastSyncedApp) {
        tabletUi.app = tbNext.app;
        tabletUi.lastSyncedApp = tbNext.app;
      }
      if (tbNext.activeTpId !== undefined && tbNext.activeTpId !== tabletUi.lastSyncedTpId) {
        tabletUi.activeTpId = tbNext.activeTpId;
        tabletUi.lastSyncedTpId = tbNext.activeTpId;
      }
      if (tbNext.toolTab !== undefined) {
        tabletUi.toolTab = tbNext.toolTab;
      }
      if (tbNext.waypoint !== undefined) {
        const nextWpKey = tbNext.waypoint
          ? `${tbNext.waypoint.x},${tbNext.waypoint.z},${tbNext.waypoint.floor ?? 0}`
          : 'none';
        if (nextWpKey !== tabletUi.lastSyncedWaypointKey) {
          tabletUi.waypoint = tbNext.waypoint;
          tabletUi.lastSyncedWaypointKey = nextWpKey;
        }
      }
      if (tbNext.floor !== undefined) {
        tabletUi.selectedFloor = clampFloor(tbNext.floor);
      }
    }
    if (next.tpId !== undefined && next.tpId !== state.tpId) {
      state.drawerPage = 0;
    }
    const newMode = resolveActiveMode();
    if (newMode !== prevMode) structuralChange = true;
    const now = Date.now();
    if (structuralChange || !ctx || now - lastDrawMs >= 45) {
      redraw();
    } else if (!redrawTimer) {
      redrawTimer = setTimeout(() => {
        redrawTimer = null;
        redraw();
      }, 45);
    }
  };

  const placeRelativeToCamera = (camera, dist = 1.18, yOffset = -0.02) => {
    if (!camera) return;
    camera.getWorldPosition(PANEL_SCRATCH_POS);
    camera.getWorldDirection(PANEL_SCRATCH_FWD);
    PANEL_SCRATCH_FWD.y = 0;
    if (PANEL_SCRATCH_FWD.lengthSq() < 1e-6) {
      PANEL_SCRATCH_FWD.set(0, 0, -1);
    } else {
      PANEL_SCRATCH_FWD.normalize();
    }
    group.position.set(
      PANEL_SCRATCH_POS.x + PANEL_SCRATCH_FWD.x * dist,
      PANEL_SCRATCH_POS.y + yOffset,
      PANEL_SCRATCH_POS.z + PANEL_SCRATCH_FWD.z * dist
    );
    group.lookAt(PANEL_SCRATCH_POS.x, PANEL_SCRATCH_POS.y, PANEL_SCRATCH_POS.z);
  };

  const dispose = () => {
    if (redrawTimer) {
      clearTimeout(redrawTimer);
      redrawTimer = null;
    }
    texture?.dispose?.();
    frame.geometry.dispose();
    frame.material.dispose();
    screenMesh.geometry.dispose();
    screenMesh.material.dispose();
  };

  return {
    group,
    screenMesh,
    screenWidth,
    screenHeight,
    canvasW,
    canvasH,
    hitTestUv,
    getHitBoxes: () => hitBoxes.slice(),
    getState: () => ({ ...state }),
    setHovered,
    updateState,
    redraw,
    placeRelativeToCamera,
    dispose
  };
}

export const createVRStationTerminalPanel = createTpSpatialPanel;

export function createVrDebugPanel() {
  const canvasW = 640;
  const canvasH = 340;
  let canvas = null;
  let ctx = null;
  let texture = null;

  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    ctx = canvas.getContext('2d');
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
  }

  const group = new THREE.Group();
  group.name = 'vr-debug-panel';
  group.visible = false;

  const screenMat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.36), screenMat);
  screenMesh.renderOrder = 18;
  group.add(screenMesh);

  const state = {
    xrPresenting: false,
    simMode: false,
    referenceSpace: 'local-floor',
    rigPos: { x: 0, y: 0, z: 0 },
    headY: 1.65,
    fps: 60,
    frameCount: 0,
    errors: []
  };

  let lastDrawMs = 0;
  let dirty = true;

  const redraw = () => {
    dirty = false;
    if (!ctx || !texture) return;
    ctx.clearRect(0, 0, canvasW, canvasH);

    roundRectPath(ctx, 6, 6, canvasW - 12, canvasH - 12, 22);
    const bg = ctx.createLinearGradient(0, 0, canvasW, canvasH);
    bg.addColorStop(0, 'rgba(4, 12, 28, 0.94)');
    bg.addColorStop(1, 'rgba(9, 25, 48, 0.94)');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = state.errors.length > 0 ? '#f43f5e' : state.xrPresenting ? '#10b981' : '#38bdf8';
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 21px system-ui, sans-serif';
    ctx.fillText('🩺 DEBUG WEBXR • ATELIER CIEL 3D', 24, 38);

    const pulseOn = state.frameCount % 30 < 15;
    ctx.fillStyle = state.xrPresenting ? (pulseOn ? '#34d399' : '#10b981') : '#fbbf24';
    ctx.beginPath();
    ctx.arc(canvasW - 150, 31, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`FRAME #${state.frameCount}`, canvasW - 134, 36);

    const rows = [
      {
        label: 'XR Presenting',
        val: state.xrPresenting ? 'OUI (WebXR Actif)' : state.simMode ? 'SIMULATION PC' : 'NON',
        color: state.xrPresenting ? '#34d399' : state.simMode ? '#38bdf8' : '#fb7185'
      },
      {
        label: 'ReferenceSpace',
        val: String(state.referenceSpace || 'local-floor'),
        color: '#7dd3fc'
      },
      {
        label: 'Rig XYZ',
        val: `X:${Number(state.rigPos?.x || 0).toFixed(2)}  Y:${Number(state.rigPos?.y || 0).toFixed(2)}  Z:${Number(state.rigPos?.z || 0).toFixed(2)}  (Tête Y:${Number(state.headY || 0).toFixed(2)})`,
        color: '#f8fafc'
      },
      {
        label: 'FPS Moteur',
        val: `${Math.round(Number(state.fps) || 0)} FPS`,
        color: Number(state.fps) >= 55 ? '#34d399' : '#fbbf24'
      }
    ];

    let ry = 62;
    for (const r of rows) {
      roundRectPath(ctx, 20, ry, canvasW - 40, 38, 10);
      ctx.fillStyle = 'rgba(15, 34, 61, 0.85)';
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(r.label, 34, ry + 24);
      ctx.fillStyle = r.color;
      ctx.font = 'bold 17px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(r.val, canvasW - 34, ry + 24);
      ctx.textAlign = 'left';
      ry += 44;
    }

    roundRectPath(ctx, 20, 242, canvasW - 40, 76, 12);
    ctx.fillStyle = state.errors.length > 0 ? 'rgba(127, 29, 29, 0.78)' : 'rgba(6, 78, 59, 0.62)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = state.errors.length > 0 ? '#fb7185' : '#34d399';
    ctx.stroke();

    ctx.fillStyle = state.errors.length > 0 ? '#fecdd3' : '#a7f3d0';
    ctx.font = 'bold 16px system-ui, sans-serif';
    if (state.errors.length === 0) {
      ctx.fillText('✅ Erreurs WebGL / XR : Aucune erreur capturée', 34, 286);
    } else {
      ctx.fillText(`⚠️ Erreurs WebGL / XR (${state.errors.length}) :`, 34, 266);
      ctx.font = '14px monospace';
      const errLine = String(state.errors[state.errors.length - 1] || '').slice(0, 62);
      ctx.fillText(errLine, 34, 292);
    }

    texture.needsUpdate = true;
  };

  redraw();

  const localFwd = new THREE.Vector3();
  const desiredPos = new THREE.Vector3();

  const updateTransform = (vrRig, camera, dt = 0.016, snap = false) => {
    if (!camera || !vrRig) return;
    const camPos = camera.position;
    localFwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const flatLen = Math.hypot(localFwd.x, localFwd.z);
    const fx = flatLen > 0.05 ? localFwd.x / flatLen : 0;
    const fz = flatLen > 0.05 ? localFwd.z / flatLen : -1;

    desiredPos.set(
      camPos.x + fx * 1.55,
      Math.max(1.15, camPos.y + 0.3),
      camPos.z + fz * 1.55
    );
    if (snap) {
      group.position.copy(desiredPos);
    } else {
      group.position.lerp(desiredPos, Math.min(1, Math.max(0.08, dt * 4.5)));
    }
    group.rotation.order = 'YXZ';
    const lookYaw = Math.atan2(camPos.x - group.position.x, camPos.z - group.position.z);
    group.rotation.set(0.14, lookYaw, 0);
  };

  const updateState = (next = {}, nowMs = Date.now(), force = false) => {
    let changed = false;
    if (next.xrPresenting !== undefined && next.xrPresenting !== state.xrPresenting) {
      state.xrPresenting = Boolean(next.xrPresenting);
      changed = true;
    }
    if (next.simMode !== undefined && next.simMode !== state.simMode) {
      state.simMode = Boolean(next.simMode);
      changed = true;
    }
    if (next.referenceSpace !== undefined && next.referenceSpace !== state.referenceSpace) {
      state.referenceSpace = next.referenceSpace;
      changed = true;
    }
    if (next.rigPos) {
      const nx = Number(next.rigPos.x) || 0;
      const ny = Number(next.rigPos.y) || 0;
      const nz = Number(next.rigPos.z) || 0;
      if (
        Math.abs(nx - state.rigPos.x) > 0.004 ||
        Math.abs(ny - state.rigPos.y) > 0.004 ||
        Math.abs(nz - state.rigPos.z) > 0.004
      ) {
        state.rigPos = { x: nx, y: ny, z: nz };
        changed = true;
      }
    }
    if (next.headY !== undefined && Math.abs((Number(next.headY) || 0) - state.headY) > 0.004) {
      state.headY = Number(next.headY) || 0;
      changed = true;
    }
    if (next.fps !== undefined && Math.round(Number(next.fps) || 0) !== Math.round(state.fps)) {
      state.fps = Number(next.fps) || 0;
      changed = true;
    }
    if (next.frameCount !== undefined && next.frameCount !== state.frameCount) {
      state.frameCount = next.frameCount;
      changed = true;
    }
    if (Array.isArray(next.errors)) {
      if (next.errors.length !== state.errors.length || next.errors[next.errors.length - 1] !== state.errors[state.errors.length - 1]) {
        state.errors = [...next.errors];
        changed = true;
        force = true;
      }
    }
    if (changed) dirty = true;
    if (group.visible && (force || (dirty && nowMs - lastDrawMs >= 140))) {
      lastDrawMs = nowMs;
      redraw();
    }
  };

  const setVisible = (visible) => {
    const next = Boolean(visible);
    group.visible = next;
    if (next && dirty) {
      lastDrawMs = Date.now();
      redraw();
    }
    return group.visible;
  };

  const getState = () => ({
    ...state,
    errors: [...state.errors]
  });

  const dispose = () => {
    texture?.dispose?.();
    screenMesh.geometry.dispose();
    screenMesh.material.dispose();
  };

  return {
    group,
    screenMesh,
    setVisible,
    updateTransform,
    updateState,
    getState,
    redraw,
    dispose
  };
}
