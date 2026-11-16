import {
  applySessionDivineSkin,
  DEFAULT_SKIN,
  normalizeSkin,
  resolveAscensionSpecialty
} from '../world/AvatarBuilder.js';
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
    title: 'TP Configuration VLAN 802.1Q, Trunk & Routage 3D',
    shortTitle: 'VLAN 802.1Q 3D',
    icon: '🌐',
    pole: 'Réseaux & Virtualisation',
    room: TP_STATION_LAYOUT.vmvlan.room,
    color: '#34d399',
    position: TP_STATION_LAYOUT.vmvlan.position,
    brief:
      'Créez VLAN 10 ADMIN / 20 ATELIER / 30 INVITES dans la console du PC portable, configurez les ports Access & le Trunk 802.1Q, corrigez les passerelles et testez au Ping/Traceroute 3D.',
    teacherHint:
      '« Sur ton terminal console, crée d’abord les VLANs 10, 20 et 30, passe Gi0/24 en Trunk 802.1Q, corrige les passerelles .20.254 et .30.254 puis lance Ping et Traceroute sur la maquette 3D ! »'
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
      unlockedDivineSkins: [],
      selectedSkin: 'standard',
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
    this.account = null;
    this.authToken = localStorage.getItem('ciel_auth_token') || '';
    this.unlockedDivineSkins = [];
    this.selectedSkin = 'standard';
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
    this.voiceMode = localStorage.getItem('ciel_voice_mode') === 'ptt' ? 'ptt' : 'open';
    const savedTpVoice = localStorage.getItem('ciel_voice_tp_mode');
    this.voiceTpMode = ['active', 'duck', 'mute'].includes(savedTpVoice) ? savedTpVoice : 'duck';
    const savedVoiceVol = Number(localStorage.getItem('ciel_voice_volume'));
    this.voiceVolume =
      Number.isFinite(savedVoiceVol) && savedVoiceVol >= 0 && savedVoiceVol <= 1.5 ? savedVoiceVol : 1.0;
    try {
      const rawSkin = JSON.parse(localStorage.getItem('ciel_skin') || 'null');
      this.skin = rawSkin ? normalizeSkin({ ...DEFAULT_SKIN, ...rawSkin }) : { ...DEFAULT_SKIN };
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

  isAuthenticated() {
    return Boolean(this.account && this.account.username && this.authToken);
  }

  setAccount(account, token = null, profile = null) {
    if (!account) return;
    this.account = { ...account };
    if (token !== null && token !== undefined) {
      this.authToken = String(token).trim();
      if (this.authToken) {
        localStorage.setItem('ciel_auth_token', this.authToken);
      }
    }
    const unlocked = Array.isArray(account.unlockedDivineSkins)
      ? [...new Set(account.unlockedDivineSkins.map((s) => resolveAscensionSpecialty(s).id))]
      : [];
    this.unlockedDivineSkins = unlocked;

    const customSkin = normalizeSkin(
      account.avatarCustomization || profile?.skin || this.skin || DEFAULT_SKIN
    );
    const rawSel = account.selectedSkin || customSkin.divineSpecialty || 'standard';
    if (rawSel && rawSel !== 'standard' && rawSel !== 'default') {
      const spec = resolveAscensionSpecialty(rawSel);
      this.selectedSkin = spec.id;
      this.skin = applySessionDivineSkin(customSkin, spec.id);
      if (!this.unlockedDivineSkins.includes(spec.id)) {
        this.unlockedDivineSkins.push(spec.id);
      }
    } else {
      this.selectedSkin = 'standard';
      const plainSkin = { ...customSkin };
      delete plainSkin.divineSpecialty;
      this.skin = plainSkin;
    }

    localStorage.setItem('ciel_skin', JSON.stringify(this.skin));
    localStorage.setItem('ciel_player_name', account.username);

    const nextGrades = {
      ...(profile?.grades || {}),
      ...(account.tpScores || {})
    };
    const coreVals = TP_CATALOG.map((item) => nextGrades[item.id]).filter(
      (v) => typeof v === 'number'
    );
    const avg =
      profile?.average ??
      (coreVals.length
        ? Math.round((coreVals.reduce((a, b) => a + b, 0) / coreVals.length) * 10) / 10
        : null);
    const completedCount =
      profile?.completedCount ?? coreVals.filter((v) => v >= 10).length;
    const diplomaEarned = Boolean(profile?.diplomaEarned || completedCount === TP_CATALOG.length);

    this.profile = {
      ...this.profile,
      ...(profile || {}),
      name: account.username,
      skin: { ...this.skin },
      unlockedDivineSkins: [...this.unlockedDivineSkins],
      selectedSkin: this.selectedSkin,
      grades: nextGrades,
      average: avg,
      completedCount,
      diplomaEarned,
      xp: profile?.xp ?? account.xp ?? this.profile.xp
    };
    this.emit();
  }

  clearAccount() {
    this.account = null;
    this.authToken = '';
    this.unlockedDivineSkins = [];
    this.selectedSkin = 'standard';
    this.skin = { ...DEFAULT_SKIN };
    localStorage.removeItem('ciel_auth_token');
    localStorage.removeItem('ciel_player_name');
    localStorage.removeItem('ciel_skin');
    this.profile = {
      name: 'Eleve_CIEL',
      color: '#22d3ee',
      skin: { ...DEFAULT_SKIN },
      unlockedDivineSkins: [],
      selectedSkin: 'standard',
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
    this.emit();
  }

  unlockDivineSkin(specialtyInput, equip = true) {
    const spec = resolveAscensionSpecialty(specialtyInput);
    if (!this.unlockedDivineSkins.includes(spec.id)) {
      this.unlockedDivineSkins = [...this.unlockedDivineSkins, spec.id];
    }
    this.profile = {
      ...this.profile,
      unlockedDivineSkins: [...this.unlockedDivineSkins]
    };
    if (this.account) {
      this.account = {
        ...this.account,
        unlockedDivineSkins: [...this.unlockedDivineSkins]
      };
    }
    if (equip) {
      this.equipDivineSkin(spec.id);
    } else {
      this.emit();
    }
    return spec;
  }

  equipDivineSkin(specialtyOrStandard) {
    if (
      !specialtyOrStandard ||
      specialtyOrStandard === 'standard' ||
      specialtyOrStandard === 'default' ||
      specialtyOrStandard === 'none'
    ) {
      const nextSkin = { ...this.skin };
      delete nextSkin.divineSpecialty;
      this.skin = nextSkin;
      this.selectedSkin = 'standard';
    } else {
      const spec = resolveAscensionSpecialty(specialtyOrStandard);
      this.selectedSkin = spec.id;
      this.skin = applySessionDivineSkin(this.skin, spec.id);
      if (!this.unlockedDivineSkins.includes(spec.id)) {
        this.unlockedDivineSkins = [...this.unlockedDivineSkins, spec.id];
      }
    }
    localStorage.setItem('ciel_skin', JSON.stringify(this.skin));
    this.profile = {
      ...this.profile,
      skin: { ...this.skin },
      selectedSkin: this.selectedSkin,
      unlockedDivineSkins: [...this.unlockedDivineSkins]
    };
    if (this.account) {
      this.account = {
        ...this.account,
        selectedSkin: this.selectedSkin,
        avatarCustomization: { ...this.skin },
        unlockedDivineSkins: [...this.unlockedDivineSkins]
      };
    }
    this.emit();
  }

  setProfile(profile) {
    if (!profile) return;
    if (Array.isArray(profile.unlockedDivineSkins)) {
      const merged = [
        ...new Set([
          ...this.unlockedDivineSkins,
          ...profile.unlockedDivineSkins.map((s) => resolveAscensionSpecialty(s).id)
        ])
      ];
      this.unlockedDivineSkins = merged;
    }
    if (profile.selectedSkin) {
      this.selectedSkin = profile.selectedSkin;
    }
    if (profile.skin && typeof profile.skin === 'object') {
      this.skin = normalizeSkin({ ...this.skin, ...profile.skin });
      localStorage.setItem('ciel_skin', JSON.stringify(this.skin));
    }
    this.profile = {
      ...this.profile,
      ...profile,
      unlockedDivineSkins: [...this.unlockedDivineSkins],
      selectedSkin: this.selectedSkin
    };
    if (this.account && profile.grades) {
      this.account = {
        ...this.account,
        tpScores: { ...(this.account.tpScores || {}), ...profile.grades },
        unlockedDivineSkins: [...this.unlockedDivineSkins],
        selectedSkin: this.selectedSkin,
        avatarCustomization: { ...this.skin }
      };
    }
    this.emit();
  }

  setSkin(skin) {
    const merged = { ...DEFAULT_SKIN, ...this.skin, ...skin };
    if (skin && !('divineSpecialty' in skin) && this.skin?.divineSpecialty) {
      merged.divineSpecialty = this.skin.divineSpecialty;
    }
    if (skin && skin.divineSpecialty === null) {
      delete merged.divineSpecialty;
      this.selectedSkin = 'standard';
    } else if (merged.divineSpecialty) {
      this.selectedSkin = merged.divineSpecialty;
    }
    this.skin = normalizeSkin(merged);
    localStorage.setItem('ciel_skin', JSON.stringify(this.skin));
    this.profile = {
      ...this.profile,
      skin: { ...this.skin },
      selectedSkin: this.selectedSkin
    };
    if (this.account) {
      this.account = {
        ...this.account,
        selectedSkin: this.selectedSkin,
        avatarCustomization: { ...this.skin }
      };
    }
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

  setVoiceMode(mode) {
    this.voiceMode = mode === 'ptt' ? 'ptt' : 'open';
    localStorage.setItem('ciel_voice_mode', this.voiceMode);
    this.emit();
  }

  setVoiceTpMode(mode) {
    this.voiceTpMode = ['active', 'duck', 'mute'].includes(mode) ? mode : 'duck';
    localStorage.setItem('ciel_voice_tp_mode', this.voiceTpMode);
    this.emit();
  }

  setVoiceVolume(vol) {
    const raw = Number(vol);
    const clamped = Math.max(0, Math.min(1.5, Number.isFinite(raw) ? Math.round(raw * 20) / 20 : 1.0));
    this.voiceVolume = clamped;
    localStorage.setItem('ciel_voice_volume', String(clamped));
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
