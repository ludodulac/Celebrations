#!/usr/bin/env python3
"""Finalisation M3 — immutable encrypted portable backup of ALL current R2 objects
(excluding redundant older private backup archives), current D1 logical SQL
contents and active Cloudflare Worker. No changes to originals or deployments.

Only ciphertext and a public, unidentifying header go into Github Actions artifact.
Every encrypted chunk and D1 is DECRYPTED and VERIFIED before artifact creation.
A Drive copy must separately be verified before claiming durable offsite recovery.

Never print source keys, private rows, URLs, decrypted content or secrets.
"""
import datetime as dt
import hashlib
import json
import os
import pathlib
import re
import secrets
import shutil
import sys
from urllib.parse import urlsplit

import boto3
import requests
from botocore.config import Config
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from mission03_editor_private_backup import derive_key, validate_editor_snapshot
from mission20_d1_logical_backup import D1Reader, capture, restore_in_ram

STAGING = "celebrations-exit-staging"
PRODUCTION = "celebrations-exit-production"
SCRIPT = "celebrations-exit-production"
EXPECTED_DEPLOYMENT = "cd46e1ba-e106-4f03-90aa-7110628a5b9f"
EXPECTED_VERSION = "dcda4193-1d82-4283-9f0e-ae8a09e6a444"
D1_ID = "28736d2a-479b-472b-bf82-703ad0affe10"
BRANCH = "refs/heads/release/celebrations-finalisation-03-backups-20261109"
MAGIC = b"CELEBRATIONS_FINALISATION_M03_V1\x00"
CHUNK = 16 * 1024 * 1024
MAX_OBJECTS = 700
MAX_TOTAL_BYTES = 2_100_000_000
MAX_SINGLE = 450_000_000


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def get_clients():
    e = os.environ
    account = e["CLOUDFLARE_ACCOUNT_ID"]
    endpoint = e["R2_ENDPOINT"].rstrip("/")
    parsed = urlsplit(endpoint)
    if not re.fullmatch("[a-fA-F0-9]{32}", account):
        raise ValueError("Invalid Cloudflare account")
    if parsed.scheme != "https" or parsed.hostname != account + ".r2.cloudflarestorage.com" or (
        parsed.path or parsed.query or parsed.fragment
    ):
        raise ValueError("Invalid Cloudflare R2 endpoint")
    if e["STAGING_R2_BUCKET"] != STAGING or e["PROD_R2_BUCKET"] != PRODUCTION:
        raise ValueError("Wrong bucket")
    if e["PROD_D1_ID"] != D1_ID or not e.get("CLOUDFLARE_API_TOKEN"):
        raise ValueError("Wrong DB")
    cfg = Config(retries={"max_attempts": 2, "mode": "standard"}, connect_timeout=15, read_timeout=90)
    result = {}
    for label, access, secret in [
        (STAGING, "STAGING_R2_ACCESS_KEY_ID", "STAGING_R2_SECRET_ACCESS_KEY"),
        (PRODUCTION, "CELEBRATIONS_PROD_R2_ACCESS_KEY_ID", "CELEBRATIONS_PROD_R2_SECRET_ACCESS_KEY"),
    ]:
        result[label] = boto3.client("s3", endpoint_url=endpoint, region_name="auto",
            aws_access_key_id=e[access], aws_secret_access_key=e[secret], config=cfg)
    if e["STAGING_R2_ACCESS_KEY_ID"] == e["CELEBRATIONS_PROD_R2_ACCESS_KEY_ID"]:
        raise ValueError("R2 scopes not separate")
    return result


def inventory(client, bucket):
    objs = []
    for page in client.get_paginator("list_objects_v2").paginate(Bucket=bucket):
        for x in page.get("Contents", []):
            if x["Key"].startswith("private-backups/"):
                continue  # redundant previous encrypted archives; fresh D1/editor captured below
            if not isinstance(x.get("Size"), int) or not 0 <= x["Size"] <= MAX_SINGLE:
                raise ValueError("Unexpected object size")
            objs.append({"key": x["Key"], "size": x["Size"], "etag": x.get("ETag"),
                         "modified": x["LastModified"].isoformat()})
            if len(objs) > MAX_OBJECTS:
                raise ValueError("Too many R2 objects")
    if len({x["key"] for x in objs}) != len(objs):
        raise ValueError("Duplicate source keys")
    return sorted(objs, key=lambda x: x["key"])


