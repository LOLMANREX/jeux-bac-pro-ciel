import {
  applySessionDivineSkin,
  ASCENSION_SPECIALTIES,
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

export function getAllTps() {
  const seen = new Set();
  const all = [];
  for (const tp of [...TP_CATALOG, ...EXTRA_STATIONS]) {
    if (tp && tp.id && !seen.has(tp.id)) {
      seen.add(tp.id);
      all.push(tp);
    }
  }
  return all;
}

export function hasAllTpsAt20(scores = {}, allTps = getAllTps()) {
  if (!scores || typeof scores !== 'object') return false;
  return allTps.length > 0 && allTps.every((tp) => Number(scores[tp.id]) === 20);
}

function matchDivineSpecialtyId(raw) {
  if (!raw) return null;
  const clean = String(raw)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!clean || clean === 'standard' || clean === 'default' || clean === 'none') return null;
  const found = ASCENSION_SPECIALTIES.find(
    (s) => s.id === clean || s.aliases.includes(clean)
  );
  return found ? found.id : null;
}

function filterValidDivineIds(rawList) {
  if (!Array.isArray(rawList)) return [];
  const out = [];
  for (const item of rawList) {
    const id = matchDivineSpecialtyId(item);
    if (id && !out.includes(id)) {
      out.push(id);
    }
  }
  return out;
}

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

function readStorage(key) {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    return;
  }
}

