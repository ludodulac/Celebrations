# CÉLÉBRATIONS — Mission 027 : comptes, administration et statistiques historiques en D1 production

**Demande expresse du propriétaire** : migrer les données administratives, les comptes et les statistiques vers la nouvelle Cloudflare D1 `celebrations-exit-production`, **sans basculer le domaine**, toucher au Supabase partagé, ni perdre d'historique.

## Audit source, 21 octobre 2026, requêtes PostgreSQL SELECT uniquement

| Table source | Comptes/lignes observées |
|---|---:|
| `celebrations_participants` | **1** compte réellement enregistré, avec vérificateurs de mot de passe/2 réponses de récupération |
| `celebrations_user_profiles` | **0** profil rattaché à Supabase Auth |
| `celebrations_footer_drafts` | **0** brouillon éditorial |
| `celebrations_clicks` | **11 735** événements au contrôle, **nombre évolutif** puisque le site reste en ligne |
| `celebrations_admin_sessions` | **16** sessions existantes, encore valides |
| `celebrations_participant_sessions` | **1** session existante, encore valide |
| `auth.users` (Supabase Auth partagé) | **1** utilisateur distinct, **NE PAS copier ni toucher** |

Les neuf lettres comité, les 121 objets privés et les 456 enregistrements éditoriaux sont **déjà importés et vérifiés** en production D1/R2 (missions 024 à 026).

### Migration sécurisée du compte et de l'administration

Script `scripts/import_private_admin_accounts_production_d1.py` :
- Lit en REST GET les seules trois tables `celebrations_participants`, `celebrations_user_profiles`, `celebrations_footer_drafts`, avec volumes contrôlés.
- Pour l'unique compte historique, préserve l'identité, les droits, questions de récupération, dates et sels. **SHA256 enveloppe irréversiblement chaque vérificateur PBKDF2 de 180000 itérations**, la transformation éprouvée en D1 staging : le mot de passe d'origine et les réponses ne sont jamais connus et **les anciens hachages PBKDF2 directement réutilisables ne sont pas recopiés**.
- Vérifie toutes les colonnes avant/après, n'insère que le compte manquant et n'écrase jamais un compte en conflit.
- **N'importe aucune des 16 sessions administrateur et 1 session participant** : les tokens actifs de l'ancien site n'ont pas vocation à devenir des identifiants valides sur le nouveau domaine. Une nouvelle connexion sera requise au lancement.
- Les 0 brouillon et 0 profil Supabase Auth sont confirmés sans créer de valeurs fictives. Les données `auth.users` de Supabase étant partagées avec d'autres projets, **aucune manipulation** et aucun portage automatique des comptes Supabase Auth : la configuration d'accès administrateur Worker doit être traitée séparément, avec une clé propre dans Cloudflare Secrets. **Ne pas migrer une ancienne valeur de mot de passe admin intégrée au code.**

### Migration sécurisée des statistiques

Script `scripts/import_historic_stats_production_d1.py` :
- Lit uniquement la table `celebrations_clicks` Supabase, pagination par clé primaire avec total exact, jusqu'à 13 000 événements, sans journaliser les URL, cookies, identifiants de visiteur ou valeurs des lignes.
- Reproduit **toutes les colonnes** de chaque événement de consultation/clic dans D1 privée, en transformant l'ID source positif `1234` en **-1234** pour réserver les IDs positifs aux futures consultations reçues directement par Cloudflare. Aucun contenu d'événement n'est falsifié.
- Avant toute écriture : refuse si la D1 production a des clics avec IDs positifs ou des lignes de source déjà importées mais divergentes.
- Insère seulement les événements négatifs absents, en petits lots paramétrés JSON1. À la fin, relit **toutes les données** par pagination indexée et compare chaque champ et chaque horodatage (même instant UTC).
- Protection quotas Free : pré/post audit Cloudflare **de toutes les bases du compte** ; limitation stricte des écritures D1 et des lectures.
- **Le site original reste actif et des statistiques continuent d'arriver** : une synchronisation finale ciblée doit être faite juste avant le changement de domaine. Un snapshot importé ici ne constitue pas une synchronisation permanente.

