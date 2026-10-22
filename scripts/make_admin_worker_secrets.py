#!/usr/bin/env python3
"""Create transient Wrangler secret JSON from a GitHub environment secret.

Raw admin password only exists in Actions process memory. Neither the original
password, derived verifier nor salt are emitted to a log, artifact, repository,
API return, or ChatGPT. The transient file is removed by the shell trap.
"""
import hashlib
import json
import os
from pathlib import Path
import secrets
import sys

def main(destination):
    raw=os.environ.get("CELEBRATIONS_ADMIN_PASSWORD","")
    if len(raw)<14 or len(raw)>256 or raw.isspace():
        raise ValueError("A strong admin password in protected GitHub environment secret is required")
    if os.environ.get("GITHUB_REF")!="refs/heads/feat/celebrations-supabase-exit-001":
        raise ValueError("Refusing non-migration branch")
    path=Path(destination)
    if not path.is_file():
        raise ValueError("Expected an existing private temporary file")
    salt=secrets.token_hex(32)
    verifier=hashlib.pbkdf2_hmac("sha256",raw.encode("utf-8"),salt.encode("utf-8"),180000,dklen=32).hex()
    if len(verifier)!=64:
        raise ValueError("Unexpected derived verifier")
    path.write_text(json.dumps({
        "ADMIN_PASSWORD_SALT":salt,
        "ADMIN_PASSWORD_HASH":verifier
    }),encoding="utf-8")
    os.chmod(path,0o600)
    print("CELEBRATIONS_ADMIN_SECRETS_PREPARED two_values=2 "+
          "raw_password_logged=NO raw_password_saved_to_repo=NO " +
          "password_verifier_logged=NO")
if __name__=="__main__":
    try:main(sys.argv[1])
    except BaseException as error:
        print("CELEBRATIONS_ADMIN_SECRET_PREPARATION_STOP category="+type(error).__name__,
              file=sys.stderr)
        raise SystemExit(1)
