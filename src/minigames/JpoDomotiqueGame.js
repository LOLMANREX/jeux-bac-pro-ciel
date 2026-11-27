import * as THREE from 'three';
import { sfx } from '../core/audio.js';
import { createGradeBreakdown, finalizeGrade20, toSafeNumber } from '../core/grading.js';
import { createWorkbench3D, makeCanvasScreen } from './Workbench3DHost.js';

export const JPO_DOMO_TARGET = {
  minTemp: 19,
  maxTemp: 21,
  targetTemp: 20,
  requiredSensors: ['presence', 'temperature', 'shutters'],
  requiredRules: ['autoLight', 'ecoHeat', 'alarm']
};

export const JPO_DOMO_SENSORS = [
  { id: 'presence', key: 'sensorPresence', icon: '👁️', label: 'Capteur Présence' },
  { id: 'temperature', key: 'sensorTemp', icon: '🌡️', label: 'Sonde Température' },
  { id: 'shutters', key: 'sensorShutters', icon: '🪟', label: 'Module Volets' }
];

export const JPO_DOMO_RULES = [
  { id: 'autoLight', key: 'ruleAutoLight', icon: '💡', label: 'Éclairage auto' },
  { id: 'ecoHeat', key: 'ruleEcoHeat', icon: '🔥', label: 'Chauffage éco' },
  { id: 'alarm', key: 'ruleAlarm', icon: '🛡️', label: 'Alarme connectée' }
];

export function evaluateJpoDomotiqueState(state = {}) {
  const s = state && typeof state === 'object' ? state : {};
  const sensorPresence = Boolean(s.sensorPresence);
  const sensorTemp = Boolean(s.sensorTemp);
  const sensorShutters = Boolean(s.sensorShutters);
  const pairedCount = (sensorPresence ? 1 : 0) + (sensorTemp ? 1 : 0) + (sensorShutters ? 1 : 0);
  const sensorsOk = pairedCount === 3;

  const ruleAutoLight = Boolean(s.ruleAutoLight);
  const ruleEcoHeat = Boolean(s.ruleEcoHeat);
  const ruleAlarm = Boolean(s.ruleAlarm);
  const targetTemp = Math.max(16, Math.min(25, Math.round(toSafeNumber(s.targetTemp, 20))));
  const tempOk = targetTemp >= JPO_DOMO_TARGET.minTemp && targetTemp <= JPO_DOMO_TARGET.maxTemp;
  const rulesCount = (ruleAutoLight ? 1 : 0) + (ruleEcoHeat ? 1 : 0) + (ruleAlarm ? 1 : 0);
  const rulesOk = rulesCount === 3 && tempOk;

  const timeOfDay = s.timeOfDay === 'night' ? 'night' : 'day';
  const simRunning = Boolean(s.simRunning);
  const simTested = Boolean(s.simTested);
  const simOk = sensorsOk && rulesOk && simTested;

  const completedSteps = (sensorsOk ? 1 : 0) + (rulesOk ? 1 : 0) + (simOk ? 1 : 0);
  const allValid = sensorsOk && rulesOk && simOk;

  const sensorsPts = pairedCount * 2 + (sensorsOk ? 1 : 0);
  const rulesPts = rulesCount * 2 + (tempOk ? 1 : 0);
  const simPts = simOk ? 6 : simRunning ? 3 : 0;

  const rawScore = allValid ? 20 : Math.min(19.5, sensorsPts + rulesPts + simPts);
  const score = allValid ? 20 : finalizeGrade20(rawScore, { hasCriticalError: !allValid });

  let advice = 'Bravo ! La maison connectée réagit automatiquement et en toute sécurité.';
  if (!sensorPresence || !sensorTemp || !sensorShutters) {
    advice = 'Étape 1 : Appaire les 3 capteurs sans fil (présence, température, volets) à la box.';
  } else if (!ruleAutoLight || !ruleEcoHeat || !ruleAlarm) {
    advice = 'Étape 2 : Active les 3 scénarios intelligents (éclairage, chauffage éco, alarme).';
  } else if (!tempOk) {
    advice = `Étape 2 : Règle la consigne Éco entre ${JPO_DOMO_TARGET.minTemp}°C et ${JPO_DOMO_TARGET.maxTemp}°C.`;
  } else if (simRunning) {
    advice = 'Simulation en cours : observe les lumières, le radiateur et les volets réagir en direct !';
  } else if (!simTested) {
    advice = 'Étape 3 : Lance le test grandeur nature Jour/Nuit pour vérifier l’automatisation.';
  }

  const breakdown = createGradeBreakdown({
    items: [
      { label: `1. Capteurs appairés (${pairedCount}/3)`, earned: sensorsPts, max: 7 },
      { label: `2. Scénarios & Éco ${targetTemp}°C (${rulesCount}/3)`, earned: rulesPts, max: 7 },
      { label: `3. Test grandeur nature (${simTested ? 'VALIDÉ' : 'EN ATTENTE'})`, earned: simPts, max: 6 }
    ],
    rawScore,
    finalScore: score,
    hasCriticalError: !allValid
  });

  return {
    sensorPresence,
    sensorTemp,
    sensorShutters,
    pairedCount,
    sensorsOk,
    ruleAutoLight,
    ruleEcoHeat,
    ruleAlarm,
    targetTemp,
    tempOk,
    rulesCount,
    rulesOk,
    timeOfDay,
    simRunning,
    simTested,
    simOk,
    completedSteps,
    allValid,
    score,
    breakdown,
    advice
  };
}

function makeCanvasTexture(width, height, drawFn) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

