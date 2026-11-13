import * as THREE from 'three';
import { sfx } from '../core/audio.js';
import { buildFlexibleCable, createWorkbench3D, makeCanvasScreen } from './Workbench3DHost.js';

export const OSCILLO_STAGES = [
  {
    id: 1,
    name: '1. Signal Sinusoïdal',
    brief: 'Accrochez la pince de masse noire sur GND, placez la sonde rouge sur TP1, puis tournez les molettes 3D (Trigger, V/div, ms/div) pour stabiliser le signal.',
    signalType: 'sine',
    freqHz: 1000,
    uppV: 6.0,
    dcOffsetV: 0,
    dutyCycle: 50,
    requireCoupling: 'DC',
    needCh2: false,
    questionType: 'freq_upp',
    hint: 'La période T vaut 1 ms (f = 1000 Hz, Upp = 6 V). Cadrez 2 à 5 périodes avec Trigger entre -2V et +2V.'
  },
  {
    id: 2,
    name: '2. Signal PWM (Microcontrôleur)',
    brief: 'Inspectez TP2/TP3 : réglez Trigger dans la plage PWM 0–5V, restez en couplage DC et observez le défaut de filtrage.',
    signalType: 'pwm',
    freqHz: 500,
    uppV: 5.0,
    dcOffsetV: 2.5,
    dutyCycle: 25,
    requireCoupling: 'DC',
    needCh2: false,
    questionType: 'pwm',
    hint: 'En DC, un PWM 0–5V oscille autour de +2.5V. Placez Trigger vers +2.0V.'
  },
  {
    id: 3,
    name: '3. Diagnostic & Remplacement',
    brief: 'Localisez le composant endommagé qui fume légèrement, remplacez-le par le composant neuf sur le plateau, puis vérifiez TP3 à l’oscilloscope.',
    signalType: 'ripple',
    freqHz: 100,
    uppV: 10.0,
    dcOffsetV: 0,
    dutyCycle: 50,
    ch2RippleV: 2.4,
    ch2DcV: 5.0,
    requireCoupling: 'DC',
    needCh2: true,
    questionType: 'diagnostic',
    correctDiag: 'cap_fault',
    hint: 'Le condensateur C2 gonflé provoque une forte ondulation sur TP3. Remplacez-le puis re-sondez TP3 !'
  }
];

export function evaluateOscilloscopeStage(stage, controls, answers) {
  const periodSec = 1 / stage.freqHz;
  const visibleTimeSec = controls.timePerDivMs * 1e-3 * 10;
  const visiblePeriods = visibleTimeSec / periodSec;
  const totalVoltsSpan = controls.vPerDiv * 8;
  const signalHeightRatio = stage.uppV / totalVoltsSpan;

  const minV = stage.signalType === 'pwm' ? 0 : -stage.uppV / 2;
  const maxV = stage.signalType === 'pwm' ? stage.uppV : stage.uppV / 2;
  const effectiveMin = controls.coupling === 'AC' ? -stage.uppV / 2 : minV;
  const effectiveMax = controls.coupling === 'AC' ? stage.uppV / 2 : maxV;

  const triggerLocked =
    controls.triggerLevel > effectiveMin + 0.25 &&
    controls.triggerLevel < effectiveMax - 0.25;

  const couplingOk = !stage.requireCoupling || controls.coupling === stage.requireCoupling;
  const ch2Ok = !stage.needCh2 || controls.ch2Enabled;
  const framingOk = visiblePeriods >= 1.2 && visiblePeriods <= 6.5 && signalHeightRatio >= 0.3 && signalHeightRatio <= 0.96;

  const issues = [];
  if (!triggerLocked) issues.push('Le Trigger ne coupe pas le signal (courbe instable).');
  if (!couplingOk) issues.push(`Le couplage doit être sur ${stage.requireCoupling} pour une mesure fidèle.`);
  if (!ch2Ok) issues.push('Activez le canal CH2 pour observer la sortie.');
  if (!framingOk) issues.push('Ajustez Base de temps / V/div pour bien cadrer 2 à 5 périodes.');

  let answerScore = 0;
  if (stage.questionType === 'freq_upp') {
    const fErr = Math.abs(Number(answers.freq) - stage.freqHz) / stage.freqHz;
    const uErr = Math.abs(Number(answers.upp) - stage.uppV) / stage.uppV;
    if (fErr <= 0.08) answerScore += 0.5;
    else issues.push(`Fréquence inexacte (attendu ~${stage.freqHz} Hz).`);
    if (uErr <= 0.1) answerScore += 0.5;
    else issues.push(`Amplitude Upp inexacte (attendu ~${stage.uppV} V).`);
  } else if (stage.questionType === 'pwm') {
    const fErr = Math.abs(Number(answers.freq) - stage.freqHz) / stage.freqHz;
    const dErr = Math.abs(Number(answers.duty) - stage.dutyCycle);
    if (fErr <= 0.08) answerScore += 0.5;
    else issues.push(`Fréquence PWM inexacte (attendu ${stage.freqHz} Hz).`);
    if (dErr <= 4) answerScore += 0.5;
    else issues.push(`Rapport cyclique inexact (attendu ${stage.dutyCycle}%).`);
  } else if (stage.questionType === 'diagnostic') {
    const rErr = Math.abs(Number(answers.ripple) - stage.ch2RippleV);
    if (rErr <= 0.4) answerScore += 0.45;
    else issues.push(`Ondulation ΔU sur CH2 inexacte (attendu ~${stage.ch2RippleV} V).`);
    if (answers.diag === stage.correctDiag) answerScore += 0.55;
    else issues.push('Diagnostic de panne incorrect sur CH2.');
  }

  let calibScore = 0;
  if (triggerLocked) calibScore += 0.35;
  if (couplingOk) calibScore += 0.2;
  if (ch2Ok) calibScore += 0.15;
  if (framingOk) calibScore += 0.3;

  const totalRatio = calibScore * 0.45 + answerScore * 0.55;
  return {
    passed: issues.length === 0,
    ratio: totalRatio,
    triggerLocked,
    issues
  };
}

