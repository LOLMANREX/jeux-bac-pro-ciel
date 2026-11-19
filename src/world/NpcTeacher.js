import * as THREE from 'three';
import { TEACHER_POS } from '../core/gameState.js';

function createLabel(text, subtext) {
  let tex = null;
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas');
    if (canvas && typeof canvas.getContext === 'function') {
      canvas.width = 512;
      canvas.height = 150;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.roundRect(14, 14, 484, 122, 22);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 34px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(text, 256, 62);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '24px system-ui, sans-serif';
        ctx.fillText(subtext, 256, 106);
      }
      tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
    }
  }
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
  );
  sprite.scale.set(2.5, 0.74, 1);
  return sprite;
}

export function createNpcTeacher(parent, opts = {}) {
  const tx = Number.isFinite(Number(opts.x)) ? Number(opts.x) : TEACHER_POS.x;
  const tz = Number.isFinite(Number(opts.z)) ? Number(opts.z) : TEACHER_POS.z;
  const rotRad = ((Number(opts.rotation) || 0) * Math.PI) / 180;
  const customLabel = opts.label || 'Professeur CIEL';
  const customDialogue = String(opts.dialogue || '').trim();

  const root = new THREE.Group();
  root.position.set(tx, 0, tz);
  root.rotation.y = rotRad;

  const pantMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.8 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.7 });
  [-0.14, 0.14].forEach((lx) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.75, 0.2), pantMat);
    leg.position.set(lx, 0.42, 0);
    leg.castShadow = true;
    root.add(leg);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.28), shoeMat);
    shoe.position.set(lx, 0.05, 0.04);
    root.add(shoe);
  });

  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 1.15, 0);
  root.add(torsoGroup);

  const coatMat = new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.6 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.65 });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#f1c29b', roughness: 0.75 });
  const hairMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.8 });

  const coat = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.78, 0.34), coatMat);
  coat.castShadow = true;
  torsoGroup.add(coat);

  const shirtStripe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.68, 0.35), shirtMat);
  shirtStripe.position.y = 0.02;
  torsoGroup.add(shirtStripe);

  const badge = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.07, 0.02),
    new THREE.MeshBasicMaterial({ color: '#22d3ee' })
  );
  badge.position.set(0.16, 0.18, 0.18);
  torsoGroup.add(badge);

  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.18), coatMat);
  leftArm.position.set(-0.37, -0.02, 0);
  torsoGroup.add(leftArm);

  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.56, 0.18), coatMat);
  rightArm.position.set(0.37, 0.02, 0.12);
  rightArm.rotation.x = -0.65;
  torsoGroup.add(rightArm);

  const tablet = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.03, 0.36),
    new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.3 })
  );
  tablet.position.set(0.32, -0.14, 0.34);
  tablet.rotation.x = 0.4;
  torsoGroup.add(tablet);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.58, 0);
  torsoGroup.add(headGroup);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.4, 0.36), skinMat);
  head.castShadow = true;
  headGroup.add(head);

  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.38), hairMat);
  hair.position.set(0, 0.18, -0.01);
  headGroup.add(hair);

  const glassMat = new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.5 });
  [-0.085, 0.085].forEach((gx) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.03), glassMat);
    frame.position.set(gx, 0.03, 0.19);
    headGroup.add(frame);
  });

  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.18, 0),
    new THREE.MeshBasicMaterial({ color: '#fbbf24' })
  );
  diamond.position.set(0, 2.38, 0);
  root.add(diamond);

  const label = createLabel(customLabel, 'Enseignant BAC PRO CIEL • Plateau U300');
  label.position.set(0, 2.85, 0);
  root.add(label);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.1, 32),
    new THREE.MeshBasicMaterial({ color: '#fbbf24', side: THREE.DoubleSide, transparent: true, opacity: 0.75 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  root.add(ring);

  parent.add(root);

  const interactable = {
    id: 'teacher',
    type: 'npc',
    label: `👨‍🏫 Parler à ${customLabel}`,
    dialogue: customDialogue,
    position: new THREE.Vector3(tx, 1.2, tz),
    interactRadius: opts.interactRadius || 3.1,
    mesh: root
  };

  function update(elapsed, playerPos, diplomaEarned = false) {
    torsoGroup.position.y = 1.15 + Math.sin(elapsed * 2.2) * 0.025;
    diamond.rotation.y = elapsed * 2.1;
    diamond.position.y = 2.35 + Math.sin(elapsed * 3.0) * 0.08;
    diamond.material.color.set(diplomaEarned ? '#10b981' : '#fbbf24');

    if (playerPos) {
      const dx = playerPos.x - root.position.x;
      const dz = playerPos.z - root.position.z;
      if (dx * dx + dz * dz < 49) {
        const targetYaw = Math.atan2(dx, dz);
        let diff = targetYaw - root.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        root.rotation.y += diff * 0.08;
      }
    }
  }

  return {
    root,
    interactable,
    collider: {
      minX: tx - 0.55,
      maxX: tx + 0.55,
      minZ: tz - 0.55,
      maxZ: tz + 0.55
    },
    update
  };
}

function makeHorrorLabelTexture(label, stateText = 'PATROUILLE', accent = '#f43f5e') {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 140;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = 'rgba(15, 4, 8, 0.92)';
  ctx.strokeStyle = accent;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(12, 12, 488, 116, 20);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(label || 'Professeur CIEL').slice(0, 26), 256, 56);

  ctx.fillStyle = '#fecdd3';
  ctx.font = 'bold 24px monospace';
  ctx.fillText(String(stateText || 'PATROUILLE').slice(0, 26), 256, 102);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createHorrorTeacher(parent, opts = {}) {
  const root = new THREE.Group();
  root.visible = false;
  root.scale.setScalar(1.08);
  root.position.set(Number(opts.x) || 7.5, 0, Number(opts.z) || 7.5);

  const pantMat = new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.85 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#030712', roughness: 0.7 });
  const coatMat = new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    roughness: 0.7,
    emissive: '#450a0a',
    emissiveIntensity: 0.25
  });
  const shirtMat = new THREE.MeshStandardMaterial({ color: '#7f1d1d', roughness: 0.65 });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#d6bfa9', roughness: 0.8 });
  const hairMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.8 });

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.15, 0.78, 0);
  const lLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.76, 0.21), pantMat);
  lLegMesh.position.y = -0.38;
  const lShoe = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.1, 0.29), shoeMat);
  lShoe.position.set(0, -0.73, 0.04);
  leftLeg.add(lLegMesh, lShoe);
  root.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.15, 0.78, 0);
  const rLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.76, 0.21), pantMat);
  rLegMesh.position.y = -0.38;
  const rShoe = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.1, 0.29), shoeMat);
  rShoe.position.set(0, -0.73, 0.04);
  rightLeg.add(rLegMesh, rShoe);
  root.add(rightLeg);

  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 1.18, 0);
  root.add(torsoGroup);

  const coat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.82, 0.36), coatMat);
  coat.castShadow = true;
  torsoGroup.add(coat);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.37), shirtMat);
  torsoGroup.add(stripe);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.4, 0.28, 0);
  const lArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.68, 0.19), coatMat);
  lArmMesh.position.y = -0.3;
  leftArm.add(lArmMesh);
  torsoGroup.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.4, 0.28, 0);
  const rArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.68, 0.19), coatMat);
  rArmMesh.position.y = -0.3;
  rightArm.add(rArmMesh);
  torsoGroup.add(rightArm);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.62, 0);
  torsoGroup.add(headGroup);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.38), skinMat);
  head.castShadow = true;
  headGroup.add(head);

  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.4), hairMat);
  hair.position.set(0, 0.19, -0.01);
  headGroup.add(hair);

  const glassMat = new THREE.MeshStandardMaterial({ color: '#020617', metalness: 0.7, roughness: 0.2 });
  const eyeGlowMat = new THREE.MeshBasicMaterial({ color: '#ef4444' });
  const eyes = [];
  [-0.09, 0.09].forEach((ex) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.03), glassMat);
    frame.position.set(ex, 0.03, 0.195);
    headGroup.add(frame);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), eyeGlowMat);
    eye.position.set(ex, 0.03, 0.212);
    headGroup.add(eye);
    eyes.push(eye);
  });

  const auraHaloMat = new THREE.MeshBasicMaterial({
    color: '#ef4444',
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const auraHalo = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.82, 24), auraHaloMat);
  auraHalo.rotation.x = -Math.PI / 2;
  auraHalo.position.set(0, 0.04, 0);
  root.add(auraHalo);
  const auraLight = {
    get intensity() {
      return auraHaloMat.opacity * 10;
    },
    set intensity(v) {
      auraHaloMat.opacity = Math.max(0.12, Math.min(0.45, (Number(v) || 0) * 0.12));
    },
    color: auraHaloMat.color
  };

  const labelMat = new THREE.SpriteMaterial({
    map: makeHorrorLabelTexture('Professeur CIEL', 'PATROUILLE'),
    transparent: true,
    depthTest: false
  });
  const labelSprite = new THREE.Sprite(labelMat);
  labelSprite.scale.set(2.5, 0.68, 1);
  labelSprite.position.set(0, 2.75, 0);
  root.add(labelSprite);

  if (parent) parent.add(root);

  let targetX = root.position.x;
  let targetZ = root.position.z;
  let targetYaw = 0;
  let aiState = 'patrol';
  let walkPhase = 0;
  let lastLabelState = 'patrol';

  function setTargetState(pose = {}) {
    if (Number.isFinite(Number(pose.x))) targetX = Number(pose.x);
    if (Number.isFinite(Number(pose.z))) targetZ = Number(pose.z);
    if (Number.isFinite(Number(pose.yaw))) targetYaw = Number(pose.yaw);
    if (pose.state && pose.state !== aiState) {
      aiState = pose.state;
      if (aiState !== lastLabelState) {
        lastLabelState = aiState;
        const txt =
          aiState === 'chase'
            ? '⚠️ POURSUITE !'
            : aiState === 'investigate'
              ? '👂 BRUIT ENTENDU'
              : '🔦 PATROUILLE';
        const col =
          aiState === 'chase'
            ? '#ef4444'
            : aiState === 'investigate'
              ? '#f59e0b'
              : '#fb7185';
        const nextTex = makeHorrorLabelTexture('Professeur CIEL', txt, col);
        if (nextTex) {
          labelMat.map?.dispose();
          labelMat.map = nextTex;
          labelMat.needsUpdate = true;
        }
      }
    }
  }

  function snapTo(x, z, yaw = 0) {
    targetX = x;
    targetZ = z;
    targetYaw = yaw;
    root.position.set(x, 0, z);
    root.rotation.y = yaw;
  }

  function update(dt = 0.016, elapsed = 0) {
    if (!root.visible) return;
    const smooth = 1 - Math.exp(-12 * Math.max(0.001, dt));
    const dx = targetX - root.position.x;
    const dz = targetZ - root.position.z;
    root.position.x += dx * smooth;
    root.position.z += dz * smooth;

    let diff = targetYaw - root.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    root.rotation.y += diff * smooth;

    const speedFactor = aiState === 'chase' ? 11.5 : aiState === 'investigate' ? 8.2 : 6.2;
    const moving = Math.hypot(dx, dz) > 0.03 || aiState === 'chase' || aiState === 'patrol';
    if (moving) {
      walkPhase += dt * speedFactor;
      const swing = Math.sin(walkPhase) * (aiState === 'chase' ? 0.65 : 0.42);
      leftLeg.rotation.x = swing;
      rightLeg.rotation.x = -swing;
      if (aiState === 'chase') {
        leftArm.rotation.x = -1.35 + swing * 0.25;
        rightArm.rotation.x = -1.35 - swing * 0.25;
      } else {
        leftArm.rotation.x = -swing * 0.65;
        rightArm.rotation.x = swing * 0.65;
      }
      torsoGroup.position.y = 1.18 + Math.abs(Math.sin(walkPhase)) * 0.04;
    }

    const pulse = aiState === 'chase' ? 2.6 + Math.sin(elapsed * 14) * 1.1 : 1.4 + Math.sin(elapsed * 4) * 0.35;
    auraLight.intensity = pulse;
    auraLight.color.set(aiState === 'chase' ? '#ef4444' : aiState === 'investigate' ? '#f59e0b' : '#b91c1c');
    const eyeScale = aiState === 'chase' ? 1.35 : 1.0;
    for (const e of eyes) e.scale.setScalar(eyeScale);
    headGroup.rotation.z = aiState === 'chase' ? Math.sin(elapsed * 9) * 0.12 : Math.sin(elapsed * 2) * 0.04;
  }

  function dispose() {
    labelMat.map?.dispose();
    labelMat.dispose();
    root.parent?.remove(root);
  }

  return {
    root,
    setTargetState,
    snapTo,
    update,
    dispose
  };
}
