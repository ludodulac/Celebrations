# CÉLÉBRATIONS — MISSION E1 — Premier éditeur visuel réel (staging seulement)
**29 octobre 2026 — base D4 `09b49fcd6bf0ebe35b5f7ead8eba568e54803120`.**

## Fonction réellement construite
- La prévisualisation sécurisée affiche maintenant la barre **« Pages | Modifier cette page | Enregistrer »**. Les 45 autres pages restent en lecture seule.
- Deux **pages réellement importées en mission C** ont un éditeur tactile : `home` (accueil général) et `celebration:101:step:Mercredi` (programme historique Michaël, avec ses rendez-vous et l'ordre existant).
- Parcours : toucher « Modifier » puis toucher le titre/paragraphe/description d'un rendez-vous pour changer directement sa copie visible ; toucher « Enregistrer » pour créer une version du brouillon. Sur l'accueil, texte du bandeau, titre, sous-titre, bouton et destination du bouton ; choix optionnel d'une **image déjà référencée et publique dans la bibliothèque staging**. Le changement d'image est implémenté, avec contrôle du droit serveur, mais non testé de bout en bout avec une nouvelle image réelle.
- « Annuler » remet les textes affichés à l'état chargé sans enregistrer, puis permet de rééditer. Rechargement retrouve le dernier brouillon. « Versions » liste les sauvegardes et restaure une ancienne version **en créant une nouvelle révision**. Un avertissement natif apparaît en cas de départ avec des changements non sauvegardés.
- Les blocs historiques complexes hors pilotage (liens, images déjà présentes, rendez-vous non modifiés, fichiers, visibilités) restent visibles/intacts ; aucune édition de JSON, HTML ou donnée technique dans l'interface.

## Architecture et limites contrôlées
- Réutilisation des 5 tables `editor_b_*`/`editor_c_*` sans schéma supplémentaire. Un champ `data.e1` dans le bloc historique **de la nouvelle révision seulement** contient les corrections éditoriales ; le `record` source et les relations restent conservés dans cette révision et dans les précédentes. Le moteur D lit la dernière révision pour afficher le texte du brouillon ; aucune écriture aux tables historiques `celebrations_*`.
- Enregistrement E1 : session admin réelle, deux clés pilotes explicitement autorisées, validation serveur des champs et destinations, verrouillage optimiste sur `head_version` et `409` en cas de modification concurrente. Aucun accès en écriture par le simple secret de contrôle QA ou cookie de lecture seule.
- Les importations ultérieures de changements provenant de l'ancienne administration passent toujours par la détection d'écart de version/source déjà construite en C. **Il n'existe pas encore de fusion automatique des modifications concurrentes entre ancienne et nouvelle administration** : conflit à réconcilier manuellement ultérieurement ; ne pas écraser une édition humaine.
- **Aucune publication :** les 47 brouillons restent non publiés, les neuf PDF comité non listés, les célébrations futures invisibles et le Worker officiel inchangé. Les médias / URL déjà existants sont maintenus. Pas de fusion de PR.

## Preuves GitHub
[Action E1 staging + Chromium #40900766522 — SUCCESS](https://github.com/ludodulac/Celebrations/actions/runs/40900766522).

- **11/11 tests locaux PASS** (B/C/D/D4/E1), incluant source immuable, image existante autorisée, contrôle des éditions, version, conflit 409, restauration, refus anonyme.
- **4/4 parcours complets Chromium réussis :** ordinateur et téléphone × accueil et mercredi. Dans chaque cas : connexion D4 staging, ouverture page pilote, mode édition, changement du texte historique, enregistrement, rechargement et preuve que la modification persiste, annulation d'un changement non enregistré, historique, restauration de l'état initial par nouvelle version. Vraie concurrence obsolète rejetée en 409. Toutes les modifications des tests ont été **restaurées** ; les versions d'audit restent traçables.
- Contrôles avant ET après les écritures en staging : **47/47 pages importées, 327 blocs historiques dans les versions courantes, 0 publication**, ancienne administration HTTP 200, authentification anonyme E1 refusée 401, Worker staging / D1 / R2 approuvés confirmés.
- L'unique stockage supplémentaire créé par les tests concerne de **nouvelles révisions de brouillon des deux pages pilotes** ; aucune suppression et aucune mise à jour des données historiques.
- Le code temporaire personnel D4 de Ludo n'a pas été intégré ni affiché dans le dépôt, les journaux ou le rapport. Le test utilise un nouveau code QA aléatoire masqué et éphémère, indépendant du code de Ludo.

## Accès Ludo, sans installation ni GitHub
1. Dans le navigateur où Ludo est déjà connecté au staging, ouvrir **`https://celebrations-exit-staging.rondes.workers.dev/__editor/edit?key=home`**.
2. Toucher « Modifier cette page », toucher le titre, modifier, puis « Enregistrer ».
3. Dans « Pages », sélectionner **« Programme du mercredi »** pour modifier le titre ou la description d'un rendez-vous.

En cas de session expirée, se connecter sur **`https://celebrations-exit-staging.rondes.workers.dev/__editor/access`** avec son code personnel de test D4, puis utiliser « Voir les 47 pages » avant d'ouvrir le lien E1 dans le même navigateur. Le code D4 actuel expire le 3 novembre 2026 ; aucun renouvellement permanent n'est créé par E1.

## Arrêt
Cette mission ne prépare pas de publication publique. Les 45 autres pages ne sont pas encore éditables, l'édition complète des rendez-vous (horaires, ordre manuel, fichiers/associations) et la sélection média multi-page sont reportées. **E2 NON COMMENCÉE. Validation explicite de Grand-père requise.**
