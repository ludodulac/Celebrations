# M020-E — Consolidation A + B + C + D

Base immuable : `26ca8c66315045b250c4c9d821ff2820fa2ca56a` (M018). Branche : `feat/m020e-consolidation-abcd-20261111`. PR #156 (brouillon).

## Périmètre effectivement consolidé

- M020-A (#154) : huit langues, libellés fixes visiteurs, repli français complet, droits privés avant la localisation.
- M020-B (#153) : une célébration canonique, versions internes catégorie/langue, sigles, réglages groupés, duplication en brouillon et dates modifiables.
- M020-C (#152) : médiathèque administrative à quatre rubriques, audio/vidéo, recherche, aperçu PDF, téléversement confirmé, lecture MP3 avec requêtes Range.
- M020-D (#155) : invités administratifs uniquement, activation et réinitialisation à liens temporaires, session cookie sécurisée, révocation, Brevo transactionnel simulé.

Les sept fichiers modifiés simultanément ont fait l'objet d'une résolution explicite, pas d'une simple copie du dernier fichier. Le parcours public conserve **à la fois** le repli français et les écrans d'activation/réinitialisation de compte. L'éditeur généré a été réconcilié avec ses sources canoniques, afin que les contrôles `build --check` détectent toute dérive.

Une célébration principale est proposée une seule fois dans la rubrique Membres. Les noms administratifs des versions ne doivent jamais tenir lieu de titre public. Les inscriptions, catégories et droits ne sont pas copiés lors des duplications. La catégorie du membre et la langue choisie ne remplacent jamais l'autorisation d'accès serveur.

Limite existante d'import de nouveaux fichiers MP3/WAV : **25 000 000 octets par fichier** ; aucun média officiel n'a été déplacé, purgé ou supprimé.

## Migrations additive et recette isolée

Deux scripts ont été conservés sans modification des données officielles :

- `migration/cloudflare/d1-migrations/20261111_020b_category_abbreviation.sql`
- `migration/cloudflare/d1-migrations/20261111_020d_member_brevo.sql`

Une répétition des deux scripts sur SQLite en mémoire, avec des personnes fictives, est couverte par `tests/test_m020e_integrated_migrations.mjs` et le workflow de régression M020-E.

Le workflow spécifique `.github/workflows/celebrations-m020e-existing-m016-preview.yml` est strictement limité à l'ancien Worker de préproduction M016 et à ses ressources D1/R2 distinctes. Il impose les contrôles de bindings exacts et le relevé de la version du Worker officiel, effectue les tests et builds, exporte une sauvegarde D1 M016 **chiffrée** avant toute migration, puis applique les deux scripts de manière conditionnelle à cette D1 isolée. L'artefact chiffré est conservé 7 jours ; son déchiffrement exige le secret d'administration M017 de préproduction, jamais divulgué dans le workflow. La détection d'une migration partiellement installée fait échouer le déploiement. En cas d'échec après déploiement, le Worker **M016 seulement** est restauré à sa version antérieure ; les migrations additives isolées ne sont pas supprimées. La version du Worker officiel est vérifiée avant/après.

Le contrôle de navigateur `scripts/test-m020e-existing-m016-online.mjs` utilise une fenêtre mobile de 390 px, se connecte à l'administration M016 via le secret prévu pour la préproduction, capture les vues visiteur, compte membre et médiathèque et refuse l'accès anonyme aux pages privées. Les captures sont envoyées comme artefact GitHub Actions. Les tests approfondis d'invitation Brevo utilisent exclusivement un service simulé et des adresses `.invalid`.

**URL de la préproduction historique à vérifier après un workflow réussi** : https://celebrations-m016-admin-preprod.rondes.workers.dev/

Aucune mise en service sur le domaine officiel ne doit découler de cette mission.

## Activation future de Brevo

Le compte du collègue n'est pas connecté. Lorsqu'il le souhaitera :

1. Dans Brevo, valider l'adresse/domaine expéditeur et les réglages DNS (DKIM, SPF/DMARC).
2. Ajouter `BREVO_API_KEY` comme secret Cloudflare **du Worker cible** (sans inscrire la clé dans GitHub), puis renseigner `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` et `MEMBER_PUBLIC_ORIGIN` (origine HTTPS sans slash final).
3. Tester une invitation de contrôle sans membre réel, vérifier sa réception, l'activation, l'expiration, la réinitialisation et la révocation, puis demander la validation humaine avant toute activation officielle.

Tant que ce paramétrage manque, **aucun e-mail réel n'est considéré envoyé** ; le simulateur de tests n'est pas une preuve de délivrabilité.

Pour la **Pensée quotidienne**, aucun abonnement n'est géré par le site : simple page ordinaire de l'éditeur avec image, texte et bouton vers le formulaire Brevo indépendant créé par le collègue. Aucune synchronisation automatique avec les comptes des célébrations.

## Points de décision

Les workflows de tests et de préproduction doivent être terminés avec succès et les captures consultées avant de considérer M020-E comme prête. Les échecs antérieurs `node-http-local-sqlite`, `http-local-d1` et `Workers Builds: celebrations` restent à confronter aux vérifications de la branche intégrée ; aucune erreur ne doit être ignorée ou masquée artificiellement. La PR #156 reste en brouillon.

**Aucun déploiement officiel, aucune migration D1 officielle, aucun email réel et aucune donnée personnelle réelle utilisée par cette consolidation.**
