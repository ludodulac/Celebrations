#!/usr/bin/env python3
"""Build verified *public-programme-only* staging SQL. No participant/session/click/committee data.
Read-only source; writes only a disposable local SQL file. Never commit generated SQL.
"""
import os,json,tempfile,pathlib,sqlite3,requests
from migration.export_celebrations_readonly import export
from migration.import_relational_sqlite import import_relational
PUBLIC=("celebrations_celebrations","celebrations_contents","celebrations_groups","celebrations_steps","celebrations_events","celebrations_links","celebrations_event_contents","celebrations_step_contents")
SENSITIVE=("celebrations_participants","celebrations_participant_sessions","celebrations_admin_sessions","celebrations_user_profiles","celebrations_clicks","celebrations_committee_letters")
url=os.environ["SUPABASE_URL"].rstrip("/");key=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
s=requests.Session();s.headers.update({"apikey":key,"Authorization":"Bearer "+key})
with tempfile.TemporaryDirectory(prefix="celebrations-import-plan-") as t:
 root=pathlib.Path(t);manifest=export(s,url,root/"source")
 # The existing full relational rehearsal is performed privately before selecting safe tables.
 result=import_relational(root/"source",root/"full.sqlite","migration/cloudflare/celebrations-schema.sql")
 conn=sqlite3.connect(root/"full.sqlite");conn.row_factory=sqlite3.Row
 if conn.execute("PRAGMA foreign_key_check").fetchall():raise RuntimeError("FK failed")
 expected={table:manifest["tables"][table]["rows"] for table in PUBLIC}
 if not expected["celebrations_celebrations"] or not expected["celebrations_contents"]:raise RuntimeError("Empty programme")
 lines=["BEGIN TRANSACTION;"]
 for table in PUBLIC:
  rows=conn.execute('SELECT * FROM "'+table+'"').fetchall()
  for row in rows:
   cols=list(row.keys())
   quote=lambda v:"NULL" if v is None else str(int(v)) if isinstance(v,(int,bool)) else "'"+str(v).replace("'","''")+"'"
   lines.append('INSERT INTO "'+table+'" ('+','.join('"'+c+'"' for c in cols)+') VALUES ('+','.join(quote(row[c]) for c in cols)+');')
 lines.append("COMMIT;")
 output=pathlib.Path(os.environ.get("STAGING_IMPORT_SQL","/tmp/celebrations-public-staging-import.sql"))
 if output.exists():raise RuntimeError("Refusing overwrite")
 output.write_text("\n".join(lines)+"\n");output.chmod(0o600)
 print("STAGING_PUBLIC_IMPORT_PLAN "+json.dumps({"tables":expected,"excluded_sensitive_tables":list(SENSITIVE),"sql_statements":len(lines)-2,"remote_writes":0,"local_sql_ready":True}))
