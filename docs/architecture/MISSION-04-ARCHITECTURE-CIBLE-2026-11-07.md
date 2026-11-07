# 🌸 CÉLÉBRATIONS — MISSION 04
## Architecture cible du logiciel — mêmes écrans, mêmes données, moteur mieux organisé

**Date :** 7 novembre 2026  
**Nature :** conception technique, contrats et décisions d’architecture. **Aucune modification fonctionnelle et aucun déploiement.**  
**Dépôt :** `ludodulac/Celebrations`  
**Branche d'architecture :** `design/celebrations-mission-04-architecture-20261107`, dérivée de la mission 03.  
**Référence du logiciel officiel :** `fix/celebrations-inline-validation-20261105` au commit `7cbfdbd79e2b40f8f4ca4b46dbc97d47e26b742d`.  
**Sources :** [mission 01](../audit/MISSION-01-CARTOGRAPHIE-2026-11-07.md), [mission 02](../audit/MISSION-02-REFERENCE-FONCTIONNELLE-2026-11-07.md), [mission 03](../audit/MISSION-03-BACKUPS-RESTAURATION-2026-11-07.md).  
**Contrat machine lisible associé :** [CELEBRATIONS-M04-CONTRAT.json](CELEBRATIONS-M04-CONTRAT.json).

> **Décision : conserver un seul logiciel et son infrastructure Cloudflare actuelle, mais répartir le code en modules indépendants avec des interfaces explicites.** Ne pas réécrire le site dans un framework et ne pas changer le modèle de données ou les URLs pendant ce chantier. La cible ci-dessous **n'est pas encore implémentée** : c'est le plan de construction des missions 05 à 18.

---

## 1. Le problème que nous résolvons

L'architecture actuelle est fonctionnelle, mais certaines responsabilités sont concentrées :

- `migration/cloudflare/editor-demo-client.mjs` : programme d'édition d'environ **2 751 lignes**, avec pages, blocs, fenêtres, Undo, glisser-déposer, médias et rendu.
- `migration/cloudflare/editor-demo-style.mjs` : styles accumulés, dont des règles fortement prioritaires.
- `migration/cloudflare/editor-demo-preparation-page.mjs` : adapte le client en réalisant **des substitutions dans son texte JavaScript** (`.replace`), ce qui crée des dépendances à l'orthographe exacte du programme.
- `migration/cloudflare/editor-trial-site-client.mjs` : navigation, lecture, rendu des pages, galeries, lecteurs et styles visiteurs.
- `migration/cloudflare/editor-server-sync-client.mjs` et API associées : sauvegarde navigateur, brouillon sur le serveur, version publique, conflits de révision.
- `production-worker.mjs` : routage moderne et routes héritées qui doivent continuer à servir les anciennes URL.

Ces observations sont des constats de code (mission 01). Elles ne prouvent **ni** qu'une donnée a été perdue **ni** qu'une fonction particulière est actuellement cassée.

**Objectif vérifiable :** en interne, une fonction ne doit dépendre que de son module et de contrats publiés ; à l'extérieur, un visiteur et l'administrateur doivent continuer à voir et faire **exactement la même chose**.

## 2. Choix de conception arrêtés pour la suite

| Décision | Choix | Ce qui est expressément exclu |
| --- | --- | --- |
| Plateforme | **Cloudflare Worker, D1, R2 et ASSETS existants** | Changement d'hébergement, nouveau compte, migration Supabase ou modification DNS. |
| Point d'entrée | `migration/cloudflare/production-worker.mjs` reste en place. | Nouvelle URL publique et rupture des routes héritées. |
| Modèle éditorial | Continuer à lire/écrire l'état au même emplacement R2. | Renommer les identifiants, convertir toutes les pages d'un coup ou effacer l'historique. |
| Organisation interne | **Modules ECMAScript** à responsabilité unique ; interfaces fonctionnelles explicites. | Empiler de nouvelles substitutions de texte. |
| Rendu navigateur | Conserver le HTML, les classes et la politique CSP noncée. Si bundling nécessaire, le faire **hors ligne** et comparer l'HTML/JS/CSS généré avant activation. | Changement de framework ou de rendu serveur qui affecterait l'interface. |
| Comportement | Contrats de non-régression des missions 01–02, valeur par défaut identique. | Changement de textes, menus, boutons ou d'ordre des pages. |
| Livraison | Branches isolées et PR **DRAFT** ; publication uniquement via la chaîne protégée, après correction des protections manquantes. | Déploiement automatique d'une refonte juste parce que les tests unitaires passent. |
| Ancien code | Garder la compatibilité et l'historique jusqu'à preuve documentée de leur inutilité. | Suppression massive de fichiers « demo », « trial » ou « legacy » sur leur seul nom. |

