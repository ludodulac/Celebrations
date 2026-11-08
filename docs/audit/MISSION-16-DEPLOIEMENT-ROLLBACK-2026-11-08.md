# 🌸 CÉLÉBRATIONS — Mission 16 : déploiement et retour arrière

**Date :** 8 novembre 2026. **Branche :** `refactor/celebrations-mission-16-release-rollback-20261108` dérivée de M15/PR #95. **PR DRAFT ; zéro déploiement, zéro écriture D1/R2.**

## Constat vérifié

La mission 03 avait découvert une divergence entre la version du Worker officiel observée le 7 novembre (`7cbfdbd...`) et l'ancien commit GitHub `94affae...` inscrit dans le workflow de publication. Ce workflow reconstruisait un prétendu retour arrière depuis **trois fichiers d'éditeur très anciens** et relançait un `wrangler deploy`. Un tel « rollback » **ne restitue pas nécessairement le Worker exact ni ses dépendances, assets, bindings, routes, secrets ou réglages**.

La sauvegarde privée chiffrée réalisée en M03 ne contient que **le JSON éditorial à la révision 114**. Elle ne contient ni l'intégralité de la base D1 actuelle, ni les octets de tous les médias historiques et nouveaux, ni une copie indépendante de Cloudflare. Ces lacunes demeurent **des conditions bloquantes**.

## Changements réalisés en mission 16 (code, hors production)

1. **Blocage du vieux workflow dangereux sur cette branche.** Le job historique de `celebrations-publish-visual-site-once.yml` est conditionné à `false`, le retrait de la récupération depuis `94affae...` est explicite et son ancien rollback automatique est remplacé par un **arrêt signalant l'absence de version précédente certifiée**. Il ne déploiera rien depuis la branche M16. **Important : tant que cette PR n'est pas intégrée à sa branche source, l'ancienne version du workflow reste inchangée ailleurs**. Ne pas prétendre que cette seule modification désactive les autres workflows déjà publiés.
2. **Modèle de release strict** dans `app/release/editor-release-policy.mjs` : le déploiement actif du Worker Cloudflare est identifié par le **vrai identifiant de déploiement et de version**, avec 100 % du trafic sur une version unique. Une autre version active, ou un autre identifiant, bloque l'opération.
3. **Lecture API Cloudflare sans modification** dans `scripts/mission16_capture_worker_readonly.mjs`. Il ne fait qu'un GET du déploiement du Worker `celebrations-exit-production`. Les identifiants de version doivent être capturés à chaque future release ; **un commit Git ne suffit pas**. Aucun secret n'est écrit dans les fichiers ou les logs.
4. **Préflight de preuves** dans `scripts/mission16_release_preflight_readonly.mjs` : refus systématique si une seule preuve obligatoire manque, est ancienne, ou diffère. Critères obligatoires : preuve de restauration du **bundle exact de Worker sur candidat isolé** (hachage du bundle + assets + configuration), sauvegarde chiffrée R2 et copie indépendante relue, JSON éditorial exact et ETag stable, export intégral des tables D1 avec restauration dans SQLite isolée (intégrité, clés étrangères et compteurs), archive indépendante de **tous les octets médias** avec empreintes et chemins historiques, validation explicite du propriétaire. Le préflight reste **uniquement une validation** : aucun déploiement automatique n'y est implémenté.
5. **Plan de rollback exact et non exécuté** : il énonce `wrangler rollback <VERSION_ID> --name celebrations-exit-production --message ...` seulement si l'identité de la nouvelle version encore en ligne correspond à la version qui vient d'échouer et qu'un propriétaire a donné son accord. Ce retour arrière du Worker ne **restaure pas les données D1/R2** et n'est pas automatiquement exécuté par le script.
6. **Une matrice unique des tests M05–M15**, extraite dans `scripts/mission16_editor_regressions.mjs` afin d'éviter la duplication des longues commandes dans le nouveau workflow M16.

## Recommandation pour un futur déploiement (non exécutée)

**Phase A — vérification initiale** : conserver et identifier exactement le Worker actuel, ses assets/config/bindings, la base D1, l'objet éditorial et tous les médias par inventaire et empreintes. Le propriétaire doit conserver une archive chiffrée hors Cloudflare et en éprouver la restauration indépendante.

**Phase B — répétition isolée** : tester la **version précise actuellement publiée** sur un candidat Worker sans domaine public ni écriture aux données réelles. Réimporter l'export D1 dans une base SQLite isolée, comparer la structure et chaque table ; relire chaque média restauré pour prouver que les liens originaux sont récupérables.

**Phase C — décision propriétaire** : publier uniquement après preuves complètes, revue des tests de référence (M02) et autorisation explicite à une release **précise**, indépendante des autorisations des missions de nettoyage.

**Phase D — surveillance et éventuel rollback** : si un problème survient, vérifier qu'aucune autre release n'est intervenue, obtenir l'accord de retour arrière, et réactiver l'**ancienne version Cloudflare exacte**, sans employer un commit historique choisi arbitrairement. Réexaminer séparément D1 et R2 si les données ont changé.

## Blocages encore ouverts

| Protection | État à ce stade |
|---|---|
| Identifiant du Worker réellement actif et bundle complet archivé | **NON ATTESTÉ par une récupération Cloudflare live dans M16** |
| Rejeu de l'ancien Worker exact sur candidat isolé | **NON EXÉCUTÉ** |
| Archive JSON éditeur actuelle et copie hors Cloudflare | **NON CERTIFIÉ** (M03 : sauvegarde chiffrée rév. 114, récupération en RAM uniquement) |
| Export complet récent D1 et restauration isolée avec relations | **NON EXÉCUTÉ** |
| Copie indépendante de tous les fichiers historiques et nouveaux | **NON CERTIFIÉ** |
| Approbation spécifique pour publier une version | **NON DEMANDÉE et NON ACCORDÉE** |
| Production du site / DNS / secrets / D1 / R2 | **INCHANGÉS** |

Une série de tests synthétiques pourra vérifier que les **contrats refusent les preuves insuffisantes**, mais ne saurait produire les preuves réelles à leur place. **Une CI verte n'autorise toujours PAS le déploiement.**

## Feuille de route

- Mission 17 : documentation cohérente et performances mesurées (sans mise en ligne).
- Mission 18 : recette générale, décisions séparées selon preuves de sauvegarde/restauration et tests utilisateurs.

**Ne pas fusionner cette PR ni enclencher un ancien workflow de déploiement pour tester la mission.**
