# M018-C — Finalisation de l'administration

**Base** : `feat/celebrations-m018-official-release-prep-20261111` · `cd1fc0ccf4b90fc3f414c85f95cc955811e0c089`  
**Branche** : `feat/m018c-admin-finalization-20261111` · **PR #148 (brouillon)**.

## Fonctions ajoutées

- Les rubriques **Pages** et **Célébrations** conservent leur éditeur et leur disposition. Leurs menus discrets comportent désormais la **duplication** et l'accès aux réglages privés.
- Les duplications de page ou de célébration partent **en brouillon non publié**, en copiant exclusivement les textes, blocs et versions linguistiques, jamais les attributions individuelles, inscriptions ni droits.
- Une version linguistique peut être copiée vers une autre langue **au sein de la même page et célébration**. Aucune traduction automatique ; seule l'administration rédige, active et publie les langues.
- Deux rubriques ajoutées au menu existant : **Participants** (annuaire D1, fiches, participations et inscriptions) et **Langues et catégories** (gestion du registre et catégories via les composants D1 existants).
- Les politiques canoniques de célébration, d'espace et de page acceptent désormais **plusieurs catégories sélectionnées** tout en préservant les catégories historiques.
- Les contrôles existants de brouillon/publication/masquage restent en place, les accès privés s'éditent via le panneau authentifié existant, et les formulaires de catégories ne s'affichent que si nécessaire.

## Sécurité et limites

- Aucun changement du moteur de sécurité serveur, de la navigation des visiteurs, des tables de production ni du site officiel : ces domaines restent aux missions **M018-A/B**.
- Les nouvelles commandes de duplication ne transfèrent jamais de droits. **Aucune page privée ordinaire ne doit être déclarée protégée sans validation serveur M018-A/B.**
- L'éditeur existant et son mécanisme de publication explicite restent la référence. Les contenus en brouillon ne sont pas rendus publics automatiquement.

## Vérification

- Analyse syntaxique du client embarqué `DEMO_CLIENT` et du module M012B régénéré : réussie.
- Tests supplémentaires : `tests/test_m018c_admin_finalization.mjs` (navigation, absence de copie des droits, versions de langue).
- Le workflow de régression éditeur a été étendu pour les lancer ; vérifier les résultats dans la PR avant fusion.
