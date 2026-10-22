# CÉLÉBRATIONS — Mission 04 : vérifier les fichiers administratifs Cloudflare R2

## Périmètre protégé

Tester **uniquement** le Worker `celebrations-exit-staging.rondes.workers.dev`, son D1 de staging et son bucket R2 privé `celebrations-exit-staging`. Aucun domaine officiel, ancien Worker d'invitations, ressource Supabase, compte historique ni D1/R2 de production ne doit être modifié. La mission 4 n'est pas une bascule du site.

## Vérification réelle attendue

- Sur navigateur mobile Chromium, ouvrir l'administration avec une **session synthétique de cinq minutes**, déposer un **PDF fictif** dans le formulaire Média et vérifier l'enregistrement D1 + le fichier R2 et son aperçu privé.
- Via la même API réelle et la même session, déposer quatre fichiers fictifs : **PDF, PNG, WAV, TXT** ; vérifier identité binaire, accès admin et refus d'accès anonyme ; modifier les métadonnées D1.
- Vérifier le traitement des autres sources : lien vidéo externe et texte intégré (sans ajout R2).
- Supprimer uniquement ces références fictives et ces objets R2 ayant une clé de test aléatoire, confirmer leur disparition et révoquer la session.
- Vérifier les quotas Free D1 avant et après. Déclencher le job isolé GitHub Actions `isolated-staging-admin-media-roundtrip-once` une seule fois avec le marqueur `[MISSION04_MEDIA_R2_STAGING_ONCE]`.

## Conditions de validation

Seul un run GitHub Actions **SUCCESS** et ses journaux `STAGING_BROWSER_FILE_UPLOAD`, `STAGING_MEDIA_UPLOAD_ROUNDTRIP`, `STAGING_MEDIA_ROUNDTRIP_CLEANUP`, `STAGING_SYNTHETIC_MEDIA_FALLBACK_CLEANUP` et `STAGING_SYNTHETIC_ADMIN_SESSION_REVOKED` peuvent confirmer la mission.

Ne pas supposer que ces tests staging autorisent les fichiers privés du futur Worker de production ni les anciens liens PDF déjà envoyés. Les missions suivantes couvrent ces points.

## Lancement

Le workflow opt-in a été préparé sur la branche `feat/celebrations-supabase-exit-001` sans modification de `main`. En attente du résultat GitHub Actions.
