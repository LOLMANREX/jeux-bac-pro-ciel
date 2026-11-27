import * as THREE from 'three';
import { sfx } from '../core/audio.js';
import { toSafeNumber, finalizeGrade20, createGradeBreakdown } from '../core/grading.js';
import {
  createWorkbench3D,
  makeCanvasScreen,
  buildFlexibleCable
} from './Workbench3DHost.js';
import { createVirtualKeypad } from './TouchTpHelpers.js';

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

export const AV_STAGES = [
  {
    id: 1,
    name: '1. Adware & Cheval de Troie',
    brief:
      'Le PC de TP est envahi de popups ! 1) Coupez le réseau pour stopper les malwares, 2) Tuez les processus suspects, 3) Installez l’antivirus CielGuard, mettez à jour sa base et lancez le scan complet !',
    processes: [
      { pid: 412, name: 'explorer.exe', cpu: 2, legit: true, desc: 'Interface Bureau' },
      { pid: 884, name: 'ciel_tp_viewer.exe', cpu: 4, legit: true, desc: 'Lecteur de TP' },
      { pid: 1337, name: 'adware_popup_hd.exe', cpu: 42, legit: false, desc: 'Éditeur inconnu' },
      { pid: 2048, name: 'trojan_facture.exe', cpu: 36, legit: false, desc: 'Temp/Downloads' }
    ],
    ports: [{ port: 8080, label: 'Proxy inconnu OUT', bad: true }],
    startup: [],
    files: [
      { path: 'C:\\Users\\Eleve\\Downloads\\facture_pdf.exe', threat: 'Trojan.Win32.Dropper', bad: true },
      { path: 'C:\\ProgramData\\PopBoost\\adware.dll', threat: 'Adware.Win32.PopBoost', bad: true },
      { path: 'C:\\CIEL\\TP_Cours_Reseau.pdf', threat: 'Sain (Document de cours)', bad: false }
    ]
  },
  {
    id: 2,
    name: '2. Ransomware & Pare-feu',
    brief:
      'Alerte critique : un CryptoLocker chiffre les documents et exfiltre sur le port 4444 ! Isolez le réseau, fermez le port malveillant au pare-feu, tuez le processus chiffreurs, puis nettoyez à l’antivirus.',
    processes: [
      { pid: 310, name: 'winlogon.exe', cpu: 1, legit: true, desc: 'Session Windows' },
      { pid: 720, name: 'CielGuard_Agent', cpu: 3, legit: true, desc: 'Service Sécurité' },
      { pid: 3190, name: 'cryptolocker_v3.exe', cpu: 64, legit: false, desc: 'Chiffrement actif !' },
      { pid: 3402, name: 'ncat_reverse.exe', cpu: 19, legit: false, desc: 'Shell distant C2' }
    ],
    ports: [
      { port: 443, label: 'HTTPS Sortant (Légitime)', bad: false },
      { port: 4444, label: 'Metasploit / C2 Outbound', bad: true },
      { port: 6667, label: 'IRC Botnet Outbound', bad: true }
    ],
    startup: [{ id: 'st1', name: 'RunOnce_Crypto', cmd: 'C:\\Temp\\cryptolocker_v3.exe', bad: true }],
    files: [
      { path: 'C:\\Temp\\cryptolocker_v3.exe', threat: 'Ransom.Win32.Locker', bad: true },
      { path: 'C:\\Temp\\ncat_reverse.exe', threat: 'Backdoor.ReverseShell', bad: true },
      { path: 'C:\\Users\\Eleve\\Desktop\\key_dump.bin', threat: 'Spyware.CredHarvester', bad: true },
      { path: 'C:\\Windows\\System32\\drivers\\tcpip.sys', threat: 'Sain (Pilote Système)', bad: false }
    ]
  },
  {
    id: 3,
    name: '3. Rootkit & Persistance SOC',
    brief:
      'Attention aux noms piégés (typosquatting) comme « svch0st.exe » avec un zéro ! Éliminez le faux processus système, désactivez la tâche planifiée malveillante, bloquez le port C2 et mettez toutes les menaces en quarantaine.',
    processes: [
      { pid: 500, name: 'svchost.exe', cpu: 2, legit: true, desc: 'C:\\Windows\\System32' },
      { pid: 504, name: 'svch0st.exe', cpu: 31, legit: false, desc: 'C:\\Users\\Public\\Temp (PIÈGE !)' },
      { pid: 990, name: 'keylogger_sys.exe', cpu: 18, legit: false, desc: 'Capture clavier' },
      { pid: 1120, name: 'lsass.exe', cpu: 1, legit: true, desc: 'Autorité sécurité locale' }
    ],
    ports: [
      { port: 53, label: 'DNS Standard', bad: false },
      { port: 31337, label: 'Backdoor Rootkit C2', bad: true }
    ],
    startup: [
      { id: 'st2', name: 'WindowsDefenderSvc', cmd: 'C:\\Program Files\\Defender\\svc.exe', bad: false },
      { id: 'st3', name: 'Update_Powershell_B64', cmd: 'powershell -enc JABj...', bad: true }
    ],
    files: [
      { path: 'C:\\Users\\Public\\Temp\\svch0st.exe', threat: 'Trojan.Spy.Masquerade', bad: true },
      { path: 'C:\\ProgramData\\kl\\keylogger_sys.exe', threat: 'Spyware.Keylogger', bad: true },
      { path: 'C:\\Windows\\System32\\svchost.exe', threat: 'Sain (Binaire Microsoft)', bad: false }
    ]
  }
];

export function evaluateAntivirusStage(state) {
  const badProcsAlive = state.processes.filter((p) => !p.legit && p.alive).length;
  const badPortsOpen = state.ports.filter((p) => p.bad && p.open).length;
  const badStartupActive = state.startup.filter((s) => s.bad && s.enabled).length;
  const badFilesLeft = state.files.filter((f) => f.bad && !f.quarantined).length;

  const clean =
    state.avInstalled &&
    state.avUpdated &&
    state.scanDone &&
    badProcsAlive === 0 &&
    badPortsOpen === 0 &&
    badStartupActive === 0 &&
    badFilesLeft === 0;

  return {
    clean,
    badProcsAlive,
    badPortsOpen,
    badStartupActive,
    badFilesLeft
  };
}

export function computeSocDefenseScore3D(metrics = {}) {
  const m = metrics && typeof metrics === 'object' ? metrics : {};
  const isolated = Boolean(m.isolatedCompromised);
  const fwTotal = Math.max(1, toSafeNumber(m.firewallTotal, 3));
  const fwDone = Math.max(0, Math.min(fwTotal, toSafeNumber(m.firewallBlockedCount, 0)));
  const cveTotal = Math.max(1, toSafeNumber(m.cveTotal, 3));
  const cveDone = Math.max(0, Math.min(cveTotal, toSafeNumber(m.cvePatchedCount, 0)));
  const edrScanDone = Boolean(m.edrScanDone);
  const integ = Math.max(0, Math.min(100, toSafeNumber(m.integrityRemaining, 0)));
  const mistakes = Math.max(0, Math.floor(toSafeNumber(m.mistakes, 0)));
  const elapsed = Math.max(0, toSafeNumber(m.elapsedSec, 90));

  const isoPts = isolated ? 4.0 : 0;
  const fwPts = (fwDone / fwTotal) * 5.0;
  const cvePts = (cveDone / cveTotal) * 5.0;
  const edrPts = edrScanDone ? 3.0 : 0;
  const integPts = integ >= 60 ? 3.0 : (integ / 60) * 3.0;

  const hasCriticalError = !isolated || fwDone < fwTotal || cveDone < cveTotal || !edrScanDone;
  const forgivenMistakes = !hasCriticalError ? Math.min(1, mistakes) : 0;
  const billedMistakes = Math.max(0, mistakes - forgivenMistakes);
  const mistakePenalty = Math.min(2.25, billedMistakes * 0.75);
  const timePenalty = elapsed > 360 ? Math.min(0.5, ((elapsed - 360) / 180) * 0.5) : 0;

  const rawScore = Math.max(
    0,
    isoPts + fwPts + cvePts + edrPts + integPts - mistakePenalty - timePenalty
  );
  const score = finalizeGrade20(rawScore, { hasCriticalError });
  const xp = Math.max(50, Math.round(score * 16 + (integ >= 60 ? 60 : 20)));
  const accuracy = Math.round((score / 20) * 100);

  const items = [
    { label: 'Isolation réseau du poste PC-WORK', earned: isoPts, max: 4.0 },
    { label: `Règles Pare-feu FW-01 (${fwDone}/${fwTotal})`, earned: fwPts, max: 5.0 },
    { label: `Correctifs CVE & processus (${cveDone}/${cveTotal})`, earned: cvePts, max: 5.0 },
    { label: 'Scan laser CielGuard EDR complet', earned: edrPts, max: 3.0 },
    {
      label: `Intégrité infrastructure (${Math.round(integ)}%)`,
      earned: integPts,
      max: 3.0,
      detail: 'Cible ≥ 60%'
    }
  ];

  const penalties = [];
  if (mistakes > 0) {
    penalties.push({
      label:
        billedMistakes === 0
          ? `Faux positif processus (${mistakes})`
          : `Faux positifs processus (${billedMistakes} facturé(s), 1 offert)`,
      points: mistakePenalty,
      forgivenCount: forgivenMistakes
    });
  }
  if (timePenalty > 0) {
    penalties.push({
      label: `Dépassement temps confortable (${Math.round(elapsed)}s > 360s)`,
      points: Math.round(timePenalty * 100) / 100,
      forgivenCount: 0
    });
  }

  let tip = '';
  if (!isolated) tip = 'Isolez PC-WORK dès le début pour bloquer la propagation latérale.';
  else if (fwDone < fwTotal) tip = 'Bloquez les 3 règles critiques sur le pare-feu FW-01.';
  else if (cveDone < cveTotal) tip = 'Patchez SRV-WEB, SRV-BDD et supprimez svch0st.exe (avec zéro).';
  else if (!edrScanDone) tip = 'Lancez et terminez le scan laser CielGuard EDR.';
  else if (integ < 60) tip = 'Isolez rapidement PC-WORK pour garder ≥ 60% d’intégrité serveur.';
  else if (mistakePenalty > 0) tip = 'Ne tuez pas le processus légitime svchost.exe dans System32.';

  const breakdown = createGradeBreakdown({
    items,
    penalties,
    rawScore,
    finalScore: score,
    hasCriticalError,
    tip
  });

  return { score, xp, accuracy, rawScore, breakdown };
}

