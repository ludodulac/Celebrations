# Célébrations des Archanges

Site public et administration pour préparer et diffuser les célébrations, les pages et les médias.

> **État au 9 novembre 2026.** Le dépôt conserve une **version historique GitHub Pages / Supabase** et une **architecture Cloudflare Worker / D1 / R2**. Les missions de refonte M05–M17 sont empilées dans des branches GitHub et des PR en **DRAFT**. Elles ne sont **pas automatiquement présentes sur le site officiel**. Ne pas confondre « tests réussis » et « déploiement effectué ».

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
