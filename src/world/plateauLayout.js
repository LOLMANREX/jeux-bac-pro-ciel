export const WORLD_BOUNDS = {
  minX: -13.0,
  maxX: 13.0,
  minZ: -12.2,
  maxZ: 12.2,
  width: 26.0,
  depth: 24.4,
  height: 4.6
};

export const PLATEAU_SPAWN = { x: -3.95, y: 1.68, z: 0.65, lookAt: { x: -2.4, z: 0.25 } };
export const PLATEAU_TEACHER_POS = { x: -3.35, z: -1.35 };

export const PLATEAU_ZONES = [
  {
    id: 'CHAMBRE',
    code: 'Chambre',
    shortName: 'Baie Serveur',
    fullLabel: 'Local Baies Serveurs & Brassage (11.14 m²)',
    badgeText: '📍 Chambre - Baie Serveur',
    color: '#38bdf8',
    bounds: { minX: -13.0, maxX: -7.7, minZ: -1.55, maxZ: 0.55 },
    labelPos: { x: -10.35, z: -0.5 }
  },
  {
    id: 'U309',
    code: 'U309',
    shortName: 'Local Tech.',
    fullLabel: 'Local Technique U309 (3.43 m²)',
    badgeText: '📍 U309 - Local Technique',
    color: '#64748b',
    bounds: { minX: -7.7, maxX: -5.95, minZ: -1.55, maxZ: 0.55 },
    labelPos: { x: -6.82, z: -0.5 }
  },
  {
    id: 'U311',
    code: 'U311',
    shortName: 'Répétiteur',
    fullLabel: 'Local Technique U311 (2.22 m²)',
    badgeText: '📍 U311 - Réseau',
    color: '#64748b',
    bounds: { minX: -7.1, maxX: -5.2, minZ: 0.55, maxZ: 1.85 },
    labelPos: { x: -6.15, z: 1.2 }
  },
  {
    id: 'U308',
    code: 'U308',
    shortName: 'Sas U306',
    fullLabel: 'Sas Atelier U308 (2.69 m²)',
    badgeText: '📍 U308 - Sas Montage PC',
    color: '#a78bfa',
    bounds: { minX: 0.58, maxX: 2.36, minZ: 3.65, maxZ: 5.3 },
    labelPos: { x: 1.47, z: 4.48 }
  },
  {
    id: 'U301',
    code: 'U301',
    shortName: 'Brasure & Élec',
    fullLabel: 'Salle Brasure & Électronique 1 (87.74 m²)',
    badgeText: '📍 U301 - Brasure & Élec',
    color: '#fb923c',
    bounds: { minX: -13.0, maxX: -2.92, minZ: -12.2, maxZ: -3.2 },
    labelPos: { x: -7.96, z: -7.7 }
  },
  {
    id: 'U302',
    code: 'U302',
    shortName: 'Élec & Mesures',
    fullLabel: 'Salle Électronique & Mesures 2 (46.62 m²)',
    badgeText: '📍 U302 - Élec & Mesures',
    color: '#22d3ee',
    bounds: { minX: -2.92, maxX: 2.36, minZ: -12.2, maxZ: -3.2 },
    labelPos: { x: -0.28, z: -7.7 }
  },
  {
    id: 'U303',
    code: 'U303',
    shortName: 'Audiovisuel 1',
    fullLabel: 'Salle Audiovisuel & Médias 1 (91.36 m²)',
    badgeText: '📍 U303 - Audiovisuel 1',
    color: '#f472b6',
    bounds: { minX: 2.36, maxX: 13.0, minZ: -12.2, maxZ: -3.2 },
    labelPos: { x: 7.68, z: -7.7 }
  },
  {
    id: 'U304',
    code: 'U304',
    shortName: 'Studio AV 2',
    fullLabel: 'Salle Audiovisuel & Studio 2 (49.8 m²)',
    badgeText: '📍 U304 - Studio AV 2',
    color: '#e879f9',
    bounds: { minX: 3.55, maxX: 13.0, minZ: -3.2, maxZ: 3.0 },
    labelPos: { x: 8.6, z: -0.1 }
  },
  {
    id: 'U307',
    code: 'U307',
    shortName: 'Salle Réseau',
    fullLabel: 'Salle Réseau & Infrastructure (97.48 m²)',
    badgeText: '📍 U307 - Salle Réseau',
    color: '#34d399',
    bounds: { minX: -13.0, maxX: -2.92, minZ: 1.85, maxZ: 12.2 },
    labelPos: { x: -7.96, z: 6.95 }
  },
  {
    id: 'U306',
    code: 'U306',
    shortName: 'Maintenance PC',
    fullLabel: 'Atelier Assemblage & Maintenance PC (42.59 m²)',
    badgeText: '📍 U306 - Maintenance PC',
    color: '#a78bfa',
    bounds: { minX: -2.92, maxX: 2.36, minZ: 3.7, maxZ: 12.2 },
    labelPos: { x: -0.28, z: 8.4 }
  },
  {
    id: 'U305',
    code: 'U305',
    shortName: 'Salle Cyber',
    fullLabel: 'Salle Cybersécurité (SOC) (87.42 m²)',
    badgeText: '📍 U305 - Salle Cyber',
    color: '#f43f5e',
    bounds: { minX: 2.36, maxX: 13.0, minZ: 3.68, maxZ: 12.2 },
    labelPos: { x: 7.68, z: 7.94 }
  },
  {
    id: 'ESCALIER',
    code: 'Escalier',
    shortName: 'Cage d’escalier',
    fullLabel: 'Cage d’escalier centrale (15.42 m²)',
    badgeText: '📍 Escalier Central',
    color: '#94a3b8',
    bounds: { minX: -2.4, maxX: 1.81, minZ: -1.55, maxZ: 2.11 },
    labelPos: { x: -0.3, z: 0.28 }
  },
  {
    id: 'U300',
    code: 'U300',
    shortName: 'Couloir Central',
    fullLabel: 'Couloir & Hall Plateau U300 (39.44 m²)',
    badgeText: '📍 U300 - Couloir Central',
    color: '#38bdf8',
    bounds: { minX: -13.0, maxX: 13.0, minZ: -12.2, maxZ: 12.2 },
    labelPos: { x: -3.8, z: 0.4 }
  }
];

