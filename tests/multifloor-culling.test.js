import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import * as THREE from 'three';
import { WebSocket } from 'ws';
import { attachWsHub } from '../server/wsHub.js';
import { GameStore, MapStore } from '../server/store.js';
import { buildLabWorld } from '../src/world/LabBuilder.js';
import { buildPetMesh } from '../src/world/PetBuilder.js';
import { PlayerController } from '../src/world/PlayerController.js';
import { RemotePlayersManager } from '../src/world/RemotePlayers.js';
import { CULLING_QUALITY_PROFILES, SpatialCullingEngine, SpatialHash } from '../src/world/SpatialCulling.js';
import { VRManager } from '../src/vr/VRManager.js';
import {
  CAMPUS_SIZE_PRESETS,
  DEFAULT_CAMPUS_SIZE,
  DEFAULT_FLOOR_HEIGHT,
  MAX_FLOOR,
  MAX_MAP_SIZE,
  MIN_FLOOR,
  buildWalkableSurfaceData,
  computeEffectiveFloorOpenings,
  computeSlabRectangles,
  computeStairGeometry,
  createCampusMap,
  createDefaultMap,
  duplicateFloorStructure,
  evaluateSurfaceAt,
  getCatalogItem,
  normalizeMapData
} from '../src/world/mapSchema.js';
import {
  MAX_ZOOM_2D,
  MIN_ZOOM_2D,
  isBoxInViewport2D
} from '../src/admin/MapEditor.js';

function makeMockCanvas() {
  return {
    width: 1280,
    height: 720,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    requestPointerLock: () => {}
  };
}

function makeGiantMultiFloorSchoolMap() {
  const fh = DEFAULT_FLOOR_HEIGHT;
  const walls = [];
  for (let i = 0; i < 6; i++) {
    const x = -90 + i * 32;
    walls.push({
      id: `ext-n-${i}`,
      kind: 'exterior',
      floor: 0,
      x1: x,
      z1: -90,
      x2: x + 30,
      z2: -90,
      thickness: 0.28,
      height: fh,
      color: '#475569'
    });
    walls.push({
      id: `bay-s-${i}`,
      kind: 'window_bay',
      floor: 0,
      x1: x,
      z1: 90,
      x2: x + 30,
      z2: 90,
      thickness: 0.22,
      height: fh,
      color: '#38bdf8'
    });
  }
  for (let k = 0; k < 220; k++) {
    const px = -108 + (k % 20) * 11;
    const pz = -108 + Math.floor(k / 20) * 18;
    walls.push({
      id: `grid-w-${k}`,
      kind: 'solid',
      floor: k % 2 === 0 ? 0 : 1,
      x1: px,
      z1: pz,
      x2: px + 4,
      z2: pz,
      thickness: 0.18,
      height: fh,
      color: '#1e293b'
    });
  }
  walls.push({
    id: 'occ-blocker-w',
    kind: 'solid',
    floor: 0,
    x1: -22,
    z1: -14,
    x2: 22,
    z2: -14,
    thickness: 0.24,
    height: fh,
    color: '#1e293b'
  });
  walls.push({
    id: 'mezz-rail',
    kind: 'railing',
    floor: 1,
    x1: -6,
    z1: 18,
    x2: 6,
    z2: 18,
    thickness: 0.12,
    height: 1.05,
    color: '#94a3b8'
  });

  const objects = [
    {
      id: 'spawn-multi',
      type: 'spawn_point',
      floor: 0,
      x: 0,
      z: 0,
      rotation: 0,
      w: 1.4,
      d: 1.4,
      color: '#22d3ee',
      label: 'Spawn'
    },
    {
      id: 'stair-straight-main',
      type: 'stair_straight',
      floor: 0,
      targetFloor: 1,
      stairStyle: 'straight',
      x: 0,
      z: 10,
      rotation: 0,
      w: 2.4,
      d: 5.2,
      steps: 16,
      hasRailings: true,
      autoOpening: true,
      color: '#f59e0b',
      label: 'Escalier Droit RDC -> E1'
    },
    {
      id: 'stair-l-wing',
      type: 'stair_l',
      floor: 0,
      targetFloor: 1,
      stairStyle: 'l_shape',
      x: 24,
      z: 12,
      rotation: 90,
      w: 3.6,
      d: 4.4,
      steps: 16,
      turnDir: 1,
      hasRailings: true,
      autoOpening: true,
      color: '#f59e0b',
      label: 'Escalier L'
    },
    {
      id: 'stair-u-tower',
      type: 'stair_u',
      floor: 1,
      targetFloor: 2,
      stairStyle: 'u_shape',
      x: -28,
      z: 16,
      rotation: 180,
      w: 3.8,
      d: 4.8,
      steps: 18,
      turnDir: 1,
      hasRailings: true,
      autoOpening: true,
      color: '#f59e0b',
      label: 'Escalier U'
    },
    {
      id: 'stair-basement',
      type: 'stair_straight',
      floor: 0,
      targetFloor: -1,
      stairStyle: 'straight',
      x: -24,
      z: -24,
      rotation: 0,
      w: 2.4,
      d: 5.2,
      steps: 16,
      hasRailings: true,
      autoOpening: true,
      color: '#f59e0b',
      label: 'Escalier Sous-sol'
    },
    {
      id: 'open-mezz-drop',
      type: 'slab_opening',
      floor: 1,
      x: 40,
      z: 40,
      rotation: 0,
      w: 4,
      d: 4,
      color: '#f59e0b',
      label: 'Trémie Mezzanine'
    },
    {
      id: 'pc-front-0',
      type: 'pc_ciel_os',
      floor: 0,
      x: 2,
      z: -6,
      rotation: 0,
      w: 1.5,
      d: 0.85,
      color: '#38bdf8',
      label: 'PC Hall RDC'
    },
    {
      id: 'pc-behind-cull',
      type: 'pc_ciel_os',
      floor: 0,
      x: 0,
      z: 42,
      rotation: 0,
      w: 1.5,
      d: 0.85,
      color: '#38bdf8',
      label: 'PC Hors Champ'
    },
    {
      id: 'pc-upper-f3',
      type: 'pc_ciel_os',
      floor: 3,
      x: 0,
      z: -24,
      rotation: 0,
      w: 1.5,
      d: 0.85,
      color: '#38bdf8',
      label: 'PC Etage 3'
    },
    {
      id: 'pillar-hall',
      type: 'pillar_column',
      floor: 0,
      x: -8,
      z: -6,
      rotation: 0,
      w: 0.55,
      d: 0.55,
      color: '#64748b',
      label: 'Poteau'
    }
  ];

  const zones = [
    {
      id: 'Z-HALL',
      code: 'HALL',
      shortName: 'Hall Accueil',
      fullLabel: 'Hall Accueil RDC',
      badgeText: 'Hall',
      color: '#38bdf8',
      floor: 0,
      x: 0,
      z: 0,
      w: 16,
      d: 16
    },
    {
      id: 'Z-COUR',
      code: 'COUR',
      shortName: 'Cour Centrale',
      fullLabel: 'Cour Centrale Lycée',
      badgeText: 'Cour',
      color: '#10b981',
      floor: 0,
      outdoor: true,
      x: -60,
      z: -60,
      w: 24,
      d: 24
    }
  ];

  return normalizeMapData({
    version: 4,
    name: 'Lycée Complet Multi-Étages 240x240',
    floorHeight: fh,
    bounds: {
      minX: -120,
      maxX: 120,
      minZ: -120,
      maxZ: 120,
      width: 240,
      depth: 240,
      height: fh
    },
    floors: [
      { index: -1, name: 'Sous-sol (-1)', hasFullSlab: true },
      { index: 0, name: 'RDC (0)', hasFullSlab: true },
      { index: 1, name: 'Étage 1', hasFullSlab: true },
      { index: 2, name: 'Étage 2', hasFullSlab: true },
      { index: 3, name: 'Étage 3', hasFullSlab: true }
    ],
    walls,
    objects,
    zones,
    openings: [],
    spawn: { x: 0, y: 1.68, z: 0, yaw: 0, floor: 0 }
  });
}

