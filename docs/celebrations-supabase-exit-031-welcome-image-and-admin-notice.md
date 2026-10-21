# CÉLÉBRATIONS — correctif 031 : illustration d'accueil et explication du mot de passe

## Diagnostic

Le build de prévisualisation réutilisait la substitution faite pour le staging : `index.html` référençait `/media/media/celebrations-staging-welcome-autumn-2026.jpg`. Cette illustration spéciale a été enregistrée **uniquement dans R2 staging**, pas dans R2 production : le navigateur de la prévisualisation ne pouvait pas l'afficher.

Le fichier JPEG original utilisé par le site public est `media/1791723108110/file-1791723109615-1000040461.jpg`. Il est présent dans Supabase original (taille 167 220 octets), et son chemin a été explicitement inclus dans la sélection de 121 médias publics transposés dans R2 production. Le pipeline corrigé restaure le chemin original dans le HTML généré pour Cloudflare. Aucun téléchargement de média, nouvel ACL, nouvelle dépense R2 ni copie Supabase ne sont nécessaires.

### Preuves requises

- Contrôle hors ligne de l'URL originale dans `production-public/index.html` et rejet de la clé R2 staging.
- Vérification HTTP HEAD 200, `image/jpeg`, `Content-Length: 167220` depuis le Worker de prévisualisation avant de déclarer la correction réussie.
- Validation Chromium mobile de `img.welcome-autumn.complete` et `naturalWidth > 0` ; aucun appel réseau à Supabase ni écriture.

## Administration

Le Worker de prévisualisation `celebrations-exit-preview-ro` est **par conception GET/HEAD uniquement**. Toutes les demandes POST, dont `/api/auth`, renvoient 405. Par conséquent **aucun mot de passe administrateur, même correct, ne peut fonctionner sur cette adresse**, car aucune tentative réelle de connexion n'est acceptée. Ce n'est pas un échec de vérification du mot de passe de l'utilisateur. Le Worker final modifiable devra être préparé et testé sur un environnement séparé avec son secret d'authentification sûr. Aucune tentative de connexion ni changement de mot de passe ne doit être demandé dans le Worker read-only.

## Sécurité et limites

Le site officiel n'a subi aucune modification, tout comme le domaine, le code GitHub main, les R2 et Supabase source. Le mot de passe existant n'est jamais demandé, enregistré, lu ni modifié dans ce correctif. Le Worker read-only reste inchangé. Ne pas déclarer la correction visuelle complète sans réussite de l'audit HTTP et mobile sur la nouvelle version déployée.

## Résultat exécuté et vérifié (21 octobre 2026)

GitHub Actions [#39678278163](https://github.com/ludodulac/Celebrations/actions/runs/39678278163) : **SUCCESS**. Le nouveau Worker de prévisualisation est déployé. La vraie image d'accueil a renvoyé HEAD **200**, type `image/jpeg`, et sa taille source de **167220 octets** a été vérifiée. Chromium sur écran mobile confirme `homepage_image_loaded=true` (image décodée et visible, dimensions non nulles), zéro erreur JS, zéro requête à Supabase, 113 fichiers publics et neuf PDF comité accessibles. Le site officiel et les DNS restent inchangés.

**Administration** : état volontairement toujours **READ_ONLY** : aucune connexion ni mot de passe ne peut y fonctionner (`POST /api/auth` bloqué). Ne jamais interpréter ce 405 comme un mot de passe erroné. La prochaine étape distincte consiste à configurer un Worker d'administration avec secrets propres et tests en environnement réversible, **sans utiliser la production publique tant que non validée**.