### Architecture logique cible

```text
                        UTILISATEURS / NAVIGATEURS
                 ┌────────────────┴─────────────────┐
                 │                                  │
     ADMIN — mêmes écrans et boutons    VISITEURS — mêmes pages et menus
                 │                                  │
          Contrôleurs DOM                  Rendu public + navigation
          ↕ Commandes/Undo                 ↕ Sélecteurs (lecture seule)
                 └────────────────┬─────────────────┘
                                  │
                     DOMAINE ÉDITORIAL PARTAGÉ
           Types de pages/blocs • identifiants • visibilité
           commandes pures • validation • classification médias
                                  │
                   PORTS / CONTRATS D'APPLICATION
          État éditorial • catalogue médias • accès • lecture D1
                                  │
                   ADAPTATEURS / IMPLÉMENTATIONS
           R2 ETag + versions     D1 historique     Auth serveur
                   │                  │                 │
                   └──────────┬───────┴─────────────────┘
                              │
               production-worker.mjs (ROUTES INCHANGÉES)
                              │
                   URLs officielles + ASSETS
```

L'administration **n'a pas le droit** de publier directement en modifiant le DOM. Le navigateur exprime une intention. Le serveur vérifie les droits, la révision et les règles de visibilité avant toute écriture.

Le rendu visiteur **ne doit jamais** consommer un objet de brouillon brut : il reçoit uniquement une projection publique filtrée du serveur.

## 3. Répartition définitive des responsabilités

Le chemin `migration/cloudflare/app/` est une **destination proposée**, non un dossier déjà présent. Ne créer les fichiers qu'au fur et à mesure de leur remplacement testé.

| Frontière | Destination cible | Responsabilités et exports possibles | Dépendances permises |
| --- | --- | --- | --- |
| **Domaine** | `app/domain/` | `parsePageId`, `validatePage`, `validateBlock`, `effectiveVisibility`, `stageSlugs`, `classifyMedia` ; aucun accès au navigateur ni au réseau. | Aucune. |
| **Application** | `app/application/` | `applyPageCommand`, `moveBlock`, `undoLocalCommand`, `selectPublicPages`, `makePublicationIntent`. | Domaine seulement. |
| **Ports** | `app/ports/` | Contrats `EditorRepository`, `LegacyContentReader`, `MediaRepository`, `AccessPolicy`. | Domaine/application, pas de Cloudflare concret. |
| **Adaptateurs** | `app/adapters/` | Lecture D1, accès R2, écriture conditionnelle ETag, gestion des médias, authentification serveur. | Domaine, application, ports. |
| **Administration** | `app/admin/` | Démarrage, navigation, modales, formulaires, éditeur de blocs, drag-and-drop, Undo, CSS. | Domaine, application, ports, jamais le R2 brut. |
| **Visiteurs** | `app/public/` | Menu, pages publiées, scènes, galeries, lecteurs audio/vidéo, CSS. | Domaine et sélecteurs/ports lecture seule. |
| **Compatibilité** | `app/compat/` | Import historique D1, identifiants, libellés existants, redirections, URL d'anciens PDF et médias. | Domaine et ports. |
| **Composition** | `app/composition/` | Assemble les dépendances, les routes et le HTML ; choisit explicitement admin/public sans réécrire du JavaScript par chaînes. | Peut référencer tous les modules sans cycle. |

