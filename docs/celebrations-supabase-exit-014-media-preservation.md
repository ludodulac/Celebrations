# CÉLÉBRATIONS — ÉTAPE 4 : sauvegarde des 158 médias (contrôle économe)

20 octobre 2026. **Ne pas relancer les copies volumineuses sans une preuve de dérive.**

## Inventaire de référence, réellement contrôlé sur la source

Requête SQL Supabase en **lecture seule**, schéma Storage, bucket `celebrations-media` :

- `source_objects=158`
- `source_bytes=830312417`
- `missing_sizes=0`
- `source_new_or_updated_since_19_oct=0`
- `source_last_updated_at=2026-10-11 12:51:50Z`

Le contrôle du 19 octobre dans le run [39333819255](https://github.com/ludodulac/Celebrations/actions/runs/39333819255) a **effectivement recalculé SHA-256 du corps de chaque objet source et R2** : 158/158 identiques, 830312417 octets, 61 copies réalisées et 97 copies identiques existantes. Le run [39411606101](https://github.com/ludodulac/Celebrations/actions/runs/39411606101) a encore vérifié les 158 clés et tailles et préservé deux objets propres à staging.

**Constat :** une relecture complète de 830 Mo depuis chacun des deux fournisseurs serait redondante et consommerait des requêtes réseau et des ressources inutiles. Un contrôle à jour des clés, tailles et des dates de modification est suffisant pour décider s'il faut relancer le hachage complet : il ne doit pas être présenté comme un nouveau recalcul SHA-256.

## Mission automatisée préparée

`scripts/audit_celebrations_media_dual_copy_readonly.py` :
- consulte **uniquement** l'inventaire de la source Supabase (API Storage *listing*) et celui du R2 privé `celebrations-exit-staging` ;
- exige 158 clés originales et 830312417 octets exactement ;
- refuse les différences de clés et de tailles ;
- refuse si un objet source a été modifié depuis le 19 octobre 00:00 UTC ;
- refuse si une copie R2 originale a été modifiée **à partir du 20 octobre 00:00 UTC**, après la copie vérifiée le 19 ;
- **ignore sans modifier les objets qui n'appartiennent qu'à staging**, notamment les brouillons de test et l'archive privée de base de données ;
- ne lit **aucun corps de média**, n'affiche aucun chemin privé, n'interroge jamais D1 et ne crée aucun object R2.

Le job `media-manifest-audit` du workflow `.github/workflows/celebrations-private-backup-once.yml` est déclenché **uniquement** si le dernier message de commit sur la branche migration comporte `[MEDIA_AUDIT_ONLY_ONCE]`. Les jobs de sauvegarde chiffrée `[BACKUP_ENCRYPTED_ONCE]` et de restauration `[VERIFY_BACKUP_RESTORE_ONCE]` seront **ignorés**.

## Une importante nuance sur « copie indépendante »

Aujourd'hui, les médias existent chez deux fournisseurs **différents** : les originaux Supabase et une copie privée Cloudflare R2. Tant que le projet Supabase n'est pas supprimé ou suspendu, il constitue une seconde source indépendante de Cloudflare. Il héberge cependant **d'autres applications** et sa conservation ne peut pas être garantie uniquement par les tests. Une troisième copie chiffrée hors de ces deux services, ou une politique de conservation de Supabase explicite, est recommandée **avant toute désactivation de Supabase**.

**Il est interdit de supprimer le projet Supabase, la source des 158 fichiers ou le bucket R2 staging.**

## Résultat réel après exécution (20 octobre 2026)

GitHub Actions [run 39490792561](https://github.com/ludodulac/Celebrations/actions/runs/39490792561), job `media-manifest-audit` : **SUCCESS**.

```text
CELEBRATIONS_MEDIA_DUAL_COPY_READONLY_PASS
source_files=158
source_bytes=830312417
r2_original_keys_and_sizes_verified=158
missing_originals=0
mismatched_sizes=0
r2_originals_modified_since_sha_proof=0
staging_only_objects_preserved=3
new_bytes_downloaded=0
d1_queries=0
source_mutations=0
r2_mutations=0
sha256_content_rechecked_this_run=false
```

Les **158 copies originales** du R2 staging correspondent toujours exactement à la source Supabase selon leurs **clés et tailles** ; aucune date de modification postérieure aux vérifications SHA-256 précédentes n'a été relevée. Les **3 objets propres au staging** (dont l'archive chiffrée de base) ont été **préservés**. Les deux autres jobs (`encrypted-backup` et `isolated-restore-audit`) ont été ignorés (`skipped`).

**Décision : étape 4 de parité des médias = PASS pour la vérification effectuée**. Ceci est une vérification de métadonnées à jour s'ajoutant aux preuves SHA-256 du 19 octobre, **pas un nouveau hachage intégral du contenu**.

### Condition qui reste ouverte

L'ordinateur de l'utilisateur possède une copie indépendante **de la base chiffrée** (~381 Ko), mais **pas une archive téléchargée et certifiée des 158 médias** (~830 Mo). Il existe donc toujours **deux copies de fournisseurs différents** (Supabase d'origine et Cloudflare R2), mais **aucune troisième sauvegarde durable hors fournisseur ne peut être revendiquée**. Tant que ce point n'est pas traité, **ne jamais supprimer ni suspendre le stockage source Supabase**.

**Pas de bascule en production autorisée par le seul résultat de cette mission.**

## Statut historique avant exécution

`MEDIA_SOURCE_METADATA_READONLY_CHECK=PASS`
`HISTORICAL_SHA256_PARITY=PASS_ON_2026-10-19`
`LATEST_CROSS_PROVIDER_MANIFEST=PREPARED_NOT_YET_RUN`
`THIRD_DURABLE_COPY_OUTSIDE_CLOUDFLARE=NOT_VERIFIED`
`D1_READS_WRITES=0`
`PRODUCTION_MUTATIONS=0`

Étape 4 ne peut être déclarée entièrement certifiée pour arrêt de Supabase qu'après preuve de conservation indépendante à long terme des fichiers, notamment les PDF confidentiels.

## État consolidé après l'audit

`SOURCE_ORIGINAL_MEDIA=158` · `STAGING_R2_ORIGINAL_MEDIA=158` · `KEYS_AND_SIZES_IDENTICAL=YES` · `SHA256_PRIOR_PROOF=PASS_ON_19_OCT` · `NEW_CONTENT_HASH_AUDIT=NO` · `THIRD_MEDIA_COPY_OUTSIDE_TWO_PROVIDERS=NO` · `D1_QUERIES=0` · `LIVE_WEBSITE_CHANGED=NO`.
