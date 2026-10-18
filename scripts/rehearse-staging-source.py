#!/usr/bin/env python3
"""Read-only source count + hash-verified offline D1 rehearsal. Never uploads personal data."""
import os,json,tempfile,pathlib,sqlite3,requests
from migration.export_celebrations_readonly import export,TABLES
from migration.stage_export_sqlite import stage
from migration.import_relational_sqlite import import_relational
url=os.environ["SUPABASE_URL"].rstrip("/")
key=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
if not url.startswith("https://"):raise RuntimeError("HTTPS Supabase URL required")
s=requests.Session();s.headers.update({"apikey":key,"Authorization":"Bearer "+key})
with tempfile.TemporaryDirectory(prefix="celebrations-private-rehearsal-") as tmp:
 p=pathlib.Path(tmp)
 # Step 1: read-only full source export; never upload artifacts.
 manifest=export(s,url,p/"export")
 counts={k:v["rows"] for k,v in manifest["tables"].items()}
 print("STEP_1_SOURCE_COUNTS "+json.dumps(counts,sort_keys=True),flush=True)
 if counts["celebrations_celebrations"]<1 or counts["celebrations_contents"]<1:
  raise RuntimeError("SOURCE_EMPTY: refusing staging import")
 # Step 2: verify SHA256, counts and import into a private disposable relational DB.
 staged=stage(p/"export",p/"raw.sqlite")
 relational=import_relational(p/"export",p/"relational.sqlite","migration/cloudflare/celebrations-schema.sql")
 db=sqlite3.connect(p/"relational.sqlite")
 verified={k:db.execute('SELECT COUNT(*) FROM "'+k+'"').fetchone()[0] for k in TABLES}
 if verified!=counts:raise RuntimeError("OFFLINE_COUNT_MISMATCH")
 if db.execute("PRAGMA foreign_key_check").fetchall():raise RuntimeError("OFFLINE_FK_FAILURE")
 print("STEP_2_OFFLINE_REHEARSAL "+json.dumps({"tables":staged["tables"],"rows":relational["rows"],"foreign_key_violations":0}),flush=True)
 # Step 3: readiness decision only. No remote writes, no secret-bearing artifacts.
 print("STEP_3_IMPORT_READINESS "+json.dumps({"source_verified":True,"offline_relational_verified":True,"remote_import_executed":False,"next_action":"Prepare isolated staging import after explicit staging preflight"}),flush=True)
