import * as THREE from 'three';
import {
  cloneShowcase,
  getBattlePassTierSpec,
  isBattlePassSkinId
} from '../core/battlePassSkins.js';
import { buildArticulatedVRHand } from '../vr/VRHandBuilder.js';

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

export const ASCENSION_SPECIALTIES = [
  {
    id: 'cyber',
    label: 'Cybersécurité & Pentest',
    shortLabel: 'Cyber',
    icon: '🛡️',
    primaryColor: '#f43f5e',
    secondaryColor: '#22d3ee',
    armorColor: '#090d16',
    pantsColor: '#050811',
    emissiveColor: '#f43f5e',
    crownColor: '#22d3ee',
    auraColor: '#f43f5e',
    aliases: ['cyber', 'antivirus', 'soc', 'pentest', 'cybersecurite']
  },
  {
    id: 'reseaux',
    label: 'Réseaux & Fibre Optique',
    shortLabel: 'Réseaux',
    icon: '🌐',
    primaryColor: '#38bdf8',
    secondaryColor: '#34d399',
    armorColor: '#082f49',
    pantsColor: '#041e30',
    emissiveColor: '#38bdf8',
    crownColor: '#34d399',
    auraColor: '#38bdf8',
    aliases: ['reseaux', 'reseau', 'vmvlan', 'patchrack', 'network', 'fibre']
  },
  {
    id: 'electronique',
    label: 'Électronique & Soudure',
    shortLabel: 'Électronique',
    icon: '⚡',
    primaryColor: '#fbbf24',
    secondaryColor: '#f97316',
    armorColor: '#1c1917',
    pantsColor: '#0f0d0c',
    emissiveColor: '#f59e0b',
    crownColor: '#fde047',
    auraColor: '#fbbf24',
    aliases: ['electronique', 'soldering', 'oscilloscope', 'electronics', 'soudure', 'brasure']
  },
  {
    id: 'systemes',
    label: 'Systèmes & Serveurs Linux',
    shortLabel: 'Systèmes',
    icon: '🖥️',
    primaryColor: '#a855f7',
    secondaryColor: '#10b981',
    armorColor: '#1e1b4b',
    pantsColor: '#0f0d26',
    emissiveColor: '#a855f7',
    crownColor: '#10b981',
    auraColor: '#a855f7',
    aliases: ['systemes', 'systeme', 'hardware', 'linux', 'serveurs']
  },
  {
    id: 'audiovisuel',
    label: 'Audiovisuel & Régie DMX',
    shortLabel: 'Audiovisuel',
    icon: '🎬',
    primaryColor: '#ec4899',
    secondaryColor: '#fde047',
    armorColor: '#2e0824',
    pantsColor: '#190414',
    emissiveColor: '#ec4899',
    crownColor: '#fde047',
    auraColor: '#ec4899',
    aliases: ['audiovisuel', 'audiovisual', 'studio', 'dmx', 'regie', 'son', 'video']
  }
];

export const ULTIMATE_SECRET_SKIN_ID = 'architecte_supreme';

export const ULTIMATE_SECRET_SKIN = {
  id: ULTIMATE_SECRET_SKIN_ID,
  label: 'Entité Quantique CIEL — Architecte Suprême',
  shortLabel: 'Entité Quantique',
  icon: '🌌',
  primaryColor: '#c084fc',
  secondaryColor: '#38bdf8',
  tertiaryColor: '#fde047',
  armorColor: '#050816',
  pantsColor: '#030612',
  emissiveColor: '#a855f7',
  crownColor: '#fde047',
  auraColor: '#38bdf8',
  isSecretUltimate: true,
  aliases: ['architecte_supreme', 'secret', 'secret_ultime', 'ultimate', 'entite_quantique']
};

