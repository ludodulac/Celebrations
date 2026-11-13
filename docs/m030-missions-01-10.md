# M030 — plan optimisé : 10 missions, deux premières étapes sécurisées

**Méthode :** une mission = un objectif testable, un court compte rendu, puis la suivante. Pas de déploiement officiel tant que le nettoyage et la validation isolée ne sont pas prêts. **La page publique personnalisable avec images est hors périmètre.**

| N° | Mission | État |
|---|---|---|
| **01** | Inventorier D1 et R2, doublons, associations et Michaël 2026 à préserver | ✅ Terminée |
| **02** | Définir et tester le modèle unique : quatre archanges, 14 cycles, 56 emplacements virtuels, versions nommées uniques, pas de nouvelle version sans catégorie existante | ✅ Terminée (code de branche + tests) |
| **03** | Sauvegarder D1 et le snapshot R2 de l'éditeur, chiffrer, déchiffrer et vérifier une restauration locale | ✅ Terminée |
| **04** | Préparer le plan exact du nettoyage et le répéter sur des copies isolées sans perdre Michaël 101 ni les pages générales | À faire |
| **05** | Imposer l'identité unique archange/cycle en D1 et préparer les 56 emplacements masqués, avec visibilité cohérente | À faire |
| **06** | Corriger une seule fois la duplication interne : nouveau nom, langue, catégorie/public, refus des doublons et brouillon protégé | À faire |
| **07** | Supprimer les dates obligatoires du mercredi et les anciens chemins de création libre, client et serveur | À faire |
| **08** | Afficher une célébration unique aux visiteurs avec la version autorisée, et ranger les années en rubriques repliables | À faire |
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

## Principe impératif

**Le site officiel n'a pas été modifié par M030.** Les missions 02 et 03 préparent les garanties, mais n'autorisent pas l'effacement immédiat : le nettoyage attend encore les missions 04–05 et la validation finale.
