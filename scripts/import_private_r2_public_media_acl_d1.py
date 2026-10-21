#!/usr/bin/env python3
"""Initialize PRIVATE R2 gateway ACL for exactly 121 protected objects in PROD.

Audience-facing files: 112 explicitly approved keys. Committee PDFs: 9 keys
accessible only via their original unique opaque invitation slugs, never by
their raw key. Only insert into 3 production D1 tables: public_media,
committee_media, celebrations_committee_letters.

Supabase REST/Storage: READ ONLY. Cloudflare R2: READ ONLY inventory. No
DNS, Worker deploy, media uploads, deletes, or source/staging writes.
"""
import json
import os
import sys
from datetime import datetime, timezone
from urllib.parse import urlsplit
import requests
from migration.export_celebrations_readonly import fetch_table
from scripts.import_public_programme_production_d1 import (
    check_env, query, column_names
)
from scripts.audit_public_only_media import (
    SOURCE_TABLES, fetch_all, list_objects, asset_audit, static_homepage_refs
)
from scripts.copy_selected_public_media_to_production import select_visible_paths
from scripts.copy_selected_with_scoped_production_key import s3, list_production

EXPECTED_OBJECTS=121
EXPECTED_BYTES=766989338
TARGET="celebrations-exit-production"
TABLES=("celebrations_committee_letters","public_media","committee_media")
IDS={
 "celebrations_committee_letters":("id",),
 "public_media":("storage_path",),
 "committee_media":("slug",),
}


def keys(table,row):
    return tuple(row[k] for k in IDS[table])


def canonical(table,rows):
    out={}
    for row in rows:
        k=keys(table,row)
        if not all(isinstance(v,str) and v for v in k) or k in out:
            raise ValueError("Duplicate/invalid media ACL identity")
        if not isinstance(row,dict):
            raise ValueError("Invalid ACL row")
        out[k]=dict(row)
    return out


def read_rows(cf,endpoint,table):
    if table not in TABLES:
        raise ValueError("Unexpected D1 table")
    rows,reads,write=query(cf,endpoint,'SELECT * FROM "'+table+'" LIMIT 151')
    if not isinstance(rows,list) or len(rows)>150:
        raise ValueError("ACL inspection exceeded safety limit")
    return rows,reads


def insert_selected(cf,endpoint,table,rows):
    if table not in TABLES:
        raise ValueError("Unapproved ACL D1 table")
    if not rows:
        return 0
    columns=column_names(rows)
    sql='INSERT INTO "'+table+'" ('+','.join('"'+s+'"' for s in columns)+') SELECT '+','.join("json_extract(value,'$."+s+"')" for s in columns)+" FROM json_each(?)"
    for i in range(0,len(rows),20):
        block=rows[i:i+20]
        arg=json.dumps(block,ensure_ascii=False,separators=(",",":"))
        if len(arg.encode())>150000:
            raise ValueError("Unexpected media ACL payload size")
        out,read,write=query(cf,endpoint,sql,[arg],allow_write=True)
        if write<len(block) or write>len(block)*5:
            raise RuntimeError("Unexpected media ACL write count")
    return len(rows)


