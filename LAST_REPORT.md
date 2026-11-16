# 📋 Rapport Technique — Atelier CIEL 3D `v4.15`

**Mise à jour :** `v4.15 - Audit WebXR Écran Noir, Panneau Debug VR & Rapport Technique`
**Date :** 16/11/2026
**Objectif :** Identifier et corriger la cause exacte de l'écran noir lors du passage en mode VR WebXR dans Meta Quest Browser (Quest 3S), fiabiliser toute la chaîne de rendu VR, déployer un panneau de diagnostic 3D flottant en VR et systématiser la production de ce rapport technique (`LAST_REPORT.md`).

---

## 🔍 1. Diagnostic & Causes Identifiées

L'audit complet du pipeline WebXR (`src/world/SceneManager.js`, `src/main.js`, `src/vr/`, `src/world/PlayerController.js`, `src/ui/SkinCustomizer.js`, `src/styles/main.css`, `index.html`) et de Three.js (`three@0.174.0`) a mis en évidence **1 cause fatale immédiate** expliquant l'écran noir total à la première frame XR, accompagnée de **5 causes secondaires critiques** affectant le contexte WebGL/XR, la boucle de rendu, le placement du rig et les overlays HTML.

### 1.1 Cause racine fatale (100% reproductible) : Crash Raycaster sur `THREE.Sprite` dès la 1ère frame VR
- **Fichiers & fonctions :** `VRManager._updateSlotRayAndInteract` ([`src/vr/VRManager.js`](src/vr/VRManager.js)) et `pickLabInteractable` ([`src/world/SceneManager.js`](src/world/SceneManager.js)) + `Sprite.prototype.raycast` (`three`).
- **Mécanisme exact :**
  1. Avant `v4.15`, `VRManager._updateSlotRayAndInteract` configurait `this.raycaster.set(this.tempOrigin, this.tempDir)` sans renseigner `this.raycaster.camera`, puis appelait `pickLabInteractable(this.raycaster, list, occluders, 4.8)`.
  2. `pickLabInteractable` exécutait `raycaster.intersectObject(item.mesh, true)` en mode récursif sur toutes les bornes interactives du plateau U300 et sur le Professeur CIEL.
  3. Or, chaque borne TP (via `makeStationLabelSprite` dans `LabBuilder.js`) et le Professeur CIEL (`createLabel` dans `NpcTeacher.js`) contiennent un enfant `THREE.Sprite`.
  4. Dans Three.js r174, `Sprite.prototype.raycast` exécute `if (raycaster.camera === null)` puis lance immédiatement un `console.error` avant de tenter d'accéder à `camera.matrixWorld`, déclenchant un **`TypeError: Cannot read properties of null (reading 'matrixWorld')`**.
  5. Dans `SceneManager.start()`, `vrManager.update(...)` est exécuté dans un `alwaysUpdater` **avant** `this.renderer.render(this.scene, this.camera)`. Sans bloc `try/catch` isolant les updaters ni affectation de `raycaster.camera`, l'exception interrompait la boucle `setAnimationLoop` à la toute première frame VR **avant même qu'un seul appel `renderer.render(...)` ne dessine dans le framebuffer stéréoscopique du Meta Quest 3S** — produisant un écran noir permanent.

### 1.2 Initialisation WebGL2 sans `xrCompatible: true` ni gestion de perte de contexte
- **Fichier & classe :** `SceneManager` ([`src/world/SceneManager.js`](src/world/SceneManager.js)).
- **Problème :** Le `WebGLRenderer` était instancié sans acquisition préalable d'un contexte `webgl2` configuré avec `{ alpha: false, xrCompatible: true }`, et sans méthode `ensureXrCompatible()` ni écouteurs `webglcontextlost` / `webglcontextrestored`. Lors de `renderer.xr.setSession(session)` sur Quest Browser, le basculement tardif via `makeXRCompatible()` après compilation `RoomEnvironment` / `PMREMGenerator` pouvait provoquer un changement d'adaptateur GPU ou une perte silencieuse de contexte WebGL.

