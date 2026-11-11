# M021-A — Utilisation sur la préproduction M016 isolée

Adresse : https://celebrations-m016-admin-preprod.rondes.workers.dev/admin

1. Saisissez le **code PIN administrateur habituel de M016**. Il ne change pas.
2. Ouvrez **Membres**. Dans « Comptes fictifs · préproduction », saisissez un prénom et un nom inventés, choisissez une catégorie et une ou plusieurs célébrations, puis **Créer ce compte fictif**.
3. Copiez l'adresse générée, de forme `m021-<identifiant>@test.invalid`. Aucun courriel n'est envoyé à cette adresse.
4. Ouvrez **Voir le site**, puis **Connexion membre**. Utilisez cette adresse et le mot de passe **poule**. Les droits sont ceux enregistrés dans l'annuaire réel **de test**.
5. Déconnectez-vous de cette identité avant de tester le compte suivant. Pour effacer un essai, cliquez **Supprimer** dans le même panneau « Comptes fictifs ». L'opération supprime l'identité, ses droits et ses sessions sur la seule base M016.
6. Ouvrez **Paramètres > Identité du site** pour définir le titre principal, choisir une image dans la médiathèque existante, ajuster son cadrage, ajouter un texte alternatif et visualiser le résultat. Enregistrer conserve le réglage dans le stockage **M016**.
7. Les autres langues sont facultatives ; si aucun titre localisé n'est fourni, le titre principal est conservé sans traduction automatique.

## Barrières de sécurité

- La préproduction M016 nécessite le **PIN existant** avant de servir les pages du site et les API. La connexion individuelle par compte membre reste distincte du PIN administrateur.
- Les comptes `@test.invalid` ne sont autorisés que sur l'hôte HTTPS M016, avec les opt-ins M021 explicitement activés et les bindings D1/R2 déjà isolés.
- `poule` n'est PAS un mot de passe universel. Il s'agit d'un mot de passe **haché individuellement** pour chaque compte fictif. Les comptes de production ne l'acceptent pas automatiquement.
- Aucune migration M021 n'est appliquée à la base officielle. La migration marqueur s'exécute uniquement dans la base D1 M016 après sauvegarde chiffrée.
- La mise à jour de la préproduction, les contrôles et les éventuelles captures se trouvent dans les exécutions GitHub Actions de M021-A. La version de production est comparée avant et après ; aucun déploiement de production n'est prévu.
