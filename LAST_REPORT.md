# 📋 Rapport Technique — Atelier CIEL 3D `v4.17`

**Mise à jour :** `v4.17 - Ergonomie CIEL Watch VR, Masquage Panneau Debug, Fix Bras Croisés Multi & Sélecteur Audio`  
**Date :** 16/11/2026  
**Objectifs :**
1. Ajouter un sélecteur d’entrée (Microphone) et de sortie audio (Casque / Enceintes via `setSinkId`) accessible depuis le HUD en jeu, avec vu-mètre temps réel, changement de micro à chaud sans coupure multijoueur, persistance `localStorage` et écoute automatique de `ondevicechange`.
2. Diagnostiquer et corriger le bug des bras croisés de l’avatar VR en multijoueur dans `AvatarBuilder.js`.
3. Réorienter ergonomiquement la montre **CIEL WATCH** sur le côté dorsal/radial du poignet gauche (inclinaison ~42° vers le regard, texte à l’endroit, zéro clipping, interaction laser et tactile préservée).
4. Masquer par défaut le panneau flottant `DEBUG WEBXR • ATELIER CIEL 3D` en session VR standard et limiter son affichage au **Serveur Privé Debug** (`isPrivateDebug === true`) ou à une activation explicite.
5. Mettre à jour le versionning (`vite.config.js`, `src/ui/ChangelogModal.js`), adapter les tests (`tests/vr.test.js`, `tests/voice-chat.test.js`, `tests/celebration-debug.test.js`), valider `node --test --test-force-exit tests/*.test.js`, `npm test` et `npm run build`, puis publier sur `origin main`.

---

## 🔍 1. Diagnostic & Causes Identifiées

### 1.1 Bras croisés de l’avatar VR en multijoueur (`src/world/AvatarBuilder.js`)
- Le modèle de l’avatar (`buildStudentAvatarMesh`) est modélisé face au repère local **`+Z`** (yeux à `z = 0.175`), tandis que la caméra WebXR et `PlayerController` regardent vers **`-Z`**.
- `PlayerController._applyCamera()` et `RemotePlayersManager` appliquent donc `avatar.group.rotation.y = yaw + Math.PI`.
- Dans `attachRemoteVrVisuals`, `vrRoot.rotation.y = -avatar.group.rotation.y` annule la rotation du groupe pour placer `vrRoot`, `leftHand.root` et `rightHand.root` directement en coordonnées monde relatives au joueur (où pour `yaw = 0`, la main gauche est à `px < 0` et la main droite à `px > 0`).
- Toutefois, `placeArmSpan` calculait `shoulderLocal.set(shoulderX, 1.34, 0).applyAxisAngle(yAxis, avatar.group.rotation.y)` et `outDir.set(sideSign * 0.26, -0.38, -0.08).applyAxisAngle(yAxis, avatar.group.rotation.y)`. En appliquant `yaw + Math.PI` au lieu de `yaw = avatar.group.rotation.y - Math.PI`, l’épaule gauche (`-0.29`) était tournée de 180° sur le côté droit (`+0.29` à `yaw = 0`) et l’épaule droite (`+0.29`) sur le côté gauche (`-0.29`), croisant les deux bras en X devant le torse avec des coudes inversés.

### 1.2 Orientation de la « CIEL WATCH » (`src/vr/VRManager.js`, `src/vr/VRHudPanel.js`, `src/world/AvatarBuilder.js`)
- La montre était placée à `(-0.01, 0.038, 0.036)` avec `rotation.set(-1.12, 0.22, 0.28)`. En mode contrôleur Meta Quest (`handMount.rotation = (-0.22, 0.05, 0.85)`), la normale écran pointait vers le côté extérieur gauche (`-X`) et l’axe texte `+X` était perpendiculaire à l’avant-bras, obligeant le joueur à tendre le bras droit devant lui pour lire l’interface.
- En réalignant la base locale de la montre (`+X_écran` le long de l’avant-bras vers les doigts `-Z_main`, `+Y_écran` vers le côté ulnaire `-X_main`, `+Z_écran` sortant du dos de la main `+Y_main`), puis en appliquant un roulis de **42°** (`-42°` autour de `Z_main`) vers le bord radial/pouce (`+X_main`) et une inclinaison de **14°** vers le joueur, la lecture devient naturelle simplement en pliant le coude et en tournant légèrement le poignet.

### 1.3 Panneau flottant `DEBUG WEBXR` (`src/vr/VRManager.js`, `src/vr/VRHudPanel.js`)
- `_activateXrSession()`, `handleXrSessionStart()` et `enterSimulationMode()` forçaient `this.debugPanel.group.visible = true` pour toutes les sessions, encombrant le champ de vision des joueurs en exploration standard.

