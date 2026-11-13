import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {navigationPreference,validNavigationPreference} from '../migration/cloudflare/app/domain/editor-navigation-label.mjs';
import {handleSiteIdentity} from '../migration/cloudflare/site-identity-api.mjs';

const HOST='https://ronde-des-archanges-universelle.eu';
const SECRET='a'.repeat(64);
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
class Bucket{
 constructor(data){this.state=structuredClone(data);this.serial=1}
 async get(key){return key==='editor-trials/server-drafts-v1.json'?
  {etag:String(this.serial),body:true,text:async()=>JSON.stringify(this.state)}:null}
 async put(key,value,{onlyIf}={}){
  if(onlyIf?.etagMatches!==String(this.serial))return null;
  this.state=JSON.parse(value);this.serial++;return {etag:String(this.serial)}
 }
}
const state=()=>({version:1,drafts:{'101':{pages:[]}},shared:{pages:[],homeId:''},plans:[],
 siteIdentity:{title:'Original'},adminMode:{memberAccessUiEnabled:false},
 navigation:{title:'',position:'center'},mediaCatalogue:[]});
async function cookie(){
 const payload=String(Date.now())+'.'+'b'.repeat(32);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(SECRET),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const data=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('site-editor-v1:'+payload));
 return 'celebrations_editor_access='+payload+'.'+Buffer.from(data).toString('hex');
}
const env=bucket=>({EDITOR_BUCKET:bucket,ADMIN_PASSWORD_HASH:SECRET});
test('navigation preference is bounded, canonical and never contains untrusted HTML',()=>{
 assert.deepEqual(navigationPreference(null),{title:'',position:'center'});
 assert.deepEqual(navigationPreference({title:'  Archanges  ',position:'left'}),{title:'Archanges',position:'left'});
 assert.equal(validNavigationPreference({title:'Ronde des Archanges',position:'right'}),true);
 for(const bad of [{title:'   X',position:'left'},{title:'X',position:'bad'},
  {title:'a'.repeat(111),position:'center'},null,[]])
  assert.equal(validNavigationPreference(bad),false,JSON.stringify(bad));
});
test('title update requires admin cookie + same-origin, version check and preserves whole snapshot',async()=>{
 const bucket=new Bucket(state()),e=env(bucket),signed=await cookie();
 const payload=(revision,title='Ronde des Archanges')=>({
  expectedRevision:revision,navigation:{title,position:'center'}});
 const request=(body,{cookie:auth,origin=HOST}={})=>new Request(HOST+'/api/site-identity',{
  method:'POST',headers:{origin,'content-type':'application/json',...(auth?{cookie:auth}:{})},
  body:JSON.stringify(body)});
 assert.equal((await handleSiteIdentity(request(payload(1)),e)).status,401);
 assert.equal((await handleSiteIdentity(request(payload(1),{cookie:signed,origin:'https://attacker.test'}),e)).status,403);
 const success=await handleSiteIdentity(request(payload(1),{cookie:signed}),e);
 assert.equal(success.status,200,await success.text());
 assert.equal(bucket.state.navigation.title,'Ronde des Archanges');
 assert.equal(bucket.state.version,2);
 assert.equal(bucket.state.siteIdentity.title,'Original');
 assert.equal(bucket.state.adminMode.memberAccessUiEnabled,false);
 assert.deepEqual(bucket.state.drafts,{'101':{pages:[]}});
 assert.equal((await handleSiteIdentity(request(payload(1),{cookie:signed}),e)).status,409);
 assert.equal((await handleSiteIdentity(request(payload(2,'  bad'),{cookie:signed}),e)).status,400);
 assert.equal((await handleSiteIdentity(new Request(HOST+'/api/site-identity',{headers:{cookie:signed}}),e)).status,200);
 const readback=await handleSiteIdentity(new Request(HOST+'/api/site-identity',{headers:{cookie:signed}}),e);
 assert.deepEqual((await readback.json()).navigation,{title:'Ronde des Archanges',position:'center'});
});
test('single desktop-only label in the existing bar, ordinary editor unaffected',()=>{
 const visitor=read('migration/cloudflare/editor-trial-site-page.mjs');
 const ui=read('migration/cloudflare/editor-demo-client-source.js');
 assert.match(visitor,/navigationPreference\(publishedState\?\.navigation\)/);
 assert.match(visitor,/esc\(navigation\.title\)/);
 assert.match(visitor,/navigationHtml/);
 assert.match(visitor,/site-menu-bar'\+\(navigation\.title/);
 assert.match(visitor,/@media\(max-width:700px\)\{\.site-nav-title\{display:none!important\}\}/);
 const settings=ui.slice(ui.indexOf('function settings(){'),ui.indexOf('function m018LanguagesCategories('));
 for(const term of ['Titre dans la barre du menu','Enregistrer le titre',
  'Position du titre','navPanel','saveTitle.disabled=true','title.disabled=true'])
  assert.ok(settings.includes(term),term);
 assert.ok(settings.includes('m021b-admin-mode'));
 assert.ok(settings.includes('m028-language-settings'));
 assert.ok(ui.includes('let navLabelDraft=null'),'Unsaved menu title is preserved across Settings rerenders');
 assert.ok(settings.includes('title.oninput=keepNavDraft'));
 assert.ok(settings.includes('select.onchange=keepNavDraft'));
 assert.ok(settings.includes('const requested={title:title.value.trim(),position:select.value}'));
 assert.ok(settings.includes('title.value=navLabelDraft?.title??value.navigation?.title'));
 assert.ok(!ui.includes('function pdfPrivacyControl('));
});