export function getZoneAtPosition(x, z) {
  const px = Number(x) || 0;
  const pz = Number(z) || 0;
  for (const zone of PLATEAU_ZONES) {
    if (zone.id === 'U300') continue;
    const b = zone.bounds;
    if (px >= b.minX && px <= b.maxX && pz >= b.minZ && pz <= b.maxZ) {
      return zone;
    }
  }
  return PLATEAU_ZONES[PLATEAU_ZONES.length - 1];
}

export const TP_STATION_LAYOUT = {
  soldering: {
    room: 'U301',
    position: { x: -8.2, z: -7.5 },
    teleport: { x: -6.3, z: -7.5 }
  },
  oscilloscope: {
    room: 'U302',
    position: { x: -1.65, z: -8.8 },
    teleport: { x: 0.05, z: -8.8 }
  },
  electronics: {
    room: 'U302',
    position: { x: 1.25, z: -7.0 },
    teleport: { x: -0.45, z: -7.0 }
  },
  antivirus: {
    room: 'U305',
    position: { x: 7.8, z: 7.8 },
    teleport: { x: 7.8, z: 5.95 }
  },
  vmvlan: {
    room: 'U307',
    position: { x: -12.05, z: 6.8 },
    teleport: { x: -10.75, z: 6.8 }
  }
};

