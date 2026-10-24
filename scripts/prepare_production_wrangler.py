#!/usr/bin/env python3
"""Produce a distinct Cloudflare production-candidate Wrangler config OFFLINE.

Never deploy, create resources, change DNS, or mutate D1/R2. Requiring fresh,
separate production IDs prevents accidentally binding the staging account.
"""
import json
import os
import pathlib
import re
import sys

NAME="celebrations-exit-production"
BUCKET="celebrations-exit-production"
UUID=re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",re.I)

def generate(prod_db,prod_bucket,staging_db,staging_bucket,destination):
    if not UUID.fullmatch(str(prod_db)) or not UUID.fullmatch(str(staging_db)):
        raise ValueError("Database identifiers must be UUIDs")
    if str(prod_db).lower()==str(staging_db).lower():
        raise ValueError("Production and staging databases cannot be identical")
    if prod_bucket!=BUCKET or staging_bucket!="celebrations-exit-staging":
        raise ValueError("Production/staging bucket identity mismatch")
    if prod_bucket==staging_bucket:
        raise ValueError("Staging R2 bucket cannot be used for production")
    target=pathlib.Path(destination)
    if target.exists():
        raise ValueError("Refusing overwrite of production config")
    config=f'''# ISOLATED PRODUCTION CANDIDATE — workers.dev only; custom domain NOT approved.
name = "{NAME}"
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
database_name = "{NAME}"
database_id = {json.dumps(prod_db)}

[[d1_databases]]
binding = "MEDIA_ACL"
database_name = "{NAME}"
database_id = {json.dumps(prod_db)}

[[r2_buckets]]
binding = "MEDIA_BUCKET"
bucket_name = "{BUCKET}"
'''
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(config,encoding="utf8")
    return config

def main():
    env=os.environ
    generate(env["CELEBRATIONS_PROD_D1_ID"],env["CELEBRATIONS_PROD_R2_BUCKET"],
             env["CELEBRATIONS_STAGING_D1_ID"],env["CELEBRATIONS_STAGING_R2_BUCKET"],
             "migration/cloudflare/wrangler.production.toml")
    print("PRODUCTION_WRANGLER_CANDIDATE_ONLY deployment=NO dns_changes=0 d1_queries=0")

if __name__=="__main__":
    try:main()
    except (ValueError,KeyError,FileExistsError) as error:
        print("PRODUCTION_CONFIG_BLOCKED reason="+type(error).__name__,file=sys.stderr)
        raise SystemExit(1)
