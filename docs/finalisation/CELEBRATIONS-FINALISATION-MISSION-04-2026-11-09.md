# 🌸 CÉLÉBRATIONS — FINALISATION MISSION 4/5 — recette de fonctionnement

**Date : 9 novembre 2026.** Branche `release/celebrations-finalisation-04-recette-20261109`, issue de la mission 3. **Site officiel non modifié.** Les données D1/R2 réelles n'ont fait l'objet d'aucune écriture.

## 1. Parcours vérifiés dans le logiciel authentique, sur données isolées

La CI utilise le **vrai rendu HTML/JS/CSS de l'éditeur** et les **vrais gestionnaires ESM de persistance R2 et de publication**. Seuls l'environnement D1/R2 et la session signée sont synthétiques et conservés intégralement en mémoire. Chromium exécute les parcours sur ordinateur 1280 px et téléphone 390 px sans aucun accès à la production.

Contrôles : ouverture de l'éditeur, connexion via cookie HMAC synthétique, refus GET anonyme (401), modification de texte, clic Enregistrer, POST réel vers le gestionnaire R2 simulé, relecture JSON et réouverture après suppression de localStorage, visibilité de la modification sur un second navigateur, protection de conflit de version 409, médiathèque, pages publiées, refus de divulgation des brouillons, publication explicite d'une page auparavant privée, actualisation immédiate de la version publique d'une page déjà publiée.

