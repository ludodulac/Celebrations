# CÉLÉBRATIONS — M008-D : consolidation M008-A + M008-B + M008-C

**Nature : revue d'intégration sur branche GitHub, sans déploiement.**
Base obligatoire : `c976791835fc5f1d7d2c37123face418d0501ca6` (M007-C).
Parents intégrés sans squash : M008-A `e182ec8c35b441e73cee72e92974a35e52a81a21`,
M008-B `360ac7b8f7bef44486afeb5774b58121c6106821`,
M008-C `5d4789e344e394dfc14cea4c263ff5aff7db1b4a`.

## Intégration Git

Les modifications propres aux trois branches ne se chevauchent pas :
- A : 13 chemins, dont publication et présentation multilingue ; 
- B : 7 nouveaux chemins (adaptateur D1, schéma additionnel, tests, workflow, documentation) ;
- C : 4 nouveaux chemins (garde serveur, tests, workflow, documentation).

Trois vrais commits Git à deux parents préservent **tous** les historiques :
- A : `9666111d320c1737fdb47706907b4a7fbcdbe2e2` ;
- B : `5d9dc5f7ad8068d4bd5361474d10b8a94eed823d` ;
- C : `abb99c95479fe7c5b06ce7924c448b3a51e0cbe5`.

L'ajout de `tests/test_m008d_cross_integration.mjs` et du workflow de contrôle se limite à la branche M008-D. Aucun fichier des branches sources n'est réécrit.

## Compatibilité des trois constructions

**Structurellement compatibles, mais routes privées NON opérationnelles.**

- M008-B et M008-C utilisent les tables communes de M007-A et les mêmes identifiants stables `person:UUID`, `member-type:…` et `spaceId`. M008-C relit des données D1 de confiance à chaque requête ; M008-B fournit les écritures et un `readTrustedAssignments` non authentifiant. La décision finale est toujours `canAccessPage` / `canAccessSpace` du moteur M002, jamais une règle concurrente.
- `celebrationId` du domaine M005 est une chaîne décimale canonique (`'41'`) ; D1 utilise l'entier `41`. M008-B impose `toD1CelebrationId` et `toDomainCelebrationId`. M008-C rejette aussi les valeurs ambiguës.
- M008-A publie explicitement un registre et les variantes. Les traductions seulement enregistrées en brouillon ne deviennent pas des `translationReleases` publiques. Une page interdite est normalement exclue de la projection standard par `canAccessPage(page)` sans principal ; ce n'est PAS une preuve globale d'absence de fuite.
- M008-C utilise l'ancienne session participant validée côté serveur et rapproche son e-mail normalisé avec un `personId` existant ; sans rapprochement il refuse. Ce lien automatique par égalité d'e-mail entre compte historique authentifié et répertoire **doit encore faire l'objet d'une validation de politique d'identité**, notamment en cas de changement d'adresse, d'alias, de réattribution d'e-mail et de comptes historiques non normalisés. Il ne doit pas devenir un raccourci d'administration.
- L'adaptateur exige encore un `resolveCanonicalSpace` sûr et le stockage de révisions publiées `loadPublishedPage/Space` n'est pas branché. Aucune route membre n'est ouverte.

## BLOQUANTS DE SÉCURITÉ AVANT ACTIVATION (P0)