function removeStorage(key) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch {
    return;
  }
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
    this.authToken = readStorage('ciel_auth_token') || '';
    this.unlockedDivineSkins = [];
    this.selectedSkin = 'standard';
    this.room = 'plateau-u300';
    this.roomRoster = [];
    this.leaderboard = [];
    this.quality = readStorage('ciel_quality') || 'high';
    this.cameraMode = readStorage('ciel_camera_mode') === 'third' ? 'third' : 'first';
    const savedTouch = readStorage('ciel_touch_mode');
    this.touchMode = savedTouch === '1' ? true : savedTouch === '0' ? false : detectTouchDevice();
    const savedFov = Number(readStorage('ciel_fov'));
    this.fov = Number.isFinite(savedFov) && savedFov >= 50 && savedFov <= 110 ? savedFov : 70;
    const savedSens = Number(readStorage('ciel_sens'));
    this.mouseSens = Number.isFinite(savedSens) && savedSens >= 0.4 && savedSens <= 2.2 ? savedSens : 1.0;
    this.voiceMode = readStorage('ciel_voice_mode') === 'ptt' ? 'ptt' : 'open';
    const savedTpVoice = readStorage('ciel_voice_tp_mode');
    this.voiceTpMode = ['active', 'duck', 'mute'].includes(savedTpVoice) ? savedTpVoice : 'duck';
    const savedVoiceVol = Number(readStorage('ciel_voice_volume'));
    this.voiceVolume =
      Number.isFinite(savedVoiceVol) && savedVoiceVol >= 0 && savedVoiceVol <= 1.5 ? savedVoiceVol : 1.0;
    try {
      const rawSkin = JSON.parse(readStorage('ciel_skin') || 'null');
      const loaded = rawSkin ? normalizeSkin({ ...DEFAULT_SKIN, ...rawSkin }) : { ...DEFAULT_SKIN };
      delete loaded.divineSpecialty;
      this.skin = loaded;
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
        writeStorage('ciel_auth_token', this.authToken);
      }
    }
    const unlocked = filterValidDivineIds(account.unlockedDivineSkins);
    this.unlockedDivineSkins = unlocked;

    const customSkin = normalizeSkin(
      account.avatarCustomization || profile?.skin || this.skin || DEFAULT_SKIN
    );
    const rawSel = account.selectedSkin || customSkin.divineSpecialty || 'standard';
    const matchedSel = matchDivineSpecialtyId(rawSel);
    if (matchedSel && this.unlockedDivineSkins.includes(matchedSel)) {
      const spec = resolveAscensionSpecialty(matchedSel);
      this.selectedSkin = spec.id;
      this.skin = applySessionDivineSkin(customSkin, spec.id);
    } else {
      this.selectedSkin = 'standard';
      const plainSkin = { ...customSkin };
      delete plainSkin.divineSpecialty;
      this.skin = plainSkin;
    }

    writeStorage('ciel_skin', JSON.stringify(this.skin));
    writeStorage('ciel_player_name', account.username);

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
    removeStorage('ciel_auth_token');
    removeStorage('ciel_player_name');
    removeStorage('ciel_skin');
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
    const matchedId = matchDivineSpecialtyId(specialtyOrStandard);
    if (!matchedId || !this.unlockedDivineSkins.includes(matchedId)) {
      const nextSkin = { ...this.skin };
      delete nextSkin.divineSpecialty;
      this.skin = nextSkin;
      this.selectedSkin = 'standard';
    } else {
      const spec = resolveAscensionSpecialty(matchedId);
      this.selectedSkin = spec.id;
      this.skin = applySessionDivineSkin(this.skin, spec.id);
    }
    writeStorage('ciel_skin', JSON.stringify(this.skin));
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
      this.unlockedDivineSkins = filterValidDivineIds(profile.unlockedDivineSkins);
    }
    if (profile.selectedSkin) {
      const selId = matchDivineSpecialtyId(profile.selectedSkin);
      this.selectedSkin = selId && this.unlockedDivineSkins.includes(selId) ? selId : 'standard';
    }
    if (profile.skin && typeof profile.skin === 'object') {
      const merged = { ...this.skin, ...profile.skin };
      if (!profile.skin.divineSpecialty && profile.selectedSkin === 'standard') {
        delete merged.divineSpecialty;
      }
      const nextSkin = normalizeSkin(merged);
      if (nextSkin.divineSpecialty && !this.unlockedDivineSkins.includes(nextSkin.divineSpecialty)) {
        delete nextSkin.divineSpecialty;
        this.selectedSkin = 'standard';
      }
      this.skin = nextSkin;
      writeStorage('ciel_skin', JSON.stringify(this.skin));
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
    writeStorage('ciel_skin', JSON.stringify(this.skin));
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
    writeStorage('ciel_quality', q);
    this.emit();
  }

  setFov(fov) {
    const clamped = Math.max(50, Math.min(110, Math.round(Number(fov) || 70)));
    this.fov = clamped;
    writeStorage('ciel_fov', String(clamped));
    this.emit();
  }

  setMouseSens(sens) {
    const clamped = Math.max(0.4, Math.min(2.2, Math.round(Number(sens) * 10) / 10 || 1.0));
    this.mouseSens = clamped;
    writeStorage('ciel_sens', String(clamped));
    this.emit();
  }

  setCameraMode(mode) {
    this.cameraMode = mode === 'third' ? 'third' : 'first';
    writeStorage('ciel_camera_mode', this.cameraMode);
    this.emit();
  }

  setTouchMode(enabled) {
    this.touchMode = Boolean(enabled);
    writeStorage('ciel_touch_mode', this.touchMode ? '1' : '0');
    this.emit();
  }

  setVoiceMode(mode) {
    this.voiceMode = mode === 'ptt' ? 'ptt' : 'open';
    writeStorage('ciel_voice_mode', this.voiceMode);
    this.emit();
  }

  setVoiceTpMode(mode) {
    this.voiceTpMode = ['active', 'duck', 'mute'].includes(mode) ? mode : 'duck';
    writeStorage('ciel_voice_tp_mode', this.voiceTpMode);
    this.emit();
  }

  setVoiceVolume(vol) {
    const raw = Number(vol);
    const clamped = Math.max(0, Math.min(1.5, Number.isFinite(raw) ? Math.round(raw * 20) / 20 : 1.0));
    this.voiceVolume = clamped;
    writeStorage('ciel_voice_volume', String(clamped));
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
