import * as THREE from 'three';
import { TEACHER_POS } from '../core/gameState.js';

function createLabel(text, subtext) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 150;
  const ctx = canvas.getContext('2d');

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

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
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
