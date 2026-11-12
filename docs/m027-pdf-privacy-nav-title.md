# M027 — Une simple case « Privé » sous chaque PDF et un titre dans la barre existante

Le propriétaire demande que les PDF de la médiathèque soient **publics par défaut**, y compris lorsqu'ils sont utilisés sur une page brouillon. Sous chaque PDF appartenant au site figure une **case « Privé »**, décochée par défaut. Si elle est cochée, l'URL du fichier devient inaccessible aux visiteurs anonymes, y compris si elle a déjà été envoyée par e-mail. Si elle est décochée, l'accès public revient, sous réserve des autorisations historiques D1 existantes.

**Frontière de sécurité :** les PDF hébergés par un site tiers, les fichiers exclusivement locaux (IndexedDB) et les documents de l'espace privé des membres ne peuvent pas être rendus privés ou publics par cette case : ils ne relèvent pas de la médiathèque R2 publique existante. Un PDF historique soumis à une ACL D1 restrictive ne devient pas soudain public par contournement ; le système ne modifie aucune audience ni les anciennes URLs. Les fichiers publiés et utilisés dans les e-mails continuent de porter leur adresse actuelle.

La préférence des PDF est persistée par une seule règle `pdfPrivacy[src] === true` sur le snapshot R2 éditeur : **absence de valeur = public**. Elle n'interfère pas avec la visibilité d'une page. Le téléchargement des PDF nouveaux et historiques vérifie cette règle ; l'administration peut toujours consulter les PDF privés lorsque son accès existant le permet. La projection des pages publiques filtre les PDF cochés « Privé ».

Le **titre de navigation** se saisit dans « Paramètres → Titre dans la barre du menu », avec « À gauche / Au centre / À droite ». Il apparaît **à l'intérieur de la barre de menu déjà présente, sur ordinateur seulement**, sur toutes les pages, sans créer de nouvel entête ni changer le titre de la page d'accueil. Le titre est stocké via la même API authentifiée de préférences que le mode administration ; l'ancienne section « Identité du site » ne revient pas.

## Contrôles

- Le modèle métier pur teste les valeurs invalides, la confidentialité effective et son annulation.
- Les commandes serveur vérifient le PIN, l'origine et le numéro de révision, refusent les URLs externes/arbitraires, et s'appuient sur les enregistrements R2 éditeur/D1 historiques.
- Un parcours de l'environnement M016 vérifie les cases PDF, la lecture anonyme avant/après et le titre sur mobile/ordinateur.
- Aucune migration, aucun nouveau bucket, aucune seconde administration ; le déploiement officiel, si approuvé, reprend exactement les sauvegardes chiffrées D1 et R2 et le rollback Worker préexistants.

## Préproduction M016 — parcours réel

Le navigateur de préproduction définit provisoirement « Ronde des Archanges Universelle » à droite dans la barre existante ; contrôle sa présence sur deux pages de bureau et son absence sur mobile ; importe un minuscule PDF provisoire, vérifie que son URL est ouverte sans connexion, coche « Privé » et attend un HTTP 404 anonyme, puis décoche et attend HTTP 200 sur **la même URL**. Nettoie ensuite le PDF de test et restaure le titre et l'alignement précédents dans M016. Aucun contenu du site officiel n'est modifié.

## Compilation et tests

La génération déterministe des modules de l'éditeur est terminée ; les tests M027 et les régressions M026/M025/M024 ont réussi dans l'action GitHub #43222104477. Le premier job M016 de ce commit a couru avant le commit automatique du bundle : sa vérification `--check` a détecté un bundle ancien. Relancer le contrôle complet M016 **sur le code généré**, sans modifier le site officiel.

## Compatibilité des anciens liens PDF

Les tests existants des URL /media et /letter incluent désormais le binding R2 de l'éditeur que possède la production. Un PDF historique vérifie aussi la case « Privé » avant de servir les octets ; en cas de panne ou d'absence du stockage de confidentialité, le téléchargement échoue sans rendre un PDF privé public. Les liens publics restent inchangés.

