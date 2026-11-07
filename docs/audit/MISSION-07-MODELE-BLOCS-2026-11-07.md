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
