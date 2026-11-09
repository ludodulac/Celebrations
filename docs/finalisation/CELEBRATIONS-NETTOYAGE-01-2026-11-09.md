# 🌸 CÉLÉBRATIONS — NETTOYAGE CIBLÉ 1/6 — adaptateur D1 historique

**9 novembre 2026.** Base : version officielle publiée et contrôlée en M5, commit `65caf8d5d03d29882d0de0c0d00cdcfc622e473e`. Branche : `cleanup/celebrations-01-adaptateurs-20261109`. **Aucune modification de Cloudflare ni du site officiel.**

## Problème démontré

Dans le fichier **`supabase-data.js`**, toutes les lectures de données D1 étaient formulées en faux chemins Supabase `/rest/v1/celebrations_*?select=*&order=...`, passés à une fonction `sbJson()` qui ne faisait qu'extraire le nom de table avant d'appeler `window.celebrationsStagingData(table)`. **Cette fonction n'envoyait déjà aucun HTTP à Supabase.** La traduction aller-retour inutile complexifiait la maintenance.

## Intervention précise

Dans ce fichier et aucun autre code applicatif, suppression de la fonction de traduction de faux chemin `sbJson`, remplacée par `readCloudflareTable(table)`, qui transmet directement les huit vrais noms des tables D1 au même adaptateur Cloudflare existant. La validation du nom de table et le message d'erreur « Cloudflare D1 indisponible » sont conservés. Le nom historique `loadStateFromSupabase()` reste volontairement inchangé : d'autres points d'entrée HTML/JavaScript l'utilisent. **Ne pas le renommer sans traiter ensemble les entrées HTML et les tests.**

Les anciens fichiers `supabase-client.js` et `preview-client.js` sont **toujours nécessaires** à l'interface HTML historique et au pont Cloudflare, et n'ont pas été supprimés aveuglément. Les transformations HTML pour construire la variante production restent, elles aussi, inchangées ; leur éventuelle simplification appartient au périmètre « code actif » de la mission suivante, après constat démontré.

## Tests réellement exécutés et preuves

**[GitHub Actions #42711481418](https://github.com/ludodulac/Celebrations/actions/runs/42711481418) — SUCCESS.**

- **5/5 tests nouveaux** : ancienne/nouvelle lecture des huit tables dans la même configuration synthétique, résultat JSON et ordre des appels strictement identiques, cas de base vide strictement identique, refus quand le pont Cloudflare manque, validation stricte des noms de tables.
- **14/14 tests de sécurité et Worker historique** : PASS.
- **205/205 tests de régression de l'éditeur** : PASS.
- **Vraie reconstruction de 96 fichiers du site** à partir du commit officiel précédent et du nouveau code : **95/96 identiques octet pour octet** ; **seul `supabase-data.js` diffère**, comme voulu. Les autres fichiers HTML, médias, CSS et JS générés n'ont pas changé.
- Audit du build : **aucun SDK, hôte ou chemin réseau Supabase**, aucun `tus-js-client` dans les fichiers publiables.
- **0 écriture D1, 0 écriture R2, 0 déploiement Worker, 0 DNS modifié.**

## Conclusion et limites

**Nettoyage 1/6 : TERMINÉ pour l'adaptateur D1 anciennement déguisé en REST Supabase.** Ce changement est prêt dans une **PR DRAFT, pas encore publié** sur le site officiel, qui conserve sa version stable. **Il ne prouve pas que toute la dette historique Supabase/Cloudflare a disparu :** des noms de compatibilité et le script de génération des pages restent et ont été explicitement conservés pour éviter toute régression.

Pour la mission 2, n'intervenir que sur **une simplification démontrée** du code actif, en préservant les mêmes données, pages et fonctionnalités et en comparant de nouveau la sortie du build avant/après.
