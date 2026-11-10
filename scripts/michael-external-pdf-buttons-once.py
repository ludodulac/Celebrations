#!/usr/bin/env python3
"""Narrow content-only change: show existing external PDF URLs as plain buttons.

Only Michaël 2026 Wednesday–Sunday. No application code, new tool or link changed.
A heading with the same exact document title must already exist on that page.
Both public and draft copies of the exact button must agree before editing.
An immutable, SHA-verified full snapshot backup precedes conditional R2 write.
"""
import copy
import datetime
import hashlib
import json
import os
import re
import time
import unicodedata
import urllib.parse
import urllib.request
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

CID = "101"
DAYS = ("mercredi", "jeudi", "vendredi", "samedi", "dimanche")
KEY = "editor-trials/server-drafts-v1.json"
BUCKET = "celebrations-exit-staging"
BASE = "https://ronde-des-archanges-universelle.eu"
MODE = os.environ.get("PDF_BUTTONS_MODE", "audit")
assert MODE in ("audit", "apply")
assert os.environ["STAGING_R2_BUCKET"] == BUCKET
client = boto3.client("s3", region_name="auto",
    endpoint_url=os.environ["R2_ENDPOINT"],
    aws_access_key_id=os.environ["STAGING_R2_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["STAGING_R2_SECRET_ACCESS_KEY"],
    config=Config(retries={"max_attempts": 2, "mode": "standard"},
                  connect_timeout=10, read_timeout=20))

def digest(blob):
    return hashlib.sha256(blob).hexdigest()

def read():
    obj = client.get_object(Bucket=BUCKET, Key=KEY)
    return obj["Body"].read(), obj["ETag"]

def public():
    request = urllib.request.Request(BASE + "/api/editor-publication?celebration=" + CID,
        headers={"Cache-Control": "no-cache", "User-Agent": "Celebrations-PDF-Button-ReadOnly-Check"})
    with urllib.request.urlopen(request, timeout=20) as response:
        assert response.status == 200
        return json.load(response)

def norm(text):
    text = unicodedata.normalize("NFKD", str(text or ""))
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"\W+", " ", text.casefold(), flags=re.UNICODE).strip()

def all_leaves(blocks):
    for block in blocks or []:
        if block.get("kind") == "section":
            for column in block.get("columns", []):
                yield from all_leaves(column)
        else:
            yield block

def by_id(page):
    leaves = list(all_leaves(page.get("blocks", [])))
    assert len({str(b.get("id")) for b in leaves}) == len(leaves), "Ambiguous duplicate block IDs"
    return {str(b.get("id")): b for b in leaves}

def published_pages(state):
    return {p["id"]: p for p in state["published"]["drafts"][CID]["pages"]}

def draft_pages(state):
    return {p["id"]: p for p in state["drafts"][CID]["pages"]}

def preview_candidate(button):
    if button.get("kind") != "button" or button.get("displayAsButton") is True or button.get("assetId"):
        return None
    label = str(button.get("text") or "").strip()
    match = re.fullmatch(r"Ouvrir le PDF\s*(?::\s*(.*))?", label, flags=re.I)
    if not match:
        return None
    href = str(button.get("href") or "").strip()
    parsed = urllib.parse.urlsplit(href)
    if parsed.scheme != "https" or not parsed.hostname or href.lower().endswith(".pdf"):
        return None
    return {"id": str(button["id"]), "title": (match.group(1) or "").strip(),
            "hostname": parsed.hostname}

def paired_candidates(public_page, draft_page, day):
    publi = by_id(public_page)
    prive = by_id(draft_page)
    heading_names = {norm(b.get("text")) for b in publi.values()
                     if b.get("kind") == "heading" and not b.get("hideOnSite")}
    eligible = []
    skipped = []
    for ident, block in publi.items():
        candidate = preview_candidate(block)
        if not candidate:
            continue
        if not candidate["title"] or norm(candidate["title"]) not in heading_names:
            skipped.append({"day": day, **candidate, "reason": "no matching visible document title"})
            continue
        draft_button = prive.get(ident)
        if draft_button is None or draft_button.get("kind") != "button" or any(
            draft_button.get(key) != block.get(key)
            for key in ("text", "href", "assetId", "displayAsButton")
        ):
            skipped.append({"day": day, **candidate, "reason": "draft button differs, protect editor edits"})
            continue
        eligible.append({"day": day, **candidate})
    return eligible, skipped

blob, etag = read()
before = json.loads(blob)
assert isinstance(before.get("version"), int) and before["version"] >= 125
pubpages, draftpages = published_pages(before), draft_pages(before)
candidate_list = []
skip_list = []
for day in DAYS:
    pageid = day + "-101"
    assert pageid in pubpages and pageid in draftpages, "Missing page " + pageid
    yes, no = paired_candidates(pubpages[pageid], draftpages[pageid], day)
    candidate_list += yes
    skip_list += no
print("PDF_BUTTONS_AUDIT " + json.dumps({
    "revision": before["version"], "scope": list(DAYS),
    "eligible_count": len(candidate_list), "skipped_count": len(skip_list),
    "eligible": candidate_list, "skipped": skip_list
}, ensure_ascii=False))
if MODE == "audit":
    print("PDF_BUTTONS_READONLY_COMPLETE; zero remote writes")
    raise SystemExit(0)

assert os.environ.get("PDF_BUTTONS_OWNER_APPROVED") == "yes"
assert candidate_list, "No eligible repeated external PDF links; no write needed"
assert len(candidate_list) <= 50, "Unexpectedly many external PDFs"
assert not skip_list, "Some eligible-looking PDF previews ambiguous: safe abort"

