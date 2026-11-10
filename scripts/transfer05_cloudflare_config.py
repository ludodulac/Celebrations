#!/usr/bin/env python3
"""M05: Inspect or build a NEW-ACCOUNT-only Cloudflare Worker config OFFLINE.

This tool does not connect to Cloudflare, touch DNS, decrypt backups or deploy.
The generated config has NO domains, NO workers.dev, NO preview URLs and NO secrets.
"""
import argparse
import json
import pathlib
import re
import sys

SCHEMA = "celebrations-transfer-m05.v1"
OLD_D1 = "28736d2a-479b-472b-bf82-703ad0affe10"
OLD_WORKER = "celebrations-exit-production"
UUID = re.compile(r"[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12}\Z")
ACCOUNT = re.compile(r"[a-fA-F0-9]{32}\Z")
NAME = re.compile(r"[a-z][a-z0-9-]{2,62}\Z")
REQUIRED = (
    "backup_passphrase_outside_github", "fresh_consistent_backup_completed",
    "admin_secrets_available_for_target", "dns_and_email_records_exported",
    "rollback_and_domain_cutover_approved",
)
SRC_KEYS = {"account_id", "worker", "d1_id", "r2_historical", "r2_editor"}
DST_KEYS = {"account_id", "worker", "d1_id", "r2_historical", "r2_editor"}

def load(path):
    data = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    if set(data) != {"schema", "source", "target", "readiness"} or data["schema"] != SCHEMA:
        raise ValueError("Unrecognized transfer schema")
    src, dst, checks = data["source"], data["target"], data["readiness"]
    if not isinstance(src, dict) or set(src) != SRC_KEYS or not isinstance(dst, dict) or set(dst) != DST_KEYS:
        raise ValueError("Unexpected resource fields")
    if not isinstance(checks, dict) or set(checks) != set(REQUIRED) or not all(type(v) is bool for v in checks.values()):
        raise ValueError("Readiness checks must be booleans, not credentials")
    if (src["worker"] != OLD_WORKER or src["d1_id"] != OLD_D1 or
        src["r2_historical"] != OLD_WORKER or src["r2_editor"] != "celebrations-exit-staging"):
        raise ValueError("Unexpected current Cloudflare origin: refuse migration plan")
    for k in SRC_KEYS | DST_KEYS:
        if not isinstance(src.get(k), str) or not isinstance(dst.get(k), str):
            raise ValueError("Resource names and IDs must be strings")
    return data

def inspect(data):
    src, dst = data["source"], data["target"]
    missing = [k for k in ("source.account_id", "target.account_id", "target.d1_id")
               if not (src if k.startswith("source") else dst)[k.split(".")[1]]]
    unchecked = [k for k in REQUIRED if not data["readiness"][k]]
    return {"schema": SCHEMA, "resources": {"d1_bindings": ["DB", "MEDIA_ACL"],
      "r2_bindings": ["MEDIA_BUCKET", "EDITOR_BUCKET"], "asset_binding": "ASSETS"},
      "missing_account_configuration": missing,
      "owner_checklist_incomplete": unchecked,
      "ready_for_domain_cutover": not missing and not unchecked}

def validate_render(data):
    src, dst = data["source"], data["target"]
    if not ACCOUNT.fullmatch(src["account_id"]) or not ACCOUNT.fullmatch(dst["account_id"]):
        raise ValueError("Both Cloudflare account IDs must be 32 hexadecimal characters")
    if src["account_id"].lower() == dst["account_id"].lower():
        raise ValueError("Target Cloudflare account must differ from source account")
    if not UUID.fullmatch(dst["d1_id"]) or dst["d1_id"].lower() == OLD_D1:
        raise ValueError("Target D1 must be a distinct NEW UUID")
    for key in ("worker", "r2_historical", "r2_editor"):
        if not NAME.fullmatch(dst[key]):
            raise ValueError("Target resource name is invalid")
    if len({dst["worker"], dst["r2_historical"], dst["r2_editor"]}) != 3:
        raise ValueError("Target resources must have distinct names")
    if dst["worker"] == OLD_WORKER:
        raise ValueError("Do not prepare a transfer candidate with the active Worker name")
    # Existing Cloudflare account may continue to run, regardless of candidate.
    # These names deliberately have no worker routes or custom domains attached.
    return dst

def render(data):
    dst = validate_render(data)
    return (
      "# CÉLÉBRATIONS: NEW-ACCOUNT TRANSFER CANDIDATE ONLY; NOT A DEPLOY COMMAND.\n"
      "# No live domain, no previews, no workers.dev. Keep admin secrets separate.\n"
      f'name = "{dst["worker"]}"\n'
      'main = "production-worker.mjs"\n'
      'compatibility_date = "2026-10-16"\n'
      'workers_dev = false\n'
      'preview_urls = false\n\n'
      '[assets]\n'
      'directory = "../../production-public"\n'
      'binding = "ASSETS"\n'
      'run_worker_first = true\n\n'
      '[[d1_databases]]\n'
      'binding = "DB"\n'
      f'database_name = "{dst["worker"]}"\n'
      f'database_id = "{dst["d1_id"]}"\n\n'
      '[[d1_databases]]\n'
      'binding = "MEDIA_ACL"\n'
      f'database_name = "{dst["worker"]}"\n'
      f'database_id = "{dst["d1_id"]}"\n\n'
      '[[r2_buckets]]\n'
      'binding = "MEDIA_BUCKET"\n'
      f'bucket_name = "{dst["r2_historical"]}"\n\n'
      '[[r2_buckets]]\n'
      'binding = "EDITOR_BUCKET"\n'
      f'bucket_name = "{dst["r2_editor"]}"\n'
    )

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--config", default="docs/operations/TRANSFERT-CLOUDFLARE-EXEMPLE.json")
    ap.add_argument("--output", help="Write candidate Wrangler TOML to a NEW local file only")
    args = ap.parse_args()
    data = load(args.config)
    if args.output:
        output = pathlib.Path(args.output)
        if output.exists():
            raise ValueError("Refusing to replace an existing file")
        if output.suffix != ".toml":
            raise ValueError("Output must be a .toml file")
        config = render(data)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.open("x", encoding="utf-8").write(config)
        print("TRANSFER05_CANDIDATE_CONFIG_OFFLINE_CREATED no_deploy=1 no_domain=1")
    else:
        status = inspect(data)
        # Deliberately never log identifiers, object keys, secrets, or personal data.
        print("TRANSFER05_READINESS_INSPECTION " + json.dumps(status, sort_keys=True))
    print("TRANSFER05_NO_CLOUDFLARE_DNS_D1_R2_CHANGES")
if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, OSError, json.JSONDecodeError) as error:
        print("TRANSFER05_BLOCKED " + type(error).__name__, file=sys.stderr)
        sys.exit(1)
