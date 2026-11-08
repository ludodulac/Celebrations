# 🌸 CÉLÉBRATIONS — MISSION 15
## Nettoyage du code mort uniquement après vérification d'usage

**Date :** 8 novembre 2026. **Branche :** `refactor/celebrations-mission-15-dead-code-audit-20261108` (base M14, PR #94). **Ni fusion ni publication.**

### Portée et méthode
La mission 15 du plan M04 impose de **ne jamais supprimer un fichier historique sur son nom**. L'analyse distingue :
1. les scripts réellement servis par le Worker officiel ou les pages publiques ;
2. les modules d'anciennes versions encore importés par le Worker de staging, les tests, ou utilisés pour les liens historiques ;
3. les fonctions locales qui n'ont plus aucune référence dans le script administrateur après les extractions M05–M14.

Le contrôle a porté sur le code réel de `editor-demo-client.mjs` : repérage des déclarations, comptage des références dans le script généré (y compris les portions de la composition M06), puis suppression **par dépendances**. On a vérifié que chaque suppression n'exposait pas de nouvelles fonctions isolées.

### 8 fonctions inutilisées retirées du navigateur administrateur
| Fonction | Ancien rôle | Motif vérifié |
|---|---|---|
| `attachFile` | Associer un fichier par l'ancien sélecteur | Le vrai sélecteur utilise `chooseFile` et les commandes médias M08 |
| `deleteSelectedImages` | Suppression collective de l'ancien prototype | Aucune invocation ; commandes réelles toujours présentes |
| `historicalUnused` | Calcul d'inutilisation historique | Non appelée ; le catalogue M08 gère les usages |
| `insertBlockAtTime` | Insertion horaire par une vieille boîte | Uniquement appelée par `showInsertDialog` devenue inaccessible |
| `showInsertDialog` | Ancienne fenêtre d'insertion multi-célébrations | Aucune invocation ni bouton public pointant vers elle |
| `attachPublicAudio` | Lien MP3 de l'ancien atelier | Appelée uniquement par `audioWorkbench` morte |
| `attachCloudAudio` | Lien cloud de l'ancien atelier | Appelée uniquement par `audioWorkbench` morte |
| `audioWorkbench` | Ancien écran audio | Aucun appel depuis le rendu actuel |

**8 297 caractères de JavaScript ancien retirés**, sans toucher au code de `chooseFile`, `media`, `cloudAudioUsages`, à la gestion de l'Undo, au glisser-déposer, à la publication, ni aux pages publiques. Après suppression, **aucune fonction de l'ancien script n'apparaît comme déclaration isolée** dans l'analyse des références.

Les tests qui délimitaient une zone de code par `attachFile` ou `audioWorkbench` utilisent désormais les **fonctions vivantes voisines** : `savedPageSets` et `GUIDE_TOPICS`. Les vérifications du comportement ne sont pas supprimées.

### Fichiers historiques volontairement CONSERVÉS
Les modules suivants restent actifs dans des contextes spécifiques et ne doivent pas être effacés :
- `production-worker.mjs`, `staging-worker.mjs` et `legacy-link-router.mjs` : routes et redirections historiques.
- `media-gateway.mjs` et `editor-publication-api.mjs` : anciens fichiers /media, /letter et nouveaux fichiers /media/new ; modèles d'autorisations inchangés.
- `editor-demo-page.mjs` : ancien point d'entrée de prototype encore testé directement, même si le Worker de staging redirige son chemin.
- `editor-e2a-access-recovery.mjs`, `editor-d4-access.mjs`, `editor-permanent-access.mjs`, `editor-e1-api.mjs`, `editor-d-preview.mjs` : ancienne chaîne de staging encore utilisée/testée.
- `editor-server-sync-client.mjs`, `editor-demo-preparation-page.mjs`, `editor-trial-site-page.mjs` et leur entrée publique : servent toujours des fonctionnalités en cours.
- `editor-trial-audio-api.mjs` et `TRIAL_AUDIO_CLIENT` : le service MP3 existant est **distinct** du vieux `audioWorkbench` supprimé et doit rester fonctionnel.

**Aucun fichier `legacy`, `demo`, `trial` ou `preview` n'a été supprimé ni déplacé** faute de preuve d'inutilité générale.

### Garantie de stabilité
- Le code des **12 fichiers essentiels** Worker, staging, publication, brouillons, médias et anciennes pages est contrôlé par son **Git blob SHA d'origine** avant/après.
- Les routes historiques `/__editor/demo`, `/__editor/edit`, les routes de Préparation, le fallback `ASSETS`, les médias récents `/media/new` et les restrictions privées de M14 sont vérifiées.
- Les anciens tests M05–M14 et les parcours Chromium ordinateur/téléphone, fenêtres, liens médias, glisser-déposer et Undo sont rejoués.
- Les styles CSS, la navigation et les contenus visiteurs ne sont pas modifiés.
- Les données D1/R2, les routes Cloudflare et le Worker en production ne sont **pas consultés ni modifiés**.

### Archive et récupération
Les 8 fonctions restent disponibles **à l'octet près** dans l'historique immuable GitHub au commit de base M14 :
`5e0155b3d816f8ac6f2912a1d202955b315bf005`.
Fichier : `migration/cloudflare/editor-demo-client.mjs`.
Documentation de récupération : `docs/archive/CELEBRATIONS-M15-CODE-HISTORIQUE-2026-11-08.md`.

### Réserves de la mission 3
La version exacte du Worker actuel, l'export D1 intégral restaurable, l'inventaire/copie et la récupération des octets médias R2, ainsi qu'une copie de secours indépendante de Cloudflare, restent à certifier. Cette mission **ne publie rien**, et un test de régression vert n'est pas une preuve de restauration réelle.