test('Rétrocompatibilité totale avec la map U300 sans propriété floor et protection de server/data', () => {
  const gitDirtyData = execSync('git status --porcelain server/data/', { encoding: 'utf8' });
  assert.equal(gitDirtyData.includes('server/data/map.json'), false);
  assert.equal(gitDirtyData.includes('server/data/db.json'), false);

  const defaultMap = createDefaultMap();
  const normalized = normalizeMapData(defaultMap);
  assert.equal(normalized.bounds.height, 4.6);
  assert.equal(normalized.floors.length, 1);
  assert.equal(normalized.floors[0].index, 0);
  assert.equal(normalized.spawn.floor ?? 0, 0);
  for (const w of normalized.walls) {
    assert.equal(w.floor, 0);
  }
  for (const o of normalized.objects) {
    assert.equal(o.floor, 0);
  }

  const scene = new THREE.Scene();
  const lab = buildLabWorld(scene, defaultMap, { hideSprites: true });
  try {
    assert.ok(lab.worldGroup.children.length >= 1);
    assert.ok(lab.walkableSurfaces);
    assert.equal(lab.walkableSurfaces.minSurfaceY, 0);
    const s = evaluateSurfaceAt(lab.walkableSurfaces, 0, 0, 0);
    assert.equal(s.found, true);
    assert.equal(s.y, 0);
    assert.equal(s.floor, 0);
  } finally {
    lab.dispose();
  }
});

