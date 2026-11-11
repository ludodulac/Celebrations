# M020-C — Médiathèque administrative

Base : `26ca8c66315045b250c4c9d821ff2820fa2ca56a`.

La médiathèque de l’éditeur existant conserve ses cartes, miniatures, inventaires et actions. Quatre onglets visibles : Images, Audios, Vidéos, Documents (PDF et autres documents regroupés à l’affichage). Recherche des noms sans rechargement ni interruption du lecteur. Les vidéos locales rejoignent la catégorie vidéo sans déplacer leurs fichiers.

Les cartes audio et vidéo utilisent les lecteurs natifs, avec métadonnées uniquement au chargement, commandes, durée, déplacement et volume selon le navigateur. Démarrer un lecteur met les autres en pause. Les PDF du même domaine disposent d’un aperçu ouvert à la demande et d’un lien d’ouverture ; les PDF externes conservent le lien d’ouverture. Les documents gardent leur titre cliquable et leur type.

Le serveur des nouveaux fichiers répond aux plages HTTP Range, requises pour avancer dans les MP3 sans télécharger tout le fichier. Le point d’entrée et ses contrôles d’autorisation ne changent pas. Aucun octet, droit, publication ni ressource Cloudflare de production n’a été modifié.

L’envoi existant utilise toujours les événements réels XMLHttpRequest. Le retour du serveur doit confirmer `ok: true` et fournir le fichier avant ajout au catalogue. À la fin de l’envoi, le message indique la vérification par le serveur ; 100 % est réservé au succès confirmé.

## Limites vérifiées dans le serveur

- Import de cette médiathèque : MP3/WAV/PDF/DOCX 25 000 000 octets ; images 8 000 000 ; TXT 5 000 000. Enveloppe multipart limitée à 26 000 000 octets.
- Les nouvelles vidéos restent des liens externes, comme avant. Les lecteurs embarqués respectent la politique média existante : même domaine et blobs locaux ; un lien externe peut nécessiter l’ouverture dans un autre onglet.
- L’atelier audio de test séparé accepte déjà 300 MiB ; cette limite ne s’applique pas à l’import normal de la médiathèque. Aucune modification de cet atelier.
- Les commandes natives et l’aperçu PDF dépendent du navigateur ; le lien d’ouverture reste disponible.
- Les médias refusés par les protections existantes ne deviennent pas accessibles du fait de l’ajout d’un lecteur.

## Vérification

45 tests ciblés réussis : catalogue, publication, frontières de confidentialité, atelier audio existant, plages MP3 et confirmation réelle des envois. Compilation du script généré et synchronisation source/build vérifiées ; `git diff --check` réussi.

Commande :

```sh
node --test tests/test-m020c-media-upload.mjs tests/test-m020c-media-range.mjs tests/test_mission08_media_catalogue.mjs tests/test-editor-publication-media.mjs tests/test_m009c_public_media_api_security.mjs tests/test-editor-trial-audio.mjs
node scripts/build-m019-editor-client.mjs --check
```

Parcours Chromium ordinateur/smartphone préparé dans `scripts/test-m020c-media-browser.mjs`. Exécution bloquée avant ouverture du navigateur par `socket() failed: Operation not permitted`. Ce parcours ne constitue donc pas une validation visuelle acquise. Aucun essai sur le site officiel.
