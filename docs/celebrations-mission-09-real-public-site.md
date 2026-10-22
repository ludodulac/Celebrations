# CÉLÉBRATIONS — Mission 09 : vrais parcours du site public

**Mandat explicite du propriétaire :** ne migrer que les pages, menus, boutons et ressources **réellement accessibles aux visiteurs** du site actuel. Ne pas rétablir les quatre raccourcis historiques sans lien dans le site, ne pas effacer les anciennes données. Ne pas toucher au domaine officiel, aux DNS, à Supabase, à GitHub main, ni aux autres Workers.

## Nouvel écart de navigation identifié dans le vrai site

La navigation des **sept jours du programme** produit un chemin par jour avec `setPublicDayUrl()`. En particulier, le bouton réellement affiché **« Préparation »** appelle `history.pushState("/preparation")`. Or, la configuration précédente ne contenait pas `preparation/index.html` et un alias historique `/preparation` dirigeait ce chemin vers un ancien fichier Drive. **Ce n'est PAS une demande de rétablir le raccourci Drive orphelin** : ce chemin est aujourd'hui une vraie **page du programme** générée par l'interface.

Correctif strictement sur la branche de migration :
- `scripts/build_production_assets.py` génère une **page HTML Préparation** indépendante à partir du document Programme, conservant l'initialisation Cloudflare-only (aucun ancien SDK Supabase).
- `migration/cloudflare/readonly-preview-worker.mjs` et `migration/cloudflare/production-worker.mjs` ne détournent plus `/preparation` ou `/preparation/` vers l'ancienne redirection Drive ; ils servent les fichiers du programme.
- Le Worker historique `celebrations.rondes.workers.dev`, déjà certifié pour les neuf anciens PDF, **n'est pas modifié**. Les trois autres alias inutilisés restent hors périmètre. Les anciens liens physiques ne sont pas supprimés.
- Deux tests unitaires vérifient `/preparation` et `/preparation/`, et l'acceptation HTTP couvre les 10 pages réelles : Programme, Préparation, Mercredi, Jeudi, Vendredi, Samedi, Dimanche, Après célébration, Bibliothèque et Après la Ronde.

## Vérification de bout en bout

Le job opt-in `mission09-real-public-site-browser` (marqueur `[MISSION09_PUBLIC_SITE_ONCE]`) ne publie **que** le Worker indépendant et **en lecture seule** `celebrations-exit-preview-ro`, branché sur la D1/R2 déjà migrée. Il contrôle les quotas Cloudflare Free et les tests de sécurité avant et après.

Vraies navigations Chromium mobile Android 390 px puis desktop 1280 px : image d'accueil réellement chargée, chargement Cloudflare D1 complet (4 célébrations / 62 rendez-vous / 211 contenus), clic sur « Accéder aux célébrations », onglets Accueil/Programme/Médiathèque, clic des sept jours et URL résultante, menus audio/vidéo/textes/images, galerie dont seuls les fichiers réellement disponibles sont rendus, 10 URLs en entrée directe, PDF du jeudi restauré, administration verrouillée. **Toutes les requêtes POST/PUT/DELETE depuis le navigateur sont interceptées et refusées avant le réseau**, même les statistiques ; aucun nouveau compte, fichier ou donnée créée. Les URL privées et noms de ressources ne sont jamais imprimés ; les requêtes vers l'ancien Supabase, les erreurs JavaScript et les erreurs Cloudflare 5xx sont bloquantes.

En outre, le test HTTP de prévisualisation déjà existant confirme 113/113 fichiers publiés, 9 documents comité via slug, 10 véritables pages, les accès privés refusés, et les POST API bloqués.

## État

Test opt-in lancé sur la branche migration ; résultat réel à consigner d'après les journaux GitHub Actions. Ne déclarer PASS qu'après la preuve réelle sur mobile et bureau. La bascule du domaine officiel reste interdite sans son autorisation distincte.
