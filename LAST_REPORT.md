# Rapport Technique — Atelier CIEL 3D v4.29

**Version :** `v4.29 - Correctif Désactivation Bots, Réticules Dynamiques, Visée ADS & Refonte 3D des 8 Armes CIEL`  
**Date :** 19/11/2026  

---

## 1. Correction Définitive de la Désactivation des Bots IA

### Cause racine identifiée
Dans `src/world/CombatEngine.js` (`startMatch`), le calcul `const targetBots = this.fillBots || humanCount === 1 ? ...` puis `const neededBots = humanCount === 1 ? Math.max(3, targetBots) : targetBots;` forçait systématiquement l'apparition d'au moins 3 bots IA dès qu'un joueur lançait en solo, même lorsque `fillBots` / `botsEnabled` était désactivé.

### Corrections apportées
- **`src/world/CombatEngine.js`** :
  - Introduction de l'état canonique `botsEnabled: boolean` (synchronisé avec `fillBots` pour la rétrocompatibilité) et de `setBotsEnabled(enabled)`.
  - Dans `startMatch()`, lorsque `botsEnabled === false`, `neededBots` vaut **strictement `0`**, en solo comme en multijoueur.
  - Exposition de `botsEnabled` et `fillBots` dans `getPublicSnapshot()`.
- **`server/wsHub.js` & `src/core/network.js`** :
  - Gestion unifiée des messages `combat_fill_bots` / `combat_bots_toggle` avec lecture prioritaire de `botsEnabled` (fallback `fillBots`), diffusion immédiate `combat_state` à toute la salle et conservation du réglage lors de `combat_restart`.
- **`src/world/CombatArena3D.js`, `src/ui/HudManager.js`, `src/vr/VRHudPanel.js`, `src/ui/TouchControls.js` & `src/main.js`** :
  - Ajout d'une 4e borne interactive 3D dédiée (`combat_lobby_bots`) dans la salle d'attente avec voyant dynamique vert (`ACTIVÉS`) / rouge (`DÉSACTIVÉS`) et libellé synchronisé avec l'état serveur.
  - Mise à jour temps réel du panneau mural 3D, de la modale PC/Mobile (`🤖 Bots IA : ACTIVÉS / DÉSACTIVÉS`) et du panneau spatial VR (`vr_cbt_bots`).

---

## 2. Réticule Dynamique (Crosshair) & Hitmarker

- **`index.html`, `src/styles/main.css` & `src/ui/HudManager.js`** :
  - Ajout de `#combat-crosshair` centré avec variables CSS dynamiques (`--ch-gap`) réagissant en temps réel au mouvement et au recul, et masquage automatique du crosshair standard (`body.combat-active #crosshair`).
  - Formes dédiées par arme :
    - **Fusil d'Assaut Fibre Optique** : croix tactique cyan avec point central et écartement dynamique en rafale.
    - **Fusil à Pompe Paquets UDP** : parenthèses/cercle de dispersion jaune/orange représentant le cône de 6 paquets.
    - **Sniper Ping 0ms (Oscillo-Railgun)** : croix fine longue précision cyan.
    - **Pistolet à Souder Plasma** : petit réticule compact nerveux orange plasma.
    - **Armes de Mêlée** : point central + arc directionnel qui passe au vert lumineux (`in-range`) lorsqu'un adversaire est à portée de frappe, ou bleu (`guarding`) en garde.
  - Masquage automatique du réticule standard (`ads-hidden`) lors de la visée ADS sur arme à feu et hitmarker 4 branches net (blanc/cyan sur touche, rouge agrandi sur élimination).

---

## 3. Système de Visée (ADS), Viseurs Spécifiques & Garde Mêlée

- **Commandes multi-plateformes** :
  - **PC** (`src/main.js`) : Clic Droit maintenu pour viser (`ADS`) avec blocage du menu contextuel (`contextmenu` -> `preventDefault()`), Clic Gauche conservé pour tirer/frapper.
  - **Mobile / Tablette** (`index.html`, `src/ui/TouchControls.js`) : nouveau bouton tactile `🎯 Viser` (ou `🛡️ Garde` en mêlée) en bascule on/off à côté des boutons Tirer/Recharger.
  - **VR WebXR** (`src/vr/VRManager.js`) : alignement naturel du viseur 3D devant le regard (ou grip gauche), réticule 3D adapté à l'arme, assistance optique Sniper (`combatScopeZoomActive`) et garde mêlée VR (`onGuardChange`).
