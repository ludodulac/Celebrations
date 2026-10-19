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

test("staging page views never send POST telemetry to production Supabase",async()=>{
 const code=await src("public-click-tracking.js");
 let attempts=0;
 const window={CELEBRATIONS_STAGING_BACKEND:"https://isolated-staging.invalid",addEventListener(){}};
 const document={title:"Test",addEventListener(){}};
 const location={pathname:"/",search:"?staging=1",hash:""};
 vm.runInNewContext(code,{window,document,location,fetch(){attempts++;throw Error("Production traffic prohibited")}});
 assert.equal(attempts,0);
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
 let url=null;
 const fetch=async function(u){
   url=u;
   return new Response(JSON.stringify([{content:"# Site de test",title:"Mentions légales"}]),{status:200});
 };
 vm.runInNewContext(code,{document,location,fetch,FOOTER_PAGE_DEFS:{"mentions-legales":{title:"Mentions légales"}}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(url,location.origin+"/api/public-data?table=celebrations_footer_page&slug=mentions-legales");
 assert.ok(content.innerHTML.includes("Site de test"));
});
test("unavailable staging statistics never invoke legacy Supabase RPC",async()=>{
 const code=await src("admin-click-stats.js");
 const box={innerHTML:""};
 const button={dataset:{},className:"",textContent:"",onclick:null};
 const nav={querySelector(){return null},appendChild(){}};
 const document={querySelector(s){if(s===".admin-nav")return nav;if(s==="#clickStatsBox")return box;return null},querySelectorAll(){return []},createElement(){return button}};
 const window={CELEBRATIONS_STAGING_BACKEND:"https://isolated-staging.invalid",celebrationsSupabase:{rpc(){throw Error("Production RPC is forbidden")}}};
 const panel={innerHTML:""};
 vm.runInNewContext(code,{document,window,panel});
 button.onclick();
 await new Promise(resolve=>setImmediate(resolve));
 assert.ok(box.innerHTML.includes("Statistiques indisponibles"));
});
test("decorative flame media URL uses staging-aware helper",async()=>{
 const code=await src("public-celebration-shell.js");
 assert.match(code,/function publicFlameUrl\(c\)\{[^}]*supabaseMediaUrl\(c\.storagePath\)/);
});
