#!/usr/bin/env python3
"""Private, isolated REAL encrypted-backup restore rehearsal.

Only reads the one previously verified ciphertext object in staging R2.
Restores 16 CÉLÉBRATIONS tables to local SQLite on /dev/shm (RAM filesystem).
Does not connect to Supabase, D1 or the public site; does not log row contents,
passwords, query arguments, SQL values or exceptions. Never upload test outputs.
"""
import io
import os
import pathlib
import re
import sqlite3
import tempfile
import zipfile
from urllib.parse import urlsplit

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from migration.encrypted_backup import (
    MAGIC, NONCE_SIZE, SALT_SIZE, REQUIRED_FILES, _key, _validate_plain_archive
)
from migration.import_relational_sqlite import import_relational
from migration.export_celebrations_readonly import TABLES

BUCKET = "celebrations-exit-staging"
PREFIX = "private-backups/source-20261020T183600Z-"
KEY_PATTERN = re.compile(r"private-backups/source-20261020T183600Z-[0-9a-f]{24}\.cbackup")
EXPECTED_CIPHERTEXT_BYTES = 380825


def restore_ciphertext_into_ram(ciphertext, passphrase, workspace):
    """Restore privately and prove exact table counts + FK/SQLite integrity."""
    raw = bytes(ciphertext)
    header_size = len(MAGIC) + SALT_SIZE + NONCE_SIZE
    if (len(raw) <= header_size + 16 or not raw.startswith(MAGIC)):
        raise ValueError("Invalid ciphertext framing")
    if len(passphrase) < 32:
        raise ValueError("Missing strong backup passphrase")
    start = len(MAGIC)
    salt = raw[start:start + SALT_SIZE]
    nonce = raw[start + SALT_SIZE:header_size]
    archive = AESGCM(_key(passphrase, salt)).decrypt(nonce, raw[header_size:], MAGIC)
    _validate_plain_archive(archive)

    workspace = pathlib.Path(workspace)
    export_dir = workspace / "source-export"
    export_dir.mkdir(mode=0o700)
    with zipfile.ZipFile(io.BytesIO(archive)) as z:
        if set(z.namelist()) != REQUIRED_FILES:
            raise ValueError("Unexpected archive member")
        for name in sorted(REQUIRED_FILES):
            # Name is exclusively from trusted constant set, not a ZIP path.
            path = export_dir / name
            flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
            if hasattr(os, "O_NOFOLLOW"):
                flags |= os.O_NOFOLLOW
            fd = os.open(path, flags, 0o600)
            with os.fdopen(fd, "wb") as stream:
                stream.write(z.read(name))

    target = workspace / "isolated-rehearsal.sqlite"
    report = import_relational(
        export_dir, target, "migration/cloudflare/celebrations-schema.sql"
    )
    if report["tables"] != 16 or report["foreign_key_violations"] != 0:
        raise ValueError("Unexpected relational import report")

    with sqlite3.connect(target) as db:
        if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise RuntimeError("SQLite integrity check failed")
        if db.execute("PRAGMA foreign_key_check").fetchall():
            raise RuntimeError("Foreign key check failed")
        table_rows = sum(
            db.execute('SELECT count(*) FROM "' + table + '"').fetchone()[0]
            for table in TABLES
        )
        if table_rows != report["rows"]:
            raise RuntimeError("Restored record counts diverged")
        if db.execute("SELECT count(*) FROM celebrations_celebrations").fetchone()[0] < 1:
            raise ValueError("Expected at least one celebration")
        if db.execute("SELECT count(*) FROM celebrations_contents").fetchone()[0] < 1:
            raise ValueError("Expected at least one media content record")
    return {"tables":16, "rows":report["rows"], "fk_violations":0}


def _get_encrypted_r2_backup():
    import boto3
    from botocore.config import Config

    account_id = os.environ["CLOUDFLARE_ACCOUNT_ID"]
    endpoint = os.environ["R2_ENDPOINT"].rstrip("/")
    parsed = urlsplit(endpoint)
    if (parsed.scheme != "https"
        or parsed.hostname != account_id + ".r2.cloudflarestorage.com"
        or parsed.path or parsed.query or parsed.fragment):
        raise ValueError("R2 endpoint mismatch")

    client = boto3.client(
        "s3", endpoint_url=endpoint, region_name="auto",
        aws_access_key_id=os.environ["STAGING_R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["STAGING_R2_SECRET_ACCESS_KEY"],
        config=Config(retries={"max_attempts":2, "mode":"standard"}),
    )
    inventory = client.list_objects_v2(Bucket=BUCKET, Prefix=PREFIX, MaxKeys=3)
    keys = [obj["Key"] for obj in inventory.get("Contents", [])]
    if len(keys) != 1 or not KEY_PATTERN.fullmatch(keys[0]):
        raise ValueError("Expected exactly one protected backup source object")
    if inventory["Contents"][0]["Size"] != EXPECTED_CIPHERTEXT_BYTES:
        raise ValueError("Encrypted archive byte size mismatch")

    response = client.get_object(Bucket=BUCKET, Key=keys[0])
    if response["ContentLength"] != EXPECTED_CIPHERTEXT_BYTES:
        raise ValueError("Encrypted archive GET length mismatch")
    if response.get("Metadata", {}).get("encrypted") != "aes256gcm":
        raise ValueError("Ciphertext metadata mismatch")
    ciphertext = response["Body"].read()
    if len(ciphertext) != EXPECTED_CIPHERTEXT_BYTES:
        raise ValueError("Short encrypted archive download")
    return ciphertext


def main():
    # GitHub-hosted Ubuntu runner provides /dev/shm as memory-only tmpfs. Fail
    # closed if unavailable: prevent transient plaintext on runner disk.
    if not pathlib.Path("/dev/shm").is_dir() or not os.path.ismount("/dev/shm"):
        raise RuntimeError("Private RAM filesystem is unavailable")
    if os.environ["STAGING_R2_BUCKET"] != BUCKET:
        raise ValueError("Refusing unapproved R2 bucket")
    password = os.environ["CELEBRATIONS_BACKUP_PASSPHRASE"].encode("utf-8")
    ciphertext = _get_encrypted_r2_backup()
    with tempfile.TemporaryDirectory(prefix="celebrations-rehearsal-", dir="/dev/shm") as scratch:
        result = restore_ciphertext_into_ram(ciphertext, password, scratch)
    # Aggregates only. No PII, no keys, no credentials, no file contents.
    print("RESTORE_REAL_BACKUP_RAM_ONLY_PASS "
          "tables=" + str(result["tables"]) +
          " rows=" + str(result["rows"]) +
          " foreign_key_violations=0 sqlite_integrity=ok "
          "source_writes=0 cloudflare_d1_reads=0 cloudflare_d1_writes=0 "
          "plaintext_uploaded=0")


if __name__ == "__main__":
    try:
        main()
    except BaseException as exc:
        # An SQLite/HTTP exception could contain private row values or URLs.
        # Suppress tracebacks and exception text in public GitHub Action logs.
        import sys
        print("RESTORE_REAL_BACKUP_RAM_ONLY_FAIL category=" + type(exc).__name__)
        sys.exit(1)