## Compilation finale

La reconstruction canonique et les tests de régression étendus (PDF anciens, liens email, frontières privées, media R2 et navigation) ont réussi dans l'action 43222612641. Vérifier maintenant les changements sur le vrai navigateur M016 isolé avec restauration des données de test.

## Test d'intégration préproduction — second passage

Le premier test M016 a observé le formulaire de titre, mais a attendu un message d'état transitoire qui disparaît parfois lors d'un nouveau rendu de l'éditeur. Le test vérifie maintenant la préférence réellement persistée sur l'API serveur, puis l'affichage sur deux pages avant de tester le PDF. Le réglage initial a bien été restauré après le premier essai.

## Diagnostic ergonomique

Le deuxième essai M016 confirme que le titre du menu n'a pas été persisté par le clic simulé, sans erreur serveur imprimée par le test. Avant mise en service, enregistrer les requêtes du navigateur et corriger l'interface au bon endroit ; les données de test ont été restaurées.

## Correction d'une course de chargement côté formulaire

Le diagnostic M016 a montré un POST HTTP 200 enregistrant les valeurs vides de l'ancien état. Le champ avait été rempli avant que son GET initial, asynchrone, ne revienne ; cette réponse tardive écrasait la saisie. Le formulaire est maintenant non interactif jusqu'à l'hydratation complète des valeurs, puis activé normalement. Cette correction de cycle de vie remplace tout délai artificiel de test.

## Reconstruction M027 — nouvelle version

Le modèle de formulaire corrigé est maintenant reconstruit et testé par workflow M027 #43224185257 (succès). Le job M016 du même push a été lancé avant la reconstruction et a trouvé le bundle non à jour. Relancer la préproduction sur le commit généré.

## Prévisualisation sur M016

Après validation du POST de titre, le parcours a révélé que le moteur public refusait jusqu'ici le nom d'hôte M016, même lorsque les deux options de préproduction étaient validées. La même route publique fonctionne sur le domaine officiel. Le contrôle d'hôte réutilise désormais **la fonction de sécurité M016 exacte** déjà présente, pour autoriser la lecture du rendu public en préproduction et éviter toute exception générale. Aucun accès aux espaces privés n'est ajouté.

## Correctif sauvegarde multilingue — 12 novembre 2026

Le bouton rouge « Échec — réessayer » observé sur plusieurs pages du site officiel est accompagné de « Traductions ou registre multilingue invalides ». Une anomalie du contrôle côté serveur a été identifiée : une sauvegarde de célébration contenait le **catalogue global** des traductions mais la validation ne connaissait que les pages de la célébration courante et les pages générales. Les traductions d'autres célébrations déjà enregistrées pouvaient donc être refusées, bloquant tout enregistrement alors que le contenu restait conservé sur l'appareil.

Correctif ciblé : la validation prend aussi en compte les pages ordinaires des autres célébrations **déjà présentes dans le snapshot authentifié R2**, tout en excluant les pages privées gérées séparément et en refusant les identifiants inventés. Aucun fichier ni traduction existante n'est effacé. Les contrôles de révision, d'autorisation et de publication sont conservés. Tests de régression ajoutés : sauvegarde Michaël avec traduction Gabriel, et refus d'une traduction attachée à une fausse page.

L'anomalie du code explique une cause probable, mais la reproduction à partir des données privées exactes de l'utilisateur n'est pas possible sans une session authentifiée ; vérifier le statut de la sauvegarde réelle après déploiement. Ne jamais vider le stockage du navigateur tant que des modifications locales sont à récupérer.

Contrôle M016 demandé : déclencher la vérification de préproduction isolée du comportement du menu, de la confidentialité PDF, du guide et de l'enregistrement multilingue. Garder le site officiel inchangé jusqu'au feu vert de ce test.