test('Map géante 240x240 multi-étages, trémies automatiques N+1 et duplication de structure', () => {
  const map = makeGiantMultiFloorSchoolMap();
  assert.equal(map.bounds.width, 240);
  assert.equal(map.bounds.depth, 240);
  assert.equal(map.floors.length, 5);

  const openings = computeEffectiveFloorOpenings(map);
  const f1Openings = openings.filter((op) => op.floor === 1 && op.autoFromStairId);
  const f2Openings = openings.filter((op) => op.floor === 2 && op.autoFromStairId);
  assert.ok(f1Openings.length >= 2);
  assert.ok(f2Openings.length >= 1);

  const slabRectsF1 = computeSlabRectangles(map.bounds, f1Openings);
  assert.ok(slabRectsF1.length >= 4);
  for (const r of slabRectsF1) {
    const insideOpening = f1Openings.some(
      (op) => r.minX >= op.minX + 0.05 && r.maxX <= op.maxX - 0.05 && r.minZ >= op.minZ + 0.05 && r.maxZ <= op.maxZ - 0.05
    );
    assert.equal(insideOpening, false);
  }

  const duplicated = duplicateFloorStructure(map, 0, 2);
  const f2Walls = duplicated.walls.filter((w) => w.floor === 2);
  assert.ok(f2Walls.length >= 12);

  const scene = new THREE.Scene();
  const lab = buildLabWorld(scene, map, { hideSprites: true });
  try {
    const stats = lab.getCullingStats();
    assert.ok(stats.totalChunks >= 10);
    const renderStats = lab.getRenderStats();
    assert.ok(renderStats.instancedMeshCount >= 5);
  } finally {
    lab.dispose();
  }
});

test('Physique fluide des escaliers 3D (droit, L, U), chute par gravité et téléportation VR multi-étages', () => {
  const map = makeGiantMultiFloorSchoolMap();
  const scene = new THREE.Scene();
  const lab = buildLabWorld(scene, map, { hideSprites: true });
  const cam = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 220);
  const player = new PlayerController(cam, makeMockCanvas(), lab.colliders);
  player.setBounds(map.bounds);
  player.setWalkableSurfaces(lab.walkableSurfaces);
  player.setSpatialHash(lab.spatialHash);

  const fakeSceneMgr = { scene, camera: cam, renderer: null };
  const vr = new VRManager(fakeSceneMgr, player, {});

  try {
    player.teleportTo({ x: 0, z: 7.0, floor: 0 });
    assert.equal(player.getCurrentFloor(), 0);
    assert.equal(Math.round(player.getFeetY() * 100), 0);

    let prevY = player.getFeetY();
    for (let i = 0; i < 24; i++) {
      player.moveHorizontally(0, 0.25, player.position.x, player.position.z, 0.04);
      const fy = player.getFeetY();
      assert.ok(fy >= prevY - 0.001);
      prevY = fy;
    }
    assert.ok(Math.abs(player.getFeetY() - DEFAULT_FLOOR_HEIGHT) < 0.05);
    assert.equal(player.getCurrentFloor(), 1);

    for (let i = 0; i < 24; i++) {
      player.moveHorizontally(0, -0.25, player.position.x, player.position.z, 0.04);
    }
    assert.ok(Math.abs(player.getFeetY()) < 0.05);
    assert.equal(player.getCurrentFloor(), 0);

    const stairL = map.objects.find((o) => o.id === 'stair-l-wing');
    const geomL = computeStairGeometry(stairL, DEFAULT_FLOOR_HEIGHT);
    assert.equal(geomL.landings.length, 1);
    const lLandingSurf = evaluateSurfaceAt(
      lab.walkableSurfaces,
      geomL.x + geomL.landings[0].lx * geomL.cos + geomL.landings[0].lz * geomL.sin,
      geomL.z - geomL.landings[0].lx * geomL.sin + geomL.landings[0].lz * geomL.cos,
      DEFAULT_FLOOR_HEIGHT * 0.5
    );
    assert.equal(lLandingSurf.found, true);
    assert.ok(Math.abs(lLandingSurf.y - DEFAULT_FLOOR_HEIGHT * 0.5) < 0.1);

    const stairU = map.objects.find((o) => o.id === 'stair-u-tower');
    const geomU = computeStairGeometry(stairU, DEFAULT_FLOOR_HEIGHT);
    assert.equal(geomU.landings.length, 1);
    assert.ok(geomU.steps3d.length >= 16);

    player.teleportTo({ x: -24, z: -27.2, floor: 0 });
    assert.equal(player.getCurrentFloor(), 0);
    for (let i = 0; i < 26; i++) {
      player.moveHorizontally(0, 0.25, player.position.x, player.position.z, 0.04);
    }
    assert.ok(Math.abs(player.getFeetY() - -DEFAULT_FLOOR_HEIGHT) < 0.05);
    assert.equal(player.getCurrentFloor(), -1);

    const stairFallSurf = evaluateSurfaceAt(lab.walkableSurfaces, 0, 10, DEFAULT_FLOOR_HEIGHT);
    assert.equal(stairFallSurf.found, true);
    assert.equal(stairFallSurf.onRamp, true);
    assert.ok(Math.abs(stairFallSurf.y - DEFAULT_FLOOR_HEIGHT * 0.5) < 0.15);

    player.teleportTo({ x: 37.0, z: 40, floor: 1 });
    assert.equal(player.getCurrentFloor(), 1);
    player.position.set(40, DEFAULT_FLOOR_HEIGHT + player.eyeHeight, 40);
    player.surfaceY = DEFAULT_FLOOR_HEIGHT;
    player.isGrounded = true;
    player._updateVerticalPhysics(0.02);
    assert.equal(player.isGrounded, false);
    for (let f = 0; f < 40 && !player.isGrounded; f++) {
      player._updateVerticalPhysics(0.05);
    }
    assert.equal(player.isGrounded, true);
    assert.ok(player.getFeetY() < 0.05);
    assert.equal(player.getCurrentFloor(), 0);

    player.teleportTo({ x: 0, z: 7.0, floor: 0 });
    vr.active = true;
    vr.simMode = true;
    vr._mountVrRigForWorld(true);
    for (let i = 0; i < 24; i++) {
      const step = player.moveHorizontally(0, 0.25, player.position.x, player.position.z, 0.04);
      vr.vrRig.position.x += step.actualDx;
      vr.vrRig.position.z += step.actualDz;
      vr._stabilizeFloor(0.04);
    }
    assert.ok(Math.abs(vr.vrRig.position.y - DEFAULT_FLOOR_HEIGHT) < 0.25);

    player.position.set(40, DEFAULT_FLOOR_HEIGHT + player.eyeHeight, 40);
    player.surfaceY = DEFAULT_FLOOR_HEIGHT;
    player.isGrounded = false;
    player.velocityY = -2;
    const prevFallY = player.position.y;
    vr._stabilizeFloor(0.016);
    assert.equal(player.position.y, prevFallY);

    const tpHit = vr.computeVrTeleportTarget(
      { x: 0, y: DEFAULT_FLOOR_HEIGHT + 1.4, z: 22 },
      { x: 0, y: -0.25, z: -1 },
      14
    );
    assert.equal(tpHit.valid, true);
    assert.equal(tpHit.floor, 1);
    assert.ok(Math.abs(tpHit.y - DEFAULT_FLOOR_HEIGHT) < 0.1);
  } finally {
    vr.dispose();
    lab.dispose();
  }
});

