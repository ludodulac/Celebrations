# 🌸 CÉLÉBRATIONS — M011-C : éditeur unique, membres et espaces

**Base vérifiée :** `b30fb44c0ea3ab15b16c45b93c504edd5e576c40`  
**Branche dédiée :** `feat/celebrations-m011c-existing-editor-member-spaces-integration-20261111`  
**PR en brouillon :** #129, vers `feat/celebrations-m010d-consolidation-010a-010b-20261111`  
**Aucune fusion, migration, activation de route ou mise en production.**

## Comportement intégré

Le bouton **Membres et espaces** est ajouté à la barre de navigation de `admin.html`, puis le pont `admin-member-spaces-bridge.js` branche une seule vue dans le `#panel` historique, après validation de la session admin existante. Les onglets Accueil, Programme, Bibliothèque et Liens du comité conservent leur comportement. Quitter la vue détruit son montage.

**Contacts et autorisations :** le composant déjà présent `mountMemberDirectoryAdmin()` est monté sans créer une seconde interface de gestion des contacts. Il réutilise l'écran M007-B, les opérations M010-B et la vérification manuelle des rapprochements M009-B : recherche nom/e-mail, pagination par curseur, création/mise à jour de personne, types renommables/suspendables, appartenances multiples, participations, inscriptions individuelles aux espaces et validation indépendante des demandes de rapprochement.

Le transport navigateur proposé n'autorise que `GET` et `POST` JSON sur **l'origine courante**, vers `/api/admin/member-directory`, en transmettant uniquement le **jeton d'administration existant**, jamais une identité de membre saisie dans le navigateur. L'API et l'identité sont vérifiées côté serveur (Construction A). Une route absente, une session manquante ou une réponse non-JSON échoue explicitement sans prétendre à un enregistrement. Aucune route Worker n'est modifiée dans cette mission.

**Espaces :** l'éditeur affiche la célébration courante et les espaces M005. Un espace peut être préparé en PUBLIC ou PRIVATE, avec les modes M002 PUBLIC / ALL_PRIVATE_TYPES / SELECTED_TYPES, et une liste de pages rattachées. La création de pages prépare uniquement une coquille éditoriale vide. Les contenus de pages et leurs traductions existantes ne sont pas recréés dans un autre moteur d'édition.

La duplication appelle obligatoirement `duplicateCelebration()` de M005 pour copier les pages, blocs, médias par référence et traductions. M005 neutralise la publication et retire toute inscription individuelle, même imbriquée. Un espace privé conserve sa protection : le changement de langue ne confère pas un droit.

## Protection contre une sauvegarde fictive

Le panneau de préparation possède un historique Annuler/Rétablir (30 étapes maximum), ainsi que **Abandonner le brouillon**. Son état est une **copie en mémoire** : ni `state`, ni `saveState()`, ni les mécanismes historiques de brouillon/publication ne sont écrits. Aucune sauvegarde localStorage, D1 ou R2. La fermeture/rechargement de la page perd volontairement les opérations de préparation. La mention « modifications locales non sauvegardées » reste visible.

Les fonctions suivantes sont **explicitement désactivées** tant que l'écriture canonique sécurisée n'est pas développée et validée :

- `Enregistrer les espaces` et `Publier / appliquer les droits` ;
- application des politiques d'accès aux pages (dans le composant existant également) ;
- ouverture de l'édition du contenu des nouvelles pages d'espace ;
- migrations, création d'enregistrements D1 et nouvelles routes privées.

Il serait dangereux de faire croire qu'une modification d'ACL est durable ou qu'un espace PRIVATE est protégé si les routes et les médias historiques peuvent encore le traverser. La persistence et le raccordement au moteur de pages/publication relèvent de la consolidation avec les Missions 011-A (routes) et 011-B (chargeurs privés) et d'une future écriture des politiques transactionnelle.

## Tests réellement exécutés sur GitHub Actions

Workflow : `.github/workflows/celebrations-m011c-existing-editor-tests.yml` — **Node 22 et Chromium, données fictives, permissions `contents: read`**, aucun secret ni déploiement.

- Suite Node M011-C + régressions M005/M007-B/M009-B/M010-B/M010-D : **45 tests réussis, aucun échec**. Inclut original non modifié, historisation et annulation, duplication sans droit individuel, conservation des blocs/médias/traductions, projection de brouillon, refus de politique invalide, transport administrateur même origine, route absente, jeton manquant.
- Ancien navigateur M010-B : **PASS** sur 1440, 390 et 320 pixels avec données D1 simulées et 126+ contacts fictifs.
- Nouveau navigateur M011-C : **PASS** sur 1440, 390 et 320 pixels. Vérifie la navigation réutilisée dans une coquille locale de l'éditeur, le montage unique M007-B, la pagination et recherche, la création de brouillon d'espace et de page, Annuler/Rétablir, duplication, boutons de sauvegarde/publication désactivés, l'absence d'écriture POST et l'absence de débordement horizontal.
- Contrôle de périmètre : **PASS** ; aucun changement des Worker, modèles de domaine, API, sécurité serveur, migrations, données officielles, page publique ni infrastructure.

**Limites des tests :** le test de navigation utilise une coquille DOM locale compatible avec le panneau historique, et non une session réelle du site complet. Aucun test sur le Worker public, D1/R2 réel, ou sur les politiques de pages enregistrées. La fonctionnalité accessible depuis la nouvelle navigation ne devient effective en production qu'après consolidation, connexion et validation du transport sûr.

## Fichiers relevant de Construction C

`admin.html`, `admin-member-spaces-bridge.js`, `migration/cloudflare/app/admin/editor-member-spaces-integration.mjs`, `migration/cloudflare/app/admin/editor-spaces-draft.mjs`, `migration/cloudflare/app/admin/editor-member-spaces.css`, petits gardes UI de `member-access-admin-ui.mjs` et `member-directory-admin-integration.mjs`, tests et workflow ci-dessus. Aucun fichier appartenant aux Constructions A ou B n'a été modifié.