def main():
    root,db=check_env()
    origin=os.environ["SUPABASE_URL"].rstrip("/")
    sup=requests.Session()
    secret=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    sup.headers.update({"apikey":secret,"Authorization":"Bearer "+secret})
    data={k:fetch_all(sup,origin,v) for k,v in SOURCE_TABLES.items()}
    inventory=list_objects(sup,origin)
    if len(inventory)!=158 or sum(inventory.values())!=830312417:
        raise ValueError("Source inventory changed")
    report,selection=select_visible_paths(data,inventory)
    selected=selection["selected"]
    committee=selection["committee"]
    public=selected-committee
    if not len(selected)==121 or not len(committee)==9 or not len(public)==112:
        raise ValueError("Media protection breakdown not previously approved")
    if any(not x.startswith("committee/") for x in committee):
        raise ValueError("Committee path outside private key namespace")
    if any(x.startswith("committee/") for x in public):
        raise ValueError("Public ACL cannot contain committee files")
    if sum(inventory[key] for key in selected)!=EXPECTED_BYTES:
        raise ValueError("Published media content changed")

    letters=list(fetch_table(sup,origin,"celebrations_committee_letters"))
    if len(letters)!=9:
        raise ValueError("Invitations changed")
    letter_map={row.get("storage_path"):row.get("slug") for row in letters}
    if (set(letter_map)!=committee or len(set(letter_map.values()))!=9 or
        any(not isinstance(slug,str) or not 8<=len(slug)<160 for slug in letter_map.values())):
        raise ValueError("Invitation access paths or slugs invalid")

    # A distinct owner-created key is read-only in this action. The returned
    # inventory must EXACTLY equal 121 selected resources, with exact sizes.
    client=s3("PROD")
    client.head_bucket(Bucket=TARGET)
    actual=list_production(client)
    if set(actual)!=selected or any(actual[k]!=inventory[k] for k in selected):
        raise ValueError("Production R2 inventory is not the exact approved 121-file set")

    cf=requests.Session()
    cf.headers["Authorization"]="Bearer "+os.environ["CLOUDFLARE_API_TOKEN"]
    cf.headers["Content-Type"]="application/json"
    meta=cf.get(root+"/d1/database/"+db,timeout=25)
    meta.raise_for_status()
    body=meta.json()
    if body.get("success") is not True or (
        body.get("result") or {}).get("name")!=TARGET or (
        body.get("result") or {}).get("jurisdiction")!="eu":
        raise ValueError("Incorrect production D1 identity")
    endpoint=root+"/d1/database/"+db+"/query"
    public_rows=[{"storage_path":k,"approved":1,"revoked_at":None,"approved_at":None}
                 for k in sorted(public)]
    committee_rows=[{"slug":row["slug"],"storage_path":row["storage_path"],
                     "published":1,"revoked_at":None,"created_at":row["created_at"]}
                    for row in letters]
    plan={
        "celebrations_committee_letters":letters,
        "public_media":public_rows,
        "committee_media":committee_rows,
    }
    if any(len(x)!=expected for x,expected in
           zip(plan.values(),(9,112,9))):
        raise ValueError("Incorrect ACL plan size")
    # Sanity-check the public D1 programme was imported successfully first.
    check,_,_=query(cf,endpoint,'SELECT count(*) AS n FROM "celebrations_contents"')
    if check!=[{"n":211}]:
        raise ValueError("Production public programme must be complete")
    pending={}
    for table,planned in plan.items():
        old,read=read_rows(cf,endpoint,table)
        have=canonical(table,old)
        want=canonical(table,planned)
        if any(k not in want or want[k]!=v for k,v in have.items()):
            raise ValueError("Pre-existing production ACL disagrees with approved source")
        pending[table]=[v for k,v in want.items() if k not in have]
    print("PRODUCTION_PRIVATE_R2_ACL_PREFLIGHT "+json.dumps({
        "r2_objects_verified":121,"r2_bytes_verified":EXPECTED_BYTES,
        "public_media_protected":112,"committee_slugged_pdfs":9,
        "new_d1_rows_pending":sum(map(len,pending.values())),
        "source_mutations":0,"r2_mutations":0,"site_deploy":False
    },sort_keys=True),flush=True)
    for table,items in pending.items():
        copied=insert_selected(cf,endpoint,table,items)
        now,read=read_rows(cf,endpoint,table)
        if canonical(table,now)!=canonical(table,plan[table]):
            raise RuntimeError("Imported media ACL differs from source")
        print("PRODUCTION_MEDIA_ACL_TABLE_VERIFIED "+json.dumps({
            "table":table,"rows":len(now),"copied_this_run":copied
        },sort_keys=True),flush=True)
    print("PRODUCTION_PRIVATE_R2_ACL_IMPORT_VERIFIED "+json.dumps({
        "original_committee_letters":9,"public_images_and_files_approved":112,
        "committee_invitations_slug_access_only":9,
        "r2_keys_and_sizes_verified":121,
        "r2_bytes_verified":EXPECTED_BYTES,
        "source_mutations":0,"r2_mutations":0,
        "source_files_deleted":0,"staging_files_deleted":0,
        "worker_deployed":False,"dns_changed":False,
        "full_browser_validation_still_required":True
    },sort_keys=True),flush=True)


if __name__=="__main__":
    try:main()
    except BaseException as e:
        print("PRODUCTION_PRIVATE_R2_ACL_IMPORT_STOP category="+type(e).__name__,file=sys.stderr)
        raise SystemExit(1)