export const EXTRA_STATIONS = [
  {
    id: 'patchrack',
    title: 'Atelier Brassage Baie Serveur',
    shortTitle: 'Baie Serveur',
    icon: '🔌',
    pole: 'Infrastructure & Fibre',
    room: 'Chambre',
    color: '#38bdf8',
    position: { x: -10.3, z: 0.16 },
    teleport: { x: -10.3, z: -0.82 },
    interactRadius: 2.3,
    brief: 'Réalisez le brassage RJ45 et fibre optique sur les baies 19 pouces de la Chambre.'
  },
  {
    id: 'hardware',
    title: 'Atelier Montage & Maintenance PC',
    shortTitle: 'Montage PC',
    icon: '🖥️',
    pole: 'Hardware & Diagnostic',
    room: 'U306',
    color: '#a78bfa',
    position: { x: -1.35, z: 8.4 },
    teleport: { x: 0.1, z: 8.2 },
    interactRadius: 2.8,
    brief: 'Assemblez un poste complet sur tapis antistatique et diagnostiquez les pannes POST.'
  },
  {
    id: 'audiovisual',
    title: 'Atelier Régie Audiovisuelle',
    shortTitle: 'Régie AV 1',
    icon: '🎬',
    pole: 'Audiovisuel & Médias',
    room: 'U303',
    color: '#f472b6',
    position: { x: 6.0, z: -7.6 },
    teleport: { x: 4.3, z: -7.6 },
    interactRadius: 2.8,
    brief: 'Pilotez la régie vidéo, l’éclairage DMX fond vert et les flux caméras en U303.'
  },
  {
    id: 'studio',
    title: 'Studio Montage & Audio AV 2',
    shortTitle: 'Studio AV 2',
    icon: '🎙️',
    pole: 'Audiovisuel & Son',
    room: 'U304',
    color: '#e879f9',
    position: { x: 8.4, z: -0.6 },
    teleport: { x: 6.6, z: -0.6 },
    interactRadius: 2.7,
    brief: 'Étalonnez les niveaux audio et le streaming multi-pistes en studio U304.'
  }
];

export const PLATEAU_FURNITURE_BOXES = [
  { id: 'soldering', x: -8.2, z: -7.5, w: 1.5, d: 2.8 },
  { id: 'u301_west', x: -11.9, z: -7.6, w: 1.3, d: 4.8 },
  { id: 'u301_north', x: -6.2, z: -11.0, w: 4.6, d: 1.3 },
  { id: 'oscilloscope', x: -1.65, z: -8.8, w: 1.4, d: 2.6 },
  { id: 'electronics', x: 1.25, z: -7.0, w: 1.4, d: 2.6 },
  { id: 'u302_north', x: -0.28, z: -11.35, w: 3.4, d: 1.0 },
  { id: 'audiovisual', x: 6.0, z: -7.6, w: 2.2, d: 1.4 },
  { id: 'u303_greenscreen', x: 10.4, z: -10.5, w: 4.2, d: 1.0 },
  { id: 'u303_cam1', x: 8.8, z: -6.8, w: 0.75, d: 0.75 },
  { id: 'u303_cam2', x: 11.0, z: -6.8, w: 0.75, d: 0.75 },
  { id: 'studio', x: 8.4, z: -0.6, w: 2.2, d: 1.3 },
  { id: 'u304_booth1', x: 6.2, z: 2.2, w: 1.2, d: 0.9 },
  { id: 'u304_booth2', x: 8.2, z: 2.2, w: 1.2, d: 0.9 },
  { id: 'u304_booth3', x: 10.2, z: 2.2, w: 1.2, d: 0.9 },
  { id: 'u304_booth4', x: 12.1, z: 2.2, w: 1.1, d: 0.9 },
  { id: 'chambre_rack1', x: -11.6, z: 0.16, w: 1.0, d: 0.56 },
  { id: 'patchrack', x: -10.3, z: 0.16, w: 1.0, d: 0.56 },
  { id: 'chambre_rack3', x: -9.0, z: 0.16, w: 1.0, d: 0.56 },
  { id: 'chambre_ups', x: -12.45, z: 0.14, w: 0.5, d: 0.55 },
  { id: 'chambre_clim', x: -8.15, z: 0.14, w: 0.5, d: 0.55 },
  { id: 'u309_rack', x: -7.2, z: -0.5, w: 0.55, d: 1.1 },
  { id: 'u311_panel', x: -6.6, z: 1.1, w: 0.5, d: 0.7 },
  { id: 'vmvlan', x: -12.05, z: 6.8, w: 1.0, d: 2.4 },
  { id: 'u307_il1', x: -8.9, z: 4.4, w: 2.0, d: 1.0 },
  { id: 'u307_il2', x: -5.5, z: 4.4, w: 2.0, d: 1.0 },
  { id: 'u307_il3', x: -8.9, z: 7.2, w: 2.0, d: 1.0 },
  { id: 'u307_il4', x: -5.5, z: 7.2, w: 2.0, d: 1.0 },
  { id: 'u307_il5', x: -8.9, z: 10.0, w: 2.0, d: 1.0 },
  { id: 'u307_il6', x: -5.5, z: 10.0, w: 2.0, d: 1.0 },
  { id: 'hardware', x: -1.35, z: 8.4, w: 1.4, d: 2.6 },
  { id: 'u306_diag', x: 1.5, z: 9.9, w: 1.1, d: 2.2 },
  { id: 'u306_shelf', x: -0.3, z: 11.6, w: 3.4, d: 0.65 },
  { id: 'antivirus', x: 7.8, z: 7.8, w: 2.2, d: 1.3 },
  { id: 'u305_desk1', x: 4.6, z: 6.4, w: 1.8, d: 1.1 },
  { id: 'u305_desk2', x: 4.6, z: 9.8, w: 1.8, d: 1.1 },
  { id: 'u305_desk3', x: 10.6, z: 6.2, w: 1.8, d: 1.1 },
  { id: 'u305_desk4', x: 10.6, z: 9.8, w: 1.8, d: 1.1 }
];

