export const FORMATIVE_POLES = [
  {
    id: 'reseaux',
    label: 'Réseaux & Adressage IP/VLAN',
    shortLabel: 'Réseaux & VLAN',
    icon: '🌐',
    color: '#38bdf8'
  },
  {
    id: 'electronique',
    label: 'Électronique, Arduino & DMX512',
    shortLabel: 'Élec & DMX512',
    icon: '⚡',
    color: '#fbbf24'
  },
  {
    id: 'cyber',
    label: 'Cybersécurité & Administration Linux',
    shortLabel: 'Cyber & Linux',
    icon: '🛡️',
    color: '#f43f5e'
  },
  {
    id: 'fibre',
    label: 'Fibre optique & Câblage',
    shortLabel: 'Fibre & Câblage',
    icon: '🔌',
    color: '#34d399'
  }
];

export const FORMATIVE_TP_CATALOG = [
  {
    id: 'fmt_ip_cidr',
    pole: 'reseaux',
    title: 'TP 1 — Adressage IPv4, Masques CIDR & Sous-réseaux',
    shortTitle: 'IPv4 & CIDR',
    icon: '🌐',
    difficulty: 'Fondamental',
    durationMin: 10,
    rewardCoins: 80,
    rewardXp: 120,
    context:
      'Vous devez segmenter le réseau du plateau U300. Un poste technicien reçoit la configuration 192.168.10.45/26. Déterminez les paramètres réseau et les règles d’adressage associées.',
    diagram:
      '[Routeur U300] ===(192.168.10.45 /26)===> [Switch Gi0/1] --- [Postes TP Réseau]',
    questions: [
      {
        id: 'q1_mask',
        type: 'short_text',
        prompt: 'Quel est le masque de sous-réseau décimal pointé correspondant à /26 ?',
        placeholder: 'Ex: 255.255.255.xxx',
        acceptedAnswers: ['255.255.255.192'],
        hint: 'Un /26 correspond à 24 bits + 2 bits dans le 4e octet (128 + 64 = 192).'
      },
      {
        id: 'q2_net',
        type: 'short_text',
        prompt: 'Quelle est l’adresse réseau du sous-réseau contenant 192.168.10.45/26 ?',
        placeholder: 'Ex: 192.168.10.x',
        acceptedAnswers: ['192.168.10.0'],
        hint: 'Le pas du bloc est 256 - 192 = 64. 45 est compris entre 0 et 63.'
      },
      {
        id: 'q3_hosts',
        type: 'mcq_single',
        prompt: 'Combien d’adresses IP d’hôtes utilisables offre un sous-réseau /26 ?',
        options: [
          { id: '30', label: '30 hôtes' },
          { id: '62', label: '62 hôtes' },
          { id: '64', label: '64 hôtes' },
          { id: '126', label: '126 hôtes' }
        ],
        correctOption: '62',
        hint: 'Il reste 32 - 26 = 6 bits hôtes : 2^6 - 2 = 64 - 2 = 62.'
      },
      {
        id: 'q4_rfc1918',
        type: 'mcq_multi',
        prompt: 'Sélectionnez TOUTES les adresses IPv4 privées (RFC 1918) :',
        options: [
          { id: 'a', label: '10.24.0.15' },
          { id: 'b', label: '172.20.14.8' },
          { id: 'c', label: '192.168.50.1' },
          { id: 'd', label: '8.8.8.8' }
        ],
        correctOptions: ['a', 'b', 'c'],
        hint: 'Les plages privées RFC 1918 sont 10.0.0.0/8, 172.16.0.0/12 et 192.168.0.0/16.'
      },
      {
        id: 'q5_osi',
        type: 'ordering',
        prompt: 'Ordonnez ces 4 étapes d’encapsulation lors de l’envoi d’une requête HTTP (du haut vers le bas) :',
        items: [
          { id: 'frame', label: 'Trame Ethernet (Couche 2)' },
          { id: 'segment', label: 'Segment TCP (Couche 4)' },
          { id: 'packet', label: 'Paquet IPv4 (Couche 3)' },
          { id: 'data', label: 'Données HTTP (Couche 7)' }
        ],
        correctOrder: ['data', 'segment', 'packet', 'frame'],
        hint: 'L’encapsulation descend de l’application (7) -> transport (4) -> réseau (3) -> liaison (2).'
      }
    ]
  },
  {
    id: 'fmt_vlan_trunk',
    pole: 'reseaux',
    title: 'TP 2 — VLAN 802.1Q, Trunk & Dépannage Switch',
    shortTitle: 'VLAN & Trunk',
    icon: '🔀',
    difficulty: 'Intermédiaire',
    durationMin: 12,
    rewardCoins: 90,
    rewardXp: 130,
    context:
      'Le switch de la salle U307 relie les VLAN 10 (ADMIN) et VLAN 20 (ATELIER) vers le routeur via un lien Trunk sur Gi0/24. Complétez la configuration Cisco IOS et la méthodologie de diagnostic.',
    diagram:
      '[Switch U307] --Fa0/5(Access VLAN 20)--> [PC Atelier]\n      |\n  Gi0/24 (Trunk 802.1Q : VLAN 10,20)\n      |\n[Routeur-on-a-Stick]',
    questions: [
      {
        id: 'q1_std',
        type: 'mcq_single',
        prompt: 'Quelle norme IEEE définit l’étiquetage des trames VLAN sur un lien Trunk ?',
        options: [
          { id: '802.3af', label: 'IEEE 802.3af' },
          { id: '802.1q', label: 'IEEE 802.1Q' },
          { id: '802.11ax', label: 'IEEE 802.11ax' },
          { id: '802.1x', label: 'IEEE 802.1X' }
        ],
        correctOption: '802.1q',
        hint: 'Le champ Tag de 4 octets ajouté dans la trame Ethernet correspond à IEEE 802.1Q.'
      },
      {
        id: 'q2_ios',
        type: 'short_text',
        prompt: 'Sous Cisco IOS (mode config-if), quelle commande affecte le port au VLAN 20 ?',
        placeholder: 'Ex: switchport ...',
        acceptedAnswers: ['switchport access vlan 20', 'sw access vlan 20'],
        hint: 'Syntaxe complète : switchport access vlan <numero>.'
      },
      {
        id: 'q3_trunk_roles',
        type: 'mcq_multi',
        prompt: 'Quelles affirmations sont VRAIES concernant un port configuré en Trunk 802.1Q ?',
        options: [
          { id: 'multi', label: 'Il transporte simultanément le trafic de plusieurs VLANs' },
          { id: 'tag', label: 'Il ajoute un identifiant VLAN (VID) aux trames des VLANs non natifs' },
          { id: 'one', label: 'Il ne peut transporter qu’un seul VLAN fixe' },
          { id: 'uplink', label: 'Il sert typiquement à relier deux switchs ou un switch à un routeur' }
        ],
        correctOptions: ['multi', 'tag', 'uplink'],
        hint: 'Un Trunk sert de lien inter-équipements et étiquette les trames de plusieurs VLANs.'
      },
      {
        id: 'q4_troubleshoot',
        type: 'ordering',
        prompt: 'Classez les 4 étapes du dépannage réseau du plus bas niveau physique jusqu’à la couche applicative :',
        items: [
          { id: 'ping_gw', label: 'Tester la passerelle par défaut (ping gateway)' },
          { id: 'link', label: 'Vérifier le câble RJ45 et les voyants Link/LED' },
          { id: 'dns', label: 'Tester la résolution DNS / accès serveur' },
          { id: 'ip_cfg', label: 'Contrôler l’adresse IP, le masque et le VLAN du poste' }
        ],
        correctOrder: ['link', 'ip_cfg', 'ping_gw', 'dns'],
        hint: 'Approche Bottom-Up : couche 1 (câble) -> configuration IP/VLAN -> passerelle -> DNS.'
      }
    ]
  },
  {
    id: 'fmt_elec_arduino',
    pole: 'electronique',
    title: 'TP 3 — Loi d’Ohm, Résistances & Microcontrôleur Arduino',
    shortTitle: 'Élec & Arduino',
    icon: '⚡',
    difficulty: 'Fondamental',
    durationMin: 10,
    rewardCoins: 80,
    rewardXp: 120,
    context:
      'Dans l’atelier U302, vous câblez une LED rouge (Vf = 2,0 V, If = 20 mA) sur une sortie 5 V d’un Arduino Uno et vérifiez les composants au code couleur.',
    diagram:
      '[Arduino Pin 9 (5V)] --- [R ?] ---|>|--- [GND]\n                                 LED (Vf=2V, 20mA)',
    questions: [
      {
        id: 'q1_ohm',
        type: 'short_text',
        prompt: 'Calculez la valeur de la résistance R (en Ω) pour alimenter la LED (5 V, Vf = 2 V, I = 20 mA) :',
        placeholder: 'Valeur en Ohms (ex: 150)',
        acceptedAnswers: ['150', '150 ohm', '150 ohms'],
        hint: 'U_R = 5 - 2 = 3 V et I = 0,02 A. Appliquez R = U_R / I.'
      },
      {
        id: 'q2_color',
        type: 'mcq_single',
        prompt: 'Quelle est la valeur d’une résistance à 4 anneaux : Marron - Noir - Rouge - Or ?',
        options: [
          { id: '100', label: '100 Ω ±5 %' },
          { id: '1k', label: '1 kΩ ±5 %' },
          { id: '10k', label: '10 kΩ ±5 %' },
          { id: '220', label: '220 Ω ±5 %' }
        ],
        correctOption: '1k',
        hint: 'Marron=1, Noir=0, Rouge=×100 -> 10 × 100 = 1000 Ω = 1 kΩ, Or = ±5 %.'
      },
      {
        id: 'q3_arduino_cmd',
        type: 'short_text',
        prompt: 'Quelle instruction Arduino dans setup() configure la broche 9 en sortie numérique ?',
        placeholder: 'Ex: pinMode(...)',
        acceptedAnswers: ['pinmode(9, output)', 'pinmode(9,output)'],
        hint: 'Utilisez pinMode(numero, OUTPUT) sans oublier la syntaxe exacte.'
      },
      {
        id: 'q4_pwm',
        type: 'mcq_multi',
        prompt: 'Sur un Arduino Uno (ATmega328P), quelles broches numériques supportent la modulation PWM (~) ?',
        options: [
          { id: 'd3', label: 'D3 (~)' },
          { id: 'd4', label: 'D4' },
          { id: 'd9', label: 'D9 (~)' },
          { id: 'd11', label: 'D11 (~)' }
        ],
        correctOptions: ['d3', 'd9', 'd11'],
        hint: 'Les broches PWM d’un Arduino Uno sont 3, 5, 6, 9, 10 et 11.'
      },
      {
        id: 'q5_safety',
        type: 'ordering',
        prompt: 'Ordonnez les 4 gestes de sécurité avant la mise sous tension d’un montage sur Breadboard :',
        items: [
          { id: 'power_on', label: 'Brancher le câble USB / l’alimentation stabilisée' },
          { id: 'polarity', label: 'Vérifier la polarité des composants et condensateurs' },
          { id: 'short_check', label: 'Contrôler l’absence de court-circuit VCC / GND' },
          { id: 'power_off', label: 'Câbler hors tension sur la plaque d’essai' }
        ],
        correctOrder: ['power_off', 'polarity', 'short_check', 'power_on'],
        hint: 'Toujours câbler hors tension, vérifier polarités et absence de court-circuit avant d’alimenter.'
      }
    ]
  },
  {
    id: 'fmt_dmx_signaux',
    pole: 'electronique',
    title: 'TP 4 — Protocole DMX512, Bus RS-485 & Signaux Oscilloscope',
    shortTitle: 'DMX512 & Signaux',
    icon: '🎛️',
    difficulty: 'Intermédiaire',
    durationMin: 12,
    rewardCoins: 85,
    rewardXp: 125,
    context:
      'En régie U303, vous déployez une chaîne d’éclairage DMX512 sur liaison différentielle RS-485 et analysez un signal périodique à l’oscilloscope.',
    diagram:
      '[Console DMX] ===(XLR 5 broches / RS-485)===> [PAR LED Ch.1] ===> [Lyre Ch.10] === [Bouchon ? Ω]',
    questions: [
      {
        id: 'q1_channels',
        type: 'short_text',
        prompt: 'Combien de canaux maximum contient un univers DMX512 standard ?',
        placeholder: 'Nombre de canaux',
        acceptedAnswers: ['512', '512 canaux'],
        hint: 'Le nom du protocole DMX512 indique directement le nombre maximal de gradateurs/canaux.'
      },
      {
        id: 'q2_terminator',
        type: 'mcq_single',
        prompt: 'Quelle valeur de résistance doit posséder le bouchon de terminaison en fin de ligne DMX512 ?',
        options: [
          { id: '50', label: '50 Ω' },
          { id: '75', label: '75 Ω' },
          { id: '120', label: '120 Ω' },
          { id: '470', label: '470 Ω' }
        ],
        correctOption: '120',
        hint: 'Le bus différentiel RS-485 du DMX512 a une impédance caractéristique de 120 Ω.'
      },
      {
        id: 'q3_freq',
        type: 'short_text',
        prompt: 'Un signal carré mesuré à l’oscilloscope a une période T = 2 ms. Quelle est sa fréquence f en Hz ?',
        placeholder: 'Valeur en Hz',
        acceptedAnswers: ['500', '500 hz'],
        hint: 'f = 1 / T avec T en secondes (2 ms = 0,002 s -> 1 / 0,002 = 500 Hz).'
      },
      {
        id: 'q4_match',
        type: 'matching',
        prompt: 'Associez chaque caractéristique DMX512 / RS-485 à sa définition technique :',
        leftItems: [
          { id: 'pin2', label: 'Broche 2 XLR DMX' },
          { id: 'pin3', label: 'Broche 3 XLR DMX' },
          { id: 'baud', label: 'Débit DMX512' },
          { id: 'break', label: 'Signal BREAK' }
        ],
        rightItems: [
          { id: 'd_minus', label: 'Data − (signal inversé)' },
          { id: 'd_plus', label: 'Data + (signal non inversé)' },
          { id: '250k', label: '250 kbit/s' },
          { id: 'start', label: 'Début d’une nouvelle trame DMX' }
        ],
        correctPairs: {
          pin2: 'd_minus',
          pin3: 'd_plus',
          baud: '250k',
          break: 'start'
        },
        hint: 'Broche 1 = Masse, Broche 2 = Data −, Broche 3 = Data +, débit 250 kbit/s.'
      }
    ]
  },
  {
    id: 'fmt_linux_admin',
    pole: 'cyber',
    title: 'TP 5 — Administration Linux Debian, Services & Droits',
    shortTitle: 'Admin Linux',
    icon: '🐧',
    difficulty: 'Intermédiaire',
    durationMin: 12,
    rewardCoins: 85,
    rewardXp: 125,
    context:
      'Vous administrez un serveur Debian GNU/Linux en salle U305. Vous devez gérer le démon SSH, ajuster les permissions d’un script et connaître l’arborescence système.',
    diagram:
      'eleve@debian-u305:~$ sudo systemctl status ssh\n● ssh.service - OpenBSD Secure Shell server (Port TCP ?)',
    questions: [
      {
        id: 'q1_port',
        type: 'short_text',
        prompt: 'Quel est le numéro de port TCP standard utilisé par le service SSH ?',
        placeholder: 'Numéro de port',
        acceptedAnswers: ['22', 'port 22'],
        hint: 'Telnet utilise le port 23 ; SSH utilise le port juste avant.'
      },
      {
        id: 'q2_systemctl',
        type: 'short_text',
        prompt: 'Quelle commande Debian redémarre le service ssh via systemd (avec ou sans sudo) ?',
        placeholder: 'Ex: sudo systemctl ...',
        acceptedAnswers: [
          'sudo systemctl restart ssh',
          'systemctl restart ssh',
          'sudo systemctl restart sshd',
          'systemctl restart sshd',
          'sudo service ssh restart'
        ],
        hint: 'Sous systemd, la sous-commande pour redémarrer un service est restart.'
      },
      {
        id: 'q3_chmod',
        type: 'mcq_single',
        prompt: 'Que donne la commande « chmod 750 deploy.sh » sur les droits du fichier ?',
        options: [
          { id: 'rwx_rx_none', label: 'Propriétaire rwx, Groupe r-x, Autres ---' },
          { id: 'rwx_rwx_rx', label: 'Propriétaire rwx, Groupe rwx, Autres r-x' },
          { id: 'rw_r_r', label: 'Propriétaire rw-, Groupe r--, Autres r--' },
          { id: 'r_r_r', label: 'Lecture seule pour tout le monde' }
        ],
        correctOption: 'rwx_rx_none',
        hint: '7 = 4+2+1 (rwx), 5 = 4+1 (r-x), 0 = aucun droit (---).'
      },
      {
        id: 'q4_dirs',
        type: 'mcq_multi',
        prompt: 'Cochez les affirmations EXACTES sur l’arborescence Linux Debian :',
        options: [
          { id: 'etc', label: '/etc contient les fichiers de configuration système' },
          { id: 'varlog', label: '/var/log stocke les journaux système (logs)' },
          { id: 'bin_cfg', label: '/dev contient les fichiers de configuration réseau statique' },
          { id: 'home', label: '/home regroupe les répertoires personnels des utilisateurs' }
        ],
        correctOptions: ['etc', 'varlog', 'home'],
        hint: '/dev représente les périphériques, tandis que /etc, /var/log et /home stockent config, logs et profils.'
      },
      {
        id: 'q5_match',
        type: 'matching',
        prompt: 'Associez chaque commande Debian à sa fonction précise :',
        leftItems: [
          { id: 'ip_a', label: 'ip a' },
          { id: 'ss_tuln', label: 'ss -tuln' },
          { id: 'apt_upd', label: 'apt update' },
          { id: 'journal', label: 'journalctl -xe' }
        ],
        rightItems: [
          { id: 'r_ip', label: 'Afficher les interfaces et adresses IP' },
          { id: 'r_ports', label: 'Lister les ports TCP/UDP en écoute' },
          { id: 'r_apt', label: 'Mettre à jour la liste des paquets' },
          { id: 'r_logs', label: 'Consulter les logs détaillés systemd' }
        ],
        correctPairs: {
          ip_a: 'r_ip',
          ss_tuln: 'r_ports',
          apt_upd: 'r_apt',
          journal: 'r_logs'
        },
        hint: 'ip a = interfaces, ss -tuln = sockets en écoute, apt update = index paquets, journalctl = journaux.'
      }
    ]
  },
  {
    id: 'fmt_cyber_soc',
    pole: 'cyber',
    title: 'TP 6 — Cybersécurité SOC, Pare-feu UFW & Réponse à Incident',
    shortTitle: 'Cyber & SOC',
    icon: '🛡️',
    difficulty: 'Avancé',
    durationMin: 12,
    rewardCoins: 95,
    rewardXp: 140,
    context:
      'Le SOC de l’atelier détecte une tentative d’intrusion sur un serveur Web HTTPS. Vous devez durcir le pare-feu UFW et appliquer la procédure de réponse à incident.',
    diagram:
      '[Internet] ---> [Pare-feu UFW] ---> [Serveur Web Nginx HTTPS : ?] ---> [Sondes Logs SIEM]',
    questions: [
      {
        id: 'q1_https',
        type: 'short_text',
        prompt: 'Quel port TCP standard utilise le protocole HTTPS ?',
        placeholder: 'Numéro de port',
        acceptedAnswers: ['443', 'port 443'],
        hint: 'HTTP utilise le port 80 ; sa version chiffrée TLS utilise le port 443.'
      },
      {
        id: 'q2_ufw',
        type: 'short_text',
        prompt: 'Quelle commande UFW autorise le trafic entrant TCP sur le port 443 ?',
        placeholder: 'Ex: ufw allow ...',
        acceptedAnswers: [
          'ufw allow 443/tcp',
          'sudo ufw allow 443/tcp',
          'ufw allow 443',
          'sudo ufw allow 443',
          'ufw allow https',
          'sudo ufw allow https'
        ],
        hint: 'Avec UFW, la règle d’autorisation utilise le mot-clé allow suivi du port (443/tcp).'
      },
      {
        id: 'q3_hardening',
        type: 'mcq_multi',
        prompt: 'Sélectionnez TOUTES les bonnes pratiques de durcissement d’un serveur exposé :',
        options: [
          { id: 'least', label: 'Appliquer le principe du moindre privilège' },
          { id: 'root_ssh', label: 'Autoriser la connexion SSH directe en root sans mot de passe' },
          { id: 'patch', label: 'Déployer les correctifs de sécurité (CVE)' },
          { id: 'mfa', label: 'Activer l’authentification forte (clés SSH / MFA)' }
        ],
        correctOptions: ['least', 'patch', 'mfa'],
        hint: 'Il faut toujours interdire PermitRootLogin yes et combiner moindre privilège, patchs et MFA/clés.'
      },
      {
        id: 'q4_incident',
        type: 'ordering',
        prompt: 'Ordonnez les 4 phases de gestion d’un incident de cybersécurité (référentiel ANSSI / NIST) :',
        items: [
          { id: 'eradicate', label: 'Éradiquer la menace et corriger la faille' },
          { id: 'detect', label: 'Détecter et qualifier l’alerte dans les logs' },
          { id: 'recover', label: 'Rétablir le service et surveiller la reprise' },
          { id: 'contain', label: 'Contenir / isoler le poste compromis du réseau' }
        ],
        correctOrder: ['detect', 'contain', 'eradicate', 'recover'],
        hint: 'On détecte d’abord, puis on isole (containment) avant d’éradiquer et de restaurer.'
      }
    ]
  },
  {
    id: 'fmt_rj45_cablage',
    pole: 'fibre',
    title: 'TP 7 — Câblage Cuivre RJ45, Norme T568B & Blindage',
    shortTitle: 'Câblage RJ45',
    icon: '🔌',
    difficulty: 'Fondamental',
    durationMin: 10,
    rewardCoins: 80,
    rewardXp: 120,
    context:
      'Dans la Chambre Serveur, vous sertissez des cordons RJ45 Catégorie 6 selon la norme T568B et vérifiez les limites physiques des liaisons Ethernet cuivre.',
    diagram:
      '[Connecteur RJ45 vu languette dessous, broches 1 -> 8 de gauche à droite]\n  1: ?  2: ?  3: ?  4: Bleu  5: Blanc/Bleu  6: ?  7: Blanc/Marron  8: Marron',
    questions: [
      {
        id: 'q1_t568b_14',
        type: 'ordering',
        prompt: 'Ordonnez les couleurs des 4 premières broches (1 → 4) selon la norme T568B :',
        items: [
          { id: 'b4', label: 'Bleu (Broche 4)' },
          { id: 'b2', label: 'Orange (Broche 2)' },
          { id: 'b3', label: 'Blanc / Vert (Broche 3)' },
          { id: 'b1', label: 'Blanc / Orange (Broche 1)' }
        ],
        correctOrder: ['b1', 'b2', 'b3', 'b4'],
        hint: 'En T568B, la paire Orange commence en 1-2 (Blanc/Orange, Orange), puis Blanc/Vert (3) et Bleu (4).'
      },
      {
        id: 'q2_len',
        type: 'short_text',
        prompt: 'Quelle est la longueur maximale normalisée (en mètres) d’un lien Ethernet cuivre Cat.6 (channel) ?',
        placeholder: 'Distance en mètres (ex: 100)',
        acceptedAnswers: ['100', '100m', '100 m', '100 metres'],
        hint: 'La norme TIA/EIA-568 / ISO 11801 fixe la limite totale (90 m horizontal + 10 m brassage).'
      },
      {
        id: 'q3_shield',
        type: 'mcq_single',
        prompt: 'Que signifie la désignation S/FTP pour un câble à paires torsadées ?',
        options: [
          { id: 'sftp', label: 'Tresse générale autour du câble + écran feuillard individuel par paire' },
          { id: 'utp', label: 'Câble sans aucun blindage ni écran' },
          { id: 'opt', label: 'Câble mixte fibre optique et alimentation' },
          { id: 'coax', label: 'Câble coaxial blindé 50 Ω' }
        ],
        correctOption: 'sftp',
        hint: 'S = Screened (tresse globale), F = Foiled (feuillard par paire), TP = Twisted Pair.'
      },
      {
        id: 'q4_match_58',
        type: 'matching',
        prompt: 'Associez les broches 5 à 8 du câblage RJ45 T568B à leur fil exact :',
        leftItems: [
          { id: 'p5', label: 'Broche 5' },
          { id: 'p6', label: 'Broche 6' },
          { id: 'p7', label: 'Broche 7' },
          { id: 'p8', label: 'Broche 8' }
        ],
        rightItems: [
          { id: 'w_blue', label: 'Blanc / Bleu' },
          { id: 'green', label: 'Vert' },
          { id: 'w_brown', label: 'Blanc / Marron' },
          { id: 'brown', label: 'Marron' }
        ],
        correctPairs: {
          p5: 'w_blue',
          p6: 'green',
          p7: 'w_brown',
          p8: 'brown'
        },
        hint: 'La broche 5 complète la paire bleue, la 6 ferme la paire verte, 7-8 forment la paire marron.'
      }
    ]
  },
  {
    id: 'fmt_fibre_optique',
    pole: 'fibre',
    title: 'TP 8 — Fibre Optique Monomode, Soudure & Réflectométrie',
    shortTitle: 'Fibre Optique',
    icon: '💡',
    difficulty: 'Avancé',
    durationMin: 12,
    rewardCoins: 95,
    rewardXp: 140,
    context:
      'Vous déployez une rocade fibre optique monomode OS2 entre deux répartiteurs du campus et effectuez le contrôle par réflectométrie après soudure par fusion.',
    diagram:
      '[Tirou / Pigtail OS2 (9/125 µm)] ===(Soudure Fusion)===> [Rocade Campus] === [Réflectomètre ?]',
    questions: [
      {
        id: 'q1_core',
        type: 'short_text',
        prompt: 'Quel est le diamètre du cœur d’une fibre optique monomode standard OS2 (en µm) ?',
        placeholder: 'Ex: 9 ou 9 µm',
        acceptedAnswers: ['9', '9 um', '9 µm', '9um'],
        hint: 'Le monomode OS2 est noté 9/125 µm (contre 50/125 µm en multimode OM3/OM4).'
      },
      {
        id: 'q2_otdr',
        type: 'short_text',
        prompt: 'Quel sigle de 4 lettres désigne le réflectomètre optique utilisé pour localiser les défauts sur une fibre ?',
        placeholder: 'Sigle 4 lettres',
        acceptedAnswers: ['otdr'],
        hint: 'Optical Time-Domain Reflectometer.'
      },
      {
        id: 'q3_os2',
        type: 'mcq_multi',
        prompt: 'Cochez les caractéristiques propres à la fibre monomode OS2 (jaune) :',
        options: [
          { id: 'long', label: 'Très longue portée (plusieurs kilomètres sans répéteur)' },
          { id: 'laser', label: 'Utilise généralement des longueurs d’onde 1310 nm / 1550 nm' },
          { id: 'led', label: 'Fonctionne avec un cœur large de 62,5 µm à LED basse portée' },
          { id: 'yellow', label: 'Gaine de repérage standard de couleur jaune' }
        ],
        correctOptions: ['long', 'laser', 'yellow'],
        hint: 'La fibre OS2 est jaune, à cœur 9 µm, prévue pour les sources laser 1310/1550 nm longue distance.'
      },
      {
        id: 'q4_splice_order',
        type: 'ordering',
        prompt: 'Ordonnez les 5 étapes réglementaires pour préparer et souder une fibre optique :',
        items: [
          { id: 'cleave', label: 'Cliver la fibre avec la cliveuse de précision' },
          { id: 'sleeve', label: 'Enfiler le manchon thermorétractable (smoove)' },
          { id: 'strip', label: 'Dénuder le revêtement et nettoyer à l’alcool isopropylique' },
          { id: 'bake', label: 'Centrer le manchon et chauffer au four de protection' },
          { id: 'fuse', label: 'Aligner et exécuter la soudure par arc électrique' }
        ],
        correctOrder: ['sleeve', 'strip', 'cleave', 'fuse', 'bake'],
        hint: 'Toujours glisser le smoove AVANT de dénuder/cliver, puis souder et enfin rétreindre au four.'
      }
    ]
  }
];

