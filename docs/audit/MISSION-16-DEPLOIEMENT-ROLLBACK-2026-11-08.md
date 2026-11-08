# 🌸 CÉLÉBRATIONS — Mission 16 : déploiement et retour arrière

**Date :** 8 novembre 2026. **Branche :** `refactor/celebrations-mission-16-release-rollback-20261108` dérivée de M15/PR #95. **PR DRAFT ; zéro déploiement, zéro écriture D1/R2.**

## Constat vérifié

La mission 03 avait découvert une divergence entre la version du Worker officiel observée le 7 novembre (`7cbfdbd...`) et l'ancien commit GitHub `94affae...` inscrit dans le workflow de publication. Ce workflow reconstruisait un prétendu retour arrière depuis **trois fichiers d'éditeur très anciens** et relançait un `wrangler deploy`. Un tel « rollback » **ne restitue pas nécessairement le Worker exact ni ses dépendances, assets, bindings, routes, secrets ou réglages**.

La sauvegarde privée chiffrée réalisée en M03 ne contient que **le JSON éditorial à la révision 114**. Elle ne contient ni l'intégralité de la base D1 actuelle, ni les octets de tous les médias historiques et nouveaux, ni une copie indépendante de Cloudflare. Ces lacunes demeurent **des conditions bloquantes**.

## Changements réalisés en mission 16 (code, hors production)

1. **Blocage du vieux workflow dangereux sur cette branche.** Le job historique de `celebrations-publish-visual-site-once.yml` est conditionné à `false`, le retrait de la récupération depuis `94affae...` est explicite et son ancien rollback automatique est remplacé par un **arrêt signalant l'absence de version précédente certifiée**. Il ne déploiera rien depuis la branche M16. **Important : tant que cette PR n'est pas intégrée à sa branche source, l'ancienne version du workflow reste inchangée ailleurs**. Ne pas prétendre que cette seule modification désactive les autres workflows déjà publiés.
2. **Modèle de release strict** dans `app/release/editor-release-policy.mjs` : le déploiement actif du Worker Cloudflare est identifié par le **vrai identifiant de déploiement et de version**, avec 100 % du trafic sur une version unique. Une autre version active, ou un autre identifiant, bloque l'opération.
3. **Lecture API Cloudflare sans modification** dans `scripts/mission16_capture_worker_readonly.mjs`. Il ne fait qu'un GET du déploiement du Worker `celebrations-exit-production`. Les identifiants de version doivent être capturés à chaque future release ; **un commit Git ne suffit pas**. Aucun secret n'est écrit dans les fichiers ou les logs.
4. **Préflight de preuves** dans `scripts/mission16_release_preflight_readonly.mjs` : refus systématique si une seule preuve obligatoire manque, est ancienne, ou diffère. Critères obligatoires : preuve de restauration du **bundle exact de Worker sur candidat isolé** (hachage du bundle + assets + configuration), sauvegarde chiffrée R2 et copie indépendante relue, JSON éditorial exact et ETag stable, export intégral des tables D1 avec restauration dans SQLite isolée (intégrité, clés étrangères et compteurs), archive indépendante de **tous les octets médias** avec empreintes et chemins historiques, validation explicite du propriétaire. Le préflight reste **uniquement une validation** : aucun déploiement automatique n'y est implémenté.
5. **Plan de rollback exact et non exécuté** : il énonce `wrangler rollback <VERSION_ID> --name celebrations-exit-production --message ...` seulement si l'identité de la nouvelle version encore en ligne correspond à la version qui vient d'échouer et qu'un propriétaire a donné son accord. Ce retour arrière du Worker ne **restaure pas les données D1/R2** et n'est pas automatiquement exécuté par le script.
6. **Une matrice unique des tests M05–M15**, extraite dans `scripts/mission16_editor_regressions.mjs` afin d'éviter la duplication des longues commandes dans le nouveau workflow M16.

## Recommandation pour un futur déploiement (non exécutée)

**Phase A — vérification initiale** : conserver et identifier exactement le Worker actuel, ses assets/config/bindings, la base D1, l'objet éditorial et tous les médias par inventaire et empreintes. Le propriétaire doit conserver une archive chiffrée hors Cloudflare et en éprouver la restauration indépendante.

**Phase B — répétition isolée** : tester la **version précise actuellement publiée** sur un candidat Worker sans domaine public ni écriture aux données réelles. Réimporter l'export D1 dans une base SQLite isolée, comparer la structure et chaque table ; relire chaque média restauré pour prouver que les liens originaux sont récupérables.

**Phase C — décision propriétaire** : publier uniquement après preuves complètes, revue des tests de référence (M02) et autorisation explicite à une release **précise**, indépendante des autorisations des missions de nettoyage.

**Phase D — surveillance et éventuel rollback** : si un problème survient, vérifier qu'aucune autre release n'est intervenue, obtenir l'accord de retour arrière, et réactiver l'**ancienne version Cloudflare exacte**, sans employer un commit historique choisi arbitrairement. Réexaminer séparément D1 et R2 si les données ont changé.

## Blocages encore ouverts

