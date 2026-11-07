#!/usr/bin/env python3
"""MISSION 03 — static analysis of the existing production Worker rollback.

Never deploy. Never call Cloudflare. Inspect pinned rollback versions present
in Git and report whether they match the last known current editor snapshot.
This intentionally *does not* claim a live Cloudflare rollback was rehearsed.
"""
import json
import pathlib
import re
import subprocess

WORKFLOW = pathlib.Path(".github/workflows/celebrations-publish-visual-site-once.yml")
WORKER = "migration/cloudflare/production-worker.mjs"
EDITOR = [
    "migration/cloudflare/editor-demo-client.mjs",
    "migration/cloudflare/editor-demo-style.mjs",
    "migration/cloudflare/editor-demo-preparation-page.mjs",
]
LAST_VERIFIED_OFFICIAL = "7cbfdbd79e2b40f8f4ca4b46dbc97d47e26b742d"


def git_at(ref, path):
    return subprocess.check_output(
        ["git", "show", ref + ":" + path], timeout=18
    )


def main():
    workflow = WORKFLOW.read_text(encoding="utf8")
    refs = re.findall(
        r"git show ([0-9a-f]{40}):migration/cloudflare/(?:production-worker\.mjs|\"\$file\")",
        workflow,
    )
    if not refs:
        raise RuntimeError("Cannot locate the existing rollback version in production workflow")
    refs = sorted(set(refs))
    if len(refs) != 1:
        raise RuntimeError("Inconsistent rollback base SHAs")
    old = refs[0]
    if old == LAST_VERIFIED_OFFICIAL:
        print("M03_ROLLBACK_CODE_BASE current_release_matched=true")
        return
    changed = 0
    for path in [WORKER, *EDITOR]:
        rel = str(path)
        historical = git_at(old, rel)
        latest = git_at(LAST_VERIFIED_OFFICIAL, rel)
        if historical != latest:
            changed += 1
    # The existing workflow references a known fixed historical commit for
    # rollback. This cannot be called an exact return to last deployed code.
    print("M03_ROLLBACK_STATIC_CHECK " + json.dumps({
        "pinned_rollback_commit": old[:12],
        "last_verified_release_commit": LAST_VERIFIED_OFFICIAL[:12],
        "different_relevant_source_files": changed,
        "current_release_exact_rollback": False,
        "cloudflare_live_rollback_performed": False,
        "action": "Revise & validate rollback procedure before risky future deployments",
        "software_writes": 0,
    }, sort_keys=True))


if __name__ == "__main__":
    main()
