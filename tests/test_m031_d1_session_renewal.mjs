import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createEditorD1Session} from '../migration/cloudflare/app/admin/real-editor-member-spaces.mjs';
const HOST='https://ronde-des-archanges-universelle.eu';
const src=readFileSync(new URL('../migration/cloudflare/app/admin/real-editor-member-spaces.mjs',import.meta.url),'utf8');
test('M031/2: expired official PIN-exchanged D1 bearer can be renewed without a second password',async()=>{
 const originalNow=Date.now;let now=originalNow();
 const network=[],status=[];let count=0;
 try{
  Date.now=()=>now;
  const session=createEditorD1Session({origin:HOST,onChange:active=>status.push(active),
   fetchImpl:async(url,options)=>{
    network.push({url,options});
    if(JSON.parse(options.body||'{}').action==='editor-pin-session'){
     count++;
     return Response.json({ok:true,token:(count===1?'a':'b').repeat(64),expires_at:new Date(now+60000).toISOString()});
    }
    return Response.json({ok:true,revision:10,record:{pages:[],spaces:[]}});
   }});
  await session.loginWithEditorPin();
  assert.equal(session.connected(),true);
  now+=61000;assert.equal(session.connected(),false);
  await session.loginWithEditorPin();
  assert.equal(count,2);
  assert.equal(session.connected(),true);
  assert.deepEqual(status,[true,false,true]);
  assert.equal((await session.privateTransport({method:'GET',celebration:'101'})).ok,true);
  assert.equal(network[0].options.credentials,'same-origin');
  assert.equal(network[1].options.credentials,'same-origin');
  assert.equal(network[2].options.credentials,'omit');
  assert.equal(network[2].options.headers.authorization,'Bearer '+'b'.repeat(64));
  assert.equal(network[2].options.headers.cookie,undefined);
 }finally{Date.now=originalNow}
});
test('M031/2: unexpired bearer cannot be replaced by silent PIN exchange',async()=>{
 const session=createEditorD1Session({origin:HOST,fetchImpl:async()=>Response.json({
  ok:true,token:'a'.repeat(64),expires_at:new Date(Date.now()+300000).toISOString()
 })});
 await session.loginWithEditorPin();
 await assert.rejects(()=>session.loginWithEditorPin(),/Déconnexion préalable requise/);
});
test('M031/2: official D1 route refreshes once only on denied 401, not on ambiguous failures or manual logout',()=>{
 assert.match(src,/result.status===401/);
 assert.match(src,/manuallyLoggedOut=true;await session.logout\(\)/);
 assert.match(src,/refreshPending=session.loginWithEditorPin\(\)/);
 assert.match(src,/const privateTransport=command=>sendWithRenewal\(session.privateTransport,command\)/);
 assert.match(src,/const commandContent=async\(action,fields=\{\}\)=>\{const current=await readContent\(\);const r=await privateTransport/);
});
