#!/usr/bin/env python3
"""CÉLÉBRATIONS: copy only 9 public-programme tables into isolated production D1.

Live Supabase: READ-ONLY. D1: only INSERT missing rows into nine explicit
whitelisted tables; existing rows compared field-by-field before any writes.
No user credentials, analytics, session, committee letters, media ACL, source
Storage objects, R2 objects, deployment, or public domain are touched.

A final sync is required before any eventual DNS switch, since Supabase remains
live and this REST source read is not a PostgreSQL transaction snapshot.
"""
import collections
import hashlib
import json
import os
import re
import sys
from urllib.parse import urlsplit

import requests

from migration.export_celebrations_readonly import PRIMARY_KEYS, fetch_table

PUBLIC_TABLES=(
 "celebrations_celebrations",
 "celebrations_groups",
 "celebrations_public_settings",
 "celebrations_contents",
 "celebrations_steps",
 "celebrations_events",
 "celebrations_links",
 "celebrations_event_contents",
 "celebrations_step_contents",
)
COUNTS={
 "celebrations_celebrations":4,
 "celebrations_groups":3,
 "celebrations_public_settings":1,
 "celebrations_contents":211,
 "celebrations_steps":28,
 "celebrations_events":62,
 "celebrations_links":23,
 "celebrations_event_contents":124,
 "celebrations_step_contents":0,
}
assert sum(COUNTS.values())==456
OTHER_TABLES=(
 "celebrations_footer_drafts",
 "celebrations_user_profiles",
 "celebrations_participants",
 "celebrations_participant_sessions",
 "celebrations_admin_sessions",
 "celebrations_committee_letters",
 "celebrations_clicks",
 "celebrations_login_attempts",
 "public_media",
 "committee_media",
)
TARGET="celebrations-exit-production"
SOURCE="jwyayfkssyagvnablttg.supabase.co"
UUID=re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",re.I)


def check_env():
    env=os.environ
    if env.get("GITHUB_REF")!="refs/heads/feat/celebrations-supabase-exit-001":
        raise ValueError("Unexpected migration branch")
    src=urlsplit(env["SUPABASE_URL"].rstrip("/"))
    if (src.scheme!="https" or src.hostname!=SOURCE or
        src.path or src.query or src.fragment):
        raise ValueError("Unexpected source project")
    account=env["CLOUDFLARE_ACCOUNT_ID"]
    if not re.fullmatch(r"[a-f0-9]{32}",account,re.I):
        raise ValueError("Invalid Cloudflare account ID")
    prod=env["PROD_D1_ID"]
    stag=env["STAGING_D1_ID"]
    if not UUID.fullmatch(prod) or not UUID.fullmatch(stag) or prod==stag:
        raise ValueError("Production database not separate from staging")
    if env["STAGING_R2_BUCKET"]!="celebrations-exit-staging":
        raise ValueError("Unexpected staging R2")
    root="https://api.cloudflare.com/client/v4/accounts/"+account
    return root,prod


def canonical(row):
    result={}
    for key,value in row.items():
        if isinstance(value,bool):value=int(value)
        if isinstance(value,(list,dict,bytes)):
            raise ValueError("Unexpected nested or binary source field")
        if isinstance(value,str) and "\x00" in value:
            raise ValueError("Unexpected NUL field")
        result[key]=value
    return result


def key_of(table,row):
    return tuple(row[column] for column in PRIMARY_KEYS[table])


def signatures(table,rows):
    out={}
    for row in rows:
        key=key_of(table,row)
        if any(value is None for value in key) or key in out:
            raise ValueError("Duplicate or null public primary key")
        out[key]=canonical(row)
    return out


