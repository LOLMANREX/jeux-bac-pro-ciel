# 📋 Rapport Technique — Atelier CIEL 3D `v4.18`

**Mise à jour :** `v4.18 - Adaptation Complète de Tous les TPs en VR WebXR & Panneaux Spatiaux Interactifs`  
**Date :** 16/11/2026  
**Objectifs :**
1. Auditer tous les Travaux Pratiques (`oscilloscope`, `soldering`, `electronics`, `antivirus`, `vmvlan`, `patchrack`, `hardware`, `audiovisual`, `studio`) ainsi que le dialogue du Professeur CIEL et lever tous les blocages/pauses VR.
2. Déployer un système complet de **panneaux spatiaux 3D interactifs** (`createTpSpatialPanel` / `createVRStationTerminalPanel`) haute lisibilité (1280×800), utilisable au **rayon laser des contrôleurs (`selectstart`)** ET par **toucher direct avec les mains articulées (`hand-tracking`)**, avec clavier virtuel AZERTY 3D, presets CLI, sliders tactiles/laser, vues caméra/zoom/pivot VR et bouton permanent **`✕ Quitter le TP`**.
3. Optimiser l'ergonomie et la précision 3D de chaque établi en VR (sérigraphie des pastilles/points de test directement sur les cartes PCB 3D, maintien de gâchette sans surcharge de rendu, potentiomètre thermique, hitboxes élargies sur baie RJ45 24 ports, synchronisation bidirectionnelle faders DMX/Studio).
4. Garantir la sauvegarde immédiate des notes jusqu'à `20/20` (`POST /api/account/save` et WebSocket), la mise à jour de la **CIEL Watch** (moyenne `/20` et TPs validés), ainsi que la **Cinématique d'Ascension « Dieu du Bac Pro CIEL »**, le choix de spécialité divine en VR, le Cycle de Prestige et le déblocage du Skin Secret Ultime (`architecte_supreme`).
5. Mettre à jour le versionning (`vite.config.js`, `src/ui/ChangelogModal.js`), enrichir `tests/vr.test.js`, `tests/minigame-logic.test.js` et `tests/celebration-debug.test.js`, valider tous les tests et le build Vite sans erreur, puis publier sur `origin main`.

---

## 🔍 1. Diagnostic & Causes Identifiées

### 1.1 Blocages explicites des TPs et du Professeur CIEL en VR (`src/main.js`, `src/world/SceneManager.js`)
- `openTp()` (`src/main.js`) et `interactWith()` (`src/main.js`) court-circuitaient l'ouverture des ateliers et du dialogue Professeur CIEL dès que `vrManager?.isVrActive?.()` retournait `true`.
- Dans `SceneManager.start()`, la condition `if (this.customRenderScene && !isXr)` empêchait tout rendu des scènes d'établis 3D (`customRenderScene`) pendant une session WebXR (`renderer.xr.isPresenting || this.vrPresenting`).

