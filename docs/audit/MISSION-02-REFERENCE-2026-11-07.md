# CÉLÉBRATIONS — MISSION 02
## Référence du fonctionnement actuel : visiteurs, administration et médias

**Statut : mission 02 effectuée sur l'interface de référence, sans modifier le site.**
**Date de capture : 7 novembre 2026 (vers 12:04 UTC).**
**Version de référence du code : `7cbfdbd79e2b40f8f4ca4b46dbc97d47e26b742d` (branche `fix/celebrations-inline-validation-20261105`).**
**Référence mission 01 :** `docs/audit/MISSION-01-CARTOGRAPHIE-2026-11-07.md`.
**Domaine public consulté en GET uniquement :** `https://ronde-des-archanges-universelle.eu`.

> Important : le parcours public est observé sur **le vrai domaine**, sans session ni modification. Le parcours *administrateur après connexion* est reproduit avec **le vrai programme d'édition, les vrais styles et un jeu de données entièrement fictives**. Faute de compte administrateur utilisé lors de cet audit, il serait inexact de présenter ces captures synthétiques comme des captures de l'administration contenant les vraies pages du propriétaire.

## 1. Objectif

Conserver une référence vérifiable de l'apparence et des comportements **avant tout rangement interne**.

Une mission future n'est acceptable que si les fonctionnalités actuelles restent identiques pour les visiteurs et les administrateurs, sauf changement demandé par le propriétaire. Il ne faut jamais remplacer une preuve de parité par l'affirmation « ça devrait fonctionner ».

**Cette mission ne touche ni au code applicatif, ni à D1, ni à R2, ni aux utilisateurs, ni aux domaines, ni à la publication.** Seuls des fichiers de documentation, tests d'observation et un workflow sans secrets ont été ajoutés dans la branche d'audit.

## 2. Périmètres d'observation et preuves

| Périmètre | Méthode | Preuve |
| --- | --- | --- |
| Visiteurs — ordinateur | Chromium 1280 × 840, 10 itinéraires publics | Captures PNG + `public/reference-public.json` |
| Visiteurs — téléphone | Chromium 390 × 844, mêmes 10 itinéraires | Captures PNG + JSON |
| Menu visiteur ouvert | Clic sur hamburger, ordre des entrées | 2 captures dédiées |
| Administration sans connexion | GET sur `/admin.html`, aucune saisie de code | 2 captures, formulaire de connexion requis |
| Éditeur — ordinateur | Véritable HTML/JavaScript/CSS avec données D1 fictives | 5 captures + `editor-fixture/reference-editor-fixture.json` |
| Éditeur — téléphone | Même éditeur avec jeu fictif | 5 captures + JSON |
| Sélection de fichiers | Vraie fonction de sélection, 5 types de fichiers fictifs, desktop/mobile | 8 captures : Tous, Images, Vidéos, PDF + JSON |
| Régressions programmatiques | Tests Node existants sélectionnés | **71 tests réussis sur 71** |
| Anciens tests du prototype staging | Exécutés séparément, résultats conservés | **2 échecs d'attentes périmées sur 3 tests**, sans changement du logiciel |

Les captures sont conservées **30 jours** dans l'artefact du workflow GitHub Actions, et un ZIP peut être exporté pour conservation longue durée. Le code de la référence reste figé dans cette branche et les scripts peuvent être rejoués. Les captures ne sont pas ajoutées aux fichiers déployés du site.

### Scripts réutilisables

- `scripts/mission02-public-reference-browser.mjs` — référence de vraies pages publiques, GET/HEAD uniquement ; bloque toute mutation réseau.
- `scripts/mission02-editor-reference-browser.mjs` — éditeur réel exécuté avec une base factice en mémoire ; aucune requête sortante vers la production.
- `scripts/mission02-media-picker-reference-browser.mjs` — galerie et sélecteurs en fenêtre modale à partir de fichiers fictifs.
- `.github/workflows/celebrations-mission02-reference.yml` — tests, navigateur, contrôles de périmètre et export des captures ; **aucun déploiement**.

## 3. Référence du site visiteurs

### Routes observées (ordinateur ET téléphone)

1. `/` — accueil.
2. `/?page=celebrations` — liste des célébrations.
3. `/?page=mediatheque-generale` — médiathèque générale.
4. `/preparation/` — préparation.
5. `/mercredi/` — mercredi.
6. `/jeudi/` — jeudi.
7. `/vendredi/` — vendredi.
8. `/samedi/` — samedi.
9. `/dimanche/` — dimanche.
10. `/apres-celebration/` — après célébration.