def cloudflare_observe():
    e = os.environ
    base = ("https://api.cloudflare.com/client/v4/accounts/" + e["CLOUDFLARE_ACCOUNT_ID"] +
            "/workers/scripts/" + SCRIPT)
    headers = {"Authorization": "Bearer " + e["CLOUDFLARE_API_TOKEN"],
               "Accept": "application/json"}
    def get(path, cap=20_000_000):
        r = requests.get(base + path, headers=headers, timeout=45)
        if r.status_code != 200 or len(r.content) > cap:
            raise RuntimeError("Worker read API unavailable")
        return r
    deployments = get("/deployments").json()
    if not deployments.get("success") or not deployments.get("result", {}).get("deployments"):
        raise ValueError("Worker deployment details invalid")
    current = deployments["result"]["deployments"][0]
    if current.get("id") != EXPECTED_DEPLOYMENT or current["versions"][0]["version_id"] != EXPECTED_VERSION:
        raise ValueError("Live Worker version drift")
    # Read exact active script multipart and version settings from Cloudflare.
    raw = get("", 50_000_000).content
    version_json = get("/versions/" + EXPECTED_VERSION, 10_000_000).content
    settings_json = get("/script-settings", 10_000_000).content
    if len(raw) < 100 or not raw:
        raise ValueError("Worker script not recoverable")
    return raw, version_json, settings_json


