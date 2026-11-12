import * as THREE from 'three';

function makeStudentBadge(name, color, activity) {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 110;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(10, 10, 380, 90, 18);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(name, 200, 48);

  ctx.fillStyle = color;
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(activity || 'Dans l’atelier', 200, 82);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class RemotePlayersManager {
  constructor(scene) {
    this.scene = scene;
    this.peers = new Map();
  }

  setPeers(peerList = []) {
    const incomingIds = new Set(peerList.map((p) => p.id));
    for (const id of this.peers.keys()) {
      if (!incomingIds.has(id)) this.removePeer(id);
    }
    for (const p of peerList) {
      this.upsertPeer(p);
    }
  }

  upsertPeer(p) {
    if (!p || !p.id) return;
    if (this.peers.has(p.id)) {
      this.movePeer(p.id, p.x, p.y, p.z, p.yaw);
      if (p.activity) this.setActivity(p.id, p.activity);
      return;
    }

    const group = new THREE.Group();
    group.position.set(p.x || 0, 0, p.z || 6);

    const bodyMat = new THREE.MeshStandardMaterial({ color: p.color || '#22d3ee', roughness: 0.55 });
    const legMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.7 });
    const skinMat = new THREE.MeshStandardMaterial({ color: '#f1c29b', roughness: 0.7 });

    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.18), legMat);
    leftLeg.position.set(-0.12, 0.35, 0);
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.18), legMat);
    rightLeg.position.set(0.12, 0.35, 0);
    group.add(rightLeg);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.66, 0.28), bodyMat);
    torso.position.y = 1.05;
    torso.castShadow = true;
    group.add(torso);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.32), skinMat);
    head.position.y = 1.56;
    head.castShadow = true;
    group.add(head);

    const badgeTex = makeStudentBadge(p.name, p.color || '#22d3ee', p.activity);
    const badgeMat = new THREE.SpriteMaterial({ map: badgeTex, transparent: true, depthTest: false });
    const badge = new THREE.Sprite(badgeMat);
    badge.scale.set(2.0, 0.55, 1);
    badge.position.set(0, 2.2, 0);
    group.add(badge);

    this.scene.add(group);
    this.peers.set(p.id, {
      id: p.id,
      name: p.name,
      color: p.color || '#22d3ee',
      activity: p.activity || 'Dans l’atelier',
      group,
      leftLeg,
      rightLeg,
      badge,
      targetPos: new THREE.Vector3(p.x || 0, 0, p.z || 6),
      targetYaw: p.yaw || 0,
      walkPhase: 0
    });
  }

  movePeer(id, x, _y, z, yaw) {
    const peer = this.peers.get(id);
    if (!peer) return;
    peer.targetPos.set(x, 0, z);
    peer.targetYaw = yaw || 0;
  }

  setActivity(id, activity) {
    const peer = this.peers.get(id);
    if (!peer || peer.activity === activity) return;
    peer.activity = activity;
    const newTex = makeStudentBadge(peer.name, peer.color, activity);
    peer.badge.material.map?.dispose();
    peer.badge.material.map = newTex;
    peer.badge.material.needsUpdate = true;
  }

  removePeer(id) {
    const peer = this.peers.get(id);
    if (!peer) return;
    peer.badge.material.map?.dispose();
    peer.badge.material.dispose();
    this.scene.remove(peer.group);
    this.peers.delete(id);
  }

  update(dt) {
    for (const peer of this.peers.values()) {
      const dist = peer.group.position.distanceTo(peer.targetPos);
      peer.group.position.lerp(peer.targetPos, Math.min(1, dt * 10));

      let diff = peer.targetYaw - peer.group.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      peer.group.rotation.y += diff * Math.min(1, dt * 10);

      if (dist > 0.04) {
        peer.walkPhase += dt * 12;
        peer.leftLeg.rotation.x = Math.sin(peer.walkPhase) * 0.45;
        peer.rightLeg.rotation.x = -Math.sin(peer.walkPhase) * 0.45;
      } else {
        peer.leftLeg.rotation.x *= 0.85;
        peer.rightLeg.rotation.x *= 0.85;
      }
    }
  }
}
