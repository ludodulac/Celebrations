# 🌸 CÉLÉBRATIONS — MISSION 18 : recette générale et avis de publication

**Date : 9 novembre 2026.** Branche isolée `audit/celebrations-mission-18-recette-20261109`, créée depuis le **HEAD M17 vérifié** `0732142dad73c0a1db4b9224dc317f78f43d7cd9` (PR #97 en DRAFT, cible M16/PR #96).

## Objet et règle de sécurité

Recette finale **du candidat de refonte**, sans fusion de M05–M18, sans déploiement ni accès en écriture à Cloudflare, D1, R2, DNS, aux médias, aux pages ou à l'administration réelle. Les vérifications se déroulent uniquement sur fichiers du dépôt et données fictives dans GitHub Actions. Les résultats CI ne constituent ni une homologation du site vivant, ni une preuve de sauvegarde de ses données.

**Décision : NO-GO de publication à ce stade.** Cette mission produit un constat de qualité et de limites, et non une autorisation implicite de mise en ligne.

## 1 — Matrice de recette de la refonte

Les états « PASS historique » ci-dessous désignent des preuves déjà enregistrées sur le code ancêtre M17, à rejouer sur M18. Ils ne désignent pas un test manuel du site officiel.

| Domaine | Contrôle et preuve déjà disponible | État |
| --- | --- | --- |
| Navigation administration | 5 états × PC 1280 / mobile 390, 10 références Chromium M02, revalidées en M17 | PASS historique, **parcours manuel connecté réel non testé** |
| Blocs / colonnes / médias / fenêtres | Sélecteurs images, vidéos, PDF, réorganisation, Undo, styles et fenêtres M11/M13, CI M17 | PASS historique sur fixtures |
| Pages et célébrations | Création en brouillon, protection des pages historiques, ordre de navigation, suppression contrôlée, M09/M12 | PASS historique sur fixtures |
| Affichage visiteurs | Menus, textes, images, vidéo avec titre sous miniature, PDF, deux colonnes, séparateur, rendu PC/mobile M12 | PASS historique sur fixtures |
| Séparation privé/public | Brouillons absents des API publiques ; repli refusé en cas de 503 ; sécurité des routes candidats M12/M14 | PASS historique sur fixtures ; **ancien staging public reste à sécuriser** |
| Enregistrement / conflits | Révision et ETag, refus HTTP 409, non-écrasement et restauration côté tests M10/M16 | PASS historique sur fixtures ; **multi-appareils en conditions réelles non testé** |
| Performance | Équivalence exacte M16/M17, 247 Node + 9 Python, fusion média accélérée sur données fictives | PASS historique, aucune preuve d'accélération réelle du site |
| Médias et liens historiques | M03 : 113/113 médias et 9/9 PDF HTTP disponibles le 7 novembre ; M15 : contrats des routes historiques | PASS historique **daté**, pas une sauvegarde binaire ni un nouveau test public |
| Sauvegarde éditoriale | M03 : archive AES-GCM de la révision 114 en R2, relecture et restauration en RAM | PASS partiel ; **état actuel et copie hors Cloudflare non certifiés** |
| Sauvegardes D1, fichiers R2 et Worker | M16 : contrôles de refus en l'absence des preuves | **BLOQUANT — aucune restauration complète réelle certifiée** |
| Publication / retour arrière | M16 : préflight échoue si preuve absente ; workflow historique dangereux neutralisé sur branche de refonte seulement | **BLOQUANT — rollback de la version Worker exacte non éprouvé** |
| Compatibilité avec le site vivant | Dernière lecture du Worker le 8 novembre 2026 à 20:51 UTC ; les tests CI sont isolés | **NON DÉMONTRÉ actuellement** |

## 2 — Rejeu M18 : quelle preuve est permise ?

Le workflow `.github/workflows/celebrations-mission18-recette.yml` reprend sur la **branche M18** :
1. Garde Git : depuis le commit M17, seuls le rapport et le workflow M18 peuvent changer. Aucun fichier applicatif n'est modifié dans cette recette.
2. Tous les tests Node de protection M16, les tests M17 d'équivalence des médias, les régressions M05–M15, et les 9 tests Python de restauration **synthétique**.
3. Les scénarios Chromium M02, sélecteur de médias, glisser-déposer / Undo M11, rendu visiteurs M12 et style / fenêtres M13 sur 1280/390 px, avec jeu de données de test et sans production.
4. Contrôle du comportement « fail-closed » : une CI verte ne transforme pas les réserves de sauvegarde et d'accès en autorisation de publication.

**État de cette exécution : à compléter d'après les résultats réels GitHub Actions.** Il serait incorrect d'annoncer PASS avant qu'ils soient observés.

## 3 — Éléments encore nécessaires avant une décision distincte

**B1 — Version officielle récupérable.** Capturer le Worker actuellement déployé (version, code complet, assets, configuration, bindings), puis vérifier une reprise exacte isolée. L'identifiant de version lu lors de M16 ne suffit pas.

**B2 — Données éditoriales récentes, hors Cloudflare.** Exporter et comparer le snapshot R2 **actuel** sans interrompre les utilisateurs ; archive chiffrée externe indépendante, restaurée sur candidat isolé avec empreintes et vérification des versions. La copie M03 révision 114 est un instantané daté.

**B3 — D1 réelle.** Export transactionnel complet et récent, puis restauration isolée avec structure, clés, index, relations et comptages. Ne jamais écrire dans D1 officielle pendant la recette.

**B4 — Tous les fichiers.** Sauvegarder et restaurer les octets et chemins de **tous les médias historiques et nouveaux** et des PDF, pas seulement un inventaire ou des réponses HTTP HEAD.

**B5 — Confidentialité et essais utilisateur.** Décider du durcissement de `celebrations-exit-staging.rondes.workers.dev` (ancien GET privé accessible) et du traitement des fichiers `/media/new/<UUID>` non publiés ; faire une vraie recette connectée sur **environnement isolé**, enregistrer puis relire sur deux appareils, vérifier les conflits, menus, médias et pages sans toucher au domaine officiel.

**B6 — Revue et approbation du propriétaire.** Réunir les preuves précédentes, vérifier l'absence de déploiement concurrent et ne proposer qu'alors une publication de version précise et son retour arrière, **sur accord explicite et séparé**.

## 4 — Limitations et décision

- Aucune capture de production ni test manuel connecté, aucune écriture ou suppression de contenu réel.
- Aucune fusion automatique des PR n°81–97, ni de M18 ; aucune modification de `main`, du site officiel ou des autres branches.
- La présence de nombreuses PR DRAFT en chaîne ne signifie pas que la refonte est publiée ou utilisable en production.
- **Avis de publication : NON**, tant que B1–B6 ne sont pas documentés par des preuves actuelles et contrôlables.

Références de preuve : PR #82/M02, #83/M03, #89/M09, #90/M10, #92/M12, #94/M14, #96/M16, #97/M17 et GitHub Actions M17 #42538684571 (SUCCESS sur le HEAD M17). L'exécution M18 propre à cette branche doit être lue et mentionnée séparément.
