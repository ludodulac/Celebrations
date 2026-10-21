#!/usr/bin/env python3
"""Copy ONLY verified, currently user-facing CÉLÉBRATIONS media to private R2 PROD.

Inputs: 158 source Storage keys and 211 content cards in Supabase (READ ONLY),
plus previously SHA256-verified private staging R2. No Supabase binary download.
Output: only 121 required objects (or more if an additional public hardcoded
reference is discovered), copied server-side to the NEW private production R2.
Never delete, change permissions, access DNS, import D1 or expose object names.
All bytes are SHA256 checked on both sides and checked against source size.
Requires GitHub one-time trigger on the migration branch and Free budget guard.
"""
import collections
import hashlib
import json
import os
import pathlib
import re
import sys
from urllib.parse import urlsplit

import boto3
import requests
from botocore.config import Config
from botocore.exceptions import ClientError
try:
    from scripts.audit_public_only_media import (
        SOURCE_HOST, asset_audit, fetch_all, list_objects, static_homepage_refs,
        SOURCE_TABLES,
    )
except ModuleNotFoundError:
    from audit_public_only_media import (
        SOURCE_HOST, asset_audit, fetch_all, list_objects, static_homepage_refs,
        SOURCE_TABLES,
    )

BUCKET_SOURCE="celebrations-exit-staging"
BUCKET_DEST="celebrations-exit-production"
SOURCE_COUNT=158
SOURCE_BYTES=830312417
TARGET_HISTORICAL_COUNT=121


def select_visible_paths(data, inventory, project_root="."):
    report, keys = asset_audit(
        data["contents"],data["event_links"],data["step_links"],
        data["events"],data["links"],data["letters"],inventory,
        static_homepage_refs(),return_sets=True)
    if (report["source_content_cards"]!=211 or
        report["program_linked_cards"]!=108 or
        report["storage_objects_total"]!=SOURCE_COUNT or
        len(keys["selected"])!=TARGET_HISTORICAL_COUNT):
        raise ValueError("Referenced or previously verified inventory changed")
    # Public UI code can refer directly to files that are not in any admin
    # relation. Catch literal key uses in rendered pages. The fallback JSON
    # contains the complete historic admin catalog, so it is NOT equivalent
    # to a rendered public reference and is excluded from this static test.
    root=pathlib.Path(project_root)
    public_code=[
        root/"index.html", *root.glob("*/index.html"),
        *root.glob("public-*.js"),
        *root.glob("*.css"),
        root/"supabase-data.js",
    ]
    public_code=[
        p for p in public_code if p.is_file() and
        p.name not in ("public-fallback-state.js",)
        and "admin" not in p.parts
    ]
    source="\n".join(p.read_text(encoding="utf-8") for p in public_code)
    missing_static=[k for k in keys["review"] if k in source]
    if missing_static:
        raise ValueError("Unassigned object is directly used in a public page script")
    # Do not leak these private keys to logs.
    return report,keys


def s3_client():
    account=os.environ["CLOUDFLARE_ACCOUNT_ID"]
    if not re.fullmatch("[a-f0-9]{32}",account,re.I):
        raise ValueError("Invalid Cloudflare account")
    endpoint=os.environ["R2_ENDPOINT"].rstrip("/")
    parsed=urlsplit(endpoint)
    if (parsed.scheme!="https" or
        parsed.hostname!=account+".r2.cloudflarestorage.com" or
        parsed.path or parsed.query or parsed.fragment):
        raise ValueError("Unapproved R2 account endpoint")
    return boto3.client("s3",endpoint_url=endpoint,region_name="auto",
        aws_access_key_id=os.environ["STAGING_R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["STAGING_R2_SECRET_ACCESS_KEY"],
        config=Config(retries={"max_attempts":3,"mode":"standard"}))


def stream_hash(s3,bucket,key):
    response=s3.get_object(Bucket=bucket,Key=key)
    sha=hashlib.sha256()
    read=0
    try:
        for block in response["Body"].iter_chunks(chunk_size=1048576):
            if block:
                sha.update(block)
                read+=len(block)
    finally:
        response["Body"].close()
    return sha.digest(),read


def check_identity():
    account=os.environ["CLOUDFLARE_ACCOUNT_ID"]
    if os.environ.get("GITHUB_REF")!="refs/heads/feat/celebrations-supabase-exit-001":
        raise ValueError("Refusing non-migration branch")
    if os.environ.get("STAGING_R2_BUCKET")!=BUCKET_SOURCE:
        raise ValueError("Refusing unexpected staging R2")
    session=requests.Session()
    session.headers["Authorization"]="Bearer "+os.environ["CLOUDFLARE_API_TOKEN"]
    root="https://api.cloudflare.com/client/v4/accounts/"+account
    for name in (BUCKET_SOURCE,BUCKET_DEST):
        response=session.get(root+"/r2/buckets/"+name,timeout=25)
        response.raise_for_status()
        body=response.json()
        if body.get("success") is not True or (body.get("result") or {}).get("name")!=name:
            raise ValueError("R2 identity not proven")
    database=session.get(root+"/d1/database/"+os.environ["PROD_D1_ID"],timeout=25)
    database.raise_for_status()
    body=database.json()
    if (body.get("success") is not True or
        (body.get("result") or {}).get("name")!=BUCKET_DEST or
        (body.get("result") or {}).get("jurisdiction")!="eu" or
        os.environ["PROD_D1_ID"]==os.environ["STAGING_D1_ID"]):
        raise ValueError("Separate EU production database not verified")


def require_empty_target(s3):
    paginator=s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=BUCKET_DEST):
        if page.get("Contents"):
            raise ValueError("Production bucket is not empty; refusing to overwrite")


