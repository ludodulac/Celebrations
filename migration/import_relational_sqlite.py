#!/usr/bin/env python3
"""Import validated private JSON export into REAL relational SQLite/D1-compatible schema.
Offline only; output is sensitive. Fails closed on integrity errors and preserves IDs.
"""
import json,sqlite3,pathlib,sys,hashlib,os
try:
 from migration.export_celebrations_readonly import TABLES
except ModuleNotFoundError:
 from export_celebrations_readonly import TABLES
ORDER=("celebrations_celebrations","celebrations_contents","celebrations_groups",
"celebrations_participants","celebrations_public_settings","celebrations_user_profiles",
"celebrations_admin_sessions","celebrations_participant_sessions","celebrations_committee_letters",
"celebrations_footer_drafts","celebrations_steps","celebrations_events",
"celebrations_links","celebrations_event_contents","celebrations_step_contents","celebrations_clicks")
def import_relational(source,dest,schema):
 source=pathlib.Path(source);dest=pathlib.Path(dest)
 if dest.exists():raise ValueError("Refusing overwrite")
 manifest=json.loads((source/"manifest.json").read_text())
 if not manifest.get("complete") or set(manifest["tables"])!=set(TABLES):raise ValueError("Incomplete manifest")
 rows_by_table={}
 for table in ORDER:
  raw=(source/(table+".json")).read_bytes()
  if hashlib.sha256(raw).hexdigest()!=manifest["tables"][table]["sha256"]:raise ValueError("Hash mismatch")
  rows=json.loads(raw)
  if not isinstance(rows,list) or len(rows)!=manifest["tables"][table]["rows"]:raise ValueError("Count mismatch")
  rows_by_table[table]=rows
 conn=sqlite3.connect(dest)
 try:
  conn.executescript(pathlib.Path(schema).read_text())
  conn.execute("PRAGMA foreign_keys=ON")
  with conn:
   for table in ORDER:
    for row in rows_by_table[table]:
     keys=list(row)
     if not keys:raise ValueError("Empty row")
     values=[int(row[k]) if isinstance(row[k],bool) else row[k] for k in keys]
     quoted=lambda x:'"'+x.replace('"','""')+'"'
     conn.execute("INSERT INTO "+quoted(table)+" ("+",".join(map(quoted,keys))+") VALUES ("+",".join("?" for _ in keys)+")",values)
   errors=conn.execute("PRAGMA foreign_key_check").fetchall()
   if errors:raise ValueError("Foreign key violations")
  for table in ORDER:
   count=conn.execute('SELECT count(*) FROM "'+table+'"').fetchone()[0]
   if count!=len(rows_by_table[table]):raise ValueError("Count mismatch after import")
  return {"tables":len(ORDER),"rows":sum(map(len,rows_by_table.values())),"foreign_key_violations":0}
 except Exception:
  conn.close();dest.unlink(missing_ok=True);raise
 finally:conn.close()
if __name__=="__main__":
 print(json.dumps(import_relational(sys.argv[1],sys.argv[2],sys.argv[3])))
