#!/usr/bin/env python3
"""Transfer exactly 121 approved user-visible objects to PRIVATE production R2.

Requires separate S3 credentials:
- STAGING_*: READ ONLY staging object source.
- PROD_*: READ + WRITE ONLY the new production private bucket.
Never expand source key permissions. No Supabase mutations, D1, DNS or Worker.
No media on disk, GitHub artifacts or logs. SHA256 verified before/after.
"""
import hashlib
import json
import os
import re
import sys
import mimetypes
from urllib.parse import urlsplit

import boto3
import requests
from botocore.config import Config
from botocore.exceptions import ClientError
try:
    from scripts.audit_public_only_media import SOURCE_HOST,SOURCE_TABLES,fetch_all,list_objects
    from scripts.copy_selected_public_media_to_production import (
        select_visible_paths,check_identity,BUCKET_SOURCE,BUCKET_DEST,
        SOURCE_COUNT,SOURCE_BYTES,stream_hash,
    )
except ModuleNotFoundError:
    from audit_public_only_media import SOURCE_HOST,SOURCE_TABLES,fetch_all,list_objects
    from copy_selected_public_media_to_production import (
        select_visible_paths,check_identity,BUCKET_SOURCE,BUCKET_DEST,
        SOURCE_COUNT,SOURCE_BYTES,stream_hash,
    )


def credentials_for(scope):
    if scope not in ("STAGING","PROD"):
        raise ValueError("Unexpected S3 credential role")
    if scope=="STAGING":
        access=os.environ["STAGING_R2_ACCESS_KEY_ID"]
        secret=os.environ["STAGING_R2_SECRET_ACCESS_KEY"]
    else:
        access=os.environ["CELEBRATIONS_PROD_R2_ACCESS_KEY_ID"]
        secret=os.environ["CELEBRATIONS_PROD_R2_SECRET_ACCESS_KEY"]
    if not access or not secret or (scope=="PROD" and
        access==os.environ["STAGING_R2_ACCESS_KEY_ID"]):
        raise ValueError("Missing or improperly reused scoped R2 token")
    return access,secret


def s3(scope):
    account=os.environ["CLOUDFLARE_ACCOUNT_ID"]
    if not re.fullmatch("[0-9a-f]{32}",account,re.I):
        raise ValueError("Invalid account")
    endpoint=os.environ["R2_ENDPOINT"].rstrip("/")
    url=urlsplit(endpoint)
    if(url.scheme!="https" or
       url.hostname!=account+".r2.cloudflarestorage.com" or
       url.path or url.query or url.fragment):
        raise ValueError("Invalid R2 endpoint")
    access,secret=credentials_for(scope)
    return boto3.client("s3",region_name="auto",endpoint_url=endpoint,
        aws_access_key_id=access,aws_secret_access_key=secret,
        config=Config(retries={"max_attempts":3,"mode":"standard"}))


def list_production(s3prod):
    listing={}
    for page in s3prod.get_paginator("list_objects_v2").paginate(Bucket=BUCKET_DEST):
        for o in page.get("Contents",[]):
            if o["Key"] in listing:
                raise ValueError("Duplicate production key")
            listing[o["Key"]]=o["Size"]
            if len(listing)>121:
                raise ValueError("Unexpected production object volume")
    return listing


