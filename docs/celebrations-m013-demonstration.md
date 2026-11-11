# M013 — démonstration locale et contrôle de mise en service

## Lancer depuis le dépôt (branche M013)
Node.js 22, Git, connexion réseau nécessaire uniquement pour installer les dépendances.
```sh
npm install --no-save --no-package-lock miniflare@4 esbuild@0.25 playwright@1.58.2
npx playwright install chromium
node scripts/test-m013-public-worker-editor.mjs --demo
```
Linux : ajouter `--with-deps` si nécessaire. Le navigateur possède un profil jetable;
la véritable production est exécutée dans workerd, D1 et R2 en mémoire. L'adresse
officielle visible est **virtuelle** : toutes les requêtes de ce navigateur sont
interceptées, toute autre origine est bloquée, le résolveur DNS est désactivé.
Ne pas ouvrir cette adresse dans un autre navigateur pour la démonstration.
Le cookie administrateur est synthétique, signé avec la clé locale. Il ne teste
pas le formulaire de connexion officiel. Aucun vrai compte ni fichier officiel.
Fermer Chromium supprime les modifications de la démo.

Pour présenter uniquement membres et espaces (API isolées M012-D) :
```sh
node scripts/test-m012d-real-worker-editor.mjs --demo
```
Onglet Membres et espaces, mot de passe synthétique indiqué dans le terminal.
Ce second environnement ne permet PAS le parcours public d'écriture officiel.
Les deux environnements sont indépendants.

## Mise en service contrôlée (pas exécutée)
- Vérifier les deux suites et la recette M013 sur le SHA exact; aucun déploiement
  si un test obligatoire échoue. Vérifier les logs Workers Builds dans Cloudflare.
- Sauvegarder le snapshot R2 `editor-trials/server-drafts-v1.json`, les objets
  `editor-trials/uploads/`, le bucket historique et exporter D1. Vérifier une
  restauration locale, conserver le déploiement précédent et sa configuration.
- Contrôler les bindings réels DB, MEDIA_ACL, MEDIA_BUCKET, EDITOR_BUCKET, ASSETS
  (run_worker_first=true) et les secrets ADMIN_PASSWORD_HASH / ADMIN_PASSWORD_SALT.
  Ne jamais publier les secrets ni rendre les buckets publics.
- Les six migrations additives sous migration/cloudflare/d1-migrations doivent
  être vérifiées dans l'ordre 007a, 008b, 009b, 010b, 012a, 012c avant activation
  des fonctions membres, avec sauvegarde, comparaison du schéma et accord séparé.
  ADMIN_PASSWORD_HASH, ADMIN_PASSWORD_SALT et EDITOR_D1_CHALLENGE_SECRET sont requis
  pour les sessions D1. Les opt-ins MEMBER_DIRECTORY_API_ENABLED,
  MEMBER_DIRECTORY_API_HOST et EDITOR_D1_SESSION_API_ENABLED restent isolés.
  Les hôtes officiels refusent actuellement ces routes : ne pas forcer les flags.
- Une activation des espaces privés nécessite une revue de la route officielle,
  du chargement canonique, des permissions et un PRIVATE_MEMBER_BUCKET distinct
  non public. Les médias et traductions privés ne sont pas activés.
- Après accord explicite seulement : déployer le SHA validé, faire un contrôle
  lecture seule des visiteurs, puis une écriture de test autorisée avec retour
  arrière documenté; préserver les liens historiques et les données.
- La publication historique d'une page déjà publique peut être actualisée lors
  de l'enregistrement : cette sémantique est conservée. Une nouvelle page reste
  brouillon jusqu'à sa publication explicite.

## Périmètre M013
Import TXT et DOCX (téléchargement forcé), formats serveur explicités dans
l'interface; vidéo par lien externe. Les autres documents peuvent être convertis
en PDF; aucun upload vidéo direct. Le parcours public et les droits sont vérifiés
par une nouvelle recette local-only; la réussite doit être lue dans GitHub Actions,
pas déduite de l'existence du script. Les fichiers audio et PDF synthétiques de
recette vérifient le transfert, pas leur décodage multimédia.
Les pages d'espaces restent non raccordées à l'éditeur de blocs, et la lecture
publique/privée des espaces reste désactivée. Ne pas les présenter comme livrées.

## Complément M013 : droits de pages et lecture isolée
Les politiques de chaque page d’espace peuvent être préparées dans le panneau existant, puis enregistrées par le service canonique. Les routes de lecture `GET /api/participant/space-page?pageId=…` et `GET /api/participant/space-pages?celebration=…` réutilisent les contrôles de lecture existants, uniquement sur l’hôte isolé configuré et avec `MEMBER_PAGE_READ_API_ENABLED=true`. Elles restent interdites sur le domaine officiel et les candidats en lecture seule. Le français seul est demandé; aucun endpoint de média privé n’est ouvert. La navigation des visiteurs et l’éditeur de blocs des pages d’espace ne sont pas raccordés par cette modification. Ne pas activer en production avant validation spécifique.
