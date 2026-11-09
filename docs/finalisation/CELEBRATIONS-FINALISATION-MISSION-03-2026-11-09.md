# 🌸 CÉLÉBRATIONS — FINALISATION MISSION 3/5 : SAUVEGARDES ET RESTAURATION RÉELLES

**9 novembre 2026.** Branche `release/celebrations-finalisation-03-backups-20261109` fondée sur la finalisation M2. **Le site officiel, le code du Worker déployé, les DNS, les bases D1/R2 et les fichiers sources n'ont pas été modifiés.** Les seules écritures ont concerné des copies de sauvegarde chiffrées temporaires sur GitHub Actions et une sauvegarde définitive dans un dossier Google Drive privé du propriétaire.

## 1 — Sauvegarde réelle du site, pas des fixtures

**[Github Actions #42628200520](https://github.com/ludodulac/Celebrations/actions/runs/42628200520) : SUCCESS**, le 9 novembre vers 13:48 UTC.

| Source actuelle | Résultat contrôlé |
| --- | ---: |
| R2 production, bucket `celebrations-exit-production` | **122 objets, 768 179 248 octets** |
| R2 staging, bucket `celebrations-exit-staging` (hors anciens objets `private-backups/*`) | **181 objets, 835 034 325 octets** |
| Total chemins originaux capturés | **303 objets R2** |
| Données réellement distinctes après SHA-256 de leur contenu | **176 charges utiles**, les doublons sont référencés dans le manifeste privé |
| Base D1 actuelle | **19 tables, 12 797 lignes**, 141 SELECT, reconstruction SQLite en RAM et vérification `integrity_check=ok` et 0 violation de clés étrangères |
| Éditeur du site | **Révision 117**, huit pages brouillon, huit pages publiées de célébration, une page générale + sa publication |
| Worker officiel actif | **Source multipart originale, métadonnées de version et paramètres script** lus à l'API Cloudflare et placés chiffrés dans l'archive |
| Identité Worker avant capture | Déploiement `cd46e1ba-e106-4f03-90aa-7110628a5b9f`, version `dcda4193-1d82-4283-9f0e-ae8a09e6a444` |
| Objets logiques reconstruits et vérifiés | **307/307**, dont 303 R2 + D1 + script Worker + version Worker + paramètres Worker |
| Paquets chiffrés après déduplication | **203 morceaux**, **836 862 057 octets** (hors enveloppes ZIP) |
| Écritures sur D1/R2 et Worker production | **0** |

Chaque objet R2 a été lu avec sa clé historique, son ETag revérifié, son contenu haché SHA-256 et ses morceaux chiffrés AES-256-GCM à nonce unique. Aucun original en clair n'a été déposé dans un artefact GitHub. La déduplication a comparé les **octets réellement hachés**, pas seulement les noms et tailles. L'archive contient un manifeste chiffré avec les noms internes et les empreintes originales nécessaires à la restauration.

**Seuls les anciens objets de sauvegarde sous `private-backups/*` ont été exclus** : ils ne sont pas nécessaires pour retrouver l'état courant, qui a fait l'objet d'une nouvelle capture chiffrée. La mission ne promet pas de reproduire tout l'historique des sauvegardes précédentes.

## 2 — Copie hors Cloudflare, dans le Google Drive privé du propriétaire

L'archive temporaire a d'abord été écrite sur GitHub Actions, puis divisée en **10 archives ZIP chiffrées de moins de 100 Mo** (le connecteur d'upload Drive refuse les fichiers plus gros). L'opération n'a pas réinterrogé Cloudflare, les 203 morceaux ont été revérifiés par empreinte, et les 10 archives ont été envoyées dans le dossier Google Drive privé :

**« SAUVEGARDES PRIVEES - Celebrations - 2026-11-09 »**.

Contrôles des métadonnées Google Drive :
- **10/10 fichiers** présents, total **837 903 997 octets** (ZIP).
- **10/10 appartiennent au dossier privé**, chacun signale **`shared=false`** et la seule permission retournée est **`user:owner`**.
- Les 10 archives ont été **retéléchargées depuis Google Drive**, pas seulement depuis GitHub. Leurs **10 SHA-256 complets correspondent exactement aux ZIP sources**. Les archives ont été relues, tests ZIP natifs OK, **203 morceaux chiffrés distincts et 1 manifeste identique copié dans chaque ZIP**, aucune pièce manquante ou inattendue.
- Les anciennes copies GitHub sont **temporaires**, expirant automatiquement après 3 ou 30 jours selon l'artefact ; **Google Drive est la sauvegarde persistante indépendante de Cloudflare**.

### Empreintes des ZIP retéléchargés depuis Drive (SHA-256)

| Fichier | SHA-256 |
| --- | --- |
| Partie 01/10 | `53787ca1f60a5727ea1dea05b8e3a46c67e8ea6f6674224ab0d1b2cebdd9f9a5` |
| Partie 02/10 | `0c689813bbaabec31014353724a73f497a94e262dc1f5e4aca906cffa131e0c1` |
| Partie 03/10 | `ad19ff5407c0688d57bb0d8a142e31e8b988f3281a2108b580001e503fead97c` |
| Partie 04/10 | `4eea6fde7ebf8d51067c8ba381ea645af5400910fa08b8fdf6eaa38d6657f0e8` |
| Partie 05/10 | `d002a21b13dafb581c3d6198ff4d36224204c1ee818c715fdde74efcdc340d92` |
| Partie 06/10 | `22feedee2f0f68b83fa72bb6574268c7689a6f645edf4436ef549587515ca46d` |
| Partie 07/10 | `5d47eefa81ecb2c36c6e399ec94955e6127fae4d8119ca31ee054767220d475e` |
| Partie 08/10 | `6e68a54328ecfe4e709abc5eb3cb78d06b56b0cf284c8b1b73237b065940c6ba` |
| Partie 09/10 | `73d007416c980d7c85f0dc52b9e6b3ae6ad18617051cf61d11b40cbb12e35969` |
| Partie 10/10 | `5611d39107c08b4b6e08497ef91c4209b5b574b632377d1652842504c8c3d34c` |

Ces empreintes portent sur les ZIP **chiffrés**, et ne donnent ni identités des utilisateurs ni chemins médias privés.

## 3 — Restauration isolée réellement effectuée

**[GitHub Actions #42630277901](https://github.com/ludodulac/Celebrations/actions/runs/42630277901) : SUCCESS.**

Le script `scripts/finalisation03_restore_offline.py` a récupéré le grand artefact chiffré créé initialement sur GitHub, l'a ouvert avec le secret de sauvegarde du projet et a reconstruit dans un **nouveau dossier temporaire isolé** :
- **307/307 éléments** avec SHA-256 strictement égal aux originaux après déchiffrement.
- Tous les chemins R2 sous leur bucket d'origine (dont ceux de staging, hors anciennes archives de sauvegarde).
- La D1 dans sa représentation JSON logique et **un fichier SQLite reconstruit et vérifié** : 19 tables / 12 797 lignes / intégrité OK / 0 violation des clés étrangères.
- La source multipart de Worker, ses paramètres et son identité de version.

Le script **refuse d'écraser un dossier de restauration existant**, contrôle les chemins contre `../` et n'utilise **aucune API Cloudflare**, aucune modification distante. Le dossier en clair créé uniquement pour l'essai a été supprimé de la machine éphémère du test à la fin. Tests Python supplémentaires : 2/2 de restauration disque et 4/4 de cryptographie/doublons.

**Distinction importante :** cette restauration prouve que les octets et une SQLite autonome sont récupérables **hors de Cloudflare**. **Elle ne constitue pas encore un basculement du site sur un autre compte Cloudflare**, ni une restauration D1 en production dans un nouveau compte ; cette migration sera une étape ultérieure. Le retour arrière du Worker en production est possible selon la documentation Cloudflare via la version exacte, mais il **n'a volontairement pas été exécuté sur le site actif**. Un rollback de Worker seul ne restaure pas ses fichiers R2 ni son contenu D1.

## 4 — Procédure de récupération pour un humain

1. Sur Google Drive, ouvrir le dossier privé **« SAUVEGARDES PRIVEES - Celebrations - 2026-11-09 »** et télécharger **les 10 ZIP**.
2. **Extraire tous les ZIP dans le même dossier**. Le `manifest.cbackup` identique est présent dans chaque archive, les autres fichiers chiffrés de chaque ZIP ont des noms distincts.
3. Récupérer la **clé de déchiffrement** `CELEBRATIONS_BACKUP_PASSPHRASE`, aujourd'hui configurée comme secret de l'environnement GitHub `celebrations-staging`. Cette valeur n'est ni lisible depuis GitHub, ni imprimée dans les logs ; **elle doit être conservée séparément dans un coffre de mots de passe possédé par le propriétaire avant toute suppression/changement de compte GitHub**. Ne jamais coller cette clé dans un dépôt public.
4. Avec Python et les dépendances requises, exécuter `python scripts/finalisation03_restore_offline.py --archive-folder /chemin/archive --new-destination /chemin/restauration-neuve`.
5. Vérifier les compteurs et les SHA, puis **établir un plan de migration explicite des bindings et ressources vers le nouveau compte Cloudflare** ; ne jamais remplacer directement la D1 ou le R2 actuellement en ligne.

## 5 — Limites à ne pas masquer

- **La D1 est une sauvegarde logique paginée par SELECT, et non un instantané transactionnel figé** : des changements concurrents de valeur sans changement de nombre de lignes sont théoriquement possibles.
- **La clé de récupération est aujourd'hui détenue par un secret GitHub**, dont la valeur ne peut pas être relue à partir de l'interface : il faut garantir son enregistrement en sécurité par le propriétaire. Le test de restauration confirme que le secret configuré fonctionne.
- Les **assets statiques liés au Worker** ne sont pas certifiés byte-for-byte à partir du paquet Cloudflare ; le dépôt GitHub conserve le code source et les outils de reconstruction. L'intégrité des pages et médias publics a par ailleurs été vérifiée sur le site réel lors des missions antérieures.
- Les 10 copies Drive sont indépendantes de Cloudflare, mais toutes conservées dans **un même Drive privé**. Pour une stratégie de sauvegarde résiliente à la perte de ce compte Google, le propriétaire pourra conserver une copie chiffrée supplémentaire sur support hors ligne.
- Aucun test d'import D1/R2 sur le futur Cloudflare du collègue, ni de bascule DNS ni de rollback sur le domaine officiel. Ces opérations seraient perturbatrices et ne font pas partie de M3.

## 6 — Décision de clôture

**Mission 3 — SAUVEGARDE CHIFFRÉE COMPLÈTE ET RESTAURATION LOCALE ISOLÉE : RÉUSSIE.**

Les exigences de copies réelles hors Cloudflare, déchiffrement, intégrité, reconstruction SQLite et source Worker sont toutes **vérifiées**. Le site actif n'a pas été modifié. Avant la migration vers l'autre Cloudflare, **sécuriser hors GitHub la clé actuelle** et organiser la vérification des bindings/assets et l'import sur un compte de test.

Les suites du projet restent : **Mission 4 — recette réelle avec utilisateur**, puis **Mission 5 — publication de la refonte**, sans fusion automatique avant validation du propriétaire.

## 7 — Nettoyage des archives temporaires GitHub après copie Drive vérifiée

**[GitHub Actions #42632080089](https://github.com/ludodulac/Celebrations/actions/runs/42632080089) : SUCCESS** le 9 novembre vers 14:10 UTC. Après vérification du contenu téléchargé depuis Google Drive (10/10 ZIP avec SHA-256 complet identique), le workflow borné `celebrations-finalisation-mission-03-cleanup.yml` a **supprimé exclusivement les 13 archives de sauvegarde GitHub temporaires créées par M3** (grand ZIP initial, deux parties d'essai trop volumineuses pour le connecteur Drive, les dix petits ZIP de transfert). Chaque suppression exigeait l'ID, le nom attendu et l'ID d'une des trois exécutions M3 autorisées. **13/13 effacées ; aucune modification de Google Drive, R2, D1, du code Worker ou de DNS.**

Motif : éviter des dizaines de jours d'occupation GitHub Actions potentiellement facturable et limiter la diffusion des archives chiffrées dans un dépôt public. La sauvegarde privée sur Google Drive, les archives de données Cloudflare antérieures, le code GitHub et la preuve des restaurations de la mission 3 sont conservés. Les anciens runs de restauration #42630277901 restent comme preuve d'exécution, mais le gros artefact temporaire qu'ils utilisaient a été retiré. Pour une nouvelle vérification, télécharger les dix fichiers Drive et les extraire dans un dossier neuf, puis utiliser le script de restauration locale avec la clé GitHub.
