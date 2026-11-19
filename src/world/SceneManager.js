import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { detectDeviceProfile } from '../core/gameState.js';
import { resolveAscensionSpecialty } from './AvatarBuilder.js';

export function computeAdaptivePixelRatio({
  devicePixelRatio = 1,
  quality = 'high',
  isMobile = false,
  isTablet = false,
  isVr = false
} = {}) {
  const dpr = Math.max(0.75, Number(devicePixelRatio) || 1);
  if (isVr) {
    return Math.min(dpr, 1.5);
  }
  if (isMobile) {
    if (quality === 'eco') return Math.min(dpr, 0.9);
    if (quality === 'balanced') return Math.min(dpr, 1.0);
    return Math.min(dpr, 1.15);
  }
  if (isTablet) {
    if (quality === 'eco') return Math.min(dpr, 1.0);
    if (quality === 'balanced') return Math.min(dpr, 1.1);
    return Math.min(dpr, 1.25);
  }
  if (quality === 'eco') return 1;
  if (quality === 'balanced') return Math.min(dpr, 1.25);
  return Math.min(dpr, 1.5);
}

export const INTRO_CINEMATIC_SHOTS = [
  {
    zoneLabel: '📍 Hall U300 • Accueil du Professeur CIEL',
    fromPos: [-4.9, 2.05, 2.1],
    toPos: [-3.65, 1.78, 0.85],
    fromLook: [-3.35, 1.35, -1.35],
    toLook: [-3.35, 1.4, -1.35],
    focusTeacher: true
  },
  {
    zoneLabel: '📍 Salles U301, U302 & U303 • Électronique & Audiovisuel',
    fromPos: [-5.8, 2.55, -5.0],
    toPos: [4.8, 2.6, -5.0],
    fromLook: [-7.5, 1.1, -7.8],
    toLook: [6.8, 1.2, -7.8]
  },
  {
    zoneLabel: '📍 Salles U305, U306 & U307 • Cyber, Systèmes & Réseaux',
    fromPos: [5.4, 2.55, 5.4],
    toPos: [-5.4, 2.6, 5.2],
    fromLook: [7.8, 1.15, 7.8],
    toLook: [-9.2, 1.15, 6.8]
  },
  {
    zoneLabel: '📍 Parvis U300 • Ascension & Cycle de Prestige',
    fromPos: [-5.8, 2.35, 1.55],
    toPos: [-2.65, 1.98, 1.25],
    fromLook: [-3.8, 1.32, -1.2],
    toLook: [-3.4, 1.4, -1.35],
    focusTeacher: true
  },
  {
    zoneLabel: '📍 Hall U300 • Le Secret de la Légende CIEL',
    fromPos: [-4.25, 1.76, 0.72],
    toPos: [-3.72, 1.66, 0.25],
    fromLook: [-3.35, 1.44, -1.35],
    toLook: [-3.35, 1.48, -1.35],
    focusTeacher: true
  }
];

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

function collectNonSpriteMeshes(root) {
  const targets = [];
  if (!root || typeof root.traverse !== 'function') return targets;
  root.traverse((obj) => {
    if (obj.isSprite) return;
    if (obj.isMesh || obj.isLine || obj.isPoints) {
      targets.push(obj);
    }
  });
  return targets;
}

