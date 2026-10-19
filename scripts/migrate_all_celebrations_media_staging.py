#!/usr/bin/env python3
"""Copy AND SHA256-verify every current Celebrations Supabase Storage object to
PRIVATE Cloudflare staging R2. No source writes/deletes, no ACL changes, no prod.
Idempotent, conditional puts, fail-closed source/destination drift checks.
Output counts only: never print confidential filenames or signed tokens.
"""
import collections
import hashlib
import json
import mimetypes
import os
import re
import tempfile
from urllib.parse import quote, urlsplit

import boto3
import requests
from botocore.config import Config
from botocore.exceptions import ClientError
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

ACCOUNT=os.environ["CLOUDFLARE_ACCOUNT_ID"]
DATABASE=os.environ["STAGING_D1_ID"]
DEST=os.environ["STAGING_R2_BUCKET"]
SOURCE_URL=os.environ["SUPABASE_URL"].rstrip("/")
SOURCE_KEY=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
assert re.fullmatch("[a-f0-9]{32}",ACCOUNT,re.I)
assert re.fullmatch("[a-f0-9-]{36}",DATABASE,re.I)
assert DEST=="celebrations-exit-staging","Refusing any non-staging R2 bucket"
assert urlsplit(SOURCE_URL).scheme=="https" and urlsplit(SOURCE_URL).hostname=="jwyayfkssyagvnablttg.supabase.co","Unexpected source"
assert urlsplit(os.environ["R2_ENDPOINT"]).hostname==ACCOUNT+".r2.cloudflarestorage.com","Unexpected R2 account"
cf=requests.get(
 f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DATABASE}",
 headers={"Authorization":"Bearer "+os.environ["CLOUDFLARE_API_TOKEN"]},timeout=25
).json()
assert cf.get("success") and cf.get("result",{}).get("name")=="celebrations-exit-staging","Invalid staging D1 identity"
r2=boto3.client("s3",endpoint_url=os.environ["R2_ENDPOINT"],region_name="auto",
 aws_access_key_id=os.environ["STAGING_R2_ACCESS_KEY_ID"],
 aws_secret_access_key=os.environ["STAGING_R2_SECRET_ACCESS_KEY"],
 config=Config(retries={"max_attempts":3,"mode":"standard"}))
r2.head_bucket(Bucket=DEST)
session=requests.Session()
session.headers.update({"apikey":SOURCE_KEY,"Authorization":"Bearer "+SOURCE_KEY})
session.mount("https://",HTTPAdapter(max_retries=Retry(total=4,backoff_factor=1,
 status_forcelist=[429,500,502,503,504],allowed_methods=frozenset(["GET","POST"]))))

SOURCE_BUCKET="celebrations-media"
def inventory(prefix=""):
 out={}
 offset=0
 while True:
  res=session.post(f"{SOURCE_URL}/storage/v1/object/list/{SOURCE_BUCKET}",
    json={"prefix":prefix,"limit":100,"offset":offset,"sortBy":{"column":"name","order":"asc"}},
    timeout=40)
  res.raise_for_status()
  rows=res.json()
  assert isinstance(rows,list),"Unexpected source listing"
  for row in rows:
   name=row.get("name")
   if not name or name==".emptyFolderPlaceholder":continue
   path=prefix+name
   assert len(path)<1024 and ".." not in path.split("/") and "\\" not in path,"Unsafe source key"
   if row.get("id") is None:
    sub=inventory(path+"/")
    assert not set(out).intersection(sub),"Source duplicate directory"
    out.update(sub)
   else:
    assert path not in out,"Source duplicate file"
    size=(row.get("metadata") or {}).get("size")
    assert size is not None and 0<=int(size)<=500*1024*1024,"Invalid source file size"
    out[path]=int(size)
  if len(rows)<100:break
  offset+=len(rows)
 return out
files=inventory()
assert files,"Source inventory empty"
# Hard inventory checkpoint from latest read-only Supabase metadata. If the
# source changed, fail instead of guessing that files can be ignored.
EXPECTED=158
EXPECTED_BYTES=830312417
assert len(files)==EXPECTED and sum(files.values())==EXPECTED_BYTES, (
  "Source inventory differs: recheck source before migration")
for key in files:
 assert key.startswith(("media/","committee/")) or "/" in key,"Unexpected object key"
print("STAGING_MEDIA_SOURCE_INVENTORY "+json.dumps({"objects":len(files),
 "bytes":sum(files.values()),"source":"Supabase celebrations-media"}),flush=True)
def stream_sha(stream):
 sha=hashlib.sha256();total=0
 for chunk in stream:
  if chunk:
   sha.update(chunk);total+=len(chunk)
 return sha.hexdigest(),total

def check_r2(key,expected,digest):
 obj=r2.get_object(Bucket=DEST,Key=key)
 try:
  sha,n=stream_sha(obj["Body"].iter_chunks(chunk_size=1024*1024))
 finally:obj["Body"].close()
 assert n==expected and sha==digest,"R2 content hash mismatch"
def head_r2(key):
 try:return r2.head_object(Bucket=DEST,Key=key)
 except ClientError as exc:
  if exc.response.get("Error",{}).get("Code") in ("404","NoSuchKey","NotFound"):return None
  raise

status=collections.Counter()
verified_bytes=0
for number,(key,expected) in enumerate(sorted(files.items()),1):
 # Streaming, rewindable spool; private data never enters logs/artifacts.
 source=f"{SOURCE_URL}/storage/v1/object/{SOURCE_BUCKET}/{quote(key,safe='/')}"
 with tempfile.SpooledTemporaryFile(max_size=8*1024*1024) as spool:
  with session.get(source,stream=True,timeout=(30,180),allow_redirects=False) as response:
   response.raise_for_status()
   sha=hashlib.sha256();size=0
   for block in response.iter_content(1024*1024):
    if not block:continue
    sha.update(block);spool.write(block);size+=len(block)
    assert size<=expected,"Source object grew mid-read"
   mime=response.headers.get("content-type","").split(";")[0]
  assert size==expected,"Source size changed during migration"
  digest=sha.hexdigest()
  exists=head_r2(key)
  if exists:
   assert exists["ContentLength"]==expected,"R2 destination size conflict"
   check_r2(key,expected,digest)
   status["already_identical"]+=1
  else:
   spool.seek(0)
   content_type=("application/pdf" if key.startswith("committee/") else
     (mime if mime and mime!="application/octet-stream" else
      mimetypes.guess_type(key)[0] or "application/octet-stream"))
   try:
    r2.put_object(Bucket=DEST,Key=key,Body=spool,IfNoneMatch="*",
      ContentType=content_type,Metadata={"sha256":digest})
   except ClientError as e:
    if e.response.get("Error",{}).get("Code") not in ("412","PreconditionFailed","409","ConditionalRequestConflict"):raise
    assert head_r2(key) is not None,"Concurrent R2 copy did not finish"
   check_r2(key,expected,digest)
   status["new_verified"]+=1
  verified_bytes+=expected
 if number%25==0:print("STAGING_MEDIA_PROGRESS "+json.dumps({"verified":number,"of":len(files)}),flush=True)
assert sum(status.values())==len(files) and verified_bytes==EXPECTED_BYTES
print("STAGING_MEDIA_FULL_COPY_PASS "+json.dumps({
 "source_objects":len(files),"source_bytes":EXPECTED_BYTES,
 "destination_verified":sum(status.values()),"destination_verified_bytes":verified_bytes,
 "new_copies":status["new_verified"],"already_identical":status["already_identical"],
 "hash_algorithm":"sha256","source_mutations":0,"production_mutations":0
}),flush=True)
