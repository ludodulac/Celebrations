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
