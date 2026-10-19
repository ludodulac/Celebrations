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

test("participant management actions use isolated authenticated D1 API",async()=>{
 for(const [name,action] of [
  ["celebrations-access","admin_list_participants"],
  ["celebrations-access","admin_add_participant"],
  ["celebrations-access","admin_remove_participant"],
  ["celebrations-audience","admin_list"],
  ["celebrations-audience","admin_set"]
 ]){
  const calls=[];
  const window={CELEBRATIONS_STAGING_BACKEND:"https://staging.invalid"};
  const fetch=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({ok:true}),{status:200})};
  vm.runInNewContext(source,{window,fetch,localStorage:{getItem:()=>"admin-test-token"}});
  const {data}=await window.celebrationsSupabase.functions.invoke(name,{body:{action,email:"test@staging.invalid",audience:"angel"}});
  assert.equal(data.ok,true);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,"https://staging.invalid/api/participants-admin");
  assert.equal(calls[0].options.headers.authorization,"Bearer admin-test-token");
 }
});

test("staging admin loads protected programme rows via bearer-authenticated D1 list",async()=>{
 const calls=[],window={CELEBRATIONS_STAGING_BACKEND:"https://isolated-staging.invalid"};
 const document={body:{classList:{contains:name=>name==="admin-app"}}};
 const fetch=async(url,options={})=>{
  calls.push({url,options});
  assert.equal(url,"https://isolated-staging.invalid/api/admin");
  return new Response(JSON.stringify({ok:true,items:[{id:"private-id",audience:"angel"}]}),{status:200});
 };
 vm.runInNewContext(source,{window,document,fetch,localStorage:{getItem:key=>key==="celebrations-admin-token"?"staging-admin-bearer":null}});
 const rows=await window.celebrationsStagingData("celebrations_contents");
 assert.equal(rows.length,1);assert.equal(rows[0].audience,"angel");
 assert.equal(calls[0].options.method,"POST");
 assert.equal(calls[0].options.headers.authorization,"Bearer staging-admin-bearer");
 assert.equal(JSON.parse(calls[0].options.body).table,"celebrations_contents");
});
test("staging public visitor never calls administrator D1 API",async()=>{
 const calls=[],window={CELEBRATIONS_STAGING_BACKEND:"https://isolated-staging.invalid"};
 const document={body:{classList:{contains:()=>false}}};
 const fetch=async(url,options={})=>{
  calls.push({url,options});return new Response(JSON.stringify([{id:"public-id",audience:"all"}]),{status:200});
 };
 vm.runInNewContext(source,{window,document,fetch,localStorage:{getItem:()=>null}});
 const rows=await window.celebrationsStagingData("celebrations_contents");
 assert.equal(rows.length,1);
 assert.equal(calls[0].url,"https://isolated-staging.invalid/api/public-data?table=celebrations_contents");
 assert.ok(!calls[0].options.headers?.authorization);
});
