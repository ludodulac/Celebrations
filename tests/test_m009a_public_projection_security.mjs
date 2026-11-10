// M009-A — hostile fixtures: prove sensitive data stays outside anonymous JSON and HTML.
// No network, production R2/D1 binding, deployment or private route activation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {publicSnapshot,publishedMedia,handleEditorPublication}
 from '../migration/cloudflare/editor-publication-api.mjs';
import {projectPublishedLanguage} from '../migration/cloudflare/app/application/public-language-release.mjs';
import {loadSevenStageContent} from '../migration/cloudflare/editor-demo-preparation-page.mjs';
import {handleTrialSite} from '../migration/cloudflare/editor-trial-site-page.mjs';

const HOST='https://www.ronde-des-archanges-universelle.eu';
const home={id:'neutral-accueil-general',name:'Accueil',group:'page',
 visibility:'published',blocks:[
  {id:1,kind:'text',text:'FR_SITE_PUBLIC',draftNote:'SECRET_BLOCK_METADATA'},
  {id:2,kind:'section',layout:'columns',columns:[[
   {id:3,kind:'text',text:'COLONNE_PUBLIQUE',memberAssignments:'SECRET_CHILD_METADATA'},
   {id:4,kind:'button',text:'Accès privé',href:'/private/space-123'}
  ],[{id:5,kind:'image',src:'/media/photos/visible.jpg'}]]}
 ]};
const footer={id:'neutral-'+'a'.repeat(36),name:'Mentions légales',group:'page',
 placement:'footer',blocks:[{id:1,kind:'text',text:'FOOTER_PUBLIC'}]};
const legacy={id:'mercredi-101',name:'Mercredi',group:'celebration',
 blocks:[{id:1,kind:'text',text:'CELEBRATION_PUBLIQUE'}]};
const hidden={id:'jeudi-101',name:'SECRET_HIDDEN_PAGE',group:'celebration',
 visibility:'hidden',blocks:[{kind:'text',text:'SECRET_DRAFT_TEXT'}]};
const privatePage={id:'vendredi-101',name:'SECRET_MEMBER_PAGE',group:'celebration',
 visibility:'published',accessPolicy:{mode:'SELECTED_TYPES',typeIds:['member-type:choir']},
 blocks:[{kind:'text',text:'SECRET_MEMBERS_ONLY'}]};
const privateSpace={id:'space:101:private',celebrationId:'101',visibility:'PRIVATE',
 accessPolicy:{mode:'PUBLIC'},name:'SECRET_SPACE_NAME',
 pages:[{id:'space-page-1',spaceId:'space:101:private',celebrationId:'101',
  accessPolicy:{mode:'PUBLIC'},visibility:'published',blocks:[{kind:'text',text:'SECRET_SPACE_BODY'}]}]};
