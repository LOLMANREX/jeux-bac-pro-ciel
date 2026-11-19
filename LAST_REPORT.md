# Rapport Technique — Atelier CIEL 3D v4.30

**Mise à jour :** `v4.30 — Correctif Achat Boutique CIEL, Refonte du Menu Casier & Démineur Pro (Difficile, Sécurité Anti-Faux-Clic & Gains Boostés)`
**Date :** 19/11/2026

---

## 1. Diagnostic & Correction Définitive du Bug d'Achat dans la Boutique

### Causes exactes identifiées lors de l'audit
1. **Décalage d'identifiant client/serveur (`403 Session élève incompatible`)** :
   - Dans `src/main.js`, `buyShopItemAction` et `equipShopItemAction` résolvaient `playerName` via `gameState.profile?.name || gameState.account?.username || 'Eleve_CIEL'`, donnant la priorité au nom de profil par défaut (`Eleve_CIEL`) au lieu du `username` du compte authentifié.
   - Côté serveur (`server/index.js`), `resolveAuthorizedEconomyTarget(req)` rejetait alors la requête avec `403` dès que `bodyName` différait de `tokenUser`.
2. **Clipping CSS & empilement `z-index` du bouton « Acheter »** :
   - Dans `src/styles/main.css`, `.shop-modal-card` et `.shop-modal-body` utilisaient `overflow: hidden` alors que `.shop-inspector-col` ne disposait ni de `min-height: 0` ni de `overflow-y: auto` ; avec un canvas 3D de 320 px, `#shop-btn-action` se retrouvait coupé/inaccessible sur écrans portables et tablettes.
   - `#shop-modal` avait `z-index: 48`, inférieur à plusieurs calques/overlays (`z-index: 50–70`).
3. **Bouton muet & absence de bascule WebSocket** :
   - Dans `ShopModal.js` et `VRHudPanel.js`, le bouton d'achat était désactivé (`disabled: !sel.canAfford`), empêchant tout retour d'erreur clair si le joueur cliquait dessus.
   - `network.buyShopItem` et `network.equipShopItem` ne basculaient pas sur WebSocket (`shop_buy` / `shop_equip`) en cas d'erreur réseau/session HTTP.
   - `server/store.js` ne réconciliait pas `accounts.get(accKey)` et `data.players[key]` avant le contrôle de solde.

### Correctifs appliqués
- **`src/main.js`** : priorité à `gameState.account?.username`, synchronisation automatique du `authToken`, sortie explicite du `PointerLock` à l'ouverture de la Boutique, rafraîchissement simultané de la Boutique, du HUD, de la montre VR et du Casier.
- **`server/index.js`** : `resolveAuthorizedEconomyTarget` fait foi sur `tokenUser` vérifié par HMAC lorsque `bodyName` est vide ou vaut le placeholder `Eleve_CIEL`.
- **`server/store.js`** : réconciliation atomique du solde (`coins`) et de `ownedItems` entre `accounts` et `players` dans `buyShopItem` et `equipShopItem` avant débit et persistance.
- **`server/wsHub.js` & `src/core/network.js`** : réponse d'erreur explicite sur `shop_buy` / `shop_equip` si non connecté et bascule automatique HTTP -> WebSocket (`_requestViaWs`) en cas d'échec réseau ou session HTTP.
- **`src/ui/ShopModal.js`, `src/vr/VRHudPanel.js`, `src/styles/main.css`** : `#shop-modal` élevé à `z-index: 86`, `.shop-inspector-col` scrollable (`min-height: 0; overflow-y: auto`), canvas borné à `max-height: 220px`, réinitialisation de `this.busy` à l'ouverture/fermeture, et messages d'erreur clairs (solde insuffisant avec montant manquant, déjà équipé, erreur serveur) au lieu d'un bouton muet.

---

## 2. Refonte Complète et Moderne du Menu Casier (`src/ui/LockerModal.js`)

