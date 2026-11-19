import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import * as THREE from 'three';
import {
  SceneManager,
  QUALITY_PRESETS,
  computeAdaptivePixelRatio,
  computeZoneVisibility,
  pickLabInteractable,
  resolveEffectiveQuality
} from '../src/world/SceneManager.js';
import { buildLabWorld } from '../src/world/LabBuilder.js';
import { createCombatPocketRooms } from '../src/world/CombatArena3D.js';
import { createSurvivalPocketRooms } from '../src/world/SurvivalArena3D.js';
import { buildStudentAvatarMesh } from '../src/world/AvatarBuilder.js';
import { createHorrorTeacher } from '../src/world/NpcTeacher.js';
import { buildPetMesh, getSharedPetAssetStats } from '../src/world/PetBuilder.js';
import { PlayerController } from '../src/world/PlayerController.js';
import { pointCollidesWithColliders } from '../src/world/SurvivalEngine.js';
import { CielOsDesktop } from '../src/minigames/CielOsDesktop.js';
import { ShopModal, ShopPreview3D } from '../src/ui/ShopModal.js';
import { LockerModal, LockerPreview3D } from '../src/ui/LockerModal.js';
import { HudManager } from '../src/ui/HudManager.js';
import { VRManager } from '../src/vr/VRManager.js';
import { createWristHudPanel } from '../src/vr/VRHudPanel.js';
import { GameState } from '../src/core/gameState.js';
import { NetworkClient } from '../src/core/network.js';
import { attachWsHub } from '../server/wsHub.js';
import { GameStore } from '../server/gameStore.js';
import { MapStore } from '../server/store.js';
import { AccountStore } from '../server/accountStore.js';
import os from 'node:os';

function createMockClassList(initial = []) {
  const set = new Set(initial);
  return {
    add: (...cls) => cls.forEach((c) => set.add(c)),
    remove: (...cls) => cls.forEach((c) => set.delete(c)),
    toggle: (c, force) => {
      if (force === undefined) {
        if (set.has(c)) {
          set.delete(c);
          return false;
        }
        set.add(c);
        return true;
      }
      if (force) set.add(c);
      else set.delete(c);
      return Boolean(force);
    },
    contains: (c) => set.has(c)
  };
}

function createMockEl(id = '', initialClasses = []) {
  const listeners = new Map();
  return {
    id,
    classList: createMockClassList(initialClasses),
    style: {
      setProperty(k, v) {
        this[k] = v;
      }
    },
    dataset: {},
    value: '',
    checked: false,
    textContent: '',
    innerHTML: '',
    disabled: false,
    options: [],
    selectedIndex: 0,
    addEventListener(ev, fn) {
      if (!listeners.has(ev)) listeners.set(ev, []);
      listeners.get(ev).push(fn);
    },
    removeEventListener(ev, fn) {
      const list = listeners.get(ev);
      if (!list) return;
      const idx = list.indexOf(fn);
      if (idx >= 0) list.splice(idx, 1);
    },
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    },
    getAttribute() {
      return null;
    },
    getContext() {
      return null;
    }
  };
}

function createMockRenderer() {
  let foveation = null;
  let fbScale = null;
  let pixelRatio = 1;
  let compileCount = 0;
  return {
    autoClear: true,
    toneMapping: 0,
    toneMappingExposure: 1,
    shadowMap: { enabled: true, type: 0, autoUpdate: true },
    info: { render: { calls: 112, triangles: 24500 } },
    capabilities: { getMaxAnisotropy: () => 8 },
    xr: {
      enabled: true,
      isPresenting: false,
      setReferenceSpaceType() {},
      setFoveation(v) {
        foveation = v;
      },
      setFramebufferScaleFactor(v) {
        fbScale = v;
      },
      getController: () => new THREE.Group(),
      getControllerGrip: () => new THREE.Group(),
      getHand: () => new THREE.Group(),
      addEventListener() {},
      removeEventListener() {},
      async setSession() {}
    },
    setClearColor() {},
    setPixelRatio(pr) {
      pixelRatio = pr;
    },
    setSize() {},
    setRenderTarget() {},
    getRenderTarget: () => null,
    setAnimationLoop() {},
    compile() {
      compileCount++;
    },
    render() {},
    getStats: () => ({ foveation, fbScale, pixelRatio, compileCount })
  };
}

