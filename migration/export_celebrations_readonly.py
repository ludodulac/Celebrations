#!/usr/bin/env python3
"""Read-only, paginated Supabase -> local JSON export for OFFLINE migration rehearsal.
Never commit or upload generated files; contains personal data and credential hashes.
Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in local/approved CI environment.
No database writes, no storage deletion, no automatic publication.
"""
import os,json,hashlib,pathlib,sys
from urllib.parse import quote
import requests
TABLES=(
 "celebrations_admin_sessions","celebrations_celebrations","celebrations_clicks",
 "celebrations_committee_letters","celebrations_contents","celebrations_event_contents",
 "celebrations_events","celebrations_footer_drafts","celebrations_groups",
 "celebrations_links","celebrations_participant_sessions","celebrations_participants",
 "celebrations_public_settings","celebrations_step_contents","celebrations_steps",
 "celebrations_user_profiles")
# Verified against the real PostgreSQL primary keys of all sixteen source
# tables on 2026-10-20. An unordered PostgREST offset is not a safe backup:
# the server may return rows in a different order between pages.
PRIMARY_KEYS={
 "celebrations_admin_sessions":("token_hash",),
 "celebrations_celebrations":("id",),
 "celebrations_clicks":("id",),
 "celebrations_committee_letters":("id",),
 "celebrations_contents":("id",),
 "celebrations_event_contents":("event_id","content_id"),
 "celebrations_events":("id",),
 "celebrations_footer_drafts":("id",),
 "celebrations_groups":("id",),
 "celebrations_links":("id",),
 "celebrations_participant_sessions":("token_hash",),
 "celebrations_participants":("email",),
 "celebrations_public_settings":("id",),
 "celebrations_step_contents":("celebration_id","step_key","content_id"),
 "celebrations_steps":("id",),
 "celebrations_user_profiles":("user_id",)
}
assert set(PRIMARY_KEYS)==set(TABLES),"Backup table/primary-key map drift"

def fetch_table(session,base,table,page_size=500):
 if table not in PRIMARY_KEYS or not 1<=page_size<=1000:
  raise ValueError("Unsupported backup table or page size")
 keys=PRIMARY_KEYS[table]
 offset=0;expected_total=None;seen=set()
 while True:
  r=session.get(base+"/rest/v1/"+quote(table,safe=""),
   headers={"Range":f"{offset}-{offset+page_size-1}","Prefer":"count=exact"},
   params={"select":"*","order":",".join(k+".asc" for k in keys)},timeout=60)
  r.raise_for_status()
  rows=r.json()
  if not isinstance(rows,list) or len(rows)>page_size:raise RuntimeError("Invalid table page")
  content_range=r.headers.get("Content-Range") if hasattr(r,"headers") else None
  if not isinstance(content_range,str):raise RuntimeError("Exact source row count missing")
  if not rows and offset==0 and content_range.strip() in ("*/0","0-0/0"):
   total=0
  else:
   import re
   match=re.fullmatch(r"(\d+)-(\d+)/(\d+)",content_range.strip())
   if not match:raise RuntimeError("Invalid backup Content-Range header")
   begin,end,total=map(int,match.groups())
   if begin!=offset or end!=offset+len(rows)-1 or total<offset+len(rows):
    raise RuntimeError("Unexpected backup Content-Range")
  if expected_total is None:expected_total=total
  elif expected_total!=total:raise RuntimeError("Source row count changed during backup")
  for row in rows:
   if not isinstance(row,dict) or any(k not in row or row[k] is None for k in keys):
    raise RuntimeError("Backup primary key missing")
   identity=tuple(row[k] for k in keys)
   if identity in seen:raise RuntimeError("Duplicate source row in paginated backup")
   seen.add(identity)
   yield row
  offset+=len(rows)
  if not rows or offset==expected_total:break
  if len(rows)<page_size:raise RuntimeError("Partial backup page before advertised row count")
 if len(seen)!=expected_total:raise RuntimeError("Backup count mismatch")
def export(session,base,output):
 output=pathlib.Path(output)
 if output.exists():raise RuntimeError("Output directory already exists; refusing overwrite")
 output.mkdir(mode=0o700,parents=True)
 report={"tables":{},"complete":False}
 try:
  for table in TABLES:
   rows=list(fetch_table(session,base,table))
   encoded=json.dumps(rows,ensure_ascii=False,separators=(",",":"),sort_keys=True).encode()
   path=output/(table+".json")
   fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
   with os.fdopen(fd,"wb") as f:f.write(encoded)
   report["tables"][table]={"rows":len(rows),"sha256":hashlib.sha256(encoded).hexdigest()}
  report["complete"]=True
 finally:
  (output/"manifest.json").write_text(json.dumps(report,indent=2))
  os.chmod(output/"manifest.json",0o600)
 return report
def main():
 base=os.environ["SUPABASE_URL"].rstrip("/")
 key=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
 session=requests.Session()
 session.headers.update({"apikey":key,"Authorization":"Bearer "+key})
 report=export(session,base,os.environ.get("CELEBRATIONS_EXPORT_DIR","private-celebrations-export"))
 print(json.dumps({"complete":report["complete"],"tables":{k:v["rows"] for k,v in report["tables"].items()}}))
if __name__=="__main__":main()
