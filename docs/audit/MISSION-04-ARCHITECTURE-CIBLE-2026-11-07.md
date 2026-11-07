# CÉLÉBRATIONS — MISSION 04
## Architecture cible définitive, contrats et plan de transition sans changement visible

**Date :** 7 novembre 2026  
**Statut :** DÉCISIONS DE CONCEPTION — AUCUNE IMPLÉMENTATION DU LOGICIEL  
**Dépôt :** `ludodulac/Celebrations`  
**Branche de travail :** `design/celebrations-mission-04-architecture-20261107`  
**Base :** `audit/celebrations-mission-03-backups-20261107`  
**Référence fonctionnelle :** Mission 02, commit officiel `7cbfdbd79e2b40f8f4ca4b46dbc97d47e26b742d`.  
**Autorisations :** dessin de l'architecture uniquement ; aucun changement du site, des données, du Worker ou des workflows de production.

> **Règle non négociable :** le visiteur et l'administrateur doivent retrouver exactement la même interface, les mêmes URL, les mêmes opérations, les mêmes pages et les mêmes fichiers. La refonte concerne exclusivement les composants internes, sans réinitialisation des pages. Ce document n'autorise pas les missions suivantes ni une publication.

---

## 1 — Décision architecturale

**AD-04-01 : monolithe modulaire progressif, pas de réécriture complète, pas de nouveau service.**

Le site reste une **seule application Cloudflare Worker** avec ses composants D1, R2, ses anciens chemins et son domaine actuel. On transforme progressivement l'éditeur et le rendu public en modules JavaScript explicites, testables et composables. On ne crée ni deuxième interface utilisateur, ni nouveau backend, ni nouvelle base « propre » à laquelle migrer les utilisateurs.

**À conserver sans modification visible :**

- Entrée HTTP `migration/cloudflare/production-worker.mjs`, domaines officiels et chemins historiques.
- Pages visiteurs et ordre du menu : Accueil → Célébrations → Médiathèque générale → pages supplémentaires ; cartes par quatre sur ordinateur et deux sur mobile ; traits rouge/indigo/vert/jaune par Archange.
- Administration, onglets, barre d'outils, tailles, boutons +, titres, miniatures, médiathèques, insertion et déplacement, Undo, aperçu, responsive.
- Comportements existants d'Enregistrer et Publier : une page nouvelle ne devient pas publique sans publication, et les pages déjà publiées suivent leurs règles actuelles.
- Les chemins `/media/`, `/letter/`, `/media/new/`, les identifiants et les métadonnées déjà diffusées.
- La compatibilité avec les états localStorage encore présents chez les utilisateurs.

**À interdire :** changer des noms de fonctions/clé stockée/URL ou des formats persistés par simple opportunité de nettoyage ; tout changement de schéma relève d'une migration séparée, sauvegardée, testée et explicitement autorisée.

## 2 — Composants cibles et frontières des responsabilités

Dossiers **proposés**, non encore créés. Le nom `migration/cloudflare` reste pour éviter une relocalisation globale de bundling durant les premiers chantiers.

