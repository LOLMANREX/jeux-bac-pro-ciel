# Rapport Technique — Mise à jour v4.21 : Correctifs Salle de Colle 3D (Caméra Libre Assise, Zéro ATH & Cinématique d'Intro Sans Traversée de Murs)

## 1. Diagnostic

Trois défauts affectaient l'immersion et la lisibilité du mode **Survie Horreur — Salle d'Heure de Colle 3D** sur PC et en VR autonome (Meta Quest / WebXR) :

1. **Caméra bloquée ou inconfortable en position assise (Salle de Colle 3D)** :
   - Sur PC, la rotation libre de la tête autour de la chaise (souris / PointerLock, cliquer-glisser gauche et droit, touches fléchées, glisser tactile) et le raycast fluide depuis le réticule ou le curseur libre devaient cohabiter sans jamais autoriser de déplacement au sol (`ZQSD` / `WASD` / `Espace`), tout en évitant que les flèches `ArrowLeft` / `ArrowRight` ne détournent la rotation de tête vers le changement de caméra POV.
   - En VR (WebXR `local-floor` et Simulateur VR), la position assise du rig devait ancrer le regard exactement à hauteur assise devant le bureau face au tableau (`1,28 m`), conserver le suivi libre 6DoF de la tête et le *snap-turn* au joystick droit tout en neutralisant le déplacement au joystick gauche.

2. **Persistance de l'ATH (HUD) pendant la Salle d'Heure de Colle** :
   - Lors de l'entrée en état `detention`, des éléments d'interface superflus (barre supérieure `#hud`, minimap, notes, XP, classement, boutons audio/micro, contrôles tactiles, modale HTML 2D de tableau de variation, barre Survie `#survival-hud-bar`, panneau `#survival-detention-3d-hud`, panneau debug, montre connectée VR `VRHudPanel` et toasts) restaient susceptibles d'apparaître à l'écran au lieu de laisser l'élève face à uniquement la salle 3D, sa feuille interactive posée sur le bureau et l'écran POV des coéquipiers au tableau.

3. **Traversée de murs durant la cinématique d'introduction du mode Survie Horreur** :
   - Le point cible `introAi` était précédemment positionné en `{ x: 1.8, z: -1.2 }`, à l'intérieur même de la cage d'escalier centrale (`ESCALIER`, `x ∈ [-2.4, 1.81]`, `z ∈ [-1.55, 2.11]`), tandis que le point d'apparition `PLATEAU_SPAWN` se trouvait en `(-3.95, 0.65)`. La ligne de vue et le travelling caméra coupaient ainsi directement à travers les cloisons et le bloc d'escalier (`stair_block`), sans contrôle de collision sur les positions interpolées ni sur le recul de caméra.

---

## 2. Modifications fichier par fichier

- `src/world/PlayerController.js` :
  - Ajout de l'état assis (`seated`, `seatedPose`) et de la méthode `setSeated(seated, pose)`.
  - Déblocage de la rotation caméra libre à 360° en lacet et `[-1.15, 1.15]` rad en tangage en position assise via PointerLock, cliquer-glisser souris (bouton gauche et bouton droit), touches fléchées dans `update(dt)` et glisser tactile.
  - Verrouillage strict de toute translation au sol (`ZQSD` / `WASD` / `Espace`) tant que `seated` est actif, et positionnement première personne assis dans `_applyCamera()`.

- `src/world/SurvivalArena3D.js` :
  - Mise à jour de `getDetentionRoomConfig()` (`spawn` assis en `{ x: detCenter.x, z: detCenter.z + 1.22 }`, `pcEye` et `vrSeatEyeY` à `1.28 m`, `lookAt` orienté vers le bureau et le tableau `{ x: detCenter.x, y: 1.18, z: detCenter.z - 1.5 }`).
  - Refonte de `computeSurvivalIntroShot` avec trajectoire continue sur le segment dégagé `[spawn -> aiPos]` et garde-fou anti-murs par frame `clampIntroCameraPos` s'appuyant sur les colliders dynamiques et la ligne de vue de la carte.

- `src/world/SurvivalEngine.js` :
  - Exportation de `hasFullMapLineOfSight` et `resolveSurvivalIntroPlacement` exploitant `getDynamicMapColliders` et `buildNavGrid` afin de placer automatiquement le **Professeur CIEL** (`introAi`) et la caméra (`introSpawn`) dans une même zone dégagée et connectée avec ligne de vue à 100 % libre (ex. allée du hall ouest U300 en `(-4.95, -2.35)` sur la carte par défaut, avec repli dynamique sur toute carte personnalisée).
  - Intégration de `introPlacement` (`introAi`, `introSpawn`) dans `SurvivalMatchController` (`setMapData`, `startMatch`, `getPublicSnapshot`).

