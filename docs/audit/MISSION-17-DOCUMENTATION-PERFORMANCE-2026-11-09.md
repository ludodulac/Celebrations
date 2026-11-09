# 🌸 CÉLÉBRATIONS — MISSION 17 : Documentation et performances

**Date : 9 novembre 2026.** Branche isolée `refactor/celebrations-mission-17-docs-performance-20261109`, dérivée de M16 / PR #96. **Aucune fusion, aucun déploiement, aucune donnée Cloudflare réelle modifiée.**

## Objectifs et modification effective

1. Mise à jour du README qui décrivait encore exclusivement **GitHub Pages / Supabase**, sans distinguer l'ancien code de la pile Cloudflare Worker/D1/R2. La distinction désormais explicite évite de modifier le mauvais logiciel.
2. Création d'un [guide technique et d'exploitation](../architecture/CELEBRATIONS-M17-GUIDE-TECHNIQUE-2026-11-09.md) : cartographie de l'administration et des visiteurs, routes, stockage, droits, erreurs, vérifications et limites de la mise en ligne.
3. Mesure et optimisation ciblée de `mergePublicMedia` dans `editor-publication-api.mjs` : fonction de domaine pure `app/domain/editor-public-media-merge.mjs` ; déduplication des utilisations par Map/Set **seulement lorsqu'un fichier est répété**. Aucun changement du format des snapshots, des URLs, des médias affichés ou des métadonnées de la première occurrence.
4. Tests d'équivalence exacts avec le code d'origine de M16 : entrées vides, visibilités, ordre, première description, média visible/privé, doublons initiaux conservés, objets de métadonnées, NaN, 300 jeux de données aléatoires reproductibles et absence de mutation des entrées.
5. Benchmark Node M16 **versus** M17 sur trois catalogues synthétiques pour 150 / 500 / 1 000 médias avec 48 usages par occurrence, sortie comparée par égalité profonde, temps médian de 7 mesures après échauffement.
6. Comparaison du vrai rendu de l'administration M16/M17 (HTML complet identique sauf nonce CSP aléatoire, même nombre de lectures SQL sur fixtures D1, temps du premier bloc rendu dans Chromium à 1280 et 390 px). Aucun appel réseau vers un domaine réel.
7. Rejeu des tests Node M05–M16, de la restauration D1/médias **synthétique**, et des parcours Chromium de référence M02/M11/M12/M13.

## Résultats chiffrés : exécution GitHub Actions réelle

**[Exécution M17 n°42538464144](https://github.com/ludodulac/Celebrations/actions/runs/42538464144) : SUCCESS**, commit `ae93bd2e79bf0ecb63e9c8983e3ea608d269a3e1`, Node 22.23.4, Ubuntu 24.04, Chromium isolé. **Aucune requête au site officiel**.

### Consolidation des médias publics — comparaison M16 / M17

**Données entièrement synthétiques**, trois catalogues par média, chacun contenant 48 références, et suppression logique des doublons identique à l'ancienne version. Temps **médians de 7 itérations après échauffement** ; les sorties M16/M17 sont comparées par égalité profonde.

| Médias uniques | Usages entrants | Ancien M16 | Nouveau M17 | Accélération mesurée |
|---:|---:|---:|---:|---:|
| 150 | 21 600 | 5,106 ms | 2,780 ms | **1,84 ×** |
| 500 | 72 000 | 18,231 ms | 10,220 ms | **1,78 ×** |
| 1 000 | 144 000 | 36,156 ms | 25,279 ms | **1,43 ×** |

**Interprétation prudente :** ce gain concerne la **fusion en mémoire de listes répétées de médias** ; il ne garantit pas une accélération équivalente du site réel, où le réseau, D1/R2, les médias et le rendu navigateur pèsent également.

### Comparaison du premier rendu de l'éditeur — M16 contre M17

**Même générateur HTML réel**, même jeu D1 fictif, même logique d'affichage Chromium, cinq ouvertures par version et par taille, HTTP simulé hors réseau de production. Le HTML administratif est **strictement identique après normalisation du nonce CSP** : **293 157 octets**, **7 lectures D1 simulées**, **8 étapes**, **2 blocs visibles**, et aucune requête d'écriture.

| Affichage | M16 médiane jusqu'au premier bloc | M17 médiane jusqu'au premier bloc |
|---|---:|---:|
| Ordinateur 1280 × 840 | 97,1 ms | 97,9 ms |
| Téléphone simulé 390 × 844 | 93,9 ms | 92,0 ms |

Les écarts inférieurs à deux millisecondes sont **du bruit de mesure dans cet environnement** : il serait trompeur d'annoncer une amélioration visible du chargement de l'éditeur. Les **10 références UI M02 restent identiques dans leurs scénarios fonctionnels** ; aucune modification CSS n'a été faite.

### Validation complète

- **42/42 tests Node** dans la première commande (37 contrats de protection M16 et 5 tests M17).
- **205/205 tests Node supplémentaires** du logiciel M05–M15 : **247/247 au total, aucun échec**.
- **9/9 tests Python** de restauration **synthétique** de SQLite et de fichiers.
- **10/10 scénarios/captures Chromium d'administration** (5 PC, 5 téléphone), sans erreur JavaScript.
- **Sélecteurs de médias PASS** à 1280/390 px ; **glisser-déposer et Undo PASS**.
- **Site visiteurs PASS** PC/téléphone, séparation des brouillons vérifiée ; **modales et styles PASS**.
- Comparaison HTTP/HTML M16/M17 : **0 écriture, 0 requête de production, 0 erreur JavaScript**.

Les premiers passages du workflow ont permis de corriger un contrôle historique d'empreinte SHA : **11 fichiers hérités restent identiques à M14**, tandis que le douzième, l'API de médias intentionnellement améliorée, est désormais **épinglé à son empreinte M17** et validé contre 300 jeux de données comparatifs. Le premier script de navigateur utilisait aussi `URL` comme variable d'adresse, masquant le constructeur JavaScript natif ; il a été corrigé puis la dernière exécution complète est verte. Aucun test de non-divulgation ni de compatibilité n'a été supprimé.

**L'amélioration de la fusion des médias est démontrée sur ces jeux de test, pas sur le vrai trafic Cloudflare.**

## Garanties et limites

Le fonctionnement des visiteurs, la publication explicite, les brouillons privés, les médias historiques, la sélection des fichiers, le glisser-déposer, l'annulation et l'apparence CSS sont inchangés. Le code modifié est celui du serveur de consolidation des médias publics, non celui de la mise en page ni des sauvegardes.

La version active réelle du Worker a été **observée en M16** via un GET Cloudflare, pas sauvegardée intégralement. Aucun export ni restauration complète récente de D1, aucun archivage vérifié de tous les binaires médias R2, aucune copie indépendante ni répétition d'un rollback exact n'ont été attestés pendant M17. **Ces réserves M03/M16 restent bloquantes.**

**PR en DRAFT, ni fusion ni publication. La mission 18 constituera une recette, pas une autorisation implicite de mise en ligne.**
