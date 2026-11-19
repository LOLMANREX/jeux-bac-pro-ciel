# Rapport Technique — v4.32 : Map Géante Multi-Étages, Escaliers 3D & Moteur de Culling Intelligent dans le Champ de Vision

Date : 19/11/2026  
Version : `v4.32 - Map Géante Multi-Étages, Escaliers 3D & Culling Champ de Vision`

---

## 1. Extension du Format de Map & Architecture Multi-Étages (`src/world/mapSchema.js`, `src/world/LabBuilder.js`, `server/`)

1. **Extension des limites et étages (`-1` à `+5`)** :
   - Passage de `MAX_MAP_SIZE` à `240` (`240 m × 240 m`), `MIN_FLOOR = -1` (Sous-sol), `MAX_FLOOR = 5` (`R+5`), `DEFAULT_FLOOR_HEIGHT = 3.8` m et `SLAB_THICKNESS = 0.22` m.
   - Support natif du champ `floor` sur les murs, zones, objets, ouvertures (`openings`), et `spawn`, ainsi que de `floors` (avec `index`, `label`/`name`, `hasFullSlab`, `hasCeiling`) et `floorHeight`.
   - **Rétrocompatibilité absolue** : toute carte sans propriété `floor` (notamment `createDefaultMap()` / Plateau U300 et `server/data/map.json`) est normalisée proprement sur l’étage `0` (RDC) avec hauteur `4.6 m` par défaut, zéro décalage et zéro perte de données.

2. **Dalles, Trémies Automatiques, Escaliers 3D & Éléments de Lycée** :
   - **Dalles et plafonds découpés par trémies** : `computeEffectiveFloorOpenings()` agrège les ouvertures manuelles (`slab_opening`) et les trémies automatiques générées à l’étage supérieur par chaque escalier (`autoOpening !== false`). `computeSlabRectangles()` soustrait exactement chaque trémie et cour extérieure (`outdoor`) des dalles et des plafonds/éclairages (`LabBuilder.js`), tout en générant des margelles propres autour des ouvertures.
   - **Escaliers 3D paramétrables** (`computeStairGeometry` & `buildStaircaseMeshGroup`) :
     * `stair_straight` (Escalier Droit), `stair_l` (Quart tournant en L avec palier intermédiaire), `stair_u` (Double volée en U avec palier et séparation centrale).
     * Marches 3D visibles, paliers porteurs, garde-corps et rampes latérales activables (`hasRailings`), sens de rotation (`turnDir`), orientation `0°/90°/180°/270°` (et angle libre), choix `floor -> targetFloor` (montée ou descente vers Sous-sol `-1` avec placement correct du garde-corps haut côté extrémité profonde).
   - **Éléments de lycée** : `wall_exterior` (façade épaisse, occludeur enregistré dans le culling), `wall_window_bay` (grande baie vitrée à meneaux), `railing_guard` (garde-corps vitré de mezzanine), `pillar_column` (poteau structurel), `floor_slab` (dalle sur mesure / mezzanine), `slab_opening` (trémie manuelle) et `courtyard_zone` (zone extérieure cour sans plafond ni occlusion intérieure).

3. **Capacité Serveur & Persistance** :
   - Augmentation de la limite de payload HTTP `express.json({ limit: '20mb' })` dans `server/index.js` et `maxPayload: 20 * 1024 * 1024` dans `server/wsHub.js` pour supporter la sauvegarde et la diffusion WebSocket de grandes maps JSON multi-étages.

---

## 2. Refonte de l’Éditeur de Map (`src/admin/MapEditor.js`, `src/admin/admin.css`)

- **Barre de gestionnaire d’étages (`#me-floor-bar`)** :
  - Pilules de sélection rapide des étages (`SS (-1)`, `RDC`, `R+1`...`R+5`), boutons `+ Ajouter un étage` et `+ Sous-sol`, case à cocher `Dalle complète` (mezzanine partielle vs dalle pleine) et filtre d’aperçu 3D (`3D : Jusqu'à l'étage`, `3D : Étage actif seul`, `3D : Tous les étages`).
  - **Calque Fantôme (Onion Skinning)** (`#me-btn-onion`) : bascule en 1 clic (`Dessous`, `Dessus + Haut`, `Dessus`, `Off`) affichant en filaire semi-transparent les murs et escaliers des niveaux adjacents pour aligner trémies et murs porteurs.
  - **Duplication de structure (`#me-btn-dup-floor` / `duplicateFloorStructure`)** : copie en 1 clic les murs, zones intérieures et poteaux vers l’étage supérieur.
