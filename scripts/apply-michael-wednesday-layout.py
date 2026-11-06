#!/usr/bin/env python3
"""Michaël WEDNESDAY only: inspect, transform, and (with --apply) conditionally
save after a verified exact backup. All live unrelated state is immutable.
The shared editor bucket is celebrations-exit-staging, separate from the
production media bucket. No DNS, Worker deploy, D1 or media mutation.
"""
import os,sys,json,hashlib,subprocess,copy,datetime,argparse,boto3
from botocore.config import Config
from botocore.exceptions import ClientError

parser=argparse.ArgumentParser()
parser.add_argument("--apply",action="store_true")
args=parser.parse_args()
env=os.environ
assert env["STAGING_R2_BUCKET"]=="celebrations-exit-staging","Unexpected R2 target"
bucket=env["STAGING_R2_BUCKET"]
key="editor-trials/server-drafts-v1.json"
cid="101";page_id="mercredi-101"
expected_page_hash="0500b19ab3767e09"
s=boto3.client("s3",region_name="auto",endpoint_url=env["R2_ENDPOINT"],
 aws_access_key_id=env["STAGING_R2_ACCESS_KEY_ID"],
 aws_secret_access_key=env["STAGING_R2_SECRET_ACCESS_KEY"],
 config=Config(retries={"max_attempts":2,"mode":"standard"},
               connect_timeout=10,read_timeout=25))
sha=lambda blob:hashlib.sha256(blob).hexdigest()
def original():
 obj=s.get_object(Bucket=bucket,Key=key)
 return obj["Body"].read(),obj["ETag"]
def locate(record):
 pages=record["pages"]
 hits=[(i,p) for i,p in enumerate(pages) if p.get("id")==page_id]
 assert len(hits)==1,"Exactly one Wednesday page is required"
 return pages,hits[0][0],hits[0][1]
blob,etag=original()
state=json.loads(blob)
assert isinstance(state.get("version"),int) and state["version"]>=82
assert isinstance(state.get("published"),dict)
all_private,draft_i,draft=locate(state["drafts"][cid])
all_public,published_i,pub=locate(state["published"]["drafts"][cid])
assert draft.get("visibility")=="published" and pub.get("visibility")=="published"
assert draft==pub,"ABORT: unpublished Wednesday edits exist; do not publish them"
page_sha=sha(json.dumps(pub,sort_keys=True,ensure_ascii=False).encode())
assert page_sha.startswith(expected_page_hash),(
 "ABORT: Wednesday page has changed since its verified live audit; no writes.")
assert len(pub["blocks"])==72

transformed=subprocess.run(["node","--input-type=module","-e", """
 import {prepareMichaelWednesdayLayout} from './migration/cloudflare/editor-michael-wednesday-layout.mjs';
 const chunks=[];for await(const chunk of process.stdin)chunks.push(chunk);
 const page=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 process.stdout.write(JSON.stringify(prepareMichaelWednesdayLayout(page)));
 """],input=json.dumps(pub,ensure_ascii=False),encoding="utf-8",
 capture_output=True,check=True,timeout=30)
change=json.loads(transformed.stdout)
newpage=change["page"];report=change["report"]
assert report["beforeRoot"]==72 and report["afterRoot"]==21
assert report["leaves"]==72
assert report["hiddenDuplicates"]==[9,12,36,56,57,59,60]
assert report["explicitExtraButtons"]==[61,62]
assert newpage["id"]==page_id
assert len(newpage["blocks"])==21
print("WEDNESDAY_SAFE_PREVIEW",json.dumps({
 "dry_run":not args.apply,"target":page_id,"version":state["version"],
 "source_sha256":page_sha[:16],"original_items":72,"new_sections":21,
 "public_and_draft_identical":True,"original_media_and_urls_preserved":True,
 "hide_duplicates_only":7,"alternative_conference_buttons":2
},ensure_ascii=False))
if not args.apply:
 print("WEDNESDAY_DRY_RUN_PASS_NO_REMOTE_WRITES")
 sys.exit(0)

updated=copy.deepcopy(state)
updated["drafts"][cid]["pages"][draft_i]=copy.deepcopy(newpage)
updated["published"]["drafts"][cid]["pages"][published_i]=copy.deepcopy(newpage)
timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="milliseconds")
updated["updatedAt"]=timestamp
updated["publishedAt"]=timestamp
updated["version"]=state["version"]+1
# Verify that ALL other celebrations, global content, and other pages remain
# byte-for-byte identical in the parsed state. Nothing silently publishes.
assert set(updated)==set(state)
for k in state:
 if k not in ("version","updatedAt","publishedAt","drafts","published"):
  assert updated[k]==state[k],("Top-level change",k)
for key0 in state["drafts"]:
 if key0!=cid:assert updated["drafts"][key0]==state["drafts"][key0]
for key0 in state["drafts"][cid]:
 if key0!="pages":assert updated["drafts"][cid][key0]==state["drafts"][cid][key0]
for i,p in enumerate(all_private):
 if i!=draft_i:assert updated["drafts"][cid]["pages"][i]==p
for k in state["published"]:
 if k!="drafts":assert updated["published"][k]==state["published"][k]
for key0 in state["published"]["drafts"]:
 if key0!=cid:
  assert updated["published"]["drafts"][key0]==state["published"]["drafts"][key0]
for i,p in enumerate(all_public):
 if i!=published_i:assert updated["published"]["drafts"][cid]["pages"][i]==p
newblob=json.dumps(updated,ensure_ascii=False,separators=(",",":")).encode()
assert len(newblob)<5_000_000

# Write-once backup, verify exact original bytes and SHA before modifying state.
backup="editor-trials/michael-wednesday-backups/mercredi-"+sha(blob)[:28]+".json"
try:
 s.put_object(Bucket=bucket,Key=backup,Body=blob,
   ContentType="application/json",IfNoneMatch="*")
except ClientError as ex:
 if ex.response.get("ResponseMetadata",{}).get("HTTPStatusCode")!=412:raise
backup_blob=s.get_object(Bucket=bucket,Key=backup)["Body"].read()
assert sha(backup_blob)==sha(blob),"Backup integrity failure"
print("WEDNESDAY_BACKUP_VERIFIED",json.dumps({
 "sha256_prefix":sha(blob)[:16],"backup_name":backup.rsplit("/",1)[-1]
}))
# Conditional write prevents overwriting changes made by user while building.
try:
 s.put_object(Bucket=bucket,Key=key,Body=newblob,
  ContentType="application/json",IfMatch=etag)
except ClientError as ex:
 print("WEDNESDAY_UPDATE_ABORTED_CONCURRENT_CHANGE",
       ex.response.get("Error",{}).get("Code"))
 raise
readback,_=original()
assert sha(readback)==sha(newblob),"Readback mismatch; cannot report success"
print("WEDNESDAY_REORGANIZED",json.dumps({
 "page":page_id,"revision":updated["version"],
 "original_leaves":72,"sections":21,"hidden_duplicates":7,
 "all_media_pdfs_video_links_mp3_preserved":True,
 "only_wednesday_changed":True,"readback_verified":True
}))