export function getFormativePoleById(poleId) {
  return FORMATIVE_POLES.find((p) => p.id === poleId) || null;
}

export function getFormativeTpById(tpId) {
  return FORMATIVE_TP_CATALOG.find((tp) => tp.id === tpId) || null;
}

export function normalizeShortAnswer(raw) {
  if (raw === null || raw === undefined) return '';
  return String(raw)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[Ωω]/g, 'ohm')
    .replace(/[µμ]/g, 'u')
    .replace(/\s*([(),:=])\s*/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/;+$/, '')
    .trim();
}

export function sanitizeFormativeAnswers(tpId, rawAnswers = {}) {
  const tp = getFormativeTpById(tpId);
  if (!tp || !rawAnswers || typeof rawAnswers !== 'object') return {};
  const clean = {};
  for (const q of tp.questions) {
    if (!(q.id in rawAnswers)) continue;
    const val = rawAnswers[q.id];
    if (val === undefined || val === null) continue;
    if (q.type === 'mcq_single') {
      const s = String(val).trim().slice(0, 64);
      if (s && q.options.some((o) => o.id === s)) clean[q.id] = s;
    } else if (q.type === 'mcq_multi') {
      if (Array.isArray(val)) {
        const validIds = new Set(q.options.map((o) => o.id));
        const arr = [];
        for (const item of val.slice(0, 16)) {
          const s = String(item).trim().slice(0, 64);
          if (s && validIds.has(s) && !arr.includes(s)) arr.push(s);
        }
        if (arr.length > 0) clean[q.id] = arr;
      }
    } else if (q.type === 'short_text') {
      const s = String(val).slice(0, 120);
      if (s.trim().length > 0) clean[q.id] = s;
    } else if (q.type === 'ordering') {
      const src = Array.isArray(val) ? val : Array.isArray(val?.order) ? val.order : null;
      if (src) {
        const validIds = new Set(q.items.map((it) => it.id));
        const arr = [];
        for (const item of src.slice(0, 16)) {
          const s = String(item).trim().slice(0, 64);
          if (s && validIds.has(s) && !arr.includes(s)) arr.push(s);
        }
        if (arr.length === q.items.length) clean[q.id] = arr;
      }
    } else if (q.type === 'matching') {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const validLeft = new Set(q.leftItems.map((l) => l.id));
        const validRight = new Set(q.rightItems.map((r) => r.id));
        const map = {};
        for (const [lk, rv] of Object.entries(val)) {
          const cleanL = String(lk).trim();
          const cleanR = String(rv || '').trim();
          if (validLeft.has(cleanL) && validRight.has(cleanR)) {
            map[cleanL] = cleanR;
          }
        }
        if (Object.keys(map).length > 0) clean[q.id] = map;
      }
    }
  }
  return clean;
}

