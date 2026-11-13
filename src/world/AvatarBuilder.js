import * as THREE from 'three';

export const SKIN_OPTIONS = {
  outfitColors: [
    { id: '#22d3ee', name: 'Cyan CIEL' },
    { id: '#10b981', name: 'Émeraude Cyber' },
    { id: '#f97316', name: 'Ambre Électro' },
    { id: '#a78bfa', name: 'Violet Réseau' },
    { id: '#f43f5e', name: 'Corail SOC' },
    { id: '#e2e8f0', name: 'Blanc Labo' }
  ],
  outfitStyles: [
    { id: 'blouse', name: 'Blouse Labo TP' },
    { id: 'hoodie', name: 'Sweat Tech' },
    { id: 'cyber', name: 'Veste Cyber' }
  ],
  hats: [
    { id: 'none', name: 'Cheveux simples' },
    { id: 'glasses', name: 'Lunettes Labo' },
    { id: 'cap', name: 'Casquette Tech' },
    { id: 'headset', name: 'Casque Audio' }
  ],
  skinTones: [
    { id: '#f7d5ba', name: 'Clair' },
    { id: '#f1c29b', name: 'Médium' },
    { id: '#d89b6c', name: 'Hâlé' },
    { id: '#8d5524', name: 'Foncé' }
  ],
  pantsColors: [
    { id: '#1e293b', name: 'Slate Sombre' },
    { id: '#1d4ed8', name: 'Jean Bleu' },
    { id: '#3f3f46', name: 'Cargo Gris' }
  ]
};

export const DEFAULT_SKIN = {
  outfitColor: '#22d3ee',
  outfitStyle: 'blouse',
  hat: 'glasses',
  skinTone: '#f1c29b',
  pantsColor: '#1e293b'
};

export function normalizeSkin(rawSkin = {}) {
  const s = rawSkin && typeof rawSkin === 'object' ? rawSkin : {};
  const hexOk = (v, fb) => (/^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? String(v) : fb);
  return {
    outfitColor: hexOk(s.outfitColor, DEFAULT_SKIN.outfitColor),
    outfitStyle: SKIN_OPTIONS.outfitStyles.some((o) => o.id === s.outfitStyle)
      ? s.outfitStyle
      : DEFAULT_SKIN.outfitStyle,
    hat: SKIN_OPTIONS.hats.some((h) => h.id === s.hat) ? s.hat : DEFAULT_SKIN.hat,
    skinTone: hexOk(s.skinTone, DEFAULT_SKIN.skinTone),
    pantsColor: hexOk(s.pantsColor, DEFAULT_SKIN.pantsColor)
  };
}

