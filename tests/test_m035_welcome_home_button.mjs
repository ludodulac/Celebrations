import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EDITOR_SNAPSHOT_KEY} from '../migration/cloudflare/app/ports/editor-snapshot-contract.mjs';
import {handleEditorPublication,publicSnapshot} from '../migration/cloudflare/editor-publication-api.mjs';
import {projectPublicPage} from '../migration/cloudflare/app/domain/editor-public-projection-security.mjs';
import {DEFAULT_HOME_ENTRY_BUTTON,validHomeEntryButton,normalizeHomeEntryButton}
 from '../migration/cloudflare/app/domain/editor-home-entry-button.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {TRIAL_SITE_CLIENT} from '../migration/cloudflare/editor-trial-site-client.mjs';
import {M033_SPLASH_HOME_CSS} from '../migration/cloudflare/editor-trial-site-page.mjs';
const HOST='https://ronde-des-archanges-universelle.eu',SECRET='a'.repeat(64);
const HOME='neutral-accueil-general';
const SECOND='neutral-123e4567-e89b-42d3-a456-426614174000';
const button={...DEFAULT_HOME_ENTRY_BUTTON};
function state(){
 const shared={homeId:HOME,pages:[
  {id:HOME,group:'page',name:'Accueil général',visibility:'published',
   blocks:[{id:2,kind:'text',text:'Bienvenue',rich:'<strong>Bienvenue</strong>'},
    {id:99991,kind:'image',src:'/media/media/home.jpg',text:'Image conservée'}]},
  {id:SECOND,group:'page',name:'Présentation',visibility:'published',
   blocks:[{id:3,kind:'text',text:'Ancien contenu de Présentation'}]}
 ]};
 const published=structuredClone(shared);
 shared.pages[0].blocks.push({id:4,kind:'text',text:'SECRET NON PUBLIÉ'});
 return {version:15,shared,drafts:{'101':{pages:[]}},plans:[],mediaCatalogue:[],
  published:{shared:published,drafts:{'101':{pages:[]}},
   celebrationVisibility:{'101':'published'}}};
}
class Bucket{
 constructor(data){this.data=structuredClone(data);this.serial=1;this.writes=0;}
 async get(key){assert.equal(key,EDITOR_SNAPSHOT_KEY);
  return {etag:String(this.serial),text:async()=>JSON.stringify(this.data)}}
 async put(key,value,{onlyIf}={}){
  assert.equal(key,EDITOR_SNAPSHOT_KEY);
  if(onlyIf.etagMatches&&onlyIf.etagMatches!==String(this.serial))return null;
  this.data=JSON.parse(String(value));this.serial++;this.writes++;
  return {etag:String(this.serial)};
 }
 async delete(){throw Error('No image deletion allowed')}
}
async function signedCookie(){
 const payload=String(Date.now())+'.'+'b'.repeat(32);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(SECRET),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=await crypto.subtle.sign('HMAC',key,
  new TextEncoder().encode('site-editor-v1:'+payload));
 return 'celebrations_editor_access='+payload+'.'+Buffer.from(signature).toString('hex');
}
const env=bucket=>({EDITOR_BUCKET:bucket,ADMIN_PASSWORD_HASH:SECRET});
async function apply(bucket,payload,{cookie='',origin=HOST,revision=bucket.data.version,id=HOME}={}){
 return handleEditorPublication(new Request(HOST+'/api/editor-publication',{
  method:'POST',headers:{origin,cookie,'content-type':'application/json'},
  body:JSON.stringify({kind:'home-entry-button',celebration:'101',expectedRevision:revision,
   pageId:id,button:payload})
 }),env(bucket));
}
test('M035: defaults create a recognizable Bienvenue CTA with real border and contrast',()=>{
 assert.equal(DEFAULT_HOME_ENTRY_BUTTON.label,'Bienvenue');
 assert.equal(DEFAULT_HOME_ENTRY_BUTTON.enabled,true);
 assert.equal(validHomeEntryButton({...DEFAULT_HOME_ENTRY_BUTTON}),true);
 assert.equal(normalizeHomeEntryButton(null).label,'Bienvenue');
 assert.equal(validHomeEntryButton({...button,background:'url(javascript:evil)'}),false);
 assert.equal(validHomeEntryButton({...button,label:'<img onerror=1>'}),false);
 assert.equal(validHomeEntryButton({...button,borderWidth:99}),false);
 assert.equal(validHomeEntryButton({...button,radius:999}),false);
});
test('M035: scoped admin action changes only published visual CTA, never draft images or content',async()=>{
 const bucket=new Bucket(state()),oldPublished=structuredClone(bucket.data.published.shared.pages[0]);
 const cookie=await signedCookie(),next={...button,label:'Entrer dans la ronde',
  background:'#C7DBD2',color:'#1C332A',borderColor:'#183D32',borderWidth:4,radius:28};
 const res=await apply(bucket,next,{cookie});assert.equal(res.status,200);
 const data=await res.json();assert.equal(data.button.label,next.label);
 assert.equal(bucket.writes,1);assert.equal(bucket.data.version,16);
 const home=bucket.data.published.shared.pages[0],draft=bucket.data.shared.pages[0];
 assert.deepEqual(home.blocks,oldPublished.blocks,'M035 must never publish unsaved draft text');
 assert.ok(!JSON.stringify(home).includes('SECRET NON PUBLIÉ'));
 assert.equal(home.homeEntryButton.label,'Entrer dans la ronde');
 assert.deepEqual(draft.homeEntryButton,home.homeEntryButton);
 assert.equal(home.name,'Accueil général');assert.equal(home.visibility,'published');
 assert.equal(bucket.data.published.shared.homeId,HOME);
 const visible=publicSnapshot(bucket.data,'101');
 assert.equal(visible.shared.pages[0].homeEntryButton.borderWidth,4);
 assert.equal(visible.shared.pages[0].homeEntryButton.radius,28);
 assert.equal(visible.shared.pages[0].blocks.length,2);
 assert.deepEqual(visible.shared.pages[0].blocks.map(x=>x.kind),['text','image']);
});
test('M035: button can be disabled without hiding image or changing page visibility',async()=>{
 const bucket=new Bucket(state()),cookie=await signedCookie();
 assert.equal((await apply(bucket,{...button,enabled:false},{cookie})).status,200);
 const visible=publicSnapshot(bucket.data,'101').shared.pages[0];
 assert.equal(visible.homeEntryButton.enabled,false);
 assert.equal(visible.visibility,'published');
 assert.equal(visible.blocks.some(x=>x.kind==='image'),true);
});
test('M035: no PIN, cross-origin, stale revision, private/home-less targets fail closed',async()=>{
 const bucket=new Bucket(state()),cookie=await signedCookie();
 assert.equal((await apply(bucket,button)).status,401);
 assert.equal((await apply(bucket,button,{cookie,origin:'https://other.invalid'})).status,403);
 assert.equal((await apply(bucket,button,{cookie,revision:14})).status,409);
 assert.equal((await apply(bucket,button,{cookie,id:SECOND})).status,403);
 assert.equal((await apply(bucket,{...button,label:'<script>'},{cookie})).status,400);
 assert.equal((await apply(bucket,{...button,borderColor:'red'},{cookie})).status,400);
 bucket.data.shared.pages[0].accessPolicy={mode:'ALL_PRIVATE_TYPES'};
 assert.equal((await apply(bucket,button,{cookie})).status,403);
 assert.equal(bucket.writes,0);
});
test('M035: public projection excludes invalid style data and keeps normal original blocks',()=>{
 const page=state().published.shared.pages[0];page.homeEntryButton={...button,background:'url(evil)'};
 const safe=projectPublicPage(page);
 assert.equal(safe.homeEntryButton,undefined);
 assert.equal(safe.blocks[0].text,'Bienvenue');
 page.homeEntryButton={...button};
 assert.equal(projectPublicPage(page).homeEntryButton.label,'Bienvenue');
});
test('M035: rendered source has a real CTA inside the clickable photo, settings and admin footer',()=>{
 assert.doesNotThrow(()=>new Function(DEMO_CLIENT));
 assert.doesNotThrow(()=>new Function(TRIAL_SITE_CLIENT));
 const admin=readFileSync(new URL('../migration/cloudflare/editor-demo-client-source.js',import.meta.url),'utf8');
 assert.match(admin,/function m035EntrySettings\(homePage\)/);
 assert.match(admin,/Appliquer le bouton sur le site/);
 assert.match(admin,/kind:'home-entry-button'/);
 assert.match(admin,/Épaisseur du contour/);
 assert.match(admin,/Couleur du bouton/);
 assert.match(admin,/Arrondi du bouton/);
 assert.match(TRIAL_SITE_CLIENT,/m035-welcome-button/);
 assert.match(M033_SPLASH_HOME_CSS,/\.m035-welcome-button/);
 assert.match(M033_SPLASH_HOME_CSS,/height:min\(47svh,400px\)/);
 assert.match(M033_SPLASH_HOME_CSS,/body\.is-splash-home \.footer/);
});
