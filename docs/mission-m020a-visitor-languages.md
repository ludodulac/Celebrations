# M020-A — Langues et expérience visiteur

Base : `26ca8c66315045b250c4c9d821ff2820fa2ca56a`.
Branche : `feat/m020a-languages-visitors-20261111`.
Cible : `feat/celebrations-m018-official-release-prep-20261111`.

- Catalogue enrichi à la lecture : fr, en, es, de, pt, it, ar, zh-Hans. Aucune migration ni écriture de production. Les huit langues sont disponibles dans les choix administratifs ; le catalogue n’exige plus de bouton d’activation.
- Le sélecteur public apparaît uniquement pour des contenus publiés et accessibles. La découverte traverse les célébrations publiques par la projection de sécurité existante. Les langues des pages privées proviennent exclusivement de la liste autorisée après identification du participant et disparaissent après actualisation des droits ou déconnexion.
- Catalogue de traductions des éléments fixes visiteurs : navigation, connexion, formulaires, messages, médias, accessibilité. Aucun appel de traduction automatique ; les chaînes éditoriales ne passent pas dans le dictionnaire.
- Une traduction publiée valide a priorité. À défaut, la véritable version française publiée est conservée, médias compris, avec un message sous le titre dans la langue choisie. Le document arabe est RTL ; le contenu français de remplacement reste explicitement LTR.
- Les protections serveur, catégories, inscriptions, identifiants, liens canoniques et mécanismes médias existants sont conservés. Les variantes brouillon ne sont jamais lues par les visiteurs.

Validation locale : 90 tests ciblés réussis, scripts inline compilables, composition administrative générée à jour, `git diff --check` réussi. Le lancement Chromium local est bloqué par l’interdiction de créer une socket (`Operation not permitted`). Le parcours navigateur reproductible ordinateur/Android est fourni dans `scripts/test-m020a-languages-browser.mjs` et dans le workflow M020-A, sans secrets ni déploiement et avec interception de toutes les requêtes. Le parcours Chromium distant a réussi sur ordinateur et au format Android (workflow 43079947495).

Aucun déploiement, aucune modification de D1/R2 ni du domaine officiel. Aucun contenu fictif ajouté aux données du site. L’éditeur des célébrations et la médiathèque ne sont pas modifiés : seule la rubrique du catalogue des langues et sa normalisation sont ajustées dans le client administratif partagé.
