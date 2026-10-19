#!/usr/bin/env python3
"""Read-only source bucket comparison; NOT proof of isolated staging availability."""
import os,json,requests,boto3
from botocore.config import Config
account=os.environ["CLOUDFLARE_ACCOUNT_ID"];token=os.environ["CLOUDFLARE_API_TOKEN"];db=os.environ["STAGING_D1_ID"]
api="https://api.cloudflare.com/client/v4"
r=requests.get(f"{api}/accounts/{account}/d1/database/{db}",headers={"Authorization":"Bearer "+token},timeout=30);r.raise_for_status();j=r.json()
if not j.get("success") or j["result"]["name"]!="celebrations-exit-staging":raise RuntimeError("Wrong D1")
sql="""SELECT c.storage_path,c.cover_storage_path FROM celebrations_contents c
WHERE c.audience='all' AND (c.id IN (SELECT ec.content_id FROM celebrations_event_contents ec JOIN celebrations_events e ON ec.event_id=e.id WHERE e.audience='all') OR c.id IN (SELECT content_id FROM celebrations_step_contents))"""
r=requests.post(f"{api}/accounts/{account}/d1/database/{db}/query",headers={"Authorization":"Bearer "+token},json={"sql":sql},timeout=30);r.raise_for_status();j=r.json()
if not j.get("success"):raise RuntimeError("D1 query failed")
all_paths={p for row in j["result"][0]["results"] for p in (row["storage_path"],row["cover_storage_path"]) if p}
external={p for p in all_paths if p.startswith(("https://","http://","data:"))}
paths=all_paths-external
client=boto3.client("s3",endpoint_url=os.environ["R2_ENDPOINT"],aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],region_name="auto",config=Config(retries={"max_attempts":3}))
source=set()
for page in client.get_paginator("list_objects_v2").paginate(Bucket="celebrations-media"):
 source.update(o["Key"] for o in page.get("Contents",[]) if not o["Key"].startswith("_validation-r2/"))
missing=sorted(paths-source)
diagnostics=[]
for path in missing:
 matching=[k for k in source if k.lower()==path.lower()]
 basename=path.rsplit("/",1)[-1].lower()
 candidates=[k for k in source if k.rsplit("/",1)[-1].lower()==basename]
 refs=[row for row in j["result"][0]["results"] if path in (row["storage_path"],row["cover_storage_path"])]
 diagnostics.append({"path":path,"case_insensitive_match":matching,"same_filename_candidates":candidates[:10],"referenced_as":["cover" if row["cover_storage_path"]==path else "media" for row in refs]})
print("SOURCE_R2_COMPARISON "+json.dumps({"public_programme_paths":len(paths),"external_urls_not_r2":len(external),"source_bucket_objects":len(source),"present_in_source":len(paths&source),"missing_in_source":len(missing),"staging_bucket_not_verified":True,"read_only":True}),flush=True)
print("MISSING_MEDIA_DIAGNOSTIC "+json.dumps(diagnostics,ensure_ascii=False),flush=True)
if missing:raise RuntimeError("Programme media references missing from source bucket; review diagnostics before copy")
