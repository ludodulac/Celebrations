# CELEBRATIONS-R2-020 — audit d'accès médias (preuve partielle)

Date: 2026-10-12. Main vérifié: `58cd0d27cfcf08038e06fb583efcd39f9cfeb75d`. PR #33 base inchangée. Audit en lecture seule, sans activation R2.

## Résultat de classement (158 objets de référence)
| Classification | Nombre vérifiable |
|---|---:|
| PUBLIC_CONFIRMED | 0 |
| RESTRICTED_CONFIRMED | 0 |
| UNCERTAIN | 158 |

**Ces nombres expriment une absence de preuve par objet, pas la preuve que les 158 objets sont privés.** Les 158 chemins et leurs références SQL n'ont pas été récupérés dans cette session. Le connecteur Supabase expose uniquement trois projets (Boralog, La forêt enchantée, IN-SECT), et aucun n'est identifié de manière fiable comme la base Célébrations. Il serait dangereux d'interroger un autre projet par supposition.

## Éléments de preuve dans le code
- `supabase-data.js:8` charge les tables `celebrations_contents`, `celebrations_events`, `celebrations_groups`, les liens événements/étapes; `supabase-data.js:8-12` expose `audience`, `storagePath`, `coverStoragePath` dans l'état.
- `supabase-data.js:13` produit une URL directe `/storage/v1/object/public/celebrations-media/` pour chaque chemin relatif. `supabase-data.js:14` utilise cette URL pour télécharger le blob; `supabase-data.js:17-23` pour ouvrir fichiers et audios. Un lien public peut contourner un simple masquage UI.
- `public-v3.js:5` définit `audienceOk` selon `state.profile` et l'audience des contenus; `public-v3.js:13` filtre les contenus d'événements avec cette fonction. Il s'agit d'une condition d'affichage client, **pas d'une autorisation de lecture de l'objet**.
- `public-profile-gate.js:26-41` interroge la fonction `celebrations-audience` et valide un jeton participant avant d'appliquer le profil; le code du navigateur ne prouve pas que Storage vérifie ce jeton.
- `public-universal-mode.js:4-5` met le profil à `all` et remplace `audienceOk` par une fonction toujours vraie dans ce mode. Examiner où et quand ce script est chargé avant d'inférer une restriction effective.
- `public-library-simple.js:74-75,103` charge les images et couvertures par `getMedia`.
- `admin-supabase-core.js:15,39` utilise les fonctions d'administration et `delete_paths`; l'administration n'est pas équivalente à une autorisation de lecture publique.

## Données nécessaires pour une classification individuelle vérifiable
1. Export en lecture seule des 158 clés Storage (nom, taille), sans secrets.
2. Relevé des `celebrations_contents` (id, storage_path, cover_storage_path, audience, source_type, type) et de leurs relations événements, étapes, groupes; y inclure les fichiers non référencés.
3. Politiques RLS sur `storage.objects` et `celebrations_*`, visibilité du bucket, logique des fonctions `celebrations-audience` et `celebrations-admin-data`.
4. Vérification non authentifiée, puis avec comptes autorisés, de l'accès effectif à un échantillon de fichiers dans chaque classe. Éviter de rendre publics les chemins de contenus privés dans les logs.
5. Preuve documentée pour chaque objet: clé, type de référence, audience, politique de lecture effective, catégorie, motif. Les objets orphelins et toute contradiction sont UNCERTAIN.

## Décision de diffusion
Ne pas exposer le bucket complet par un domaine public R2 tant qu'un seul objet est UNCERTAIN ou RESTRICTED_CONFIRMED. Conserver Supabase et les URL actuelles. Options après audit: (a) bucket R2 public séparé avec copie autorisée uniquement des objets PUBLIC_CONFIRMED, et origine privée pour les autres; (b) Worker authentifiant chaque requête et appliquant l'autorisation côté serveur avant lecture R2. Un simple sélecteur côté navigateur n'est pas une barrière de sécurité.

## Restrictions de cette mission
Aucun changement public, DNS, bucket, objet, ni fusion. Cet audit de code n'est **pas** une certification d'accès des 158 objets.
