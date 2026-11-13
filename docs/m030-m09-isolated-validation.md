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

## Test M016 — validation automatique du parcours et du Worker de préproduction

Le workflow a été corrigé pour respecter le format YAML GitHub Actions. Toute modification reste confinée au Worker M016 ; les données officielles ne sont jamais touchées.

Correction de mesure Chromium : lecture du résumé replié par textContent, aucun changement fonctionnel ni aucune écriture de données.

## Prérequis M10 : écriture conditionnelle à tester sur un objet jetable de M016

Aucune donnée officielle ne doit être modifiée tant que la prise en charge effective des écritures conditionnelles R2 n'est pas confirmée : si un administrateur a enregistré entre la sauvegarde et la migration, la restauration ne doit jamais écraser ses modifications.

## Essai de migration atomique, sans production

Le REST Cloudflare R2 ignore If-Match sur PUT (test M016 : retour 200 au lieu de 412). Un Worker **temporaire** lié exclusivement au R2 isolé de M016 teste donc `R2Bucket.put` avec `onlyIf.etagMatches`, puis il est supprimé ainsi que sa clé de test, quel que soit le résultat.

Essai Worker CAS reprogrammé après stabilisation du sous-domaine : une première requête immédiatement après déploiement obtenait 404 avant propagation, sans aucune écriture officielle. L'essai attend désormais explicitement la disponibilité.
