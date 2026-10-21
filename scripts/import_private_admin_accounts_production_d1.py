#!/usr/bin/env python3
"""Migration of private admin metadata and historic participant to isolated EU D1.

Never migrate admin/participant sessions or Supabase Auth's shared user rows.
Never print raw email, salts, verifier hashes, answers, question names,
document bodies, SQL params, or HTTP response payloads.

The existing source participant PBKDF2 hashes are irreversibly SHA256-wrapped
as proved in prior staging tests: preserving login compatibility while not
storing directly replayable source verifiers.
"""
import hashlib
import json
import os
import re
import sys

import requests

from migration.export_celebrations_readonly import fetch_table
from scripts.import_public_programme_production_d1 import check_env,query,canonical,signatures,column_names

ORIGIN="jwyayfkssyagvnablttg.supabase.co"
EXPECTED={
    "celebrations_participants":1,
    "celebrations_user_profiles":0,
    "celebrations_footer_drafts":0,
}
SENSITIVE={"password_hash","answer_1_hash","answer_2_hash"}
CHECK_ONLY_SESSIONS=("celebrations_admin_sessions","celebrations_participant_sessions")


def converted_participant(row):
    value=canonical(row)
    required={
        "email","password_salt","password_hash","answer_1_salt","answer_1_hash",
        "answer_2_salt","answer_2_hash","question_1","question_2",
        "recovery_failed_count","recovery_locked_until","created_at",
        "registered_at","updated_at","audience"
    }
    if set(value)!=required:
        raise ValueError("Unexpected participant columns; source may have changed")
    if (not isinstance(value["email"],str) or
        not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+",value["email"])):
        raise ValueError("Invalid account identity")
    salt=value["password_salt"]
    if not isinstance(salt,str) or len(salt)<16 or salt.startswith("client180:"):
        raise ValueError("Unexpected historic verifier format")
    for field in SENSITIVE:
        v=value[field]
        if not isinstance(v,str) or not re.fullmatch(r"[a-fA-F0-9]{64}",v):
            raise ValueError("Unexpected private PBKDF2 verifier")
        value[field]=hashlib.sha256(v.encode("ascii")).hexdigest()
    value["password_salt"]="client180:"+salt
    if not value["answer_1_salt"] or not value["answer_2_salt"]:
        raise ValueError("Missing recovery salts")
    return value


def select_cf(session,endpoint,table):
    if table not in EXPECTED and table not in CHECK_ONLY_SESSIONS:
        raise ValueError("Unexpected private destination table")
    rows,read,_=query(session,endpoint,'SELECT * FROM "'+table+'" LIMIT 20')
    if len(rows)>19:
        raise RuntimeError("Unexpected private table length")
    return rows


def main():
    root,db=check_env()
    prod=requests.Session()
    prod.headers.update({"Authorization":"Bearer "+os.environ["CLOUDFLARE_API_TOKEN"],
                         "Content-Type":"application/json"})
    response=prod.get(root+"/d1/database/"+db,timeout=25)
    response.raise_for_status()
    obj=response.json()
    if (obj.get("success") is not True or
        (obj.get("result") or {}).get("name")!="celebrations-exit-production" or
        (obj.get("result") or {}).get("jurisdiction")!="eu"):
        raise RuntimeError("Destination is not isolated EU production D1")
    endpoint=root+"/d1/database/"+db+"/query"
    src=requests.Session()
    key=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    src.headers.update({"apikey":key,"Authorization":"Bearer "+key})
    url=os.environ["SUPABASE_URL"].rstrip("/")
    originals={}
    for table,expected in EXPECTED.items():
        rows=list(fetch_table(src,url,table,page_size=100))
        if len(rows)!=expected:
            raise RuntimeError("Private source table changed, abort")
        originals[table]=rows
    # Only source admin session COUNTS are reported. Sessions never copied,
    # irrespective of their expiry. The new production admin must log in anew.
    observed_sessions={}
    for table in CHECK_ONLY_SESSIONS:
        rows=list(fetch_table(src,url,table,page_size=100))
        if len(rows)>100:raise RuntimeError("Unexpected old session volume")
        observed_sessions[table]=len(rows)
        if select_cf(prod,endpoint,table):
            raise RuntimeError("Refusing existing copied sessions in new environment")
    participants=[converted_participant(row) for row in originals["celebrations_participants"]]
    planned={
        "celebrations_participants":participants,
        "celebrations_user_profiles":[canonical(row) for row in originals["celebrations_user_profiles"]],
        "celebrations_footer_drafts":[canonical(row) for row in originals["celebrations_footer_drafts"]],
    }
    pending={}
    for table,rows in planned.items():
        existing=select_cf(prod,endpoint,table)
        srcmap=signatures(table,rows)
        dstmap=signatures(table,existing)
        for k,value in dstmap.items():
            if k not in srcmap or srcmap[k]!=value:
                raise RuntimeError("Existing private destination record differs from source")
        pending[table]=[v for k,v in srcmap.items() if k not in dstmap]
    print("PRIVATE_ACCOUNT_ADMIN_D1_PREFLIGHT "+json.dumps({
        "historic_participants":len(participants),
        "footer_drafts":len(planned["celebrations_footer_drafts"]),
        "user_profiles":len(planned["celebrations_user_profiles"]),
        "active_source_session_rows_not_to_copy":sum(observed_sessions.values()),
        "source_auth_users_untouched":True,"session_tokens_migrated":0,
        "source_writes":0,"worker_deployed":False,"dns_changed":False
    },sort_keys=True),flush=True)
    for table in EXPECTED:
        missing=pending[table]
        if missing:
            cols=column_names(missing)
            sql='INSERT INTO "'+table+'" ('+','.join('"'+c+'"' for c in cols)+') VALUES ('+','.join("?" for _ in cols)+')'
            if len(missing)!=1 or table!="celebrations_participants":
                raise ValueError("Unapproved private database batch")
            # Bound parameters are encrypted at transport and never logged.
            _,read,write=query(prod,endpoint,sql,[missing[0][c] for c in cols],allow_write=True)
            if write<1 or write>5:
                raise RuntimeError("Unexpected account write count")
        verified=select_cf(prod,endpoint,table)
        if signatures(table,verified)!=signatures(table,planned[table]):
            raise RuntimeError("Admin or account data differs after import")
    if any(select_cf(prod,endpoint,table) for table in CHECK_ONLY_SESSIONS):
        raise RuntimeError("Previous login sessions unexpectedly present")
    print("PRIVATE_ACCOUNT_ADMIN_D1_IMPORT_VERIFIED "+json.dumps({
        "historic_participant_accounts":1,
        "password_verifiers_irreversibly_wrapped_sha256":True,
        "recovery_verifiers_irreversibly_wrapped_sha256":True,
        "footer_drafts":0,"user_profiles":0,
        "source_admin_sessions_not_migrated":observed_sessions["celebrations_admin_sessions"],
        "source_participant_sessions_not_migrated":observed_sessions["celebrations_participant_sessions"],
        "new_production_sessions":0,
        "source_auth_unchanged":True,
        "private_source_mutations":0,"worker_deployed":False,"dns_changed":False,
        "human_password_test_not_performed":True
    },sort_keys=True),flush=True)


if __name__=="__main__":
    try:main()
    except BaseException as err:
        print("PRIVATE_ACCOUNT_ADMIN_D1_IMPORT_STOP category="+type(err).__name__,file=sys.stderr)
        raise SystemExit(1)
