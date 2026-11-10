# CÉLÉBRATIONS — M008-C : contrôle serveur des accès privés

**Statut : préparation isolée, NON BRANCHÉE et NON DÉPLOYÉE.**
Base : `c976791835fc5f1d7d2c37123face418d0501ca6`.
Branche : `feat/celebrations-m008c-private-server-access-20261110`.

## 1. Examen de l'authentification existante

- `migration/cloudflare/auth-api.mjs` fournit `authorize(request, env, false)` :
  session **participant** via `Authorization: Bearer <token>`, hachage SHA-256
  de l'aléa, lecture D1 `celebrations_participant_sessions`, expiration
  contrôlée côté Worker. Un jeton de navigateur n'est pas une preuve tant que
  cette consultation côté serveur n'a pas réussi.
- Les sessions **administrateur** utilisent la table distincte
  `celebrations_admin_sessions` et `authorize(..., true)` :
  elles ne confèrent JAMAIS les droits de membre.
- `celebrations_participants.audience` et `celebrations_groups` sont des
  classifications historiques et non des `member-type:...` (M002/M007-A).
- `resolveVerifiedMember()` recoupe la session valide avec un participant
  encore enregistré (`password_hash IS NOT NULL`) et le **person:id permanent**
  de `celebrations_directory_people`, par e-mail normalisé en base.
  Un échec de correspondance refuse l'accès, sans créer de personne ni compte.
- Ni la requête, ni les champs de formulaire, ni `localStorage`, ni la
  traduction, ni un cookie d'admin ne déterminent un type ou une inscription.

## 2. Service créé

`migration/cloudflare/app/security/member-private-access.mjs`

API préparée, utilisable uniquement côté serveur Cloudflare :

- `resolveVerifiedMember(request, env)` : session participant + identité
  permanente validée. Renvoie `null` si non authentifié ou non relié.
- `handlePrivatePage(request, env, {pageId, loadPublishedPage,
  loadPublishedSpace, render})` : charge une page **canonique publiée**
  depuis un dépôt sûr, récupère les types actifs et inscriptions depuis D1,
  délègue la décision à **`canAccessPage` du moteur M002 existant**.
  Le rendu n'est appelé qu'après autorisation.
- `handlePrivateMedia(request, env, {pageId, mediaId, loadPublishedPage,
  loadPublishedSpace, loadPrivateMedia})` : même contrôle de page avant
  la lecture des octets R2. Le média doit appartenir à cette page, être
  marqué `visibility: 'private'` et avoir un chemin serveur
  `private-members/...`. Lecture exclusivement dans
  `PRIVATE_MEMBER_BUCKET` (nouveau binding R2 **privé**, sans URL publique).
  PDF/documents servis en pièce jointe; aucun lien direct public ni clé
  fournie par le navigateur ne tient lieu de permission.
- `allowedPrivatePageIds(request, env, ids, loaders)` : pour recherches,
  menus, navigation, variantes linguistiques et listes, ne renvoie que les
  identifiants **autorisés**. Les contenus localisés, les extraits de recherche
  et les métadonnées ne doivent être récupérés qu'**après** ce filtrage.
- `privateNotFound()` : refus générique 404 identique pour visiteur sans
  session, mauvaise catégorie, type désactivé ou inscription absente.
  Les défauts d'infrastructure renvoient 503 générique, sans détail SQL.

Le service ne construit pas un second système d'autorisations. Il ne modifie
**aucune** route, schéma ou module des missions M008-A et M008-B.

## 3. Correspondance M008-B / D1

Les lectures serveur sont fondées sur le schéma ADDITIF M007-A encore non
déployé, sans modifier sa migration et sans faire de D1 write :

| Fonction | Source de confiance |
|---|---|
| Identifier une personne | `celebrations_participant_sessions` + `celebrations_participants` + `celebrations_directory_people` |
| Types détenus | `celebrations_directory_person_types` joint `celebrations_directory_member_types` (`disabled` vérifié) |
| Invitations individuelles | `celebrations_directory_private_space_enrollments` joint `celebrations_directory_private_spaces` et `celebrations_directory_person_celebrations` |
| Politiques pages et espaces | Chargeurs serveur de **révisions publiées canoniques**, pas les champs du navigateur |
| Fichiers privés | Métadonnées de médias canoniques côté serveur + binding R2 séparé |

