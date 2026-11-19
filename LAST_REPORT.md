# Rapport Technique — v4.31 : Optimisation Extrême FPS, Élimination Totale des Freezes & Fluidité Maximale PC / Mobile / VR

Date : 19/11/2026  
Version : `v4.31 - Optimisation Extrême FPS, Élimination Totale des Freezes & Fluidité Maximale PC / Mobile / VR`

---

## 1. Synthèse de l’Audit & Goulots d’Étranglement Identifiés

Un audit complet du moteur 3D Three.js, de la boucle de rendu, des lumières, des textures dynamiques, de l’UI DOM, du réseau et du mode WebXR (Meta Quest 3S) a mis en évidence 9 goulots d’étranglement majeurs :

1. **Absence totale de culling entre zones (Atelier / Arène de Combat / Survie / Colle)** : les 3 mondes (`lab`, `combatArena`, `survivalArena`) restaient `visible = true` en permanence. En étant dans l’atelier principal, le GPU évaluait aussi les géométries et les **10 `PointLight`** des poches Combat & Survie ; en Arène de Combat, les ~980 meshes et les 15 écrans `CIEL OS` de l’atelier continuaient d’être mis à jour et soumis au rendu.
2. **Explosion des draw calls dans l’atelier (`LabBuilder.js`) et l’Arène (`CombatArena3D.js`)** : `buildLabWorld` générait **980 meshes individuels** (971 géométries distinctes, 291 matériaux distincts, 23 murs occludeurs séparés) et `CombatArena3D` créait 52 meshes distincts pour les 14 obstacles, bordures et LEDs.
3. **Freezes de recompilation de shaders liés aux `PointLight` dynamiques** : chaque avatar Créateur, Divin ou Cosmique (`AvatarBuilder.js`) et le Professeur CIEL Horreur (`NpcTeacher.js`) ajoutaient des `THREE.PointLight` dynamiques dans la scène. Chaque connexion ou changement de skin modifiait `#define NUM_POINT_LIGHTS`, forçant WebGL à recompiler tous les shaders de la scène (stutters de 300 ms à 1,5 s).
4. **Saccade périodique toutes les 2 secondes sur les 15 écrans `CIEL OS`** : les 15 postes PC (`1024×640`) démarraient synchronisés sur le même cycle de rafraîchissement (`2 s`), déclenchant jusqu’à ~39 Mo d’uploads `CanvasTexture` sur une seule et même frame.
5. **Matériaux vitrés `MeshPhysicalMaterial` (clearcoat + IOR) très lourds sur mobile/Quest 3S** (`RealisticMaterials.js`) et textures PBR 1024×1024 même sur mobile/VR.
6. **Allocations mémoire et traversées coûteuses dans la boucle `requestAnimationFrame`** :
   - `pickLabInteractable` raycastait les triangles de tous les interactables sans pré-filtrage par distance et recréait les tableaux de meshes à chaque appel.
   - `PlayerController._collides` et `SurvivalEngine.pointCollidesWithColliders` parcouraient linéairement l’ensemble des ~92 colliders à chaque pas.
   - `CombatArena3D.updateArena` allouait `new Set()` à chaque frame ; `CombatEngine.raycastAabb3D` allouait un tableau 2D à chaque rayon ; `VRManager` allouait `new THREE.Vector3()` sur les interactions ; `RemotePlayers.getMiniMapPeers` recréait tableaux et objets 20 fois/s.
7. **Absence de pré-compilation des shaders (`renderer.compile`)** provoquant un micro-freeze à la première apparition d’une zone, arme ou pet.
8. **DOM Thrashing massif dans `HudManager.js` et boucle VR** : `updateCombatHud` reconstruisait `innerHTML` + listeners des slots d’armes et du killfeed à chaque snapshot ; `updateCombatCrosshair` et `setInteractPrompt` mutaient `classList`/`textContent`/`style` à 60 FPS ; `syncVrWatchHud` et la minimap DOM tournaient inutilement à haute fréquence en VR ; `VRHudPanel.updateState` redessinait la montre VR sans throttling sur les objets imbriqués.
9. **Fuites potentielles sur les aperçus 3D secondaires et timers serveur** : `RoomEnvironment` non libéré et listeners `window` non retirés dans `ShopPreview3D`, `LockerPreview3D` et `SkinPreview3D` ; `combatTickInterval` et `combatResetTimers` non nettoyés sur `wss.on('close')` dans `server/wsHub.js`.

---

## 2. Optimisations Appliquées par Chantier

### Chantier 1 — Anti-Stutter, Zéro Allocation, Pré-compilation & Textures Dynamiques
- **`src/world/SceneManager.js`** :
  - Pré-compilation des shaders au démarrage via `precompileShaders()` (`renderer.compile(this.scene, this.camera)`).
  - Réutilisation des matériaux dans `createWorldCelebrationRig` (6 matériaux partagés au lieu de 252).
  - `pickLabInteractable` sans allocation avec pré-filtrage rapide `distanceToSquared`, mise en cache des meshes non-sprites (`__nonSpriteMeshes`) et bornage `raycaster.far = bestHit.distance` sur les murs occludeurs.
