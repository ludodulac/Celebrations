# M023 — Restitution des commandes des pages historiques (correctif M022)

## Problème signalé depuis le site officiel

Le propriétaire a montré une capture où les pages Préparation, Mercredi, Jeudi, etc. avaient perdu leurs boutons « ⋯ ». Ce retrait provenait de la correction M022 qui supprimait les menus vides. La navigation semblait non cliquable, particulièrement sur la photo où les intitulés inactifs sont gris.

## Correction intégrée à l'administration unique

- Toutes les pages d'une célébration gardent leur bouton « ⋯ », **avec un vrai menu** : « Modifier cette page » et visibilité Brouillon/Visible/Masqué. Aucun clic vide.
- Une page **ajoutée par l'administrateur** offre aussi « Supprimer la page », avec confirmation existante et sauvegarde serveur. Les étapes historiques essentielles (Préparation, Mercredi...) ne sont jamais détruites accidentellement : elles peuvent être masquées puis réaffichées.
- Les noms de page gardent leur bouton de navigation directe; CSS accentue le contraste du texte, le pointeur et le focus clavier, et rétablit le niveau de superposition nécessaire aux menus sur ordinateur et smartphone.
- Aucun nouveau composant d'administration ni migration. Aucun droit privé, membre, média, titre historique, page enregistrée ni secret officiel modifié.

Contrôles : tests de domaine M022/M023, génération déterministe des modules, préproduction M016 avec PIN isolé puis déploiement officiel après sauvegardes chiffrées D1/R2, vérification des accès privés et possibilité de restaurer le Worker précédent. La préproduction M016 n'a pas toutes les pages historiques du site réel ; ne pas présenter son test comme un parcours réel sur Préparation.

## Preuve complémentaire

Un test Chromium lecture seule crée quatre pages représentatives **uniquement dans la réponse réseau du navigateur de test** (M016), en mode mobile et ordinateur, puis vérifie les intitulés cliquables, les boutons ⋯, la présence de Modifier / Visibilité et Supprimer seulement pour les pages ajoutées. Il refuse toute écriture serveur.