export function getStationTeleportSpot(id) {
  if (id === 'teacher') {
    return {
      pos: { x: -4.2, z: -0.3 },
      lookAt: PLATEAU_TEACHER_POS,
      label: 'Professeur CIEL (Hall U300)'
    };
  }
  if (TP_STATION_LAYOUT[id]) {
    const cfg = TP_STATION_LAYOUT[id];
    return {
      pos: cfg.teleport,
      lookAt: cfg.position,
      label: `${cfg.room}`
    };
  }
  const extra = EXTRA_STATIONS.find((s) => s.id === id);
  if (extra) {
    return {
      pos: extra.teleport,
      lookAt: extra.position,
      label: `${extra.room}`
    };
  }
  return null;
}

export function getPlateauFurnitureColliders() {
  return PLATEAU_FURNITURE_BOXES.map((b) => ({
    minX: b.x - b.w / 2,
    maxX: b.x + b.w / 2,
    minZ: b.z - b.d / 2,
    maxZ: b.z + b.d / 2
  }));
}

function splitAxisWallWithDoors(axis, fixedCoord, start, end, thickness, openings = [], style = 'solid', signs = []) {
  const sorted = [...openings].sort((a, b) => a.from - b.from);
  const segs = [];
  let cursor = start;

  for (const op of sorted) {
    if (op.from > cursor + 0.04) {
      segs.push({
        axis,
        fixed: fixedCoord,
        from: cursor,
        to: op.from,
        thickness,
        style
      });
    }
    segs.push({
      axis,
      fixed: fixedCoord,
      from: op.from,
      to: op.to,
      thickness,
      style: 'lintel',
      sign: op.sign || null,
      signSide: op.signSide || 1
    });
    cursor = op.to;
  }

  if (end > cursor + 0.04) {
    segs.push({
      axis,
      fixed: fixedCoord,
      from: cursor,
      to: end,
      thickness,
      style
    });
  }

  for (const s of signs) {
    segs.push({ type: 'plaque', ...s });
  }
  return segs;
}

