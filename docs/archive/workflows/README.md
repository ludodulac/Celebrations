# Archives des anciens workflows d'administration — 10 novembre 2026

**35 workflows historiques déplacés sans modifier un seul octet de leur contenu : 15 anciens B/C/D/E et 20 anciens workflows des missions 02–21.** Chaque archive possède exactement le même Git blob SHA que son workflow d'origine sur la branche de livraison avant M3 (`32d1938920faa9165ef282c52643d42b87ed8569`). Les fichiers sont conservés dans le dépôt, mais leur nouvel emplacement sous `docs/archive/workflows/` empêche GitHub Actions de les interpréter comme des workflows exécutables.

Ce ne sont **pas des outils de fonctionnement du site actuel** : ils servaient à déployer/tester les anciennes étapes d'éditeur sur des branches `feat/celebrations-admin-visual-mission-*` ou à lancer des migrations ponctuelles. Les fonctions actuelles du Worker officiel, le code applicatif, les PDF, D1, R2 et les secrets ne sont pas concernés.

## Liste des originaux et empreintes Git

| Ancien chemin | Fichier archivé | Git blob SHA original |
| --- | --- | --- |
| `.github/workflows/celebrations-admin-b-apply-once.yml` | `docs/archive/workflows/celebrations-admin-b-apply-once.yml` | `169890b6cbcf4894c4b3f8464e89b1f2fa3dc2a5` |
| `.github/workflows/celebrations-admin-b-preflight-once.yml` | `docs/archive/workflows/celebrations-admin-b-preflight-once.yml` | `3f2f2475d9313754e9a9bda0ba80d5296d67620f` |
| `.github/workflows/celebrations-admin-c-apply-once.yml` | `docs/archive/workflows/celebrations-admin-c-apply-once.yml` | `c1ff197e8dc96125a7188193d040e6125a445a0e` |
| `.github/workflows/celebrations-admin-c-dryrun.yml` | `docs/archive/workflows/celebrations-admin-c-dryrun.yml` | `db8cbdf68e59174266b1cbb28d5dd819effa50ff` |
| `.github/workflows/celebrations-admin-d-preview-once.yml` | `docs/archive/workflows/celebrations-admin-d-preview-once.yml` | `384055e4a552d464f346359011dc637815effb33` |
| `.github/workflows/celebrations-admin-d2-preview-once.yml` | `docs/archive/workflows/celebrations-admin-d2-preview-once.yml` | `a0738a444ea57125d88b4c6600fcdef74a6dd9db` |
| `.github/workflows/celebrations-admin-d3-cover-read-once.yml` | `docs/archive/workflows/celebrations-admin-d3-cover-read-once.yml` | `114d3d443f9816f02f2842656adebb97002ed0b4` |
| `.github/workflows/celebrations-admin-d3-preview-once.yml` | `docs/archive/workflows/celebrations-admin-d3-preview-once.yml` | `4f778cd19ba22f055de2db681a9bff899ec1fabf` |
| `.github/workflows/celebrations-admin-d4-login-once.yml` | `docs/archive/workflows/celebrations-admin-d4-login-once.yml` | `c33e8d9a229e0a397cc69a769ad09d6fe859c212` |
| `.github/workflows/celebrations-admin-d4-restore-once.yml` | `docs/archive/workflows/celebrations-admin-d4-restore-once.yml` | `af82ec03008ccafe2b86920ad85a1af805bdb432` |
| `.github/workflows/celebrations-admin-demo-once.yml` | `docs/archive/workflows/celebrations-admin-demo-once.yml` | `104cfcdb844d218793ad776df60575f688955d3e` |
| `.github/workflows/celebrations-admin-e1-once.yml` | `docs/archive/workflows/celebrations-admin-e1-once.yml` | `1c55a7b3821c0875903dce5963668efe05b68b00` |
| `.github/workflows/celebrations-admin-e2a-access-once.yml` | `docs/archive/workflows/celebrations-admin-e2a-access-once.yml` | `aea0cbf798dbeab316a0b1119555b0dba2718428` |
| `.github/workflows/celebrations-admin-e2a-once.yml` | `docs/archive/workflows/celebrations-admin-e2a-once.yml` | `6262bf169a30dcb95080e994c3a5f2c8ab0402e2` |
| `.github/workflows/celebrations-admin-e2b-once.yml` | `docs/archive/workflows/celebrations-admin-e2b-once.yml` | `6b0b294e813508b86d590d462a10b12c5c022892` |

## Récupération si nécessaire

L'ancien code est consultable sans changement dans `docs/archive/workflows/` ou via `git show 32d1938920faa9165ef282c52643d42b87ed8569:.github/workflows/<nom>`. **Ne pas remettre en place un workflow historique sans revoir ses permissions, ses secrets, son déclencheur et sa compatibilité avec les ressources Cloudflare actuelles.** Les anciens jobs pouvaient écrire dans le staging ou redéployer une version dépassée du Worker de test.

## Intentionnellement conservés dans `.github/workflows/`

- `celebrations-finalisation-mission-05-*` : preuves/reconstitution du déploiement officiel et de son rollback, sans les relancer aveuglément.
- `celebrations-finalisation-mission-03-*` : preuves et procédures de sauvegarde/restauration privées.
- `celebrations-cleanup-01.yml` et `celebrations-cleanup-02.yml` : contrôles du nettoyage de code.
- `celebrations-admin-c-local-tests.yml` : tests locaux pouvant être exécutés sur des PR sans écrire dans Cloudflare.
- `celebrations-admin-login-probe.yml` : outil de diagnostic en lecture seule, déclenchement borné.
- `pages.yml` : GitHub Pages historique sur `main`, à réconcilier en mission 4, pas à désactiver sans preuve.

