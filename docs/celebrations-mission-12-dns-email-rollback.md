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

## Relevé réel du 22 octobre 2026 — preuves GitHub Actions

Premier audit réel [GitHub Actions #39821192438](https://github.com/ludodulac/Celebrations/actions/runs/39821192438) : tous les contrôles DNS, du site de secours et de visibilité Cloudflare ont **réussi** ; la conclusion globale du job était provisoirement FAILURE car le **garde de quota D1 appelé en mode post n'avait pas reçu de relevé pré**, alors même que ce job n'a exécuté aucune requête SQL D1. Bug de procédure sans mutation : le workflow est corrigé pour lancer le garde `pre` et `post`. Relevé DNS conservé depuis le log :

| Enregistrement/contrôle | État observé |
|---|---|
| Serveurs NS autoritaires | `launch1.spaceship.net`, `launch2.spaceship.net` |
| CNAME `www` | `ludodulac.github.io` (GitHub Pages) |
| Apex : IPv4 A | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (GitHub Pages) |
| Apex : AAAA | aucun visible sur la réponse du résolveur |
| TTL observé des réponses IPv4 `www` | 1 800 s ; **pas nécessairement TTL du CNAME lui-même** |
| MX | **aucun MX retourné par ce résolveur** ; cela ne prouve pas qu'aucune adresse mail n'est ou ne sera utilisée |
| SPF `v=spf1` | non trouvé au domaine racine dans cet inventaire public |
| DMARC `v=DMARC1` | non trouvé sur `_dmarc` dans cet inventaire public |
| DKIM | aucun des quatre sélecteurs courants testés ne porte de preuve ; **autres sélecteurs non énumérables** |
| CAA | aucun enregistrement CAA retrouvé dans l'inventaire |
| **DNSSEC DS parent** | **PRÉSENT**, un DS, TTL observé **86 400 secondes (24 h)** |
| Empreinte du premier relevé (diagnostic, **non stable**) | `1e9214479b8d11a1432f7613665b67b820687d05cd0c745a7c416dc3643defb6` (ordre DNS round-robin et TTL inclus) |

`CELEBRATIONS_LEGACY_ROLLBACK_BASELINE_READONLY_PASS` : **HTTPS du site officiel HTTP 200**, `main` exact toujours `4b5edd9c19ce989af2eae33445017dd30fcbbe92`, déploiement GitHub Pages associé SUCCESS, domaine actuellement résolu. **L'ancien site peut encore être consulté**, mais un **retour arrière réel après changement de NS** n'est pas démontré : aucune modification DNS ni restauration active n'a été réalisée.

`CUTOVER_8_DNS_DISCOVERY` : **zone `ronde-des-archanges-universelle.eu` NON visible dans le compte Cloudflare déjà connecté**. La zone autoritaire est actuellement **Spaceship DNS**. Le jeton Cloudflare présent ne donne pas accès au fichier DNS de Spaceship ; donc `full_dns_snapshot_captured=false`. La liste R2 produite par la requête de catalogue global s'est révélée **inexploitable par ce script** (`account_r2_inventory_readable=false`) ; cela n'invalide pas les copies privées R2 dont les transactions et restaurations réelles ont été vérifiées en missions précédentes. Aucun emplacement de zone ou secret n'a été inventé.

### Trois points empêchent donc une bascule sûre pour l'instant

1. **Inventaire DNS complet chez Spaceship : NON DISPONIBLE depuis le connecteur**. Un relevé des seuls DNS publics ne garantit ni sous-domaines, ni sélecteurs DKIM cachés, ni valeurs de vérification de domaine. Il faut une **sauvegarde/relevé complet du panneau de zone Spaceship** et une procédure de rétablissement avant bascule.
2. **Zone Cloudflare non liée/active pour ce domaine dans le compte connecté : NON**. Le Worker autonome `workers.dev` ne suffit pas à attacher le domaine officiel sur offre Free. Préparer une zone dans le compte correct, vérifier les futurs NS attribués et recopier les DNS existants ; ne pas changer les NS ici.
3. **DNSSEC activé, DS parent TTL ~24 h**. Une substitution précipitée des NS peut faire échouer la résolution DNSSEC sur tous les services du domaine. La procédure concrète de transition (période de propagation des DS et restauration) doit être revue **avant** toute manipulation.

**Conséquence : `MISSION12_DNS_DISCOVERY=PASS`, `EXISTING_SITE_ROLLBACK_BASELINE=PASS`, mais `FULL_ZONE_ESCROW=BLOCKED_NOT_ACCESSIBLE`, `CLOUDFLARE_CUSTOM_DOMAIN=NOT_READY`, `DNSSEC_TRANSITION=NOT_PERFORMED`, `OWNER_CUTOVER_APPROVAL=NO`.** Il serait faux de déclarer le domaine prêt à changer maintenant.

Aucune modification de DNS, de certificat, des e-mails, de GitHub `main`, de Supabase ou des Workers historiques. Les documents et liens existants restent en service.

### Relance du contrôle sans écriture

Le second passage avec sauvegarde des compteurs D1 pré/post est déclenché par le marqueur dédié du workflow. Les barrières de sécurité et le périmètre restent identiques ; en l'absence de zone Spaceship exportable, aucune nouvelle tentative de bascule ou de création de zone Cloudflare n'est autorisée.

### Amélioration de la comparaison DNS

La relance [#39821589658](https://github.com/ludodulac/Celebrations/actions/runs/39821589658) est **SUCCESS** : tous les contrôles DNS, main/GitHub Pages, registre de ressources, sauvegarde de zone si accessible, et quotas Free passent. L'absence de zone Cloudflare est confirmée, sans modification. Le fingerprint des deux premiers runs avait varié à tort par simple rotation de l'ordre des IP DNS et TTL de cache : le script a été corrigé pour trier les réponses et exclure les TTL du fingerprint des **valeurs**. Un nouveau contrôle isolé valide ce calcul, sans modifier la configuration.

**Verdict de mission 12 : PRÉPARATION ET AUDIT EFFECTUÉS, BASCULE BLOQUÉE PAR LES PRÉREQUIS RÉELS DE DNS SPACESHIP, ZONE CLOUDFLARE ET DNSSEC.** Aucune action de raccordement du domaine n'est lancée par la mission 12. Les tests qui ne concernent pas les pages réellement utilisées ne sont pas des prérequis.

### Contrôle secondaire de l'historique GitHub Pages

Le run [#39821830360](https://github.com/ludodulac/Celebrations/actions/runs/39821830360) a bien prouvé l'état DNSSEC et obtenu l'empreinte DNS canonique `7fc2dcef132fc4dec99ca92c67d00578c31fcd240cf980b16a1245239afaadab`, mais le garde GitHub Pages cherchait un ancien succès parmi les **12 derniers jobs de toute nature** ; ceux-ci ne comprennent plus forcément un déploiement Pages puisque `main` est resté figé pendant les nombreuses missions. Cette limite de pagination arbitraire a été corrigée : le garde consulte désormais uniquement l'historique du workflow `pages.yml` sur `main`, sans modifier son déploiement. Une répétition finale limitée aux métadonnées/DNS et au même garde de quota est lancée.
