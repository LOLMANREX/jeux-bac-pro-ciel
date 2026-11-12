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

export function buildStudentAvatarMesh(rawSkin = {}) {
  const skin = { ...DEFAULT_SKIN, ...rawSkin };
  const group = new THREE.Group();

  const pantsMat = new THREE.MeshStandardMaterial({ color: skin.pantsColor, roughness: 0.72 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.65 });
  const torsoMat = new THREE.MeshStandardMaterial({ color: skin.outfitColor, roughness: 0.55 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin.skinTone, roughness: 0.72 });
  const hairMat = new THREE.MeshStandardMaterial({ color: '#292524', roughness: 0.85 });

  // Legs + Shoes
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.18), pantsMat);
  leftLeg.position.set(-0.12, 0.37, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.18), pantsMat);
  rightLeg.position.set(0.12, 0.37, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);

  [-0.12, 0.12].forEach((sx) => {
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.25), shoeMat);
    shoe.position.set(sx, 0.045, 0.03);
    group.add(shoe);
  });

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.68, 0.28), torsoMat);
  torso.position.y = 1.06;
  torso.castShadow = true;
  group.add(torso);

  // Outfit style details
  if (skin.outfitStyle === 'blouse') {
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

  // Arms
  [-0.32, 0.32].forEach((ax) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.56, 0.16), torsoMat);
    arm.position.set(ax, 1.06, 0);
    group.add(arm);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 0.14), skinMat);
    hand.position.set(ax, 0.74, 0);
    group.add(hand);
  });

  // Head + Hair
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.34), skinMat);
  head.position.y = 1.59;
  head.castShadow = true;
  group.add(head);

  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.11, 0.36), hairMat);
  hair.position.set(0, 1.75, -0.01);
  group.add(hair);

  // Eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#0f172a' });
  [-0.07, 0.07].forEach((ex) => {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), eyeMat);
    eye.position.set(ex, 1.61, 0.175);
    group.add(eye);
  });

  // Hat / Accessory
  if (skin.hat === 'glasses') {
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

  return { group, leftLeg, rightLeg };
}
