# CÉLÉBRATIONS — contrôles du site de prévisualisation read-only

La deuxième vérification a confirmé HTTP 200 sur l'accueil, le pont JavaScript et robots.txt ; Cloudflare applique sa redirection canonique HTTP 307 de /admin.html vers /admin (même origine). Le test attend désormais le document HTML final en suivant uniquement cette redirection sur le hostname du Worker de test, jamais sur le site officiel. Poursuivre les contrôles des 112 fichiers approuvés, des neuf invitations, de l'administration verrouillée et du navigateur mobile, sans enregistrement de statistiques et sans DNS modifiés.
