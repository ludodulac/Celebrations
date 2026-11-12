# Correctif ciblé — enregistrement des traductions entre célébrations

Signalement propriétaire (12 novembre 2026, 19 h 48) : l'administration officielle affiche « Échec — réessayer » et « Traductions ou registre multilingue invalides » sur plusieurs pages.

## Cause identifiée

Le formulaire de l'éditeur transmet le registre et les traductions de **toutes** les célébrations, mais le serveur validait uniquement les traductions de la célébration sélectionnée et des pages générales. Lorsqu'une autre célébration possédait une traduction, l'ensemble de la sauvegarde échouait avec HTTP 400. Les données restaient heureusement conservées localement dans le navigateur.

## Changement réduit

- `migration/cloudflare/editor-server-draft-api.mjs` : vérifier aussi les traductions des pages des autres célébrations *déjà enregistrées dans l'état authentifié R2*. Conserver l'interdiction d'inventer des pages et les frontières des espaces privés D1.
- `tests/test-editor-publication-media.mjs` : tester sauvegarde Michaël avec traduction existante Gabriel et refus d'une traduction de fausse page.
- `tests/test-editor-demo.mjs` : ajustement d'assertions anciennes, sans changer l'interface.
- Aucune migration, aucune modification du contenu R2/D1 existant, aucun changement d'URL, d'accès des membres ou de média.
- Fonctionnalités M025/M026 MP3 de 200 Mo conservées.

## Conditions strictes du déploiement

Le workflow `celebrations-m026-official-release.yml` :
1. Refuse le déploiement si le Worker officiel n'est plus exactement sur la version M026 vérifiée `db7fe5b5-8298-48b3-8838-090dac098119` (protection contre le retour arrière de fonctionnalités plus récentes).
2. Vérifie la compilation et les tests MP3, publication et traduction.
3. Contrôle les liaisons Cloudflare et les droits, sauvegarde et chiffre D1 + R2 avant toute modification.
4. Déploie la nouvelle version seulement si tous les contrôles précédents réussissent, vérifie les URLs historiques et revient à l'ancienne version en cas d'échec.
5. Inscrit l'issue du déploiement dans la PR #162.

Ne pas vider les données du navigateur tant que la sauvegarde de l'utilisateur n'a pas été confirmée par un message vert.
