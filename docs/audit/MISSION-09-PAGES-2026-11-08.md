# 🌸 CÉLÉBRATIONS — MISSION 09
## Cycle de vie des pages, navigation et visibilité

**Date :** 8 novembre 2026 — branche `refactor/celebrations-mission-09-page-lifecycle-20261108` dérivée de M08 / PR #88.

### Réalisation
- Nouveau domaine `app/domain/editor-pages.mjs` : huit slugs historiques, sélection de page, groupes préservant l’ordre du document, création avec ID historique, règles de suppression autorisée, visibilité publique héritée, visibilité des célébrations, intentions de publication explicites et titres/IDs de nouvelles célébrations.
- Nouvelle application `app/application/editor-page-commands.mjs` : restauration/snapshot des pages communes, déplacement des pages générales dans leur ordre, analyse de suppression, suppression locale après confirmation serveur et marqueurs de pages supprimées.
- Branchement dans le **vrai éditeur** : navigation entre célébrations, création de pages, chargement des pages communes, menus latéraux, action Monter/Descendre, suppression protégée, publication et création de nouvelles célébrations.
- `removeCustomPage` garde **l’ordre de sécurité indispensable** : vérifier qu’une page peut être supprimée, demander confirmation, **masquer d’abord une page publiée via le serveur**, puis seulement la retirer localement si la réponse serveur est positive. En cas d’échec distant, la page reste présente.
- Aucun changement au HTML/CSS, aux messages affichés, à l’ordre de navigation ou aux URL publiques. Les pages historiques et les types/champs inconnus ne sont jamais convertis.

### Visibilité / protection
- Valeurs `draft`, `published`, `hidden` conservées : **une page explicitement masquée ou en brouillon ne devient pas publique**.
- Absence historique de `visibility` : garde le comportement existant `published` (ne pas forcer tous les anciens contenus en brouillon).
- Nouvelles pages et célébrations : `draft` d’origine ; la sauvegarde n’est pas la publication.
- Seules les nouvelles pages `neutral-<UUID>` ou `extra-<UUID>-<celebration>` sont supprimables par les contrôles de l’éditeur, jamais les huit étapes ou la page d’accueil historique.
- Suppression de la dernière page d’un groupe interdite ; le choix de page et l’accueil retombent sur une page conservée.
- Les marqueurs de suppression et les cartes de visibilité des célébrations sont conservés lors de la sauvegarde des pages communes.

### Compatibilité importante
Aucun déplacement de fichier R2, aucune migration D1, aucune API ou format de requête créé. Les actes `serverPublish`, `serverSave` et `save` restent dans leurs adaptateurs/contrôleurs actuels : l’extraction M09 **ne décide jamais de publier** par une simple lecture ou création.

### Contrôle
Le workflow M09 vérifie les plans de suppression, le refus de retirer une page publique si le serveur refuse de la masquer, les IDs/slugs, l’ordre des pages, les anciennes pages implicitement publiées, les pages explicitement cachées, la conservation des brouillons et les pages communes. Il rejoue les tests M05–M08 puis 10 vues Chromium ordinateur/téléphone, plus le sélecteur média.
Consulter le résultat GitHub Actions : **la présence du workflow ne signifie pas qu’il a réussi**.

### Ne pas déployer
PR en DRAFT. Les protections complètes de restauration Worker/D1/R2 et les backups indépendants identifiés en M03 restent à certifier avant toute mise en ligne. La mission 10 concerne les ports et adaptateurs de sauvegarde ; la mission 12, le rendu public.


## Validation finale du 8 novembre 2026

La validation de la révision de code `b9846fe17770778fd254baf6e545f1e1ae4ffd71`
est **SUCCESS** dans [GitHub Actions #42433375850](https://github.com/ludodulac/Celebrations/actions/runs/42433375850).

- **126 tests Node réussis, 0 échec, 0 ignoré** : nouveau modèle des
  pages et des célébrations, création en brouillon, ordre des pages et
  navigation, vieilles pages implicitement publiques, pages explicitement
  cachées, restauration du menu, suppression locale protégée par le serveur,
  préservation des pages et médias, tests M05–M08.
- **10 vues Chromium de référence réussies** : 5 ordinateur et 5 téléphone,
  0 erreur JavaScript et 0 requête de production observée.
- **Choix de fichiers image, PDF et vidéo confirmé** à 1280 et 390 pixels ;
  maintien de la page ouverte pendant le sélecteur.
- Test ciblé supplémentaire de suppression d’une page publiée :
  si le serveur refuse le masquage, **aucune page n’est supprimée**.
  Le test de réussite impose l'ordre « masquer sur le serveur, supprimer
  localement, enregistrer le brouillon ».
- Aucune migration de format, ni modification du Worker en production, des
  octets R2 ou des tables D1. Seuls les fichiers source de la branche sont
  concernés.

**Limite :** les captures et tests ci-dessus proviennent d'un environnement
isolé. Ils ne valent pas restauration complète des données réelles ni
certification de tous les parcours utilisateur. Les protections de rollback
et de sauvegarde identifiées en M03 restent bloquantes avant mise en ligne.
La PR n°89 demeure DRAFT.