def query(session,endpoint,sql,params=(),allow_write=False):
    if not sql.startswith(("SELECT ","INSERT INTO ")):
        raise ValueError("Unexpected query")
    if sql.startswith("INSERT INTO ") and not allow_write:
        raise ValueError("Unapproved D1 mutation")
    response=session.post(endpoint,json={"sql":sql,"params":list(params)},timeout=45)
    response.raise_for_status()
    data=response.json()
    if data.get("success") is not True or len(data.get("result",[]))!=1:
        raise RuntimeError("Cloudflare D1 query rejected")
    item=data["result"][0]
    if item.get("success") is not True:
        raise RuntimeError("Cloudflare D1 SQL rejected")
    meta=item.get("meta") or {}
    read=int(meta.get("rows_read",-1))
    written=int(meta.get("rows_written",-1))
    if read<0 or read>15000 or written<0 or written>500:
        raise RuntimeError("Unexpected D1 quota consumption")
    if not allow_write and written!=0:
        raise RuntimeError("Read-only audit wrote to D1")
    return item.get("results",[]),read,written


def count_table(session,endpoint,name):
    if name not in PUBLIC_TABLES and name not in OTHER_TABLES:
        raise ValueError("Unexpected database table")
    rows,reads,written=query(session,endpoint,'SELECT count(*) AS n FROM "'+name+'"')
    if len(rows)!=1 or type(rows[0].get("n")) is not int:
        raise ValueError("Unexpected D1 count result")
    return rows[0]["n"],reads


def fetch_target(session,endpoint,table):
    if table not in PUBLIC_TABLES:
        raise ValueError("Unexpected public table")
    rows,reads,written=query(session,endpoint,'SELECT * FROM "'+table+'" LIMIT 501')
    if len(rows)>500 or not all(isinstance(x,dict) for x in rows):
        raise ValueError("Unexpected D1 public data size")
    return rows,reads


def column_names(rows):
    fields=set(rows[0])
    if not fields or any(not re.fullmatch("[a-z][a-z0-9_]*",v) for v in fields):
        raise ValueError("Unexpected source column")
    if any(set(x)!=fields for x in rows):
        raise ValueError("Inconsistent source column sets")
    return sorted(fields)


def insert_rows(session,endpoint,table,rows):
    # Batch small enough to avoid oversized D1 HTTP request / SQL statement.
    # Exactly ONE bound parameter is used per table batch via SQLite JSON1.
    # No individual source row is put in a GitHub log or an artifact.
    if table not in PUBLIC_TABLES:
        raise ValueError("Forbidden destination table")
    cols=column_names(rows)
    q='"'+table+'"'
    column_sql=",".join('"'+c+'"' for c in cols)
    expressions=",".join("json_extract(value,'$."+c+"')" for c in cols)
    sql="INSERT INTO "+q+" ("+column_sql+") SELECT "+expressions+" FROM json_each(?)"
    if len(sql.encode())>100000:
        raise ValueError("SQL too large")
    inserted=0
    used=0
    for start in range(0,len(rows),20):
        batch=rows[start:start+20]
        serialized=json.dumps(batch,ensure_ascii=False,separators=(",",":"))
        if len(serialized.encode())>400000:
            raise ValueError("Bound JSON too large")
        _,read,write=query(session,endpoint,sql,[serialized],allow_write=True)
        if write<len(batch) or write>len(batch)*8:
            # Index maintenance can increase counted rows_written; never
            # silently accept zero writes or implausibly large usage.
            raise RuntimeError("Unexpected D1 write accounting")
        inserted+=len(batch)
        used+=write
    return inserted,used


