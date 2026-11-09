# 🌸 CÉLÉBRATIONS — MISSION 21 : dernier préflight réel avant livraison

**Date : 9 novembre 2026.** Branche indépendante `audit/celebrations-mission-21-final-preflight-20261109`, issue de M20. **Aucun déploiement, aucun changement de DNS, aucune écriture D1/R2, aucun contenu privé téléchargé dans les rapports.**

## 1 — Constats factuels et preuve de CI

**[GitHub Actions M21 #42616087907](https://github.com/ludodulac/Celebrations/actions/runs/42616087907) : SUCCESS**, sur le commit `efb87204ab66c7bfd3310a7e181b967ea28d6c54`, pour tous les appels READ/LIST/GET et la vérification du périmètre. L'ancienne preuve SHA des médias n'a volontairement **pas** été recalculée (gain de temps et aucun transfert d'environ 767 Mo). Les premières exécutions ont échoué parce que la méthode historique présumait que Supabase hébergeait encore les 158 objets ; elle a été adaptée à la suppression effectivement autorisée fin octobre, sans modifier les données.

### Stockages — vérité actuelle (pas l'ancien plan)

- **Supabase Storage, bucket `celebrations-media` : 0 fichier, 0 octet.** Le dépôt possède un ancien workflow de suppression explicitement autorisé par le propriétaire le **28 octobre 2026**. L'ancienne source Supabase **ne constitue donc plus aujourd'hui une copie indépendante** des 158 médias migrés.
- **R2 staging `celebrations-exit-staging` : 193 objets au total**, y compris les médias d'origine, la nouvelle pièce jointe éditoriale et les archives privées chiffrées.
- **R2 production `celebrations-exit-production` : 122 objets, 768 179 248 octets**. Ces **122/122 objets** ont une clé et une taille identiques à ceux de staging ; **0 absent et 0 conflit de taille**.
- En octobre, le transfert initial comptait 121 médias, 766 989 338 octets, contrôlés par SHA-256. Le nombre de production a évolué depuis à 122. **La vérification actuelle est un contrôle de noms internes et tailles, PAS un nouveau SHA-256 des fichiers.**
- **Les deux copies R2 se trouvent dans le même compte Cloudflare.** Les conserver est utile, mais cela ne remplace pas une archive sur un autre service/support.
- M19 : disponibilité HTTP confirmée de **113/113 médias publics et 9/9 PDF historiques**, ce qui ne valide pas les octets de tous les objets ni leur sauvegarde externe.

### Site réel et sécurité des brouillons

Requêtes HTTP GET en lecture seule le **9 novembre 2026 vers 12:20 UTC** (avec un identifiant de célébration valide `101` ; les corps de réponse privés ne sont **pas** lus ni consignés).

| Hôte | Page d'accueil | GET privé sans cookie |
| --- | --- | --- |
| Domaine officiel `ronde-des-archanges-universelle.eu` | HTTP **200** | HTTP **401** |
| Domaine officiel `www` | HTTP **200** | HTTP **401** |
| Staging historique `celebrations-exit-staging.rondes.workers.dev` | Non contrôlée dans ce run | **HTTP 200** |
| Aperçu `celebrations-visual-candidate.rondes.workers.dev` | Non contrôlée dans ce run | **HTTP 200** |

**C'est un blocage de confidentialité réel.** La version de code M14 introduit la protection d'accès au GET privé sur les aperçus et hôtes officiels, mais ce résultat HTTP montre que **les versions de test actuellement déployées ne garantissent pas cette protection**. Un 200 ne démontre pas, à lui seul, que chaque champ privé soit non vide ; toutefois le code du gestionnaire de lecture renvoie les plans, pages partagées et métadonnées des médias et ne demande pas de session sur les hôtes de test historiques. **Ne pas y saisir de contenus confidentiels tant que leur accès n'est pas fermé et retesté.**

### Worker officiel

Le Worker `celebrations-exit-production` est toujours sur le déploiement `cd46e1ba-e106-4f03-90aa-7110628a5b9f`, version `dcda4193-1d82-4283-9f0e-ae8a09e6a444`, vérifiée en lecture seule le 9 novembre à 12:20 UTC. **Son bundle complet, ses assets, ses bindings et un essai de retour arrière exact n'ont pas été archivés/testés** par cette mission. L'observation de l'ID n'est pas un point de restauration complet.

## 2 — Seulement les actions restantes qui servent à livrer

**Priorité 1 — confidentialité des hôtes de test.** Fermer ou authentifier `GET /api/editor-open-draft` sur l'ancien staging et le candidat; vérifier HTTP 401/403/404 sans cookie. Il faut un plan de déploiement sûr pour ces hôtes et une vérification de non-régression du système de test. Ce correctif ne doit pas casser ni modifier le domaine officiel.

**Priorité 2 — retour arrière concret.** Conserver la version exacte et sa configuration Worker/assets ; répéter la restauration isolée, vérifier les anciennes URLs et les accès de session. Ne pas utiliser l'ancien workflow de rollback qui repose sur un commit historique obsolète.

**Priorité 3 — sauvegarde indépendante hors Cloudflare.** Les JSON éditoriaux M19 et données D1 M20 sont chiffrés dans R2, restaurés en mémoire, mais sans copie externe. Les 122 médias production sont actuellement présents dans staging par clés/tailles ; aucun des 122 octets n'a été sauvegardé sur un autre fournisseur dans cette mission. Avant publication risquée, faire une copie chiffrée privée externe puis en répéter la lecture, sous l'autorisation du propriétaire, sans placer de contenu privé dans les artifacts d'un dépôt public.

**Priorité 4 — vérification utilisateur.** Une fois 1–3 attestés, tester le compte administrateur en environnement isolé, les sauvegardes, un cas de brouillon, les médias, les routes publiques et le fonctionnement mobile puis obtenir un accord distinct pour publier un commit précis.

Aucune amélioration esthétique ou restructuration du logiciel n'est nécessaire dans cette phase.

## 3 — Décision livraison cet après-midi

- **Domaine officiel actuel : accessible en HTTP 200**, accès privé sans cookie refusé 401 ; dernière vérification réelle M21.
- **Refonte des missions M05–M21 : sur branches GitHub DRAFT, non publiée**, malgré 247 tests Node et la recette Chromium réussis en M18.
- **Ne pas fusionner ni lancer l'ancien job de publication maintenant** : l'exposition des brouillons sur les hôtes de test, le manque d'archive indépendante et l'absence d'essai de rollback sont vérifiés. 
- Le propriétaire peut **présenter la version actuelle du domaine officiel**, à condition de ne pas annoncer que la refonte est publiée. Une recette administrative réelle reste nécessaire pour promettre un comportement d'édition conforme sur le site livré.

**Conclusion M21 : diagnostic terminé, deux copies Cloudflare des 122 objets confirmées par métadonnées, source Supabase supprimée, confidentialité staging/candidat déficiente. Avis de publication de refonte : NO-GO.**

La PR reste DRAFT, sans fusion ni déploiement. La suite utile est une **correction de sécurité ciblée, non une nouvelle mission d'optimisation**.
