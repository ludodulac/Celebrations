# CÉLÉBRATIONS — ÉTAPE 7 : dossier de vérification documentaire (lecture seule)

Date : 20 octobre 2026.  
Périmètre : branche `feat/celebrations-supabase-exit-001`, HEAD de référence `c8f7f9a3bc76f1eef009c58a0ddd4c1691290edc`.  
**Statut : PARTIAL — preuves fortes, mais certification finale des comptes et du basculement encore bloquée.**

## Preuves vérifiées directement dans GitHub Actions

| Contrôle | Preuve / résultat | Statut |
| --- | --- | --- |
| Intégrité complète des médias source → R2 de test | Run [39333819255](https://github.com/ludodulac/Celebrations/actions/runs/39333819255) du 19/10 : 158 objets, 830312417 octets, SHA-256 vérifié sur **les deux copies** ; 97 objets déjà identiques, 61 copiés puis revérifiés | PASS au 19/10 |
| Manifeste média récent | Run [39411606101](https://github.com/ludodulac/Celebrations/actions/runs/39411606101) du 20/10 : 158/158 clés et tailles correspondent ; 2 objets additionnels de staging préservés ; aucune recopie ni suppression. Ce contrôle est **clés + tailles**, non un nouveau recalcul SHA-256 | PASS au 20/10 |
| Médias PUBLICS effectivement reliés au programme | Run [39342980289](https://github.com/ludodulac/Celebrations/actions/runs/39342980289) du 19/10 : 98/98 requêtes HTTP HEAD = 200 ; accès direct à un chemin comité et à un chemin inconnu = 404 | PASS pour ce périmètre |
| Documents privés des comités | Run [39333819255](https://github.com/ludodulac/Celebrations/actions/runs/39333819255) : 9 fiches et 9 PDF privés présents dans R2, 9 slugs préservés et 9 liens HTTP HEAD = 200, lecture par lien prévu | PASS au 19/10 |
| PDF public « Pardon des Offenses » restauré | Run [39232061519](https://github.com/ludodulac/Celebrations/actions/runs/39232061519) : restauration isolée, SHA-256 et HTTP 200/application/pdf | PASS au 19/10 |
| Gestion des fichiers dans l'administration | Run [39342176803](https://github.com/ludodulac/Celebrations/actions/runs/39342176803) : 4 fichiers de test, upload, prévisualisation privée, modifications de métadonnées et nettoyage. Run [39343802850](https://github.com/ludodulac/Celebrations/actions/runs/39343802850) : import PDF depuis le formulaire mobile avec R2 privé et accès anonyme refusé | PASS sur données synthétiques |
| Compte(s) participants historiques | Runs [39337403928](https://github.com/ludodulac/Celebrations/actions/runs/39337403928) et [39339942469](https://github.com/ludodulac/Celebrations/actions/runs/39339942469) : **1 compte source** importé et vérifié dans D1 de test, empreintes de mot de passe et réponses de récupération converties pour compatibilité, **aucune session ancienne reprise** | PASS sur l'unique compte recensé à cette date |
| Parcours participants complet | Run [39342980289](https://github.com/ludodulac/Celebrations/actions/runs/39342980289) : avec un **compte synthétique**, inscription, connexion navigateur WebCrypto 180k, profil, récupération, déconnexion, révocation et suppression de ce compte de test | PASS synthétique |
| Administration et enregistrements | Runs [39390474910](https://github.com/ludodulac/Celebrations/actions/runs/39390474910) et [39390800773](https://github.com/ludodulac/Celebrations/actions/runs/39390800773) : admin authentifiée et modifications réversibles vérifiées ; 0 requête héritée vers Supabase durant le test navigateur | PASS synthétique |
| État source pré-coupure | Run [39411606101](https://github.com/ludodulac/Celebrations/actions/runs/39411606101) : 456 enregistrements dans 9 tables publiques égaux à la source, 16 nouveaux clics source recopiés individuellement ; 553 `rows_read`, 32 `rows_written` D1 mesurés pour cette opération | PASS au 20/10 |

## Réserves strictes (aucune affirmation excessive)

1. **Mot de passe du vrai participant** : test avec le **mot de passe historique réel non effectué**. Les scripts indiquent expressément `same_password_login_user_test_pending=true`. Le succès d'un compte synthétique ne garantit pas une connexion réelle. Ne jamais demander ni enregistrer ce mot de passe dans GitHub ou ChatGPT.
2. **Données encore vivantes** : tant que le site public utilise Supabase, les nouvelles visites/statistiques et d'éventuelles modifications doivent être récupérées juste avant bascule. Les 16 clics ne sont que le delta constaté le 20/10 à l'heure du run.
3. **Médias** : 158/158 fichiers ont été prouvés identiques le 19/10, mais seulement les 98 médias du programme public ont été testés par HTTP sur ce run. Les fichiers privés ne doivent pas devenir publics pour « tester les 158 URL ».
4. **Couverture** : l'étape 6 vérifie les 9 tables éditoriales, pas automatiquement toutes les 16 tables Supabase. Les tables de sessions, les brouillons légaux et autres données privées exigent des validations séparées ou une justification explicite de leur exclusion.
5. **Pages légales** : les trois brouillons préparés sont privés, et leurs données administratives / mentions non résolues peuvent bloquer une publication. Ne pas publier automatiquement.
6. **Production** : tests GitHub historiques ≠ certificat de disponibilité *à l'instant présent*. Aucun contrôle direct HTTP frais ni vérification du mot de passe historique effectués pendant le présent audit documentaire.
7. **Gratuité** : la consommation de l'opération de synchronisation est faible, mais elle ne démontre pas à elle seule le coût futur en production. Vérifier budgets Cloudflare avant tout travail connecté à D1.

## Décision / suite

**ÉTAPE 7 = PARTIAL**, dossier de preuves consolidé sans aucune requête SQL D1, sans requête à la base Supabase, sans copie R2, sans déploiement.

Prochaine action techniquement sûre : préparer la **checklist de restauration/retour arrière** de l'étape 8 à partir des sauvegardes effectives et des procédures de déploiement existantes. Avant la bascule : vérifier en environnement contrôlé le parcours du véritable participant, refaire un delta final borné avec précontrôle de quotas, et obtenir l'autorisation explicite du propriétaire.

**Ne fusionner aucune branche vers `main`. Ne pas basculer de DNS, désactiver Supabase, effacer R2, ou publier les brouillons légaux.**
