#!/usr/bin/env python3
"""Build isolated *editable* Cloudflare QA Worker config. Never touch live host.

Read-only source; this Worker is intentionally distinct from historic
'celebrations', the current public domain, and preview Worker. Its DB/R2
bindings point to already-imported isolated production resources so the
admin login can be verified against actual migrated accounts and history.
"""
import os
import pathlib
import re
import sys

TARGET="celebrations-exit-editable-qa"
DB_NAME="celebrations-exit-production"
DB_ID="28736d2a-479b-472b-bf82-703ad0affe10"
def main():
    db=os.environ["PROD_D1_ID"]
    staging=os.environ["STAGING_D1_ID"]
    if (db!=DB_ID or db==staging or
        not re.fullmatch(r"[a-f0-9-]{36}",staging) or
        os.environ["STAGING_R2_BUCKET"]!="celebrations-exit-staging"):
        raise ValueError("Worker bindings not safe and isolated")
    destination=pathlib.Path("migration/cloudflare/wrangler.editable-qa.toml")
    if destination.exists():
        raise ValueError("Refusing unexpected existing config")
    destination.write_text(f'''# Separate temporary QA Worker ONLY; no DNS/custom domain/route.
name = "{TARGET}"
main = "production-worker.mjs"
compatibility_date = "2026-10-16"
workers_dev = true
preview_urls = false

[assets]
directory = "../../production-public"
binding = "ASSETS"
run_worker_first = true

[[d1_databases]]
binding = "DB"
database_name = "{DB_NAME}"
database_id = "{db}"

[[d1_databases]]
binding = "MEDIA_ACL"
database_name = "{DB_NAME}"
database_id = "{db}"

[[r2_buckets]]
binding = "MEDIA_BUCKET"
bucket_name = "{DB_NAME}"
''',encoding="utf8")
    print("CELEBRATIONS_EDITABLE_QA_CONFIG_READY worker_name=celebrations-exit-editable-qa other_workers_changed=NO custom_domain=NO")
if __name__=="__main__":
    try:main()
    except BaseException as e:
        print("CELEBRATIONS_EDITABLE_QA_CONFIG_STOP category="+type(e).__name__,file=sys.stderr)
        raise SystemExit(1)
