# CÉLÉBRATIONS — MISSION 01
## Cartographie technique, dépendances et inventaire des risques

**Date :** 7 novembre 2026  
**Nature :** audit documentaire en lecture seule — aucune modification des fonctionnalités, contenus ou données.  
**Dépôt étudié :** `ludodulac/Celebrations`  
**Référence du code officiel étudié :** `fix/celebrations-inline-validation-20261105` @ `7cbfdbd79e2b40f8f4ca4b46dbc97d47e26b742d`  
**Branche de cet audit :** `audit/celebrations-mission-01-cartographie-20261107`  
**Dernière publication officielle trouvée sur cette référence :** workflow GitHub Actions « publier interface visuelle » n° 42365631159, conclusion **success** (07/11/2026).

> Cette carte décrit le **code observé**, les dépendances et le chemin de publication observé. Elle ne constitue pas une certification de sécurité ni une validation exhaustive de l'interface réelle. Les tests fonctionnels et comparaisons visuelles seront réalisés en mission 02. Les termes « historique », « staging » ou « non importé par la production » ne signifient **jamais** « peut être supprimé » sans preuve supplémentaire.

## 1 — Résumé de la cartographie

| Élément | Quantité constatée |
| --- | ---: |
| Fichiers versionnés au total | **492** |
| Fichiers directement à la racine | **90** |
| Fichiers sous `migration/cloudflare/` | **51** |
| Scripts sous `scripts/` | **124** |
| Fichiers de test sous `tests/` | **48** |
| Workflows sous `.github/workflows/` | **73** |
| Fichiers sous `docs/` | **92** |
| Modules Cloudflare `.mjs` atteignables par import statique depuis le Worker de production | **23**, en comptant le Worker lui-même |

Les nombres portent sur l'arbre GitHub de ce commit, non sur un comptage de fichiers effectivement téléchargés par chaque visiteur. Le site ne charge pas nécessairement les 492 fichiers.

**Diagnostic principal :** les fonctions essentielles sont identifiables et des garde-fous existent, mais le code de l'éditeur est fortement concentré et son adaptation au véritable site repose sur une chaîne de substitutions textuelles. La documentation de premier niveau décrit encore l'ancienne plateforme. L'organisation est donc **maintenable à court terme avec prudence**, mais elle deviendra coûteuse et fragile à mesure que les fonctions s'ajouteront.

## 2 — Quelle version est le vrai logiciel ?

Il faut distinguer **trois circuits**.

**A. Site officiel actuellement exploité**

