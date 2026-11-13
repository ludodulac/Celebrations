import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EDITOR_SNAPSHOT_KEY} from '../migration/cloudflare/app/ports/editor-snapshot-contract.mjs';
import {handleEditorPublication,publicSnapshot} from '../migration/cloudflare/editor-publication-api.mjs';
import {projectPublicPage} from '../migration/cloudflare/app/domain/editor-public-projection-security.mjs';
import {createEditorPageCommands} from '../migration/cloudflare/app/application/editor-page-commands.mjs';
import {createPageModel} from '../migration/cloudflare/app/domain/editor-pages.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {TRIAL_SITE_CLIENT} from '../migration/cloudflare/editor-trial-site-client.mjs';
import {M033_SPLASH_HOME_CSS} from '../migration/cloudflare/editor-trial-site-page.mjs';

const HOST='https://ronde-des-archanges-universelle.eu';
const SECRET='a'.repeat(64);
const uid='neutral-123e4567-e89b-42d3-a456-426614174000';
const heading={id:1,kind:'heading',text:'Bienvenue',align:'center'};
const home={id:'neutral-accueil-general',name:'Accueil',group:'page',
 visibility:'published',blocks:[structuredClone(heading)]};
const next={id:uid,name:'Présentation',group:'page',
 visibility:'published',blocks:[{id:2,kind:'heading',text:'Contenu indépendant'}]};
