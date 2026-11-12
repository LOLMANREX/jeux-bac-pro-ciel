import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { WebSocket } from 'ws';
import { createGameServer } from '../server/index.js';
import { MapStore } from '../server/store.js';
import {
  MAP_ITEM_CATEGORIES,
  MAP_ITEM_CATALOG,
  createDefaultMap,
  createEmptyMap,
  getCatalogItem,
  getDynamicMapColliders,
  getStationTeleportInMap,
  getZoneAtPositionInMap,
  subtractDoorsFromWalls
} from '../src/world/mapSchema.js';

test('Catalogue éditeur de carte contient les 4 catégories et tous les équipements CIEL requis', () => {
  assert.deepEqual(
    MAP_ITEM_CATEGORIES.map((c) => c.id),
    ['arch', 'stations', 'furniture', 'tech']
  );

  const requiredTypes = [
    'wall_solid',
    'wall_glazed',
    'door_single',
    'door_double',
    'zone_room',
    'spawn_point',
    'leaderboard',
    'tp_soldering',
    'tp_oscilloscope',
    'tp_electronics',
    'tp_antivirus',
    'tp_vmvlan',
    'tp_patchrack',
    'tp_hardware',
    'tp_audiovisual',
    'tp_studio',
    'npc_teacher',
    'chair_student',
    'desk_individual',
    'workbench_large',
    'elec_bench',
    'network_island',
    'desk_teacher',
    'whiteboard',
    'metal_cabinet',
    'av_greenscreen',
    'av_camera',
    'av_led_light',
    'av_mixer',
    'av_mic_stand',
    'net_rack_19',
    'net_patch_wall',
    'net_switch_stack',
    'net_ups',
    'pc_gamer_cyber',
    'pc_open_maint',
    'soc_wall_screen',
    'elec_solder_unit',
    'elec_scope_unit',
    'elec_multimeter',
    'elec_fume_extractor'
  ];

  for (const type of requiredTypes) {
    assert.ok(getCatalogItem(type), `Type manquant dans le catalogue: ${type}`);
  }
  assert.ok(MAP_ITEM_CATALOG.length >= requiredTypes.length);
});

test('subtractDoorsFromWalls découpe automatiquement les murs traversés par une porte', () => {
  const walls = [
    { id: 'w1', kind: 'solid', x1: -5, z1: 0, x2: 5, z2: 0, thickness: 0.2, height: 4.6 },
    { id: 'd1', kind: 'door_single', x1: -1, z1: 0, x2: 1, z2: 0, thickness: 0.2, height: 4.6, doorLabel: 'U301' }
  ];

  const resolved = subtractDoorsFromWalls(walls);
  const solids = resolved.filter((w) => w.kind === 'solid');
  const doors = resolved.filter((w) => w.kind === 'door_single');

  assert.equal(doors.length, 1);
  assert.equal(solids.length, 2);
  assert.equal(solids[0].x1, -5);
  assert.equal(solids[0].x2, -1);
  assert.equal(solids[1].x1, 1);
  assert.equal(solids[1].x2, 5);

  const colliders = getDynamicMapColliders({ walls, objects: [] });
  const doorwayBlocked = colliders.some(
    (c) => 0 > c.minX && 0 < c.maxX && 0 > c.minZ && 0 < c.maxZ
  );
  assert.equal(doorwayBlocked, false);
});

test('getDynamicMapColliders gère les objets tournés en OBB ainsi que zones et téléportation', () => {
  const map = createEmptyMap();
  map.zones.push({
    id: 'z-lab',
    code: 'U404',
    shortName: 'Labo Cyber',
    fullLabel: 'U404 - Labo Cyber',
    badgeText: '📍 U404 - Labo Cyber',
    color: '#f43f5e',
    x: 4,
    z: -3,
    w: 6,
    d: 6
  });
  map.objects.push({
    id: 'obj-cyber',
    type: 'tp_antivirus',
    x: 4,
    z: -3,
    rotation: 45,
    w: 2.2,
    d: 1.3,
    color: '#f43f5e',
    label: 'Poste SOC'
  });

  const colliders = getDynamicMapColliders(map);
  const obb = colliders.find((c) => typeof c.cx === 'number' && Math.abs(c.cx - 4) < 0.01);
  assert.ok(obb);
  assert.ok(Math.abs(obb.hw - 1.1) < 0.01);

  const zoneHit = getZoneAtPositionInMap(map, 4.2, -2.5);
  assert.equal(zoneHit.code, 'U404');

  const tpSpot = getStationTeleportInMap(map, 'antivirus');
  assert.ok(tpSpot);
  assert.equal(tpSpot.lookAt.x, 4);
  assert.equal(tpSpot.lookAt.z, -3);
});