test('v4.31 — Culling exclusif par zone (Atelier vs Lobby/Arène Combat vs Survie/Colle)', () => {
  const scene = new THREE.Scene();
  const lab = buildLabWorld(scene, null, { hideSprites: true });
  const combat = createCombatPocketRooms(scene, { lowRes: true });
  const survival = createSurvivalPocketRooms(scene, lab.mapData);

  const applyZone = (mode) => {
    const vis = computeZoneVisibility(mode);
    lab.setVisible(vis.labVisible);
    combat.setZoneVisibility(vis.combatZone);
    survival.setZoneVisibility(vis.survivalZone);
  };

  applyZone('hall');
  assert.equal(lab.worldGroup.visible, true);
  assert.equal(combat.root.visible, false);
  assert.equal(survival.root.visible, false);

  applyZone('combat_waiting');
  assert.equal(lab.worldGroup.visible, false);
  assert.equal(combat.root.visible, true);
  assert.equal(combat.waitingGroup.visible, true);
  assert.equal(combat.arenaStaticGroup.visible, false);
  assert.equal(survival.root.visible, false);

  applyZone('combat_arena');
  assert.equal(lab.worldGroup.visible, false);
  assert.equal(combat.root.visible, true);
  assert.equal(combat.waitingGroup.visible, false);
  assert.equal(combat.arenaStaticGroup.visible, true);
  assert.equal(combat.dynamicGroup.visible, true);
  assert.equal(survival.root.visible, false);

  applyZone('waiting');
  assert.equal(lab.worldGroup.visible, false);
  assert.equal(combat.root.visible, false);
  assert.equal(survival.root.visible, true);
  assert.equal(survival.waitGroup.visible, true);
  assert.equal(survival.detGroup.visible, false);

  applyZone('detention');
  assert.equal(lab.worldGroup.visible, false);
  assert.equal(combat.root.visible, false);
  assert.equal(survival.root.visible, true);
  assert.equal(survival.waitGroup.visible, false);
  assert.equal(survival.detGroup.visible, true);

  lab.dispose();
  combat.dispose();
  survival.dispose();
});

test('v4.31 — Instancing statique, gel matrixAutoUpdate=false, zéro PointLight dynamique parasite & cache Pets', () => {
  const scene = new THREE.Scene();
  const lab = buildLabWorld(scene, null, { hideSprites: true });
  const stats = lab.getRenderStats();
  assert.ok(stats.instancedMeshCount >= 10, `Attendu >= 10 InstancedMesh dans LabBuilder, reçu ${stats.instancedMeshCount}`);
  assert.ok(stats.totalInstances >= 400, `Attendu >= 400 instances regroupées, reçu ${stats.totalInstances}`);
  assert.ok(stats.drawCallEstimate < 500, `Draw calls LabBuilder attendus < 500, reçu ${stats.drawCallEstimate}`);
  assert.ok(lab.solidWallMeshes.length <= 6, `Murs solides fusionnés attendus <= 6, reçu ${lab.solidWallMeshes.length}`);
  for (const wall of lab.solidWallMeshes) {
    assert.equal(wall.matrixAutoUpdate, false);
  }

  const combat = createCombatPocketRooms(scene);
  let combatPointLights = 0;
  let combatInstanced = 0;
  combat.staticGroup.traverse((n) => {
    if (n !== combat.staticGroup) {
      assert.equal(n.matrixAutoUpdate, false);
    }
    if (n.isPointLight) combatPointLights++;
    if (n.isInstancedMesh) combatInstanced++;
  });
  assert.equal(combatPointLights, 0, 'Aucune PointLight coûteuse ne doit subsister dans CombatArena3D');
  assert.ok(combatInstanced >= 5, `Attendu >= 5 InstancedMesh dans CombatArena3D, reçu ${combatInstanced}`);

  const divAv = buildStudentAvatarMesh({ divineSpecialty: 'cyber', creatorAura: true });
  let avatarPointLights = 0;
  divAv.group.traverse((n) => {
    if (n.isPointLight) avatarPointLights++;
  });
  assert.equal(avatarPointLights, 0, 'Aucune PointLight dynamique ne doit être attachée aux avatars');

  const horrorTeacher = createHorrorTeacher(scene, { visible: true });
  let teacherPointLights = 0;
  horrorTeacher.root.traverse((n) => {
    if (n.isPointLight) teacherPointLights++;
  });
  assert.equal(teacherPointLights, 0, 'Aucune PointLight ne doit être attachée au Professeur CIEL Horreur');

  const petA = buildPetMesh('pet_drone_quadri');
  const statsBefore = getSharedPetAssetStats();
  const petB = buildPetMesh('pet_drone_quadri');
  const statsAfter = getSharedPetAssetStats();
  assert.equal(statsAfter.geometries, statsBefore.geometries);
  assert.equal(statsAfter.materials, statsBefore.materials);
  assert.ok(statsAfter.geometries > 0 && statsAfter.materials > 0);
  petA.dispose();
  petB.dispose();
  horrorTeacher.dispose();
  combat.dispose();
  lab.dispose();
});

