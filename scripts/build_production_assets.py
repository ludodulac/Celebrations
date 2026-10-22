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
    # The staging build substitutes the original homepage illustration with
    # a staging-only R2 key. That file is NOT in the isolated production R2,
    # so using this staging placeholder silently breaks the first image.
    # The original JPG is already included in the 121 published production
    # assets and protected by public_media; serve its exact original key.
    homepage=PRODUCTION/"index.html"
    html=homepage.read_text(encoding="utf-8")
    legacy="/media/media/celebrations-staging-welcome-autumn-2026.jpg"
    original="/media/media/1791723108110/file-1791723109615-1000040461.jpg"
    if html.count(legacy)!=1:
        raise RuntimeError("Unexpected staging-only homepage image reference")
    if original in html:
        raise RuntimeError("Original homepage image already present in generated candidate")
    homepage.write_text(html.replace(legacy,original),encoding="utf-8")
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
    # The public programme creates /preparation via history.pushState.
    # The old checkout has no preparation/index.html and an obsolete _redirects
    # alias previously sent direct browser visits to Google Drive. Build an
    # actual standalone Préparation page, using the same verified Cloudflare
    # bootstrap as the other programme pages; NEVER change GitHub main.
    preparation=PRODUCTION/"preparation"/"index.html"
    preparation.parent.mkdir(parents=True,exist_ok=True)
    if preparation.exists():
        raise RuntimeError("Unexpected pre-existing Préparation source page")
    page=(PRODUCTION/"programme"/"index.html").read_text(encoding="utf-8")
    old_title="<title>Célébrations des Archanges — Programme</title>"
    if page.count(old_title)!=1:
        raise RuntimeError("Unexpected programme HTML title")
    preparation.write_text(page.replace(old_title,
        "<title>Célébrations des Archanges — Préparation</title>"),
        encoding="utf-8")
    bridge=PRODUCTION/"migration/cloudflare/preview-client.js"
    if not bridge.is_file():
        raise RuntimeError("Cloudflare bridge missing")
    print("PRODUCTION_STATIC_ASSETS_OFFLINE_READY pages=9 original_homepage_image=RESTORED_FROM_ORIGINAL_PRIVATE_R2 backend=Cloudflare_only deployment=NO dns_changes=0 d1_queries=0")

if __name__=="__main__":
    main()
