# Workflows historiques préservés

Les fichiers originaux sont conservés sans modification : `M051-source/` provient du commit `114358fd5eca5d1af5422efd19e92a754e6032c8` ; `main-cd380506/` provient du main `cd3805062b707b1eb352606ce4f172bdb66b30f8`.

Les anciens workflows mêlent tests, publications, migrations et copies de données. Leurs déclencheurs et références figées appartiennent à des missions passées. Ils restent consultables et récupérables, mais sont placés hors de `.github/workflows` afin que la promotion future de cette branche ne réactive pas un déploiement ancien ou une mutation de données. Aucun workflow du main existant n'est modifié par la création de cette branche.

Le workflow actif `reference-offline-validation.yml` reconstruit les sources et exécute les contrôles sans secrets ni accès Cloudflare. Les scénarios de tests utiles des anciens workflows restent disponibles ; les tests ciblés actuels sont repris dans ce nouveau workflow. Pour une publication future, créer un workflow dédié à la branche courante, avec approbation explicite, contrôle de la version Cloudflare active et des bindings. Ne pas réactiver M051 tel quel : il pointe vers l'ancienne source et une baseline obsolète.
