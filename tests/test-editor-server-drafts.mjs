import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {handleServerDraft,refreshAlreadyPublishedPage} from '../migration/cloudflare/editor-server-draft-api.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {TRIAL_SITE_CLIENT} from '../migration/cloudflare/editor-trial-site-client.mjs';
import {SERVER_EDITOR_SYNC,SERVER_PREVIEW_PREFETCH} from '../migration/cloudflare/editor-server-sync-client.mjs';

const origin='https://celebrations-exit-staging.rondes.workers.dev';
const token='a'.repeat(64);
const req=(method,path,body=null,authorized=true)=>new Request(origin+path,{
 method,headers:{...(authorized?{authorization:'Bearer '+token}:{}),...(body?{'content-type':'application/json'}:{})},
 ...(body?{body:JSON.stringify(body)}:{})
});
function bucket(){
 let data=null,version=0;
 return {
  async get(){return data===null?null:{etag:String(version),body:true,text:async()=>data}},
  async put(_key,value,{onlyIf}){
   if(data===null&&onlyIf?.etagDoesNotMatch!=='*')return null;
   if(data!==null&&onlyIf?.etagMatches!==String(version))return null;
   data=value;version++;return {etag:String(version)};
  }
 };
}
const env=()=>({DB:{prepare:()=>({bind:()=>({first:async()=>({email:'test@localhost',expires_at:'2099-01-01T00:00:00.000Z'})})})},MEDIA_BUCKET:bucket()});
const body={celebration:'101',expectedRevision:0,
 record:{pages:[{id:'mercredi-101',group:'celebration',name:'Mercredi',blocks:[{id:1,kind:'text',text:'16 h — Cérémonie'},{id:2,kind:'image',src:'/media/exemple.jpg',widthPct:45}]}],
 celebrationDates:{wednesday:'2026-11-04'},celebrationTimes:{mercredi:'16:00'}},
 plans:[],shared:{pages:[],homeId:''}
};

