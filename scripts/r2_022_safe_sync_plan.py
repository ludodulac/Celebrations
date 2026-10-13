"""R2-022 safe sync planner: DRY_RUN always; no upload/delete operations."""
import json,hashlib,sys
def compare(source,destination):
    """Mappings of path to SHA-256 digest. Never infer safety from matching names."""
    actions=[]
    for path,digest in sorted(source.items()):
        if path not in destination:actions.append({"path":path,"action":"WOULD_COPY_AFTER_AUTHORIZATION"})
        elif destination[path]!=digest:actions.append({"path":path,"action":"CONFLICT_STOP"})
        else:actions.append({"path":path,"action":"SKIP_IDENTICAL"})
    for path in sorted(set(destination)-set(source)):
        actions.append({"path":path,"action":"ORPHAN_REVIEW_NO_DELETE"})
    return actions
def safe_summary(actions):
    return {name:sum(a["action"]==name for a in actions) for name in sorted({a["action"] for a in actions})}
if __name__=="__main__":
    if len(sys.argv)!=3:sys.exit("usage: safe_sync_plan.py source_hashes.json r2_hashes.json")
    with open(sys.argv[1]) as f:src=json.load(f)
    with open(sys.argv[2]) as f:dst=json.load(f)
    actions=compare(src,dst)
    print(json.dumps({"mode":"DRY_RUN","counts":safe_summary(actions)},sort_keys=True))
    # No object keys printed. No network clients, no mutations, no uploads or deletes.
