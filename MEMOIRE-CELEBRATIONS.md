# MÉMOIRE — Célébrations des Archanges

**Mise à jour : 19 novembre 2026.** Document de continuité pour les prochaines conversations et interventions. **À tenir à jour après chaque mission.** Il décrit les éléments identifiés et les points à vérifier ; il ne prétend pas être un inventaire exhaustif de tous les fichiers, objets R2, tables D1, secrets ou branches historiques.

## 1. Site et objectif

- Site officiel : https://www.ronde-des-archanges-universelle.eu
- Dépôt GitHub : https://github.com/ludodulac/Celebrations
- Hébergement officiel : Cloudflare Workers, base D1, stockage médias R2.
- Worker de production identifié : `celebrations-exit-production`.
- Objectif de maintenance : code simple, stable, sans dépendance active à Supabase ; préserver les contenus et les droits d'accès ; vérifier les fonctions visiteurs et administration avant tout déploiement.
- **Attention : le site officiel et la branche de travail ne sont pas la même chose.** Une modification GitHub non déployée n'affecte pas nécessairement le Worker en ligne.

## 2. Références GitHub

- Source officielle historique du Worker : branche `production/celebrations-live`. Le README du dépôt indique une livraison M6 du 10 novembre 2026 au commit `4dda3de63066ea51e4c99f0ef21255dfb4d0fcb9`. **À revérifier pour déterminer le déploiement réellement actif aujourd'hui.**
- Branche de maintenance recommandée par le README : `develop/celebrations-maintenance`.
- Ancien `main` : historique GitHub Pages ; ne pas supposer qu'il représente le Worker en production.
- Archive de l'ancien site : `archive/celebrations-old-main-20261110`.
- Branche des corrections en cours : `fix/m051-program-media-preview-colors-20261119`.
- PR de travail : https://github.com/ludodulac/Celebrations/pull/185 — **ne pas fusionner automatiquement** : branche très divergente de `production/celebrations-live`, avec de nombreux fichiers modifiés.
- Documentation existante : `README.md`, `docs/operations/BRANCHES-ET-LIVRAISONS.md`, `docs/operations/TRANSFERT-CLOUDFLARE.md`, `docs/finalisation/CELEBRATIONS-NETTOYAGE-06-2026-11-10.md`.

## 3. Architecture identifiée

**Visiteurs :** pages d'accueil, programme, journées (mercredi, jeudi, vendredi, samedi, dimanche), après-célébration, bibliothèque, après-la-ronde, pages légales, contenus et médias selon visibilité et permissions.

**Administration :** pages et blocs éditables, célébrations, publications, médiathèques, participants et identités, statistiques, documents et audio. Les sessions et autorisations administrateur/participant doivent rester séparées.

**Cloudflare :**
- Workers : interface/API de production, notamment `migration/cloudflare/production-worker.mjs` dans le dépôt ; comparer au code réellement déployé.
- D1 : contenus, paramètres de publication, autorisations, participants, statistiques ; **schéma, identifiant de base et tables exactes à inventorier depuis Cloudflare, sans exposer de secrets**.
- R2 : images, PDF, fichiers audio et autres médias ; **noms de buckets, clés et volumes à confirmer sur le compte actif**. Ne pas supprimer d'objets pendant le nettoyage.
- Secrets et domaines : à contrôler via la configuration Cloudflare ; ne jamais copier leurs valeurs dans cette mémoire.

**Fichiers de migration et contrôle :**
- `cloudflare-client.js`, `cloudflare-data.js`, `public-cloudflare-boot.js`, `admin-cloudflare-core.js` : noms adoptés sur la branche de travail.
- `migration/cloudflare/preview-client.js` : adaptateur API Cloudflare.
- `scripts/build_staging_assets.py` et `scripts/build_production_assets.py` : assemblage statique hors ligne.
- `scripts/audit_production_supabase_paths.py` : vérifie les références réseau Supabase et l'ancien SDK d'envoi dans les fichiers générés.
- `tests/test-exit-*.mjs` : batterie de tests automatisés.

## 4. Changements effectués sur la branche de travail (non déployés)

