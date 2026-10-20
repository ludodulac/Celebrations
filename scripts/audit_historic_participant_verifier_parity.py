#!/usr/bin/env python3
"""Stage 5: real historical participant verifier parity, READ ONLY.

Only one original Supabase account is expected. Compare source fields against
the intentionally wrapped, non-replayable Cloudflare D1 verifier, without
logging email/password hashes, raw salts, recovery answers or query responses.

One source REST GET + Cloudflare D1 identity GET + one staging SELECT, guarded
by prior account-wide D1 quota preflight in GitHub Actions. No login attempts,
session creation, failed-attempt counters, production writes, R2 or DNS.
"""
import datetime
import hashlib
import json
import os
import re
from urllib.parse import urlsplit
import requests

SOURCE_HOST="jwyayfkssyagvnablttg.supabase.co"
STAGING_DATABASE="celebrations-exit-staging"
FIELDS=(
    "email","password_salt","password_hash","question_1","answer_1_salt",
    "answer_1_hash","question_2","answer_2_salt","answer_2_hash",
    "recovery_failed_count","recovery_locked_until","audience","updated_at"
)
SECRET_FIELDS={"email","password_salt","password_hash",
               "answer_1_salt","answer_1_hash","answer_2_salt","answer_2_hash"}


def compare_user(source, dest):
    """Never return sensitive values or field names for failed comparisons."""
    if not isinstance(source,dict) or not isinstance(dest,dict):
        raise ValueError("Invalid participant response")
    if not all(key in source for key in FIELDS):
        raise ValueError("Missing source fields")
    email=source["email"]
    if not isinstance(email,str) or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+",email):
        raise ValueError("Invalid source email")
    if source.get("updated_at"):
        stamp=datetime.datetime.fromisoformat(source["updated_at"].replace("Z","+00:00"))
        if stamp.tzinfo is None or stamp >= datetime.datetime(
                2026,10,19,tzinfo=datetime.timezone.utc):
            raise ValueError("Source account changed since historical migration")
    for col in ("password_hash","answer_1_hash","answer_2_hash"):
        if not isinstance(source[col],str) or not re.fullmatch("[0-9a-fA-F]{64}",source[col]):
            raise ValueError("Legacy verifier invalid")
    if not isinstance(source["password_salt"],str) or len(source["password_salt"]) < 16:
        raise ValueError("Legacy password salt invalid")
    expected={
      "email":email,
      "password_salt":"client180:"+source["password_salt"],
      "question_1":source["question_1"],
      "question_2":source["question_2"],
      "answer_1_salt":source["answer_1_salt"],
      "answer_2_salt":source["answer_2_salt"],
      "audience":source["audience"],
      "recovery_failed_count":source["recovery_failed_count"],
      "recovery_locked_until":source["recovery_locked_until"]
    }
    for col in ("password_hash","answer_1_hash","answer_2_hash"):
        expected[col]=hashlib.sha256(source[col].encode("ascii")).hexdigest()
    for field,value in expected.items():
        if dest.get(field)!=value:
            raise ValueError("Staging participant differs from source-derived record")
    if dest.get("password_hash") == source["password_hash"]:
        raise ValueError("Stored staging password proof can be replayed")
    return {
      "source_historical_accounts":1,
      "staging_historical_accounts_matched":1,
      "password_verifier_wrapped_sha256":True,
      "recovery_verifiers_wrapped_sha256":2,
      "recovery_questions_and_salts_equal":True,
      "source_account_changed_since_oct19":False,
      "real_password_login_by_original_participant": "PENDING",
      "sessions_created":0,"login_attempts_created":0,"source_writes":0,
      "cloudflare_d1_rows_written":0
    }


def main():
    if os.environ.get("GITHUB_REF")!="refs/heads/feat/celebrations-supabase-exit-001":
        raise ValueError("Not the approved migration branch")
    if os.environ.get("STAGING_R2_BUCKET")!=STAGING_DATABASE:
        raise ValueError("Not the approved staging environment")
    base=os.environ["SUPABASE_URL"].rstrip("/")
    u=urlsplit(base)
    if u.scheme!="https" or u.hostname!=SOURCE_HOST or u.path or u.query or u.fragment:
        raise ValueError("Unexpected Supabase origin")
    account=os.environ["CLOUDFLARE_ACCOUNT_ID"]
    db_id=os.environ["STAGING_D1_ID"]
    if not re.fullmatch(r"[0-9a-f]{32}",account,re.I) or not re.fullmatch(r"[0-9a-f-]{36}",db_id,re.I):
        raise ValueError("Invalid staging identifiers")
    cf=f"https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{db_id}"
    cf_headers={"Authorization":"Bearer "+os.environ["CLOUDFLARE_API_TOKEN"]}
    info=requests.get(cf,headers=cf_headers,timeout=25)
    info.raise_for_status()
    meta=info.json()
    if meta.get("success") is not True or meta.get("result",{}).get("name")!=STAGING_DATABASE:
        raise ValueError("Refusing wrong D1 database")
    secret=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    response=requests.get(base+"/rest/v1/celebrations_participants",
       headers={"apikey":secret,"Authorization":"Bearer "+secret},
       params={"select":",".join(FIELDS),"limit":2},timeout=30)
    response.raise_for_status()
    source=response.json()
    if not isinstance(source,list) or len(source)!=1:
        raise ValueError("Expected exactly one original participant")
    select_fields=tuple(field for field in FIELDS if field!="updated_at")
    # This SQL is fixed and only SELECTs a single historical participant row.
    sql=("SELECT "+",".join('"'+field+'"' for field in select_fields)+
         " FROM celebrations_participants WHERE email=? LIMIT 2")
    query=requests.post(cf+"/query",headers=cf_headers,timeout=30,
       json={"sql":sql,"params":[source[0]["email"]]})
    query.raise_for_status()
    data=query.json()
    if data.get("success") is not True or len(data.get("result",[]))!=1:
        raise ValueError("Staging SELECT failed")
    page=data["result"][0]
    if page.get("success") is not True:
        raise ValueError("Staging SELECT failed")
    bill=page.get("meta") or {}
    rows_read=int(bill.get("rows_read",-1))
    rows_written=int(bill.get("rows_written",-1))
    if not 0<=rows_read<=200 or rows_written!=0:
        raise ValueError("D1 query exceeded read-only safety budget")
    records=page.get("results",[])
    if not isinstance(records,list) or len(records)!=1:
        raise ValueError("Expected exactly one staging participant")
    result=compare_user(source[0],records[0])
    result["d1_reported_rows_read"]=rows_read
    # Only safe aggregates leave this runner. No email, salts or hashes.
    print("STAGING_HISTORIC_PARTICIPANT_VERIFIER_PARITY_PASS "+
          json.dumps(result,sort_keys=True))


if __name__=="__main__":
    try:
        main()
    except BaseException as exc:
        # SQL HTTP errors can contain field values; suppress error text/traces.
        print("STAGING_HISTORIC_PARTICIPANT_VERIFIER_PARITY_FAIL category="+
              type(exc).__name__)
        raise SystemExit(1)
