import * as THREE from 'three';

export function buildMetalPipeBatMesh() {
  const group = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({
    color: 0x9aa4ad,
    metalness: 0.95,
    roughness: 0.28
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.6, roughness: 0.6 });
  const gold = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.85,
    metalness: 0.8,
    roughness: 0.3
  });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.86, 14), steel);
  shaft.position.y = 0.5;
  group.add(shaft);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.04, 14), dark);
  cap.position.y = 0.94;
  group.add(cap);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.22, 12), dark);
  grip.position.y = 0.02;
  group.add(grip);
  for (const y of [0.28, 0.5, 0.72]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.011, 8, 18), gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    group.add(ring);
  }
  const glow = new THREE.PointLight(0xfacc15, 0.55, 2.2, 2);
  glow.position.y = 0.5;
  group.add(glow);
  group.rotation.x = -1.15;
  group.name = 'metal-pipe-bat';
  return group;
}

export class MetalPipeImpactFx {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
    this.maxActive = 6;
  }

  spawn(position) {
    while (this.active.length >= this.maxActive) {
      this._dispose(this.active.shift());
    }
    const group = new THREE.Group();
    group.position.copy(position);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.28, 28), ringMat);
    group.add(ring);
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 28), ringMat.clone());
    ring2.rotation.x = Math.PI / 2;
    group.add(ring2);
    const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
    const sparkGeo = new THREE.SphereGeometry(0.035, 6, 6);
    const sparks = [];
    for (let i = 0; i < 10; i++) {
      const mesh = new THREE.Mesh(sparkGeo, sparkMat);
      const a = (i / 10) * Math.PI * 2;
      const vy = 1.2 + Math.random() * 1.6;
      sparks.push({ mesh, vx: Math.cos(a) * (1.4 + Math.random()), vz: Math.sin(a) * (1.4 + Math.random()), vy });
      group.add(mesh);
    }
    this.scene.add(group);
    this.active.push({ group, ring, ring2, sparks, sparkMat, sparkGeo, age: 0, life: 0.55 });
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const fx = this.active[i];
      fx.age += dt;
      const u = Math.min(1, fx.age / fx.life);
      const scale = 1 + u * 5.5;
      fx.ring.scale.setScalar(scale);
      fx.ring2.scale.setScalar(scale);
      fx.ring.material.opacity = 0.95 * (1 - u);
      fx.ring2.material.opacity = 0.95 * (1 - u);
      fx.sparkMat.opacity = 1 - u;
      for (const s of fx.sparks) {
        s.vy -= 6 * dt;
        s.mesh.position.x += s.vx * dt;
        s.mesh.position.y += s.vy * dt;
        s.mesh.position.z += s.vz * dt;
      }
      if (u >= 1) {
        this._dispose(fx);
        this.active.splice(i, 1);
      }
    }
  }

  _dispose(fx) {
    if (!fx) return;
    this.scene.remove(fx.group);
    fx.ring.geometry.dispose();
    fx.ring.material.dispose();
    fx.ring2.geometry.dispose();
    fx.ring2.material.dispose();
    fx.sparkGeo.dispose();
    fx.sparkMat.dispose();
  }
}
