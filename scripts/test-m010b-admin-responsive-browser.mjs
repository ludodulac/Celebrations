// M010-B — real Chromium at desktop + narrow smartphone widths; fake local API.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';

const root=process.cwd();
const mime={'.mjs':'text/javascript','.js':'text/javascript','.html':'text/html'};
const html='<!doctype html><html lang="fr"><head>'+
  '<meta name="viewport" content="width=device-width,initial-scale=1">'+
  '</head><body><main id="admin"></main>'+
  '<script type="module" src="/scripts/fixtures/m009b-admin-fixture.mjs"></script>'+
  '</body></html>';
const server=createServer(async(req,res)=>{
  if(req.url==='/') {res.setHeader('content-type','text/html');res.end(html);return;}
  const path=resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
  if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}
  try {
    const data=await readFile(path);
    res.setHeader('content-type',mime[extname(path)]||'text/plain');
    res.end(data);
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({headless:true});
  for(const width of [1440,390,320]){
    const page=await browser.newPage({viewport:{width,height:844},
      isMobile:width<500,hasTouch:width<500});
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.getByText('Annuaire D1 chargé.').waitFor();
    assert.equal(await page.getByRole('heading',{
      name:'Types de membres et autorisations'}).count(),1,
      'must reuse the existing 007-B UI');
    await page.getByText('Page 1 · 50 personnes affichées').waitFor();
    await page.getByRole('button',{name:'Page suivante'}).click();
    await page.getByText('Page 2 · 50 personnes affichées').waitFor();
    await page.getByRole('button',{name:'Page précédente'}).click();
    await page.getByText('Page 1 · 50 personnes affichées').waitFor();
    await page.getByRole('searchbox',{name:'Rechercher une personne'}).fill('Extrême');
    await page.getByRole('button',{name:'Rechercher'}).click();
    await page.getByText('Page 1 · 1 personnes affichées').waitFor();
    await page.getByRole('searchbox',{name:'Rechercher une personne'}).fill('');
    await page.getByRole('button',{name:'Rechercher'}).click();
    await page.getByText('Page 1 · 50 personnes affichées').waitFor();
    const overflow=await page.evaluate(()=>
      document.documentElement.scrollWidth-document.documentElement.clientWidth);
    assert.ok(overflow<=1,'horizontal overflow '+width+'px: '+overflow);
    await page.getByRole('button',{name:'Suspendre : Chorale'}).click();
    await page.getByRole('button',{name:'Réactiver : Chorale'}).waitFor();
    const email=page.getByPlaceholder('prenom@exemple.fr');
    await email.fill('nouveau'+width+'@example.org');
    await page.getByRole('button',{name:'Créer la personne'}).click();
    await page.getByText('Page 1 · 1 personnes affichées').waitFor();
    await page.getByText('Personne créée avec un identifiant permanent.').waitFor();
    assert.deepEqual(errors,[],'browser errors '+width);
    await page.close();
  }
  console.log('M010B_CHROMIUM_DESKTOP_MOBILE_1440_390_320_PASS');
}finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
