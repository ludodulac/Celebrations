# CÉLÉBRATIONS — Worker candidat isolé AVANT bascule du domaine

Préparation express, 24 octobre 2026. Ceci **n'est pas** la mission de changement DNS.

## Décision et frontières
- Déployer seulement un Worker neuf intitulé `celebrations-exit-production` sur `celebrations-exit-production.rondes.workers.dev`.
- Le sous-domaine indépendant `workers.dev` reste en **lecture seule**, désindexé ; les inscriptions, statistiques, mutations et accès POST y sont refusés avant la bascule.
- Lier seulement la base **D1 `celebrations-exit-production`** ID `28736d2a-479b-472b-bf82-703ad0affe10` et R2 privé homonyme ; aucune nouvelle base, aucun nouveau bucket.
- Préserver strictement le site officiel GitHub Pages et son domaine `www.ronde-des-archanges-universelle.eu`, les serveurs DNS Spaceship et DNSSEC, les e-mails et l'ancien Worker PDF `celebrations.rondes.workers.dev`.
- Aucun domaine personnalisé, aucune route, aucune modification Supabase ou GitHub `main`.
- Protéger les secrets d'administration par dérivation côté runner et jamais dans le dépôt ou les logs.

## Déclenchement à usage unique
Workflow `.github/workflows/celebrations-isolated-production-worker-once.yml`, uniquement sur la branche de migration avec le marqueur de commit autorisé. Avant déploiement : validation des ressources exactes, tests unitaires et contrôle du quota Cloudflare Free. Le workflow refuse explicitement l'écrasement d'un Worker existant. Après déploiement : vérifie en HTTP la page, le cache/noindex, les dix routes publiques, trois tables D1 en lecture, une image réelle, le refus de PDF inconnus et la disponibilité de l'ancien site officiel.

## Ce qu'il reste à faire plus tard
Le site réel ne basculera pas sans une autorisation **distincte** et explicite. Les DNSSEC DS Spaceship, la propagation, les e-mails Brevo/Outlook/Gmail et le delta final Supabase→D1 sont des blocages de la vraie migration du domaine.

## Mise en garde
Ne pas confondre le Worker candidat isolé avec le Worker `celebrations` historique des 9 PDF. Ne pas supposer qu'un job a réussi sans lire sa conclusion et ses tests.
