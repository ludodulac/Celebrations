import {test} from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";
const src=async path=>readFile(new URL("../"+path,import.meta.url),"utf8");

test("staging skips Supabase SDK initialization while default production still uses it",async()=>{
 const code=await src("supabase-client.js");
 for(const [search,expected] of [["?staging=1",false],["",true]]){
  let called=false;
  const window={supabase:{createClient(){called=true;return {production:true}}}};
  vm.runInNewContext(code,{window,location:{search},URLSearchParams});
  assert.equal(called,expected);
 }
});

test("staging page views are written only to same-origin Cloudflare D1 statistics",async()=>{
 const code=await src("public-click-tracking.js");
 const calls=[];
 const window={CELEBRATIONS_STAGING_BACKEND:"https://isolated-staging.invalid",addEventListener(){}};
 const document={title:"Test",addEventListener(){}};
 const location={pathname:"/",search:"?staging=1",hash:""};
 const localStorage={getItem(){return "randombrowservisitor123"},setItem(){}};
 const fetch=(url,opts)=>{calls.push({url,opts});return Promise.resolve({ok:true})};
 vm.runInNewContext(code,{window,document,location,fetch,localStorage});
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,"/api/stats");
 assert.equal(calls[0].opts.method,"POST");
 const data=JSON.parse(calls[0].opts.body);
 assert.equal(data.action,"track");assert.equal(data.target_kind,"page-view");
 assert.equal(data.visitor_id,"randombrowservisitor123");
});

test("footer visibility uses D1 staging projection, not Supabase REST",async()=>{
 const code=await src("public-footer-visibility.js");
 const a={hidden:false,dataset:{footerSlug:"mentions-legales"}};
 const b={hidden:false,dataset:{footerSlug:"cookies"}};
 let calls=0,legacyCalls=0;
 const window={async celebrationsStagingData(table){
   calls++;assert.equal(table,"celebrations_footer_drafts");return [{slug:"mentions-legales"}];
 }};
 const document={querySelectorAll(){return [a,b]}};
 vm.runInNewContext(code,{window,document,fetch(){legacyCalls++;throw Error("Forbidden")}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls,1);
 assert.equal(legacyCalls,0);
 assert.equal(a.hidden,false);
 assert.equal(b.hidden,true);
});

test("legal page renderer fetches only isolated D1 URL on staging hostname",async()=>{
 const code=await src("footer-page-public.js");
 const content={innerHTML:""};
 const title={textContent:""};
 const document={title:"",body:{dataset:{legalPage:"mentions-legales"}},getElementById(id){return id==="legalContent"?content:title}};
 const location={hostname:"celebrations-exit-staging.rondes.workers.dev",origin:"https://celebrations-exit-staging.rondes.workers.dev"};
 const window={CELEBRATIONS_STAGING_BACKEND:location.origin};
 let url=null;
 const fetch=async function(u){
   url=u;
   return new Response(JSON.stringify([{content:"# Site de test",title:"Mentions légales"}]),{status:200});
 };
 vm.runInNewContext(code,{document,location,window,fetch,FOOTER_PAGE_DEFS:{"mentions-legales":{title:"Mentions légales"}}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(url,location.origin+"/api/public-data?table=celebrations_footer_page&slug=mentions-legales");
 assert.ok(content.innerHTML.includes("Site de test"));
});
test("staging statistics dashboard calls only authenticated Cloudflare summary, never Supabase RPC",async()=>{
 const code=await src("admin-click-stats.js");
 const box={innerHTML:""};
 const button={dataset:{},className:"",textContent:"",onclick:null};
 const nav={querySelector(){return null},appendChild(){}};
 const document={getElementById(id){return id==="clickStatsBox"?box:null},querySelector(s){if(s===".admin-nav")return nav;return null},querySelectorAll(){return []},createElement(){return button}};
 const window={CELEBRATIONS_STAGING_BACKEND:"https://isolated-staging.invalid",celebrationsSupabase:{rpc(){throw Error("Production RPC is forbidden")}}};
 const localStorage={getItem(){return "synthetic-admin-test"}};
 const calls=[];
 const fetch=async(url,opts)=>{calls.push({url,opts});return {ok:true,json:async()=>({ok:true,visits:{visitors:17,visits:29,pages:[]},clicks:[]})}};
 const panel={innerHTML:""};
 vm.runInNewContext(code,{document,window,panel,localStorage,fetch});
 button.onclick();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls.length,1);assert.equal(calls[0].url,"/api/stats");
 assert.equal(calls[0].opts.headers.authorization,"Bearer synthetic-admin-test");
 assert.equal(JSON.parse(calls[0].opts.body).action,"summary");
 assert.ok(box.innerHTML.includes("29"));
});
test("decorative flame media URL uses staging-aware helper",async()=>{
 const code=await src("public-celebration-shell.js");
 assert.match(code,/function publicFlameUrl\(c\)\{[^}]*supabaseMediaUrl\(c\.storagePath\)/);
});
