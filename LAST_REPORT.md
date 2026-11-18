# RAPPORT TECHNIQUE — Mise à jour v4.23
**Titre** : `v4.23 - Optimisation Massive des Performances FPS, Correction Déblocage Baie de Brassage & Heure de Colle en Solo`
**Date** : 18/11/2026
**Statut** : Validé, testé (91/91 tests) & compilé (Vite build production sans erreur)

---

## 1. Diagnostic Technique

1. **Ralentissements & Chutes de FPS (Écrans CIEL OS & Moteur Three.js)** :
   - Dans `src/world/LabBuilder.js`, chaque poste PC du Plateau U300 embarque une instance `CielOsDesktop` (`1024x640`) reliée à une `THREE.CanvasTexture`. Même à distance ou hors du champ de vision, tous les écrans se redessinaient périodiquement (ou à 60 FPS si un mini-jeu restait ouvert), provoquant des transferts CPU → GPU (`canvasTexture.needsUpdate = true`) simultanés.
   - Dans `src/world/SceneManager.js`, le `pixelRatio` pouvait monter jusqu'à `2.0` en mode `high` et `sun.shadow.mapSize` basculait à `2048x2048` lors de `updateWorldBounds`. De plus, `renderToTarget` et la boucle principale allouaient des vecteurs/tableaux temporaires (`Vector3.clone()`, `new THREE.Vector2()`, `new THREE.Plane()`, `new Map()`) à chaque frame.
   - Dans `src/world/LabBuilder.js` et `src/world/SurvivalArena3D.js`, les murs, sols, plafonds et meubles statiques conservaient `matrixAutoUpdate = true`, recalculant leurs matrices locales et mondiales à chaque frame, tandis que de petits accessoires (chaises, boîtiers d'écrans, pieds de meubles) projetaient inutilement des ombres dynamiques.
2. **Bug de Sortie des Baies de Brassage (`hiding_rack` — Écran Noir & Joueur Bloqué)** :
   - Dans `src/world/LabBuilder.js`, les entrées `hideEntry` de `lab.hidingSpots` définissaient `position: new THREE.Vector3(...)` et `exitPos: new THREE.Vector3(...)` mais pas les propriétés numériques `x`, `z`, `exitX`, `exitZ` ni `rotRad`.
   - Dans `src/main.js` (`toggleHidingInRack`), l'appel `player.teleportTo({ x: spot.x, z: spot.z }, { x: spot.exitX, z: spot.exitZ })` recevait `undefined`, ce qui injectait `NaN` dans `player.position` et `camera.position`, provoquant un écran noir WebGL immédiat et le blocage complet des collisions/déplacements.
   - En outre, la distance de sortie n'était pas validée contre les colliders environnants à `1.15m` devant la porte et `#survival-hide-overlay` ne réinitialisait pas explicitement `style.opacity = '0'` et `style.display = 'none'`.
3. **Fin de Partie Immédiate en Mode Survie Solo (1 Joueur) au Lieu de la Salle d'Heure de Colle 3D** :
   - Dans `src/world/SurvivalEngine.js` (`SurvivalMatchController.step`), dès que `this.getAliveParticipants().length === 0`, la partie se terminait immédiatement par `this._finishMatch('defeat', nowMs)`. En partie solo (`this.participants.size === 1`), dès que le joueur était attrapé par le Professeur CIEL, le serveur émettait `survival_ended`, stoppait la patrouille du Professeur CIEL et affichait l'écran de défaite bloquant au lieu de laisser le joueur solo expérimenter la Salle d'Heure de Colle 3D.

---

## 2. Modifications Réalisées (Fichier par Fichier)

- **[src/minigames/CielOsDesktop.js](file:///opt/atelier-dev/src/minigames/CielOsDesktop.js)** :
  - Ajout du système de veille et de throttling (`sleepMode`, `inView`, `isFocusedStation`, `setSleepMode`, `textureUploadCount`, `lastActiveDrawAt`).
  - Mise en pause complète (`return false` sans redessin ni upload GPU) lorsque l'écran est hors du champ de vision (`inView === false`) et non modifié (`!dirty`).
  - Mode veille automatique pour les PC distants (`>= 4m`) avec rafraîchissement de l'horloge limité à 1 fois toutes les `2.0s` maximum (même si une application/jeu est ouverte).
  - Rafraîchissement temps réel (`30-60 FPS`) réservé au PC actif ou aux écrans situés à moins de `4m` dans le champ de vision de la caméra.
- **[src/world/SceneManager.js](file:///opt/atelier-dev/src/world/SceneManager.js)** :
  - Plafonnement de `renderer.setPixelRatio(Math.min(dpr, 1.5))` en qualité `high` (`1.25` en `balanced`, `1` en `eco`).
  - Plafonnement de `sun.shadow.mapSize` à `1024x1024` maximum dans `_setupLights()` et `updateWorldBounds()`.
  - Ajout de `restoreNormalExposure()` pour restaurer instantanément `toneMappingExposure = 0.96`.
  - Élimination des allocations mémoire dans `renderToTarget` et `setHorrorAtmosphere` grâce à des vecteurs et tableaux pré-alloués (`_savedFlashPos`, `_savedFlashTargetPos`, `_hiddenStatesScratch`).
- **[src/world/LabBuilder.js](file:///opt/atelier-dev/src/world/LabBuilder.js)** :
  - Désactivation de `castShadow` et `receiveShadow` sur les petits objets décoratifs, chaises d'élèves, boîtiers d'écrans, claviers, souris, oscilloscopes, supports d'accessoires, anneaux et sprites.
  - Activation de `matrixAutoUpdate = false` (après `updateMatrix()` et `worldGroup.updateMatrixWorld(true)`) sur l'ensemble des murs, sols, plafonds, meubles et objets statiques de l'atelier.
  - Throttling intelligent de `pcStations` dans `lab.update(elapsed, playerPos, diplomaEarned, camera)` selon la distance (`< 4.0m`) et le produit scalaire avec la direction de la caméra (`_camWorldPos`, `_camWorldDir` pré-alloués).
  - Renseignement complet de `x`, `z`, `rotRad`, `rad`, `exitX`, `exitZ`, `position` et `exitPos` sur chaque `hiding_rack` via `computeRackExitPosition`.
- **[src/world/SurvivalEngine.js](file:///opt/atelier-dev/src/world/SurvivalEngine.js)** :
  - Création et export de `computeRackExitPosition(rack, colliders, bounds, playerRadius)` calculant une position de sortie dégagée à `1.15m` devant la porte de la baie selon sa rotation `rotRad`, validée sans collision avec les murs ni la baie elle-même.
  - Adaptation de `SurvivalMatchController.step()` et ajout de `isSoloDetentionActive()` / `finishSoloDetention()` : en partie solo (`1 joueur`), lorsque le joueur est attrapé par le Professeur CIEL, la partie reste en phase `'active'` (`soloDetained: true`) et le Professeur CIEL poursuit sa ronde A* dans l'atelier afin d'alimenter en direct l'écran POV de la Salle d'Heure de Colle 3D.
- **[src/world/SurvivalArena3D.js](file:///opt/atelier-dev/src/world/SurvivalArena3D.js)** :
  - Optimisation du `WebGLRenderTarget` POV de la salle de colle en `512x288`.
  - Ajout d'un bouton/badge 3D discret sur le coin avant-gauche du bureau d'heure de colle (`deskExitMesh`, surface interactive `detention_desk_exit_btn`, `getDetentionDeskExitHitBoxes`) permettant au joueur sur PC (clic souris) et en VR (laser / toucher main) de relancer immédiatement une partie (`🔄 Relancer une partie`) ou de quitter l'heure de colle (`🚪 Quitter la colle`).
  - Gel des matrices statiques (`matrixAutoUpdate = false` après `updateMatrix()`) sur les salles 3D d'attente et de colle.
- **[src/world/PlayerController.js](file:///opt/atelier-dev/src/world/PlayerController.js)** :
  - Sécurisation anti-`NaN` de `teleportTo(targetPos, lookAtPos)` et ajout de `resolveUnstuckPosition(desiredX, desiredZ, rotRad)` garantissant qu'aucune téléportation de sortie de baie ne laisse le joueur coincé dans un collider.
- **[src/ui/HudManager.js](file:///opt/atelier-dev/src/ui/HudManager.js)** :
  - Mise à jour de `hideHidingOverlay()` pour appliquer immédiatement `opacity = '0'`, `display = 'none'` et la classe `hidden` dès la sortie d'une baie de brassage (et restauration dans `showHidingOverlay()`).
- **[src/vr/VRManager.js](file:///opt/atelier-dev/src/vr/VRManager.js) & [src/world/RemotePlayers.js](file:///opt/atelier-dev/src/world/RemotePlayers.js)** :
  - Suppression des allocations mémoire par frame (`workPlane`, `tempWorkPt`, `tempProjVec`, `_worldSurfHoverThisFrame.clear()`, `_povPosePos`).
  - Ajout de `exitHidingRackVr(exitX, exitZ, yaw)` réactivant immédiatement la locomotion VR, le snap-turn et fermant le panneau spatial de cachette.
- **[server/wsHub.js](file:///opt/atelier-dev/server/wsHub.js) & [src/core/network.js](file:///opt/atelier-dev/src/core/network.js) & [src/main.js](file:///opt/atelier-dev/src/main.js)** :
  - Ajout du message WebSocket `survival_restart` (`network.sendSurvivalRestart()`) et des handlers `exitDetentionAndReturnToHall()` / `restartSurvivalFromDetention()` reliés au bouton 3D sur le coin du bureau de la Salle de Colle.
  - Rafraîchissement du rendu POV `renderDetentionLivePov` cadencé à `0.045s` (~22 FPS) sans allocation mémoire par frame.
  - Correction complète de `toggleHidingInRack` (réinitialisation immédiate de l'overlay noir et de l'exposition, téléportation dégagée à `1.15m` devant la porte, déverrouillage immédiat des contrôles PC/VR et de l'avatar).
- **[vite.config.js](file:///opt/atelier-dev/vite.config.js) & [src/ui/ChangelogModal.js](file:///opt/atelier-dev/src/ui/ChangelogModal.js)** :
  - Passage de la version à `v4.23` et ajout de l'entrée `v4.23` en tête de `CHANGELOG_RELEASES` (`tag: 'DERNIÈRE MÀJ'`, `v4.22` passé à `'HISTORIQUE'`).
- **[tests/ciel-os.test.js](file:///opt/atelier-dev/tests/ciel-os.test.js), [tests/survival-horror.test.js](file:///opt/atelier-dev/tests/survival-horror.test.js) & [tests/celebration-debug.test.js](file:///opt/atelier-dev/tests/celebration-debug.test.js)** :
  - Ajout des tests unitaires et d'intégration validant le throttling des écrans CIEL OS, `matrixAutoUpdate = false`, la sortie dégagée des baies de brassage à `1.15m` sans écran noir ni blocage, et l'accès à la Salle d'Heure de Colle 3D en mode 1 joueur avec bouton 3D de sortie/relance sur le coin du bureau.

---

## 3. Résultats des Tests & du Build

- **Tests automatisés (`node --test --test-force-exit tests/*.test.js`)** : **91 tests exécutés, 91 réussis, 0 échec**.
- **Build de production (`npm run build`)** : **Succès en ~1.3s**, aucune erreur ni avertissement.
- **Intégrité des données** : `server/data/map.json` et `server/data/db.json` intacts (`git diff` vide sur ces fichiers).

---

## 4. Guide de Vérification

1. **Fluidité & Throttling CIEL OS** :
   - Se déplacer dans l'atelier U300/U305/U307 : seuls les écrans PC à moins de 4 mètres dans le champ de vision ou le poste actif utilisé se rafraîchissent en temps réel ; les PC distants passent en veille (horloge toutes les 2s ou pause hors caméra).
2. **Sortie des Baies de Brassage (`hiding_rack`)** :
   - Lancer une partie Survie Horreur, s'approcher d'une Baie de Brassage et appuyer sur `[E]` (ou gâchette VR) pour s'y cacher, puis appuyer à nouveau sur `[E]` (ou bouton VR « Sortir ») : l'overlay sombre disparaît instantanément (`opacity: 0`, `display: none`), le joueur apparaît à `1.15m` devant la porte face au couloir sans aucune collision ni écran noir, et peut se déplacer immédiatement.
3. **Salle d'Heure de Colle 3D en Solo (1 Joueur)** :
   - Lancer le Mode Survie Horreur seul (1 joueur) et se laisser attraper par le Professeur CIEL : après le jumpscare, le joueur est envoyé dans la Salle d'Heure de Colle 3D (assis devant la feuille de tableaux de variation interactifs et l'écran du tableau affichant en direct la caméra POV du Professeur CIEL en patrouille dans l'atelier), et peut cliquer sur le bouton 3D discret situé sur le coin avant-gauche du bureau pour relancer une partie ou quitter la colle.
