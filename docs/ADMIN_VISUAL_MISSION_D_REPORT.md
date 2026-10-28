# CÉLÉBRATIONS — MISSION D — Rendu visuel staging — 28 octobre 2026

## État démontré

- Branche indépendante `feat/celebrations-admin-visual-mission-d` issue du HEAD C `357187753a3a5e2df623bc4445b90ce3ac5ce125`.
- Worker **`celebrations-exit-staging` uniquement**, D1 `0f761662-241f-42cc-ac94-5c68b4aa7797`, bucket `celebrations-exit-staging`. Identifiants effectivement déployés contrôlés.
- **47/47 pages converties affichées HTTP 200** par un prévisualiseur serveur **réservé aux administrateurs**. **0 publication**.
- Prévisualisation : `/__editor/preview?key=<source_key>`. Accès par session administrateur D1 existante (en lecture seule) ou secret ponctuel Cloudflare staging pour tests. Le secret n'apparaît ni dans le dépôt ni dans les journaux.
- Présentation HTML créée de zéro sans interprétation de HTML/JavaScript historiques : échappement HTML, liens HTTP(S)/relatifs filtrés, Content-Security-Policy `script-src 'none'` et `noindex, no-store`.
- Les 3 tables `editor_b_*` et les 2 `editor_c_*` restent inchangées. **Aucune modification de D1 métier ou des objets R2**.

## Capacités implémentées

- Pages d'accueil, célébrations, sept étapes, programme (dates et ordre), rendez-vous, bibliothèque, galeries, pages légales et documents comité.
- Blocs : titres, textes, bandeaux, boutons, liens, contenus historiques typés, médias image/PDF/audio/vidéo, vignettes existantes, références à documents, pages statiques en extraction plaintext uniquement.
- Les blocs historiques complexes restent des références structurées : aucun fichier ou contenu historique n'a été dupliqué.
- Les contenus avec `audience != all` sont identifiés **mais leurs octets ne sont pas exposés** par le nouveau prévisualiseur public ; la passerelle R2 existante garde le contrôle de chaque requête. PDF comité : noms visibles uniquement en prévisualisation admin, pas de lien public ajouté.
- Un import D (nouvelle table) n'a pas été nécessaire ; le moteur lit directement les blocs C non publiés.

## Preuves GitHub Actions et captures réelles

Dernière exécution **SUCCESS** : https://github.com/ludodulac/Celebrations/actions/runs/40784287117

- Tests Node SQLite fictifs : **5 PASS, 0 FAIL**, incluant B/C/D, sécurité du rendu, échappement des scripts historiques, PDF et média réservé.
- Tests HTTP directs du Worker staging : **47/47 pages affichables** ; prévisualisation sans autorisation refusée HTTP 401 ; écriture anonyme refusée ; administration existante toujours HTTP 200.
- Chromium/Playwright réel en profil ordinateur `1366×768` et téléphone `390×844` : **34 captures écran en mémoire** (non téléversées dans GitHub public pour préserver la confidentialité des brouillons), **7 étapes** sur chacun des deux écrans et **5 comparaisons ancienne/nouvelle page par appareil**.
- Les 10 comparaisons d'écran utilisent l'ancienne interface du **staging**, pas le domaine public officiel (ce dernier n'a pas été modifié).
- Écart absolu RGB moyen (échelle 0–255) constaté : **19,8 à 66,6** selon les scènes. Exemples : accueil ordinateur **55,5**, accueil mobile **66,6**, programme mercredi ordinateur **26,6**, programme mercredi mobile **49,1**, page légale ordinateur **19,8**.
- **Aucune certification de parité pixel à pixel** ; les différences de présentation restent substantielles, surtout accueil et mobile. La comparaison était automatisée à partir des images, pas une revue humaine des captures originales.
- Le vrai Worker staging a été testé en **prévisualisation authentifiée par secret de test isolé**, sans utiliser un compte réel, et **sans création de session administrateur D1**. La connexion normale Romain/administrateur reste à valider séparément.
- Quota D1 dernier contrôle : **241 511 lectures / 1 872 écritures** au niveau compte (mesures différées), largement dans les seuils.

## Écarts encore ouverts — NE PAS ANNONCER UN RENDU IDENTIQUE

- Les styles et placements réels (notamment accueil, bandeaux, galerie mobile et navigation originale) ne sont pas reproduits à l'identique ; un contrôle visuel humain est nécessaire.
- Les pages statiques HTML sont lues comme texte sûr, pas comme structures complexes fidèles : elles réclament un constructeur de blocs de mise en page.
- Les contenus réservés ne sont pas intégrés en lecteur multimédia dans ce prévisualiseur sécurisé : le propriétaire doit conserver les règles ACL sans contourner la passerelle historique.
- Liens externes vidéo et PDF fournis selon le type/média historique ; tous les fichiers réels ne font pas encore l'objet d'une validation individuelle d'accessibilité binaire (des lacunes anciennes peuvent rester présentes).
- L'interface de navigation repose sur des liens et des URLs de prévisualisation ; l'édition visuelle complète et la connexion administrateur interactive relèvent de la suite.
- **Les 47 pages restent des brouillons**. La publication des imports est toujours bloquée côté API B.

## Protection / arrêté

Aucune route publique officielle remplacée ; aucun DNS, Worker de production, base D1 ou fichier R2 de production modifié ; aucun ancien lien PDF ou ancienne administration modifié. Les captures privées n'ont pas été publiées dans un dépôt public.

### Recommandation

**Mission D : fondation de rendu et contrôles navigateur réussis, fidélité visuelle non encore certifiée.** Grand-père doit décider d'une passe ciblée de correction du rendu, notamment accueil/mobile, **avant** d'autoriser l'édition complète (mission E). Aucune mission E commencée.
