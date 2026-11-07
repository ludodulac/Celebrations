# CÉLÉBRATIONS — MISSION 07 : modèle des blocs et sections

**Date :** 7 novembre 2026. Branche isolée dérivée de M06/PR #86, aucune mise en production.

## Modifications
- `app/domain/editor-block-model.mjs` : construction des huit types éditables, sections une/deux colonnes, presets image+document, vidéo et PDF ; lecture des valeurs de présentation sans modifier les objets stockés.
- `app/application/editor-block-commands.mjs` : duplication locale et conversion d'un bloc existant en section, conservant les objets enfants et leurs identifiants.
- L'éditeur appelle ces modules aux vrais points de création/duplication/regroupement/édition des cadres et colonnes.
- Les mises à jour volontaires des cadres préservent désormais les métadonnées inconnues d'un style historique plutôt que de les effacer.
- Aucun nouveau schéma de données ; les pages/brouillons existants ne sont pas réécrits au chargement.

## Compatibilité
Titres, textes enrichis, liens, images, audio, vidéos, événements, séparateurs,
sections et types historiques inconnus restent sérialisés avec leurs attributs.
La conversion une/deux colonnes conserve les deux tableaux de contenus, sans
réinitialisation. Le statut d'un bouton de vidéo n'est pas changé sans action explicite.

## Invariants
Pas de changement CSS/HTML ni d'API, d'accès, de publication et de R2/D1.
Drag-and-drop/Undo demeurent M11, sauvegarde/publication M10, médias M08.
Les tests historiques qui extrayaient des fonctions à partir d'une chaîne sont
adaptés à leur nouveau module, sans diminuer leurs assertions fonctionnelles.

## Preuves
Workflow M07 : nouveau test de conservation JSON de tous les types, y compris
les champs inconnus ; anciens tests complets d'éditeur et de colonnes ;
référence visuelle M02 sous Chromium (ordinateur et téléphone) et sélecteur
d'images/PDF/vidéo. Ne déclarer une réussite qu'après lecture de la CI.

## Sécurité
Réserves de la M03 R1–R5 toujours ouvertes : ne pas fusionner ni déployer
la refonte sans restaurations intégrales et rollback précis vérifiés.


## Validation finale de la mission 07 (exécutée)

- GitHub Actions [run #42408066044](https://github.com/ludodulac/Celebrations/actions/runs/42408066044) : **SUCCESS**.
- Tests Node : **103 réussis, 0 échec, 0 ignoré** (nouveaux contrats M07, anciennes vérifications M05/M06, sections, boutons, sauvegardes, médias, pages).
- Chromium : **10 vues de référence sur données fictives** — 5 sur ordinateur, 5 sur téléphone, **10/10 PASS**, sans erreur JavaScript et sans requête vers la production dans ces parcours.
- Sélecteurs image/PDF/vidéo : **PASS** à 1280 et 390 px ; page éditée conservée.
- Aucun nouveau schéma ni endpoint, aucune écriture D1/R2, aucune mise en ligne.
- Les premières exécutions M07 avaient échoué à cause de tests d'extraction de fonctions réorganisées et d'une ancienne expression de test trop stricte pour la gestion des couvertures de boutons ; ces tests ont été corrigés **sans enlever leurs vérifications fonctionnelles** puis le parcours complet est passé.

**Limite :** ce succès en environnement isolé ne certifie pas tous les cas de production ni l'égalité pixel par pixel de toutes les pages. La PR reste en **DRAFT** et non fusionnée. La publication demeure bloquée par les réserves M03 et demande un accord distinct du propriétaire.
