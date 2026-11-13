import * as THREE from 'three';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0c1526');
    this.scene.fog = new THREE.Fog('#0c1526', 28, 72);

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
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.paused = false;
    this.quality = 'high';
    this.updaters = [];
    this.clock = new THREE.Clock();

    this._setupLights();
    this.setQuality('high');
    this._onResize = this._handleResize.bind(this);
    window.addEventListener('resize', this._onResize);
    this._handleResize();
  }

  _setupLights() {
    const hemi = new THREE.HemisphereLight('#e0f2fe', '#1e293b', 1.12);
    this.scene.add(hemi);

    this.sun = new THREE.DirectionalLight('#f8fafc', 1.2);
    this.sun.position.set(8, 16, 10);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 45;
    this.sun.shadow.camera.left = -16;
    this.sun.shadow.camera.right = 16;
    this.sun.shadow.camera.top = 15;
    this.sun.shadow.camera.bottom = -15;
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.fill = new THREE.DirectionalLight('#38bdf8', 0.48);
    this.fill.position.set(-11, 8, -10);
    this.scene.add(this.fill);
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
      this.scene.fog.near = Math.max(28, diag * 0.65);
      this.scene.fog.far = Math.max(72, diag * 1.45);
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
      const targetMapSize = halfSpan > 28 ? 2048 : 1024;
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
    if (quality === 'eco') {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      this.sun.castShadow = false;
    } else if (quality === 'balanced') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
      this.renderer.shadowMap.enabled = true;
      this.sun.castShadow = true;
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = true;
      this.sun.castShadow = true;
    }
    this._handleResize();
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
    if (!this.paused) {
      this.clock.getDelta(); // Reset delta spike after unpausing
    }
  }

  addUpdater(fn) {
    this.updaters.push(fn);
  }

  _handleResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  start() {
    const tick = () => {
      requestAnimationFrame(tick);
      if (this.paused) return;
      const dt = Math.min(this.clock.getDelta(), 0.1);
      const elapsed = this.clock.elapsedTime;
      for (const fn of this.updaters) {
        fn(dt, elapsed);
      }
      this.renderer.render(this.scene, this.camera);
    };
    requestAnimationFrame(tick);
  }
}
