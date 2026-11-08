# 🌸 CÉLÉBRATIONS — Mission 14 : contrôle des accès et des routes

**Date :** 8 novembre 2026. **Branche :** `refactor/celebrations-mission-14-security-20261108` dérivée de M13 / PR #93. **Aucune fusion ni publication.**

## Audit : différences entre public, brouillons, administration

L'audit du code réel a identifié deux problèmes de confidentialité :

1. `GET /api/editor-open-draft` sur le domaine officiel était protégé
   à l'entrée `production-worker.mjs`, mais **pas dans le gestionnaire
   `handleServerDraft` lui-même** : un branchement ultérieur ou un appel
   direct aurait pu donner accès aux pages non publiées, aux célébrations
   programmées, aux pages communes et aux métadonnées des fichiers.
   Le POST du même gestionnaire vérifiait déjà le cookie administrateur.
2. Le domaine de prévisualisation
   `celebrations-visual-candidate.rondes.workers.dev` pouvait appeler le
   même `GET /api/editor-open-draft` **sans cookie**, et le Worker isolé
   autorisait de surcroît l'ouverture de l'interface d'administration par GET.
   L'intention « lecture seule » n'impliquait malheureusement pas «
   uniquement données publiques ». Cette voie est corrigée.

## Correctifs appliqués

- Nouveau module **pur** `app/security/editor-route-policy.mjs` : liste
  explicite des domaines officiels, domaines de prévisualisation, routes
  privées et vérification `Origin` strictement identique à l'origine
  HTTPS de la requête.
- `production-worker.mjs` bloque **avant tout appel à D1/R2 ou
  aux fichiers statiques** les routes privées sur les deux domaines
  de prévisualisation. Réponse **404, no-store, noindex**.
- `handleServerDraft` refuse aussi directement les GET privés provenant
  de la prévisualisation (404) et demande le **cookie signé administrateur
  sur GET comme sur POST** du domaine officiel (401 sans cookie), même
  si le gestionnaire est appelé indépendamment du routeur.
- Publication et médiathèque : les règles déjà existantes continuent de
  refuser les POST non authentifiés, les origines étrangères ou absentes,
  et les écritures sur les candidats (405). Leurs validations d'origine
  réutilisent maintenant la même fonction centrale HTTPS.
- Le mécanisme de connexion actuel (formulaire signé CSRF,
  dérivation du code, verrouillage D1, cookie HttpOnly/Secure/SameSite)
  reste inchangé, sans exposer de code secret dans le dépôt.
- Les pages **publiées** continuent à être accessibles en GET depuis le
  domaine officiel et les aperçus. Les brouillons restent séparés du
  site visiteurs.
- Aucun changement aux liens de médias historiques, aux schémas,
  au CSS/HTML, au flux de publication existant ni aux noms des routes.

## Tests
- Liste blanche des domaines et chemins, refus de toutes les routes
  privées sur le Worker des candidats en **amont de R2/D1/ASSETS**.
- Requête directe `handleServerDraft` sur le candidat : 404 pour GET,
  405 pour POST ; sur l'officiel sans cookie : 401 GET et POST.
- Session signée valide : accès privé autorisé sur `www` et sur le
  domaine racine, sans changement d'interface.
- Faux cookie et tentative de réutiliser un cookie officiel sur le
  domaine de prévisualisation : refus.
- Requêtes d'écriture sans `Origin`, à origine différente, à protocole
  HTTP, ou avec `Origin: null` : refus.
- Publication et média refusés avec des origines étrangères, même
  avec un cookie valide ; catalogue de médias privé inaccessible
  sans session ; contenu public filtré.
- Rejouer tests M05–M13 et parcours Chromium isolés.

## Risques résiduels identifiés — NE PAS les confondre avec des garanties acquises

**Le domaine de staging initial** `celebrations-exit-staging.rondes.workers.dev`
conserve volontairement son ancien endpoint
`/api/editor-open-draft` accessible sans cookie administrateur.
Des tests historiques et l'éditeur de démonstration s'appuient sur cette
possibilité. **Il ne convient pas d'y enregistrer des données réelles ou
confidentielles** tant que ce mode reste actif. Sa fermeture nécessite un
choix coordonné avec le fonctionnement de la démonstration ; cela ne peut
pas être annoncé comme sécurisé par la mission 14.

Les fichiers `/media/new/<UUID>` conservent leur modèle actuel
d'URLs de ressources : la protection de leur index et l'entropie de
l'identifiant n'équivalent pas à une politique de lecture privée
pour les binaires non publiés. À réévaluer avant des usages
confidentiels.

La reprise exacte du Worker officiel, les sauvegardes et la
restauration D1 et des octets médias R2, ainsi qu'une copie
indépendante de Cloudflare (**réserves M03**), restent bloquantes
avant toute mise en ligne. Les essais CI synthétiques ne certifient
pas la sécurité d'un compte Cloudflare réel.

**PR DRAFT ; aucune fusion ni aucun déploiement autorisé ici.**


## Validation finale M14 — 8 novembre 2026

**[GitHub Actions M14 #42465180992](https://github.com/ludodulac/Celebrations/actions/runs/42465180992) : SUCCESS**, sur le code du commit
`d07c16f0746fea6de9b30fc31dea7200fede02c4`.

- **182 tests Node réussis, 0 échec, 0 ignoré**. Les contrôles de
  refus d'accès sur les deux candidats et les deux domaines officiels,
  faux cookies, vrais cookies de test, `Origin` malveillant ou absent,
  lecture publique filtrée et refus de publication sans autorisation
  sont exécutés avec succès.
- Les tests antérieurs M05–M13 sont rejoués, y compris le contrat de
  sauvegarde conditionnelle et les réponses HTTP 409 en cas de conflit.
- **10 références Chromium de l'administration réussies** :
  cinq ordinateur et cinq téléphone ; zéro erreur JS et zéro requête de
  production observée.
- **Sélecteurs de médias PASS** à 1280 px et 390 px.
- **Glisser-déposer/Undo PASS** ; aucun changement de ce moteur.
- **Site visiteurs PASS** à 1280 px et 390 px ; aucune fuite de brouillon,
  y compris si la lecture publique est indisponible.
- **Trois familles de fenêtres PASS** en deux tailles d'écran,
  contrôle de superposition et fermeture Échap.
- Une première exécution M14 a révélé une ancienne référence à
  `PUBLISHED_HOSTS` laissée dans la routine de sauvegarde après
  centralisation des domaines, qui provoquait un 503.
  Cette référence a été corrigée en `isOfficialEditorHost`,
  sans désactiver les tests. **La seconde exécution complète est verte.**

**Périmètre vérifié :** le code du Worker et les services ont été exécutés
avec des requêtes et des buckets fictifs. Aucune donnée Cloudflare
réelle n'a été consultée ou modifiée. Un audit continu de sécurité
et la protection explicite du staging historiquement ouvert restent
nécessaires ; ne pas considérer les 182 tests comme une homologation
de sécurité du site déployé.

**PR #94 : DRAFT, ni fusionnée ni déployée.**
