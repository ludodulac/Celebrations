# Célébrations — inventaire de séparation Cloudflare (2026-11-17)

## Cible de migration
- Domaine officiel : https://www.ronde-des-archanges-universelle.eu/
- Dépôt source : ludodulac/Celebrations
- Worker officiel : celebrations-exit-production
- D1 officiel : celebrations-exit-production (28736d2a-479b-472b-bf82-703ad0affe10)
- R2 officiel : celebrations-exit-production
- Bindings Worker officiel : DB et MEDIA_ACL vers D1 officiel ; EDITOR_BUCKET et MEDIA_BUCKET vers R2 officiel.
- Version Worker observée en production : ac339926-31a0-454f-87f2-8f3b90f000e8 à 100 %.

## Ancien environnement à rediriger
- Worker : celebrations-exit-staging ; sous-domaine workers.dev activé.
- Version observée : ad125222-1ce5-424d-a4fc-88c3e3d17236.
- D1 staging : celebrations-exit-staging (0f761662-241f-42cc-ac94-5c68b4aa7797)
- R2 staging : celebrations-exit-staging.
- Action future : remplacer uniquement le comportement HTTP public du staging par une redirection vers le domaine officiel, sans toucher aux données, puis vérifier toutes les routes et méthodes HTTP. Prévoir un retour arrière via version antérieure.

## Autres Workers Célébrations observés
- celebrations : sous-domaine workers.dev activé, à auditer.
- celebrations-exit-editable-qa : sous-domaine activé, bindings D1 et R2 **production**.
- celebrations-exit-preview-ro : sous-domaine activé, bindings D1 et R2 **production**.
- celebrations-legacy-links-qa : sous-domaine activé, bindings D1 et R2 **production**.
- celebrations-m015-public-preprod : sous-domaine activé, D1 et R2 médias production, EDITOR_BUCKET staging.
- celebrations-m016-admin-preprod : sous-domaine activé, D1 et R2 propres à M016.
- celebrations-visual-candidate : sous-domaine activé, D1 et R2 médias production, EDITOR_BUCKET staging.

## Isolation impérative
Les projets **Espace Jeunesse**, **Ludodio**, **La Forêt enchantée**, **in-sect** et **boralog-staging** sont hors périmètre. Ne jamais toucher à leurs Workers, D1, R2, secrets ou domaines dans cette migration.

## Ordre obligatoire des opérations
1. Vérifier les URL, routes, dépendances et éventuels consommateurs des anciens Workers.
2. Sauvegarder les configurations, inventaires de données et versions de retour arrière.
3. Rediriger l'ancien site staging sans supprimer ses données.
4. Vérifier que le Worker officiel ne dépend d'aucun ancien Worker, D1, R2, Supabase ou domaine ; auditer aussi le code et les URL de médias.
5. Tester les accès visiteurs, administration, membres, brouillons, médias, URL publiques et les deux formats d'écran.
6. Désactiver les environnements inutiles puis observer ; supprimer uniquement après validation et sauvegardes.
7. Préparer la migration future vers un **autre compte Cloudflare** : inventaire des DNS, domaines personnalisés, secrets (valeurs non exportables), identifiants D1/R2, URLs médias, sauvegardes et procédures de bascule.

**Ne pas confondre :** les bindings du Worker officiel sont propres, mais cela ne démontre pas encore l'absence de références externes dans le code, les pages, les fichiers ou les URL publiques. Aucune suppression irréversible n'est autorisée sur la base de cet inventaire seul.

## Contrôles du 17 novembre — redirection et stockage
- Le staging a reçu une nouvelle version de code `redirect.js` via l'API Cloudflare, déploiement `bd9838cdeb904fce82043f37f0611e91` ; l'utilisateur a confirmé que la racine de l'ancienne adresse mène au domaine officiel. Vérification des chemins profonds encore nécessaire. Les assets statiques sont encore configurés ; ne pas considérer les routes API comme vérifiées sans test.
- Les domaines personnalisés `ronde-des-archanges-universelle.eu` et `www.ronde-des-archanges-universelle.eu` pointent tous deux vers `celebrations-exit-production`.
- Inventaire R2 (liste retournée par API) : `celebrations-exit-production` 133 objets (48 PDF, 39 MP3, 38 JPG, 3 WebP, 4 PNG, 1 JSON) ; `celebrations-exit-staging` 206 objets ; `celebrations-media` 159 objets.
- Comparaison par clé : 73 objets staging sans clé identique en production (23 `editor-trials`, 31 `media`, 12 `private-backups`, 7 `tests`) ; 38 objets `celebrations-media` sans clé identique en production. Une différence de clé ne prouve ni perte ni nécessité de migration. Vérifier les références et les contenus avant copie ou suppression.
- Les schémas D1 production et staging sont différents : staging contient notamment `editor_b_*` et `editor_c_*`, production possède des tables récentes de répertoire et d'identités. Ne jamais remplacer D1 production par D1 staging.
- **Blocage de suppression :** pas de suppression de R2 staging, `celebrations-media` ni D1 staging avant vérification de tous les objets utiles et sauvegarde exportée.

