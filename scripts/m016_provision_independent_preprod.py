#!/usr/bin/env python3
"""Provision a separate, EMPTY Cloudflare M016 test database and TWO R2 buckets.

Creates nothing in the official Worker or production DB/media/editor buckets.
Does not deploy a Worker or register routes, domains or public R2 access.
Fail closed on incomplete inventory or unexpected account/version drift.
"""
import json
import os
import re
import sys
import requests

ACCOUNT = "60a7b17758a93fe6681ce998e72ddff0"
LIVE_VERSION = "87dba010-c719-4a52-97c1-027a9c9de9b6"
BRANCH = "refs/heads/feat/celebrations-m016-online-service-safe-backup-20261111"
DATABASE = "celebrations-m016-admin-preprod"
BUCKETS = ("celebrations-m016-admin-media", "celebrations-m016-admin-editor")
LIVE_DB_ID = "28736d2a-479b-472b-bf82-703ad0affe10"
URL = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}"

def main():
    env = os.environ
    if env.get("GITHUB_REF") != BRANCH or env.get("M016_PROVISION_ONLY") != "yes":
        raise ValueError("M016 branch or explicit opt-in invalid")
    if env.get("CLOUDFLARE_ACCOUNT_ID") != ACCOUNT or len(env.get("CLOUDFLARE_API_TOKEN", "")) < 20:
        raise ValueError("Wrong Cloudflare account/credentials")
    session = requests.Session()
    session.headers.update({"Authorization": "Bearer " + env["CLOUDFLARE_API_TOKEN"],
                            "Content-Type": "application/json"})
    def request(method, path, payload=None):
        res = session.request(method, URL + path, json=payload, timeout=35)
        if res.status_code < 200 or res.status_code >= 300:
            raise RuntimeError("Cloudflare request failed: " + method + " HTTP_" + str(res.status_code))
        data = res.json()
        if data.get("success") is not True: raise RuntimeError("Cloudflare API rejected operation")
        return data

    dep = request("GET", "/workers/scripts/celebrations-exit-production/deployments")["result"]["deployments"][0]
    if len(dep.get("versions", [])) != 1 or dep["versions"][0]["version_id"] != LIVE_VERSION or dep["versions"][0].get("percentage") != 100:
        raise RuntimeError("Live Worker version drift — refuse resources")
    print("M016_OFFICIAL_WORKER_UNCHANGED before_provision=true", flush=True)

    ddata = request("GET", "/d1/database")
    dbs = ddata.get("result")
    if not isinstance(dbs, list):
        raise RuntimeError("D1 list invalid")
    total = int((ddata.get("result_info") or {}).get("total_count", len(dbs)))
    if len(dbs) != total or len(dbs) > 10:
        raise RuntimeError("Incomplete D1 inventory — refuse resources")
    db_names = [d.get("name") for d in dbs]
    if len(db_names) != len(set(db_names)):
        raise RuntimeError("Duplicate DB names")
    target_db = next((d for d in dbs if d.get("name") == DATABASE), None)
    if target_db and target_db.get("uuid") == LIVE_DB_ID:
        raise RuntimeError("Refuse production D1 reuse")
    if not target_db and len(dbs) >= 10:
        raise RuntimeError("Cloudflare Free D1 limit")
    bdata = request("GET", "/r2/buckets")
    buckets = bdata.get("result", {}).get("buckets")
    if not isinstance(buckets, list) or bdata.get("result", {}).get("cursor"):
        raise RuntimeError("Incomplete R2 inventory")
    names = [b.get("name") for b in buckets]
    if len(names) != len(set(names)):
        raise RuntimeError("Duplicate R2 bucket names")
    for name in BUCKETS:
        if name in ("celebrations-exit-staging", "celebrations-exit-production"):
            raise RuntimeError("Protected existing bucket")
    print("M016_PROVISION_INVENTORY_PASS empty_targets=" +
          str(int(target_db is None) + sum(n not in names for n in BUCKETS)), flush=True)

    # Provision only approved, exact, separate test resources.
    if target_db is None:
        created = request("POST", "/d1/database", {"name": DATABASE, "jurisdiction": "eu"}).get("result") or {}
        if created.get("name") != DATABASE: raise RuntimeError("D1 creation response unexpected")
        print("M016_TEST_D1_CREATED", flush=True)
    else:
        print("M016_TEST_D1_ALREADY_EXISTS", flush=True)
    for name in BUCKETS:
        if name not in names:
            created = request("POST", "/r2/buckets", {"name": name, "storage_class": "Standard"}).get("result") or {}
            if created.get("name") != name: raise RuntimeError("R2 creation response unexpected")
            print("M016_TEST_R2_CREATED " + name, flush=True)
        else:
            print("M016_TEST_R2_ALREADY_EXISTS " + name, flush=True)

    fresh = request("GET", "/d1/database").get("result") or []
    match = next((d for d in fresh if d.get("name") == DATABASE), None)
    uid = (match or {}).get("uuid", "")
    if not re.fullmatch("[0-9a-f-]{36}", uid) or uid == LIVE_DB_ID:
        raise RuntimeError("Isolated D1 verification failed")
    updated = request("GET", "/r2/buckets").get("result", {}).get("buckets") or []
    if not all(sum(x.get("name") == n for x in updated) == 1 for n in BUCKETS):
        raise RuntimeError("Isolated R2 verification failed")
    dep_after = request("GET", "/workers/scripts/celebrations-exit-production/deployments")["result"]["deployments"][0]
    if dep_after != dep:
        raise RuntimeError("Production Worker drifted during provision")
    print("M016_ISOLATED_RESOURCES_CREATED_AND_VERIFIED " + json.dumps({
        "d1_name":DATABASE, "d1_uuid":uid, "r2_buckets":list(BUCKETS),
        "d1_contains_test_data":False, "worker_deployed":False,
        "protected_bucket_celebrations_exit_staging_untouched":True,
        "production_d1_writes":0,"production_r2_writes":0,
        "production_worker_writes":0,"dns_changes":0
    }), flush=True)

if __name__ == "__main__":
    try: main()
    except Exception as exc:
        print("M016_ISOLATED_PROVISION_STOP category=" + type(exc).__name__, file=sys.stderr)
        sys.exit(1)