test('anonymous users cannot read or write protected server drafts',async()=>{
 const e=env();
 assert.equal((await handleServerDraft(req('GET','/api/editor-server-draft?celebration=101',null,false),e)).status,401);
 assert.equal((await handleServerDraft(req('POST','/api/editor-server-draft',body,false),e)).status,401);
});
test('owner-approved public staging sync is same-origin write-only and shares revisions',async()=>{
 const e=env();
 const openGet=new Request(origin+'/api/editor-open-draft?celebration=101');
 const first=await handleServerDraft(openGet,e);
 assert.equal(first.status,200);
 assert.equal((await first.json()).revision,0);
 const crossOrigin=new Request(origin+'/api/editor-open-draft',{method:'POST',
  headers:{origin:'https://example.org','content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await handleServerDraft(crossOrigin,e)).status,403);
 const absentOrigin=new Request(origin+'/api/editor-open-draft',{method:'POST',
  headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await handleServerDraft(absentOrigin,e)).status,403);
 const allowed=new Request(origin+'/api/editor-open-draft',{method:'POST',
  headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
 const saved=await handleServerDraft(allowed,e);
 assert.equal(saved.status,200);
 assert.equal((await saved.json()).revision,1);
 const reread=await handleServerDraft(openGet,e);
 assert.equal((await reread.json()).record.pages[0].blocks[1].widthPct,45);
});
test('server persistence round-trip, dates, and conflict protection',async()=>{
 const e=env();
 const initial=await handleServerDraft(req('GET','/api/editor-server-draft?celebration=101'),e);
 assert.deepEqual((await initial.json()).record,null);
 const saved=await handleServerDraft(req('POST','/api/editor-server-draft',body),e);
 assert.equal(saved.status,200);
 const meta=await saved.json();assert.equal(meta.revision,1);
 const reopened=await handleServerDraft(req('GET','/api/editor-server-draft?celebration=101'),e);
 const result=await reopened.json();
 assert.equal(result.record.pages[0].blocks[0].text,'16 h — Cérémonie');
 assert.equal(result.record.celebrationDates.wednesday,'2026-11-04');
 assert.equal(result.record.celebrationTimes.mercredi,'16:00');
 assert.equal(result.record.pages[0].blocks[1].widthPct,45,'image width is stored on server');
 const old=await handleServerDraft(req('POST','/api/editor-server-draft',body),e);
 assert.equal(old.status,409,'no silent overwrite across devices');
 const again=await handleServerDraft(req('POST','/api/editor-server-draft',{...body,expectedRevision:1}),e);
 assert.equal(again.status,200);
 assert.equal((await again.json()).revision,2);
});
test('rejects oversized, cross-celebration and malformed drafts without writing',async()=>{
 const e=env();
 const cross={...body,record:{pages:[{...body.record.pages[0],id:'mercredi-102'}]}};
 assert.equal((await handleServerDraft(req('POST','/api/editor-server-draft',cross),e)).status,400);
 const tooBig={...body,record:{pages:[{...body.record.pages[0],blocks:[{kind:'text',text:'x'.repeat(4600000)}]}]}};
 assert.equal((await handleServerDraft(req('POST','/api/editor-server-draft',tooBig),e)).status,413);
 const empty=await handleServerDraft(req('GET','/api/editor-server-draft?celebration=101'),e);
 assert.equal((await empty.json()).revision,0);
});
test('Enregistrer republishes only an existing visible page, preserving unrelated drafts and pages',()=>{
 const live=(id,text,visibility='published')=>({id,group:'celebration',name:id,visibility,
  blocks:[{id:1,kind:'text',text}]});
 const published={
  shared:{pages:[{id:'neutral-accueil-general',group:'page',name:'Accueil',visibility:'published',blocks:[{id:1,kind:'text',text:'Ancien accueil'}]}],
   homeId:'neutral-accueil-general'},
  drafts:{'101':{pages:[live('mercredi-101','Ancienne conférence'),live('jeudi-101','Autre événement')],
    celebrationDates:{wednesday:'2026-11-04'},celebrationTimes:{mercredi:'16:00'}}},
  plans:[],celebrationVisibility:{}
 };
 const state={published};
 const record={pages:[live('mercredi-101','Conférence corrigée'),live('jeudi-101','Brouillon différent')],
  celebrationDates:{wednesday:'2026-11-11'},celebrationTimes:{mercredi:'17:00'}};
 const shared={pages:[{id:'neutral-accueil-general',group:'page',name:'Accueil',
  visibility:'published',blocks:[{id:1,kind:'text',text:'Nouvel accueil'}]}],homeId:'neutral-accueil-general'};
 assert.equal(refreshAlreadyPublishedPage(state,record,shared,'101','mercredi-101'),true);
 assert.equal(state.published.drafts['101'].pages[0].blocks[0].text,'Conférence corrigée');
 assert.equal(state.published.drafts['101'].pages[1].blocks[0].text,'Autre événement',
  'An unrelated unpublished edit must not reach the site');
 assert.equal(state.published.drafts['101'].celebrationDates.wednesday,'2026-11-11');
 assert.equal(state.published.shared.pages[0].blocks[0].text,'Ancien accueil');
 assert.equal(refreshAlreadyPublishedPage(state,record,shared,'101','neutral-accueil-general'),true);
 assert.equal(state.published.shared.pages[0].blocks[0].text,'Nouvel accueil');
});

test('Auto-publication never exposes a hidden, draft or absent page',()=>{
 const p=(id,visibility)=>({id,group:'celebration',name:id,visibility,blocks:[{kind:'text',text:'Public'}]});
 const old=p('mercredi-101','published');
 const prior=p('jeudi-101','draft');
 const state={published:{shared:{pages:[],homeId:''},drafts:{'101':{pages:[old,prior] }},plans:[],celebrationVisibility:{}}};
 const record={pages:[p('mercredi-101','hidden'),p('jeudi-101','published'),p('vendredi-101','published')]};
 assert.equal(refreshAlreadyPublishedPage(state,record,{pages:[]},'101','mercredi-101'),false);
 assert.equal(refreshAlreadyPublishedPage(state,record,{pages:[]},'101','jeudi-101'),false);
 assert.equal(refreshAlreadyPublishedPage(state,record,{pages:[]},'101','vendredi-101'),false);
 assert.equal(state.published.drafts['101'].pages[0].blocks[0].text,'Public');
 state.published.celebrationVisibility['101']='hidden';
 record.pages[0].visibility='published';
 assert.equal(refreshAlreadyPublishedPage(state,record,{pages:[]},'101','mercredi-101'),false);
});

test('Staging save never publishes even when a page is requested for publication',async()=>{
 const e=env();
 const request=new Request(origin+'/api/editor-open-draft',{method:'POST',
  headers:{origin,'content-type':'application/json'},
  body:JSON.stringify({...body,publishPageId:'mercredi-101'})});
 const saved=await handleServerDraft(request,e);
 assert.equal(saved.status,200);
 assert.equal((await saved.json()).publishedPageId,null);
 const invalid=new Request(origin+'/api/editor-open-draft',{method:'POST',
  headers:{origin,'content-type':'application/json'},
  body:JSON.stringify({...body,expectedRevision:1,publishPageId:'mercredi-999'})});
 assert.equal((await handleServerDraft(invalid,e)).status,400);
});

test('generated editor and preview scripts parse with required integration hooks',()=>{
 const editor=DEMO_CLIENT
  .replace("(()=>{'use strict';","(async()=>{'use strict';")
  .replace("function mark(){dirty=true;",SERVER_EDITOR_SYNC+"\nfunction mark(){db._serverPending=true;dirty=true;")
  .replace("el('save-btn').onclick=()=>save(true);","el('save-btn').onclick=()=>{save();void serverSave();};")
  .replace("render();loadFiles();","await serverLoad();render();loadFiles();");
 assert.ok(editor.includes('await serverLoad()'));
 assert.ok(editor.includes('Enregistré sur le serveur'));
 assert.ok(editor.includes('serverSave()'));
 new Script(editor);
 const site=TRIAL_SITE_CLIENT
  .replace("(()=>{'use strict';","(async()=>{'use strict';")
  .replace("const KEY='celebrations-demo-preparation-'+celebration;",
   SERVER_PREVIEW_PREFETCH+"\nconst KEY='celebrations-demo-preparation-'+celebration;");
 assert.ok(site.includes('await fetchServerPreview()'));
 new Script(site);
});

test('M04: une seule confirmation visuelle pour une sauvegarde serveur vérifiée',()=>{
 const start=SERVER_EDITOR_SYNC.indexOf('const live=!!payload.publishedPageId;');
 const end=SERVER_EDITOR_SYNC.indexOf('  return true;',start);
 assert.ok(start>=0 && end>start,'L’enregistrement sur le serveur conserve son flux de succès');
 const confirmation=SERVER_EDITOR_SYNC.slice(start,end);
 assert.ok(confirmation.includes("button.textContent=label;button.classList.add('save-confirmed')"),
  'La confirmation verte reste dans le bouton existant');
 assert.ok(!confirmation.includes("editor-save-toast"),
  'Aucune deuxième notification verte ne reprend le même message');
 assert.ok(confirmation.includes("serverMessage(label+' — contenu revérifié après enregistrement.')"),
  'Le retour accessible et l’état de relecture du serveur sont conservés');
 assert.ok(SERVER_EDITOR_SYNC.includes('editorSyncPolicy.readbackConfirmed('),
  'La confirmation reste conditionnée à la vérification du contenu sur le serveur');
 assert.ok(SERVER_EDITOR_SYNC.includes("button.textContent='Échec — réessayer'"),
  'Les erreurs restent visibles et permettent de réessayer');
 assert.ok(DEMO_CLIENT.includes("el('editor-save-toast')"),
  'Le retour local propre au mode démonstration n’est pas supprimé');
});
