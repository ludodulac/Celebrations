#!/usr/bin/env python3
"""MISSION 03 — private snapshot backup with isolated recovery rehearsal.

Never write the live editor object, production MEDIA_BUCKET, D1, DNS or Worker.
Read the live EDITOR_BUCKET snapshot, encrypt it in RAM, write one immutable
PRIVATE R2 archive under a dedicated prefix, reread/decrypt it in RAM and
verify exact source bytes and structural validity. Do not export private data
to GitHub artifacts or logs. The encrypted archive requires the owner-held
passphrase in GitHub secrets to restore in the future.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
import re
import secrets
import sys
from urllib.parse import urlsplit

KEY = "editor-trials/server-drafts-v1.json"
PREFIX = "private-backups/mission03-editor/"
BUCKET = "celebrations-exit-staging"
MAGIC = b"CELEBRATIONS_M03_EDITOR_AES256GCM_V1\x00"
AAD = b"ludodulac/Celebrations:editor-trials/server-drafts-v1.json"
MIN_BYTES = 200
MAX_BYTES = 5_000_000


def validate_editor_snapshot(raw):
    if not isinstance(raw, (bytes, bytearray)) or not MIN_BYTES <= len(raw) <= MAX_BYTES:
        raise ValueError("Snapshot size outside the required range")
    state = json.loads(raw)
    if not isinstance(state, dict) or not isinstance(state.get("version"), int) or state["version"] < 1:
        raise ValueError("Invalid editor revision")
    if not isinstance(state.get("drafts"), dict) or not isinstance(state.get("shared"), dict):
        raise ValueError("Missing editor draft or shared structures")
    if not isinstance(state["shared"].get("pages"), list):
        raise ValueError("Missing shared page collection")
    if not isinstance(state.get("published"), dict):
        raise ValueError("Missing published snapshot")
    if not isinstance(state["published"].get("drafts"), dict):
        raise ValueError("Published celebrations missing")
    total_pages = 0
    published_pages = 0
    for label, records in (("drafts", state["drafts"]),
                            ("published", state["published"]["drafts"])):
        for key, record in records.items():
            if not isinstance(key, str) or not isinstance(record, dict):
                raise ValueError("Corrupt " + label + " record")
            pages = record.get("pages", [])
            if not isinstance(pages, list):
                raise ValueError("Pages must be arrays")
            seen = set()
            for page in pages:
                if not isinstance(page, dict) or not isinstance(page.get("id"), str):
                    raise ValueError("Page identity invalid")
                if page["id"] in seen:
                    raise ValueError("Duplicate page in " + label)
                seen.add(page["id"])
                if not isinstance(page.get("blocks", []), list):
                    raise ValueError("Invalid page block list")
            if label == "drafts":
                total_pages += len(pages)
            else:
                published_pages += len(pages)
    public_shared = state["published"].get("shared", {})
    if public_shared and not isinstance(public_shared.get("pages", []), list):
        raise ValueError("Invalid published general pages")
    if not state["drafts"] or total_pages < 1:
        raise ValueError("Empty user editor, abort")
    return state, {
        "revision": state["version"],
        "celebration_records": len(state["drafts"]),
        "draft_and_existing_page_count": total_pages,
        "published_celebration_pages": published_pages,
        "general_pages": len(state["shared"]["pages"]),
        "published_general_pages": len(public_shared.get("pages", [])) if public_shared else 0,
        "catalogue_items": len(state.get("mediaCatalogue", []))
            if isinstance(state.get("mediaCatalogue", []), list) else -1,
    }


def derive_key(passphrase, salt):
    return hashlib.scrypt(passphrase, salt=salt, n=2**14, r=8, p=1, dklen=32)


def encrypt(raw, passphrase):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    salt, nonce = secrets.token_bytes(16), secrets.token_bytes(12)
    cipher = AESGCM(derive_key(passphrase, salt)).encrypt(nonce, raw, AAD)
    return MAGIC + salt + nonce + cipher


def decrypt(package, passphrase):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    if not package.startswith(MAGIC) or len(package) <= len(MAGIC) + 16 + 12 + 16:
        raise ValueError("Unknown or truncated encrypted editor backup")
    off = len(MAGIC)
    salt, nonce = package[off:off+16], package[off+16:off+28]
    return AESGCM(derive_key(passphrase, salt)).decrypt(nonce, package[off+28:], AAD)


def private_s3():
    from botocore.config import Config
    import boto3
    env = os.environ
    if env.get("STAGING_R2_BUCKET") != BUCKET:
        raise ValueError("Refusing wrong storage bucket")
    endpoint = env["R2_ENDPOINT"].rstrip("/")
    parsed = urlsplit(endpoint)
    account = env["CLOUDFLARE_ACCOUNT_ID"]
    if (not re.fullmatch(r"[0-9a-f]{32}", account, re.I) or
        parsed.scheme != "https" or
        parsed.hostname != account + ".r2.cloudflarestorage.com" or
        parsed.path or parsed.query or parsed.fragment):
        raise ValueError("Unexpected R2 endpoint")
    return boto3.client(
        "s3", region_name="auto", endpoint_url=endpoint,
        aws_access_key_id=env["STAGING_R2_ACCESS_KEY_ID"],
        aws_secret_access_key=env["STAGING_R2_SECRET_ACCESS_KEY"],
        config=Config(retries={"max_attempts": 2, "mode": "standard"},
                      connect_timeout=10, read_timeout=30),
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", action="store_true",
                        help="Write a new encrypted backup key, never the live object")
    args = parser.parse_args()
    if args.archive and os.environ.get("M03_ALLOW_PRIVATE_ARCHIVE") != "yes":
        raise ValueError("Encrypted archive requires the mission's explicit environment guard")

    client = private_s3()
    original = client.get_object(Bucket=BUCKET, Key=KEY)
    source_etag = original["ETag"]
    raw = original["Body"].read(MAX_BYTES + 1)
    state, counts = validate_editor_snapshot(raw)
    original_digest = hashlib.sha256(raw).hexdigest()
    print("M03_LIVE_EDITOR_READONLY_PASS " + json.dumps({
        **counts, "source_sha256_prefix": original_digest[:16],
        "source_bytes": len(raw), "writes_to_live_object": 0,
    }, sort_keys=True))
    if not args.archive:
        print("M03_PREFLIGHT_ONLY_PASS writes=0")
        return

    passphrase = os.environ["CELEBRATIONS_BACKUP_PASSPHRASE"].encode("utf-8")
    if len(passphrase) < 32:
        raise ValueError("Private backup passphrase not configured or too short")
    encrypted = encrypt(raw, passphrase)
    # We always create a NEW, cryptographically random filename. Never replace
    # or delete an existing R2 backup. No plaintext leaves the runner.
    timestamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    name = PREFIX + timestamp + "-" + secrets.token_hex(12) + ".cbackup"
    client.put_object(
        Bucket=BUCKET, Key=name, Body=encrypted,
        ContentType="application/octet-stream",
        CacheControl="private, no-store",
        Metadata={"encrypted": "aes256gcm", "kind": "mission03-editor",
                  "schema": "v1"},
        IfNoneMatch="*",
    )
    downloaded = client.get_object(Bucket=BUCKET, Key=name)
    if downloaded.get("Metadata", {}).get("encrypted") != "aes256gcm":
        raise RuntimeError("Encrypted backup metadata missing")
    restored_package = downloaded["Body"].read(len(encrypted) + 1)
    if hashlib.sha256(restored_package).digest() != hashlib.sha256(encrypted).digest():
        raise RuntimeError("Encrypted backup checksum mismatch")
    # A genuine isolated recovery rehearsal: decrypt the exact bytes retrieved
    # from R2, parse every page and compare all fields against the source. Nothing
    # is copied over the currently published/draft object.
    restored = decrypt(restored_package, passphrase)
    if restored != raw or hashlib.sha256(restored).hexdigest() != original_digest:
        raise RuntimeError("Isolated recovery does not reproduce the source snapshot")
    again, same_counts = validate_editor_snapshot(restored)
    if again != state or same_counts != counts:
        raise RuntimeError("Isolated recovery structure changed")
    current = client.head_object(Bucket=BUCKET, Key=KEY)
    if current["ETag"] != source_etag:
        # New editor changes during our backup are not lost: the archive is
        # valid for the instant it was read, but not a latest-state guarantee.
        raise RuntimeError("Live editor changed during backup; archive is consistent but not current")
    print("M03_EDITOR_ENCRYPTED_BACKUP_AND_RAM_RESTORE_PASS " + json.dumps({
        "source_revision": counts["revision"],
        "encrypted_bytes": len(encrypted),
        "source_sha256_prefix": original_digest[:16],
        "encrypted_sha256_prefix": hashlib.sha256(encrypted).hexdigest()[:16],
        "immutable_random_backup_key": True,
        "r2_readback_verified": True,
        "isolated_restoration_exact_bytes": True,
        "live_snapshot_unchanged": True,
        "production_media_bucket_writes": 0, "cloudflare_d1_writes": 0,
        "dns_changes": 0, "plaintext_uploaded": 0,
        "external_independent_copy": False
    }, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # Never print URLs or secret-bearing remote exception text.
        print("M03_EDITOR_BACKUP_STOP category=" + type(exc).__name__,
              file=sys.stderr)
        sys.exit(1)
