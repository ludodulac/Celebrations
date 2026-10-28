# CÉLÉBRATIONS — MISSION C — conversion historique, 28 octobre 2026

## Périmètre et résultat vérifié

- Branche : `feat/celebrations-admin-visual-mission-c`, issue de la branche MISSION B, aucune fusion vers `main`.
- Destination exclusive : Worker `celebrations-exit-staging.rondes.workers.dev` et D1 staging `0f761662-241f-42cc-ac94-5c68b4aa7797`.
- Lecture des branchements Cloudflare *déployés* et des quotas avant l'exécution : PASS. Aucun branchement à la D1 de production.
- Conversion à blanc : [GitHub Actions #40776746578](https://github.com/ludodulac/Celebrations/actions/runs/40776746578) — SUCCESS.
- Conversion staging et post-vérification : [GitHub Actions #40776861150](https://github.com/ludodulac/Celebrations/actions/runs/40776861150) — SUCCESS.

### Parité des sources et conversion

| Source D1 historique | Enregistrements représentés | Enregistrements omis |
| --- | ---: | ---: |
| Célébrations | 4/4 | 0 |
| Étapes (sept par célébration) | 28/28 | 0 |
| Rendez-vous | 62/62 | 0 |
| Contenus (tous types / toutes audiences) | 211/211 | 0 |
| Associations événement-contenu | 124/124 | 0 |
| Associations étape-contenu | 0/0 | 0 |
| Liens | 23/23 | 0 |
| Brouillons légaux | 3/3 | 0 |
| PDF historiques du comité | 9/9 | 0 |
| Réglages de visibilité | 1/1 | 0 |

**47 pages de travail / 327 blocs typés, 47 brouillons, 0 publication.**

Les pages de travail sont des routes internes `/__editor/legacy/...` distinctes de leurs anciennes URL publiques enregistrées en métadonnées. Les catalogues de 211 contenus sont divisés en pages de moins de 64 blocs.

### Méthode et protections

- `editor_b_pages`, `editor_b_revisions`, `editor_b_blocks` sont **conservées**. Seules `editor_c_blocks` et `editor_c_imports` sont créées en complément.
- Tous les blocs complexes ont un type historique explicite et conservent leur ID source, leur relation, leur ordre et leurs attributs de visibilité. Les contenus et médias restent **référencés**, jamais recopiés dans R2.
- Les réimportations identiques sont détectées par empreinte. Après import, la relecture a confirmé **47 inchangées / 0 doublon**. Les modifications de l'ancienne administration seront importables ultérieurement comme nouveaux brouillons tant que la page cible n'a pas été éditée indépendamment ; sinon, conflit explicite, sans écrasement.
- Aucun brouillon importé ne peut être publié via l'API actuelle, même par l'administrateur, avant validation du futur rendu public et des contrôles d'accès. Les célébrations planifiées restent non publiées.
- Les 9 PDF du comité sont répertoriés uniquement dans un ensemble administratif non listé. Leurs slugs et chemins historiques sont conservés. Les statuts `audience` existants ne sont pas élargis.
- Aucune table historique, aucun objet R2, aucun DNS, aucun Worker de production et aucun ancien lien PDF n'a été modifié.
- Le Worker staging a été mis à jour sans remplacer l'administration existante, laquelle a répondu HTTP 200 lors du test de contrôle.

### Limites explicites

La parité vérifiée est la **parité des lignes et relations D1**, pas l'équivalence visuelle écran par écran. Les styles CSS, la logique JavaScript historique, les comportements de navigation, le rendu de la galerie et certaines mises en page complexes ne sont **pas encore reconstruits** en blocs visuels. Les fragments HTML historiques ont été conservés comme références *non exécutables* avec une exigence de nettoyage/validation avant rendu.

Il n'y a pas eu de connexion administrateur réelle suivie d'une édition authentifiée sur le Worker staging lors de cette mission. Les opérations autorisées ont été testées localement sur données synthétiques ; sur le Worker staging, les accès anonymes ont été refusés (401) et la page importée non publiée a renvoyé 404.

### Contrôle de sécurité / ressources

Le contrôle de quota du 28 octobre 2026 a remonté au plus tard :
- Avant : 235 105 lignes lues et 132 écrites, toutes D1 du compte.
- Après : 235 789 lignes lues et 132 écrites dans la fenêtre de remontée Analytics (mesures différées).
- Quotas disponibles très supérieurs aux réserves de sécurité.

### Suite à autoriser séparément

Mission D uniquement après GO : rendre les nouveaux blocs avec autorisations côté serveur, comparer les écrans rendus avec le site existant, puis tests réels authentifiés et de visibilité. **Ne pas remplacer le rendu public avant validation.**