- `src/vr/VRHudPanel.js` :
  - Ajout de `hudSuppressed`, `setHudSuppressed(suppressed)` et `isHudSuppressed()` sur `createWristHudPanel` pour masquer complètement la montre connectée VR en salle de colle et la restaurer ensuite.

- `src/vr/VRManager.js` :
  - Ajout de `seatedMode`, `seatedPose`, `detentionHudHidden`, `setSeatedMode(active, pose)` et `setDetentionHudHidden(hidden)`.
  - Ajustement de l'ancrage dans `_stabilizeFloor()` pour placer exactement la vue à hauteur assise (`1.28 m`) sous WebXR `local-floor` comme en Simulateur VR tout en conservant le suivi 6DoF libre de la tête.
  - Neutralisation de la locomotion joystick gauche / `WASD` dans `_updateLocomotion()` en mode assis tout en conservant le *snap-turn* au joystick droit (et rotation fléchée en simulateur).
  - Masquage du panneau de debug VR pendant `detentionHudHidden` et sécurisation anti-murs/ligne de vue dans `applySurvivalIntroPose`.

- `src/ui/HudManager.js` :
  - Ajout de `setDetentionHudHidden(hidden, { restoreHud })` pilotant la classe `body.survival-detention-active`, masquant `#hud`, le panneau debug, `#survival-hud-bar`, `#survival-detention-3d-hud`, les modales HTML 2D, le chat, les toasts et l'invite d'interaction dès l'entrée en `detention`, puis restaurant proprement l'ATH normal au retour au lobby ou au hall.
  - Ajout de gardes dans `show()`, `openSettingsModal`, `openSkinModal`, `openLeaderboard`, `toggleChat`, `setPrivateDebugMode`, `updateSurvivalHud`, `showDetentionModal`, `showDetention3dHud` et `toast`.

- `src/styles/main.css` :
  - Ajout des règles CSS `body.survival-detention-active` (`display: none !important; pointer-events: none !important;`) garantissant l'absence totale d'ATH à l'écran durant la colle tout en préservant `#survival-end-overlay` en fin de partie.

- `src/main.js` :
  - Synchronisation de `setSeated`, `setSeatedMode` et `setDetentionHudHidden` dans `onEnterVr`, `onExitVr`, `teleportWithWorldMode`, `enterDetentionClassroom3D`, `startSurvivalMatchClient`, `endSurvivalMatchClient`, `closeSurvivalEndCinematic`, `resetSurvivalClientFull`, `enterSurvivalLobby`, `updateSurvivalLoop`, `renderDetentionLivePov` et `applyMapData`.
  - Prise en charge fluide dans `pickDetentionSurfaceAt` et `updateDetentionSurfaceHover` du raycast PointerLock `(0, 0)`, du curseur souris libre et du glisser/taper tactile sur la feuille de maths et les boutons POV.
  - Suppression du détournement de `ArrowLeft` / `ArrowRight` (cyclage POV clavier déplacé sur `BracketLeft` / `BracketRight`) et blocage de `Tab` en salle de colle.

- `vite.config.js` et `src/ui/ChangelogModal.js` :
  - Mise à jour de `__APP_VERSION__` (`vite.config.js`) vers `'v4.21 - Salle de Colle Caméra Libre, Zéro ATH & Cinématique Anti-Murs'` et de `APP_VERSION` (`ChangelogModal.js`) vers `'v4.21 — Correctifs Salle de Colle 3D : Caméra Libre Assise, Zéro ATH & Cinématique d’Intro Sans Traversée de Murs'`.
  - Ajout de l'entrée `v4.21` (`tag: 'DERNIÈRE MÀJ'`) en tête de `CHANGELOG_RELEASES` et passage de `v4.20` au tag `'HISTORIQUE'`.

- `tests/celebration-debug.test.js`, `tests/survival-horror.test.js` et `tests/vr.test.js` :
  - Actualisation de la vérification de version `v4.21` dans `tests/celebration-debug.test.js`.
  - Ajout des tests vérifiant l'absence totale de traversée murale en cinématique d'intro (Plateau U300 et carte cloisonnée), la caméra libre assise sur PC (souris, PointerLock, flèches, verrouillage `ZQSD`, raycast sur feuille et zéro ATH + restauration), ainsi que la parité VR WebXR/Simulateur (hauteur assise `1,28 m`, 6DoF libre, *snap-turn* joystick droit, joystick gauche bloqué, montre/debug masqués et intro sans murs).