export function pickLabInteractable(raycaster, interactables = [], occluders = [], maxDist = 7.5) {
  if (!raycaster || !Array.isArray(interactables) || interactables.length === 0) {
    return null;
  }
  const canTestSprites = Boolean(raycaster.camera);
  let bestHit = null;
  for (const item of interactables) {
    if (!item?.mesh || item.mesh.visible === false) continue;
    const hits = canTestSprites
      ? raycaster.intersectObject(item.mesh, true)
      : raycaster.intersectObjects(collectNonSpriteMeshes(item.mesh), false);
    for (const h of hits) {
      if (!h || h.distance > maxDist) continue;
      let cur = h.object;
      let vis = true;
      while (cur) {
        if (cur.visible === false) {
          vis = false;
          break;
        }
        cur = cur.parent;
      }
      if (!vis) continue;
      const effectiveDist = item.isProp ? h.distance + 0.05 : h.distance;
      const bestEffective = bestHit
        ? bestHit.item.isProp
          ? bestHit.distance + 0.05
          : bestHit.distance
        : Infinity;
      if (!bestHit || effectiveDist < bestEffective) {
        bestHit = { item, distance: h.distance, hit: h };
      }
      break;
    }
  }
  if (!bestHit) return null;
  if (Array.isArray(occluders) && occluders.length > 0) {
    const wallHits = raycaster.intersectObjects(occluders, false);
    if (wallHits.length > 0 && wallHits[0].distance < bestHit.distance - 0.12) {
      return null;
    }
  }
  return bestHit;
}

export class SceneManager {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#cfe4f7');
    this.scene.fog = new THREE.Fog('#cfe4f7', 38, 105);

    const viewW = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1280;
    const viewH = typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 720;
    this.camera = new THREE.PerspectiveCamera(
      68,
      viewW / Math.max(1, viewH),
      0.1,
      180
    );
    this.camera.position.set(-3.95, 1.68, 0.65);

    this.xrErrors = [];
    this.paused = false;
    this.vrPresenting = false;
    this.vrManager = null;
    this.quality = 'high';
    this.deviceProfile = options.deviceProfile || detectDeviceProfile();
    this.updaters = [];
    this.alwaysUpdaters = [];
    this.beforeRenderCallbacks = [];
    this.customRenderScene = null;
    this.customStepFn = null;
    this.clock = new THREE.Clock();
    this.fps = 60;
    this._loopErrorLogged = new Set();

    if (options.renderer) {
      this.renderer = options.renderer;
    } else {
      let glContext = null;
      if (canvas && typeof canvas.getContext === 'function') {
        try {
          glContext = canvas.getContext('webgl2', {
            alpha: false,
            depth: true,
            stencil: false,
            antialias: true,
            powerPreference: 'high-performance',
            xrCompatible: true
          });
        } catch {
          glContext = null;
        }
      }
      const rendererOpts = {
        canvas,
        antialias: true,
        powerPreference: 'high-performance'
      };
      if (glContext) {
        rendererOpts.context = glContext;
      }
      this.renderer = new THREE.WebGLRenderer(rendererOpts);
    }

    if (this.renderer.xr) {
      this.renderer.xr.enabled = true;
      this.renderer.xr.setReferenceSpaceType?.('local-floor');
    }
    this.renderer.autoClear = true;
    this.renderer.setClearColor?.('#cfe4f7', 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;
    if (this.renderer.shadowMap) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    if (!options.skipEnvironment && !options.renderer) {
      this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      this.pmremGenerator.compileEquirectangularShader();
      const roomEnv = new RoomEnvironment();
      this.envRenderTarget = this.pmremGenerator.fromScene(roomEnv, 0.04);
      this.scene.environment = this.envRenderTarget.texture;
      this.scene.environmentIntensity = 0.65;
      roomEnv.dispose();
    } else {
      this.pmremGenerator = null;
      this.envRenderTarget = null;
    }

    this.celebrationRig = createWorldCelebrationRig(this.scene);

    this._onXrSessionStart = () => {
      this.customRenderScene = null;
      this.customStepFn = null;
      this.renderer.autoClear = true;
      this.renderer.setClearColor?.('#cfe4f7', 1);
      this.setVrPresentingState(true);
      this.vrManager?.handleXrSessionStart?.();
    };
    this._onXrSessionEnd = () => {
      this.setVrPresentingState(false);
    };
    this._onContextLost = (ev) => {
      ev?.preventDefault?.();
      this.recordXrError('webgl', 'WebGL context lost');
    };
    this._onContextRestored = () => {
      this.renderer.autoClear = true;
      this.renderer.setClearColor?.('#cfe4f7', 1);
    };

    this.renderer.xr?.addEventListener?.('sessionstart', this._onXrSessionStart);
    this.renderer.xr?.addEventListener?.('sessionend', this._onXrSessionEnd);
    this.canvas?.addEventListener?.('webglcontextlost', this._onContextLost, false);
    this.canvas?.addEventListener?.('webglcontextrestored', this._onContextRestored, false);

    this._setupLights();
    this.setQuality('high');
    this._onResize = this._handleResize.bind(this);
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', this._onResize);
      window.addEventListener('orientationchange', this._onResize);
      window.visualViewport?.addEventListener?.('resize', this._onResize);
    }
    this._handleResize();