test('SpatialCullingEngine : frustum culling strict, occlusion murs opaques, étages éloignés, LOD, pause CanvasTexture & SpatialHash O(1)', () => {
  const map = makeGiantMultiFloorSchoolMap();
  const scene = new THREE.Scene();
  const lab = buildLabWorld(scene, map, { hideSprites: true });

  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 220);
  cam.position.set(0, 1.68, 0);
  cam.lookAt(0, 1.68, -20);
  cam.updateMatrixWorld(true);

  try {
    const stats = lab.updateCulling(cam, { x: 0, y: 0, z: 0 }, { currentFloor: 0, quality: 'high' });
    assert.ok(stats.totalChunks >= 10);
    assert.ok(stats.visibleChunks < stats.totalChunks);
    assert.ok(stats.culledFrustum > 0);
    assert.ok(stats.culledFloor > 0);
    assert.ok(stats.culledOcclusion > 0);

    const engine = lab.spatialCulling;
    const frontChunk = engine.getOrCreateChunk(2, -6, 0);
    const behindChunk = engine.getOrCreateChunk(0, 42, 0);
    const farFloorChunk = engine.getOrCreateChunk(0, -24, 3);
    const occChunk = engine.getOrCreateChunk(0, -32, 0);

    assert.equal(frontChunk.visible, true);
    assert.equal(behindChunk.visible, false);
    assert.equal(behindChunk.cullReason, 'frustum');
    assert.equal(farFloorChunk.visible, false);
    assert.equal(farFloorChunk.cullReason, 'floor');
    assert.equal(occChunk.visible, false);
    assert.equal(occChunk.cullReason, 'occlusion');

    const culledPc = lab.pcStations.find((pc) => pc.id === 'pc-behind-cull');
    assert.ok(culledPc);
    const beforeDraws = culledPc.desktop.idleDrawCount || 0;
    lab.update(6.0, { x: 0, y: 1.68, z: 0 }, false, null);
    assert.equal(culledPc.desktop.idleDrawCount || 0, beforeDraws);
    assert.equal(culledPc.desktop.sleepMode, true);

    const potatoStats = lab.updateCulling(
      cam,
      { x: 0, y: 0, z: 0 },
      { currentFloor: 0, quality: 'potato', detailDist: CULLING_QUALITY_PROFILES.potato.detailDist }
    );
    assert.ok(potatoStats.visibleChunks <= stats.visibleChunks);

    const localCols = lab.spatialHash.queryColliders(0, -6, 1.2, 0);
    assert.ok(lab.colliders.length >= 200);
    assert.ok(localCols.length < 15);

    const localOccs = lab.getNearbyOccludersAt(0, -6, 6.0, 0);
    assert.ok(lab.solidWallMeshes.length >= 30);
    assert.ok(localOccs.length < 12);
  } finally {
    lab.dispose();
  }
});

