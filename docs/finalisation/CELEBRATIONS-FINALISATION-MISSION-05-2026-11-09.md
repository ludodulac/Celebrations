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

**Statut au déclenchement : publication autorisée et test automatique lancé ; résultat réel à consigner après l'exécution.**