### 1.4 Sélecteur audio entrée/sortie (`src/core/audio.js`, `src/network/ProximityVoiceChat.js`)
- `ProximityVoiceChat` acquérait uniquement le micro par défaut sans contrainte `deviceId`, ne permettait pas de basculer de micro en cours de session via `RTCRtpSender.replaceTrack`, n’exposait pas de niveau RMS temps réel pour un vu-mètre HUD et n’appliquait pas `setSinkId` sur les `<audio>` distants ni sur le `SoundEngine` Web Audio.

---

## 🛠️ 2. Modifications Fichier par Fichier

### [`src/core/audio.js`](file:///opt/atelier-dev/src/core/audio.js)
- Export de la classe `SoundEngine`, ajout de `masterGain`, `_getOutputNode()`, `isSinkSelectionSupported()`, `getOutputDeviceId()` et `setOutputDevice(deviceId)`.
- Routage de `playTone`, `solderSizzle` et `_playClapGrain` vers `this._getOutputNode()` avec application dynamique de `AudioContext.setSinkId` ou repli par `MediaStreamAudioDestinationNode` + `<audio>.setSinkId` sans erreur si non supporté.

### [`src/core/gameState.js`](file:///opt/atelier-dev/src/core/gameState.js)
- Persistance `localStorage` des périphériques sélectionnés via `audioInputId` (`ciel_audio_input_id`), `audioOutputId` (`ciel_audio_output_id`), `setAudioInputId(deviceId)` et `setAudioOutputId(deviceId)`.

### [`src/network/ProximityVoiceChat.js`](file:///opt/atelier-dev/src/network/ProximityVoiceChat.js)
- Ajout de `computeRmsMicLevel(samples)`, `refreshDevices()`, écoute et nettoyage propre de `navigator.mediaDevices.ondevicechange`, contraintes `deviceId: { exact }` avec repli automatique en cas de périphérique débranché.
- Ajout de `setInputDevice(deviceId)` : réacquisition de flux `getUserMedia` et remplacement à chaud sur tous les pairs WebRTC actifs via `RTCRtpSender.replaceTrack` sans couper la session multijoueur.
- Ajout de `setOutputDevice(deviceId)` et `isOutputSelectionSupported()` : application dynamique de `setSinkId` sur tous les éléments `<audio>` des pairs spatiaux et sur `audioCtx` (avec repli `MediaStreamAudioDestinationNode` et message d’état si non supporté).
- Ajout de `startMicTest()`, `stopMicTest()`, `sampleMicLevel()` et `dispose()` pour alimenter le vu-mètre en temps réel sans fuite de ressources.

### [`index.html`](file:///opt/atelier-dev/index.html), [`src/styles/main.css`](file:///opt/atelier-dev/src/styles/main.css), [`src/ui/HudManager.js`](file:///opt/atelier-dev/src/ui/HudManager.js) & [`src/main.js`](file:///opt/atelier-dev/src/main.js)
- Ajout dans `.hud-actions` du bouton `#btn-audio-settings` (`🎧 Audio`) à côté de `#btn-voice-toggle` et du popover `#audio-settings-popover` contenant `#audio-input-select`, le vu-mètre temps réel (`#audio-mic-meter-fill`, `#btn-audio-mic-test`), `#audio-output-select`, `#audio-output-status` et `#audio-hud-sfx-toggle`.
- Ajout du bouton `#btn-debug-vr-panel` dans `#debug-tools-panel` et câblage complet dans `HudManager` et `src/main.js` (y compris `vrManager.setPrivateDebug(isDebugRoom)` au démarrage/sortie de session).

### [`src/world/AvatarBuilder.js`](file:///opt/atelier-dev/src/world/AvatarBuilder.js)
- Dans `attachRemoteVrVisuals`, correction de `placeArmSpan` utilisant `bodyYaw = avatar.group.rotation.y - Math.PI` et `outDir` `(sideSign * 0.26, -0.38, 0.14)` pour aligner exactement épaule gauche → main gauche et épaule droite → main droite sans croisement devant le torse.
- Réorientation de `remoteWatch` sur le côté dorsal/radial du poignet gauche (`position.set(0.026, 0.024, 0.048)`, `rotation.set(0.18, 0, -0.73)`).
- Exposition de `leftArmSeg` et `rightArmSeg` dans l’objet retourné par `attachRemoteVrVisuals`.

