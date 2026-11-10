# CÉLÉBRATIONS — Mission 007-B : administration des membres et autorisations

**Statut : composant isolé de préparation. Aucun branchement aux pages publiques, aux comptes ou à D1, aucune mise en production.**

## Réutilisation de M002

Toute décision d'accès reste déléguée à
`migration/cloudflare/app/domain/member-access.mjs` : `createMemberType`,
`renameMemberType`, `assignMemberTypes`, `enrollInSpace` (validation des
inscriptions existantes) et `canAccessPage` (aperçu de décision). Aucune
seconde logique d'autorisation n'est créée.

Les types ont un ID permanent de la forme `member-type:...`, attribué par
l'administrateur ou, plus tard, par le service de création **de confiance**.
Les noms peuvent changer sans changer les relations. Aucun identifiant
historique de groupe (`all`, `angel`, `nonangel`) ne donne implicitement
des droits. Les types suspendus ne peuvent pas recevoir de nouveaux droits ;
leurs associations historiques restent conservées.

Le modèle `app/admin/member-access-admin-model.mjs` reçoit des tableaux
`types`, `members`, `memberships`, `pages`, `spaces` et
`enrollments`. Il refuse les références inconnues, les doublons et les
politiques non valides. Les pages sans `accessPolicy` restent implicitement
publiques (compatibilité M002), sans réécriture de la source.

L'UI `app/admin/member-access-admin-ui.mjs` est **opt-in**.
Elle propose : création/renommage des types, attribution multiple pour chaque
personne, et choix d'un mode pour chacune des trois catégories de pages
(ordinaires, bas de page, célébrations). Les formulaires sont accessibles au
clavier et la feuille `app/admin/member-access-admin.css` est responsive.
Elle n'utilise pas `innerHTML` pour afficher les noms fournis.

Exemple d'intégration future dans **une page d'administration authentifiée**
uniquement (pas dans les routes publiques) :

```js
import {mountMemberAccessAdmin} from './app/admin/member-access-admin-ui.mjs';

// Charger de façon authentifiée les données canoniques, non depuis la page
// publique ou un localStorage modifiable par le navigateur.
const admin = mountMemberAccessAdmin(document.querySelector('#member-admin'), {
  initialState: recordsFromAuthenticatedAdminApi,
  onChange: (draft, change) => {
    // Aperçu uniquement : NE PAS considérer cela comme une sauvegarde D1.
    showUnsavedDraft(draft, change);
  }
});
// Charger séparément la CSS member-access-admin.css sur cette seule page.
```

`draftMemberAdminChanges` expose un manifeste portable de modifications
(IDs et noms des types, relations personnes↔types, politiques des pages,
inscriptions individuelles inchangées). Ce manifeste est une **proposition**,
pas une preuve d'autorisation. La persistance atomique avec gestion de conflit,
la création de personnes, la migration D1 et les formulaires d'inscription
aux espaces privés sont **hors mission 007-B**.

## Contrôle serveur obligatoire avant ouverture des contenus privés

Le futur raccordement doit :

1. Identifier la personne depuis une **session vérifiée côté serveur**. Ne
   jamais accepter `principal`, `types` ou `enrollments` fournis par le
   navigateur comme preuves d'accès.
2. Recharger en base les pages canoniques, les types actifs, leurs associations,
   l'espace associé et l'inscription **individuelle** à cet espace.
3. Appeler `canAccessPage(page, trustedContext)` (qui impose
   `canAccessSpace` pour une page d'espace) **avant** de retourner la moindre
   donnée privée ; fail closed sur une page, un ID, un espace ou une session
   inconnus. Pour un espace privé, l'inscription individuelle est nécessaire
   même si la politique de l'espace est `PUBLIC`.
4. Refaire les mêmes vérifications sur les URL directes, traductions, APIs de
   publication, recherches, exports, snapshots et accès médias/fichiers R2
   (ou émettre des liens temporaires signés après contrôle). Ne pas exposer les
   données privées dans HTML public, navigation publique, cache partagé, JS
   de bootstrap ou endpoint d'assets non protégé.
5. Séparer les pouvoirs d'administration (qui peut créer/attribuer/modifier)
   des droits de lecture. Valider à nouveau les IDs et politiques **dans le
   service d'écriture** et auditer les changements. Révoquer les caches/liens
   appropriés lorsque les permissions changent.
6. Tester les refus en HTTP **401/403 avant le contenu** depuis une requête
   réelle sans session, avec une autre personne, sans inscription, avec type
   suspendu, et avec accès direct à un média privé.

**Ne pas affirmer que les contenus sont déjà protégés** : cette mission ne
modifie aucune route publique et n'installe aucun garde serveur.

## Vérifications

`node --test tests/test_mission002_member_access.mjs tests/test_m003_localization.mjs tests/test_m004_page_localization.mjs tests/test_m005_celebration_spaces.mjs tests/test_m007b_member_admin.mjs`

La CI de la branche M007-B vérifie en outre la syntaxe Node 22. Les missions
006 (navigation multilingue) et 007-A (répertoire D1) travaillent sur
d'autres branches et fichiers. Consolider d'abord avant le raccordement.