def main():
    check_identity()
    base=os.environ["SUPABASE_URL"].rstrip("/")
    parsed=urlsplit(base)
    if (parsed.scheme!="https" or parsed.hostname!=SOURCE_HOST or
        parsed.path or parsed.query or parsed.fragment):
        raise ValueError("Unapproved Supabase origin")
    session=requests.Session()
    key=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    session.headers.update({"apikey":key,"Authorization":"Bearer "+key})
    data={k:fetch_all(session,base,table) for k,table in SOURCE_TABLES.items()}
    inventory=list_objects(session,base)
    if len(inventory)!=SOURCE_COUNT or sum(inventory.values())!=SOURCE_BYTES:
        raise ValueError("Source objects modified since historic SHA256 proof")
    report,partition=select_visible_paths(data,inventory)
    included=sorted(partition["selected"])
    if partition["selected"]&partition["review"]:
        raise RuntimeError("Selection intersects excluded objects")
    size_selected=sum(inventory[k] for k in included)
    print("SELECTIVE_R2_PRODUCTION_PLAN_SAFE "+
          json.dumps({"selected":len(included),"review_not_selected":len(partition["review"]),
            "source_total":SOURCE_COUNT,"protected_bytes":size_selected,
            "committee_letters_kept":report["committee_invitations_protected"],
            "preexisting_declared_missing_paths":len(partition["missing"]),
            "source_writes":0,"public_domain_changes":0,"d1_queries":0,
            "no_source_deletions":True},sort_keys=True),flush=True)

    r2=s3_client()
    # Requires a credential authorized to READ the existing staging bucket and
    # WRITE new isolated private production bucket. If scoped to staging alone,
    # HEAD/GET/List fail closed without changing permissions.
    try:
        r2.head_bucket(Bucket=BUCKET_SOURCE)
    except ClientError:
        raise RuntimeError("R2_STAGING_SOURCE_BUCKET_ACCESS_DENIED") from None
    print("SELECTIVE_R2_ACCESS staging_read=OK",flush=True)
    try:
        r2.head_bucket(Bucket=BUCKET_DEST)
    except ClientError:
        raise RuntimeError("R2_PRODUCTION_BUCKET_ACCESS_DENIED") from None
    print("SELECTIVE_R2_ACCESS production_bucket=OK",flush=True)
    try:
        require_empty_target(r2)
    except ClientError:
        raise RuntimeError("R2_PRODUCTION_LIST_PERMISSION_DENIED") from None
    print("SELECTIVE_R2_ACCESS production_bucket_initially_empty=YES",flush=True)
    counts=collections.Counter()
    verified_bytes=0
    for number,k in enumerate(included,1):
        length=int(inventory[k])
        original=r2.head_object(Bucket=BUCKET_SOURCE,Key=k)
        if original["ContentLength"]!=length:
            raise ValueError("Staging object diverges from current source inventory")
        expected_hash,expected_size=stream_hash(r2,BUCKET_SOURCE,k)
        if expected_size!=length:
            raise ValueError("Staging object SHA check length mismatch")
        # Server-side S3 CopyObject avoids temporary confidential bytes on
        # the GitHub runner or putting any media inside workflow artifacts.
        try:
            r2.copy_object(Bucket=BUCKET_DEST,Key=k,
                           CopySource={"Bucket":BUCKET_SOURCE,"Key":k},
                           MetadataDirective="COPY")
        except ClientError as ex:
            raise RuntimeError("R2 production copy rejected by credentials/endpoint") from None
        actual_hash,actual_size=stream_hash(r2,BUCKET_DEST,k)
        if actual_size!=length or actual_hash!=expected_hash:
            raise ValueError("R2 production copy SHA256 mismatch")
        verified_bytes+=length
        counts["sha256_verified"]+=1
        if number%25==0:
            print("SELECTIVE_R2_PRODUCTION_PROGRESS "+
                  json.dumps({"verified":number,"of":len(included)}),flush=True)

    result=r2.list_objects_v2(Bucket=BUCKET_DEST,MaxKeys=1000)
    final_keys={o["Key"]:o["Size"] for o in result.get("Contents",[])}
    if (result.get("IsTruncated") or set(final_keys)!=set(included) or
        any(final_keys[k]!=inventory[k] for k in included) or
        verified_bytes!=size_selected):
        raise ValueError("Production object inventory not exactly the protected selection")
    print("SELECTIVE_R2_PRODUCTION_COPY_VERIFIED "+
          json.dumps({
            "source_objects":SOURCE_COUNT,
            "destination_verified_objects":counts["sha256_verified"],
            "destination_verified_bytes":verified_bytes,
            "excluded_review_objects":len(partition["review"]),
            "missing_references_preexisting":len(partition["missing"]),
            "sha256_source_and_target_streamed":True,
            "private_r2_bucket":True,"source_deleted":False,
            "staging_deleted":False,"cloudflare_d1_reads_writes":0,
            "worker_deployed":False,"dns_changed":False
          },sort_keys=True),flush=True)


if __name__=="__main__":
    try:main()
    except BaseException as error:
        whitelist={"R2_STAGING_SOURCE_BUCKET_ACCESS_DENIED",
                   "R2_PRODUCTION_BUCKET_ACCESS_DENIED",
                   "R2_PRODUCTION_LIST_PERMISSION_DENIED",
                   "Production bucket is not empty; refusing to overwrite"}
        check=str(error) if str(error) in whitelist else "OTHER_NONDISCLOSED"
        print("SELECTIVE_R2_PRODUCTION_COPY_STOP category="+
              type(error).__name__+" checkpoint="+
              check.replace(" ","_"),file=sys.stderr)
        raise SystemExit(1)
