import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORLD_BOUNDS,
  PLATEAU_SPAWN,
  buildPlateauWalls,
  getStaticWallColliders,
  getPlateauFurnitureColliders,
  getZoneAtPosition,
  getStationTeleportSpot
} from '../src/world/plateauLayout.js';
import { PATCH_STAGES, evaluatePatchConfiguration } from '../src/minigames/PatchRackGame.js';
import { HARDWARE_STAGES, evaluateHardwareBuild } from '../src/minigames/PcHardwareGame.js';
import { AV_STAGES, evaluateAvStage } from '../src/minigames/AudioVisualGame.js';

function collidesPoint(x, z, colliders, radius = 0.42) {
  if (
    x < WORLD_BOUNDS.minX + radius ||
    x > WORLD_BOUNDS.maxX - radius ||
    z < WORLD_BOUNDS.minZ + radius ||
    z > WORLD_BOUNDS.maxZ - radius
  ) {
    return true;
  }
  for (const b of colliders) {
    if (
      x + radius > b.minX &&
      x - radius < b.maxX &&
      z + radius > b.minZ &&
      z - radius < b.maxZ
    ) {
      return true;
    }
  }
  return false;
}

test('Plateau U300 : détection exacte des zones et coordonnées des salles', () => {
  assert.equal(getZoneAtPosition(PLATEAU_SPAWN.x, PLATEAU_SPAWN.z).id, 'U300');
  assert.equal(getZoneAtPosition(-8.0, -7.5).id, 'U301');
  assert.equal(getZoneAtPosition(0.0, -7.5).id, 'U302');
  assert.equal(getZoneAtPosition(7.0, -7.5).id, 'U303');
  assert.equal(getZoneAtPosition(8.5, 0.0).id, 'U304');
  assert.equal(getZoneAtPosition(8.0, 8.0).id, 'U305');
  assert.equal(getZoneAtPosition(0.0, 8.5).id, 'U306');
  assert.equal(getZoneAtPosition(-8.0, 7.0).id, 'U307');
  assert.equal(getZoneAtPosition(-10.0, -0.5).id, 'CHAMBRE');
  assert.equal(getZoneAtPosition(-6.8, -0.5).id, 'U309');
  assert.equal(getZoneAtPosition(-6.0, 1.1).id, 'U311');
  assert.equal(getZoneAtPosition(1.4, 4.4).id, 'U308');
  assert.equal(getZoneAtPosition(0.0, 0.0).id, 'ESCALIER');
});

test('Plateau U300 : BFS de navigabilité (rayon joueur 0.42m) vers toutes les salles et stations', () => {
  const walls = buildPlateauWalls();
  const colliders = [...getStaticWallColliders(walls), ...getPlateauFurnitureColliders()];
  const step = 0.2;
  const cols = Math.floor(WORLD_BOUNDS.width / step) + 1;
  const rows = Math.floor(WORLD_BOUNDS.depth / step) + 1;
  const toGrid = (wx, wz) => [
    Math.round((wx - WORLD_BOUNDS.minX) / step),
    Math.round((wz - WORLD_BOUNDS.minZ) / step)
  ];
  const toWorld = (gx, gz) => [WORLD_BOUNDS.minX + gx * step, WORLD_BOUNDS.minZ + gz * step];

  const [sx, sz] = toGrid(PLATEAU_SPAWN.x, PLATEAU_SPAWN.z);
  assert.equal(
    collidesPoint(PLATEAU_SPAWN.x, PLATEAU_SPAWN.z, colliders, 0.42),
    false,
    'Le spawn Hall U300 ne doit entrer en collision avec aucun mur ni mobilier'
  );

  const visited = new Uint8Array(cols * rows);
  const queue = [[sx, sz]];
  visited[sz * cols + sx] = 1;
  let head = 0;

  while (head < queue.length) {
    const [cx, cz] = queue[head++];
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ]) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx < 0 || nx >= cols || nz < 0 || nz >= rows) continue;
      const key = nz * cols + nx;
      if (visited[key]) continue;
      const [wx, wz] = toWorld(nx, nz);
      if (collidesPoint(wx, wz, colliders, 0.42)) continue;
      visited[key] = 1;
      queue.push([nx, nz]);
    }
  }

  const checkReachable = (name, x, z) => {
    assert.equal(
      collidesPoint(x, z, colliders, 0.42),
      false,
      `${name} (${x}, ${z}) ne doit pas chevaucher un collider`
    );
    const [gx, gz] = toGrid(x, z);
    let ok = visited[gz * cols + gx] === 1;
    if (!ok) {
      for (let ox = -1; ox <= 1 && !ok; ox++) {
        for (let oz = -1; oz <= 1 && !ok; oz++) {
          const rx = gx + ox;
          const rz = gz + oz;
          if (rx >= 0 && rx < cols && rz >= 0 && rz < rows && visited[rz * cols + rx] === 1) {
            ok = true;
          }
        }
      }
    }
    assert.equal(ok, true, `${name} (${x}, ${z}) doit être atteignable à pied depuis PLATEAU_SPAWN`);
  };

  for (const id of [
    'teacher',
    'soldering',
    'oscilloscope',
    'electronics',
    'antivirus',
    'vmvlan',
    'patchrack',
    'hardware',
    'audiovisual',
    'studio'
  ]) {
    const spot = getStationTeleportSpot(id);
    assert.ok(spot, `Teleport missing for ${id}`);
    checkReachable(`Station ${id}`, spot.pos.x, spot.pos.z);
  }

  checkReachable('Zone U309', -6.35, -0.5);
  checkReachable('Zone U311', -5.65, 1.12);
  checkReachable('Zone U308', 1.45, 4.45);
});