export function isUltimateSecretSkinId(rawInput) {
  if (!rawInput) return false;
  const clean = String(rawInput || '')
    .trim()
    .toLowerCase()
    .replace(/^divine[_:-]/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return ULTIMATE_SECRET_SKIN.aliases.includes(clean);
}

export function resolveDivineOrSecretSkin(rawInput) {
  if (isUltimateSecretSkinId(rawInput)) return ULTIMATE_SECRET_SKIN;
  return resolveAscensionSpecialty(rawInput);
}

export function resolveAscensionSpecialty(rawInput) {
  if (!rawInput) return ASCENSION_SPECIALTIES[0];
  if (typeof rawInput === 'object' && rawInput.id) {
    return resolveAscensionSpecialty(rawInput.id);
  }
  const clean = String(rawInput || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  for (const spec of ASCENSION_SPECIALTIES) {
    if (spec.id === clean || spec.aliases.includes(clean)) {
      return spec;
    }
    const normLabel = spec.label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (clean && (normLabel.includes(clean) || clean.includes(spec.id))) {
      return spec;
    }
  }
  return ASCENSION_SPECIALTIES[0];
}

export function applyBattlePassSkin(baseSkin = {}, tierOrId = 7) {
  const normalized = normalizeSkin(baseSkin);
  const tierSpec = getBattlePassTierSpec(tierOrId);
  if (!tierSpec) return normalized;
  const out = {
    ...normalized,
    outfitColor: tierSpec.accentColor || '#fbbf24',
    outfitStyle: 'cyber',
    battlePassTier: tierSpec.tier,
    showcase: cloneShowcase(tierSpec.showcase)
  };
  delete out.divineSpecialty;
  delete out.secretSkin;
  return out;
}

export function applySessionDivineSkin(baseSkin = {}, specialtyInput = 'cyber') {
  const normalized = normalizeSkin(baseSkin);
  if (isUltimateSecretSkinId(specialtyInput)) {
    const out = {
      ...normalized,
      outfitColor: ULTIMATE_SECRET_SKIN.primaryColor,
      outfitStyle: 'cyber',
      divineSpecialty: null,
      secretSkin: true
    };
    delete out.battlePassTier;
    delete out.showcase;
    return out;
  }
  if (isBattlePassSkinId(specialtyInput)) {
    return applyBattlePassSkin(normalized, specialtyInput);
  }
  const spec = resolveAscensionSpecialty(specialtyInput);
  const out = {
    ...normalized,
    outfitColor: spec.primaryColor,
    outfitStyle: 'cyber',
    divineSpecialty: spec.id
  };
  delete out.secretSkin;
  delete out.battlePassTier;
  delete out.showcase;
  return out;
}

export function isCreatorLouis(rawName) {
  return (
    String(rawName || '')
      .trim()
      .toLowerCase()
      .replace(/#\d+$/, '') === 'louis'
  );
}

export function normalizeSkin(rawSkin = {}) {
  const s = rawSkin && typeof rawSkin === 'object' ? rawSkin : {};
  const hexOk = (v, fb) => (/^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? String(v) : fb);
  const out = {
    outfitColor: hexOk(s.outfitColor, DEFAULT_SKIN.outfitColor),
    outfitStyle: SKIN_OPTIONS.outfitStyles.some((o) => o.id === s.outfitStyle)
      ? s.outfitStyle
      : DEFAULT_SKIN.outfitStyle,
    hat: SKIN_OPTIONS.hats.some((h) => h.id === s.hat) ? s.hat : DEFAULT_SKIN.hat,
    skinTone: hexOk(s.skinTone, DEFAULT_SKIN.skinTone),
    pantsColor: hexOk(s.pantsColor, DEFAULT_SKIN.pantsColor)
  };
  if (s.creatorAura) {
    out.creatorAura = true;
  }
  if (s.secretSkin || isUltimateSecretSkinId(s.divineSpecialty)) {
    out.divineSpecialty = ULTIMATE_SECRET_SKIN_ID;
    out.secretSkin = true;
  } else if (s.divineSpecialty) {
    out.divineSpecialty = resolveAscensionSpecialty(s.divineSpecialty).id;
  } else {
    const bpSpec = getBattlePassTierSpec(s.battlePassTier ?? s.vipPassId);
    if (bpSpec) {
      out.battlePassTier = bpSpec.tier;
      out.showcase = cloneShowcase(bpSpec.showcase);
    } else if (s.showcase && typeof s.showcase === 'object') {
      const cleanShowcase = cloneShowcase(s.showcase);
      if (cleanShowcase) {
        out.showcase = cleanShowcase;
      }
    }
  }
  return out;
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
  if (skin.secretSkin || isUltimateSecretSkinId(skin.divineSpecialty)) {
    const uSpec = ULTIMATE_SECRET_SKIN;
    return {
      torsoMat: new THREE.MeshStandardMaterial({
        color: uSpec.armorColor,
        metalness: 0.94,
        roughness: 0.1,
        emissive: '#4c1d95',
        emissiveIntensity: 0.55
      }),
      pantsMat: new THREE.MeshStandardMaterial({
        color: uSpec.pantsColor,
        metalness: 0.85,
        roughness: 0.18,
        emissive: '#0e7490',
        emissiveIntensity: 0.35
      }),
      shoeMat: new THREE.MeshStandardMaterial({
        color: uSpec.secondaryColor,
        metalness: 0.92,
        roughness: 0.12,
        emissive: uSpec.primaryColor,
        emissiveIntensity: 0.75
      }),
      skinMat: new THREE.MeshStandardMaterial({
        color: skin.skinTone,
        roughness: 0.58,
        metalness: 0.15
      }),
      hairMat: new THREE.MeshStandardMaterial({
        color: '#f8fafc',
        metalness: 0.88,
        roughness: 0.12,
        emissive: uSpec.crownColor,
        emissiveIntensity: 0.65
      }),
      trimMat: new THREE.MeshStandardMaterial({
        color: uSpec.primaryColor,
        metalness: 0.95,
        roughness: 0.08,
        emissive: uSpec.secondaryColor,
        emissiveIntensity: 2.35
      }),
      trimColor: uSpec.primaryColor,
      rgbCycle: true,
      isSecretUltimate: true
    };
  }
  if (skin.divineSpecialty) {
    const spec = resolveAscensionSpecialty(skin.divineSpecialty);
    return {
      torsoMat: new THREE.MeshStandardMaterial({
        color: spec.armorColor,
        metalness: 0.86,
        roughness: 0.18,
        emissive: spec.primaryColor,
        emissiveIntensity: 0.38
      }),
      pantsMat: new THREE.MeshStandardMaterial({
        color: spec.pantsColor || '#090d16',
        metalness: 0.72,
        roughness: 0.25,
        emissive: spec.secondaryColor,
        emissiveIntensity: 0.22
      }),
      shoeMat: new THREE.MeshStandardMaterial({
        color: spec.primaryColor,
        metalness: 0.88,
        roughness: 0.15,
        emissive: spec.secondaryColor,
        emissiveIntensity: 0.55
      }),
      skinMat: new THREE.MeshStandardMaterial({ color: skin.skinTone, roughness: 0.68 }),
      hairMat: new THREE.MeshStandardMaterial({
        color: '#f8fafc',
        metalness: 0.75,
        roughness: 0.2,
        emissive: spec.crownColor,
        emissiveIntensity: 0.45
      }),
      trimMat: new THREE.MeshStandardMaterial({
        color: spec.primaryColor,
        metalness: 0.9,
        roughness: 0.12,
        emissive: spec.emissiveColor,
        emissiveIntensity: 2.1
      }),
      trimColor: spec.primaryColor,
      divineSpec: spec
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
  const showcase = skin.showcase || (rawSkin && typeof rawSkin === 'object' ? rawSkin.showcase || null : null);
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

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.58, 0);
  group.add(headGroup);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.34), skinMat);
  head.position.y = 0.01;
  head.castShadow = true;
  headGroup.add(head);

  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.11, 0.36), hairMat);
  hair.position.set(0, 0.17, -0.01);
  headGroup.add(hair);

  const eyeMat = new THREE.MeshBasicMaterial({ color: '#0f172a' });
  [-0.07, 0.07].forEach((ex) => {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), eyeMat);
    eye.position.set(ex, 0.03, 0.175);
    headGroup.add(eye);
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
    vrBody.position.set(0, 0.04, 0.18);
    headGroup.add(vrBody);
    const vrScreen = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.085, 0.02), vrScreenMat);
    vrScreen.position.set(0, 0.04, 0.258);
    headGroup.add(vrScreen);
    const sideBand = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.055, 0.38), goldMat);
    sideBand.position.set(0, 0.05, -0.01);
    headGroup.add(sideBand);
    const topStrap = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.36), goldMat);
    topStrap.position.set(0, 0.14, -0.01);
    headGroup.add(topStrap);
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
    visor.position.set(0, 0.035, 0.165);
    headGroup.add(visor);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.032, 0.28), frameMat);
    bridge.position.set(0, 0.085, 0.07);
    headGroup.add(bridge);
    [-0.195, 0.195].forEach((ax) => {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.11, 10), frameMat);
      pod.rotation.z = Math.PI / 2;
      pod.position.set(ax, 0.05, 0);
      headGroup.add(pod);
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.24, 8), frameMat);
      ant.position.set(ax * 1.06, 0.19, -0.02);
      headGroup.add(ant);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), glowMat);
      tip.position.set(ax * 1.06, 0.31, -0.02);
      headGroup.add(tip);
    });
  } else if (skin.hat === 'glasses') {
    const gMat = new THREE.MeshStandardMaterial({ color: '#0284c7', metalness: 0.4 });
    [-0.075, 0.075].forEach((gx) => {
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.03), gMat);
      lens.position.set(gx, 0.03, 0.18);
      headGroup.add(lens);
    });
  } else if (skin.hat === 'cap') {
    const capMat = new THREE.MeshStandardMaterial({ color: skin.outfitColor, roughness: 0.5 });
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.14, 0.37), capMat);
    crown.position.set(0, 0.19, 0);
    headGroup.add(crown);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.2), capMat);
    visor.position.set(0, 0.14, 0.22);
    headGroup.add(visor);
  } else if (skin.hat === 'headset') {
    const bandMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.4 });
    const earMat = new THREE.MeshStandardMaterial({ color: skin.outfitColor, roughness: 0.4 });
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.08), bandMat);
    band.position.set(0, 0.23, 0);
    headGroup.add(band);
    [-0.2, 0.2].forEach((hx) => {
      const cup = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.16), earMat);
      cup.position.set(hx, 0.03, 0);
      headGroup.add(cup);
    });
  }

  if (accessories.has('royal_crown')) {
    const crownGroup = new THREE.Group();
    crownGroup.position.set(0, 0.39, 0);
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
    headGroup.add(crownGroup);
    updaters.push((t) => {
      crownGroup.position.y = 0.4 + Math.sin(t * 2.8) * 0.035;
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
    halo.position.set(0, 0.4, 0);
    headGroup.add(halo);
    updaters.push((t) => {
      halo.position.y = 0.4 + Math.sin(t * 2.5) * 0.03;
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

  const creatorAuraGroup = new THREE.Group();
  creatorAuraGroup.name = 'creator-golden-aura';
  creatorAuraGroup.visible = Boolean(rawSkin?.creatorAura);
  group.add(creatorAuraGroup);

  const auraGoldMat = new THREE.MeshStandardMaterial({
    color: '#fde047',
    emissive: '#fbbf24',
    emissiveIntensity: 2.1,
    metalness: 0.9,
    roughness: 0.12
  });
  const auraGlowMat = new THREE.MeshBasicMaterial({
    color: '#fef08a',
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide
  });

  const baseRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.025, 10, 36), auraGoldMat);
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = 0.04;
  creatorAuraGroup.add(baseRing);

  const innerFloorDisc = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.56, 28), auraGlowMat);
  innerFloorDisc.rotation.x = -Math.PI / 2;
  innerFloorDisc.position.y = 0.025;
  creatorAuraGroup.add(innerFloorDisc);

  const risingRing = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.018, 10, 32), auraGoldMat);
  risingRing.rotation.x = Math.PI / 2;
  risingRing.position.y = 0.95;
  creatorAuraGroup.add(risingRing);

  const crownHalo = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.024, 10, 28), auraGoldMat);
  crownHalo.rotation.x = Math.PI / 2;
  crownHalo.position.y = 2.02;
  creatorAuraGroup.add(crownHalo);

  const auraMotes = [];
  const moteGeom = new THREE.OctahedronGeometry(0.038, 0);
  for (let i = 0; i < 18; i++) {
    const moteMat = new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? '#fde047' : '#fbbf24'
    });
    const mote = new THREE.Mesh(moteGeom, moteMat);
    creatorAuraGroup.add(mote);
    auraMotes.push({
      mesh: mote,
      angle: (i / 18) * Math.PI * 2,
      radius: 0.48 + (i % 3) * 0.11,
      speed: 1.5 + (i % 4) * 0.35,
      yOffset: (i / 18) * 1.85
    });
  }

  const auraLight = new THREE.PointLight('#fbbf24', 1.5, 4.8);
  auraLight.position.set(0, 1.15, 0);
  creatorAuraGroup.add(auraLight);

  updaters.push((t) => {
    if (!creatorAuraGroup.visible) return;
    baseRing.rotation.z = t * 1.2;
    const pulse = 1 + Math.sin(t * 3.8) * 0.07;
    baseRing.scale.set(pulse, pulse, 1);
    innerFloorDisc.rotation.z = -t * 0.9;
    risingRing.position.y = 1.0 + Math.sin(t * 2.2) * 0.45;
    risingRing.rotation.z = -t * 1.6;
    crownHalo.position.y = 2.02 + Math.sin(t * 3.0) * 0.04;
    crownHalo.rotation.z = t * 1.8;
    auraLight.intensity = 1.35 + Math.sin(t * 4.5) * 0.4;
    for (const m of auraMotes) {
      const a = m.angle + t * m.speed;
      const y = 0.18 + ((m.yOffset + t * 0.55) % 1.85);
      m.mesh.position.set(Math.cos(a) * m.radius, y, Math.sin(a) * m.radius);
      m.mesh.rotation.y = t * 2.6;
      m.mesh.rotation.x = t * 1.9;
    }
  });

  const setCreatorAura = (enabled) => {
    creatorAuraGroup.visible = Boolean(enabled);
  };
  const hasCreatorAura = () => Boolean(creatorAuraGroup.visible);

  let currentSecretActive = Boolean(
    skin.secretSkin || isUltimateSecretSkinId(skin.divineSpecialty)
  );
  let currentDivineSpec =
    !currentSecretActive && skin.divineSpecialty
      ? resolveAscensionSpecialty(skin.divineSpecialty)
      : null;

  const divineSkinGroup = new THREE.Group();
  divineSkinGroup.name = 'divine-ascension-skin';
  group.add(divineSkinGroup);

  const divineArmorGroup = new THREE.Group();
  divineArmorGroup.name = 'divine-holographic-armor';
  divineSkinGroup.add(divineArmorGroup);

  const divineAuraGroup = new THREE.Group();
  divineAuraGroup.name = 'divine-ascension-aura';
  divineSkinGroup.add(divineAuraGroup);

  const specialtyAccessoryGroup = new THREE.Group();
  specialtyAccessoryGroup.name = 'divine-specialty-accessories';
  divineSkinGroup.add(specialtyAccessoryGroup);

  const energyCrownGroup = new THREE.Group();
  energyCrownGroup.name = 'divine-energy-crown';
  energyCrownGroup.position.set(0, 0.42, 0);
  headGroup.add(energyCrownGroup);

  const divineVisorGroup = new THREE.Group();
  divineVisorGroup.name = 'divine-holo-visor';
  headGroup.add(divineVisorGroup);

  let divineDynamicState = null;

  const clearSubGroup = (grp) => {
    while (grp.children.length > 0) {
      const child = grp.children[0];
      grp.remove(child);
      disposeObject3D(child);
    }
  };

  const buildDivineVisuals = (spec) => {
    clearSubGroup(divineArmorGroup);
    clearSubGroup(divineAuraGroup);
    clearSubGroup(specialtyAccessoryGroup);
    clearSubGroup(energyCrownGroup);
    clearSubGroup(divineVisorGroup);
    divineDynamicState = null;

    if (!spec) {
      divineSkinGroup.visible = false;
      energyCrownGroup.visible = false;
      divineVisorGroup.visible = false;
      return;
    }

    divineSkinGroup.visible = true;
    energyCrownGroup.visible = true;
    divineVisorGroup.visible = true;

    torsoMat.color.set(spec.armorColor);
    torsoMat.metalness = 0.86;
    torsoMat.roughness = 0.18;
    torsoMat.emissive.set(spec.primaryColor);
    torsoMat.emissiveIntensity = 0.38;

    pantsMat.color.set(spec.pantsColor || '#090d16');
    pantsMat.metalness = 0.72;
    pantsMat.roughness = 0.24;
    pantsMat.emissive.set(spec.secondaryColor);
    pantsMat.emissiveIntensity = 0.22;

    shoeMat.color.set(spec.primaryColor);
    shoeMat.metalness = 0.88;
    shoeMat.roughness = 0.15;

    const primaryNeonMat = new THREE.MeshStandardMaterial({
      color: spec.primaryColor,
      emissive: spec.primaryColor,
      emissiveIntensity: 2.2,
      metalness: 0.88,
      roughness: 0.12
    });
    const secondaryNeonMat = new THREE.MeshStandardMaterial({
      color: spec.secondaryColor,
      emissive: spec.secondaryColor,
      emissiveIntensity: 2.1,
      metalness: 0.85,
      roughness: 0.14
    });
    const holoMat = new THREE.MeshBasicMaterial({
      color: spec.secondaryColor,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide
    });
    const goldDivineMat = new THREE.MeshStandardMaterial({
      color: '#fde047',
      emissive: '#fbbf24',
      emissiveIntensity: 2.0,
      metalness: 0.92,
      roughness: 0.1
    });

    const chestPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.51, 0.44, 0.31),
      new THREE.MeshStandardMaterial({
        color: spec.armorColor,
        metalness: 0.9,
        roughness: 0.15,
        emissive: spec.primaryColor,
        emissiveIntensity: 0.45
      })
    );
    chestPlate.position.set(0, 1.14, 0);
    divineArmorGroup.add(chestPlate);

    const chestCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.095, 0), secondaryNeonMat);
    chestCore.position.set(0, 1.15, 0.175);
    divineArmorGroup.add(chestCore);

    const coreRing = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.016, 8, 24), primaryNeonMat);
    coreRing.position.set(0, 1.15, 0.165);
    divineArmorGroup.add(coreRing);

    const pauldrons = [];
    [-0.32, 0.32].forEach((px, idx) => {
      const pGrp = new THREE.Group();
      pGrp.position.set(px, 1.38, 0);
      const mainPlate = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), primaryNeonMat);
      mainPlate.scale.set(1.2, 0.65, 1.3);
      pGrp.add(mainPlate);
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.26), secondaryNeonMat);
      fin.position.set(idx === 0 ? -0.09 : 0.09, 0.08, -0.02);
      fin.rotation.z = idx === 0 ? 0.38 : -0.38;
      pGrp.add(fin);
      divineArmorGroup.add(pGrp);
      pauldrons.push(pGrp);
    });

    const wings = [];
    [-1, 1].forEach((side) => {
      const wingGrp = new THREE.Group();
      wingGrp.position.set(side * 0.18, 1.24, -0.17);
      for (let w = 0; w < 3; w++) {
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.46 - w * 0.08, 0.075, 0.022),
          w % 2 === 0 ? primaryNeonMat : secondaryNeonMat
        );
        blade.position.set(side * (0.24 - w * 0.03), 0.12 - w * 0.13, -0.02 * w);
        blade.rotation.z = side * (0.36 - w * 0.18);
        wingGrp.add(blade);
      }
      divineArmorGroup.add(wingGrp);
      wings.push({ grp: wingGrp, side });
    });

    const visorShield = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.1, 0.14), secondaryNeonMat);
    visorShield.position.set(0, 0.04, 0.165);
    divineVisorGroup.add(visorShield);

    const crownRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.022, 10, 28), goldDivineMat);
    crownRing.rotation.x = Math.PI / 2;
    energyCrownGroup.add(crownRing);

    const innerCrownRing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.015, 8, 24), secondaryNeonMat);
    innerCrownRing.rotation.x = Math.PI / 2;
    innerCrownRing.position.y = 0.05;
    energyCrownGroup.add(innerCrownRing);

    const crownShards = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const shard = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.045, 0),
        i % 2 === 0 ? primaryNeonMat : secondaryNeonMat
      );
      shard.scale.set(0.75, 1.85, 0.75);
      shard.position.set(Math.cos(a) * 0.24, 0.08, Math.sin(a) * 0.24);
      energyCrownGroup.add(shard);
      crownShards.push({ mesh: shard, baseAngle: a, idx: i });
    }

    const outerFloorRing = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.026, 10, 40), primaryNeonMat);
    outerFloorRing.rotation.x = Math.PI / 2;
    outerFloorRing.position.y = 0.035;
    divineAuraGroup.add(outerFloorRing);

    const innerHexRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.62, 6), holoMat);
    innerHexRing.rotation.x = -Math.PI / 2;
    innerHexRing.position.y = 0.025;
    divineAuraGroup.add(innerHexRing);

    const orbitRingA = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.016, 8, 32), secondaryNeonMat);
    orbitRingA.position.y = 1.05;
    orbitRingA.rotation.x = 1.1;
    divineAuraGroup.add(orbitRingA);

    const orbitRingB = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.016, 8, 32), goldDivineMat);
    orbitRingB.position.y = 1.05;
    orbitRingB.rotation.y = 1.1;
    divineAuraGroup.add(orbitRingB);

    const divineMotes = [];
    const moteGeo = new THREE.OctahedronGeometry(0.042, 0);
    for (let i = 0; i < 20; i++) {
      const mMesh = new THREE.Mesh(
        moteGeo,
        i % 3 === 0 ? goldDivineMat : i % 2 === 0 ? primaryNeonMat : secondaryNeonMat
      );
      divineAuraGroup.add(mMesh);
      divineMotes.push({
        mesh: mMesh,
        angle: (i / 20) * Math.PI * 2,
        radius: 0.52 + (i % 4) * 0.1,
        speed: 1.7 + (i % 4) * 0.35,
        yBase: (i / 20) * 2.1
      });
    }

    const divineLight = new THREE.PointLight(spec.primaryColor, 1.9, 5.5);
    divineLight.position.set(0, 1.25, 0);
    divineAuraGroup.add(divineLight);

    const specialtyOrbiters = [];

    if (spec.id === 'cyber') {
      const shieldGrp = new THREE.Group();
      const hexShield = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.025, 6), holoMat);
      hexShield.rotation.x = Math.PI / 2;
      shieldGrp.add(hexShield);
      const shieldBorder = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.022, 8, 6), primaryNeonMat);
      shieldGrp.add(shieldBorder);
      const lockCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), goldDivineMat);
      shieldGrp.add(lockCore);
      specialtyAccessoryGroup.add(shieldGrp);
      specialtyOrbiters.push({ grp: shieldGrp, radius: 0.68, y: 1.22, speed: 1.6, phase: 0 });

      const pentestDrone = new THREE.Group();
      const droneCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), secondaryNeonMat);
      pentestDrone.add(droneCore);
      const scanCone = new THREE.Mesh(
        new THREE.ConeGeometry(0.14, 0.28, 8),
        new THREE.MeshBasicMaterial({ color: spec.primaryColor, transparent: true, opacity: 0.45 })
      );
      scanCone.position.y = -0.18;
      pentestDrone.add(scanCone);
      specialtyAccessoryGroup.add(pentestDrone);
      specialtyOrbiters.push({ grp: pentestDrone, radius: 0.68, y: 1.55, speed: 1.6, phase: Math.PI });
    } else if (spec.id === 'reseaux') {
      const switchDrone = new THREE.Group();
      const chassis = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.11, 0.22),
        new THREE.MeshStandardMaterial({ color: '#082f49', metalness: 0.85, roughness: 0.2 })
      );
      switchDrone.add(chassis);
      for (let p = 0; p < 5; p++) {
        const portLed = new THREE.Mesh(
          new THREE.BoxGeometry(0.035, 0.028, 0.02),
          p % 2 === 0 ? secondaryNeonMat : goldDivineMat
        );
        portLed.position.set(-0.1 + p * 0.05, 0.015, 0.115);
        switchDrone.add(portLed);
      }
      specialtyAccessoryGroup.add(switchDrone);
      specialtyOrbiters.push({ grp: switchDrone, radius: 0.66, y: 1.48, speed: 1.45, phase: 0 });

      const fiberNode = new THREE.Group();
      const fiberRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 8, 24), primaryNeonMat);
      fiberNode.add(fiberRing);
      const packetSphere = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 12), secondaryNeonMat);
      fiberNode.add(packetSphere);
      specialtyAccessoryGroup.add(fiberNode);
      specialtyOrbiters.push({ grp: fiberNode, radius: 0.66, y: 1.15, speed: 1.45, phase: Math.PI });
    } else if (spec.id === 'electronique') {
      [-0.22, 0.22].forEach((tx) => {
        const coilGrp = new THREE.Group();
        coilGrp.position.set(tx, 1.38, -0.22);
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.048, 0.42, 12), goldDivineMat);
        coilGrp.add(shaft);
        for (let r = 0; r < 3; r++) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075 - r * 0.01, 0.014, 8, 18), primaryNeonMat);
          ring.rotation.x = Math.PI / 2;
          ring.position.y = -0.08 + r * 0.11;
          coilGrp.add(ring);
        }
        const spark = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), secondaryNeonMat);
        spark.position.y = 0.26;
        coilGrp.add(spark);
        specialtyAccessoryGroup.add(coilGrp);
      });

      const solderRelic = new THREE.Group();
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.24, 10), goldDivineMat);
      solderRelic.add(handle);
      const hotTip = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.14, 10), secondaryNeonMat);
      hotTip.position.y = 0.19;
      solderRelic.add(hotTip);
      specialtyAccessoryGroup.add(solderRelic);
      specialtyOrbiters.push({ grp: solderRelic, radius: 0.66, y: 1.36, speed: 1.7, phase: 0 });
    } else if (spec.id === 'audiovisuel') {
      const eqPack = new THREE.Group();
      eqPack.position.set(0, 1.16, -0.21);
      const eqFrame = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.36, 0.1),
        new THREE.MeshStandardMaterial({ color: '#2e0824', metalness: 0.85, roughness: 0.2 })
      );
      eqPack.add(eqFrame);
      for (let b = 0; b < 5; b++) {
        const bar = new THREE.Mesh(
          new THREE.BoxGeometry(0.042, 0.16 + (b % 3) * 0.06, 0.03),
          b % 2 === 0 ? primaryNeonMat : secondaryNeonMat
        );
        bar.position.set(-0.13 + b * 0.065, 0, -0.06);
        eqPack.add(bar);
      }
      specialtyAccessoryGroup.add(eqPack);

      [-1, 1].forEach((side, idx) => {
        const spotDrone = new THREE.Group();
        const yoke = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.016, 8, 20), goldDivineMat);
        spotDrone.add(yoke);
        const lamp = new THREE.Mesh(
          new THREE.CylinderGeometry(0.065, 0.08, 0.16, 12),
          new THREE.MeshStandardMaterial({ color: '#1f0718', metalness: 0.88, roughness: 0.18 })
        );
        lamp.rotation.x = Math.PI / 2;
        spotDrone.add(lamp);
        const lens = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), idx === 0 ? primaryNeonMat : secondaryNeonMat);
        lens.position.z = 0.08;
        spotDrone.add(lens);
        const beamCone = new THREE.Mesh(
          new THREE.ConeGeometry(0.16, 0.36, 12, 1, true),
          new THREE.MeshBasicMaterial({
            color: idx === 0 ? spec.primaryColor : spec.secondaryColor,
            transparent: true,
            opacity: 0.32,
            side: THREE.DoubleSide
          })
        );
        beamCone.rotation.x = -Math.PI / 2;
        beamCone.position.z = 0.26;
        spotDrone.add(beamCone);
        specialtyAccessoryGroup.add(spotDrone);
        specialtyOrbiters.push({
          grp: spotDrone,
          radius: 0.68,
          y: 1.48 - idx * 0.14,
          speed: 1.5,
          phase: side < 0 ? 0 : Math.PI
        });
      });
    } else {
      const rackPack = new THREE.Group();
      rackPack.position.set(0, 1.16, -0.21);
      for (let b = 0; b < 3; b++) {
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.38, 0.11, 0.12),
          new THREE.MeshStandardMaterial({ color: '#1e1b4b', metalness: 0.85, roughness: 0.2 })
        );
        blade.position.y = -0.14 + b * 0.14;
        rackPack.add(blade);
        const strip = new THREE.Mesh(
          new THREE.BoxGeometry(0.34, 0.025, 0.02),
          b % 2 === 0 ? secondaryNeonMat : primaryNeonMat
        );
        strip.position.set(0, -0.14 + b * 0.14, -0.065);
        rackPack.add(strip);
      }
      specialtyAccessoryGroup.add(rackPack);

      const kernelCube = new THREE.Group();
      const outerCube = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.18, 0.18),
        new THREE.MeshBasicMaterial({ color: spec.secondaryColor, wireframe: true })
      );
      kernelCube.add(outerCube);
      const innerCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), primaryNeonMat);
      kernelCube.add(innerCore);
      specialtyAccessoryGroup.add(kernelCube);
      specialtyOrbiters.push({ grp: kernelCube, radius: 0.68, y: 1.42, speed: 1.55, phase: 0 });
    }

    divineDynamicState = {
      chestCore,
      coreRing,
      pauldrons,
      wings,
      crownRing,
      innerCrownRing,
      crownShards,
      outerFloorRing,
      innerHexRing,
      orbitRingA,
      orbitRingB,
      divineMotes,
      divineLight,
      specialtyOrbiters
    };
  };

  buildDivineVisuals(currentDivineSpec);

  const secretSkinGroup = new THREE.Group();
  secretSkinGroup.name = 'secret-ultimate-skin';
  group.add(secretSkinGroup);

  const cosmicArmorGroup = new THREE.Group();
  cosmicArmorGroup.name = 'secret-cosmic-armor';
  secretSkinGroup.add(cosmicArmorGroup);

  const cosmicWingsGroup = new THREE.Group();
  cosmicWingsGroup.name = 'secret-holographic-wings';
  secretSkinGroup.add(cosmicWingsGroup);

  const quantumRingsGroup = new THREE.Group();
  quantumRingsGroup.name = 'secret-quantum-orbital-rings';
  secretSkinGroup.add(quantumRingsGroup);

  const particleTrailGroup = new THREE.Group();
  particleTrailGroup.name = 'secret-cosmic-particle-trail';
  secretSkinGroup.add(particleTrailGroup);

  const cosmicHaloGroup = new THREE.Group();
  cosmicHaloGroup.name = 'secret-celestial-halo';
  cosmicHaloGroup.position.set(0, 0.44, 0);
  headGroup.add(cosmicHaloGroup);

  const cosmicVisorGroup = new THREE.Group();
  cosmicVisorGroup.name = 'secret-quantum-visor';
  headGroup.add(cosmicVisorGroup);

  let secretDynamicState = null;

  const buildSecretUltimateVisuals = (enabled) => {
    clearSubGroup(cosmicArmorGroup);
    clearSubGroup(cosmicWingsGroup);
    clearSubGroup(quantumRingsGroup);
    clearSubGroup(particleTrailGroup);
    clearSubGroup(cosmicHaloGroup);
    clearSubGroup(cosmicVisorGroup);
    secretDynamicState = null;

    if (!enabled) {
      secretSkinGroup.visible = false;
      cosmicHaloGroup.visible = false;
      cosmicVisorGroup.visible = false;
      return;
    }

    secretSkinGroup.visible = true;
    cosmicHaloGroup.visible = true;
    cosmicVisorGroup.visible = true;

    const uSpec = ULTIMATE_SECRET_SKIN;
    torsoMat.color.set(uSpec.armorColor);
    torsoMat.metalness = 0.94;
    torsoMat.roughness = 0.1;
    torsoMat.emissive.set('#4c1d95');
    torsoMat.emissiveIntensity = 0.55;

    pantsMat.color.set(uSpec.pantsColor);
    pantsMat.metalness = 0.85;
    pantsMat.roughness = 0.18;
    pantsMat.emissive.set('#0e7490');
    pantsMat.emissiveIntensity = 0.35;

    shoeMat.color.set(uSpec.secondaryColor);
    shoeMat.metalness = 0.92;
    shoeMat.roughness = 0.12;

    const prismMatA = new THREE.MeshStandardMaterial({
      color: '#c084fc',
      emissive: '#a855f7',
      emissiveIntensity: 2.3,
      metalness: 0.92,
      roughness: 0.08
    });
    const prismMatB = new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      emissive: '#22d3ee',
      emissiveIntensity: 2.3,
      metalness: 0.92,
      roughness: 0.08
    });
    const celestialGoldMat = new THREE.MeshStandardMaterial({
      color: '#fde047',
      emissive: '#fbbf24',
      emissiveIntensity: 2.1,
      metalness: 0.95,
      roughness: 0.08
    });
    const holoWingMat = new THREE.MeshBasicMaterial({
      color: '#e879f9',
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide
    });
    const holoWingInnerMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.62,
      side: THREE.DoubleSide
    });

    const cosmicChest = new THREE.Mesh(
      new THREE.BoxGeometry(0.53, 0.46, 0.32),
      new THREE.MeshStandardMaterial({
        color: '#070b1e',
        metalness: 0.95,
        roughness: 0.08,
        emissive: '#6d28d9',
        emissiveIntensity: 0.55
      })
    );
    cosmicChest.position.set(0, 1.13, 0);
    cosmicArmorGroup.add(cosmicChest);

    const starCoreOuter = new THREE.Mesh(new THREE.IcosahedronGeometry(0.105, 0), prismMatB);
    starCoreOuter.position.set(0, 1.15, 0.185);
    cosmicArmorGroup.add(starCoreOuter);

    const starCoreInner = new THREE.Mesh(new THREE.OctahedronGeometry(0.068, 0), celestialGoldMat);
    starCoreInner.position.set(0, 1.15, 0.185);
    cosmicArmorGroup.add(starCoreInner);

    const chestOrbitRing = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.015, 8, 28), prismMatA);
    chestOrbitRing.position.set(0, 1.15, 0.175);
    cosmicArmorGroup.add(chestOrbitRing);

    const cosmicPauldrons = [];
    [-0.34, 0.34].forEach((px, idx) => {
      const pGrp = new THREE.Group();
      pGrp.position.set(px, 1.4, 0);
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), idx === 0 ? prismMatA : prismMatB);
      crystal.scale.set(1.25, 0.72, 1.32);
      pGrp.add(crystal);
      const wingSpire = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.28, 4), celestialGoldMat);
      wingSpire.position.set(idx === 0 ? -0.1 : 0.1, 0.14, 0);
      wingSpire.rotation.z = idx === 0 ? 0.55 : -0.55;
      pGrp.add(wingSpire);
      cosmicArmorGroup.add(pGrp);
      cosmicPauldrons.push(pGrp);
    });

    const cosmicWings = [];
    [-1, 1].forEach((side) => {
      const wingGrp = new THREE.Group();
      wingGrp.position.set(side * 0.17, 1.26, -0.18);
      for (let w = 0; w < 5; w++) {
        const bladeLen = 0.64 - w * 0.085;
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(bladeLen, 0.085, 0.022),
          w % 2 === 0 ? holoWingMat : holoWingInnerMat
        );
        blade.position.set(side * (0.28 + w * 0.01), 0.24 - w * 0.14, -0.025 * w);
        blade.rotation.z = side * (0.52 - w * 0.22);
        wingGrp.add(blade);

        const edgeTip = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.036, 0),
          w % 2 === 0 ? celestialGoldMat : prismMatB
        );
        edgeTip.position.set(
          side * (0.28 + bladeLen * 0.48),
          0.24 - w * 0.14 + Math.sin(0.52 - w * 0.22) * bladeLen * 0.4,
          -0.025 * w
        );
        wingGrp.add(edgeTip);
      }
      cosmicWingsGroup.add(wingGrp);
      cosmicWings.push({ grp: wingGrp, side });
    });

    const quantumVisor = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.105, 0.15), prismMatB);
    quantumVisor.position.set(0, 0.04, 0.165);
    cosmicVisorGroup.add(quantumVisor);

    const visorAccent = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.026, 0.16), celestialGoldMat);
    visorAccent.position.set(0, 0.095, 0.16);
    cosmicVisorGroup.add(visorAccent);

    const haloOuter = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.022, 10, 36), prismMatA);
    haloOuter.rotation.x = Math.PI / 2;
    cosmicHaloGroup.add(haloOuter);

    const haloInner = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.016, 8, 28), celestialGoldMat);
    haloInner.rotation.x = Math.PI / 2;
    haloInner.position.y = 0.06;
    cosmicHaloGroup.add(haloInner);

    const haloShards = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const shard = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.046, 0),
        i % 3 === 0 ? celestialGoldMat : i % 2 === 0 ? prismMatA : prismMatB
      );
      shard.scale.set(0.7, 1.9, 0.7);
      shard.position.set(Math.cos(a) * 0.29, 0.09, Math.sin(a) * 0.29);
      cosmicHaloGroup.add(shard);
      haloShards.push({ mesh: shard, baseAngle: a, idx: i });
    }

    const floorAstrolabe = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.026, 10, 48), prismMatA);
    floorAstrolabe.rotation.x = Math.PI / 2;
    floorAstrolabe.position.y = 0.035;
    quantumRingsGroup.add(floorAstrolabe);

    const floorRuneHex = new THREE.Mesh(
      new THREE.RingGeometry(0.48, 0.7, 6),
      new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide
      })
    );
    floorRuneHex.rotation.x = -Math.PI / 2;
    floorRuneHex.position.y = 0.024;
    secretSkinGroup.add(floorRuneHex);

    const gyroRing1 = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.018, 10, 40), prismMatB);
    gyroRing1.position.y = 1.12;
    quantumRingsGroup.add(gyroRing1);

    const gyroRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.018, 10, 40), prismMatA);
    gyroRing2.position.y = 1.12;
    quantumRingsGroup.add(gyroRing2);

    const gyroRing3 = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.015, 8, 36), celestialGoldMat);
    gyroRing3.position.y = 1.12;
    quantumRingsGroup.add(gyroRing3);

    const quantumSatellites = [];
    for (let s = 0; s < 6; s++) {
      const sat = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.065, 0),
        s % 3 === 0 ? celestialGoldMat : s % 2 === 0 ? prismMatA : prismMatB
      );
      secretSkinGroup.add(sat);
      quantumSatellites.push({
        mesh: sat,
        phase: (s / 6) * Math.PI * 2,
        radius: 0.74 + (s % 2) * 0.1,
        speed: 1.85 + (s % 3) * 0.35,
        yBase: 0.85 + (s % 3) * 0.32
      });
    }

    const trailParticles = [];
    const trailGeom = new THREE.OctahedronGeometry(0.038, 0);
    for (let p = 0; p < 36; p++) {
      const pMat = new THREE.MeshBasicMaterial({
        color: p % 3 === 0 ? '#fde047' : p % 2 === 0 ? '#e879f9' : '#38bdf8',
        transparent: true,
        opacity: 0.85
      });
      const pMesh = new THREE.Mesh(trailGeom, pMat);
      particleTrailGroup.add(pMesh);
      trailParticles.push({
        mesh: pMesh,
        idx: p,
        phase: (p / 36) * Math.PI * 2,
        radius: 0.35 + (p % 5) * 0.11,
        speed: 2.1 + (p % 4) * 0.45,
        yOffset: (p / 36) * 2.15
      });
    }

    const cosmicLight = new THREE.PointLight('#c084fc', 2.4, 7.0);
    cosmicLight.position.set(0, 1.35, 0);
    secretSkinGroup.add(cosmicLight);

    secretDynamicState = {
      prismMatA,
      prismMatB,
      holoWingMat,
      holoWingInnerMat,
      starCoreOuter,
      starCoreInner,
      chestOrbitRing,
      cosmicPauldrons,
      cosmicWings,
      haloOuter,
      haloInner,
      haloShards,
      floorAstrolabe,
      floorRuneHex,
      gyroRing1,
      gyroRing2,
      gyroRing3,
      quantumSatellites,
      trailParticles,
      cosmicLight
    };
  };

  buildSecretUltimateVisuals(currentSecretActive);

  updaters.push((t) => {
    if (!divineDynamicState || !divineSkinGroup.visible) return;
    const st = divineDynamicState;
    st.chestCore.rotation.y = t * 2.4;
    st.chestCore.rotation.x = t * 1.5;
    st.coreRing.rotation.z = -t * 1.8;

    st.pauldrons.forEach((p, idx) => {
      p.position.y = 1.38 + Math.sin(t * 3.2 + idx) * 0.025;
    });

    st.wings.forEach((w) => {
      w.grp.rotation.y = w.side * (0.22 + Math.sin(t * 3.0) * 0.14);
    });

    energyCrownGroup.position.y = 0.42 + Math.sin(t * 2.8) * 0.035;
    st.crownRing.rotation.z = t * 1.3;
    st.innerCrownRing.rotation.z = -t * 2.1;
    for (const sh of st.crownShards) {
      const a = sh.baseAngle + t * 1.5;
      sh.mesh.position.set(
        Math.cos(a) * 0.24,
        0.08 + Math.sin(t * 4.0 + sh.idx) * 0.028,
        Math.sin(a) * 0.24
      );
      sh.mesh.rotation.y = -a;
    }

    st.outerFloorRing.rotation.z = t * 1.4;
    const floorPulse = 1 + Math.sin(t * 4.0) * 0.08;
    st.outerFloorRing.scale.set(floorPulse, floorPulse, 1);
    st.innerHexRing.rotation.z = -t * 1.1;

    st.orbitRingA.rotation.x = 1.1 + Math.sin(t * 1.6) * 0.35;
    st.orbitRingA.rotation.y = t * 1.4;
    st.orbitRingB.rotation.y = 1.1 + Math.cos(t * 1.5) * 0.35;
    st.orbitRingB.rotation.z = -t * 1.3;

    st.divineLight.intensity = 1.75 + Math.sin(t * 5.0) * 0.45;

    for (const m of st.divineMotes) {
      const a = m.angle + t * m.speed;
      const y = 0.15 + ((m.yBase + t * 0.65) % 2.05);
      m.mesh.position.set(Math.cos(a) * m.radius, y, Math.sin(a) * m.radius);
      m.mesh.rotation.y = t * 2.8;
      m.mesh.rotation.x = t * 2.1;
    }

    for (const orb of st.specialtyOrbiters) {
      const a = orb.phase + t * orb.speed;
      orb.grp.position.set(
        Math.cos(a) * orb.radius,
        orb.y + Math.sin(t * 3.2 + orb.phase) * 0.07,
        Math.sin(a) * orb.radius
      );
      orb.grp.rotation.y = t * 2.0;
    }
  });

  updaters.push((t) => {
    if (!secretDynamicState || !secretSkinGroup.visible) return;
    const st = secretDynamicState;
    const hueA = (t * 0.18) % 1;
    const hueB = (hueA + 0.36) % 1;
    st.prismMatA.color.setHSL(hueA, 0.92, 0.66);
    st.prismMatA.emissive.setHSL(hueA, 0.92, 0.54);
    st.prismMatB.color.setHSL(hueB, 0.95, 0.62);
    st.prismMatB.emissive.setHSL(hueB, 0.95, 0.52);
    st.holoWingMat.color.setHSL((hueA + 0.12) % 1, 0.92, 0.68);
    st.holoWingInnerMat.color.setHSL((hueB + 0.08) % 1, 0.95, 0.66);
    st.cosmicLight.color.setHSL(hueA, 0.88, 0.65);
    st.cosmicLight.intensity = 2.15 + Math.sin(t * 4.5) * 0.55;

    st.starCoreOuter.rotation.y = t * 2.8;
    st.starCoreOuter.rotation.x = t * 1.9;
    st.starCoreInner.rotation.y = -t * 3.4;
    st.chestOrbitRing.rotation.z = t * 2.2;

    st.cosmicPauldrons.forEach((p, idx) => {
      p.position.y = 1.4 + Math.sin(t * 3.4 + idx * 1.2) * 0.03;
    });

    st.cosmicWings.forEach((w) => {
      w.grp.rotation.y = w.side * (0.28 + Math.sin(t * 3.2) * 0.18);
      w.grp.rotation.z = w.side * Math.sin(t * 2.1) * 0.06;
    });

    cosmicHaloGroup.position.y = 0.44 + Math.sin(t * 3.0) * 0.04;
    st.haloOuter.rotation.z = t * 1.6;
    st.haloInner.rotation.z = -t * 2.4;
    for (const sh of st.haloShards) {
      const a = sh.baseAngle + t * 1.8;
      sh.mesh.position.set(
        Math.cos(a) * 0.29,
        0.09 + Math.sin(t * 4.4 + sh.idx) * 0.032,
        Math.sin(a) * 0.29
      );
      sh.mesh.rotation.y = -a;
    }

    st.floorAstrolabe.rotation.z = t * 1.7;
    const pulse = 1 + Math.sin(t * 4.2) * 0.08;
    st.floorAstrolabe.scale.set(pulse, pulse, 1);
    st.floorRuneHex.rotation.z = -t * 1.3;

    st.gyroRing1.rotation.x = 0.9 + Math.sin(t * 1.4) * 0.45;
    st.gyroRing1.rotation.y = t * 1.7;
    st.gyroRing2.rotation.y = 0.8 + Math.cos(t * 1.3) * 0.45;
    st.gyroRing2.rotation.z = -t * 1.5;
    st.gyroRing3.rotation.x = -0.6 + t * 1.1;
    st.gyroRing3.rotation.z = t * 1.9;

    for (const sat of st.quantumSatellites) {
      const a = sat.phase + t * sat.speed;
      sat.mesh.position.set(
        Math.cos(a) * sat.radius,
        sat.yBase + Math.sin(t * 3.1 + sat.phase) * 0.18,
        Math.sin(a) * sat.radius
      );
      sat.mesh.rotation.y = t * 3.0;
      sat.mesh.rotation.x = t * 2.2;
    }

    for (const tp of st.trailParticles) {
      const life = (tp.yOffset + t * 0.85) % 2.15;
      const norm = life / 2.15;
      const a = tp.phase + t * tp.speed;
      const trailBack = -0.2 - norm * 0.48;
      tp.mesh.position.set(
        Math.cos(a) * tp.radius * (1 - norm * 0.25),
        0.18 + life,
        Math.sin(a) * tp.radius * 0.65 + trailBack * Math.abs(Math.sin(tp.phase))
      );
      tp.mesh.scale.setScalar(Math.max(0.3, 1.15 - norm * 0.75));
      tp.mesh.material.opacity = Math.max(0.15, (1 - norm) * 0.92);
      tp.mesh.rotation.y = t * 3.4;
      tp.mesh.rotation.x = t * 2.5;
    }
  });

  const setDivineSpecialty = (specialtyInput) => {
    if (!specialtyInput) {
      currentDivineSpec = null;
      currentSecretActive = false;
      delete skin.divineSpecialty;
      delete skin.secretSkin;
      buildDivineVisuals(null);
      buildSecretUltimateVisuals(false);
      return null;
    }
    if (isUltimateSecretSkinId(specialtyInput)) {
      currentDivineSpec = null;
      currentSecretActive = true;
      skin.divineSpecialty = ULTIMATE_SECRET_SKIN_ID;
      skin.secretSkin = true;
      buildDivineVisuals(null);
      buildSecretUltimateVisuals(true);
      updateEffects(0);
      return ULTIMATE_SECRET_SKIN;
    }
    currentSecretActive = false;
    delete skin.secretSkin;
    buildSecretUltimateVisuals(false);
    currentDivineSpec = resolveAscensionSpecialty(specialtyInput);
    skin.divineSpecialty = currentDivineSpec.id;
    buildDivineVisuals(currentDivineSpec);
    updateEffects(0);
    return currentDivineSpec;
  };
  const setSecretSkin = (enabled) => {
    if (enabled) {
      return setDivineSpecialty(ULTIMATE_SECRET_SKIN_ID);
    }
    if (currentSecretActive) {
      return setDivineSpecialty(null);
    }
    return null;
  };
  const hasSecretSkin = () => Boolean(currentSecretActive && secretSkinGroup.visible);
  const hasDivineSkin = () => Boolean((currentDivineSpec && divineSkinGroup.visible) || hasSecretSkin());
  const getDivineSpecialty = () =>
    currentSecretActive ? ULTIMATE_SECRET_SKIN_ID : currentDivineSpec ? currentDivineSpec.id : null;

  const updateEffects = (elapsed = 0) => {
    for (const fn of updaters) fn(elapsed);
  };
  updateEffects(0);

  const setFirstPersonVrHidden = (hidden) => {
    const vis = !hidden;
    headGroup.visible = vis;
    leftArm.visible = vis;
    rightArm.visible = vis;
  };

  const hasBattlePassSkin = () => Boolean(skin.battlePassTier || showcase);
  const getBattlePassTier = () => skin.battlePassTier || null;

  return {
    group,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    headGroup,
    torsoMat,
    creatorAuraGroup,
    setCreatorAura,
    hasCreatorAura,
    divineSkinGroup,
    divineArmorGroup,
    divineAuraGroup,
    energyCrownGroup,
    specialtyAccessoryGroup,
    secretSkinGroup,
    cosmicWingsGroup,
    quantumRingsGroup,
    cosmicHaloGroup,
    particleTrailGroup,
    setDivineSpecialty,
    setSecretSkin,
    hasSecretSkin,
    hasDivineSkin,
    getDivineSpecialty,
    hasBattlePassSkin,
    getBattlePassTier,
    setFirstPersonVrHidden,
    updateEffects
  };
}