export function evaluateQuestionAnswer(question, answer) {
  if (!question) {
    return { questionId: '', status: 'unanswered', isCorrect: false, hint: '' };
  }
  const qId = question.id;

  if (question.type === 'mcq_single') {
    if (answer === undefined || answer === null || String(answer).trim() === '') {
      return { questionId: qId, status: 'unanswered', isCorrect: false, hint: '' };
    }
    const ok = String(answer).trim() === String(question.correctOption);
    return {
      questionId: qId,
      status: ok ? 'correct' : 'incorrect',
      isCorrect: ok,
      hint: ok ? '' : question.hint || ''
    };
  }

  if (question.type === 'mcq_multi') {
    if (!Array.isArray(answer) || answer.length === 0) {
      return { questionId: qId, status: 'unanswered', isCorrect: false, hint: '' };
    }
    const chosen = [...new Set(answer.map((x) => String(x).trim()).filter(Boolean))].sort();
    const expected = [...new Set((question.correctOptions || []).map((x) => String(x)))].sort();
    const ok =
      chosen.length === expected.length &&
      chosen.every((val, idx) => val === expected[idx]);
    return {
      questionId: qId,
      status: ok ? 'correct' : 'incorrect',
      isCorrect: ok,
      hint: ok ? '' : question.hint || ''
    };
  }

  if (question.type === 'short_text') {
    const norm = normalizeShortAnswer(answer);
    if (!norm) {
      return { questionId: qId, status: 'unanswered', isCorrect: false, hint: '' };
    }
    const accepted = (question.acceptedAnswers || []).map((a) => normalizeShortAnswer(a));
    const ok = accepted.includes(norm);
    return {
      questionId: qId,
      status: ok ? 'correct' : 'incorrect',
      isCorrect: ok,
      hint: ok ? '' : question.hint || ''
    };
  }

  if (question.type === 'ordering') {
    const arr = Array.isArray(answer) ? answer : Array.isArray(answer?.order) ? answer.order : null;
    if (!arr || arr.length !== (question.correctOrder || []).length) {
      return { questionId: qId, status: 'unanswered', isCorrect: false, hint: '' };
    }
    const ok = question.correctOrder.every((id, idx) => String(arr[idx]) === String(id));
    return {
      questionId: qId,
      status: ok ? 'correct' : 'incorrect',
      isCorrect: ok,
      hint: ok ? '' : question.hint || ''
    };
  }

  if (question.type === 'matching') {
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) {
      return { questionId: qId, status: 'unanswered', isCorrect: false, hint: '' };
    }
    const lefts = question.leftItems || [];
    const filledCount = lefts.filter((l) => String(answer[l.id] || '').trim().length > 0).length;
    if (filledCount === 0 || filledCount < lefts.length) {
      return { questionId: qId, status: 'unanswered', isCorrect: false, hint: '' };
    }
    const ok = lefts.every((l) => String(answer[l.id]) === String(question.correctPairs?.[l.id]));
    return {
      questionId: qId,
      status: ok ? 'correct' : 'incorrect',
      isCorrect: ok,
      hint: ok ? '' : question.hint || ''
    };
  }

  return { questionId: qId, status: 'unanswered', isCorrect: false, hint: '' };
}