- **Nouveau module `src/ui/LockerModal.js`** (`buildLockerViewModel`, `LockerPreview3D`, `LockerModal`) remplaçant l'ancien panneau basique tout en conservant la personnalisation complète de la Tenue Standard :
  - **4 onglets clairs** avec compteurs par catégorie : **👕 Skins**, **🐾 Pets 3D**, **✨ Accessoires / Auras**, **🏅 Badges & Titres**.
  - **Grande prévisualisation 3D interactive** (rotation 360° au glisser souris/doigt avec inertie et `touch-action: none`) affichant en direct l'avatar avec son **Skin**, son **Pet 3D animé** et son **Accessoire / Aura** simultanément.
  - **Cartes colorées par rareté** (`Commun`, `Rare`, `Épique`, `Légendaire`), compteur global d'objets Boutique débloqués (`X / 18`), filtres rapides (`Tous`, `Possédés`, `À débloquer`) et indicateur `✅ Équipé`.
  - **Équipement et retrait en 1 clic** synchronisés immédiatement côté serveur et en multijoueur, plus raccourci direct **« 🛒 Voir dans la Boutique »** ouvrant la Boutique directement sur l'article verrouillé.
- **Intégration VR WebXR** (`src/vr/VRHudPanel.js`, `src/vr/VRManager.js`, `src/main.js`) : ajout du bouton **🎨 Casier** sur la montre VR et du panneau spatial 3D `locker` avec onglets, filtres, aperçu 3D rotatif et raccourci Boutique.

---

## 3. Démineur Pro sur CIEL OS (`src/minigames/CielOsGames.js`, `CielOsDesktop.js`, `ShopCatalog.js`, `server/store.js`)

- **3 niveaux de difficulté** avec rendu net et adaptatif sur CIEL OS (PC, Mobile/Tablette et VR) :
  - **Facile** : `9×9` / `10 mines` — **`35 CC`** à la victoire.
  - **Normal** : `12×12` / `24 mines` — **`65 CC`** à la victoire + **`+15 CC`** en cas de nouveau record de temps.
  - **Difficile** : `16×16` / `48 mines` — **`130 CC`** à la victoire + **`+25 CC`** en cas de nouveau record de temps.
  - Plafond anti-triche `ARCADE_GAME_RULES.minesweeper.maxValidScore` relevé à `20000` et suivi persistant des meilleurs temps par difficulté côté serveur (`minesweeper_time_easy/medium/hard`).
- **Sécurité Anti-Faux-Clic & Protection de Progression** :
  - **1er clic garanti sûr** : génération différée des mines après le premier clic avec zone sûre `3×3` dégagée autour de la case de départ.
  - **Mode Sécurité activé par défaut** (`🛡️ Sécurité : ON (2 clics)`) : 1er clic pré-sélectionne la case en surbrillance, 2e clic confirme la révélation ; protection absolue contre la révélation d'une case marquée d'un drapeau ; bascule rapide `⛏️ Révéler / 🚩 Drapeau`.
  - **Protection de la partie en cours** : sauvegarde automatique en mémoire (`saveInProgressSnapshot`) à la fermeture de la fenêtre ou en quittant le poste PC avec bouton **« ▶️ Reprendre la partie »**, et confirmation explicite (`⚠️ Confirmer / ✖ Annuler`) avant toute réinitialisation ou changement de difficulté sur une grille entamée.

---

## 4. Versionning, Tests & Validation

- Version incrémentée à **`v4.30`** dans `vite.config.js` et `src/ui/ChangelogModal.js` (`v4.29` passée au tag `HISTORIQUE`).
- Tests complétés dans `tests/shop-economy.test.js`, `tests/ciel-os.test.js`, `tests/vr.test.js`, `tests/celebration-debug.test.js` et `tests/mobile-tp.test.js`.
- Règles strictes vérifiées : zéro commentaire ajouté, `server/data/map.json` et `server/data/db.json` intacts, conformité lore `Professeur CIEL`.
