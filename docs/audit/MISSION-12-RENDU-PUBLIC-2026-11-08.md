# 🌸 CÉLÉBRATIONS — MISSION 12
## Affichage du site public et séparation stricte des brouillons

**Date :** 8 novembre 2026. **Branche :** `refactor/celebrations-mission-12-public-renderer-20261108` à partir de M11 / PR #91. Aucun déploiement.

### Constat : deux fragilités réelles
1. Le navigateur public était initialisé par un GET serveur publié,
   puis **écrivait le résultat dans les mêmes clés localStorage**
   qu'utilisait l'administrateur pour ses brouillons locaux. Une consultation
   du site, dans le même navigateur, risquait donc d'écraser un travail
   non encore synchronisé.
2. Les images et couvertures locales présentes dans des **colonnes imbriquées**
   n'étaient pas trouvées par le préchargement, qui ne parcourait que les
   blocs à la racine.

### Corrections exécutées
- Introduire `app/domain/editor-public-visitor-model.mjs` :
  liste des pages serveur autorisées, filtrage supplémentaire des brouillons
  et pages masquées, parcours récursif des images/couvertures dans les colonnes.
- Le site lit la projection publique via `window.__PUBLIC_SITE_SNAPSHOT__`
  **en mémoire uniquement** ; la consultation ne lit/écrit plus
  `localStorage` et ne suit plus les événements de modifications locales de
  l'administrateur.
- En cas d'échec de `GET /api/editor-publication`, aucune page issue d'un
  brouillon local n'est rendue : **échec fermé**.
- Construire le script public de manière déterministe : une fonction ESM
  `createPublicVisitorModel` et le préchargement public sont composés sans
  `.replace()` au moment du traitement d'une requête.
- Préserver la logique de rendu actuelle : textes enrichis, titres, images,
  vidéos avec leur miniature et légende, audios, PDF, boutons, séparateurs,
  sections une/deux colonnes, menu visiteurs et styles CSS.

### Compatibilité et périmètre
- Le contenu visiteur reste issu de la projection `publicSnapshot` déjà
  filtrée par le serveur ; les données nouvelles ne sont **pas publiées**
  par la seule sauvegarde, et l'aperçu privé reste une fonctionnalité de
  l'administration distincte.
- Aucun changement des fichiers publics /media ou /letter, ni des buckets R2,
  de D1, du schéma des pages, des endpoints ou du CSS.
- Si une ancienne image publiée pointe uniquement vers un assetId IndexedDB
  local, elle reste limitée à ce navigateur tant qu'elle n'est pas transférée
  comme véritable fichier public sur le serveur : cette mission n'invente
  **aucune conversion de fichier**.
- M13 prend en charge l'extraction plus globale des styles. Ne pas élargir
  la présente mission à une refonte esthétique.

### Tests
Unitaires : publicSnapshot publié/masqué/brouillon, absence complète
d'écriture localStorage dans le script visiteurs, type de pages et images
imbriquées, modules sans réseau, composition CSP et rendu historique.

Navigateur Chromium (deux tailles) : texte riche, section à deux colonnes,
image redimensionnée, miniature et titre vidéo, séparateur, lien PDF,
menu visiteurs ; injection d'un brouillon local privé distinct et garantie
qu'il n'apparaît **ni à l'écran ni dans la projection publiée** ; conservation
des clés locales après visite ; appel GET public indisponible = aucun brouillon
affiché. Rejeu du parcours d'administration M02 et du glisser-déposer M11.

### Blocages de publication
Aucune fusion ni déploiement automatique. Les réserves de récupération M03
(Worker exact, sauvegardes D1 et médias R2, copie indépendante, rollback)
restent à prouver avant toute mise en ligne.


## Validation finale — 8 novembre 2026

**[GitHub Actions M12 #42438336958](https://github.com/ludodulac/Celebrations/actions/runs/42438336958) : SUCCESS**
sur la révision `46b1cc3ef93ddc60ca8be72e054971cb0756c824`.

- **157 tests Node réussis, 0 échec et 0 ignoré**, nouveaux contrats M12
  inclus, ainsi que les tests de non-régression M05 à M11.
- **10 vues de référence de l'administration réussies** : cinq sur
  ordinateur, cinq sur téléphone, sans erreur JavaScript ni requête de
  production.
- **Sélecteurs médias réussis** à 1280 et 390 pixels (image, PDF,
  vidéo), conservation de la page active.
- **Déplacement réel + Undo dans Chromium : PASS** (M11 non régressée).
- **Nouveau parcours du véritable site visiteurs : PASS sur ordinateur
  1280 px et téléphone 390 px** : deux colonnes, image à 55 %, PDF,
  vignette et légende vidéo, texte enrichi et trait de séparation.
- **Pages cachées et brouillons privés non affichés** ; injection d'un
  brouillon local volontairement différent du contenu publié et
  vérification de sa conservation **octet pour octet dans localStorage**
  après consultation du site. Un échec HTTP 503 de la lecture publique
  affiche une page non publiée plutôt que le brouillon.
- **Zéro requête d'écriture et zéro erreur JavaScript** dans les deux
  parcours visiteurs. Les images tierces de miniature vidéo sont
  interceptées/avortées pour ne contacter aucun serveur réel.

### Ajustements pendant la validation
Une ancienne assertion testait la simple présence du mot
`localStorage` dans un commentaire, et non un appel de lecture ou
d’écriture : elle vérifie maintenant les signatures d'API effectives.
Le premier parcours navigateur comptait également le GET d'une
miniature YouTube bloquée comme une requête de *sauvegarde* ; la
distinction GET externe/écriture a été corrigée **sans autoriser aucun
contact extérieur ni retirer les assertions de confidentialité**.

### Réserves
La validation est faite sur une base D1 simulée et des réponses
publiées fictives. Elle ne certifie ni les contenus réels, ni les
sauvegardes et restaurations du Worker, des bases D1 et des objets R2.
**La PR n°92 reste en DRAFT, aucune fusion ou publication.**
