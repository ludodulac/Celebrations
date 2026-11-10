# CÉLÉBRATIONS — MISSION 009-D (11 novembre 2026)
## Consolidation de 009-A, 009-B et 009-C sans squash

**Statut :** PR #124 en brouillon, aucun déploiement ni changement sur `main`. Les trois branches sources sont intactes.

### Fusions vérifiées sur GitHub

Base obligatoire : `61e699e5a90350239d2b7df25c147dbfa01e459a`.

| Étape | Commit Git de fusion | Premier parent | Second parent |
| --- | --- | --- | --- |
| 009-A | `0e6eec092afa29a38ae6c31b4bf1fcff6acf0d8a` | base obligatoire | `62501ea1e68538010bc3658e825a6a75c92884aa` |
| 009-B | `59c3c49fd75c99ca4e79c3c3a8cd389f138d3fc4` | fusion 009-A | `679277abb23027ccc551c425b08d1e39ce768437` |
| 009-C | `96a6e98822d2e34f5c4fdb66aeba1f217d449b7d` | fusion 009-B | `468b0dc4efc82dd8e01938f2185f0fc162b97f2c` |

Les changements des trois sources portent sur **35 chemins distincts** : 9 (A), 10 (B), 16 (C), sans conflits de fichiers. Le contrôle CI compare la totalité des blobs et modes conservés au commit de fusion 009-C aux trois sources originales (`git rev-parse source:path`), et atteste les trois commits à deux parents. Les historiques restent accessibles.

Les fichiers apportés incluent l'allowlist de projection publique, la publication multilingue renforcée, les tests et la documentation 009-A ; le service et l'interface d'administration 009-B, les liens explicites de personnes, leur migration SQL non exécutée en production, leurs fixtures et tests ; la frontière publique/privée des médias, les passerelles historiques renforcées, les Worker entrypoints et les tests 009-C. Aucun de ces fichiers n'a été retiré.

Une correction **exclusivement CI** a été appliquée après les fusions à `.github/workflows/celebrations-m009b-admin-identity-tests.yml` : sa vérification « la mission 009-B n'a pas modifié les Workers publics » porte désormais sur le commit source 009-B, et non sur HEAD consolidé où 009-A et 009-C modifient légitimement ces mêmes fichiers. Le garde des imports de routes privées reste actif. Ce changement n'affecte aucune fonction applicative et ne modifie aucune branche source.

### Risque critique constaté — NE PAS ACTIVER LES ESPACES PRIVÉS

Les deux modules coexistent :
- `migration/cloudflare/app/security/member-private-access.mjs` (M008-C) : `resolveVerifiedMember` valide une session historique, puis joint `celebrations_directory_people` et `celebrations_participants` **sur la simple égalité des e-mails**. Cette égalité ne prouve pas l'identité d'une personne, même si les deux comptes sont valides.
- `migration/cloudflare/app/security/member-identity-links.mjs` (M009-B) : `resolveExplicitMemberIdentity` exige une entrée de `celebrations_directory_identity_links` créée seulement après une revendication et une vérification/approbation administrateur. Une session participant ou une adresse identique ne crée jamais ce lien.

**Incompatibilité fonctionnelle :** si on active les handlers privés M008-C en l'état, ils peuvent accorder à un compte historique des droits de la personne D1 homonyme par e-mail sans l'accord explicite imposé par M009-B. Ce serait un contournement des règles d'identité. Le test `tests/test_m009d_cross_integration.mjs` construit une identité fictive sans lien approuvé : l'ancien résolveur l'accepte, le nouveau renvoie `null`. Il vérifie également que ni le Worker production ni le Worker staging n'importent les routes ou services membres privés.

**Action requise dans la mission suivante :** raccorder les handlers M008-C au résolveur explicite M009-B et aux données D1 fiables, tester l'absence de droits avant approbation, la révocation, les multiples types/inscriptions et toutes les voies de lecture privée. Ne PAS faire de rapprochement automatique par adresse. Ne PAS activer de route, faire une migration réelle ni créer un second moteur d'autorisations dans 009-D.

### Compatibilités publication/médias

Les tests M009-A contrôlent les réponses publiques HTML/JSON, les traductions publiées, l'exclusion des brouillons et données privées. Les tests M009-C couvrent les passerelles `/media`, `/letter`, `/media/new`, les données D1 historiques, les médias privés fictifs et l'absence d'accès R2 lors des refus. Le test croisé 009-D ajoute une projection anonyme publique avec PDF historique et PDF privé fictifs ; la liste de médias ne publie que le PDF historique, la passerelle historique sert ses octets simulés, et le chemin privé est refusé **avant toute lecture R2**.

**Limites strictes :** ce ne sont pas des tests de contenu réel en production. Les tests Chromium FR/EN et admin utilisent un navigateur réel avec données fictives, requêtes interceptées et/ou serveur local uniquement ; aucun test navigateur ne navigue sur le domaine réel. La requête d'un ancien PDF réel en production n'est pas attestée. Le futur stockage R2 privé doit être physiquement séparé, sans URL publique `r2.dev` ou domaine custom, et les caches CDN existants doivent être vérifiés avant activation.

### Vérifications effectuées

Le premier workflow isolé M009-D GitHub Actions, run **42922668710**, a terminé en **SUCCESS** :
- **256 tests Node réussis, 0 échec, 0 ignoré**, couvrant M002 à M009-D, éditeur, publication, multilingue, autorisations, médias et non-régressions ;
- intégrité des trois commits Git et des 35 blobs confirmée ;
- Chromium local : pages en français et anglais sur **ordinateur 1280 px** et **format Android 375 px**, puis administration membres **1440 px / 390 px**, résultats réussis ;
- Cloudflare Wrangler D1 **local exclusivement** : schéma et migrations 007-A, 008-B, 009-B, fixtures et vérification des clés étrangères réussis ; tests SQLite locaux des contacts/types/inscriptions aussi inclus dans les 256 ;
- vérification que les routes privées membres ne sont pas activées.

Les workflows déclenchés ensuite par la PR et les commits correctifs doivent être examinés à leur propre SHA. Les 78, 74 et 86 tests annoncés par les missions sources ne sont **pas** ajoutés à ce décompte, car des tests sont communs et repris dans la suite combinée.

### Contrôle Cloudflare ouvert

`Workers Builds: celebrations` échouait déjà sur la base M008-D et sur des commits antérieurs. Les checks GitHub ne donnent pas le journal d'erreur du Workers Build. Ce problème demeure **ouvert** ; aucun contournement, suppression de check ou correctif spéculatif. Examiner le premier message d'erreur des logs Cloudflare du Build ID avant toute correction.

### Production inchangée

Pas de fusion dans `main`, pas de déploiement, aucun accès en écriture aux environnements Cloudflare, aucun changement de donnée réelle D1/R2, aucune activation des espaces privés, aucune diffusion de données personnelles.
