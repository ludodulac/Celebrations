# CÉLÉBRATIONS — ÉTAPE 9 : conditions de validation avant bascule

État au 20 octobre 2026. Document de cadrage **sans** déploiement, SQL Cloudflare, copie de médias ou changement DNS.

## 1. Préparation et essais confirmés

| Fonction | Meilleure preuve existante | Résultat |
|---|---|---|
| Site Cloudflare isolé accessible | Run [39342980289](https://github.com/ludodulac/Celebrations/actions/runs/39342980289) | HTTP 200 sur public, admin et ressources essentielles ; navigation mobile simulée |
| Programme et médiathèque rendus | Même run, `STAGING_BROWSER_SMOKE` | 4 célébrations, 62 événements, 211 contenus ; aucune requête au Supabase historique observée |
| Médias publics liés au programme | Même run, `STAGING_HTTP_MEDIA_AUDIT` | 98/98 HEAD HTTP 200 ; accès direct à un PDF comité/objet inconnu refusé |
| PDF de comité | Run [39333819255](https://github.com/ludodulac/Celebrations/actions/runs/39333819255) | 9/9 liens préservés, 9/9 HEAD 200 |
| Intégrité des objets du Storage d'origine | Même run | 158/158 copies comparées par SHA-256, 830312417 octets |
| Import PDF dans l'admin mobile | Run [39343802850](https://github.com/ludodulac/Celebrations/actions/runs/39343802850) | Succès, fichier privé, refus accès anonyme |
| Gestion admin et données sauvegardées | Run [39390800773](https://github.com/ludodulac/Celebrations/actions/runs/39390800773) | Modifications synthétiques puis nettoyage ; pas de mutation historique |
| Participant fictif | Run [39342980289](https://github.com/ludodulac/Celebrations/actions/runs/39342980289) | Inscription, connexion, mot de passe perdu, déconnexion et suppression de test |
| Durcissement sauvegarde 16 tables | Run [39453233226](https://github.com/ludodulac/Celebrations/actions/runs/39453233226) | Tests unitaires GitHub SUCCESS : pagination déterministe par PK, Content-Range exact, protection doublons / dérive de taille, import relationnel fictif |

Tous ces contrôles sont **des preuves historiques à la date de chaque run**, et non des garanties en temps réel du site.

## 2. Blocages avant une validation `READY_FOR_CUTOVER`

**G1 — Sauvegarde réelle durable : NON VALIDÉE.** L'organisation Supabase propriétaire est sur le plan **FREE** au 20/10 ; les sauvegardes quotidiennes automatiques sont réservées aux offres Pro/Team/Enterprise selon la documentation officielle. Ne pas supposer l'existence d'un point de restauration Supabase. ** Le code d'export des 16 tables existe et ses essais fictifs réussissent. Aucun export privé, chiffré, complet et restaurable de la vraie base n'a encore été localisé/attesté. La recherche du dossier Drive « Sauvegarde Supabase – Célébration » ne confirme aucun fichier accessible. Ne jamais déposer des hachages de mot de passe, sessions ou données personnelles dans le GitHub public, un artifact CI public ou un Google Drive partagé sans protection adéquate.

**G2 — Instantané cohérent : NON VALIDÉ.** La nouvelle pagination source trie par clés primaires et contrôle les comptes/Content-Range, mais *aucun export REST séquentiel n'est un instantané transactionnel des 16 tables*. Pour le cutover, exiger une fenêtre de gel des écritures ou un backup PostgreSQL cohérent et vérifier l'absence de modifications pendant la capture. Ne pas promettre le « zéro perte » avec des lignes encore mouvantes.

**G3 — Statistiques à synchroniser : NON VALIDÉ EN FINAL.** Dernier checkpoint du staging : `11648` clics source. La source en lecture seule donnait `11681` clics et **33 nouveaux** à l'heure du relevé précédent. Ce nombre est évolutif. N'exécuter la synchronisation finale qu'au moment autorisé, sous précontrôle du quota D1.

**G4 — Compte participant historique : NON VALIDÉ POUR VRAI MOT DE PASSE.** Un compte original préservé, mais uniquement un compte de test a parcouru la connexion avec le mot de passe en clair. Prévoir un essai humain sécurisé dans le navigateur au moment opportun, **sans jamais demander à envoyer le mot de passe à ChatGPT ou GitHub**. Les sessions anciennes ne sont pas migrées.

**G5 — Pages légales / vie privée : NON VALIDÉ POUR PUBLICATION.** Trois brouillons restent privés ; informations manquantes sur l'éditeur et la conformité. Une publication ou une substitution silencieuse est interdite.

**G6 — Trafic, DNS et retour arrière : NON VALIDÉS.** Collecter les valeurs de routage originales et éprouver la restauration vers `main`/Supabase en environnement contrôlé avant de modifier le domaine réel. Conserver la possibilité de réconcilier les écritures faites après bascule.

**G7 — Autres services Supabase : NON VALIDÉS POUR EXTINCTION.** Le projet est intitulé « La forêt enchantée » ; il contient des tables `audios`, `app_admins` et autres en plus des 16 Célébrations. Même si CÉLÉBRATIONS quitte Supabase, **ne pas supprimer/pause ce projet ni modifier sa facturation globale** avant audit séparé.

**G8 — Cloudflare coûts et quotas : À REVÉRIFIER.** La dernière synchronisation test a consommé 553 lignes lues et 32 écrites ; cela ne certifie ni les volumes réels de trafic futur, ni l'ensemble des coûts de R2, ni l'état actuel des quotas partagés.

## 3. Décision d'ingénierie

- Les tests prouvés peuvent être **réutilisés**, pas inutilement recommencés.
- Étape 9 : **PREPARED / PARTIAL** ; ne pas certifier `PASS` jusqu'à fermeture de G1–G8.
- **Aucune bascule vers Cloudflare**, aucun changement sur `main`, aucun arrêt de Supabase, aucune publication de brouillon, aucun changement DNS.
- Prochaine mission sûre : vérifier la solution de sauvegarde privée chiffrée et la possibilité d'une restauration réelle isolée, puis préparer la fenêtre de gel et le delta final. La preuve d'un test synthétique n'est pas une sauvegarde réelle.

## Mise à jour du périmètre — décision du propriétaire du 22 octobre 2026

Seules les pages, actions et ressources réellement présentes ou accessibles par liens dans le site public sont dans le périmètre de migration, avec les neuf liens PDF déjà partagés expressément préservés en mission 06. Les quatre anciens raccourcis non référencés `/communique`, `/rituel-court`, `/rituel-long`, `/preparation` **ne sont PAS des prérequis** et leur 404 sur le domaine officiel **ne peut PAS bloquer la migration**. Ne consacrer aucun temps, quota ou correctif à ces routes non utilisées. Cela ne lève aucun des blocages de sécurité G1–G8 ; ne pas confondre l'exclusion de ces liens avec l'autorisation de basculer.
