# M012-A — Contrat D1 pour le véritable éditeur (Construction B)

**Aucun accès nouveau au site officiel.** Le vrai éditeur visuel est rendu par
`handlePreparationDemo()`; son cookie `celebrations_editor_access` est un accès au
rendu et aux fonctions éditoriales historiques, pas une session D1. L'ancien
`admin-auth.js` parle à Supabase. Aucun de ces deux éléments ne peut être converti
en session D1. L'utilisateur doit saisir explicitement le **mot de passe
administrateur D1**, et non supposer que le code PIN historique est le même.
Pas de liaison automatique par email ni de changement de droits.

## URL et environnement

- POST /api/admin/editor-session, JSON, HTTPS, même origine, aucun CORS.
- Pour test isolé seulement, les trois variables doivent être explicitement définies :
  MEMBER_DIRECTORY_API_ENABLED=true, MEMBER_DIRECTORY_API_HOST=<hôte isolé exact>,
  EDITOR_D1_SESSION_API_ENABLED=true.
- Secret serveur obligatoire EDITOR_D1_CHALLENGE_SECRET : 32 octets aléatoires
  indépendants (64 hex minuscules), conservés dans les secrets Worker, jamais
  envoyés au client. Ne pas réutiliser ADMIN_PASSWORD_HASH. Le défi est signé
  avec cette clé distincte pour ne pas publier un vérificateur du mot de passe.
  Aucun secret réel configuré dans cette mission.
- Les deux hôtes officiels, les candidats read-only et l'ancien staging restent
  exclus, même avec tous les drapeaux. Le staging Worker permet de servir le
  véritable HTML /__editor/demo-preparation sur un hôte isolé; le production
  Worker ne le sert pas sur un hôte arbitraire. Ne pas détourner les hôtes actuels.
- La nouvelle migration additive 20261111_012a_editor_admin_challenges.sql
  doit être appliquée **uniquement sur D1 locale** dans cette mission. Elle
  ne crée ni compte ni table de session parallèle.

## Protocole et contrat précis

1. POST {action:"challenge"} sans Authorization. Réponse 200 :
   {ok:true,salt,challenge,iterations:180000,expires_in:120}. Défi aléatoire,
   signé par le secret serveur indépendant, valable 120 s, lié à l'origine HTTPS, sans écriture D1 à l'émission.
2. Dans la mémoire de l'interface, dériver **le même** PBKDF2-SHA256 que
   auth-api.mjs : password UTF-8, salt UTF-8 (ne pas décoder le sel hex),
   180000 itérations, 256 bits, puis hexadécimal minuscule. Le résultat est
   une clé sensible; ne jamais l'envoyer, la conserver ni la journaliser.
   Calculer HMAC-SHA256, clé = UTF-8 de cet hex, message =
   "celebrations-admin-login-v1:"+location.origin+":"+challenge, résultat hex.
3. POST {action:"login",challenge,response} sans Authorization.
   Réponse 200 {ok:true,email:"admin@celebrations.local",token,expires_at}.
   Le serveur vérifie la preuve liée au défi, bloque les échecs via le
   mécanisme D1 existant, consomme le défi une seule fois, puis émet une
   session dans celebrations_admin_sessions (seul SHA256(token) en base).
   Le principal est fixé côté serveur : pas d'email/role fourni par le client.
4. POST {action:"session"} avec Authorization: Bearer <token> :
   200 {ok:true,email,expires_at} si toujours valide. Le jeton n'est pas
   renvoyé. POST {action:"logout"} avec le même header : suppression
   immédiate en D1. Après 401 effacer le jeton et demander une nouvelle
   authentification, sans refaire automatiquement une écriture.
5. Le token expire après 12 h comme les sessions existantes. Aucun refresh
   silencieux. Renouvellement explicite : recommencer challenge/login avec
   le mot de passe, ajouter l'ancien Authorization uniquement à login.
   Le serveur remplace atomiquement le hash de l'ancienne session; l'ancien
   bearer devient inutilisable. Si déjà expiré/révoqué, effacer le bearer,
   demander un nouveau défi et une nouvelle authentification sans header.
6. Pour M011-A : GET /api/admin/member-directory?action=snapshot (puis les
   commandes POST documentées en M011-A), Authorization: Bearer <token>.
   Pas de token dans URL, cookie, localStorage/sessionStorage, IndexedDB,
   export, console, DOM ou analytics. Garder le token dans une fermeture JS
   en mémoire; vider en cas de logout, 401 ou fermeture/rechargement.
   Utiliser fetch same-origin, cache:"no-store", redirect:"error",
   credentials:"omit" sur ces appels. Les appels POST du navigateur
   envoient automatiquement Origin. Ne jamais copier un bearer vers un autre
   domaine ou réessayer une mutation sur 401.
7. Déconnexion de l'espace membres = révoquer la session D1 d'abord, puis
   effacer le token même si la requête échoue; la déconnexion historique de
   l'éditeur peut ensuite être effectuée séparément. Si le réseau échoue,
   signaler que la révocation serveur n'est pas confirmée.

Exemple de calcul (à intégrer par B, non un troisième écran ou stockage) :

```js
const enc = new TextEncoder();
const hex = buffer => Array.from(new Uint8Array(buffer),
  x => x.toString(16).padStart(2,"0")).join("");
async function answerChallenge(password, challenge, salt, origin) {
  const passwordKey = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = hex(await crypto.subtle.deriveBits({
    name:"PBKDF2",salt:enc.encode(salt),iterations:180000,hash:"SHA-256"
  }, passwordKey,256));
  const hmacKey = await crypto.subtle.importKey(
    "raw",enc.encode(derived),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return hex(await crypto.subtle.sign("HMAC",hmacKey,enc.encode(
    "celebrations-admin-login-v1:"+origin+":"+challenge)));
}
```

Le mot de passe et la clé dérivée doivent être abandonnés après le calcul.
Le client ne doit pas conserver ni réutiliser la réponse au défi.

## Limites et décision de sécurité

- 400 requête malformée, 401 identifiants/session/défi refusés, 403 origine
  interdite, 404 fonctionnalité non activée, 405 méthode interdite,
  429 verrouillage existant, 503 service indisponible.
- Un bearer dérobé reste par nature rejouable jusqu'à révocation/expiration.
  Aucun secret n'est durable dans le navigateur; HTTPS, origine stricte,
  no-store, rotation et révocation réduisent le risque. Les réponses au
  défi ne sont pas réutilisables. Cela ne remplace pas une protection XSS.
- Le transport historique /api/auth n'est pas modifié fonctionnellement :
  ses deux logins admin réutilisent le même générateur de session. Son
  ancien admin_login_derived transmet une preuve réutilisable; **ne pas
  utiliser cette action depuis le nouvel éditeur**. Une éventuelle migration
  des clients historiques et rotation des secrets est une mission distincte.
- Le code PIN/cookie historique n'est ni affaibli ni utilisé pour délivrer
  une session. Pas de déploiement, pas de migration distante, pas de main.
- Avant activation réelle : consolidation B/C, revue sécurité, vérification
  des secrets et du mécanisme de révocation/connexion sur un environnement
  isolé, validation de l'interface et autorisation explicite.
