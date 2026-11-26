# Référence de production — 26 novembre 2026

Site officiel : https://www.ronde-des-archanges-universelle.eu

Worker : `celebrations-exit-production`. Version active observée : `b12d2bf3-5201-407f-b7a8-0affdb2e2d08` (23 novembre 2026, 06:32 UTC). Déploiement `ba3bbae9-1d6c-492c-be08-37b93302b1f6`, via API.

## Source GitHub
Le workflow `.github/workflows/celebrations-m051-pinned-release.yml` sur main désigne le commit `114358fd5eca5d1af5422efd19e92a754e6032c8` de `fix/production-documents-compact-20261120`. Ce commit est une base candidate, PAS une preuve d'identité avec le Worker du 23 novembre. Les déploiements API ultérieurs doivent être réconciliés avant toute publication.

## Nettoyage
Comparaison avec ce commit : `production/celebrations-live`, `develop/celebrations-maintenance`, `development/celebrations-current` ont zéro commit propre. Vérifier les références de workflows avant suppression. `main` diverge (37 commits propres) : ne pas écraser. Audit exhaustif des autres branches encore requis. Aucun effacement autorisé par ce document.

## Sauvegardes
R2 production : `maintenance-backups/2026-11-26/worker-source.multipart.txt` et `maintenance-backups/2026-11-26/server-drafts-v1.json`. Copies créées ; intégrité et restauration à tester. D1 production `28736d2a-479b-472b-bf82-703ad0affe10`, sauvegarde indépendante à compléter. Les deux bindings R2 MEDIA_BUCKET et EDITOR_BUCKET utilisent `celebrations-exit-production`.

## Déploiement cible
Une source canonique, tests ciblés, construction reproductible, upload d'une version non active, vérification des bindings et promotion explicite avec rollback. Ne pas réutiliser les identifiants de baseline anciens du workflow M051. Ne pas modifier DNS, données ou médias pour une correction de code. Ne pas activer un nouveau workflow avant réconciliation du code déployé.