---

## 3. Résultats tests/build

Vérifications exécutées après toutes les éditions finales :

1. **`node --test --test-force-exit tests/*.test.js`** :
   - **78 / 78 tests réussis**, 0 échec, 0 annulé, 0 ignoré (`13168.314022 ms` / `13,17 s`).
2. **`npm test` (`node --test tests/*.test.js`, sans `--test-force-exit`)** :
   - **78 / 78 tests réussis**, 0 échec, arrêt naturel propre confirmant l'absence de socket ou timer ouvert (`15780.273393 ms` / `15,78 s`).
3. **`npm run build` (`vite build` v6.4.6)** :
   - Build de production réussi sans avertissement ni erreur sur **54 modules** en **15.13s** :
     - `dist/admin.html` : `15.26 kB` (`gzip: 3.75 kB`)
     - `dist/index.html` : `67.84 kB` (`gzip: 14.13 kB`)
     - `dist/assets/admin-BzkkMmhh.css` : `20.00 kB` (`gzip: 4.69 kB`)
     - `dist/assets/main-B7Nj6vnY.css` : `108.78 kB` (`gzip: 21.97 kB`)
     - `dist/assets/admin-DevECeYr.js` : `94.42 kB` (`gzip: 25.53 kB`)
     - `dist/assets/LabBuilder-BqzJdtMn.js` : `177.26 kB` (`gzip: 53.22 kB`)
     - `dist/assets/three-_5pHxIMn.js` : `523.73 kB` (`gzip: 132.75 kB`)
     - `dist/assets/main-CRM7A6I-.js` : `770.91 kB` (`gzip: 235.60 kB`)
4. **Contrôles de conformité dépôt** :
   - Aucune modification sur `server/data/map.json` ni `server/data/db.json`.
   - `0` commentaire détecté sur les `1589` lignes ajoutées dans `src/`, `tests/` et `vite.config.js`.
   - `0` occurrence interdite du nom proscrit ; usage exclusif de `Professeur CIEL`.

---

## 4. Guide de vérification

1. **Cinématique d'introduction Survie Horreur (PC & VR)** :
   - Rejoindre le plateau U300, franchir la porte Survie Horreur et lancer une partie.
   - Vérifier que le **Professeur CIEL** apparaît dans une allée dégagée du plateau avec une vue parfaitement libre (sans aucune paroi ni cloison coupant la caméra ou l'avatar durant toute l'animation d'approche et de travelling).
2. **Salle d'Heure de Colle 3D sur PC & Mobile** :
   - Se laisser capturer par le Professeur CIEL afin d'entrer en Salle d'Heure de Colle 3D.
   - Vérifier qu'**aucun élément d'ATH** (ni barre supérieure, ni minimap, ni boutons audio/micro, ni notes, ni barre survie, ni modale 2D) n'apparaît à l'écran : seuls la classe 3D, la feuille de maths sur le bureau et le moniteur POV des coéquipiers au tableau sont visibles.
   - Tourner librement la caméra avec la souris (PointerLock actif ou cliquer-glisser) et avec les flèches du clavier pour passer du tableau à la feuille du bureau, tout en vérifiant que `ZQSD` / `WASD` / `Espace` ne déplacent pas le personnage hors de la chaise.
   - Cliquer sur les réponses de la feuille posée sur le bureau pour valider les tableaux de variation, et tester `[` / `]` ou les boutons du tableau pour basculer entre les flux POV des coéquipiers.
   - Terminer la partie (victoire des coéquipiers ou défaite) et vérifier la restauration immédiate de l'ATH normal au retour au lobby.
3. **Salle d'Heure de Colle 3D en VR (Meta Quest Browser / WebXR)** :
   - Entrer en session VR sur le mode Survie Horreur puis se faire capturer vers la salle de colle.
   - Vérifier que le point de vue est positionné à hauteur assise (`1,28 m`) devant le bureau face au tableau, que la montre connectée et le panneau debug VR sont masqués, que le suivi de tête 6DoF et le *snap-turn* au joystick droit fonctionnent librement, et que le joystick gauche ne déplace pas le joueur.
   - Pointer ou toucher directement les cellules de la feuille sur le bureau pour répondre et revenir en lobby en fin de partie en vérifiant la réapparition de la montre VR.
