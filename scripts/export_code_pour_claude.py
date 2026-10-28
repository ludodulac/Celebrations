#!/usr/bin/env python3
"""Create shareable, auditable Claude handoff ZIP from tracked source + compiled live assets.
No credentials, no D1/R2 exports, no remote writes, no Cloudflare access.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import re
import subprocess
import zipfile

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"claude-export"
ZIP=ROOT/"CELEBRATIONS_CODE_COMPLET_ADMIN_CLAUDE_2026-10-28.zip"
PREFIX="CELEBRATIONS_POUR_CLAUDE"
PRODUCTION=ROOT/"production-public"
TEXT_EXT={".html",".css",".js",".mjs",".json",".py",".sql",".toml",".yaml",".yml",".md",".ts",".tsx",".txt",".sh"}
DOCS={
  "README.md","AI_START_HERE.md","PROJECT_MAP.md","PARKED_FEATURES.md",
  "docs/celebrations-mission-10-admin-stats-invitations-settings-legal.md",
  "docs/celebrations-2026-10-26-cutover-step-by-step-no-execution.md",
  "docs/celebrations-supabase-exit-033-editable-admin-candidate.md",
  "docs/celebrations-isolated-production-worker-precutover.md",
}
EXCLUDED_DIRS={".git","node_modules",".venv","venv","__pycache__","production-public","staging-public","legacy-main","legacy-assets","claude-export"}
EXCLUDED_NAMES={".env",".env.local","credentials.json","service-account.json","private-key.pem"}
SECRET_PATTERNS=[
 re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
 re.compile(rb"(?<![A-Za-z0-9_])(?:ghp_|github_pat_|sk_live_|sb_secret_)[A-Za-z0-9_\-]{12,}"),
 re.compile(rb"(?i)(?:service_role_key|r2_secret_access_key|backup_passphrase)\s*[:=]\s*['\"][^$][A-Za-z0-9_\-]{32,}['\"]"),
]
def is_safe_text(path:Path):
 if any(part in EXCLUDED_DIRS or part.startswith(".") for part in path.parts):
  return False
 if path.name in EXCLUDED_NAMES or path.suffix.lower() not in TEXT_EXT:
  return False
 if path.parts[0]=="docs" and path.as_posix() not in DOCS:
  return False
 if path.parts[0]=="tests":return True
 if path.parts[0]=="scripts":return True
 if path.parts[0]=="migration":return True
 if len(path.parts)==1:return True
 # Preserve explicit route HTML and other web code only.
 if path.parts[0] in {"programme","preparation","mercredi","jeudi","vendredi","samedi",
                      "dimanche","apres-celebration","bibliotheque","apres-la-ronde"}:return True
 return False

def read_checked(path:Path):
 data=path.read_bytes()
 if len(data)>2_000_000:raise ValueError("Unexpected oversized source: "+path.name)
 for pattern in SECRET_PATTERNS:
  if pattern.search(data):raise ValueError("Potential hard-coded secret; abort export: "+path.name)
 return data

INTRO="""# CÉLÉBRATIONS — CODE SOURCE POUR CLAUDE
État du 28 octobre 2026. Transfert de contexte pour discuter de la **refonte de l'administration**, SANS modifier le site vivant.

## Quel dossier lire d'abord ?
1. `README_CLAUDE.md` (ce fichier).
2. `site-actuel-cloudflare/admin.html` : interface **réellement servie par Cloudflare** (générée à partir du dépôt).
3. `site-actuel-cloudflare/admin-*.js`, `admin-*.css`, `admin-auth.js`, `admin-connect.js`, `supabase-client.js` (le dernier est réécrit/bridé pour Cloudflare).
4. `backend-cloudflare/production-worker.mjs` et `backend-cloudflare/admin-api.mjs`, `auth-api.mjs`, `media-admin-api.mjs`, `safe-save-api.mjs`, `footer-admin-api.mjs`, `participants-admin-api.mjs`, `stats-api.mjs`, `public-data-api.mjs`.
5. `sources-historiques/` : code lisible du dépôt d'origine, utile pour comprendre le développement et les anciennes dépendances Supabase. **Ne pas confondre avec l'application déployée.**
6. `tests-et-construction/` : scripts de génération et tests. `contexte-projet/` : contexte et règles documentées.

