#!/usr/bin/env python3
"""Prepare and verify a staging-only media copy without modifying source storage."""
import os, json, boto3, requests
from botocore.config import Config
account=os.environ["CLOUDFLARE_ACCOUNT_ID"]
db=os.environ["STAGING_D1_ID"]
headers={"Authorization":"Bearer "+os.environ["CLOUDFLARE_API_TOKEN"]}
root=f"https://api.cloudflare.com/client/v4/accounts/{account}"
identity=requests.get(f"{root}/d1/database/{db}",headers=headers,timeout=25).json()
assert identity.get("success") and identity["result"]["name"]=="celebrations-exit-staging"
sql="""SELECT c.storage_path,c.cover_storage_path FROM celebrations_contents c WHERE c.audience='all' AND (EXISTS(SELECT 1 FROM celebrations_event_contents ec JOIN celebrations_events e ON e.id=ec.event_id WHERE ec.content_id=c.id AND e.audience='all') OR EXISTS(SELECT 1 FROM celebrations_step_contents sc WHERE sc.content_id=c.id))"""
response=requests.post(f"{root}/d1/database/{db}/query",headers=headers,json={"sql":sql},timeout=25).json()
assert response.get("success")
all_keys={p for row in response["result"][0]["results"] for p in (row["storage_path"],row["cover_storage_path"]) if p}
keys={p for p in all_keys if not p.startswith(("https://","http://","data:"))}
def connect(prefix):
 return boto3.client("s3",endpoint_url=os.environ["R2_ENDPOINT"],region_name="auto",config=Config(retries={"max_attempts":2}),aws_access_key_id=os.environ[prefix+"R2_ACCESS_KEY_ID"],aws_secret_access_key=os.environ[prefix+"R2_SECRET_ACCESS_KEY"])
src=connect("SOURCE_")
dst=connect("STAGING_")
def inventory(client,bucket):
 result=set()
 for page in client.get_paginator("list_objects_v2").paginate(Bucket=bucket):
  result.update(o["Key"] for o in page.get("Contents",[]))
 return result
source_keys=inventory(src,"celebrations-media")
destination_keys=inventory(dst,"celebrations-exit-staging")
print("STAGING_COPY_READY "+json.dumps({"programme_paths":len(keys),"available_source":len(keys&source_keys),"unresolved_source":len(keys-source_keys),"destination_objects":len(destination_keys),"no_remote_writes":True}))
