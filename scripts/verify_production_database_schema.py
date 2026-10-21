#!/usr/bin/env python3
"""Guard D1 schema installation on EMPTY separate production database only.

Pre/post checks use Cloudflare REST; they never inspect or log row values,
credentials, or user data. The only writes in the workflow are 19 CREATE TABLE
statements and indexes in the new empty D1 database, not source/staging or DNS.
"""
import json
import os
import pathlib
import re
import sys

import requests

BASE="https://api.cloudflare.com/client/v4"
STAGING="celebrations-exit-staging"
PROD="celebrations-exit-production"
UUID=re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",re.I)


def expected_tables():
    schema=pathlib.Path("migration/cloudflare/celebrations-schema.sql").read_text()
    acl=pathlib.Path("migration/cloudflare/media-acl.sql").read_text()
    names=set(re.findall(r'CREATE TABLE IF NOT EXISTS "?([a-z][a-z0-9_]*)"?',schema+"\n"+acl))
    if len(names)!=19 or "celebrations_clicks" not in names or "committee_media" not in names:
        raise RuntimeError("Unexpected production schema source")
    return names


def verify_account_list(data,required_name,refused_id):
    rows=data.get("result")
    if data.get("success") is not True or not isinstance(rows,list):
        raise RuntimeError("D1 inventory unavailable")
    matches=[x for x in rows if x.get("name")==required_name]
    if len(matches)!=1:
        raise RuntimeError("Expected exactly one production D1")
    uuid=str(matches[0].get("uuid",""))
    if not UUID.fullmatch(uuid) or uuid==refused_id:
        raise RuntimeError("Unexpected production D1 UUID")
    return uuid


def main(mode):
    if mode not in ("pre","post"):
        raise ValueError("Specify pre or post")
    if os.environ.get("GITHUB_REF")!="refs/heads/feat/celebrations-supabase-exit-001":
        raise RuntimeError("Wrong branch")
    if os.environ.get("STAGING_R2_BUCKET")!=STAGING:
        raise RuntimeError("Wrong staging bucket")
    account=os.environ["CLOUDFLARE_ACCOUNT_ID"]
    if not re.fullmatch(r"[0-9a-f]{32}",account,re.I):
        raise RuntimeError("Unexpected Cloudflare account")
    sid=os.environ["STAGING_D1_ID"]
    if not UUID.fullmatch(sid):
        raise RuntimeError("Invalid staging ID")
    root=BASE+"/accounts/"+account
    session=requests.Session()
    session.headers.update({"Authorization":"Bearer "+os.environ["CLOUDFLARE_API_TOKEN"]})
    inv=session.get(root+"/d1/database",timeout=25)
    inv.raise_for_status()
    prod_id=verify_account_list(inv.json(),PROD,sid)
    meta=session.get(root+"/d1/database/"+prod_id,timeout=25)
    meta.raise_for_status()
    info=meta.json()
    if info.get("success") is not True or info.get("result",{}).get("name")!=PROD:
        raise RuntimeError("Production D1 identity mismatch")
    if info.get("result",{}).get("jurisdiction")!="eu":
        raise RuntimeError("Production D1 must be EU jurisdiction")
    bucket=session.get(root+"/r2/buckets/"+PROD,timeout=25)
    bucket.raise_for_status()
    b=bucket.json()
    if b.get("success") is not True or b.get("result",{}).get("name")!=PROD:
        raise RuntimeError("Expected production R2 bucket")
    if b.get("result",{}).get("storage_class")!="Standard":
        raise RuntimeError("Production R2 must use Standard class")
    response=session.post(root+"/d1/database/"+prod_id+"/query",
      json={"sql":"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"},
      timeout=25)
    response.raise_for_status()
    body=response.json()
    if body.get("success") is not True or len(body.get("result",[]))!=1:
        raise RuntimeError("Production D1 schema inspection failed")
    result=body["result"][0]
    if result.get("success") is not True or int((result.get("meta") or {}).get("rows_written",-1))!=0:
        raise RuntimeError("Inspection must not write")
    names={x.get("name") for x in result.get("results",[])}
    expected=expected_tables()
    if mode=="pre" and names:
        raise RuntimeError("Refusing to change nonempty production schema")
    if mode=="post" and names!=expected:
        raise RuntimeError("Production D1 does not have precisely 19 expected tables")
    if mode=="post":
        for table in ("celebrations_contents","celebrations_clicks","celebrations_participants"):
            response=session.post(root+"/d1/database/"+prod_id+"/query",
              json={"sql":'SELECT count(*) AS n FROM "'+table+'"'},timeout=25)
            response.raise_for_status()
            body=response.json()
            if body.get("success") is not True or len(body.get("result",[]))!=1 or (
               len(body["result"][0].get("results",[]))!=1 or
               body["result"][0]["results"][0].get("n")!=0):
                raise RuntimeError("New production tables must remain empty")
    if mode=="pre":
        file=os.environ.get("GITHUB_ENV")
        if not file:
            raise RuntimeError("GitHub environment missing")
        with open(file,"a",encoding="utf8") as stream:
            stream.write("CELEBRATIONS_PROD_D1_ID="+prod_id+"\n")
    print("PRODUCTION_D1_SCHEMA_"+mode.upper()+"_PASS "+json.dumps({
        "expected_tables":19,
        "existing_tables":len(names),
        "jurisdiction":"eu",
        "production_db_separate":True,
        "production_empty_of_participant_and_programme_data":True,
        "dns_changed":False,
        "staging_db_modified":False,
        "supabase_modified":False,
        "production_worker_deployed":False
    },sort_keys=True))


if __name__=="__main__":
    try:main(sys.argv[1])
    except BaseException as error:
        # Only report our OWN fixed control-plane guard messages, never
        # arbitrary HTTP responses, database rows, URLs or credentials.
        safe={
            "Expected exactly one production D1",
            "Unexpected production D1 UUID",
            "Production D1 identity mismatch",
            "Production D1 must be EU jurisdiction",
            "Expected production R2 bucket",
            "Production R2 must use Standard class",
            "Production D1 schema inspection failed",
            "Inspection must not write",
            "Refusing to change nonempty production schema",
            "Production D1 does not have precisely 19 expected tables",
            "New production tables must remain empty",
        }
        msg=str(error) if str(error) in safe else "Unclassified HTTP or schema error"
        print("PRODUCTION_SCHEMA_AUDIT_STOP category="+type(error).__name__+
              " check="+msg.replace(" ","_"),file=sys.stderr)
        raise SystemExit(1)
