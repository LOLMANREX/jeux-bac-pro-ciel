import * as THREE from 'three';
import { sfx } from '../core/audio.js';
import { toSafeNumber, finalizeGrade20, createGradeBreakdown } from '../core/grading.js';
import { createWorkbench3D, makeCanvasScreen } from './Workbench3DHost.js';

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

export const SOLDER_STAGES = [
  {
    id: 1,
    name: '1. Alimentation & Passifs',
    brief: 'Allumez l’extracteur de fumées, réglez la station entre 340°C et 365°C, chauffez chaque pastille (2-3s), apportez l’étain et retirez le fer avant surchauffe.',
    pads: [
      { id: 'P1', label: 'J1-VCC', x: -0.52, z: -0.22, r: 0.042, mass: 1.0, state: 'empty' },
      { id: 'P2', label: 'J1-GND', x: -0.52, z: 0.08, r: 0.046, mass: 1.45, state: 'empty' },
      { id: 'P3', label: 'R1-A', x: -0.18, z: -0.18, r: 0.038, mass: 1.0, state: 'empty' },
      { id: 'P4', label: 'C1-GND', x: 0.14, z: 0.16, r: 0.044, mass: 1.4, state: 'empty' }
    ],
    bridges: []
  },
  {
    id: 2,
    name: '2. Microcontrôleur & Pont',
    brief: 'Nettoyez d’abord le pont de soudure sur U1 avec la Tresse cuivre, brasez les dernières pattes puis actionnez l’interrupteur 5V pour tester les LEDs du PCB !',
    pads: [
      { id: 'U2', label: 'U1-TX', x: 0.28, z: -0.14, r: 0.036, mass: 0.95, state: 'bridge' },
      { id: 'U3', label: 'U1-RX', x: 0.40, z: -0.14, r: 0.036, mass: 0.95, state: 'bridge' },
      { id: 'U4', label: 'U1-PWM', x: 0.52, z: -0.14, r: 0.036, mass: 1.0, state: 'empty' },
      { id: 'LED1', label: 'LED-OK', x: 0.50, z: 0.16, r: 0.04, mass: 1.1, state: 'empty' }
    ],
    bridges: [['U2', 'U3']]
  }
];

export function evaluateSolderStage(pads, tempC, fumeExtractorOn, reworkCount) {
  const list = Array.isArray(pads) ? pads : [];
  const allGood = list.every((p) => p.state === 'good');
  const safeTemp = Number.isFinite(Number(tempC)) ? Math.round(Number(tempC)) : 0;
  const safeReworks = Math.max(0, Math.floor(toSafeNumber(reworkCount, 0)));
  const tempOk = safeTemp >= 330 && safeTemp <= 375;
  let ratio = 0;
  if (allGood) ratio += 0.7;
  if (tempOk) ratio += 0.15;
  if (fumeExtractorOn) ratio += 0.15;
  const billedReworks = Math.max(0, safeReworks - 2);
  ratio = Math.max(0.4, ratio - Math.min(0.15, billedReworks * 0.02));
  return { allGood, tempOk, ratio };
}

export function evaluateSolderingScore3D({ pads, tempC, fumeExtractorOn, burnCount, reworkCount, powerTestedOk, durationSec } = {}) {
  const list = Array.isArray(pads) ? pads : [];
  const total = Math.max(1, list.length);
  const goodCount = list.filter((p) => p.state === 'good').length;
  const coldCount = list.filter((p) => p.state === 'cold').length;
  const bridgeCount = list.filter((p) => p.state === 'bridge').length;
  const burntCount = list.filter((p) => p.burnt || p.state === 'burnt').length;
  const safeTemp = Number.isFinite(Number(tempC)) ? Math.round(Number(tempC)) : 0;
  const safeBurns = Math.max(0, Math.floor(toSafeNumber(burnCount, 0)));
  const safeReworks = Math.max(0, Math.floor(toSafeNumber(reworkCount, 0)));
  const safeDuration = Math.max(0, toSafeNumber(durationSec, 90));

  const qualityPts = Math.min(12.0, (goodCount / total) * 12.0 + (coldCount / total) * 5.0);
  const extractorPts = fumeExtractorOn ? 2.5 : 0;
  const tempPts = safeTemp >= 330 && safeTemp <= 375 ? 2.5 : safeTemp >= 310 && safeTemp <= 390 ? 1.5 : 0;
  const powerPts = powerTestedOk ? 2.0 : 0;
  const speedPts = safeDuration <= 360 ? 1.0 : safeDuration <= 540 ? 0.75 : 0.5;

  const forgivenReworks = Math.min(2, safeReworks);
  const billedReworks = Math.max(0, safeReworks - 2);
  const reworkPenalty = Math.min(1.0, billedReworks * 0.25);

  const allClean = goodCount === total && bridgeCount === 0 && burntCount === 0;
  const burnPenalty =
    safeBurns === 0
      ? 0
      : allClean
        ? Math.min(2.5, 0.5 + Math.max(0, safeBurns - 1) * 0.75)
        : Math.min(2.5, safeBurns * 1.0);
  const bridgePenalty = Math.min(2.5, bridgeCount * 1.2);

  const rawScore = Math.max(
    0,
    qualityPts + extractorPts + tempPts + powerPts + speedPts - reworkPenalty - burnPenalty - bridgePenalty
  );

  const hasCriticalError =
    goodCount < total ||
    bridgeCount > 0 ||
    burntCount > 0 ||
    !fumeExtractorOn ||
    !powerTestedOk ||
    safeTemp < 310 ||
    safeTemp > 390;

  const score = finalizeGrade20(rawScore, { hasCriticalError });

  const items = [
    {
      label: `Qualité des brasures (${goodCount}/${total})`,
      earned: qualityPts,
      max: 12.0,
      status: goodCount === total ? 'ok' : goodCount > 0 ? 'warn' : 'fail'
    },
    { label: 'Extracteur de fumées (EPI)', earned: extractorPts, max: 2.5 },
    {
      label: `Température station (${safeTemp}°C)`,
      earned: tempPts,
      max: 2.5,
      detail: 'Cible 330–375°C'
    },
    { label: 'Mise sous tension & Test 5V LEDs', earned: powerPts, max: 2.0 },
    {
      label: 'Maîtrise du rythme de brasage',
      earned: speedPts,
      max: 1.0,
      detail: `${Math.round(safeDuration)}s`
    }
  ];

  const penalties = [];
  if (safeReworks > 0) {
    penalties.push({
      label:
        billedReworks === 0
          ? `Reprises à la tresse (${safeReworks})`
          : `Reprises à la tresse (${billedReworks} facturée(s), 2 offertes)`,
      points: reworkPenalty,
      forgivenCount: forgivenReworks
    });
  }
  if (safeBurns > 0) {
    penalties.push({
      label: `Surchauffes PCB (${safeBurns})`,
      points: burnPenalty,
      forgivenCount: 0
    });
  }
  if (bridgeCount > 0) {
    penalties.push({
      label: `Ponts d’étain non nettoyés (${bridgeCount})`,
      points: bridgePenalty,
      forgivenCount: 0
    });
  }

  let tip = '';
  if (!fumeExtractorOn) tip = 'Allumez l’extracteur de fumées avant de commencer à braser.';
  else if (bridgeCount > 0) tip = 'Nettoyez les ponts d’étain à la tresse cuivre.';
  else if (goodCount < total) tip = 'Terminez toutes les pastilles jusqu’à obtenir une brasure brillante.';
  else if (safeTemp < 330 || safeTemp > 375) tip = 'Réglez la station entre 330°C et 375°C (idéal 350°C).';
  else if (!powerTestedOk) tip = 'Actionnez l’interrupteur 5V pour valider les LEDs.';
  else if (safeBurns > 0) tip = 'Retirez le fer dès que la pastille atteint ~215°C et 65% d’étain.';

  const breakdown = createGradeBreakdown({
    items,
    penalties,
    rawScore,
    finalScore: score,
    hasCriticalError,
    tip
  });

  return { score, rawScore, breakdown };
}

export function computeSolderingScore3D(metrics = {}) {
  return evaluateSolderingScore3D(metrics).score;
}

