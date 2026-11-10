# 🌸 CÉLÉBRATIONS — TRANSFERT VERS UN AUTRE COMPTE CLOUDFLARE

**Mission de nettoyage 5/6 — préparation seulement, 10 novembre 2026.** Cette procédure accompagne le site `ronde-des-archanges-universelle.eu` / `www.ronde-des-archanges-universelle.eu`. **Aucun DNS, domaine, D1, R2 ou Worker ne doit être modifié en exécutant les outils M5.** Les commandes d'import/bascule requièrent une autorisation spécifique et la possession du nouveau compte.

## 1. Quel site faut-il transférer ?

- Source Git **du code réellement livré**, pas `main` : `production/celebrations-live` au commit `65caf8d5d03d29882d0de0c0d00cdcfc622e473e`. Les nettoyages non publiés sont dans `develop/celebrations-maintenance`. Utiliser la version choisie et **l'identifier explicitement** au moment du transfert.
- Worker officiel `celebrations-exit-production` ; version connue au 9 novembre `eccb1274-2ed8-491f-8557-c4330342e4bf` ; publication `ffdc7b2b-a443-45cf-843d-0419fe71cb8d`. **Revérifier la version réellement active juste avant le transfert** ; la référence historique n'est pas un état en temps réel.
- Base **D1 production** : `28736d2a-479b-472b-bf82-703ad0affe10`, utilisée pour **deux bindings du même objet D1** : `DB` et `MEDIA_ACL`. Elle contenait **19 tables et 12 797 lignes au 9 novembre**.
- Bucket R2 **MEDIA_BUCKET** : `celebrations-exit-production` — médias historiques, chemins/ACL.
- Bucket R2 **EDITOR_BUCKET** : `celebrations-exit-staging` — malgré son nom « staging », il sert **en production** aux brouillons, pages publiées et nouveaux médias. **Ne surtout pas l'oublier !**
- Static Assets **ASSETS** : produits par `python scripts/build_production_assets.py` (fichiers source Git).
- Secrets du Worker : au minimum `ADMIN_PASSWORD_HASH` et `ADMIN_PASSWORD_SALT` utilisés par les parcours historiques, plus autres secrets effectivement relevés lors de la capture des bindings actifs. **Ne jamais les placer dans Git, des journaux ni des fichiers de transfert publics**. Leur présence ne garantit pas l'accès au nouveau compte : prévoir leur reconfiguration avec le propriétaire.

**Le site officiel ne dépend pas d'une deuxième base D1 « staging » pour servir ses pages actuelles : les deux bindings D1 pointent vers la D1 production, tandis que l'éditeur utilise le second bucket R2.** Ne pas confondre ces ressources.

## 2. Ce qui est déjà sauvegardé et ce qui est bloquant

- Dossier privé Google Drive **« SAUVEGARDES PRIVEES - Celebrations - 2026-11-09 »**, ID `1JqTfFto6-_PM_BjOAnEuCcG5ERxrFLeB` : **10 ZIP chiffrés**, au total environ 838 Mo. Les 10 ZIP ont été retéléchargés et vérifiés le 9 novembre avec leurs SHA-256, rapport `docs/finalisation/CELEBRATIONS-FINALISATION-MISSION-03-2026-11-09.md`.
- Captures validées au 9 novembre : **303 chemins originaux R2**, base D1 logique, code/version/paramètres du Worker, snapshot éditeur publié révision **117**, restauration hors Cloudflare **307/307** objets logiques. Les sauvegardes du 9 novembre ne garantissent **pas** les modifications enregistrées depuis.
- **BLOCAGE CRITIQUE :** la phrase de chiffrement `CELEBRATIONS_BACKUP_PASSPHRASE` est stockée dans un secret GitHub, **non relisible en clair** ; une copie fiable doit être disponible hors de GitHub (coffre privé du propriétaire), ou une **nouvelle sauvegarde chiffrée avec un secret connu et maîtrisé** doit être réalisée avant de désactiver l'ancien compte. Les fichiers ZIP seuls ne permettent pas de déchiffrer les données.
- **Avant la migration réelle** : rafraîchir une sauvegarde cohérente de D1 et des deux buckets après gel temporaire des éditions ; vérifier intégrité, médias et PDF, puis conserver les copies hors des deux comptes Cloudflare. Un simple contrôle du nombre de lignes D1 ne garantit pas l'absence de modifications concurrentes.
- Ne pas diffuser les données des participants, les liens privés ou les dossiers déchiffrés sur un dépôt public.

## 3. Candidat du nouveau compte — préparation sans réseau

Un exemple **sans identifiant privé ni secret** existe à `docs/operations/TRANSFERT-CLOUDFLARE-EXEMPLE.json`. Le script `scripts/transfer05_cloudflare_config.py` est **entièrement local**.

Pour inspecter la liste des éléments manquants (aucun compte nécessaire) :

```bash
python scripts/transfer05_cloudflare_config.py
```

Pour préparer un candidat **après avoir créé les ressources dans le NOUVEAU compte**, copier ce JSON *en dehors du dépôt public*, remplir `source.account_id`, `target.account_id`, `target.d1_id`, les noms des deux buckets et le nom du Worker candidat. **Ne pas insérer de mot de passe ni de token dans ce JSON.** Puis :

```bash
python scripts/transfer05_cloudflare_config.py \
  --config /dossier-prive/transfert.json \
  --output /dossier-prive/wrangler.transfer.toml
```

