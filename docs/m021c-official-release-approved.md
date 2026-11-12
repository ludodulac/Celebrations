# M021-C — Mise en service officielle autorisée, 12 novembre 2026

Le propriétaire autorise explicitement la mise en production de la version validée `feat/m021b-simplified-admin-mode-20261112` (`fdb7c5211346752d82b76272cec1a2e1e3f80d49`) sur les deux domaines officiels, sans altérer le code administrateur, les données, les routes, les médias ni les droits.

**Version visée :** le Worker déjà en service `celebrations-exit-production`, D1 `28736d2a-479b-472b-bf82-703ad0affe10`, R2 des médias `celebrations-exit-production`, R2 de l'éditeur `celebrations-exit-staging`. Aucun déploiement M016, transfert de comptes fictifs, changement de domaine, secret Brevo ou migration destructive.

**Contrôles impératifs avant modification :** code officiel historique inchangé ; nom/bindings/routes/version Worker exacts ; tables historiques et nombres de lignes ; sauvegarde chiffrée complète D1 et snapshot éditeur R2 relecture chiffrée ; justificatif de sauvegarde média hors Cloudflare ; tests M020/M021 ; présence de migrations uniquement additives, lorsque manquantes.

**Activation :** envoyer une version du Worker officiel, vérifier l'absence de changement concurrent, promouvoir à 100 %, tester l'interface réelle avec Chromium sur smartphone et le code habituel, essayer les deux modes puis laisser le mode simplifié actif (case décochée). Ne créer aucun faux membre ou contenu sur le site officiel.

**Retour arrière :** si un contrôle échoue après activation et que la version en ligne est toujours celle de cette livraison, restaurer la version Worker précédente. Ne jamais supprimer des tables additives ni toucher aux médias/droits.
