# M030 — plan optimisé : 10 missions, deux premières étapes sécurisées

**Méthode :** une mission = un objectif testable, un court compte rendu, puis la suivante. Pas de déploiement officiel tant que le nettoyage et la validation isolée ne sont pas prêts. **La page publique personnalisable avec images est hors périmètre.**

| N° | Mission | État |
|---|---|---|
| **01** | Inventorier D1 et R2, doublons, associations et Michaël 2026 à préserver | ✅ Terminée |
| **02** | Définir et tester le modèle unique : quatre archanges, 14 cycles, 56 emplacements virtuels, versions nommées uniques, pas de nouvelle version sans catégorie existante | ✅ Terminée (code de branche + tests) |
| **03** | Sauvegarder D1 et le snapshot R2 de l'éditeur, chiffrer, déchiffrer et vérifier une restauration locale | ✅ Terminée |
| **04** | Préparer le plan exact du nettoyage et le répéter sur des copies isolées sans perdre Michaël 101 ni les pages générales | ✅ Terminée — simulation locale et retour arrière validés |
| **05** | Imposer l'identité unique archange/cycle en D1 et préparer les 56 emplacements masqués, avec visibilité cohérente | ✅ Terminée sur branche ; index D1 différé après nettoyage M10 |
| **06** | Corriger une seule fois la duplication interne : nouveau nom, langue, catégorie/public, refus des doublons et brouillon protégé | ✅ Terminée sur branche ; bouton et API sécurisés, tests ciblés réussis |
| **07** | Supprimer les dates obligatoires du mercredi et les anciens chemins de création libre, client et serveur | ✅ Terminée sur branche : formulaire et calculs supprimés, création libre refusée |
| **08** | Afficher une célébration unique aux visiteurs avec la version autorisée, et ranger les années en rubriques repliables | ✅ Terminée sur branche : cartes publiques uniques, langues et droits existants préservés |
| **09** | Parcours complet Chromium M016 (smartphone/ordinateur), droits privés, langues, sauvegardes et tests de régression | À faire |
| **10** | Nettoyage officiel contrôlé, index unique, publication finale et retour arrière éprouvé | À faire |

## Mission 01 — audit réel, sans aucune écriture

