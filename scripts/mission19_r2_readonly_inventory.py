#!/usr/bin/env python3
"""M19: bounded read-only R2 inventories, no keys or private contents in logs.

This does not back up media bytes. Only metadata needed to plan an independent
backup is inspected. The editor snapshot itself is backed up separately by
the M03 encrypted snapshot script (with its explicit one-time guard).
"""
import json
import os
import sys

from mission03_editor_private_backup import BUCKET, KEY, private_s3, validate_editor_snapshot

PROD_MEDIA_BUCKET = "celebrations-exit-production"
MAX_OBJECTS = 25000


def read_inventory(client, bucket, prefix):
    token = None
    count = size = 0
    seen = set()
    while True:
        args = {"Bucket": bucket, "MaxKeys": 1000, "Prefix": prefix}
        if token:
            if token in seen:
                raise RuntimeError("Repeated R2 pagination cursor")
            seen.add(token)
            args["ContinuationToken"] = token
        page = client.list_objects_v2(**args)
        objects = page.get("Contents") or []
        count += len(objects)
        size += sum(obj.get("Size", 0) for obj in objects)
        if count > MAX_OBJECTS:
            raise RuntimeError("R2 inventory exceeds bounded limit; incomplete")
        if not page.get("IsTruncated"):
            return {"object_count": count, "total_bytes": size, "complete_page_walk": True}
        token = page.get("NextContinuationToken")
        if not token:
            raise RuntimeError("R2 truncated listing without a cursor")


def main():
    client = private_s3()
    original = client.get_object(Bucket=BUCKET, Key=KEY)
    body = original["Body"].read(5_000_001)
    _, metadata = validate_editor_snapshot(body)
    if not original.get("ETag"):
        raise RuntimeError("Missing R2 source ETag")
    if client.head_object(Bucket=BUCKET, Key=KEY).get("ETag") != original["ETag"]:
        raise RuntimeError("Editor object changed during inventory")
    print("M19_EDITOR_LIVE_READONLY_PASS " + json.dumps({
        "snapshot_valid": True,
        "revision": metadata["revision"],
        "source_bytes": len(body),
        "source_unchanged": True,
        "reads_only": True
    }, sort_keys=True))

    for label, bucket, prefix in (
        ("new_editor_uploads", BUCKET, "editor-trials/uploads/"),
        ("historic_production_media", PROD_MEDIA_BUCKET, ""),
    ):
        try:
            inventory = read_inventory(client, bucket, prefix)
            print("M19_R2_INVENTORY_PASS " + json.dumps({"scope": label, **inventory}, sort_keys=True))
        except Exception as exc:
            # Unavailable permission is not proof of empty media. No paths or
            # remote error content printed, including private object keys.
            print("M19_R2_INVENTORY_UNAVAILABLE " + json.dumps({
                "scope": label, "reason_type": type(exc).__name__,
                "complete_copy_verified": False,
            }, sort_keys=True))
    print("M19_R2_INVENTORY_LIMITS " + json.dumps({
        "media_bytes_exported": False,
        "independent_media_backup": False,
        "r2_writes": 0, "d1_writes": 0, "worker_writes": 0,
        "keys_or_private_media_paths_logged": False,
    }, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("M19_R2_READONLY_STOP category=" + type(exc).__name__, file=sys.stderr)
        sys.exit(1)
