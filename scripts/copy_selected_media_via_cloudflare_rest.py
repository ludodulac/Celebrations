#!/usr/bin/env python3
"""Official Cloudflare R2 REST API alternate transfer, private media ONLY.

The existing S3 key is correctly scoped to READ the 158-item staging bucket
but cannot access the new production bucket. Reuse the existing Cloudflare
account REST API token only if it is AUTHORIZED for production object listing,
GET and PUT. Do not broaden credentials or expose public media.

One file (max 54 MiB) is held in volatile memory for the Cloudflare REST
multipart upload and immediately verified by a private REST GET SHA256.
No disk plaintext, no GitHub artifacts, no DNS, no D1 mutation or deletion.
"""
import hashlib
import json
import mimetypes
import os
import re
import sys
from urllib.parse import quote,urlsplit

import boto3
import requests
from botocore.config import Config

try:
    from scripts.audit_public_only_media import (
        SOURCE_HOST,SOURCE_TABLES,fetch_all,list_objects
    )
    from scripts.copy_selected_public_media_to_production import (
        select_visible_paths,BUCKET_SOURCE,BUCKET_DEST,
        SOURCE_COUNT,SOURCE_BYTES,check_identity,
    )
except ModuleNotFoundError:
    from audit_public_only_media import (
        SOURCE_HOST,SOURCE_TABLES,fetch_all,list_objects
    )
    from copy_selected_public_media_to_production import (
        select_visible_paths,BUCKET_SOURCE,BUCKET_DEST,
        SOURCE_COUNT,SOURCE_BYTES,check_identity,
    )


def rest_objects(session,account):
    url=f"https://api.cloudflare.com/client/v4/accounts/{account}/r2/buckets/{BUCKET_DEST}/objects"
    objects={}
    cursor=None
    for page in range(10):
        params={} if cursor is None else {"cursor":cursor}
        response=session.get(url,params=params,timeout=40)
        if response.status_code!=200:
            raise RuntimeError("R2_PRODUCTION_REST_OBJECT_LIST_DENIED")
        data=response.json()
        if data.get("success") is not True or not isinstance(data.get("result"),list):
            raise RuntimeError("R2_PRODUCTION_REST_LIST_UNEXPECTED")
        for obj in data["result"]:
            key=obj.get("key")
            if not isinstance(key,str) or key in objects:
                raise ValueError("Duplicate/malformed production media object")
            objects[key]=int(obj.get("size",-1))
        pageinfo=data.get("result_info") or {}
        if not pageinfo.get("is_truncated",False):
            return objects
        cursor=pageinfo.get("cursor")
        if not cursor:raise RuntimeError("Untraversed production R2 list cursor")
    raise ValueError("Excessive bucket pagination")


def object_url(account,key):
    # Cloudflare REST API requires literal '/' separators inside object paths.
    return ("https://api.cloudflare.com/client/v4/accounts/"+account+
        "/r2/buckets/"+BUCKET_DEST+"/objects/"+quote(key,safe="/"))


def rest_get_hash(session,url,expected_size):
    response=session.get(url,stream=True,timeout=(25,180))
    if response.status_code!=200:
        response.close()
        raise RuntimeError("R2_PRODUCTION_REST_OBJECT_READ_DENIED")
    sha=hashlib.sha256()
    size=0
    try:
        for block in response.iter_content(1024*1024):
            if block:
                sha.update(block)
                size+=len(block)
                if size>expected_size:
                    raise ValueError("R2 target byte count exceeds source size")
        mime=response.headers.get("content-type","").split(";")[0]
    finally:
        response.close()
    if size!=expected_size:
        raise ValueError("R2 target byte count mismatch")
    return sha.digest(),mime


def validate_source():
    base=os.environ["SUPABASE_URL"].rstrip("/")
    url=urlsplit(base)
    if(url.scheme!="https" or url.hostname!=SOURCE_HOST or url.path or
       url.query or url.fragment):
        raise ValueError("Unexpected source account")
    session=requests.Session()
    secret=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    session.headers.update({"apikey":secret,"Authorization":"Bearer "+secret})
    data={name:fetch_all(session,base,table)
          for name,table in SOURCE_TABLES.items()}
    inventory=list_objects(session,base)
    if len(inventory)!=SOURCE_COUNT or sum(inventory.values())!=SOURCE_BYTES:
        raise ValueError("Source media inventory changed")
    report,partition=select_visible_paths(data,inventory)
    if len(partition["selected"])!=121 or len(partition["review"])!=37:
        raise ValueError("Unexpected protected selection count")
    if len(partition["missing"])!=31:
        raise ValueError("Preexisting broken-reference count changed")
    return report,partition,inventory


