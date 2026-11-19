# Rapport Technique — v4.33 : Map Campus Immense jusqu'à 2000m × 2000m, Éditeur Virtualisé & Chunks Dynamiques Sparse

Date : 19/11/2026  
Version : `v4.33 - Map Campus Immense jusqu'à 2000m × 2000m, Éditeur Virtualisé & Chunks Sparse`

---

## 1. Déblocage Total des Dimensions du Monde & Limites Serveur

### Schéma de Carte (`src/world/mapSchema.js`)
- **Dimensions étendues** : `DEFAULT_CAMPUS_SIZE = 1000` (`-500m` à `+500m`), `MAX_MAP_SIZE = 2000` (`-1000m` à `+1000m`), `CAMPUS_SIZE_PRESETS = [250, 500, 1000, 2000]` et helper `createCampusMap(size)`.
- **Multi-étages étendu** : `MIN_FLOOR = -2` (Sous-sols `-2` et `-1`) jusqu'à `MAX_FLOOR = 8` (11 niveaux complets `-2..+8`).
- **Capacité d'entités débloquée dans `normalizeMapData`** : plafonds relevés à `50 000` murs, `4 000` zones, `50 000` objets et `3 000` trémies, plus prise en charge native du tableau de repères `bookmarks` (jusqu'à 64 signets persistés) et de la propriété `surfaceKind` (`asphalt`, `concrete`, `grass`, `path`, `sport`).
- **Catalogue enrichi** : ajout de l'outil `room_builder` (Salle / Bâtiment Express) et des 5 pinceaux extérieurs (`exterior_asphalt`, `exterior_concrete`, `exterior_grass`, `exterior_path`, `exterior_sport`).
- **Rétrocompatibilité absolue** : `createDefaultMap()`, `createEmptyMap()`, `server/data/map.json` et `server/data/db.json` restent 100 % intacts et centrés sans aucun décalage.

### Moteur 3D, Atmosphère, Physique & Serveur
- **`src/world/SceneManager.js` & `src/vr/VRManager.js`** :
  - `camera.far` portée à `600m` (`potato`), `750m` (`eco`), `950m` (`balanced`) et `1200m` (`high`) avec extension dynamique jusqu'à `2400m` sur campus géants (`_applyCampusAtmosphereRange`), et plancher VR relevé à `600m`.
  - Brouillard atmosphérique progressif adapté au preset qualité (`fogNear`/`fogFar` calés sous `camera.far`) pour un horizon naturel sans coupure brutale des bâtiments.
  - Ancrage dynamique de la caméra d'ombres soleil (`updateShadowAnchor(x, z)` appelé dans `src/main.js`, demi-portée bornée à `90m`) afin de conserver des ombres nettes même aux extrémités d'une carte de `2000m × 2000m`.
- **`src/world/PlayerController.js` & `src/world/SurvivalEngine.js`** :
  - Clé de grille spatiale corrigée `(gx + 2048) * 4096 + (gz + 2048)` pour éliminer tout risque de collision d'index sur coordonnées négatives ou éloignées jusqu'à `±1000m+`.
  - Adaptation de `buildNavGrid` (`maxSpan / 100` au-delà de 120m) évitant toute sur-allocation mémoire sur les grandes maps.
- **`server/index.js` & `server/wsHub.js`** :
  - Limite HTTP JSON augmentée à `50mb` (`express.json({ limit: '50mb' })`).
  - Limite WebSocket augmentée à `50 Mo` (`maxPayload: 50 * 1024 * 1024`).
  - Suppression du bridage joueur `±160m` / étages `-1..5` dans `wsHub.js` : coordonnées synchronisées sur `±1100m` (`MAX_MAP_SIZE * 0.5 + 100`), altitude `Y` sur `-24m..+80m` et étages sur `MIN_FLOOR..MAX_FLOOR` (`-2..+8`).

---

## 2. Éditeur de Map "Échelle Campus" Virtualisé & Outils Rapides (`src/admin/MapEditor.js`, `src/admin/admin.css`)

- **Rendu Virtualisé 2D Anti-Lag** :
  - Fonction pure `isBoxInViewport2D(...)` appliquée aux zones, trémies, murs, objets, repères et calque fantôme (`_drawGhostFloor`).
  - Grille multi-échelles adaptative (`100m`, `50m`, `25m`, `10m`, `5m`, `2m`, `1m`, `0.5m`, `0.25m`, `0.1m`) dessinée uniquement dans le rectangle visible et regroupée en 2 appels `stroke()` groupés.
  - Mise en cache des trémies effectives par révision de carte (`_mapRev`).