export function buildPlateauWalls() {
  const walls = [];
  const tExt = 0.28;
  const tInt = 0.18;

  walls.push(...splitAxisWallWithDoors('z', -12.2, -13.0, 13.0, tExt, [], 'solid'));
  walls.push(...splitAxisWallWithDoors('z', 12.2, -13.0, 13.0, tExt, [], 'solid'));
  walls.push(...splitAxisWallWithDoors('x', -13.0, -12.2, 12.2, tExt, [], 'solid'));
  walls.push(...splitAxisWallWithDoors('x', 13.0, -12.2, 12.2, tExt, [], 'solid'));

  walls.push(
    ...splitAxisWallWithDoors(
      'x',
      -2.92,
      -12.2,
      -3.2,
      tInt,
      [{ from: -5.35, to: -3.9, sign: 'U301 ↔ U302', signSide: 1 }],
      'solid'
    )
  );

  walls.push(
    ...splitAxisWallWithDoors(
      'x',
      2.36,
      -12.2,
      -3.2,
      tInt,
      [{ from: -5.35, to: -3.9, sign: 'U302 ↔ U303', signSide: -1 }],
      'solid'
    )
  );

  walls.push(
    ...splitAxisWallWithDoors(
      'z',
      -3.2,
      -13.0,
      -2.92,
      tInt,
      [{ from: -4.65, to: -3.2, sign: 'U301 • BRASURE & ÉLEC 1', signSide: 1 }],
      'glazed'
    )
  );

  walls.push(
    ...splitAxisWallWithDoors(
      'z',
      -3.2,
      -2.92,
      2.36,
      tInt,
      [{ from: -2.55, to: -1.1, sign: 'U302 • ÉLEC & MESURES 2', signSide: 1 }],
      'glazed'
    )
  );

  walls.push(
    ...splitAxisWallWithDoors(
      'z',
      -3.2,
      2.36,
      5.0,
      tInt,
      [{ from: 2.7, to: 4.15, sign: 'U303 • AUDIOVISUEL 1', signSide: 1 }],
      'glazed'
    )
  );

  walls.push(
    ...splitAxisWallWithDoors(
      'z',
      -3.2,
      5.0,
      13.0,
      tInt,
      [{ from: 7.2, to: 8.65, sign: 'U303 ↔ U304 STUDIO', signSide: 1 }],
      'solid'
    )
  );

  walls.push(
    ...splitAxisWallWithDoors(
      'z',
      -1.55,
      -13.0,
      -7.7,
      tInt,
      [{ from: -10.5, to: -9.0, sign: 'CHAMBRE • BAIES SERVEURS', signSide: -1 }],
      'glazed'
    )
  );

  walls.push(...splitAxisWallWithDoors('z', -1.55, -7.7, -5.95, tInt, [], 'solid'));
  walls.push(...splitAxisWallWithDoors('x', -7.7, -1.55, 0.55, tInt, [], 'solid'));
  walls.push(
    ...splitAxisWallWithDoors(
      'x',
      -5.95,
      -1.55,
      0.55,
      tInt,
      [{ from: -1.15, to: 0.15, sign: 'U309 • LOCAL TECH', signSide: 1 }],
      'solid'
    )
  );

  walls.push(...splitAxisWallWithDoors('z', 0.55, -13.0, -5.2, tInt, [], 'solid'));
  walls.push(...splitAxisWallWithDoors('x', -7.1, 0.55, 1.85, tInt, [], 'solid'));
  walls.push(
    ...splitAxisWallWithDoors(
      'x',
      -5.2,
      0.55,
      1.85,
      tInt,
      [{ from: 0.62, to: 1.78, sign: 'U311 • TECH', signSide: 1 }],
      'solid'
    )
  );
  walls.push(...splitAxisWallWithDoors('x', -7.7, 0.55, 1.85, tInt, [], 'solid'));

  walls.push(
    ...splitAxisWallWithDoors(
      'z',
      1.85,
      -13.0,
      -2.92,
      tInt,
      [{ from: -4.55, to: -3.1, sign: 'U307 • RÉSEAU & INFRA', signSide: -1 }],
      'glazed'
    )
  );
  walls.push(...splitAxisWallWithDoors('x', -2.92, 1.85, 3.7, tInt, [], 'glazed'));
  walls.push(...splitAxisWallWithDoors('x', -2.92, 3.7, 12.2, tInt, [], 'solid'));

  walls.push(...splitAxisWallWithDoors('z', 3.7, -2.92, 0.58, tInt, [], 'glazed'));
  walls.push(
    ...splitAxisWallWithDoors(
      'z',
      3.65,
      0.58,
      2.36,
      tInt,
      [{ from: 0.8, to: 2.15, sign: 'U308 → U306 • MONTAGE PC', signSide: -1 }],
      'glazed'
    )
  );
  walls.push(...splitAxisWallWithDoors('x', 0.58, 3.65, 5.3, tInt, [], 'glazed'));
  walls.push(
    ...splitAxisWallWithDoors(
      'z',
      5.3,
      0.58,
      2.36,
      tInt,
      [{ from: 0.8, to: 2.15, sign: 'U306 • ATELIER PC', signSide: -1 }],
      'glazed'
    )
  );

  walls.push(...splitAxisWallWithDoors('x', 2.36, 3.68, 12.2, tInt, [], 'solid'));

  walls.push(
    ...splitAxisWallWithDoors(
      'z',
      3.68,
      2.36,
      5.0,
      tInt,
      [{ from: 2.7, to: 4.15, sign: 'U305 • CYBERSÉCURITÉ (SOC)', signSide: -1 }],
      'glazed'
    )
  );
  walls.push(...splitAxisWallWithDoors('z', 3.68, 5.0, 13.0, tInt, [], 'solid'));
  walls.push(...splitAxisWallWithDoors('z', 3.0, 5.0, 13.0, tInt, [], 'solid'));
  walls.push(...splitAxisWallWithDoors('x', 5.0, 3.0, 3.68, tInt, [], 'solid'));

  walls.push(...splitAxisWallWithDoors('z', -1.55, -2.4, 1.81, tInt, [], 'glazed'));
  walls.push(...splitAxisWallWithDoors('z', 2.11, -2.4, 1.81, tInt, [], 'stairSouth'));
  walls.push(...splitAxisWallWithDoors('x', -2.4, -1.55, 2.11, tInt, [], 'stairWest'));
  walls.push(...splitAxisWallWithDoors('x', 1.81, -1.55, 2.11, tInt, [], 'glazed'));

  walls.push({
    type: 'diagonal',
    x1: 5.0,
    z1: -3.2,
    x2: 3.55,
    z2: -1.35,
    thickness: tInt,
    style: 'glazed'
  });
  walls.push(...splitAxisWallWithDoors('x', 3.55, -1.35, 0.85, tInt, [], 'glazed'));
  walls.push({
    type: 'diagonalDoor',
    x1: 3.55,
    z1: 0.85,
    x2: 5.0,
    z2: 3.0,
    thickness: tInt,
    sign: 'U304 • STUDIO AV 2'
  });

  return walls;
}

