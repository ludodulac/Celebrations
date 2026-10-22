# CÉLÉBRATIONS — Mission 07 : liens directs Supabase et 4 liens Google Drive

## Décision sans rupture

Les PDF envoyés auparavant avec **le hostname Supabase** `https://jwyayfkssyagvnablttg.supabase.co/functions/v1/celebrations-committee-public?slug=...` (ou `?id=...`) ne peuvent pas être redirigés depuis un domaine Cloudflare, puisque `supabase.co` appartient à Supabase. **Conserver l'Edge Function originale `celebrations-committee-public` et le projet partagé actif** aussi longtemps qu'une de ces anciennes URL doit fonctionner. Aucune extinction de l'Edge Function, du Storage source, du projet ou du compte Supabase durant cette migration. La seule mission 06 a découplé les neuf URL `celebrations.rondes.workers.dev/?lettre=...` vers R2, pas les URL directes Supabase.

Les chemins `/communique`, `/rituel-court`, `/rituel-long` et `/preparation` doivent renvoyer via HTTP 302 vers les **mêmes quatre fichiers Drive**. Ils sont inscrits dans `_redirects` ainsi que dans `migration/cloudflare/legacy-link-router.mjs`. La mission 06 a déjà prouvé leur comportement sur le Worker historique; la mission 07 contrôle aussi le Worker Cloudflare de prévisualisation et relève l'état du domaine officiel en **lecture seule**, sans le modifier.

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
