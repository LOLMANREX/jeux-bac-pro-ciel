import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { sfx } from '../core/audio.js';

function createRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function createOakSurfaceTextures() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d8bc94';
  ctx.fillRect(0, 0, 512, 512);
  const rng = createRng(4041);
  for (let i = 0; i < 240; i++) {
    const y = rng() * 512;
    const h = 1 + rng() * 4;
    ctx.fillStyle = rng() > 0.5 ? 'rgba(166, 128, 82, 0.14)' : 'rgba(236, 214, 180, 0.12)';
    ctx.fillRect(0, y, 512, h);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1.5);
  return tex;
}

export function createEsdMatTexture(baseHex = '#1e5b70', gridHex = '#2f829c') {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = gridHex;
  ctx.lineWidth = 1.5;
  for (let p = 0; p <= 512; p += 32) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(512, p);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 492, 492);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('ESD SAFE WORKSTATION • 1 MΩ', 24, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeCanvasScreen(width, height, drawFn) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const safeDraw = typeof drawFn === 'function' ? drawFn : () => {};
  const update = (...args) => {
    safeDraw(ctx, width, height, ...args);
    texture.needsUpdate = true;
  };
  update();
  return { canvas, ctx, texture, update };
}

export function buildFlexibleCable(points, colorHex = '#0284c7', radius = 0.012, emissive = null) {
  let pts = points.map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2])));
  let curve = new THREE.CatmullRomCurve3(pts);
  let geom = new THREE.TubeGeometry(curve, 28, radius, 8, false);
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.42,
    metalness: 0.08,
    emissive: emissive || '#000000',
    emissiveIntensity: emissive ? 0.35 : 0
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = true;

  const updatePoints = (nextPoints) => {
    pts = nextPoints.map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2])));
    curve = new THREE.CatmullRomCurve3(pts);
    const nextGeom = new THREE.TubeGeometry(curve, 28, radius, 8, false);
    mesh.geometry.dispose();
    mesh.geometry = nextGeom;
  };

  return { mesh, mat, updatePoints, getCurve: () => curve };
}

