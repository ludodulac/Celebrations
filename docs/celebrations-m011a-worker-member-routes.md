# Célébrations — M011-A : routes administratives Worker (non activées)

Branche de travail : `feat/celebrations-m011a-member-admin-worker-routing-20261111`. Base : `b30fb44c0ea3ab15b16c45b93c504edd5e576c40`.

## Ce qui est raccordé dans le code
- `GET/POST /api/admin/member-directory` → `handleMemberDirectoryAdmin()`, **session ADMIN D1** authentifiée par `authorize(request,env,true)`. Les GET `snapshot`, `person_detail` et `pending_claims` sont protégés; les écritures utilisent les transactions, audits et révisions M010-B.
- `POST /api/participant/identity-claim` → `handleMemberIdentityClaim()`, **session PARTICIPANT D1** via `authorize(request,env,false)`. Une demande crée uniquement une réclamation `pending`; elle ne crée ni lien approuvé, ni accès.
- La barrière se trouve dans `app/security/member-admin-worker-routes.mjs`, importée par les deux entrypoints Worker. Aucun nouveau système d’authentification ni interface visuelle n’a été créé.

## Ce qui est réellement activé
**Rien** : `MEMBER_DIRECTORY_API_ENABLED` et `MEMBER_DIRECTORY_API_HOST` ne sont **pas configurés**. Le routeur retourne 404 avant consultation D1/R2 ou repli vers ASSETS. Les hôtes du domaine officiel, les deux candidats en lecture seule et l’ancien staging sont refusés même si ces variables étaient configurées par erreur.

Une activation dans une **future instance isolée HTTPS seulement** demanderait les deux réglages explicites `MEMBER_DIRECTORY_API_ENABLED="true"` et `MEMBER_DIRECTORY_API_HOST="<nom-d-hote-isole>"`, plus les bindings D1/migrations nécessaires. **Ne pas effectuer cette activation dans cette mission.** Aucune migration D1 réelle, configuration Cloudflare distante, ni déploiement n’a été effectué.

## Invariants de sécurité
- Jetons Bearer uniquement : les cookies de l’éditeur, les attributs navigateur et les déclarations de rôle ne donnent aucun droit. Vérification de la session côté routeur **puis** service, avec expiration D1.
- Requêtes d’écriture avec `Origin` explicitement identique à l’origine de l’URL; origine différente et `Sec-Fetch-Site: cross-site` refusés; pas d’autorisation CORS générique.
- Réponses sensibles `no-store`, `nosniff`, `noindex`. Pas de fuite SQL ni d’identité dans une réponse d’échec.
- Aucun résolveur d’espace canonique n’est injecté : `enroll_space` est rejeté côté M010-B. Aucune information d’espace fournie par le navigateur ne peut remplacer un chargeur serveur.
- Aucune route privée de page ou de média n’a été activée. Les routes publiques et aliases existants restent traités par le Worker historique.

## Vérification
`node --test tests/test_m011a_member_admin_worker_routes.mjs` teste le véritable `fetch()` des deux Workers avec des `Request` HTTP et un SQLite local offrant l’API D1, les migrations du dépôt appliquées uniquement **en mémoire** : barrières OFF, origines, sessions administrateur/participant/expirées, recherche et pagination >100, transactions/audit, conflit concurrent, échec d’audit avec rollback, intégrité des espaces, régression ASSETS.

Workflow : `.github/workflows/celebrations-m011a-member-worker-routes.yml`. Il lance également quatre suites de régression existantes. Vérifier le résultat CI du commit/PR avant toute consolidation.
