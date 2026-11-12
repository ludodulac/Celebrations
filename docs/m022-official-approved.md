# M022 — Mise en service de la simplification des commandes, approuvée par le propriétaire

Date : 12 novembre 2026. Référence: `feat/m022-clean-editor-commands-20261112` (base: M021-C déjà en production).

Le propriétaire a explicitement demandé à cette conversation de **faire elle-même le travail**, en particulier de publier sur son **site officiel** après corrections. Il ne veut pas de simples messages à transférer, ni de PR non déployée.

## Périmètre exact validé

- Choix de visibilité Brouillon/Visible/Masqué **sauvegardé dès le changement** (avec retour en arrière serveur si refus), sans bouton Appliquer/Mettre à jour le site, sans entraîner la publication des modifications de texte non enregistrées.
- Accès Public/Privé/catégories enregistré par sélection, sans Enregistrer l'accès. Toute ouverture des droits élargis demande confirmation ; les politiques et sessions restent vérifiées côté serveur.
- Unique fonction Enregistrer pour le contenu, accessible depuis la barre du haut et dans les réglages de la page, contour vert discret. Une page déjà publique se met à jour après Enregistrer, mais une page en Brouillon/Masquée conserve son statut.
- Les pages historiques n'affichent plus de menu ⋯ vide ; les actions de suppression restent visibles uniquement si autorisées.
- En mode complet, Dupliquer dans la célébration sélectionne catégorie et langue directement et copie en brouillon les pages de **la même** célébration, sans nouvelle célébration, « (copie) », droit ou inscription. En mode simplifié, copie classique d'une nouvelle célébration avec date et titre.
- Pas de duplication supplémentaire dans les réglages des pages appartenant à une célébration (le bouton ＋ Page reste).
- Des modules source canoniques mis à jour, deux bundlers déterministes, sans copier/coller d'une deuxième administration.

## Vérification avant production

- 50/50 tests d'édition/sécurité exécutés et modules générés vérifiés.
- Préproduction M016 isolée : run GitHub Actions 43191607346, **success** ; sauvegardes chiffrées D1/R2 M016, contrôle mobile Chromium pour mode simplifié/complet, conservation du code et des droits, Worker officiel **inchangé**.
- La célébration fictive M016 ne possède pas les pages ordinaires historiques ; la visibilité de **ces** pages et la duplication complète d'une célébration disposant de pages sont couvertes par les contrats de tests, et ne sont pas faussement présentées comme validées de bout en bout sur M016.
- Aucune donnée de démonstration ni secret commun de préproduction transféré vers la production.

## Déploiement officiel autorisé

Déployer la nouvelle version du **Worker existant** `celebrations-exit-production` sur `ronde-des-archanges-universelle.eu` et son www, sans routes/DNS neufs. Aucune migration D1 ni modification de données nécessaire. Conserver strictement l'authentification/PIN historique et les bindings R2/D1. Préparer et vérifier les sauvegardes D1 officielle et snapshot R2 chiffrées, comparer les données/ACL avant/après, tester la consultation publique, les refus d'accès anonymes et l'écran PIN officiel. Ne pas saisir le secret M017 de préproduction sur la production. Ne pas changer le réglage mode complet/simplifié choisi par le propriétaire.

En cas de régression, restaurer seulement la précédente version active de ce même Worker (aucune suppression D1/R2).
