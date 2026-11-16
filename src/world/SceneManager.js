import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export function createWorldCelebrationRig(scene) {
  const root = new THREE.Group();
  root.name = 'world-celebration-20-rig';
  root.visible = false;
  if (scene) scene.add(root);

  const rainItems = [];
  const goldCyanPalette = ['#fbbf24', '#fde047', '#22d3ee', '#67e8f9', '#f59e0b', '#38bdf8'];
  const octGeom = new THREE.OctahedronGeometry(0.055, 0);
  const confettiGeom = new THREE.BoxGeometry(0.075, 0.02, 0.045);

  for (let i = 0; i < 120; i++) {
    const col = goldCyanPalette[i % goldCyanPalette.length];
    const mat = new THREE.MeshBasicMaterial({ color: col });
    const mesh = new THREE.Mesh(i % 2 === 0 ? octGeom : confettiGeom, mat);
    const rx = ((i * 37) % 240) / 10 - 12;
    const rz = ((i * 53) % 220) / 10 - 11;
    const ry = 0.6 + ((i * 19) % 42) / 10;
    mesh.position.set(rx, ry, rz);
    root.add(mesh);
    rainItems.push({
      mesh,
      baseX: rx,
      baseZ: rz,
      yOffset: ry,
      speedY: 1.15 + (i % 5) * 0.28,
      driftAmp: 0.25 + (i % 4) * 0.09,
      driftFreq: 1.4 + (i % 6) * 0.35,
      rotSpeed: 2.2 + (i % 5) * 0.6
    });
  }

  const fireworkOrigins = [
    new THREE.Vector3(-4.2, 3.6, -2.0),
    new THREE.Vector3(3.8, 3.9, -2.5),
    new THREE.Vector3(-2.5, 4.1, 3.2),
    new THREE.Vector3(4.1, 3.7, 2.8),
    new THREE.Vector3(0.0, 4.2, -0.5),
    new THREE.Vector3(-6.5, 3.6, 0.8)
  ];
  const sparkGeom = new THREE.SphereGeometry(0.048, 6, 6);
  const bursts = [];

  fireworkOrigins.forEach((origin, bIdx) => {
    const burstGroup = new THREE.Group();
    burstGroup.position.copy(origin);
    root.add(burstGroup);
    const sparks = [];
    const sparkCount = 22;
    for (let s = 0; s < sparkCount; s++) {
      const phi = Math.acos(1 - (2 * (s + 0.5)) / sparkCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * s;
      const dir = new THREE.Vector3(
        Math.cos(theta) * Math.sin(phi),
        Math.cos(phi),
        Math.sin(theta) * Math.sin(phi)
      ).normalize();
      const col = goldCyanPalette[(bIdx + s) % goldCyanPalette.length];
      const sparkMesh = new THREE.Mesh(
        sparkGeom,
        new THREE.MeshBasicMaterial({ color: col })
      );
      burstGroup.add(sparkMesh);
      sparks.push({
        mesh: sparkMesh,
        dir,
        speed: 1.4 + (s % 4) * 0.35
      });
    }
    bursts.push({
      group: burstGroup,
      origin: origin.clone(),
      phaseOffset: bIdx * 0.42,
      sparks
    });
  });

  const goldLightA = new THREE.PointLight('#fbbf24', 0, 18);
  goldLightA.position.set(-3.5, 3.4, 0.5);
  root.add(goldLightA);

  const cyanLight = new THREE.PointLight('#22d3ee', 0, 18);
  cyanLight.position.set(3.2, 3.4, -1.2);
  root.add(cyanLight);

  const goldLightB = new THREE.PointLight('#fde047', 0, 16);
  goldLightB.position.set(0, 3.8, 3.0);
  root.add(goldLightB);

  const dynamicLights = [goldLightA, cyanLight, goldLightB];

  let active = false;
  let remaining = 0;
  let duration = 8;
  let localElapsed = 0;

  const trigger = (opts = {}) => {
    duration = Math.max(1, Number(opts.duration) || 8);
    remaining = duration;
    localElapsed = 0;
    active = true;
    root.visible = true;
    if (opts.center && Number.isFinite(Number(opts.center.x)) && Number.isFinite(Number(opts.center.z))) {
      root.position.set(Number(opts.center.x) * 0.15, 0, Number(opts.center.z) * 0.15);
    } else {
      root.position.set(0, 0, 0);
    }
    return {
      active: true,
      duration,
      particleCount: rainItems.length,
      fireworkCount: bursts.length,
      lightCount: dynamicLights.length
    };
  };

  const update = (dt = 0.016, _elapsed = 0) => {
    if (!active) return false;
    remaining -= dt;
    localElapsed += dt;
    if (remaining <= 0) {
      active = false;
      remaining = 0;
      root.visible = false;
      for (const l of dynamicLights) l.intensity = 0;
      return false;
    }

    const fade = remaining < 1.2 ? Math.max(0, remaining / 1.2) : 1;

    for (const item of rainItems) {
      const y = 4.6 - ((item.yOffset + localElapsed * item.speedY) % 4.4);
      const x = item.baseX + Math.sin(localElapsed * item.driftFreq + item.yOffset) * item.driftAmp;
      const z = item.baseZ + Math.cos(localElapsed * item.driftFreq + item.baseX) * item.driftAmp;
      item.mesh.position.set(x, y, z);
      item.mesh.rotation.x = localElapsed * item.rotSpeed;
      item.mesh.rotation.y = localElapsed * (item.rotSpeed * 0.8);
      item.mesh.scale.setScalar(fade);
    }

    for (const b of bursts) {
      const cycle = (localElapsed + b.phaseOffset) % 1.45;
      const norm = cycle / 1.45;
      const radius = norm * 2.35;
      const drop = norm * norm * 0.65;
      const scale = Math.max(0.01, (1 - norm * 0.82) * fade);
      for (const sp of b.sparks) {
        sp.mesh.position.set(
          sp.dir.x * radius * sp.speed * 0.55,
          sp.dir.y * radius * sp.speed * 0.55 - drop,
          sp.dir.z * radius * sp.speed * 0.55
        );
        sp.mesh.scale.setScalar(scale);
      }
    }

    goldLightA.intensity = (2.2 + Math.sin(localElapsed * 7.5) * 1.1) * fade;
    cyanLight.intensity = (2.0 + Math.cos(localElapsed * 6.8) * 1.0) * fade;
    goldLightB.intensity = (2.1 + Math.sin(localElapsed * 8.4 + 1.2) * 1.1) * fade;
    goldLightA.position.x = -3.5 + Math.sin(localElapsed * 2.1) * 3.0;
    cyanLight.position.x = 3.2 + Math.cos(localElapsed * 2.3) * 3.0;
    goldLightB.position.z = 2.0 + Math.sin(localElapsed * 1.9) * 3.2;

    return true;
  };

  return {
    root,
    rainItems,
    bursts,
    dynamicLights,
    trigger,
    update,
    isActive: () => active,
    getRemaining: () => remaining
  };
}

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#cfe4f7');
    this.scene.fog = new THREE.Fog('#cfe4f7', 38, 105);

    this.camera = new THREE.PerspectiveCamera(
      68,
      window.innerWidth / window.innerHeight,
      0.1,
      120
    );
    this.camera.position.set(-3.95, 1.68, 0.65);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.xr.enabled = true;
    this.renderer.xr.setReferenceSpaceType('local-floor');
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremGenerator.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    this.envRenderTarget = this.pmremGenerator.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRenderTarget.texture;
    this.scene.environmentIntensity = 0.65;
    roomEnv.dispose();

    this.paused = false;
    this.quality = 'high';
    this.updaters = [];
    this.alwaysUpdaters = [];
    this.customRenderScene = null;
    this.customStepFn = null;
    this.clock = new THREE.Clock();
    this.fps = 60;
    this.celebrationRig = createWorldCelebrationRig(this.scene);

    this._setupLights();
    this.setQuality('high');
    this._onResize = this._handleResize.bind(this);
    window.addEventListener('resize', this._onResize);
    this._handleResize();
  }

  _setupLights() {
    const hemi = new THREE.HemisphereLight('#e6f2ff', '#cbd5e1', 0.88);
    this.scene.add(hemi);

    this.sun = new THREE.DirectionalLight('#fff4de', 1.48);
    this.sun.position.set(8, 16, 10);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 45;
    this.sun.shadow.camera.left = -16;
    this.sun.shadow.camera.right = 16;
    this.sun.shadow.camera.top = 15;
    this.sun.shadow.camera.bottom = -15;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 2.5;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.fill = new THREE.DirectionalLight('#f8fafc', 0.42);
    this.fill.position.set(-11, 8, -10);
    this.scene.add(this.fill);
  }

  getMaxAnisotropy() {
    return this.renderer?.capabilities?.getMaxAnisotropy?.() || 8;
  }

  updateWorldBounds(bounds) {
    const width = Math.max(10, Number(bounds?.width) || 26);
    const depth = Math.max(10, Number(bounds?.depth) || 24.4);
    const minX = Number.isFinite(Number(bounds?.minX)) ? Number(bounds.minX) : -width / 2;
    const maxX = Number.isFinite(Number(bounds?.maxX)) ? Number(bounds.maxX) : width / 2;
    const minZ = Number.isFinite(Number(bounds?.minZ)) ? Number(bounds.minZ) : -depth / 2;
    const maxZ = Number.isFinite(Number(bounds?.maxZ)) ? Number(bounds.maxZ) : depth / 2;
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const diag = Math.hypot(width, depth);

    this.camera.far = Math.max(180, diag * 1.8);
    this.camera.updateProjectionMatrix();

    if (this.scene.fog) {
      this.scene.fog.near = Math.max(38, diag * 0.82);
      this.scene.fog.far = Math.max(105, diag * 1.85);
    }

    const halfSpan = Math.max(16, Math.max(width, depth) * 0.6);
    if (this.sun) {
      this.sun.target.position.set(cx, 0, cz);
      this.sun.target.updateMatrixWorld();
      this.sun.position.set(cx + halfSpan * 0.45, Math.max(16, halfSpan * 0.9), cz + halfSpan * 0.55);
      this.sun.shadow.camera.left = -halfSpan;
      this.sun.shadow.camera.right = halfSpan;
      this.sun.shadow.camera.top = halfSpan;
      this.sun.shadow.camera.bottom = -halfSpan;
      this.sun.shadow.camera.near = 1;
      this.sun.shadow.camera.far = Math.max(45, halfSpan * 3.2);
      const targetMapSize = this.quality === 'high' || halfSpan > 28 ? 2048 : 1024;
      if (this.sun.shadow.mapSize.x !== targetMapSize) {
        this.sun.shadow.mapSize.set(targetMapSize, targetMapSize);
        if (this.sun.shadow.map) {
          this.sun.shadow.map.dispose();
          this.sun.shadow.map = null;
        }
      }
      this.sun.shadow.camera.updateProjectionMatrix();
    }
    if (this.fill) {
      this.fill.position.set(cx - halfSpan * 0.65, Math.max(8, halfSpan * 0.45), cz - halfSpan * 0.65);
    }
  }

  setFov(fov) {
    const clamped = Math.max(50, Math.min(110, Number(fov) || 70));
    this.camera.fov = clamped;
    this.camera.updateProjectionMatrix();
  }

  setQuality(quality) {
    this.quality = quality;
    const xrPresenting = Boolean(this.renderer.xr?.isPresenting);
    if (quality === 'eco') {
      if (!xrPresenting) this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      this.sun.castShadow = false;
    } else if (quality === 'balanced') {
      if (!xrPresenting) this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
      this.renderer.shadowMap.enabled = true;
      this.sun.castShadow = true;
    } else {
      if (!xrPresenting) this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = true;
      this.sun.castShadow = true;
    }
    this._handleResize();
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
    if (!this.paused) {
      this.clock.getDelta();
    }
  }

  setCustomRenderTarget(scene = null, stepFn = null) {
    this.customRenderScene = scene;
    this.customStepFn = stepFn;
    this.clock.getDelta();
  }

  addUpdater(fn) {
    this.updaters.push(fn);
  }

  addAlwaysUpdater(fn) {
    this.alwaysUpdaters.push(fn);
  }

  getFps() {
    return Math.round(this.fps || 60);
  }

  triggerWorldCelebration(options = {}) {
    return this.celebrationRig?.trigger(options);
  }

  updateCelebration(dt, elapsed = 0) {
    return this.celebrationRig?.update(dt, elapsed);
  }

  _handleResize() {
    if (this.renderer.xr?.isPresenting) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  start() {
    this.renderer.setAnimationLoop(() => {
      const rawDt = this.clock.getDelta();
      if (rawDt > 0.0005) {
        const instFps = Math.min(240, Math.max(1, 1 / rawDt));
        this.fps = this.fps * 0.88 + instFps * 0.12;
      }
      const dt = Math.min(rawDt, 0.1);
      const elapsed = this.clock.elapsedTime;
      this.celebrationRig?.update(dt, elapsed);
      if (this.customRenderScene) {
        if (this.customStepFn) {
          this.customStepFn(dt, elapsed);
        }
        for (const fn of this.alwaysUpdaters) {
          fn(dt, elapsed);
        }
        this.renderer.render(this.customRenderScene, this.camera);
        return;
      }
      if (this.paused) return;
      for (const fn of this.updaters) {
        fn(dt, elapsed);
      }
      for (const fn of this.alwaysUpdaters) {
        fn(dt, elapsed);
      }
      this.renderer.render(this.scene, this.camera);
    });
  }
}
