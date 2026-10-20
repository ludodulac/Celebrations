#!/usr/bin/env python3
"""STEP 6 — Narrow, crash-safe Supabase -> ISOLATED Cloudflare staging delta sync.

Source is READ ONLY; production Cloudflare, main, and real domains are NEVER
modified. User-authored D1 legal drafts, participant hashes, sessions, active
admin state and staging-only content are explicitly excluded from this sync.

1. Preflight: compare all 9 SOURCE public programme tables field-by-field
   with their staging D1 counterparts; abort without writes on ANY drift.
2. Confirm all 158 original Supabase R2 object keys+sizes present in PRIVATE
   staging bucket (no recopy, overwrite or delete).
3. Import only newly added original click records (id>11632) idempotently
   as NEGATIVE D1 primary keys, so staging's own positive incrementing IDs
   can never clash. A negative ID uniquely maps to an original positive ID.
4. Verify every imported full record. Print COUNTS ONLY, never personal data.

This is a pre-cutover staging sync, NOT a final production cutover. A final
delta sync remains necessary while the original public site is still live.
"""
import collections
import json
import os
import re
import sys
from urllib.parse import quote, urlsplit

import boto3
import requests
from botocore.config import Config

SOURCE=os.environ["SUPABASE_URL"].rstrip("/")
ACCOUNT=os.environ["CLOUDFLARE_ACCOUNT_ID"]
DB_ID=os.environ["STAGING_D1_ID"]
BUCKET=os.environ["STAGING_R2_BUCKET"]
R2_URL=os.environ["R2_ENDPOINT"]
assert urlsplit(SOURCE).scheme=="https" and urlsplit(SOURCE).hostname=="jwyayfkssyagvnablttg.supabase.co"
assert re.fullmatch(r"[0-9a-f]{32}",ACCOUNT,re.I)
assert re.fullmatch(r"[0-9a-f-]{36}",DB_ID,re.I)
assert BUCKET=="celebrations-exit-staging", "PRODUCTION BUCKET REFUSED"
assert urlsplit(R2_URL).hostname==ACCOUNT+".r2.cloudflarestorage.com"
assert os.environ.get("GITHUB_REF")=="refs/heads/feat/celebrations-supabase-exit-001", "PRODUCTION BRANCH REFUSED"
MODE=os.environ.get("CELEBRATIONS_DELTA_APPLY","DRY_RUN")
assert MODE in ("DRY_RUN","SAFE_STAGING_COPY")
CF=f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB_ID}"
cfh={"Authorization":"Bearer "+os.environ["CLOUDFLARE_API_TOKEN"]}
info=requests.get(CF,headers=cfh,timeout=25);info.raise_for_status()
identity=info.json()
assert identity.get("success") and identity.get("result",{}).get("name")=="celebrations-exit-staging","WRONG_D1_DATABASE"
ses=requests.Session()
ses.headers.update({"apikey":os.environ["SUPABASE_SERVICE_ROLE_KEY"],
 "Authorization":"Bearer "+os.environ["SUPABASE_SERVICE_ROLE_KEY"]})

# Full cross-provider comparison for editorial data. Leave SOURCE and D1
# rows intact when any source/staging difference needs human reconciliation.
PROGRAMME_TABLES=(
 "celebrations_celebrations","celebrations_groups","celebrations_public_settings",
 "celebrations_steps","celebrations_events","celebrations_contents",
 "celebrations_step_contents","celebrations_event_contents","celebrations_links"
)
NEVER_TOUCH={
 "celebrations_footer_drafts","celebrations_participants",
 "celebrations_participant_sessions","celebrations_admin_sessions",
 "celebrations_committee_letters","celebrations_user_profiles"
}
for table in PROGRAMME_TABLES:
 assert re.fullmatch("celebrations_[a-z_]+",table) and table not in NEVER_TOUCH