```text
migration/cloudflare/
├─ production-worker.mjs                 [EXISTANT, routeur public préservé]
├─ editor-demo-preparation-page.mjs      [EXISTANT, devient composition minimale]
├─ editor-trial-site-page.mjs            [EXISTANT, devient composition minimale]
├─ editor-server-draft-api.mjs           [EXISTANT, adaptateur HTTP mince à terme]
├─ editor-publication-api.mjs            [EXISTANT, adaptateur HTTP mince à terme]
├─ editor-site-access.mjs                [EXISTANT, autorité d'accès]
├─ editor/
│  ├─ boot.mjs                           [NOUVEAU, assemblage de l'éditeur]
│  ├─ state.mjs                          [NOUVEAU, état en mémoire / sélection]
│  ├─ commands.mjs                       [NOUVEAU, actions déterministes]
│  ├─ undo.mjs                           [NOUVEAU, historique local borné]
│  ├─ pages.mjs                          [NOUVEAU, édition et navigation pages]
│  ├─ blocks.mjs                         [NOUVEAU, blocs / sections / colonnes]
│  ├─ drag-drop.mjs                      [NOUVEAU, déplacements]
│  ├─ dialogs.mjs                        [NOUVEAU, fenêtres, validations, aperçu]
│  ├─ media-picker.mjs                   [NOUVEAU, choix images/audio/vidéo/PDF]
│  ├─ render.mjs                         [NOUVEAU, DOM de l'éditeur]
│  ├─ styles.mjs                         [NOUVEAU, feuille consolidée par zones]
│  └─ local-drafts.mjs                   [NOUVEAU, stockage local compatible]
├─ shared/
│  ├─ document-model.mjs                 [NOUVEAU, structure pages/blocs]
│  ├─ validators.mjs                     [NOUVEAU, validation données non destructive]
│  ├─ media-catalogue.mjs               [NOUVEAU, index / types / URL]
│  ├─ routes.mjs                         [NOUVEAU, routes et slugs canoniques]
│  └─ publication-rules.mjs             [NOUVEAU, états public/brouillon/masqué]
├─ persistence/
│  ├─ editor-repository.mjs              [NOUVEAU, lecture/écriture conditionnelle R2]
│  ├─ historical-reader.mjs              [NOUVEAU, lecture des tables D1 existantes]
│  └─ media-store.mjs                    [NOUVEAU, anciennes / nouvelles clés R2]
├─ visitor/
│  ├─ boot.mjs                           [NOUVEAU, chargement de la vue publique]
│  ├─ navigation.mjs                     [NOUVEAU, menu et choix de célébration]
│  ├─ render.mjs                         [NOUVEAU, affichage public des contenus]
│  ├─ media.mjs                          [NOUVEAU, lecteurs et galerie]
│  └─ styles.mjs                         [NOUVEAU, CSS public conservé]
└─ compat/
   ├─ legacy-page-adapter.mjs            [NOUVEAU, interprète anciens blocs]
   └─ legacy-url-adapter.mjs             [NOUVEAU, respecte chemins anciens]
```

**Le schéma ci-dessus décrit l'organisation finale visée, pas un impératif de créer immédiatement 25 petits fichiers.** Une fonction peut rester regroupée si la cohésion, les tests et la maintenance s'en trouvent améliorés. Les noms seront figés au moment de chaque extraction, après les tests de parité. Les points d'entrée historiques restent présents jusqu'à preuve de leur compatibilité.

## 3 — Graphe de dépendances autorisé

```text
production-worker (routage et adaptation HTTP)
    │
    ├─ editor host HTML ──> editor/boot ──> editor UI / commands
    │                                    │
    │                                    └─ shared/model + validators
    │
    ├─ visitor host HTML ─> visitor/boot ─> visitor UI / navigation
    │                                    │
    │                                    └─ shared/model + public rules
    │
    ├─ editor API ──> application publication / draft ──> persistence R2 / D1
    │                         │
    │                         └─ shared/validators + publication-rules
    │
    └─ anciens API/ressources ──> compat + historique préservé
```

**Règles :**
1. `editor/*` peut dépendre de `shared/*` et d'un adaptateur client HTTP, **jamais** d'un secret serveur, du SDK R2 ou des modules API Cloudflare.
2. `visitor/*` n'importe **jamais** l'état de brouillon, Undo, la session admin, un composant d'éditeur ni un stockage privé.
3. `shared/*` contient des fonctions **pures** : pas d'accès au DOM, `localStorage`, `fetch`, R2, D1, accès réseau ni lecture des secrets.
4. `persistence/*` n'a aucun accès à l'interface ; les appels sont commandés par les handlers API après authentification.
5. Les handlers HTTP ne portent pas la logique d'édition ni les règles métier dispersées ; ils valident l'accès, délèguent, puis forment les réponses HTTP.
6. `compat/*` traduit les anciennes formes à la frontière du système ; ne modifie jamais durablement le JSON d'origine par simple lecture.
7. Interdiction de cycles d'import et de « rustines » par `.replace('function ...', '...')` sur du code exécuté.
8. Les importations de `shared` vers `editor`, `visitor` ou `persistence` sont interdites.

## 4 — Contrats techniques minimaux

Ce sont des **API cibles indicatives à typer/tester**, pas des fonctions prétendument présentes aujourd'hui.

### 4.1 Modèle documentaire — `shared/document-model.mjs`

