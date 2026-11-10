# CÉLÉBRATIONS — M007-A, annuaire central D1 (PROPOSITION, non appliquée)

Base étudiée : `feat/celebrations-m005c-consolidation-004-005-20261110`, commit `f02e520a8ed8e8793ac69bd42f30d836a2438302`. La base relationnelle existante (`migration/cloudflare/celebrations-schema.sql`) inclut notamment `celebrations_celebrations(id INTEGER)`, `celebrations_participants(email PRIMARY KEY)`, `celebrations_user_profiles(user_id)`, `celebrations_groups(id)` et les sessions d'authentification. Les modèles M002/M005 définissent déjà les identités de types et l'accès privé, **sans stockage D1 de leurs liens**. Les anciennes audiences `angel/nonangel/all` ne sont **pas** des types M002.

## Modèle additif : six nouvelles tables

| Table | Rôle / clé |
| --- | --- |
| `celebrations_directory_people` | Personne globale `id TEXT` permanent (UUID préfixé `person:`), `email_normalized` unique (NOCASE), prénom/nom facultatifs. |
| `celebrations_directory_member_types` | Catalogue M002 `member-type:...`, nom modifiable, `disabled` (0/1). |
| `celebrations_directory_person_types` | Plusieurs types par personne, PK `(person_id,type_id)`, deux FK. |
| `celebrations_directory_person_celebrations` | Participation à plusieurs célébrations, PK `(person_id,celebration_id)`, FK vers la célébration D1 existante. |
| `celebrations_directory_private_spaces` | Référentiel minimal des identifiants de **seuls espaces privés** et de leur célébration (pas une seconde copie des pages/ACL). À remplir uniquement depuis la source M005 vérifiée. |
| `celebrations_directory_private_space_enrollments` | Inscription **individuelle** à l'espace, PK `(person_id,space_id)`. Deux FK composites garantissent que l'espace et la participation appartiennent à la **même célébration**. |

Tout est référencé par identifiant, sans copier noms, adresses e-mail ni objets de célébration dans les tables de relation. `celebration_id` se répète seulement dans les inscriptions privées afin de permettre la contrainte de cohérence inter-tables. Les FK sont `ON DELETE RESTRICT`. Trois triggers empêchent la modification des identifiants de personne, type et espace. Modifier l'e-mail normalisé n'altère pas l'identifiant de la personne.

## Normalisation / compatibilité

`normalizeDirectoryEmail()` effectue `trim` + minuscules (compatible avec les comptes historiques courants), puis valide un sous-ensemble ASCII volontairement strict. Une adresse est unique de manière insensible à la casse en D1. On **ne fusionne pas** les variantes Gmail avec points ou tags `+`, et on ne fait pas de correspondance approximative des noms. Les cas EAI/IDNA (Unicode) nécessitent une décision de politique d'identité avant import; une adresse non reconnue est refusée, non corrigée silencieusement. Une personne sans adresse e-mail ne peut pas encore être créée dans cette proposition : cas à arbitrer avant migration effective.

Une ancienne ligne `celebrations_participants` n'est **pas** automatiquement un `person` actif. Le raccordement devra vérifier côté serveur la session du compte historique, trouver l'e-mail normalisé, lier cette identité à un ID stable et traiter les collisions manuellement. Conserver les secrets, salages, sessions et questions de récupération uniquement dans le système d'authentification actuel ; aucun de ces champs ne rejoint l'annuaire. Les futures réponses `principal.id` devront utiliser l'identifiant permanent **après authentification**, jamais un champ envoyé par le navigateur.

Le serveur devra convertir `disabled INTEGER` en `disabled: Boolean(row.disabled)`, convertir l'ID D1 entier des célébrations en texte lorsqu'il compose l'agrégat M005, et exposer les affectations sous la forme M002 `{memberId,typeId}` / `{memberId,spaceId}`. Une inscription seule ne donne pas accès : `canAccessSpace` exige authentification et politique de types appropriée. Vérifier l'état canonique `PRIVATE` et la célébration de chaque espace avant d'insérer la ligne `private_spaces`.

## Migrations D1 préparées (NON EXÉCUTÉES)

- Montée versionnée : `migration/cloudflare/d1-migrations/20261110_007a_contact_directory.sql`. À intégrer plus tard explicitement dans la configuration de migrations Wrangler de la bonne base, après revue. L'absence actuelle de `migrations_dir` actif évite un lancement involontaire.
- Retour arrière : `migration/cloudflare/d1-rollbacks/20261110_007a_contact_directory.empty-only.sql`. **Ce fichier n'est pas dans le dossier de migrations automatiques.** Il vérifie d'abord que les six tables sont vides et échoue avant toute suppression si un enregistrement existe. Un retour arrière avec données devra passer par une migration de conservation/transfert dédiée, jamais par `DROP`.

Les scripts ne sont exécutés dans cette mission que **dans une base SQLite éphémère en mémoire pour les tests**. Aucun appel D1 remote/staging/production, aucun déploiement, aucun changement à `main`. Les preuves de tests SQLite ne remplacent pas une validation D1 isolée ultérieure.

## Préparation d'import CSV (sans import)

Le domaine `contact-directory.mjs` fournit `previewDirectoryCsv(csv, {existingEmails})` : CSV UTF-8 avec BOM facultatif, séparateur virgule ou point-virgule, champs entre guillemets, en-têtes français/anglais reconnus, dédoublonnage interne et contre les adresses déjà connues. Sorties : `candidates`, `duplicates`, `rejected` ; les erreurs désignent la ligne sans répéter de contenu invalide. **Aucun identifiant attribué, aucun INSERT, aucune règle d'accès tirée du CSV**. Les colonnes de droits non reconnues sont ignorées. Un futur administrateur authentifié devra valider l'aperçu, gérer les doublons, allouer chaque UUID sur le serveur puis écrire dans une transaction sûre.

## Raccordements ultérieurs (hors périmètre)

1. Relier le catalogue et l'ACL M002 aux outils de la mission 007-B, sans dépendance aux noms historiques de groupes.
2. Installer un stockage canonique D1 des espaces M005 ou requalifier le mini-référentiel d'IDs ; préserver chaque lien lors du transfert, ne pas dupliquer les pages.
3. Authentification historique vérifiée vers `person.id`, adapter serveur seul et sécurité des requêtes, puis import CSV avec validation explicite et journal d'audit privé.
4. Tester sur une **D1 locale/isolée**, après approbation du SUPERVISEUR, les contraintes SQLite démontrées ici, sauvegarde/retour arrière et coûts en lectures/écritures.

## Tests

`node --test tests/test_m007a_contact_directory.mjs tests/test_mission002_member_access.mjs tests/test_m005_celebration_spaces.mjs`

Couvertures : conservation schéma D1 existant, identités permanentes, unicité e-mail, FK orphelines et composites, liens multi-types / multi-célébrations, inscription privée, vérification de politique M002, CSV et rollback vide seulement.
