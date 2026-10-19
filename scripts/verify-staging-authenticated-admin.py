#!/usr/bin/env python3
"""End-to-end staging ADMIN read-only UI test with a synthetic 5-minute session.

The *only* DB changes are insertion and guaranteed revocation of one synthetic
admin session in a verified, isolated staging D1 database. No production calls,
real participants, business records, or media objects are ever altered.
"""
import datetime
import hashlib
import json
import os
import re
import secrets
import subprocess
import requests

account = os.environ["CLOUDFLARE_ACCOUNT_ID"]
database = os.environ["STAGING_D1_ID"]
bucket = os.environ["STAGING_R2_BUCKET"]
assert re.fullmatch(r"[0-9a-fA-F]{32}", account), "Invalid Cloudflare account"
assert re.fullmatch(r"[0-9a-fA-F-]{36}", database), "Invalid staging database id"
assert bucket == "celebrations-exit-staging", "Refusing non-staging R2 bucket"
root = f"https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{database}"
headers = {"Authorization": "Bearer " + os.environ["CLOUDFLARE_API_TOKEN"]}
identity = requests.get(root, headers=headers, timeout=25).json()
assert identity.get("success") and identity.get("result", {}).get("name") == "celebrations-exit-staging", "Refusing non-staging D1"

def query(sql, params=()):
    response = requests.post(root + "/query", headers=headers, timeout=25,
                             json={"sql": sql, "params": list(params)}).json()
    if not response.get("success"):
        raise RuntimeError("Isolated D1 request failed (no credentials printed)")
    return response.get("result", [{}])[0].get("results", [])

token = secrets.token_hex(32)
digest = hashlib.sha256(token.encode()).hexdigest()
expiry = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=5)).isoformat()
inserted = False
try:
    query("INSERT INTO celebrations_admin_sessions(token_hash,admin_email,expires_at) VALUES(?,?,?)",
          (digest, "staging-readonly-check@invalid.example", expiry))
    inserted = True
    assert len(query("SELECT token_hash FROM celebrations_admin_sessions WHERE token_hash=?", (digest))) == 1
    safe_env = dict(os.environ)
    safe_env["STAGING_TEMP_ADMIN_BEARER"] = token
    print("STAGING_SYNTHETIC_ADMIN_SESSION_CREATED expires_in_minutes=5")
    subprocess.run(["node", "scripts/verify-staging-authenticated-admin.mjs"],
                   env=safe_env, timeout=105, check=True)
finally:
    if inserted:
        try:
            query("DELETE FROM celebrations_admin_sessions WHERE token_hash=?", (digest,))
            assert not query("SELECT token_hash FROM celebrations_admin_sessions WHERE token_hash=?", (digest,))
            print("STAGING_SYNTHETIC_ADMIN_SESSION_REVOKED success=true")
        except Exception as error:
            raise RuntimeError("CRITICAL: Staging synthetic admin session cleanup failed; five-minute TTL will expire") from error