export function evaluateFormativeTp(tpId, rawAnswers = {}) {
  const tp = getFormativeTpById(tpId);
  if (!tp) {
    return {
      tpId: String(tpId || ''),
      totalQuestions: 0,
      answeredCount: 0,
      correctCount: 0,
      completionPct: 0,
      answeredPct: 0,
      scoreOutOf20: 0,
      status: 'todo',
      validated: false,
      results: []
    };
  }
  const answers = rawAnswers && typeof rawAnswers === 'object' ? rawAnswers : {};
  const results = tp.questions.map((q) => evaluateQuestionAnswer(q, answers[q.id]));
  const totalQuestions = results.length;
  const answeredCount = results.filter((r) => r.status !== 'unanswered').length;
  const correctCount = results.filter((r) => r.status === 'correct').length;
  const completionPct =
    totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const answeredPct =
    totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const scoreOutOf20 =
    totalQuestions > 0
      ? Math.round(((correctCount / totalQuestions) * 20) * 10) / 10
      : 0;
  const validated = totalQuestions > 0 && correctCount === totalQuestions;
  const status = validated
    ? 'validated'
    : answeredCount > 0
      ? 'in_progress'
      : 'todo';

  return {
    tpId: tp.id,
    totalQuestions,
    answeredCount,
    correctCount,
    completionPct,
    answeredPct,
    scoreOutOf20,
    status,
    validated,
    results
  };
}