[CI #42634322158](https://github.com/ludodulac/Celebrations/actions/runs/42634322158), job `verifications-integrite-et-editeur` **SUCCESS** : deux parcours Chromium PC/mobile, 47 tests Node ciblés, 205 tests Node de régression, 12 tests Python, 10 captures de l'éditeur, glisser-déposer Undo, fenêtres médias, 2 colonnes, vidéo, PDF et rendu public. Aucun appel externe émis par le navigateur de test et aucune écriture réelle.

**Limite :** ce parcours n'utilise pas le code secret véritable du propriétaire ni un compte administrateur connecté au domaine officiel. C'est un véritable essai de code en navigateur et via gestionnaires, mais **pas une session administrateur de production**.

## 2. Dysfonctionnement réel découvert sur le candidat déployé

Pendant les essais Chromium **en lecture seule** du vrai site `celebrations-visual-candidate.rondes.workers.dev`, la réponse de l'API publique était valide (révision 117, huit pages de célébration, une page générale, route privée 404), mais l'interface visiteurs ne s'affichait pas. Les journaux Chromium ont identifié la cause :

`ReferenceError: __name is not defined`.

L'outil de compilation Wrangler/esbuild insère une référence à `__name` dans le texte des fonctions ESM transformées. Ces fonctions sont ensuite sérialisées par `.toString()` dans le script HTML des pages, **sans le helper `__name` présent dans le contexte JavaScript du navigateur**. Les fixtures de Node importaient des fonctions non empaquetées et n'avaient donc pas détecté cette erreur réelle.

Deux correctifs ciblés :
- `migration/cloudflare/editor-trial-site-client.mjs` injecte le helper `__name` dans le script de visiteur **avant** la sérialisation de `createPublicVisitorModel()`.
- `migration/cloudflare/editor-demo-client.mjs` fait de même **avant** l'injection de treize fonctions ESM de l'éditeur (prévention du même problème à l'administration).
- `tests/test_finalisation04_visitor_bundled_helper.mjs` protège ces deux cas et exige la validité syntaxique des scripts générés. Une empreinte de protection historique M15 du fichier public corrigé est mise à jour explicitement pour refléter le changement revu.

## 3. Validation sur un candidat réellement déployé, sans toucher au Worker officiel

Une **unique publication du candidat de test** est autorisée sous le marqueur `[M04_DEPLOY_CANDIDATE_ONCE]`, après passage des tests :
- Worker ciblé exclusivement : `celebrations-visual-candidate` sur `workers.dev`, en lecture publique seulement et avec routes privées bloquées.
- D1 production **consultée en lecture seule** pour les contenus publics, R2 production consulté pour les médias ; aucun POST d'édition.
- **Aucun** déploiement de `celebrations-exit-production`, aucune mise à jour DNS, aucune écriture dans D1/R2 ou accès administrateur réel.
- La CI vérifie l'identifiant exact du déploiement officiel **avant et après** l'opération, et rejoue Chromium sur le candidat de test à 1280/390 px.

L'ancien staging a été désactivé comme éditeur en mission 2 et n'est pas une cible du déploiement M4.

## 4. Conditions honnêtes pour déclarer la mission terminée

M4 ne sera terminée que si :
1. Le parcours PC/mobile du vrai code administrateur et des API synthétiques reste vert.
2. Le candidat **réellement déployé** fonctionne en Chromium sans erreur JavaScript, avec menu, pages et fichiers.
3. Les domaines officiels actuels sont examinés séparément **en lecture seule**, et leur état actuel est décrit sans confondre site courant et refonte.
4. Les protections des brouillons et l'absence d'écriture D1/R2 réelles demeurent confirmées.

Si l'administration officielle ne peut pas être parcourue avec le véritable compte administrateur sans communiquer de secret, cette limite doit rester visible dans le bilan. La mission 5 devra vérifier le résultat **après publication de la refonte** sur le domaine officiel, sous accord du propriétaire.

**Statut définitif : MISSION 4 — RECETTE TECHNIQUE TERMINÉE**, sous réserve d'un essai manuel connecté au vrai compte administrateur lors de la livraison M5. Le site officiel reste inchangé.

## 5. Réparation et test réel du candidat — preuve du 9 novembre

**[GitHub Actions #42638013803](https://github.com/ludodulac/Celebrations/actions/runs/42638013803) : SUCCESS**, après correction du contrôle de configuration qui confondait la clé TOML autorisée `bucket_name` avec le champ `name` du Worker. Le seul Worker déployé est **`celebrations-visual-candidate`**. Le Worker officiel est confirmé inchangé avant et après : déploiement `cd46e1ba-e106-4f03-90aa-7110628a5b9f`.

Chromium sur le **site candidat réellement déployé** : desktop **1280 px PASS**, mobile **390 px PASS**, affichage de page non vide, quatre célébrations présentes, premier menu dans l'ordre Accueil / Célébrations / Médiathèque générale, menu déroulant utilisable, route `/mercredi/` OK, **0 erreur JS, 0 erreur 5xx, 0 écriture**. Les routes de brouillons privés répondent **404**, l'API publique retourne la révision 117 avec huit pages de célébration et une page générale. Le `ReferenceError: __name is not defined` qui avait été constaté auparavant a disparu sur ce candidat réellement publié.

**[CI offline M4 #42638013803](https://github.com/ludodulac/Celebrations/actions/runs/42638013803) : SUCCESS** également : parcours du vrai éditeur et des vrais gestionnaires d'API sur stockage synthétique, refus anonyme, sauvegarde puis relecture sur deux navigateurs, conflit 409, mise à jour d'une page déjà publiée sur Enregistrer, préservation des brouillons privés jusqu'à publication, médiathèque, 10 captures admin PC/mobile, régressions JavaScript et tests de restauration Python.

Ce premier run de publication candidate n'examinait que le site d'essai. L'audit ultérieur en lecture seule sur les deux domaines officiels a **réussi**, voir section 6 ci-dessous.

## 6 — Décision du propriétaire sur les URL des PDF et clôture des contrôles

Le propriétaire a explicitement indiqué le **9 novembre 2026** que **seuls les PDF accessibles sur le domaine officiel actuel, avec et sans `www`, sont requis**. Les anciennes adresses techniques `workers.dev` figurant dans certains anciens courriels sont **obsolètes à la suite de la migration** et ne doivent **pas** être réactivées, ni considérées comme des critères de blocage. L'adresse `celebrations.rondes.workers.dev` ne fait plus partie des adresses requises non plus. Laisser les anciennes administrations techniques bloquées est une mesure de sécurité, non une panne à réparer.

Le script `scripts/finalisation04_media_pdf_host_audit.mjs` a donc été corrigé pour ne consulter que :

- `https://ronde-des-archanges-universelle.eu/?lettre=…`
- `https://www.ronde-des-archanges-universelle.eu/?lettre=…`

**[GitHub Actions #42651661719](https://github.com/ludodulac/Celebrations/actions/runs/42651661719) — SUCCESS, deux jobs de recette PASS, aucun déploiement supplémentaire** :

| Test | Résultat vérifié |
| --- | --- |
| Site candidat `workers.dev`, Chromium 1280/390 px | 2/2 PASS |
| Site officiel sans www, Chromium 1280/390 px | 2/2 PASS |
| Site officiel avec www, Chromium 1280/390 px | 2/2 PASS |
| Routes publiques et ordre du menu | PASS (4 célébrations, pages et menu) |
| Erreurs JS, 5xx, débordements mobiles des six parcours | **0** |
| API brouillon du candidat sans authentification | 404, refusée |
| API brouillon du site officiel sans authentification | 401, refusée |
| Médias publics approuvés sur le domaine officiel | **113/113 HTTP 200** |
| Liens PDF approuvés sur le domaine officiel sans www | **9/9 HTTP 200 et `application/pdf`** |
| Liens PDF approuvés sur le domaine officiel avec www | **9/9 HTTP 200 et `application/pdf`** |
| Lien PDF inconnu et non approuvé | 404 |
| Routes privées des deux Workers de test | **8/8 bloquées en 404** |
| Tests de véritable code UI/API avec D1/R2 mémoire, PC/mobile | PASS |
| Régressions Node, Python et interfaces | PASS |
| Écritures de contenu D1/R2 réel, publication Worker officiel, DNS | **0** |

Les sites officiels envoient encore des tentatives POST de statistiques de visite lors de la navigation normale. **Toutes les tentatives ont été interceptées par le navigateur de contrôle** : aucun POST n'a atteint les données réelles dans la recette. Cette télémétrie n'est pas une anomalie de l'éditeur.

**Conclusion de M4 : recette technique réussie** pour les parcours automatisés sur le code actuel du candidat (éditeur via véritables gestionnaires mais stockage fictif) et sur les sites publics réellement accessibles (lecture seule). L'anomalie réelle `ReferenceError: __name is not defined` a été corrigée et le candidat déployé est testé sans erreur. **Le site officiel ne contient pas encore la nouvelle version candidate.** Aucun essai des modifications éditoriales sur la D1/R2 officielle n'a eu lieu ; cette vérification doit être faite avec le propriétaire, après publication M5, sans communiquer son code d'accès à des automatisations non validées. Une CI verte n'est pas une preuve de sécurité absolue, ni un test de migration vers le compte Cloudflare du destinataire.

**Décision : MISSION 4 TERMINÉE pour son périmètre de recette**, **mission 5 (publication contrôlée, validation de l'éditeur réel, contrôle du retour arrière) RESTE À FAIRE**, après accord explicite. Le maintien du domaine officiel et des données était une contrainte respectée pendant M4.
