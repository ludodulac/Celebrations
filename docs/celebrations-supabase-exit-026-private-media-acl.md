# CÉLÉBRATIONS — mission 026 : rendre accessibles uniquement les 121 médias utiles dans la D1 privée

## Étapes vérifiées auparavant

- Copie des **121 fichiers réellement utiles** en R2 `celebrations-exit-production` : 766989338 octets, SHA256 intégral, GitHub #39606076236 SUCCESS.
- Import des **456 lignes éditoriales** dans les neuf tables du programme de D1 EU `celebrations-exit-production`, contrôle champ à champ / clés étrangères, GitHub #39608984113 SUCCESS.
- **37 objets hors liste publique** ne sont pas importés en production ; leur copie reste intacte dans l'ancien Supabase et dans R2 staging. **31 références historiques déjà manquantes chez Supabase** restent à diagnostiquer.

## Objectif

La R2 de production est un compartiment privé, sans URL publique. Le futur Worker doit pouvoir accéder **seulement** aux 112 fichiers de programme, d'accueil et de galerie, et aux **9 PDF de comité via un lien individuel opaque**. L'inventaire source confirme 9 lettres, 9 slugs uniques (longueur 19–31) et 9 fichiers réels dans Storage.

## Mesures

Le script `scripts/import_private_r2_public_media_acl_d1.py`, démarré seulement par `[PROD_R2_MEDIA_ACL_D1_ONCE]` sur la branche migration :

1. Relit la source Supabase **sans écriture**, refait la sélection des 121 fichiers parmi les 158 (211 fiches et relations) ; refuse tout changement.
2. Relit le bucket privé de production avec les identifiants R2 distincts et vérifie **121 chemins, tailles et 766989338 octets**.
3. Vérifie que la D1 de destination est **distincte du staging, en juridiction EU**, avec ses 211 fiches de contenus déjà présentes.
4. Insère de manière conditionnelle et reprise sûre :
   - **112** lignes `public_media` avec `approved=1` et `revoked_at=NULL`, jamais des chemins `committee/` ;
   - **9** lignes `celebrations_committee_letters` originales (id, slug, chemin, métadonnées) ;
   - **9** lignes `committee_media` avec slug unique, `published=1`, et chemin privé de lettre. Seuls les utilisateurs possédant le lien individuel peuvent demander ce PDF, pas via le chemin brut.
5. Relit chaque table et compare **toutes ses valeurs** avant/pendant/après ; une différence stoppe l'action, sans écraser les lignes existantes. Les clés/secrets et contenus ne sont jamais imprimés.
6. Vérifie les quotas Free Cloudflare. Aucune modification du stockage, de Supabase ou des DNS ; pas de Worker public déployé ; pas de modification de `main`.

**Limites :** les ACL D1 sont prêtes mais aucune URL publique Cloudflare n'existe encore. Il faudra déployer une **prévisualisation séparée**, valider l'accès à tous les médias et refuser les 37 exclus / les PDF comité sans slug valide, puis continuer l'import du reste des données (participants/admin, statiques et statistiques) et résoudre les 31 chemins historiques.

**Statut initial :** `PRODUCTION_R2_MEDIA_ACL=PREPARED_NOT_RUN`. Résultat réel uniquement après vérification du job GitHub.
