import { DEFAULT_SKIN } from '../world/AvatarBuilder.js';
import {
  EXTRA_STATIONS,
  PLATEAU_TEACHER_POS,
  TP_STATION_LAYOUT
} from '../world/plateauLayout.js';

export const TP_CATALOG = [
  {
    id: 'oscilloscope',
    title: 'TP Oscilloscope & Mesures 3D',
    shortTitle: 'Oscilloscope',
    icon: '〰️',
    pole: 'Métrologie & Signaux',
    room: TP_STATION_LAYOUT.oscilloscope.room,
    color: '#22d3ee',
    position: TP_STATION_LAYOUT.oscilloscope.position,
    brief:
      'Placez la sonde rouge et la pince de masse sur les points de test 3D, réglez Trigger/V/div/ms/div sur l’oscilloscope et remplacez le composant en panne.',
    teacherHint:
      '« Sur ton poste Oscilloscope 3D, commence par accrocher la pince noire sur GND, puis ajuste Trigger, V/div et Base de temps pour inspecter TP1, TP2 et TP3 ! »'
  },
  {
    id: 'soldering',
    title: 'TP Brasure & Soudure PCB 3D',
    shortTitle: 'Brasure PCB',
    icon: '🔥',
    pole: 'Assemblage Électronique',
    room: TP_STATION_LAYOUT.soldering.room,
    color: '#fb923c',
    position: TP_STATION_LAYOUT.soldering.position,
    brief:
      'Allumez l’extracteur de fumées, chauffez chaque pastille au fer 3D (340–365°C), apportez le fil d’étain sans brûler le PCB et mettez la carte sous tension.',
    teacherHint:
      '« Entre 340°C et 365°C, active l’extracteur, chauffe pastille + patte 2 à 3 secondes, dépose l’étain et retire le fer avant la zone rouge ! »'
  },
  {
    id: 'electronics',
    title: 'TP Breadboard, Multimètre & Résistances 3D',
    shortTitle: 'Électronique 3D',
    icon: '⚡',
    pole: 'Conception & Circuits',
    room: TP_STATION_LAYOUT.electronics.room,
    color: '#fbbf24',
    position: TP_STATION_LAYOUT.electronics.position,
    brief:
      'Mesurez les résistances au multimètre Fluke 3D, montez la LED 5V (Loi d’Ohm & polarité) et câblez le pont diviseur 5V → 3,3V pour ESP32 sur Breadboard.',
    teacherHint:
      '« Déchiffre le code couleur des résistances 3D au multimètre, respecte l’anode/cathode de la LED et choisis le bon pont diviseur pour protéger l’ESP32 à 3,3V ! »'
  },
  {
    id: 'antivirus',
    title: 'TP Cybersécurité & Défense SOC 3D',
    shortTitle: 'Cyber SOC',
    icon: '🛡️',
    pole: 'Cybersécurité Poste',
    room: TP_STATION_LAYOUT.antivirus.room,
    color: '#f43f5e',
    position: TP_STATION_LAYOUT.antivirus.position,
    brief:
      'Inspectez les trames d’attaque sur la carte réseau 3D en temps réel, basculez l’isolateur physique, bloquez les IP suspectes au pare-feu et patchez les serveurs.',
    teacherHint:
      '« Dès qu’un flux rouge apparaît sur la topologie 3D, isole d’abord le poste infecté avec son interrupteur matériel, bloque l’IP C2 puis déploie le correctif CVE ! »'
  },
  {
    id: 'vmvlan',
    title: 'TP Configuration VLAN, STP & Routage CLI 3D',
    shortTitle: 'VLAN & CLI 3D',
    icon: '🌐',
    pole: 'Réseaux & Virtualisation',
    room: TP_STATION_LAYOUT.vmvlan.room,
    color: '#34d399',
    position: TP_STATION_LAYOUT.vmvlan.position,
    brief:
      'Supprimez la boucle STP sur la maquette topologique 3D, configurez les VLAN 10/20/30, le Trunk 802.1Q et les passerelles en console CLI puis testez au Ping 3D.',
    teacherHint:
      '« Coupe d’abord la boucle Spanning-Tree rouge sur le switch L3 via la console du Laptop, crée les VLANs et les passerelles /24 puis envoie un Ping 3D entre zones ! »'
  }
];

export { EXTRA_STATIONS };

