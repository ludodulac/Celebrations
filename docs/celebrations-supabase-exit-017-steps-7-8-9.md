# CÉLÉBRATIONS — mission groupée 7 / 8 / 9, préparation avant bascule

Date : 20 octobre 2026. **Aucune modification du site actuellement en ligne, de son DNS ni du dépôt `main`.** Ne pas arrêter Supabase : le même projet héberge aussi d'autres applications.

## Étape 7 — Infrastructure de production

Le Worker candidat sans `?staging=1`, les pages servies par la passerelle Cloudflare et le modèle de ressources D1/R2 **distinctes** existent déjà dans la branche de migration (mission 016).

Cette mission ajoute un **relevé réel en lecture seule** de l'inventaire D1 et R2 du compte Cloudflare, pour vérifier si les ressources nommées `celebrations-exit-production` sont déjà présentes, sans les créer, les remplacer ou leur donner le domaine public.

**Interdiction de réutiliser silencieusement le bucket R2 de staging** : il inclut des sauvegardes chiffrées et autres fichiers non destinés au site public. Ne pas créer de ressources de facturation non nécessaires sans estimation et contrôle du Free tier.

## Étape 8 — Sauvegarde des routes et DNS pour retour arrière

L'ancien site **fonctionne**, déployé depuis GitHub Pages `main` SHA `4b5edd9c19ce989af2eae33445017dd30fcbbe92` ; constat HTTP confirmé lors de la mission 016.

Avant de modifier l'acheminement du domaine, un relevé exact de la zone DNS et des règles Workers sera indispensable :
- découvrir si `ronde-des-archanges-universelle.eu` figure dans les zones autorisées du jeton Cloudflare déjà installé ;
- si tous les enregistrements DNS **et** les Workers routes peuvent être lus intégralement, créer une **archive chiffrée AES-256-GCM** contenant les réponses originales dans le bucket R2 **privé** `celebrations-exit-staging`, sous `private-backups/dns-rollback-*.dnsbackup` ;
- utiliser la phrase secrète **déjà enregistrée** dans l'environnement GitHub privé `celebrations-staging`, jamais une phrase ou des informations personnelles dans les logs/PR/artifacts ;
- relire l'objet et vérifier le SHA-256 + la capacité de déchiffrement en mémoire ;
- sinon indiquer précisément **DNS_NOT_VISIBLE / DNS_PARTIAL / DNS_UNVERIFIED**, sans prétendre qu'un rollback DNS est certifié et sans toucher aux réglages.

Une copie chiffrée dans Cloudflare n'est pas une deuxième copie indépendante du même fournisseur ; elle sert seulement de preuve technique privée tant que la source initiale n'est pas changée. Les paramètres registre/DNSSEC/TLS externes à cette zone Cloudflare ne sont pas garantis par ce contrôle.

## Étape 9 — Synchronisation protégée **préliminaire**, staging uniquement

La source Supabase étant encore **ouverte** aux visiteurs et éditeurs, **aucune synchronisation exécutée maintenant ne peut être appelée "finale"** : des visites peuvent être créées dans la minute suivante.

Reprendre le script de migration précédemment vérifié `scripts/sync_celebrations_latest_staging.py` sans le réécrire :
1. contrôle des quotas D1 **du compte entier**, avec réserve sur les 5M de lignes lues / 100k écrites du plan gratuit ;
2. `DRY_RUN` : comparer 9 tables éditoriales avec le staging, inventaires des 158 médias et nouvelles visites de la source en `READ ONLY`. Refuser toute incohérence ;
3. seulement si le précontrôle réussit, `SAFE_STAGING_COPY` : copier **uniquement** les nouvelles statistiques de clic dans D1 de **staging**, en identifiants négatifs non concurrents, sans modifier les comptes, les médias, les brouillons légaux ou Supabase ;
4. contrôle d'identité détaillé de chaque clic et quota après l'opération.

**À la véritable bascule (mission 10)**, bloquer/geler les écritures pertinentes le temps nécessaire, produire un point transactionnel ou un snapshot cohérent sous gel, refaire les dernières différences contre la **vraie base de production Cloudflare**, certifier l'absence de delta résiduel puis seulement modifier le domaine. L'ancienne source Supabase reste accessible tant que la bascule n'est pas décidée et contrôlée.

## Statuts à ne pas confondre

- `STAGE_7_CANDIDATE_READY=YES`, `STAGE_7_ACTUAL_PROD_RESOURCES=TO_DISCOVER`.
- `STAGE_8_LEGACY_SITE_ACCESSIBLE=YES`, `STAGE_8_DNS_RECOVERY_BACKUP=TO_DISCOVER`.
- `STAGE_9_STAGING_PREFLIGHT=TO_RUN`, `STAGE_9_SOURCE_IS_FROZEN=NO`, `STAGE_9_FINAL_PROD_SYNC=NO`.
- `REAL_PUBLIC_DOMAIN_CUTOVER=NO`, `SUPABASE_ACTIVE=YES`, `USER_APPROVAL_FOR_DOMAIN_SWITCH=NOT_YET_REQUESTED`.

La commande de contrôle unique se déclenche uniquement par commit marqué `[CUTOVER_789_PREFLIGHT_ONCE]` sur la branche de migration. **Zéro déploiement, zéro changement DNS et aucune écriture dans la D1 de production.**
