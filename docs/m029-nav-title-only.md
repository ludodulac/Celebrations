# M029 — titre discret dans la barre existante du menu

**Périmètre unique** : dans l'administration actuelle, Paramètres → « Titre dans la barre du menu » permet de saisir un titre, de choisir sa position (gauche/centre/droite) et de l'enregistrer. Le titre est affiché sur ordinateur à côté du menu et reste masqué sur smartphone (pas de seconde barre). Exemple de texte libre : « Ronde des Archanges ».

**Invariants** : conserver toutes les pages et célébrations existantes, toutes les langues et versions traduites, les membres et droits privés, les PDF, les MP3 jusqu'à 200 Mo, l'administration simplifiée M028 et les boutons bleus/verts. Aucune migration ni réorganisation de l'éditeur. Aucun changement des données sauf le petit champ `state.navigation` explicitement enregistré par l'administrateur.

**Tests M016 isolés** : déploiement limité au Worker `celebrations-m016-admin-preprod`, sauvegardes chiffrées D1/R2 préalables ; authentification admin M016 ; saisie et sauvegarde d'un titre d'essai ; vérification de lecture serveur, du rendu sur le site visiteur sur ordinateur, de l'absence visuelle du titre sur téléphone ; restauration du titre initial en fin de test ; vérification que le Worker officiel reste inchangé ; rollback Worker M016 si échec.

**Publication** : uniquement après passage des tests isolés, sous garde de version exacte du Worker officiel M028, sauvegardes chiffrées, contrôle des routes et données et rollback automatique. Ne jamais utiliser la branche M027 en bloc pour cette petite fonctionnalité.

## Vérification M016 — reprise ciblée

Le premier passage a confirmé l'affichage du formulaire et la réponse de sauvegarde, mais sa lecture immédiate sur un autre Worker Cloudflare a renvoyé l'ancienne valeur. L'essai a restauré le titre initial et le Worker M016 a été automatiquement rétabli. Le second passage impose maintenant une relecture serveur indépendante (répétée brièvement) avant de considérer la sauvegarde réussie, sans modifier le site officiel.

## Deuxième passage M016

Le titre s'enregistre et se relit correctement via l'API. Le navigateur de préproduction a trouvé HTTP 404 sur la page publique parce que le rendu visiteur historique ne reconnaissait pas explicitement l'hôte M016. Ajout du garde-fou existant `isM016AdminPreprodHost` (hôte exact et deux activations isolées requises), sans ouvrir aucun autre hôte ni modifier la production. Le parcours vérifie maintenant le titre dans la barre existante sur ordinateur et son masquage sur téléphone, puis restaure les préférences M016.

## Troisième test préproduction

Le navigateur avait attendu un texte de confirmation qui peut disparaître lors d'un rendu asynchrone des paramètres. Le critère est désormais le résultat réellement conservé sur le serveur, relu indépendamment ; le diagnostic affiche l'état du formulaire si ce résultat ne correspond pas. Aucun changement de fonction ni de données supplémentaires.

## Instrumentation de la sauvegarde M016

Le serveur a retourné une ancienne valeur malgré le succès affiché. Le test suivant enregistre uniquement le titre de démonstration envoyé par le formulaire et l'accusé de réception de l'API pour identifier une réinitialisation du champ ou un conflit de révision. Aucune donnée de membre, mot de passe ou fichier n'est collecté.
