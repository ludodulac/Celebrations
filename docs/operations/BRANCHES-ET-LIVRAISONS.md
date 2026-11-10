# 🌸 CÉLÉBRATIONS — RÉFÉRENCE UNIQUE POUR GITHUB ET CLOUDFLARE

> **MISE À JOUR APRÈS PUBLICATION M6 — 10 novembre 2026.** Le nettoyage M1–M6 a été **réellement publié** : Worker `celebrations-exit-production`, version `081f5367-1f37-421e-bc55-27999cf2562c`, déploiement `51a8bff3-d3cf-4cc1-99e8-af00c9b31443` (preuve [Actions #42813315981](https://github.com/ludodulac/Celebrations/actions/runs/42813315981)). **Source Git exacte de la version publiée :** `production/celebrations-live` à `4dda3de63066ea51e4c99f0ef21255dfb4d0fcb9`. La branche `develop/celebrations-maintenance` a été alignée sur cette source pour le prochain travail. L'ancien `main` et son archive restent inchangés. Les détails M4 ci-dessous décrivent **l'état historique avant cette publication** ; ne plus utiliser l'ancien ID M5 comme version courante. Voir `docs/finalisation/CELEBRATIONS-NETTOYAGE-06-2026-11-10.md` et `BRANCHES-ET-LIVRAISONS.json` pour l'état final.\n\n---\n\n## Mission 4/6 — 10 novembre 2026

Ce document règle la confusion entre le **code réellement publié** sur le domaine officiel et l'ancien `main` GitHub Pages. Il **n'active aucune publication** et **ne modifie ni Cloudflare ni le site**.

### Les 3 références à ne jamais confondre

| Rôle | Branche | Code ou données exacts | Consigne |
| --- | --- | --- | --- |
| **PRODUCTION / version livrée** | `production/celebrations-live` | Code M5 `65caf8d5d03d29882d0de0c0d00cdcfc622e473e` | **Ne pas déplacer cette branche** sans release effectivement publiée puis vérifiée |
| **DÉVELOPPEMENT / prochaine livraison** | `develop/celebrations-maintenance` | Base de la branche de mission 4, descendant des nettoyages M1, M2, M3 | **Toujours partir d'ici** pour changer l'application ou préparer la migration |
| **ARCHIVE HISTORIQUE** | `archive/celebrations-old-main-20261110` | Ancien `main` au commit `4b5edd9c19ce989af2eae33445017dd30fcbbe92` | **Ne jamais publier** cette branche dans Cloudflare |

**Cloudflare source active livrée en M5 :** Worker `celebrations-exit-production`, version `eccb1274-2ed8-491f-8557-c4330342e4bf`, déploiement `ffdc7b2b-a443-45cf-843d-0419fe71cb8d` sur le domaine racine et `www`, selon les contrôles de la mission 5 du 9 novembre 2026. La preuve de cette livraison se trouve dans `docs/finalisation/CELEBRATIONS-FINALISATION-MISSION-05-2026-11-09.md`. **Le fait qu'une branche existe ne démontre pas que son code a été publié** ; seule la version immuable Cloudflare confirmée constitue une preuve.

### Pourquoi `main` n'a pas été écrasée

La branche `main` était **divergente : 3 commits non présents dans la livraison Cloudflare**, et la branche Cloudflare a **1780 commits d'avance**. De plus, `.github/workflows/pages.yml` publie **automatiquement GitHub Pages à chaque `push` vers `main`**. Faire un `force push` pour transformer `main` en Cloudflare aurait donc pu altérer l'ancien site GitHub Pages et perdre la référence des trois commits. **Ce n'est pas nécessaire au nettoyage du Worker : interdit dans cette mission.**

Avant d'aligner `main` ou de changer la branche par défaut sur GitHub, il faut vérifier séparément s'il existe encore des usagers du site GitHub Pages historique et désactiver/reconfigurer le déclenchement automatique, sans perturber le domaine Cloudflare. **La branche par défaut reste `main`** après cette mission, car la connexion GitHub utilisée ne permet pas de modifier ce paramètre de dépôt : ce détail reste signalé et explicite. On peut **développer correctement dès maintenant** en sélectionnant `develop/celebrations-maintenance`.

### Procédure courte pour la prochaine modification

1. Sélectionner **`develop/celebrations-maintenance`** comme branche de départ ; créer une branche `feature/...` ou `fix/...` depuis ce HEAD exact.
2. Modifier uniquement les fichiers utiles ; conserver la séparation des brouillons privés, les contrôles d'accès, les médias historiques et les PDF du domaine officiel.
3. Tester hors production (Node, sécurité, build `python scripts/build_production_assets.py` + `python scripts/audit_production_supabase_paths.py`, et browser ciblé si l'interface change). Une PR vers la branche `develop` suffit : **aucun lien `main` / Cloudflare implicite**.
4. Préparer un **candidat Cloudflare isolé et lecture seule**, une sauvegarde indépendante vérifiée, le contrôle de la version Worker courante et un rollback par ID exact.
5. Ne déployer qu'après autorisation explicite ; confirmer les domaines racine/`www`, les PDF officiels, les médias, les accès privés et les principales fonctions. **Ne mettre à jour `production/celebrations-live` qu'après succès de la mise en ligne** et seulement vers le SHA effectivement livré. Mise à jour M6 : les commits M1–M6 sont désormais publiés et vérifiés, et la branche production pointe sur le commit exact de livraison.
6. Pour une migration sur le compte d'un collègue, prendre la base `develop`, refaire les bindings R2/D1/secret/Worker dans le **nouveau compte**, tester une copie indépendante, puis seulement transférer DNS/domaine avec son accord (missions 5/6). Ne jamais réutiliser des identifiants de compte Cloudflare comme valeurs universelles du logiciel.

### Livrables et garde-fous

- `README.md` : tableau du bon point de départ en tête du dépôt Cloudflare.
- Ce guide : historique, référence stable et procédure de maintenance.
- `docs/operations/BRANCHES-ET-LIVRAISONS.json` : noms de branches et provenance publiées dans un format que les tests peuvent contrôler.
- `.github/workflows/celebrations-cleanup-04.yml` : tests bornés **sans droits de publication**, notamment preuve que la branche `production` correspond à M5, que l'ancien `main` est archivé exactement, et que le code actif n'a pas changé pendant M4.

**Seul élément manuel restant :** changer si souhaité la *branche par défaut GitHub* depuis **Settings → Branches → Default branch** vers `develop/celebrations-maintenance`, **après** vérification des éventuels workflows et règles GitHub Pages et des droits nécessaires. Ce changement de paramètre n'est pas simulé comme « fait » et n'est pas indispensable à la maintenance de Cloudflare.

**Mission 4 limitée au classement Git :** aucun changement applicatif, de données D1/R2, de secret, de DNS ou de version Worker.
