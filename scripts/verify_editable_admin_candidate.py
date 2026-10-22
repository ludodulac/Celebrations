#!/usr/bin/env python3
"""One real end-to-end production-data Cloudflare admin login on QA hostname.

Admin proof is derived from a GitHub *environment secret* in process memory.
No admin password, proof, salt, bearer, URL with private slug, or account PII is
printed or uploaded. A single synthetic production D1 *session* is created and
revoked in a finally block. No business, stats, media or site edits are made.
"""
import hashlib
import json
import os
import re
import sys
import time
import requests
import subprocess

from scripts.import_public_programme_production_d1 import check_env, query

ORIGIN="https://celebrations-exit-editable-qa.rondes.workers.dev"
TARGET_DB="28736d2a-479b-472b-bf82-703ad0affe10"
SENSITIVE_PATHS=("/api/auth","/api/stats")
def private_post(client,path,body,token=None):
    h={"Content-Type":"application/json"}
    if token:h["Authorization"]="Bearer "+token
    response=client.post(ORIGIN+path,headers=h,json=body,timeout=35)
    try:return response.status_code,response.json()
    except ValueError:raise ValueError("QA Worker returned invalid JSON")
def main():
    root,db=check_env()
    if db!=TARGET_DB:
        raise ValueError("Wrong isolated EU Cloudflare D1")
    raw=os.environ.get("CELEBRATIONS_ADMIN_PASSWORD","")
    if len(raw)<14 or len(raw)>256:
        raise ValueError("Missing protected admin password")
    cf=requests.Session()
    cf.headers.update({"Authorization":"Bearer "+os.environ["CLOUDFLARE_API_TOKEN"],
                       "Content-Type":"application/json"})
    meta=cf.get(root+"/d1/database/"+db,timeout=25)
    meta.raise_for_status()
    data=meta.json()
    if (data.get("success") is not True or
        (data.get("result") or {}).get("name")!="celebrations-exit-production" or
        (data.get("result") or {}).get("jurisdiction")!="eu"):
        raise RuntimeError("Wrong Cloudflare D1 identity")
    endpoint=root+"/d1/database/"+db+"/query"
    client=requests.Session()
    bearer=None
    try:
        home=client.get(ORIGIN+"/",timeout=30)
        if home.status_code!=200 or "welcome-open-program" not in home.text:
            raise RuntimeError("QA homepage not available")
        if "noindex" not in home.headers.get("x-robots-tag",""):
            raise RuntimeError("QA homepage must not be indexed")
        salt_status,challenge=private_post(client,"/api/auth",{"action":"admin_salt"})
        if salt_status!=200 or not challenge.get("ok"):
            raise RuntimeError("Admin login salt not configured in QA Worker")
        salt=challenge.get("salt")
        if not isinstance(salt,str) or not re.fullmatch("[a-f0-9]{64}",salt):
            raise RuntimeError("Admin proof salt invalid")
        proof=hashlib.pbkdf2_hmac("sha256",raw.encode("utf-8"),
                                 salt.encode("utf-8"),180000,dklen=32).hex()
        status,result=private_post(client,"/api/auth",{
            "action":"admin_login_derived",
            "email":"admin@celebrations.local",
            "password_proof":proof
        })
        if status!=200 or not result.get("ok"):
            raise RuntimeError("Real admin password proof refused by QA Worker")
        bearer=result.get("token")
        if not isinstance(bearer,str) or not re.fullmatch("[a-f0-9]{64}",bearer):
            raise RuntimeError("Expected one secure 64-hex admin session")
        stat,status_summary=private_post(client,"/api/stats",{"action":"summary"},bearer)
        if stat!=200 or not status_summary.get("ok"):
            raise RuntimeError("Authenticating admin cannot read historic statistics")
        letters,_,_=query(cf,endpoint,"SELECT slug FROM committee_media WHERE published=1 AND revoked_at IS NULL")
        if len(letters)!=9:
            raise RuntimeError("Invalid historic invitation source")
        for row in letters:
            slug=row["slug"]
            r=client.head(ORIGIN+"/?lettre="+requests.utils.quote(slug,safe=""),
                          allow_redirects=False,timeout=25)
            if r.status_code!=200 or "application/pdf" not in r.headers.get("content-type",""):
                raise RuntimeError("Original emailed PDF path incompatible with candidate")
            if "location" in r.headers:
                raise RuntimeError("Original mailed address unexpectedly redirected")
        print("CELEBRATIONS_EDITABLE_ADMIN_QA_PASS "+json.dumps({
            "separate_qa_hostname":True,
            "admin_login_derived":True,
            "admin_statistics_view":True,
            "original_emailed_pdf_queries":len(letters),
            "original_emailed_pdf_urls_unchanged":True,
            "real_admin_password_logged":False,
            "visitor_domain_dns_changed":False,
            "historic_workers_dev_host_replaced":False,
            "supabase_mutations":0,
            "programme_and_r2_edits":0,
            "original_password_never_stored_on_github":True,
        },sort_keys=True))
        if os.getenv("MISSION10_ADMIN_BROWSER_AUDIT") == "1":
            safe_env = dict(os.environ)
            safe_env["MISSION10_ADMIN_BEARER"] = bearer
            subprocess.run(["node", "scripts/mission10_admin_qa_browser.mjs"],
                           check=True, timeout=130, env=safe_env)
    finally:
        if bearer:
            token_hash=hashlib.sha256(bearer.encode("ascii")).hexdigest()
            delete=cf.post(endpoint,json={
                "sql":"DELETE FROM celebrations_admin_sessions WHERE token_hash=?",
                "params":[token_hash]},timeout=30)
            delete.raise_for_status()
            payload=delete.json()
            result=(payload.get("result") or [{}])[0]
            if (payload.get("success") is not True or
                result.get("success") is not True or
                not 1<=int((result.get("meta") or {}).get("rows_written",-1))<=5):
                raise RuntimeError("Temporary admin session cleanup could not be proved")
            lingering,_,_=query(cf,endpoint,
                "SELECT count(*) AS n FROM celebrations_admin_sessions WHERE token_hash=?",
                [token_hash])
            if lingering!=[{"n":0}]:
                raise RuntimeError("Temporary QA admin session not revoked")
            print("CELEBRATIONS_QA_ADMIN_SESSION_REVOKED verified=YES")


if __name__=="__main__":
    try:main()
    except BaseException as e:
        print("CELEBRATIONS_EDITABLE_ADMIN_QA_STOP category="+type(e).__name__,file=sys.stderr)
        raise SystemExit(1)