## Architecture effective
- **Site public** : domaine `ronde-des-archanges-universelle.eu`, également `www.ronde-des-archanges-universelle.eu`.
- **Application** : Worker Cloudflare `celebrations-exit-production` + assets HTML/CSS/JavaScript.
- **Base** : Cloudflare D1 (données éditoriales, authentification, participants, statistiques, brouillons).
- **Médias** : Cloudflare R2 avec garde d'accès et métadonnées D1.
- **Administration** : `/admin` ou `/admin.html`, authentification par mot de passe dérivé et sessions gérées par le Worker; logique UI dans les scripts admin. Les modifications ne passent plus par Supabase sur le site officiel.
- **Documents du comité** : 9 PDF, liens à conserver, notamment le format historique `/?lettre=<slug>` et l'ancien hôte `celebrations.rondes.workers.dev`.
- **Mails** : domaine `nation-essenienne.eu` / Brevo indépendants. Ne rien toucher.
- **Site ancien** : GitHub Pages/Supabase conservés comme secours et pour d'autres dépendances historiques; leur suppression n'est **pas** incluse.

## Ce que le propriétaire a déjà vérifié
- Domaine principal + www, navigation téléphone et ordinateur, 10 routes / 7 jours de programme.
- Médias publics 113/113, 9 liens PDF du comité sur ancien/nouveau hôtes.
- Connexion administration, rubriques Statistiques et Liens du comité.
- Enregistrement persistant d'un **brouillon privé** des mentions légales, puis suppression de la ligne de test, publication désactivée.
- 11 973 événements historiques Supabase et 24 nouveaux événements D1 préservés au contrôle du 28 octobre (nombre évolutif).

## Cadre de la refonte demandée
**Objectif immédiat : discuter/planifier la refonte de l'expérience administrateur avec Claude.**
1. Commencer par **analyser** l'interface existante, ses onglets/actions, flux de données et protections.
2. Proposer une navigation et des écrans plus lisibles sans retirer les fonctions existantes.
3. Distinguer fonctions actives, fonctions volontairement masquées, et idées seulement envisagées.
4. Préserver le modèle `contenu canonique → association/audience → visibilité → expérience rendue`.
5. Conserver les 9 PDF et leurs anciens liens, les médias, les comptes/sessions, les statistiques, les contenus, les dates et les règles de visibilité.
6. Ne jamais réactiver les réglages cachés ou publier des brouillons juridiques incomplets.
7. Ne pas modifier DNS, comptes mail/Brevo, Supabase d'autres projets, Cloudflare en production, ni mots de passe.
8. Pour une proposition de développement, fournir d'abord : parcours actuels, problèmes précis, maquettes conceptuelles, plan par étapes, tests de non-régression.
9. Toute évolution de code doit ensuite être préparée sur une branche/test isolé avant décision explicite du propriétaire.

## Périmètre de ce ZIP
Contient le **code public/client réel compilé localement pour le déploiement Cloudflare**; les sources d'origine; les modules API Worker/D1/R2; les tests et scripts de build; une sélection de documents projet.
N'inclut **aucun** secret, mot de passe, clé d'API, session, base D1 exportée, sauvegarde Supabase, média R2 privé, PDF privé réel, identifiant de visiteur, ni fichier .git.
Les médias binaires hébergés sur R2 ne peuvent être livrés comme sources code : références de chemins présentes mais fichiers absents.
Ce ZIP est un **instantané du dépôt + génération hors ligne**, pas un nouveau déploiement ni une sauvegarde exhaustive de données privées.
"""

PROMPT="""# MESSAGE À DONNER À CLAUDE
Je te fournis le ZIP contenant le site CÉLÉBRATIONS et **l'administration actuellement en production sur Cloudflare**.
Lis d'abord README_CLAUDE.md, puis site-actuel-cloudflare/admin.html et les scripts admin qu'il importe, puis les API Cloudflare.

