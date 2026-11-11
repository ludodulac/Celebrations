# M020-D — Authentification des membres avec Brevo (construction indépendante)

**Base :** M018 au commit 26ca8c66315045b250c4c9d821ff2820fa2ca56a.  
**Branche :** feat/m020d-member-auth-brevo-20261111.  
**État :** code préparé et testé uniquement sur données fictives locales ; aucun déploiement et aucune mutation de données officielles.

## Fonctionnement construit

Dans la rubrique **Membres** de l'administration actuelle, l'administrateur garde la création d'une personne, l'affectation d'une ou plusieurs célébrations principales et la catégorie. La fiche affiche l'état d'accès (« invitation à préparer », « invitation à activer », « compte activé », « accès révoqué »), le choix de la langue, l'action d'invitation et la révocation. Une confirmation de vérification indépendante est requise avant de lancer l'invitation ; un rapprochement des adresses e-mail ne suffit pas pour récupérer un compte historique.

Le parcours public existant « Connexion membre » propose désormais une première activation par lien, un mot de passe choisi par le membre, une connexion classique, une session conservée en cookie sécurisé, un bouton de déconnexion et « Mot de passe oublié ? ». La preuve du mot de passe est dérivée dans le navigateur selon le protocole historique ; le mot de passe brut n'est pas stocké dans D1 ni envoyé par e-mail.

Les e-mails d'activation et de réinitialisation utilisent l'API transactionnelle de Brevo, en huit langues. Les liens générés comportent un secret aléatoire de 256 bits, expirent après 30 minutes, sont à usage unique et seule leur empreinte est stockée. La réinitialisation invalide les anciennes sessions. La révocation retire immédiatement l'accès vérifié côté serveur, sans supprimer le compte, ses anciens mots de passe ni les inscriptions historiques aux célébrations.

## Migration et mise en service

Le fichier de migration additive **migration/cloudflare/d1-migrations/20261111_020d_member_brevo.sql** a été ajouté mais **n'a été exécuté sur aucune base distante**. Il conserve les tables historiques et prévoit l'état des invitations, les liens temporaires, les demandes d'envoi et un compteur de quota journalier atomique.

Avant de mettre en service :

1. Appliquer la migration sur la D1 isolée de préproduction M016, puis vérifier les clés étrangères, les parcours et la sauvegarde. N'envisager la production qu'après validation et autorisation explicite.
2. Ajouter dans les paramètres/secrets du Worker Cloudflare **BREVO_API_KEY** (secret), **BREVO_SENDER_EMAIL** (adresse vérifiée), **BREVO_SENDER_NAME** et **MEMBER_PUBLIC_ORIGIN** (origine HTTPS exacte de l'environnement sans slash final). Ne rien inscrire dans le dépôt ou les journaux.
3. Vérifier le domaine expéditeur chez Brevo et la configuration DNS d'authentification (DKIM, SPF et DMARC), puis tester une invitation réelle vers **une adresse fictive de contrôle** ; éviter tout membre réel pendant la recette.
4. Conserver les drapeaux de protection du système existant : MEMBER_DIRECTORY_API_ENABLED, MEMBER_DIRECTORY_API_HOST, MEMBER_PAGE_READ_API_ENABLED et, pour le site officiel seulement, MEMBER_DIRECTORY_OFFICIAL_ENABLED. Les routes restent inaccessibles sans leurs autorisations M018.

L'API de Brevo ne doit jamais être appelée avant la connexion du compte du collègue. Sans configuration, l'interface signale qu'aucun e-mail n'a été envoyé. Les demandes publiques ne révèlent pas si une adresse existe ; il existe une limitation de fréquence par adresse et une réservation au plus de 300 envois par jour UTC (sous réserve du quota réel de Brevo).

## Recette technique

Workflow **.github/workflows/celebrations-m020d-member-brevo.yml** : contrôle de syntaxe, tests de bout en bout avec D1 SQLite fictive et simulateur de réponse Brevo, et regressions historiques des droits et de l'identité. Les vérifications ont couvert l'invitation, l'activation, les liens expirés ou réutilisés, le mot de passe choisi, la connexion/session persistante, plusieurs célébrations, la réinitialisation, la révocation, la prévention d'une prise de contrôle par l'ancienne inscription libre, l'absence de rapprochement automatique d'identité et la conservation des données héritées.

**Ce qui reste volontairement non vérifié :** l'envoi et la délivrabilité réels de Brevo, l'authentification du domaine expéditeur, la migration de préproduction, une recette visuelle et les parcours complets sur le véritable Worker. La PR reste en brouillon pour consolidation ultérieure avec M020-A/B/C.

## Pensée quotidienne

Aucun système d'abonnement n'a été construit. Le collègue utilisera les formulaires/listes et e-mails marketing de Brevo ; le site n'aura qu'un bouton vers ce formulaire dans une page créée avec l'éditeur habituel. Les comptes membres ne sont jamais inscrits automatiquement au marketing.
