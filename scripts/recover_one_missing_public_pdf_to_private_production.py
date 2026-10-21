#!/usr/bin/env python3
"""Recover precisely ONE pre-existing, publicly linked PDF missing from Supabase.

The original PDF is a user's Google Drive file with anyone-reader permission
(Drive metadata independently checked). Download only this exact known PDF,
verify byte length and PDF signature, upload without overwrites to the new
private R2 production bucket, allowlist its ORIGINAL key in production D1,
and verify HEAD via the already deployed read-only preview.

Never delete/edit Supabase, R2 staging, other production media, GitHub main,
DNS, Worker deployment, user accounts or statistics. No bytes or sensitive
links emitted to the public CI log.
"""
import hashlib
import json
import os
import re
import sys
from urllib.parse import urlsplit
import boto3
import requests
from botocore.config import Config
from botocore.exceptions import ClientError

from scripts.import_public_programme_production_d1 import check_env, query
from scripts.audit_public_only_media import SOURCE_TABLES,fetch_all,list_objects

PDF_ID="pdf-1789466878259-22-9vktt"
PATH="media/pdf-1789466878259-22-9vktt/file-1789466879911-Pardon-des-Offenses-version-raccourcie.pdf"
DRIVE_FILE_ID="1H4qk88nN81AmMId9g3Efsc-20MRJZEKp"
EXPECTED_BYTES=1189910
BUCKET="celebrations-exit-production"
PREVIEW="https://celebrations-exit-preview-ro.rondes.workers.dev"
SOURCE="jwyayfkssyagvnablttg.supabase.co"
PROD_BASELINE=121
PROD_BYTES_BEFORE=766989338


def get_file_from_public_drive():
    # This is the exact publicly shared PDF previously verified in the
    # owner's connected Drive. No credentials/cookies in outbound requests.
    uri="https://drive.google.com/uc?export=download&id="+DRIVE_FILE_ID
    session=requests.Session()
    session.headers.update({"User-Agent":"Mozilla/5.0 (compatible; CelebrationsMigration/1.0)"})
    r=session.get(uri,timeout=60,allow_redirects=True)
    r.raise_for_status()
    host=urlsplit(r.url).hostname or ""
    if host not in ("drive.google.com","drive.usercontent.google.com") and not host.endswith(".googleusercontent.com"):
        raise ValueError("Unrecognized Google Drive download host")
    body=r.content
    if len(body)!=EXPECTED_BYTES:
        raise ValueError("Recovered PDF length does not match verified Drive metadata")
    if not body.startswith(b"%PDF-") or b"%%EOF" not in body[-2048:]:
        raise ValueError("Recovered Drive resource is not a complete PDF")
    return body


def client():
    account=os.environ["CLOUDFLARE_ACCOUNT_ID"]
    endpoint=os.environ["R2_ENDPOINT"].rstrip("/")
    u=urlsplit(endpoint)
    if (not re.fullmatch("[0-9a-f]{32}",account,re.I) or
        u.scheme!="https" or u.hostname!=account+".r2.cloudflarestorage.com"
        or u.path or u.query or u.fragment):
        raise ValueError("Wrong R2 account endpoint")
    access=os.environ["CELEBRATIONS_PROD_R2_ACCESS_KEY_ID"]
    secret=os.environ["CELEBRATIONS_PROD_R2_SECRET_ACCESS_KEY"]
    if not access or not secret or access==os.environ["STAGING_R2_ACCESS_KEY_ID"]:
        raise ValueError("Incorrect scoped production R2 credential")
    return boto3.client("s3",endpoint_url=endpoint,region_name="auto",
        aws_access_key_id=access,aws_secret_access_key=secret,
        config=Config(retries={"max_attempts":2,"mode":"standard"}))


def inventory(s3):
    out={}
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=BUCKET):
        for item in page.get("Contents",[]):
            if item["Key"] in out or len(out)>130:
                raise ValueError("Unexpected destination R2 inventory")
            out[item["Key"]]=item["Size"]
    return out


def cloudflare_db():
    root,db=check_env()
    cf=requests.Session()
    cf.headers.update({"Authorization":"Bearer "+os.environ["CLOUDFLARE_API_TOKEN"],
                       "Content-Type":"application/json"})
    response=cf.get(root+"/d1/database/"+db,timeout=25)
    response.raise_for_status()
    body=response.json()
    result=body.get("result") or {}
    if body.get("success") is not True or result.get("name")!=BUCKET or result.get("jurisdiction")!="eu":
        raise ValueError("Incorrect production D1 destination")
    return cf,root+"/d1/database/"+db+"/query"


