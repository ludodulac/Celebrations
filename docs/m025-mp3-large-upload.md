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

## Vérification en situation réelle

Une mission M016 isolée lance un import multipart réel de **55 000 001 octets**, vérifie les 6 parties, simule une interruption et une reprise, lit 16 octets de l'original depuis la route R2 existante et supprime le fichier d'essai. Aucun média de test ne doit rester dans le R2 de préproduction. Le domaine officiel reste strictement inchangé pendant ce parcours.

## Première épreuve R2 réelle (réussite, validation générale à relancer)

Exécution M016 `43212783453` : transfert réel **55 000 001 octets** par 6 morceaux, reprise après pause, exactitude des octets sur la route publique Range HTTP 206, suppression complète du média d'essai — **TOUS PASS**. Le seul échec du job concernait le test de navigation M023 après ce succès : le navigateur desktop cliquait un noeud DOM détaché lors du rerender d'une page historique. Ce test conserve maintenant sa vérification de navigation réelle et de l'existence du menu, sans cliquer deux fois un élément remplacé lors du rendu. Relancer l'ensemble.

## Préproduction et validation complète — 12 novembre 2026

Run `43213329108` **success**, sauvegardes chiffrées, compilation, tests de règles et Cloudflare M016. Test réel R2 : **55 000 001 octets** transportés en 6 morceaux, pause après le premier, reprise, HTTP Range 206 de 16 octets identiques, finalisation idempotente et **suppression du média d’essai confirmée**. Les pages historiques et les contrôles des médias ont passé les tests sur 390 px et 1280 px. Le Worker officiel est resté intact jusqu'à la promotion.

## Approbation pour l'activation officielle

Le propriétaire a explicitement décidé : **« Ok on va pas faire de compression on va autoriser à 200 mo »** après avoir demandé la capacité à coder cette fonctionnalité. La livraison consiste uniquement à rendre cette limite opérationnelle sur son domaine officiel, en reprenant les mécanismes Cloudflare R2 déjà présents. La mise en ligne n'est autorisée qu'après export et vérification des sauvegardes D1 et R2 de production. Aucune compression, migration D1, modification de catégorie, de rôle ou de PIN. Le rollback n'affecte que la version du Worker, jamais les données.
