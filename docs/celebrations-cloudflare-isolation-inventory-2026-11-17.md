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