def main():
    if os.environ.get("GITHUB_REF")!="refs/heads/feat/celebrations-supabase-exit-001":
        raise ValueError("Only approved migration branch can perform rescue")
    if os.environ.get("STAGING_R2_BUCKET")!="celebrations-exit-staging":
        raise ValueError("Wrong staging resource")
    base=os.environ["SUPABASE_URL"].rstrip("/")
    origin=urlsplit(base)
    if origin.hostname!=SOURCE or origin.scheme!="https" or origin.path or origin.query:
        raise ValueError("Incorrect Supabase source")
    sup=requests.Session()
    token=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    sup.headers.update({"apikey":token,"Authorization":"Bearer "+token})
    contents=fetch_all(sup,base,"celebrations_contents")
    selected=[row for row in contents if row.get("id")==PDF_ID]
    if len(selected)!=1 or selected[0].get("storage_path")!=PATH or (
       selected[0].get("audience")!="all" or selected[0].get("content_type")!="PDF"):
        raise ValueError("Original public PDF metadata no longer matches")
    placed=fetch_all(sup,base,"celebrations_event_contents")
    if len([row for row in placed if row.get("content_id")==PDF_ID])!=1:
        raise ValueError("Expected exactly one published event referencing PDF")
    src_inv=list_objects(sup,base)
    if PATH in src_inv or len(src_inv)!=158 or sum(src_inv.values())!=830312417:
        raise ValueError("Source bucket changed or file already repaired at source")

    r2=client()
    cf,endpoint=cloudflare_db()
    before=inventory(r2)
    previous_count=PROD_BASELINE+(1 if PATH in before else 0)
    if len(before)!=previous_count or sum(before.values())!=(
       PROD_BYTES_BEFORE+(EXPECTED_BYTES if PATH in before else 0)):
        raise ValueError("Unexpected production R2 content drift")
    previous,_,_=query(cf,endpoint,'SELECT storage_path,approved,revoked_at FROM "public_media" WHERE storage_path=?',[PATH])
    if len(previous)>1 or any(row["approved"]!=1 or row["revoked_at"] is not None for row in previous):
        raise ValueError("Conflicting ACL for published PDF")
    pdf=get_file_from_public_drive()
    digest=hashlib.sha256(pdf).digest()
    if PATH not in before:
        r2.put_object(Bucket=BUCKET,Key=PATH,Body=pdf,
            ContentType="application/pdf",CacheControl="private, no-store",
            Metadata={"kind":"restored-public-pdf","source":"owner-google-drive"})
    obj=r2.get_object(Bucket=BUCKET,Key=PATH)
    returned=obj["Body"].read()
    if len(returned)!=EXPECTED_BYTES or hashlib.sha256(returned).digest()!=digest:
        raise RuntimeError("Recovered R2 PDF does not match source bytes")
    if not previous:
        _,_,written=query(cf,endpoint,
          'INSERT INTO "public_media" (storage_path,approved,revoked_at,approved_at) VALUES (?,1,NULL,NULL)',
          [PATH],allow_write=True)
        if not 1<=written<=4:raise RuntimeError("Unexpected media ACL accounting")
    final,_,_=query(cf,endpoint,'SELECT storage_path,approved,revoked_at FROM "public_media" WHERE storage_path=?',[PATH])
    if final!=[{"storage_path":PATH,"approved":1,"revoked_at":None}]:
        raise RuntimeError("Recovered public file not properly allowlisted")
    after=inventory(r2)
    if set(after)!=set(before)|{PATH} or len(after)!=122 or (
       sum(after.values())!=PROD_BYTES_BEFORE+EXPECTED_BYTES):
        raise RuntimeError("Recovered media disrupted other production objects")
    response=requests.head(PREVIEW+"/media/"+requests.utils.requote_uri(PATH),timeout=30)
    if response.status_code!=200:
        raise RuntimeError("Read-only preview media HEAD is not serving recovered PDF")
    print("PUBLIC_PDF_RECOVERY_VERIFIED "+json.dumps({
        "recovered_files":1,
        "source_public_file_previously_missing":True,
        "owner_drive_public_link_verified":True,
        "bytes_compared_with_SHA256":EXPECTED_BYTES,
        "r2_production_objects":122,
        "public_media_acl_approved_objects":113,
        "other_media_preserved":True,
        "original_supabase_mutations":0,
        "r2_staging_mutations":0,
        "dns_changed":False,
        "main_branch_changed":False
    },sort_keys=True))


if __name__=="__main__":
    try:main()
    except BaseException as err:
        print("PUBLIC_PDF_RECOVERY_STOP category="+type(err).__name__,
              file=sys.stderr)
        raise SystemExit(1)
