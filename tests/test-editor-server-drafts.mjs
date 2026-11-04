import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {handleServerDraft} from '../migration/cloudflare/editor-server-draft-api.mjs';
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
 const tooBig={...body,record:{pages:[{...body.record.pages[0],blocks:[{kind:'text',text:'x'.repeat(1900000)}]}]}};
 assert.equal((await handleServerDraft(req('POST','/api/editor-server-draft',tooBig),e)).status,413);
 const empty=await handleServerDraft(req('GET','/api/editor-server-draft?celebration=101'),e);
 assert.equal((await empty.json()).revision,0);
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
