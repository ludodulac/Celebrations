import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {createPageModel} from '../migration/cloudflare/app/domain/editor-pages.mjs';
import {createMediaCatalogue} from '../migration/cloudflare/app/domain/editor-media-catalogue.mjs';
import {createEditorMediaCommands} from '../migration/cloudflare/app/application/editor-media-commands.mjs';
import {DEMO_CSS} from '../migration/cloudflare/editor-demo-style.mjs';
import {handleServerDraft} from '../migration/cloudflare/editor-server-draft-api.mjs';

const extract=(begin,end)=>{
 const a=DEMO_CLIENT.indexOf(begin),b=DEMO_CLIENT.indexOf(end,a+begin.length);
 assert.ok(a>=0&&b>a,'Missing '+begin);
 return DEMO_CLIENT.slice(a,b);
};
function n(tag,cls='',label=''){
 const el={tag,className:cls,textContent:label,children:[],attrs:{},dataset:{},open:false,value:'',
  append(...xs){this.children.push(...xs)},replaceChildren(...xs){this.children=xs},
  setAttribute(k,v){this.attrs[k]=v},close(){this.open=false;this.onclose?.()},
  showModal(){this.open=true},remove(){this.removed=true}};
 return el;
}
const b=(label,fn,cls='')=>{
 const el=n('button',cls,label);el.onclick=fn;return el;
};
const flat=x=>[x,...(x.children||[]).flatMap(flat)];
const sampleMedia=[
 {name:'Une prière.pdf',src:'/media/priere.pdf',type:'pdf'},
 {name:'Un chant.mp3',src:'/media/chant.mp3',type:'audio'},
 {name:'Une vidéo.mp4',src:'/media/video.mp4',type:'video'},
 {name:'Une photo.jpg',src:'/media/photo.jpg',type:'image'},
 {name:'Ancien texte.docx',src:'/media/texte.docx',category:'autres'}
];

test('the global file picker is modal and selects every kind without navigating away',()=>{
 const elements=[],body={append:node=>elements.push(node)};
 const env={
  n,b,FILE_CATEGORIES:[['images','Images'],['pdf','PDF'],['audios','Audios'],['videos','Vidéos'],['autres','Autres']],
  globalFiles:[sampleMedia.at(-1)],publicFiles:()=>[],
  globalMedia:sampleMedia.slice(0,4),
  mediaCategoryOf:r=>({pdf:'pdf',audio:'audios',video:'videos',image:'images'})[r.type]||'autres',
  mediaCatalogue:createMediaCatalogue({validHref:src=>src.startsWith('/')||src.startsWith('https://')}),
  editorMediaCommands:createEditorMediaCommands(),
  validHref:s=>s.startsWith('/')||s.startsWith('https://'),
  document:{body},IS_STAGE:true,globalMediaLoaded:true,render:()=>env.renders++,
  mark:()=>env.marks++,renders:0,marks:0
 };
 const args=Object.keys(env),vals=Object.values(env);
 const f=new Function(...args,extract('function chooseFile(x){','\nfunction attachFile(r){')+';return chooseFile;')(...vals);
 for(const row of sampleMedia){
  const item={kind:'button',text:'Mon bouton',href:'',cover:'https://obsolete.test/a.jpg'};
  f(item);
  const dlg=elements.at(-1);
  assert.equal(dlg.open,true,'Modal must open without changing editor');
  const cards=flat(dlg).filter(x=>x.tag==='button'&&x.attrs['aria-label']==='Choisir '+row.name);
  assert.equal(cards.length,1,'File must be selectable: '+row.name);
  cards[0].onclick();
  assert.equal(item.href,row.src);
  assert.equal(item.text,'Ouvrir : '+row.name);
  assert.equal(item.displayAsButton,true);
  assert.equal(item.cover,undefined,'No stale thumbnail on a standard button');
  assert.equal(dlg.open,false);
 }
 assert.equal(env.marks,5);
 assert.equal(env.renders,5);
 assert.doesNotMatch(extract('function chooseFile(x){','\nfunction attachFile(r){'),/tab='media'|location\.assign/,
  'The picker must never switch page or navigate to media administration');
});