test('Synchronisation WebSocket verticale (y & floor) entre étages et fermeture sans fuite', async () => {
  const tmpDir = fs.mkdtempSync(path.join('/tmp', 'atelier-multifloor-ws-'));
  const store = new GameStore(path.join(tmpDir, 'db.json'));
  const mapStore = new MapStore(path.join(tmpDir, 'map.json'));
  const server = http.createServer((_req, res) => {
    res.writeHead(200);
    res.end('ok');
  });
  const wsHub = attachWsHub(server, store, mapStore);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  let wsA;
  let wsB;
  try {
    const connectClient = (name) =>
      new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
        ws.on('error', reject);
        ws.on('open', () => {
          ws.send(JSON.stringify({ type: 'join', name, room: 'plateau-u300', x: 0, y: 0, z: 0, yaw: 0, floor: 0 }));
        });
        ws.on('message', (buf) => {
          const msg = JSON.parse(buf.toString('utf8'));
          if (msg.type === 'welcome') resolve(ws);
        });
      });

    wsA = await connectClient('EleveHaut');
    wsB = await connectClient('EleveBas');

    const movedPromise = new Promise((resolve) => {
      wsB.on('message', (buf) => {
        const msg = JSON.parse(buf.toString('utf8'));
        if (msg.type === 'player_moved' && msg.floor === 2) {
          resolve(msg);
        }
      });
    });

    wsA.send(JSON.stringify({ type: 'move', x: 14, y: 7.6, z: -22, yaw: 1.2, floor: 2 }));
    const received = await movedPromise;
    assert.equal(received.y, 7.6);
    assert.equal(received.floor, 2);

    const baseMovedPromise = new Promise((resolve) => {
      wsB.on('message', (buf) => {
        const msg = JSON.parse(buf.toString('utf8'));
        if (msg.type === 'player_moved' && msg.floor === -1) {
          resolve(msg);
        }
      });
    });
    wsA.send(JSON.stringify({ type: 'move', x: 4, y: -3.8, z: -4, yaw: 0, floor: -1 }));
    const basementMsg = await baseMovedPromise;
    assert.equal(basementMsg.y, -3.8);
    assert.equal(basementMsg.floor, -1);

    const petScene = new THREE.Scene();
    const pet = buildPetMesh('pet_drone_quadri');
    petScene.add(pet.group);
    pet.snapToOwner({ x: 0, y: 0, z: 0 }, 0);
    for (let s = 0; s < 30; s++) {
      pet.update(0.05, s * 0.05, { x: 0, y: 3.8, z: 0 }, 0);
    }
    assert.ok(Math.abs(pet.group.position.y - 3.8) < 0.05);

    const rp = new RemotePlayersManager(petScene);
    rp.upsertPeer({
      id: 'peer-vert',
      name: 'EleveVertical',
      x: 2,
      y: 0,
      z: 2,
      yaw: 0,
      floor: 0,
      skin: { equippedPet: 'pet_drone_quadri' }
    });
    rp.movePeer('peer-vert', 2, 7.6, 2, 0.4, undefined, 2);
    for (let s = 0; s < 30; s++) {
      rp.update(0.05, s * 0.05);
    }
    const peerObj = rp.peers.get('peer-vert');
    assert.equal(peerObj.floor, 2);
    assert.ok(Math.abs(peerObj.group.position.y - 7.6) < 0.15);
    assert.ok(Math.abs(peerObj.petMesh.group.position.y - 7.6) < 0.25);
    rp.clearAll();
    pet.dispose();
  } finally {
    wsA?.close();
    wsB?.close();
    wsHub.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Interface HUD Mini Moniteur & Éditeur exposent les indicateurs de chunks, étages, fantôme et mini-plan', () => {
  const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');
  assert.ok(indexHtml.includes('id="perf-mon-chunks"'));
  assert.ok(indexHtml.includes('id="perf-mon-floor"'));

  const editorSrc = fs.readFileSync(path.resolve('src/admin/MapEditor.js'), 'utf8');
  assert.ok(editorSrc.includes('me-floor-bar'));
  assert.ok(editorSrc.includes('me-btn-onion'));
  assert.ok(editorSrc.includes('me-btn-dup-floor'));
  assert.ok(editorSrc.includes('me-minimap-canvas'));
  assert.ok(editorSrc.includes('me-bookmarks-bar'));
  assert.ok(editorSrc.includes('me-size-presets'));
  assert.ok(editorSrc.includes('me-tool-room'));
  assert.ok(editorSrc.includes('MAX_MAP_SIZE'));
});

