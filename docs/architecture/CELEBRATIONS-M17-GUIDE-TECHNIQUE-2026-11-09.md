# 🌸 CÉLÉBRATIONS — Guide technique et d'exploitation (M17)

**Date :** 9 novembre 2026. **Périmètre :** code de la branche `refactor/celebrations-mission-17-docs-performance-20261109` et de ses ancêtres M05–M16. **Ne constitue pas une preuve que la production exécute cette branche.**

## 1. Quel logiciel modifier ?

Le dépôt `ludodulac/Celebrations` conserve des fichiers de l'ancien front-end GitHub Pages et le code Cloudflare. Le site officiel utilise un Worker Cloudflare, mais sa **version réellement active** doit être constatée via l'API Cloudflare avant toute intervention. Un identifiant de version observé le 8 novembre peut avoir changé depuis.

```text
Visiteur (GET publics)                   Administration (accès réservé)
        |                                               |
        | GET /api/editor-publication                    | session, Origin
        |                                               | GET/POST /api/editor-open-draft
        v                                               v
editor-trial-site-page.mjs               editor-demo-preparation-page.mjs
editor-trial-site-client.mjs             editor-demo-client.mjs (script composé)
editor-public-visitor-model.mjs          app/domain + app/application + app/admin
        |                                               |
        +-------------- production-worker.mjs ------------+
                            |                    |
                    D1 historique         Snapshot éditorial R2
                    médias anciens        + nouveaux fichiers R2
                            |
             /media/..., /letter/..., /media/new/...
```

**Routes importantes :** `/__editor/demo-preparation` (éditeur), `/__editor/voir-le-site` (lecteur), `GET/POST /api/editor-open-draft` (privé), `GET/POST /api/editor-publication` (lecture publique / changement autorisé), `/api/editor-media` (catalogue privé / mutations), `/media/new/<UUID>` (fichier). Les domaines de prévisualisation en lecture seule et le staging initial ont **des politiques différentes** : se référer à M14.

## 2. Où chercher un problème ?

| Symptôme | Contrôles dans cet ordre |
|---|---|
| Une modification semble « enregistrée » mais disparaît | `editor-server-sync-client.mjs`, révision/ETag, réponse de relecture, session, réponse 409/503 ; **ne pas écraser les versions** |
| Une page créée apparaît chez les visiteurs | `editor-pages.mjs`, `editor-publication-api.mjs`, `editor-public-visitor-model.mjs` ; vérifier `draft` vs `published` |
| Image absente | URL ancienne `/media/` ou nouvelle `/media/new/`, catalogue média, visibilité, objet réel dans R2 ; **ne pas inventer une URL** |
| Mauvais bloc ou colonne | `editor-block-model.mjs`, `editor-block-commands.mjs`, `editor-drag-model.mjs` et l'historique Undo |
| Fenêtre hors écran | `app/styles/admin/`, vérifier les couches CSS et les captures M13 avant toute retouche |
| Une page ancienne ne s'ouvre plus | `production-worker.mjs`, `staging-worker.mjs`, `legacy-link-router.mjs`, tests M15 |
| Problème de lenteur dans une liste de médias | `editor-publication-api.mjs`, `app/domain/editor-public-media-merge.mjs`, benchmark M17 |
| Impossible de publier | contrôles de session / `Origin` de M14, version attendue, R2 compare-and-swap de M10 ; **ne pas désactiver les protections** |

## 3. Invariants à préserver

1. **Aucune donnée fictive dans le site réel.** Les fixtures sont limitées aux tests isolés.
2. **Pas de nouvelle page publiée implicitement :** création en brouillon, commande de publication distincte.
3. **Un brouillon ne doit jamais apparaître dans le lecteur public** ; une erreur du serveur public ne déclenche pas de repli vers `localStorage` administrateur.
4. **Aucun écrasement silencieux entre deux appareils :** version et ETag contrôlés, HTTP 409 si concurrence ; l'Undo est local et ne change pas la visibilité publiée.
5. **Identité des anciennes URLs et des fichiers :** ne pas modifier `/media/`, `/letter/` ou les chemins de médias nouveaux sans plan de migration et sauvegarde éprouvée.
6. **Apparence stable :** même CSS réassemblé par couches M13, styles au `nonce`, menus, poignées, modales et responsive à 1280 et 390 px.
7. **Un test qui passe ne remplace jamais une preuve de sauvegarde réelle.** Pas de fusion ni de publication automatique des PR M05–M17.

## 4. Exécuter les vérifications

**Prérequis :** Node 22, Python 3.12 pour la répétition SQLite isolée, Chromium via Playwright pour la recette UI.

