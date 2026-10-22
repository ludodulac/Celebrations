# 🌸 CÉLÉBRATIONS — Mission 12 : domaine, e-mails, DNSSEC, plan de retour arrière

**Décision de périmètre du propriétaire : ne transférer que le site et les éléments réellement utilisés.** Ne pas recréer les quatre raccourcis orphelins. Ne pas couper les liens PDF historiques de mission 06. **La mission 12 n'autorise absolument aucun changement DNS, registrar, routage officiel, page GitHub `main`, ni fermeture Supabase.**

Domaine public existant : `www.ronde-des-archanges-universelle.eu` ; zone racine : `ronde-des-archanges-universelle.eu`. L'ancien site dépend de GitHub Pages au HEAD épinglé `main=4b5edd9c19ce989af2eae33445017dd30fcbbe92`, et de Supabase pour des services historiques. Le nouveau site testé est un Worker indépendant `celebrations-exit-preview-ro.rondes.workers.dev` et le Worker de production candidat `celebrations-exit-production`, encore **sans domaine personnalisé officiel**.

## Étendue de cette mission

Contrôle d'exploitation **en lecture seule** :

- DNS public actuel : serveurs NS, adresse/cible WWW, racine, MX, présence SPF et DMARC, quelques sélecteurs DKIM courants (contrôle **non exhaustif**), CAA, et présence du DS parent DNSSEC lorsque la vérification est disponible. Les contenus des enregistrements TXT, tokens de vérification, et toutes les données de membres sont exclus des journaux. Un fingerprint SHA-256 de l'instantané public permet de déceler des évolutions. Ce relevé public **ne contient pas toute la zone** : aucun outil ne peut énumérer arbitrairement toutes ses entrées cachées.
- Hébergement actuel : comparer la page publique avec le commit `main` et l'historique GitHub Pages ; garder l'ancien Worker `celebrations.rondes.workers.dev` pour ses neuf PDF originaux.
- Zone propriétaire : rechercher dans le compte Cloudflare connecté si une zone complète **est déjà accessible** en lecture API ; si oui, `scripts/audit_preproduction_resources_and_dns.py` chiffre localement DNS+Worker routes en AES-256-GCM, sauvegarde seulement le ciphertext dans R2 staging privé et vérifie le fichier. **Si le domaine est géré par un autre DNS, le script indique le manque d'accès ; il ne prétend pas avoir exporté la zone du registrar.** Aucun jeton supplémentaire ni mot de passe n'est demandé au propriétaire dans ce chat.
- Situation de migration : **ne pas** relancer les audits et transferts des missions 1–11 ; la sauvegarde chiffrée du 22 octobre a déjà été vérifiée et le delta des 86 clics a déjà été repris (11 824 événements à l'heure du snapshot). Un **nouveau** delta sera nécessaire pendant le gel final du site en mission 13.

## Plan sûr de préparation de la bascule (NON exécuté)

1. **Conserver l'origine exacte** : DNS complet (noms, types, valeurs, TTL), registrar et panneaux autorisés, NS, DS DNSSEC, routes, enregistrements email MX/SPF/DKIM/DMARC, vérifications de domaine et règles de redirection. Prévoir une copie **privée complète et indépendante** de la zone auprès du véritable hébergeur DNS si la zone n'est pas dans Cloudflare ; les seuls résultats publics ne suffisent pas. Vérifier la gestion du sous-domaine `www` et du domaine racine.
2. **Créer/activer une zone DNS Cloudflare sous contrôle du propriétaire**, si nécessaire, sans modifier immédiatement la délégation. Reproduire **tous** les enregistrements existants non liés au site, notamment la messagerie et les éventuels sous-domaines tiers. **Ne jamais confondre propriétaire du nom (registrar) et hébergeur DNS (nameservers).** La formule Free exige normalement que Cloudflare soit autoritaire si l'on veut attacher un Worker via **Custom Domain**, pas un simple CNAME externe vers `workers.dev`. Documentation : `https://developers.cloudflare.com/workers/configuration/routing/custom-domains/`, `https://developers.cloudflare.com/dns/nameservers/update-nameservers/`.
3. **DNSSEC** : si un DS existe dans la zone parente, préparer l'ordre exact de transition et les TTL de DS. Ne jamais remplacer les NS en laissant un ancien DS incompatible, sous peine de `SERVFAIL` et d'indisponibilité **du site et des e-mails**. Définir un protocole de migration DNSSEC conforme à `https://developers.cloudflare.com/dns/dnssec/` ; choisir préalablement si DNSSEC doit être temporairement désactivé au registrar et après quelle propagation. **Aucun changement DNSSEC en mission 12.**
4. **Tester hors domaine officiel** la configuration Workers D1/R2 préparée, la connexion admin, les neuf lettres de comité, les liens internes réellement affichés et le fonctionnement mobile. Conserver le Worker historique et la fonction directe `supabase.co` actifs.
5. **Préparer le basculement lui-même sans l'exécuter** : gel des mises à jour administrateur et statistiques si nécessaire, reprise de l'ultime delta Supabase vers D1, sauvegarde et contrôles d'intégrité de la source figée, attachement du `www` et éventuellement racine au Worker uniquement après confirmation du plan DNS et de l'autorisation explicite du propriétaire.
6. **Contrôler immédiatement** après bascule : résolutions autoritaires et récursives DNS, HTTPS/SSL WWW et racine, 7 jours, 113 médias publics, neuf lettres, administration et statistiques, **réception et envoi réel de mails** depuis une adresse déjà configurée (test humain, sans lire des boîtes non autorisées), et conformité NS/DS. Vérifier quotas Free.
7. **Retour arrière** : si anomalie, figer les écritures Cloudflare puis restaurer les routes/records DNS/NS/DS d'après une copie complète vérifiée, sans supprimer les enregistrements de messagerie. Attendre la résolution selon TTL. Recharger l'ancien GitHub Pages `main` et le backend Supabase **sans toucher aux autres projets**. Tester une page, un média, l'admin, la messagerie et la disponibilité des neuf PDFs. **Récupérer et réconcilier les événements créés sur Cloudflare** : le simple retour DNS ne peut garantir zéro perte. Ne pas supprimer Cloudflare ou Supabase durant le rollback.

## Barrières avant bascule

- `FULL_AUTHORITATIVE_DNS_ZONE_ESCROW` : doit être **YES**, pas une simple liste NS publique.
- `CLOUDFLARE_ACTIVE_ZONE_AND_CUSTOM_DOMAIN_READY` : doit être **YES** sur la bonne zone avant d'attacher le Worker à `www`. Une zone inexistante dans le compte lié est un **blocage**, et non un prétexte à inventer les NS.
- `MAIL_RECORDS_FULL_FIDELITY_CHECK` et `DNSSEC_DS_TRANSITION_PLAN` : **YES**.
- `OLD_PAGES_FALLBACK_CONFIRMED` et `SAFE_ROLLBACK_PROCEDURE` : **YES** pour les preuves mesurables, mais un vrai **switch/réswitch de DNS** n'est pas répété en mission 12.
- `CUTOVER_OWNER_EXPLICIT_APPROVAL` : reste **NO** jusqu'à l'autorisation distincte en mission 13.
- `NO_SITE_OUTAGE` : aucun changement DNS ou déploiement public n'est fait en mission 12.

## État du contrôle réel

Workflow opt-in : `mission12-dns-email-rollback-readonly` sur `feat/celebrations-supabase-exit-001`, déclenché par le marqueur `[MISSION12_DNS_ROLLBACK_READONLY_ONCE]`. Les résultats DNS du domaine officiel, les différences et le statut de sauvegarde privée complète de zone seront consignés ici après consultation du run GitHub Actions ; **aucun succès non exécuté n'est affirmé**.
