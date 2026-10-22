# CÉLÉBRATIONS — Mission 06 : préserver les 9 liens PDF envoyés par e-mail

## Objectif validé par le propriétaire
Faire servir directement les neuf PDF privés R2 (contrôle d'accès D1 `committee_media`) par les **mêmes URLs littérales** `https://celebrations.rondes.workers.dev/?lettre=<slug>` ; ne pas modifier les slugs, ne pas rediriger vers un nouveau domaine, maintenir les autres pages et l'administration actuelles du Worker historique. Le domaine officiel et Supabase restent en place.

## Preuves préalables
- [Run #39681831830](https://github.com/ludodulac/Celebrations/actions/runs/39681831830) : les neuf liens originaux marchent toujours, mais leur HTML utilise encore l'Edge Function Supabase.
- [Run #39681405372](https://github.com/ludodulac/Celebrations/actions/runs/39681405372) : les neuf liens `?lettre=` servent directement PDF depuis D1/R2 sur Worker candidat, sans changer l'adresse ; les quatre redirections Drive sont couvertes.
- [Run #39779857288](https://github.com/ludodulac/Celebrations/actions/runs/39779857288) : nouveau Worker QA administrateur déployé, neuf liens PDF D1/R2 authentifiés et testés.
- Ces contrôles **ne prouvent pas encore** la bascule du Worker historique `celebrations`.

## Règles impératives d'intervention
1. Vérifier par HTTP que les fichiers visibles de l'ancien Worker correspondent **octet pour octet** aux ressources actuelles du dépôt `main`; inspecter et sauvegarder la définition du Worker actuel et ses bindings, sans afficher de secrets dans GitHub Actions.
2. Si l'ancien Worker n'est pas reconstituable ou si son contenu ne correspond pas à la source supposée, **ARRÊTER avant déploiement**. Ne pas remplacer aveuglément les pages publiques ou les routes de l'ancien Worker.
3. Préparer un Worker de compatibilité gardant absolument le nom historique `celebrations`, n'interceptant que les chemins PDF historiques, et déléguant toute autre requête aux ressources originales. Prétester cette configuration sur un Worker indépendant.
4. Avant tout remplacement de l'ancien Worker, exiger un retour arrière réalisable : conservation sûre de l'original, vérification des autres pages, contrôle du rôle des anciens assets et disponibilité des quotas Cloudflare. Une publication seulement si elle est sûre, sinon statut `BLOCKED_SAFE`.
5. Vérifier ensuite les neuf slugs via HEAD/GET sur l'**ancien hostname exact**, réponse `200 application/pdf` directe (sans `Location`) ; absence de contenu non autorisé, et préservation des autres pages.
6. Ne pas toucher au domaine officiel, à GitHub `main`, aux ressources des autres applications ou à la fonction Supabase directe (compatibilité nécessaire pour les anciennes URL `supabase.co`, traitées en mission 07).

## Contrôle courant
Audit sans modification du Worker original lancé avec `[MISSION06_ORIGINAL_WORKER_PREFLIGHT_ONCE]`. Résultat et décision à consigner à partir des preuves GitHub Actions. Un test qui échoue est une protection, pas une raison de forcer le déploiement.
