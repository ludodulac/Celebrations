#!/usr/bin/env python3
"""Content-only deduplication of titles on Michaël 2026 jeudi–dimanche.

Every selected heading is retained in both public and draft JSON, with only
hideOnSite=true. No content, URL, button, audio, video, page or runtime code
is edited. Schedule headings remain displayed. Audit first, conditional write
only after a verified snapshot backup, readback and real public-API check.
"""
import copy
import datetime
import hashlib
import json
import os
import re
import time
import unicodedata
import urllib.request
import urllib.parse
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

CID = "101"
DAYS = ("jeudi", "vendredi", "samedi", "dimanche")
BUCKET = "celebrations-exit-staging"
KEY = "editor-trials/server-drafts-v1.json"
URL = "https://ronde-des-archanges-universelle.eu/api/editor-publication?celebration=101"
# Every title ID is paired with an actual visible in-card title for that media.
# Includes radio URL cards. Never hide a heading that marks a scheduled meeting.
PAIRS = {
    "jeudi": {
        11: 12, 27: 28, 47: 48, 49: 50, 58: 59, 65: 66, 79: 80,
        19: 21, 34: 36, 37: 39, 56: 57, 69: 70, 71: 72,
        74: 76, 81: 82, 91: 93, 94: 96
    },
    "vendredi": {
        4: 5, 12: 13, 20: 21, 24: 25, 41: 42, 61: 62,
        18: 19, 28: 29, 30: 31, 53: 55
    },
    "samedi": {
        8: 9, 15: 16, 37: 38, 39: 40, 41: 42, 49: 50, 51: 52,
        53: 54, 55: 56, 57: 58, 59: 60,
        22: 23, 28: 29, 30: 31, 65: 67
    },
    "dimanche": {
        9: 10, 11: 12, 16: 17, 21: 23, 36: 37, 38: 39,
        40: 41, 42: 43, 5: 6, 7: 8, 26: 27
    },
}
EXPECTED_ITEMS = {"jeudi": 95, "vendredi": 61, "samedi": 69, "dimanche": 42}
EXPECTED_ROOTS = {"jeudi": 38, "vendredi": 25, "samedi": 21, "dimanche": 15}
# The 7 headings already hidden in a previous content-only cleanup remain hidden.
EXPECTED_ALREADY_HIDDEN = {"jeudi": {31, 85, 91}, "vendredi": {34, 50},
                           "samedi": {68}, "dimanche": {22}}
# Note: Thursday 91 was already hidden, so never re-target it or report it as new.
PAIRS["jeudi"].pop(91)