**Règle de dépendance :** domaine → aucune entrée ; application → domaine ; interfaces → domaine/application ; contrôleurs → interfaces, jamais l'inverse ; adaptateurs R2/D1 → ports ; assemblage → tout. La compatibilité dépend de l'application, mais **pas** des composants visuels.

**Règle de découpage :** un module doit être responsable d'une fonction compréhensible et testable. Le nombre de fichiers n'est pas un objectif en soi : évitons de remplacer un gros fichier par 200 minuscules fichiers artificiels.

### 3.1 Éviter les substitutions de texte (mission 05)

**Situation actuelle :** `editor-demo-preparation-page.mjs` cherche des fragments comme `function render(){`, `function mark(){dirty=true;` ou `el('save-btn').onclick=save;` pour introduire des comportements propres au véritable site.

**Cible :** `createEditor({initialState,selectedCelebration,initialTab,servicePorts,callbacks})`, puis :
- `editor.mount(root)`
- `editor.getDocument()`
- `editor.dispatch(command)`
- `editor.on('saveRequested',handler)`
- `editor.on('publicationRequested',handler)`
- `editor.dispose()`

Ce sont des **signatures de conception**, pas des fonctions déjà implémentées. À la mission 05, on remplacera une adaptation à la fois par un point d'extension explicite, avec test d'équivalence, sans supprimer d'un coup le client historique.

Les valeurs de configuration proviendront d'un objet initial **validé et échappé** lors de l'insertion dans le HTML, pas d'une nouvelle variable globale dispersée.

### 3.2 Séparer le document des outils (missions 06–07, 09 et 11)

Chaque opération doit être une commande calculable séparément de l'écran :

- `AddBlock({pageId,block,parentId,columnIndex,index})`.
- `MoveBlock({pageId,blockId,targetSectionId,columnIndex,targetBlockId,after})`.
- `DeleteBlock({pageId,blockId})`.
- `UpdateBlock({pageId,blockId,patch})`.
- `AddPage({group,celebrationId,name})`, `RemovePage({pageId})`, `MovePage({pageId,direction})`.
- `UndoLocal()`, **sans annuler une publication distante**.

Ces commandes sont **illustratives** : leur protocole exact sera défini avec les tests avant la première implémentation. Elles ne doivent pas imposer un nouveau format de stockage.

Le modèle de page conserve `id`, `name`, `group`, `blocks`, la visibilité existante et tous les champs additionnels actuels. Un bloc conserve `id`, `kind` et ses champs optionnels existants (`text`, `rich`, `src`, `href`, `align`, `size`, `cover`, colonnes, etc.). **Ne jamais convertir ou tronquer des contenus inconnus lors d'une lecture-écriture**.

Les types réellement utilisés incluent `heading`, `text`, `button`, `event`, `video`, `image`, `audio`, `divider` et les sections de colonnes. Le moteur doit préserver les types hérités sans les « corriger » implicitement.

### 3.3 Sauvegarde : un port unique et une seule politique de concurrence (mission 10)

```text
EditorRepository.load(celebrationId)
   → {revision,record,plans,shared,mediaCatalogue}
EditorRepository.save(command, expectedRevision)
   → {revision,updatedAt,publishedPageId?}
   → erreur normalisée "conflit" si 409
PublicationService.publish(command, expectedRevision)
   → {revision,visibility?,general?,updatedAt}
PublicRepository.read(celebrationId)
   → {record filtré,shared filtré,plans filtrés,media publics...}
```

**Invariants non négociables :**
- Sauvegarde de brouillon sans publication implicite d'une nouvelle page.
- Édition d'une page **déjà publiée** répercutée de la manière existante, dans la même écriture conditionnelle.
- Publication explicite de page, célébration ou statut de média seulement côté serveur authentifié.
- Comparaison de `expectedRevision` à l'état courant ; `409` en cas de désaccord et conservation locale du travail.
- Mise à jour R2 **conditionnelle sur l'ETag** ; aucune solution de secours « écraser quoi qu'il arrive ».
- `publicSnapshot` masque brouillons, pages/célébrations cachées et références privées.
- Respect de la différence historique : absence de champ `visibility` peut correspondre à une ancienne page publique. **Ne pas transformer ces pages en brouillons par défaut.**
- Même clé réelle `editor-trials/server-drafts-v1.json` pendant toutes les missions de parité ; aucun projet de renommage sans migration explicite et sauvegarde complète.

