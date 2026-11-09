#!/usr/bin/env python3
"""M20: bounded logical D1 backup using SELECT only; encrypted private R2 archive.

No Cloudflare D1 export/restore endpoint (which can interrupt database queries).
No production writes, no GitHub artifact, no public output of private records.
A series of SELECTs is not an atomic snapshot under concurrent writes.
"""
import datetime as dt
import hashlib
import json
import os
import re
import secrets
import sqlite3
import sys
import zlib

import requests
from mission03_editor_private_backup import derive_key, private_s3
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

D1_ID = "28736d2a-479b-472b-bf82-703ad0affe10"
R2_BUCKET = "celebrations-exit-staging"
PREFIX = "private-backups/mission20-d1/"
MAGIC = b"CELEBRATIONS_M20_D1_LOGICAL_AESGCM_V1\x00"
AAD = b"ludodulac/Celebrations:mission20:live-d1-logical-backup"
IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
PAGE_SIZE = 250
MAX_TABLES = 80
MAX_ROWS = 100000
MAX_PLAINTEXT_BYTES = 50_000_000


def quote(name):
    if not isinstance(name, str) or not IDENT.fullmatch(name):
        raise ValueError("Unsafe table/column identifier")
    return '"' + name + '"'


def require_scalar(value):
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    # Cloudflare D1 may encode BLOBs in arrays. Fail rather than silently
    # converting to a string or producing a lossy SQL restoration.
    raise ValueError("Non-scalar D1 value; lossless restoration not demonstrated")


class D1Reader:
    def __init__(self, session=None):
        account = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
        token = os.environ.get("CLOUDFLARE_API_TOKEN", "")
        assert re.fullmatch(r"[a-fA-F0-9]{32}", account) and len(token) > 10
        assert os.environ.get("PROD_D1_ID") == D1_ID
        self.endpoint = ("https://api.cloudflare.com/client/v4/accounts/" + account +
                         "/d1/database/" + D1_ID + "/query")
        self.session = session or requests.Session()
        self.session.headers.update({"Authorization": "Bearer " + token,
                                     "Content-Type": "application/json"})
        self.queries = 0

    def select(self, sql):
        if not isinstance(sql, str) or not sql.startswith("SELECT "):
            raise ValueError("M20 refuses non-SELECT SQL")
        r = self.session.post(self.endpoint, json={"sql": sql}, timeout=35)
        if r.status_code != 200:
            raise RuntimeError("D1_HTTP_STATUS_" + str(r.status_code))
        payload = r.json()
        if payload.get("success") is not True or len(payload.get("result") or []) != 1:
            raise RuntimeError("D1 SELECT response refused")
        item = payload["result"][0]
        if item.get("success") is not True or item.get("meta", {}).get("rows_written", 0) != 0:
            raise RuntimeError("D1 SELECT not proven read-only")
        result = item.get("results")
        if not isinstance(result, list):
            raise RuntimeError("D1 results invalid")
        self.queries += 1
        if self.queries > 900:
            raise RuntimeError("Bounded D1 query budget exceeded")
        return result


def table_count(reader, name):
    rows = reader.select("SELECT COUNT(*) AS n FROM " + quote(name))
    if len(rows) != 1 or not isinstance(rows[0].get("n"), int):
        raise ValueError("Missing table count")
    return rows[0]["n"]


def columns(reader, name):
    # PRAGMA is not used through the D1 write-enabled query endpoint.
    # The schema returned by sqlite_master is sufficient for the SQL replay.
    result = reader.select("SELECT name,type,pk FROM pragma_table_info('" + name + "')")
    return result


