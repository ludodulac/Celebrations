# CÉLÉBRATIONS — MISSION 05
## Retirer les adaptations fragiles du code de l'éditeur

**Date :** 7 novembre 2026  
**État :** CODE REFACTORISÉ ET TESTÉ SUR BRANCHE ISOLÉE — PAS PUBLIÉ  
**Branche :** `refactor/celebrations-mission-05-remove-string-patches-20261107`  
**Base :** `design/celebrations-mission-04-architecture-20261107`  
**Version publique de référence :** `fix/celebrations-inline-validation-20261105` @ `7cbfdbd79e2b40f8f4ca4b46dbc97d47e26b742d`  
**Contrôle automatique complet :** [GitHub Actions #42392475098](https://github.com/ludodulac/Celebrations/actions/runs/42392475098) — **SUCCESS**, **77/77 tests**, navigateur Chromium desktop/mobile.

## 1. Objectif et résultat

L'ancien fichier `editor-demo-preparation-page.mjs` fabriquait le JavaScript de l'administration en appliquant une chaîne de `.replace('fragment ancien', 'fragment modifié')` sur une grande chaîne de code `DEMO_CLIENT`. Certains fragments étaient devenus périmés et leur `.replace` ne modifiait déjà plus rien. Modifier une fonction pouvait donc casser silencieusement une adaptation.

**Résultat de la mission :** la composition de l'administration n'utilise plus de recherche/remplacement textuel de fonctions JavaScript. Le client a maintenant des branches explicites selon le mode réel (`STAGE_SEED` / `IS_STAGE`) et un point de composition nommé pour la synchronisation serveur. Le même client conserve le mode démonstration local.

Concrètement, l'ancien adaptateur contenait **22 appels `.replace`**, dont plusieurs ciblaient du code. Il ne lui reste désormais que **5 remplacements normaux de caractères** dans des utilitaires de nettoyage/échappement de données : accents, entités HTML et littéraux JavaScript sûrs. **Aucune des substitutions restantes ne réécrit le code exécuté**.

## 2. Changements techniques isolés

### `migration/cloudflare/editor-demo-preparation-page.mjs`

- Remplacement de la fabrication à coups de chaînes par `const client=DEMO_CLIENT;`.
- Suppression de la chaîne de substitutions de fonctions JavaScript, y compris l'injection improvisée du contrôleur serveur dans `function mark()`.
- Maintien du HTML réel de l'administration, de la politique CSP noncée, des éléments de navigation et des mêmes routes.

### `migration/cloudflare/editor-demo-client.mjs`

- Démarrage explicite en mode administration de célébration ou démonstration.
- Préservation des noms de clés localStorage et des identifiants existants.
- Initialisation des pages à partir des vraies données de départ lorsqu'il existe une `__PREPARATION_SEED__`.
- Fusion des anciennes pages locales avec les pages initiales, sans écraser les modifications.
- Conservation de la sélection initiale de page, du lien **Voir le site**, du contrôle de visibilité publié/brouillon et de la gestion des pages.
- Maintien de la suppression des pages supplémentaires sous les mêmes conditions de sécurité et de visibilité publique.
- Marquage des modifications en attente côté serveur, bouton **Enregistrer**, `serverSave()`, `serverLoad()`, avertissement en quittant et comportement du titre de célébration.
- Conservation du retour arrière, de la prévisualisation, des blocs et du sélecteur de fichiers.
- Insertion du fragment `SERVER_EDITOR_SYNC` une seule fois par **composition explicite** de chaînes déclarées, sans substitution de fragments arbitraires au moment des requêtes.

**Important pour la stricte parité :** deux anciennes substitutions ne trouvaient déjà plus leur cible dans le code actuel (notamment un menu de suppression d'étape supplémentaire). Nous n'avons pas créé de nouvelles commandes visuelles pour les « réparer » par accident. Elles restent donc absentes, comme sur le site de référence.

### `migration/cloudflare/editor-server-sync-client.mjs`

- Lecture de l'ID de célébration avec accès conditionnel à la graine de l'éditeur, pour que le fragment soit initialisable aussi en mode local sans provoquer d'erreur.
- Les API, les requêtes réseau, les paramètres de sauvegarde, les versions, le comportement 409 et les règles de publication sont **inchangés**.

### Contrôles ajoutés

- `tests/test_mission05_editor_composition.mjs` : composition syntactiquement valide, absence de chirurgie des fonctions, unicité du contrôleur serveur, mode de départ, fusion des pages, Undo, sauvegarde, suppression, médias.
- `.github/workflows/celebrations-mission05-editor-parity.yml` : tests Node et navigateur réel sur **données synthétiques**, sans accès administrateur réel ni déploiement.
- Réutilisation de `scripts/mission02-editor-reference-browser.mjs` (référence de Mission 02) et `scripts/test-editor-media-picker-browser.mjs`.

## 3. Vérifications exécutées, pas seulement préparées

**GitHub Actions #42392475098 : SUCCESS.**

| Contrôle | Résultat |
| --- | --- |
| Syntaxe de tous les fichiers composés | **PASS** |
| Tests unitaires et d'intégration ciblés | **77 réussis, 0 échec** |
| Éditeur sur ordinateur — Célébrations, Mercredi, aperçu, pages générales, médiathèque | **5 vues PASS** |
| Éditeur sur téléphone — mêmes cinq vues | **5 vues PASS** |
| Erreurs JavaScript lors des parcours du faux éditeur | **0** |
| Requêtes envoyées par ces parcours au véritable site de production | **0** |
| Écritures API dans le test d'éditeur | **0** |
| Galerie/choix PDF/vidéo testés dans Chromium à 1280 et 390 pixels | **PASS** |
| Captures de comparaison M02 produites | **10** |
| Mise en ligne sur le site officiel | **NON EFFECTUÉE** |

Ces contrôles montrent que les parcours exercés fonctionnent **sur l'éditeur isolé et sur les contenus fictifs**. Ils ne prouvent pas, à eux seuls, qu'un cas non couvert (sauvegarde d'un vrai brouillon, modification d'une vraie célébration) fonctionnera nécessairement sans défaut.

Les **deux anciennes attentes de staging** identifiées à la Mission 02 restent volontairement en dehors de cette suite ; elles seront reclassées en Mission 16 plutôt que de changer l'application pour faire passer un test périmé.

## 4. Invariants garantis par le code cible et non-régression

- **Aucun nouveau format de données**, champ imposé ni migration de page.
- Mêmes identifiants de pages et de célébrations.
- Mêmes clés de stockage locales.
- Mêmes URL et endpoints HTTP.
- Pas de modification de D1/R2 ; le Worker, les fichiers et les médias de production restent inchangés.
- Même apparence du menu admin, des boutons, pages, éditeurs, sélecteurs et aperçu pour les parcours testés.
- Publication de nouvelles pages uniquement avec son action explicite, jamais avec l'opération de nettoyage.
- La suppression d'une page déjà publiée exige d'abord la désactivation publique côté serveur.
- Les fonctions de l'éditeur peuvent encore partager une portée JavaScript existante pendant cette mission ; leur séparation physique est réservée à la **Mission 06**.

## 5. Limites assumées : pas de fausse impression de refonte totale

**Ce qui est réellement nettoyé :** les remplacements textuels de code dans l'adaptateur du véritable éditeur.

**Ce qui reste à faire en Mission 06 :** découper le programme monolithique `DEMO_CLIENT` et sortir le contrôleur de synchronisation de sa composition en chaîne vers une structure de modules/ports explicites, avec une stratégie de bundling contrôlée par les tests. Un unique point de composition de texte reste utilisé pour respecter l'actuelle CSP et éviter une migration générale simultanée. Il ne s'agit plus d'une substitution opportuniste dépendant du nom d'une fonction.

**Ce qui n'est pas encore certifié en production :** restauration exacte de la dernière version Worker, copie indépendante complète des données, restauration isolée actuelle de D1 et sauvegarde complète des octets de médias (réserves R1–R5 de la Mission 03).

Ces réserves justifient de **ne pas publier** cette modification structurelle avant que les protections nécessaires soient prouvées.

## 6. Statut final et suite

**MISSION 05 : TERMINÉE SUR BRANCHE DE TRAVAIL ET TESTÉE.**

- Aucun changement de l'apparence de l'utilisateur volontairement introduit.
- Aucun changement des contenus.
- Pas de fusion ni de déploiement officiel.
- PR conservée **DRAFT**, pour revue et futures sécurisations.
- Les travaux de **Mission 06 — séparation en modules** pourront débuter sur instruction du propriétaire, dans une branche distincte dérivée de ce résultat, sans publication automatique.

**Critère d'autorisation de publication ultérieure :** protections de la Mission 03 vérifiées, comparaison des captures/contrats M02 sur candidat, validation de l'accès et de la sauvegarde sans toucher aux pages réelles, et décision expresse de publication.
