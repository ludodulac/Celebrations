#!/usr/bin/env python3
"""One-page-only protected live transformation after the new UI is deployed.

Write order:
1. Read current editor snapshot from staging R2 used as official EDITOR_BUCKET.
2. Verify draft/published preparation pages are identical and still match the
   audited 51-block source. No other page can be modified.
3. Transform by Node's pure well-tested layout function; compare leaf inventory.
4. Archive the entire ORIGINAL snapshot and verify its SHA256.
5. Conditional If-Match write of exactly one revision, never clobbering edits.
6. Read back every expected byte and check public endpoint renders the page.

No media files, historic D1, authentication secrets or other celebrations change.
"""
import os,sys,json,hashlib,subprocess,copy,datetime,time,urllib.request
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

ENV=os.environ
assert ENV["STAGING_R2_BUCKET"]=="celebrations-exit-staging"
BUCKET=ENV["STAGING_R2_BUCKET"]
KEY="editor-trials/server-drafts-v1.json"
PAGE="preparation-101"
CID="101"
S=boto3.client("s3",region_name="auto",endpoint_url=ENV["R2_ENDPOINT"],
 aws_access_key_id=ENV["STAGING_R2_ACCESS_KEY_ID"],
 aws_secret_access_key=ENV["STAGING_R2_SECRET_ACCESS_KEY"],
 config=Config(retries={"max_attempts":2,"mode":"standard"},
               connect_timeout=10,read_timeout=25))
def digest(blob):return hashlib.sha256(blob).hexdigest()
def fetch():
 result=S.get_object(Bucket=BUCKET,Key=KEY)
 return result["Body"].read(),result["ETag"]
def locate(state,which):
 pages=(state["drafts"][CID]["pages"] if which=="draft"
        else state["published"]["drafts"][CID]["pages"])
 match=[(n,p) for n,p in enumerate(pages) if p.get("id")==PAGE]
 assert len(match)==1, "One and only one preparation page expected in "+which
 return pages,match[0][0],match[0][1]
blob,etag=fetch()
before=json.loads(blob)
assert isinstance(before.get("version"),int) and before["version"]>=81
assert isinstance(before.get("published"),dict)
p_draft,didx,draft=locate(before,"draft")
p_pub,pidx,published=locate(before,"published")
assert draft["blocks"]==published["blocks"],(
 "ABORT: Another unpublished preparation edit exists; never silently publish it."
)
assert len(draft["blocks"])==51,(
 "ABORT: The live preparation has changed since the structural audit. No write.")
run=subprocess.run(["node","scripts/transform-michael-preparation-page.mjs"],
 input=json.dumps(draft,ensure_ascii=False),text=True,
 capture_output=True,check=True,timeout=35)
change=json.loads(run.stdout)
newpage=change["page"]
report=change["report"]
assert report["beforeRoot"]==51 and report["afterRoot"]<30
assert report["leaves"]>=65
assert sorted(map(str,report["hiddenDuplicates"]))==sorted(map(str,[36,41,45,48,69]))
assert newpage["id"]==PAGE and newpage["group"]=="celebration"
# Each original block must remain fully represented after the conversion,
# checked by the JavaScript transformer before any change reaches R2.
updated=copy.deepcopy(before)
updated["drafts"][CID]["pages"][didx]=copy.deepcopy(newpage)
updated["published"]["drafts"][CID]["pages"][pidx]=copy.deepcopy(newpage)
timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="milliseconds")
updated["updatedAt"]=timestamp
updated["publishedAt"]=timestamp
updated["version"]=before["version"]+1
# Explicit proof that all unrelated celebrations and shared/global pages remain
# byte-for-byte identical in the parsed content.
for key in before:
 if key in ("version","updatedAt","publishedAt","drafts","published"):continue
 assert before[key]==updated[key], "Unexpected top-level mutation: "+key
for ident in before["drafts"]:
 if ident!=CID:assert before["drafts"][ident]==updated["drafts"][ident]
for key in before["drafts"][CID]:
 if key!="pages":assert before["drafts"][CID][key]==updated["drafts"][CID][key]
for i,p in enumerate(p_draft):
 if i!=didx:assert p==updated["drafts"][CID]["pages"][i]
for key in before["published"]:
 if key!="drafts":assert before["published"][key]==updated["published"][key]
for ident in before["published"]["drafts"]:
 if ident!=CID:assert before["published"]["drafts"][ident]==updated["published"]["drafts"][ident]
for i,p in enumerate(p_pub):
 if i!=pidx:assert p==updated["published"]["drafts"][CID]["pages"][i]
newblob=json.dumps(updated,ensure_ascii=False,separators=(",",":")).encode()
assert len(newblob)<5_000_000
backup="editor-trials/michael-layout-backups/preparation-"+digest(blob)[:28]+".json"
try:
 S.put_object(Bucket=BUCKET,Key=backup,Body=blob,
  ContentType="application/json",IfNoneMatch="*")
except ClientError as error:
 if error.response.get("ResponseMetadata",{}).get("HTTPStatusCode")!=412:raise
backupblob=S.get_object(Bucket=BUCKET,Key=backup)["Body"].read()
assert digest(backupblob)==digest(blob), "ABORT: backup verification failed"
print("MICHAEL_PAGE_BACKUP_VERIFIED",json.dumps({
 "from_revision":before["version"],"sha256":digest(blob)[:14],
 "backup_key_suffix":backup.split("/")[-1],"original_items":report["leaves"]
}))
# Verify there have been NO edits since our read. IfMatch makes the final
# PUT atomic even when a colleague edits the site during this workflow.
try:
 S.put_object(Bucket=BUCKET,Key=KEY,Body=newblob,ContentType="application/json",
  IfMatch=etag)
except ClientError as error:
 print("MICHAEL_UPDATE_ABORTED_CONCURRENT_CHANGE",error.response.get("Error",{}).get("Code"))
 raise
readback,etag_after=fetch()
assert digest(readback)==digest(newblob), "READBACK FAILED; do not claim success"
print("MICHAEL_PAGE_REORGANIZED",json.dumps({
 "revision":updated["version"],"original_root":report["beforeRoot"],
 "new_root":report["afterRoot"],"existing_leaf_blocks_preserved":report["leaves"],
 "titles_hidden_not_deleted":len(report["hiddenDuplicates"]),
 "snapshot_verified":True}))
# Fetch only the *public* version. Do not print private/unsent drafts to logs.
url="https://ronde-des-archanges-universelle.eu/api/editor-publication?celebration=101"
success=False
for attempt in range(6):
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={
   "Cache-Control":"no-cache","User-Agent":"Célébrations-Michael-layout-audit/1.0"
  }),timeout=15) as res:
   response=json.load(res)
  record=response.get("record") or {}
  candidate=next((p for p in record.get("pages",[]) if p.get("id")==PAGE),None)
  if candidate and candidate["blocks"]==newpage["blocks"]:
   success=True
   break
 except Exception as ex:
  if attempt==5:print("VISITOR_CHECK_WARNING",type(ex).__name__)
 time.sleep(2)
assert success,"Published page not yet confirmed in public API after editor save"
print("MICHAEL_PUBLIC_PAGE_VERIFIED",json.dumps({
 "page":PAGE,"sections":len(newpage["blocks"]),
 "original_items_preserved":report["leaves"],
 "unrelated_pages_modified":0,"archive_verified":True}))
