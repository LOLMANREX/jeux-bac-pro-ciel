# Consignes permanentes du projet Atelier CIEL 3D

RÈGLE OBLIGATOIRE DE MISE À JOUR : À chaque modification, correction ou ajout de fonctionnalité sur ce projet, tu dois impérativement incrémenter le numéro de version affiché dans l'interface et ajouter une nouvelle entrée datée tout en haut du rapport de mise à jour dans `src/ui/ChangelogModal.js` (et sur le badge de version) avant de faire le commit.

## Checklist avant chaque commit
1. Mettre à jour `__APP_VERSION__` dans `vite.config.js` ainsi que `APP_VERSION` dans `src/ui/ChangelogModal.js`.
2. Ajouter une nouvelle entrée datée tout en haut de `CHANGELOG_RELEASES` dans `src/ui/ChangelogModal.js` (et passer l'ancienne entrée la plus récente au tag `'HISTORIQUE'`).
3. Respecter la consigne sans commentaires dans le code généré ou modifié.
4. Vérifier que `npm test` et `npm run build` passent sans aucune erreur avant de faire `git commit` et `git push`.
