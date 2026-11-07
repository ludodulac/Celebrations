# CÉLÉBRATIONS — MISSION 06
## Séparer le démarrage, les règles locales, le rendu et les contrôleurs de l’éditeur

**Date :** 7 novembre 2026. **Périmètre :** branche isolée, aucun déploiement.
**Base :** PR #85, mission 05. **Référence visuelle :** mission 02.

### Travail concret
Les fonctions ECMAScript désormais indépendantes et testables se trouvent dans
`migration/cloudflare/app/admin/` :

1. `editor-state.mjs` — reconstruction du brouillon local et sélection de page, avec stockage injecté.
2. `editor-local-rules.mjs` — dates, heures, liens, couleurs et formatage local, sans DOM ni réseau.
3. `editor-render.mjs` — orchestration du rendu par ports explicites, sans accès aux variables privées de l’éditeur.
4. `editor-dom.mjs` — installation des événements de navigation, aperçu, désélection et avertissement de sortie.

`editor-demo-client.mjs` compose leurs définitions depuis les modules ESM
dans l’unique script inline protégé par nonce, nécessaire à la CSP actuelle.
Il **n’utilise pas** de substitution textuelle opportuniste de code : les
fonctions sont sérialisées par `Function.prototype.toString`, puis appelées
par des ports explicites. Le reste de l'éditeur historique et le bloc
`SERVER_EDITOR_SYNC` restent compatibles.

### Ce qui reste explicitement à isoler
Les outils de blocs, les sélecteurs de fichiers, le glisser-déposer et Undo
restent encore dans le noyau historique : missions 07, 08 et 11. La sauvegarde
et la publication appartiennent à la mission 10. Il ne serait pas exact
d'affirmer que les 2 800 lignes ont été intégralement transformées en modules.

### Invariants
Les mêmes clés navigateur, formats, IDs, pages, HTML et CSS sont gardés.
Aucune route HTTP, aucun Worker ni D1/R2 n'ont été modifiés. Une sauvegarde
publique ne peut pas être provoquée par le découpage. La branche n'est
**ni fusionnée, ni publiée**. Le site officiel reste sur sa version existante.

### Validation
Le workflow M06 exécute tests unitaires des nouveaux ports, tests de
régression M05, parcours Playwright de référence desktop et mobile, et
les tests des sélecteurs d'images/PDF/vidéos sur données fictives.
Son verdict doit être lu sur GitHub Actions ; l'existence du workflow
ne prouve pas à elle seule qu'il est passé.

### Conditions avant publication
Les risques R1–R5 de M03 ne sont pas levés par cette mission (rollback exact
Worker, sauvegarde D1, octets des médias, copie indépendante, sauvegarde
à jour). Il faut prouver ces protections et refaire la comparaison complète
du candidat avant une quelconque mise en ligne.
