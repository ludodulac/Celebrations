# M021-B — Mode administration simplifiée

La version M021-B prolonge M021-A **sans nouvelle administration**.

## Comportement

Dans « Administration → Paramètres », la case **Activer la gestion des membres et des accès privés** est désactivée par défaut. Son état est enregistré sur le snapshot éditeur R2 existant, via l’API administrative authentifiée `/api/site-identity`, avec contrôle d’origine et de révision.

- **Case décochée** : le menu Membres disparaît ; « Langues et catégories » devient « Langues » ; les catégories et commandes Public/Privé disparaissent des formulaires de pages et célébrations ; le site public ne propose pas la connexion des membres. Les commandes d’édition, de visibilité Brouillon/Visible/Masqué, les langues, la médiathèque, les duplications et l’identité visuelle restent accessibles.
- **Case cochée** : Membres, Catégories, versions par catégorie, contrôles d’accès, comptes fictifs de préproduction et connexion des membres reviennent, sans restauration/recréation de leurs données.
- **Ancien contenu privé** : l’éditeur ne convertit pas implicitement le contenu en public ; un avertissement invite à réactiver le mode complet pour changer ses autorisations. Les protections côté serveur sont indépendantes de la case.

## Frontière de sécurité

Le mode est **uniquement visuel** : aucun enregistrement de droits d’accès, de catégories, d’inscriptions, de révocations, de sessions ou de publication n’est modifié par ce réglage. Le lien Administration conserve son code d’accès. Le formulaire de connexion des membres reste disponible par son URL directe avec ses contrôles de sécurité existants.

## Validation

- `node scripts/build-m012b-member-spaces-inline.mjs --check`
- `node scripts/build-m019-editor-client.mjs --check`
- `node --test tests/test_m021b_admin_mode.mjs tests/test_m021a_demo_identity.mjs tests/test_m021a_demo_flow.mjs tests/test_m020d_member_brevo.mjs`
- Préproduction M016 seulement : `node scripts/test-m021b-m016-preview.mjs`, Chromium smartphone 390 × 844, avec captures `docs/m021b-smartphone`. Le test rétablit l’état initial du réglage après les essais.

La CI ne déploie M016 qu’avec le marqueur explicite `[M021B_ISOLATED_PREVIEW]`, **après** contrôle de la configuration isolée et sauvegardes chiffrées D1 + R2. Le Worker officiel est comparé avant/après ; en cas d’échec, la version Worker M016 antérieure est réinstallée. Aucun domaine personnalisé n’est modifié.