```js
// Ne pas réécrire en masse les objets existants.
normalizeForRead(rawSnapshot)  // vue en mémoire; sans altérer rawSnapshot
getCelebrationPages(snapshot, celebrationId)
getGeneralPages(snapshot)
getPageById(pages, pageId)
walkBlocks(pageBlocks)         // sections et colonnes, sans réordonner
```

Conserver les IDs, les blocs inconnus et les champs non reconnus (`forward compatibility`). Les types connus de blocs incluent texte, titre, image, vidéo, audio, bouton, séparation et section. Le format actuellement persisté reste l'autorité.

### 4.2 Commandes d'éditeur — `editor/commands.mjs`

```js
applyCommand(document, command) -> {
  nextDocument,
  undoRecord,
  changedIds
}
```

Actions minimales : créer/supprimer/déplacer page, insérer/supprimer/déplacer bloc, déplacer entre colonnes, modifier texte/lien/miniature, modifier présentation. Une opération invalide doit échouer **sans** mutation partielle. L'ordre des blocs est préservé et testable. Une commande ne doit pas lancer de publication réseau.

### 4.3 Undo — `editor/undo.mjs`

```js
history.record(preState, postState, commandKind)
history.undo() -> state | null
history.canUndo() -> boolean
history.resetAfterExternalStateChange()
```

Historique **local et borné** conservant le Ctrl+Z hors champ de saisie et la flèche ↶ sur mobile ; le Ctrl+Z natif des champs texte reste disponible. La publication et les réponses serveur ne sont **pas** des commandes annulables localement. Garder la sémantique visible actuelle avant d'optimiser le stockage des états.

### 4.4 Médias — `shared/media-catalogue.mjs` et `editor/media-picker.mjs`

```js
classifyMedia(record) -> images | pdf | audios | videos | autres
listMedia(catalogue, {category, search})
resolveSelectedMedia(record) -> {src, kind, name}
```

Une URL historique reste valide ; une ressource `/media/new/` conserve sa clé R2. Le sélecteur de vidéo ne retourne que des vidéos et produit un **bloc vidéo**, jamais un bouton déguisé. Les titres restent des textes de présentation sous les vidéos. Le catalogue est une vue de métadonnées ; les fichiers eux-mêmes restent dans R2.

### 4.5 Sauvegarde et publication — API externe inchangée

- `GET/POST /api/editor-open-draft` : chargement et enregistrement des états partagés.
- `POST /api/editor-publication` : publication / masquage explicites selon contrat existant.
- `/api/editor-media` et `/media/new/` : index et fichiers.
- `/api/editor-access` et accès administrateur existants : inchangés.

**Modèle actuel à préserver :** un JSON R2 `editor-trials/server-drafts-v1.json` qui contient au minimum `version`, `drafts`, `shared`, `published` et le catalogue des médias ; les objets futurs doivent maintenir les champs inconnus.

**Protection de concurrence :** lecture de la version + ETag, écriture conditionnelle, réponse **409** en cas de conflit. Aucune écriture automatique forcée ne doit contourner cette barrière. Définir des adaptateurs `readSnapshot()`, `saveDraftIfRevisionMatches()`, `publishIfRevisionMatches()` sans modifier le comportement HTTP existant.

**Important :** le document R2 contient plusieurs célébrations. Il ne faut jamais faire `state = { drafts: currentCelebration }` ou remplacer l'ensemble avec une seule célébration.

### 4.6 Publication publique

Seul `published` nourrit l'affichage des visiteurs ; une page en brouillon ou masquée n'est pas exposée. Les ressources et URL sont filtrées par les règles actuellement appliquées côté serveur, jamais seulement cachées en CSS ou en JavaScript. Les liens historiques restent accessibles.

## 5 — Stratégie contre les substitutions de code (Mission 05)

**Constat confirmé :** `editor-demo-preparation-page.mjs` construit actuellement un client à partir de `DEMO_CLIENT` avec une série de `.replace()`, complétée par l'injection de `SERVER_EDITOR_SYNC` dans `function mark()`. Cette approche dépend de chaînes de caractères exactes, y compris une réécriture du démarrage asynchrone.