    if (typeof navigator !== 'undefined' && navigator.xr) {
      this.ensureXrCompatible().catch(() => {});
    }
  }

  recordXrError(source, err) {
    const rawMsg =
      err instanceof Error
        ? err.message || err.name
        : typeof err === 'string'
          ? err
          : String(err || 'Erreur inconnue');
    const entry = `[${source}] ${rawMsg}`.slice(0, 140);
    if (this.xrErrors[this.xrErrors.length - 1] !== entry) {
      this.xrErrors.push(entry);
      if (this.xrErrors.length > 8) {
        this.xrErrors.shift();
      }
    }
  }

  getXrErrors() {
    return [...this.xrErrors];
  }

  async ensureXrCompatible() {
    const gl = this.renderer?.getContext?.();
    if (!gl) return false;
    try {
      const attrs = gl.getContextAttributes?.();
      if (attrs?.xrCompatible === true) return true;
      if (typeof gl.makeXRCompatible === 'function') {
        await gl.makeXRCompatible();
      }
      return true;
    } catch (err) {
      this.recordXrError('xrCompatible', err);
      return false;
    }
  }

  _setupLights() {
    this.ambient = new THREE.AmbientLight('#f8fafc', 0.42);
    this.scene.add(this.ambient);

    this.hemi = new THREE.HemisphereLight('#e6f2ff', '#cbd5e1', 0.82);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight('#fff4de', 1.42);
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

    this.flashlight = new THREE.SpotLight('#e2f1ff', 0, 18, Math.PI / 4.2, 0.52, 1.35);
    this.flashlight.visible = false;
    this.scene.add(this.flashlight);
    this.scene.add(this.flashlight.target);
    this.horrorMode = false;
    this._horrorCamPos = new THREE.Vector3();
    this._horrorCamDir = new THREE.Vector3();
    this._savedFlashPos = new THREE.Vector3();
    this._savedFlashTargetPos = new THREE.Vector3();
    this._hiddenStatesScratch = [];
  }

  restoreNormalExposure() {
    if (this.renderer) {
      this.renderer.toneMappingExposure = 0.96;
    }
  }

  setHorrorAtmosphere(active, threat = 0, flicker = 1, fogFarOverride = null) {
    this.horrorMode = Boolean(active);
    if (!this.horrorMode) {
      if (this.scene.background?.isColor) {
        this.scene.background.set('#cfe4f7');
      } else {
        this.scene.background = new THREE.Color('#cfe4f7');
      }
      if (this.scene.fog) {
        this.scene.fog.color.set('#cfe4f7');
        const diag = Math.hypot(this._worldWidth || 26, this._worldDepth || 24.4);
        this.scene.fog.near = Math.max(38, diag * 0.82);
        this.scene.fog.far = Math.max(105, diag * 1.85);
      }
      this.renderer?.setClearColor?.('#cfe4f7', 1);
      if (this.ambient) {
        this.ambient.color.set('#f8fafc');
        this.ambient.intensity = 0.42;
      }
      if (this.hemi) {
        this.hemi.color.set('#e6f2ff');
        this.hemi.intensity = 0.82;
      }
      if (this.sun) this.sun.intensity = 1.42;
      if (this.fill) {
        this.fill.color.set('#f8fafc');
        this.fill.intensity = 0.42;
      }
      this.scene.environmentIntensity = 0.65;
      if (this.flashlight) {
        this.flashlight.visible = false;
        this.flashlight.intensity = 0;
      }
      return;
    }

    const flk = Math.max(0.1, Math.min(1.2, Number(flicker) || 1));
    const thr = Math.max(0, Math.min(1, Number(threat) || 0));
    const fogHex = thr > 0.5 ? '#1b050a' : '#050814';
    if (this.scene.background?.isColor) {
      this.scene.background.set(fogHex);
    } else {
      this.scene.background = new THREE.Color(fogHex);
    }
    if (this.scene.fog) {
      this.scene.fog.color.set(fogHex);
      this.scene.fog.near = 3.2;
      this.scene.fog.far = Number.isFinite(Number(fogFarOverride)) ? Number(fogFarOverride) : 19.5;
    }
    this.renderer?.setClearColor?.(fogHex, 1);
    if (this.ambient) {
      this.ambient.color.set(thr > 0.55 ? '#fca5a5' : '#e2e8f0');
      this.ambient.intensity = (thr > 0.55 ? 0.18 : 0.14) * flk;
    }
    if (this.hemi) {
      this.hemi.color.set(thr > 0.55 ? '#ef4444' : '#94a3b8');
      this.hemi.intensity = 0.22 * flk;
    }
    if (this.sun) this.sun.intensity = 0.16 * flk;
    if (this.fill) {
      this.fill.color.set(thr > 0.55 ? '#dc2626' : '#f8fafc');
      this.fill.intensity = (thr > 0.55 ? 0.24 : 0.12) * flk;
    }
    this.scene.environmentIntensity = 0.16;

    if (this.flashlight && this.camera) {
      this.flashlight.visible = true;
      this.flashlight.intensity = (2.8 + thr * 0.4) * (0.85 + flk * 0.15);
      this.camera.getWorldPosition(this._horrorCamPos);
      this.camera.getWorldDirection(this._horrorCamDir);
      this.flashlight.position.copy(this._horrorCamPos);
      this.flashlight.target.position
        .copy(this._horrorCamPos)
        .addScaledVector(this._horrorCamDir, 6);
      this.flashlight.target.updateMatrixWorld();
    }
  }

  setCombatAtmosphere(active) {
    this.combatMode = Boolean(active);
    if (!this.combatMode) {
      this.setHorrorAtmosphere(false, 0, 1);
      return;
    }
    this.horrorMode = false;
    const bgHex = '#060d1f';
    if (this.scene.background?.isColor) {
      this.scene.background.set(bgHex);
    } else {
      this.scene.background = new THREE.Color(bgHex);
    }
    if (this.scene.fog) {
      this.scene.fog.color.set(bgHex);
      this.scene.fog.near = 26;
      this.scene.fog.far = 84;
    }
    this.renderer?.setClearColor?.(bgHex, 1);
    if (this.ambient) {
      this.ambient.color.set('#cbd5e1');
      this.ambient.intensity = 0.45;
    }
    if (this.hemi) {
      this.hemi.color.set('#38bdf8');
      this.hemi.intensity = 0.68;
    }
    if (this.sun) this.sun.intensity = 0.72;
    if (this.fill) {
      this.fill.color.set('#38bdf8');
      this.fill.intensity = 0.36;
    }
    this.scene.environmentIntensity = 0.55;
    if (this.flashlight) {
      this.flashlight.visible = false;
      this.flashlight.intensity = 0;
    }
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
    this._worldWidth = width;
    this._worldDepth = depth;

    this.camera.far = Math.max(180, diag * 1.8);
    this.camera.updateProjectionMatrix();

    if (this.scene.fog && !this.horrorMode) {
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
      const targetMapSize = 1024;
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
    if (!this.renderer.xr?.isPresenting && !this.vrPresenting) {
      this.camera.updateProjectionMatrix();
    }
  }

  bindVrManager(vrManager) {
    this.vrManager = vrManager || null;
  }

  setVrPresentingState(presenting) {
    this.vrPresenting = Boolean(presenting);
    this.camera.near = this.vrPresenting ? 0.05 : 0.1;
    this.camera.far = Math.max(180, Number(this.camera.far) || 180);
    if (this.vrPresenting) {
      this.customRenderScene = null;
      this.customStepFn = null;
      this.renderer.autoClear = true;
      this.renderer.setClearColor?.('#cfe4f7', 1);
    }
    if (!this.renderer.xr?.isPresenting) {
      this.camera.updateProjectionMatrix();
    }
    if (!this.vrPresenting) {
      this.setQuality(this.quality);
      this._handleResize();
    }
  }

  setDeviceProfile(profile) {
    if (profile && typeof profile === 'object') {
      this.deviceProfile = profile;
      this.setQuality(this.quality);
    }
  }

  setQuality(quality) {
    this.quality = quality;
    const xrPresenting = Boolean(this.renderer.xr?.isPresenting || this.vrPresenting);
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const targetPr = computeAdaptivePixelRatio({
      devicePixelRatio: dpr,
      quality,
      isMobile: Boolean(this.deviceProfile?.isMobile),
      isTablet: Boolean(this.deviceProfile?.isTablet),
      isVr: xrPresenting
    });
    if (!xrPresenting) {
      this.renderer.setPixelRatio?.(targetPr);
    }
    if (quality === 'eco') {
      if (this.renderer.shadowMap) this.renderer.shadowMap.enabled = false;
      this.sun.castShadow = false;
    } else if (quality === 'balanced') {
      const shadowsAllowed = !this.deviceProfile?.isMobile;
      if (this.renderer.shadowMap) this.renderer.shadowMap.enabled = shadowsAllowed;
      this.sun.castShadow = shadowsAllowed;
    } else {
      if (this.renderer.shadowMap) this.renderer.shadowMap.enabled = true;
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

  addBeforeRender(fn) {
    if (typeof fn === 'function') {
      this.beforeRenderCallbacks.push(fn);
    }
  }

  removeBeforeRender(fn) {
    this.beforeRenderCallbacks = this.beforeRenderCallbacks.filter((cb) => cb !== fn);
  }

  renderToTarget(renderTarget, virtualCamera, opts = {}) {
    if (!this.renderer || !renderTarget || !virtualCamera) return false;
    const renderer = this.renderer;
    const prevTarget = renderer.getRenderTarget?.() ?? null;
    const prevXrEnabled = renderer.xr ? Boolean(renderer.xr.enabled) : false;
    const prevShadowAuto = renderer.shadowMap ? Boolean(renderer.shadowMap.autoUpdate) : false;
    const prevAutoClear = renderer.autoClear;

    const hiddenStates = this._hiddenStatesScratch;
    hiddenStates.length = 0;
    if (Array.isArray(opts.hiddenObjects)) {
      for (const obj of opts.hiddenObjects) {
        if (!obj) continue;
        hiddenStates.push(obj, obj.visible);
        obj.visible = false;
      }
    }

    let prevFlashVisible = false;
    let prevFlashIntensity = 0;
    let prevFlashColorHex;
    if (this.flashlight) {
      prevFlashVisible = this.flashlight.visible;
      prevFlashIntensity = this.flashlight.intensity;
      prevFlashColorHex = this.flashlight.color?.getHex?.();
      this._savedFlashPos.copy(this.flashlight.position);
      this._savedFlashTargetPos.copy(this.flashlight.target.position);
    }
    const prevAmbIntensity = this.ambient ? this.ambient.intensity : null;
    const prevFogFar = this.scene.fog ? this.scene.fog.far : null;

    try {
      if (opts.ambientBoost !== undefined && this.ambient) {
        this.ambient.intensity = Math.max(this.ambient.intensity, Number(opts.ambientBoost) || 0.3);
      }
      if (opts.fogFar !== undefined && this.scene.fog) {
        this.scene.fog.far = Number(opts.fogFar) || 26;
      }
      if (this.flashlight && opts.flashlightPose) {
        this.flashlight.visible = true;
        this.flashlight.intensity = opts.flashlightPose.intensity ?? 3.4;
        if (opts.flashlightPose.color) {
          this.flashlight.color.set(opts.flashlightPose.color);
        }
        this.flashlight.position.copy(opts.flashlightPose.position);
        this.flashlight.target.position.copy(opts.flashlightPose.target);
        this.flashlight.target.updateMatrixWorld();
      }
      if (renderer.xr) renderer.xr.enabled = false;
      if (renderer.shadowMap) renderer.shadowMap.autoUpdate = false;
      renderer.autoClear = true;
      renderer.setRenderTarget?.(renderTarget);
      renderer.clear?.(true, true, false);
      renderer.render(this.scene, virtualCamera);
      return true;
    } catch (err) {
      this.recordXrError('povRender', err);
      return false;
    } finally {
      for (let i = 0; i < hiddenStates.length; i += 2) {
        hiddenStates[i].visible = hiddenStates[i + 1];
      }
      hiddenStates.length = 0;
      if (this.flashlight) {
        this.flashlight.visible = prevFlashVisible;
        this.flashlight.intensity = prevFlashIntensity;
        if (prevFlashColorHex !== undefined) {
          this.flashlight.color.setHex(prevFlashColorHex);
        }
        this.flashlight.position.copy(this._savedFlashPos);
        this.flashlight.target.position.copy(this._savedFlashTargetPos);
        this.flashlight.target.updateMatrixWorld();
      }
      if (this.ambient && prevAmbIntensity !== null) {
        this.ambient.intensity = prevAmbIntensity;
      }
      if (this.scene.fog && prevFogFar !== null) {
        this.scene.fog.far = prevFogFar;
      }
      renderer.setRenderTarget?.(prevTarget);
      if (renderer.xr) renderer.xr.enabled = prevXrEnabled;
      if (renderer.shadowMap) renderer.shadowMap.autoUpdate = prevShadowAuto;
      renderer.autoClear = prevAutoClear;
    }
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
    if (this.renderer.xr?.isPresenting || this.vrPresenting) return;
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

  applyIntroCinematicShot(stepIndex = 0, stepProgress = 0, elapsed = 0, teacherPos = { x: -3.35, z: -1.35 }) {
    if (this.renderer.xr?.isPresenting || this.vrPresenting) return;
    const idx = Math.max(0, Math.min(INTRO_CINEMATIC_SHOTS.length - 1, Math.floor(Number(stepIndex) || 0)));
    const shot = INTRO_CINEMATIC_SHOTS[idx];
    const tRaw = Math.max(0, Math.min(1, Number(stepProgress) || 0));
    const ease = tRaw < 0.5 ? 2 * tRaw * tRaw : 1 - Math.pow(-2 * tRaw + 2, 2) / 2;

    const tx = Number.isFinite(Number(teacherPos?.x)) ? Number(teacherPos.x) : -3.35;
    const tz = Number.isFinite(Number(teacherPos?.z)) ? Number(teacherPos.z) : -1.35;
    const dx = shot.focusTeacher ? tx - -3.35 : 0;
    const dz = shot.focusTeacher ? tz - -1.35 : 0;

    const swayX = Math.sin(elapsed * 0.45) * 0.14;
    const swayY = Math.cos(elapsed * 0.35) * 0.04;

    const px = shot.fromPos[0] + (shot.toPos[0] - shot.fromPos[0]) * ease + dx + swayX;
    const py = shot.fromPos[1] + (shot.toPos[1] - shot.fromPos[1]) * ease + swayY;
    const pz = shot.fromPos[2] + (shot.toPos[2] - shot.fromPos[2]) * ease + dz;

    const lx = shot.fromLook[0] + (shot.toLook[0] - shot.fromLook[0]) * ease + dx;
    const ly = shot.fromLook[1] + (shot.toLook[1] - shot.fromLook[1]) * ease;
    const lz = shot.fromLook[2] + (shot.toLook[2] - shot.fromLook[2]) * ease + dz;

    this.camera.position.set(px, py, pz);
    this.camera.lookAt(lx, ly, lz);
  }

  updateCelebration(dt, elapsed = 0) {
    return this.celebrationRig?.update(dt, elapsed);
  }

  _handleResize() {
    if (this.renderer.xr?.isPresenting || this.vrPresenting) return;
    const w = Math.max(1, (typeof window !== 'undefined' ? window.innerWidth : 1280) || 1);
    const h = Math.max(1, (typeof window !== 'undefined' ? window.innerHeight : 720) || 1);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize?.(w, h, false);
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
      const isXr = Boolean(this.renderer.xr?.isPresenting || this.vrPresenting);
      try {
        this.celebrationRig?.update(dt, elapsed);
      } catch (err) {
        this.recordXrError('celebration', err);
      }
      if (this.customRenderScene) {
        try {
          if (this.customStepFn) {
            this.customStepFn(dt, elapsed);
          }
          for (let i = 0; i < this.alwaysUpdaters.length; i++) {
            try {
              this.alwaysUpdaters[i](dt, elapsed);
            } catch (err) {
              this.recordXrError(`alwaysUpdater:${i}`, err);
            }
          }
          if (isXr) {
            this.renderer.autoClear = true;
            if (!this.customRenderScene.background) {
              this.renderer.setClearColor?.('#071326', 1);
            }
            const activeRt = this.renderer.getRenderTarget?.();
            if (activeRt && !activeRt.isXRRenderTarget) {
              this.renderer.setRenderTarget?.(null);
            }
          }
          this.renderer.render(this.customRenderScene, this.camera);
        } catch (err) {
          this.recordXrError('customRender', err);
        }
        return;
      }
      if (!this.paused) {
        for (let i = 0; i < this.updaters.length; i++) {
          try {
            this.updaters[i](dt, elapsed);
          } catch (err) {
            this.recordXrError(`updater:${i}`, err);
          }
        }
      }
      if (!this.paused || isXr) {
        for (let i = 0; i < this.alwaysUpdaters.length; i++) {
          try {
            this.alwaysUpdaters[i](dt, elapsed);
          } catch (err) {
            this.recordXrError(`alwaysUpdater:${i}`, err);
          }
        }
        for (let i = 0; i < this.beforeRenderCallbacks.length; i++) {
          try {
            this.beforeRenderCallbacks[i](dt, elapsed, isXr);
          } catch (err) {
            this.recordXrError(`beforeRender:${i}`, err);
          }
        }
        if (isXr) {
          this.renderer.autoClear = true;
          this.renderer.setClearColor?.(this.horrorMode ? '#050814' : '#cfe4f7', 1);
          const activeRt = this.renderer.getRenderTarget?.();
          if (activeRt && !activeRt.isXRRenderTarget) {
            this.renderer.setRenderTarget?.(null);
          }
        }
        try {
          this.renderer.render(this.scene, this.camera);
        } catch (err) {
          this.recordXrError('render', err);
        }
      }
    });
  }

  dispose() {
    this.renderer?.setAnimationLoop?.(null);
    this.renderer?.xr?.removeEventListener?.('sessionstart', this._onXrSessionStart);
    this.renderer?.xr?.removeEventListener?.('sessionend', this._onXrSessionEnd);
    this.canvas?.removeEventListener?.('webglcontextlost', this._onContextLost, false);
    this.canvas?.removeEventListener?.('webglcontextrestored', this._onContextRestored, false);
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('orientationchange', this._onResize);
      window.visualViewport?.removeEventListener?.('resize', this._onResize);
    }
    this.envRenderTarget?.dispose?.();
    this.pmremGenerator?.dispose?.();
  }
}
