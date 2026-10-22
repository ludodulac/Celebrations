# CÉLÉBRATIONS — Mission 07 : liens directs Supabase et 4 liens Google Drive

## Décision sans rupture

Les PDF envoyés auparavant avec **le hostname Supabase** `https://jwyayfkssyagvnablttg.supabase.co/functions/v1/celebrations-committee-public?slug=...` (ou `?id=...`) ne peuvent pas être redirigés depuis un domaine Cloudflare, puisque `supabase.co` appartient à Supabase. **Conserver l'Edge Function originale `celebrations-committee-public` et le projet partagé actif** aussi longtemps qu'une de ces anciennes URL doit fonctionner. Aucune extinction de l'Edge Function, du Storage source, du projet ou du compte Supabase durant cette migration. La seule mission 06 a découplé les neuf URL `celebrations.rondes.workers.dev/?lettre=...` vers R2, pas les URL directes Supabase.

Les chemins `/communique`, `/rituel-court`, `/rituel-long` et `/preparation` existent dans une ancienne configuration de raccourcis, mais aucune référence cliquable à ces quatre chemins n'a été trouvée dans les pages et scripts du site public examinés. **Le propriétaire a expressément exclu ces raccourcis orphelins du périmètre de migration.** Ils ne constituent ni une fonctionnalité à restaurer, ni une condition de bascule. L'ancien audit de compatibilité ci-dessous reste comme trace factuelle, sans imposer leur prise en charge. Ils sont inscrits dans `_redirects` ainsi que dans `migration/cloudflare/legacy-link-router.mjs`. La mission 06 a déjà prouvé leur comportement sur le Worker historique; la mission 07 contrôle aussi le Worker Cloudflare de prévisualisation et relève l'état du domaine officiel en **lecture seule**, sans le modifier.

## Vérifications réelles nécessaires

Script `scripts/mission07_verify_legacy_direct_supabase_links.mjs`, GitHub Actions `mission07-original-supabase-and-drive-links-readonly`, déclenché par `[MISSION07_LEGACY_DIRECT_LINKS_ONCE]` :

1. Relever les neuf identifiants et slugs actifs de la D1 Cloudflare migrée par une requête `SELECT` bornée, **sans jamais imprimer** ces valeurs.
2. Vérifier par HTTP public les neuf liens Supabase originaux `?slug=` et les neuf liens `?id=`, comparer l'empreinte de chaque document avec le PDF R2 servant maintenant sur le Worker historique. Contrôler le rejet des identifiants fictifs.
3. Comparer les quatre redirections HTTP 302 du Worker historique et du Worker de prévisualisation avec les cibles exactes de `_redirects`.
4. Inspecter en lecture seule les quatre chemins du **domaine officiel** ; constater leur état actuel, sans modifier GitHub `main`, l'hébergement, les DNS ou Supabase.
5. Vérifier les quotas D1 Free avant/après et l'absence d'écriture.

## Limites et règle définitive

- Aucune opération Supabase ne peut être remplacée par le seul déploiement d'un nouveau Worker sur `workers.dev`. La dépendance sur `supabase.co` demeure tant que les URL directes doivent rester valables.
- Une restauration ou publication de nouveaux liens comité nécessite la synchronisation des slugs/objets correspondants vers R2/D1 ; ne pas promettre aux utilisateurs que des nouveaux liens Supabase sont automatiquement copiés.
- Maintenir le serveur de compatibilité Supabase en service même après la future bascule du site officiel : `SUPABASE_LEGACY_DIRECT_URLS_DECOMMISSION_AUTHORIZED=NO`.
- La disponibilité des liens Drive eux-mêmes dépend aussi des permissions de partage Drive : cette mission confirme les destinations des redirections, pas un audit d'autorisations Drive pour chaque fichier.
- **Aucun changement de production** autorisé par ce test : seuls des appels GET/HEAD/SELECT existent.

## Résultat

Audit réel lancé ; verdict à consigner uniquement à partir du job GitHub et de ses logs.

## Premiers résultats vérifiés — 22 octobre 2026

