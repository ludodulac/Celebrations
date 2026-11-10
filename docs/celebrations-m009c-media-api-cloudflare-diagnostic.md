# CÉLÉBRATIONS — MISSION 009-C
## Passerelles publiques, médias R2, API D1 et diagnostic Workers Builds

**Branche uniquement** : `feat/celebrations-m009c-public-media-api-security-20261110`  
**Base attestée** : `61e699e5a90350239d2b7df25c147dbfa01e459a`, M008-D.  
**Non déployé** — aucune modification D1/R2/DNS, ni activation d'une route membre privée.

### 1. Audit des points d'entrée

| Surface | État constaté sur la base | Protection M009-C |
|---|---|---|
| `/media/<key>` / `/letter/<slug>` | `media-gateway.mjs`, allowlist D1 / références historiques, accès par ancien groupe et prévisualisation admin | Préfiltre du nom réservé `private-members/` (également encodé ou imbriqué) **avant D1 et avant R2**. Test du chemin résolu des lettres. Binding R2 public différent du binding futur privé ; refus si alias. En-têtes `no-store`, `Vary`, `nosniff`, pas d'ETag sur les lettres. |
| `/?lettre=...` et `/lettres/<slug>` | `legacy-link-router.mjs`, même passerelle de lettres, liste `committee_media` | Inchangés : protégés indirectement par le garde du media-gateway. Slugs historiques et PDF valides préservés. |
| `/api/public-data?table=...` | Tables D1 historiques avec `SELECT *`, filtrage `all/angel/nonangel` | Colonnes anciennes explicitement énumérées, tables nouvelle identité/espaces non exposées, références `private-members` exclues dans le SQL et dans les lignes de sortie. Les jointures publiques et l'optimisation de quota D1 sont conservées. |
| `/media/new/<uuid>.<ext>` | `handleEditorMediaFile` exposait tout upload par UUID valide sans tester la publication | Nouveau `public-upload-gateway.mjs` placé **avant** cet ancien handler. Une URL connue n'est plus une autorisation : page canonique publiée et accessible sans compte **ou** explicitement galerie publique ; sinon seul un administrateur à cookie serveur vérifié peut prévisualiser un brouillon non privé. `no-store` même pour les fichiers publics. Pas de route membre. |
| `env.ASSETS.fetch` | La réponse statique peut être exécutée après les routes Worker ; `run_worker_first` incomplet dans les fichiers d'exemple | Refus précoce des namespaces réservés dans production/staging/readonly/legacy et exemples Wrangler `run_worker_first = true` pour tous les chemins. La fabrication des assets ignore les dossiers `private-members`, etc. |
| R2 direct / `r2.dev` / domaine personnalisé | Pas de vue autorisée ici sur les réglages Cloudflare du bucket | **Contrôle d'infrastructure non prouvé**. Un domaine public R2 contourne entièrement ce code. Le futur `PRIVATE_MEMBER_BUCKET` doit être distinct, sans `r2.dev`, sans domaine custom et jamais lié à une route publique. |

### 2. Réutilisation effective de M008-C

Le refus réservé des passerelles utilise `privateNotFound()` de `app/security/member-private-access.mjs`, y compris ses en-têtes anti-cache et son erreur 404 uniforme. Aucune passerelle ne traite les catégories historiques `all`, `angel` et `nonangel` comme preuve d'un droit membre M002 : elles demeurent exclusivement une convention d'affichage historique. **Le seul service autorisé à lire les fichiers des membres privés reste `handlePrivateMedia`, non activé, avec contrôle de la page canonique, des droits D1 et du binding R2 dédié.**

Les codes `production-worker.mjs` et `staging-worker.mjs` n'importent toujours pas directement le service des routes membres : l'interdiction d'activation M008-C demeure.

### 3. Préservation du public historique et en-têtes

Tests synthétiques sur la consultation des médias historiques autorisés (image, audio, PDF), récupération par slug `/letter/`, refus des slugs invalides, `HEAD`, `Range`, ancien programme et routes publiques statiques.

Les passerelles réévaluent l'accès à chaque requête, avec réponses non mises en cache, afin qu'une révocation ACL ou un changement de publication ne soit pas neutralisé par un cache partagé. Les fichiers SVG sont servis avec CSP sandbox et les types actifs inconnus comme pièces jointes.

**Important :** un cache CDN déjà rempli sur une ancienne version nécessite un contrôle/purge opérationnel lors du futur déploiement. Les nouveaux en-têtes seuls ne peuvent rétroactivement supprimer un objet déjà présent au bord du réseau.

