# CÉLÉBRATIONS — mission 033 : administration Cloudflare modifiable, sans casser les anciens liens PDF

## Prérequis déjà vérifiés

- Nouveau programme de production D1 Europe : 456 lignes, 1 participant, 11 738 anciennes consultations, 9 lettres.
- R2 privée de production : 113 objets publics (112 originaux, plus le PDF retrouvé), 9 PDF comité.
- Les 9 liens courts `/?lettre=<slug>` et 4 redirections Drive fonctionnent sur le nouveau Worker de prévisualisation en lecture seule, **sans changer d'URL sur une même origine**.
- L'ancien Worker `celebrations.rondes.workers.dev` et la fonction Supabase de distribution directe fonctionnent encore pour les 9 invitations : **ne pas les arrêter**.

## Blocage résolu côté code, mais secret propriétaire requis pour le déploiement

La prévisualisation précédente n'accepte **aucune connexion** par conception (tous les POST sont refusés). L'administration réelle ne doit pas être activée sur ce Worker sécurisé en consultation.

Nouveau Worker QA distinct `celebrations-exit-editable-qa.rondes.workers.dev`, déployable seulement par le job `editable-admin-production-qa-once`, sans domaine personnalisé, sans aucune modification DNS :

1. Utilise la même app et les mêmes données **D1 et R2 Cloudflare déjà migrées**, mais dans une adresse d'essai distincte, avec `noindex`, `robots.txt` refusant l'indexation, et toutes les API de l'application.
2. Exige qu'un **mot de passe administrateur fort (14 caractères minimum)** soit enregistré par le propriétaire dans un **secret GitHub de l'environnement** `celebrations-staging` : nom **`CELEBRATIONS_ADMIN_PASSWORD`**. **Il ne doit jamais être envoyé dans ChatGPT.** Un mot de passe ancien de 14+ caractères peut être réutilisé ; un mot de passe neuf est préférable, mais n'altérera pas celui de l'ancien site.
3. Déduit sur le runner GitHub une paire cryptographique PBKDF2-SHA256 (180000 itérations, sel aléatoire). **Ni le mot de passe, ni le vérificateur, ni le sel ne sont imprimés, copiés dans le dépôt ou exportés** ; un fichier JSON privé temporaire `0600` est chargé directement dans `wrangler deploy --secrets-file`, puis supprimé même en cas d'échec.
4. Après déploiement du seul Worker QA, le test effectue une véritable connexion admin par le même protocole que le navigateur, vérifie la consultation des statistiques migrées et les **9 anciens liens PDF sous leur route `?lettre=`** sur cette origine. **La seule écriture D1 voulue est la session administrateur synthétique à usage d'essai, immédiatement révoquée avec preuve d'une suppression exactement ciblée** ; pas de modification des données métiers, médias, comptes ou statistiques.
5. Le Worker original `celebrations`, le domaine officiel dans Spaceship et les routes Supabase restent intacts. Les anciens destinataires d'e-mails ne remarquent aucun changement.

## Dernière bascule réelle, autorisation et preuve à obtenir

Une fois la connexion testée avec le mot de passe secret choisi par le propriétaire, effectuer une dernière sauvegarde et une synchronisation contrôlée des données ayant changé, vérifier les 30 références historiques de médias déjà absents de la source, et préparer une copie réversible de la configuration de l'ancien Worker `celebrations`. **Seule cette opération pourra remplacer l'ancien Worker tout en conservant littéralement son hostname et ses slugs**, après contrôles complets des pages/admin et validité des anciens mails.

Pour le domaine `www.ronde-des-archanges-universelle.eu`, consulter les DNS MX/TXT, DNSSEC et routes existantes de Spaceship pour préserver le courrier et ne modifier que les entrées web requises. Aucun DNS n'est changé sans preuve de rollback. Pour les éventuels liens déjà envoyés sur le sous-domaine `supabase.co` (que nous ne contrôlons pas), **garder le point d'entrée Supabase historique ou un relais** jusqu'à expiration de l'exigence de compatibilité ; la migration Cloudflare n'autorise pas la suppression du projet Supabase partagé.

**Statut** : code/test préparés, aucune configuration admin encore déployée tant que le secret n'est pas enregistré ; pas de bascule du site officiel ni de l'ancien hostname des PDF.
