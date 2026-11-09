// M10 — existing editor snapshot protocol. No Cloudflare or browser dependency.
// One revision protects both the draft and its selectively published counterpart.
export const EDITOR_SNAPSHOT_KEY='editor-trials/server-drafts-v1.json';
export const EDITOR_SNAPSHOT_LIMIT=5000000;
export function expectedRevisionMatches(submitted,current){
 return Number.isSafeInteger(submitted)&&submitted>=0&&submitted===current;
}