export function createWorkbench3D(container, options = {}) {
  if (document.pointerLockElement) {
    document.exitPointerLock?.();
  }
  const disposables = [];
  const track = (obj) => {
    disposables.push(obj);
    return obj;
  };

  const root = document.createElement('div');
  root.className = 'tp3d-root';
  root.innerHTML = `
    <canvas class="tp3d-canvas"></canvas>
    <div class="tp3d-tags-layer"></div>
    <div class="tp3d-brief-bar">
      <div class="tp3d-brief-badge" id="tp3d-step-badge">ÉTABLI 3D</div>
      <div class="tp3d-brief-main">
        <div class="tp3d-brief-title" id="tp3d-brief-title">Atelier interactif</div>
        <div class="tp3d-brief-sub" id="tp3d-brief-sub"></div>
      </div>
      <div class="tp3d-accuracy-pill">
        <span class="tp3d-acc-lbl">Score estimé</span>
        <strong id="tp3d-acc-val">-- / 20</strong>
      </div>
    </div>
    <div class="tp3d-cameras" id="tp3d-cameras"></div>
    <div class="tp3d-side-drawer hidden" id="tp3d-side-drawer"></div>
    <div class="tp3d-tooltip hidden" id="tp3d-tooltip"></div>
    <div class="tp3d-toast hidden" id="tp3d-toast"></div>
    <div class="tp3d-bottom-dock">
      <div class="tp3d-tools" id="tp3d-tools"></div>
      <div class="tp3d-actions" id="tp3d-actions"></div>
    </div>
  `;
  container.innerHTML = '';
  container.appendChild(root);

  const canvas = root.querySelector('.tp3d-canvas');
  const tagsLayer = root.querySelector('.tp3d-tags-layer');
  const briefBadgeEl = root.querySelector('#tp3d-step-badge');
  const briefTitleEl = root.querySelector('#tp3d-brief-title');
  const briefSubEl = root.querySelector('#tp3d-brief-sub');
  const accValEl = root.querySelector('#tp3d-acc-val');
  const camerasEl = root.querySelector('#tp3d-cameras');
  const sideDrawerEl = root.querySelector('#tp3d-side-drawer');
  const tooltipEl = root.querySelector('#tp3d-tooltip');
  const toastEl = root.querySelector('#tp3d-toast');
  const toolsEl = root.querySelector('#tp3d-tools');
  const actionsEl = root.querySelector('#tp3d-actions');

  const vrBridge = container.__vrBridge || null;
  const vrActive = Boolean(vrBridge?.isActive?.());
  if (vrActive) {
    root.style.pointerEvents = 'none';
  }

  const scene = new THREE.Scene();
  const bgColor = options.background || '#d6e4f2';
  scene.background = new THREE.Color(bgColor);
  scene.fog = new THREE.Fog(bgColor, 8, 22);

  const rect = container.getBoundingClientRect();
  const initW = Math.max(320, rect.width || window.innerWidth);
  const initH = Math.max(240, rect.height || window.innerHeight);

  const camera = new THREE.PerspectiveCamera(options.fov || 42, initW / initH, 0.02, 50);
  const baseCamPos = new THREE.Vector3(...(options.cameraPos || [0, 1.55, 2.05]));
  const baseLookAt = new THREE.Vector3(...(options.lookAt || [0, 0.15, 0]));
  const targetCamPos = baseCamPos.clone();
  const targetLookAt = baseLookAt.clone();
  const curLookAt = baseLookAt.clone();
  let targetFov = options.fov || 42;
  let orbitYaw = 0;
  let orbitPitch = 0;
  let zoomFactor = 1.0;

  camera.position.copy(baseCamPos);
  camera.lookAt(curLookAt);

  let renderer = null;
  let envTarget = null;
  if (vrActive) {
    renderer = vrBridge.renderer || null;
    scene.environment = vrBridge.envTexture || null;
    scene.environmentIntensity = options.envIntensity ?? 0.72;
  } else {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(initW, initH, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = options.envIntensity ?? 0.72;
    roomEnv.dispose();
    pmrem.dispose();
  }

  const hemiLight = new THREE.HemisphereLight('#f0f7ff', '#cbd5e1', 0.92);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight('#fff6e8', 1.48);
  keyLight.position.set(2.8, 4.6, 2.9);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 14;
  keyLight.shadow.camera.left = -3.5;
  keyLight.shadow.camera.right = 3.5;
  keyLight.shadow.camera.top = 3.5;
  keyLight.shadow.camera.bottom = -3.5;
  keyLight.shadow.bias = -0.0004;
  keyLight.shadow.normalBias = 0.012;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight('#e0f2fe', 0.55);
  rimLight.position.set(-3.2, 2.4, -2.5);
  scene.add(rimLight);

  if (options.includeBench !== false) {
    const benchW = options.benchWidth || 4.8;
    const benchD = options.benchDepth || 2.8;
    const benchGroup = new THREE.Group();

    const oakTex = track(createOakSurfaceTextures());
    const benchMat = track(
      new THREE.MeshStandardMaterial({
        map: options.benchColor ? null : oakTex,
        color: options.benchColor || '#ffffff',
        roughness: 0.48,
        metalness: 0.05
      })
    );
    const benchMesh = new THREE.Mesh(track(new THREE.BoxGeometry(benchW, 0.08, benchD)), benchMat);
    benchMesh.position.set(0, -0.04, 0);
    benchMesh.receiveShadow = true;
    benchGroup.add(benchMesh);

    const trimMat = track(
      new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.35, metalness: 0.7 })
    );
    const frontTrim = new THREE.Mesh(track(new THREE.BoxGeometry(benchW, 0.082, 0.04)), trimMat);
    frontTrim.position.set(0, -0.04, benchD / 2);
    benchGroup.add(frontTrim);

    const backWallMat = track(
      new THREE.MeshStandardMaterial({ color: options.wallColor || '#e2ebf4', roughness: 0.9, metalness: 0.0 })
    );
    const backWall = new THREE.Mesh(track(new THREE.PlaneGeometry(14, 6)), backWallMat);
    backWall.position.set(0, 2.1, -benchD / 2 - 0.65);
    backWall.receiveShadow = true;
    benchGroup.add(backWall);

    const floorMesh = new THREE.Mesh(
      track(new THREE.PlaneGeometry(18, 18)),
      track(new THREE.MeshStandardMaterial({ color: '#c4d0dd', roughness: 0.65 }))
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.82;
    benchGroup.add(floorMesh);

    if (options.hasEsdMat) {
      const matW = options.esdWidth || 2.4;
      const matD = options.esdDepth || 1.45;
      const esdTex = track(createEsdMatTexture(options.esdColor || '#1e5b70', options.esdGridColor || '#2c7e98'));
      const esdMat = track(new THREE.MeshStandardMaterial({ map: esdTex, roughness: 0.72, metalness: 0.04 }));
      const matMesh = new THREE.Mesh(track(new THREE.BoxGeometry(matW, 0.01, matD)), esdMat);
      matMesh.position.set(0, 0.005, 0.08);
      matMesh.receiveShadow = true;
      benchGroup.add(matMesh);
    }

    scene.add(benchGroup);
  }

  const particles = [];
  const particleGeom = track(new THREE.SphereGeometry(1, 8, 8));
  const pulseRings = [];
  const pulseGeom = track(new THREE.RingGeometry(0.85, 1.0, 28));

  const spawnParticle = (pos, opts = {}) => {
    const mat = new THREE.MeshBasicMaterial({
      color: opts.color || '#f8fafc',
      transparent: true,
      opacity: opts.opacity ?? 0.65,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(particleGeom, mat);
    const p = pos.isVector3 ? pos : new THREE.Vector3(...pos);
    mesh.position.copy(p);
    const scale = opts.scale ?? 0.018;
    mesh.scale.setScalar(scale);
    scene.add(mesh);
    particles.push({
      mesh,
      mat,
      vx: opts.vx ?? (Math.random() - 0.5) * 0.06,
      vy: opts.vy ?? 0.14 + Math.random() * 0.12,
      vz: opts.vz ?? (Math.random() - 0.5) * 0.06,
      gravity: opts.gravity ?? 0,
      grow: opts.grow ?? 0.04,
      age: 0,
      life: opts.life ?? 0.9,
      initScale: scale,
      initOpacity: opts.opacity ?? 0.65
    });
  };

  const spawnSmoke = (pos, opts = {}) => {
    const count = opts.count ?? 3;
    const p = pos.isVector3 ? pos : new THREE.Vector3(...pos);
    for (let i = 0; i < count; i++) {
      spawnParticle(
        [p.x + (Math.random() - 0.5) * 0.02, p.y + (Math.random() - 0.5) * 0.01, p.z + (Math.random() - 0.5) * 0.02],
        {
          color: opts.color || '#f1f5f9',
          opacity: opts.opacity ?? 0.55,
          scale: (opts.scale ?? 0.016) * (0.8 + Math.random() * 0.5),
          vy: (opts.speed ?? 0.16) * (0.8 + Math.random() * 0.5),
          vx: (Math.random() - 0.5) * 0.05,
          vz: (Math.random() - 0.5) * 0.05,
          grow: opts.grow ?? 0.055,
          life: opts.life ?? 0.95
        }
      );
    }
  };

  const spawnSparks = (pos, opts = {}) => {
    const count = opts.count ?? 8;
    const p = pos.isVector3 ? pos : new THREE.Vector3(...pos);
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 0.25 + Math.random() * 0.45;
      spawnParticle(p, {
        color: opts.color || '#fbbf24',
        opacity: 0.95,
        scale: 0.008,
        vx: Math.cos(ang) * spd,
        vy: 0.25 + Math.random() * 0.35,
        vz: Math.sin(ang) * spd,
        gravity: 1.8,
        grow: -0.004,
        life: 0.42
      });
    }
  };

  const spawnPulseRing = (pos, color = '#10b981', radius = 0.09) => {
    const mat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(pulseGeom, mat);
    const p = pos.isVector3 ? pos : new THREE.Vector3(...pos);
    mesh.position.set(p.x, p.y + 0.006, p.z);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.setScalar(radius * 0.3);
    scene.add(mesh);
    pulseRings.push({ mesh, mat, age: 0, life: 0.48, maxScale: radius });
  };

  const interactives = [];
  const interactiveMeshes = [];
  const addInteractive = (object3d, handlers) => {
    const entry = {
      object3d,
      label: handlers.label || '',
      cursor: handlers.cursor || 'pointer',
      dragPlane: handlers.dragPlane || null,
      highlightTargets: handlers.highlightTargets || null,
      enabled: handlers.enabled ?? (() => true),
      onClick: handlers.onClick || null,
      onDragStart: handlers.onDragStart || null,
      onDragMove: handlers.onDragMove || null,
      onDragEnd: handlers.onDragEnd || null,
      onHoldTick: handlers.onHoldTick || null,
      hoverSnapshot: null
    };
    const trackedMeshes = new Set();
    const bindTarget = (targetObj) => {
      if (!targetObj) return;
      targetObj.traverse((ch) => {
        if (ch.isMesh) {
          ch.userData.__tpInteract = entry;
          if (!interactiveMeshes.includes(ch)) interactiveMeshes.push(ch);
          trackedMeshes.add(ch);
        }
      });
    };
    bindTarget(object3d);
    if (Array.isArray(handlers.highlightTargets)) {
      handlers.highlightTargets.forEach((ht) => {
        if (ht?.traverse) {
          ht.traverse((ch) => {
            if (ch.isMesh) trackedMeshes.add(ch);
          });
        }
      });
    }
    entry.trackedMeshes = trackedMeshes;
    interactives.push(entry);
    return entry;
  };

  const removeInteractive = (object3d) => {
    object3d.traverse((ch) => {
      if (ch.isMesh) {
        delete ch.userData.__tpInteract;
        const idx = interactiveMeshes.indexOf(ch);
        if (idx >= 0) interactiveMeshes.splice(idx, 1);
      }
    });
    for (let i = interactives.length - 1; i >= 0; i--) {
      if (interactives[i].object3d === object3d) {
        if (hoveredEntry === interactives[i]) hoveredEntry = null;
        interactives.splice(i, 1);
      }
    }
  };

  const floatingTags = [];
  const addFloatingTag = (posOrFn, html, className = '') => {
    const el = document.createElement('div');
    el.className = `tp3d-float-tag ${className}`.trim();
    el.innerHTML = html;
    tagsLayer.appendChild(el);
    const entry = { el, posOrFn };
    floatingTags.push(entry);
    return {
      el,
      setHtml: (next) => {
        el.innerHTML = next;
      },
      setVisible: (v) => {
        el.style.display = v ? '' : 'none';
      },
      remove: () => {
        el.remove();
        const i = floatingTags.indexOf(entry);
        if (i >= 0) floatingTags.splice(i, 1);
      }
    };
  };

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const defaultDragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.02);
  let activePointerId = null;
  let hoveredEntry = null;
  let dragEntry = null;
  let dragHit = null;
  let orbiting = false;
  let pointerDownPos = { x: 0, y: 0 };
  let lastPointerPos = { x: 0, y: 0 };
  let totalDragPx = 0;

  const toNdc = (clientX, clientY) => {
    const b = canvas.getBoundingClientRect();
    ndc.x = ((clientX - b.left) / Math.max(1, b.width)) * 2 - 1;
    ndc.y = -((clientY - b.top) / Math.max(1, b.height)) * 2 + 1;
    return ndc;
  };

  const pickInteractive = (clientX, clientY) => {
    toNdc(clientX, clientY);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(interactiveMeshes, false);
    for (const h of hits) {
      const entry = h.object?.userData?.__tpInteract;
      if (entry && entry.enabled()) {
        return { entry, hit: h };
      }
    }
    return null;
  };

  const projectOntoPlane = (clientX, clientY, plane) => {
    toNdc(clientX, clientY);
    raycaster.setFromCamera(ndc, camera);
    const out = new THREE.Vector3();
    return raycaster.ray.intersectPlane(plane || defaultDragPlane, out);
  };

  const setEntryHighlight = (entry, active) => {
    if (!entry || !entry.trackedMeshes) return;
    if (active) {
      if (!entry.hoverSnapshot) {
        const snap = new Map();
        for (const mesh of entry.trackedMeshes) {
          if (mesh.material && !Array.isArray(mesh.material) && mesh.material.emissive) {
            snap.set(mesh, {
              color: mesh.material.emissive.getHex(),
              intensity: mesh.material.emissiveIntensity || 0
            });
          }
        }
        entry.hoverSnapshot = snap;
      }
      for (const [mesh, orig] of entry.hoverSnapshot.entries()) {
        if (!mesh.material || !mesh.material.emissive) continue;
        if (orig.intensity < 0.35) mesh.material.emissive.setHex(0x38bdf8);
        mesh.material.emissiveIntensity = Math.max(orig.intensity + 0.38, 0.48);
      }
    } else if (entry.hoverSnapshot) {
      for (const [mesh, orig] of entry.hoverSnapshot.entries()) {
        if (!mesh.material || !mesh.material.emissive) continue;
        mesh.material.emissive.setHex(orig.color);
        mesh.material.emissiveIntensity = orig.intensity;
      }
      entry.hoverSnapshot = null;
    }
  };

  const updateTooltip = (entry, clientX, clientY) => {
    if (!entry || !entry.label) {
      tooltipEl.classList.add('hidden');
      return;
    }
    const b = root.getBoundingClientRect();
    tooltipEl.textContent = typeof entry.label === 'function' ? entry.label() : entry.label;
    tooltipEl.classList.remove('hidden');
    tooltipEl.style.left = `${Math.min(b.width - 140, Math.max(12, clientX - b.left + 14))}px`;
    tooltipEl.style.top = `${Math.max(58, clientY - b.top - 34)}px`;
  };

  const onPointerMoveCallbackFns = [];

  const handlePointerDown = (e) => {
    if (activePointerId !== null && activePointerId !== e.pointerId) return;
    activePointerId = e.pointerId;
    canvas.setPointerCapture?.(e.pointerId);
    pointerDownPos = { x: e.clientX, y: e.clientY };
    lastPointerPos = { x: e.clientX, y: e.clientY };
    totalDragPx = 0;

    const picked = pickInteractive(e.clientX, e.clientY);
    if (picked) {
      dragEntry = picked.entry;
      dragHit = picked.hit;
      orbiting = false;
      const planePt = projectOntoPlane(e.clientX, e.clientY, dragEntry.dragPlane);
      dragEntry.onDragStart?.(dragHit, { clientX: e.clientX, clientY: e.clientY, planePoint: planePt });
    } else {
      dragEntry = null;
      dragHit = null;
      orbiting = true;
    }
  };

  const handlePointerMove = (e) => {
    const dx = e.clientX - lastPointerPos.x;
    const dy = e.clientY - lastPointerPos.y;
    lastPointerPos = { x: e.clientX, y: e.clientY };

    for (const fn of onPointerMoveCallbackFns) {
      fn(e, projectOntoPlane(e.clientX, e.clientY, defaultDragPlane), raycaster, toNdc(e.clientX, e.clientY));
    }

    if (activePointerId === e.pointerId) {
      totalDragPx += Math.hypot(dx, dy);
      if (dragEntry) {
        const planePt = projectOntoPlane(e.clientX, e.clientY, dragEntry.dragPlane);
        dragEntry.onDragMove?.(planePt, dx, dy, dragHit, { clientX: e.clientX, clientY: e.clientY });
        updateTooltip(dragEntry, e.clientX, e.clientY);
        return;
      }
      if (orbiting) {
        orbitYaw = Math.max(-0.55, Math.min(0.55, orbitYaw - dx * 0.004));
        orbitPitch = Math.max(-0.32, Math.min(0.32, orbitPitch + dy * 0.0035));
        return;
      }
    }

    const picked = pickInteractive(e.clientX, e.clientY);
    const nextHover = picked?.entry || null;
    if (nextHover !== hoveredEntry) {
      if (hoveredEntry) setEntryHighlight(hoveredEntry, false);
      hoveredEntry = nextHover;
      if (hoveredEntry) setEntryHighlight(hoveredEntry, true);
    }
    canvas.style.cursor = hoveredEntry ? hoveredEntry.cursor || 'pointer' : orbiting ? 'grabbing' : 'grab';
    updateTooltip(hoveredEntry, e.clientX, e.clientY);
  };

  const handlePointerUp = (e) => {
    if (activePointerId !== e.pointerId) return;
    canvas.releasePointerCapture?.(e.pointerId);
    if (dragEntry) {
      const planePt = projectOntoPlane(e.clientX, e.clientY, dragEntry.dragPlane);
      if (totalDragPx < 9 && dragEntry.onClick) {
        dragEntry.onClick(dragHit, { clientX: e.clientX, clientY: e.clientY, planePoint: planePt });
      }
      dragEntry.onDragEnd?.({ clientX: e.clientX, clientY: e.clientY, planePoint: planePt, dragDist: totalDragPx });
    }
    activePointerId = null;
    dragEntry = null;
    dragHit = null;
    orbiting = false;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    zoomFactor = Math.max(0.68, Math.min(1.42, zoomFactor + e.deltaY * 0.0008));
  };

  const handleResize = () => {
    if (vrActive || !renderer) return;
    const r = container.getBoundingClientRect();
    const w = Math.max(320, r.width || window.innerWidth);
    const h = Math.max(240, r.height || window.innerHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };

  let resizeObserver = null;
  if (!vrActive) {
    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('resize', handleResize);
    resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => handleResize()) : null;
    resizeObserver?.observe(container);
    requestAnimationFrame(() => handleResize());
  }

  let rafId = null;
  const mountTime = performance.now();
  let lastTime = mountTime;
  const updaters = [];
  const tempVec = new THREE.Vector3();
  const offsetVec = new THREE.Vector3();
  let toastTimer = null;
  let activeVrRay = null;

  const vrState = {
    badge: 'ÉTABLI 3D',
    briefTitle: 'Atelier interactif',
    briefSub: '',
    accuracy: '-- / 20',
    toastText: '',
    tools: [],
    activeToolId: null,
    onSelectTool: null,
    actions: [],
    drawerControls: []
  };

  const syncVrPanel = () => {
    if (vrActive) vrBridge?.syncPanel?.();
  };

  const extractDrawerControls = () => {
    const list = [];
    let idx = 0;
    const elements = sideDrawerEl.querySelectorAll('button, input[type="range"]');
    elements.forEach((el) => {
      if (el.hidden || el.style.display === 'none') return;
      if (el.tagName === 'BUTTON') {
        const lbl = (el.textContent || 'Action').replace(/\s+/g, ' ').trim().slice(0, 26);
        list.push({
          id: `btn_${idx++}`,
          label: lbl,
          active: el.classList.contains('active') || el.getAttribute('aria-pressed') === 'true',
          disabled: Boolean(el.disabled),
          onClick: () => {
            el.click();
            extractDrawerControls();
            syncVrPanel();
          }
        });
      } else if (el.tagName === 'INPUT' && el.type === 'range') {
        const row = el.closest('div, label');
        const rawLbl =
          row?.querySelector('label, span, strong')?.textContent ||
          el.title ||
          el.id ||
          'Réglage';
        const shortLbl = rawLbl.replace(/\s+/g, ' ').trim().slice(0, 12);
        const step = parseFloat(el.step || '1') || 1;
        const min = el.min !== '' ? parseFloat(el.min) : 0;
        const max = el.max !== '' ? parseFloat(el.max) : 100;
        const span = max - min;
        const delta = span > 30 && step === 1 ? Math.round(span / 10) : step;
        const curVal = parseFloat(el.value || '0') || 0;
        const nudge = (dir) => {
          const cur = parseFloat(el.value || '0') || 0;
          const next = Math.max(min, Math.min(max, cur + dir * delta));
          el.value = String(next);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          extractDrawerControls();
          syncVrPanel();
        };
        list.push({
          id: `rng_m_${idx}`,
          label: `➖ ${shortLbl}`,
          active: false,
          onClick: () => nudge(-1)
        });
        list.push({
          id: `rng_p_${idx}`,
          label: `➕ ${shortLbl}:${Math.round(curVal * 10) / 10}`,
          active: false,
          onClick: () => nudge(1)
        });
        idx++;
      }
    });
    vrState.drawerControls = list;
  };

  const stepEffects = (dt) => {
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.age += dt;
      if (pt.age >= pt.life) {
        scene.remove(pt.mesh);
        pt.mat.dispose();
        particles.splice(i, 1);
        continue;
      }
      pt.vy -= pt.gravity * dt;
      pt.mesh.position.x += pt.vx * dt;
      pt.mesh.position.y += pt.vy * dt;
      pt.mesh.position.z += pt.vz * dt;
      const ratio = pt.age / pt.life;
      pt.mesh.scale.setScalar(Math.max(0.002, pt.initScale + pt.grow * pt.age));
      pt.mat.opacity = pt.initOpacity * (1 - ratio);
    }

    for (let i = pulseRings.length - 1; i >= 0; i--) {
      const pr = pulseRings[i];
      pr.age += dt;
      if (pr.age >= pr.life) {
        scene.remove(pr.mesh);
        pr.mat.dispose();
        pulseRings.splice(i, 1);
        continue;
      }
      const t = pr.age / pr.life;
      pr.mesh.scale.setScalar(pr.maxScale * (0.35 + t * 0.9));
      pr.mat.opacity = 0.9 * (1 - t);
    }
  };

  const tick = (now) => {
    rafId = requestAnimationFrame(tick);
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    const elapsed = now * 0.001;

    if (dragEntry && dragEntry.onHoldTick) {
      const planePt = projectOntoPlane(lastPointerPos.x, lastPointerPos.y, dragEntry.dragPlane);
      dragEntry.onHoldTick(dt, dragHit, { planePoint: planePt, elapsed });
    }

    for (const fn of updaters) fn(dt, elapsed);

    offsetVec.copy(targetCamPos).sub(targetLookAt).multiplyScalar(zoomFactor);
    const radiusXZ = Math.hypot(offsetVec.x, offsetVec.z);
    const baseAngle = Math.atan2(offsetVec.x, offsetVec.z);
    const nextAngle = baseAngle + orbitYaw;
    const goalX = targetLookAt.x + Math.sin(nextAngle) * radiusXZ;
    const goalZ = targetLookAt.z + Math.cos(nextAngle) * radiusXZ;
    const goalY = Math.max(0.22, targetLookAt.y + offsetVec.y * (1 + orbitPitch));

    const smooth = 1 - Math.exp(-8 * dt);
    camera.position.x += (goalX - camera.position.x) * smooth;
    camera.position.y += (goalY - camera.position.y) * smooth;
    camera.position.z += (goalZ - camera.position.z) * smooth;
    curLookAt.lerp(targetLookAt, smooth);
    camera.lookAt(curLookAt);
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * smooth;
      camera.updateProjectionMatrix();
    }

    stepEffects(dt);

    const cw = canvas.clientWidth || initW;
    const ch = canvas.clientHeight || initH;
    for (const tag of floatingTags) {
      if (tag.el.style.display === 'none') continue;
      const wp = typeof tag.posOrFn === 'function' ? tag.posOrFn() : tag.posOrFn;
      tempVec.copy(wp).project(camera);
      if (tempVec.z > 1) {
        tag.el.style.opacity = '0';
        continue;
      }
      const sx = (tempVec.x * 0.5 + 0.5) * cw;
      const sy = (-tempVec.y * 0.5 + 0.5) * ch;
      tag.el.style.opacity = '1';
      tag.el.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -100%)`;
    }

    renderer.render(scene, camera);
  };
  if (!vrActive) {
    rafId = requestAnimationFrame(tick);
  }

  const vrStep = (dt, elapsed) => {
    for (const fn of updaters) fn(dt, elapsed);
    stepEffects(dt);
  };

  const addUpdateFn = (fn) => {
    updaters.push(fn);
    return () => {
      const idx = updaters.indexOf(fn);
      if (idx >= 0) updaters.splice(idx, 1);
    };
  };

  const apiObj = {
    scene,
    camera,
    renderer,
    root,
    canvas,
    track,
    addUpdate: addUpdateFn,
    onTick: addUpdateFn,
    handleResize,
    onPointerMove: (fn) => onPointerMoveCallbackFns.push(fn),
    pickAt: pickInteractive,
    getElapsedSec: () => Math.max(0.1, (performance.now() - mountTime) / 1000),
    addInteractive,
    removeInteractive,
    addFloatingTag,
    spawnSmoke,
    spawnSparks,
    spawnPulseRing,
    setCameraView: (pos, lookAt, fov = 42, resetOrbit = true) => {
      targetCamPos.set(...pos);
      targetLookAt.set(...lookAt);
      targetFov = fov;
      if (resetOrbit) {
        orbitYaw = 0;
        orbitPitch = 0;
        zoomFactor = 1.0;
      }
    },
    resetCameraView: () => {
      targetCamPos.copy(baseCamPos);
      targetLookAt.copy(baseLookAt);
      targetFov = options.fov || 42;
      orbitYaw = 0;
      orbitPitch = 0;
      zoomFactor = 1.0;
    },
    setInstruction: (badge, title, subtext = '') => {
      briefBadgeEl.textContent = badge;
      briefTitleEl.textContent = title;
      briefSubEl.textContent = subtext;
      vrState.badge = badge;
      vrState.briefTitle = title;
      vrState.briefSub = subtext;
      syncVrPanel();
    },
    setAccuracy: (text) => {
      accValEl.textContent = text;
      vrState.accuracy = text;
      syncVrPanel();
    },
    setCameras: (views, activeId, onSelect) => {
      camerasEl.innerHTML = '';
      views.forEach((v) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `tp3d-cam-btn ${v.id === activeId ? 'active' : ''}`;
        b.textContent = v.label;
        b.addEventListener('click', () => {
          sfx.click();
          onSelect?.(v.id);
        });
        camerasEl.appendChild(b);
      });
    },
    setTools: (tools, activeId, onSelect) => {
      toolsEl.innerHTML = '';
      tools.forEach((t) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `tp3d-tool-btn ${t.id === activeId ? 'active' : ''}`;
        b.innerHTML = `<span class="tp3d-t-ico">${t.icon}</span><span class="tp3d-t-lbl">${t.label}</span>`;
        if (t.disabled) b.disabled = true;
        b.addEventListener('click', () => {
          sfx.click();
          onSelect?.(t.id);
        });
        toolsEl.appendChild(b);
      });
      vrState.tools = tools;
      vrState.activeToolId = activeId;
      vrState.onSelectTool = (id) => {
        sfx.click();
        onSelect?.(id);
      };
      syncVrPanel();
    },
    setActions: (actions) => {
      actionsEl.innerHTML = '';
      actions.forEach((a) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `tp3d-act-btn ${a.primary ? 'primary' : ''} ${a.danger ? 'danger' : ''}`;
        b.textContent = a.label;
        b.disabled = Boolean(a.disabled);
        b.addEventListener('click', () => {
          sfx.click();
          a.onClick?.();
        });
        actionsEl.appendChild(b);
      });
      vrState.actions = actions.map((a) => ({
        ...a,
        onClick: () => {
          sfx.click();
          a.onClick?.();
          syncVrPanel();
        }
      }));
      syncVrPanel();
    },
    setSideDrawer: (html) => {
      if (!html) {
        sideDrawerEl.classList.add('hidden');
        sideDrawerEl.innerHTML = '';
        vrState.drawerControls = [];
        syncVrPanel();
        return null;
      }
      sideDrawerEl.innerHTML = html;
      sideDrawerEl.classList.remove('hidden');
      extractDrawerControls();
      syncVrPanel();
      return sideDrawerEl;
    },
    showToast: (msg, kind = 'info') => {
      if (toastTimer) clearTimeout(toastTimer);
      toastEl.textContent = msg;
      toastEl.className = `tp3d-toast ${kind}`;
      vrState.toastText = msg;
      syncVrPanel();
      toastTimer = setTimeout(() => {
        toastEl.classList.add('hidden');
        vrState.toastText = '';
        syncVrPanel();
      }, 2600);
    },
    projectOntoPlane,
    getWorkPlanePoint: (clientX, clientY, yLevel = 0.02) => {
      const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -yLevel);
      if (activeVrRay) {
        const out = new THREE.Vector3();
        return activeVrRay.ray.intersectPlane(pl, out);
      }
      return projectOntoPlane(clientX, clientY, pl);
    },
    destroy: () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (toastTimer) clearTimeout(toastTimer);
      if (vrActive) {
        vrBridge?.detachWorkbench?.();
      } else {
        canvas.removeEventListener('pointerdown', handlePointerDown);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
        canvas.removeEventListener('wheel', handleWheel);
        window.removeEventListener('resize', handleResize);
        resizeObserver?.disconnect();
      }
      for (const pt of particles) pt.mat.dispose();
      for (const pr of pulseRings) pr.mat.dispose();
      envTarget?.dispose?.();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) {
            if (m.map) m.map.dispose();
            m.dispose();
          }
        }
      });
      for (const d of disposables) {
        d?.dispose?.();
      }
      if (!vrActive) {
        renderer?.dispose?.();
      }
      root.remove();
    }
  };

  if (vrActive && vrBridge?.attachWorkbench) {
    vrBridge.attachWorkbench({
      scene,
      interactiveMeshes,
      vrStep,
      emitPointerRay: (vrRaycaster, workPt) => {
        activeVrRay = vrRaycaster;
        for (const fn of onPointerMoveCallbackFns) {
          fn({ clientX: 0, clientY: 0 }, workPt, vrRaycaster, { x: 0, y: 0 });
        }
      },
      getSnapshot: () => ({
        ...(vrBridge.getModalSnapshot?.() || {}),
        ...vrState
      }),
      requestExit: () => vrBridge.requestExit?.()
    });
  }

  return apiObj;
}
