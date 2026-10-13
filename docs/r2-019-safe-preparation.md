# R2-019 — préparation sans effet public

## Inventaire des dépendances confirmées
- `supabase-data.js`: `supabaseMediaUrl` forme les URL publiques Supabase, `getMedia` télécharge les blobs, `openStoredFile` ouvre PDF et fichiers, `attachAudioPlayer` monte le lecteur audio.
- `public-library-simple.js`: galerie images et couvertures, `storagePath` / `coverStoragePath`, `URL.createObjectURL`.
- `public-resource-actions.js`: lecteurs audio intégrés et liens externes SoundCloud.
- `admin-supabase-core.js`: `putMedia` (signed upload / TUS) et `deleteMedia` (fonction `delete_paths`), tous deux Supabase.
- `admin-media-batch.js` et `admin-audio-batch.js`: appels à `putMedia`.
- `supabase-client.js`: client Supabase utilisé pour les données; ne pas rediriger les appels de base de données.
- Vérifier toutes les occurrences d'URL absolues, les liens externes et les autres références aux médias avant toute activation. Ne jamais réécrire les URL externes.

## Classification de sécurité obligatoire avant domaine public
L'inventaire technique de 158 objets ne prouve pas qu'ils sont tous publics. Réconcilier les clés R2 avec `celebrations_contents` (audience, source_type, storage_path, cover_storage_path) et les autorisations des groupes/événements. Classer chaque clé en PUBLIC / RESTRICTED / ORPHAN / UNKNOWN. Toute clé non explicitement PUBLIC interdit l'exposition publique du bucket entier. Ne pas publier les contenus privés par un domaine R2 non authentifié. Pour une exposition sélective, utiliser un Worker autorisant chaque requête, ou un bucket public distinct contenant uniquement les fichiers autorisés, sous validation explicite.

## Source selector
`scripts/r2-media-source-selector.js` est **inert** : aucun fichier public ne l'importe. Source initiale SUPABASE, bascule R2 impossible sans origine HTTPS explicite, `rollback()` immédiat vers Supabase. Un changement de source ne modifie ni fichiers ni métadonnées. Toute intégration au site doit faire l'objet d'une mission et d'une validation distinctes.

## Tests à exécuter après obtention d'une URL R2 de test autorisée
- HTTP GET et HEAD d'un MP3 public autorisé; Content-Type audio/mpeg, Accept-Ranges et requête Range bytes=0-1023 → 206 + Content-Range correct.
- Lecture, pause, seek avant/arrière sur Android Chrome/Brave et réseau mobile; confirmer durée et lecture complète.
- GET JPEG/PNG/WebP et PDF: MIME exact, affichage navigateur, cache et absence de blocage CORS.
- Depuis l'origine réelle du site: fetch cross-origin avec en-têtes autorisés, vérifier Access-Control-Allow-Origin (et Range/Content-Range exposés si lus par JS).
- Tester 404, 403, URL encodées, noms accentués, cache après ajout et après retrait logique.
- Ces tests ne sont pas exécutables avant la configuration autorisée d'une URL réelle et d'une sélection de fichiers PUBLIC.

## Synchronisation future
Après upload Supabase réussi, déclencher une file de synchronisation durable (idempotence par chemin + version/empreinte), lecture source puis écriture R2 **sans écrasement**, relecture R2 et SHA-256, puis marquer READY. Garder Supabase comme source tant que la nouvelle version n'est pas READY. Pour les suppressions, masquer immédiatement le média dans la base/affichage, bloquer sa publication R2 et créer une tombstone/version; ne jamais supprimer automatiquement un objet R2 dans cette phase. En cas de conflit de même chemin avec octets différents, arrêter et signaler. Réconcilier régulièrement inventaires, y compris nouveaux fichiers.

## Configuration Cloudflare nécessaire
1. Vérifier qui administre la zone DNS du domaine et que la zone est active chez Cloudflare.
2. Valider la classification PUBLIC des objets et le périmètre exact du bucket. Un Custom Domain R2 rend le contenu du bucket accessible publiquement : **ne pas activer** tant que la classification n'est pas achevée.
3. Préparer un sous-domaine dédié, connexion R2 Custom Domain dans Cloudflare, TLS et règles de cache appropriées. Si des objets sont privés, préférer un bucket public distinct ou un Worker avec contrôle d'accès.
4. Préparer CORS limité à l'origine réelle, GET/HEAD, en-têtes utiles; contrôler les réponses réelles après autorisation.
5. Tester uniquement des objets explicitement publics sur une URL de test. Ne pas utiliser r2.dev en production.

## Critères de passage
Aucun changement public, aucun changement DNS, aucun Worker payant, aucune suppression; PR reste DRAFT. Les tests unitaires du sélecteur ne certifient ni HTTP Range, ni Android, ni sécurité d'accès.
