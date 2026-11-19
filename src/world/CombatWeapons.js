import * as THREE from 'three';

export const COMBAT_MODES = {
  guns: {
    id: 'guns',
    label: 'Mode Fusils (Distance)',
    shortLabel: 'Fusils',
    icon: '🔫'
  },
  melee: {
    id: 'melee',
    label: 'Mode Mêlée (Corps-à-corps)',
    shortLabel: 'Mêlée',
    icon: '⚔️'
  }
};

export const COMBAT_WEAPONS = [
  {
    id: 'fiber_rifle',
    mode: 'guns',
    slot: 1,
    name: 'Fusil d’Assaut Fibre Optique',
    shortName: 'Fibre Optique',
    icon: '🔵',
    damage: 20,
    fireRateMs: 135,
    magSize: 24,
    reloadMs: 1450,
    range: 36,
    pellets: 1,
    spread: 0.014,
    auto: true,
    beamColor: '#22d3ee',
    sparkColor: '#67e8f9',
    style: 'laser',
    description: 'Cadence rapide, faisceaux laser cyan précis, chargeur 24 tirs.'
  },
  {
    id: 'udp_shotgun',
    mode: 'guns',
    slot: 2,
    name: 'Fusil à Pompe Paquets UDP',
    shortName: 'Pompe UDP',
    icon: '🟠',
    damage: 14,
    fireRateMs: 760,
    magSize: 8,
    reloadMs: 1850,
    range: 15,
    pellets: 6,
    spread: 0.11,
    auto: false,
    beamColor: '#f59e0b',
    sparkColor: '#fde047',
    style: 'packet',
    description: 'Projette une salve de 6 paquets IP lumineux en cône, dévastateur à courte portée.'
  },
  {
    id: 'ping_sniper',
    mode: 'guns',
    slot: 3,
    name: 'Sniper Ping 0ms (Oscillo-Railgun)',
    shortName: 'Sniper 0ms',
    icon: '🟣',
    damage: 78,
    fireRateMs: 1150,
    magSize: 5,
    reloadMs: 2100,
    range: 46,
    pellets: 1,
    spread: 0.002,
    auto: false,
    beamColor: '#a855f7',
    sparkColor: '#e879f9',
    style: 'sine_rail',
    description: 'Tir longue portée haute puissance avec traînée d’onde sinusoïdale.'
  },
  {
    id: 'plasma_solder_pistol',
    mode: 'guns',
    slot: 4,
    name: 'Pistolet à Souder Plasma',
    shortName: 'Pistolet Plasma',
    icon: '🟢',
    damage: 24,
    fireRateMs: 220,
    magSize: 15,
    reloadMs: 920,
    range: 26,
    pellets: 1,
    spread: 0.018,
    auto: false,
    beamColor: '#34d399',
    sparkColor: '#6ee7b7',
    style: 'plasma',
    description: 'Léger, précis, cadence nerveuse et recharge ultra rapide.'
  },
  {
    id: 'solder_iron_blade',
    mode: 'melee',
    slot: 1,
    name: 'Fer à Souder Incandescent',
    shortName: 'Fer à Souder',
    icon: '🔥',
    damage: 26,
    fireRateMs: 270,
    magSize: 0,
    reloadMs: 0,
    range: 2.35,
    arcCos: 0.35,
    knockback: 1.2,
    dashDist: 0.35,
    aoeRadius: 0,
    beamColor: '#fb923c',
    sparkColor: '#fde047',
    style: 'melee',
    description: 'Frappes très rapides avec pointe rougeoyante et projection d’étincelles.'
  },
  {
    id: 'rj45_crimper_heavy',
    mode: 'melee',
    slot: 2,
    name: 'Pince à Sertir RJ45 Géante',
    shortName: 'Pince RJ45',
    icon: '🛠️',
    damage: 54,
    fireRateMs: 680,
    magSize: 0,
    reloadMs: 0,
    range: 2.65,
    arcCos: 0.45,
    knockback: 4.8,
    dashDist: 0.25,
    aoeRadius: 0,
    beamColor: '#ef4444',
    sparkColor: '#fca5a5',
    style: 'melee',
    description: 'Coup lourd qui inflige de gros dégâts et repousse l’adversaire.'
  },
  {
    id: 'ddr5_katana',
    mode: 'melee',
    slot: 3,
    name: 'Katana Barrette RAM DDR5',
    shortName: 'Katana DDR5',
    icon: '⚡',
    damage: 34,
    fireRateMs: 330,
    magSize: 0,
    reloadMs: 0,
    range: 2.75,
    arcCos: 0.25,
    knockback: 1.8,
    dashDist: 2.1,
    aoeRadius: 0,
    beamColor: '#38bdf8',
    sparkColor: '#67e8f9',
    style: 'melee',
    description: 'Lame néon ultra fluide avec combo rapide et léger dash vers l’avant.'
  },
  {
    id: 'switch24_hammer',
    mode: 'melee',
    slot: 4,
    name: 'Marteau Switch 24 Ports',
    shortName: 'Marteau 24P',
    icon: '🔨',
    damage: 62,
    fireRateMs: 820,
    magSize: 0,
    reloadMs: 0,
    range: 3.1,
    arcCos: -0.25,
    knockback: 3.6,
    dashDist: 0.4,
    aoeRadius: 2.6,
    beamColor: '#10b981',
    sparkColor: '#34d399',
    style: 'melee',
    description: 'Coup de masse puissant à large portée de zone.'
  }
];

