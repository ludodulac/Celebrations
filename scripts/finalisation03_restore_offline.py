#!/usr/bin/env python3
"""Restore the sealed Célébrations M3 portable archive ONLY TO A NEW LOCAL FOLDER.

Never contact Cloudflare or Supabase, never deploy a Worker, never overwrite
a database or a directory. All source names are inside AES-GCM sealed manifest.
Run with CELEBRATIONS_BACKUP_PASSPHRASE in env (owner's GitHub backup secret).
"""
import argparse
import hashlib
import json
import os
import pathlib
import re
import sqlite3
import sys
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from mission03_editor_private_backup import derive_key
from finalisation03_portable_recovery import MAGIC
from mission20_d1_logical_backup import quote, restore_in_ram

def open_manifest(source, password):
    raw = (source/"manifest.cbackup").read_bytes()
    if not raw.startswith(MAGIC) or len(raw)<len(MAGIC)+16+12+16:
        raise ValueError("Not a portable recovery archive")
    index=len(MAGIC)
    salt,nonce=raw[index:index+16],raw[index+16:index+28]
    key=derive_key(password,salt)
    body=AESGCM(key).decrypt(nonce,raw[index+28:],MAGIC+b"manifest")
    data=json.loads(body)
    if data.get("schema")!="celebrations-portable-m03-v1":
        raise ValueError("Unknown manifest schema")
    if not isinstance(data.get("r2"),list) or not (120<=len(data["r2"])<=700):
        raise ValueError("Incorrect backup size")
    return key,data

def destination(root, origin):
    parts=origin.split("/")
    if not parts or any(p in ("",".","..") or "\\" in p or "\0" in p for p in parts):
        raise ValueError("Unsafe source path")
    if len(origin) > 1100 or origin.startswith("/"):
        raise ValueError("Unexpected object path")
    out=root.joinpath(*parts)
    if not out.resolve().is_relative_to(root.resolve()):
        raise ValueError("Path traversal")
    return out

def restore(source,target,password,check_d1=True):
    if target.exists():
        raise FileExistsError("Recovery destination must not exist")
    key,man=open_manifest(source,password)
    target.mkdir(parents=True)
    objects=man["r2"]
    restored=0
    for obj in objects:
        origin=obj["origin"]
        output=destination(target,origin)
        real=objects[obj["stored_index"]]
        if not isinstance(real.get("parts"),list):
            raise ValueError("Invalid stored index")
        output.parent.mkdir(parents=True,exist_ok=True)
        digest=hashlib.sha256()
        total=0
        with output.open("xb") as stream:
            for index,part in enumerate(real["parts"]):
                name=part["name"]
                if not (re.fullmatch(r"part-[0-9]{5}-[0-9]{4}" + re.escape(".enc"),name)):
                    raise ValueError("Malformed part reference")
                cipher=(source/name).read_bytes()
                if hashlib.sha256(cipher).hexdigest()!=part["sha"]:
                    raise ValueError("Encrypted source mismatch")
                block=AESGCM(key).decrypt(cipher[:12],cipher[12:],
                    MAGIC+real["origin"].encode()+b"/"+str(index).encode())
                if len(block)!=part["plain"]:
                    raise ValueError("Restored segment length mismatch")
                stream.write(block)
                digest.update(block)
                total+=len(block)
        if total!=obj["bytes"] or digest.hexdigest()!=obj["sha256"]:
            raise ValueError("Restored source checksum mismatch")
        restored+=1
    if check_d1:
        # Prove SQL data is structurally recoverable; this is not a live D1 import.
        d1=target/"production-d1-SELECT-logical-v1"
        logical=json.loads(d1.read_bytes())
        checks=restore_in_ram(logical)
        export=target/"recovered-production-d1.sqlite"
        db=sqlite3.connect(export)
        try:
            db.execute("PRAGMA foreign_keys=OFF")
            for o in logical["schema"]:
                if o["type"]=="table" and not o["name"].startswith("sqlite_"):
                    db.execute(o["sql"])
            for name,part in logical["tables"].items():
                names=part["columns"]
                statement=("INSERT INTO "+quote(name)+" ("+
                    ",".join(quote(x) for x in names)+") VALUES ("+
                    ",".join("?" for _ in names)+")")
                db.executemany(statement,part["values"])
            for kind in ("index","view","trigger"):
                for o in logical["schema"]:
                    if o["type"]==kind and not o["name"].startswith("sqlite_"):
                        db.execute(o["sql"])
            db.commit()
            if db.execute("PRAGMA integrity_check").fetchone()[0]!="ok":
                raise ValueError("Restored disk DB invalid")
            if db.execute("PRAGMA foreign_key_check").fetchall():
                raise ValueError("Restored disk DB keys invalid")
            for name,n in logical["counts"].items():
                if db.execute("SELECT COUNT(*) FROM "+quote(name)).fetchone()[0]!=n:
                    raise ValueError("Restored disk DB rows mismatch")
        finally:
            db.close()
        print("M03_LOCAL_D1_DISK_RESTORE_PASS "+json.dumps(checks,sort_keys=True))
    print("M03_LOCAL_COMPLETE_RESTORE_PASS "+json.dumps({
        "objects":restored,"originals_sha256_verified":restored,
        "live_writes":0,"cloud_calls":0,"plaintext_location":"local_destination_only"
    },sort_keys=True))
    return restored

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--archive-folder",required=True)
    ap.add_argument("--new-destination",required=True)
    args=ap.parse_args()
    phrase=os.environ.get("CELEBRATIONS_BACKUP_PASSPHRASE","").encode()
    if len(phrase)<32:raise ValueError("Backup passphrase missing")
    restore(pathlib.Path(args.archive_folder),pathlib.Path(args.new_destination),phrase)
if __name__=="__main__":
    try:main()
    except Exception as exc:
        print("M03_ISOLATED_RESTORE_STOP category="+type(exc).__name__,file=sys.stderr)
        sys.exit(1)
