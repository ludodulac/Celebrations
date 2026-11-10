// M009-C: gate OLD /media/new/<uuid> uploads before touching the editor bucket.
// Those URLs previously served any guessed/obtained draft UUID without checking
// whether the upload had ever been published. NOT a private member endpoint.
import {readEditorState,handleEditorMediaFile} from './editor-publication-api.mjs';
import {hasEditorAccess} from './editor-site-access.mjs';
import {canAccessPage} from './app/domain/member-access.mjs';
import {privateNotFound} from './app/security/member-private-access.mjs';
import {isPrivateMediaRecord,isPrivateMediaReference,publicMediaBindingsSafe}
  from './app/security/public-media-boundary.mjs';

const uploadPath=/^\/media\/new\/[0-9a-f]{8}-[0-9a-f-]{27}\.(?:jpg|png|webp|pdf|mp3|wav)$/;
const pubPage=page=>page&&page.visibility!=='hidden'&&
 page.visibility!=='draft'&&canAccessPage(page);
function hasReference(value,src){
 if(!value||typeof value!=='object')return false;
 const queue=[value],seen=new Set();
 for(let n=0;queue.length&&n<10000;n++){
  const item=queue.pop();
  if(!item||typeof item!=='object'||seen.has(item))continue;
  seen.add(item);
  if(['src','href','url'].some(key=>item[key]===src))return true;
  for(const [k,v] of Object.entries(item))
   if(k!=='translations'&&v&&typeof v==='object')queue.push(v);
 }
 return false;
}
function publishedPageReferences(state,src){
 const published=state.published;
 if(!published)return false;
 const pages=[...(published.shared?.pages||[])];
 for(const record of Object.values(published.drafts||{}))
  if(Array.isArray(record?.pages))pages.push(...record.pages);
 return pages.some(page=>pubPage(page)&&hasReference(page.blocks||[],src));
}
function publicRelease(state,src){
 if(!state.published)return false; // drafts NEVER imply publication
 const entry=(state.mediaCatalogue||[]).find(row=>row?.src===src);
 if(entry&&isPrivateMediaRecord(entry))return false;
 if(publishedPageReferences(state,src))return true;
 // Existing admin "general gallery" toggles are explicit public releases,
 // not membership grants. A marked/private file can never be promoted.
 return entry?.general===true&&entry.source==='uploaded';
}
const secure=(response,publicFile)=>{
 const headers=new Headers(response.headers);
 headers.set('cache-control','private, no-store, max-age=0');
 headers.set('cdn-cache-control','no-store');
 headers.set('vary','Authorization, Cookie');
 headers.set('x-content-type-options','nosniff');
 headers.set('referrer-policy','no-referrer');
 headers.set('x-robots-tag','noindex, nofollow, noarchive');
 headers.delete('etag');headers.delete('last-modified');
 headers.delete('surrogate-control');headers.delete('expires');
 if(!publicFile)headers.set('content-disposition','attachment');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
};
export async function handlePublicEditorUpload(request,env){
 if(request.method!=='GET'&&request.method!=='HEAD')return privateNotFound();
 const path=new URL(request.url).pathname;
 if(!uploadPath.test(path)||isPrivateMediaReference(path))return privateNotFound();
 if(!env?.EDITOR_BUCKET||!publicMediaBindingsSafe(env))
  return secure(new Response('Stockage indisponible',{status:503}),false);
 try{
  // No trust in guessed UUID, legacy audience, client role or admin bearer.
  const {state}=await readEditorState(env.EDITOR_BUCKET);
  const entry=(state.mediaCatalogue||[]).find(row=>row?.src===path);
  if(entry&&isPrivateMediaRecord(entry))return privateNotFound();
  const visible=publicRelease(state,path);
  const editor=visible?false:await hasEditorAccess(request,env);
  if(!visible&&!editor)return privateNotFound();
  const response=await handleEditorMediaFile(request,env);
  return secure(response,visible);
 }catch{return secure(new Response('Stockage indisponible',{status:503}),false)}
}
