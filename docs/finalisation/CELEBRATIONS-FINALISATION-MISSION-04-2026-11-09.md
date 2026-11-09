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

**Statut au moment de la rédaction : MISSION 4 EN COURS, publication candidate M4 à exécuter sur CI.**
