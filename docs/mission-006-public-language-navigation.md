# M006 — Préparation de la navigation multilingue publique

Base exacte : `f02e520a8ed8e8793ac69bd42f30d836a2438302` (M005-C).

## Périmètre livré
- `app/domain/public-language-navigation.mjs` : sélection des langues actives, conservation du choix par `?lang=`, génération d'un menu à IDs canoniques, repli M003, vérification M002 et filtrage public M12.
- `app/application/public-language-selector.mjs` : composant DOM facultatif `details` / `summary`, avec noms, drapeaux et liens accessibles.
- Tests M006 et workflow CI dédié, sans déploiement.

## Contrat de sécurité
1. Le client doit appeler **exclusivement l'API publique publiée** `/api/editor-publication` ; il ne doit jamais appeler `/api/editor-server-draft` ni exposer `state.localization`.
2. Toute page doit être retenue *après* vérification de sa publication et de sa politique canonique avec un contexte M002 **issu du serveur**. La langue n'est jamais une autorisation.
3. Les traductions de M004 vivent dans l'état privé de l'éditeur. Aucune traduction de cet état n'est lue par M006. Les champs `page.translations` sont volontairement ignorés.
4. Un futur mécanisme de publication, à développer séparément, devra figer chaque variante réellement publiée dans un artefact de lecture publique `publishedPageReleases[pageId] = {publication:'published', pageId, variants:{en:{name,blocks,...}}}`, après contrôle serveur et publication explicite. **Ne jamais remplir cet artefact à partir d'un brouillon au moment de la lecture**. Tant que cet artefact n'existe pas, le site ne peut afficher que les contenus originaux autorisés.
5. Le registre de langues fourni à M006 doit également venir d'une configuration **publique contrôlée** par l'administrateur, et non d'un brouillon non publié ; seules les langues actives sont offertes.
6. L'ancien routeur reste l'autorité. Le futur raccordement devra passer sa fonction `hrefForPage(page)` existante à M006, afin de préserver les slugs/IDs. Le paramètre `lang` n'est ajouté qu'aux liens de navigation internes, jamais aux PDF, médias, API ou liens externes.
7. Aucun code de ce lot n'est injecté dans le renderer public, ni dans l'API, les travailleurs Cloudflare ou `main` ; l'interface et le choix de langue ne sont donc pas encore visibles sur le site.

## Raccordement à demander au superviseur
Les fichiers partagés requis sont le renderer `migration/cloudflare/editor-trial-site-client.mjs`, son assemblage dans `editor-trial-site-page.mjs`, l'API de publication `migration/cloudflare/editor-publication-api.mjs` et le flux de publication du registre et des variantes. Leur modification ici aurait créé des conflits avec M007-A / M007-B : **aucune modification entreprise**.

## Vérification
`node --test tests/test_mission002_member_access.mjs tests/test_m003_localization.mjs tests/test_m004_page_localization.mjs tests/test_m005_celebration_spaces.mjs tests/test_m006_public_language_navigation.mjs tests/test_m006_language_selector.mjs`

Aucune écriture R2/D1, aucun changement de permissions, aucune mise en production.
