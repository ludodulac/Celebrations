# CÉLÉBRATIONS — ÉTAPE 8 : sauvegardes et retour arrière (préparation sans exécution)

Préparé le 20 octobre 2026, depuis la branche de migration `feat/celebrations-supabase-exit-001` (référence `c8f7f9a3bc76f1eef009c58a0ddd4c1691290edc`).  
**STATUT : PLAN PRÉPARÉ — aucune sauvegarde privée certifiée ni aucun test réel de retour arrière dans cette mission.**

## Situation observée dans le code

- Le site historique est déployé par `.github/workflows/pages.yml`, depuis `main`. Le HEAD `main` contrôlé est `4b5edd9c19ce989af2eae33445017dd30fcbbe92` au 20/10. Ce code garde les appels Supabase.
- Le site de test Cloudflare est isolé de `main`, de la production, du DNS et de la base source. Le Worker de staging n'est **pas** l'environnement de production.
- L'exporteur `migration/export_celebrations_readonly.py` couvre 16 tables, pagine les résultats et calcule un SHA-256/manifest. `migration/stage_export_sqlite.py` et `migration/import_relational_sqlite.py` vérifient respectivement un archivage JSON et un import relationnel local.
- Le stockage privé R2 de test dispose de 158 copies source prouvées par SHA-256 au 19/10, plus 2 objets propres au staging lors du dernier audit. Ce n'est **pas** une sauvegarde complète, récente et validée pour la production.
- Aucun fichier du dépôt ne démontre, à lui seul, qu'un export durable, restaurable, chiffré et hors dépôt des 16 tables a déjà été créé et conservé. On n'affirme donc pas son existence.

## Vérification supplémentaire (source en lecture seule, 20/10/2026)

- **Source exacte vérifiée** via le connecteur Supabase : projet nommé **« La forêt enchantée »** (état `ACTIVE_HEALTHY`). Il contient bien les **16 tables Célébrations**, mais également **d'autres tables** (dont `audios` avec **2 lignes** et `app_admins` avec **1 ligne**). Il n'est donc **pas sûr de désactiver/supprimer ce projet Supabase** simplement parce que le site Célébrations aura migré : vérifier les dépendances de l'application audio et des autres données en premier.
- **Relevé exact des 16 tables** par `SELECT COUNT(*)` en lecture seule : `celebrations_clicks=11681`, `celebrations_participants=1`, `celebrations_participant_sessions=1`, `celebrations_admin_sessions=16`, `celebrations_committee_letters=9` ; les 11 autres tables correspondent respectivement aux 4 célébrations, 28 étapes, 62 événements, 211 contenus, 124 associations événement-contenu, 0 associations étape-contenu, 23 liens, 0 brouillons légaux, 0 profils, 1 paramètre public et 3 groupes.
- **Nouveau delta réel** : le dernier run de migration avait repris jusqu'au clic historique `11648` (11632 historiques + 16 nouveaux). Le contrôle source en lecture seule relève désormais **33 clics supplémentaires** (identifiants 11649 à 11681). Ne pas considérer le staging comme définitif : il faudra une synchronisation finale **plus tard**, juste avant bascule, avec vérification de la consommation D1.
- **Google Drive** : un dossier intitulé **« Sauvegarde Supabase – Célébration »**, créé le 22/09/2026, est identifié. Une recherche de ses enfants n'a retourné **aucun fichier accessible**. Cela ne prouve pas l'absence d'autres copies, mais **aucune sauvegarde restaurable n'est certifiée** à partir de ce dossier. Ne pas y déposer de données sensibles sans vérification préalable du chiffrement et des droits.
- **Test de restauration hors ligne amélioré** : le test `test_relational_restore_with_synthetic_linked_data` vérifie maintenant, avec 16 enregistrements **entièrement fictifs**, un export complet, la vérification SHA-256, l'archive SQLite, l'import relationnel, les clés étrangères, les données de participation, comité, contenus et statistiques, et le refus d'écraser un fichier. Ce test ne crée **aucune sauvegarde réelle**.

**Conséquence importante : la fin de la dépendance Supabase de Célébrations n'autorise pas automatiquement l'arrêt du projet Supabase partagé.**