export function attachRemoteVrVisuals(avatar, rawSkin = {}) {
  if (!avatar?.group) return null;
  const vrRoot = new THREE.Group();
  vrRoot.visible = false;
  avatar.group.add(vrRoot);

  const leftHand = buildArticulatedVRHand({ handedness: 'left', skin: rawSkin });
  const rightHand = buildArticulatedVRHand({ handedness: 'right', skin: rawSkin });
  vrRoot.add(leftHand.root);
  vrRoot.add(rightHand.root);

  const watchMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    metalness: 0.78,
    roughness: 0.25
  });
  const watchScreenMat = new THREE.MeshBasicMaterial({ color: '#22d3ee' });
  const remoteWatch = new THREE.Group();
  const watchBody = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.012, 0.046), watchMat);
  remoteWatch.add(watchBody);
  const watchFace = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.004, 0.038), watchScreenMat);
  watchFace.position.y = 0.006;
  remoteWatch.add(watchFace);
  remoteWatch.position.set(0.026, 0.024, 0.048);
  remoteWatch.rotation.set(0.18, 0, -0.73);
  leftHand.root.add(remoteWatch);

  let remoteVisorGroup = null;
  if (avatar.headGroup && !rawSkin?.showcase?.accessories?.includes('vr_gold') && !rawSkin?.showcase?.accessories?.includes('cyber_visor')) {
    remoteVisorGroup = new THREE.Group();
    remoteVisorGroup.visible = false;
    const hmdBodyMat = new THREE.MeshStandardMaterial({
      color: '#e2e8f0',
      metalness: 0.45,
      roughness: 0.35
    });
    const hmdLensMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      emissive: '#22d3ee',
      emissiveIntensity: 0.85,
      metalness: 0.85,
      roughness: 0.15
    });
    const hmdFront = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.12), hmdBodyMat);
    hmdFront.position.set(0, 0.03, 0.165);
    remoteVisorGroup.add(hmdFront);
    const hmdGlow = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.065, 0.02), hmdLensMat);
    hmdGlow.position.set(0, 0.03, 0.22);
    remoteVisorGroup.add(hmdGlow);
    const hmdStrap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.36), hmdBodyMat);
    hmdStrap.position.set(0, 0.04, 0);
    remoteVisorGroup.add(hmdStrap);
    avatar.headGroup.add(remoteVisorGroup);
  }

  const armMat = avatar.torsoMat || new THREE.MeshStandardMaterial({ color: '#22d3ee', roughness: 0.55 });
  const elbowMat = new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.5, roughness: 0.4 });
  const makeTwoPartArm = () => {
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.115, 1), armMat);
    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1), armMat);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.058, 8, 8), elbowMat);
    upper.castShadow = true;
    forearm.castShadow = true;
    vrRoot.add(upper);
    vrRoot.add(forearm);
    vrRoot.add(elbow);
    return { upper, forearm, elbow };
  };
  const leftArmSeg = makeTwoPartArm();
  const rightArmSeg = makeTwoPartArm();

  const targetHeadQuat = new THREE.Quaternion();
  const targetLeftPos = new THREE.Vector3(-0.26, 1.18, -0.25);
  const targetRightPos = new THREE.Vector3(0.26, 1.18, -0.25);
  const targetLeftQuat = new THREE.Quaternion();
  const targetRightQuat = new THREE.Quaternion();

  const invGroupQuat = new THREE.Quaternion();
  const flipYQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  const tempDesiredHead = new THREE.Quaternion();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const zAxis = new THREE.Vector3(0, 0, 1);
  const shoulderLocal = new THREE.Vector3();
  const wristLocal = new THREE.Vector3();
  const elbowLocal = new THREE.Vector3();
  const cuffOffset = new THREE.Vector3();
  const segDir = new THREE.Vector3();
  const outDir = new THREE.Vector3();
  const midPt = new THREE.Vector3();

  let active = false;
  let lastPose = {
    left: { grip: 0, trigger: 0, thumb: 0, fingers: null },
    right: { grip: 0, trigger: 0, thumb: 0, fingers: null }
  };

  const alignSegment = (mesh, fromVec, toVec) => {
    const len = fromVec.distanceTo(toVec);
    mesh.visible = len > 0.03;
    if (!mesh.visible) return;
    midPt.copy(fromVec).add(toVec).multiplyScalar(0.5);
    mesh.position.copy(midPt);
    mesh.scale.set(1, 1, Math.min(0.65, Math.max(0.05, len)));
    segDir.subVectors(toVec, fromVec).normalize();
    mesh.quaternion.setFromUnitVectors(zAxis, segDir);
  };

  const placeArmSpan = (armSeg, shoulderX, handRoot, sideSign) => {
    const bodyYaw = avatar.group.rotation.y - Math.PI;
    shoulderLocal.set(shoulderX, 1.34, 0).applyAxisAngle(yAxis, bodyYaw);
    cuffOffset.set(0, 0, 0.068).applyQuaternion(handRoot.quaternion);
    wristLocal.copy(handRoot.position).add(cuffOffset);
    const totalLen = shoulderLocal.distanceTo(wristLocal);
    if (totalLen < 0.05) {
      armSeg.upper.visible = false;
      armSeg.forearm.visible = false;
      armSeg.elbow.visible = false;
      return;
    }
    outDir.set(sideSign * 0.26, -0.38, 0.14).applyAxisAngle(yAxis, bodyYaw).normalize();
    const bendAmt = Math.max(0.02, (0.64 - Math.min(0.64, totalLen)) * 0.35);
    elbowLocal.copy(shoulderLocal).lerp(wristLocal, 0.48).addScaledVector(outDir, bendAmt);
    armSeg.elbow.visible = true;
    armSeg.elbow.position.copy(elbowLocal);
    alignSegment(armSeg.upper, shoulderLocal, elbowLocal);
    alignSegment(armSeg.forearm, elbowLocal, wristLocal);
  };

  const update = (vrData, dt = 0.016, elapsed = 0) => {
    const isActive = Boolean(vrData && vrData.active);
    if (!isActive) {
      if (active) {
        active = false;
        vrRoot.visible = false;
        if (remoteVisorGroup) remoteVisorGroup.visible = false;
        if (avatar.leftArm) avatar.leftArm.visible = true;
        if (avatar.rightArm) avatar.rightArm.visible = true;
        if (avatar.headGroup) {
          avatar.headGroup.quaternion.identity();
          avatar.headGroup.position.set(0, 1.58, 0);
        }
      }
      return;
    }

    if (!active) {
      active = true;
      vrRoot.visible = true;
      if (remoteVisorGroup) remoteVisorGroup.visible = true;
      if (avatar.leftArm) avatar.leftArm.visible = false;
      if (avatar.rightArm) avatar.rightArm.visible = false;
      if (vrData.leftHand) {
        leftHand.root.position.set(vrData.leftHand.px, vrData.leftHand.py, vrData.leftHand.pz);
        leftHand.root.quaternion.set(vrData.leftHand.qx, vrData.leftHand.qy, vrData.leftHand.qz, vrData.leftHand.qw).normalize();
      }
      if (vrData.rightHand) {
        rightHand.root.position.set(vrData.rightHand.px, vrData.rightHand.py, vrData.rightHand.pz);
        rightHand.root.quaternion.set(vrData.rightHand.qx, vrData.rightHand.qy, vrData.rightHand.qz, vrData.rightHand.qw).normalize();
      }
    }

    vrRoot.rotation.y = -avatar.group.rotation.y;
    const smooth = Math.min(1, Math.max(0.22, 1 - Math.exp(-18 * (Number(dt) || 0.016))));

    if (vrData.head && avatar.headGroup) {
      targetHeadQuat.set(vrData.head.qx, vrData.head.qy, vrData.head.qz, vrData.head.qw).normalize();
      invGroupQuat.copy(avatar.group.quaternion).invert();
      tempDesiredHead.copy(invGroupQuat).multiply(targetHeadQuat).multiply(flipYQuat);
      avatar.headGroup.quaternion.slerp(tempDesiredHead, smooth);
      const hy = Math.max(1.05, Math.min(2.1, Number(vrData.head.py) || 1.58));
      avatar.headGroup.position.y += (hy - avatar.headGroup.position.y) * smooth;
    }

    if (vrData.leftHand) {
      targetLeftPos.set(vrData.leftHand.px, vrData.leftHand.py, vrData.leftHand.pz);
      targetLeftQuat.set(vrData.leftHand.qx, vrData.leftHand.qy, vrData.leftHand.qz, vrData.leftHand.qw).normalize();
      leftHand.root.position.lerp(targetLeftPos, smooth);
      leftHand.root.quaternion.slerp(targetLeftQuat, smooth);
      lastPose.left.trigger = vrData.leftHand.trigger || 0;
      lastPose.left.grip = vrData.leftHand.grip || 0;
      lastPose.left.thumb = vrData.leftHand.thumb || 0;
      lastPose.left.fingers = vrData.leftHand.fingers || null;
    }

    if (vrData.rightHand) {
      targetRightPos.set(vrData.rightHand.px, vrData.rightHand.py, vrData.rightHand.pz);
      targetRightQuat.set(vrData.rightHand.qx, vrData.rightHand.qy, vrData.rightHand.qz, vrData.rightHand.qw).normalize();
      rightHand.root.position.lerp(targetRightPos, smooth);
      rightHand.root.quaternion.slerp(targetRightQuat, smooth);
      lastPose.right.trigger = vrData.rightHand.trigger || 0;
      lastPose.right.grip = vrData.rightHand.grip || 0;
      lastPose.right.thumb = vrData.rightHand.thumb || 0;
      lastPose.right.fingers = vrData.rightHand.fingers || null;
    }

    leftHand.setPose({ ...lastPose.left, dt, elapsed });
    rightHand.setPose({ ...lastPose.right, dt, elapsed });

    placeArmSpan(leftArmSeg, -0.29, leftHand.root, -1);
    placeArmSpan(rightArmSeg, 0.29, rightHand.root, 1);
  };

  const applySkin = (nextSkin) => {
    leftHand.applySkin(nextSkin);
    rightHand.applySkin(nextSkin);
    if (avatar.torsoMat) {
      leftArmSeg.upper.material = avatar.torsoMat;
      leftArmSeg.forearm.material = avatar.torsoMat;
      rightArmSeg.upper.material = avatar.torsoMat;
      rightArmSeg.forearm.material = avatar.torsoMat;
    }
  };

  const dispose = () => {
    leftHand.dispose();
    rightHand.dispose();
    watchBody.geometry.dispose();
    watchFace.geometry.dispose();
    watchMat.dispose();
    watchScreenMat.dispose();
    if (remoteVisorGroup) {
      disposeObject3D(remoteVisorGroup);
    }
    elbowMat.dispose();
    [leftArmSeg, rightArmSeg].forEach((seg) => {
      seg.upper.geometry.dispose();
      seg.forearm.geometry.dispose();
      seg.elbow.geometry.dispose();
    });
  };

  return {
    vrRoot,
    leftHand,
    rightHand,
    leftArmSeg,
    rightArmSeg,
    remoteWatch,
    remoteVisorGroup,
    update,
    applySkin,
    dispose
  };
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
  const isSecret = Boolean(s.secretSkin || isUltimateSecretSkinId(s.divineSpecialty));
  const divineSpec = !isSecret && s.divineSpecialty ? resolveAscensionSpecialty(s.divineSpecialty) : null;
  const bpSpec = !isSecret && !divineSpec && s.battlePassTier ? getBattlePassTierSpec(s.battlePassTier) : null;
  const hasVipBadge = Boolean(bpSpec?.tier === 7 || s.showcase?.accessories?.includes('vip_badge'));
  const materialTheme = s.showcase?.materialTheme || null;
  const torsoColor =
    materialTheme === 'cyber_gold'
      ? '#17153b'
      : materialTheme === 'gold24k'
        ? '#fbbf24'
        : materialTheme === 'matrix'
          ? '#08100c'
          : materialTheme === 'carbon_neon'
            ? '#111827'
            : materialTheme === 'diamond'
              ? '#67e8f9'
              : materialTheme === 'chrome_rgb'
                ? '#e2e8f0'
                : s.outfitColor;
  const strokeCol = isSecret
    ? '#e879f9'
    : divineSpec
      ? '#fde047'
      : bpSpec || hasVipBadge
        ? bpSpec?.accentColor || '#fbbf24'
        : s.outfitColor;
  const bgFill = isSecret ? '#13072e' : bpSpec || hasVipBadge ? '#1b1204' : '#0b1324';
  const styleMark =
    isSecret
      ? `<polygon points="32,37 37,43 32,49 27,43" fill="#38bdf8" stroke="#fde047" stroke-width="1"/>`
      : hasVipBadge
        ? `<rect x="23" y="38" width="6" height="8" rx="1.5" fill="#fbbf24" stroke="#fef08a" stroke-width="0.9"/><rect x="25" y="40" width="2" height="2" fill="#ef4444"/><rect x="33" y="41" width="7" height="3" rx="1" fill="#fbbf24"/>`
        : bpSpec || materialTheme
          ? `<rect x="23" y="35" width="3" height="20" rx="1" fill="${strokeCol}"/><rect x="38" y="35" width="3" height="20" rx="1" fill="${strokeCol}"/><polygon points="32,39 36,43 32,47 28,43" fill="${strokeCol}"/>`
          : s.outfitStyle === 'blouse'
            ? `<rect x="28" y="34" width="8" height="24" rx="2" fill="#f8fafc"/>`
            : s.outfitStyle === 'hoodie'
              ? `<rect x="24" y="45" width="16" height="9" rx="2" fill="#0f172a"/>`
              : `<rect x="26" y="39" width="12" height="7" rx="2" fill="#38bdf8"/>`;

  const haloSvg = isSecret
    ? `<ellipse cx="32" cy="9" rx="14" ry="3.5" fill="none" stroke="#fde047" stroke-width="2"/>
       <path d="M10 38 L20 33 L20 51 Z" fill="#e879f9" opacity="0.48"/>
       <path d="M54 38 L44 33 L44 51 Z" fill="#38bdf8" opacity="0.48"/>`
    : divineSpec
      ? `<ellipse cx="32" cy="9.5" rx="11" ry="2.8" fill="none" stroke="#fde047" stroke-width="1.8"/>`
      : hasVipBadge
        ? `<circle cx="13" cy="14" r="4.2" fill="none" stroke="#fbbf24" stroke-width="1.8"/><path d="M13 18.2 V27 M13 23 H17 M13 26 H16" stroke="#fde047" stroke-width="1.7" stroke-linecap="round"/><circle cx="51" cy="14" r="3.5" fill="#0c4a6e" stroke="#38bdf8" stroke-width="1.3"/>`
        : '';

  const hatSvg =
    s.hat === 'glasses'
      ? `<rect x="23" y="19" width="8" height="4" rx="1" fill="#0284c7" stroke="#bae6fd" stroke-width="0.8"/>
         <rect x="33" y="19" width="8" height="4" rx="1" fill="#0284c7" stroke="#bae6fd" stroke-width="0.8"/>`
      : s.hat === 'cap'
        ? `<rect x="20" y="9" width="24" height="7" rx="3" fill="${torsoColor}"/>
           <rect x="21" y="14" width="25" height="3" rx="1" fill="${torsoColor}" opacity="0.9"/>`
        : s.hat === 'headset'
          ? `<path d="M19 23 C19 10, 45 10, 45 23" fill="none" stroke="#0f172a" stroke-width="3"/>
             <rect x="17" y="17" width="5" height="10" rx="2" fill="${torsoColor}"/>
             <rect x="42" y="17" width="5" height="10" rx="2" fill="${torsoColor}"/>`
          : '';

  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" class="skin-mini-svg" aria-hidden="true">
    <rect x="2" y="2" width="60" height="60" rx="14" fill="${bgFill}" stroke="${strokeCol}" stroke-width="${isSecret || divineSpec || bpSpec ? 2.5 : 2}"/>
    ${haloSvg}
    <rect x="22" y="54" width="9" height="7" rx="1" fill="${s.pantsColor}"/>
    <rect x="33" y="54" width="9" height="7" rx="1" fill="${s.pantsColor}"/>
    <rect x="15" y="34" width="7" height="18" rx="3" fill="${torsoColor}" opacity="0.92"/>
    <rect x="42" y="34" width="7" height="18" rx="3" fill="${torsoColor}" opacity="0.92"/>
    <circle cx="18.5" cy="53" r="3" fill="${s.skinTone}"/>
    <circle cx="45.5" cy="53" r="3" fill="${s.skinTone}"/>
    <rect x="21" y="33" width="22" height="23" rx="4" fill="${torsoColor}"/>
    ${styleMark}
    <rect x="22" y="13" width="20" height="19" rx="5" fill="${s.skinTone}"/>
    <rect x="21" y="11" width="22" height="6" rx="3" fill="${isSecret || divineSpec ? '#e2e8f0' : '#292524'}"/>
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
