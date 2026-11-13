# M029 — titre discret dans la barre existante du menu

**Périmètre unique** : dans l'administration actuelle, Paramètres → « Titre dans la barre du menu » permet de saisir un titre, de choisir sa position (gauche/centre/droite) et de l'enregistrer. Le titre est affiché sur ordinateur à côté du menu et reste masqué sur smartphone (pas de seconde barre). Exemple de texte libre : « Ronde des Archanges ».

**Invariants** : conserver toutes les pages et célébrations existantes, toutes les langues et versions traduites, les membres et droits privés, les PDF, les MP3 jusqu'à 200 Mo, l'administration simplifiée M028 et les boutons bleus/verts. Aucune migration ni réorganisation de l'éditeur. Aucun changement des données sauf le petit champ `state.navigation` explicitement enregistré par l'administrateur.

**Tests M016 isolés** : déploiement limité au Worker `celebrations-m016-admin-preprod`, sauvegardes chiffrées D1/R2 préalables ; authentification admin M016 ; saisie et sauvegarde d'un titre d'essai ; vérification de lecture serveur, du rendu sur le site visiteur sur ordinateur, de l'absence visuelle du titre sur téléphone ; restauration du titre initial en fin de test ; vérification que le Worker officiel reste inchangé ; rollback Worker M016 si échec.

**Publication** : uniquement après passage des tests isolés, sous garde de version exacte du Worker officiel M028, sauvegardes chiffrées, contrôle des routes et données et rollback automatique. Ne jamais utiliser la branche M027 en bloc pour cette petite fonctionnalité.