def main():
    if os.environ.get("GITHUB_REF")!="refs/heads/feat/celebrations-supabase-exit-001":
        raise ValueError("Not the isolated migration branch")
    if os.environ.get("STAGING_R2_BUCKET")!=BUCKET_SOURCE:
        raise ValueError("Wrong source bucket")
    check_identity()
    report,partition,inventory=validate_source()
    account=os.environ["CLOUDFLARE_ACCOUNT_ID"]
    endpoint=os.environ["R2_ENDPOINT"].rstrip("/")
    parsed=urlsplit(endpoint)
    if parsed.scheme!="https" or parsed.hostname!=account+".r2.cloudflarestorage.com":
        raise ValueError("Wrong R2 source endpoint")
    source=boto3.client("s3",endpoint_url=endpoint,region_name="auto",
        aws_access_key_id=os.environ["STAGING_R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["STAGING_R2_SECRET_ACCESS_KEY"],
        config=Config(retries={"max_attempts":3,"mode":"standard"}))
    source.head_bucket(Bucket=BUCKET_SOURCE)
    api=requests.Session()
    api.headers.update({"Authorization":"Bearer "+os.environ["CLOUDFLARE_API_TOKEN"]})
    existing=rest_objects(api,account)
    if set(existing)-partition["selected"]:
        raise RuntimeError("Unexpected object in production bucket")
    for k,length in existing.items():
        if length!=inventory[k]:
            raise RuntimeError("Existing production media size mismatch")
    print("PROD_R2_OFFICIAL_REST_PREFLIGHT "+
          json.dumps({"existing_selected_objects":len(existing),
            "selected":len(partition["selected"]),
            "review_not_selected":len(partition["review"]),
            "max_file_bytes":max(inventory[k] for k in partition["selected"]),
            "static_literal_public_media_guard":"PASS",
            "bucket_private":True,"originals_untouched":True},sort_keys=True),
          flush=True)

    # Cloudflare REST object read must be available to perform independent
    # hash verification. A 404 (not 403/401) proves endpoint/auth works.
    guard=api.get(object_url(account,"not-a-real-media-object-20261021-control"),
                  timeout=25)
    if guard.status_code!=404:
        raise RuntimeError("R2_PRODUCTION_REST_OBJECT_GET_PERMISSION_NOT_VERIFIED")

    copied=0
    checked=0
    total_bytes=0
    for idx,k in enumerate(sorted(partition["selected"]),1):
        expected_size=inventory[k]
        url=object_url(account,k)
        if k in existing:
            digest,_=rest_get_hash(api,url,expected_size)
            obj=source.get_object(Bucket=BUCKET_SOURCE,Key=k)
            try:
                content=obj["Body"].read(expected_size+1)
            finally:
                obj["Body"].close()
            if len(content)!=expected_size or hashlib.sha256(content).digest()!=digest:
                raise RuntimeError("Existing production copy hash mismatch")
        else:
            # Cloudflare official REST endpoint accepts one uploaded body file
            # as multipart/form-data, max 300 MB; our maximum < 54 MB.
            obj=source.get_object(Bucket=BUCKET_SOURCE,Key=k)
            try:
                payload=obj["Body"].read(expected_size+1)
                mime=obj.get("ContentType")
            finally:
                obj["Body"].close()
            if len(payload)!=expected_size or len(payload)>100000000:
                raise RuntimeError("Source object exceeds approved memory budget")
            sha=hashlib.sha256(payload).digest()
            if not mime or mime=="application/octet-stream":
                mime=mimetypes.guess_type(k)[0] or "application/octet-stream"
            response=api.put(url,files={"body":("media.bin",payload,mime)},
                             timeout=(35,240))
            if response.status_code not in (200,201):
                raise RuntimeError("R2_PRODUCTION_REST_OBJECT_UPLOAD_DENIED")
            reply=response.json()
            if (reply.get("success") is not True or
                (reply.get("result") or {}).get("key")!=k or
                int((reply.get("result") or {}).get("size",-1))!=expected_size):
                raise RuntimeError("Production API upload result mismatch")
            del payload
            digest,_=rest_get_hash(api,url,expected_size)
            if digest!=sha:
                raise RuntimeError("Production REST SHA256 mismatch")
            copied+=1
        checked+=1
        total_bytes+=expected_size
        if idx%25==0:
            print("PROD_R2_OFFICIAL_REST_PROGRESS "+
                  json.dumps({"verified":idx,"of":len(partition["selected"])}),flush=True)
    final=rest_objects(api,account)
    if (set(final)!=partition["selected"] or
        any(final[k]!=inventory[k] for k in final) or
        checked!=121 or total_bytes!=766989338):
        raise RuntimeError("Final production-only media inventory mismatch")
    print("SELECTIVE_R2_PRODUCTION_COPY_VERIFIED "+
         json.dumps({"protected_objects":checked,
          "verified_bytes":total_bytes,
          "excluded_review_objects":37,
          "copied_this_run":copied,
          "hash_algorithm":"SHA256_private_source_and_target",
          "committee_invitations_protected":9,
          "source_mutations":0,"staging_mutations":0,
          "d1_mutations":0,"dns_changes":0,"worker_deployed":False,
          "existing_missing_references":31},sort_keys=True),flush=True)


if __name__=="__main__":
    try:main()
    except BaseException as error:
        allowed={
          "R2_PRODUCTION_REST_OBJECT_LIST_DENIED",
          "R2_PRODUCTION_REST_OBJECT_GET_PERMISSION_NOT_VERIFIED",
          "R2_PRODUCTION_REST_OBJECT_UPLOAD_DENIED",
          "Existing production copy hash mismatch",
          "Unexpected object in production bucket",
        }
        reason=str(error) if str(error) in allowed else "FAILED_CLOSED"
        print("PROD_R2_OFFICIAL_REST_COPY_STOP type="+type(error).__name__+
              " stage="+reason.replace(" ","_"),file=sys.stderr)
        raise SystemExit(1)
