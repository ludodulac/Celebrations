# CÉLÉBRATIONS — 032 : conserver exactement les liens PDF déjà envoyés par mail

## Ce qui est réellement en circulation

Inspection du code actuel, du site public et de Supabase Edge Functions :

1. L'admin actuel produit des URLs d'invitations de type `https://celebrations.rondes.workers.dev/?lettre=<slug>` (voir `admin-committee-links.js`, constante `PUBLIC_SITE`). **Ce hostname historique n'est PAS celui du nouveau Worker de prévisualisation**, ni le domaine `www.ronde-des-archanges-universelle.eu`. Conserver ses routes sera une condition du changement final.
2. La page principale `https://www.ronde-des-archanges-universelle.eu/?lettre=<slug>` sait également traiter les invitations, dans l'ancien site via une redirection JS vers l'Edge Function Supabase ; le build Cloudflare préparé pointe vers l'accès D1/R2 privé.
3. La fonction Supabase `celebrations-committee-public` accepte `?slug=` **ou** `?id=` et sert le PDF depuis le Storage original. Les liens directs envoyés avec `https://jwyayfkssyagvnablttg.supabase.co/functions/v1/celebrations-committee-public?...` **ne peuvent PAS garder exactement le même hostname si Supabase est coupé**. Pour préserver littéralement ces anciennes URL, conserver la fonction d'origine ou un relais sur le hostname d'origine ; il n'est pas sous contrôle DNS du domaine utilisateur. **Ne pas affirmer que tout Supabase peut être arrêté et que ces URLs continueraient de fonctionner.**
4. Quatre chemins historiquement publiés via `/_redirects` conduisent directement à des documents Google Drive : `/communique`, `/rituel-court`, `/rituel-long`, `/preparation`. Ces **mêmes chemins d'entrée** doivent continuer de rediriger vers les mêmes destinations.
5. Les PDF de comité : 9 lettres originales, 9 slugs opaques uniques déjà copiés en D1, 9 fichiers privés correspondants R2 et lecture HTTP 200 par `/letter/<slug>` vérifiée dans le nouveau Worker.

## Correctif de compatibilité écrit sans changer le site officiel

- `migration/cloudflare/legacy-link-router.mjs` intercepte `GET/HEAD /?lettre=<slug>` et renvoie **directement le fichier PDF** correspondant via le contrôle D1 `committee_media`, sans réponse 301/302. Le lien de l'e-mail et l'URL du navigateur restent donc identiques sur le **même hostname**.
- Les chemins historiques `/communique`, `/rituel-court`, `/rituel-long`, `/preparation` restent des HTTP 302 vers leur adresse Drive originale.
- Codes inclus dans le Worker candidat final et dans le Worker de prévisualisation indépendant, afin de tester sur la vraie D1/R2 **avant** tout changement de domaine.
- Test HTTP sur les neuf anciens slugs (`?lettre=`) et sur les quatre liens Drive, sans publier les slugs ou les fichiers dans GitHub ; tests synthétiques pour les accès interdits.

## Trois conditions supplémentaires avant de promettre 'exactement les mêmes liens'

**A. Même hostname historique.** Vérifier l'existant `celebrations.rondes.workers.dev`, sauvegarder ses routes et publier en fin de migration un traitement de compatibilité Cloudflare sur **ce hostname exact**, sans le supprimer ni le rediriger vers une nouvelle URL. La prévisualisation indépendante NE suffit PAS à cette garantie.

**B. Supabase-hosted direct links.** Identifier les envois éventuels de liens contenant l'URL `jwyayfkssyagvnablttg.supabase.co`, garder ces points d'entrée encore actifs ou une passerelle d'origine. Cela impose une dépendance de compatibilité sur Supabase pour les URLs historiques déjà envoyées. Aucun changement de ce type n'est effectué ici.

**C. Administration, DNS et delta.** Nouvelle authentification administrateur encore non testée sur Worker modifiable ; aucune configuration des DNS Spaceship / du domaine officielle n'est effectuée ici ; les clics source continuent d'évoluer. Ne pas couper le domaine GitHub Pages ou Supabase et ne pas revendiquer une migration finale tant que ces étapes ne sont pas testées.

**Statut : PREPARATION / NON BASCULE.** Le projet de compatibilité n'autorise aucune suppression de l'ancien Worker `celebrations`, ni de la fonction Supabase, ni du compte Supabase partagé.
## Preuves réelles du 21 octobre 2026

- **Cloudflare preview #39681405372 — SUCCESS** : 9/9 slugs historiques fonctionnent sous la forme exacte `/?lettre=<slug>` sur le Worker de prévisualisation, HTTP 200 PDF directement, sans redirect `Location`. Les quatre anciens chemins de PDF Google Drive ont répondu 302 vers leurs destinations d'origine. 113/113 objets publics accessibles et 9/9 lettres par `/letter/<slug>`, sept pages du programme en navigateur mobile, zéro requête à Supabase dans le navigateur.
- **Origine des e-mails historiques #39681831830 — SUCCESS** : 9/9 URL originales `https://celebrations.rondes.workers.dev/?lettre=...` existent et répondent HTTP 200 ; 9/9 PDF renvoyés par l'ancienne fonction Supabase répondent HTTP 200 en PDF. **Le worker historique actuel fait ENCORE appel à Supabase** : la conservation des PDF à l'identique est donc prouvée tant que cette fonction Supabase reste active, mais PAS après son extinction.
- Les nouvelles routes sont dans le code des Workers Cloudflare candidat et prévisualisation, **pas encore sur le Worker historique `celebrations.rondes.workers.dev`**. Il faut substituer son backend vers R2/D1 en conservant absolument son nom/hostname avant de prétendre que les liens d'e-mails sont indépendants de Supabase.
- Aucun PDF, lettre, mot de passe, nom, slug ni e-mail confidentiel divulgué dans les journaux. Aucun DNS, Worker historique, base Supabase ni GitHub main modifié.

**Décision : NO CUTOVER** tant que l'ancien hostname des e-mails n'est pas raccordé de façon éprouvée à R2, l'administration réelle Cloudflare n'est pas opérationnelle, et les éventuelles URLs pointant directement sur le hostname Supabase n'ont pas de politique de compatibilité. Les liens directs `supabase.co` nécessitent garder un relais côté Supabase, car ce nom de domaine ne nous appartient pas. Le changement de domaine officiel exige également un domaine Cloudflare actif et des paramètres DNSSEC/Spaceship corrects.