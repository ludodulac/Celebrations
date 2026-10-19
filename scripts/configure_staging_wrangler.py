#!/usr/bin/env python3
"""Generate only the staging Worker bindings from explicitly supplied identifiers."""
import json
import os
import re
from pathlib import Path

database_id = os.environ["STAGING_D1_ID"]
bucket = os.environ["STAGING_R2_BUCKET"]
if not re.fullmatch(r"[0-9a-fA-F-]{36}", database_id):
    raise SystemExit("Invalid D1 database ID")
if bucket != "celebrations-exit-staging":
    raise SystemExit("Only the dedicated staging R2 bucket is allowed")
config = f'''name = "celebrations-exit-staging"
main = "staging-worker.mjs"
compatibility_date = "2026-10-13"
workers_dev = true
[assets]
directory = "../../staging-public"
binding = "ASSETS"
run_worker_first = ["/", "/index.html", "/admin.html"]
[[d1_databases]]
binding = "DB"
database_name = "celebrations-exit-staging"
database_id = {json.dumps(database_id)}
[[d1_databases]]
binding = "MEDIA_ACL"
database_name = "celebrations-exit-staging"
database_id = {json.dumps(database_id)}
[[r2_buckets]]
binding = "MEDIA_BUCKET"
bucket_name = {json.dumps(bucket)}
'''
Path("migration/cloudflare/wrangler.toml").write_text(config)
print("Staging-only Wrangler bindings prepared.")
