"""R2-024 consistency guards for the R2-023 synchronizer.
This module is additive; integration into live copy path is required before certification.
"""
import hashlib
class SourceChanged(RuntimeError):pass
def sha256_bytes(data):return hashlib.sha256(data).hexdigest()
def certify_snapshot(before,downloaded,after,post_copy=None):
    """Metadata snapshots must match, full bytes must match post-copy reread."""
    if before is None or after is None or before!=after:raise SourceChanged("SOURCE_CHANGED")
    if not before.get("version") and not before.get("etag"):raise SourceChanged("NO_SOURCE_VERSION")
    if post_copy is None:raise SourceChanged("POST_COPY_SOURCE_UNVERIFIED")
    if sha256_bytes(downloaded)!=sha256_bytes(post_copy):raise SourceChanged("SOURCE_CHANGED_AFTER_COPY")
    return {"source_sha256":sha256_bytes(downloaded),"certified_snapshot":True}
def classify_destination(source_sha,dest_sha,exists):
    if not exists:return "CONDITIONAL_PUT_REQUIRED"
    if source_sha!=dest_sha:raise SourceChanged("DESTINATION_CONFLICT")
    return "SKIP_IDENTICAL"
