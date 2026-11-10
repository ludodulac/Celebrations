#!/usr/bin/env python3
"""One-time Michaël Thursday–Sunday content-only re-layout (no runtime code change).

Preserve all 267 original blocks, IDs, text, media, filenames, links, order inside
each activity, private/public separation and all other pages; group using only the
existing 5 presentation styles. Read exact current snapshot; fail on edits.
Backup and SHA-verify before conditional write, read back, verify public site and
rollback conditionally on failed postcheck. No D1, media R2, DNS or Worker edits.
"""
import copy
import datetime
import hashlib
import json
import os
import re
import sys
import time
import urllib.request
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

SPEC = json.loads("{\"jeudi\":\"i:2-3;d:4-5;i:6;d:7-8;i:29-30;d:31-32;i:9-10;v:11-12;r:14/13,15;i:16;d:17-18;v:19-21;i:33;v:34-39;i:22-23;r:25/24,26;v:27-28;i:40;d:41-46;v:47-48;v:49-50;i:51;d:52-55;v:56-57;v:58-59;i:60-61;r:63/62,64;v:65-66;i:67-68;v:69-72;i:73;v:74-76;d:77-78;v:79-80;v:81-82;t:83-86;r:89/87-88,90;t:91-96\",\"vendredi\":\"i:2;d:36-38;i:39-40;v:41-42;r:44/43,45;i:3;v:4-5;d:6-7;i:8-9;i:10-11;v:12-13;r:15/14,16;i:17;v:18-19;v:20-21;i:22-23;v:24-25;i:26-27;v:28-31;i:56;d:57-60;v:61-62;t:32-35;r:48/46-47,49;t:50-55\",\"samedi\":\"i:2-3;d:4-5;i:13-14;v:15-16;r:18/17,19;i:20-21;d:22-25;i:26-27;v:28-31;i:6-7;v:8-9;r:11/10,12;i:32;d:33-36;v:37-42;i:43-44;d:45-48;v:49-54;v:55-60;r:63/61-62,64;t:65-70\",\"dimanche\":\"i:2;d:28-30;i:31-32;d:33-34;i:35;v:36-43;i:3-4;v:5-10;v:11-13;i:14-15;v:16-17;r:19/18,20;v:21-23;i:24-25;v:26-27\"}")
EXPECTED = {"jeudi": 95, "vendredi": 61, "samedi": 69, "dimanche": 42}
DUPLICATE_HEADINGS = {"jeudi": {31, 85, 91}, "vendredi": {34, 50},
                      "samedi": {68}, "dimanche": {22}}
LABELS = {"i": "intro", "d": "documents", "v": "video",
          "t": "text", "r": "resource"}
CID = "101"
KEY = "editor-trials/server-drafts-v1.json"
BUCKET = "celebrations-exit-staging"
URL = "https://ronde-des-archanges-universelle.eu/api/editor-publication?celebration=101"
assert os.environ["STAGING_R2_BUCKET"] == BUCKET, "Wrong R2 binding"
assert os.environ.get("MICHAEL_DAYS_ONE_SHOT_APPROVED") == "yes", "Not approved"
s3 = boto3.client("s3", region_name="auto", endpoint_url=os.environ["R2_ENDPOINT"],
                  aws_access_key_id=os.environ["STAGING_R2_ACCESS_KEY_ID"],
                  aws_secret_access_key=os.environ["STAGING_R2_SECRET_ACCESS_KEY"],
                  config=Config(retries={"max_attempts": 2, "mode": "standard"},
                                connect_timeout=10, read_timeout=25))

def sha(blob):
    return hashlib.sha256(blob).hexdigest()

def read():
    response = s3.get_object(Bucket=BUCKET, Key=KEY)
    return response["Body"].read(), response["ETag"]

def ids(spec):
    values = []
    for part in spec.split(","):
        match = re.fullmatch(r"(\d+)(?:-(\d+))?", part.strip())
        assert match, f"Bad plan range {part}"
        lo = int(match.group(1))
        hi = int(match.group(2) or lo)
        assert lo <= hi and hi < 1000, f"Bad interval {part}"
        values += list(range(lo, hi + 1))
    return values

def leaves(blocks):
    for block in blocks:
        if block.get("kind") == "section":
            for col in block.get("columns", []):
                yield from leaves(col)
        else:
            yield block

