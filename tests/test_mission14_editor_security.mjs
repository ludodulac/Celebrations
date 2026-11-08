import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../migration/cloudflare/production-worker.mjs';
import {handleServerDraft} from '../migration/cloudflare/editor-server-draft-api.mjs';
import {handleEditorMedia,handleEditorPublication,publicSnapshot} from '../migration/cloudflare/editor-publication-api.mjs';
import {hasEditorAccess} from '../migration/cloudflare/editor-site-access.mjs';
import {
 OFFICIAL_EDITOR_HOSTS,READONLY_CANDIDATE_HOSTS,
 isOfficialEditorHost,isReadonlyCandidateHost,isPrivateEditorPath,
 sameOriginEditorWrite
} from '../migration/cloudflare/app/security/editor-route-policy.mjs';

const SECRET='a'.repeat(64);
const official='https://www.ronde-des-archanges-universelle.eu';
const apex='https://ronde-des-archanges-universelle.eu';
const preview='https://celebrations-visual-candidate.rondes.workers.dev';
const candidate='https://celebrations-exit-production.rondes.workers.dev';
const staging='https://celebrations-exit-staging.rondes.workers.dev';
const PAGES={
 version:1,updatedAt:'2026-11-07T10:00:00.000Z',
 drafts:{'101':{pages:[
  {id:'mercredi-101',name:'Mercredi',group:'celebration',visibility:'published',
   blocks:[{id:100,kind:'text',text:'Texte public'}]},
  {id:'extra-01234567-89ab-4cde-8f01-123456789abc-101',
   name:'Dossier confidentiel',group:'celebration',visibility:'draft',
   blocks:[{id:101,kind:'text',text:'SECRET_PRIVATE_DRAFT_DO_NOT_LEAK'}]}
 ],celebrationDates:{},celebrationTimes:{}}},
 plans:[{id:'plan-michael-2028-05-10',date:'2028-05-10',
  title:'SECRET_PLANNED_CELEBRATION',archangel:'Michaël',visibility:'draft'}],
 shared:{pages:[{id:'neutral-accueil-general',name:'Accueil',group:'page',
  visibility:'published',blocks:[{kind:'heading',id:1,text:'Accueil'}]}],
 homeId:'neutral-accueil-general'},
 mediaCatalogue:[{id:'image|/media/new/12345678-1234-4234-8234-123456789abc.jpg',
  src:'/media/new/12345678-1234-4234-8234-123456789abc.jpg',
  source:'uploaded',name:'SECRET_MEDIA_NAME.jpg',type:'image',general:false}]
};
function mock(){
 const calls={read:0,write:0,assets:0};
 const bucket={
  async get(key){
   calls.read++;
   assert.equal(key,'editor-trials/server-drafts-v1.json');
   return {body:true,etag:'22',text:async()=>JSON.stringify(PAGES)};
  },
  async put(){calls.write++;throw Error('Blocked: no actual writes allowed')}
 };
 const env={EDITOR_BUCKET:bucket,MEDIA_BUCKET:bucket,ADMIN_PASSWORD_HASH:SECRET,
  DB:{prepare(){throw Error('A private-route denial must not query D1')}},
  ASSETS:{async fetch(){calls.assets++;
   return new Response('THIS SECRET STATIC FILE MUST NEVER BE RETURNED')}}
 };
 return {env,calls};
}
const request=(root,path,init={})=>new Request(root+path,init);
async function authorized(){
 const payload=String(Date.now())+'.'+'b'.repeat(32);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(SECRET),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=await crypto.subtle.sign('HMAC',key,
  new TextEncoder().encode('site-editor-v1:'+payload));
 return 'celebrations_editor_access='+payload+'.'+Buffer.from(signature).toString('hex');
}
const saveBody=()=>({
 celebration:'101',expectedRevision:1,record:PAGES.drafts['101'],
 plans:PAGES.plans,shared:PAGES.shared
});

