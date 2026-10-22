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

## VERDICT FINAL — MISSION 10 = PASS (22 octobre 2026)

[GitHub Actions #39814358481](https://github.com/ludodulac/Celebrations/actions/runs/39814358481), job `mission10-historic-admin-settings-legal-qa` : **SUCCESS** pour toutes les étapes, y compris la véritable authentification avec le secret propriétaire stocké dans GitHub et la révocation immédiate de la session créée.

### Résultats observés dans les journaux réels

- `MISSION10_PRIVATE_HISTORIC_DATA_READONLY_PASS` : **11 738 événements historiques** dans la D1 de production, **1 participant** conservé, **9 documents de comité** avec **9 PDF privés publiés**, réglage public conservé ; **0 ligne juridique source** et **0 page juridique publiée**, **0 modification des données** ; compte historique des clics figé à l'import et **delta final nécessaire** en mission 11.
- `MISSION10_PUBLIC_FOOTER_LEGAL_BROWSER_PASS` : les **3 liens juridiques non publiés** restent cachés sur la véritable interface publique ; les trois fichiers HTML directs répondent 200 et affichent « Page en préparation ». **Zéro requête réseau vers Supabase, zéro erreur JS.**
- `MISSION10_ADMIN_UI_REAL_BROWSER_PASS` : véritable navigateur Android 390px connecté à l'administration de test via D1 migrée, tableau Statistiques et ses **3 cartes** visibles ; **9/9 invitations de comité** listées, leurs **9 boutons Copier** présents, **3 éditeurs juridiques** reçoivent leurs modèles privés locaux (sans jamais les publier). Le panneau de réglage de visibilité volontairement masqué est inchangé. **Aucune mutation métier non autorisée** déclenchée par le navigateur, zéro appel Supabase, zéro erreur JavaScript.
- `CELEBRATIONS_EDITABLE_ADMIN_QA_PASS` : connexion sécurisée avec le véritable secret d'environnement, statistiques historiques et neuf permaliens privés accessibles sur le domaine QA seulement. `CELEBRATIONS_QA_ADMIN_SESSION_REVOKED verified=YES` : **session temporaire révoquée**, sans conserver un accès de test.
- Quota D1 Free global pré/post vérifié : instantanés Analytics **156 294 lectures / 1 059 écritures** cumulés, bien sous les limites (reporting différé). L'audit SQL D1 lui-même a déclaré **11 759 lignes lues**, zéro écriture ; des scans additionnels peuvent avoir lieu pour l'interface Statistiques sans apparaître immédiatement dans les instantanés.

### Conclusions de périmètre et sécurité

**Mission 10 terminée pour les fonctions effectivement utilisées sur le site et l'administration.** Le site officiel, GitHub `main`, le Worker historique `celebrations.rondes.workers.dev`, Supabase partagé, les comptes, les documents, R2, le DNS et les textes juridiques publics n'ont pas été modifiés. Les Workers indépendants de prévisualisation et de QA ont été actualisés avec les seuls correctifs.

Les pages légales ne sont **pas déjà remplies** et ne doivent pas être publiées automatiquement : les champs juridiquement nécessaires doivent être fournis par le propriétaire s'il souhaite les rendre visibles dans le pied de page. Le programme reste volontairement en mode universel ; ne pas réactiver de réglage caché. La **synchronisation finale** des statistiques Supabase après le snapshot du 21 octobre et des contenus encore modifiés est impérative avant la bascule (mission 11). Aucune décision de changement de domaine n'est prise en mission 10.

**Mission 11 non commencée sans autorisation du propriétaire.**