function makeState(){
 const shared={homeId:home.id,pages:[structuredClone(home),structuredClone(next)]};
 const published=structuredClone(shared);
 // A later editor draft must NOT be published accidentally by a menu rename.
 shared.pages[1].blocks.push({id:3,kind:'text',text:'BROUILLON NON PUBLIÉ'});
 return {version:12,shared,drafts:{'101':{pages:[]}},plans:[],
  mediaCatalogue:[],published:{shared:published,drafts:{'101':{pages:[]}},
   celebrationVisibility:{'101':'published'}}};
}
class Bucket{
 constructor(state){this.data=structuredClone(state);this.etag=1;this.writes=0;}
 async get(key){
  assert.equal(key,EDITOR_SNAPSHOT_KEY);
  return {etag:String(this.etag),text:async()=>JSON.stringify(this.data)};
 }
 async put(key,value,{onlyIf}={}){
  assert.equal(key,EDITOR_SNAPSHOT_KEY);
  if(onlyIf.etagMatches&&onlyIf.etagMatches!==String(this.etag))return null;
  this.data=JSON.parse(String(value));this.etag++;this.writes++;
  return {etag:String(this.etag)};
 }
 async delete(){throw Error('M034 must not delete a file')}
}
async function editorCookie(){
 const payload=String(Date.now())+'.'+'b'.repeat(32);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(SECRET),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const data=await crypto.subtle.sign('HMAC',key,
  new TextEncoder().encode('site-editor-v1:'+payload));
 return 'celebrations_editor_access='+payload+'.'+Buffer.from(data).toString('hex');
}
async function rename(bucket,pageId,menuLabel,opts={}){
 const body={kind:'page-menu-label',celebration:'101',expectedRevision:opts.revision??bucket.data.version,
  pageId,menuLabel};
 return handleEditorPublication(new Request(HOST+'/api/editor-publication',{
  method:'POST',headers:{origin:opts.origin??HOST,cookie:opts.cookie??'',
   'content-type':'application/json'},
  body:JSON.stringify(body)
 }),{EDITOR_BUCKET:bucket,ADMIN_PASSWORD_HASH:SECRET});
}
test('M034: changing the menu label never renames or modifies the first title block',()=>{
 const page=structuredClone(next);
 const db={pages:[structuredClone(home),page]};
 const command=createEditorPageCommands({model:createPageModel()});
 const saved=structuredClone(page.blocks);
 const result=command.renameMenuLabel(db,page,'La vie des anges');
 assert.deepEqual(result,{ok:true,changed:true});
 assert.equal(page.name,'Présentation');
 assert.equal(page.menuLabel,'La vie des anges');
 assert.deepEqual(page.blocks,saved);
 assert.ok(command.renameMenuLabel(db,page,'Accueil').ok===false,'No duplicate visible names');
 assert.ok(command.renameMenuLabel(db,page,'\\n').ok===false);
 const old=command.renameEditablePage(db,page,'Nouveau nom',101);
 assert.equal(old.ok,true);
 assert.deepEqual(page.blocks,saved,'Legacy rename no longer rewrites headings either');
});
test('M034: the editor can remove the very first real heading and no longer auto-removes it',()=>{
 const admin=readFileSync(new URL('../migration/cloudflare/editor-demo-client-source.js',import.meta.url),'utf8');
 assert.ok(!admin.includes('removeBoilerplateTitles(db.pages)'));
 assert.ok(!TRIAL_SITE_CLIENT.includes('omitBoilerplateTitles('));
 assert.match(admin,/items\.splice\(items\.indexOf\(x\),1\);mark\(\);render\(\)/);
 assert.match(admin,/function changePageMenuLabel\(p\)/);
 assert.match(admin,/kind:'page-menu-label'/);
 assert.match(admin,/Modifier le nom/);
 assert.ok(!admin.includes("b('Définir comme accueil'"));
 assert.ok(!admin.includes("b('Modifier cette page'"));
 assert.doesNotThrow(()=>new Function(DEMO_CLIENT));
 assert.doesNotThrow(()=>new Function(TRIAL_SITE_CLIENT));
});
test('M034: the public projection contains separate, sanitized menu labels, and keeps real block headings',()=>{
 const input=structuredClone(home);
 input.menuLabel='Démarrer';
 let out=projectPublicPage(input);
 assert.equal(out.name,'Accueil');
 assert.equal(out.menuLabel,'Démarrer');
 assert.equal(out.blocks[0].text,'Bienvenue');
 input.menuLabel='a'.repeat(96);
 out=projectPublicPage(input);
 assert.equal(out.menuLabel,undefined);
 input.menuLabel='accueil\\nsecret';
 out=projectPublicPage(input);
 assert.equal(out.menuLabel,undefined);
 assert.match(M033_SPLASH_HOME_CSS,/max-width:940px!important/);
 assert.match(M033_SPLASH_HOME_CSS,/border:0!important/);
 assert.match(M033_SPLASH_HOME_CSS,/m034-home-flow/);
});
test('M034: live-handler label change modifies ONLY draft and already published nav label',async()=>{
 const initial=makeState(),bucket=new Bucket(initial),cookie=await editorCookie();
 const changed=await rename(bucket,uid,'La démarche',{cookie});
 assert.equal(changed.status,200,await changed.text().catch(()=>'')); // inspect the postcondition below
 assert.equal(bucket.writes,1);
 const first=bucket.data.shared.pages[1],published=bucket.data.published.shared.pages[1];
 assert.equal(first.menuLabel,'La démarche');
 assert.equal(published.menuLabel,'La démarche');
 assert.equal(first.name,'Présentation');
 assert.equal(published.name,'Présentation');
 assert.deepEqual(first.blocks,initial.shared.pages[1].blocks);
 assert.deepEqual(published.blocks,initial.published.shared.pages[1].blocks);
 assert.ok(!JSON.stringify(published).includes('BROUILLON NON PUBLIÉ'));
 assert.equal(bucket.data.published.shared.homeId,'neutral-accueil-general');
 const projection=publicSnapshot(bucket.data,'101');
 assert.equal(projection.shared.pages.find(p=>p.id===uid).menuLabel,'La démarche');
 assert.equal(projection.shared.pages.find(p=>p.id===uid).blocks.length,1);
});
test('M034: unpublished private page remains private after standalone menu rename',async()=>{
 const data=makeState();
 data.shared.pages.push({id:'neutral-123e4567-e89b-42d3-a456-426614174001',
  group:'page',name:'Secret',visibility:'draft',accessPolicy:{mode:'ALL_PRIVATE_TYPES'},
  blocks:[{id:1,kind:'text',text:'Contenu réservé'}]});
 const bucket=new Bucket(data),cookie=await editorCookie();
 const id=data.shared.pages[2].id;
 assert.equal((await rename(bucket,id,'Espace secret',{cookie})).status,200);
 assert.ok(!publicSnapshot(bucket.data,'101').shared.pages.some(p=>p.id===id));
 assert.equal(bucket.data.published.shared.pages.some(p=>p.id===id),false);
 assert.equal(bucket.data.shared.pages[2].accessPolicy.mode,'ALL_PRIVATE_TYPES');
});
test('M034: anonymous, cross-site, stale and invalid menu updates must fail',async()=>{
 const bucket=new Bucket(makeState()),cookie=await editorCookie();
 assert.equal((await rename(bucket,uid,'Interdit')).status,401);
 assert.equal((await rename(bucket,uid,'Interdit',{cookie,origin:'https://other.invalid'})).status,403);
 assert.equal((await rename(bucket,uid,'Interdit',{cookie,revision:11})).status,409);
 assert.equal((await rename(bucket,uid,'A'.repeat(96),{cookie})).status,400);
 assert.equal((await rename(bucket,uid,'Accueil',{cookie})).status,409);
 assert.equal(bucket.writes,0);
});
