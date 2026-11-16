import * as THREE from 'three';

const DIVINE_HAND_PALETTES = {
  cyber: { armor: '#090d16', primary: '#f43f5e', secondary: '#22d3ee' },
  reseaux: { armor: '#082f49', primary: '#38bdf8', secondary: '#34d399' },
  electronique: { armor: '#1c1917', primary: '#fbbf24', secondary: '#f97316' },
  systemes: { armor: '#1e1b4b', primary: '#a855f7', secondary: '#10b981' },
  audiovisuel: { armor: '#2e0824', primary: '#ec4899', secondary: '#fde047' }
};

const FINGER_KEYS = ['thumb', 'index', 'middle', 'ring', 'pinky'];

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function resolveHandTheme(s) {
  const showcase = s.showcase && typeof s.showcase === 'object' ? s.showcase : null;
  if (showcase?.materialTheme) return showcase.materialTheme;
  if (s.style && s.style !== 'standard') return s.style;
  return null;
}

function isSecretHandSkin(s) {
  if (s.secretSkin) return true;
  const div = String(s.divineSpecialty || '').trim().toLowerCase();
  return ['architecte_supreme', 'secret', 'secret_ultime', 'ultimate', 'entite_quantique'].includes(div);
}

export function createHandSkinMaterials(rawSkin = {}) {
  const s = rawSkin && typeof rawSkin === 'object' ? rawSkin : {};
  const theme = resolveHandTheme(s);
  const outfitColor = /^#[0-9a-fA-F]{6}$/.test(String(s.outfitColor || '')) ? s.outfitColor : '#22d3ee';
  const skinTone = /^#[0-9a-fA-F]{6}$/.test(String(s.skinTone || '')) ? s.skinTone : '#f1c29b';

  if (theme === 'gold24k') {
    return {
      theme: 'gold24k',
      rgbCycle: false,
      cuffMat: new THREE.MeshStandardMaterial({ color: '#1e1b4b', metalness: 0.72, roughness: 0.3 }),
      palmMat: new THREE.MeshStandardMaterial({
        color: '#fbbf24',
        metalness: 0.92,
        roughness: 0.14,
        emissive: '#78350f',
        emissiveIntensity: 0.25
      }),
      fingerMat: new THREE.MeshStandardMaterial({
        color: '#fde047',
        metalness: 0.9,
        roughness: 0.16,
        emissive: '#92400e',
        emissiveIntensity: 0.2
      }),
      trimMat: new THREE.MeshStandardMaterial({
        color: '#fef08a',
        metalness: 0.92,
        roughness: 0.12,
        emissive: '#f59e0b',
        emissiveIntensity: 1.35
      }),
      padMat: new THREE.MeshStandardMaterial({ color: '#451a03', metalness: 0.35, roughness: 0.55 }),
      accentColor: '#fbbf24'
    };
  }

  if (theme === 'diamond') {
    return {
      theme: 'diamond',
      rgbCycle: false,
      cuffMat: new THREE.MeshStandardMaterial({
        color: '#0e7490',
        metalness: 0.8,
        roughness: 0.12,
        emissive: '#06b6d4',
        emissiveIntensity: 0.45,
        flatShading: true
      }),
      palmMat: new THREE.MeshStandardMaterial({
        color: '#67e8f9',
        metalness: 0.82,
        roughness: 0.08,
        emissive: '#0891b2',
        emissiveIntensity: 0.65,
        flatShading: true
      }),
      fingerMat: new THREE.MeshStandardMaterial({
        color: '#a5f3fc',
        metalness: 0.78,
        roughness: 0.08,
        emissive: '#06b6d4',
        emissiveIntensity: 0.5,
        flatShading: true
      }),
      trimMat: new THREE.MeshStandardMaterial({
        color: '#ecfeff',
        emissive: '#22d3ee',
        emissiveIntensity: 2.0,
        roughness: 0.08,
        flatShading: true
      }),
      padMat: new THREE.MeshStandardMaterial({
        color: '#155e75',
        metalness: 0.6,
        roughness: 0.18,
        flatShading: true
      }),
      accentColor: '#22d3ee'
    };
  }

  if (theme === 'matrix') {
    return {
      theme: 'matrix',
      rgbCycle: false,
      cuffMat: new THREE.MeshStandardMaterial({ color: '#050a07', metalness: 0.35, roughness: 0.68 }),
      palmMat: new THREE.MeshStandardMaterial({
        color: '#08100c',
        metalness: 0.25,
        roughness: 0.72,
        emissive: '#052e16',
        emissiveIntensity: 0.4
      }),
      fingerMat: new THREE.MeshStandardMaterial({
        color: '#0a1911',
        metalness: 0.28,
        roughness: 0.62,
        emissive: '#14532d',
        emissiveIntensity: 0.35
      }),
      trimMat: new THREE.MeshStandardMaterial({
        color: '#22c55e',
        emissive: '#22c55e',
        emissiveIntensity: 1.95,
        roughness: 0.22
      }),
      padMat: new THREE.MeshStandardMaterial({ color: '#022c22', roughness: 0.65 }),
      accentColor: '#22c55e'
    };
  }

  if (theme === 'carbon_neon') {
    return {
      theme: 'carbon_neon',
      rgbCycle: false,
      cuffMat: new THREE.MeshStandardMaterial({ color: '#090d16', metalness: 0.78, roughness: 0.28 }),
      palmMat: new THREE.MeshStandardMaterial({ color: '#111827', metalness: 0.72, roughness: 0.34 }),
      fingerMat: new THREE.MeshStandardMaterial({ color: '#1f2937', metalness: 0.68, roughness: 0.36 }),
      trimMat: new THREE.MeshStandardMaterial({
        color: '#4ade80',
        emissive: '#22c55e',
        emissiveIntensity: 1.9,
        roughness: 0.2
      }),
      padMat: new THREE.MeshStandardMaterial({ color: '#052e16', metalness: 0.45, roughness: 0.45 }),
      accentColor: '#4ade80'
    };
  }

  if (theme === 'chrome_rgb') {
    return {
      theme: 'chrome_rgb',
      rgbCycle: true,
      cuffMat: new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.85, roughness: 0.2 }),
      palmMat: new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.94, roughness: 0.12 }),
      fingerMat: new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.92, roughness: 0.14 }),
      trimMat: new THREE.MeshStandardMaterial({
        color: '#22d3ee',
        emissive: '#22d3ee',
        emissiveIntensity: 1.8,
        roughness: 0.18
      }),
      padMat: new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.6, roughness: 0.32 }),
      accentColor: '#22d3ee'
    };
  }

  if (theme === 'cyber_gold') {
    return {
      theme: 'cyber_gold',
      rgbCycle: false,
      cuffMat: new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.65, roughness: 0.28 }),
      palmMat: new THREE.MeshStandardMaterial({
        color: '#17153b',
        metalness: 0.76,
        roughness: 0.24,
        emissive: '#312e81',
        emissiveIntensity: 0.35
      }),
      fingerMat: new THREE.MeshStandardMaterial({ color: '#1e1b4b', metalness: 0.7, roughness: 0.26 }),
      trimMat: new THREE.MeshStandardMaterial({
        color: '#fbbf24',
        metalness: 0.9,
        roughness: 0.15,
        emissive: '#f59e0b',
        emissiveIntensity: 1.55
      }),
      padMat: new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.55 }),
      accentColor: '#fbbf24'
    };
  }

  if (isSecretHandSkin(s)) {
    return {
      theme: 'architecte_supreme',
      rgbCycle: true,
      cuffMat: new THREE.MeshStandardMaterial({
        color: '#050816',
        metalness: 0.94,
        roughness: 0.12,
        emissive: '#4c1d95',
        emissiveIntensity: 0.45
      }),
      palmMat: new THREE.MeshStandardMaterial({
        color: '#090d24',
        metalness: 0.9,
        roughness: 0.16,
        emissive: '#312e81',
        emissiveIntensity: 0.4
      }),
      fingerMat: new THREE.MeshStandardMaterial({
        color: '#141136',
        metalness: 0.84,
        roughness: 0.18,
        emissive: '#1e1b4b',
        emissiveIntensity: 0.3
      }),
      trimMat: new THREE.MeshStandardMaterial({
        color: '#c084fc',
        metalness: 0.95,
        roughness: 0.08,
        emissive: '#38bdf8',
        emissiveIntensity: 2.1
      }),
      padMat: new THREE.MeshStandardMaterial({ color: '#030612', metalness: 0.7, roughness: 0.35 }),
      accentColor: '#c084fc'
    };
  }

  if (s.divineSpecialty && DIVINE_HAND_PALETTES[s.divineSpecialty]) {
    const pal = DIVINE_HAND_PALETTES[s.divineSpecialty];
    return {
      theme: `divine_${s.divineSpecialty}`,
      rgbCycle: false,
      cuffMat: new THREE.MeshStandardMaterial({
        color: pal.armor,
        metalness: 0.86,
        roughness: 0.2,
        emissive: pal.primary,
        emissiveIntensity: 0.3
      }),
      palmMat: new THREE.MeshStandardMaterial({
        color: pal.armor,
        metalness: 0.82,
        roughness: 0.24,
        emissive: pal.secondary,
        emissiveIntensity: 0.22
      }),
      fingerMat: new THREE.MeshStandardMaterial({
        color: '#1e293b',
        metalness: 0.75,
        roughness: 0.28,
        emissive: pal.primary,
        emissiveIntensity: 0.16
      }),
      trimMat: new THREE.MeshStandardMaterial({
        color: pal.primary,
        metalness: 0.9,
        roughness: 0.12,
        emissive: pal.primary,
        emissiveIntensity: 1.85
      }),
      padMat: new THREE.MeshStandardMaterial({ color: '#090d16', metalness: 0.55, roughness: 0.45 }),
      accentColor: pal.primary
    };
  }

  return {
    theme: 'standard',
    rgbCycle: false,
    cuffMat: new THREE.MeshStandardMaterial({ color: outfitColor, metalness: 0.28, roughness: 0.42 }),
    palmMat: new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.22, roughness: 0.56 }),
    fingerMat: new THREE.MeshStandardMaterial({
      color: s.outfitStyle === 'cyber' ? '#334155' : skinTone,
      metalness: s.outfitStyle === 'cyber' ? 0.32 : 0.08,
      roughness: s.outfitStyle === 'cyber' ? 0.44 : 0.62
    }),
    trimMat: new THREE.MeshStandardMaterial({
      color: outfitColor,
      emissive: outfitColor,
      emissiveIntensity: 0.85,
      roughness: 0.25
    }),
    padMat: new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.72 }),
    accentColor: outfitColor
  };
}

