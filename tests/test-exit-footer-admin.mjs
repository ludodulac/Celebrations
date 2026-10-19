import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";
import {DatabaseSync} from "node:sqlite";
const source=await readFile(new URL("../migration/cloudflare/footer-admin-api.mjs",import.meta.url),"utf8");
const moduleText=source
 .replace('import {authorize} from "./auth-api.mjs";',
  'const authorize=async(request)=>request.headers.get("authorization")==="Bearer valid-staging-token";')
 .replace("export async function handleFooterAdmin","async function handleFooterAdmin");
const context={Request,Response,Date,Number,Set,String,Array,Object};
vm.runInNewContext(moduleText+"\nthis.handler=handleFooterAdmin;",context);
const schema=await readFile(new URL("../migration/cloudflare/celebrations-schema.sql",import.meta.url),"utf8");
function db(){
 const sqlite=new DatabaseSync(":memory:");
 sqlite.exec(schema);
 const calls=[];
 const wrap=(sql,args=[])=>({
  sql,args,bind(...v){return wrap(sql,v)},
  async first(){return sqlite.prepare(sql).get(...args)||null},
  async all(){return {results:sqlite.prepare(sql).all(...args)}},
  async run(){return {meta:{changes:sqlite.prepare(sql).run(...args).changes}}}
 });
 const DB={prepare(sql){return wrap(sql)},async batch(statements){
  calls.push(...statements.map(x=>({sql:x.sql,args:x.args})));
  sqlite.exec("BEGIN");
  try{for(const row of statements)sqlite.prepare(row.sql).run(...row.args);sqlite.exec("COMMIT")}
  catch(e){sqlite.exec("ROLLBACK");throw e}
 }};
 return {sqlite,DB,calls};
}
async function invoke(env,action,body={},authenticated=true){
 const r=await context.handler(new Request("https://staging.invalid/api/footer-admin",{
  method:"POST",headers:{"content-type":"application/json",...(authenticated?{authorization:"Bearer valid-staging-token"}:{})},
  body:JSON.stringify({action,...body})
 }),env);
 return {status:r.status,body:await r.json()};
}
test("footer admin rejects unauthenticated calls without any D1 writes",async()=>{
 const {sqlite,DB,calls}=db();
 try{const r=await invoke({DB},"admin_publish_footer",{slug:"cookies",draft_number:1,title:"Cookies",content:"Secret"},false);
 assert.equal(r.status,401);assert.equal(calls.length,0);
 assert.equal(sqlite.prepare("SELECT count(*) AS n FROM celebrations_footer_drafts").get().n,0)}
 finally{sqlite.close()}
});
test("footer editing is transactional, repeatable and preserves selected visibility",async()=>{
 const {sqlite,DB,calls}=db();
 try{
  const base={slug:"mentions-legales",draft_number:1,title:"Mentions",content:"# Texte"};
  assert.equal((await invoke({DB},"admin_publish_footer",base)).status,200);
  assert.equal((await invoke({DB},"admin_set_footer_public",{slug:base.slug,is_public:true})).status,200);
  assert.equal((await invoke({DB},"admin_publish_footer",{...base,content:"# Changement"})).status,200);
  let row=sqlite.prepare("SELECT content,is_public,is_active FROM celebrations_footer_drafts WHERE slug=?").get(base.slug);
  assert.equal(row.content,"# Changement");assert.equal(row.is_active,1);assert.equal(row.is_public,1);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM celebrations_footer_drafts WHERE slug=?").get(base.slug).n,1);
  assert.equal((await invoke({DB},"admin_publish_footer",{slug:base.slug,draft_number:2,title:"Mentions 2",content:"Brouillon 2"})).status,200);
  const rows=sqlite.prepare("SELECT draft_number,is_active,is_public FROM celebrations_footer_drafts ORDER BY draft_number").all();
  assert.equal(rows.length,2);assert.equal(rows[0].is_active,0);
  assert.equal(rows[1].is_active,1);assert.equal(rows[1].is_public,0);
  const list=await invoke({DB},"admin_footer_drafts");
  assert.equal(list.status,200);assert.equal(list.body.drafts.length,2);
  assert.ok(calls.some(c=>c.sql.startsWith("INSERT INTO celebrations_footer_drafts")));
 }finally{sqlite.close()}
});
test("unauthorized slugs, invalid content and missing active draft never mutate D1",async()=>{
 const {sqlite,DB,calls}=db();
 try{
  assert.equal((await invoke({DB},"admin_publish_footer",{slug:"../../participants",draft_number:1,title:"Bad",content:"x"})).status,400);
  assert.equal((await invoke({DB},"admin_publish_footer",{slug:"cookies",draft_number:1,title:"Cookies",content:15})).status,400);
  assert.equal((await invoke({DB},"admin_set_footer_public",{slug:"cookies",is_public:true})).status,409);
  assert.equal(calls.length,0);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM celebrations_footer_drafts").get().n,0);
 }finally{sqlite.close()}
});
test("only published legal page content can be read anonymously",async()=>{
 const {sqlite,DB}=db();
 try{
  sqlite.prepare("INSERT INTO celebrations_footer_drafts(slug,draft_number,title,content,is_active,is_public) VALUES(?,?,?,?,?,?)")
   .run("cookies",1,"Hidden","UNPUBLISHED SECRET",1,0);
  sqlite.prepare("INSERT INTO celebrations_footer_drafts(slug,draft_number,title,content,is_active,is_public) VALUES(?,?,?,?,?,?)")
   .run("mentions-legales",1,"Public","PUBLIC DOCUMENT",1,1);
  const {handlePublicData}=await import("../migration/cloudflare/public-data-api.mjs");
  const request=slug=>new Request("https://staging.invalid/api/public-data?table=celebrations_footer_page&slug="+encodeURIComponent(slug));
  const hidden=await handlePublicData(request("cookies"),{DB});
  assert.equal(hidden.status,200);assert.deepEqual(await hidden.json(),[]);
  const visible=await handlePublicData(request("mentions-legales"),{DB});
  assert.equal(visible.status,200);assert.equal((await visible.json())[0].content,"PUBLIC DOCUMENT");
  const invalid=await handlePublicData(request("not-a-legal-slug"),{DB});
  assert.equal(invalid.status,404);
 }finally{sqlite.close()}
});

test("real legal template placeholders remain unpublished even when an admin selects visibility",async()=>{
 const {sqlite,DB}=db();
 try{
  const p=await invoke({DB},"admin_publish_footer",{
   slug:"confidentialite",draft_number:1,title:"Confidentialité",
   content:"# Confidentialité\n[Indiquez l’identité du responsable du traitement.]"
  });
  assert.equal(p.status,200);
  const attempted=await invoke({DB},"admin_set_footer_public",{
   slug:"confidentialite",is_public:true
  });
  assert.equal(attempted.status,409);
  assert.match(attempted.body.error,/Complétez/);
  assert.equal(sqlite.prepare("SELECT is_public FROM celebrations_footer_drafts WHERE slug='confidentialite'").get().is_public,0);
 }finally{sqlite.close()}
});