- **Sensations et précision** (`src/main.js`, `src/world/PlayerController.js`, `src/world/CombatEngine.js`) :
  - Interpolation douce de la position/rotation du modèle 3D vers le centre, transition fluide du FOV caméra par arme (`48°` Fibre Optique, `56°` Pompe UDP, `20°` Sniper, `54°` Plasma, `64°` Mêlée), réduction progressive de la sensibilité (`setAdsSensitivityMultiplier`) et réduction de la dispersion serveur (`ads: true`).
  - **Lunette Oscilloscope Sniper (`#combat-sniper-scope`)** : masque circulaire sombre, grille graduée `ms/div`, axes millimétrés cyan, onde sinusoïdale animée sur canvas 2D et télémètre temps réel.
  - **Posture Garde / Parade Mêlée** : lève l'arme devant le joueur et réduit de 50 % les dégâts reçus de face côté serveur (`combat_guard` -> `setPlayerGuard`).

---

## 4. Refonte Complète des 8 Modèles 3D d'Armes CIEL

Reconstruction multi-pièces complète dans `src/world/CombatWeapons.js` avec **cache partagé de géométries et matériaux** (`SHARED_GEOM_CACHE`, `SHARED_MAT_CACHE`) et zéro allocation dans les boucles d'animation (`animateCombatWeaponMesh` appelée en FPS, sur les bots et sur les joueurs distants) :
1. **Fusil d'Assaut Fibre Optique** : châssis noir mat, rail supérieur, viseur holographique réflexe 3D à vitre cyan translucide + chevron, canon ajouré à 3 brins fibre optique pulsants, chargeur incliné à jauge cyan et crosse squelette.
2. **Fusil à Pompe Paquets UDP** : double canon dissipateur à ailettes, garde-main à pompe animé au tir, 4 cartouches/connecteurs de données latéraux lumineux et viseur anneau néon vert/jaune.
3. **Sniper Ping 0ms (Oscillo-Railgun)** : double rail électromagnétique avec 6 bobines cuivre/violet animées, écran miniature d'oscilloscope sur le flanc, bipied replié et lunette optique multi-lentilles.
4. **Pistolet à Souder Plasma** : glissière tactique à 4 fentes de ventilation plasma orange, buse chauffante conique incandescente, cellule batterie en crosse et mire mécanique 3 points phosphorescents.
5. **Fer à Souder Incandescent** : manche isolé bleu/noir avec manchon câble, canon inox à 5 ailettes de refroidissement et panne conique rouge-orange incandescente.
6. **Pince à Sertir RJ45 Géante** : mâchoires crantées en acier brossé avec empreinte RJ45, pivot et ressort central, poignées isolantes jaune/noir et arc électrique bleu scintillant.
7. **Katana Barrette RAM DDR5** : garde dorée façon connecteur DIMM/PCIe, lame PCB noire à 6 puces SMD en relief, dissipateur RGB néon le long du dos et poignée tressée.
8. **Marteau Switch 24 Ports** : manche renforcé acier/caoutchouc et tête Switch rackable 1U 24 ports avec oreilles de rack, double rangée de ports RJ45 et LEDs vertes/oranges clignotantes.

---

## 5. Validation & Conformité

- **Versionnage & Changelog** : `vite.config.js` (`__APP_VERSION__`) et `src/ui/ChangelogModal.js` (`APP_VERSION` + entrée `v4.29` `DERNIÈRE MÀJ`, `v4.28` passée à `HISTORIQUE`).
- **Tests automatisés** : `node --test --test-force-exit tests/*.test.js` (100 % verts, incluant tous les nouveaux tests unitaires, WebSocket, DOM/HUD, TouchControls et VR WebXR v4.29).
- **Build production** : `npm run build` réussi sans erreur.
- **Règles du dépôt** : `server/data/map.json` et `server/data/db.json` intacts, zéro commentaire dans le code généré/modifié, lore 100 % `Professeur CIEL`.
