#!/usr/bin/env python3
"""Classify CÉLÉBRATIONS user-visible resources before a selective migration.

READ ONLY: reads original Supabase REST tables and Storage listings. Classifies
storage keys referenced by actual public program, accueil, image gallery and
committee invitation routes, plus static homepage media. DOES NOT DELETE,
RENAME, COPY, OR UPDATE ANYTHING. No paths, names or credentials in logs.

A protected list is a lower bound: assets used by other page scripts, direct
links or offline fallback may require additional protection. Therefore the
"review" partition must NEVER be automatically deleted on this audit alone.
"""
import json
import os
import pathlib
import re
import sys
from urllib.parse import urlsplit

import requests

SOURCE_HOST="jwyayfkssyagvnablttg.supabase.co"
BUCKET="celebrations-media"
SOURCE_TABLES={
    "contents":"celebrations_contents",
    "event_links":"celebrations_event_contents",
    "step_links":"celebrations_step_contents",
    "events":"celebrations_events",
    "links":"celebrations_links",
    "letters":"celebrations_committee_letters",
}
# Named illustration fallbacks in public-event-illustration.js; include them
# even when the administration has not attached them to an event relation.
FALLBACK_IDS={"guide-file-30","guide-file-291","guide-file-399",
              "image-1789467043343-6-p1bsh"}


def asset_audit(contents,event_links,step_links,events,links,letters,
                inventory,static_refs=(),return_sets=False):
    by_id={str(c["id"]):c for c in contents}
    if len(by_id)!=len(contents):
        raise ValueError("Duplicate content identifiers")
    events_by_id={str(e["id"]):e for e in events}
    placed=set()
    for ec in event_links:
        if str(ec.get("event_id")) not in events_by_id:
            raise ValueError("Broken public event relationship")
        placed.add(str(ec["content_id"]))
    for sc in step_links:
        placed.add(str(sc["content_id"]))
    if not placed.issubset(by_id):
        raise ValueError("A public programme references a missing content card")

    home={id for id,c in by_id.items() if str(c.get("category") or "").strip().lower()=="accueil"}
    gallery={
        id for id,c in by_id.items()
        if (c.get("content_type")=="Image" and c.get("source_type")=="file"
            and c.get("storage_path"))
        or (c.get("has_cover") is True and c.get("cover_storage_path"))
    }
    illustration={
        str(link.get("url",""))[8:]
        for link in links
        if link.get("link_type")=="event-illustration"
        and str(link.get("url","")).startswith("content:")
    }
    # A wrong manual illustration link is not safe grounds to remove a file.
    if not illustration.issubset(by_id):
        raise ValueError("Missing manually linked illustration")
    preserved_cards=placed|home|gallery|illustration|(FALLBACK_IDS&set(by_id))
    protected_keys=set()
    missing_references=set()
    for id in preserved_cards:
        c=by_id[id]
        for field in ("storage_path","cover_storage_path"):
            raw=c.get(field)
            if not raw or not isinstance(raw,str):
                continue
            if raw.startswith(("https://","http://","data:")):
                # Externally hosted references are not physical Storage keys.
                continue
            protected_keys.add(raw)
    public_keys=set(protected_keys)
    committee_keys={
        str(l["storage_path"]) for l in letters if l.get("storage_path")
    }
    # These 9 letters are accessible via published invitation URLs. Keep in
    # a protected cohort even though they are not listed in the day programme.
    protected_keys.update(committee_keys)
    protected_keys.update(static_refs)
    actual=set(inventory)
    missing_references=protected_keys-actual
    found=protected_keys&actual
    candidates=actual-protected_keys
    summary = {
        "source_content_cards":len(contents),
        "program_linked_cards":len(placed),
        "accueil_cards":len(home),
        "gallery_candidate_cards":len(gallery),
        "definitely_public_cards":len(preserved_cards),
        "unattached_non_gallery_cards":len(set(by_id)-preserved_cards),
        "committee_invitations_protected":len(committee_keys),
        "storage_objects_total":len(actual),
        "physically_present_protected_objects":len(found),
        "storage_objects_needing_manual_review":len(candidates),
        "required_keys_missing_from_storage":len(missing_references),
        "data_source_mutations":0,
        "cloudflare_mutations":0,
        "destructive_deletions":0,
        "review_candidates_are_safe_to_delete_automatically":False,
    }
    if return_sets:
        # Path sets are sensitive and MUST NOT be emitted into GitHub logs,
        # PR comments or artifacts; only the caller's secure process may use.
        return summary, {
            "selected": found,
            "review": candidates,
            "missing": missing_references,
            "public": public_keys & actual,
            "committee": committee_keys & actual,
        }
    return summary


