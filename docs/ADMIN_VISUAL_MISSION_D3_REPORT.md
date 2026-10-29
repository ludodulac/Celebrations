# CÉLÉBRATIONS — MISSION D3 — image et prévisualisation — 29 octobre 2026

## Diagnostic précis
Le seul visuel cassé sur la page mercredi correspondait à la couverture du document public « Programme RA Universelle Michaël AN23 », contenu historique `guide-file-30`. Son indicateur `has_cover=1`, mais le champ historique `cover_storage_path` désigne **une URL Google Drive de consultation**, et non une clé d'objet du bucket R2. Le moteur D2 essayait de traiter cette URL comme une clé R2 via `/__editor/media?id=guide-file-30&cover=1`. Le serveur répondait HTTP 404 `invalid_or_forbidden_key` : **erreur de représentation d'une référence externe**, non preuve de disparition du document original. Métadonnées confirmées par requête D1 en lecture seule et sonde du Worker staging (actions 40820552577 et 40820924430).

## Correction minimale
Le moteur reconnaît les couvertures R2 valides, sans toucher aux contenus. Quand la couverture historique est une URL HTTPS externe (comme Google Drive), il n'émet plus une fausse balise `img` vers R2 : il fournit un **lien explicite vers la couverture d'origine**, à ouvrir selon les droits d'accès Google Drive existants. La référence PDF R2 du document reste conservée, avec son bouton de consultation dans la prévisualisation privée. La couverture Google Drive n'est **pas intégrée en image**, car aucune image R2 correspondante n'a été identifiée et aucune exposition publique ne serait justifiée. Aucune copie ni substitution arbitraire.

La route temporaire de diagnostic R2/ACL D3 a été **retirée** une fois la cause confirmée ; le médiateur R2 admin de D2 conserve ses restrictions d'accès.

## Vérifications réelles
- [CI D3 définitive #40821121337 — SUCCESS](https://github.com/ludodulac/Celebrations/actions/runs/40821121337).
- 7/7 tests synthétiques réussis, dont régression de l'URL de couverture externe et conservation du lien PDF.
- Worker staging : **47/47 pages brouillon affichables uniquement aux personnes autorisées**, administration historique HTTP 200, visiteur anonyme 401, 0 publication.
- Chromium 1366×768 et 390×844 : **38 captures privées conservées en mémoire, jamais dans un dépôt public** ; **12 comparaisons** couvrant accueil général, accueil d'une célébration, mercredi, médiathèque, un lot de galerie et mentions légales.
- **0 image cassée / 0 débordement horizontal** sur les écrans représentatifs contrôlés (mercredi : 10 images sans erreur sur chaque appareil ; lien original présent). CTA et 7 étapes conservés ; navigation réelle réussie (2/2 clics).
- Un PDF échantillon de la médiathèque renvoyait HTTP 200 `application/pdf`, sans prétendre avoir vérifié individuellement tous les documents, notamment `guide-file-30`.
- Dernier contrôle D1 du 29/10/2026 05:06 UTC : 23696 lectures / 5M, 26 écritures / 100k sur le compte ; réserve suffisante.
- Les comparaisons ont été faites contre les écrans **de l'ancienne interface staging**, avec analyse DOM et écarts visuels; les différences de composition résiduelles sont tolérées pour usage prévisualisation. **Aucune validation humaine de Ludo ou Romain**, et aucune correspondance pixel à pixel, n'est revendiquée.

## Prévisualisation sans GitHub
1. Dans **le navigateur de Ludo**, ouvrir `https://celebrations-exit-staging.rondes.workers.dev/admin.html?staging=1` et se connecter à la **staging** avec un accès administrateur existant.
2. Dans **le même navigateur**, ouvrir `https://celebrations-exit-staging.rondes.workers.dev/__editor/entry` : la session administrateur existante donne accès à une prévisualisation protégée (cookie HttpOnly à durée courte). Si le compte n'est pas connecté, l'écran renvoie vers la connexion staging.

Aucun logiciel ni compte GitHub requis. L'URL de prévisualisation seule ne permet pas de lire les brouillons sans session autorisée.

## Réserves et arrêt
Les images du mercredi sont désormais représentées sans erreur de chargement, mais **la couverture du document n'est disponible que par son lien Google Drive**, selon ses permissions existantes. La fidélité complète des pages statiques complexes et la validation humaine ne sont pas certifiées. La connexion de Romain depuis son propre navigateur n'a pas été testée.
Les cinq tables `editor_b_*` / `editor_c_*`, les 47 brouillons, les ACL du comité, les fichiers et la production sont inchangés. Aucun DNS, aucune suppression, aucune publication, aucune fusion. **D3 s'arrête ici; mission E non commencée.**