Je veux discuter d'une **refonte complète de l'interface d'administration** : simplicité, organisation des sections, réduction du nombre de clics, clarté des éditions, sans perte des fonctions existantes.
Commence par faire l'inventaire précis de ce qui existe réellement, des flux d'enregistrement et des points fragiles. Propose une architecture d'interface et un plan de refonte, mais ne modifie pas le code et ne déploie rien tant que je n'ai pas validé.
Respecte les invariants du README (liens des 9 PDF, comptes, historiques, contenus, médias, visibilité).
Sépare ce que le code prouve de tes hypothèses et des améliorations que tu proposes.
"""

def main():
 if not (PRODUCTION/"admin.html").is_file():raise ValueError("First build production assets offline")
 commit=subprocess.check_output(["git","rev-parse","HEAD"],cwd=ROOT,text=True).strip()
 tracked=subprocess.check_output(["git","ls-files","-z"],cwd=ROOT).split(b"\0")
 payload={}
 payload["README_CLAUDE.md"]=INTRO.encode()
 payload["MESSAGE_POUR_CLAUDE.md"]=PROMPT.encode()
 for rel_raw in tracked:
  if not rel_raw:continue
  rel=Path(rel_raw.decode())
  if not is_safe_text(rel):continue
  source=ROOT/rel
  if not source.is_file():continue
  if rel.parts[0]=="migration":group="backend-cloudflare"
  elif rel.parts[0] in {"scripts","tests"}:group="tests-et-construction"
  elif rel.parts[0]=="docs" or rel.name in {"README.md","AI_START_HERE.md","PROJECT_MAP.md","PARKED_FEATURES.md"}:group="contexte-projet"
  else:group="sources-historiques"
  payload[f"{group}/{rel.as_posix()}"]=read_checked(source)
 for path in sorted(PRODUCTION.rglob("*")):
  if not path.is_file():continue
  relative=path.relative_to(PRODUCTION)
  if path.suffix.lower() not in TEXT_EXT:continue
  payload["site-actuel-cloudflare/"+relative.as_posix()]=read_checked(path)

 # Validate the exact application layers are present and code is not empty.
 required=[
  "site-actuel-cloudflare/index.html",
  "site-actuel-cloudflare/admin.html",
  "site-actuel-cloudflare/admin-auth.js",
  "site-actuel-cloudflare/admin-v3.js",
  "site-actuel-cloudflare/migration/cloudflare/preview-client.js",
  "backend-cloudflare/migration/cloudflare/production-worker.mjs",
  "backend-cloudflare/migration/cloudflare/admin-api.mjs",
  "backend-cloudflare/migration/cloudflare/auth-api.mjs",
  "backend-cloudflare/migration/cloudflare/safe-save-api.mjs",
  "tests-et-construction/scripts/build_production_assets.py",
 ]
 for key in required:
  if key not in payload:raise ValueError("Missing essential code file: "+key)
 files=list(payload.items())
 index={
  "archive_utc":datetime.now(timezone.utc).isoformat(),
  "github_repo":"ludodulac/Celebrations",
  "source_branch":"feat/celebrations-supabase-exit-001",
  "commit_sha":commit,
  "production_assets":"Generated locally with scripts/build_production_assets.py",
  "includes_database_or_r2_binary_data":False,
  "files":len(payload),
  "bytes":sum(len(b) for _,b in files),
  "groups":{},
 }
 for name,data in files:
  group=name.split("/")[0] if "/" in name else "_GUIDES_"
  index["groups"][group]=index["groups"].get(group,0)+1
 payload["INVENTAIRE.json"]=json.dumps(index,ensure_ascii=False,indent=2).encode()
 digest="".join(hashlib.sha256(data).hexdigest()+"  "+name+"\n" for name,data in sorted(payload.items()))
 payload["SHA256SUMS.txt"]=digest.encode()
 ZIP.parent.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(ZIP,"w",compression=zipfile.ZIP_DEFLATED,compresslevel=8) as out:
  for name,data in sorted(payload.items()):
   out.writestr(PREFIX+"/"+name,data)
 with zipfile.ZipFile(ZIP) as archive:
  if archive.testzip() is not None:raise ValueError("Archive CRC failed")
 print("CELEBRATIONS_CLAUDE_HANDOFF_ZIP_PASS "+json.dumps({
  "archive":ZIP.name,"git_head":commit,"source_files":index["files"],"source_bytes":index["bytes"],
  "zip_bytes":ZIP.stat().st_size,"groups":index["groups"],"no_secrets_or_private_data_included":True
 },ensure_ascii=False))

if __name__=="__main__":
 main()
