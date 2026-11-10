# CÉLÉBRATIONS — M008-B : persistance D1 du répertoire central

**État : branche de préparation / PR en brouillon. Aucune migration réelle, aucune modification de contact réel, aucun déploiement.** Base exacte : `c976791835fc5f1d7d2c37123face418d0501ca6` (M007-C).

## Sources canoniques réutilisées

- **M007-A** : `app/domain/contact-directory.mjs` et six tables `celebrations_directory_*` du script `20261110_007a_contact_directory.sql` (proposition non appliquée).
- **M002** : `app/domain/member-access.mjs` décide toujours des accès. Le `memberId` utilisé par M002 est **exactement** le `personId` permanent `person:UUID` de M007-A. Aucun second membre/répertoire.
- **M005** : `app/domain/celebration-spaces.mjs` valide les espaces/politiques. Son ID de célébration est une chaîne canonique (`"41"`), la FK `celebrations_celebrations.id` dans D1 est un `INTEGER` (`41`). `toD1CelebrationId` et `toDomainCelebrationId` convertissent sans accepter les chaînes ambiguës `041`, les flottants ou les entiers non sûrs.
- **M007-B** : un futur adaptateur d'API **administrateur authentifiée** peut présenter ces enregistrements, mais ses brouillons ne prouvent aucun droit.

**Historique** : `celebrations_participants.email` et `celebrations_user_profiles.user_id` restent inchangés. `hasHistoricalParticipantEmail` consulte seulement l'existence d'une adresse (lecture seule). Il n'existe **aucune liaison automatique** avec les personnes du nouvel annuaire, même en cas d'adresse identique.

## Interface D1 (serveur seulement)

Fichier : `migration/cloudflare/app/persistence/contact-directory-d1.mjs`

```js
import {createContactDirectoryD1} from './app/persistence/contact-directory-d1.mjs';

// À construire exclusivement dans un handler ADMIN authentifié et autorisé.
const directory = createContactDirectoryD1(env.DB,{
  resolveCanonicalSpace: async spaceId => loadVerifiedCanonicalM005Space(spaceId)
});
const alice = await directory.createPerson({
  id: `person:${crypto.randomUUID()}`, // UUID généré par le serveur, jamais depuis l'e-mail
  email: 'alice@example.org', givenName:'Alice'
});
await directory.createMemberType({id:'member-type:chorale',name:'Chorale'});
await directory.replacePersonMemberTypes(alice.id,['member-type:chorale']);
await directory.addPersonCelebration(alice.id,41);
await directory.enrollPersonInPrivateSpace(alice.id,'space:41:chapelle');

// N'utiliser ces liens dans M002 qu'après validation de la session serveur.
const assignments = await directory.readTrustedAssignments(alice.id);
// Un garde HTTP externe recharge et vérifie page+espace+principal,
// puis appelle canAccessPage / canAccessSpace de M002.
```

### Méthodes documentées

| Méthodes | Contrat |
| --- | --- |
| `getPerson(id)`, `getPersonByEmail(email)`, `createPerson(input)`, `updatePerson(id,patch)` | Lecture / création / modification de contacts, e-mail normalisé, ID immuable. `updatePerson` compare les anciennes valeurs (CAS) pour refuser une écriture concurrente détectée. |
| `hasHistoricalParticipantEmail(email)` | Lecture d'existence de compte ancien, jamais de fusion ou de session. |
| `getMemberTypes`, `createMemberType`, `renameMemberType`, `setMemberTypeDisabled` | Catalogue M002, ID stable même après renommage, suspension non destructive. |
| `getPersonMemberTypes`, `replacePersonMemberTypes(personId,typeIds)` | Associations M002 `{memberId,typeId}` multiples et atomiques ; conserve les associations historiques désactivées ; interdit de créer un nouveau lien vers un type désactivé. |
| `getPersonCelebrations`, `addPersonCelebration`, `removePersonCelebration` | Participations multiples avec FK vers célébration existante. Suppression impossible si des inscriptions privées la référencent. |
| `getPrivateEnrollments`, `enrollPersonInPrivateSpace`, `removePrivateEnrollment` | Inscription personnelle à un espace **PRIVATE** validé par le callback serveur M005 ; même célébration exigée par FK composites. |
| `readTrustedAssignments(personId)` | `{types,memberships,enrollments}` pour M002 **sans** `principal.authenticated`, donc aucune authentification créée. |
| `memberIdForPersonId`, `personIdForMemberId` | Identité de valeur, pas transformation de l'e-mail. |

## Barrières d'intégrité et migrations

Toutes les requêtes paramétrées utilisent `prepare().bind()`. Les opérations composées (`replacePersonMemberTypes`, enregistrement minimal + inscription d'un espace privé) utilisent `D1Database.batch` : exécution séquentielle, transaction atomique, rollback de **l'ensemble** à la moindre erreur. Les FK M007-A protègent les célébrations, personnes et inscriptions individuelles.

La nouvelle migration **additive** `d1-migrations/20261110_008b_directory_integrity.sql` ajoute des déclencheurs qui refusent l'attribution d'un type déjà suspendu et le déplacement silencieux d'un espace privé enregistré vers une autre célébration. Elle dépend de **007-A**, qui doit être installée auparavant **uniquement après validation et sauvegarde**. Dans cette mission, ni 007-A ni 008-B ne sont exécutées sur D1 staging/production. Aucun dossier de migrations automatique n'a été activé.

La présence d'une inscription en D1 **n'ouvre jamais** directement les contenus. Les décisions d'accès restent dans M002/M008-C après validation de session, et doivent aussi protéger les endpoints directs, variantes de langue, exports et fichiers R2.

## Tests (données entièrement fictives)

- `node --test tests/test_m008b_contact_directory_d1.mjs` applique le schéma existant et 007-A + 008-B dans SQLite **en mémoire** avec une façade `D1Database` (`prepare`, `bind`, `first`, `all`, `run`, `batch`). Couverture : CRUD, e-mails, identité permanente, compte historique inchangé, associations multiples, types suspendus, transaction annulée lors d'une seconde écriture défaillante, conversion des IDs, FK des inscriptions, absence de resolver, `PRAGMA foreign_key_check`.
- Le workflow `.github/workflows/celebrations-m008b-directory-d1-local.yml` exécute ces tests et les tests antérieurs M002/M005/M007, puis un smoke-test sur **Wrangler D1 --local** et une base créée sous `RUNNER_TEMP`. Il ne contient aucun secret, aucun `--remote`, aucun déploiement.

## Incompatibilités et suite (avant activation)

1. **Comptes historiques** : il manque encore le rapprochement manuel et authentifié des identités. L'égalité d'e-mail n'est jamais suffisante, y compris pour les groupes historiques `angel/nonangel/all`. Aucun mot de passe ni session n'est réutilisé par l'annuaire.
2. **Source M005** : il faut implémenter le `resolveCanonicalSpace` via le stockage éditorial validé. Sans ce callback, toute inscription échoue en sécurité. Les changements de visibilité/suppression d'espaces devront être réconciliés sans réutiliser leurs IDs.
3. **API admin** : ajouter hors mission la vérification des permissions d'écriture, le journal d'audit privé, les conflits inter-administrateurs et le verrouillage des routes. L'adaptateur n'est ni un endpoint HTTP ni un nouveau système d'authentification.
4. **Installation réelle** : contrôler la base cible, réaliser une sauvegarde, revoir les migrations 007-A puis 008-B et obtenir un accord explicite avant toute application. Les tests locaux ne prouvent pas la sécurité de données D1 existantes en production.
