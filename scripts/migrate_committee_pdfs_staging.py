#!/usr/bin/env python3
"""Import exactly the 9 existing committee PDF link records to isolated staging
D1 after verifying the immutable bytes already copied into PRIVATE staging R2.
Preserve original IDs, slugs, titles, filenames and link permissions. No prod
changes, no source mutations, no R2 deletion and no PDF data in CI logs.
"""
import hashlib
import json
import os
import re
import secrets
from urllib.parse import urlsplit,quote

import boto3
import requests
from botocore.config import Config

ACCOUNT=os.environ["CLOUDFLARE_ACCOUNT_ID"]
DB_ID=os.environ["STAGING_D1_ID"]
BUCKET=os.environ["STAGING_R2_BUCKET"]
SOURCE=os.environ["SUPABASE_URL"].rstrip("/")
assert BUCKET=="celebrations-exit-staging"
assert re.fullmatch(r"[a-f0-9]{32}",ACCOUNT,re.I)
assert re.fullmatch(r"[a-f0-9-]{36}",DB_ID,re.I)
assert urlsplit(SOURCE).hostname=="jwyayfkssyagvnablttg.supabase.co"
assert urlsplit(os.environ["R2_ENDPOINT"]).hostname==ACCOUNT+".r2.cloudflarestorage.com"
api=f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB_ID}"
headers={"Authorization":"Bearer "+os.environ["CLOUDFLARE_API_TOKEN"]}
identity=requests.get(api,headers=headers,timeout=25).json()
assert identity.get("success") and identity.get("result",{}).get("name")=="celebrations-exit-staging"
r2=boto3.client("s3",endpoint_url=os.environ["R2_ENDPOINT"],region_name="auto",
 aws_access_key_id=os.environ["STAGING_R2_ACCESS_KEY_ID"],
 aws_secret_access_key=os.environ["STAGING_R2_SECRET_ACCESS_KEY"],
 config=Config(retries={"max_attempts":3}))
r2.head_bucket(Bucket=BUCKET)
s=requests.Session()
s.headers.update({"apikey":os.environ["SUPABASE_SERVICE_ROLE_KEY"],
 "Authorization":"Bearer "+os.environ["SUPABASE_SERVICE_ROLE_KEY"]})
source=s.get(SOURCE+"/rest/v1/celebrations_committee_letters",
 params={"select":"id,title,file_name,storage_path,mime_type,created_at,slug","limit":"100"},
 timeout=45)
source.raise_for_status()
rows=source.json()
assert isinstance(rows,list) and len(rows)==9,"Unexpected source committee record count"
slugs=set();ids=set();paths=set()
for row in rows:
 assert set(("id","title","file_name","storage_path","mime_type","created_at","slug")).issubset(row)
 assert isinstance(row["id"],str) and row["id"] and len(row["id"])<=128
 assert isinstance(row["title"],str) and row["title"]
 assert isinstance(row["file_name"],str) and row["file_name"].lower().endswith(".pdf")
 assert isinstance(row["storage_path"],str) and re.fullmatch(r"committee/[a-zA-Z0-9_./-]+",row["storage_path"])
 assert ".." not in row["storage_path"].split("/")
 assert isinstance(row["slug"],str) and re.fullmatch("[a-z0-9_-]{1,159}",row["slug"])
 assert row["mime_type"]=="application/pdf"
 assert row["id"] not in ids and row["slug"] not in slugs and row["storage_path"] not in paths
 ids.add(row["id"]);slugs.add(row["slug"]);paths.add(row["storage_path"])
 obj=r2.get_object(Bucket=BUCKET,Key=row["storage_path"])
 try:
  leading=obj["Body"].read(8)
  assert leading.startswith(b"%PDF-"),"Staging committee object is not PDF"
 finally:obj["Body"].close()
print("STAGING_COMMITTEE_SOURCE_VERIFIED "+json.dumps({"records":len(rows),"private_r2_objects":len(paths),"duplicate_slugs":0}),flush=True)

def query(sql,params=()):
 res=requests.post(api+"/query",headers=headers,json={"sql":sql,"params":list(params)},timeout=40)
 res.raise_for_status()
 body=res.json()
 if not body.get("success") or not body.get("result") or body["result"][0].get("success") is False:
  raise RuntimeError("Staging D1 query failed")
 return body["result"][0].get("results",[])
# Fail-closed: do not import when staging already uses a legacy slug or
# storage object for a different committee document.
for row in rows:
 existing=query("SELECT id,slug,storage_path,title,file_name,mime_type FROM celebrations_committee_letters WHERE id=? OR slug=? OR storage_path=?",
   (row["id"],row["slug"],row["storage_path"]))
 assert not existing or (len(existing)==1 and all(str(existing[0][k])==str(row[k]) for k in ("id","slug","storage_path","title","file_name","mime_type"))),(
  "Staging committee record conflict: refusing overwrite")
 acl=query("SELECT slug,storage_path,published,revoked_at FROM committee_media WHERE slug=? OR storage_path=?",
  (row["slug"],row["storage_path"]))
 assert not acl or (len(acl)==1 and acl[0]["slug"]==row["slug"] and acl[0]["storage_path"]==row["storage_path"]
  and int(acl[0]["published"])==1 and not acl[0]["revoked_at"]),(
  "Existing committee ACL differs or is revoked: refusing accidental re-publication")
if os.environ.get("CELEBRATIONS_COMMITTEE_APPLY")!="COPY_AND_VERIFY":
 print("STAGING_COMMITTEE_PREFLIGHT_ONLY "+json.dumps({"docs":len(rows),"safe":True}),flush=True)
 raise SystemExit(0)
for row in rows:
 query("""INSERT INTO celebrations_committee_letters
  (id,title,file_name,storage_path,mime_type,created_at,slug)
  VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING""",
  tuple(row[x] for x in ("id","title","file_name","storage_path","mime_type","created_at","slug")))
 query("""INSERT INTO committee_media(slug,storage_path,published,revoked_at)
  VALUES(?,?,1,NULL) ON CONFLICT(slug) DO NOTHING""",(row["slug"],row["storage_path"]))
verified=0
for row in rows:
 check=query("""SELECT c.id,c.slug,c.storage_path,c.title,c.file_name,c.mime_type,
 m.published,m.revoked_at FROM celebrations_committee_letters c
 JOIN committee_media m ON m.slug=c.slug WHERE c.id=?""",(row["id"],))
 assert len(check)==1 and all(str(check[0][k])==str(row[k])
  for k in ("id","slug","storage_path","title","file_name","mime_type"))
 assert int(check[0]["published"])==1 and not check[0]["revoked_at"]
 url="https://celebrations-exit-staging.rondes.workers.dev/letter/"+quote(row["slug"],safe="")
 response=requests.head(url,timeout=30,allow_redirects=False)
 assert response.status_code==200 and response.headers.get("content-type","").startswith("application/pdf"),(
  "Staging private-PDF link not serving PDF")
 verified+=1
assert verified==9
print("STAGING_COMMITTEE_MIGRATED "+json.dumps({
 "records":len(rows),"r2_pdfs":len(paths),"original_slugs_preserved":verified,
 "working_staging_pdf_links":verified,"source_writes":0,"production_writes":0}),flush=True)
