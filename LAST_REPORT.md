# Rapport Technique — Mise à jour v4.20 : Instance Isolée Survie Horreur, Cinématique d'Intro & Salle de Colle 3D avec Feuille Interactive et Caméra POV Coéquipiers Live

## 1. Diagnostic

En v4.19, le mode Survie Horreur fonctionnait directement à l'intérieur de la salle publique `plateau-u300`, imposait un minimum de 2 joueurs pour lancer une partie, démarrait la traque sans phase d'introduction dédiée, et basculait les joueurs capturés dans une modale 2D bloquante affichant uniquement un plan radar simplifié.

Quatre limites principales ont été identifiées et corrigées dans cette mise à jour v4.20 :

1. **Absence d'isolation d'instance et impossibilité de lancer en solo** :
   - `server/wsHub.js` gérait la partie Survie dans le salon courant (`plateau-u300`), rendant visibles et audibles les joueurs hors mini-jeu.
   - `SURVIVAL_MIN_PLAYERS` était fixé à `2` dans `src/world/SurvivalEngine.js` et `server/wsHub.js`, bloquant le lancement et le test à 1 joueur.
   - Aucune bascule automatique de salle (`room_switched` -> `survival-game-...` puis retour vers `plateau-u300`) n'isolait la session Survie ni ne filtrait les pairs sur le client (`src/world/RemotePlayers.js`, `src/main.js`).