class Portable:
    def __init__(self, folder, phrase=None, salt=None):
        self.path = pathlib.Path(folder)
        self.path.mkdir(parents=True, exist_ok=True)
        self.salt = salt if salt is not None else secrets.token_bytes(16)
        password = phrase if phrase is not None else os.environ["CELEBRATIONS_BACKUP_PASSPHRASE"].encode()
        if len(password) < 32:
            raise ValueError("Strong recovery passphrase required")
        self.key = derive_key(password, self.salt)
        self.nonce_seen = set()
        self.parts = []
        self.objects = []
        self.stored_hashes = {}
        self.plain_bytes = 0
        self.cipher_bytes = 0

    def store(self, source_id, chunks, expected_bytes=None):
        idx = len(self.objects)
        provisional = []
        plain_len = 0
        h = hashlib.sha256()
        pending = bytearray()
        def write_part(block):
            name = "part-%05d-%04d.enc" % (idx, len(provisional))
            nonce = secrets.token_bytes(12)
            if nonce in self.nonce_seen: raise ValueError("Nonce reused")
            self.nonce_seen.add(nonce)
            aad = MAGIC + source_id.encode() + b"/" + str(len(provisional)).encode()
            ciphertext = nonce + AESGCM(self.key).encrypt(nonce, bytes(block), aad)
            destination = self.path / name
            destination.write_bytes(ciphertext)
            provisional.append({"name": name, "plain": len(block),
                                "cipher": len(ciphertext), "sha": digest(ciphertext)})
            self.cipher_bytes += len(ciphertext)

        for raw in chunks:
            if not isinstance(raw, (bytes, bytearray)):
                raise ValueError("Non-byte content")
            if not raw: continue
            plain_len += len(raw)
            if plain_len > MAX_SINGLE: raise ValueError("Source object exceeds limit")
            h.update(raw)
            pending.extend(raw)
            while len(pending) >= CHUNK:
                write_part(pending[:CHUNK])
                del pending[:CHUNK]
        if pending or not provisional:
            write_part(pending)
        if expected_bytes is not None and plain_len != expected_bytes:
            raise ValueError("Wrong source size")
        sha = h.hexdigest()
        existing = self.stored_hashes.get((sha, plain_len))
        if existing is not None:
            # This is genuine content de-duplication, not filename/size guessing.
            for x in provisional:
                (self.path / x["name"]).unlink()
                self.cipher_bytes -= x["cipher"]
            stored_index = existing
            provisional = []
        else:
            stored_index = idx
            self.stored_hashes[(sha, plain_len)] = idx
        self.plain_bytes += plain_len
        self.objects.append({"origin": source_id, "bytes": plain_len,
                             "sha256": sha, "stored_index": stored_index,
                             "parts": provisional})
        return sha

    def store_bytes(self, name, raw):
        return self.store(name, [raw], len(raw))

    def finalize(self):
        contents = {"schema": "celebrations-portable-m03-v1",
                    "captured_at": dt.datetime.now(dt.timezone.utc).isoformat(),
                    "source_commit": os.environ.get("GITHUB_SHA", "offline-test"),
                    "r2": self.objects, "chunks": self.cipher_bytes,
                    "legacy_archive_objects_excluded": "private-backups/*",
                    "observed_deployment": EXPECTED_DEPLOYMENT,
                    "observed_worker_version": EXPECTED_VERSION,
                    "transactional_d1": False,
                    "github_actions_file_retention_is_temporary": True}
        raw = json.dumps(contents, ensure_ascii=False, separators=(",", ":")).encode()
        nonce = secrets.token_bytes(12)
        enc = MAGIC + self.salt + nonce + AESGCM(self.key).encrypt(nonce, raw, MAGIC+b"manifest")
        (self.path / "manifest.cbackup").write_bytes(enc)
        return contents

    def restore_verify(self):
        enc = (self.path / "manifest.cbackup").read_bytes()
        if not enc.startswith(MAGIC) or enc[len(MAGIC):len(MAGIC)+16] != self.salt:
            raise ValueError("Wrong manifest header")
        at = len(MAGIC)+16
        raw = AESGCM(self.key).decrypt(enc[at:at+12], enc[at+12:], MAGIC+b"manifest")
        contents = json.loads(raw)
        verified = set()
        for entry in contents["r2"]:
            real = contents["r2"][entry["stored_index"]]
            key = real["origin"].encode()
            h = hashlib.sha256()
            total = 0
            for i, part in enumerate(real["parts"]):
                rawpart = (self.path / part["name"]).read_bytes()
                if digest(rawpart) != part["sha"]:
                    raise ValueError("Encrypted chunk corrupted")
                nonce, cipher = rawpart[:12], rawpart[12:]
                decoded = AESGCM(self.key).decrypt(nonce, cipher,
                    MAGIC+key+b"/"+str(i).encode())
                if len(decoded) != part["plain"]:
                    raise ValueError("Wrong restored chunk size")
                h.update(decoded)
                total += len(decoded)
            if total != entry["bytes"] or h.hexdigest() != entry["sha256"]:
                raise ValueError("Restored object changed")
            verified.add(entry["origin"])
        return {"originals_verified": len(contents["r2"]),
                "distinct_contents_verified": len(self.stored_hashes),
                "chunk_cipher_bytes": self.cipher_bytes,
                "source_bytes": self.plain_bytes,
                "all_sha256_equal": True}

def iter_s3(body):
    while True:
        data = body.read(CHUNK)
        if not data:
            break
        yield data

