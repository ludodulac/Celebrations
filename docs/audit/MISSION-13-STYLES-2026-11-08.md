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
