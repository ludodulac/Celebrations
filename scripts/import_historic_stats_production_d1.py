#!/usr/bin/env python3
"""CÉLÉBRATIONS: privately mirror historical Supabase click/page-view records.

Only Cloudflare production D1 'celebrations_clicks' may be written. Source is
REST GET only. Keep source IDs in a NEGATIVE namespace (-id) so new D1 visitor
analytics (positive IDs) can coexist without collisions. The original website
stays live and a final pre-cutover delta sync will still be required.

No personal data, full rows, SQL query parameters, URLs, visitor identifiers,
credentials or email addresses are emitted to logs or workflow artifacts.
"""
import datetime as dt
import json
import os
import sys

import requests
from migration.export_celebrations_readonly import fetch_table,PRIMARY_KEYS
from scripts.import_public_programme_production_d1 import check_env,query,canonical

TABLE="celebrations_clicks"
COLUMNS=("id","clicked_at","celebration_id","content_id","target_kind",
         "target_label","target_url","page_path","step_key","event_id","visitor_id")
MAX_SOURCE_ROWS=13000
MIN_HISTORICAL=11632
BATCH=60
MAX_READ_BUDGET=100000
MAX_WRITE_BUDGET=80000


def source_snapshot(src,base):
    originals=list(fetch_table(src,base,TABLE,page_size=500))
    if not MIN_HISTORICAL<=len(originals)<=MAX_SOURCE_ROWS:
        raise ValueError("Statistics source volume outside approved range")
    if any(set(x)!=set(COLUMNS) or not isinstance(x.get("id"),int) or
           x["id"]<=0 for x in originals):
        raise ValueError("Malformed source statistics")
    ids={x["id"] for x in originals}
    if len(ids)!=len(originals):
        raise ValueError("Source statistics contain duplicate IDs")
    transformed=[{**canonical(row),"id":-row["id"]} for row in originals]
    return transformed,max(ids)


def target_rows(cf,endpoint):
    """Read negative source-id namespace by indexed keyset pagination."""
    values={}
    cursor=0
    reads=0
    while True:
        records,nr,_=query(
            cf,endpoint,
            'SELECT * FROM "celebrations_clicks" WHERE id<? ORDER BY id DESC LIMIT 301',
            [cursor])
        reads+=nr
        if len(records)>301 or reads>MAX_READ_BUDGET:
            raise RuntimeError("Unsafe D1 historical analytics paging")
        for row in records:
            id=row.get("id")
            if not isinstance(id,int) or id>=cursor or id>=0 or id in values:
                raise RuntimeError("Invalid or duplicate production statistics")
            if set(row)!=set(COLUMNS):
                raise RuntimeError("Statistics table columns differ")
            values[id]=row
            cursor=id
        if len(records)<301:
            break
    return values,reads


def equal_row(a,b):
    if set(a)!=set(b):return False
    for field in COLUMNS:
        x=a[field]
        y=b[field]
        if field=="clicked_at":
            try:
                dt1=dt.datetime.fromisoformat(str(x).replace("Z","+00:00").replace(" ","T"))
                dt2=dt.datetime.fromisoformat(str(y).replace("Z","+00:00").replace(" ","T"))
                if dt1.tzinfo is None or dt2.tzinfo is None or dt1!=dt2:return False
            except (TypeError,ValueError):
                return False
        elif x!=y:
            return False
    return True


def insert_clicks(cf,endpoint,records):
    cols=COLUMNS
    sql='INSERT INTO "celebrations_clicks" ('+','.join('"'+x+'"' for x in cols)+') SELECT '+','.join("json_extract(value,'$."+c+"')" for c in cols)+" FROM json_each(?)"
    writes=0
    for offset in range(0,len(records),BATCH):
        block=records[offset:offset+BATCH]
        encoded=json.dumps(block,ensure_ascii=False,separators=(",",":"))
        if len(encoded.encode())>250000:
            raise ValueError("Oversized private click batch")
        _,nr,nw=query(cf,endpoint,sql,[encoded],allow_write=True)
        if not len(block)<=nw<=len(block)*6:
            raise RuntimeError("Unexpected D1 statistics write accounting")
        writes+=nw
        if writes>MAX_WRITE_BUDGET:
            raise RuntimeError("Production statistics write quota budget exceeded")
        if (offset+BATCH)%1200==0:
            print("PROD_HISTORIC_STATS_PROGRESS "+json.dumps({
                "processed":offset+len(block),"total_to_insert":len(records)
            }),flush=True)
    return writes


