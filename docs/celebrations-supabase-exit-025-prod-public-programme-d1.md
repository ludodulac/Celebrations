# CÉLÉBRATIONS — Mission 025 : migration privée des neuf tables du programme public

**Objectif après le transfert certifié des 121 médias publics** : remplir la base D1 européenne de production avec les **456 lignes de programme éditorial** réellement utilisées par l'accueil, la préparation, le mercredi, le jeudi, le vendredi, le samedi, le dimanche, l'après-célébration, et la médiathèque.

## Vérification effectuée sur Supabase le 21 octobre 2026 (lecture seule)

| Table | Lignes |
|---|---:|
| celebrations_celebrations | 4 |
| celebrations_groups | 3 |
| celebrations_public_settings | 1 |
| celebrations_contents | 211 |
| celebrations_steps | 28 |
| celebrations_events | 62 |
| celebrations_links | 23 |
| celebrations_event_contents | 124 |
| celebrations_step_contents | 0 |
| **Total** | **456** |

**Les 121 fichiers/766989338 octets R2 de production sont déjà copiés et SHA256-vérifiés : GitHub Actions #39606076236 SUCCESS.** Les 37 fichiers non retenus demeurent intacts en Supabase et R2 staging.

## Garanties de la migration D1

- Cible **uniquement** D1 `celebrations-exit-production`, juridiction EU et UUID `28736d2a-479b-472b-bf82-703ad0affe10`, **jamais** D1 staging. Refus si la destination R2 séparée n'est pas `celebrations-exit-production`, classe Standard.
- Les informations publiées sont relues en **GET Supabase uniquement**, avec pagination et décompte exact. Aucun mot de passe, session, historique statistique ou donnée des autres applications n'est demandé.
- Avant toute mutation, vérifie que **les dix autres tables (stats, membres, séances, documents comité, brouillons légaux, ACL) sont vides**. Les 9 tables publiques ne doivent contenir que des lignes *strictement identiques* aux sources pour autoriser une reprise après interruption.
- Insère uniquement les lignes publiques manquantes, via **JSON1 préparé** (liaison paramétrée, pas de concaténation de contenus sensibles dans SQL). Chaque table est intégralement relue et comparée **champ par champ**. Une différence stoppe la mission, sans supprimer ni modifier une ligne existante.
- Toutes les tables respectent l'ordre des dépendances/clefs étrangères. Le contrôle final utilise `pragma_foreign_key_check`.
- Avant/après : contrôle **quotas D1 Free sur l'ensemble du compte** ; aucune offre payante activée.
- Confidentialité : aucune donnée de contenu, adresse, token ou valeur de ligne n'est imprimée, publiée dans GitHub ou exportée en artifact. Seuls des noms de tables et des comptes de lignes.
- **Aucun Worker publié**, aucune modification DNS Spaceship, aucun changement de GitHub `main`, aucune suppression de Supabase, aucun changement des R2.
- Le site Supabase reste actif : **une synchronisation finale sera indispensable avant bascule**, après arrêt/sécurisation des écritures.

## Étapes suivantes (séparées)
1. Copie contrôlée du reste des 16 tables nécessaires (9 lettres comité, brouillons de mentions légales, participants/identités, sessions à revoir, clics historiques) et initialisation des ACL des 121 médias sur D1.
2. Résolution des **31 références historiques absentes du stockage d'origine** : ne pas annoncer disponibilité 100 % sans validation.
3. Déploiement d'un **Worker privé de prévisualisation uniquement** et tests d'Accueil + 7 jours + Médiathèque + administration, avec quota Free et aucune bascule DNS automatique.

**Statut initial** : `PRODUCTION_PUBLIC_PROGRAMME_D1=PREPARED_NOT_RUN`. Ne le changer en SUCCESS qu'après preuve d'exécution GitHub du job `import-public-programme-production-d1-once`.
