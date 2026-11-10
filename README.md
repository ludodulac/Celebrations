# Célébrations des Archanges

Site public et administration pour préparer et diffuser les célébrations, les pages et les médias.

> **État au 10 novembre 2026 — important.** Le site officiel est servi par le Worker **Cloudflare** et non par le `main` historique GitHub Pages. La version officiellement publiée le 9 novembre correspond à `production/celebrations-live` (code source de la livraison M5). Les améliorations suivantes se trouvent dans `develop/celebrations-maintenance` et ne sont **PAS encore publiées**. La branche par défaut GitHub reste actuellement `main`, qui est ancienne : ne pas commencer des changements pour le site officiel sur `main`.

## Quelle branche utiliser ?

| Besoin | Branche | Statut |
| --- | --- | --- |
| Retrouver exactement le code de la version officiellement livrée | `production/celebrations-live` | **Publié sur Cloudflare**, source figée au commit M5 |
| Faire les prochaines modifications et préparer le transfert Cloudflare | `develop/celebrations-maintenance` | **Base de travail, NON déployée** (nettoyages M1–M4) |
| Conserver l'ancien site GitHub Pages/Supabase | `archive/celebrations-old-main-20261110` | Sauvegarde immuable de l'ancien `main` |
| Ancienne branche GitHub par défaut | `main` | Historique, **ne pas utiliser comme base du Worker Cloudflare** |

La procédure de maintenance est documentée dans [**docs/operations/BRANCHES-ET-LIVRAISONS.md**](docs/operations/BRANCHES-ET-LIVRAISONS.md).

**Transfert futur vers un autre compte Cloudflare :** [guide de transfert et contrôles préalables](docs/operations/TRANSFERT-CLOUDFLARE.md). Le guide décrit les deux buckets R2 (dont celui portant le nom « staging » mais utilisé par la production), D1, les secrets, la sauvegarde et le domaine. **Le transfert n'a pas été effectué.** **Ne jamais publier automatiquement à partir de la branche `develop`** : la sortie en production exige tests, sauvegarde, contrôle de la version Worker active et possibilité de retour arrière.

## Commencer ici

- [Guide technique et d'exploitation actuel — mission 17](docs/architecture/CELEBRATIONS-M17-GUIDE-TECHNIQUE-2026-11-09.md) : modules, routes, données, configuration, tests, sauvegardes et publication.
- [Architecture cible et invariants — mission 4](docs/architecture/MISSION-04-ARCHITECTURE-CIBLE-2026-11-07.md).
- [Sécurité des accès — mission 14](docs/audit/MISSION-14-SECURITE-2026-11-08.md).
- [Compatibilité avec l'ancien logiciel — mission 15](docs/audit/MISSION-15-NETTOYAGE-LEGACY-2026-11-08.md).
- [Procédure de release et risques résiduels — mission 16](docs/audit/MISSION-16-DEPLOIEMENT-ROLLBACK-2026-11-08.md).
- [Documentation des performances — mission 17](docs/audit/MISSION-17-DOCUMENTATION-PERFORMANCE-2026-11-09.md).

## Organisation de la version Cloudflare

| Emplacement | Responsabilité |
|---|---|
| `migration/cloudflare/production-worker.mjs` | Routeur Worker et compatibilité des anciens chemins |
| `migration/cloudflare/editor-demo-preparation-page.mjs` | Page d'administration, programme à huit étapes |
| `migration/cloudflare/editor-demo-client.mjs` | Assemblage JS de l'éditeur, modules de domaine et commandes |
| `migration/cloudflare/editor-trial-site-page.mjs` | Page destinée aux visiteurs |
| `migration/cloudflare/editor-publication-api.mjs` | Lecture de la projection publiée, publication explicite et médias |
| `migration/cloudflare/editor-server-draft-api.mjs` | Brouillons privés et sauvegarde avec contrôle de version |
| `migration/cloudflare/app/` | Domaine, commandes, adaptateurs R2, règles de sécurité et couches CSS |
| `tests/`, `scripts/` | Contrats de non-régression et essais Chromium isolés |

**L'éditeur et le site visiteurs ne doivent pas partager les brouillons privés.** Une page nouvellement créée reste en brouillon jusqu'à une action de publication autorisée. Les versions Worker et les sauvegardes Cloudflare exigent une validation indépendante avant toute mise en ligne.

## Développement sans production

Pour lancer les tests Node des missions M05–M16 (Node 22) :

```bash
node scripts/mission16_editor_regressions.mjs
node --test tests/test_mission16_release_rollback.mjs tests/test_mission17_public_media_merge.mjs
node scripts/mission17_media_merge_benchmark.mjs
```

Les tests avec navigateur utilisent Playwright Chromium, les réponses HTTP fictives et les scénarios `scripts/mission02-editor-reference-browser.mjs`, `scripts/mission11-drag-undo-browser.mjs` et `scripts/mission12-public-visitor-browser.mjs`. Le workflow M17 ajoute une comparaison directe avec le commit M16 figé.

**Aucune commande de publication n'est prévue dans cette procédure.** Les contrôles de rollback exact, de restauration de D1 et des binaires R2 restent des conditions bloquantes selon la mission 16.

---

## Historique GitHub Pages / Supabase

Le dépôt conserve des pages et ressources plus anciennes (`index.html`, `admin.html`, `public-*.js`, `admin-*.js`, `supabase-*.js`, `app-data.js`, `.github/workflows/pages.yml`). Ces fichiers participent à l'historique et aux compatibilités : **ne pas les supprimer sans un audit des consommateurs et des routes**.

La documentation historique décrivait Supabase comme stockage canonique de cette ancienne version. **Cela ne décrit pas à lui seul l'application Cloudflare** : elle utilise D1 pour les enregistrements historiques, un snapshot éditorial R2 et les médias historiques/nouveaux suivant leurs parcours. Consulter le guide M17 pour les distinctions exactes.