export function buildFormativeBadges(items = [], byPole = []) {
  const validatedCount = items.filter((it) => it.validated).length;
  const poleMap = new Map(byPole.map((p) => [p.id, p]));
  return [
    {
      id: 'first_tp',
      icon: '🎓',
      title: 'Premier Pas Formative',
      desc: 'Valider 1 TP à 100 % sur la tablette',
      unlocked: validatedCount >= 1
    },
    {
      id: 'pole_reseaux',
      icon: '🌐',
      title: 'Architecte Réseau & VLAN',
      desc: 'Valider 100 % du pôle Réseaux & Adressage IP/VLAN',
      unlocked: Boolean(poleMap.get('reseaux')?.validated === poleMap.get('reseaux')?.total && poleMap.get('reseaux')?.total > 0)
    },
    {
      id: 'pole_electronique',
      icon: '⚡',
      title: 'Maître Élec & DMX512',
      desc: 'Valider 100 % du pôle Électronique, Arduino & DMX512',
      unlocked: Boolean(poleMap.get('electronique')?.validated === poleMap.get('electronique')?.total && poleMap.get('electronique')?.total > 0)
    },
    {
      id: 'pole_cyber',
      icon: '🛡️',
      title: 'Sentinelle Cyber & Linux',
      desc: 'Valider 100 % du pôle Cybersécurité & Linux',
      unlocked: Boolean(poleMap.get('cyber')?.validated === poleMap.get('cyber')?.total && poleMap.get('cyber')?.total > 0)
    },
    {
      id: 'pole_fibre',
      icon: '🔌',
      title: 'Expert Fibre & Câblage',
      desc: 'Valider 100 % du pôle Fibre optique & Câblage',
      unlocked: Boolean(poleMap.get('fibre')?.validated === poleMap.get('fibre')?.total && poleMap.get('fibre')?.total > 0)
    },
    {
      id: 'half_way',
      icon: '🚀',
      title: 'Technicien Polyvalent CIEL',
      desc: 'Valider au moins 4 TP Formative',
      unlocked: validatedCount >= 4
    },
    {
      id: 'formative_master',
      icon: '👑',
      title: 'Major Formative BAC PRO CIEL',
      desc: 'Valider les 8 TP Formative à 100 %',
      unlocked: validatedCount >= FORMATIVE_TP_CATALOG.length
    }
  ];
}