def main():
    if os.environ.get("GITHUB_REF") != BRANCH or os.environ.get("M03_ALLOW_ONE_PORTABLE_BACKUP") != "yes":
        raise ValueError("One-shot backup branch guard missing")
    folder = pathlib.Path(os.environ["BACKUP_ARTIFACT_FOLDER"])
    if folder.exists():
        raise ValueError("Refuse overwrite of portable archive")
    clients = get_clients()
    all_objects = {bucket: inventory(c, bucket) for bucket,c in clients.items()}
    if len(all_objects[PRODUCTION]) < 120 or len(all_objects[STAGING]) < 150:
        raise ValueError("Unexpected R2 inventory")
    if sum(o["size"] for a in all_objects.values() for o in a) > MAX_TOTAL_BYTES:
        raise ValueError("Unexpected overall source size")
    phrase = os.environ["CELEBRATIONS_BACKUP_PASSPHRASE"].encode()
    p = Portable(folder, phrase)
    for bucket in [PRODUCTION, STAGING]:
        for number, entry in enumerate(all_objects[bucket], 1):
            obj = clients[bucket].get_object(Bucket=bucket, Key=entry["key"])
            if obj["ETag"] != entry["etag"]:
                raise ValueError("Source changed after inventory")
            try:
                p.store(bucket + "/" + entry["key"], iter_s3(obj["Body"]), entry["size"])
            finally:
                obj["Body"].close()
            after = clients[bucket].head_object(Bucket=bucket, Key=entry["key"])
            if after["ETag"] != entry["etag"]:
                raise ValueError("Source object changed mid-backup")
            if number % 25 == 0:
                print("M03_R2_PROGRESS " + json.dumps({"bucket":bucket,
                      "objects_processed":number, "total":len(all_objects[bucket])}),flush=True)
        print("M03_R2_COMPLETE " + json.dumps({"bucket":bucket,
            "object_count":len(all_objects[bucket]),
            "plain_bytes":sum(o["size"] for o in all_objects[bucket])}),flush=True)
    # Fresh editor snapshot has been read and is included among staging objects.
    draft = next(o for o in all_objects[STAGING]
                 if o["key"] == "editor-trials/server-drafts-v1.json")
    # Read one more time to validate current snapshot structure and version.
    original = clients[STAGING].get_object(Bucket=STAGING,Key=draft["key"])
    raw = original["Body"].read(5_000_001)
    _, editor_counts = validate_editor_snapshot(raw)
    if digest(raw) != next(o["sha256"] for o in p.objects if o["origin"] ==
                           STAGING + "/" + draft["key"]):
        raise ValueError("Editor snapshot changed while capturing")
    print("M03_EDITOR_CURRENT_PASS "+json.dumps(editor_counts,sort_keys=True),flush=True)

    reader = D1Reader()
    current = capture(reader)
    recovered = restore_in_ram(current)
    raw_d1 = json.dumps(current, ensure_ascii=False, sort_keys=True,
                        separators=(",",":")).encode()
    p.store_bytes("production-d1-SELECT-logical-v1", raw_d1)
    print("M03_D1_ISOLATED_RAM_PASS "+json.dumps({
        **recovered, "queries":reader.queries, "transactional":False}),flush=True)

    worker_raw, version_raw, settings_raw = cloudflare_observe()
    p.store_bytes("production-worker-script-actual-multipart",worker_raw)
    p.store_bytes("production-worker-version-metadata",version_raw)
    p.store_bytes("production-worker-settings-metadata",settings_raw)

    contents = p.finalize()
    proof = p.restore_verify()
    # Restore the D1 logical backup after AESGCM decryption; source untouched.
    restored_d1 = next(e for e in contents["r2"]
                       if e["origin"]=="production-d1-SELECT-logical-v1")
    plaintext = bytearray()
    for n,part in enumerate(restored_d1["parts"]):
        blob=(folder/part["name"]).read_bytes()
        plaintext.extend(AESGCM(p.key).decrypt(blob[:12],blob[12:],
            MAGIC+restored_d1["origin"].encode()+b"/"+str(n).encode()))
    if restore_in_ram(json.loads(bytes(plaintext))) != recovered:
        raise ValueError("Encrypted D1 restore failed")
    if len(plaintext) != len(raw_d1):
        raise ValueError("D1 roundtrip bytes changed")
    print("M03_PORTABLE_ENCRYPTED_BUNDLE_VERIFY_PASS "+json.dumps({
        **proof,
        "r2_staging_objects":len(all_objects[STAGING]),
        "r2_production_objects":len(all_objects[PRODUCTION]),
        "editor_revision":editor_counts["revision"],
        "d1_tables":recovered["tables"],"d1_rows":recovered["rows"],
        "worker_exact_raw_script":True,
        "worker_version_metadata":True,
        "worker_settings_metadata":True,
        "worker_deployment_verified":True,
        "off_cloudflare_stored":False,
        "d1_writes":0,"r2_writes":0,"worker_writes":0,
        "plaintext_artifacts":0,
    },sort_keys=True),flush=True)

if __name__ == "__main__":
    try:main()
    except Exception as exc:
        # Never emit remote exception messages, paths or private content.
        print("M03_PORTABLE_BACKUP_STOP category="+type(exc).__name__,file=sys.stderr)
        sys.exit(1)
