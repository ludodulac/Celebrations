import {test} from "node:test";
import assert from "node:assert/strict";
import {handlePublicData} from "../migration/cloudflare/public-data-api.mjs";
const env={DB:{prepare(sql){return {async all(){return {results:[{sql}]}}}}}};
test("public read table allowed",async()=>{const r=await handlePublicData(new Request("https://staging/api/public-data?table=celebrations_celebrations"),env);assert.equal(r.status,200)});
test("private participant table denied",async()=>{const r=await handlePublicData(new Request("https://staging/api/public-data?table=celebrations_participants"),env);assert.equal(r.status,404)});
test("contents filtered server side",async()=>{const r=await handlePublicData(new Request("https://staging/api/public-data?table=celebrations_contents"),env);assert.ok((await r.json())[0].sql.includes("audience IN"))});
test("relations exclude restricted content",async()=>{const r=await handlePublicData(new Request("https://staging/api/public-data?table=celebrations_event_contents"),env);assert.match((await r.json())[0].sql,/content_id IN/)});

test("public visibility reads only the intended D1 display flag",async()=>{
 const r=await handlePublicData(new Request("https://staging/api/public-data?table=celebrations_public_settings"),env);
 assert.equal(r.status,200);
 const rows=await r.json();
 assert.equal(rows[0].sql,"SELECT show_other_celebrations FROM celebrations_public_settings WHERE id=1 LIMIT 1");
});

test("only published footer slugs are readable; drafts stay private",async()=>{
 const response=await handlePublicData(new Request("https://staging/api/public-data?table=celebrations_footer_drafts"),env);
 assert.equal(response.status,200);
 const rows=await response.json();
 assert.equal(rows[0].sql,"SELECT slug FROM celebrations_footer_drafts WHERE is_active=1 AND is_public=1");
 assert.ok(!rows[0].sql.includes("SELECT *"));
});