export function computeFormativeStats(progressMap = {}, awardedIds = []) {
  const safeMap = progressMap && typeof progressMap === 'object' ? progressMap : {};
  const rewardedSet = new Set(Array.isArray(awardedIds) ? awardedIds : []);

  const items = FORMATIVE_TP_CATALOG.map((tp) => {
    const rawEntry = safeMap[tp.id] && typeof safeMap[tp.id] === 'object' ? safeMap[tp.id] : {};
    const evalRes = evaluateFormativeTp(tp.id, rawEntry.answers || {});
    const isRewarded = rewardedSet.has(tp.id) || Boolean(rawEntry.rewarded);
    const isValidated = evalRes.validated || (isRewarded && Number(rawEntry.completionPct) === 100);
    const completionPct = isValidated ? 100 : evalRes.completionPct;
    const scoreOutOf20 = isValidated ? 20 : evalRes.scoreOutOf20;
    const status = isValidated ? 'validated' : evalRes.status;
    return {
      tp,
      status,
      completionPct,
      scoreOutOf20,
      correctCount: isValidated ? evalRes.totalQuestions : evalRes.correctCount,
      totalQuestions: evalRes.totalQuestions,
      answeredCount: isValidated ? evalRes.totalQuestions : evalRes.answeredCount,
      validated: isValidated,
      rewarded: isRewarded,
      updatedAt: rawEntry.updatedAt || null
    };
  });

  const validatedCount = items.filter((it) => it.validated).length;
  const inProgressCount = items.filter((it) => it.status === 'in_progress').length;
  const todoCount = items.filter((it) => it.status === 'todo').length;
  const attempted = items.filter((it) => it.validated || it.answeredCount > 0);
  const averageScore =
    attempted.length > 0
      ? Math.round((attempted.reduce((acc, it) => acc + it.scoreOutOf20, 0) / attempted.length) * 10) / 10
      : null;
  const overallPct =
    items.length > 0
      ? Math.round(items.reduce((acc, it) => acc + it.completionPct, 0) / items.length)
      : 0;
  const totalCoinsEarned = items.reduce((acc, it) => acc + (it.rewarded ? it.tp.rewardCoins : 0), 0);
  const totalCoinsPossible = items.reduce((acc, it) => acc + it.tp.rewardCoins, 0);

  const byPole = FORMATIVE_POLES.map((pole) => {
    const poleItems = items.filter((it) => it.tp.pole === pole.id);
    const poleAttempted = poleItems.filter((it) => it.validated || it.answeredCount > 0);
    const poleAvg =
      poleAttempted.length > 0
        ? Math.round((poleAttempted.reduce((a, b) => a + b.scoreOutOf20, 0) / poleAttempted.length) * 10) / 10
        : null;
    const polePct =
      poleItems.length > 0
        ? Math.round(poleItems.reduce((a, b) => a + b.completionPct, 0) / poleItems.length)
        : 0;
    return {
      ...pole,
      total: poleItems.length,
      validated: poleItems.filter((it) => it.validated).length,
      inProgress: poleItems.filter((it) => it.status === 'in_progress').length,
      pct: polePct,
      averageScore: poleAvg
    };
  });

  const badges = buildFormativeBadges(items, byPole);

  return {
    totalTps: items.length,
    validatedCount,
    inProgressCount,
    todoCount,
    attemptedCount: attempted.length,
    averageScore,
    overallPct,
    totalCoinsEarned,
    totalCoinsPossible,
    byPole,
    items,
    badges
  };
}