function createFingerChain({ lengthA, lengthB, lengthC, radius, mats }) {
  const basePivot = new THREE.Group();

  const knuckle = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.12, 10, 10), mats.trimMat);
  basePivot.add(knuckle);

  const segA = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 1.82, radius * 1.66, lengthA),
    mats.fingerMat
  );
  segA.position.set(0, 0, -lengthA * 0.5);
  segA.castShadow = true;
  basePivot.add(segA);

  const midPivot = new THREE.Group();
  midPivot.position.set(0, 0, -lengthA);
  basePivot.add(midPivot);

  const midJoint = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.96, 10, 10), mats.fingerMat);
  midPivot.add(midJoint);

  const segB = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 1.62, radius * 1.5, lengthB),
    mats.fingerMat
  );
  segB.position.set(0, 0, -lengthB * 0.5);
  segB.castShadow = true;
  midPivot.add(segB);

  const distalPivot = new THREE.Group();
  distalPivot.position.set(0, 0, -lengthB);
  midPivot.add(distalPivot);

  const distalJoint = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.86, 8, 8), mats.fingerMat);
  distalPivot.add(distalJoint);

  const segC = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 1.44, radius * 1.34, lengthC),
    mats.fingerMat
  );
  segC.position.set(0, 0, -lengthC * 0.5);
  segC.castShadow = true;
  distalPivot.add(segC);

  const tip = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 1.36, radius * 1.18, radius * 0.9),
    mats.trimMat
  );
  tip.position.set(0, 0.001, -lengthC - radius * 0.25);
  distalPivot.add(tip);

  return {
    basePivot,
    midPivot,
    distalPivot,
    segA,
    segB,
    segC,
    tip,
    knuckle,
    midJoint,
    distalJoint
  };
}