reads=0;writes=0
def d1(sql,params=(),max_reads=6000,allow_write=False):
 global reads,writes
 if not allow_write:
  assert sql.lstrip().upper().startswith("SELECT "),"READ_ONLY_D1_PREFLIGHT"
 else:
  assert MODE=="SAFE_STAGING_COPY"
  assert sql.lstrip().upper().startswith(("INSERT INTO celebrations_clicks ","INSERT INTO celebrations_public_settings ","WITH CHANGES AS (SELECT JSON_EXTRACT(")),"ONLY_WHITELISTED_D1_WRITES_ALLOWED"
 response=requests.post(CF+"/query",headers=cfh,json={"sql":sql,"params":list(params)},timeout=45)
 response.raise_for_status()
 result=response.json()
 assert result.get("success") and len(result.get("result",[]))==1 and result["result"][0].get("success") is True,"D1_QUERY_FAILED"
 payload=result["result"][0]
 metrics=payload.get("meta",{})
 nr=int(metrics.get("rows_read",0));nw=int(metrics.get("rows_written",0))
 assert 0<=nr<=max_reads and 0<=nw<=1000,"D1_QUERY_QUOTA_BUDGET_EXCEEDED"
 if not allow_write:assert nw==0,"READONLY_QUERY_WROTE_ROWS"
 reads+=nr;writes+=nw
 assert reads<=18000 and writes<=300,"TOTAL_D1_QUOTA_BUDGET_EXCEEDED"
 return payload.get("results",[])

def source_table(table,select="*",filters=None,limit=500):
 out=[];offset=0
 while True:
  params={"select":select,"limit":min(limit,500),"offset":offset}
  if filters:params.update(filters)
  resp=ses.get(SOURCE+"/rest/v1/"+table,params=params,timeout=45)
  resp.raise_for_status();rows=resp.json()
  assert isinstance(rows,list),"SOURCE_ROWS_INVALID"
  out.extend(rows)
  assert len(out)<=30000,"SOURCE_TABLE_UNEXPECTEDLY_LARGE"
  if len(rows)<min(limit,500):break
  offset+=len(rows)
 return out

def canon_value(k,v):
 if k in ("created_at","updated_at"):return "__TIMESTAMP_IGNORED_FOR_FIDELITY__"
 if isinstance(v,bool):return int(v)
 if isinstance(v,float) and v.is_integer():return int(v)
 if isinstance(v,(dict,list)):return json.dumps(v,sort_keys=True,ensure_ascii=False)
 return v

def canonical_table(rows):
 return collections.Counter(
  json.dumps({key:canon_value(key,value) for key,value in sorted(row.items())
   if key not in ("created_at","updated_at")},
   ensure_ascii=False,sort_keys=True,separators=(",",":"))
  for row in rows
 )

