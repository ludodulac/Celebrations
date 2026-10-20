import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const data=JSON.parse(await readFile(new URL("../migration/cloudflare/legal-drafts-v2.json",import.meta.url),"utf8"));
test("each legally unfinished page remains explicitly marked as a PRIVATE draft",()=>{
 assert.deepEqual(Object.keys(data.drafts).sort(),["confidentialite","cookies","mentions-legales"]);
 for(const [slug,page] of Object.entries(data.drafts)){
  assert.ok(page.title?.length>8,slug);
  assert.ok(page.content.length>800,slug);
  assert.match(page.content,/\[[^\]\r\n]{3,300}\]/,slug+" must have unresolved publication-blocking fields");
  assert.match(page.content,/ronde-des-archanges@nation-essenienne.eu/);
  assert.ok(!("is_public" in page),"Draft JSON never defines public state");
 }
});
test("legal pages never invent an editor, a SIREN, privacy retention or cookie exemption",()=>{
 const mentions=data.drafts["mentions-legales"].content;
 assert.match(mentions,/\[À compléter : nom/);
 assert.match(mentions,/\[À compléter : adresse postale/);
 assert.match(mentions,/Cloudflare, Inc/);
 assert.match(mentions,/101 Townsend Street/);
 const privacy=data.drafts.confidentialite.content;
 assert.match(privacy,/identifiant pseudonyme/i);
 assert.match(privacy,/\[À compléter : durée de conservation/);
 assert.match(privacy,/Supabase/);
 assert.match(privacy,/Cloudflare/);
 const cookies=data.drafts.cookies.content;
 assert.match(cookies,/localStorage/);
 assert.match(cookies,/YouTube/);
 assert.match(cookies,/SoundCloud/);
 assert.match(cookies,/\[À valider avant publication : analyse/);
 assert.ok(!/aucun cookie|ne nécessit(e|ent) jamais (de )?consentement/i.test(cookies));
});
