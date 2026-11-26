# Référence de production — réconciliation du 26 novembre 2026

## Source canonique proposée

Branche : `reference/production-reconciled-20261126`.

Site officiel : https://www.ronde-des-archanges-universelle.eu/ ; Worker : `celebrations-exit-production`.

Version active récupérée : `b12d2bf3-5201-407f-b7a8-0affdb2e2d08` (23 novembre 2026, 06:32:51 UTC), déploiement API `ba3bbae9-1d6c-492c-be08-37b93302b1f6`. La mission n'a effectué aucun déploiement, aucune suppression de branche et aucune écriture dans D1/R2 ou dans les contenus/comptes.

Base source : `114358fd5eca5d1af5422efd19e92a754e6032c8`, branche `fix/production-documents-compact-20261120`. Réconciliation : commit `452735ed` (`Reconcile modular sources with active Cloudflare production version`). Le commit de consolidation suivant a pour parents cette réconciliation et `cd3805062b707b1eb352606ce4f172bdb66b30f8` (main historique). Il conserve ainsi les deux lignées sans remplacer les modules modernes par l'ancien main. Retrouver son identifiant avec `git log --merges -1 --format=%H` sur cette branche.

## Preuve de correspondance

Le contenu exécuté a été récupéré en lecture seule par l'API Cloudflare `GET /accounts/{account}/workers/scripts/celebrations-exit-production/content/v2`. La réponse multipart contient un seul module `production-worker.js`, sans source map. Les métadonnées de version et les bindings ont été lus séparément.

SHA-256 du module récupéré : `48dc1fd805b0548a43441b3ecede71ec09f09d43218446d49e559551d80dee90`.

Les 93 modules sources sont reconstruits avec esbuild **0.25.12**, dépendance exacte et lockfile inclus. Le programme reconstruit et le module Cloudflare, traités par la même normalisation de syntaxe esbuild, sont **identiques octet pour octet**. Cette normalisation élimine les commentaires, variations de formatage, parenthèses facultatives et échappements Unicode ; elle ne neutralise pas les chaînes de caractères du client, les règles CSS ou la logique du programme.

SHA-256 normalisé commun : `2615576f877f7d295a6dd5cb23e06702b0a9b57dd307dfc8830c6b420bac86a4`. Paramètres exacts : `docs/reconciliation/production-manifest.json`. Aucun bundle compilé n'est utilisé comme source de maintenance.

L'inventaire a trouvé **219 branches distantes** au moment de la lecture. `docs/reconciliation/branch-source-audit.json` compare les blobs des 93 modules du Worker pour chaque branche à la base M051. C'est une présélection des sources, pas une assertion de parité de chaque branche avec Cloudflare. La reconstruction intégrale et la comparaison finale constituent la preuve de correspondance de la branche retenue.

## Différences cumulées réintégrées

| Fonction | Sources conservées et réconciliées |
|---|---|
| Marges hautes gauche/droite, ordinateur, bornes 0–500 px | `editor-demo-client-source.js`, projection publique `app/domain/editor-public-projection-security.mjs`, styles admin/public |
| Réglages de section déplacés vers les commandes racines et réglages par colonne | `editor-demo-client-source.js`, `app/styles/admin/04-section-composer.mjs` |
| Titres PDF sans préfixes répétés, liens ouvrir/télécharger, correction de `locationLabel` | `editor-trial-site-client.mjs`, `editor-demo-preparation-page.mjs` |
| Reconstruction fidèle de la barre de formatage existante | source de l'éditeur resynchronisée avec le corps déjà présent dans le fichier généré M051 ; régénération de `editor-demo-client.mjs` |

Le journal Cloudflare montre deux déploiements le 23 novembre, à 06:32:11 puis 06:32:51 UTC, précédés d'un déploiement le 22 novembre à 16:40:03 UTC. Le delta cumulé jusqu'à la dernière version est entièrement réintégré. L'API consultée ne fournit pas le corps des versions intermédiaires : la répartition précise de chaque modification entre ces déploiements n'est pas démontrée. Ne pas inventer cette attribution ; le journal est conservé dans `production-deployments.json`.

