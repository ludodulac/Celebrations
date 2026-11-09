# 🌸 CÉLÉBRATIONS — FINALISATION MISSION 2/5 — sécurité

**9 novembre 2026.** Travail sur la branche `release/celebrations-finalisation-02-security-20261109`, fondée sur l'intégration M1, **sans modification du domaine officiel, de la D1, de R2, du DNS ou des données**.

## Périmètre

Mission 21 a observé, le 9 novembre 2026 à 12:20 UTC, que les anciennes routes `GET /api/editor-open-draft?celebration=101` répondaient HTTP **200 sans authentification** sur :
- `celebrations-exit-staging.rondes.workers.dev`
- `celebrations-visual-candidate.rondes.workers.dev`

La même route renvoyait **401 sans cookie** sur les domaines officiels. Les corps privés n'ont pas été lus ou consignés.

## Correctif

1. `migration/cloudflare/staging-worker.mjs` : retire l'ancien hostname de test comme éditeur. Il reste accessible **uniquement en lecture publique**, et refuse AVANT tout accès DB/R2/ASSETS les pages d'administration, les routes d'éditeur, les API de gestion ainsi que les chemins `/media/new/` (404), et toutes les méthodes autres que GET/HEAD (405). Les pages de visiteurs, `/api/public-data`, `/api/editor-publication` publique et les chemins médias historiques restent prévus pour la consultation. Il s'agit d'une **mise hors service de l'ancienne administration de test**, pas de l'administration officielle.
2. `migration/cloudflare/production-worker.mjs` : renforce seulement la frontière des hôtes `workers.dev` candidats en lecture publique : refuse les API privées et non explicitement publiques, les anciennes routes `/__editor/` privées et les `/media/new/` (404). La détection du domaine officiel, sa connexion administrateur, le routage des fichiers historiques, le traitement des pages et la politique de publication n'ont pas été modifiés.
3. `tests/test_finalisation02_preview_security.mjs` : tests de refus avant toute consultation de R2/D1/assets, de refus des changements d'état et de non-régression de l'authentification officielle.
4. `tests/test_mission15_legacy_cleanup.mjs` : mise à jour explicite des empreintes Git des deux Worker routiers volontairement modifiés, et des anciens tests de staging, devenus obsolètes. **Les neuf autres empreintes de fichiers historiques et le code applicatif restent strictement contrôlés.**

## Procédure de déploiement ciblée

Le workflow `celebrations-finalisation-mission-02.yml` commence par la compilation et les régressions Node. Sur un commit explicitement marqué `[M02_SECURE_PREVIEWS_ONCE]`, il est le seul à déployer, **uniquement** :
- le script Worker Cloudflare `celebrations-exit-staging` avec sa D1/R2 historiques de test ;
- le script Worker Cloudflare `celebrations-visual-candidate` avec ses bindings préexistants D1 de production, R2 média production et R2 édition (les candidats restent GET/HEAD public seulement).

Toutes les configurations passent une garde explicite de nom, de base, de bucket et d'absence de domaine/route. **Aucune commande Wrangler ciblant le script officiel `celebrations-exit-production` n'existe dans ce workflow.** Le workflow vérifie le déploiement officiel actuel avant et après et exige son identité inchangée.

## Preuves à renseigner après l'exécution réelle

- Code corrigé : tests offline M02 + M14 et régressions M05–M17, **réussite constatée sur [CI #42623138916](https://github.com/ludodulac/Celebrations/actions/runs/42623138916)**.
- **Déploiement et retests des deux hôtes : non attestés au moment de la rédaction de ce document**. La mission sera considérée terminée **seulement** si chacun des deux hôtes retourne 404 sur les routes privées, 405 sur les méthodes de modification, 200 sur l'accueil public et si les deux domaines officiels retournent 200 pour l'accueil, 401 sans cookie pour le GET privé ; le Worker officiel doit conserver le même ID de déploiement.
- Une mesure HTTP de protection n'est pas un audit indépendant de sécurité de toutes les dépendances et de tous les accès ; la mission 4 vérifie les parcours réels.

**Rappel : M2 ne publie pas la refonte vers le domaine officiel et ne certifie pas la sauvegarde indépendante (mission 3).**