function createThemeMaterials(skin, showcase = null) {
  const theme = showcase?.materialTheme || null;
  if (theme === 'matrix') {
    return {
      torsoMat: new THREE.MeshStandardMaterial({ color: '#08100c', roughness: 0.82, metalness: 0.2 }),
      pantsMat: new THREE.MeshStandardMaterial({ color: '#050a07', roughness: 0.85, metalness: 0.15 }),
      shoeMat: new THREE.MeshStandardMaterial({ color: '#022c22', roughness: 0.5, emissive: '#16a34a', emissiveIntensity: 0.45 }),
      skinMat: new THREE.MeshStandardMaterial({ color: skin.skinTone, roughness: 0.72 }),
      hairMat: new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.8 }),
      trimMat: new THREE.MeshStandardMaterial({ color: '#22c55e', emissive: '#22c55e', emissiveIntensity: 1.85, roughness: 0.25 }),
      trimColor: '#22c55e'
    };
  }
  if (theme === 'gold24k') {
    return {
      torsoMat: new THREE.MeshStandardMaterial({ color: '#fbbf24', metalness: 0.9, roughness: 0.15, emissive: '#78350f', emissiveIntensity: 0.2 }),
      pantsMat: new THREE.MeshStandardMaterial({ color: '#1e1b4b', metalness: 0.45, roughness: 0.45 }),
      shoeMat: new THREE.MeshStandardMaterial({ color: '#fbbf24', metalness: 0.9, roughness: 0.15 }),
      skinMat: new THREE.MeshStandardMaterial({ color: skin.skinTone, roughness: 0.68 }),
      hairMat: new THREE.MeshStandardMaterial({ color: '#292524', roughness: 0.8 }),
      trimMat: new THREE.MeshStandardMaterial({ color: '#fef08a', metalness: 0.9, roughness: 0.15, emissive: '#f59e0b', emissiveIntensity: 1.2 }),
      trimColor: '#fde047'
    };
  }
  if (theme === 'chrome_rgb') {
    return {
      torsoMat: new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.92, roughness: 0.14 }),
      pantsMat: new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.6, roughness: 0.32 }),
      shoeMat: new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.8, roughness: 0.22 }),
      skinMat: new THREE.MeshStandardMaterial({ color: skin.skinTone, roughness: 0.7 }),
      hairMat: new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.75 }),
      trimMat: new THREE.MeshStandardMaterial({ color: '#22d3ee', emissive: '#22d3ee', emissiveIntensity: 1.7, roughness: 0.2 }),
      trimColor: '#22d3ee',
      rgbCycle: true
    };
  }
  if (theme === 'carbon_neon') {
    return {
      torsoMat: new THREE.MeshStandardMaterial({ color: '#111827', metalness: 0.72, roughness: 0.34 }),
      pantsMat: new THREE.MeshStandardMaterial({ color: '#090d16', metalness: 0.58, roughness: 0.4 }),
      shoeMat: new THREE.MeshStandardMaterial({ color: '#052e16', metalness: 0.6, roughness: 0.3, emissive: '#10b981', emissiveIntensity: 0.4 }),
      skinMat: new THREE.MeshStandardMaterial({ color: skin.skinTone, roughness: 0.7 }),
      hairMat: new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.8 }),
      trimMat: new THREE.MeshStandardMaterial({ color: '#22c55e', emissive: '#4ade80', emissiveIntensity: 1.85, roughness: 0.2 }),
      trimColor: '#4ade80'
    };
  }
  if (theme === 'diamond') {
    return {
      torsoMat: new THREE.MeshStandardMaterial({
        color: '#67e8f9',
        metalness: 0.78,
        roughness: 0.08,
        emissive: '#0891b2',
        emissiveIntensity: 0.65,
        flatShading: true
      }),
      pantsMat: new THREE.MeshStandardMaterial({
        color: '#22d3ee',
        metalness: 0.75,
        roughness: 0.1,
        emissive: '#0e7490',
        emissiveIntensity: 0.5,
        flatShading: true
      }),
      shoeMat: new THREE.MeshStandardMaterial({
        color: '#cffafe',
        metalness: 0.85,
        roughness: 0.1,
        emissive: '#22d3ee',
        emissiveIntensity: 0.65,
        flatShading: true
      }),
      skinMat: new THREE.MeshStandardMaterial({
        color: '#a5f3fc',
        metalness: 0.62,
        roughness: 0.12,
        emissive: '#06b6d4',
        emissiveIntensity: 0.35,
        flatShading: true
      }),
      hairMat: new THREE.MeshStandardMaterial({
        color: '#ecfeff',
        metalness: 0.88,
        roughness: 0.08,
        emissive: '#38bdf8',
        emissiveIntensity: 0.75,
        flatShading: true
      }),
      trimMat: new THREE.MeshStandardMaterial({
        color: '#e0f2fe',
        emissive: '#22d3ee',
        emissiveIntensity: 2.0,
        roughness: 0.1,
        flatShading: true
      }),
      trimColor: '#22d3ee'
    };
  }
  if (theme === 'cyber_gold') {
    return {
      torsoMat: new THREE.MeshStandardMaterial({ color: '#17153b', metalness: 0.75, roughness: 0.24, emissive: '#312e81', emissiveIntensity: 0.35 }),
      pantsMat: new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.55, roughness: 0.35 }),
      shoeMat: new THREE.MeshStandardMaterial({ color: '#fbbf24', metalness: 0.9, roughness: 0.15 }),
      skinMat: new THREE.MeshStandardMaterial({ color: skin.skinTone, roughness: 0.68 }),
      hairMat: new THREE.MeshStandardMaterial({ color: '#1e1b4b', roughness: 0.75 }),
      trimMat: new THREE.MeshStandardMaterial({ color: '#fbbf24', metalness: 0.9, roughness: 0.15, emissive: '#f59e0b', emissiveIntensity: 1.55 }),
      trimColor: '#fbbf24'
    };
  }
  return {
    torsoMat: new THREE.MeshStandardMaterial({ color: skin.outfitColor, roughness: 0.55 }),
    pantsMat: new THREE.MeshStandardMaterial({ color: skin.pantsColor, roughness: 0.72 }),
    shoeMat: new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.65 }),
    skinMat: new THREE.MeshStandardMaterial({ color: skin.skinTone, roughness: 0.72 }),
    hairMat: new THREE.MeshStandardMaterial({ color: '#292524', roughness: 0.85 }),
    trimMat: null,
    trimColor: skin.outfitColor
  };
}

