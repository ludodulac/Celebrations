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

## Résultat vérifié — 22 octobre 2026

**Mission 05 : SUCCESS** dans la seule D1 staging. Preuve : [GitHub Actions #39783524521](https://github.com/ludodulac/Celebrations/actions/runs/39783524521), job `isolated-staging-participant-auth-roundtrip-once` (SUCCESS). Journaux confirmés :

- `STAGING_AUTHENTICATED_ADMIN_SMOKE` : un compte historique conservé et visible (compte total = 1 avant création fictive), aucun appel vers Supabase ni erreur JavaScript.
- `STAGING_PARTICIPANT_BROWSER_LOGIN WebCrypto_180k=true account_hash_unexposed=true` : connexion réelle du compte **fictif** via navigateur et calcul WebCrypto PBKDF2 180 000 itérations ; empreinte du compte non exposée.
- `STAGING_PARTICIPANT_AUTH_FULL_ROUNDTRIP registration=true login=true audience=true recovery=true logout=true` : inscription, mot de passe, accès au groupe, récupération, déconnexion vérifiés. Le script exige explicitement la révocation de l'ancienne session après récupération, la connexion avec le nouveau mot de passe et l'invalidation du jeton après déconnexion.
- `STAGING_PARTICIPANT_ROUNDTRIP restored=true production_untouched=true` : compte fictif supprimé, comptes et droits préexistants identiques aux relevés initiaux.
- `STAGING_SYNTHETIC_ADMIN_SESSION_REVOKED success=true` : session administrateur de test supprimée.
- Quotas Cloudflare D1 Free pré et post contrôlés : instantanés agrégés 84 319 lectures et 1 036 écritures (les métriques Analytics sont différées ; ce ne sont pas les opérations exactes du test).

**Compte historique :** la parité cryptographique entre Supabase et D1 staging avait déjà été prouvée par [run #39492409173](https://github.com/ludodulac/Celebrations/actions/runs/39492409173), et l'unique compte historique copié en D1 production par [run #39623399354](https://github.com/ludodulac/Celebrations/actions/runs/39623399354). **Son mot de passe personnel n'a pas été testé** ; aucune information secrète n'a été demandée ou divulguée.

**Mode public actuel :** `public-universal-mode.js` définit `CELEBRATIONS_PUBLIC_MODE='universal'` : l'inscription et les profils ne sont pas actifs sur le site officiel, et aucun besoin de les activer pour valider la présente mission. Un contrôle humain de l'ancien compte n'est nécessaire que si ces fonctions sont réactivées ultérieurement.

**Confinement :** seules des écritures D1 staging sur identifiants synthétiques ont été réalisées ; aucune modification intentionnelle des comptes réels, du domaine officiel, du Worker historique, de Supabase, de la D1 production ou des fichiers R2. La mission 06 reste à autoriser indépendamment.