### [`src/vr/VRManager.js`](file:///opt/atelier-dev/src/vr/VRManager.js) & [`src/vr/VRHudPanel.js`](file:///opt/atelier-dev/src/vr/VRHudPanel.js)
- Repositionnement ergonomique de `this.wristPanel.group` sur `slots.left.hand.root` à `(0.032, 0.036, 0.058)` avec base `(-Z, -X, +Y)`, roulis radial de `-42°` autour de l’avant-bras et inclinaison de `-14°` vers le joueur ; ajustement de la pose d’inspection PC `simWatchInspect` (`(-0.14, -0.14, -0.34)`, `(-0.052, -1.187, -0.808)`).
- Conservation du raycast laser droit sur `this.wristPanel.screenMesh` et ajout de `_updateWristDirectTouch()` pour l’interaction tactile directe avec l’index droit.
- Mise à jour de `updateVisibility` dans `VRHudPanel.js` avec prise en charge optionnelle de `cameraWorldDir` (réveil naturel au regard).
- Masquage par défaut de `debugPanel` (`group.visible = false` dans `createVrDebugPanel`, `isPrivateDebug` et `debugOverlayEnabled` à `false` par défaut), méthodes `shouldShowDebugPanel()`, `setPrivateDebug()`, `setDebugPanelEnabled()` et `toggleDebugPanel()`.

### [`vite.config.js`](file:///opt/atelier-dev/vite.config.js), [`src/ui/ChangelogModal.js`](file:///opt/atelier-dev/src/ui/ChangelogModal.js) & Tests
- Incrémentation vers `v4.17 - Ergonomie CIEL Watch VR, Masquage Panneau Debug, Fix Bras Croisés Multi & Sélecteur Audio`, ajout de l’entrée `v4.17` en haut de `CHANGELOG_RELEASES` et passage de `v4.16` à `'HISTORIQUE'`.
- Adaptation et ajout des tests dans [`tests/vr.test.js`](file:///opt/atelier-dev/tests/vr.test.js), [`tests/voice-chat.test.js`](file:///opt/atelier-dev/tests/voice-chat.test.js) et [`tests/celebration-debug.test.js`](file:///opt/atelier-dev/tests/celebration-debug.test.js).

---

## 🧪 3. Résultats des Tests & Build

Vérifications exécutées après la dernière modification :
- **`node --test --test-force-exit tests/*.test.js` :** `exit code 0` — **64 tests**, **64 réussis**, **0 échec**, 0 ignoré (`9563.85ms`).
- **`npm test` :** `exit code 0` — **64 tests**, **64 réussis**, **0 échec**, 0 ignoré (`9726.42ms`, sans `--test-force-exit`, aucun timer ni socket ouvert).
- **`npm run build` (`vite v6.4.6`) :** `exit code 0` — **51 modules transformés**, build `dist/` terminé en `10.79s` (`dist/admin.html`, `dist/index.html`, `dist/assets/admin-BzkkMmhh.css`, `dist/assets/main-DglBUtOS.css`, `dist/assets/admin-Df5uDrLp.js`, `dist/assets/LabBuilder-D3undD6i.js`, `dist/assets/three-CFxLWJhX.js`, `dist/assets/main-DhhZkSPG.js`).
- **Contrôles de conformité :** `0` occurrence de `"Fortin"`, `0` commentaire ajouté en JS/CSS/HTML, `server/data/map.json` et `server/data/db.json` intacts.

---

## 🎯 4. Guide de Vérification

1. **Sélecteur Entrée / Sortie Audio (HUD) :**
   - Rejoindre une salle, cliquer sur **`🎧 Audio`** dans la barre supérieure à droite de **`Micro coupé`**.
   - Vérifier la liste des microphones et sorties audio détectés, parler pour observer le **vu-mètre** en temps réel, changer de micro pendant une session active (sans reconnexion WebSocket) et changer de sortie audio (casque / enceintes) en vérifiant le comportement si `setSinkId` n’est pas supporté.
   - Brancher/débrancher un périphérique audio et vérifier l’actualisation automatique via `ondevicechange`, puis recharger la page pour vérifier la persistance `localStorage`.
2. **Bras VR non croisés en Multijoueur :**
   - Observer un joueur en Mode VR (ou Simulation VR `F9`) depuis un second client PC/VR sous différents angles (`yaw`) : le bras gauche de l’avatar relie bien son épaule gauche à sa main gauche (portant la montre) et le bras droit son épaule droite à sa main droite, sans jamais se croiser devant le torse.
3. **Ergonomie CIEL WATCH sur Poignet Gauche :**
   - En VR (Quest ou Simulation `F9` + touche `H`), plier légèrement le coude et tourner le poignet gauche : la montre apparaît sur le côté dorsal/radial du poignet gauche avec les textes (`CIEL WATCH`, `PLAN U300`, `Micro OFF`, `Quitter VR`) parfaitement à l’endroit et cliquables au laser ou au toucher.
4. **Masquage par Défaut du Panneau Debug WebXR :**
   - Lancer une session VR depuis une salle standard (`plateau-u300`) : le panneau `DEBUG WEBXR • ATELIER CIEL 3D` est masqué par défaut (`visible = false`).
   - Lancer depuis le **Serveur Privé Debug** (`isPrivateDebug = true`) ou cliquer sur **`🩺 Panneau Debug VR 3D`** dans les outils de debug : le panneau 3D s’affiche et peut être basculé ON/OFF à la demande.
