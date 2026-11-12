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

export function buildStudentAvatarMesh(rawSkin = {}) {
  const skin = normalizeSkin(rawSkin);
  const group = new THREE.Group();

  const pantsMat = new THREE.MeshStandardMaterial({ color: skin.pantsColor, roughness: 0.72 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.65 });
  const torsoMat = new THREE.MeshStandardMaterial({ color: skin.outfitColor, roughness: 0.55 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin.skinTone, roughness: 0.72 });
  const hairMat = new THREE.MeshStandardMaterial({ color: '#292524', roughness: 0.85 });

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
    group.add(pivot);
    return pivot;
  };

  const leftLeg = makeLeg(-0.12);
  const rightLeg = makeLeg(0.12);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.68, 0.28), torsoMat);
  torso.position.y = 1.06;
  torso.castShadow = true;
  group.add(torso);

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

  const makeArm = (xOffset) => {
    const pivot = new THREE.Group();
    pivot.position.set(xOffset, 1.34, 0);
    const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.54, 0.16), torsoMat);
    armMesh.position.set(0, -0.26, 0);
    armMesh.castShadow = true;
    pivot.add(armMesh);
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

  return { group, leftLeg, rightLeg, leftArm, rightArm };
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
