import * as THREE from 'three';
import { getShopPetById, SHOP_PETS } from './ShopCatalog.js';

const _targetPos = new THREE.Vector3();
const _deltaVec = new THREE.Vector3();

function freezeStaticTree(root, dynamicSet = new Set()) {
  root.traverse((child) => {
    if (child === root || dynamicSet.has(child)) return;
    child.updateMatrix();
    child.matrixAutoUpdate = false;
  });
}

function normalizeAngleDiff(target, current) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export function disposePetObject(root) {
  if (!root) return;
  const geometries = new Set();
  const materials = new Set();
  root.traverse((obj) => {
    if (obj.geometry) geometries.add(obj.geometry);
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m && materials.add(m));
      } else {
        materials.add(obj.material);
      }
    }
  });
  for (const geom of geometries) {
    geom.dispose?.();
  }
  for (const mat of materials) {
    if (mat.map) mat.map.dispose?.();
    mat.dispose?.();
  }
}

export function buildPetMesh(petId = 'pet_cube_holo') {
  const spec = getShopPetById(petId) || SHOP_PETS[0];
  const group = new THREE.Group();
  group.name = `pet-${spec.id}`;

  const bodyRoot = new THREE.Group();
  bodyRoot.position.y = 0.55;
  group.add(bodyRoot);

  const primaryMat = new THREE.MeshStandardMaterial({
    color: spec.primaryColor || '#22d3ee',
    roughness: 0.28,
    metalness: 0.68
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    roughness: 0.4,
    metalness: 0.75
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: spec.accentColor || '#38bdf8',
    emissive: spec.emissiveColor || spec.accentColor || '#38bdf8',
    emissiveIntensity: 0.85,
    roughness: 0.2,
    metalness: 0.3
  });
  const holoMat = new THREE.MeshStandardMaterial({
    color: spec.primaryColor || '#22d3ee',
    emissive: spec.emissiveColor || '#38bdf8',
    emissiveIntensity: 0.65,
    transparent: true,
    opacity: 0.55,
    roughness: 0.15,
    metalness: 0.2
  });

  const groundRing = new THREE.Mesh(
    new THREE.RingGeometry(0.16, 0.23, 24),
    new THREE.MeshBasicMaterial({
      color: spec.accentColor || '#22d3ee',
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide
    })
  );
  groundRing.rotation.x = -Math.PI / 2;
  groundRing.position.y = 0.02;
  group.add(groundRing);

  const dynamicNodes = new Set([group, bodyRoot, groundRing]);
  const animParts = {
    rotors: [],
    legs: [],
    wings: [],
    rings: [],
    core: null,
    outerShell: null,
    tail: null,
    head: null,
    antennas: []
  };

  if (spec.id === 'pet_cube_holo') {
    const outerShell = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), holoMat);
    bodyRoot.add(outerShell);
    animParts.outerShell = outerShell;
    dynamicNodes.add(outerShell);

    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), glowMat);
    bodyRoot.add(core);
    animParts.core = core;
    dynamicNodes.add(core);

    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26 + i * 0.05, 0.012, 8, 28), glowMat);
      ring.rotation.x = i === 0 ? Math.PI / 3 : -Math.PI / 4;
      bodyRoot.add(ring);
      animParts.rings.push(ring);
      dynamicNodes.add(ring);
    }
  } else if (spec.id === 'pet_router_wifi7') {
    bodyRoot.position.y = 0.28;
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.11, 0.28), darkMat);
    bodyRoot.add(chassis);

    const topPlate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.24), primaryMat);
    topPlate.position.y = 0.06;
    bodyRoot.add(topPlate);

    const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.024, 0.02), glowMat);
    ledStrip.position.set(0, 0.01, 0.145);
    bodyRoot.add(ledStrip);

    const antPositions = [
      [-0.16, 0.14, -0.11],
      [0.16, 0.14, -0.11],
      [-0.12, 0.14, -0.13],
      [0.12, 0.14, -0.13]
    ];
    for (const [ax, ay, az] of antPositions) {
      const antPivot = new THREE.Group();
      antPivot.position.set(ax, 0.05, az);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.2, 8), primaryMat);
      rod.position.y = 0.1;
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), glowMat);
      tip.position.y = 0.21;
      antPivot.add(rod, tip);
      bodyRoot.add(antPivot);
      animParts.antennas.push(antPivot);
      dynamicNodes.add(antPivot);
    }

    const legCoords = [
      [-0.14, -0.05, 0.1],
      [0.14, -0.05, 0.1],
      [-0.14, -0.05, -0.1],
      [0.14, -0.05, -0.1]
    ];
    for (const [lx, ly, lz] of legCoords) {
      const legPivot = new THREE.Group();
      legPivot.position.set(lx, ly, lz);
      const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.04), primaryMat);
      legMesh.position.y = -0.06;
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.025, 0.065), glowMat);
      foot.position.set(0, -0.13, 0.01);
      legPivot.add(legMesh, foot);
      bodyRoot.add(legPivot);
      animParts.legs.push(legPivot);
      dynamicNodes.add(legPivot);
    }
  } else if (spec.id === 'pet_bot_rack1u') {
    bodyRoot.position.y = 0.34;
    const rackBody = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.3), primaryMat);
    bodyRoot.add(rackBody);

    const faceplate = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.02), darkMat);
    faceplate.position.z = 0.155;
    bodyRoot.add(faceplate);

    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.022), glowMat);
    eyeL.position.set(-0.08, 0.01, 0.16);
    const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.022), glowMat);
    eyeR.position.set(0.08, 0.01, 0.16);
    bodyRoot.add(eyeL, eyeR);

    for (const lx of [-0.11, 0.11]) {
      const legPivot = new THREE.Group();
      legPivot.position.set(lx, -0.08, 0);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.06), darkMat);
      leg.position.y = -0.08;
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.035, 0.13), glowMat);
      foot.position.set(0, -0.17, 0.02);
      legPivot.add(leg, foot);
      bodyRoot.add(legPivot);
      animParts.legs.push(legPivot);
      dynamicNodes.add(legPivot);
    }
  } else if (spec.id === 'pet_drone_quadri') {
    bodyRoot.position.y = 0.72;
    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.28), primaryMat);
    bodyRoot.add(pod);

    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), darkMat);
    dome.position.set(0, 0.04, 0.02);
    bodyRoot.add(dome);

    const camEye = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), glowMat);
    camEye.position.set(0, -0.03, 0.13);
    bodyRoot.add(camEye);

    const armDirs = [
      [-0.18, 0, -0.18],
      [0.18, 0, -0.18],
      [-0.18, 0, 0.18],
      [0.18, 0, 0.18]
    ];
    for (const [rx, ry, rz] of armDirs) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.022, 0.03), darkMat);
      arm.position.set(rx * 0.55, ry, rz * 0.55);
      arm.rotation.y = Math.atan2(rx, rz);
      bodyRoot.add(arm);

      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 10), primaryMat);
      hub.position.set(rx, 0.015, rz);
      bodyRoot.add(hub);

      const rotorPivot = new THREE.Group();
      rotorPivot.position.set(rx, 0.04, rz);
      const blade1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.006, 0.024), glowMat);
      const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.006, 0.18), glowMat);
      rotorPivot.add(blade1, blade2);
      bodyRoot.add(rotorPivot);
      animParts.rotors.push(rotorPivot);
      dynamicNodes.add(rotorPivot);
    }
  } else if (spec.id === 'pet_cyber_k9') {
    bodyRoot.position.y = 0.34;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.42), primaryMat);
    bodyRoot.add(torso);

    const spineStripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.38), glowMat);
    spineStripe.position.y = 0.085;
    bodyRoot.add(spineStripe);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.12, 0.22);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.13, 0.18), darkMat);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.12), primaryMat);
    snout.position.set(0, -0.02, 0.11);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.04), glowMat);
    visor.position.set(0, 0.02, 0.08);
    const earL = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.08, 6), primaryMat);
    earL.position.set(-0.055, 0.09, -0.02);
    const earR = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.08, 6), primaryMat);
    earR.position.set(0.055, 0.09, -0.02);
    headGroup.add(skull, snout, visor, earL, earR);
    bodyRoot.add(headGroup);
    animParts.head = headGroup;
    dynamicNodes.add(headGroup);

    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, 0.06, -0.21);
    const tailRod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.022, 0.18, 8), glowMat);
    tailRod.position.set(0, 0.06, -0.05);
    tailRod.rotation.x = -0.6;
    tailPivot.add(tailRod);
    bodyRoot.add(tailPivot);
    animParts.tail = tailPivot;
    dynamicNodes.add(tailPivot);

    const k9Legs = [
      [-0.09, -0.06, 0.14],
      [0.09, -0.06, 0.14],
      [-0.09, -0.06, -0.14],
      [0.09, -0.06, -0.14]
    ];
    for (const [lx, ly, lz] of k9Legs) {
      const legPivot = new THREE.Group();
      legPivot.position.set(lx, ly, lz);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.2, 0.048), darkMat);
      upper.position.y = -0.09;
      const paw = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.035, 0.075), glowMat);
      paw.position.set(0, -0.19, 0.015);
      legPivot.add(upper, paw);
      bodyRoot.add(legPivot);
      animParts.legs.push(legPivot);
      dynamicNodes.add(legPivot);
    }
  } else {
    bodyRoot.position.y = 0.78;
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 10), primaryMat);
    body.rotation.x = Math.PI / 2;
    bodyRoot.add(body);

    const head = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 8), glowMat);
    head.rotation.x = Math.PI / 2;
    head.position.set(0, 0.04, 0.22);
    bodyRoot.add(head);

    for (const side of [-1, 1]) {
      const wingPivot = new THREE.Group();
      wingPivot.position.set(side * 0.08, 0.02, 0.02);
      const innerWing = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.016, 0.16), primaryMat);
      innerWing.position.x = side * 0.16;
      const outerWing = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.014, 0.1), glowMat);
      outerWing.position.set(side * 0.34, 0.01, -0.02);
      wingPivot.add(innerWing, outerWing);
      bodyRoot.add(wingPivot);
      animParts.wings.push({ pivot: wingPivot, side });
      dynamicNodes.add(wingPivot);
    }

    const haloRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.012, 8, 24), glowMat);
    haloRing.rotation.x = Math.PI / 2;
    haloRing.position.y = -0.06;
    bodyRoot.add(haloRing);
    animParts.rings.push(haloRing);
    dynamicNodes.add(haloRing);
  }

  freezeStaticTree(group, dynamicNodes);

  let initializedPos = false;
  let currentYaw = 0;

  function animateParts(elapsed, speedRatio = 0) {
    const t = Number(elapsed) || 0;
    const activeWalk = Math.max(0.25, Math.min(1.5, speedRatio));

    if (spec.motionType === 'float' || spec.motionType === 'hover' || spec.motionType === 'soar') {
      const baseY = spec.id === 'pet_laser_falcon' ? 0.78 : spec.id === 'pet_drone_quadri' ? 0.72 : 0.56;
      bodyRoot.position.y = baseY + Math.sin(t * 3.4) * 0.07;
      bodyRoot.rotation.z = Math.sin(t * 2.1) * 0.08;
    } else {
      const baseY = spec.id === 'pet_router_wifi7' ? 0.28 : 0.34;
      bodyRoot.position.y = baseY + Math.abs(Math.sin(t * 7.5 * activeWalk)) * 0.04;
    }

    if (animParts.outerShell) {
      animParts.outerShell.rotation.y = t * 1.4;
      animParts.outerShell.rotation.x = t * 0.9;
    }
    if (animParts.core) {
      animParts.core.rotation.y = -t * 2.6;
      animParts.core.rotation.z = t * 1.8;
    }
    for (let i = 0; i < animParts.rings.length; i++) {
      const r = animParts.rings[i];
      r.rotation.z = t * (i % 2 === 0 ? 2.1 : -1.7);
    }
    for (let i = 0; i < animParts.rotors.length; i++) {
      animParts.rotors[i].rotation.y = t * 24 * (i % 2 === 0 ? 1 : -1);
    }
    for (let i = 0; i < animParts.legs.length; i++) {
      const phase = i % 2 === 0 ? 0 : Math.PI;
      animParts.legs[i].rotation.x = Math.sin(t * 9 * activeWalk + phase) * 0.42 * activeWalk;
    }
    for (let i = 0; i < animParts.antennas.length; i++) {
      animParts.antennas[i].rotation.z = Math.sin(t * 4.2 + i) * 0.12;
    }
    if (animParts.tail) {
      animParts.tail.rotation.y = Math.sin(t * 8.5) * 0.38;
    }
    if (animParts.head) {
      animParts.head.rotation.x = Math.sin(t * 3.2) * 0.08;
    }
    for (const w of animParts.wings) {
      w.pivot.rotation.z = w.side * Math.sin(t * 6.8) * 0.46;
    }

    const pulse = 0.88 + Math.sin(t * 4.0) * 0.12;
    groundRing.scale.set(pulse, pulse, 1);
  }

  function update(dt = 0.016, elapsed = 0, ownerPos = null, ownerYaw = 0) {
    const safeDt = Math.min(0.1, Math.max(0.001, Number(dt) || 0.016));
    let speedRatio = 0.35;

    if (ownerPos && Number.isFinite(ownerPos.x) && Number.isFinite(ownerPos.z)) {
      const rightX = Math.cos(ownerYaw);
      const rightZ = -Math.sin(ownerYaw);
      const backX = Math.sin(ownerYaw);
      const backZ = Math.cos(ownerYaw);

      _targetPos.set(
        ownerPos.x + rightX * 0.68 + backX * 0.65,
        Number(ownerPos.y) || 0,
        ownerPos.z + rightZ * 0.68 + backZ * 0.65
      );

      if (!initializedPos) {
        group.position.copy(_targetPos);
        currentYaw = ownerYaw + Math.PI;
        group.rotation.y = currentYaw;
        initializedPos = true;
      } else {
        _deltaVec.subVectors(_targetPos, group.position);
        const dist = Math.hypot(_deltaVec.x, _deltaVec.z);
        if (dist > 12) {
          group.position.copy(_targetPos);
        } else if (dist > 0.02) {
          const followFactor = Math.min(1, safeDt * 6.5);
          group.position.x += _deltaVec.x * followFactor;
          group.position.z += _deltaVec.z * followFactor;
          group.position.y += (_targetPos.y - group.position.y) * Math.min(1, safeDt * 8);
          speedRatio = Math.min(1.6, Math.max(0.35, dist * 2.2));
        }

        const desiredYaw =
          dist > 0.18 ? Math.atan2(_deltaVec.x, _deltaVec.z) : ownerYaw + Math.PI;
        const yawDiff = normalizeAngleDiff(desiredYaw, currentYaw);
        currentYaw += yawDiff * Math.min(1, safeDt * 8.0);
        group.rotation.y = currentYaw;
      }
    } else {
      group.rotation.y = Number(elapsed || 0) * 0.9;
      speedRatio = 0.8;
    }

    animateParts(elapsed, speedRatio);
  }

  function snapToOwner(ownerPos, ownerYaw = 0) {
    if (!ownerPos) return;
    initializedPos = false;
    update(0.016, 0, ownerPos, ownerYaw);
  }

  function dispose() {
    disposePetObject(group);
  }

  return {
    group,
    bodyRoot,
    petId: spec.id,
    spec,
    update,
    animateParts,
    snapToOwner,
    dispose
  };
}
