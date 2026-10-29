# CÉLÉBRATIONS — MISSION D4 — Accès administrateur staging

**29 octobre 2026 — tests terminés sur Cloudflare staging, sans accès au mot de passe officiel.**

## Cause et décision
L'ancien écran d'administration staging utilise `/api/auth` avec `ADMIN_PASSWORD_HASH` / `ADMIN_PASSWORD_SALT` **propres au Worker isolé**. Les deux variables et le secret de prévisualisation sont présents sur le Worker effectivement déployé (contrôle des noms uniquement). **Aucune synchronisation du mot de passe officiel avec ces valeurs n'existe dans le code.** Le mot de passe officiel de Ludo n'a jamais été demandé, lu, essayé ou modifié : nous n'avons donc pas pu comparer cryptographiquement les deux mots de passe. Le refus constaté est cohérent avec des vérificateurs différents.

## Correction
Ajout d'un **accès temporaire personnel de test indépendant de l'ancien mot de passe**, limité à `celebrations-exit-staging.rondes.workers.dev`. L'interface mobile `/__editor/access` permet de saisir un code de haute entropie communiqué à Ludo **dans une conversation privée, jamais dans GitHub**. Le code n'apparaît pas dans les URLs ni dans les journaux publics. **Seule son empreinte SHA-256**, non réutilisable comme code d'accès, est déposée comme secret `ADMIN_D4_ACCESS_HASH` du Worker staging. Il expire **le 3 novembre 2026 à 00:00 UTC** ; la session d'administration temporaire dure au maximum deux heures.

Après authentification, deux boutons directs donnent accès à l'ancienne administration staging et à `/__editor/entry`, qui établit une prévisualisation courte avec cookie HttpOnly. Le parcours fonctionne sur le même navigateur sans GitHub ni installation. La connexion habituelle et la configuration du mot de passe officiel ne sont pas modifiées. Toute session D4 n'est créée que dans la table **d'authentification staging**, jamais dans les tables de contenu historique ou en production.

## Preuve de bout en bout
[GitHub Actions #40852868326 — SUCCESS](https://github.com/ludodulac/Celebrations/actions/runs/40852868326)
- **9/9 tests locaux réussis**, contrôle des vrais bindings staging D1/R2 effectué.
- **Deux parcours Chromium complets, ordinateur et téléphone :** code de test unique généré et masqué pendant l'exécution, connexion via la page normale D4, ouverture de **l'administration existante déverrouillée**, ouverture de la **prévisualisation privée**, navigation entre pages, déconnexion et vérification de révocation immédiate du cookie. **2/2 PASS**.
- Mauvais code rejeté ; accès anonyme à la prévisualisation rejeté HTTP 401.
- Limite : il s'agit d'un code d'authentification **émis indépendamment**, pas du mot de passe officiel. Ludo devra tester lui-même son accès personnel dans son navigateur.

## Guide de connexion sur téléphone
1. Ouvrir `https://celebrations-exit-staging.rondes.workers.dev/__editor/access`.
2. Coller le **code personnel D4 communiqué séparément**, puis toucher **« Se connecter à l'administration de test »**.
3. Toucher **« 1. Ouvrir l'administration »**, puis revenir à cette page pour toucher **« 2. Voir les 47 pages en prévisualisation »**. Tout se fait dans le même navigateur. Si l'application ouvre un navigateur externe, reprendre le lien depuis ce navigateur.

## Protections / arrêt
Le site officiel, les DNS, les Workers et les bases de production, les fichiers R2, les cinq tables `editor_b_*` / `editor_c_*`, les 47 brouillons historiques, les PDF et les règles d'audience sont inchangés. Pas de nouvelle publication ni de fusion. Les seules écritures de test sont des **sessions d'authentification éphémères en staging**, révoquées après les tests. **Mission E non commencée.**
