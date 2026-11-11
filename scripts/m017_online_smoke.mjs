// M017 remote browser smoke: real Cloudflare Worker + D1 + R2, fictional data.
// The preproduction password remains inside protected GitHub Actions env.
// No mock Worker, no local D1/R2, no production calls, no credential logging.
import assert from 'node:assert/strict';
import {pbkdf2Sync,createHmac,randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
const origin='https://celebrations-m016-admin-preprod.rondes.workers.dev';
const secret=process.env.M017_ADMIN_PASSWORD;
assert.ok(secret?.length>=16,'Protected test secret missing');
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844}});
const page=await context.newPage();
const faults=[];page.on('pageerror',e=>faults.push(String(e.message||e).slice(0,120)));
function result(label,value){console.log('M017_ONLINE '+JSON.stringify({label,...value}));}
async function jsonPost(url,body,extra={}) {
 const r=await fetch(origin+url,{method:'POST',headers:{origin,'content-type':'application/json',...extra},
  body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
 const j=await r.json().catch(()=>({}));
 return {status:r.status,body:j};
}
try {
 const first=await page.goto(origin+'/admin',{waitUntil:'domcontentloaded',timeout:30000});
 assert.equal(first.status(),200);
 assert.ok(await page.locator('input[name="code"]').count(),'Normal browser must show PIN login');
 const unauth=(await fetch(origin+'/api/editor-open-draft?celebration=90000001',{signal:AbortSignal.timeout(25000)})).status;
 assert.equal(unauth,401);
 const memberDenied=await fetch(origin+'/api/admin/member-directory?action=snapshot',{signal:AbortSignal.timeout(25000)});
 assert.equal(memberDenied.status,401);
 result('login_gated',{login_form:200,draft_denied:unauth,member_denied:memberDenied.status});
 await page.locator('input[name="code"]').fill(secret);
 await Promise.all([
  page.waitForURL(u=>u.pathname==='/admin.html',{timeout:30000}),
  page.locator('button[type="submit"]').click()
 ]);
 await page.waitForLoadState('domcontentloaded');
 assert.ok((await page.locator('body').innerText()).includes('Membres et espaces'),
  'Existing visual editor not rendered after real PIN login');
 const original=await page.evaluate(async()=>{
  const r=await fetch('/api/editor-open-draft?celebration=90000001',{cache:'no-store'});
  return {status:r.status,body:await r.json()};
 });
 assert.equal(original.status,200);
 assert.equal(original.body.ok,true);
 result('visual_editor_online',{admin:200,draft_revision:original.body.revision,member_section:true});
 const id='plan-raphael-2026-11-11', pageId='preparation-'+id;
 const text='M017 PUBLICATION VISITEUR FICTIVE CONFIRMÉE';
 const saved=await page.evaluate(async({id,pageId,text,rev})=>{
  const data={celebration:id,expectedRevision:rev,
   plans:[{id,title:'Raphaël — validation M017',archangel:'Raphaël',
    date:'2026-11-11',visibility:'draft'}],
   record:{pages:[{id:pageId,name:'Préparation M017',group:'celebration',
    visibility:'draft',blocks:[{id:'block-m017',kind:'text',text}]}],
    celebrationDates:{},celebrationTimes:{}},
   shared:{pages:[],homeId:''}};
  const r=await fetch('/api/editor-open-draft',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify(data)});
  return {status:r.status,body:await r.json()};
 },{id,pageId,text,rev:original.body.revision});
 assert.equal(saved.status,200,JSON.stringify({save_status:saved.status,error:saved.body.error}));
 assert.equal(saved.body.ok,true);
 const reload=await page.evaluate(async id=>{
  const r=await fetch('/api/editor-open-draft?celebration='+encodeURIComponent(id),{cache:'no-store'});
  return {status:r.status,body:await r.json()};
 },id);
 assert.equal(reload.status,200);
 assert.equal(reload.body.record?.pages?.[0]?.blocks?.[0]?.text,text);
 result('create_save_reload',{created:true,persisted:true,revision:reload.body.revision});
 const uploaded=await page.evaluate(async()=>{
  const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pYziYsAAAAASUVORK5CYII='),x=>x.charCodeAt(0));
  const form=new FormData();form.append('file',new File([bytes],'m017-fictive.png',{type:'image/png'}));
  const r=await fetch('/api/editor-media?action=upload',{method:'POST',body:form});
  return {status:r.status,body:await r.json()};
 });
 assert.equal(uploaded.status,200,JSON.stringify({upload_status:uploaded.status,error:uploaded.body.error}));
 assert.equal(uploaded.body.ok,true);
 assert.match(uploaded.body.item?.src||'',/^\/media\/new\//);
 const uploadPublic=await fetch(origin+uploaded.body.item.src);
 assert.equal(uploadPublic.status,404,'Unpublished uploaded media must NOT be public');
 const uploadOwner=await page.evaluate(src=>fetch(src).then(r=>r.status),uploaded.body.item.src);
 assert.equal(uploadOwner,200,'Owner should retrieve original upload');
 result('media_upload_acl',{uploaded:true,private_public_status:uploadPublic.status,owner_status:uploadOwner});
 let rev=uploaded.body.revision;
 for(const command of [
  {kind:'celebration',visibility:'published'},
  {kind:'page',pageId,visibility:'published'}
 ]) {
  const pub=await page.evaluate(async({id,rev,command})=>{
   const r=await fetch('/api/editor-publication',{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify({celebration:id,expectedRevision:rev,...command})});
   return {status:r.status,body:await r.json()};
  },{id,rev,command});
  assert.equal(pub.status,200,JSON.stringify({publish:command.kind,status:pub.status,error:pub.body.error}));
  assert.equal(pub.body.ok,true);rev=pub.body.revision;
 }
 const published=await fetch(origin+'/api/editor-publication?celebration='+encodeURIComponent(id),{
  signal:AbortSignal.timeout(25000)});
 assert.equal(published.status,200);
 const publishedData=await published.text();
 assert.ok(publishedData.includes(text),'Public projection must include released fake text');
 const site=await context.newPage();
 const viewer=await site.goto(origin+'/?celebration='+id+'&page=preparation',{waitUntil:'domcontentloaded',timeout:30000});
 assert.equal(viewer.status(),200);
 await site.waitForTimeout(1200);
 assert.ok((await site.locator('body').innerText()).includes(text),'Real browser visitor cannot read published fake page');
 await site.close();
 result('publish_and_visit',{published:true,visitor_status:viewer.status(),visible:true});
 const challenge=await jsonPost('/api/admin/editor-session',{action:'challenge'});
 assert.equal(challenge.status,200,JSON.stringify({session_challenge_status:challenge.status,error:challenge.body.error}));
 assert.equal(challenge.body.iterations,180000);
 const verifier=pbkdf2Sync(secret,challenge.body.salt,180000,32,'sha256').toString('hex');
 const response=createHmac('sha256',verifier).update('celebrations-admin-login-v1:'+origin+':'+challenge.body.challenge).digest('hex');
 const login=await jsonPost('/api/admin/editor-session',{action:'login',challenge:challenge.body.challenge,response});
 assert.equal(login.status,200,JSON.stringify({session_login_status:login.status,error:login.body.error}));
 const bearer=login.body.token;assert.match(bearer,/^[a-f0-9]{64}$/);
 const directory=await fetch(origin+'/api/admin/member-directory?action=snapshot',{headers:{authorization:'Bearer '+bearer}});
 assert.equal(directory.status,200);
 const snapshot=await directory.json();assert.equal(snapshot.ok,true);
 assert.ok(snapshot.data.types.some(t=>t.id==='member-type:m016'),'Fictional member type not installed');
 const privateAnon=await fetch(origin+'/api/participant/space-page?celebration=90000001&pageId=private-m017');
 assert.ok([401,403,404].includes(privateAnon.status));
 const logout=await jsonPost('/api/admin/editor-session',{action:'logout'},{authorization:'Bearer '+bearer});
 assert.equal(logout.status,200);
 const expired=await fetch(origin+'/api/admin/member-directory?action=snapshot',{headers:{authorization:'Bearer '+bearer}});
 assert.equal(expired.status,401);
 result('member_acl',{authorized:200,unauthorized_after_logout:expired.status,private_anonymous_denied:privateAnon.status});
 assert.deepEqual(faults,[],'JavaScript runtime errors in real editor');
 result('DONE',{editor_login:true,save_reload:true,file_upload:true,publication:true,member_auth:true,chromium:true});
}finally{
 await browser.close();
}
