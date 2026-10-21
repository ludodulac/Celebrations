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
        if name=="index.html":
            # Canonical committee shortlinks must also remain Cloudflare-only.
            # Without this, '?lettre=slug' still redirects users to Supabase.
            original=("location.replace(new URLSearchParams(location.search)"
                      ".get('staging')==='1'?'/letter/'+encodeURIComponent(slug)"
                      ":'https://jwyayfkssyagvnablttg.supabase.co/functions/v1/"
                      "celebrations-committee-public?slug='+encodeURIComponent(slug))")
            replacement="location.replace('/letter/'+encodeURIComponent(slug))"
            if html.count(original)!=1:
                raise RuntimeError("Unexpected legacy committee shortlink boot")
            html=html.replace(original,replacement)

        if "cdn.jsdelivr.net/npm/@supabase/supabase-js" in html:
            raise RuntimeError("Legacy Supabase SDK must not load in production candidate")
        p.write_text(html,encoding="utf-8")
    # Every direct day URL is a full standalone HTML document. Historical
    # staging builds only replaced the SDK on index/admin; leaving these seven
    # pages intact would silently reconnect visitors to Supabase after cutover.
    day_pages=("programme","mercredi","jeudi","vendredi","samedi",
               "dimanche","apres-celebration")
    sdk='<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'
    source='<script src="supabase-data.js?v=8"></script>'
    client='<script src="supabase-client.js?v=1"></script>'
    bootstrap='<script>window.CELEBRATIONS_STAGING_BACKEND=location.origin;</script>'
    bridge_script='<script src="migration/cloudflare/preview-client.js"></script>'
    for slug in day_pages:
        p=PRODUCTION/slug/"index.html"
        html=p.read_text(encoding="utf-8")
        if (html.count(sdk)!=1 or html.count(source)!=1 or
            html.count(client)!=1 or html.count(bridge_script)!=0):
            raise RuntimeError("Unexpected direct-day HTML bootstrap shape")
        html=html.replace(sdk,"")
        html=html.replace(source,bootstrap+source)
        html=html.replace(client,client+bridge_script)
        if (html.count(bootstrap)!=1 or html.count(bridge_script)!=1 or
            "cdn.jsdelivr.net/npm/@supabase/supabase-js" in html):
            raise RuntimeError("Standalone public day still contains legacy Supabase bootstrap")
        p.write_text(html,encoding="utf-8")
    bridge=PRODUCTION/"migration/cloudflare/preview-client.js"
    if not bridge.is_file():
        raise RuntimeError("Cloudflare bridge missing")
    print("PRODUCTION_STATIC_ASSETS_OFFLINE_READY pages=9 backend=Cloudflare only deployment=NO dns_changes=0 d1_queries=0")

if __name__=="__main__":
    main()
