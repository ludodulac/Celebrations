# CÉLÉBRATIONS — étape 020 : conserver seulement les ressources réellement accessibles aux visiteurs

**Décision explicite du propriétaire (21 octobre 2026)**

> Conserver intégralement les fichiers accessibles dans l'accueil, la préparation, le mercredi, le jeudi, le vendredi, le samedi, le dimanche, l'après-célébration et la médiathèque publique ; ne pas transférer vers la production les fichiers importés en administration qui ne sont jamais montrés aux utilisateurs.

Cette consigne annule l'hypothèse précédente « transférer automatiquement les 158 objets de Storage ». **158 est seulement la taille du bucket d'origine, pas le nombre des fichiers effectivement affichés.**

## Audit du site actuel : état constaté directement sur Supabase

Contrôle SQL en lecture seule des relations réelles avec la base d'origine :

- **158 objets Storage** dans `celebrations-media` (74 PDF, 41 MP3, 37 images JPG/PNG/WebP/GIF, 3 SVG, 2 WMA et 1 OPUS). Les textes peuvent aussi être stockés dans la base, sans fichier.
- **211 fiches de contenus** dans l'administration : **108 fiches liées** à des événements publiables, et **103 fiches non liées** aux événements ni aux étapes ; **0 relation dans `celebrations_step_contents`** au jour du contrôle.
- **2 fiches de catégorie Accueil** sont publiées indépendamment du programme.
- **75 fiches sont des candidates de la galerie d'images** : attention, le code de `public-library-simple.js` affiche **toutes les images et couvertures**, même quand elles ne sont pas affectées à un événement. Par conséquent, **un fichier non affecté dans l'administration peut néanmoins être visible aux visiteurs**. **44 candidates galerie ne sont liées à aucun événement** et ne doivent pas être supprimées à l'aveuglette.
- **153 fiches** appartiennent à l'union « programme / accueil / galerie » et **58 autres fiches** ne sont pas affichées par ces trois mécanismes. D'autres liens spéciaux ou fallback peuvent compléter les 153.
- Le programme actuel compte 11 rendez-vous de préparation, 11 mercredi, 14 jeudi, 11 vendredi, 8 samedi, 7 dimanche, et aucun rendez-vous encore configuré sous une clé `apres-celebration`. **Ne pas supprimer la section Après célébration** ni l'infrastructure pour accueillir ses publications futures.
- **9 PDF de comité** restent accessibles par des liens individuels `/letter/<slug>`. Ils ne sont pas listés dans les étapes publiques, mais **ils servent bien à des utilisateurs munis des liens** : les préserver à part jusqu'à clarification explicite.
- **23 liens de programme** comprennent 21 références `content:<id>` utilisées pour les illustrations spéciales. Une couverture ou image peut donc s'afficher même en dehors d'une relation `event_contents`.
- **37 des 158 objets physiques** n'apparaissent pas parmi les clés de fichiers/couvertures des fiches programme, accueil et galerie, ni dans les 9 PDF de comité. **Ces 37 sont à examiner**, et **pas à détruire automatiquement** : cela inclut 3 SVG sous le préfixe `tests/seed-2026-09-06/` et un ancien JPG dont les usages statiques ou historiques restent à vérifier.
- **Important : deux références de fiches liées aux événements semblent déjà cassées dans le bucket source :** couverture du PDF « Programme RA Universelle Michaël AN23 » et fichier « Pardon des Offenses — version raccourcie ». Ces objets ne se trouvent pas sous leur chemin déclaré dans le bucket. La galerie contient également des chemins historiques non retrouvés dans Storage. **Ne pas confondre une référence affichée avec un fichier effectivement accessible**. Résoudre/valider avant de certifier « aucun fichier public perdu ».

## Règle de protection désormais obligatoire avant la copie Cloudflare de production

