#!/usr/bin/env python3
"""Restore only the existing public homepage JPG to PRIVATE isolated R2 staging.

No production edits. No overwrites. Publish only one explicitly approved public
image after digest verification. Refuses incorrect Cloudflare database or bucket.
"""
import hashlib
import json
import os
import re

import boto3
import requests
from botocore.config import Config
from botocore.exceptions import ClientError

ACCOUNT=os.environ["CLOUDFLARE_ACCOUNT_ID"]
DB_ID=os.environ["STAGING_D1_ID"]
BUCKET=os.environ["STAGING_R2_BUCKET"]
SOURCE="https://jwyayfkssyagvnablttg.supabase.co/storage/v1/object/public/celebrations-media/media/1791723108110/file-1791723109615-1000040461.jpg"
KEY="media/celebrations-staging-welcome-autumn-2026.jpg"
assert BUCKET=="celebrations-exit-staging", "Staging R2 bucket required"
assert re.fullmatch(r"[0-9a-fA-F]{32}",ACCOUNT), "Invalid Cloudflare account identifier"
assert re.fullmatch(r"[0-9a-fA-F-]{36}",DB_ID), "Invalid D1 identifier"

root=f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB_ID}"
headers={"Authorization":"Bearer "+os.environ["CLOUDFLARE_API_TOKEN"]}
identity=requests.get(root,headers=headers,timeout=25).json()
assert identity.get("success") and identity.get("result",{}).get("name")=="celebrations-exit-staging", "Refusing to access any other D1"
def query(sql):
 r=requests.post(root+"/query",headers=headers,json={"sql":sql},timeout=30).json()
 if not r.get("success"):raise RuntimeError("Staging D1 SQL failed")
 return r["result"][0].get("results",[])
assert re.fullmatch(r"media/[a-z0-9-]+\.jpg",KEY)
existing_acl=query("SELECT approved,revoked_at FROM public_media WHERE storage_path='"+KEY+"'")
assert not existing_acl or (existing_acl[0].get("approved")==1 and not existing_acl[0].get("revoked_at")), "Refusing to reactivate a denied or revoked media key"

response=requests.get(SOURCE,timeout=45)
response.raise_for_status()
data=response.content
assert 1000<len(data)<12_000_000, "Unexpected welcome JPG size"
assert data.startswith(b"\xff\xd8\xff") and data.endswith(b"\xff\xd9"), "Invalid JPEG payload"
digest=hashlib.sha256(data).hexdigest()

r2=boto3.client("s3",endpoint_url=os.environ["R2_ENDPOINT"],region_name="auto",
 config=Config(retries={"max_attempts":2}),
 aws_access_key_id=os.environ["STAGING_R2_ACCESS_KEY_ID"],
 aws_secret_access_key=os.environ["STAGING_R2_SECRET_ACCESS_KEY"])
try:
 obj=r2.get_object(Bucket=BUCKET,Key=KEY)
 payload=obj["Body"].read();obj["Body"].close()
 assert hashlib.sha256(payload).hexdigest()==digest, "Existing staging object differs: refusing overwrite"
except ClientError as e:
 if e.response.get("Error",{}).get("Code") not in ("NoSuchKey","404","NotFound"):raise
 r2.put_object(Bucket=BUCKET,Key=KEY,Body=data,ContentType="image/jpeg",IfNoneMatch="*")
obj=r2.get_object(Bucket=BUCKET,Key=KEY)
stored=obj["Body"].read();obj["Body"].close()
assert hashlib.sha256(stored).hexdigest()==digest,"R2 digest verification failed"
if not existing_acl:
 query("INSERT INTO public_media(storage_path,approved,revoked_at,approved_at) VALUES('"+KEY+"',1,NULL,CURRENT_TIMESTAMP)")
check=query("SELECT approved,revoked_at FROM public_media WHERE storage_path='"+KEY+"'")
assert len(check)==1 and check[0]["approved"]==1 and not check[0]["revoked_at"], "ACL validation failed"
print("STAGING_WELCOME_IMAGE_RESTORED "+json.dumps({"key":KEY,"bytes":len(data),"sha256":digest,"approved":True,"production_untouched":True}))
