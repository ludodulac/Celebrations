#!/usr/bin/env python3
"""Prepare a safe, read-only staging R2 copy plan. No file contents, copies or ACL writes."""
import os,json,requests,boto3
from botocore.config import Config
from botocore.exceptions import ClientError
account=os.environ["CLOUDFLARE_ACCOUNT_ID"];token=os.environ["CLOUDFLARE_API_TOKEN"];db=os.environ["STAGING_D1_ID"]
endpoint=os.environ["R2_ENDPOINT"]
if not endpoint.startswith("https://") or ".r2.cloudflarestorage.com" not in endpoint:raise RuntimeError("Invalid R2 endpoint")
root=f"https://api.cloudflare.com/client/v4/accounts/{account}"
headers={"Authorization":"Bearer "+token}
r=requests.get(f"{root}/d1/database/{db}",headers=headers,timeout=25);r.raise_for_status();j=r.json()
if not j.get("success") or j["result"].get("name")!="celebrations-exit-staging" or j["result"].get("uuid")!=db:raise RuntimeError("Unsafe D1 target")
sql="""SELECT c.storage_path,c.cover_storage_path FROM celebrations_contents c
WHERE c.audience='all' AND (c.id IN (SELECT ec.content_id FROM celebrations_event_contents ec JOIN celebrations_events e ON ec.event_id=e.id WHERE e.audience='all') OR c.id IN (SELECT content_id FROM celebrations_step_contents))"""
r=requests.post(f"{root}/d1/database/{db}/query",headers=headers,json={"sql":sql},timeout=25);r.raise_for_status();j=r.json()
if not j.get("success"):raise RuntimeError("D1 query failed")
all_paths={v for row in j["result"][0]["results"] for v in (row["storage_path"],row["cover_storage_path"]) if v}
external={p for p in all_paths if p.startswith(("https://","http://","data:"))}
paths=all_paths-external
client=boto3.client("s3",endpoint_url=endpoint,aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],region_name="auto",config=Config(retries={"max_attempts":2}))
source=set()
for page in client.get_paginator("list_objects_v2").paginate(Bucket="celebrations-media"):
 source.update(x["Key"] for x in page.get("Contents",[]))
try:
 client.list_objects_v2(Bucket="celebrations-exit-staging",MaxKeys=1)
 target_access=True
except ClientError as e:
 target_access=False
 target_error=e.response.get("Error",{}).get("Code")
available=paths&source
missing=paths-source
print("STAGING_R2_COPY_PLAN "+json.dumps({"programme_r2_paths":len(paths),"external_urls_excluded":len(external),"available_source_objects":len(available),"unresolved_source_paths":len(missing),"destination_list_access":target_access,"destination_access_error":None if target_access else target_error,"copies_executed":0,"remote_writes":0}),flush=True)
if missing or not target_access:raise RuntimeError("COPY_BLOCKED: source missing references or destination permissions insufficient; no copy attempted")