- **Navigation Grande Surface & Productivité** :
  - Plage de zoom 2D élargie jusqu’à `0.8` pour englober `240 m × 240 m`, grille dynamique adaptative et **mini-plan interactif** (`#me-minimap-canvas`) avec déplacement panoramique au clic/glisser.
  - **Tracé continu de murs** (`wallChainLastPt` + aperçu pointillé cyan + aimantation aux extrémités `_snapToWallEndpoint`), **sélection rectangulaire par zone (`marquee`)** avec déplacement groupé, rotation `90°` (`R`), duplication (`Ctrl+D`) et suppression groupée.
  - Inspecteur complet pour les escaliers (étage d’implantation, étage d’arrivée, nombre de marches, sens tournant, trémie auto N+1, rampes, boutons cardinaux `0°/90°/180°/270°`) et visualisation 2D des trémies automatiques (`TRÉMIE`).

---

## 3. Physique des Escaliers, VR Quest 3S & Synchronisation Verticale (`PlayerController.js`, `VRManager.js`, `RemotePlayers.js`, `PetBuilder.js`, `wsHub.js`)

- **Rampes inclinées lisses & gravité multi-étages (`buildWalkableSurfaceData`, `evaluateSurfaceAt`, `getCeilingHeightAt`)** :
  - Chaque escalier génère des plans de marche inclinés continus (`flights`) et paliers associés à une détection de hauteur par étage (`PlayerController._updateVerticalPhysics`) : montée et descente sans secousse ni tremblement de caméra, sauts bornés par la sous-face du plafond (`getCeilingHeightAt`), gravité propre au-dessus des trémies et collisions 3D filtrées verticalement (`minY`/`maxY` sur `PlayerController._collides` et `SurvivalEngine.pointCollidesWithColliders`).
- **Compatibilité VR WebXR (Meta Quest 3S)** :
  - Suivi fluide au joystick de la rampe d’escalier (`VRManager._stabilizeFloor` interpolant sur `player.getFeetY()` sans écraser la chute libre ni provoquer de double pas physique dans `_updateLocomotion`/`setVrPose`).
  - **Téléportation parabolique multi-étages** (`VRManager.computeVrTeleportTarget` + `executeVrTeleport` + arc/anneau 3D pré-alloué) détectant les marches, paliers, rampes et dalles supérieures.
- **Synchronisation Multijoueur Verticale (`network.js`, `server/wsHub.js`, `RemotePlayers.js`, `PetBuilder.js`, `PlateauMiniMap.js`, `NpcTeacher.js`)** :
  - Validation et diffusion WebSocket des coordonnées `y` (`-10..40`) et `floor` (`-1..5`), suivi vertical fluide des avatars distants et de leurs **Pets 3D** (y compris lors d’un changement d’étage sans déplacement horizontal), support multi-étages des PNJ/bornes/zones et affichage des joueurs d’autres étages en semi-transparence avec badge `R+N` sur la minimap.

---

## 4. Moteur de Partitionnement Spatial & Culling FOV Temps Réel (`src/world/SpatialCulling.js`, `src/world/LabBuilder.js`, `src/main.js`, `src/ui/HudManager.js`, `index.html`)

- **Découpage en Chunks 3D par étage (`16 m × 16 m × étage`)** :
  - `LabBuilder` regroupe automatiquement dalles (découpées aux frontières de chunks), plafonds, rampes LED (instanciées par chunk), murs (segmentés à ≤ 14 m), escaliers et mobiliers en `chunk.structureGroup` et `chunk.detailGroup`, avec `Box3` englobante pré-calculée et `matrixAutoUpdate = false`, plus batching `InstancedMesh` par chunk.
