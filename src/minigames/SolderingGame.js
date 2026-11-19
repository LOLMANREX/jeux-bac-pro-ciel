import * as THREE from 'three';
import { sfx } from '../core/audio.js';
import { toSafeNumber, finalizeGrade20, createGradeBreakdown } from '../core/grading.js';
import { createWorkbench3D, makeCanvasScreen } from './Workbench3DHost.js';

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
    cameraPos: [0, 1.32, 1.48],
    lookAt: [0, 0.08, 0.02],
    fov: 40,
    hasEsdMat: true,
    esdColor: '#164e63',
    esdGridColor: '#22829c'
  });

  const pcbGroup = new THREE.Group();
  pcbGroup.position.set(0.02, 0.14, 0.04);
  wb.scene.add(pcbGroup);

  const standMat = wb.track(new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.38, metalness: 0.78 }));
  for (const sx of [-0.74, 0.74]) {
    const base = new THREE.Mesh(wb.track(new THREE.CylinderGeometry(0.08, 0.1, 0.03, 16)), standMat);
    base.position.set(sx, 0.015, 0.04);
    base.castShadow = true;
    wb.scene.add(base);
    const arm = new THREE.Mesh(wb.track(new THREE.CylinderGeometry(0.015, 0.015, 0.14, 10)), standMat);
    arm.position.set(sx, 0.08, 0.04);
    wb.scene.add(arm);
    const clip = new THREE.Mesh(wb.track(new THREE.BoxGeometry(0.06, 0.03, 0.05)), standMat);
    clip.position.set(sx > 0 ? sx - 0.03 : sx + 0.03, 0.14, 0.04);
    wb.scene.add(clip);
  }

  const pcbCanvas = document.createElement('canvas');
  pcbCanvas.width = 1024;
  pcbCanvas.height = 680;
  const pCtx = pcbCanvas.getContext('2d');
  pCtx.fillStyle = '#0f5c3a';
  pCtx.fillRect(0, 0, 1024, 680);
  pCtx.strokeStyle = '#22c55e';
  pCtx.lineWidth = 4;
  pCtx.strokeRect(18, 18, 988, 644);
  pCtx.strokeStyle = '#eab308';
  pCtx.lineWidth = 6;
  const tracePaths = [
    [[160, 210], [320, 210], [420, 260], [640, 260]],
    [[160, 390], [340, 390], [500, 460], [820, 460]],
    [[640, 220], [720, 220], [840, 220], [840, 410]],
    [[340, 220], [340, 140], [620, 140], [620, 220]]
  ];
  for (const pathPts of tracePaths) {
    pCtx.beginPath();
    pathPts.forEach(([x, y], idx) => (idx === 0 ? pCtx.moveTo(x, y) : pCtx.lineTo(x, y)));
    pCtx.stroke();
  }
  pCtx.fillStyle = '#f8fafc';
  pCtx.font = 'bold 26px monospace';
  pCtx.fillText('ATELIER CIEL — CARTE STM32 / PWM v4.0', 44, 68);
  pCtx.font = 'bold 20px monospace';
  pCtx.fillText('J1 PWR    R1 470Ω      C1 100µF      U1 ATmega     LEDs', 92, 610);
  allPads.forEach((pad) => {
    const px = Math.round((pad.x / 1.42 + 0.5) * 1024);
    const py = Math.round((pad.z / 0.86 + 0.5) * 680);
    pCtx.fillStyle = 'rgba(2, 6, 23, 0.72)';
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
    wb.track(new THREE.MeshStandardMaterial({ map: pcbTex, roughness: 0.44, metalness: 0.14 }))
  );
  boardMesh.castShadow = true;
  boardMesh.receiveShadow = true;
  pcbGroup.add(boardMesh);

  const rBody = new THREE.Mesh(
    wb.track(new THREE.CylinderGeometry(0.024, 0.024, 0.14, 14)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.45 }))
  );
  rBody.rotation.z = Math.PI / 2;
  rBody.position.set(-0.22, 0.036, -0.25);
  rBody.castShadow = true;
  pcbGroup.add(rBody);

  const capBody = new THREE.Mesh(
    wb.track(new THREE.CylinderGeometry(0.048, 0.048, 0.13, 18)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.32, metalness: 0.25 }))
  );
  capBody.position.set(0.08, 0.08, 0.16);
  capBody.castShadow = true;
  pcbGroup.add(capBody);

  const icBody = new THREE.Mesh(
    wb.track(new THREE.BoxGeometry(0.38, 0.036, 0.16)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.55, metalness: 0.1 }))
  );
  icBody.position.set(0.38, 0.03, -0.26);
  icBody.castShadow = true;
  pcbGroup.add(icBody);

  const pcbLeds = [];
  for (let i = 0; i < 4; i++) {
    const lMat = wb.track(
      new THREE.MeshStandardMaterial({
        color: i === 0 ? '#22c55e' : '#38bdf8',
        emissive: i === 0 ? '#16a34a' : '#0284c7',
        emissiveIntensity: 0.05,
        roughness: 0.25
      })
    );
    const led = new THREE.Mesh(wb.track(new THREE.SphereGeometry(0.022, 14, 14)), lMat);
    led.position.set(0.45 + i * 0.075, 0.032, 0.26);
    pcbGroup.add(led);
    pcbLeds.push({ mesh: led, mat: lMat, colorHex: i === 0 ? '#22c55e' : '#38bdf8' });
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

  allPads.forEach((pad) => {
    const grp = new THREE.Group();
    grp.position.set(pad.x, 0.012, pad.z);

    const ring = new THREE.Mesh(
      wb.track(new THREE.CylinderGeometry(pad.r, pad.r * 1.08, 0.006, 20)),
      copperMat.clone()
    );
    grp.add(ring);

    const lead = new THREE.Mesh(
      wb.track(new THREE.CylinderGeometry(0.007, 0.007, 0.048, 10)),
      pinMetalMat
    );
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
      wb.track(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }))
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
    wb.track(new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.44, metalness: 0.1 }))
  );
  stationBox.position.y = 0.12;
  stationBox.castShadow = true;
  stationGroup.add(stationBox);

  const lcdScreen = makeCanvasScreen(256, 128, (ctx, w, h, curTemp) => {
    const t = curTemp ?? tempC;
    const inZone = t >= 335 && t <= 370;
    ctx.fillStyle = '#071a12';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = inZone ? '#10b981' : '#f59e0b';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = inZone ? '#34d399' : t > 380 ? '#fb7185' : '#38bdf8';
    ctx.font = 'bold 54px monospace';
    ctx.fillText(`${Math.round(t)}°C`, 32, 74);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(inZone ? 'SAC305 OPTIMAL' : 'CIBLE: 340-365°C', 28, 108);
  });
  const lcdPlane = new THREE.Mesh(
    wb.track(new THREE.PlaneGeometry(0.24, 0.11)),
    wb.track(new THREE.MeshBasicMaterial({ map: lcdScreen.texture }))
  );
  lcdPlane.position.set(-0.04, 0.15, 0.172);
  stationGroup.add(lcdPlane);

  const tempKnobGroup = new THREE.Group();
  tempKnobGroup.position.set(0.14, 0.12, 0.175);
  const knobCyl = new THREE.Mesh(
    wb.track(new THREE.CylinderGeometry(0.036, 0.04, 0.04, 20)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.4, metalness: 0.5 }))
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

  const syncKnobAngle = () => {
    const ratio = (tempC - 260) / (420 - 260);
    tempKnobGroup.rotation.z = -(ratio * 4.4 - 2.2);
    lcdScreen.update(tempC);
  };
  syncKnobAngle();

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
    wb.track(new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.5, metalness: 0.3 }))
  );
  fumeStand.position.y = 0.17;
  fumeStand.castShadow = true;
  fumeGroup.add(fumeStand);

  const fanHub = new THREE.Group();
  fanHub.position.set(0, 0.21, 0.085);
  for (let b = 0; b < 5; b++) {
    const blade = new THREE.Mesh(
      wb.track(new THREE.BoxGeometry(0.032, 0.11, 0.008)),
      wb.track(new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.4 }))
    );
    blade.rotation.z = (b / 5) * Math.PI * 2;
    fanHub.add(blade);
  }
  fumeGroup.add(fanHub);

  const fumeLedMat = wb.track(
    new THREE.MeshStandardMaterial({ color: '#22c55e', emissive: '#16a34a', emissiveIntensity: 0.05 })
  );
  const fumeLed = new THREE.Mesh(wb.track(new THREE.SphereGeometry(0.016, 12, 12)), fumeLedMat);
  fumeLed.position.set(-0.1, 0.06, 0.085);
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
    wb.track(new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.45 }))
  );
  spongeTray.position.y = 0.015;
  const spongePad = new THREE.Mesh(
    wb.track(new THREE.BoxGeometry(0.19, 0.032, 0.13)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.92 }))
  );
  spongePad.position.y = 0.028;
  spongeGroup.add(spongeTray, spongePad);
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
  spoolGroup.add(spoolFlangeTop, spoolFlangeBot, spoolCore);
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
    wb.track(new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.45 }))
  );
  ironHandle.position.y = 0.18;
  ironGroup.add(ironHandle);

  const ironShaft = new THREE.Mesh(
    wb.track(new THREE.CylinderGeometry(0.009, 0.009, 0.14, 12)),
    standMat
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

  function triggerPowerTest() {
    if (finalized) return;
    powerOn = !powerOn;
    pwrLever.rotation.x = powerOn ? 0.35 : -0.35;
    if (!powerOn) {
      pcbLeds.forEach((l) => (l.mat.emissiveIntensity = 0.05));
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
      setTimeout(() => {
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
      pcbLeds.forEach((l) => (l.mat.emissiveIntensity = 0.05));
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
          pcbLeds.forEach((l) => (l.mat.emissiveIntensity = 0.05));
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
          syncKnobAngle();
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
    { id: 'global', label: '🔭 Vue Globale', pos: [0, 1.32, 1.48], look: [0, 0.08, 0.02] },
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

  wb.addUpdate((dt) => {
    if (fumeExtractorOn) {
      fanHub.rotation.z += dt * 18;
    }

    ironTipMat.emissiveIntensity = Math.max(0.1, (tempC - 240) / 140);
    ironGroup.visible = tool !== 'wick';
    tinWireGroup.visible = tool === 'tin' || tinFeeding;

    ironGroup.position.lerp(ironTargetPos, 1 - Math.exp(-18 * dt));
    if (tinWireGroup.visible) {
      const tinGoal = ironTargetPos.clone().add(new THREE.Vector3(0.14, -0.04, 0.06));
      tinWireGroup.position.lerp(tinGoal, 1 - Math.exp(-16 * dt));
    }

    allPads.forEach((pad) => {
      if (activePad !== pad && pad.temp > 25) {
        pad.temp = Math.max(25, pad.temp - dt * 24);
        updatePadVisual(pad);
      }
    });

    if (powerOn && pcbPowerLedTime > 0) {
      pcbPowerLedTime += dt;
      pcbLeds.forEach((l, idx) => {
        l.mat.emissiveIntensity = pcbPowerLedTime > idx * 0.25 ? 2.2 : 0.05;
      });
    }
  });

  allPads.forEach(updatePadVisual);
  refreshHud();

  return {
    destroy: () => {
      stopTouchHold();
      wb.destroy();
    }
  };
}
