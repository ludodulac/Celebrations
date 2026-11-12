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