export function createAntivirusGame(api) {
  const isJpo = Boolean(
    api?.isJpo || (typeof document !== 'undefined' && document.body?.classList?.contains('jpo-mode'))
  );
  const bench = createWorkbench3D(api.container, {
    background: '#081122',
    wallColor: '#0c182e',
    benchColor: '#131f33',
    benchWidth: 4.2,
    benchDepth: 1.75,
    cameraPos: [0.0, 0.88, 1.24],
    lookAt: [0.0, 0.25, -0.08],
    fov: 40,
    envIntensity: 0.88,
    hasEsdMat: false
  });

  const socBlueLight = new THREE.PointLight('#38bdf8', 2.2, 8, 1.4);
  socBlueLight.position.set(-1.4, 1.65, 1.2);
  bench.scene.add(socBlueLight);

  const socAccentLight = new THREE.PointLight('#6366f1', 1.8, 8, 1.4);
  socAccentLight.position.set(1.5, 1.55, -0.8);
  bench.scene.add(socAccentLight);

  const socAlertLight = new THREE.PointLight('#ef4444', 1.5, 6.0, 1.5);
  socAlertLight.position.set(0, 1.1, -0.75);
  bench.scene.add(socAlertLight);

  const holoGlowLight = new THREE.PointLight('#38bdf8', 1.1, 2.8, 1.6);
  holoGlowLight.position.set(0, 0.22, 0.04);
  bench.scene.add(holoGlowLight);

  const darkFrame = bench.track(
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.42, metalness: 0.65 })
  );
  const socChassisMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.36, metalness: 0.62 })
  );
  const socMetalMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.28, metalness: 0.78 })
  );

  const socWallTex = bench.track(
    makeCanvasTexture(1024, 512, (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#071022');
      grad.addColorStop(0.55, '#0d1b36');
      grad.addColorStop(1, '#070d1a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      for (let x = 0; x < w; x += 32) {
        ctx.fillStyle = x % 64 === 0 ? 'rgba(15, 23, 42, 0.72)' : 'rgba(30, 41, 59, 0.38)';
        ctx.fillRect(x, 0, 20, h);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.09)';
        ctx.fillRect(x + 20, 0, 2, h);
      }

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.lineWidth = 1.5;
      for (let y = 40; y < h; y += 44) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
      ctx.fillRect(0, 36, w, 5);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.24)';
      ctx.fillRect(0, h - 46, w, 5);
    })
  );
  const socBackWall = new THREE.Mesh(
    bench.track(new THREE.PlaneGeometry(5.6, 2.6)),
    bench.track(new THREE.MeshStandardMaterial({ map: socWallTex, roughness: 0.68, metalness: 0.16 }))
  );
  socBackWall.position.set(0, 1.18, -0.92);
  socBackWall.receiveShadow = true;
  bench.scene.add(socBackWall);

  const socWallNeonMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 1.05 })
  );
  const socTopNeon = new THREE.Mesh(bench.track(new THREE.BoxGeometry(3.2, 0.018, 0.025)), socWallNeonMat);
  socTopNeon.position.set(0, 0.68, -0.89);
  bench.scene.add(socTopNeon);
  const socBotNeon = new THREE.Mesh(bench.track(new THREE.BoxGeometry(3.2, 0.016, 0.025)), socWallNeonMat);
  socBotNeon.position.set(0, 0.40, -0.89);
  bench.scene.add(socBotNeon);

  const socSignFrame = new THREE.Mesh(bench.track(new THREE.BoxGeometry(1.56, 0.24, 0.04)), darkFrame);
  socSignFrame.position.set(0, 0.54, -0.88);
  bench.scene.add(socSignFrame);

  const socSignScreen = makeCanvasScreen(760, 120, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, w, 0);
    bg.addColorStop(0, '#070e1d');
    bg.addColorStop(0.5, '#0f2042');
    bg.addColorStop(1, '#070e1d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CENTRE CYBERDÉFENSE • BAC PRO CIEL', w / 2, 54);

    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('SALLE DE CRISE SOC  •  PARE-FEU FW-01  •  CIELGUARD EDR', w / 2, 90);
    ctx.textAlign = 'left';
  });
  bench.track(socSignScreen.texture);
  const socSignFace = new THREE.Mesh(
    bench.track(new THREE.PlaneGeometry(1.48, 0.20)),
    bench.track(new THREE.MeshBasicMaterial({ map: socSignScreen.texture }))
  );
  socSignFace.position.set(0, 0.54, -0.858);
  bench.scene.add(socSignFace);

  const socRackLeds = [];
  const rackCabGeo = bench.track(new THREE.BoxGeometry(0.32, 0.48, 0.34));
  const rackRailGeo = bench.track(new THREE.BoxGeometry(0.016, 0.45, 0.016));
  const rackPlateGeo = bench.track(new THREE.BoxGeometry(0.26, 0.08, 0.014));
  const rackVentGeo = bench.track(new THREE.BoxGeometry(0.14, 0.04, 0.008));
  const rackLedGeo = bench.track(new THREE.SphereGeometry(0.0065, 8, 8));
  [-1, 1].forEach((side) => {
    const rackGrp = new THREE.Group();
    rackGrp.position.set(side * 1.04, 0, -0.34);
    rackGrp.rotation.y = side * -0.22;
    bench.scene.add(rackGrp);

    const cab = new THREE.Mesh(rackCabGeo, darkFrame);
    cab.position.set(0, 0.24, 0);
    cab.castShadow = true;
    rackGrp.add(cab);

    for (const rx of [-0.14, 0.14]) {
      const rail = new THREE.Mesh(rackRailGeo, socMetalMat);
      rail.position.set(rx, 0.24, 0.172);
      rackGrp.add(rail);
    }

    for (let u = 0; u < 4; u++) {
      const uy = 0.09 + u * 0.10;
      const plate = new THREE.Mesh(rackPlateGeo, socChassisMat);
      plate.position.set(0, uy, 0.172);
      rackGrp.add(plate);

      const vent = new THREE.Mesh(rackVentGeo, darkFrame);
      vent.position.set(-0.04, uy, 0.18);
      rackGrp.add(vent);

      for (let l = 0; l < 3; l++) {
        const isAlert = l === 2;
        const lMat = bench.track(
          new THREE.MeshStandardMaterial({
            color: isAlert ? '#38bdf8' : '#22c55e',
            emissive: isAlert ? '#0284c7' : '#16a34a',
            emissiveIntensity: 0.9
          })
        );
        const led = new THREE.Mesh(rackLedGeo, lMat);
        led.position.set(0.06 + l * 0.022, uy + 0.01, 0.182);
        rackGrp.add(led);
        socRackLeds.push({ mat: lMat, phase: (side + 2) * 1.3 + u * 0.9 + l * 0.65, isAlert });
      }
    }
  });

  const socMatTex = bench.track(
    makeCanvasTexture(1024, 512, (ctx, w, h) => {
      ctx.fillStyle = '#091326';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.lineWidth = 1.5;
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

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.52)';
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, w - 20, h - 20);

      ctx.strokeStyle = 'rgba(14, 165, 233, 0.45)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.56, 170, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(125, 211, 252, 0.72)';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('TAPIS ANTISTATIQUE SOC • HOLOGRAMME RÉSEAU • CIELGUARD', 26, 36);
      ctx.fillText('COMMANDES SOC', 32, h - 28);
      ctx.fillText('CLÉ EDR', w - 120, h - 28);
    })
  );
  const deskSurface = new THREE.Mesh(
    bench.track(new THREE.BoxGeometry(1.88, 0.012, 1.04)),
    bench.track(new THREE.MeshStandardMaterial({ map: socMatTex, roughness: 0.68, metalness: 0.12 }))
  );
  deskSurface.position.set(0, 0.006, 0.02);
  deskSurface.receiveShadow = true;
  bench.scene.add(deskSurface);

  const grommetOuterGeo = bench.track(new THREE.CylinderGeometry(0.036, 0.036, 0.014, 16));
  const grommetHoleGeo = bench.track(new THREE.CylinderGeometry(0.022, 0.022, 0.016, 16));
  for (const gx of [-0.62, 0, 0.62]) {
    const grommet = new THREE.Mesh(grommetOuterGeo, socMetalMat);
    grommet.position.set(gx, 0.01, -0.44);
    bench.scene.add(grommet);
    const hole = new THREE.Mesh(grommetHoleGeo, darkFrame);
    hole.position.set(gx, 0.011, -0.44);
    bench.scene.add(hole);
  }

  const deskCableMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#0ea5e9', roughness: 0.42, metalness: 0.2 })
  );
  for (const cPts of [
    [[-0.90, 0.05, -0.26], [-0.74, 0.02, -0.42], [-0.62, 0.015, -0.44]],
    [[0.90, 0.05, -0.26], [0.74, 0.02, -0.42], [0.62, 0.015, -0.44]],
    [[-0.54, 0.04, -0.29], [-0.30, 0.018, -0.42], [0, 0.015, -0.44]],
    [[0.54, 0.04, -0.29], [0.30, 0.018, -0.42], [0, 0.015, -0.44]]
  ]) {
    const cCurve = new THREE.CatmullRomCurve3(cPts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    const cMesh = new THREE.Mesh(
      bench.track(new THREE.TubeGeometry(cCurve, 18, 0.007, 8, false)),
      deskCableMat
    );
    bench.scene.add(cMesh);
  }

  const monitorLeds = [];
  const monStandGeo = bench.track(new THREE.BoxGeometry(0.14, 0.014, 0.11));
  const monNeckGeo = bench.track(new THREE.BoxGeometry(0.035, 0.22, 0.028));
  const monStatusBarGeo = bench.track(new THREE.BoxGeometry(0.06, 0.006, 0.008));
  const monLedMat = bench.track(
    new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#38bdf8', emissiveIntensity: 1.2 })
  );
  monitorLeds.push(monLedMat);
  function makeSocMonitor(x, z, rotY, width = 0.52, height = 0.30) {
    const grp = new THREE.Group();
    grp.position.set(x, 0.012, z);
    grp.rotation.y = rotY;
    const stand = new THREE.Mesh(monStandGeo, darkFrame);
    stand.position.y = 0.007;
    const neck = new THREE.Mesh(monNeckGeo, darkFrame);
    neck.position.set(0, 0.11, -0.018);
    const bezel = new THREE.Mesh(bench.track(new THREE.BoxGeometry(width + 0.03, height + 0.03, 0.024)), darkFrame);
    bezel.position.set(0, 0.27, 0);
    bezel.castShadow = true;
    const statusBar = new THREE.Mesh(monStatusBarGeo, monLedMat);
    statusBar.position.set(width * 0.36, 0.27 - height * 0.5 - 0.008, 0.012);
    grp.add(stand, neck, bezel, statusBar);
    bench.scene.add(grp);
    return { grp, width, height };
  }

  const mLeft = makeSocMonitor(-0.54, -0.26, 0.36);
  const mCenter = makeSocMonitor(0.0, -0.34, 0.0, 0.56, 0.32);
  const mRight = makeSocMonitor(0.54, -0.26, -0.36);

  const SCREEN_THROTTLE_MS = 84;
  const idsScreen = makeCanvasScreen(640, 400, (ctx, w, h, st) => {
    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, 40);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('IDS WIRESHARK — ANALYSE FLUX SOC', 14, 27);

    const s = st || {};
    const logs = [
      { blocked: s.fw185, tag: s.fw185 ? 'BLOCKED' : 'ALERT', text: s.fw185 ? '185.42.19.88 -> SRV-WEB:443 (DDoS)' : '185.42.19.88 -> SRV-WEB:443 SYN FLOOD!' },
      { blocked: s.fw91, tag: s.fw91 ? 'BLOCKED' : 'ALERT', text: s.fw91 ? '91.203.11.4 -> SRV-BDD:22 (SSH)' : '91.203.11.4 -> SRV-BDD:22 BRUTEFORCE!' },
      { blocked: s.fw4444, tag: s.fw4444 ? 'DROPPED' : 'CRIT', text: s.fw4444 ? 'PC-WORK -> Port 4444 C2 EXFIL' : 'PC-WORK -> 45.14.9.1:4444 C2 OPEN!' },
      { blocked: s.isolated, tag: s.isolated ? 'ISOLATED' : 'LATERAL', text: s.isolated ? 'PC-WORK coupé du Switch SW-CORE' : 'PC-WORK SMB scan -> SRV-BDD!' },
      { blocked: s.edrDone, tag: s.edrDone ? 'CLEAN' : 'INFECTED', text: s.edrDone ? 'CielGuard EDR : 0 menace active' : 'svch0st.exe + cryptolocker actifs' }
    ];
    logs.forEach((l, i) => {
      const y = 78 + i * 44;
      ctx.fillStyle = l.blocked ? 'rgba(34, 197, 94, 0.16)' : 'rgba(239, 68, 68, 0.18)';
      ctx.fillRect(12, y - 20, 96, 26);
      ctx.fillStyle = l.blocked ? '#4ade80' : '#f87171';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(l.tag, 20, y - 2);
      ctx.fillStyle = l.blocked ? '#bbf7d0' : '#fecaca';
      ctx.font = '15px monospace';
      ctx.fillText(l.text, 118, y - 2);
    });

    ctx.fillStyle = '#0b1324';
    ctx.fillRect(14, 304, w - 28, 78);
    ctx.strokeStyle = '#1e293b';
    ctx.strokeRect(14, 304, w - 28, 78);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('TRAFIC RÉSEAU TEMPS RÉEL (PKT/S)', 24, 323);
    const phase = s.animPhase || 0;
    const alertRatio = logs.filter((l) => !l.blocked).length / logs.length;
    for (let b = 0; b < 28; b++) {
      const val = 0.2 + 0.75 * Math.abs(Math.sin(phase * 1.4 + b * 0.55));
      const bh = Math.max(6, Math.round(val * (18 + alertRatio * 30)));
      ctx.fillStyle = alertRatio > 0 && b % 4 === 0 ? '#ef4444' : alertRatio === 0 ? '#22c55e' : '#38bdf8';
      ctx.fillRect(24 + b * 21, 374 - bh, 14, bh);
    }
  }, { minIntervalMs: SCREEN_THROTTLE_MS });

  const centerScreen = makeCanvasScreen(640, 400, (ctx, w, h, st) => {
    const s = st || { integrity: 100, activeThreats: 8, cveCount: 0, fwCount: 0 };
    ctx.fillStyle = s.integrity < 40 ? '#1f0b0e' : '#061022';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#0f1d36';
    ctx.fillRect(0, 0, w, 42);
    ctx.strokeStyle = s.secured ? '#22c55e' : '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 19px monospace';
    ctx.fillText('CIEL SOC — INTÉGRITÉ INFRASTRUCTURE', 18, 28);

    const cx = 122;
    const cy = 152;
    const r = 68;
    const pct = Math.max(0, Math.min(100, s.integrity)) / 100;
    const ringCol = s.integrity >= 70 ? '#22c55e' : s.integrity >= 40 ? '#f59e0b' : '#ef4444';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = ringCol;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ctx.stroke();

    ctx.fillStyle = ringCol;
    ctx.font = 'bold 34px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(s.integrity)}%`, cx, cy + 12);
    ctx.textAlign = 'left';

    const statsCards = [
      { label: 'MENACES ACTIVES', val: String(s.activeThreats), ok: s.activeThreats === 0 },
      { label: 'PARE-FEU FW-01', val: `${s.fwCount}/3`, ok: s.fwCount === 3 },
      { label: 'CORRECTIFS CVE', val: `${s.cveCount}/3`, ok: s.cveCount === 3 },
      { label: 'ANALYSE EDR', val: s.edrDone ? 'SAIN' : s.edrScanning ? 'SCAN...' : 'REQUIS', ok: s.edrDone }
    ];
    statsCards.forEach((sc, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const bx = 228 + col * 194;
      const by = 68 + row * 86;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(bx, by, 180, 74);
      ctx.strokeStyle = sc.ok ? '#22c55e' : '#334155';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, 180, 74);
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(sc.label, bx + 12, by + 24);
      ctx.fillStyle = sc.ok ? '#4ade80' : '#f8fafc';
      ctx.font = 'bold 24px monospace';
      ctx.fillText(sc.val, bx + 12, by + 56);
    });

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(24, 256, w - 48, 28);
    ctx.fillStyle = ringCol;
    ctx.fillRect(24, 256, (w - 48) * pct, 28);

    ctx.fillStyle = s.secured ? 'rgba(34, 197, 94, 0.16)' : 'rgba(250, 204, 21, 0.12)';
    ctx.fillRect(24, 308, w - 48, 66);
    ctx.strokeStyle = s.secured ? '#22c55e' : '#facc15';
    ctx.strokeRect(24, 308, w - 48, 66);
    ctx.fillStyle = s.secured ? '#4ade80' : '#facc15';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(
      s.secured ? '✔ RÉSEAU SÉCURISÉ — PRÊT POUR VALIDATION' : '⚡ INTERVENEZ SUR L’HOLOGRAMME & LE PANNEAU SOC',
      40,
      348
    );
  }, { minIntervalMs: SCREEN_THROTTLE_MS });

  const rightScreen = makeCanvasScreen(640, 400, (ctx, w, h, st) => {
    const s = st || { scanPct: 0 };
    ctx.fillStyle = '#060b16';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, 40);
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.fillStyle = '#c084fc';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('SYSTÈMES & CORRECTIFS CVE', 16, 27);

    const items = [
      { ok: s.cveWeb, label: 'CVE-2024 Apache (SRV-WEB) + Process' },
      { ok: s.cveBdd, label: 'Patch SQL & Verrou SSH (SRV-BDD)' },
      { ok: s.cveHost, label: 'Quarantaine svch0st.exe (typosquat)' }
    ];
    items.forEach((it, idx) => {
      const y = 66 + idx * 66;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(16, y, w - 32, 52);
      ctx.strokeStyle = it.ok ? '#22c55e' : '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(16, y, w - 32, 52);
      ctx.fillStyle = it.ok ? '#16a34a' : '#b45309';
      ctx.fillRect(28, y + 12, 74, 28);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(it.ok ? 'PATCHÉ' : 'VULN', 38, y + 31);
      ctx.fillStyle = it.ok ? '#86efac' : '#fde68a';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(it.label, 116, y + 32);
    });

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(16, 282, w - 32, 92);
    ctx.strokeStyle = s.edrDone ? '#22c55e' : '#38bdf8';
    ctx.strokeRect(16, 282, w - 32, 92);
    ctx.fillStyle = s.edrDone ? '#4ade80' : '#38bdf8';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(
      `Clé CielGuard EDR : ${s.edrDone ? 'TERMINÉ ✔' : s.edrScanning ? `ANALYSE ${Math.round(s.scanPct)}%` : 'EN ATTENTE'}`,
      30,
      318
    );
    const barW = w - 60;
    const fill = s.edrDone ? 1 : s.edrScanning ? Math.max(0, Math.min(1, (s.scanPct || 0) / 100)) : 0;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(30, 336, barW, 20);
    ctx.fillStyle = s.edrDone ? '#22c55e' : '#38bdf8';
    ctx.fillRect(30, 336, barW * fill, 20);
  }, { minIntervalMs: SCREEN_THROTTLE_MS });

  bench.track(idsScreen.texture);
  bench.track(centerScreen.texture);
  bench.track(rightScreen.texture);

  const pLeft = new THREE.Mesh(
    bench.track(new THREE.PlaneGeometry(mLeft.width, mLeft.height)),
    bench.track(new THREE.MeshBasicMaterial({ map: idsScreen.texture }))
  );
  pLeft.position.set(0, 0.27, 0.013);
  mLeft.grp.add(pLeft);

  const pCenter = new THREE.Mesh(
    bench.track(new THREE.PlaneGeometry(mCenter.width, mCenter.height)),
    bench.track(new THREE.MeshBasicMaterial({ map: centerScreen.texture }))
  );
  pCenter.position.set(0, 0.27, 0.013);
  mCenter.grp.add(pCenter);

  const pRight = new THREE.Mesh(
    bench.track(new THREE.PlaneGeometry(mRight.width, mRight.height)),
    bench.track(new THREE.MeshBasicMaterial({ map: rightScreen.texture }))
  );
  pRight.position.set(0, 0.27, 0.013);
  mRight.grp.add(pRight);

  const holoPad = new THREE.Mesh(
    bench.track(new THREE.CylinderGeometry(0.46, 0.50, 0.02, 36)),
    bench.track(new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.75 }))
  );
  holoPad.position.set(0, 0.022, 0.04);
  holoPad.receiveShadow = true;
  bench.scene.add(holoPad);

  const holoRing = new THREE.Mesh(
    bench.track(new THREE.TorusGeometry(0.44, 0.008, 12, 48)),
    bench.track(new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 1.5 }))
  );
  holoRing.rotation.x = Math.PI / 2;
  holoRing.position.set(0, 0.033, 0.04);
  bench.scene.add(holoRing);

  const holoInnerRing = new THREE.Mesh(
    bench.track(new THREE.RingGeometry(0.24, 0.255, 36)),
    bench.track(
      new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide
      })
    )
  );
  holoInnerRing.rotation.x = -Math.PI / 2;
  holoInnerRing.position.set(0, 0.034, 0.04);
  bench.scene.add(holoInnerRing);

  const nodeDefs = [
    { id: 'FW-01', pos: new THREE.Vector3(0, 0.14, -0.14), color: 0x38bdf8, size: [0.08, 0.08, 0.05] },
    { id: 'SW-CORE', pos: new THREE.Vector3(0, 0.12, 0.04), color: 0x60a5fa, size: [0.10, 0.045, 0.08] },
    { id: 'SRV-WEB', pos: new THREE.Vector3(-0.24, 0.15, 0.10), color: 0xf59e0b, size: [0.075, 0.13, 0.075] },
    { id: 'SRV-BDD', pos: new THREE.Vector3(0.0, 0.15, 0.24), color: 0x22c55e, size: [0.075, 0.13, 0.075] },
    { id: 'PC-WORK', pos: new THREE.Vector3(0.24, 0.13, 0.10), color: 0xef4444, size: [0.085, 0.08, 0.075] }
  ];

  const nodes = {};
  const nodeActivityLeds = [];
  let pcMiniScreenMat = null;
  const srvFrontPlateGeo = bench.track(new THREE.BoxGeometry(0.064, 0.115, 0.008));
  const srvBayGeo = bench.track(new THREE.BoxGeometry(0.052, 0.018, 0.005));
  const srvLedGeo = bench.track(new THREE.SphereGeometry(0.004, 8, 8));
  const swLedGeo = bench.track(new THREE.BoxGeometry(0.007, 0.006, 0.004));
  const pcLedGeo = bench.track(new THREE.SphereGeometry(0.0045, 8, 8));
  for (const nd of nodeDefs) {
    const mat = bench.track(
      new THREE.MeshStandardMaterial({
        color: nd.color,
        emissive: nd.color,
        emissiveIntensity: nd.id === 'PC-WORK' ? 1.5 : 0.6,
        roughness: 0.28,
        metalness: 0.45,
        transparent: true,
        opacity: 0.92
      })
    );
    const mesh = new THREE.Mesh(bench.track(new THREE.BoxGeometry(...nd.size)), mat);
    mesh.position.copy(nd.pos);
    mesh.castShadow = true;

    if (nd.id === 'SRV-WEB' || nd.id === 'SRV-BDD') {
      const frontPlate = new THREE.Mesh(srvFrontPlateGeo, darkFrame);
      frontPlate.position.set(0, 0, 0.039);
      mesh.add(frontPlate);
      for (let b = 0; b < 3; b++) {
        const bay = new THREE.Mesh(srvBayGeo, socChassisMat);
        bay.position.set(0, -0.032 + b * 0.026, 0.044);
        mesh.add(bay);
        const ledMat = bench.track(
          new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#38bdf8', emissiveIntensity: 1.1 })
        );
        const led = new THREE.Mesh(srvLedGeo, ledMat);
        led.position.set(0.02, -0.032 + b * 0.026, 0.048);
        mesh.add(led);
        nodeActivityLeds.push({ mat: ledMat, phase: b * 1.4 + (nd.id === 'SRV-BDD' ? 1.8 : 0), nodeId: nd.id });
      }
    } else if (nd.id === 'SW-CORE') {
      const swFace = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.09, 0.032, 0.006)), darkFrame);
      swFace.position.set(0, 0, 0.041);
      mesh.add(swFace);
      for (let p = 0; p < 6; p++) {
        const ledMat = bench.track(
          new THREE.MeshStandardMaterial({ color: '#22c55e', emissive: '#16a34a', emissiveIntensity: 1.0 })
        );
        const led = new THREE.Mesh(swLedGeo, ledMat);
        led.position.set(-0.032 + p * 0.013, 0.004, 0.045);
        mesh.add(led);
        nodeActivityLeds.push({ mat: ledMat, phase: p * 0.7, nodeId: 'SW-CORE' });
      }
    } else if (nd.id === 'PC-WORK') {
      const pcFront = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.072, 0.068, 0.006)), darkFrame);
      pcFront.position.set(0, 0, 0.039);
      mesh.add(pcFront);
      pcMiniScreenMat = bench.track(
        new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 1.25 })
      );
      const miniScreen = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.065, 0.042, 0.008)), pcMiniScreenMat);
      miniScreen.position.set(0, 0.064, 0);
      miniScreen.rotation.x = -0.25;
      mesh.add(miniScreen);
      for (let l = 0; l < 2; l++) {
        const ledMat = bench.track(
          new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 1.2 })
        );
        const led = new THREE.Mesh(pcLedGeo, ledMat);
        led.position.set(-0.02 + l * 0.016, 0.016, 0.044);
        mesh.add(led);
        nodeActivityLeds.push({ mat: ledMat, phase: l * 1.1, nodeId: 'PC-WORK' });
      }
    } else if (nd.id === 'FW-01') {
      const trimBand = new THREE.Mesh(bench.track(new THREE.BoxGeometry(0.086, 0.014, 0.056)), darkFrame);
      mesh.add(trimBand);
    }

    bench.scene.add(mesh);
    nodes[nd.id] = { mesh, mat, basePos: nd.pos.clone() };
  }

  const fwDomeMat = bench.track(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.85,
      transparent: true,
      opacity: 0.18,
      depthWrite: false
    })
  );
  const fwDome = new THREE.Mesh(bench.track(new THREE.SphereGeometry(0.11, 20, 16)), fwDomeMat);
  fwDome.position.copy(nodes['FW-01'].basePos);
  fwDome.visible = false;
  bench.scene.add(fwDome);

  const fwShieldWireMat = bench.track(
    new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      wireframe: true,
      transparent: true,
      opacity: 0.48
    })
  );
  const fwShieldWire = new THREE.Mesh(bench.track(new THREE.IcosahedronGeometry(0.122, 1)), fwShieldWireMat);
  fwShieldWire.position.copy(nodes['FW-01'].basePos);
  fwShieldWire.visible = false;
  bench.scene.add(fwShieldWire);

  const fwShieldRingMat = bench.track(
    new THREE.MeshBasicMaterial({
      color: '#7dd3fc',
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide
    })
  );
  const fwShieldRing = new THREE.Mesh(bench.track(new THREE.RingGeometry(0.125, 0.138, 32)), fwShieldRingMat);
  fwShieldRing.rotation.x = Math.PI / 2;
  fwShieldRing.position.copy(nodes['FW-01'].basePos).add(new THREE.Vector3(0, -0.02, 0));
  fwShieldRing.visible = false;
  bench.scene.add(fwShieldRing);

  const edrShieldDomeMat = bench.track(
    new THREE.MeshStandardMaterial({
      color: '#22c55e',
      emissive: '#16a34a',
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.2,
      depthWrite: false
    })
  );
  const edrShieldDome = new THREE.Mesh(bench.track(new THREE.SphereGeometry(0.105, 20, 16)), edrShieldDomeMat);
  edrShieldDome.position.copy(nodes['PC-WORK'].basePos);
  edrShieldDome.visible = false;
  bench.scene.add(edrShieldDome);

  const edrShieldWireMat = bench.track(
    new THREE.MeshBasicMaterial({
      color: '#4ade80',
      wireframe: true,
      transparent: true,
      opacity: 0.55
    })
  );
  const edrShieldWire = new THREE.Mesh(bench.track(new THREE.IcosahedronGeometry(0.118, 1)), edrShieldWireMat);
  edrShieldWire.position.copy(nodes['PC-WORK'].basePos);
  edrShieldWire.visible = false;
  bench.scene.add(edrShieldWire);

  const edrShieldRingMat = bench.track(
    new THREE.MeshBasicMaterial({
      color: '#4ade80',
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide
    })
  );
  const edrShieldRing = new THREE.Mesh(bench.track(new THREE.RingGeometry(0.115, 0.128, 32)), edrShieldRingMat);
  edrShieldRing.rotation.x = Math.PI / 2;
  edrShieldRing.position.copy(nodes['PC-WORK'].basePos).add(new THREE.Vector3(0, -0.02, 0));
  edrShieldRing.visible = false;
  bench.scene.add(edrShieldRing);

  const linkPairs = [
    ['FW-01', 'SW-CORE', 0x38bdf8],
    ['SW-CORE', 'SRV-WEB', 0x60a5fa],
    ['SW-CORE', 'SRV-BDD', 0x60a5fa],
    ['SW-CORE', 'PC-WORK', 0xef4444]
  ];
  const linkCables = {};
  const beamPulses = [];
  const beamGeo = bench.track(new THREE.SphereGeometry(0.011, 10, 10));
  for (const [a, b, c] of linkPairs) {
    const cable = buildFlexibleCable([nodes[a].basePos.clone(), nodes[b].basePos.clone()], c, 0.005, c);
    bench.track(cable.mesh.geometry);
    bench.track(cable.mat);
    bench.scene.add(cable.mesh);
    const key = `${a}->${b}`;
    linkCables[key] = cable;
    for (let k = 0; k < 2; k++) {
      const pMat = bench.track(new THREE.MeshBasicMaterial({ color: c }));
      const pMesh = new THREE.Mesh(beamGeo, pMat);
      bench.scene.add(pMesh);
      beamPulses.push({ key, mesh: pMesh, mat: pMat, curve: cable.getCurve(), t: k * 0.5 });
    }
  }

  const switchPadGeo = bench.track(new THREE.BoxGeometry(0.085, 0.018, 0.07));
  const switchPadMat = bench.track(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45 }));
  const switchStickGeo = bench.track(new THREE.CylinderGeometry(0.006, 0.006, 0.045, 10));
  const switchLedGeo = bench.track(new THREE.SphereGeometry(0.0065, 10, 8));
  function makeToggleSwitch(x, z, baseColor) {
    const grp = new THREE.Group();
    grp.position.set(x, 0.032, z);
    const pad = new THREE.Mesh(switchPadGeo, switchPadMat);
    const leverPivot = new THREE.Group();
    leverPivot.position.set(0, 0.012, 0);
    const stick = new THREE.Mesh(
      switchStickGeo,
      bench.track(new THREE.MeshStandardMaterial({ color: baseColor, metalness: 0.7, roughness: 0.25 }))
    );
    stick.position.y = 0.022;
    leverPivot.add(stick);
    leverPivot.rotation.x = -0.45;
    const ledMat = bench.track(
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.5 })
    );
    const led = new THREE.Mesh(switchLedGeo, ledMat);
    led.position.set(0.026, 0.012, 0.02);
    grp.add(pad, leverPivot, led);
    bench.scene.add(grp);
    return { grp, pad, leverPivot, ledMat };
  }

  const isoSwitch = makeToggleSwitch(0.28, 0.34, 0xf87171);
  const fwSwitch = makeToggleSwitch(0.0, 0.38, 0x38bdf8);
  const patchSwitch = makeToggleSwitch(-0.28, 0.34, 0xfbbf24);

  const edrUsbGroup = new THREE.Group();
  edrUsbGroup.position.set(0.56, 0.028, 0.22);
  const usbBody = new THREE.Mesh(
    bench.track(new THREE.BoxGeometry(0.042, 0.018, 0.095)),
    bench.track(
      new THREE.MeshStandardMaterial({ color: 0x0ea5e9, emissive: 0x0284c7, emissiveIntensity: 0.45, roughness: 0.28 })
    )
  );
  const usbTip = new THREE.Mesh(
    bench.track(new THREE.BoxGeometry(0.028, 0.012, 0.024)),
    bench.track(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 }))
  );
  usbTip.position.z = -0.055;
  edrUsbGroup.add(usbBody, usbTip);
  bench.scene.add(edrUsbGroup);

  const scanPlaneMat = bench.track(
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    })
  );
  const scanPlane = new THREE.Mesh(bench.track(new THREE.RingGeometry(0.05, 0.14, 24)), scanPlaneMat);
  scanPlane.rotation.x = Math.PI / 2;
  scanPlane.position.copy(nodes['PC-WORK'].basePos);
  scanPlane.visible = false;
  bench.scene.add(scanPlane);

  const attackPackets = [];
  let packetSpawnTimer = 0;

  const state = {
    isolated: false,
    fw185: false,
    fw91: false,
    fw4444: false,
    cveWeb: false,
    cveBdd: false,
    cveHost: false,
    edrScanning: false,
    scanPct: 0,
    edrDone: false,
    integrity: 100,
    mistakes: 0,
    finished: false,
    camId: 'soc'
  };

  const CAM_VIEWS = [
    { id: 'soc', label: 'Poste SOC', pos: [0.0, 0.88, 1.24], lookAt: [0.0, 0.25, -0.08], fov: 40 },
    { id: 'holo', label: 'Hologramme Réseau', pos: [0.0, 0.65, 0.62], lookAt: [0.0, 0.12, 0.08], fov: 38 },
    { id: 'screens', label: 'Écrans IDS', pos: [0.0, 0.42, 0.48], lookAt: [0.0, 0.27, -0.34], fov: 44 }
  ];

  function selectCamera(id) {
    const v = CAM_VIEWS.find((c) => c.id === id);
    if (!v) return;
    state.camId = id;
    bench.setCameraView(v.pos, v.lookAt, v.fov);
    bench.setCameras(CAM_VIEWS, id, selectCamera);
  }

  function getStats() {
    const fwCount = (state.fw185 ? 1 : 0) + (state.fw91 ? 1 : 0) + (state.fw4444 ? 1 : 0);
    const cveCount = (state.cveWeb ? 1 : 0) + (state.cveBdd ? 1 : 0) + (state.cveHost ? 1 : 0);
    const activeThreats =
      (!state.isolated ? 1 : 0) +
      (3 - fwCount) +
      (3 - cveCount) +
      (!state.edrDone ? 1 : 0);
    const secured = activeThreats === 0;
    return { fwCount, cveCount, activeThreats, secured };
  }

  let lastCenterSig = '';
  let lastRightSig = '';
  function syncMonitorScreens(animPhase = 0, forceIds = false) {
    const st = getStats();
    const idsPayload = {
      fw185: state.fw185,
      fw91: state.fw91,
      fw4444: state.fw4444,
      isolated: state.isolated,
      edrDone: state.edrDone,
      animPhase
    };
    if (forceIds) {
      idsScreen.forceUpdate(idsPayload);
    } else {
      idsScreen.update(idsPayload);
    }
    const centerSig = `${Math.round(state.integrity)}|${st.activeThreats}|${st.cveCount}|${st.fwCount}|${state.edrDone}|${state.edrScanning}|${st.secured}`;
    if (centerSig !== lastCenterSig) {
      lastCenterSig = centerSig;
      centerScreen.forceUpdate({
        integrity: state.integrity,
        activeThreats: st.activeThreats,
        cveCount: st.cveCount,
        fwCount: st.fwCount,
        edrDone: state.edrDone,
        edrScanning: state.edrScanning,
        secured: st.secured
      });
    }
    const rightSig = `${state.cveWeb}|${state.cveBdd}|${state.cveHost}|${state.edrDone}|${state.edrScanning}|${Math.round(state.scanPct)}`;
    if (rightSig !== lastRightSig) {
      lastRightSig = rightSig;
      rightScreen.forceUpdate({
        cveWeb: state.cveWeb,
        cveBdd: state.cveBdd,
        cveHost: state.cveHost,
        edrDone: state.edrDone,
        edrScanning: state.edrScanning,
        scanPct: state.scanPct
      });
    }
    return st;
  }

  function updateScreensAndVisuals(animPhase = 0) {
    const st = syncMonitorScreens(animPhase, true);

    const fwActive = st.fwCount > 0;
    fwDome.visible = fwActive;
    fwShieldWire.visible = fwActive;
    fwShieldRing.visible = fwActive;
    fwDomeMat.opacity = 0.12 + st.fwCount * 0.08;
    fwShieldWireMat.opacity = 0.26 + st.fwCount * 0.14;

    const edrActive = state.edrScanning || state.edrDone;
    edrShieldDome.visible = edrActive;
    edrShieldWire.visible = edrActive;
    edrShieldRing.visible = edrActive;
    const edrHex = state.edrDone ? '#22c55e' : '#38bdf8';
    edrShieldDomeMat.color.set(edrHex);
    edrShieldDomeMat.emissive.set(state.edrDone ? '#16a34a' : '#0284c7');
    edrShieldDomeMat.opacity = state.edrDone ? 0.24 : 0.14;
    edrShieldWireMat.color.set(edrHex);
    edrShieldRingMat.color.set(edrHex);

    const pcHex = state.edrDone ? 0x22c55e : state.isolated ? 0xf59e0b : 0xef4444;
    nodes['PC-WORK'].mat.color.setHex(pcHex);
    nodes['PC-WORK'].mat.emissive.setHex(state.edrDone ? 0x16a34a : state.isolated ? 0xd97706 : 0xef4444);
    if (pcMiniScreenMat) {
      pcMiniScreenMat.color.setHex(pcHex);
      pcMiniScreenMat.emissive.setHex(pcHex);
    }

    const webOk = state.cveWeb && state.fw185;
    nodes['SRV-WEB'].mat.color.setHex(webOk ? 0x22c55e : 0xf59e0b);
    nodes['SRV-WEB'].mat.emissive.setHex(webOk ? 0x16a34a : 0xd97706);

    const bddOk = state.cveBdd && state.fw91;
    nodes['SRV-BDD'].mat.color.setHex(bddOk ? 0x22c55e : 0x38bdf8);
    nodes['SRV-BDD'].mat.emissive.setHex(bddOk ? 0x16a34a : 0x0284c7);

    const fwOk = st.fwCount === 3;
    linkCables['FW-01->SW-CORE'].mat.color.setHex(fwOk ? 0x22c55e : 0x38bdf8);
    linkCables['FW-01->SW-CORE'].mat.emissive.setHex(fwOk ? 0x16a34a : 0x0284c7);
    linkCables['SW-CORE->SRV-WEB'].mat.color.setHex(webOk ? 0x22c55e : 0xef4444);
    linkCables['SW-CORE->SRV-WEB'].mat.emissive.setHex(webOk ? 0x16a34a : 0xef4444);
    linkCables['SW-CORE->SRV-BDD'].mat.color.setHex(bddOk ? 0x22c55e : 0xf97316);
    linkCables['SW-CORE->SRV-BDD'].mat.emissive.setHex(bddOk ? 0x16a34a : 0xf97316);
    linkCables['SW-CORE->PC-WORK'].mat.color.setHex(state.isolated ? 0x334155 : state.edrDone ? 0x22c55e : 0xef4444);
    linkCables['SW-CORE->PC-WORK'].mat.emissive.setHex(state.isolated ? 0x0f172a : state.edrDone ? 0x16a34a : 0xef4444);

    isoSwitch.leverPivot.rotation.x = state.isolated ? 0.5 : -0.45;
    isoSwitch.ledMat.color.setHex(state.isolated ? 0x22c55e : 0xef4444);
    isoSwitch.ledMat.emissive.setHex(state.isolated ? 0x22c55e : 0xef4444);

    fwSwitch.leverPivot.rotation.x = st.fwCount === 3 ? 0.5 : -0.45;
    fwSwitch.ledMat.color.setHex(st.fwCount === 3 ? 0x22c55e : 0xf59e0b);
    fwSwitch.ledMat.emissive.setHex(st.fwCount === 3 ? 0x22c55e : 0xf59e0b);

    patchSwitch.leverPivot.rotation.x = st.cveCount === 3 ? 0.5 : -0.45;
    patchSwitch.ledMat.color.setHex(st.cveCount === 3 ? 0x22c55e : 0xf59e0b);
    patchSwitch.ledMat.emissive.setHex(st.cveCount === 3 ? 0x22c55e : 0xf59e0b);

    monitorLeds.forEach((mLed) => {
      mLed.color.set(st.secured ? '#22c55e' : '#38bdf8');
      mLed.emissive.set(st.secured ? '#22c55e' : '#38bdf8');
    });
  }

  let socKeypadCleanup = null;
  let socKeypadOpen = false;

  bench.setInspectableView?.({
    title: 'Moniteur IDS Wireshark SOC',
    subtitle: 'Flux d’attaque en temps réel & état des règles FW-01',
    label: '🔎 Zoom IDS',
    canvas: idsScreen.canvas
  });

  function applyManualFirewallRule(raw) {
    const val = String(raw || '').trim();
    if (!val) return;
    let matched = false;
    if (val.includes('185.42.19.88')) {
      state.fw185 = true;
      matched = true;
    } else if (val.includes('91.203.11.4')) {
      state.fw91 = true;
      matched = true;
    } else if (val.includes('4444')) {
      state.fw4444 = true;
      matched = true;
    }
    if (matched) {
      sfx.click();
      bench.spawnPulseRing(nodes['FW-01'].basePos, '#38bdf8', 0.14);
      bench.showToast(`Règle pare-feu appliquée pour ${val} !`, 'success');
    } else {
      state.mistakes += 1;
      sfx.error();
      bench.showToast(`Cible inconnue (${val}) : vérifiez les IPs/ports sur l’IDS.`, 'error');
    }
    refreshAll();
  }

  function renderSideDrawer() {
    socKeypadCleanup?.();
    socKeypadCleanup = null;
    const html = isJpo
      ? `
      <h4>🛡️ Actions de protection</h4>
      <div style="color:#475569;margin-bottom:10px;">
        Suis les 3 étapes dans l’ordre :
      </div>
      <div style="display:grid;gap:8px;margin-bottom:12px;">
        <button type="button" class="tp3d-tool-btn ${state.isolated ? 'active' : ''}" id="soc-iso">
          ${state.isolated ? '✅ 1. PC infecté isolé' : '🔌 1. Isoler le PC (couper le câble infecté)'}
        </button>
      </div>
      <div style="font-weight:800;text-transform:uppercase;color:#334155;margin:8px 0 6px;">🧱 2. Protections du pare-feu</div>
      <div style="display:grid;gap:8px;margin-bottom:12px;">
        <button type="button" class="tp3d-tool-btn ${state.fw185 ? 'active' : ''}" id="soc-fw-185">
          ${state.fw185 ? '✅ Attaque site web bloquée' : '🛡️ Bloquer l’attaque sur le site web'}
        </button>
        <button type="button" class="tp3d-tool-btn ${state.fw91 ? 'active' : ''}" id="soc-fw-91">
          ${state.fw91 ? '✅ Vol de mots de passe bloqué' : '🔒 Bloquer le vol de mots de passe'}
        </button>
        <button type="button" class="tp3d-tool-btn ${state.fw4444 ? 'active' : ''}" id="soc-fw-4444">
          ${state.fw4444 ? '✅ Accès caché fermé' : '🚫 Fermer l’accès caché du pirate'}
        </button>
      </div>
      <div style="font-weight:800;text-transform:uppercase;color:#334155;margin:8px 0 6px;">🔧 Réparer &amp; éliminer le virus</div>
      <div style="display:grid;gap:8px;margin-bottom:12px;">
        <button type="button" class="tp3d-tool-btn ${state.cveWeb ? 'active' : ''}" id="soc-cve-web">
          ${state.cveWeb ? '✅ Serveur web réparé' : '🔧 Réparer le serveur web'}
        </button>
        <button type="button" class="tp3d-tool-btn ${state.cveBdd ? 'active' : ''}" id="soc-cve-bdd">
          ${state.cveBdd ? '✅ Base de données protégée' : '🔐 Protéger la base de données'}
        </button>
        <button type="button" class="tp3d-tool-btn ${state.cveHost ? 'active' : ''}" id="soc-cve-host">
          ${state.cveHost ? '✅ Faux programme supprimé' : '🗑️ Supprimer le faux « svch0st.exe » (avec un zéro)'}
        </button>
        <button type="button" class="tp3d-tool-btn" id="soc-false-svchost">
          ⚠️ Supprimer « svchost.exe » (programme normal)
        </button>
      </div>
      <button type="button" class="tp3d-act-btn primary" id="soc-edr-scan" style="width:100%;" ${state.edrDone || state.edrScanning ? 'disabled' : ''}>
        ${state.edrDone ? '✅ 3. Antivirus terminé !' : state.edrScanning ? `🧼 Nettoyage en cours (${Math.round(state.scanPct)}%)` : '🧼 3. Lancer l’antivirus (nettoyer le PC)'}
      </button>
    `
      : `
      <h4>Console Cyber-Défense SOC</h4>
      <div style="font-size:12px;color:#475569;margin-bottom:8px;">
        Stoppez les attaques en cours avant que l’intégrité serveur ne chute !
      </div>
      <div style="display:grid;gap:7px;margin-bottom:10px;">
        <button type="button" class="tp3d-tool-btn ${state.isolated ? 'active' : ''}" id="soc-iso">
          ${state.isolated ? '✔ PC-WORK Isolé du réseau' : '1. Isoler PC-WORK (Couper propagation)'}
        </button>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin:6px 0 6px;">
        <span style="font-size:11px;font-weight:800;text-transform:uppercase;color:#475569;">Pare-feu Périmétrique (FW-01)</span>
        <button type="button" class="av-mini-btn" id="soc-fw-kp-btn">${socKeypadOpen ? 'Masquer pavé IP' : '⌨️ Saisir IP/Port'}</button>
      </div>
      <div id="soc-fw-manual-wrap" class="${socKeypadOpen ? '' : 'hidden'}" style="margin-bottom:8px;">
        <div style="display:flex;gap:6px;margin-bottom:6px;">
          <input type="text" id="soc-fw-input" placeholder="185.42.19.88 / 4444" style="flex:1;min-height:44px;padding:6px 8px;border-radius:6px;border:1px solid #334155;background:#0f172a;color:#f8fafc;font-family:monospace;font-size:12px;" />
          <button type="button" class="tp3d-act-btn primary" id="soc-fw-apply">Bloquer</button>
        </div>
        <div id="soc-fw-kp-mount"></div>
      </div>
      <div style="display:grid;gap:7px;margin-bottom:10px;">
        <button type="button" class="tp3d-tool-btn ${state.fw185 ? 'active' : ''}" id="soc-fw-185">
          ${state.fw185 ? '✔ IP 185.42.19.88 bloquée (DDoS)' : 'Bloquer IP 185.42.19.88 (DDoS Web)'}
        </button>
        <button type="button" class="tp3d-tool-btn ${state.fw91 ? 'active' : ''}" id="soc-fw-91">
          ${state.fw91 ? '✔ IP 91.203.11.4 bloquée (SSH)' : 'Bloquer IP 91.203.11.4 (SSH Bruteforce)'}
        </button>
        <button type="button" class="tp3d-tool-btn ${state.fw4444 ? 'active' : ''}" id="soc-fw-4444">
          ${state.fw4444 ? '✔ Port 4444 C2 fermé' : 'Fermer Port 4444 (Backdoor C2)'}
        </button>
      </div>
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#475569;margin:6px 0 6px;">Correctifs & Processus</div>
      <div style="display:grid;gap:7px;margin-bottom:10px;">
        <button type="button" class="tp3d-tool-btn ${state.cveWeb ? 'active' : ''}" id="soc-cve-web">
          ${state.cveWeb ? '✔ SRV-WEB Patché (CVE Apache)' : 'Patcher CVE sur SRV-WEB'}
        </button>
        <button type="button" class="tp3d-tool-btn ${state.cveBdd ? 'active' : ''}" id="soc-cve-bdd">
          ${state.cveBdd ? '✔ SRV-BDD Sécurisé (SQL/SSH)' : 'Patcher & Verrouiller SRV-BDD'}
        </button>
        <button type="button" class="tp3d-tool-btn ${state.cveHost ? 'active' : ''}" id="soc-cve-host">
          ${state.cveHost ? '✔ Faux svch0st.exe supprimé' : 'Tuer svch0st.exe (typosquatting !)'}
        </button>
        <button type="button" class="tp3d-tool-btn" id="soc-false-svchost">
          Tuer svchost.exe (System32)
        </button>
      </div>
      <button type="button" class="tp3d-act-btn primary" id="soc-edr-scan" style="width:100%;" ${state.edrDone || state.edrScanning ? 'disabled' : ''}>
        ${state.edrDone ? '✔ Scan CielGuard EDR Terminé' : state.edrScanning ? `Scan EDR en cours (${Math.round(state.scanPct)}%)` : 'Lancer Scan Laser CielGuard EDR'}
      </button>
    `;

    const drawer = bench.setSideDrawer(html);
    if (!drawer) return;

    drawer.querySelector('#soc-fw-kp-btn')?.addEventListener('click', () => {
      socKeypadOpen = !socKeypadOpen;
      renderSideDrawer();
    });
    const fwInp = drawer.querySelector('#soc-fw-input');
    const fwApply = drawer.querySelector('#soc-fw-apply');
    const fwMount = drawer.querySelector('#soc-fw-kp-mount');
    fwApply?.addEventListener('click', () => {
      applyManualFirewallRule(fwInp?.value);
      if (fwInp) fwInp.value = '';
    });
    if (socKeypadOpen && fwInp && fwMount) {
      const kp = createVirtualKeypad({
        mode: 'ip-cli',
        targetInput: fwInp,
        presets: ['185.42.19.88', '91.203.11.4', '4444'],
        onSubmit: (v) => {
          applyManualFirewallRule(v);
          fwInp.value = '';
        }
      });
      fwMount.appendChild(kp.element);
      socKeypadCleanup = () => kp.destroy();
    }

    drawer.querySelector('#soc-iso')?.addEventListener('click', () => {
      state.isolated = !state.isolated;
      sfx.click();
      bench.showToast(state.isolated ? 'Poste PC-WORK isolé du réseau interne !' : 'PC-WORK reconnecté.', state.isolated ? 'success' : 'info');
      refreshAll();
    });
    drawer.querySelector('#soc-fw-185')?.addEventListener('click', () => {
      state.fw185 = true;
      sfx.click();
      bench.spawnPulseRing(nodes['FW-01'].basePos, '#38bdf8', 0.14);
      refreshAll();
    });
    drawer.querySelector('#soc-fw-91')?.addEventListener('click', () => {
      state.fw91 = true;
      sfx.click();
      bench.spawnPulseRing(nodes['FW-01'].basePos, '#38bdf8', 0.14);
      refreshAll();
    });
    drawer.querySelector('#soc-fw-4444')?.addEventListener('click', () => {
      state.fw4444 = true;
      sfx.click();
      bench.spawnPulseRing(nodes['FW-01'].basePos, '#38bdf8', 0.14);
      refreshAll();
    });
    drawer.querySelector('#soc-cve-web')?.addEventListener('click', () => {
      state.cveWeb = true;
      sfx.click();
      bench.spawnPulseRing(nodes['SRV-WEB'].basePos, '#22c55e', 0.12);
      refreshAll();
    });
    drawer.querySelector('#soc-cve-bdd')?.addEventListener('click', () => {
      state.cveBdd = true;
      sfx.click();
      bench.spawnPulseRing(nodes['SRV-BDD'].basePos, '#22c55e', 0.12);
      refreshAll();
    });
    drawer.querySelector('#soc-cve-host')?.addEventListener('click', () => {
      state.cveHost = true;
      sfx.click();
      bench.spawnPulseRing(nodes['PC-WORK'].basePos, '#38bdf8', 0.12);
      bench.showToast('Bien vu ! « svch0st.exe » avec un zéro était le malware masqué.', 'success');
      refreshAll();
    });
    drawer.querySelector('#soc-false-svchost')?.addEventListener('click', () => {
      state.mistakes += 1;
      state.integrity = Math.max(10, state.integrity - 3);
      sfx.error();
      bench.showToast('Erreur ! svchost.exe dans System32 est un processus Windows légitime.', 'error');
      refreshAll();
    });
    drawer.querySelector('#soc-edr-scan')?.addEventListener('click', startEdrScan);
  }

  function startEdrScan() {
    if (state.edrDone || state.edrScanning) return;
    if (!state.isolated) {
      bench.showToast('Conseil SOC : isolez d’abord PC-WORK avant de lancer le nettoyage EDR !', 'info');
    }
    state.edrScanning = true;
    state.scanPct = 0;
    scanPlane.visible = true;
    sfx.click();
    refreshAll();
  }

  function finishWorkshop() {
    if (state.finished) return;
    state.finished = true;
    const st = getStats();
    const res = computeSocDefenseScore3D({
      isolatedCompromised: state.isolated,
      firewallBlockedCount: st.fwCount,
      firewallTotal: 3,
      cvePatchedCount: st.cveCount,
      cveTotal: 3,
      edrScanDone: state.edrDone,
      integrityRemaining: state.integrity,
      mistakes: state.mistakes,
      elapsedSec: bench.getElapsedSec()
    });
    sfx.success();
    api.finishTp(
      res.score,
      `
        <p>Rapport d’Intervention Cybersécurité SOC 3D (<strong>${Math.round(bench.getElapsedSec())}s</strong>) :</p>
        <ul>
          <li>Intégrité infrastructure préservée : <strong>${Math.round(state.integrity)}%</strong></li>
          <li>Isolation PC compromis : <strong>${state.isolated ? 'Oui' : 'Non'}</strong></li>
          <li>Règles Pare-feu FW-01 : <strong>${st.fwCount}/3</strong> · Patchs CVE : <strong>${st.cveCount}/3</strong></li>
          <li>Scan Laser CielGuard EDR : <strong>${state.edrDone ? 'Terminé' : 'Incomplet'}</strong></li>
        </ul>
      `,
      res.breakdown
    );
  }

  function refreshHud() {
    const st = getStats();
    if (isJpo) {
      if (st.secured) {
        state.integrity = 100;
        bench.setInstruction(
          'MISSION RÉUSSIE !',
          'Le réseau du lycée est nettoyé et protégé à 100 % !',
          'Clique sur « Terminer la mission » en bas à droite pour voir ton résultat.'
        );
      } else if (!state.isolated) {
        bench.setInstruction(
          'ÉTAPE 1 / 3',
          'Coupe le câble du PC infecté pour stopper le virus',
          'Clique sur l’élément rouge au bureau 3D ou sur « Isoler le PC » en haut à droite.'
        );
      } else if (st.fwCount < 3) {
        bench.setInstruction(
          'ÉTAPE 2 / 3',
          `Bloque les intrus avec le pare-feu (${st.fwCount}/3 protections activées)`,
          'Clique sur les 3 boutons de protection du pare-feu dans le panneau à droite.'
        );
      } else {
        bench.setInstruction(
          'ÉTAPE 3 / 3',
          `Répare les failles (${st.cveCount}/3) puis lance l’antivirus`,
          'Termine les réparations à droite puis clique sur le bouton bleu « Lancer l’antivirus ».'
        );
      }
      bench.setAccuracy(`Santé réseau : ${Math.round(state.integrity)} %`);
      const stageIdx = !state.isolated ? 0 : st.fwCount < 3 ? 1 : 2;
      api.setStages(
        [
          { name: '1. Isoler le PC' },
          { name: `2. Bloquer les intrus (${st.fwCount}/3)` },
          { name: `3. Nettoyer (${st.cveCount}/3)` }
        ],
        stageIdx
      );
      const actions = [
        {
          id: 'hint-soc',
          label: '💡 Astuce',
          onClick: () =>
            bench.showToast(
              '1) Isole le PC rouge  2) Active les 3 protections du pare-feu  3) Répare et supprime le faux « svch0st.exe »  4) Lance l’antivirus !',
              'info'
            )
        },
        { id: 'reset', label: '🔄 Recommencer', onClick: resetSoc },
        {
          id: 'finish-soc',
          label: st.secured ? '✅ Terminer la mission' : '✅ Valider ma mission',
          primary: true,
          onClick: finishWorkshop
        }
      ];
      bench.setActions(actions);
      return;
    }

    bench.setInstruction(
      st.secured ? 'SOC SÉCURISÉ' : 'ALERTE CYBER SOC 3D',
      st.secured
        ? 'Toutes les menaces sont neutralisées ! Validez votre rapport SOC'
        : `Intégrité : ${Math.round(state.integrity)}% · ${st.activeThreats} menace(s) active(s)`,
      'Cliquez sur les interrupteurs 3D / nœuds holographiques ou utilisez la console SOC pour isoler PC-WORK, bloquer le pare-feu, patcher les CVE et scanner à l’EDR.'
    );
    bench.setAccuracy(`Intégrité ${Math.round(state.integrity)}% · FW ${st.fwCount}/3 · CVE ${st.cveCount}/3`);
    const stageIdx = !state.isolated ? 0 : st.fwCount < 3 ? 1 : 2;
    api.setStages(
      [
        { name: '1. Isolation Réseau' },
        { name: `2. Pare-feu (${st.fwCount}/3)` },
        { name: `3. Patchs & EDR (${st.cveCount}/3)` }
      ],
      stageIdx
    );

    const actions = [
      { id: 'hint-soc', label: '💡 Indice', onClick: () => bench.showToast('1) Isoler PC-WORK 2) Bloquer 185.42.19.88, 91.203.11.4 et Port 4444 3) Patcher Web/BDD + tuer svch0st.exe (pas svchost) 4) Scan EDR !', 'info') },
      { id: 'reset', label: '🔄 Réinitialiser', onClick: resetSoc },
      {
        id: 'finish-soc',
        label: st.secured ? 'Clôturer l’Incident & Noter /20' : 'Valider l’état actuel',
        primary: true,
        onClick: finishWorkshop
      }
    ];
    bench.setActions(actions);
  }

  function refreshAll() {
    updateScreensAndVisuals();
    renderSideDrawer();
    refreshHud();
  }

  function resetSoc() {
    state.isolated = false;
    state.fw185 = false;
    state.fw91 = false;
    state.fw4444 = false;
    state.cveWeb = false;
    state.cveBdd = false;
    state.cveHost = false;
    state.edrScanning = false;
    state.scanPct = 0;
    state.edrDone = false;
    state.integrity = 100;
    state.mistakes = 0;
    state.finished = false;
    scanPlane.visible = false;
    refreshAll();
  }

  bench.addInteractive(isoSwitch.grp, {
    label: 'Interrupteur Isolation Réseau PC-WORK',
    onClick: () => {
      state.isolated = !state.isolated;
      sfx.click();
      bench.showToast(state.isolated ? 'PC-WORK isolé physiquement du Switch !' : 'PC-WORK réactivé.', state.isolated ? 'success' : 'info');
      refreshAll();
    }
  });
  bench.addInteractive(nodes['PC-WORK'].mesh, {
    label: 'Poste Compromis PC-WORK (Clic pour isoler / scanner)',
    onClick: () => {
      if (!state.isolated) {
        state.isolated = true;
        sfx.click();
        bench.showToast('PC-WORK isolé du réseau !', 'success');
        refreshAll();
      } else {
        startEdrScan();
      }
    }
  });
  bench.addInteractive(fwSwitch.grp, {
    label: 'Bouclier Pare-feu FW-01 (Bloquer IP & Port 4444)',
    onClick: () => {
      state.fw185 = true;
      state.fw91 = true;
      state.fw4444 = true;
      sfx.click();
      bench.spawnPulseRing(nodes['FW-01'].basePos, '#38bdf8', 0.16);
      bench.showToast('Règles Pare-feu FW-01 déployées (DDoS + SSH + Port 4444 bloqués) !', 'success');
      refreshAll();
    }
  });
  bench.addInteractive(nodes['FW-01'].mesh, {
    label: 'Pare-feu FW-01',
    onClick: () => {
      state.fw185 = true;
      state.fw91 = true;
      state.fw4444 = true;
      sfx.click();
      bench.spawnPulseRing(nodes['FW-01'].basePos, '#38bdf8', 0.16);
      refreshAll();
    }
  });
  bench.addInteractive(patchSwitch.grp, {
    label: 'Interrupteur Patchs CVE Serveurs',
    onClick: () => {
      state.cveWeb = true;
      state.cveBdd = true;
      state.cveHost = true;
      sfx.click();
      bench.spawnPulseRing(nodes['SRV-WEB'].basePos, '#22c55e', 0.12);
      bench.showToast('Correctifs CVE appliqués et svch0st.exe éliminé !', 'success');
      refreshAll();
    }
  });
  bench.addInteractive(nodes['SRV-WEB'].mesh, {
    label: 'Serveur Web (Patcher CVE)',
    onClick: () => {
      state.cveWeb = true;
      sfx.click();
      bench.spawnPulseRing(nodes['SRV-WEB'].basePos, '#22c55e', 0.12);
      refreshAll();
    }
  });
  bench.addInteractive(nodes['SRV-BDD'].mesh, {
    label: 'Serveur BDD (Verrouiller SSH & SQL)',
    onClick: () => {
      state.cveBdd = true;
      sfx.click();
      bench.spawnPulseRing(nodes['SRV-BDD'].basePos, '#22c55e', 0.12);
      refreshAll();
    }
  });
  bench.addInteractive(edrUsbGroup, {
    label: 'Clé CielGuard EDR (Lancer Scan Laser)',
    onClick: startEdrScan
  });

  bench.addFloatingTag(() => nodes['FW-01'].basePos.clone().add(new THREE.Vector3(0, 0.08, 0)), isJpo ? 'Pare-feu' : 'FW-01', 'fw');
  bench.addFloatingTag(() => nodes['SRV-WEB'].basePos.clone().add(new THREE.Vector3(0, 0.1, 0)), isJpo ? 'Serveur Web' : 'SRV-WEB', 'web');
  bench.addFloatingTag(() => nodes['SRV-BDD'].basePos.clone().add(new THREE.Vector3(0, 0.1, 0)), isJpo ? 'Base de données' : 'SRV-BDD', 'bdd');
  bench.addFloatingTag(() => nodes['PC-WORK'].basePos.clone().add(new THREE.Vector3(0, 0.08, 0)), isJpo ? 'PC Infecté' : 'PC-WORK', 'pc');
  bench.addFloatingTag(() => new THREE.Vector3(0.56, 0.08, 0.22), isJpo ? 'Clé Antivirus' : 'Clé EDR', 'edr');

  bench.setCameras(CAM_VIEWS, state.camId, selectCamera);

  const attackOrbGeo = bench.track(new THREE.SphereGeometry(0.011, 8, 8));
  const attackRedMat = bench.track(new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  const attackOrangeMat = bench.track(new THREE.MeshBasicMaterial({ color: 0xf97316 }));

  let uiRefreshTimer = 0;
  bench.addUpdate((dt, elapsed) => {
    const st = getStats();
    nodes['FW-01'].mesh.rotation.y = elapsed * 0.6;
    if (fwDome.visible) {
      fwDome.rotation.y = -elapsed * 0.9;
      fwShieldWire.rotation.y = elapsed * 0.7;
      fwShieldWire.rotation.x = Math.sin(elapsed * 0.8) * 0.2;
      fwShieldRing.rotation.z = elapsed * 1.1;
    }
    if (edrShieldDome.visible) {
      edrShieldWire.rotation.y = -elapsed * 1.1;
      edrShieldRing.rotation.z = -elapsed * 1.3;
    }

    if (st.secured) {
      socAlertLight.color.set('#22c55e');
      socAlertLight.intensity = 1.25;
      socWallNeonMat.color.set('#22c55e');
      socWallNeonMat.emissive.set('#16a34a');
      socWallNeonMat.emissiveIntensity = 1.15;
    } else {
      const pulse = 0.65 + 0.55 * Math.abs(Math.sin(elapsed * 3.4));
      socAlertLight.color.set('#ef4444');
      socAlertLight.intensity = 1.1 * pulse;
      socWallNeonMat.color.set('#ef4444');
      socWallNeonMat.emissive.set('#dc2626');
      socWallNeonMat.emissiveIntensity = 0.55 + 0.65 * Math.abs(Math.sin(elapsed * 3.4));
    }

    socRackLeds.forEach((rl) => {
      if (st.secured && rl.isAlert) {
        rl.mat.color.set('#22c55e');
        rl.mat.emissive.set('#16a34a');
      } else if (!st.secured && rl.isAlert) {
        rl.mat.color.set('#ef4444');
        rl.mat.emissive.set('#ef4444');
      }
      rl.mat.emissiveIntensity = 0.35 + 0.85 * Math.abs(Math.sin(elapsed * 3.2 + rl.phase));
    });

    nodeActivityLeds.forEach((nl) => {
      const isOk =
        nl.nodeId === 'SRV-WEB'
          ? state.cveWeb && state.fw185
          : nl.nodeId === 'SRV-BDD'
          ? state.cveBdd && state.fw91
          : nl.nodeId === 'PC-WORK'
          ? state.edrDone
          : st.fwCount === 3;
      nl.mat.color.set(isOk ? '#22c55e' : nl.nodeId === 'PC-WORK' ? '#ef4444' : '#38bdf8');
      nl.mat.emissive.set(isOk ? '#16a34a' : nl.nodeId === 'PC-WORK' ? '#ef4444' : '#0284c7');
      nl.mat.emissiveIntensity = 0.3 + 1.0 * Math.abs(Math.sin(elapsed * 4.5 + nl.phase));
    });

    beamPulses.forEach((bp) => {
      const isWebOk = state.cveWeb && state.fw185;
      const isBddOk = state.cveBdd && state.fw91;
      const isFwOk = st.fwCount === 3;
      const isPcLink = bp.key === 'SW-CORE->PC-WORK';
      if (isPcLink && state.isolated && !state.edrDone) {
        bp.mesh.visible = false;
        return;
      }
      bp.mesh.visible = true;
      let segOk = isFwOk;
      if (bp.key === 'SW-CORE->SRV-WEB') segOk = isWebOk;
      else if (bp.key === 'SW-CORE->SRV-BDD') segOk = isBddOk;
      else if (isPcLink) segOk = state.edrDone;
      const speed = segOk ? 0.65 : 1.35;
      bp.t = (bp.t + dt * speed) % 1;
      const pos = bp.curve.getPoint(bp.t);
      bp.mesh.position.copy(pos);
      if (segOk) {
        bp.mat.color.set('#22c55e');
        bp.mesh.scale.setScalar(0.88);
      } else {
        const pulseScale = 0.85 + 0.45 * Math.abs(Math.sin(elapsed * 7 + bp.t * 6));
        bp.mat.color.set(bp.key === 'FW-01->SW-CORE' ? '#38bdf8' : '#ef4444');
        bp.mesh.scale.setScalar(pulseScale);
      }
    });

    if (st.activeThreats > 0 && !state.finished) {
      const drain = (!state.isolated ? 0.45 : 0.08) + (3 - st.fwCount) * 0.16 + (3 - st.cveCount) * 0.12;
      state.integrity = Math.max(15, state.integrity - drain * dt);
    }

    if (state.edrScanning) {
      state.scanPct = Math.min(100, state.scanPct + dt * 42);
      scanPlane.position.y = nodes['PC-WORK'].basePos.y - 0.04 + Math.abs(Math.sin(elapsed * 5)) * 0.1;
      if (state.scanPct >= 100) {
        state.edrScanning = false;
        state.edrDone = true;
        if (getStats().secured) {
          state.integrity = isJpo ? 100 : Math.min(100, state.integrity + 15);
        }
        scanPlane.visible = false;
        sfx.success();
        bench.spawnPulseRing(nodes['PC-WORK'].basePos, '#22c55e', 0.18);
        bench.showToast('Scan CielGuard EDR terminé : toutes les menaces ont été nettoyées !', 'success');
        refreshAll();
      }
    }

    packetSpawnTimer += dt;
    if (packetSpawnTimer > 0.35) {
      packetSpawnTimer = 0;
      if (!state.fw185 || !state.fw91) {
        const orb = new THREE.Mesh(attackOrbGeo, attackRedMat);
        bench.scene.add(orb);
        attackPackets.push({
          mesh: orb,
          from: nodes['FW-01'].basePos.clone().add(new THREE.Vector3(0, 0.04, -0.22)),
          to: state.fw185 ? nodes['FW-01'].basePos.clone() : nodes['SRV-WEB'].basePos.clone(),
          t: 0,
          speed: 1.4
        });
      }
      if (!state.isolated && !state.edrDone) {
        const orb = new THREE.Mesh(attackOrbGeo, attackOrangeMat);
        bench.scene.add(orb);
        attackPackets.push({
          mesh: orb,
          from: nodes['PC-WORK'].basePos.clone(),
          to: nodes['SRV-BDD'].basePos.clone(),
          t: 0,
          speed: 1.3
        });
      }
    }

    for (let i = attackPackets.length - 1; i >= 0; i--) {
      const p = attackPackets[i];
      p.t += dt * p.speed;
      if (p.t >= 1) {
        bench.scene.remove(p.mesh);
        attackPackets.splice(i, 1);
      } else {
        p.mesh.position.lerpVectors(p.from, p.to, p.t);
      }
    }

    uiRefreshTimer += dt;
    if (uiRefreshTimer >= 0.09) {
      uiRefreshTimer = 0;
      syncMonitorScreens(elapsed, false);
    }
  });

  bench.freezeStatic([
    nodes['FW-01'].mesh,
    fwDome,
    fwShieldWire,
    fwShieldRing,
    edrShieldDome,
    edrShieldWire,
    edrShieldRing,
    isoSwitch.leverPivot,
    fwSwitch.leverPivot,
    patchSwitch.leverPivot,
    scanPlane,
    ...beamPulses.map((b) => b.mesh)
  ]);

  refreshAll();

  return {
    destroy: () => {
      socKeypadCleanup?.();
      socKeypadCleanup = null;
      for (const p of attackPackets) {
        bench.scene.remove(p.mesh);
      }
      attackPackets.length = 0;
      bench.destroy();
    }
  };
}
