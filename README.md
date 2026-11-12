# Atelier CIEL 3D — Quêtes du Professeur CIEL (BAC PRO CIEL)

Jeu éducatif 3D optimisé pour navigateur sur le **BAC PRO CIEL** (Cybersécurité, Informatique et réseaux, Électronique), propulsé par **Three.js + Vite** et un serveur **Node.js (Express + WebSocket `ws`)** prêt pour le multijoueur en temps réel.

## Fonctionnalités

- **Atelier 3D Salle E204** : Exploration libre (ZQSD / Flèches + Souris), optimisation adaptative (Qualité Élevée / Équilibrée / Éco PC Lycée) et pause automatique du rendu 3D pendant les TP.
- **Donneur de quêtes : Professeur CIEL** : Accueil, suivi de progression sur 20, conseils techniques par TP, validation du diplôme BAC PRO CIEL.
- **5 Mini-Jeux Métiers (3 niveaux progressifs chacun)** :
  1. **〰️ Oscilloscope** : Base de temps, V/div, couplage DC/AC, Trigger, curseurs Δt/ΔV, sinusoïde, PWM et diagnostic Dual-Trace CH1/CH2.
  2. **🔥 Brasure PCB** : Réglage station sans plomb SAC305 (340–365°C), extracteur de fumées (EPI), temps de chauffe, brasure CMS SOIC-8 et tresse à dessouder.
  3. **⚡ Électronique** : Code couleur 4 anneaux, Loi d'Ohm LED, pont diviseur 5V → 3.3V, transistor NPN + diode de roue libre avec multimètre temps réel.
  4. **🛡️ PC Envahi de Virus & Antivirus** : Bureau CIEL-OS infecté, isolation réseau, gestionnaire des tâches (`svch0st.exe`), installation & mise à jour CielGuard EDR, quarantaine, pare-feu et tâches planifiées.
  5. **🌐 VM & VLAN Complet** : Allocation hyperviseur (vCPU/RAM/SSD/vNIC), ports Switch `ACCESS` / `TRUNK 802.1Q`, sous-interfaces Routeur-on-a-Stick, règles ACL pare-feu, aperçu CLI Cisco IOS et simulation de pings.
- **Architecture Serveur & Multijoueur** :
  - Synchronisation temps réel des avatars d'élèves dans la même salle via WebSocket (`/ws`).
  - Chat de classe, annonces automatiques du Professeur CIEL et tableau d'honneur persisté sur le serveur.

## Démarrage rapide

```bash
npm install
npm run build
npm start
```

Ouvrir ensuite `http://localhost:3000` dans votre navigateur.

## Tests

```bash
npm test
```
