export const TP_CATALOG = [
  {
    id: 'oscilloscope',
    title: 'TP Oscilloscope',
    shortTitle: 'Oscilloscope',
    icon: '〰️',
    pole: 'Métrologie & Signaux',
    color: '#22d3ee',
    position: { x: -8.5, z: -4.5 },
    brief:
      'Calibrez la base de temps, le gain vertical et le déclenchement (Trigger) pour mesurer fréquence, amplitude et PWM.',
    fortinHint:
      '« Pensez d’abord à placer le niveau de Trigger dans l’amplitude du signal pour le figer à l’écran, puis ajustez V/div et ms/div pour lire 2 à 4 périodes propres ! »'
  },
  {
    id: 'soldering',
    title: 'TP Brasure PCB',
    shortTitle: 'Brasure',
    icon: '🔥',
    pole: 'Assemblage Électronique',
    color: '#fb923c',
    position: { x: -8.5, z: 3.5 },
    brief:
      'Réglez votre station à ~350°C sans plomb, activez l’extracteur de fumées, chauffez pastille + patte et formez une brasure brillante.',
    fortinHint:
      '« Trop froid, c’est une soudure sèche. Trop chaud, vous décollez la pastille ! Entre 340°C et 365°C, chauffez 1 à 2 secondes et utilisez la tresse si deux broches font un pont. »'
  },
  {
    id: 'electronics',
    title: 'TP Électronique',
    shortTitle: 'Électronique',
    icon: '⚡',
    pole: 'Conception & Circuits',
    color: '#fbbf24',
    position: { x: 0, z: -7.2 },
    brief:
      'Décodez les résistances, appliquez la loi d’Ohm, montez vos composants dans le bon sens et validez au multimètre.',
    fortinHint:
      '« Vérifiez toujours la polarité de la LED (la grande patte Anode au +) et calculez R = (U_alim - U_LED) / I avant de mettre sous tension ! »'
  },
  {
    id: 'antivirus',
    title: 'TP PC Infecté & Antivirus',
    shortTitle: 'Antivirus',
    icon: '🛡️',
    pole: 'Cybersécurité Poste',
    color: '#f43f5e',
    position: { x: 8.5, z: 3.5 },
    brief:
      'Un poste de la salle est envahi de malwares ! Isolez le réseau, tuez les processus suspects, installez et mettez à jour l’antivirus pour nettoyer le PC.',
    fortinHint:
      '« Premier réflexe cyber en entreprise : on débranche le réseau pour stopper l’exfiltration ! Ensuite, processus malveillants, mise à jour de l’antivirus et scan complet ! »'
  },
  {
    id: 'vmvlan',
    title: 'TP VM & VLAN Complet',
    shortTitle: 'VM & VLAN',
    icon: '🌐',
    pole: 'Réseaux & Virtualisation',
    color: '#34d399',
    position: { x: 8.5, z: -4.5 },
    brief:
      'Allouez les VMs sur l’hyperviseur, configurez les ports Access/Trunk 802.1Q, le routage inter-VLAN et les règles pare-feu puis testez le ping !',
    fortinHint:
      '« Un port vers un PC = mode ACCESS sur son VLAN. Un lien switch-switch, switch-hyperviseur ou switch-routeur = mode TRUNK 802.1Q avec tous les VLANs autorisés ! »'
  }
];

export const FORTIN_POS = { x: 0, z: -1.8 };

export function getTpById(id) {
  return TP_CATALOG.find((t) => t.id === id) || null;
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
      xp: 0,
      questAccepted: false,
      grades: {},
      bestTimes: {},
      average: null,
      completedCount: 0,
      diplomaEarned: false
    };
    this.room = 'salle-e204';
    this.quality = localStorage.getItem('ciel_quality') || 'high';
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

  setQuality(q) {
    this.quality = q;
    localStorage.setItem('ciel_quality', q);
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