export function buildArticulatedVRHand({ handedness = 'right', skin = {} } = {}) {
  const isLeft = handedness === 'left';
  const mirror = isLeft ? -1 : 1;
  let mats = createHandSkinMaterials(skin);

  const root = new THREE.Group();
  const modelGroup = new THREE.Group();
  root.add(modelGroup);

  const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.036, 0.072), mats.cuffMat);
  cuff.position.set(0, -0.004, 0.04);
  cuff.castShadow = true;
  modelGroup.add(cuff);

  const cuffTrim = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.042, 0.014), mats.trimMat);
  cuffTrim.position.set(0, -0.004, 0.012);
  modelGroup.add(cuffTrim);

  const wristBridge = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.024, 0.024), mats.padMat);
  wristBridge.position.set(0, -0.004, 0.0);
  modelGroup.add(wristBridge);

  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.026, 0.084), mats.palmMat);
  palm.position.set(0, -0.004, -0.044);
  palm.castShadow = true;
  modelGroup.add(palm);

  const dorsalPlate = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.01, 0.064), mats.cuffMat);
  dorsalPlate.position.set(0, 0.013, -0.042);
  modelGroup.add(dorsalPlate);

  const dorsalCore = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.006, 0.038), mats.trimMat);
  dorsalCore.position.set(0, 0.018, -0.044);
  modelGroup.add(dorsalCore);

  const dorsalStrips = [-0.022, 0.022].map((sx) => {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.005, 0.052), mats.trimMat);
    strip.position.set(sx, 0.017, -0.042);
    modelGroup.add(strip);
    return strip;
  });

  const palmGrip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.008, 0.058), mats.padMat);
  palmGrip.position.set(0, -0.018, -0.046);
  modelGroup.add(palmGrip);

  const fingerSpecs = [
    { key: 'index', x: -0.028 * mirror, splay: -0.07 * mirror, lenA: 0.032, lenB: 0.022, lenC: 0.016, r: 0.0086 },
    { key: 'middle', x: -0.009 * mirror, splay: -0.015 * mirror, lenA: 0.036, lenB: 0.025, lenC: 0.018, r: 0.0089 },
    { key: 'ring', x: 0.01 * mirror, splay: 0.035 * mirror, lenA: 0.034, lenB: 0.022, lenC: 0.017, r: 0.0084 },
    { key: 'pinky', x: 0.028 * mirror, splay: 0.09 * mirror, lenA: 0.027, lenB: 0.018, lenC: 0.014, r: 0.0074 }
  ];

  const fingers = {};
  for (const spec of fingerSpecs) {
    const chain = createFingerChain({
      lengthA: spec.lenA,
      lengthB: spec.lenB,
      lengthC: spec.lenC,
      radius: spec.r,
      mats
    });
    chain.basePivot.position.set(spec.x, -0.002, -0.086);
    chain.basePivot.rotation.y = spec.splay;
    modelGroup.add(chain.basePivot);
    fingers[spec.key] = chain;
  }

  const thumbMount = new THREE.Group();
  thumbMount.position.set(-0.043 * mirror, -0.009, -0.026);
  thumbMount.rotation.set(0.18, 0.68 * mirror, -0.44 * mirror);
  modelGroup.add(thumbMount);

  const thumbChain = createFingerChain({
    lengthA: 0.024,
    lengthB: 0.018,
    lengthC: 0.014,
    radius: 0.0092,
    mats
  });
  thumbMount.add(thumbChain.basePivot);
  fingers.thumb = thumbChain;

  const curFingers = {
    thumb: 0,
    index: 0,
    middle: 0,
    ring: 0,
    pinky: 0
  };

  const setPose = ({
    trigger = 0,
    grip = 0,
    thumb = 0,
    fingers: perFinger = null,
    dt = null,
    elapsed = 0,
    immediate = false
  } = {}) => {
    const tTrigger = clamp01(trigger);
    const tGrip = clamp01(grip);
    const tThumb = clamp01(thumb);
    const targets = {
      thumb: perFinger && perFinger.thumb !== undefined ? clamp01(perFinger.thumb) : tThumb,
      index: perFinger && perFinger.index !== undefined ? clamp01(perFinger.index) : tTrigger,
      middle: perFinger && perFinger.middle !== undefined ? clamp01(perFinger.middle) : tGrip,
      ring: perFinger && perFinger.ring !== undefined ? clamp01(perFinger.ring) : tGrip,
      pinky: perFinger && perFinger.pinky !== undefined ? clamp01(perFinger.pinky) : tGrip
    };

    const blend = immediate
      ? 1
      : typeof dt === 'number' && dt > 0
        ? Math.min(1, Math.max(0.42, 1 - Math.exp(-24 * dt)))
        : 0.42;

    for (const k of FINGER_KEYS) {
      curFingers[k] += (targets[k] - curFingers[k]) * blend;
    }

    fingers.index.basePivot.rotation.x = -(curFingers.index * 1.24 + 0.06);
    fingers.index.midPivot.rotation.x = -(curFingers.index * 1.18 + 0.08);
    fingers.index.distalPivot.rotation.x = -(curFingers.index * 0.92 + 0.05);

    ['middle', 'ring', 'pinky'].forEach((k, idx) => {
      const extra = idx * 0.05;
      const ch = fingers[k];
      const v = curFingers[k];
      ch.basePivot.rotation.x = -(v * (1.28 + extra) + 0.08);
      ch.midPivot.rotation.x = -(v * (1.22 + extra) + 0.1);
      ch.distalPivot.rotation.x = -(v * (0.95 + extra) + 0.06);
    });

    fingers.thumb.basePivot.rotation.x = -(curFingers.thumb * 0.68 + 0.1);
    fingers.thumb.basePivot.rotation.y = curFingers.thumb * 0.44 * mirror;
    fingers.thumb.midPivot.rotation.x = -(curFingers.thumb * 0.88 + 0.09);
    fingers.thumb.distalPivot.rotation.x = -(curFingers.thumb * 0.72 + 0.06);

    if (mats.rgbCycle && mats.trimMat) {
      const h = (elapsed * 0.25) % 1;
      mats.trimMat.color.setHSL(h, 0.95, 0.58);
      mats.trimMat.emissive.setHSL(h, 0.95, 0.55);
    }
  };

  const getPose = () => ({
    thumb: Math.round(curFingers.thumb * 1000) / 1000,
    index: Math.round(curFingers.index * 1000) / 1000,
    middle: Math.round(curFingers.middle * 1000) / 1000,
    ring: Math.round(curFingers.ring * 1000) / 1000,
    pinky: Math.round(curFingers.pinky * 1000) / 1000,
    trigger: Math.round(curFingers.index * 1000) / 1000,
    grip: Math.round(curFingers.middle * 1000) / 1000
  });

  const applySkin = (nextSkin = {}) => {
    const oldMats = mats;
    mats = createHandSkinMaterials(nextSkin);
    cuff.material = mats.cuffMat;
    cuffTrim.material = mats.trimMat;
    wristBridge.material = mats.padMat;
    palm.material = mats.palmMat;
    dorsalPlate.material = mats.cuffMat;
    dorsalCore.material = mats.trimMat;
    dorsalStrips.forEach((strip) => {
      strip.material = mats.trimMat;
    });
    palmGrip.material = mats.padMat;
    for (const ch of Object.values(fingers)) {
      ch.knuckle.material = mats.trimMat;
      ch.segA.material = mats.fingerMat;
      ch.midJoint.material = mats.fingerMat;
      ch.segB.material = mats.fingerMat;
      ch.distalJoint.material = mats.fingerMat;
      ch.segC.material = mats.fingerMat;
      ch.tip.material = mats.trimMat;
    }
    Object.values(oldMats).forEach((m) => m?.dispose?.());
  };

  const dispose = () => {
    modelGroup.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
    });
    Object.values(mats).forEach((m) => m?.dispose?.());
  };

  setPose({ trigger: 0, grip: 0, thumb: 0, elapsed: 0, immediate: true });

  return {
    root,
    modelGroup,
    fingers,
    handedness: isLeft ? 'left' : 'right',
    getAccentColor: () => mats.accentColor,
    getPose,
    setPose,
    applySkin,
    dispose
  };
}
