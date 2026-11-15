// M040 — read-only verification on the official visitor-facing website.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const SITE='https://ronde-des-archanges-universelle.eu';
const browser=await chromium.launch({headless:true});
try{
 for(const profile of [
  {name:'desktop',viewport:{width:1366,height:810},isMobile:false,hasTouch:false},
  {name:'android',viewport:{width:390,height:844},isMobile:true,hasTouch:true}
 ]){
  const context=await browser.newContext({...profile,serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.goto(SITE+'/?celebration=101&page=celebrations',{waitUntil:'domcontentloaded',timeout:35000});
  // The public script hydrates asynchronously after DOMContentLoaded.
  await page.locator('#general-navigation .general-tab').first().waitFor({state:'attached',timeout:20000});
  await page.locator('#menu-toggle').click({timeout:10000});
  const items=await page.locator('#general-navigation .general-tab').allInnerTexts();
  assert.ok(items.length>0,'Existing visitor menu must remain');
  assert.ok(!items.some(s=>/m[eé]diath[eè]que/i.test(s)),'The main visitor menu must not offer ANY global media gallery: '+JSON.stringify(items));
  await page.goto(SITE+'/?celebration=101&page=mediatheque',{waitUntil:'domcontentloaded',timeout:35000});
  const shortcut=page.locator('#celebration-shortcuts .celebration-shortcut').filter({hasText:/m[eé]diath[eè]que/i});
  await shortcut.waitFor({state:'visible',timeout:12000});
  const tabs=page.locator('.media-tab');
  await tabs.first().waitFor({timeout:12000});
  await tabs.filter({hasText:/audio/i}).first().click();
  const audios=await page.locator('#stage-main .media-card audio.media-player').count();
  assert.equal(audios,38,'Michaël 2026 audio gallery must keep all 38 MP3');
  await page.goto(SITE+'/?celebration=101&page=mediatheque-generale',{waitUntil:'domcontentloaded',timeout:35000});
  // The previous route must resolve to the Célébrations list after async hydration.
  await page.locator('#stage-main .celebration-choices').waitFor({state:'visible',timeout:20000});
  assert.equal(await page.locator('#stage-main .media-tabs').count(),0,'Deprecated global media page must not render gallery');
  assert.deepEqual(errors,[],'Visitor JS errors');
  await context.close();
  console.log('M040_PUBLIC_MENU_PASS '+profile.name+' media shortcut intact, '+audios+' MP3, no general library');
 }
}finally{await browser.close()}
