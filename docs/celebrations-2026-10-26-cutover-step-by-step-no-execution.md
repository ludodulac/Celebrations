# 🌸 CÉLÉBRATIONS — procédure de bascule contrôlée du domaine (PRÉPARATION SEULEMENT)

**État vérifié le 26 octobre 2026. AUCUNE MODIFICATION DNS N'EST AUTORISÉE PAR CE DOCUMENT.**

## 1. Périmètre et constat

- **Site à déplacer :** `ronde-des-archanges-universelle.eu` et `www.ronde-des-archanges-universelle.eu`.
- **Domaine des adresses e-mail et de Brevo :** `nation-essenienne.eu` — **hors périmètre, ne jamais modifier ses DNS**. Captures du propriétaire : un domaine Brevo authentifié, un expéditeur validé avec DKIM et DMARC.
- **Délégation actuelle Spaceship :** `launch1.spaceship.net`, `launch2.spaceship.net`.
- **Délégation Cloudflare attribuée :** `luke.ns.cloudflare.com`, `maria.ns.cloudflare.com`. Zone Cloudflare **Free / pending**, vérifiée sur le bon compte.
- **DNS web reproductibles et contrôlés sur quatre serveurs autoritaires :** apex A `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` ; www CNAME `ludodulac.github.io`. Actuellement *DNS-only* sur Cloudflare. Le domaine officiel reste sur GitHub Pages `main` à `4b5edd9c19ce989af2eae33445017dd30fcbbe92`.
- **Ancien DNSSEC :** DS parent .eu absent chez Cloudflare/Google DNS et quatre NS .eu lors de la preuve du 26 octobre ; DNSSEC ne doit être réactivé qu'après une délégation stable.
- **Candidat autonome :** `https://celebrations-exit-production.rondes.workers.dev`, contenu et verrou admin PASS en navigateur mobile [#40326179981](https://github.com/ludodulac/Celebrations/actions/runs/40326179981). Ce hostname bloque volontairement **tous les POST** ; il ne prouve pas les écritures futures sur le vrai domaine.
- **Administration authentifiée** : tests sur hostname QA avec vraie session éphémère/révocation [#39814358481](https://github.com/ludodulac/Celebrations/actions/runs/39814358481). CRUD synthétique complet sur D1 staging puis nettoyage [#39764462133](https://github.com/ludodulac/Celebrations/actions/runs/39764462133). Ni l'un ni l'autre ne représente une écriture sur la nouvelle origine finale.
- **Parité + sauvegarde 26 octobre** : [#40334946285](https://github.com/ludodulac/Celebrations/actions/runs/40334946285) neuf tables éditoriales identiques, 1 compte, 9 lettres ; [#40335213441](https://github.com/ludodulac/Celebrations/actions/runs/40335213441) sauvegarde AES-256-GCM chiffrée/restaurée en RAM de 16 tables / 12 372 lignes, 158 originaux R2 staging présents, **26** nouvelles visites/clics ajoutées D1, **11 889/11 889** vérifiés au snapshot.
- **Écueil encore connu :** le jeton Cloudflare de CI ne peut **pas exporter la liste complète des DNS/Routes**. Les cinq DNS Web sont recoupés par l'export propriétaire, les quatre NS et la capture d'écran Spaceship (« DNS Records (5) ») ; l'absence de règles URL Redirect était visible, mais **cela ne constitue pas un export intégral auditable du registre**. Ne pas inventer d'autres enregistrements.

## 2. Contrôles GO / NO-GO AVANT l'action Spaceship

1. Recevoir **l'accord explicite du propriétaire** pour un changement de NS et le raccordement des deux noms au Worker. Une consigne « continue les tests » n'est pas cette autorisation.
2. Capturer les pages Spaceship **Nameservers et Advanced DNS / DNS Records** (l'ensemble des lignes actuelles, pas seulement une vue partielle), et Cloudflare **DNS > Records** ; confirmer qu'il n'existe pas de règle de sous-domaine ou service associé omis. Conserver ces preuves privées. Les DNS du domaine `nation-essenienne.eu` restent intouchés.
3. Définir une courte **fenêtre de gel des modifications des contenus** : demander aux administrateurs de ne rien enregistrer dans l'ancien site ni le nouveau pendant la transition. Les visites publiques peuvent encore être comptabilisées par l'ancien site à cause des caches DNS : prévoir la **reprise des clics après la propagation**. Un export REST paginé n'est pas un instantané transactionnel.
4. Vérifier juste avant le switch : Worker HTTPS et pages, image, médias visibles, neuf lettres privées sous leurs anciennes URLs, sauvegarde AES-256-GCM restaurable, parité 9 tables et compte, derniers clics. Conserver l'ancien Worker historique et le projet Supabase partagé. Ne pas publier de brouillon juridique non renseigné.
5. Refuser la bascule si DNSSEC parent ancien réapparaît, si les cinq DNS diffèrent, si Cloudflare change de compte/NS, si les sources divergent, si les quotas Free deviennent préoccupants ou si l'origine autonome rencontre une erreur.

## 3. Séquence de bascule **uniquement après GO explicite**

**Phase A — activer la zone Cloudflare sans encore changer l'origine du site.**

1. Chez Spaceship, sur le **seul** domaine `ronde-des-archanges-universelle.eu`, remplacer `launch1.spaceship.net` / `launch2.spaceship.net` par exactement `luke.ns.cloudflare.com` / `maria.ns.cloudflare.com`. **Ne pas utiliser « Transférer le domaine »** ; le registrar reste Spaceship.
2. Attendre la zone Cloudflare **Active**, contrôler le DS et la délégation sur plusieurs résolveurs ; Cloudflare peut demander jusqu'à 24 h de propagation des NS. Les quatre A et le CNAME `www` identiques et DNS-only doivent, à ce stade, **continuer de servir GitHub Pages**, sans connecter le Worker trop tôt.
3. Conserver une copie des DNS web et une capture d'écran de l'état actif. Ne pas restaurer DNSSEC tant que le passage complet n'est pas stable.

**Phase B — raccorder le nouveau site, sans toucher au domaine e-mail distinct.**

4. Dans Workers & Pages, sélectionner **uniquement** `celebrations-exit-production` puis Settings > Domains & Routes > Add > Custom domain. Lier **séparément** l'apex et `www`. Vérifier l'identité du Worker à chaque ajout pour ne pas raccorder l'ancien Worker des PDF.
5. **Cloudflare interdit le Custom Domain sur un hostname contenant déjà un CNAME.** Retirer le CNAME historique `www → ludodulac.github.io` **juste au moment de créer le Custom Domain www** (et le rétablir si l'ajout échoue). La gestion du record apex A doit être vérifiée dans Cloudflare au moment de l'ajout ; **ne pas supprimer les quatre A d'avance**. Cloudflare crée les enregistrements et certificats de l'origine Worker ; observer le résultat sans fabriquer de DNS. Référence : documentation Cloudflare « Custom Domains », mise à jour septembre 2026.
6. Tester immédiatement HTTPS et le site sur **apex puis www**, les dix pages de programme, chargement médias, dates, neuf lettres PDF existantes, connexion admin avec mot de passe **sans le communiquer**, lecture + enregistrement d'une modification **réversible et autorisée** (jamais publier les textes légaux incomplets), participant et statistiques. Faire des tests desktop et mobile. Vérifier **aucune requête Supabase** du nouveau domaine et aucune erreur JS ; les anciens liens Supabase historiques externes restent sous la responsabilité du projet partagé.
7. Garder l'ancien site, `main`, Supabase et le Worker historique en place tant que les anciens caches et les liens externes existent. Faire ensuite une dernière reprise *append-only* des clics provenant de l'ancien site **après expiration des caches**, avec contrôles des données source et D1, sans écraser les événements déjà saisis dans Cloudflare. Suivre les deux origines pendant la transition.
8. Une fois stabilisé, envisager la **réactivation de DNSSEC Cloudflare** avec la nouvelle clé DS côté Spaceship selon les instructions Cloudflare. Ne pas réutiliser l'ancien DS.

## 4. Retour arrière si défaut critique

- En priorité, **maintenir le site ancien et les données sources disponibles**. Stopper les changements administrateur sur le nouveau site si l'origine active échoue.
- Si le Worker ou un Custom Domain dysfonctionne, rétablir **dans la zone Cloudflare active** les **quatre A GitHub Pages** pour l'apex et le CNAME `www → ludodulac.github.io` ; supprimer/dissocier d'abord les custom domains qui bloquent ces enregistrements, en tenant compte des certificats et des caches. Tester les deux hôtes directement. Ne pas supposer que le basculement est instantané.
- Si la zone Cloudflare elle-même échoue, restaurer chez Spaceship les **anciens NS `launch1.spaceship.net` et `launch2.spaceship.net`** seulement après confirmation des records existants chez Spaceship. Les caches NS peuvent durer. Toute bascule retour doit vérifier le DS parental et ne pas réutiliser un DS Cloudflare sur des DNS Spaceship.
- Si des écritures ont eu lieu côté Cloudflare après changement d'origine, **ne pas les écraser** en réimportant aveuglément Supabase. Exporter / réconcilier les nouvelles écritures et statistiques, puis effectuer un retour arrière contrôlé.
- Conserver les neuf liens PDF historiques, R2 privé, les sauvegardes chiffrées, la base D1 et le projet Supabase partagé ; **aucune suppression de compte/projet/facturation ou de `main`**.

## 5. État et prochaine action

**NOT STARTED — PRODUCTION DOMAIN SWITCH.** Les contrôles DNSSEC, A/CNAME, Brevo et la parité des contenus/clics ont passé au dernier relevé. Il reste à obtenir le GO spécifique du propriétaire, figer les modifications, conserver les dernières captures de zone et définir qui surveille le domaine pendant le raccordement. **Ne jamais considérer une requête de poursuite des vérifications comme l'autorisation d'un changement de serveurs DNS.**

Références officielles Cloudflare (vérifiées le 26 octobre 2026) :
- https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/
- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- https://developers.cloudflare.com/dns/dnssec/
