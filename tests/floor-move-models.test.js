import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEmptyMap,
  getFloorContentCount,
  getFloorEntityRefs,
  moveFloorContents,
  normalizeMapData
} from '../src/world/mapSchema.js';

function buildMap() {
  const map = createEmptyMap();
  map.walls = [
    { id: 'w1', floor: 0, x1: 0, z1: 0, x2: 4, z2: 0, kind: 'solid' },
    { id: 'w2', floor: 1, x1: 1, z1: 1, x2: 5, z2: 1, kind: 'solid' }
  ];
  map.objects = [
    { id: 'o1', floor: 0, type: 'whiteboard', x: 2, z: 3, rotation: 0, w: 1, d: 0.2 },
    { id: 'o2', floor: 1, type: 'whiteboard', x: -2, z: 3, rotation: 0, w: 1, d: 0.2 }
  ];
  return normalizeMapData(map);
}

test('moveFloorContents déplace tout un étage en conservant les positions relatives', () => {
  const map = buildMap();
  const res = moveFloorContents(map, 0, 3, 'move');
  assert.ok(res.moved >= 2);
  assert.equal(getFloorContentCount(res.mapData, 0), 0);
  const w1 = res.mapData.walls.find((w) => w.id === 'w1');
  assert.equal(w1.floor, 3);
  assert.equal(w1.x2 - w1.x1, 4);
  const o1 = res.mapData.objects.find((o) => o.id === 'o1');
  assert.equal(o1.floor, 3);
  assert.equal(o1.x, 2);
  assert.equal(res.mapData.walls.find((w) => w.id === 'w2').floor, 1);
  assert.equal(map.walls.find((w) => w.id === 'w1').floor, 0);
});

test('moveFloorContents en mode échange ne perd aucun élément', () => {
  const map = buildMap();
  const before = getFloorContentCount(map, 0) + getFloorContentCount(map, 1);
  const res = moveFloorContents(map, 0, 1, 'swap');
  assert.equal(res.mapData.walls.find((w) => w.id === 'w1').floor, 1);
  assert.equal(res.mapData.walls.find((w) => w.id === 'w2').floor, 0);
  assert.equal(getFloorContentCount(res.mapData, 0) + getFloorContentCount(res.mapData, 1), before);
  assert.equal(getFloorEntityRefs(res.mapData, 1).length, getFloorEntityRefs(map, 0).length);
});

test('les modèles 3D importés et leurs instances survivent à la normalisation', () => {
  const map = buildMap();
  map.models = [
    {
      id: 'm1',
      name: 'Chaise',
      main: 'chaise.glb',
      files: { 'chaise.glb': 'data:model/gltf-binary;base64,AAAA', 'bad.png': 'http://x' },
      size: [1, 2, 3]
    },
    { id: 'm2', name: 'Faux', main: 'faux.xyz', files: { 'faux.xyz': 'data:text/plain;base64,AAAA' } }
  ];
  map.objects.push({
    id: 'cm1',
    type: 'custom_model',
    floor: 2,
    x: 1,
    z: 1,
    rotation: 45,
    w: 1,
    d: 3,
    modelId: 'm1',
    scaleY: 2,
    elevation: 0.5
  });
  const out = normalizeMapData(JSON.parse(JSON.stringify(map)));
  assert.equal(out.models.length, 1);
  assert.deepEqual(Object.keys(out.models[0].files), ['chaise.glb']);
  assert.equal(out.models[0].format, 'glb');
  const inst = out.objects.find((o) => o.id === 'cm1');
  assert.equal(inst.modelId, 'm1');
  assert.equal(inst.floor, 2);
  assert.equal(inst.scaleY, 2);
  assert.equal(inst.elevation, 0.5);
  assert.equal(normalizeMapData(out).models.length, 1);
});