- **`src/world/PetBuilder.js`** : cache global partagé `SHARED_PET_GEOM_CACHE` / `SHARED_PET_MAT_CACHE` (`getSharedPetAssetStats()`) évitant toute création de géométrie/matériau lors de l’apparition ou du changement de Pet 3D.
- **`src/world/PlayerController.js` & `src/world/SurvivalEngine.js`** : grille spatiale 2D (cellules 4 m × 4 m) pour `_collides` et `pointCollidesWithColliders` + réutilisation d’objet retour `_stepResultScratch`.
- **`src/world/CombatEngine.js`, `src/world/CombatArena3D.js`, `src/world/RemotePlayers.js`, `src/vr/VRManager.js`** : déroulement sans allocation de `raycastAabb3D`, `_activeBotIds` et `_miniMapScratch` pré-alloués, `_planePtScratch` en VR, saut complet des pairs masqués.
- **`src/minigames/CielOsDesktop.js` & `src/world/LabBuilder.js`** :
  - Échelle de rendu adaptative `renderScale` (`0.5` = `512×320` sur mobile/VR/Éco/Ultra-Fluide avec `ctx.setTransform` préservant 100 % des coordonnées logiques `1024×640`).
  - Décalage de phase des 15 postes PC et **budget strict d’1 seul upload `CanvasTexture` idle par frame** (round-robin), pause complète au-delà de 14 m ou hors champ caméra (`distSq > 196`) et mise en veille totale lorsque l’atelier est masqué.
- **`src/world/CombatArena3D.js`, `src/world/SurvivalArena3D.js`, `src/vr/VRHudPanel.js`** : signatures dirty-flag sur tous les tableaux/écrans dynamiques, cache des segments de murs `subtractDoorsFromWalls` en vidéosurveillance, throttling strict de la montre VR à ~6 FPS (`165 ms`).
- **`src/ui/ShopModal.js`, `src/ui/LockerModal.js`, `src/ui/SkinCustomizer.js`** : arrêt garanti de `requestAnimationFrame` à chaque `close()`, pause sur `document.hidden`, DPR plafonné (`1.15` mobile / `1.5` PC), `roomEnv.dispose()`, suppression propre de tous les listeners `window` et ajout de `SkinPreview3D.dispose()`.

### Chantier 2 — Réduction Massive des Draw Calls & Culling Exclusif par Zone
- **`src/world/LabBuilder.js`** : batching statique automatique de **620 boîtes statiques** en **27 `THREE.InstancedMesh`** (tous avec `matrixAutoUpdate = false`), déduplication des matériaux statiques simples, et fusion des **23 murs solides occludeurs en 3 `InstancedMesh`**. Exposition de `worldGroup`, `setVisible()`, `setQualityProfile()` et `getRenderStats()`.
- **`src/world/CombatArena3D.js`** : conversion des 14 obstacles, 14 bordures néon, 24 LEDs de baies et 4 rampes plafond en **6 `THREE.InstancedMesh`** (`matrixAutoUpdate = false`), géométries/matériaux partagés sur les consoles et pickups, séparation `waitingGroup` / `arenaStaticGroup` et exposition de `setZoneVisibility()`.
- **`src/world/SurvivalArena3D.js`** : séparation `waitGroup` / `detGroup` avec `setZoneVisibility()`.
- **`src/main.js`** : culling exclusif piloté par `computeZoneVisibility(mode)` (`applyActiveZoneCulling`) à l’initialisation et à chaque `teleportWithWorldMode` :
  - **Atelier (`hall`)** : `lab` visible, `combatArena` et `survivalArena` totalement masqués.
  - **Lobby / Arène Combat (`combat_waiting`, `combat_arena`)** : `lab` et `survivalArena` totalement masqués (et `lab.update()` désactivé).
  - **Lobby Survie / Salle de Colle (`waiting`, `detention`)** : `lab` et `combatArena` masqués (en Salle de Colle, `lab` n’est réaffiché temporairement que durant `renderToTarget` de la caméra POV Live dans un bloc `try/finally`).

### Chantier 3 — Lumières Temps Réel, PC / Mobile / VR Quest 3S & Qualité Adaptative
- **Audit et réduction drastique des `PointLight` temps réel** :
  - `AvatarBuilder.js` : 3 `PointLight` dynamiques (Créateur / Divin / Cosmique) remplacées par des halos émissifs additifs légers (**0 `PointLight` sur les avatars**).
  - `NpcTeacher.js` : `PointLight` du Professeur CIEL Horreur remplacée par un halo émissif au sol.
  - `CombatArena3D.js` : **5 `PointLight` supprimées** (remplacées par rampes émissives + ambiance équilibrée `setCombatAtmosphere`).
  - `SurvivalArena3D.js` : réduction de **5 à 1 seule `PointLight`** (uniquement active en Salle de Colle).
  - `RealisticMaterials.js` : remplacement des 2 `MeshPhysicalMaterial` (clearcoat/IOR) par `MeshStandardMaterial` allégé + résolution réduite (`512`/`256`) sur mobile/VR et regroupement des textures murales en 3 paliers.
  - `VRHandBuilder.js` : `castShadow = false` sur les 5 segments articulés des mains VR.
