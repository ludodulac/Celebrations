# CÉLÉBRATIONS — mission 022 : accès R2 production par API Cloudflare officielle

**Motif :** [GitHub #39592339205](https://github.com/ludodulac/Celebrations/actions/runs/39592339205) : la sélection protégée est saine (**121 médias / 766989338 octets**) mais la clé S3 existante peut lire le bucket staging uniquement. Le contrôle `R2_PRODUCTION_BUCKET_ACCESS_DENIED` a interrompu la copie avant le premier fichier. Aucun objet n'a été copié.

**Important : ne pas élargir silencieusement la clé S3 staging, elle doit rester limitée.**

La documentation officielle Cloudflare R2 précise que le **Cloudflare REST API** (qui a déjà permis de créer les deux ressources isolées) permet de lire, lister et téléverser des objets via le jeton API Cloudflare existant, sous réserve de ses autorisations réelles. Les objets de ce projet font au maximum **53 410 264 octets**, en dessous de la limite REST de **300 Mo par objet**.

## Approche conditionnelle

La nouvelle commande `[PUBLIC_MEDIA_REST_TO_PROD_ONCE]` :
1. relit les 211 fiches et 158 clés Supabase **sans aucune écriture** ;
2. confirme exactement les 121 protégées et 37 candidates exclues ;
3. vérifie l'identité de la D1 européenne production, du R2 privé production et le droit **de lister** ses objets via l'API officielle ; si refus, **s'arrête avant tout transfert et sans tenter de contourner les droits** ;
4. vérifie également que la lecture REST d'un objet inexistant retourne `404`, et non `403` ;
5. si et seulement si les droits sont suffisants, **lit chaque objet sélectionné depuis le R2 staging privé avec la clé S3 existante**, téléverse les octets **par l'API REST Cloudflare avec le jeton déjà présent et autorisé**, puis lit le nouvel objet en privé et compare **SHA-256 octet par octet** ;
6. réconcilie le contenu entier du bucket R2 production avec les 121 fichiers sélectionnés, tailles exactes et 37 objets non copiés.

Chaque fichier transite **en mémoire volatile** du runner GitHub (au plus 54 Mo chacun) : aucun contenu n'est écrit sur disque ou publié en artifact. Le script n'émet aucun nom, lien, secret ou chemin privé dans les journaux.

Aucune modification D1 (même staging), DNS, site public, Supabase, R2 staging. Le site actuel demeure intact. Les 31 liens multimédias historiquement cassés sont toujours à traiter avant la bascule.

**Statut initial** `PRODUCTION_R2_REST_COPY=PREPARED_NOT_RUN`, **pas réussi** tant qu'un GitHub Actions n'a pas donné un verdict `SUCCESS`.
