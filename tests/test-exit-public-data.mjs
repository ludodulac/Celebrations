import {test} from "node:test";
import assert from "node:assert/strict";
import {handlePublicData} from "../migration/cloudflare/public-data-api.mjs";
const env={DB:{prepare(sql){return {async all(){return {results:[{sql}]}}}}}};
test("public read table allowed",async()=>{const r=await handlePublicData(new Request("https://staging/api/public-data?table=celebrations_celebrations"),env);assert.equal(r.status,200)});
test("private participant table denied",async()=>{const r=await handlePublicData(new Request("https://staging/api/public-data?table=celebrations_participants"),env);assert.equal(r.status,404)});
test("contents filtered server side",async()=>{const r=await handlePublicData(new Request("https://staging/api/public-data?table=celebrations_contents"),env);assert.ok((await r.json())[0].sql.includes("audience IN"))});
test("relations exclude restricted content",async()=>{const r=await handlePublicData(new Request("https://staging/api/public-data?table=celebrations_event_contents"),env);assert.match((await r.json())[0].sql,/content_id IN/)});