export function buildStudentAvatarMesh(rawSkin = {}) {
  const skin = normalizeSkin(rawSkin);
  const showcase = rawSkin && typeof rawSkin === 'object' ? rawSkin.showcase || null : null;
  const accessories = new Set(Array.isArray(showcase?.accessories) ? showcase.accessories : []);
  const mats = createThemeMaterials(skin, showcase);
  const { torsoMat, pantsMat, shoeMat, skinMat, hairMat, trimMat } = mats;
  const group = new THREE.Group();
  const updaters = [];

  const makeLeg = (xOffset) => {
    const pivot = new THREE.Group();
    pivot.position.set(xOffset, 0.72, 0);
    const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.68, 0.18), pantsMat);
    legMesh.position.set(0, -0.34, 0);
    legMesh.castShadow = true;
    pivot.add(legMesh);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.25), shoeMat);
    shoe.position.set(0, -0.675, 0.03);
    pivot.add(shoe);
    if (trimMat) {
      const bootBand = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.025, 0.26), trimMat);
      bootBand.position.set(0, -0.625, 0.03);
      pivot.add(bootBand);
    }
    group.add(pivot);
    return pivot;
  };

  const leftLeg = makeLeg(-0.12);
  const rightLeg = makeLeg(0.12);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.68, 0.28), torsoMat);
  torso.position.y = 1.06;
  torso.castShadow = true;
  group.add(torso);

  if (trimMat) {
    [-0.19, 0.19].forEach((sx) => {
      const chestStripe = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.64, 0.305), trimMat);
      chestStripe.position.set(sx, 1.06, 0);
      group.add(chestStripe);
    });
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.055, 0.3), trimMat);
    belt.position.set(0, 0.75, 0);
    group.add(belt);
    const reactor = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), trimMat);
    reactor.position.set(0, 1.16, 0.155);
    group.add(reactor);

    if (showcase?.materialTheme === 'diamond' || showcase?.materialTheme === 'cyber_gold') {
      [-0.31, 0.31].forEach((px) => {
        const pauldron = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.14, 0),
          showcase.materialTheme === 'diamond' ? torsoMat : trimMat
        );
        pauldron.scale.set(1.15, 0.68, 1.25);
        pauldron.position.set(px, 1.38, 0);
        group.add(pauldron);
      });
    }
  } else if (skin.outfitStyle === 'blouse') {
    const lapel = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.62, 0.3),
      new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.6 })
    );
    lapel.position.set(0, 1.07, 0);
    group.add(lapel);
  } else if (skin.outfitStyle === 'hoodie') {
    const pocket = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.18, 0.04),
      new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.7 })
    );
    pocket.position.set(0, 0.9, 0.15);
    group.add(pocket);
  } else if (skin.outfitStyle === 'cyber') {
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.12, 0.04),
      new THREE.MeshBasicMaterial({ color: '#38bdf8' })
    );
    core.position.set(0, 1.15, 0.15);
    group.add(core);
  }

  if (mats.rgbCycle && trimMat) {
    updaters.push((t) => {
      const h = (t * 0.25) % 1;
      trimMat.color.setHSL(h, 0.95, 0.58);
      trimMat.emissive.setHSL(h, 0.95, 0.55);
    });
  }

  const makeArm = (xOffset) => {
    const pivot = new THREE.Group();
    pivot.position.set(xOffset, 1.34, 0);
    const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.54, 0.16), torsoMat);
    armMesh.position.set(0, -0.26, 0);
    armMesh.castShadow = true;
    pivot.add(armMesh);
    if (trimMat) {
      const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.04, 0.175), trimMat);
      cuff.position.set(0, -0.49, 0);
      pivot.add(cuff);
    }
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 0.14), skinMat);
    hand.position.set(0, -0.58, 0);
    pivot.add(hand);
    group.add(pivot);
    return pivot;
  };

  const leftArm = makeArm(-0.32);
  const rightArm = makeArm(0.32);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.34), skinMat);
  head.position.y = 1.59;
  head.castShadow = true;
  group.add(head);

  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.11, 0.36), hairMat);
  hair.position.set(0, 1.75, -0.01);
  group.add(hair);

  const eyeMat = new THREE.MeshBasicMaterial({ color: '#0f172a' });
  [-0.07, 0.07].forEach((ex) => {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), eyeMat);
    eye.position.set(ex, 1.61, 0.175);
    group.add(eye);
  });

  if (accessories.has('vr_gold')) {
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#fbbf24',
      metalness: 0.9,
      roughness: 0.15,
      emissive: '#78350f',
      emissiveIntensity: 0.2
    });
    const vrScreenMat = new THREE.MeshStandardMaterial({
      color: '#67e8f9',
      emissive: '#22d3ee',
      emissiveIntensity: 1.9,
      roughness: 0.12
    });
    const vrBody = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.15, 0.16), goldMat);
    vrBody.position.set(0, 1.62, 0.18);
    group.add(vrBody);
    const vrScreen = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.085, 0.02), vrScreenMat);
    vrScreen.position.set(0, 1.62, 0.258);
    group.add(vrScreen);
    const sideBand = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.055, 0.38), goldMat);
    sideBand.position.set(0, 1.63, -0.01);
    group.add(sideBand);
    const topStrap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.36), goldMat);
    topStrap.position.set(0, 1.72, -0.01);
    group.add(topStrap);
  } else if (accessories.has('cyber_visor')) {
    const visorColor = showcase?.visorColor || mats.trimColor || '#22d3ee';
    const frameMat = new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.85, roughness: 0.22 });
    const glowMat = new THREE.MeshStandardMaterial({
      color: visorColor,
      emissive: visorColor,
      emissiveIntensity: 2.1,
      roughness: 0.12
    });
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.095, 0.12), glowMat);
    visor.position.set(0, 1.615, 0.165);
    group.add(visor);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.032, 0.28), frameMat);
    bridge.position.set(0, 1.665, 0.07);
    group.add(bridge);
    [-0.195, 0.195].forEach((ax) => {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.11, 10), frameMat);
      pod.rotation.z = Math.PI / 2;
      pod.position.set(ax, 1.63, 0);
      group.add(pod);
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.24, 8), frameMat);
      ant.position.set(ax * 1.06, 1.77, -0.02);
      group.add(ant);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), glowMat);
      tip.position.set(ax * 1.06, 1.89, -0.02);
      group.add(tip);
    });
  } else if (skin.hat === 'glasses') {
    const gMat = new THREE.MeshStandardMaterial({ color: '#0284c7', metalness: 0.4 });
    [-0.075, 0.075].forEach((gx) => {
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.03), gMat);
      lens.position.set(gx, 1.61, 0.18);
      group.add(lens);
    });
  } else if (skin.hat === 'cap') {
    const capMat = new THREE.MeshStandardMaterial({ color: skin.outfitColor, roughness: 0.5 });
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.14, 0.37), capMat);
    crown.position.set(0, 1.77, 0);
    group.add(crown);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.2), capMat);
    visor.position.set(0, 1.72, 0.22);
    group.add(visor);
  } else if (skin.hat === 'headset') {
    const bandMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.4 });
    const earMat = new THREE.MeshStandardMaterial({ color: skin.outfitColor, roughness: 0.4 });
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.08), bandMat);
    band.position.set(0, 1.81, 0);
    group.add(band);
    [-0.2, 0.2].forEach((hx) => {
      const cup = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.16), earMat);
      cup.position.set(hx, 1.61, 0);
      group.add(cup);
    });
  }

  if (accessories.has('royal_crown')) {
    const crownGroup = new THREE.Group();
    crownGroup.position.set(0, 1.97, 0);
    const crownGold = new THREE.MeshStandardMaterial({
      color: '#fbbf24',
      metalness: 0.9,
      roughness: 0.15,
      emissive: '#b45309',
      emissiveIntensity: 0.35
    });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.19, 0.09, 8, 1, true), crownGold);
    band.material.side = THREE.DoubleSide;
    crownGroup.add(band);
    const gemColors = ['#f43f5e', '#22d3ee', '#10b981', '#a855f7', '#fb7185', '#38bdf8'];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const rx = Math.cos(a) * 0.2;
      const rz = Math.sin(a) * 0.2;
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.13, 4), crownGold);
      spire.position.set(rx, 0.1, rz);
      crownGroup.add(spire);
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.032, 0),
        new THREE.MeshStandardMaterial({
          color: gemColors[i],
          emissive: gemColors[i],
          emissiveIntensity: 1.9,
          roughness: 0.1
        })
      );
      gem.position.set(rx * 1.04, 0.17, rz * 1.04);
      crownGroup.add(gem);
    }
    group.add(crownGroup);
    updaters.push((t) => {
      crownGroup.position.y = 1.98 + Math.sin(t * 2.8) * 0.035;
      crownGroup.rotation.y = t * 1.1;
    });
  }

  if (accessories.has('gold_halo')) {
    const haloMat = new THREE.MeshStandardMaterial({
      color: '#fef08a',
      metalness: 0.9,
      roughness: 0.15,
      emissive: '#fbbf24',
      emissiveIntensity: 1.85
    });
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.028, 10, 32), haloMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.set(0, 1.98, 0);
    group.add(halo);
    updaters.push((t) => {
      halo.position.y = 1.98 + Math.sin(t * 2.5) * 0.03;
      halo.rotation.y = t * 0.8;
    });
  }

  if (accessories.has('jetpack_rgb')) {
    const packGroup = new THREE.Group();
    packGroup.position.set(0, 1.12, -0.21);
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.85, roughness: 0.22 });
    const rgbMat = new THREE.MeshStandardMaterial({
      color: '#22d3ee',
      emissive: '#22d3ee',
      emissiveIntensity: 2.0,
      roughness: 0.15
    });
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.14), bodyMat);
    packGroup.add(chassis);
    const flames = [];
    [-0.12, 0.12].forEach((tx) => {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.42, 12), bodyMat);
      tank.position.set(tx, -0.02, -0.03);
      packGroup.add(tank);
      const ledBar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.025), rgbMat);
      ledBar.position.set(tx, 0.02, -0.102);
      packGroup.add(ledBar);
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.08, 10), bodyMat);
      nozzle.position.set(tx, -0.26, -0.03);
      packGroup.add(nozzle);
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.055, 0.24, 10),
        new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.85 })
      );
      flame.rotation.x = Math.PI;
      flame.position.set(tx, -0.4, -0.03);
      packGroup.add(flame);
      flames.push(flame);
    });
    group.add(packGroup);
    updaters.push((t) => {
      const h = (t * 0.35) % 1;
      rgbMat.color.setHSL(h, 0.95, 0.6);
      rgbMat.emissive.setHSL(h, 0.95, 0.55);
      flames.forEach((f, idx) => {
        const s = 0.85 + Math.sin(t * 24 + idx * 2) * 0.22;
        f.scale.set(1, s, 1);
        f.material.color.setHSL((h + 0.12) % 1, 0.95, 0.65);
      });
    });
  }

  if (accessories.has('rtx_fans')) {
    const rtxGroup = new THREE.Group();
    rtxGroup.position.set(0, 1.12, -0.21);
    const shroudMat = new THREE.MeshStandardMaterial({ color: '#090d16', metalness: 0.85, roughness: 0.2 });
    const greenMat = new THREE.MeshStandardMaterial({
      color: '#4ade80',
      emissive: '#22c55e',
      emissiveIntensity: 2.0,
      roughness: 0.15
    });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.46, 0.12), shroudMat);
    rtxGroup.add(slab);
    const topStrip = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.13), greenMat);
    topStrip.position.set(0, 0.2, 0);
    rtxGroup.add(topStrip);
    const rotors = [];
    [0.1, -0.1].forEach((fy) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.015, 8, 20), greenMat);
      ring.position.set(0, fy, -0.068);
      rtxGroup.add(ring);
      const rotor = new THREE.Group();
      rotor.position.set(0, fy, -0.065);
      for (let b = 0; b < 3; b++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 0.012), greenMat);
        blade.rotation.z = (b / 3) * Math.PI;
        rotor.add(blade);
      }
      rtxGroup.add(rotor);
      rotors.push(rotor);
    });
    group.add(rtxGroup);
    updaters.push((t) => {
      rotors.forEach((r, idx) => {
        r.rotation.z = t * (idx === 0 ? 11 : -11);
      });
    });
  }

  if (accessories.has('vip_badge')) {
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#fbbf24',
      metalness: 0.9,
      roughness: 0.15,
      emissive: '#b45309',
      emissiveIntensity: 0.3
    });
    const ledMat = new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 2.0 });
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.03), goldMat);
    badge.position.set(-0.14, 1.22, 0.155);
    group.add(badge);
    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.036), ledMat);
    chip.position.set(-0.14, 1.24, 0.157);
    group.add(chip);
    const keyGroup = new THREE.Group();
    keyGroup.position.set(-0.56, 1.42, 0.12);
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.022, 8, 18), goldMat);
    keyGroup.add(bow);
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.22, 0.025), goldMat);
    shaft.position.set(0, -0.17, 0);
    keyGroup.add(shaft);
    const tooth1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, 0.025), goldMat);
    tooth1.position.set(0.04, -0.22, 0);
    keyGroup.add(tooth1);
    const tooth2 = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.025, 0.025), goldMat);
    tooth2.position.set(0.045, -0.265, 0);
    keyGroup.add(tooth2);
    group.add(keyGroup);
    updaters.push((t) => {
      keyGroup.position.y = 1.42 + Math.sin(t * 2.4) * 0.06;
      keyGroup.rotation.y = t * 1.4;
    });
  }

  if (accessories.has('cisco_drone')) {
    const drone = new THREE.Group();
    drone.position.set(0.58, 1.68, 0.08);
    const ciscoBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.11, 0.2),
      new THREE.MeshStandardMaterial({ color: '#0c4a6e', metalness: 0.72, roughness: 0.25 })
    );
    drone.add(ciscoBody);
    const leds = [];
    const ledColors = ['#22c55e', '#22d3ee', '#fbbf24', '#22c55e'];
    for (let i = 0; i < 4; i++) {
      const lMat = new THREE.MeshBasicMaterial({ color: ledColors[i] });
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.026, 0.02), lMat);
      led.position.set(-0.08 + i * 0.052, 0.015, 0.105);
      drone.add(led);
      leds.push(led);
    }
    const ant = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.01, 0.14, 6),
      new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.8 })
    );
    ant.position.set(0.09, 0.12, -0.05);
    drone.add(ant);
    const hoverGlow = new THREE.Mesh(
      new THREE.RingGeometry(0.06, 0.11, 16),
      new THREE.MeshBasicMaterial({ color: '#38bdf8', side: THREE.DoubleSide })
    );
    hoverGlow.rotation.x = Math.PI / 2;
    hoverGlow.position.set(0, -0.065, 0);
    drone.add(hoverGlow);
    group.add(drone);
    updaters.push((t) => {
      drone.position.x = 0.54 + Math.cos(t * 1.3) * 0.1;
      drone.position.y = 1.66 + Math.sin(t * 3.0) * 0.07;
      drone.position.z = 0.06 + Math.sin(t * 1.3) * 0.12;
      drone.rotation.y = Math.sin(t * 0.9) * 0.35;
      leds.forEach((led, idx) => {
        led.visible = Math.sin(t * 8 + idx * 1.7) > -0.25;
      });
    });
  }

  const particleKind = showcase?.particles || null;
  if (particleKind) {
    const pGroup = new THREE.Group();
    const specs = [];
    const count = 20;
    for (let i = 0; i < count; i++) {
      let geom;
      let color;
      if (particleKind === 'matrix') {
        geom = new THREE.BoxGeometry(0.042, 0.075, 0.042);
        color = i % 3 === 0 ? '#86efac' : '#22c55e';
      } else if (particleKind === 'lightning_cyan') {
        geom = new THREE.BoxGeometry(0.024, 0.15, 0.024);
        color = i % 2 === 0 ? '#67e8f9' : '#22d3ee';
      } else {
        geom = new THREE.OctahedronGeometry(0.036, 0);
        color = i % 2 === 0 ? '#fde047' : '#f59e0b';
      }
      const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color }));
      pGroup.add(mesh);
      specs.push({
        mesh,
        angle: (i / count) * Math.PI * 2,
        radius: 0.48 + (i % 4) * 0.1,
        speed: 0.9 + (i % 5) * 0.25,
        yBase: 0.25 + ((i * 0.37) % 1.65),
        tilt: (i % 2 === 0 ? 1 : -1) * 0.45
      });
    }
    group.add(pGroup);
    updaters.push((t) => {
      for (const s of specs) {
        const a = s.angle + t * s.speed;
        const y =
          particleKind === 'matrix'
            ? 2.05 - ((s.yBase + t * 0.55) % 1.95)
            : 0.2 + ((s.yBase + t * 0.4) % 1.85);
        s.mesh.position.set(Math.cos(a) * s.radius, y, Math.sin(a) * s.radius);
        if (particleKind === 'lightning_cyan') {
          s.mesh.rotation.set(s.tilt, a, s.tilt);
        } else {
          s.mesh.rotation.y = t * 2.2;
          s.mesh.rotation.x = t * 1.4;
        }
      }
    });
  }

  const updateEffects = (elapsed = 0) => {
    for (const fn of updaters) fn(elapsed);
  };
  updateEffects(0);

  return { group, leftLeg, rightLeg, leftArm, rightArm, updateEffects };
}