Pour chacun de ces 20 affichages : **HTTP 200**, contenu visible, présence du menu, **aucun débordement horizontal** relevé au format testé. Les captures stockent la zone visible au premier écran ; **elles ne constituent pas une capture de toute la longueur de chaque page**.

La barre interne de la célébration comprend **8 étapes**. Ces huit entrées ne doivent ni disparaître ni changer d'ordre lors des refactorisations.

### Menu public

Ordre initial strict :

1. **Accueil**
2. **Célébrations**
3. **Médiathèque générale**
4. **Pages supplémentaires publiées**, après les trois entrées fixes.

Le menu est une petite colonne déroulante ancrée sous le bouton hamburger. Il ne doit pas repousser le contenu principal. Sur les navigateurs compatibles, Escape et le clic extérieur ferment la liste.

### Cartes des quatre Archanges

- Ordinateur : **4 colonnes** par rangée.
- Téléphone : **2 colonnes**.
- Michaël : trait **rouge**.
- Gabriel : trait **indigo**.
- Raphaël : trait **vert**.
- Ouriel : trait **jaune**.

### Contenus et liens

Les textes, médias et liens publiés sont **des données métier**, que le propriétaire peut modifier légitimement. Par conséquent, les nombres de caractères et de fichiers dans les JSON datés ne doivent **pas** devenir des valeurs obligatoires après une vraie modification éditoriale. Comparer d'abord : routes, éléments, fonctionnement, tailles, navigation et accessibilité.

Les médias doivent rester accessibles depuis leurs URL déjà publiées, y compris les chemins historiques `/media/`, `/letter/` et les nouveaux `/media/new/`.

## 4. Référence de l'administration

### Navigation

Trois zones repérées dans l'interface réelle du logiciel :

- **Pages**
- **Célébrations**
- **Médiathèque globale**

Sur les deux formats, les tests ont conservé le rendu de ces rubriques, de la sélection d'une page et de sa prévisualisation.

### Barre supérieure

- **↶** : annuler une action dans la limite de l'historique local ;
- **Aperçu du brouillon** : voir la page sans la publier ;
- **Enregistrer** : persistance de la modification ;
- **Voir le site** : accès au rendu publié, lorsque la page est visible.

### Outils de création et mise en page

À maintenir et tester dans les missions suivantes :

- Ajout d'une page générale et d'une page d'une célébration.
- Création/édition de titres, paragraphes, images, vidéos, sons, boutons, documents et traits.
- Blocs indépendants et blocs en colonnes ; tailles, couleurs et alignement.
- Déplacement des éléments par glisser-déposer, y compris entre blocs et colonnes.
- Réorganisation et suppression avec confirmation quand nécessaire.
- Retour en arrière par Ctrl+Z (hors saisie) et bouton ↶ sur téléphone.
- Édition du titre d'une vidéo **sous sa miniature, sans créer un bouton supplémentaire**.
- Sélection d'une vidéo et d'autres médias depuis une fenêtre par-dessus la page.
- Fermeture/validation des fenêtres sans perdre la sélection ni la page en cours.

**Précision :** les copies visuelles de l'éditeur sont réalisées avec une base fictive. Elles permettent de comparer les composants et leurs styles, **pas de certifier le contenu privé réel**.

### Médias

La fenêtre « Choisir un fichier » doit :

1. S'ouvrir au-dessus de la page sans navigation vers l'administration de la médiathèque.
2. Proposer une recherche et les filtres disponibles.
3. Montrer **de vraies vignettes** dans l'onglet Images.
4. Afficher les PDF, audios, vidéos et autres fichiers de manière lisible et sélectionnable.
5. Maintenir la page précédente en arrière-plan puis la restituer.
6. Préserver le bloc de type **Vidéo + titre + lecteur** si on choisit une vidéo.

### Enregistrer / Publier

Les règles observées dans le code serveur sont les suivantes :

- **Enregistrer** sauvegarde les modifications dans le système de brouillons et met à jour selon les règles courantes les pages **déjà publiées**.
- Une **nouvelle page** commence en **brouillon** : elle ne devient publique qu'après l'action explicite de publication.
- Le statut `published` / `draft` / `hidden` relève du serveur, et ne doit jamais être modifié implicitement par le retour arrière local.
- La sauvegarde serveur contrôle une révision et doit refuser les conflits silencieux par HTTP **409**.
- Une page en cours d'édition non transmise doit pouvoir être retrouvée localement selon les protections actuelles.

Le travail de restauration et l'exactitude des sauvegardes sur données réelles seront éprouvés sans destruction en **mission 03**.

## 5. Résultat des vérifications automatiques

### Tests actuels : **71/71 réussis**

