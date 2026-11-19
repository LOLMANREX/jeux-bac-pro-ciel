# Rapport Technique — v4.27 : Épuration du HUD Haut, Boutique dans les Paramètres, Suppression du Meuble Boutique & Écran CIEL OS Simple Face

## 1. Épuration de la Barre Supérieure (HUD) & Déplacement dans le Menu Paramètres
- **Barre supérieure en jeu (`index.html`, `src/styles/main.css`)** :
  - Conservation stricte de **2 boutons** dans `.hud-actions` :
    - `⚙️ Paramètres` (`#btn-settings`)
    - `🏠 Menu principal` (`#btn-main-menu`)
  - Suppression de la barre supérieure de tous les autres boutons d'action (Boutique, Casier, VR, Chat, Audio/Micro, Revoir l'intro, Déconnexion, Pouvoir Créateur).
- **Menu Paramètres (`index.html`, `src/ui/HudManager.js`, `src/main.js`, `src/styles/main.css`)** :
  - Regroupement clair et responsive (PC, mobile/tablette et VR) en 3 sections dans `#settings-modal` :
    1. **🛒 Boutique & Raccourcis Atelier** : bouton principal `🛒 Ouvrir la Boutique CIEL` (`#btn-shop-ingame`), grille de raccourcis (`#btn-skin-ingame`, `#btn-vr-toggle`, `#btn-chat-toggle`, `#btn-leaderboard-settings`, `#btn-changelog-settings`, `#btn-replay-intro`, `#btn-hud-logout`) et bloc Pouvoir Créateur.
    2. **🎧 Audio, Micro & Volume** : bascule micro (`#btn-voice-toggle`), sélecteur et test micro / sortie audio intégrés (`#btn-audio-settings`, `#audio-settings-popover.audio-settings-inline`), volume réception Voice Chat (`#set-voice-vol`), mode vocal (`#set-voice-mode`, `#set-voice-tp`) et activation des effets sonores (`#set-sound`).
    3. **🎮 Affichage, Caméra & Contrôles** : FOV, mode caméra, qualité graphique, sensibilité souris/tactile, mode tactile et réinitialisation.
  - **Ouverture propre de la Boutique** : le clic sur `🛒 Ouvrir la Boutique CIEL` ferme systématiquement `#settings-modal` (`this.closeSettings()` dans `HudManager.js` et `hud?.closeSettings?.()` dans `openShopUi` de `src/main.js`), et `#shop-modal` dispose d'un `z-index: 48` supérieur à celui des modales standards (`45`).
- **VR (`src/vr/VRHudPanel.js`)** :
  - La montre VR conserve son bouton `🛒 Boutique` (`btn_shop`) pour ouvrir le panneau spatial Boutique en WebXR.

## 2. Suppression du Meuble 3D Boutique
- **`src/world/LabBuilder.js`** : suppression complète de `buildShopKioskInHall` (mesh 3D, collider physique, sprite flottant, anneau au sol, hologramme et entrée `shop_kiosk` dans `interactables`). `lab.shopKiosks` reste vide.
- **`src/main.js`** : suppression de la branche d'interaction `target.type === 'shop_kiosk'`.

## 3. Correction de l'Affichage Double-Face des Écrans PC CIEL OS
- **`src/world/LabBuilder.js`** (`attachCielOsPcToDesk`) :
  - Application de la `CanvasTexture` dynamique de `CIEL OS` uniquement sur la face avant (`frontScreen` en `THREE.PlaneGeometry`, `position.z = 0.025`, `side: THREE.FrontSide`).
  - Suppression complète de la génération de la face arrière (`backScreen` / `dualSided: true`) sur tous les postes PC (bureaux élèves, bureaux professeurs, îlots réseau et PC plaçables).
  - La coque arrière et les côtés des moniteurs restent rendus par `bezelMat` (`THREE.MeshStandardMaterial` opaque sombre sans texture `CIEL OS`).

## 4. Versionning, Tests & Build
- **Version** : incrémentée à `v4.27` dans `vite.config.js` (`__APP_VERSION__`) et `src/ui/ChangelogModal.js` (`APP_VERSION` + nouvelle entrée datée en tête de `CHANGELOG_RELEASES`, passage de `v4.26` à `HISTORIQUE`).
- **Tests mis à jour & complétés** :
  - `tests/shop-economy.test.js` : vérification de la suppression du kiosque 3D, de la présence exclusive des 2 boutons dans `.hud-actions` et du déplacement de la Boutique + Audio dans `#settings-modal`.
  - `tests/vr.test.js` : vérification de l'absence de `shop_kiosk` dans `lab.interactables` tout en conservant `btn_shop` sur la montre VR.
  - `tests/ciel-os.test.js` : vérification que tous les écrans `CIEL OS` sont exclusivement en face avant (`-front`, aucun `-back`), avec `material.side === THREE.FrontSide` et `position.z > 0`.
  - `tests/celebration-debug.test.js` & `tests/mobile-tp.test.js` : mise à jour de l'assertion de version vers `v4.27`.
- **Intégrité protégée** : aucune modification apportée à `server/data/map.json`, `server/data/db.json` ni à la géométrie des salles et murs.
