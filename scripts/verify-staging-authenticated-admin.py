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
import uuid
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
        codes = [item.get("code") for item in response.get("errors", [])]
        raise RuntimeError("Isolated D1 write failed; Cloudflare error codes=" + repr(codes))
    return response.get("result", [{}])[0].get("results", [])

token = secrets.token_hex(32)
digest = hashlib.sha256(token.encode()).hexdigest()
expiry = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=5)).isoformat()
synthetic_email = "migration-check-" + str(uuid.uuid4()) + "@invalid.example"
synthetic_celebration_id = 8_000_000_000_000 + (uuid.uuid4().int % 1_000_000_000_000)
synthetic_content_id = "migration-check-" + str(uuid.uuid4())
synthetic_event_id = "migration-check-" + str(uuid.uuid4())
synthetic_step_key = "migration-check-" + str(uuid.uuid4())
inserted = False
verify_url = "https://celebrations-exit-staging.rondes.workers.dev/api/auth"
def valid_session():
    response = requests.post(verify_url, json={"action":"admin_session","admin_token":token},
                             timeout=25)
    return response.status_code == 200 and response.json().get("ok") is True
try:
    query("INSERT INTO celebrations_admin_sessions(token_hash,admin_email,expires_at) VALUES(?,?,?)",
          (digest, "staging-readonly-check@invalid.example", expiry))
    inserted = True
    assert valid_session(), "New staging admin session not recognized by Worker"
    safe_env = dict(os.environ)
    safe_env["STAGING_TEMP_ADMIN_BEARER"] = token
    print("STAGING_SYNTHETIC_ADMIN_SESSION_CREATED expires_in_minutes=5")
    subprocess.run(["node", "scripts/verify-staging-authenticated-admin.mjs"],
                   env=safe_env, timeout=105, check=True)
    if os.getenv("STAGING_SYNTHETIC_PARTICIPANT_WRITE") == "1":
        safe_env["STAGING_SYNTHETIC_PARTICIPANT_EMAIL"] = synthetic_email
        subprocess.run(["node", "scripts/verify-staging-participant-roundtrip.mjs"],
                       env=safe_env, timeout=85, check=True)
    if os.getenv("STAGING_SYNTHETIC_SAVE_WRITE") == "1":
        safe_env.update({
            "STAGING_SYNTHETIC_CELEBRATION_ID": str(synthetic_celebration_id),
            "STAGING_SYNTHETIC_CONTENT_ID": synthetic_content_id,
            "STAGING_SYNTHETIC_EVENT_ID": synthetic_event_id,
            "STAGING_SYNTHETIC_STEP_KEY": synthetic_step_key,
        })
        subprocess.run(["node", "scripts/verify-staging-safe-save-roundtrip.mjs"],
                       env=safe_env, timeout=85, check=True)
finally:
    if inserted:
        errors = []
        if os.getenv("STAGING_SYNTHETIC_SAVE_WRITE") == "1":
            # Failsafe cleanup by exact random staging identifiers, in strict FK order.
            # No bulk deletion, no media deletion and NO production database calls.
            cleanup = [
                ("DELETE FROM celebrations_links WHERE celebration_id=?", (synthetic_celebration_id,)),
                ("DELETE FROM celebrations_event_contents WHERE event_id=?", (synthetic_event_id,)),
                ("DELETE FROM celebrations_step_contents WHERE celebration_id=? AND step_key=?",
                 (synthetic_celebration_id, synthetic_step_key)),
                ("DELETE FROM celebrations_events WHERE id=?", (synthetic_event_id,)),
                ("DELETE FROM celebrations_steps WHERE celebration_id=? AND step_key=?",
                 (synthetic_celebration_id, synthetic_step_key)),
                ("DELETE FROM celebrations_contents WHERE id=?", (synthetic_content_id,)),
                ("DELETE FROM celebrations_celebrations WHERE id=?", (synthetic_celebration_id,)),
            ]
            for sql, params in cleanup:
                try:
                    query(sql, params)
                except Exception as error:
                    errors.append("programme cleanup " + type(error).__name__)
            if not errors:
                print("STAGING_SYNTHETIC_PROGRAM_CLEANUP success=true")
        if os.getenv("STAGING_SYNTHETIC_PARTICIPANT_WRITE") == "1":
            try:
                query("DELETE FROM celebrations_participant_sessions WHERE participant_email=?",
                      (synthetic_email,))
                query("DELETE FROM celebrations_participants WHERE email=?", (synthetic_email,))
                print("STAGING_SYNTHETIC_PARTICIPANT_FALLBACK_CLEANUP success=true")
            except Exception as error:
                errors.append("participant cleanup " + type(error).__name__)
        try:
            query("DELETE FROM celebrations_admin_sessions WHERE token_hash=?", (digest,))
            assert not valid_session(), "Revoked synthetic staging session still active"
            print("STAGING_SYNTHETIC_ADMIN_SESSION_REVOKED success=true")
        except Exception as error:
            errors.append("admin session cleanup " + type(error).__name__)
        if errors:
            raise RuntimeError("CRITICAL: Isolated staging synthetic cleanup incomplete: " + ", ".join(errors))
