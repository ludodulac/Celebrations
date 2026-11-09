// M10 — single Cloudflare R2 adapter used by draft, publication and media
// metadata routes. No blind PUT retry, no fall-through to non-conditional writes.
import {EDITOR_SNAPSHOT_KEY} from '../ports/editor-snapshot-contract.mjs';
export async function readEditorSnapshot(bucket,{empty,validate,requireBody=false,invalidMessage='Editor snapshot invalid'}){
 const item=await bucket.get(EDITOR_SNAPSHOT_KEY);
 if(!item)return {state:empty(),etag:null};
 if(requireBody&&!item.body)throw Error('Draft inaccessible');
 const state=JSON.parse(await item.text());
 if(!validate(state))throw Error(invalidMessage);
 return {state,etag:item.etag};
}
export async function putEditorSnapshot(bucket,previousEtag,serialized){
 const onlyIf=previousEtag?{etagMatches:previousEtag}:{etagDoesNotMatch:'*'};
 const result=await bucket.put(EDITOR_SNAPSHOT_KEY,serialized,{
  httpMetadata:{contentType:'application/json'},onlyIf
 });
 return !!result;
}
