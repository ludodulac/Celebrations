# CÉLÉBRATIONS — Missions 1 à 3, point d'étape

## Mission 1 — Préparation de l'administration Cloudflare

Déjà préparée et vérifiée par tests unitaires sur la branche de migration : Worker séparé `celebrations-exit-editable-qa` sur Workers.dev, configuration R2/D1 de production indépendantes, pages administratives et routes CRUD complètes ; **aucune publication sur le domaine officiel**. Voir `docs/celebrations-supabase-exit-033-editable-admin-candidate.md`.

Le Worker réel modifiable n'est **pas encore déployé** tant que le propriétaire n'a pas personnellement créé le secret d'environnement GitHub. Ainsi, le Worker lecture seule de consultation reste protégé.

## Mission 2 — Mot de passe

Action du propriétaire requise : enregistrer un mot de passe administrateur fort (14 caractères minimum, distinct si possible du site actuel) dans le secret **d'environnement** GitHub `celebrations-staging` nommé exactement `CELEBRATIONS_ADMIN_PASSWORD`. **Ne jamais communiquer le mot de passe à ChatGPT.**

Le job `editable-admin-production-qa-once` (déjà préparé) dérive un vérificateur PBKDF2 côté GitHub Actions sans écrire de mot de passe dans les logs ou les fichiers du dépôt, déploie uniquement le Worker d'essai avec ce vérificateur, teste la connexion, les statistiques et neuf anciens liens PDF, puis détruit la session. **La mission 2 est en attente de ce secret ; ne pas annoncer de connexion réelle avant son exécution.**

## Mission 3 — Vérifier les enregistrements CRUD

Ce petit lot ajoute uniquement un job opt-in `isolated-staging-admin-crud-roundtrip-once`, marqueur `[MISSION03_ADMIN_CRUD_STAGING_ONCE]`, qui teste contre **la vraie base D1 staging, jamais la production** :
- connexion par session administrateur synthétique aléatoire à validité courte ;
- création de contenus, d'une célébration et d'un événement synthétiques ;
- modifications, suppression des relations, suppression de contenu et d'événement ;
- vérifications d'absence de modification des autres lignes ;
- bloc finally inconditionnel pour nettoyer les seuls identifiants synthétiques et révoquer la session ;
- quota Free contrôlé avant/après sur toutes les D1 Cloudflare de ce compte.

Ne jamais affecter les 456 lignes de programme D1 production, les 113 médias publics, les neuf PDF et les URLs historiques. Cette preuve sera un **test staging**, et ne remplace pas un test UI humain authentifié sur le nouveau Worker QA.

Aucun DNS, domaine Spaceship, GitHub main ou Supabase source modifié. La bascule définitive n'est pas autorisée par ces trois missions.


## Vérification réelle du 22 octobre 2026

- **Mission 1 : PR #62 et #63 fusionnées dans la branche de migration ; code et configuration du Worker administrateur distinct `celebrations-exit-editable-qa` préparés, mais ce Worker n'a pas été déployé par le job de vérification n°86.** Le domaine public et l'ancien Worker des PDF sont inchangés.
- **Mission 2 : non validée.** Le job `editable-admin-production-qa-once` a été **SKIPPED** lors de ce run. Le propriétaire doit enregistrer lui-même un mot de passe fort de 14+ caractères dans le secret d'environnement `celebrations-staging` > `CELEBRATIONS_ADMIN_PASSWORD`, sans jamais le transmettre dans une conversation ; ensuite seulement déclencher le job prévu et confirmer la connexion réelle.
- **Mission 3 : test réel PASS** dans la seule D1 de staging via GitHub Actions [run #39764462133](https://github.com/ludodulac/Celebrations/actions/runs/39764462133), job `isolated-staging-admin-crud-roundtrip-once`. Le navigateur a chargé l'administration et les données (4 célébrations, 62 événements, 211 contenus), sans requête Supabase ni erreur JS. Création/modification/suppression/dissociation des seules lignes synthétiques réussies ; journaux : `STAGING_SAFE_SAVE_ROUNDTRIP`, `STAGING_REAL_ADMIN_UNLINK`, `STAGING_SCOPED_DELETE_ROUNDTRIP` avec `existing_records_untouched=true` ; nettoyage et révocation de session `success=true`. Les contrôles pré/post quota Free sont PASS (snapshot post : 3 lectures/3 écritures D1 agrégées selon métriques à cet instant).
- **Limite de preuve** : le PASS de staging ne valide pas encore le mot de passe réel ni le Worker modifiable de QA sur les données de production migrées. Aucune bascule officielle, modification DNS/Supabase, opération R2 de production ou suppression historique dans cette mission.


## Déclenchement contrôlé de la mission 2

Le propriétaire confirme avoir enregistré le secret d'environnement GitHub `CELEBRATIONS_ADMIN_PASSWORD`. Déclenchement d'une seule exécution de vérification sur le Worker QA distinct, avec garde-fous existants et contrôle des quotas. Aucun changement DNS, domaine officiel, Worker historique, contenu métier ou Supabase n'est autorisé par ce commit. Résultat à renseigner uniquement après lecture des logs.


## Mission 2 : preuve réelle de succès le 22 octobre 2026

Le propriétaire a confirmé la création du secret protégé `CELEBRATIONS_ADMIN_PASSWORD`. Exécution contrôlée sur la branche de migration par le commit `02c1c78d6bcc3f0eaf75b636a4107d626cdff696`, [GitHub Actions #39779857288](https://github.com/ludodulac/Celebrations/actions/runs/39779857288), job `editable-admin-production-qa-once`. Les garde-fous du mot de passe et du quota ont passé. Déploiement **réel et exclusivement QA** de `https://celebrations-exit-editable-qa.rondes.workers.dev` avec 91 actifs. La vérification distante a affiché `CELEBRATIONS_EDITABLE_ADMIN_QA_PASS` : mot de passe vérifié par PBKDF2, lecture des statistiques historiques, neuf PDF sur les URLs `?lettre=` de cette nouvelle origine sans redirection, données et médias métier inchangés, domaine et Worker historiques inchangés, aucune mutation Supabase. Une seule session de test éphémère a été révoquée avec `CELEBRATIONS_QA_ADMIN_SESSION_REVOKED verified=YES`. Budget D1 Free contrôlé avant/après. **Mission 2 validée techniquement** ; une confirmation de confort dans le navigateur du propriétaire reste utile. Ce test n'est ni la migration des anciennes URL sur le hostname historique, ni la bascule DNS finale.
