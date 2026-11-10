# CÉLÉBRATIONS — M005 : espaces et duplication (fondations)

Base imposée et vérifiée : branche feat/celebrations-m003c-foundations-consolidation-20261110, commit 8d9fb660cd8f8cf770b5d33619daf7cee82d004f.

Périmètre : modèle de domaine indépendant, tests locaux, workflow GitHub Actions **Node seulement**. Aucune API, interface, publication, D1, R2, session, DNS, secret ou configuration Cloudflare n'est modifiée. Le nouveau module n'est importé par aucun Worker ni par l'éditeur.

## Modèle portable

- La célébration historique reste l'entité principale : ID, date, archangel, étapes, pages, médias et champs inconnus sont conservés. La propriété facultative **spaces** rattache des espaces à la même célébration. En son absence, les anciens contenus restent inchangés.
- Un nouvel espace possède un ID permanent fourni explicitement, celebrationId, visibility (PUBLIC ou PRIVATE), accessPolicy M002 et pages. Chaque page a ID, celebrationId, spaceId et ses propres blocs. Les IDs de pages doivent être uniques dans une célébration entière.
- Par défaut, les espaces sont **PRIVATE**. Le passage en PUBLIC exige une politique PUBLIC cohérente. Aucun type de membre fictif, aucun modèle de noms, aucune inscription n'est créé dans les données réelles.
- La sécurité vient exclusivement de migration/cloudflare/app/domain/member-access.mjs (M002). La fonction canReadSpacePage délègue à canAccessSpace et canAccessPage. Les espaces privés exigent une inscription individuelle en plus des éventuels types. **Cette fonction vérifie les droits, pas le statut de publication** : le futur adaptateur serveur doit filtrer la publication et valider la session et les associations canoniques avant d'exposer page, média ou miniature.
- Les traductions utilisent exclusivement migration/cloudflare/app/domain/editor-localization.mjs (M003), via translateCelebrationSpace et resolveSpaceLanguage. Plusieurs langues conservent un espace et un ID canoniques. Les variantes ne possèdent aucune ACL.

## API de domaine

1. createCelebrationSpace : crée un espace et rattache ses pages, sans modifier la célébration d'origine.
2. addSpaceToCelebration : ajoute un espace à l'unique célébration, en refusant tout rattachement incohérent ou ID de page répété.
3. getCelebrationSpaces : fournit une liste de copies JSON indépendantes.
4. canReadSpacePage : contrôle M002 uniquement ; le moteur de publication reste distinct.
5. translateCelebrationSpace / resolveSpaceLanguage : délèguent à M003 sans créer un autre moteur.
6. duplicateCelebrationSpace : nécessite nouvel ID d'espace et un ID distinct explicite pour chaque page ; même célébration propriétaire.
7. duplicateCelebration : nécessite un nouvel ID de célébration et les correspondances de nouveaux IDs pour tous les espaces et pages canoniques.

L'allocation des IDs appartient au futur backend, pour rester portable et laisser à la persistence la responsabilité d'une unicité globale. Les clones sont des copies JSON profondément indépendantes : pages, textes, blocs, images, PDF, audio, vidéo, liens, traductions, documents et paramètres de présentation.

Les médias sont **réutilisés par référence** : chemins /media/, /media/new/, /letter/, URL et clés R2 sont inchangés. Aucune copie R2. Les références de page structurées pageId, targetPageId et linkedPageId sont réassociées aux nouveaux IDs. Les href, URL, src et autres textes de lien sont préservés littéralement ; leur éventuelle réécriture doit être décidée lors du raccordement aux routes historiques.

## Sécurité de la duplication

- Toute copie de célébration et chaque page copiée reçoivent visibility = draft, les nouvelles entités ont publicationStatus = draft ; les instantanés et marqueurs de publication précédents sont neutralisés. La propriété visibility d'un **espace** signifie PUBLIC/PRIVATE (contrôle d'accès), et reste inchangée ; un espace PRIVATE ne devient jamais PUBLIC.
- Les politiques de types sont conservées par copie profonde, mais **aucune inscription/autorisation individuelle n'est copiée**. Les champs de liens enrollments, memberships, spaceEnrollments, memberEnrollments, memberTypeAssignments et apparentés sont écartés des copies y compris dans les objets imbriqués. Les associations devront être obtenues depuis le futur stockage fiable.
- Les URL média préexistantes ne deviennent pas privées par le seul fait que l'espace est privé. Le contrôle Worker/R2 de leurs lectures sera une intégration future obligatoire.

## Anciens contenus et transfert Cloudflare

Aucun contenu enregistré, ID, date, étape, page ou média existant n'a été touché. Les célébrations sans spaces continuent de fonctionner comme précédemment. Une duplication préserve les dates et étapes comme point de départ éditorial pour préparation, avec nouvelle identité pour les pages canoniques dans les tableaux pages. Les étapes historiques opaques et liens encodés dans les URL nécessiteront une revue avant intégration pour éviter des références obsolètes.

Le résultat reste JSON et indépendant de tout accountId, bucket, binding, DNS ou secret Cloudflare. Après migration de compte, les futures couches de persistence et médias doivent pointer sur le nouveau stockage sans modifier les identifiants métier ni les droits. Il faudra développer **dans d'autres missions** la persistence D1/R2, les allocations transactionnelles d'IDs, les contrôles serveur de sessions, l'inscription individuelle, la gestion des brouillons/publiés et la vérification des accès directs aux médias. Aucune migration n'a été tentée ici.

## Tests

Régression native : node --test tests/test_mission002_member_access.mjs tests/test_m003_localization.mjs

Scénarios nouveaux : node --test tests/test_m005_celebration_spaces.mjs

Workflow de test isolé : .github/workflows/celebrations-m005-domain-tests.yml, Node 22, permissions de lecture seule, aucun déploiement.

La suite M005 vérifie les douze exigences explicites et des cas négatifs : politiques incohérentes, pages orphelines, conflits d'identifiants, absence d'inscriptions, et contournement par changement de langue.
