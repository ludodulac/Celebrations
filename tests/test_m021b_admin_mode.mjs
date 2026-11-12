import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {handleSiteIdentity} from '../migration/cloudflare/site-identity-api.mjs';
import {TRIAL_SITE_CLIENT} from '../migration/cloudflare/editor-trial-site-client.mjs';
import {isM016AdminPreprodHost} from '../migration/cloudflare/app/security/editor-route-policy.mjs';

const HOST='celebrations-m016-admin-preprod.rondes.workers.dev';
const ORIGIN='https://'+HOST;
function fixture(){
 const privateData={
  version:9,
  drafts:{'90000002':{pages:[{id:'mercredi-90000002',group:'celebration',name:'Historique',blocks:[{kind:'text',text:'Privé'}],visibility:'hidden'}]}},
  shared:{pages:[],homeId:''},plans:[],mediaCatalogue:[],
  published:{celebrationAccessPolicies:{'90000002':{mode:'SELECTED_TYPES',typeIds:['member-type:anges']}},
   drafts:{},privatePageReleases:{'page:existing':{publication:'published'}}},
  memberDirectory:{revoked:['member:revoked']},
  siteIdentity:{title:'Célébrations',imageSrc:'',imageAlt:'',positionX:50,positionY:50,titles:{}}
 };
 let state=structuredClone(privateData),etag='etag-9',writes=0;
 const bucket={
  async get(){return {etag,text:async()=>JSON.stringify(state)}},
  async put(key,json,{onlyIf}){
   if(onlyIf?.etagMatches!==etag)return null;
   state=JSON.parse(json);etag='etag-'+state.version;writes++;return {etag};
  }
 };
 const env={EDITOR_BUCKET:bucket,M016_PREPROD_WRITE_ENABLED:'true',M016_ADMIN_PREPROD_HOST:HOST,
  ADMIN_PASSWORD_HASH:'a'.repeat(64)};
 const payload=String(Date.now())+'.'+'b'.repeat(32);
 const sig=createHmac('sha256',env.ADMIN_PASSWORD_HASH).update('site-editor-v1:'+payload).digest('hex');
 const cookie='celebrations_editor_access='+payload+'.'+sig;
 const request=(method='GET',body,extra={})=>new Request(ORIGIN+'/api/site-identity',{method,
  headers:{cookie,...(method==='POST'?{origin:ORIGIN,'content-type':'application/json'}:{}),...extra},
  ...(method==='POST'?{body:JSON.stringify(body)}:{})});
 return {state:()=>state,writes:()=>writes,env,request,privateData};
}
const data=async response=>({status:response.status,...await response.json()});

test('M021-B: unchecked default, persisted round-trip, and every ACL/session/publication byte unchanged',async()=>{
 const f=fixture(),original=structuredClone(f.privateData);
 let result=await data(await handleSiteIdentity(f.request(),f.env));
 assert.equal(result.status,200);
 assert.equal(result.memberAccessUiEnabled,false);
 assert.equal(result.identity.title,'Célébrations');
 result=await data(await handleSiteIdentity(f.request('POST',{expectedRevision:9,memberAccessUiEnabled:true}),f.env));
 assert.equal(result.status,200);
 assert.equal(result.memberAccessUiEnabled,true);
 assert.equal(f.state().version,10);
 assert.equal((await data(await handleSiteIdentity(f.request(),f.env))).memberAccessUiEnabled,true);
 result=await data(await handleSiteIdentity(f.request('POST',{expectedRevision:10,memberAccessUiEnabled:false}),f.env));
 assert.equal(result.memberAccessUiEnabled,false);
 assert.equal(f.state().version,11);
 assert.equal(f.writes(),2);
 for(const key of ['drafts','shared','plans','mediaCatalogue','published','memberDirectory','siteIdentity'])
  assert.deepEqual(f.state()[key],original[key],key+' must not change');
 assert.deepEqual(f.state().published.celebrationAccessPolicies['90000002'],
  {mode:'SELECTED_TYPES',typeIds:['member-type:anges']});
 assert.deepEqual(f.state().memberDirectory.revoked,['member:revoked']);
});

test('M021-B: rejects forged, stale, malformed and cross-origin mode writes',async()=>{
 const f=fixture();
 assert.equal((await handleSiteIdentity(new Request(ORIGIN+'/api/site-identity'),f.env)).status,401);
 assert.equal((await handleSiteIdentity(f.request('POST',{expectedRevision:9,memberAccessUiEnabled:true},
  {origin:'https://attacker.example'}),f.env)).status,403);
 assert.equal((await handleSiteIdentity(f.request('POST',{expectedRevision:9,memberAccessUiEnabled:'true'}),f.env)).status,400);
 assert.equal((await handleSiteIdentity(f.request('POST',{expectedRevision:8,memberAccessUiEnabled:true}),f.env)).status,409);
 assert.equal((await handleSiteIdentity(f.request('POST',{expectedRevision:9,memberAccessUiEnabled:true,identity:{title:'attack'}}),f.env)).status,400);
 assert.equal(f.writes(),0);
});

test('M021-B: visitor login presentation is independent of actual member authorization and admin gate',()=>{
 assert.equal(isM016AdminPreprodHost(HOST,{M016_PREPROD_WRITE_ENABLED:'true',M016_ADMIN_PREPROD_HOST:HOST}),true);
 assert.match(TRIAL_SITE_CLIENT,/memberShortcut\.hidden=!memberLoginVisible/);
 assert.match(TRIAL_SITE_CLIENT,/const memberEnabled=document\.body\?\.dataset\.memberSite==='1'/);
 assert.match(TRIAL_SITE_CLIENT,/const memberLoginVisible=memberEnabled&&document\.body\?\.dataset\.memberLoginVisible==='1'/);
 assert.match(TRIAL_SITE_CLIENT,/if\(memberEnabled\)void memberAccount\(\{action:'session'\}\)/);
});