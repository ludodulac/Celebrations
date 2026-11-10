import {participantIdentity} from "./audience-api.mjs";
import {isPrivateMediaReference} from "./app/security/public-media-boundary.mjs";
// Historical READ-ONLY public D1 contract. M002/M007 member types are never
// inferred from legacy all/angel/nonangel audience labels. No directory,
// identity, draft, access-policy or private-space tables are exposed here.
const columns=Object.freeze({
 celebrations_celebrations:'id,archangel,year,status,created_at,updated_at',
 celebrations_steps:'id,celebration_id,step_key,label,start_date,end_date,body_text,sort_order',
 celebrations_events:'id,celebration_id,step_key,title,event_time,description,audience,sort_order,created_at,updated_at',
 celebrations_contents:'id,name,content_type,source_type,audience,storage_path,external_url,file_name,mime_type,has_cover,cover_storage_path,audio_kind,created_at,updated_at,description,inline_text,category,cover_file_name',
 celebrations_event_contents:'event_id,content_id,sort_order',
 celebrations_step_contents:'celebration_id,step_key,content_id,sort_order',
 celebrations_links:'id,celebration_id,step_key,event_id,label,url,sort_order,created_at,link_type',
 celebrations_groups:'id,name,sort_order,is_system,created_at,updated_at'
});
const tables=new Set([...Object.keys(columns),'celebrations_public_settings','celebrations_footer_drafts']);
// Explicit projection: future private columns do NOT become public just
// because someone adds them to a historical SQL table.
const noPrivate=(prefix,fields)=>fields.map(field=>
  "INSTR(LOWER(COALESCE("+prefix+field+",'')),'private-members')=0"
).join(' AND ');
const safeContents=prefix=>noPrivate(prefix,[
 'storage_path','cover_storage_path','external_url','file_name'
]);
const contentFields=['storage_path','cover_storage_path','external_url','file_name'];
const sensitiveFields=['url','storage_path','cover_storage_path','external_url',
 'file_name','body_text','inline_text','description','content','title','name'];
const filtered=rows=>Array.isArray(rows)?rows.filter(row=>row&&typeof row==='object'&&
 !sensitiveFields.some(key=>isPrivateMediaReference(row[key]))):[];
const respond=(data,status=200)=>new Response(JSON.stringify(data),{
 status,headers:{'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store','cdn-cache-control':'no-store',
  'vary':'Authorization, Cookie','x-content-type-options':'nosniff',
  'x-robots-tag':'noindex, nofollow, noarchive','referrer-policy':'no-referrer'}
});
export async function handlePublicData(request,env){
 if(request.method!=='GET')return respond({error:'Method not allowed'},405);
 if(!env?.DB)return respond({error:'Database unavailable'},503);
 const u=new URL(request.url),name=u.searchParams.get('table');
 if(name==='celebrations_footer_page'){
  const slug=u.searchParams.get('slug');
  if(!['mentions-legales','confidentialite','cookies'].includes(slug))
   return respond({error:'Not found'},404);
  try{
   const r=await env.DB.prepare('SELECT title,content FROM celebrations_footer_drafts WHERE slug=? AND is_active=1 AND is_public=1 ORDER BY updated_at DESC,id DESC LIMIT 1').bind(slug).all();
   return respond(filtered(r.results));
  }catch{return respond({error:'Query unavailable'},503)}
 }
 if(!tables.has(name))return respond({error:'Not found'},404);
 const bearer=request.headers.get('authorization')||'';
 const identity=bearer.startsWith('Bearer ')?await participantIdentity(env,bearer.slice(7)):null;
 // Historic visitor filtering only; this is NOT an M002 authorization grant.
 const audience=['angel','nonangel'].includes(identity?.audience)?identity.audience:null;
 const filter=audience?"('all','"+audience+"')":"('all')";
 let sql=name==='celebrations_public_settings'
  ? 'SELECT show_other_celebrations FROM celebrations_public_settings WHERE id=1 LIMIT 1'
  : name==='celebrations_footer_drafts'
  ? 'SELECT slug FROM celebrations_footer_drafts WHERE is_active=1 AND is_public=1'
  : 'SELECT '+columns[name]+' FROM "'+name+'"';
 if(name==='celebrations_contents')
  sql+=' WHERE audience IN '+filter+' AND '+safeContents('');
 if(name==='celebrations_events')sql+=' WHERE audience IN '+filter;
 // Preserve the optimized one-pass PK join; both parents must be released and
 // the content must NOT reference the protected private R2 namespace.
 if(name==='celebrations_event_contents')
  sql='SELECT ec.event_id,ec.content_id,ec.sort_order FROM celebrations_event_contents ec'
   +' CROSS JOIN celebrations_contents c CROSS JOIN celebrations_events e'
   +' WHERE ec.content_id=c.id AND ec.event_id=e.id'
   +' AND c.audience IN '+filter+' AND e.audience IN '+filter
   +' AND '+safeContents('c.');
 if(name==='celebrations_links')
  sql+=' WHERE (event_id IS NULL OR event_id IN (SELECT id FROM celebrations_events WHERE audience IN '+filter+'))'
    +' AND '+noPrivate('', ['url']);
 if(name==='celebrations_step_contents')
  sql+=' WHERE content_id IN (SELECT id FROM celebrations_contents WHERE audience IN '+filter
    +' AND '+safeContents('')+')';
 try{
  const data=await env.DB.prepare(sql).all();
  return respond(filtered(data.results));
 }catch{return respond({error:'Query unavailable'},503)}
}
