# CÉLÉBRATIONS — Mission 08 : seulement les ressources réellement visibles

## Périmètre imposé par le propriétaire

Ne pas restaurer/chercher des anciennes routes arbitraires, des données d'archive sans bouton sur le site, ni les quatre raccourcis orphelins `/communique`, `/rituel-court`, `/rituel-long`, `/preparation`. L'objectif est de faire fonctionner les pages réelles, leurs menus, la navigation, les images et documents que les visiteurs peuvent effectivement voir et ouvrir. Préserver aussi les neuf PDF de comité expressément demandés et déjà certifiés en mission 06.

## Résultats déjà établis et non à recommencer

- 158 objets Supabase originaux, 211 fiches éditoriales. Seulement 121 objets ont été copiés en R2 production ; 37 candidats inutilisés sont conservés chez la source/staging sans supprimer.
- 31 chemins déclarés mais absents **avant toute migration** : un PDF de programme du jeudi et 30 anciennes entrées de galerie/illustrations. Le PDF du jeudi « Pardon des Offenses — version raccourcie » a **déjà** été restauré en R2 production et rendu consultable sur la prévisualisation Cloudflare (travail de mission 029).
- Un audit antérieur sur 113 médias publics a obtenu 113/113 HTTP 200 ; ce sont des preuves historiques, pas une preuve exhaustive des autres chemins référencés.
- Code `public-library-simple.js` : la grille images supprime les fiches si `getMedia()` ne retourne pas de véritable image. Des métadonnées anciennes de galerie sans fichier ne constituent donc pas automatiquement trente images visuellement cassées à rétablir.

## Contrôle isolé de la mission

Script `scripts/mission08_visible_only_media_audit.py`, exclusivement en lecture seule ; protection opt-in `[MISSION08_VISIBLE_ONLY_AUDIT_ONCE]` ; GitHub Actions `mission08-visible-only-media-audit`.

- Reprendre 211 fiches, 124 relations événement-contenu, 9 liens comité, et les fichiers source sans copier de contenu.
- Regrouper les 31 références absentes par usage réel : images de galerie masquées par l'UI, liens dans un programme cliquable, ressources d'accueil, et anciennes couvertures.
- Comparer à la liste exacte des 113 objets approuvés dans D1 production, et vérifier leur HTTP HEAD 200 dans le Worker de prévisualisation Cloudflare. Le PDF récupéré doit répondre en `application/pdf`.
- Refuser de certifier si une autre référence manquante est réellement nécessaire à un lien visible.
- Ne jamais imprimer les noms ou clés de fichiers privés, ne jamais enregistrer de données personnelles dans GitHub, ne jamais modifier production, Supabase, main, DNS, Worker ni aucun média.

## État

Lancement du contrôle réel avec déclencheur opt-in. Résultat à documenter d'après GitHub Actions, avant de déclarer la mission terminée.

## Résultat réel vérifié — 22 octobre 2026

**PASS — [GitHub Actions #39800612532](https://github.com/ludodulac/Celebrations/actions/runs/39800612532)**, job `mission08-visible-only-media-audit` SUCCESS, contrôles D1 Free pré/post SUCCESS, aucune modification du site en production.

Résultat `MISSION08_VISIBLE_ONLY_SOURCE_REFERENCE_AUDIT` obtenu à partir de la vraie source Supabase, de la vraie D1 migrée et de l'URL Cloudflare de prévisualisation :
- **211 fiches source** et **158 objets d'origine** contrôlés ; les **31 chemins manquants** existaient **déjà avant la migration**.
- **30 chemins** concernent d'anciennes images de la galerie. Le composant réel `hydrateGalleryImages` **supprime la fiche au lieu de l'afficher** lorsque `getMedia` ne renvoie pas une image : il ne s'agit pas de 30 images visibles, donc **aucune récupération/retouche à effectuer** sur demande du propriétaire.
- **1 chemin** correspond au PDF du programme du jeudi « Pardon des Offenses — version raccourcie », véritable référence **cliquable**, déjà restaurée depuis la source Drive du propriétaire lors de la mission 029. **HTTP HEAD 200, `application/pdf` confirmé** dans la prévisualisation.
- **Aucun chemin manquant** dans les contenus d'accueil ni les couvertures ; **aucune référence manquante non classifiée**. L'unique contenu relié au programme dont le fichier source n'existait pas est ce PDF, désormais servi sur Cloudflare.
- **113/113 médias publiés/autorisé D1 répondent HTTP HEAD 200** sur `celebrations-exit-preview-ro.rondes.workers.dev`. Les **9 PDF historiques de comité** sont inchangés et ont été vérifiés séparément lors de la mission 06.
- D1 quota Free : snapshots avant/après = 110 021 lectures, 1 059 écritures, largement sous les limites. Cette mission ne réalise aucune écriture SQL, Supabase, R2, Worker, DNS ni GitHub `main`.

**Décision : mission 08 VALIDÉE pour le périmètre réellement visible dans les écrans actuels.** Ne pas tenter de « réparer » les 30 anciennes images sans binaire, puisqu'elles ne sont pas affichées ; ne pas supprimer non plus leurs fiches/source, car l'administration peut encore en conserver les métadonnées. Les **37 objets non publiés en R2 production** restent préservés dans les stockages Supabase et R2 staging (aucune purge). Ne pas refaire les gros transferts.

Les vérifications de navigation réelle complètes avant bascule appartiennent à la mission 09 (site public) et aux tests finaux 13–14. **Aucune bascule du domaine officiel** autorisée par la mission 08.