test('v4.31 — Throttling strict, budget 1 upload/frame & dirty-flag sur CanvasTexture CIEL OS, Arène et Montre VR', () => {
  const os = new CielOsDesktop({ stationId: 'perf-pc-1', renderScale: 0.5, idleThrottleMult: 2.0 });
  assert.equal(os.canvas.width, 512);
  assert.equal(os.canvas.height, 320);
  const startUploads = os.textureUploadCount;
  assert.equal(os.updateIdle(0.5, { focused: false, near: false, inView: false }), false);
  assert.equal(os.textureUploadCount, startUploads);
  assert.equal(os.updateIdle(2.0, { focused: false, near: false, inView: true }), true);
  assert.equal(os.textureUploadCount, startUploads + 1);
  assert.equal(os.updateIdle(4.5, { focused: false, near: false, inView: true }), false);
  assert.equal(os.updateIdle(6.1, { focused: false, near: false, inView: true }), true);
  assert.equal(os.textureUploadCount, startUploads + 2);

  const scene = new THREE.Scene();
  const lab = buildLabWorld(scene, null, { hideSprites: true, lowRes: true });
  lab.setQualityProfile({ textureThrottleMult: 1.5, lowResPc: true });
  const beforeSum = lab.pcStations.reduce((acc, pc) => acc + pc.desktop.textureUploadCount, 0);
  lab.update(5.0, { x: 0, y: 1.6, z: 0 }, false, null);
  const afterSum = lab.pcStations.reduce((acc, pc) => acc + pc.desktop.textureUploadCount, 0);
  assert.ok(afterSum - beforeSum <= 1, `Budget max 1 upload PC idle par frame violé : ${afterSum - beforeSum}`);
  lab.setVisible(false);
  const hiddenBefore = afterSum;
  lab.update(12.0, { x: 0, y: 1.6, z: 0 }, false, null);
  const hiddenAfter = lab.pcStations.reduce((acc, pc) => acc + pc.desktop.textureUploadCount, 0);
  assert.equal(hiddenAfter, hiddenBefore, 'Aucun PC ne doit se rafraîchir quand l’atelier est masqué');
  lab.dispose();

  const watch = createWristHudPanel();
  watch.setForceVisible(true);
  watch.updateState({ coins: 120, zoneLabel: 'Hall U300' });
  watch.updateState({ coins: 120, zoneLabel: 'Hall U300' });
  assert.ok(watch.group.visible);
  watch.dispose();
});

test('v4.31 — Arrêt strict des boucles de prévisualisation 3D Boutique & Casier à la fermeture', () => {
  const prevRaf = globalThis.requestAnimationFrame;
  const prevCancel = globalThis.cancelAnimationFrame;
  let nextId = 1;
  const activeRafs = new Set();
  globalThis.requestAnimationFrame = () => {
    const id = nextId++;
    activeRafs.add(id);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    activeRafs.delete(id);
  };

  try {
    const shopPreview = new ShopPreview3D(null);
    shopPreview.initialized = true;
    shopPreview.renderer = { render() {}, dispose() {} };
    shopPreview.scene = new THREE.Scene();
    shopPreview.camera = new THREE.PerspectiveCamera();
    shopPreview.setActive(true);
    assert.equal(shopPreview.isAnimating(), true);
    assert.equal(activeRafs.size, 1);

    const shopModal = Object.create(ShopModal.prototype);
    shopModal.backdropEl = createMockEl('shop-modal');
    shopModal.preview = shopPreview;
    shopModal.busy = false;
    assert.equal(shopModal.close(), true);
    assert.equal(shopPreview.isAnimating(), false);
    assert.equal(activeRafs.size, 0);

    const lockerPreview = new LockerPreview3D(null);
    lockerPreview.initialized = true;
    lockerPreview.renderer = { render() {}, dispose() {} };
    lockerPreview.scene = new THREE.Scene();
    lockerPreview.camera = new THREE.PerspectiveCamera();
    lockerPreview.setActive(true);
    assert.equal(lockerPreview.isAnimating(), true);
    assert.equal(activeRafs.size, 1);

    const lockerModal = Object.create(LockerModal.prototype);
    lockerModal.backdropEl = createMockEl('skin-modal');
    lockerModal.preview = lockerPreview;
    lockerModal.busy = false;
    assert.equal(lockerModal.close(), true);
    assert.equal(lockerPreview.isAnimating(), false);
    assert.equal(activeRafs.size, 0);
  } finally {
    globalThis.requestAnimationFrame = prevRaf;
    globalThis.cancelAnimationFrame = prevCancel;
  }
});

