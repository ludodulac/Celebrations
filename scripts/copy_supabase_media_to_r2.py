#!/usr/bin/env python3
"""Copy (never move/delete) every Supabase Storage object to Cloudflare R2."""
import os
import sys
import tempfile
import hashlib
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from botocore.exceptions import ClientError
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
session.mount("https://", HTTPAdapter(max_retries=Retry(total=5, backoff_factor=1, status_forcelist=[429,500,502,503,504], allowed_methods=frozenset(["GET","POST"]), respect_retry_after_header=True)))
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

def source_size(entry):
    value = (entry.get("metadata") or {}).get("size")
    if value is None:
        raise RuntimeError("Missing source size metadata")
    return int(value)

def remote_size(path):
    try:
        return int(r2.head_object(Bucket=BUCKET, Key=path)["ContentLength"])
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") in ("404","NoSuchKey","NotFound"):
            return None
        raise


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
    expected = source_size(entry)
    if path in seen:
        raise RuntimeError(f"Duplicate object path: {path}")
    seen.add(path)
    if DRY_RUN:
        print(f"PLAN {path} ({expected} bytes)")
        return "planned"
    existing = remote_size(path)
    if existing is not None:
        if existing != expected:
            raise RuntimeError(f"DESTINATION CONFLICT {path}: source={expected} destination={existing}; refusing overwrite")
        raise RuntimeError(f"UNVERIFIED EXISTING OBJECT {path}: equal size is not proof of identical bytes; refusing overwrite or skip")
    url = f"{URL}/storage/v1/object/{BUCKET}/{quote(path, safe='/')}"
    # Rewindable spool allows multipart retry; never upload an exhausted HTTP stream.
    with tempfile.SpooledTemporaryFile(max_size=8 * 1024 * 1024) as spool:
        with session.get(url, stream=True, timeout=(30, 180)) as response:
            response.raise_for_status()
            count = 0
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    count += len(chunk)
                    if count > expected:
                        raise RuntimeError(f"SOURCE SIZE EXCEEDED {path}")
                    spool.write(chunk)
        if count != expected:
            raise RuntimeError(f"SOURCE SIZE MISMATCH {path}: expected={expected} downloaded={count}")
        spool.seek(0)
        digest = hashlib.sha256()
        while True:
            block = spool.read(1024 * 1024)
            if not block:
                break
            digest.update(block)
        source_sha256 = digest.hexdigest()
        spool.seek(0)
        r2.upload_fileobj(spool, BUCKET, path, Config=transfer)
    actual = remote_size(path)
    if actual != expected:
        raise RuntimeError(f"SIZE MISMATCH {path}: source={expected} R2={actual}")
    print(f"SIZE-VERIFIED ONLY {path} ({actual} bytes; source_sha256={source_sha256}); destination content hash not certified")
    return "copied"

def main():
    if not DRY_RUN and os.environ.get("CONFIRM_COPY") != "COPY":
        raise RuntimeError("Copy requires CONFIRM_COPY=COPY")
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
