# 🌸 CÉLÉBRATIONS — MISSION 08
## Catalogue médias et sélecteurs unifiés, sans changement de présentation

**Date :** 7 novembre 2026 — branche `refactor/celebrations-mission-08-media-catalogue-20261107` dérivée de la M07 / PR #87.

## Objectif et exécution

Rassembler les règles identiques de gestion des médias historiques, locaux et
hébergés dans **un modèle réutilisable**, sans déplacer ni renommer les fichiers
déjà accessibles ni réécrire des pages.

- `migration/cloudflare/app/domain/editor-media-catalogue.mjs` :
  catégories et types de fichiers, filtrage des références publiques héritées,
  dédoublonnage du sélecteur global, liste d'images historiques + images imbriquées
  dans les colonnes + images distantes/locales, comptage de la médiathèque globale,
  ordonnancement des médias, modèle de bloc inséré dans une page.
- `migration/cloudflare/app/application/editor-media-commands.mjs` :
  deux commandes locales de sélection d'un fichier ou d'une image/miniature,
  sans aucune écriture réseau. Sélection d'une vidéo = bloc vidéo conservé,
  miniature et légende conservées, aucun changement de page.
- `editor-demo-client.mjs` branche ces modules directement sur le sélecteur
  de fichiers, celui des images, les cartes de la médiathèque globale et
  l'insertion d'un média dans la page. Les gestionnaires d'API Cloudflare restent
  inchangés, ainsi que les classes et éléments HTML de l'interface.

## Trois emplacements distincts, non fusionnés physiquement

1. `MEDIA_BUCKET` historique : vrais fichiers et PDF conservés aux anciennes URL
   `/media/` et `/letter/`.
2. `EDITOR_BUCKET` : nouveaux fichiers sous `editor-trials/uploads/` avec
   les URL stables `/media/new/`.
3. `mediaCatalogue` : métadonnées et références, **pas les octets des médias**.
   Les anciens fichiers de la démonstration sont encore locaux à IndexedDB.

Le catalogue *logique* est réorganisé, **aucune migration des binaires** n'est
réalisée. Les vidéos ne deviennent pas des boutons, et l'upload direct de MP4
n'est pas activé par inadvertance.

## Invariants et limites de la mission

- Les cinq catégories présentes conservent leurs noms et l'ordre actuel.
- Les fichiers référencés dans les pages et les chemins anciens sont conservés.
- Les sélecteurs restent des fenêtres modales au-dessus de la page ouverte.
- Aucun brouillon n'est publié, supprimé ou converti implicitement.
- Le filtrage du catalogue historique n'introduit pas de lien privé.
- La protection des suppressions de fichiers utilisés demeure côté serveur et
  dans le logiciel historique : pas de suppression R2/D1 ajoutée.
- Le protocole de sauvegarde/conflit (M10) et le drag-and-drop/Undo (M11)
  restent hors périmètre.
- L'ancienne catégorie vidéo des fichiers locaux de démonstration reste
  `Autres` afin de préserver le comportement existant. Le véritable serveur
  ne permet toujours pas de nouvel upload vidéo par cet écran.

## Vérifications prévues

- Tests unitaires de catégorisation, dédoublonnage, classes de média, sources
  historiques/modernes, affectations image/miniature/vidéo et fichiers inutilisés.
- Tests de non-régression M05–M07 et anciennes fonctions (pages, médias,
  publication, boutons, images et vidéos).
- Parcours Chromium avec 5 écrans ordinateur + 5 écrans téléphone, et
  sélecteurs d'images/PDF/vidéos à deux largeurs.
- Voir **GitHub Actions de la branche** pour le verdict effectif. Ne pas
  confondre la présence du workflow avec une réussite des tests.

## Protection de la production

Aucune fusion ni déploiement autorisé par cette mission. PR **DRAFT**.
Les réserves M03 de récupération complète D1/médias et rollback Worker
demeurent des conditions de sécurité avant la publication des refontes.