1. Renommage de plusieurs modules et références de l'ancien client Supabase vers Cloudflare.
2. Suppression de l'ancienne URL d'image Supabase dans `index.html` ; **contrôler l'image d'accueil et sa clé R2 avant publication**.
3. Statistiques administrateur : suppression du repli RPC obsolète, requête vers l'API Cloudflare.
4. Pages légales : correction du nom de variable `CELEBRATIONS_CLOUDFLARE_BACKEND`.
5. Mise à jour des tests de migration avec les nouveaux noms du client.
6. Neuf pages autonomes (`programme`, `mercredi`, `jeudi`, `vendredi`, `samedi`, `dimanche`, `apres-celebration`, `bibliotheque`, `apres-la-ronde`) : remplacement des chargements Supabase par Cloudflare.
7. Révision des scripts de génération et suppression du script externe `tus-js-client` dans l'administration.

**Dernière CI examinée :** 99 tests sur 99 réussis ; construction staging et production réussie ; audit des fichiers de production générés : 0 référence d'hôte Supabase, 0 SDK Supabase, 0 SDK tus. **Le workflow global est encore rouge** car une étape de contrôle des pages autonomes recherche les anciens noms `CELEBRATIONS_STAGING_BACKEND` et `supabase-*.js`. Il faut corriger cette étape sans affaiblir ses assertions. Ces réussites ne constituent pas un test navigateur réel ni une validation de production.

## 5. Missions restantes — ordre de réalisation

- [ ] **Mission 1 — Cartographie fiable :** inventorier les fichiers actifs, la branche réellement déployée, le Worker et les ressources Cloudflare ; distinguer code historique et code actif.
- [ ] **Mission 2 — Nettoyage Supabase :** rechercher toutes les références encore actives, éliminer les dépendances inutiles, conserver les archives nécessaires et ne jamais supprimer les données.
- [ ] **Mission 3 — Vérification Cloudflare :** contrôler Worker, routes, D1, R2, médias, paramètres et droits d'accès, sans divulguer les secrets.
- [ ] **Mission 4 — Tests automatisés :** actualiser l'étape CI de contrôle des neuf pages autonomes ; exiger tous les tests et builds au vert.
- [ ] **Mission 5 — Tests fonctionnels :** visiteurs et administration, enregistrement/publication, pages et blocs, liens, PDF, audio, images, ordinateur et mobile. Noter les contrôles réellement effectués.
- [ ] **Mission 6 — Sécurité et consolidation :** permissions, séparation des sessions, sauvegardes/restauration, contrôle des contenus et suppression du code mort.
- [ ] **Mission 7 — Livraison :** comparer proprement les différences à la branche de production, éviter la fusion massive de l'historique, préparer un déploiement contrôlé, vérifier le site après publication et mettre à jour ce document.

## 6. Précautions impératives

1. **Ne jamais fusionner PR #185 directement dans la branche de production sans revue de la divergence et des fichiers modifiés.**
2. **Ne pas effacer de tables D1, d'objets R2, de secrets, ni de branches historiques sans inventaire, sauvegarde et accord explicite.**
3. Ne pas confondre « tests Node réussis », « build réussi », « navigateur testé » et « site officiel déployé ».
4. Préserver les pages, médias et publications créés par les administrateurs.
5. Chaque mission doit aboutir à un résultat vérifié, documenté ici avec commit, tests et limites.

## 7. Journal de validation

| Date | Contrôle | Résultat |
| --- | --- | --- |
| 19/11/2026 | Tests Node de migration sur PR #185 | 99/99 réussis lors de la dernière CI examinée |
| 19/11/2026 | Build statique staging + production | Réussis |
| 19/11/2026 | Audit des références réseau Supabase dans les assets produits | 0 hôte, 0 SDK Supabase, 0 SDK tus |
| 19/11/2026 | Vérification CI des pages autonomes | **Échec : assertions CI obsolètes** |
| 19/11/2026 | Tests navigateurs / Worker de production / fusion | **Non validés** |

**Règle :** modifier cette page au fur et à mesure des interventions, en remplaçant les points « à vérifier » uniquement après contrôle réel.
