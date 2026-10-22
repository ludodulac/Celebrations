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