export function createSolderingGame(api) {
  const allPads = [...SOLDER_STAGES[0].pads, ...SOLDER_STAGES[1].pads].map((p) => ({
    ...p,
    temp: 25,
    tinProgress: p.state === 'bridge' ? 1 : 0,
    burnt: false,
    smokeTimer: 0
  }));

  let stageIdx = 0;
  let tempC = 280;
  let tempDialRaw = 280;
  let fumeExtractorOn = false;
  let tool = 'iron';
  let heatingActive = false;
  let tinFeeding = false;
  let activePad = null;
  let selectedPadId = allPads[0]?.id || 'P1';
  let touchSolderTimer = null;
  let burnCount = 0;
  let reworkCount = 0;
  let powerOn = false;
  let pcbPowerLedTime = 0;
  let finalized = false;

  const stopTouchHold = () => {
    if (touchSolderTimer) {
      clearInterval(touchSolderTimer);
      touchSolderTimer = null;
    }
  };

  const wb = createWorkbench3D(api.container, {
    cameraPos: [0, 1.18, 1.56],
    lookAt: [0, 0.14, -0.02],
    fov: 40,
    background: '#131c2e',
    wallColor: '#1a253a',
    benchColor: '#222b3a',
    benchWidth: 4.2,
    benchDepth: 2.0,
    envIntensity: 0.9,
    hasEsdMat: false
  });

  const lampSpotLight = new THREE.SpotLight('#fff3d6', 4.4, 4.8, 0.66, 0.52, 1.1);
  lampSpotLight.position.set(-0.08, 0.98, -0.18);
  lampSpotLight.target.position.set(0.02, 0.14, 0.04);
  lampSpotLight.castShadow = true;
  lampSpotLight.shadow.mapSize.set(1024, 1024);
  lampSpotLight.shadow.bias = -0.0005;
  wb.scene.add(lampSpotLight);
  wb.scene.add(lampSpotLight.target);

  const warmFillLight = new THREE.PointLight('#fed7aa', 1.5, 7, 1.5);
  warmFillLight.position.set(-1.1, 1.35, 0.9);
  wb.scene.add(warmFillLight);

  const coolRimLight = new THREE.PointLight('#38bdf8', 1.1, 7, 1.5);
  coolRimLight.position.set(1.3, 1.25, -0.8);
  wb.scene.add(coolRimLight);

  const pcbTestLight = new THREE.PointLight('#22c55e', 0, 1.5, 1.8);
  pcbTestLight.position.set(0.56, 0.24, 0.30);
  wb.scene.add(pcbTestLight);

  const darkLabMat = wb.track(
    new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.42, metalness: 0.62 })
  );
  const standMat = wb.track(new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.35, metalness: 0.8 }));
  const chromeMat = wb.track(new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.2, metalness: 0.88 }));

  const elecWallTex = wb.track(
    makeCanvasTexture(1024, 512, (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#111a2c');
      grad.addColorStop(0.55, '#19263e');
      grad.addColorStop(1, '#101829');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = 'rgba(148, 163, 184, 0.14)';
      for (let x = 24; x < w; x += 28) {
        for (let y = 24; y < h; y += 28) {
          ctx.beginPath();
          ctx.arc(x, y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.fillStyle = 'rgba(251, 191, 36, 0.22)';
      ctx.fillRect(0, 42, w, 5);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
      ctx.fillRect(0, h - 46, w, 5);
    })
  );
  const elecBackWall = new THREE.Mesh(
    wb.track(new THREE.PlaneGeometry(5.6, 2.6)),
    wb.track(new THREE.MeshStandardMaterial({ map: elecWallTex, roughness: 0.68, metalness: 0.12 }))
  );
  elecBackWall.position.set(0, 1.15, -1.04);
  elecBackWall.receiveShadow = true;
  wb.scene.add(elecBackWall);

  const elecWallRailMat = wb.track(
    new THREE.MeshStandardMaterial({ color: '#fbbf24', emissive: '#f59e0b', emissiveIntensity: 0.85 })
  );
  const elecTopRail = new THREE.Mesh(wb.track(new THREE.BoxGeometry(3.2, 0.016, 0.022)), elecWallRailMat);
  elecTopRail.position.set(0, 0.62, -1.01);
  wb.scene.add(elecTopRail);

  const elecSignFrame = new THREE.Mesh(wb.track(new THREE.BoxGeometry(1.56, 0.23, 0.04)), darkLabMat);
  elecSignFrame.position.set(0, 0.42, -1.0);
  wb.scene.add(elecSignFrame);

  const elecSignScreen = makeCanvasScreen(760, 120, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, w, 0);
    bg.addColorStop(0, '#0f172a');
    bg.addColorStop(0.5, '#172a45');
    bg.addColorStop(1, '#0f172a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POSTE BRASURE ÉLECTRONIQUE • BAC PRO CIEL', w / 2, 54);

    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText('STATION THERMORÉGULÉE SAC305  •  POSTE ESD  •  CONTRÔLE PCB 5V', w / 2, 90);
    ctx.textAlign = 'left';
  });
  wb.track(elecSignScreen.texture);
  const elecSignFace = new THREE.Mesh(
    wb.track(new THREE.PlaneGeometry(1.48, 0.19)),
    wb.track(new THREE.MeshBasicMaterial({ map: elecSignScreen.texture }))
  );
  elecSignFace.position.set(0, 0.42, -0.978);
  wb.scene.add(elecSignFace);

  const esdMatTex = wb.track(
    makeCanvasTexture(1024, 512, (ctx, w, h) => {
      ctx.fillStyle = '#154c6b';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(186, 230, 253, 0.16)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= w; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += 16) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(186, 230, 253, 0.34)';
      ctx.lineWidth = 2;
      for (let x = 0; x <= w; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += 80) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(224, 242, 254, 0.45)';
      ctx.lineWidth = 5;
      ctx.strokeRect(10, 10, w - 20, h - 20);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.42)';
      ctx.fillRect(14, h - 42, w - 28, 28);
      ctx.fillStyle = 'rgba(224, 242, 254, 0.85)';
      for (let mx = 40; mx < w - 40; mx += 10) {
        const mh = mx % 50 === 0 ? 12 : 6;
        ctx.fillRect(mx, h - 42, 1.5, mh);
      }

      ctx.font = 'bold 16px monospace';
      ctx.fillText('TAPIS ESD ANTISTATIQUE • 1 MΩ • POSTE BRASURE CIEL', 28, 36);
    })
  );
  const esdMatMesh = new THREE.Mesh(
    wb.track(new THREE.BoxGeometry(2.55, 0.012, 1.48)),
    wb.track(new THREE.MeshStandardMaterial({ map: esdMatTex, roughness: 0.72, metalness: 0.06 }))
  );
  esdMatMesh.position.set(0, 0.006, 0.04);
  esdMatMesh.receiveShadow = true;
  wb.scene.add(esdMatMesh);

  const esdSnapStud = new THREE.Mesh(wb.track(new THREE.CylinderGeometry(0.024, 0.028, 0.01, 14)), chromeMat);
  esdSnapStud.position.set(-1.14, 0.014, 0.62);
  wb.scene.add(esdSnapStud);

  const lampGroup = new THREE.Group();
  lampGroup.position.set(-0.46, 0.01, -0.68);
  wb.scene.add(lampGroup);

  const lampBase = new THREE.Mesh(wb.track(new THREE.CylinderGeometry(0.11, 0.13, 0.032, 20)), darkLabMat);
  lampBase.position.y = 0.016;
  lampBase.castShadow = true;
  lampGroup.add(lampBase);

  const lampLowerArm = new THREE.Mesh(wb.track(new THREE.CylinderGeometry(0.014, 0.014, 0.56, 12)), standMat);
  lampLowerArm.position.set(0.04, 0.28, 0.08);
  lampLowerArm.rotation.x = 0.28;
  lampLowerArm.rotation.z = -0.15;
  lampLowerArm.castShadow = true;
  lampGroup.add(lampLowerArm);

  const lampJoint = new THREE.Mesh(wb.track(new THREE.SphereGeometry(0.024, 12, 12)), chromeMat);
  lampJoint.position.set(0.09, 0.53, 0.16);
  lampGroup.add(lampJoint);

  const lampUpperArm = new THREE.Mesh(wb.track(new THREE.CylinderGeometry(0.012, 0.012, 0.52, 12)), standMat);
  lampUpperArm.position.set(0.24, 0.76, 0.34);
  lampUpperArm.rotation.x = 0.65;
  lampUpperArm.rotation.z = -0.45;
  lampUpperArm.castShadow = true;
  lampGroup.add(lampUpperArm);

  const lampHead = new THREE.Group();
  lampHead.position.set(0.38, 0.96, 0.5);
  lampHead.rotation.x = 0.58;
  lampHead.rotation.y = -0.18;
  lampGroup.add(lampHead);

  const lampShade = new THREE.Mesh(wb.track(new THREE.BoxGeometry(0.42, 0.045, 0.11)), darkLabMat);
  lampShade.castShadow = true;
  lampHead.add(lampShade);

  const lampLedBar = new THREE.Mesh(
    wb.track(new THREE.PlaneGeometry(0.38, 0.07)),
    wb.track(new THREE.MeshBasicMaterial({ color: '#fef3c7', side: THREE.DoubleSide }))
  );
  lampLedBar.rotation.x = Math.PI / 2;
  lampLedBar.position.y = -0.024;
  lampHead.add(lampLedBar);

  const pcbGroup = new THREE.Group();
  pcbGroup.position.set(0.02, 0.14, 0.04);
  wb.scene.add(pcbGroup);

  const helpingHandsGroup = new THREE.Group();
  wb.scene.add(helpingHandsGroup);
  const hhRail = new THREE.Mesh(wb.track(new THREE.BoxGeometry(1.56, 0.022, 0.06)), darkLabMat);
  hhRail.position.set(0, 0.02, -0.34);
  hhRail.castShadow = true;
  helpingHandsGroup.add(hhRail);

  const hhBaseGeo = wb.track(new THREE.CylinderGeometry(0.075, 0.095, 0.032, 18));
  const hhCollarGeo = wb.track(new THREE.CylinderGeometry(0.026, 0.032, 0.024, 14));
  const hhArmGeo = wb.track(new THREE.CylinderGeometry(0.013, 0.013, 0.105, 12));
  const hhJointGeo = wb.track(new THREE.SphereGeometry(0.02, 12, 12));
  const hhBootGeo = wb.track(new THREE.BoxGeometry(0.044, 0.028, 0.036));
  const hhJawGeo = wb.track(new THREE.BoxGeometry(0.042, 0.01, 0.022));
  for (const sx of [-0.74, 0.74]) {
    const base = new THREE.Mesh(hhBaseGeo, darkLabMat);
    base.position.set(sx, 0.022, 0.04);
    base.castShadow = true;
    helpingHandsGroup.add(base);

    const collar = new THREE.Mesh(hhCollarGeo, chromeMat);
    collar.position.set(sx, 0.044, 0.04);
    helpingHandsGroup.add(collar);

    const arm = new THREE.Mesh(hhArmGeo, chromeMat);
    arm.position.set(sx, 0.095, 0.04);
    helpingHandsGroup.add(arm);

    const ballJoint = new THREE.Mesh(hhJointGeo, chromeMat);
    ballJoint.position.set(sx, 0.142, 0.04);
    helpingHandsGroup.add(ballJoint);

    const dir = sx > 0 ? -1 : 1;
    const bootMat = wb.track(
      new THREE.MeshStandardMaterial({ color: sx < 0 ? '#dc2626' : '#0f172a', roughness: 0.55 })
    );
    const boot = new THREE.Mesh(hhBootGeo, bootMat);
    boot.position.set(sx + dir * 0.028, 0.142, 0.04);
    helpingHandsGroup.add(boot);

    const upperJaw = new THREE.Mesh(hhJawGeo, chromeMat);
    upperJaw.position.set(sx + dir * 0.056, 0.153, 0.04);
    upperJaw.rotation.z = dir * -0.06;
    helpingHandsGroup.add(upperJaw);

    const lowerJaw = new THREE.Mesh(hhJawGeo, chromeMat);
    lowerJaw.position.set(sx + dir * 0.056, 0.131, 0.04);
    lowerJaw.rotation.z = dir * 0.06;
    helpingHandsGroup.add(lowerJaw);
  }

  const pcbCanvas = document.createElement('canvas');
  pcbCanvas.width = 1024;
  pcbCanvas.height = 680;
  const pCtx = pcbCanvas.getContext('2d');
  pCtx.fillStyle = '#064e3b';
  pCtx.fillRect(0, 0, 1024, 680);

  pCtx.strokeStyle = 'rgba(16, 185, 129, 0.12)';
  pCtx.lineWidth = 2;
  for (let x = -680; x < 1024 + 680; x += 22) {
    pCtx.beginPath();
    pCtx.moveTo(x, 0);
    pCtx.lineTo(x + 680, 680);
    pCtx.stroke();
  }

  pCtx.strokeStyle = '#34d399';
  pCtx.lineWidth = 4;
  pCtx.strokeRect(18, 18, 988, 644);

  const tracePaths = [
    [[140, 175], [290, 175], [350, 220], [580, 220], [640, 220]],
    [[140, 395], [310, 395], [400, 465], [610, 465], [820, 465]],
    [[640, 220], [740, 220], [855, 220], [855, 420]],
    [[340, 220], [340, 125], [640, 125], [640, 220]],
    [[180, 250], [270, 250], [330, 310], [520, 310]],
    [[680, 310], [780, 310], [840, 370], [890, 370]]
  ];
  for (const pathPts of tracePaths) {
    pCtx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
    pCtx.lineWidth = 10;
    pCtx.beginPath();
    pathPts.forEach(([x, y], idx) => (idx === 0 ? pCtx.moveTo(x, y) : pCtx.lineTo(x, y)));
    pCtx.stroke();

    pCtx.strokeStyle = '#fbbf24';
    pCtx.lineWidth = 5;
    pCtx.beginPath();
    pathPts.forEach(([x, y], idx) => (idx === 0 ? pCtx.moveTo(x, y) : pCtx.lineTo(x, y)));
    pCtx.stroke();
  }

  for (const [vx, vy] of [
    [290, 175],
    [580, 220],
    [400, 465],
    [740, 220],
    [340, 125],
    [520, 310],
    [780, 310]
  ]) {
    pCtx.beginPath();
    pCtx.arc(vx, vy, 8, 0, Math.PI * 2);
    pCtx.fillStyle = '#fbbf24';
    pCtx.fill();
    pCtx.beginPath();
    pCtx.arc(vx, vy, 3.5, 0, Math.PI * 2);
    pCtx.fillStyle = '#022c22';
    pCtx.fill();
  }

  pCtx.strokeStyle = '#e2e8f0';
  pCtx.lineWidth = 2.5;
  pCtx.strokeRect(52, 130, 150, 290);
  pCtx.strokeRect(275, 135, 165, 120);
  pCtx.strokeRect(615, 120, 260, 165);

  pCtx.fillStyle = '#f8fafc';
  pCtx.font = 'bold 26px monospace';
  pCtx.fillText('ATELIER CIEL — CARTE STM32 / PWM v4.5', 44, 66);
  pCtx.font = 'bold 20px monospace';
  pCtx.fillText('J1 PWR    R1 470Ω      C1 100µF      U1 STM32     LEDs TEST', 84, 616);
  allPads.forEach((pad) => {
    const px = Math.round((pad.x / 1.42 + 0.5) * 1024);
    const py = Math.round((pad.z / 0.86 + 0.5) * 680);
    pCtx.fillStyle = 'rgba(2, 6, 23, 0.78)';
    pCtx.fillRect(px - 44, py + 30, 88, 22);
    pCtx.fillStyle = '#fde68a';
    pCtx.font = 'bold 16px monospace';
    pCtx.textAlign = 'center';
    pCtx.fillText(pad.label, px, py + 46);
  });
  pCtx.textAlign = 'left';
  const pcbTex = wb.track(new THREE.CanvasTexture(pcbCanvas));
  pcbTex.colorSpace = THREE.SRGBColorSpace;
  pcbTex.needsUpdate = true;

  const boardMesh = new THREE.Mesh(
    wb.track(new THREE.BoxGeometry(1.42, 0.022, 0.86)),
    wb.track(
      new THREE.MeshPhysicalMaterial({
        map: pcbTex,
        roughness: 0.34,
        metalness: 0.12,
        clearcoat: 0.65,
        clearcoatRoughness: 0.22
      })
    )
  );
  boardMesh.castShadow = true;
  boardMesh.receiveShadow = true;
  pcbGroup.add(boardMesh);

  const goldHoleMat = wb.track(new THREE.MeshStandardMaterial({ color: '#fbbf24', metalness: 0.9, roughness: 0.2 }));
  const mountHoleGeo = wb.track(new THREE.TorusGeometry(0.022, 0.006, 8, 16));
  for (const [mx, mz] of [
    [-0.65, -0.37],
    [0.65, -0.37],
    [-0.65, 0.37],
    [0.65, 0.37]
  ]) {
    const holeRing = new THREE.Mesh(mountHoleGeo, goldHoleMat);
    holeRing.rotation.x = Math.PI / 2;
    holeRing.position.set(mx, 0.013, mz);
    pcbGroup.add(holeRing);
  }

  const j1Header = new THREE.Mesh(
    wb.track(new THREE.BoxGeometry(0.085, 0.048, 0.18)),
    darkLabMat
  );
  j1Header.position.set(-0.62, 0.035, -0.07);
  j1Header.castShadow = true;
  pcbGroup.add(j1Header);
  const j1PinGeo = wb.track(new THREE.BoxGeometry(0.014, 0.03, 0.014));
  for (const pz of [-0.11, -0.03]) {
    const j1Pin = new THREE.Mesh(j1PinGeo, goldHoleMat);
    j1Pin.position.set(-0.62, 0.06, pz);
    pcbGroup.add(j1Pin);
  }

  const rBody = new THREE.Mesh(
    wb.track(new THREE.CylinderGeometry(0.024, 0.024, 0.14, 14)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.42 }))
  );
  rBody.rotation.z = Math.PI / 2;
  rBody.position.set(-0.22, 0.036, -0.25);
  rBody.castShadow = true;
  pcbGroup.add(rBody);

  const bandColors = ['#facc15', '#7e22ce', '#78350f', '#fbbf24'];
  const resBandGeo = wb.track(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 14));
  bandColors.forEach((bc, bi) => {
    const band = new THREE.Mesh(
      resBandGeo,
      wb.track(new THREE.MeshStandardMaterial({ color: bc, roughness: 0.35 }))
    );
    band.rotation.z = Math.PI / 2;
    band.position.set(-0.265 + bi * 0.03, 0.036, -0.25);
    pcbGroup.add(band);
  });

  const capBody = new THREE.Mesh(
    wb.track(new THREE.CylinderGeometry(0.048, 0.048, 0.13, 18)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.3, metalness: 0.3 }))
  );
  capBody.position.set(0.08, 0.08, 0.16);
  capBody.castShadow = true;
  pcbGroup.add(capBody);

  const capTopVent = new THREE.Mesh(wb.track(new THREE.CylinderGeometry(0.044, 0.044, 0.008, 18)), chromeMat);
  capTopVent.position.set(0.08, 0.146, 0.16);
  pcbGroup.add(capTopVent);

  const icBody = new THREE.Mesh(
    wb.track(new THREE.BoxGeometry(0.38, 0.036, 0.16)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.48, metalness: 0.16 }))
  );
  icBody.position.set(0.38, 0.03, -0.26);
  icBody.castShadow = true;
  pcbGroup.add(icBody);

  const icSilkTex = wb.track(
    makeCanvasTexture(256, 128, (ctx, w, h) => {
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('STM32F4 • CIEL', 24, 58);
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('REV 4.5 ARM M4', 24, 92);
    })
  );
  const icTopLabel = new THREE.Mesh(
    wb.track(new THREE.PlaneGeometry(0.34, 0.13)),
    wb.track(new THREE.MeshBasicMaterial({ map: icSilkTex }))
  );
  icTopLabel.rotation.x = -Math.PI / 2;
  icTopLabel.position.set(0.38, 0.049, -0.26);
  pcbGroup.add(icTopLabel);

  const smdPinGeo = wb.track(new THREE.BoxGeometry(0.012, 0.01, 0.022));
  for (let ip = 0; ip < 9; ip++) {
    const px = 0.24 + ip * 0.035;
    for (const pz of [-0.348, -0.172]) {
      const pin = new THREE.Mesh(smdPinGeo, chromeMat);
      pin.position.set(px, 0.018, pz);
      pcbGroup.add(pin);
    }
  }

  const smdBodyMat = wb.track(new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.45 }));
  const smdChipGeo = wb.track(new THREE.BoxGeometry(0.042, 0.014, 0.022));
  const smdCapGeo = wb.track(new THREE.BoxGeometry(0.01, 0.015, 0.023));
  const smdSpecs = [
    [-0.36, 0.18],
    [-0.24, 0.26],
    [-0.08, -0.05],
    [0.14, -0.08],
    [-0.05, 0.30]
  ];
  for (const [sx, sz] of smdSpecs) {
    const smdChip = new THREE.Mesh(smdChipGeo, smdBodyMat);
    smdChip.position.set(sx, 0.018, sz);
    pcbGroup.add(smdChip);
    for (const ex of [-0.022, 0.022]) {
      const cap = new THREE.Mesh(smdCapGeo, chromeMat);
      cap.position.set(sx + ex, 0.018, sz);
      pcbGroup.add(cap);
    }
  }

  const crystalCan = new THREE.Mesh(wb.track(new THREE.BoxGeometry(0.085, 0.024, 0.038)), chromeMat);
  crystalCan.position.set(0.02, 0.023, -0.26);
  pcbGroup.add(crystalCan);

  const pcbLeds = [];
  const ledCollarGeo = wb.track(new THREE.CylinderGeometry(0.026, 0.028, 0.01, 14));
  const ledBulbGeo = wb.track(new THREE.SphereGeometry(0.022, 14, 14));
  const ledHaloGeo = wb.track(new THREE.RingGeometry(0.024, 0.044, 20));
  for (let i = 0; i < 4; i++) {
    const colHex = i === 0 ? '#22c55e' : '#38bdf8';
    const collar = new THREE.Mesh(ledCollarGeo, darkLabMat);
    collar.position.set(0.45 + i * 0.075, 0.016, 0.26);
    pcbGroup.add(collar);

    const lMat = wb.track(
      new THREE.MeshStandardMaterial({
        color: colHex,
        emissive: i === 0 ? '#16a34a' : '#0284c7',
        emissiveIntensity: 0.05,
        roughness: 0.18,
        metalness: 0.05
      })
    );
    const led = new THREE.Mesh(ledBulbGeo, lMat);
    led.position.set(0.45 + i * 0.075, 0.032, 0.26);
    pcbGroup.add(led);

    const haloMat = wb.track(
      new THREE.MeshBasicMaterial({
        color: colHex,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide
      })
    );
    const halo = new THREE.Mesh(ledHaloGeo, haloMat);
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(0.45 + i * 0.075, 0.013, 0.26);
    pcbGroup.add(halo);

    pcbLeds.push({ mesh: led, mat: lMat, haloMat, halo, colorHex: colHex });
  }

  const solderPhysMat = wb.track(
    new THREE.MeshPhysicalMaterial({
      color: '#e2e8f0',
      metalness: 0.96,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05
    })
  );
  const coldSolderMat = wb.track(
    new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.45, roughness: 0.78 })
  );
  const burntPadMat = wb.track(
    new THREE.MeshStandardMaterial({ color: '#1c1917', roughness: 0.95, metalness: 0.05 })
  );
  const copperMat = wb.track(
    new THREE.MeshStandardMaterial({ color: '#eab308', metalness: 0.88, roughness: 0.22 })
  );
  const pinMetalMat = wb.track(
    new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.9, roughness: 0.25 })
  );

  const bridgeMesh = new THREE.Mesh(
    wb.track(new THREE.BoxGeometry(0.14, 0.022, 0.038)),
    solderPhysMat
  );
  bridgeMesh.position.set(0.34, 0.022, -0.14);
  pcbGroup.add(bridgeMesh);

  const padMeshes = new Map();
  const solderWorkPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.155);
  let holdHudAccum = 0;
  const padLeadGeo = wb.track(new THREE.CylinderGeometry(0.007, 0.007, 0.048, 10));
  const padHitMat = wb.track(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));

  allPads.forEach((pad) => {
    const grp = new THREE.Group();
    grp.position.set(pad.x, 0.012, pad.z);

    const ring = new THREE.Mesh(
      wb.track(new THREE.CylinderGeometry(pad.r, pad.r * 1.08, 0.006, 20)),
      copperMat
    );
    grp.add(ring);

    const lead = new THREE.Mesh(padLeadGeo, pinMetalMat);
    lead.position.y = 0.024;
    lead.castShadow = true;
    grp.add(lead);

    const cone = new THREE.Mesh(
      wb.track(new THREE.ConeGeometry(pad.r * 0.86, 0.038, 20)),
      solderPhysMat
    );
    cone.position.y = 0.019;
    cone.visible = pad.state === 'bridge';
    cone.scale.setScalar(pad.state === 'bridge' ? 0.9 : 0.05);
    cone.castShadow = true;
    grp.add(cone);

    const heatHaloMat = wb.track(
      new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.0
      })
    );
    const heatHalo = new THREE.Mesh(wb.track(new THREE.RingGeometry(pad.r * 1.18, pad.r * 1.55, 24)), heatHaloMat);
    heatHalo.rotation.x = -Math.PI / 2;
    heatHalo.position.y = 0.005;
    grp.add(heatHalo);

    const hitSphere = new THREE.Mesh(
      wb.track(new THREE.CylinderGeometry(pad.r * 1.65, pad.r * 1.65, 0.06, 12)),
      padHitMat
    );
    hitSphere.position.y = 0.025;
    grp.add(hitSphere);

    pcbGroup.add(grp);

    const tagPos = new THREE.Vector3(pad.x + 0.02, 0.21, pad.z + 0.04);
    const tag = wb.addFloatingTag(tagPos, `${pad.label}`);

    const getPadEntry = (pad) => padMeshes.get(pad.id);

    wb.addInteractive(grp, {
      label: () => {
        if (pad.state === 'bridge') return `⚠️ ${pad.label} : Pont d'étain — Utiliser Tresse cuivre`;
        if (pad.state === 'good') return `✅ ${pad.label} : Brasure brillante conforme`;
        if (pad.burnt) return `🔥 ${pad.label} : Pastille surchauffée — Reprendre à la tresse`;
        if (pad.state === 'cold') return `❄️ ${pad.label} : Soudure froide — Rechauffer au fer`;
        return `🔥 ${pad.label} : Maintenir Fer à souder (puis Étain)`;
      },
      dragPlane: solderWorkPlane,
      onDragStart: () => {
        selectedPadId = pad.id;
        beginPadAction(pad);
      },
      onHoldTick: (dt) => {
        tickPadHold(pad, dt, true);
      },
      onDragEnd: () => {
        finishPadAction(pad);
      }
    });

    padMeshes.set(pad.id, { grp, ring, cone, heatHalo, heatHaloMat, tag });
  });

  function beginPadAction(pad) {
    if (!pad) return;
    selectedPadId = pad.id;
    const pm = padMeshes.get(pad.id);
    if (!pm) return;
    const wpPos = new THREE.Vector3();
    pm.grp.getWorldPosition(wpPos);
    ironTargetPos.set(wpPos.x, 0.23, wpPos.z);

    if (tool === 'wick') {
      activePad = pad;
      if (pad.state === 'bridge' || pad.burnt || pad.state === 'cold' || pad.tinProgress > 0) {
        if (pad.state !== 'bridge') {
          reworkCount += 1;
        }
        if (pad.id === 'U2' || pad.id === 'U3') {
          allPads.forEach((op) => {
            if (op.id === 'U2' || op.id === 'U3') {
              op.state = 'empty';
              op.tinProgress = 0;
              op.burnt = false;
              op.temp = 60;
            }
          });
          bridgeMesh.visible = false;
          wb.requestShadowUpdate();
        } else {
          pad.state = 'empty';
          pad.tinProgress = 0;
          pad.burnt = false;
          pad.temp = 60;
        }
        allPads.forEach(updatePadVisual);
        wb.spawnSparks(wpPos, { color: '#fbbf24', count: 10 });
        wb.spawnSmoke(wpPos, { color: '#f8fafc', count: 5 });
        sfx.interact();
        wb.showToast('Tresse cuivre : pastille nettoyée !', 'success');
        refreshHud();
      }
      return;
    }
    if (pad.state === 'bridge') {
      sfx.error();
      wb.showToast(`⚠️ Pont d’étain sur ${pad.label} : sélectionnez la 🩹 Tresse cuivre !`, 'error');
      return;
    }
    if (pad.state === 'good') {
      wb.showToast(`✅ ${pad.label} est déjà brasée proprement !`, 'info');
      return;
    }
    activePad = pad;
    heatingActive = true;
    if (tool === 'tin') tinFeeding = true;
  }

  function tickPadHold(pad, dt, allowHudRefresh = false) {
    if (!pad || activePad !== pad || tool === 'wick' || pad.state === 'bridge' || pad.state === 'good') return;
    const pm = padMeshes.get(pad.id);
    if (!pm) return;
    const wp = new THREE.Vector3();
    pm.grp.getWorldPosition(wp);
    const tipHeatFactor = Math.max(0.25, (tempC - 210) / 145) / (pad.mass || 1);
    if (heatingActive) {
      const heatRate = pad.temp > 320 ? 26 : 108;
      pad.temp = Math.min(440, pad.temp + dt * heatRate * tipHeatFactor);
      pad.smokeTimer += dt;
      if (pad.smokeTimer > 0.14) {
        pad.smokeTimer = 0;
        if (pad.temp > 405) {
          wb.spawnSmoke(wp, { color: '#1f2937', count: 4, scale: 0.024, speed: 0.22 });
        } else if (pad.temp >= 205) {
          wb.spawnSmoke(wp, { color: '#f1f5f9', count: 2, scale: 0.015, speed: 0.14 });
        }
      }
    }
    if ((tinFeeding || tool === 'tin') && pad.temp >= 200 && !pad.burnt && pad.state !== 'bridge') {
      pad.tinProgress = Math.min(1, pad.tinProgress + dt * 0.95);
      if (pad.smokeTimer === 0) {
        wb.spawnSparks(wp, { color: '#fde68a', count: 2 });
      }
    }
    if (pad.temp >= 425 && !pad.burnt) {
      pad.burnt = true;
      pad.state = 'burnt';
      burnCount += 1;
      sfx.error();
      wb.spawnSmoke(wp, { color: '#111827', count: 10, scale: 0.032, life: 1.3 });
      wb.showToast(`🔥 Surchauffe sur ${pad.label} ! Retirez le fer plus vite !`, 'error');
    }
    updatePadVisual(pad);
    if (allowHudRefresh) {
      holdHudAccum += dt;
      if (holdHudAccum >= 0.14) {
        holdHudAccum = 0;
        syncLiveSolderReadout(pad);
      }
    }
  }

  function finishPadAction(pad) {
    if (!pad) return;
    const pm = padMeshes.get(pad.id);
    if (activePad === pad && tool !== 'wick') {
      if (!pad.burnt && pad.state !== 'bridge' && pad.state !== 'good') {
        if (pad.temp >= 200 && pad.temp < 425 && pad.tinProgress >= 0.65 && Math.round(tempC) >= 315) {
          pad.state = 'good';
          if (pm) {
            const wp = new THREE.Vector3();
            pm.grp.getWorldPosition(wp);
            wb.spawnPulseRing(wp, '#10b981', 0.08);
          }
          sfx.success();
          const nextPending = allPads.find((p) => p.state !== 'good');
          if (nextPending) selectedPadId = nextPending.id;
          if (
            stageIdx === 0 &&
            SOLDER_STAGES[0].pads.every((sp) => allPads.find((p) => p.id === sp.id)?.state === 'good')
          ) {
            stageIdx = 1;
            wb.showToast('✅ Étape 1 validée ! Passez à U1 : nettoyez d’abord le pont à la Tresse cuivre.', 'success');
          }
        } else if (pad.tinProgress > 0.08) {
          pad.state = 'cold';
          sfx.error();
          const reason =
            Math.round(tempC) < 315
              ? `station trop froide (${Math.round(tempC)}°C < 315°C)`
              : pad.tinProgress < 0.65
                ? `étain insuffisant (${Math.round(pad.tinProgress * 100)}%)`
                : `${Math.round(pad.temp)}°C`;
          wb.showToast(`❄️ ${pad.label} : soudure froide (${reason})`, 'error');
        }
      }
      heatingActive = false;
      tinFeeding = false;
      activePad = null;
      updatePadVisual(pad);
      wb.requestShadowUpdate();
      refreshHud();
    } else if (activePad === pad && tool === 'wick') {
      activePad = null;
    }
  }

  function updatePadVisual(pad) {
    const pm = padMeshes.get(pad.id);
    if (!pm) return;
    if (pad.burnt) {
      pm.ring.material = burntPadMat;
      pm.cone.visible = pad.tinProgress > 0.1;
      pm.cone.material = coldSolderMat;
      pm.tag.el.className = 'tp3d-float-tag bad';
      pm.tag.setHtml(`🔥 ${pad.label}`);
    } else if (pad.state === 'good') {
      pm.ring.material = copperMat;
      pm.cone.visible = true;
      pm.cone.material = solderPhysMat;
      pm.cone.scale.setScalar(1);
      pm.tag.el.className = 'tp3d-float-tag ok';
      pm.tag.setHtml(`✅ ${pad.label}`);
    } else if (pad.state === 'bridge') {
      pm.cone.visible = true;
      pm.cone.material = solderPhysMat;
      pm.tag.el.className = 'tp3d-float-tag bad';
      pm.tag.setHtml(`⚠️ ${pad.label}`);
    } else if (pad.state === 'cold') {
      pm.cone.visible = true;
      pm.cone.material = coldSolderMat;
      pm.cone.scale.setScalar(Math.max(0.3, pad.tinProgress));
      pm.tag.el.className = 'tp3d-float-tag warn';
      pm.tag.setHtml(`❄️ ${pad.label}`);
    } else {
      pm.ring.material = copperMat;
      pm.cone.visible = pad.tinProgress > 0.05;
      pm.cone.material = solderPhysMat;
      pm.cone.scale.setScalar(Math.max(0.05, Math.min(1.05, pad.tinProgress)));
      pm.tag.el.className = 'tp3d-float-tag';
      pm.tag.setHtml(pad.temp > 210 ? `🔥 ${pad.label} (${Math.round(pad.temp)}°)` : pad.label);
    }

    if (activePad === pad && pad.temp > 35) {
      pm.heatHaloMat.opacity = 0.85;
      if (pad.temp >= 405) pm.heatHaloMat.color.set('#f43f5e');
      else if (pad.temp >= 200 && pad.tinProgress >= 0.65 && Math.round(tempC) >= 315) pm.heatHaloMat.color.set('#10b981');
      else if (pad.temp >= 200) pm.heatHaloMat.color.set('#fbbf24');
      else pm.heatHaloMat.color.set('#38bdf8');
    } else {
      pm.heatHaloMat.opacity = 0;
    }
  }

  const stationGroup = new THREE.Group();
  stationGroup.position.set(-0.92, 0.01, -0.46);
  stationGroup.rotation.y = 0.25;
  wb.scene.add(stationGroup);

  const stationBox = new THREE.Mesh(
    wb.track(new THREE.BoxGeometry(0.42, 0.24, 0.34)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.4, metalness: 0.45 }))
  );
  stationBox.position.y = 0.12;
  stationBox.castShadow = true;
  stationGroup.add(stationBox);

  const stationFrontBezel = new THREE.Mesh(
    wb.track(new THREE.BoxGeometry(0.43, 0.22, 0.03)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.38, metalness: 0.15 }))
  );
  stationFrontBezel.position.set(0, 0.12, 0.16);
  stationGroup.add(stationFrontBezel);

  const stationPwrLed = new THREE.Mesh(
    wb.track(new THREE.BoxGeometry(0.024, 0.016, 0.014)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#dc2626', emissiveIntensity: 1.4 }))
  );
  stationPwrLed.position.set(-0.16, 0.05, 0.176);
  stationGroup.add(stationPwrLed);

  const lcdScreen = makeCanvasScreen(256, 128, (ctx, w, h, curTemp) => {
    const t = curTemp ?? tempC;
    const inZone = t >= 335 && t <= 370;
    ctx.fillStyle = '#050c0a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = inZone ? '#10b981' : t > 380 ? '#ef4444' : '#f59e0b';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('LED TEMP • STATION PRO', 20, 24);
    ctx.fillStyle = inZone ? '#34d399' : t > 380 ? '#fb7185' : '#38bdf8';
    ctx.font = 'bold 52px monospace';
    ctx.fillText(`${Math.round(t)}°C`, 30, 80);
    ctx.fillStyle = inZone ? '#86efac' : '#fde68a';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(inZone ? '● SAC305 OPTIMAL' : 'CIBLE: 340-365°C', 28, 110);
  }, { minIntervalMs: 84 });
  wb.track(lcdScreen.texture);
  const lcdPlane = new THREE.Mesh(
    wb.track(new THREE.PlaneGeometry(0.24, 0.11)),
    wb.track(new THREE.MeshBasicMaterial({ map: lcdScreen.texture }))
  );
  lcdPlane.position.set(-0.04, 0.15, 0.178);
  stationGroup.add(lcdPlane);

  const tempKnobGroup = new THREE.Group();
  tempKnobGroup.position.set(0.14, 0.12, 0.182);
  const knobCyl = new THREE.Mesh(
    wb.track(new THREE.CylinderGeometry(0.036, 0.04, 0.04, 20)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.35, metalness: 0.6 }))
  );
  knobCyl.rotation.x = Math.PI / 2;
  tempKnobGroup.add(knobCyl);
  const knobInd = new THREE.Mesh(
    wb.track(new THREE.BoxGeometry(0.008, 0.025, 0.042)),
    wb.track(new THREE.MeshBasicMaterial({ color: '#facc15' }))
  );
  knobInd.position.set(0, 0.014, 0.004);
  tempKnobGroup.add(knobInd);
  stationGroup.add(tempKnobGroup);

  let lastLcdTemp = null;
  let lcdPending = false;
  const syncKnobAngle = (forceLcd = false) => {
    const ratio = (tempC - 260) / (420 - 260);
    tempKnobGroup.rotation.z = -(ratio * 4.4 - 2.2);
    const roundedTemp = Math.round(tempC);
    if (roundedTemp !== lastLcdTemp || forceLcd) {
      const updated = forceLcd ? lcdScreen.forceUpdate(roundedTemp) : lcdScreen.update(roundedTemp);
      if (updated) {
        lastLcdTemp = roundedTemp;
        lcdPending = false;
      } else {
        lcdPending = true;
      }
    }
  };
  syncKnobAngle(true);

  wb.addInteractive(tempKnobGroup, {
    label: () => `🌡️ Molette Station : ${Math.round(tempC)}°C (Glisser ↔ ou cliquer)`,
    cursor: 'ew-resize',
    onDragMove: (_pt, dx, dy) => {
      tempDialRaw = Math.max(260, Math.min(420, tempDialRaw + (dx - dy * 0.5) * 0.8));
      tempC = Math.round(tempDialRaw);
      syncKnobAngle();
      refreshHud();
    },
    onClick: () => {
      tempC = tempC >= 335 && tempC <= 370 ? 280 : 350;
      tempDialRaw = tempC;
      sfx.click();
      syncKnobAngle();
      refreshHud();
    }
  });

  const fumeGroup = new THREE.Group();
  fumeGroup.position.set(0.88, 0.01, -0.45);
  fumeGroup.rotation.y = -0.35;
  wb.scene.add(fumeGroup);
  const fumeStand = new THREE.Mesh(
    wb.track(new THREE.BoxGeometry(0.32, 0.34, 0.16)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.45, metalness: 0.38 }))
  );
  fumeStand.position.y = 0.17;
  fumeStand.castShadow = true;
  fumeGroup.add(fumeStand);

  const fumeCarbonBack = new THREE.Mesh(
    wb.track(new THREE.CylinderGeometry(0.125, 0.125, 0.016, 20)),
    darkLabMat
  );
  fumeCarbonBack.rotation.x = Math.PI / 2;
  fumeCarbonBack.position.set(0, 0.21, 0.078);
  fumeGroup.add(fumeCarbonBack);

  for (const gr of [0.05, 0.09, 0.125]) {
    const grilleRing = new THREE.Mesh(wb.track(new THREE.TorusGeometry(gr, 0.004, 8, 24)), chromeMat);
    grilleRing.position.set(0, 0.21, 0.094);
    fumeGroup.add(grilleRing);
  }

  const fanHub = new THREE.Group();
  fanHub.position.set(0, 0.21, 0.086);
  const fanBladeGeo = wb.track(new THREE.BoxGeometry(0.032, 0.11, 0.008));
  const fanBladeMat = wb.track(new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.4 }));
  for (let b = 0; b < 5; b++) {
    const blade = new THREE.Mesh(fanBladeGeo, fanBladeMat);
    blade.rotation.z = (b / 5) * Math.PI * 2;
    fanHub.add(blade);
  }
  fumeGroup.add(fanHub);

  const fumeLedMat = wb.track(
    new THREE.MeshStandardMaterial({ color: '#22c55e', emissive: '#16a34a', emissiveIntensity: 0.05 })
  );
  const fumeLed = new THREE.Mesh(wb.track(new THREE.SphereGeometry(0.016, 12, 12)), fumeLedMat);
  fumeLed.position.set(-0.1, 0.06, 0.088);
  fumeGroup.add(fumeLed);

  wb.addInteractive(fumeGroup, {
    label: () => `💨 Extracteur de fumées : ${fumeExtractorOn ? 'ACTIF' : 'ARRÊT (Cliquer)'}`,
    onClick: () => {
      fumeExtractorOn = !fumeExtractorOn;
      fumeLedMat.emissiveIntensity = fumeExtractorOn ? 1.8 : 0.05;
      sfx.click();
      wb.showToast(fumeExtractorOn ? 'Extracteur de fumées activé (EPI OK)' : 'Extracteur arrêté', 'info');
      refreshHud();
    }
  });

  const pwrSwitchGroup = new THREE.Group();
  pwrSwitchGroup.position.set(-0.88, 0.02, 0.26);
  wb.scene.add(pwrSwitchGroup);
  const pwrBase = new THREE.Mesh(
    wb.track(new THREE.BoxGeometry(0.16, 0.06, 0.16)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.45 }))
  );
  pwrBase.position.y = 0.03;
  pwrSwitchGroup.add(pwrBase);
  const pwrLever = new THREE.Mesh(
    wb.track(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 12)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#f43f5e', roughness: 0.35, metalness: 0.4 }))
  );
  pwrLever.position.set(0, 0.08, 0);
  pwrLever.rotation.x = -0.35;
  pwrSwitchGroup.add(pwrLever);

  wb.addInteractive(pwrSwitchGroup, {
    label: '⚡ Interrupteur Alimentation 5V PCB (Tester les LEDs)',
    onClick: () => {
      triggerPowerTest();
    }
  });

  const spongeGroup = new THREE.Group();
  spongeGroup.position.set(0.92, 0.02, 0.28);
  wb.scene.add(spongeGroup);
  const spongeTray = new THREE.Mesh(
    wb.track(new THREE.BoxGeometry(0.24, 0.03, 0.18)),
    darkLabMat
  );
  spongeTray.position.y = 0.015;
  spongeTray.castShadow = true;

  const spongeTex = wb.track(
    makeCanvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#eab308';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 220; i++) {
        const px = ((i * 53) % (w - 16)) + 8;
        const py = ((i * 97) % (h - 16)) + 8;
        ctx.fillStyle = i % 3 === 0 ? 'rgba(161, 98, 7, 0.55)' : 'rgba(254, 240, 138, 0.45)';
        ctx.beginPath();
        ctx.arc(px, py, 2 + (i % 4), 0, Math.PI * 2);
        ctx.fill();
      }
    })
  );
  const spongePad = new THREE.Mesh(
    wb.track(new THREE.BoxGeometry(0.19, 0.032, 0.13)),
    wb.track(new THREE.MeshStandardMaterial({ map: spongeTex, roughness: 0.92 }))
  );
  spongePad.position.y = 0.028;

  const brassCup = new THREE.Mesh(wb.track(new THREE.CylinderGeometry(0.052, 0.048, 0.045, 16)), chromeMat);
  brassCup.position.set(-0.2, 0.022, -0.02);
  const brassWool = new THREE.Mesh(
    wb.track(new THREE.CylinderGeometry(0.044, 0.044, 0.02, 16)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#d97706', metalness: 0.85, roughness: 0.35 }))
  );
  brassWool.position.set(-0.2, 0.038, -0.02);

  spongeGroup.add(spongeTray, spongePad, brassCup, brassWool);
  wb.addInteractive(spongeGroup, {
    label: '🧽 Éponge humide (Nettoyer la panne du fer)',
    onClick: () => {
      sfx.click();
      wb.spawnSmoke([0.92, 0.08, 0.28], { color: '#f8fafc', count: 10, scale: 0.02, speed: 0.22 });
      wb.showToast('Panne du fer nettoyée sur l’éponge humide !', 'success');
    }
  });

  const spoolGroup = new THREE.Group();
  spoolGroup.position.set(-0.92, 0.06, -0.02);
  wb.scene.add(spoolGroup);
  const spoolFlangeTop = new THREE.Mesh(
    wb.track(new THREE.CylinderGeometry(0.085, 0.085, 0.014, 24)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.4 }))
  );
  spoolFlangeTop.position.y = 0.065;
  const spoolFlangeBot = spoolFlangeTop.clone();
  spoolFlangeBot.position.y = -0.045;
  const spoolCore = new THREE.Mesh(
    wb.track(new THREE.CylinderGeometry(0.064, 0.064, 0.095, 24)),
    solderPhysMat
  );
  spoolCore.position.y = 0.01;
  const spoolTailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.064, 0.02, 0),
    new THREE.Vector3(0.11, 0.01, 0.04),
    new THREE.Vector3(0.14, -0.02, 0.09)
  ]);
  const spoolTail = new THREE.Mesh(
    wb.track(new THREE.TubeGeometry(spoolTailCurve, 12, 0.004, 6, false)),
    solderPhysMat
  );
  spoolGroup.add(spoolFlangeTop, spoolFlangeBot, spoolCore, spoolTail);
  wb.addInteractive(spoolGroup, {
    label: '🧵 Bobine d’étain SAC305 (Sélectionner le fil d’étain)',
    onClick: () => {
      tool = 'tin';
      sfx.click();
      wb.showToast('Fil d’étain SAC305 prêt pour braser !', 'info');
      refreshHud();
    }
  });

  const ironGroup = new THREE.Group();
  ironGroup.position.set(-0.2, 0.32, 0.35);
  ironGroup.rotation.set(0.75, 0.2, -0.35);
  wb.scene.add(ironGroup);

  const ironHandle = new THREE.Mesh(
    wb.track(new THREE.CylinderGeometry(0.022, 0.026, 0.28, 16)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.42 }))
  );
  ironHandle.position.y = 0.18;
  ironGroup.add(ironHandle);

  const ironGrip = new THREE.Mesh(
    wb.track(new THREE.CylinderGeometry(0.0265, 0.0265, 0.11, 16)),
    darkLabMat
  );
  ironGrip.position.y = 0.105;
  ironGroup.add(ironGrip);

  const ironShaft = new THREE.Mesh(
    wb.track(new THREE.CylinderGeometry(0.009, 0.009, 0.14, 12)),
    chromeMat
  );
  ironShaft.position.y = -0.02;
  ironGroup.add(ironShaft);

  const ironTipMat = wb.track(
    new THREE.MeshStandardMaterial({
      color: '#d4d4d8',
      metalness: 0.88,
      roughness: 0.25,
      emissive: '#ef4444',
      emissiveIntensity: 0.35
    })
  );
  const ironTip = new THREE.Mesh(wb.track(new THREE.ConeGeometry(0.009, 0.045, 14)), ironTipMat);
  ironTip.rotation.x = Math.PI;
  ironTip.position.y = -0.11;
  ironGroup.add(ironTip);

  const ironTipLight = new THREE.PointLight('#fb923c', 0.25, 0.45, 2.0);
  ironTipLight.position.set(0, -0.12, 0);
  ironGroup.add(ironTipLight);

  const tinWireGroup = new THREE.Group();
  tinWireGroup.position.set(0.35, 0.26, 0.32);
  tinWireGroup.rotation.set(-0.6, 0.1, 0.45);
  wb.scene.add(tinWireGroup);
  const tinStrand = new THREE.Mesh(
    wb.track(new THREE.CylinderGeometry(0.004, 0.004, 0.24, 10)),
    solderPhysMat
  );
  tinStrand.position.y = 0.02;
  tinWireGroup.add(tinStrand);

  const fluxTex = wb.track(
    makeCanvasTexture(64, 64, (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
      grad.addColorStop(0, 'rgba(241, 245, 249, 0.95)');
      grad.addColorStop(0.45, 'rgba(226, 232, 240, 0.45)');
      grad.addColorStop(1, 'rgba(226, 232, 240, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    })
  );
  const FLUX_COUNT = 64;
  const fluxPositions = new Float32Array(FLUX_COUNT * 3);
  const fluxMeta = Array.from({ length: FLUX_COUNT }, () => ({
    active: false,
    age: 0,
    life: 1.2,
    vx: 0,
    vy: 0,
    vz: 0
  }));
  for (let i = 0; i < FLUX_COUNT; i++) {
    fluxPositions[i * 3 + 1] = -10;
  }
  const fluxGeo = wb.track(new THREE.BufferGeometry());
  const fluxPosAttr = new THREE.BufferAttribute(fluxPositions, 3);
  fluxGeo.setAttribute('position', fluxPosAttr);
  const fluxMat = wb.track(
    new THREE.PointsMaterial({
      map: fluxTex,
      color: '#f8fafc',
      size: 0.048,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.NormalBlending,
      sizeAttenuation: true
    })
  );
  const fluxSmokePoints = new THREE.Points(fluxGeo, fluxMat);
  fluxSmokePoints.frustumCulled = false;
  wb.scene.add(fluxSmokePoints);
  let fluxSpawnCursor = 0;
  let fluxEmitAccum = 0;

  let ironTargetPos = new THREE.Vector3(-0.3, 0.28, 0.25);

  wb.onPointerMove((e) => {
    const pt = wb.getWorkPlanePoint(e.clientX, e.clientY, 0.18);
    if (pt) {
      ironTargetPos.set(
        Math.max(-0.9, Math.min(0.95, pt.x)),
        heatingActive ? 0.22 : 0.31,
        Math.max(-0.55, Math.min(0.65, pt.z))
      );
    }
  });

  let finishTimer = null;
  function triggerPowerTest() {
    if (finalized) return;
    powerOn = !powerOn;
    pwrLever.rotation.x = powerOn ? 0.35 : -0.35;
    if (!powerOn) {
      pcbLeds.forEach((l) => {
        l.mat.emissiveIntensity = 0.05;
        l.haloMat.opacity = 0;
      });
      pcbTestLight.intensity = 0;
      refreshHud();
      return;
    }

    const bridgesLeft = allPads.some((p) => p.state === 'bridge');
    const allDone = allPads.every((p) => p.state === 'good');
    if (bridgesLeft) {
      sfx.error();
      wb.spawnSparks(new THREE.Vector3(0.36, 0.16, -0.1), { color: '#ef4444', count: 16 });
      wb.showToast('⚡ Court-circuit détecté sur le pont U1 ! Nettoyez à la tresse !', 'error');
      powerOn = false;
      pwrLever.rotation.x = -0.35;
      return;
    }

    const durationSec = Math.round(wb.getElapsedSec());
    const evalRes = evaluateSolderingScore3D({
      pads: allPads,
      tempC,
      fumeExtractorOn,
      burnCount,
      reworkCount,
      powerTestedOk: allDone,
      durationSec
    });

    if (allDone) {
      pcbPowerLedTime = 0.01;
      sfx.success();
      finalized = true;
      wb.showToast('🚀 Toutes les LEDs s’allument ! Carte validée !', 'success');
      if (finishTimer) clearTimeout(finishTimer);
      finishTimer = setTimeout(() => {
        finishTimer = null;
        api.finishTp(
          evalRes.score,
          `
          <ul>
            <li>✅ Pastilles brasées propres : <strong>${allPads.filter((p) => p.state === 'good').length}/${allPads.length}</strong></li>
            <li>💨 Extracteur de fumées : <strong>${fumeExtractorOn ? 'Activé' : 'Oublié'}</strong></li>
            <li>🌡️ Température station : <strong>${Math.round(tempC)}°C</strong></li>
            <li>🔥 Surchauffes PCB : <strong>${burnCount}</strong> • Test 5V LEDs : <strong>OK</strong></li>
          </ul>`,
          evalRes.breakdown
        );
      }, 1500);
    } else {
      pcbPowerLedTime = 0;
      powerOn = false;
      pwrLever.rotation.x = -0.35;
      pcbLeds.forEach((l) => {
        l.mat.emissiveIntensity = 0.05;
        l.haloMat.opacity = 0;
      });
      pcbTestLight.intensity = 0;
      sfx.error();
      wb.showToast(`⚠️ Certaines pastilles restent incomplètes (${allPads.filter((p) => p.state === 'good').length}/${allPads.length})`, 'error');
    }
    refreshHud();
  }

  let liveReadoutEl = null;
  function syncLiveSolderReadout(pad) {
    if (!pad || !liveReadoutEl) return;
    liveReadoutEl.textContent = `${pad.label} : ${Math.round(pad.temp)}°C • Étain ${Math.round(pad.tinProgress * 100)}%`;
  }

  wb.setInspectableView?.({
    title: 'Zoom Carte PCB & Pastilles',
    subtitle: 'Visualisation agrandie des 8 pastilles, température et qualité de brasure',
    label: '🔎 Zoom PCB',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 3;
      ctx.strokeRect(24, 24, w - 48, h - 48);
      ctx.fillStyle = '#ecfdf5';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(`PCB CIEL — Station ${Math.round(tempC)}°C (Cible 340–365°C)`, 44, 58);
      allPads.forEach((pad) => {
        const px = w * 0.5 + pad.x * (w * 0.68);
        const py = h * 0.54 + pad.z * (h * 1.15);
        const r = pad.r * 520;
        const isSel = pad.id === selectedPadId;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle =
          pad.state === 'good'
            ? '#22c55e'
            : pad.state === 'bridge'
              ? '#f59e0b'
              : pad.burnt
                ? '#334155'
                : pad.state === 'cold'
                  ? '#60a5fa'
                  : '#d97706';
        ctx.fill();
        ctx.lineWidth = isSel ? 5 : 2;
        ctx.strokeStyle = isSel ? '#38bdf8' : '#fef3c7';
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(pad.label, px, py - r - 10);
        ctx.font = '12px sans-serif';
        ctx.fillText(`${Math.round(pad.temp)}°C | ${Math.round(pad.tinProgress * 100)}%`, px, py + r + 18);
      });
      ctx.textAlign = 'left';
    }
  });

  function refreshHud() {
    const stagePads = SOLDER_STAGES[stageIdx].pads.map((sp) => allPads.find((p) => p.id === sp.id));
    api.setStages(
      SOLDER_STAGES.map((st, idx) => {
        const stPads = st.pads.map((sp) => allPads.find((p) => p.id === sp.id));
        const ok = stPads.every((p) => p?.state === 'good');
        return { name: `${ok ? '✅ ' : ''}${st.name}` };
      }),
      stageIdx,
      (idx) => {
        stageIdx = idx;
        refreshHud();
      }
    );

    const goodCount = allPads.filter((p) => p.state === 'good').length;
    const estScore = computeSolderingScore3D({
      pads: allPads,
      tempC,
      fumeExtractorOn,
      burnCount,
      reworkCount,
      powerTestedOk: powerOn && allPads.every((p) => p.state === 'good'),
      durationSec: Math.round(wb.getElapsedSec())
    });

    wb.setAccuracy(`${estScore.toFixed(1)} / 20`);

    let stepSub = SOLDER_STAGES[stageIdx].brief;
    if (activePad) {
      stepSub = `${activePad.label} : Température ${Math.round(activePad.temp)}°C | Étain ${Math.round(activePad.tinProgress * 100)}% ${activePad.temp >= 215 && activePad.tinProgress < 0.72 ? '→ Appuyez / passez Fil d’étain !' : activePad.tinProgress >= 0.72 ? '→ RETIRER LE FER !' : '→ Chauffer...'}`;
    }
    wb.setInstruction(`PASTILLES ${goodCount}/${allPads.length}`, SOLDER_STAGES[stageIdx].name, stepSub);

    wb.setTools(
      [
        { id: 'iron', icon: '🔥', label: 'Fer à souder' },
        { id: 'tin', icon: '🧵', label: 'Fer + Fil d’étain' },
        { id: 'wick', icon: '🩹', label: 'Tresse cuivre' }
      ],
      tool,
      (id) => {
        tool = id;
        refreshHud();
      }
    );

    wb.setActions([
      {
        label: fumeExtractorOn ? '💨 Extracteur ON' : '💨 Allumer Extracteur',
        primary: !fumeExtractorOn,
        onClick: () => {
          fumeExtractorOn = !fumeExtractorOn;
          fumeLedMat.emissiveIntensity = fumeExtractorOn ? 1.8 : 0.05;
          refreshHud();
        }
      },
      {
        label: `🌡️ ${Math.round(tempC)}°C (Cible 350°C)`,
        onClick: () => {
          tempC = 350;
          tempDialRaw = 350;
          syncKnobAngle();
          refreshHud();
        }
      },
      {
        label: '⚡ Tester PCB 5V',
        primary: goodCount === allPads.length,
        onClick: () => triggerPowerTest()
      },
      {
        label: '💡 Indice',
        onClick: () => {
          const hasBridge = allPads.some((p) => p.state === 'bridge');
          const msg = !fumeExtractorOn
            ? 'Allumez d’abord l’extracteur de fumées et réglez le fer entre 340°C et 365°C.'
            : hasBridge && tool !== 'wick'
              ? 'Un pont d’étain reste sur U1-TX/RX : passez en outil « Tresse cuivre » et touchez U1.'
              : 'Sélectionnez une pastille P1..LED-OK, utilisez « Fer + Fil d’étain », maintenez jusqu’à 70–100% sous 425°C puis relâchez !';
          wb.showToast(msg, 'info');
        }
      },
      {
        label: '🔄 Réinitialiser',
        onClick: () => {
          stopTouchHold();
          if (finishTimer) {
            clearTimeout(finishTimer);
            finishTimer = null;
          }
          stageIdx = 0;
          tempC = 280;
          tempDialRaw = 280;
          fumeExtractorOn = false;
          fumeLedMat.emissiveIntensity = 0.05;
          tool = 'iron';
          heatingActive = false;
          tinFeeding = false;
          activePad = null;
          burnCount = 0;
          reworkCount = 0;
          powerOn = false;
          pcbPowerLedTime = 0;
          finalized = false;
          pwrLever.rotation.x = -0.35;
          pcbLeds.forEach((l) => {
            l.mat.emissiveIntensity = 0.05;
            l.haloMat.opacity = 0;
          });
          pcbTestLight.intensity = 0;
          const initialMap = new Map(
            [...SOLDER_STAGES[0].pads, ...SOLDER_STAGES[1].pads].map((p) => [p.id, p])
          );
          allPads.forEach((pad) => {
            const orig = initialMap.get(pad.id);
            pad.state = orig?.state || 'empty';
            pad.temp = 25;
            pad.tinProgress = pad.state === 'bridge' ? 1 : 0;
            pad.burnt = false;
            pad.smokeTimer = 0;
            updatePadVisual(pad);
          });
          selectedPadId = allPads[0]?.id || 'P1';
          bridgeMesh.visible = true;
          syncKnobAngle(true);
          wb.requestShadowUpdate();
          sfx.click();
          wb.showToast('Carte PCB & station de soudure réinitialisées.', 'info');
          refreshHud();
        }
      }
    ]);

    const curPad = allPads.find((p) => p.id === selectedPadId) || allPads[0];
    const drawerEl = wb.setSideDrawer?.(`
      <div class="tp3d-drawer-section">
        <div class="tp3d-drawer-title">🌡️ Station de Soudage</div>
        <div class="av-slider-row">
          <div class="av-slider-head"><span>Température Fer</span><span id="solder-temp-lbl">${Math.round(tempC)}°C</span></div>
          <input type="range" id="solder-rng-temp" min="260" max="420" step="5" data-fine-step="5" value="${Math.round(tempC)}">
        </div>
      </div>
      <div class="tp3d-drawer-section">
        <div class="tp3d-drawer-title">🔩 Pastilles PCB (Tap pour cibler)</div>
        <div class="av-link-grid">
          ${allPads
            .map((p) => {
              const icon =
                p.state === 'good'
                  ? '✅'
                  : p.state === 'bridge'
                    ? '⚠️'
                    : p.burnt
                      ? '💀'
                      : p.state === 'cold'
                        ? '❄️'
                        : '🔥';
              return `<button type="button" class="tp-connect-btn ${p.state === 'good' ? 'done' : ''} ${p.id === selectedPadId ? 'selected' : ''}" data-pad-id="${p.id}">${icon} ${p.label}</button>`;
            })
            .join('')}
        </div>
      </div>
      <div class="tp3d-drawer-section">
        <div class="tp3d-drawer-title">✋ Action Tactile : ${curPad?.label || ''}</div>
        <div id="solder-live-stat" class="av-status-line">${curPad ? `${curPad.label} : ${Math.round(curPad.temp)}°C • Étain ${Math.round(curPad.tinProgress * 100)}%` : ''}</div>
        <button type="button" id="solder-hold-btn" class="tp3d-action-btn primary tp-hold-btn">
          ${tool === 'wick' ? `🩹 Nettoyer ${curPad?.label || ''} (Tresse)` : `🔥 Maintenir pour Braser ${curPad?.label || ''}`}
        </button>
      </div>
    `);

    if (drawerEl) {
      liveReadoutEl = drawerEl.querySelector('#solder-live-stat');
      const tempInput = drawerEl.querySelector('#solder-rng-temp');
      const tempLbl = drawerEl.querySelector('#solder-temp-lbl');
      tempInput?.addEventListener('input', () => {
        tempC = Math.round(Number(tempInput.value));
        tempDialRaw = tempC;
        if (tempLbl) tempLbl.textContent = `${tempC}°C`;
        syncKnobAngle();
      });
      tempInput?.addEventListener('change', () => {
        tempC = Math.round(Number(tempInput.value));
        tempDialRaw = tempC;
        syncKnobAngle();
        refreshHud();
      });
      drawerEl.querySelectorAll('[data-pad-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          selectedPadId = btn.dataset.padId;
          const target = allPads.find((p) => p.id === selectedPadId);
          const pm = target && padMeshes.get(target.id);
          if (pm) {
            const wp = new THREE.Vector3();
            pm.grp.getWorldPosition(wp);
            ironTargetPos.set(wp.x, 0.25, wp.z);
          }
          sfx.click();
          refreshHud();
        });
      });
      const holdBtn = drawerEl.querySelector('#solder-hold-btn');
      if (holdBtn) {
        let holdingTouch = false;
        const releaseHold = () => {
          if (!holdingTouch) return;
          holdingTouch = false;
          holdBtn.classList.remove('pressed');
          stopTouchHold();
          const pad = allPads.find((p) => p.id === selectedPadId);
          if (pad) finishPadAction(pad);
        };
        holdBtn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const pad = allPads.find((p) => p.id === selectedPadId);
          if (!pad) return;
          if (tool === 'iron' && pad.state !== 'bridge' && pad.state !== 'good') {
            tool = 'tin';
          }
          beginPadAction(pad);
          if (tool === 'wick') return;
          if (pad.state === 'bridge' || pad.state === 'good') return;
          holdingTouch = true;
          holdBtn.classList.add('pressed');
          stopTouchHold();
          touchSolderTimer = setInterval(() => {
            const cur = allPads.find((p) => p.id === selectedPadId);
            if (!cur || cur.burnt || cur.state === 'good') {
              releaseHold();
              return;
            }
            tickPadHold(cur, 0.05, true);
          }, 50);
        });
        holdBtn.addEventListener('pointerup', releaseHold);
        holdBtn.addEventListener('pointercancel', releaseHold);
        holdBtn.addEventListener('pointerleave', releaseHold);
      }
    }

    wb.setVrExtras?.({
      sliders: [
        {
          id: 'solder_temp',
          label: '🌡️ Potentiomètre Fer',
          min: 260,
          max: 420,
          step: 5,
          value: Math.round(tempC),
          formatVal: (v) => `${Math.round(v)}°C`,
          onSetValue: (v) => {
            tempC = Math.round(v);
            tempDialRaw = tempC;
            syncKnobAngle();
            refreshHud();
          }
        }
      ],
      buttons: [
        {
          id: 'solder_preset_350',
          label: '🎯 Cible 350°C',
          active: tempC >= 340 && tempC <= 365,
          onClick: () => {
            tempC = 350;
            tempDialRaw = 350;
            syncKnobAngle();
            sfx.click();
            refreshHud();
          }
        },
        ...allPads.slice(0, 6).map((p) => ({
          id: `pad_st_${p.id}`,
          label: `${p.state === 'good' ? '✅' : p.state === 'bridge' ? '⚠️' : '🔥'} ${p.label}`,
          active: p.state === 'good',
          onClick: () => {
            wb.showToast(
              `${p.label} : ${p.state === 'good' ? 'Brasure OK' : p.state === 'bridge' ? 'Pont — Utiliser Tresse cuivre' : 'Pointez la pastille au laser et maintenez la gâchette'}`,
              'info'
            );
          }
        }))
      ],
      statusLines: [
        `Station : ${Math.round(tempC)}°C (Optimal 340-365°C) | Extracteur : ${fumeExtractorOn ? 'ON' : 'OFF'} | Pastilles OK : ${goodCount}/${allPads.length}`
      ]
    });
  }

  let activeCam = 'global';
  const cams = [
    { id: 'global', label: '🔭 Vue Globale', pos: [0, 1.18, 1.56], look: [0, 0.14, -0.02] },
    { id: 'pcb', label: '🔬 Zoom PCB', pos: [0.05, 0.76, 0.62], look: [0.05, 0.14, 0.0] },
    { id: 'station', label: '🌡️ Station / Extracteur', pos: [0, 0.85, 0.98], look: [-0.25, 0.18, -0.35] }
  ];
  function selectCameraView(id) {
    activeCam = id;
    const c = cams.find((x) => x.id === id);
    if (c) wb.setCameraView(c.pos, c.look, id === 'pcb' ? 36 : 40);
    wb.setCameras(cams, activeCam, selectCameraView);
  }
  wb.setCameras(cams, activeCam, selectCameraView);

  const _tinGoal = new THREE.Vector3();
  const _fluxWp = new THREE.Vector3();
  wb.addUpdate((dt) => {
    if (lcdPending && lcdScreen.update(Math.round(tempC))) {
      lastLcdTemp = Math.round(tempC);
      lcdPending = false;
    }
    if (fumeExtractorOn) {
      fanHub.rotation.z += dt * 18;
    }

    const heatRatio = Math.max(0, Math.min(1, (tempC - 260) / 160));
    ironTipMat.emissive.set(tempC >= 335 ? '#fb923c' : '#ef4444');
    ironTipMat.emissiveIntensity = 0.12 + heatRatio * 1.45;
    ironTipLight.intensity = (tool !== 'wick' ? 0.15 + heatRatio * 0.75 : 0);
    ironGroup.visible = tool !== 'wick';
    tinWireGroup.visible = tool === 'tin' || tinFeeding;

    ironGroup.position.lerp(ironTargetPos, 1 - Math.exp(-18 * dt));
    if (tinWireGroup.visible) {
      _tinGoal.copy(ironTargetPos).add({ x: 0.14, y: -0.04, z: 0.06 });
      tinWireGroup.position.lerp(_tinGoal, 1 - Math.exp(-16 * dt));
    }

    if (heatingActive && activePad && activePad.temp >= 180 && tool !== 'wick') {
      const pm = padMeshes.get(activePad.id);
      if (pm) {
        fluxEmitAccum += dt * (tinFeeding || tool === 'tin' ? 18 : 10);
        while (fluxEmitAccum >= 1) {
          fluxEmitAccum -= 1;
          const idx = fluxSpawnCursor;
          fluxSpawnCursor = (fluxSpawnCursor + 1) % FLUX_COUNT;
          pm.grp.getWorldPosition(_fluxWp);
          fluxPositions[idx * 3] = _fluxWp.x + (Math.random() - 0.5) * 0.018;
          fluxPositions[idx * 3 + 1] = _fluxWp.y + 0.015;
          fluxPositions[idx * 3 + 2] = _fluxWp.z + (Math.random() - 0.5) * 0.018;
          fluxMeta[idx].active = true;
          fluxMeta[idx].age = 0;
          fluxMeta[idx].life = 0.9 + Math.random() * 0.6;
          fluxMeta[idx].vx = (Math.random() - 0.5) * 0.045;
          fluxMeta[idx].vy = 0.14 + Math.random() * 0.1;
          fluxMeta[idx].vz = (Math.random() - 0.5) * 0.045;
        }
      }
    }

    let fluxDirty = false;
    for (let i = 0; i < FLUX_COUNT; i++) {
      const fm = fluxMeta[i];
      if (!fm.active) continue;
      fluxDirty = true;
      fm.age += dt;
      if (fm.age >= fm.life) {
        fm.active = false;
        fluxPositions[i * 3 + 1] = -10;
        continue;
      }
      if (fumeExtractorOn) {
        fm.vx += (0.88 - fluxPositions[i * 3]) * dt * 1.6;
        fm.vz += (-0.45 - fluxPositions[i * 3 + 2]) * dt * 1.6;
      }
      fluxPositions[i * 3] += fm.vx * dt;
      fluxPositions[i * 3 + 1] += fm.vy * dt;
      fluxPositions[i * 3 + 2] += fm.vz * dt;
    }
    if (fluxDirty) {
      fluxPosAttr.needsUpdate = true;
    }

    allPads.forEach((pad) => {
      if (activePad !== pad && pad.temp > 25) {
        pad.temp = Math.max(25, pad.temp - dt * 24);
        updatePadVisual(pad);
      }
    });

    if (powerOn && pcbPowerLedTime > 0) {
      pcbPowerLedTime += dt;
      let litCount = 0;
      pcbLeds.forEach((l, idx) => {
        const isLit = pcbPowerLedTime > idx * 0.25;
        l.mat.emissiveIntensity = isLit ? 2.8 : 0.05;
        l.haloMat.opacity = isLit ? 0.65 : 0;
        if (isLit) litCount += 1;
      });
      pcbTestLight.intensity = (litCount / pcbLeds.length) * 1.85;
    }
  });

  wb.freezeStatic([
    fanHub,
    tempKnobGroup,
    pwrLever,
    ironGroup,
    tinWireGroup,
    fluxSmokePoints,
    bridgeMesh,
    ...Array.from(padMeshes.values()).map((pm) => pm.cone)
  ]);

  allPads.forEach(updatePadVisual);
  refreshHud();

  return {
    destroy: () => {
      stopTouchHold();
      if (finishTimer) {
        clearTimeout(finishTimer);
        finishTimer = null;
      }
      wb.destroy();
    }
  };
}