mode = os.environ.get("TITLE_DEDUPE_MODE", "audit")
assert mode in ("audit", "apply")
assert os.environ["STAGING_R2_BUCKET"] == BUCKET
s3 = boto3.client("s3", region_name="auto", endpoint_url=os.environ["R2_ENDPOINT"],
    aws_access_key_id=os.environ["STAGING_R2_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["STAGING_R2_SECRET_ACCESS_KEY"],
    config=Config(retries={"max_attempts": 2, "mode": "standard"}, connect_timeout=10, read_timeout=25))

def sha(binary):
    return hashlib.sha256(binary).hexdigest()

def get():
    row = s3.get_object(Bucket=BUCKET, Key=KEY)
    return row["Body"].read(), row["ETag"]

def live():
    req = urllib.request.Request(URL, headers={"User-Agent": "Michael-Title-Deduplication-Check",
                                                "Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=20) as result:
        assert result.status == 200
        return json.load(result)

def page_collection(state, area):
    return (state["drafts"] if area == "draft" else
            state["published"]["drafts"])[CID]["pages"]

def find_page(state, area, day):
    rows = [(idx, page) for idx, page in enumerate(page_collection(state, area))
            if page.get("id") == day + "-101"]
    assert len(rows) == 1, "Ambiguous or missing page " + day + " " + area
    return rows[0]

def flatten(items):
    for b in items:
        if b.get("kind") == "section":
            for col in b.get("columns", []):
                yield from flatten(col)
        else:
            yield b

def all_sections(page):
    for index, sec in enumerate(page["blocks"]):
        if sec.get("kind") != "section":
            continue
        yield index, list(flatten([sec]))

def norm(value):
    s = unicodedata.normalize("NFKD", str(value or "")).casefold()
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\W+", " ", s).strip()

def title_for_target(target):
    text = str(target.get("text") or "")
    if target["kind"] == "button":
        text = re.sub(r"^(?:Voir|Ouvrir|Écouter)\s*:\s*", "", text, flags=re.I)
    return norm(text)

def starts_with_clock(title):
    return bool(re.match(r"^\s*(?:[01]?\d|2[0-3]):[0-5]\d\s*[—–-]", title))

def validate_pairs(day, page):
    assert len(page["blocks"]) == EXPECTED_ROOTS[day], day + ": page grouping changed"
    leafs = list(flatten(page["blocks"]))
    assert len(leafs) == EXPECTED_ITEMS[day], day + ": content count changed"
    byid = {str(x.get("id")): x for x in leafs}
    assert len(byid) == len(leafs), day + ": duplicate block IDs"
    old_hidden = {int(x["id"]) for x in leafs
                  if x.get("kind") == "heading" and x.get("hideOnSite") is True}
    assert EXPECTED_ALREADY_HIDDEN[day].issubset(old_hidden), day + ": previous cleanup changed"
    section_for = {}
    for ix, group in all_sections(page):
        for b in group:
            section_for[str(b["id"])] = (ix, group)
    report = []
    for hid, mid in PAIRS[day].items():
        head = byid.get(str(hid))
        target = byid.get(str(mid))
        assert head and head["kind"] == "heading", day + f": heading {hid} no longer exists"
        assert target and target["kind"] in ("audio", "video", "button"), (
            day + f": media block {mid} changed type")
        assert not head.get("hideOnSite"), day + f": title {hid} already hidden"
        assert not starts_with_clock(str(head.get("text") or "")), (
            day + f": must never hide schedule title {hid}")
        assert section_for[str(hid)][0] == section_for[str(mid)][0], (
            day + f": heading and media no longer share a section {hid} {mid}")
        htitle = norm(head.get("text"))
        mtitle = title_for_target(target)
        # Explicit auditory labels include a small human-readable prefix
        # (e.g. Chant — « Chant de la Joie ») while the heading is a subphrase.
        assert htitle and mtitle and (
            htitle == mtitle or
            (target["kind"] == "audio" and
             (htitle in mtitle or mtitle in htitle))
        ), day + f": title not confirmed to be repeated {hid} vs {mid}: {htitle}/{mtitle}"
        if target["kind"] == "button":
            href = urllib.parse.urlsplit(str(target.get("href") or ""))
            # For URLs, the renderer repeats its title either in the video
            # caption or in a website card. A plain button also carries its
            # own visible title, but never hide a document/PDF heading.
            assert href.scheme == "https" and href.hostname, day + f": not an external link {mid}"
            assert not str(target.get("text") or "").lower().startswith("ouvrir le pdf"), (
                day + f": never hide PDF title {hid}")
        report.append({
            "title_id": hid, "media_id": mid, "kind": target["kind"],
            "section": section_for[str(hid)][0],
            "heading": str(head.get("text") or "")[:95],
            "in_player": str(target.get("text") or "")[:95],
            "already_button": target.get("displayAsButton") is True if target["kind"] == "button" else False,
        })
    return report, old_hidden

data, etag = get()
before = json.loads(data)
assert isinstance(before.get("version"), int) and before["version"] >= 126
assert isinstance(before.get("published"), dict)
reports, initial_hidden = {}, {}
for day in DAYS:
    _, pu = find_page(before, "published", day)
    _, dr = find_page(before, "draft", day)
    assert pu["blocks"] == dr["blocks"], day + ": existing unsaved edits, stop"
    reports[day], initial_hidden[day] = validate_pairs(day, pu)
print("MICHAEL_DUPLICATE_TITLES_AUDIT " + json.dumps({
    "revision": before["version"],
    "by_day": {day: len(reports[day]) for day in DAYS},
    "candidate_count": sum(map(len, reports.values())),
    "already_hidden": {day: len(initial_hidden[day]) for day in DAYS},
    "candidates": reports,
    "schedule_headings_unchanged": True,
    "content_counts": EXPECTED_ITEMS
}, ensure_ascii=False))
if mode == "audit":
    print("MICHAEL_DUPLICATE_TITLES_READONLY_SUCCESS")
    raise SystemExit(0)
assert os.environ.get("TITLE_DEDUPE_APPROVED") == "yes"
assert 25 <= sum(map(len, reports.values())) <= 75, "Unexpected candidate count"
public_before = live()
assert int(public_before.get("revision", -1)) == before["version"], (
    "Production API and editor snapshot disagree")
page_public = {x["id"]: x for x in public_before["record"]["pages"]}
for day in DAYS:
    assert day + "-101" in page_public, "Missing public page"
    assert page_public[day + "-101"]["blocks"] == find_page(before, "published", day)[1]["blocks"], (
        "Live page differs from stored published page: " + day)

updated = copy.deepcopy(before)
for day in DAYS:
    for area in ("published", "draft"):
        _, page = find_page(updated, area, day)
        byid = {str(item["id"]): item for item in flatten(page["blocks"])}
        for hid in PAIRS[day]:
            byid[str(hid)]["hideOnSite"] = True

# The only allowed changes are hideOnSite added to a fixed set of headings.
allowed = {day + "-101": {str(x) for x in PAIRS[day]} for day in DAYS}
for area in ("published", "draft"):
    old_scope = (before["drafts"] if area == "draft" else before["published"]["drafts"])
    new_scope = (updated["drafts"] if area == "draft" else updated["published"]["drafts"])
    for cid in old_scope:
        if cid != CID:
            assert old_scope[cid] == new_scope[cid]
            continue
        for key in old_scope[cid]:
            if key != "pages":
                assert old_scope[cid][key] == new_scope[cid][key]
        oldpages = old_scope[cid]["pages"]
        newpages = new_scope[cid]["pages"]
        assert len(oldpages) == len(newpages)
        for oldpage, newpage in zip(oldpages, newpages):
            expected = copy.deepcopy(oldpage)
            if oldpage["id"] in allowed:
                for item in flatten(expected.get("blocks", [])):
                    if str(item["id"]) in allowed[oldpage["id"]]:
                        assert item["kind"] == "heading"
                        item["hideOnSite"] = True
            assert newpage == expected, "Unexpected change in " + str(oldpage.get("id"))
for key in before:
    if key not in ("drafts", "published", "version", "updatedAt", "publishedAt"):
        assert before[key] == updated[key]
for key in before["published"]:
    if key != "drafts":
        assert before["published"][key] == updated["published"][key]

now = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="milliseconds")
updated["version"] = before["version"] + 1
updated["updatedAt"] = now
updated["publishedAt"] = now
newdata = json.dumps(updated, ensure_ascii=False, separators=(",", ":")).encode()
assert len(newdata) < 5000000
key = "editor-trials/michael-layout-backups/title-dedupe-" + sha(data)[:28] + ".json"
try:
    s3.put_object(Bucket=BUCKET, Key=key, Body=data,
                  ContentType="application/json", IfNoneMatch="*")
except ClientError as error:
    if error.response.get("ResponseMetadata", {}).get("HTTPStatusCode") != 412:
        raise
assert sha(s3.get_object(Bucket=BUCKET, Key=key)["Body"].read()) == sha(data)
print("MICHAEL_DUPLICATE_TITLES_BACKUP_VERIFIED " + sha(data)[:16])
try:
    s3.put_object(Bucket=BUCKET, Key=KEY, Body=newdata,
                  ContentType="application/json", IfMatch=etag)
except ClientError:
    print("MICHAEL_DUPLICATE_TITLES_CONCURRENT_EDIT_ABORT")
    raise
written, new_etag = get()
try:
    assert sha(written) == sha(newdata), "R2 readback does not match"
    for attempt in range(5):
        try:
            current = live()
            assert int(current.get("revision", -1)) == updated["version"]
            public_pages = {p["id"]: p for p in current["record"]["pages"]}
            for day in DAYS:
                page = public_pages[day + "-101"]
                visible = {str(item["id"]): item for item in flatten(page["blocks"])}
                assert len(visible) == EXPECTED_ITEMS[day]
                assert all(visible[str(hid)].get("hideOnSite") is True
                           for hid in PAIRS[day]), "Missing hidden titles"
                assert page["blocks"] == find_page(updated, "published", day)[1]["blocks"], (
                    "Public changes were incomplete")
            break
        except Exception:
            if attempt == 4:
                raise
            time.sleep(2)
except Exception:
    try:
        s3.put_object(Bucket=BUCKET, Key=KEY, Body=data,
                      ContentType="application/json", IfMatch=new_etag)
        assert sha(get()[0]) == sha(data)
        print("MICHAEL_DUPLICATE_TITLES_POSTCHECK_FAILED_ROLLBACK_VERIFIED")
    except Exception as rollback_error:
        print("MICHAEL_DUPLICATE_TITLES_ROLLBACK_CONFLICT",
              type(rollback_error).__name__)
    raise
print("MICHAEL_DUPLICATE_TITLES_PUBLISHED_SUCCESS " + json.dumps({
    "revision": updated["version"],
    "hidden_redundant_headings": sum(map(len, reports.values())),
    "by_day": {day: len(reports[day]) for day in DAYS},
    "preserved_media_and_links": sum(EXPECTED_ITEMS.values()),
    "all_schedule_titles_preserved": True,
    "runtime_code_changes": 0, "editor_new_tools": 0, "D1_writes": 0
}, ensure_ascii=False))
