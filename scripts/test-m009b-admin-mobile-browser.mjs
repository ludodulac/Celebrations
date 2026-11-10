// M009-B real Chromium desktop + Android-size viewport, local fixture only.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';

const root=process.cwd();
const mime={'.mjs':'text/javascript','.js':'text/javascript','.html':'text/html'};
const html='<!doctype html><html lang="fr"><head>'+
  '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'+
  '<body><main id="admin"></main>'+
  '<script type="module" src="/scripts/fixtures/m009b-admin-fixture.mjs"></script>'+
  '</body></html>';
const server=createServer(async(req,res)=>{
  if(req.url==='/') {res.setHeader('content-type','text/html');res.end(html);return;}
  const path=resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
  if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}
  try {
    const source=await readFile(path);
    res.setHeader('content-type',mime[extname(path)]||'text/plain');
    res.end(source);
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
let browser;
try {
  browser=await chromium.launch({headless:true});
  for(const width of [1440,390]) {
    const page=await browser.newPage({viewport:{width,height:844},
      isMobile:width===390,hasTouch:width===390});
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.goto('http://127.0.0.1:'+port+'/');
    await page.getByText('Annuaire D1 chargé.').waitFor();
    assert.equal(await page.getByRole('heading',{
      name:'Types de membres et autorisations'}).count(),1);
    assert.equal(await page.getByText('Participations et espaces privés').count(),1);
    assert.equal(await page.getByText('Suspension des types').count(),1);
    await page.getByText('Célébrations : 41').waitFor();
    const overflow=await page.evaluate(()=>
      document.documentElement.scrollWidth-document.documentElement.clientWidth);
    assert.ok(overflow<=1,'horizontal overflow at '+width+'px: '+overflow);
    await page.getByRole('button',{name:/Suspendre : Chorale/}).click();
    await page.getByRole('button',{name:/Réactiver : Chorale/}).waitFor();
    assert.deepEqual(errors,[],'browser exceptions at width '+width);
    await page.close();
  }
  console.log('M009B_ADMIN_UI_CHROMIUM_DESKTOP_MOBILE_PASS');
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
