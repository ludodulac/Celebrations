#!/usr/bin/env python3
"""Copy (never move/delete) every Supabase Storage object to Cloudflare R2."""
import os
import sys
import time
from urllib.parse import quote
import requests
import boto3
from botocore.config import Config
from boto3.s3.transfer import TransferConfig

BUCKET = "celebrations-media"
URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
DRY_RUN = os.environ.get("DRY_RUN", "true").lower() != "false"
headers = {"apikey": KEY, "Authorization": "Bearer " + KEY}
session = requests.Session()
session.headers.update(headers)
r2 = boto3.client(
    "s3",
    endpoint_url=os.environ["R2_ENDPOINT"].rstrip("/"),
    aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    region_name="auto",
    config=Config(retries={"max_attempts": 5, "mode": "standard"}),
)
transfer = TransferConfig(multipart_threshold=8 * 1024 * 1024, multipart_chunksize=8 * 1024 * 1024)
seen = set()

def objects(prefix=""):
    offset = 0
    while True:
        response = session.post(
            f"{URL}/storage/v1/object/list/{BUCKET}",
            json={"prefix": prefix, "limit": 100, "offset": offset, "sortBy": {"column": "name", "order": "asc"}},
            timeout=60,
        )
        response.raise_for_status()
        entries = response.json()
        if not isinstance(entries, list):
            raise RuntimeError("Unexpected Supabase listing response")
        for entry in entries:
            name = entry.get("name")
            if not name or name in (".emptyFolderPlaceholder",):
                continue
            path = prefix + name
            if entry.get("id") is None:
                yield from objects(path + "/")
            else:
                yield path, entry
        if len(entries) < 100:
            break
        offset += len(entries)

def copy_one(path, entry):
    expected = (entry.get("metadata") or {}).get("size")
    if path in seen:
        raise RuntimeError(f"Duplicate object path: {path}")
    seen.add(path)
    if DRY_RUN:
        print(f"PLAN {path} ({expected} bytes)")
        return "planned"
    url = f"{URL}/storage/v1/object/{BUCKET}/{quote(path, safe='/')}"
    with session.get(url, stream=True, timeout=(30, 180)) as response:
        response.raise_for_status()
        response.raw.decode_content = True
        r2.upload_fileobj(response.raw, BUCKET, path, Config=transfer)
    remote = r2.head_object(Bucket=BUCKET, Key=path)
    actual = remote["ContentLength"]
    if expected is not None and int(expected) != actual:
        raise RuntimeError(f"SIZE MISMATCH {path}: source {expected}, R2 {actual}")
    print(f"VERIFIED {path} ({actual} bytes)")
    return "copied"

def main():
    total = 0
    failed = []
    for path, entry in objects():
        total += 1
        try:
            copy_one(path, entry)
        except Exception as error:
            print(f"FAILED {path}: {type(error).__name__}: {error}", file=sys.stderr)
            failed.append(path)
    print(f"SUMMARY mode={'DRY_RUN' if DRY_RUN else 'COPY'} objects={total} failures={len(failed)}")
    if total == 0 or failed:
        sys.exit(1)

if __name__ == "__main__":
    main()
