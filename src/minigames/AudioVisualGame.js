import * as THREE from 'three';
import { sfx } from '../core/audio.js';
import {
  createWorkbench3D,
  makeCanvasScreen,
  createEsdMatTexture
} from './Workbench3DHost.js';

export const AV_STAGES = [
  {
    id: 1,
    name: '1. Plateau Caméra & Éclairage DMX',
    brief:
      'Préparez le plateau fond vert : calibrez la balance des blancs à 5600K (lumière du jour), réglez le projecteur Key DMX entre 70% et 85% et activez l’éclairage uniforme du fond vert.',
    kind: 'lighting',
    targetKelvin: 5600,
    kelvinTol: 200,
    minKeyDimmer: 70,
    maxKeyDimmer: 85
  },
  {
    id: 2,
    name: '2. Console Audio & Cabines Studio',
    brief:
      'En régie audio, activez l’alimentation fantôme +48V pour le micro statique XLR, le filtre coupe-bas 80 Hz et ajustez le gain pour obtenir un niveau nominal entre -14 et -10 dBFS.',
    kind: 'audio',
    minDb: -14,
    maxDb: -10
  },
  {
    id: 3,
    name: '3. Matrice SDI / NDI Régie',
    brief:
      'Routez les sources vidéo/audio vers les sorties de la régie centrale : Caméra A -> Live PGM, Caméra B -> Enregistreur SSD, Slides HDMI PC -> Écran Retour Plateau.',
    kind: 'matrix',
    routes: [
      { id: 'out-pgm', label: 'Sortie 1 : Diffusion Live PGM', expected: 'cam-a' },
      { id: 'out-rec', label: 'Sortie 2 : Enregistreur HyperDeck SSD', expected: 'cam-b' },
      { id: 'out-mon', label: 'Sortie 3 : Moniteur Retour Plateau', expected: 'pc-slides' }
    ],
    sources: [
      { id: 'cam-a', label: 'Caméra A (SDI-1)' },
      { id: 'cam-b', label: 'Caméra B (SDI-2)' },
      { id: 'pc-slides', label: 'PC Slides (HDMI/NDI)' }
    ]
  }
];

export function evaluateAvStage(stage, state) {
  const details = [];
  if (stage.kind === 'lighting') {
    let pts = 0;
    const kelvinOk = Math.abs((state.kelvin ?? 3200) - stage.targetKelvin) <= stage.kelvinTol;
    const dimmerOk = state.keyDimmer >= stage.minKeyDimmer && state.keyDimmer <= stage.maxKeyDimmer;
    const chromaOk = Boolean(state.chromaBacklight);
    if (kelvinOk) pts += 1;
    else details.push(`Balance des blancs à ${state.kelvin}K (cible ${stage.targetKelvin}K ±${stage.kelvinTol}K)`);
    if (dimmerOk) pts += 1;
    else details.push(`Intensité Key Light à ${state.keyDimmer}% (cible ${stage.minKeyDimmer}-${stage.maxKeyDimmer}%)`);
    if (chromaOk) pts += 1;
    else details.push('Éclairage fond vert désactivé (ombres portées détectées)');
    const score = Math.round((pts / 3) * 20);
    return { score, details, passed: score >= 13 };
  }

  if (stage.kind === 'audio') {
    let pts = 0;
    const db = -32 + (state.gain ?? 0) * 0.4;
    if (state.phantom48v) pts += 1;
    else details.push('Alimentation fantôme +48V désactivée : micro statique muet');
    if (state.highPass80) pts += 1;
    else details.push('Filtre coupe-bas 80 Hz inactif (bruits de manipulation présents)');
    if (db >= stage.minDb && db <= stage.maxDb) pts += 1;
    else details.push(`Niveau crête à ${db.toFixed(1)} dBFS (cible ${stage.minDb} à ${stage.maxDb} dBFS)`);
    const score = Math.round((pts / 3) * 20);
    return { score, details, passed: score >= 13 };
  }

  let ok = 0;
  const routing = state.routing || {};
  for (const r of stage.routes) {
    if (routing[r.id] === r.expected) ok += 1;
    else details.push(`${r.label} : source routée incorrecte`);
  }
  const score = Math.round((ok / stage.routes.length) * 20);
  return { score, details, passed: score >= 13 };
}

