# Archives des anciens workflows d'administration — 10 novembre 2026

**15 anciens workflows B/C/D/E déplacés sans modifier un seul octet de leur contenu.** Chaque archive possède exactement le même Git blob SHA que le workflow original sur la branche de livraison avant M3 (`32d1938920faa9165ef282c52643d42b87ed8569`). Les fichiers sont conservés dans le dépôt, mais leur nouvel emplacement sous `docs/archive/workflows/` empêche GitHub Actions de les interpréter comme des workflows exécutables.

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
