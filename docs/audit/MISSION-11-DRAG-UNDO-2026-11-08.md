# 🌸 CÉLÉBRATIONS — MISSION 11
## Glisser-déposer et historique d'annulation : refonte sans changement visuel

**Date :** 8 novembre 2026. **Branche isolée :** `refactor/celebrations-mission-11-drag-undo-20261108`. **Base :** M10 / PR #90. **Statut :** aucun déploiement.

### Livrables
- Domaine `migration/cloudflare/app/domain/editor-drag-model.mjs` :
  localiser et déplacer les **objets originaux** entre racine, première et
  deuxième colonnes ; regrouper des blocs racine dans une section une colonne
  sans perdre les médias, les identifiants, le texte enrichi et les attributs
  historiques ; refuser les destinations impossibles, l'auto-déplacement et
  les gestes inchangés sans toucher aux documents.
- `migration/cloudflare/app/application/editor-undo-policy.mjs` : format
  des instantanés, regroupement de frappes rapprochées dans le même champ,
  limite de 36 actions / 6 Mo, restauration des pages et de leurs éléments
  sans annuler **les états de visibilité publique** du serveur.
- Les fonctions réelles `editorElementLocation`, `moveEditorElement`,
  `moveEditorIntoBlock`, `rememberUndoChange`, `undoSnapshot` et
  `undoLastEditorAction` appellent ces nouveaux modules depuis l'éditeur
  existant. La composition ESM du script à nonce reste inchangée.

### Prévention des gestes accidentels
- Sur ordinateur, saisir directement un bloc pour le déplacer exige que
  **ce bloc soit déjà sélectionné**. Un simple clic sur un bloc inactif
  ne doit pas déclencher son déplacement.
- La poignée ⠿ demeure une action de déplacement explicite, et la souris
  garde le seuil de 6 pixels avant d'activer le drag.
- Sur téléphone et tablette, appui long sur la poignée (430 ms) ;
  déplacement du doigt de plus de 12 pixels avant l'appui long = annulation.
- Pointeur relâché, annulation ou ESC : nettoyage de l'indicateur/du fantôme.
  Aucune sauvegarde ni nouvelle entrée Undo en cas d'action inchangée.
- Après déplacement effectif : une seule action locale, bouton Undo et
  Ctrl+Z disponibles, puis enregistrement par l'action existante.

### Limites intentionnelles
- Les poignées, boutons, cadres et styles CSS restent identiques.
- Le texte saisi conserve son Ctrl+Z natif.
- L'historique Undo est local à la session et n'annule jamais une
  publication/masquage confirmé côté serveur.
- Aucun transfert entre deux célébrations différentes ni conversion
  implicite de schémas historiques.
- Aucun changement à Cloudflare, D1/R2, routes, noms ou IDs média.

### Vérifications
Nouveaux tests : 1) déplacer images/vidéos/titres/liens entre colonnes et
racine sans copie, 2) grouper sans perdre les propriétés, 3) destination
invalide et auto-déplacement sans effet, 4) sélection préalable requise pour
le drag direct, 5) seuil souris et appui long tactile, 6) Undo exact de la
structure sans restaurer la publication, 7) frappe fusionnée, 8) limites de
mémoire et 9) absence d'écriture réseau par les modules extraits.

Les tests précédents M05–M10 et la référence visuelle Chromium sont
rejoués. Le verdict effectif doit venir de GitHub Actions.

### Publication interdite
Cette mission ne touche ni aux données ni aux objets de production.
Les réserves M03 (restauration Worker/D1, octets médias R2 et sauvegarde
indépendante) restent bloquantes avant toute fusion ou publication.