**Le reste du dépôt n'est pas déclaré entièrement nettoyé ici.** Cette mission est volontairement limitée aux workflows d'administration historiques clairement identifiés afin d'éviter tout risque sur le site et de ne pas lancer un audit interminable.

## Missions historiques 02–21 : conservées, mais non exécutables

Les vingt workflows de vérification/refonte des missions 02–21 étaient épinglés à des branches `refactor/`, `audit/` ou `design/` historiques de novembre 2026. Les tests qu'ils déclenchaient sont conservés dans `tests/`, les scripts de récupération restent dans `scripts/`, et les rapports dans `docs/audit/`. Leur exécution automatique depuis de vieilles branches n'est plus requise pour la maintenance du site actuel.

| Ancien chemin | Chemin archivé | Git blob SHA original |
| --- | --- | --- |
| `.github/workflows/celebrations-mission02-reference.yml` | `docs/archive/workflows/celebrations-mission02-reference.yml` | `254efa3498bc1e5ed6d5a1b626dad945b01f09dd` |
| `.github/workflows/celebrations-mission03-backup-rehearsal.yml` | `docs/archive/workflows/celebrations-mission03-backup-rehearsal.yml` | `98abc04fd73be648196dc62562dfd5031bcde7aa` |
| `.github/workflows/celebrations-mission04-architecture.yml` | `docs/archive/workflows/celebrations-mission04-architecture.yml` | `b195b23484892375c891aa988ecef1af3ee5ebb3` |
| `.github/workflows/celebrations-mission05-editor-parity.yml` | `docs/archive/workflows/celebrations-mission05-editor-parity.yml` | `ecf547517ed787cc37db8af104a645747b57c688` |
| `.github/workflows/celebrations-mission06-editor-modules.yml` | `docs/archive/workflows/celebrations-mission06-editor-modules.yml` | `868bfe6f17250212679dfb2dcbf875322d515f6c` |
| `.github/workflows/celebrations-mission07-block-model.yml` | `docs/archive/workflows/celebrations-mission07-block-model.yml` | `c0b1cfc0236b704beb241a0f187a83185e312fcd` |
| `.github/workflows/celebrations-mission08-media-catalogue.yml` | `docs/archive/workflows/celebrations-mission08-media-catalogue.yml` | `adec7f9c5b4dd30e07571b27f22f8115f3675302` |
| `.github/workflows/celebrations-mission09-page-lifecycle.yml` | `docs/archive/workflows/celebrations-mission09-page-lifecycle.yml` | `fb49b6ab0b5d04f4292dfa1e3cc4634373b785ec` |
| `.github/workflows/celebrations-mission10-safe-persistence.yml` | `docs/archive/workflows/celebrations-mission10-safe-persistence.yml` | `724c9fc67a80c88fcc7d900bd2ee68c60d704a09` |
| `.github/workflows/celebrations-mission11-drag-undo.yml` | `docs/archive/workflows/celebrations-mission11-drag-undo.yml` | `b08a7c8ecb34f21680a68d459452197c9f77b0e1` |
| `.github/workflows/celebrations-mission12-public-renderer.yml` | `docs/archive/workflows/celebrations-mission12-public-renderer.yml` | `6091499fd26610a22bf367df05da615d102594be` |
| `.github/workflows/celebrations-mission13-css-modules.yml` | `docs/archive/workflows/celebrations-mission13-css-modules.yml` | `edaad6eac5a423448beefc021394cfd36cb1775e` |
| `.github/workflows/celebrations-mission14-security.yml` | `docs/archive/workflows/celebrations-mission14-security.yml` | `b642c8c0a0b39ea42526348f708e6244b40ebd01` |
| `.github/workflows/celebrations-mission15-legacy-cleanup.yml` | `docs/archive/workflows/celebrations-mission15-legacy-cleanup.yml` | `e00a55f2e3f5aec4d8af8836cec7078ca15c1ae2` |
| `.github/workflows/celebrations-mission16-release-safety.yml` | `docs/archive/workflows/celebrations-mission16-release-safety.yml` | `7904b74f36dc319a8cae050d1ad4325f0eefbc23` |
| `.github/workflows/celebrations-mission17-docs-performance.yml` | `docs/archive/workflows/celebrations-mission17-docs-performance.yml` | `cddd70f9de5fafe7c0ba40d3163146a6967edb3d` |
| `.github/workflows/celebrations-mission18-recette.yml` | `docs/archive/workflows/celebrations-mission18-recette.yml` | `903d98b0f5c09c7a504577abe3800634855b784d` |
| `.github/workflows/celebrations-mission19-live-backup.yml` | `docs/archive/workflows/celebrations-mission19-live-backup.yml` | `c88468267de5a8f2a8ebca0aba18b472b2b536a2` |
| `.github/workflows/celebrations-mission20-live-d1-backup.yml` | `docs/archive/workflows/celebrations-mission20-live-d1-backup.yml` | `09b89f947d606f4a073703518ca8e642c785ab0e` |
| `.github/workflows/celebrations-mission21-final-preflight.yml` | `docs/archive/workflows/celebrations-mission21-final-preflight.yml` | `11fa329c46f09f64c4533dbff167accd30d1396c` |

Aucun de ces vingt fichiers n'est effacé de l'historique du dépôt ; les octets restent accessibles sous leur nouvel emplacement. La famille `celebrations-finalisation-mission-03-*` demeure **active dans le dépôt** pour disposer des preuves et outils de récupération chiffrée, sans l'exécuter automatiquement.
