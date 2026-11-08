# 🌸 CÉLÉBRATIONS — Mission 10 : sauvegardes et publication
**8 novembre 2026 — branche isolée, aucun déploiement.**

## Objectif
Centraliser le contrat de persistance et les opérations conditionnelles R2
entre l'enregistrement des brouillons, les publications et le catalogue, en
conservant exactement les routes, les clés et les règles publiques existantes.

## Implémentation réelle
- `app/ports/editor-snapshot-contract.mjs` : clé
  `editor-trials/server-drafts-v1.json`, limite de taille et comparaison
  stricte des révisions attendues. Il n'accède à aucun R2 ni navigateur.
- `app/adapters/editor-r2-repository.mjs` : lecture du document avec
  validateur métier injecté, **écriture conditionnelle obligatoire sur l'ETag** :
  nouvel objet `etagDoesNotMatch:'*'`, objet existant `etagMatches:<ETag>`.
  L'adaptateur ne réessaie jamais aveuglément en écrasant un objet.
- `editor-server-draft-api.mjs` et `editor-publication-api.mjs` :
  utilisent le **même** adaptateur R2 et la même révision, sans changer les
  validations de leurs requêtes ni les statuts HTTP 400/401/403/409/413/415/503.
  Les écritures médias existantes passant par `writeEditorState` en profitent.
- `app/application/editor-sync-policy.mjs` : règles **pures** de comparaison
  des bases entre appareils, choix de relance après conflit, gestion des
  modifications intervenues pendant une sauvegarde et vérification par relecture
  du contenu sélectionné. Son code est composé une seule fois dans le client
  inline protégé par nonce via `editor-demo-client.mjs` et utilisé réellement
  par `editor-server-sync-client.mjs`.
- La relecture d'une page sélectionnée exige désormais que la page existe
  réellement dans la réponse du serveur (une page introuvable n'est plus
  déclarée « sauvegardée » sur simple HTTP 200). Les messages et boutons
  existants sont conservés.

## Invariants
- **Enregistrer** conserve les nouveaux brouillons privés. Les pages déjà
  publiées sont rafraîchies **uniquement** selon la logique atomique
  préexistante de `refreshAlreadyPublishedPage`, sur le vrai domaine.
- **Publier/Masquer** reste une intention explicite vérifiée par le serveur,
  sans publication par la simple ouverture, par l'aperçu ou par Ctrl+Z.
- Révision erronée ou concurrente : 409 et conservation du travail.
- Échec réseau : aucun « succès » fictif. La sauvegarde locale reste disponible.
- Une écriture 200 n'est confirmée dans l'éditeur qu'après relecture de la page
  enregistrée.
- L'instantané public filtré demeure différent du document privé.

## Ce qui reste hors périmètre
Aucune migration R2, aucun contenu réel modifié, aucun accès à la production.
Le rollback exact du Worker, la restauration complète D1, la récupération
des octets R2/médias et la copie indépendante de Cloudflare (risques M03)
**ne sont toujours pas certifiés** et bloquent toute publication de la refonte.
Les tests CI sur fixtures, même réussis, ne remplacent pas la recette réelle.

## Vérifications
Le workflow M10 lance des tests sur les versions et les ETags (y compris
concurrence à deux appareils et écriture intercalée), sur les réponses HTTP 409
et 503, sur l'indépendance du public et du brouillon, sur la politique de
relecture et sur tous les contrats précédents M05–M09. Il rejoue les
10 captures isolées (5 ordinateur / 5 téléphone) et le sélecteur médias.
**Le verdict final est celui de GitHub Actions, non la présence du workflow.**
