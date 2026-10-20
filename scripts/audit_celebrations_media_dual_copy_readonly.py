#!/usr/bin/env python3
"""CÉLÉBRATIONS: metadata-only audit of 158 independent Supabase/R2 media copies.

STRICT READ-ONLY: Supabase Storage list (POST listing endpoint only) and R2
list_objects_v2. No content downloads, D1, mutations, signed URLs, or PII logs.
This verifies keys, sizes, and modification timestamps; it does NOT rehash
bodies and is not a third/off-site backup.
"""
import datetime
import json
import os
from urllib.parse import urlsplit

import requests

SOURCE_HOST = "jwyayfkssyagvnablttg.supabase.co"
SOURCE_BUCKET = "celebrations-media"
STAGING_BUCKET = "celebrations-exit-staging"
EXPECTED_FILES = 158
EXPECTED_BYTES = 830312417
# Previous full SHA256 verification finished on 2026-10-19. Reject content
# modification timestamps after its beginning, even if sizes stay the same.
SHA_REHEARSAL_START = datetime.datetime(2026, 10, 19, 0, 0,
                                       tzinfo=datetime.timezone.utc)
# 61 original objects were first PUT into R2 during the SHA256 comparison on
# 19 Oct. A new write *on that day* was the verified transfer, not drift.
# Reject an original R2 object touched after the end of that day.
R2_VERIFIED_BY = datetime.datetime(2026, 10, 20, 0, 0,
                                  tzinfo=datetime.timezone.utc)


def instant(value):
    if isinstance(value, datetime.datetime):
        return value.astimezone(datetime.timezone.utc)
    if not isinstance(value, str):
        raise RuntimeError("Source media timestamp missing")
    try:
        return datetime.datetime.fromisoformat(
            value.replace("Z", "+00:00")
        ).astimezone(datetime.timezone.utc)
    except ValueError as exc:
        raise RuntimeError("Source media timestamp invalid") from exc


def source_inventory(session, base, bucket=SOURCE_BUCKET):
    """Walk private Supabase Storage listing. Never print object keys."""
    found = {}
    visited = set()

    def walk(prefix="", depth=0):
        if depth > 16 or prefix in visited:
            raise RuntimeError("Unsafe or recursive media prefix")
        visited.add(prefix)
        offset = 0
        while True:
            response = session.post(
                base + "/storage/v1/object/list/" + bucket,
                json={"prefix": prefix, "limit": 100, "offset": offset,
                      "sortBy": {"column": "name", "order": "asc"}},
                timeout=40,
            )
            response.raise_for_status()
            rows = response.json()
            if not isinstance(rows, list) or len(rows) > 100:
                raise RuntimeError("Unexpected source listing")
            for row in rows:
                if not isinstance(row, dict):
                    raise RuntimeError("Invalid source object")
                name = row.get("name")
                if not name or name == ".emptyFolderPlaceholder":
                    continue
                key = prefix + name
                if (len(key) > 1024 or "\\" in key or
                    any(component in ("", ".", "..") for component in key.split("/"))):
                    raise RuntimeError("Unsafe media key")
                if row.get("id") is None:
                    walk(key + "/", depth + 1)
                    continue
                if key in found:
                    raise RuntimeError("Duplicate Supabase media key")
                size = (row.get("metadata") or {}).get("size")
                try:
                    size = int(size)
                except (ValueError, TypeError) as exc:
                    raise RuntimeError("Source media size missing") from exc
                if not 0 <= size <= 500 * 1024 * 1024:
                    raise RuntimeError("Invalid source file size")
                updated = instant(row.get("updated_at"))
                if updated >= SHA_REHEARSAL_START:
                    raise RuntimeError("Source media changed after SHA256 proof")
                found[key] = size
                if len(found) > EXPECTED_FILES:
                    raise RuntimeError("Source gained media after last copy")
            if len(rows) < 100:
                break
            offset += len(rows)
            if offset > 1000:
                raise RuntimeError("Source pagination beyond audit bound")

    walk()
    return found


def r2_inventory(client):
    """Include staging-only objects, but never treat them as source originals."""
    seen = {}
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=STAGING_BUCKET):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            if key in seen:
                raise RuntimeError("Duplicate R2 object")
            seen[key] = (int(obj["Size"]), instant(obj["LastModified"]))
            if len(seen) > 500:
                raise RuntimeError("Unexpected number of staging objects")
    return seen


def compare_manifests(source, target):
    """Only approved 158 original objects are compared; extras preserved."""
    if len(source) != EXPECTED_FILES or sum(source.values()) != EXPECTED_BYTES:
        raise RuntimeError("Original source inventory changed")
    missing = set(source) - set(target)
    wrong_size = [
        key for key in source if key in target and target[key][0] != source[key]
    ]
    changed_after_sha = [
        key for key in source
        if key in target and target[key][1] >= R2_VERIFIED_BY
    ]
    if missing or wrong_size or changed_after_sha:
        raise RuntimeError(
            "Staging media parity conflict "
            f"missing={len(missing)} sizes={len(wrong_size)} "
            f"r2_updated_after_sha={len(changed_after_sha)}"
        )
    return {
        "source_files": len(source),
        "source_bytes": sum(source.values()),
        "r2_original_keys_and_sizes_verified": len(source),
        "missing_originals": 0,
        "mismatched_sizes": 0,
        "r2_originals_modified_since_sha_proof": 0,
        "staging_only_objects_preserved": len(set(target) - set(source)),
        "source_mutations": 0,
        "r2_mutations": 0,
        "d1_queries": 0,
        "new_bytes_downloaded": 0,
        "sha256_content_rechecked_this_run": False,
    }


def main():
    import boto3
    from botocore.config import Config
    assert os.environ.get("GITHUB_REF") == (
        "refs/heads/feat/celebrations-supabase-exit-001"
    ), "Production branch refused"
    base = os.environ["SUPABASE_URL"].rstrip("/")
    parsed = urlsplit(base)
    if parsed.scheme != "https" or parsed.hostname != SOURCE_HOST or (
        parsed.path or parsed.query or parsed.fragment
    ):
        raise RuntimeError("Unexpected Supabase source")
    account = os.environ["CLOUDFLARE_ACCOUNT_ID"]
    endpoint = os.environ["R2_ENDPOINT"].rstrip("/")
    parsed = urlsplit(endpoint)
    if (parsed.scheme != "https" or
        parsed.hostname != account + ".r2.cloudflarestorage.com" or
        parsed.path or parsed.query or parsed.fragment):
        raise RuntimeError("Unexpected Cloudflare R2 account")
    if os.environ["STAGING_R2_BUCKET"] != STAGING_BUCKET:
        raise RuntimeError("Production R2 bucket refused")
    session = requests.Session()
    session.headers.update({
        "apikey": os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        "Authorization": "Bearer " + os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    })
    r2 = boto3.client(
        "s3", endpoint_url=endpoint, region_name="auto",
        aws_access_key_id=os.environ["STAGING_R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["STAGING_R2_SECRET_ACCESS_KEY"],
        config=Config(retries={"max_attempts":2, "mode":"standard"}),
    )
    source = source_inventory(session, base)
    target = r2_inventory(r2)
    report = compare_manifests(source, target)
    print("CELEBRATIONS_MEDIA_DUAL_COPY_READONLY_PASS " +
          json.dumps(report, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except BaseException as exc:
        # Never print private file names, HTTP response bodies or signed URLs.
        print("CELEBRATIONS_MEDIA_DUAL_COPY_READONLY_FAIL category=" +
              type(exc).__name__)
        raise SystemExit(1)
