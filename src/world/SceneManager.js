import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { resolveAscensionSpecialty } from './AvatarBuilder.js';

export function computeAscensionGatheringLayout(
  teacherPos = { x: -3.35, z: -1.35 },
  winnerId = null,
  peerIds = []
) {
  const tx = Number.isFinite(Number(teacherPos?.x)) ? Number(teacherPos.x) : -3.35;
  const tz = Number.isFinite(Number(teacherPos?.z)) ? Number(teacherPos.z) : -1.35;
  const stageCenter = {
    x: Number((tx - 0.4).toFixed(2)),
    z: Number((tz + 0.05).toFixed(2))
  };
  const winnerSpot = {
    id: winnerId,
    role: 'winner',
    x: Number((tx - 0.8).toFixed(2)),
    y: 0,
    z: Number((tz + 0.1).toFixed(2)),
    yaw: Math.PI,
    lookAt: { x: stageCenter.x, z: Number((stageCenter.z + 2.0).toFixed(2)) }
  };

  const spectators = (Array.isArray(peerIds) ? peerIds : []).filter(
    (id) => id && id !== winnerId
  );
  const count = spectators.length;
  const spectatorSpots = spectators.map((id, idx) => {
    const row = Math.floor(idx / 6);
    const idxInRow = idx % 6;
    const countInRow = Math.min(6, count - row * 6);
    const angle =
      countInRow <= 1 ? 0 : -0.72 + (idxInRow / (countInRow - 1)) * 1.44;
    const radius = 1.85 + row * 0.6;
    const rawX = stageCenter.x + Math.sin(angle) * radius;
    const rawZ = stageCenter.z + Math.cos(angle) * radius;
    const sx = Number(Math.max(-5.2, Math.min(-2.72, rawX)).toFixed(2));
    const sz = Number(Math.max(-0.35, Math.min(1.6, rawZ)).toFixed(2));
    const dx = stageCenter.x - sx;
    const dz = stageCenter.z - sz;
    const yaw = Number(Math.atan2(-dx, -dz).toFixed(3));
    return {
      id,
      role: 'spectator',
      x: sx,
      y: 0,
      z: sz,
      yaw,
      lookAt: { ...stageCenter }
    };
  });

  return {
    teacherPos: { x: tx, y: 0, z: tz },
    stageCenter,
    winnerSpot,
    spectatorSpots,
    placements: [winnerSpot, ...spectatorSpots]
  };
}

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

  const beamGroup = new THREE.Group();
  beamGroup.name = 'ascension-vertical-beam';
  beamGroup.position.set(-4.15, 0, -1.25);
  root.add(beamGroup);

  const innerBeamMat = new THREE.MeshBasicMaterial({
    color: '#fde047',
    transparent: true,
    opacity: 0.52,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const outerBeamMat = new THREE.MeshBasicMaterial({
    color: '#22d3ee',
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const innerBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.55, 4.6, 24, 1, true),
    innerBeamMat
  );
  innerBeam.position.y = 2.3;
  beamGroup.add(innerBeam);

  const outerBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.82, 0.95, 4.6, 24, 1, true),
    outerBeamMat
  );
  outerBeam.position.y = 2.3;
  beamGroup.add(outerBeam);

  const groundCircleMat = new THREE.MeshBasicMaterial({
    color: '#fde047',
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide
  });
  const groundCircle = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.96, 32),
    groundCircleMat
  );
  groundCircle.rotation.x = -Math.PI / 2;
  groundCircle.position.y = 0.03;
  beamGroup.add(groundCircle);

  const ascendingRings = [];
  for (let r = 0; r < 3; r++) {
    const rMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.68 - r * 0.08, 0.024, 10, 32),
      r % 2 === 0 ? innerBeamMat : outerBeamMat
    );
    rMesh.rotation.x = Math.PI / 2;
    rMesh.position.y = 0.3 + r * 1.1;
    beamGroup.add(rMesh);
    ascendingRings.push({ mesh: rMesh, offset: r * 1.25 });
  }

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
  let levitationOffset = 0;
  let levitationDuration = 3.8;
  let currentSpecialty = resolveAscensionSpecialty('cyber');
  let targetAvatar = null;

  const trigger = (opts = {}) => {
    duration = Math.max(1, Number(opts.duration) || 8);
    levitationDuration = Math.min(duration, Math.max(1.5, Number(opts.levitationDuration) || 3.8));
    remaining = duration;
    localElapsed = 0;
    levitationOffset = 0;
    active = true;
    root.visible = true;
    beamGroup.visible = true;
    currentSpecialty = resolveAscensionSpecialty(opts.specialty || 'cyber');
    targetAvatar = opts.targetAvatar || null;

    innerBeamMat.color.set('#fde047');
    outerBeamMat.color.set(currentSpecialty.primaryColor);
    groundCircleMat.color.set(currentSpecialty.secondaryColor);
    cyanLight.color.set(currentSpecialty.primaryColor);

    if (opts.center && Number.isFinite(Number(opts.center.x)) && Number.isFinite(Number(opts.center.z))) {
      const cx = Number(opts.center.x);
      const cz = Number(opts.center.z);
      root.position.set(cx * 0.15, 0, cz * 0.15);
      beamGroup.position.set(cx - root.position.x, 0, cz - root.position.z);
    } else {
      root.position.set(0, 0, 0);
      beamGroup.position.set(-4.15, 0, -1.25);
    }
    return {
      active: true,
      duration,
      specialty: currentSpecialty.id,
      hasLightBeam: true,
      particleCount: rainItems.length,
      fireworkCount: bursts.length,
      lightCount: dynamicLights.length
    };
  };

  const triggerAscension = (opts = {}) =>
    trigger({
      duration: opts.duration || 8,
      levitationDuration: opts.levitationDuration || 3.8,
      specialty: opts.specialty || 'cyber',
      center: opts.center || { x: -4.15, z: -1.25 },
      targetAvatar: opts.targetAvatar || null
    });

  const update = (dt = 0.016, _elapsed = 0) => {
    if (!active) return false;
    remaining -= dt;
    localElapsed += dt;
    if (remaining <= 0) {
      active = false;
      remaining = 0;
      levitationOffset = 0;
      root.visible = false;
      beamGroup.visible = false;
      if (targetAvatar?.group) {
        targetAvatar.group.position.y = 0;
      }
      targetAvatar = null;
      for (const l of dynamicLights) l.intensity = 0;
      return false;
    }

    const fade = remaining < 1.2 ? Math.max(0, remaining / 1.2) : 1;

    if (localElapsed < levitationDuration) {
      const p = localElapsed / levitationDuration;
      const env = Math.sin(p * Math.PI);
      levitationOffset = env * 1.25 + Math.sin(localElapsed * 6.0) * 0.06 * env;
    } else {
      levitationOffset = 0;
    }
    if (targetAvatar?.group) {
      targetAvatar.group.position.y = levitationOffset;
    }

    const beamAlpha = localElapsed < levitationDuration + 1.2
      ? fade
      : Math.max(0, 1 - (localElapsed - (levitationDuration + 1.2)) / 2.0) * fade;
    beamGroup.visible = beamAlpha > 0.02;
    if (beamGroup.visible) {
      const pulse = 0.92 + Math.sin(localElapsed * 8.0) * 0.12;
      innerBeam.scale.set(pulse, 1, pulse);
      outerBeam.scale.set(1.05 - (pulse - 0.92), 1, 1.05 - (pulse - 0.92));
      innerBeamMat.opacity = 0.52 * beamAlpha;
      outerBeamMat.opacity = 0.28 * beamAlpha;
      groundCircle.rotation.z = localElapsed * 2.2;
      groundCircleMat.opacity = 0.78 * beamAlpha;
      for (const ar of ascendingRings) {
        ar.mesh.position.y = 0.15 + ((ar.offset + localElapsed * 1.85) % 4.1);
        ar.mesh.rotation.z = -localElapsed * 2.5;
      }
    }

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

    goldLightA.intensity = (2.4 + Math.sin(localElapsed * 7.5) * 1.1) * fade;
    cyanLight.intensity = (2.2 + Math.cos(localElapsed * 6.8) * 1.0) * fade;
    goldLightB.intensity = (2.3 + Math.sin(localElapsed * 8.4 + 1.2) * 1.1) * fade;
    goldLightA.position.x = -3.5 + Math.sin(localElapsed * 2.1) * 3.0;
    cyanLight.position.x = 3.2 + Math.cos(localElapsed * 2.3) * 3.0;
    goldLightB.position.z = 2.0 + Math.sin(localElapsed * 1.9) * 3.2;

    return true;
  };

  return {
    root,
    beamGroup,
    innerBeam,
    outerBeam,
    groundCircle,
    ascendingRings,
    rainItems,
    bursts,
    dynamicLights,
    trigger,
    triggerAscension,
    update,
    isActive: () => active,
    getRemaining: () => remaining,
    getLevitationOffset: () => levitationOffset
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

  triggerAscension(options = {}) {
    return this.celebrationRig?.triggerAscension(options);
  }

  getAscensionLevitation() {
    return this.celebrationRig?.getLevitationOffset() || 0;
  }

  applyCinematicShot(phase = 'dialogue', elapsed = 0, teacherPos = { x: -3.35, z: -1.35 }, winnerPos = { x: -4.15, z: -1.25 }) {
    const tx = Number.isFinite(Number(teacherPos?.x)) ? Number(teacherPos.x) : -3.35;
    const tz = Number.isFinite(Number(teacherPos?.z)) ? Number(teacherPos.z) : -1.35;
    const wx = Number.isFinite(Number(winnerPos?.x)) ? Number(winnerPos.x) : tx - 0.8;
    const wz = Number.isFinite(Number(winnerPos?.z)) ? Number(winnerPos.z) : tz + 0.1;
    const midX = (tx + wx) * 0.5;
    const midZ = (tz + wz) * 0.5;

    if (phase === 'ascension') {
      const lev = this.getAscensionLevitation();
      const orbitAngle = Math.sin(elapsed * 0.9) * 0.52;
      const camX = wx + Math.sin(orbitAngle) * 1.95;
      const camZ = wz + Math.cos(orbitAngle) * 1.95;
      const camY = 1.42 + lev * 0.35;
      this.camera.position.set(camX, camY, camZ);
      this.camera.lookAt(wx, 1.35 + lev * 0.85, wz);
      return;
    }

    const sway = Math.sin(elapsed * 0.55) * 0.42;
    const camX = midX + sway;
    const camY = 1.68 + Math.cos(elapsed * 0.45) * 0.06;
    const camZ = midZ + 2.15;
    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(midX, 1.38, midZ);
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
