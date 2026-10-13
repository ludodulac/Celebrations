#!/usr/bin/env python3
"""Offline migration rehearsal into SQLite, NOT production schema.
Validates complete JSON export and hashes; stores source rows losslessly as JSON.
Does not assert SQL/transaction/auth compatibility with Cloudflare D1.
"""
import json,hashlib,sqlite3,sys,pathlib
try:
 from migration.export_celebrations_readonly import TABLES
except ModuleNotFoundError:
 from export_celebrations_readonly import TABLES
def stage(source,destination):
 source=pathlib.Path(source);destination=pathlib.Path(destination)
 if destination.exists():raise RuntimeError("Refusing overwrite")
 manifest=json.loads((source/"manifest.json").read_text())
 if not manifest.get("complete") or set(manifest["tables"])!=set(TABLES):raise RuntimeError("Incomplete source export")
 conn=sqlite3.connect(destination)
 try:
  conn.execute("PRAGMA foreign_keys=ON")
  conn.execute("CREATE TABLE staging_rows (table_name TEXT NOT NULL, row_number INTEGER NOT NULL, row_json TEXT NOT NULL, PRIMARY KEY(table_name,row_number))")
  conn.execute("CREATE TABLE staging_manifest (table_name TEXT PRIMARY KEY, row_count INTEGER NOT NULL, sha256 TEXT NOT NULL)")
  with conn:
   for table in TABLES:
    raw=(source/(table+".json")).read_bytes()
    if hashlib.sha256(raw).hexdigest()!=manifest["tables"][table]["sha256"]:raise RuntimeError("Export hash mismatch")
    rows=json.loads(raw)
    if not isinstance(rows,list) or len(rows)!=manifest["tables"][table]["rows"]:raise RuntimeError("Export row count mismatch")
    conn.executemany("INSERT INTO staging_rows VALUES (?,?,?)",[(table,i,json.dumps(row,sort_keys=True,ensure_ascii=False)) for i,row in enumerate(rows)])
    conn.execute("INSERT INTO staging_manifest VALUES (?,?,?)",(table,len(rows),manifest["tables"][table]["sha256"]))
  return {"tables":len(TABLES),"rows":sum(x["rows"] for x in manifest["tables"].values()),"staging_only":True}
 except Exception:
  conn.close()
  destination.unlink(missing_ok=True)
  raise
 finally:
  try:conn.close()
  except:pass
if __name__=="__main__":
 print(json.dumps(stage(sys.argv[1],sys.argv[2])))
