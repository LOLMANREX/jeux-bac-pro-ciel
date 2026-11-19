# RAPPORT TECHNIQUE — Mise à jour v4.26
**Titre** : `v4.26 - Adaptation Complète de Tous les TPs et de l'Interface au Mobile & Tablette`
**Date** : 19/11/2026
**Statut** : Validé, testé (113/113 tests, `npm test` sans `--test-force-exit`) & compilé (`vite build` sans erreur)

---

## 1. Contrôles Tactiles Globaux, Viewport Mobile/Tablette & Performances

1. **Détection multi-appareils & sensibilité tactile ([src/core/gameState.js](file:///opt/atelier-dev/src/core/gameState.js))** :
   - Ajout de `detectDeviceProfile(env)` (distingue smartphone, tablette y compris iPadOS `Macintosh` + `maxTouchPoints > 1`, PC desktop et casque VR `OculusBrowser`/WebXR, ainsi que portrait/paysage).
   - Ajout du réglage persisté `touchSens` (`ciel_touch_sens`, borné `[0.4, 2.4]`) et de `setTouchSens()`.
2. **Rendu adaptatif & orientation ([src/world/SceneManager.js](file:///opt/atelier-dev/src/world/SceneManager.js), [src/world/PlayerController.js](file:///opt/atelier-dev/src/world/PlayerController.js))** :
   - Ajout de `computeAdaptivePixelRatio()` limitant le `devicePixelRatio` sur smartphone (`1.15` high / `1.0` balanced / `0.9` eco) et tablette (`1.25` / `1.1` / `1.0`) pour préserver FPS et autonomie, tout en conservant le plafond desktop `1.5` en qualité `high`.
   - Écouteurs `orientationchange` & `visualViewport` avec nettoyage propre dans `dispose()`.
   - Unification Pointer Events (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) dans `PlayerController` avec sensibilité tactile indépendante (`setTouchSensitivity`) tout en conservant la compatibilité clavier/souris/PointerLock PC.
3. **Ergonomie HUD, Joystick & Bouton Contextuel ([index.html](file:///opt/atelier-dev/index.html), [src/ui/TouchControls.js](file:///opt/atelier-dev/src/ui/TouchControls.js), [src/ui/HudManager.js](file:///opt/atelier-dev/src/ui/HudManager.js), [src/ui/SkinCustomizer.js](file:///opt/atelier-dev/src/ui/SkinCustomizer.js), [src/main.js](file:///opt/atelier-dev/src/main.js))** :
   - Viewport optimisé (`viewport-fit=cover`, `100dvh`, `touch-action: none` sur les canvas 3D, prévention du scroll/pull-to-refresh).
   - `TouchControls` entièrement en Pointer Events avec capture de pointeur, joystick fluide gauche, zone caméra droite, et gros bouton contextuel `#touch-context-interact` (`[👆 Interagir]`) alimenté en temps réel par proximité ou visée caméra (`activeTouchTarget`).
   - Slider `#set-touch-sens` dans les paramètres, repli automatique de la minimap et des quêtes sur mobile/tablette (`touchMode || innerWidth <= 1024`), et rotation tactile par Pointer Events sur l'aperçu 3D de `SkinCustomizer`.
4. **CIEL OS sur Mobile & Tablette ([src/main.js](file:///opt/atelier-dev/src/main.js), [src/minigames/TouchTpHelpers.js](file:///opt/atelier-dev/src/minigames/TouchTpHelpers.js))** :
   - Activation automatique du mode Plein Écran Confort sur appareil tactile (`touch-action: none`, Pointer Events sur `#ciel-os-comfort-canvas` et sur l'écran 3D), et manette overlay `#ciel-os-touch-pad` générée par `getCielOsTouchLayout(activeAppId)` pour les 6 mini-jeux (`Cyber Snake`, `Démineur` avec bouton drapeau `KeyF`, `CIEL-Blocks / Tetris`, `Casse-Briques`, `Flappy Packet`, `2048`), le Terminal CIEL et le Bloc-Notes.

---

## 2. Refonte Tactile Universelle des 9 TPs 3D & de l'Établi Commun

- **Socle commun ([src/minigames/Workbench3DHost.js](file:///opt/atelier-dev/src/minigames/Workbench3DHost.js), [src/minigames/TouchTpHelpers.js](file:///opt/atelier-dev/src/minigames/TouchTpHelpers.js))** :
  - `pixelRatio` adaptatif et shadow map optimisée sur mobile, pinch-to-zoom à 2 doigts sur la scène 3D, tolérance de sélection tactile élargie (`tapThreshold = 16px`), barre `#tp3d-zoom-bar` (`🔍+`, `🔍−`, `🎯`, `#tp3d-inspect-btn`, `#tp3d-drawer-toggle`), surcouche `createInspectZoomOverlay`, boutons d'ajustement fin `[-]` / `[+]` ajoutés automatiquement autour de tout `<input type="range">` via `enhanceRangeInputsWithSteppers` (avec maintien prolongé) et pavés tactiles `createVirtualKeypad` (`ip-cli`, `numeric`, `hex`, `binary`) évitant le clavier système. Exclusion explicite des steppers/pavés dans `extractDrawerControls()` pour préserver 100 % la compatibilité VR.

| TP 3D | Fichier | Adaptations Tactiles, Drag & Tap-to-Connect, Zoom & Aides |
| :--- | :--- | :--- |
| **1. Oscilloscope & Signaux 3D** | [src/minigames/OscilloscopeGame.js](file:///opt/atelier-dev/src/minigames/OscilloscopeGame.js) | Glisser-déposer 3D de la pince `GND` et de la sonde rouge sur `TP1..TP3` + Tap-to-Connect dans le tiroir ; curseurs `Trigger`, `VOLTS/DIV`, `TIME/DIV` avec boutons `[-]`/`[+]`, bascule `AC/DC`, zoom plein écran `🔎 Zoom Oscillo`, actions `💡 Indice` & `🔄 Réinitialiser`. |
| **2. Brasure & Soudure PCB 3D** | [src/minigames/SolderingGame.js](file:///opt/atelier-dev/src/minigames/SolderingGame.js) | Logique partagée `beginPadAction` / `tickPadHold` / `finishPadAction`, sélecteur des 8 pastilles (`>= 44px`), réglage fin station `[-]`/`[+]` (`260–420°C`), bouton tactile maintenu `🔥 Maintenir pour Braser / Nettoyer`, vue schématique `🔎 Zoom PCB`, `💡 Indice` & `🔄 Réinitialiser`. |
| **3. Électronique & Multimètre Fluke 3D** | [src/minigames/ElectronicsGame.js](file:///opt/atelier-dev/src/minigames/ElectronicsGame.js) | Glisser-déposer 3D des résistances du bac vers la Breadboard + sélection `◀`/`▶` et boutons Tap-to-Connect `R_LED`, `R1`, `R2` (`>= 44px`), zoom écran `🔎 Zoom Multimètre`, `💡 Indice` & `🔄 Réinitialiser`. |
| **4. Baie de Brassage & Sertissage T568B** | [src/minigames/PatchPanelGame.js](file:///opt/atelier-dev/src/minigames/PatchPanelGame.js) (et `PatchRackGame.js`) | Glisser-déposer 3D projeté des prises `P01..P24` vers `S01..S24` + Tap-to-Connect sur prises et sur les lignes du cahier de brassage ; réordonnancement T568B par tap ou boutons `▲`/`▼` (`>= 44px`), zoom `🔎 Zoom Testeur`, `💡 Indice` & `🔄 Réinitialiser`. |
| **5. Switch VLAN 802.1Q & Routage CLI** | [src/minigames/VlanConfigGame.js](file:///opt/atelier-dev/src/minigames/VlanConfigGame.js) (et `VmVlanGame.js`) | Pavé tactile intégré `ip-cli` (`createVirtualKeypad`) avec presets Switch IOS (`vlan`, `trunk gi0/24`, `gw`, `ping`) évitant le clavier mobile, historique CLI dans le tiroir, gros boutons VLAN/Access/Trunk/GW (`>= 44px`), zoom `🔎 Zoom Console`, `💡 Indice` & `🔄 Réinitialiser`. |
| **6. Cybersécurité SOC 3D** | [src/minigames/AntivirusGame.js](file:///opt/atelier-dev/src/minigames/AntivirusGame.js) | Boutons SOC espacés (`>= 44px`), saisie manuelle IP/Port pare-feu avec pavé tactile `ip-cli` (`185.42.19.88`, `91.203.11.4`, `4444`), zoom moniteur `🔎 Zoom IDS` et bouton `💡 Indice`. |
| **7. Montage & Maintenance PC 3D** | [src/minigames/PcHardwareGame.js](file:///opt/atelier-dev/src/minigames/PcHardwareGame.js) | Glisser-déposer 3D unifié (`bindTrayPart`) pour CPU, pâte, ventirad, RAM DDR5, SSD NVMe M.2, GPU PCIe et câbles ATX + tiroir tactile guidé pas à pas (`ESD`, `Socket`, `A1/A2/B1/B2`, `M.2`, `PCIe`, `ATX`, `POWER`), zoom `🔎 Zoom BIOS` et `💡 Indice`. |
| **8. Régie Éclairage DMX512 3D** | [src/minigames/DmxLightingGame.js](file:///opt/atelier-dev/src/minigames/DmxLightingGame.js) (et `AudioVisualGame.js`) | Glisser-déposer 3D sur ports XLR + liens Daisy-Chain cliquables en Tap-to-Connect ; boutons `[-]`/`[+]` sur tous les faders (`Master`, `R`, `G`, `B`, `Pan`, `Tilt`), pavé numérique `#️⃣ Pavé DMX` intégré pour l'adressage (`1..505`), zoom `🔎 Zoom Écran DMX`, `💡 Indice` & `🔄 Réinitialiser`. |
| **9. Studio Régie Broadcast Vidéo & Son 3D** | [src/minigames/StudioRegieGame.js](file:///opt/atelier-dev/src/minigames/StudioRegieGame.js) | Glisser-déposer 3D sur connecteurs SDI/XLR + lignes de patch cliquables ; ajustement fin `[-]`/`[+]` sur les 8 curseurs Optique/Chroma/Audio, sélection tactile `Preview CAM-1/CAM-2`, `CUT/TAKE`, `+48V`, `HPF 80Hz`, zoom `🔎 Zoom PGM`, `💡 Indice` & `🔄 Réinitialiser`. |

---

## 3. Mise en Page Responsive CSS, Versioning & Validation

- **CSS Responsive `360px`–`1024px` ([src/styles/main.css](file:///opt/atelier-dev/src/styles/main.css), [src/styles/minigames.css](file:///opt/atelier-dev/src/styles/minigames.css))** :
  - Hauteurs `100dvh`, `safe-area-inset-bottom`, cibles minimales `44px × 44px` (`48px–56px` sur joystick/manette), tiroir repliable sur smartphone portrait/paysage sans débordement horizontal, cartes modales bornées à `100vw - 16px` / `100dvh - 16px`.
- **Versioning** : `v4.26` dans [vite.config.js](file:///opt/atelier-dev/vite.config.js) et en tête de `CHANGELOG_RELEASES` (`DERNIÈRE MÀJ`) dans [src/ui/ChangelogModal.js](file:///opt/atelier-dev/src/ui/ChangelogModal.js) (`v4.25` passée à `HISTORIQUE`).
- **Tests automatisés** :
  - Nouvelle suite dédiée [tests/mobile-tp.test.js](file:///opt/atelier-dev/tests/mobile-tp.test.js) (4 groupes de tests complets, zéro fuite de timers/sockets).
  - `npm test` (`node --test tests/*.test.js`) : **113 tests exécutés, 113 réussis, 0 échec**.
- **Build de production (`npm run build`)** : **Succès** (`vite build` : 61 modules transformés en 13.09s, 0 erreur).
- **Intégrité des fichiers protégés & zéro commentaire** : `server/data/map.json`, `server/data/db.json`, `server/data/accounts.json` et géométrie des salles non modifiés ; `0` commentaire dans tous les fichiers générés ou modifiés.
