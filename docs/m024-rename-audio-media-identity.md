# M024 — Administration simplifiée, médias protégés et code propre

**Autorisation :** le propriétaire a demandé expressément d'effectuer lui-même le travail (« Allez vas-y »), en continuité de la livraison officielle M022/M023.

## Quatre corrections précises

1. **Renommer une page dupliquée/ajoutée :** dans « Réglages de la page », un champ « Nom de la page » renomme la page lorsque son identifiant est celui d'une page personnalisée. C'est le bouton « Enregistrer » existant qui persiste le nouveau nom. Le nom peut être changé sans altérer l'identifiant/URL stable, la visibilité, la langue, le contenu, les droits ou les pages historiques protégées. Les titres principaux générés non retouchés suivent le nouveau nom.
2. **Lecteur MP3 :** le bloc vide contient uniquement « Titre de l'audio » et « Choisir un MP3 » ; le lecteur apparaît quand une source a été choisie. Les phrases de placeholder redondantes sont retirées.
3. **Médiathèque :** images, audios, vidéos, documents. Le bouton « Supprimer si inutilisé » des médias serveur est affiché uniquement si le serveur certifie la non-utilisation. La vérification utilise une seule logique pure `app/domain/editor-media-usage-safety.mjs` à la fois pour l'affichage et pour une tentative de suppression. Elle parcourt brouillons, pages publiques, anciennes publications, langues, catégories/espaces privés, couvertures, identité visuelle existante et références D1 historiques. Toute information manquante = **suppression impossible**. Les médias historiques ne sont plus faussement étiquetés « Inutilisé ». Les assets locaux protégés incluent les couvertures.
4. **Paramètres :** retirer complètement « Identité du site » de l'interface et environ 5,6 ko de gestion de formulaire devenus inutiles ; conserver les préférences de mode membre, les valeurs de marque déjà sauvegardées, l'affichage public et l'API existante pour ne pas briser les intégrations historiques.

## Architecture et protections

- Modèle métier pur pour renommer ; modèle unique de vérification des références, réutilisé par le bouton et par la suppression serveur.
- Aucune migration destructive, aucun traitement de données personnelles, aucun transfert de comptes tests.
- La modification d'un champ n'autorise pas la suppression physique d'un média, ni le changement de visibilité d'une page.
- Éviter les faux positifs : un média **inconnu** n'est jamais qualifié d'**inutilisé**.
- Les anciennes couches de code hors de ces commandes restent en place lorsqu'elles sont nécessaires au fonctionnement historique ; ne pas prétendre à une réécriture totale du dépôt.

## Contrôles

- Tests de non-régression des commandes M022, pure media reference policy (sources D1, R2, traductions, brouillons, publications, droits privés), scripts de génération canoniques.
- Déployer sur le Worker M016 isolé en sauvegardant D1/R2 M016, puis parcourir les paramètres et la médiathèque sur smartphone et ordinateur, sans créer de données officielles.
- Après succès, sauvegarder D1 et R2 officiels de façon chiffrée et vérifiable et déployer **seulement** le Worker `celebrations-exit-production`, conserver l'ancien PIN et les bindings, comparer données et droits, contrôler directement le domaine officiel, pouvoir restaurer l'ancienne version.

## Vérification UX supplémentaire

Le renommage d'une page ne reconstruit pas le formulaire pendant le changement du champ : ainsi un clic immédiat sur « Enregistrer » n'est pas perdu. Le titre de navigation se met à jour sur place. Le bloc audio vide ne génère plus de conteneur visuel superflu.
