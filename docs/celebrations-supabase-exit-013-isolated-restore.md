# CÉLÉBRATIONS — ÉTAPE 3 : répétition de restauration de l'archive chiffrée réelle

L'utilisateur a confirmé le **téléchargement sur son ordinateur** de l'archive chiffrée créée le 20 octobre 2026. Cela ne vérifie pas encore l'intégrité du fichier présent sur son ordinateur : lui faire garder son mot de passe hors conversation et sa copie locale inchangée.

## Vérification technique préparée

Le contrôle automatique dédié `migration/verify_real_backup_restore.py`, déclenchable **une seule fois à la demande** par le commit `[VERIFY_BACKUP_RESTORE_ONCE]` sur `feat/celebrations-supabase-exit-001`, réalise les opérations suivantes :

1. Lecture **du seul objet privé R2 déjà sauvegardé** sous le préfixe précis `private-backups/source-20261020T183600Z-` (taille attendue **380825 octets**). Aucun transfert vers un artifact GitHub ni autre stockage.
2. Déchiffrement AES-256-GCM à l'aide de la **phrase secrète déjà stockée** dans l'environnement GitHub privé `celebrations-staging` : elle n'est jamais affichée.
3. Vérification des **16 fichiers JSON** et de leurs empreintes SHA-256, du manifeste, et des volumes de lignes.
4. Écriture temporaire des données en clair et création d'une base **SQLite strictement locale** dans `/dev/shm`, système de fichiers en mémoire vive fourni par le runner Linux (fail closed si absent). Le schéma est `migration/cloudflare/celebrations-schema.sql`, identique à celui des tests de migration, mais **la base distante Cloudflare D1 n'est jamais contactée**.
5. Import relationnel des 16 tables et vérification des volumes, des contraintes de clés étrangères et de `PRAGMA integrity_check`. Suppression du répertoire temporaire à la fin.
6. Affichage de **comptages globaux uniquement** (`tables`, `rows`, `foreign_key_violations`), sans afficher lignes, adresses e-mail, mots de passe, hachages, jetons ou chemins privés.

Ce test utilise le chiffrement existant, des secrets stockés par GitHub, et **ne lit plus la base source Supabase**. Le seul appel réseau requis est une lecture de l'objet chiffré dans **R2 privé** ; D1 et le site public ne sont pas sollicités.

## Ce qui ne pourra PAS être certifié par ce test

- Le téléchargement local de l'utilisateur est le même fichier binaire que celui de R2 (la vérification devra être effectuée sur sa copie locale).
- Les 158 fichiers média et l'ensemble du projet Supabase partagé sont sauvegardés.
- L'archive est un instantané PostgreSQL transactionnel de toutes les tables pendant des écritures concurrentes : l'export initial était paginé REST.
- La restauration de production Cloudflare sera identique à une restauration SQLite locale ; un essai D1 isolé et des tests du site restent à faire plus tard.
- Le fait que la copie chiffrée sur l'ordinateur soit durable, chiffrée au repos, disponible sur un second support ou déchiffrable depuis cette machine.

**Statut initial :** `PRIVATE_REAL_RESTORE_REHEARSAL=PREPARED`, pas encore `PASS` tant que GitHub Actions n'a pas effectivement exécuté le test.

**Aucune migration en production, modification DNS, copie Storage, suppression Supabase, ni écriture D1.**