## Périmètre média restreint : Michaël 2026 (ID 101)
À la demande de l'utilisateur, **ne traiter que les médias de Michaël 2026** ; ne pas migrer ou supprimer les médias des autres célébrations.
- D1 officiel : Michaël 2026 = célébration 101, active. 62 événements dans cette célébration.
- Contenus D1 liés aux étapes et événements : 108 (46 PDF, 38 Audio, 17 Vidéo, 7 Lien). 99 chemins de stockage/couverture renseignés : 98 clés présentes dans R2 production, 1 URL externe Google Drive de couverture pour « Programme RA Universelle Michaël AN23 » (le PDF est en R2). Les contenus D1 et le catalogue éditeur représentent des inventaires différents : ne pas additionner leurs nombres.
- État éditeur partagé lu **sans mutation** dans `celebrations-exit-production/editor-trials/server-drafts-v1.json` : 8 pages Michaël 2026 dans les brouillons et 8 publiées. Analyse récursive des URL `/media/` dans les blocs des 8 pages : 120 occurrences, 100 URL uniques dans chacun des deux états ; **aucune clé R2 absente**, aucune URL contenant `staging`, `workers.dev` ou `supabase` détectée dans ces références.
- Catalogue éditeur : 116 médias avec un usage déclaré sur la célébration 101 (25 images, 37 PDF, 38 audio, 16 vidéo) ; aucune clé `/media/` absente du R2 production.
- Ces contrôles prouvent la présence des clés, **pas** l'intégrité octet par octet, les autorisations de téléchargement, la validité des liens externes ou le fonctionnement sur tous les navigateurs. Ne pas effacer le staging ni `celebrations-media` avant sauvegardes et validation des autres dépendances de migration.

## Audit du code et de l'administration — préparation à la migration
- Le Worker officiel `migration/cloudflare/production-worker.mjs` importe ses modules d'administration et médias depuis le même dépôt ; les bindings D1/R2 officiels pointent vers les ressources de production. Ce constat ne prouve pas l'absence de toute dépendance externe : les appels réseaux et les intégrations restent à contrôler.
- `supabase-client.js` est actuellement un garde-fou de bootstrap Cloudflare (aucune requête Supabase dans ce fichier), mais conserve un nom historique et le drapeau `CELEBRATIONS_STAGING_BACKEND`.
- `scripts/build_production_assets.py` dépend encore de `scripts/build_staging_assets.py` pour générer les fichiers, puis remplace des références Supabase historiques. **Dette technique de build réelle, non résolue** ; ne pas retirer ces substitutions sans refonte testée.
- `.github/workflows/celebrations-m050-official-release.yml` utilise l'environnement GitHub `celebrations-staging` et les secrets `CELEBRATIONS_STAGING_CF_*` ; le nom ne signifie pas nécessairement une dépendance Cloudflare au staging, mais le futur compte nécessite ses propres secrets, son propre environnement et une validation des protections de déploiement. Le workflow possède également un garde de version immuable spécifique à M050 : ne pas le réutiliser tel quel.
- **Ajout effectif :** `migration/cloudflare/generate-portable-config.py` produit, sans déploiement ni mutation Cloudflare, une configuration Wrangler distincte avec noms de Worker, D1, R2, UUID et hôte fournis explicitement pour le compte de l'association. La configuration actuelle n'est pas modifiée.
- **Restant :** défaire les transformations historiques de build par étapes et tests de non-régression ; revoir toutes les URL codées en dur dans le Worker et l'admin ; générer un workflow officiel propre à la nouvelle association ; exporter/restaurer D1 et R2 ; préserver les URL médias via domaine officiel ; basculer le DNS seulement après validation.
