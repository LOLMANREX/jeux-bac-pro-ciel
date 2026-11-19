import * as THREE from 'three';
import { animateAvatarLimbs, buildStudentAvatarMesh, disposeObject3D } from './AvatarBuilder.js';
import { animateCombatWeaponMesh, buildCombatWeaponMesh, COMBAT_MODES, getCombatWeaponById } from './CombatWeapons.js';
import {
  COMBAT_ARENA_BOUNDS,
  COMBAT_ARENA_CENTER,
  COMBAT_ARENA_OBSTACLES,
  COMBAT_PICKUP_SPOTS,
  COMBAT_WAITING_CENTER,
  getCombatArenaColliders
} from './CombatEngine.js';

function makeArenaCanvasTex(width, height, drawFn, scale = 1) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return null;
  }
  const s = Math.max(0.5, Math.min(1, Number(scale) || 1));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(128, Math.round(width * s));
  canvas.height = Math.max(64, Math.round(height * s));
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return null;
  if (typeof ctx.setTransform === 'function') {
    ctx.setTransform(s, 0, 0, s, 0, 0);
  }
  if (typeof drawFn === 'function') {
    drawFn(ctx, width, height);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return { canvas, ctx, tex, scale: s, logicalWidth: width, logicalHeight: height };
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

export function createCombatPocketRooms(scene, options = {}) {
  const lowRes = Boolean(options?.lowRes);
  const canvasScale = lowRes ? 0.5 : 1.0;
  const root = new THREE.Group();
  root.name = 'combat-pocket-rooms';
  scene.add(root);

  const staticGroup = new THREE.Group();
  staticGroup.name = 'combat-static-structure';
  root.add(staticGroup);

  const waitingGroup = new THREE.Group();
  waitingGroup.name = 'combat-waiting-structure';
  staticGroup.add(waitingGroup);

  const arenaStaticGroup = new THREE.Group();
  arenaStaticGroup.name = 'combat-arena-structure';
  staticGroup.add(arenaStaticGroup);

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
  waitingGroup.add(waitFloor);

  const waitCeil = new THREE.Mesh(
    new THREE.PlaneGeometry(waitW, waitD),
    new THREE.MeshStandardMaterial({ color: '#070b14', roughness: 0.86 })
  );
  waitCeil.rotation.x = Math.PI / 2;
  waitCeil.position.set(wc.x, waitH, wc.z);
  waitingGroup.add(waitCeil);

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
    waitingGroup.add(m);
  }

  const waitNeon = new THREE.Mesh(
    new THREE.BoxGeometry(waitW - 0.6, 0.08, 0.08),
    new THREE.MeshBasicMaterial({ color: '#06b6d4' })
  );
  waitNeon.position.set(wc.x, waitH - 0.22, wc.z - waitD / 2 + 0.16);
  waitingGroup.add(waitNeon);

  const waitCeilStrip = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 0.06, 0.36),
    new THREE.MeshBasicMaterial({ color: '#38bdf8' })
  );
  waitCeilStrip.position.set(wc.x, waitH - 0.05, wc.z);
  waitingGroup.add(waitCeilStrip);

  const lobbyScreen = makeArenaCanvasTex(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = '#060c19';
    ctx.fillRect(0, 0, w, h);
  }, canvasScale);
  const lobbyBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(6.8, 3.0),
    new THREE.MeshBasicMaterial({ map: lobbyScreen?.tex || null })
  );
  lobbyBoard.position.set(wc.x, 2.25, wc.z - waitD / 2 + 0.18);
  waitingGroup.add(lobbyBoard);

  const consoleMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.68, roughness: 0.3 });
  const consoleBaseGeo = new THREE.BoxGeometry(1.0, 1.12, 0.72);
  const consoleCapGeo = new THREE.BoxGeometry(0.84, 0.08, 0.54);
  const buildConsole = (x, z, topColor, id, type, label) => {
    const base = new THREE.Mesh(consoleBaseGeo, consoleMat);
    base.position.set(x, 0.56, z);
    waitingGroup.add(base);
    const capMat = new THREE.MeshBasicMaterial({ color: topColor });
    const cap = new THREE.Mesh(consoleCapGeo, capMat);
    cap.position.set(x, 1.16, z);
    waitingGroup.add(cap);
    return {
      id,
      type,
      label,
      position: new THREE.Vector3(x, 0, z),
      interactRadius: 2.5,
      mesh: base,
      capMat
    };
  };

  const botsConsole = buildConsole(wc.x - 1.1, wc.z - 2.8, '#10b981', 'combat-lobby-bots', 'combat_lobby_bots', '[E] 🤖 Bots IA : ACTIVÉS');
  const waitingInteractables = [
    buildConsole(wc.x - 3.3, wc.z - 2.8, '#06b6d4', 'combat-lobby-mode', 'combat_lobby_mode', '[E] 🔄 Changer Mode (Fusils / Mêlée)'),
    botsConsole,
    buildConsole(wc.x + 1.1, wc.z - 2.8, '#10b981', 'combat-lobby-ready', 'combat_lobby_ready', '[E] ⚔️ Prêt / Lancer l’Arène'),
    buildConsole(wc.x + 3.3, wc.z - 2.8, '#f43f5e', 'combat-lobby-exit', 'combat_lobby_exit', '[E] 🚪 Quitter le Lobby Combat')
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
  arenaStaticGroup.add(arenaFloor);

  const arenaCeil = new THREE.Mesh(
    new THREE.PlaneGeometry(ab.width, ab.depth),
    new THREE.MeshStandardMaterial({ color: '#050811', roughness: 0.9 })
  );
  arenaCeil.rotation.x = Math.PI / 2;
  arenaCeil.position.set(ac.x, ab.height, ac.z);
  arenaStaticGroup.add(arenaCeil);

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
    arenaStaticGroup.add(wMesh);
  }

  const unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);
  const barMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const barSpecs = [
    [ac.x - 8, ac.z - 6, '#22d3ee'],
    [ac.x + 8, ac.z - 6, '#f59e0b'],
    [ac.x - 8, ac.z + 6, '#38bdf8'],
    [ac.x + 8, ac.z + 6, '#a855f7']
  ];
  const barInst = new THREE.InstancedMesh(unitBoxGeo, barMat, barSpecs.length);
  const _mTmp = new THREE.Matrix4();
  const _qId = new THREE.Quaternion();
  const _pTmp = new THREE.Vector3();
  const _sTmp = new THREE.Vector3();
  const _cTmp = new THREE.Color();
  for (let i = 0; i < barSpecs.length; i++) {
    const [lx, lz, col] = barSpecs[i];
    _pTmp.set(lx, ab.height - 0.12, lz);
    _sTmp.set(3.2, 0.08, 0.24);
    _mTmp.compose(_pTmp, _qId, _sTmp);
    barInst.setMatrixAt(i, _mTmp);
    barInst.setColorAt(i, _cTmp.set(col));
  }
  barInst.instanceMatrix.needsUpdate = true;
  if (barInst.instanceColor) barInst.instanceColor.needsUpdate = true;
  arenaStaticGroup.add(barInst);

  const obsDarkMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.4, metalness: 0.72 });
  const obsCrateMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.52, metalness: 0.42 });
  const obsPillarMat = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.35, metalness: 0.8 });

  const racksList = [];
  const cratesList = [];
  const pillarsList = [];
  let rackLedTotal = 0;
  for (const obs of COMBAT_ARENA_OBSTACLES) {
    if (obs.kind === 'crate') cratesList.push(obs);
    else if (obs.kind === 'pillar') pillarsList.push(obs);
    else {
      racksList.push(obs);
      if (obs.kind === 'rack') rackLedTotal += 4;
    }
  }

  const buildObsInstanced = (list, mat) => {
    if (list.length === 0) return;
    const inst = new THREE.InstancedMesh(unitBoxGeo, mat, list.length);
    inst.castShadow = true;
    inst.receiveShadow = true;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      _pTmp.set(o.x, o.height / 2, o.z);
      _sTmp.set(o.w, o.height, o.d);
      _mTmp.compose(_pTmp, _qId, _sTmp);
      inst.setMatrixAt(i, _mTmp);
    }
    inst.instanceMatrix.needsUpdate = true;
    arenaStaticGroup.add(inst);
  };
  buildObsInstanced(racksList, obsDarkMat);
  buildObsInstanced(cratesList, obsCrateMat);
  buildObsInstanced(pillarsList, obsPillarMat);

  const trimInst = new THREE.InstancedMesh(unitBoxGeo, barMat, COMBAT_ARENA_OBSTACLES.length);
  for (let i = 0; i < COMBAT_ARENA_OBSTACLES.length; i++) {
    const obs = COMBAT_ARENA_OBSTACLES[i];
    _pTmp.set(obs.x, obs.kind === 'pillar' ? 2.4 : obs.height - 0.08, obs.z);
    _sTmp.set(obs.w + 0.03, 0.07, obs.d + 0.03);
    _mTmp.compose(_pTmp, _qId, _sTmp);
    trimInst.setMatrixAt(i, _mTmp);
    trimInst.setColorAt(i, _cTmp.set(obs.color || '#22d3ee'));
  }
  trimInst.instanceMatrix.needsUpdate = true;
  if (trimInst.instanceColor) trimInst.instanceColor.needsUpdate = true;
  arenaStaticGroup.add(trimInst);

  if (rackLedTotal > 0) {
    const ledInst = new THREE.InstancedMesh(unitBoxGeo, barMat, rackLedTotal);
    let liIdx = 0;
    for (const obs of racksList) {
      if (obs.kind !== 'rack') continue;
      for (let li = 0; li < 4; li++) {
        _pTmp.set(obs.x, 0.45 + li * 0.45, obs.z);
        _sTmp.set(obs.w * 0.55, 0.04, obs.d + 0.02);
        _mTmp.compose(_pTmp, _qId, _sTmp);
        ledInst.setMatrixAt(liIdx, _mTmp);
        ledInst.setColorAt(liIdx, _cTmp.set(li % 2 === 0 ? '#22d3ee' : '#10b981'));
        liIdx++;
      }
    }
    ledInst.instanceMatrix.needsUpdate = true;
    if (ledInst.instanceColor) ledInst.instanceColor.needsUpdate = true;
    arenaStaticGroup.add(ledInst);
  }

  const arenaScreen = makeArenaCanvasTex(1024, 384, (ctx, w, h) => {
    ctx.fillStyle = '#060c19';
    ctx.fillRect(0, 0, w, h);
  }, canvasScale);
  const arenaBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(8.4, 2.8),
    new THREE.MeshBasicMaterial({ map: arenaScreen?.tex || null })
  );
  arenaBoard.position.set(ac.x, 3.6, ab.minZ + 0.22);
  arenaStaticGroup.add(arenaBoard);

  const pickupVisuals = new Map();
  const pickupPadGeo = new THREE.RingGeometry(0.42, 0.58, 20);
  const pickupPadMat = new THREE.MeshBasicMaterial({ color: '#10b981', side: THREE.DoubleSide, transparent: true, opacity: 0.72 });
  const pickupOrbGeo = new THREE.OctahedronGeometry(0.28, 0);
  const pickupOrbMat = new THREE.MeshBasicMaterial({ color: '#34d399' });
  for (const spot of COMBAT_PICKUP_SPOTS) {
    const pGrp = new THREE.Group();
    pGrp.position.set(spot.x, 0, spot.z);
    dynamicGroup.add(pGrp);

    const pad = new THREE.Mesh(pickupPadGeo, pickupPadMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.03;
    pGrp.add(pad);

    const orb = new THREE.Mesh(pickupOrbGeo, pickupOrbMat);
    orb.position.y = 0.85;
    pGrp.add(orb);

    pickupVisuals.set(spot.id, { group: pGrp, orb, pad });
  }

  const botAvatars = new Map();
  const _camWorldPos = new THREE.Vector3();
  const _activeBotIds = new Set();
  let lastLobbyDrawMs = 0;
  let lastLobbySig = '';
  let lastArenaBoardMs = 0;
  let lastArenaSig = '';
  let lobbyUploadCount = 0;
  let arenaUploadCount = 0;

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
    const botsEnabled = snapshot?.botsEnabled !== undefined ? Boolean(snapshot.botsEnabled) : snapshot?.fillBots !== false;
    if (botsConsole?.capMat) {
      botsConsole.capMat.color.set(botsEnabled ? '#10b981' : '#ef4444');
    }
    if (botsConsole) {
      botsConsole.label = botsEnabled ? '[E] 🤖 Bots IA : ACTIVÉS (Désactiver)' : '[E] 🤖 Bots IA : DÉSACTIVÉS (Activer)';
    }
    if (!lobbyScreen?.ctx || !lobbyScreen?.tex) return false;
    const modeId = snapshot?.mode === 'melee' ? 'melee' : 'guns';
    const players = Array.isArray(snapshot?.lobbyPlayers) ? snapshot.lobbyPlayers : [];
    let pSig = '';
    for (let i = 0; i < Math.min(4, players.length); i++) {
      const p = players[i];
      pSig += `${p.id || p.name}:${p.ready ? 1 : 0}:${p.weaponId || ''}|`;
    }
    const sig = `${modeId}|${botsEnabled ? 1 : 0}|${pSig}`;
    const now = Date.now();
    if (!force && sig === lastLobbySig) return false;
    if (!force && now - lastLobbyDrawMs < 200) return false;
    lastLobbyDrawMs = now;
    lastLobbySig = sig;

    const { ctx } = lobbyScreen;
    if (typeof ctx.setTransform === 'function') {
      ctx.setTransform(lobbyScreen.scale || 1, 0, 0, lobbyScreen.scale || 1, 0, 0);
    }
    const W = 1024;
    const H = 512;
    ctx.fillStyle = '#050b18';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, W - 20, H - 20);

    const modeMeta = COMBAT_MODES[modeId];

    ctx.fillStyle = '#22d3ee';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText('⚔️ ARÈNE DE COMBAT CIEL — SALLE D’ATTENTE', 36, 58);

    ctx.fillStyle = modeId === 'guns' ? '#38bdf8' : '#fb923c';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(`Mode Actif : ${modeMeta.icon} ${modeMeta.label}`, 36, 106);

    ctx.fillStyle = botsEnabled ? '#6ee7b7' : '#fca5a5';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(
      `Objectif : 10 éliminations ou 2m30 • ${botsEnabled ? 'Bots IA : ACTIVÉS (3+ bots)' : 'Bots IA : DÉSACTIVÉS (0 bot — Solo / PvP Pur)'}`,
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
    lobbyUploadCount++;
    return true;
  }

  function updateArenaBoard(snapshot, force = false) {
    if (!arenaScreen?.ctx || !arenaScreen?.tex) return false;
    const t = Math.max(0, Math.floor(Number(snapshot?.timeLeftSec) || 0));
    const modeTag = snapshot?.mode === 'melee' ? 'melee' : 'guns';
    const rows = Array.isArray(snapshot?.scoreboard) ? snapshot.scoreboard : [];
    let rSig = '';
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const r = rows[i];
      rSig += `${r.name || ''}:${r.kills || 0}:${r.deaths || 0}|`;
    }
    const sig = `${modeTag}|${t}|${rSig}`;
    const now = Date.now();
    if (!force && sig === lastArenaSig) return false;
    if (!force && now - lastArenaBoardMs < 250) return false;
    lastArenaBoardMs = now;
    lastArenaSig = sig;

    const { ctx } = arenaScreen;
    if (typeof ctx.setTransform === 'function') {
      ctx.setTransform(arenaScreen.scale || 1, 0, 0, arenaScreen.scale || 1, 0, 0);
    }
    const W = 1024;
    const H = 384;
    ctx.fillStyle = '#040914';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 5;
    ctx.strokeRect(8, 8, W - 16, H - 16);

    const mm = String(Math.floor(t / 60)).padStart(2, '0');
    const ss = String(t % 60).padStart(2, '0');
    const modeLabel = modeTag === 'melee' ? '⚔️ MODE MÊLÉE' : '🔫 MODE FUSILS';

    ctx.fillStyle = '#22d3ee';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText(`ARÈNE CIEL • ${modeLabel} • ⏱️ ${mm}:${ss}`, 32, 56);

    for (let idx = 0; idx < Math.min(5, rows.length); idx++) {
      const row = rows[idx];
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
    }

    arenaScreen.tex.needsUpdate = true;
    arenaUploadCount++;
    return true;
  }

  function updateArena(snapshot, dt = 0.016, elapsed = 0, camera = null) {
    if (!snapshot || !root.visible) return;
    updateArenaBoard(snapshot, false);

    const pkList = Array.isArray(snapshot.pickups) ? snapshot.pickups : [];
    for (let i = 0; i < pkList.length; i++) {
      const pk = pkList[i];
      const vis = pickupVisuals.get(pk.id);
      if (!vis) continue;
      vis.group.visible = Boolean(pk.active);
      if (pk.active) {
        vis.orb.rotation.y = elapsed * 2.2;
        vis.orb.position.y = 0.85 + Math.sin(elapsed * 3.1) * 0.12;
      }
    }

    const fighters = Array.isArray(snapshot.fighters) ? snapshot.fighters : [];
    _activeBotIds.clear();
    const nowMs = Date.now();
    const smooth = Math.min(1, dt * 14);
    let hasCamPos = false;
    if (camera) {
      if (typeof camera.getWorldPosition === 'function') {
        camera.getWorldPosition(_camWorldPos);
        hasCamPos = true;
      } else if (camera.position) {
        _camWorldPos.copy(camera.position);
        hasCamPos = true;
      }
    }

    for (let i = 0; i < fighters.length; i++) {
      const f = fighters[i];
      if (!f.isBot) continue;
      _activeBotIds.add(f.id);
      const entry = ensureBotVisual(f);
      entry.avatar.group.visible = Boolean(f.alive);
      if (!f.alive) continue;

      const curPos = entry.avatar.group.position;
      const ddx = f.x - curPos.x;
      const ddz = f.z - curPos.z;
      const moveDistSq = ddx * ddx + ddz * ddz;
      curPos.x += ddx * smooth;
      curPos.z += ddz * smooth;
      entry.avatar.group.rotation.y = (f.yaw || 0) + Math.PI;

      const ratio = Math.max(0.02, Math.min(1, (f.hp || 0) / Math.max(1, f.maxHp || 100)));
      entry.hpFill.scale.x = ratio;
      entry.hpFill.position.x = -0.43 * (1 - ratio);
      const nextColor = ratio > 0.5 ? '#34d399' : ratio > 0.25 ? '#f59e0b' : '#ef4444';
      if (entry._lastHpColor !== nextColor) {
        entry._lastHpColor = nextColor;
        entry.hpFillMat.color.set(nextColor);
      }

      if (hasCamPos) {
        entry.hpGroup.lookAt(_camWorldPos);
      }

      animateAvatarLimbs(entry.avatar, dt, {
        isMoving: moveDistSq > 0.000144,
        isGrounded: true,
        speedRatio: 1.15
      });

      if (nowMs < entry.attackAnimUntil) {
        entry.avatar.rightArm.rotation.x = -1.15;
      } else {
        entry.avatar.rightArm.rotation.x = -0.58;
      }
      if (entry.weaponObj) {
        animateCombatWeaponMesh(entry.weaponObj, { elapsed });
      }
    }

    for (const [botId, entry] of botAvatars.entries()) {
      if (!_activeBotIds.has(botId)) {
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
        { minX: wc.x - 3.85, maxX: wc.x - 2.75, minZ: wc.z - 3.2, maxZ: wc.z - 2.4 },
        { minX: wc.x - 1.65, maxX: wc.x - 0.55, minZ: wc.z - 3.2, maxZ: wc.z - 2.4 },
        { minX: wc.x + 0.55, maxX: wc.x + 1.65, minZ: wc.z - 3.2, maxZ: wc.z - 2.4 },
        { minX: wc.x + 2.75, maxX: wc.x + 3.85, minZ: wc.z - 3.2, maxZ: wc.z - 2.4 }
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

  function setZoneVisibility(zone = 'hidden') {
    if (zone === 'waiting') {
      root.visible = true;
      waitingGroup.visible = true;
      arenaStaticGroup.visible = false;
      dynamicGroup.visible = false;
    } else if (zone === 'arena') {
      root.visible = true;
      waitingGroup.visible = false;
      arenaStaticGroup.visible = true;
      dynamicGroup.visible = true;
    } else if (zone === 'all') {
      root.visible = true;
      waitingGroup.visible = true;
      arenaStaticGroup.visible = true;
      dynamicGroup.visible = true;
    } else {
      root.visible = false;
      waitingGroup.visible = false;
      arenaStaticGroup.visible = false;
      dynamicGroup.visible = false;
    }
  }

  return {
    root,
    staticGroup,
    waitingGroup,
    arenaStaticGroup,
    dynamicGroup,
    botAvatars,
    setZoneVisibility,
    getUploadCounts: () => ({ lobby: lobbyUploadCount, arena: arenaUploadCount }),
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
