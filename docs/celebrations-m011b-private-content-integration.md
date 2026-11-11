# CÉLÉBRATIONS — M011-B : lecture canonique des contenus privés

**Périmètre : Construction B.** Base imposée `b30fb44c0ea3ab15b16c45b93c504edd5e576c40` (M010-D).
Branche : `feat/celebrations-m011b-private-content-server-integration-20261111`.

**NON DÉPLOYÉ.** Aucun point d'entrée Worker, aucune route, aucun fichier R2 réel, aucune table D1 réelle, aucune configuration Wrangler, aucune branche `main` modifiés. Les états, médias, identités et autorisations des tests sont fictifs.

## 1. Architecture effectivement réalisée

- `app/persistence/private-canonical-content.mjs` : `createCanonicalPrivateLoaders(env)`, lecture *en lecture seule* de la clé **existante** `EDITOR_SNAPSHOT_KEY` dans `EDITOR_BUCKET`, via l'adaptateur M010 `readEditorSnapshot`. Il utilise seulement `state.published`, jamais `state.drafts`, `state.localization` ou `state.mediaCatalogue`.
- `app/application/private-content-read-service.mjs` : `handleCanonicalPrivatePage`, `handleCanonicalPrivateMedia`, `handleCanonicalPrivateList`, `listAuthorizedPrivatePages`, `canonicalPrivatePageOptions`. Chaque garde HTTP passe par les **fonctions existantes** `handlePrivatePage`, `handlePrivateMedia`, `allowedPrivatePageIds` de M008-C ; elles vérifient la session de participant M010-A (identité liée par décision humaine approuvée) et les autorisations réelles D1/M002.
- Les pages chargées ont un `id` unique, un `celebrationId` exact, une `visibility: published`, un `publicationStatus: published`, une politique M002 explicite et une liste de blocs valide. Une page d'espace doit appartenir exactement à son espace M005 ; l'espace doit lui-même avoir une publication valide. Toute collision d'identifiant élimine les éléments concernés.
- Les espaces privés utilisent **à chaque requête** les tables D1 existantes `celebrations_directory_private_spaces`, `celebrations_directory_private_space_enrollments`, `celebrations_directory_person_celebrations`. Une inscription concerne la **personne permanente**, l'espace et la **même** célébration ; les droits de type sont consultés séparément. Aucun droit n'est dérivé du navigateur, d'un e-mail égal, d'une catégorie historique ou d'une traduction.

### Contrat essentiel de publication : NON encore produit par l'éditeur

La fonction historique `initialPublication()` copie des objets éditoriaux dans `published.drafts` lors d'une publication **non liée** à ces objets. Il serait donc dangereux de s'appuyer seulement sur `visibility` ou `publicationStatus`. La M011-B exige **en plus** deux manifestes de publication positifs, stockés exclusivement sous `state.published` :

```js
state.published.privatePageReleases = {
  'page:41:chapelle': {
    pageId: 'page:41:chapelle',
    celebrationId: '41',
    spaceId: 'space:41:chapelle',  // absent pour une page racine
    publication: 'published'
  }
};
state.published.privateSpaceReleases = {
  'space:41:chapelle': {
    spaceId: 'space:41:chapelle',
    celebrationId: '41',
    publication: 'published'
  }
};
```

L'éditeur/publicateur futur doit écrire ces manifestes atomiquement avec la révision publiée, depuis une **commande administrateur réellement authentifiée** ; ne jamais recopier ces manifestes lors d'une duplication. La mission C est propriétaire de l'interface ; le raccordement d'une commande de publication sécurisée reste soumis à une validation ultérieure. À défaut, le lecteur refuse volontairement tous les nouveaux contenus privés (404, sans divulgation). Aucune page privée actuellement présente dans les brouillons n'est rendue publique par ce module.

Les célébrations privées dans D1 sont numériques canoniques (ex. `'41'`), cohérentes avec `celebrations_celebrations.id`. Les anciennes pages générales partagées, sans propriétaire canonique, ne sont pas « promues » en pages membres par simple politique privée ; elles nécessitent un futur contrat explicite.

## 2. Média R2 privé : contrat strict

Une ressource privée n'est résolue que depuis `state.published.privateMedia` et jamais depuis les catalogues historiques, `src`, `href`, `remoteKey`, `assetId`, `url` ou une clé fournie par le client :

```js
state.published.privateMedia = [{
  id: 'private-asset:pdf-41',
  pageId: 'page:41:private-root',
  celebrationId: '41',
  // spaceId: 'space:41:chapelle' si la page appartient à cet espace
  visibility: 'private',
  publicationStatus: 'published',
  storageKey: 'private-members/41/report.pdf',
  mimeType: 'application/pdf'
}];
```

Le bloc publié de la page doit référencer `{mediaId:'private-asset:pdf-41'}` ; si le média n'est plus dans **les blocs canoniques publiés**, il n'est plus accessible. Une traduction ne peut créer un nouveau média accessible par sa simple URL ou son `mediaId`.

