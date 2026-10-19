#!/usr/bin/env python3
"""Read-only diagnosis of already configured R2 credentials and PDF candidate.
Never writes, copies, deletes or prints credentials or PDF contents.
"""
import os,json,hashlib,boto3,requests
from botocore.config import Config
from botocore.exceptions import ClientError
account=os.environ["CLOUDFLARE_ACCOUNT_ID"];token=os.environ["CLOUDFLARE_API_TOKEN"]
endpoint=os.environ["R2_ENDPOINT"]
assert endpoint.startswith("https://") and ".r2.cloudflarestorage.com" in endpoint, "Unexpected R2 endpoint"
client=boto3.client("s3",endpoint_url=endpoint,aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],region_name="auto",config=Config(retries={"max_attempts":2}))
def check(bucket,key=None):
 try:
  if key: 
   r=client.head_object(Bucket=bucket,Key=key)
   return {"result":"OK","bytes":r.get("ContentLength"),"etag":r.get("ETag","").strip('"')}
  r=client.list_objects_v2(Bucket=bucket,MaxKeys=1)
  return {"result":"OK","has_objects":bool(r.get("Contents"))}
 except ClientError as e:
  return {"result":e.response.get("Error",{}).get("Code","UNKNOWN"),"http":e.response.get("ResponseMetadata",{}).get("HTTPStatusCode")}
source="celebrations-media";staging="celebrations-exit-staging"
missing="media/pdf-1789466878259-22-9vktt/file-1789466879911-Pardon-des-Offenses-version-raccourcie.pdf"
candidate="media/1789570893634/file-1789570894958-Pardon-des-Offenses-version-raccourcie.pdf"
checks={"source_list":check(source),"staging_list":check(staging),"missing_pdf_source":check(source,missing),"candidate_pdf_source":check(source,candidate),"candidate_pdf_staging":check(staging,candidate)}
for bucket in (source,staging):
 try:
  client.head_bucket(Bucket=bucket)
  checks[bucket+"_head"]={"result":"OK"}
 except ClientError as e:
  checks[bucket+"_head"]={"result":e.response.get("Error",{}).get("Code","UNKNOWN"),"http":e.response.get("ResponseMetadata",{}).get("HTTPStatusCode")}
# Inspect whether the already configured staging token can read bucket identity.
for bucket in (source,staging):
 try:
  r=requests.get(f"https://api.cloudflare.com/client/v4/accounts/{account}/r2/buckets/{bucket}",headers={"Authorization":"Bearer "+token},timeout=20)
  checks[bucket+"_metadata"]={"http":r.status_code,"exists":r.ok and r.json().get("result",{}).get("name")==bucket}
 except requests.RequestException as e:checks[bucket+"_metadata"]={"error_type":type(e).__name__}
if checks["candidate_pdf_source"]["result"]=="OK":
 obj=client.get_object(Bucket=source,Key=candidate)
 h=hashlib.sha256();n=0
 try:
  for chunk in obj["Body"].iter_chunks(chunk_size=262144):
   if chunk:h.update(chunk);n+=len(chunk)
 finally:obj["Body"].close()
 checks["candidate_pdf_source"]["sha256"]=h.hexdigest()
 checks["candidate_pdf_source"]["downloaded_bytes"]=n
print("R2_EXISTING_ACCESS_DIAGNOSTIC "+json.dumps(checks,ensure_ascii=False),flush=True)
if checks["staging_list"]["result"]!="OK":raise RuntimeError("Existing R2 key cannot list staging; staging credentials/bucket scope need correction before copying")
