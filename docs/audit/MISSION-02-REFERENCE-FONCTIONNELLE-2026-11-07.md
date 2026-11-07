# CÉLÉBRATIONS — MISSION 02
## Référence fonctionnelle et visuelle avant réorganisation du logiciel

**Date :** 7 novembre 2026  
**Statut :** référence enregistrée ; mission de conservation de l'existant terminée avec réserves explicites.  
**Site officiel observé :** https://ronde-des-archanges-universelle.eu  
**Branche officielle figée pour comparaison :** `fix/celebrations-inline-validation-20261105`, commit `7cbfdbd79e2b40f8f4ca4b46dbc97d47e26b742d`.  
**Branche de travail d'audit :** `audit/celebrations-mission-02-reference-20261107`.  
**GitHub Actions, dernier contrôle complet :** exécution `42371363803` (conclusion `success`), artifact `celebrations-mission02-references-6`, conservation CI 30 jours.

## 1. Objet et protection des contenus

Figer l'**expérience actuelle**, avant les opérations de refactorisation prévues à partir des missions 04–13, afin qu'une fonction interne puisse changer sans que l'utilisateur ou l'administrateur voie de différence.

Le contrôle est **sans modification du logiciel officiel** :

- La navigation réelle des visiteurs n'utilise que GET/HEAD. Les autres méthodes sont interceptées et refusées dans Chromium.
- L'administration derrière accès n'a pas été ouverte avec un vrai mot de passe. Seul l'écran de connexion a été observé sur le domaine réel.
- L'éditeur est exécuté à partir du **vrai code du dépôt** et de **données D1 fictives en mémoire**, dans un navigateur isolé. Les API de brouillon, publication et médiathèque sont simulées. Aucune donnée de célébration réelle n'est écrite.
- Le contenu privé des brouillons réels n'a pas été copié dans cet audit.
- Les captures d'écran de référence sont conservées temporairement en **artifact GitHub Actions**, et non dans le dépôt principal ni sur le site public.

## 2. Résultats effectifs du contrôle

| Contrôle | Résultat | Portée |
| --- | --- | --- |
| Suite automatisée actuelle, hors ancien fichier de staging | **71 tests / 71 réussis** | Fonctions déjà couvertes par les tests unitaires et d'intégration. |
| Page publique officielle, ordinateur 1280 × 840 | **11/11 parcours réussis** | 10 vues publiques + écran de connexion non authentifié. |
| Page publique officielle, téléphone 390 × 844 | **11/11 parcours réussis** | Les mêmes vues et écran de connexion. |
| Navigation menu visiteurs | **OK sur les deux formats** | Accueil → Célébrations → Médiathèque générale → pages supplémentaires ; menu sous le hamburger. |
| Grille des célébrations | **OK** | 4 colonnes ordinateur, 2 téléphone. |
| Parcours éditeur représentatif, sur données fictives | **10/10 vues vérifiées** | Navigation, mercredi, aperçu, pages générales, médiathèque (5 par format). |
| Fenêtre de sélection des fichiers, sur données fictives | **8 captures et tests réussis** | Tous, Images, Vidéos, PDF sur téléphone et ordinateur, sans quitter la page. |
| Vérification des fichiers privés | **Non réalisée** | Aucun contenu utilisateur privé n'est exporté. |
| Accès authentifié en production, sauvegarde et publication réelles | **Non réalisés volontairement** | Éviter toute modification des pages ou des brouillons de l'utilisateur. |
| Ancien test de démonstration staging `tests/test-editor-demo-preparation.mjs` | **2 assertions échouent / 3, séparées** | Attend une ancienne image de staging et un rejet du domaine officiel devenu inexact. Voir §6. |

**Aucune de ces vérifications ne prouve l'absence de tous les bugs possibles.** Elles constituent la photographie de départ et une grille de non-régression documentée.

## 3. Référence publique observée

Les dix parcours suivants ont été capturés en format ordinateur et téléphone, avec pour chaque page : route, hauteur et largeur de fenêtre, débordement éventuel, nombre d'images, lecteurs, onglets et volume de texte visible.

