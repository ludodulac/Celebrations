#!/usr/bin/env python3
"""Fresh 16-table AES-256-GCM source export; private R2 staging ciphertext only.
Restore locally from the downloaded ciphertext to RAM SQLite before reporting
success. Never upload raw tables or archive as GitHub artifacts.

This is a REST-paged, non-transactional safety checkpoint, NOT a transaction
snapshot. No changes to Supabase, D1, official site, or production R2.
"""
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tempfile
from urllib.parse import urlsplit

def main():
    if os.environ.get("GITHUB_REF")!="refs/heads/feat/celebrations-supabase-exit-001":
        raise RuntimeError("Wrong branch")
    if os.environ.get("STAGING_R2_BUCKET")!="celebrations-exit-staging":
        raise RuntimeError("Wrong backup bucket")
    if os.environ.get("SUPABASE_URL","").rstrip("/")!="https://jwyayfkssyagvnablttg.supabase.co":
        raise RuntimeError("Wrong source")
    if not os.path.ismount("/dev/shm"):
        raise RuntimeError("RAM-only temporary storage unavailable")
    os.environ["TMPDIR"]="/dev/shm"
    if not re.fullmatch(r"[0-9a-f]{32}",os.environ.get("CLOUDFLARE_ACCOUNT_ID",""),re.I):
        raise RuntimeError("Wrong Cloudflare account")
    dest_url=os.environ["R2_ENDPOINT"].rstrip("/")
    parsed=urlsplit(dest_url)
    if (parsed.scheme!="https" or parsed.hostname!=os.environ["CLOUDFLARE_ACCOUNT_ID"]+
       ".r2.cloudflarestorage.com" or parsed.path or parsed.query or parsed.fragment):
        raise RuntimeError("Wrong R2 S3 endpoint")
    passphrase=os.environ["CELEBRATIONS_BACKUP_PASSPHRASE"].encode("utf-8")
    if len(passphrase)<32:raise RuntimeError("No strong protected backup key")
    import boto3
    from botocore.config import Config
    from migration.encrypted_backup import create_from_source,verify_encrypted_file
    from migration.verify_real_backup_restore import restore_ciphertext_into_ram

    cli=boto3.client("s3",endpoint_url=dest_url,region_name="auto",
        aws_access_key_id=os.environ["STAGING_R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["STAGING_R2_SECRET_ACCESS_KEY"],
        config=Config(retries={"max_attempts":2,"mode":"standard"}))
    bucket="celebrations-exit-staging"
    cli.head_bucket(Bucket=bucket)
    from secrets import token_hex
    stamp=dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    name="private-backups/mission11-source-"+stamp+"-"+token_hex(12)+".cbackup"
    with tempfile.TemporaryDirectory(prefix="celebrations-m11-",dir="/dev/shm") as work:
        ciphertext=Path(work)/"snapshot.cbackup"
        create_from_source(ciphertext,passphrase)
        assert verify_encrypted_file(ciphertext,passphrase)==16
        raw=ciphertext.read_bytes()
        assert len(raw)>100000 and len(raw)<8*1024*1024
        digest=hashlib.sha256(raw).hexdigest()
        # Fresh unique key and explicit no overwrite to preserve previous
        # backups. Only ciphertext (never decrypted rows) leaves RAM runner.
        cli.put_object(Bucket=bucket,Key=name,Body=raw,ContentType="application/octet-stream",
            CacheControl="private,no-store",
            Metadata={"encrypted":"aes256gcm","kind":"mission11-source-only"},
            IfNoneMatch="*")
        downloaded=cli.get_object(Bucket=bucket,Key=name)
        assert downloaded["ContentLength"]==len(raw)
        assert downloaded.get("Metadata",{}).get("encrypted")=="aes256gcm"
        remote=downloaded["Body"].read()
        assert hashlib.sha256(remote).hexdigest()==digest
        with tempfile.TemporaryDirectory(prefix="celebrations-m11-restore-",dir="/dev/shm") as restored:
            report=restore_ciphertext_into_ram(remote,passphrase,restored)
        print("MISSION11_FRESH_SOURCE_ENCRYPTED_RESTORABLE_BACKUP_PASS "+json.dumps({
            "tables":report["tables"],"rows":report["rows"],
            "foreign_key_violations":report["fk_violations"],
            "storage_bucket_private":bucket,
            "ciphertext_bytes":len(raw),
            "ciphertext_sha256":digest,
            "r2_remote_ciphertext_verified":True,
            "isolated_restore_in_ram":True,
            "source_tables_nontransactional":True,
            "storage_binaries_included":False,
            "media_kept_in_separate_private_r2_staging_copy":True,
            "third_provider_independent_backup":False,
            "plaintext_uploaded":False,"customer_data_logged":False,
            "source_writes":0,"d1_writes":0,"dns_updates":0
        },sort_keys=True),flush=True)
        # Never print full private R2 object key or source rows into logs.
        # Object discovery: ListObjects prefix mission11-source-YYYY... in the
        # private, non-public bucket if authorized owner needs a download.
if __name__=="__main__":
    try:main()
    except BaseException as exc:
        print("MISSION11_PRIVATE_BACKUP_STOP category="+type(exc).__name__,file=sys.stderr)
        raise SystemExit(1)
