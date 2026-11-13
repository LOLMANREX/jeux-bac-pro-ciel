import * as THREE from 'three';
import { sfx } from '../core/audio.js';
import {
  createWorkbench3D,
  makeCanvasScreen,
  buildFlexibleCable,
  createEsdMatTexture
} from './Workbench3DHost.js';

export const COLOR_CODES = [
  { name: 'Noir', digit: 0, mult: 1, hex: '#111827' },
  { name: 'Marron', digit: 1, mult: 10, hex: '#78350f' },
  { name: 'Rouge', digit: 2, mult: 100, hex: '#dc2626' },
  { name: 'Orange', digit: 3, mult: 1000, hex: '#f97316' },
  { name: 'Jaune', digit: 4, mult: 10000, hex: '#facc15' },
  { name: 'Vert', digit: 5, mult: 100000, hex: '#16a34a' },
  { name: 'Bleu', digit: 6, mult: 1000000, hex: '#2563eb' },
  { name: 'Violet', digit: 7, mult: 10000000, hex: '#9333ea' },
  { name: 'Gris', digit: 8, mult: null, hex: '#64748b' },
  { name: 'Blanc', digit: 9, mult: null, hex: '#f8fafc' }
];

export function computeResistorOhms(b1, b2, b3MultIdx) {
  const mult = COLOR_CODES[b3MultIdx]?.mult;
  if (!mult) return 0;
  return (b1 * 10 + b2) * mult;
}

export function formatOhms(ohms) {
  if (ohms >= 1000000) return `${(ohms / 1000000).toFixed(2).replace(/\.00$/, '')} MΩ`;
  if (ohms >= 1000) return `${(ohms / 1000).toFixed(2).replace(/\.00$/, '')} kΩ`;
  return `${ohms} Ω`;
}

export function simulateLedCircuit(vcc, ledUf, ohms, ledForwardPolarity) {
  if (!ledForwardPolarity) {
    return { status: 'reversed', currentMa: 0, vLed: 0, message: 'LED polarisée en inverse : aucun courant ne passe (0 mA).' };
  }
  if (ohms <= 0) {
    return { status: 'burned', currentMa: 999, vLed: vcc, message: 'Court-circuit ! Résistance nulle : la LED a grillé instantanément !' };
  }
  const currentMa = ((vcc - ledUf) / ohms) * 1000;
  if (currentMa > 32) {
    return {
      status: 'burned',
      currentMa: Math.round(currentMa * 10) / 10,
      vLed: ledUf,
      message: `Surintensité (${currentMa.toFixed(1)} mA > 30 mA) ! La LED a grillé !`
    };
  }
  if (currentMa < 6) {
    return {
      status: 'dim',
      currentMa: Math.round(currentMa * 10) / 10,
      vLed: ledUf,
      message: `Courant trop faible (${currentMa.toFixed(1)} mA). La LED éclaire à peine (visez 15–22 mA).`
    };
  }
  return {
    status: 'ok',
    currentMa: Math.round(currentMa * 10) / 10,
    vLed: ledUf,
    message: `Circuit nominal ! Courant mesuré : ${currentMa.toFixed(1)} mA — LED allumée !`
  };
}

export function simulateDividerCircuit(vin, r1Ohms, r2Ohms) {
  if (r1Ohms <= 0 || r2Ohms <= 0) return { vout: 0, ok: false, message: 'Résistances invalides.' };
  const vout = vin * (r2Ohms / (r1Ohms + r2Ohms));
  const ok = vout >= 3.1 && vout <= 3.45;
  return {
    vout: Math.round(vout * 100) / 100,
    ok,
    message: ok
      ? `Parfait ! Vout = ${vout.toFixed(2)} V (compatible entrée GPIO 3.3V ESP32).`
      : vout > 3.45
        ? `DANGER : Vout = ${vout.toFixed(2)} V (> 3.45 V) risque de détruire l'ESP32 !`
        : `Vout = ${vout.toFixed(2)} V trop faible pour détecter un niveau logique HAUT.`
  };
}

