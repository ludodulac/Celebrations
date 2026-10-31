import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base='https://celebrations-exit-staging.rondes.workers.dev';
const browser=await chromium.launch();
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1366,height:768},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage();
  const response=await page.goto(base+'/__editor/demo');
  assert.equal(response.status(),200);
  await page.locator('.ed').first().fill('Essai visuel');
  await page.locator('#save-btn').click();
  await page.reload();
  await page.getByText('Essai visuel').waitFor();
  await page.locator('[data-tab="celebrations"]').click();
  await page.getByText('Programme de démonstration').waitFor();
  // Import a PDF and sound file into the browser-local library and attach the PDF to a button.
  await page.locator('[data-tab="media"]').click();
  await page.locator('#asset-file-picker').setInputFiles([
   {name:'exemple.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\\n1 0 obj\\n<<>>\\nendobj\\n%%EOF')},
   {name:'son-test.mp3',mimeType:'audio/mpeg',buffer:Buffer.from([73,68,51,3,0,0,0,0,0,0])}
  ]);
  await page.locator('[data-file-id]').first().waitFor();
  assert.equal(await page.locator('[data-file-id]').count(),2);
  await page.locator('[data-tab="pages"]').click();
  // Choose the BUTTON block, not the earlier IMAGE block (which filters PDFs).
  await page.locator('.block').filter({has:page.locator('.link-block')}).locator('[data-action="choose-asset"]').click();
  await page.locator('[data-file-id]').filter({hasText:'exemple.pdf'}).locator('[data-action="use-asset"]').click();
  await page.locator('#save-btn').click();
  await page.reload();
  await page.locator('[data-tab="media"]').click();
  await page.getByText('exemple.pdf').waitFor();
  await page.locator('[data-tab="pages"]').click();
  await page.locator('#preview-btn').click();
  assert.ok(await page.locator('a.link-block[href^="blob:"]').count()>0);
  await page.locator('#preview-btn').click();
  await page.locator('[data-tab="media"]').click();
  await page.getByText('son-test.mp3').waitFor();
  console.log('VISUAL_FILES_AND_LINKS_PASS mobile='+mobile+' pdf=true audio=true local_only=true');
    console.log('VISUAL_DEMO_PASS mobile='+mobile);
  // Real public Preparation, imported read-only from the 47-page staging archive.
  const actual=await page.goto(base+'/__editor/demo-preparation');
  assert.equal(actual.status(),200,'public Preparation page must render');
  await page.locator('#workspace .ed').first().waitFor();
  await page.locator('#workspace .ed').first().fill('Test de modification locale');
  await page.locator('#save-btn').click();
  await page.reload();
  await page.getByText('Test de modification locale').waitFor();
    assert.equal(await page.locator('#celebration-choice option').count()>0,true);
  await page.locator('[data-tab="media"]').click();
  await page.getByText('exemple.pdf').waitFor(); // same device library, both demo routes
  await page.locator('[data-tab="pages"]').click();
  console.log('VISUAL_PREPARATION_PASS mobile='+mobile+' public_only=true local_save=true');
  await context.close();
 }
}finally{await browser.close();}
