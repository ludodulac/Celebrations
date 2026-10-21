#!/usr/bin/env python3
"""CÉLÉBRATIONS: provision EMPTY and SEPARATE production D1/R2 free-tier resources.

Mutations are LIMITED to the creation of one Cloudflare D1 database and one
EMPTY Standard-class R2 bucket, by exact names. No imports/deploys/DNS/writes
to staging/production data and no changes to Supabase/GitHub main.
Fail closed if account inventories are unreadable, unexpected or at free cap.
"""
import json
import os
import re
import sys

import requests

ACCOUNT_RE=re.compile(r"^[0-9a-f]{32}$",re.I)
UUID_RE=re.compile(r"^[0-9a-f-]{36}$",re.I)
STAGING="celebrations-exit-staging"
PRODUCTION="celebrations-exit-production"


def parse_d1_inventory(body):
    if not isinstance(body,dict) or body.get("success") is not True:
        raise ValueError("Cloudflare D1 inventory unavailable")
    rows=body.get("result")
    if not isinstance(rows,list):
        raise ValueError("Unexpected D1 list response")
    page=body.get("result_info") or {}
    total=int(page.get("total_count",len(rows)))
    if total!=len(rows) or total>10:
        raise ValueError("Partial D1 account inventory; cannot provision safely")
    names=[x.get("name") for x in rows]
    if len(set(names))!=len(names):
        raise ValueError("Ambiguous D1 database names")
    return rows


def parse_r2_inventory(body):
    # Current Cloudflare R2 API returns {result:{buckets:[],cursor?}},
    # rather than the D1 API's bare list of result objects.
    if not isinstance(body,dict) or body.get("success") is not True:
        raise ValueError("Cloudflare R2 inventory unavailable")
    result=body.get("result")
    if not isinstance(result,dict) or not isinstance(result.get("buckets"),list):
        raise ValueError("Unexpected R2 list response")
    if result.get("cursor"):
        raise ValueError("R2 inventory has untraversed cursor; fail closed")
    rows=result["buckets"]
    names=[x.get("name") for x in rows]
    if any(not isinstance(name,str) or not name for name in names):
        raise ValueError("Invalid R2 name")
    if len(names)!=len(set(names)):
        raise ValueError("Ambiguous R2 bucket names")
    return rows


def enforce_safe_inventory(d1,buckets):
    db=[v for v in d1 if v.get("name")==STAGING]
    bs=[v for v in buckets if v.get("name")==STAGING]
    if len(db)!=1 or len(bs)!=1:
        raise ValueError("Cannot confirm the protected staging resources")
    have_prod_db=next((v for v in d1 if v.get("name")==PRODUCTION),None)
    have_prod_bucket=next((v for v in buckets if v.get("name")==PRODUCTION),None)
    if have_prod_db and (not UUID_RE.fullmatch(str(have_prod_db.get("uuid","")))):
        raise ValueError("Unexpected production D1 identity")
    if have_prod_bucket and have_prod_bucket.get("storage_class") not in (None,"Standard"):
        raise ValueError("Refusing nonstandard production R2 storage class")
    if len(d1)>=10 and not have_prod_db:
        raise ValueError("Free-tier D1 maximum 10 databases already reached")
    return have_prod_db,have_prod_bucket


def api_call(session,method,url,body=None):
    response=session.request(method,url,json=body,timeout=35)
    # Do not echo account response text or serialized API error.
    if response.status_code not in (200,201):
        raise RuntimeError("Cloudflare resource API rejected request")
    data=response.json()
    if data.get("success") is not True:
        raise RuntimeError("Cloudflare resource API reported failure")
    return data


