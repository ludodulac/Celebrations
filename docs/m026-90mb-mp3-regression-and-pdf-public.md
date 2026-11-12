# M026 — Import MP3 90 Mo rejeté malgré la limite de 200 Mo

## Cause confirmée dans le code livré M025

La détection de l'extension MP3 dans `editor-demo-client-source.js` comportait **deux barres obliques inverses** dans la regexp, à deux endroits (sélection du mode de transfert et validation du gros fichier). `/\\\\.mp3$/i` ne reconnaît pas un vrai nom de fichier `conte.mp3`. Donc l'envoi de 90 Mo passait par l'ancien formulaire `/api/editor-media?action=upload`, plafonné à 26 000 000 octets, d'où « Transfert interrompu : Fichier trop volumineux ». Le transfert multipart R2 fonctionnait, mais le test précédent avait appelé directement l'API et n'avait pas emprunté le sélecteur réel de fichiers.

## Correction minimale et propre

Les deux expressions sont corrigées **dans la source canonique**, sans nouveau moteur, nouvelle route, bucket ou traitement des fichiers. Les envois MP3 >25 Mo passent désormais bien dans le mécanisme multipart existant (10 Mo par morceau, plafond 200 Mo sans compression).

Nouveau test : la regexp du code réellement chargé est exécutée contre `enregistrement 90 Mo.mp3`, `Mon conte.MP3` et des faux noms PDF/WAV. Nouveau parcours navigateur Chromium mobile : choisir directement un fichier de 90 000 000 octets dans la vraie médiathèque M016 (pas un appel d'API simulé), vérifier 9 requêtes multipart R2 et zéro requête de l'ancien formulaire, présence dans la bibliothèque, Range HTTP 206, suppression du fichier d'essai.

## PDF et confidentialité

Le propriétaire demande que les PDF *affichés et envoyés par lien public* restent accessibles sans authentification. Le code possède déjà une protection : seules les références à des pages effectivement publiées et publiques, ou un média explicitement libéré, autorisent un accès anonyme. Les PDF de pages non publiées ou privées doivent conserver cette protection. **Ne pas modifier les ACL ni rendre les brouillons privés publics** pendant cette correction MP3. Les liens publics déjà envoyés restent identiques.

## Déploiement

Générer le client via le script existant; réussir les tests unitaires et le parcours M016 réel; sauvegarder intégralement D1/R2 officiels chiffrés; promouvoir seulement le Worker existant sans migration; vérifier publiquement le site et la confidentialité, avec retour arrière automatique en cas d'échec.

## Premier contrôle local

La compilation déterministe de l'éditeur et les tests de renommage, médiathèque, multipart MP3 et détection d'extension ont réussi via GitHub Actions `43217237455`. Valider maintenant le navigateur réel M016 avec 90 Mo envoyés depuis le champ fichier.
