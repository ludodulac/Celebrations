# 🌸 CÉLÉBRATIONS — FINALISATION MISSION 5/5 — publication et livraison

**Date : 9 novembre 2026.** Domaine cible : `ronde-des-archanges-universelle.eu` et `www.ronde-des-archanges-universelle.eu`. Dépôt : `ludodulac/Celebrations`. Branche de livraison : `release/celebrations-finalisation-05-livraison-20261109`.

## 1 — Décisions du propriétaire, périmètre

Le propriétaire a explicitement demandé le 9 novembre de mener la dernière mission « publication et livraison » après avoir validé M1 à M4. Le nettoyage de code ne devait ni supprimer des contenus ni modifier le fonctionnement pour le visiteur/administrateur.

Les **PDF ne doivent être vérifiés que sur le domaine officiel** (avec et sans `www`). Les anciennes URL techniques `workers.dev` utilisées dans d'anciens courriels sont déclarées obsolètes, ne doivent pas être réouvertes et ne font pas partie des critères de livraison.

La **migration ultérieure vers un autre compte Cloudflare** reste une opération distincte et n'est pas autorisée dans cette mission. Pas de déplacement DNS, D1 ou R2 au cours de M5.

## 2 — Sauvegarde préalable et récupération

[M3 — rapport intégral](./CELEBRATIONS-FINALISATION-MISSION-03-2026-11-09.md) : 10 archives privées chiffrées dans le Google Drive du propriétaire, 303 objets R2, D1 19 tables / 12 797 lignes, état éditeur révision 117, source Worker + métadonnées, déchiffrement et restauration sur disque isolé 307/307. Les originaux R2 sont immuables dans cette mission ; aucune écriture D1/R2 n'est prévue.

**Attention :** la clé `CELEBRATIONS_BACKUP_PASSPHRASE` est conservée comme secret GitHub et doit être mise en sûreté séparément dans un coffre personnel du propriétaire avant transfert de compte. Les assets Worker historiques sont conservés par Cloudflare dans sa **version immuable précédente** ; le paquet M3 contient son script source et les métadonnées, mais **pas une attestation complète d'export autonome de chaque asset statique Cloudflare**. Le rollback de version Worker et la restauration des bases sont deux opérations distinctes.

## 3 — Identités exactes du Worker et des données

- Worker officiel : `celebrations-exit-production`, seul Worker lié aux deux domaines.
- Version officielle initiale : `dcda4193-1d82-4283-9f0e-ae8a09e6a444`.
- Déploiement officiel initial : `cd46e1ba-e106-4f03-90aa-7110628a5b9f`.
- **Nouvelle version immuable préparée, mais pas encore activée** : `eccb1274-2ed8-491f-8557-c4330342e4bf`.
- D1 production : `28736d2a-479b-472b-bf82-703ad0affe10`.
- Médias historiques : bucket R2 `celebrations-exit-production`.
- Brouillons et nouveaux médias éditoriaux : bucket R2 `celebrations-exit-staging`.
- Secret `ADMIN_PASSWORD_HASH` conservé, sans accéder à sa valeur.
- Adresse technique `celebrations-exit-production.rondes.workers.dev` et Preview URLs : désactivées ; cette protection doit rester intacte après publication.

## 4 — Preuves réellement obtenues avant publication