### 1.2 Limites du panneau spatial TP et des interactions WebXR (`src/vr/VRHudPanel.js`, `src/vr/VRManager.js`, `src/minigames/Workbench3DHost.js`)
- `createTpSpatialPanel()` plafonnait les outils à 5 (masquant les outils 6 et 7 de `PcHardwareGame`), plafonnait `drawerControls` à 8 boutons (coupant le 9e bouton d'`AntivirusGame`, les presets de `VlanConfigGame` et tous les sliders audio/DMX/studio), ignorait `[data-slot]` (`PatchPanelGame`) et `[data-sel]` (`DmxLightingGame`), et sautait la génération des `hitBoxes` sans `<canvas>` DOM.
- Aucune prise en charge de saisie texte/CLI (`<input type="text">`) ni de sliders continus draggables au laser ou au doigt n'était disponible en VR.
- `VRManager._initXrControllers()` ne souscrivait pas aux événements WebXR `selectstart` / `selectend`, ne gérait pas le toucher direct sur les panneaux spatiaux TP/Dialogue/Ascension (`_updateSpatialPanelDirectTouch`), et `Workbench3DHost.destroy()` parcourait toute la scène sans exclure explicitement la sous-arborescence `vr-rig`.

### 1.3 Modales HTML/DOM invisibles dans le casque (`src/ui/DialogueModal.js`, `src/main.js`, `src/minigames/MiniGameModal.js`)
- Sous `body.vr-presenting`, les modales DOM (`DialogueModal`, dialogue d'Ascension `ascension-cinematic-dialogue`, tags flottants HTML des PCBs) sont masquées ou illisibles dans le casque.
- Un enchaînement de fermeture dans `MiniGameModal.finishTp()` pouvait afficher l'écran de résultat par-dessus une fermeture immédiate déclenchée par l'Ascension solo 20/20.

---

## 🛠️ 2. Modifications Fichier par Fichier

### [`src/vr/VRHudPanel.js`](file:///opt/atelier-dev/src/vr/VRHudPanel.js)
- **`createWristHudPanel` :** Ajout de `completedCount` et `totalTps` dans l'état et affichage permanent `${avgDisplay} • ${doneCnt}/${totalCnt} • ${xp} XP` sur la montre **CIEL Watch**.
- **`createTpSpatialPanel` / `createVRStationTerminalPanel` :**
  - Passage en canvas haute netteté **`1280×800`** (`1.38m × 0.86m`), découplage total des `hitBoxes` vis-à-vis de `ctx` (fonctionnement complet sous Node.js), et coalescence des redessins non structurels (>= 45 ms).
  - Support complet de 4 modes spatiaux : **`workbench`**, **`result`**, **`dialogue`** (Professeur CIEL + bulletin de notes 3×3 + jusqu'à 6 choix) et **`ascension`** (discours solennel, collection des 5 voies divines, compte à rebours, 5 boutons de spécialité, bouton Applaudir).
  - Barre caméra VR intégrée (`📷 Vue`, `🔍−`, `🔍+`, `↻ Pivot`), grille outils multi-lignes jusqu'à 10 outils, actions, pagination `◀ / ▶`, **sliders interactifs à piste glissable**, onglets **`🎛️ Contrôles`** / **`⌨️ Clavier / CLI`** avec clavier virtuel AZERTY complet, presets rapides et journal terminal, plus bouton permanent **`✕ Quitter le TP`** / **`✕ Fermer`**.
  - Ajout de `placeRelativeToCamera(camera, dist, yOffset)`.

### [`src/world/SceneManager.js`](file:///opt/atelier-dev/src/world/SceneManager.js)
- Suppression du blocage `!isXr` sur `if (this.customRenderScene)` dans `start()`, exécution isolée de `alwaysUpdaters`, protection `autoClear`, `setClearColor` et réinitialisation de `RenderTarget` non-XR avant `renderer.render(this.customRenderScene, this.camera)`.

### [`src/minigames/Workbench3DHost.js`](file:///opt/atelier-dev/src/minigames/Workbench3DHost.js)
- Enrichissement de `extractDrawerControls()` pour capturer `<button>`, `[data-slot]`, `[data-sel]`, `[data-fix-card]`, `[data-cmd]`, transformer les `<input type="range">` en sliders VR continus (`kind: 'slider'`) et exposer `<input type="text">` / `<form>` vers le clavier spatial VR (`textInput`) avec journal `#cli-history`.
- Ajout de `setVrExtras(...)`, transmission des vues caméra (`setCameras`, `setCameraView`, `resetCameraView` via `vrBridge.onCameraPresetChange`) et protection du sous-arbre `vr-rig` / `__isVrRig` lors du `destroy()`.

### [`src/vr/VRManager.js`](file:///opt/atelier-dev/src/vr/VRManager.js)
- Ajout des écouteurs XR **`selectstart`** / **`selectend`** sur les contrôleurs avec file de clic sous-trame (`xrSelectPressed` / `xrSelectQueued`).
- Amélioration de `attachTpContext()`, `_applyTpCameraPose()`, `adjustTpZoom()`, `adjustTpOrbit()`, `applyTpCameraPose()` : positionnement confortable face au joueur (~1.24 m au-dessus de la ligne de visée de l'établi) sans occlure la paillasse, et inspection zoom/orbite via boutons ou joysticks VR.
- Support du **drag continu de sliders au rayon laser** (`panelDrag`) et du **toucher direct par index des deux mains** (`_updateSpatialPanelDirectTouch`) sur `tpPanel` et `worldPanel`.
- Ajout de `openWorldSpatialPanel()`, `updateWorldSpatialPanel()` et `closeWorldSpatialPanel()` pour le Professeur CIEL et l'Ascension.

### [`src/minigames/MiniGameModal.js`](file:///opt/atelier-dev/src/minigames/MiniGameModal.js) & [`src/ui/DialogueModal.js`](file:///opt/atelier-dev/src/ui/DialogueModal.js)
- **`MiniGameModal.js` :** Garde `_isOpen` dans `finishTp()` / `close()`, transmission de `onCameraPresetChange` et `tpId` dans `__vrBridge`, et extraction des lignes de synthèse (`summaryLines`) pour l'écran de résultat VR.
- **`DialogueModal.js` :** Support natif VR via `vrManager.openWorldSpatialPanel('dialogue', ...)` pour tous les nœuds (accueil, conseils techniques, téléportation vers atelier, bulletin détaillé `vrGrades`).

### Adaptation des Établis 3D (`src/minigames/*.js`)
- **[`SolderingGame.js`](file:///opt/atelier-dev/src/minigames/SolderingGame.js) :** Sérigraphie 3D des pastilles directement sur `pcbCanvas`, limitation de cadence `refreshHud()` dans `onHoldTick`, et `setVrExtras` avec potentiomètre `260–420 °C` et statut des pastilles.
- **[`OscilloscopeGame.js`](file:///opt/atelier-dev/src/minigames/OscilloscopeGame.js) :** Sérigraphie `GND / TP1 / TP2 / TP3` sur le PCB, `dragPlane` frontal sur les molettes, et `setVrExtras` (sliders Trigger/VOLTS-DIV/TIME-DIV + sélecteurs de sondage).
- **[`PcHardwareGame.js`](file:///opt/atelier-dev/src/minigames/PcHardwareGame.js) :** Nettoyage strict des timers de séquence POST à la destruction/reset (`clearPostTimers`, garde `destroyed`) et contrôles rapides VR (`setVrExtras`).
- **[`PatchPanelGame.js`](file:///opt/atelier-dev/src/minigames/PatchPanelGame.js) :** Hitboxes 3D élargies sur les 24 ports panneau et 24 ports switch pour le laser VR, libellés T568B actifs et raccourcis du cahier de brassage via `setVrExtras`.
- **[`VlanConfigGame.js`](file:///opt/atelier-dev/src/minigames/VlanConfigGame.js) :** Correction des IDs caméra (`'overview'`, `'campus'`), marquage `data-active` des boutons CLI et presets/historique CLI via `setVrExtras`.
- **[`DmxLightingGame.js`](file:///opt/atelier-dev/src/minigames/DmxLightingGame.js) & [`StudioRegieGame.js`](file:///opt/atelier-dev/src/minigames/StudioRegieGame.js) :** Synchronisation en temps réel de `refreshDrawerControls()` depuis `syncLiveUiWithoutRebuild()`, métadonnées `data-vr-label` / `data-vr-unit` / `data-active` et bannière d'état Audio/Cue.

### [`src/main.js`](file:///opt/atelier-dev/src/main.js)
- Suppression des blocages temporaires VR dans `openTp()` et `interactWith()`.
- Injection de `vrManager` dans `openTeacherDialogue()`, ajout de `syncVrWatchHud()` (actualisé dans la boucle en jeu, en pause TP et sur `score_recorded`, `profile_updated`, `profile_reset`).
- Câblage complet en VR spatial de `runWorldCelebration()`, `runAscensionPhase()`, `endAscensionCinematic()` et `secret_skin_unlocked` (sans lévitation caméra dans le casque).

### Versionning, Changelog & Tests ([`vite.config.js`](file:///opt/atelier-dev/vite.config.js), [`src/ui/ChangelogModal.js`](file:///opt/atelier-dev/src/ui/ChangelogModal.js), `tests/`)
- Mise à jour vers **`v4.18 - Adaptation Complète de Tous les TPs en VR WebXR & Panneaux Spatiaux Interactifs`**, ajout de l'entrée datée `v4.18` en haut de `CHANGELOG_RELEASES` et passage de `v4.17` en `'HISTORIQUE'`.
- Ajout des tests VR et logiques dans [`tests/vr.test.js`](file:///opt/atelier-dev/tests/vr.test.js), [`tests/minigame-logic.test.js`](file:///opt/atelier-dev/tests/minigame-logic.test.js) et mise à jour des assertions de version dans [`tests/celebration-debug.test.js`](file:///opt/atelier-dev/tests/celebration-debug.test.js).

---

## 🧪 3. Résultats des Tests & Build

Vérifications exécutées après la dernière modification de code :
- **`node --test --test-force-exit tests/*.test.js` :** `exit code 0` — **66 tests**, **66 réussis**, **0 échec**, 0 ignoré (`10557.46ms`).
- **`npm test` :** `exit code 0` — **66 tests**, **66 réussis**, **0 échec**, 0 ignoré (`10783.07ms`, sans `--test-force-exit`, aucun timer ni socket ouvert).
- **`npm run build` (`vite v6.4.6`) :** `exit code 0` — **51 modules transformés**, build `dist/` terminé en `11.38s` (`dist/admin.html` `15.26 kB`, `dist/index.html` `58.73 kB`, `dist/assets/admin-BzkkMmhh.css` `20.00 kB`, `dist/assets/main-DglBUtOS.css` `96.27 kB`, `dist/assets/admin-Df5uDrLp.js` `93.98 kB`, `dist/assets/LabBuilder-D3undD6i.js` `168.18 kB`, `dist/assets/three-CFxLWJhX.js` `523.72 kB`, `dist/assets/main-BimI_ES1.js` `638.38 kB`).
- **Contrôles de conformité :** `0` occurrence de `"Fortin"`, `0` commentaire ajouté en JS/CSS/HTML, `server/data/map.json`, `server/data/db.json` et `server/data/accounts.json` intacts.

---

## 🎯 4. Guide de Vérification

1. **Dialogue Professeur CIEL & Lancement des TPs en VR :**
   - Activer le mode VR (Meta Quest Browser ou Simulation PC via **`F9`**), approcher le **Professeur CIEL** ou n'importe quel établi 3D et appuyer sur la gâchette.
   - Vérifier l'ouverture du panneau spatial 3D sans aucune modale HTML bloquante, tester la navigation par choix jusqu'au bulletin de notes, puis lancer chaque TP (`Oscilloscope`, `Brasure PCB`, `Électronique`, `Cybersécurité SOC`, `VLAN CLI`, `Brassage Baie 19"`, `Hardware PC`, `DMX`, `Studio Régie`).
2. **Interaction Laser, Hand-Tracking, Sliders, Clavier VR & Caméra :**
   - Vérifier la manipulation directe des sliders (Température Fer `260–420 °C`, Volts/Time/Trigger Oscillo, Faders DMX & Studio) au rayon laser et au toucher direct de l'index.
   - Ouvrir l'onglet **`⌨️ Clavier / CLI`** dans le TP Réseaux VLAN, taper `ping` sur le clavier virtuel 3D et valider avec **`ENTRÉE ↵`**.
   - Tester les boutons **`📷 Vue`**, **`🔍−`**, **`🔍+`**, **`↻ Pivot`** et **`✕ Quitter le TP`** en vérifiant le retour immédiat à la locomotion aux joysticks.
3. **TP Brasure PCB 3D jusqu'à `20/20` :**
   - Activer l'extracteur, régler la station à `350 °C` via le slider spatial, nettoyer les 2 ponts U2/U3 à la tresse cuivre, braser les 8 pastilles sérigraphiées en maintenant la gâchette dans la zone optimale, puis tester en `5V` pour valider `20/20`.
4. **Sauvegarde Compte, CIEL Watch & Ascension VR :**
   - Vérifier sur la **CIEL Watch** (poignet gauche) la mise à jour instantanée de la moyenne `/20` et du compteur de TPs validés (`x/5`), ainsi que la persistance sur reconnexion (`accounts.json` via `POST /api/account/save`).
   - À `20/20` sur l'ensemble des TPs, vérifier l'ouverture du panneau spatial d'Ascension **« Dieu du Bac Pro CIEL »**, le choix interactif du Skin Divin en VR, le Cycle de Prestige et le déblocage du Skin Secret Ultime.
