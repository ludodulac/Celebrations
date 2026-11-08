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
