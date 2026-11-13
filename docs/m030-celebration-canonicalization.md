# M030 — consolidation des célébrations (demande propriétaire du 13 novembre 2026)

## Règles métier

- **Une seule célébration** pour chaque couple (archange, cycle annuel). Gabriel couvre deux années dans le titre, mais sa clé est l'année de début.
- Préparer les **14 cycles 2026–2039**, soit 56 emplacements, les futurs toujours masqués par défaut. Ne pas instancier de pages vides en masse.
- Conserver uniquement **Michaël 2026**, une version publique française, lors du nettoyage officiel; ne pas détruire les autres données tant qu'un inventaire et des sauvegardes restaurables n'ont pas prouvé les cibles. Les pages générales, fichiers partagés, membres et associations doivent être préservés, ou supprimés uniquement si explicitement liés à une célébration supprimée et sans autres références.
- Le bouton « Dupliquer » crée **une version dans la même célébration** avec un **nouveau nom** obligatoire, un **public cible** et une **langue**. Une combinaison (public / tous les membres / catégorie réelle, langue) ne peut exister qu'une seule fois, même en brouillon; un nom différent ne contourne pas cette contrainte. Quand aucune catégorie n'existe, on n'invente jamais une catégorie fictive; Public/français déjà existant ne peut être dupliqué.
- Une nouvelle version est toujours **brouillon** avec publications et autorisations inchangées; ne jamais copier une inscription ni un droit. La version privée ne peut jamais devenir publique par duplication.
- Ne pas afficher plusieurs lignes « Michaël 2026 » au visiteur, seulement une célébration qui résout la langue et les droits des versions.
- Retirer toute demande obligatoire de **date du mercredi** et ses calculs automatiques. Les dates se rédigent manuellement dans les pages si nécessaire.
- La personnalisation de la page publique de liste des célébrations (images) est **hors périmètre**.

## Conception / sécurité

- D1 reste l'identité canonique des célébrations; R2 reste la source des pages, traductions et variantes. Pas de troisième catalogue concurrent.
- La contrainte d'unicité doit s'appliquer **côté serveur**, et idéalement en D1 par index UNIQUE une fois les doublons historiques purgés; jamais seulement en JavaScript navigateur.
- Un catalogue prévisionnel de 56 **emplacements virtuels** peut être calculé par une fonction déterministe; n'enregistrer une célébration réelle que lorsque l'administrateur l'ouvre pour la préparer.
- Pour chaque nettoyage : sauvegardes intégrales, audit des références, plan d'effacement exact, transaction/contrôle de révisions et vérification que le site officiel n'a pas été modifié par une autre personne. Interruption si la moindre incertitude.

## Déroulement isolé

1. Inventaire officiel **lecture seule** D1 + R2 (workflow `celebrations-m030-readonly-inventory.yml`).
2. Contrat métier unique et tests de non-doublon/années/langues/catégories.
3. UI et commandes côté serveur isolées, tests de compatibilité M029 / publication / membre.
4. Nettoyage des anciennes célébrations **après** validation du plan chiffré et sauvegardes.
5. Test Chromium sur M016, restauration et déploiement officiel protégé.

Aucune suppression officielle pendant l'inventaire.
