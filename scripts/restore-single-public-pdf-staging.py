#!/usr/bin/env python3
"""One-time, narrowly scoped restoration of one public PDF to private R2 staging.

Reads an existing openly shared Google Drive PDF; never updates live/production
resources, never overwrites an R2 key, and never writes D1.
"""
import hashlib
import json
import os
import requests
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

ACCOUNT=os.environ["CLOUDFLARE_ACCOUNT_ID"]
DB_ID=os.environ["STAGING_D1_ID"]
BUCKET=os.environ["STAGING_R2_BUCKET"]
KEY="media/pdf-1789466878259-22-9vktt/file-1789466879911-Pardon-des-Offenses-version-raccourcie.pdf"
DRIVE_ID="1H4qk88nN81AmMId9g3Efsc-20MRJZEKp"
EXPECTED_BYTES=1_189_910
assert BUCKET=="celebrations-exit-staging", "Refusing non-staging R2 bucket"
assert len(ACCOUNT)==32 and all(c in "0123456789abcdef" for c in ACCOUNT.lower())
api=f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB_ID}"
headers={"Authorization":"Bearer "+os.environ["CLOUDFLARE_API_TOKEN"]}
db=requests.get(api,headers=headers,timeout=20).json()
assert db.get("success") and db["result"]["name"]=="celebrations-exit-staging", "Refusing non-staging database"

# Read only: check the exact key belongs to a genuinely linked, public D1 content.
sql="""SELECT c.storage_path,c.cover_storage_path FROM celebrations_contents c
WHERE c.audience='all' AND
(EXISTS(SELECT 1 FROM celebrations_event_contents ec JOIN celebrations_events e
ON e.id=ec.event_id WHERE ec.content_id=c.id AND e.audience='all')
OR EXISTS(SELECT 1 FROM celebrations_step_contents sc WHERE sc.content_id=c.id))"""
response=requests.post(api+"/query",headers=headers,json={"sql":sql},timeout=30).json()
assert response.get("success"), "D1 read-only query failed"
linked={v for row in response["result"][0]["results"]
        for v in (row.get("storage_path"),row.get("cover_storage_path")) if v}
assert KEY in linked, "Exact PDF path no longer references a public programme content"

s3=boto3.client("s3",endpoint_url=os.environ["R2_ENDPOINT"],region_name="auto",
 config=Config(retries={"max_attempts":2}),
 aws_access_key_id=os.environ["STAGING_R2_ACCESS_KEY_ID"],
 aws_secret_access_key=os.environ["STAGING_R2_SECRET_ACCESS_KEY"])
try:
 existing=s3.head_object(Bucket=BUCKET,Key=KEY)
 raise SystemExit("PDF object already exists in staging (length "+str(existing.get("ContentLength"))+
                  "); no write performed; investigate gateway ACL instead")
except ClientError as error:
 if error.response.get("Error",{}).get("Code") not in ("404","NoSuchKey","NotFound"):
  raise

url="https://drive.google.com/uc?export=download&id="+DRIVE_ID
r=requests.get(url,timeout=55)
r.raise_for_status()
payload=r.content
assert len(payload)==EXPECTED_BYTES, f"Unexpected Drive PDF size: {len(payload)}"
assert payload.startswith(b"%PDF-") and b"%%EOF" in payload[-2048:], "Invalid PDF body"
sha=hashlib.sha256(payload).hexdigest()
# Only one new staging object, written at exactly the path recorded in staging D1.
s3.put_object(Bucket=BUCKET,Key=KEY,Body=payload,ContentType="application/pdf")
obj=s3.get_object(Bucket=BUCKET,Key=KEY)
remote=obj["Body"].read(); obj["Body"].close()
assert hashlib.sha256(remote).hexdigest()==sha, "Staging R2 digest mismatch"
print("STAGING_SINGLE_PDF_RESTORED "+json.dumps({
 "bucket":BUCKET,"key":KEY,"bytes":len(payload),"sha256":sha,
 "source":"shared_google_drive","verified":True,"production_untouched":True}))