**Décision AD-04-02 :** transformer ces adaptations en points d'extension nommés et testés, jamais en remplacements silencieux de code source.

Ordre de migration proposé, **un groupe à la fois** :

| Groupe | Substitutions existantes à reprendre | Extension cible |
| --- | --- | --- |
| A — Démarrage | passage async, clés de stockage, seed et pages initiales | `bootEditor({initialSeed,storageNamespace,mode})` |
| B — Navigation et pages | page sélectionnée, suppression de page, libellés, options des pages | `pagesService`, `pageNavigation` |
| C — Validation et rendu | lien « Voir le site », états, aperçu | `renderEditor({mode,capabilities})` |
| D — Stockage local | historique localStorage, plans/pages partagées, contenu non transmis | `localDraftsRepository` |
| E — Sauvegarde serveur | `SERVER_EDITOR_SYNC`, bouton Enregistrer, chargement, marqueur « modifications en attente » | `syncController` et `onDocumentChanged` |
| F — Cas hérités | libellés d'étapes, textes longs et comportements d'anciennes pages | `compat/legacy-page-adapter` |

**Protocole obligatoire pour CHAQUE extraction :**
1. Choisir une seule substitution ou un groupe étroitement lié.
2. Créer un test de résultat **avant** de modifier la source : état du DOM, données, requêtes, visibilité et rendu.
3. Écrire le point d'extension explicite, brancher uniquement ce comportement et supprimer la substitution correspondante.
4. Exécuter Mission 02 + tests de sauvegarde/publication pertinents.
5. Comparer les captures et le comportement, également à 390px et 1280px.
6. Réintroduire l'ancien code si un invariant casse ; aucun correctif CSS opportuniste pour « faire passer » un test.

**Critère de sortie mission 05 :** aucun remplacement textuel du code JavaScript exécuté ne subsiste dans la composition de l'éditeur ; les conversions de texte utilisateur et de données restent naturellement autorisées.

## 6 — Phases de découpage après Mission 05

**Mission 06 :** isoler d'abord les fonctions pures (modèle et commandes), puis Undo, gestion de pages/blocs, médiathèque, commandes DOM. Laisser l'ancienne façade `DEMO_CLIENT` jusqu'à ce que tous les appels aient été transférés. Le client public ne change pas.

**Mission 07 :** introduire des validations de type/non-perte de champs pour les blocs, les sections et les anciennes représentations. Aucune conversion forcée des pages déjà publiées.

**Mission 08 :** mutualiser index et choix des fichiers tout en gardant les règles différentes pour vidéo / bouton / image. Aucune copie implicite de média.

**Mission 09 :** centraliser les pages générales et les huit étapes, leur publication, leur ordre, et les règles du menu. Aucun changement automatique d'identifiants.

**Mission 10 :** extraire les mécanismes de synchronisation R2 après avoir prouvé les scénarios conflit 409, brouillon local survivant à une coupure, publication explicite et édition d'une page déjà publique.

**Mission 11 :** rendre les déplacements et Undo déterministes ; ne pas changer les raccourcis et boutons.

**Mission 12 :** isoler le rendu public sans modifier URL, affichages, accès médias ni restrictions des brouillons.

**Mission 13 :** réorganiser CSS en regroupant les règles par composants ; conserver le rendu mesuré dans les captures Mission 02.

**Missions 14–17 :** analyser la sécurité, archiver prudemment les éléments réellement inutilisés, simplifier les pipelines et actualiser la documentation après la preuve d'utilisation.

## 7 — Les protections incontournables AVANT un déploiement risqué

**AD-04-03 : blocage des publications structurelles tant que les lacunes critiques de Mission 03 ne sont pas traitées.**

| Risque de Mission 03 | Décision pour le chantier |
| --- | --- |
| R1 — retour arrière Worker épinglé sur une ancienne révision | **Bloquant** : identifier la version Worker actuellement déployée, enregistrer son ID, tester un rollback vers **cette** version sur un candidat isolé ; ne pas se satisfaire de l'ancien commit statique. |
| R2 — archive R2 dans le même compte Cloudflare | Préparer une copie chiffrée **indépendante**, accessible au propriétaire, avant un chantier de données. |
| R3 — pas de restauration isolée complète de la D1 de production | Établir un export fiable et un test de restauration isolée de la D1 avant une opération impliquant les données historiques. |
| R4 — médias binaires non archivés dans le nouveau snapshot JSON | Vérifier copie et restitution des octets R2 historiques + nouveaux médias, sous les mêmes clés, avant des changements de stockage. |
| R5 — archive ponctuelle, pas de sauvegarde récurrente | Définir calendrier, rétention, chiffrement, surveillance d'échec et procédure de récupération des clés, sans exposer les secrets dans le dépôt. |

