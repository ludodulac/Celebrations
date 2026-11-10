# CÉLÉBRATIONS — MISSION 010-B : annuaire administratif fiable

**Branche isolée :** `feat/celebrations-m010b-member-admin-final-integration-20261111`  
**Base imposée :** `8a9a2940d27c018fd6ea46b2603485e9ab24ce3b` (M009-D).  
**Migrations : PROPOSÉES ET NON APPLIQUÉES. Routes Worker : NON ACTIVÉES. Production : INCHANGÉE.**

## Réellement réalisé dans le code isolé

- **Le même écran M007-B** : le montage opt-in `mountMemberDirectoryAdmin` réutilise `mountMemberAccessAdmin`, sans nouvelle administration. Il dispose désormais d'une recherche nom/e-mail, d'une pagination par curseur (50 entrées par page, plafond serveur 100), de formulaires de création/modification des personnes et de la gestion déjà existante des types, appartenances, participations, espaces et rapprochements vérifiés. Le conteneur parent reste celui de l'éditeur administrateur existant ; aucun bouton ou onglet de production n'est ajouté ici.
- **Identifiants permanents** : un `person:UUID` est créé exclusivement côté serveur, les types conservent leur ID lors du renommage, les liens désactivés historiques restent en place. La recherche d'e-mail est une recherche de fiche, **jamais une preuve d'identité** ni une fusion des comptes historiques.
- **Pagination exhaustive** : `GET ?action=snapshot&limit=50&cursor=<email>&search=<texte>`; `members`, `nextCursor`, `hasMorePeople`, `cursor`, `limit` et `search` sont renvoyés. Ordre déterministe sur l'e-mail normalisé (unique), filtre sur e-mail/nom; le clic suivant/précédent recharge chaque page de D1. `person_detail` expose aussi la révision de la personne.
- **Écritures atomiques + audit** : `member-directory-admin-transaction.mjs` coordonne les opérations métier **existantes** M007-A/M008-B/M002/M005 avec le journal M009-B, dans **un même `D1Database.batch`**. Si l'audit, une FK, un déclencheur ou une des étapes d'une opération composée échoue, le batch entier échoue et annule l'opération.
- **Concurrence** : la table additive `celebrations_directory_admin_revisions` porte une révision optimiste par personne/type et un nonce propre à chaque commande. Le navigateur envoie `expectedRevision` d'une lecture serveur. Une édition obsolète est refusée avec HTTP 409 : la transaction ne modifie aucun contact/lien et ne crée pas d'audit de succès. Un garde sur l'état SQL précédent prévient aussi les modifications concurrentes passant par les anciens écrivains M008-B. Après un succès, l'interface recharge les données.
- **Inscriptions individuelles** : seul le callback **serveur** `resolveCanonicalSpace(spaceId)` peut obtenir un espace M005 existant et PRIVATE. Les champs de type `space`, `principal`, `role` envoyés par le navigateur ne prouvent jamais les droits. Une participation dans la **même** célébration est obligatoire (FK). L'absence du résolveur interdit l'inscription.
- **Sécurité** : vérification de la session ADMIN via `authorize(request,env,true)` à chaque GET/POST, rejet des Bearer participants et des origines POST étrangères ; aucune vérification de droits de lecture privée ne repose sur le navigateur.

## Comment fonctionne la transaction M010-B

1. La session admin est vérifiée **avant** tout accès D1.
2. Les paramètres et les identifiants sont validés par les modèles existants. Le numéro de révision vient d'un GET admin, pas du compte participant.
3. Une seule transaction D1 initialise au besoin la révision, la fait avancer par comparaison atomique `revision = expectedRevision` et lui associe un nonce aléatoire unique.
4. Toutes les écritures de cette opération sont conditionnées **au nonce de cette transaction**; le journal d'audit n'est inséré que si le même nonce est présent. Un contrôle `changes === 1` sur l'avancement et l'audit détecte les conflits. Une erreur sur l'audit annule tout via le rollback du batch.
5. Les suppressions vérifient l'existence du lien; les insertions évitent les doublons et respectent les FK. Les associations multitypes conservent les liens historiques suspendus et suppriment/réinsèrent uniquement les associations actives dans le même batch.

