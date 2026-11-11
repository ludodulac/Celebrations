import test from 'node:test';
import assert from 'node:assert/strict';
import {m021DemoAllowed} from '../migration/cloudflare/app/application/m021-demo-members.mjs';
import {normalizedSiteIdentity,handleSiteIdentity} from '../migration/cloudflare/site-identity-api.mjs';
import {handleAuth} from '../migration/cloudflare/auth-api.mjs';

const M016='celebrations-m016-admin-preprod.rondes.workers.dev';
const env={
 M016_ADMIN_PREPROD_HOST:M016,M016_PREPROD_WRITE_ENABLED:'true',
 MEMBER_DIRECTORY_API_HOST:M016,M021_DEMO_MEMBERS_ENABLED:'true',
 M021_DEMO_D1_ISOLATED:'true'
};
const request=(host,protocol='https:')=>new Request(protocol+'//'+host+'/api/admin/member-directory');

test('fictional credentials require exact HTTPS isolated M016 host AND all feature flags',()=>{
 assert.equal(m021DemoAllowed(request(M016),env),true);
 for(const hostname of ['ronde-des-archanges-universelle.eu',
  'www.ronde-des-archanges-universelle.eu','celebrations-exit-staging.rondes.workers.dev',
  'celebrations-m015-public-preprod.rondes.workers.dev']){
  assert.equal(m021DemoAllowed(request(hostname),env),false,hostname);
 }
 assert.equal(m021DemoAllowed(request(M016,'http:'),env),false);
 for(const name of Object.keys(env)){
  assert.equal(m021DemoAllowed(request(M016),{...env,[name]:'false'}),false,name);
 }
});

test('identity defaults remain entirely empty: legacy site header stays unchanged',()=>{
 assert.deepEqual(normalizedSiteIdentity(undefined),{
  title:'',imageSrc:'',imageAlt:'',positionX:50,positionY:50,titles:{}
 });
});

test('site identity retains personal title, optional localized titles and safe crop fallback',()=>{
 const got=normalizedSiteIdentity({
  title:' Ronde des Archanges Universelle ',
  imageSrc:'/media/new/demo.webp',imageAlt:'Rencontre en plein air',
  positionX:23,positionY:999,titles:{en:' Universal Archangel Circle ',es:''}
 });
 assert.equal(got.title,'Ronde des Archanges Universelle');
 assert.equal(got.titles.en,'Universal Archangel Circle');
 assert.equal(got.titles.fr,undefined);
 assert.equal(got.positionX,23);
 assert.equal(got.positionY,50);
 assert.equal(got.titles.es,undefined);
 assert.deepEqual(Object.keys(got.titles),['en']);
});

test('site identity route is never publicly writable and requires editor context',async()=>{
 const u=new Request('https://'+M016+'/api/site-identity',{method:'POST',headers:{origin:'https://attacker.invalid'}});
 const r=await handleSiteIdentity(u,{...env});
 assert.equal(r.status,404); // EDITOR_BUCKET absent: fail closed.
 assert.equal((await r.json()).ok,false);
});

test('official member login explicitly rejects synthetic addresses before touching D1',async()=>{
 const email='m021-'+'a'.repeat(32)+'@test.invalid';
 const req=new Request('https://ronde-des-archanges-universelle.eu/api/auth',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({action:'participant_login_derived',email,
   password_proof:'f'.repeat(64)})
 });
 const result=await handleAuth(req,{DB:{}});
 assert.equal(result.status,403);
 assert.equal((await result.json()).ok,false);
});

test('ordinary account request is not mistaken for demo identity',async()=>{
 const req=new Request('https://ronde-des-archanges-universelle.eu/api/auth',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({action:'participant_status',email:'member@example.test'})
 });
 const result=await handleAuth(req,{DB:{
  prepare:()=>({bind:()=>({first:async()=>({password_hash:null})})})
 }});
 assert.notEqual(result.status,403); 
});