export function createJpoDomotiqueGame(api) {
  const state = {
    sensorPresence: false,
    sensorTemp: false,
    sensorShutters: false,
    ruleAutoLight: false,
    ruleEcoHeat: false,
    ruleAlarm: false,
    targetTemp: 20,
    timeOfDay: 'day',
    simRunning: false,
    simTested: false,
    simProgress: 0,
    shutterLevel: 0.08,
    submitted: false,
    activeCam: 'overview',
    animPhase: 0
  };

  const bench = createWorkbench3D(api.container, {
    background: '#132038',
    wallColor: '#192a48',
    benchColor: '#1e293b',
    benchWidth: 4.2,
    benchDepth: 2.1,
    cameraPos: [0, 1.44, 2.48],
    lookAt: [0, 0.38, -0.06],
    fov: 42,
    envIntensity: 0.92
  });

  const presets = [
    { id: 'overview', label: '🏠 Vue Maison', pos: [0, 1.44, 2.48], lookAt: [0, 0.38, -0.06] },
    { id: 'house', label: '🪟 Maquette 3D', pos: [-0.62, 1.02, 1.44], lookAt: [-0.64, 0.36, 0.06] },
    { id: 'sensors', label: '📡 Capteurs IoT', pos: [-0.15, 0.94, 1.38], lookAt: [-0.3, 0.42, 0.08] },
    { id: 'hub', label: '🖥️ Box & Supervision', pos: [1.04, 0.98, 1.36], lookAt: [1.02, 0.36, -0.02] }
  ];

  function setCameraById(id) {
    state.activeCam = id;
    const p = presets.find((x) => x.id === id) || presets[0];
    bench.setCameraView(p.pos, p.lookAt, 42);
    bench.setCameras(
      presets.map((x) => ({ id: x.id, label: x.label })),
      id,
      setCameraById
    );
  }

  const warmBenchLight = new THREE.PointLight('#ffedd5', 2.1, 9, 1.4);
  warmBenchLight.position.set(-1.8, 1.95, 1.6);
  bench.scene.add(warmBenchLight);

  const coolBenchLight = new THREE.PointLight('#38bdf8', 1.9, 9, 1.4);
  coolBenchLight.position.set(1.9, 1.9, -1.0);
  bench.scene.add(coolBenchLight);

  const CANVAS_THROTTLE_SEC = 1 / 12;
  const CANVAS_THROTTLE_MS = 84;

  const darkMat = bench.track(new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.42, metalness: 0.5 }));
  const chassisMat = bench.track(new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.4, metalness: 0.52 }));
  const metalMat = bench.track(new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.3, metalness: 0.78 }));
  const chromeMat = bench.track(new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.2, metalness: 0.86 }));
  const wallHouseMat = bench.track(new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.65, metalness: 0.05 }));
  const innerWallMat = bench.track(new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.7, metalness: 0.04 }));
  const floorOakMat = bench.track(new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.62, metalness: 0.06 }));
  const floorBedroomMat = bench.track(new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.68, metalness: 0.08 }));
  const roofMat = bench.track(new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.46, metalness: 0.32 }));
  const solarMat = bench.track(new THREE.MeshStandardMaterial({ color: '#0369a1', roughness: 0.22, metalness: 0.6 }));
  const lawnMat = bench.track(new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.85, metalness: 0.02 }));
  const sofaMat = bench.track(new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.72 }));
  const bedMat = bench.track(new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.68 }));
  const glassMat = bench.track(
    new THREE.MeshStandardMaterial({
      color: '#bae6fd',
      roughness: 0.12,
      metalness: 0.2,
      transparent: true,
      opacity: 0.34
    })
  );

  const backWallTex = bench.track(
    makeCanvasTexture(1024, 512, (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0f1c34');
      grad.addColorStop(0.55, '#162848');
      grad.addColorStop(1, '#0b1426');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.09)';
      ctx.lineWidth = 2;
      for (let x = 0; x < w; x += 48) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 48) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    })
  );
  const backWall = new THREE.Mesh(
    bench.track(new THREE.PlaneGeometry(6.4, 3.0)),
    bench.track(new THREE.MeshStandardMaterial({ map: backWallTex, roughness: 0.65, metalness: 0.1 }))
  );
  backWall.position.set(0, 1.38, -1.62);
  backWall.receiveShadow = true;
  bench.scene.add(backWall);

  const wallStripMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#06b6d4', emissive: '#06b6d4', emissiveIntensity: 1.05 })
  );
  const topStrip = new THREE.Mesh(bench.track(new THREE.BoxGeometry(4.6, 0.024, 0.03)), wallStripMat);
  topStrip.position.set(0, 2.24, -1.58);
  bench.scene.add(topStrip);
  const botStrip = new THREE.Mesh(bench.track(new THREE.BoxGeometry(4.6, 0.02, 0.03)), wallStripMat);
  botStrip.position.set(0, 0.42, -1.58);
  bench.scene.add(botStrip);

  const signFrame = new THREE.Mesh(bench.track(new THREE.BoxGeometry(2.42, 0.38, 0.05)), darkMat);
  signFrame.position.set(0, 1.66, -1.56);
  bench.scene.add(signFrame);

  const signScreen = makeCanvasScreen(780, 120, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, w, 0);
    bg.addColorStop(0, '#091526');
    bg.addColorStop(0.5, '#0c2d48');
    bg.addColorStop(1, '#091526');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DOMOTIQUE & IOT • BAC PRO CIEL', w / 2, 54);

    ctx.fillStyle = '#67e8f9';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText('ÉCLAIRAGE AUTO  •  CHAUFFAGE ÉCO  •  VOLETS & SÉCURITÉ', w / 2, 90);
    ctx.textAlign = 'left';
  });
  bench.track(signScreen.texture);
  const signFace = new THREE.Mesh(
    bench.track(new THREE.PlaneGeometry(2.32, 0.3)),
    bench.track(new THREE.MeshBasicMaterial({ map: signScreen.texture }))
  );
  signFace.position.set(0, 1.66, -1.53);
  bench.scene.add(signFace);

  const matTex = bench.track(
    makeCanvasTexture(1024, 512, (ctx, w, h) => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.lineWidth = 2;
      for (let x = 0; x <= w; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(6, 182, 212, 0.55)';
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, w - 20, h - 20);

      const zones = [
        { x: 26, w: 590, color: '#06b6d4', title: 'MAQUETTE MAISON CONNECTÉE' },
        { x: 642, w: 356, color: '#38bdf8', title: 'BOX DOMOTIQUE & SUPERVISION' }
      ];
      for (const z of zones) {
        ctx.strokeStyle = z.color;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(z.x, 26, z.w, h - 52);
        ctx.fillStyle = z.color;
        ctx.font = 'bold 17px sans-serif';
        ctx.fillText(z.title, z.x + 14, h - 38);
      }
    })
  );
  const deskMat = new THREE.Mesh(
    bench.track(new THREE.BoxGeometry(3.86, 0.012, 1.72)),
    bench.track(new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.72, metalness: 0.1 }))
  );
  deskMat.position.set(0, 0.006, 0.02);
  deskMat.receiveShadow = true;
  bench.scene.add(deskMat);

  const grommetOuterGeo = bench.track(new THREE.CylinderGeometry(0.055, 0.055, 0.016, 16));
  const grommetHoleGeo = bench.track(new THREE.CylinderGeometry(0.036, 0.036, 0.018, 16));
  for (const cx of [-1.1, 0.18, 1.15]) {
    const grommet = new THREE.Mesh(grommetOuterGeo, metalMat);
    grommet.position.set(cx, 0.01, -0.76);
    bench.scene.add(grommet);
    const grommetHole = new THREE.Mesh(grommetHoleGeo, darkMat);
    grommetHole.position.set(cx, 0.011, -0.76);
    bench.scene.add(grommetHole);
  }

  const houseGroup = new THREE.Group();
  houseGroup.position.set(-0.62, 0, 0.06);
  houseGroup.rotation.y = 0.08;
  bench.scene.add(houseGroup);

  const housePlinth = new THREE.Mesh(bench.track(new THREE.BoxGeometry(1.96, 0.06, 1.16)), darkMat);
  housePlinth.position.set(0, 0.03, 0);
  housePlinth.castShadow = true;
  housePlinth.receiveShadow = true;
  houseGroup.add(housePlinth);

  const lawn = new THREE.Mesh(bench.track(new THREE.BoxGeometry(1.88, 0.014, 0.24)), lawnMat);
  lawn.position.set(0, 0.065, 0.42);
  lawn.receiveShadow = true;
  houseGroup.add(lawn);

  const livingFloor = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.92, 0.016, 0.78)), floorOakMat);
  livingFloor.position.set(-0.46, 0.068, -0.06);
  livingFloor.receiveShadow = true;
  houseGroup.add(livingFloor);

  const bedroomFloor = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.92, 0.016, 0.78)), floorBedroomMat);
  bedroomFloor.position.set(0.46, 0.068, -0.06);
  bedroomFloor.receiveShadow = true;
  houseGroup.add(bedroomFloor);

  const houseBackWall = new THREE.Mesh(bench.track(new THREE.BoxGeometry(1.86, 0.62, 0.045)), wallHouseMat);
  houseBackWall.position.set(0, 0.38, -0.44);
  houseBackWall.castShadow = true;
  houseBackWall.receiveShadow = true;
  houseGroup.add(houseBackWall);

  const sideWallGeo = bench.track(new THREE.BoxGeometry(0.045, 0.62, 0.78));
  for (const sx of [-0.91, 0.91]) {
    const sw = new THREE.Mesh(sideWallGeo, wallHouseMat);
    sw.position.set(sx, 0.38, -0.06);
    sw.castShadow = true;
    sw.receiveShadow = true;
    houseGroup.add(sw);
  }

  const midWallBot = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.04, 0.62, 0.38)), innerWallMat);
  midWallBot.position.set(0, 0.38, -0.25);
  midWallBot.castShadow = true;
  houseGroup.add(midWallBot);

  const midWallTop = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.04, 0.2, 0.4)), innerWallMat);
  midWallTop.position.set(0, 0.59, 0.14);
  houseGroup.add(midWallTop);

  const frontPillarGeo = bench.track(new THREE.BoxGeometry(0.14, 0.62, 0.045));
  for (const fx of [-0.84, 0, 0.84]) {
    const pillar = new THREE.Mesh(frontPillarGeo, wallHouseMat);
    pillar.position.set(fx, 0.38, 0.32);
    pillar.castShadow = true;
    houseGroup.add(pillar);
  }

  const frontLintel = new THREE.Mesh(bench.track(new THREE.BoxGeometry(1.86, 0.11, 0.045)), wallHouseMat);
  frontLintel.position.set(0, 0.635, 0.32);
  houseGroup.add(frontLintel);

  const frontSill = new THREE.Mesh(bench.track(new THREE.BoxGeometry(1.86, 0.11, 0.045)), wallHouseMat);
  frontSill.position.set(0, 0.125, 0.32);
  houseGroup.add(frontSill);

  const roofSlopeGeo = bench.track(new THREE.BoxGeometry(1.06, 0.04, 0.92));
  const roofLeft = new THREE.Mesh(roofSlopeGeo, roofMat);
  roofLeft.position.set(-0.46, 0.84, -0.06);
  roofLeft.rotation.z = 0.34;
  roofLeft.castShadow = true;
  houseGroup.add(roofLeft);

  const roofRight = new THREE.Mesh(roofSlopeGeo, roofMat);
  roofRight.position.set(0.46, 0.84, -0.06);
  roofRight.rotation.z = -0.34;
  roofRight.castShadow = true;
  houseGroup.add(roofRight);

  const solarPanel = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.68, 0.018, 0.54)), solarMat);
  solarPanel.position.set(0.47, 0.87, -0.06);
  solarPanel.rotation.z = -0.34;
  houseGroup.add(solarPanel);

  const sofaBase = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.44, 0.12, 0.22)), sofaMat);
  sofaBase.position.set(-0.56, 0.13, -0.26);
  houseGroup.add(sofaBase);
  const sofaBack = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.44, 0.18, 0.06)), sofaMat);
  sofaBack.position.set(-0.56, 0.2, -0.34);
  houseGroup.add(sofaBack);
  const coffeeTable = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.26, 0.07, 0.16)), wallHouseMat);
  coffeeTable.position.set(-0.54, 0.105, -0.02);
  houseGroup.add(coffeeTable);

  const bedFrame = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.42, 0.11, 0.36)), wallHouseMat);
  bedFrame.position.set(0.56, 0.125, -0.22);
  houseGroup.add(bedFrame);
  const bedCover = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.38, 0.06, 0.28)), bedMat);
  bedCover.position.set(0.56, 0.19, -0.18);
  houseGroup.add(bedCover);

  const livingLight = new THREE.PointLight('#fde68a', 0, 2.2, 1.8);
  livingLight.position.set(-0.46, 0.62, -0.06);
  houseGroup.add(livingLight);

  const bedroomLight = new THREE.PointLight('#bae6fd', 0, 2.2, 1.8);
  bedroomLight.position.set(0.46, 0.62, -0.06);
  houseGroup.add(bedroomLight);

  const ceilingSpotGeo = bench.track(new THREE.CylinderGeometry(0.045, 0.045, 0.018, 12));
  const livingSpotMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#475569', emissive: '#fde68a', emissiveIntensity: 0 })
  );
  const bedroomSpotMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#475569', emissive: '#bae6fd', emissiveIntensity: 0 })
  );
  for (const sp of [
    { x: -0.62, z: -0.18, mat: livingSpotMat },
    { x: -0.28, z: 0.04, mat: livingSpotMat },
    { x: 0.28, z: -0.18, mat: bedroomSpotMat },
    { x: 0.62, z: 0.04, mat: bedroomSpotMat }
  ]) {
    const lamp = new THREE.Mesh(ceilingSpotGeo, sp.mat);
    lamp.position.set(sp.x, 0.68, sp.z);
    houseGroup.add(lamp);
  }

  const shutterBoxGeo = bench.track(new THREE.BoxGeometry(0.7, 0.055, 0.065));
  const windowGlassGeo = bench.track(new THREE.PlaneGeometry(0.68, 0.39));
  const shutterCurtainGeo = bench.track(new THREE.BoxGeometry(0.68, 0.39, 0.022));
  const shutterMat = bench.track(new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.45, metalness: 0.38 }));
  const shutterLedGeo = bench.track(new THREE.BoxGeometry(0.05, 0.018, 0.018));
  const shutterLedMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#334155', emissive: '#06b6d4', emissiveIntensity: 0 })
  );

  const shutters = [];
  for (const wx of [-0.42, 0.42]) {
    const winGlass = new THREE.Mesh(windowGlassGeo, glassMat);
    winGlass.position.set(wx, 0.38, 0.315);
    houseGroup.add(winGlass);

    const box = new THREE.Mesh(shutterBoxGeo, chassisMat);
    box.position.set(wx, 0.59, 0.345);
    houseGroup.add(box);

    const motorLed = new THREE.Mesh(shutterLedGeo, shutterLedMat);
    motorLed.position.set(wx + 0.28, 0.59, 0.38);
    houseGroup.add(motorLed);

    const curtain = new THREE.Mesh(shutterCurtainGeo, shutterMat);
    curtain.position.set(wx, 0.56, 0.34);
    curtain.scale.y = 0.08;
    curtain.castShadow = true;
    houseGroup.add(curtain);
    shutters.push(curtain);
  }

  const radGroup = new THREE.Group();
  radGroup.position.set(-0.85, 0.24, -0.14);
  radGroup.rotation.y = Math.PI / 2;
  houseGroup.add(radGroup);

  const radBody = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.32, 0.22, 0.04)), chromeMat);
  radGroup.add(radBody);

  const radFinGeo = bench.track(new THREE.BoxGeometry(0.018, 0.19, 0.048));
  const radFinInst = new THREE.InstancedMesh(radFinGeo, chromeMat, 8);
  const finMatrix = new THREE.Matrix4();
  for (let i = 0; i < 8; i++) {
    finMatrix.makeTranslation(-0.12 + i * 0.034, 0, 0.008);
    radFinInst.setMatrixAt(i, finMatrix);
  }
  radFinInst.instanceMatrix.needsUpdate = true;
  radGroup.add(radFinInst);

  const radiatorLedMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#475569', emissive: '#22c55e', emissiveIntensity: 0.1 })
  );
  const radiatorLed = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.28, 0.025, 0.015)), radiatorLedMat);
  radiatorLed.position.set(0, 0.12, 0.024);
  radGroup.add(radiatorLed);

  const pirGroup = new THREE.Group();
  pirGroup.position.set(-0.84, 0.58, -0.38);
  houseGroup.add(pirGroup);

  const pirBody = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.06, 0.075, 0.05)), chromeMat);
  pirGroup.add(pirBody);
  const pirLedMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#475569', emissive: '#06b6d4', emissiveIntensity: 0.05 })
  );
  const pirDome = new THREE.Mesh(bench.track(new THREE.SphereGeometry(0.022, 10, 10)), pirLedMat);
  pirDome.position.set(0.02, -0.01, 0.02);
  pirGroup.add(pirDome);

  const pirConeMat = bench.track(
    new THREE.MeshBasicMaterial({
      color: '#06b6d4',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    })
  );
  const pirCone = new THREE.Mesh(bench.track(new THREE.ConeGeometry(0.22, 0.44, 14, 1, true)), pirConeMat);
  pirCone.position.set(0.14, -0.14, 0.14);
  pirCone.rotation.set(0.75, 0, -0.75);
  pirGroup.add(pirCone);

  const tempProbeMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#475569', emissive: '#22c55e', emissiveIntensity: 0.05 })
  );
  const tempProbe = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.07, 0.11, 0.024)), chassisMat);
  tempProbe.position.set(0.32, 0.42, -0.4);
  houseGroup.add(tempProbe);
  const tempProbeLed = new THREE.Mesh(bench.track(new THREE.SphereGeometry(0.016, 8, 8)), tempProbeMat);
  tempProbeLed.position.set(0, 0.02, 0.015);
  tempProbe.add(tempProbeLed);

  const alarmBeaconMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#475569', emissive: '#22c55e', emissiveIntensity: 0.05 })
  );
  const alarmBeacon = new THREE.Mesh(bench.track(new THREE.CylinderGeometry(0.036, 0.044, 0.06, 12)), alarmBeaconMat);
  alarmBeacon.position.set(0.78, 0.66, 0.35);
  alarmBeacon.rotation.x = Math.PI / 2;
  houseGroup.add(alarmBeacon);

  const hubGroup = new THREE.Group();
  hubGroup.position.set(1.04, 0, -0.02);
  hubGroup.rotation.y = -0.16;
  bench.scene.add(hubGroup);

  const monitorStand = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.2, 0.16, 0.1)), metalMat);
  monitorStand.position.set(0, 0.08, -0.22);
  hubGroup.add(monitorStand);

  const monitorFrame = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.84, 0.54, 0.06)), darkMat);
  monitorFrame.position.set(0, 0.4, -0.2);
  monitorFrame.castShadow = true;
  hubGroup.add(monitorFrame);

  const supervisionScreen = makeCanvasScreen(440, 280, (ctx, w, h, st) => {
    const s = st || state;
    const ev = evaluateJpoDomotiqueState(s);
    ctx.fillStyle = '#070f1d';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = ev.allValid ? '#22c55e' : '#06b6d4';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('BOX DOMOTIQUE • SUPERVISION', 16, 28);

    ctx.fillStyle = s.timeOfDay === 'night' ? '#312e81' : '#0284c7';
    ctx.fillRect(w - 118, 10, 102, 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(s.timeOfDay === 'night' ? '🌙 NUIT' : '☀️ JOUR', w - 98, 27);

    const sensorBadges = [
      { label: 'PRÉSENCE', ok: s.sensorPresence, x: 16 },
      { label: 'TEMPÉRATURE', ok: s.sensorTemp, x: 156 },
      { label: 'VOLETS', ok: s.sensorShutters, x: 296 }
    ];
    for (const b of sensorBadges) {
      ctx.fillStyle = b.ok ? '#064e3b' : '#1e293b';
      ctx.fillRect(b.x, 46, 128, 36);
      ctx.strokeStyle = b.ok ? '#22c55e' : '#475569';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, 46, 128, 36);
      ctx.fillStyle = b.ok ? '#86efac' : '#94a3b8';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`${b.ok ? '●' : '○'} ${b.label}`, b.x + 10, 68);
    }

    const shutterPct = Math.round((1 - (s.shutterLevel - 0.08) / 0.87) * 100);
    const clampedShutter = Math.max(0, Math.min(100, shutterPct));
    const lightActive = s.ruleAutoLight && s.sensorPresence && s.timeOfDay === 'night';

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(16, 94, w - 32, 114);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(16, 94, w - 32, 114);

    ctx.fillStyle = '#67e8f9';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(`Consigne chauffage : ${s.targetTemp}°C (${s.ruleEcoHeat ? 'ÉCO ACTIF' : 'MANUEL'})`, 28, 122);
    ctx.fillStyle = lightActive ? '#fde047' : '#cbd5e1';
    ctx.fillText(`Éclairage LED auto : ${s.ruleAutoLight ? (lightActive ? 'ALLUMÉ (NUIT)' : 'VEILLE JOUR') : 'DÉSACTIVÉ'}`, 28, 148);
    ctx.fillStyle = '#a5f3fc';
    ctx.fillText(`Volets roulants : ${clampedShutter}% ouverts`, 28, 174);
    ctx.fillStyle = s.ruleAlarm ? '#4ade80' : '#f87171';
    ctx.fillText(`Sécurité / Alarme : ${s.ruleAlarm ? 'ARMÉE ✔' : 'NON ARMÉE'}`, 28, 198);

    ctx.fillStyle = ev.allValid ? '#14532d' : '#1e293b';
    ctx.fillRect(16, 220, w - 32, 42);
    ctx.fillStyle = ev.allValid ? '#86efac' : '#f8fafc';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(
      s.simRunning
        ? `Test Jour/Nuit en direct... ${Math.round(s.simProgress * 100)}%`
        : ev.allValid
          ? 'Maison connectée 100% automatisée !'
          : `Progression : ${ev.completedSteps} / 3 étapes validées`,
      28,
      246
    );
  }, { minIntervalMs: CANVAS_THROTTLE_MS });
  bench.track(supervisionScreen.texture);

  const monitorFace = new THREE.Mesh(
    bench.track(new THREE.PlaneGeometry(0.76, 0.46)),
    bench.track(new THREE.MeshBasicMaterial({ map: supervisionScreen.texture }))
  );
  monitorFace.position.set(0, 0.4, -0.165);
  hubGroup.add(monitorFace);

  const gatewayBox = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.56, 0.085, 0.32)), chassisMat);
  gatewayBox.position.set(0, 0.045, 0.18);
  gatewayBox.castShadow = true;
  hubGroup.add(gatewayBox);

  const gatewayRingMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#06b6d4', emissive: '#06b6d4', emissiveIntensity: 0.95 })
  );
  const gatewayRing = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.42, 0.015, 0.02)), gatewayRingMat);
  gatewayRing.position.set(0, 0.055, 0.342);
  hubGroup.add(gatewayRing);

  const antennaGeo = bench.track(new THREE.CylinderGeometry(0.008, 0.011, 0.18, 8));
  for (const ax of [-0.21, 0.21]) {
    const ant = new THREE.Mesh(antennaGeo, darkMat);
    ant.position.set(ax, 0.16, 0.06);
    ant.rotation.z = ax < 0 ? 0.12 : -0.12;
    hubGroup.add(ant);
  }

  const hubLedGeo = bench.track(new THREE.SphereGeometry(0.018, 10, 10));
  const hubSensorLeds = [];
  for (let i = 0; i < 3; i++) {
    const mat = bench.track(
      new THREE.MeshStandardMaterial({ color: '#334155', emissive: '#06b6d4', emissiveIntensity: 0.1 })
    );
    const led = new THREE.Mesh(hubLedGeo, mat);
    led.position.set(-0.14 + i * 0.14, 0.092, 0.22);
    hubGroup.add(led);
    hubSensorLeds.push(mat);
  }

  const wirelessRoutes = [
    { key: 'sensorPresence', color: '#06b6d4', pts: [[-1.42, 0.58, -0.32], [-0.25, 0.68, -0.15], [0.95, 0.22, 0.15]] },
    { key: 'sensorTemp', color: '#22c55e', pts: [[-0.32, 0.42, -0.34], [0.35, 0.48, -0.15], [1.04, 0.22, 0.15]] },
    { key: 'sensorShutters', color: '#38bdf8', pts: [[-0.22, 0.58, 0.4], [0.42, 0.46, 0.3], [1.14, 0.22, 0.15]] }
  ];
  const pulseGeo = bench.track(new THREE.SphereGeometry(0.022, 8, 8));
  const signalPulses = [];

  for (const wr of wirelessRoutes) {
    const curve = new THREE.CatmullRomCurve3(wr.pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    const linkCable = new THREE.Mesh(
      bench.track(new THREE.TubeGeometry(curve, 22, 0.006, 6, false)),
      bench.track(new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.5 }))
    );
    bench.scene.add(linkCable);

    const pulseMat = bench.track(
      new THREE.MeshStandardMaterial({ color: wr.color, emissive: wr.color, emissiveIntensity: 1.4 })
    );
    const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
    pulseMesh.visible = false;
    bench.scene.add(pulseMesh);
    signalPulses.push({ key: wr.key, curve, mesh: pulseMesh, offset: signalPulses.length * 0.33 });
  }

  let screensDirty = true;
  let lastShutterShadow = state.shutterLevel;
  let lastTimeShadow = state.timeOfDay;
  let lastScreenFlushMs = -Infinity;

  function flushScreens(forceAll = false) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!forceAll && now - lastScreenFlushMs < CANVAS_THROTTLE_MS) {
      return;
    }
    if (!forceAll && !screensDirty && !state.simRunning) {
      return;
    }
    lastScreenFlushMs = now;
    supervisionScreen.update(state);
    screensDirty = false;
  }

  function applyShuttersTransform() {
    const topY = 0.57;
    const fullH = 0.39;
    const curH = fullH * state.shutterLevel;
    shutters.forEach((curtain) => {
      curtain.scale.y = state.shutterLevel;
      curtain.position.y = topY - curH * 0.5;
    });
  }

  function sync3D() {
    const ev = evaluateJpoDomotiqueState(state);
    const isNight = state.timeOfDay === 'night';

    bench.scene.background.set(isNight ? '#091122' : '#132038');
    warmBenchLight.intensity = isNight ? 0.55 : 2.1;
    coolBenchLight.intensity = isNight ? 1.15 : 1.9;

    const lightsActive = state.sensorPresence && state.ruleAutoLight && isNight;
    const standbyGlow = state.sensorPresence && state.ruleAutoLight && !isNight;
    livingLight.intensity = lightsActive ? 2.4 : standbyGlow ? 0.35 : 0;
    bedroomLight.intensity = lightsActive ? 1.9 : standbyGlow ? 0.25 : 0;
    livingSpotMat.emissiveIntensity = lightsActive ? 1.8 : standbyGlow ? 0.45 : 0.04;
    bedroomSpotMat.emissiveIntensity = lightsActive ? 1.6 : standbyGlow ? 0.35 : 0.04;

    pirLedMat.emissiveIntensity = state.sensorPresence ? 1.5 : 0.05;
    pirConeMat.opacity = state.sensorPresence ? (isNight ? 0.24 : 0.14) : 0;
    tempProbeMat.emissiveIntensity = state.sensorTemp ? 1.5 : 0.05;
    shutterLedMat.emissiveIntensity = state.sensorShutters ? 1.4 : 0.04;

    const radColor = !state.sensorTemp
      ? '#475569'
      : state.ruleEcoHeat && ev.tempOk
        ? '#22c55e'
        : state.targetTemp > 21
          ? '#f59e0b'
          : '#38bdf8';
    radiatorLedMat.color.set(radColor);
    radiatorLedMat.emissive.set(radColor);
    radiatorLedMat.emissiveIntensity = state.sensorTemp ? (state.ruleEcoHeat ? 1.55 : 0.75) : 0.06;

    alarmBeaconMat.color.set(state.ruleAlarm ? (isNight ? '#22c55e' : '#06b6d4') : '#475569');
    alarmBeaconMat.emissive.set(state.ruleAlarm ? (isNight ? '#16a34a' : '#0284c7') : '#334155');
    alarmBeaconMat.emissiveIntensity = state.ruleAlarm ? (isNight ? 1.6 : 0.9) : 0.04;

    hubSensorLeds[0].emissiveIntensity = state.sensorPresence ? 1.6 : 0.08;
    hubSensorLeds[1].emissiveIntensity = state.sensorTemp ? 1.6 : 0.08;
    hubSensorLeds[2].emissiveIntensity = state.sensorShutters ? 1.6 : 0.08;

    gatewayRingMat.color.set(ev.allValid ? '#22c55e' : '#06b6d4');
    gatewayRingMat.emissive.set(ev.allValid ? '#16a34a' : '#06b6d4');

    wallStripMat.color.set(ev.allValid ? '#22c55e' : '#06b6d4');
    wallStripMat.emissive.set(ev.allValid ? '#22c55e' : '#06b6d4');

    signalPulses.forEach((sp) => {
      sp.mesh.visible = Boolean(state[sp.key]);
    });

    if (lastTimeShadow !== state.timeOfDay) {
      lastTimeShadow = state.timeOfDay;
      bench.requestShadowUpdate();
    }

    screensDirty = true;
    flushScreens(false);
  }

  function syncStagePills(ev) {
    api.setStages?.(
      [
        { name: ev.sensorsOk ? '1. Capteurs ✔' : '1. Capteurs' },
        { name: ev.rulesOk ? '2. Scénarios ✔' : '2. Scénarios' },
        { name: ev.simOk ? '3. Simulation ✔' : '3. Simulation' }
      ],
      ev.sensorsOk ? (ev.rulesOk ? 2 : 1) : 0,
      (idx) => {
        setCameraById(idx === 0 ? 'sensors' : idx === 1 ? 'hub' : 'house');
      }
    );
  }

  function submitJpoDomoTp() {
    if (state.submitted) return;
    state.submitted = true;
    const ev = evaluateJpoDomotiqueState(state);
    api.finishTp(
      ev.score,
      `
        <p>Maison connectée vérifiée par le <strong>Professeur CIEL</strong> :</p>
        <ul>
          <li>1. Capteurs IoT : <strong>${ev.pairedCount}/3 appairés</strong> (Présence, Température, Volets)</li>
          <li>2. Scénarios : <strong>${ev.rulesCount}/3 actifs • Consigne ${ev.targetTemp}°C</strong></li>
          <li>3. Test grandeur nature : <strong>${ev.simTested ? 'Cycle Jour/Nuit validé ✔' : 'Non exécuté'}</strong></li>
        </ul>
      `,
      ev.breakdown
    );
  }

  function startSimulation() {
    if (state.simRunning) return;
    state.simRunning = true;
    state.simProgress = 0;
    state.timeOfDay = 'day';
    sfx.interact();
    sync3D();
    refreshUi();
  }

  function updateSidebar() {
    const ev = evaluateJpoDomotiqueState(state);
    const sensorBtns = JPO_DOMO_SENSORS.map((sn) => {
      const active = Boolean(state[sn.key]);
      return `<button type="button" class="jpo-av-btn ${active ? 'success' : ''}" data-sensor="${sn.key}">${sn.icon} ${sn.label} ${active ? '✔' : ''}</button>`;
    }).join('');
    const ruleBtns = JPO_DOMO_RULES.map((rl) => {
      const active = Boolean(state[rl.key]);
      return `<button type="button" class="jpo-av-btn ${active ? 'active' : ''}" data-rule="${rl.key}">${rl.icon} ${rl.label} ${active ? 'ON' : 'OFF'}</button>`;
    }).join('');

    const drawer = bench.setSideDrawer(`
      <div class="jpo-av-drawer jpo-domo-drawer">
        <div class="jpo-av-advice" id="jpo-domo-advice">${ev.advice}</div>

        <div class="jpo-av-card ${ev.sensorsOk ? 'ok' : ''}" id="jpo-domo-card-sensors">
          <div class="jpo-av-card-head">
            <span>1. Connecter les capteurs</span>
            <strong id="jpo-domo-badge-sensors">${ev.sensorsOk ? '✅ 3/3' : `⏳ ${ev.pairedCount}/3`}</strong>
          </div>
          <div class="jpo-av-btn-row">${sensorBtns}</div>
        </div>

        <div class="jpo-av-card ${ev.rulesOk ? 'ok' : ''}" id="jpo-domo-card-rules">
          <div class="jpo-av-card-head">
            <span>2. Scénarios intelligents</span>
            <strong id="jpo-domo-badge-rules">${ev.rulesOk ? '✅ OK' : `⏳ ${ev.rulesCount}/3`}</strong>
          </div>
          <div class="jpo-av-btn-row">${ruleBtns}</div>
          <label class="jpo-av-slider-row">
            <span>Consigne Éco (19–21°C)</span>
            <input type="range" id="jpo-domo-temp-range" min="16" max="25" value="${state.targetTemp}" />
            <strong id="jpo-domo-temp-val">${state.targetTemp}°C</strong>
          </label>
        </div>

        <div class="jpo-av-card ${ev.simOk ? 'ok' : ''}" id="jpo-domo-card-sim">
          <div class="jpo-av-card-head">
            <span>3. Test grandeur nature</span>
            <strong id="jpo-domo-badge-sim">${ev.simOk ? '✅ VALIDÉ' : state.simRunning ? '⏳ EN COURS' : '⏳ À TESTER'}</strong>
          </div>
          <div class="jpo-av-btn-row">
            <button type="button" id="jpo-domo-day-btn" class="jpo-av-btn ${state.timeOfDay === 'day' ? 'active' : ''}">☀️ Mode Jour</button>
            <button type="button" id="jpo-domo-night-btn" class="jpo-av-btn ${state.timeOfDay === 'night' ? 'active' : ''}">🌙 Mode Nuit</button>
          </div>
          <div class="jpo-av-btn-row">
            <button type="button" id="jpo-domo-sim-btn" class="jpo-av-btn ${state.simRunning ? 'live' : 'primary'}" ${state.simRunning ? 'disabled' : ''}>
              ${state.simRunning ? '⏳ Simulation Jour/Nuit...' : '🌞🌙 Lancer le test Jour / Nuit'}
            </button>
          </div>
          <div class="jpo-domo-sim-bar">
            <div id="jpo-domo-sim-fill" class="jpo-domo-sim-fill" style="width:${Math.round(state.simProgress * 100)}%"></div>
          </div>
        </div>
      </div>
    `);

    if (!drawer) return;
    drawer.querySelectorAll('[data-sensor]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.sensor;
        state[key] = !state[key];
        sfx.click();
        sync3D();
        refreshUi();
      });
    });
    drawer.querySelectorAll('[data-rule]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.rule;
        state[key] = !state[key];
        sfx.click();
        sync3D();
        refreshUi();
      });
    });
    drawer.querySelector('#jpo-domo-temp-range')?.addEventListener('input', (e) => {
      state.targetTemp = Number(e.target.value);
      sync3D();
      syncLiveValues();
    });
    drawer.querySelector('#jpo-domo-temp-range')?.addEventListener('change', () => refreshUi());
    drawer.querySelector('#jpo-domo-day-btn')?.addEventListener('click', () => {
      state.timeOfDay = 'day';
      sfx.click();
      sync3D();
      refreshUi();
    });
    drawer.querySelector('#jpo-domo-night-btn')?.addEventListener('click', () => {
      state.timeOfDay = 'night';
      if (state.sensorPresence && state.sensorTemp && state.sensorShutters && state.ruleAutoLight && state.ruleEcoHeat && state.ruleAlarm) {
        state.simTested = true;
      }
      sfx.click();
      sync3D();
      refreshUi();
    });
    drawer.querySelector('#jpo-domo-sim-btn')?.addEventListener('click', startSimulation);
  }

  function syncLiveValues() {
    const ev = evaluateJpoDomotiqueState(state);
    bench.setInstruction(
      'MAISON CONNECTÉE • DÉCOUVERTE',
      `Étapes validées : ${ev.completedSteps} / 3`,
      ev.advice
    );
    bench.setAccuracy(`${ev.score.toFixed(1)} / 20`);
    syncStagePills(ev);
    const advEl = api.container.querySelector('#jpo-domo-advice');
    if (advEl) advEl.textContent = ev.advice;
    const tempVal = api.container.querySelector('#jpo-domo-temp-val');
    if (tempVal) tempVal.textContent = `${state.targetTemp}°C`;
    const badgeRules = api.container.querySelector('#jpo-domo-badge-rules');
    if (badgeRules) badgeRules.textContent = ev.rulesOk ? '✅ OK' : `⏳ ${ev.rulesCount}/3`;
    api.container.querySelector('#jpo-domo-card-rules')?.classList.toggle('ok', ev.rulesOk);
    const simFill = api.container.querySelector('#jpo-domo-sim-fill');
    if (simFill) simFill.style.width = `${Math.round(state.simProgress * 100)}%`;
  }

  function refreshUi() {
    const ev = evaluateJpoDomotiqueState(state);
    bench.setInstruction(
      'MAISON CONNECTÉE • DÉCOUVERTE',
      `Étapes validées : ${ev.completedSteps} / 3`,
      ev.advice
    );
    bench.setAccuracy(`${ev.score.toFixed(1)} / 20`);
    syncStagePills(ev);

    bench.setTools(
      [
        { id: 'sensors', icon: '📡', label: ev.sensorsOk ? 'Capteurs 3/3' : 'Tout appairer' },
        { id: 'rules', icon: '⚙️', label: ev.rulesOk ? 'Scénarios OK' : 'Activer Scénarios' },
        { id: 'sim', icon: '🌞', label: state.simRunning ? 'Test actif' : 'Test Jour/Nuit' }
      ],
      ev.sensorsOk ? (ev.rulesOk ? 'sim' : 'rules') : 'sensors',
      (toolId) => {
        if (toolId === 'sensors') {
          state.sensorPresence = true;
          state.sensorTemp = true;
          state.sensorShutters = true;
          sfx.click();
          sync3D();
          refreshUi();
        } else if (toolId === 'rules') {
          state.ruleAutoLight = true;
          state.ruleEcoHeat = true;
          state.ruleAlarm = true;
          state.targetTemp = 20;
          sfx.click();
          sync3D();
          refreshUi();
        } else if (toolId === 'sim') {
          startSimulation();
        }
      }
    );

    bench.setActions([
      {
        id: 'jpo-domo-finish',
        label: ev.allValid ? '✅ Valider la maison' : '✅ Terminer',
        primary: ev.allValid,
        disabled: state.submitted,
        onClick: submitJpoDomoTp
      },
      {
        id: 'jpo-domo-hint',
        label: '💡 Astuce',
        onClick: () => {
          bench.showToast(
            '1) Appaire les 3 capteurs. 2) Active les 3 scénarios + consigne 19-21°C. 3) Lance le test Jour/Nuit !',
            'info'
          );
        }
      },
      {
        id: 'jpo-domo-reset',
        label: '🔄 Recommencer',
        onClick: () => {
          state.sensorPresence = false;
          state.sensorTemp = false;
          state.sensorShutters = false;
          state.ruleAutoLight = false;
          state.ruleEcoHeat = false;
          state.ruleAlarm = false;
          state.targetTemp = 20;
          state.timeOfDay = 'day';
          state.simRunning = false;
          state.simTested = false;
          state.simProgress = 0;
          state.submitted = false;
          sync3D();
          refreshUi();
        }
      }
    ]);

    updateSidebar();
  }

  bench.addFloatingTag([-0.62, 1.02, 0.06], '1. Maison Connectée', 'info');
  bench.addFloatingTag([-0.84, 0.72, -0.34], '2. Capteurs IoT', 'info');
  bench.addFloatingTag([1.04, 0.78, -0.18], '3. Box Domotique', 'info');

  let screenAccum = 0;
  const _tmpVec = new THREE.Vector3();
  const unsubTick = bench.addUpdate((dt) => {
    state.animPhase += dt * 1.15;

    const targetShutter = state.timeOfDay === 'night' && state.sensorShutters ? 0.95 : 0.08;
    const prevShutter = state.shutterLevel;
    state.shutterLevel += (targetShutter - state.shutterLevel) * Math.min(1, dt * 4.5);
    if (Math.abs(state.shutterLevel - prevShutter) > 0.0005) {
      applyShuttersTransform();
      if (Math.abs(state.shutterLevel - lastShutterShadow) > 0.05) {
        lastShutterShadow = state.shutterLevel;
        bench.requestShadowUpdate();
      }
      screensDirty = true;
    }

    signalPulses.forEach((sp) => {
      if (!sp.mesh.visible) return;
      const t = (state.animPhase * 0.55 + sp.offset) % 1;
      sp.curve.getPoint(t, _tmpVec);
      sp.mesh.position.copy(_tmpVec);
    });

    if (state.simRunning) {
      state.simProgress = Math.min(1, state.simProgress + dt / 3.0);
      if (state.simProgress >= 0.3 && state.timeOfDay !== 'night') {
        state.timeOfDay = 'night';
        sync3D();
      }
      if (state.simProgress >= 1) {
        state.simRunning = false;
        state.simTested = true;
        sfx.success();
        sync3D();
        refreshUi();
      }
    }

    screenAccum += dt;
    if (screenAccum >= CANVAS_THROTTLE_SEC) {
      screenAccum = 0;
      if (state.simRunning) {
        const simFill = api.container.querySelector('#jpo-domo-sim-fill');
        if (simFill) simFill.style.width = `${Math.round(state.simProgress * 100)}%`;
      }
      flushScreens(false);
    }
  });

  bench.freezeStatic([
    ...shutters,
    ...signalPulses.map((sp) => sp.mesh)
  ]);

  applyShuttersTransform();
  sync3D();
  flushScreens(true);
  setCameraById('overview');
  refreshUi();

  return {
    destroy: () => {
      unsubTick();
      bench.destroy();
    }
  };
}
