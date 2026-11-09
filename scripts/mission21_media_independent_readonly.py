#!/usr/bin/env python3
"""M21: read-only check of independent Supabase media source and R2 copies.
Never print object names, URLs, tokens or private content. Never write media.
This is a metadata drift test against Oct-2026 SHA256 proofs, NOT a new hash.
"""
import datetime as dt
import json
import os
import re
import sys
from urllib.parse import urlsplit

import boto3
import requests
from botocore.config import Config

from audit_celebrations_media_dual_copy_readonly import r2_inventory
from audit_public_only_media import SOURCE_TABLES, fetch_all, list_objects
from copy_selected_public_media_to_production import select_visible_paths

ACCOUNT_RE = re.compile(r"^[a-fA-F0-9]{32}$")
SOURCE = "https://jwyayfkssyagvnablttg.supabase.co"
STAGING = "celebrations-exit-staging"
PRODUCTION = "celebrations-exit-production"
EXPECTED_SOURCE_FILES = 158
EXPECTED_SOURCE_BYTES = 830312417
EXPECTED_PROD_FILES = 121
EXPECTED_PROD_BYTES = 766989338
PROD_COPY_COMPLETED_BEFORE = dt.datetime(2026, 10, 23, tzinfo=dt.timezone.utc)


def cloudflare_client(scope):
    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
    endpoint = os.environ.get("R2_ENDPOINT", "").rstrip("/")
    parsed = urlsplit(endpoint)
    if not ACCOUNT_RE.fullmatch(account) or parsed.scheme != "https" or (
        parsed.hostname != account + ".r2.cloudflarestorage.com" or
        parsed.path or parsed.query or parsed.fragment
    ):
        raise ValueError("Unexpected Cloudflare R2 identity")
    if scope == "staging":
        access = os.environ["STAGING_R2_ACCESS_KEY_ID"]
        secret = os.environ["STAGING_R2_SECRET_ACCESS_KEY"]
    elif scope == "production":
        access = os.environ["CELEBRATIONS_PROD_R2_ACCESS_KEY_ID"]
        secret = os.environ["CELEBRATIONS_PROD_R2_SECRET_ACCESS_KEY"]
    else:
        raise ValueError("Unexpected R2 role")
    if not access or not secret or (scope == "production" and
        access == os.environ.get("STAGING_R2_ACCESS_KEY_ID")):
        raise ValueError("Missing or reused private R2 credentials")
    return boto3.client(
        "s3", endpoint_url=endpoint, region_name="auto",
        aws_access_key_id=access, aws_secret_access_key=secret,
        config=Config(retries={"max_attempts": 2, "mode": "standard"},
                      connect_timeout=10, read_timeout=20)
    )


def check_production(selected, sizes, objects):
    if len(selected) != EXPECTED_PROD_FILES or sum(sizes[k] for k in selected) != EXPECTED_PROD_BYTES:
        raise ValueError("Protected media selection changed")
    if len(objects) != EXPECTED_PROD_FILES or set(objects) != set(selected):
        raise ValueError("Production media keys not identical to protected selection")
    wrong_size = changed = 0
    for k in selected:
        item = objects[k]
        if int(item["Size"]) != int(sizes[k]):
            wrong_size += 1
        modified = item.get("LastModified")
        if not isinstance(modified, dt.datetime) or modified.astimezone(dt.timezone.utc) >= PROD_COPY_COMPLETED_BEFORE:
            changed += 1
    if wrong_size or changed:
        raise ValueError("Production media size/date changed since historic hash proof")
    return {"protected_media": len(selected), "protected_bytes": EXPECTED_PROD_BYTES,
            "production_object_count": len(objects), "size_mismatches": 0,
            "modified_after_hash_proof": 0, "source_still_independent": True,
            "new_sha256_recomputed": False}


def main():
    if os.environ.get("GITHUB_REF") != "refs/heads/audit/celebrations-mission-21-final-preflight-20261109":
        raise ValueError("Wrong audit branch")
    if os.environ.get("STAGING_R2_BUCKET") != STAGING:
        raise ValueError("Unexpected staging bucket")
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    if base != SOURCE:
        raise ValueError("Unexpected independent source origin")
    sess = requests.Session()
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    if len(key) < 20:
        raise ValueError("Source credentials unavailable")
    sess.headers.update({"apikey": key, "Authorization": "Bearer " + key})
    # Source outside Cloudflare: check keys/sizes, without falsely claiming
    # today's content matches SHA256 from October (not redownloaded).
    print("M21_SOURCE_LIST_START", flush=True)
    source = list_objects(sess, base)
    print("M21_SOURCE_AGGREGATE "+json.dumps({
        "object_count":len(source), "total_bytes":sum(source.values()),
        "previous_reference_count":EXPECTED_SOURCE_FILES,
        "previous_reference_bytes":EXPECTED_SOURCE_BYTES,
    }, sort_keys=True), flush=True)
    if len(source) != EXPECTED_SOURCE_FILES or sum(source.values()) != EXPECTED_SOURCE_BYTES:
        raise ValueError("Historical source inventory changed")
    print("M21_STAGING_LIST_START", flush=True)
    stage = r2_inventory(cloudflare_client("staging"))
    missing = set(source)-set(stage)
    wrong = [k for k in source if k in stage and source[k] != stage[k][0]]
    if missing or wrong:
        raise ValueError("Staging media keys/size differ from source")
    print("M21_INDEPENDENT_SUPABASE_STAGING_MANIFEST_PASS " + json.dumps({
        "supabase_source_files":len(source), "supabase_source_bytes":sum(source.values()),
        "r2_staging_matching_originals":len(source),
        "r2_staging_additional_objects":len(stage)-len(source),
        "missing":0,"size_mismatch":0,
        "historical_sha256_proof_only":True,"sha256_recomputed_today":False,
        "cloudflare_writes":0,"supabase_writes":0,
    }, sort_keys=True), flush=True)

    print("M21_REFERENCE_SELECTION_START",flush=True)
    data = {name: fetch_all(sess, base, table)
            for name, table in SOURCE_TABLES.items()}
    source2 = list_objects(sess, base)
    if source2 != source:
        raise ValueError("Supabase media inventory changed across reads")
    report, partition = select_visible_paths(data, source2)
    approved = partition["selected"]
    print("M21_PRODUCTION_LIST_START",flush=True)
    bucket = cloudflare_client("production")
    objects = {}
    for page in bucket.get_paginator("list_objects_v2").paginate(Bucket=PRODUCTION):
        for o in page.get("Contents", []):
            if o["Key"] in objects or len(objects) > EXPECTED_PROD_FILES:
                raise ValueError("Duplicate/extra production object")
            objects[o["Key"]] = o
    outcome = check_production(approved, source, objects)
    print("M21_PRODUCTION_MEDIA_READONLY_PASS " + json.dumps({
        **outcome, "committee_invitations": report["committee_invitations_protected"],
        "media_source_writes": 0, "r2_writes": 0, "d1_writes": 0,
        "secret_or_key_names_logged": False,
    }, sort_keys=True))
    print("M21_MEDIA_RESIDUAL " + json.dumps({
        "existing_independent_supabase_copy": True,
        "new_editor_upload_included_in_supabase": False,
        "actual_offsite_backup_of_editor_and_d1": False,
        "historical_hash_proof_reused_not_recomputed": True,
    }, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # Never include remote error messages or object names in logs.
        print("M21_MEDIA_READONLY_STOP category=" + type(exc).__name__, file=sys.stderr)
        sys.exit(1)
