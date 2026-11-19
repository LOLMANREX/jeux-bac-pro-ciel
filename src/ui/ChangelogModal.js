export const APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined'
    ? __APP_VERSION__
    : "v4.27 - Épuration du HUD Haut, Boutique dans Paramètres, Suppression Meuble Boutique & Écran CIEL OS Simple Face";

export const BUILD_TIME_ISO =
  typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : new Date().toISOString();

export function formatBuildTime(iso = BUILD_TIME_ISO) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export const CHANGELOG_RELEASES = [
  {
    version: 'v4.27 — Épuration du HUD Haut, Boutique dans Paramètres, Suppression Meuble Boutique & Écran CIEL OS Simple Face',
    date: '19/11/2026',
    tag: 'DERNIÈRE MÀJ',
    items: [
      {
        badge: 'HUD ÉPURÉ & PARAMÈTRES',
        title: 'Barre Supérieure Allégée (Paramètres + Menu Principal) & Boutique / Audio Déplacés dans les Paramètres',
        desc: 'La barre d’actions supérieure en jeu ne conserve plus que les 2 boutons essentiels (⚙️ Paramètres et 🏠 Menu principal). La Boutique CIEL, le contrôle complet de l’Audio / Micro / Volume / SFX, le Casier, le Mode VR, le Chat, le Classement, les Nouveautés, le Replay Intro et la Déconnexion sont désormais regroupés dans le Menu Paramètres avec fermeture automatique du panneau à l’ouverture de la Boutique.'
      },
      {
        badge: 'ATELIER 3D & ÉCRANS CIEL OS',
        title: 'Suppression du Meuble 3D Boutique & Affichage Simple Face (FrontSide) sur Tous les PC CIEL OS',
        desc: 'Suppression complète de la borne 3D Boutique à côté de l’espace professeurs (mesh, collider, sprite et zone d’interaction) tout en conservant la Boutique accessible depuis les Paramètres et la montre VR. Correction de tous les moniteurs PC CIEL OS (élèves, professeurs et PC plaçables) pour n’afficher la CanvasTexture dynamique que sur la face avant (side: THREE.FrontSide) avec un dos et des côtés opaques sombres.'
      }
    ]
  },
  {
    version: 'v4.26 — Adaptation Complète de Tous les TPs et de l’Interface au Mobile & Tablette',
    date: '19/11/2026',
    tag: 'HISTORIQUE',
    items: [
      {
        badge: 'ERGONOMIE TACTILE 3D',
        title: 'Détection Auto Mobile/Tablette, Joystick & Caméra Tactile, Bouton Contextuel & PixelRatio Adaptatif',
        desc: 'Détection automatique iOS / Android / iPadOS (portrait et paysage, viewport 100dvh, safe-area et touch-action: none), curseur de sensibilité tactile dédié, gros bouton contextuel [👆 Interagir] affiché dès qu’un poste ou TP est ciblé ou à portée, et limitation adaptative du pixelRatio et des ombres pour un framerate fluide sans surchauffe tout en préservant le mode PC et la VR WebXR.'
      },
      {
        badge: 'TOUS LES TPS AU DOIGT',
        title: 'Refonte Tactile Universelle des 9 TPs 3D, Tap-to-Connect, Réglages Fins [-]/[+] & Pavés Intégrés',
        desc: 'Support unifié Pointer Events sur 100 % des TPs (Oscilloscope, Brasure PCB, Électronique, Baie RJ45 T568B, VLAN CLI, Cybersécurité SOC, Montage PC, Régie DMX512 et Studio Broadcast) : glisser-déposer au doigt + mode Tap-to-Connect, boutons [-]/[+] d’ajustement fin sur chaque molette/curseur, pavés IP/CLI/DMX intégrés, zoom agrandi pour oscilloscopes/PCB/DMM/testeurs/moniteurs, mise en page responsive 360px–1024px (zones >= 44px) et manette tactile CIEL OS pour les 6 mini-jeux.'
      }
    ]
  },
  {
    version: 'v4.25 — Refonte & Équilibrage de Tous les Barèmes (20/20 Accessible et Transparent)',
    date: '19/11/2026',
    tag: 'HISTORIQUE',
    items: [
      {
        badge: 'BARÈMES RÉÉQUILIBRÉS /20',
        title: 'Sommes Exactes sur 20, Droit à l’Erreur Corrigée, Chronos & Tolérances Élargies',
        desc: 'Audit complet de tous les TPs PC & VR : suppression des plafonds bloqués à 19 ou 19.5/20 (Baie de brassage, Studio Régie), chronos confortables de 5 à 7 minutes adaptés à la VR, droit à l’erreur corrigée (1 à 2 erreurs mineures pardonnées si le résultat final est propre), pénalités plafonnées, tolérances analogiques élargies (Oscilloscope, Brasure, DMX512, Studio Régie, Électronique) et arrondi généreux au 0.5 supérieur (20/20 garanti dès ≥ 19.25 sans erreur critique).'
      },
      {
        badge: 'TRANSPARENCE PC & VR',
        title: 'Détail Point par Point du Barème, Mention « Parfait 20/20 » & Fanfare Dédiée',
        desc: 'Chaque écran de fin de TP (modale PC et panneau spatial VR) affiche désormais le détail complet des points obtenus critère par critère, les erreurs pardonnées, les gains XP / CIEL Coins, un conseil concret du Professeur CIEL si la note est inférieure à 20, ainsi qu’une célébration visuelle dorée et une fanfare sonore dédiée (perfect20) lorsque l’élève décroche 20/20.'
      }
    ]
  },
  {
    version: 'v4.24 — Économie Virtuelle CIEL Coins, Boutique Complète, Skins & Compagnons Pets 3D',
    date: '18/11/2026',
    tag: 'HISTORIQUE',
    items: [
      {
        badge: 'ÉCONOMIE CIEL COINS',
        title: 'Monnaie Virtuelle Sécurisée, Persistance Atomique & Gains Équilibrés',
        desc: 'Introduction des CIEL Coins (🪙 CC) persistés côté serveur avec protection anti-triche : gains proportionnels aux notes de TPs 3D (25 CC à 10/20, 50 CC à 15/20, 100 CC à 20/20 + 50 CC de première validation), mode Survie Horreur (150 CC en victoire, 40 CC en défaite, +15 CC par tableau de variation résolu en heure de colle) et mini-jeux CIEL OS sur les PC (10 à 45 CC selon le palier + bonus record personnel), affichés en temps réel dans le HUD PC et la montre VR.'
      },
      {
        badge: 'BOUTIQUE & SKINS 3D',
        title: 'Boutique Complète (PC & VR), Borne 3D en Salle, Skins Exclusifs, Pets 3D Animés & Accessoires',
        desc: 'Nouveau catalogue structuré en 4 raretés (Commun, Rare, Épique, Légendaire) de 150 à 2 500 CC : 8 skins exclusifs 3D (Technicien Néon, Hacker Matrix, Ingénieur Fibre Optique, Cyber-Samouraï, Steampunk Cuivre, Agent SOC, Astronaute Réseau, Overclocked Gold), 6 compagnons Pets 3D animés suivant le joueur en multijoueur (Mini-Drone Quadri, Bot Serveur Rack 1U, Berger Cyber-K9, Cube Hologramme, Petit Routeur Wi-Fi 7, Faucon Laser) et 5 accessoires/auras équipables via la borne 3D du hall, le HUD ou le panneau spatial VR avec aperçu 3D rotatif.'
      }
    ]
  },
  {
    version: 'v4.23 — Optimisation Massive des Performances FPS, Correction Déblocage Baie de Brassage & Heure de Colle en Solo',
    date: '18/11/2026',
    tag: 'HISTORIQUE',
    items: [
      {
        badge: 'PERFORMANCES & FPS MASSIFS',
        title: 'Throttling Intelligent des Écrans CIEL OS, Matrices Statiques Figées & Rendu Optimisé',
        desc: 'Rafraîchissement en temps réel (30-60 FPS) réservé au PC actif ou aux écrans à moins de 4 mètres dans le champ de vision avec mise en veille automatique des postes distants (horloge toutes les 2s ou pause hors caméra), plafonnement pixelRatio à 1.5, shadow.mapSize à 1024x1024, WebGLRenderTarget POV en 512x288 à 22 FPS, matrixAutoUpdate=false sur tout le mobilier statique et zéro allocation mémoire dans la boucle de rendu.'
      },
      {
        badge: 'CORRECTIF BAIE DE BRASSAGE',
        title: 'Sortie Dégagée à 1.15m Devant la Porte Sans Écran Noir ni Blocage Joueur',
        desc: 'Réinitialisation instantanée du filtre sombre (opacity=0, display=none) et de l’exposition de scène dès la sortie d’une baie de brassage ([E] ou bouton VR), calcul d’une position de sortie validée sans collision à 1.15m devant la porte selon sa rotation rotRad, et réactivation immédiate des contrôles PC/VR ainsi que de l’avatar.'
      },
      {
        badge: 'HEURE DE COLLE 3D EN SOLO',
        title: 'Accès à la Salle de Colle 3D à 1 Joueur & Bouton 3D Discret sur le Coin du Bureau',
        desc: 'En partie Survie 1 joueur, se faire attraper par le Professeur CIEL envoie désormais directement l’élève dans la Salle d’Heure de Colle 3D (feuille interactive de tableaux de variation et écran du tableau diffusant la caméra POV en direct du Professeur CIEL en patrouille), avec un bouton 3D discret sur le coin du bureau (souris PC et laser/main VR) pour quitter la colle ou relancer une partie.'
      }
    ]
  },
  {
    version: 'v4.22 — Postes PC Fonctionnels : CIEL OS Interactif & Salle d’Arcade Mini-Jeux sur Tous les Bureaux',
    date: '18/11/2026',
    tag: 'HISTORIQUE',
    items: [
      {
        badge: 'TOUS LES PC INTERACTIFS 3D',
        title: 'Détection Universelle des Bureaux & Écrans Dynamiques THREE.CanvasTexture',
        desc: 'Tous les ordinateurs posés sur les bureaux du Plateau U300 (cabines U304, postes SOC U305, banc diagnostic U306, îlots réseau U307 et bureaux de l’éditeur de carte) sont désormais 100 % interactifs ([E] 🖥️ Utiliser le PC (CIEL OS)) avec zoom caméra 3D confort sur PC et raycast laser / panneau miroir rapproché en VR WebXR.'
      },
      {
        badge: 'SYSTÈME D’EXPLOITATION CIEL OS',
        title: 'Bureau Graphique, 4 Thèmes, Barre des Tâches, Terminal, Bloc-Notes & Scores',
        desc: 'OS complet haute résolution (1024x640) avec session élève nominative, 4 thèmes de fond d’écran (Cyber Bleu, Matrix Vert, Synthwave, Mode Sombre), menu Démarrer, gestion de fenêtres, contrôle du volume Web Audio, Terminal CIEL (help, ping, matrix, whoami, hack, cowsay), Bloc-Notes technique et Explorateur de Scores.'
      },
      {
        badge: '6 MINI-JEUX D’ARCADE PC & VR',
        title: 'Cyber Snake, Démineur CIEL, CIEL-Blocks, Casse-Briques Réseau, Flappy Packet & 2048 CIEL',
        desc: 'Collection complète de 6 mini-jeux intégrés dans les fenêtres de CIEL OS, jouables au clavier/souris sur PC comme au laser/doigt/joysticks en VR avec bruitages rétro synthétisés et sauvegarde locale des records.'
      }
    ]
  },
  {
    version: 'v4.21 — Correctifs Salle de Colle 3D : Caméra Libre Assise, Zéro ATH & Cinématique d’Intro Sans Traversée de Murs',
    date: '17/11/2026',
    tag: 'HISTORIQUE',
    items: [
      {
        badge: 'CAMÉRA LIBRE ASSISE PC & VR',
        title: 'Rotation 360° de la Tête sur Chaise en Salle d’Heure de Colle 3D',
        desc: 'Déblocage complet de la rotation caméra en position assise : sur PC via souris / PointerLock, cliquer-glisser ou flèches directionnelles avec maintien du clic direct sur la feuille du bureau et ZQSD verrouillé sur la chaise ; en VR WebXR via positionnement exact du rig à hauteur assise face au bureau, suivi 6DoF libre, snap-turn au joystick droit et blocage du déplacement au joystick gauche.'
      },
      {
        badge: 'IMMERSION ZÉRO ATH',
        title: 'Masquage Intégral de Tout l’ATH (HUD) en Salle d’Heure de Colle',
        desc: 'Dès l’entrée en Salle de Colle, la barre supérieure, la minimap, les notes, l’XP, le classement, les boutons audio/micro, les contrôles tactiles, la smartwatch VR et tous les panneaux flottants ou modales 2D sont intégralement masqués pour ne laisser visibles que la salle 3D, la feuille de maths et l’écran POV des coéquipiers, puis restaurés automatiquement au retour au hall.'
      },
      {
        badge: 'CINÉMATIQUE ANTI-MURS',
        title: 'Trajectoire d’Introduction Survie Horreur 100 % Dégagée dans le Hall U300',
        desc: 'Placement dynamique du Professeur CIEL et de la caméra dans la même zone connectée et dégagée du plateau avec vérification de ligne de vue libre et garde-fou par collision/raycast (getDynamicMapColliders et grille navigable) à chaque frame du travelling sur PC et en VR.'
      }
    ]
  },
  {
    version: 'v4.20 — Instance Isolée Survie, Cinématique Intro & Salle de Colle 3D POV Live',
    date: '17/11/2026',
    tag: 'HISTORIQUE',
    items: [
      {
        badge: 'INSTANCE ISOLÉE & SOLO 1+ JOUEUR',
        title: 'Salles Survie Isolées (survival-game-...) & Lancement dès 1 Joueur',
        desc: 'Chaque partie de Survie Horreur bascule désormais dans sa propre instance isolée (survival-game-...) invisible depuis plateau-u300, ne montrant et ne faisant entendre que les participants de la partie et le Professeur CIEL. Le seuil de lancement passe à 1 joueur minimum (testable en solo comme en coop) avec retour automatique sur plateau-u300 en fin de partie.'
      },
      {
        badge: 'CINÉMATIQUE HORREUR PC & VR',
        title: 'Séquence d’Introduction Coupure de Courant, Alarme & Briefing CIEL',
        desc: 'Au lancement de la traque : coupure brutale de l’éclairage de l’atelier vers une atmosphère rouge/tamisée avec alarme sonore et grésillement électrique, travelling caméra sur le Professeur CIEL (PC) ou cadrage spatial sécurisé (VR WebXR) et panneau de briefing interactif avant la reprise du contrôle au point d’apparition.'
      },
      {
        badge: 'SALLE DE COLLE 3D',
        title: 'Véritable Salle de Classe 3D avec Feuille de Maths Interactive sur le Bureau',
        desc: 'Remplacement de la fenêtre 2D bloquante par une vraie salle d’heure de colle 3D (pupitres, chaises, horloge murale animée, fenêtre à barreaux et grand tableau face à l’élève). Les exercices de tableaux de variation s’affichent directement sur une feuille 3D posée sur le bureau, cliquable à la souris sur PC et au laser/main VR.'
      },
      {
        badge: 'CAMÉRA POV LIVE SUR TABLEAU',
        title: 'Écran Tableau WebGLRenderTarget Temps Réel sur le Point de Vue des Coéquipiers',
        desc: 'Un grand écran de surveillance sur le tableau 3D rend en direct la véritable vue à la première personne (POV) d’un coéquipier survivant sur la carte (course, cachette en baie, manipulation de TP), avec boutons Caméra Précédente / Suivante sur le bureau, le tableau et en VR, et vue de patrouille du Professeur CIEL ou du plateau en solo.'
      }
    ]
  },
  {
    version: 'v4.19 — Mode Survie Horreur : La Traque du Professeur CIEL, Baies de Brassage & Heure de Colle',
    date: '16/11/2026',
    tag: 'HISTORIQUE',
    items: [
      {
        badge: 'ÉDITEUR & LOBBY 2+ JOUEURS',
        title: 'Porte de Mini-Jeu Survie & Baies de Brassage (Cachettes) dans MapEditor',
        desc: 'Ajout de deux nouveaux objets constructibles dans l’éditeur 3D (src/admin/MapEditor.js, mapSchema.js et LabBuilder.js) : la Porte de Survie menant au salon d’attente dédié (lancement automatique dès 2 joueurs minimum prêts) et les Baies de Brassage disséminées dans l’atelier pour se dissimuler.'
      },
      {
        badge: 'IA & ÉCOUTE MICRO EN DIRECT',
        title: 'Atmosphère Horrifique, Pathfinding A* & Traque du Professeur CIEL',
        desc: 'Lumières vacillantes, brouillard oppressant, lampe torche, pas lourds et battements cardiaques. L’IA A* patrouille sans blocage dans les murs, analyse le volume RMS réel du microphone (ProximityVoiceChat) pour foncer vers les cris à travers les cloisons, et perd la trace si l’élève reste silencieux dans une Baie de Brassage.'
      },
      {
        badge: 'JUMPSCARE & HEURE DE COLLE',
        title: 'Capture, Salle de Détention, Tableaux de Variation & Caméras de Surveillance',
        desc: 'En cas de capture : jumpscare immédiat visuel/sonore/haptique puis téléportation en Salle d’Heure de Colle. Les élèves collés résolvent en boucle des exercices de tableaux de variation de fonctions tout en observant la position en direct de leurs camarades survivants sur l’écran de vidéosurveillance.'
      },
      {
        badge: 'COOP & 100 % VR WEBXR',
        title: 'Cinématiques Victoire/Défaite & Support Total Meta Quest / Sim VR (F9)',
        desc: 'Victoire coopérative si 100 % des TPs sont validés par les survivants (retour de toute la classe au hall) ou défaite si toute la classe finit en colle. Ensemble des mécaniques jouables au laser VR et au toucher spatial via les nouveaux panneaux 3D de VRHudPanel.'
      }
    ]
  },
  {
    version: 'v4.18 — Adaptation Complète de Tous les TPs en VR WebXR & Panneaux Spatiaux Interactifs',
    date: '16/11/2026',
    tag: 'HISTORIQUE',
    items: [
      {
        badge: 'TPS 100 % VR WEBXR',
        title: 'Déblocage Intégral de Tous les TPs & Dialogue Professeur CIEL en VR',
        desc: 'Suppression des blocages VR dans main.js et autorisation du rendu customRenderScene en WebXR : Cybersécurité SOC, Réseaux VLAN/CLI, Brassage Baie 19", Assemblage PC, Électronique, Oscilloscope, Brasure PCB 3D, DMX & Régie Studio sont désormais 100 % jouables et validables jusqu’à 20/20 dans le casque.'
      },
      {
        badge: 'PANNEAU SPATIAL 3D',
        title: 'Interface Haute Lisibilité 1280x800, Sliders, Clavier Virtuel & Caméra VR',
        desc: 'Nouveau panneau spatial flottant devant l’élève (~1.2m) pilotable au laser (gâchette / selectstart) et au toucher direct par mains articulées (hand-tracking), incluant sliders interactifs (Température fer, DMX, Studio), clavier virtuel AZERTY 3D + presets CLI, zoom/pivot/vues caméra et bouton permanent Quitter le TP.'
      },
      {
        badge: 'BRASURE & PAILLASSES 3D',
        title: 'Sérigraphie 3D sur PCB, Molette Thermique & Hitboxes RJ45 Élargies',
        desc: 'Pastilles Brasure/Oscillo sérigraphiées en 3D directement sur les cartes, maintien de gâchette optimisé sans lag, potentiomètre 260-420°C tactile et hitboxes Switch/Panneau 24 ports adaptées au pointage laser VR.'
      },
      {
        badge: 'COMPTES, WATCH & ASCENSION',
        title: 'Sauvegarde 20/20, Progression CIEL Watch & Cérémonie Divine en VR',
        desc: 'Synchronisation immédiate des notes /20 via POST /api/account/save, affichage des TPs validés sur la CIEL Watch au poignet gauche, entretien complet avec le Professeur CIEL et déclenchement interactif de l’Ascension « Dieu du Bac Pro CIEL », Prestige et Skin Suprême Glitch directement en VR.'
      }
    ]
  },
  {
    version: 'v4.17 — Ergonomie CIEL Watch VR, Masquage Panneau Debug, Fix Bras Croisés Multi & Sélecteur Audio',
    date: '16/11/2026',
    tag: 'HISTORIQUE',
    items: [
      {
        badge: 'AUDIO MICRO/CASQUE',
        title: 'Sélecteur d’Entrée / Sortie Audio, Vu-mètre & Changement à Chaud',
        desc: 'Nouveau menu 🎧 Audio dans le HUD en jeu permettant de sélectionner le microphone et la sortie audio (casque / enceintes via setSinkId sur WebRTC spatial et effets Web Audio), avec vu-mètre temps réel, persistance localStorage, écoute automatique de ondevicechange et bascule de micro à chaud via RTCRtpSender.replaceTrack.'
      },
      {
        badge: 'MULTIJOUEUR VR',
        title: 'Correction des Bras Croisés sur les Avatars VR Distants',
        desc: 'Alignement du repère d’épaules et de coudes dans AvatarBuilder.attachRemoteVrVisuals en tenant compte de la rotation de 180° entre le modèle avatar (+Z) et le repère caméra WebXR (-Z) afin que le bras gauche suive toujours la main gauche et le bras droit la main droite sans jamais se croiser.'
      },
      {
        badge: 'CIEL WATCH VR',
        title: 'Orientation Ergonomique Naturelle sur le Poignet Gauche',
        desc: 'Repositionnement dorsal/radial de la montre CIEL Watch sur la main gauche (inclinaison naturelle ~42° autour de l’avant-bras vers le regard), affichage du texte parfaitement à l’endroit sans clipping, réveil intelligent au regard et interaction laser/tactile conservée sur Micro et Quitter VR.'
      },
      {
        badge: 'CONFORT VR',
        title: 'Masquage par Défaut du Panneau Flottant Debug WebXR',
        desc: 'Le panneau 3D DEBUG WEBXR est désormais masqué par défaut en session VR standard pour dégager la vue dans l’atelier, et s’affiche automatiquement en Serveur Privé Debug ou via le bouton dédié des outils de debug.'
      }
    ]
  },
  {
    version: 'v4.16 — Correctif Note 20/20 TP Brasure & Attribution Passe VIP Palier 7 à yanfufu',
    date: '16/11/2026',
    tag: 'HISTORIQUE',
    items: [
      {
        badge: 'TP BRASURE 20/20',
        title: 'Résolution du Plafond 19.8/20 & Courbe Thermique Réaliste',
        desc: 'Suppression de la pénalité injustifiée reworkCount lorsque l’élève nettoie les ponts de soudure initiaux U2/U3 avec la tresse à dessouder, suppression de la zone morte thermique 395–405 °C, refroidissement ralenti, tolérance temps élargie à 240s et sauvegarde garantie à 20/20 via POST /api/account/save.'
      },
      {
        badge: 'PASSE VIP PALIER 7',
        title: 'Attribution Automatique « Clé Maîtresse Baie Serveur » pour yanfufu',
        desc: 'Attribution automatique et persistante du Palier 7 Passe VIP (Fibre Sombre & Finitions Or 24K, Badge VIP Or 3D, Mini-Drone Cisco, Particules Dorées & Accès Chambre VIP) au joueur yanfufu à la migration/chargement du store, à l’inscription et à la connexion sans affecter sa progression TPs.'
      },
      {
        badge: 'CASIER & RENDU 3D',
        title: 'Équipement Direct dans le Casier, Passe de Combat, Multijoueur & VR',
        desc: 'Ajout des skins Passe VIP débloqués dans SkinCustomizer, BattlePassModal (boutons ✅ DÉBLOQUÉ & ✨ ÉQUIPER), AvatarBuilder, RemotePlayers (badge 🔑VIP or) et conservation de selectedSkin lors de la validation des TPs.'
      },
      {
        badge: 'PANNEAU /ADMIN',
        title: 'Affichage VIP & Modale de Gestion des Skins Passe VIP',
        desc: 'Affichage des badges Passe VIP et 🔐 Chambre VIP sur les fiches comptes/joueurs de /admin avec ajout de la modale « 🎁 Skins VIP » et des routes POST /api/admin/accounts/:target/battlepass et /special-skins.'
      }
    ]
  },
  {
    version: 'v4.15 — Diagnostic Profond Écran Noir WebXR, Panneau Debug VR & Rapport Technique',
    date: '16/11/2026',
    tag: 'HISTORIQUE',
    items: [
      {
        badge: 'CORRECTIF CRITIQUE VR',
        title: 'Résolution du Crash Raycaster Sprite en VR (Cause Principale Écran Noir)',
        desc: 'Correction du plantage fatal sur la toute première frame VR dans VRManager._updateSlotRayAndInteract et SceneManager.pickLabInteractable : les bornes TP et le Professeur CIEL possèdent un THREE.Sprite enfant qui provoquait TypeError (raycaster.camera === null) avant même renderer.render(), laissant le framebuffer Quest 3S totalement noir.'
      },
      {
        badge: 'PIPELINE WEBXR',
        title: 'Contexte WebGL2 xrCompatible, Boucle Unique & Isolation des Erreurs',
        desc: 'Initialisation WebGL2 avec xrCompatible: true et alpha: false dans SceneManager, clearColor jour (#cfe4f7), vérification unique de sessionstart/sessionend, contournement garanti des customRenderScene/RenderTargets non-XR, arrêt des boucles requestAnimationFrame résiduelles (SkinPreview3D & animateCameraPose) et isolation try/catch de la boucle setAnimationLoop.'
      },
      {
        badge: 'RIG & LUMIÈRES',
        title: 'Positionnement Sécurisé du Rig VR & Éclairage Ambient/Hemisphere/Sun',
        desc: 'Sonde préalable du ReferenceSpace (local-floor y=0 ou local y=1.65) pour un seul appel setSession propre, vérification de position dégagée au centre de U300, frustum near=0.05/far>=180, ajout d’une AmbientLight complémentaire et masquage des overlays HTML/CSS (body.vr-presenting).'
      },
      {
        badge: 'DEBUG 3D & DOC',
        title: 'Panneau de Diagnostic 3D Flottant en VR & Rapport Technique LAST_REPORT.md',
        desc: 'Ajout d’un panneau 3D flottant temps réel devant le joueur en VR (XR Presenting, ReferenceSpace, Rig XYZ, FPS, compteur de frames et erreurs WebGL/XR capturées) et génération systématique du rapport complet dans LAST_REPORT.md.'
      }
    ]
  },
  {
    version: 'v4.14 — Refonte VR Fondamentale : Mains Articulées, Sync Multijoueur & Smartwatch Minimap',
    date: '16/11/2026',
    tag: 'HISTORIQUE',
    items: [
      {
        badge: 'VR / WEBXR',
        title: 'Mains 3D Articulées à 3 Phalanges & Hand-Tracking Optionnel',
        desc: 'Refonte des mains 3D dans VRHandBuilder & VRManager : suivi ergonomique des contrôleurs Meta Quest (gâchette, grip, repose-pouce capacitif) et prise en charge optionnelle du Hand-Tracking WebXR avec articulation individuelle des 5 doigts sur 3 phalanges et adaptation automatique aux skins (Standard, Or 24K, Diamant, Matrix, Divins et Skin Secret Ultime).'
      },
      {
        badge: 'MULTIJOUEUR',
        title: 'Synchronisation Temps Réel Tête, Bras à 2 Segments & Doigts via WebSockets',
        desc: 'Transmission optimisée des quaternions normalisés et des flexions de doigts dans server/wsHub.js, AvatarBuilder et RemotePlayers : tous les élèves (PC, Mobile et VR) voient en direct les mouvements exacts de la tête, des bras articulés, des mains, du casque VR et de la montre du joueur en VR.'
      },
      {
        badge: 'SMARTWATCH',
        title: 'Montre Intelligente 3D au Poignet Gauche avec Minimap U300 Temps Réel',
        desc: 'Nouvel écran OLED haute lisibilité monté sur boîtier/bracelet 3D au poignet gauche (VRHudPanel + HudManager) : mini-carte stylisée du Plateau U300 affichant votre position, votre cône d’orientation, les salles et les autres participants, état de connexion WebSocket en direct, jauge vocale et boutons laser Micro / Quitter VR.'
      },
      {
        badge: 'FONDATION VR',
        title: 'Locomotion Fluide, Snap-Turn 35° & Gestion Sécurisée local-floor',
        desc: 'Navigation VR stabilisée pour Meta Quest Browser : stick gauche avec zone morte radiale pour avancer/reculer/strafer avec glissement contre les murs (PlayerController.moveHorizontally), stick droit pour le Snap-Turn 35° centré sur le joueur, gestion stricte du plancher local-floor anti-chute sous le sol et boucle de rendu WebXR anti-écran noir (SceneManager).'
      },
      {
        badge: 'INFO',
        title: 'Interactions Complexes des TPs Simplifiées en VR',
        desc: 'Pour garantir une expérience d’exploration et de communication vocale parfaitement fluide et stable en VR, l’ouverture des ateliers TP complexes est temporairement mise en pause en mode VR (notification informative sur le HUD et la smartwatch) avant leur refonte dédiée dans une prochaine mise à jour.'
      }
    ]
  },
  {
    version: 'v4.12 — Cinématique d’Introduction Professeur CIEL, Cycle de Prestige & Skin Secret Ultime',
    date: '16/11/2026',
    tag: 'HISTORIQUE',
    items: [
      {
        badge: 'NOUVEAU',
        title: 'Cinématique d’Accueil Guidée par le Professeur CIEL (introSeen)',
        desc: 'Lors de la première connexion après création de compte (introSeen = false), une visite guidée panoramique du Plateau U300 se lance automatiquement avec le Professeur CIEL : présentation des 5 pôles de TPs (Cyber, Réseaux, Électronique, Systèmes, Audiovisuel), explication des Skins Divins à 20/20, du Cycle de Prestige et d’un mystère secret à percer.'
      },
      {
        badge: 'NOUVEAU',
        title: 'Enregistrement introSeen & Bouton « 🎬 Revoir l’intro »',
        desc: 'Une fois terminée ou passée, la cinématique enregistre introSeen = true dans accounts.json via POST /api/account/save afin de ne plus se rejouer automatiquement, tout en restant accessible à volonté depuis le bouton « 🎬 Revoir l’intro » dans le menu et le HUD.'
      },
      {
        badge: 'NOUVEAU',
        title: 'Cycle de Prestige & 5e Spécialité Divine (Audiovisuel)',
        desc: 'Après avoir obtenu 20/20 sur 100 % des TPs et choisi un Skin Divin lors de la cérémonie d’Ascension (Cyber, Réseaux, Électronique, Systèmes ou Audiovisuel), l’élève débloque ce skin dans son compte et ses notes de TPs (tpScores/grades) sont réinitialisées pour entamer un nouveau Cycle de Prestige et collectionner les autres skins divins.'
      },
      {
        badge: 'NOUVEAU',
        title: 'Skin Secret Ultime : Entité Quantique CIEL (Architecte Suprême)',
        desc: 'Dès que les 5 skins divins de spécialité sont réunis dans unlockedDivineSkins, le Skin Secret Ultime se débloque automatiquement avec une annonce HUD spectaculaire (🌌 MYSTÈRE RÉVÉLÉ !). Dans le casier, son visuel et son nom restent masqués et verrouillés côté client et strictement protégés côté serveur tant que tous les skins divins ne sont pas acquis.'
      },
      {
        badge: 'VISUEL 3D',
        title: 'Rendu 3D Cosmique & Prismatique Multijoueur du Skin Secret Ultime',
        desc: 'Armure quantique iridescente animée, triple anneaux orbitaux gyroscopiques à satellites, ailes holographiques à 5 lames prismatiques, double couronne céleste, halo luminescent et traînée de particules cosmiques synchronisés en temps réel entre tous les joueurs (AvatarBuilder & RemotePlayers).'
      }
    ]
  },
  {
    version: 'v4.11 — Correctif Condition 20/20 Intégral & Reset Global',
    date: '16/11/2026',
    tag: 'HISTORIQUE',
    items: [
      'Correction critique du déclenchement de la Cinématique d’Ascension « Dieu du Bac Pro CIEL » et du déblocage des Skins Divins : exige désormais 20/20 sur 100 % des TPs du jeu (Cyber, Réseaux, Électronique, Systèmes et Audiovisuel), uniquement lors de la première validation intégrale (ou via le pouvoir manuel du créateur Louis / le bouton « 💯 Tout valider à 20/20 » du Serveur Privé Debug).',
      'Suppression du déclenchement sur un seul TP à 20/20 (client et serveur) : obtenir 20/20 sur un seul TP affiche désormais uniquement la réussite normale du TP sans cinématique mondiale ni déblocage de skin spécial.',
      'Durcissement serveur sur POST /api/account/save, WebSocket et normalisation GameStore : impossible d’ajouter ou d’équiper un Skin Divin dans unlockedDivineSkins tant que tous les TPs du compte ne sont pas à 20/20.',
      'Reset global unique au démarrage de la v4.11 sur server/data/accounts.json (avec marqueur de migration version 4.11 / resetV411Done pour préserver les comptes créés ensuite) afin que chaque élève reparte sur une base propre sans skin obtenu par erreur.'
    ]
  },
  {
    version: 'v4.10 — Refonte Complète & Correction des TPs Audiovisuel',
    date: '16/11/2026',
    tag: 'HISTORIQUE',
    items: [
      'Audit et refonte complète du raycasting 3D et des interactions audiovisuelles sur le plateau (pickLabInteractable avec occultation par murs pleins, surbrillance sans mutation des matériaux partagés, halo au sol, visée pointeur verrouillé et libre, équipements U303/U304 interactifs et synchronisation VR WebXR complète sans état bloqué).',
      'Refonte complète des TPs DMX Lighting 3D (chaînage XLR DMX512 dans l’ordre avec bouchon 120 Ω, écrans OLED avant/arrière + boutons -1/+1 VR-ready, faders inclinés fluides 20/20 garanti) et Studio Régie Vidéo/Son 3D (patch 3 liaisons SDI/XLR obligatoires avant signal, balance des blancs & éclairage 3D dynamique, mixage +48V/HPF/-12 dBFS sans NaN, réalisation ATEM Cut/Take et conseils contextuels du Professeur CIEL).',
      'Nouveaux retours sonores synthétisés Web Audio API dédiés à l’audiovisuel (sélection/verrouillage XLR & SDI, bip d’adressage DMX, crans de faders, +48V, Cut ATEM et validation d’étape) et panneaux latéraux foncés haute lisibilité (.av-*).',
      'Persistance réseau sécurisée des notes audiovisuelles dans server/data/accounts.json (protection anti-NaN/undefined/hors-bornes côté client et serveur), affichage des notes obtenues sur l’accès rapide du HUD, déclenchement cohérent de l’Ascension « Dieu du Bac Pro CIEL » et validation 20/20 via le mode Serveur Privé Debug.'
    ]
  },
  {
    version: 'v4.9 — Système de Comptes Élèves, Persistance des Skins Divins & Gestion Admin',
    date: '16/11/2026',
    tag: 'HISTORIQUE',
    items: [
      'Stockage dédié des comptes dans server/data/accounts.json et remise à zéro initiale des anciens profils afin de repartir sur une base 100 % liée aux comptes élèves (id, username unique insensible à la casse, password récupérable, createdAt, tpScores, unlockedDivineSkins, selectedSkin, avatarCustomization).',
      'Nouvelle interface d’authentification à deux onglets sur l’accueil (« Connexion » et « Créer un compte ») reliée aux routes sécurisées POST /api/auth/register, POST /api/auth/login, GET /api/auth/me et POST /api/account/save.',
      'Reconnexion automatique par jeton de session léger en localStorage, bouton « 🚪 Déconnexion » dans le menu et le HUD, et synchronisation automatique des notes de TPs, de la personnalisation d’avatar et du déblocage permanent des Skins Divins 20/20 dans le casier.',
      'Nouvelle section « 👥 Comptes Élèves & Récupération d’Accès » dans /admin : recherche par pseudo, affichage/masquage et copie en un clic du mot de passe pour dépanner un élève, suivi des TPs à 20/20 et Skins Divins, modification du mot de passe, réinitialisation et suppression de compte.'
    ]
  },
  {
    version: "v4.8 — Cinématique d'Ascension Dieu du Bac Pro CIEL & Skins Dynamiques",
    date: '16/11/2026',
    tag: 'HISTORIQUE',
    items: [
      'Cinématique 3D scénarisée et synchronisée en multijoueur autour du Professeur CIEL : déclenchée dès qu’un élève valide tous les TPs à 20/20 (ou via le Pouvoir Créateur Louis / Serveur Privé Debug), verrouillant temporairement les déplacements libres et téléportant l’élève lauréat à côté du Professeur CIEL avec tous les camarades rassemblés en demi-cercle.',
      'Dialogue interactif solennel du Professeur CIEL (« Quel a été ton TP préféré durant ton parcours ? ») avec 4 boutons de spécialités réservés à l’élève célébré (Cybersécurité & Pentest, Réseaux & Fibre Optique, Électronique & Soudure, Systèmes & Serveurs Linux), compte à rebours de secours de 15s et message d’attente temps réel pour les spectateurs.',
      'Ascension « Dieu du Bac Pro CIEL » : faisceau de lumière vertical 3D, lévitation temporaire de l’élève au centre, explosion de particules dorées/cyan, annonce HUD (« ⚡ ASCENSION : [Pseudo] devient un DIEU DU BAC PRO CIEL ([TP choisi]) ! ⚡ »), fanfare Web Audio API et bouton « 👏 Applaudir » actif pendant 8 secondes à la reprise du contrôle.',
      'Skins Divins 3D exclusifs par spécialité (Cyber, Réseaux, Électronique, Systèmes) : armure holographique/néon, couronne énergétique, ailes et aura divine + accessoires 3D orbitaux thématiques synchronisés en temps réel (AvatarBuilder & RemotePlayers) uniquement en mémoire pour la session multijoueur en cours (sans persistance casier/localStorage).'
    ]
  },
  {
    version: 'v4.7 — Cinématique Mondiale 20/20, Pouvoirs Exclusifs & Serveur Privé Debug',
    date: '16/11/2026',
    tag: 'HISTORIQUE',
    items: [
      'Cinématique Mondiale 20/20 : lorsqu’un élève décroche 20/20 à un TP 3D, diffusion réseau à toute la salle avec bannière HUD dorée animée (« 🏆 EXPLOIT CIEL : [Pseudo] a décroché 20/20 au TP [Nom du TP] ! »), feux d’artifice 3D, pluie de particules dorées/cyan, éclairages dynamiques et applaudissements synthétisés en Web Audio API.',
      'Action rapide « 👏 Applaudir » affichée pendant 8 secondes dans le HUD lors d’un 20/20 pour permettre aux camarades d’envoyer des émojis festifs au-dessus de leur avatar 3D.',
      'Pouvoir Exclusif Créateur (« 👑 Pouvoir Créateur ») réservé au pseudo « Louis » (insensible à la casse) : déclenchement manuel de la célébration mondiale 20/20 pour toute la classe et activation d’une aura lumineuse dorée 3D synchronisée en multijoueur.',
      'Serveur Privé & Outils de Debug depuis /admin (« 🔒 Lancer une partie sur Serveur Privé (Mode Debug) ») : salon privé isolé invisible des élèves publics avec badge « 🛠️ SERVEUR PRIVÉ DEBUG », validation instantanée « 💯 Tout valider à 20/20 », réinitialisation, vitesse sprint/noclip, téléportation vers tous les TPs/salles U300 et télémétrie temps réel (FPS, ping, XYZ, WebSocket).'
    ]
  },
  {
    version: 'v4.6 — Mode VR WebXR, Mains 3D Articulées & Sync Multijoueur',
    date: '13/11/2026',
    tag: 'HISTORIQUE',
    items: [
      'Intégration complète WebXR (optimisée Meta Quest 3S, local-floor, 72–90 Hz) + Mode Simulation VR sur PC via la touche F9 et boutons « MODE VR (QUEST / WEBXR) » dans le Menu Principal, le sélecteur de plateforme et le HUD.',
      'Mains 3D articulées gauche/droite adaptées aux skins du casier (Or 24K, Diamant, Matrix, Carbone Néon, Chrome RGB, Cyber Or, tenue standard) avec pliage temps réel des 5 doigts sur 2 phalanges depuis les boutons gâchette, grip et repose-pouce.',
      'Synchronisation multijoueur Cross-Play 3-Point Tracking à 20 Hz (Tête + Mains + Avant-bras dynamiques visibles par tous les joueurs PC, Mobile et VR sans aucune modification de la carte du lycée).',
      'Montre HUD 3D cliquable au poignet gauche, rayons laser cyan/vert avec réticule et retour haptique, locomotion fluide au stick gauche, rotation Snap Turn 35° au stick droit et compatibilité intégrale des 6+ Travaux Pratiques en réalité virtuelle.'
    ]
  },
  {
    version: 'v4.5 — Voice Chat de Proximité Spatialisé 3D',
    date: '13/11/2026',
    tag: 'HISTORIQUE',
    items: [
      'Ajout du Voice Chat de proximité Peer-to-Peer (WebRTC) : signalisation par salle (voice_state, rtc_offer, rtc_answer, rtc_ice_candidate) sur le serveur WebSocket avec nettoyage automatique des déconnexions.',
      'Audio spatialisé en temps réel via Web Audio API : volume à 100 % jusqu’à 3 m, atténuation naturelle entre 3 m et 18 m, inaudible au-delà de 18 m et balance stéréo Gauche / Droite selon l’orientation de la caméra.',
      'Interface PC et Mobile : bouton micro interactif dans le HUD et sur le pavé tactile, raccourci clavier V (caméra déplacée sur C), choix Micro Ouvert ou Push-to-Talk, volume vocal et comportement pendant les TPs dans les Paramètres, barre compacte des camarades qui parlent à proximité et icône animée à ondes vertes au-dessus des avatars 3D.'
    ]
  },
  {
    version: 'v4.4 — Déblocage complet & Refonte interactive des TPs 3D',
    date: '13/11/2026',
    tag: 'HISTORIQUE',
    items: [
      'Correction critique du moteur 3D des TPs (Workbench3DHost & MiniGameModal) : résolution des crashs bloquants au chargement (makeCanvasScreen, buildFlexibleCable, addUpdate/onTick, finishTp, redimensionnement ResizeObserver et couche CSS z-index) permettant à 100 % des TPs de s’initialiser et de répondre immédiatement à la souris comme au tactile.',
      'Suppression du tapis ESD bleu dans les TPs Audiovisuel & Réseau VLAN : plateau scénique sombre + présentateur articulé issu d’AvatarBuilder + pont Truss à croisillons pour DMX512 ; cyclorama fond vert éclairé par softboxes + caméra broadcast avec pare-soleil + présentateur articulé pour Régie Studio ; bureau admin chêne/ardoise + baies et nœuds 3D enrichis pour VLAN 802.1Q.',
      'Interface interactive complète dans chaque TP : barre d’étapes synchronisée (setStages), panneaux latéraux contrastés avec commandes synchronisées aux objets 3D, surbrillance de survol préservant l’état des LEDs/boutons et validation complète sur /20 + XP.'
    ]
  },
  {
    version: 'v4.3 — Refonte Complète des 2 TPs Réseaux (Brassage RJ45 & VLAN 802.1Q)',
    date: '13/11/2026',
    tag: 'HISTORIQUE',
    items: [
      'TP Réseau A — Sertissage RJ45 & Brassage Baie Serveur 19" 3D (PatchPanelGame) : établi de sertissage transparent avec 8 brins cuivre à ordonner selon T568B + pince à sertir animée, baie 19" ouverte 24 ports (panneau numéroté + switch PoE + goulottes passe-câbles) avec cordons souples colorés par service (Bleu Élèves, Jaune Wi-Fi PoE, Rouge Serveurs) et testeur RJ45 séquentiel 1-8.',
      'TP Réseau B — Configuration VLAN 802.1Q, Trunk & Routage 3D (VlanConfigGame) : PC portable relié par câble console bleu ciel au Switch L3 / Routeur à côté d’une maquette 3D dynamique (Admin, Atelier, Wi-Fi, Switch Cœur, Pare-feu) avec création des VLAN 10/20/30, ports Access & Trunk 802.1Q, correction des passerelles Inter-VLAN et paquets Ping/Traceroute animés.'
    ]
  },
  {
    version: 'v4.2 — Refonte Complète des 2 TPs Audiovisuel (DMX512 & Régie Broadcast)',
    date: '13/11/2026',
    tag: 'HISTORIQUE',
    items: [
      'TP Audiovisuel A — Éclairage Scénique, Câblage XLR & Pupitre DMX512 3D : câblage série Daisy-Chain XLR souple (Pupitre → 4 projecteurs sur pont Truss), pose du bouchon de terminaison 120 Ω pour supprimer les parasites, adressage sur les écrans digitaux arrière (A001, A009, A017, A025) et réglage des 6 faders physiques DMX512.',
      'TP Audiovisuel B — Régie Broadcast, Calibration Caméra & Mixage Son 3D : objectif broadcast à 3 bagues mécaniques 3D (Focus, Iris, Balance des Blancs 5600K) avec rendu vidéo live sur le mur Multiview (Cam 1, Cam 2, Aperçu Fond Vert, Sortie Antenne PGM), seuil Chroma Key, console audio à VU-mètres LED et mélangeur vidéo CUT / TAKE.'
    ]
  },
  {
    version: 'v4.1 — 6 TPs 3D 100 % Uniques (Oscilloscope, Brassage, VLAN, DMX, Régie, Brasure)',
    date: '13/11/2026',
    tag: 'HISTORIQUE',
    items: [
      'Séparation complète des paires de TPs : chaque station possède désormais sa propre scène 3D, ses objets manipulables dédiés, sa mécanique métier et son barème /20.',
      'Électronique : Brasure PCB 3D enrichie (éponge humide à vapeur & bobine d’étain), Oscilloscope & GBF 3D (sans soudure) et nouvel atelier Électronique Breadboard & Multimètre Fluke 3D (code couleur, Loi d’Ohm LED et pont diviseur 5V → 3,3V).',
      'Réseau : TP Brassage Baie 19" 3D (sertissage RJ45 T568B fil à fil + pince animée, cordons par service avec guides-câbles, testeur 1-8+G) totalement séparé du TP Configuration VLAN & Routage CLI 3D (maquette campus 3D dynamique, console SSH L3, résolution boucle STP, Ping & Traceroute animés).',
      'Audiovisuel : TP Éclairage Scénique DMX512 3D (pont Truss, 4 projecteurs motorisés, décodeur DIP sans collision, pupitre 6 faders) totalement séparé du TP Régie Vidéo & Mixage Son 3D (mur Multiview PGM, caméra Focus/Iris, console audio -14/-10 dBFS, mélangeur ATEM CUT/TAKE).'
    ]
  },
  {
    version: 'v4.0 — Refonte Complète des 6 TPs en 3D Interactive',
    date: '13/11/2026',
    tag: 'HISTORIQUE',
    items: [
      'Architecture 3D commune pour tous les TPs (Workbench3DHost) : transition fluide de caméra vers la paillasse 3D éclairée en plein jour, manipulation Souris & Tactile (glisser-déposer, rotation, orbit/zoom), particules, chronomètre et enregistrement /20 + XP via /api/tp.',
      'TP 1 Soudure & Brasure 3D : fer à souder interactif à panne rougeoyante, chauffage des pastilles, dépôt de cônes d’étain métalliques 3D, panaches de fumée blanche/noire et test de mise sous tension 5V en cascade.',
      'TP 2 Oscilloscope & Électronique 3D : oscilloscope numérique DSO temps réel, GBF, carte en panne avec sonde rouge & pince crocodile, 3 molettes rotatives 3D (VOLTS/DIV, TIME/DIV, TRIGGER) et remplacement 3D des composants brûlés.',
      'TP 3 Montage PC Hardware 3D : bracelet ESD cliquable, levier socket LGA1700, CPU avec triangle doré, seringue de pâte thermique, ventirad, RAM Dual-Channel A2/B2, NVMe, GPU RTX, câbles ATX, bouton Power 3D, LEDs POST et BIOS UEFI animé.',
      'TP 4 Baie Réseau 19" & Switch VLAN 3D : jarretières flexibles Cat.6A/Fibre 3D entre bandeau et switch avec LEDs port, console laptop 3D interactive VLAN 10/20/30 + Trunk 802.1Q et paquets Ping animés sur les câbles.',
      'TP 5 Cybersécurité SOC 3D & TP 6 Studio Audiovisuel 3D : topologie réseau holographique sous attaque avec interrupteurs d’isolation 3D & dôme pare-feu, plus plateau fond vert avec projecteurs orientables, bagues caméra Focus/Iris et faders audio/DMX motorisés.'
    ]
  },
  {
    version: "v3.9 — Aimantation murale précise des tableaux dans l'éditeur",
    date: '13/11/2026',
    tag: 'HISTORIQUE',
    items: [
      'Alignement 3D corrigé pour tous les éléments muraux (tableau blanc, carte murale du laboratoire, classement 3D en direct, écran de monitoring SOC et baie réseau) : face arrière ancrée au point local + 0,015 m de décalage anti-scintillement.',
      'Aimantation murale intelligente dans l’éditeur 2D (/admin) : détection automatique du mur le plus proche dans un rayon de 0,8 m (hors portes) prioritaire sur la grille, avec maintien de Alt pour désactiver temporairement.',
      'Calcul automatique de la face du mur côté curseur (demi-épaisseur du mur) et de l’angle exact pour orienter le tableau vers l’intérieur de la pièce.',
      'Repère visuel en direct sur le canevas 2D (ligne d’accroche vert/cyan le long du mur, point d’ancrage et flèche de direction de lecture) et bouton rapide d’aimantation dans l’inspecteur.'
    ]
  },
  {
    version: 'v3.8 — Textures Réalistes PBR & Éclairage Plein Jour',
    date: '13/11/2026',
    tag: 'HISTORIQUE',
    items: [
      'Génération procédurale haute résolution de textures PBR (cartes couleur, rugosité et relief) pour les sols PVC satinés, murs enduits blanc cassé avec plinthes, bureaux en chêne clair, établis gris technique, portes, équipements et dalles acoustiques de plafond avec éclairage LED 4000K.',
      'Matériau vitré transparent réaliste (MeshPhysicalMaterial) appliqué sur l’ensemble des parois vitrées et baies des salles sans modifier aucune dimension ni collision.',
      'Passage à un éclairage plein jour de lycée technique : ciel bleu clair naturel (#cfe4f7), environnement HDR RoomEnvironment (PMREM), lumière hémisphérique ciel/sol et soleil directionnel chaud à ombres douces (PCFSoftShadowMap).',
      'Refonte visuelle claire "Light Glassmorphism" du Lobby, des Salles Multijoueur et du podium studio 3D (socle béton ciré et chêne clair) sans altérer les fonctionnalités existantes.'
    ]
  },
  {
    version: 'v3.7 — Interface Lobby ultra-épurée & ergonomique',
    date: '13/11/2026',
    tag: 'HISTORIQUE',
    items: [
      'Menu Principal repensé sur un seul écran plein cadre (100vh sans défilement vertical sur PC) avec zéro doublon.',
      'Barre supérieure sur une seule ligne : logo compact ATELIER CIEL 3D, 4 onglets (JOUER, SKINS, PASSE 👑, POSTS) et badge joueur avec boutons Plateforme et Paramètres.',
      'Panneau de lancement minimaliste à gauche (~360px) avec champ Pseudo, sélecteur de salle compact, bouton dédié 🌐 Salles ouvrant la modale multijoueur, bouton ⚡ JOUER et accès direct 🏆 Classement.',
      'Mise en valeur maximale de la scène 3D centrale sans cadre superflu, ne laissant flotter que le pseudo au-dessus du personnage.'
    ]
  },
  {
    version: 'v3.6 — Modèles 3D exclusifs & Vitrine Passe de Combat',
    date: '13/11/2026',
    tag: 'HISTORIQUE',
    items: [
      'Vitrine 3D interactive en direct intégrée au Passe de Combat Saison 1 : cliquez ou survolez chacun des 10 paliers pour voir le personnage s’équiper en temps réel sur un socle studio rotatif.',
      'Vrais modèles et accessoires 3D exclusifs modélisés dans Three.js : Casque VR Or 24 Carats, Visière Cybernétique avec antennes, Couronne Royale dorée à 6 gemmes, Jetpack RGB animé, ventilateurs dorsaux RTX 5090 Ti, Mini-Drone Switch Cisco orbital et Halo doré 3D.',
      'Matériaux spéciaux et auras de particules 3D : Or massif 24K réfléchissant, Chrome RGB, Armure Carbone néon, Cristal Diamant facetté, cascade Matrix, étincelles dorées et éclairs cyan.',
      'Refonte visuelle des 10 cartes de paliers avec badges de rareté colorés et brillants (RARE, ÉPIQUE, LÉGENDAIRE, MYTHIQUE et carte ULTIME dorée animée).'
    ]
  },
  {
    version: 'v3.5 — Améliorations Passe de Combat & Stabilité',
    date: '13/11/2026',
    tag: 'HISTORIQUE',
    items: [
      'Fluidité améliorée sur les transitions et les effets visuels du Passe de Combat Saison 1 sur PC et Mobile.',
      'Optimisations générales de stabilité réseau et de réactivité du Menu Principal.'
    ]
  },
  {
    version: 'v3.4 — Nouveau Menu Principal AAA & Passe de Combat Saison 1',
    date: '13/11/2026',
    tag: 'HISTORIQUE',
    items: [
      'Refonte intégrale du Menu Principal façon jeu AAA moderne (Valorant / Fortnite / Cyberpunk), 100 % responsive PC & Mobile : barre de navigation supérieure complète (JOUER, PASSE DE COMBAT 🔥, SKINS & CASIER, POSTS & RAPPORTS, NOTES DE MÀJ, PLATEFORME, PARAMÈTRES) et badge joueur dynamique (Niveau, barre d’XP et Moyenne /20).',
      'Podium 3D cybernétique interactif au centre/droite avec socle hexagonal lumineux, halo néon cyan/magenta animé, rotation fluide à inertie (souris & tactile) et affichage en direct du pseudo et du rang au-dessus du personnage.',
      'Panneau Lobby tout-en-un : saisie du pseudo, bouton animé « ⚡ JOUER — REJOINDRE LE PLATEAU U300 », sélection/création de salle multijoueur, liste des salles actives en direct et état du serveur en temps réel.',
      'Ajout du « Passe de Combat CIEL — Saison 1 » (10 paliers légendaires/mythiques jusqu’aux Perms Admin complètes à 10,00 €) avec sa modale parodique exclusive « T’est un pigeon » !'
    ]
  },
  {
    version: 'v3.3 — Zones de salles polygonales (Formes en L & U)',
    date: '13/11/2026',
    tag: 'HISTORIQUE',
    items: [
      'Extension du schéma de carte (mapSchema.js & server/store.js) pour prendre en charge des zones/salles polygonales arbitraires (points: [{ x, z }, ...] à 3 sommets ou plus), avec rétrocompatibilité totale des anciennes zones rectangulaires.',
      'Nouvel outil « Zone Polygonale (Forme libre / L) » dans l’éditeur /admin : tracé interactif point par point aimanté sur la grille avec aperçu élastique temps réel, fermeture par clic sur le 1er sommet surligné / double-clic / Entrée, annulation par Échap, édition de chaque sommet par poignées déplaçables et affichage du nom au centroïde.',
      'Rendu 3D des sols polygonaux via THREE.Shape / ShapeGeometry, tracé polygonal sur la mini-carte 2D en jeu et détection de salle du joueur au centimètre par Ray-Casting Point-in-Polygon (idéal pour les salles en L et couloirs en U).'
    ]
  },
  {
    version: 'v3.2 — Éditeur de map grand format (120m x 120m)',
    date: '13/11/2026',
    tag: 'HISTORIQUE',
    items: [
      'Agrandissement majeur des limites de l’éditeur de map (/admin) et du schéma map.json jusqu’à 200 m × 200 m (120 m × 120 m natif de -60 m à +60 m sur X et Z), avec suppression des bridages de longueur de murs, zones de salles et objets en dessous de 100 m.',
      'Grille 2D adaptative dans l’éditeur avec large plage de dézoom/zoom (de 1,5 px/m pour voir tout un étage d’un coup d’œil jusqu’à 140 px/m pour placer les petits meubles au centimètre), calque plan PNG/JPG ajusté sans coupure aux bords et caméra 3D adaptative.',
      'Adaptation automatique du moteur 3D (sol, plafond LED instancié haute performance, limites de déplacement du joueur, portée far de la caméra, brouillard et ombres directionnelles) ainsi que de la mini-carte 2D aux dimensions exactes de map.json.'
    ]
  },
  {
    version: 'v3.1 — Éditeur de Map Admin sur-mesure (Sandbox CIEL)',
    date: '12/11/2026',
    tag: 'HISTORIQUE',
    items: [
      'Nouvel onglet exclusif « 🗺 Éditeur de Map » dans la console /admin avec plan 2D interactif sur grille aimantée (1m, 0.5m, 0.25m ou libre) et aperçu 3D temps réel côte-à-côte (Three.js).',
      'Catalogue complet en 4 catégories : Architecture & Salles (murs pleins, cloisons vitrées, portes simples/doubles avec découpe automatique des passages, zones de salles, spawn, classement 3D, escalier), Bornes TP & PNJ (9 TP CIEL + Professeur à dialogue personnalisable), Mobilier scolaire et Matériel technique CIEL (Studio AV, Baies 19" LED, PC Gamer Cyber, Bancs électroniques, SOC).',
      'Outils avancés de construction : import d’un calque plan PNG/JPG sous la grille, sélection, déplacement, rotation libre/par crans, redimensionnement, duplication, Annuler/Rétablir (Ctrl+Z / Ctrl+Y), Export/Import JSON et preset Plateau U300.',
      'Persistance sécurisée dans server/data/map.json et publication en direct (« Sauvegarder & Publier en direct ») mettant à jour instantanément le monde 3D, les collisions et la mini-carte de tous les joueurs connectés.'
    ]
  },
  {
    version: 'v3.0 — Nouveau Monde : Plateau U300 Complet',
    date: '12/11/2026',
    tag: 'HISTORIQUE',
    items: [
      'Refonte architecturale complète du monde 3D à l’échelle réelle (26 m × 24,4 m) d’après le plan du Plateau U300 : Hall central U300 autour de la cage d’escalier vitrée, panneaux lumineux au-dessus de chaque porte, tableau de classement en direct face au spawn et plans d’orientation 3D.',
      'Toutes les salles spécialisées fidèlement modélisées : U301 (Brasure), U302 (Oscilloscopes & Électronique), U303 (Audiovisuel & Fond vert), U304 (Studio AV & Cabines acoustiques), U305 (SOC Cybersécurité), U306 & Sas U308 (Maintenance PC ESD), U307 (6 îlots Réseau & VM/VLAN), Chambre serveur (Baies 19" & Fibre) et locaux U309 / U311.',
      'Ajout de 3 nouveaux mini-jeux jouables sur le plateau : Brassage RJ45 / Fibre Optique (Chambre), Assemblage ESD & Diagnostic POST (U306) et Régie DMX / Audio +48V / Matrice SDI (U303 & U304).',
      'Indicateur de zone en temps réel dans le HUD, synchronisation de la salle actuelle sur les badges multijoueurs 3D et nouvelle mini-carte 2D interactive (touche M).'
    ]
  },
  {
    version: 'v2.8 — Nettoyage complet des aperçus de liens et métadonnées',
    date: '12/11/2026',
    tag: 'HISTORIQUE',
    items: [
      'Ajout et uniformisation complète des balises SEO et aperçus de liens (meta description, Open Graph og:title / og:description, Twitter Card) dans index.html et admin.html.',
      'Vérification globale de l’intégralité du dépôt et des assets compilés : aucune mention résiduelle de l’ancien intitulé.'
    ]
  },
  {
    version: 'v2.7 — Boutons HUD tactiles sur mobile & textes unifiés',
    date: '12/11/2026',
    tag: 'HISTORIQUE',
    items: [
      'Priorité tactile garantie sur les boutons en haut à droite du HUD (Chat, Paramètres, Menu principal) sur smartphone et tablette avec zone de toucher agrandie (min. 44px).',
      'La zone tactile de rotation de caméra n’intercepte plus les appuis sur les boutons du HUD.',
      'Unification complète de l’ensemble des textes du jeu, des mini-jeux et du serveur autour du personnage « Professeur CIEL ».'
    ]
  },
  {
    version: 'v2.6 — HUD épuré & Tableau de classement mural 3D',
    date: '12/11/2026',
    tag: 'HISTORIQUE',
    items: [
      'Épure complète du HUD en jeu : conservation des 3 boutons essentiels alignés en haut à droite (Chat, Paramètres, Menu principal) sur PC comme sur Mobile.',
      'Intégration d’un grand écran numérique 3D directement fixé sur le mur principal de la salle E204 affichant le classement en direct (« 🏆 CLASSEMENT EN DIRECT - BAC PRO CIEL »).',
      'Mise à jour temps réel du tableau 3D via CanvasTexture optimisée (rang, pseudo, moyenne /20, XP et pastille En ligne / Hors ligne) sans impact sur les FPS.'
    ]
  },
  {
    version: 'v2.5 — Posts & Rapports joueurs + Admin complet',
    tag: 'HISTORIQUE',
    date: '12/11/2026',
    items: [
      'Refonte complète de la fenêtre communautaire en « Posts & Rapports » (menu principal et HUD) avec uniquement 2 onglets : « Rapports des utilisateurs » (triés du plus récent au plus ancien) et « Créer un post ».',
      'Suppression complète de l’ancien onglet FAQ basique et validation obligatoire du nom/pseudo lors de l’envoi d’un post.',
      'Réorganisation complète de la console /admin en deux sections par onglets : Gestion des Utilisateurs (statut, temps cumulé en heures/minutes, dernière connexion, XP, notes de TP, moyenne /20, réinitialisation et suppression) et Gestion des Posts / Rapports avec modération.'
    ]
  },
  {
    version: 'v2.4 — Correctif démarrage & connexion serveur',
    tag: 'HISTORIQUE',
    date: '12/11/2026',
    items: [
      'Correction critique au démarrage : résolution d’une référence circulaire à l’initialisation du HUD qui bloquait l’écran d’accueil.',
      'Rétablissement immédiat de l’aperçu 3D en direct du personnage sur le menu principal avec protection WebGL.',
      'Ajout d’un timeout strict de 3 secondes (AbortController) sur /api/health et /api/rooms pour ne plus jamais bloquer sur « Connexion au serveur CIEL… ».',
      'Isolation des modales secondaires (Plateforme, FAQ, Changelog) dans des blocs protégés : le lancement d’une partie reste toujours possible.'
    ]
  },
  {
    version: 'v2.3 — Sélecteur PC/Mobile, FAQ & Boîte à idées',
    tag: 'HISTORIQUE',
    date: '12/11/2026',
    items: [
      'Écran de choix de plateforme (Mode PC ou Mode Mobile / Tablette) dès l’ouverture et réouvrable à tout moment.',
      'Nouvel onglet communautaire « FAQ & Idées » avec tutoriel complet et mur persistant de suggestions des joueurs.',
      'Contrôles tactiles multi-touch complets (joystick analogique gauche, caméra au doigt à droite, boutons d’action et UI 100 % responsive).',
      'Console d’administration sécurisée sur /admin (suivi du temps de jeu, réinitialisation, suppression et modération des idées).'
    ]
  },
  {
    version: 'v2.0 — Patch Multijoueur & Classement',
    tag: 'HISTORIQUE',
    date: 'Novembre 2026',
    items: [
      'Mode multijoueur temps réel WebSocket (salles partagées, déplacements 3D fluides, emotes/chat).',
      'Synchronisation live des skins personnalisés (tenues, couleurs, accessoires) entre tous les joueurs.',
      'Nouveau tableau de classement (Leaderboard touche Tab) avec moyennes de TP (/20) et XP.',
      'Affichage de l’état de la connexion serveur en direct, reconnexion auto et support multi-onglet.'
    ]
  },
  {
    version: 'v1.0 — Lancement Atelier CIEL 3D',
    tag: 'INITIAL',
    date: 'Novembre 2026',
    items: [
      'Atelier 3D BAC PRO CIEL en salle E204 avec Professeur CIEL (boîte de dialogue interactive).',
      '5 mini-jeux métiers : Oscilloscope, Brasure PCB, Électronique, Antivirus et VM/VLAN.',
      'Vue 1ère et 3ème personne (touche V), saut (Espace) et réglages FOV.'
    ]
  }
];

