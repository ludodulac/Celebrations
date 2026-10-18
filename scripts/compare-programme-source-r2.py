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
paths={p for row in j["result"][0]["results"] for p in (row["storage_path"],row["cover_storage_path"]) if p}
client=boto3.client("s3",endpoint_url=os.environ["R2_ENDPOINT"],aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],region_name="auto",config=Config(retries={"max_attempts":3}))
source=set()
for page in client.get_paginator("list_objects_v2").paginate(Bucket="celebrations-media"):
 source.update(o["Key"] for o in page.get("Contents",[]) if not o["Key"].startswith("_validation-r2/"))
print("SOURCE_R2_COMPARISON "+json.dumps({"public_programme_paths":len(paths),"source_bucket_objects":len(source),"present_in_source":len(paths&source),"missing_in_source":len(paths-source),"staging_bucket_not_verified":True,"read_only":True}),flush=True)
if paths-source:raise RuntimeError("Some programme references missing in source bucket; do not copy blindly")
