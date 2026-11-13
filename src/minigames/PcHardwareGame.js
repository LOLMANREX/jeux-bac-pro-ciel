import * as THREE from 'three';
import { sfx } from '../core/audio.js';
import {
  createWorkbench3D,
  makeCanvasScreen,
  buildFlexibleCable,
  createEsdMatTexture
} from './Workbench3DHost.js';

export const HARDWARE_STAGES = [
  {
    id: 1,
    name: '1. Montage Station ESD',
    brief:
      'Enfilez d’abord le bracelet antistatique (ESD), installez chaque composant dans le bon emplacement (CPU + pâte thermique, RAM Dual-Channel A2/B2, NVMe M.2, Alimentation ATX) avant de lancer le POST.',
    type: 'assembly',
    requireEsd: true,
    slots: [
      { id: 'socket', label: 'Socket LGA1700', expectedPart: 'cpu', hint: 'Processeur + pâte thermique' },
      { id: 'dimm', label: 'Slots RAM A2 + B2', expectedPart: 'ram', hint: 'Barrettes Dual-Channel DDR5' },
      { id: 'm2', label: 'Port M.2 PCIe 4.0', expectedPart: 'nvme', hint: 'SSD NVMe Système' },
      { id: 'atx', label: 'Baie Alimentation & 24+8 pins', expectedPart: 'psu', hint: 'Bloc ATX 650W 80+ Gold' }
    ],
    parts: [
      { id: 'cpu', label: 'CPU Core i5 + Pâte thermique' },
      { id: 'ram', label: 'Kit 2x16 Go DDR5' },
      { id: 'nvme', label: 'SSD NVMe 1 To' },
      { id: 'psu', label: 'Alim ATX 650W' }
    ]
  },
  {
    id: 2,
    name: '2. Diagnostic POST & Pannes',
    brief:
      'Trois postes de l’atelier sont en panne. Analysez les bips POST et symptômes matériels puis choisissez le diagnostic exact pour chaque machine.',
    type: 'diag',
    cases: [
      {
        id: 'pc-a',
        title: 'Poste 04 : 3 bips courts + LED orange DRAM',
        symptom: 'Les ventilateurs tournent mais aucun affichage. La carte mère émet 3 bips courts.',
        options: [
          { id: 'ram', label: 'Barrette RAM mal clipsée / défectueuse (nettoyer & réenclencher en A2/B2)' },
          { id: 'disk', label: 'SSD NVMe non formaté' },
          { id: 'lan', label: 'Câble RJ45 débranché' }
        ],
        expected: 'ram'
      },
      {
        id: 'pc-b',
        title: 'Poste 07 : Extinction brutale à 98°C après 2 minutes',
        symptom: 'Le BIOS indique CPU Temp 98°C dès le démarrage et le ventilateur ventirad est figé.',
        options: [
          { id: 'bios', label: 'Pile CMOS CR2032 usée' },
          { id: 'cooling', label: 'Ventirad débranché (CPU_FAN) / absence de pâte thermique' },
          { id: 'gpu', label: 'Pilote écran manquant' }
        ],
        expected: 'cooling'
      },
      {
        id: 'pc-c',
        title: 'Poste 11 : Message "No Bootable Device Found"',
        symptom: 'Le POST réussit (1 bip court) mais le PC boucle sur l’UEFI sans démarrer Windows/Linux.',
        options: [
          { id: 'psu', label: 'Câble HDMI branché sur la carte mère' },
          { id: 'boot', label: 'SSD M.2 déconnecté ou ordre de boot UEFI corrompu' },
          { id: 'esd', label: 'Touche Verr Num désactivée' }
        ],
        expected: 'boot'
      }
    ]
  }
];

export function evaluateHardwareBuild(stage, state) {
  const details = [];
  if (stage.type === 'assembly') {
    let points = 0;
    const maxPoints = stage.slots.length + 1;
    if (state?.esdStrap) points += 1;
    else details.push('Bracelet antistatique ESD oublié avant manipulation des composants !');

    const placements = state?.placements || {};
    for (const slot of stage.slots) {
      if (placements[slot.id] === slot.expectedPart) {
        points += 1;
      } else {
        details.push(`${slot.label} : composant incorrect ou manquant (${slot.hint})`);
      }
    }
    const score = Math.round((points / maxPoints) * 20);
    return { score, details, passed: score >= 12 };
  }

  const answers = state?.answers || {};
  let ok = 0;
  for (const c of stage.cases) {
    if (answers[c.id] === c.expected) ok += 1;
    else details.push(`${c.title} : diagnostic incorrect`);
  }
  const score = Math.round((ok / stage.cases.length) * 20);
  return { score, details, passed: score >= 12 };
}

export function computeHardwareScore3D(metrics = {}) {
  let score = 0;
  const details = [];
  if (metrics.esdWorn) score += 2.5;
  else details.push('Bracelet ESD non connecté avant la manipulation.');

  if (metrics.cpuInstalled && metrics.socketClosed) score += 2.5;
  else details.push('Processeur LGA1700 non verrouillé correctement.');

  if (metrics.pasteApplied) score += 2;
  else details.push('Pâte thermique oubliée sous le ventirad.');

  if (metrics.coolerInstalled) score += 2;
  else details.push('Ventirad non installé.');

  if (metrics.ramDualChannel) score += 3;
  else if ((metrics.ramCount || 0) >= 2) {
    score += 1.5;
    details.push('Barrettes DDR5 installées hors configuration Dual-Channel A2/B2.');
  } else {
    details.push('Mémoire DDR5 incomplète.');
  }

  if (metrics.nvmeInstalled) score += 2;
  else details.push('SSD NVMe M.2 absent.');

  if (metrics.gpuInstalled) score += 2;
  else details.push('Carte graphique PCIe absente.');

  if (metrics.cablesConnected) score += 2;
  else details.push('Câblage alimentation ATX 24+8 pins incomplet.');

  if (metrics.postPassed) score += 2;
  else details.push('Le test POST UEFI n’a pas abouti sans erreur.');

  const esdMistakes = Math.max(0, metrics.esdMistakes || 0);
  const failedPosts = Math.max(0, metrics.failedPosts || 0);
  const elapsed = metrics.elapsedSec || 0;
  const timePenalty = elapsed > 240 ? Math.min(2, (elapsed - 240) / 90) : 0;
  const finalScore = Math.max(0, Math.min(20, Math.round(score - esdMistakes * 1.2 - failedPosts * 0.8 - timePenalty)));
  const xp = Math.max(40, Math.round(finalScore * 16 + (metrics.postPassed ? 60 : 0)));
  const accuracy = Math.round((finalScore / 20) * 100);
  return { score: finalScore, xp, accuracy, details };
}

function makeMotherboardTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1b222c';
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  for (let i = 16; i < 512; i += 24) {
    ctx.beginPath();
    ctx.moveTo(i, 12);
    ctx.lineTo(i, 500);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 42; i++) {
    const y = 30 + (i * 11) % 460;
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(240 + (i * 17) % 210, y);
    ctx.lineTo(280 + (i * 13) % 180, Math.min(490, y + 35));
    ctx.stroke();
  }
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('CIEL-PRO Z790M REV 4.0', 22, 490);
  ctx.font = '12px monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('DDR5 DUAL-CHANNEL A2/B2', 290, 44);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createPcHardwareGame(api) {
  const bench = createWorkbench3D(api.container, {
    cameraPos: [0.05, 1.38, 1.18],
    lookAt: [0.02, 0.22, -0.02],
    fov: 40,
    hasEsdMat: false
  });

  const esdTex = createEsdMatTexture('#1e3a5f', '#38bdf8');
  const esdMatMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.75, 0.014, 1.05),
    new THREE.MeshStandardMaterial({ map: esdTex, roughness: 0.68, metalness: 0.04 })
  );
  esdMatMesh.position.set(0, 0.007, 0);
  esdMatMesh.receiveShadow = true;
  bench.scene.add(esdMatMesh);

  const pcCase = new THREE.Group();
  pcCase.position.set(-0.18, 0.014, -0.02);
  bench.scene.add(pcCase);

  const caseMetal = new THREE.MeshStandardMaterial({ color: 0x262d38, roughness: 0.42, metalness: 0.65 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x161b22, roughness: 0.55, metalness: 0.5 });

  const caseFloor = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.018, 0.62), caseMetal);
  caseFloor.position.set(0, 0.009, 0);
  caseFloor.castShadow = true;
  caseFloor.receiveShadow = true;
  pcCase.add(caseFloor);

  const wallTop = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.14, 0.02), caseMetal);
  wallTop.position.set(0, 0.08, -0.30);
  wallTop.castShadow = true;
  pcCase.add(wallTop);

  const wallBot = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.14, 0.02), caseMetal);
  wallBot.position.set(0, 0.08, 0.30);
  wallBot.castShadow = true;
  pcCase.add(wallBot);

  const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.62), caseMetal);
  wallLeft.position.set(-0.32, 0.08, 0);
  wallLeft.castShadow = true;
  pcCase.add(wallLeft);

  const wallRight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.62), caseMetal);
  wallRight.position.set(0.32, 0.08, 0);
  wallRight.castShadow = true;
  pcCase.add(wallRight);

  const psuShroud = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.075, 0.14), darkMetal);
  psuShroud.position.set(0, 0.056, 0.21);
  psuShroud.castShadow = true;
  psuShroud.receiveShadow = true;
  pcCase.add(psuShroud);

  const psuUnit = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.072, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.6 })
  );
  psuUnit.position.set(-0.20, 0.06, 0.21);
  pcCase.add(psuUnit);

  function buildFan(x, y, z, rotY = 0, radius = 0.048) {
    const fg = new THREE.Group();
    fg.position.set(x, y, z);
    fg.rotation.y = rotY;
    const frame = new THREE.Mesh(
      new THREE.CylinderGeometry(radius + 0.008, radius + 0.008, 0.022, 24, 1, true),
      darkMetal
    );
    frame.rotation.x = Math.PI / 2;
    fg.add(frame);
    const blades = new THREE.Group();
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.28, radius * 0.28, 0.02, 16), darkMetal);
    hub.rotation.x = Math.PI / 2;
    blades.add(hub);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.2 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.62, 0.004, radius * 0.28), bladeMat);
      b.position.set(Math.cos(a) * radius * 0.56, Math.sin(a) * radius * 0.56, 0);
      b.rotation.z = a;
      b.rotation.x = 0.45;
      blades.add(b);
    }
    fg.add(blades);
    return { group: fg, blades };
  }

  const caseFanRear = buildFan(-0.305, 0.082, -0.14, Math.PI / 2, 0.046);
  const caseFanFront = buildFan(0.305, 0.082, -0.05, Math.PI / 2, 0.052);
  pcCase.add(caseFanRear.group, caseFanFront.group);

  const pwrPanel = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.015, 0.055), darkMetal);
  pwrPanel.position.set(0.24, 0.155, 0.265);
  pcCase.add(pwrPanel);
  const pwrLedMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.35,
    roughness: 0.25
  });
  const pwrBtnMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.016, 0.014, 24), pwrLedMat);
  pwrBtnMesh.position.set(0.24, 0.168, 0.265);
  pcCase.add(pwrBtnMesh);

  const moboTex = makeMotherboardTexture();
  const mobo = new THREE.Group();
  mobo.position.set(-0.04, 0.028, -0.05);
  pcCase.add(mobo);

  const moboBoard = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.012, 0.38),
    new THREE.MeshStandardMaterial({ map: moboTex, roughness: 0.52, metalness: 0.18 })
  );
  moboBoard.receiveShadow = true;
  moboBoard.castShadow = true;
  mobo.add(moboBoard);

  const vrmLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.032, 0.034, 0.15),
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.32, metalness: 0.78 })
  );
  vrmLeft.position.set(-0.145, 0.022, -0.05);
  const vrmTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.028, 0.032),
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.32, metalness: 0.78 })
  );
  vrmTop.position.set(-0.05, 0.02, -0.155);
  mobo.add(vrmLeft, vrmTop);

  const socketGroup = new THREE.Group();
  socketGroup.position.set(-0.05, 0.008, -0.055);
  mobo.add(socketGroup);

  const socketBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.095, 0.008, 0.095),
    new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.38, metalness: 0.75 })
  );
  socketGroup.add(socketBase);

  const pinField = new THREE.Mesh(
    new THREE.BoxGeometry(0.072, 0.009, 0.072),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.3, metalness: 0.85 })
  );
  pinField.position.y = 0.002;
  socketGroup.add(pinField);

  const socketTriangle = new THREE.Mesh(
    new THREE.ConeGeometry(0.007, 0.003, 3),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xca8a04, emissiveIntensity: 0.6 })
  );
  socketTriangle.position.set(-0.041, 0.006, 0.041);
  socketTriangle.rotation.y = Math.PI * 0.25;
  socketGroup.add(socketTriangle);

  const ilmPivot = new THREE.Group();
  ilmPivot.position.set(-0.048, 0.008, 0);
  socketGroup.add(ilmPivot);
  const ilmCover = new THREE.Mesh(
    new THREE.BoxGeometry(0.088, 0.004, 0.088),
    new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.32, metalness: 0.85 })
  );
  ilmCover.position.set(0.048, 0, 0);
  ilmPivot.add(ilmCover);

  const leverPivot = new THREE.Group();
  leverPivot.position.set(0.054, 0.006, -0.048);
  socketGroup.add(leverPivot);
  const leverRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0026, 0.0026, 0.105, 12),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 })
  );
  leverRod.rotation.x = Math.PI / 2;
  leverRod.position.z = 0.052;
  const leverTip = new THREE.Mesh(
    new THREE.BoxGeometry(0.014, 0.006, 0.018),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.4 })
  );
  leverTip.position.set(0.006, 0, 0.102);
  leverPivot.add(leverRod, leverTip);

  const installedCpuMesh = new THREE.Group();
  installedCpuMesh.position.set(0, 0.009, 0);
  installedCpuMesh.visible = false;
  const cpuSubstrate = new THREE.Mesh(
    new THREE.BoxGeometry(0.068, 0.003, 0.068),
    new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.45 })
  );
  const cpuIhs = new THREE.Mesh(
    new THREE.BoxGeometry(0.056, 0.005, 0.056),
    new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.22, metalness: 0.9 })
  );
  cpuIhs.position.y = 0.004;
  const cpuTri = new THREE.Mesh(
    new THREE.ConeGeometry(0.0055, 0.002, 3),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 0.5 })
  );
  cpuTri.position.set(-0.028, 0.004, 0.028);
  cpuTri.rotation.y = Math.PI * 0.25;
  installedCpuMesh.add(cpuSubstrate, cpuIhs, cpuTri);
  socketGroup.add(installedCpuMesh);

  const thermalPastePea = new THREE.Mesh(
    new THREE.SphereGeometry(0.011, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.32, metalness: 0.55 })
  );
  thermalPastePea.scale.set(1, 0.52, 1);
  thermalPastePea.position.set(0, 0.016, 0);
  thermalPastePea.visible = false;
  socketGroup.add(thermalPastePea);

  const installedCooler = new THREE.Group();
  installedCooler.position.set(-0.05, 0.025, -0.055);
  installedCooler.visible = false;
  mobo.add(installedCooler);
  const coolerFinBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.105, 0.072, 0.095),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.85 })
  );
  coolerFinBlock.position.y = 0.044;
  coolerFinBlock.castShadow = true;
  const coolerTopPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.108, 0.008, 0.098),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.6 })
  );
  coolerTopPlate.position.y = 0.082;
  const coolerFan = buildFan(0.058, 0.044, 0, Math.PI / 2, 0.041);
  installedCooler.add(coolerFinBlock, coolerTopPlate, coolerFan.group);

  const dimmSlots = [];
  const dimmNames = ['A1', 'A2', 'B1', 'B2'];
  const dimmGroup = new THREE.Group();
  dimmGroup.position.set(0.095, 0.008, -0.055);
  mobo.add(dimmGroup);

  for (let i = 0; i < 4; i++) {
    const slotId = dimmNames[i];
    const isRecommended = slotId === 'A2' || slotId === 'B2';
    const xPos = (i - 1.5) * 0.021;
    const slotHolder = new THREE.Group();
    slotHolder.position.set(xPos, 0, 0);

    const slotBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.014, 0.148),
      new THREE.MeshStandardMaterial({
        color: isRecommended ? 0x1d4ed8 : 0x334155,
        roughness: 0.45
      })
    );
    slotHolder.add(slotBody);

    const latchMat = new THREE.MeshStandardMaterial({ color: isRecommended ? 0x60a5fa : 0x64748b, roughness: 0.4 });
    const latchTop = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.012, 0.014), latchMat);
    latchTop.position.set(0, 0.006, -0.078);
    latchTop.rotation.x = -0.35;
    const latchBot = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.012, 0.014), latchMat);
    latchBot.position.set(0, 0.006, 0.078);
    latchBot.rotation.x = 0.35;
    slotHolder.add(latchTop, latchBot);

    const stick = new THREE.Group();
    stick.visible = false;
    const stickPcb = new THREE.Mesh(
      new THREE.BoxGeometry(0.007, 0.036, 0.142),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.7 })
    );
    stickPcb.position.y = 0.019;
    const stickRgb = new THREE.Mesh(
      new THREE.BoxGeometry(0.008, 0.006, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.2 })
    );
    stickRgb.position.y = 0.038;
    stick.add(stickPcb, stickRgb);
    slotHolder.add(stick);

    dimmGroup.add(slotHolder);
    dimmSlots.push({ id: slotId, recommended: isRecommended, holder: slotHolder, body: slotBody, latchTop, latchBot, stick, rgbMat: stickRgb.material, populated: false });
  }

  const m2SlotMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.034, 0.008, 0.092),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45 })
  );
  m2SlotMesh.position.set(-0.045, 0.008, 0.055);
  mobo.add(m2SlotMesh);

  const installedNvme = new THREE.Group();
  installedNvme.position.set(-0.045, 0.014, 0.055);
  installedNvme.visible = false;
  const nvmeBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.028, 0.005, 0.086),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.5 })
  );
  const nvmeSticker = new THREE.Mesh(
    new THREE.BoxGeometry(0.022, 0.0056, 0.055),
    new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.4 })
  );
  installedNvme.add(nvmeBody, nvmeSticker);
  mobo.add(installedNvme);

  const pcieSlotMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.145, 0.012, 0.016),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.85 })
  );
  pcieSlotMesh.position.set(-0.06, 0.01, 0.115);
  mobo.add(pcieSlotMesh);

  const installedGpu = new THREE.Group();
  installedGpu.position.set(-0.045, 0.048, 0.115);
  installedGpu.visible = false;
  const gpuShroud = new THREE.Mesh(
    new THREE.BoxGeometry(0.245, 0.068, 0.042),
    new THREE.MeshStandardMaterial({ color: 0x1e2430, roughness: 0.38, metalness: 0.65 })
  );
  gpuShroud.castShadow = true;
  const gpuBackplate = new THREE.Mesh(
    new THREE.BoxGeometry(0.242, 0.064, 0.005),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.32, metalness: 0.78 })
  );
  gpuBackplate.position.z = -0.022;
  const gpuLogoMat = new THREE.MeshStandardMaterial({
    color: 0x4ade80,
    emissive: 0x16a34a,
    emissiveIntensity: 0.15
  });
  const gpuLogo = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.01, 0.004), gpuLogoMat);
  gpuLogo.position.set(0.03, 0.035, 0.012);
  const gpuFan1 = buildFan(-0.055, -0.004, 0.022, 0, 0.028);
  const gpuFan2 = buildFan(0.055, -0.004, 0.022, 0, 0.028);
  installedGpu.add(gpuShroud, gpuBackplate, gpuLogo, gpuFan1.group, gpuFan2.group);
  mobo.add(installedGpu);

  const atx24Header = new THREE.Mesh(
    new THREE.BoxGeometry(0.018, 0.018, 0.068),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 })
  );
  atx24Header.position.set(0.185, 0.014, -0.04);
  const eps8Header = new THREE.Mesh(
    new THREE.BoxGeometry(0.026, 0.018, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 })
  );
  eps8Header.position.set(-0.15, 0.014, -0.165);
  mobo.add(atx24Header, eps8Header);

  const atxCable = buildFlexibleCable(
    [[ -0.02, 0.07, 0.15 ], [ 0.04, 0.075, 0.04 ], [ 0.005, 0.048, -0.11 ]],
    0x334155,
    0.0085
  );
  atxCable.mesh.visible = false;
  const epsCable = buildFlexibleCable(
    [[ -0.34, 0.07, 0.14 ], [ -0.37, 0.055, -0.06 ], [ -0.37, 0.046, -0.235 ]],
    0xfacc15,
    0.0055
  );
  epsCable.mesh.visible = false;
  const gpuCable = buildFlexibleCable(
    [[ -0.12, 0.075, 0.16 ], [ -0.11, 0.105, 0.10 ], [ -0.15, 0.105, 0.04 ]],
    0x38bdf8,
    0.0065
  );
  gpuCable.mesh.visible = false;
  bench.scene.add(atxCable.mesh, epsCable.mesh, gpuCable.mesh);

  const postLedDefs = [
    { key: 'CPU', color: 0xef4444, x: 0.165, z: 0.09 },
    { key: 'DRAM', color: 0xf59e0b, x: 0.165, z: 0.115 },
    { key: 'VGA', color: 0xf8fafc, x: 0.165, z: 0.14 },
    { key: 'BOOT', color: 0x22c55e, x: 0.165, z: 0.165 }
  ];
  const postLeds = {};
  for (const def of postLedDefs) {
    const m = new THREE.MeshStandardMaterial({
      color: 0x334155,
      emissive: def.color,
      emissiveIntensity: 0
    });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 12, 10), m);
    led.position.set(def.x, 0.014, def.z);
    mobo.add(led);
    postLeds[def.key] = { mesh: led, mat: m, color: def.color };
  }

  const monitorGroup = new THREE.Group();
  monitorGroup.position.set(0.45, 0.014, -0.25);
  monitorGroup.rotation.y = -0.35;
  bench.scene.add(monitorGroup);

  const monStand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.014, 0.14), darkMetal);
  monStand.position.y = 0.007;
  const monNeck = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.03), darkMetal);
  monNeck.position.set(0, 0.12, -0.02);
  const monBezel = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.34, 0.028),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.45, metalness: 0.4 })
  );
  monBezel.position.set(0, 0.27, 0);
  monBezel.castShadow = true;
  monitorGroup.add(monStand, monNeck, monBezel);

  const biosScreen = makeCanvasScreen(640, 400, (ctx, w, h, st) => {
    if (!st || !st.powered) {
      ctx.fillStyle = '#090d14';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ÉCRAN DIAGNOSTIC — EN ATTENTE DE SIGNAL', w / 2, h / 2);
      ctx.textAlign = 'left';
      return;
    }

    ctx.fillStyle = st.postError ? '#2a0b0e' : '#0b182e';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = st.postError ? '#991b1b' : '#1d4ed8';
    ctx.fillRect(0, 0, w, 44);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('CIEL-BIOS UEFI v4.0 — STATION ATELIER HARDWARE', 18, 28);

    ctx.font = '15px monospace';
    ctx.fillStyle = '#cbd5e1';
    let y = 80;
    for (const line of st.lines || []) {
      ctx.fillStyle = line.color || '#e2e8f0';
      ctx.fillText(line.text, 22, y);
      y += 28;
    }

    ctx.fillStyle = st.postOk ? '#4ade80' : '#f87171';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(st.footer || '', 22, h - 26);
  });

  const screenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.52, 0.305),
    new THREE.MeshBasicMaterial({ map: biosScreen.texture })
  );
  screenMesh.position.set(0, 0.27, 0.0155);
  monitorGroup.add(screenMesh);

  const esdBase = new THREE.Group();
  esdBase.position.set(-0.68, 0.014, 0.12);
  bench.scene.add(esdBase);
  const esdBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.028, 0.11),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.45 })
  );
  esdBlock.position.y = 0.014;
  esdBlock.castShadow = true;
  const strapBandMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.42 });
  const strapBand = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.008, 12, 24), strapBandMat);
  strapBand.rotation.x = Math.PI / 2;
  strapBand.position.set(0, 0.034, 0);
  esdBase.add(esdBlock, strapBand);

  const esdWire = buildFlexibleCable(
    [[ -0.68, 0.04, 0.12 ], [ -0.64, 0.04, 0.24 ], [ -0.56, 0.03, 0.32 ]],
    0x38bdf8,
    0.004
  );
  bench.scene.add(esdWire.mesh);

  const trayGroup = new THREE.Group();
  trayGroup.position.set(0.52, 0.014, 0.20);
  bench.scene.add(trayGroup);
  const trayFoam = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.018, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 })
  );
  trayFoam.position.y = 0.009;
  trayFoam.receiveShadow = true;
  trayGroup.add(trayFoam);

  const trayCpu = new THREE.Group();
  trayCpu.position.set(-0.18, 0.025, -0.11);
  const tcSub = new THREE.Mesh(
    new THREE.BoxGeometry(0.068, 0.005, 0.068),
    new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.45 })
  );
  const tcIhs = new THREE.Mesh(
    new THREE.BoxGeometry(0.056, 0.006, 0.056),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.25, metalness: 0.88 })
  );
  tcIhs.position.y = 0.004;
  trayCpu.add(tcSub, tcIhs);
  trayGroup.add(trayCpu);

  const traySyringe = new THREE.Group();
  traySyringe.position.set(-0.04, 0.032, -0.11);
  traySyringe.rotation.z = Math.PI / 2;
  const syrTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.011, 0.095, 16),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.3 })
  );
  const syrPlunger = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.05, 12),
    new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.4 })
  );
  syrPlunger.position.y = 0.055;
  const syrNozzle = new THREE.Mesh(
    new THREE.ConeGeometry(0.005, 0.022, 12),
    new THREE.MeshStandardMaterial({ color: 0x475569 })
  );
  syrNozzle.position.y = -0.056;
  syrNozzle.rotation.x = Math.PI;
  traySyringe.add(syrTube, syrPlunger, syrNozzle);
  trayGroup.add(traySyringe);

  const trayCooler = new THREE.Group();
  trayCooler.position.set(0.14, 0.052, -0.10);
  const tCoolBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.095, 0.064, 0.088),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.85 })
  );
  const tCoolTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.098, 0.008, 0.092),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 })
  );
  tCoolTop.position.y = 0.034;
  trayCooler.add(tCoolBlock, tCoolTop);
  trayGroup.add(trayCooler);

  const trayRam1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.008, 0.032),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.7 })
  );
  trayRam1.position.set(-0.14, 0.024, 0.015);
  const trayRam2 = trayRam1.clone();
  trayRam2.position.set(-0.14, 0.024, 0.062);
  trayGroup.add(trayRam1, trayRam2);

  const trayNvme = new THREE.Mesh(
    new THREE.BoxGeometry(0.088, 0.006, 0.026),
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 })
  );
  trayNvme.position.set(-0.14, 0.024, 0.125);
  trayGroup.add(trayNvme);

  const trayGpu = new THREE.Group();
  trayGpu.position.set(0.08, 0.036, 0.045);
  const tGpuBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.21, 0.032, 0.085),
    new THREE.MeshStandardMaterial({ color: 0x1e2430, roughness: 0.38, metalness: 0.65 })
  );
  const tGpuStripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.008, 0.087),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x15803d, emissiveIntensity: 0.35 })
  );
  tGpuStripe.position.y = 0.012;
  trayGpu.add(tGpuBody, tGpuStripe);
  trayGroup.add(trayGpu);

  const trayCables = new THREE.Mesh(
    new THREE.TorusGeometry(0.032, 0.009, 10, 22),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.45 })
  );
  trayCables.rotation.x = Math.PI / 2;
  trayCables.position.set(0.11, 0.028, 0.145);
  trayGroup.add(trayCables);

  const state = {
    esdWorn: false,
    esdMistakes: 0,
    socketOpen: false,
    cpuInstalled: false,
    socketClosed: false,
    pasteApplied: false,
    coolerInstalled: false,
    ramPlacedSlots: [],
    nvmeInstalled: false,
    gpuInstalled: false,
    cablesConnected: false,
    selectedTool: null,
    pcPowered: false,
    fanSpinRate: 0,
    postPassed: false,
    failedPosts: 0,
    finished: false,
    postAnimating: false,
    camId: 'overview'
  };

  const CAM_VIEWS = [
    { id: 'overview', label: 'Vue Globale', pos: [0.05, 1.38, 1.18], lookAt: [0.02, 0.22, -0.02], fov: 40 },
    { id: 'socket', label: 'Zoom Socket & RAM', pos: [-0.18, 0.68, 0.36], lookAt: [-0.20, 0.04, -0.07], fov: 36 },
    { id: 'bios', label: 'Zoom Écran BIOS', pos: [0.28, 0.44, 0.42], lookAt: [0.42, 0.26, -0.25], fov: 36 }
  ];

  function selectCamera(id) {
    const v = CAM_VIEWS.find((c) => c.id === id);
    if (!v) return;
    state.camId = id;
    bench.setCameraView(v.pos, v.lookAt, v.fov);
    bench.setCameras(CAM_VIEWS, id, selectCamera);
  }

  function updateBios(powered, postError, lines, footer, postOk) {
    biosScreen.update({ powered, postError, lines, footer, postOk });
  }
  updateBios(false, false, [], '', false);

  function selectPartTool(partId, label) {
    if (!state.esdWorn && partId !== 'cables') {
      state.esdMistakes += 1;
      sfx.error();
      bench.spawnSparks(new THREE.Vector3(0.45, 0.08, 0.15), { count: 14, color: '#38bdf8' });
      bench.showToast('Attention décharge ESD ! Enfilez d’abord le bracelet antistatique jaune à gauche.', 'error');
      return;
    }
    state.selectedTool = partId;
    sfx.click();
    refreshHud();
    bench.showToast(`${label} sélectionné : cliquez sur l’emplacement correspondant de la carte mère.`, 'info');
  }

  function refreshHud() {
    let stepTitle = '1. Sécurité ESD : enfilez le bracelet antistatique';
    let stepSub = 'Cliquez sur le bracelet bleu/jaune à gauche du tapis ESD avant de toucher les composants.';
    if (state.postPassed) {
      stepTitle = '6. POST UEFI Validé (1 bip court) !';
      stepSub = 'Toutes les LEDs diagnostiques sont passées au vert. Cliquez sur « Valider mon TP » pour enregistrer votre note /20.';
    } else if (state.esdWorn && !state.socketOpen && !state.cpuInstalled) {
      stepTitle = '2. Socket LGA1700 : ouvrez le levier métallique';
      stepSub = 'Cliquez sur le socket LGA1700 (ou son levier) pour ouvrir le cadre de rétention.';
    } else if (state.socketOpen && !state.cpuInstalled) {
      stepTitle = '2b. Installez le processeur (alignement triangle doré)';
      stepSub = 'Sélectionnez le CPU sur le plateau puis cliquez sur le socket ouvert.';
    } else if (state.cpuInstalled && !state.socketClosed) {
      stepTitle = '2c. Verrouillez le levier du socket LGA1700';
      stepSub = 'Cliquez de nouveau sur le socket pour rabattre le cadre et fermer le levier.';
    } else if (state.socketClosed && !state.pasteApplied) {
      stepTitle = '3. Appliquez la pâte thermique sur le CPU';
      stepSub = 'Sélectionnez la seringue de pâte thermique puis cliquez sur le processeur.';
    } else if (state.pasteApplied && !state.coolerInstalled) {
      stepTitle = '3b. Montez le ventirad Dual-Tower sur le CPU';
      stepSub = 'Sélectionnez le ventirad sur le plateau puis cliquez sur le socket CPU.';
    } else if (state.ramPlacedSlots.length < 2) {
      stepTitle = `4. Mémoire DDR5 Dual-Channel (${state.ramPlacedSlots.length}/2 barrettes)`;
      stepSub = 'Sélectionnez une barrette RAM et enclenchez les 2 modules dans les slots bleus A2 et B2.';
    } else if (!state.nvmeInstalled) {
      stepTitle = '4b. Installez le SSD NVMe dans le port M.2 PCIe 4.0';
      stepSub = 'Sélectionnez le SSD NVMe puis cliquez sur le slot M.2 sous le socket.';
    } else if (!state.gpuInstalled) {
      stepTitle = '5. Enfichez la carte graphique RTX dans le port PCIe x16';
      stepSub = 'Sélectionnez la carte graphique puis cliquez sur le slot PCIe x16 renforcé.';
    } else if (!state.cablesConnected) {
      stepTitle = '5b. Branchez les câbles d’alimentation ATX 24+8 pins & PCIe';
      stepSub = 'Sélectionnez le faisceau de câbles puis cliquez sur les connecteurs de la carte mère.';
    } else {
      stepTitle = '6. Mise sous tension : appuyez sur le bouton Power 3D';
      stepSub = 'Cliquez sur le bouton Power bleu du boîtier (en bas à droite) pour exécuter la séquence POST.';
    }

    bench.setInstruction(
      state.postPassed ? 'POST OK' : 'ASSEMBLAGE PC 3D',
      stepTitle,
      stepSub
    );

    const progress = [
      state.esdWorn,
      state.cpuInstalled && state.socketClosed,
      state.pasteApplied,
      state.coolerInstalled,
      state.ramPlacedSlots.includes('A2') && state.ramPlacedSlots.includes('B2'),
      state.nvmeInstalled,
      state.gpuInstalled,
      state.cablesConnected,
      state.postPassed
    ].filter(Boolean).length;

    bench.setAccuracy(`${progress}/9 étapes · ESD ${state.esdWorn ? 'OK' : 'NON'}`);

    bench.setTools(
      [
        { id: 'cpu', icon: '🔲', label: `${state.cpuInstalled ? '✔ ' : ''}CPU Core i5`, disabled: state.cpuInstalled },
        { id: 'paste', icon: '💉', label: `${state.pasteApplied ? '✔ ' : ''}Pâte Therm.`, disabled: state.pasteApplied },
        { id: 'cooler', icon: '❄️', label: `${state.coolerInstalled ? '✔ ' : ''}Ventirad`, disabled: state.coolerInstalled },
        { id: 'ram', icon: '📊', label: `RAM (${2 - state.ramPlacedSlots.length})`, disabled: state.ramPlacedSlots.length >= 2 },
        { id: 'nvme', icon: '💾', label: `${state.nvmeInstalled ? '✔ ' : ''}SSD NVMe`, disabled: state.nvmeInstalled },
        { id: 'gpu', icon: '🎮', label: `${state.gpuInstalled ? '✔ ' : ''}Carte GPU`, disabled: state.gpuInstalled },
        { id: 'cables', icon: '🔌', label: `${state.cablesConnected ? '✔ ' : ''}Câbles ATX`, disabled: state.cablesConnected }
      ],
      state.selectedTool,
      (id) => {
        const names = {
          cpu: 'CPU Core i5',
          paste: 'Seringue pâte thermique',
          cooler: 'Ventirad Dual-Tower',
          ram: 'Barrette DDR5 16 Go',
          nvme: 'SSD NVMe 1 To',
          gpu: 'Carte Graphique RTX',
          cables: 'Faisceau câbles ATX'
        };
        selectPartTool(id, names[id]);
      }
    );

    const actions = [{ id: 'reset', label: 'Réinitialiser', onClick: resetWorkshop }];
    if (state.postPassed && !state.finished) {
      actions.push({
        id: 'finish',
        label: 'Valider & Noter /20',
        primary: true,
        onClick: () => finishWorkshop()
      });
    } else if (state.cablesConnected && !state.postAnimating) {
      actions.push({
        id: 'power',
        label: 'Appuyer POWER (Test POST)',
        primary: true,
        onClick: () => runPowerPost()
      });
    }
    bench.setActions(actions);
  }

  function finishWorkshop() {
    if (state.finished) return;
    state.finished = true;
    const ramDual = state.ramPlacedSlots.includes('A2') && state.ramPlacedSlots.includes('B2') && state.ramPlacedSlots.length === 2;
    const res = computeHardwareScore3D({
      esdWorn: state.esdWorn,
      cpuInstalled: state.cpuInstalled,
      socketClosed: state.socketClosed,
      pasteApplied: state.pasteApplied,
      coolerInstalled: state.coolerInstalled,
      ramDualChannel: ramDual,
      ramCount: state.ramPlacedSlots.length,
      nvmeInstalled: state.nvmeInstalled,
      gpuInstalled: state.gpuInstalled,
      cablesConnected: state.cablesConnected,
      postPassed: state.postPassed,
      esdMistakes: state.esdMistakes,
      failedPosts: state.failedPosts,
      elapsedSec: bench.getElapsedSec()
    });
    sfx.success();
    api.finishTp(
      res.score,
      `
        <p>Assemblage & Diagnostic Hardware 3D évalué en <strong>${Math.round(bench.getElapsedSec())}s</strong> :</p>
        <ul>
          <li>Précision montage & sécurité : <strong>${res.accuracy}%</strong></li>
          <li>Bracelet ESD connecté à la terre : <strong>${state.esdWorn ? 'Oui' : 'Non'}</strong></li>
          <li>RAM Dual-Channel A2/B2 : <strong>${ramDual ? 'Validée (32 Go DDR5)' : 'À corriger'}</strong></li>
          <li>Test POST & Boot UEFI : <strong>${state.postPassed ? 'Réussi (1 bip court)' : 'Incomplet'}</strong></li>
          ${res.details.map((d) => `<li>${d}</li>`).join('')}
        </ul>
      `
    );
  }

  function clearPostLeds() {
    for (const k of Object.keys(postLeds)) {
      postLeds[k].mat.emissiveIntensity = 0;
    }
  }

  function runPowerPost() {
    if (state.postAnimating) return;
    state.pcPowered = true;
    state.postAnimating = true;
    clearPostLeds();
    sfx.click();

    if (!state.cablesConnected) {
      updateBios(true, true, [
        { text: 'ERR : Alimentation carte mère non détectée.', color: '#f87171' },
        { text: 'Vérifiez ATX 24-pins & EPS 8-pins !', color: '#fca5a5' }
      ], 'ÉCHEC MISE SOUS TENSION', false);
      state.pcPowered = false;
      state.postAnimating = false;
      state.failedPosts += 1;
      sfx.error();
      bench.showToast('Aucun courant ! Branchez le faisceau ATX 24+8 pins d’abord.', 'error');
      return;
    }

    state.fanSpinRate = 1.0;
    for (const ds of dimmSlots) {
      if (ds.populated) ds.rgbMat.emissiveIntensity = 1.4;
    }
    if (state.gpuInstalled) gpuLogoMat.emissiveIntensity = 1.5;

    updateBios(true, false, [
      { text: 'CIEL-BIOS POST DIAGNOSTIC EN COURS...', color: '#38bdf8' },
      { text: '> Test CPU & Microcode LGA1700...', color: '#e2e8f0' }
    ], 'ANALYSE DES PÉRIPHÉRIQUES...', false);

    setTimeout(() => {
      postLeds.CPU.mat.emissiveIntensity = 2.4;
      if (!state.cpuInstalled || !state.socketClosed) {
        state.failedPosts += 1;
        state.postAnimating = false;
        sfx.error();
        updateBios(true, true, [
          { text: 'POST STOP : LED CPU ROUGE FIXE', color: '#f87171' },
          { text: '> Processeur absent ou levier socket ouvert.', color: '#fca5a5' }
        ], 'ERREUR CRITIQUE CPU', false);
        bench.showToast('Erreur POST : LED CPU rouge ! Vérifiez le CPU et son verrouillage.', 'error');
        return;
      }
      postLeds.CPU.mat.emissiveIntensity = 0.2;
      postLeds.DRAM.mat.emissiveIntensity = 2.4;

      const has2 = state.ramPlacedSlots.length >= 2;
      const dualOk = state.ramPlacedSlots.includes('A2') && state.ramPlacedSlots.includes('B2');
      if (!has2 || !dualOk) {
        state.failedPosts += 1;
        state.postAnimating = false;
        sfx.error();
        updateBios(true, true, [
          { text: 'POST STOP : 3 BIPS COURTS + LED ORANGE DRAM', color: '#fbbf24' },
          { text: has2 ? '> Barrettes hors Dual-Channel A2/B2 !' : '> Barrettes DDR5 manquantes.', color: '#fde68a' },
          { text: '> Installez les 2 barrettes dans les slots A2 et B2.', color: '#e2e8f0' }
        ], 'ERREUR MÉMOIRE DRAM (3 BIPS)', false);
        bench.showToast('3 bips courts + LED DRAM orange : vérifiez les slots bleus A2 & B2 !', 'error');
        return;
      }

      setTimeout(() => {
        postLeds.DRAM.mat.emissiveIntensity = 0.2;
        postLeds.VGA.mat.emissiveIntensity = 2.4;
        if (!state.gpuInstalled) {
          state.failedPosts += 1;
          state.postAnimating = false;
          sfx.error();
          updateBios(true, true, [
            { text: 'POST STOP : LED BLANCHE VGA', color: '#f8fafc' },
            { text: '> Aucune carte graphique PCIe x16 détectée.', color: '#fca5a5' }
          ], 'ERREUR AFFICHAGE VGA', false);
          bench.showToast('Erreur POST : LED VGA ! Installez la carte graphique RTX.', 'error');
          return;
        }

        setTimeout(() => {
          postLeds.VGA.mat.emissiveIntensity = 0.2;
          postLeds.BOOT.mat.emissiveIntensity = 2.6;
          if (!state.nvmeInstalled) {
            state.failedPosts += 1;
            state.postAnimating = false;
            sfx.error();
            updateBios(true, true, [
              { text: 'POST ERROR : NO BOOTABLE DEVICE FOUND', color: '#f87171' },
              { text: '> Slot M.2 NVMe vide.', color: '#fca5a5' }
            ], 'AUCUN STOCKAGE DÉTECTÉ', false);
            bench.showToast('Erreur : SSD NVMe absent dans le port M.2 !', 'error');
            return;
          }

          if (!state.pasteApplied || !state.coolerInstalled) {
            state.failedPosts += 1;
            state.postAnimating = false;
            state.fanSpinRate = 0;
            sfx.error();
            bench.spawnSmoke([-0.22, 0.14, -0.08], { count: 14, color: '#334155' });
            updateBios(true, true, [
              { text: 'ALERTE THERMIQUE : CPU TEMP = 98°C !', color: '#ef4444' },
              { text: !state.pasteApplied ? '> Pâte thermique manquante !' : '> Ventirad non monté !', color: '#fca5a5' },
              { text: '> Extinction de sécurité immédiate.', color: '#f8fafc' }
            ], 'SURCHAUFFE CPU — ARRÊT THERMIQUE', false);
            bench.showToast('Surchauffe 98°C ! Pâte thermique et ventirad indispensables !', 'error');
            return;
          }

          state.postPassed = true;
          state.postAnimating = false;
          pwrLedMat.color.setHex(0x4ade80);
          pwrLedMat.emissive.setHex(0x22c55e);
          pwrLedMat.emissiveIntensity = 2.0;
          sfx.success();
          bench.spawnPulseRing([-0.22, 0.1, -0.05], '#4ade80', 0.28);
          updateBios(true, false, [
            { text: 'CPU  : Intel Core i5 LGA1700 [36°C — OK]', color: '#4ade80' },
            { text: 'RAM  : 32 Go DDR5-6000 Dual-Channel (A2/B2)', color: '#4ade80' },
            { text: 'NVMe : SSD M.2 PCIe 4.0 1 To — Boot Ready', color: '#4ade80' },
            { text: 'GPU  : GeForce RTX Dual-Fan PCIe 4.0 x16', color: '#4ade80' },
            { text: 'POST : 1 Bip court — Démarrage Système OK !', color: '#38bdf8' }
          ], 'UEFI PRÊT — CLIQUEZ SUR VALIDER MON TP', true);
          refreshHud();
          bench.showToast('POST validé (1 bip court, BIOS UEFI prêt) !', 'success');
        }, 420);
      }, 420);
    }, 450);
  }

  function resetWorkshop() {
    state.esdWorn = false;
    state.esdMistakes = 0;
    state.socketOpen = false;
    state.cpuInstalled = false;
    state.socketClosed = false;
    state.pasteApplied = false;
    state.coolerInstalled = false;
    state.ramPlacedSlots = [];
    state.nvmeInstalled = false;
    state.gpuInstalled = false;
    state.cablesConnected = false;
    state.selectedTool = null;
    state.pcPowered = false;
    state.fanSpinRate = 0;
    state.postPassed = false;
    state.failedPosts = 0;
    state.finished = false;
    state.postAnimating = false;

    strapBand.visible = true;
    esdWire.updatePoints([
      [-0.68, 0.04, 0.12],
      [-0.64, 0.04, 0.24],
      [-0.56, 0.03, 0.32]
    ]);
    trayCpu.visible = true;
    traySyringe.visible = true;
    trayCooler.visible = true;
    trayRam1.visible = true;
    trayRam2.visible = true;
    trayNvme.visible = true;
    trayGpu.visible = true;
    trayCables.visible = true;

    installedCpuMesh.visible = false;
    thermalPastePea.visible = false;
    installedCooler.visible = false;
    installedNvme.visible = false;
    installedGpu.visible = false;
    atxCable.mesh.visible = false;
    epsCable.mesh.visible = false;
    gpuCable.mesh.visible = false;

    for (const ds of dimmSlots) {
      ds.populated = false;
      ds.stick.visible = false;
      ds.rgbMat.emissiveIntensity = 0.2;
      ds.latchTop.rotation.x = -0.35;
      ds.latchBot.rotation.x = 0.35;
    }

    ilmPivot.rotation.z = 0;
    leverPivot.rotation.x = 0;
    pwrLedMat.color.setHex(0x38bdf8);
    pwrLedMat.emissive.setHex(0x0284c7);
    pwrLedMat.emissiveIntensity = 0.35;
    gpuLogoMat.emissiveIntensity = 0.15;
    clearPostLeds();
    updateBios(false, false, [], '', false);
    refreshHud();
  }

  function wearEsdStrap() {
    if (state.esdWorn) return;
    state.esdWorn = true;
    strapBand.visible = false;
    esdWire.updatePoints([
      [-0.68, 0.04, 0.12],
      [-0.48, 0.04, 0.28],
      [-0.22, 0.05, 0.45]
    ]);
    sfx.click();
    bench.spawnPulseRing([-0.68, 0.04, 0.12], '#22c55e', 0.12);
    bench.showToast('Bracelet ESD relié à la terre ! Vous pouvez manipuler les composants.', 'success');
    refreshHud();
  }

  bench.addInteractive(esdBlock, { label: 'Bracelet Antistatique ESD (Clic pour enfiler)', onClick: wearEsdStrap });
  bench.addInteractive(strapBand, { label: 'Bracelet Antistatique ESD (Clic pour enfiler)', onClick: wearEsdStrap });

  bench.addInteractive(trayCpu, { label: 'Processeur Core i5', onClick: () => selectPartTool('cpu', 'CPU Core i5') });
  bench.addInteractive(traySyringe, { label: 'Seringue Pâte Thermique', onClick: () => selectPartTool('paste', 'Pâte thermique') });
  bench.addInteractive(trayCooler, { label: 'Ventirad Dual-Tower', onClick: () => selectPartTool('cooler', 'Ventirad Dual-Tower') });
  bench.addInteractive(trayRam1, { label: 'Barrette DDR5 16 Go', onClick: () => selectPartTool('ram', 'Barrette DDR5 16 Go') });
  bench.addInteractive(trayRam2, { label: 'Barrette DDR5 16 Go', onClick: () => selectPartTool('ram', 'Barrette DDR5 16 Go') });
  bench.addInteractive(trayNvme, { label: 'SSD NVMe 1 To', onClick: () => selectPartTool('nvme', 'SSD NVMe 1 To') });
  bench.addInteractive(trayGpu, { label: 'Carte Graphique RTX', onClick: () => selectPartTool('gpu', 'Carte Graphique RTX') });
  bench.addInteractive(trayCables, { label: 'Faisceau câbles ATX 24+8 pins', onClick: () => selectPartTool('cables', 'Faisceau câbles ATX') });

  function handleSocketClick() {
    if (!state.esdWorn) {
      state.esdMistakes += 1;
      sfx.error();
      bench.spawnSparks([-0.27, 0.06, -0.12], { count: 14, color: '#38bdf8' });
      bench.showToast('Risque ESD ! Enfilez d’abord le bracelet antistatique.', 'error');
      return;
    }

    if (!state.socketOpen && !state.cpuInstalled) {
      state.socketOpen = true;
      sfx.click();
      bench.showToast('Levier socket LGA1700 ouvert ! Sélectionnez le CPU puis cliquez ici (alignez 🔺).', 'info');
      refreshHud();
      return;
    }

    if (state.socketOpen && !state.cpuInstalled) {
      if (state.selectedTool === 'cpu') {
        state.cpuInstalled = true;
        state.selectedTool = null;
        installedCpuMesh.visible = true;
        trayCpu.visible = false;
        sfx.click();
        bench.spawnPulseRing([-0.27, 0.06, -0.12], '#38bdf8', 0.09);
        bench.showToast('CPU Core i5 posé (🔺 aligné) ! Cliquez sur le socket pour fermer le levier.', 'success');
        refreshHud();
      } else {
        bench.showToast('Sélectionnez le CPU Core i5 sur le plateau (ou dans la barre d’outils).', 'info');
      }
      return;
    }

    if (state.cpuInstalled && !state.socketClosed) {
      state.socketClosed = true;
      state.socketOpen = false;
      sfx.click();
      bench.showToast('Levier LGA1700 verrouillé ! Appliquez maintenant une noisette de pâte thermique.', 'success');
      refreshHud();
      return;
    }

    if (state.socketClosed && !state.pasteApplied) {
      if (state.selectedTool === 'paste') {
        state.pasteApplied = true;
        state.selectedTool = null;
        thermalPastePea.visible = true;
        traySyringe.visible = false;
        sfx.click();
        bench.showToast('Noisette de pâte thermique appliquée ! Posez maintenant le ventirad.', 'success');
        refreshHud();
      } else {
        bench.showToast('Sélectionnez la seringue de pâte thermique avant de poser le ventirad.', 'info');
      }
      return;
    }

    if (state.socketClosed && !state.coolerInstalled && state.selectedTool === 'cooler') {
      state.coolerInstalled = true;
      state.selectedTool = null;
      installedCooler.visible = true;
      trayCooler.visible = false;
      sfx.click();
      bench.spawnPulseRing([-0.27, 0.09, -0.12], '#22c55e', 0.11);
      if (!state.pasteApplied) {
        bench.showToast('Attention : ventirad posé sans pâte thermique ! Risque de surchauffe au POST.', 'error');
      } else {
        bench.showToast('Ventirad Dual-Tower fixé sur le CPU !', 'success');
      }
      refreshHud();
    }
  }

  bench.addInteractive(socketGroup, {
    label: 'Socket CPU LGA1700 (Ouvrir / CPU / Pâte / Ventirad)',
    onClick: handleSocketClick
  });

  for (const ds of dimmSlots) {
    bench.addInteractive(ds.body, {
      label: `Slot RAM DDR5 ${ds.id}${ds.recommended ? ' (Dual-Channel Recommandé)' : ''}`,
      onClick: () => {
        if (!state.esdWorn) {
          state.esdMistakes += 1;
          sfx.error();
          bench.showToast('Mettez le bracelet ESD avant de manipuler la RAM DDR5.', 'error');
          return;
        }
        if (state.selectedTool !== 'ram') {
          if (ds.populated) {
            ds.populated = false;
            ds.stick.visible = false;
            ds.latchTop.rotation.x = -0.35;
            ds.latchBot.rotation.x = 0.35;
            state.ramPlacedSlots = state.ramPlacedSlots.filter((s) => s !== ds.id);
            if (state.ramPlacedSlots.length === 0) trayRam1.visible = true;
            else trayRam2.visible = true;
            sfx.click();
            bench.showToast(`Barrette retirée du slot ${ds.id}.`, 'info');
            refreshHud();
          } else {
            bench.showToast(`Sélectionnez une barrette RAM DDR5 pour l’installer en ${ds.id}.`, 'info');
          }
          return;
        }
        if (ds.populated || state.ramPlacedSlots.length >= 2) return;
        ds.populated = true;
        ds.stick.visible = true;
        ds.latchTop.rotation.x = 0;
        ds.latchBot.rotation.x = 0;
        state.ramPlacedSlots.push(ds.id);
        if (state.ramPlacedSlots.length === 1) trayRam1.visible = false;
        if (state.ramPlacedSlots.length === 2) {
          trayRam2.visible = false;
          state.selectedTool = null;
        }
        sfx.click();
        bench.showToast(
          ds.recommended
            ? `Barrette DDR5 clipsée en ${ds.id} (Dual-Channel).`
            : `Barrette posée en ${ds.id} — Conseil : privilégiez les slots bleus A2 et B2 (cliquez pour retirer).`,
          ds.recommended ? 'success' : 'info'
        );
        refreshHud();
      }
    });
  }

  bench.addInteractive(m2SlotMesh, {
    label: 'Port M.2 PCIe 4.0 (SSD NVMe)',
    onClick: () => {
      if (!state.esdWorn) {
        state.esdMistakes += 1;
        sfx.error();
        bench.showToast('Bracelet ESD requis avant de toucher au SSD NVMe.', 'error');
        return;
      }
      if (state.nvmeInstalled) return;
      if (state.selectedTool !== 'nvme') {
        bench.showToast('Sélectionnez le SSD NVMe sur le plateau ESD.', 'info');
        return;
      }
      state.nvmeInstalled = true;
      state.selectedTool = null;
      installedNvme.visible = true;
      trayNvme.visible = false;
      sfx.click();
      bench.showToast('SSD NVMe 1 To vissé dans le slot M.2 !', 'success');
      refreshHud();
    }
  });

  bench.addInteractive(pcieSlotMesh, {
    label: 'Port PCIe 4.0 x16 (Carte Graphique)',
    onClick: () => {
      if (!state.esdWorn) {
        state.esdMistakes += 1;
        sfx.error();
        bench.showToast('Bracelet ESD requis avant de manipuler la carte graphique.', 'error');
        return;
      }
      if (state.gpuInstalled) return;
      if (state.selectedTool !== 'gpu') {
        bench.showToast('Sélectionnez la carte graphique RTX sur le plateau.', 'info');
        return;
      }
      state.gpuInstalled = true;
      state.selectedTool = null;
      installedGpu.visible = true;
      trayGpu.visible = false;
      sfx.click();
      bench.showToast('Carte graphique RTX verrouillée dans le port PCIe x16 !', 'success');
      refreshHud();
    }
  });

  function installPowerCables() {
    if (state.cablesConnected) return;
    if (state.selectedTool !== 'cables') {
      bench.showToast('Sélectionnez le faisceau de câbles ATX 24+8 pins dans vos outils.', 'info');
      return;
    }
    state.cablesConnected = true;
    state.selectedTool = null;
    atxCable.mesh.visible = true;
    epsCable.mesh.visible = true;
    gpuCable.mesh.visible = true;
    trayCables.visible = false;
    sfx.click();
    bench.showToast('Câbles ATX 24-pins, CPU 8-pins et PCIe GPU branchés ! Appuyez sur POWER.', 'success');
    refreshHud();
  }

  bench.addInteractive(atx24Header, { label: 'Connecteur ATX 24-pins', onClick: installPowerCables });
  bench.addInteractive(eps8Header, { label: 'Connecteur CPU EPS 8-pins', onClick: installPowerCables });
  bench.addInteractive(psuShroud, { label: 'Alimentation ATX 650W', onClick: installPowerCables });

  bench.addInteractive(pwrBtnMesh, {
    label: 'Bouton POWER 3D (Démarrer le POST)',
    onClick: () => runPowerPost()
  });

  bench.addFloatingTag(() => new THREE.Vector3(-0.68, 0.08, 0.12), 'Bracelet ESD', 'esd');
  bench.addFloatingTag(() => new THREE.Vector3(-0.27, 0.09, -0.12), 'Socket LGA1700', 'socket');
  bench.addFloatingTag(() => new THREE.Vector3(-0.12, 0.09, -0.12), 'RAM A2/B2', 'ram');
  bench.addFloatingTag(() => new THREE.Vector3(-0.26, 0.08, 0.04), 'Port M.2 / PCIe', 'm2');
  bench.addFloatingTag(() => new THREE.Vector3(0.06, 0.21, 0.245), 'POWER', 'pwr');

  bench.setCameras(CAM_VIEWS, 'overview', selectCamera);

  let targetIlmZ = 0;
  let targetLeverX = 0;
  bench.addUpdate((dt) => {
    targetIlmZ = state.socketOpen ? 1.55 : 0;
    targetLeverX = state.socketOpen ? -1.45 : 0;
    ilmPivot.rotation.z += (targetIlmZ - ilmPivot.rotation.z) * Math.min(1, dt * 10);
    leverPivot.rotation.x += (targetLeverX - leverPivot.rotation.x) * Math.min(1, dt * 10);

    if (state.fanSpinRate > 0.01) {
      const spin = dt * 18 * state.fanSpinRate;
      caseFanRear.blades.rotation.z -= spin;
      caseFanFront.blades.rotation.z -= spin;
      if (state.coolerInstalled) coolerFan.blades.rotation.z -= spin * 1.25;
      if (state.gpuInstalled) {
        gpuFan1.blades.rotation.z -= spin * 1.1;
        gpuFan2.blades.rotation.z -= spin * 1.1;
      }
    }
  });

  refreshHud();

  return {
    destroy: () => bench.destroy()
  };
}
