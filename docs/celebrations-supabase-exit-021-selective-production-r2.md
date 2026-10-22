# CÉLÉBRATIONS — mission 021 : copie sélective des fichiers visibles, SANS purge

Suite à la nouvelle consigne explicite du propriétaire, la production ne doit **pas reprendre les 158 médias indistinctement**.

## Preuves précédentes

- 158 objets originaux Supabase, 830 312 417 octets, 211 fiches de contenus dans l'administration.
- 153 fiches réellement reliées à l'accueil, aux jours du programme ou à la galerie.
- 121 objets de Storage **effectivement référencés** et reconnus nécessaires pour les utilisateurs (dont neuf PDFs d'invitations comité accessibles via lien), total prévisionnel **environ 767 Mo**.
- 37 autres objets **candidats à exclusion de la nouvelle production**, mais conservés dans Supabase et R2 staging. **Aucun effacement** dans les services existants.
- 31 chemins enregistrés dans des fiches « publiques » ne sont déjà plus retrouvés sous le chemin déclaré dans le Storage original. Ils exigent un diagnostic individuel avant une mise en ligne complète.

## Copie privée conditionnelle

Un script ajouté, `scripts/copy_selected_public_media_to_production.py`, réinterroge uniquement en lecture les 211 fiches Supabase, leurs liens Programme/Préparation/Mercredi/Jeudi/Vendredi/Samedi/Dimanche/Après célébration, l'Accueil, la galerie d'images, les illustrations programmatiques et les neuf PDFs de comité, puis liste les objets du Storage source.

Il refuse toute variation du nombre et de la taille des 158 objets, ou du nombre des 121 objets identifiés le 21 octobre. Il vérifie également si un des 37 candidats apparaît en tant que **chemin direct** dans les fichiers HTML/JS/CSS destinés aux visiteurs ; si oui, il s'arrête : pas d'exclusion aveugle. La base JSON de secours, qui contient l'ancienne liste complète d'administration sans constituer l'écran normalement affiché, n'est pas utilisée pour gonfler la liste « affichée ».

Il exige ensuite l'identité exacte des buckets privés `celebrations-exit-staging` (source existante) et `celebrations-exit-production` (nouveau bucket, destination), de la D1 de production européenne distincte et du fait que la destination R2 est **initialement vide**. Il n'élargit pas les permissions R2 si le jeton existant n'autorise pas l'accès à la destination.

**Transfert :** copie inter-buckets S3 côté serveur de chaque objet protégé, avec validation SHA-256 **en lisant les octets dans la source et la destination** ; aucun contenu privé n'est inscrit dans les fichiers temporaires ni les logs de GitHub Actions. Une vérification finale des noms internes/tailles exige **strictement la liste protégée**, aucun des 37 candidats.

## Sécurité et limites

- **Aucune modification Supabase**, même pour les 37 candidats.
- **Aucune suppression R2 staging** (qui contient les 158 originaux et le backup chiffré).
- **Aucune table D1 modifiée, aucun Worker publié, aucun DNS Spaceship touché**.
- Les 31 références problématiques restent bloquantes pour promettre 100 % de disponibilité des ressources visibles ; ne pas inventer de fichiers pour compenser.
- Le moteur de publication/admin et les 211 fiches en base de production devront être traités dans une phase différente ; cette opération ne fait **que le transfert privé des binaires reconnus utiles**.
- Un contrôle navigateur complet devra vérifier les 7 sections (y compris Après célébration), l'Accueil, la galerie et les liens avant le basculement public.

## Déclenchement

Le job `production-selected-media-copy` exige un commit `[PUBLIC_MEDIA_TO_PROD_ONCE]` sur `feat/celebrations-supabase-exit-001`. Ce document n'atteste aucun transfert, uniquement la préparation technique.

`PRODUCTION_SELECTED_MEDIA_COPY=PREPARED_NOT_EXECUTED` · `PRODUCTION_RELEASE_AUTHORIZED=NO`.

## Résolution de l'ancien avertissement « 31 références » — mission 08 (22 octobre 2026)

L'avertissement conservé plus haut est **historique**, et non un blocage actuel : [run #39800612532](https://github.com/ludodulac/Celebrations/actions/runs/39800612532) a effectivement classé les **31 chemins absents chez Supabase**. **30** sont des images d'anciens éléments de galerie que l'interface utilisateur retire de l'affichage lorsque le binaire est absent ; le propriétaire a demandé de migrer seulement ce qui est réellement présent sur le site. **1** était le PDF du jeudi déjà restauré et désormais accessible en Cloudflare R2 (HTTP 200). Aucune absence supplémentaire dans les ressources d'accueil, couvertures ou autres catégories utilisées ; **113/113 médias approuvés** répondent HTTP 200 sur le Worker de prévisualisation. Ne pas lancer de recherche/restauration pour les 30 images de galerie non affichées. Ne pas effacer les données source ni modifier le domaine officiel ; l'audit visuel/navigateur exhaustif appartient à la mission 09.
