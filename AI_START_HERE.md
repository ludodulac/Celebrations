# Célébrations — point d'entrée

Lire d'abord `CELEBRATIONS-PRODUCTION-REFERENCE.md`.

La branche `reference/production-reconciled-20261126` contient la source modulaire réconciliée avec le Worker officiel `celebrations-exit-production`, version `b12d2bf3-5201-407f-b7a8-0affdb2e2d08`. Le main historique n'est pas la source complète de la production et n'a pas été remplacé pendant cette mission.

Le backend actif utilise Cloudflare D1 et R2. Les fichiers historiques Supabase ne sont pas une instruction de réactiver Supabase. `migration/cloudflare/production-worker.mjs` est le point d'entrée ; `migration/cloudflare/app/` contient les modules métier, sécurité, application, persistance et styles. Modifier `editor-demo-client-source.js`, puis régénérer avec `node scripts/build-m019-editor-client.mjs`.

Contrôles hors ligne : `npm ci --ignore-scripts`, `npm run test:reference`, `npm run build:reference`, `python scripts/build_production_assets.py`, `python scripts/audit_production_supabase_paths.py`.

Ne pas publier, migrer D1, écrire dans R2 ni modifier les comptes pour vérifier une correction de code. Les anciens workflows sont conservés sous `docs/reconciliation/workflows-archive/` ; seul le workflow de validation hors ligne est actif sur cette branche. Une future correction intentionnelle du programme nécessite de réviser le manifeste de référence avec justification : ne jamais modifier son empreinte seulement pour faire passer le contrôle.
