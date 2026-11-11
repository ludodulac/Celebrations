// M011-C regression: M005 domain and existing member UI; NO D1/R2/network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSpacesDraftWorkspace} from '../migration/cloudflare/app/admin/editor-spaces-draft.mjs';
import {createMemberDirectoryTransport} from './fixtures/m011c-legacy-member-transport.mjs';
import {canReadSpacePage} from '../migration/cloudflare/app/domain/celebration-spaces.mjs';

const original={
 id:41,archangel:'Gabriel',year:'2026–2027',
 days:[{key:'day-1',label:'Ouverture',text:'CONTENU-HISTORIQUE'}],
 pages:[{id:'p-origin',title:'Page existante',blocks:[{text:'Texte source'}]}],
 spaces:[{
   id:'space-original',celebrationId:'41',name:'Espace des membres',
   visibility:'PRIVATE',accessPolicy:{mode:'PUBLIC'},
   pages:[{id:'p-space',celebrationId:'41',spaceId:'space-original',
     title:'Page privée',visibility:'published',publicationStatus:'published',
     published:true,blocks:[{text:'Texte conservé',targetPageId:'p-origin'}],
     translations:{en:{title:'English title'}},
     enrollments:[{memberId:'person:secret'}]}],
   enrollments:[{memberId:'person:secret'}],
   translations:{en:{name:'Members space'}},
   media:[{path:'/media/livret.pdf'}]
 }]
};
function fixture() {
 const ids=['draft-space:1','draft-page:2','draft-celebration:3',
   'draft-space:4','draft-page:5','draft-page:6','draft-space:7'];
 let index=0;
 const ws=createSpacesDraftWorkspace([original],{
  allocateId:()=>ids[index++]??'draft-extra:'+(++index)
 });
 return ws;
}
test('M011-C drafts never mutate input editor pages or membership grants',()=>{
 const before=structuredClone(original),ws=fixture();
 const id=ws.addSpace('41',{name:'Salle protégée',visibility:'PRIVATE'});
 assert.equal(id,'draft-space:1');
 const page=ws.addPage('41',id,{title:'Page de préparation'});
 assert.equal(page,'draft-page:2');
 assert.equal(ws.spaces('41').length,2);
 assert.equal(ws.getSpace('41',id).visibility,'PRIVATE');
 assert.equal(ws.getSpace('41',id).pages[0].publicationStatus,'draft');
 assert.deepEqual(original,before);
 assert.equal(ws.changed,true);
 assert.equal(ws.canUndo,true);
 ws.undo();
 assert.equal(ws.getSpace('41',id).pages.length,0);
 ws.undo();
 assert.equal(ws.spaces('41').length,1);
 ws.redo();ws.redo();
 assert.equal(ws.getSpace('41',id).pages.length,1);
 ws.discard();
 assert.equal(ws.changed,false);
 assert.deepEqual(ws.list(),[before]);
 assert.equal(ws.canUndo,false);
});
test('M011-C duplicate delegates to M005: drafts, blocks, translations and media retained but individual grants stripped',()=>{
 const ws=fixture();
 // Consume first two draft IDs, then use the named IDs from fixture.
 const id=ws.addSpace('41',{name:'Préparation'});
 ws.addPage('41',id,{title:'Page libre'});
 const cloneId=ws.duplicate('41');
 assert.equal(cloneId,'draft-celebration:3');
 const c=ws.get(cloneId);
 const originalSpace=c.spaces.find(s=>s.name==='Espace des membres');
 const copiedPage=originalSpace.pages[0];
 assert.equal(c.visibility,'draft');
 assert.equal(c.publicationStatus,'draft');
 assert.equal(originalSpace.visibility,'PRIVATE');
 assert.equal(originalSpace.publicationStatus,'draft');
 assert.equal(copiedPage.publicationStatus,'draft');
 assert.equal(copiedPage.published,false);
 assert.equal(copiedPage.blocks[0].text,'Texte conservé');
 assert.equal(copiedPage.blocks[0].targetPageId,c.pages[0].id);
 assert.deepEqual(originalSpace.translations,{en:{name:'Members space'}});
 assert.deepEqual(copiedPage.translations,{en:{title:'English title'}});
 assert.equal(originalSpace.media[0].path,'/media/livret.pdf');
 assert.ok(!('enrollments' in originalSpace));
 assert.ok(!('enrollments' in copiedPage));
 assert.notEqual(copiedPage.id,original.spaces[0].pages[0].id);
 assert.equal(ws.list()[0].days[0].text,'CONTENU-HISTORIQUE');
 assert.deepEqual(original.spaces[0].enrollments,[{memberId:'person:secret'}]);
});
test('M011-C no private access on incomplete canonical context and no public publication side effects',()=>{
 const ws=fixture();
 const id=ws.addSpace('41',{name:'Invite only',visibility:'PRIVATE'});
 const pid=ws.addPage('41',id,{title:'Page'});
 assert.equal(canReadSpacePage(ws.get('41'),id,pid),false);
 assert.throws(()=>ws.updateSpace('41',id,{mode:'SELECTED_TYPES',
   typeIds:['not-a-type']}),/policy/i);
 assert.equal(ws.getSpace('41',id).accessPolicy.mode,'PUBLIC');
 ws.updateSpace('41',id,{visibility:'PUBLIC',mode:'PUBLIC'});
 assert.equal(ws.getSpace('41',id).visibility,'PUBLIC');
 assert.equal(ws.getSpace('41',id).pages[0].visibility,'draft');
});
test('M011-C transport: only admin token and same-origin JSON route; fail closed',async()=>{
 const requests=[];
 const transport=createMemberDirectoryTransport({
  origin:'https://example.org',tokenProvider:()=> 'admin-test-only',
  fetchImpl:async(url,options)=>{
    requests.push({url,options});
    return {ok:true,headers:new Headers({'content-type':'application/json'}),
      json:async()=>({ok:true,data:{members:[]}})};
  }
 });
 assert.deepEqual(await transport({method:'GET',action:'snapshot',limit:50,
   search:'Marie',cursor:'m@example.org'}),{ok:true,data:{members:[]}});
 const first=requests[0];
 assert.equal(new URL(first.url).origin,'https://example.org');
 assert.equal(new URL(first.url).pathname,'/api/admin/member-directory');
 assert.equal(new URL(first.url).searchParams.get('search'),'Marie');
 assert.equal(first.options.headers.authorization,'Bearer admin-test-only');
 assert.equal(first.options.credentials,'same-origin');
 assert.equal(first.options.cache,'no-store');
 assert.equal(first.options.body,undefined);
 await transport({method:'POST',action:'create_type',typeId:'member-type:choir',name:'Chorale'});
 assert.equal(JSON.parse(requests[1].options.body).action,'create_type');
 assert.equal(requests[1].options.headers['content-type'],'application/json');
 assert.equal((await createMemberDirectoryTransport({
   origin:'https://example.org',tokenProvider:()=>'',
   fetchImpl:()=>{throw Error('Must not send');}
 })({method:'POST',action:'create_person'})).ok,false);
 const absent=await createMemberDirectoryTransport({
  origin:'https://example.org',tokenProvider:()=>'fake',
  fetchImpl:async()=>({status:404,ok:false,headers:new Headers({'content-type':'text/html'})})
 })({method:'GET',action:'snapshot'});
 assert.equal(absent.ok,false);
 assert.match(absent.error,/non activée|indisponible/);
 await assert.rejects(()=>transport({method:'DELETE'}),/Invalid method/);
});
test('M011-C editor hook opt-in; no duplicate edit application, secure command adapter',()=>{
 const html=readFileSync(new URL('../admin.html',import.meta.url),'utf8');
 const bridge=readFileSync(new URL('./fixtures/m011c-legacy-member-bridge.js',import.meta.url),'utf8');
 const directory=readFileSync(new URL('../migration/cloudflare/app/admin/member-directory-admin-integration.mjs',import.meta.url),'utf8');
 const spaces=readFileSync(new URL('../migration/cloudflare/app/admin/editor-member-spaces-integration.mjs',import.meta.url),'utf8');
 assert.equal((html.match(/data-admin="members-spaces"/g)||[]).length,0);
 assert.doesNotMatch(html,/admin-member-spaces-bridge\.js/);
 assert.match(bridge,/const originalSetTab=setTab/);
 assert.match(bridge,/return originalSetTab\(section\)/);
 assert.match(bridge,/celebrationsAdminReady/);
 assert.doesNotMatch(directory,/action:'set_page_policy'/);
 assert.match(spaces,/if\(!ready\(\)\)return/);
 assert.match(spaces,/release\.disabled=!ready\(\)/);
 assert.doesNotMatch(spaces,/localStorage|\.put\(|\.post\(/);
});
