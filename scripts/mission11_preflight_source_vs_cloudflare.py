#!/usr/bin/env python3
"""Mission 11: compare ONLY actually used website tables, account, legal drafts
and original committee counts before permitting an append-only stats delta.

No writes, no SQL parameter dumps, no document names/links, no PII. Any
editorial change since the migration is a FAIL-CLOSED human reconciliation.
The official site remains live, so "final" means snapshot as of this run,
NOT a permanent cutover guarantee.
"""
import json
import os
import sys
import requests
from migration.export_celebrations_readonly import fetch_table
from scripts.import_public_programme_production_d1 import (
    PUBLIC_TABLES, TARGET, check_env, fetch_target, signatures, query, canonical,
)
from scripts.import_private_admin_accounts_production_d1 import converted_participant

def main():
    root,db=check_env()
    cf=requests.Session()
    cf.headers.update({"Authorization":"Bearer "+os.environ["CLOUDFLARE_API_TOKEN"],
                       "Content-Type":"application/json"})
    r=cf.get(root+"/d1/database/"+db,timeout=25)
    r.raise_for_status()
    info=r.json().get("result") or {}
    if info.get("name")!=TARGET or info.get("jurisdiction")!="eu":
        raise RuntimeError("Unexpected D1 production identity")
    endpoint=root+"/d1/database/"+db+"/query"
    src=requests.Session()
    secret=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    src.headers.update({"apikey":secret,"Authorization":"Bearer "+secret})
    base=os.environ["SUPABASE_URL"].rstrip("/")
    parity={}
    conflicts={}
    # The real nine table programme only; ignore external orphan URLs.
    for table in PUBLIC_TABLES:
        original=list(fetch_table(src,base,table,page_size=400))
        copied,_=fetch_target(cf,endpoint,table)
        parity[table]={"source_rows":len(original),"cloudflare_rows":len(copied)}
        originals=signatures(table,original)
        actual=signatures(table,copied)
        mismatch=sum(1 for k,v in originals.items() if actual.get(k)!=v)
        extra=len(set(actual)-set(originals))
        if mismatch or extra:
            conflicts[table]={"mismatched_or_missing":mismatch,"cloudflare_only":extra}
    # One historical participant is sensitive. Compare transformed verifiers
    # and metadata without logging or re-saving any secret.
    source_accounts=list(fetch_table(src,base,"celebrations_participants",page_size=20))
    cloud_accounts,_,_=query(cf,endpoint,
        'SELECT * FROM "celebrations_participants" LIMIT 3')
    if len(source_accounts)!=1 or len(cloud_accounts)!=1:
        conflicts["celebrations_participants"]={"count_mismatch":True}
    elif signatures("celebrations_participants",
                    [converted_participant(source_accounts[0])])!=signatures(
                     "celebrations_participants",cloud_accounts):
        conflicts["celebrations_participants"]={"secret_or_metadata_drift":True}
    # Published legal pages are real links ONLY if they have been published.
    # Never overwrite admin-created drafts on Cloudflare.
    source_drafts=list(fetch_table(src,base,"celebrations_footer_drafts",page_size=50))
    prod_drafts,_,_=query(cf,endpoint,
        'SELECT count(*) AS n FROM "celebrations_footer_drafts"')
    if len(source_drafts)>0:
        conflicts["celebrations_footer_drafts"]={"source_drafts":len(source_drafts)}
    if prod_drafts[0]["n"]>0:
        # Existing Cloudflare drafts should remain: no automatic copy.
        print("MISSION11_CLOUDFLARE_LEGAL_DRAFTS_PRESERVED "+
              json.dumps({"existing":prod_drafts[0]["n"],"will_not_overwrite":True}))
    # The nine emailed PDF links must survive untouched; do NOT sync sessions.
    invited,_,_=query(cf,endpoint,
        "SELECT count(*) AS n FROM committee_media WHERE published=1 AND revoked_at IS NULL")
    source_invites=list(fetch_table(src,base,"celebrations_committee_letters",page_size=20))
    if invited!=[{"n":9}] or len(source_invites)!=9:
        conflicts["committee"]={"source_count":len(source_invites),
                                 "cloudflare_published":invited[0]["n"]}
    # Cheap exact count for incoming clicks; the append-only writer verifies
    # EVERY historical full row again before copying any new records.
    response=src.get(base+"/rest/v1/celebrations_clicks",params={
        "select":"id","order":"id.desc","limit":"1"
    },headers={"Prefer":"count=exact","Range":"0-0"},timeout=30)
    response.raise_for_status()
    original_count=response.headers.get("Content-Range","")
    import re
    match=re.fullmatch(r"(?:0-0|\*)/(\d+)",original_count)
    if not match:
        raise RuntimeError("Cannot get exact live stats source count")
    source_clicks=int(match.group(1))
    existing,_,_=query(cf,endpoint,
        'SELECT count(*) AS n FROM celebrations_clicks WHERE id<0')
    migrated_clicks=existing[0]["n"]
    if source_clicks<migrated_clicks or source_clicks>18000:
        conflicts["clicks"]={"unexpected_source_total":True}
    print("MISSION11_SOURCE_VS_PRODUCTION_PREFLIGHT "+
          json.dumps({"actual_public_tables_compared":len(parity),
                      "table_counts":parity,"source_clicks_at_preflight":source_clicks,
                      "previously_migrated_clicks":migrated_clicks,
                      "potential_new_visits":source_clicks-migrated_clicks,
                      "historical_private_participant_accounts":len(source_accounts),
                      "original_committee_documents":len(source_invites),
                      "production_published_legal_drafts":prod_drafts[0]["n"],
                      "programme_conflict_counts_only":conflicts,
                      "no_customer_rows_or_secrets_logged":True,
                      "source_writes":0,"d1_writes":0,
                      "live_site_changes":0},sort_keys=True),flush=True)
    if conflicts:
        raise RuntimeError("LIVE_SOURCE_CHANGED_OR_MIRROR_DRIFT_STOP_BEFORE_STATS_WRITE")
    print("MISSION11_PUBLIC_PRIVATE_CONTENT_PREFLIGHT_PASS tables=9 account=1 letters=9 legal_drafts_preserved=yes source_and_target_writes=0")
if __name__=="__main__":
    try:main()
    except BaseException as exc:
        print("MISSION11_PREFLIGHT_STOP category="+type(exc).__name__,file=sys.stderr)
        raise SystemExit(1)