### 3.4 Médiathèques : un catalogue, plusieurs usages (mission 08)

**Trois niveaux distincts à conserver :**
1. `MEDIA_BUCKET = celebrations-exit-production` : fichiers historiques, PDF envoyés autrefois, liens `/media/` et `/letter/`.
2. `EDITOR_BUCKET = celebrations-exit-staging`, sous `editor-trials/uploads/` : fichiers ajoutés avec le nouvel éditeur ; liens `/media/new/`.
3. `mediaCatalogue` dans le document éditorial : **références**, intitulés, catégories, usage et visibilité ; ce n'est **pas** un stockage de fichiers binaires.

Le sélecteur reste une fenêtre **au-dessus de la page ouverte**. Il filtre les images/PDF/audios/vidéos/autres, affiche des miniatures ou lignes lisibles et associe la bonne URL au bon type de bloc. Le bloc `video` ne doit pas devenir un `button` quand on choisit une vidéo.

**Compatibilité indispensable :** actuellement, le téléchargement direct via l'API accepte principalement JPEG/PNG/WebP, PDF, MP3/WAV ; il ne faut pas promettre ou ajouter silencieusement l'upload de fichiers vidéo. Les vidéos déjà hébergées et les liens vidéo utilisables par le lecteur doivent continuer de fonctionner comme aujourd'hui. Un éventuel nouvel upload MP4 est une **fonction supplémentaire**, pas un refactoring transparent.

### 3.5 Visiteurs : lecture seule par construction (mission 12)

- Le domaine public doit recevoir une **projection des pages publiées** et des seules ressources autorisées.
- L'ordre du menu est **Accueil → Célébrations → Médiathèque générale → pages ajoutées**.
- Sur ordinateur, les cartes des célébrations sont disposées en **quatre colonnes** ; sur téléphone, **deux**.
- Traits d'identification : Michaël `#ea342f`, Gabriel `#665ce4`, Raphaël `#32ba63`, Ouriel `#efbb1f`.
- Huit étapes de célébration (accueil de célébration, préparation, mercredi, jeudi, vendredi, samedi, dimanche, après célébration) avec slugs historiques identiques.
- Titres de vidéos sous les lecteurs et miniatures, **non transformés en boutons encadrés**.
- Toutes les URLs historiques `/media/`, `/letter/`, et les destinations d'anciennes pages continuent de fonctionner.
- La présence d'un fichier dans une médiathèque administrative ne suffit pas à le rendre public.
- Les mêmes classes CSS, textes et comportements mobiles sont la référence, même si les composants deviennent internes.

### 3.6 Visuels et commandes de l'administration (mission 13)

Le CSS sera organisé en :
- Tokens et thèmes existants.
- Mise en page générale.
- Contrôles, fenêtres et accessibilité.
- Blocs, colonnes et médias.
- Responsive ordinateur/mobile.

Les sélecteurs et breakpoints seront migrés **par groupe**. Toute suppression d'une règle ou de `!important` doit être justifiée par un test visuel comparatif : ce mot-clé ne prouve pas, seul, une erreur.

**Les mêmes boutons restent au même endroit** : Valider/Enregistrer, Aperçu, disque de statut, ajout « + » centré, sélecteur de fichier, menu visiteurs, retour en arrière ↶ sur téléphone et Ctrl+Z hors champs de texte.

## 4. Contrats techniques — externes stables

Le fichier JSON associé établit les invariants vérifiables automatiquement.

