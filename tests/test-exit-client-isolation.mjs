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
