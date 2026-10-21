# CÉLÉBRATIONS — mission 021 : transfert sélectif et vérifié des médias vers la R2 privée de production

**Demande** : conserver toutes les ressources effectivement proposées aux visiteurs dans Accueil, Préparation, Mercredi, Jeudi, Vendredi, Samedi, Dimanche, Après célébration, galerie / médiathèque et liens privés envoyés aux utilisateurs. Exclure les anciens fichiers importés dans l'administration mais sans usage public.

## État vérifié avant ce lot
- 158 objets originaux Supabase, 830 312 417 octets.
- Audit public-only [#39588866066](https://github.com/ludodulac/Celebrations/actions/runs/39588866066) : 121 clés physiques protégées, 37 clés à examiner. 31 références de chemins déjà absentes dans le bucket source.
- Staging R2 contient une copie privée, SHA256 vérifiée, des 158 fichiers. **Ne jamais la nettoyer dans ce lot**.
- Production R2 `celebrations-exit-production` existe séparément, classe Standard, privée, initialement vide. D1 production = 19 tables vides.
- Site `main` GitHub Pages, Supabase partagé et DNS Spaceship toujours actifs et intacts.

## Travail de ce lot
Script `scripts/copy_selected_public_media_to_production.py` et job GitHub Actions conditionnel `[PUBLIC_ONLY_R2_COPY_ONCE]`.

- Refait l'inventaire Supabase en lecture seule et exige exactement les bornes connues (211 fiches, 108 liées aux événements, 158 objets et taille totale inchangée).
- Reconstitue les clés du programme, de l'accueil, des illustrations spéciales, de la galerie d'images et des 9 invitations comité. Vérifie les références statiques incluses dans le code public pour éviter des exclusions erronées.
- Exige exactement 121 fichiers présents dans la source et un bucket R2 production **vide**, sans quoi **arrêt avant toute copie**. Un fichier absent dans le bucket Supabase ne sera pas inventé ou téléchargé depuis une source extérieure.
- Contrôle indépendamment la source R2 staging et la destination R2 production dans le même compte. Copie ces clés seulement, via `CopyObject` privé de Cloudflare, puis lit les deux objets en flux et vérifie l'identité SHA256 et la taille octet par octet. Les clés de fichiers et les fichiers personnels ne sont jamais publiés dans les logs GitHub ni dans des artifacts.
- Vérifie qu'il y a exactement les clés sélectionnées en R2 production. **Zéro suppression** sur Supabase, staging ou production ; aucun changement d'accès, DNS, site public ou table D1.

**Note** : une interruption peut laisser une R2 production partiellement remplie. Le script arrête volontairement les exécutions suivantes sur un bucket non vide jusqu'à un examen ciblé, sans effacement automatique.

### À ne pas confondre
Ce transfert ne résout pas encore les références historiques de fichiers inexistants, le transfert des tables de programmes dans la nouvelle D1, ni les tests complets des parcours publics. La bascule définitive ne sera faite qu'après validation.

**État d'exécution** : à mettre à jour depuis le journal du job réellement effectué.
