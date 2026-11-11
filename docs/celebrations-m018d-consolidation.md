# M018-D — consolidation A + B + C

- Base M018 : `cd1fc0ccf4b90fc3f414c85f95cc955811e0c089`
- Sécurité : PR #146 (`a3057df61b2ca538117703bc43522bbac49e6ac1`).
- Langues / visiteurs : PR #147 (`505fe3d3708760cf713422985799894d2654e8d8`).
- Administration : PR #148 (`fbe763c267bd0cbb5d4225c8c25636b19ebeb1a0`).
- Les trois branches ont été réunies par des commits Git à parents multiples dans la seule branche D ; ni les branches d'origine ni `main` n'ont été modifiées.
- Corrections intégration : affichage **titre uniquement** de célébration PRIVÉE+VISIBLE dans le menu ; aucune ouverture de la route privée anonyme ; masquées absentes ; pages ordinaires restreintes exclues de la projection publique serveur ; D1 historique et R2 inchangés.
- CI : suites ciblées D, A, B, C ; revue navigateur existant et M016 uniquement.
- Reste impératif : valider le parcours Chromium M016 existant et obtenir l'accord explicite du propriétaire avant toute publication officielle.
- Déploiement officiel, sauvegarde et restauration existants restent inchangés. Le retour arrière replace l'ancienne **version Worker** et conserve les migrations D1 additives. Aucun nouveau site, Worker ou bucket.
