import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

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
      const dt = Math.min(this.clock.getDelta(), 0.1);
      const elapsed = this.clock.elapsedTime;
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