test('M14: official domains and read-only preview hosts are explicit whitelists',()=>{
 assert.deepEqual([...OFFICIAL_EDITOR_HOSTS],[apex.slice(8),official.slice(8)]);
 assert.deepEqual([...READONLY_CANDIDATE_HOSTS],[candidate.slice(8),preview.slice(8)]);
 for(const host of OFFICIAL_EDITOR_HOSTS){
  assert.equal(isOfficialEditorHost(host),true);
  assert.equal(isReadonlyCandidateHost(host),false);
 }
 for(const host of READONLY_CANDIDATE_HOSTS){
  assert.equal(isReadonlyCandidateHost(host),true);
  assert.equal(isOfficialEditorHost(host),false);
 }
 for(const fake of ['www.ronde-des-archanges-universelle.eu.attacker.example',
  'RONDE-DES-ARCHANGES-UNIVERSELLE.EU','localhost','candidate.invalid']){
  assert.equal(isOfficialEditorHost(fake),false);
  assert.equal(isReadonlyCandidateHost(fake),false);
 }
});
test('M14: private admin endpoints are never public-preview routes',()=>{
 for(const path of ['/admin','/admin.html','/__editor/demo-preparation',
  '/__editor/edit','/__editor/e1-client.js',
  '/api/editor-open-draft','/api/editor-server-draft','/api/editor-media',
  '/api/editor-access','/api/editor-logout'])
  assert.equal(isPrivateEditorPath(path),true,path);
 for(const publicPath of ['/','/preparation','/__editor/voir-le-site',
  '/api/editor-publication','/media/new/1234.jpg','/robots.txt',
  '/mediatheque-generale','/letter/document.pdf'])
  assert.equal(isPrivateEditorPath(publicPath),false,publicPath);
});
test('M14: all private GETs on read-only candidate stop before D1/R2 or static assets',async()=>{
 const routes=['/admin','/admin.html','/__editor/demo-preparation?celebration=101',
  '/api/editor-open-draft?celebration=101','/api/editor-server-draft?celebration=101',
  '/api/editor-media','/api/editor-access','/api/editor-logout'];
 for(const root of [candidate,preview]){
  const {env,calls}=mock();
  for(const path of routes){
   const res=await worker.fetch(request(root,path),env);
   assert.equal(res.status,404,root+path);
   assert.equal(res.headers.get('cache-control'),'no-store');
   assert.match(res.headers.get('x-robots-tag')||'',/noindex/);
   assert.doesNotMatch(await res.text(),/SECRET_/);
  }
  assert.deepEqual(calls,{read:0,write:0,assets:0},
   'No private routing may fall through to storage or public static assets');
 }
});
test('M14: candidate POSTs still fail as read-only before any write',async()=>{
 for(const root of [candidate,preview]){
  const {env,calls}=mock();
  for(const path of ['/api/editor-open-draft','/api/editor-publication',
   '/api/editor-media','/api/editor-logout']){
   const r=await worker.fetch(request(root,path,{
    method:'POST',headers:{origin:root,'content-type':'application/json'},
    body:JSON.stringify(saveBody())}),env);
   assert.equal(r.status,405,path);
  }
  assert.equal(calls.read,0);
  assert.equal(calls.write,0);
 }
});
test('M14: direct preview draft API GET cannot reveal a private snapshot',async()=>{
 const {env,calls}=mock();
 const r=await handleServerDraft(request(preview,'/api/editor-open-draft?celebration=101'),env);
 assert.equal(r.status,404);
 assert.doesNotMatch(await r.text(),/SECRET_/);
 assert.deepEqual(calls,{read:0,write:0,assets:0});
 const post=await handleServerDraft(request(preview,'/api/editor-open-draft',{
  method:'POST',headers:{origin:preview,'content-type':'application/json'},
  body:JSON.stringify(saveBody())}),env);
 assert.equal(post.status,405);
 assert.deepEqual(calls,{read:0,write:0,assets:0});
});
test('M14: official private draft GET is denied in handler and router without signed cookie',async()=>{
 for(const root of [official,apex]){
  const {env,calls}=mock();
  const r=await handleServerDraft(request(root,'/api/editor-open-draft?celebration=101'),env);
  assert.equal(r.status,401);
  assert.equal(calls.read,0);
  const routed=await worker.fetch(request(root,'/api/editor-open-draft?celebration=101'),env);
  assert.equal(routed.status,401);
  assert.equal(calls.read,0);
  assert.doesNotMatch(await routed.text(),/SECRET_/);
 }
});
test('M14: forged or invalid cookie cannot be replayed across domain boundary',async()=>{
 const {env,calls}=mock();
 for(const forged of ['celebrations_editor_access=0.x.fake',
  'celebrations_editor_access=1700000000000.'+'a'.repeat(32)+'.'+'f'.repeat(64)]){
  const r=await handleServerDraft(request(official,
   '/api/editor-open-draft?celebration=101',{headers:{cookie:forged}}),env);
  assert.equal(r.status,401);
 }
 assert.equal(calls.read,0);
 const valid=await authorized();
 assert.equal(await hasEditorAccess(request(preview,'/admin',{headers:{cookie:valid}}),env),false);
 assert.equal(await hasEditorAccess(request(candidate,'/admin',{headers:{cookie:valid}}),env),false);
});
test('M14: a signed official session can still read its own private draft',async()=>{
 const {env,calls}=mock(),cookie=await authorized();
 for(const root of [official,apex]){
  const res=await handleServerDraft(request(root,
   '/api/editor-open-draft?celebration=101',{headers:{cookie}}),env);
  assert.equal(res.status,200);
  const body=await res.json();
  assert.equal(body.revision,1);
  assert.ok(JSON.stringify(body).includes('SECRET_PRIVATE_DRAFT_DO_NOT_LEAK'));
  assert.ok(JSON.stringify(body).includes('SECRET_PLANNED_CELEBRATION'));
 }
 assert.equal(calls.read,2);
 assert.equal(calls.write,0);
});
test('M14: CSRF guard is same-origin HTTPS exactly, without relying on referrer',()=>{
 assert.equal(sameOriginEditorWrite(request(official,'/api/editor-publication',{
  method:'POST',headers:{origin:official}})),true);
 assert.equal(sameOriginEditorWrite(request(apex,'/api/editor-publication',{
  method:'POST',headers:{origin:apex}})),true);
 for(const origin of [null,'null',apex,'https://attacker.example',
  official+'.attacker.example','http://www.ronde-des-archanges-universelle.eu']){
  assert.equal(sameOriginEditorWrite(request(official,'/api/editor-publication',{
   method:'POST',headers:origin===null?{}:{origin}})),false,String(origin));
 }
 assert.equal(sameOriginEditorWrite(request('http://www.ronde-des-archanges-universelle.eu',
  '/api/editor-publication',{method:'POST',
  headers:{origin:'http://www.ronde-des-archanges-universelle.eu'}})),false);
});
test('M14: valid cookie alone cannot publish or save with a foreign Origin',async()=>{
 const {env,calls}=mock(),cookie=await authorized();
 const save=await handleServerDraft(request(official,'/api/editor-open-draft',{
  method:'POST',headers:{cookie,origin:'https://attacker.example','content-type':'application/json'},
  body:JSON.stringify(saveBody())}),env);
 assert.equal(save.status,403);
 const publish=await handleEditorPublication(request(official,'/api/editor-publication',{
  method:'POST',headers:{cookie,origin:apex,'content-type':'application/json'},
  body:JSON.stringify({celebration:'101',expectedRevision:1,kind:'page',
   pageId:'mercredi-101',visibility:'hidden'})}),env);
 assert.equal(publish.status,403);
 const media=await handleEditorMedia(request(official,'/api/editor-media?action=external',{
  method:'POST',headers:{cookie,origin:'null','content-type':'application/json'},
  body:JSON.stringify({src:'https://example.org/file.pdf',type:'pdf'})}),env);
 assert.equal(media.status,403);
 assert.equal(calls.read,0);
 assert.equal(calls.write,0);
});
test('M14: private media catalogue GET needs admin session, even on official domain',async()=>{
 const {env,calls}=mock();
 const r=await handleEditorMedia(request(official,'/api/editor-media'),env);
 assert.equal(r.status,401);
 assert.equal(calls.read,0);
 const authorizedGet=await handleEditorMedia(request(official,'/api/editor-media',
  {headers:{cookie:await authorized()}}),env);
 assert.equal(authorizedGet.status,200);
 const body=await authorizedGet.json();
 assert.equal(body.ok,true);
 assert.ok(JSON.stringify(body).includes('SECRET_MEDIA_NAME.jpg'));
 assert.equal(calls.read,1);
});
test('M14: public snapshot remains filtered and free of private draft text',()=>{
 const filtered=publicSnapshot(PAGES,'101');
 const str=JSON.stringify(filtered);
 assert.ok(str.includes('Texte public'));
 assert.ok(!str.includes('SECRET_PRIVATE_DRAFT_DO_NOT_LEAK'));
 assert.ok(!str.includes('SECRET_PLANNED_CELEBRATION'));
 assert.ok(!str.includes('SECRET_MEDIA_NAME.jpg'));
});
test('M14: security policy has no I/O and official authentication form is unchanged',()=>{
 const source=readFileSync('migration/cloudflare/app/security/editor-route-policy.mjs','utf8');
 for(const forbidden of ['fetch(', 'localStorage','serverPublish(', 'indexedDB',
  'document.', 'window.', 'env.DB', '.put(', 'env.EDITOR_BUCKET'])
  assert.ok(!source.includes(forbidden),forbidden);
 const workerCode=readFileSync('migration/cloudflare/production-worker.mjs','utf8');
 assert.ok(workerCode.indexOf('isPrivateEditorPath(path)')<
  workerCode.indexOf('const handleRoute=async()=>'),
  'private gate precedes all Worker route/asset dispatch');
 const signin=readFileSync('migration/cloudflare/editor-site-access.mjs','utf8');
 assert.ok(signin.includes('validFormChallenge'));
 assert.ok(signin.includes('SameSite=Lax'));
 assert.ok(signin.includes('HttpOnly'));
 assert.ok(signin.includes('Secure'));
});
