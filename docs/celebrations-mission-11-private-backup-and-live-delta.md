# CÉLÉBRATIONS — Mission 11 — sauvegarde renouvelée et synchronisation prudente avant bascule

## Consigne du propriétaire

Migrer uniquement les données réellement utilisées sur les pages et l'administration, plus les neuf lettres de comité conservées expressément en mission 06. Ne PAS réparer les anciens liens Drive inutilisés ni transférer les 37 objets exclus des pages publiques. Le site officiel reste en ligne sur Supabase : **on ne peut pas proclamer de « dernière synchronisation définitive » tant que les écritures continuent**. Un dernier delta après gel bref des modifications sera nécessaire au moment de la bascule (mission 13, sous autorisation distincte).

### Déjà accompli — ne rien recommencer

- 16 tables CÉLÉBRATIONS sauvegardées en archive AES-256-GCM sur R2 staging, et restaurées en base SQLite temporaire : runs [#39476099982](https://github.com/ludodulac/Celebrations/actions/runs/39476099982) et [#39488627588](https://github.com/ludodulac/Celebrations/actions/runs/39488627588). **Ancienne copie du 20 octobre conservée, jamais écrasée**.
- 158 objets privés originaux vérifiés par somme SHA-256 dans le bucket R2 de staging ; 113 médias publics dans R2 de production, plus 9 lettres privées, certifiés lors des missions 06, 08 et 09. Aucune copie de 830 Mo prévue.
- 456 lignes éditoriales / réglages migrés dans D1 production ; 1 participant historique conservé ; 11 738 événements statistiques déjà copiés et vérifiés intégralement en mission 10.
- Connexion admin, galerie, programmes, mentions légales privées, boutons du comité certifiés lors des missions précédentes.

### Séquence de sécurité propre à la mission 11

Un seul job opt-in [workflow `celebrations-private-backup-once.yml`](../.github/workflows/celebrations-private-backup-once.yml), déclencheur `[MISSION11_BACKUP_AND_DELTA_ONCE]`, branche `feat/celebrations-supabase-exit-001` et environnement protégé `celebrations-staging` :

1. Exiger l'identité exacte du Supabase partagé, du bucket R2 privé et des deux bases D1 distinctes, secret de sauvegarde propriétaire dans GitHub (jamais envoyé dans la conversation), quotas D1 Free suffisants.
2. Réexporter les **16 tables** source sans écriture. Chiffrer **avant tout upload** avec AES-256-GCM/scrypt et la phrase secrète d'environnement, vérifier intégrité, envoyer **uniquement le ciphertext** sous une nouvelle clé aléatoire `private-backups/mission11-source-...` en R2 staging. Télécharger ce ciphertext, contrôler son SHA-256, le déchiffrer **uniquement en RAM** et exécuter une vraie restauration sur SQLite RAM avec contrôle de clés étrangères. L'ancienne sauvegarde reste inchangée. Ne pas publier ou télécharger le contenu déchiffré.
3. Contrôler strictement les neuf tables utilisées par le programme et la navigation, ainsi que l'unique compte historique (comparaison sécurisée), les neuf lettres privées, et les brouillons légaux. **Aucune écriture de programme, participant ou autre donnée métier**. Différence = arrêt prudent, bilan des écarts sans donner les contenus privés dans les logs.
4. Inventorier les objets source et leur copie déjà vérifiée dans R2 staging. Pas de transfert, de suppression, de restauration artificielle d'images qui ne sont pas affichées.
5. Lorsque TOUS les tests précédents sont positifs, reprendre uniquement les nouveaux clics/pages vues Supabase dans D1 production, avec identifiants source convertis en négatifs. Toutes les lignes existantes sont comparées champ par champ avant insertion, puis toutes les lignes du snapshot sont relues après insertion. Écritures D1 ciblées, aucun effacement ou doublon. Les futurs nouveaux clics Cloudflare utilisent des identifiants positifs, sans collision.
6. Refaire le contrôle global des quotas D1 Free et consigner le résultat factuel (pas d'état PASS inventé).

### Limites importantes

- Cette sauvegarde **ne couvre pas les médias binaires dans l'archive** (ils sont conservés en copies R2 staging). Elle n'englobe pas d'autres applications Supabase, DNS, clés ou politiques de sécurité.
- Le REST source est **non transactionnel**. Tant que le site officiel reçoit des modifications et des visites, ce point de restauration n'est pas une photo atomique et les données évoluent.
- L'archive renouvelée est uniquement dans **Cloudflare R2 privé** ; la copie extérieure indépendante précédemment enregistrée par le propriétaire concerne l'ancienne archive du 20 octobre. Une nouvelle copie indépendante n'est **pas attestée**.
- Aucun changement du domaine, DNS, du Worker historique des PDF, du contenu du site officiel, de GitHub main, ni arrêt ou suppression du projet Supabase partagé. Aucun transfert de sessions historiques.
- Un **gel des écritures**, un nouvel état cohérent et un delta immédiat constituent des prérequis au changement de domaine (mission 13). Mission 11 ne vaut PAS autorisation de coupure.

## Résultat

Contrôle réel à déclencher et vérifier sur GitHub Actions ; aucune réussite présumée avant lecture des logs.

## RÉSULTAT EFFECTIVEMENT VÉRIFIÉ — 22 OCTOBRE 2026

**[GitHub Actions #39816977921](https://github.com/ludodulac/Celebrations/actions/runs/39816977921)**, job `mission11-backup-audit-and-append-only-delta` : **SUCCESS**, toutes les étapes vertes. Source active : `jwyayfkssyagvnablttg.supabase.co`. Exécution sur branche de migration, environnement protégé. Le domaine public, la page GitHub `main`, le DNS, le Worker `celebrations` des anciens liens PDF, le site Supabase et les deux buckets publics n'ont pas été modifiés.

### Nouvelle sauvegarde restaurable, chiffrée et privée

`MISSION11_FRESH_SOURCE_ENCRYPTED_RESTORABLE_BACKUP_PASS` :
- **16 tables, 12 307 lignes** prises dans une **nouvelle archive AES-256-GCM**, chiffrée avant tout upload ; **384 681 octets de ciphertext**.
- Empreinte SHA-256 du ciphertext effectivement vérifiée par aller-retour R2 privé : `a9a9439ec73984f92d5c295dbdb0af8c07efff6efec666a6f0227be6e69383ef`.
- Déchiffrement en RAM et import dans une vraie base SQLite temporaire RAM : **zéro violation de clé étrangère**, intégrité de l'archive contrôlée. **Aucun texte en clair sur R2/GitHub Actions artifacts**.
- Nouvelle clé unique sous le préfixe privé `private-backups/mission11-source-` dans `celebrations-exit-staging`, **ancienne sauvegarde du 20 octobre préservée**. Aucun média binaire n'est dans cette archive et aucune seconde copie indépendante hors Cloudflare n'est attestée pour la nouvelle archive. **Export REST paginé non transactionnel.** Ne pas présenter cette sauvegarde comme un snapshot atomique.

### Conservation vérifiée des données du vrai site

`MISSION11_SOURCE_VS_PRODUCTION_PREFLIGHT` puis `MISSION11_PUBLIC_PRIVATE_CONTENT_PREFLIGHT_PASS` :
- **9/9 tables du vrai programme** identiques champ par champ dans Supabase et D1 production : 4 célébrations, 3 groupes, 1 réglage, 211 contenus, 28 étapes, 62 événements, 23 liens, 124 relations événement/contenu, 0 relation étape/contenu. **456 lignes. Aucun conflit**.
- **1 compte historique** comparé avec son format de vérificateurs sécurisé ; **9 PDF privés de comité** conservés ; aucun brouillon légal publié par inadvertance. Pas de modification des comptes, textes ou contenus, **0 écriture métier**.
- `CELEBRATIONS_MEDIA_DUAL_COPY_READONLY_PASS` : les **158 fichiers originaux de Supabase**, soit **830 312 417 octets**, sont encore présents dans le bucket R2 privé staging, correspondance des clés/tailles, aucun changement de date depuis le contrôle des sommes SHA-256 d'octobre ; **0 recopie volumineuse**, 4 objets supplémentaires de staging (incluant les archives privées) préservés. Le contenu des 158 fichiers **n'a pas été re-haché durant ce job** ; leur contrôle d'intégrité SHA-256 date du précédent audit. Les 113 médias réellement publics restent validés par les missions 08–09.

### Synchronisation réelle des statistiques

`PROD_HISTORIC_STATS_PREFLIGHT` puis `PROD_HISTORIC_STATS_IMPORT_VERIFIED` :
- **11 738 anciennes lignes** vérifiées en D1 avant traitement ; Supabase possédait **11 824 lignes** au moment du relevé.
- **86 nouvelles lignes de visites/clics copiées** exclusivement dans la table `celebrations_clicks` de **D1 production**. Identifiants d'origine mappés vers leurs opposés négatifs, pour ne jamais entrer en conflit avec de futurs événements Cloudflare.
- **11 824 / 11 824 lignes ensuite relues et vérifiées champ par champ** (incluant données de visiteur pseudonymisées, horodatages). **172 écritures internes D1** et **23 562 lectures internes D1** déclarées par la phase d'import ; **aucune écriture Supabase, aucun changement des autres tables, des PDF ou des médias**.
- D1 quota Free global vérifié avant/après : compteurs Analytics agrégés au moment du test, **206 567 lignes lues / 1 062 écrites** (remontée différée ; ce ne sont pas les coûts immédiats du job). Marges très confortables sous 5 millions/100 000.

### Verdict et limite critique de temporalité

**MISSION 11 = SUCCESS pour la sauvegarde réelle renouvelée, la réconciliation des pages existantes et la synchronisation des statistiques au 22 octobre 2026.**

**Ce n'est PAS une bascule définitive, ni un état gelé.** Le site original peut encore recevoir de nouvelles visites/modifications depuis l'exécution. Avant un changement de domaine, une **nouvelle synchronisation finale sur un site figé en écriture** et un plan réversible sont impératifs ; ainsi que la préservation de la dernière archive sur un support réellement indépendant de Cloudflare si une sauvegarde multi-fournisseur est exigée. Les sessions Supabase historiques ne sont pas reprises.

**Aucune autorisation de bascule DNS** n'est contenue dans cette mission. Étape suivante : préparation du nom de domaine et du retour arrière (mission 12), puis autorisation explicite au changement final (mission 13).
