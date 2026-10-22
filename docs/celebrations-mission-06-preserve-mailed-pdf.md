# CÉLÉBRATIONS — Mission 06 : préserver les 9 liens PDF envoyés par e-mail

## Objectif validé par le propriétaire
Faire servir directement les neuf PDF privés R2 (contrôle d'accès D1 `committee_media`) par les **mêmes URLs littérales** `https://celebrations.rondes.workers.dev/?lettre=<slug>` ; ne pas modifier les slugs, ne pas rediriger vers un nouveau domaine, maintenir les autres pages et l'administration actuelles du Worker historique. Le domaine officiel et Supabase restent en place.

## Preuves préalables
- [Run #39681831830](https://github.com/ludodulac/Celebrations/actions/runs/39681831830) : les neuf liens originaux marchent toujours, mais leur HTML utilise encore l'Edge Function Supabase.
- [Run #39681405372](https://github.com/ludodulac/Celebrations/actions/runs/39681405372) : les neuf liens `?lettre=` servent directement PDF depuis D1/R2 sur Worker candidat, sans changer l'adresse ; les quatre redirections Drive sont couvertes.
- [Run #39779857288](https://github.com/ludodulac/Celebrations/actions/runs/39779857288) : nouveau Worker QA administrateur déployé, neuf liens PDF D1/R2 authentifiés et testés.
- Ces contrôles **ne prouvent pas encore** la bascule du Worker historique `celebrations`.

## Règles impératives d'intervention
1. Vérifier par HTTP que les fichiers visibles de l'ancien Worker correspondent **octet pour octet** aux ressources actuelles du dépôt `main`; inspecter et sauvegarder la définition du Worker actuel et ses bindings, sans afficher de secrets dans GitHub Actions.
2. Si l'ancien Worker n'est pas reconstituable ou si son contenu ne correspond pas à la source supposée, **ARRÊTER avant déploiement**. Ne pas remplacer aveuglément les pages publiques ou les routes de l'ancien Worker.
3. Préparer un Worker de compatibilité gardant absolument le nom historique `celebrations`, n'interceptant que les chemins PDF historiques, et déléguant toute autre requête aux ressources originales. Prétester cette configuration sur un Worker indépendant.
4. Avant tout remplacement de l'ancien Worker, exiger un retour arrière réalisable : conservation sûre de l'original, vérification des autres pages, contrôle du rôle des anciens assets et disponibilité des quotas Cloudflare. Une publication seulement si elle est sûre, sinon statut `BLOCKED_SAFE`.
5. Vérifier ensuite les neuf slugs via HEAD/GET sur l'**ancien hostname exact**, réponse `200 application/pdf` directe (sans `Location`) ; absence de contenu non autorisé, et préservation des autres pages.
6. Ne pas toucher au domaine officiel, à GitHub `main`, aux ressources des autres applications ou à la fonction Supabase directe (compatibilité nécessaire pour les anciennes URL `supabase.co`, traitées en mission 07).

## Contrôle courant
Audit sans modification du Worker original lancé avec `[MISSION06_ORIGINAL_WORKER_PREFLIGHT_ONCE]`. Résultat et décision à consigner à partir des preuves GitHub Actions. Un test qui échoue est une protection, pas une raison de forcer le déploiement.

## Découverte sûre du 22 octobre 2026 — original récupérable

Le précontrôle réel [GitHub Actions #39785891570](https://github.com/ludodulac/Celebrations/actions/runs/39785891570) a comparé les cinq fichiers critiques (`/`, `/index.html`, `/styles.css`, `/admin-committee-links.js`, `/admin.html`) sur `celebrations.rondes.workers.dev` avec `main` : **5/5 octet pour octet identiques**. GitHub `main` est épinglé au commit `4b5edd9c19ce989af2eae33445017dd30fcbbe92`.

La réponse Cloudflare API `GET /workers/scripts/celebrations` est HTTP **204** (Worker original **assets-only**, aucun script JS à sauvegarder), sa configuration lisible est datée du **22 septembre 2026** avec zéro binding. Le premier précontrôle a échoué volontairement sur l'ancienne hypothèse « un script JS doit exister » ; la protection a été corrigée pour accepter cette configuration vérifiée à l'identique, tout en conservant l'échec si les ressources diffèrent. Aucune modification de `celebrations` ou du domaine officiel à cette étape.

Un Worker de compatibilité séparé `celebrations-legacy-links-qa` utilisant exclusivement les actifs originaux de `main` est désormais préparé : les autres pages demeurent identiques, et seules les neuf URL `?lettre=` peuvent accéder à D1/R2 sans redirection. Une vérification octet par octet des neuf PDF contre le Supabase original est prévue avant de toucher à l'ancien Worker.

## Sécurité des ressources de prévisualisation

Le premier Worker QA isolé a été déployé, mais son premier test a été interrompu avant validation : un HTTP 404 immédiat sur un nouvel hostname pouvait être dû à la propagation edge. Le déploiement a également révélé un problème de périmètre : Wrangler pouvait embarquer des métadonnées `.git` si le dossier brut du checkout était fourni comme répertoire d'actifs. **Ce comportement est désormais interdit.** Le générateur construit un dossier `legacy-assets` séparé et limité aux fichiers web publics HTML, JS, CSS et médias ; le Worker rejette explicitement les chemins `.git`, `.github`, `scripts`, `tests`, `migration`, `node_modules` ; la vérification HTTP confirme ces interdictions. L'ancien Worker `celebrations` n'a pas été modifié par le premier essai.

## Reprise QA après propagation Cloudflare

La seconde tentative a reconstitué 93 fichiers web publics (102 entrées dans le manifeste Wrangler), sans métadonnées Git ni scripts de maintenance. Le contrôle a observé un HTTP 200 sur une URL technique : il peut provenir du retour `index.html` du mode SPA ou d'une version edge antérieure. Pour écarter toute ambiguïté, le Worker définit désormais le marqueur non secret `x-celebrations-legacy-pdf-bridge: mission06-safe-v2`, et le test refuse toute réponse avant propagation de cette version. Pour les chemins interdits, une réponse 200 n'est acceptable que si ses octets correspondent **strictement à la page d'accueil publique**, jamais à un document Git ou CI. Nouveau test des neuf PDF lancé sans toucher au Worker original.

## Validation de bout en bout sur Worker indépendant — 22 octobre 2026

La version nettoyée de la passerelle est **SUCCESS** sur [GitHub Actions #39788047360](https://github.com/ludodulac/Celebrations/actions/runs/39788047360), sans toucher à l'ancien Worker. Relevé authentifié `MISSION06_NINE_LEGACY_PDFS_REAL_HTTP_PASS` : neuf slugs historiques conservent exactement `/?lettre=`, neuf PDF délivrés HTTP 200 `application/pdf` sans redirection, neuf fichiers **identiques octet pour octet** à la réponse de l'Edge Function Supabase actuelle, cinq actifs originaux inchangés et quatre redirections Drive valides. Slug inconnu 404, requête POST interdite, protections des chemins techniques vérifiées, quota D1 Free pré/post conforme. Le Worker distinct utilise 93 ressources web publiques nettoyées (aucun `.git` ni fichiers CI).

Le Worker original est un déploiement **sans JS, uniquement assets**, récupérable intégralement depuis `main` épinglé `4b5edd9c19ce989af2eae33445017dd30fcbbe92`; la restauration de sa configuration originale est préparée. Nous pouvons appliquer **uniquement** la redirection interne PDF sur le nom exact `celebrations`, avec vérification immédiate et rollback automatique en cas d'échec, sans changer le site officiel, son DNS, Supabase ou `main`.

## Première tentative sur le vrai hostname — restauration effectuée

[GitHub Actions #39788352703](https://github.com/ludodulac/Celebrations/actions/runs/39788352703) : déploiement de la passerelle sur `celebrations.rondes.workers.dev` accepté par Cloudflare, mais l'audit a rencontré une réponse d'une **ancienne version** sur une route interne juste après publication. Le test a donc refusé de certifier la mission ; **le rollback automatisé a réussi** et a republié l'original `main` en mode assets-only. Le domaine officiel, Supabase, GitHub `main`, les slugs et les fichiers R2 sont inchangés.

La vérification a été renforcée : elle exige maintenant le marqueur `mission06-safe-v2` pour **chaque requête**, avec une fenêtre bornée de propagation des différents points edge, au lieu de s'arrêter si la première réponse vient de l'ancien Worker. Aucun assouplissement des vérifications PDF, d'intégrité ou de sécurité. Nouveau passage préalable sur la QA indépendante.

## QA après correction — PASS

Nouveau [GitHub Actions #39788800505](https://github.com/ludodulac/Celebrations/actions/runs/39788800505) : **SUCCESS**, neuf PDF délivrés directement, identiques octet pour octet à Supabase, cinq ressources originales identiques, quatre redirections Drive conservées, rejets de chemins internes, quotas D1 contrôlés. Vérification renforcée par URL avec contrôle systématique de la version Worker réellement déployée. L'ancien site reste restauré en assets-only depuis le précédent essai ; seconde tentative autorisée uniquement sur le hostname historique, avec même rollback immédiat en cas d'échec.
