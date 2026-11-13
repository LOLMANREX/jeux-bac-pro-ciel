import * as THREE from 'three';
import { sfx } from '../core/audio.js';
import {
  createWorkbench3D,
  makeCanvasScreen,
  buildFlexibleCable,
  createEsdMatTexture
} from './Workbench3DHost.js';

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
  let pts = 0;
  if (metrics.isolatedCompromised) pts += 4;
  const fwTotal = Math.max(1, metrics.firewallTotal || 3);
  const fwDone = Math.min(fwTotal, metrics.firewallBlockedCount || 0);
  pts += (fwDone / fwTotal) * 5;

  const cveTotal = Math.max(1, metrics.cveTotal || 3);
  const cveDone = Math.min(cveTotal, metrics.cvePatchedCount || 0);
  pts += (cveDone / cveTotal) * 5;

  if (metrics.edrScanDone) pts += 3;

  const integ = Math.max(0, Math.min(100, metrics.integrityRemaining ?? 0));
  pts += (integ / 100) * 3;

  const mistakes = Math.max(0, metrics.mistakes || 0);
  const elapsed = metrics.elapsedSec || 0;
  const timePenalty = elapsed > 200 ? Math.min(1.5, (elapsed - 200) / 100) : 0;
  const score = Math.max(0, Math.min(20, Math.round(pts - mistakes * 1.2 - timePenalty)));
  const xp = Math.max(50, Math.round(score * 16 + (integ >= 70 ? 60 : 20)));
  const accuracy = Math.round((score / 20) * 100);
  return { score, xp, accuracy };
}