- **Zoom Ultra-Large & Navigation Rapide** :
  - Plage de zoom étendue de `MIN_ZOOM_2D = 0.22 px/m` (vue satellite 2000m) jusqu'à `MAX_ZOOM_2D = 220 px/m` (précision au décimètre avec aimant `0.1m`).
  - Panoramique par clic milieu, clic droit, `Espace + glisser` et touches `ZQSD / WASD / Flèches` avec accélération `Shift` (boucle `requestAnimationFrame` arrêtée proprement à la sortie).
  - Affichage temps réel des coordonnées `(X, Z)`, du zoom et des dimensions en mètres (`L × P` et surface en `m²`).
  - **Minimap cliquable** enrichie (zones colorées, murs, escaliers, repères dorés et cadre caméra) et **barre de Signets / Repères Campus** (`#me-bookmarks-bar`) avec saut 1 clic 2D + 3D et sélecteur de zones existantes.
- **Outils de Construction Rapide** :
  - **Outil Salle / Bâtiment Express (`#me-tool-room` / `room_builder`)** : 1 clic-glisser génère 4 murs (plein / façade / vitré), une zone intérieure, une porte automatique optionnelle, une dalle de sol et un plafond/toit optionnel à l'étage supérieur avec cotes temps réel sur le canvas.
  - **Copier / Coller / Dupliquer multi-étages** : `Ctrl+C`, `Ctrl+V` au curseur sur l'étage actif et bouton `⬆️ → Étage +1` pour cloner une salle entière ou une sélection multiple vers le niveau supérieur.
  - **Pinceaux Extérieurs** : Bitume / Parking, Cour Béton, Pelouse, Allée Piétonne et Terrain de Sport avec rendu dédié 2D et matériaux PBR 3D (`RealisticMaterials.js`).
  - **Redimensionnement en Direct** : boutons presets `250m`, `500m`, `1000m`, `2000m` (`#me-size-presets`) sans effacer le contenu existant.

---

## 3. Optimisation "Sparse Chunks" 1000m+ à Haut FPS (`src/world/SpatialCulling.js`, `src/world/LabBuilder.js`)

- **Structure Sparse Strict (`Map` creuse `floor:cx:cz`)** :
  - Sur campus (`> 260m`), `LabBuilder` ne découpe plus l'intégralité du rectangle `2000m × 2000m` : seuls les chunks `16m × 16m` réellement occupés par des murs, zones intérieures, escaliers, trémies ou objets sont créés.
  - Un sol de base campus léger, une jupe d'horizon et un dôme céleste dégradé sont attachés directement à `worldGroup` sans créer de chunks vides.
  - `SpatialCullingEngine.finalize()` purge automatiquement tout chunk vide et expose `isSparse`, `hasChunk`, `getChunk`, `getChunkAt` et `stats.sparseChunks`.
- **Frustum, Distance & Occlusion Culling Zéro Allocation** :
  - Profils de portée mis à jour (`potato: 90m/24m`, `eco: 160m/34m`, `balanced: 320m/48m`, `high: 520m/75m`).
  - Pré-filtrage AABB de l'occlusion murale (`isChunkOccludedByWalls`) avec zéro allocation par frame.
  - Mise en veille automatique des `CanvasTexture` CIEL OS hors champ ou hors portée (`sleepMode = true`).
  - Grille `SpatialHash` en `O(1)` couvrant sans collision jusqu'à `±16 384m` et étages `-8..+120`.

---

## 4. Validation Automatisée, Build & Publication

- **Versionning & Changelog** : `vite.config.js` (`__APP_VERSION__`) et `src/ui/ChangelogModal.js` (`APP_VERSION` + nouvelle entrée `v4.33` en tête de `CHANGELOG_RELEASES`, `v4.32` passée à `HISTORIQUE`).
- **Tests ajoutés (`tests/multifloor-culling.test.js`)** :
  - Validation de cartes `1000m × 1000m` et `2000m × 2000m` avec bâtiments à `(450, -420)` étage `3` et `(-480, 460)` étage `0`, étages `-2` à `+8`, persistance `MapStore`, repères et pinceaux extérieurs.
  - Validation du caractère strictement **Sparse** des chunks (aucun chunk vide créé sur `2000m × 2000m`), Frustum & Distance Culling et pause `CanvasTexture`.
  - Validation de l'absence de bridage joueur local (`PlayerController`) et WebSocket (`wsHub`) sur `±950m` et étages `-2..+8`, limites `50mb`, viewport culling 2D (`isBoxInViewport2D`) et zéro fuite de timers/sockets.
  - Vérification stricte que `server/data/map.json` et `server/data/db.json` n'ont pas été modifiés.
- **Résultats d'exécution** :
  - `node --test --test-force-exit tests/*.test.js` : **139 / 139 tests réussis (0 échec)** en `29.07 s`.
  - `npm run build` (`vite build`) : **build production réussi sans erreur** en `15.10 s` (`dist/index.html`, `dist/admin.html`, bundles assets).
  - Audit strict : **0 commentaire** dans tout le code généré/modifié, **0 occurrence** de nom interdit, `server/data/` intact.
