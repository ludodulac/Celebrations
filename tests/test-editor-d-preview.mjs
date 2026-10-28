import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleEditorD,handleEditorDSession,handleEditorDEntry} from '../migration/cloudflare/editor-d-preview.mjs';
import {createHash} from 'node:crypto';

function dbFixture(){
 const s=new DatabaseSync(':memory:');
 s.exec('PRAGMA foreign_keys=ON; CREATE TABLE celebrations_celebrations(id INTEGER PRIMARY KEY,archangel TEXT,status TEXT,year TEXT); CREATE TABLE celebrations_steps(id INTEGER PRIMARY KEY,celebration_id INTEGER,step_key TEXT,start_date TEXT,end_date TEXT); CREATE TABLE celebrations_contents(id TEXT PRIMARY KEY,name TEXT,content_type TEXT,source_type TEXT,storage_path TEXT,external_url TEXT,inline_text TEXT,audience TEXT,description TEXT,has_cover INTEGER,cover_storage_path TEXT); CREATE TABLE celebrations_admin_sessions(token_hash TEXT PRIMARY KEY,admin_email TEXT,expires_at TEXT);');
 s.exec(readFileSync(new URL('../migration/cloudflare/editor-b-schema.sql',import.meta.url),'utf8'));
 s.exec(readFileSync(new URL('../migration/cloudflare/editor-c-schema.sql',import.meta.url),'utf8'));
 s.prepare("INSERT INTO celebrations_celebrations(id,archangel,status,year) VALUES(101,'Michaël','active','2026')").run();
 s.prepare("INSERT INTO celebrations_steps(id,celebration_id,step_key,start_date,end_date) VALUES(1,101,'mercredi-101','2026-10-28','2026-10-29')").run();
 s.prepare("INSERT INTO celebrations_contents(id,name,content_type,source_type,storage_path,audience,has_cover) VALUES('p1','Programme.pdf','PDF','file','media/programme.pdf','all',0)").run();
 s.prepare("INSERT INTO celebrations_contents(id,name,content_type,source_type,storage_path,audience,has_cover) VALUES('private','Réservé','Audio','file','media/private.wav','angel',0)").run();
 function page(key,title,blocks){
  const id='aaa00000-0000-4000-8000-'+String(s.prepare('SELECT COUNT(*) as n FROM editor_b_pages').get().n+1).padStart(12,'0');
  s.prepare('INSERT INTO editor_b_pages(id,route_path,celebration_id,head_version,draft_version,published_version) VALUES(?,?,?,?,1,NULL)').run(id,'/__editor/legacy/'+key,key.startsWith('celebration')?101:null,1);
  s.prepare("INSERT INTO editor_b_revisions(page_id,version,title,operation) VALUES(?,1,?,'create')").run(id,title);
  s.prepare('INSERT INTO editor_c_imports(page_id,source_key,original_route,source_sha256,imported_version) VALUES(?,?,?,?,1)').run(id,key,'/','synthetic');
  for(const [position,b] of blocks.entries())s.prepare('INSERT INTO editor_c_blocks(page_id,version,block_id,position,legacy_kind,source_table,source_id,data_json) VALUES(?,1,?,?,?,?,?,?)').run(id,'block'+position,position,b.kind,b.table||'static','id'+position,JSON.stringify(b.data));
 }
 page('home','Accueil général',[
  {kind:'static_html_snapshot',data:{html:'<h1>Bienvenue</h1><p>Site actuel</p><script>alert("LEAK")</script><img src=x onerror=alert(1)>'}},
  {kind:'legacy_featured_content',data:{content_id:'p1'}}]);
 page('celebration:101','Archange Michaël',[
  {kind:'celebration_record',data:{record:{id:101,archangel:'Michaël',year:'2026',status:'active'}}}]);
 page('celebration:101:step:Mercredi','Mercredi',[
  {kind:'legacy_day',data:{record:{label:'Mercredi',start_date:'2026-10-28',body_text:'<img src=x onerror=alert(1)>'}}},
  {kind:'legacy_event',data:{record:{title:'Réunion',event_time:'18:00',description:'Concert',audience:'all'},ordered_content_refs:[{content_id:'p1',sort_order:0},{content_id:'private',sort_order:1}],links:[]}}]);
 page('legal:mentions-legales','Mentions légales',[
  {kind:'legal_draft',data:{record:{title:'Mentions',content:'Texte légal',is_public:0,draft_number:1}}}]);
 const DB={
  prepare(sql){const q=s.prepare(sql);return{
   async first(){return q.get()||null},
   async all(){return{results:q.all()}},
   bind(...args){return{
    first:async()=>q.get(...args)||null,
    all:async()=>({results:q.all(...args)})
   }}
  }}
 };
 return {DB,sqlite:s,close:()=>s.close()};
}
const root='https://celebrations-exit-staging.rondes.workers.dev';
test('D only returns HTML to authenticated staging preview; no historical inline scripts execute',async()=>{
 const {DB,close}=dbFixture();
 try{
  const env={DB,EDITOR_D_PREVIEW_TOKEN:'a'.repeat(64)};
  const req=(key,headers={})=>new Request(root+'/__editor/preview?key='+encodeURIComponent(key),{headers});
  assert.equal((await handleEditorD(req('home'),env)).status,401);
  assert.equal((await handleEditorD(new Request('https://www.example.com/__editor/preview?key=home',{headers:{'x-editor-d-preview-token':'a'.repeat(64)}}),env)).status,404);
  assert.equal((await handleEditorD(req('home',{'x-editor-d-preview-token':'b'.repeat(64)}),env)).status,401);
  const headers={'x-editor-d-preview-token':'a'.repeat(64)};
  const res=await handleEditorD(req('home',headers),env);
  assert.equal(res.status,200);
  const html=await res.text();
  assert.ok(html.includes('Bienvenue')&&html.includes('Programme.pdf'));
  assert.ok(!html.includes('LEAK'),'Raw historic script was leaked');
  assert.ok(!/<img\\b[^>]*\\bonerror=/i.test(html),'Executable historical event handler was leaked');
  assert.match(res.headers.get('content-security-policy'),/script-src 'none'/);
  assert.equal(res.headers.get('cache-control'),'no-store');
  assert.equal((await handleEditorD(req('not-existing',headers),env)).status,404);
  const step=await (await handleEditorD(req('celebration:101:step:Mercredi',headers),env)).text();
  assert.ok(step.includes('Réunion')&&step.includes('28 octobre 2026')&&step.includes('media/programme.pdf'));
  assert.ok(step.includes('Accès réservé'),'Restricted audio not embedded as public');
  assert.ok(!step.includes('src="/media/media/private.wav"'),'Restricted media leaked');
  assert.ok(step.includes('&lt;img src=x onerror=alert(1)&gt;'),'Untrusted text escaped');
  const legal=await(await handleEditorD(req('legal:mentions-legales',headers),env)).text();
  assert.ok(legal.includes('Brouillon légal non public'));
  console.log('MISSION_D_RENDER_SECURITY_PASS html=true navigation=true dates=true pdf=true private_media_hidden=true legal=true no_raw_scripts=true');
 }finally{close()}
});