programme_counts={}
missing_setting=None
pending_orders={}
for table in PROGRAMME_TABLES:
 src=source_table(table)
 assert len(src)<=500, "SOURCE_PROGRAMME_GREW_TOO_LARGE"
 source_columns=sorted(src[0].keys()) if src else []
 sql="SELECT "+(",".join(chr(34)+c+chr(34) for c in source_columns) if source_columns else "1")+" FROM "+chr(34)+table+chr(34)+" LIMIT 501"
 dst=d1(sql)
 assert len(dst)<=500,"STAGING_PROGRAMME_GREW_TOO_LARGE"
 if table=="celebrations_public_settings" and len(src)==1 and len(dst)==0:
  assert int(src[0]["id"])==1 and isinstance(src[0]["show_other_celebrations"],bool), "Invalid source public setting"
  missing_setting=src[0]
 elif table=="celebrations_links" and len(src)==len(dst):
  # Links may be recreated with new AUTOINCREMENT keys by the original
  # migration, but stable content/placement must still match exactly.
  def canonical_links(rows,excluded):
   return collections.Counter(json.dumps({
    k:canon_value(k,v) for k,v in sorted(row.items()) if k not in excluded
   },sort_keys=True,ensure_ascii=False) for row in rows)
  canonical_exclude={"id","created_at","updated_at"}
  if canonical_links(src,canonical_exclude)==canonical_links(dst,canonical_exclude):
   print("STAGING_DELTA_LEGACY_LINK_IDS_DIFFER_BUT_CONTENT_EQUALS "+json.dumps({"links":len(src),"safe_without_reindexing":True}),flush=True)
  else:
   # Only numeric summaries, NEVER titles/URLs.
   semantic_src=canonical_links(src,canonical_exclude|{"sort_order"})
   semantic_dst=canonical_links(dst,canonical_exclude|{"sort_order"})
   print("STAGING_DELTA_LINK_DIAGNOSTIC "+json.dumps({
    "source_links":len(src),"staging_links":len(dst),
    "content_equal_excluding_source_autonumber":False,
    "content_equal_excluding_order_and_autonumber":semantic_src==semantic_dst,
    "source_unique_semantic_links":len(semantic_src),
    "staging_unique_semantic_links":len(semantic_dst),
    "source_urls_exposed":False
   }),flush=True)
   raise RuntimeError("SOURCE_STAGING_LINK_DIFFERENCE_STOP")
 elif len(src)==len(dst) and canonical_table(src)!=canonical_table(dst) and source_columns and "sort_order" in source_columns:
  # Only reorder existing programme rows, never overwrite editable content.
  # Row IDs, all other fields and row counts must match exactly.
  def identity(row):
   cols=(("event_id","content_id") if table=="celebrations_event_contents" else
    ("celebration_id","step_key","content_id") if table=="celebrations_step_contents" else ("id",))
   return tuple(row[k] for k in cols)
  sr={identity(x):x for x in src};dr={identity(x):x for x in dst}
  candidate=[]
  if len(sr)==len(src) and sr.keys()==dr.keys():
   for key in sr:
    before=dr[key];after=sr[key]
    fields=set(before)|set(after)
    changed=[column for column in fields if column not in ("created_at","updated_at") and canon_value(column,before.get(column))!=canon_value(column,after.get(column))]
    if changed==["sort_order"] and isinstance(before["sort_order"],int) and isinstance(after["sort_order"],int):
     candidate.append({"key":list(key),"old":before["sort_order"],"new":after["sort_order"]})
    elif changed:
     candidate=[]
     break
  if candidate and len(candidate)<=500:
   # Validate that replacing ONLY the ordering field achieves 100% parity.
   normalized_dst=[dict(row) for row in dst]
   for row in normalized_dst:row["sort_order"]=sr[identity(row)]["sort_order"]
   assert canonical_table(src)==canonical_table(normalized_dst),"ORDER_ONLY_RECONCILIATION_INCOMPLETE"
   pending_orders[table]=candidate
  else:
   print("STAGING_DELTA_NON_ORDER_CONFLICT "+json.dumps({"table":table,"source_rows":len(src),"staging_rows":len(dst),"no_writes":True}),flush=True)
   raise RuntimeError("SOURCE_STAGING_PROGRAMME_DIFFERENCE_STOP")
 elif len(src)!=len(dst) or canonical_table(src)!=canonical_table(dst):
  # Diagnose only field NAMES, never content titles or private URLs.
  def identity(row):
   return json.dumps([row.get(x) for x in (
    ("event_id","content_id") if table=="celebrations_event_contents" else
    ("celebration_id","step_key","content_id") if table=="celebrations_step_contents" else
    ("id",))],ensure_ascii=False,sort_keys=True)
  sr={identity(x):x for x in src};dr={identity(x):x for x in dst}
  discrepancies=collections.Counter()
  for key in sr.keys()&dr.keys():
   discrepancies.update(k for k in sr[key] if k not in ("created_at","updated_at") and canon_value(k,sr[key].get(k))!=canon_value(k,dr[key].get(k)))
  print("STAGING_DELTA_PROGRAMME_CONFLICT "+json.dumps({
   "table":table,"source_rows":len(src),"staging_rows":len(dst),
   "source_rows_missing_in_D1":len(sr.keys()-dr.keys()),
   "D1_only_rows":len(dr.keys()-sr.keys()),
   "changed_field_counts":dict(discrepancies),
   "source_editorial_values_exposed":False,
   "possible_concurrent_edit":True,"write_performed":False
  }),flush=True)
  raise RuntimeError("SOURCE_STAGING_PROGRAMME_DIFFERENCE_STOP")
 programme_counts[table]=len(src)
