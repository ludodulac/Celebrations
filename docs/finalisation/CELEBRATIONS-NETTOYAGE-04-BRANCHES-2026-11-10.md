# CÉLÉBRATIONS — NETTOYAGE MISSION 04 — RÉFÉRENCES GIT SANS RISQUE
_Date : 10 novembre 2026._

## Quelle version faut-il utiliser ?

| Rôle | Branche / commit | Statut |
| --- | --- | --- |
| **Référence exacte du code publié** | `production/celebrations-live` — `65caf8d5d03d29882d0de0c0d00cdcfc622e473e` | Copie de référence, **ne pas pousser du code dessus**. Version Cloudflare Worker déjà publiée : `eccb1274-2ed8-491f-8557-c4330342e4bf`. |
| **Référence du développement actuel** | `development/celebrations-current` | Série des nettoyages M1–M3, créée depuis `a17e235f21a99158ed34ef12cbc52ddbc0ef3f5e`, et à mettre à jour à la validation M4. **Non publiée**. |
| **Travail de mission 4 / PR** | `cleanup/celebrations-04-branches-20261110` | Documentation, contrôles, aucun déploiement. |
| **Ancien main préservé** | `archive/celebrations-old-main-20261110` — `4b5edd9c19ce989af2eae33445017dd30fcbbe92` | Copie fidèle de l'ancien `main`. |
| **Branche GitHub par défaut** | `main` — `4b5edd9c19ce989af2eae33445017dd30fcbbe92` à l'inventaire | **Toujours ancien**. Ne pas l'utiliser pour les changements Cloudflare tant qu'il n'est pas réconcilié de manière contrôlée. |
| **Base historique de livraison** | `release/celebrations-finalisation-05-livraison-20261109` | Source de production initiale, PR #106 DRAFT, à conserver. |

## Pourquoi ne pas remplacer directement main ?

L'ancien `main` et la branche Cloudflare **ont divergé** : comparaison contrôlée le 10 novembre 2026, `main` est derrière de 1 780 commits et devant de 3 relativement à M3. Il n'y a donc pas de mise à jour rapide (« fast-forward ») sûre. Forcer son remplacement risquerait de perdre des changements historiques et de déclencher l'ancien workflow GitHub Pages `.github/workflows/pages.yml` (`push` sur `main`). La migration du site officiel ne nécessite pas de toucher `main` aujourd'hui.

**Aucune mise à jour forcée de main, aucun changement de branche par défaut, aucun déploiement GitHub Pages ou Cloudflare dans M4.**

## Protocole sans ambiguïté pour les nouvelles missions

1. **Coder** depuis `development/celebrations-current` (ou la branche de la mission précédente si elle attend validation), jamais depuis `main`.
2. **Vérifier** hors production : Node + Python, build d'assets, isolation privé/public. Prévoir un test navigateur pour une modification visuelle.
3. **Soumettre** une PR DRAFT depuis la branche de mission. Ne pas associer le mot-clé de publication `[M05_PUBLISH_OFFICIAL_ONCE]` aux commits ordinaires.
4. **Pour déployer**, partir d'un commit validé et identifié, refaire les précontrôles production, sauvegarder l'identifiant Worker précédent, déployer de façon contrôlée puis tester domaine www et racine, brouillons privés, médias et liens.
5. **Après vérification de la version réellement active** sur Cloudflare, faire avancer la référence `production/celebrations-live` uniquement vers le commit exact qui a produit cette version. Ne jamais prétendre qu'une branche non publiée est en production.

## Ce qui reste à faire pour une véritable branche par défaut unique

L'**identification** et la **sauvegarde** de toutes les références sont terminées. La modification de la *branche par défaut du dépôt GitHub* n'est pas effectuée : elle demanderait la capacité de changer les paramètres du dépôt, une décision explicite sur l'ancien site GitHub Pages, et une validation du pipeline CI sur la future branche par défaut. On ne force pas `main` juste pour déclarer cette tâche « faite ». Dans l'intervalle, la branche **`development/celebrations-current`** est la référence opérationnelle pour les travaux Cloudflare, documentée sans ambiguïté.

## Contrôles requis

- Vérifier les 4 références à leur SHA attendu.
- Vérifier que `main` n'a pas bougé ; la branche de sauvegarde de `main` est inchangée.
- Vérifier que `production/celebrations-live` pointe vers le même commit que la version publiée au démarrage des nettoyages.
- Vérifier que le nettoyage M4 n'a modifié aucun fichier applicatif et n'a provoqué aucun push sur `main`.
- Le site Cloudflare doit rester **exactement inchangé**.

L'étape suivante (M5) peut préparer les paramètres et sauvegardes Cloudflare depuis `development/celebrations-current`, sans basculer le domaine ni accéder au compte du collègue.
