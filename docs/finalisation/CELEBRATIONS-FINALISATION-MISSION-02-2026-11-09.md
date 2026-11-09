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

## Compte rendu du premier déploiement contrôlé

GitHub Actions [#42623269565](https://github.com/ludodulac/Celebrations/actions/runs/42623269565) : les deux builds et **les deux déploiements** des Workers de test ont effectivement réussi le 9 novembre à 13:11–13:12 UTC. Le Worker officiel avant intervention était `cd46e1ba-e106-4f03-90aa-7110628a5b9f`. Le contrôle HTTP lancé immédiatement après a échoué dès sa seconde route staging, sans indiquer si c'était un défaut de propagation ou de déploiement. **Aucune conclusion de sécurité n'est tirée de ce premier essai.**

Un deuxième contrôle est préparé dans un job **strictement en lecture seule**, sans redéploiement, en soumettant exactement les mêmes chemins privés aux deux hôtes et en vérifiant les deux domaines officiels. Il est déclenché uniquement par le marqueur `[M02_VERIFY_PREVIEWS_ONCE]`. Un statut de workflow SUCCESS ne constitue pas à lui seul la preuve : les journaux HTTP doivent être examinés.

## Preuve réelle obtenue après propagation — [CI #42623576475](https://github.com/ludodulac/Celebrations/actions/runs/42623576475)

**SUCCESS** : les deux hôtes de test ont chacun renvoyé 404 pour les six routes privées inspectées, 405 pour POST vers l'éditeur, 200 pour la page d'accueil publique ; l'API privée officielle exige toujours la connexion (401), les deux domaines officiels répondent 200 et le déploiement officiel est inchangé. Aucun déploiement nouveau dans cette exécution, aucune écriture distante. L'échec du contrôle lancé immédiatement après le déploiement était donc lié au moment du contrôle ou à la propagation, sans motif de changer les données.

Avant de clôturer définitivement M2, un **troisième hôte** doit être contrôlé : `celebrations-exit-production.rondes.workers.dev`, adresse technique du Worker officiel. Le suivi en lecture seule est relancé avec `[M02_VERIFY_PREVIEWS_ONCE]`. Si cet hôte n'est pas protégé, M2 n'est PAS terminée, même si les deux sites de test le sont.

## Rectification du contrôle du troisième hôte

Le run [#42623792074](https://github.com/ludodulac/Celebrations/actions/runs/42623792074) a annoncé dans sa chaîne de synthèse « trois hôtes » mais son tableau de résultats n'en contenait que **deux**. C'était une erreur de mise à jour du script de vérification ; ce run ne prouve **rien** pour `celebrations-exit-production.rondes.workers.dev`. Le script a été corrigé pour inclure réellement le troisième hôte. Le nouveau test en lecture seule est déclenché par `[M02_VERIFY_PREVIEWS_ONCE]`. Ne pas clôturer sans l'inspection des trois tableaux de résultats.