1. **Protéger les fichiers des contenus liés aux événements et étapes**, pour toutes les célébrations qu'un utilisateur peut ouvrir (ainsi que les modes de groupe), quelle que soit leur forme — PDF, image, audio, vidéo, couverture.
2. **Protéger tous les fichiers des catégories Accueil et tous les visuels réellement affichés dans la galerie**, y compris les images actuellement non affectées à un rendez-vous.
3. **Protéger les illustrations référencées indirectement** par `celebrations_links.link_type=event-illustration` et les fallbacks codés en dur, ainsi que les images directement référencées dans l'HTML public.
4. **Conserver les PDF de comité distribués par liens individuels** tant que leur usage n'est pas explicitement abandonné.
5. **Analyser manuellement tout objet candidat à l'exclusion et vérifier les liens directs et les cas de navigateur** ; ne pas déduire qu'une simple absence de relation dans l'admin signifie qu'un fichier est invisible.
6. **Importer uniquement les ressources visiblement utiles et validées dans la nouvelle R2/D1 de production**. **Ne jamais supprimer les originaux du bucket Supabase ni les 158 objets du R2 staging** avant validation du site final, vérification des sauvegardes et accord explicite du propriétaire.

## Outil d'audit sans aucun effacement

`scripts/audit_public_only_media.py` parcourt les fiches Supabase, relations événements/jours, accueil, galerie, liens d'illustration, neuf invitations de comité et clés Storage, puis classe **agrégats protégés / candidats à examiner / références manquantes** sans afficher les chemins ni les données personnelles.

Un lancement spécifique `[PUBLIC_ONLY_MEDIA_AUDIT_ONCE]` exécute ce script uniquement depuis la branche migration, avec la clé Supabase **en lecture seule dans la pratique** (GET REST + POST de liste Storage) et aucune connexion Cloudflare. Il ne copie ni n'efface aucun objet.

**Ne pas créer encore de liste d'effacement automatique.** Publier le nombre exact de fichiers retenus et de candidats après audit, puis préparer une copie sélective avec contrôles exhaustifs et tests de navigation avant la bascule.

## Résultat réel de l'audit de sélection — 21 octobre 2026

GitHub Actions [run #39588866066](https://github.com/ludodulac/Celebrations/actions/runs/39588866066), job `public-only-media-audit` : **SUCCESS**.

Agrégats confirmés directement sur les tables et la liste Storage originales via les API Supabase (lecture seule) :

- 211 fiches source ; 108 liées au programme, 2 en Accueil, 75 candidates pour la galerie (certaines appartenant à plusieurs de ces groupes).
- **153 fiches** classées comme publiques à protéger via ces mécanismes.
- **121 des 158 objets physiques** sont protégés par au moins une référence du programme, de l'accueil, de la galerie, des images statiques, des illustrations spéciales ou des neuf invitations comité.
- **37 des 158 objets physiques** n'ont pas de référence identifiée par cet audit et sont classés **À EXAMINER**, pas « supprimables sans vérification ».
- **31 références de fichiers/couvertures protégées** ne correspondent pas à un objet présent sous leur chemin déclaré dans le bucket. Cela inclut les deux chemins rattachés à des rendez-vous déjà relevés (fichier d'un PDF et couverture d'un PDF) ; beaucoup d'autres sont des entrées historiques de la galerie. Ces problèmes préexistants doivent être distingués d'une perte de migration et vérifiés manuellement.
- **0 effacement, 0 écriture Supabase, 0 copie/écriture Cloudflare, 0 appel D1**. Aucun chemin de fichier, adresse ou contenu confidentiel n'est présent dans les journaux publics.

`SOURCE_STORAGE_OBJECTS=158`
`PROTECTED_PHYSICAL_OBJECTS=121`
`REVIEW_ONLY_PHYSICAL_OBJECTS=37`
`PUBLIC_CARDS_PROTECTED=153`
`MISSING_HISTORICAL_DECLARED_MEDIA_PATHS=31`
`SAFE_TO_AUTO_DELETE_REVIEW_OBJECTS=NO`
`PRODUCTION_SELECTIVE_COPY_ALREADY_EXECUTED=NO`
`LIVE_SITE_UNMODIFIED=YES`

**Décision de migration :** ne plus copier aveuglément les 158 fichiers dans la nouvelle R2 de production. Prévoir un manifest de conservation complet et révisé, valider les liens et affichages dans les 7 sections, l'Accueil et la Médiathèque, et copier sélectivement **après** revue des 37 candidats. Conserver les originaux Supabase et toutes les copies R2 staging tant que le nouvel environnement n'est pas certifié.