test('v4.31 — Presets Qualité (Ultra-Fluide/Patate, Auto), Garde-FPS Automatique, Pré-compilation & VR Foveation', async () => {
  assert.ok(QUALITY_PRESETS.potato);
  assert.ok(QUALITY_PRESETS.eco);
  assert.ok(QUALITY_PRESETS.balanced);
  assert.ok(QUALITY_PRESETS.high);
  assert.equal(resolveEffectiveQuality('auto', { isMobile: true }, false), 'balanced');
  assert.equal(resolveEffectiveQuality('auto', { isMobile: false, isTablet: false }, false), 'high');
  assert.equal(resolveEffectiveQuality('auto', { isMobile: false }, true), 'balanced');

  assert.equal(computeAdaptivePixelRatio({ devicePixelRatio: 3, quality: 'potato', isMobile: true }), 0.75);
  assert.equal(computeAdaptivePixelRatio({ devicePixelRatio: 3, quality: 'potato', isMobile: false }), 0.85);
  assert.equal(computeAdaptivePixelRatio({ devicePixelRatio: 3, quality: 'high', isMobile: false, dynamicScale: 0.8 }), 1.2);

  const mockRenderer = createMockRenderer();
  const mgr = new SceneManager(null, {
    renderer: mockRenderer,
    skipEnvironment: true,
    deviceProfile: { isMobile: false, isTablet: false, isVr: false },
    quality: 'high'
  });
  assert.equal(mgr.precompileShaders(), true);
  assert.equal(mgr.shadersPrecompiled, true);
  assert.equal(mockRenderer.getStats().compileCount, 1);

  mgr.setQuality('potato');
  assert.equal(mgr.renderer.shadowMap.enabled, false);
  assert.equal(mgr.sun.castShadow, false);
  assert.equal(mgr.effectiveQuality, 'potato');
  assert.ok(mgr.particleScale <= 0.4);
  assert.ok(mgr.textureThrottleMult >= 2.5);
  assert.equal(mockRenderer.getStats().foveation, 1.0);
  assert.equal(mockRenderer.getStats().fbScale, QUALITY_PRESETS.potato.vrFramebufferScale);

  mgr.setQuality('high');
  assert.equal(mgr.renderer.shadowMap.enabled, true);
  mgr.setAutoFpsGuard(true);
  mgr.fps = 24;
  const steppedDown = mgr._stepAutoFpsGuard(2.5, false);
  assert.equal(steppedDown, true);
  assert.ok(mgr.dynamicResolutionScale < 1.0);
  const metrics = mgr.getPerformanceMetrics();
  assert.equal(metrics.drawCalls, 112);
  assert.equal(metrics.triangles, 24500);
  assert.equal(metrics.foveation, 1.0);

  const vrMgr = new VRManager({
    sceneMgr: mgr,
    scene: mgr.scene,
    camera: mgr.camera,
    renderer: mockRenderer,
    player: { position: new THREE.Vector3(0, 1.65, 0), yaw: 0, setVrMode() {}, setVrPose() {} },
    options: {}
  });
  await vrMgr._activateXrSession({
    requestReferenceSpace: async () => ({}),
    addEventListener() {},
    removeEventListener() {},
    end: async () => {}
  });
  assert.equal(mockRenderer.getStats().foveation, 1.0);
  assert.ok(mockRenderer.getStats().fbScale > 0 && mockRenderer.getStats().fbScale <= 1.0);

  vrMgr.dispose?.();
  mgr.dispose();
});

