#!/usr/bin/env python3
"""Read-only: compare all programme-linked D1 paths with isolated staging R2 keys.
No object bodies, no writes, no personal records, no public paths in logs.
"""
import os,json,requests,boto3
from botocore.config import Config
account=os.environ["CLOUDFLARE_ACCOUNT_ID"];token=os.environ["CLOUDFLARE_API_TOKEN"];db=os.environ["STAGING_D1_ID"]
bucket=os.environ["STAGING_R2_BUCKET"]
if bucket!="celebrations-exit-staging":raise RuntimeError("Unsafe bucket")
root="https://api.cloudflare.com/client/v4"
headers={"Authorization":"Bearer "+token}
def query(sql):
 r=requests.post(f"{root}/accounts/{account}/d1/database/{db}/query",headers=headers,json={"sql":sql},timeout=30)
 r.raise_for_status();j=r.json()
 if not j.get("success"):raise RuntimeError("D1 query failed")
 return j["result"][0]["results"]
identity=requests.get(f"{root}/accounts/{account}/d1/database/{db}",headers=headers,timeout=30).json()
if not identity.get("success") or identity["result"]["name"]!="celebrations-exit-staging" or identity["result"]["uuid"]!=db:raise RuntimeError("Wrong database")
rows=query("""SELECT DISTINCT c.storage_path AS storage_path,c.cover_storage_path AS cover_storage_path
FROM celebrations_contents c
JOIN celebrations_event_contents ec ON ec.content_id=c.id
JOIN celebrations_events e ON e.id=ec.event_id
WHERE c.audience='all' AND e.audience='all'
UNION
SELECT DISTINCT c.storage_path,c.cover_storage_path FROM celebrations_contents c
JOIN celebrations_step_contents sc ON sc.content_id=c.id WHERE c.audience='all'""")
all_paths={p for row in rows for p in (row["storage_path"],row["cover_storage_path"]) if p}
external={p for p in all_paths if p.startswith(("https://","http://","data:"))}
paths=all_paths-external
# Check bucket identity with staging-scoped Cloudflare token independently of S3 credentials.
bucket_response=requests.get(f"{root}/accounts/{account}/r2/buckets/{bucket}",headers=headers,timeout=30)
if bucket_response.status_code==403:
 print("STAGING_R2_BUCKET_METADATA_BLOCKED "+json.dumps({"reason":"staging API token lacks R2 bucket read permission","no_remote_writes":True}),flush=True)
elif bucket_response.ok:
 metadata=bucket_response.json()
 if not metadata.get("success") or metadata.get("result",{}).get("name")!=bucket:raise RuntimeError("Staging bucket metadata identity mismatch")
 print("STAGING_R2_BUCKET_EXISTS "+json.dumps({"bucket":bucket,"external_urls_excluded":len(external),"no_remote_writes":True}),flush=True)
elif bucket_response.status_code==404:
 raise RuntimeError("Staging R2 bucket does not exist")
else:
 print("STAGING_R2_BUCKET_METADATA_HTTP "+str(bucket_response.status_code),flush=True)
endpoint=os.environ["R2_ENDPOINT"]
client=boto3.client("s3",endpoint_url=endpoint,aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],region_name="auto",config=Config(retries={"max_attempts":4}))
keys=set()
try:
 for page in client.get_paginator("list_objects_v2").paginate(Bucket=bucket):
  keys.update(obj["Key"] for obj in page.get("Contents",[]))
except Exception as exc:
 if "AccessDenied" in type(exc).__name__ or "AccessDenied" in str(exc):
  print("STAGING_R2_INVENTORY_BLOCKED "+json.dumps({"public_linked_distinct_paths":len(paths),"external_urls_excluded":len(external),"reason":"R2 credentials cannot list isolated staging bucket","no_remote_writes":True}),flush=True)
  raise RuntimeError("R2_ACCESS_DENIED: staging-scoped read-only credentials required") from None
 raise
missing=paths-keys
print("STAGING_R2_INVENTORY "+json.dumps({"public_linked_distinct_paths":len(paths),"staging_bucket_objects":len(keys),"present":len(paths&keys),"missing":len(missing),"no_remote_writes":True}),flush=True)
if missing:raise RuntimeError("Referenced public media missing from isolated staging bucket; copying requires a separately verified plan")
