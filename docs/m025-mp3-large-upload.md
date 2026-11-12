# M025 — MP3 jusqu'à 200 Mo, sans compression

## Décision et périmètre
Le propriétaire a choisi explicitement : « On ne va pas faire de compression, on va autoriser à 200 Mo ». La précédente limite MP3 était de 25 Mo. Les formats, les noms de médias historiques, les identifiants et les métadonnées du site restent inchangés.

## Architecture — seule intégration R2 existante
- MP3 jusqu'à **25 Mo** : formulaire actuel inchangé (limite de corps serveur de 26 Mo).
- MP3 de **plus de 25 Mo et jusqu'à 200 Mo** : multipart Cloudflare R2 avec morceaux de **10 Mo**, soit au maximum 20 morceaux. Aucun envoi HTTP ne dépasse le plafond d'une requête Free de 100 Mo.
- Le service est concentré dans `app/application/editor-multipart-upload.mjs`. Les commandes `mpu-start`, `mpu-status`, `mpu-part`, `mpu-complete` et `mpu-abort` utilisent le même endpoint `/api/editor-media` derrière l'authentification PIN, l'origine HTTP et la protection CSRF existantes. Aucun nouveau Worker, bucket, migration D1 ou mécanisme d'authentification.
- Les sessions partielles R2 sont stockées dans le **bucket éditeur existant**, dans un préfixe interne non servi publiquement. Les clés finales restent `editor-trials/uploads/<uuid>.mp3`, servies par `/media/new/<uuid>.mp3`.
- Le navigateur mémorise seulement l'ID du transfert et les ETags des morceaux confirmés. Après une interruption, choisir le même MP3 permet de reprendre. Le lecteur ne conserve pas les 200 Mo dans localStorage et ne compresse jamais le fichier.
- Le fichier n'entre dans la médiathèque qu'après achèvement multipart et vérification de la **taille exacte**. En cas de réponse réseau perdue, le statut et la finalisation sont répétables sans créer une deuxième entrée.
- Les sessions suspendues expirent après 24 heures côté application, avec auto-abort Cloudflare des multipart incomplets au bout de 7 jours.

## Contrôles et livraison
- Tests Node de limites 200 Mo, invalides >200 Mo, reprises, erreurs, refus de publication partielle, finalisation R2 et catalogage idempotent.
- Compilation déterministe de l'éditeur depuis sa source canonique, et tests de régression M024/M022.
- Préproduction M016 : sauvegardes chiffrées D1/R2, navigateur smartphone 390 px + desktop 1280 px, import d'un MP3 de test >50 Mo sans toucher au site officiel (effacement du média d'essai après preuve), confirmation de la progression et de la reprise.
- Seulement si l'ensemble réussit, mise en ligne sur le Worker officiel **existant**, après sauvegarde vérifiée et possibilité de rollback. Préserver le vrai code administrateur, les historiques et les autorisations privées. L'authentification réelle du propriétaire ne peut pas être simulée avec le code de préproduction.

## Hors périmètre
Aucun outil de compression ni de réencodage audio. Pas de fichiers WAV de 200 Mo, pas de vidéo R2 plus grande, pas de migration, pas de nouvelle interface.
