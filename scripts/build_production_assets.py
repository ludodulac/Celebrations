#!/usr/bin/env python3
"""Prepare production-candidate static assets OFFLINE. Never deploy.

Uses the previously proven Supabase-free staging assets transformation, then
enables the same Cloudflare bridge on the production-candidate pages WITHOUT
forcing the public URL to include '?staging=1'. No production resources used.
"""
from pathlib import Path
import shutil
from build_staging_assets import main as build_staging

ROOT=Path(__file__).resolve().parents[1]
STAGING=ROOT/"staging-public"
PRODUCTION=ROOT/"production-public"
OLD='if(new URLSearchParams(location.search).get("staging")==="1")window.CELEBRATIONS_STAGING_BACKEND=location.origin;'
NEW='window.CELEBRATIONS_STAGING_BACKEND=location.origin;'

def main():
    build_staging()
    if PRODUCTION.exists():
        shutil.rmtree(PRODUCTION)
    shutil.copytree(STAGING,PRODUCTION)
    for name in ("index.html","admin.html"):
        p=PRODUCTION/name
        html=p.read_text(encoding="utf-8")
        if html.count(OLD)!=1:
            raise RuntimeError("Cloudflare bridge production bootstrap count changed")
        html=html.replace(OLD,NEW)
        if "cdn.jsdelivr.net/npm/@supabase/supabase-js" in html:
            raise RuntimeError("Legacy Supabase SDK must not load in production candidate")
        p.write_text(html,encoding="utf-8")
    bridge=PRODUCTION/"migration/cloudflare/preview-client.js"
    if not bridge.is_file():
        raise RuntimeError("Cloudflare bridge missing")
    print("PRODUCTION_STATIC_ASSETS_OFFLINE_READY pages=2 backend=Cloudflare only deployment=NO dns_changes=0 d1_queries=0")

if __name__=="__main__":
    main()