**Nuance :** les missions de conception, les extractions hors production et les tests synthétiques peuvent être réalisés avant ces opérations. Les changements à risque sur le site en service ne le peuvent pas.

## 8 — Stratégie de validation commune

À chaque sous-mission, produire une PR **DRAFT**, sans fusion sur `main` ni déploiement automatique. Une extraction n'est pas dite réussie uniquement parce que Node ne signale pas d'erreur.

**Portes de sortie :**

1. **Équivalence des données** : mêmes IDs, pages, ordre des blocs, champs inconnus, pièces jointes, visibilités, historiques utilisés.
2. **Équivalence HTTP** : mêmes routes, réponses et restrictions d'accès ; conflits 409 ; aucune exposition de brouillons.
3. **Équivalence admin** : boutons, actions, enregistrer/publier, picker images/PDF/vidéo/audio, Undo, drag/drop, mobile.
4. **Équivalence visiteurs** : menu Accueil → Célébrations → Médiathèque → pages supplémentaires, 8 étapes, quatre cartes par ligne desktop, deux mobile, traits des quatre couleurs, lecteurs et pages publiées.
5. **Équivalence visuelle** : images des Missions 02 ou nouvelles références approuvées par l'utilisateur ; captures sur ordinateur et téléphone.
6. **Qualité du code** : plus de cycles d'import, plus de substitution implicite, tests unitaires des contrats publics, lint et détection de code mort non destructive.
7. **Mise en ligne uniquement avec autorisation explicite et barrières de Mission 03 résolues**, puis test réel et restauration possible.

Le script `scripts/mission02-public-reference-browser.mjs` doit être exécuté sur un domaine candidat approprié via une adaptation explicitement validée, **sans changer silencieusement son verrouillage actuel sur le domaine officiel**. Les captures de Mission 02 conservées 30 jours doivent être archivées/reproduites légalement et en sécurité avant expiration si elles restent nécessaires.

## 9 — Décisions explicites : ce que nous ne ferons pas

- Pas de migration vers un nouveau framework web « parce qu'il serait moderne ».
- Pas de microservices, de nouvelle base SQL ni de changement de fournisseur.
- Pas de nouveau design, de nouveaux boutons visibles, ni de réorganisation du menu administrateur.
- Pas de remplacement du modèle d'édition par un format JSON « idéal » sans phase de compatibilité et sauvegarde.
- Pas de suppression de `index.html`, `admin.html`, scripts Supabase, anciens Worker ou dossiers de tests tant que les routes, repli `ASSETS`, liens et scripts externes n'ont pas été inventoriés.
- Pas de lancement automatique de la Mission 05 ou d'un déploiement en production à la clôture de cette Mission 04.
- Pas de présentation d'une architecture proposée comme « déjà construite ».

## 10 — Acceptation de cette Mission 04

**Critères documentaires :**

- [x] Domaine et routes existants conservés dans la conception.
- [x] Responsabilités admin / public / shared / backend / compat définies.
- [x] Graphe de dépendances interdit les croisements dangereux.
- [x] Contrats de données, Undo, pages, médias et publication spécifiés.
- [x] Stratégie concrète d'élimination des remplacements de code en six groupes.
- [x] Ordre de réalisation lié aux missions 05–17.
- [x] Conditions de non-régression visuelle/fonctionnelle explicites.
- [x] Risques R1–R5 de sauvegarde et rollback reportés comme obligations.
- [x] Aucun changement technique au logiciel inclus dans cette mission.

**Livrable final :** ce document d'architecture cible.  
**Statut : MISSION 04 TERMINÉE (CONCEPTION), IMPLÉMENTATION NON COMMENCÉE.**  
**Suite : MISSION 05, sur instruction explicite du propriétaire seulement.**