export function animateAvatarLimbs(avatar, dt, { isMoving, isGrounded = true, speedRatio = 1 }) {
  if (!avatar) return 0;
  let nextPhase = avatar._walkPhase || 0;
  if (!isGrounded) {
    avatar.leftLeg.rotation.x = 0.38;
    avatar.rightLeg.rotation.x = -0.28;
    if (avatar.leftArm) avatar.leftArm.rotation.x = -0.55;
    if (avatar.rightArm) avatar.rightArm.rotation.x = 0.42;
  } else if (isMoving) {
    nextPhase += dt * (10.5 * Math.max(0.6, Math.min(1.6, speedRatio)));
    const legAngle = Math.sin(nextPhase) * 0.52;
    const armAngle = Math.sin(nextPhase) * 0.44;
    avatar.leftLeg.rotation.x = legAngle;
    avatar.rightLeg.rotation.x = -legAngle;
    if (avatar.leftArm) avatar.leftArm.rotation.x = -armAngle;
    if (avatar.rightArm) avatar.rightArm.rotation.x = armAngle;
  } else {
    const damp = Math.exp(-14 * dt);
    avatar.leftLeg.rotation.x *= damp;
    avatar.rightLeg.rotation.x *= damp;
    if (avatar.leftArm) avatar.leftArm.rotation.x *= damp;
    if (avatar.rightArm) avatar.rightArm.rotation.x *= damp;
  }
  avatar._walkPhase = nextPhase;
  return nextPhase;
}