- **Pipeline de Culling à Zéro Allocation (`SpatialCullingEngine.update`)** :
  1. **Frustum Culling Strict** (`THREE.Frustum` + `THREE.Matrix4` pré-alloués, tolérance stéréo `+0.75 m` en VR) : tout chunk hors champ de vision passe à `visible = false`.
  2. **Distance Culling & LOD par catégorie** (`CULLING_QUALITY_PROFILES` : `potato`, `eco`, `balanced`, `high`) : distance d’affichage étendue pour la structure (`structureDist`) et réduite pour le mobilier/détails (`detailDist`).
  3. **Culling par Étage & Occlusion par Murs Opaques** (`isChunkOccludedByWalls`) : en intérieur, masque les chunks éloignés verticalement (`|Δfloor| >= 2`), masque les détails (`detailGroup`) des autres étages derrière des dalles pleines (tout en préservant cours extérieures et cages d’escalier/trémies), et masque les chunks entièrement occultés par des murs opaques (`solid`/`exterior`).
  4. **Mise en veille automatique des animations & `CanvasTexture`** : lorsque `chunk.visible` ou `chunk.detailsVisible` est faux, `LabBuilder.update()` saute les anneaux, LEDs, PNJ et écrans `CIEL OS` (`sleepMode = true`, zéro upload GPU), et `SpatialCullingEngine` est exécuté juste avant `lab.update()` dans `src/main.js`.
- **Grille Spatiale `O(1)` (`SpatialHash`)** :
  - Collisions joueur (`queryColliders`), interactions `[E]` (`queryInteractables`), surfaces tactiles PC (`getActiveWorldSurfaces`) et occludeurs de raycast (`queryOccluders` / `queryOccludersAt`) ne testent que les cellules locales de l’étage courant.
- **Mini Moniteur de Performance (`index.html`, `src/ui/HudManager.js`)** :
  - Ajout de `Chunks: visibles/total` (`#perf-mon-chunks`) et `Étage: RDC / R+N / SS` (`#perf-mon-floor`) mis à jour via cache DOM différentiel.

---

## 5. Bilans Chiffrés Mesurés & Validation Automatisée

### Mesures réelles (`buildLabWorld` + `SpatialCullingEngine` + `SpatialHash`)

| Métrique mesurée | Scénario Lycée 240×240 (5 étages `-1..+3`, 221 murs, 3 escaliers) | Gain |
| :--- | :---: | :---: |
| Chunks spatiaux `16m×16m×étage` générés | **1 280 chunks** | Partitionnement complet |
| Chunks rendus en vue caméra (Qualité `Élevée`) | **185 / 1 280** (853 frustum, 168 étage, 74 occlusion ; **11** détails) | **−85,5 % chunks rendus** |
| Chunks rendus en vue caméra (Qualité `Ultra-Fluide`) | **49 / 1 280** (1 020 distance, 163 frustum, 36 étage, 12 occlusion ; **5** détails) | **−96,2 % chunks rendus** |
| Colliders testés par pas joueur (`SpatialHash`) | **3 / 237 colliders** | **−98,7 %** (`O(1)`) |
| Murs occludeurs testés en raycast (`queryOccludersAt`) | **4 / 224 murs** | **−98,2 %** (`O(1)`) |
| Rétrocompatibilité Plateau U300 (`createDefaultMap`) | **4 / 4 chunks**, **64 `InstancedMesh` (619 instances)**, **15 PC CIEL OS** | **100 % préservé** |
| Fichiers protégés `server/data/map.json` & `server/data/db.json` | **0 octet modifié** | **100 % intact** |

### Suite de tests & Build

- **Nouvelle suite dédiée (`tests/multifloor-culling.test.js`)** : 6 suites complètes vérifiant la rétrocompatibilité U300 & la protection de `server/data/`, la map géante `240×240` multi-étages avec trémies auto `N+1` et duplication d’étage, la physique fluide des escaliers (droit, L, U, descente Sous-sol `-1`, chute par gravité dans une trémie ouverte, téléportation VR et tracking rig), `SpatialCullingEngine` (frustum, occlusion, étages, LOD, pause `CanvasTexture` et `SpatialHash`), la synchronisation WebSocket verticale (`y`, `floor` et Pets 3D), et les indicateurs UI/éditeur.
- **Validation complète** :
  - `node --test --test-force-exit tests/*.test.js` : **136 / 136 tests passés (0 échec)**.
  - `npm test` : **136 / 136 tests passés (0 échec)**.
  - `npm run build` : **build Vite production réussi sans erreur** (`dist/` généré pour `index.html` et `admin.html`).
  - Audit strict des règles dépôt : **0 commentaire** dans les fichiers `.js`/`.css`/`.html` modifiés ou créés, **0 occurrence** interdite, version `v4.32` cohérente dans `vite.config.js` et `src/ui/ChangelogModal.js`.