export function getStaticWallColliders(walls = buildPlateauWalls()) {
  const colliders = [];

  for (const seg of walls) {
    if (seg.type === 'plaque' || seg.style === 'lintel' || seg.type === 'diagonalDoor') {
      continue;
    }
    if (seg.type === 'diagonal') {
      const steps = 6;
      const dx = seg.x2 - seg.x1;
      const dz = seg.z2 - seg.z1;
      const pad = 0.22;
      for (let i = 0; i < steps; i++) {
        const t = (i + 0.5) / steps;
        const cx = seg.x1 + dx * t;
        const cz = seg.z1 + dz * t;
        colliders.push({
          minX: cx - pad,
          maxX: cx + pad,
          minZ: cz - pad,
          maxZ: cz + pad
        });
      }
      continue;
    }
    const halfT = seg.thickness / 2;
    if (seg.axis === 'z') {
      colliders.push({
        minX: seg.from,
        maxX: seg.to,
        minZ: seg.fixed - halfT,
        maxZ: seg.fixed + halfT
      });
    } else {
      colliders.push({
        minX: seg.fixed - halfT,
        maxX: seg.fixed + halfT,
        minZ: seg.from,
        maxZ: seg.to
      });
    }
  }

  colliders.push({ minX: -2.4, maxX: 1.81, minZ: -1.55, maxZ: 2.11 });
  colliders.push({ minX: -13.0, maxX: -7.7, minZ: 0.55, maxZ: 1.85 });
  colliders.push({ minX: 5.0, maxX: 13.0, minZ: 3.0, maxZ: 3.68 });

  return colliders;
}
