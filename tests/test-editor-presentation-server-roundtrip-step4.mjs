import test from 'node:test';
import assert from 'node:assert/strict';
import {handleServerDraft} from '../migration/cloudflare/editor-server-draft-api.mjs';

// Isolated fake storage. This simulates the same API request/response used by
// the editor, without touching real R2, a live celebration, or published pages.
const origin='https://celebrations-exit-staging.rondes.workers.dev';
function storage(){
 let data=null,version=0;
 return {
  async get(){return data===null?null:{etag:String(version),body:true,text:async()=>data}},
  async put(key,text,{onlyIf}={}){
   if(data===null&&onlyIf?.etagDoesNotMatch!=='*')return null;
   if(data!==null&&onlyIf?.etagMatches!==String(version))return null;
   data=text;version++;return {etag:String(version)};
  }
 };
}
const env=()=>({
 DB:{prepare:()=>({bind:()=>({first:async()=>({email:'test@localhost',expires_at:'2099-01-01T00:00:00.000Z'})})})},
 MEDIA_BUCKET:storage()
});
const sample=()=>({
 celebration:'101',expectedRevision:0,
 record:{pages:[{
  id:'preparation-101',group:'celebration',name:'Préparation',visibility:'published',
  blocks:[
   {id:11,kind:'heading',text:'Prière 156'},
   {id:'r156',kind:'section',layout:'columns',presentation:'resource',
    columnAlignments:['center','bottom'],
    columnButtonLayouts:['stack','row'],
    columns:[
     [{id:21,kind:'image',src:'/media/bible-essenienne.jpg',widthPct:45,text:'Bible essénienne'}],
     [{id:22,kind:'heading',text:'Prière 156'},
      {id:23,kind:'button',displayAsButton:true,text:'Voir sur YouTube',href:'https://youtu.be/demo'},
      {id:24,kind:'button',displayAsButton:true,text:'Voir sur Vimeo',href:'https://vimeo.com/demo'},
      {id:25,kind:'button',displayAsButton:true,text:'Ouvrir le document',href:'/media/priere156.pdf'}]
    ]}
  ]}],
  celebrationDates:{},celebrationTimes:{},siteHomeId:''},
 plans:[],shared:{pages:[],homeId:''}
});
const request=(method,body)=>new Request(origin+'/api/editor-open-draft'+(method==='GET'?'?celebration=101':''),
 {method,headers:{origin,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});

test('real server draft API contract stores and reloads all 3 buttons and column options intact',async()=>{
 const e=env(),body=sample();
 const write=await handleServerDraft(request('POST',body),e);
 assert.equal(write.status,200);
 assert.equal((await write.json()).revision,1);
 const read=await handleServerDraft(request('GET'),e);
 assert.equal(read.status,200);
 const record=(await read.json()).record;
 assert.deepEqual(record.pages[0].blocks[1],body.record.pages[0].blocks[1],
  'Neither URL, label, media, layout nor per-column settings is lost by server save/reload');
 assert.equal(record.pages[0].blocks[0].text,'Prière 156');
});
test('new URL for one button remains independent and stale revisions never overwrite it',async()=>{
 const e=env(),body=sample();
 const first=await handleServerDraft(request('POST',body),e);
 assert.equal(first.status,200);
 const newer=sample();newer.expectedRevision=1;
 const buttons=newer.record.pages[0].blocks[1].columns[1];
 buttons[1].text='Voir ailleurs';buttons[1].href='https://videos.example.org/alternate';
 assert.equal((await handleServerDraft(request('POST',newer),e)).status,200);
 const old=await handleServerDraft(request('POST',body),e);
 assert.equal(old.status,409,'Other devices cannot silently clobber a newer draft');
 const reread=await handleServerDraft(request('GET'),e);
 const restored=(await reread.json()).record.pages[0].blocks[1].columns[1].filter(b=>b.kind==='button');
 assert.deepEqual(restored.map(b=>b.href),[
  'https://youtu.be/demo','https://videos.example.org/alternate','/media/priere156.pdf'
 ]);
 assert.deepEqual(restored.map(b=>b.text),['Voir sur YouTube','Voir ailleurs','Ouvrir le document']);
});
