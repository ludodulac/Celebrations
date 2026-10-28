"""Urgent read-only preflight for restoring accidentally deleted legacy storage.
No names, URLs, slugs, or object metadata in logs. No writes.
"""
import os,datetime,json
from urllib.parse import urlsplit
import boto3,requests
from botocore.config import Config

def main():
    assert os.environ.get("GITHUB_REF")=="refs/heads/feat/celebrations-supabase-exit-001"
    assert os.environ["SUPABASE_URL"].rstrip("/")=="https://jwyayfkssyagvnablttg.supabase.co"
    assert os.environ["STAGING_R2_BUCKET"]=="celebrations-exit-staging"
    endpoint=os.environ["R2_ENDPOINT"].rstrip("/")
    assert urlsplit(endpoint).hostname==os.environ["CLOUDFLARE_ACCOUNT_ID"]+".r2.cloudflarestorage.com"
    r2=boto3.client("s3",endpoint_url=endpoint,region_name="auto",
        aws_access_key_id=os.environ["STAGING_R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["STAGING_R2_SECRET_ACCESS_KEY"],
        config=Config(retries={"max_attempts":2,"mode":"standard"}))
    all_items=[]
    for page in r2.get_paginator("list_objects_v2").paginate(Bucket="celebrations-exit-staging"):
        for obj in page.get("Contents",[]):
            all_items.append(obj)
    key=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    s=requests.Session()
    s.headers.update({"apikey":key,"Authorization":"Bearer "+key})
    b=s.get(os.environ["SUPABASE_URL"].rstrip("/")+"/storage/v1/bucket/celebrations-media",timeout=30)
    assert b.status_code in (200,404)
    def metric(a):
        return {"count":len(a),"bytes":sum(int(v["Size"]) for v in a),
            "largest_bytes":max((int(v["Size"]) for v in a),default=0)}
    cutoff=datetime.datetime(2026,10,20,tzinfo=datetime.timezone.utc)
    old=[x for x in all_items if x["LastModified"]<cutoff]
    no_backups=[x for x in all_items if not x["Key"].startswith("private-backups/")]
    old_no_backups=[x for x in no_backups if x["LastModified"]<cutoff]
    formats=[x for x in old_no_backups if x["Key"].lower().endswith((".pdf",".png",".jpg",".jpeg",".webp",".mp3",".m4a",".wav",".mp4",".webm",".gif",".svg"))]
    print("LEGACY_RECOVERY_READONLY_REPORT "+json.dumps({
        "source_bucket_status":b.status_code,
        "expected_original_count":158,"expected_original_bytes":830312417,
        "all_r2":metric(all_items),"before_20_oct":metric(old),
        "without_private_backups":metric(no_backups),
        "before_20_oct_without_backups":metric(old_no_backups),
        "old_common_media_extensions":metric(formats)},sort_keys=True))

if __name__=="__main__":
    try: main()
    except Exception as exc:
        print("LEGACY_RECOVERY_PREFLIGHT_FAILED category="+type(exc).__name__)
        raise SystemExit(1)
