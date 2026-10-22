#!/usr/bin/env python3
"""Mission 08: audit ONLY resources available from real website navigation.

Read Supabase (source) + Cloudflare D1 (migrated) + HTTP preview, never mutate.
The old image gallery *removes* images whose Storage file fails to load:
missing historic image metadata is not a visible media asset.
No private paths, slugs, names, PII, tokens or binary media printed.
"""
import collections
import json
import os
import pathlib
import re
import sys
from urllib.parse import urlsplit, quote

import requests
from scripts.audit_public_only_media import (SOURCE_HOST, SOURCE_TABLES,
                                             fetch_all, list_objects, asset_audit,
                                             static_homepage_refs)
from scripts.import_public_programme_production_d1 import check_env, query

BUCKET="celebrations-exit-production"
PREVIEW="https://celebrations-exit-preview-ro.rondes.workers.dev"
REPAIRED_PDF="media/pdf-1789466878259-22-9vktt/file-1789466879911-Pardon-des-Offenses-version-raccourcie.pdf"

def safe_status(session,key):
    path="/media/"+"/".join(quote(p,safe="") for p in key.split("/"))
    r=session.head(PREVIEW+path,timeout=25,allow_redirects=False)
    return r.status_code,r.headers.get("content-type","")

def main():
    if os.environ.get("GITHUB_REF")!="refs/heads/feat/celebrations-supabase-exit-001":
        raise RuntimeError("Audit must be on migration branch")
    base=os.environ["SUPABASE_URL"].rstrip("/")
    u=urlsplit(base)
    if u.scheme!="https" or u.hostname!=SOURCE_HOST or u.path or u.query:
        raise RuntimeError("Unexpected source")
    if os.environ.get("STAGING_R2_BUCKET")!="celebrations-exit-staging":
        raise RuntimeError("Wrong staging scope")
    source=requests.Session()
    token=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    source.headers.update({"apikey":token,"Authorization":"Bearer "+token})
    d={key:fetch_all(source,base,name) for key,name in SOURCE_TABLES.items()}
    inventory=list_objects(source,base)
    if len(inventory)!=158 or sum(inventory.values())!=830312417:
        raise RuntimeError("Source inventory drift; stop")
    report,part=asset_audit(
        d["contents"],d["event_links"],d["step_links"],d["events"],
        d["links"],d["letters"],inventory,static_homepage_refs(),True)
    if len(d["contents"])!=211 or len(d["event_links"])!=124 or len(d["letters"])!=9:
        raise RuntimeError("Unexpected programme inventory")
    cfroot,db=check_env()
    if db!="28736d2a-479b-472b-bf82-703ad0affe10":
        raise RuntimeError("Wrong prod D1")
    cf=requests.Session()
    cf.headers.update({"Authorization":"Bearer "+os.environ["CLOUDFLARE_API_TOKEN"],
                       "Content-Type":"application/json"})
    endpoint=cfroot+"/d1/database/"+db+"/query"
    approved,_,_=query(cf,endpoint,"SELECT storage_path FROM public_media WHERE approved=1 AND revoked_at IS NULL")
    approved_keys={r["storage_path"] for r in approved}
    if len(approved_keys)!=113:
        raise RuntimeError("Production public media allowlist drift")
    if REPAIRED_PDF not in approved_keys or REPAIRED_PDF in inventory:
        raise RuntimeError("One historical PDF repair metadata drift")
    committee,_,_=query(cf,endpoint,"SELECT slug FROM committee_media WHERE published=1 AND revoked_at IS NULL")
    if len(committee)!=9:raise RuntimeError("Original committee invitations drift")

    events_linked={str(x["content_id"]) for x in d["event_links"]}
    steps_linked={str(x["content_id"]) for x in d["step_links"]}
    links_used=events_linked|steps_linked
    missing=part["missing"]
    roles=collections.Counter()
    gallery_missing=set()
    problematic=[]
    for key in sorted(missing):
        matched=[c for c in d["contents"] if c.get("storage_path")==key or c.get("cover_storage_path")==key]
        if not matched:
            roles["unmatched"]+=1
            problematic.append(key)
            continue
        for c in matched:
            id=str(c["id"])
            is_image=(c.get("content_type")=="Image" and c.get("source_type")=="file" and c.get("storage_path")==key)
            is_cover=c.get("has_cover") is True and c.get("cover_storage_path")==key
            is_linked=id in links_used
            is_home=str(c.get("category") or "").strip().lower()=="accueil"
            if is_image:roles["image_gallery_missing"]+=1;gallery_missing.add(key)
            if is_cover:roles["cover_missing"]+=1
            if is_linked:roles["linked_programme_missing"]+=1
            if is_home:roles["accueil_missing"]+=1
            if c.get("content_type")=="PDF" and c.get("storage_path")==key:
                roles["pdf_original_missing"]+=1
            if (not is_image and not is_cover) or (is_linked and not is_image) or is_home:
                problematic.append(key)
    roles["missing_distinct_keys"]=len(missing)
    roles["missing_distinct_gallery_image_keys"]=len(gallery_missing)
    roles["missing_distinct_non_gallery"]=len(missing-gallery_missing)
    repaired=REPAIRED_PDF in missing
    if not repaired:
        raise RuntimeError("Expected original PDF gap not detected")
    status,mime=safe_status(requests.Session(),REPAIRED_PDF)
    if status!=200 or "application/pdf" not in mime:
        raise RuntimeError("Restored website-linked PDF unavailable from Cloudflare")
    if roles["missing_distinct_keys"]!=31:
        raise RuntimeError("Missing reference count changed from known 31")
    if roles["missing_distinct_gallery_image_keys"]!=30:
        raise RuntimeError("Historic missing gallery count differs from known 30")

    # The shipped public gallery tries getMedia for each candidate and REMOVES
    # the card when the file does not exist. Therefore 30 missing Storage files
    # are legacy catalog entries, not thirty displayed broken thumbnails.
    js=pathlib.Path("public-library-simple.js").read_text(encoding="utf8")
    if not ("function hydrateGalleryImages(items)" in js
            and "if(!file||!String(file.type||'').startsWith('image/')){card.remove();return}" in js):
        raise RuntimeError("Gallery visibility behavior changed; re-audit actual UI")
    # Verify all copied/cured public resources actually return HTTP 200.
    browser=requests.Session()
    tested=0
    for k in approved_keys:
        code,_=safe_status(browser,k)
        if code!=200:
            raise RuntimeError("An approved public resource does not render in cloud preview")
        tested+=1
    unavailable_after_migration=missing-approved_keys
    # Image paths missing BEFORE migration must stay absent, not invented or
    # falsely claimed 'recovered'. The restored PDF is now fully available.
    assert REPAIRED_PDF not in unavailable_after_migration
    print("MISSION08_VISIBLE_ONLY_SOURCE_REFERENCE_AUDIT "+json.dumps({
        "original_public_content_cards":len(d["contents"]),
        "original_objects_in_source":len(inventory),
        "historically_missing_storage_keys":len(missing),
        "historically_missing_gallery_image_keys":len(gallery_missing),
        "historically_missing_pdf_keys":roles["pdf_original_missing"],
        "linked_programme_missing_records":roles["linked_programme_missing"],
        "accueil_missing_records":roles["accueil_missing"],
        "cover_missing_records":roles["cover_missing"],
        "unclassified_missing_keys":len(set(problematic)-{REPAIRED_PDF}),
        "gallery_hides_missing_images_before_render":True,
        "original_pdf_restored_in_cloudflare":repaired and status==200,
        "approved_public_website_files_http_200":tested,
        "historic_9_pdf_committee_links_untouched":True,
        "media_names_or_paths_logged":False,
        "source_writes":0,"production_writes":0,"dns_changes":0
    },sort_keys=True))
    # Print a violation count rather than path/name if any missing references
    # are still present in a visitor's programme/accueil/visible gallery.
    if roles["accueil_missing_records"] or (
       len(set(problematic)-{REPAIRED_PDF})>0):
        raise RuntimeError("A live page may reference files missing from original Storage: human review required")
if __name__=="__main__":
    try:main()
    except BaseException as err:
        print("MISSION08_VISIBLE_ONLY_AUDIT_STOP category="+type(err).__name__,file=sys.stderr)
        raise SystemExit(1)
