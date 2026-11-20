import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../migration/cloudflare/editor-demo-client-source.js',import.meta.url),'utf8');
const from=source.indexOf('let rememberedSelection=null;');
const to=source.indexOf('// Bounded local editor history.',from);
assert.ok(from>0&&to>from);
const section=source.slice(from,to);
const browser=await chromium.launch({headless:true});
try{
 for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:820},hasTouch:width===390,isMobile:width===390});
  await page.setContent('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="box"><div id="editor" class="ed" contenteditable="true">Bonjour monde et amis</div></div></body></html>');
  await page.evaluate(section=>{
   const n=(tag,cls='',label='')=>{const e=document.createElement(tag);e.className=cls;e.textContent=label;return e};
   const b=(label,fn,cls='')=>{const e=n('button',cls,label);e.type='button';e.onclick=fn;return e};
   const BLOCK_SIZES=[14,16,18,20,24,28,32,40];
   const ALIGNMENTS=['left','center','right'];
   const sizeOf=()=>16,validColor=()=>true,htmlSafe=x=>x;
   const x={kind:'text',rich:'',text:''},z=document.querySelector('#editor'),box=document.querySelector('#box');
   const mark=()=>{};
   const saveRich=()=>{x.rich=z.innerHTML;x.text=z.innerText};
   new Function('n','b','BLOCK_SIZES','ALIGNMENTS','sizeOf','validColor','htmlSafe','mark','saveRich','x','z','box',
    section+';window.__toolbar=editorFormatToolbar(x,z,box);window.__record=x;')(
    n,b,BLOCK_SIZES,ALIGNMENTS,sizeOf,validColor,htmlSafe,mark,saveRich,x,z,box);
   window.__select=(start,end)=>{
    const text=z.firstChild;const range=document.createRange();range.setStart(text,start);range.setEnd(text,end);
    const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);
    z.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
   };
  },section);
  await page.evaluate(()=>window.__select(0,7));
  await page.waitForTimeout(100);
  const bold=page.getByRole('button',{name:/Gras/});
  await bold.click();
  const first=await page.locator('#editor').innerHTML();
  assert.match(first,new RegExp('<(?:b|strong)>Bonjour</(?:b|strong)>','i'));
  assert.match(first,/monde et amis/);
  await page.evaluate(()=>{const z=document.querySelector('#editor');const t=z.querySelector('b,strong').firstChild;const r=document.createRange();r.selectNodeContents(t);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);z.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}))});
  await page.waitForTimeout(100);
  await bold.click();
  const second=await page.locator('#editor').innerHTML();
  assert.doesNotMatch(second,new RegExp('<(?:b|strong)>Bonjour</(?:b|strong)>','i'),'Second bold click should toggle off');
  assert.match(second,/monde et amis/);
  console.log('FORMAT_BROWSER_PASS '+JSON.stringify({width,first,second}));
  await page.close();
 }
}finally{await browser.close()}
