#!/usr/bin/env python3
"""Read-only access evidence collection. Never grants public status from a public URL."""
import os,json,hashlib,requests,collections
from urllib.parse import quote
URL=os.environ["SUPABASE_URL"].rstrip("/")
KEY=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
BUCKET="celebrations-media"
s=requests.Session();s.headers.update({"apikey":KEY,"Authorization":"Bearer "+KEY})
def req(method,path,**kw):
 r=s.request(method,URL+path,timeout=90,**kw);r.raise_for_status();return r.json()
def list_files(prefix=""):
 out=[];offset=0
 while True:
  rows=req("POST",f"/storage/v1/object/list/{BUCKET}",json={"prefix":prefix,"limit":100,"offset":offset})
  for x in rows:
   if not x.get("name") or x["name"]==".emptyFolderPlaceholder":continue
   path=prefix+x["name"]
   if x.get("id") is None:out.extend(list_files(path+"/"))
   else:out.append({"path":path,"size":(x.get("metadata") or {}).get("size")})
  if len(rows)<100:break
  offset+=len(rows)
 return out
def table(name):
 out=[];offset=0
 while True:
  r=s.get(URL+"/rest/v1/"+name,params={"select":"*","offset":offset,"limit":1000},timeout=90)
  if r.status_code in (401,403,404):return None
  r.raise_for_status();data=r.json();out.extend(data)
  if len(data)<1000:break
  offset+=len(data)
 return out
files=list_files()
names=["celebrations_contents","celebrations_events","celebrations_event_contents","celebrations_step_contents","celebrations_steps","celebrations_groups","celebrations_celebrations"]
tables={name:table(name) for name in names}
refs=collections.defaultdict(list)
for table_name,rows in tables.items():
 if rows is None:continue
 for row in rows:
  for col in ("storage_path","cover_storage_path"):
   if isinstance(row.get(col),str) and row[col]:
    refs[row[col]].append({"table":table_name,"column":col,"record_id":str(row.get("id","")),"audience":row.get("audience"),"source_type":row.get("source_type"),"content_type":row.get("content_type")})
records=[]
for f in sorted(files,key=lambda x:x["path"]):
 path=f["path"];linked=refs.get(path,[])
 # A direct HTTP 200 only demonstrates accessibility, never publication permission.
 public_url=URL+"/storage/v1/object/public/"+BUCKET+"/"+quote(path,safe="/")
 try:
  r=requests.get(public_url,headers={"Range":"bytes=0-0"},timeout=20,stream=True,allow_redirects=False)
  access={"status":r.status_code,"content_range_present":"Content-Range" in r.headers}
  r.close()
 except requests.RequestException as e:access={"status":"ERROR","error_type":type(e).__name__}
 # No explicit authoritative publish authorization available from these tables.
 records.append({"path":path,"size":f["size"],"classification":"UNCERTAIN","reason":"No independently verified per-object publication authorization","references":linked,"unauthenticated_direct_access":access})
report={"schema_version":1,"source_files":len(files),"source_bytes":sum(int(f["size"] or 0) for f in files),"historical_files":158,"historical_bytes":830312417,"tables":{k:{"readable":v is not None,"rows":len(v) if v is not None else None} for k,v in tables.items()},"storage_policies":{"status":"NOT_AVAILABLE_VIA_STORAGE_REST","reason":"pg_policies and storage.objects RLS cannot be read from Storage REST API with these credentials"},"counts":{"PUBLIC_CONFIRMED":0,"RESTRICTED_CONFIRMED":0,"UNCERTAIN":len(files)},"files":records,"unreferenced_files":sum(not x["references"] for x in records),"notes":["HTTP accessibility does not imply authorization to publish","No file is classified public without explicit per-object permission evidence","Report may contain sensitive object paths; keep artifact private"]}
with open("r2-021-access-evidence.json","w") as f:json.dump(report,f,ensure_ascii=False,indent=2,default=str)
print("ACCESS_AUDIT_SUMMARY "+json.dumps({"files":len(files),"bytes":report["source_bytes"],"classified":report["counts"],"unreferenced":report["unreferenced_files"],"tables":report["tables"],"policies":report["storage_policies"]["status"]}))