print("STAGING_DELTA_PROGRAMME_PARITY "+json.dumps({
 "tables":len(PROGRAMME_TABLES),"total_original_rows":sum(programme_counts.values()),
 "counts":programme_counts,
 "programmes_identical_except_one_missing_staging_visibility_setting":True,
 "missing_original_visibility_settings":int(missing_setting is not None),
 "staging_order_only_differences":{k:len(v) for k,v in pending_orders.items()},
 "source_rows_mutated":0,"staging_programme_rows_mutated":0
},sort_keys=True),flush=True)

# Object-key manifest comparison. Never recopy 830 MB already SHA256-verified
# on 20 Oct; storage objects unchanged since 11 Oct. Staging-only extra media
# are permitted, but are NEVER deleted or rewritten.
SOURCE_BUCKET="celebrations-media"
def storage_inventory(prefix=""):
 result={};offset=0
 while True:
  response=ses.post(f"{SOURCE}/storage/v1/object/list/{SOURCE_BUCKET}",
   json={"prefix":prefix,"limit":100,"offset":offset,"sortBy":{"column":"name","order":"asc"}},timeout=40)
  response.raise_for_status()
  rows=response.json()
  assert isinstance(rows,list),"SOURCE_STORAGE_LIST_INVALID"
  for r in rows:
   name=r.get("name")
   if not name or name==".emptyFolderPlaceholder":continue
   key=prefix+name
   assert ".." not in key.split("/") and len(key)<1024
   if r.get("id") is None:
    sub=storage_inventory(key+"/")
    assert not set(result).intersection(sub),"DUPLICATE_STORAGE_SUBFOLDER"
    result.update(sub)
   else:
    assert key not in result,"DUPLICATE_SOURCE_R2_OBJECT"
    size=(r.get("metadata") or {}).get("size")
    assert size is not None
    result[key]=int(size)
  if len(rows)<100:break
  offset+=len(rows)
 return result

r2=boto3.client("s3",endpoint_url=R2_URL,region_name="auto",
 aws_access_key_id=os.environ["STAGING_R2_ACCESS_KEY_ID"],
 aws_secret_access_key=os.environ["STAGING_R2_SECRET_ACCESS_KEY"],
 config=Config(retries={"max_attempts":3,"mode":"standard"}))
r2.head_bucket(Bucket=BUCKET)
source_media=storage_inventory()
assert len(source_media)==158 and sum(source_media.values())==830312417, "SOURCE_OBJECT_MANIFEST_CHANGED_STOP"
staging_media={}
for page in r2.get_paginator("list_objects_v2").paginate(Bucket=BUCKET):
 for entry in page.get("Contents",[]):
  key=entry["Key"]
  assert key not in staging_media,"DUPLICATE_STAGING_R2_OBJECT"
  staging_media[key]=int(entry["Size"])
different=[k for k,size in source_media.items() if staging_media.get(k)!=size]
assert not different, "STAGING_PRIVATE_R2_INCOMPLETE_OR_SIZE_CONFLICT"
print("STAGING_DELTA_MEDIA_MANIFEST "+json.dumps({
 "original_files":158,"verified_key_size_matches":158,
 "source_bytes":830312417,
 "additional_staging_files_preserved":len(set(staging_media)-set(source_media)),
 "media_copies_or_deletions":0,"SHA256_verified_in_prior_stage":True
}),flush=True)

