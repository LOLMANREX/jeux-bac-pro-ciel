# 📋 Rapport Technique — Atelier CIEL 3D `v4.16`

**Mise à jour :** `v4.16 - Correctif Note 20/20 TP Brasure & Attribution Passe VIP Palier 7 à yanfufu`  
**Date :** 16/11/2026  
**Objectifs :**
1. Auditer le mini-jeu **TP Brasure PCB 3D** (`soldering`) et corriger les bugs empêchant d'atteindre `20/20`, puis garantir la transmission et la persistance de `20/20` dans `server/data/accounts.json` via `POST /api/account/save`.
2. Attribuer automatiquement et de façon persistante le skin légendaire **Passe VIP « Clé Maîtresse Baie Serveur » (Palier 7)** au compte `yanfufu` (insensible à la casse), au chargement/migration du store, à l'inscription et à la connexion, sans écraser sa progression de TPs, avec affichage et gestion dédiée dans `/admin`.
3. Mettre à jour le versionning (`vite.config.js`, `src/ui/ChangelogModal.js`), ajouter les tests unitaires/serveur, exécuter `node --test --test-force-exit tests/*.test.js`, `npm test` et `npm run build`, puis publier sur `origin main`.

---

## 🔍 1. Diagnostic & Causes Identifiées