def capture(reader):
    raw = reader.select("SELECT type,name,tbl_name,sql FROM sqlite_master "
                        "WHERE sql IS NOT NULL ORDER BY type,name")
    print("M20_D1_SCHEMA_METADATA_FETCH_PASS objects=" + str(len(raw)))
    schema = []
    for obj in raw:
        if obj.get("type") not in ("table", "index", "view", "trigger"):
            raise ValueError("Unexpected schema object type")
        name = obj.get("name")
        if not IDENT.fullmatch(str(name or "")):
            raise ValueError("Unexpected schema object name")
        if not isinstance(obj.get("sql"), str) or len(obj["sql"]) > 200000:
            raise ValueError("Malformed schema SQL")
        schema.append({k: obj[k] for k in ("type", "name", "tbl_name", "sql")})
    tables = [x["name"] for x in schema if x["type"] == "table" and not x["name"].startswith("sqlite_")]
    print("M20_D1_TABLE_SCHEMA_PASS tables=" + str(len(tables)))
    if len(tables) < 10 or len(tables) > MAX_TABLES:
        raise ValueError("Unexpected D1 table inventory")
    all_data, initial_counts = {}, {}
    total_rows = 0
    for name in tables:
        count = table_count(reader, name)
        print("M20_D1_TABLE_START index=" + str(len(initial_counts) + 1) + " rows=" + str(count))
        total_rows += count
        if total_rows > MAX_ROWS:
            raise ValueError("Row count limit exceeded")
        fields = columns(reader, name)
        if not fields or any(not IDENT.fullmatch(str(f.get("name", ""))) for f in fields):
            raise ValueError("Table column metadata incomplete")
        # Refuse BLOBs; JSON D1 transport may not preserve exact bytes.
        if any("BLOB" in str(f.get("type", "")).upper() for f in fields):
            raise ValueError("D1 BLOB column requires dedicated byte-safe export")
        pk = [f["name"] for f in sorted(fields, key=lambda a: a.get("pk", 0))
              if int(f.get("pk") or 0) > 0]
        if "WITHOUT ROWID" in next(x["sql"] for x in schema if x["type"] == "table" and x["name"] == name).upper():
            if not pk:
                raise ValueError("WITHOUT ROWID table missing primary key")
            order = ", ".join(quote(n) for n in pk)
        else:
            order = "rowid"
        col_names = [x["name"] for x in fields]
        collected = []
        for offset in range(0, count, PAGE_SIZE):
            page = reader.select("SELECT * FROM " + quote(name) + " ORDER BY " +
                                 order + " LIMIT " + str(PAGE_SIZE) + " OFFSET " + str(offset))
            if len(page) != min(PAGE_SIZE, count - offset):
                raise ValueError("D1 table changed or page is incomplete")
            for row in page:
                if not isinstance(row, dict) or set(row) != set(col_names):
                    raise ValueError("Unexpected row fields")
                collected.append([require_scalar(row[c]) for c in col_names])
        if table_count(reader, name) != count:
            raise ValueError("D1 table changed during pagination")
        all_data[name] = {"columns": col_names, "values": collected}
        initial_counts[name] = count
    # Recheck ALL table sizes at the end; no transactional snapshot claim.
    if any(table_count(reader, name) != count for name, count in initial_counts.items()):
        raise ValueError("D1 table counts changed during backup")
    return {"format": "d1-logical-json-v1", "captured_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            "schema": schema, "tables": all_data, "counts": initial_counts,
            "total_rows": total_rows, "transactional_snapshot": False}


def restore_in_ram(data):
    db = sqlite3.connect(":memory:")
    try:
        db.execute("PRAGMA foreign_keys=OFF")
        # Create tables and load data before indexes and triggers.
        schema = data["schema"]
        for kind in ("table",):
            for obj in schema:
                if obj["type"] == kind and not obj["name"].startswith("sqlite_"):
                    db.execute(obj["sql"])
        for name, part in data["tables"].items():
            names = part["columns"]
            statement = ("INSERT INTO " + quote(name) + "(" +
                         ",".join(quote(x) for x in names) + ") VALUES (" +
                         ",".join("?" for _ in names) + ")")
            db.executemany(statement, part["values"])
        for kind in ("index", "view", "trigger"):
            for obj in schema:
                if obj["type"] == kind and not obj["name"].startswith("sqlite_"):
                    db.execute(obj["sql"])
        # Re-run row integrity and column round-trip in RAM, no plaintext disk.
        for name, part in data["tables"].items():
            if db.execute("SELECT COUNT(*) FROM " + quote(name)).fetchone()[0] != data["counts"][name]:
                raise ValueError("SQLite restore counts mismatch")
            readback = db.execute("SELECT " + ",".join(quote(c) for c in part["columns"]) +
                                  " FROM " + quote(name)).fetchall()
            if sorted(map(repr, readback)) != sorted(map(repr, map(tuple, part["values"]))):
                raise ValueError("SQLite restore row values mismatch")
        if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise ValueError("SQLite integrity error")
        violations = db.execute("PRAGMA foreign_key_check").fetchall()
        if violations:
            raise ValueError("SQLite foreign key violation")
        return {"tables": len(data["tables"]), "rows": data["total_rows"],
                "integrity": "ok", "foreign_key_violations": 0}
    finally:
        db.close()


