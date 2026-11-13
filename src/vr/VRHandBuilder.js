import * as THREE from 'three';

export function createHandSkinMaterials(rawSkin = {}) {
  const s = rawSkin && typeof rawSkin === 'object' ? rawSkin : {};
  const showcase = s.showcase && typeof s.showcase === 'object' ? s.showcase : null;
  const theme = showcase?.materialTheme || null;
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

  return {
    theme: 'standard',
    rgbCycle: false,
    cuffMat: new THREE.MeshStandardMaterial({ color: outfitColor, metalness: 0.2, roughness: 0.48 }),
    palmMat: new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.15, roughness: 0.62 }),
    fingerMat: new THREE.MeshStandardMaterial({
      color: s.outfitStyle === 'cyber' ? '#334155' : skinTone,
      metalness: 0.08,
      roughness: 0.64
    }),
    trimMat: new THREE.MeshStandardMaterial({
      color: outfitColor,
      emissive: outfitColor,
      emissiveIntensity: 0.65,
      roughness: 0.28
    }),
    padMat: new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.78 }),
    accentColor: outfitColor
  };
}

function createFingerChain({ lengthA, lengthB, radius, mats, usePadFinger = true }) {
  const basePivot = new THREE.Group();

  const knuckle = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.05, 8, 8),
    usePadFinger ? mats.trimMat : mats.fingerMat
  );
  basePivot.add(knuckle);

  const segA = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 1.75, radius * 1.65, lengthA),
    mats.fingerMat
  );
  segA.position.set(0, 0, -lengthA * 0.5);
  segA.castShadow = true;
  basePivot.add(segA);

  const midPivot = new THREE.Group();
  midPivot.position.set(0, 0, -lengthA);
  basePivot.add(midPivot);

  const midJoint = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.92, 8, 8),
    mats.fingerMat
  );
  midPivot.add(midJoint);

  const segB = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 1.55, radius * 1.48, lengthB),
    mats.fingerMat
  );
  segB.position.set(0, 0, -lengthB * 0.5);
  segB.castShadow = true;
  midPivot.add(segB);

  const tip = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 1.42, radius * 1.32, radius * 0.95),
    mats.trimMat
  );
  tip.position.set(0, -radius * 0.12, -lengthB - radius * 0.35);
  midPivot.add(tip);

  return { basePivot, midPivot, segA, segB, tip, knuckle, midJoint };
}

