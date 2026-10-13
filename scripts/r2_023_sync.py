#!/usr/bin/env python3
"""R2-023 safe Supabase -> R2 sync. Dry-run by default. Never delete."""
import os,sys,json,hashlib,tempfile,mimetypes
from urllib.parse import quote
import requests,boto3
from botocore.exceptions import ClientError
from botocore.config import Config

BUCKET="celebrations-media"
class Conflict(RuntimeError):pass
def digest_stream(stream, spool=None):
 h=hashlib.sha256();count=0
 for chunk in stream:
  if not chunk:continue
  h.update(chunk);count+=len(chunk)
  if spool is not None:spool.write(chunk)
 return h.hexdigest(),count
def inventory_source(session,base,prefix=""):
 offset=0
 while True:
  r=session.post(f"{base}/storage/v1/object/list/{BUCKET}",json={"prefix":prefix,"limit":100,"offset":offset,"sortBy":{"column":"name","order":"asc"}},timeout=60)
  r.raise_for_status();rows=r.json()
  if not isinstance(rows,list):raise RuntimeError("Invalid source inventory")
  for x in rows:
   if not x.get("name") or x["name"]==".emptyFolderPlaceholder":continue
   path=prefix+x["name"]
   if x.get("id") is None:yield from inventory_source(session,base,path+"/")
   else:
    size=(x.get("metadata") or {}).get("size")
    if size is None:raise RuntimeError("Missing size metadata")
    yield path,int(size)
  if len(rows)<100:break
  offset+=len(rows)
def inventory_r2(client):
 out={}
 for page in client.get_paginator("list_objects_v2").paginate(Bucket=BUCKET):
  for item in page.get("Contents",[]):out[item["Key"]]=int(item["Size"])
 return out
def verify_r2(client,path,expected_sha,expected_size):
 body=client.get_object(Bucket=BUCKET,Key=path)["Body"]
 try:sha,size=digest_stream(body.iter_chunks(chunk_size=1024*1024))
 finally:body.close()
 if (sha,size)!=(expected_sha,expected_size):raise Conflict("SHA256_MISMATCH")
def sync_one(session,client,base,path,size,destination,copy=False):
 # Recompute SHA256 for both existing and new objects, not ETag.
 if size>5*1024**3:raise Conflict("OBJECT_TOO_LARGE_FOR_ATOMIC_PUT")
 with tempfile.SpooledTemporaryFile(max_size=8*1024**2) as tmp:
  with session.get(f"{base}/storage/v1/object/{BUCKET}/{quote(path,safe='/')}",stream=True,timeout=(30,180)) as r:
   r.raise_for_status()
   sha,actual=digest_stream(r.iter_content(chunk_size=1024*1024),tmp)
  if actual!=size:raise Conflict("SOURCE_SIZE_MISMATCH")
  if path in destination:
   if destination[path]!=size:raise Conflict("DESTINATION_SIZE_MISMATCH")
   verify_r2(client,path,sha,size)
   return "IDENTICAL"
  if not copy:return "WOULD_COPY"
  tmp.seek(0)
  try:
   client.put_object(Bucket=BUCKET,Key=path,Body=tmp,IfNoneMatch="*",ContentType=mimetypes.guess_type(path)[0] or "application/octet-stream",Metadata={"sha256":sha})
  except ClientError as e:
   if e.response.get("Error",{}).get("Code") in ("PreconditionFailed","412","ConditionalRequestConflict","409"):raise Conflict("CONCURRENT_OBJECT")
   raise
  verify_r2(client,path,sha,size)
  return "COPIED_VERIFIED"
def execute(session,client,base,copy=False):
 dest=inventory_r2(client);source=set();counts={};failures=0
 for path,size in inventory_source(session,base):
  if path in source:raise Conflict("DUPLICATE_SOURCE_KEY")
  source.add(path)
  try:
   status=sync_one(session,client,base,path,size,dest,copy)
  except Exception as e:
   status="ERROR_"+type(e).__name__;failures+=1
   # Stop immediately on conflict. Do not log object key.
   counts[status]=counts.get(status,0)+1
   break
  counts[status]=counts.get(status,0)+1
 for path in dest.keys()-source:
  # Only meaningful after a complete source inventory; no deletion ever.
  pass
 return {"mode":"COPY" if copy else "DRY_RUN","counts":counts,"failures":failures,"source_scan_complete":failures==0}
def main():
 copy=os.environ.get("DRY_RUN","true").lower()=="false"
 if copy and os.environ.get("CONFIRM_COPY")!="COPY":raise RuntimeError("Explicit CONFIRM_COPY=COPY required")
 base=os.environ["SUPABASE_URL"].rstrip("/")
 key=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
 session=requests.Session();session.headers.update({"apikey":key,"Authorization":"Bearer "+key})
 client=boto3.client("s3",endpoint_url=os.environ["R2_ENDPOINT"].rstrip("/"),aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],region_name="auto",config=Config(retries={"max_attempts":4,"mode":"standard"}))
 result=execute(session,client,base,copy)
 with open("r2-023-sync-report.json","w") as f:json.dump(result,f,indent=2)
 print("SYNC_SUMMARY "+json.dumps(result,sort_keys=True))
 if result["failures"]:sys.exit(1)
if __name__=="__main__":main()