### 1.3 Ordre d'activation de session WebXR, double appel potentiel et hauteur fallback `local`
- **Fichiers & méthodes :** `VRManager.enterVr` et `VRManager._activateXrSession` ([`src/vr/VRManager.js`](src/vr/VRManager.js)).
- **Problèmes :**
  1. Le flux précédent appelait `renderer.xr.setSession(session)` pour `'local-floor'`, puis pouvait retenter un second `setSession` sur la même session en cas d'échec ou laisser `session` active sans `teardown` complet en cas d'erreur.
  2. La sonde de support du `ReferenceSpace` n'était pas réalisée avant `renderer.xr.setSession(session)`.
  3. Le fallback `'local'` appliquait un offset `1.62` m au lieu de `1.65` m et ne réinitialisait pas `this.lastXrLocalXZ` au `_teardownSession()`, risquant de conserver un décalage horizontal fantôme lors d'une ré-entrée VR.
  4. Aucun contrôle n'empêchait un `vrRig` bloqué contre un mur/obstacle (ou hors bornes) de démarrer avec la caméra coincée dans une géométrie opaque, ni n'imposait `near = 0.05` / `far >= 180` dès le montage.
  5. Les erreurs `SecurityError` / `NotAllowedError` de `navigator.xr.requestSession` basculaient vers le mode simulation PC au lieu d'être journalisées et signalées proprement.

### 1.4 Boucles `requestAnimationFrame` parallèles & conflits caméra pendant WebXR
- **Fichiers concernés :** `SkinPreview3D` ([`src/ui/SkinCustomizer.js`](src/ui/SkinCustomizer.js)), `animateCameraPose` ([`src/main.js`](src/main.js)), `PlayerController` ([`src/world/PlayerController.js`](src/world/PlayerController.js)).
- **Problèmes :**
  1. `SkinPreview3D._tick` relançait une boucle `requestAnimationFrame` infinie sur ses canvas WebGL de prévisualisation (menu principal & casier), même lorsque `setActive(false)` était appelé (qui remettait uniquement un drapeau booléen à `false` sans `cancelAnimationFrame`), consommant des contextes WebGL parallèles pendant la session XR.
  2. `animateCameraPose()` dans `src/main.js` utilisait un `requestAnimationFrame` autonome qui continuait d'appeler `renderer.render(...)` et de réécrire la matrice caméra si un tween était actif au moment de l'entrée en VR.
  3. `PlayerController.setAvatar()`, `setCameraMode()` et `teleportTo()` appelaient `_applyCamera()` sans vérifier si le mode VR contrôlait la caméra.