export function createAntivirusGame(api) {
  const bench = createWorkbench3D(api.container, {
    cameraPos: [0.0, 0.92, 1.18],
    lookAt: [0.0, 0.22, -0.08],
    fov: 40,
    hasEsdMat: false
  });

  const esdTex = createEsdMatTexture('#0f172a', '#0ea5e9');
  const deskSurface = new THREE.Mesh(
    new THREE.BoxGeometry(1.75, 0.012, 0.96),
    new THREE.MeshStandardMaterial({ map: esdTex, roughness: 0.65 })
  );
  deskSurface.position.set(0, 0.006, 0.02);
  deskSurface.receiveShadow = true;
  bench.scene.add(deskSurface);

  const darkFrame = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.42, metalness: 0.65 });

  function makeSocMonitor(x, z, rotY, width = 0.52, height = 0.30) {
    const grp = new THREE.Group();
    grp.position.set(x, 0.012, z);
    grp.rotation.y = rotY;
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.014, 0.11), darkFrame);
    stand.position.y = 0.007;
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.22, 0.028), darkFrame);
    neck.position.set(0, 0.11, -0.018);
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(width + 0.03, height + 0.03, 0.024), darkFrame);
    bezel.position.set(0, 0.27, 0);
    bezel.castShadow = true;
    grp.add(stand, neck, bezel);
    bench.scene.add(grp);
    return { grp, width, height };
  }

  const mLeft = makeSocMonitor(-0.54, -0.26, 0.36);
  const mCenter = makeSocMonitor(0.0, -0.34, 0.0, 0.56, 0.32);
  const mRight = makeSocMonitor(0.54, -0.26, -0.36);

  const idsScreen = makeCanvasScreen(512, 320, (ctx, w, h, st) => {
    ctx.fillStyle = '#070b12';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, 34);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('IDS WIRESHARK — ANALYSE FLUX SOC', 12, 23);

    const s = st || {};
    const logs = [
      { blocked: s.fw185, text: s.fw185 ? '[BLOCKED] 185.42.19.88 -> SRV-WEB:443 (DDoS)' : '[ALERT] 185.42.19.88 -> SRV-WEB:443 SYN FLOOD!' },
      { blocked: s.fw91, text: s.fw91 ? '[BLOCKED] 91.203.11.4 -> SRV-BDD:22 (SSH)' : '[ALERT] 91.203.11.4 -> SRV-BDD:22 BRUTEFORCE!' },
      { blocked: s.fw4444, text: s.fw4444 ? '[DROPPED] PC-WORK -> Port 4444 C2 EXFIL' : '[CRITICAL] PC-WORK -> 45.14.9.1:4444 C2 OPEN!' },
      { blocked: s.isolated, text: s.isolated ? '[ISOLATED] PC-WORK coupé du Switch SW-CORE' : '[LATERAL] PC-WORK SMB scan -> SRV-BDD!' },
      { blocked: s.edrDone, text: s.edrDone ? '[CLEAN] CielGuard EDR : 0 menace active' : '[INFECTED] svch0st.exe + cryptolocker actifs' }
    ];
    logs.forEach((l, i) => {
      ctx.fillStyle = l.blocked ? '#4ade80' : '#f87171';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(l.text, 12, 72 + i * 42);
    });
  });

  const centerScreen = makeCanvasScreen(512, 320, (ctx, w, h, st) => {
    const s = st || { integrity: 100, activeThreats: 8, cveCount: 0, fwCount: 0 };
    ctx.fillStyle = s.integrity < 40 ? '#1f0b0e' : '#081224';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, w, 38);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 17px monospace';
    ctx.fillText('CIEL SOC — INTÉGRITÉ INFRASTRUCTURE', 14, 25);

    ctx.fillStyle = s.integrity >= 70 ? '#4ade80' : s.integrity >= 40 ? '#fbbf24' : '#ef4444';
    ctx.font = 'bold 54px monospace';
    ctx.fillText(`${Math.round(s.integrity)}%`, 24, 114);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(24, 134, w - 48, 22);
    ctx.fillStyle = s.integrity >= 70 ? '#22c55e' : s.integrity >= 40 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(24, 134, ((w - 48) * Math.max(0, s.integrity)) / 100, 22);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '15px monospace';
    ctx.fillText(`Attaques actives : ${s.activeThreats}  |  CVE patchées : ${s.cveCount}/3`, 24, 198);
    ctx.fillText(`Pare-feu : ${s.fwCount}/3 règles  |  EDR : ${s.edrDone ? 'SAIN' : s.edrScanning ? 'SCAN...' : 'REQUIS'}`, 24, 232);
    ctx.fillStyle = s.secured ? '#4ade80' : '#facc15';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(s.secured ? 'RÉSEAU SÉCURISÉ — PRÊT POUR VALIDATION' : 'INTERVENEZ SUR L’HOLOGRAMME & LE PANNEAU SOC', 24, 282);
  });

  const rightScreen = makeCanvasScreen(512, 320, (ctx, w, h, st) => {
    const s = st || { scanPct: 0 };
    ctx.fillStyle = '#070c16';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, 34);
    ctx.fillStyle = '#a855f7';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('SYSTÈMES & CORRECTIFS CVE', 14, 23);

    const items = [
      { ok: s.cveWeb, label: 'CVE-2024 Apache (SRV-WEB) + Process' },
      { ok: s.cveBdd, label: 'Patch SQL & Verrou SSH (SRV-BDD)' },
      { ok: s.cveHost, label: 'Quarantaine svch0st.exe (typosquat)' }
    ];
    items.forEach((it, idx) => {
      ctx.fillStyle = it.ok ? '#4ade80' : '#fbbf24';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`${it.ok ? '[OK]' : '[VULN]'} ${it.label}`, 16, 86 + idx * 54);
    });
    ctx.fillStyle = s.edrDone ? '#38bdf8' : '#94a3b8';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`Clé CielGuard EDR : ${s.edrDone ? 'TERMINÉ ✔' : s.edrScanning ? `ANALYSE ${Math.round(s.scanPct)}%` : 'NON LANCÉE'}`, 16, 268);
  });

  const pLeft = new THREE.Mesh(new THREE.PlaneGeometry(mLeft.width, mLeft.height), new THREE.MeshBasicMaterial({ map: idsScreen.texture }));
  pLeft.position.set(0, 0.27, 0.013);
  mLeft.grp.add(pLeft);

  const pCenter = new THREE.Mesh(new THREE.PlaneGeometry(mCenter.width, mCenter.height), new THREE.MeshBasicMaterial({ map: centerScreen.texture }));
  pCenter.position.set(0, 0.27, 0.013);
  mCenter.grp.add(pCenter);

  const pRight = new THREE.Mesh(new THREE.PlaneGeometry(mRight.width, mRight.height), new THREE.MeshBasicMaterial({ map: rightScreen.texture }));
  pRight.position.set(0, 0.27, 0.013);
  mRight.grp.add(pRight);

  const holoPad = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.50, 0.02, 36),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.75 })
  );
  holoPad.position.set(0, 0.022, 0.04);
  holoPad.receiveShadow = true;
  bench.scene.add(holoPad);

  const holoRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.44, 0.008, 12, 48),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 1.5 })
  );
  holoRing.rotation.x = Math.PI / 2;
  holoRing.position.set(0, 0.033, 0.04);
  bench.scene.add(holoRing);

  const nodeDefs = [
    { id: 'FW-01', pos: new THREE.Vector3(0, 0.14, -0.14), color: 0x38bdf8, size: [0.08, 0.08, 0.05] },
    { id: 'SW-CORE', pos: new THREE.Vector3(0, 0.12, 0.04), color: 0x60a5fa, size: [0.10, 0.045, 0.08] },
    { id: 'SRV-WEB', pos: new THREE.Vector3(-0.24, 0.15, 0.10), color: 0xf59e0b, size: [0.075, 0.13, 0.075] },
    { id: 'SRV-BDD', pos: new THREE.Vector3(0.0, 0.15, 0.24), color: 0x22c55e, size: [0.075, 0.13, 0.075] },
    { id: 'PC-WORK', pos: new THREE.Vector3(0.24, 0.13, 0.10), color: 0xef4444, size: [0.085, 0.08, 0.075] }
  ];

  const nodes = {};
  for (const nd of nodeDefs) {
    const mat = new THREE.MeshStandardMaterial({
      color: nd.color,
      emissive: nd.color,
      emissiveIntensity: nd.id === 'PC-WORK' ? 1.5 : 0.6,
      roughness: 0.28,
      metalness: 0.45,
      transparent: true,
      opacity: 0.92
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...nd.size), mat);
    mesh.position.copy(nd.pos);
    mesh.castShadow = true;
    bench.scene.add(mesh);
    nodes[nd.id] = { mesh, mat, basePos: nd.pos.clone() };
  }

  const fwDomeMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.18,
    depthWrite: false
  });
  const fwDome = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 16), fwDomeMat);
  fwDome.position.copy(nodes['FW-01'].basePos);
  fwDome.visible = false;
  bench.scene.add(fwDome);

  const linkPairs = [
    ['FW-01', 'SW-CORE', 0x38bdf8],
    ['SW-CORE', 'SRV-WEB', 0x60a5fa],
    ['SW-CORE', 'SRV-BDD', 0x60a5fa],
    ['SW-CORE', 'PC-WORK', 0xef4444]
  ];
  const linkCables = {};
  for (const [a, b, c] of linkPairs) {
    const cable = buildFlexibleCable([nodes[a].basePos.clone(), nodes[b].basePos.clone()], c, 0.005, c);
    bench.scene.add(cable.mesh);
    linkCables[`${a}->${b}`] = cable;
  }

  function makeToggleSwitch(x, z, baseColor) {
    const grp = new THREE.Group();
    grp.position.set(x, 0.032, z);
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(0.085, 0.018, 0.07),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45 })
    );
    const leverPivot = new THREE.Group();
    leverPivot.position.set(0, 0.012, 0);
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.045, 10),
      new THREE.MeshStandardMaterial({ color: baseColor, metalness: 0.7, roughness: 0.25 })
    );
    stick.position.y = 0.022;
    leverPivot.add(stick);
    leverPivot.rotation.x = -0.45;
    const ledMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.5 });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 10, 8), ledMat);
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
    new THREE.BoxGeometry(0.042, 0.018, 0.095),
    new THREE.MeshStandardMaterial({ color: 0x0ea5e9, emissive: 0x0284c7, emissiveIntensity: 0.45, roughness: 0.28 })
  );
  const usbTip = new THREE.Mesh(
    new THREE.BoxGeometry(0.028, 0.012, 0.024),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 })
  );
  usbTip.position.z = -0.055;
  edrUsbGroup.add(usbBody, usbTip);
  bench.scene.add(edrUsbGroup);

  const scanPlaneMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide
  });
  const scanPlane = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.14, 24), scanPlaneMat);
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
    { id: 'soc', label: 'Poste SOC', pos: [0.0, 0.92, 1.18], lookAt: [0.0, 0.22, -0.08], fov: 40 },
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

  function updateScreensAndVisuals() {
    const st = getStats();
    idsScreen.update({
      fw185: state.fw185,
      fw91: state.fw91,
      fw4444: state.fw4444,
      isolated: state.isolated,
      edrDone: state.edrDone
    });
    centerScreen.update({
      integrity: state.integrity,
      activeThreats: st.activeThreats,
      cveCount: st.cveCount,
      fwCount: st.fwCount,
      edrDone: state.edrDone,
      edrScanning: state.edrScanning,
      secured: st.secured
    });
    rightScreen.update({
      cveWeb: state.cveWeb,
      cveBdd: state.cveBdd,
      cveHost: state.cveHost,
      edrDone: state.edrDone,
      edrScanning: state.edrScanning,
      scanPct: state.scanPct
    });

    fwDome.visible = st.fwCount > 0;
    fwDomeMat.opacity = 0.12 + st.fwCount * 0.08;

    nodes['PC-WORK'].mat.color.setHex(state.edrDone ? 0x22c55e : state.isolated ? 0xf59e0b : 0xef4444);
    nodes['PC-WORK'].mat.emissive.setHex(state.edrDone ? 0x16a34a : state.isolated ? 0xd97706 : 0xef4444);
    nodes['SRV-WEB'].mat.color.setHex(state.cveWeb && state.fw185 ? 0x22c55e : 0xf59e0b);
    nodes['SRV-WEB'].mat.emissive.setHex(state.cveWeb && state.fw185 ? 0x16a34a : 0xd97706);

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
  }

  function renderSideDrawer() {
    const html = `
      <h4>Console Cyber-Défense SOC</h4>
      <div style="font-size:12px;color:#475569;margin-bottom:8px;">
        Stoppez les attaques en cours avant que l’intégrité serveur ne chute !
      </div>
      <div style="display:grid;gap:6px;margin-bottom:10px;">
        <button class="tp3d-tool-btn ${state.isolated ? 'active' : ''}" id="soc-iso">
          ${state.isolated ? '✔ PC-WORK Isolé du réseau' : '1. Isoler PC-WORK (Couper propagation)'}
        </button>
      </div>
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#475569;margin:6px 0 4px;">Pare-feu Périmétrique (FW-01)</div>
      <div style="display:grid;gap:5px;margin-bottom:10px;">
        <button class="tp3d-tool-btn ${state.fw185 ? 'active' : ''}" id="soc-fw-185">
          ${state.fw185 ? '✔ IP 185.42.19.88 bloquée (DDoS)' : 'Bloquer IP 185.42.19.88 (DDoS Web)'}
        </button>
        <button class="tp3d-tool-btn ${state.fw91 ? 'active' : ''}" id="soc-fw-91">
          ${state.fw91 ? '✔ IP 91.203.11.4 bloquée (SSH)' : 'Bloquer IP 91.203.11.4 (SSH Bruteforce)'}
        </button>
        <button class="tp3d-tool-btn ${state.fw4444 ? 'active' : ''}" id="soc-fw-4444">
          ${state.fw4444 ? '✔ Port 4444 C2 fermé' : 'Fermer Port 4444 (Backdoor C2)'}
        </button>
      </div>
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#475569;margin:6px 0 4px;">Correctifs & Processus</div>
      <div style="display:grid;gap:5px;margin-bottom:10px;">
        <button class="tp3d-tool-btn ${state.cveWeb ? 'active' : ''}" id="soc-cve-web">
          ${state.cveWeb ? '✔ SRV-WEB Patché (CVE Apache)' : 'Patcher CVE sur SRV-WEB'}
        </button>
        <button class="tp3d-tool-btn ${state.cveBdd ? 'active' : ''}" id="soc-cve-bdd">
          ${state.cveBdd ? '✔ SRV-BDD Sécurisé (SQL/SSH)' : 'Patcher & Verrouiller SRV-BDD'}
        </button>
        <button class="tp3d-tool-btn ${state.cveHost ? 'active' : ''}" id="soc-cve-host">
          ${state.cveHost ? '✔ Faux svch0st.exe supprimé' : 'Tuer svch0st.exe (typosquatting !)'}
        </button>
        <button class="tp3d-tool-btn" id="soc-false-svchost">
          Tuer svchost.exe (System32)
        </button>
      </div>
      <button class="tp3d-act-btn primary" id="soc-edr-scan" style="width:100%;" ${state.edrDone || state.edrScanning ? 'disabled' : ''}>
        ${state.edrDone ? '✔ Scan CielGuard EDR Terminé' : state.edrScanning ? `Scan EDR en cours (${Math.round(state.scanPct)}%)` : 'Lancer Scan Laser CielGuard EDR'}
      </button>
    `;

    const drawer = bench.setSideDrawer(html);
    if (!drawer) return;

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
      state.integrity = Math.max(10, state.integrity - 6);
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
      `
    );
  }

  function refreshHud() {
    const st = getStats();
    bench.setInstruction(
      st.secured ? 'SOC SÉCURISÉ' : 'ALERTE CYBER SOC 3D',
      st.secured
        ? 'Toutes les menaces sont neutralisées ! Validez votre rapport SOC'
        : `Intégrité : ${Math.round(state.integrity)}% · ${st.activeThreats} menace(s) active(s)`,
      'Cliquez sur les interrupteurs 3D / nœuds holographiques ou utilisez la console SOC pour isoler PC-WORK, bloquer le pare-feu, patcher les CVE et scanner à l’EDR.'
    );
    bench.setAccuracy(`Intégrité ${Math.round(state.integrity)}% · FW ${st.fwCount}/3 · CVE ${st.cveCount}/3`);

    const actions = [
      { id: 'reset', label: 'Réinitialiser', onClick: resetSoc },
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

  bench.addFloatingTag(() => nodes['FW-01'].basePos.clone().add(new THREE.Vector3(0, 0.08, 0)), 'FW-01', 'fw');
  bench.addFloatingTag(() => nodes['SRV-WEB'].basePos.clone().add(new THREE.Vector3(0, 0.1, 0)), 'SRV-WEB', 'web');
  bench.addFloatingTag(() => nodes['SRV-BDD'].basePos.clone().add(new THREE.Vector3(0, 0.1, 0)), 'SRV-BDD', 'bdd');
  bench.addFloatingTag(() => nodes['PC-WORK'].basePos.clone().add(new THREE.Vector3(0, 0.08, 0)), 'PC-WORK', 'pc');
  bench.addFloatingTag(() => new THREE.Vector3(0.56, 0.08, 0.22), 'Clé EDR', 'edr');

  bench.setCameras(CAM_VIEWS, state.camId, selectCamera);

  let uiRefreshTimer = 0;
  bench.addUpdate((dt, elapsed) => {
    const st = getStats();
    nodes['FW-01'].mesh.rotation.y = elapsed * 0.6;
    if (fwDome.visible) fwDome.rotation.y = -elapsed * 0.9;

    if (st.activeThreats > 0 && !state.finished) {
      const drain = (!state.isolated ? 1.3 : 0.2) + (3 - st.fwCount) * 0.45 + (3 - st.cveCount) * 0.35;
      state.integrity = Math.max(15, state.integrity - drain * dt);
    }

    if (state.edrScanning) {
      state.scanPct = Math.min(100, state.scanPct + dt * 42);
      scanPlane.position.y = nodes['PC-WORK'].basePos.y - 0.04 + Math.abs(Math.sin(elapsed * 5)) * 0.1;
      if (state.scanPct >= 100) {
        state.edrScanning = false;
        state.edrDone = true;
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
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 8), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
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
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 8), new THREE.MeshBasicMaterial({ color: 0xf97316 }));
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
    if (uiRefreshTimer > 0.25) {
      uiRefreshTimer = 0;
      centerScreen.update({
        integrity: state.integrity,
        activeThreats: st.activeThreats,
        cveCount: st.cveCount,
        fwCount: st.fwCount,
        edrDone: state.edrDone,
        edrScanning: state.edrScanning,
        secured: st.secured
      });
      rightScreen.update({
        cveWeb: state.cveWeb,
        cveBdd: state.cveBdd,
        cveHost: state.cveHost,
        edrDone: state.edrDone,
        edrScanning: state.edrScanning,
        scanPct: state.scanPct
      });
    }
  });

  refreshAll();

  return {
    destroy: () => bench.destroy()
  };
}
