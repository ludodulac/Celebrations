#!/usr/bin/env python3
"""Generate an isolated, account-portable Wrangler config for Célébrations.

This tool does NOT deploy, create resources, or copy data. All identifiers
must be supplied by the destination association's Cloudflare account.
"""
import argparse
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "migration/cloudflare/wrangler.m018.official.toml"

def identifier(value, label):
    if not re.fullmatch(r"[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}", value):
        raise ValueError(f"{label}: expected a D1 UUID")
    return value

def resource(value, label):
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,62}[a-z0-9]", value):
        raise ValueError(f"{label}: invalid Cloudflare resource name")
    return value

def render(source, worker, database, database_id, bucket):
    text = source
    replacements = {
        'name = "celebrations-exit-production"': f'name = "{worker}"',
        'database_name = "celebrations-exit-production"': f'database_name = "{database}"',
        'database_id = "28736d2a-479b-472b-bf82-703ad0affe10"': f'database_id = "{database_id}"',
        'bucket_name = "celebrations-exit-production"': f'bucket_name = "{bucket}"',
    }
    expected = [1, 2, 2, 2]
    for (old, new), count in zip(replacements.items(), expected):
        if text.count(old) != count:
            raise ValueError(f"Unexpected Wrangler source: {old} count != {count}")
        text = text.replace(old, new)
    # A portable build must never accidentally enable a public workers.dev host.
    if text.count("workers_dev = true") != 1:\n        raise ValueError("Unexpected workers_dev source setting")\n    text = text.replace("workers_dev = true", "workers_dev = false")
    # The old account's official domain is not valid as an API host in a new account.
    if text.count('MEMBER_DIRECTORY_API_HOST = "ronde-des-archanges-universelle.eu"') != 1:\n        raise ValueError("Unexpected official host setting")\n    text = text.replace('MEMBER_DIRECTORY_API_HOST = "ronde-des-archanges-universelle.eu"',
                        'MEMBER_DIRECTORY_API_HOST = "__SET_OFFICIAL_HOST__"')
    return text

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--worker", required=True)
    p.add_argument("--database", required=True)
    p.add_argument("--database-id", required=True)
    p.add_argument("--bucket", required=True)
    p.add_argument("--official-host", required=True)
    p.add_argument("--output", required=True)
    args = p.parse_args()
    worker = resource(args.worker, "worker")
    database = resource(args.database, "database")
    bucket = resource(args.bucket, "bucket")
    dbid = identifier(args.database_id, "database-id")
    if not re.fullmatch(r"[a-zA-Z0-9.-]+", args.official_host) or "." not in args.official_host:
        p.error("official-host must be a hostname without scheme/path")
    target = Path(args.output).resolve()
    if target == SOURCE.resolve() or target.is_relative_to(ROOT / "migration/cloudflare") and target.name == "wrangler.m018.official.toml":
        p.error("refusing to overwrite the current official config")
    if target.exists():
        p.error("output already exists; refusing to overwrite")
    result = render(SOURCE.read_text(encoding="utf-8"), worker, database, dbid, bucket)
    result = result.replace("__SET_OFFICIAL_HOST__", args.official_host)
    if "celebrations-exit-staging" in result or "supabase.co" in result:
        p.error("legacy external resource detected")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(result, encoding="utf-8")
    print(f"Portable Wrangler config created: {target}; no deployment performed")

if __name__ == "__main__":
    main()
