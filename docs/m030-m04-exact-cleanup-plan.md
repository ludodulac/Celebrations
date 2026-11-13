# Mission M030-04 — plan d'effacement précis, simulation **locale** uniquement

**État : simulation en cours.** Le chantier est limité au nettoyage de six célébrations historiques non désirées. Il n'utilise aucune connexion Cloudflare et ne supprime aucun fichier réel.

## Cibles déterminées par l'inventaire officiel M01

**Conserver :** `101` Michaël 2026 (seule célébration active/publique en français), ses 8 pages brouillon et 8 pages publiées, toutes ses données D1, références membre, clics, événements, liens, droits privés et historiques ; conserver aussi **toutes les pages générales**, paramètres du site, comptes, langues et médiathèque.

**Prévoir de retirer ultérieurement :** `102` Gabriel 2026–2027, `103` Raphaël 2027, `104` Ouriel 2028, `105` Michaël 2026 (copie brouillon), `106` Michaël 2026 (copie brouillon et traduction non publiée), `107` Gabriel 2027 (copie brouillon). Leurs pages et traductions ne seront pas transférées automatiquement.

## Vérifications indispensables — seulement en copie

- Déchiffrer **les sauvegardes existantes M03** depuis l'artefact GitHub de la mission 03, confirmer les empreintes SHA-256. Aucun nouvel export nécessaire.
- Réouvrir toute la base D1 dans un **SQLite en mémoire** et relever toutes les références directes et indirectes.
- Si le contenu est identique à l'inventaire validé, simuler exclusivement la suppression des 6 identités et des 21 étapes D1 dépendantes, **par une transaction locale annulée (ROLLBACK)**. Toute autre dépendance arrête la simulation.
- Simuler une copie du document R2 en mémoire : retirer les six enregistrements, les métadonnées et liens de visibilité propres, puis les seules traductions de pages qui leur appartiennent exclusivement.
- Contrôler par empreintes que Michaël 101, les pages générales, les publications, les membres et le catalogue média sont strictement identiques à la sauvegarde source.
- **Ne jamais supprimer les objets R2 de la médiathèque** : ils ne sont pas encore sauvegardés séparément. Toute référence résiduelle inconnue déclenche un blocage.
- Produire uniquement un rapport de compteurs sans noms de membres, texte de pages ni liens privés. Ne jamais publier les archives déchiffrées.

**Règle de passage :** Mission 04 sera considérée terminée si GitHub Actions retourne `M030_M04_LOCAL_CLEANUP_DRY_RUN_PASS` et un artefact de rapport sécurisé, sans écriture distante.

[Workflow M04 : simulation locale uniquement](https://github.com/ludodulac/Celebrations/actions/workflows/celebrations-m030-m04-local-dry-run.yml).

## Exécution isolée

Lancement protégé par message explicite : les données sont restaurées en mémoire, jamais sur les services officiels. Le rapport final ne contient que les compteurs et contrôles de conservation.

## Dépendance trouvée pendant la simulation (sécurisée)

La médiathèque conserve des **références d'utilisation** (`mediaCatalogue[].uses[].celebrationId`) pointant vers les anciennes célébrations. Leur présence est légitime dans la sauvegarde, mais deviendrait un lien obsolète après nettoyage. Le plan de simulation retire **uniquement les références d'utilisation vers les six célébrations supprimables**, jamais les fichiers eux-mêmes, leurs adresses de stockage, ni leurs utilisations par Michaël ou les pages générales. Le test conserve chaque élément média et compare le catalogue attendu par empreinte.

## Mission 04 — résultat final (13 novembre 2026)

**Réussite de la simulation sans écriture distante :** [GitHub Actions #43423239570](https://github.com/ludodulac/Celebrations/actions/runs/43423239570).

**D1 copie locale uniquement :** 6 identités et 21 étapes supprimées dans la simulation ; transaction annulée par ROLLBACK. Toutes les 33 autres tables et les 7 étapes de Michaël 101 sont inchangées ; clés étrangères valides.

**R2 copie locale uniquement :** suppression simulée des 6 brouillons secondaires, 3 métadonnées, 5 clés de visibilité/accès et 1 entrée de traduction de pages abandonnées. **269 associations d’utilisation de la médiathèque** pointant vers ces anciennes célébrations ont été détachées dans la copie : aucun fichier R2 supprimé, les **128 objets du catalogue** sont préservés ainsi que leurs autres associations.

**Conservation certifiée dans la copie :** Michaël 101 (8 pages brouillon, 8 pages publiées), 4 pages générales et 1 page générale publiée, membres et droits, registre des langues, médias et toutes leurs ressources de stockage. **0 écriture sur le site officiel**.

**Le nettoyage officiel n'est pas lancé.** Il faudra une nouvelle vérification des comptes et contenus avant d'appliquer ce plan aux données réelles.