test('Mini-jeu Chambre (PatchRackGame) : évaluation brassage RJ45 et fibre', () => {
  const s1 = evaluatePatchConfiguration(PATCH_STAGES[0], {
    links: { 'PP-01': 'SW-01', 'PP-02': 'SW-02', 'PP-03': 'SW-03', 'PP-04': 'SW-SFP1' },
    mediaUsed: { 'PP-01': 'cat6a', 'PP-02': 'cat6a', 'PP-03': 'cat6a', 'PP-04': 'sfp10g' }
  });
  assert.equal(s1.score, 20);
  assert.equal(s1.passed, true);

  const s2Fail = evaluatePatchConfiguration(PATCH_STAGES[1], {
    links: { 'FO-A': 'CORE-SFP1', 'FO-B': 'CORE-SFP2', MGMT: 'CORE-MGMT', 'AP-HALL': 'CORE-POE' },
    mediaUsed: { 'FO-A': 'fiber', 'FO-B': 'fiber', MGMT: 'cat6a', 'AP-HALL': 'cat6a' },
    fiberCleaned: false,
    psuBEnabled: false
  });
  assert.ok(s2Fail.score < 20);
  assert.equal(s2Fail.details.length, 2);
});

test('Mini-jeu U306 (PcHardwareGame) : évaluation montage ESD et pannes POST', () => {
  const s1Ok = evaluateHardwareBuild(HARDWARE_STAGES[0], {
    esdStrap: true,
    placements: { socket: 'cpu', dimm: 'ram', m2: 'nvme', atx: 'psu' }
  });
  assert.equal(s1Ok.score, 20);

  const s1NoEsd = evaluateHardwareBuild(HARDWARE_STAGES[0], {
    esdStrap: false,
    placements: { socket: 'cpu', dimm: 'ram', m2: 'nvme', atx: 'psu' }
  });
  assert.equal(s1NoEsd.score, 16);

  const s2Ok = evaluateHardwareBuild(HARDWARE_STAGES[1], {
    answers: { 'pc-a': 'ram', 'pc-b': 'cooling', 'pc-c': 'boot' }
  });
  assert.equal(s2Ok.score, 20);
});

test('Mini-jeux U303/U304 (AudioVisualGame) : évaluation éclairage, son et matrice', () => {
  const a1 = evaluateAvStage(AV_STAGES[0], { kelvin: 5600, keyDimmer: 75, chromaBacklight: true });
  assert.equal(a1.score, 20);

  const a2 = evaluateAvStage(AV_STAGES[1], { gain: 50, phantom48v: true, highPass80: true });
  assert.equal(a2.score, 20);

  const a3 = evaluateAvStage(AV_STAGES[2], {
    routing: { 'out-pgm': 'cam-a', 'out-rec': 'cam-b', 'out-mon': 'pc-slides' }
  });
  assert.equal(a3.score, 20);
});
