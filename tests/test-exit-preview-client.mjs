import {test} from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";
const source=await readFile(new URL("../migration/cloudflare/preview-client.js",import.meta.url),"utf8");
function client({rows=[{show_other_celebrations:1}],status=200}={}){
 const calls=[];
 const window={CELEBRATIONS_STAGING_BACKEND:"https://isolated-staging.invalid"};
 const fetch=async(url,options={})=>{
  calls.push({url,options});
  return new Response(JSON.stringify(rows),{status,headers:{"content-type":"application/json"}});
 };
 vm.runInNewContext(source,{window,fetch,localStorage:{getItem:()=>null}});
 return {window,calls};
}
test("visibility uses public staging D1 API, never legacy Supabase function",async()=>{
 const {window,calls}=client();
 const {data,error}=await window.celebrationsSupabase.functions.invoke("celebrations-visibility",{body:{action:"get"}});
 assert.equal(error,null);assert.equal(data.ok,true);
 assert.equal(data.show_other_celebrations,true);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,"https://isolated-staging.invalid/api/public-data?table=celebrations_public_settings");
 assert.equal(calls[0].options.credentials,"omit");
});
test("visibility is false for absent or disabled public settings",async()=>{
 for(const rows of [[],[{show_other_celebrations:0}]]){
  const {window}=client({rows});
  const {data}=await window.celebrationsSupabase.functions.invoke("celebrations-visibility",{body:{action:"get"}});
  assert.equal(data.ok,true);assert.equal(data.show_other_celebrations,false);
 }
});
test("unavailable visibility settings fail closed",async()=>{
 const {window}=client({status:503});
 const {data}=await window.celebrationsSupabase.functions.invoke("celebrations-visibility",{body:{action:"get"}});
 assert.equal(data.ok,false);
});
test("media URLs on staging do not rewrite public external links",()=>{
 const {window}=client();
 assert.equal(window.celebrationsStagingMedia("https://drive.google.com/file/d/example/view"),"https://drive.google.com/file/d/example/view");
 assert.equal(window.celebrationsStagingMedia("media/example.pdf"),"https://isolated-staging.invalid/media/media/example.pdf");
});

test("legacy footer administration actions route only to authenticated staging D1",async()=>{
 const actions=["admin_footer_drafts","admin_publish_footer","admin_set_footer_public"];
 for(const action of actions){
  const calls=[];
  const token="isolated-admin-token";
  const window={CELEBRATIONS_STAGING_BACKEND:"https://isolated-staging.invalid"};
  const fetch=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({ok:true}),{status:200})};
  vm.runInNewContext(source,{window,fetch,localStorage:{getItem:()=>token}});
  const {data}=await window.celebrationsSupabase.functions.invoke("celebrations-access",{body:{action}});
  assert.equal(data.ok,true);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,"https://isolated-staging.invalid/api/footer-admin");
  assert.equal(calls[0].options.headers.authorization,"Bearer "+token);
 }
});