def fetch_all(session,base,table):
    if table not in SOURCE_TABLES.values():
        raise ValueError("Unexpected source table")
    result=[]
    offset=0
    while True:
        response=session.get(base+"/rest/v1/"+table,
             params={"select":"*","limit":500,"offset":offset},timeout=35)
        response.raise_for_status()
        rows=response.json()
        if not isinstance(rows,list) or len(rows)>500:
            raise ValueError("Unexpected REST response")
        result.extend(rows)
        if len(result)>2000:raise ValueError("Unexpected source table volume")
        if len(rows)<500:break
        offset+=len(rows)
    return result


def list_objects(session,base,prefix="",depth=0):
    if depth>12:raise ValueError("Unexpected directory depth")
    found={}
    offset=0
    while True:
        response=session.post(base+"/storage/v1/object/list/"+BUCKET,
          json={"prefix":prefix,"limit":100,"offset":offset,
                "sortBy":{"column":"name","order":"asc"}},timeout=40)
        response.raise_for_status()
        rows=response.json()
        if not isinstance(rows,list) or len(rows)>100:
            raise ValueError("Unexpected Storage response")
        for item in rows:
            name=item.get("name")
            if not name or name==".emptyFolderPlaceholder":continue
            key=prefix+name
            if (not isinstance(name,str) or len(key)>1024 or
                "\\" in key or any(x in ("",".","..") for x in key.split("/"))):
                raise ValueError("Invalid Storage object key")
            if item.get("id") is None:
                sub=list_objects(session,base,key+"/",depth+1)
                if set(found)&set(sub):raise ValueError("Duplicate subtree")
                found.update(sub)
            else:
                if key in found:raise ValueError("Duplicate object")
                size=(item.get("metadata") or {}).get("size")
                if not isinstance(size,(int,str)) or not str(size).isdigit():
                    raise ValueError("Missing object size")
                found[key]=int(size)
        if len(rows)<100:break
        offset+=len(rows)
        if offset>300:raise ValueError("Unexpected storage listing volume")
    return found


def static_homepage_refs():
    # Only explicitly published HTML URL literals are included. The audit
    # does NOT mistake the historical app-data.js/fallback database for what
    # users currently see on a functioning site.
    html=pathlib.Path("index.html").read_text(encoding="utf8")
    return set(re.findall(r"/storage/v1/object/public/celebrations-media/(media/[^\s\"'<>?]+)",html))


def main():
    base=os.environ["SUPABASE_URL"].rstrip("/")
    url=urlsplit(base)
    if (url.scheme!="https" or url.hostname!=SOURCE_HOST
        or url.path or url.query or url.fragment):
        raise ValueError("Wrong Supabase origin")
    if os.environ.get("GITHUB_REF")!="refs/heads/feat/celebrations-supabase-exit-001":
        raise ValueError("Wrong migration branch")
    token=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    session=requests.Session()
    session.headers.update({"apikey":token,"Authorization":"Bearer "+token})
    data={k:fetch_all(session,base,v) for k,v in SOURCE_TABLES.items()}
    inventory=list_objects(session,base)
    # The previous SHA256 audit proved this exact source inventory. Do not
    # approve a destructive selection on a changing/unverified bucket.
    if len(inventory)!=158 or sum(inventory.values())!=830312417:
        raise ValueError("Media inventory changed since last parity audit")
    report=asset_audit(data["contents"],data["event_links"],
                       data["step_links"],data["events"],data["links"],
                       data["letters"],inventory,static_homepage_refs())
    if (report["source_content_cards"]!=211 or
        report["program_linked_cards"]!=108 or
        report["storage_objects_total"]!=158):
        raise ValueError("Content or programme drift")
    print("CELEBRATIONS_PUBLIC_ONLY_MEDIA_AUDIT_READONLY "+json.dumps(
        report,sort_keys=True),flush=True)


if __name__=="__main__":
    try:main()
    except BaseException as error:
        print("CELEBRATIONS_PUBLIC_ONLY_MEDIA_AUDIT_STOP category="+
              type(error).__name__,file=sys.stderr)
        raise SystemExit(1)