### 4. Diagnostic `Workers Builds: celebrations` (échec externe)

Observations vérifiables sur les **checks GitHub**, sans accéder au tableau de bord ni aux secrets Cloudflare :

- Commit de base `61e699e5a90350239d2b7df25c147dbfa01e459a` : check `Workers Builds: celebrations` `failure` le 10 novembre 2026. Build IDs relevés `66867f6e-0d91-4b79-ac7d-7ec88240bff2` puis `fedfca56-fcb9-4136-8fb3-e47791911a11`.
- Commit antérieur `c976791835fc5f1d7d2c37123face418d0501ca6` : même check `failure`, Build ID `075f83b7-7071-4f69-8057-947febf4d8d5`.
- Commit antérieur `955041917597ad4d2a5deb21de8e641253c6621f` : même check `failure`, Build ID `2b2457cb-9902-4641-8e51-51c9cc4dcb92`.
- Sur le commit M008-D, les contrôles indépendants GitHub Actions (Node et D1 local, navigateur) indiquent `success` ; les checks Cloudflare ne fournissent **aucune annotation d'erreur**, seulement le Build ID et le lien vers le tableau de bord.
- Le dépôt à la racine ne contient **ni** `wrangler.toml`, **ni** `wrangler.jsonc`, **ni** `package.json` ; les exemples Wrangler et les scripts de génération du candidat se trouvent dans `migration/cloudflare/`. Ce décalage **pourrait** expliquer une commande de build exécutée à la racine, mais la cause exacte **n'est pas démontrée**.

**Conclusion** : impossible d'attribuer rigoureusement ce check au code, à la configuration ou à une panne Cloudflare sans les journaux privés du Build ID. Ne pas supprimer, renommer ni ignorer le check. Le lien du check mène à **Cloudflare Dashboard → Workers & Pages → celebrations → Builds → Build ID → Logs** : noter le premier échec réel, la commande exécutée, le répertoire de travail, l'étape de dépendances, la version de Wrangler et la présence/absence du fichier de configuration. Comparer avec les workflows `celebrations-exit-tests.yml` et `celebrations-m008d-consolidation.yml`, qui **testent** uniquement et ne reproduisent pas le pipeline Workers Builds.

**Correctif minimal probable si les journaux confirment l'erreur `no wrangler config` / `no package.json`** : ajuster le répertoire de travail/commande de build dans la configuration Workers Builds pour utiliser un fichier Wrangler explicitement généré et validé pour `celebrations`. Ne pas substituer automatiquement les exemples `celebrations-exit-production` ni créer une configuration de déploiement production dans cette mission. Aucune modification du service Cloudflare n'est tentée.

### 5. Limites bloquantes avant activation réelle des espaces privés

1. Vérifier **dans Cloudflare** que le bucket `PRIVATE_MEMBER_BUCKET` futur est physiquement distinct de `MEDIA_BUCKET` et `EDITOR_BUCKET`, sans `r2.dev`, custom domain, exposition via Workers/Pages static assets ou token public.
2. Effectuer un test HTTP réel, sur environnement isolé approuvé, des variantes encodées, `Range`, `HEAD`, `304`, redirects, caches/CDN, alias de domaine et chemins directs R2. Les tests actuels ne touchent aucun R2/D1 réel.
3. Consolider avec M009-A la projection `publicSnapshot/publishedMedia` et avec M009-B la correspondance d'identité. Les anciennes vues `handleTrialSite`, les prévisualisations et les exports font partie de la revue transversale ultérieure. Cette branche n'affirme pas que toutes les sorties de publication sont déjà étanches.
4. Avant diffusion, confirmer que le bucket privé ne contient aucun média historique public à migrer et qu'aucun fichier privé n'a été mis dans un bucket déjà servi par un domaine public. Les routes publiques historiques et les URL comité ne doivent pas être cassées.

### 6. Tests et exploitation

`tests/test_m009c_public_media_api_security.mjs` emploie des doubles D1/R2/ASSETS pour prouver qu'aucun chargement d'octets n'a lieu en cas de refus, en conservant les consultations publiques historiques.

Workflow sans secrets et sans déploiement : `.github/workflows/celebrations-m009c-public-media-security.yml`, avec syntaxe, tests de mission et suites de non-régression `M008-C`, `M008-D`, ancienne passerelle et éditeur/publication.