# Historical original click records <=11632 already copied and individually
# checked in the completed Step 4. Import only the new SOURCE IDs, mapping
# integer original ID 11633 -> -11633 to avoid colliding with D1's own
# page-view auto-increment IDs. The negative identity stays stable at reruns.
CLICK_COLUMNS=("id","clicked_at","celebration_id","content_id","target_kind",
 "target_label","target_url","page_path","step_key","event_id","visitor_id")
src_clicks=source_table("celebrations_clicks",select=",".join(CLICK_COLUMNS),
 filters={"id":"gt.11632","order":"id.asc"},limit=500)
assert len(src_clicks)<=250,"TOO_MANY_PENDING_CLICKS_FOR_SINGLE_SAFE_DELTA"
assert len({int(r["id"]) for r in src_clicks})==len(src_clicks),"DUPLICATE_SOURCE_CLICK"
assert all(int(r["id"])>11632 and set(r)==set(CLICK_COLUMNS) for r in src_clicks),"INVALID_SOURCE_CLICK"
mapped=[{**r,"id":-int(r["id"])} for r in src_clicks]
# Timestamp spellings may differ, but compare the instant, not the string.
from datetime import datetime,timezone
def time_value(x):
 return datetime.fromisoformat(str(x).replace("Z","+00:00").replace(" ","T")).astimezone(timezone.utc)
def equal_click(a,b):
 for col in CLICK_COLUMNS:
  if col=="clicked_at":
   if time_value(a[col])!=time_value(b[col]):return False
  elif a[col]!=b[col]:return False
 return True

identities=[r["id"] for r in mapped]
existing={}
for i in range(0,len(mapped),80):
 group=mapped[i:i+80]
 if not group:continue
 sql="SELECT "+",".join('"'+k+'"' for k in CLICK_COLUMNS)+   " FROM celebrations_clicks WHERE id IN ("+",".join("?" for _ in group)+")"
 rows=d1(sql,[r["id"] for r in group])
 existing.update({int(x["id"]):x for x in rows})
for row in mapped:
 if row["id"] in existing:
  assert equal_click(row,existing[row["id"]]),"EXISTING_NEGATIVE_CLICK_CONFLICT_STOP"

missing=[r for r in mapped if r["id"] not in existing]
assert len(missing)<=250
print("STAGING_DELTA_STATISTICS_PREFLIGHT "+json.dumps({
 "source_new_rows":len(src_clicks),"already_mirrored":len(mapped)-len(missing),
 "pending_copy":len(missing),"staging_click_id_namespace":"negative_source_ids",
 "source_clicks_written":0,"other_tables_written":0
}),flush=True)
if MODE=="DRY_RUN":
 print("STAGING_DELTA_DRY_RUN_PASSED "+json.dumps({"staging_writes":0,
 "source_programme_rows":sum(programme_counts.values()),"missing_visibility_setting":int(missing_setting is not None),"pending_sort_order_repairs":{k:len(v) for k,v in pending_orders.items()},"source_new_click_rows":len(src_clicks)}))
 sys.exit(0)

