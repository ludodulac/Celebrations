# M009-A — Rapport de sécurité de la projection publique

**Dépôt :** `ludodulac/Celebrations`  
**Branche :** `feat/celebrations-m009a-public-projection-security-20261110`  
**Base vérifiée :** `61e699e5a90350239d2b7df25c147dbfa01e459a` (M008-D)  
**Livraison :** PR en brouillon #123 ; aucun merge, aucune activation privée, aucun déploiement ni écriture D1/R2 réelle.

## Risque identifié

L'ancien `publicSnapshot()` copiait des agrégats entiers (`...original`, `...shared`, `...plan`) et certaines données de médias. Le filtrage de pages privées était nécessaire mais non suffisant : un parent public pouvait encore contenir des champs d'administration ou des données de relations/espaces non destinées aux visiteurs. Le renderer `loadSevenStageContent()` intégrait au HTML public une liste D1 complète de célébrations et pouvait rendre une célébration planifiée en brouillon. Une lecture côté navigateur ne doit jamais constituer la frontière de sécurité.

## Frontière de confiance

L'accès anonyme ne reçoit plus d'agrégats d'administration complets. Seules les propriétés explicitement admises passent dans la projection de `page`, `blocks`, `plan`, `media`, `publicLanguage` et `window.__TRIAL_SITE_SEED__`. Le moteur de permissions M002 existant (`canAccessPage`, `canAccessPolicy`) décide de l'admissibilité des pages et politiques. Une page privée ou liée à un espace n'est pas publiée sur une URL publique ; aucun calcul de permission n'est délégué à un drapeau du navigateur.

## Contrôles réalisés

| Surface | Traitement |
| --- | --- |
| `publicSnapshot()` | Pages partagées et de célébration projetées par champs explicitement autorisés ; espaces, relations, accès, état privé et plans en brouillon exclus ; version d'enregistrement privé non révélée. |
| `publishedMedia()` | Inventaire recomposé depuis les pages réellement publiées ; médias d'un espace ou d'une page privés exclus, y compris lorsqu'une entrée privée indique `general=true` ; métadonnées internes et usages privés supprimés. |
| Traductions | Les variantes de langue n'apparaissent qu'après publication explicite ; nouvelle projection après résolution pour prévenir l'injection de champs privés ; fallback français conservé. |
| `handleEditorPublication` | Écriture réservée à l'administrateur et révocable ; validation du passage public d'un média ; aucune écriture anonyme. |
| `handleTrialSite` | Lecture du snapshot d'édition côté serveur (quand le binding existe), puis filtrage D1/publication avant sérialisation du HTML ; indisponibilité du snapshot sans exposition de brouillon. |
| `loadSevenStageContent` | Mode `publicOnly` distinct du mode éditeur : célébrations historiques publiques seulement, plans provisoires non accessibles anonymement, étapes et ressources associées filtrées. |
| `window.__TRIAL_SITE_SEED__` | Informations publiques uniquement : pas de copie brute de lignes D1 privées, de listes administratives ni de clés d'accès d'espace. |
| Menus et liens | Identifiants/chemins privés masqués ; liens de commandes administratives et destinations privées non recopiés depuis les blocs. |
| Pages publiques historiques | Projections des pages françaises sans droits explicites et des médias historiques de visibilité `all` conservées. |

## Vérifications automatisées

- `tests/test_m009a_public_projection_security.mjs` : marqueurs secrets fictifs dans les pages, blocs imbriqués, espaces, plans, listes D1, média général privé, traduction et révision de sauvegarde ; inspection de l'API JSON et du HTML anonyme.
- Suites de non-régression existantes : médias/publication, brouillons, M002, M006, M008-A, M008-D, rendu M12, préparation et site visiteur.
- Exécution intégralement hors production dans GitHub Actions, sans secrets de déploiement ; script navigateur Chromium à **1280 × 800** et profil smartphone **375 × 812** avec interception de toutes les requêtes.
- Flux CI : `.github/workflows/celebrations-m009a-public-projection-security.yml`. Le statut définitif est celui de GitHub Actions pour la dernière révision de cette PR.

## Limites et interventions suivantes

1. **Construction C — distribution d'objets et accès direct** : les règles d'autorisation de lecture des URL R2/media et les anciennes passerelles restent à vérifier. Filtrer le JSON/HTML ne protège pas une URL de fichier découverte par un autre canal.
2. **Administration / API existantes** : la sécurisation complète des routes de l'éditeur et les interfaces membres sont contrôlées par leurs missions dédiées ; la M009-A ne modifie pas les fichiers et routes attribués aux constructions B/C.
3. **Textes publiés volontairement** : aucune projection automatique ne peut reconnaître un secret volontairement saisi dans le texte d'une page déclarée publique. Contrôle éditorial humain conseillé avant publication.
4. **Compatibilité métier** : les plans de célébration en brouillon ne sont plus visibles anonymement ; ils restent accessibles dans l'éditeur. Les flux qui réutilisaient ce comportement doivent consulter l'administration et non une URL publique.
5. **Intégration** : vérifier de nouveau les protections en consolidation 009 après la réunion avec B/C et avant tout déploiement.

**Décision recommandée :** conserver la PR en brouillon tant que les vérifications et l'intégration avec les autres missions ne sont pas validées par le SUPERVISEUR.