test('video heading is rendered as a plain bold caption, updated while editing',()=>{
 const segment=extract("if(x.kind==='video'){","\nif(x.kind==='divider'){");
 let box=n('div','block'),x={kind:'video',text:'Titre initial',href:'https://youtu.be/AAAAAAAAAAA'};
 const env={
  x,box,preview:false,n,b,validHref:v=>v.startsWith('https://'),
  videoInfo:()=>({thumbnail:'/thumb.jpg'}),
  assetUrls:new Map(),websiteThumb:(h,t)=>n('div','site-thumbnail',t),
  showImagePicker:()=>{},mark:()=>{env.changed++},changed:0
 };
 new Function(...Object.keys(env),segment)(...Object.values(env));
 const caption=flat(box).find(el=>el.className==='editor-video-title');
 const title=flat(box).find(el=>el.attrs['aria-label']==='Titre de la vidéo');
 assert.ok(caption,'Video has its own caption');
 assert.ok(title,'The caption remains editable');
 assert.equal(caption.textContent,'Titre initial');
 title.value='Nouveau titre';title.oninput();
 assert.equal(caption.textContent,'Nouveau titre');
 assert.equal(x.text,'Nouveau titre');
 assert.equal(env.changed,1);
 assert.match(DEMO_CSS,/\.editor-video-title\{display:block/);
 const oldVideo=x;box=n('div','block');
 // The public-facing draft preview must also show the caption.
 new Function(...Object.keys({...env,preview:true,box}),segment)(...Object.values({...env,preview:true,box}));
 assert.equal(flat(box).find(el=>el.className==='editor-video-title').textContent,oldVideo.text);
});

test('creating a test page calls server save, starts as a draft and never publishes automatically',()=>{
 const source=extract('function createPage(group){','\n\n\n/* Colourways');
 const db={pages:[{id:'preparation-101',group:'celebration',name:'Préparation',blocks:[]}]};
 let saved=0,published=0,renders=0;
 let id='',tab='',marked=0;
 const create=new Function('prompt','db','crypto','window','dirty','save','uniqueBlockId','mark','render','IS_STAGE','serverSave','id','selectedBlockId','tab','editorPageModel',
  source+';return createPage;')(
  ()=> 'Ma page de test',db,{randomUUID:()=> '123e4567-e89b-12d3-a456-426614174000'},
  {__PREPARATION_SEED__:{celebrationId:'101'}},false,()=>{saved++},
  ()=>999,()=>{marked++},()=>{renders++},true,()=>{published++;return Promise.resolve(true)},'',null,'celebrations',createPageModel()
 );
 create('celebration');
 const fresh=db.pages.at(-1);
 assert.equal(fresh.name,'Ma page de test');
 assert.equal(fresh.group,'celebration');
 assert.equal(fresh.visibility,'draft');
 assert.equal(saved,1);
 assert.equal(published,1,'A shared server write must start on page creation');
 assert.equal(marked,1);
 assert.equal(renders,1);
 assert.ok(fresh.id.startsWith('extra-'));
 assert.match(DEMO_CLIENT,/Publier cette page/,'Draft page has an explicit publishing control');
});

test('server accepts and rereads an independent new page without changing existing content',async()=>{
 let blob=null,revision=0;
 const bucket={
  async get(){return blob?{etag:String(revision),body:true,text:async()=>blob}:null},
  async put(key,text,{onlyIf}={}){
   if(!blob&&onlyIf?.etagDoesNotMatch!=='*')return null;
   if(blob&&onlyIf?.etagMatches!==String(revision))return null;
   blob=text;revision++;return {etag:String(revision)};
  }
 };
 const env={MEDIA_BUCKET:bucket,DB:{prepare:()=>({bind:()=>({
  first:async()=>({email:'test@localhost',expires_at:'2099-01-01T00:00:00.000Z'})})})}};
 const base='https://celebrations-exit-staging.rondes.workers.dev/api/editor-open-draft';
 const page={id:'extra-123e4567-e89b-12d3-a456-426614174000-101',group:'celebration',
  visibility:'draft',name:'Ma page de test',blocks:[{id:1,kind:'heading',text:'Titre'}]};
 const payload={celebration:'101',expectedRevision:0,record:{
  pages:[{id:'preparation-101',group:'celebration',visibility:'published',name:'Préparation',
   blocks:[{id:2,kind:'heading',text:'Original'}]},page],
  celebrationDates:{},celebrationTimes:{},siteHomeId:''},plans:[],
  shared:{pages:[],homeId:''}};
 const res=await handleServerDraft(new Request(base,{method:'POST',
  headers:{origin:'https://celebrations-exit-staging.rondes.workers.dev',
   'content-type':'application/json'},body:JSON.stringify(payload)}),env);
 assert.equal(res.status,200);
 const read=await handleServerDraft(new Request(base+'?celebration=101'),env);
 const result=await read.json();
 assert.ok(result.record.pages.some(p=>p.id===page.id));
 assert.deepEqual(result.record.pages[0].blocks,payload.record.pages[0].blocks);
 assert.equal(result.record.pages[1].visibility,'draft','Saving is not publishing');
});
