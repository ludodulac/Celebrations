// M021-C: official-only non-mutating Chromium fallback when the PREPROD PIN
// secret is different from the official historical PIN. Never guess/submit a PIN.
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
import {chromium} from 'playwright';
const ORIGIN='https://ronde-des-archanges-universelle.eu';
const baseline=JSON.parse(readFileSync('/tmp/m022-official-baseline.json','utf8'));
const cid=String(baseline.counts.first_celebration_id);
assert.match(cid,/^\d+$/);
mkdirSync('docs/m022-official-smartphone',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Cloudflare global propagation can serve the previous Worker briefly after
 // 100% promotion. Never mistake an old edge response for a release regression.
 let r,modeMarker=null;
 for(let attempt=0;attempt<30;attempt++){
  const probe='/?m022_version_probe='+Date.now()+'-'+attempt;
  r=await page.goto(ORIGIN+probe,{waitUntil:'domcontentloaded',timeout:35000});
  if(r?.status()===200)modeMarker=await page.locator('body').getAttribute('data-member-login-visible');
  if(r?.status()===200&&['0','1'].includes(modeMarker))break;
  await page.waitForTimeout(1800);
 }
 assert.equal(r?.status(),200,'Actual official site must open');
 assert.ok(['0','1'].includes(modeMarker),'New official visitor mode flag missing after propagation');
 await page.waitForTimeout(450);
 assert.equal(await page.locator('#back-admin').count(),1,'Historical admin footer link retained');
 assert.equal(await page.locator('#member-connection').isVisible(),modeMarker==='1',
  'Member login button must follow the owner-selected mode without overriding it');
 assert.equal(await page.locator('body').getAttribute('data-member-login-visible'),modeMarker);
 assert.equal(await page.locator('#general-navigation').count(),1,'Visitor pages/navigation intact');
 await page.screenshot({path:'docs/m022-official-smartphone/01-officiel-visiteur-mode-actuel.png',fullPage:true});
 const anonApi=await page.request.get(ORIGIN+'/api/site-identity',{failOnStatusCode:false});
 assert.equal(anonApi.status(),401,'Admin mode cannot be changed by anonymous visitors');
 const anonDraft=await page.request.get(ORIGIN+'/api/editor-open-draft?celebration='+cid,{failOnStatusCode:false});
 assert.equal(anonDraft.status(),401,'Unpublished editor drafts are private');
 const anonMember=await page.request.get(ORIGIN+'/api/admin/member-directory?action=snapshot',{failOnStatusCode:false});
 assert.equal(anonMember.status(),401,'Members protected server-side regardless of display mode');
 r=await page.goto(ORIGIN+'/__editor/voir-le-site?celebration='+cid+'&page=accueil-celebration',
  {waitUntil:'domcontentloaded',timeout:35000});
 assert.equal(r?.status(),200,'Existing celebration and public pages still render');
 r=await page.goto(ORIGIN+'/admin',{waitUntil:'domcontentloaded',timeout:35000});
 assert.equal(r?.status(),200);
 assert.equal(await page.locator('input[name="code"]').count(),1,'Same official PIN form');
 assert.equal(await page.locator('form[action="/api/editor-access"]').count(),1);
 await page.screenshot({path:'docs/m022-official-smartphone/02-officiel-acces-administration.png',fullPage:true});
 r=await page.goto(ORIGIN+'/__editor/demo-preparation?celebration='+cid,
  {waitUntil:'domcontentloaded',timeout:35000});
 assert.equal(r?.status(),200,'Direct new admin link still opens the protected login');
 assert.equal(await page.locator('input[name="code"]').count(),1,'Official PIN required before editor');
 assert.deepEqual(errors,[],'No browser JavaScript errors');
 console.log('M022_REAL_OFFICIAL_PUBLIC_AND_PIN_GATE_PASS '+JSON.stringify({
  official_public:200,celebration_public:200,login_form:true,
  member_login_matches_saved_mode:true,admin_footer_link:true,anonymous_drafts:401,
  anonymous_members:401,anonymous_settings:401,
  official_pin_submitted:false,real_user_data_writes:0
 }));
}finally{await browser.close()}