export const QUICK_EMOTES = [
  { id: 'wave', key: '1', label: '👋 Salut !' },
  { id: 'gg', key: '2', label: '👍 Bien joué !' },
  { id: 'tp', key: '3', label: '⚡ Go TP !' },
  { id: 'help', key: '4', label: '🤔 Besoin d’aide' },
  { id: 'fire', key: '5', label: '🔥 En feu !' },
  { id: 'party', key: '6', label: '🎉 GG la classe !' }
];

export const TEACHER_POS = PLATEAU_TEACHER_POS;

export function detectTouchDevice() {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
}

export function getTpById(id) {
  return TP_CATALOG.find((t) => t.id === id) || null;
}

export function getStationById(id) {
  return getTpById(id) || EXTRA_STATIONS.find((s) => s.id === id) || null;
}

export function getMention(avg) {
  if (avg === null || avg === undefined) return 'En cours';
  if (avg >= 16) return 'Mention Très Bien';
  if (avg >= 14) return 'Mention Bien';
  if (avg >= 12) return 'Mention Assez Bien';
  if (avg >= 10) return 'Admis (BAC PRO CIEL)';
  return 'À consolider';
}

export class GameState {
  constructor() {
    this.profile = {
      name: 'Eleve_CIEL',
      color: '#22d3ee',
      skin: { ...DEFAULT_SKIN },
      xp: 0,
      questAccepted: false,
      grades: {},
      bestTimes: {},
      average: null,
      completedCount: 0,
      diplomaEarned: false,
      diplomas: [],
      rank: null,
      rankLabel: 'Apprenti CIEL'
    };
    this.room = 'plateau-u300';
    this.roomRoster = [];
    this.leaderboard = [];
    this.quality = localStorage.getItem('ciel_quality') || 'high';
    this.cameraMode = localStorage.getItem('ciel_camera_mode') === 'third' ? 'third' : 'first';
    const savedTouch = localStorage.getItem('ciel_touch_mode');
    this.touchMode = savedTouch === '1' ? true : savedTouch === '0' ? false : detectTouchDevice();
    const savedFov = Number(localStorage.getItem('ciel_fov'));
    this.fov = Number.isFinite(savedFov) && savedFov >= 50 && savedFov <= 110 ? savedFov : 70;
    const savedSens = Number(localStorage.getItem('ciel_sens'));
    this.mouseSens = Number.isFinite(savedSens) && savedSens >= 0.4 && savedSens <= 2.2 ? savedSens : 1.0;
    try {
      const rawSkin = JSON.parse(localStorage.getItem('ciel_skin') || 'null');
      this.skin = rawSkin ? { ...DEFAULT_SKIN, ...rawSkin } : { ...DEFAULT_SKIN };
    } catch {
      this.skin = { ...DEFAULT_SKIN };
    }
    this.listeners = new Set();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    for (const fn of this.listeners) fn(this);
  }

  setProfile(profile) {
    if (!profile) return;
    this.profile = { ...this.profile, ...profile };
    this.emit();
  }

  setLeaderboard(list) {
    if (!Array.isArray(list)) return;
    this.leaderboard = list;
    this.emit();
  }

  setRoomRoster(roster) {
    if (!Array.isArray(roster)) return;
    this.roomRoster = roster;
    this.emit();
  }

  setQuality(q) {
    this.quality = q;
    localStorage.setItem('ciel_quality', q);
    this.emit();
  }

  setFov(fov) {
    const clamped = Math.max(50, Math.min(110, Math.round(Number(fov) || 70)));
    this.fov = clamped;
    localStorage.setItem('ciel_fov', String(clamped));
    this.emit();
  }

  setMouseSens(sens) {
    const clamped = Math.max(0.4, Math.min(2.2, Math.round(Number(sens) * 10) / 10 || 1.0));
    this.mouseSens = clamped;
    localStorage.setItem('ciel_sens', String(clamped));
    this.emit();
  }

  setSkin(skin) {
    this.skin = { ...DEFAULT_SKIN, ...this.skin, ...skin };
    localStorage.setItem('ciel_skin', JSON.stringify(this.skin));
    this.emit();
  }

  setCameraMode(mode) {
    this.cameraMode = mode === 'third' ? 'third' : 'first';
    localStorage.setItem('ciel_camera_mode', this.cameraMode);
    this.emit();
  }

  setTouchMode(enabled) {
    this.touchMode = Boolean(enabled);
    localStorage.setItem('ciel_touch_mode', this.touchMode ? '1' : '0');
    this.emit();
  }

  getNextSuggestedTp() {
    return (
      TP_CATALOG.find((tp) => {
        const g = this.profile.grades[tp.id];
        return typeof g !== 'number' || g < 10;
      }) || null
    );
  }
}
