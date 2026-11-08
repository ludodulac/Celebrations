# 🌸 CÉLÉBRATIONS — MISSION 13
## CSS administrateur et visiteurs : décomposition à cascade identique

**Date :** 8 novembre 2026. **Branche :** `refactor/celebrations-mission-13-css-modules-20261108` dérivée de la mission 12 / PR #92. **Aucune publication.**

### Constats avant modification
- `editor-demo-style.mjs` contenait **96 864 caractères** de CSS d'administration sous forme d'une très longue chaîne (1 576 lignes) et au moins **338 occurrences de `!important`**.
- `editor-trial-site-client.mjs` mélangeait le code du rendu public et **27 406 caractères** de CSS visiteurs (427 lignes, 28 occurrences de `!important`).
- `editor-demo-preparation-page.mjs` possédait encore un **style de grille de 390 caractères construit directement dans une ligne HTML**.
- Des sélecteurs apparaissent plusieurs fois après ajouts successifs : certaines occurrences sont des corrections compatibles, d'autres des surcharges intentionnelles selon la taille de l'écran. Les supprimer automatiquement modifierait la cascade et risquerait de casser des modales, le menu mobile, ou la validation de blocs.

### Travail réalisé
- Séparer l'administration en **8 fichiers de styles** : fondations, outils de blocs, thèmes/pages/médias, composition des sections, guide/publication, médiathèques/modales, glisser-déposer/ressources, derniers réglages des colonnes.
- Séparer le site public en **6 fichiers de styles** : fondations, navigation/médiathèque, typographie/galerie, colonnes et séparateurs, présentations médias/documents, cartes responsive des célébrations.
- Centraliser l'assemblage dans `app/styles/admin/style.mjs` et `app/styles/public/style.mjs`, avec imports statiques ESM et **concaténation dans l'ordre d'origine**.
- Isoler la grille spécifique de préparation dans `app/styles/admin/stage-layout.mjs`, **en conservant le second élément `<style nonce="…">` à la même place dans le HTML**.
- Conserver les imports de compatibilité `DEMO_CSS` et `TRIAL_SITE_STYLE`, les mêmes selectors, variables, breakpoints et `!important`.
- Aucun CSS n'est demandé via le réseau, aucune URL ou nom de classe n'est changé. Aucun contenu réel, Worker, R2 ou D1 modifié.

### Contrats de non-régression CSS, octet pour octet
| Surface | Longueur d'origine | FNV-1a 64-bit d'origine |
|---|---:|---|
| Administration | 96 864 | `fbb9a8bb3172d2e1` |
| Visiteurs | 27 406 | `072384896a5db2c8` |
| Surcharge de la page Préparation | 390 | `fe3d99292c8b8b54` |

Ces empreintes vérifiées par les tests sont celles **du CSS avant mission 13**. L'affichage et l'ordre de spécificité sont donc préservés sans effectuer de suppressions visuelles hasardeuses. Les 47 groupes `@media` admin et les 16 groupes visiteurs sont conservés.

### Vérifications à exécuter
1. Tous les modules réassemblent exactement les anciennes chaînes CSS ; émission du CSS octet pour octet dans le HTML du véritable gestionnaire de pages avec le même nonce CSP.
2. Régressions M05–M12 : enregistrement, pages et médias, visibilités, déplacements et Undo.
3. Captures Chromium à 1280/390 px dans les pages admin et visiteurs.
4. Contrôle des fenêtres modales : taille dans l'écran, superposition réelle au-dessus des blocs/boutons, fermeture ESC, aucun débordement horizontal.
5. Écran visiteurs : colonnes équilibrées sur ordinateur et présentation responsive sur téléphone.
6. Ne pas interpréter la présence d'un workflow comme une réussite : seul le résultat Actions compte.

### Limites
Il ne serait pas responsable de supprimer les sélecteurs dupliqués ni les 338 déclarations forcées **sans test visuel différentiel ciblé pour chaque famille de règles**. Cette mission supprime l'entassement *dans les fichiers source* et cartographie précisément les couches de styles, mais **ne prétend pas optimiser ni minifier le CSS**. Cela pourra être fait dans une passe distincte avant publication si souhaité.

Les réserves critiques M03 — rollback exact du Worker, sauvegarde restaurable D1, inventaire et récupération des octets R2, copie indépendante — **restent ouvertes**. Ne pas fusionner la PR ni déployer sans ces garanties et l'accord du propriétaire.


## Validation finale M13 — exécutée le 8 novembre 2026

**[GitHub Actions M13 n°42463199933](https://github.com/ludodulac/Celebrations/actions/runs/42463199933) : SUCCESS**, à la révision de code `04d1c55f0532a1840a8786354a6d57754f217fac`.

- **163 tests Node réussis, 0 échec, 0 ignoré**. Ils contrôlent l'identité
  caractère par caractère des couches recomposées via les empreintes CSS
  d'origine, l'ordre des styles, les nonces CSP et les tests M05–M12.
- **10 vues de référence Chromium réussies** pour l'administration :
  5 ordinateur + 5 téléphone, **0 échec, 0 erreur JS, 0 requête de
  production**.
- **Sélecteur image/PDF/vidéo PASS** à 1280 et 390 px.
- **Déplacements et Undo PASS** dans le véritable navigateur (M11).
- **Site visiteurs PASS** à 1280 et 390 px : double colonne, photo à 55 %,
  titre sous vidéo, PDF, séparateur et protection des brouillons (M12).
- **Nouveau test M13 PASS** à 1280×840 et 390×844 : les trois familles
  de fenêtres (image, fichier et insertion) tiennent entièrement dans
  l'écran, sont **au premier plan pour le pointeur**, restent
  accessibles, se ferment avec **Échap**, sans défilement horizontal.
  Les deux colonnes publiques sont côte à côte sur ordinateur,
  puis empilées verticalement sur téléphone ; titre vidéo à 14 px.
- **8 captures Chromium spécifiques à M13** conservées comme artefact
  temporaire : 3 fenêtres par format (6 captures) et 1 rendu visiteur
  par format (2 captures). Ces images restent consultables dans
  les artefacts de l'exécution Actions et sont complémentaires
  au contrôle d'identité du CSS.

**Important :** les trois empreintes du CSS initial n'ont pas changé
et aucun sélecteur dupliqué ou `!important` n'a été supprimé :
c'est un refactoring source, pas une refonte graphique ni une
certification manuelle pixel à pixel. Une validation finale sur
téléphones réels, sur les contenus authentiques et des sauvegardes
restaurables reste nécessaire avant une publication.

**Aucun déploiement ou fusion. PR n°93 conservée en DRAFT.**
