# Célébrations — Mission 003 : fondations multilingues

**Base imposée :** `fix/editor-m11-mobile-insert-dialog-footer-delete-20261110` au commit `955041917597ad4d2a5deb21de8e641253c6621f`.

**Périmètre :** domaine pur et tests, **aucune intégration active** dans l'administration, le rendu visiteur, les API, D1, R2 ou le processus de déploiement.

## Langues

`migration/cloudflare/app/domain/editor-localization.mjs` expose un registre indépendant de Cloudflare :

```json
{
  "version": 1,
  "defaultLanguageId": "fr",
  "languages": [{ "id": "fr", "name": "Français", "flag": "🇫🇷", "active": true }]
}
```

- `id` est stable : identifiant explicite de type `fr`, `en`, `pt-BR`. Il n'est **jamais** recalculé à partir du nom ou du drapeau.
- `name` et `flag` sont modifiables indépendamment. `flag` est une chaîne portable (emoji ou référence de ressource), **pas** un objet Cloudflare.
- Une langue ajoutée est désactivée par défaut, pour permettre de préparer son contenu avant activation.
- Une langue active peut devenir la langue par défaut. La langue par défaut ne peut pas être désactivée.
- Le choix d'une langue absente/inactive retombe sur la langue par défaut.
- Aucune traduction automatique n'est déclenchée ou requise.

## Pages et espaces de célébration

Une page canonique reste **une seule** entrée, avec son `id` initial (par exemple `preparation-101`). Son contenu historique demeure à la racine et est interprété comme français (`sourceLanguageId: 'fr'` implicite). Une traduction est un contenu indépendant dans un champ **optionnel** `translations`, sans déplacement des données existantes :

```json
{
  "id": "preparation-101",
  "group": "celebration",
  "name": "Préparation",
  "blocks": [{"id": 1, "kind": "text", "text": "Bienvenue"}],
  "translations": {
    "en": {
      "name": "Preparation",
      "blocks": [{"id": 1, "kind": "text", "text": "Welcome"}],
      "documents": [{"name": "Programme", "url": "/letter/programme.pdf"}],
      "media": [{"src": "/media/new/photographie.jpg"}]
    }
  }
}
```

- Le contenu traduit ne contient **ni** `id`, **ni** `visibility`, `group`, `placement`, droits, groupes de membres, rôles, audience ou slugs. Ceux-ci demeurent uniquement dans l'entité canonique, commune à toutes les langues.
- Une traduction de **page** contient au minimum son `name` et ses `blocks` complets. Les documents et médias peuvent être stockés dans ses blocs ou ses listes éditoriales. Les variantes ne sont **pas** fusionnées champ par champ avec le français : sinon certains médias ou textes risqueraient de s'afficher dans la mauvaise langue.
- Un **espace de célébration** utilise les mêmes fonctions de domaine, qu'il soit représenté par un `id` de page d'étape ou par une ancienne `key` de jour. Ses dates, identifiants, groupes et droits restent partagés. Il peut avoir des `label`, `text`, `blocks`, `links`, `documents`, `media` et `contentIds` propres à la langue.
- Les références `/media/`, `/media/new/` et `/letter/` restent des références, jamais des copies de fichiers. **Aucun renommage ou transfert R2 n'est effectué.**

### Sélection et repli

1. Prendre le contenu dans la langue demandée si elle est active et si la version existe.
2. Sinon choisir le contenu de la langue par défaut si cette version existe.
3. Dernier recours de compatibilité des données historiques : contenu original français **si le français est encore actif**. Cela évite de rendre immédiatement illisibles les anciennes pages si l'administrateur change la langue par défaut avant de les traduire. Le résultat indique toujours la **langue effectivement affichée** (`languageId`) et `usedFallback`.
4. Si aucune version active n'existe, retourner `null` ; ne pas inventer de version et ne jamais piocher dans un contenu non publié.

### Menu unique

`projectPageMenu(pages, registry, languageId)` projette les pages canoniques dans leur ordre, **une entrée par identifiant de page**, et remplace uniquement le libellé selon la langue sélectionnée ; les traductions ne deviennent pas des pages séparées. Il ne construit ni URL ni droits.

**Précaution impérative pour l'intégration ultérieure :** cette fonction ne filtre pas la publication et ne décide jamais d'un accès. Le futur moteur de navigation doit **d'abord** appliquer les contrôles de publication et d'autorisation existants sur les **entités canoniques**, puis seulement projeter leurs libellés multilingues. Ce modèle n'est ni un pare-feu ni un système de membres. Une traduction ne peut pas autoriser une page privée.

## Compatibilité et transfert Cloudflare

- Aucune donnée enregistrée aujourd'hui n'a besoin du champ `translations` : l'absence de traduction signifie « contenu français historique ».
- Les champs historiques et les champs inconnus des entités sont conservés. Les IDs de pages et de langues survivent à un aller-retour JSON, sans dépendre d'une URL ou d'un compte Cloudflare.
- Aucune lecture/écriture D1 ou R2, aucune migration de production, aucun changement de secret/DNS, aucune traduction automatique.
- Les fonctions nouvelles ne sont **importées par aucun point d'entrée applicatif** ; elles ne peuvent donc pas changer le site public ou l'administration actuels.

## Raccordement futur (hors mission 003)

- Définir avec le superviseur **où persister** le registre et les variantes dans le document canonique, après sauvegarde et validation des contraintes de publication et d'autorisation de la mission 002.
- Raccorder la sélection linguistique aux interfaces d'administration, aux contrôleurs de sauvegarde puis au rendu visiteur, en conservant les routes historiques et la règle « une page canonique = une entrée du menu ».
- Revalider le filtrage de visibilité et des médias **avant** projection multilingue, et vérifier les chemins R2 après transfert vers l'autre compte Cloudflare.
- Définir la politique éditoriale des variantes incomplètes et du changement de langue source avant d'autoriser l'édition des variantes dans l'administration.

**Vérifications locales :** `node --test tests/test_m003_localization.mjs`. Les tests utilisent uniquement des données fictives, ne contactent aucun service et ne valident pas le fonctionnement des futures interfaces.