const WEAPON_BY_ID = new Map(COMBAT_WEAPONS.map((w) => [w.id, w]));

export function getCombatWeaponById(weaponId) {
  if (!weaponId || typeof weaponId !== 'string') return null;
  return WEAPON_BY_ID.get(weaponId.trim()) || null;
}

export function getWeaponsByMode(mode = 'guns') {
  const cleanMode = mode === 'melee' ? 'melee' : 'guns';
  return COMBAT_WEAPONS.filter((w) => w.mode === cleanMode);
}

export function getDefaultWeaponForMode(mode = 'guns') {
  const list = getWeaponsByMode(mode);
  return list[0] || COMBAT_WEAPONS[0];
}

export function buildCombatWeaponMesh(weaponId, { viewModel = false } = {}) {
  const spec = getCombatWeaponById(weaponId) || COMBAT_WEAPONS[0];
  const group = new THREE.Group();
  group.name = `combat-weapon-${spec.id}`;

  const darkMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    roughness: 0.35,
    metalness: 0.78
  });
  const metalMat = new THREE.MeshStandardMaterial({
    color: '#475569',
    roughness: 0.28,
    metalness: 0.85
  });
  const glowMat = new THREE.MeshBasicMaterial({
    color: spec.beamColor || '#22d3ee'
  });

  let muzzleOffset = { x: 0, y: 0.04, z: -0.46 };

  if (spec.id === 'fiber_rifle') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.11, 0.48), darkMat);
    body.position.set(0, 0.02, -0.14);
    group.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.34, 10), metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.045, -0.42);
    group.add(barrel);
    const fiberTube = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.024, 0.44), glowMat);
    fiberTube.position.set(0, 0.082, -0.2);
    group.add(fiberTube);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.14, 0.075), metalMat);
    mag.position.set(0, -0.07, -0.16);
    mag.rotation.x = 0.18;
    group.add(mag);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.11, 0.055), darkMat);
    grip.position.set(0, -0.06, 0.02);
    grip.rotation.x = 0.25;
    group.add(grip);
    muzzleOffset = { x: 0, y: 0.045, z: -0.6 };
  } else if (spec.id === 'udp_shotgun') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.11, 0.42), darkMat);
    body.position.set(0, 0.02, -0.12);
    group.add(body);
    const twinBarrelA = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.36, 10), metalMat);
    twinBarrelA.rotation.x = Math.PI / 2;
    twinBarrelA.position.set(-0.024, 0.045, -0.36);
    group.add(twinBarrelA);
    const twinBarrelB = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.36, 10), metalMat);
    twinBarrelB.rotation.x = Math.PI / 2;
    twinBarrelB.position.set(0.024, 0.045, -0.36);
    group.add(twinBarrelB);
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.065, 0.16), glowMat);
    pump.position.set(0, -0.025, -0.32);
    group.add(pump);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.09, 0.18), darkMat);
    stock.position.set(0, -0.02, 0.12);
    group.add(stock);
    muzzleOffset = { x: 0, y: 0.045, z: -0.56 };
  } else if (spec.id === 'ping_sniper') {
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.095, 0.52), darkMat);
    chassis.position.set(0, 0.02, -0.15);
    group.add(chassis);
    const longBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.56, 10), metalMat);
    longBarrel.rotation.x = Math.PI / 2;
    longBarrel.position.set(0, 0.04, -0.58);
    group.add(longBarrel);
    const railCoilA = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.44), glowMat);
    railCoilA.position.set(0, 0.065, -0.45);
    group.add(railCoilA);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.024, 0.22, 12), darkMat);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.11, -0.14);
    group.add(scope);
    const scopeLens = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 12), glowMat);
    scopeLens.rotation.x = Math.PI / 2;
    scopeLens.position.set(0, 0.11, -0.25);
    group.add(scopeLens);
    muzzleOffset = { x: 0, y: 0.04, z: -0.88 };
  } else if (spec.id === 'plasma_solder_pistol') {
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.075, 0.28), darkMat);
    slide.position.set(0, 0.035, -0.1);
    group.add(slide);
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.026, 0.2), glowMat);
    core.position.set(0, 0.048, -0.11);
    group.add(core);
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.09, 10), metalMat);
    nozzle.rotation.x = -Math.PI / 2;
    nozzle.position.set(0, 0.035, -0.28);
    group.add(nozzle);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.12, 0.056), darkMat);
    grip.position.set(0, -0.05, 0.0);
    grip.rotation.x = 0.24;
    group.add(grip);
    muzzleOffset = { x: 0, y: 0.035, z: -0.34 };
  } else if (spec.id === 'solder_iron_blade') {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.22, 10), darkMat);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0, 0, -0.06);
    group.add(handle);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.024, 0.04, 10), metalMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0, -0.18);
    group.add(collar);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.28, 10), metalMat);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.set(0, 0, -0.33);
    group.add(shaft);
    const hotTip = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.12, 10), glowMat);
    hotTip.rotation.x = -Math.PI / 2;
    hotTip.position.set(0, 0, -0.52);
    group.add(hotTip);
    muzzleOffset = { x: 0, y: 0, z: -0.58 };
  } else if (spec.id === 'rj45_crimper_heavy') {
    const gripA = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.24, 0.055), glowMat);
    gripA.position.set(-0.028, -0.06, -0.04);
    gripA.rotation.z = 0.16;
    group.add(gripA);
    const gripB = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.24, 0.055), darkMat);
    gripB.position.set(0.028, -0.06, -0.04);
    gripB.rotation.z = -0.16;
    group.add(gripB);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.22), metalMat);
    head.position.set(0, 0.08, -0.16);
    group.add(head);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.14), glowMat);
    jaw.position.set(0, 0.12, -0.28);
    group.add(jaw);
    muzzleOffset = { x: 0, y: 0.12, z: -0.36 };
  } else if (spec.id === 'ddr5_katana') {
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.22, 10), darkMat);
    hilt.position.set(0, 0.02, 0);
    group.add(hilt);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.07), metalMat);
    guard.position.set(0, 0.13, 0);
    group.add(guard);
    const pcbBlade = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.66, 0.055), darkMat);
    pcbBlade.position.set(0, 0.47, 0);
    group.add(pcbBlade);
    const neonEdge = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.65, 0.016), glowMat);
    neonEdge.position.set(0, 0.47, -0.032);
    group.add(neonEdge);
    const goldPins = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.48, 0.014), new THREE.MeshBasicMaterial({ color: '#fbbf24' }));
    goldPins.position.set(0, 0.44, 0.026);
    group.add(goldPins);
    if (!viewModel) {
      group.rotation.x = -Math.PI * 0.32;
    } else {
      group.rotation.x = -Math.PI * 0.24;
    }
    muzzleOffset = { x: 0, y: 0.78, z: -0.05 };
  } else {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.68, 10), metalMat);
    shaft.position.set(0, 0.22, 0);
    group.add(shaft);
    const switchBody = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.16), darkMat);
    switchBody.position.set(0, 0.56, 0);
    group.add(switchBody);
    const portStrip = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.17), glowMat);
    portStrip.position.set(0, 0.56, 0);
    group.add(portStrip);
    group.rotation.x = -Math.PI * 0.28;
    muzzleOffset = { x: 0, y: 0.62, z: -0.14 };
  }

  if (viewModel) {
    group.scale.setScalar(0.95);
  } else {
    group.scale.setScalar(0.86);
  }

  return {
    group,
    weaponId: spec.id,
    spec,
    muzzleOffset,
    dispose: () => {
      group.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) m.dispose?.();
        }
      });
    }
  };
}

