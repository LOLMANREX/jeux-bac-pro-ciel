import { DEFAULT_SKIN } from '../world/AvatarBuilder.js';
import {
  EXTRA_STATIONS,
  PLATEAU_TEACHER_POS,
  TP_STATION_LAYOUT
} from '../world/plateauLayout.js';

export const TP_CATALOG = [
  {
    id: 'oscilloscope',
    title: 'TP Oscilloscope',
    shortTitle: 'Oscilloscope',
    icon: '〰️',
    pole: 'Métrologie & Signaux',
    room: TP_STATION_LAYOUT.oscilloscope.room,
    color: '#22d3ee',
    position: TP_STATION_LAYOUT.oscilloscope.position,
    brief:
      'Calibrez la base de temps, le gain vertical et le déclenchement (Trigger) pour mesurer fréquence, amplitude et PWM.',
    teacherHint:
      '« Rendez-vous en salle U302 ! Pensez à placer le Trigger dans l’amplitude du signal puis ajustez V/div et ms/div pour lire 2 à 4 périodes propres. »'
  },
  {
    id: 'soldering',
    title: 'TP Brasure PCB',
    shortTitle: 'Brasure',
    icon: '🔥',
    pole: 'Assemblage Électronique',
    room: TP_STATION_LAYOUT.soldering.room,
    color: '#fb923c',
    position: TP_STATION_LAYOUT.soldering.position,
    brief:
      'Réglez votre station à ~350°C sans plomb, activez l’extracteur de fumées, chauffez pastille + patte et formez une brasure brillante.',
    teacherHint:
      '« Direction la salle U301 ! Entre 340°C et 365°C, activez l’extracteur de fumées, chauffez pastille + patte et utilisez la tresse si deux broches font un pont. »'
  },
  {
    id: 'electronics',
    title: 'TP Électronique',
    shortTitle: 'Électronique',
    icon: '⚡',
    pole: 'Conception & Circuits',
    room: TP_STATION_LAYOUT.electronics.room,
    color: '#fbbf24',
    position: TP_STATION_LAYOUT.electronics.position,
    brief:
      'Décodez les résistances, appliquez la loi d’Ohm, montez vos composants dans le bon sens et validez au multimètre.',
    teacherHint:
      '« En salle U302, vérifiez la polarité de la LED (Anode au +) et calculez R = (U_alim - U_LED) / I avant de mettre sous tension ! »'
  },
  {
    id: 'antivirus',
    title: 'TP PC Infecté & Antivirus',
    shortTitle: 'Antivirus',
    icon: '🛡️',
    pole: 'Cybersécurité Poste',
    room: TP_STATION_LAYOUT.antivirus.room,
    color: '#f43f5e',
    position: TP_STATION_LAYOUT.antivirus.position,
    brief:
      'Un poste de la salle SOC U305 est envahi de malwares ! Isolez le réseau, tuez les processus suspects, installez et mettez à jour l’antivirus.',
    teacherHint:
      '« En salle Cyber U305, premier réflexe : isolez le réseau pour stopper l’exfiltration, tuez les processus malveillants puis lancez un scan CielGuard complet ! »'
  },
  {
    id: 'vmvlan',
    title: 'TP VM & VLAN Complet',
    shortTitle: 'VM & VLAN',
    icon: '🌐',
    pole: 'Réseaux & Virtualisation',
    room: TP_STATION_LAYOUT.vmvlan.room,
    color: '#34d399',
    position: TP_STATION_LAYOUT.vmvlan.position,
    brief:
      'Allouez les VMs sur l’hyperviseur en U307, configurez les ports Access/Trunk 802.1Q, le routage inter-VLAN et les règles pare-feu puis testez le ping !',
    teacherHint:
      '« En salle Réseau U307, un port vers un PC = ACCESS sur son VLAN, et un lien switch-hyperviseur ou switch-routeur = TRUNK 802.1Q ! »'
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
