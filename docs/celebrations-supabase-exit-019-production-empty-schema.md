# CÉLÉBRATIONS — mission 019 : schéma D1 de production, sans contenus ni lancement

**Pré-requis déjà prouvé le 21 octobre 2026** : GitHub Actions [#39581948373](https://github.com/ludodulac/Celebrations/actions/runs/39581948373) a créé **deux ressources Cloudflare séparées, vides et non publiées** :
- D1 `celebrations-exit-production` UUID `28736d2a-479b-472b-bf82-703ad0affe10`, juridiction `eu` ;
- R2 privé `celebrations-exit-production`, classe `Standard`.
La D1 de staging, le bucket R2 staging, le site GitHub Pages et Supabase n'ont pas été modifiés.

Cette mission installe **uniquement les 19 tables vides et les index déjà éprouvés** dans la nouvelle D1.

## Sécurité

Le job n'est disponible qu'avec le commit `[PROD_SCHEMA_EMPTY_ONCE]` sur `feat/celebrations-supabase-exit-001`.

1. Vérification de l'utilisation D1 **du compte Cloudflare entier** (réserve 2,5M lectures et 65k écritures).
2. Confirmation Cloudflare API de l'identité D1 **juridiction EU**, de l'identité R2 **Standard**, des ressources strictement différentes de staging, et **d'aucune table applicative existante**.
3. Génération d'une configuration Wrangler **éphémère** à partir de l'UUID réellement trouvé, pas d'UUID inventé ; aucune donnée d'authentification dans GitHub.
4. `wrangler d1 execute ... --remote --file celebrations-schema.sql` puis `media-acl.sql` **uniquement** sur `celebrations-exit-production`.
5. Contrôle par l'API D1 du nombre de tables attendues (**19**) et des trois tables de données essentielles vides.

**Non inclus :** copie des 158 médias, import des 12 170 lignes du backup, synchronisation des nouveaux clics, clés administrateur de production, Worker déployé, DNS Spaceship ou mise en ligne. Ces tâches requièrent des vérifications séparées. Aucune suppression de Supabase ou des services partagés.

Statut initial : `PRODUCTION_D1_SCHEMA=PREPARED`. Toute revendication de réussite doit s'appuyer sur la véritable sortie du job GitHub Actions, pas sur la présence de ces fichiers.
