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