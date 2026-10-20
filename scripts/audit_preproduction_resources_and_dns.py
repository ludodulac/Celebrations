#!/usr/bin/env python3
"""Steps 7/8: inspect production resource isolation and privately back up DNS.

All Cloudflare API calls are GET. Only possible mutation is ONE encrypted,
unlisted object PUT in the already-private staging R2 backup namespace if full
DNS zone access exists. No plaintext is ever written to disk / job artifacts.
No DNS edits, Worker changes, database/storage resource creations or D1 queries.
"""
import datetime
import hashlib
import json
import os
import re
import secrets
from urllib.parse import urlsplit
import requests

ACCOUNT_RE=re.compile(r"^[0-9a-f]{32}$",re.I)
ACCOUNT_API="https://api.cloudflare.com/client/v4"
DOMAIN="ronde-des-archanges-universelle.eu"
PRODUCTION_D1="celebrations-exit-production"
PRODUCTION_R2="celebrations-exit-production"
STAGING_D1="celebrations-exit-staging"
STAGING_R2="celebrations-exit-staging"
MAGIC=b"CELEBRATIONS-DNS-ROLLBACK-AESGCM-V1\x00"


def sanitized_access(api,url,params=None):
    """Return complete success result, or no data on permission/network error."""
    try:
        r=api.get(url,params=params,timeout=25)
        if r.status_code!=200:return None
        data=r.json()
        if data.get("success") is not True or not isinstance(data.get("result"),list):
            return None
        return data
    except (requests.RequestException,ValueError,KeyError):
        return None


def paged_cloudflare(api,url,params=None,maxpages=30):
    """Never treat a partial DNS records listing as a complete backup."""
    results=[]
    for page in range(1,maxpages+1):
        query={"per_page":"100","page":str(page),**(params or {})}
        response=sanitized_access(api,url,query)
        if response is None:return None
        batch=response["result"]
        results.extend(batch)
        info=response.get("result_info") or {}
        if info.get("total_pages"):
            total=int(info["total_pages"])
            if total>maxpages:raise ValueError("Exceeded records pagination bound")
            if page>=total:
                return results
        elif len(batch)<100:
            return results
    raise ValueError("Records pagination unbounded")


def encrypt_snapshot(plaintext,password):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    if len(password)<32:
        raise ValueError("Missing strong DNS backup key")
    salt=secrets.token_bytes(16)
    nonce=secrets.token_bytes(12)
    key=hashlib.scrypt(password.encode("utf-8"),salt=salt,n=2**15,r=8,p=1,
                       dklen=32,maxmem=128*1024*1024)
    return MAGIC+salt+nonce+AESGCM(key).encrypt(nonce,plaintext,MAGIC)


def verify_snapshot(ciphertext,password):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    if not ciphertext.startswith(MAGIC):raise ValueError("Invalid DNS ciphertext")
    raw=ciphertext[len(MAGIC):]
    if len(raw)<16+12+16:raise ValueError("Short DNS ciphertext")
    key=hashlib.scrypt(password.encode("utf-8"),salt=raw[:16],n=2**15,r=8,p=1,
                       dklen=32,maxmem=128*1024*1024)
    data=AESGCM(key).decrypt(raw[16:28],raw[28:],MAGIC)
    backup=json.loads(data)
    if backup.get("domain")!=DOMAIN or not backup.get("dns_records"):
        raise ValueError("Unexpected DNS backup contents")
    return len(backup["dns_records"])


