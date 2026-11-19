# RAPPORT TECHNIQUE — Mise à jour v4.25
**Titre** : `v4.25 - Refonte & Équilibrage de Tous les Barèmes (20/20 Accessible et Transparent)`
**Date** : 19/11/2026
**Statut** : Validé, testé (109/109 tests) & compilé (Vite build production sans erreur)

---

## 1. Synthèse de l'Audit & Principes Appliqués

1. **Moteur de notation unifié ([src/core/grading.js](file:///opt/atelier-dev/src/core/grading.js))** :
   - Suppression de tout risque de `NaN`, `Infinity` ou dépassement hors `[0, 20]` via `toSafeNumber`.
   - Harmonisation des arrondis avec `finalizeGrade20` : arrondi généreux au `0.5` supérieur (`roundHalfUp`), et attribution automatique de `20/20` dès que le score brut atteint `>= 19.25` sans erreur critique (plafonné à `19.5` si une exigence critique manque).
   - Génération systématique d'un objet `breakdown` structuré pour afficher le barème point par point sur PC (`renderBreakdownHtml`) et sur le panneau spatial VR (`buildBreakdownLines`).
2. **Correction des plafonds bloqués & pondérations exactes sur 20** :
   - Suppression des bugs qui bloquaient la note maximale à `19/20` ou `19.5/20` dès que le temps dépassait `150–160s` (`VlanConfigGame`, `PatchRackGame` / `computeRackVlanScore3D`, `StudioRegieGame`).
   - Toutes les grilles d'évaluation totalisent désormais exactement `20.0` points de critères principaux, plus un bonus confort de rythme et un arrondi bienveillant.
3. **Droit à l'erreur corrigée, chronos confortables & tolérances VR/PC élargies** :
   - Les 1 à 2 premières erreurs mineures / reprises (reprises à la tresse, mauvais clic sonde, 1er ESD oublié avant manipulation ou 1er POST raté, surintensité corrigée, faux positif SOC) sont désormais pardonnées (`0 pt`) lorsque l'élève corrige et rend un résultat conforme ; les pénalités au-delà sont plafonnées.
   - Les temps cibles pour obtenir le plein de points passent à `300s–420s` (5 à 7 minutes) afin de s'adapter confortablement à la visée et aux déplacements VR WebXR.
   - Les seuils de validation et tolérances analogiques (Oscilloscope, Brasure, Électronique, DMX512, Studio Régie, AudioVisual) sont élargis, et le drain d'intégrité du poste SOC (`AntivirusGame`) est fortement adouci avec restauration `+15%` à la fin du scan EDR.
4. **Transparence PC & VR + Célébration 20/20** :
   - Sur PC (`MiniGameModal` + `minigames.css`) et sur le panneau spatial VR (`VRHudPanel`), affichage du détail complet critère par critère (`obtenu / max`), des erreurs pardonnées, des gains XP / CIEL Coins, d'un conseil concret si la note est `< 20`, du bandeau doré `🏆 PARFAIT 20/20` et de la nouvelle fanfare `sfx.perfect20()`.

---

## 2. Tableau Récapitulatif Avant / Après de Chaque Barème

| TP / Module | Avant (v4.24) | Après (v4.25) |
| :--- | :--- | :--- |
| **Moteur commun** (`grading.js`) | Formules hétérogènes (`Math.round`, `round*2/2`, `round*10/10`) sans récapitulatif structuré | `finalizeGrade20` (arrondi `0.5` supérieur, `>= 19.25` sans erreur critique → `20/20`) + `createGradeBreakdown` PC & VR |
| **TP Oscilloscope** (`OscilloscopeGame.js`) | `durationSec <= 130s` pour 1 pt (`<= 200s` : 0.5 pt) ; `-0.7/erreur` dès la 1re (max `-3.5`) ; tolérances étroites (`framing 1.2..6.5`, `fErr 8%`, `vPerDiv <= 2` sur TP3) | Temps confortable `<= 300s` (1 pt) / `<= 480s` (0.75) / `> 480s` (0.5) ; 2 premières erreurs pardonnées (`0 pt`), puis `-0.75` max `-2.5` ; tolérances élargies (`1.0..8.0` périodes, `fErr 12%`, `vPerDiv <= 5`) + breakdown |
| **TP Brasure PCB** (`SolderingGame.js`) | Température `335–370°C`, chrono `<= 240s` pour 1 pt, `-1.5/surchauffe` et `-0.25/reprise` dès la 1re, surchauffe dès `405°C` | Température `330–375°C` (partiel `310–390°C`), chrono `<= 360s` (1 pt) / `<= 540s` (0.75) / `> 540s` (0.5) ; 2 reprises offertes, surchauffe `425°C` + chauffe ralentie, pénalités plafonnées (`-2.5`) + breakdown |
| **TP Électronique** (`ElectronicsGame.js`) | LED `6–32 mA`, pont `3.10–3.45V`, `-1.5/burn` dès le 1er, pénalité temps après `240s` (max `-1.5`) | LED `5–35 mA`, pont `3.00–3.50V`, 1re surintensité corrigée offerte (`0 pt`, puis `-0.75` max `-2.0`), aucune pénalité temps jusqu'à `420s` (max `-0.5`) + breakdown |
| **TP Cybersécurité SOC** (`AntivirusGame.js`) | Drain intégrité rapide (`1.3/s`), `-6%` sur clic `svchost.exe`, score exigeait `100%` d'intégrité pour `3/3` pts, `-1.2/erreur` dès la 1re, chrono `> 200s` pénalisé (`-1.5`) | Drain divisé par ~3 (`0.45/s`), `+15%` restaurés après scan EDR, score max intégrité dès `>= 60%`, 1re erreur pardonnée si réseau sécurisé (puis `-0.75` max `-2.25`), chrono confortable `360s` (max `-0.5`) + breakdown |
| **TP VLAN 802.1Q** (`VlanConfigGame.js`) | Somme sans bonus temps bloquée à `19/20` (Trunk `3 pts`, bonus `1 pt` perdu après `160s` / `150s`) ; seuil son à `12/20` | Somme critères principaux portée à `19.5/20` + rythme confortable (`0.5` jusqu'à `300s`, `0.25` jusqu'à `480s`) = `20/20` garanti sans speedrun ; seuil validation `>= 10` + breakdown |
| **TP Baie de Brassage & Rack** (`PatchPanelGame.js`) | `computePatchPanelScore3D`: plafond à `19/20` si temps `>= 140s` ; `computeRackVlanScore3D`: plafond à `19/20` si temps `>= 160s` et `-0.5/erreur` dès la 1re ; `evaluatePatchConfiguration` exigeait `>= 12/20` | `20/20` atteignable jusqu'à `450s`/`480s` et au-delà via arrondi généreux ; 2 premières `cableErrors` pardonnées ; `evaluatePatchConfiguration` validée dès `>= 10/20` + breakdown |
| **TP Montage PC** (`PcHardwareGame.js`) | `-1.2/erreur ESD` et `-0.8/POST raté` dès la 1re erreur ; pénalité temps après `240s` (max `-2.0`) ; `evaluateHardwareBuild` validé à `>= 12/20` | 1re erreur ESD & 1er POST raté pardonnés si corrigés (pénalité totale plafonnée à `-3.0`) ; temps confortable `420s` (max `-0.5`) ; `evaluateHardwareBuild` validé à `>= 10/20` + breakdown |
| **TP DMX512 & AV** (`DmxLightingGame.js`, `AudioVisualGame.js`) | Master `>= 60`, RGB `±55`, Pan/Tilt `±18` ; AV Kelvin `±200K`, Dimmer `70–85%`, Audio `-14..-10 dBFS`, `passed >= 13/20` | DMX Master `>= 55`, RGB `±65`, Pan/Tilt `±22` ; AV Kelvin `±300/350K`, Dimmer `65–90%`, Audio `-15.5..-8.5 dBFS`, `passed >= 10/20`, chrono `300–450s` + breakdown |
| **TP Studio Régie** (`StudioRegieGame.js`) | **Bug mathématique** en mode Patch : somme max sans `allMet` bloquée à `19.5/20` (WB `1.0 pt` au lieu de `1.5`), tolérances étroites (`Focus ±8`, `Iris ±9`, `WB ±250K`, `Chroma 74–94%`, `-14.5..-9.5 dBFS`) | Somme max exacte `20.0/20` (WB `1.5 pt`), tolérances élargies (`Focus ±12`, `Iris ±12`, `WB ±350K`, `Chroma 70–96%`, `-15.5..-8.5 dBFS`), bonus temps jusqu'à `300s` + breakdown |
| **Moyenne, Économie & Persistance** (`store.js`, `gameState.js`, `main.js`) | Filtrage `typeof === 'number'` sans `Number.isFinite` | Filtrage strict `Number.isFinite` et clamp `[0, 20]` ; 100% rétrocompatible avec `db.json`, `accounts.json` et `computeTpCoinReward` (25/50/100 + 50 CC) |

---

## 3. Résultats des Tests & du Build

- **Tests automatisés (`node --test --test-force-exit tests/*.test.js`)** : **109 tests exécutés, 109 réussis, 0 échec**.
  - Nouvelle suite dédiée [tests/grading-scales.test.js](file:///opt/atelier-dev/tests/grading-scales.test.js) validant les 9 TPs actifs + toutes les fonctions auxiliaires, l'anti-`NaN`, les temps non-speedrun, le droit à l'erreur corrigée, le panneau résultat VR, `computeAverage`, `GameStore` et l'absence de nom interdit.
- **Build de production (`npm run build`)** : **Succès** (`vite build` sans aucune erreur).
- **Protection des données & règles strictes** : `server/data/map.json`, `server/data/db.json`, `server/data/accounts.json` et les fichiers de géométrie n'ont subi aucune modification ; zéro commentaire dans les fichiers générés/modifiés.