1. **Projection publique `publicSnapshot()`** — `migration/cloudflare/editor-publication-api.mjs`. Les tableaux `pages` sont filtrés avec `publiclyVisible` et `canAccessPage`, ce qui est positif ; toutefois les objets `record`, `shared`, `plans`, `celebrationVisibility` et autres champs hérités sont repris largement, sans liste blanche exhaustive de contenus et métadonnées. Les futurs `spaces`, index, liens, titres ou ACL privées pourraient apparaître par des sous-objets. Définir une projection publique explicite, récursive, avec tests de non-divulgation.
2. **`publishedMedia()` et galerie** — même fichier. L'entrée `mediaCatalogue` avec `general===true`, les associations `uses` et les anciennes listes D1 ne portent pas encore la classification M002 ni la propriété canonique de page/space. Ne jamais promouvoir par un simple indicateur `general` un fichier privé, une vignette, un PDF ou une URL `private-members/`. Classifier et valider les propriétaires côté serveur.
3. **`handleEditorPublication` et traductions M008-A** — GET public renvoie le snapshot et les médias fusionnés ; POST admin peut publier une variante à partir du brouillon. Imposer sur les commandes de publication la validation des ACL de la page/espace canonique, sans créer une traduction publique d'un espace protégé ; vérifier les variantes françaises et autres langues ainsi que les métadonnées `translationReleases`.
4. **`handleTrialSite`, `loadSevenStageContent`, seeds HTML** — `editor-trial-site-page.mjs` injecte `window.__TRIAL_SITE_SEED__` ; `editor-demo-preparation-page.mjs` fabrique `pages`, `files`, `library`, `celebrations` en interrogeant les tables historiques `audience='all'`. Ce filtre ne représente PAS les droits M002. Aucune donnée privée, même masquée par le navigateur, ne doit entrer dans le JSON inline ou le HTML. Les routes d'aperçu authentifié et les réponses `format=json` nécessitent aussi leur contrôle.
5. **API publiques** — `public-data-api.mjs` permet la lecture de tables historiques via `SELECT *`, avec le filtre `angel/nonangel/all`. Ces catégories ne sont pas des types M002. Les nouveaux objets privés et colonnes sensibles ne doivent jamais être ajoutés à la réponse sans projection serveur dédiée ; filtrer aussi les relations, recherches, menus, sitemaps, index et traductions avant leur lecture.
6. **Médias R2, URL directes et assets** — `media-gateway.mjs` permet les clés approuvées `public_media`, des médias D1 historiques et des accès administrateur ; `/media/new/` et `env.ASSETS` possèdent d'autres chemins. Chaque point d'entrée doit refuser les clés `private-members/` et toute référence de média privé, indépendamment d'une appartenance à une galerie publique. Utiliser un binding `PRIVATE_MEMBER_BUCKET` séparé, privé et servi **seulement après** `handlePrivateMedia`. Vérifier aussi les domaines R2/CDN directs et les PDF.
7. **Garde de toutes les routes** — aucune URL directe de page/espace, traduction, média, téléchargement, recherche, image de couverture, aperçu, import, API ou export ne doit contourner `canAccessPage` / `canAccessSpace`. Appliquer les en-têtes `no-store`, anti-indexation et anti-cache CDN avant tout octet. Aucun résultat d'existence ni extrait dans une erreur 403/404. Ne pas recopier les inscriptions lors de duplication d'une célébration.
8. **Identité et migrations** — rapprocher de manière vérifiée le compte historique avec le `personId`, intégrer un résolveur M005 canonique, migrer D1 007-A puis 008-B sous sauvegarde et validation distincte, provisionner le R2 privé et tester en préproduction ; NE RIEN appliquer en production dans M008-D.

**Conclusion de sécurité : activation des espaces privés BLOQUÉE**, même si tous les tests isolés et intégrés passent. Les tests ne prouvent pas l'isolation des anciennes surfaces R2/D1, ni le comportement Cloudflare réel.

## Vérifications hors ligne

`.github/workflows/celebrations-m008d-consolidation.yml` doit vérifier l'ascendance et les 24 chemins intégrés, Node.js 22, syntaxe, suites M002→M008-C, tests du site public français, brouillons/publication, éditeur, sécurité, test réel croisé D1 SQLite + moteur M002/M008-C, et smoke Wrangler D1 en `--local`. Aucun secret Cloudflare, `--remote`, migration réelle, route membre ou commande de déploiement.

Les résultats réels du workflow et tout éventuel échec externe **Workers Builds** sont à consulter dans les checks GitHub de la PR ; un éventuel échec de Workers Builds ne doit pas être masqué par la réussite des tests Node.
