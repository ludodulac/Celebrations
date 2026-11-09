# 🌸 CÉLÉBRATIONS — MISSION 19 : sauvegardes réelles et inventaire de récupération

**Date : 9 novembre 2026.** Branche de contrôle `audit/celebrations-mission-19-backups-20261109`, dérivée du HEAD M18 `d2bbbbdd4db9b4db9f9ea36b7c8b0d4c6ea746af`. Cette mission ne modifie aucun fichier applicatif et ne publie rien sur le site officiel.

## Règles de sécurité de la mission

- **Aucun déploiement, aucun rollback, aucune modification de l'objet éditorial actif, des médias, de D1, du DNS ou des pages publiques.**
- Les seules opérations Cloudflare autorisées : lecture des métadonnées du Worker officiel via GET, métadonnées D1 via GET, lecture d'objet R2 et inventaire paginé via LIST, requêtes D1 `SELECT` via l'API Cloudflare (POST HTTP mais SQL strictement en lecture) et vérification HTTP HEAD des médias et PDF, **plus une seule écriture R2 nouvelle sous préfixe de sauvegarde privée chiffrée** lors du commit explicitement marqué `[M19_PRIVATE_ARCHIVE_ONCE]`.
- L'écriture R2 archivée réutilise le code et les barrières M03 : clé aléatoire non réutilisée, AES-256-GCM, validation de l'ETag de l'original, relecture, déchiffrement et comparaison exacte en mémoire. Aucun fichier en clair n'est publié dans GitHub.
- **Interdit :** appeler l'API d'export D1 sur la base officielle en pleine activité. La documentation Cloudflare avertit que cet export peut rendre D1 temporairement indisponible. La restauration exacte Worker et la sauvegarde D1 doivent être organisées à part, sans interruption du site.
- PR **DRAFT**, aucune fusion ni déploiement.
- **Ce rapport distingue strictement les preuves de sauvegarde acquises et les protections encore absentes.**

## Contrôles mis en place

| Partie | Examen réel / procédure | Limite |
| --- | --- | --- |
| Version Worker | Script M16 d'observation GET uniquement, nouvelle date de constat | Identifiant seul ≠ bundle complet et restaurable |
| Snapshot des pages | Relecture et validation du JSON R2 actuel, chiffrement, archive privée nouvelle avec relecture et restauration RAM | Archive interne au même compte Cloudflare, sans couverture des médias |
| Médias téléversés | Parcours paginé des métadonnées sous `editor-trials/uploads/`, uniquement compte/taille | Le LIST ne démontre pas une copie des octets |
| Médias historiques R2 | Tentative de parcours paginé des métadonnées du bucket de production avec les identifiants existants | Si accès interdit, signaler « indisponible », jamais « zéro média » |
| D1 | GET de métadonnées, et ancien contrôle SELECT des médias publics | Ni export SQL complet ni restauration transactionnelle |
| Accès au site public et documents | Script existant : contrôle des 113 médias approuvés et neuf liens PDF historiques sur les hôtes prévus, sans écriture | Disponibilité constatée, pas une sauvegarde des fichiers |
| Fichiers sensibles | Aucune donnée privée, clé R2, URL signée, nom de média ou phrase secrète imprimés dans les journaux | Ne pas déposer un snapshot privé en artefact d'un dépôt GitHub public |

## Vérification et preuves attendues

Le workflow `.github/workflows/celebrations-mission19-live-backup.yml` s'exécute sur la branche M19, avec accès à l'environnement GitHub existant `celebrations-staging`. Il utilise le script déjà éprouvé de M03 pour produire une sauvegarde R2 privée chiffrée **une seule fois** sur un commit marqué. Les autres commits n'en créent aucune. La restauration est strictement isolée en RAM ; aucun test n'écrase le JSON réel. La lecture en direct de D1 et de R2 peut être refusée en cas de permissions insuffisantes : le refus est un résultat à documenter, pas un motif pour contourner les restrictions.

## Résultats de l'exécution M19 réelle — 9 novembre 2026