export const ELEC_STAGES = [
  { id: 1, name: '1. Loi d’Ohm & Code Couleur' },
  { id: 2, name: '2. Pont Diviseur 5V → 3.3V' },
  { id: 3, name: '3. Mesure Multimètre 3D' }
];

export function computeElectronicsScore3D(metrics = {}) {
  let pts = 0;
  if (metrics.multimeterChecked) pts += 3;
  if (metrics.ledStatus === 'ok') pts += 6;
  else if (metrics.ledStatus === 'dim') pts += 2.5;
  if (metrics.dividerOk) pts += 7;
  else if ((metrics.dividerVout || 0) > 0 && (metrics.dividerVout || 0) <= 3.6) pts += 3;
  if (metrics.powerTested) pts += 4;
  const burns = Math.max(0, metrics.burnCount || 0);
  const elapsed = metrics.elapsedSec || 0;
  const timePenalty = elapsed > 240 ? Math.min(1.5, (elapsed - 240) / 100) : 0;
  const score = Math.max(0, Math.min(20, Math.round(pts - burns * 1.5 - timePenalty)));
  const xp = Math.max(45, Math.round(score * 16 + (metrics.ledStatus === 'ok' && metrics.dividerOk ? 60 : 15)));
  return { score, xp, accuracy: Math.round((score / 20) * 100) };
}

const RESISTOR_STOCK = [
  { id: 'r47', ohms: 47, bands: [4, 7, 0], label: '47 Ω (Jaune-Violet-Noir)' },
  { id: 'r220', ohms: 220, bands: [2, 2, 1], label: '220 Ω (Rouge-Rouge-Marron)' },
  { id: 'r1k', ohms: 1000, bands: [1, 0, 2], label: '1 kΩ (Marron-Noir-Rouge)' },
  { id: 'r10k', ohms: 10000, bands: [1, 0, 3], label: '10 kΩ (Marron-Noir-Orange)' },
  { id: 'r20k', ohms: 20000, bands: [2, 0, 3], label: '20 kΩ (Rouge-Noir-Orange)' }
];