export function computeOscilloBenchScore({ gndAttached, tp1Stabilized, tp2Probed, tp3Probed, componentReplaced, tp3VerifiedAfterRepair, mistakes, durationSec }) {
  let pts = 0;
  if (gndAttached) pts += 3.0;
  if (tp1Stabilized) pts += 4.5;
  if (tp2Probed) pts += 2.0;
  if (tp3Probed) pts += 2.5;
  if (componentReplaced) pts += 4.0;
  if (tp3VerifiedAfterRepair) pts += 3.0;
  if (durationSec <= 130) pts += 1.0;
  else if (durationSec <= 200) pts += 0.5;
  pts -= Math.min(3.5, mistakes * 0.7);
  return Math.max(0, Math.min(20, Math.round(pts * 10) / 10));
}

export function createOscilloscopeBench3D(api, opts = {}) {
  const isElecVariant = opts.variant === 'electronics';
  const voltsSteps = [0.2, 0.5, 1.0, 2.0, 5.0];
  const timeStepsMs = [0.1, 0.2, 0.5, 1.0, 2.0, 5.0];

  let vDivIdx = 4;
  let tDivIdx = 5;
  let triggerV = -4.2;
  let coupling = 'DC';

  let activeTool = 'gnd_clip';
  let gndAttached = false;
  let activeProbePoint = null;
  let tp1Stabilized = false;
  let tp2Probed = false;
  let tp3Probed = false;
  let componentReplaced = false;
  let tp3VerifiedAfterRepair = false;
  let mistakes = 0;
  let finalized = false;

  const wb = createWorkbench3D(api.container, {
    cameraPos: [0.05, 1.12, 1.75],
    lookAt: [0, 0.22, -0.08],
    fov: 40,
    hasEsdMat: true,
    esdColor: '#1e3a5f',
    esdGridColor: '#3b82f6'
  });

  const scopeGroup = new THREE.Group();
  scopeGroup.position.set(-0.46, 0.01, -0.44);
  scopeGroup.rotation.y = 0.14;
  wb.scene.add(scopeGroup);

  const scopeChassis = new THREE.Mesh(
    wb.track(new THREE.BoxGeometry(0.96, 0.52, 0.42)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.42, metalness: 0.12 }))
  );
  scopeChassis.position.y = 0.26;
  scopeChassis.castShadow = true;
  scopeChassis.receiveShadow = true;
  scopeGroup.add(scopeChassis);

  const bezel = new THREE.Mesh(
    wb.track(new THREE.BoxGeometry(0.56, 0.36, 0.02)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.5 }))
  );
  bezel.position.set(-0.14, 0.29, 0.205);
  scopeGroup.add(bezel);

  const scopeScreen = makeCanvasScreen(512, 320, (ctx, w, h, st) => {
    const state = st || { phase: 0, locked: false, gnd: false, tp: null };
    ctx.fillStyle = '#031510';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(16, 185, 129, 0.22)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= 10; gx++) {
      const x = (gx / 10) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let gy = 0; gy <= 8; gy++) {
      const y = (gy / 8) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const vPerDiv = voltsSteps[vDivIdx];
    const tMsPerDiv = timeStepsMs[tDivIdx];
    const midY = h / 2;
    const pxPerVolt = (h / 8) / vPerDiv;

    const trigY = midY - (coupling === 'AC' ? triggerV : triggerV) * pxPerVolt;
    if (trigY >= 0 && trigY <= h) {
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(0, trigY);
      ctx.lineTo(w, trigY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 8;
    ctx.beginPath();

    const totalSec = tMsPerDiv * 1e-3 * 10;
    for (let px = 0; px < w; px++) {
      const tSec = (px / w) * totalSec;
      let volts = 0;
      if (!state.tp) {
        volts = (Math.random() - 0.5) * 0.08;
      } else if (!state.gnd) {
        volts = 1.6 * Math.sin(tSec * 2 * Math.PI * 50 + state.phase * 4) + (Math.random() - 0.5) * 0.9;
      } else {
        const phOffset = state.locked ? 0 : state.phase * 7.5;
        if (state.tp === 'TP1') {
          const freq = isElecVariant ? 500 : 1000;
          const amp = isElecVariant ? 2.5 : 3.0;
          const off = isElecVariant ? 2.5 : 0;
          const raw = isElecVariant
            ? ((Math.sin(tSec * 2 * Math.PI * freq + phOffset) > 0.25 ? 1 : -1) * amp + off)
            : (Math.sin(tSec * 2 * Math.PI * freq + phOffset) * amp);
          volts = coupling === 'AC' ? raw - off : raw;
        } else if (state.tp === 'TP2') {
          const freq = 500;
          const phaseNorm = ((tSec * freq + phOffset / (Math.PI * 2)) % 1 + 1) % 1;
          const pwm = phaseNorm < 0.35 ? 5.0 : 0.0;
          const ripple = componentReplaced ? 0 : Math.sin(tSec * 2 * Math.PI * 1500) * 1.1;
          volts = (coupling === 'AC' ? pwm - 1.75 : pwm) + ripple;
        } else if (state.tp === 'TP3') {
          if (componentReplaced) {
            const dcVal = isElecVariant ? 3.3 : 5.0;
            const noise = Math.sin(tSec * 2 * Math.PI * 1000 + phOffset) * 0.05;
            volts = (coupling === 'AC' ? 0 : dcVal) + noise;
          } else {
            const sag = isElecVariant ? 1.1 : 3.2;
            const rip = Math.sin(tSec * 2 * Math.PI * 100 + phOffset) * 1.5;
            volts = (coupling === 'AC' ? 0 : sag) + rip;
          }
        }
      }
      const py = Math.max(4, Math.min(h - 4, midY - volts * pxPerVolt));
      if (px === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(2, 18, 14, 0.82)';
    ctx.fillRect(0, 0, w, 28);
    ctx.fillRect(0, h - 28, w, 28);
    ctx.fillStyle = '#a7f3d0';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`CH1 ${vPerDiv}V/div  ${tMsPerDiv}ms/div  [${coupling}]`, 10, 19);
    ctx.fillStyle = state.locked && state.tp && state.gnd ? '#34d399' : '#fbbf24';
    ctx.fillText(
      !state.tp
        ? 'SONDE LIBRE'
        : !state.gnd
          ? '⚠️ MASSE FLOTTANTE (GND!)'
          : state.locked
            ? `🔒 TRIG LOCK • ${state.tp}`
            : `⚡ DRIFT TRIG ${triggerV.toFixed(1)}V`,
      w - 220,
      19
    );
    ctx.fillStyle = '#38bdf8';
    const infoStr =
      state.tp === 'TP1'
        ? isElecVariant
          ? 'MES: PWM 500Hz • 0-5V'
          : 'MES: SINUS 1.0kHz • Upp=6.0V'
        : state.tp === 'TP2'
          ? componentReplaced
            ? 'MES: ÉTAGE FILTRÉ NOMINAL'
            : '⚠️ BRUIT / PARASITES SUR TP2'
          : state.tp === 'TP3'
            ? componentReplaced
              ? isElecVariant
                ? '✅ SORTIE PONT 3.30V STABLE'
                : '✅ SORTIE +5.0V RÉGULÉE OK'
              : isElecVariant
                ? '❌ CHUTE TENSION 1.1V (R4 HS!)'
                : '❌ ONDULATION ±1.5V (C2 GONFLÉ!)'
            : 'Connectez pince GND et sonde TP1';
    ctx.fillText(infoStr, 10, h - 9);
  });

  const screenMesh = new THREE.Mesh(
    wb.track(new THREE.PlaneGeometry(0.51, 0.315)),
    wb.track(new THREE.MeshBasicMaterial({ map: scopeScreen.texture }))
  );
  screenMesh.position.set(-0.14, 0.29, 0.218);
  scopeGroup.add(screenMesh);

  function createKnob3D(x, y, labelFn, colorHex, onDelta, onStepClick) {
    const g = new THREE.Group();
    g.position.set(x, y, 0.22);
    const body = new THREE.Mesh(
      wb.track(new THREE.CylinderGeometry(0.036, 0.04, 0.038, 22)),
      wb.track(new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.35, metalness: 0.55 }))
    );
    body.rotation.x = Math.PI / 2;
    g.add(body);
    const marker = new THREE.Mesh(
      wb.track(new THREE.BoxGeometry(0.008, 0.024, 0.04)),
      wb.track(new THREE.MeshBasicMaterial({ color: colorHex }))
    );
    marker.position.set(0, 0.015, 0.005);
    g.add(marker);
    scopeGroup.add(g);

    let accum = 0;
    wb.addInteractive(g, {
      label: labelFn,
      cursor: 'ew-resize',
      onDragMove: (_pt, dx) => {
        accum += dx;
        if (Math.abs(accum) >= 18) {
          onDelta(accum > 0 ? 1 : -1);
          accum = 0;
        }
      },
      onClick: () => {
        onStepClick();
      }
    });
    return g;
  }

  const syncKnobAngles = () => {
    vKnob.rotation.z = -(vDivIdx / (voltsSteps.length - 1) * 3.8 - 1.9);
    tKnob.rotation.z = -(tDivIdx / (timeStepsMs.length - 1) * 3.8 - 1.9);
    trigKnob.rotation.z = -((triggerV + 5) / 10 * 4.2 - 2.1);
  };

  const vKnob = createKnob3D(
    0.22,
    0.39,
    () => `🎛️ VOLTS/DIV : ${voltsSteps[vDivIdx]} V/div (Glisser ↔ / cliquer)`,
    '#22d3ee',
    (dir) => {
      vDivIdx = Math.max(0, Math.min(voltsSteps.length - 1, vDivIdx + dir));
      sfx.click();
      syncKnobAngles();
      checkOscilloProgress();
    },
    () => {
      vDivIdx = (vDivIdx + 1) % voltsSteps.length;
      sfx.click();
      syncKnobAngles();
      checkOscilloProgress();
    }
  );

  const tKnob = createKnob3D(
    0.36,
    0.39,
    () => `⏱️ TIME/DIV : ${timeStepsMs[tDivIdx]} ms/div (Glisser ↔ / cliquer)`,
    '#34d399',
    (dir) => {
      tDivIdx = Math.max(0, Math.min(timeStepsMs.length - 1, tDivIdx + dir));
      sfx.click();
      syncKnobAngles();
      checkOscilloProgress();
    },
    () => {
      tDivIdx = (tDivIdx + 1) % timeStepsMs.length;
      sfx.click();
      syncKnobAngles();
      checkOscilloProgress();
    }
  );

  const trigKnob = createKnob3D(
    0.29,
    0.23,
    () => `⚡ TRIGGER : ${triggerV.toFixed(1)} V (Glisser ↔ / cliquer)`,
    '#facc15',
    (dir) => {
      triggerV = Math.max(-5, Math.min(5, Math.round((triggerV + dir * 0.4) * 10) / 10));
      sfx.click();
      syncKnobAngles();
      checkOscilloProgress();
    },
    () => {
      triggerV = activeProbePoint === 'TP1' && !isElecVariant ? 0.5 : 2.0;
      sfx.click();
      syncKnobAngles();
      checkOscilloProgress();
    }
  );

  const acdcBtn = new THREE.Mesh(
    wb.track(new THREE.BoxGeometry(0.11, 0.045, 0.028)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.35 }))
  );
  acdcBtn.position.set(0.29, 0.11, 0.215);
  scopeGroup.add(acdcBtn);
  wb.addInteractive(acdcBtn, {
    label: () => `🔌 Couplage : ${coupling} (Cliquer pour basculer AC / DC)`,
    onClick: () => {
      coupling = coupling === 'DC' ? 'AC' : 'DC';
      sfx.click();
      checkOscilloProgress();
    }
  });
  syncKnobAngles();

  const gbfGroup = new THREE.Group();
  gbfGroup.position.set(0.62, 0.01, -0.45);
  gbfGroup.rotation.y = -0.15;
  wb.scene.add(gbfGroup);
  const gbfBox = new THREE.Mesh(
    wb.track(new THREE.BoxGeometry(0.62, 0.32, 0.36)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.44, metalness: 0.3 }))
  );
  gbfBox.position.y = 0.16;
  gbfBox.castShadow = true;
  gbfGroup.add(gbfBox);

  const gbfScreen = makeCanvasScreen(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#071a12';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('GBF-CIEL PRO', 16, 30);
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 34px monospace';
    ctx.fillText(isElecVariant ? '500.0 Hz' : '1.000 kHz', 16, 78);
    ctx.fillStyle = '#fde68a';
    ctx.font = '16px monospace';
    ctx.fillText(isElecVariant ? 'PWM 0-5V OUT ON' : 'SINE 6Vpp OUT ON', 16, 110);
  });
  const gbfPlane = new THREE.Mesh(
    wb.track(new THREE.PlaneGeometry(0.42, 0.17)),
    wb.track(new THREE.MeshBasicMaterial({ map: gbfScreen.texture }))
  );
  gbfPlane.position.set(0, 0.19, 0.183);
  gbfGroup.add(gbfPlane);

  const pcbGroup = new THREE.Group();
  pcbGroup.position.set(-0.08, 0.025, 0.25);
  wb.scene.add(pcbGroup);

  const pcbTexCanvas = document.createElement('canvas');
  pcbTexCanvas.width = 768;
  pcbTexCanvas.height = 512;
  const pCtx = pcbTexCanvas.getContext('2d');
  pCtx.fillStyle = '#14532d';
  pCtx.fillRect(0, 0, 768, 512);
  pCtx.strokeStyle = '#fbbf24';
  pCtx.lineWidth = 5;
  pCtx.beginPath();
  pCtx.moveTo(100, 260);
  pCtx.lineTo(310, 260);
  pCtx.lineTo(420, 170);
  pCtx.lineTo(620, 170);
  pCtx.moveTo(310, 260);
  pCtx.lineTo(420, 340);
  pCtx.lineTo(620, 340);
  pCtx.stroke();
  pCtx.fillStyle = '#f8fafc';
  pCtx.font = 'bold 22px monospace';
  pCtx.fillText(isElecVariant ? 'CARTE ALIM / DIVISEUR EN PANNE' : 'CARTE FILTRE / PWM EN PANNE', 34, 48);
  const pcbTex = wb.track(new THREE.CanvasTexture(pcbTexCanvas));
  pcbTex.colorSpace = THREE.SRGBColorSpace;
  const pcbMesh = new THREE.Mesh(
    wb.track(new THREE.BoxGeometry(1.02, 0.022, 0.62)),
    wb.track(new THREE.MeshStandardMaterial({ map: pcbTex, roughness: 0.45, metalness: 0.14 }))
  );
  pcbMesh.castShadow = true;
  pcbMesh.receiveShadow = true;
  pcbGroup.add(pcbMesh);

  const faultPartGroup = new THREE.Group();
  faultPartGroup.position.set(0.06, 0.014, 0.02);
  pcbGroup.add(faultPartGroup);

  const badCapMesh = new THREE.Mesh(
    wb.track(new THREE.CylinderGeometry(0.048, 0.048, 0.14, 18)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#1c1917', roughness: 0.72, metalness: 0.2 }))
  );
  badCapMesh.position.y = 0.07;
  badCapMesh.visible = !isElecVariant;
  faultPartGroup.add(badCapMesh);

  const bulgeCap = new THREE.Mesh(
    wb.track(new THREE.SphereGeometry(0.047, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.45)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#a16207', roughness: 0.4, metalness: 0.7 }))
  );
  bulgeCap.position.y = 0.135;
  bulgeCap.visible = !isElecVariant;
  faultPartGroup.add(bulgeCap);

  const badResMesh = new THREE.Mesh(
    wb.track(new THREE.CylinderGeometry(0.028, 0.028, 0.16, 14)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#292524', roughness: 0.9 }))
  );
  badResMesh.rotation.z = Math.PI / 2;
  badResMesh.position.y = 0.036;
  badResMesh.visible = isElecVariant;
  faultPartGroup.add(badResMesh);

  const healthyPartMesh = new THREE.Group();
  healthyPartMesh.visible = false;
  if (isElecVariant) {
    const newR = new THREE.Mesh(
      wb.track(new THREE.CylinderGeometry(0.026, 0.026, 0.16, 16)),
      wb.track(new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.35 }))
    );
    newR.rotation.z = Math.PI / 2;
    newR.position.y = 0.036;
    healthyPartMesh.add(newR);
  } else {
    const newC = new THREE.Mesh(
      wb.track(new THREE.CylinderGeometry(0.044, 0.044, 0.13, 18)),
      wb.track(new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.28, metalness: 0.35 }))
    );
    newC.position.y = 0.065;
    healthyPartMesh.add(newC);
  }
  faultPartGroup.add(healthyPartMesh);

  const statusLedMat = wb.track(
    new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#dc2626', emissiveIntensity: 1.5 })
  );
  const statusLed = new THREE.Mesh(wb.track(new THREE.SphereGeometry(0.02, 14, 14)), statusLedMat);
  statusLed.position.set(0.4, 0.025, 0.18);
  pcbGroup.add(statusLed);

  const trayGroup = new THREE.Group();
  trayGroup.position.set(0.74, 0.02, 0.25);
  wb.scene.add(trayGroup);
  const trayMesh = new THREE.Mesh(
    wb.track(new THREE.BoxGeometry(0.42, 0.03, 0.42)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.5 }))
  );
  trayGroup.add(trayMesh);
  const sparePart = new THREE.Mesh(
    wb.track(isElecVariant ? new THREE.CylinderGeometry(0.03, 0.03, 0.18, 16) : new THREE.CylinderGeometry(0.052, 0.052, 0.15, 18)),
    wb.track(new THREE.MeshStandardMaterial({ color: isElecVariant ? '#d97706' : '#0284c7', roughness: 0.3 }))
  );
  if (isElecVariant) sparePart.rotation.z = Math.PI / 2;
  sparePart.position.y = isElecVariant ? 0.05 : 0.095;
  trayGroup.add(sparePart);
  const spareTag = wb.addFloatingTag(
    new THREE.Vector3(0.74, 0.19, 0.25),
    isElecVariant ? '🆕 Résistance 470Ω neuve' : '🆕 Condo 470µF neuf'
  );

  function replaceFaultyComponent() {
    if (componentReplaced) return;
    if (!tp2Probed && !tp3Probed) {
      mistakes += 1;
      wb.showToast('Sondez d’abord TP2 et TP3 pour identifier la panne !', 'error');
      sfx.error();
      refreshHud();
      return;
    }
    componentReplaced = true;
    badCapMesh.visible = false;
    bulgeCap.visible = false;
    badResMesh.visible = false;
    healthyPartMesh.visible = true;
    sparePart.visible = false;
    spareTag.setVisible(false);
    statusLedMat.color.set('#22c55e');
    statusLedMat.emissive.set('#16a34a');
    wb.spawnPulseRing(new THREE.Vector3(-0.02, 0.05, 0.27), '#10b981', 0.14);
    wb.spawnSparks(new THREE.Vector3(-0.02, 0.07, 0.27), { color: '#34d399', count: 12 });
    sfx.success();
    wb.showToast('Composant remplacé ! Re-sondez TP3 pour confirmer le signal !', 'success');
    checkOscilloProgress();
  }

  wb.addInteractive(sparePart, {
    label: () =>
      isElecVariant
        ? '🆕 Résistance R4 neuve — Cliquer pour remplacer la résistance brûlée'
        : '🆕 Condensateur C2 neuf — Cliquer pour remplacer C2 gonflé',
    onClick: () => replaceFaultyComponent()
  });

  wb.addInteractive(faultPartGroup, {
    label: () =>
      componentReplaced
        ? '✅ Composant neuf installé'
        : isElecVariant
          ? '⚠️ Résistance R4 grillée (fume légèrement) — Sélectionnez la pièce neuve pour remplacer'
          : '⚠️ Condensateur C2 gonflé (fume légèrement) — Cliquer avec pièce neuve ou bac à droite',
    onClick: () => {
      if (activeTool === 'replace' || sparePart.visible) {
        replaceFaultyComponent();
      }
    }
  });

  const tpPoints = [
    { id: 'GND', x: -0.34, z: 0.16, color: '#1e293b', tag: '⚫ GND (Masse)' },
    { id: 'TP1', x: -0.34, z: -0.14, color: '#f59e0b', tag: '🟡 TP1 (Entrée GBF)' },
    { id: 'TP2', x: 0.02, z: -0.14, color: '#22d3ee', tag: '🔵 TP2 (Filtrage)' },
    { id: 'TP3', x: 0.34, z: -0.02, color: '#ec4899', tag: '🟣 TP3 (Sortie)' }
  ];

  const probeMeshGroup = new THREE.Group();
  probeMeshGroup.position.set(-0.62, 0.12, 0.45);
  wb.scene.add(probeMeshGroup);
  const probeBody = new THREE.Mesh(
    wb.track(new THREE.CylinderGeometry(0.014, 0.018, 0.24, 14)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.35 }))
  );
  probeBody.position.y = 0.12;
  probeBody.rotation.x = 0.35;
  probeMeshGroup.add(probeBody);
  const probeTip = new THREE.Mesh(
    wb.track(new THREE.ConeGeometry(0.008, 0.05, 10)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.9, roughness: 0.2 }))
  );
  probeTip.rotation.x = Math.PI + 0.35;
  probeTip.position.set(0, -0.01, -0.045);
  probeMeshGroup.add(probeTip);

  const gndClipGroup = new THREE.Group();
  gndClipGroup.position.set(-0.72, 0.06, 0.34);
  wb.scene.add(gndClipGroup);
  const clipBody = new THREE.Mesh(
    wb.track(new THREE.BoxGeometry(0.036, 0.028, 0.09)),
    wb.track(new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.5 }))
  );
  gndClipGroup.add(clipBody);

  const probeCable = buildFlexibleCable([[-0.42, 0.1, -0.22], [-0.55, 0.04, 0.12], [-0.62, 0.22, 0.48]], '#ef4444', 0.009);
  const gndCable = buildFlexibleCable([[-0.42, 0.1, -0.22], [-0.65, 0.03, 0.1], [-0.72, 0.06, 0.34]], '#0f172a', 0.009);
  wb.scene.add(probeCable.mesh);
  wb.scene.add(gndCable.mesh);

  const syncCables = () => {
    const pPos = probeMeshGroup.position;
    probeCable.updatePoints([
      new THREE.Vector3(-0.42, 0.11, -0.22),
      new THREE.Vector3((pPos.x - 0.42) * 0.5, 0.06, (pPos.z - 0.22) * 0.5),
      new THREE.Vector3(pPos.x, pPos.y + 0.16, pPos.z + 0.06)
    ]);
    const gPos = gndClipGroup.position;
    gndCable.updatePoints([
      new THREE.Vector3(-0.42, 0.11, -0.22),
      new THREE.Vector3((gPos.x - 0.42) * 0.5, 0.03, (gPos.z - 0.22) * 0.5),
      new THREE.Vector3(gPos.x, gPos.y + 0.015, gPos.z)
    ]);
  };
  syncCables();

  const pointTags = new Map();
  tpPoints.forEach((pt) => {
    const turret = new THREE.Mesh(
      wb.track(new THREE.CylinderGeometry(0.018, 0.022, 0.045, 16)),
      wb.track(new THREE.MeshStandardMaterial({ color: pt.color === '#1e293b' ? '#94a3b8' : '#eab308', metalness: 0.85, roughness: 0.2 }))
    );
    turret.position.set(pt.x, 0.032, pt.z);
    pcbGroup.add(turret);

    const hitCap = new THREE.Mesh(
      wb.track(new THREE.SphereGeometry(0.065, 12, 12)),
      wb.track(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }))
    );
    hitCap.position.y = 0.02;
    turret.add(hitCap);

    const ftag = wb.addFloatingTag(new THREE.Vector3(pcbGroup.position.x + pt.x, 0.14, pcbGroup.position.z + pt.z), pt.tag);
    pointTags.set(pt.id, ftag);

    wb.addInteractive(turret, {
      label: () =>
        pt.id === 'GND'
          ? '⚫ Cliquer pour fixer la Pince Crocodile Noire sur GND'
          : `🔴 Cliquer pour mesurer ${pt.id} avec la Sonde Rouge`,
      onClick: () => {
        const wx = pcbGroup.position.x + pt.x;
        const wz = pcbGroup.position.z + pt.z;
        if (pt.id === 'GND') {
          gndAttached = true;
          gndClipGroup.position.set(wx, 0.068, wz);
          syncCables();
          ftag.el.className = 'tp3d-float-tag ok';
          ftag.setHtml('✅ GND relié');
          wb.spawnPulseRing(new THREE.Vector3(wx, 0.05, wz), '#10b981', 0.08);
          sfx.click();
          wb.showToast('Pince crocodile noire reliée à GND !', 'success');
        } else {
          if (!gndAttached) {
            mistakes += 1;
            wb.showToast('⚠️ Signal bruité : branchez d’abord la pince noire sur GND !', 'error');
            sfx.error();
          } else {
            sfx.interact();
          }
          activeProbePoint = pt.id;
          probeMeshGroup.position.set(wx, 0.095, wz + 0.045);
          syncCables();
          wb.spawnPulseRing(new THREE.Vector3(wx, 0.05, wz), '#22d3ee', 0.08);
          if (pt.id === 'TP2' && gndAttached) tp2Probed = true;
          if (pt.id === 'TP3' && gndAttached) {
            tp3Probed = true;
            if (componentReplaced) tp3VerifiedAfterRepair = true;
          }
        }
        checkOscilloProgress();
      }
    });
  });

  function isCurrentSignalStabilized() {
    if (!gndAttached || !activeProbePoint) return false;
    const vPerDiv = voltsSteps[vDivIdx];
    const tMs = timeStepsMs[tDivIdx];
    if (activeProbePoint === 'TP1') {
      const freq = isElecVariant ? 500 : 1000;
      const periods = (tMs * 1e-3 * 10) / (1 / freq);
      const upp = isElecVariant ? 5.0 : 6.0;
      const heightRatio = upp / (vPerDiv * 8);
      const trigOk = isElecVariant ? triggerV > 0.3 && triggerV < 4.7 : triggerV > -2.7 && triggerV < 2.7;
      return trigOk && periods >= 1.5 && periods <= 6.5 && heightRatio >= 0.3 && heightRatio <= 0.96 && coupling === 'DC';
    }
    if (activeProbePoint === 'TP2') {
      return triggerV > 0.3 && triggerV < 4.5 && coupling === 'DC';
    }
    if (activeProbePoint === 'TP3') {
      return coupling === 'DC' && vPerDiv <= 2.0;
    }
    return false;
  }

  function checkOscilloProgress() {
    if (activeProbePoint === 'TP1' && isCurrentSignalStabilized()) {
      if (!tp1Stabilized) {
        tp1Stabilized = true;
        pointTags.get('TP1').el.className = 'tp3d-float-tag ok';
        sfx.success();
        wb.showToast('✅ TP1 mesuré et verrouillé ! Inspectez TP2 et TP3 !', 'success');
      }
    }
    if (tp2Probed && pointTags.has('TP2')) {
      pointTags.get('TP2').el.className = 'tp3d-float-tag ok';
    }
    if (tp3VerifiedAfterRepair && pointTags.has('TP3')) {
      pointTags.get('TP3').el.className = 'tp3d-float-tag ok';
    }

    refreshHud();

    if (tp1Stabilized && tp2Probed && tp3Probed && componentReplaced && tp3VerifiedAfterRepair && !finalized) {
      finalized = true;
      const durationSec = Math.round(wb.getElapsedSec());
      const score = computeOscilloBenchScore({
        gndAttached,
        tp1Stabilized,
        tp2Probed,
        tp3Probed,
        componentReplaced,
        tp3VerifiedAfterRepair,
        mistakes,
        durationSec
      });
      setTimeout(() => {
        api.finishTp(
          score,
          `
          <ul>
            <li>⚫ Pince crocodile GND : <strong>Connectée</strong></li>
            <li>〰️ Signal TP1 stabilisé (V/div, ms/div, Trigger) : <strong>Validé</strong></li>
            <li>🔍 Inspection TP2 / TP3 & composant défectueux : <strong>Localisé</strong></li>
            <li>🛠️ Remplacement 3D & validation signal propre : <strong>OK</strong></li>
          </ul>`
        );
      }, 1300);
    }
  }

  function refreshHud() {
    const score = computeOscilloBenchScore({
      gndAttached,
      tp1Stabilized,
      tp2Probed,
      tp3Probed,
      componentReplaced,
      tp3VerifiedAfterRepair,
      mistakes,
      durationSec: Math.round(wb.getElapsedSec())
    });
    wb.setAccuracy(`${score.toFixed(1)} / 20`);

    let stepBadge = 'ÉTAPE 1/4';
    let stepTitle = 'Brancher la masse (GND) et sonder TP1';
    let stepSub = 'Cliquez sur GND pour accrocher la pince noire, puis sur TP1 avec la sonde rouge.';
    if (gndAttached && !tp1Stabilized) {
      stepBadge = 'ÉTAPE 2/4';
      stepTitle = 'Régler les molettes 3D de l’Oscilloscope sur TP1';
      stepSub = `Tournez Trigger (${triggerV.toFixed(1)}V), VOLTS/DIV (${voltsSteps[vDivIdx]}V) et TIME/DIV (${timeStepsMs[tDivIdx]}ms) jusqu’à verrouiller 2 à 5 périodes.`;
    } else if (tp1Stabilized && (!tp2Probed || !tp3Probed)) {
      stepBadge = 'ÉTAPE 3/4';
      stepTitle = 'Inspecter TP2 et TP3 pour diagnostiquer la panne';
      stepSub = 'Déplacez la sonde rouge sur TP2 puis TP3 et repérez quel composant fume sur la carte.';
    } else if (tp2Probed && tp3Probed && !componentReplaced) {
      stepBadge = 'ÉTAPE 4/4';
      stepTitle = isElecVariant ? 'Remplacer la résistance brûlée R4' : 'Remplacer le condensateur gonflé C2';
      stepSub = 'Cliquez sur le composant neuf dans le bac blanc à droite pour remplacer la pièce défectueuse.';
    } else if (componentReplaced) {
      stepBadge = 'VÉRIFICATION';
      stepTitle = 'Re-sonder TP3 après réparation';
      stepSub = 'Cliquez sur TP3 avec la sonde rouge pour confirmer le retour au signal nominal !';
    }

    wb.setInstruction(stepBadge, stepTitle, stepSub);

    api.setStages(
      [
        { name: `${gndAttached ? '✅ ' : ''}1. Masse GND` },
        { name: `${tp1Stabilized ? '✅ ' : ''}2. Calibrage Oscillo` },
        { name: `${componentReplaced ? '✅ ' : ''}3. Réparation 3D` }
      ],
      componentReplaced ? 2 : tp1Stabilized ? 1 : 0,
      () => {}
    );

    wb.setTools(
      [
        { id: 'gnd_clip', icon: '⚫', label: gndAttached ? 'Masse OK' : 'Pince GND' },
        { id: 'probe', icon: '🔴', label: 'Sonde Rouge' },
        { id: 'replace', icon: '🧰', label: 'Pièce Neuve' }
      ],
      activeTool,
      (id) => {
        activeTool = id;
        if (id === 'replace' && (tp2Probed || tp3Probed) && !componentReplaced) {
          replaceFaultyComponent();
        }
        refreshHud();
      }
    );

    wb.setActions([
      {
        label: '🎛️ Trigger Auto (-/+)',
        onClick: () => {
          triggerV = activeProbePoint === 'TP1' && !isElecVariant ? 0.5 : 2.0;
          vDivIdx = 2;
          tDivIdx = 2;
          coupling = 'DC';
          syncKnobAngles();
          sfx.click();
          checkOscilloProgress();
        }
      },
      {
        label: `Couplage: ${coupling}`,
        onClick: () => {
          coupling = coupling === 'DC' ? 'AC' : 'DC';
          sfx.click();
          checkOscilloProgress();
        }
      }
    ]);
  }

  let activeCam = 'global';
  const cams = [
    { id: 'global', label: '🔭 Vue Paillasse', pos: [0.05, 1.12, 1.75], look: [0, 0.22, -0.08] },
    { id: 'scope', label: '〰️ Zoom Oscilloscope', pos: [-0.42, 0.48, 0.85], look: [-0.46, 0.28, -0.44] },
    { id: 'pcb', label: '🔬 Zoom Carte & Test Points', pos: [-0.04, 0.72, 0.78], look: [-0.05, 0.05, 0.25] }
  ];
  const onCamSelect = (id) => {
    activeCam = id;
    const c = cams.find((x) => x.id === id);
    if (c) wb.setCameraView(c.pos, c.look, id === 'global' ? 40 : 34);
    wb.setCameras(cams, activeCam, onCamSelect);
  };
  wb.setCameras(cams, activeCam, onCamSelect);

  let smokeAccum = 0;
  let screenPhase = 0;
  wb.addUpdate((dt) => {
    screenPhase += dt;
    scopeScreen.update({
      phase: screenPhase,
      locked: isCurrentSignalStabilized(),
      gnd: gndAttached,
      tp: activeProbePoint
    });

    if (!componentReplaced) {
      smokeAccum += dt;
      if (smokeAccum > 0.28) {
        smokeAccum = 0;
        wb.spawnSmoke(new THREE.Vector3(-0.02, 0.14, 0.27), {
          color: '#64748b',
          count: 1,
          scale: 0.015,
          speed: 0.11,
          opacity: 0.35
        });
      }
    }
  });

  refreshHud();
  return {
    destroy: () => wb.destroy()
  };
}

export function createOscilloscopeGame(api) {
  return createOscilloscopeBench3D(api, { variant: 'oscilloscope' });
}