def transform(page, day):
    before = copy.deepcopy(page)
    originals = before.get("blocks")
    assert len(originals) == EXPECTED[day], f"{day}: Unexpected original length"
    assert all(b.get("kind") in {"heading", "text", "audio", "image", "button"}
               for b in originals), f"{day}: Already grouped or unknown type"
    original_by_id = {b["id"]: b for b in originals}
    assert list(original_by_id) == list(range(2, EXPECTED[day] + 2)), (
        f"{day}: IDs/order changed; stop rather than overriding another edit")
    results, assigned = [], []
    for number, item in enumerate(SPEC[day].split(";"), start=1):
        typ, desc = item.split(":", 1)
        assert typ in LABELS, f"Unknown presentation {typ}"
        if typ == "r":
            left, right = desc.split("/", 1)
            left_ids, right_ids = ids(left), ids(right)
            assert len(left_ids) == 1 and originals[left_ids[0]-2]["kind"] == "image", (
                f"{day}: Resource must have a real image")
            cols = [left_ids, right_ids]
        else:
            cols = [ids(desc), []]
        keys = cols[0] + cols[1]
        assert keys and all(key in original_by_id for key in keys)
        assigned += keys
        children = []
        for col in cols:
            arranged = []
            for key in col:
                block = copy.deepcopy(original_by_id[key])
                if key in DUPLICATE_HEADINGS[day]:
                    assert block["kind"] == "heading", f"{day}: Duplicate changed"
                    block["hideOnSite"] = True  # Never delete original copy.
                arranged.append(block)
                children.append(block)
            if col is cols[0]:
                left_blocks = arranged
            else:
                right_blocks = arranged
        section = {
            "id": f"michael-{day}-layout-{number:02d}-2026",
            "kind": "section",
            "presentation": LABELS[typ],
            "layout": "columns" if typ == "r" else "single",
            "columns": [left_blocks, right_blocks],
            "style": {"border": "none", "color": "#d7dde5",
                      "shadow": False, "width": 1}
        }
        if typ == "r":
            section["columnAlignments"] = ["center", "center"]
        results.append(section)
    assert len(assigned) == EXPECTED[day] and len(set(assigned)) == len(assigned), (
        f"{day}: Missing/duplicated original content")
    assert set(assigned) == set(original_by_id)
    after = copy.deepcopy(before)
    after["blocks"] = results
    flattened = list(leaves(after["blocks"]))
    assert len(flattened) == EXPECTED[day]
    for block in flattened:
        original = copy.deepcopy(original_by_id[block["id"]])
        if block["id"] in DUPLICATE_HEADINGS[day]:
            original["hideOnSite"] = True
        assert block == original, f"{day}: Unexpected content modification"
    for key in before:
        if key != "blocks":
            assert before[key] == after[key]
    return after

def locate(state, scope, day):
    collection = (state["drafts"] if scope == "draft"
                  else state["published"]["drafts"])[CID]["pages"]
    indices = [n for n, page in enumerate(collection) if page.get("id") == f"{day}-101"]
    assert len(indices) == 1, f"{day}: {scope} page not unique"
    return collection, indices[0]

def public():
    request = urllib.request.Request(URL, headers={"User-Agent": "Celebrations-Michael-Layout-Verification",
                                                   "Cache-Control": "no-cache"})
    with urllib.request.urlopen(request, timeout=20) as response:
        assert response.status == 200
        return json.load(response)

def verify_public(expected_pages):
    payload = public()
    pages = payload.get("record", {}).get("pages", [])
    assert len(pages) >= 8, "Published pages missing"
    for day, expected in expected_pages.items():
        found = [p for p in pages if p.get("id") == f"{day}-101"]
        assert len(found) == 1, f"Public page missing {day}"
        actual = found[0].get("blocks", [])
        assert len(actual) == len(expected["blocks"]), f"Public grouping incomplete: {day}"
        observed = list(leaves(actual))
        assert len(observed) == EXPECTED[day], f"Public content incomplete: {day}"
        assert {str(x["id"]) for x in observed} == {
            str(x["id"]) for x in leaves(expected["blocks"])}, f"Missing media: {day}"
    return True

blob, etag = read()
before = json.loads(blob)
assert isinstance(before.get("version"), int) and before["version"] >= 124
assert isinstance(before.get("published"), dict) and isinstance(before.get("drafts"), dict)
updated = copy.deepcopy(before)
expected_pages = {}
for day in EXPECTED:
    draft_array, di = locate(before, "draft", day)
    pub_array, pi = locate(before, "published", day)
    draft = draft_array[di]
    published = pub_array[pi]
    assert draft["blocks"] == published["blocks"], (
        f"{day}: Unpublished edits exist. Refuse to replace.")
    newpage = transform(published, day)
    assert transform(draft, day) == newpage, f"{day}: draft fields differ"
    updated["drafts"][CID]["pages"][di] = copy.deepcopy(newpage)
    updated["published"]["drafts"][CID]["pages"][pi] = copy.deepcopy(newpage)
    expected_pages[day] = newpage