### 1.1 TP Brasure PCB 3D (`soldering`) : plafond réel à `19.8/20` et bugs de gameplay
L'audit complet de `src/minigames/SolderingGame.js`, `src/minigames/MiniGameModal.js`, `src/main.js`, `server/store.js` et `server/index.js` a mis en évidence les anomalies suivantes :
1. **Pénalité `reworkCount` inévitable sur les pastilles `U2` et `U3` :**
   - À l'initialisation de l'étape 2 (`SOLDER_STAGES[1]`), les pastilles `U2` (`U1-TX`) et `U3` (`U1-RX`) démarrent avec `state: 'bridge'` (pont d'étain obligatoire à nettoyer avec la tresse cuivre).
   - Dans `onDragStart`, l'utilisation de `tool === 'wick'` incrémentait inconditionnellement `reworkCount += 1` même lorsque la pastille nettoyée était le pont initial `pad.state === 'bridge'`, infligeant `-0.25` point et plafonnant la note réelle à `19.8/20` (`Math.round(19.75 * 10) / 10`).
2. **Fenêtre temporelle trop serrée (`durationSec <= 120`) :**
   - `computeSolderingScore3D` retirait `0.5` point dès `121s` alors que le nettoyage du pont + chauffe/étain sur 8 pastilles + test 5V demande couramment entre 90s et 220s. La tolérance à pleine note (`1.0` pt) a été portée à `<= 240s` (`0.5` pt jusqu'à `360s`, `0.2` pt au-delà).
3. **Zone morte thermique `395°C–405°C` & courbe de chauffe instable :**
   - Dans `onDragEnd`, la condition exigeait `pad.temp <= 395` alors que la surchauffe (`burnt`) ne se déclenchait qu'à `>= 405°C`. Une pastille relâchée entre `395°C` et `405°C` retombait en `state: 'cold'` sans indication de brûlure.
   - Le refroidissement à `dt * 55` °C/s pénalisait la transition entre `iron` et `tin`, tandis qu'un clic ultérieur avec le fer sur une pastille déjà `'good'` la reclassait en `'cold'`.
   - Dans `triggerPowerTest()`, si un élève testait le PCB avant la fin de toutes les pastilles alors que l'état était faux ou si `powerOn` basculait via `!powerOn`, un clic ultérieur sur un montage validé pouvait éteindre l'alimentation (`false`) au lieu de valider.
4. **Conservation du skin sélectionné lors de `POST /api/account/save` :**
   - Dans `src/main.js`, la sauvegarde envoyée à la fin d'un TP calculait `selectedSkin` uniquement à partir de `secretSkin` ou `divineSpecialty`, ce qui aurait écrasé `selectedSkin: 'bp_tier_7'` en `'standard'` lors d'une sauvegarde TP sur le compte de `yanfufu`.

### 1.2 Passe VIP Palier 7 pour `yanfufu` & Architecture de Persistance
1. Les paliers du Passe de Combat étaient uniquement définis côté interface dans `src/ui/BattlePassModal.js` et non rattachés à un catalogue partagé client/serveur.
2. Les tests existants (`v4.11`/`v4.12`) vérifient que `unlockedDivineSkins` reste strictement limité aux 5 spécialités d'Ascension (`DIVINE_SPECIALTY_IDS`). Les déblocages Passe VIP devaient donc être stockés séparément dans `unlockedBattlePassTiers` (avec `vipChambreAccess` et `selectedSkin: 'bp_tier_7'`).
3. Aucun endpoint `/admin` ni modale dédiée ne permettait d'inspecter ou d'attribuer les paliers Passe VIP aux comptes élèves.

---

## 🛠️ 2. Modifications Fichier par Fichier

### [`src/core/battlePassSkins.js`](file:///opt/atelier-dev/src/core/battlePassSkins.js) *(nouveau module ESM partagé)*
- Définition de `YANFUFU_VIP_TIER = 7` et `BATTLE_PASS_SKIN_CATALOG` (paliers `1` à `10` avec métadonnées complètes, couleurs d'accent, accès `vipChambreAccess` et `showcase` 3D).
- Helpers exportés : `cloneShowcase`, `getBattlePassTierSpec`, `getBattlePassSkinId`, `isBattlePassSkinId`, `normalizeBattlePassTierList`, `isYanfufuUsername` (comparaison insensible à la casse `username.toLowerCase() === 'yanfufu'`), `hasVipChambreAccess`.

### [`src/minigames/SolderingGame.js`](file:///opt/atelier-dev/src/minigames/SolderingGame.js)
- **`evaluateSolderStage` & `computeSolderingScore3D` :** Arrondi propre de la température (`Math.round`), gardes anti-`NaN` sur tous les compteurs (`safeTemp`, `safeBurns`, `safeReworks`, `safeDuration`), et fenêtre temps portée à `durationSec <= 240` pour le point complet de rapidité (`1.0` pt), permettant d'atteindre exactement `20/20` (`12 + 2.5 + 2.5 + 2.0 + 1.0 = 20`).
- **Tresse cuivre (`wick`) sans pénalité sur pont initial :** `reworkCount += 1` n'est plus incrémenté lorsque `pad.state === 'bridge'`.
- **Thermique, protection & test 5V :** Refroidissement ralenti (`dt * 24`), chauffe lissée (`pad.temp > 320 ? 34 : 108`), plafonnement de `tinProgress` à `1`, suppression de la zone morte (`pad.temp >= 215 && pad.temp < 405` et `Math.round(tempC) >= 325`), protection des pastilles déjà `'good'`, passage automatique à l'étape 2, suivi entier du potentiomètre `tempDialRaw`, et correction de `triggerPowerTest()` (`powerOn = true` si toutes les pastilles sont conformes).

### [`server/store.js`](file:///opt/atelier-dev/server/store.js)
- Import des helpers `battlePassSkins.js` et validation complète dans `sanitizeSkin`, `_normalizeAccount`, `_serializeAccount`, `_normalizePlayer`, `_syncPlayerFromAccount`, `_syncAccountFromPlayer`.
- **Attribution à deux niveaux pour `yanfufu` :**
  - **Chargement / migration (`_load()`) :** Détecte un compte `yanfufu` déjà présent dans `accounts.json` sans Palier 7 ou `vipChambreAccess`, débloque le Palier 7 (`[7]`), active `vipChambreAccess: true`, équipe `bp_tier_7` si le skin était standard, et sauvegarde immédiatement sur disque (`needsGrantSave = true`) sans altérer `tpScores` ni les notes existantes.
  - **Inscription, connexion, invité & reset (`registerAccount`, `loginAccount`, `getOrCreatePlayer`, `resetPlayer`) :** Garantit l'attribution automatique et persistante de `[7]`, `vipChambreAccess: true` et `bp_tier_7` à `yanfufu` tout en bloquant l'usurpation côté client dans `saveAccountData`.
- Ajout de `adminUpdateAccountBattlePass(target, payload)` permettant d'attribuer, équiper ou retirer des paliers VIP `1..10` (ou revenir en `standard`) tout en préservant l'accès VIP permanent de `yanfufu`.

### [`server/wsHub.js`](file:///opt/atelier-dev/server/wsHub.js) & [`server/index.js`](file:///opt/atelier-dev/server/index.js)
- Enrichissement de `getAllEnrichedPlayers()` avec `unlockedBattlePassTiers` et `vipChambreAccess`.
- Ajout de `wsHub.notifyAccountUpdated(profile)` pour pousser en direct (`profile_updated` + `player_skin_updated`) les changements cosmétiques/VIP au joueur connecté et à sa salle.
- Ajout des routes admin protégées par `requireAdmin` : `POST /api/admin/accounts/:target/battlepass` et `POST /api/admin/accounts/:target/special-skins`.

### [`src/core/gameState.js`](file:///opt/atelier-dev/src/core/gameState.js)
- Ajout des propriétés `unlockedBattlePassTiers`, `vipChambreAccess`, `hasBattlePassTier(tier)`, `hasVipChambreAccess()` et `equipBattlePassSkin(tierOrId)` (et prise en charge dans `equipDivineSkin`, `setAccount`, `clearAccount`, `setProfile`, `setSkin`).

### [`src/world/AvatarBuilder.js`](file:///opt/atelier-dev/src/world/AvatarBuilder.js) & [`src/world/RemotePlayers.js`](file:///opt/atelier-dev/src/world/RemotePlayers.js)
- Ajout de `applyBattlePassSkin`, gestion de `battlePassTier` et `showcase` dans `normalizeSkin` / `applySessionDivineSkin`, exposition de `hasBattlePassSkin()` et `getBattlePassTier()`, et rendu 2D SVG VIP (`materialTheme: 'cyber_gold'` + badge VIP or) dans `renderSkinPreviewSvg`.
- Mise en valeur du Palier VIP sur les étiquettes flottantes multijoueur `makeStudentBadge` (bordure or, rang `🔑VIP` et sous-titre `Passe VIP P.7`).

### [`src/ui/BattlePassModal.js`](file:///opt/atelier-dev/src/ui/BattlePassModal.js), [`src/ui/SkinCustomizer.js`](file:///opt/atelier-dev/src/ui/SkinCustomizer.js), [`src/ui/MainMenu.js`](file:///opt/atelier-dev/src/ui/MainMenu.js), [`src/ui/HudManager.js`](file:///opt/atelier-dev/src/ui/HudManager.js), [`src/main.js`](file:///opt/atelier-dev/src/main.js), [`src/styles/main.css`](file:///opt/atelier-dev/src/styles/main.css)
- Affichage des skins Passe VIP débloqués dans le Casier (`SkinCustomizer.getCasierDivineEntries` & `renderSkinControls` avec `.divine-chip-vip`) et dans `BattlePassModal` (badges `✅ DÉBLOQUÉ` / `🏆 ÉQUIPÉ` et bouton `✨ ÉQUIPER`, tout en conservant la blague pigeon pour les paliers verrouillés).
- Ajout de `getSelectedSkinIdFromSkin(skin)` dans `src/main.js` pour conserver `bp_tier_X` lors des sauvegardes TP (`POST /api/account/save`), changements de skin et validations debug.
- Rafraîchissement de `battlePassModal`, toast d'accueil VIP à l'entrée en zone `CHAMBRE`, et badge `🔑 VIP` dans le classement HUD (`HudManager.renderLeaderboard`) et la fiche de connexion (`MainMenu.syncAuthUi`).

### [`admin.html`](file:///opt/atelier-dev/admin.html), [`src/admin/admin.js`](file:///opt/atelier-dev/src/admin/admin.js) & [`src/admin/admin.css`](file:///opt/atelier-dev/src/admin/admin.css)
- Affichage des badges Passe VIP (`.vip-admin-badge`, `.vip-admin-badge.equipped`) et `🔐 Chambre VIP` sur les fiches comptes et joueurs dans `/admin`.
- Ajout de la modale `#admin-special-skins-modal` (`🎁 Skins VIP`) permettant d'attribuer, équiper ou retirer les paliers 1 à 10 directement depuis `/admin`.

### [`vite.config.js`](file:///opt/atelier-dev/vite.config.js), [`src/ui/ChangelogModal.js`](file:///opt/atelier-dev/src/ui/ChangelogModal.js) & Tests
- Incrémentation de `__APP_VERSION__` et `APP_VERSION` vers `v4.16 - Correctif Note 20/20 TP Brasure & Attribution Passe VIP Palier 7 à yanfufu`.
- Ajout de l'entrée datée `v4.16` en haut de `CHANGELOG_RELEASES` et passage de `v4.15` au tag `'HISTORIQUE'`.
- Ajout des tests dans `tests/minigame-logic.test.js` et `tests/server.test.js`, et mise à jour des assertions de version dans `tests/celebration-debug.test.js`.

---

## 🧪 3. Résultats des Tests & Build

Vérifications exécutées sur le dépôt :
- **`node --test --test-force-exit tests/*.test.js` :** `exit code 0` — **62 tests**, **62 réussis**, **0 échec**, 0 ignoré (`9590.61ms`).
- **`npm test` :** `exit code 0` — **62 tests**, **62 réussis**, **0 échec**, 0 ignoré (`9573.39ms`).
- **`npm run build` (`vite v6.4.6`) :** `exit code 0` — **51 modules transformés**, build `dist/` terminé en `15.57s` (`dist/admin.html`, `dist/index.html`, `dist/assets/admin-*.css`, `dist/assets/main-*.css`, `dist/assets/admin-*.js`, `dist/assets/LabBuilder-*.js`, `dist/assets/three-*.js`, `dist/assets/main-*.js`).
- **Contrôles de conformité :** `0` occurrence de `"Fortin"`, `0` commentaire ajouté en JS/CSS/HTML, aucune modification de `server/data/map.json` ni `server/data/db.json`.

---

## 🎯 4. Guide de Vérification

1. **Vérifier le `20/20` sur le TP Brasure (`soldering`) :**
   - Lancer l'atelier Brasure PCB 3D en U301, activer `💨 Allumer Extracteur` et régler la station entre `335°C` et `370°C` (`350°C` recommandé).
   - Souder les 4 pastilles de l'étape 1 (`J1-VCC`, `J1-GND`, `R1-A`, `C1-GND`) avec `🔥 Fer à souder` puis `🧵 Fer + Fil d’étain`.
   - À l'étape 2, sélectionner la `🩹 Tresse cuivre` pour retirer le pont d'étain entre `U1-TX` et `U1-RX`, braser `U1-TX`, `U1-RX`, `U1-PWM` et `LED-OK`, puis cliquer sur `⚡ Tester PCB 5V`.
   - Constater l'affichage de **`20.0 / 20`** dans le HUD et la persistance de `tpScores.soldering === 20` dans `server/data/accounts.json` via `POST /api/account/save`.
2. **Vérifier le Passe VIP Palier 7 de `yanfufu` :**
   - Se connecter ou créer un compte avec le pseudo `yanfufu` (peu importe la casse, ex. `YanFuFu`).
   - Vérifier dès le menu principal que le Casier affiche `🔑 Passe VIP Clé Maîtresse (P.7)` actif, que la modale Passe de Combat affiche `✅ DÉBLOQUÉ` / `🏆 ÉQUIPÉ` sur le Palier 7 et que l'avatar 3D porte la tenue Fibre Sombre & Finitions Or 24K + Badge VIP Or + Drone + particules dorées.
   - Entrer en jeu puis se rendre dans la zone **Chambre Baie Serveur** (`CHAMBRE`) : le toast d'accès VIP s'affiche et l'étiquette au-dessus de l'avatar porte le rang `🔑VIP`.
3. **Vérifier dans `/admin` :**
   - Ouvrir `/admin`, consulter l'onglet Comptes Élèves : la ligne `yanfufu` affiche `🔑 Passe P.7 (Passe VIP Clé Maîtresse) ★` et `🔐 Chambre VIP`.
   - Cliquer sur `🎁 Skins VIP` sur n'importe quel élève pour tester l'attribution, l'équipement ou le retrait d'un palier spécial.
