# CÉLÉBRATIONS — vérification ponctuelle des 158 médias

Le présent commit demande **une seule vérification en lecture seule** des inventaires de Supabase Storage et du Cloudflare R2 privé de staging. Aucun téléchargement de corps des 158 médias, aucune écriture R2, aucune consommation D1, aucun changement de DNS ni de production. Préserver la source Supabase en tant que deuxième fournisseur indépendant de Cloudflare. Le résultat est attendu dans le job `media-manifest-audit` de `.github/workflows/celebrations-private-backup-once.yml`.