2. **Démarrage abrupt sans mise en scène horrifique PC / VR** :
   - Aucune cinématique d'introduction horrifique ne précédait la reprise de contrôle au point d'apparition (coupure brutale d'éclairage, grésillements électriques et alarme, cadrage progressif sur le Professeur CIEL, briefing Survie).
   - En WebXR, la caméra d'un casque ne pouvant pas être déplacée arbitrairement avec un travelling classique sans risque de nausée, un cadrage spatial dédié et un panneau 3D `survival_intro` étaient nécessaires.

3. **Salle d'heure de colle limitée à une fenêtre 2D et sans vraie vue subjective** :
   - La détention utilisait `#survival-detention-modal` en 2D par-dessus la scène 3D au lieu de placer physiquement l'élève à un bureau 3D face à un tableau.
   - Les exercices de tableaux de variation (`src/minigames/VariationTableGame.js`) n'étaient pas rendus sur une feuille 3D interactive posée sur le bureau ni interactifs au pointeur/doigt en VR.
   - L'écran de surveillance de la salle de colle n'affichait qu'une minimap 2D de points au lieu d'un vrai flux temps réel à la première personne (POV) rendu par `THREE.WebGLRenderTarget` depuis la position et la rotation du coéquipier survivant (avec bascule Caméra Précédente / Suivante).

4. **Compatibilité WebXR du rendu hors-écran (`WebGLRenderTarget`)** :
   - Sous WebXR (`renderer.xr.enabled = true && isPresenting`), Three.js force la caméra XR lors d'un appel `renderer.render()`. Sans désactivation temporaire de `renderer.xr.enabled` dans un `renderToTarget` sécurisé (`src/world/SceneManager.js`), le rendu POV sur la texture du tableau noir échouait ou cassait le framebuffer VR.

---

## 2. Modifications fichier par fichier

### Serveur & Synchronisation Temps Réel
- **`server/wsHub.js`** :
  - Export de `SURVIVAL_ROOM_PREFIX = 'survival-game-'` et `isSurvivalRoom(rawRoom)`.
  - Ajout de `pendingSurvivalByOrigin`, `resolveOrCreatePendingSurvivalRoom(originRoom)`, `moveClientToRoom(ws, state, targetRoom)` (diffusion `player_left` dans l'ancienne salle, `room_switched` au client déplacé avec `originRoom`, `peers`, `roomRoster`, `chatHistory` et `survivalState`, puis `player_joined` dans la nouvelle salle), `returnClientFromSurvival(ws, state)` et `cleanupEmptySurvivalRoom(roomId)`.
  - Passage du défaut `minPlayers` de `getSurvivalController()` à `1`, `graceMs` à `6500` ms et `introDurationMs` à `5600` ms.
  - Mise à jour de `survival_join`, `survival_leave`, `survival_ready`, ajout du message `survival_return`, retour automatique de tous les clients vers `originRoom || 'plateau-u300'` dans `finishSurvivalMatchInRoom()` après le délai de fin de partie (15 000 ms par défaut), nettoyage à la déconnexion (`ws.on('close')`), et exclusion des salles `survival-game-*` dans `getRoomsSummary()`.
- **`src/core/network.js`** :
  - Mise à jour de `room_switched` pour synchroniser `this.pendingJoin.room = msg.room` lors des bascules automatiques vers/depuis l'instance Survie.
  - Ajout de `sendSurvivalReturn()` émettant `{ type: 'survival_return' }`.

### Logique Survie, Isolation Client & Cinématique d'Introduction
- **`src/world/SurvivalEngine.js`** :
  - Passage de `SURVIVAL_MIN_PLAYERS` de `2` à `1`.
  - Ajout de `introDurationMs` (5600 ms par défaut, configurable via options) dans `SurvivalMatchController` avec exposition de `introDurationMs` et `introActive` dans `getPublicSnapshot(nowMs)`.
- **`src/world/RemotePlayers.js`** :
  - Ajout de `setInstanceFilter(allowedIds)` (filtre et purge immédiatement les pairs absents de l'instance Survie dans `upsertPeer`/`movePeer`).
  - Ajout de `getPeerPoseForPov(id)` (expose position, yaw, `vrData`, activité et `zoneLabel`) et `setPeerPovHidden(id, hidden)` (masque proprement l'avatar observé pendant le rendu de sa propre caméra POV sans altérer son état normal).
- **`src/core/audio.js`** :
  - Ajout de `playElectricCrackle(delaySec, duration, volume)` (bruit blanc filtré passe-bande pour grésillements électriques).
  - Ajout de `playSurvivalIntroAlarm()` (chute d'alimentation, salves de grésillements électriques, impulsions d'alarme bitonale et impact sub-grave).
- **`src/world/SceneManager.js`** :
  - Ajout de `beforeRenderCallbacks`, `addBeforeRender(fn)`, `removeBeforeRender(fn)` exécutés juste avant le rendu principal dans `start()`.
  - Ajout de `renderToTarget(renderTarget, virtualCamera, opts)` gérant la sauvegarde/restauration de `renderer.getRenderTarget()`, `renderer.xr.enabled = false`, `renderer.shadowMap.autoUpdate = false`, `hiddenObjects`, l'éclairage (`ambientBoost`, `flashlightPose`) et `fogFar` dans un bloc `try ... finally`.
  - Amélioration de `setHorrorAtmosphere(active, threat, flicker, fogFarOverride)` pour l'éclairage rouge/tamisé progressif.

### Salle de Colle 3D, Feuille Interactive & Caméra POV Live
- **`src/minigames/VariationTableGame.js`** :
  - Ajout de `getVariationSheetHitBoxes(width, height)` et `drawVariationWorksheetCanvas(ctx, width, height, detentionSnapshot, hoveredId)` dessinant une feuille A4 haute résolution sur le pupitre 3D avec énoncé, tableau de variation vectoriel et 4 boutons de choix (`sheet_opt_0`..`sheet_opt_3`) + état de survol.
- **`src/world/SurvivalArena3D.js`** :
  - Export de `computeSurvivalIntroShot(progress, aiPos, spawnPos, elapsed)` calculant l'interpolation caméra PC (cadre d'alarme initial -> travelling vers le Professeur CIEL -> retour sur le point d'apparition), le niveau de scintillement/teinte rouge et le texte de briefing.
  - Export de `getDetentionCameraHitBoxes(width, height, kind)` pour les consoles de changement de caméra sur le bureau (`desk`) et sur le tableau (`board`).
  - Reconstruction complète de `detGroup` (`detention-classroom-3d`) en véritable salle d'heure de colle 3D : sol, plinthes, 3 pupitres et chaises d'élèves, lampe de bureau allumée, horloge murale animée (`updateDetentionClock`), fenêtre à barreaux, grand tableau avant avec craies/brosse.
  - Intégration sur le pupitre du joueur de `mathSheetMesh` (feuille interactive inclinée) et `deskCamMesh` (pupitre caméra `◀ / ▶`), et sur le tableau du grand écran `survMonitor` alimenté en direct par `povRenderTarget = new THREE.WebGLRenderTarget(640, 360)` et `povCamera` (basculable avec `setLivePovActive`) ainsi que du bandeau interactif `boardCamMesh`.
  - Exposition de `updateDetentionMathSheet`, `updateDetentionCameraBar`, `getDetentionInteractiveSurfaces(handlers)` et `getDetentionRoomConfig()` (avec `spawn` assis devant le pupitre et `pcEye`).

### VR WebXR, HUD & Orchestration Client
- **`src/vr/VRHudPanel.js`** :
  - Ajout du mode `survival_intro` avec barre de progression, consigne horreur et bouton `vr_surv_intro_skip`.
  - Mise à jour de `survival_lobby` pour `minPlayers` à `1`.
  - Enrichissement du mode `detention` avec affichage `camLabel` et boutons interactifs `vr_dt_cam_prev` / `vr_dt_cam_next`.
- **`src/vr/VRManager.js`** :
  - Support de `options.getWorldInteractiveSurfaces` dans `_updateSlotRayAndInteract` (raycast laser + gâchette `selectstart`) et via `_updateWorldSurfacesDirectTouch` (toucher direct du bout de l'index en hand-tracking dans l'espace local du mesh 3D).
  - Ajout de `applySurvivalIntroPose(x, z, lookTarget)` pour aligner la posture VR en sécurité face au Professeur CIEL sans travelling brutal.
- **`index.html`**, **`src/styles/main.css`**, **`src/ui/HudManager.js`** :
  - Ajout de `#survival-intro-overlay` (`#survival-intro-skip-btn`), `#survival-detention-3d-hud` (`#detention-3d-cam-prev`, `#detention-3d-cam-next`), `#survival-end-inspect-btn` (toggle vue compacte `.is-compact`) et mise à jour des libellés lobby à 1 joueur minimum tout en conservant `#survival-detention-modal` et `#detention-surveillance-canvas`.
  - Méthodes `HudManager`: `showSurvivalIntroOverlay`, `updateSurvivalIntroOverlay`, `hideSurvivalIntroOverlay`, `showDetention3dHud`, `hideDetention3dHud`.
- **`src/main.js`** :
  - Gestion de `room_switched` et `applyRoomInstanceFilter` (synchronisation stricte des pairs et de la voix de proximité avec les participants de l'instance Survie courante).
  - Pilotage de la cinématique d'intro dans `startSurvivalMatchClient` et `updateSurvivalLoop` (`sfx.playSurvivalIntroAlarm()`, chute lumineuse, travelling PC / `applySurvivalIntroPose` + panneau spatial `survival_intro` VR).
  - Pilotage de la salle de colle 3D via `enterDetentionClassroom3D`, `renderDetentionLivePov` (enregistré via `sceneMgr.addBeforeRender` pour rendre le POV temps réel du coéquipier survivant ciblé, ou du Professeur CIEL / caméra rotative U300 en solo), raycasting souris PC + raccourcis clavier `1..4` / `ArrowLeft` / `ArrowRight` / clic-droit pour regarder autour depuis le bureau, et envoi de `network.sendSurvivalReturn()` en sortie de partie.

### Versioning, Changelog & Tests
- **`vite.config.js`** et **`src/ui/ChangelogModal.js`** :
  - Passage de `__APP_VERSION__` et `APP_VERSION` à `v4.20 - Instance Isolée Survie, Cinématique Intro & Salle de Colle 3D POV Live`.
  - Ajout de l'entrée datée `17/11/2026` (`tag: 'DERNIÈRE MÀJ'`) tout en haut de `CHANGELOG_RELEASES` et passage de `v4.19` à `'HISTORIQUE'`.
- **`tests/celebration-debug.test.js`** :
  - Mise à jour de l'assertion de version vers `v4.20` et vérification de présence des nouveaux IDs DOM (`survival-intro-overlay`, `survival-intro-skip-btn`, `survival-detention-3d-hud`, `detention-3d-cam-prev`, `detention-3d-cam-next`, `survival-end-inspect-btn`).
- **`tests/survival-horror.test.js`** :
  - Mise à jour des assertions `SURVIVAL_MIN_PLAYERS === 1` et ajout des tests pour le lancement solo 1 joueur, `introDurationMs` / `introActive`, l'isolation WebSocket totale entre `survival-game-*` et `plateau-u300`, le retour manuel (`survival_return`) et automatique (`postEndResetMs`), `computeSurvivalIntroShot`, `drawVariationWorksheetCanvas` / `getVariationSheetHitBoxes`, les surfaces 3D de la salle de colle, `RemotePlayersManager.setInstanceFilter` / `getPeerPoseForPov` / `setPeerPovHidden`, `sfx.playSurvivalIntroAlarm`, et `VRHudPanel` modes `survival_intro` & `detention`.
- **`tests/vr.test.js`** :
  - Ajout du test `VR WebXR v4.20` validant `SceneManager.renderToTarget` pendant une session WebXR active (`xr.enabled` / `xr.isPresenting`), la sélection laser contrôleur + toucher direct main articulée sur les surfaces 3D de la salle de colle, `applySurvivalIntroPose` et le panneau spatial `survival_intro`.

---

## 3. Résultats tests/build

- **`node --test --test-force-exit tests/*.test.js`** : **75 tests, 75 réussis (`pass 75`), 0 échec (`fail 0`)** en ~12,68 s.
- **`npm test`** (`node --test tests/*.test.js`, sans `--test-force-exit`) : **75 tests, 75 réussis (`pass 75`), 0 échec (`fail 0`)** en ~13,05 s, confirmant l'absence de tout socket ou timer resté ouvert.
- **`npm run build`** (`vite build`, v6.4.6) : **succès complet** en 12,00 s (`54 modules transformed`), sortie générée :
  - `dist/admin.html` : 15.26 kB (`gzip: 3.76 kB`)
  - `dist/index.html` : 67.84 kB (`gzip: 14.13 kB`)
  - `dist/assets/admin-BzkkMmhh.css` : 20.00 kB (`gzip: 4.69 kB`)
  - `dist/assets/main-B6QfIY3X.css` : 107.51 kB (`gzip: 21.77 kB`)
  - `dist/assets/admin-P9AsDWA1.js` : 94.42 kB (`gzip: 25.54 kB`)
  - `dist/assets/LabBuilder-BmQVUnlH.js` : 177.25 kB (`gzip: 53.22 kB`)
  - `dist/assets/three-_5pHxIMn.js` : 523.73 kB (`gzip: 132.75 kB`)
  - `dist/assets/main-DU7fLssM.js` : 752.17 kB (`gzip: 230.32 kB`)
- **Conformité du dépôt** :
  - Recherche `fortin` (insensible à la casse) : 0 occurrence.
  - Vérification commentaires ajoutés dans `git diff` (`index.html`, `server/`, `src/`, `tests/`, `vite.config.js`) : 0 occurrence (`COMMENT_HITS: 0`).
  - Fichiers de données `server/data/map.json`, `server/data/db.json` et `server/data/accounts.json` non modifiés.

---

## 4. Guide de vérification

1. **Test en solo & isolation d'instance (1 joueur minimum)** :
   - Ouvrir un navigateur A connecté dans `plateau-u300` et un navigateur B resté dans `plateau-u300`.
   - Dans le navigateur A, franchir la **Porte de Survie Horreur** pour rejoindre le salon d'attente : le client A bascule dans une instance `survival-game-*` et disparaît immédiatement de l'écran/vocal du joueur B sur `plateau-u300`.
   - Cliquer sur **Prêt** dans le salon avec seulement 1 joueur : la partie démarre immédiatement.
2. **Test coopératif & cinématique d'introduction (PC et VR WebXR)** :
   - Avec 2+ joueurs prêts dans la même instance, vérifier au lancement l'extinction des lumières, l'alarme et les grésillements électriques, le cadrage du Professeur CIEL avec le briefing Survie, puis la reprise de contrôle au spawn (sur PC : travelling caméra ; en VR / Simulateur VR `F9` : posture orientée sans nausée + panneau spatial 3D avec bouton **Passer**).
3. **Test Salle de Colle 3D, Feuille de Maths & Caméra POV Coéquipiers Live** :
   - Se faire capturer par le Professeur CIEL : après le jumpscare, le joueur est placé à son pupitre dans la salle de colle 3D face au grand tableau.
   - Cliquer directement à la souris (PC) ou au laser/doigt (VR) sur les choix `A/B/C/D` (ou touches `1-4`) de la **feuille posée sur le bureau** pour résoudre les tableaux de variation en boucle.
   - Observer sur l'écran du tableau la vue POV temps réel du coéquipier survivant en mouvement, puis tester les boutons **Caméra Précédente / Suivante** (sur le bureau 3D, le bandeau du tableau, le HUD PC ou le panneau VR) pour alterner entre coéquipiers vivants, Professeur CIEL en patrouille et caméra de surveillance du plateau U300.
4. **Retour automatique vers `plateau-u300`** :
   - Terminer tous les TPs ou attendre la fin de partie : tous les joueurs sont ramenés dans `plateau-u300` et redeviennent visibles pour le joueur B.