export function createElectronicsGame(api) {
  const bench = createWorkbench3D(api.container, {
    cameraPos: [0.02, 1.12, 1.14],
    lookAt: [0.0, 0.14, -0.02],
    fov: 39,
    hasEsdMat: false
  });

  const esdTex = createEsdMatTexture('#1e3a5f', '#38bdf8');
  const matMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.75, 0.014, 1.02),
    new THREE.MeshStandardMaterial({ map: esdTex, roughness: 0.72 })
  );
  matMesh.position.set(0, 0.007, 0);
  matMesh.receiveShadow = true;
  bench.scene.add(matMesh);

  const breadboardGroup = new THREE.Group();
  breadboardGroup.position.set(-0.08, 0.014, 0.04);
  bench.scene.add(breadboardGroup);

  const bbBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.028, 0.44),
    new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.55 })
  );
  bbBody.position.y = 0.014;
  bbBody.castShadow = true;
  bbBody.receiveShadow = true;
  breadboardGroup.add(bbBody);

  const railTopRed = new THREE.Mesh(
    new THREE.BoxGeometry(0.70, 0.004, 0.012),
    new THREE.MeshStandardMaterial({ color: 0xef4444 })
  );
  railTopRed.position.set(0, 0.029, -0.175);
  const railBotBlue = new THREE.Mesh(
    new THREE.BoxGeometry(0.70, 0.004, 0.012),
    new THREE.MeshStandardMaterial({ color: 0x2563eb })
  );
  railBotBlue.position.set(0, 0.029, 0.175);
  breadboardGroup.add(railTopRed, railBotBlue);

  const bbLabelScreen = makeCanvasScreen(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('CIRCUIT 1: +5V -> R_LED -> LED (2V / 15mA)', 16, 42);
    ctx.fillText('CIRCUIT 2: +5V -> R1 -> [Vout 3.3V] -> R2 -> GND', 16, 94);
  });
  const bbLegend = new THREE.Mesh(
    new THREE.PlaneGeometry(0.68, 0.09),
    new THREE.MeshBasicMaterial({ map: bbLabelScreen.texture })
  );
  bbLegend.rotation.x = -Math.PI / 2;
  bbLegend.position.set(0, 0.0295, -0.095);
  breadboardGroup.add(bbLegend);

  function buildResistorMesh(bands) {
    const grp = new THREE.Group();
    const leadMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.85, roughness: 0.2 });
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.13, 8), leadMat);
    wire.rotation.z = Math.PI / 2;
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.068, 16),
      new THREE.MeshStandardMaterial({ color: 0xe7d3ad, roughness: 0.45 })
    );
    body.rotation.z = Math.PI / 2;
    body.castShadow = true;
    grp.add(wire, body);

    const offsets = [-0.020, -0.007, 0.007, 0.022];
    const hexes = [
      COLOR_CODES[bands[0]].hex,
      COLOR_CODES[bands[1]].hex,
      COLOR_CODES[bands[2]].hex,
      '#d97706'
    ];
    offsets.forEach((ox, idx) => {
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0126, 0.0126, 0.007, 16),
        new THREE.MeshStandardMaterial({ color: hexes[idx], roughness: 0.35 })
      );
      band.rotation.z = Math.PI / 2;
      band.position.x = ox;
      grp.add(band);
    });
    return grp;
  }

  const ledGroup = new THREE.Group();
  ledGroup.position.set(0.14, 0.028, 0.03);
  breadboardGroup.add(ledGroup);
  const ledBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.024, 0.012, 16),
    new THREE.MeshStandardMaterial({ color: 0x334155 })
  );
  ledBase.position.y = 0.006;
  const ledDomeMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 0.05,
    roughness: 0.2,
    transparent: true,
    opacity: 0.88
  });
  const ledDome = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 12), ledDomeMat);
  ledDome.position.y = 0.026;
  const ledAnodeDot = new THREE.Mesh(
    new THREE.BoxGeometry(0.014, 0.004, 0.014),
    new THREE.MeshStandardMaterial({ color: 0x22c55e })
  );
  ledAnodeDot.position.set(-0.026, 0.004, 0);
  ledGroup.add(ledBase, ledDome, ledAnodeDot);

  const espGroup = new THREE.Group();
  espGroup.position.set(0.24, 0.028, 0.11);
  breadboardGroup.add(espGroup);
  const espPcb = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.014, 0.085),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 })
  );
  espPcb.position.y = 0.007;
  const espScreen = makeCanvasScreen(256, 128, (ctx, w, h, st) => {
    const s = st || { vout: 0, ok: false };
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = s.vout > 3.45 ? '#ef4444' : s.ok ? '#4ade80' : '#38bdf8';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(`GPIO: ${s.vout.toFixed(2)}V`, 24, 58);
    ctx.font = '18px monospace';
    ctx.fillText(s.ok ? 'ESP32 3.3V OK' : s.vout > 3.45 ? 'SURTENSION !' : 'ATTENTE 3.3V', 24, 102);
  });
  const espOled = new THREE.Mesh(
    new THREE.PlaneGeometry(0.12, 0.06),
    new THREE.MeshBasicMaterial({ map: espScreen.texture })
  );
  espOled.rotation.x = -Math.PI / 2;
  espOled.position.set(0, 0.0155, 0);
  espGroup.add(espPcb, espOled);

  const slotDefs = [
    { id: 'rLed', label: 'Slot R_LED (Circuit 5V)', x: -0.14, z: 0.03 },
    { id: 'r1', label: 'Slot R1 Haut (Pont Diviseur)', x: -0.18, z: 0.11 },
    { id: 'r2', label: 'Slot R2 Bas (Pont Diviseur)', x: 0.02, z: 0.11 }
  ];
  const slotMeshes = {};
  const placedResGroups = {};
  for (const sd of slotDefs) {
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.008, 0.045),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.5 })
    );
    pad.position.set(sd.x, 0.030, sd.z);
    breadboardGroup.add(pad);
    slotMeshes[sd.id] = pad;
  }

  const dmmGroup = new THREE.Group();
  dmmGroup.position.set(0.54, 0.014, -0.08);
  dmmGroup.rotation.y = -0.35;
  bench.scene.add(dmmGroup);

  const dmmBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.065, 0.36),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.42 })
  );
  dmmBody.position.y = 0.0325;
  dmmBody.castShadow = true;
  const dmmHolster = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.048, 0.38),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65 })
  );
  dmmHolster.position.y = 0.025;
  dmmGroup.add(dmmHolster, dmmBody);

  const dmmScreen = makeCanvasScreen(320, 180, (ctx, w, h, st) => {
    const s = st || { mode: 'OHM', valueText: '--- Ω', subText: 'Sélectionnez une résistance' };
    ctx.fillStyle = '#9db394';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 5;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`MODE: ${s.mode}`, 16, 36);
    ctx.font = 'bold 46px monospace';
    ctx.fillText(s.valueText, 16, 106);
    ctx.font = '16px monospace';
    ctx.fillText(s.subText, 16, 152);
  });
  const dmmLcd = new THREE.Mesh(
    new THREE.PlaneGeometry(0.19, 0.11),
    new THREE.MeshBasicMaterial({ map: dmmScreen.texture })
  );
  dmmLcd.rotation.x = -Math.PI / 2;
  dmmLcd.position.set(0, 0.066, -0.09);
  dmmGroup.add(dmmLcd);

  const dmmDial = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.06, 0.024, 24),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 })
  );
  dmmDial.position.set(0, 0.07, 0.055);
  const dmmPointer = new THREE.Mesh(
    new THREE.BoxGeometry(0.012, 0.028, 0.085),
    new THREE.MeshStandardMaterial({ color: 0xef4444 })
  );
  dmmPointer.position.set(0, 0.072, 0.055);
  dmmGroup.add(dmmDial, dmmPointer);

  const pwrSupplyGroup = new THREE.Group();
  pwrSupplyGroup.position.set(-0.62, 0.014, -0.22);
  pwrSupplyGroup.rotation.y = 0.25;
  bench.scene.add(pwrSupplyGroup);

  const pwrBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.14, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.4 })
  );
  pwrBox.position.y = 0.07;
  pwrBox.castShadow = true;
  const pwrBtnMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x16a34a,
    emissiveIntensity: 0.2
  });
  const pwrBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.022, 20), pwrBtnMat);
  pwrBtn.rotation.x = Math.PI / 2;
  pwrBtn.position.set(0.06, 0.07, 0.115);
  pwrSupplyGroup.add(pwrBox, pwrBtn);

  const pwrRedWire = buildFlexibleCable(
    [[-0.56, 0.08, -0.10], [-0.46, 0.05, -0.05], [-0.38, 0.045, -0.13]],
    0xef4444,
    0.005
  );
  const pwrBlackWire = buildFlexibleCable(
    [[-0.68, 0.08, -0.10], [-0.52, 0.04, 0.12], [-0.38, 0.045, 0.21]],
    0x1e293b,
    0.005
  );
  bench.scene.add(pwrRedWire.mesh, pwrBlackWire.mesh);

  const trayGroup = new THREE.Group();
  trayGroup.position.set(0.50, 0.014, 0.28);
  bench.scene.add(trayGroup);
  const trayBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.018, 0.30),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 })
  );
  trayBox.position.y = 0.009;
  trayGroup.add(trayBox);

  const trayResistorMeshes = {};
  RESISTOR_STOCK.forEach((resDef, idx) => {
    const rMesh = buildResistorMesh(resDef.bands);
    rMesh.position.set(-0.20 + idx * 0.10, 0.032, 0);
    rMesh.rotation.y = Math.PI / 2;
    trayGroup.add(rMesh);
    trayResistorMeshes[resDef.id] = rMesh;
  });

  const state = {
    dmmMode: 'OHM',
    selectedResistorId: 'r220',
    slots: { rLed: null, r1: null, r2: null },
    ledForwardPolarity: true,
    powerOn: false,
    multimeterChecked: false,
    burnCount: 0,
    finished: false,
    camId: 'overview'
  };

  const CAM_VIEWS = [
    { id: 'overview', label: 'Vue Établi', pos: [0.02, 1.12, 1.14], lookAt: [0.0, 0.14, -0.02], fov: 39 },
    { id: 'breadboard', label: 'Zoom Breadboard', pos: [-0.08, 0.56, 0.44], lookAt: [-0.08, 0.04, 0.06], fov: 36 },
    { id: 'dmm', label: 'Zoom Multimètre', pos: [0.46, 0.52, 0.30], lookAt: [0.54, 0.04, -0.08], fov: 36 }
  ];

  function selectCamera(id) {
    const v = CAM_VIEWS.find((c) => c.id === id);
    if (!v) return;
    state.camId = id;
    bench.setCameraView(v.pos, v.lookAt, v.fov);
    bench.setCameras(CAM_VIEWS, id, selectCamera);
  }

  function updateVisuals() {
    const rLedDef = RESISTOR_STOCK.find((r) => r.id === state.slots.rLed);
    const r1Def = RESISTOR_STOCK.find((r) => r.id === state.slots.r1);
    const r2Def = RESISTOR_STOCK.find((r) => r.id === state.slots.r2);

    const ledSim = rLedDef
      ? simulateLedCircuit(5, 2.0, rLedDef.ohms, state.ledForwardPolarity)
      : { status: 'open', currentMa: 0, message: 'R_LED manquant' };
    const divSim =
      r1Def && r2Def
        ? simulateDividerCircuit(5, r1Def.ohms, r2Def.ohms)
        : { vout: 0, ok: false, message: 'R1 ou R2 manquant' };

    if (state.powerOn) {
      pwrBtnMat.emissiveIntensity = 2.0;
      if (ledSim.status === 'ok') {
        ledDomeMat.emissiveIntensity = 2.4;
      } else if (ledSim.status === 'dim') {
        ledDomeMat.emissiveIntensity = 0.4;
      } else {
        ledDomeMat.emissiveIntensity = 0.02;
      }
      espScreen.update({ vout: divSim.vout, ok: divSim.ok });
    } else {
      pwrBtnMat.emissiveIntensity = 0.2;
      ledDomeMat.emissiveIntensity = 0.05;
      espScreen.update({ vout: 0, ok: false });
    }

    ledAnodeDot.material.color.setHex(state.ledForwardPolarity ? 0x22c55e : 0xef4444);

    if (state.dmmMode === 'OHM') {
      dmmPointer.rotation.y = -0.5;
      const sel = RESISTOR_STOCK.find((r) => r.id === state.selectedResistorId);
      dmmScreen.update({
        mode: 'OHMMÈTRE (Ω)',
        valueText: sel ? formatOhms(sel.ohms) : 'OL',
        subText: sel ? sel.label : 'Sélectionnez une résistance'
      });
    } else {
      dmmPointer.rotation.y = 0.6;
      dmmScreen.update({
        mode: 'VOLTMÈTRE (V DC)',
        valueText: state.powerOn ? `${divSim.vout.toFixed(2)} V` : '0.00 V',
        subText: state.powerOn ? (divSim.ok ? 'Cible 3.3V conforme ✔' : 'Cible ESP32 : 3.1–3.45V') : 'Allumez +5V pour mesurer'
      });
    }

    return { ledSim, divSim };
  }

  function placeResistorInSlot(slotId) {
    const resDef = RESISTOR_STOCK.find((r) => r.id === state.selectedResistorId);
    if (!resDef) return;
    if (placedResGroups[slotId]) {
      breadboardGroup.remove(placedResGroups[slotId]);
    }
    const sd = slotDefs.find((s) => s.id === slotId);
    const mesh = buildResistorMesh(resDef.bands);
    mesh.position.set(sd.x, 0.044, sd.z);
    breadboardGroup.add(mesh);
    placedResGroups[slotId] = mesh;
    state.slots[slotId] = resDef.id;
    state.multimeterChecked = true;
    sfx.click();
    bench.spawnPulseRing([sd.x - 0.08, 0.04, sd.z + 0.04], '#38bdf8', 0.07);
    bench.showToast(`${resDef.label} insérée sur ${sd.label} !`, 'info');
    updateVisuals();
    refreshHud();
  }

  function togglePower5V() {
    state.powerOn = !state.powerOn;
    const { ledSim, divSim } = updateVisuals();
    sfx.click();
    if (state.powerOn) {
      if (ledSim.status === 'burned') {
        state.burnCount += 1;
        sfx.error();
        bench.spawnSmoke([0.06, 0.08, 0.07], { count: 12, color: '#1f2937' });
        bench.showToast(ledSim.message, 'error');
      } else if (ledSim.status === 'ok' && divSim.ok) {
        sfx.success();
        bench.showToast(`Circuit 5V actif : LED ${ledSim.currentMa} mA & ESP32 ${divSim.vout}V !`, 'success');
      } else {
        bench.showToast(`Alim +5V ON : ${ledSim.message}`, ledSim.status === 'ok' ? 'success' : 'info');
      }
    }
    refreshHud();
  }

  function finishWorkshop() {
    if (state.finished) return;
    state.finished = true;
    const { ledSim, divSim } = updateVisuals();
    const res = computeElectronicsScore3D({
      multimeterChecked: state.multimeterChecked,
      ledStatus: ledSim.status,
      dividerOk: divSim.ok,
      dividerVout: divSim.vout,
      powerTested: state.powerOn,
      burnCount: state.burnCount,
      elapsedSec: bench.getElapsedSec()
    });
    sfx.success();
    api.finishTp(
      res.score,
      `
        <p>Atelier Électronique & Multimètre 3D validé en <strong>${Math.round(bench.getElapsedSec())}s</strong> :</p>
        <ul>
          <li>Circuit LED 5V : <strong>${ledSim.message}</strong></li>
          <li>Pont Diviseur 5V → 3.3V : <strong>Vout = ${divSim.vout} V (${divSim.ok ? 'Conforme' : 'Hors plage'})</strong></li>
          <li>Pénalités surintensité / LED grillée : <strong>${state.burnCount}</strong></li>
        </ul>
      `
    );
  }

  function refreshHud() {
    const { ledSim, divSim } = updateVisuals();
    const ready = ledSim.status === 'ok' && divSim.ok && state.powerOn;
    bench.setInstruction(
      ready ? 'CIRCUITS VALIDÉS' : 'ÉLECTRONIQUE & MULTIMÈTRE 3D',
      ready
        ? 'LED nominale (~13.6 mA) et Pont diviseur (3.33 V) conformes !'
        : 'Mesurez les résistances, câbles R_LED (220Ω) + Pont Diviseur 3.3V (R1=10kΩ, R2=20kΩ) et activez +5V',
      'Sélectionnez une résistance sur le plateau pour la mesurer au Multimètre 3D puis cliquez sur un slot de la Breadboard.'
    );
    bench.setAccuracy(`LED: ${ledSim.currentMa} mA · Vout: ${divSim.vout.toFixed(2)}V`);

    bench.setTools(
      RESISTOR_STOCK.map((r) => ({ id: r.id, icon: '⚡', label: formatOhms(r.ohms) })),
      state.selectedResistorId,
      (id) => {
        state.selectedResistorId = id;
        state.multimeterChecked = true;
        sfx.click();
        updateVisuals();
        refreshHud();
      }
    );

    bench.setActions([
      { id: 'dmm-mode', label: state.dmmMode === 'OHM' ? 'Multimètre: Mode Ω → V DC' : 'Multimètre: Mode V DC → Ω', onClick: () => { state.dmmMode = state.dmmMode === 'OHM' ? 'VDC' : 'OHM'; state.multimeterChecked = true; updateVisuals(); refreshHud(); } },
      { id: 'pwr-5v', label: state.powerOn ? 'Couper +5V' : 'Alimenter +5V', primary: !ready, onClick: togglePower5V },
      { id: 'finish-elec', label: 'Valider l’Atelier /20', primary: ready, onClick: finishWorkshop }
    ]);
  }

  function resetAll() {
    state.slots = { rLed: null, r1: null, r2: null };
    for (const k of Object.keys(placedResGroups)) {
      breadboardGroup.remove(placedResGroups[k]);
      delete placedResGroups[k];
    }
    state.powerOn = false;
    state.ledForwardPolarity = true;
    state.burnCount = 0;
    state.finished = false;
    updateVisuals();
    refreshHud();
  }

  for (const resDef of RESISTOR_STOCK) {
    bench.addInteractive(trayResistorMeshes[resDef.id], {
      label: `Résistance ${resDef.label} (Mesurer au multimètre)`,
      onClick: () => {
        state.selectedResistorId = resDef.id;
        state.dmmMode = 'OHM';
        state.multimeterChecked = true;
        sfx.click();
        bench.showToast(`Mesure Ω : ${resDef.label}`, 'info');
        updateVisuals();
        refreshHud();
      }
    });
  }

  for (const sd of slotDefs) {
    bench.addInteractive(slotMeshes[sd.id], {
      label: `${sd.label} (Clic pour insérer la résistance sélectionnée)`,
      onClick: () => placeResistorInSlot(sd.id)
    });
  }

  bench.addInteractive(ledGroup, {
    label: 'LED Rouge (Clic pour inverser polarité Anode/Cathode)',
    onClick: () => {
      state.ledForwardPolarity = !state.ledForwardPolarity;
      sfx.click();
      bench.showToast(state.ledForwardPolarity ? 'LED en polarisation directe (+ → -).' : 'LED inversée (aucun courant).', 'info');
      updateVisuals();
      refreshHud();
    }
  });

  bench.addInteractive(dmmDial, {
    label: 'Sélecteur Multimètre (Ω / V DC)',
    onClick: () => {
      state.dmmMode = state.dmmMode === 'OHM' ? 'VDC' : 'OHM';
      state.multimeterChecked = true;
      sfx.click();
      updateVisuals();
      refreshHud();
    }
  });

  bench.addInteractive(pwrBtn, {
    label: 'Interrupteur Alimentation Stabilisée +5V',
    onClick: togglePower5V
  });

  bench.addFloatingTag(() => new THREE.Vector3(-0.22, 0.08, 0.07), 'Slot R_LED', 'rled');
  bench.addFloatingTag(() => new THREE.Vector3(-0.26, 0.08, 0.15), 'R1 Haut', 'r1');
  bench.addFloatingTag(() => new THREE.Vector3(-0.06, 0.08, 0.15), 'R2 Bas', 'r2');
  bench.addFloatingTag(() => new THREE.Vector3(0.54, 0.14, -0.08), 'Multimètre', 'dmm');
  bench.addFloatingTag(() => new THREE.Vector3(-0.62, 0.19, -0.22), 'Alim +5V', 'pwr');

  bench.setCameras(CAM_VIEWS, state.camId, selectCamera);
  refreshHud();

  return {
    destroy: () => bench.destroy(),
    reset: resetAll
  };
}