Workflow identités D1/R2 : [#43408187887](https://github.com/ludodulac/Celebrations/actions/runs/43408187887). Audit des références SQL : [#43408931671](https://github.com/ludodulac/Celebrations/actions/runs/43408931671).

- 7 célébrations enregistrées. **Michaël 2026 ID 101** : seule version active et publiée, 8 pages de brouillon et 8 publiées.
- Six autres identités : Michaël **105, 106** ; Gabriel **102, 107** ; Raphaël **103** ; Ouriel **104**. Aucune n'a été supprimée.
- Plusieurs liens historiques D1 de Michaël 101 à protéger. Gabriel 102 comporte une page publiée, Michaël 106 une traduction non publiée, à couvrir par sauvegarde avant suppression.

## Mission 02 — contrat et tests validés, pas encore installé sur le site

Un **module de règles partagé** `migration/cloudflare/app/domain/celebration-cycle-registry.mjs` prévoit exactement 14 cycles (2026–2039) et 56 emplacements *virtuels* sans fabriquer 56 ensembles de pages.

- Chaque couple archange/cycle est unique. Aucune création arbitraire ou date de mercredi n'entre dans les clés.
- Chaque version doit avoir un **nom différent**, un **public cible valide** et une **langue disponible**.
- La combinaison **public cible × langue** est unique indépendamment du nom ; les nouveaux contenus sont toujours **brouillon**.
- **Sans aucune catégorie active : aucune nouvelle version, même Public/Anglais.** Michaël 2026 Public/Français existante reste conservée.
- Une ancienne commande de duplication d'une célébration indépendante est désormais **refusée** dans les tests, sans toucher aux membres ni aux publications.
- [Workflow M030 — règles et compatibilité #43420237999](https://github.com/ludodulac/Celebrations/actions/runs/43420237999) : **SUCCESS, 24 tests métier + 71 tests de compatibilité, 0 échec**. Les tests historiques de l'aperçu du site, hors contrat M02, ont encore des échecs (HTTP 404) hérités et doivent être corrigés lors de M08/M09 avant livraison.

## Mission 03 — sauvegarde/restauration vérifiée, sans écriture distante

[Workflow sauvegardes #43420237980](https://github.com/ludodulac/Celebrations/actions/runs/43420237980) : **SUCCESS**.

- Export SQL **intégral D1** et état JSON **intégral de l'éditeur R2 officiel**, les deux chiffrés avec la clé GitHub protégée.
- Déchiffrement/égalité octet à octet puis **restauration D1 en SQLite local en mémoire** et validation du snapshot de l'éditeur ; tests réussis deux fois.
- Contrôle de 35 tables, 7 célébrations, Michaël 101 conservé, 8 pages de brouillon et 8 publiées ; aucune donnée personnelle affichée.
- Artefact privé GitHub `m030-official-D1-and-editor-R2-encrypted-restore-verified` (durée de conservation 30 jours, enregistré le 13 novembre 2026).
- **Limite clairement documentée :** les fichiers audio/images/vidéo du bucket média R2 n'ont pas été copiés. Ils restent inchangés et devront être protégés contre toute suppression lors du nettoyage officiel. Voir `docs/m030-m03-backup-restore.md`.


## Mission 04 — plan de nettoyage et répétition locale réussis

[Workflow local #43423239570](https://github.com/ludodulac/Celebrations/actions/runs/43423239570) : **SUCCESS**. Réutilisation des sauvegardes M03 chiffrées, contrôle SHA-256, puis simulation sur une copie SQLite en mémoire et un snapshot R2 séparé.

- D1 **6 identités** (102–107) et **21 étapes** retirées uniquement en mémoire ; autres **33 tables** inchangées, 7 étapes Michaël 101 préservées, clés étrangères valides, transaction **annulée**.
- R2 : 6 brouillons secondaires simulés retirés ; 3 métadonnées, 5 réglages de visibilité/accès, 1 ensemble de traductions obsolètes, **269 références d'utilisation média** devenant inutiles identifiées et détachées dans la copie.
- **Michaël 101 : 8 pages brouillon et 8 publiées intactes.** **4 pages générales** et 1 page générale publiée intactes ; **128 éléments médias conservés**, 0 fichier média supprimé. Aucun compte membre, droit d'accès ou fichier de production modifié.
- Rapport sans données sensibles : artefact GitHub `m030-m04-sanitized-local-cleanup-report` (30 jours).
- **Aucune suppression réelle effectuée.** Le futur nettoyage officiel devra repartir d'une sauvegarde récente et revalider qu'aucune donnée nouvelle n'est apparue entre-temps.

## Missions 05 et 06 — construction ciblée terminée sur branche isolée

[Tests officiels GitHub Actions M030 #43432345195](https://github.com/ludodulac/Celebrations/actions/runs/43432345195) : **SUCCESS** (tests du domaine, du serveur, de l'interface et des anciennes fonctionnalités nécessaires).

**M05 :** un modèle unique donne 56 emplacements virtuels en **14 cycles 2026–2039**, regroupés par année repliable dans l'administration. Sans identité D1, les futurs emplacements restent masqués. La création côté serveur accepte exclusivement une combinaison (archange, cycle) prévue et vérifie l'existence de l'index unique D1. L'index SQL est préparé dans `migration/cloudflare/manual-after-m030-cleanup/m030_unique_celebration_cycles.sql` mais volontairement **NON APPLIQUÉ** à l'officiel avant le nettoyage M10 des anciennes identités 105/106 ; son application anticipée échoue sans toucher aux doublons, comme démontré en SQLite local. Aucune nouvelle célébration officielle créée.

**M06 :** dans une célébration existante, le bouton « Dupliquer » ouvre **un seul formulaire** avec un nom différent, un choix de destinataires (Public / catégorie / tous les inscrits) et une langue. S'il n'y a pas de catégorie active, le dialogue n'est pas ouvert et l'utilisateur reçoit une indication explicite. Le serveur confirme la catégorie réelle et la langue, rejette les combinaisons destinataires + langue déjà présentes (et les noms identiques), conserve la **même identité D1**, écrit uniquement un **brouillon R2**, n'accorde aucun droit, ne publie aucune version et utilise la protection de révision contre deux doublons simultanés. Tests serveur : pas de catégorie => aucun écrit, nouvelle version publique anglais => brouillon, répétition refusée, version privée espagnole => brouillon sans inscription ni publication ; tests de l'interface/bundle réussis.

**Important :** ces changements ne sont **pas déployés** sur le site officiel ; M10 devra appliquer l'index D1 après le nettoyage isolé et faire la mise en service. Tous les fichiers et célébrations existants sont encore en place.

## Missions 07 et 08 — modifications réalisées sur la branche

[Tests ciblés GitHub Actions M030 #43436024301](https://github.com/ludodulac/Celebrations/actions/runs/43436024301) : **SUCCESS**. Domaine, routes de création, menu public et compilation du JavaScript visiteur validés ; **aucun déploiement Cloudflare**. Les tests généraux et le parcours Chromium restent regroupés en mission 09.

**M07 — calendrier et création :** l'administration ne demande plus de « date du mercredi » ni de « dates de préparation » ; les calculs d'horaires calendaires et les textes de date injectés automatiquement ont été retirés de l'éditeur et du site visiteur. Les **dates rédigées librement dans les pages existantes restent inchangées**. Les routes de plans obsolètes dérivés d'un mercredi ne sont plus proposées au visiteur. L'ancienne API de sauvegarde refuse de créer des brouillons arbitraires et de changer la liste des plans : seule la commande canonique de préparation de cycle peut activer un emplacement. Les éventuelles heures manuelles de page restent disponibles.

**M08 — accueil visiteurs :** un **seul choix** par couple archange/cycle publié est construit côté serveur ; les anciens doublons D1 ne produisent pas de deuxième carte. Les 56 emplacements futurs masqués ne sont jamais envoyés aux visiteurs ; seules les célébrations explicitement publiées y figurent. Une célébration privée publiée peut afficher son nom sans exposer ses pages ni accepter un lien direct anonyme. La langue choisie continue d'utiliser les traductions **explicitement publiées** ; les versions privées restent dans les parcours membres, jamais dans la liste publique. Les 14 années prévues étaient déjà rangées dans des rubriques repliables dans l'administration (M05).

**Précaution de livraison :** pas de suppression des six anciennes célébrations ni de migration de l'index UNIQUE avant le nettoyage M10. Le site officiel est inchangé ; la vérification navigateur complète et la sécurité fin-à-fin restent en M09.

## Principe impératif

**Le site officiel n'a pas été modifié par M030.** Les missions 02 et 03 préparent les garanties, mais n'autorisent pas l'effacement immédiat : le nettoyage attend encore les missions 04–05 et la validation finale.