def main():
    root,db=check_env()
    cf=requests.Session()
    cf.headers.update({"Authorization":"Bearer "+os.environ["CLOUDFLARE_API_TOKEN"],
                       "Content-Type":"application/json"})
    meta=cf.get(root+"/d1/database/"+db,timeout=30)
    meta.raise_for_status()
    data=meta.json()
    ident=data.get("result") or {}
    if (data.get("success") is not True or
        ident.get("name")!=TARGET or ident.get("jurisdiction")!="eu" or
        str(ident.get("uuid","")).lower()!=db.lower()):
        raise RuntimeError("New EU D1 identity check failed")
    bucket=cf.get(root+"/r2/buckets/"+TARGET,timeout=30)
    bucket.raise_for_status()
    b=bucket.json()
    if (b.get("success") is not True or
        (b.get("result") or {}).get("name")!=TARGET or
        (b.get("result") or {}).get("storage_class")!="Standard"):
        raise RuntimeError("Production R2 identity check failed")

    source=requests.Session()
    source.headers.update({
        "apikey":os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        "Authorization":"Bearer "+os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    })
    origin=os.environ["SUPABASE_URL"].rstrip("/")
    sources={}
    for table in PUBLIC_TABLES:
        rows=list(fetch_table(source,origin,table,page_size=500))
        if len(rows)!=COUNTS[table]:
            raise ValueError("Source public programme changed; verify before import")
        sources[table]=rows
    # Compare full source programme for consistency before sending any rows.
    source_totals=sum(len(r) for r in sources.values())
    if source_totals!=456:
        raise ValueError("Unexpected public rows")
    endpoint=root+"/d1/database/"+db+"/query"

    extra={}
    usage_reads=0
    for table in OTHER_TABLES:
        n,read=count_table(cf,endpoint,table)
        usage_reads+=read
        extra[table]=n
        if n!=0:
            raise ValueError("Unexpected prior data outside public programme")
    pending={}
    preexisting=0
    for table in PUBLIC_TABLES:
        existing,read=fetch_target(cf,endpoint,table)
        usage_reads+=read
        src=signatures(table,sources[table])
        dest=signatures(table,existing)
        for pk,row in dest.items():
            if pk not in src or row!=src[pk]:
                raise ValueError("Existing target public record differs from source")
        missing=[row for pk,row in src.items() if pk not in dest]
        pending[table]=missing
        preexisting+=len(dest)
    if usage_reads>25000:
        raise ValueError("Unexpected preflight read usage")
    print("PRODUCTION_PUBLIC_PROGRAMME_PREFLIGHT "+json.dumps({
        "source_public_tables":9,"source_public_rows":source_totals,
        "previously_mirrored_public_rows":preexisting,
        "pending_public_rows":sum(len(v) for v in pending.values()),
        "nonpublic_tables_remaining_empty":len(OTHER_TABLES),
        "source_mutations":0,"dns_mutations":0,"worker_deployments":0
    },sort_keys=True),flush=True)
    copied=0
    quota_writes=0
    for table in PUBLIC_TABLES:
        if pending[table]:
            new,used=insert_rows(cf,endpoint,table,pending[table])
            copied+=new
            quota_writes+=used
        # Ensure each completed table agrees field-by-field (not just count).
        verified,read=fetch_target(cf,endpoint,table)
        actual=signatures(table,verified)
        wanted=signatures(table,sources[table])
        if actual!=wanted:
            raise RuntimeError("Public content rows do not match source")
        usage_reads+=read
        print("PRODUCTION_PUBLIC_PROGRAMME_TABLE_VERIFIED "+json.dumps({
            "table":table,"rows":len(verified),
            "copied_this_run":len(pending[table])
        },sort_keys=True),flush=True)

    fk,read,written=query(cf,endpoint,"SELECT 1 AS ok WHERE NOT EXISTS (SELECT 1 FROM pragma_foreign_key_check)")
    usage_reads+=read
    if fk!=[{"ok":1}]:
        raise RuntimeError("D1 foreign key validation failed")
    if copied+preexisting!=456 or quota_writes>5000 or usage_reads>50000:
        raise RuntimeError("Programme import exceeds approved bounds")
    print("PRODUCTION_PUBLIC_PROGRAMME_IMPORT_VERIFIED "+json.dumps({
        "source_public_rows":456,
        "production_tables_imported":9,
        "production_public_rows_verified":copied+preexisting,
        "copied_this_run":copied,
        "all_fields_equal_to_source":True,
        "foreign_keys_valid":True,
        "db_rows_written_reported":quota_writes,
        "db_rows_read_reported":usage_reads,
        "source_writes":0,
        "other_10_tables_writes":0,
        "worker_deployed":False,
        "dns_changed":False,
        "final_live_sync_still_required":True
    },sort_keys=True),flush=True)


if __name__=="__main__":
    try:
        main()
    except BaseException as exc:
        # NEVER echo SQL, response text, private content, URLs, or secrets.
        print("PRODUCTION_PUBLIC_PROGRAMME_IMPORT_STOP category="+type(exc).__name__,
              file=sys.stderr)
        raise SystemExit(1)