La fidélité inclut les imperfections déjà présentes en production : le nettoyage de certains anciens libellés possède des expressions régulières dont des antislashs ont été perdus dans le client assemblé, et les styles des nouveaux menus de marge contiennent des séparateurs littéraux. Ils n'ont pas été corrigés arbitrairement pendant cette réconciliation ; une correction ultérieure doit être traitée comme une évolution explicite avec nouvelle référence.

## Reconstruction et vérification sans publication

Avec Node 22 ou supérieur et Python 3.12 :

```sh
npm ci --ignore-scripts
npm run test:reference
npm run build:reference
python scripts/build_production_assets.py
python scripts/audit_production_supabase_paths.py
```

Pour modifier le corps de l'éditeur :

```sh
node scripts/build-m019-editor-client.mjs
node scripts/build-m019-editor-client.mjs --check
```

La reconstruction écrit uniquement `.reference-build/production-worker.js` et un inventaire d'entrées local. Les assets reconstruits sont dans `production-public/`. Ces sorties sont ignorées par Git. Un module Cloudflare nouvellement récupéré peut être comparé directement avec `npm run build:reference -- /chemin/production-worker.js`. Aucun script de référence ne publie ni ne lit de secrets.

Résultats : **30/30 tests ciblés passent**, source/généré synchronisés, client visiteur analysable, projection des marges testée, contrôles de brouillons/publication et accès testés. Construction statique : 96 fichiers. Audit des sorties publiques : zéro URL Supabase, zéro SDK Supabase, zéro SDK TUS. Deux tests de rendu historiques M009-A échouent (404 au lieu de 200), également sur le commit M051 intact : 21/23 passent dans les deux arbres ; aucune régression introduite par cette réconciliation sur ce lot.

Le navigateur a chargé l'accueil officiel « Accueil général — Célébrations des Archanges » et observé les deux scripts intégrés, sans JS/CSS externe dans cette page. Les requêtes de comparaison des 77 fichiers JS/CSS statiques depuis l'environnement de commande ont reçu 403 ; leur identité avec les anciens assets Cloudflare n'est donc pas certifiée (`static-assets-audit.json`). Le programme Worker reconstruit, qui produit les interfaces modernes intégrées, correspond intégralement à celui en ligne. Aucun test de saisie/enregistrement n'a été effectué sur les données réelles.

## Workflows et historique

Les workflows originaux de M051 et ceux du main sont conservés sans modification sous `docs/reconciliation/workflows-archive/`. Les anciens déclencheurs ne sont pas réactivés sur la branche de référence. Le nouveau workflow `reference-offline-validation.yml` exécute seulement les contrôles hors ligne, avec permission `contents: read`, sans secrets ni environnement Cloudflare. Aucun workflow de publication n'a été déclenché par cette mission.

Le main existant et toutes les branches sont conservés. Cette branche est destinée à devenir la source principale ; aucune fusion vers le main distant ni changement de branche par défaut n'est effectué ici. Une promotion future doit conserver ce workflow sans publication et remplacer les anciens workflows actifs, plutôt que fusionner les anciens scripts de déploiement à l'aveugle.

## Bindings et prochaine intervention

Configuration active : compatibilité `2026-10-16`, zéro drapeau explicite ; `ASSETS` avec passage Worker en premier. `DB` et `MEDIA_ACL` pointent vers D1 `28736d2a-479b-472b-bf82-703ad0affe10`. `MEDIA_BUCKET` et `EDITOR_BUCKET` pointent tous deux vers R2 `celebrations-exit-production`. Variables et noms de secrets requis, sans valeurs de secrets : manifeste JSON.

Avant toute publication future : relire la version active, comparer à la référence, utiliser les sources courantes de cette branche, garder exactement les bindings existants et obtenir une autorisation explicite pour la promotion. Ne pas réutiliser les baselines historiques M051. Ne pas appliquer de migration ou copie de données pour une simple modification de code.

Les sauvegardes signalées par le document initial (`maintenance-backups/2026-11-26/worker-source.multipart.txt` et `server-drafts-v1.json`) ne sont ni modifiées ni validées par cette mission. Aucun nouveau travail de sauvegarde de données n'est revendiqué.
