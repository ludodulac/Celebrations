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

## Deuxième écart corrigé AVANT le test de navigation

Le builder précédent ne remplaçait l'ancien bootstrap Supabase que pour les sept pages `programme`, `mercredi` à `dimanche`, et `apres-celebration`. Les entrées réelles `bibliotheque/index.html` et `apres-la-ronde/index.html` étaient encore copiées avec l'ancien SDK ; le chargement isolé de ces URLs aurait pu reparler à Supabase. Leur bootstrap est maintenant traité comme celui des autres pages (Cloudflare-only), avec rejet si l'ancien SDK subsiste. Le programme Préparation est généré après la transformation pour réutiliser cette base sûre. Aucun changement du site officiel.

Le test est déclenché depuis le nouvel état du code (les correctifs sont compris dans le commit qui porte le marqueur ci-dessous).

## Premier contrôle CI : endpoints PASS, ajustement de synchronisation du test image

[run #39806822747](https://github.com/ludodulac/Celebrations/actions/runs/39806822747) : les tests unitaires ont réussi, le Worker Cloudflare indépendant a été déployé, et la **vérification HTTP de toutes les 10 pages et des 113 médias** a réussi. Le navigateur a rencontré une erreur **dans le script de test** : sa lecture de `img.currentSrc` pouvait précéder le chargement effectif de l'image (`Invalid URL`). Le test attend maintenant `complete && naturalWidth>0 && currentSrc` avant de construire l'URL, sans réduire aucun contrôle visuel. Nouveau job de navigation déclenché ci-dessous, toujours sans toucher au domaine officiel.

## Tests de navigation : 7/7 journées et galerie mobile PASS ; rectification du scénario de test

[run #39807221548](https://github.com/ludodulac/Celebrations/actions/runs/39807221548) : HTTP de toutes les pages et des médias **SUCCESS**. Dans Chromium mobile, accueil, chargement D1, sélection des sept jours via leurs boutons et la galerie d'images sont **PASS**. Le script browser de contrôle supposait ensuite à tort que l'URL `/apres-celebration/` était une page « Informations », alors que son contenu est le **septième jour du programme**, comme le souhaite le site actuel. Le test a été rectifié pour demander la visibilité de `#program`, sans changer les fonctionnalités du site. Ce nouvel essai inclut les essais bureau et les URLs en accès direct.

## RÉSULTAT FINAL — MISSION 09 : PASS (22 octobre 2026)

**GitHub Actions [run #39807554552](https://github.com/ludodulac/Celebrations/actions/runs/39807554552) — SUCCESS**, job `mission09-real-public-site-browser`, suite entière de tests unitaires, HTTP et navigateur exécutée après les correctifs sur les vraies pages.

### Tests HTTP sur le Worker de prévisualisation (D1/R2 migrées)

- **10/10 vrais liens de pages autonomes** : Programme, Préparation, Mercredi, Jeudi, Vendredi, Samedi, Dimanche, Après célébration, Bibliothèque, Après la Ronde.
- **113/113 fichiers publics** HTTP HEAD 200.
- **9/9 lettres de comité** privées délivrées par leur slug opaque ; anciennes formes `/?lettre=` conservées ; accès privé direct non autorisé refusé.
- **211 fiches éditoriales**, **62 événements**, **124 associations événement-contenu** et réglages publics accessibles depuis Cloudflare D1.
- Photo d'accueil d'origine JPEG HTTP 200 depuis R2 privé avec chemin inchangé.
- API d'administration et écriture indisponibles par conception sur la prévisualisation, réponses 405 aux POST ; tables sensibles refusées.

### Véritable navigateur Chromium, deux tailles d'écran

| Fonction du site visible | Android (390 px) | Bureau (1280 px) |
|---|---|---|
| Accueil et JPEG décodé | PASS | PASS |
| Chargement exclusif Cloudflare | PASS | PASS |
| Boutons Accueil, Programme, Médiathèque | 3/3 | 3/3 |
| Sélection des sept jours | 7/7 | 7/7 |
| URL du jour synchronisée au clic | 7/7 | 7/7 |
| Ouverture directe des dix vraies pages | 10/10 | 10/10 |
| Familles Audio, Vidéo, Textes/PDF, Images | 4/4 | 4/4 |
| Fiches médias affichées dans l'interface | 38 audios, 17 vidéos, 46 textes/PDF | Idem |
| Galerie réellement chargée sans image visible cassée | PASS | PASS |
| PDF du jeudi récupéré en R2 | HTTP 200 | HTTP 200 |
| Accès administrateur verrouillé | PASS | PASS |

Requêtes vers **l'ancien Supabase depuis le navigateur Cloudflare : 0**. Erreurs JavaScript non interceptées : **0**. Réponses serveur Cloudflare 5xx : **0**. Les 22 tentatives de mutation déclenchées par les navigateurs (suivi statistique) ont été **bloquées avant le réseau**. Quotas D1 Free contrôlés avant/après ; snapshots Analytics agrégés 110 257 lignes lues et 1 059 écrites (métriques différées ; ceci ne constitue pas une mesure du coût exact du job). Ce job n'a effectué aucune écriture volontaire D1, R2, Supabase, DNS ni GitHub `main`.

### Correctifs effectifs et périmètre

1. **`/preparation` est un vrai lien de navigation interne du programme**, désormais servi comme page Cloudflare autonome et non redirigé vers l'ancien raccourci Drive. Le Worker historique des invitations de mission 06 reste inchangé.
2. Les pages réellement accessibles **Bibliothèque** et **Après la Ronde** chargent désormais aussi le client Cloudflare dans le build migré. Aucun SDK Supabase sur ces entrées profondes.
3. Les quatre anciens raccourcis Drive non rattachés à l'interface restent **hors périmètre** ; aucune restauration de leur fonction demandée, et aucun blocage arbitraire de bascule.

**Décision : MISSION 09 = PASS pour les écrans publics et chemins testés sur la prévisualisation indépendante.** Ce succès n'est PAS un changement du domaine officiel ni un accord de cutover. L'authentification réelle administrateur et les règles des brouillons légaux/statistiques seront traitées par les missions correspondantes ; la synchronisation finale de données fluctuantes reste à faire avant la bascule. Les lecteurs multimédia ont été contrôlés comme composants et ressources servies ; ce test ne revendique pas l'écoute humaine intégrale de chaque audio, ni la lecture de chaque vidéo tiers.