`handleCanonicalPrivateMedia` exige `PRIVATE_MEMBER_BUCKET` **distinct par identité de binding** de `MEDIA_BUCKET` et `EDITOR_BUCKET`, puis autorise la page, compare `pageId` et la référence publiée et lit la clé privée sans la renvoyer. L'ancienne passerelle `/media`, le catalogue public et les fichiers `/media/new` restent protégés par M009-C ; aucun stockage privé n'est servi par ces voies. Pour une véritable isolation, le bucket ne doit avoir ni domaine public, ni politique anonyme, ni alias public : à vérifier avant l'activation future.

Les fichiers sont envoyés en pièce jointe (`Content-Disposition: attachment`), sans cache, sans ETag, avec `nosniff`, `noindex` et CSP restrictive. `HEAD` et les demandes de plage valides réutilisent les règles M008-C.

## 3. Recherche, navigation et langues

La liste récupère au plus 1 000 candidats **du snapshot publié**. Elle appelle `allowedPrivatePageIds` **avant de calculer** le nom traduit ou la recherche. Le résultat ne contient que les pages accessibles à cet instant ; aucun total, titre, extrait ou indicateur d'existence des pages refusées n'est renvoyé. Une erreur D1/R2 produit un refus générique.

Le rendu de page autorisée réutilise le moteur M003 `resolvePageTranslation`. La M011-B ne lit que `published.privateTranslationReleases[pageId]`, marquée `publication: published`, et le registre linguistique publié ; `state.localization` (brouillons) reste inaccessible. La traduction ne peut modifier `id`, `celebrationId`, `spaceId`, `accessPolicy`, `visibility` ni le statut de publication. Les champs du rendu sont volontairement limités : `id`, propriétaire, nom, langue et blocs éditoriaux approuvés ; jamais les métadonnées d'autorisation ni les clés internes R2. Une page non autorisée n'atteint même pas le résolveur de langue.

La révocation d'un type, d'une inscription individuelle, d'une liaison d'identité ou de la session est prise en compte **à la requête HTTP suivante** : aucune permission D1 n'est mise en cache. Le snapshot R2 est mutualisé uniquement entre les chargeurs **de la même requête**, ce qui évite le mélange de révisions page/espace/média.

## 4. Contrats d'intégration à remettre à Construction A

Les routes suivantes sont **des suggestions de convention**, et non des routes créées. Le propriétaire du Worker décide des chemins finaux, active seulement après revue globale et conserve le filtrage M009-C en amont de `ASSETS` :

```js
import {
  handleCanonicalPrivatePage,handleCanonicalPrivateMedia,handleCanonicalPrivateList
} from './app/application/private-content-read-service.mjs';

// Dans une route membre isolée, vérifier méthode et ID du chemin.
// Ne transmettre ni objet page, ni droits, ni identité issus du navigateur.
return handleCanonicalPrivatePage(request,env,{
  pageId: canonicalPageIdFromPath,
  languageId: new URL(request.url).searchParams.get('lang')
});

return handleCanonicalPrivateMedia(request,env,{
  pageId: canonicalOwnerPageIdFromPath,
  mediaId: canonicalMediaIdFromPath
});

return handleCanonicalPrivateList(request,env,{
  celebrationId: canonicalCelebrationIdFromPath,
  languageId: new URL(request.url).searchParams.get('lang'),
  search: new URL(request.url).searchParams.get('search')??'',
  limit: 50
});
```

**Obligatoire avant toute ouverture** : publier les manifestes privés de manière contrôlée dans le moteur éditorial, prévoir la révocation des releases au masquage/suppression, connecter le binding R2 isolé, valider les migrations additives D1 sur un environnement autorisé, auditer tous les accès alternatifs et tester sur un environnement isolé. Les fichiers statiques/URLs publiques historiques NE DEVIENNENT PAS des documents privés par un simple changement de menu.

## 5. Validation locale

`tests/test_m011b_private_content_integration.mjs` utilise les **véritables schémas** SQL locaux de D1 (SQLite en mémoire, FK activées, session hachée, identité explicitement approuvée, attributions et inscriptions) et **deux stockages R2 simulés distincts**. Il vérifie l'autorisation, le refus uniforme, les brouillons, la concurrence d'IDs, les rattachements à la célébration, les traductions, la recherche sans fuite, la révocation immédiate, les copies M005, les clés privées et les anciennes passerelles. Le workflow CI M011-B est **sans secret** et en lecture seule. Les régressions M002, M005, M008, M009, M010 sont aussi exécutées.

### Limites explicites

Les tests sont locaux, pas un essai D1/R2 de production, un test navigateur réel ni une validation du routeur Cloudflare. Aucune route membre n'est active. Les commandes de publication des manifests privés, l'édition M011-C et l'activation Worker M011-A ne font pas partie de cette livraison ; leurs responsabilités restent séparées. L'absence de ces composants doit bloquer toute activation prématurée.
