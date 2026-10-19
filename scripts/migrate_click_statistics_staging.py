#!/usr/bin/env python3
"""Transfer historic anonymous click/visit records to isolated staging D1.

All source reads are read-only. Conflicting destination IDs reject the import;
new rows are inserted idempotently; every original row is compared against the
D1 copy (not just counted). No raw visitors, links or tracking data in logs.
Does NOT alter production Supabase, sessions or R2.
"""
import json
import os
import re
from urllib.parse import urlparse
import requests

SOURCE=os.environ["SUPABASE_URL"].rstrip("/")
ACCOUNT=os.environ["CLOUDFLARE_ACCOUNT_ID"]
DB_ID=os.environ["STAGING_D1_ID"]
assert os.environ["STAGING_R2_BUCKET"]=="celebrations-exit-staging"
assert urlparse(SOURCE).hostname=="jwyayfkssyagvnablttg.supabase.co"
assert re.fullmatch(r"[a-f0-9]{32}",ACCOUNT,re.I)
assert re.fullmatch(r"[0-9a-f-]{36}",DB_ID,re.I)
cfh={"Authorization":"Bearer "+os.environ["CLOUDFLARE_API_TOKEN"]}
api=f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB_ID}"
identity=requests.get(api,headers=cfh,timeout=25).json()
assert identity.get("success") and identity.get("result",{}).get("name")=="celebrations-exit-staging"
sh={"apikey":os.environ["SUPABASE_SERVICE_ROLE_KEY"],
 "Authorization":"Bearer "+os.environ["SUPABASE_SERVICE_ROLE_KEY"]}
cols=["id","clicked_at","celebration_id","content_id","target_kind","target_label",
 "target_url","page_path","step_key","event_id","visitor_id"]
def d1(sql,params=()):
 response=requests.post(api+"/query",headers=cfh,json={"sql":sql,"params":list(params)},timeout=55)
 response.raise_for_status()
 data=response.json()
 if not data.get("success") or not data.get("result") or data["result"][0].get("success") is False:
  raise RuntimeError("Staging D1 analytics SQL unavailable")
 return data["result"][0].get("results",[])
def source_batch(offset,limit=400,max_id=None):
 params={"select":",".join(cols),"order":"id.asc","limit":limit,"offset":offset}
 if max_id is not None:params["id"]="lte."+str(max_id)
 r=requests.get(SOURCE+"/rest/v1/celebrations_clicks",headers=sh,params=params,timeout=50)
 r.raise_for_status()
 rows=r.json()
 assert isinstance(rows,list),"Unexpected statistics response"
 return rows
highwater=requests.get(SOURCE+"/rest/v1/celebrations_clicks",
 headers={**sh,"Prefer":"count=exact","Range":"0-0"},
 params={"select":"id","order":"id.desc","limit":"1"},timeout=35)
highwater.raise_for_status()
head=highwater.json()
assert head and isinstance(head,list),"Missing historical statistics"
max_id=int(head[0]["id"])
assert max_id>=11632,"Historical stats truncated unexpectedly"
# Stage only the source snapshot up to max_id. Newer production visits
# remain live and must be picked up by the FINAL migration sync.
rows=[]
offset=0
while True:
 chunk=source_batch(offset,400,max_id)
 if not chunk:break
 rows.extend(chunk);offset+=len(chunk)
 if len(chunk)<400:break
assert len(rows)>=11632 and len({r["id"] for r in rows})==len(rows),"Incomplete statistics inventory"
assert all(set(r)==set(cols) and 0<int(r["id"])<=max_id for r in rows)
# The staging site might have written its own early page views. Their SQLite
# row IDs can collide with source IDs. Refuse to overwrite any differing row.
keys=','.join('"'+k+'"' for k in cols)
sql='INSERT INTO celebrations_clicks ('+keys+') SELECT '+','.join(
 "json_extract(value, '$."+x+"')" for x in cols
 )+' FROM json_each(?) WHERE true ON CONFLICT(id) DO NOTHING'
def normalize(row):
 out=dict(row)
 out["id"]=int(out["id"])
 if out["celebration_id"] is not None:out["celebration_id"]=int(out["celebration_id"])
 return out
rows=[normalize(r) for r in rows]
# Compare existing IDs BEFORE any writes so a conflict cannot result in an
# accidental partial import. IDs from source span the original integer range.
existing_ids=set()
for i in range(0,len(rows),200):
 source_slice=rows[i:i+200]
 lo=min(r["id"] for r in source_slice);hi=max(r["id"] for r in source_slice)
 existing=d1("SELECT "+keys+" FROM celebrations_clicks WHERE id BETWEEN ? AND ? ORDER BY id",(lo,hi))
 src={r["id"]:r for r in source_slice}
 for found in existing:
  id_=int(found["id"])
  if id_ not in src:continue
  def norm_time(v):return str(v).replace(" ","T").replace("+00:00","Z").replace(".000Z","Z")
  a=src[id_];b=normalize(found)
  assert all((norm_time(a[k])==norm_time(b[k]) if k=="clicked_at" else a[k]==b[k])
   for k in cols),"Staging click ID conflicts with historic source; refuse overwrite"
  existing_ids.add(id_)
inserted=0
for i in range(0,len(rows),200):
 group=rows[i:i+200]
 # JSON1 batch insert, 200 records per request, no PII in logs.
 d1(sql,(json.dumps(group,separators=(",",":"),ensure_ascii=False),))
 inserted+=sum(r["id"] not in existing_ids for r in group)
 if (i//200+1)%15==0:print("STAGING_STATS_PROGRESS "+json.dumps({"verified_groups":i//200+1}),flush=True)
# Read ALL imported rows again and compare all fields, excluding the
# equivalent timezone spelling in clicked_at (Postgres vs SQLite).
verified=0
for i in range(0,len(rows),200):
 source_slice=rows[i:i+200]
 lo=source_slice[0]["id"];hi=source_slice[-1]["id"]
 reread=d1("SELECT "+keys+" FROM celebrations_clicks WHERE id BETWEEN ? AND ? ORDER BY id",(lo,hi))
 by_id={int(x["id"]):normalize(x) for x in reread}
 for row in source_slice:
  actual=by_id.get(row["id"])
  assert actual is not None,"Historical record missing from D1"
  for col in cols:
   a=row[col];b=actual[col]
   if col=="clicked_at":
    def iso(x):return str(x).replace(" ","T").replace("+00:00","Z").replace(".000Z","Z")
    assert iso(a)==iso(b),"Timestamp mismatch in staging D1"
   else:assert a==b,"Historical analytics field mismatch"
  verified+=1
assert verified==len(rows)
print("STAGING_STATS_HISTORICAL_MIGRATION "+json.dumps({
 "source_snapshot_rows":len(rows),"highwater_id":max_id,
 "destination_full_record_verified":verified,"newly_inserted":inserted,
 "production_writes":0,"future_new_rows_require_final_sync":True
}),flush=True)
