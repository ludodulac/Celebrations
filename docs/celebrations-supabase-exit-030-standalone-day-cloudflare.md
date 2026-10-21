# CÉLÉBRATIONS — Mission 030 : les 7 URL directes doivent utiliser Cloudflare, pas Supabase

**Anomalie découverte avant bascule** : le pipeline build_production_assets.py corrigeait déjà index.html et admin.html, mais laissait inchangées les pages autonomes programme/index.html, mercredi/index.html, jeudi/index.html, vendredi/index.html, samedi/index.html, dimanche/index.html et apres-celebration/index.html. Chacune chargeait encore le SDK Supabase du CDN et ne définissait pas le pont Cloudflare dans ses scripts.

**Correction sans toucher au site actuel :**

- Le build de production (uniquement hors ligne dans la branche de migration) enlève le SDK Supabase de ces sept fichiers et insère avant supabase-data.js le backend Cloudflare location.origin.
- L'adaptateur Cloudflare preview-client.js est injecté une fois à la même position logique que sur la page d'accueil, entre supabase-client.js et public-universal-mode.js ; aucun changement aux fichiers originaux du site public.
- Les tests de build vérifient l'ordre exact des scripts et l'absence de l'ancien SDK sur les neuf pages (accueil, admin et sept routes).
- Le site de vérification en lecture seule prévoit des contrôles HTTP + navigateur mobile sur ces sept pages et vérifie zéro requête au Supabase historique.
- Le nombre de médias testés devient 113 fichiers publics, car le PDF de jeudi, absent de Supabase, a été retrouvé par Drive et restauré dans la R2 de production (GitHub Actions #39646280347 SUCCESS). Neuf invitations comité privées inchangées, soit 122 fichiers au total.

**Sécurité :** Worker indépendant GET/HEAD seulement, pas de connexion admin ni de comptage de visites pendant les audits, pas de DNS ni de remplacement de GitHub main ; R2 et D1 de production ne sont pas modifiés par ce patch statique.

**Règle de sortie :** la certification attend les résultats réels de l'audit browser sur le nouveau site ; ne pas inférer la réussite à partir de la seule présence du correctif.