export function computeAvStudioScore3D(metrics = {}) {
  const chroma = Math.max(0, Math.min(100, metrics.chromaUniformity ?? 0));
  const lightPts = chroma >= 85 ? 5 : (chroma / 100) * 4.5;
  const kelvinDiff = Math.abs((metrics.kelvin ?? 3200) - 5600);
  const wbPts = kelvinDiff <= 250 ? 2 : Math.max(0, 2 - kelvinDiff / 1200);

  const focus = Math.max(0, Math.min(100, metrics.focusSharpness ?? 0));
  const camPts = (focus / 100) * 3.5 + (metrics.irisOk ? 2.5 : 0.8);

  let audioPts = 0;
  if (metrics.phantom48v) audioPts += 1.5;
  if (metrics.highPass80) audioPts += 1.5;
  const db = metrics.audioMasterDb ?? -40;
  if (db >= -14.5 && db <= -9.5) audioPts += 4;
  else {
    const dist = Math.min(Math.abs(db - -14), Math.abs(db - -10));
    audioPts += Math.max(0, 3.2 - dist * 0.25);
  }

  const raw = lightPts + wbPts + camPts + audioPts;
  const elapsed = metrics.elapsedSec || 0;
  const timePenalty = elapsed > 240 ? Math.min(1.5, (elapsed - 240) / 100) : 0;
  const score = Math.max(0, Math.min(20, Math.round(raw - timePenalty)));
  const xp = Math.max(45, Math.round(score * 16 + (chroma >= 85 && focus >= 85 ? 60 : 15)));
  const accuracy = Math.round((score / 20) * 100);
  return { score, xp, accuracy };
}

function kelvinToHex(k) {
  if (k <= 3600) return 0xffb366;
  if (k <= 4800) return 0xffe4c4;
  if (k <= 6000) return 0xf8fafc;
  return 0xdbeafe;
}

