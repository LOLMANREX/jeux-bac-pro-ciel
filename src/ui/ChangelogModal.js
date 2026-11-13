export const APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined'
    ? __APP_VERSION__
    : 'v4.6 - Mode VR WebXR, Mains 3D Articulées & Sync Multijoueur';

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
    version: 'v4.6 — Mode VR WebXR, Mains 3D Articulées & Sync Multijoueur',
    date: '13/11/2026',
    tag: 'DERNIÈRE MÀJ',
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
          ${rel.items.map((item) => `<li>${item}</li>`).join('')}
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