**Raccordement à faire avec M008-B** : confirmer les noms de colonnes et les
indices réellement créés par son adaptateur, privilégier son API de lecture
des identifiants/associations si elle fournit les mêmes garanties, puis faire
les tests intégrés sur une D1 de préproduction. Il n'existe actuellement
aucun lien implicite entre l'e-mail de connexion historique et la personne
M007-A si le répertoire n'est pas alimenté : le refus est normal.

Pour `loadPublishedPage` et `loadPublishedSpace`, l'appelant doit lire la
révision `published` sauvegardée côté serveur et vérifier les IDs; il ne
doit pas passer les brouillons M007-B ou une copie transmise par le client.
Le schéma M005 représente `celebrationId` en chaîne numérique canonique
(ex. `'43'`) tandis que D1 attend l'entier `43`.

## 4. Conditions OBLIGATOIRES avant toute activation de route privée

1. **Aucun contenu privé dans le rendu public existant.**
   Auditer/corriger `publicSnapshot()`, `publishedMedia()`,
   `handleEditorPublication`, `handleTrialSite`,
   `loadSevenStageContent` et les seeds HTML
   `window.__TRIAL_SITE_SEED__`. Ils filtrent aujourd'hui surtout
   l'état de publication, pas les nouveaux droits M002.
   **Ne pas publier de nouvelles pages privées tant que ces sorties ne sont
   pas redéfinies côté serveur**. Une simple dissimulation CSS ou JS est
   insuffisante.
2. Les routes directes (pages, médias, PDF, traductions, recherches,
   API, exports et prévisualisations) doivent toutes passer le garde
   **avant** de lire/rendre/répondre; une page dans un espace privé nécessite
   son inscription personnelle **et** la politique des types. Ne jamais
   présumer qu'un lien non affiché est inaccessible.
3. Auditer `public-data-api.mjs` et `media-gateway.mjs` :
   leur ancien filtrage `audience=all/angel/nonangel`, la liste des médias
   publics approuvés et leurs URL historiques **ne protègent pas**
   les nouvelles ressources privées. Bloquer l'import/publication
   automatique de ressources `private-members/` dans ces chemins et dans
   `/media/new/`, `/letter/`, `env.ASSETS` et toute URL R2 directe.
   Le nouveau binding `PRIVATE_MEMBER_BUCKET` doit être non public et
   distinct; ne jamais servir son contenu avec `MEDIA_BUCKET`.
4. Insérer l'autorisation **avant** la traduction ou projection : aucune
   traduction, nom de page, titre, image, extrait de recherche, index sitemap,
   navigation, compteur, lien ou réponse d'erreur ne doit révéler une page
   interdite. Vérifier les pages privées d'une célébration dupliquée :
   aucune inscription n'est héritée.
5. Forcer `Cache-Control: private, no-store`, `Vary:
   Authorization, Cookie`, `X-Robots-Tag`, `nosniff` et pas de 304/ETag
   pour les réponses privées (le service applique ces protections).
   Interdire le cache CDN/edge et le préchargement/service-worker public
   **avant** de les exposer.
6. Migrer les tables M007-A, faire les lectures/écritures d'association
   via l'adaptateur M008-B, alimenter des personnes de test, provisionner le
   bucket privé et des médias publiés test, vérifier les révocations entre
   requêtes, renouvellements de session, restauration D1/R2 et nettoyage.
7. Seulement après audit transversal, ajouter les routes Worker
   explicitement testées (aucune route n'est créée par cette mission),
   sans confondre admin et membre, puis passer la revue de sécurité avant
   un éventuel déploiement séparé, sur validation du superviseur.

## 5. Tests automatisés / limites

`tests/test_m008c_private_server_access.mjs` utilise un simulateur D1,
le vrai vérificateur de session `authorize` et les vraies règles
`canAccessPage`; exécution `node --test` dans GitHub Actions M008-C.

Vérifie visiteur non connecté, jeton forgé/expiré, compte non relié,
mauvais type, type supprimé/désactivé, absence d'invitation, refus
de l'URL directe, page brouillon, traductions et permissions client
forgées, types autorisés, espace privé à accès sur invitation, PDF
privé, révocation immédiate, en-têtes anti-cache, HEAD/405, erreurs
D1 sans fuite, listes/recherches, absence de branchement du Worker.

**Limite importante :** ces tests sont isolés; ils ne prouvent PAS encore
l'étanchéité de la publication publique réelle, du bucket R2 en production,
de D1 migrée, ni des autres branches M008-A/M008-B. Pour l'instant la sécurité
repose aussi sur le fait de **ne pas activer** les routes privées.
