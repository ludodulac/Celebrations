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

**Statut final : MISSION 6 TERMINÉE ET PUBLIÉE.** La livraison a été effectuée et vérifiée, comme détaillé ci-dessous.

## Limite à conserver honnêtement

Le test d'administration avec le **véritable code d'accès du propriétaire** et une sauvegarde réelle en session connectée exige une vérification humaine sur le site officiel. Les tests automatiques couvrent uniquement les contrôles de refus anonymes, la publication publique et des scénarios isolés.

## Résultat réel de la publication — 10 novembre 2026

**[GitHub Actions #42813315981](https://github.com/ludodulac/Celebrations/actions/runs/42813315981) — SUCCESS.**

- **Version Cloudflare Worker mise en ligne à 100 % :** `081f5367-1f37-421e-bc55-27999cf2562c`
- **Déploiement final :** `51a8bff3-d3cf-4cc1-99e8-af00c9b31443`
- **Version précédente préservée pour rollback :** `eccb1274-2ed8-491f-8557-c4330342e4bf`
- **Source Git exacte ayant produit la version publiée :** `4dda3de63066ea51e4c99f0ef21255dfb4d0fcb9`, copie de référence `production/celebrations-live`. La branche `develop/celebrations-maintenance` a été avancée à ce même commit comme base de nouvelles modifications.
- **61 contrats Node + 205 régressions = 266 tests Node réussis pendant la publication ;** 6 tests Python du transfert réussis pendant le préflight = **272 tests automatisés validés au total**.
- **Chromium réel :** 4 contextes sur le site officiel, domaine racine et `www`, résolutions 1280 et 390. Navigation accueil, célébrations, mercredi et menu mobile **PASS** ; 0 erreur JavaScript, 0 échec HTTP serveur.
- **Médias historiques :** 113/113 disponibles ; **PDF : 9/9** sur le domaine racine et **9/9** sur `www`, sans redirection vers les anciens liens techniques.
- **Données des visiteurs :** révision publique 117 conservée, huit pages de célébration présentes. **Brouillons privés :** endpoint non authentifié refuse GET et POST (401) sur les deux domaines.
- **Cloudflare :** deux domaines toujours attachés au Worker officiel ; adresse `workers.dev` et preview URLs désactivées ; bindings `DB`, `MEDIA_ACL`, `MEDIA_BUCKET`, `EDITOR_BUCKET` et secret d'administration préservés.
- **Actions effectuées sur la production :** une bascule de version Worker uniquement ; **aucune écriture de contenu D1/R2, aucun changement DNS**.
- **Rollback :** la protection de rollback était prête, mais **n'a pas été exécutée**, car tous les contrôles après publication ont réussi.

## Suite sans nouvelle série de nettoyage

Cette mission **clôt les six missions de rangement demandées** ; la démarche de maintenance n'a pas vocation à ouvrir une autre liste de réparations. La branche GitHub par défaut reste l'ancienne `main` pour protéger le site historique GitHub Pages ; la branche actuelle de développement Cloudflare est `develop/celebrations-maintenance`.

**Reste une vérification humaine simple :** ouvrir l'administration sur le vrai domaine, saisir le véritable code privé, modifier un brouillon fictif ou un bloc de test non publié, vérifier que l'enregistrement persiste et que la publication volontaire fonctionne, sans divulguer le code à ChatGPT. Aucun code administrateur réel n'a été utilisé dans les tests automatisés.

**Le futur transfert vers le compte Cloudflare du collègue est préparé mais non réalisé.** Il exigera une sauvegarde à jour et déchiffrable, la restauration D1 + des deux R2 et une bascule de domaine autorisée, suivant `docs/operations/TRANSFERT-CLOUDFLARE.md`.
