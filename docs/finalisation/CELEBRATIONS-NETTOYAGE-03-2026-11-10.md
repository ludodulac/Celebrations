# 🌸 CÉLÉBRATIONS — NETTOYAGE MISSION 3/6 : rangement GitHub

**Date : 10 novembre 2026.** Branche isolée `cleanup/celebrations-03-workflows-20261110`, issue de M2 `32d1938920faa9165ef282c52643d42b87ed8569`. **Aucune publication Cloudflare.**

## Objectif concret de la mission

Éviter qu'un ancien workflow de développement, conservé parmi des dizaines de tentatives de migration, puisse être confondu avec une méthode de déploiement actuelle ou exécuté par erreur. Préserver **intégralement** l'historique et les moyens de récupération. Ne pas supprimer les scripts fonctionnels du site.

## Actions effectuées

- **35 workflows historiques déplacés sans changement de contenu**, depuis `.github/workflows/` vers `docs/archive/workflows/` : 15 anciennes étapes B/C/D/E de l'éditeur, 20 workflows des missions de réorganisation 02–21. Tous visaient des anciennes branches de développement, des révisions historiques ou des opérations ponctuelles, et ne sont pas la méthode de publication actuelle.
- Leurs **35 blobs Git sont identiques** ; aucun fichier n'est perdu. Les scripts et les tests associés restent à leur emplacement original, car ils peuvent servir de documentation, de contrôle ou de récupération.
- Deux index ajoutés : `.github/workflows/README.md` pour le fonctionnement actuel et `docs/archive/workflows/README.md` avec l'inventaire individuel des 35 chemins et empreintes Git.
- Nombre de workflows exécutables dans `.github/workflows/` : **108 → 73**, puis **74 avec le nouveau workflow de test M3**, soit un retrait net de 34 fichiers YAML exécutables et **35 anciens workflows archivés**. Ce n'est PAS une affirmation que les 73 restants sont tous nécessaires : beaucoup sont volontairement conservés en attendant la remise à plat de la branche de référence en mission 4.
- Les workflows de sauvegarde chiffrée/restauration et la preuve de publication des missions de finalisation 03/05 n'ont pas été déplacés.
- **Aucun fichier de l'application, aucun script de build, aucun test préexistant, aucun média, aucune donnée et aucun secret ne sont modifiés.** Aucun workflow de production n'a été redéployé.

## Où se trouvent les outils maintenant ?

| Besoin | Emplacement |
| --- | --- |
| Site actuellement en ligne | Cloudflare Worker version `eccb1274-2ed8-491f-8557-c4330342e4bf`, source `release/celebrations-finalisation-05-livraison-20261109` |
| Code nettoyé M1/M2 + rangement M3 | `cleanup/celebrations-03-workflows-20261110`, **pas encore déployé** |
| Écriture/build production | `scripts/build_production_assets.py` et `scripts/prepare_production_wrangler.py`, à n'employer qu'avec un nouveau workflow de publication autorisé |
| Configurations du Worker | `migration/cloudflare/production-worker.mjs` et `migration/cloudflare/app/` |
| Sauvegardes indépendantes | `scripts/finalisation03_restore_offline.py` et `docs/finalisation/CELEBRATIONS-FINALISATION-MISSION-03-2026-11-09.md` |
| Anciens scripts de migration/probes | Toujours dans `scripts/` pour éviter de casser des dépendances ou la restauration ; ils ne sont **pas** la procédure normale de maintenance |
| Procédure et rollback Worker | `scripts/finalisation05_*.mjs` et `docs/finalisation/CELEBRATIONS-FINALISATION-MISSION-05-2026-11-09.md` |
| Anciens workflows administrateur B–E et refonte M02–M21 | `docs/archive/workflows/` (35 fichiers conservés) |
| Ancien site GitHub Pages `main` | `.github/workflows/pages.yml` **conservé**, car la réconciliation de `main` est exclusivement en mission 4 |

## Ce qui n'a volontairement PAS été fait

- Pas de suppression massive des **scripts**. Plusieurs fichiers anciens sont encore importés par des tests ou préservent la procédure d'un ancien transfert ; un déplacement sans vérification serait une fausse « simplification » susceptible de casser la reconstruction.
- Pas de suppression des workflows de récupération et des sauvegardes. Les opérations d'export/import entre comptes doivent être testées au moment de la mission 5/6.
- Pas de fusion vers `main` : branchage et publication seront réglés en mission 4/6.
- Pas de modification ni de tests destructifs de l'éditeur officiel.

## Validation ciblée

1. Comparaison `git diff` depuis M2 : **35 renommages conservant les blobs SHA et seulement deux fichiers README ajoutés** avant les fichiers de contrôle M3.
2. Vérification automatisée qu'aucun workflow déplacé ne reste exécutable sous `.github/workflows/`, et que les fichiers archivés sont **octet pour octet identiques** aux originaux du commit M2.
3. Contrôle que les workflows de sauvegarde, de publication et de QA sont toujours présents et identiques.
4. Suite locale des tests d'architecture et de sécurité, génération d'assets Cloudflare, **sans déploiement**.

**La mission 3 porte sur le rangement et les déclencheurs de GitHub, pas sur une réécriture des modules du site.** Les prochaines missions prévoient le choix d'une référence Git unique, la préparation du transfert Cloudflare et la dernière recette.

## Résultat réel du contrôle automatisé

**[GitHub Actions #42771643791](https://github.com/ludodulac/Celebrations/actions/runs/42771643791) : SUCCESS**, le 10 novembre 2026. Les tests ont confirmé :

- **35/35 workflows originaux présents dans leurs archives, strictement identiques octet par octet** au commit de base. Aucun de ces 35 fichiers n'est encore exécutable depuis `.github/workflows/`.
- **10/10 workflows de secours/production/QA contrôlés inchangés** et toujours présents au chemin GitHub Actions.
- **74 workflows actifs comme fichiers YAML** (93 après les 15 premiers, puis 73 après les 20 suivants, puis 74 avec le contrôle M3).
- **255/255 tests Node PASS** : 50 tests sécurité/rollback/compatibilité et 205 régressions de l'éditeur.
- Le build des assets Cloudflare et l'audit d'absence de liens réseau Supabase sur les assets reconstruits sont **PASS**.
- **Aucune modification de code applicatif, de script métier ou de test préexistant. Aucun déploiement, changement DNS ni écriture D1/R2.**

**MISSION 3/6 : TERMINÉE dans son périmètre de rangement historique contrôlé.** Les scripts sont intentionnellement conservés lorsqu'une absence de dépendance n'est pas prouvée. Le dépôt garde des workflows historiques qui pourront être rationalisés en mission 4, mais les 35 anciens déclencheurs B–E/M02–M21 ne sont plus exécutables.
