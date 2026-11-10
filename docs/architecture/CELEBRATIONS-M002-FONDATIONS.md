# CÉLÉBRATIONS — M002 : fondations types et autorisations

**Base :** branche fix/editor-m11-mobile-insert-dialog-footer-delete-20261110, commit 955041917597ad4d2a5deb21de8e641253c6621f.

**Périmètre :** module de domaine indépendant et tests. Aucune route, page, interface, table, donnée, ressource R2, liaison Cloudflare, configuration de secrets ni déploiement ne change.

## Modèle portable

- Le type personnalisable possède {id, name}. L'identifiant permanent est fourni par le futur service et commence par member-type: ; le nom est librement modifiable. Aucun type n'est précréé. Les noms ne servent jamais de références.
- La relation membre–type {memberId,typeId} est plusieurs-à-plusieurs ; la relation individuelle membre–espace est {memberId,spaceId}. Ces liens sont normalisables dans D1 sans dépendre d'un compte Cloudflare.
- Les pages ont une politique optionnelle {mode: PUBLIC | ALL_PRIVATE_TYPES | SELECTED_TYPES, typeIds?: []}. L'absence de politique et de rattachement à un espace signifie PUBLIC *pour la vérification des droits* des anciennes pages. Une politique explicite invalide est refusée.
- Les espaces futurs ont {id,celebrationId,visibility: PUBLIC | PRIVATE,accessPolicy}. PRIVATE exige une inscription individuelle vérifiée, en plus de sa politique de types. PUBLIC doit avoir une politique PUBLIC ; une page de cet espace peut néanmoins avoir une politique privée.
- Une page rattachée à un espace porte spaceId et celebrationId. L'accès à la page exige à la fois ses propres droits et les droits de l'espace correspondant. En l'absence de l'espace canonique, la page est refusée même si sa politique est PUBLIC.
- Le changement de langue est hors du modèle d'autorisations ; le contrôle s'applique à la page canonique *avant* la sélection d'une variante linguistique.

## Réutilisation des structures existantes

Le schéma D1 dispose déjà de celebrations_groups(id,name,sort_order,is_system), de celebrations_participants(email,...,audience) et des sessions des participants. Les colonnes id/name des groupes pourraient être réutilisées comme catalogue, **après vérification de leurs consommateurs**. Les valeurs historiques all, angel, nonangel ne sont **pas** considérées comme des types privés et ne doivent pas être promues automatiquement. Les liens plusieurs-à-plusieurs et inscriptions à un espace devront utiliser des relations D1 spécifiques (ou une structure équivalente vérifiée), pas détourner l'ancien champ audience. Aucune table n'a été créée dans M002.

## Frontières de sécurité à respecter lors des missions futures

1. Le Worker construit principal.authenticated à partir d'une **session serveur vérifiée**, jamais à partir d'une affirmation du visiteur. Il récupère types, associations, espaces et inscriptions à partir des données autoritatives D1.
2. Toute consultation directe de page, route, liste ou contenu privé est autorisée côté serveur **avant** que texte, identifiant de média, miniature ou fichier soit transmis. Les menus masqués ne constituent pas un contrôle.
3. Le modèle ne remplace pas le filtrage draft/published/hidden, la publication des célébrations, les versions R2, ni les vérifications de sessions administrateur.
4. Les médias privés demanderont un contrôle Worker/R2 à part entière ; ne jamais supposer que les routes actuelles /media/new/ ou les liens externes sont privés. Conserver sans modification /media/, /letter/, les URLs existantes, les anciens PDF et les objets R2.
5. Le document éditorial (pages, brouillons, versions publiées) reste dans R2. D1 doit conserver les futures associations relationnelles sans déplacer les pages. Les ETags et la logique de publication ne changent pas en M002.
6. Aucun identifiant de compte ou bucket Cloudflare n'est stocké dans le nouveau modèle. Pour un futur transfert : sauvegarde/export D1, duplication R2 exacte, réinitialisation sécurisée des secrets/bindings sur le compte cible, vérification des mêmes identifiants et décisions d'accès, puis seulement bascule autorisée. **Aucune migration Cloudflare n'a été exécutée.**
7. Avant activation, tester l'intégration API, les accès directs, les médias, la séparation brouillon/public et le rollback dans un environnement isolé.

## Tests

node --test tests/test_mission002_member_access.mjs

Les scénarios couvrent les trois modes, les membres multi-types, les refus, l'inscription individuelle, les pages internes, les langues, les anciennes pages publiques, la sérialisation, les références stables et l'absence de couplage Cloudflare.

**Activation : aucune.** Le nouveau module n'est importé par aucun Worker ou client public.