def main():
    root,db=check_env()
    cf=requests.Session()
    cf.headers.update({"Authorization":"Bearer "+os.environ["CLOUDFLARE_API_TOKEN"],
                       "Content-Type":"application/json"})
    meta=cf.get(root+"/d1/database/"+db,timeout=25)
    meta.raise_for_status()
    identity=meta.json()
    if (identity.get("success") is not True or
        (identity.get("result") or {}).get("name")!="celebrations-exit-production" or
        (identity.get("result") or {}).get("jurisdiction")!="eu"):
        raise RuntimeError("Cloudflare D1 identity not approved")
    endpoint=root+"/d1/database/"+db+"/query"
    src=requests.Session()
    secret=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    src.headers.update({"apikey":secret,"Authorization":"Bearer "+secret})
    rows,source_max=source_snapshot(src,os.environ["SUPABASE_URL"].rstrip("/"))
    expected={r["id"]:r for r in rows}
    existing,pre_reads=target_rows(cf,endpoint)
    # Future production page-view logs must start positive. Do not modify them.
    other,_,_=query(cf,endpoint,
        'SELECT count(*) AS n FROM "celebrations_clicks" WHERE id>=0')
    if other!=[{"n":0}]:
        raise RuntimeError("Production already has non-source statistics; stop")
    for id,prior in existing.items():
        if id not in expected or not equal_row(prior,expected[id]):
            raise RuntimeError("Source statistics differ from existing production rows")
    absent=[r for id,r in expected.items() if id not in existing]
    print("PROD_HISTORIC_STATS_PREFLIGHT "+json.dumps({
        "source_rows_snapshot":len(rows),
        "source_max_id_at_snapshot":source_max,
        "already_copied_and_verified":len(existing),
        "rows_pending":len(absent),
        "source_id_namespace":"negative_only",
        "production_positive_id_namespace_mutated":False,
        "supabase_writes":0,"other_tables_written":0,"r2_mutations":0,
        "dns_changed":False,"worker_deployed":False
    },sort_keys=True),flush=True)
    writes=insert_clicks(cf,endpoint,absent)
    final,post_reads=target_rows(cf,endpoint)
    if len(final)!=len(expected) or any(
            id not in final or not equal_row(final[id],row)
            for id,row in expected.items()):
        raise RuntimeError("Production statistics full-record verification failed")
    if pre_reads+post_reads>MAX_READ_BUDGET or writes>MAX_WRITE_BUDGET:
        raise RuntimeError("D1 operation exceeded internal budget")
    print("PROD_HISTORIC_STATS_IMPORT_VERIFIED "+json.dumps({
        "snapshot_source_rows":len(expected),
        "source_max_id_at_snapshot":source_max,
        "all_source_rows_verified":len(final),
        "added_this_run":len(absent),
        "historical_ids_negative":True,
        "full_field_parity_including_visitor_id":True,
        "target_ids_originally_positive_mutated":False,
        "D1_reported_rows_read":pre_reads+post_reads,
        "D1_reported_rows_written":writes,
        "source_mutations":0,"other_D1_tables_mutated":0,
        "worker_deployed":False,"dns_changed":False,
        "final_live_stats_delta_still_required":True
    },sort_keys=True),flush=True)


if __name__=="__main__":
    try:main()
    except BaseException as exc:
        print("PROD_HISTORIC_STATS_IMPORT_STOP category="+type(exc).__name__,file=sys.stderr)
        raise SystemExit(1)
