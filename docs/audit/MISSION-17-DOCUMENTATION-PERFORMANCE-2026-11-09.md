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

## Résultats chiffrés

À consigner **uniquement après une exécution GitHub Actions effectivement terminée**, en précisant qu'il s'agit de données de test et de mesures propres au runner CI. Ne pas extrapoler vers les temps vécus sur le site actuel.

## Garanties et limites

Le fonctionnement des visiteurs, la publication explicite, les brouillons privés, les médias historiques, la sélection des fichiers, le glisser-déposer, l'annulation et l'apparence CSS sont inchangés. Le code modifié est celui du serveur de consolidation des médias publics, non celui de la mise en page ni des sauvegardes.

La version active réelle du Worker a été **observée en M16** via un GET Cloudflare, pas sauvegardée intégralement. Aucun export ni restauration complète récente de D1, aucun archivage vérifié de tous les binaires médias R2, aucune copie indépendante ni répétition d'un rollback exact n'ont été attestés pendant M17. **Ces réserves M03/M16 restent bloquantes.**

**PR en DRAFT, ni fusion ni publication. La mission 18 constituera une recette, pas une autorisation implicite de mise en ligne.**
