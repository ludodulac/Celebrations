# CÉLÉBRATIONS — M009-B : administration unique et identités fiables

**État : développement isolé, non déployé, non branché aux Workers, migrations SQL non appliquées à D1 réelle.**
Base obligatoire : 61e699e5a90350239d2b7df25c147dbfa01e459a.

## Architecture et réutilisations

- **002** : règles d'autorisation et types de membres, sans créer un second moteur.
- **005** : validation des espaces privés canoniques et des inscriptions individuelles.
- **007-A / 008-B** : annuaire D1, identifiant permanent person:UUID, CRUD et associations.
- **007-B** : réutilisation directe du composant mountMemberAccessAdmin dans un montage opt-in mountMemberDirectoryAdmin, sans second tableau de bord.
- **008-C** : vérification des sessions historiques participant, distinctes des sessions admin.

Nouveaux fichiers :
- migration/cloudflare/app/application/member-directory-admin-service.mjs : service administrateur prêt à être raccordé, autorisation serveur par authorize(request, env, true), sans route activée.
- migration/cloudflare/app/security/member-identity-links.mjs : demande de rapprochement par session participant vérifiée, approbation manuelle par admin et résolution explicite des comptes reliés.
- migration/cloudflare/app/admin/member-directory-admin-integration.mjs : composant existant 007-B enrichi d'une lecture D1, de la gestion des types, participations, inscriptions et validation des rapprochements.
- migration/cloudflare/d1-migrations/20261110_009b_explicit_identity_links.sql : tables ADDITIVES pour demandes, liens explicites et journal d'audit ; aucune modification des mots de passe/comptes existants.
- tests/test_m009b_member_identity_admin.mjs : vrais contrôles SQLite en mémoire via façade D1.
- scripts/test-m009b-admin-mobile-browser.mjs : test Chromium, largeurs 1440 et 390 pixels.
- .github/workflows/celebrations-m009b-admin-identity-tests.yml : CI isolée, sans déploiement ni migration distante.

## Rapprochement : ne jamais associer par simple e-mail

1. Le participant vérifie son propre compte grâce à la session existante, puis soumet une demande concernant un personId. La demande ne crée AUCUN droit.
2. L'administrateur est vérifié indépendamment par la session admin serveur. Il doit examiner l'identité réelle et attester d'une vérification externe, en personne, par documents indépendants ou par vidéo.
3. L'approbation utilise une transaction D1 pour la demande, le lien unique compte-personne et son audit. Si une insertion échoue, toutes sont annulées.
4. resolveExplicitMemberIdentity vérifie à nouveau la session du participant et la présence d'un lien approuvé. Il ne compare jamais l'e-mail historique à l'e-mail de l'annuaire pour créer des droits.
5. Une révocation coupe le lien sans supprimer les comptes ou les mots de passe existants. Une nouvelle demande et une nouvelle vérification sont nécessaires pour un futur rapprochement.

La preuve indépendante reste une responsabilité humaine : le logiciel ne peut pas vérifier à lui seul qu'un administrateur a bien contrôlé un document. La session admin actuelle utilise un secret existant ; un compte administrateur personnel serait nécessaire pour une traçabilité individuelle forte.

## Contrats D1 et composants

Lectures admin : snapshot, person_detail, pending_claims. Le premier snapshot est borné à 100 contacts : une pagination/recherche reste à ajouter avant un usage sur un gros annuaire.

Écritures admin : create_person, update_person, create_type, rename_type, disable_type, set_person_types, add_celebration, remove_celebration, enroll_space, remove_enrollment, review_claim et unlink_identity. Chaque opération exige une session ADMIN vérifiée ; une session participant n'a jamais ces droits.

Les créations de personnes allouent crypto.randomUUID côté serveur. Les types conservent leurs identifiants après renommage, les types désactivés ne peuvent pas être accordés à de nouvelles personnes, les anciens liens désactivés restent conservés. Les participations sont distinctes des inscriptions individuelles. Les inscriptions passent impérativement par le résolveur d'espace M005 de confiance et par les contraintes D1 de même célébration. Aucune donnée transmise par le navigateur n'est réputée une preuve de droit.

Les opérations d'identité journalisent dans une transaction atomique. Les autres opérations passent par le writer 008-B puis par l'audit : **la journalisation n'est pas encore atomique avec toutes les modifications** ; un raccordement transactionnel reste requis avant activation.

Les formulaires de politiques de pages du composant 007-B ne doivent PAS être sauvegardés comme droits définitifs tant que le moteur de publication canonique n'expose pas de writer sécurisé. Le montage 009-B refuse ces commandes plutôt que de laisser croire à une sauvegarde.

## BLOQUANTS explicites pour le superviseur

1. **URGENT / sécurité :** le résolveur actuel de 008-C dans migration/cloudflare/app/security/member-private-access.mjs relie encore directement participant et personne par égalité d'adresse e-mail. Cela contredit l'identité approuvée ici. **Ne pas activer les routes privées avant de remplacer ce résolveur par resolveExplicitMemberIdentity**, en concertation avec Construction C. Le fichier de C est volontairement inchangé.
2. Routes Worker partagées inchangées. Il reste à protéger et monter les deux endpoints séparés : administrateur et demande participant. Le bearer administrateur ne doit jamais être confondu avec le bearer participant.
3. L'interface doit être montée à l'intérieur de l'onglet membre de l'administration existante. Son transport doit transmettre le token admin au handler sécurisé. Il ne faut pas créer une seconde administration.
4. Le résolveur serveur resolveCanonicalSpace doit utiliser le contenu éditorial canonique et actuel de M005. Sans lui, toute nouvelle inscription doit être refusée.
5. Terminer la pagination, les contrôles de concurrence et la transactionnalisation de tous les journaux d'audit avant production. Évaluer le contrôle des origines/CSRF et les sauvegardes.
6. Examiner et sauvegarder la D1 réelle, puis faire approuver séparément les migrations 007-A, 008-B, 009-B avant application. Aucun changement de données réelles dans cette mission.
7. Attendre la sécurisation de la projection publique 009-A et les contrôles des médias privés avant toute activation d'un nouvel espace privé.

## Vérification isolée

Tests Node 22 : test M009-B + régressions 002, 005, 007-A, 007-B, 008-B, 008-C, 008-D. Base SQLite en mémoire uniquement, jeux fictifs, FK et transactions réelles. Chromium teste l'interface réutilisée en ordinateur et en largeur smartphone de 390 px.

Ces tests ne prouvent pas encore un fonctionnement de bout en bout sur le Worker et D1 de production. Aucun déploiement, aucune route privée activée.
