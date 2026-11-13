import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {managedCelebration} from '../migration/cloudflare/app/security/private-editor-boundary.mjs';
const source=readFileSync(new URL('../migration/cloudflare/editor-demo-client-source.js',import.meta.url),'utf8');
const start=source.indexOf('async function serverPublish(');
const end=source.indexOf('const serverFileAsDataURL=',start);
assert.ok(start>=0&&end>start);
const method=source.slice(start,end);
function fixture({failD1=false}={}){
 const calls=[], data=new Map([['testShared',JSON.stringify({celebrationVisibility:{'101':'published'}})]]);
 const context=vm.createContext({
  serverSaving:false,dirty:false,db:{_serverPending:false},serverRevision:248,
  serverPublishedCelebrationVisibility:{'101':'published'},SERVER_ID:'101',
  SHARED_KEY:'testShared',IS_STAGE:true,LIVE_MEDIA_UPLOAD_HOST:true,
  privateCatalogue:null,
  localStorage:{
   getItem:key=>data.get(key)||null,
   setItem:(key,value)=>data.set(key,value)
  },
  ensureMemberPanel(){calls.push('panel-mounted');},
  memberPanel:{
   async commandContent(action,fields){
    calls.push(['canonicalD1',action,fields.visibility]);
    if(failD1)throw Error('Session D1 expirée');
    // The real M030 Michaël 101 contains no private pages or spaces,
    // but has a release fence, so the LEGACY route is forbidden.
    return {ok:true,revision:249,celebrationVisibility:fields.visibility,
     record:{spaces:[],pages:[]}};
   }
  },
  fetch:async()=>{calls.push('LEGACY_PUBLICATION_USED');throw Error('Legacy publication 403');},
  render(){calls.push('rerender');},
  serverMessage(msg){calls.push(['message',msg]);}
 });
 vm.runInContext(method+';globalThis.publish=serverPublish;',context,{timeout:1000});
 return {context,calls,data};
}
test('M031/2: existing D1 private-release fence protects celebration even with zero private pages',()=>{
 const state={drafts:{'101':{pages:[],spaces:[]}},published:{
  drafts:{'101':{pages:[],spaces:[]}},privateReleaseRevisions:{'101':{revision:7,token:'fence'}}
 }};
 assert.equal(managedCelebration(state,'101'),true);
});
test('M031/2: official Michaël 101 visibility uses canonical D1, not the old 403 route',async()=>{
 const {context,calls,data}=fixture();
 const ok=await context.publish({kind:'celebration',visibility:'hidden'},{flushContent:false});
 assert.equal(ok,true);
 assert.equal(calls.filter(x=>Array.isArray(x)&&x[0]==='canonicalD1').length,1);
 assert.ok(!calls.includes('LEGACY_PUBLICATION_USED'));
 assert.equal(context.serverRevision,249);
 assert.equal(context.serverPublishedCelebrationVisibility['101'],'hidden');
 assert.equal(JSON.parse(data.get('testShared')).celebrationVisibility['101'],'hidden');
 assert.ok(calls.includes('rerender'));
});
test('M031/2: expired D1 session fails closed without falling back to unguarded legacy API',async()=>{
 const {context,calls,data}=fixture({failD1:true});
 const ok=await context.publish({kind:'celebration',visibility:'hidden'},{flushContent:false});
 assert.equal(ok,false);
 assert.equal(context.serverRevision,248);
 assert.equal(context.serverPublishedCelebrationVisibility['101'],'published');
 assert.equal(JSON.parse(data.get('testShared')).celebrationVisibility['101'],'published');
 assert.ok(!calls.includes('LEGACY_PUBLICATION_USED'));
 assert.ok(calls.some(x=>Array.isArray(x)&&x[0]==='message'&&x[1].includes('commande D1 non confirmée')));
});
