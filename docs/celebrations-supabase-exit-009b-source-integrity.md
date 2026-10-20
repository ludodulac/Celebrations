# CÉLÉBRATIONS — Contrôle réel en lecture seule (20 octobre 2026)

Projet source : Supabase `jwyayfkssyagvnablttg` (nom affiché « La forêt enchantée »). Source toujours active. Ce contrôle n'a exécuté que des `SELECT` sur PostgreSQL : **aucune écriture**.

## Résultats

- **0** événement orphelin de célébration.
- **0** étape orpheline de célébration.
- **0** association événement-contenu sans événement.
- **0** association événement-contenu sans contenu.
- **0** lien éditorial vers un événement disparu.
- **0** lien éditorial vers une célébration disparue.
- **0** session participant rattachée à un participant disparu.
- **146** chemins de fichier dans les contenus, **34** chemins de couverture et **9** chemins PDF de comité. Ce sont des **références**, pas 189 objets distincts ; plusieurs chemins peuvent être partagés. Les 158 originaux du bucket avaient été comparés par SHA-256 dans le run [39333819255](https://github.com/ludodulac/Celebrations/actions/runs/39333819255).
- **11 683** clics présents lors du relevé source. Dernier checkpoint source repris en staging : **11 648**, soit **35 clics à resynchroniser** à cet instant. Ce total évolue au fil des visites.

**Décision :** les associations éditoriales testées ne présentent aucune rupture d'intégrité. Cela ne vérifie pas l'existence HTTP de chaque média ni une sauvegarde restaurable. Ne pas basculer à partir de ce seul relevé.

## Garde-fous

- Source non modifiée, aucun D1 / R2 / Worker / DNS touché.
- `main` et la branche de migration restent inchangées.
- Le projet Supabase héberge aussi d'autres tables hors CÉLÉBRATIONS : ne pas le suspendre après la migration sans audit séparé.
- **Ne pas copier les données personnelles ou les empreintes de mot de passe dans des logs, des PR ou des rapports publics.**