Les tests stricts de la référence comprennent notamment : le client de l'éditeur, le rendu du site, les brouillons, la publication, les médias, la modal de fichiers, le lecteur vidéo, le retour arrière, l'accès administrateur et les thèmes des Archanges.

### Deux tests anciens à actualiser plus tard, pas à masquer

Le fichier historique `tests/test-editor-demo-preparation.mjs` contient **deux assertions devenues périmées** :

- Il recherche toujours un ancien nom de fichier d'image de bienvenue. La version actuelle utilise désormais l'adresse préservée du fichier historique.
- Il attend encore HTTP **404** pour l'hôte officiel, alors que le véritable éditeur a depuis été autorisé sur cet hôte : résultat actuel **200**.

Ces deux assertions échouent ; le troisième test du même fichier réussit. Leur exécution est conservée séparément dans le workflow, avec échec toléré **et explicitement signalé**, afin de ne pas bloquer le constat de référence tout en ne prétendant pas que la totalité des tests historiques est verte.

**Suivi recommandé :** classer ces tests en « attentes à adapter sans changer le logiciel » lors des missions 05/16.

### Navigateurs : observations relevées

- **22/22** captures de consultation publique, y compris la page d'accès admin, réussies.
- **10/10** captures d'administration fictive, sans erreur JavaScript et **sans aucune requête sur la production**, réussies.
- Les captures de la médiathèque concernent les filtres et la présentation des cartes en environnement fictif.
- **20 tentatives de requêtes POST** sur les pages publiques ont été interceptées par la règle de lecture seule (dont de possibles événements de consultation) : **aucune écriture n'est parvenue au site à partir de cet audit**.

## 6. Éléments à ne pas considérer comme des anomalies prouvées

Les captures montrent l'apparence de Chromium à un instant précis. Un texte coupé par la limite de la première fenêtre, des polices de navigateur spécifiques, un contenu succinct après la célébration ou un nombre d'images différent ne sont pas automatiquement des bogues.

La synthèse de cette mission ne doit pas inventer de problème à partir d'une seule capture. Tout problème réel nécessitera une reproduction isolée et un test avant correction.

## 7. Comparaison obligatoire à chaque mission suivante

Avant modification : relever la référence de code, des pages concernées et des parcours fonctionnels.

Après modification, confirmer :

| Zone | Condition de parité |
| --- | --- |
| Navigation publique | Routes, liens et ordre des menus inchangés |
| Navigation admin | Onglets, pages et outils inchangés |
| Textes et médias | Identifiants, URL, contenu publié et fichiers préservés |
| Mise en page | Même disposition et mêmes tailles sur 1280 px et 390 px |
| Mobile | Pas de débordement, commandes accessibles au toucher |
| Médias | Filtre, recherche, prévisualisation, sélection, lecture identiques |
| Édition | Ajout, édition, duplication, suppression, déplacement et annulation fonctionnels |
| Sauvegardes | Brouillon, version publique, conflits 409 et récupération inchangés |
| Publication | Aucune publication involontaire, mêmes autorisations |
| Sécurité | Aucun nouvel accès non autorisé |
| Retour arrière logiciel | Possibilité de restaurer le Worker et son état |

Une différence visuelle ou comportementale **non demandée** signifie : arrêter la réorganisation, analyser, corriger, recommencer le test. Les nouvelles fonctionnalités explicitement décidées par le propriétaire constituent des exceptions documentées.

## 8. Limites et suivi

- L'administration **authentifiée et ses vraies pages** n'a pas été explorée directement en mission 02 : captures avec données fictives et vraie interface. Il faut préserver cette différence dans les futurs comptes rendus.
- Les captures portent sur le premier écran des grandes pages ; elles ne mesurent pas l'intégralité de la longueur du document.
- Les fichiers enregistrés par les utilisateurs peuvent évoluer après la prise de référence ; ne pas interpréter ces modifications normales comme des régressions du code.
- La persistance réelle et la restauration des fichiers D1/R2 relèvent de la **mission 03**.
- Des tests ciblés (déplacements, insertion, modal, save/reload) existent déjà mais n'ont pas été redéployés ou exécutés contre des données réelles pendant cet audit.

## 9. Conclusion / passation

**Mission 02 : référence créée sur le vrai site public, sur l'éditeur isolé et sur les composants de médiathèque fictifs.**

- Aucun changement du site ou des données.
- Deux tests historiques périmés identifiés et consignée.
- Références reproductibles et captures exportées en artefact.
- **Prochaine étape — MISSION 03 : prouver le processus de sauvegarde et de restauration**, sans restaurer, supprimer ou écraser des données réelles pendant la simple vérification.
- **Ne pas démarrer la mission 03 sans l'accord explicite du propriétaire.**
