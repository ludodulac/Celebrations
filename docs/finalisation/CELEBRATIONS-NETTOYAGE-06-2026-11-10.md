# CÉLÉBRATIONS — NETTOYAGE 6/6 : contrôle et publication contrôlée

**Date de lancement : 10 novembre 2026.**

## Objet et autorisation

Le propriétaire a donné son accord explicite : « Go mission 6 ». Cette opération doit publier sur le Worker Cloudflare existant les nettoyages des missions 1 à 5, **sans changement de compte Cloudflare**, sans transfert DNS, sans écriture D1/R2 et sans suppression de fichiers médias.

L'ancien site de référence `production/celebrations-live` et l'ancien `main` restent inchangés.

## Ce qui est vraiment différent dans le logiciel

Comparaison de la source de production `65caf8d5d03d29882d0de0c0d00cdcfc622e473e` à la version nettoyée : **deux fichiers runtime modifiés**.

- `supabase-data.js` : suppression de la conversion inutile « faux chemin REST Supabase → nom de table Cloudflare D1 » ; résultats des mêmes huit tables inchangés.
- `migration/cloudflare/production-worker.mjs` : table fixe d'alias de navigation déplacée au chargement du module et réemploi de la vérification du domaine officiel, sans changement des routes.

Les 35 workflows historiques déjà archivés sont hors du code exécuté par le Worker. La mission 5 a ajouté les guides et outils de préparation d'un **transfert futur**, sans lancer de migration.

## Préflight réel réussi

[GitHub Actions #42812985726](https://github.com/ludodulac/Celebrations/actions/runs/42812985726) — **SUCCESS** :

- 61 contrats Node, 205 régressions d'administration et 6 tests Python du transfert : **272 tests réussis**.
- Build original et build nettoyé, **96 assets comparés** : seul `supabase-data.js` diffère.
- Source Cloudflare sans URL réseau Supabase, **PASS**.
- Worker actif contrôlé : ancienne version `eccb1274-2ed8-491f-8557-c4330342e4bf`, déploiement `ffdc7b2b-a443-45cf-843d-0419fe71cb8d`.
- Domaines officiels tous deux attachés au bon Worker ; accès aux brouillons privés **401**, test d'accès public et formulaire administrateur PASS.
- Médias **113/113** ; PDF sur les deux domaines officiels **9/9** et **9/9**. Anciens liens Workers.dev volontairement exclus.
- **Aucune écriture distante dans ce préflight.**

## Publication et retour arrière

Seul le workflow `.github/workflows/celebrations-cleanup-06-publish.yml` peut effectuer le changement en présence du message de commit `[CLEANUP06_PUBLISH_OFFICIAL]` et du compte/environnement GitHub disposant des droits autorisés. Il reconstruit les assets, reprend les bindings existants D1 et les deux buckets R2, puis charge une **nouvelle version immuable** du Worker **sans déplacer le trafic**. Après validation de la version, il bascule 100 % du trafic officiel et vérifie visiteurs, ordinateur/mobile, médias, PDF, autorisations et version active.

En cas d'échec après la tentative de bascule, un garde-fou séparé rétablit la version exacte `eccb1274-2ed8-491f-8557-c4330342e4bf`. Aucun rollback de contenu D1/R2 n'est prévu car aucun contenu n'est modifié.

**Statut de ce document au moment de sa création : préflight VALIDÉ, publication non encore confirmée.** La mission ne doit être déclarée publiée que si les journaux du workflow de publication montrent explicitement la nouvelle version Cloudflare active à 100 %, les tests post-publication réussis et aucun rollback.

## Limite à conserver honnêtement

Le test d'administration avec le **véritable code d'accès du propriétaire** et une sauvegarde réelle en session connectée exige une vérification humaine sur le site officiel. Les tests automatiques couvrent uniquement les contrôles de refus anonymes, la publication publique et des scénarios isolés.