function makeImmenseCampusMap(size = 2000) {
  const fh = DEFAULT_FLOOR_HEIGHT;
  const half = size * 0.5;
  return normalizeMapData({
    version: 2,
    name: `Campus Lycée CIEL ${size}x${size}`,
    floorHeight: fh,
    bounds: {
      minX: -half,
      maxX: half,
      minZ: -half,
      maxZ: half,
      width: size,
      depth: size,
      height: fh
    },
    floors: [
      { index: -2, label: 'Sous-sol (-2)', hasFullSlab: true },
      { index: 0, label: 'RDC (0)', hasFullSlab: true, hasCeiling: false },
      { index: 3, label: 'Étage 3', hasFullSlab: true },
      { index: 8, label: 'Étage 8', hasFullSlab: true }
    ],
    bookmarks: [
      { id: 'bm-a', label: 'Bâtiment Nord-Est', x: 450, z: -420, floor: 3, zoom: 18 },
      { id: 'bm-b', label: 'Gymnase Sud-Ouest', x: -480, z: 460, floor: 0, zoom: 14 }
    ],
    zones: [
      {
        id: 'z-bat-a',
        code: 'BATA',
        shortName: 'Bâtiment A',
        floor: 3,
        x: 450,
        z: -420,
        w: 18,
        d: 14,
        color: '#38bdf8'
      },
      {
        id: 'z-bat-b',
        code: 'GYM',
        shortName: 'Gymnase',
        floor: 0,
        x: -480,
        z: 460,
        w: 20,
        d: 14,
        color: '#10b981'
      },
      {
        id: 'z-parking',
        code: 'PARK',
        shortName: 'Parking Nord',
        floor: 0,
        outdoor: true,
        surfaceKind: 'asphalt',
        x: 420,
        z: -460,
        w: 24,
        d: 16,
        color: '#334155'
      }
    ],
    walls: [
      { id: 'wa-n', kind: 'exterior', floor: 3, x1: 441, z1: -427, x2: 459, z2: -427, thickness: 0.3, height: fh },
      { id: 'wa-s', kind: 'exterior', floor: 3, x1: 441, z1: -413, x2: 459, z2: -413, thickness: 0.3, height: fh },
      { id: 'wa-w', kind: 'exterior', floor: 3, x1: 441, z1: -427, x2: 441, z2: -413, thickness: 0.3, height: fh },
      { id: 'wa-e', kind: 'exterior', floor: 3, x1: 459, z1: -427, x2: 459, z2: -413, thickness: 0.3, height: fh },
      { id: 'wb-n', kind: 'exterior', floor: 0, x1: -490, z1: 453, x2: -470, z2: 453, thickness: 0.3, height: fh },
      { id: 'wb-s', kind: 'exterior', floor: 0, x1: -490, z1: 467, x2: -470, z2: 467, thickness: 0.3, height: fh },
      { id: 'wb-w', kind: 'exterior', floor: 0, x1: -490, z1: 453, x2: -490, z2: 467, thickness: 0.3, height: fh },
      { id: 'wb-e', kind: 'exterior', floor: 0, x1: -470, z1: 453, x2: -470, z2: 467, thickness: 0.3, height: fh }
    ],
    objects: [
      { id: 'sp-campus', type: 'spawn_point', floor: 0, x: 0, z: 0, rotation: 0, w: 1, d: 1, color: '#10b981', label: 'Spawn' },
      { id: 'pc-bat-a', type: 'pc_ciel_os', floor: 3, x: 450, z: -420, rotation: 0, w: 1.5, d: 0.85, color: '#38bdf8', label: 'PC Bat A' },
      { id: 'pc-bat-b', type: 'pc_ciel_os', floor: 0, x: -480, z: 460, rotation: 0, w: 1.5, d: 0.85, color: '#10b981', label: 'PC Gymnase' }
    ],
    spawn: { x: 0, y: 1.68, z: 0, yaw: 0, floor: 0 }
  });
}