export function createAudioVisualGame(api, opts = {}) {
  const startStudioFocus = (opts.initialStage ?? 0) === 1 ? 'console' : 'studio';

  const bench = createWorkbench3D(api.container, {
    cameraPos: startStudioFocus === 'console' ? [0.0, 0.72, 1.08] : [0.06, 0.96, 1.38],
    lookAt: startStudioFocus === 'console' ? [0.0, 0.14, 0.14] : [0.0, 0.28, -0.14],
    fov: 40,
    hasEsdMat: false
  });

  const stagePadTex = createEsdMatTexture('#1e293b', '#334155');
  const stageFloor = new THREE.Mesh(
    new THREE.BoxGeometry(1.78, 0.012, 1.04),
    new THREE.MeshStandardMaterial({ map: stagePadTex, roughness: 0.78 })
  );
  stageFloor.position.set(0, 0.006, 0.02);
  stageFloor.receiveShadow = true;
  bench.scene.add(stageFloor);

  const darkRig = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.45, metalness: 0.6 });
  const greenScreenMat = new THREE.MeshStandardMaterial({
    color: 0x00b140,
    roughness: 0.85,
    metalness: 0.02
  });

  const greenWallGroup = new THREE.Group();
  greenWallGroup.position.set(0, 0.012, -0.40);
  bench.scene.add(greenWallGroup);

  const backdropPanel = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.58, 0.02), greenScreenMat);
  backdropPanel.position.set(0, 0.30, 0);
  backdropPanel.receiveShadow = true;
  const floorChroma = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.008, 0.28), greenScreenMat);
  floorChroma.position.set(0, 0.004, 0.14);
  floorChroma.receiveShadow = true;
  greenWallGroup.add(backdropPanel, floorChroma);

  const poleL = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 12), darkRig);
  poleL.position.set(-0.54, 0.31, 0);
  const poleR = poleL.clone();
  poleR.position.set(0.54, 0.31, 0);
  const topBar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.12, 12), darkRig);
  topBar.rotation.z = Math.PI / 2;
  topBar.position.set(0, 0.61, 0);
  greenWallGroup.add(poleL, poleR, topBar);

  const presenter = new THREE.Group();
  presenter.position.set(0, 0.016, -0.26);
  bench.scene.add(presenter);
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.068, 0.19, 16),
    new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.55 })
  );
  torso.position.y = 0.12;
  torso.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.046, 18, 14),
    new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.6 })
  );
  head.position.y = 0.265;
  head.castShadow = true;
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.048, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 })
  );
  hair.position.y = 0.27;
  presenter.add(torso, head, hair);

  function buildStudioLamp(x, z, rotY) {
    const stand = new THREE.Group();
    stand.position.set(x, 0.012, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.44, 12), darkRig);
    pole.position.y = 0.22;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.02, 3), darkRig);
    base.position.y = 0.01;
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 0.44, 0);
    headPivot.rotation.y = rotY;
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.10, 0.06), darkRig);
    housing.castShadow = true;
    const ledMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffd28a,
      emissiveIntensity: 1.6
    });
    const ledPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.08), ledMat);
    ledPanel.position.z = 0.032;
    headPivot.add(housing, ledPanel);

    const spot = new THREE.SpotLight(0xfff1d6, 3.2, 2.2, Math.PI / 5, 0.45, 1.0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(512, 512);
    spot.position.set(0, 0, 0.04);
    const targetObj = new THREE.Object3D();
    targetObj.position.set(0, -0.14, 0.45);
    headPivot.add(targetObj);
    headPivot.add(spot);
    spot.target = targetObj;

    stand.add(pole, base, headPivot);
    bench.scene.add(stand);
    return { stand, headPivot, ledMat, spot };
  }

  const keyLamp = buildStudioLamp(-0.48, -0.02, 0.35);
  const fillLamp = buildStudioLamp(0.48, -0.02, -0.25);

  const tripodCam = new THREE.Group();
  tripodCam.position.set(-0.34, 0.012, 0.14);
  tripodCam.rotation.y = 0.45;
  bench.scene.add(tripodCam);

  const triPole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.34, 12), darkRig);
  triPole.position.y = 0.17;
  const triFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.02, 3), darkRig);
  triFoot.position.y = 0.01;
  const camBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.10, 0.085, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.42, metalness: 0.55 })
  );
  camBody.position.set(0, 0.36, 0);
  camBody.castShadow = true;

  const recLedMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 1.6 });
  const recLed = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), recLedMat);
  recLed.position.set(0.04, 0.39, 0.065);

  const lensBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.032, 0.09, 20),
    new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.35, metalness: 0.7 })
  );
  lensBarrel.rotation.x = Math.PI / 2;
  lensBarrel.position.set(0, 0.36, -0.10);

  const focusRingMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.035, 0.008, 10, 24),
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35 })
  );
  focusRingMesh.position.set(0, 0.36, -0.115);

  const irisRingMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.035, 0.008, 10, 24),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35 })
  );
  irisRingMesh.position.set(0, 0.36, -0.082);

  tripodCam.add(triPole, triFoot, camBody, recLed, lensBarrel, focusRingMesh, irisRingMesh);

  const monitorStand = new THREE.Group();
  monitorStand.position.set(0.48, 0.012, 0.12);
  monitorStand.rotation.y = -0.38;
  bench.scene.add(monitorStand);

  const monBase = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.014, 0.12), darkRig);
  monBase.position.y = 0.007;
  const monNeck = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.24, 0.025), darkRig);
  monNeck.position.set(0, 0.12, -0.015);
  const monFrame = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.30, 0.025), darkRig);
  monFrame.position.set(0, 0.26, 0);
  monFrame.castShadow = true;
  monitorStand.add(monBase, monNeck, monFrame);

  const camMonitor = makeCanvasScreen(512, 320, (ctx, w, h, st) => {
    const s = st || { chromaUniformity: 40, keyPan: 0.18, irisValue: 0.75, focusSharpness: 40, kelvin: 3200, fStop: '2.0' };
    const chroma = s.chromaUniformity;
    ctx.fillStyle = chroma >= 85 ? '#00b140' : '#026826';
    ctx.fillRect(0, 0, w, h);

    if (chroma < 85) {
      const alpha = Math.max(0.08, (85 - chroma) / 110);
      ctx.fillStyle = `rgba(6, 20, 12, ${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.ellipse(w * 0.52 + (s.keyPan - 0.5) * 90, h * 0.65, 110, 130, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const expBright = s.irisValue;
    ctx.save();
    ctx.filter = `blur(${Math.max(0, (100 - s.focusSharpness) / 11).toFixed(1)}px)`;
    ctx.fillStyle = `rgba(${Math.round(180 + expBright * 60)}, ${Math.round(135 + expBright * 45)}, ${Math.round(95 + expBright * 30)}, 1)`;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.38, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.roundRect(w / 2 - 46, h * 0.49, 92, 120, 18);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.fillRect(0, 0, w, 34);
    ctx.fillRect(0, h - 42, w, 42);

    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`● REC  CAM-A  1080p50   WB: ${s.kelvin}K   IRIS: f/${s.fStop}`, 12, 22);

    ctx.fillStyle = s.focusSharpness >= 85 ? '#4ade80' : '#fbbf24';
    ctx.fillText(`NETTETÉ: ${Math.round(s.focusSharpness)}%`, 12, h - 15);
    ctx.fillStyle = chroma >= 85 ? '#4ade80' : '#f87171';
    ctx.fillText(`FOND VERT UNIFORME: ${Math.round(chroma)}%`, 205, h - 15);
  });

  const camMonitorPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.44, 0.265),
    new THREE.MeshBasicMaterial({ map: camMonitor.texture })
  );
  camMonitorPlane.position.set(0, 0.26, 0.014);
  monitorStand.add(camMonitorPlane);

  const consoleGroup = new THREE.Group();
  consoleGroup.position.set(0.0, 0.012, 0.24);
  bench.scene.add(consoleGroup);

  const consoleBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.048, 0.30),
    new THREE.MeshStandardMaterial({ color: 0x1e2430, roughness: 0.42, metalness: 0.65 })
  );
  consoleBody.position.y = 0.024;
  consoleBody.rotation.x = 0.14;
  consoleBody.castShadow = true;
  consoleGroup.add(consoleBody);

  const faderDefs = [
    { id: 'mic', label: 'CH1 MIC', x: -0.18, color: 0x38bdf8 },
    { id: 'amb', label: 'CH2 AMB', x: -0.09, color: 0x60a5fa },
    { id: 'dmx', label: 'DMX KEY', x: 0.0, color: 0xfbbf24 },
    { id: 'master', label: 'MASTER', x: 0.09, color: 0xef4444 }
  ];

  const state = {
    keyPan: 0.18,
    fillPan: 0.22,
    kelvin: 3200,
    focusNorm: 0.28,
    irisNorm: 0.25,
    faders: {
      mic: 0.35,
      amb: 0.25,
      dmx: 0.55,
      master: 0.40
    },
    phantom48v: false,
    highPass80: false,
    finished: false,
    camId: startStudioFocus === 'console' ? 'console' : 'studio'
  };

  const CAM_VIEWS = [
    { id: 'studio', label: 'Plateau Complet', pos: [0.06, 0.96, 1.38], lookAt: [0.0, 0.28, -0.14], fov: 40 },
    { id: 'camera', label: 'Zoom Caméra & Retour', pos: [0.02, 0.52, 0.62], lookAt: [0.08, 0.30, 0.08], fov: 38 },
    { id: 'console', label: 'Console DMX & Audio', pos: [0.0, 0.56, 0.72], lookAt: [0.0, 0.08, 0.22], fov: 36 }
  ];

  function selectCamera(id) {
    const v = CAM_VIEWS.find((c) => c.id === id);
    if (!v) return;
    state.camId = id;
    bench.setCameraView(v.pos, v.lookAt, v.fov);
    bench.setCameras(CAM_VIEWS, id, selectCamera);
  }

  const faderCaps = {};
  for (const fd of faderDefs) {
    const slot = new THREE.Mesh(
      new THREE.BoxGeometry(0.008, 0.008, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x090d14 })
    );
    slot.position.set(fd.x, 0.052, 0.02);
    slot.rotation.x = 0.14;
    consoleGroup.add(slot);

    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.022, 0.024),
      new THREE.MeshStandardMaterial({ color: fd.color, roughness: 0.32, metalness: 0.3 })
    );
    cap.castShadow = true;
    consoleGroup.add(cap);
    faderCaps[fd.id] = { cap, x: fd.x };
  }

  function makeConsoleButton(x, z, baseColor) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      emissive: baseColor,
      emissiveIntensity: 0.15,
      roughness: 0.35
    });
    const btn = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.018, 0.032), mat);
    btn.position.set(x, 0.056, z);
    btn.rotation.x = 0.14;
    consoleGroup.add(btn);
    return { btn, mat, color: baseColor };
  }

  const btnPhantom = makeConsoleButton(0.20, -0.06, 0xef4444);
  const btnHpf = makeConsoleButton(0.20, -0.01, 0x38bdf8);
  const btnWb = makeConsoleButton(0.20, 0.04, 0xfbbf24);

  const vuBarsL = [];
  const vuBarsR = [];
  for (let i = 0; i < 10; i++) {
    const segColor = i < 6 ? 0x22c55e : i < 8 ? 0xfacc15 : 0xef4444;
    const matL = new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: segColor, emissiveIntensity: 0 });
    const segL = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.008, 0.009), matL);
    segL.position.set(0.25, 0.068, 0.08 - i * 0.014);
    const matR = matL.clone();
    const segR = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.008, 0.009), matR);
    segR.position.set(0.268, 0.068, 0.08 - i * 0.014);
    consoleGroup.add(segL, segR);
    vuBarsL.push({ mat: matL, threshold: (i + 1) / 10 });
    vuBarsR.push({ mat: matR, threshold: (i + 1) / 10 });
  }

  function computeLiveSignals() {
    const keyTarget = 0.62;
    const fillTarget = 0.65;
    const keyDist = Math.abs(state.keyPan - keyTarget);
    const fillDist = Math.abs(state.fillPan - fillTarget);
    const dmxLevel = 0.55 + state.faders.dmx * 0.45;
    const wbBonus = Math.abs(state.kelvin - 5600) <= 300 ? 8 : 0;
    const chromaUniformity = Math.max(
      25,
      Math.min(100, Math.round((100 - (keyDist * 65 + fillDist * 60)) * Math.min(1, dmxLevel) + wbBonus - (wbBonus ? 0 : 4)))
    );

    const focusIdeal = 0.72;
    const focusSharpness = Math.max(20, Math.min(100, Math.round(100 - Math.abs(state.focusNorm - focusIdeal) * 145)));

    const fStops = ['1.4', '2.0', '2.8', '3.5', '4.0', '5.6', '8.0', '11'];
    const fIdx = Math.min(fStops.length - 1, Math.floor(state.irisNorm * fStops.length));
    const fStop = fStops[fIdx];
    const irisOk = state.irisNorm >= 0.34 && state.irisNorm <= 0.68;

    const baseGain = state.faders.mic * 0.68 + state.faders.master * 0.52 + state.faders.amb * 0.14;
    const audioMasterDb = state.phantom48v
      ? Number((-32 + baseGain * 26).toFixed(1))
      : Number((-48 + baseGain * 14).toFixed(1));
    const audioOk = state.phantom48v && state.highPass80 && audioMasterDb >= -14.5 && audioMasterDb <= -9.5;

    return { chromaUniformity, focusSharpness, fStop, irisOk, audioMasterDb, audioOk };
  }

  function sync3DTransforms() {
    const sig = computeLiveSignals();

    keyLamp.headPivot.rotation.y = 0.85 - state.keyPan * 1.15;
    fillLamp.headPivot.rotation.y = -0.85 + state.fillPan * 1.15;
    const kHex = kelvinToHex(state.kelvin);
    keyLamp.spot.color.setHex(kHex);
    fillLamp.spot.color.setHex(kHex);
    keyLamp.ledMat.emissive.setHex(kHex);
    fillLamp.ledMat.emissive.setHex(kHex);
    keyLamp.spot.intensity = 1.6 + state.faders.dmx * 3.4;
    fillLamp.spot.intensity = 1.4 + state.faders.dmx * 2.8;

    focusRingMesh.rotation.z = state.focusNorm * Math.PI * 1.6;
    irisRingMesh.rotation.z = state.irisNorm * Math.PI * 1.6;

    for (const fd of faderDefs) {
      const val = state.faders[fd.id];
      const z = 0.085 - val * 0.13;
      const y = 0.056 + (0.085 - z) * 0.14;
      faderCaps[fd.id].cap.position.set(fd.x, y, z);
    }

    btnPhantom.mat.color.setHex(state.phantom48v ? 0xef4444 : 0x334155);
    btnPhantom.mat.emissiveIntensity = state.phantom48v ? 1.8 : 0.15;
    btnHpf.mat.color.setHex(state.highPass80 ? 0x0ea5e9 : 0x334155);
    btnHpf.mat.emissiveIntensity = state.highPass80 ? 1.8 : 0.15;
    const wbOk = Math.abs(state.kelvin - 5600) <= 250;
    btnWb.mat.color.setHex(wbOk ? 0x22c55e : 0xfbbf24);
    btnWb.mat.emissiveIntensity = wbOk ? 1.8 : 0.5;

    camMonitor.update({
      chromaUniformity: sig.chromaUniformity,
      focusSharpness: sig.focusSharpness,
      irisValue: 1 - state.irisNorm,
      fStop: sig.fStop,
      kelvin: state.kelvin,
      keyPan: state.keyPan
    });
  }

  function renderSideDrawer() {
    const sig = computeLiveSignals();
    const html = `
      <h4>Régie Plateau & Mixage 3D</h4>
      <div style="display:grid;gap:8px;font-size:12px;">
        <div>
          <strong>Éclairage Fond Vert (${sig.chromaUniformity}%)</strong>
          <div style="color:#475569;">Glissez les lampes 3D ou réglez :</div>
          <label style="display:flex;justify-content:space-between;margin-top:4px;"><span>Projecteur Key (pan)</span><span>${Math.round(state.keyPan * 100)}%</span></label>
          <input type="range" min="0" max="100" value="${Math.round(state.keyPan * 100)}" id="av-key-pan" style="width:100%;" />
          <label style="display:flex;justify-content:space-between;"><span>Projecteur Fill (ombres)</span><span>${Math.round(state.fillPan * 100)}%</span></label>
          <input type="range" min="0" max="100" value="${Math.round(state.fillPan * 100)}" id="av-fill-pan" style="width:100%;" />
          <label style="display:flex;justify-content:space-between;"><span>Balance Blancs (5600K)</span><span>${state.kelvin}K</span></label>
          <input type="range" min="3200" max="6500" step="100" value="${state.kelvin}" id="av-kelvin" style="width:100%;" />
        </div>
        <div style="border-top:1px solid rgba(148,163,184,0.3);padding-top:6px;">
          <strong>Optique Caméra (Netteté ${sig.focusSharpness}% · f/${sig.fStop})</strong>
          <label style="display:flex;justify-content:space-between;margin-top:4px;"><span>Bague Focus</span><span>${Math.round(state.focusNorm * 100)}%</span></label>
          <input type="range" min="0" max="100" value="${Math.round(state.focusNorm * 100)}" id="av-focus" style="width:100%;" />
          <label style="display:flex;justify-content:space-between;"><span>Bague Iris (Cible f/2.8–f/5.6)</span><span>f/${sig.fStop}</span></label>
          <input type="range" min="0" max="100" value="${Math.round(state.irisNorm * 100)}" id="av-iris" style="width:100%;" />
        </div>
        <div style="border-top:1px solid rgba(148,163,184,0.3);padding-top:6px;">
          <strong>Audio Console (${sig.audioMasterDb} dBFS)</strong>
          <div style="display:flex;gap:6px;margin:4px 0 6px;flex-wrap:wrap;">
            <button class="tp3d-tool-btn ${state.phantom48v ? 'active' : ''}" id="av-btn-48v">+48V Fantôme</button>
            <button class="tp3d-tool-btn ${state.highPass80 ? 'active' : ''}" id="av-btn-hpf">Coupe-bas 80Hz</button>
          </div>
          <label style="display:flex;justify-content:space-between;"><span>Fader CH1 Mic</span><span>${Math.round(state.faders.mic * 100)}%</span></label>
          <input type="range" min="0" max="100" value="${Math.round(state.faders.mic * 100)}" id="av-f-mic" style="width:100%;" />
          <label style="display:flex;justify-content:space-between;"><span>Fader Master PGM (Cible -14..-10 dB)</span><span>${sig.audioMasterDb} dBFS</span></label>
          <input type="range" min="0" max="100" value="${Math.round(state.faders.master * 100)}" id="av-f-master" style="width:100%;" />
        </div>
      </div>
    `;

    const drawer = bench.setSideDrawer(html);
    if (!drawer) return;

    const bindRange = (sel, setter) => {
      const el = drawer.querySelector(sel);
      if (!el) return;
      el.addEventListener('input', () => {
        setter(Number(el.value));
        sync3DTransforms();
        refreshHud();
      });
      el.addEventListener('change', () => renderSideDrawer());
    };

    bindRange('#av-key-pan', (v) => { state.keyPan = v / 100; });
    bindRange('#av-fill-pan', (v) => { state.fillPan = v / 100; });
    bindRange('#av-kelvin', (v) => { state.kelvin = v; });
    bindRange('#av-focus', (v) => { state.focusNorm = v / 100; });
    bindRange('#av-iris', (v) => { state.irisNorm = v / 100; });
    bindRange('#av-f-mic', (v) => { state.faders.mic = v / 100; });
    bindRange('#av-f-master', (v) => { state.faders.master = v / 100; });

    drawer.querySelector('#av-btn-48v')?.addEventListener('click', () => {
      state.phantom48v = !state.phantom48v;
      sfx.click();
      sync3DTransforms();
      renderSideDrawer();
      refreshHud();
    });
    drawer.querySelector('#av-btn-hpf')?.addEventListener('click', () => {
      state.highPass80 = !state.highPass80;
      sfx.click();
      sync3DTransforms();
      renderSideDrawer();
      refreshHud();
    });
  }

  function finishWorkshop() {
    if (state.finished) return;
    state.finished = true;
    const sig = computeLiveSignals();
    const res = computeAvStudioScore3D({
      keyPanDeg: state.keyPan,
      fillPanDeg: state.fillPan,
      kelvin: state.kelvin,
      chromaUniformity: sig.chromaUniformity,
      focusSharpness: sig.focusSharpness,
      irisOk: sig.irisOk,
      audioMasterDb: sig.audioMasterDb,
      phantom48v: state.phantom48v,
      highPass80: state.highPass80,
      elapsedSec: bench.getElapsedSec()
    });
    sfx.success();
    api.finishTp(
      res.score,
      `
        <p>Régie Audiovisuelle & Plateau Fond Vert 3D validé en <strong>${Math.round(bench.getElapsedSec())}s</strong> :</p>
        <ul>
          <li>Uniformité Fond Vert & Éclairage ${state.kelvin}K : <strong>${sig.chromaUniformity}%</strong></li>
          <li>Optique Caméra (Netteté ${sig.focusSharpness}% · Iris f/${sig.fStop}) : <strong>${sig.irisOk ? 'Exposition idéale' : 'Exposition perfectible'}</strong></li>
          <li>Console Audio (+48V ${state.phantom48v ? 'ON' : 'OFF'}, 80Hz ${state.highPass80 ? 'ON' : 'OFF'}) : <strong>${sig.audioMasterDb} dBFS</strong></li>
        </ul>
      `
    );
  }

  function refreshHud() {
    const sig = computeLiveSignals();
    const ready = sig.chromaUniformity >= 85 && sig.focusSharpness >= 85 && sig.audioOk;
    bench.setInstruction(
      ready ? 'PLATEAU PRÊT POUR DIRECT' : 'RÉGIE STUDIO 3D',
      ready
        ? 'Plateau calibré : fond vert uniforme, mise au point nette et audio nominal !'
        : 'Éliminez les ombres fond vert, faites le point caméra et réglez le VU-mètre (-14..-10 dB)',
      'Glissez directement les projecteurs 3D, les bagues Focus/Iris sur la caméra et les faders motorisés de la console.'
    );
    bench.setAccuracy(`Fond vert ${sig.chromaUniformity}% · Focus ${sig.focusSharpness}% · ${sig.audioMasterDb} dBFS`);
    bench.setActions([
      { id: 'reset', label: 'Réinitialiser', onClick: resetStudio },
      {
        id: 'finish-av',
        label: ready ? 'Lancer Direct (Valider /20)' : 'Valider réglages',
        primary: true,
        onClick: finishWorkshop
      }
    ]);
  }

  function resetStudio() {
    state.keyPan = 0.18;
    state.fillPan = 0.22;
    state.kelvin = 3200;
    state.focusNorm = 0.28;
    state.irisNorm = 0.25;
    state.faders.mic = 0.35;
    state.faders.amb = 0.25;
    state.faders.dmx = 0.55;
    state.faders.master = 0.40;
    state.phantom48v = false;
    state.highPass80 = false;
    state.finished = false;
    sync3DTransforms();
    renderSideDrawer();
    refreshHud();
  }

  bench.addInteractive(keyLamp.headPivot, {
    label: 'Projecteur KEY (Glisser gauche/droite pour orienter & supprimer l’ombre)',
    cursor: 'grab',
    onDragMove: (_pt, dx) => {
      state.keyPan = Math.max(0, Math.min(1, state.keyPan + dx / 180));
      sync3DTransforms();
      refreshHud();
    },
    onDragEnd: () => renderSideDrawer()
  });

  bench.addInteractive(fillLamp.headPivot, {
    label: 'Projecteur FILL Fond Vert (Glisser gauche/droite pour homogénéiser)',
    cursor: 'grab',
    onDragMove: (_pt, dx) => {
      state.fillPan = Math.max(0, Math.min(1, state.fillPan + dx / 180));
      sync3DTransforms();
      refreshHud();
    },
    onDragEnd: () => renderSideDrawer()
  });

  bench.addInteractive(focusRingMesh, {
    label: 'Bague FOCUS Caméra (Glisser gauche/droite pour la netteté)',
    cursor: 'ew-resize',
    onDragMove: (_pt, dx) => {
      state.focusNorm = Math.max(0, Math.min(1, state.focusNorm + dx / 180));
      sync3DTransforms();
      refreshHud();
    },
    onDragEnd: () => renderSideDrawer()
  });

  bench.addInteractive(irisRingMesh, {
    label: 'Bague IRIS Caméra (Glisser gauche/droite pour f/2.8–f/5.6)',
    cursor: 'ew-resize',
    onDragMove: (_pt, dx) => {
      state.irisNorm = Math.max(0, Math.min(1, state.irisNorm + dx / 180));
      sync3DTransforms();
      refreshHud();
    },
    onDragEnd: () => renderSideDrawer()
  });

  for (const fd of faderDefs) {
    bench.addInteractive(faderCaps[fd.id].cap, {
      label: `Fader 3D ${fd.label} (Glisser haut/bas)`,
      cursor: 'ns-resize',
      onDragMove: (_pt, _dx, dy) => {
        state.faders[fd.id] = Math.max(0, Math.min(1, state.faders[fd.id] - dy / 130));
        sync3DTransforms();
        refreshHud();
      },
      onDragEnd: () => renderSideDrawer()
    });
  }

  bench.addInteractive(btnPhantom.btn, {
    label: 'Bouton +48V Alimentation Fantôme Micro',
    onClick: () => {
      state.phantom48v = !state.phantom48v;
      sfx.click();
      sync3DTransforms();
      renderSideDrawer();
      refreshHud();
    }
  });
  bench.addInteractive(btnHpf.btn, {
    label: 'Filtre Coupe-bas 80Hz',
    onClick: () => {
      state.highPass80 = !state.highPass80;
      sfx.click();
      sync3DTransforms();
      renderSideDrawer();
      refreshHud();
    }
  });
  bench.addInteractive(btnWb.btn, {
    label: 'Preset Balance des Blancs 5600K',
    onClick: () => {
      state.kelvin = state.kelvin === 5600 ? 3200 : 5600;
      sfx.click();
      bench.showToast(`Balance des blancs réglée sur ${state.kelvin}K`, state.kelvin === 5600 ? 'success' : 'info');
      sync3DTransforms();
      renderSideDrawer();
      refreshHud();
    }
  });

  bench.addFloatingTag(() => new THREE.Vector3(-0.48, 0.56, -0.02), 'Projecteur KEY', 'key');
  bench.addFloatingTag(() => new THREE.Vector3(0.48, 0.56, -0.02), 'Projecteur FILL', 'fill');
  bench.addFloatingTag(() => new THREE.Vector3(-0.34, 0.48, 0.14), 'Caméra FOCUS/IRIS', 'cam');
  bench.addFloatingTag(() => new THREE.Vector3(0.48, 0.48, 0.12), 'Moniteur Retour', 'mon');
  bench.addFloatingTag(() => new THREE.Vector3(0.0, 0.14, 0.24), 'Console DMX & VU', 'mix');

  bench.setCameras(CAM_VIEWS, state.camId, selectCamera);

  bench.addUpdate((_dt, elapsed) => {
    const sig = computeLiveSignals();
    const normLevel = Math.max(0, Math.min(1, (sig.audioMasterDb + 42) / 36));
    const mod = 0.85 + 0.15 * Math.sin(elapsed * 14) * Math.cos(elapsed * 5.7);
    const liveL = normLevel * mod;
    const liveR = normLevel * (0.88 + 0.12 * Math.sin(elapsed * 11 + 0.8));

    for (let i = 0; i < 10; i++) {
      vuBarsL[i].mat.emissiveIntensity = liveL >= vuBarsL[i].threshold ? 2.2 : 0.04;
      vuBarsR[i].mat.emissiveIntensity = liveR >= vuBarsR[i].threshold ? 2.2 : 0.04;
    }
  });

  sync3DTransforms();
  renderSideDrawer();
  refreshHud();

  return {
    destroy: () => bench.destroy()
  };
}
