import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const origin='https://celebrations-exit-staging.rondes.workers.dev';
const browser=await chromium.launch();
try{
 for(const width of [390,1280]){
  const ctx=await browser.newContext({viewport:{width,height:850},isMobile:width===390,hasTouch:width===390});
  const page=await ctx.newPage();page.setDefaultTimeout(20000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/__editor/demo-preparation?celebration=101');
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
   await page.locator('[data-file-category="'+key+'"]').click();
   assert.equal(await page.locator('.historic-file').count(),counts[key],key);
  }
  // Reuse a real image in the page, not by copying the R2 object.
  await page.locator('[data-file-category="images"]').click();
  const image=page.locator('.historic-file').first();
  const firstImage=await image.locator('.library-thumb').getAttribute('src');
  await image.locator('[data-action="insert-historical-file"]').click();
  assert.equal(await page.locator('.picture img[src="'+firstImage+'"]').count(),1);
  await page.locator('#save-btn').click();
  await page.locator('[data-tab="media"]').click();
  await page.locator('[data-file-category="pdf"]').click();
  const pdf=page.locator('.historic-file').first(),pdfLink=await pdf.locator('a').getAttribute('href');
  assert.ok(pdfLink.endsWith('.pdf'));
  await pdf.locator('[data-action="insert-historical-file"]').click();
  assert.ok((await page.locator('.link-input').last().inputValue())===pdfLink);
  await page.locator('#save-btn').click();
  await page.locator('[data-tab="media"]').click();
  await page.locator('[data-file-category="autres"]').click();
  const textFile=page.locator('.historic-file').filter({has:page.locator('.text-file-preview')}).first();
  await textFile.waitFor();
  await textFile.locator('[data-action="insert-historical-file"]').click();
  assert.ok(await page.locator('.ed.text').count()>0);
  await page.locator('#save-btn').click();
  await page.locator('[data-tab="media"]').click();
  await page.locator('[data-file-category="audios"]').click();
  const sound=page.locator('.historic-file').first(),audioLink=await sound.locator('audio').getAttribute('src');
  await sound.locator('[data-action="insert-historical-file"]').click();
  assert.equal(await page.locator('.audio-block audio[src="'+audioLink+'"]').count(),1);
  await page.locator('#save-btn').click();
  const [preview]=await Promise.all([page.waitForEvent('popup'),page.locator('#view-site-btn').click()]);
  assert.ok(await preview.locator('img[src="'+firstImage+'"]').count()>=1);
  assert.ok(await preview.locator('a[href="'+pdfLink+'"]').count()>=1);
  assert.ok(await preview.locator('audio[src="'+audioLink+'"]').count()>=1);
  assert.deepEqual(errors,[]);
  console.log('MICHAEL_FILE_LIBRARY_PASS mobile='+(width===390)+' categories=4 inserted=images,pdf,audios,text site_preview=true');
  await preview.close();await ctx.close();
 }
}finally{await browser.close()}