| Interface existante | Contrat de compatibilité |
| --- | --- |
| `GET /`, `/preparation/`, `/mercredi/`, `/mediatheque-generale`, etc. | Même contenu publié et même navigation. |
| `GET /admin.html` | Même accès protégé et mêmes outils après authentification. |
| `GET/POST /api/editor-open-draft` | Même lecture/écriture privée et contrôle d'accès. |
| `GET/POST /api/editor-publication` | GET public filtré, POST authentifié seulement. |
| `GET/POST /api/editor-media` | Catalogue administrateur/écritures contrôlées. |
| `GET /media/new/*` | Fichiers nouveaux selon les règles d'accès existantes. |
| `GET /media/*` et `/letter/*` | Anciens médias et PDF : URLs intactes. |
| Repli `env.ASSETS` | Compatibilité des ressources statiques encore servies. |
| R2 `editor-trials/server-drafts-v1.json` | Schéma, version, brouillons, copie publiée, identifiants et références préservés. |

**Règle supplémentaire :** la refonte n'introduit pas de publication via une simple modification CSS/JS ni via un aperçu.

Les réponses d'erreur existantes restent significatives : `401/403` (authentification/origine), `404` (introuvable), `409` (conflit concurrent), `413/415` (taille/type refusé). Ne pas les normaliser en « 200 OK » ou masquer un conflit.

## 5. L'ordre de migration autorisé

**Le principe est : une seule responsabilité remplacée à la fois, avec code ancien conservé tant que la parité n'est pas confirmée.**

| Mission | Action visée | Preuve spécifique obligatoire avant substitution |
| --- | --- | --- |
| **05** | Remplacer les injections `.replace` par des extensions explicites et un bootstrap contrôlé. | JS/HTML/CSP équivalents, navigation et publication de test non destructives. |
| **06** | Isoler état éditeur, contrôleurs DOM, rendu et règles locales. | Toutes les vues de la mission 02 identiques ; aucune régression du bouton ↶. |
| **07** | Centraliser le modèle des blocs/sections et leurs règles de transformation. | Aller-retour de TOUS les types de blocs historiques, sans perte de champs. |
| **08** | Unifier le catalogue média et les sélecteurs. | Images/PDF/audio/vidéo et URL historiques identiques, modal au-dessus de l'éditeur. |
| **09** | Centraliser la création, navigation, visibilité et suppression de pages. | Aucune page masquée révélée ; ordre et slugs inchangés. |
| **10** | Isoler les ports et adaptateurs de sauvegarde/publication R2. | R2 ETag, HTTP 409, échec réseau, double appareil, absence d'écrasement. |
| **11** | Extraire le moteur drag-and-drop et les commandes Undo. | Déplacements entre blocs et colonnes, Ctrl+Z et ↶ mobile inchangés. |
| **12** | Séparer le rendu public des opérations d'édition. | Captures et métriques visiteurs ; intégrité des liens historiques. |
| **13** | Décomposer le CSS après parité visuelle. | Diff d'écran desktop/mobile et contrôle de superposition des modales. |
| **14** | Examiner la sécurité des routes et permissions. | Auth, contrôle d'origine, refus de modifier la production, aucun brouillon divulgué. |
| **15** | Isoler/archiver l'ancien code **seulement après audit d'usage**. | Aucune route héritée, import de staging ou ressource `ASSETS` cassée. |
| **16** | Réduire les tests et clarifier les déploiements/rollbacks. | Rejeu du contrat M02 et restauration **exacte** de la version précédente. |
| **17** | Documentation actuelle et optimisation mesurée. | Temps de chargement comparé ; aucune variation de présentation. |
| **18** | Recette générale. | Contrat complet, sauvegarde/restauration et tests utilisateurs confirmés. |

Pour chaque mission : **PR DRAFT indépendante → tests isolés → comparaison de référence → compte rendu → décision de publication séparée**. Les missions 05–13 peuvent être préparées hors ligne même si le déploiement est temporairement bloqué.

## 6. Garde-fous de sûreté avant toute publication risquée

La mission 03 a identifié des lacunes réelles. Elles deviennent des **conditions de passage**, pas de simples remarques :

