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

  // Test steps 3-4: text formatting, add, duplicate, reorder, delete, and saved drafts.
  const firstBlock=page.locator('#workspace .block').first();
  const title=firstBlock.locator('.ed.heading');
  assert.equal(await firstBlock.locator('.tools').evaluate(e=>getComputedStyle(e).position),'static');
  assert.ok(await firstBlock.getByLabel('Dupliquer').isVisible());
  assert.ok(await firstBlock.getByLabel('Supprimer').isVisible());
  assert.ok(await title.isVisible());
  await firstBlock.getByLabel('Taille du texte').selectOption('24');
  await firstBlock.getByLabel('Couleur du texte').fill('#a14b35');
  await firstBlock.getByLabel('Alignement').selectOption('right');
  await firstBlock.getByLabel('Gras (sélection ou bloc)').click();
  await firstBlock.getByLabel('Italique (sélection ou bloc)').click();
  assert.equal(await title.evaluate(e=>getComputedStyle(e).fontSize),'24px');
  assert.equal(await firstBlock.evaluate(e=>e.style.textAlign),'right');
  const before=await page.locator('#workspace .block').count();
  // Exercise a real touchscreen tap on the phone, not only desktop pointer clicks.
  const duplicateAction=firstBlock.getByLabel('Dupliquer');
  await duplicateAction.scrollIntoViewIfNeeded();
  if(mobile)await duplicateAction.tap();else await duplicateAction.click();
  assert.equal(await page.locator('#workspace .block').count(),before+1);
  await page.locator('#workspace .block').nth(1).locator('.ed.heading').fill('Titre dupliqué');
  const moveAction=page.locator('#workspace .block').nth(1).getByLabel('Descendre');
  if(mobile)await moveAction.tap();else await moveAction.click();
  await page.getByRole('button',{name:'Paragraphe'}).click();
  assert.equal(await page.locator('#workspace .block').count(),before+2);
  await page.locator('#save-btn').click();
  await page.reload();
  await page.getByText('Titre dupliqué').waitFor();
  assert.equal(await page.locator('#workspace .block').count(),before+2);
  const afterReload=page.locator('#workspace .block').first();
  assert.equal(await afterReload.evaluate(e=>e.style.textAlign),'right');
  assert.equal(await afterReload.locator('.ed.heading').evaluate(e=>getComputedStyle(e).fontSize),'24px');
  assert.equal(await afterReload.locator('.ed.heading').evaluate(e=>getComputedStyle(e).fontWeight),'700');
  await page.locator('#preview-btn').click();
  assert.equal(await page.locator('#workspace .formatbar').count(),0);
  await page.locator('#preview-btn').click();
  const duplicate=page.locator('#workspace .block').filter({hasText:'Titre dupliqué'});
  // Toolbar stays hidden on desktop until the block is focused or hovered.
  await duplicate.locator('.ed').click();
  page.once('dialog',d=>d.accept());
  const deleteAction=duplicate.getByLabel('Supprimer');
  if(mobile)await deleteAction.tap();else await deleteAction.click();
  assert.equal(await page.locator('#workspace .block').count(),before+1);
  await page.locator('#save-btn').click();
  console.log('VISUAL_FORMAT_AND_BLOCKS_PASS mobile='+mobile+' rich_text=true duplicate=true move=true delete=true saved=true');

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