# Complete structural proof: absolutely no other page or state field was touched.
for area in ("drafts", "published"):
    root_before = before[area] if area == "drafts" else before[area]["drafts"]
    root_after = updated[area] if area == "drafts" else updated[area]["drafts"]
    for celebration in root_before:
        if celebration != CID:
            assert root_before[celebration] == root_after[celebration]
    for key in root_before[CID]:
        if key != "pages":
            assert root_before[CID][key] == root_after[CID][key]
    for day_page_before, day_page_after in zip(root_before[CID]["pages"],
                                               root_after[CID]["pages"]):
        if day_page_before["id"] not in {f"{day}-101" for day in EXPECTED}:
            assert day_page_before == day_page_after
for key in before:
    if key not in {"drafts", "published", "version", "updatedAt", "publishedAt"}:
        assert before[key] == updated[key]
for key in before["published"]:
    if key != "drafts":
        assert before["published"][key] == updated["published"][key]

# A live public read must agree with the original snapshot before any R2 write.
current_public = public()
for day in EXPECTED:
    candidates = [p for p in current_public.get("record", {}).get("pages", [])
                  if p.get("id") == f"{day}-101"]
    assert len(candidates) == 1 and len(candidates[0].get("blocks", [])) == EXPECTED[day], (
        f"{day}: Public version changed; abort.")
print("MICHAEL_DAYS_PREFLIGHT_PASS " + json.dumps({
    "from_revision": before["version"],
    "original_blocks": EXPECTED, "new_sections": {
        d: len(p["blocks"]) for d, p in expected_pages.items()},
    "untouched_pages_preserved": True, "preflight_only": True
}))

now = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="milliseconds")
updated["version"] = before["version"] + 1
updated["updatedAt"] = now
updated["publishedAt"] = now
newblob = json.dumps(updated, ensure_ascii=False, separators=(",", ":")).encode()
assert len(newblob) < 5_000_000
backup = "editor-trials/michael-layout-backups/other-days-" + sha(blob)[:28] + ".json"
try:
    s3.put_object(Bucket=BUCKET, Key=backup, Body=blob,
                  ContentType="application/json", IfNoneMatch="*")
except ClientError as error:
    if error.response.get("ResponseMetadata", {}).get("HTTPStatusCode") != 412:
        raise
assert sha(s3.get_object(Bucket=BUCKET, Key=backup)["Body"].read()) == sha(blob)
print("MICHAEL_DAYS_EXACT_BACKUP_VERIFIED " + sha(blob)[:16])
try:
    s3.put_object(Bucket=BUCKET, Key=KEY, Body=newblob,
                  ContentType="application/json", IfMatch=etag)
except ClientError:
    print("MICHAEL_DAYS_ABORT_CONCURRENT_EDIT_NO_CONTENT_WRITTEN")
    raise
readback, after_etag = read()
try:
    assert sha(readback) == sha(newblob), "R2 readback differs"
    for attempt in range(5):
        try:
            verify_public(expected_pages)
            break
        except Exception:
            if attempt == 4:
                raise
            time.sleep(2)
except Exception as error:
    # Rollback only if no other administrator has edited since our write.
    try:
        s3.put_object(Bucket=BUCKET, Key=KEY, Body=blob,
                      ContentType="application/json", IfMatch=after_etag)
        assert sha(read()[0]) == sha(blob)
        print("MICHAEL_DAYS_FAILED_CHECK_ROLLBACK_VERIFIED")
    except Exception as rollback_error:
        print("MICHAEL_DAYS_ROLLBACK_CONFLICT_MANUAL_RECOVERY_REQUIRED",
              type(rollback_error).__name__)
    raise
print("MICHAEL_DAYS_LIVE_PUBLISHED_VERIFIED " + json.dumps({
    "days": list(EXPECTED), "revision": updated["version"],
    "original_items_kept": sum(EXPECTED.values()),
    "sections": {d: len(p["blocks"]) for d, p in expected_pages.items()},
    "duplicate_headings_hidden_not_deleted": sum(map(len, DUPLICATE_HEADINGS.values())),
    "new_frontend_tools": 0, "runtime_code_modified": False,
    "media_objects_modified": 0, "D1_writes": 0}))
