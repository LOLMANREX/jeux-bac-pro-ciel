# Instructions permanentes — Atelier CIEL 3D

RÈGLE OBLIGATOIRE DE MISE À JOUR : À chaque modification, correction ou ajout de fonctionnalité sur ce projet, tu dois impérativement incrémenter le numéro de version affiché dans l'interface et ajouter une nouvelle entrée datée tout en haut du rapport de mise à jour dans `src/ui/ChangelogModal.js` (et sur le badge de version) avant de faire le commit.

## Détails techniques associés
- Mettre à jour `__APP_VERSION__` dans `vite.config.js` pour actualiser le badge affiché sur l'écran d'accueil et le HUD.
- Mettre à jour le fallback `APP_VERSION` et ajouter l'entrée datée en tête de `CHANGELOG_RELEASES` dans `src/ui/ChangelogModal.js`.
- Toujours vérifier `npm test` et `npm run build` avant de commit et push sur GitHub.
