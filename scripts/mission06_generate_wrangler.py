#!/usr/bin/env python3
"""Generate ONLY a preview or the exact historical PDF Worker from pinned main."""
import os, pathlib, re, subprocess, sys
PIN="4b5edd9c19ce989af2eae33445017dd30fcbbe92"
DB="28736d2a-479b-472b-bf82-703ad0affe10"
BUCKET="celebrations-exit-production"
def main(mode):
    if mode not in ("preview","historic"):
        raise ValueError("Unexpected mission 06 mode")
    if os.environ.get("GITHUB_REF")!="refs/heads/feat/celebrations-supabase-exit-001":
        raise ValueError("Wrong branch")
    if os.environ.get("PROD_D1_ID")!=DB or os.environ.get("STAGING_D1_ID")==DB:
        raise ValueError("Wrong D1 bindings")
    if os.environ.get("STAGING_R2_BUCKET")!="celebrations-exit-staging":
        raise ValueError("Wrong staging isolation")
    if subprocess.check_output(["git","-C","legacy-main","rev-parse","HEAD"],text=True).strip()!=PIN:
        raise ValueError("Original static site changed; refuse")
    name="celebrations-legacy-links-qa" if mode=="preview" else "celebrations"
    dest=pathlib.Path(f"migration/cloudflare/wrangler.mission06.{mode}.toml")
    if dest.exists():raise ValueError("Refusing config overwrite")
    dest.write_text(f'''# Mission 06: ONLY existing mailed PDFs, rest is original pinned main.
name = "{name}"
main = "legacy-mailed-pdf-worker.mjs"
compatibility_date = "2026-10-16"
workers_dev = true
preview_urls = false

[assets]
directory = "../../legacy-main"
binding = "ASSETS"
run_worker_first = true
not_found_handling = "single-page-application"

[[d1_databases]]
binding = "DB"
database_name = "{BUCKET}"
database_id = "{DB}"

[[d1_databases]]
binding = "MEDIA_ACL"
database_name = "{BUCKET}"
database_id = "{DB}"

[[r2_buckets]]
binding = "MEDIA_BUCKET"
bucket_name = "{BUCKET}"
''',encoding="utf-8")
    print("MISSION06_BRIDGE_CONFIG_READY mode="+mode+" hostname="+name+".rondes.workers.dev pinned_main_verified=YES no_custom_domain=YES")
if __name__=="__main__":
    try:main(sys.argv[1])
    except BaseException as e:
        print("MISSION06_BRIDGE_CONFIG_STOP category="+type(e).__name__,file=sys.stderr)
        sys.exit(1)
