#!/usr/bin/env python3
"""M030 M03: DRY-RUN restore of an exported D1 SQL dump and editor R2 JSON.
Never connects to Cloudflare or writes to a remote database/bucket.
Print counts only; do not expose text, emails, media keys or tokens.
"""
import json
import sqlite3
import sys
import unicodedata
from pathlib import Path

def main(d1_sql_path, r2_json_path):
    sql = Path(d1_sql_path).read_text(encoding="utf-8")
    data = json.loads(Path(r2_json_path).read_text(encoding="utf-8"))
    assert isinstance(data, dict) and isinstance(data.get("version"), int)
    assert isinstance(data.get("drafts"), dict) and isinstance(data.get("published"), dict)
    assert isinstance(data.get("shared"), dict)
    assert isinstance(data["published"].get("drafts"), dict)
    # Restore the complete D1 dump into a *local in-memory SQLite*, never M016
    # or any named remote Cloudflare D1. Read full SQL, no row/PII export.
    with sqlite3.connect(":memory:") as cx:
        cx.executescript(sql)
        cx.execute("PRAGMA foreign_key_check")
        issues = cx.execute("PRAGMA foreign_key_check").fetchall()
        assert not issues, "Foreign key errors in backup"
        table_names = {
            row[0] for row in cx.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        required = {
            "celebrations_celebrations", "celebrations_steps",
            "celebrations_contents", "celebrations_events",
            "celebrations_directory_people", "celebrations_directory_member_types",
            "celebrations_participants",
        }
        assert required <= table_names, "Full D1 schema missing in backup"
        records = cx.execute(
            "SELECT id,archangel,year FROM celebrations_celebrations ORDER BY id"
        ).fetchall()
        michael = [r for r in records if str(r[0]) == "101"]
        assert len(michael) == 1 and str(michael[0][2]) == "2026"
        arch = "".join(
            ch for ch in unicodedata.normalize("NFD", michael[0][1])
            if unicodedata.category(ch) != "Mn"
        ).lower()
        assert arch == "michael", "Michaël 2026 ID 101 missing"
        assert (
            isinstance(data["drafts"].get("101"), dict)
            and isinstance(data["published"]["drafts"].get("101"), dict)
        ), "Published Michaël pages not backed up"
        assert data["drafts"]["101"].get("pages"), "Michaël has no draft pages"
        assert data["published"]["drafts"]["101"].get("pages"), "Published pages missing"
        print(
            "M030_M03_LOCAL_RESTORE_OK",
            json.dumps(
                {
                    "tables": len(table_names),
                    "celebrations": len(records),
                    "michael_101": "preserved",
                    "editor_revision": data["version"],
                    "michael_draft_page_count": len(data["drafts"]["101"]["pages"]),
                    "michael_published_page_count": len(data["published"]["drafts"]["101"]["pages"]),
                    "shared_pages": len(data["shared"].get("pages", [])),
                    "remote_writes": 0,
                    "sensitive_records_printed": False,
                },
                separators=(",", ":"),
            ),
        )

if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: m030_verify_backup_restore.py <export.sql> <editor.json>")
    main(sys.argv[1], sys.argv[2])
