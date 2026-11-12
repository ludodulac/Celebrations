# M028 — Vérification réelle, isolée, sans changement officiel

Mission : déplacer l'accès aux outils multilingues dans **Paramètres** sans modifier les traductions, les autorisations, le fonctionnement des sauvegardes ni le site visiteur.

## Étapes attendues

- Déploiement limité au Worker préproduction `celebrations-m016-admin-preprod`, avec vérification de ses liaisons isolées.
- Sauvegarde chiffrée et conservée des données D1 et de l'instantané R2 avant tout déploiement M016.
- Confirmation de la version officielle avant **et après** les vérifications : aucun déploiement du Worker officiel.
- Navigateur mobile Chromium : mode simplifié, aucun onglet « Langues », aucun sélecteur dans l'édition française, gestion disponible sous Paramètres, case réversible.
- Vérification locale : aucune écriture de contenu lors du changement de visibilité des outils de langues, traductions inchangées.
- Mode complet : Membres et Catégories présents, aucune gestion de langues dupliquée dans le menu.
- Navigateur ordinateur indépendant : panneau replié par défaut et édition française inchangée.
- Restauration du mode d'administration initial sur M016, y compris en cas d'échec.
- Captures d'écran fournies par le workflow ; rollback de la version Worker M016 en cas d'échec des tests.

**Ne pas déployer sur le domaine officiel à cette étape.** Le collègue peut continuer à utiliser le site en production.

## Traçabilité

PR #164. Test automatisé dédié : `scripts/test-m028-m016-languages.mjs`. Workflow à autorisation exacte : `celebrations-m028-m016-preview.yml`.

## Première vérification M016 (11/12/2026)

Le premier test a déployé l'interface sur la préproduction isolée et sauvegardé D1/R2, mais s'est interrompu sur une assertion trop stricte du script : M016 ne contient pas toujours de pages ordinaires éditables (cas connu des missions précédentes). Le Worker M016 a été **restauré automatiquement** à sa version précédente, le site officiel a été vérifié inchangé.

Le second parcours vérifie bien le vrai menu, les Paramètres et les deux modes en navigateur mobile et ordinateur, indépendamment de la présence de pages éditables. L'affichage du sélecteur de langue dans les pages reste couvert par les tests unitaires lorsque M016 est vide. Aucun contenu n'est créé artificiellement dans R2/D1 pour satisfaire le test.