def audit():
    if os.environ.get("GITHUB_REF")!="refs/heads/feat/celebrations-supabase-exit-001":
        raise ValueError("Invalid audit branch")
    if os.environ.get("STAGING_R2_BUCKET")!=STAGING_R2:
        raise ValueError("Refusing a production destination")
    account=os.environ["CLOUDFLARE_ACCOUNT_ID"]
    if not ACCOUNT_RE.fullmatch(account):raise ValueError("Invalid account")
    token=os.environ["CLOUDFLARE_API_TOKEN"]
    api=requests.Session()
    api.headers.update({"Authorization":"Bearer "+token,"Accept":"application/json"})
    endpoint=ACCOUNT_API+"/accounts/"+account
    d1=paged_cloudflare(api,endpoint+"/d1/database")
    buckets=paged_cloudflare(api,endpoint+"/r2/buckets")
    # R2 bucket-list API may use a cursor instead of pagination: report
    # presence only when a parseable full response was returned.
    prod_d1=bool(d1 is not None and any(d.get("name")==PRODUCTION_D1 for d in d1))
    prod_r2=bool(buckets is not None and any(b.get("name")==PRODUCTION_R2 for b in buckets))
    present_stage_db=bool(d1 is not None and any(d.get("name")==STAGING_D1 for d in d1))
    present_stage_r2=bool(buckets is not None and any(b.get("name")==STAGING_R2 for b in buckets))
    print("CUTOVER_7_CLOUDFLARE_RESOURCES "+json.dumps({
        "account_d1_inventory_readable":d1 is not None,
        "account_r2_inventory_readable":buckets is not None,
        "staging_d1_present":present_stage_db if d1 is not None else None,
        "staging_r2_present":present_stage_r2 if buckets is not None else None,
        "distinct_production_d1_present":prod_d1 if d1 is not None else None,
        "distinct_production_r2_present":prod_r2 if buckets is not None else None,
        "resources_created_by_this_audit":0,"d1_queries":0
    },sort_keys=True),flush=True)
    zones=paged_cloudflare(api,ACCOUNT_API+"/zones",{"name":DOMAIN})
    candidate=[] if zones is None else [z for z in zones if z.get("name")==DOMAIN]
    if len(candidate)!=1:
        print("CUTOVER_8_DNS_DISCOVERY "+json.dumps({
            "full_dns_snapshot_captured":False,
            "zone_readable_with_existing_token":zones is not None,
            "zone_visible_to_account":bool(candidate) if zones is not None else None,
            "dns_source_of_truth_unconfirmed":True,
            "dns_modified":False
        },sort_keys=True),flush=True)
        return
    zone_id=candidate[0].get("id")
    if not re.fullmatch("[0-9a-f]{32}",str(zone_id),re.I):
        raise ValueError("Invalid zone id")
    records=paged_cloudflare(api,ACCOUNT_API+"/zones/"+zone_id+"/dns_records")
    routes=paged_cloudflare(api,ACCOUNT_API+"/zones/"+zone_id+"/workers/routes")
    if records is None or len(records)==0 or routes is None:
        print("CUTOVER_8_DNS_DISCOVERY "+json.dumps({
            "full_dns_snapshot_captured":False,
            "zone_readable_with_existing_token":True,
            "all_dns_records_readable":records is not None,
            "all_worker_routes_readable":routes is not None,
            "dns_source_of_truth_unconfirmed":True,
            "dns_modified":False
        },sort_keys=True),flush=True)
        return
    # Capture complete raw DNS record objects + active Worker routes and
    # original zone settings needed for rollback. No value ever printed.
    now=datetime.datetime.now(datetime.timezone.utc)
    backup={
      "domain":DOMAIN,"captured_utc":now.isoformat(),
      "zone_metadata":candidate[0],
      "dns_records":records,"worker_routes":routes,
      "scope":"Cloudflare zone DNS and Worker routes; registrar / SSL outside scope"
    }
    payload=json.dumps(backup,ensure_ascii=False,sort_keys=True,separators=(",",":")).encode()
    encrypted=encrypt_snapshot(payload,os.environ["CELEBRATIONS_BACKUP_PASSPHRASE"])
    import boto3
    from botocore.config import Config
    r2_endpoint=os.environ["R2_ENDPOINT"].rstrip("/")
    parsed=urlsplit(r2_endpoint)
    if(parsed.scheme!="https" or parsed.hostname!=account+".r2.cloudflarestorage.com" or
       parsed.path or parsed.query or parsed.fragment):
        raise ValueError("Unapproved private storage endpoint")
    r2=boto3.client("s3",region_name="auto",endpoint_url=r2_endpoint,
       aws_access_key_id=os.environ["STAGING_R2_ACCESS_KEY_ID"],
       aws_secret_access_key=os.environ["STAGING_R2_SECRET_ACCESS_KEY"],
       config=Config(retries={"max_attempts":2,"mode":"standard"}))
    key="private-backups/dns-rollback-"+now.strftime("%Y%m%dT%H%M%SZ")+"-"+secrets.token_hex(8)+".dnsbackup"
    r2.put_object(Bucket=STAGING_R2,Key=key,Body=encrypted,IfNoneMatch="*",
         ContentType="application/octet-stream",CacheControl="private, no-store",
         Metadata={"encrypted":"aes256gcm","kind":"dns-rollback"})
    remote=r2.get_object(Bucket=STAGING_R2,Key=key)["Body"].read()
    if hashlib.sha256(remote).digest()!=hashlib.sha256(encrypted).digest():
        raise RuntimeError("Encrypted DNS backup R2 verification failed")
    if verify_snapshot(remote,os.environ["CELEBRATIONS_BACKUP_PASSPHRASE"])!=len(records):
        raise RuntimeError("Encrypted DNS backup integrity failure")
    print("CUTOVER_8_PRIVATE_DNS_BACKUP_PASS "+json.dumps({
       "dns_records_backed_up":len(records),
       "worker_routes_backed_up":len(routes),
       "encrypted_bytes":len(encrypted),
       "bucket":STAGING_R2,
       "object_key":key,
       "ciphertext_roundtrip_verified":True,
       "registrar_and_ssl_backup_included":False,
       "dns_modified":False,"d1_queries":0
    },sort_keys=True),flush=True)


if __name__=="__main__":
    try:audit()
    except BaseException as exc:
        # Errors from Cloudflare can reveal private DNS TXT records or auth
        # context; log only exception category (never message or traceback).
        print("CUTOVER_789_PREFLIGHT_FAIL category="+type(exc).__name__)
        raise SystemExit(1)
