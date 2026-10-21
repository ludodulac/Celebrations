# CÉLÉBRATIONS — Mission 029 : restaurer le PDF public manquant dans le programme

Une inspection en lecture seule du site original a confirmé **une référence physique cassée dans le programme public** : la fiche « Pardon des Offenses — version raccourcie », reliée à une cérémonie du jeudi, désigne un fichier PDF absent du bucket original Supabase. Le total des 31 références absentes de l'audit précédent comprenait 30 entrées anciennes de galerie et ce fichier PDF. Un autre « manque » apparent était une couverture externe Google Drive et NON une clé R2 manquante.

Le connecteur Google Drive du propriétaire a trouvé le fichier exact **Pardon-des-Offenses-version-raccourcie.pdf** (1 189 910 octets, PDF), avec permission **anyone / reader** vérifiée. Son nom correspond exactement à la ressource source, et son utilisateur est propriétaire.

## Restauration ciblée sans écraser les originaux

Script scripts/recover_one_missing_public_pdf_to_private_production.py, job GH opt-in [PROD_RESCUE_ONE_PUBLIC_PDF_ONCE].

1. Relire les fiches de contenu et les relations source Supabase, vérifier que le PDF n'existe pas sous son chemin d'origine et que 158 objets restent intacts ; source 100 % lecture seule.
2. Vérifier la D1 production Europe et les identifiants strictement limités au seul R2 production. Protéger intégralement la liste déjà validée des 121 objets et 766 989 338 octets.
3. Télécharger **uniquement** le fichier public Drive identifié, sans cookie ni clé partagée, puis valider taille et signature de PDF. Si Google bloque la récupération, STOP sans aucune modification.
4. Insérer uniquement cet objet dans R2 production sous sa clé originale (si absent), puis contrôler son empreinte SHA256 après relecture complète.
5. Autoriser cette seule clé dans public_media (approved=1), puis vérifier HEAD 200 sur l'URL du Worker lecture seule. Les 121 originaux R2 restent inchangés.
6. Attendus en cas de réussite : **122 objets physiques R2** (121 initiaux + 1 restauré) et **113 objets explicitement publics** (112 initiaux + 1 restauré), neuf PDF comité inchangés. L'état source Supabase et staging ne change pas.

Aucun autre des 30 anciens visuels manquants n'est inventé, ni supprimé. Les autres liens Drive externes restent inchangés. **Ne pas annoncer la restauration réussie sans vrai job GitHub SUCCESS.**

Ce travail est une amélioration ciblée d'un lien précédemment cassé sur l'ancien site, et non une perte produite par la migration. Aucune modification du domaine, des comptes, des statistiques, des autres fichiers ou de GitHub main.