# M014 — état de livraison et contrôle final (branche isolée)

## Périmètre de cette modification
- Le service de liste des pages privées renvoie le nom canonique de l'espace uniquement après autorisation d'une page publiée de cet espace. Le client peut regrouper les pages par espace sans charger un répertoire de titres interdits.
- Le rendu de blocs privés réutilise la liste interne des IDs non publics pour supprimer les liens éditoriaux qui désignent une page ou un espace géré. Cette mesure est conservatrice : les liens directs entre espaces restent indisponibles même pour les membres autorisés; aucune prétention de sécuriser du texte libre rédigé par un administrateur.
- Les médias et traductions privés restent désactivés dans les routes isolées M013; aucune nouvelle route, migration, dépendance ni écriture distante.
- Le raccordement du véritable éditeur de blocs, la navigation publique des espaces et l'interface membre ne sont **pas terminés**. Les deux environnements de démo restent distincts. Ne pas présenter les espaces comme livrés.

## Démonstration
Reprendre [la procédure M013](celebrations-m013-demonstration.md) sur la branche M014, Node 22.
```sh
npm install --no-save --no-package-lock miniflare@4 esbuild@0.25 playwright@1.58.2
npx playwright install chromium
node scripts/test-m013-public-worker-editor.mjs --demo
# Dans un environnement indépendant :
node scripts/test-m012d-real-worker-editor.mjs --demo
```
Le navigateur jetable est intercepté, les données D1/R2 sont locales, aucun compte réel.
La première démo montre le parcours public; la seconde, le panneau membres/espaces et les API.
Pour une recette non interactive, enlever --demo. Le workflow M014 reprend les deux suites et les trois recettes Chromium M013; le résultat doit être constaté sur le SHA exact, pas déduit du code.

## Propreté : constats limités mais vérifiables
- production-worker.mjs importe directement editor-demo-preparation-page.mjs et editor-trial-site-page.mjs. Ce sont des entrées réelles, pas du code mort à supprimer au seul motif de leur nom. Le stockage historique editor-trials et les alias historiques restent nécessaires.
- real-editor-member-spaces-inline.mjs est généré par scripts/build-m012b-member-spaces-inline.mjs; ne pas le modifier à la main.
- Le routeur M011-A est effectivement importé dans le Worker. Les commentaires de deux modules M011-B qui affirmaient le contraire sont corrigés. L'opt-in des routes reste inchangé.
- Les workflows de publication historiques et de staging ne sont pas supprimés : leur caractère obsolète n'a pas été prouvé globalement. Les contrôles locaux et les recettes de récupération doivent rester reproductibles. Aucun audit exhaustif des dépendances/fonctions mortes ne peut être déclaré sur cette seule lecture.

## Mise en service : trois autorisations séparées
1. Public : obtenir les résultats verts sur le SHA, lire le journal réel Workers Builds, comparer les routes/aliases et bindings avec le Worker effectivement en production, sauvegarder l'intégralité de D1, R2 (snapshot et uploads), exporter l'inventaire et les sommes de contrôle, conserver la version Worker précédente et la configuration. Restaurer en local et tester les liens historiques avant toute promotion. Après accord explicite, promotion du SHA validé, vérification lecture seule des parcours et liens, puis test d'écriture autorisé et réversible. Ne pas restaurer aveuglément le snapshot si des écritures sont intervenues depuis la sauvegarde.
2. Administration : vérifier les migrations additives 007a, 008b, 009b, 010b, 012a, 012c sur une copie locale des données; exporter le schéma, valider les secrets ADMIN_PASSWORD_HASH, ADMIN_PASSWORD_SALT, EDITOR_D1_CHALLENGE_SECRET et les bindings DB, MEDIA_ACL, MEDIA_BUCKET, EDITOR_BUCKET, ASSETS (run_worker_first). Les routes nouvelles sont actuellement bloquées sur l'hôte officiel. Ne pas les forcer avec des flags : revue spécifique de leur frontière, authentification, autorisation et parcours de connexion indispensable. Migrations distantes uniquement après accord distinct.
3. Privé : terminer l'éditeur et les parcours de navigation, vérifier les permissions par page et révocation avec identités explicitement liées, D1 et R2 réels mais isolés, confirmer absence de titres/URLs sur la projection publique, vérifier cache et erreurs. PRIVATE_MEMBER_BUCKET distinct, sans accès public; aucune activation avant recette des uploads, autorisations, stockage, publication, révocation. Traductions privées à tester séparément. Ne jamais réutiliser un lien public comme média confidentiel.

Retour arrière : arrêter les écritures concernées, désactiver les nouvelles routes si elles ont été activées, revenir à la version Worker et bindings validés précédents; conserver les données nouvelles; restaurer uniquement après analyse des différences et autorisation. Pour transfert Cloudflare, recréer les bindings et secrets dans le compte du collègue, copier D1/R2 avec vérification d'intégrité, refaire les recettes isolées, organiser une fenêtre sans écritures pour le delta final puis basculer le domaine après accord. Conserver les URLs historiques.

Blocages : raccordements visiteurs/éditeur incomplets, résultat Workers Builds non expliqué sans journaux Cloudflare, recette M014 à confirmer. Aucun déploiement effectué ni autorisé par ce document.
