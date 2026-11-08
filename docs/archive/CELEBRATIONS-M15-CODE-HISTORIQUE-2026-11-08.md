# Archive réversible — anciennes commandes du prototype CÉLÉBRATIONS (M15)

Ces fonctions ne sont plus incluses dans le JavaScript envoyé à l'administration
après la mission 15. **Ce document conserve leur provenance et permet leur
récupération sans embarquer du vieux code dans le Worker.**

## Révision authentique avant retrait

- Dépôt : `ludodulac/Celebrations`
- Commit de base : `5e0155b3d816f8ac6f2912a1d202955b315bf005` (mission 14)
- Fichier : `migration/cloudflare/editor-demo-client.mjs`
- Composition historique : `DEMO_CLIENT = segment 0 + EDITOR_MODULES + segment 1 + SERVER_EDITOR_SYNC + segment 2`

## Fonctions archivées, sans effacement de l'historique Git

| Segment | Fonction | Taille supprimée, bornes incluses |
|---|---|---:|
| 1 | `attachFile` | 281 |
| 1 | `deleteSelectedImages` | 157 |
| 1 | `historicalUnused` | 82 |
| 1 | `insertBlockAtTime` | 540 |
| 1 | `showInsertDialog` | 5 674 |
| 1 | `attachPublicAudio` | 369 |
| 1 | `attachCloudAudio` | 339 |
| 2 | `audioWorkbench` | 855 |
| | **Total extrait du navigateur** | **8 297** |

Ces suppressions concernent **uniquement les fonctions sans appels** dans
le vrai script composé. Elles n'effacent aucune page, aucun fichier,
aucun ancien média ni aucun service Cloudflare.

## Pour inspecter l'ancien code

Depuis une copie de travail du dépôt GitHub :

```bash
git show 5e0155b3d816f8ac6f2912a1d202955b315bf005:migration/cloudflare/editor-demo-client.mjs
```

La ligne exportée est une chaîne JS JSON découpée autour de l'injection
de modules. Pour examiner une fonction, décoder les segments de chaîne
avant le `+EDITOR_MODULES+` et après celui-ci, et rechercher sa
déclaration. Il **ne faut pas restaurer ces fonctions automatiquement** :
toute réintroduction doit être motivée par une fonctionnalité réellement
demandée, avec contrôle de sécurité et tests d'interaction.

Les adaptateurs et modules actifs doivent toujours être préférés :
`editor-media-commands.mjs`, `editor-media-catalogue.mjs`,
`editor-block-commands.mjs`, `editor-drag-model.mjs` et
`editor-undo-policy.mjs`.

## Fichiers de compatibilité non supprimés

La gestion des anciennes URLs `/media/`, `/letter/`, des redirections
et des anciennes pages de staging demeure dans les modules historiques
originaux. Une suppression future nécessitera un nouvel audit des appels
réels et des tests de régression, **pas une présomption d'obsolescence**.
