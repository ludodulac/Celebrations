#!/usr/bin/env python3
"""Build Cloudflare-only static assets offline. No credentials, D1 access or deployment."""
from pathlib import Path
from build_staging_assets import main as build_staging

ROOT=Path(__file__).resolve().parents[1]
PRODUCTION=ROOT/"production-public"
DAY_PAGES=("programme","mercredi","jeudi","vendredi","samedi",
           "dimanche","apres-celebration","bibliotheque","apres-la-ronde")
SDK='<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'
BOOT='<script>window.CELEBRATIONS_CLOUDFLARE_BACKEND=location.origin;</script>'
BRIDGE='<script src="migration/cloudflare/preview-client.js"></script>'

def main():
    build_staging(output_dir=PRODUCTION)
    for slug in DAY_PAGES:
        page=PRODUCTION/slug/"index.html"
        html=page.read_text(encoding="utf-8")
        if SDK in html or "supabase-client.js" in html:
            raise RuntimeError(f"Legacy bootstrap remains in {slug}")
        if html.count(BOOT)!=1 or html.count(BRIDGE)!=1:
            raise RuntimeError(f"Cloudflare bootstrap missing in {slug}")
        page.write_text(html,encoding="utf-8")
    preparation=PRODUCTION/"preparation"/"index.html"
    preparation.parent.mkdir(parents=True,exist_ok=True)
    page=(PRODUCTION/"programme"/"index.html").read_text(encoding="utf-8")
    title="<title>Célébrations des Archanges — Programme</title>"
    if page.count(title)!=1:
        raise RuntimeError("Unexpected programme title")
    preparation.write_text(page.replace(title,
        "<title>Célébrations des Archanges — Préparation</title>"),encoding="utf-8")
    for slug in ("mentions-legales","confidentialite","cookies"):
        page=PRODUCTION/(slug+".html")
        html=page.read_text(encoding="utf-8")
        needle='<script src="footer-page-public.js?v=3"></script>'
        if html.count(needle)!=1:
            raise RuntimeError(f"Unexpected footer bootstrap in {slug}")
        page.write_text(html.replace(needle,BOOT+needle),encoding="utf-8")
    for page in PRODUCTION.rglob("*.html"):
        html=page.read_text(encoding="utf-8")
        if "supabase.co" in html or "@supabase/supabase-js" in html:
            raise RuntimeError(f"Legacy Supabase URL in {page.relative_to(PRODUCTION)}")
    print("PRODUCTION_STATIC_ASSETS_OFFLINE_READY backend=Cloudflare_only deployment=NO")

if __name__=="__main__":
    main()
