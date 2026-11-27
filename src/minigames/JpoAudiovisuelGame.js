import * as THREE from 'three';
import { sfx } from '../core/audio.js';
import { createGradeBreakdown, finalizeGrade20, toSafeNumber } from '../core/grading.js';
import { createWorkbench3D, makeCanvasScreen } from './Workbench3DHost.js';

export const JPO_AV_TARGET = {
  minAudio: 65,
  maxAudio: 85,
  minDmxIntensity: 70,
  targetDmxPreset: 'spectacle',
  targetVideoSource: 'CAM-1'
};

export const JPO_AV_PRESETS = [
  { id: 'concert', label: 'Concert Bleu', color: '#38bdf8' },
  { id: 'spectacle', label: 'Spectacle Violet', color: '#c084fc' },
  { id: 'plateau', label: 'Plateau Or', color: '#fbbf24' }
];

export const JPO_AV_SOURCES = [
  { id: 'CAM-1', label: 'Caméra 1 • Scène' },
  { id: 'CAM-2', label: 'Caméra 2 • Public' },
  { id: 'SLIDES', label: 'Écran • Diaporama' }
];

export function evaluateJpoAudiovisuelState(state = {}) {
  const s = state && typeof state === 'object' ? state : {};
  const micOn = Boolean(s.micOn);
  const audioLevel = Math.max(0, Math.min(100, Math.round(toSafeNumber(s.audioLevel, 30))));
  const dmxPower = Boolean(s.dmxPower);
  const dmxIntensity = Math.max(0, Math.min(100, Math.round(toSafeNumber(s.dmxIntensity, 25))));
  const dmxPreset = String(s.dmxPreset || 'concert');
  const videoSource = String(s.videoSource || 'CAM-2');
  const videoLive = Boolean(s.videoLive);

  const audioLevelOk = audioLevel >= JPO_AV_TARGET.minAudio && audioLevel <= JPO_AV_TARGET.maxAudio;
  const audioOk = micOn && audioLevelOk;
  const dmxOk =
    dmxPower &&
    dmxIntensity >= JPO_AV_TARGET.minDmxIntensity &&
    dmxPreset === JPO_AV_TARGET.targetDmxPreset;
  const videoOk = videoSource === JPO_AV_TARGET.targetVideoSource && videoLive;

  const completedSteps = (audioOk ? 1 : 0) + (dmxOk ? 1 : 0) + (videoOk ? 1 : 0);
  const allValid = audioOk && dmxOk && videoOk;

  const audioPts = (micOn ? 3 : 0) + (audioLevelOk ? 4 : audioLevel >= 45 && audioLevel <= 95 ? 2 : 0);
  const dmxPts =
    (dmxPower ? 2.5 : 0) +
    (dmxIntensity >= JPO_AV_TARGET.minDmxIntensity ? 2 : 0.5) +
    (dmxPreset === JPO_AV_TARGET.targetDmxPreset ? 2.5 : 0.5);
  const videoPts =
    (videoSource === JPO_AV_TARGET.targetVideoSource ? 3 : 0.5) +
    (videoLive ? 3 : 0);

  const rawScore = allValid ? 20 : Math.min(19.5, audioPts + dmxPts + videoPts);
  const score = allValid ? 20 : finalizeGrade20(rawScore, { hasCriticalError: !allValid });

  let advice = 'Bravo ! Le son, les projecteurs DMX et le direct vidéo sont prêts pour le spectacle.';
  if (!micOn) {
    advice = 'Étape 1 : Allume le micro de scène pour capter la voix du présentateur.';
  } else if (!audioLevelOk) {
    advice = `Étape 1 : Place le volume du son entre ${JPO_AV_TARGET.minAudio}% et ${JPO_AV_TARGET.maxAudio}% (zone verte).`;
  } else if (!dmxPower) {
    advice = 'Étape 2 : Allume les projecteurs DMX pour éclairer la scène.';
  } else if (dmxPreset !== JPO_AV_TARGET.targetDmxPreset) {
    advice = 'Étape 2 : Choisis l’ambiance « Spectacle Violet » pour la mise en scène.';
  } else if (dmxIntensity < JPO_AV_TARGET.minDmxIntensity) {
    advice = `Étape 2 : Monte la puissance lumineuse à au moins ${JPO_AV_TARGET.minDmxIntensity}%.`;
  } else if (videoSource !== JPO_AV_TARGET.targetVideoSource) {
    advice = 'Étape 3 : Sélectionne « Caméra 1 • Scène » pour filmer le spectacle.';
  } else if (!videoLive) {
    advice = 'Étape 3 : Active la diffusion « EN DIRECT » pour envoyer l’image sur le grand écran.';
  }

  const breakdown = createGradeBreakdown({
    items: [
      { label: `1. Réglage Son (Micro ${micOn ? 'ON' : 'OFF'} • ${audioLevel}%)`, earned: audioPts, max: 7 },
      { label: `2. Lumière DMX (${dmxPower ? 'ON' : 'OFF'} • ${dmxIntensity}%)`, earned: dmxPts, max: 7 },
      { label: `3. Signal Vidéo (${videoSource} • ${videoLive ? 'DIRECT' : 'VEILLE'})`, earned: videoPts, max: 6 }
    ],
    rawScore,
    finalScore: score,
    hasCriticalError: !allValid
  });

  return {
    micOn,
    audioLevel,
    audioLevelOk,
    audioOk,
    dmxPower,
    dmxIntensity,
    dmxPreset,
    dmxOk,
    videoSource,
    videoLive,
    videoOk,
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

export function createJpoAudiovisuelGame(api) {
  const state = {
    micOn: false,
    audioLevel: 35,
    dmxPower: false,
    dmxIntensity: 30,
    dmxPreset: 'concert',
    videoSource: 'CAM-2',
    videoLive: false,
    submitted: false,
    activeCam: 'overview',
    vuPhase: 0,
    elapsedSec: 0
  };

  const bench = createWorkbench3D(api.container, {
    background: '#16233b',
    wallColor: '#1a2844',
    benchColor: '#1f2d46',
    benchWidth: 4.2,
    benchDepth: 2.1,
    cameraPos: [0, 1.44, 2.48],
    lookAt: [0, 0.38, -0.08],
    fov: 42,
    envIntensity: 0.92
  });

  const presets = [
    { id: 'overview', label: '🎛️ Vue Régie', pos: [0, 1.44, 2.48], lookAt: [0, 0.38, -0.08] },
    { id: 'audio', label: '🎙️ Son', pos: [-1.05, 0.92, 1.24], lookAt: [-0.92, 0.22, 0.12] },
    { id: 'dmx', label: '💡 Lumière DMX', pos: [0, 1.08, 1.66], lookAt: [0, 0.56, -0.36] },
    { id: 'video', label: '📺 Vidéo', pos: [1.14, 0.96, 1.32], lookAt: [1.04, 0.34, 0.0] }
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

  const warmStudioLight = new THREE.PointLight('#ffedd5', 2.4, 9, 1.4);
  warmStudioLight.position.set(-1.7, 1.9, 1.6);
  bench.scene.add(warmStudioLight);

  const coolStudioLight = new THREE.PointLight('#38bdf8', 2.2, 9, 1.4);
  coolStudioLight.position.set(1.9, 1.85, -1.1);
  bench.scene.add(coolStudioLight);

  const stageBounceLight = new THREE.PointLight('#818cf8', 0.9, 5, 1.6);
  stageBounceLight.position.set(0, 0.72, 0.22);
  bench.scene.add(stageBounceLight);

  const darkMat = bench.track(new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.4, metalness: 0.52 }));
  const chassisMat = bench.track(new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.38, metalness: 0.58 }));
  const metalMat = bench.track(new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.28, metalness: 0.78 }));
  const chromeMat = bench.track(new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.18, metalness: 0.88 }));

  const backWallTex = bench.track(
    makeCanvasTexture(1024, 512, (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#132038');
      grad.addColorStop(0.55, '#192a4a');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      for (let x = 0; x < w; x += 24) {
        ctx.fillStyle = x % 48 === 0 ? 'rgba(15, 23, 42, 0.72)' : 'rgba(30, 41, 59, 0.45)';
        ctx.fillRect(x, 0, 14, h);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
        ctx.fillRect(x + 14, 0, 2, h);
      }

      ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
      ctx.fillRect(0, 48, w, 6);
      ctx.fillStyle = 'rgba(168, 85, 247, 0.18)';
      ctx.fillRect(0, h - 56, w, 6);
    })
  );
  const studioWall = new THREE.Mesh(
    bench.track(new THREE.PlaneGeometry(6.4, 3.0)),
    bench.track(new THREE.MeshStandardMaterial({ map: backWallTex, roughness: 0.65, metalness: 0.12 }))
  );
  studioWall.position.set(0, 1.38, -1.62);
  studioWall.receiveShadow = true;
  bench.scene.add(studioWall);

  const wallLightBarMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#38bdf8', emissiveIntensity: 1.1 })
  );
  const topStrip = new THREE.Mesh(bench.track(new THREE.BoxGeometry(4.6, 0.025, 0.03)), wallLightBarMat);
  topStrip.position.set(0, 2.24, -1.58);
  bench.scene.add(topStrip);
  const botStrip = new THREE.Mesh(bench.track(new THREE.BoxGeometry(4.6, 0.02, 0.03)), wallLightBarMat);
  botStrip.position.set(0, 0.42, -1.58);
  bench.scene.add(botStrip);

  const signFrame = new THREE.Mesh(bench.track(new THREE.BoxGeometry(2.36, 0.38, 0.05)), darkMat);
  signFrame.position.set(0, 1.66, -1.56);
  bench.scene.add(signFrame);

  const signScreen = makeCanvasScreen(760, 120, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, w, 0);
    bg.addColorStop(0, '#0f172a');
    bg.addColorStop(0.5, '#1e1b4b');
    bg.addColorStop(1, '#0f172a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RÉGIE SCÉNIQUE • BAC PRO CIEL', w / 2, 54);

    ctx.fillStyle = '#a5f3fc';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('SONORISATION  •  ÉCLAIRAGE DMX512  •  RÉGIE VIDÉO LIVE', w / 2, 90);
    ctx.textAlign = 'left';
  });
  bench.track(signScreen.texture);
  const signFace = new THREE.Mesh(
    bench.track(new THREE.PlaneGeometry(2.26, 0.3)),
    bench.track(new THREE.MeshBasicMaterial({ map: signScreen.texture }))
  );
  signFace.position.set(0, 1.66, -1.53);
  bench.scene.add(signFace);

  const matTex = bench.track(
    makeCanvasTexture(1024, 512, (ctx, w, h) => {
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
      ctx.lineWidth = 2;
      for (let x = -h; x < w + h; x += 28) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + h, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x + h, 0);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, w - 20, h - 20);

      const zones = [
        { x: 26, w: 300, color: '#38bdf8', title: 'ZONE SON' },
        { x: 356, w: 312, color: '#c084fc', title: 'PLATEAU DMX' },
        { x: 698, w: 300, color: '#f43f5e', title: 'ZONE VIDÉO' }
      ];
      for (const z of zones) {
        ctx.strokeStyle = z.color;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(z.x, 28, z.w, h - 56);
        ctx.fillStyle = z.color;
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(z.title, z.x + 14, h - 42);
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

  const CANVAS_THROTTLE_SEC = 1 / 12;
  const CANVAS_THROTTLE_MS = 84;

  const grommetOuterGeo = bench.track(new THREE.CylinderGeometry(0.055, 0.055, 0.016, 16));
  const grommetHoleGeo = bench.track(new THREE.CylinderGeometry(0.036, 0.036, 0.018, 16));
  for (const cx of [-1.25, -0.45, 0.45, 1.25]) {
    const grommet = new THREE.Mesh(grommetOuterGeo, metalMat);
    grommet.position.set(cx, 0.01, -0.78);
    bench.scene.add(grommet);
    const grommetHole = new THREE.Mesh(grommetHoleGeo, darkMat);
    grommetHole.position.set(cx, 0.011, -0.78);
    bench.scene.add(grommetHole);
  }

  const cableSpecs = [
    { color: '#0ea5e9', pts: [[-1.56, 0.06, -0.22], [-1.32, 0.025, -0.58], [-1.05, 0.025, -0.42], [-0.92, 0.05, -0.14]] },
    { color: '#a855f7', pts: [[-0.78, 0.04, -0.22], [-0.45, 0.02, -0.74], [0, 0.02, -0.74], [0.45, 0.02, -0.62]] },
    { color: '#ef4444', pts: [[0.92, 0.04, -0.16], [0.65, 0.02, -0.72], [1.25, 0.02, -0.72], [1.08, 0.05, -0.18]] }
  ];
  for (const cs of cableSpecs) {
    const curve = new THREE.CatmullRomCurve3(cs.pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    const cable = new THREE.Mesh(
      bench.track(new THREE.TubeGeometry(curve, 22, 0.011, 8, false)),
      bench.track(new THREE.MeshStandardMaterial({ color: cs.color, roughness: 0.45 }))
    );
    bench.scene.add(cable);
  }

  const rackGroup = new THREE.Group();
  rackGroup.position.set(-1.72, 0, -0.22);
  rackGroup.rotation.y = 0.24;
  bench.scene.add(rackGroup);

  const rackCabinet = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.42, 0.62, 0.44)), darkMat);
  rackCabinet.position.set(0, 0.31, 0);
  rackCabinet.castShadow = true;
  rackGroup.add(rackCabinet);

  const rackRailGeo = bench.track(new THREE.BoxGeometry(0.022, 0.58, 0.02));
  for (const rx of [-0.185, 0.185]) {
    const rail = new THREE.Mesh(rackRailGeo, metalMat);
    rail.position.set(rx, 0.31, 0.218);
    rackGroup.add(rail);
  }

  const rackLeds = [];
  const rackFaceGeo = bench.track(new THREE.BoxGeometry(0.34, 0.105, 0.018));
  const rackGrillGeo = bench.track(new THREE.BoxGeometry(0.18, 0.055, 0.01));
  const rackLedGeo = bench.track(new THREE.SphereGeometry(0.009, 8, 8));
  for (let u = 0; u < 4; u++) {
    const unitY = 0.12 + u * 0.13;
    const face = new THREE.Mesh(rackFaceGeo, chassisMat);
    face.position.set(0, unitY, 0.218);
    rackGroup.add(face);

    const grill = new THREE.Mesh(rackGrillGeo, darkMat);
    grill.position.set(-0.05, unitY, 0.228);
    rackGroup.add(grill);

    for (let l = 0; l < 3; l++) {
      const isBlue = (u + l) % 2 === 1;
      const ledMat = bench.track(
        new THREE.MeshStandardMaterial({
          color: isBlue ? '#38bdf8' : '#22c55e',
          emissive: isBlue ? '#0284c7' : '#16a34a',
          emissiveIntensity: 0.9
        })
      );
      const led = new THREE.Mesh(rackLedGeo, ledMat);
      led.position.set(0.08 + l * 0.032, unitY + 0.015, 0.232);
      rackGroup.add(led);
      rackLeds.push({ mat: ledMat, phase: u * 1.1 + l * 0.7 });
    }
  }

  const audioGroup = new THREE.Group();
  audioGroup.position.set(-0.92, 0, 0.14);
  audioGroup.rotation.y = 0.08;
  bench.scene.add(audioGroup);

  const mixerSurfaceTex = bench.track(
    makeCanvasTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(18, 20, w - 36, h - 40);

      for (let ch = 0; ch < 6; ch++) {
        const x = 36 + ch * 54;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, 34, 46, h - 68);
        ctx.fillStyle = ch === 0 ? '#22c55e' : '#38bdf8';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(ch === 0 ? 'MIC' : `CH${ch + 1}`, x + 8, h - 48);
        for (let t = 0; t <= 6; t++) {
          const ty = 285 + t * 22;
          ctx.fillStyle = 'rgba(226, 232, 240, 0.45)';
          ctx.fillRect(x + 8, ty, 8, 2);
          ctx.fillRect(x + 30, ty, 8, 2);
        }
      }

      ctx.strokeStyle = 'rgba(248, 113, 113, 0.45)';
      ctx.strokeRect(374, 34, 108, h - 68);
      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('MAIN L/R', 390, h - 48);
    })
  );

  const mixerChassis = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.84, 0.09, 0.62)), darkMat);
  mixerChassis.position.set(0, 0.055, 0);
  mixerChassis.rotation.x = 0.14;
  mixerChassis.castShadow = true;
  audioGroup.add(mixerChassis);

  const mixerFaceplate = new THREE.Mesh(
    bench.track(new THREE.PlaneGeometry(0.78, 0.56)),
    bench.track(new THREE.MeshStandardMaterial({ map: mixerSurfaceTex, roughness: 0.45, metalness: 0.25 }))
  );
  mixerFaceplate.rotation.x = -Math.PI / 2;
  mixerFaceplate.position.set(0, 0.047, 0);
  mixerChassis.add(mixerFaceplate);

  const mixerCheekGeo = bench.track(new THREE.BoxGeometry(0.032, 0.11, 0.64));
  for (const sx of [-0.43, 0.43]) {
    const cheek = new THREE.Mesh(mixerCheekGeo, chassisMat);
    cheek.position.set(sx, 0.005, 0);
    mixerChassis.add(cheek);
  }

  const faderKnobGeo = bench.track(new THREE.BoxGeometry(0.038, 0.024, 0.046));
  const trackGeo = bench.track(new THREE.BoxGeometry(0.012, 0.006, 0.22));
  const faderTrackMat = bench.track(new THREE.MeshStandardMaterial({ color: '#020617', roughness: 0.8 }));
  const passiveFaderMat = bench.track(new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.35, metalness: 0.3 }));
  const micFaderMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0284c7', emissiveIntensity: 0.55 })
  );
  const masterFaderMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#f87171', emissive: '#991b1b', emissiveIntensity: 0.35 })
  );

  const channelX = [-0.30, -0.21, -0.12, -0.03, 0.06, 0.15, 0.26, 0.34];
  const faderKnobs = [];
  channelX.forEach((cx, idx) => {
    const slot = new THREE.Mesh(trackGeo, faderTrackMat);
    slot.position.set(cx, 0.049, 0.13);
    mixerChassis.add(slot);

    const isMic = idx === 0;
    const isMaster = idx >= 6;
    const mat = isMic ? micFaderMat : isMaster ? masterFaderMat : passiveFaderMat;
    const knob = new THREE.Mesh(faderKnobGeo, mat);
    const defaultZ = isMaster ? 0.08 : 0.17 - ((idx % 3) * 0.03);
    knob.position.set(cx, 0.062, defaultZ);
    mixerChassis.add(knob);
    faderKnobs.push({ mesh: knob, isMic, isMaster });
  });

  const knobBodyGeo = bench.track(new THREE.CylinderGeometry(0.014, 0.016, 0.022, 12));
  const knobCapGeo = bench.track(new THREE.CylinderGeometry(0.01, 0.01, 0.008, 10));
  const knobCapColors = ['#ef4444', '#38bdf8', '#fbbf24'];
  const knobCapMats = knobCapColors.map((c) => bench.track(new THREE.MeshStandardMaterial({ color: c, roughness: 0.35 })));
  const knobBodyMat = bench.track(new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.4, metalness: 0.4 }));
  for (let col = 0; col < 6; col++) {
    const cx = channelX[col];
    for (let row = 0; row < 3; row++) {
      const pot = new THREE.Mesh(knobBodyGeo, knobBodyMat);
      pot.position.set(cx, 0.058, -0.19 + row * 0.058);
      mixerChassis.add(pot);

      const cap = new THREE.Mesh(knobCapGeo, knobCapMats[row]);
      cap.position.set(0, 0.012, 0);
      pot.add(cap);
    }
  }

  const micButtonMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#991b1b', emissiveIntensity: 0.8 })
  );
  const padGeo = bench.track(new THREE.BoxGeometry(0.034, 0.014, 0.026));
  const mutedPadMat = bench.track(new THREE.MeshStandardMaterial({ color: '#334155', emissive: '#1e293b', emissiveIntensity: 0.2 }));
  const activeBluePadMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0284c7', emissiveIntensity: 0.7 })
  );
  for (let col = 0; col < 6; col++) {
    const mat = col === 0 ? micButtonMat : col % 2 === 1 ? activeBluePadMat : mutedPadMat;
    const btn = new THREE.Mesh(padGeo, mat);
    btn.position.set(channelX[col], 0.054, -0.01);
    mixerChassis.add(btn);
  }

  const gooseBase = new THREE.Mesh(bench.track(new THREE.CylinderGeometry(0.016, 0.02, 0.025, 12)), metalMat);
  gooseBase.position.set(-0.34, 0.058, -0.24);
  mixerChassis.add(gooseBase);
  const gooseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.34, 0.07, -0.24),
    new THREE.Vector3(-0.36, 0.19, -0.21),
    new THREE.Vector3(-0.29, 0.25, -0.11)
  ]);
  const gooseNeck = new THREE.Mesh(bench.track(new THREE.TubeGeometry(gooseCurve, 14, 0.006, 8, false)), darkMat);
  mixerChassis.add(gooseNeck);
  const gooseMicHead = new THREE.Mesh(bench.track(new THREE.SphereGeometry(0.016, 10, 10)), metalMat);
  gooseMicHead.position.set(-0.29, 0.25, -0.11);
  mixerChassis.add(gooseMicHead);

  const meterBridge = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.84, 0.24, 0.08)), darkMat);
  meterBridge.position.set(0, 0.24, -0.28);
  meterBridge.rotation.x = -0.12;
  meterBridge.castShadow = true;
  audioGroup.add(meterBridge);

  const vuColumns = [[], []];
  const vuLedGeo = bench.track(new THREE.BoxGeometry(0.036, 0.013, 0.014));
  for (let side = 0; side < 2; side++) {
    const colX = side === 0 ? 0.26 : 0.32;
    for (let seg = 0; seg < 10; seg++) {
      const color = seg < 6 ? '#22c55e' : seg < 8 ? '#eab308' : '#ef4444';
      const ledMat = bench.track(
        new THREE.MeshStandardMaterial({
          color: '#1e293b',
          emissive: color,
          emissiveIntensity: 0.05
        })
      );
      const led = new THREE.Mesh(vuLedGeo, ledMat);
      led.position.set(colX, -0.072 + seg * 0.017, 0.04);
      meterBridge.add(led);
      vuColumns[side].push({ mat: ledMat, color, threshold: (seg + 1) * 10 });
    }
  }

  const audioScreen = makeCanvasScreen(340, 180, (ctx, w, h, st) => {
    const s = st || state;
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('CONSOLE SON • MASTER', 16, 28);
    ctx.fillStyle = s.micOn ? '#4ade80' : '#f87171';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(s.micOn ? '● MICRO : ALLUMÉ' : '○ MICRO : COUPÉ', 16, 54);
    const barW = w - 32;
    const fillRatio = s.micOn ? Math.min(1, Math.max(0.05, (s.audioLevel + Math.sin(s.vuPhase) * 5) / 100)) : 0.03;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(16, 78, barW, 30);
    ctx.fillStyle = 'rgba(34, 197, 94, 0.25)';
    ctx.fillRect(16 + barW * 0.65, 74, barW * 0.2, 38);
    const inGreen = s.audioLevel >= JPO_AV_TARGET.minAudio && s.audioLevel <= JPO_AV_TARGET.maxAudio;
    ctx.fillStyle = s.micOn ? (inGreen ? '#22c55e' : s.audioLevel > 85 ? '#ef4444' : '#38bdf8') : '#475569';
    ctx.fillRect(16, 78, barW * fillRatio, 30);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`Volume : ${s.audioLevel}%`, 16, 146);
  }, { minIntervalMs: CANVAS_THROTTLE_MS });
  bench.track(audioScreen.texture);
  const audioDisplay = new THREE.Mesh(
    bench.track(new THREE.PlaneGeometry(0.56, 0.21)),
    bench.track(new THREE.MeshBasicMaterial({ map: audioScreen.texture }))
  );
  audioDisplay.position.set(-0.09, 0, 0.042);
  meterBridge.add(audioDisplay);

  const trussGroup = new THREE.Group();
  trussGroup.position.set(0, 0, -0.44);
  bench.scene.add(trussGroup);

  const trussStrutMatrices = [];
  const _trussA = new THREE.Vector3();
  const _trussB = new THREE.Vector3();
  const _trussDir = new THREE.Vector3();
  const _trussMid = new THREE.Vector3();
  const _trussUp = new THREE.Vector3(0, 1, 0);
  const _trussQuat = new THREE.Quaternion();
  const _trussScale = new THREE.Vector3();
  function addTrussStrut(p1, p2, radius = 0.008) {
    _trussA.set(p1[0], p1[1], p1[2]);
    _trussB.set(p2[0], p2[1], p2[2]);
    _trussDir.subVectors(_trussB, _trussA);
    const len = _trussDir.length();
    if (len < 0.001) return;
    _trussMid.copy(_trussA).addScaledVector(_trussDir, 0.5);
    _trussQuat.setFromUnitVectors(_trussUp, _trussDir.normalize());
    _trussScale.set(radius, len, radius);
    const m = new THREE.Matrix4().compose(_trussMid, _trussQuat, _trussScale);
    trussStrutMatrices.push(m);
  }

  const trussBaseGeo = bench.track(new THREE.BoxGeometry(0.18, 0.02, 0.18));
  for (const px of [-0.74, 0.74]) {
    const basePlate = new THREE.Mesh(trussBaseGeo, metalMat);
    basePlate.position.set(px, 0.01, 0);
    trussGroup.add(basePlate);
    for (const dx of [-0.042, 0.042]) {
      for (const dz of [-0.042, 0.042]) {
        addTrussStrut([px + dx, 0.02, dz], [px + dx, 1.04, dz], 0.01);
      }
    }
    for (let seg = 0; seg < 6; seg++) {
      const y0 = 0.06 + seg * 0.16;
      const y1 = y0 + 0.16;
      addTrussStrut([px - 0.042, y0, 0.042], [px + 0.042, y1, 0.042], 0.006);
      addTrussStrut([px - 0.042, y0, -0.042], [px + 0.042, y1, -0.042], 0.006);
      addTrussStrut([px - 0.042, y0, -0.042], [px - 0.042, y1, 0.042], 0.006);
      addTrussStrut([px + 0.042, y0, -0.042], [px + 0.042, y1, 0.042], 0.006);
    }
  }

  for (const dy of [0.96, 1.04]) {
    for (const dz of [-0.045, 0.045]) {
      addTrussStrut([-0.78, dy, dz], [0.78, dy, dz], 0.01);
    }
  }
  for (let seg = 0; seg < 10; seg++) {
    const x0 = -0.74 + seg * 0.148;
    const x1 = x0 + 0.148;
    addTrussStrut([x0, 0.96, 0.045], [x1, 1.04, 0.045], 0.006);
    addTrussStrut([x0, 0.96, -0.045], [x1, 1.04, -0.045], 0.006);
    addTrussStrut([x0, 1.04, -0.045], [x1, 1.04, 0.045], 0.006);
    addTrussStrut([x0, 0.96, -0.045], [x1, 0.96, 0.045], 0.006);
  }
  if (trussStrutMatrices.length > 0) {
    const trussUnitCylGeo = bench.track(new THREE.CylinderGeometry(1, 1, 1, 8));
    const trussInst = new THREE.InstancedMesh(trussUnitCylGeo, chromeMat, trussStrutMatrices.length);
    for (let i = 0; i < trussStrutMatrices.length; i++) {
      trussInst.setMatrixAt(i, trussStrutMatrices[i]);
    }
    trussInst.instanceMatrix.needsUpdate = true;
    trussInst.computeBoundingBox?.();
    trussInst.computeBoundingSphere?.();
    trussGroup.add(trussInst);
  }

  const dmxSpots = [];
  const spotXs = [-0.54, -0.18, 0.18, 0.54];
  const yokeGeo = bench.track(new THREE.BoxGeometry(0.15, 0.06, 0.03));
  const parBarrelGeo = bench.track(new THREE.CylinderGeometry(0.062, 0.052, 0.17, 16));
  const bezelRingGeo = bench.track(new THREE.TorusGeometry(0.062, 0.008, 8, 18));
  const lensGeo = bench.track(new THREE.CylinderGeometry(0.056, 0.056, 0.014, 16));
  const coneGeo = bench.track(new THREE.ConeGeometry(0.32, 0.96, 22, 1, true));
  const coreConeGeo = bench.track(new THREE.ConeGeometry(0.15, 0.88, 16, 1, true));
  const sharedLensMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#1e293b', emissive: '#c084fc', emissiveIntensity: 0 })
  );
  const sharedConeMat = bench.track(
    new THREE.MeshBasicMaterial({
      color: '#c084fc',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    })
  );
  const sharedCoreConeMat = bench.track(
    new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    })
  );
  spotXs.forEach((sx, idx) => {
    const yoke = new THREE.Mesh(yokeGeo, metalMat);
    yoke.position.set(sx, 0.93, 0.03);
    trussGroup.add(yoke);

    const housing = new THREE.Group();
    housing.position.set(sx, 0.87, 0.05);
    housing.rotation.x = 0.42;
    housing.rotation.y = (1.5 - idx) * 0.12;
    trussGroup.add(housing);

    const parBarrel = new THREE.Mesh(parBarrelGeo, darkMat);
    parBarrel.rotation.x = Math.PI / 2;
    housing.add(parBarrel);

    const bezelRing = new THREE.Mesh(bezelRingGeo, metalMat);
    bezelRing.position.set(0, 0, 0.085);
    housing.add(bezelRing);

    const lens = new THREE.Mesh(lensGeo, sharedLensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0, 0.084);
    housing.add(lens);

    const cone = new THREE.Mesh(coneGeo, sharedConeMat);
    cone.rotation.x = -Math.PI / 2;
    cone.position.set(0, 0, 0.56);
    housing.add(cone);

    const coreCone = new THREE.Mesh(coreConeGeo, sharedCoreConeMat);
    coreCone.rotation.x = -Math.PI / 2;
    coreCone.position.set(0, 0, 0.52);
    housing.add(coreCone);

    const spot = new THREE.SpotLight('#c084fc', 0, 5.5, 0.54, 0.62, 1.1);
    spot.position.set(sx, 0.86, 0.08);
    spot.target.position.set(sx * 0.55, 0.02, 0.52);
    trussGroup.add(spot);
    trussGroup.add(spot.target);
    dmxSpots.push({ lensMat: sharedLensMat, coneMat: sharedConeMat, coreConeMat: sharedCoreConeMat, spot });
  });

  const stagePad = new THREE.Mesh(
    bench.track(new THREE.BoxGeometry(1.06, 0.045, 0.58)),
    bench.track(new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.42, metalness: 0.25 }))
  );
  stagePad.position.set(0, 0.024, 0.14);
  stagePad.receiveShadow = true;
  bench.scene.add(stagePad);

  const wedgeGeo = bench.track(new THREE.BoxGeometry(0.18, 0.075, 0.12));
  for (const wx of [-0.36, 0.36]) {
    const wedge = new THREE.Mesh(wedgeGeo, darkMat);
    wedge.position.set(wx, 0.072, 0.33);
    wedge.rotation.x = -0.35;
    bench.scene.add(wedge);
  }

  const stageHaloTex = bench.track(
    makeCanvasTexture(256, 256, (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
      grad.addColorStop(0, 'rgba(255,255,255,0.95)');
      grad.addColorStop(0.55, 'rgba(255,255,255,0.35)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    })
  );
  const stageHaloMat = bench.track(
    new THREE.MeshBasicMaterial({
      map: stageHaloTex,
      color: '#c084fc',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  const stageHalo = new THREE.Mesh(bench.track(new THREE.PlaneGeometry(1.02, 0.54)), stageHaloMat);
  stageHalo.rotation.x = -Math.PI / 2;
  stageHalo.position.set(0, 0.049, 0.14);
  bench.scene.add(stageHalo);

  const videoGroup = new THREE.Group();
  videoGroup.position.set(1.04, 0, 0.04);
  videoGroup.rotation.y = -0.14;
  bench.scene.add(videoGroup);

  const monitorStand = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.18, 0.16, 0.08)), metalMat);
  monitorStand.position.set(-0.1, 0.08, -0.18);
  videoGroup.add(monitorStand);

  const monitorFrame = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.76, 0.48, 0.055)), darkMat);
  monitorFrame.position.set(-0.1, 0.36, -0.16);
  monitorFrame.castShadow = true;
  videoGroup.add(monitorFrame);

  const tallyBarMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#475569', emissive: '#000000', emissiveIntensity: 0 })
  );
  const tallyBar = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.32, 0.022, 0.025)), tallyBarMat);
  tallyBar.position.set(-0.1, 0.612, -0.145);
  videoGroup.add(tallyBar);

  const videoScreen = makeCanvasScreen(440, 270, (ctx, w, h, st) => {
    const s = st || state;
    const presetSpec = JPO_AV_PRESETS.find((p) => p.id === s.dmxPreset) || JPO_AV_PRESETS[0];
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('PGM / EN DIRECT • RÉGIE VIDÉO', 16, 26);

    ctx.fillStyle = s.videoLive ? '#ef4444' : '#334155';
    ctx.fillRect(w - 130, 8, 114, 26);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(s.videoLive ? '● EN DIRECT' : '○ EN VEILLE', w - 118, 26);

    const cards = [
      { id: 'CAM-1', title: 'CAM 1', sub: 'Scène', x: 16 },
      { id: 'CAM-2', title: 'CAM 2', sub: 'Public', x: 156 },
      { id: 'SLIDES', title: 'SLIDES', sub: 'Écran', x: 296 }
    ];
    for (const c of cards) {
      const selected = s.videoSource === c.id;
      ctx.fillStyle = selected ? '#312e81' : '#111827';
      ctx.fillRect(c.x, 44, 128, 60);
      ctx.strokeStyle = selected ? '#22c55e' : '#334155';
      ctx.lineWidth = selected ? 3 : 1.5;
      ctx.strokeRect(c.x, 44, 128, 60);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(c.title, c.x + 12, 70);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px sans-serif';
      ctx.fillText(c.sub, c.x + 12, 90);
    }

    ctx.fillStyle = s.videoLive ? '#052e16' : '#0f172a';
    ctx.fillRect(16, 118, w - 32, 134);
    if (s.dmxPower) {
      const glow = ctx.createRadialGradient(w / 2, 165, 10, w / 2, 165, 140);
      glow.addColorStop(0, presetSpec.color);
      glow.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.globalAlpha = 0.22 + (s.dmxIntensity / 100) * 0.35;
      ctx.fillStyle = glow;
      ctx.fillRect(16, 118, w - 32, 134);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = s.videoLive ? '#ef4444' : '#475569';
    ctx.lineWidth = 3;
    ctx.strokeRect(16, 118, w - 32, 134);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 21px sans-serif';
    ctx.fillText(`PGM : ${s.videoSource}`, 34, 168);
    ctx.fillStyle = s.videoLive ? '#86efac' : '#cbd5e1';
    ctx.font = '14px sans-serif';
    ctx.fillText(
      s.videoLive ? 'Diffusion en direct vers la salle !' : 'Sélectionne CAM 1 puis passe EN DIRECT.',
      34,
      198
    );
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px monospace';
    const sec = Math.floor(s.elapsedSec || 0);
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    ctx.fillText(`TC 01:${mm}:${ss}`, 34, 232);
  }, { minIntervalMs: CANVAS_THROTTLE_MS });
  bench.track(videoScreen.texture);
  const monitorFace = new THREE.Mesh(
    bench.track(new THREE.PlaneGeometry(0.69, 0.41)),
    bench.track(new THREE.MeshBasicMaterial({ map: videoScreen.texture }))
  );
  monitorFace.position.set(-0.1, 0.36, -0.13);
  videoGroup.add(monitorFace);

  const cam1Screen = makeCanvasScreen(240, 150, (ctx, w, h, st) => {
    const s = st || state;
    const presetSpec = JPO_AV_PRESETS.find((p) => p.id === s.dmxPreset) || JPO_AV_PRESETS[0];
    const isSel = s.videoSource === 'CAM-1';
    ctx.fillStyle = '#090d1a';
    ctx.fillRect(0, 0, w, h);
    if (s.dmxPower) {
      ctx.globalAlpha = 0.25 + (s.dmxIntensity / 100) * 0.45;
      ctx.fillStyle = presetSpec.color;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(45 + i * 75, 16);
        ctx.lineTo(15 + i * 75 + Math.sin(s.vuPhase * 0.5 + i) * 8, h - 18);
        ctx.lineTo(75 + i * 75 + Math.sin(s.vuPhase * 0.5 + i) * 8, h - 18);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#020617';
    ctx.fillRect(24, h - 32, w - 48, 18);
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(w / 2, h - 54, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(w / 2 - 12, h - 43, 24, 14);
    ctx.fillStyle = isSel ? (s.videoLive ? '#ef4444' : '#22c55e') : '#1e293b';
    ctx.fillRect(8, 8, 96, 22);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('CAM 1 • SCÈNE', 14, 23);
    ctx.strokeStyle = isSel ? (s.videoLive ? '#ef4444' : '#22c55e') : '#334155';
    ctx.lineWidth = isSel ? 5 : 2;
    ctx.strokeRect(3, 3, w - 6, h - 6);
  }, { minIntervalMs: CANVAS_THROTTLE_MS });
  bench.track(cam1Screen.texture);

  const cam2Screen = makeCanvasScreen(240, 150, (ctx, w, h, st) => {
    const s = st || state;
    const isSel = s.videoSource === 'CAM-2';
    ctx.fillStyle = '#0b1120';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1e293b';
    for (let i = 0; i < 6; i++) {
      const px = 26 + i * 36;
      const py = h - 32 + Math.sin(s.vuPhase * 0.4 + i) * 3;
      ctx.beginPath();
      ctx.arc(px, py - 14, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(px - 11, py - 5, 22, 24);
    }
    ctx.fillStyle = isSel ? (s.videoLive ? '#ef4444' : '#22c55e') : '#1e293b';
    ctx.fillRect(8, 8, 102, 22);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('CAM 2 • PUBLIC', 14, 23);
    ctx.strokeStyle = isSel ? (s.videoLive ? '#ef4444' : '#22c55e') : '#334155';
    ctx.lineWidth = isSel ? 5 : 2;
    ctx.strokeRect(3, 3, w - 6, h - 6);
  }, { minIntervalMs: CANVAS_THROTTLE_MS });
  bench.track(cam2Screen.texture);

  const previewMonitorSpecs = [
    { y: 0.47, screen: cam1Screen },
    { y: 0.23, screen: cam2Screen }
  ];
  const previewFrameGeo = bench.track(new THREE.BoxGeometry(0.32, 0.21, 0.045));
  const previewFaceGeo = bench.track(new THREE.PlaneGeometry(0.28, 0.175));
  for (const pm of previewMonitorSpecs) {
    const subWrap = new THREE.Group();
    subWrap.position.set(0.45, pm.y, -0.07);
    subWrap.rotation.y = -0.26;
    videoGroup.add(subWrap);

    const frame = new THREE.Mesh(previewFrameGeo, darkMat);
    frame.castShadow = true;
    subWrap.add(frame);

    const face = new THREE.Mesh(
      previewFaceGeo,
      bench.track(new THREE.MeshBasicMaterial({ map: pm.screen.texture }))
    );
    face.position.set(0, 0, 0.025);
    subWrap.add(face);
  }

  const switcherGroup = new THREE.Group();
  switcherGroup.position.set(0.05, 0.04, 0.22);
  switcherGroup.rotation.x = 0.14;
  videoGroup.add(switcherGroup);

  const switcherPad = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.74, 0.065, 0.34)), darkMat);
  switcherPad.castShadow = true;
  switcherGroup.add(switcherPad);

  const switcherLabelTex = bench.track(
    makeCanvasTexture(512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('PREVIEW', 26, 118);
      ctx.fillStyle = '#f87171';
      ctx.fillText('ON AIR', 26, 206);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('CAM 1       CAM 2       SLIDES', 120, 46);
    })
  );
  const switcherPlate = new THREE.Mesh(
    bench.track(new THREE.PlaneGeometry(0.7, 0.3)),
    bench.track(new THREE.MeshStandardMaterial({ map: switcherLabelTex, roughness: 0.45 }))
  );
  switcherPlate.rotation.x = -Math.PI / 2;
  switcherPlate.position.set(0, 0.034, 0);
  switcherGroup.add(switcherPlate);

  const previewButtons = [];
  const programButtons = [];
  const srcIds = ['CAM-1', 'CAM-2', 'SLIDES'];
  const swBtnGeo = bench.track(new THREE.BoxGeometry(0.085, 0.02, 0.048));
  srcIds.forEach((srcId, i) => {
    const bx = -0.14 + i * 0.13;
    const pvwMat = bench.track(
      new THREE.MeshStandardMaterial({ color: '#14532d', emissive: '#16a34a', emissiveIntensity: 0.1 })
    );
    const pvwBtn = new THREE.Mesh(swBtnGeo, pvwMat);
    pvwBtn.position.set(bx, 0.042, -0.02);
    switcherGroup.add(pvwBtn);
    previewButtons.push({ srcId, mat: pvwMat });

    const pgmMat = bench.track(
      new THREE.MeshStandardMaterial({ color: '#7f1d1d', emissive: '#dc2626', emissiveIntensity: 0.1 })
    );
    const pgmBtn = new THREE.Mesh(swBtnGeo, pgmMat);
    pgmBtn.position.set(bx, 0.042, 0.075);
    switcherGroup.add(pgmBtn);
    programButtons.push({ srcId, mat: pgmMat });
  });

  const tBarSlot = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.024, 0.012, 0.16)), faderTrackMat);
  tBarSlot.position.set(0.24, 0.036, 0.02);
  switcherGroup.add(tBarSlot);
  const tBarArm = new THREE.Mesh(bench.track(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 10)), chromeMat);
  tBarArm.position.set(0.24, 0.072, 0.02);
  switcherGroup.add(tBarArm);
  const tBarHandle = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.085, 0.022, 0.028)), metalMat);
  tBarHandle.position.set(0, 0.045, 0);
  tBarArm.add(tBarHandle);

  const onAirMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#7f1d1d', emissive: '#dc2626', emissiveIntensity: 0.1 })
  );
  const onAirBtn = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.11, 0.026, 0.055)), onAirMat);
  onAirBtn.position.set(-0.25, 0.044, 0.075);
  switcherGroup.add(onAirBtn);

  let vuZeroed = false;
  let screensDirty = true;
  let lastVideoSec = -1;
  let lastScreenFlushMs = -Infinity;
  let lastShadowFaderZ = null;
  let lastShadowLive = null;

  function updateVuMeters() {
    if (!state.micOn && vuZeroed) return;
    vuZeroed = !state.micOn;
    const baseLevel = state.micOn
      ? Math.max(8, Math.min(100, state.audioLevel + Math.sin(state.vuPhase) * 8 + Math.cos(state.vuPhase * 1.7) * 5))
      : 0;
    const rightLevel = state.micOn
      ? Math.max(8, Math.min(100, state.audioLevel + Math.cos(state.vuPhase * 1.2) * 8))
      : 0;
    const levels = [baseLevel, rightLevel];
    vuColumns.forEach((col, sideIdx) => {
      const lvl = levels[sideIdx];
      col.forEach((seg) => {
        const lit = state.micOn && lvl >= seg.threshold - 6;
        seg.mat.color.set(lit ? seg.color : '#1e293b');
        seg.mat.emissiveIntensity = lit ? 1.5 : 0.04;
      });
    });
  }

  function flushScreens(forceAll = false) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!forceAll && now - lastScreenFlushMs < CANVAS_THROTTLE_MS) {
      return;
    }
    lastScreenFlushMs = now;
    const curSec = Math.floor(state.elapsedSec);
    if (forceAll || screensDirty || state.micOn) {
      audioScreen.update(state);
    }
    if (forceAll || screensDirty || curSec !== lastVideoSec) {
      lastVideoSec = curSec;
      videoScreen.update(state);
    }
    if (forceAll || screensDirty || state.dmxPower) {
      cam1Screen.update(state);
    }
    cam2Screen.update(state);
    screensDirty = false;
  }

  function sync3D() {
    const presetSpec = JPO_AV_PRESETS.find((p) => p.id === state.dmxPreset) || JPO_AV_PRESETS[0];

    const faderZ = 0.22 - (state.audioLevel / 100) * 0.18;
    faderKnobs.forEach((fk) => {
      if (fk.isMic || fk.isMaster) {
        fk.mesh.position.z = faderZ;
      }
    });
    micFaderMat.color.set(state.micOn ? '#4ade80' : '#38bdf8');
    micFaderMat.emissive.set(state.micOn ? '#16a34a' : '#0369a1');
    micButtonMat.color.set(state.micOn ? '#22c55e' : '#ef4444');
    micButtonMat.emissive.set(state.micOn ? '#16a34a' : '#991b1b');
    micButtonMat.emissiveIntensity = state.micOn ? 1.4 : 0.35;

    const lightFactor = state.dmxPower ? state.dmxIntensity / 100 : 0;
    const firstSpot = dmxSpots[0];
    if (firstSpot) {
      firstSpot.lensMat.emissive.set(presetSpec.color);
      firstSpot.lensMat.emissiveIntensity = state.dmxPower ? 0.45 + lightFactor * 1.85 : 0.04;
      firstSpot.coneMat.color.set(presetSpec.color);
      firstSpot.coneMat.opacity = state.dmxPower ? 0.09 + lightFactor * 0.28 : 0;
      firstSpot.coreConeMat.color.set(presetSpec.color);
      firstSpot.coreConeMat.opacity = state.dmxPower ? 0.04 + lightFactor * 0.18 : 0;
    }
    for (const sp of dmxSpots) {
      sp.spot.color.set(presetSpec.color);
      sp.spot.intensity = state.dmxPower ? 1.2 + lightFactor * 4.2 : 0;
    }

    stageHaloMat.color.set(presetSpec.color);
    stageHaloMat.opacity = state.dmxPower ? 0.18 + lightFactor * 0.55 : 0;
    stageBounceLight.color.set(presetSpec.color);
    stageBounceLight.intensity = state.dmxPower ? 0.9 + lightFactor * 1.6 : 0.7;
    wallLightBarMat.color.set(state.dmxPower ? presetSpec.color : '#38bdf8');
    wallLightBarMat.emissive.set(state.dmxPower ? presetSpec.color : '#38bdf8');

    previewButtons.forEach((pb) => {
      const sel = pb.srcId === state.videoSource;
      pb.mat.color.set(sel ? '#22c55e' : '#14532d');
      pb.mat.emissiveIntensity = sel ? 1.45 : 0.08;
    });
    programButtons.forEach((gb) => {
      const liveSel = state.videoLive && gb.srcId === state.videoSource;
      gb.mat.color.set(liveSel ? '#ef4444' : '#450a0a');
      gb.mat.emissiveIntensity = liveSel ? 1.65 : 0.06;
    });

    tBarArm.rotation.x = state.videoLive ? -0.35 : 0.35;
    onAirMat.color.set(state.videoLive ? '#ef4444' : '#450a0a');
    onAirMat.emissive.set(state.videoLive ? '#dc2626' : '#7f1d1d');
    onAirMat.emissiveIntensity = state.videoLive ? 1.65 : 0.08;
    tallyBarMat.color.set(state.videoLive ? '#ef4444' : '#475569');
    tallyBarMat.emissive.set(state.videoLive ? '#dc2626' : '#000000');
    tallyBarMat.emissiveIntensity = state.videoLive ? 1.5 : 0;

    if (faderZ !== lastShadowFaderZ || state.videoLive !== lastShadowLive) {
      lastShadowFaderZ = faderZ;
      lastShadowLive = state.videoLive;
      bench.requestShadowUpdate();
    }

    vuZeroed = false;
    updateVuMeters();
    screensDirty = true;
    flushScreens(false);
  }

  function syncStagePills(ev) {
    api.setStages?.(
      [
        { name: ev.audioOk ? '1. Son ✔' : '1. Son' },
        { name: ev.dmxOk ? '2. Lumière DMX ✔' : '2. Lumière DMX' },
        { name: ev.videoOk ? '3. Vidéo ✔' : '3. Vidéo' }
      ],
      ev.audioOk ? (ev.dmxOk ? 2 : 1) : 0,
      (idx) => {
        setCameraById(idx === 0 ? 'audio' : idx === 1 ? 'dmx' : 'video');
      }
    );
  }

  function submitJpoAvTp() {
    if (state.submitted) return;
    state.submitted = true;
    const ev = evaluateJpoAudiovisuelState(state);
    api.finishTp(
      ev.score,
      `
        <p>Régie Audiovisuelle vérifiée par le <strong>Professeur CIEL</strong> :</p>
        <ul>
          <li>1. Son : <strong>${ev.micOn ? 'Micro allumé' : 'Micro coupé'} • Volume ${ev.audioLevel}%</strong></li>
          <li>2. Lumière DMX : <strong>${ev.dmxPower ? 'Projecteurs allumés' : 'Éteints'} • ${ev.dmxIntensity}% (${ev.dmxPreset})</strong></li>
          <li>3. Vidéo : <strong>${ev.videoSource} • ${ev.videoLive ? 'Diffusion EN DIRECT ✔' : 'Hors antenne'}</strong></li>
        </ul>
      `,
      ev.breakdown
    );
  }

  function updateSidebar() {
    const ev = evaluateJpoAudiovisuelState(state);
    const presetBtns = JPO_AV_PRESETS.map(
      (p) =>
        `<button type="button" class="jpo-av-btn ${state.dmxPreset === p.id ? 'active' : ''}" data-preset="${p.id}">${p.label}</button>`
    ).join('');
    const sourceBtns = JPO_AV_SOURCES.map(
      (src) =>
        `<button type="button" class="jpo-av-btn ${state.videoSource === src.id ? 'active' : ''}" data-source="${src.id}">${src.label}</button>`
    ).join('');

    const drawer = bench.setSideDrawer(`
      <div class="jpo-av-drawer">
        <div class="jpo-av-advice" id="jpo-av-advice">${ev.advice}</div>

        <div class="jpo-av-card ${ev.audioOk ? 'ok' : ''}" id="jpo-av-card-audio">
          <div class="jpo-av-card-head">
            <span>1. Réglage du son</span>
            <strong id="jpo-av-badge-audio">${ev.audioOk ? '✅ OK' : '⏳ À régler'}</strong>
          </div>
          <div class="jpo-av-btn-row">
            <button type="button" id="jpo-av-mic-btn" class="jpo-av-btn ${state.micOn ? 'success' : ''}">
              ${state.micOn ? '🎙️ Micro ALLUMÉ' : '🔇 Allumer le micro'}
            </button>
          </div>
          <label class="jpo-av-slider-row">
            <span>Volume (zone verte 65-85%)</span>
            <input type="range" id="jpo-av-audio-range" min="0" max="100" value="${state.audioLevel}" />
            <strong id="jpo-av-audio-val">${state.audioLevel}%</strong>
          </label>
        </div>

        <div class="jpo-av-card ${ev.dmxOk ? 'ok' : ''}" id="jpo-av-card-dmx">
          <div class="jpo-av-card-head">
            <span>2. Lumière DMX</span>
            <strong id="jpo-av-badge-dmx">${ev.dmxOk ? '✅ OK' : '⏳ À régler'}</strong>
          </div>
          <div class="jpo-av-btn-row">
            <button type="button" id="jpo-av-dmx-btn" class="jpo-av-btn ${state.dmxPower ? 'success' : ''}">
              ${state.dmxPower ? '💡 Projecteurs ALLUMÉS' : '💡 Allumer les projecteurs'}
            </button>
          </div>
          <div class="jpo-av-btn-row">${presetBtns}</div>
          <label class="jpo-av-slider-row">
            <span>Puissance (min. 70%)</span>
            <input type="range" id="jpo-av-dmx-range" min="0" max="100" value="${state.dmxIntensity}" />
            <strong id="jpo-av-dmx-val">${state.dmxIntensity}%</strong>
          </label>
        </div>

        <div class="jpo-av-card ${ev.videoOk ? 'ok' : ''}" id="jpo-av-card-video">
          <div class="jpo-av-card-head">
            <span>3. Signal vidéo</span>
            <strong id="jpo-av-badge-video">${ev.videoOk ? '✅ OK' : '⏳ À régler'}</strong>
          </div>
          <div class="jpo-av-btn-row">${sourceBtns}</div>
          <div class="jpo-av-btn-row">
            <button type="button" id="jpo-av-live-btn" class="jpo-av-btn ${state.videoLive ? 'live' : 'primary'}">
              ${state.videoLive ? '🔴 EN DIRECT (Actif)' : '📺 Passer EN DIRECT'}
            </button>
          </div>
        </div>
      </div>
    `);

    if (!drawer) return;
    drawer.querySelector('#jpo-av-mic-btn')?.addEventListener('click', () => {
      state.micOn = !state.micOn;
      sfx.click();
      sync3D();
      refreshUi();
    });
    drawer.querySelector('#jpo-av-dmx-btn')?.addEventListener('click', () => {
      state.dmxPower = !state.dmxPower;
      sfx.click();
      sync3D();
      refreshUi();
    });
    drawer.querySelector('#jpo-av-live-btn')?.addEventListener('click', () => {
      state.videoLive = !state.videoLive;
      sfx.interact();
      sync3D();
      refreshUi();
    });
    drawer.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.dmxPreset = btn.dataset.preset;
        sfx.click();
        sync3D();
        refreshUi();
      });
    });
    drawer.querySelectorAll('[data-source]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.videoSource = btn.dataset.source;
        sfx.click();
        sync3D();
        refreshUi();
      });
    });
    drawer.querySelector('#jpo-av-audio-range')?.addEventListener('input', (e) => {
      state.audioLevel = Number(e.target.value);
      sync3D();
      syncLiveValues();
    });
    drawer.querySelector('#jpo-av-audio-range')?.addEventListener('change', () => refreshUi());
    drawer.querySelector('#jpo-av-dmx-range')?.addEventListener('input', (e) => {
      state.dmxIntensity = Number(e.target.value);
      sync3D();
      syncLiveValues();
    });
    drawer.querySelector('#jpo-av-dmx-range')?.addEventListener('change', () => refreshUi());
  }

  function syncLiveValues() {
    const ev = evaluateJpoAudiovisuelState(state);
    bench.setInstruction(
      'RÉGIE AUDIOVISUELLE • DÉCOUVERTE',
      `Étapes validées : ${ev.completedSteps} / 3`,
      ev.advice
    );
    bench.setAccuracy(`${ev.score.toFixed(1)} / 20`);
    syncStagePills(ev);
    const advEl = api.container.querySelector('#jpo-av-advice');
    if (advEl) advEl.textContent = ev.advice;
    const audioVal = api.container.querySelector('#jpo-av-audio-val');
    if (audioVal) audioVal.textContent = `${state.audioLevel}%`;
    const dmxVal = api.container.querySelector('#jpo-av-dmx-val');
    if (dmxVal) dmxVal.textContent = `${state.dmxIntensity}%`;
    const audioBadge = api.container.querySelector('#jpo-av-badge-audio');
    if (audioBadge) audioBadge.textContent = ev.audioOk ? '✅ OK' : '⏳ À régler';
    const dmxBadge = api.container.querySelector('#jpo-av-badge-dmx');
    if (dmxBadge) dmxBadge.textContent = ev.dmxOk ? '✅ OK' : '⏳ À régler';
    const videoBadge = api.container.querySelector('#jpo-av-badge-video');
    if (videoBadge) videoBadge.textContent = ev.videoOk ? '✅ OK' : '⏳ À régler';
    api.container.querySelector('#jpo-av-card-audio')?.classList.toggle('ok', ev.audioOk);
    api.container.querySelector('#jpo-av-card-dmx')?.classList.toggle('ok', ev.dmxOk);
    api.container.querySelector('#jpo-av-card-video')?.classList.toggle('ok', ev.videoOk);
  }

  function refreshUi() {
    const ev = evaluateJpoAudiovisuelState(state);
    bench.setInstruction(
      'RÉGIE AUDIOVISUELLE • DÉCOUVERTE',
      `Étapes validées : ${ev.completedSteps} / 3`,
      ev.advice
    );
    bench.setAccuracy(`${ev.score.toFixed(1)} / 20`);
    syncStagePills(ev);

    bench.setTools(
      [
        { id: 'mic', icon: '🎙️', label: state.micOn ? 'Micro ON' : 'Allumer Micro' },
        { id: 'dmx', icon: '💡', label: state.dmxPower ? 'Lumières ON' : 'Allumer DMX' },
        { id: 'live', icon: '📺', label: state.videoLive ? 'DIRECT ON' : 'Passer DIRECT' }
      ],
      state.micOn ? (state.dmxPower ? (state.videoLive ? 'live' : 'dmx') : 'mic') : '',
      (toolId) => {
        if (toolId === 'mic') state.micOn = !state.micOn;
        if (toolId === 'dmx') state.dmxPower = !state.dmxPower;
        if (toolId === 'live') state.videoLive = !state.videoLive;
        sync3D();
        refreshUi();
      }
    );

    bench.setActions([
      {
        id: 'jpo-av-finish',
        label: ev.allValid ? '✅ Valider le spectacle' : '✅ Terminer',
        primary: ev.allValid,
        disabled: state.submitted,
        onClick: submitJpoAvTp
      },
      {
        id: 'jpo-av-hint',
        label: '💡 Astuce',
        onClick: () => {
          bench.showToast(
            '1) Allume le micro + volume entre 65% et 85%. 2) Allume les projecteurs + Spectacle Violet + 70% min. 3) Choisis Caméra 1 et passe EN DIRECT !',
            'info'
          );
        }
      },
      {
        id: 'jpo-av-reset',
        label: '🔄 Recommencer',
        onClick: () => {
          state.micOn = false;
          state.audioLevel = 35;
          state.dmxPower = false;
          state.dmxIntensity = 30;
          state.dmxPreset = 'concert';
          state.videoSource = 'CAM-2';
          state.videoLive = false;
          state.submitted = false;
          sync3D();
          refreshUi();
        }
      }
    ]);

    updateSidebar();
  }

  bench.addFloatingTag([-0.92, 0.56, -0.06], '1. Console Son', 'info');
  bench.addFloatingTag([0, 1.14, -0.44], '2. Projecteurs DMX', 'info');
  bench.addFloatingTag([1.04, 0.72, -0.1], '3. Régie Vidéo', 'info');

  let vuAccum = 0;
  const unsubTick = bench.addUpdate((dt) => {
    state.vuPhase += dt * 5;
    state.elapsedSec += dt;
    vuAccum += dt;
    rackLeds.forEach((rl) => {
      rl.mat.emissiveIntensity = 0.5 + 0.5 * Math.sin(state.vuPhase * 0.6 + rl.phase);
    });
    if (vuAccum >= CANVAS_THROTTLE_SEC) {
      vuAccum = 0;
      updateVuMeters();
      flushScreens(false);
    }
  });

  bench.freezeStatic([
    ...faderKnobs.filter((fk) => fk.isMic || fk.isMaster).map((fk) => fk.mesh),
    tBarArm
  ]);

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
