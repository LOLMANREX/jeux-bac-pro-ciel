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
    completedCount: 0,
    totalTps: 5,
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
    peers: [],
    survivalStatus: null
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
    const doneCnt = Number.isFinite(Number(state.completedCount)) ? Number(state.completedCount) : 0;
    const totalCnt = Number.isFinite(Number(state.totalTps)) && Number(state.totalTps) > 0 ? Number(state.totalTps) : 5;
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${avgDisplay} • ${doneCnt}/${totalCnt} • ${state.xp || 0} XP`, canvasW - 34, 78);
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
    survivalHidden: null,
    jumpscare: null,
    detention: null,
    survivalEnd: null,
    onSelectStage: null,
    onSelectTool: null,
    onSelectCamera: null,
    onAdjustZoom: null,
    onAdjustOrbit: null,
    onExitTp: null
  };

  const resolveActiveMode = () => {
    if (state.jumpscare) return 'jumpscare';
    if (state.detention) return 'detention';
    if (state.survivalEnd) return 'survival_end';
    if (state.survivalHidden) return 'survival_hidden';
    if (state.survivalLobby) return 'survival_lobby';
    if (state.ascension) return 'ascension';
    if (state.dialogue) return 'dialogue';
    if (state.result) return 'result';
    return state.mode || 'workbench';
  };

  const handleExitAction = (uv) => {
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

    if (ctx) {
      ctx.clearRect(0, 0, canvasW, canvasH);
      roundRectPath(ctx, 6, 6, canvasW - 12, canvasH - 12, 24);
      const bg = ctx.createLinearGradient(0, 0, 0, canvasH);
      bg.addColorStop(0, '#071326');
      bg.addColorStop(1, '#0b1b34');
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = resolveActiveMode() === 'ascension' ? '#fbbf24' : '#38bdf8';
      ctx.stroke();
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

    if (ctx) {
      const headerColor =
        mode === 'jumpscare'
          ? '#ef4444'
          : mode === 'detention'
            ? '#fb923c'
            : mode === 'survival_hidden'
              ? '#facc15'
              : mode === 'survival_lobby'
                ? '#f43f5e'
                : mode === 'survival_end'
                  ? state.survivalEnd?.victory
                    ? '#34d399'
                    : '#f87171'
                  : mode === 'ascension'
                    ? '#fbbf24'
                    : '#38bdf8';
      ctx.fillStyle = headerColor;
      ctx.font = 'bold 26px system-ui, sans-serif';
      const headerTitle =
        mode === 'dialogue'
          ? state.dialogue?.title || '👨‍🏫 ENTRETIEN PROFESSEUR CIEL'
          : mode === 'ascension'
            ? state.ascension?.title || '👑 CÉRÉMONIE D’ASCENSION BAC PRO CIEL'
            : mode === 'survival_lobby'
              ? '☠️ SALON D’ATTENTE — MODE SURVIE HORREUR'
              : mode === 'survival_hidden'
                ? `🗄️ ${state.survivalHidden?.rackLabel || 'BAIE DE BRASSAGE (CACHÉ)'}`
                : mode === 'jumpscare'
                  ? '☠️ ALERTE CAPTURE — PROFESSEUR CIEL'
                  : mode === 'detention'
                    ? '📝 HEURE DE COLLE — TABLEAUX DE VARIATION'
                    : mode === 'survival_end'
                      ? state.survivalEnd?.victory
                        ? '🏆 VICTOIRE COOPÉRATIVE — SURVIE CIEL'
                        : '💀 DÉFAITE — CLASSE EN HEURE DE COLLE'
                      : String(state.tpTitle || 'TP Atelier 3D');
      ctx.fillText(headerTitle.slice(0, 46), 24, 46);
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

    if (mode !== 'jumpscare') {
      const exitLabel =
        mode === 'survival_lobby'
          ? '🚪 Quitter Salon'
          : mode === 'survival_hidden'
            ? '🚪 Sortir Baie'
            : mode === 'detention'
              ? '📺 Voir Caméras'
              : mode === 'survival_end'
                ? '🏫 Hall Principal'
                : mode === 'dialogue' || mode === 'ascension'
                  ? '✕ Fermer'
                  : '✕ Quitter le TP';
      addBtn('vr_tp_exit', 1006, 16, 250, 44, exitLabel, {
        danger: true,
        maxChars: 20,
        fontSize: 19,
        onClick: handleExitAction
      });
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
      const passed = Number(res.score) >= 10;
      if (ctx) {
        roundRectPath(ctx, 44, 78, canvasW - 88, 578, 22);
        ctx.fillStyle = passed ? 'rgba(6, 78, 59, 0.88)' : 'rgba(127, 29, 29, 0.82)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = passed ? '#34d399' : '#fb7185';
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 64px system-ui, sans-serif';
        ctx.fillText(`${Number(res.score || 0).toFixed(1)} / 20`, canvasW / 2, 168);

        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 28px system-ui, sans-serif';
        ctx.fillText(`+${res.xp || 0} XP • Temps : ${res.duration || '00:00'}`, canvasW / 2, 220);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '600 24px system-ui, sans-serif';
        ctx.fillText(`Professeur CIEL : ${res.mention || ''}`, canvasW / 2, 268);

        const summaryLines = Array.isArray(res.summaryLines) ? res.summaryLines : [];
        ctx.textAlign = 'left';
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '500 20px system-ui, sans-serif';
        summaryLines.slice(0, 7).forEach((ln, idx) => {
          ctx.fillText(`• ${String(ln).slice(0, 90)}`, 86, 326 + idx * 36);
        });

        if (res.all20Unlocked) {
          ctx.textAlign = 'center';
          ctx.fillStyle = '#fde68a';
          ctx.font = 'bold 24px system-ui, sans-serif';
          ctx.fillText('👑 20/20 SUR TOUS LES TPs — CÉRÉMONIE D’ASCENSION DÉBLOQUÉE !', canvasW / 2, 622);
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

    if (mode === 'survival_lobby' && state.survivalLobby) {
      const sl = state.survivalLobby;
      const players = Array.isArray(sl.players) ? sl.players : [];
      const minP = Math.max(2, Number(sl.minPlayers) || 2);
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
        roundRectPath(ctx, 36, 78, canvasW - 72, 560, 20);
        ctx.fillStyle = 'rgba(8, 12, 20, 0.96)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = noise >= 0.28 ? '#ef4444' : '#334155';
        ctx.stroke();

        for (let s = 0; s < 5; s++) {
          roundRectPath(ctx, 84, 108 + s * 22, canvasW - 168, 10, 5);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
          ctx.fill();
        }

        ctx.textAlign = 'center';
        ctx.fillStyle = noise >= 0.28 ? '#fca5a5' : '#e2e8f0';
        ctx.font = 'bold 34px system-ui, sans-serif';
        ctx.fillText(
          noise >= 0.28
            ? '⚠️ BRUIT MICRO DÉTECTÉ — LE PROFESSEUR APPROCHE !'
            : '🤫 VOUS ÊTES CACHÉ DANS LA BAIE DE BRASSAGE',
          canvasW / 2,
          286
        );

        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 24px system-ui, sans-serif';
        ctx.fillText(
          `État Professeur CIEL : ${String(sh.aiStateLabel || sh.aiState || 'Patrouille')} • TPs : ${sh.completedTps || 0}/${sh.totalTps || 5}`,
          canvasW / 2,
          342
        );

        ctx.textAlign = 'left';
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.fillText(`Volume Microphone RMS : ${Math.round(noise * 100)}% (Seuil alerte : 28%)`, 120, 418);

        roundRectPath(ctx, 120, 442, canvasW - 240, 46, 14);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#475569';
        ctx.stroke();

        const barW = Math.max(12, Math.round((canvasW - 248) * noise));
        roundRectPath(ctx, 124, 446, barW, 38, 10);
        ctx.fillStyle = noise >= 0.48 ? '#ef4444' : noise >= 0.28 ? '#f59e0b' : '#22c55e';
        ctx.fill();

        const threshX = 124 + Math.round((canvasW - 248) * 0.28);
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(threshX, 434);
        ctx.lineTo(threshX, 496);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 20px system-ui, sans-serif';
        ctx.fillText(
          sh.alertText || 'Coupez votre microphone ou gardez le silence pour que le Professeur CIEL perde votre trace.',
          canvasW / 2,
          556
        );
        ctx.textAlign = 'left';
      }

      addBtn(
        'vr_hide_mic',
        84,
        662,
        540,
        106,
        sh.micEnabled ? '🎙️ Couper Micro (Silence)' : '🔇 Activer Micro',
        {
          primary: !sh.micEnabled,
          danger: sh.micEnabled && noise >= 0.28,
          fontSize: 25,
          onClick: () => sh.onToggleMic?.()
        }
      );
      addBtn('vr_hide_exit', 656, 662, 540, 106, '🚪 Sortir de la Baie de Brassage', {
        primary: true,
        fontSize: 25,
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
        roundRectPath(ctx, 36, 76, canvasW - 72, 48, 12);
        ctx.fillStyle = 'rgba(42, 18, 10, 0.94)';
        ctx.fill();
        ctx.fillStyle = '#fdba74';
        ctx.font = 'bold 20px system-ui, sans-serif';
        ctx.fillText(
          `📝 Tableaux résolus : ${dtState.solvedCount || 0} • Survivants : ${dtState.survivorsCount ?? '?'} • Collés : ${dtState.detainedCount ?? '?'} • TPs : ${dtState.completedTps || 0}/${dtState.totalTps || 5}`,
          56,
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
      for (const sk of ['survivalLobby', 'survivalHidden', 'jumpscare', 'detention', 'survivalEnd']) {
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
        k === 'survivalHidden' ||
        k === 'jumpscare' ||
        k === 'detention' ||
        k === 'survivalEnd' ||
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
