#!/usr/bin/env python3
"""Create and verify an encrypted LOCAL archive of all 16 Célébrations tables.

Source reads only, no source/Cloudflare mutations. Never publish or attach the
unencrypted export. Password comes from a local prompt or environment secret,
never from a command-line argument or GitHub workflow input.

IMPORTANT: REST paging is not a transaction-wide PostgreSQL snapshot.
Use an approved write-freeze before treating an archive as final-cutover data.
The archive covers tables ONLY, not Supabase Storage media or project settings.
"""
import argparse
import getpass
import hashlib
import io
import json
import os
import pathlib
import tempfile
import zipfile
from urllib.parse import urlsplit

import requests
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

try:
    from migration.export_celebrations_readonly import TABLES, export
except ModuleNotFoundError:
    from export_celebrations_readonly import TABLES, export

MAGIC = b"CELEBRATIONS-DB-AESGCM-V1\x00"
SALT_SIZE, NONCE_SIZE = 16, 12
REQUIRED_FILES = {name + ".json" for name in TABLES} | {"manifest.json"}


def _passphrase():
    password = os.environ.get("CELEBRATIONS_BACKUP_PASSPHRASE")
    if password is None:
        password = getpass.getpass("Mot de passe de sauvegarde (32+ caractères aléatoires) : ")
    if len(password) < 32:
        raise ValueError("Use a unique random passphrase with at least 32 characters")
    return password.encode("utf-8")


def _key(passphrase, salt):
    return hashlib.scrypt(passphrase, salt=salt, n=2**15, r=8, p=1,
                          dklen=32, maxmem=128 * 1024 * 1024)


def _validate_plain_archive(archive):
    with zipfile.ZipFile(io.BytesIO(archive)) as z:
        if set(z.namelist()) != REQUIRED_FILES:
            raise ValueError("Unexpected or missing archive members")
        manifest = json.loads(z.read("manifest.json"))
        if manifest.get("complete") is not True or set(manifest.get("tables", {})) != set(TABLES):
            raise ValueError("Incomplete backup manifest")
        for table in TABLES:
            raw = z.read(table + ".json")
            meta = manifest["tables"][table]
            if hashlib.sha256(raw).hexdigest() != meta.get("sha256"):
                raise ValueError("Backup table checksum mismatch")
            rows = json.loads(raw)
            if not isinstance(rows, list) or len(rows) != meta.get("rows"):
                raise ValueError("Backup table row count mismatch")
        return len(TABLES)


def encrypt_export(export_dir, destination, passphrase):
    """Encrypt a complete 16-table export to a NEW owner-only local file."""
    folder = pathlib.Path(export_dir)
    destination = pathlib.Path(destination)
    mem = io.BytesIO()
    with zipfile.ZipFile(mem, "w", compression=zipfile.ZIP_DEFLATED,
                         compresslevel=6) as z:
        for filename in sorted(REQUIRED_FILES):
            source = folder / filename
            if not source.is_file() or source.is_symlink():
                raise ValueError("Missing or unsafe export file")
            z.write(source, arcname=filename)
    archive = mem.getvalue()
    _validate_plain_archive(archive)
    salt, nonce = os.urandom(SALT_SIZE), os.urandom(NONCE_SIZE)
    ciphertext = AESGCM(_key(passphrase, salt)).encrypt(nonce, archive, MAGIC)
    if destination.is_symlink():
        raise ValueError("Refusing symlink destination")
    # O_EXCL refuses overwriting an existing backup, even after a failed run.
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    fd = os.open(destination, flags, 0o600)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(MAGIC + salt + nonce + ciphertext)
            f.flush()
            os.fsync(f.fileno())
        if verify_encrypted_file(destination, passphrase) != len(TABLES):
            raise ValueError("Encrypted backup verification failed")
    except BaseException:
        destination.unlink(missing_ok=True)
        raise
    return destination


def verify_encrypted_file(path, passphrase):
    """Decrypt in memory. Verify every table/hash without writing plaintext."""
    raw = pathlib.Path(path).read_bytes()
    header_size = len(MAGIC) + SALT_SIZE + NONCE_SIZE
    if len(raw) <= header_size + 16 or not raw.startswith(MAGIC):
        raise ValueError("Invalid encrypted backup header")
    start = len(MAGIC)
    salt = raw[start:start + SALT_SIZE]
    nonce = raw[start + SALT_SIZE:header_size]
    archive = AESGCM(_key(passphrase, salt)).decrypt(nonce, raw[header_size:], MAGIC)
    return _validate_plain_archive(archive)


def create_from_source(destination, passphrase):
    """Import source over GET and encrypt in an ephemeral permission-limited dir."""
    base = os.environ["SUPABASE_URL"].rstrip("/")
    parsed = urlsplit(base)
    if parsed.scheme != "https" or parsed.hostname != "jwyayfkssyagvnablttg.supabase.co" or parsed.path:
        raise ValueError("Refusing unexpected Supabase source project")
    token = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    session = requests.Session()
    session.headers.update({"apikey": token, "Authorization": "Bearer " + token})
    # Generated plaintext exists only inside a disposable private temporary dir.
    # This reduces exposure, but does NOT promise secure disk erasure.
    with tempfile.TemporaryDirectory(prefix="celebrations-private-") as work:
        private = pathlib.Path(work) / "export"
        export(session, base, private)
        return encrypt_export(private, destination, passphrase)


def main():
    parser = argparse.ArgumentParser(description="Encrypted read-only Célébrations backup")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--output", type=pathlib.Path, help="Create a new local encrypted backup")
    group.add_argument("--verify", type=pathlib.Path, help="Verify an existing encrypted backup offline")
    args = parser.parse_args()
    password = _passphrase()
    if args.output:
        create_from_source(args.output, password)
        print("BACKUP_ENCRYPTED_AND_VERIFIED tables=16 source_writes=0 storage_objects_included=0 transactional_snapshot=NO")
    else:
        n = verify_encrypted_file(args.verify, password)
        print("BACKUP_OFFLINE_CHECK_OK tables=" + str(n) + " plaintext_written=0")


if __name__ == "__main__":
    main()