function fixture(){
 const shared={pages:[home,footer,{id:'neutral-private',name:'SECRET_SHARED',
  group:'page',visibility:'published',private:true,blocks:[{kind:'text',text:'SECRET_SHARED_BODY'}]}],
 homeId:home.id,inviteCodes:['SECRET_SHARED_INVITE'],celebrationVisibility:{
  '202':'hidden'}};
 const drafts={'101':{pages:[legacy,hidden,privatePage],spaces:[privateSpace],
  administratorEmail:'SECRET_RECORD_ADMIN',memberLinks:['SECRET_RECORD_LINK']}};
 const plans=[{id:'plan-gabriel-2026-11-04',archangel:'Gabriel',
  date:'2026-11-04',title:'SECRET_DRAFT_PLAN',visibility:'draft'},
 {id:'plan-michael-2027-01-06',archangel:'Michaël',date:'2027-01-06',
  title:'PLAN_PUBLIC',visibility:'published',internalOwner:'SECRET_PLAN_METADATA'}];
 const published={shared:structuredClone(shared),drafts:structuredClone(drafts),
  plans:structuredClone(plans),celebrationVisibility:{'202':'hidden'},
  privateDirectory:'SECRET_PUBLISHED_DIR'};
 const s={version:9,updatedAt:'2030-01-01T00:00:00.000Z',
  publishedAt:'2026-11-10T00:00:00.000Z',
  shared:structuredClone(shared),drafts:structuredClone(drafts),
  plans:structuredClone(plans),published,localization:{pages:{
   [home.id]:{en:{name:'SECRET_UNRELEASED_TRANSLATION'}}}},
  mediaCatalogue:[
   {type:'image',src:'/media/new/public.jpg',name:'GALERIE_PUBLIQUE',general:true},
   {type:'image',src:'/media/new/private.jpg',name:'SECRET_PRIVATE_MEDIA',general:true,
    visibility:'private',accessPolicy:{mode:'SELECTED_TYPES',typeIds:['member-type:choir']}},
   {type:'image',src:'/media/private/member.jpg',name:'SECRET_PRIVATE_PATH',general:true},
   {type:'image',src:'/media/new/hidden.jpg',name:'SECRET_HIDDEN_UPLOAD',general:false}
  ]};
 return s;
}
function noSecrets(value,more=[]){
 const serialized=typeof value==='string'?value:JSON.stringify(value);
 for(const term of ['SECRET_BLOCK_METADATA','SECRET_CHILD_METADATA','SECRET_HIDDEN_PAGE',
 'SECRET_DRAFT_TEXT','SECRET_MEMBER_PAGE','SECRET_MEMBERS_ONLY','SECRET_SPACE_NAME',
 'SECRET_SPACE_BODY','SECRET_SHARED','SECRET_RECORD_ADMIN','SECRET_RECORD_LINK',
 'SECRET_DRAFT_PLAN','SECRET_PLAN_METADATA','SECRET_PUBLISHED_DIR',
 'SECRET_UNRELEASED_TRANSLATION','SECRET_PRIVATE_MEDIA','SECRET_PRIVATE_PATH',
 'SECRET_HIDDEN_UPLOAD','/private/space-123',...more])
  assert.equal(serialized.includes(term),false,'anonymous leak: '+term);
}

test('M009-A: strict public allowlist removes private pages, spaces, relations and fields',()=>{
 const s=fixture(),before=JSON.stringify(s);
 const v=publicSnapshot(s,'101');
 assert.deepEqual(v.shared.pages.map(p=>p.name),['Accueil','Mentions légales']);
 assert.deepEqual(v.record.pages.map(p=>p.name),['Mercredi']);
 assert.equal(v.record.pages[0].blocks[0].text,'CELEBRATION_PUBLIQUE');
 assert.equal(v.shared.pages[0].blocks[1].columns[0][0].text,'COLONNE_PUBLIQUE');
 assert.equal(v.shared.pages[0].blocks[1].columns[0].length,1);
 assert.equal(v.shared.pages[1].placement,'footer');
 assert.equal(v.plans.length,1);
 assert.deepEqual(Object.keys(v.celebrationVisibility).sort(),
  ['101','plan-michael-2027-01-06']);
 assert.equal(v.updatedAt,s.publishedAt,'private editor save time stays private');
 noSecrets(v);
 assert.equal(JSON.stringify(s),before,'anonymous reads must never mutate stored state');
});

test('M009-A: gallery cannot be elevated by private general=true or hidden content',()=>{
 const s=fixture(),media=publishedMedia(s);
 assert.ok(media.some(x=>x.src==='/media/new/public.jpg'));
 assert.ok(media.some(x=>x.src==='/media/photos/visible.jpg'));
 assert.ok(!media.some(x=>x.src==='/media/new/private.jpg'));
 assert.ok(!media.some(x=>x.src==='/media/private/member.jpg'));
 assert.ok(!media.some(x=>x.src==='/media/new/hidden.jpg'));
 noSecrets(media);
});

