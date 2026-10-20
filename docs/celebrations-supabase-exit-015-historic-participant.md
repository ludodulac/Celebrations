# CÉLÉBRATIONS — ÉTAPE 5 : contrôle du compte participant historique

Date du contrôle : 20 octobre 2026. Branche `feat/celebrations-supabase-exit-001`. La production reste sur Supabase.

## Ce qui était déjà prouvé

- Un compte historique original avait été importé dans D1 staging ([run 39337403928](https://github.com/ludodulac/Celebrations/actions/runs/39337403928)).
- Le format ancien `PBKDF2-HMAC-SHA256(180000)` a été préservé au travers de la conversion `SHA256(empreinte PBKDF2)` dans D1. Le navigateur calcule l'empreinte PBKDF2 et le Worker vérifie son SHA256 ; **aucun mot de passe réel n'a été extrait** ([run 39339942469](https://github.com/ludodulac/Celebrations/actions/runs/39339942469)).
- Un **compte fictif** a testé inscription, connexion, récupération, validation de session, déconnexion et révocation ; nettoyage confirmé ([run 39342980289](https://github.com/ludodulac/Celebrations/actions/runs/39342980289)). Ceci ne prouve pas la connexion de l'utilisateur historique réel.

## Nouveau relevé Supabase, en lecture seule

Une requête `SELECT` agrégée du 20 octobre montre :
- `participant_accounts=1`
- `verifier_format_valid=1`
- `recovery_hashes_valid=1`
- `updated_since_oct_19=0`
- Dernière modification du compte : **7 septembre 2026** (horodatage source). Il n'y a donc **aucun changement récent recensé** du compte sur la source.

Cette requête ne retourne **ni email, ni mot de passe, ni hachage, ni sel, ni réponse de récupération**.

## Vérification non intrusive préparée

Un nouveau script `scripts/audit_historic_participant_verifier_parity.py` et un job à déclenchement unique `participant-verifier-parity` comparent réellement, en lecture seule et par un calcul SHA256, l'unique compte Supabase à l'unique compte D1 staging.

- La requête est strictement bornée à **une ligne source** et à **une seule lecture D1**.
- Le programme refuse une branche de production, un mauvais compte Cloudflare, une incohérence d'identifiants, un mot de passe modifié depuis la migration, une différence de sel, de questions, de hachages ou de catégorie d'accès.
- Le quota Cloudflare **sur toutes les bases du compte** est vérifié via Analytics **avant le moindre SELECT D1**. Si le plafond de sécurité est dépassé, le job s'arrête sans interroger D1.
- Il n'y a **aucune connexion participant**, aucune modification du compte, aucun verrouillage, aucune nouvelle session et aucun transfert de secrets dans les logs ou GitHub.
- Le job n'est exécuté que si un commit de la branche de migration contient `[PARTICIPANT_PARITY_ONLY_ONCE]`. Les sauvegardes et audits médias concurrents seront ignorés.

## Résultat réellement obtenu : parité du compte historique validée

GitHub Actions [run 39492409173](https://github.com/ludodulac/Celebrations/actions/runs/39492409173), job `participant-verifier-parity` : **SUCCESS**.

- **1 compte historique réel** vérifié sur Supabase et dans D1 staging.
- L'ancien vérificateur de mot de passe PBKDF2 est **mathématiquement préservé** via son enveloppe SHA256, sans connaître ni manipuler le mot de passe.
- **2 vérificateurs de réponses de récupération** conservés et validés ; questions, sels, catégorie d'accès et état source cohérents.
- **Aucune modification du compte source depuis la copie**, aucun jeton de session émis, aucune tentative de connexion, aucun verrouillage de compte.
- Quota de sécurité Cloudflare vérifié avant le contrôle : **98 574 lignes lues et 12 255 écrites sur l'ensemble du compte** au moment du précontrôle. Le contrôle a déclaré **1 ligne D1 lue et 0 écrite**.
- Aucun nom, email, mot de passe, hachage ou sel n'est publié.

`LEGACY_ACCOUNT_VERIFIER_MATH_PARITY=PASS`
`LEGACY_RECOVERY_VERIFIERS_MATH_PARITY=PASS`
`REAL_PASSWORD_TESTED=NO`
`SOURCE_ACCOUNTS_MUTATED=0`
`D1_AUDIT_ROWS_READ=1`
`D1_AUDIT_ROWS_WRITTEN=0`

### Découverte déterminante : connexion participant inactive sur le site public actuel

L'examen **des deux branches `main` et migration** confirme que `public-universal-mode.js` définit explicitement :

```js
window.CELEBRATIONS_PUBLIC_MODE='universal';
```

Le commentaire original précise : « Mode public actuel : accès universel, **sans profil ni inscription** ». Les anciennes capacités de profils et participants restent dans le dépôt **pour une éventuelle réactivation ultérieure**.

**Conséquence :** il serait inadapté de demander au propriétaire ou à un participant réel d'effectuer maintenant une connexion qui n'est pas utilisée dans le fonctionnement public actuel, et encore moins de modifier le site pour rendre un formulaire visible. Les données historiques sont conservées sans altérer le mode universel. L'essai humain du vrai mot de passe devient un **contrôle conditionnel de compatibilité pour une éventuelle réactivation**, pas un préalable bloquant pour les fonctionnalités effectivement offertes aujourd'hui.

**Décision : étape 5 = PASS pour conservation et vérification cryptographique de l'ancien compte ; réactivation/connexion réelle = NON TESTÉE ET NON NÉCESSAIRE POUR LE MODE PUBLIC ACTUEL.** Ne pas confondre ces statuts.

## Le seul contrôle qui demande une personne réelle

**Même une parité exacte des hachages ne prouve pas que le participant historique connaît encore son mot de passe**, ni que son navigateur peut se connecter dans son environnement.

Quand le site de staging est prêt pour un test humain autorisé, demander au **titulaire de ce compte**, et non à quelqu'un d'autre, d'ouvrir uniquement la page staging prévue et de se connecter **avec ses propres identifiants**. Ne communiquer ni mot de passe ni réponses à ChatGPT. Ne pas changer les mots de passe ni demander la récupération durant ce contrôle : cela modifierait le compte staging et invaliderait la parité attendue. L'utilisateur peut transmettre uniquement le résultat `connexion OK` ou `connexion refusée`. Une erreur n'autorise aucune modification du site public.

## Statut historique avant exécution du job (référence)

`SOURCE_HISTORIC_ACCOUNT_EXISTS=YES`
`SOURCE_HISTORIC_ACCOUNT_CHANGED_SINCE_19OCT=NO`
`SYNTHETIC_AUTH_FULL_ROUNDTRIP=PASS_HISTORIC`
`REAL_VERIFIER_CROSS_PROVIDER_PARITY=PREPARED_NOT_YET_EXECUTED`
`REAL_HUMAN_PASSWORD_LOGIN=NOT_TESTED`
`PUBLIC_PRODUCTION_CUTOVER_AUTHORIZED=NO`

Ne pas fusionner dans `main`, toucher aux comptes réels, déclencher une remise à zéro de mot de passe, utiliser de vrais identifiants dans les logs ou désactiver Supabase.

## Statut consolidé après exécution

`HISTORICAL_ACCOUNT_PRESERVED=YES` · `PASSWORD_VERIFIER_PARITY=PASS` · `RECOVERY_VERIFIER_PARITY=PASS` · `LIVE_PUBLIC_MODE=UNIVERSAL` · `HUMAN_LOGIN_NOT_PART_OF_CURRENT_PUBLIC_MODE=YES` · `NO_PUBLIC_SITE_CHANGE=YES` · `NO_D1_WRITES=YES`.