### 1.5 Absence d'`AmbientLight`, isolation des `renderTarget` et overlays CSS bloquants
- **Fichiers concernés :** `SceneManager._setupLights` / `SceneManager.start` ([`src/world/SceneManager.js`](src/world/SceneManager.js)), [`src/styles/main.css`](src/styles/main.css), `onEnterVr` ([`src/main.js`](src/main.js)).
- **Problèmes :**
  1. La scène n'avait pas d'`AmbientLight` de secours en complément de `HemisphereLight` et des `DirectionalLight` (si l'environnement PMREM ou les normales posent problème dans un shader mobile WebXR).
  2. `SceneManager.start()` ne vérifiait pas si un `RenderTarget` non-XR restait attaché avant le rendu principal (tout en devant préserver impérativement les renderTargets marqués `isXRRenderTarget` bindés par `WebXRManager.onAnimationFrame`).
  3. Sur DOM 2D miroir et sur certains navigateurs XR injectant des couches DOM, plusieurs modales/overlays HTML (`.overlay-screen`, `.modal-backdrop`, `.intro-cinematic-overlay`, `.ascension-dialogue-overlay`) n'étaient pas systématiquement fermés et masqués au passage en VR via une classe CSS dédiée.
  4. **Correctif bonus Changelog (`src/ui/ChangelogModal.js`) :** `_renderReleases()` supposait que chaque élément de `items` était une chaîne de caractères, ce qui affichait `[object Object]` pour les entrées structurées `{ badge, title, desc }` ajoutées depuis la `v4.14`.

---

## 🛠️ 2. Modifications Appliquées

> Toutes les modifications respectent strictement la règle **zéro commentaire** (JS, CSS, HTML), la **protection de la carte** (aucune modification de géométrie ni de `server/data/db.json`) et le **Lore CIEL** (`Professeur CIEL`).

### [`src/world/SceneManager.js`](src/world/SceneManager.js)
- **Raycaster anti-crash `THREE.Sprite` (`collectNonSpriteMeshes`, `pickLabInteractable`) :** Vérification `Boolean(raycaster.camera)` ; lorsque `raycaster.camera` est absent, fallback automatique sur `collectNonSpriteMeshes(item.mesh)` qui exclut les `THREE.Sprite` de l'intersection.
- **Contexte WebGL2 compatible WebXR :** Création explicite d'un contexte `webgl2` avec `{ alpha: false, depth: true, stencil: false, antialias: true, powerPreference: 'high-performance', xrCompatible: true }` (avec fallback sûr si indisponible), ajout de `ensureXrCompatible()`, `recordXrError(source, err)` et `getXrErrors()`.
- **Écouteurs WebXR & Contexte WebGL :** Ajout de `this._onXrSessionStart`, `this._onXrSessionEnd`, `this._onContextLost` (avec `preventDefault()`) et `this._onContextRestored` ; remise systématique de `renderer.autoClear = true`, `setClearColor('#cfe4f7', 1)`, `customRenderScene = null` et `customStepFn = null` sur `sessionstart`.
- **Éclairage & Frustum VR :** Ajout de `new THREE.AmbientLight('#f8fafc', 0.42)` dans `_setupLights()` ; dans `setVrPresentingState(presenting)`, réglage `camera.near = this.vrPresenting ? 0.05 : 0.1` et `camera.far = Math.max(180, ...)`, et blocage de `_handleResize()` pendant `renderer.xr.isPresenting || this.vrPresenting`.
- **Boucle `renderer.setAnimationLoop` blindée (`start()` & `dispose()`) :** Isolation individuelle par `try/catch` de `celebrationRig.update`, `customStepFn`, chaque `updaters[i]`, chaque `alwaysUpdaters[i]` et `renderer.render(scene, camera)` avec journalisation dans `recordXrError(...)` pour affichage dans le panneau debug VR ; réinitialisation `renderer.setRenderTarget(null)` uniquement si `activeRt && !activeRt.isXRRenderTarget` ; nettoyage complet dans `dispose()`.

### [`src/vr/VRHudPanel.js`](src/vr/VRHudPanel.js)
- **Nouveau Panneau de Debug 3D Flottant VR (`createVrDebugPanel`) :**
  - Canvas haute lisibilité `640x340` mappé sur un `PlaneGeometry(0.68, 0.36)` (`MeshBasicMaterial` non éclairé, `transparent: true`, `opacity: 0.94`, `depthWrite: false`, `side: THREE.DoubleSide`, `renderOrder = 18`).
  - Affiche en temps réel : **XR Presenting** (`OUI (WebXR Actif)` / `SIMULATION PC` / `NON`), **ReferenceSpace** (`local-floor` / `local` / `sim`), **Rig XYZ + Tête Y**, **FPS Moteur**, **FRAME #** (avec voyant pulsant confirmant le rafraîchissement des frames), et **Erreurs WebGL / XR** (bandeau vert si 0 erreur, rouge avec le dernier message capturé sinon).
  - Positionnement doux devant le regard du joueur (`updateTransform(vrRig, camera, dt, snap)`) et rafraîchissement throttlé (`updateState(next, nowMs, force)`), plus `getState()` et `dispose()`.

### [`src/vr/VRManager.js`](src/vr/VRManager.js)
- **Fix critique Raycaster :** Dans `_updateSlotRayAndInteract`, mise à jour de `this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert()` et affectation de `this.raycaster.camera = this.camera` avant tout appel à `pickLabInteractable`.
- **Capture d'erreurs & Télémétrie VR :** Ajout de `this.debugPanel = createVrDebugPanel()` attaché à `this.vrRig`, `this.xrErrors`, `this.frameCount`, `recordError(source, err)`, `getCapturedErrors()`, `_syncDebugPanel(force, nowMs)` et enrichissement de `getPublicState()`.
- **Cycle de vie WebXR fiabilisé :**
  - `enterVr()` active `this.renderer.xr.enabled = true`, isole `_activateXrSession(session)` dans un `try/catch` avec cleanup `session.end()` + `_teardownSession()` en cas d'erreur, et capture `SecurityError`/`NotAllowedError` sans masquer l'erreur.
  - `_activateXrSession(session)` sonde d'abord `'local-floor'` puis bascule sur `'local'` (`xrFloorFallbackOffset = 1.65`) **avant** un unique appel `await this.renderer.xr.setSession(session)`.
  - `handleXrSessionStart()`, `_resolveClearRigPose()` (vérifie bornes + `_collides(x, z)` avec fallback dégagé `{ x: -3.95, z: 0.65 }` au centre du plateau U300), `_mountVrRigForWorld()` (`scale` à `1`, `near = 0.05`, `far >= 180`, placement immédiat du `debugPanel`) et `_teardownSession()` (réinitialisation `this.lastXrLocalXZ.set(0, 0)` et masquage du `debugPanel`).

### [`src/world/PlayerController.js`](src/world/PlayerController.js)
- Ajout de `this.vrModeActive = false` et `setVrMode(active)` pour empêcher `setAvatar()`, `setCameraMode()` et `teleportTo()` d'appeler `_applyCamera()` et d'écraser la caméra WebXR lorsque la VR est active.

### [`src/ui/SkinCustomizer.js`](src/ui/SkinCustomizer.js)
- Correction de `SkinPreview3D.setActive(active)` : annule explicitement `cancelAnimationFrame(this.animId)` et remet `this.animId = null` lors de la désactivation, puis relance `_tick` uniquement à la réactivation — supprimant les boucles `requestAnimationFrame` et rendus WebGL concurrents en arrière-plan pendant la VR.

### [`src/main.js`](src/main.js)
- **Hook `onEnterVr` renforcé :** Incrémente `activeCameraTweenId` pour stopper tout tween caméra, ferme `mainMenu`, `platformModal`, `changelogModal`, `faqModal`, `battlePassModal`, `dialogueModal`, `miniGameModal`, les overlays d'intro/ascension et toutes les modales HUD ; désactive `mainMenu.preview` et `hud.skinPreview` ; applique `document.body.classList.add('vr-presenting')` et `player.setVrMode(true)`.
- **Hook `onExitVr` & gardes :** Retire `vr-presenting`, restaure `player.setVrMode(false)`, bloque `animateCameraPose()` pendant la VR et remonte `vrRig` lors de `onDebugTeleport` en VR.

### [`src/styles/main.css`](src/styles/main.css)
- Attribution explicite de `position: relative; z-index: 1; background: transparent;` sur `#game-canvas`.
- Ajout de la règle `body.vr-presenting` masquant fermement `.overlay-screen`, `.modal-backdrop`, `.intro-cinematic-overlay` et `.ascension-dialogue-overlay` (`display: none !important; pointer-events: none !important;`).

### [`vite.config.js`](vite.config.js) & [`src/ui/ChangelogModal.js`](src/ui/ChangelogModal.js)
- Passage de `__APP_VERSION__` et `APP_VERSION` à `'v4.15 - Audit WebXR Écran Noir, Panneau Debug VR & Rapport Technique'`.
- Ajout de l'entrée `v4.15` (`16/11/2026`, tag `'DERNIÈRE MÀJ'`) en tête de `CHANGELOG_RELEASES` et passage de `v4.14` au tag `'HISTORIQUE'`.
- Amélioration de `ChangelogModal._renderReleases()` pour formater proprement les items objets `{ badge, title, desc }` en HTML (badge stylé, titre en gras et description) en plus des chaînes simples.

### [`tests/vr.test.js`](tests/vr.test.js) & [`tests/celebration-debug.test.js`](tests/celebration-debug.test.js)
- Ajout de 3 nouveaux tests automatisés dans `tests/vr.test.js` :
  1. `v4.15 : pickLabInteractable et VRManager raycastent sans crash sur des bornes contenant THREE.Sprite`
  2. `v4.15 : SceneManager garantit boucle WebXR unique, éclairage complet, clearColor jour et isolation des erreurs`
  3. `v4.15 : VRManager gère session WebXR local-floor (y=0), fallback local (y=1.65), spawn dégagé et panneau debug 3D`
- Mise à jour des assertions de version `v4.15` / `v4.14` / `v4.12` dans `tests/celebration-debug.test.js`.

---

## 🧪 3. Résultats des Tests & Build

Toutes les vérifications ont été exécutées **après** la dernière modification du code, sans aucun test ignoré ni timer/socket résiduel bloquant :

| Commande exécutée | Résultat | Détails observés |
| --- | --- | --- |
| `npm test` (`node --test tests/*.test.js`) | ✅ **SUCCÈS** (`exit code 0`) | **60 tests**, **60 réussis**, **0 échec**, 0 ignoré, durée `9714.44ms` |
| `node --test --test-force-exit tests/*.test.js` | ✅ **SUCCÈS** (`exit code 0`) | **60 tests**, **60 réussis**, **0 échec**, 0 ignoré, durée `9150.01ms` |
| `npm run build` (`vite v6.4.6`) | ✅ **SUCCÈS** (`exit code 0`) | `50 modules transformed`, build `dist/` terminé en `10.59s` |

**Artefacts générés par `vite build` :**
- `dist/admin.html` (`14.48 kB` │ gzip `3.62 kB`)
- `dist/index.html` (`56.17 kB` │ gzip `11.69 kB`)
- `dist/assets/admin-DnCCAKf8.css` (`19.03 kB` │ gzip `4.48 kB`)
- `dist/assets/main-D0e0-hBG.css` (`92.87 kB` │ gzip `19.04 kB`)
- `dist/assets/admin-DeVyDmsM.js` (`90.20 kB` │ gzip `24.31 kB`)
- `dist/assets/LabBuilder-BZdg-RcA.js` (`155.84 kB` │ gzip `46.77 kB`)
- `dist/assets/three-D_Xx5LGZ.js` (`523.72 kB` │ gzip `132.74 kB`)
- `dist/assets/main-CuNViwfk.js` (`565.14 kB` │ gzip `175.42 kB`)

---

## 🎯 4. Vérification & Points d'Attention

### Comment tester sur Meta Quest 3S (et en Simulation VR PC)
1. **Démarrer le serveur et servir en HTTPS** (obligatoire pour `navigator.xr` sur Meta Quest Browser depuis un poste distant, ou via tunnel HTTPS / certificat local) puis ouvrir l'application dans le navigateur du **Meta Quest 3S**.
2. Rejoindre le plateau U300 puis cliquer sur le bouton **« Mode VR »** (interaction directe requise par l'API WebXR pour l'activation utilisateur).
3. **Vérifier visuellement dans le casque :**
   - La salle U300 s'affiche immédiatement en plein éclairage jour (aucun écran noir).
   - Juste devant et légèrement au-dessus de la ligne de regard apparaît le **panneau flottant `🩺 DEBUG WEBXR • ATELIER CIEL 3D`** affichant :
     - `XR Presenting : OUI (WebXR Actif)`
     - `ReferenceSpace : local-floor` (ou `local` si le guardian n'a pas de plancher calibré)
     - `Rig XYZ` cohérent avec `Y: 0.00` (`local-floor`) ou `Y: 1.65` (`local`) et `Tête Y` dynamique lorsque vous bougez la tête
     - `FPS Moteur` et un compteur `FRAME #...` qui s'incrémente en continu
     - Bandeau vert `✅ Erreurs WebGL / XR : Aucune erreur capturée`
4. **Pointer avec les contrôleurs (ou mains en Hand-Tracking) vers une borne TP et vers le Professeur CIEL** : le rayon laser surligne la borne et déclenche le panneau spatial sans bloquer le rendu.
5. **Test rapide sur PC (sans casque) :** appuyer sur **`F9`** (ou passer par « Simulation VR ») pour vérifier le panneau debug flottant, la montre poignet gauche (`H`) et les interactions laser.

### Points d'attention si un symptôme persiste dans le casque
- **Si l'écran du casque reste noir sur une scène donnée :** vérifier via le miroir/inspecteur USB `chrome://inspect` si la console signale `WebGL context lost` (cas d'un onglet Quest ayant saturé la mémoire GPU avec d'autres onglets ouverts) ou une erreur `[render]` / `[alwaysUpdater:...]` désormais capturée sans planter la boucle.
- **Si `ReferenceSpace : local` apparaît et que vous êtes trop bas/haut :** recalibrer le niveau du sol Guardian dans Quest OS (ce qui rétablit `local-floor`), sinon le rig applique automatiquement le fallback `y = 1.65`.
- **Si `Mode VR` affiche une alerte d'autorisation WebXR :** vérifier que la page est chargée en **HTTPS** et que l'entrée en VR provient bien d'un clic utilisateur direct (jamais d'un appel différé sans geste).
