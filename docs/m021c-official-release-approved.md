# M021-C — Mise en service officielle autorisée, 12 novembre 2026

Le propriétaire autorise explicitement la mise en production de la version validée `feat/m021b-simplified-admin-mode-20261112` (`fdb7c5211346752d82b76272cec1a2e1e3f80d49`) sur les deux domaines officiels, sans altérer le code administrateur, les données, les routes, les médias ni les droits.

**Version visée :** le Worker déjà en service `celebrations-exit-production`, D1 `28736d2a-479b-472b-bf82-703ad0affe10`, R2 des médias `celebrations-exit-production`, R2 de l'éditeur `celebrations-exit-staging`. Aucun déploiement M016, transfert de comptes fictifs, changement de domaine, secret Brevo ou migration destructive.

**Contrôles impératifs avant modification :** code officiel historique inchangé ; nom/bindings/routes/version Worker exacts ; tables historiques et nombres de lignes ; sauvegarde chiffrée complète D1 et snapshot éditeur R2 relecture chiffrée ; justificatif de sauvegarde média hors Cloudflare ; tests M020/M021 ; présence de migrations uniquement additives, lorsque manquantes.

**Activation :** envoyer une version du Worker officiel, vérifier l'absence de changement concurrent, promouvoir à 100 %, tester l'interface réelle avec Chromium sur smartphone et le code habituel, essayer les deux modes puis laisser le mode simplifié actif (case décochée). Ne créer aucun faux membre ou contenu sur le site officiel.

**Retour arrière :** si un contrôle échoue après activation et que la version en ligne est toujours celle de cette livraison, restaurer la version Worker précédente. Ne jamais supprimer des tables additives ni toucher aux médias/droits.

## Sécurité du code administrateur

Le secret GitHub de la préproduction M017 n'est **pas** le PIN historique du domaine officiel. La livraison doit conserver strictement le vérificateur et les secrets du site officiel et ne pas tenter une connexion avec un mauvais code. Les contrôles Chromium sans authentification examinent la page publique, le masquage de Connexion, le lien Administration, l'écran PIN et les refus d'accès aux données privées. Les fonctions authentifiées ont déjà été validées sur M016, mais leur parcours complet sur le domaine officiel nécessitera une validation par le propriétaire connecté.

## Complément de compatibilité en production

La lecture des bindings a révélé l'absence du secret indépendant `EDITOR_D1_CHALLENGE_SECRET` sur la version officielle antérieure. La nouvelle version préparée reçoit **uniquement** un signer cryptographique aléatoire de 64 caractères hexadécimaux via l'upload d'une version **inactive**, après sauvegardes, sans toucher au code PIN ni aux autres secrets. Le contrôle de la version active, de la configuration, des protections et des lignes historiques demeure impératif avant promotion. Les services d'e-mails Brevo restent facultatifs en mode simplifié ; aucune clé API n'est inventée.
