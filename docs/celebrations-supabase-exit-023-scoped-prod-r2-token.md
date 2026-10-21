# CÉLÉBRATIONS — mission 023 : action minimale de permission pour copier 121 médias

## Résultat des essais indépendants

- [GH #39592079489](https://github.com/ludodulac/Celebrations/actions/runs/39592079489) : S3 staging **OK**, mais S3 production **ACCESS DENIED** : le token S3 actuel est limité au staging.
- [GH #39593331409](https://github.com/ludodulac/Celebrations/actions/runs/39593331409) : lecture/listing des objets R2 production par le jeton Cloudflare REST **OK**, mais tentative de **PUT via REST refusée**. Aucun objet copié. Ne pas contourner ces permissions.
- Dans les deux cas, sélection de **121 objets / 766 989 338 octets**, **37 exclus** comme candidates non visibles, garde de référence statique **PASS**, 31 chemins de fiches déjà manquants dans Supabase, aucun changement de site.
- La nouvelle base D1 de production contient les **19 tables vides**, mais aucun média ni données privées n'y a encore été importé.

## Solution la plus sûre

Le propriétaire doit créer, **dans son propre compte Cloudflare**, un **NOUVEAU token R2** limité strictement au bucket privé `celebrations-exit-production`, avec droit `Object Read & Write`. Ne pas modifier le token staging existant.

Les deux valeurs affichées **une seule fois** par Cloudflare doivent être stockées **directement dans les Secrets de l'environnement GitHub Actions `celebrations-staging`** du dépôt `ludodulac/Celebrations`, sous les clés exactes :

- `CELEBRATIONS_PROD_R2_ACCESS_KEY_ID`
- `CELEBRATIONS_PROD_R2_SECRET_ACCESS_KEY`

**Ne jamais communiquer ni copier ces secrets dans ChatGPT, une capture d'écran, une issue, un commentaire GitHub, un fichier du dépôt ou une page publique.**

L'étape pourra ensuite être déclenchée automatiquement par le commit `[SCOPED_PROD_R2_COPY_ONCE]` exclusivement sur la branche migration. Le programme `scripts/copy_selected_with_scoped_production_key.py` lit le R2 staging avec sa clé source, écrit uniquement dans le R2 production avec la clé distincte, recalcule les SHA256 sur les 121 fichiers en mémoire volatile et certifie que les **37 non retenus ne se trouvent pas dans la nouvelle production**.

## État

`PUBLIC_VISIBLE_MEDIA=121` · `REVIEW_EXCLUDED_FROM_PROD=37` · `PROD_R2_CURRENT_OBJECTS=0` · `PROD_R2_WRITE_PERMISSION=PENDING_OWNER_ACTION` · `PUBLIC_DNS_UNCHANGED=YES` · `NO_DELETIONS=YES`.

Ne lancer **aucune** nouvelle tentative de copie tant que le propriétaire n'a pas confirmé que les deux secrets sont enregistrés (le job s'arrêtera de lui-même sinon). Ne pas déployer le site.
