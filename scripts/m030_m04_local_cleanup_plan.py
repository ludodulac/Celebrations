#!/usr/bin/env python3
"""M030 M04 — SIMULATION LOCALE UNIQUEMENT sur les copies chiffrées M03.

Ne contacte aucun service. Ne touche pas aux médias. Le rapport ne contient aucun
texte de page, e-mail, identité de membre, token ni URL de ressource.
"""
import copy
import hashlib
import json
import sqlite3
import sys
from pathlib import Path

KEEP = "101"
REMOVE = frozenset({"102", "103", "104", "105", "106", "107"})
ALL = REMOVE | {KEEP}
ALLOWED_D1_CHILD_TABLES = {"celebrations_steps"}
REF_KEYS = {"celebrationId", "celebration_id", "targetCelebration", "sourceCelebration", "celebration"}
REPORT = Path("/tmp/m030-m04-report.json")

def require(test, explanation):
    if not test:
        raise RuntimeError(explanation)

def digest(obj):
    content = json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)
    return hashlib.sha256(content.encode("utf-8")).hexdigest()

def table_hash(conn, table):
    rows = [dict(r) for r in conn.execute('SELECT * FROM "' + table + '"')]
    return digest(rows)

def index_of_celebrations(conn):
    records = conn.execute(
        "SELECT id,archangel,year FROM celebrations_celebrations ORDER BY id"
    ).fetchall()
    found = {str(r["id"]) for r in records}
    require(found == ALL, "La copie ne correspond plus aux 7 identités auditées : STOP")
    m = [r for r in records if str(r["id"]) == KEEP]
    require(len(m) == 1 and m[0]["year"] == "2026" and
            m[0]["archangel"] in ("Michaël", "Michael"), "Michaël 101 introuvable")
    return records

def dry_run_d1(sql):
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    try:
        conn.executescript(sql)
        conn.execute("PRAGMA foreign_keys=ON")
        require(not conn.execute("PRAGMA foreign_key_check").fetchall(),
                "Sauvegarde SQL initiale invalide")
        index_of_celebrations(conn)
        tables = [r["name"] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )]
        immutable = {t: table_hash(conn,t) for t in tables
                     if t not in {"celebrations_steps","celebrations_celebrations"}}
        michael_steps_before = [dict(r) for r in conn.execute(
            "SELECT * FROM celebrations_steps WHERE celebration_id=?", (KEEP,))]
        # Generic FK and column inspection: fail closed if a new kind of
        # dependency is present; do not invent cascading deletes.
        refs = {}
        params = tuple(sorted(REMOVE))
        slots = ",".join("?" for _ in params)
        for t in tables:
            info = conn.execute('PRAGMA table_info("' + t + '")').fetchall()
            cols = {r["name"] for r in info}
            foreign_keys = conn.execute('PRAGMA foreign_key_list("' + t + '")').fetchall()
            for key in foreign_keys:
                if key["table"] == "celebrations_celebrations":
                    require(key["from"] in cols, "FK incorrecte : " + t)
            if "celebration_id" in cols:
                count = conn.execute(
                    'SELECT count(*) FROM "' + t + '" WHERE celebration_id IN (' + slots + ')',
                    params
                ).fetchone()[0]
                if count:
                    refs[t] = count
                    require(t in ALLOWED_D1_CHILD_TABLES,
                            "Dépendance D1 inconnue vers les célébrations à supprimer : " + t)
            # Indirect step-key references must not become orphaned.
            if "step_key" in cols and t != "celebrations_steps":
                step_rows = conn.execute(
                    "SELECT step_key FROM celebrations_steps WHERE celebration_id IN (" + slots + ")",
                    params
                ).fetchall()
                keys = sorted({str(row[0]) for row in step_rows if row[0] is not None})
                if keys:
                    step_slots = ",".join("?" for _ in keys)
                    related = conn.execute(
                        'SELECT count(*) FROM "' + t + '" WHERE step_key IN (' + step_slots + ')',
                        keys
                    ).fetchone()[0]
                    require(related == 0,
                            "Références à des étapes supprimables, analyse obligatoire : " + t)
        require(refs == {"celebrations_steps":21},
                "Dépendances D1 modifiées : aucune suppression simulée")
        # BEGIN/ROLLBACK style in an in-memory COPY only.
        conn.execute("BEGIN")
        steps_deleted = conn.execute(
            "DELETE FROM celebrations_steps WHERE celebration_id IN ("+slots+")",params
        ).rowcount
        ids_deleted = conn.execute(
            "DELETE FROM celebrations_celebrations WHERE id IN ("+slots+")",params
        ).rowcount
        require(steps_deleted==21 and ids_deleted==6,
                "Les quantités exactes ne correspondent pas")
        require(not conn.execute("PRAGMA foreign_key_check").fetchall(),
                "Violation d'intégrité D1 après simulation")
        after_ids = {str(r[0]) for r in conn.execute(
            "SELECT id FROM celebrations_celebrations"
        )}
        require(after_ids == {KEEP}, "La célébration Michaël a disparu")
        remain_steps = [dict(r) for r in conn.execute(
            "SELECT * FROM celebrations_steps WHERE celebration_id=?", (KEEP,))]
        require(digest(remain_steps) == digest(michael_steps_before),
                "Étapes Michaël modifiées")
        for t,old in immutable.items():
            require(table_hash(conn,t)==old,
                    "Table hors nettoyage modifiée : "+t)
        conn.rollback()
        index_of_celebrations(conn)
        return {
            "identities_deleted_local_only":ids_deleted,
            "steps_deleted_local_only":steps_deleted,
            "identity_kept":KEEP,
            "michael_steps_preserved":len(michael_steps_before),
            "other_tables_preserved":len(immutable),
            "unplanned_dependencies":0,
            "foreign_key_check":"PASS",
            "local_transaction_rolled_back":True
        }
    finally:
        conn.close()

