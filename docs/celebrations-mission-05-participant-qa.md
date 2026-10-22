# CÉLÉBRATIONS — mission 05 : comptes des participants sur Cloudflare

## Objectif strict

Vérifier sur **le Worker et la base D1 exclusivement de staging** :
1. Le compte historique est visible avec ses métadonnées non sensibles, sans modifier son mot de passe. Les contrôles antérieurs de copie des vérificateurs PBKDF2 de ce compte sont conservés.
2. L'invitation d'un **compte fictif à adresse aléatoire `@invalid.example`**, son affectation au groupe `angel`, son inscription avec dérivation 180 000 PBKDF2, sa connexion, et les droits associés.
3. La récupération d'un mot de passe fictif au moyen de deux questions de sécurité ; **l'ancienne session doit être immédiatement révoquée** et le nouveau mot de passe permettre une connexion.
4. La déconnexion et la révocation de la session, ainsi que la connexion depuis l'interface navigateur (WebCrypto).
5. La suppression finale ciblée du compte fictif, de ses sessions et de l'accès associé, avec vérification que **tous les comptes préexistants et leurs groupes sont strictement inchangés**, et révocation de la session admin temporaire.
6. La vérification des quotas Cloudflare D1 Free avant et après.

## Protection et limites

Tests exclusivement sur `celebrations-exit-staging.rondes.workers.dev` et `celebrations-exit-staging` D1. Le site officiel, Supabase, D1/R2 de production, l'ancien Worker de liens PDF et les comptes véritables ne sont pas modifiés. Le compte de test n'envoie pas d'e-mails réels.

Le script existant `scripts/verify-staging-participant-roundtrip.mjs` est lancé par `scripts/verify-staging-authenticated-admin.py` seulement avec `STAGING_SYNTHETIC_PARTICIPANT_WRITE=1`, une session admin de cinq minutes et un identifiant aléatoire. Exécution isolée via `isolated-staging-participant-auth-roundtrip-once`, marqueur `[MISSION05_PARTICIPANT_STAGING_ONCE]`.

Cette preuve ne peut pas garantir la connexion au compte historique **avec le mot de passe réel inconnu**. Il faudra la faire confirmer par son propriétaire sur le Worker de test, sans communiquer ses identifiants.

## État

Test de mission 05 déclenché ; résultat à consigner d'après le workflow GitHub Actions.
