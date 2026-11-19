# Rapport Technique — v4.28 : Baies de Brassage Perforées Immersives & Mini-Jeu Arène de Combat CIEL (Modes Fusils & Mêlée)

## 1. Immersion Totale à l’Intérieur des Baies de Brassage (`hiding_rack`)
- **Modélisation 3D Intérieure & Porte Perforée Transparente (`src/world/LabBuilder.js`)** :
  - Génération de `makePerforatedRackDoorTexture()` avec véritables fentes d’aération et perforations carrées transparentes (`destination-out`) combinée à un matériau `transparent: true`, `alphaTest: 0.45`, `side: THREE.DoubleSide`, `castShadow: false` et `userData.isPerforatedDoor = true`.
  - Intérieur 3D complet de chaque baie : parois métalliques sombres, rails de rack, fond et 8 LEDs internes (`interiorLeds`) clignotant discrètement via `lab.update()`.
- **Positionnement Caméra, Rotation Limitée & Visibilité (`src/world/SurvivalEngine.js`, `src/world/PlayerController.js`, `src/main.js`)** :
  - Ajout de `computeRackInteriorPosition(rack)` (`y = 1.52`, regard orienté vers l’extérieur à travers la porte perforée).
  - Ajout de `PlayerController.setHidingInRack(active, pose)` et `_clampHidingAngles()` : verrouillage des déplacements ZQSD/joystick, masquage de l’avatar local dans la baie, et rotation limitée de la tête/caméra à **±45° horizontal** (`±Math.PI / 4`) et **±20° vertical** (souris, flèches directionnelles et glisser tactile).
  - Remplacement du voile noir opaque par un léger vignettage périphérique (`radial-gradient` avec `pointer-events: none` dans `src/styles/main.css` et classe `.threat-near` à l’approche du Professeur CIEL) tout en conservant `style.display` et `opacity` dans `HudManager.js`.
- **Audio & WebXR (`src/core/audio.js`, `src/vr/VRManager.js`, `src/vr/VRHudPanel.js`)** :
  - Ajout de `startRackServerHum()` / `stopRackServerHum()` pour l’ambiance ventilation serveur + battement de cœur à l’approche du Professeur CIEL.
  - En VR (`VRManager.enterHidingRackVr`, `exitHidingRackVr`), verrouillage de la locomotion, rotation simulée bornée ±45°/±20°, libre mouvement naturel 6DoF en casque WebXR, et panneau `survival_hidden` sans cadre opaque (`frame.visible = false`, tiers supérieur transparent).
- **Sortie Anti-Blocage v4.23 Strictement Préservée** :
  - `computeRackExitPosition` conserve le repositionnement à `1.15 m` devant la porte, sans collision, sans `NaN` ni écran noir sur PC, Mobile et VR.

## 2. Porte 3D Dédiée, Lobby Cyber & Arène de Combat CIEL (`src/world/CombatArena3D.js`, `src/world/LabBuilder.js`, `src/world/mapSchema.js`)
- **Porte 3D Dédiée (`combat_door`)** :
  - Ajout dans `MAP_ITEM_CATALOG`, `createDefaultMap()` (`obj-combat-door` à `x: -1.3, z: -1.85`) et `LabBuilder.buildSpecialModeDoor()` avec enseigne lumineuse **"⚔️ ARÈNE DE COMBAT CIEL"** et repli automatique si absente de la carte, sans aucune modification de `server/data/map.json`, `server/data/db.json`, `server/data/accounts.json` ni `src/world/plateauLayout.js`.
- **Salle d’Attente 3D & Arène Data Center Optimisée (`src/world/CombatArena3D.js`)** :
  - Salle d’attente cyber (`x: 56, z: 24`) équipée de 3 consoles interactives (`combat_lobby_mode`, `combat_lobby_ready`, `combat_lobby_exit`) et d’un écran dynamique d’état.
  - Arène Data Center (`x: 56, z: 68`, limites `40..72` × `54..82`) avec caisses de couverture, baies tactiques, néons, orbes de soin (`+35 PV`), tableau des scores live en 3D et avatars de bots avec barre de vie orientable et arme 3D.
  - Application systématique de `node.matrixAutoUpdate = false` sur toute la géométrie statique de l’arène et du lobby.

## 3. Arsenal Bac Pro CIEL, Bots IA, Zéro-Allocation & Économie (`src/world/CombatWeapons.js`, `src/world/CombatEngine.js`, `server/wsHub.js`, `server/store.js`, `server/index.js`, `src/world/ShopCatalog.js`)
- **Mode Fusils (4 Armes 3D à distance)** :
  1. `fiber_rifle` — Fusil d’Assaut Fibre Optique (cadence rapide, faisceaux cyan, chargeur 24).
  2. `udp_shotgun` — Fusil à Pompe Paquets UDP Broadcast (salve de 6 paquets IP en cône).
  3. `ping_sniper` — Sniper Ping 0ms Oscillo-Railgun (haute puissance longue portée avec traînée d’onde sinusoïdale et bonus critique tête).
  4. `plasma_solder_pistol` — Pistolet à Souder Plasma (léger, précis, recharge rapide).
