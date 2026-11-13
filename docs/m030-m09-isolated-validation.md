# M030 — Mission 09 : validation fonctionnelle en environnement isolé

Le test GitHub Actions déploie **uniquement** sur le Worker de préproduction
`celebrations-m016-admin-preprod`, avec les liaisons D1/R2 M016 vérifiées
et une archive chiffrée de leur état avant tout déploiement.

Tests : contrats des célébrations, refus des doublons, pages privées et membres,
contrôles de publication, préservation M029, navigateur Chromium ordinateur
et smartphone. Les 14 cycles et 56 emplacements doivent être visibles en
administration sans date du mercredi, et le menu public ne doit exposer
ni les contenus privés ni deux célébrations de même cycle. Les opérations
n'ajoutent, ne suppriment et ne publient **aucune** donnée de la préproduction.

Un M016 ne contenant aucune célébration canonique publique n'est pas artificiellement
peuplé : le test note que l'affichage des cartes publiques est non testé ;
le contrôle complet se fera ensuite sur la copie locale et au passage officiel.

Avant et après, vérifier par API Cloudflare que **le Worker officiel n'a pas changé**.
En cas d'échec de tests après déploiement, remettre l'ancienne version du Worker
de préproduction uniquement.
