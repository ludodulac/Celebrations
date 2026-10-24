# 🌸 CÉLÉBRATIONS — mission 12C : Worker de production **isolé** avant bascule officielle

**Autorisation du propriétaire du 24 octobre 2026 :** « Ok continue », dans le contexte précis de **préparer et tester le Worker de production sur un hostname indépendant sans modifier le site officiel**. Cette autorisation **N'INCLUT PAS** le transfert DNS, le changement de DNSSEC, le raccordement d'un domaine personnalisé, la suppression de Supabase ou l'envoi d'e-mails.

## État avant opération

- Le propriétaire a confirmé que le Worker `celebrations-exit-preview-ro` affiche correctement le site.
- Le Worker `celebrations-exit-production` n'apparaît pas encore dans Workers & Pages.
- Les données et les médias cible sont déjà présents dans D1 `celebrations-exit-production` (EU) et R2 `celebrations-exit-production`; l'ancien site GitHub Pages reste sur le domaine officiel. Le Worker historique `celebrations` assure les neuf liens PDF envoyés.
- L'échange DNSSEC / Brevo / Outlook / Gmail est toujours bloquant pour la bascule : NS autoritaires Spaceship, DS parent présent, prestataire/adresses réels de messagerie non entièrement élucidés.

## Déploiement isolé strict

Le workflow `.github/workflows/celebrations-isolated-production-worker-once.yml`, déclenché par **[ISOLATED_PROD_WORKER_ONCE]** uniquement sur la branche migration, vérifie les identités des ressources et le budget Free, exécute les tests locaux, puis refuse d'écraser un script Cloudflare `celebrations-exit-production` préexistant. La configuration est générée depuis `scripts/prepare_production_wrangler.py` et lie **uniquement** la D1/R2 production isolées : aucune route DNS/custom domain. Le déploiement `workers.dev` est volontairement public en **lecture seule** jusqu'à la bascule : méthodes autres que GET/HEAD refusées (405), en-têtes `noindex` et `robots.txt` sur ce seul hostname. Le vrai domaine gardera la logique de production modifiable lorsqu'il aura reçu une autorisation de bascule distincte.

L'administrateur est configuré à partir d'un secret GitHub d'environnement existant, **par dérivation cryptographique éphémère** ; aucun mot de passe brut ou vérificateur n'est archivé dans les journaux. Les tests HTTPS post-déploiement lisent le site, 10 routes du programme, 3 tables publiques, l'image d'accueil et une invitation invalide ; ils contrôlent que NS Spaceship et ancienne page officielle sont toujours intacts et qu'aucune écriture de données n'a été nécessaire.

## Exécution et preuve

Le présent commit est la demande opt-in de déploiement de la mission 12C. Lire **le vrai statut du run GitHub Actions**, ne pas présenter le Worker comme créé tant que le job n'a pas réussi. Tout échec reste limité à ce nouveau Worker, sans retrait ou remplacement des Workers historiques.

## Barrières intactes

- GitHub `main` et site actuel : **NE PAS CHANGER**.
- NS, DNSSEC, DS, e-mails, Brevo, Outlook, Gmail : **NE PAS CHANGER**.
- Supabase partagé (et liens directs historiques), neuf PDF et Worker historique : **NE PAS CHANGER**.
- Pas de dernière synchronisation définitive des statistiques, pas d'activation Custom Domain, pas de suppression ni d'abonnement payant.

## RÉSULTAT EFFECTIF — 24 octobre 2026

**GitHub Actions [#40086047240](https://github.com/ludodulac/Celebrations/actions/runs/40086047240) : SUCCESS.** La nouvelle application a été **réellement déployée** uniquement à l'adresse isolée :

`https://celebrations-exit-production.rondes.workers.dev`

Preuves spécifiques dans le journal :
- Pré-contrôle : script Cloudflare cible non existant ; **aucun autre Worker écrasé**.
- Wrangler : **91 fichiers statiques chargés**, Worker `celebrations-exit-production` créé avec les secrets d'admin dérivés temporairement ; aucune modification du site officiel ni du Worker historique.
- Contrôle HTTPS : **10 pages du programme HTTP 200** ; 3 tables publiques correctement lues ; photo d'accueil HTTP 200 ; une invitation invalide répond 404 ; prévisualisation non indexable ; aucune mutation D1/R2 nécessaire.
- Déclaration réelle de DNS au contrôle : `launch1.spaceship.net`, `launch2.spaceship.net` ; **l'ancien site officiel est resté accessible**.
- Quotas du 24 octobre contrôlés avant et après : 1 304 lignes D1 lues, **zéro ligne écrite**, aucun dépassement Free.

**Restriction volontaire :** ce hostname `workers.dev` refuse toute requête POST/PUT/DELETE (HTTP 405), afin de bloquer les inscriptions, statistiques et changements administratifs avant le lancement. Le futur vrai domaine n'est pas soumis à cette restriction une fois sa bascule autorisée, mais **l'administration de la nouvelle production officielle ne doit pas être activée avant préparation et validation du domaine**. L'interface admin complète peut toujours être testée sur l'ancien Worker dédié `celebrations-exit-editable-qa` (secret requis).

Le navigateur du propriétaire avait déjà confirmé que `celebrations-exit-preview-ro` s'affiche correctement ; la nouvelle URL de production a en plus passé ces tests HTTP automatisés. Ce résultat ne remplace PAS la vérification humaine de toutes les pages ni l'autorisation de mission 13.

**Bilan mission 12C : nouveau Worker de production indépendant créé et testé ; raccordement du domaine, DNSSEC et e-mails inchangés.**
