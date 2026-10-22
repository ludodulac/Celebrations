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

## Résultat vérifié — 21 octobre 2026

[GitHub Actions #39610431175](https://github.com/ludodulac/Celebrations/actions/runs/39610431175) : **SUCCESS** (job `production-private-r2-media-acl-once`).

Précontrôles :
- 121 objets R2 privés présents dans le bucket `celebrations-exit-production`, pour **766 989 338 octets**, identiques aux 121 protégés sélectionnés depuis le bucket d'origine ;
- Neuf slugs de comité existants et uniques, tous pointant sur les neuf fichiers conservés ;
- D1 européenne du programme déjà prête (211 fiches contenus) ;
- Quotas Cloudflare D1 Free suffisamment disponibles, sans changement de plan.

**130 enregistrements supplémentaires réellement écrits et vérifiés dans la D1 privée** :
- `celebrations_committee_letters` : **9 lignes**, contrôle complet PASS ;
- `public_media` : **112 lignes `approved=1`**, aucun chemin comité autorisé publiquement, contrôle complet PASS ;
- `committee_media` : **9 lignes `published=1`**, accessibles seulement par leur slug existant, contrôle complet PASS.

Au total, le programme éditorial contient **456 lignes** et l'accès aux médias **130 lignes** vérifiées. Les autres tables (statistiques, participants, sessions, brouillons légaux, etc.) restent à traiter. **La destination n'est pas encore publique** : aucune URL de consultation ni Worker déployé.

Aucune suppression des 158 fichiers originaux Supabase, des 158 copies staging ou des 121 copies production ; aucun DNS touché, aucune modification de GitHub `main`, aucune modification des données Supabase. Les 37 objets hors sélection sont restés exclusivement dans l'original et staging. Les 31 références de chemins historiquement absents dans la source devront être examinées séparément.

`PRODUCTION_R2_PRIVATE_MEDIA_ACL=VERIFIED_112_PUBLIC_PLUS_9_COMMITTEE`
`PRODUCTION_COMMITTEE_LETTER_METADATA=VERIFIED_9`
`PRODUCTION_MEDIA_R2=VERIFIED_121`
`PUBLIC_WORKER_DEPLOYED=NO`
`PUBLIC_DNS_SWITCH=NO`

**Prochaine mission :** import et contrôle des données de compte / brouillons / statistiques, initialisation sécurisée des secrets de production, puis tests sur URL Cloudflare distincte avant toute éventuelle bascule publique.

## Résolution de l'ancien avertissement « 31 références » — mission 08 (22 octobre 2026)

L'avertissement conservé plus haut est **historique**, et non un blocage actuel : [run #39800612532](https://github.com/ludodulac/Celebrations/actions/runs/39800612532) a effectivement classé les **31 chemins absents chez Supabase**. **30** sont des images d'anciens éléments de galerie que l'interface utilisateur retire de l'affichage lorsque le binaire est absent ; le propriétaire a demandé de migrer seulement ce qui est réellement présent sur le site. **1** était le PDF du jeudi déjà restauré et désormais accessible en Cloudflare R2 (HTTP 200). Aucune absence supplémentaire dans les ressources d'accueil, couvertures ou autres catégories utilisées ; **113/113 médias approuvés** répondent HTTP 200 sur le Worker de prévisualisation. Ne pas lancer de recherche/restauration pour les 30 images de galerie non affichées. Ne pas effacer les données source ni modifier le domaine officiel ; l'audit visuel/navigateur exhaustif appartient à la mission 09.