| Vue | Route observée | Images observées | Remarque |
| --- | --- | ---: | --- |
| Accueil | `/` | 1 | Menu, bannière et page d'accueil. |
| Célébrations | `/?page=celebrations` | 0 | Grille par Archange. |
| Médiathèque générale | `/?page=mediatheque-generale` | 26 | Galerie du site public. |
| Préparation | `/preparation/` | 14 | Étape historique. |
| Mercredi | `/mercredi/` | 13 | Étape historique à conserver sans réécriture. |
| Jeudi | `/jeudi/` | 10 | Étape historique. |
| Vendredi | `/vendredi/` | 5 | Étape historique. |
| Samedi | `/samedi/` | 4 | Étape historique. |
| Dimanche | `/dimanche/` | 4 | Étape historique. |
| Après célébration | `/apres-celebration/` | 0 | Seulement 53 caractères de texte visibles dans la référence : ce n'est pas forcément un bug, ne rien ajouter automatiquement. |

Les 8 onglets de la célébration sont présents dans les captures de chacune de ces pages. Les ouvertures publiques n'ont révélé aucun débordement horizontal dans les deux formats ciblés.

L'accès administrateur non connecté est protégé : l'écran de connexion est présenté et l'atelier d'édition n'est pas visible sans code.

## 4. Référence administrateur isolée

L'éditeur réel est rendu par `handlePreparationDemo` avec une **célébration Michaël fictive**, des événements et médias de démonstration.

Pour chaque format, cinq vues sont capturées :

1. Écran Célébrations, avec navigation et commandes globales.
2. Page Mercredi, avec blocs et commandes d'insertion.
3. Aperçu du brouillon, sans publication.
4. Écran des Pages générales.
5. Médiathèque globale et ses catégories.

Les boutons d'édition, notamment **Enregistrer**, **Aperçu** et **↶ Annuler**, sont observés. Les contrôles de pages sont présents. Le navigateur de référence ne valide pas la publication réelle ; il valide la **présence et la disposition des fonctions de l'interface**.

L'éditeur de test n'a émis aucune écriture vers les API du site officiel ni aucune requête vers un domaine de production.

## 5. Fenêtres des fichiers

Le script de référence `scripts/mission02-media-picker-reference-browser.mjs` utilise le vrai composant de sélection et le CSS du dépôt, avec fichiers **strictement fictifs**.

À 1280 et 390 pixels, il vérifie et capture :

- Liste « Tous les fichiers » avec titres et icônes lisibles.
- Galerie Images avec vignettes affichées.
- Catégorie Vidéos.
- Catégorie PDF.

Les contrôles de base proviennent du script existant de tests de médiathèque ; l'audit ajoute les captures, sans modifier l'application.

## 6. Incohérences DÉJÀ PRÉSENTES dans un test ancien

Le fichier `tests/test-editor-demo-preparation.mjs` échoue sur deux assertions quand on le lance contre le code actuel :

- Il exige le nom d'une ancienne illustration `celebrations-staging-welcome-autumn-2026.jpg` dans le contenu initial de la page ; ce détail ne correspond plus à l'image actuellement attendue.
- Il attend que la fonction de démonstration retourne 404 pour le domaine `www.ronde-des-archanges-universelle.eu`, tandis que l'implémentation actuelle l'accepte.

**Interprétation :** incompatibilités entre certaines attentes historiques et le code courant, non une preuve d'une panne sur le site public. Nous ne les avons **ni dissimulées ni modifiées** : ce test est exécuté et signalé séparément. Leur correction ou reclassement devra être étudié en mission 16.

## 7. Contrat de non-régression pour les missions suivantes

Les améliorations internes ne doivent changer **aucun** des comportements suivants sans demande explicite :

