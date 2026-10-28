// Mission B ONLY: additive staging visual editor API.
// No production routing, no historical-table writes, no R2 operations.
import {randomUUID} from 'node:crypto';
import {authorize} from './auth-api.mjs';

const STAGING_HOST='celebrations-exit-staging.rondes.workers.dev';
function reply(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}})}
const bad=(msg,status=400)=>reply({ok:false,error:msg},status);
const uuid=x=>typeof x==='string'&&/^[0-9a-f-]{36}$/i.test(x);
function title(x){if(typeof x!=='string'||!x.trim()||x.length>180)throw Error('Invalid title');return x.trim()}
function pagePath(x){if(typeof x!=='string'||!/^\/[a-z0-9][a-z0-9/_-]{0,198}$/.test(x)||x.includes('//')||x.includes('..'))throw Error('Invalid page path');return x}
function payload(kind,data){
 if(!['title','text','banner','button'].includes(kind))throw Error('Invalid block kind');
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Invalid block data');
 const keys=Object.keys(data);
 if(keys.some(k=>!['text','url'].includes(k)))throw Error('Unsupported block data');
 if(typeof data.text!=='string'||data.text.length>4000)throw Error('Invalid block text');
 const value={text:data.text};
 if(kind==='button'){
   if(typeof data.url!=='string'||data.url.length>800||!(data.url.startsWith('/')&&!data.url.startsWith('//')||/^https:\/\//i.test(data.url)))throw Error('Invalid button URL');
   value.url=data.url;
 }else if(keys.includes('url'))throw Error('Invalid block URL');
 return JSON.stringify(value);
}
function positions(blocks){return blocks.map((b,i)=>({...b,position:i}))}
async function row(db,id){return db.prepare('SELECT * FROM editor_b_pages WHERE id=?').bind(id).first()}
async function snapshot(db,id,version){
 const rev=await db.prepare('SELECT title,operation,version,source_version FROM editor_b_revisions WHERE page_id=? AND version=?').bind(id,version).first();
 if(!rev)return null;
 const blocks=await db.prepare('SELECT block_id,kind,data_json,position FROM editor_b_blocks WHERE page_id=? AND version=? ORDER BY position,block_id').bind(id,version).all();
 return {version:rev.version,title:rev.title,operation:rev.operation,source_version:rev.source_version,blocks:(blocks.results||[]).map(b=>({block_id:b.block_id,kind:b.kind,position:b.position,data:JSON.parse(b.data_json)}))};
}
async function save(db,page,expected,headline,blocks,operation,sourceVersion=null){
 if(!Number.isSafeInteger(expected)||expected<1)return bad('Invalid revision');
 if(page.head_version!==expected)return bad('Revision conflict',409);
 if(blocks.length>64)return bad('Too many blocks');
 const next=expected+1;
 // D1 batch is transactional. The unique page_id/version constraint is an
 // additional compare-and-swap guard against two simultaneous writers.
 const statements=[
  db.prepare('INSERT INTO editor_b_revisions(page_id,version,title,operation,source_version) SELECT ?,?,?,?,? FROM editor_b_pages WHERE id=? AND head_version=?').bind(page.id,next,headline,operation,sourceVersion,page.id,expected),
  ...positions(blocks).map(b=>db.prepare('INSERT INTO editor_b_blocks(page_id,version,block_id,position,kind,data_json) VALUES(?,?,?,?,?,?)').bind(page.id,next,b.block_id,b.position,b.kind,JSON.stringify(b.data))),
  db.prepare('UPDATE editor_b_pages SET head_version=?,draft_version=?,published_version=CASE WHEN ?=1 THEN ? ELSE published_version END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND head_version=?').bind(next,next,operation==='publish'?1:0,next,page.id,expected)
 ];
 try{
  const responses=await db.batch(statements);
  if(responses?.at(-1)?.meta?.changes!==1)return bad('Revision conflict',409);
  return reply({ok:true,page_id:page.id,version:next,published:operation==='publish'});
 }catch(e){
  if(/UNIQUE|constraint|FOREIGN KEY/i.test(String(e?.message||e)))return bad('Revision conflict',409);
  throw e;
 }
}
export async function handleEditorB(request,env){
 const url=new URL(request.url);
 if(url.hostname!==STAGING_HOST)return bad('Not found',404);
 if(!env.DB)return bad('Database unavailable',503);
 try{
  const isGet=request.method==='GET';
  const action=isGet?url.searchParams.get('action'):null;
  // Visitors may only see explicitly published snapshots. Drafts are never
  // sent to an anonymous request; all mutations require a live admin session.
  if(isGet&&action==='public'){
   const id=url.searchParams.get('page_id');
   if(!uuid(id))return bad('Not found',404);
   const p=await row(env.DB,id);
   if(!p||p.published_version===null)return bad('Not found',404);
   if(p.celebration_id!==null){
    const c=await env.DB.prepare('SELECT status FROM celebrations_celebrations WHERE id=?').bind(p.celebration_id).first();
    if(!c||String(c.status||'').toLowerCase()!=='active')return bad('Not found',404);
   }
   const view=await snapshot(env.DB,id,p.published_version);
   return view?reply({ok:true,page_id:id,route_path:p.route_path,page:view}):bad('Not found',404);
  }
  const admin=await authorize(request,env,true);
  if(!admin)return bad('Admin authentication required',401);
  if(isGet&&action==='draft'){
   const id=url.searchParams.get('page_id');
   if(!uuid(id))return bad('Not found',404);
   const p=await row(env.DB,id);
   if(!p)return bad('Not found',404);
   return reply({ok:true,page_id:id,route_path:p.route_path,head_version:p.head_version,published_version:p.published_version,page:await snapshot(env.DB,id,p.draft_version)});
  }
  if(request.method!=='POST')return bad('Unsupported method',405);
  const raw=await request.text();
  if(raw.length>16000)return bad('Payload too large',413);
  let b;try{b=JSON.parse(raw)}catch{return bad('Invalid JSON')}
  if(!b||typeof b!=='object'||Array.isArray(b))return bad('Invalid payload');
  if(b.action==='create'){
   const name=title(b.title),path=pagePath(b.route_path),id=randomUUID();
   const celebration=b.celebration_id===undefined||b.celebration_id===null?null:b.celebration_id;
   if(celebration!==null){
    if(!Number.isSafeInteger(celebration)||celebration<1)return bad('Invalid celebration id');
    const c=await env.DB.prepare('SELECT id FROM celebrations_celebrations WHERE id=?').bind(celebration).first();
    if(!c)return bad('Unknown celebration');
   }
   const step=b.step_key===undefined||b.step_key===null?null:String(b.step_key);
   if(step!==null&&!['Préparation','Mercredi','Jeudi','Vendredi','Samedi','Dimanche','Après célébration'].includes(step))return bad('Invalid stage');
   try{
    await env.DB.batch([
     env.DB.prepare('INSERT INTO editor_b_pages(id,route_path,celebration_id,step_key) VALUES(?,?,?,?)').bind(id,path,celebration,step),
     env.DB.prepare("INSERT INTO editor_b_revisions(page_id,version,title,operation) VALUES(?,1,?,'create')").bind(id,name)
    ]);
   }catch(e){if(/UNIQUE|constraint/i.test(String(e.message||e)))return bad('Page route already exists',409);throw e}
   return reply({ok:true,page_id:id,version:1,published:false},201);
  }
  if(!uuid(b.page_id))return bad('Invalid page id');
  const p=await row(env.DB,b.page_id);
  if(!p)return bad('Not found',404);
  if(!Number.isSafeInteger(b.expected_version)||b.expected_version!==p.head_version)return bad('Revision conflict',409);
  const snap=await snapshot(env.DB,p.id,p.draft_version);
  if(!snap)return bad('Missing draft version',503);
  let blocks=snap.blocks.map(x=>({...x}));
  let name=snap.title,operation='block',source=null;
  switch(b.action){
  case 'edit_title':name=title(b.title);operation='edit';break;
  case 'add_block':{
   if(blocks.length>=64)return bad('Too many blocks');
   const kind=b.kind;const data=JSON.parse(payload(kind,b.data));
   const idx=b.position===undefined?blocks.length:b.position;
   if(!Number.isSafeInteger(idx)||idx<0||idx>blocks.length)return bad('Invalid block position');
   blocks.splice(idx,0,{block_id:randomUUID(),kind,data});break;
  }
  case 'edit_block':{
   const match=blocks.find(x=>x.block_id===b.block_id);
   if(!match)return bad('Block not found',404);
   const kind=b.kind||match.kind;
   match.kind=kind;match.data=JSON.parse(payload(kind,b.data));break;
  }
  case 'move_block':{
   const index=blocks.findIndex(x=>x.block_id===b.block_id);
   const pos=b.position;
   if(index<0)return bad('Block not found',404);
   if(!Number.isSafeInteger(pos)||pos<0||pos>=blocks.length)return bad('Invalid block position');
   blocks.splice(pos,0,blocks.splice(index,1)[0]);break;
  }
  case 'remove_block':{
   const i=blocks.findIndex(x=>x.block_id===b.block_id);
   if(i<0)return bad('Block not found',404);
   blocks.splice(i,1);break;
  }
  case 'restore':{
   if(!Number.isSafeInteger(b.source_version)||b.source_version<1||b.source_version>p.head_version)return bad('Invalid source version');
   const older=await snapshot(env.DB,p.id,b.source_version);
   if(!older)return bad('Unknown version',404);
   name=older.title;blocks=older.blocks;operation='restore';source=b.source_version;break;
  }
  case 'publish':{
   if(p.celebration_id!==null){
    const c=await env.DB.prepare('SELECT status FROM celebrations_celebrations WHERE id=?').bind(p.celebration_id).first();
    if(!c||String(c.status||'').toLowerCase()!=='active')return bad('Unpublished celebration: publication forbidden',403);
   }
   operation='publish';break;
  }
  default:return bad('Unsupported action');
  }
  return save(env.DB,p,b.expected_version,name,blocks,operation,source);
 }catch(e){
  if(e.message?.startsWith('Invalid ')||e.message==='Unsupported block data'||e.message==='Unsupported block URL')return bad(e.message);
  // Do not expose database errors, bindings or secrets to the client.
  return bad('Editor operation unavailable',503);
 }
}
