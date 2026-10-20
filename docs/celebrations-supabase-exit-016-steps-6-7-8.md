# CÉLÉBRATIONS — MISSION GROUPÉE 6 + 7 + 8

Travail strictement **pré-bascule**, aucun changement du domaine réel, du dépôt `main`, du projet Supabase ni de l'état actuel des Workers, D1 ou R2. Les contrôles encore nécessaires sont indiqués sans exagération.

## 6 — Site de test : validation ciblée et réelle

- Les contrôles antérieurs du navigateur, des 98 médias publics, de l'admin et des liens privés ont réussi sur staging les 19–20 octobre 2026 et **ne sont pas tous relancés inutilement**.
- Nouveau `scripts/verify-staging-final-readonly.mjs` : vrai HTTPS sur la page publique et admin, programme (4 célébrations, 62 événements, 211 ressources), passerelle Cloudflare sans SDK externe Supabase, image d'accueil, interdiction d'accès anonyme aux PDF comité et à la table participants.
- **Aucune écriture volontaire** ; pas d'ouverture de session admin, de création de compte ou de lecture de contenus privés.
- Déclenchement seulement par `[READINESS_678_ONLY_ONCE]` après contrôle du quota D1 à l'échelle du compte.

## 7 — Préparation de la production, séparée du test

Fichiers préparés **hors ligne et sans déploiement** :
- `migration/cloudflare/production-worker.mjs` : Worker candidat utilisant les handlers déjà éprouvés mais **sans forcer l'URL publique vers `?staging=1`**.
- `scripts/build_production_assets.py` : copie des assets de staging déjà isolés de l'ancien SDK Supabase, puis activation permanente de la passerelle Cloudflare pour les pages normales et l'administration. Ne modifie pas les fichiers sources historiques.
- `migration/cloudflare/wrangler.production.example.toml` : exemple sans identifiants ni secrets.
- `scripts/prepare_production_wrangler.py` : génération locale future d'un fichier de bindings avec une **nouvelle base D1 et un nouveau bucket R2 privés**, différents du staging. Refuse les collisions d'identifiants et tout écrasement de configuration existante. Tests de séparation avec identifiants fictifs.
- `tests/test-exit-production-candidate.mjs` : vérifie hors ligne la page normale sans redirection staging et le refus des routes inconnues.

**Bloqué avant déploiement réel :** vérifier les coûts/quota Free du compte partagé, préparer/créer les ressources distinctes, transférer les données/médias de manière protégée, renseigner les secrets production sans les exposer, valider l'environnement sur une URL de préproduction puis demander l'accord explicite pour modifier le domaine. **Aucun de ces actes n'est encore prétendu réalisé.**

## 8 — Point de retour arrière

- Version de secours confirmée : GitHub `main` SHA **`4b5edd9c19ce989af2eae33445017dd30fcbbe92`**, via workflow `.github/workflows/pages.yml`. Dernière exécution Pages connue : [run 39171559770](https://github.com/ludodulac/Celebrations/actions/runs/39171559770) **SUCCESS** du 18/10.
- Adresse actuellement connue : `https://www.ronde-des-archanges-universelle.eu`.
- `scripts/verify-legacy-rollback-baseline.mjs` effectue en lecture seule une **vérification fraîche** de ce site, de la résolution DNS, de la concordance du SHA `main` et du run Pages réussi.
- Procédure en cas d'échec **après une future bascule** :
  1. Empêcher toute nouvelle écriture en double sur les deux backends ; préserver les données Cloudflare créées depuis le basculement.
  2. Restaurer **uniquement** les règles DNS/route Workers à partir de l'export original réel et validé à l'étape de déploiement. Ne pas remplacer les adresses par une estimation.
  3. Contrôler sur le domaine l'accès à la page GitHub Pages d'origine et à Supabase ; vérifier les usages admin et médias, sans publier de secrets.
  4. Réconcilier les éventuelles nouvelles écritures Cloudflare avant de déclarer un retour arrière « sans perte ».
  5. Ne supprimer ni base D1 ni bucket R2 ni Supabase.
- **Bloquant restant :** sauvegarder **les valeurs exactes** de configuration DNS/routes Cloudflare avant changement. La résolution publique ne suffit pas à reconstruire toute la zone ou les routes et une simulation locale ne reproduit pas un vrai rollback. **Aucune modification DNS expérimentale n'est autorisée maintenant.**

## État initial

- Étape 6 = tests historiques réussis, contrôle ciblé actuel **en attente**.
- Étape 7 = **candidat prêt hors ligne**, pas d'infrastructure production créée ni validée.
- Étape 8 = **procédure de retour arrière préparée**, vrai basculement inverse non exécuté.
- Étape 9 reste synchronisation finale juste avant cutover, jamais aujourd'hui sans accord/quota.
