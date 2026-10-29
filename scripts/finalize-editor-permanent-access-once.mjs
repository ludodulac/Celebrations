// Staging-only permanent-access finalization. All credentials live solely in
// process memory; encrypted receipt can be decrypted only outside GitHub.
// No plaintext password, salt, verifier, API token, or session is logged/filed.
import assert from 'node:assert/strict';
import {randomBytes,pbkdf2Sync,createHash,publicEncrypt,constants} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
const ORIGIN='https://celebrations-exit-staging.rondes.workers.dev';
const WORKER='celebrations-exit-staging';
const DB='0f761662-241f-42cc-ac94-5c68b4aa7797';
const BUCKET='celebrations-exit-staging';
const PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAngJcZ1IQwXOINf+E9KkS\ngD1Pzk4JBtjiPbB8Z4UAn0NIXuLqbHSXcrClQVREXA/OsBJwqTP4qoFT4ZLsOXfu\nXpGjqauiuToAZft1Oj419sepKsndHLl6gAtmvx8aaY01dAotgXLWqJYTudiBBqaV\nKvCElXkBe4GzaU8ybdZSBNomL9+oZBZLR8ty2rLeiCmC1R4TyoHorfDIayMN195q\ng+jzzjBxZ41QczjAYl2oVZ2JQsson0B2V411ZgkGvDEeVS+T2Y1hFFSlSLhxmxJO\nS9L4IvX3a9RWi0IwtAEGANFkeYTsKNv+mnhq4oWhgpJ165k8nX3vBnQrFDWEy0dV\naQqVDZPyDoZnqxaGNIZuPi10TT3XMybI6/7oYkOFvtCzBeuWv+7Vh3Var5OgOUtm\nOAe/ePtJr+XAnDRsnuEdm9LQqHbu4p4brwmjDdS1Zy2wSmp7BtrcDTgdLtygMoNl\nrD5BE06dY6mUfrHn7BHM5zNbOy+hCkNzgrhVfbgwkf8tAgMBAAE=\n-----END PUBLIC KEY-----";
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
let stage='validate-target',browser;
try {
 assert.ok(process.env.CLOUDFLARE_API_TOKEN&&process.env.CLOUDFLARE_ACCOUNT_ID);
 assert.equal(process.env.STAGING_D1_ID,DB);
 assert.equal(process.env.STAGING_R2_BUCKET,BUCKET);
 const settingUrl='https://api.cloudflare.com/client/v4/accounts/'+process.env.CLOUDFLARE_ACCOUNT_ID+'/workers/scripts/'+WORKER+'/settings';
 async function checkBindings(withSecrets){
  const r=await fetch(settingUrl,{headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN}});
  assert.equal(r.status,200);
  const out=await r.json();assert.equal(out.success,true);
  const b=out.result.bindings;assert.ok(Array.isArray(b));
  const d1=b.filter(v=>v.type==='d1'),r2=b.filter(v=>v.type==='r2_bucket');
  assert.deepEqual(d1.map(v=>v.name).sort(),['DB','MEDIA_ACL']);
  assert.ok(d1.every(v=>(v.database_id||v.id)===DB));
  assert.equal(r2.length,1);assert.equal(r2[0].bucket_name,BUCKET);
  assert.equal(b.filter(v=>['service','dispatch_namespace'].includes(v.type)).length,0);
  if(withSecrets)assert.ok(['STAGING_ADMIN_PASSWORD_SALT','STAGING_ADMIN_PASSWORD_VERIFIER'].every(name=>b.some(v=>v.name===name&&v.type==='secret_text')));
 }
 await checkBindings(false);
 console.log('ACCESS_FINAL_STAGING_IDENTITY_PASS');
 stage='generate-strong-password';
 // 192-bit CSPRNG password, 32 base64url chars. Never set as env var or file.
 const password=randomBytes(24).toString('base64url');
 assert.ok(password.length>=20);
 const salt=randomBytes(16);
 const proof=pbkdf2Sync(password,salt,210000,32,'sha256');
 const verifier=hash(proof);
 const entries=[['STAGING_ADMIN_PASSWORD_SALT',salt.toString('hex')],['STAGING_ADMIN_PASSWORD_VERIFIER',verifier]];
 stage='install-protected-secrets';
 for(const [name,value] of entries){
  // D4-proven Cloudflare Workers secret put; value is stdin only.
  const proc=spawnSync('npx',['wrangler','secret','put',name,'--name',WORKER],{
   cwd:'migration/cloudflare',input:value,encoding:'utf8',
   env:process.env,stdio:['pipe','pipe','pipe'],timeout:90000,maxBuffer:1048576
  });
  if(proc.status!==0)throw Error('Cloudflare staging secret operation failed');
 }
 // No verifier, salt, or password may reach a log, a repository file or artifact.
 stage='confirm-staging-binding-names';
 await checkBindings(true);
 console.log('ACCESS_FINAL_BOTH_SECRETS_INSTALLED true');
 stage='verify-login-desktop-and-mobile';
 browser=await chromium.launch({headless:true});
 for(const device of [
  {name:'desktop',viewport:{width:1366,height:768},isMobile:false},
  {name:'phone',viewport:{width:390,height:844},isMobile:true}
 ]){
  const ctx=await browser.newContext({viewport:device.viewport,isMobile:device.isMobile,hasTouch:device.isMobile});
  try{
   const anonymous=await ctx.request.get(ORIGIN+'/api/editor-e1?key=home');
   assert.equal(anonymous.status(),401);
   const page=await ctx.newPage();
   const start=await page.goto(ORIGIN+'/__editor/access',{waitUntil:'domcontentloaded'});
   assert.equal(start.status(),200);
   await page.locator('#password').fill(password);
   await page.locator('#send').click();
   await page.waitForURL(/\/__editor\/edit\?key=home/,{timeout:35000,waitUntil:'domcontentloaded'});
   await page.locator('#e1-edit:not([disabled])').waitFor({timeout:20000});
   assert.ok(await page.locator('.d-welcome').count()>0);
   const token=await page.evaluate(()=>localStorage.getItem('celebrations-admin-token'));
   assert.ok(/^[a-f0-9]{64}$/.test(token));
   const active=await ctx.request.post(ORIGIN+'/api/auth',{data:{action:'admin_session',admin_token:token}});
   assert.equal(active.status(),200);
   assert.equal((await active.json()).ok,true);
   await page.goto(ORIGIN+'/__editor/access',{waitUntil:'domcontentloaded'});
   await page.locator('#logout').click();
   await page.getByText('Session révoquée et déconnexion effectuée.').waitFor({timeout:12000});
   const invalid=await ctx.request.post(ORIGIN+'/api/auth',{data:{action:'admin_session',admin_token:token}});
   assert.equal(invalid.status(),401);
   console.log('ACCESS_FINAL_BROWSER_PASS device='+device.name+' editor_opened=true session_revoked=true');
  } finally {await ctx.close();}
 }
 stage='one-time-encrypted-receipt';
 // GitHub sees only randomized RSA-OAEP ciphertext, never the password.
 const envelope=publicEncrypt({key:PUBLIC_KEY,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(password,'utf8'));
 console.log('ACCESS_FINAL_ENCRYPTED_ONE_TIME_PASSWORD='+envelope.toString('base64'));
 console.log('ACCESS_FINAL_PASS password_not_logged=true production_unchanged=true');
} catch {
 console.error('ACCESS_FINAL_STOP stage='+stage+' credential_values_never_logged=true');
 process.exitCode=1;
} finally {if(browser)await browser.close();}
