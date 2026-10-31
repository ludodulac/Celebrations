// D4 restoration test: ephemeral QA credential only, never a personal password.
// Staging secrets receive only a SHA-256 verifier, and QA code stays in RAM.
// Logs contain step names, no credentials, verifiers, browser storage or cookies.
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
const SITE='https://celebrations-exit-staging.rondes.workers.dev';
const WORKER='celebrations-exit-staging';
const hash=v=>createHash('sha256').update(v).digest('hex');
const qaCode='D4'+randomBytes(20).toString('hex').toUpperCase();
const qaVerifier=hash(qaCode);
let phase='before',browser;
try{
 // Do not replace the personal D4 verifier under any circumstances.
 assert.ok(process.env.CLOUDFLARE_API_TOKEN&&process.env.CLOUDFLARE_ACCOUNT_ID);
 assert.equal(process.env.STAGING_D1_ID,'0f761662-241f-42cc-ac94-5c68b4aa7797');
 assert.equal(process.env.STAGING_R2_BUCKET,'celebrations-exit-staging');
 phase='verify-existing-personal-secret';
 const url='https://api.cloudflare.com/client/v4/accounts/'+process.env.CLOUDFLARE_ACCOUNT_ID+'/workers/scripts/'+WORKER+'/settings';
 const resp=await fetch(url,{headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN}});
 assert.equal(resp.status,200);
 const obj=await resp.json();assert.equal(obj.success,true);
 const binds=obj.result.bindings;
 assert.deepEqual(binds.filter(b=>b.type==='d1').map(b=>b.name).sort(),['DB','MEDIA_ACL']);
 assert.ok(binds.filter(b=>b.type==='d1').every(b=>(b.database_id||b.id)==='0f761662-241f-42cc-ac94-5c68b4aa7797'));
 assert.deepEqual(binds.filter(b=>b.type==='r2_bucket').map(b=>b.bucket_name),['celebrations-exit-staging']);
 assert.equal(binds.filter(b=>['service','dispatch_namespace'].includes(b.type)).length,0);
 assert.ok(binds.some(b=>b.name==='ADMIN_D4_ACCESS_HASH'&&b.type==='secret_text'),'Personal D4 secret absent: STOP');
 assert.ok(binds.some(b=>b.name==='EDITOR_D_PREVIEW_TOKEN'&&b.type==='secret_text'),'Preview protection unavailable: STOP');
 console.log('D4_RESTORE_SECRET_EXISTS_PASS only_name_checked=true');
 phase='install-QA-only-verifier';
 const installed=spawnSync('npx',['wrangler','secret','put','ADMIN_D4_QA_HASH','--name',WORKER],{
  cwd:'migration/cloudflare',input:qaVerifier,encoding:'utf8',env:process.env,
  stdio:['pipe','pipe','pipe'],timeout:100000,maxBuffer:1048576
 });
 assert.equal(installed.status,0,'QA verifier setup failure; no personal verifier changes');
 console.log('D4_RESTORE_QA_VERIFIER_STAGING_PASS no_personal_password_generated=true');
 phase='staging-only-deploy';
 const deployed=spawnSync('npx',['wrangler','deploy','--config','wrangler.toml'],{
  cwd:'migration/cloudflare',encoding:'utf8',env:process.env,
  stdio:['ignore','pipe','pipe'],timeout:160000,maxBuffer:1048576
 });
 assert.equal(deployed.status,0,'Staging deployment failed');
 console.log('D4_RESTORE_STAGING_DEPLOY_PASS');
 phase='desktop-and-phone-live-test';
 browser=await chromium.launch({headless:true});
 for(const dev of [{name:'desktop',viewport:{width:1366,height:768},isMobile:false},
                   {name:'phone',viewport:{width:390,height:844},isMobile:true}]){
  const ctx=await browser.newContext({viewport:dev.viewport,isMobile:dev.isMobile,hasTouch:dev.isMobile});
  try{
   const anonymous=await ctx.request.get(SITE+'/api/editor-e1?key=home');
   assert.equal(anonymous.status(),401,'Anonymous editing denied');
   const page=await ctx.newPage();
   const login=await page.goto(SITE+'/__editor/access',{waitUntil:'domcontentloaded'});
   assert.equal(login.status(),200);
   assert.ok(await page.locator('#code').isVisible(),'D4 field not visible');
   assert.ok(await page.locator('#connect').isVisible(),'D4 submit not visible');
   await page.locator('#code').fill(qaCode);
   await page.locator('#connect').click();
   await page.waitForURL(/\/__editor\/edit\?key=home/,{timeout:30000});
   await page.locator('#e1-edit:not([disabled])').waitFor({timeout:20000});
   assert.ok(await page.locator('.d-welcome').count()>0,'Visual editor home is absent');
   const token=await page.evaluate(()=>localStorage.getItem('celebrations-admin-token'));
   assert.ok(/^[a-f0-9]{64}$/.test(token),'No validated session token in same device');
   const status=await ctx.request.post(SITE+'/api/auth',{data:{action:'admin_session',admin_token:token}});
   assert.equal(status.status(),200);
   assert.equal((await status.json()).ok,true);
   const revoke=await ctx.request.post(SITE+'/__editor/access/logout',{headers:{authorization:'Bearer '+token}});
   assert.equal(revoke.status(),200);
   const revoked=await ctx.request.post(SITE+'/api/auth',{data:{action:'admin_session',admin_token:token}});
   assert.equal(revoked.status(),401,'Revoked test session still valid');
   console.log('D4_RESTORE_LIVE_BROWSER_PASS device='+dev.name+' editor_home=true revoke=true');
  }finally{await ctx.close();}
 }
 console.log('D4_RESTORE_QA_TECHNICAL_PASS user_code_not_tested=true');
}catch{
 console.error('D4_RESTORE_ABORT phase='+phase+' no_secrets_logged=true');
 process.exitCode=1;
}finally{if(browser)await browser.close();}