def walk_refs(value, path="$", depth=0):
    if depth>45:
        raise RuntimeError("Imbrication inattendue")
    found=[]
    if isinstance(value, dict):
        for k,v in value.items():
            if k in REF_KEYS and isinstance(v, (int,str)) and str(v) in REMOVE:
                found.append(path+"."+k)
            if isinstance(v,(dict,list)):
                found.extend(walk_refs(v,path+"."+str(k),depth+1))
    elif isinstance(value,list):
        for i,v in enumerate(value):
            if isinstance(v,(dict,list)):
                found.extend(walk_refs(v,path+"["+str(i)+"]",depth+1))
    return found

def page_ids(record):
    if not isinstance(record,dict):
        return set()
    pages=list(record.get("pages",[]) or [])
    for space in record.get("spaces",[]) or []:
        pages.extend(space.get("pages",[]) or [])
    return {p["id"] for p in pages if isinstance(p,dict) and isinstance(p.get("id"),str)}

def prune_obsolete_media_uses(medias):
    # Media entries, storage references and actual R2 files are immutable.
    # A "uses" entry solely pointing to a deleted celebration is obsolete
    # metadata, not an owned asset. Strip only those use associations in copy.
    require(isinstance(medias,list), "Médiathèque inattendue")
    cleaned=copy.deepcopy(medias)
    detached=0
    for item in cleaned:
        require(isinstance(item,dict), "Fichier média malformé")
        if "uses" not in item:
            continue
        uses=item["uses"]
        require(isinstance(uses,list), "Références média malformées")
        filtered=[use for use in uses if not (isinstance(use,dict)
                   and str(use.get("celebrationId")) in REMOVE)]
        detached+=len(uses)-len(filtered)
        item["uses"]=filtered
    return cleaned,detached