export class ChangelogModal {
  constructor() {
    this.modal = document.getElementById('changelog-modal');
    this.versionSubtitle = document.getElementById('changelog-build-meta');
    this.listEl = document.getElementById('changelog-list');
    this.closeBtn = document.getElementById('changelog-close');
    this.doneBtn = document.getElementById('changelog-done-btn');
    this.onCloseCallback = null;

    this._renderBadges();
    this._renderReleases();
    this._bindEvents();
  }

  _renderBadges() {
    const buildLabel = formatBuildTime();
    const html = `
      <span class="vb-main">🏷️ ${APP_VERSION}</span>
      <span class="vb-meta">Build ${buildLabel} • Notes de MÀJ</span>
    `;
    ['menu-version-badge', 'hud-version-badge'].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.innerHTML = html;
    });
    if (this.versionSubtitle) {
      this.versionSubtitle.textContent = `${APP_VERSION} • Compilé le ${buildLabel}`;
    }
  }

  _renderReleases() {
    if (!this.listEl) return;
    this.listEl.innerHTML = CHANGELOG_RELEASES.map(
      (rel, idx) => `
      <section class="changelog-release ${idx === 0 ? 'latest' : ''}">
        <div class="changelog-rel-head">
          <h3>${rel.version}</h3>
          <span class="changelog-tag ${idx === 0 ? 'latest' : ''}">${rel.tag} • ${rel.date}</span>
        </div>
        <ul class="changelog-items">
          ${rel.items
            .map((item) => {
              if (item && typeof item === 'object') {
                const badge = item.badge ? `<span class="changelog-item-badge">[${item.badge}]</span> ` : '';
                const title = item.title ? `<strong>${item.title}</strong>` : '';
                const desc = item.desc ? ` — ${item.desc}` : '';
                return `<li>${badge}${title}${desc}</li>`;
              }
              return `<li>${item}</li>`;
            })
            .join('')}
        </ul>
      </section>`
    ).join('');
  }

  _bindEvents() {
    this.closeBtn?.addEventListener('click', () => this.close());
    this.doneBtn?.addEventListener('click', () => this.close());
    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });
  }

  isOpen() {
    return Boolean(this.modal && !this.modal.classList.contains('hidden'));
  }

  open(onClose = null) {
    this.onCloseCallback = onClose;
    this.modal?.classList.remove('hidden');
  }

  close() {
    if (!this.isOpen()) return false;
    this.modal?.classList.add('hidden');
    const cb = this.onCloseCallback;
    this.onCloseCallback = null;
    cb?.();
    return true;
  }
}