| Protection | État à ce stade |
|---|---|
| Identifiant exact du Worker réellement actif | **RELEVÉ en lecture seule le 08/11/2026 à 20:51 UTC ; à revérifier immédiatement avant release** |
| Bundle Worker complet archivé (scripts, assets, bindings) | **NON RECONSTITUÉ / NON CERTIFIÉ** |
| Rejeu de l'ancien Worker exact sur candidat isolé | **NON EXÉCUTÉ** |
| Archive JSON éditeur actuelle et copie hors Cloudflare | **NON CERTIFIÉ** (M03 : sauvegarde chiffrée rév. 114, récupération en RAM uniquement) |
| Export complet récent D1 et restauration isolée avec relations | **NON EXÉCUTÉ** |
| Copie indépendante de tous les fichiers historiques et nouveaux | **NON CERTIFIÉ** |
| Approbation spécifique pour publier une version | **NON DEMANDÉE et NON ACCORDÉE** |
| Production du site / DNS / secrets / D1 / R2 | **INCHANGÉS** |

Une série de tests synthétiques pourra vérifier que les **contrats refusent les preuves insuffisantes**, mais ne saurait produire les preuves réelles à leur place. **Une CI verte n'autorise toujours PAS le déploiement.**

## Feuille de route

- Mission 17 : documentation cohérente et performances mesurées (sans mise en ligne).
- Mission 18 : recette générale, décisions séparées selon preuves de sauvegarde/restauration et tests utilisateurs.

**Ne pas fusionner cette PR ni enclencher un ancien workflow de déploiement pour tester la mission.**

## Annexe — lecture ponctuelle de l'identité réelle du Worker

Une nouvelle tâche GitHub Actions distincte, `worker-metadata-readonly`,
a été ajoutée. Elle ne s'exécute qu'avec le marqueur
`[M16_WORKER_READONLY_ONCE]` sur cette branche. Elle utilise la
configuration de secrets préexistante de l'environnement
`celebrations-staging` pour envoyer **un unique GET** à l'API
Cloudflare `/workers/scripts/celebrations-exit-production/deployments`.
Elle ne demande pas les octets de contenu ni n'effectue
de changement Worker, R2, D1, domaine ou DNS.

Les identifiants relevés, s'ils sont accessibles, ne prouvent pas
qu'une restauration exacte de cette version ait été répétée. Les
autres blocages de sortie restent inchangés.


## Résultats définitifs des contrôles — 8 novembre 2026

**[GitHub Actions M16 #42522240558](https://github.com/ludodulac/Celebrations/actions/runs/42522240558) : SUCCESS** sur la branche isolée. **Les deux jobs ont réussi.**

### 1. Identité réelle du Worker — Cloudflare API GET, lecture seule

Un appel **GET authentifié** à l'API Cloudflare a confirmé les métadonnées
du Worker officiel `celebrations-exit-production`, sans aucun déploiement :

| Métadonnée | Valeur observée |
|---|---|
| Worker | `celebrations-exit-production` |
| Identifiant du déploiement actif | `cd46e1ba-e106-4f03-90aa-7110628a5b9f` |
| Identifiant de la version active | `dcda4193-1d82-4283-9f0e-ae8a09e6a444` |
| Date de création du déploiement retournée | `2026-11-07T10:52:09.869361Z` |
| Date de constat réel | `2026-11-08T20:51:43.806Z` |
| Distribution de trafic | 100 % sur cette unique version |

**Preuve :** job `worker-metadata-readonly` de
[GitHub Actions #42522240558](https://github.com/ludodulac/Celebrations/actions/runs/42522240558).
Le jeton Cloudflare n'a pas été imprimé. L'identifiant exact ne fournit
pas une archive du code ou des assets : il faut également obtenir le
bundle complet et éprouver son réemploi sur un candidat isolé.
Ce constat n'est **pas un verrou permanent** : l'identité doit être
relue au moment exact d'une future opération.

### 2. Tests automatisés — succès isolé, pas certification des données réelles

- **37/37 nouveaux tests Node de politique M16**, dont rejets des
  sauvegardes manquantes, des copies indépendantes différentes, des
  données D1 et médias incomplètes, de la mauvaise version Worker, des
  dates périmées et d'une absence d'autorisation propriétaire.
- **205/205 tests Node de non-régression M05–M15**, lancés depuis
  l'unique matrice M16.
- **9/9 tests Python de restitution entièrement fictive en RAM** :
  SQLite avec table parent/enfant, index, intégrité, clés étrangères,
  inventaire média et empreintes des binaires historiques/nouveaux ;
  détection d'une table/ligne/index absent, d'un média supprimé et
  d'octets corrompus.
- **10/10 vues Chromium de référence administration**, 5 ordinateur
  et 5 téléphone, zéro erreur JS et zéro requête vers la production.
- Sélecteurs médias sur les deux largeurs, déplacement réel et Undo,
  site public sur les deux tailles, trois fenêtres (image/fichier/insertion)
  et alignement des colonnes : **PASS**.
- Captures temporaires conservées dans les artefacts GitHub Actions ;
  aucun fichier privé ni secret exporté.

### 3. Statut réel de sortie

**Mission 16 — préparation des garde-fous : exécutée et testée.**

**Autorisation de publication : NON.** Le vrai Worker actif est maintenant
identifié, mais sa **restitution exacte sur un Worker isolé**, le backup
transactionnel et la restauration de **l'intégralité de D1**, la copie
indépendante de **tous les binaires R2** et le test réel de reprise de
données restent **non attestés**.

Les 9 tests de récupération Python utilisent exclusivement des
**exemples synthétiques créés en mémoire**. Ne jamais les présenter
comme une restauration de la D1 actuelle ou des médias réels.

Le verrouillage de l'ancien publisher a été apporté à
**la branche/PR M16 uniquement** ; les déclenchements potentiels sur
d'autres branches existantes ne sont pas modifiés. **Ne pas fusionner ni
exécuter d'ancienne publication avant audit distinct et accord précis.**