La sortie **refuse d'écraser un fichier existant**, refuse le même compte source/cible ou la même base D1, crée les **deux bindings D1** et **deux bindings R2**, désactive `workers_dev` et les preview URLs, et **n'attache aucun domaine**. Elle contient des identifiants techniques mais aucun secret ; la conserver dans un dossier privé non suivi par Git.

Cette configuration **n'est pas encore un site testable depuis un navigateur** : aucun domaine n'est attaché volontairement. Avant une recette privée sur une adresse temporaire dans le nouveau compte, il faudra sécuriser explicitement l'accès au Worker candidat : le routeur actuel reconnaît seulement des hôtes précis et ne peut pas considérer automatiquement un nouvel hôte arbitraire comme « lecture seule ». Tester les droits privés avant tout accès public.

**Ce script ne lit pas Cloudflare et n'importe rien ; les ressources doivent exister réellement et leurs noms/ID doivent être confirmés avec le propriétaire du compte destinataire.** L'identité du compte doit aussi être contrôlée côté Cloudflare avant une commande de déploiement : le fichier TOML seul ne sélectionne pas ni n'authentifie le compte.

## 4. Opérations à effectuer LORS DU FUTUR TRANSFERT autorisé (pas dans M5)

1. **Préparer les comptes :** obtenir un accès légitime au nouveau compte Cloudflare, créer D1 neuve et **deux** buckets R2 privés, inventorier toutes les variables/secrets/permissions/bindings du Worker actif, les domaines/Zone/Proxy et **les enregistrements e-mail** (MX, SPF, DKIM, DMARC, éventuel sous-domaine). Ne pas déplacer les nameservers tant que ce relevé est incomplet.
2. **Rafraîchir la sauvegarde :** figer brièvement les écritures et les publications ; capturer à nouveau la D1 et les deux buckets ; contrôler SHA/compteurs et le snapshot éditeur ; vérifier la phrase de chiffrement **récupérable**. Garder copie et plan de retour arrière.
3. **Restaurer localement :** réunir les 10 archives chiffrées, extraire dans un seul dossier, puis utiliser `scripts/finalisation03_restore_offline.py --archive-folder ... --new-destination ...` avec la clé dans une variable d'environnement privée ; l'outil refuse d'écraser un dossier. Attention : la D1 logique fournit JSON et SQLite autonome ; **elle n'est pas directement un import Cloudflare D1 prêt à exécuter**. Reconstituer un export SQL compatible D1, tester l'import sur **une nouvelle** D1, vérifier 19 tables, clés et comptages puis les valeurs/versions. Faire de même pour les chemins et octets des deux buckets, sans changer les noms de clés.
4. **Créer le candidat Worker :** reconstruire les assets source avec `scripts/build_production_assets.py` ; appliquer le TOML du nouveau compte **uniquement après validation des bindings** ; fournir les secrets via l'interface protégée du nouveau compte. Ne pas exposer les brouillons sur un domaine technique. Avant un hôte de test privé, sécuriser le routeur et le tester à la fois connecté et non connecté.
5. **Recette avant domaine :** tester visiteurs, administration réelle, enregistrement/annulation/publication, brouillons privés, médias historiques et nouveaux, 9 PDF approuvés, liens `/media/`, `/letter/`, HTTPS/CSRF et protection des essais. Tester ordinateur et téléphone ; **ne pas annoncer « OK » sur la seule base d'un build ou d'une D1 chargée**.
6. **Bascule contrôlée :** préparer DNS et certificats du domaine racine et `www`, respecter le contrat du registrar et les DNS de courrier ; après accord du propriétaire, passer les routes Cloudflare au Worker validé dans le nouveau compte. Vérifier HTTPS, DNS et e-mail, puis refaire les tests sur **les deux domaines officiels**. Les anciens liens PDF `workers.dev` sont obsolètes et ne sont pas à rouvrir.
7. **Retour arrière :** maintenir l'ancien compte et son Worker actifs tant que le nouveau n'est pas accepté et que la période de validation n'est pas terminée ; disposer des anciens paramètres DNS/routes, sauvegardes et codes d'accès ; en cas de problème, restaurer l'ancien routage **sans supprimer ni écraser les données**. Une simple restauration de version Worker n'annule pas les écritures D1/R2 effectuées après transfert.
8. **Clôture différée :** seulement après validation de l'administrateur et du collègue, sauvegarde finale et délai convenu, supprimer progressivement les ressources de l'ancien compte. Ne **jamais** supprimer l'ancienne D1 ou les deux buckets immédiatement après la bascule.

## 5. Validation de la mission de préparation

- Le fichier exemple **ne contient aucun mot de passe, secret ou compte privé**.
- Le générateur rejette comptes source/cible identiques, D1 identique à l'ancienne, noms de ressources invalides et sorties écrasantes.
- Les bindings indispensables `DB`, `MEDIA_ACL`, `MEDIA_BUCKET`, `EDITOR_BUCKET`, `ASSETS` sont explicitement présents dans le TOML candidat.
- Aucun `route`, `workers_dev`, URL de domaine officiel ni Preview URL actif ; aucune connexion API n'est faite.
- Les tests de reconstruction du site et de sécurité déjà existants restent indépendants du nouveau compte.

**La M5 est une préparation portable contrôlable, pas une migration réelle.** Les deux éléments bloquants avant transfert sont un **nouvel état sauvegardé cohérent et déchiffrable** et **l'accès autorisé au compte Cloudflare de destination**. La mission 6 pourra publier le code nettoyé sur le compte actuel après validation, séparément de tout transfert.
