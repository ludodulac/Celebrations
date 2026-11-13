# M030 — Mission 03 : sauvegarde vérifiée et restauration hors ligne

**But :** protéger les données avant le futur nettoyage (aucune suppression dans cette mission).

## Provenance et contenu des deux sauvegardes chiffrées
- D1 officiel `celebrations-exit-production` : export **SQL intégral** de la base.
- R2 `celebrations-exit-staging/editor-trials/server-drafts-v1.json` : **snapshot intégral de l'éditeur officiel**, y compris brouillons, publications, pages générales, traductions et métadonnées.
- Les fichiers média R2 ne sont **ni supprimés, ni déplacés, ni copiés** pendant M03. Ils ne font **pas partie** de ces deux sauvegardes. **Interdiction absolue** de supprimer un objet média lors du futur nettoyage tant qu'une copie indépendante n'a pas été vérifiée ou que sa conservation n'est pas garantie. Ne pas appeler « sauvegarde intégrale de tous les médias » ce qui est ici uniquement D1 + snapshot éditeur.

## Contrôle de version et protection
- Vérifier l'identité du compte Cloudflare, du Worker, des liaisons D1 et R2, de ses deux noms de domaines et de la version officielle `76f31003-53b1-436f-ab6d-3217b05c91c3`.
- Si une version officielle différente est active, **arrêter avant toute lecture/export**, mettre à jour l'inventaire et non forcer le passage.
- Utiliser uniquement Wrangler `d1 export`, `r2 object get`, et l'API Cloudflare en lecture GET. Pas de SQL UPDATE/DELETE, pas de R2 PUT, pas de déploiement.
- Chiffrer les deux exports avec AES-256-CBC + PBKDF2 (200 000 itérations) et la clé dans le secret GitHub déjà existant, sans jamais afficher ni déposer cette clé.
- Déchiffrer les deux fichiers dans le runner, comparer octet à octet les originaux, **restaurer l'intégralité du D1 en mémoire SQLite locale**, vérifier la présence de Michaël 101 et des tables/relations, puis lire le JSON R2 pour vérifier la présence de ses pages brouillon/publiées.
- Ne déposer que les exports **chiffrés** et un petit manifeste sans données sensibles, dans un artefact GitHub Actions protégé à durée de rétention **30 jours**. Le runner efface les copies en clair.
- **Aucune restauration vers M016 ni vers le site officiel pendant M03**.

## Procédure à utiliser à l'étape finale
1. Récupérer les deux exports chiffrés et leur manifeste.
2. Vérifier les empreintes et tester l'import dans un SQLite local isolé (script `scripts/m030_verify_backup_restore.py`).
3. Préparer le plan exact de suppression et la liste des éléments conservés, y compris Michaël 101 et les pages générales.
4. Exécuter sur une **copie isolée uniquement** avant toute opération officielle.
5. Pour une restauration officielle éventuelle, ne jamais écraser un site en cours d'utilisation sans confirmation de la version, arrêt des écritures concurrentes et procédure de retour arrière validée.

**Statut :** sauvegarde exécutée et vérifiée uniquement si le workflow de mission 03 se termine avec résultat SUCCESS et les marqueurs `M030_M03_ENCRYPTED_BOTH_AND_RESTORABLE_PASS` et `M030_M03_NO_PRODUCTION_WRITES_AND_NO_PLAINTEXT_ARTIFACTS`.

[Workflow protégé, sans déploiement](https://github.com/ludodulac/Celebrations/actions/workflows/celebrations-m030-m03-backup-readonly.yml).
