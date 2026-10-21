#!/usr/bin/env python3
"""Generate a distinct, never-custom-domain READ-ONLY preview Worker binding.

Its Worker is code-enforced GET/HEAD-only and uses the new isolated production
D1/R2 for verification; it does not deploy production-worker.mjs itself.
"""
import os
import pathlib
import re
import sys

DB_NAME="celebrations-exit-production"
PREVIEW_NAME="celebrations-exit-preview-ro"
UUID=re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",re.I)


def generate(database_id,staging_id,staging_bucket,prod_bucket,dest):
    if not UUID.fullmatch(str(database_id)) or not UUID.fullmatch(str(staging_id)) or database_id==staging_id:
        raise ValueError("Refusing wrong production database")
    if staging_bucket!="celebrations-exit-staging" or prod_bucket!=DB_NAME:
        raise ValueError("Wrong storage identity")
    path=pathlib.Path(dest)
    if path.exists():
        raise ValueError("Refusing overwrite of preview config")
    text=f'''# Distinct READ-ONLY PREVIEW. Do NOT attach routes or custom domains.
name = "{PREVIEW_NAME}"
main = "readonly-preview-worker.mjs"
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
database_id = "{database_id}"

[[d1_databases]]
binding = "MEDIA_ACL"
database_name = "{DB_NAME}"
database_id = "{database_id}"

[[r2_buckets]]
binding = "MEDIA_BUCKET"
bucket_name = "{prod_bucket}"
'''
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(text,encoding="utf8")
    return text


def main():
    env=os.environ
    generate(env["PROD_D1_ID"],env["STAGING_D1_ID"],
             env["STAGING_R2_BUCKET"],"celebrations-exit-production",
             "migration/cloudflare/wrangler.readonly-preview.toml")
    print("READ_ONLY_PREVIEW_CONFIG_PASS production_d1_only=true isolated_preview_worker=true "
          "custom_domain=false dns_writes=0")
if __name__=="__main__":
    try:main()
    except BaseException as err:
        print("READ_ONLY_PREVIEW_CONFIG_STOP category="+type(err).__name__,file=sys.stderr)
        raise SystemExit(1)