**Limitation de modèle existant** : les accès M008-B directs, hors service administrateur, ne connaissent pas cette révision : les vérifications d'état métier détectent une grande partie des conflits avec ce code ancien, mais toutes les futures écritures admin devront emprunter le service M010-B pour une sérialisation garantie. Le stockage des révisions est une migration additive, pas une modification des données historiques.

## Contrat d'intégration future (NON ACTIVÉ)

La conversation de consolidation devra valider **séparément** le montage dans l'onglet membre de l'administration actuelle. Exemple de contrat, **sans activer de route ici** :

- `mountMemberDirectoryAdmin(root,{transport})`, où le transport est celui du client admin existant, avec le jeton de session d'administration uniquement ; aucun compte participant ne doit le fournir.
- Une route réservée administrateur, par exemple `/api/admin/member-directory`, qui achemine GET/POST à `handleMemberDirectoryAdmin(request,env,{resolveCanonicalSpace})`. Cette route doit être installée dans le Worker serveur protégé, avant tout traitement public ; **la convention exacte de chemin appartient au propriétaire du routeur Worker partagé**.
- `resolveCanonicalSpace` : charger depuis la source éditoriale M005 courante, valider l'ID et l'appartenance à la célébration, vérifier que la visibilité est PRIVATE. Ne **jamais** accepter un objet d'espace venu du navigateur.
- `GET snapshot` et `GET person_detail` fournissent `revision`. Toute écriture autre que `create_person`, `create_type`, `review_claim` ou `unlink_identity` transmet `expectedRevision` entier positif ou nul.
- **Appliquer et vérifier en local/staging isolé les migrations 007-A → 008-B → 009-B → 010-B après sauvegarde et autorisation explicite**. Le service M010-B échoue sans la table de révisions, par sécurité.
- Ne pas publier d'espaces privés, de médias R2 privés ou de politiques de pages à partir de cette interface. Le formulaire M007-B de politique de page reste volontairement **non sauvegardé**.
- Les handlers de rapprochement d'identité M009-B continuent leur propre journal atomique ; M010-B ne modifie ni `member-identity-links.mjs` ni `member-private-access.mjs` (Construction A). Les sécurisations de Worker/médias appartiennent à Construction C.

## Vérifications isolées et limites

- `node --test tests/test_m010b_member_admin_final.mjs` : base SQLite **en mémoire** avec schémas proposés, 137 fiches fictives, 3 pages, recherche du 137e, rôle falsifié, refus sans session, audit bloqué en test (rollback), contacts/attributions multiples, conflit entre éditions, types suspendus, espaces M005 canoniques, FK et comptes historiques inchangés.
- `node --test tests/test_m009b_member_identity_admin.mjs` : fixture M009-B adaptée au schéma additionnel M010-B, assertions d'identité explicite conservées.
- `node scripts/test-m010b-admin-responsive-browser.mjs` : Chromium local en largeurs 1440, 390 et 320 pixels, transport simulé sans réseau externe, pagination, recherche, création, visibilité du seul composant M007-B, absence de débordement horizontal.
- `.github/workflows/celebrations-m010b-member-admin-final.yml` : automatise les tests et régressions antérieures sans secret, migration réelle ni déploiement.

**Ce qui n'est PAS prouvé** : comportement avec les D1/R2 réelles, performance à très gros volume, session admin en production, montage effectif de la route Worker, intégration des politiques de pages à la publication, fonctionnement réel des espaces privés, tests complets de bout en bout après raccordement. Les tests navigateur utilisent un transport simulé.

## Fichiers exclus volontairement

Aucun changement de `main`, `production-worker.mjs`, `staging-worker.mjs`, `member-private-access.mjs`, `member-identity-links.mjs`, `media-gateway.mjs`, `public-data-api.mjs`, ni D1 réelle. Aucun lancement de migration distante, aucune publication.
