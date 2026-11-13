# M030 — plan de réalisation par 16 missions (13 novembre 2026)

Chaque mission a **un résultat vérifiable** et un compte rendu court avant de passer à la suivante. Il n'y a **aucun déploiement automatique** des étapes intermédiaires. Le propriétaire demande un code simple et maintenable, sans duplication de logique ni rustines. Les accès au site officiel restent en lecture seule jusqu'à la mission de bascule finale, sauf autorisation explicite d'opérations déjà spécifiées.

| Mission | Livrable concret | État |
| --- | --- | --- |
| **01 — Inventaire** | Lecture seule D1/R2, identité Michaël 2026 à conserver, liste des doublons, références historiques | **TERMINÉE** |
| **02 — Règles uniques** | Contrat de 14 cycles / 56 emplacements ; aucune date imposée ; unicité version = audience + langue ; sans catégories configurées, pas de création de nouvelles versions | **EN COURS** |
| **03 — Sauvegarde/restauration** | Procédure de sauvegarde vérifiable D1/R2 et plan de retour arrière, sans toucher à la production | À faire |
| **04 — Plan de nettoyage exact** | Liste détaillée des objets, liens et dépendances à retirer ; Michaël 101 et fichiers partagés protégés | À faire |
| **05 — Répétition du nettoyage** | Exécuter l'effacement uniquement sur une copie isolée, comparer les données avant/après | À faire |
| **06 — Identité unique côté D1** | Index/contrainte d'unicité sur archange + cycle après nettoyage ; tests de créations concurrentes | À faire |
| **07 — Calendrier 14 cycles** | 56 emplacements 2026–2039 dérivés d'un seul modèle, non 56 séries de pages vides | À faire |
| **08 — Visibilité** | Célébrations futures masquées par défaut ; anciennes masquables ; D1/R2/publication cohérents | À faire |
| **09 — Retrait de la création libre** | Supprimer les formulaires ET routes serveur permettant des célébrations hors catalogue | À faire |
| **10 — Duplication interne** | Nom distinct demandé immédiatement, puis audience et langue ; tout reste dans la célébration mère | À faire |
| **11 — Catégories** | Si aucune catégorie n'est définie, création de versions bloquée ; catégories réelles uniquement | À faire |
| **12 — Unicité des versions** | Rejeter sur le serveur toute deuxième combinaison audience + langue, même avec un nom différent | À faire |
| **13 — Brouillons et accès** | Toute copie est brouillon ; aucun droit attribué ou publication héritée ; tests de confidentialité | À faire |
| **14 — Retrait des dates du mercredi** | Supprimer les invitations à saisir une date et calculs de dates automatiques, garder les textes rédigés | À faire |
| **15 — Présentation visiteurs** | Une entrée par célébration, bonne version selon langue et accès, rubriques d'années repliables | À faire |
| **16 — Contrôle final et bascule** | Tests de régression, navigateur M016, sauvegardes vérifiées ; nettoyage contrôlé puis livraison officielle avec retour arrière | À faire |

## Résultat confirmé de la mission 01

- Site officiel observé à la version Worker `76f31003-53b1-436f-ab6d-3217b05c91c3`.
- **7 identités D1** : Michaël 2026 IDs **101 (active, publiée)**, **105 et 106** (brouillons) ; Gabriel 2026–2027 **102** ; Raphaël 2027 **103** ; Ouriel 2028 **104** ; Gabriel 2027 **107**.
- **101 doit être conservé** avec ses 8 pages et sa visibilité publique. Les 6 autres identités ne sont pas encore supprimées.
- **Dépendances D1** : 101 a notamment 9 439 événements de clic, 62 événements, 23 liens, 7 étapes, une association à un membre, une clôture de publication privée ; 102, 103 et 104 possèdent chacun 7 étapes. Le nettoyage devra vérifier les dépendances avant suppression.
- Le snapshot R2 possède **4 pages générales** (dont une seule publiée), à préserver ; Michaël 106 a une traduction non publiée, Gabriel 102 a 1 page publiée. Tout cela doit être sauvegardé pour éviter une perte cachée.
- Audit effectué en **lecture seule**, GitHub Actions [identités](https://github.com/ludodulac/Celebrations/actions/runs/43408187887) et [références](https://github.com/ludodulac/Celebrations/actions/runs/43408931671).

## Mission 02 : état réel au moment de la création du tableau

Un module unique `app/domain/celebration-cycle-registry.mjs` et des tests dédiés existent sur cette branche. Le serveur est en chantier pour refuser les nouvelles créations libres. **Les régressions ne sont pas encore toutes vertes** : une ancienne épreuve `M012C` supposant qu'une célébration distincte pouvait être dupliquée reçoit maintenant HTTP 400, et des tests de l'aperçu public hérités de la branche échouent sur HTTP 404. Tant que ces désaccords ne sont pas résolus sans affaiblir la sécurité, mission 02 non terminée et aucun déploiement.
