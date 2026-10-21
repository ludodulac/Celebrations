# CÉLÉBRATIONS — copie privée des 121 médias publics avec les deux jetons distincts

Le titulaire du compte Cloudflare a créé une nouvelle clé `celebrations-production-r2` limitée en lecture/écriture au seul bucket privé `celebrations-exit-production`, puis a enregistré ses deux valeurs dans les **secrets de l'environnement GitHub**. Les noms des secrets visibles dans la capture avaient `ACCES` (un S) et le workflow a été adapté à ces libellés sans accès aux valeurs.

Déclencher uniquement le job `production-selected-media-with-two-scoped-keys` sur la branche migration. Relire la liste des 211 fiches et des 158 objets Supabase en lecture seule, sélectionner exactement **121 objets conservés / 766 989 338 octets**, copier les objets sélectionnés depuis le R2 staging privé avec ses identifiants de lecture vers le R2 production privé avec les identifiants indépendants, puis comparer les empreintes SHA256 et inventaires finaux. **Ne pas copier les 37 objets de revue, ne supprimer aucun objet original, ne pas écrire en D1, ne pas déployer de Worker, ne pas modifier les DNS ni GitHub main**.

Rapporter le résultat réel de GitHub Actions (SUCCESS/FAILURE), ne pas présumer une réussite si un secret est absent ou la clé refusée.