# One JSON1-statement per relation table, atomic and conditionally scoped.
# No editorial field may be updated. A changed ORDER since audit is a
# concurrency conflict: the exact key+old_order must match in UPDATE WHERE.
for table,changes in pending_orders.items():
 assert table in PROGRAMME_TABLES and all(re.fullmatch(r"celebrations_[a-z_]+",table) for _ in changes)
 ids=(("event_id","content_id") if table=="celebrations_event_contents" else
  ("celebration_id","step_key","content_id") if table=="celebrations_step_contents" else ("id",))
 assert all(len(change["key"])==len(ids) for change in changes)
 match=" AND ".join("json_extract(c.value,'$.key["+str(i)+"]')="+table+"."+chr(34)+col+chr(34) for i,col in enumerate(ids))
 sql=("WITH changes AS (SELECT json_extract(value,'$.old') AS prior, json_extract(value,'$.new') AS next_order, "
      +",".join("json_extract(value,'$.key["+str(i)+"]') AS "+col for i,col in enumerate(ids))
      +" FROM json_each(?)) UPDATE "+table+
      " SET sort_order=(SELECT next_order FROM changes WHERE "+
      " AND ".join("changes."+col+"="+table+"."+col for col in ids)+
      " AND changes.prior="+table+".sort_order) WHERE EXISTS"
      " (SELECT 1 FROM changes WHERE "+
      " AND ".join("changes."+col+"="+table+"."+col for col in ids)+
      " AND changes.prior="+table+".sort_order) RETURNING sort_order")
 assert sql.startswith("WITH changes AS (SELECT json_extract(")
 changed=d1(sql,(json.dumps(changes,separators=(",",":")),),allow_write=True,max_reads=10000)
 assert len(changed)==len(changes),"ORDER_CONCURRENT_EDIT_OR_D1_MISMATCH_STOP"
 print("STAGING_DELTA_SORT_ORDER_RESTORED "+json.dumps({"table":table,"rows":len(changed)}),flush=True)

if missing_setting is not None:
 # The sole previously unimported source row affects public programme
 # visibility. Copy only id=1, never change an existing administrator setting.
 saved=d1("INSERT INTO celebrations_public_settings(id,show_other_celebrations,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING",
  (1,int(missing_setting["show_other_celebrations"]),missing_setting["updated_at"]),allow_write=True)
 check=d1("SELECT id,show_other_celebrations FROM celebrations_public_settings WHERE id=1")
 assert len(check)==1 and int(check[0]["show_other_celebrations"])==int(missing_setting["show_other_celebrations"]), "VISIBILITY_SETTING_SYNC_FAILED"
if missing:
 sql="INSERT INTO celebrations_clicks ("+",".join('"'+c+'"' for c in CLICK_COLUMNS)+   ") SELECT "+",".join("json_extract(value,'$."+c+"')" for c in CLICK_COLUMNS)+   " FROM json_each(?) WHERE true ON CONFLICT(id) DO NOTHING"
 for i in range(0,len(missing),60):
  d1(sql,(json.dumps(missing[i:i+60],ensure_ascii=False,separators=(",",":")),),allow_write=True)
# Always verify EVERY original additional row on D1, not only aggregate counts.
verified={}
for i in range(0,len(mapped),80):
 group=mapped[i:i+80]
 if not group:continue
 sql="SELECT "+",".join('"'+k+'"' for k in CLICK_COLUMNS)+   " FROM celebrations_clicks WHERE id IN ("+",".join("?" for _ in group)+")"
 for row in d1(sql,[r["id"] for r in group]):
  verified[int(row["id"])]=row
assert len(verified)==len(mapped),"STAGING_DELTA_VERIFICATION_COUNT_FAILED"
assert all(equal_click(row,verified[row["id"]]) for row in mapped),"STAGING_DELTA_FULL_RECORD_VERIFICATION_FAILED"
print("STAGING_DELTA_SAFE_SYNC_SUCCESS "+json.dumps({
 "programme_tables_checked":len(PROGRAMME_TABLES),
 "programme_rows_checked":sum(programme_counts.values()),
 "missing_original_visibility_setting_restored":int(missing_setting is not None),
 "sort_order_values_reconciled":{k:len(v) for k,v in pending_orders.items()},
 "private_source_files_in_staging":len(source_media),
 "new_original_clicks":len(src_clicks),"new_click_records_inserted":len(missing),
 "all_incremental_click_records_verified":len(verified),
 "source_mutations":0,"production_mutations":0,
 "staging_legal_drafts_mutations":0,"staging_participants_mutations":0,
 "staging_media_mutations":0,"D1_reported_rows_read":reads,
 "D1_reported_rows_written":writes,
 "future_final_cutover_sync_still_required":True
},sort_keys=True),flush=True)