export function buildArticulatedVRHand({ handedness = 'right', skin = {} } = {}) {
  const isLeft = handedness === 'left';
  const mirror = isLeft ? -1 : 1;
  let mats = createHandSkinMaterials(skin);

  const root = new THREE.Group();
  const modelGroup = new THREE.Group();
  root.add(modelGroup);

  const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.036, 0.064), mats.cuffMat);
  cuff.position.set(0, -0.004, 0.034);
  cuff.castShadow = true;
  modelGroup.add(cuff);

  const cuffTrim = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.04, 0.012), mats.trimMat);
  cuffTrim.position.set(0, -0.004, 0.012);
  modelGroup.add(cuffTrim);

  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.026, 0.084), mats.palmMat);
  palm.position.set(0, -0.004, -0.042);
  palm.castShadow = true;
  modelGroup.add(palm);

  const dorsalPlate = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.009, 0.062), mats.cuffMat);
  dorsalPlate.position.set(0, 0.012, -0.04);
  modelGroup.add(dorsalPlate);

  const dorsalCore = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.006, 0.034), mats.trimMat);
  dorsalCore.position.set(0, 0.016, -0.042);
  modelGroup.add(dorsalCore);

  const palmGrip = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.008, 0.056), mats.padMat);
  palmGrip.position.set(0, -0.018, -0.046);
  modelGroup.add(palmGrip);

  const fingerSpecs = [
    { key: 'index', x: -0.028 * mirror, lenA: 0.036, lenB: 0.031, r: 0.0088 },
    { key: 'middle', x: -0.009 * mirror, lenA: 0.041, lenB: 0.034, r: 0.009 },
    { key: 'ring', x: 0.01 * mirror, lenA: 0.038, lenB: 0.031, r: 0.0086 },
    { key: 'pinky', x: 0.028 * mirror, lenA: 0.03, lenB: 0.025, r: 0.0076 }
  ];

  const fingers = {};
  for (const spec of fingerSpecs) {
    const chain = createFingerChain({
      lengthA: spec.lenA,
      lengthB: spec.lenB,
      radius: spec.r,
      mats
    });
    chain.basePivot.position.set(spec.x, -0.002, -0.084);
    modelGroup.add(chain.basePivot);
    fingers[spec.key] = chain;
  }

  const thumbMount = new THREE.Group();
  thumbMount.position.set(-0.042 * mirror, -0.008, -0.026);
  thumbMount.rotation.set(0.18, 0.65 * mirror, -0.42 * mirror);
  modelGroup.add(thumbMount);

  const thumbChain = createFingerChain({
    lengthA: 0.028,
    lengthB: 0.025,
    radius: 0.0095,
    mats
  });
  thumbMount.add(thumbChain.basePivot);
  fingers.thumb = thumbChain;

  let curTrigger = 0;
  let curGrip = 0;
  let curThumb = 0;

  const setPose = ({ trigger = 0, grip = 0, thumb = 0, elapsed = 0 } = {}) => {
    curTrigger += (Math.max(0, Math.min(1, Number(trigger) || 0)) - curTrigger) * 0.42;
    curGrip += (Math.max(0, Math.min(1, Number(grip) || 0)) - curGrip) * 0.42;
    curThumb += (Math.max(0, Math.min(1, Number(thumb) || 0)) - curThumb) * 0.42;

    fingers.index.basePivot.rotation.x = -curTrigger * 1.32 - 0.06;
    fingers.index.midPivot.rotation.x = -curTrigger * 1.18 - 0.08;

    const curlKeys = ['middle', 'ring', 'pinky'];
    curlKeys.forEach((k, idx) => {
      const extra = idx * 0.06;
      const ch = fingers[k];
      ch.basePivot.rotation.x = -(curGrip * (1.36 + extra) + 0.08);
      ch.midPivot.rotation.x = -(curGrip * (1.22 + extra) + 0.1);
    });

    fingers.thumb.basePivot.rotation.x = -(curThumb * 0.72 + 0.12);
    fingers.thumb.basePivot.rotation.y = curThumb * 0.42 * mirror;
    fingers.thumb.midPivot.rotation.x = -(curThumb * 0.92 + 0.1);

    if (mats.rgbCycle && mats.trimMat) {
      const h = (elapsed * 0.25) % 1;
      mats.trimMat.color.setHSL(h, 0.95, 0.58);
      mats.trimMat.emissive.setHSL(h, 0.95, 0.55);
    }
  };

  const applySkin = (nextSkin = {}) => {
    const oldMats = mats;
    mats = createHandSkinMaterials(nextSkin);
    cuff.material = mats.cuffMat;
    cuffTrim.material = mats.trimMat;
    palm.material = mats.palmMat;
    dorsalPlate.material = mats.cuffMat;
    dorsalCore.material = mats.trimMat;
    palmGrip.material = mats.padMat;
    for (const ch of Object.values(fingers)) {
      ch.knuckle.material = mats.trimMat;
      ch.segA.material = mats.fingerMat;
      ch.midJoint.material = mats.fingerMat;
      ch.segB.material = mats.fingerMat;
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

  setPose({ trigger: 0, grip: 0, thumb: 0, elapsed: 0 });

  return {
    root,
    modelGroup,
    fingers,
    handedness: isLeft ? 'left' : 'right',
    getAccentColor: () => mats.accentColor,
    setPose,
    applySkin,
    dispose
  };
}
