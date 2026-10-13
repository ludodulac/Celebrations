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
def fetch_table(session,base,table,page_size=500):
 offset=0
 while True:
  r=session.get(base+"/rest/v1/"+quote(table,safe=""),headers={"Range":f"{offset}-{offset+page_size-1}","Prefer":"count=exact"},params={"select":"*"},timeout=60)
  r.raise_for_status()
  rows=r.json()
  if not isinstance(rows,list):raise RuntimeError("Invalid table response")
  yield from rows
  if len(rows)<page_size:break
  offset+=len(rows)
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
