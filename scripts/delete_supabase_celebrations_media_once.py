#!/usr/bin/env python3
"""One-time owner-authorized deletion of ONLY Supabase 'celebrations-media'.

Never delete rows from storage.objects SQL: use Supabase's Storage API so
physical files are really removed. Before ANY DELETE, require exact source
inventory, independent R2 copied inventory, and the previously verified
fresh encrypted restore checkpoint (workflow sequencing).
No other bucket, table, project, auth user, Cloudflare object or DNS touched.
"""
import json,os,sys
from urllib.parse import urlsplit
from scripts.audit_celebrations_media_dual_copy_readonly import (
    SOURCE_BUCKET,STAGING_BUCKET,EXPECTED_FILES,EXPECTED_BYTES,
    source_inventory,r2_inventory,compare_manifests
)

def main():
    if os.environ.get("GITHUB_REF")!="refs/heads/feat/celebrations-supabase-exit-001":raise RuntimeError("Wrong branch")
    if os.environ.get("CELEBRATIONS_DELETE_SOURCE_APPROVAL")!="OWNER_APPROVED_2026_10_28":raise RuntimeError("Owner approval marker absent")
    base=os.environ["SUPABASE_URL"].rstrip("/")
    if base!="https://jwyayfkssyagvnablttg.supabase.co":raise RuntimeError("Incorrect source")
    if os.environ["STAGING_R2_BUCKET"]!="celebrations-exit-staging":raise RuntimeError("Wrong R2 backup bucket")
    if os.environ["PROD_D1_ID"]!="28736d2a-479b-472b-bf82-703ad0affe10":raise RuntimeError("Wrong D1 identity")
    import boto3,requests
    from botocore.config import Config
    account=os.environ["CLOUDFLARE_ACCOUNT_ID"]
    r2endpoint=os.environ["R2_ENDPOINT"].rstrip("/")
    if urlsplit(r2endpoint).hostname!=account+".r2.cloudflarestorage.com":raise RuntimeError("Wrong R2 account")
    r2=boto3.client("s3",endpoint_url=r2endpoint,region_name="auto",
                   aws_access_key_id=os.environ["STAGING_R2_ACCESS_KEY_ID"],
                   aws_secret_access_key=os.environ["STAGING_R2_SECRET_ACCESS_KEY"],
                   config=Config(retries={"max_attempts":2,"mode":"standard"}))
    r2.head_bucket(Bucket=STAGING_BUCKET)
    s=requests.Session()
    key=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    s.headers.update({"apikey":key,"Authorization":"Bearer "+key})
    # A GitHub job cannot delete anything before the fresh encrypted backup
    # checkpoint has succeeded; this env var is set by the workflow only.
    if os.environ.get("CELEBRATIONS_ENCRYPTED_BACKUP_JUST_VERIFIED")!="yes":
        raise RuntimeError("No fresh successful encrypted backup verified in this job")
    source=source_inventory(s,base)
    assert len(source)==EXPECTED_FILES and sum(source.values())==EXPECTED_BYTES
    verified=compare_manifests(source,r2_inventory(r2))
    assert verified["missing_originals"]==0 and verified["mismatched_sizes"]==0
    print("CELEBRATIONS_SOURCE_STORAGE_PREDELETE_PASS "+json.dumps({
        "bucket":SOURCE_BUCKET,"objects":len(source),"bytes":sum(source.values()),
        "r2_originals_verified":verified["r2_original_keys_and_sizes_verified"],
        "other_buckets_mutated":False
    }),flush=True)
    # Use documented Storage API DELETE /object/:bucket with prefixes list.
    keys=sorted(source)
    total=0
    for i in range(0,len(keys),20):
        block=keys[i:i+20]
        result=s.delete(base+"/storage/v1/object/"+SOURCE_BUCKET,
                        json={"prefixes":block},timeout=120)
        result.raise_for_status()
        remain=source_inventory(s,base)
        if any(x in remain for x in block):raise RuntimeError("Storage API batch incomplete")
        if any(x not in source for x in remain):raise RuntimeError("Unexpected concurrent foreign upload: stop")
        total+=len(block)
        print("CELEBRATIONS_SOURCE_STORAGE_DELETE_PROGRESS "+json.dumps({
            "deleted_verified":total,"expected":len(source),"source_remaining":len(remain)
        }),flush=True)
    remaining=source_inventory(s,base)
    if remaining:raise RuntimeError("Bucket not empty; refuse deleting bucket")
    empty_source=s.delete(base+"/storage/v1/bucket/"+SOURCE_BUCKET,timeout=120)
    empty_source.raise_for_status()
    # GET bucket after delete must be missing (404,not auth/security failure).
    check=s.get(base+"/storage/v1/bucket/"+SOURCE_BUCKET,timeout=30)
    if check.status_code!=404:raise RuntimeError("Source bucket still found after deletion")
    # R2 original copies still exist; do not delete from R2 staging.
    preserved=r2_inventory(r2)
    assert all(k in preserved and preserved[k][0]==size for k,size in source.items())
    print("CELEBRATIONS_SUPABASE_STORAGE_DELETION_VERIFIED "+json.dumps({
        "source_bucket_deleted":SOURCE_BUCKET,"original_files_deleted":total,
        "original_bytes_released":sum(source.values()),
        "cloudflare_r2_originals_preserved":len(source),
        "other_source_buckets_deleted":0,"source_tables_deleted":0,
        "cloudflare_mutations":0,"dns_mutations":0,
        "deleted_storage_is_irreversible":True
    }),flush=True)

if __name__=="__main__":
 try:main()
 except BaseException as exc:
    print("CELEBRATIONS_SUPABASE_SOURCE_STORAGE_STOP category="+type(exc).__name__,file=sys.stderr)
    raise SystemExit(1)