def main():
    if os.environ.get("GITHUB_REF")!="refs/heads/feat/celebrations-supabase-exit-001":
        raise ValueError("Wrong migration branch")
    if os.environ.get("STAGING_R2_BUCKET")!=BUCKET_SOURCE:
        raise ValueError("Wrong source bucket")
    check_identity()
    base=os.environ["SUPABASE_URL"].rstrip("/")
    url=urlsplit(base)
    if url.scheme!="https" or url.hostname!=SOURCE_HOST or url.path or url.query or url.fragment:
        raise ValueError("Wrong source project")
    requests_session=requests.Session()
    secret=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    requests_session.headers.update({"apikey":secret,"Authorization":"Bearer "+secret})
    data={name:fetch_all(requests_session,base,table)
          for name,table in SOURCE_TABLES.items()}
    inventory=list_objects(requests_session,base)
    if len(inventory)!=158 or sum(inventory.values())!=830312417:
        raise ValueError("Source inventory changed after protection audit")
    report,partition=select_visible_paths(data,inventory)
    selected=partition["selected"]
    if len(selected)!=121 or len(partition["review"])!=37 or partition["review"]&selected:
        raise ValueError("Source media selection drift")
    if sum(inventory[k] for k in selected)!=766989338:
        raise ValueError("Published media byte counts changed")
    src=s3("STAGING")
    dst=s3("PROD")
    src.head_bucket(Bucket=BUCKET_SOURCE)
    dst.head_bucket(Bucket=BUCKET_DEST)
    existing=list_production(dst)
    if set(existing)-selected or any(v!=inventory[k] for k,v in existing.items()):
        raise ValueError("Production contains unauthorized media")
    print("SCOPED_PRODUCTION_R2_COPY_PREFLIGHT "+
          json.dumps({"protected":len(selected),"excluded_for_review":37,
             "previously_copied_protected":len(existing),
             "expected_bytes":766989338,
             "source_credential":"staging_only",
             "target_credential":"production_only",
             "writes_to_supabase":0,"writes_to_d1":0,
             "all_buckets_private":True,"dns_changed":False},
             sort_keys=True),flush=True)

    copied=0
    verified=0
    checked_bytes=0
    for n,key in enumerate(sorted(selected),1):
        length=inventory[key]
        source_head=src.head_object(Bucket=BUCKET_SOURCE,Key=key)
        if source_head["ContentLength"]!=length:
            raise ValueError("Staging file disagrees with source inventory")
        # Only keep one (<=54 MiB) private file in ephemeral process memory,
        # never writing the PDF/media body to disk.
        response=src.get_object(Bucket=BUCKET_SOURCE,Key=key)
        try:
            payload=response["Body"].read(length+1)
        finally:
            response["Body"].close()
        if len(payload)!=length or len(payload)>60000000:
            raise ValueError("File length beyond approved in-memory limit")
        digest=hashlib.sha256(payload).digest()
        if key not in existing:
            mime=source_head.get("ContentType")
            if not mime or mime=="application/octet-stream":
                mime=mimetypes.guess_type(key)[0] or "application/octet-stream"
            try:
                dst.put_object(Bucket=BUCKET_DEST,Key=key,Body=payload,
                               ContentType=mime,CacheControl="private, no-store",
                               IfNoneMatch="*")
            except ClientError:
                raise RuntimeError("Scoped destination upload permission denied") from None
            copied+=1
        del payload
        actual,size=stream_hash(dst,BUCKET_DEST,key)
        if size!=length or actual!=digest:
            raise ValueError("Production copy cryptographic mismatch")
        checked_bytes+=length
        verified+=1
        if n%25==0:
            print("SCOPED_PRODUCTION_R2_COPY_PROGRESS "+
                  json.dumps({"verified":n,"of":len(selected)}),flush=True)
    final=list_production(dst)
    if (set(final)!=selected or verified!=121 or
        checked_bytes!=766989338 or
        any(final[k]!=inventory[k] for k in final)):
        raise ValueError("Final production inventory not exactly protected items")
    print("SCOPED_PRODUCTION_R2_COPY_VERIFIED "+json.dumps({
        "protected_files":verified,"verified_bytes":checked_bytes,
        "copied_this_run":copied,"review_candidates_excluded":37,
        "preexisting_declared_missing_paths":len(partition["missing"]),
        "hash_algorithm":"sha256",
        "original_supabase_objects_deleted":0,"staging_objects_deleted":0,
        "production_d1_writes":0,"production_worker_deployed":False,
        "dns_changed":False
    },sort_keys=True),flush=True)


if __name__=="__main__":
    try:main()
    except BaseException as err:
        # Never echo object keys, credentials, URLs or HTTP response bodies.
        print("SCOPED_PRODUCTION_R2_COPY_BLOCKED type="+
              type(err).__name__,file=sys.stderr)
        raise SystemExit(1)
