# CÉLÉBRATIONS — vérification unique d'intégrité du compte historique

- Comparer mathématiquement les empreintes dérivées du seul compte source aux empreintes sécurisées conservées dans D1 staging, sans connaître ni manipuler son vrai mot de passe.
- Vérifier le quota D1 gratuit **à l'échelle du compte Cloudflare** avant toute requête SQL ; s'arrêter si la marge n'est pas suffisante.
- Effectuer au maximum une requête `SELECT` D1 pour une ligne, aucune écriture, aucune tentative de connexion, aucun blocage de compte, aucune lecture R2, aucun changement du site public.
- Ne jamais publier l'adresse, les sels, les empreintes, les questions/réponses secrètes ni les valeurs privées.
- La validation du véritable mot de passe demandera ultérieurement un essai volontaire du titulaire, sans aucune transmission d'identifiants à ChatGPT.