def dry_run_r2(data, return_cleaned=False):
    require(isinstance(data,dict) and
            isinstance(data.get("drafts"),dict) and
            isinstance(data.get("published"),dict), "Snapshot éditeur invalide")
    published=data["published"]
    require(isinstance(published.get("drafts"),dict) and
            isinstance(data.get("shared"),dict), "Publication ou pages générales absentes")
    require(KEEP in data["drafts"] and KEEP in published["drafts"],
            "Michaël 101 doit être conservé en brouillon ET publié")
    media_expected,detached_media_references=prune_obsolete_media_uses(data.get("mediaCatalogue",[]))
    keep={
        "draft":digest(data["drafts"][KEEP]),
        "published":digest(published["drafts"][KEEP]),
        "shared":digest(data["shared"].get("pages",[])),
        "published_shared":digest(published.get("shared",{})),
        "media":digest(media_expected),
        "languages":digest(data.get("localization",{}).get("registry",{})),
        "members":digest({k:v for k,v in data.items()
                          if any(s in k.lower() for s in ("member","person","enroll"))}),
        "original_version":data.get("version")
    }
    gone_pages=set()
    for cid in REMOVE:
        gone_pages |= page_ids(data["drafts"].get(cid))
        gone_pages |= page_ids(published["drafts"].get(cid))
    keep_pages=page_ids(data["drafts"][KEEP])|page_ids(published["drafts"][KEEP])
    keep_pages |= page_ids(data["shared"])|page_ids(published.get("shared",{}))
    require(not gone_pages.intersection(keep_pages),
            "Des identifiants de pages à supprimer sont partagés avec Michaël ou les pages générales")
    # Fail closed on private releases tied to an old celebration, rather than
    # blindly changing private ACL and authentication ledgers.
    for kind in ("privatePageReleases","privateSpaceReleases",
                 "privateTranslationReleases","privateReleaseRevisions",
                 "translationReleases"):
        mapping=published.get(kind,{})
        if isinstance(mapping,dict):
            for key,v in mapping.items():
                require(str(key) not in REMOVE and str(key) not in gone_pages,
                        "Publication privée à traiter séparément : "+kind)
                require(not walk_refs(v), "Droits privés associés : "+kind)
    result=copy.deepcopy(data)
    keys_removed={}
    for k,ref in (
        ("drafts",result),
        ("drafts",result["published"]),
        ("celebrationMetadata",result),
        ("celebrationVisibility",result["shared"]),
        ("celebrationVisibility",result["published"]),
        ("celebrationAccessPolicies",result["published"]),
        ("privateReleaseRevisions",result["published"])
    ):
        entry=ref.get(k)
        if isinstance(entry,dict):
            old=len(entry)
            for cid in REMOVE:
                entry.pop(cid,None)
            keys_removed[k]=keys_removed.get(k,0)+(old-len(entry))
    plans_removed=0
    for ref in (result,result["published"]):
        if isinstance(ref.get("plans"),list):
            before=len(ref["plans"])
            ref["plans"]=[p for p in ref["plans"] if
                          not (isinstance(p,dict) and str(p.get("id")) in REMOVE)]
            plans_removed+=before-len(ref["plans"])
    translations_removed=0
    pages=(result.get("localization") or {}).get("pages")
    if isinstance(pages,dict):
        for pid in gone_pages:
            if pid in pages:
                pages.pop(pid)
                translations_removed+=1
    # Correct ONLY the obsolete usage associations: keep every media asset,
    # every other usage, all stored paths and every R2 media object untouched.
    result["mediaCatalogue"]=media_expected
    refs=walk_refs(result)
    require(not refs,
            "Références résiduelles après simulation : "+",".join(refs[:8]))
    require(result.get("version")==keep["original_version"],
            "Version de snapshot modifiée pendant la simulation")
    checks={
        "draft":digest(result["drafts"][KEEP]),
        "published":digest(result["published"]["drafts"][KEEP]),
        "shared":digest(result["shared"].get("pages",[])),
        "published_shared":digest(result["published"].get("shared",{})),
        "media":digest(result.get("mediaCatalogue",[])),
        "languages":digest(result.get("localization",{}).get("registry",{})),
        "members":digest({k:v for k,v in result.items()
                          if any(s in k.lower() for s in ("member","person","enroll"))})
    }
    for k,v in checks.items():
        require(v==keep[k], "Données à conserver altérées : "+k)
    require(set(result["drafts"])=={KEEP}, "Les brouillons secondaires n'ont pas tous disparu")
    require(set(result["published"]["drafts"])=={KEEP},
            "Les publications secondaires n'ont pas toutes disparu")
    require(digest(data)==digest(copy.deepcopy(data)), "Sauvegarde d'entrée altérée")
    report = {
        "draft_identifiers_deleted_local_only":keys_removed.get("drafts",0),
        "metadata_keys_deleted_local_only":keys_removed.get("celebrationMetadata",0),
        "visibility_and_access_keys_deleted_local_only":(
            keys_removed.get("celebrationVisibility",0)+
            keys_removed.get("celebrationAccessPolicies",0)),
        "obsolete_plans_deleted_local_only":plans_removed,
        "localization_page_keys_deleted_local_only":translations_removed,
        "distinct_orphaned_page_ids":len(gone_pages),
        "michael_draft_pages_preserved":len(data["drafts"][KEEP].get("pages",[])),
        "michael_published_pages_preserved":len(published["drafts"][KEEP].get("pages",[])),
        "general_pages_preserved":len(data["shared"].get("pages",[])),
        "general_published_pages_preserved":len(published.get("shared",{}).get("pages",[])),
        "media_items_preserved":len(data.get("mediaCatalogue",[])),
        "obsolete_media_use_references_detached_local_only":detached_media_references,
        "michael_101_and_shared_unchanged":True,
        "media_objects_deleted":0,
        "remote_writes":0
    }
    return (report, result) if return_cleaned else report

def main():
    require(len(sys.argv)==3, "Usage: verify_local.py database.sql editor.json")
    sql=Path(sys.argv[1]).read_text(encoding="utf-8")
    data=json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    summary={
        "mission":"M030-M04",
        "baseline":"M03 encrypted backup 2026-11-13",
        "removed_ids_proposed":sorted(REMOVE),
        "d1":dry_run_d1(sql),
        "r2":dry_run_r2(data),
        "site_officiel_modifie":False,
        "simulation_locale_seulement":True
    }
    REPORT.write_text(json.dumps(summary,indent=2,ensure_ascii=False),encoding="utf-8")
    print("M030_M04_LOCAL_CLEANUP_DRY_RUN_PASS "+json.dumps(summary,ensure_ascii=False,separators=(",",":")))

if __name__=="__main__":
    main()
