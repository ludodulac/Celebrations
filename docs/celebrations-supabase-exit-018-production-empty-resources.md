# CÉLÉBRATIONS — MISSION 018 : préparation concrète de l'infrastructure Cloudflare définitive

**Objectif** : avancer vers la mise en production sans toucher au domaine Spaceship, au site public Github Pages ni au projet Supabase historique.

## Situation réutilisée

- **DNS Spaceship sécurisé par relevé** : quatre A `@` pointent vers `185.199.108.153`, `.109.153`, `.110.153`, `.111.153` ; le CNAME `www` pointe vers `ludodulac.github.io` ; TTL 30 min. DNSSEC est **activé** et la page « URL Redirect » n'indique **aucune redirection configurée**. Référence dans le rapport 017.
- **Staging** : D1 `celebrations-exit-staging` et bucket R2 privé homonyme ; migration du programme 456 lignes et 158 médias vérifiée ; synchro de 40 clics récents en staging réalisée dans le run #39503309643.
- **Sauvegarde** : copie chiffrée de la base téléchargée par l'utilisateur, restauration en SQLite isolée testée ; aucune copie indépendante définitive des 158 médias confirmée. Supabase reste indispensable.
- **Candidat de production** : code Worker séparé et assets Cloudflare-only prêts **hors ligne**, jamais déployés en production.

## Création conditionnelle, sans risque pour le site public

Script `scripts/provision_separate_production_free_resources.py`, exécuté une seule fois par le job opt-in `provision-empty-production-free-resources`, commit `[PROVISION_FREE_PROD_ONCE]` sur **la seule branche de migration**.

1. Vérifie le quota D1 **de l'ensemble du compte** avant toute mutation. Arrête si usage proche des plafonds journaliers.
2. Liste les bases D1 **complètement** et les buckets R2 via la structure documentée `{result:{buckets:[...]}}` (ancien audit ne reconnaissait pas cette forme), puis vérifie explicitement la présence du staging et la limite **10 bases D1 sur Free**.
3. **Si et seulement si les inventaires sont entièrement visibles et sûrs** et si l'environnement existe déjà, ne crée aucun doublon. Sinon, crée **une base D1 vide `celebrations-exit-production` avec juridiction EU**, puis **un bucket R2 `celebrations-exit-production` vide, Standard, privé (aucun domaine public)**. Aucun objet, aucune donnée personnelle, aucun lien au domaine.
4. Relit les inventaires et valide les identifiants. Journalise les seuls noms et identifiants techniques nécessaires au prochain déploiement, jamais les tokens.
5. Si les permissions Cloudflare existantes ne permettent pas de lire/administrer les buckets, **s'arrête sans élargir les droits ni contourner les restrictions**. Ne pas conclure que la création a réussi.

**Important** : les ressources vides utilisent l'offre Free **seulement dans la limite de l'utilisation réelle du compte**. Aucun abonnement/paywall ni modification DNS ne sera effectué. L'étape suivante nécessitera une copie R2 strictement contrôlée des 158 médias et l'import des données dans la nouvelle D1 ; elle n'est **pas** incluse ici.

Ressources officielles : R2 Standard `10 GB-month` offerts et D1 Free `10 bases`, `5 GB` de stockage par compte ; quotas d'usage partagés avec les autres applications Cloudflare.

**Site actuellement en ligne : inchangé.** `main` SHA `4b5edd9c19ce989af2eae33445017dd30fcbbe92`. Aucun changement Spaceship. Aucun arrêt Supabase.