test('D2 navigation uses a short-lived admin cookie and rejects revoked sessions',async()=>{
 const {DB,sqlite,close}=dbFixture();
 try{
  const raw='synthetic-session-token-'.padEnd(64,'x');
  const hash=createHash('sha256').update(raw).digest('hex');
  sqlite.prepare('INSERT INTO celebrations_admin_sessions(token_hash,admin_email,expires_at) VALUES(?,?,?)')
   .run(hash,'synthetic@example.invalid',new Date(Date.now()+15*60*1000).toISOString());
  const env={DB,EDITOR_D_PREVIEW_TOKEN:'a'.repeat(64)};
  const get=(key,headers={})=>new Request(root+'/__editor/preview?key='+encodeURIComponent(key),{headers});
  assert.equal((await handleEditorDSession(new Request(root+'/__editor/session',{method:'POST'}),env)).status,401);
  const exchange=await handleEditorDSession(new Request(root+'/__editor/session',{
   method:'POST',headers:{authorization:'Bearer '+raw}}),env);
  assert.equal(exchange.status,200);
  const cookie=exchange.headers.get('set-cookie')||'';
  assert.match(cookie,/HttpOnly; SameSite=Strict/);
  assert.match(cookie,/Path=\\/__editor\\//);
  const credential=cookie.split(';')[0];
  const page=await handleEditorD(get('home',{cookie:credential}),env);
  assert.equal(page.status,200);
  const html=await page.text();
  assert.ok(html.includes('d-welcome')&&html.includes('d-home-banner'),'Home visual structure missing');
  assert.ok(html.includes('Accéder aux célébrations'));
  assert.ok(html.includes('/__editor/preview?key=celebration%3A101'),'Not navigable via links');
  const step=await handleEditorD(get('celebration:101:step:Mercredi',{cookie:credential}),env);
  assert.equal(step.status,200,'Internal links retain authenticated navigation');
  assert.equal((await handleEditorD(get('home',{cookie:'d2_preview=tampered'}),env)).status,401);
  sqlite.prepare('DELETE FROM celebrations_admin_sessions WHERE token_hash=?').run(hash);
  assert.equal((await handleEditorD(get('home',{cookie:credential}),env)).status,401,'Revoked session remained valid');
  const entry=await handleEditorDEntry(new Request(root+'/__editor/entry'),env);
  assert.equal(entry.status,200);
  assert.match(entry.headers.get('content-security-policy'),/nonce-/);
  assert.ok((await entry.text()).includes('celebrations-admin-token'));
  console.log('MISSION_D2_COOKIE_SECURITY_PASS live_session_only=true revoked_401=true nav=true');
 }finally{close()}
});