### Sécurité générale

- **Écriture exclusivement** dans `celebrations_participants` et `celebrations_clicks` de la **D1 européenne dédiée** ; aucune suppression, UPDATE destructive, Worker public, routage ou DNS.
- Source Supabase / R2 production et staging / GitHub `main` inchangés ; autres applications Supabase intactes.
- Journaux GitHub uniquement nombres et états de vérification, jamais données personnelles ni valeurs cryptographiques.
- Conserver la sauvegarde chiffrée existante + les deux copies médias jusqu'à la certification du nouveau site.

**Statut initial** `PROD_PRIVATE_ADMIN_STATS=PREPARED_NOT_EXECUTED`. Ne mettre `SUCCESS` qu'après le contrôle du vrai journal GitHub Actions `import-private-admin-account-and-stats-to-production-once`.

**Non achevé par cette mission** : tests d'authentification réelle, transfert des nouveaux clics à la bascule, 31 références média source déjà manquantes, configuration des secrets admin production, lancement d'un Worker candidat et certification complète des pages.

## Résultat réel — 21 octobre 2026, **SUCCESS**

[GitHub Actions #39623399354](https://github.com/ludodulac/Celebrations/actions/runs/39623399354) : job `import-private-admin-account-and-stats-to-production-once` **SUCCESS**.

### Données admin et compte, vérifiées dans la D1 privée de production
- **1 compte participant original copié** ; parité complète des métadonnées, sels, questions et vérificateurs originaux sous enveloppe cryptographique **SHA256(PBKDF2)**. Aucun mot de passe réel n'a été lu/testé, aucun hash historique rejouable en clair copié.
- **0 profil Supabase Auth**, **0 brouillon administratif** : source et cible sont toutes les deux vides.
- **16 sessions admin et 1 session participant anciennes non importées** : elles restent uniquement sur le site original. **0 session nouvelle sur Cloudflare**.
- **0 modification** du `auth.users` du projet Supabase partagé, du site public et des secrets administrateur. La nouvelle configuration de connexion administrateur **reste à valider séparément**, sans réutiliser un mot de passe en dur.

### Statistiques, vérifiées dans la D1 privée de production
- Un instantané de **11 738 clics/visites Supabase** a été transféré vers `celebrations_clicks` avec identifiants historiques négatifs `-1` à `-11738` (selon identifiants présents).
- **11 738 sur 11 738 lignes relues et vérifiées champ par champ**, notamment horodatage UTC, type de consultation, éventuel identifiant pseudonyme de visiteur. Aucun détail individuel publié dans les logs.
- **0 clic préexistant dans la destination** au précontrôle ; **23 476 écritures et 11 739 lectures** D1 internes déclarées par le job. L'Analytics de quota global (pré/post) affichait encore **1 689 lectures / 2 045 écritures** en raison de la latence du reporting ; cela ne doit pas masquer les opérations réellement comptabilisées par le moteur D1. Le total reste sous les plafonds quotidiens Free.
- **Instantané non final** : le site Supabase demeure accessible et peut continuer à recevoir de nouveaux clics ; un delta de statistiques sera indispensable lors de la bascule réelle.

### Confinement confirmé

`PROD_HISTORIC_PARTICIPANT=VERIFIED_1`
`PROD_HISTORIC_STATS=VERIFIED_11738_FULL_ROWS`
`PROD_SESSIONS_MIGRATED=0`
`SOURCE_SUPABASE_WRITES=0`
`SOURCE_AUTH_USERS_MODIFIED=0`
`GITHUB_MAIN_MODIFIED=0`
`DNS_SPACESHIP_MODIFIED=0`
`PUBLIC_WORKER_DEPLOYED=NO`
`SOURCE_AND_R2_MEDIA_DELETIONS=0`

Les 121 fichiers utiles en R2, 456 lignes éditoriales et 130 enregistrements de permissions restent intacts. Prochaine phase distincte : préparer les secrets/admin du Worker candidat puis le tester en prévisualisation, résoudre les références historiques aux médias absents et effectuer la synchronisation finale des nouveaux clics à la bascule ; ne pas annoncer le site finalisé pour le moment.
