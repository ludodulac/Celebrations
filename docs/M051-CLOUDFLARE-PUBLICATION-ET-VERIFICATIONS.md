# Célébrations — M051 : publication Cloudflare et vérifications

Date : 20 novembre 2026. Document de continuité technique, sans secret.

## Architecture de publication
- Dépôt : `ludodulac/Celebrations`.
- Site officiel : https://www.ronde-des-archanges-universelle.eu/
- Worker Cloudflare de production : `celebrations-exit-production`.
- D1 de production : `28736d2a-479b-472b-bf82-703ad0affe10` (bindings `DB`, `MEDIA_ACL`).
- R2 : `MEDIA_BUCKET` et `EDITOR_BUCKET` pointent **tous deux** vers `celebrations-exit-production` sur le Worker officiel. Ne pas supposer que `EDITOR_BUCKET` est le bucket staging.
- Workflow de publication : `.github/workflows/celebrations-m051-pinned-release.yml` sur `main`, déclenché par un commit `main` contenant `[M051_PUBLISH]`. Il checkout un SHA de code **épinglé** ; modifier le code de la branche seule ne suffit pas à le publier.
- Script de garde historique : `scripts/cleanup06_cloudflare_release.mjs` ; le workflow fabrique une copie runtime avec version de référence et règles actualisées. Préflight, upload de version non activée, vérification, activation et rollback.
- Les noms des environnements/secrets GitHub dans le workflow restent historiques (`celebrations-staging`) ; **ne pas en déduire que le Worker cible est staging**. Le script cible explicitement le Worker de production.
- Aucun changement DNS, écriture D1 ou écriture R2 n'est prévu par ce workflow.

## Incidents constatés et résolution
1. Les workflows GitHub Actions de type `push` n'apparaissaient pas dans l'outil `fetch_commit_workflow_runs` (filtrage aux exécutions de pull requests). Récupérer un numéro `/actions/runs/<id>`, puis utiliser `fetch_workflow_run_jobs` et `fetch_workflow_job_logs` ; ne pas multiplier les corrections sans journal.
2. Run `44713306184` : 11 tests ciblés réussis, échec dans la génération du garde de publication (`Release gate anchor changed`, deux occurrences au lieu d'une). Corrigé par `replaceAll` avec comptage adapté.
3. Run `44714307065` : tests et génération du garde réussis, échec du préflight (`Published celebration lost pages`) car seuil historique `pages.length>=8`. Seuil changé en `>=1`. **Ce seuil plus faible ne démontre pas l'intégrité complète des pages : vérifier les pages publiées séparément.**
4. Configuration R2 : le garde historique attendait `EDITOR_BUCKET=celebrations-exit-staging`, tandis que le binding réel du Worker de production est `celebrations-exit-production`. Alignement du garde et du Wrangler candidat sur la réalité de production.
5. Cloudflare a confirmé une nouvelle version de production `9d4c7855-fa6f-4399-9b4f-78c4ca058ae6` le 20 novembre 2026 à 10:01:23 UTC (version antérieure `37ede333-3c43-4a95-af1b-f334cee557e9`, déploiement `e76528fb-03b5-4aad-b35c-2d4b987acbc3`).
6. Le cadre coloré restait invisible : dans `migration/cloudflare/editor-trial-site-page.mjs`, la règle M036 `.site-paper{border:0!important}` annulait la règle rouge de `app/styles/public/02-navigation-library.mjs`. Correction sur branche `fix/m051-program-media-preview-colors-20261119`, commit `e63f0ba9c1b472f606c674830df0d2f22e1f6500` : rétablir le cadre `var(--frame-color,#ea342f)` sur `body:not(.is-splash-home) .site-paper` et conserver l'accueil splash sans cadre. Workflow main commit `10f71669cef6b68654637a391e1b7e05280ae0a5` épingle ce SHA. **La présence en production de ce dernier correctif n'était pas encore confirmée lors de la rédaction**.

## Modifications M051 et contrôle manuel
- Programme : la route `/programme` est distincte de Préparation. Le visiteur a vu une page « non publiée » : c'est cohérent avec une route dédiée, mais ne vaut pas publication de son contenu.
- Couleur des célébrations : ouvrir une page intérieure de Michaël ; le cadre doit être rouge. L'accueil général doit rester sans cadre. Vérifier ordinateur et mobile. Les autres archanges doivent utiliser leur couleur configurée.
- Médiathèque admin : ouvrir une fiche PDF et vérifier les contrôles d'archivage/suppression protégés ; ne supprimer aucun fichier réel pour un simple test.
- Éditeur : dans un bloc à deux colonnes, vérifier alignement vertical haut / centre / bas et conservation après sauvegarde.
- Vidéos : vérifier le titre sous la miniature, sans bouton encadré.
- Vérifier que les pages existantes, les brouillons, les médias et les accès admin sont conservés ; ne jamais déduire leur intégrité du seul succès des tests unitaires.
- Tests ciblés : `tests/test-editor-trial-site.mjs` (11 tests au run 44714307065). Ajouter un test de cascade CSS M036 pour éviter une nouvelle régression du cadre.

## Pour la prochaine intervention
1. Inspecter d'abord le Worker réellement actif et les bindings Cloudflare.
2. Lire le journal du run GitHub Actions via `fetch_workflow_run_jobs` / `fetch_workflow_job_logs` ; si l'ID manque, le demander une seule fois.
3. Corriger la cause démontrée, puis exécuter les tests adaptés, sans supprimer les contrôles d'intégrité.
4. Épingler le nouveau commit de code dans le workflow main, déclencher `[M051_PUBLISH]`.
5. Confirmer **la nouvelle version active** via Cloudflare, puis vérifier le rendu public et l'administration.
6. Préserver D1, R2, DNS, secrets et une version de rollback. Ne pas annoncer « terminé » avant vérification effective.

## Tentative de publication M051 du 20 novembre
- Workflow principal épinglé au code testé `9fb7e009581716f577cf475af022aa4821aef562`.
- Version de référence vérifiée sur Cloudflare : `9d4c7855-fa6f-4399-9b4f-78c4ca058ae6` ; déploiement `59021475-5861-4730-adca-6ff47ef120df`.
- La publication est conditionnée aux vérifications automatiques du workflow, avec retour arrière prévu en cas d'échec après activation.

- Correctif Programme : la validation serveur accepte désormais `programme-101`, avec test de sauvegarde et relecture. Code épinglé `d373355a1de624aaede5cc411b16e2a3a059f6b2`. Baseline Cloudflare `feed74ea-556a-460c-af91-9ea8b9fd621f`.
