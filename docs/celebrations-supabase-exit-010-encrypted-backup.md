# CÉLÉBRATIONS — ÉTAPE 10A : utilitaire de sauvegarde locale chiffrée (PRÉPARÉ, non exécuté sur données réelles)

Date : 20 octobre 2026. Branche de revue `audit/celebrations-supabase-exit-007`. 

## Pourquoi un outil supplémentaire ?

L'organisation Supabase active est en formule **FREE** : ne pas présumer de sauvegarde quotidienne automatique. Les 16 tables Célébrations comportent au moins un compte participant, des empreintes de mots de passe et des sessions, ainsi que des clics/statistiques. **Interdit de placer leurs exportations en clair dans ce dépôt public, un commentaire GitHub, un workflow artifact non chiffré ou un document Google partagé.**

## Ce qui a été implémenté

`migration/encrypted_backup.py` fournit deux opérations locales :

- `--output /chemin/prive/celebrations.cbackup` : consulte exclusivement les 16 tables préautorisées de la source Supabase connue, crée un export éphémère privé, valide les SHA-256 et les comptes de lignes, chiffre une archive locale neuve avec **AES-256-GCM** ; clé dérivée du mot de passe par **scrypt** (sel aléatoire). Refuse tout remplacement d'une archive existante.
- `--verify /chemin/prive/celebrations.cbackup` : déchiffre **en mémoire**, vérifie toutes les tables et leurs empreintes SHA-256, puis affiche uniquement une confirmation. Aucun mot de passe ou donnée sensible dans la sortie console.

Le mot de passe est saisi dans un prompt masqué ou lu depuis la variable d'environnement `CELEBRATIONS_BACKUP_PASSPHRASE`. Ne pas mettre le mot de passe dans une commande, un `workflow_dispatch` input, une PR ou un message ChatGPT. Utiliser un **mot de passe unique réellement aléatoire de 32 caractères ou davantage**, enregistré dans un gestionnaire de mots de passe fiable. Sans lui, l'archive ne sera pas déchiffrable.

### Préparation dans un ordinateur privé et maîtrisé

Installer Python 3 et les deux dépendances `requests` et `cryptography==46.0.4`. Préparer localement `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` (valeur à laisser dans les secrets, **jamais** dans un dépôt, un chat, une capture ou une console enregistrée). Lancer ensuite depuis la racine du dépôt :

```sh
python -m migration.encrypted_backup --output celebrations-2026-10.cbackup
python -m migration.encrypted_backup --verify celebrations-2026-10.cbackup
```

Il n'y a **aucune commande `--restore` automatique** qui pourrait écraser la production. La restauration doit être répétée sur une base isolée, avec le schéma approprié et réconciliation, puis revue humaine.

## Limitations bloquantes — NE PAS confondre avec le backup final certifié

1. **Aucun export réel n'a encore été exécuté.** Les tests GitHub ont utilisé uniquement des données de démonstration ; la dernière exécution CI qui vérifie l'outil n'ouvre pas de connexion de production.
2. Le contenu chiffré ne couvre que les **16 tables applicatives Célébrations** et leurs données. Il ne comporte pas les autres tables du projet « La forêt enchantée », ni les Edge Functions, les secrets, les rôles PostgreSQL, les politiques RLS, le DNS, ni les objets binaires Storage. Les **158 médias** font l'objet d'un inventaire/procédure distincte.
3. Un export paginé REST **n'est PAS un snapshot transactionnel** des 16 tables. Même avec le tri des clés et les contrôles d'effectifs, une mise à jour concurrente sans changement de nombre de lignes peut produire un export mélangeant deux états. Pour une sauvegarde définitive avant bascule, **geler les écritures** et/ou effectuer un `pg_dump` transactionnel de PostgreSQL dans un environnement privé. La procédure globale de rollback doit aussi couvrir les autres applications du projet partagé.
4. Une archive locale chiffrée n'est pas elle-même un stockage hors site : conserver au moins une copie privée indépendante et tester son ouverture depuis cet emplacement.
5. Si un export transitoire existe sur un stockage local, une suppression normale de ses fichiers **ne garantit pas leur effacement physique sécurisé** (SSD, snapshots). Exécuter uniquement sur machine privée, disque chiffré et stockage temporaire protégé.

## Contrôles existants

La CI de la branche a exécuté un test local d'archive : création, droits du fichier limités, déchiffrement correct, refus du mot de passe erroné, altération détectée, refus d'écrasement ; aucune donnée personnelle réelle.

**Statut** : `ENCRYPTED_BACKUP_TOOL=READY_FOR_PRIVATE_RUN`, `REAL_ENCRYPTED_BACKUP_EXISTS=NOT_VERIFIED`, `TRANSACTIONAL_SNAPSHOT=NO`, `READY_FOR_PRODUCTION=NO`.

**Aucun D1, R2, Worker, DNS ou Supabase n'a été modifié pour cette préparation.**