- Domaine : `ronde-des-archanges-universelle.eu`, avec son alias `www`.
- Entrée réseau : `migration/cloudflare/production-worker.mjs`.
- Site visiteurs : `migration/cloudflare/editor-trial-site-page.mjs` et `editor-trial-site-client.mjs`.
- Administration actuelle : `migration/cloudflare/editor-demo-preparation-page.mjs`, qui adapte `editor-demo-client.mjs` et `editor-demo-style.mjs`.
- Backend commun : Cloudflare Worker, D1, deux familles de stockage R2 et accès administrateur.
- Le code de cette interface est porté par la branche `fix/celebrations-inline-validation-20261105` (PR #74 encore en **DRAFT**), et non automatiquement par la tête de `main`. Son déploiement passe par un workflow contrôlé.

**B. Anciennes pages statiques conservées dans le dépôt**

- `index.html`, `admin.html`, `public-*.js`, `admin-*.js`, `styles.css`, `supabase-*.js`.
- Ces pages référencent des scripts Supabase et l'ancienne organisation.
- `.github/workflows/pages.yml` déploie encore la branche `main` vers GitHub Pages.
- **Important :** le Worker conserve un repli `env.ASSETS.fetch(request)`; certains chemins et fichiers statiques restent potentiellement accessibles ou nécessaires. **Ne pas supprimer ces fichiers sur la seule base de l'existence de la nouvelle interface.**

**C. Environnement de staging / prototypes**

- `migration/cloudflare/staging-worker.mjs`.
- Référence des expérimentations `editor-b-`, `editor-d-`, `editor-e1-`, démos, tests, accès d'essai et routes isolées.
- **Ne pas supposer** que tous ces prototypes sont utilisés par le site officiel.

Cette distinction est le préalable absolu à tout nettoyage.

## 3 — Schéma des chemins fonctionnels

```text
VISITEUR
  navigateur
    └─ domaine officiel
        └─ production-worker.mjs
            ├─ pages publiques (/ et /mercredi, /preparation, etc.)
            │   └─ editor-trial-site-page.mjs
            │       ├─ loadSevenStageContent() : sources historiques D1
            │       ├─ SERVER_PREVIEW_PREFETCH : état public de l'éditeur
            │       └─ TRIAL_SITE_CLIENT + TRIAL_SITE_STYLE
            ├─ anciens /media/ et /letter/
            │   └─ media-gateway.mjs + MEDIA_BUCKET historique
            ├─ nouveaux /media/new/
            │   └─ editor-publication-api.mjs + EDITOR_BUCKET
            └─ fichiers statiques restants
                └─ ASSETS

ADMINISTRATEUR
  code d'accès ──> editor-site-access.mjs
    └─ /admin, /admin.html, /__editor/demo-preparation
        └─ editor-demo-preparation-page.mjs
            ├─ données de départ D1
            ├─ editor-demo-client.mjs (logique de l'éditeur)
            ├─ editor-demo-style.mjs (mise en page)
            ├─ editor-trial-audio-client.mjs
            ├─ editor-celebration-themes.mjs
            └─ editor-server-sync-client.mjs
                ├─ sauvegarder brouillon :
                │   POST /api/editor-open-draft
                │     └─ editor-server-draft-api.mjs
                │         └─ EDITOR_BUCKET / snapshot JSON + révision
                ├─ publier / masquer :
                │   POST /api/editor-publication
                │     └─ editor-publication-api.mjs
                │         └─ copie publiée dans le snapshot R2
                ├─ médiathèque : /api/editor-media
                └─ médias chargés : /media/new/

ANCIENNES API ENCORE ROUTÉES PAR LE WORKER
  /api/auth, /api/audience, /api/media-admin, /api/safe-save,
  /api/admin, /api/public-data, /api/footer-admin,
  /api/participants-admin, /api/stats
```

Ce schéma représente les **appels et imports observés** : toutes les routes conservées ne sont pas nécessairement sollicitées par la nouvelle interface à chaque utilisation.

## 4 — Glossaire : où modifier quoi ?

### 4.1 Entrées et navigation

| Fonction | Fichier(s) principal(aux) | Rôle |
| --- | --- | --- |
| Routage domaine officiel, authentification d'entrée, compatibilité des chemins | `migration/cloudflare/production-worker.mjs` | Point de passage HTTP principal. |
| Page HTML de l'administration | `editor-demo-preparation-page.mjs` | Construit le document, charge l'état initial et compose le client. |
| Page HTML des visiteurs | `editor-trial-site-page.mjs` | Construit la page visiteur et prépare le client. |
| Navigation et rendu du site public | `editor-trial-site-client.mjs` | Menu, célébrations, pages, affichage, galerie et lecteurs. |
| Gestion des droits d'accès à l'éditeur | `editor-site-access.mjs` | Écran d'accès, validation, session, déconnexion. |

### 4.2 Administration et édition

| Fonction | Fichier(s) principal(aux) | Éléments présents |
| --- | --- | --- |
| Gestion des pages, navigation interne | `editor-demo-client.mjs` | Création, choix, affichage, paramètres de page. |
| Blocs et colonnes | `editor-demo-client.mjs` | Titre, texte, image, vidéo, audio, bouton, séparateurs, sections, alignements. |
| Déplacement / copier / supprimer | `editor-demo-client.mjs` | Actions de bloc, glisser-déposer, déplacements entre colonnes. |
| Historique et annulation | `editor-demo-client.mjs` | Ctrl+Z, bouton flèche, pile locale bornée. |
| Sélecteurs de fichiers | `editor-demo-client.mjs` | Modal de médiathèque, filtres, rattachement des URL. |
| CSS de l'administration | `editor-demo-style.mjs` | Styles de l'éditeur et adaptation mobile. |
| Sons et outils audio côté éditeur | `editor-trial-audio-client.mjs` | Fonctionnalités audio injectées dans l'éditeur. |
| Thèmes par Archange | `editor-celebration-themes.mjs` | Familles et variations de couleur. |

### 4.3 Données, médias et publication

| Fonction | Fichier(s) principal(aux) | Rôle |
| --- | --- | --- |
| Synchronisation client/serveur | `editor-server-sync-client.mjs` | Charger, enregistrer, gérer révisions et publication. |
| État des brouillons serveur | `editor-server-draft-api.mjs` | Validation, lecture, sauvegarde, conflits 409. |
| Publication et état public | `editor-publication-api.mjs` | Statuts, copie publique, catalogue médias, nouveaux fichiers. |
| Médias historiques | `media-gateway.mjs`, `legacy-link-router.mjs` | Préserver les liens et fichiers déjà diffusés. |
| Administration ancienne des médias | `media-admin-api.mjs` | Route de compatibilité toujours présente. |
| Données historiques D1 et accès | `public-data-api.mjs`, `admin-api.mjs`, `auth-api.mjs`, `safe-save-api.mjs`, etc. | Fonctions encore accessibles par les routes du Worker. |

### 4.4 Modules atteignables depuis le Worker officiel

La fermeture des **imports statiques visibles** aboutit à ces 23 modules :

1. `production-worker.mjs`
2. `media-admin-api.mjs`
3. `media-gateway.mjs`
4. `legacy-link-router.mjs`
5. `auth-api.mjs`
6. `audience-api.mjs`
7. `safe-save-api.mjs`
8. `admin-api.mjs`
9. `public-data-api.mjs`
10. `footer-admin-api.mjs`
11. `participants-admin-api.mjs`
12. `stats-api.mjs`
13. `editor-demo-preparation-page.mjs`
14. `editor-trial-site-page.mjs`
15. `editor-server-draft-api.mjs`
16. `editor-publication-api.mjs`
17. `editor-site-access.mjs`
18. `editor-demo-style.mjs`
19. `editor-demo-client.mjs`
20. `editor-trial-audio-client.mjs`
21. `editor-server-sync-client.mjs`
22. `editor-celebration-themes.mjs`
23. `editor-trial-site-client.mjs`

**Attention :** ce comptage n'inclut pas les scripts statiques chargés par le repli `ASSETS`, ni les dépendances des autres Workers de staging, ni les scripts de déploiement.

### 4.5 Éléments hors du chemin d'import officiel direct

Le Worker staging référence notamment `editor-b-api.mjs`, `editor-d-preview.mjs`, `editor-d2-media.mjs`, `editor-d2-style.mjs`, `editor-d4-access.mjs`, `editor-permanent-access.mjs`, `editor-e1-api.mjs`, `editor-e1-page.mjs`, `editor-e1-client.mjs`, `editor-e2a-access-recovery.mjs`, `editor-trial-audio-api.mjs`.

Les fichiers `editor-demo-page.mjs`, `editable-qa-worker.mjs`, `readonly-preview-worker.mjs`, `legacy-mailed-pdf-worker.mjs`, ainsi que certains fichiers de schéma, manifestes et exemples Wrangler, ont des usages spécifiques ou historiques à confirmer.

**Étiquette à utiliser : « dépendance de production non démontrée », jamais « inutile ».**

## 5 — Modèle des données actuel : ne pas le confondre avec l'ancien

### 5.1 Données historiques

- **Cloudflare D1** fournit les contenus et métadonnées historiques servant à construire l'état initial et à alimenter certaines anciennes API.
- **R2 `MEDIA_BUCKET`** fournit les fichiers historiques aux chemins `/media/` et `/letter/`.
- L'ancien code statique et la documentation font référence à Supabase ; cela ne fait pas de Supabase la source actuelle du nouvel éditeur.

### 5.2 Éditeur visuel actuel

- **R2 `EDITOR_BUCKET`** stocke le document `editor-trials/server-drafts-v1.json`.
- Ce document réunit l'état de plusieurs célébrations, leurs pages, des pages partagées, les plans, le catalogue des médias et la version publiée.
- Une sauvegarde compare une révision globale et utilise le contrôle de concurrence R2 `etagMatches` / `etagDoesNotMatch`. Les conflits se traduisent par HTTP **409**.
- La publication est **une opération distincte** : une page nouvelle peut rester en brouillon ; les mises à jour des pages déjà publiées ont leur propre chemin de synchronisation.
- Les nouveaux téléchargements se trouvent dans l'espace éditorial et sont servis sous `/media/new/`.
- Le navigateur garde des informations locales (notamment brouillons non transmis, préférences et historique des actions). Leur gestion doit rester compatible avec l'état serveur.

**Point de vigilance :** le verrou de version porte sur un document d'état partagé, pas indépendamment sur chaque page. Il protège contre l'écrasement silencieux mais peut provoquer davantage de conflits lors des éditions concurrentes. **Ce n'est pas en soi une panne constatée.** L'expérience des conflits sera examinée en mission 10.

## 6 — Sept zones à ranger, classées par priorité

| Priorité | Constat **observé dans le code** | Pourquoi cela mérite un travail | Mission dédiée |
| --- | --- | --- | --- |
| **P1** | `editor-demo-preparation-page.mjs` contient **22 appels `.replace(...)`** pour transformer du code JavaScript avant de l'envoyer au navigateur. | Dépendance fragile à des fragments exacts de texte. Une correction peut ne plus s'appliquer si le texte change. | **05** |
| **P1** | `editor-demo-client.mjs` embarque environ **2 751 lignes** de logique d'édition dans une seule chaîne exportée. | Plusieurs responsabilités et états mutables dans le même programme : modifications plus difficiles à isoler et tester. | **06–07, 09, 11** |
| **P1** | Brouillon local, brouillon commun, copie publiée et état historique coexistent. | Il faut établir précisément les invariants, les cas de panne et les règles de synchronisation avant de simplifier. | **02–03, 10** |
| **P2** | `editor-demo-style.mjs` contient environ **1 576 lignes**, **338 `!important`** et **47 blocs `@media`**. | Signal de styles superposés et de règles potentiellement contradictoires ; **ne prouve pas** à lui seul un défaut visuel. | **13** |
| **P2** | Le client public représente environ **663 lignes de JavaScript** et sa feuille environ **27 Ko** ; la page visiteur contient aussi des adaptations par chaîne. | Il faut clarifier le périmètre rendu, médias, navigation et styles avant les évolutions. | **12** |
| **P2** | **73 workflows**, **124 scripts**, migrations et prototypes coexistent. Certains workflows sont à usage unique ou anciens. | Il devient difficile de déterminer le bon chemin de déploiement ou les scripts encore indispensables. | **15–16** |
| **P2** | `README.md`, `AI_START_HERE.md`, `PROJECT_MAP.md` présentent principalement l'architecture Supabase / GitHub Pages. Des fichiers du site officiel s'appellent toujours « demo » ou « trial ». | Risque de faire travailler une personne ou une IA sur le mauvais système. Le nom n'est pas une preuve d'inactivité. | **17** |

**Non constaté lors de cette mission :** aucune démonstration d'une vulnérabilité, d'une perte de données ou d'un conflit CSS réel. De telles affirmations exigeraient des tests spécifiques.

## 7 — Ce qui est déjà bien protégé

Les éléments suivants sont **présents dans le code** :

- Restriction de plusieurs routes administrateur via `hasEditorAccess`.
- Vérification du domaine et de l'origine des écritures de publication.
- Contrôle de taille et de structure pour les brouillons.
- Détection de révision obsolète et écriture conditionnelle dans R2.
- Distinction explicite entre brouillons et état public.
- Conservation des chemins historiques de fichiers.
- Workflow de publication comprenant un candidat séparé, sauvegarde, tests Chromium et restauration de Worker en cas de contrôle final échoué.

Ces protections constituent de bonnes bases. Elles devront être **testées**, particulièrement en missions 02, 03, 10 et 14. Leur simple présence ne suffit pas pour certifier la sécurité.

## 8 — Carte des tests et de la publication

### Régressions proches du logiciel actuel

- `tests/test-editor-demo.mjs` : logique générale éditeur.
- `tests/test-editor-trial-site.mjs` : rendu public et navigation.
- `tests/test-editor-server-drafts.mjs` : brouillons serveur.
- `tests/test-editor-publication-media.mjs` : publication et médias.
- `tests/test-editor-modal-page-video-fixes.mjs` : sélection de fichiers, pages, titres vidéo.
- `tests/test-editor-multiple-button-links.mjs` : boutons indépendants.
- `tests/test-editor-section-presentation-step3.mjs` : colonnes, alignement, responsive.
- `tests/test-editor-presentation-server-roundtrip-step4.mjs` : aller-retour serveur.
- `tests/test-editor-undo-video-media.mjs` : annulation et vidéo médiathèque.
- `tests/test-editor-access-gate.mjs` : accès administration.

### Navigateurs et scénario réel

- `scripts/verify-visual-publishing-browser.mjs` : candidat et site officiel.
- `scripts/test-editor-media-picker-browser.mjs`.
- `scripts/test-editor-archangels-video-undo-browser.mjs`.
- `scripts/test-editor-step4-presentation-browser.mjs`.
- `scripts/test-editor-drag-and-drop-browser.mjs`.
- `scripts/test-editor-publication-media-browser.mjs`.
- `scripts/test-editor-michael-resource-browser.mjs`.

### Chemin de publication identifié

La publication officielle passe par `.github/workflows/celebrations-publish-visual-site-once.yml` : **commit autorisé**, vérification des comptes/ressources, sauvegarde du snapshot, vérification des liens historiques, publication d'un **candidat isolé**, tests de rendu et d'édition, mise à jour du Worker existant sans changer le domaine, tests post-déploiement et possibilité de restauration.

Le déclencheur s'appuie notamment sur la branche et sur le marqueur du message de commit `[PUBLISH_VISUAL_SITE_ONCE]`. Pendant les missions de rangement, **ne jamais utiliser ce marqueur par inadvertance** ni appliquer les changements directement sur la branche déclenchant la production.

## 9 — Ce qui doit absolument rester IDENTIQUE

Ces invariants constituent le contrat pour les missions suivantes.

1. **Visiteurs :** toutes les pages et leurs contenus, ordre des menus, éléments généraux, traits de couleur des Archanges, affichage des colonnes et cartes, images, liens, lecteurs audio/vidéo, PDF, présentation mobile et ordinateur.
2. **Administration :** mêmes onglets, parcours de création, édition directe, boutons d'insertion, fenêtres modales, médiathèques, déplacement de blocs, retour en arrière, prévisualisation et indicateurs de sauvegarde.
3. **Données :** mêmes identifiants de pages et de célébrations, textes, versions, visibilités, ordres, affectations, URL et fichiers ; aucun brouillon publié sans action explicite.
4. **Ancien patrimoine :** les liens historiques distribués par courriel, les chemins `/media/`, `/letter/` et les médias préexistants doivent continuer à fonctionner.
5. **Accès :** codes/sessions, autorisations et isolation des données restent protégés.
6. **Déploiement :** même domaine, mêmes ressources de production, sauvegarde et retour arrière opérationnels.
7. **Fonctions mises en veille :** `PARKED_FEATURES.md` reste une consigne ; ne pas réactiver les profils/inscriptions ni éliminer leurs données par inadvertance.

Une amélioration interne n'est acceptable que si ces invariants restent satisfaits.

## 10 — Ce qui n'est PAS encore vérifié

Mission 01 n'a effectué **aucune mutation de contenu** et **aucun nouveau déploiement**. L'inspection du code et des derniers workflows ne garantit pas :

- Que **chaque** menu, onglet, effet visuel et fenêtre est conforme sur tous les navigateurs.
- Que tous les tests historiques de la liste de 48 tests sont encore nécessaires ou passent tous isolément.
- Que tous les fichiers statiques, prototypes, scripts et workflows sont devenus inutiles ; cette conclusion demande un graphe d'utilisation **incluant le repli ASSETS, les jobs externes et les URLs historiques**.
- Que la sauvegarde peut réellement être restaurée dans toutes les situations.
- Qu'aucun comportement problématique n'existe dans les routes anciennes encore actives.
- Que les coûts, quotas et performances sont optimaux.

Ces limites ne constituent pas des échecs. Elles fixent le périmètre de la **mission 02** (référence fonctionnelle) et de la **mission 03** (sauvegarde/restauration).

## 11 — Ordre exact des chantiers de la suite

| Mission | Préparation issue de la cartographie |
| --- | --- |
| **02 — Référence fonctionnelle** | Créer tests d'interface/visuels sur ordinateur et téléphone, parcours administrateur et visiteur, états brouillon/publié, liens et médias. |
| **03 — Sauvegarde** | Prouver l'intégrité et le retour arrière du snapshot R2 et du Worker, sans écraser les contenus. |
| **04 — Architecture cible** | Fixer les interfaces de modules et règles de dépendance après les preuves 02–03. |
| **05 — Supprimer substitutions fragiles** | Remplacer les 22 substitutions par des appels/modules explicites, une à une et avec preuve de parité. |
| **06 — Découper l'éditeur** | Isoler pages, blocs, médias, commandes, drag/drop, annulation, accès aux données. |
| **07 — Unifier les blocs** | Stabiliser les types image, titre, texte, vidéo, audio, bouton, document et section. |
| **08 — Médiathèques** | Centraliser catalogue, catégories et sélecteurs, sans changer les URL. |
| **09 — Pages** | Centraliser création, suppression, navigation et état de visibilité. |
| **10 — Sauvegardes** | Simplifier le client/serveur sans perdre les protections ETag, conflit et brouillon local. |
| **11 — Déplacements/undo** | Isoler les transformations de document et l'historique. |
| **12 — Rendu public** | Séparer modèle et représentation des pages, préserver les liens historiques. |
| **13 — Styles** | Consolider CSS et breakpoints, retirer les doublons seulement après parité visuelle. |
| **14 — Sécurité** | Audit des routes, droits, formulaires, médias et contenus privés. |
| **15 — Historique** | Classer vieux fichiers et prototypes, archiver seulement avec preuve d'inutilité. |
| **16 — Tests/déploiements** | Identifier la suite de tests minimum et le chemin unique de release. |
| **17 — Optimisation/doc** | Mesurer les performances et réécrire les documents devenus faux. |
| **18 — Validation finale** | Rejouer l'intégralité de la référence mission 02, plus contrôle des invariants. |

## 12 — État de mission et passation

**MISSION 01 : TERMINÉE — cartographie et diagnostic documentaire.**

- Travail limité à l'inventaire et à l'analyse de sources.
- Aucune page, média, base, Worker, configuration de production ou fonctionnalité modifiés.
- Le code fourni dans cette branche d'audit est identique à son point de départ ; seul ce document est ajouté.
- **Prochaine action autorisée : MISSION 02**, uniquement sur instruction de l'utilisateur.
- **Principe de la suite :** garder la même interface et le même comportement en séparant preuves observées, hypothèses et choix d'architecture.

### Références à vérifier en premier dans les prochaines missions

`migration/cloudflare/production-worker.mjs` · `migration/cloudflare/editor-demo-preparation-page.mjs` · `migration/cloudflare/editor-demo-client.mjs` · `migration/cloudflare/editor-demo-style.mjs` · `migration/cloudflare/editor-trial-site-page.mjs` · `migration/cloudflare/editor-trial-site-client.mjs` · `migration/cloudflare/editor-server-sync-client.mjs` · `migration/cloudflare/editor-server-draft-api.mjs` · `migration/cloudflare/editor-publication-api.mjs` · `.github/workflows/celebrations-publish-visual-site-once.yml` · `PARKED_FEATURES.md`.
