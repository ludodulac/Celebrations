#!/usr/bin/env python3
"""Read-only staging diagnosis: exact keys, ACL and R2 presence; no mutations."""
import json, os, requests, boto3
from botocore.config import Config
account=os.environ["CLOUDFLARE_ACCOUNT_ID"]
database=os.environ["STAGING_D1_ID"]
root=f"https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{database}/query"
headers={"Authorization":"Bearer "+os.environ["CLOUDFLARE_API_TOKEN"]}
def query(sql):
 r=requests.post(root,headers=headers,json={"sql":sql},timeout=30)
 r.raise_for_status()
 result=r.json()
 if not result.get("success"): raise RuntimeError("D1 query failed")
 return result["result"][0]["results"]
assert os.environ["STAGING_R2_BUCKET"]=="celebrations-exit-staging"
s3=boto3.client("s3",endpoint_url=os.environ["R2_ENDPOINT"],region_name="auto",config=Config(retries={"max_attempts":2}),aws_access_key_id=os.environ["STAGING_R2_ACCESS_KEY_ID"],aws_secret_access_key=os.environ["STAGING_R2_SECRET_ACCESS_KEY"])
media=query("SELECT storage_path FROM celebrations_contents WHERE storage_path IS NOT NULL AND storage_path LIKE 'media/%' LIMIT 3")
acl=query("SELECT approved,revoked_at,COUNT(*) AS n FROM public_media GROUP BY approved,revoked_at")
items=[]
for row in media:
 key=row["storage_path"]
 try:
  obj=s3.head_object(Bucket="celebrations-exit-staging",Key=key)
  exists=True
 except s3.exceptions.ClientError as exc:
  exists=False
  if exc.response["ResponseMetadata"]["HTTPStatusCode"] not in (404,403): raise
 matching=query("SELECT approved,revoked_at FROM public_media WHERE storage_path='"+key.replace("'","''")+"'")
 linked=query("SELECT COUNT(*) AS n FROM celebrations_contents c WHERE (c.storage_path='"+key.replace("'","''")+"' OR c.cover_storage_path='"+key.replace("'","''")+"') AND c.audience='all' AND EXISTS(SELECT 1 FROM celebrations_event_contents ec JOIN celebrations_events e ON e.id=ec.event_id WHERE ec.content_id=c.id AND e.audience='all')")
 items.append({"key":key,"exists_in_staging_r2":exists,"acl":matching,"linked_public":linked[0]["n"]})
print("STAGING_MEDIA_DIAGNOSIS "+json.dumps({"acl_groups":acl,"samples":items}))