export function disposeObject3D(root, keepSet = null) {
  if (!root) return;
  root.traverse((obj) => {
    if (keepSet && keepSet.has(obj)) return;
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (m.map && !keepSet) m.map.dispose();
        m.dispose();
      }
    }
  });
}

export function renderSkinPreviewSvg(rawSkin = {}, size = 44) {
  const s = normalizeSkin(rawSkin);
  const styleMark =
    s.outfitStyle === 'blouse'
      ? `<rect x="28" y="34" width="8" height="24" rx="2" fill="#f8fafc"/>`
      : s.outfitStyle === 'hoodie'
        ? `<rect x="24" y="45" width="16" height="9" rx="2" fill="#0f172a"/>`
        : `<rect x="26" y="39" width="12" height="7" rx="2" fill="#38bdf8"/>`;

  const hatSvg =
    s.hat === 'glasses'
      ? `<rect x="23" y="19" width="8" height="4" rx="1" fill="#0284c7" stroke="#bae6fd" stroke-width="0.8"/>
         <rect x="33" y="19" width="8" height="4" rx="1" fill="#0284c7" stroke="#bae6fd" stroke-width="0.8"/>`
      : s.hat === 'cap'
        ? `<rect x="20" y="9" width="24" height="7" rx="3" fill="${s.outfitColor}"/>
           <rect x="21" y="14" width="25" height="3" rx="1" fill="${s.outfitColor}" opacity="0.9"/>`
        : s.hat === 'headset'
          ? `<path d="M19 23 C19 10, 45 10, 45 23" fill="none" stroke="#0f172a" stroke-width="3"/>
             <rect x="17" y="17" width="5" height="10" rx="2" fill="${s.outfitColor}"/>
             <rect x="42" y="17" width="5" height="10" rx="2" fill="${s.outfitColor}"/>`
          : '';

  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" class="skin-mini-svg" aria-hidden="true">
    <rect x="2" y="2" width="60" height="60" rx="14" fill="#0b1324" stroke="${s.outfitColor}" stroke-width="2"/>
    <rect x="22" y="54" width="9" height="7" rx="1" fill="${s.pantsColor}"/>
    <rect x="33" y="54" width="9" height="7" rx="1" fill="${s.pantsColor}"/>
    <rect x="15" y="34" width="7" height="18" rx="3" fill="${s.outfitColor}" opacity="0.9"/>
    <rect x="42" y="34" width="7" height="18" rx="3" fill="${s.outfitColor}" opacity="0.9"/>
    <circle cx="18.5" cy="53" r="3" fill="${s.skinTone}"/>
    <circle cx="45.5" cy="53" r="3" fill="${s.skinTone}"/>
    <rect x="21" y="33" width="22" height="23" rx="4" fill="${s.outfitColor}"/>
    ${styleMark}
    <rect x="22" y="13" width="20" height="19" rx="5" fill="${s.skinTone}"/>
    <rect x="21" y="11" width="22" height="6" rx="3" fill="#292524"/>
    <circle cx="27" cy="21" r="1.7" fill="#0f172a"/>
    <circle cx="37" cy="21" r="1.7" fill="#0f172a"/>
    ${hatSvg}
  </svg>`;
}

function drawVoiceWaveBadge(ctx, size, phase) {
  const cx = size / 2;
  const cy = size / 2;
  ctx.clearRect(0, 0, size, size);

  const pulse = 0.5 + 0.5 * Math.sin(phase * 2.2);
  const bgGrad = ctx.createRadialGradient(cx, cy, 8, cx, cy, 52);
  bgGrad.addColorStop(0, `rgba(16, 185, 129, ${0.42 + pulse * 0.25})`);
  bgGrad.addColorStop(0.65, 'rgba(6, 95, 70, 0.22)');
  bgGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = bgGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 56, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(6, 78, 59, 0.92)';
  ctx.beginPath();
  ctx.arc(cx - 4, cy, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#34d399';
  ctx.stroke();

  ctx.fillStyle = '#ecfdf5';
  ctx.beginPath();
  ctx.moveTo(cx - 15, cy - 6);
  ctx.lineTo(cx - 8, cy - 6);
  ctx.lineTo(cx + 1, cy - 13);
  ctx.lineTo(cx + 1, cy + 13);
  ctx.lineTo(cx - 8, cy + 6);
  ctx.lineTo(cx - 15, cy + 6);
  ctx.closePath();
  ctx.fill();

  for (let i = 0; i < 3; i++) {
    const waveAlpha = Math.max(0.18, Math.min(1, 0.35 + 0.65 * Math.sin(phase * 3.1 - i * 0.95)));
    ctx.strokeStyle = `rgba(52, 211, 153, ${waveAlpha.toFixed(2)})`;
    ctx.lineWidth = 4 - i * 0.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx + 3, cy, 12 + i * 10, -0.58, 0.58);
    ctx.stroke();
  }
}

export function createVoiceIndicatorSprite(yOffset = 2.78) {
  let tex = null;
  let canvas = null;
  let ctx = null;
  if (typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    ctx = canvas.getContext('2d');
    if (ctx) {
      drawVoiceWaveBadge(ctx, 128, 0);
      tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
    }
  }
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(0, yOffset, 0);
  sprite.scale.set(0.46, 0.46, 1);
  sprite.renderOrder = 8;
  sprite.visible = false;
  sprite.userData = {
    baseY: yOffset,
    phase: 0,
    redrawAccum: 0,
    canvas,
    ctx,
    tex
  };
  return sprite;
}

export function updateVoiceIndicatorSprite(sprite, dt, isSpeaking = false) {
  if (!sprite) return;
  const ud = sprite.userData;
  if (!ud) return;

  if (!isSpeaking) {
    if (sprite.visible) {
      sprite.visible = false;
      sprite.position.y = ud.baseY;
      sprite.scale.set(0.46, 0.46, 1);
    }
    return;
  }

  sprite.visible = true;
  ud.phase += dt * 4.2;
  ud.redrawAccum += dt;
  const s = 0.45 + 0.055 * Math.sin(ud.phase * 2.2);
  sprite.scale.set(s, s, 1);
  sprite.position.y = ud.baseY + Math.sin(ud.phase * 1.8) * 0.035;

  if (ud.ctx && ud.tex && ud.redrawAccum >= 0.09) {
    ud.redrawAccum = 0;
    drawVoiceWaveBadge(ud.ctx, ud.canvas.width, ud.phase);
    ud.tex.needsUpdate = true;
  }
}
