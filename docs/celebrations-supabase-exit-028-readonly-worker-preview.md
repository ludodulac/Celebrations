# CÉLÉBRATIONS — Mission 028 : prévisualisation Cloudflare privée en écriture (lecture seule)

Le propriétaire a autorisé la préparation et les tests sur une adresse Cloudflare distincte, mais aucun changement DNS, Supabase source ou GitHub main.

## Nouveau Worker indépendant

- Adresse de test prévue : https://celebrations-exit-preview-ro.rondes.workers.dev
- Worker distinct : celebrations-exit-preview-ro ; il n'est jamais le Worker définitif celebrations-exit-production.
- D1 et R2 liées : nouvelles ressources de production isolées ; aucun domaine personnalisé ni routage du site officiel.
- Code du Worker : GET et HEAD uniquement. Toutes les modifications de données (stats, inscription, connexion et administration) sont refusées.
- Données exposées : seulement les tables éditoriales publiques, les 112 médias approuvés et neuf PDF comité via leurs slugs individuels. L'ACL et le bucket empêchent l'accès aux 37 objets inutilisés.
- Indexation refusée : X-Robots-Tag: noindex et robots.txt Disallow /. Réponses Cache-Control: no-store.
- Aucun secret de compte administrateur réel déployé ; ce lot ne valide PAS une connexion réelle ni les modifications admin. Le verrouillage est simplement vérifié.

## Vérifications d'acceptation

Job volontaire readonly-production-data-preview-once sur la branche migration par le marqueur [PROD_READONLY_PREVIEW_ONCE], après vérification du quota Free au niveau du compte. Vérifications requises :

1. 112 HEAD HTTP 200 pour les fichiers approuvés et neuf invitations par slug ; refus des chemins comité bruts et fichiers inconnus.
2. Quatre célébrations, 62 événements, 211 contenus et 124 relations depuis la vraie D1.
3. Protection contre les POST, exclusion de l'API comptes et absence d'indexation.
4. Chromium sur écran mobile : accueil, programme, médiathèque, écran administrateur verrouillé.
5. Aucun appel vers Supabase depuis le navigateur et aucun write du navigateur (POST bloqués deux fois).
6. Quota Free vérifié avant/après ; aucun secret, chemin privé ou slug journalisé.

## Points restant avant bascule réelle

- 31 anciennes références de médias absents à clarifier pour que chaque ressource effectivement visible fonctionne.
- Administration et authentification de production à configurer/tester séparément sans reprendre les anciennes sessions.
- Pages légales, fonctions d'édition et compte utilisateur à tester sur un environnement isolé réversible.
- Dernier delta des statistiques et modifications du programme après gel des écritures, nouvelle sauvegarde.
- Retour arrière DNSSEC/Spaceship prêt et autorisation explicite du propriétaire avant la moindre bascule DNS.
- Supabase étant partagé avec d'autres projets, ne jamais le supprimer.

Ne déclarer SUCCESS qu'après lecture de l'exécution GitHub réelle.
## Résultat réel confirmé le 21 octobre 2026

GitHub Actions https://github.com/ludodulac/Celebrations/actions/runs/39644456141 : **SUCCESS**.

- Worker autonome **https://celebrations-exit-preview-ro.rondes.workers.dev** déployé, sans route vers le vrai domaine et sans créer le Worker de production final.
- **112/112 médias publics HTTP HEAD 200** avec ACL source prod ; **9/9 PDF comité sous slug HEAD 200** ; chemin comité brut et chemins inconnus renvoient 404.
- **4 célébrations, 62 événements, 211 fiches, 124 relations et 1 réglage public** confirmés depuis la nouvelle D1.
- Tous les endpoints mutateurs POST (dont admin, login et stats) refusent les écritures ; API participants non accessible par GET (404).
- Site mobile Chromium : l'Accueil, le Programme et la Médiathèque ont été affichés sans erreur JavaScript et **sans aucune requête Supabase**. L'écran admin est verrouillé ; aucun accès admin authentifié testé à cette étape.
- Tous les actifs servis portent **noindex** et **no-store** ; robots.txt interdit l'indexation.
- Cloudflare Free : quotas globaux consultés avant/après, sans dépassement. Zéro écriture D1 ou R2, zéro statistique enregistrée pendant les essais.
- Le premier essai renvoyait 404 juste après la première publication ; le deuxième relevait la redirection canonique 307 de /admin.html vers /admin. La vérification a été corrigée pour suivre cette redirection sur **la même origine** ; l'exécution finale est SUCCESS. Ces erreurs n'étaient pas une corruption du site.

**Étapes restantes :** restauration ciblée/qualification des références média source déjà cassées, administration réelle et flux mutateurs en environnement réversible, nouvelle sauvegarde et sync finale au moment du gel des écritures, puis accord pour DNS Spaceship/DNSSEC. **AUCUNE AUTORISATION DE BASCULE DNS.**