1. [M4 — recette réelle #42651661719](https://github.com/ludodulac/Celebrations/actions/runs/42651661719) **SUCCESS** : six contextes navigateur (trois hôtes × ordinateur/téléphone), **113/113 médias, 9/9 PDF sur chacun des deux domaines**, 0 erreur JavaScript/5xx, accès privés refusés, routes publiques fonctionnelles.
2. [M4 — site candidat corrigé #42638013803](https://github.com/ludodulac/Celebrations/actions/runs/42638013803) **SUCCESS** : le candidat a été déployé et la correction `__name` réellement testée ; nouveau code identique à celui de la version immuable officielle préparée.
3. [M5 — préflight #42669202035](https://github.com/ludodulac/Celebrations/actions/runs/42669202035) **SUCCESS** : domaines reliés au bon Worker, version initiale toujours active et disponible, secret d'administration et toutes les liaisons vérifiés, D1 19 tables/12 797 lignes, 113 médias + neuf PDF approuvés, sites officiels et API privée fonctionnels.
4. [M5 — upload sans publication #42669652110](https://github.com/ludodulac/Celebrations/actions/runs/42669652110) **SUCCESS** : nouvelle version `eccb1274-2ed8-491f-8557-c4330342e4bf` chargée par `wrangler versions upload --strict --keep-vars`, **ancien déploiement resté actif** après upload, adresse technique toujours désactivée.
5. [M5 — vérification de la nouvelle version #42670166482](https://github.com/ludodulac/Celebrations/actions/runs/42670166482) **SUCCESS** : version immuable récupérable (digests script ancien/nouveau différents), les cinq bindings essentiels présents, état de la version encore non publiée, snapshot R2 éditeur **révision 117** et ETag stable.
6. [M5 — exercice de rollback natif isolé #42670904017](https://github.com/ludodulac/Celebrations/actions/runs/42670904017) **SUCCESS** : deux versions **distinctes** du Worker de test `celebrations-visual-candidate` basculées par Cloudflare POST/GET deployment, restauration de l'ancienne version candidate, retour de l'accueil 200 et du refus privé 404. **Le Worker officiel est resté dans son déploiement initial**. Cet essai prouve la mécanique Cloudflare de retour arrière sur un Worker isolé, **pas une restauration de la version officielle sur un second compte**.

## 5 — Procédure de publication à déclenchement unique

Workflow exclusif `.github/workflows/celebrations-finalisation-mission-05-publish.yml` déclenché par `[M05_PUBLISH_OFFICIAL_ONCE]`, sur la branche ci-dessus et uniquement au premier essai du run, avec périmètre Git immuable : **aucun fichier applicatif modifié depuis la recette M4**, uniquement contrôles/tests/rapport M5.

- Préflight entier avant toute écriture : D1 en SELECT, anciennes/nouvelles versions immuables, bindings et domaines, protections de brouillons, accès visiteurs.
- **POST de déploiement Cloudflare uniquement** : version `eccb1274-2ed8-491f-8557-c4330342e4bf` à 100 % sur `celebrations-exit-production`. Aucune commande DNS ou `wrangler deploy` en M5. Les versions Cloudflare comprennent code, assets et bindings, mais pas les données D1/R2.
- Tests directs immédiatement après : accueil, mercredis, médiathèque générale, API publique et révision 117, API des brouillons 401, formulaire admin avec CSRF, POST anonyme de sauvegarde 401.
- Tests réels Chromium sur ordinateur/téléphone, les trois hôtes (candidat + deux officiels) avec zéro écriture, puis **113/113 médias**, **9/9 PDF sur chaque domaine officiel**, protections des deux sites de test, mauvais code administrateur refusé sans cookie de connexion.
- Contrôle final : version immuable active à 100 %, preview et adresse technique Worker désactivées.
- **Toute anomalie après activation déclenche le rollback exact** vers la version initiale, d'abord dans le script de promotion, puis via une deuxième étape indépendante `always() && failure()` ; le rollback refuse d'écraser la version d'un tiers. La commande gérée par Cloudflare restaure code, assets, bindings et paramètres de la version précédente ; **D1 et R2 ne changent pas**.

## 6 — Définition de livraison et points distincts

La publication ne peut être déclarée terminée que si le workflow de déploiement est **SUCCESS** et que les journaux confirment réellement la nouvelle version sur les deux domaines, les médias, PDF, protections et l'absence de rollback.

**Le parcours d'édition en session administrateur réellement connectée reste un contrôle d'usage à faire par le propriétaire** sur le site publié. Il ne faut pas prétendre avoir ouvert une vraie session sans son code de connexion. Les tests M4 couvraient les véritables gestionnaires sur une D1/R2 simulée.

Après livraison, tout travail de webmaster doit partir de **cette branche de livraison** et viser le nouveau compte Cloudflare seulement lors de la migration séparée demandée. Le fait que les anciennes PR de nettoyage restent DRAFT ne signifie pas que la version Cloudflare publiée soit issue de `main` : le **commit de livraison et l'ID de version Cloudflare** font foi.

## 7 — RÉSULTAT RÉEL : PUBLIÉ ET CONTRÔLÉ ✅

**[GitHub Actions #42672508843](https://github.com/ludodulac/Celebrations/actions/runs/42672508843) — SUCCESS**, le **9 novembre 2026 vers 18:18 UTC**. Le déclenchement a été réalisé seulement après le contrôle des versions immuables et la répétition du rollback sur le candidat isolé.

| Vérification de publication | Constat réel |
| --- | --- |
| Worker actif sur les deux domaines | `celebrations-exit-production` |
| **Nouvelle version active à 100 %** | **`eccb1274-2ed8-491f-8557-c4330342e4bf`** |
| **Nouveau déploiement Cloudflare** | **`ffdc7b2b-a443-45cf-843d-0419fe71cb8d`** |
| **Version précédente préservée pour rollback** | `dcda4193-1d82-4283-9f0e-ae8a09e6a444` |
| Deux noms officiels HTTP 200 | **2/2** |
| Pages directes, médiathèque, menu et célébrations | **PASS** |
| Éditeur sans connexion : brouillons GET et sauvegarde POST | **401 — protégés** |
| Formulaire administrateur avec CSRF | **2/2 PASS** |
| Mauvais code administrateur | **2/2 rejeté 303, zéro cookie de session** |
| Navigateurs Chromium réel (candidat + deux officiels × desktop/mobile) | **6/6 PASS**, 0 erreur JS / 5xx / scroll horizontal |
| Fichiers médias publics | **113/113 PASS** |
| PDF accessibles sur le domaine officiel sans `www` | **9/9 PASS** |
| PDF accessibles sur le domaine officiel avec `www` | **9/9 PASS** |
| Lien PDF non autorisé/inconnu | **404** |
| Anciennes routes privées des deux sites de test | **8/8 refusées** |
| Ancienne adresse technique Workers.dev du site officiel | **Désactivée**, Preview URLs aussi |
| R2/D1/DNS | **0 écriture de contenu / aucune migration** |
| Rollback de production exécuté | **Non, car aucun échec après publication** |
| Ancien Worker immuable récupérable via Cloudflare | **Oui, version d'avant conservée** |

**Conclusion de la mission 5 : PUBLICATION TECHNIQUE ET CONTRÔLES AUTOMATISÉS TERMINÉS.** Les journaux attestent une nouvelle version réelle, non une simple branche préparée. La procédure de rollback était armée et avait été répétée sur le candidat isolé, mais n'a pas été nécessaire en production.

### Validation administrateur encore manuelle

Le véritable **code d'accès administrateur** n'a **pas** été communiqué ni utilisé. Le formulaire de connexion est bien rendu et son mécanisme de refus a été testé en conditions réelles ; les opérations d'édition/enregistrement/publication ont été vérifiées automatiquement avec les vrais gestionnaires de code et un stockage **simulé** dans la mission 4, pas avec une session authentifiée en production. **Le propriétaire doit donc faire une vérification finale dans l'administration officielle** : se connecter avec son code, ouvrir une page existante, contrôler les médias et l'aperçu, et si nécessaire tester un changement sans publication puis l'annuler. Ne pas toucher aux vraies pages destinées aux visiteurs pour un test destructif. Cela n'enlève pas la réussite de la publication, mais empêche de promettre une recette « humain connecté » qui n'a pas eu lieu.

### Remise et poursuite du travail de webmaster

Le site de référence livré reste `https://www.ronde-des-archanges-universelle.eu` ; l'administration sur `/admin.html`.

**Source de référence pour les prochaines corrections :** branche GitHub `release/celebrations-finalisation-05-livraison-20261109`, dérivée de toutes les missions de finalisation. Les PR historiques empilées restent **DRAFT**, et le dépôt `main` n'est **pas** présumé représenter la version hébergée actuellement sur Cloudflare ; ne pas le déployer directement. Toute modification ultérieure doit partir de cette branche, passer les tests et conserver les paramètres d'authentification et de stockage.

**Sauvegarde hors Cloudflare :** dossier privé Google Drive `SAUVEGARDES PRIVEES - Celebrations - 2026-11-09`, 10 archives chiffrées ZIP vérifiées, environ 838 Mo. **Le secret de déchiffrement doit être sauvegardé séparément par le propriétaire.** Ne jamais inclure la clé en clair dans un courriel, une PR ou le site public.

**Transfert au compte Cloudflare du collègue (ULTÉRIEUR ET DISTINCT) :** créer les ressources D1 et R2 du nouveau compte, importer les **deux** buckets utilisés par la version actuelle (médias historiques d'un côté, brouillons/nouveaux médias de l'autre) et la base D1, rétablir secrets et bindings, tester le site sur un environnement indépendant, basculer ensuite les domaines, vérifier administration/visiteurs, puis seulement **supprimer les ressources de l'ancien compte** pour libérer l'espace. Ne pas laisser le nouveau site pointer vers les anciens buckets du compte actuel ; ne pas désactiver les anciennes ressources avant vérification du nouveau site.

**PDF : conserver uniquement les URL du domaine officiel ; ne jamais réouvrir les anciennes URL Workers.dev**, explicitement déclarées obsolètes par le propriétaire.

### Bilan des cinq étapes

- **Finalisation 1/5 :** intégration du code sur la branche de livraison, tests de régression.
- **Finalisation 2/5 :** routes privées des environnements techniques fermées, adresse Workers.dev officielle désactivée.
- **Finalisation 3/5 :** sauvegarde chiffrée du contenu et données réelles sur Drive indépendant, restauration isolée 307/307.
- **Finalisation 4/5 :** recette sur navigateur, correction réelle `__name`, médias 113/113, PDF 9/9 sur deux hôtes.
- **Finalisation 5/5 :** **déploiement officiel réussi**, version immuable vérifiée et ancien Worker conservé.

**Le transfert de compte Cloudflare et la validation finale avec un véritable code administrateur ne font pas partie des cinq missions de nettoyage et livraison automatisée.**

