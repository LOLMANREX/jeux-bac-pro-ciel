import * as THREE from 'three';
import { PlateauMiniMap } from '../ui/PlateauMiniMap.js';
import { createDefaultMap, getZoneAtPositionInMap, normalizeMapData } from '../world/mapSchema.js';

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
  let dirty = true;
  let lastDrawMs = 0;

  const state = {
    name: options.name || 'Eleve_CIEL',
    zoneLabel: '📍 U300 - Couloir Central',
    zoneColor: '#22d3ee',
    average: '-- / 20',
    xp: 0,
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
    currentZone: null,
    peers: []
  };

  const redraw = () => {
    const conn = resolveConnectionDisplay(state.connectionState, state.onlineCount, state.pingMs);
    rimMat.color.set(state.isSpeaking ? '#34d399' : conn.rimColor);
    rimMat.emissive.set(state.isSpeaking ? '#10b981' : conn.rimColor);

    if (!ctx || !texture) {
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
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${avgDisplay} • ${state.xp || 0} XP`, canvasW - 34, 78);
    ctx.textAlign = 'left';

    ctx.fillStyle = state.zoneColor || '#38bdf8';
    ctx.font = '600 16px system-ui, sans-serif';
    const subStatus = state.targetHint
      ? String(state.targetHint).slice(0, 44)
      : String(state.zoneLabel || '📍 U300 - Couloir Central').slice(0, 44);
    ctx.fillText(subStatus, 34, 105);

    const mapX = 24;
    const mapY = 128;
    roundRectPath(ctx, mapX - 3, mapY - 3, mapCanvasW + 6, mapCanvasH + 6, 16);
    ctx.fillStyle = '#040a17';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#22d3ee';
    ctx.stroke();

    if (miniMap && mapCanvas) {
      const zoneObj =
        state.currentZone ||
        (state.playerPos
          ? getZoneAtPositionInMap(currentMapData, state.playerPos.x, state.playerPos.z)
          : null);
      miniMap.render({
        playerPos: state.playerPos,
        playerYaw: state.playerYaw,
        currentZone: zoneObj,
        peers: Array.isArray(state.peers) ? state.peers : []
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
      roundRectPath(ctx, x, y, w, h, 14);
      ctx.fillStyle = hovered ? borderHex : bgHex;
      ctx.fill();
      ctx.lineWidth = hovered ? 3.5 : 2;
      ctx.strokeStyle = borderHex;
      ctx.stroke();
      ctx.fillStyle = hovered ? '#04101f' : textHex;
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + w / 2, y + h / 2);
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
      ? '🔴 En direct'
      : state.micEnabled
        ? '🎙️ Micro ON'
        : '🔇 Micro OFF';

    drawBtn('btn_mic', 22, 396, 224, 64, micTxt, micBg, micBorder, '#f8fafc');
    drawBtn('btn_vr_exit', 266, 396, 224, 64, `🚪 ${state.vrLabel}`, '#3f1d2b', '#fb7185', '#ffe4e6');

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
    if (forceVisible) {
      group.visible = true;
      screenMat.opacity = 0.98;
      if (dirty && nowMs - lastDrawMs >= 75) {
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
      if (dirty && nowMs - lastDrawMs >= 75) {
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

  const updateMiniMap = (data = {}) => {
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
    dirty = true;
    if (forceVisible) {
      const now = Date.now();
      if (now - lastDrawMs >= 75) {
        lastDrawMs = now;
        redraw();
      }
    }
  };

  const updateState = (next = {}) => {
    let changed = false;
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined) continue;
      if (state[k] !== v) {
        state[k] = v;
        changed = true;
      }
    }
    if (changed) {
      dirty = true;
      if (group.visible || forceVisible) {
        redraw();
      }
    }
  };

  const setForceVisible = (v) => {
    forceVisible = Boolean(v);
    if (forceVisible) {
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
    updateState,
    getState,
    hasMiniMapData: () => Boolean(currentMapData && Array.isArray(currentMapData.zones)),
    getMiniMapBounds: () => currentMapData?.bounds || null,
    dispose
  };
}

export function createTpSpatialPanel() {
  const canvasW = 1024;
  const canvasH = 576;
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
  group.position.set(0, 0.74, -0.58);
  group.rotation.x = 0.18;

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(1.36, 0.76, 0.016),
    new THREE.MeshStandardMaterial({
      color: '#0f172a',
      metalness: 0.7,
      roughness: 0.28,
      emissive: '#082f49',
      emissiveIntensity: 0.3
    })
  );
  frame.position.z = -0.01;
  group.add(frame);

  const screenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.32, 0.73),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.98 })
  );
  group.add(screenMesh);

  let hitBoxes = [];
  let hoveredId = null;
  const state = {
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
    drawerControls: [],
    result: null
  };

  const redraw = () => {
    if (!ctx || !texture) return;
    hitBoxes = [];
    ctx.clearRect(0, 0, canvasW, canvasH);

    roundRectPath(ctx, 6, 6, canvasW - 12, canvasH - 12, 24);
    const bg = ctx.createLinearGradient(0, 0, 0, canvasH);
    bg.addColorStop(0, '#071326');
    bg.addColorStop(1, '#0b1b34');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();

    const addBtn = (id, x, y, w, h, label, { active = false, primary = false, danger = false, disabled = false, onClick = null } = {}) => {
      const isHover = !disabled && hoveredId === id;
      roundRectPath(ctx, x, y, w, h, 12);
      ctx.fillStyle = disabled
        ? 'rgba(30, 41, 59, 0.55)'
        : isHover
          ? danger
            ? '#f43f5e'
            : primary
              ? '#34d399'
              : '#38bdf8'
          : danger
            ? '#7f1d1d'
            : primary
              ? '#059669'
              : active
                ? '#0284c7'
                : '#172554';
      ctx.fill();
      ctx.lineWidth = isHover || active ? 3 : 1.5;
      ctx.strokeStyle = disabled ? '#334155' : danger ? '#fb7185' : primary ? '#34d399' : '#38bdf8';
      ctx.stroke();

      ctx.fillStyle = disabled ? '#64748b' : isHover ? '#04101f' : '#f8fafc';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(label || '').slice(0, 26), x + w / 2, y + h / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      if (!disabled && onClick) {
        hitBoxes.push({ id, x, y, w, h, label, onClick });
      }
    };

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText(String(state.tpTitle || '').slice(0, 42), 26, 44);

    roundRectPath(ctx, 560, 16, 120, 42, 10);
    ctx.fillStyle = '#0f2942';
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`⏱ ${state.timer}`, 576, 44);

    roundRectPath(ctx, 692, 16, 152, 42, 10);
    ctx.fillStyle = '#064e3b';
    ctx.fill();
    ctx.fillStyle = '#6ee7b7';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(String(state.accuracy || '-- / 20'), 708, 44);

    addBtn('vr_tp_exit', 858, 16, 140, 42, '✕ Quitter TP', {
      danger: true,
      onClick: state.onExitTp
    });

    if (state.result) {
      const passed = state.result.score >= 10;
      roundRectPath(ctx, 64, 96, canvasW - 128, 340, 22);
      ctx.fillStyle = passed ? 'rgba(6, 78, 59, 0.88)' : 'rgba(127, 29, 29, 0.82)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = passed ? '#34d399' : '#fb7185';
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 58px system-ui, sans-serif';
      ctx.fillText(`${state.result.score.toFixed(1)} / 20`, canvasW / 2, 195);

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.fillText(`+${state.result.xp} XP • Temps : ${state.result.duration}`, canvasW / 2, 248);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '600 22px system-ui, sans-serif';
      ctx.fillText(`Professeur CIEL : ${state.result.mention}`, canvasW / 2, 304);
      ctx.textAlign = 'left';

      addBtn('vr_tp_replay', 220, 464, 260, 68, '🔄 Refaire le TP', {
        primary: false,
        onClick: state.result.onReplay
      });
      addBtn('vr_tp_done', 540, 464, 280, 68, '🏫 Retour Atelier 3D', {
        primary: true,
        onClick: state.result.onExit
      });
      texture.needsUpdate = true;
      return;
    }

    let cursorY = 70;

    if (state.stages.length > 0) {
      const count = Math.min(5, state.stages.length);
      const pillW = Math.floor((canvasW - 52 - (count - 1) * 10) / count);
      state.stages.slice(0, count).forEach((st, idx) => {
        const lbl =
          typeof st === 'string'
            ? st
            : st?.score != null
              ? `${st.name} (${st.score})`
              : st?.name || `Étape ${idx + 1}`;
        addBtn(`vr_stage_${idx}`, 26 + idx * (pillW + 10), cursorY, pillW, 38, lbl, {
          active: idx === state.activeStageIdx,
          onClick: () => state.onSelectStage?.(idx)
        });
      });
      cursorY += 50;
    }

    roundRectPath(ctx, 26, cursorY, canvasW - 52, 114, 14);
    ctx.fillStyle = 'rgba(15, 34, 61, 0.94)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(`${state.badge} — ${state.briefTitle}`, 44, cursorY + 30);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '500 18px system-ui, sans-serif';
    const subLines = wrapTextLines(ctx, state.briefSub, canvasW - 92, 2);
    subLines.forEach((ln, i) => {
      ctx.fillText(ln, 44, cursorY + 58 + i * 24);
    });

    if (state.hoverLabel || state.toastText) {
      ctx.fillStyle = state.hoverLabel ? '#34d399' : '#7dd3fc';
      ctx.font = 'bold 16px system-ui, sans-serif';
      const statusLine = state.hoverLabel ? `🎯 Cible : ${state.hoverLabel}` : `💬 ${state.toastText}`;
      ctx.fillText(statusLine.slice(0, 74), 44, cursorY + 106);
    }

    cursorY += 126;

    if (state.tools.length > 0) {
      const tCount = Math.min(5, state.tools.length);
      const tW = Math.floor((canvasW - 52 - (tCount - 1) * 10) / tCount);
      state.tools.slice(0, tCount).forEach((t, idx) => {
        addBtn(
          `vr_tool_${t.id}`,
          26 + idx * (tW + 10),
          cursorY,
          tW,
          48,
          `${t.icon || ''} ${t.label || ''}`.trim(),
          {
            active: t.id === state.activeToolId,
            disabled: Boolean(t.disabled),
            onClick: () => state.onSelectTool?.(t.id)
          }
        );
      });
      cursorY += 58;
    }

    if (state.actions.length > 0) {
      const aCount = Math.min(4, state.actions.length);
      const aW = Math.floor((canvasW - 52 - (aCount - 1) * 10) / aCount);
      state.actions.slice(0, aCount).forEach((a, idx) => {
        addBtn(`vr_act_${idx}`, 26 + idx * (aW + 10), cursorY, aW, 50, a.label || 'Action', {
          primary: Boolean(a.primary),
          danger: Boolean(a.danger),
          disabled: Boolean(a.disabled),
          onClick: () => a.onClick?.()
        });
      });
      cursorY += 62;
    }

    if (state.drawerControls.length > 0 && cursorY < canvasH - 54) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText('COMMANDES RAPIDES DE LA PAILLASSE :', 28, cursorY + 14);
      cursorY += 22;

      const maxCols = 4;
      const shown = state.drawerControls.slice(0, 8);
      const btnW = Math.floor((canvasW - 52 - (maxCols - 1) * 8) / maxCols);
      const btnH = shown.length > 4 ? 42 : 52;
      shown.forEach((dc, idx) => {
        const row = Math.floor(idx / maxCols);
        const col = idx % maxCols;
        const bx = 26 + col * (btnW + 8);
        const by = cursorY + row * (btnH + 8);
        if (by + btnH <= canvasH - 12) {
          addBtn(`vr_drawer_${idx}`, bx, by, btnW, btnH, dc.label, {
            active: Boolean(dc.active),
            onClick: dc.onClick
          });
        }
      });
    }

    texture.needsUpdate = true;
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

  const updateState = (next = {}) => {
    Object.assign(state, next);
    redraw();
  };

  const dispose = () => {
    texture?.dispose?.();
    frame.geometry.dispose();
    frame.material.dispose();
    screenMesh.geometry.dispose();
    screenMesh.material.dispose();
  };

  return {
    group,
    screenMesh,
    hitTestUv,
    setHovered,
    updateState,
    redraw,
    dispose
  };
}

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
