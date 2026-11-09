# 🌸 CÉLÉBRATIONS — MISSION 20 : sécurité utile avant livraison

**Date : 9 novembre 2026.** Branche `audit/celebrations-mission-20-release-blockers-20261109`, fondée sur le HEAD de M19 `ffd64029ddf4ae8dabbeb350b0e6d3a087fe2e8b`. **Aucun déploiement, aucune migration ni modification des données du site en production.**

## 1. Ce que la mission 20 a réellement résolu

**La lacune prioritaire était l'absence de sauvegarde récente, déchiffrable et restaurée de la D1 réelle.** La mission 19 n'avait pu obtenir que les métadonnées de la base : 19 tables et 5 521 408 octets environ.

Pour éviter l'API d'export D1 susceptible de rendre temporairement la base indisponible, M20 a créé `scripts/mission20_d1_logical_backup.py` : il lit la base **uniquement avec des instructions SQL SELECT** via l'API de requête Cloudflare. Ces appels utilisent HTTP POST pour transmettre les SELECT, mais **n'effectuent aucune écriture SQL**. Le script refuse les requêtes non SELECT, limite le nombre de requêtes et de lignes, valide le schéma, chiffre le résultat en mémoire, écrit un **nouvel objet privé chiffré** dans le bucket R2 de sauvegarde existant, le relit et le restaure dans **SQLite en mémoire**.

Le script écarte explicitement la table interne Cloudflare `_cf_KV`, visible dans `sqlite_master` mais protégée contre les SELECT (`SQLITE_AUTH`), sans ignorer les 19 tables applicatives.

### Preuve réelle

**[GitHub Actions #42612777253](https://github.com/ludodulac/Celebrations/actions/runs/42612777253) : SUCCESS.** Les échecs de préparation #42612429489 / #42612562718 / #42612689938 ont permis d'identifier la table interne non interrogeable ; la dernière version corrigée a **réussi**.

| Mesure réelle | Résultat |
| --- | ---: |
| Tables applicatives sauvegardées | **19/19** |
| Lignes sauvegardées et restaurées | **12 797** |
| Appels SELECT SQL de lecture | **141** |
| Taille de la sauvegarde chiffrée R2 | **320 092 octets** |
| Relecture des octets chiffrés de R2 | **OUI, identiques** |
| Déchiffrement, intégrité SQLite et récupération des lignes | **PASS** |
| Violations de clés étrangères après restauration | **0** |
| Tests unitaires offline M20 | **6/6 PASS** |
| Écritures sur D1 réelle | **0** |
| Modification Worker, médias, DNS ou site public | **0** |

**Ce qui a été restauré est la représentation logique des tables, des lignes, des index et des objets de schéma récupérables depuis SQLite.** Les 19 tables métiers sont recopiées ; la table interne réservée `_cf_KV` n'est pas exportable par un compte client.

**Deux limites honnêtes :**
- Il s'agit de **lectures SELECT paginées**, et non d'un instantané transactionnel figé. Les décomptes ont été revérifiés, mais une modification concurrente à nombre de lignes constant n'est pas exclue. Ce contrôle ne remplace donc pas un export transactionnel pour un scénario de récupération sans aucune perte.
- L'archive de D1 est chiffrée et privée, mais dans le même **compte Cloudflare** que le site. L'indépendance géographique/fournisseur n'est pas démontrée. Aucun contenu privé n'est joint au dépôt GitHub public ni imprimé dans les journaux.

## 2. Ce qui est déjà acquis sans refaire inutilement le travail

- **M19 :** snapshot JSON réel de l'éditeur, révision **117**, **199 215 octets**, sauvegarde AES-256-GCM et récupération exacte en mémoire, dans le même R2.
- **M19 :** **113/113 fichiers publics** accessibles, **9/9 PDF historiques** fonctionnels sur les hôtes testés. **Disponibilité HTTP ≠ copie des octets**.
- **M19 :** version active du Worker identifiée par API GET le 9 novembre à 11:10 UTC : `dcda4193-1d82-4283-9f0e-ae8a09e6a444`, déploiement `cd46e1ba-e106-4f03-90aa-7110628a5b9f`.
- **M18 :** **247 tests Node**, **9 tests Python** et parcours Chromium PC/mobile **PASS** sur environnement isolé. Ils n'attestent pas encore la publication.
- **M19 :** un nouveau média dans R2 d'environ **86 096 octets** inventorié, mais non copié ; listing direct du bucket de médias anciens **refusé** aux identifiants disponibles.

## 3. Les seuls blocages restants pertinents pour une livraison sûre

### A — Les octets des fichiers anciens et nouveaux ne sont pas sauvegardés indépendamment

L'accès HTTP à 113 médias et neuf PDF ne suffit pas à retrouver tous les binaires originaux, leurs permissions et leurs noms. Le compte R2 disponible n'a pas le droit de lister le bucket historique. **Ne pas contourner ce refus ni effacer ou migrer les fichiers.** Un administrateur du bucket ou une méthode explicitement autorisée est requis pour une archive complète, privée et récupérable.

### B — Worker exact et copies hors Cloudflare non démontrés

Les métadonnées de la version Worker sont connues, mais **ni son bundle intégral, ni ses bindings/assets/secrets, ni un retour arrière éprouvé sur candidat isolé** ne sont attestés. Les deux archives chiffrées actuelles (éditeur et D1) doivent être copiées sur **un autre fournisseur ou un support détenu par le propriétaire**, puis relues avec leurs empreintes, sous accès privé.

### C — La protection et la recette du candidat restent à conclure

L'ancien domaine `celebrations-exit-staging.rondes.workers.dev` garde, d'après M14, un accès historique sans cookie à la route des brouillons. Les correctifs des routes de prévisualisation sont encore dans les PR de refonte ; **ne pas confondre leur succès dans les tests avec une correction du staging réel**. Contrôler ce point avant de présenter des données confidentielles et essayer un véritable compte administrateur sur un candidat isolé.

Un ancien workflow de publication a également un mécanisme de rollback historique dangereux sur les branches où la correction M16 n'est pas intégrée. **Ne jamais le déclencher pour livrer vite.**

## 4. Décision : ne pas mélanger mise à disposition et refonte

- **M20 : sauvegarde logique D1 réelle et récupérable en mémoire — ACCOMPLIE.**
- **M20 : certification de restitution intégrale du site — NON**, à cause de A, B et C.
- **Décision de publication de la refonte : NO-GO** tant que la sécurité de retour arrière et la confidentialité ne sont pas démontrées.
- **Livraison cet après-midi :** le site **actuellement en ligne** peut être présenté dans son état courant s'il répond aux besoins métier. Ne pas annoncer que la refonte des missions 1–20 est déjà en production.

**Priorité à la livraison :** aucune autre optimisation esthétique, aucun nettoyage de code, aucun nouveau module. Seulement un chemin de restauration réel et une recette minimale sur un candidat sûr, puis un accord distinct du propriétaire avant une éventuelle publication.

## 5. Portée GitHub

Le workflow M20 fonctionne uniquement sur la branche d'audit M20 et refuse la modification d'un fichier du logiciel depuis la mission 19. L'exécution qui ne porte **pas** le marqueur `[M20_PRIVATE_D1_BACKUP_ONCE]` ne crée pas d'autre sauvegarde. La PR reste en **DRAFT**, aucune fusion ni mise en production.
