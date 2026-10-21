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

## Résultat réel — 21 octobre 2026

[GitHub Actions #39583120235](https://github.com/ludodulac/Celebrations/actions/runs/39583120235) : **SUCCESS**.

L'installation du schéma a été entièrement vérifiée :

- Précontrôle : **0 table applicative** ; la seule table interne `_cf_KV` réservée à Cloudflare a été correctement ignorée sans suppression ni interrogation.
- Installation du schéma métier : **32 instructions SQL**, 60 lignes D1 comptabilisées comme écrites pour ce lot.
- Installation des ACL médias : **3 instructions SQL**, 8 lignes D1 écrites.
- Postcontrôle : **19 tables applicatives** exactement. Les tables `celebrations_contents`, `celebrations_clicks` et `celebrations_participants` sont **vides**.
- Base `celebrations-exit-production` en juridiction **EU** et bucket R2 distinct `celebrations-exit-production` en stockage **Standard** confirmés.
- **Aucun Worker de production déployé, aucune modification DNS, aucune modification du site public, du staging ou de Supabase.**
- Les deux essais préalables avaient été bloqués correctement par un contrôle trop strict qui comptait la table interne Cloudflare `_cf_KV`. Correction fondée sur la documentation officielle, puis installation réussie ; pas de données d'utilisateur touchées durant les essais.

`PRODUCTION_INFRA_D1_R2_CREATED=YES`
`PRODUCTION_D1_SCHEMA_19_TABLES=YES`
`PRODUCTION_D1_INITIAL_APPLICATION_DATA_EMPTY=YES`
`PRODUCTION_MEDIA_IMPORTED=NO`
`PRODUCTION_WORKER_DEPLOYED=NO`
`SPACESHIP_DNS_CHANGED=NO`
`SUPABASE_PRESERVED=YES`

**Prochaine opération avant mise en ligne :** transférer de manière privée les 158 objets et les données validées dans les nouveaux supports de production, vérifier les hash et volumes, déployer et tester le Worker sous une URL de test distincte, puis seulement envisager une bascule DNS avec l'accord du propriétaire. Aucune bascule automatique.
