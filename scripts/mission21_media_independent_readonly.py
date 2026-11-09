#!/usr/bin/env python3
"""M21 — metadata-only, read-only evidence after owner-approved Oct 28 source cleanup.
Neither SHA rehash, nor copy, nor any media modification. Do not log object keys.
"""
import json
import os
import re
import sys
from urllib.parse import urlsplit

import boto3
import requests
from botocore.config import Config
from audit_celebrations_media_dual_copy_readonly import r2_inventory
from audit_public_only_media import list_objects

ACCOUNT = re.compile(r"^[a-fA-F0-9]{32}$")
SOURCE = "https://jwyayfkssyagvnablttg.supabase.co"
STAGING = "celebrations-exit-staging"
PRODUCTION = "celebrations-exit-production"


def client(scope):
    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
    endpoint = os.environ.get("R2_ENDPOINT", "").rstrip("/")
    u = urlsplit(endpoint)
    if not ACCOUNT.fullmatch(account) or u.scheme != "https" or (
        u.hostname != account + ".r2.cloudflarestorage.com" or
        u.path or u.query or u.fragment
    ):
        raise ValueError("Unexpected R2 account")
    if scope == "staging":
        access, secret = (os.environ.get("STAGING_R2_ACCESS_KEY_ID"),
                          os.environ.get("STAGING_R2_SECRET_ACCESS_KEY"))
    elif scope == "production":
        access, secret = (os.environ.get("CELEBRATIONS_PROD_R2_ACCESS_KEY_ID"),
                          os.environ.get("CELEBRATIONS_PROD_R2_SECRET_ACCESS_KEY"))
    else:
        raise ValueError("Invalid role")
    if not access or not secret or (scope == "production" and
       access == os.environ.get("STAGING_R2_ACCESS_KEY_ID")):
        raise ValueError("Scoped R2 credentials unavailable")
    return boto3.client(
        "s3", endpoint_url=endpoint, region_name="auto",
        aws_access_key_id=access, aws_secret_access_key=secret,
        config=Config(retries={"max_attempts": 2, "mode": "standard"},
                      connect_timeout=10, read_timeout=20)
    )


def main():
    if os.environ.get("GITHUB_REF") != "refs/heads/audit/celebrations-mission-21-final-preflight-20261109":
        raise ValueError("Wrong branch")
    if os.environ.get("STAGING_R2_BUCKET") != STAGING:
        raise ValueError("Wrong bucket")
    if os.environ.get("SUPABASE_URL", "").rstrip("/") != SOURCE:
        raise ValueError("Wrong independent provider")
    s = requests.Session()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if len(key) < 20:
        raise ValueError("Source read-only credentials missing")
    s.headers.update({"apikey":key, "Authorization":"Bearer "+key})
    source = list_objects(s, SOURCE)
    print("M21_SUPABASE_MEDIA_SOURCE_READONLY "+json.dumps({
        "original_objects_current":len(source), "original_bytes_current":sum(source.values()),
        "historical_count_october":158,
        "independent_media_copy_available":len(source)>=158,
        "read_only":True,
    }, sort_keys=True),flush=True)
    # Earlier owner-authorized deletion (28 Oct) means 0 objects is possible.
    # The prior SHA256 proof of 121/158 objects is HISTORICAL, not current.
    stage = r2_inventory(client("staging"))
    print("M21_STAGING_R2_READONLY "+json.dumps({
        "total_objects_including_private_backups":len(stage),
        "historical_158_object_sha_still_current":False,
        "read_only":True,
    },sort_keys=True),flush=True)
    p = client("production")
    prod = {}
    for page in p.get_paginator("list_objects_v2").paginate(Bucket=PRODUCTION):
        for o in page.get("Contents", []):
            if o["Key"] in prod or len(prod)>1000:
                raise ValueError("Production inventory inconsistent")
            prod[o["Key"]] = int(o["Size"])
    matching = {k for k in prod if k in stage and stage[k][0]==prod[k]}
    bad_size = {k for k in prod if k in stage and stage[k][0]!=prod[k]}
    prod_bytes = sum(prod.values())
    print("M21_R2_TWO_COPIES_METADATA_ONLY "+json.dumps({
        "production_objects":len(prod),
        "production_bytes":prod_bytes,
        "present_in_staging_same_size":len(matching),
        "not_in_staging":len(prod)-len(matching)-len(bad_size),
        "staging_size_conflicts":len(bad_size),
        "legacy_production_copy_reference":121,
        "legacy_production_bytes_reference":766989338,
        "old_source_supabase_available":bool(source),
        "new_sha256_recomputed":False,
        "metadata_inventory_not_an_independent_backup":True,
        "all_remote_writes":0
    },sort_keys=True),flush=True)
    print("M21_BACKUP_VERDICT "+json.dumps({
        "source_supabase_deleted":len(source)==0,
        "independent_off_cloudflare_media_backup_proven":False,
        "all_media_restore_proven":False,
        "site_release_authorized":False,
    },sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("M21_MEDIA_READONLY_STOP category=" + type(e).__name__,
              file=sys.stderr)
        sys.exit(1)