- **WebXR Meta Quest 3S (`SceneManager.js` & `VRManager.js`)** :
  - Activation du rendu fovéal `renderer.xr.setFoveation(1.0)`.
  - Configuration de `renderer.xr.setFramebufferScaleFactor` par preset qualité (`0.72` Ultra-Fluide, `0.82` Éco, `0.9` Équilibré, `1.0` Élevé) avant `setSession`.
  - Ombres dynamiques allégées/désactivées automatiquement en VR hors preset Élevé, et **zéro écriture DOM** (minimap, crosshair, prompt, perf monitor) pendant les sessions WebXR.
- **Vrais Préréglages Qualité + Garde-FPS Automatique + Mini Moniteur** (`index.html`, `src/core/gameState.js`, `src/world/SceneManager.js`, `src/ui/HudManager.js`) :
  - 5 presets efficaces en direct : `Auto`, `Élevée`, `Équilibrée`, `Éco — PC Lycée`, `Ultra-Fluide / Patate` (agissant sur DPR, ombres, taille de shadow map, distance d’affichage `camera.far`/`fog.far`, budget particules VFX, fréquence des `CanvasTexture` et échelle VR).
  - **Garde-FPS Automatique** (`#set-fps-guard`) abaissant progressivement `dynamicResolutionScale` (jusqu’à `0.65`) et la charge particules/textures en cas de chute durable sous 42 FPS (32 mobile / 58 VR), puis remontant en douceur dès le retour de la fluidité.
  - **Mini Moniteur de Performance** optionnel (`#set-perf-monitor` -> `#perf-monitor-hud`) affichant en direct `FPS`, `Temps frame (ms)`, `Draw Calls` et `Triangles`.

### Chantier 4 — DOM, Réseau & Anti-Fuites
- **`src/ui/HudManager.js`** : cache DOM `_domCache` généralisé sur `setInteractPrompt`, `updateCombatHud` (mode, chrono, score, PV, barre, munitions, reconstruction des slots d’armes uniquement au changement d’arme/mode et killfeed uniquement sur changement), `updateCombatCrosshair`, `updateSniperScope`, `updateDebugStats` et `updatePerfMonitor`.
- **`server/wsHub.js`** : nettoyage complet de `combatTickInterval` et `combatResetTimers` ajouté sur `wss.on('close')`.
- **`src/core/network.js` & `src/main.js`** : déduplication des paquets VR identiques dans `sendMove`, limitation de la synchro montre VR et raycast tactile à 10 Hz, et nettoyage strict des intervalles et aperçus 3D sur `beforeunload`.

---

## 3. Bilans Chiffrés (Mesurés Avant → Après)

| Métrique | Avant (v4.30) | Après (v4.31) | Gain |
| :--- | :---: | :---: | :---: |
| Meshes / Draw Calls statiques Atelier (`LabBuilder`) | **980** | **396** (27 `InstancedMesh` = 620 instances) | **−59,6 % (−584 draw calls)** |
| Géométries distinctes Atelier | **971** | **372** | **−61,7 %** |
| Murs solides occludeurs testés en raycast | **23** | **3 `InstancedMesh`** | **−87,0 %** |
| Obstacles / néons / LEDs Arène Combat | **52 meshes** | **6 `InstancedMesh`** | **−88,5 %** |
| `PointLight` temps réel actives simultanément (Atelier + Avatars + Poches) | **14+** (10 poches + N avatars + prof) | **0** en Atelier / **0** en Arène / **1** en Colle | **−93 % à −100 %** |
| Uploads `CanvasTexture` CIEL OS idle sur une même frame | Jusqu’à **15 / frame** (~39 Mo) | **Max 1 / frame** (et 4× plus léger en mobile/VR) | **−93 % pic GPU** |
| Écritures DOM HUD à état constant (crosshair + prompt + combat) | **~300+ / sec** | **0 / sec** (cache différentiel) | **−100 % DOM thrashing** |
| Intégrité `server/data/map.json` & `server/data/db.json` | Intacts | **Intacts (0 octet modifié)** | **100 % préservé** |

---

## 4. Validation Automatisée & Build

- Suite dédiée ajoutée : `tests/performance-opt.test.js` (7 suites de tests couvrant culling de zones, instancing & `matrixAutoUpdate=false`, 0 `PointLight` parasite, throttling `CanvasTexture`, arrêt des boucles Boutique/Casier, presets Qualité + Garde-FPS + Foveation VR, raycast/collisions/DOM cache et zéro timer orphelin).
- Validation complète : `node --test --test-force-exit tests/*.test.js` (130/130 tests passés) et `npm run build` (build Vite production sans aucune erreur).
