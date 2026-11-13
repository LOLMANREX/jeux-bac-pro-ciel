import * as THREE from 'three';

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

export function createWristHudPanel(options = {}) {
  const canvasW = 512;
  const canvasH = 320;
  let canvas = null;
  let ctx = null;
  let texture = null;

  if (typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    ctx = canvas.getContext('2d');
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
  }

  const group = new THREE.Group();
  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(0.232, 0.148, 0.008),
    new THREE.MeshStandardMaterial({
      color: '#0f172a',
      metalness: 0.72,
      roughness: 0.25,
      emissive: '#083344',
      emissiveIntensity: 0.35
    })
  );
  bezel.position.z = -0.005;
  group.add(bezel);

  const screenMat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.96
  });
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.138), screenMat);
  screenMesh.position.z = 0.001;
  group.add(screenMesh);

  let hitBoxes = [];
  let hoveredBtnId = null;
  let forceVisible = false;
  const state = {
    name: options.name || 'Eleve_CIEL',
    zoneLabel: '📍 U300 - Couloir Central',
    average: '-- / 20',
    xp: 0,
    micEnabled: false,
    isSpeaking: false,
    nearbySpeakers: [],
    vrLabel: 'Quitter VR'
  };

  const redraw = () => {
    if (!ctx || !texture) return;
    hitBoxes = [];

    ctx.clearRect(0, 0, canvasW, canvasH);
    roundRectPath(ctx, 4, 4, canvasW - 8, canvasH - 8, 22);
    const bg = ctx.createLinearGradient(0, 0, canvasW, canvasH);
    bg.addColorStop(0, '#071324');
    bg.addColorStop(1, '#0b1d36');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = state.isSpeaking ? '#34d399' : '#22d3ee';
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('⌚ MONTRESYS • ATELIER CIEL VR', 22, 36);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText(String(state.zoneLabel || '').slice(0, 36), 22, 68);

    roundRectPath(ctx, 20, 86, canvasW - 40, 86, 14);
    ctx.fillStyle = 'rgba(15, 32, 58, 0.92)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText(String(state.name || 'Élève').slice(0, 18), 36, 120);

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(`Moy: ${state.average || '--/20'}   •   ${state.xp || 0} XP`, 36, 154);

    if (state.nearbySpeakers?.length) {
      const names = state.nearbySpeakers.slice(0, 2).map((s) => `${s.name} (${s.distance}m)`).join(' • ');
      ctx.fillStyle = '#34d399';
      ctx.font = '600 17px system-ui, sans-serif';
      ctx.fillText(`🔊 ${names}`, 22, 198);
    } else {
      ctx.fillStyle = '#64748b';
      ctx.font = '500 16px system-ui, sans-serif';
      ctx.fillText('Voice Proximité prêt (0–18m)', 22, 198);
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

    drawBtn('btn_mic', 20, 222, 228, 72, micTxt, micBg, micBorder, '#f8fafc');
    drawBtn('btn_vr_exit', 264, 222, 228, 72, `🚪 ${state.vrLabel}`, '#3f1d2b', '#fb7185', '#ffe4e6');

    texture.needsUpdate = true;
  };

  redraw();

  const worldPos = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  const forward = new THREE.Vector3();
  const toCam = new THREE.Vector3();

  const updateVisibility = (cameraWorldPos, dt = 0.016) => {
    if (forceVisible) {
      group.visible = true;
      screenMat.opacity = 0.96;
      return true;
    }
    group.getWorldPosition(worldPos);
    group.getWorldQuaternion(worldQuat);
    forward.set(0, 0, 1).applyQuaternion(worldQuat).normalize();
    toCam.copy(cameraWorldPos).sub(worldPos).normalize();
    const facing = forward.dot(toCam);
    const shouldShow = facing > 0.36;
    if (shouldShow) {
      group.visible = true;
      screenMat.opacity += (0.96 - screenMat.opacity) * Math.min(1, dt * 12);
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

  const updateState = (next = {}) => {
    let dirty = false;
    for (const [k, v] of Object.entries(next)) {
      if (state[k] !== v) {
        state[k] = v;
        dirty = true;
      }
    }
    if (dirty) redraw();
  };

  const setForceVisible = (v) => {
    forceVisible = Boolean(v);
    if (forceVisible) {
      group.visible = true;
      screenMat.opacity = 0.96;
    }
  };

  const dispose = () => {
    texture?.dispose?.();
    bezel.geometry.dispose();
    bezel.material.dispose();
    screenMesh.geometry.dispose();
    screenMesh.material.dispose();
  };

  return {
    group,
    screenMesh,
    hitTestUv,
    setHovered,
    updateVisibility,
    setForceVisible,
    updateState,
    dispose
  };
}

export function createTpSpatialPanel() {
  const canvasW = 1024;
  const canvasH = 576;
  let canvas = null;
  let ctx = null;
  let texture = null;

  if (typeof document !== 'undefined') {
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
