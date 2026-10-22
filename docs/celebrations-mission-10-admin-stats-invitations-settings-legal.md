# CÉLÉBRATIONS — MISSION 10 : statistiques, invitations, réglages et pages légales

## Périmètre imposé par le propriétaire

Ne s'occuper **que des pages et actions réellement présentes sur le site** : panneau administrateur « Statistiques », panneau « Liens du comité », trois éditeurs juridiques du pied de page et réglage de visibilité publique (sans réactiver un panneau caché). Aucun travail sur les quatre anciennes redirections Drive non reliées à la navigation. Ne pas modifier le site officiel, GitHub main, Supabase partagé, les médias ni le DNS.

## Déjà vérifié, donc non à recommencer

Les 11 738 anciennes lignes de visites/clics ont été importées et vérifiées champ par champ en D1 privée par [#39623399354](https://github.com/ludodulac/Celebrations/actions/runs/39623399354). Les neuf PDF de comité ont déjà été migrés et testés en mission 06. Le compte historique a déjà été migré et sa connexion synthétique vérifiée en mission 05. Ces instantanés doivent **encore** être synchronisés en mission 11 juste avant la bascule officielle ; ne pas prétendre qu'ils se synchronisent automatiquement.

## Découverte et correctifs ciblés

1. Les trois fichiers réels `mentions-legales.html`, `confidentialite.html` et `cookies.html` étaient historiquement programmés pour appeler Supabase directement dans `footer-page-public.js`, même après copie vers Cloudflare ; à présent, quand le site migre, le code public et le bootstrap des trois pages utilisent `/api/public-data` sur **le même Worker Cloudflare** et appliquent les mêmes droits `is_active=1, is_public=1`.
2. La source contient zéro brouillon éditorial publié pour les trois pages. Il serait incorrect de publier des textes légaux non renseignés. L'interface d'administration récupère le **modèle local dans l'éditeur** lorsqu'aucun brouillon n'est présent, sans enregistrer ni publier automatiquement ce modèle. Publication bloquée par le serveur lorsqu'un champ entre crochets reste à compléter.
3. Le panneau « Autres célébrations » de l'administration est **intentionnellement masqué** par son propre drapeau. Ne pas le recréer ni modifier le réglage historique. La visibilité effective est conservée en D1 et lue dans la page publique.
4. Le panneau de statistiques utilise la D1 avec cache privé 15 minutes et contrôle du bearer administrateur. L'audit lit le nombre d'événements historiques, puis l'interface réelle ouvre les trois cartes de statistiques ; aucune nouvelle visite de test n'est créée.
5. Les neuf PDF historiques sont consultables dans le vrai panneau « Liens du comité », avec les boutons de copie. Le test n'ajoute/révoque aucun lien historique.

## Vérification contrôlée

Workflow `mission10-historic-admin-settings-legal-qa` déclenché par `[MISSION10_ADMIN_STATS_LEGAL_ONCE]` :
- Tests unitaires existants des statistiques, garde admin et brouillons privés ;
- Worker public de prévisualisation **strictement GET/HEAD** et vérification réelle sur navigateur mobile que les trois pages légales non publiées restent privées sans aucun appel Supabase ;
- Comparaison minimale de comptes/clics/9 invitations/réglage et brouillons dans D1 production, SQL `SELECT` uniquement, avec contrôle de quota Free ;
- Worker **QA administrateur indépendant** redéployé à son seul hostname de test, mot de passe dérivé exclusivement du secret GitHub `CELEBRATIONS_ADMIN_PASSWORD`, jamais imprimé ; session admin éphémère obligatoirement révoquée en `finally`, aucune mutation de contenu, médias, historiques ou comptes ;
- Véritable clic Chromium du panneau Statistiques, des neuf liens du comité et des trois éditeurs juridiques, sans publier de textes et avec toutes les autres mutations du navigateur bloquées.

Aucune URL de membre, aucun slug d'invitation ou mot de passe ne sort dans les journaux GitHub. Les quotas D1 Free sont vérifiés avant et après. Le domaine officiel, le Worker historique des neuf invitations et Supabase restent en service sans changement.

## Résultat

Preuve effective à consigner exclusivement après confirmation du job GitHub Actions. Toute anomalie bloque uniquement la mission 10, pas le site officiel.

## Premier contrôle — constat réel puis réparation du câblage du test

[GitHub Actions #39814127711](https://github.com/ludodulac/Celebrations/actions/runs/39814127711) : **tests unitaires PASS**, audit D1 de production **PASS** avec exactement 11 738 événements historiques, 1 participant, 9 lettres et 9 médias privés, 0 événement Cloudflare nouveau, 0 brouillon juridique source ni page publiée. Navigateur public **PASS** : 3 liens juridiques correctement masqués, 3 pages individuelles servent la mention « Page en préparation » et n'effectuent **aucun appel Supabase**, aucune erreur JS. Seul le démarrage du contrôle administrateur a échoué **avant toute nouvelle session** : variable `SUPABASE_URL` absente du job alors que le garde de sécurité de `verify_editable_admin_candidate.py` l'exige. Le job a été corrigé pour fournir la même valeur via le secret d'environnement préexistant, sans révéler ni modifier Supabase.

Relancement isolé demandé uniquement pour certifier l'interface administrateur et fermer cette mission.
