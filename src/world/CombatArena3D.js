import * as THREE from 'three';
import { animateAvatarLimbs, buildStudentAvatarMesh, disposeObject3D } from './AvatarBuilder.js';
import { buildCombatWeaponMesh, COMBAT_MODES, getCombatWeaponById } from './CombatWeapons.js';
import {
  COMBAT_ARENA_BOUNDS,
  COMBAT_ARENA_CENTER,
  COMBAT_ARENA_OBSTACLES,
  COMBAT_PICKUP_SPOTS,
  COMBAT_WAITING_CENTER,
  getCombatArenaColliders
} from './CombatEngine.js';

function makeArenaCanvasTex(width, height, drawFn) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext?.('2d');
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

function makeCyberFloorTexture(accent = '#06b6d4') {
  const created = makeArenaCanvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#070e1d';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.16)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 512; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(w, i);
      ctx.stroke();
    }
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, w - 4, h - 4);
  });
  if (created?.tex) {
    created.tex.wrapS = THREE.RepeatWrapping;
    created.tex.wrapT = THREE.RepeatWrapping;
    created.tex.repeat.set(8, 7);
  }
  return created;
}

function makeNameBadgeSprite(label, color = '#fb7185') {
  const made = makeArenaCanvasTex(256, 64, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(7, 13, 28, 0.86)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(6, 6, w - 12, h - 12, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(label || 'Bot CIEL').slice(0, 16), w / 2, h / 2);
  });
  if (!made?.tex) return null;
  const mat = new THREE.SpriteMaterial({ map: made.tex, transparent: true, depthTest: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(1.25, 0.32, 1);
  return sp;
}

export function createCombatPocketRooms(scene) {
  const root = new THREE.Group();
  root.name = 'combat-pocket-rooms';
  scene.add(root);

  const staticGroup = new THREE.Group();
  staticGroup.name = 'combat-static-structure';
  root.add(staticGroup);

  const dynamicGroup = new THREE.Group();
  dynamicGroup.name = 'combat-dynamic-entities';
  root.add(dynamicGroup);

  const wc = COMBAT_WAITING_CENTER;
  const waitW = 12;
  const waitD = 12;
  const waitH = 4.2;

  const lobbyFloorTex = makeCyberFloorTexture('#06b6d4');
  const waitFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(waitW, waitD),
    new THREE.MeshStandardMaterial({
      map: lobbyFloorTex?.tex || null,
      color: '#0f172a',
      roughness: 0.62,
      metalness: 0.25
    })
  );
  waitFloor.rotation.x = -Math.PI / 2;
  waitFloor.position.set(wc.x, 0, wc.z);
  waitFloor.receiveShadow = true;
  staticGroup.add(waitFloor);

  const waitCeil = new THREE.Mesh(
    new THREE.PlaneGeometry(waitW, waitD),
    new THREE.MeshStandardMaterial({ color: '#070b14', roughness: 0.86 })
  );
  waitCeil.rotation.x = Math.PI / 2;
  waitCeil.position.set(wc.x, waitH, wc.z);
  staticGroup.add(waitCeil);

  const wallMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.72, metalness: 0.22 });
  const thick = 0.26;
  for (const [wx, wy, wz, bw, bh, bd] of [
    [wc.x, waitH / 2, wc.z - waitD / 2, waitW, waitH, thick],
    [wc.x, waitH / 2, wc.z + waitD / 2, waitW, waitH, thick],
    [wc.x - waitW / 2, waitH / 2, wc.z, thick, waitH, waitD],
    [wc.x + waitW / 2, waitH / 2, wc.z, thick, waitH, waitD]
  ]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), wallMat);
    m.position.set(wx, wy, wz);
    staticGroup.add(m);
  }

  const waitNeon = new THREE.Mesh(
    new THREE.BoxGeometry(waitW - 0.6, 0.08, 0.08),
    new THREE.MeshBasicMaterial({ color: '#06b6d4' })
  );
  waitNeon.position.set(wc.x, waitH - 0.22, wc.z - waitD / 2 + 0.16);
  staticGroup.add(waitNeon);

  const waitLight = new THREE.PointLight('#38bdf8', 2.4, 18);
  waitLight.position.set(wc.x, 3.6, wc.z);
  staticGroup.add(waitLight);

  const lobbyScreen = makeArenaCanvasTex(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = '#060c19';
    ctx.fillRect(0, 0, w, h);
  });
  const lobbyBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(6.8, 3.0),
    new THREE.MeshBasicMaterial({ map: lobbyScreen?.tex || null })
  );
  lobbyBoard.position.set(wc.x, 2.25, wc.z - waitD / 2 + 0.18);
  staticGroup.add(lobbyBoard);

  const consoleMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.68, roughness: 0.3 });
  const buildConsole = (x, z, topColor, id, type, label) => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.12, 0.72), consoleMat);
    base.position.set(x, 0.56, z);
    staticGroup.add(base);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.08, 0.54), new THREE.MeshBasicMaterial({ color: topColor }));
    cap.position.set(x, 1.16, z);
    staticGroup.add(cap);
    return {
      id,
      type,
      label,
      position: new THREE.Vector3(x, 0, z),
      interactRadius: 2.5,
      mesh: base
    };
  };

  const waitingInteractables = [
    buildConsole(wc.x - 2.6, wc.z - 2.8, '#06b6d4', 'combat-lobby-mode', 'combat_lobby_mode', '[E] 🔄 Changer Mode (Fusils / Mêlée)'),
    buildConsole(wc.x, wc.z - 2.8, '#10b981', 'combat-lobby-ready', 'combat_lobby_ready', '[E] ⚔️ Prêt / Lancer l’Arène'),
    buildConsole(wc.x + 2.6, wc.z - 2.8, '#f43f5e', 'combat-lobby-exit', 'combat_lobby_exit', '[E] 🚪 Quitter le Lobby Combat')
  ];

  const ac = COMBAT_ARENA_CENTER;
  const ab = COMBAT_ARENA_BOUNDS;
  const arenaFloorTex = makeCyberFloorTexture('#0ea5e9');
  const arenaFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(ab.width, ab.depth),
    new THREE.MeshStandardMaterial({
      map: arenaFloorTex?.tex || null,
      color: '#0b1426',
      roughness: 0.58,
      metalness: 0.28
    })
  );
  arenaFloor.rotation.x = -Math.PI / 2;
  arenaFloor.position.set(ac.x, 0, ac.z);
  arenaFloor.receiveShadow = true;
  staticGroup.add(arenaFloor);

  const arenaCeil = new THREE.Mesh(
    new THREE.PlaneGeometry(ab.width, ab.depth),
    new THREE.MeshStandardMaterial({ color: '#050811', roughness: 0.9 })
  );
  arenaCeil.rotation.x = Math.PI / 2;
  arenaCeil.position.set(ac.x, ab.height, ac.z);
  staticGroup.add(arenaCeil);

  const arenaWallMat = new THREE.MeshStandardMaterial({ color: '#0e1729', roughness: 0.68, metalness: 0.28 });
  for (const [wx, wy, wz, bw, bh, bd] of [
    [ac.x, ab.height / 2, ab.minZ, ab.width, ab.height, 0.3],
    [ac.x, ab.height / 2, ab.maxZ, ab.width, ab.height, 0.3],
    [ab.minX, ab.height / 2, ac.z, 0.3, ab.height, ab.depth],
    [ab.maxX, ab.height / 2, ac.z, 0.3, ab.height, ab.depth]
  ]) {
    const wMesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), arenaWallMat);
    wMesh.position.set(wx, wy, wz);
    wMesh.receiveShadow = true;
    staticGroup.add(wMesh);
  }

  for (const [lx, lz, col] of [
    [ac.x - 8, ac.z - 6, '#22d3ee'],
    [ac.x + 8, ac.z - 6, '#f59e0b'],
    [ac.x - 8, ac.z + 6, '#38bdf8'],
    [ac.x + 8, ac.z + 6, '#a855f7']
  ]) {
    const pt = new THREE.PointLight(col, 2.2, 24);
    pt.position.set(lx, 4.9, lz);
    staticGroup.add(pt);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 0.24), new THREE.MeshBasicMaterial({ color: col }));
    bar.position.set(lx, ab.height - 0.12, lz);
    staticGroup.add(bar);
  }

  const obsDarkMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.4, metalness: 0.72 });
  const obsCrateMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.52, metalness: 0.42 });
  const obsPillarMat = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.35, metalness: 0.8 });

  for (const obs of COMBAT_ARENA_OBSTACLES) {
    const baseMat = obs.kind === 'crate' ? obsCrateMat : obs.kind === 'pillar' ? obsPillarMat : obsDarkMat;
    const block = new THREE.Mesh(new THREE.BoxGeometry(obs.w, obs.height, obs.d), baseMat);
    block.position.set(obs.x, obs.height / 2, obs.z);
    block.castShadow = true;
    block.receiveShadow = true;
    staticGroup.add(block);

    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(obs.w + 0.03, 0.07, obs.d + 0.03),
      new THREE.MeshBasicMaterial({ color: obs.color || '#22d3ee' })
    );
    trim.position.set(obs.x, obs.kind === 'pillar' ? 2.4 : obs.height - 0.08, obs.z);
    staticGroup.add(trim);

    if (obs.kind === 'rack') {
      for (let li = 0; li < 4; li++) {
        const led = new THREE.Mesh(
          new THREE.BoxGeometry(obs.w * 0.55, 0.04, obs.d + 0.02),
          new THREE.MeshBasicMaterial({ color: li % 2 === 0 ? '#22d3ee' : '#10b981' })
        );
        led.position.set(obs.x, 0.45 + li * 0.45, obs.z);
        staticGroup.add(led);
      }
    }
  }

  const arenaScreen = makeArenaCanvasTex(1024, 384, (ctx, w, h) => {
    ctx.fillStyle = '#060c19';
    ctx.fillRect(0, 0, w, h);
  });
  const arenaBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(8.4, 2.8),
    new THREE.MeshBasicMaterial({ map: arenaScreen?.tex || null })
  );
  arenaBoard.position.set(ac.x, 3.6, ab.minZ + 0.22);
  staticGroup.add(arenaBoard);

  const pickupVisuals = new Map();
  for (const spot of COMBAT_PICKUP_SPOTS) {
    const pGrp = new THREE.Group();
    pGrp.position.set(spot.x, 0, spot.z);
    dynamicGroup.add(pGrp);

    const pad = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.58, 24),
      new THREE.MeshBasicMaterial({ color: '#10b981', side: THREE.DoubleSide, transparent: true, opacity: 0.72 })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.03;
    pGrp.add(pad);

    const orb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 0),
      new THREE.MeshBasicMaterial({ color: '#34d399' })
    );
    orb.position.y = 0.85;
    pGrp.add(orb);

    pickupVisuals.set(spot.id, { group: pGrp, orb, pad });
  }

  const botAvatars = new Map();
  const _camWorldPos = new THREE.Vector3();
  let lastLobbyDrawMs = 0;
  let lastArenaBoardMs = 0;

  function ensureBotVisual(fighter) {
    let entry = botAvatars.get(fighter.id);
    if (!entry) {
      const avatar = buildStudentAvatarMesh(fighter.skin || { style: 'cyber', color: fighter.color || '#f43f5e' });
      avatar.group.position.set(fighter.x, 0, fighter.z);
      dynamicGroup.add(avatar.group);

      const hpGroup = new THREE.Group();
      hpGroup.position.set(0, 2.28, 0);
      avatar.group.add(hpGroup);

      const hpBg = new THREE.Mesh(
        new THREE.PlaneGeometry(0.92, 0.11),
        new THREE.MeshBasicMaterial({ color: '#090d16', side: THREE.DoubleSide })
      );
      hpGroup.add(hpBg);

      const hpFillMat = new THREE.MeshBasicMaterial({ color: '#34d399', side: THREE.DoubleSide });
      const hpFill = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.07), hpFillMat);
      hpFill.position.z = 0.005;
      hpGroup.add(hpFill);

      const badge = makeNameBadgeSprite(fighter.name, fighter.color || '#fb7185');
      if (badge) {
        badge.position.set(0, 0.25, 0);
        hpGroup.add(badge);
      }

      const weaponMount = new THREE.Group();
      weaponMount.position.set(0, -0.34, -0.14);
      avatar.rightArm.add(weaponMount);

      entry = {
        id: fighter.id,
        avatar,
        hpGroup,
        hpFill,
        hpFillMat,
        weaponMount,
        weaponObj: null,
        weaponId: null,
        prevX: fighter.x,
        prevZ: fighter.z,
        attackAnimUntil: 0
      };
      botAvatars.set(fighter.id, entry);
    }

    if (fighter.weaponId && entry.weaponId !== fighter.weaponId) {
      if (entry.weaponObj) {
        entry.weaponObj.group.parent?.remove(entry.weaponObj.group);
        entry.weaponObj.dispose?.();
      }
      entry.weaponObj = buildCombatWeaponMesh(fighter.weaponId, { viewModel: false });
      entry.weaponMount.add(entry.weaponObj.group);
      entry.weaponId = fighter.weaponId;
    }

    return entry;
  }

  function triggerBotAttackAnim(botId) {
    const entry = botAvatars.get(botId);
    if (entry) {
      entry.attackAnimUntil = Date.now() + 220;
    }
  }

  function updateWaitingBoard(snapshot, force = false) {
    if (!lobbyScreen?.ctx || !lobbyScreen?.tex) return;
    const now = Date.now();
    if (!force && now - lastLobbyDrawMs < 160) return;
    lastLobbyDrawMs = now;

    const { ctx } = lobbyScreen;
    const W = 1024;
    const H = 512;
    ctx.fillStyle = '#050b18';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, W - 20, H - 20);

    const modeId = snapshot?.mode === 'melee' ? 'melee' : 'guns';
    const modeMeta = COMBAT_MODES[modeId];

    ctx.fillStyle = '#22d3ee';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText('⚔️ ARÈNE DE COMBAT CIEL — SALLE D’ATTENTE', 36, 58);

    ctx.fillStyle = modeId === 'guns' ? '#38bdf8' : '#fb923c';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(`Mode Actif : ${modeMeta.icon} ${modeMeta.label}`, 36, 106);

    const fillBots = snapshot?.fillBots !== false;
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText(
      `Objectif : 10 éliminations ou 2m30 • ${fillBots ? 'Bots IA CIEL activés en renfort' : 'PvP Pur sans bots'}`,
      36,
      142
    );

    const weapons = Array.isArray(snapshot?.availableWeapons) ? snapshot.availableWeapons : [];
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText('Arsenal CIEL disponible :', 36, 184);
    weapons.slice(0, 4).forEach((w, idx) => {
      const bx = 36 + idx * 242;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(bx, 198, 228, 72);
      ctx.strokeStyle = w.beamColor || '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, 198, 228, 72);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.fillText(`${w.icon} ${w.shortName}`, bx + 12, 228);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillText(`Dégâts ${w.damage} • Portée ${w.range}m`, bx + 12, 254);
    });

    const players = Array.isArray(snapshot?.lobbyPlayers) ? snapshot.lobbyPlayers : [];
    players.slice(0, 4).forEach((p, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const px = 36 + col * 476;
      const py = 296 + row * 82;
      ctx.fillStyle = p.ready ? 'rgba(6, 78, 59, 0.72)' : 'rgba(30, 41, 59, 0.84)';
      ctx.fillRect(px, py, 452, 64);
      ctx.strokeStyle = p.ready ? '#34d399' : '#64748b';
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, 452, 64);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 21px system-ui, sans-serif';
      ctx.fillText(String(p.name || 'Élève').slice(0, 18), px + 14, py + 28);
      const wSpec = getCombatWeaponById(p.weaponId);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText(wSpec ? wSpec.shortName : 'Arme CIEL', px + 14, py + 52);
      ctx.fillStyle = p.ready ? '#6ee7b7' : '#fbbf24';
      ctx.textAlign = 'right';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillText(p.ready ? '✅ PRÊT' : '⏳ ATTENTE', px + 436, py + 38);
      ctx.textAlign = 'left';
    });

    lobbyScreen.tex.needsUpdate = true;
  }

  function updateArenaBoard(snapshot, force = false) {
    if (!arenaScreen?.ctx || !arenaScreen?.tex) return;
    const now = Date.now();
    if (!force && now - lastArenaBoardMs < 240) return;
    lastArenaBoardMs = now;

    const { ctx } = arenaScreen;
    const W = 1024;
    const H = 384;
    ctx.fillStyle = '#040914';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 5;
    ctx.strokeRect(8, 8, W - 16, H - 16);

    const t = Math.max(0, Number(snapshot?.timeLeftSec) || 0);
    const mm = String(Math.floor(t / 60)).padStart(2, '0');
    const ss = String(t % 60).padStart(2, '0');
    const modeLabel = snapshot?.mode === 'melee' ? '⚔️ MODE MÊLÉE' : '🔫 MODE FUSILS';

    ctx.fillStyle = '#22d3ee';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText(`ARÈNE CIEL • ${modeLabel} • ⏱️ ${mm}:${ss}`, 32, 56);

    const rows = Array.isArray(snapshot?.scoreboard) ? snapshot.scoreboard.slice(0, 5) : [];
    rows.forEach((row, idx) => {
      const y = 94 + idx * 52;
      ctx.fillStyle = idx === 0 ? 'rgba(14, 116, 144, 0.45)' : 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(32, y, W - 64, 44);
      ctx.fillStyle = idx === 0 ? '#fde047' : '#f8fafc';
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.fillText(`#${idx + 1}  ${String(row.name || '').slice(0, 20)}`, 52, y + 30);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#34d399';
      ctx.fillText(`${row.kills} Élim. / ${row.deaths} Morts`, W - 52, y + 30);
      ctx.textAlign = 'left';
    });

    arenaScreen.tex.needsUpdate = true;
  }

  function updateArena(snapshot, dt = 0.016, elapsed = 0, camera = null) {
    if (!snapshot) return;
    updateArenaBoard(snapshot, false);

    const pkList = Array.isArray(snapshot.pickups) ? snapshot.pickups : [];
    for (const pk of pkList) {
      const vis = pickupVisuals.get(pk.id);
      if (!vis) continue;
      vis.group.visible = Boolean(pk.active);
      if (pk.active) {
        vis.orb.rotation.y = elapsed * 2.2;
        vis.orb.position.y = 0.85 + Math.sin(elapsed * 3.1) * 0.12;
      }
    }

    const fighters = Array.isArray(snapshot.fighters) ? snapshot.fighters : [];
    const activeBotIds = new Set();
    const nowMs = Date.now();
    const smooth = Math.min(1, dt * 14);

    for (const f of fighters) {
      if (!f.isBot) continue;
      activeBotIds.add(f.id);
      const entry = ensureBotVisual(f);
      entry.avatar.group.visible = Boolean(f.alive);
      if (!f.alive) continue;

      const curPos = entry.avatar.group.position;
      const moveDist = Math.hypot(f.x - curPos.x, f.z - curPos.z);
      curPos.x += (f.x - curPos.x) * smooth;
      curPos.z += (f.z - curPos.z) * smooth;
      entry.avatar.group.rotation.y = (f.yaw || 0) + Math.PI;

      const ratio = Math.max(0.02, Math.min(1, (f.hp || 0) / Math.max(1, f.maxHp || 100)));
      entry.hpFill.scale.x = ratio;
      entry.hpFill.position.x = -0.43 * (1 - ratio);
      entry.hpFillMat.color.set(ratio > 0.5 ? '#34d399' : ratio > 0.25 ? '#f59e0b' : '#ef4444');

      if (camera) {
        if (typeof camera.getWorldPosition === 'function') {
          camera.getWorldPosition(_camWorldPos);
          entry.hpGroup.lookAt(_camWorldPos);
        } else {
          entry.hpGroup.lookAt(camera.position);
        }
      }

      animateAvatarLimbs(entry.avatar, dt, {
        isMoving: moveDist > 0.012,
        isGrounded: true,
        speedRatio: 1.15
      });

      if (nowMs < entry.attackAnimUntil) {
        entry.avatar.rightArm.rotation.x = -1.15;
      } else {
        entry.avatar.rightArm.rotation.x = -0.58;
      }
    }

    for (const [botId, entry] of botAvatars.entries()) {
      if (!activeBotIds.has(botId)) {
        entry.weaponObj?.dispose?.();
        entry.avatar.group.parent?.remove(entry.avatar.group);
        disposeObject3D(entry.avatar.group);
        botAvatars.delete(botId);
      }
    }
  }

  function clearCombatants() {
    for (const entry of botAvatars.values()) {
      entry.weaponObj?.dispose?.();
      entry.avatar.group.parent?.remove(entry.avatar.group);
      disposeObject3D(entry.avatar.group);
    }
    botAvatars.clear();
  }

  function getWaitingRoomConfig() {
    return {
      spawn: { x: wc.x, z: wc.z + 2.8 },
      lookAt: { x: wc.x, z: wc.z - 4.0 },
      bounds: {
        minX: wc.x - waitW / 2 + 0.4,
        maxX: wc.x + waitW / 2 - 0.4,
        minZ: wc.z - waitD / 2 + 0.4,
        maxZ: wc.z + waitD / 2 - 0.4,
        width: waitW,
        depth: waitD,
        height: waitH
      },
      colliders: [
        { minX: wc.x - 3.15, maxX: wc.x - 2.05, minZ: wc.z - 3.2, maxZ: wc.z - 2.4 },
        { minX: wc.x - 0.55, maxX: wc.x + 0.55, minZ: wc.z - 3.2, maxZ: wc.z - 2.4 },
        { minX: wc.x + 2.05, maxX: wc.x + 3.15, minZ: wc.z - 3.2, maxZ: wc.z - 2.4 }
      ],
      interactables: waitingInteractables
    };
  }

  function getArenaConfig() {
    return {
      spawn: { x: ac.x - 13.0, z: ac.z - 11.0 },
      lookAt: { x: ac.x, z: ac.z },
      bounds: { ...COMBAT_ARENA_BOUNDS },
      colliders: getCombatArenaColliders(),
      interactables: []
    };
  }

  function dispose() {
    clearCombatants();
    lobbyFloorTex?.tex?.dispose?.();
    arenaFloorTex?.tex?.dispose?.();
    lobbyScreen?.tex?.dispose?.();
    arenaScreen?.tex?.dispose?.();
    root.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose?.();
      }
    });
    root.parent?.remove(root);
  }

  staticGroup.updateMatrixWorld(true);
  staticGroup.traverse((node) => {
    if (node === staticGroup) return;
    node.updateMatrix();
    node.matrixAutoUpdate = false;
  });

  updateWaitingBoard({ mode: 'guns', fillBots: true, lobbyPlayers: [], availableWeapons: [] }, true);
  updateArenaBoard({ mode: 'guns', timeLeftSec: 150, scoreboard: [] }, true);

  return {
    root,
    staticGroup,
    dynamicGroup,
    botAvatars,
    updateWaitingBoard,
    updateArenaBoard,
    updateArena,
    triggerBotAttackAnim,
    clearCombatants,
    getWaitingRoomConfig,
    getArenaConfig,
    dispose
  };
}
