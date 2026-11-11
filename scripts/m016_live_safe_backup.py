#!/usr/bin/env python3
"""M016: live production read-only encrypted recovery, on a dedicated feature branch.

Uses the existing M03 full R2/D1/Worker portable backup and local SHA256 /
AES-GCM restoration machinery. Only the currently observed official Worker
deployment ID is discovered; its version MUST match the independently pinned
version from the preceding real Cloudflare preproduction audit.

No writes to either source R2 bucket, D1, Workers, DNS, or main.
Only encrypted backup files may be published to private GitHub Actions artifacts.
"""
import os
import sys
import requests

import finalisation03_portable_recovery as backup

BRANCH = "refs/heads/feat/celebrations-m016-online-service-safe-backup-20261111"
WORKER = "celebrations-exit-production"
PINNED_OFFICIAL_VERSION = "87dba010-c719-4a52-97c1-027a9c9de9b6"
ACCOUNT = "60a7b17758a93fe6681ce998e72ddff0"

def main():
    e = os.environ
    if e.get("GITHUB_REF") != BRANCH or e.get("M016_BACKUP_ONLY") != "yes":
        raise RuntimeError("Explicit isolated branch/job guard missing")
    if e.get("CLOUDFLARE_ACCOUNT_ID") != ACCOUNT:
        raise RuntimeError("Cloudflare account mismatch")
    if e.get("PROD_D1_ID") != backup.D1_ID or e.get("STAGING_R2_BUCKET") != backup.STAGING or e.get("PROD_R2_BUCKET") != backup.PRODUCTION:
        raise RuntimeError("Source scope mismatch")
    if not e.get("CLOUDFLARE_API_TOKEN") or len(e.get("CELEBRATIONS_BACKUP_PASSPHRASE", "")) < 32:
        raise RuntimeError("Protected credentials missing")
    endpoint = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/workers/scripts/{WORKER}/deployments"
    resp = requests.get(endpoint, headers={"Authorization": "Bearer " + e["CLOUDFLARE_API_TOKEN"]},
                        timeout=30)
    if resp.status_code != 200:
        raise RuntimeError("Cannot verify live official Worker")
    payload = resp.json()
    deployments = (payload.get("result") or {}).get("deployments") or []
    if payload.get("success") is not True or len(deployments) < 1:
        raise RuntimeError("Official deployment history unavailable")
    latest = deployments[0]
    versions = latest.get("versions") or []
    if len(versions) != 1 or versions[0].get("version_id") != PINNED_OFFICIAL_VERSION or versions[0].get("percentage") != 100:
        raise RuntimeError("Official Worker changed after M015: stop before export")
    if not isinstance(latest.get("id"), str) or len(latest["id"]) < 30:
        raise RuntimeError("Unverifiable deployment id")

    print("M016_OFFICIAL_WORKER_VERSION_PIN_PASS", flush=True)
    # Diagnose backup prerequisites without exposing secrets or private paths.
    clients = backup.get_clients()
    print("M016_STORAGE_CLIENT_SCOPE_PASS", flush=True)
    for label in (backup.STAGING, backup.PRODUCTION):
        items = backup.inventory(clients[label], label)
        print("M016_BUCKET_INVENTORY_PASS bucket=" + label + " objects=" + str(len(items)), flush=True)

    # Reuse exactly the pre-existing and tested encrypted export/recovery code.
    backup.BRANCH = BRANCH
    backup.EXPECTED_DEPLOYMENT = latest["id"]
    backup.EXPECTED_VERSION = PINNED_OFFICIAL_VERSION
    backup.main()

    final = requests.get(endpoint, headers={"Authorization": "Bearer " + e["CLOUDFLARE_API_TOKEN"]},
                         timeout=30)
    if final.status_code != 200 or not final.json().get("success"):
        raise RuntimeError("Cannot prove official Worker unchanged after backup")
    current = final.json()["result"]["deployments"][0]
    if current.get("id") != latest["id"] or current.get("versions") != versions:
        raise RuntimeError("Official Worker changed during backup")
    print("M016_OFFICIAL_VERSION_UNCHANGED_AFTER_BACKUP reads_only=true", flush=True)

if __name__ == "__main__":
    try:
        main()
    except BaseException as error:
        print("M016_SAFE_BACKUP_STOP category=" + type(error).__name__, file=sys.stderr)
        sys.exit(1)