def encrypt(raw, password):
    salt, nonce = secrets.token_bytes(16), secrets.token_bytes(12)
    ciphertext = AESGCM(derive_key(password, salt)).encrypt(nonce, zlib.compress(raw, 7), AAD)
    return MAGIC + salt + nonce + ciphertext


def decrypt(package, password):
    if not package.startswith(MAGIC) or len(package) < len(MAGIC) + 45:
        raise ValueError("Missing or truncated D1 backup")
    offset = len(MAGIC)
    salt, nonce = package[offset:offset+16], package[offset+16:offset+28]
    compressed = AESGCM(derive_key(password, salt)).decrypt(nonce, package[offset+28:], AAD)
    # Bound decompression output even for an unexpected/corrupted package.
    decompressor = zlib.decompressobj()
    result = decompressor.decompress(compressed, MAX_PLAINTEXT_BYTES + 1)
    if len(result) > MAX_PLAINTEXT_BYTES or not decompressor.eof:
        raise ValueError("D1 restore exceeds size limit")
    return result


def main():
    if os.environ.get("M20_ALLOW_ONE_PRIVATE_BACKUP") != "yes":
        raise ValueError("Explicit one-shot authorization missing")
    password = os.environ.get("CELEBRATIONS_BACKUP_PASSPHRASE", "").encode()
    if len(password) < 32:
        raise ValueError("Strong backup key missing")
    reader = D1Reader()
    data = capture(reader)
    check = restore_in_ram(data)
    raw = json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    if len(raw) > MAX_PLAINTEXT_BYTES:
        raise ValueError("Backup raw JSON too large")
    digest = hashlib.sha256(raw).hexdigest()
    package = encrypt(raw, password)
    s3 = private_s3()
    archive_key = PREFIX + dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + secrets.token_hex(12) + ".cbackup"
    s3.put_object(Bucket=R2_BUCKET, Key=archive_key, Body=package,
                  IfNoneMatch="*", ContentType="application/octet-stream",
                  CacheControl="private, no-store",
                  Metadata={"encrypted": "aes256gcm", "kind": "mission20-d1-logical"})
    stored = s3.get_object(Bucket=R2_BUCKET, Key=archive_key)
    readback = stored["Body"].read(len(package) + 1)
    if readback != package:
        raise RuntimeError("R2 encrypted readback does not match")
    rebuilt = decrypt(readback, password)
    if hashlib.sha256(rebuilt).hexdigest() != digest:
        raise RuntimeError("D1 restore digest mismatch")
    restored = restore_in_ram(json.loads(rebuilt))
    if restored != check:
        raise RuntimeError("D1 original and downloaded restore differ")
    print("M20_REAL_D1_LOGICAL_PRIVATE_BACKUP_PASS " + json.dumps({
        "tables": check["tables"], "rows": check["rows"],
        "integrity": "ok", "foreign_key_violations": 0,
        "d1_select_calls": reader.queries,
        "encrypted_bytes": len(package),
        "r2_private_readback": True,
        "isolated_ram_restoration": True,
        "source_rows_transactionally_frozen": False,
        "off_cloudflare_copy": False,
        "production_d1_writes": 0,
        "production_worker_writes": 0, "media_writes": 0,
        "plaintext_uploaded": 0,
    }, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # Deliberately omit the exception message (SQL, data or remote response).
        allowed = str(exc)
        if not (allowed.startswith("D1_HTTP_STATUS_") or allowed in (
            "D1 SELECT response refused", "D1 SELECT not proven read-only",
            "D1 results invalid", "Bounded D1 query budget exceeded",
            "Unexpected D1 table inventory", "Table column metadata incomplete",
            "D1 BLOB column requires dedicated byte-safe export")):
            allowed = "Unclassified"
        print("M20_D1_BACKUP_STOP category=" + type(exc).__name__ + " reason=" + allowed, file=sys.stderr)
        sys.exit(1)
