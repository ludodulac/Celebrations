# CÉLÉBRATIONS — ÉTAPE 2 : sauvegarde réelle, déclenchement protégé depuis GitHub

**État initial : l'outil et le workflow sont PRÉPARÉS, mais aucune sauvegarde de données réelles n'est encore créée.**

## Pourquoi une action humaine minimale est nécessaire

Les 16 tables historiques contiennent des données privées et des hachages de mots de passe. Il serait dangereux de les télécharger en clair dans GitHub, de les montrer dans une conversation, de conserver une clé en clair dans un fichier ou de créer une sauvegarde chiffrée avec une clé que personne ne peut retrouver.

La nouvelle procédure utilise donc :
- les identifiants Supabase **déjà enregistrés** dans l'environnement GitHub `celebrations-staging` (jamais publiés) ;
- un **nouveau secret GitHub**, `CELEBRATIONS_BACKUP_PASSPHRASE`, que **seul le propriétaire** saisira dans l'interface sécurisée ;
- l'outil de sauvegarde `migration/encrypted_backup.py`, en lecture seule sur le **projet Supabase fixé** et les **16 tables Célébrations** ;
- une archive **chiffrée AES-256-GCM**, envoyée **uniquement dans le bucket Cloudflare R2 privé de test** `celebrations-exit-staging`, sous un chemin `private-backups/`. Aucune archive n'est publiée comme artifact GitHub ; **aucun JSON en clair n'est uploadé**. Une écriture R2 privée et une lecture de vérification sont nécessaires, mais **aucune opération D1**.

### Action unique du propriétaire, sur téléphone ou ordinateur

1. Dans GitHub, ouvrir `ludodulac/Celebrations` → `Settings` → `Environments` → `celebrations-staging` → **Environment secrets**.
2. Créer le secret `CELEBRATIONS_BACKUP_PASSPHRASE` et lui attribuer **une phrase secrète aléatoire unique d'au moins 32 caractères, idéalement 48+**, fabriquée avec un gestionnaire de mots de passe. La conserver aussi dans le gestionnaire. **Ne pas coller sa valeur dans ChatGPT, un ticket ou une PR.**
3. Répondre simplement : « secret installé ». L'assistant pourra alors déclencher une seule exécution en effectuant un commit **sur la branche de migration uniquement** avec le marqueur `[BACKUP_ENCRYPTED_ONCE]`.

### Pourquoi un marqueur plutôt que « Run workflow » ?

GitHub ne garantit pas de montrer `workflow_dispatch` dans son interface lorsque le workflow n'existe pas sur la branche `main`. Nous refusons de modifier `main`, car le moindre push sur `main` relance GitHub Pages du site en production. Le nouveau workflow se déclenche uniquement sur un push à `feat/celebrations-supabase-exit-001` **avec le marqueur exact dans le message du dernier commit**. Tous les autres commits sont ignorés.

### Après l'exécution

1. Vérifier le run GitHub Actions : `BACKUP_ENCRYPTED_AND_VERIFIED` et `BACKUP_OFFLINE_CHECK_OK`, **sans voir de données personnelles**.
2. Vérifier la preuve `PRIVATE_R2_CIPHERTEXT_VERIFIED` dans le run : la copie **chiffrée** a été écrite dans le bucket R2 privé `celebrations-exit-staging`, avec un chemin unique `private-backups/source-...cbackup`.
3. Depuis le **tableau de bord Cloudflare privé**, ouvrir `R2` → `celebrations-exit-staging` → `private-backups/` puis télécharger le fichier `.cbackup` dans un emplacement **privé et indépendant de Cloudflare**. Ne pas activer de domaine public pour ce dossier. Garder le secret séparément.
4. **Vérifier après téléchargement** en local avec `python -m migration.encrypted_backup --verify ...`. La restauration d'essai isolée certifiera ensuite la récupération.
5. Conserver deux exemplaires chiffrés dans des emplacements indépendants. Une copie dans le R2 de staging seul ne suffit **pas** à une sauvegarde durable hors du fournisseur de migration ; ne jamais la considérer comme la validation complète de l'étape 2.

## Important : ce que nous n'affirmons pas

- Le workflow ne sauvegarde **pas** les 158 objets binaires Storage. Ils font l'objet d'un processus distinct.
- L'export HTTP paginé garantit les contrôles de décompte et de SHA-256 des lignes récupérées, **pas** la cohérence transactionnelle d'une base modifiée en parallèle. Un **point de sauvegarde PostgreSQL transactionnel**, ou un gel des modifications suivi d'une archive certifiée, reste requis pour le basculement définitif.
- Il ne sauvegarde pas les données d'autres logiciels qui utilisent le même projet Supabase.
- Ne pas couper Supabase, ne pas basculer le domaine, ne pas purger D1/R2, et ne pas déclarer l'étape 2 terminée tant que l'archive réelle et sa conservation hors GitHub ne sont pas vérifiées.

## Sécurité du flux

`PENDING_OWNER_SECRET=YES` · `REAL_BACKUP_RUN=NO` · `D1_WRITES=0` · `R2_PRIVATE_UPLOAD_PENDING=YES` · `PRODUCTION_CHANGES=0`.