**[GitHub Actions M19 #42606769918](https://github.com/ludodulac/Celebrations/actions/runs/42606769918) : SUCCESS**, sur le commit `13168da2a7dd97ff6eef1b0d8fc9b45cc00c216f`. Le job et toutes les étapes ont réussi. Des secrets GitHub de l'environnement `celebrations-staging` ont été utilisés sans être imprimés. **Aucun changement applicatif, aucune fusion, aucun déploiement.**

### A. Sauvegarde privée réelle du document éditorial — SUCCÈS, mais partielle

- R2 actif `celebrations-exit-staging`, clé source `editor-trials/server-drafts-v1.json` ; **révision actuelle constatée 117**, **199 215 octets** ; le contrôle précédent M03 portait sur la révision 114.
- État conservé dans la sauvegarde : **1 célébration, 8 pages, 8 pages publiées, 1 page générale publiée**, catalogue de **120 entrées média**.
- **Nouvelle archive chiffrée AES-256-GCM de 199 296 octets**, écrite sous `private-backups/mission03-editor/` avec une clé privée aléatoire **sans remplacer l'état courant**.
- Archive réellement **relue depuis R2**, déchiffrée et reconstruite en RAM. **Égalité parfaite des octets et empreintes de la source**. L'ETag de la source est demeuré inchangé.
- **8/8 tests Python de chiffrement/validation PASS**. Aucune donnée en clair envoyée dans GitHub.
- **Limite majeure :** le JSON ne contient pas les octets de tous les médias ; la nouvelle archive reste dans **le même compte Cloudflare**. Ce n'est pas une copie hors Cloudflare et pas une restauration intégrale du site.

### B. Médias R2 et documents historiques — disponibilité vérifiée

- Listing paginé réel de `editor-trials/uploads/` : **1 objet**, **86 096 octets**, métadonnées uniquement. Les octets de cet objet n'ont pas été archivés ni restaurés.
- Listing direct du bucket R2 des médias historiques : **indisponible avec les droits de l'identifiant utilisé** (`ClientError`). Cela ne signifie ni absence des objets ni corruption du bucket.
- Sur le domaine officiel : **113/113 médias publics accessibles** au contrôle HTTP HEAD.
- **9/9 PDF historiques accessibles** sur le domaine officiel et sur chacun des deux anciens hôtes testés. Fausse invitation refusée en **HTTP 404**.
- Ces tests confirment des routes publiques **accessibles**, pas l'existence d'une copie indépendante de chaque binaire.

### C. Worker et D1 réelle — métadonnées vérifiées, sauvegarde non faite

- Version active Worker observée via **GET Cloudflare le 9 novembre 2026 à 11:10:06 UTC** : déploiement `cd46e1ba-e106-4f03-90aa-7110628a5b9f`, version `dcda4193-1d82-4283-9f0e-ae8a09e6a444` ; version servie à 100 % au dernier relevé M16. Aucun bundle complet téléchargé, aucune restauration.
- D1 production retrouvée et vérifiée par GET : **19 tables**, fichier déclaré de **5 521 408 octets**. La base n'a subi aucune écriture dans ces contrôles.
- **Aucun export D1 déclenché** : l'API Cloudflare d'export peut temporairement empêcher D1 de servir des requêtes. Il serait imprudent de l'exécuter sans une fenêtre contrôlée ou une stratégie de continuité. Ce contrôle **n'est pas une sauvegarde D1**.

### D. Bilan opérationnel

| Question | Verdict démontré |
| --- | --- |
| L'état éditorial présent le 9 novembre est-il archivé et déchiffrable ? | **OUI**, révision 117, dans le même Cloudflare, retour en mémoire exact |
| Les pages, les médias et les PDF du site actuel ont-ils été modifiés ? | **NON** dans le workflow M19 |
| Les médias historiques et PDF publics répondent-ils ? | **OUI**, 113 médias et neuf PDF sur les trois hôtes requis |
| Le Worker est-il récupérable octet par octet ? | **NON CERTIFIÉ** |
| D1 entière est-elle exportée et restaurée ? | **NON** |
| Tous les fichiers R2 sont-ils copiés et restaurés ? | **NON** |
| Une sauvegarde indépendante, durable et confidentielle hors Cloudflare existe-t-elle ? | **NON ATTESTÉ** |
| Peut-on publier maintenant ? | **NON — NO-GO** |

**Conclusion : M19 a réussi son archivage réel du snapshot éditorial et ses contrôles de disponibilité, mais la récupération complète reste NON CERTIFIÉE.** Ne pas fusionner ni déployer la refonte à partir de ce seul succès.

## Ce qui reste bloquant avant publication, même avec une sauvegarde M19 réussie

1. **Worker réellement restaurable** : archiver code, assets, bindings et configuration exacts ; exécuter une restauration isolée avec la version identifiée le jour de la publication.
2. **D1 entière, sans interrompre le service** : planifier une fenêtre sûre, exporter l'intégralité SQL dans un contexte maîtrisé, restaurer sur SQLite/D1 isolée, vérifier toutes les lignes/tables/index et la cohérence.
3. **Tous les binaires** : copie indépendante des octets R2 (historiques, nouveaux médias, PDF) avec chemins et empreintes, puis restauration isolée vérifiée.
4. **Copie indépendante de Cloudflare durable et confidentielle** de la sauvegarde éditoriale chiffrée. Ne pas transférer les brouillons privés dans un artefact publiquement accessible.
5. **Protection du staging hérité et des médias non publiés**, plus recette utilisateur connectée sur candidat isolé.
6. **Consentement explicite** du propriétaire sur une future version précise, son inventaire et son plan de rollback. Aucune permission implicite ici.

**Verdict publication : NO-GO tant que l'ensemble de ces points n'est pas attesté.** Mission 19 = diagnostic et sauvegarde privée de l'état éditorial, pas certification de récupération intégrale du site.