def main():
    if os.environ.get("GITHUB_REF")!="refs/heads/feat/celebrations-supabase-exit-001":
        raise ValueError("Refusing any non-migration GitHub branch")
    if os.environ.get("STAGING_R2_BUCKET")!=STAGING:
        raise ValueError("Wrong R2 staging bucket")
    account=os.environ["CLOUDFLARE_ACCOUNT_ID"]
    if not ACCOUNT_RE.fullmatch(account):
        raise ValueError("Invalid account ID")
    endpoint="https://api.cloudflare.com/client/v4/accounts/"+account
    session=requests.Session()
    session.headers.update({
        "Authorization":"Bearer "+os.environ["CLOUDFLARE_API_TOKEN"],
        "Accept":"application/json",
        "Content-Type":"application/json",
    })
    existing_d1=parse_d1_inventory(
        api_call(session,"GET",endpoint+"/d1/database"))
    existing_r2=parse_r2_inventory(
        api_call(session,"GET",endpoint+"/r2/buckets"))
    prod_db,prod_bucket=enforce_safe_inventory(existing_d1,existing_r2)
    print("PRODUCTION_FREE_RESOURCES_PREFLIGHT_OK "+json.dumps({
      "d1_count_before":len(existing_d1),"r2_count_before":len(existing_r2),
      "existing_production_d1":bool(prod_db),
      "existing_production_r2":bool(prod_bucket),
      "production_separate_from_staging":True,
      "r2_storage_class":"Standard",
      "d1_usage_checked_elsewhere":True,
      "dns_mutations":0,"supabase_mutations":0,"production_deploy":False
    },sort_keys=True),flush=True)
    if prod_db is None:
        # Cloudflare Workers Free has a 10-database cap. Database creation
        # incurs no compute-hours charge, but subsequent storage/queries
        # count against the account quotas.
        response=api_call(session,"POST",endpoint+"/d1/database",
             {"name":PRODUCTION,"jurisdiction":"eu"})
        candidate=response.get("result") or {}
        if candidate.get("name")!=PRODUCTION or not UUID_RE.fullmatch(str(candidate.get("uuid",""))):
            raise RuntimeError("Unexpected created D1 response")
        print("PRODUCTION_D1_EMPTY_CREATED verified=true jurisdiction=eu",flush=True)
    else:
        print("PRODUCTION_D1_EXISTED_ALREADY no_mutations=true",flush=True)
    if prod_bucket is None:
        # Create an EMPTY Standard R2 bucket. Never expose its content via
        # public bucket endpoints or bind it to a deployed Worker.
        response=api_call(session,"POST",endpoint+"/r2/buckets",
             {"name":PRODUCTION,"storage_class":"Standard"})
        candidate=response.get("result") or {}
        if candidate.get("name")!=PRODUCTION:
            raise RuntimeError("Unexpected created R2 response")
        print("PRODUCTION_R2_EMPTY_CREATED storage_class=Standard public_access_configured=false",flush=True)
    else:
        print("PRODUCTION_R2_EXISTED_ALREADY no_mutations=true",flush=True)
    d1_after=parse_d1_inventory(
       api_call(session,"GET",endpoint+"/d1/database"))
    r2_after=parse_r2_inventory(
       api_call(session,"GET",endpoint+"/r2/buckets"))
    db,bucket=enforce_safe_inventory(d1_after,r2_after)
    if db is None or bucket is None:
        raise RuntimeError("Created resources not both visible")
    print("PRODUCTION_EMPTY_RESOURCES_CREATED_AND_VERIFIED "+json.dumps({
        "production_d1_exists":True,"production_r2_exists":True,
        "d1_uuid":db["uuid"], # Non-secret resource identifier, needed later.
        "r2_bucket_name":PRODUCTION,
        "staging_resources_untouched":True,
        "production_data_migrated":False,
        "production_worker_deployed":False,
        "dns_changed":False,
        "supabase_changed":False,
        "budget_promise":"no direct paid-plan upgrade or deletion"
    },sort_keys=True),flush=True)


if __name__=="__main__":
    try:
        main()
    except BaseException as error:
        print("PRODUCTION_FREE_RESOURCE_PROVISION_STOP category="+
              type(error).__name__,file=sys.stderr)
        raise SystemExit(1)