test('MapStore charge la carte par défaut puis persiste sur disque en mode atomique', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ciel-map-'));
  const mapFile = path.join(tmpDir, 'map.json');

  try {
    const store1 = new MapStore(mapFile);
    const initial = store1.getMap();
    assert.ok(initial.walls.length > 10);
    assert.ok(initial.objects.length > 10);

    const custom = createEmptyMap();
    custom.name = 'Salle Examen BAC PRO';
    custom.objects.push({
      id: 'custom-rack',
      type: 'net_rack_19',
      x: 2,
      z: 2,
      rotation: 90,
      w: 1,
      d: 0.6,
      color: '#10b981',
      label: 'Baie Examen'
    });
    store1.saveMap(custom);

    const store2 = new MapStore(mapFile);
    const reloaded = store2.getMap();
    assert.equal(reloaded.name, 'Salle Examen BAC PRO');
    assert.ok(reloaded.objects.some((o) => o.id === 'custom-rack'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('API HTTP GET /api/map, PUT /api/admin/map et diffusion WebSocket map_updated en direct', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ciel-srv-map-'));
  const mapPath = path.join(tmpDir, 'map.json');
  const { server, wsHub } = createGameServer({ dbPath: null, mapPath });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const wsUrl = `ws://127.0.0.1:${port}/ws`;

  try {
    const getRes = await fetch(`${baseUrl}/api/map`);
    assert.equal(getRes.status, 200);
    const getData = await getRes.json();
    assert.ok(Array.isArray(getData.walls) && Array.isArray(getData.objects));
    assert.equal(getData.name, createDefaultMap().name);

    const unauthPut = await fetch(`${baseUrl}/api/admin/map`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ map: createEmptyMap() })
    });
    assert.equal(unauthPut.status, 401);

    const loginRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: process.env.ADMIN_PASSWORD || 'Louisetjade1102' })
    });
    assert.equal(loginRes.status, 200);
    const { token } = await loginRes.json();

    const ws = new WebSocket(wsUrl);
    await new Promise((resolve) => ws.once('open', resolve));
    const welcomeP = new Promise((resolve) => {
      ws.on('message', function onMsg(buf) {
        const msg = JSON.parse(buf.toString());
        if (msg.type === 'welcome') {
          ws.off('message', onMsg);
          resolve(msg);
        }
      });
    });
    ws.send(JSON.stringify({ type: 'join', name: 'EleveLiveMap', room: 'plateau-u300' }));
    await welcomeP;

    const badPut = await fetch(`${baseUrl}/api/admin/map`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': token
      },
      body: JSON.stringify({ invalid: true })
    });
    assert.equal(badPut.status, 400);

    const customMap = createEmptyMap();
    customMap.name = 'Plateau Sandbox Live';
    customMap.objects.push({
      id: 'obj-teacher-custom',
      type: 'npc_teacher',
      x: 1,
      z: 1,
      rotation: 0,
      w: 1.1,
      d: 1.1,
      color: '#fbbf24',
      label: 'Professeur CIEL',
      dialogue: 'Bienvenue dans ma nouvelle salle sur-mesure !'
    });

    const liveEventP = new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Timeout waiting map_updated')), 3000);
      ws.on('message', function onMsg(buf) {
        const msg = JSON.parse(buf.toString());
        if (msg.type === 'map_updated') {
          clearTimeout(t);
          ws.off('message', onMsg);
          resolve(msg);
        }
      });
    });

    const okPut = await fetch(`${baseUrl}/api/admin/map`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': token
      },
      body: JSON.stringify({ map: customMap })
    });
    assert.equal(okPut.status, 200);
    const putData = await okPut.json();
    assert.equal(putData.ok, true);
    assert.equal(putData.map.name, 'Plateau Sandbox Live');

    const broadcastMsg = await liveEventP;
    assert.equal(broadcastMsg.map.name, 'Plateau Sandbox Live');
    assert.ok(
      broadcastMsg.map.objects.some(
        (o) => o.type === 'npc_teacher' && o.dialogue === 'Bienvenue dans ma nouvelle salle sur-mesure !'
      )
    );

    const getAfter = await (await fetch(`${baseUrl}/api/map`)).json();
    assert.equal(getAfter.name, 'Plateau Sandbox Live');

    ws.close();
  } finally {
    wsHub.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