## Prérequis absolus AVANT autorisation du basculement

1. **Point de restauration Supabase privé et récent** : exporter les 16 tables, la structure et les dépendances fonctionnelles autorisées, conserver le manifest SHA-256 et les décomptes, valider la lecture et une restauration d'essai **hors production**. Les données personnelles, mots de passe dérivés et sessions ne doivent jamais être publiés sur GitHub, dans les logs ou dans un artefact CI public. Stockage chiffré, accès restreint et durée de conservation documentée. Les anciennes sessions ne seront pas réutilisées sur Cloudflare.
2. **Médias** : préparer un inventaire complet de la source (clés, tailles et empreintes), vérifier les 158 objets historiques et les ajouts éventuels juste avant bascule. Les 2 objets de staging ne doivent pas être confondus avec les originaux. Vérifier aussi que les 9 PDF de comité restent protégés par leurs autorisations et révocations.
3. **Point de départ GitHub** : conserver le SHA exact `main`, l'état du dernier déploiement Pages et la configuration de l'URL publique. Une PR DRAFT ne doit pas déclencher la production. Ne pas supposer que le retour de DNS suffit sans contrôler l'hébergement et les caches.
4. **Configuration de trafic** : noter **avant modification** les enregistrements DNS exacts, le fournisseur de zone, les éventuelles routes Workers, proxys, redirections, caches et TTL. Conserver une procédure testée pour restaurer ces réglages. Ils ne sont pas attestés par le dépôt.
5. **Cloudflare production** : décrire l'environnement de production distinct (D1, R2 privé, Worker, domaines et secrets), sauvegarder sa configuration et vérifier les coûts/quotas. **Ne jamais réutiliser aveuglément la base/bucket de test en production.**
6. **Écritures pendant la transition** : décider un mécanisme contrôlé pour éviter les pertes (gel temporaire des opérations d'administration, synchronisation finale avec audit atomique, prévention des doubles écritures et préservation des nouveaux clics). Les statistiques générées sur Cloudflare après bascule ne doivent pas être abandonnées lors d'un rollback.
7. **Conditions d'acceptation** : obtenir une preuve réelle des fonctionnalités critiques (médias publics et privés, authentification du participant historique, admin/sauvegarde, pages légales publiables, liens de comité) et l'accord explicite du propriétaire. Les tests synthétiques ne suffisent pas.

## Séquence de retour arrière, à tester avant mise en production

1. **Déclencheur** : échec des pages principales, perte d'accès aux comptes/fichiers, dysfonctionnement administration, données divergentes, faille de confidentialité ou dépassement menaçant les quotas.
2. **Mettre fin aux nouvelles écritures** vers Cloudflare de manière coordonnée, sans détruire le Worker, D1 ou R2 et sans supprimer les enregistrements générés depuis la bascule.
3. **Réactiver l'acheminement vers le site historique** uniquement depuis les réglages de trafic/DNS sauvegardés. Vérifier publiquement qu'il charge le dernier `main` stable et se connecte à Supabase.
4. **Vérifier** une consultation de célébration, une URL média, l'administration authentifiée et un compte participant, sans exposer de données privées dans les traces. Vérifier DNS, cache et pages d'erreur.
5. **Réconcilier** les nouvelles données créées durant la période Cloudflare avant de déclarer un retour sans perte. Si la synchronisation inverse sécurisée n'existe pas, **ne pas annoncer de restauration sans perte** : garder les deux systèmes et leurs traces jusqu'à résolution.
6. **Conserver** le snapshot, les manifests, les nouvelles écritures et les journaux d'incident sous accès restreint, jusqu'à décision explicite de nettoyage.

## Décision

`STEP_8_PLAN_DRAFTED=YES`  
`RESTORABLE_PRIVATE_BACKUP_VERIFIED=NO`  
`REAL_ROLLBACK_REHEARSAL_VERIFIED=NO`  
`PRODUCTION_CUTOVER_AUTHORIZED=NO`  
`READY_TO_DISABLE_SUPABASE=NO`

**Aucune mutation de D1/R2/Supabase, aucun changement de DNS, de `main` ou du site public pour rédiger ce document.**