export function createCombatVfxPool(scene) {
  const beamPool = [];
  const sinePool = [];
  const sparkPool = [];
  const slashPool = [];

  const beamGeom = new THREE.CylinderGeometry(0.018, 0.018, 1, 6);
  for (let i = 0; i < 36; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: '#22d3ee',
      transparent: true,
      opacity: 0.9
    });
    const mesh = new THREE.Mesh(beamGeom, mat);
    mesh.visible = false;
    scene?.add?.(mesh);
    beamPool.push({ mesh, mat, ttl: 0, maxTtl: 0.14 });
  }

  const sinePointCount = 28;
  for (let i = 0; i < 4; i++) {
    const positions = new Float32Array(sinePointCount * 3);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: '#a855f7',
      transparent: true,
      opacity: 0.95
    });
    const line = new THREE.Line(geom, mat);
    line.visible = false;
    line.frustumCulled = false;
    scene?.add?.(line);
    sinePool.push({ line, geom, positions, mat, ttl: 0, maxTtl: 0.32 });
  }

  const sparkGeom = new THREE.BoxGeometry(0.048, 0.048, 0.048);
  for (let i = 0; i < 48; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: '#fde047',
      transparent: true,
      opacity: 0.95
    });
    const mesh = new THREE.Mesh(sparkGeom, mat);
    mesh.visible = false;
    scene?.add?.(mesh);
    sparkPool.push({ mesh, mat, vx: 0, vy: 0, vz: 0, ttl: 0, maxTtl: 0.28 });
  }

  const slashGeom = new THREE.RingGeometry(0.55, 1.05, 18, 1, Math.PI * 0.08, Math.PI * 0.84);
  slashGeom.rotateX(-Math.PI / 2);
  for (let i = 0; i < 8; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    const mesh = new THREE.Mesh(slashGeom, mat);
    mesh.visible = false;
    scene?.add?.(mesh);
    slashPool.push({ mesh, mat, ttl: 0, maxTtl: 0.2, startYaw: 0 });
  }

  const _vStart = new THREE.Vector3();
  const _vEnd = new THREE.Vector3();
  const _vDir = new THREE.Vector3();
  const _vMid = new THREE.Vector3();
  const _vSide = new THREE.Vector3();
  const _vUp = new THREE.Vector3(0, 1, 0);
  const _qA = new THREE.Quaternion();

  function acquireSlot(pool) {
    let oldest = pool[0];
    for (let i = 0; i < pool.length; i++) {
      if (pool[i].ttl <= 0) return pool[i];
      if (pool[i].ttl < oldest.ttl) oldest = pool[i];
    }
    return oldest;
  }

  function spawnImpactSparks(x, y, z, colorHex = '#fde047', count = 6) {
    const n = Math.max(1, Math.min(12, count | 0));
    for (let i = 0; i < n; i++) {
      const slot = acquireSlot(sparkPool);
      const ang = (i / n) * Math.PI * 2 + (i % 3) * 0.35;
      const spd = 2.1 + (i % 4) * 0.95;
      slot.mesh.position.set(x, y, z);
      slot.mesh.scale.setScalar(1);
      slot.mat.color.set(colorHex);
      slot.mat.opacity = 1;
      slot.vx = Math.cos(ang) * spd;
      slot.vy = 1.6 + (i % 3) * 0.85;
      slot.vz = Math.sin(ang) * spd;
      slot.ttl = 0.26;
      slot.maxTtl = 0.26;
      slot.mesh.visible = true;
    }
  }

  function spawnShot(weaponId, sx, sy, sz, ex, ey, ez) {
    const spec = getCombatWeaponById(weaponId) || COMBAT_WEAPONS[0];
    _vStart.set(sx, sy, sz);
    _vEnd.set(ex, ey, ez);
    _vDir.subVectors(_vEnd, _vStart);
    const len = _vDir.length();
    if (len < 0.05) return;
    _vDir.divideScalar(len);
    _vMid.addVectors(_vStart, _vEnd).multiplyScalar(0.5);

    const beamSlot = acquireSlot(beamPool);
    _qA.setFromUnitVectors(_vUp, _vDir);
    beamSlot.mesh.position.copy(_vMid);
    beamSlot.mesh.quaternion.copy(_qA);
    const thick = spec.style === 'sine_rail' ? 1.55 : spec.style === 'packet' ? 1.3 : 1.0;
    beamSlot.mesh.scale.set(thick, len, thick);
    beamSlot.mat.color.set(spec.beamColor || '#22d3ee');
    beamSlot.mat.opacity = 0.95;
    beamSlot.maxTtl = spec.style === 'sine_rail' ? 0.28 : 0.13;
    beamSlot.ttl = beamSlot.maxTtl;
    beamSlot.mesh.visible = true;

    if (spec.style === 'sine_rail') {
      const sSlot = acquireSlot(sinePool);
      _vSide.crossVectors(_vDir, _vUp);
      if (_vSide.lengthSq() < 0.001) {
        _vSide.set(1, 0, 0);
      } else {
        _vSide.normalize();
      }
      for (let i = 0; i < sinePointCount; i++) {
        const t = i / (sinePointCount - 1);
        const amp = Math.sin(t * Math.PI * 8) * 0.14 * Math.sin(t * Math.PI);
        const px = sx + (ex - sx) * t + _vSide.x * amp;
        const py = sy + (ey - sy) * t + Math.cos(t * Math.PI * 8) * 0.05;
        const pz = sz + (ez - sz) * t + _vSide.z * amp;
        sSlot.positions[i * 3] = px;
        sSlot.positions[i * 3 + 1] = py;
        sSlot.positions[i * 3 + 2] = pz;
      }
      sSlot.geom.attributes.position.needsUpdate = true;
      sSlot.mat.color.set(spec.beamColor || '#a855f7');
      sSlot.mat.opacity = 1;
      sSlot.ttl = sSlot.maxTtl;
      sSlot.line.visible = true;
    }

    spawnImpactSparks(ex, ey, ez, spec.sparkColor || '#fde047', spec.style === 'packet' ? 3 : 5);
  }

  function spawnMeleeSlash(weaponId, ox, oy, oz, yaw = 0) {
    const spec = getCombatWeaponById(weaponId) || getDefaultWeaponForMode('melee');
    const slot = acquireSlot(slashPool);
    const radiusScale = spec.aoeRadius > 0 ? spec.aoeRadius * 0.8 : (spec.range || 2.4) * 0.55;
    slot.mesh.position.set(
      ox - Math.sin(yaw) * 0.72,
      oy,
      oz - Math.cos(yaw) * 0.72
    );
    slot.mesh.rotation.set(0, yaw, 0);
    slot.mesh.scale.setScalar(Math.max(0.6, radiusScale));
    slot.mat.color.set(spec.beamColor || '#38bdf8');
    slot.mat.opacity = 0.92;
    slot.ttl = slot.maxTtl;
    slot.mesh.visible = true;

    spawnImpactSparks(
      ox - Math.sin(yaw) * 1.1,
      oy,
      oz - Math.cos(yaw) * 1.1,
      spec.sparkColor || '#fde047',
      6
    );
  }

  function update(dt = 0.016) {
    const step = Math.max(0.001, Math.min(0.1, Number(dt) || 0.016));
    for (let i = 0; i < beamPool.length; i++) {
      const b = beamPool[i];
      if (b.ttl <= 0) continue;
      b.ttl -= step;
      if (b.ttl <= 0) {
        b.mesh.visible = false;
      } else {
        b.mat.opacity = Math.max(0, b.ttl / b.maxTtl);
      }
    }
    for (let i = 0; i < sinePool.length; i++) {
      const s = sinePool[i];
      if (s.ttl <= 0) continue;
      s.ttl -= step;
      if (s.ttl <= 0) {
        s.line.visible = false;
      } else {
        s.mat.opacity = Math.max(0, s.ttl / s.maxTtl);
      }
    }
    for (let i = 0; i < sparkPool.length; i++) {
      const sp = sparkPool[i];
      if (sp.ttl <= 0) continue;
      sp.ttl -= step;
      if (sp.ttl <= 0) {
        sp.mesh.visible = false;
      } else {
        sp.vy -= 9.8 * step;
        sp.mesh.position.x += sp.vx * step;
        sp.mesh.position.y = Math.max(0.04, sp.mesh.position.y + sp.vy * step);
        sp.mesh.position.z += sp.vz * step;
        sp.mat.opacity = Math.max(0, sp.ttl / sp.maxTtl);
        sp.mesh.scale.setScalar(0.4 + 0.6 * (sp.ttl / sp.maxTtl));
      }
    }
    for (let i = 0; i < slashPool.length; i++) {
      const sl = slashPool[i];
      if (sl.ttl <= 0) continue;
      sl.ttl -= step;
      if (sl.ttl <= 0) {
        sl.mesh.visible = false;
      } else {
        sl.mat.opacity = Math.max(0, sl.ttl / sl.maxTtl);
      }
    }
  }

  function clear() {
    for (const b of beamPool) {
      b.ttl = 0;
      b.mesh.visible = false;
    }
    for (const s of sinePool) {
      s.ttl = 0;
      s.line.visible = false;
    }
    for (const sp of sparkPool) {
      sp.ttl = 0;
      sp.mesh.visible = false;
    }
    for (const sl of slashPool) {
      sl.ttl = 0;
      sl.mesh.visible = false;
    }
  }

  function dispose() {
    clear();
    beamGeom.dispose();
    sparkGeom.dispose();
    slashGeom.dispose();
    for (const b of beamPool) {
      b.mesh.parent?.remove(b.mesh);
      b.mat.dispose();
    }
    for (const s of sinePool) {
      s.line.parent?.remove(s.line);
      s.geom.dispose();
      s.mat.dispose();
    }
    for (const sp of sparkPool) {
      sp.mesh.parent?.remove(sp.mesh);
      sp.mat.dispose();
    }
    for (const sl of slashPool) {
      sl.mesh.parent?.remove(sl.mesh);
      sl.mat.dispose();
    }
  }

  return {
    spawnShot,
    spawnMeleeSlash,
    spawnImpactSparks,
    update,
    clear,
    getPoolStats: () => ({
      beams: beamPool.length,
      sineRails: sinePool.length,
      sparks: sparkPool.length,
      slashes: slashPool.length
    }),
    dispose
  };
}