- **Mode Mêlée (4 Armes 3D de corps-à-corps)** :
  1. `solder_iron_blade` — Fer à Souder Incandescent (frappes rapides avec étincelles).
  2. `rj45_crimper_heavy` — Pince à Sertir RJ45 Géante (coup lourd avec repoussement physique / knockback).
  3. `ddr5_katana` — Katana Barrette RAM DDR5 (frappe fluide avec dash vers l’avant).
  4. `switch24_hammer` — Marteau Switch 24 Ports (coup de zone AoE large portée).
- **Moteur Autoritaire & Bots IA (`CombatMatchController`)** :
  - Jouable en PvP multijoueur comme en **Solo complété par au moins 3 bots IA autonomes** (patrouille, prise de couvert/strafe, soin sur packs, visée et tir ou charge en mêlée).
  - Raycasts avec occlusion AABB sur les obstacles, hitbox cylindrique avec bonus tête, munitions et rechargement, élimination / killfeed / série / respawn automatique (3 s + protection 1,4 s), victoire à 10 éliminations ou fin du chrono (`2 min 30`).
- **Pool VFX Sans Allocation Mémoire (`createCombatVfxPool`)** :
  - Pré-allocation de 36 faisceaux, 4 traînées sinusoïdales, 48 étincelles et 8 arcs de mêlée + vecteurs scratch réutilisés à chaque frame (client et VR).
- **CIEL Coins Sécurisés (`ShopCatalog.js`, `server/store.js`, `server/index.js`, `server/wsHub.js`)** :
  - Calcul `computeCombatCoinReward` : `120 CC` pour une victoire, `40 CC` de participation + `+10 CC` par élimination (plafonné à `240 CC` par manche).
  - Persistance atomique côté serveur via `wsHub` en fin de manche et endpoint `POST /api/economy/combat` avec limitation anti-triche et déduplication par `matchId`.
- **Contrôles Multi-Plateformes (`index.html`, `src/styles/main.css`, `src/ui/HudManager.js`, `src/ui/TouchControls.js`, `src/vr/VRManager.js`, `src/vr/VRHudPanel.js`, `src/world/RemotePlayers.js`, `src/main.js`)** :
  - **PC** : clic gauche tirer/frapper, `R` recharger, `1–4` changer d’arme, `Tab` tableau des scores, modèle d’arme FPS en 1ère personne + recul/swing.
  - **Mobile / Tablette** : pavé tactile dédié `#touch-combat-pad` (`#touch-btn-fire`, `#touch-btn-reload`, `#touch-btn-weapon-next`).
  - **VR WebXR** : arme tenue dans la main droite dominante, gâchette pour tirer/frapper, **détection réelle de vitesse du coup de bras/poignet** (`handSpeed >= 1.75 m/s` en mêlée -> `isVrSwing: true`), rechargement bouton `A`, changement d’arme Grip / `X`, panneaux spatiaux `combat_lobby` / `combat_end` et HUD temps réel `combatStatus` sur la montre VR.

## 4. Versionning, Audits & Validation Finale
- **Versionning (`vite.config.js`, `src/ui/ChangelogModal.js`)** : passage à `v4.28` et ajout de l’entrée datée `19/11/2026` tout en haut de `CHANGELOG_RELEASES` (`v4.27` passée au tag `'HISTORIQUE'`).
- **Tests ajoutés & mis à jour** :
  - `tests/combat-arena.test.js` : porte `combat_door`, 8 armes et VFX pool, `CombatArena3D` (`matrixAutoUpdate = false`), `CombatMatchController` (bots IA, occlusion, shotgun 6 paquets, mêlée knockback/dash, respawn, pickups, récompenses), serveur HTTP/WS live + `/api/economy/combat`, DOM/HUD/`TouchControls`/Audio.
  - `tests/survival-horror.test.js` : intérieur 3D perforé, rotation ±45°/±20°, vignette transparente, audio ventilation, sortie dégagée à `1.15 m`.
  - `tests/vr.test.js` : immersion baie perforée VR sans cadre opaque et Arène de Combat VR (lobby spatial, gâchette, swing réel du bras, montre HUD, fin de manche).
  - `tests/celebration-debug.test.js` & `tests/mobile-tp.test.js` : assertions de version mises à jour pour `v4.28`.
- **Contrôles des Règles Strictes** :
  - Fichiers protégés (`server/data/accounts.json`, `src/world/plateauLayout.js`, absence de `server/data/map.json` et `server/data/db.json`) : **100 % intacts**.
  - Scan syntaxe `node --check` sur 27 fichiers `.js` modifiés/créés : **OK**.
  - Audit zéro commentaire (`//`, `/* */`, `<!-- -->`) sur les 29 fichiers modifiés/créés : **0 commentaire trouvé**.
  - Audit lore CIEL sur l’ensemble du dépôt : **0 occurrence interdite**.
- **Suites de tests & Build** :
  - `node --test --test-force-exit tests/*.test.js` : **120 / 120 réussis** (`0` échec, `0` ignoré).
  - `npm test` (sans `--test-force-exit`, sortie propre sans timer ni socket ouvert) : **120 / 120 réussis** en `22.75 s`.
  - `npm run build` : **64 modules transformés**, build terminé sans erreur en `13.90 s` (`dist/index.html`, `dist/admin.html`, `dist/assets/main-DcQ_un65.js`).