| Garde-fou | État aujourd'hui | Condition pour déclarer « prêt » |
| --- | --- | --- |
| Retour arrière Worker exact | **NON CERTIFIÉ** : pipeline épinglé sur `94affae...`, différent de la version vérifiée `7cbfdb...`. | Capturer l'identité réelle du Worker déployé et éprouver une restauration de **cette version précise** sur candidat isolé ; tester la sortie d'échec. |
| Sauvegarde éditoriale R2 | **VALIDÉE pour l'instantané rév. 114** le 07/11/2026. | Avant une release risquée, capturer un nouvel instantané sans écraser la sauvegarde actuelle. |
| Base D1 complète, état actuel | **NON CERTIFIÉE** par la mission 03. | Export cohérent des tables réellement nécessaires, empreinte, restauration dans D1/SQLite isolé et contrôle des relations/compteurs. |
| Fichiers médias binaires nouveaux et historiques | **Accessibilité vérifiée, récupération globale NON CERTIFIÉE**. | Inventorier chaque clé utilisée ; vérifier octets ou copies restaurables et URL historiques. |
| Copie indépendante du compte Cloudflare | **NON VÉRIFIÉE** pour le snapshot éditorial récent. | Archive chiffrée indépendante contrôlée sans publier de contenus privés. |
| Référence UI | **42 captures / tests M02**, archives CI temporaires. | Comparer les mêmes captures, routes et scénarios, sans publier en cas d'écart non expliqué. |

**Décision :** aucune refonte n'est déployée par cette mission. Aucun workflow de la branche de production ne doit être détourné pour « tester » un grand nettoyage. La correction du rollback appartient au préalable de release de la mission 16, **à avancer avant tout déploiement à risque**, sans attendre artificiellement la fin de tous les autres travaux hors ligne.

## 7. Ce qui est un fait et ce qui reste une proposition

**Faits confirmés dans GitHub / les missions 01–03 :**
- Les fichiers, fonctions, routes, buckets et formats existants décrits ci-dessus sont présents dans l'application.
- La référence fonctionnelle Mission 02 est disponible (capturée à deux largeurs).
- Une archive chiffrée privée du JSON éditorial (révision 114) a été récupérée et comparée octet par octet en mémoire.
- Les 113 médias publics et neuf PDF historiques ont été vérifiés accessibles.
- Le rollback épinglé du workflow officiel provient d'une version historique distincte.

**Choix d'architecture (NON encore exécutés) :**
- Dossier `app/` et frontières de modules.
- Extraction des commandes de blocs et contrôleurs.
- Assemblage explicite au lieu des `.replace`.
- éventuel bundling **hors ligne** permettant de conserver le script unique avec nonce sans modifier les règles CSP.

**Questions réservées à l'implémentation :**
- Découpage exact des sous-modules et de leurs exports.
- Format d'une commande interne, tant que les documents et le protocole serveur ne changent pas.
- Choix final de l'outil de build, uniquement si les tests de sortie JS/CSS le justifient.
- Archivage de l'ancien code, uniquement après vérification d'utilisation.

## 8. Critères de fin de la mission 04

- [x] Cible organisée en modules et dépendances **sans cycles**.
- [x] Cartographie actuelle → responsabilités futures pour admin, visiteurs, stockage et compatibilité.
- [x] Contrats invariants des données, routes, sauvegardes et présentation explicités.
- [x] Limites M03 intégrées dans les garde-fous de publication.
- [x] Ordre d'exécution précis de 05 à 18 et tests de parité par mission.
- [x] Contrat JSON exploitable par de futurs tests automatiques.
- [x] Aucune modification du logiciel officiel, des contenus, des Workers, D1/R2 ou du DNS.

**Verdict : MISSION 04 — CONCEPTION D'ARCHITECTURE TERMINÉE, IMPLÉMENTATION NON COMMENCÉE.**

**Prochaine mission : 05 — supprimer progressivement les substitutions fragiles de l'éditeur.** Elle devra rester en branche DRAFT, et aucune publication réelle ne sera autorisée avant vérification des protections de release identifiées.

Ne commencer la mission 05 qu'à la demande du propriétaire.