```bash
# Tests du modèle et des APIs M05–M15
node scripts/mission16_editor_regressions.mjs

# Protection de publication M16 et équivalence du catalogue média M17
node --test tests/test_mission16_release_rollback.mjs tests/test_mission17_public_media_merge.mjs

# Mesure reproductible avant / après (synthetic : ne contacte aucun serveur)
node scripts/mission17_media_merge_benchmark.mjs

# Répétition D1/médias en mémoire, pas un export Cloudflare
python -m unittest discover -s tests -p 'test_mission16_recovery.py' -v
```

Le workflow `celebrations-mission17-docs-performance.yml` ajoute les tests navigateur des missions M02/M11/M12/M13 et la comparaison navigateur M16 vs M17 sur **le même jeu de données fictif**. Aucun secret Cloudflare n'est nécessaire ou injecté dans ces tests.

**Interprétation :** les durées `M17_MEDIA_MERGE_BENCHMARK` correspondent à la consolidation répétée de listes de médias en mémoire, **pas au temps d'ouverture du vrai site**. La mesure `M17_EDITOR_FIRST_RENDER_COMPARE` correspond à un navigateur Chromium dans CI, avec serveur HTTP simulé ; elle ne renseigne ni le réseau mobile réel, ni la taille de la vraie base D1, ni le temps de Cloudflare en production.

## 5. Performance M17 : partie optimisée, limites mesurables

Ancien `mergePublicMedia` : pour chaque fichier déjà rencontré, les usages supplémentaires étaient comparés à tous les usages déjà enregistrés par `.some()`. Pour de nombreux fichiers référencés dans beaucoup de pages, cette déduplication devient approximativement quadratique par fichier en nombre d'usages.

Nouveau `mergePublicMediaIndexed` : un index `Set` avec une **clé composite non ambiguë** (`longueur(pageId):pageId+celebrationId`) est construit seulement en cas de doublon de fichier, pour les identifiants textuels habituels. Les anciens identifiants non textuels restent comparés avec `===`, sans conversion. Les usages sont ajoutés avec une recherche amortie en temps constant pour les identifiants courants ; la sortie conserve l'ordre des médias, la première description, les doublons déjà présents dans le premier groupe et les usages uniques. **La fonction ne lit ni ne modifie D1/R2.**

Les tests comparent sa sortie à la fonction originale de M16 sur plus de 300 cas synthétiques, y compris des cas atypiques. Le benchmark mesure 150, 500 et 1 000 médias, répétés dans trois catalogues, et affiche le temps médian avant/après. La CI M17 du 9 novembre a mesuré **1,43 × à 1,84 ×** d'accélération de la fusion de médias sur ces fixtures. **Cela ne correspond pas au temps d'ouverture du vrai site**, dont la comparaison M16/M17 reste globalement stable. Voir le rapport M17 et la preuve GitHub Actions #42538464144.

Aucune modification visuelle du site ni des requêtes D1 n'a été recherchée dans cette mission. Les optimisations supplémentaires devront être faites sur la base de nouvelles mesures, et non d'une suppression aveugle des caches ou styles.

## 6. Publication : responsabilité et retour arrière

**M16 a introduit un préflight en lecture seule, pas une procédure de mise en ligne.** L'ancienne commande de rollback basée sur un vieux commit GitHub a été supprimée **sur sa branche** ; les anciennes branches publiées doivent faire l'objet d'une vérification distincte. Les conditions requises avant une future publication comprennent :

- La version Worker **réellement active**, son bundle, sa configuration, ses assets et ses identifiants Cloudflare, sauvegardés et restaurés sur un environnement isolé.
- La sauvegarde actuelle de l'objet éditorial R2, chiffrée, horodatée, réimportée et comparée, avec **une copie indépendante de Cloudflare**.
- Un export **complet et récent** des données et schémas D1, restauré dans une base isolée avec vérification des index, relations et nombres de lignes.
- Une copie récupérable et vérifiée **de tous les octets** de médias historiques et de nouveaux médias, avec leurs chemins.
- Un contrôle après sauvegarde de l'ETag/révision pour éviter une course entre deux appareils.
- Une **autorisation explicite et séparée** pour une version de release précise et un plan de rollback exact.

Ces preuves restent **à obtenir**, malgré les tests sur données fictives. Aucun script M17 ne publie, ne restaure ou ne modifie les données de production.

## 7. Liens de maintenance

- M04 : `docs/architecture/MISSION-04-ARCHITECTURE-CIBLE-2026-11-07.md`
- M03 : `docs/audit/MISSION-03-BACKUPS-RESTAURATION-2026-11-07.md`
- M14 : `docs/audit/MISSION-14-SECURITE-2026-11-08.md`
- M15 : `docs/audit/MISSION-15-NETTOYAGE-LEGACY-2026-11-08.md`
- M16 : `docs/audit/MISSION-16-DEPLOIEMENT-ROLLBACK-2026-11-08.md`
- M17 : `docs/audit/MISSION-17-DOCUMENTATION-PERFORMANCE-2026-11-09.md`

**Mission 18 :** recette générale sur versions et sauvegardes certifiées ; pas d'autorisation de déployer incluse dans ce guide.