- **Visiteurs :** ordre Accueil → Célébrations → Médiathèque générale → nouvelles pages ; menu hamburger sous son bouton ; 4 cartes par ligne sur ordinateur, 2 sur téléphone ; traits colorés Michaël/Gabriel/Raphaël/Ouriel ; 8 étapes ; lecteurs, titres, liens, fichiers, couleurs et alignements.
- **Administrateur :** mêmes menus, boutons, textes, ouvertures de fenêtres ; ajout et déplacement des blocs ; retour Ctrl+Z et bouton ↶ mobile ; choix d'un PDF/audio/image/vidéo depuis la médiathèque ; titre vidéo sous lecteur ; aperçu non publié.
- **Sauvegardes :** mêmes opérations Enregistrer, publication explicite pour une nouvelle page, statuts vert/orange, conflits de révision, refus d'écraser des données privées.
- **Patrimoine :** mêmes identifiants des célébrations/pages, contenu historique, fichiers R2, URL et liens anciens.
- **Sécurité :** accès réservé et absence d'affichage des brouillons aux visiteurs.

**Méthode de vérification future :** rejouer les scripts de Mission 02 sur la **version candidate** après chaque mission interne, comparer les métriques et les captures avec celles d'avant, puis investiguer les écarts. Ne pas définir un écart comme « acceptable » sans explication et validation.

## 8. Ce que la référence ne couvre pas encore

- Édition authentifiée du véritable compte de l'utilisateur : la mission l'évite pour protéger les données. Les parcours fonctionnels admin sont vérifiés sur un double **isolé**.
- Toutes les associations de célébrations et toutes les éventuelles pages privées : seules les routes publiques listées et une célébration fictive sont couvertes.
- Séquences de drag-and-drop longues, panne de réseau pendant une véritable publication, synchronisation de plusieurs téléphones : tests ciblés existants, mais non reproduits ici avec données réelles.
- La confirmation visuelle de chaque capture par le propriétaire : les captures constituent la preuve technique et peuvent être consultées avant tout changement substantiel.
- Les situations hors des deux tailles choisies (390px / 1280px) devront continuer d'être couvertes par les tests responsive existants.

Ces lacunes sont des **limites de périmètre**, pas des tests réussis.

## 9. Fichiers et preuves

**Scripts ajoutés pour cet audit seulement :**
- `scripts/mission02-public-reference-browser.mjs`
- `scripts/mission02-editor-reference-browser.mjs`
- `scripts/mission02-media-picker-reference-browser.mjs`
- `.github/workflows/celebrations-mission02-reference.yml`

**Rapports produits par le contrôle :**
- `artifacts/mission02/public/reference-public.json`
- `artifacts/mission02/editor-fixture/reference-editor-fixture.json`
- `artifacts/mission02/media-picker-fixture/reference-media-picker.json`

**Captures :** 24 images du site public et de son écran d'accès (dont deux vues du menu), 10 images de l'éditeur fictif, 8 images des sélecteurs de fichiers — **42 captures au total**.

**Run de référence :** `https://github.com/ludodulac/Celebrations/actions/runs/42371363803`  
**Artifact de preuve :** `celebrations-mission02-references-6` (rétention 30 jours, renouvelable en relançant le même audit).  
**Convention de sauvegarde :** l'artifact est une archive de contrôle temporaire, **pas** une sauvegarde de la base ou des médias de production.

## 10. Décision et passage de relais

**MISSION 02 : RÉFÉRENCE FONCTIONNELLE CONSTITUÉE, AVEC LIMITES DOCUMENTÉES.**

- Aucune fonctionnalité, page, fichier utilisateur, base de données, Worker, domaine ou sauvegarde réelle modifié.
- Les tests actuellement pertinents exécutés dans ce run passent ; les deux attentes historiquement périmées restent explicitement signalées.
- La référence est maintenant suffisante pour comparer les **surfaces recensées** pendant les futures missions de réorganisation.
- **La mission 03**, distincte, devra démontrer une stratégie réelle de sauvegarde et restauration des états serveur, **sans effectuer de restauration de production à l'aveugle**.
- Ne démarrer la mission 03 que sur instruction de l'utilisateur. Ne pas fusionner ou déployer cette branche d'audit vers le site officiel.
