#!/usr/bin/env python3
"""Emergency RESTORE ONLY of legacy original Supabase media from verified R2 copies.

Strictly limited to the deleted celebrations-media bucket. Never removes, edits,
or replaces any existing object, other bucket or Cloudflare data. No paths,
emails, slug values, credentials, or private content in logs.
"""
import datetime as dt
import hashlib
import io
import json
import mimetypes
import os
import tempfile
from urllib.parse import quote,urlsplit
import requests
import boto3
from botocore.config import Config

SOURCE="https://jwyayfkssyagvnablttg.supabase.co"
DEST="celebrations-media"
R2_BUCKET="celebrations-exit-staging"
EXPECTED_COUNT=158
EXPECTED_BYTES=830312417
OLD_CANDIDATE_COUNT=160
OLD_CANDIDATE_BYTES=831669547
CUTOFF=dt.datetime(2026,10,20,tzinfo=dt.timezone.utc)
PRESERVED_OTHER={"audios","studio-sounds","studio-projects","wikignose-pdfs",
                 "blog-images","images","rebulo-image-inbox"}

def stop(msg):
    raise RuntimeError(msg)

def choose_originals(items):
    old=[o for o in items if o["LastModified"]<CUTOFF]
    if len(old)!=OLD_CANDIDATE_COUNT or sum(int(o["Size"]) for o in old)!=OLD_CANDIDATE_BYTES:
        stop("R2 historical pre-delete inventory changed: stop before any write")
    excess=OLD_CANDIDATE_BYTES-EXPECTED_BYTES
    pairs=[]
    size_to_indices={}
    for i,ob in enumerate(old):
        size_to_indices.setdefault(int(ob["Size"]),[]).append(i)
    for i,ob in enumerate(old):
        for j in size_to_indices.get(excess-int(ob["Size"]),[]):
            if i<j: pairs.append((i,j))
    if len(pairs)!=1:
        stop("Cannot uniquely identify exactly two staging-only objects; no restore allowed")
    extras=set(pairs[0])
    original=[o for i,o in enumerate(old) if i not in extras]
    if len(original)!=EXPECTED_COUNT or sum(int(x["Size"]) for x in original)!=EXPECTED_BYTES:
        stop("158 original object identity/count/byte parity fail")
    if any(not o["Key"] or ".." in o["Key"].split("/") or o["Key"].startswith("private-backups/") for o in original):
        stop("Original key safety failure")
    return original

