# Célébrations — architecture et règles de maintenance (20 novembre 2026)

## Source de vérité
- Dépôt GitHub : ludodulac/Celebrations.
- Site : https://www.ronde-des-archanges-universelle.eu.
- Worker public : celebrations-exit-production. Ne pas confondre avec l'ancien Worker « celebrations » ni le staging.
- Cloudflare Workers sert le site ; D1 conserve les données relationnelles historiques et R2 les médias et états éditoriaux publiés/partagés.
- Le code d'administration est notamment dans migration/cloudflare/editor-demo-client.mjs ; les pages initiales de célébration et le catalogue public dans editor-demo-preparation-page.mjs ; styles de blocs dans app/styles/admin/04-section-composer.mjs.
- Les pages d'une célébration suivent Accueil, Préparation, Programme, Mercredi, Jeudi, Vendredi, Samedi, Dimanche, Après célébration. Certains anciens brouillons serveur peuvent manquer « Programme ».

## Règles impératives
1. Un commit GitHub n'est PAS un déploiement Cloudflare. Vérifier séparément la branche, le SHA déployé, le workflow, la version du Worker effectivement active et le rendu public.
2. Le workflow .github/workflows/celebrations-m051-pinned-release.yml utilise un checkout sur un SHA épinglé ; il peut publier une ancienne version même après de nouveaux commits. Ne jamais déclencher une publication sans corriger ce pin et valider les contrôles de sécurité et de données.
3. Ne pas remplacer, supprimer ou migrer les données D1/R2 de production pour une correction d'interface. Ne pas toucher au DNS ni aux secrets. Préserver les liens publics existants.
4. Les pages et médias masqués/privés ne deviennent jamais publics par un simple changement d'URL.
5. Ne pas dire « corrigé sur le site » sans preuve de déploiement et test ; distinguer « code modifié », « tests passés », « publié », « vérifié visuellement ».
6. Préférer des modifications ciblées, du code propre et des tests desktop/mobile. Ne pas multiplier les boutons, dialogues ou libellés superflus.

## Demandes fonctionnelles en attente de validation en production
- Médiathèque visiteurs de chaque célébration : audios, vidéos, documents PDF et autres documents ; pas d'images dans les catégories visiteurs ; fichiers filtrés par célébration et visibilité.
- Éditeur : marges supérieures indépendantes pour chaque colonne des blocs « Deux colonnes » (0–200 px), persistées et identiques en aperçu et chez les visiteurs.
- Cadres/contours de blocs, notamment contour rouge, fidèles entre administration et public.
- Fenêtres d'insertion : visibles en entier sans faire défiler la page principale pour trouver leurs options.
- Miniatures vidéo : pas de bandes noires ajoutées par le CSS ; taille réglable, proportions naturelles.
- Rétablissement de la page « Programme » dans les anciens brouillons, sans perte de données et avec enregistrement serveur vérifié.
- Pour les NOUVEAUX fichiers uniquement : URL lisibles /doc/nom.ext, /audio/nom.ext, /image/nom.ext ; doublons suffixés -1, -2 ; adresse stable même après renommage ; ne jamais changer les URL historiques déjà envoyées par mail. Cette fonction est une demande, pas une implémentation validée.

## Historique des commits de la branche de travail
Branche fix/m051-program-media-preview-colors-20261119 :
- 30ad9a5 : marges des deux colonnes (à tester).
- 636d024 : restauration Programme (à tester).
- b726abd : classification de documents non PDF (à tester).
- 6a077f3 : aperçu vidéo sans fond noir (à tester).
Le workflow M051 sur main a été constaté épinglé à 2e6c55f, donc ne contient pas ces modifications. Ne pas confondre ces commits avec une publication.

## Protocole de livraison
Inspecter les routes et la source du catalogue ; écrire des tests ciblés ; vérifier la persistance et le rendu public ; construire ; publier une version immuable par le circuit approuvé ; vérifier le Worker actif et tester les pages publiques et l'admin ; annoncer précisément les résultats et les limites.