test('v4.31 — Raycast pré-filtré distanceToSquared, collisions spatiales, zéro DOM thrashing & DOM index.html', () => {
  const farMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  farMesh.position.set(0, 1, -40);
  farMesh.updateMatrixWorld(true);
  const nearMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  nearMesh.position.set(0, 1, -3);
  nearMesh.updateMatrixWorld(true);

  const rc = new THREE.Raycaster(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1));
  const hit = pickLabInteractable(
    rc,
    [
      { id: 'far', position: new THREE.Vector3(0, 0, -40), mesh: farMesh },
      { id: 'near', position: new THREE.Vector3(0, 0, -3), mesh: nearMesh }
    ],
    [],
    7.5
  );
  assert.equal(hit?.item?.id, 'near');

  const colliders = [];
  for (let i = 0; i < 24; i++) {
    colliders.push({ minX: -12 + i * 1.1, maxX: -11.6 + i * 1.1, minZ: 4, maxZ: 5 });
  }
  assert.equal(pointCollidesWithColliders(-11.8, 4.5, colliders, null, 0.3), true);
  assert.equal(pointCollidesWithColliders(0, -8, colliders, null, 0.3), false);

  const cam = new THREE.PerspectiveCamera();
  const pc = new PlayerController(cam, null, colliders);
  assert.equal(pc._collides(-11.8, 4.5), true);
  assert.equal(pc._collides(0, -8), false);

  const hud = Object.create(HudManager.prototype);
  hud._domCache = Object.create(null);
  hud.domWriteCount = 0;
  hud.detentionHudHidden = false;
  hud.interactPromptEl = createMockEl('interact-prompt', ['hidden']);
  hud.interactLabelEl = createMockEl('interact-label');
  hud.combatCrosshairEl = createMockEl('combat-crosshair', ['hidden']);
  hud._combatCrosshairState = {};
  hud.perfMonitorEl = createMockEl('perf-monitor-hud');
  hud.perfMonFpsEl = createMockEl('perf-mon-fps');
  hud.perfMonMsEl = createMockEl('perf-mon-ms');
  hud.perfMonCallsEl = createMockEl('perf-mon-calls');
  hud.perfMonTrisEl = createMockEl('perf-mon-tris');

  hud.setInteractPrompt({ label: '[E] Ouvrir TP' });
  const writesAfterFirst = hud.domWriteCount;
  for (let i = 0; i < 30; i++) {
    hud.setInteractPrompt({ label: '[E] Ouvrir TP' });
  }
  assert.equal(hud.domWriteCount, writesAfterFirst, 'Aucun écriture DOM ne doit avoir lieu quand le prompt est inchangé');

  hud.updateCombatCrosshair({ active: true, weaponId: 'fiber_rifle', mode: 'guns', spreadPx: 8 });
  const chWrites = hud.domWriteCount;
  for (let i = 0; i < 30; i++) {
    hud.updateCombatCrosshair({ active: true, weaponId: 'fiber_rifle', mode: 'guns', spreadPx: 8 });
  }
  assert.equal(hud.domWriteCount, chWrites, 'Aucun écriture DOM ne doit avoir lieu quand le crosshair est inchangé');

  hud.updatePerfMonitor({ fps: 60, frameTimeMs: 16.4, drawCalls: 140, triangles: 32500, resolutionScale: 1 });
  assert.equal(hud.perfMonFpsEl.textContent, '60 FPS');
  assert.equal(hud.perfMonCallsEl.textContent, 'DC: 140');
  assert.equal(hud.perfMonTrisEl.textContent, 'Tri: 32.5k');

  const html = fs.readFileSync(path.resolve('index.html'), 'utf8');
  assert.ok(html.includes('id="set-quality"'));
  assert.ok(html.includes('value="potato"'));
  assert.ok(html.includes('value="auto"'));
  assert.ok(html.includes('id="set-fps-guard"'));
  assert.ok(html.includes('id="set-perf-monitor"'));
  assert.ok(html.includes('id="perf-monitor-hud"'));
});

test('v4.31 — Zéro timer ou socket orphelin à la déconnexion client et fermeture wsHub', async () => {
  const net = new NetworkClient();
  net.heartbeatTimer = setInterval(() => {}, 10000);
  net.moveFlushTimer = setTimeout(() => {}, 10000);
  net.reconnectTimer = setTimeout(() => {}, 10000);
  net.disconnect();
  assert.equal(net.heartbeatTimer, null);
  assert.equal(net.moveFlushTimer, null);
  assert.equal(net.reconnectTimer, null);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ciel-perf-ws-'));
  const server = http.createServer();
  const gameStore = new GameStore(path.join(tmpDir, 'db.json'));
  const mapStore = new MapStore(path.join(tmpDir, 'map.json'));
  const accountStore = new AccountStore(path.join(tmpDir, 'accounts.json'));
  const hub = attachWsHub(server, gameStore, mapStore, accountStore);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  await new Promise((resolve) => {
    hub.close();
    server.close(resolve);
  });
  fs.rmSync(tmpDir, { recursive: true, force: true });
  assert.ok(true);
});
