// M018-B — visitor navigation contract, no network, D1, R2 or production writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {projectAuthorizedMemberPages} from '../migration/cloudflare/app/domain/member-visitor-navigation.mjs';

const gabriel='90000002',michael='90000001';
const cat1='page:11111111-1111-4111-8111-111111111111';
const cat2='page:22222222-2222-4222-8222-222222222222';
const words={
 fr:['Gabriel catégorie 1 — français','Gabriel catégorie 2 — français'],
 en:['Gabriel category 1 — English','Gabriel category 2 — English'],
 es:['Gabriel categoría 1 — español','Gabriel categoría 2 — español']
};
const page=(id,cat,languageId)=>({
 id,celebrationId:gabriel,celebrationLabel:'Gabriel 2026',
 spaceName:'Catégorie '+(cat+1),name:words[languageId][cat],languageId,
 // Auth and untranslated drafts must never be included in the DOM model.
 accessPolicy:{mode:'SELECTED_TYPES'},translations:{secret:'private'},
 blocks:[{kind:'text',text:'private source'}]
});
test('M018-B: ONE Gabriel, two categories and three manually written languages',()=>{
 const all=[];
 for(const lang of ['fr','en','es']){
  const authorized={pages:[page(cat1,0,lang),page(cat2,1,lang)]};
  const projected=projectAuthorizedMemberPages(authorized,lang);
  assert.equal(new Set(projected.map(x=>x.celebrationId)).size,1);
  assert.equal(projected[0].celebrationId,gabriel);
  assert.deepEqual(projected.map(x=>x.name),words[lang]);
  assert.deepEqual(projected.map(x=>x.languageId),[lang,lang]);
  assert.ok(projected.every(x=>!Object.hasOwn(x,'blocks')&&
   !Object.hasOwn(x,'translations')&&!Object.hasOwn(x,'accessPolicy')));
  all.push(...projected.map(x=>x.name));
 }
 assert.equal(new Set(all).size,6);
});
test('M018-B: logged-in visitor on public Michael sees server-authorized Gabriel',()=>{
 // The historical bug filtered the member list to the PUBLIC page celebration.
 // The server is authoritative: do not apply a second celebrationId filter.
 const currentlyOpenPublicCelebration=michael;
 const result=projectAuthorizedMemberPages({pages:[page(cat1,0,'en')]},'en');
 assert.notEqual(result[0].celebrationId,currentlyOpenPublicCelebration);
 assert.equal(result[0].celebrationLabel,'Gabriel 2026');
});
test('M018-B: category restrictions and hidden celebrations are NOT invented on the client',()=>{
 // A user in category 1 receives only category 1 from the verified server.
 const onlyCat1=projectAuthorizedMemberPages({pages:[page(cat1,0,'fr')]},'fr');
 assert.deepEqual(onlyCat1.map(x=>x.id),[cat1]);
 // If the server returns no authorized pages there must be no Gabriel entry.
 assert.deepEqual(projectAuthorizedMemberPages({pages:[]},'fr'),[]);
});
test('M018-B: no wrong-language fallback, no duplicate page, no untrusted fields',()=>{
 const response={pages:[
  page(cat1,0,'fr'),page(cat1,0,'fr'),page(cat2,1,'es'),null,
  {id:'evil',name:'fake',celebrationId:gabriel,languageId:'fr'}
 ]};
 assert.deepEqual(projectAuthorizedMemberPages(response,'fr').map(p=>p.id),[cat1]);
 assert.deepEqual(projectAuthorizedMemberPages(response,'en'),[]);
 assert.throws(()=>projectAuthorizedMemberPages({},'fr'),/Liste invalide/);
});
