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