original_public = public()
assert int(original_public.get("revision", -1)) == before["version"], (
    "Public API and R2 version differ; abort")
sitepages = {p["id"]: p for p in original_public["record"]["pages"]}
for c in candidate_list:
    pageid = c["day"] + "-101"
    assert pageid in sitepages, "Missing live public page"
    site_button = by_id(sitepages[pageid]).get(c["id"])
    assert site_button and site_button.get("text") == by_id(pubpages[pageid])[c["id"]]["text"], (
        "Live site button differs; abort")

after = copy.deepcopy(before)
new_pubpages, new_draftpages = published_pages(after), draft_pages(after)
for c in candidate_list:
    ident = c["id"]
    pageid = c["day"] + "-101"
    for page in (new_pubpages[pageid], new_draftpages[pageid]):
        block = by_id(page)[ident]
        original = copy.deepcopy(block)
        block["text"] = "📄 Ouvrir le PDF"
        block["displayAsButton"] = True
        original["text"] = block["text"]
        original["displayAsButton"] = block["displayAsButton"]
        assert original == block, "Unexpected button change"
    assert len(list(all_leaves(new_pubpages[pageid]["blocks"]))) == len(
        list(all_leaves(pubpages[pageid]["blocks"]))), "Content count modified"
# Exact semantic equality for everything beyond the specified two fields.
allowed = {(c["day"]+"-101", c["id"]) for c in candidate_list}
for level in ("drafts", "published"):
    original_scope = before["drafts"] if level == "drafts" else before["published"]["drafts"]
    updated_scope = after["drafts"] if level == "drafts" else after["published"]["drafts"]
    for groupid in original_scope:
        if groupid != CID:
            assert original_scope[groupid] == updated_scope[groupid]
            continue
        for key in original_scope[groupid]:
            if key != "pages":
                assert original_scope[groupid][key] == updated_scope[groupid][key]
        oldps = original_scope[groupid]["pages"]
        newps = updated_scope[groupid]["pages"]
        assert len(oldps) == len(newps)
        for op, np in zip(oldps, newps):
            op_copy = copy.deepcopy(op)
            if op["id"] in {d+"-101" for d in DAYS}:
                for block in all_leaves(op_copy.get("blocks", [])):
                    if (op["id"], str(block.get("id"))) in allowed:
                        block["text"] = "📄 Ouvrir le PDF"
                        block["displayAsButton"] = True
            assert op_copy == np, "Unexpected page mutation: " + op["id"]
for key in before:
    if key not in ("drafts", "published", "version", "updatedAt", "publishedAt"):
        assert before[key] == after[key]
for key in before["published"]:
    if key != "drafts":
        assert before["published"][key] == after["published"][key]

stamp = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="milliseconds")
after["version"] = before["version"] + 1
after["updatedAt"] = stamp
after["publishedAt"] = stamp
newblob = json.dumps(after, ensure_ascii=False, separators=(",", ":")).encode()
assert len(newblob) < 5000000
backup = "editor-trials/michael-layout-backups/pdf-external-buttons-" + digest(blob)[:28] + ".json"
try:
    client.put_object(Bucket=BUCKET, Key=backup, Body=blob,
                      ContentType="application/json", IfNoneMatch="*")
except ClientError as error:
    if error.response.get("ResponseMetadata", {}).get("HTTPStatusCode") != 412:
        raise
assert digest(client.get_object(Bucket=BUCKET, Key=backup)["Body"].read()) == digest(blob)
print("PDF_BUTTONS_BACKUP_VERIFIED " + digest(blob)[:16])
client.put_object(Bucket=BUCKET, Key=KEY, Body=newblob,
                  ContentType="application/json", IfMatch=etag)
observed, updated_etag = read()
try:
    assert digest(observed) == digest(newblob), "Saved state differs"
    for attempt in range(5):
        try:
            current = public()
            assert int(current.get("revision", -1)) == after["version"]
            sitepages = {p["id"]: p for p in current["record"]["pages"]}
            for c in candidate_list:
                item = by_id(sitepages[c["day"]+"-101"])[c["id"]]
                assert item["text"] == "📄 Ouvrir le PDF" and item["displayAsButton"] is True
                assert item.get("href") == by_id(pubpages[c["day"]+"-101"])[c["id"]].get("href")
            break
        except Exception:
            if attempt == 4:
                raise
            time.sleep(2)
except Exception:
    # Only roll back if no administrator has saved in between.
    try:
        client.put_object(Bucket=BUCKET, Key=KEY, Body=blob,
                          ContentType="application/json", IfMatch=updated_etag)
        assert digest(read()[0]) == digest(blob), "Rollback readback differs"
        print("PDF_BUTTONS_POSTCHECK_FAILED_ROLLBACK_VERIFIED")
    except Exception as rollback_error:
        print("PDF_BUTTONS_ROLLBACK_CONFLICT", type(rollback_error).__name__)
    raise
print("PDF_BUTTONS_LIVE_PUBLISHED_VERIFIED " + json.dumps({
    "revision": after["version"], "changed_links": len(candidate_list),
    "changed_by_day": {day: sum(1 for c in candidate_list if c["day"]==day)
                       for day in DAYS},
    "existing_URLs_intact": True, "existing_media_intact": True,
    "frontend_code_changes": 0, "new_editor_tools": 0, "D1_writes": 0
}, ensure_ascii=False))
