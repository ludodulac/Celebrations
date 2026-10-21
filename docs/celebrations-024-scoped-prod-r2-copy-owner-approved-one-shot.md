# CÉLÉBRATIONS — copie privée des 121 médias publics avec les deux jetons distincts

Le titulaire du compte Cloudflare a créé une nouvelle clé `celebrations-production-r2` limitée en lecture/écriture au seul bucket privé `celebrations-exit-production`, puis a enregistré ses deux valeurs dans les **secrets de l'environnement GitHub**. Les noms des secrets visibles dans la capture avaient `ACCES` (un S) et le workflow a été adapté à ces libellés sans accès aux valeurs.

Déclencher uniquement le job `production-selected-media-with-two-scoped-keys` sur la branche migration. Relire la liste des 211 fiches et des 158 objets Supabase en lecture seule, sélectionner exactement **121 objets conservés / 766 989 338 octets**, copier les objets sélectionnés depuis le R2 staging privé avec ses identifiants de lecture vers le R2 production privé avec les identifiants indépendants, puis comparer les empreintes SHA256 et inventaires finaux. **Ne pas copier les 37 objets de revue, ne supprimer aucun objet original, ne pas écrire en D1, ne pas déployer de Worker, ne pas modifier les DNS ni GitHub main**.

Rapporter le résultat réel de GitHub Actions (SUCCESS/FAILURE), ne pas présumer une réussite si un secret est absent ou la clé refusée.

## Résultat réel — SUCCESS (21 octobre 2026)

Action GitHub [#39606076236](https://github.com/ludodulac/Celebrations/actions/runs/39606076236) : **SUCCESS**, vérifiée dans les journaux complets du job `production-selected-media-with-two-scoped-keys`.

- **121 fichiers réellement transférés** depuis `celebrations-exit-staging` vers le nouveau compartiment privé `celebrations-exit-production`, avec une paire de clés R2 limitée à chaque destination.
- **766 989 338 octets (≈ 767 Mo)**, fichiers et octets tous vérifiés en recalculant **SHA-256** avant/après.
- **37 objets de la source écartés de la destination de production**, conservés dans l'environnement de test / Supabase pour une revue ultérieure.
- **31 références historiques de chemins médias protégés absentes** du stockage source ; elles restent à résoudre, et ne représentent pas des pertes de transfert. Ne pas annoncer « aucun média manquant sur le site » avant de valider les fiches affichées concernées.
- **0 objet original Supabase supprimé ; 0 objet R2 staging supprimé ; 0 écriture D1 ; 0 Worker de production déployé ; 0 DNS modifié.**
- Valeurs des deux secrets conservées seulement dans les secrets de l'environnement GitHub ; jamais exposées dans une discussion ou un rapport. Les deux noms visibles de secrets avaient `ACCES` (un S) ; le workflow référence précisément ces noms existants et les mappe vers les noms d'environnement standard `ACCESS` (deux S) attendus par Python.

`PRODUCTION_SELECTED_MEDIA_COPY=SUCCESS_121_OF_121`
`PRODUCTION_MEDIA_BYTES_SHA256_VERIFIED=766989338`
`REVIEW_ONLY_MEDIA_NOT_COPIED=37`
`PUBLIC_SITE_DEPLOYED_TO_CLOUDFLARE=NO`
`PRODUCTION_DATABASE_DATA_IMPORTED=NO`
`DNS_CHANGE_AUTHORIZED=NO`

Étape suivante : préparer/importer de façon privée les données relationnelles nécessaires en D1 de production, recouper les 31 références manquantes et valider le site via URL de test avant toute bascule DNS.