test('v4.33 — Campus 1000m×1000m et 2000m×2000m (-2..+8 étages), persistance MapStore, repères et pinceaux extérieurs', () => {
  assert.equal(DEFAULT_CAMPUS_SIZE, 1000);
  assert.equal(MAX_MAP_SIZE, 2000);
  assert.equal(MIN_FLOOR, -2);
  assert.equal(MAX_FLOOR, 8);
  assert.deepEqual(CAMPUS_SIZE_PRESETS, [250, 500, 1000, 2000]);

  assert.ok(getCatalogItem('room_builder')?.isRoomBuilder);
  assert.equal(getCatalogItem('exterior_asphalt')?.surfaceKind, 'asphalt');
  assert.equal(getCatalogItem('exterior_concrete')?.surfaceKind, 'concrete');
  assert.equal(getCatalogItem('exterior_grass')?.surfaceKind, 'grass');
  assert.equal(getCatalogItem('exterior_path')?.surfaceKind, 'path');
  assert.equal(getCatalogItem('exterior_sport')?.surfaceKind, 'sport');

  const campus1000 = createCampusMap(1000);
  assert.equal(campus1000.bounds.minX, -500);
  assert.equal(campus1000.bounds.maxX, 500);
  assert.equal(campus1000.bounds.minZ, -500);
  assert.equal(campus1000.bounds.maxZ, 500);

  const map1000 = makeImmenseCampusMap(1000);
  assert.equal(map1000.bounds.width, 1000);
  assert.equal(map1000.bounds.depth, 1000);
  const pcA1000 = map1000.objects.find((o) => o.id === 'pc-bat-a');
  const pcB1000 = map1000.objects.find((o) => o.id === 'pc-bat-b');
  assert.equal(pcA1000.x, 450);
  assert.equal(pcA1000.z, -420);
  assert.equal(pcA1000.floor, 3);
  assert.equal(pcB1000.x, -480);
  assert.equal(pcB1000.z, 460);
  assert.equal(pcB1000.floor, 0);

  const map2000 = makeImmenseCampusMap(2000);
  assert.equal(map2000.bounds.width, 2000);
  assert.equal(map2000.bounds.depth, 2000);
  assert.equal(map2000.bounds.minX, -1000);
  assert.equal(map2000.bounds.maxX, 1000);
  assert.equal(map2000.bookmarks.length, 2);
  assert.ok(map2000.floors.some((f) => f.index === -2));
  assert.ok(map2000.floors.some((f) => f.index === 8));

  const tmpDir = fs.mkdtempSync(path.join('/tmp', 'atelier-campus-2000-'));
  try {
    const mapFile = path.join(tmpDir, 'map.json');
    const store1 = new MapStore(mapFile);
    store1.saveMap(map2000);
    const store2 = new MapStore(mapFile);
    const reloaded = store2.getMap();
    assert.equal(reloaded.bounds.width, 2000);
    assert.equal(reloaded.bounds.depth, 2000);
    const reloadedPcA = reloaded.objects.find((o) => o.id === 'pc-bat-a');
    assert.equal(reloadedPcA.x, 450);
    assert.equal(reloadedPcA.z, -420);
    assert.equal(reloadedPcA.floor, 3);
    const reloadedPark = reloaded.zones.find((z) => z.id === 'z-parking');
    assert.equal(reloadedPark.surfaceKind, 'asphalt');
    assert.equal(reloaded.bookmarks.length, 2);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('v4.33 — Sparse Chunks sur map 2000m×2000m : zéro chunk vide, Frustum & Distance Culling + pause CanvasTexture', () => {
  const map2000 = makeImmenseCampusMap(2000);
  const scene = new THREE.Scene();
  const lab = buildLabWorld(scene, map2000, { hideSprites: true });
  try {
    const engine = lab.spatialCulling;
    assert.equal(engine.isSparse, true);
    assert.ok(engine.chunks.length > 0 && engine.chunks.length < 40, `Trop de chunks créés sur map sparse 2000m : ${engine.chunks.length}`);
    assert.equal(engine.hasChunk(10, 10, 0), false);
    assert.equal(engine.hasChunk(-20, -20, 0), false);
    assert.equal(engine.hasChunk(50, 50, 0), false);
    assert.ok(engine.getChunkAt(450, -420, 3));
    assert.ok(engine.getChunkAt(-480, 460, 0));

    const cam = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 1200);
    cam.position.set(450, 3 * DEFAULT_FLOOR_HEIGHT + 1.68, -415);
    cam.lookAt(450, 3 * DEFAULT_FLOOR_HEIGHT + 1.4, -425);
    cam.updateMatrixWorld(true);

    const stats = lab.updateCulling(cam, { x: 450, y: 3 * DEFAULT_FLOOR_HEIGHT, z: -415 }, { currentFloor: 3, quality: 'high' });
    assert.equal(stats.sparseChunks, engine.chunksMap.size);
    const chunkA = engine.getChunkAt(450, -420, 3);
    const chunkB = engine.getChunkAt(-480, 460, 0);
    assert.equal(chunkA.visible, true);
    assert.equal(chunkB.visible, false);
    assert.equal(chunkB.cullReason, 'distance');

    const pcB = lab.pcStations.find((pc) => pc.id === 'pc-bat-b');
    assert.ok(pcB);
    const drawsBefore = pcB.desktop.idleDrawCount || 0;
    lab.update(8.0, { x: 450, y: 3 * DEFAULT_FLOOR_HEIGHT + 1.68, z: -415 }, false, cam);
    assert.equal(pcB.desktop.idleDrawCount || 0, drawsBefore);
    assert.equal(pcB.desktop.sleepMode, true);

    cam.lookAt(450, 3 * DEFAULT_FLOOR_HEIGHT + 1.4, -390);
    cam.updateMatrixWorld(true);
    const turnedStats = lab.updateCulling(cam, { x: 450, y: 3 * DEFAULT_FLOOR_HEIGHT, z: -415 }, { currentFloor: 3, quality: 'high' });
    assert.ok(turnedStats.culledFrustum >= 0 && turnedStats.culledDistance > 0);
  } finally {
    lab.dispose();
  }
});

test('v4.33 — Aucun bridage joueur sur grandes coordonnées (±950m, -2..+8) en local et WebSocket + Culling 2D éditeur', async () => {
  const map2000 = makeImmenseCampusMap(2000);
  const scene = new THREE.Scene();
  const lab = buildLabWorld(scene, map2000, { hideSprites: true });
  const cam = new THREE.PerspectiveCamera(65, 16 / 9, 0.1, 1200);
  const player = new PlayerController(cam, makeMockCanvas(), lab.colliders);
  player.setBounds(map2000.bounds);
  player.setWalkableSurfaces(lab.walkableSurfaces);
  player.setSpatialHash(lab.spatialHash);

  const tmpDir = fs.mkdtempSync(path.join('/tmp', 'atelier-campus-ws-'));
  const store = new GameStore(path.join(tmpDir, 'db.json'));
  const mapStore = new MapStore(path.join(tmpDir, 'map.json'));
  const server = http.createServer((_req, res) => {
    res.writeHead(200);
    res.end('ok');
  });
  const wsHub = attachWsHub(server, store, mapStore);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  let wsA;
  let wsB;
  try {
    player.teleportTo({ x: 450, z: -420, floor: 3 });
    assert.equal(player.position.x, 450);
    assert.equal(player.position.z, -420);
    assert.equal(player.getCurrentFloor(), 3);
    const stepA = player.moveHorizontally(1.2, 0.8, player.position.x, player.position.z, 0.04);
    assert.ok(Math.abs(stepA.x - 451.2) < 0.05);
    assert.ok(Math.abs(stepA.z - -419.2) < 0.05);

    player.teleportTo({ x: -480, z: 460, floor: 0 });
    assert.equal(player.position.x, -480);
    assert.equal(player.position.z, 460);
    assert.equal(player.getCurrentFloor(), 0);

    player.teleportTo({ x: 920, z: -910, floor: 8 });
    assert.equal(player.position.x, 920);
    assert.equal(player.position.z, -910);
    assert.equal(player.getCurrentFloor(), 8);

    const connectClient = (name) =>
      new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
        ws.on('error', reject);
        ws.on('open', () => {
          ws.send(JSON.stringify({ type: 'join', name, room: 'plateau-u300', x: 0, y: 0, z: 0, yaw: 0, floor: 0 }));
        });
        ws.on('message', (buf) => {
          const msg = JSON.parse(buf.toString('utf8'));
          if (msg.type === 'welcome') resolve(ws);
        });
      });

    wsA = await connectClient('CampusRunnerA');
    wsB = await connectClient('CampusRunnerB');

    const waitMove = (pred) =>
      new Promise((resolve) => {
        const onMsg = (buf) => {
          const msg = JSON.parse(buf.toString('utf8'));
          if (msg.type === 'player_moved' && pred(msg)) {
            wsB.off('message', onMsg);
            resolve(msg);
          }
        };
        wsB.on('message', onMsg);
      });

    const pFarHigh = waitMove((m) => m.x === 450 && m.floor === 3);
    wsA.send(JSON.stringify({ type: 'move', x: 450, y: 11.4, z: -420, yaw: 0.5, floor: 3 }));
    const mFarHigh = await pFarHigh;
    assert.equal(mFarHigh.x, 450);
    assert.equal(mFarHigh.z, -420);
    assert.equal(mFarHigh.floor, 3);

    const pDeepBase = waitMove((m) => m.x === -480 && m.floor === -2);
    wsA.send(JSON.stringify({ type: 'move', x: -480, y: -7.6, z: 460, yaw: 0, floor: -2 }));
    const mDeepBase = await pDeepBase;
    assert.equal(mDeepBase.x, -480);
    assert.equal(mDeepBase.z, 460);
    assert.equal(mDeepBase.floor, -2);

    const pTopTower = waitMove((m) => m.x === 920 && m.floor === 8);
    wsA.send(JSON.stringify({ type: 'move', x: 920, y: 30.4, z: -910, yaw: 0, floor: 8 }));
    const mTopTower = await pTopTower;
    assert.equal(mTopTower.x, 920);
    assert.equal(mTopTower.z, -910);
    assert.equal(mTopTower.floor, 8);

    assert.ok(MIN_ZOOM_2D <= 0.3 && MAX_ZOOM_2D >= 180);
    assert.equal(isBoxInViewport2D(440, 460, -430, -410, 400, 500, -460, -380), true);
    assert.equal(isBoxInViewport2D(-490, -470, 450, 470, 400, 500, -460, -380), false);

    const serverSrc = fs.readFileSync(path.resolve('server/index.js'), 'utf8');
    assert.ok(serverSrc.includes("limit: '50mb'"));
    const wsSrc = fs.readFileSync(path.resolve('server/wsHub.js'), 'utf8');
    assert.ok(wsSrc.includes('50 * 1024 * 1024'));
  } finally {
    wsA?.close();
    wsB?.close();
    wsHub.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
    lab.dispose();
  }
});
