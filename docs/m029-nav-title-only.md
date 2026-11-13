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

## Correction démontrée sur le formulaire

Le relevé de la vraie requête a montré le défaut : le champ était effacé par un nouveau rendu de l'administration entre la saisie et le clic, ce qui transmettait un titre vide avec succès. Le réglage conserve désormais uniquement la saisie non enregistrée en mémoire pendant ces rendus, puis efface cette copie dès confirmation serveur. Cette correction est confinée au formulaire du titre, ne modifie aucun contenu ni le système de sauvegarde général.

## Confirmation des données, puis test du rendu public

La sauvegarde du titre fonctionne désormais sur M016 et sa relecture serveur a été confirmée. Le test du rendu a échoué car l'identifiant privé de démonstration `90000002` ne correspondait pas à une célébration publique, produisant HTTP 404. La vérification utilise désormais une célébration publique réellement présente dans M016 (sans créer ni modifier de données).

## Parcours final smartphone

La barre du menu et le titre sont maintenant validés en navigateur ordinateur sur M016. Le deuxième contexte Chrome pour smartphone était bloqué par la porte de connexion spécifique de M016 (403), sans rapport avec le site officiel. Le test smartphone utilise désormais la même session de test M016 pour vérifier simplement l'absence visuelle du titre en petit écran, sans modifier les droits d'accès.

## Validation M016 terminée — 13 novembre 2026

**[Workflow M016 #43393550562](https://github.com/ludodulac/Celebrations/actions/runs/43393550562) : SUCCESS.** Authentification de test, sauvegarde puis relecture du titre, titre à droite dans le menu existant sur ordinateur, titre masqué sur smartphone, restauration de la préférence initiale et vérification du Worker officiel inchangé. Sauvegardes préproduction effectuées.

## Autorisation de mise en ligne

Le propriétaire a explicitement demandé le déploiement rapide de **cette seule fonctionnalité** sur le site officiel. La publication contrôlée M029 exige la version exacte officielle M028, les sauvegardes D1/R2 chiffrées, zéro migration, les tests de non-régression, la confirmation de la sécurité des membres/pages, la publication sur le Worker existant uniquement et le retour arrière si un contrôle échoue.
