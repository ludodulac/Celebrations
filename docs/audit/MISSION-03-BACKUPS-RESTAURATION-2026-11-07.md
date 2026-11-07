# CÉLÉBRATIONS — MISSION 03
## Sécurisation des sauvegardes et répétition de restauration isolée

**Date :** 7 novembre 2026  
**Dépôt :** `ludodulac/Celebrations`  
**Branche de mission (DRAFT, sans déploiement) :** `audit/celebrations-mission-03-backups-20261107`  
**Référence de l'application :** branche `fix/celebrations-inline-validation-20261105`, commit `7cbfdbd79e2b40f8f4ca4b46dbc97d47e26b742d`.  
**Preuve principale :** GitHub Actions [42382798457](https://github.com/ludodulac/Celebrations/actions/runs/42382798457), conclusion **SUCCESS**, sauvegarde privée chiffrée et récupération intégrale en RAM.

> Cette mission n'autorise aucun remplacement du fichier R2 des pages, aucun déploiement Worker, aucune restauration D1 en production ni aucune publication de brouillon. Elle vérifie une récupération isolée et documente honnêtement les risques subsistants.

## 1 — Ce qui a été effectivement vérifié et créé

### 1.1 Sauvegarde de l'état ACTUEL de l'éditeur

Le script `scripts/mission03_editor_private_backup.py` a lu l'objet véritable :
`EDITOR_BUCKET = celebrations-exit-staging`  
`editor-trials/server-drafts-v1.json`

L'éditeur du domaine officiel est bien relié à ce bucket R2 **partagé**, distinct du bucket de médias historiques `celebrations-exit-production`. Le mot « staging » dans le nom du bucket ne signifie pas que ces données ne sont que des essais : elles alimentent **l'administration et les pages publiées actuelles**. Ne pas les effacer.

| Élément du snapshot lu | Valeur constatée |
| --- | ---: |
| Révision R2 | **114** |
| Taille JSON original | **199 168 octets** |
| Empreinte SHA-256 (préfixe, preuve non secrète) | `ebfd6024c89a604c` |
| Dossiers de célébration dans l'éditeur | **1** |
| Pages dans le document de célébration | **8** |
| Pages publiées de cette célébration | **8** |
| Pages générales | **1** |
| Pages générales publiées | **1** |
| Entrées dans le catalogue des médias | **120** |

Une **nouvelle sauvegarde privée chiffrée** de cet état a été créée dans le même bucket R2, dans un préfixe indépendant **`private-backups/mission03-editor/`**. Elle ne remplace ni le snapshot actif, ni les anciennes sauvegardes. Sa clé est aléatoire et l'archivage impose `IfNoneMatch: *`.

**Chiffrement :** AES-256-GCM, clé dérivée de la phrase secrète déjà configurée dans les secrets GitHub (scrypt + sel et nonce aléatoires). Seul le contenu **chiffré** est écrit sur R2. Aucune sauvegarde en clair n'est déposée dans GitHub, les logs ou les artifacts.

**Résultat effectivement relevé :**
```text
M03_LIVE_EDITOR_READONLY_PASS
  revision=114 source_bytes=199168
M03_EDITOR_ENCRYPTED_BACKUP_AND_RAM_RESTORE_PASS
  encrypted_bytes=199249
  r2_readback_verified=true
  isolated_restoration_exact_bytes=true
  live_snapshot_unchanged=true
  plaintext_uploaded=0
  cloudflare_d1_writes=0
  production_media_bucket_writes=0
  dns_changes=0
  external_independent_copy=false
```

La sauvegarde a été relue **depuis le serveur R2**, déchiffrée exclusivement en mémoire, et toutes les données du document ont été reconstituées à l'identique octet par octet. Le logiciel a vérifié que l'ETag de l'objet source n'avait pas changé pendant l'opération.

**Ce test prouve une récupération exacte de ce JSON**, et non une restauration complète de Cloudflare D1, de tous les médias et du Worker.

### 1.2 Tests de défaillance

La suite `tests/test_mission03_editor_private_backup.py` a passé **8/8 tests**, notamment :
- Aller-retour AES-256-GCM exact.
- Chiffrement aléatoire de deux archives du même document.
- Rejet d'une mauvaise phrase secrète.
- Détection d'un ciphertext corrompu.
- Rejet d'une sauvegarde tronquée.
- Rejet d'un JSON mal formé, vide ou contenant des pages doublonnées.
- Vérification que le code d'archivage ne contient aucune écriture/suppression de l'objet actif.
- Vérification de la structure du snapshot et de ses identifiants de pages.

**Attention :** les vérifications sur l'absence de commande d'écriture sont des tests du code + la relecture ETag, pas une restriction IAM démontrée sur le token R2.

### 1.3 Vérification des médias déjà accessibles

Le programme existant `scripts/verify-public-media-before-visual-publish.mjs` a été exécuté **sans modification des données** sur le véritable site, et ses résultats sont :

- **113/113 médias publics historiques** accessibles via le domaine officiel.
- **9/9 liens historiques PDF** accessibles depuis le site officiel.
- Les 9 liens PDF fonctionnent également sur les **deux hôtes historiques** contrôlés.
- Un faux lien privé est bien rejeté avec HTTP **404**.
- Le contrôle D1 des chemins autorisés est en **SELECT uniquement**, avec **0 ligne écrite**.
- Les deux domaines publics officiels répondent correctement.

**Ne pas confondre accessibilité et sauvegarde des octets** : les 113 tests HEAD prouvent que les ressources sont servies, pas qu'une copie indépendante complète de chaque fichier vient d'être réalisée.

## 2 — Protections existantes dans le logiciel

Les sauvegardes réelles de l'éditeur vérifient les révisions et utilisent un ETag conditionnel pour empêcher d'écraser silencieusement le travail d'un autre appareil : les conflits aboutissent à HTTP 409.

L'état public est séparé des brouillons dans le même document JSON : la sauvegarde chiffrée conserve **les deux états en un seul fichier**, permettant une récupération cohérente des pages déjà publiées et des pages en cours d'édition à cet instant précis.

Les objets historiques `/media/`, `/letter/` proviennent du bucket de production distinct, tandis que les nouveaux fichiers `/media/new/` sont stockés sous `editor-trials/uploads/` dans `EDITOR_BUCKET`. **La sauvegarde du JSON contient leurs références, mais PAS leurs octets.**

Le workflow de publication officiel, `.github/workflows/celebrations-publish-visual-site-once.yml`, crée déjà une copie ponctuelle du JSON `editor-trials/prepublish-backups/visual-*.json` et vérifie sa somme SHA-256 avant un déploiement.

## 3 — Risques réels non résolus

### R1 — Important : retour arrière du logiciel épinglé sur une ancienne version

Le workflow officiel `celebrations-publish-visual-site-once.yml` prépare un rollback avec le commit historique `94affae000554942eb98880d149f758c46908ab7`, puis remplace trois fichiers de l'éditeur par des versions issues de cette même révision.

Ce commit **ne représente pas la version officielle vérifiée le 7 novembre** (`7cbfdbd79e2b40f8f4ca4b46dbc97d47e26b742d`). Le retour arrière automatisé après échec d'un déploiement pourrait donc **réintroduire une interface plus ancienne**, alors même que les données éditoriales resteraient présentes.

**Verdict : le rollback Worker exact sur la dernière version n'est PAS certifié.** L'analyse statique de `scripts/mission03_verify_rollback_contract.py` confirme la différence ; aucun rollback du Worker officiel n'a été effectué.

**Action de sécurité avant un futur déploiement risqué :** enregistrer l'identifiant exact de la version réellement déployée, éprouver la procédure de retour à CETTE version sur un environnement isolé, puis seulement modifier le pipeline officiel avec un déclencheur explicite. Ne pas remplacer simplement la SHA historique par une autre constante durable.

### R2 — Important : il manque une deuxième copie indépendante

Cette nouvelle archive chiffrée se trouve dans **le même compte Cloudflare** que le stockage actif. Le chiffrement protège sa confidentialité, mais pas contre la perte simultanée du compte ou du fournisseur.

**Copie hors Cloudflare : non attestée pour l'archive du 7 novembre.** Une ancienne copie d'archive source a été téléchargée par le propriétaire en octobre, mais elle n'est pas équivalente à cet état actuel des pages.

### R3 — Important : la base D1 actuelle n'est pas intégralement restaurée ici

Une archive historique de 16 tables source Supabase a été restaurée en RAM/SQLite en octobre (missions de migration précédentes). Elle ne représente pas à elle seule une sauvegarde actualisée et transactionnelle de **la base D1 de production actuelle**.

Ce contrôle a vérifié une requête D1 de lecture et les ressources publiques, **pas un export intégral de D1 suivi d'une restauration isolée**.

### R4 — Les fichiers binaires ne sont pas tous archivés dans le nouveau snapshot

Les 120 entrées du catalogue R2 sont des références à des médias et objets. La nouvelle archive JSON n'inclut ni les fichiers sous `editor-trials/uploads/`, ni les 113 médias historiques complets, ni les 9 PDF des hôtes historiques.

L'accessibilité des fichiers a été confirmée, mais une sauvegarde réellement autonome du site doit inventorier et restaurer ces octets dans des compartiments séparés.

### R5 — Une sauvegarde ponctuelle n'est pas un plan de sauvegardes récurrentes

La révision 114 est un **instantané**. Une modification enregistrée après ce contrôle ne figure pas dans cette archive.

Après le premier archivage vérifié, le workflow Mission 03 a été rendu **opt-in** pour éviter de créer une nouvelle copie sensible à chaque commit documentaire. Il exige un message de commit contenant `[M03_PRIVATE_BACKUP_ONCE]` pour produire une autre sauvegarde chiffrée.

## 4 — Procédure sûre de restauration (DOCUMENTÉE, NON EXÉCUTÉE EN PRODUCTION)

Avant toute restauration véritable :

1. **Identifier ce qui est endommagé :** interface Worker, données du JSON, base D1, média historique ou nouvelle pièce jointe. Ne pas restaurer la mauvaise couche.
2. **Empêcher les modifications concurrentes** pendant l'opération et sauvegarder d'abord le contenu actuellement présent, même corrompu, dans un nouvel objet séparé. Ne pas écraser un utilisateur en train de travailler.
3. **Choisir l'archive exacte** dans le préfixe privé `private-backups/mission03-editor/`. Vérifier la provenance, le secret propriétaire, la signature GCM, les empreintes et le document JSON avant toute restauration.
4. **Répéter la restauration dans un environnement isolé**, sans hostname public, et comparer l'état des pages, des brouillons, des visibilités et du catalogue de médias. Contrôler aussi la présence des octets des médias référencés.
5. **Obtenir une validation explicite du propriétaire** avant toute restauration de contenu en production : elle peut faire disparaître des modifications légitimes intervenues depuis la sauvegarde.
6. **Si nécessaire seulement**, effectuer l'écriture du snapshot JSON actif avec condition ETag sur sa version courante et vérifier immédiatement le résultat. Ne pas mélanger cette opération avec un déploiement du Worker.
7. **Contrôler** les pages publiques, les accès admin, les liens historiques, les médias et les protections de confidentialité avec les scripts des missions 01–02.
8. Pour le Worker, utiliser une **version réellement identifiée et testée** plutôt qu'un commit de rollback ancien. Pour D1, préparer un plan distinct de restauration de base ; pour les médias, conserver les clés et URL historiques.

Aucune commande de restauration automatique sur la production n'est fournie par ce document, car les conditions nécessaires ne sont pas toutes certifiées.

## 5 — Ce qui a changé dans le dépôt

**Fichiers AJOUTÉS uniquement sur la branche d'audit :**
- `scripts/mission03_editor_private_backup.py`
- `scripts/mission03_verify_rollback_contract.py`
- `tests/test_mission03_editor_private_backup.py`
- `.github/workflows/celebrations-mission03-backup-rehearsal.yml`
- `docs/audit/MISSION-03-BACKUPS-RESTAURATION-2026-11-07.md` (ce document).

**Fichiers du logiciel :** aucun modifié.  
**Fichiers du site officiel :** aucun modifié.  
**D1 production, Worker, domaines, DNS et contenus publiés :** aucun modifié.  
**Seule écriture distante autorisée/exécutée par l'audit :** un **nouvel objet de sauvegarde chiffrée et privé** dans R2, sous un préfixe distinct, sans écraser d'objet existant.

## 6 — Verdict et transmission

**MISSION 03 : SAUVEGARDE CHIFFRÉE DE L'ÉDITEUR EFFECTUÉE ET RESTAURATION ISOLÉE VÉRIFIÉE.**

**Couverture complète de sauvegarde et récupération de TOUT le logiciel : NON CERTIFIÉE.**

Les quatre limites opérationnelles importantes sont la restauration exacte du dernier Worker, la sauvegarde D1 actuelle, la copie des médias binaires et une archive hors Cloudflare. Elles sont explicitement transmises comme **dettes de sécurité**, à traiter avant une réorganisation nécessitant un déploiement risqué. Les missions 04 et 05 peuvent se préparer hors production, mais elles ne doivent pas utiliser ces lacunes comme justification pour mettre le site actuel en danger.

**Ne pas commencer automatiquement la mission 04.**
