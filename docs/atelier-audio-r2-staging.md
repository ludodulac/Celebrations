# Célébrations — bibliothèque audio R2 (ATELIER DE TEST)

## Périmètre et indépendance du site officiel
- Worker : `celebrations-exit-staging` exclusivement.
- Stockage R2 : `celebrations-exit-staging` (binding `MEDIA_BUCKET`).
- Nouvelle collection MP3 : `editor-trials/audio/<UUID>.mp3`.
- Le site officiel, le bucket de production, les 47 pages historiques, les publications et les autorisations des fichiers de comité ne sont pas modifiés.
- Les brouillons des pages de l’atelier sont pour le moment dans le `localStorage` du navigateur : ils ne sont **pas** partagés entre appareils. Les fichiers MP3 terminés sont **réellement** dans R2 staging.

## Où voir tous les fichiers, même non liés à une page ?
Dans l'atelier de test `/__editor/demo-preparation` → **♫ MP3 et stockage R2** :
- « Actualiser les MP3 de R2 » liste la collection audio depuis R2, non depuis un index local.
- « Inventorier tous les fichiers du stockage R2 (admin) » liste **tous les objets** du bucket, tous préfixes, y compris les anciens et ceux réservés au comité. Seules les métadonnées sont affichées ; aucune URL publique ou téléchargement de document privé n'est fourni.
- L'inventaire est paginé (100 objets par requête), avec indication s'il est complet.
- Un objet peut ne plus figurer sur aucune page locale tout en restant dans le bucket. Ne pas assimiler « aucune utilisation trouvée sur cet appareil » à « inutilisé sur tous les appareils ».

## Import MP3
- Limite : 300 Mio (314 572 800 octets) par fichier.
- Le format original MP3 est conservé, sans transcodage automatique ni dégradation.
- Sélectionner un MP3, lire la durée détectée (si disponible), puis lancer l'import.
- Le navigateur envoie des tranches de 10 Mio avec l'API multipart R2, et un indicateur de progression.
- Le premier morceau est soumis à une vérification de signature MP3 ; le fichier terminé est contrôlé sur la taille attendue.
- Si l'envoi est annulé ou échoue, tentative d'abandon de l'import multipart. R2 supprime normalement les imports incomplets après 7 jours ; les imports incomplets ne figurent pas dans la liste ordinaire des objets R2.
- Aucun automatisme ne supprime les fichiers audio finalisés en cas de retrait d'une page. Une suppression permanente n'a pas été exposée tant que les usages des différents appareils ne sont pas centralisés.

## Accès et confidentialité
- Lecture de l'inventaire, import, écoute et métadonnées : **session administrateur staging requise**.
- Les mutations utilisent le jeton administrateur dans un en-tête `Authorization`, jamais dans une URL.
- L'écoute via le lecteur HTML5 utilise un cookie `Secure; HttpOnly; SameSite=Strict` et un contrôle serveur de la session pour chaque requête/Range.
- L'endpoint refuse les clés autres que `editor-trials/audio/<UUID>.mp3` pour écouter des MP3 de test.
- Les fichiers du comité ne sont pas lisibles depuis cet endpoint, même si leurs chemins apparaissent dans l'inventaire réservé aux administrateurs.

## Limites actuellement assumées
- Le stockage des brouillons n'est pas encore serveur : un collègue connecté depuis un autre appareil peut voir le même stock R2, mais pas encore les utilisations locales des MP3 sur chaque autre appareil.
- Aucune compression MP3 automatique n'est intégrée. Elle devra être facultative et testée pour respecter la qualité des conférences et de la musique.
- La suppression de médias R2 depuis cet atelier est volontairement bloquée tant que la détection des références multi-appareils n'est pas fiable.
- Les tests automatisés du backend utilisent un faux stockage et ne prouvent pas encore un vrai upload de 300 Mio. Ne pas déclarer l'intégration complète avant un essai manuel avec un compte administrateur sur le staging.