[GitHub Actions #39791022033](https://github.com/ludodulac/Celebrations/actions/runs/39791022033) : **SUCCESS**, sans aucun changement du site ni de Supabase.
- **9/9 anciennes URL directes Supabase en `?slug=`** : HTTP 200, PDF identiques aux versions privées R2.
- **9/9 anciennes URL directes Supabase en `?id=`** : HTTP 200, même contenu PDF.
- Une référence inexistante est refusée ; aucune donnée personnelle, aucun slug, aucun identifiant ni octet PDF n'est inscrit dans les journaux.
- **4/4 raccourcis Drive sur l'ancien Worker** : HTTP 302 vers les destinations exactes enregistrées ; **4/4** sur la prévisualisation Cloudflare également.
- La requête HEAD initiale sur le domaine officiel `www.ronde-des-archanges-universelle.eu` a retourné **301** pour les quatre chemins, et non directement 302 vers Drive. Il faut distinguer une redirection canonique intermédiaire d'un véritable lien cassé. Ce constat ne permet pas d'affirmer que les quatre chemins de **ce domaine** conduisent déjà à Drive ; audit GET de la chaîne complète lancé séparément sans toucher au domaine.
- Quotas D1 Free pré et post : 109 994 lectures et 1 059 écritures selon les snapshots Analytics, bien sous les plafonds ; métriques à latence possible et **zéro écriture volontaire** lors du contrôle.

**Condition indispensable :** conserver la fonction `celebrations-committee-public` de Supabase et son stockage historique après le transfert du domaine officiel tant que les liens directs `supabase.co` doivent rester disponibles. La compatibilité ne signifie pas pouvoir désactiver Supabase.

## Audit du domaine officiel : anomalie antérieure identifiée

[GitHub Actions #39791582852](https://github.com/ludodulac/Celebrations/actions/runs/39791582852), job `mission07-official-shortlinks-readonly` = **SUCCESS technique pour le relevé**, mais **0/4 redirections Drive fonctionnelles sur le domaine officiel actuellement en service** :

| Route officielle vérifiée | Chaîne de réponse réelle | Atteint le fichier Drive ? |
|---|---|---|
| `/communique` | 301 puis 404 | NON |
| `/rituel-court` | 301 puis 404 | NON |
| `/rituel-long` | 301 puis 404 | NON |
| `/preparation` | 301 puis 404 | NON |

Ces chemins fonctionnent déjà **4/4** avec HTTP 302 vers le bon Drive sur `celebrations.rondes.workers.dev`, et **4/4** sur `celebrations-exit-preview-ro.rondes.workers.dev`. Leur traitement figure déjà dans le Worker candidat Cloudflare `migration/cloudflare/production-worker.mjs`, via `legacy-link-router.mjs`. L'échec du domaine officiel provient du chemin d'hébergement actuellement actif ; la simple présence du fichier `_redirects` dans GitHub ne garantit pas son interprétation par l'hébergeur. Aucun ajustement de ce site officiel n'est fait avant la bascule autorisée.

**Correction du périmètre par le propriétaire (22 octobre 2026) :** ces quatre chemins ne sont pas utilisés par les pages publiques examinées. **Ne pas les réparer, ne pas les tester à nouveau et ne jamais bloquer la migration sur leur état.** Le script d'audit historique est conservé pour la traçabilité, mais son ancien critère facultatif de blocage est retiré.

**Verdict mission 07 après rectification du périmètre :** `DIRECT_SUPABASE_ORIGINAL_URLS=18/18 PASS`, `LEGACY_AND_PREVIEW_DRIVE_SHORTLINKS=8/8 PASS` (constat historique non requis), `OFFICIAL_DOMAIN_ORPHAN_SHORTLINKS=OUT_OF_SCOPE_NOT_A_BLOCKER`, `SUPABASE_LEGACY_COMPATIBILITY_SERVICE=KEEP_ACTIVE` tant que ces URL directes doivent rester disponibles. **Mission 07 : contrôles pertinents terminés ; aucun correctif à programmer pour les quatre raccourcis inutilisés.** La bascule officielle reste soumise aux autres prérequis de sécurité et de validation, et n'est pas autorisée par cette mission. Aucune modification GitHub `main`, DNS, R2/D1 métier ni Supabase.

## Instruction de périmètre prioritaire — décision explicite du propriétaire

Ne migrer, ne vérifier et ne réparer que **ce qui est effectivement utilisé sur le site en service** : pages visibles, navigation, boutons/liens cliquables, contenus et médias publiés accessibles depuis ces pages, administration utilisée. Les anciennes routes techniques non reliées au site ne justifient **aucune tâche, aucun quota consommé ni aucun blocage**. Les neuf liens PDF historiques déjà envoyés avaient été explicitement demandés et font l'objet de la mission 06 terminée ; ne pas entreprendre d'autres travaux sur des URLs historiques hors site sans demande distincte.
