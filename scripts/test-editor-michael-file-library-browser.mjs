import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const origin='https://celebrations-exit-staging.rondes.workers.dev';
const browser=await chromium.launch();
try{
 for(const width of [390,1280]){
  const ctx=await browser.newContext({viewport:{width,height:850},isMobile:width===390,hasTouch:width===390});
  const page=await ctx.newPage();page.setDefaultTimeout(20000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/__editor/demo-preparation?celebration=101',{waitUntil:'domcontentloaded',timeout:30000});
  const catalogue=await page.evaluate(()=>window.__PREPARATION_SEED__?.files||[]);
  const counts=Object.fromEntries(['images','pdf','audios','autres'].map(k=>[k,catalogue.filter(f=>f.category===k).length]));
  console.log('MICHAEL_PUBLIC_FILE_LIBRARY '+JSON.stringify(counts));
  assert.ok(counts.images>0,'No public Michaël image from the historical celebration');
  assert.ok(counts.pdf>0,'No public Michaël PDF');
  assert.ok(counts.audios>0,'No public Michaël audio');
  assert.ok(counts.autres>0,'No public Michaël text/document');
  assert.ok(catalogue.every(f=>f.pages.length&&(!f.src||f.src.startsWith('/media/'))));
  assert.ok(catalogue.every(f=>!f.src?.includes('committee/')));
  // Real images, PDFs, MP3 and textual resources are independent categories.
  await page.locator('[data-tab="media"]').click();
  assert.equal(await page.locator('.file-category-tabs [data-file-category]').count(),4);
  for(const key of ['images','pdf','audios','autres']){
   await page.locator('.file-category-tabs [data-file-category="'+key+'"]').click();
   assert.equal(await page.locator('.historic-file').count(),counts[key],key);
  }
  // Reuse a real image in the page, not by copying the R2 object.
  await page.locator('.file-category-tabs [data-file-category="images"]').click();
  const image=page.locator('.historic-file').first();
  const firstImage=await image.locator('.library-thumb').getAttribute('src');
  await image.locator('[data-action="insert-historical-file"]').click();
  assert.equal(await page.locator('.picture img[src="'+firstImage+'"]').count(),1);
  await page.locator('#save-btn').click();
  await page.locator('[data-tab="media"]').click();
  await page.locator('.file-category-tabs [data-file-category="pdf"]').click();
  const pdf=page.locator('.historic-file').first(),pdfLink=await pdf.locator('a').getAttribute('href');
  assert.ok(pdfLink.endsWith('.pdf'));
  await pdf.locator('[data-action="insert-historical-file"]').click();
  assert.ok((await page.locator('.link-input').last().inputValue())===pdfLink);
  await page.locator('#save-btn').click();
  await page.locator('[data-tab="media"]').click();
  await page.locator('.file-category-tabs [data-file-category="autres"]').click();
  const textFile=page.locator('.historic-file').filter({has:page.locator('.text-file-preview')}).first();
  await textFile.waitFor();
  await textFile.locator('[data-action="insert-historical-file"]').click();
  assert.ok(await page.locator('.ed.text').count()>0);
  await page.locator('#save-btn').click();
  await page.locator('[data-tab="media"]').click();
  await page.locator('.file-category-tabs [data-file-category="audios"]').click();
  const sound=page.locator('.historic-file').first(),audioLink=await sound.locator('audio').getAttribute('src');
  await sound.locator('[data-action="insert-historical-file"]').click();
  assert.equal(await page.locator('.audio-block audio[src="'+audioLink+'"]').count(),1);
  await page.locator('#save-btn').click();
  const [preview]=await Promise.all([page.waitForEvent('popup'),page.locator('#view-site-btn').click()]);
  assert.ok(await preview.locator('img[src="'+firstImage+'"]').count()>=1);
  assert.ok(await preview.locator('a[href="'+pdfLink+'"]').count()>=1);
  assert.ok(await preview.locator('audio[src="'+audioLink+'"]').count()>=1);
  // The visitor sees the SAME public resources within Michaël only.
  await preview.goto(origin+'/__editor/voir-le-site?celebration=101&page=mediatheque',{waitUntil:'domcontentloaded',timeout:30000});
  await preview.locator('.media-tabs').waitFor();
  assert.equal(await preview.locator('.media-tabs button').count(),4);
  assert.equal((await preview.locator('.celebration-shortcut.current').innerText()).trim(),'Médiathèque');
  assert.ok(await preview.locator('.media-card audio').count()>0,'Audio players must appear in Michaël gallery');
  await preview.getByRole('button',{name:'Vidéo',exact:true}).click();
  assert.ok(await preview.locator('.media-card').count()>0,'Historical public videos must be in gallery');
  await preview.getByRole('button',{name:'Textes & PDF',exact:true}).click();
  assert.ok(await preview.locator('.media-card').count()>0,'Public texts/PDFs must be listed');
  await preview.getByRole('button',{name:'Images',exact:true}).click();
  assert.ok(await preview.locator('.media-card img').count()>0,'Image gallery must show thumbnails');
  await preview.locator('.celebration-shortcut').filter({hasText:'Accueil'}).click();
  const welcome=await page.evaluate(()=>window.__PREPARATION_SEED__?.pages.find(p=>p.id==='accueil-celebration-101')?.blocks.filter(b=>Number(b.id)>100000)||[]);
  assert.ok(welcome.length>0,'Real historical Michaël welcome content must be restored');
  await preview.locator('#menu-toggle').click();
  await preview.getByRole('button',{name:'⌂ Accueil'}).click();
  assert.equal(await preview.locator('#return-celebration').count(),0);
  assert.equal(await preview.locator('#celebration-shortcuts').isVisible(),false,'No celebration shortcut on global home');
  const large=preview.locator('#stage-main img').filter({hasNot:preview.locator('span')}).last();
  await large.waitFor();
  assert.ok((await large.getAttribute('src')).includes('celebrations-staging-welcome-autumn-2026.jpg'),'Original home photo is used, not a new placeholder');
  await large.evaluate(img=>img.decode().catch(()=>null));
  assert.ok(await large.evaluate(img=>img.naturalWidth>0),'Original welcome image must load from staging R2');
  assert.deepEqual(errors,[]);
  console.log('MICHAEL_FILE_LIBRARY_PASS mobile='+(width===390)+' categories=4 inserted=images,pdf,audios,text site_preview=true');
  await preview.close();await ctx.close();
 }
}finally{await browser.close()}
