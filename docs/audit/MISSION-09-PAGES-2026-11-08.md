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
