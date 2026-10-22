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

## Résultat vérifié — 22 octobre 2026

**Mission 04 : PASS sur Cloudflare staging.** Exécution : [GitHub Actions #39780858401](https://github.com/ludodulac/Celebrations/actions/runs/39780858401), job `isolated-staging-admin-media-roundtrip-once` ; résultat GitHub `SUCCESS`.

Preuves directement relevées dans les journaux (sans URL privée, mot de passe ni jeton) :

- `STAGING_AUTHENTICATED_ADMIN_SMOKE` : administration chargée sans erreur JS ni appel vers Supabase.
- `STAGING_BROWSER_FILE_UPLOAD real_mobile_form=true pdf_saved_in_D1=true private_R2_preview=true anonymous_denied=true` : upload **PDF depuis le vrai formulaire mobile** et aperçu privé fonctionnels ; refus anonyme.
- `STAGING_BROWSER_FILE_CLEANUP content=true uploaded=true` : suppression de ce PDF d'essai et de sa référence.
- `STAGING_MEDIA_UPLOAD_ROUNDTRIP uploaded=4 private_preview=4 bytes_verified=4 metadata_updates=4 video_link=1 inline_text=1` : ajout réel de **PDF, PNG, WAV, TXT** ; relecture identique octet pour octet ; modifications des métadonnées D1, lien vidéo externe et texte intégré.
- `STAGING_MEDIA_ROUNDTRIP_CLEANUP files=4 rows=6 failures=0` : suppression ciblée de tous les fichiers et des enregistrements de ce second essai.
- `STAGING_SYNTHETIC_BROWSER_FILE_FALLBACK_CLEANUP success=true`, `STAGING_SYNTHETIC_MEDIA_FALLBACK_CLEANUP success=true` et `STAGING_SYNTHETIC_ADMIN_SESSION_REVOKED success=true` : second nettoyage et révocation de la session d'essai.
- Contrôles du quota D1 Free `pre` et `post` réussis : snapshots de facturation (peuvent avoir un délai de remontée) à 49 706 lectures et 48 écritures, loin des limites agrégées de 5 000 000 et 100 000.

**Portée stricte :** tests sur `celebrations-exit-staging` uniquement, aucune écriture intentionnelle sur D1/R2 de production ; ni domaine officiel, ni Worker historique `celebrations.rondes.workers.dev`, ni Supabase modifiés. Le bon fonctionnement réel sur le futur domaine sera revérifié après bascule, conformément aux missions 13–14.

**Suite autorisée par le plan : mission 05, vérification des comptes utilisateurs.** La mission 04 ne déclenche aucune mission ultérieure automatiquement.
