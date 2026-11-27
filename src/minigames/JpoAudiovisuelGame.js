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
    vuPhase: 0
  };

  const bench = createWorkbench3D(api.container, {
    background: '#0b1220',
    wallColor: '#0f172a',
    benchColor: '#1e293b',
    benchWidth: 3.6,
    benchDepth: 2.0,
    cameraPos: [0, 1.38, 2.25],
    lookAt: [0, 0.32, -0.05],
    fov: 42
  });

  const presets = [
    { id: 'overview', label: '🎛️ Vue Régie', pos: [0, 1.38, 2.25], lookAt: [0, 0.32, -0.05] },
    { id: 'audio', label: '🎙️ Son', pos: [-0.82, 0.85, 1.18], lookAt: [-0.72, 0.22, 0.1] },
    { id: 'dmx', label: '💡 Lumière DMX', pos: [0, 1.05, 1.45], lookAt: [0, 0.55, -0.35] },
    { id: 'video', label: '📺 Vidéo', pos: [0.82, 0.92, 1.25], lookAt: [0.72, 0.34, -0.1] }
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

  const darkMat = bench.track(new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.42, metalness: 0.58 }));
  const metalMat = bench.track(new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.35, metalness: 0.72 }));

  const audioGroup = new THREE.Group();
  audioGroup.position.set(-0.74, 0, 0.14);
  bench.scene.add(audioGroup);

  const mixerBody = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.68, 0.1, 0.54)), darkMat);
  mixerBody.position.y = 0.05;
  mixerBody.rotation.x = 0.14;
  mixerBody.castShadow = true;
  audioGroup.add(mixerBody);

  const faderKnobMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0284c7', emissiveIntensity: 0.4 })
  );
  const faderKnob = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.08, 0.045, 0.06)), faderKnobMat);
  faderKnob.position.set(-0.1, 0.075, 0.05);
  mixerBody.add(faderKnob);

  const micLedMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#991b1b', emissiveIntensity: 0.5 })
  );
  const micLed = new THREE.Mesh(bench.track(new THREE.SphereGeometry(0.024, 10, 10)), micLedMat);
  micLed.position.set(-0.22, 0.07, -0.15);
  mixerBody.add(micLed);

  const audioScreen = makeCanvasScreen(320, 180, (ctx, w, h, st) => {
    const s = st || state;
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('CONSOLE SON', 16, 26);
    ctx.fillStyle = s.micOn ? '#4ade80' : '#f87171';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(s.micOn ? 'MICRO : ALLUMÉ' : 'MICRO : COUPÉ', 16, 52);
    const barW = w - 32;
    const fillRatio = s.micOn ? Math.min(1, Math.max(0.04, (s.audioLevel + Math.sin(s.vuPhase) * 4) / 100)) : 0.03;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(16, 78, barW, 30);
    ctx.fillStyle = 'rgba(34, 197, 94, 0.25)';
    ctx.fillRect(16 + barW * 0.65, 74, barW * 0.2, 38);
    const inGreen = s.audioLevel >= JPO_AV_TARGET.minAudio && s.audioLevel <= JPO_AV_TARGET.maxAudio;
    ctx.fillStyle = s.micOn ? (inGreen ? '#22c55e' : s.audioLevel > 85 ? '#ef4444' : '#38bdf8') : '#475569';
    ctx.fillRect(16, 78, barW * fillRatio, 30);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`Niveau : ${s.audioLevel}%`, 16, 145);
  });
  bench.track(audioScreen.texture);
  const audioDisplay = new THREE.Mesh(
    bench.track(new THREE.PlaneGeometry(0.48, 0.24)),
    bench.track(new THREE.MeshBasicMaterial({ map: audioScreen.texture }))
  );
  audioDisplay.position.set(0, 0.32, -0.22);
  audioGroup.add(audioDisplay);

  const trussGroup = new THREE.Group();
  trussGroup.position.set(0, 0, -0.35);
  bench.scene.add(trussGroup);

  const leftPillar = new THREE.Mesh(bench.track(new THREE.CylinderGeometry(0.03, 0.035, 0.92, 10)), metalMat);
  leftPillar.position.set(-0.56, 0.46, 0);
  trussGroup.add(leftPillar);
  const rightPillar = new THREE.Mesh(bench.track(new THREE.CylinderGeometry(0.03, 0.035, 0.92, 10)), metalMat);
  rightPillar.position.set(0.56, 0.46, 0);
  trussGroup.add(rightPillar);
  const topBar = new THREE.Mesh(bench.track(new THREE.BoxGeometry(1.24, 0.05, 0.06)), metalMat);
  topBar.position.set(0, 0.92, 0);
  trussGroup.add(topBar);

  const dmxSpots = [];
  for (let i = -1; i <= 1; i++) {
    const housing = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.16, 0.14, 0.18)), darkMat);
    housing.position.set(i * 0.36, 0.82, 0.04);
    housing.rotation.x = 0.35;
    trussGroup.add(housing);

    const lensMat = bench.track(
      new THREE.MeshStandardMaterial({ color: '#1e293b', emissive: '#c084fc', emissiveIntensity: 0 })
    );
    const lens = new THREE.Mesh(bench.track(new THREE.CylinderGeometry(0.052, 0.052, 0.02, 14)), lensMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0, 0.095);
    housing.add(lens);

    const coneMat = bench.track(
      new THREE.MeshBasicMaterial({
        color: '#c084fc',
        transparent: true,
        opacity: 0,
        depthWrite: false
      })
    );
    const cone = new THREE.Mesh(bench.track(new THREE.ConeGeometry(0.28, 0.88, 16, 1, true)), coneMat);
    cone.rotation.x = -Math.PI / 2;
    cone.position.set(0, 0, 0.54);
    housing.add(cone);

    const spot = new THREE.SpotLight('#c084fc', 0, 4.5, 0.55, 0.55);
    spot.position.set(i * 0.36, 0.8, 0.08);
    spot.target.position.set(i * 0.28, 0, 0.45);
    trussGroup.add(spot);
    trussGroup.add(spot.target);
    dmxSpots.push({ lensMat, coneMat, spot });
  }

  const stagePad = new THREE.Mesh(
    bench.track(new THREE.BoxGeometry(0.95, 0.04, 0.55)),
    bench.track(new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.45 }))
  );
  stagePad.position.set(0, 0.02, 0.16);
  stagePad.receiveShadow = true;
  bench.scene.add(stagePad);

  const videoGroup = new THREE.Group();
  videoGroup.position.set(0.74, 0, -0.02);
  bench.scene.add(videoGroup);

  const monitorFrame = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.84, 0.52, 0.06)), darkMat);
  monitorFrame.position.set(0, 0.34, -0.14);
  monitorFrame.castShadow = true;
  videoGroup.add(monitorFrame);

  const videoScreen = makeCanvasScreen(420, 260, (ctx, w, h, st) => {
    const s = st || state;
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('RÉGIE VIDÉO • ÉCRAN PRINCIPAL', 16, 26);

    ctx.fillStyle = s.videoLive ? '#ef4444' : '#334155';
    ctx.fillRect(w - 122, 10, 106, 26);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(s.videoLive ? '● EN DIRECT' : '○ EN VEILLE', w - 112, 28);

    const cards = [
      { id: 'CAM-1', title: 'Caméra 1', sub: 'Scène', x: 16 },
      { id: 'CAM-2', title: 'Caméra 2', sub: 'Public', x: 148 },
      { id: 'SLIDES', title: 'Diaporama', sub: 'Écran', x: 280 }
    ];
    for (const c of cards) {
      const selected = s.videoSource === c.id;
      ctx.fillStyle = selected ? '#312e81' : '#111827';
      ctx.fillRect(c.x, 48, 120, 74);
      ctx.strokeStyle = selected ? '#a855f7' : '#334155';
      ctx.lineWidth = selected ? 3 : 1.5;
      ctx.strokeRect(c.x, 48, 120, 74);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(c.title, c.x + 12, 82);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px sans-serif';
      ctx.fillText(c.sub, c.x + 12, 104);
    }

    ctx.fillStyle = s.videoLive ? '#14532d' : '#0f172a';
    ctx.fillRect(16, 138, w - 32, 106);
    ctx.strokeStyle = s.videoLive ? '#22c55e' : '#475569';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(16, 138, w - 32, 106);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`DIFFUSION : ${s.videoSource}`, 34, 186);
    ctx.fillStyle = s.videoLive ? '#86efac' : '#cbd5e1';
    ctx.font = '14px sans-serif';
    ctx.fillText(
      s.videoLive ? 'Signal envoyé vers la salle !' : 'Clique sur « Passer EN DIRECT » pour diffuser.',
      34,
      218
    );
  });
  bench.track(videoScreen.texture);
  const monitorFace = new THREE.Mesh(
    bench.track(new THREE.PlaneGeometry(0.76, 0.44)),
    bench.track(new THREE.MeshBasicMaterial({ map: videoScreen.texture }))
  );
  monitorFace.position.set(0, 0.34, -0.108);
  videoGroup.add(monitorFace);

  const switcherPad = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.56, 0.06, 0.26)), darkMat);
  switcherPad.position.set(0, 0.03, 0.14);
  videoGroup.add(switcherPad);

  const onAirMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#334155', emissive: '#000000', emissiveIntensity: 0 })
  );
  const onAirBtn = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.14, 0.03, 0.08)), onAirMat);
  onAirBtn.position.set(0.15, 0.04, 0);
  switcherPad.add(onAirBtn);

  function sync3D() {
    const presetSpec = JPO_AV_PRESETS.find((p) => p.id === state.dmxPreset) || JPO_AV_PRESETS[0];
    faderKnob.position.z = 0.16 - (state.audioLevel / 100) * 0.26;
    faderKnobMat.color.set(state.micOn ? '#4ade80' : '#38bdf8');
    faderKnobMat.emissive.set(state.micOn ? '#16a34a' : '#0369a1');
    micLedMat.color.set(state.micOn ? '#22c55e' : '#ef4444');
    micLedMat.emissive.set(state.micOn ? '#16a34a' : '#991b1b');

    const lightFactor = state.dmxPower ? state.dmxIntensity / 100 : 0;
    for (const sp of dmxSpots) {
      sp.lensMat.emissive.set(presetSpec.color);
      sp.lensMat.emissiveIntensity = state.dmxPower ? 0.4 + lightFactor * 1.6 : 0.04;
      sp.coneMat.color.set(presetSpec.color);
      sp.coneMat.opacity = state.dmxPower ? 0.08 + lightFactor * 0.26 : 0;
      sp.spot.color.set(presetSpec.color);
      sp.spot.intensity = state.dmxPower ? 0.8 + lightFactor * 3.8 : 0;
    }

    onAirMat.color.set(state.videoLive ? '#ef4444' : '#334155');
    onAirMat.emissive.set(state.videoLive ? '#dc2626' : '#000000');
    onAirMat.emissiveIntensity = state.videoLive ? 1.2 : 0;

    audioScreen.update(state);
    videoScreen.update(state);
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

  bench.addFloatingTag([-0.74, 0.45, -0.08], '1. Console Son', 'info');
  bench.addFloatingTag([0, 1.02, -0.35], '2. Projecteurs DMX', 'info');
  bench.addFloatingTag([0.74, 0.62, -0.14], '3. Régie Vidéo', 'info');

  let vuAccum = 0;
  const unsubTick = bench.addUpdate((dt) => {
    state.vuPhase += dt * 5;
    vuAccum += dt;
    if (vuAccum >= 0.08) {
      vuAccum = 0;
      audioScreen.update(state);
    }
  });

  sync3D();
  setCameraById('overview');
  refreshUi();

  return {
    destroy: () => {
      unsubTick();
      bench.destroy();
    }
  };
}