test('M009-A: explicitly published English copy survives; private editorial variants do not',()=>{
 const s=fixture();
 s.published.languageRegistry={version:1,defaultLanguageId:'fr',languages:[
  {id:'fr',name:'Français',flag:'🇫🇷',active:true},
  {id:'en',name:'English',flag:'🇬🇧',active:true}]};
 s.published.translationReleases={
  [home.id]:{publication:'published',pageId:home.id,variants:{
   en:{name:'Home',blocks:[{id:1,kind:'text',text:'HELLO_RELEASED',
    members:'SECRET_TRANSLATED_METADATA'}]}}}};
 const projected=projectPublishedLanguage(publicSnapshot(s,'101'),s.published,
  HOST+'/__editor/voir-le-site?celebration=101&lang=en');
 assert.equal(projected.shared.pages[0].name,'Home');
 assert.equal(projected.shared.pages[0].blocks[0].text,'HELLO_RELEASED');
 assert.equal(projected.publicLanguage.selectedLanguageId,'en');
 noSecrets(projected,['SECRET_TRANSLATED_METADATA']);
});

class Bucket{
 constructor(value){this.value=JSON.stringify(value)}
 async get(){return {etag:'1',body:true,text:async()=>this.value}}
}
function mockDB(){
 const stages=['accueil-celebration','preparation','mercredi','jeudi',
  'vendredi','samedi','dimanche','apres-celebration'];
 const records=stages.map((key,i)=>({id:i+1,step_key:key+'-101',
  label:key==='accueil-celebration'?'Accueil de la célébration':
   key==='apres-celebration'?'Après célébration':key[0].toUpperCase()+key.slice(1),
  body_text:key==='mercredi'?'SECRET_HIDDEN_D1_STAGE':'LEGACY_'+key}));
 const data={
  celebrations:[{id:101,archangel:'Michaël',year:'2026',status:'active'},
   {id:202,archangel:'Gabriel',year:'2026',status:'draft',
    adminNote:'SECRET_UNPUBLISHED_CELEBRATION'}],
  steps:records,
  events:[{id:'ev-private',step_key:'mercredi-101',title:'SECRET_HIDDEN_D1_EVENT',
   audience:'all',sort_order:1},
   {id:'ev-public',step_key:'jeudi-101',title:'PUBLIC_JEUDI',audience:'all',sort_order:1}],
  evc:[{id:'resource-private',event_id:'ev-private',name:'SECRET_HIDDEN_D1_MEDIA',
    source_type:'file',storage_path:'media/secret.mp3',content_type:'Audio',audience:'all'},
   {id:'resource-public',event_id:'ev-public',name:'PUBLIC_AUDIO',source_type:'file',
    storage_path:'media/public.mp3',content_type:'Audio',audience:'all'}],
  stc:[],links:[{id:1,step_key:'mercredi-101',url:'https://example.org/SECRET_HIDDEN_D1_LINK',
   label:'SECRET_HIDDEN_D1_LINK'}]
 };
 const queries=[];
 return {queries,prepare(sql){queries.push(sql);return {bind(){return {async all(){
  if(sql.includes('FROM celebrations_celebrations'))return {results:data.celebrations};
  if(sql.includes('FROM celebrations_steps'))return {results:data.steps};
  if(sql.includes('FROM celebrations_events WHERE'))return {results:data.events};
  if(sql.includes('FROM celebrations_event_contents'))return {results:data.evc};
  if(sql.includes('FROM celebrations_step_contents'))return {results:data.stc};
  if(sql.includes('FROM celebrations_links'))return {results:data.links};
  if(sql.includes("FROM celebrations_contents WHERE audience='all'"))return {results:[]};
  if(sql.includes('SELECT e.celebration_id')||sql.includes('SELECT sc.celebration_id'))return {results:[]};
  throw new Error('unexpected SQL '+sql);
 }}}}}}};
}