def main():
    if os.environ.get("GITHUB_REF")!="refs/heads/feat/celebrations-supabase-exit-001":
        stop("Wrong branch")
    if os.environ.get("CELEBRATIONS_RESTORE_APPROVAL")!="REPAIR_BROKEN_EMAIL_LINKS_2026_10_28":
        stop("Missing owner recovery scope")
    if os.environ["SUPABASE_URL"].rstrip("/")!=SOURCE:
        stop("Wrong Supabase project")
    if os.environ["STAGING_R2_BUCKET"]!=R2_BUCKET:
        stop("Wrong Cloudflare R2 bucket")
    url=os.environ["R2_ENDPOINT"].rstrip("/")
    host=urlsplit(url)
    if host.scheme!="https" or host.hostname!=os.environ["CLOUDFLARE_ACCOUNT_ID"]+".r2.cloudflarestorage.com" or host.path or host.query:
        stop("Wrong R2 credentials endpoint")
    client=boto3.client("s3",endpoint_url=url,region_name="auto",
        aws_access_key_id=os.environ["STAGING_R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["STAGING_R2_SECRET_ACCESS_KEY"],
        config=Config(retries={"max_attempts":2,"mode":"standard"}))
    client.head_bucket(Bucket=R2_BUCKET)
    items=[]
    for page in client.get_paginator("list_objects_v2").paginate(Bucket=R2_BUCKET):
        items+=page.get("Contents",[])
    originals=choose_originals(items)
    print("LEGACY_ORIGINALS_VERIFIED_158 "+json.dumps({
        "objects":len(originals),"bytes":sum(x["Size"] for x in originals),
        "staging_only_objects_ignored":len(items)-len(originals),
        "mutations_so_far":0}),flush=True)

    secret=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    sess=requests.Session()
    sess.headers.update({"apikey":secret,"Authorization":"Bearer "+secret})
    buckets=sess.get(SOURCE+"/storage/v1/bucket",timeout=35)
    buckets.raise_for_status()
    response=buckets.json()
    found=response if isinstance(response,list) else response.get("buckets",response.get("data",[]))
    if not isinstance(found,list):
        stop("Unexpected bucket list")
    names={b["id"] for b in found}
    if not PRESERVED_OTHER.issubset(names):
        stop("Other seven Supabase buckets missing; stop")
    if DEST in names:
        rec=next(b for b in found if b["id"]==DEST)
        if rec.get("public") is not False:
            stop("Restored bucket is not private; stop instead of exposing committee PDFs")
        print("LEGACY_BUCKET_ALREADY_PRIVATE",flush=True)
    else:
        # Private by default to avoid exposing the nine confidential committee PDFs.
        created=sess.post(SOURCE+"/storage/v1/bucket",
            json={"id":DEST,"name":DEST,"public":False},
            timeout=35)
        if created.status_code not in (200,201):
            stop("Supabase bucket creation HTTP "+str(created.status_code))
        check=sess.get(SOURCE+"/storage/v1/bucket/"+DEST,timeout=35)
        if check.status_code!=200 or check.json().get("public") is not False:
            stop("Bucket privacy verification failed")
        print("LEGACY_ORIGINAL_BUCKET_RECREATED_PRIVATE",flush=True)

    restored=0
    existing=0
    failed_large=0
    failures=0
    verified_bytes=0
    # PDF first, then all other content. Stop after two consecutive failures.
    originals.sort(key=lambda o:(not o["Key"].lower().endswith(".pdf"),o["Key"]))
    consecutive_fail=0
    for obj in originals:
        key=obj["Key"]
        size=int(obj["Size"])
        path=quote(key,safe="/")
        endpoint=SOURCE+"/storage/v1/object/"+DEST+"/"+path
        check=sess.head(SOURCE+"/storage/v1/object/authenticated/"+DEST+"/"+path,timeout=30)
        if check.status_code==200:
            if int(check.headers.get("content-length","-1"))!=size:
                stop("Existing source object size conflict; refuse overwrite")
            existing+=1
            verified_bytes+=size
            continue
        if check.status_code not in (400,404):
            stop("Unexpected source object check HTTP "+str(check.status_code))
        # Supabase Free limit may reject a historical >50MiB file.
        if size>52_428_800:
            failed_large+=1
            continue
        try:
            with tempfile.SpooledTemporaryFile(max_size=1024*1024,mode="w+b",dir="/dev/shm") as content:
                resp=client.get_object(Bucket=R2_BUCKET,Key=key)
                if int(resp["ContentLength"])!=size:
                    stop("R2 original length mismatch")
                h=hashlib.sha256()
                length=0
                body=resp["Body"]
                try:
                    for b in body.iter_chunks(chunk_size=1024*1024):
                        if b:
                            length+=len(b);h.update(b);content.write(b)
                finally: body.close()
                if length!=size: stop("R2 streamed length mismatch")
                content.seek(0)
                content_type=mimetypes.guess_type(key)[0] or "application/octet-stream"
                put=sess.post(endpoint,data=content,
                    headers={"Content-Type":content_type,"x-upsert":"false"},
                    timeout=(20,180))
                if put.status_code not in (200,201):
                    stop("Supabase upload HTTP "+str(put.status_code))
            head=sess.head(SOURCE+"/storage/v1/object/authenticated/"+DEST+"/"+path,timeout=40)
            if head.status_code!=200 or int(head.headers.get("content-length","-1"))!=size:
                stop("Uploaded media response length mismatch")
            restored+=1;verified_bytes+=size;consecutive_fail=0
            if restored%20==0:
                print("LEGACY_RESTORE_PROGRESS "+json.dumps({"objects_uploaded":restored,"existing_verified":existing}),flush=True)
        except Exception as exc:
            failures+=1
            consecutive_fail+=1
            print("LEGACY_RESTORE_ONE_OBJECT_FAILED kind="+type(exc).__name__,flush=True)
            if consecutive_fail>=2:
                print("LEGACY_RESTORE_STOP_AFTER_TWO_FAILURES",flush=True)
                break

    print("LEGACY_RESTORE_RESULT "+json.dumps({
        "expected":EXPECTED_COUNT,"uploaded":restored,"verified_existing":existing,
        "over_50mib_not_attempted":failed_large,"other_failed":failures,
        "bytes_uploaded_and_verified":verified_bytes,
        "other_supabase_buckets_changed":0,"r2_mutations":0,
        "bucket_private":True},sort_keys=True),flush=True)
    if restored+existing!=EXPECTED_COUNT: raise SystemExit(2)

if __name__=="__main__":
    try:main()
    except Exception as exc:
        print("LEGACY_RESTORE_STOP category="+type(exc).__name__,flush=True)
        raise SystemExit(1)
