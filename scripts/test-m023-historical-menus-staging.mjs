// M023 read-only browser regression: inject representative historical pages
// into the isolated M016 browser's GET response. Never write server data.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const HOST='https://celebrations-m016-admin-preprod.rondes.workers.dev';
const CID='90000002';
assert.equal(process.env.M022_M016_ONLY,'YES');
assert.ok((process.env.M017_ADMIN_PASSWORD||'').length>=16);
const originalPages=[
 {id:'preparation-'+CID,name:'Préparation',group:'celebration',visibility:'published',
  blocks:[{id:501,kind:'heading',text:'Préparation',align:'center'}]},
 {id:'mercredi-'+CID,name:'Mercredi',group:'celebration',visibility:'published',
  blocks:[{id:502,kind:'heading',text:'Mercredi',align:'center'}]},
 {id:'jeudi-'+CID,name:'Jeudi',group:'celebration',visibility:'published',
  blocks:[{id:503,kind:'heading',text:'Jeudi',align:'center'}]},
 {id:'extra-550e8400-e29b-41d4-a716-446655440000-'+CID,name:'Page supplémentaire',group:'celebration',visibility:'draft',
  blocks:[{id:504,kind:'heading',text:'Brouillon ajouté',align:'center'}]}
];
const browser=await chromium.launch({headless:true});
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let saves=0;
  await page.route(/\/api\/(editor-open-draft|editor-publication|admin\/private-editor)/,async route=>{
   const url=new URL(route.request().url());
   if(route.request().method()!=='GET'){saves++;await route.abort();return;}
   if(url.pathname==='/api/editor-open-draft'&&url.searchParams.get('celebration')===CID){
    const response=await route.fetch();
    const payload=await response.json();
    assert.equal(response.status(),200);
    assert.ok(payload.record&&Array.isArray(payload.record.pages));
    payload.record.pages=structuredClone(originalPages);
    await route.fulfill({response,contentType:'application/json; charset=utf-8',body:JSON.stringify(payload)});
    return;
   }
   await route.continue();
  });
  await page.goto(HOST+'/admin',{waitUntil:'domcontentloaded'});
  await page.locator('input[name="code"]').fill(process.env.M017_ADMIN_PASSWORD);
  await Promise.all([page.waitForURL(u=>u.pathname==='/admin.html',{timeout:30000}),
    page.locator('button[type="submit"]').click()]);
  await page.goto(HOST+'/__editor/demo-preparation?celebration='+CID,{waitUntil:'domcontentloaded'});
  await page.locator('[data-tab="celebrations"]').click();
  await page.locator('.general-page-row').first().waitFor({timeout:15000});
  const total=await page.locator('.general-page-row').count();
  const ids=await page.locator('.general-page-row button.item').evaluateAll(xs=>xs.map(x=>x.dataset.pageId));
  console.log('M023_HISTORICAL_PAGE_DOM_READONLY '+JSON.stringify({width,total,ids}));
  assert.ok(total>=4,'Historical pages and custom page rows appear');
  assert.equal(await page.locator('.general-page-row .page-options>summary').count(),total,
   'Every row must have actions, even legacy ones');
  for(const p of originalPages)assert.ok(ids.includes(p.id),'Representative page must be clickable: '+p.id);
  let row=page.locator('.general-page-row').filter({has:page.locator('button.item[data-page-id="preparation-'+CID+'"]')});
  assert.equal(await row.locator('button.item').isEnabled(),true,'Historical page title remains enabled');
  await row.locator('summary').click();
  await row.getByRole('button',{name:'Modifier cette page'}).waitFor();
  await row.getByRole('combobox',{name:'Visibilité de la page'}).waitFor();
  assert.equal(await row.getByRole('button',{name:'Supprimer la page'}).count(),0,
   'Historical stage is not physically deleted');
  assert.match(await row.locator('.page-options-protected').innerText(),/Masqué/);
  await row.getByRole('button',{name:'Modifier cette page'}).click();
  assert.ok((await page.locator('.item.active').first().innerText()).includes('Préparation'));
  const mercredi=page.locator('button.item[data-page-id="mercredi-'+CID+'"]');
  await mercredi.click();
  assert.ok((await page.locator('.item.active').first().innerText()).includes('Mercredi'),
   'Directly clicking another stage navigates');
  row=page.locator('.general-page-row').filter({has:page.locator('button.item[data-page-id="extra-550e8400-e29b-41d4-a716-446655440000-'+CID+'"]')});
  await row.locator('summary').click();
  await row.getByRole('button',{name:'Supprimer la page'}).waitFor();
  // Intentionally never activate delete or visibility choice: no server writes.
  assert.equal(saves,0);
  assert.deepEqual(errors,[],'No unexpected client errors');
  console.log('M023_HISTORICAL_PAGE_MENU_AND_NAVIGATION_PASS viewport='+width+' non_mutating=true rows=4');
  await context.close();
 }
}finally{await browser.close();}
