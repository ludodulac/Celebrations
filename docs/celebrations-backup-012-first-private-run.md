# CÉLÉBRATIONS — déclenchement ponctuel de sauvegarde chiffrée

- Première exécution de l'outil de sauvegarde privée, expressément demandée par le propriétaire après configuration du secret d'environnement.
- Ce commit ne contient **aucun** secret, identifiant personnel, dump ni donnée de production.
- Seul le workflow `.github/workflows/celebrations-private-backup-once.yml` peut traiter son marqueur de commit, exclusivement sur la branche de migration.
- La source Supabase est lue sans écriture ; seul le ciphertext AES-GCM est destiné au R2 **privé** de staging.
- Ne pas déclencher de synchronisation D1, de déploiement, de DNS, de bascule ou de suppression Supabase.
- Un run GitHub réussi ne vaut pas preuve de restauration ni copie hors fournisseur : contrôler les résultats et décider des étapes suivantes séparément.
