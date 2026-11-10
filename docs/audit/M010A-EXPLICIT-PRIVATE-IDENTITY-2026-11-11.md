# CÉLÉBRATIONS — Mission 010-A : identité privée explicitement approuvée

**Statut : correction isolée en PR brouillon #125. Aucun déploiement, aucune
nouvelle route, aucune écriture dans une D1 distante, aucun changement de `main`.**

## Base et périmètre

- Base contrôlée : `feat/celebrations-m009d-consolidation-009a-009b-009c-20261111`,
  commit `8a9a2940d27c018fd6ea46b2603485e9ab24ce3b`.
- Branche de mission : `feat/celebrations-m010a-explicit-private-identity-20261111`.
- PR : https://github.com/ludodulac/Celebrations/pull/125
- **Aucun fichier des composants d'administration 010-B ou de la configuration
  Cloudflare 010-C n'est modifié.**

## Vulnérabilité initiale et suppression

Le code M008-C résolvait un `person:id` en effectuant une jointure directe
sur l'e-mail du participant et l'e-mail normalisé de l'annuaire. La possession
d'un compte historique ne prouvait pas que son titulaire était la personne
dans l'annuaire. Le test M009-D démontrait explicitement cette faille.

M010-A supprime intégralement cette jointure dans
`app/security/member-private-access.mjs`. `resolveVerifiedMember()`
délègue maintenant **exclusivement** à
`resolveExplicitMemberIdentity(request, env)` de M009-B, sans mécanisme de
repli, sans identité émise par le navigateur, sans auto-association par e-mail.

Le résolveur M009-B fait un SELECT serveur qui exige simultanément :

1. une session **participant** valide et non expirée selon le vérificateur
   préexistant `authorize(request, env, false)` ;
2. un participant encore enregistré (empreinte du mot de passe présente) ;
3. un lien actuellement présent dans `celebrations_directory_identity_links`
   vers une personne permanente valide ;
4. une demande d'identité **pour ce même compte et cette même personne**,
   référencée par le lien, dont le statut est exactement `approved` ;
5. une méthode de contrôle indépendante autorisée, une date de revue et
   un champ d'auteur administrateur non vide.

Une demande simplement `pending` ou `rejected`, un lien incohérent,
une revue incomplète, une absence de lien ou une suppression de lien
renvoient `null`. La suppression est prise en compte dès la requête
suivante. Les erreurs D1 ne confèrent aucun droit : le gestionnaire
renvoie une indisponibilité générique, sans données privées.

## Autorisations privées conservées

La logique M002 `canAccessPage()`, incluant `canAccessSpace()`, est
inchangée. Après vérification de l'identité, le service M008-C relit dans
D1 les types de membres actifs, associations et inscriptions individuelles
aux espaces privés à **chaque requête**. Ni les audiences historiques ni
une session administrateur ne remplacent une inscription.

Les pages doivent toujours provenir de chargeurs serveur canoniques et
être publiées ; les contenus des documents/PDF privés ne sont lus depuis
le bucket dédié qu'après autorisation ; les traductions et résultats de
recherche ne sont produits qu'après filtrage. Les en-têtes `no-store`
des réponses privées sont conservés.

## Tests adaptés sans suppression

- `test_m008c_private_server_access.mjs` : le double D1 connaît
  désormais les liens approuvés. Les scénarios de refus incluent l'absence
  de lien, une demande non approuvée et une revue incomplète.
- `test_m008d_cross_integration.mjs` : le vrai SQLite en mémoire
  applique le schéma M009-B, refuse d'abord l'e-mail identique non lié,
  puis accepte une demande administrativement approuvée ; révocation
  du lien et contrôle des droits D1 vérifiés.
- `test_m009d_cross_integration.mjs` : l'ancien test de reproduction de
  la faille a été **inversé**, pas supprimé. L'e-mail identique ne suffit
  plus à identifier un membre.
- `test_m010a_explicit_private_identity.mjs` : 12 tests supplémentaires
  avec SQLite/D1 réel en mémoire, couvrant lien absent/en attente,
  approbation, révocation, session expirée ou administrateur, IDs
  incohérents, types incorrects/désactivés, absence d'inscription,
  requêtes D1 relues, erreurs DB, médias, traductions et recherches.
- `.github/workflows/celebrations-m010a-explicit-private-identity.yml` :
  CI Node 22 isolée, syntaxe, tests de non-régression M002 à M010-A,
  contrôle des routes privées non activées. Ni Wrangler distant ni
  aucun secret de production.

**Contrôle initial GitHub Actions :** runs
[42925261811](https://github.com/ludodulac/Celebrations/actions/runs/42925261811)
(push) et
[42925296883](https://github.com/ludodulac/Celebrations/actions/runs/42925296883)
(PR) ont réussi sur `f79be03254e4967079024441c47f9ef0908c968a`
avec **268/268 tests Node PASS, 0 échec, 0 ignoré**.
Les commits de documentation supplémentaires doivent être vérifiés sur
leur SHA final avant intégration.

## Limites et activation future

La PR ne fournit pas une validation de bout en bout sur un Worker, R2 et D1
de production. Les migrations 007-A/008-B/009-B restent des propositions ;
leur exécution et l'activation des routes doivent faire l'objet de missions
et validations séparées. L'attestation d'identité faite par un administrateur
reste un contrôle humain : la base garantit la présence de ses traces, pas
l'authenticité d'une pièce d'identité.

**Règle absolue : une identité non approuvée ne reçoit aucun droit.**
