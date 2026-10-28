# CÉLÉBRATIONS — MISSION D2 — Fidélité visuelle ciblée (29 octobre 2026)

## Statut
**D2 construite et vérifiée sur staging uniquement. Fidélité visuelle significativement améliorée, validation visuelle humaine finale non acquise.** Ne pas démarrer E.

## Corrections, sans reconstruire D
- Accueil général : bandeau informationnel bleu, carte beige et bouton brun reproduisant la disposition existante, photographie historique servie par R2 autorisé.
- Accueil célébrations : couleurs de l'archange, titre, dates et flammes historiques ; navigation vers les sept étapes.
- Mobile : largeurs fluides, grille de célébrations, galerie en colonnes adaptées, boutons utilisables, aucun débordement horizontal identifié.
- Programme : ordres de rendez-vous, dates, contenus et liens historiques représentés par blocs typés ; navigation réelle vérifiée par clic.
- Médiathèque : grille d'images/catalogue, documents PDF et lecteurs audio/vidéo ; références historiques conservées.
- Pages particulières : texte complet accessible par mode lecture sûre ; liens et ressources sélectionnés réaffichés sans exécuter l'ancien HTML/JS.
- Accès normal depuis l'admin staging : `/__editor/entry` convertit une session admin **existante** en cookie court (20 min, HttpOnly, Secure, SameSite Strict, HMAC lié à une session active). L'accès est révoqué immédiatement si la session admin D1 expire/supprimée.
- Média authentifié `/__editor/media?id=...` : lit uniquement des références D1 existantes, R2 staging, en respectant les refus/retraits explicites et en interdisant les chemins comité. Aucune copie R2, aucun accès anonyme.

## Preuves
CI GitHub Actions : https://github.com/ludodulac/Celebrations/actions/runs/40790121407 — **SUCCESS**.

- **47/47** pages converties affichées par HTTP 200 uniquement avec accès de test protégé.
- **7/7** tests Node sur données synthétiques, incluant B/C/D/D2, cookie et médias protégés, 0 échec.
- Chromium ordinateur 1366×768 et téléphone 390×844 : **38 captures en mémoire** (aucun artefact public), 12 comparaisons avec l'ancienne interface staging, 7 étapes sur les deux formats, 2 clics de navigation réussis.
- Accueil et célébrations : **0 image cassée** sur les deux formats après réparation du chargement administrateur.
- Mercredi : **1 image non chargée sur chaque format** malgré sa référence historique. Cause exacte (objet R2 absent, refus ACL ou autre) non encore prouvée ; ne pas la masquer ni inventer un remplacement.
- Média PDF échantillon servi par le véritable Worker staging : **HTTP 200, application/pdf**.
- **0 débordement horizontal** dans les scènes testées.
- Administration historique staging : HTTP 200 ; visiteur non autorisé : 401 ; nouvelles pages : **47 brouillons, 0 publication**.
- Contrôles des branchements Cloudflare staging/production et quotas : PASS. Dernières métriques au 28/10 23:54 UTC : 268016 lignes D1 lues/5M, 1904 écrites/100k au total du compte (métriques différées).

## Écarts de capture — moyenne des écarts RGB (0–255), plus faible = plus proche
| Scène | D ordinateur | D2 ordinateur | D mobile | D2 mobile |
|---|---:|---:|---:|---:|
| Accueil général | 55,5 | 37,1 | 66,6 | 39,7 |
| Accueil célébration | 54,7 | 45,2 | 59,2 | 39,0 |
| Mercredi / rendez-vous | 26,6 | 17,4 | 49,1 | 33,6 |
| Médiathèque | 30,1 | 22,4 | 47,3 | 33,2 |
| Mentions légales | 19,8 | 8,3 | 43,3 | 18,9 |

La bibliothèque catalogue complète est désormais aussi capturée ; elle contient 40 blocs pour le premier lot et 15 images testées sans erreur de chargement dans la fenêtre visible. Comparaisons en captures de taille fixe avec l'**ancienne interface staging**, non une certification de ressemblance au pixel près.

## Limites restantes
- Un visuel du mercredi ne se charge toujours pas. Les fichiers originaux n'ont pas été supprimés/écrasés ; une vérification ciblée des métadonnées et des droits R2 est nécessaire avant l'annonce « aucune image manquante ».
- Le rendu statique complexe reste une interprétation sécurisée, pas une reproduction DOM/CSS parfaite ; les espaces d'accueil et de célébrations présentent encore des différences visibles de composition.
- Les 38 captures ont été inspectées par mesures de différences et DOM (présence visuelle, liens, dépassement, images cassées), **pas individuellement par une personne**. La validation de fidélité par Romain/Ludo reste nécessaire.
- Le vrai Worker staging a été testé avec un accès QA protégé, sans altérer les comptes ni créer de session personnelle. Le parcours de connexion normal de Romain n'est pas encore attesté dans son navigateur.
- Aucun rendu public remplacé ; aucune fusion ; aucune mission E engagée. La PR D #66 demeure DRAFT.

**Recommandation : valider l'architecture et les améliorations D2, mais différer la validation visuelle finale de D jusqu'à la correction du visuel manquant et à une revue humaine rapide des 5 écrans représentatifs.**