test('M009-A: public seven-stage projection hides private D1 stages and celebration listings',async()=>{
 const s=fixture();
 // No released Mercredi version: editor deliberately hid its original stage.
 s.drafts['101'].pages=[{id:'mercredi-101',visibility:'hidden',blocks:[]}];
 s.published.drafts['101'].pages=[];
 const db=mockDB(),env={DB:db,EDITOR_BUCKET:new Bucket(s)};
 const {seed}=await loadSevenStageContent(env,'101',{publicOnly:true,publishedState:s});
 const str=JSON.stringify(seed);
 assert.equal(seed.celebrations.length,1);
 assert.equal(seed.celebrations[0].id,101);
 assert.equal(seed.pages.some(p=>p.id==='mercredi-101'),false);
 assert.equal(seed.pages.some(p=>p.id==='jeudi-101'),true);
 assert.ok(str.includes('PUBLIC_JEUDI'));
 assert.ok(str.includes('PUBLIC_AUDIO'));
 assert.ok(!str.includes('SECRET_HIDDEN_D1'));
 assert.ok(!str.includes('SECRET_UNPUBLISHED_CELEBRATION'));
 const res=await handleTrialSite(new Request(HOST+'/__editor/voir-le-site?celebration=101'),env);
 assert.equal(res.status,200);
 const html=await res.text();
 assert.ok(html.includes('PUBLIC_JEUDI'));
 noSecrets(html,['SECRET_HIDDEN_D1','SECRET_UNPUBLISHED_CELEBRATION']);
 const match=html.match(/window\.__TRIAL_SITE_SEED__=([\s\S]*?);<\/script>/);
 assert.ok(match);
 assert.equal(JSON.parse(match[1]).pages.some(p=>p.id==='mercredi-101'),false);
 const scripts=[...html.matchAll(/<script nonce="[0-9a-f]+">([\s\S]*?)<\/script>/g)];
 for(const item of scripts)assert.doesNotThrow(()=>new Script(item[1]));
 assert.ok(db.queries.every(q=>q.startsWith('SELECT ')));
});

test('M009-A: anonymous planned draft and hidden historical celebration return 404',async()=>{
 const s=fixture(),env={DB:mockDB(),EDITOR_BUCKET:new Bucket(s)};
 assert.equal((await handleTrialSite(new Request(HOST+
  '/__editor/voir-le-site?celebration=plan-gabriel-2026-11-04'),env)).status,404);
 assert.equal((await handleTrialSite(new Request(HOST+
  '/__editor/voir-le-site?celebration=202'),env)).status,404);
});

test('M009-A HTTP: GET public response is sanitized; POST remains protected',async()=>{
 const s=fixture(),env={EDITOR_BUCKET:new Bucket(s),DB:mockDB()};
 const r=await handleEditorPublication(new Request(HOST+
  '/api/editor-publication?celebration=101&lang=fr'),env);
 assert.equal(r.status,200);
 const payload=await r.json();
 assert.equal(payload.shared.pages[0].name,'Accueil');
 assert.equal(payload.record.pages[0].name,'Mercredi');
 noSecrets(payload);
 const post=await handleEditorPublication(new Request(HOST+'/api/editor-publication',
  {method:'POST',headers:{origin:HOST,'content-type':'application/json'},
   body:JSON.stringify({kind:'page',celebration:'101',pageId:'mercredi-101',
    visibility:'published',expectedRevision:9})}),env);
 assert.equal(post.status,401);
});

test('M009-A: public French page render preserves default menu and mobile stylesheet',async()=>{
 const env={DB:mockDB()};
 const r=await handleTrialSite(new Request(HOST+'/__editor/voir-le-site?celebration=101'),env);
 assert.equal(r.status,200);
 const html=await r.text();
 assert.match(html,/id="menu-toggle"/);
 assert.match(html,/public-language-selector/);
 assert.match(html,/@media\(max-width:600px\)/);
 assert.match(html,/LEGACY_preparation/);
 assert.match(html,/LEGACY_mercredi/);
});
