# CÉLÉBRATIONS — Exécution unique du contrôle groupé 7/8/9

La branche `main` et le site public restent inchangés.

1. Vérifier les limites quotidiennes Free D1 de l'ensemble du compte Cloudflare.
2. Inventorier les ressources de production existantes sans les créer, et tenter de sauvegarder intégralement les DNS et routes en archive privée chiffrée seulement si la zone est accessible.
3. Comparer les 9 tables du programme, les 158 médias et les clics Supabase avec D1 staging en DRY_RUN ; refuser toute divergence.
4. Synchroniser seulement les nouveaux clics dans D1 **staging** si les contrôles sont tous au vert, puis vérifier chaque enregistrement.
5. Ne pas changer de domaine, ne pas déployer la production, ne pas supprimer Supabase et ne jamais appeler « finale » une synchronisation pendant que le site public fonctionne.
