// M011-D integration gates: tests document REAL blockers, never fake activation.
// All requests use an isolated in-memory D1 facade. No Cloudflare bindings.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import productionWorker from '../migration/cloudflare/production-worker.mjs';
import stagingWorker from '../migration/cloudflare/staging-worker.mjs';
import {authorize,sha256} from '../migration/cloudflare/auth-api.mjs';
import {createMemberDirectoryTransport}
  from '../migration/cloudflare/app/admin/editor-member-spaces-integration.mjs';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const official='https://www.ronde-des-archanges-universelle.eu';
const isolated='https://member-lab.example';
const legacy='legacy-'+ 'a'.repeat(48);
const db=(valid=new Map())=>({
  prepare(sql) {
    return {bind(...params){
      return {
        async first(){
          if(sql.includes('FROM celebrations_admin_sessions')){
            const session=valid.get(params[0]);
            return session?{email:session,expires_at:new Date(Date.now()+3600000).toISOString()}:null;
          }
          return null;
        },
        async all(){
          if(sql.includes('FROM celebrations_celebrations'))
            return {results:[{id:41,archangel:'Gabriel',year:'2026',status:'published'}]};
          return {results:[]};
        },
        async run(){throw Error('Unplanned D1 write in M011-D test')}
      };
    }};
  },
  async batch(){throw Error('Unplanned D1 batch in M011-D test')}
});
const envFor=(host,DB=db())=>({
  DB,MEMBER_DIRECTORY_API_ENABLED:'true',
  MEMBER_DIRECTORY_API_HOST:host
});

test('M011-D: 011-C keeps old Supabase token; D1 authorize checks stored session hash instead',async()=>{
  const auth=source('admin-auth.js');
  const bridge=source('admin-member-spaces-bridge.js');
  assert.match(auth,/celebrationsAccessInvoke\('admin_login'/);
  assert.match(auth,/sb\.functions\.invoke\('celebrations-access'/);
  assert.match(auth,/getCelebrationsAdminToken=\(\)=>localStorage/);
  assert.match(bridge,/tokenProvider:\(\)=>window\.getCelebrationsAdminToken/);
  assert.equal(await authorize(new Request(isolated+'/api/admin/member-directory',{
    headers:{authorization:'Bearer '+legacy}
  }),{DB:db()},true),null,'legacy token has no matching D1 session');
});

test('M011-D: real HTTP Worker rejects legacy admin token without D1 session',async()=>{
  const env=envFor('member-lab.example');
  const req=new Request(isolated+'/api/admin/member-directory?action=snapshot',{
    headers:{authorization:'Bearer '+legacy}
  });
  for(const worker of [productionWorker,stagingWorker]){
    const res=await worker.fetch(req.clone(),env);
    assert.equal(res.status,401);
    assert.equal(res.headers.get('cache-control')?.includes('no-store'),true);
    assert.deepEqual(await res.json(),{ok:false,error:'Administrateur requis'});
  }
  const transport=createMemberDirectoryTransport({
    origin:isolated,tokenProvider:()=>legacy,
    fetchImpl:(url,init)=>productionWorker.fetch(new Request(url,init),env)
  });
  const result=await transport({method:'GET',action:'snapshot'});
  assert.equal(result.ok,false);
  assert.match(result.error,/Administrateur requis/);
});

test('M011-D: explicitly provisioned D1 admin token is recognized; participant is not',async()=>{
  const validRaw='d1-'+'b'.repeat(48);
  const hash=await sha256(validRaw);
  const DB=db(new Map([[hash,'admin@example.test']]));
  const request=new Request(isolated+'/api/admin/member-directory',{
    headers:{authorization:'Bearer '+validRaw}
  });
  assert.equal(await authorize(request,{DB},true),'admin@example.test');
  assert.equal(await authorize(request,{DB},false),null);
  assert.equal(await authorize(new Request(isolated+'/api/admin/member-directory',{
    headers:{cookie:'celebrations_editor_access=fake'}
  }),{DB},true),null);
});

test('M011-D: opt-in API never opens on official host and defaults OFF elsewhere',async()=>{
  const url=official+'/api/admin/member-directory';
  const adminHeaders={authorization:'Bearer '+legacy};
  const denied=await productionWorker.fetch(new Request(url,{headers:adminHeaders}),
    envFor('www.ronde-des-archanges-universelle.eu'));
  assert.equal(denied.status,404);
  const off=await productionWorker.fetch(new Request(isolated+'/api/admin/member-directory',{
    headers:adminHeaders
  }),{DB:db()});
  assert.equal(off.status,404);
});

test('M011-D: active official admin.html serves visual editor, not static 011-C bridge',async()=>{
  const key='c'.repeat(64),nonce='d'.repeat(32),stamp=Date.now().toString();
  const payload=stamp+'.'+nonce;
  const sig=createHmac('sha256',key).update('site-editor-v1:'+payload).digest('hex');
  const request=new Request(official+'/admin.html',{headers:{
    cookie:'celebrations_editor_access='+payload+'.'+sig
  }});
  const response=await productionWorker.fetch(request,{DB:db(),ADMIN_PASSWORD_HASH:key});
  assert.equal(response.status,200);
  const html=await response.text();
  assert.match(html,/data-tab="celebrations"/);
  assert.match(html,/id="workspace"/);
  assert.doesNotMatch(html,/data-admin="members-spaces"/);
  assert.doesNotMatch(html,/admin-member-spaces-bridge\.js/);
  const staticAdmin=source('admin.html');
  assert.match(staticAdmin,/data-admin="members-spaces"/);
  assert.match(staticAdmin,/admin-member-spaces-bridge\.js/);
});

test('M011-D: private route handlers remain unmounted; explicit releases have no editor writer',()=>{
  for(const path of ['migration/cloudflare/production-worker.mjs',
    'migration/cloudflare/staging-worker.mjs']){
    const code=source(path);
    assert.doesNotMatch(code,/handleCanonicalPrivate(Page|Media|List)/);
    assert.match(code,/routeMemberAdminWorkerRequest/);
  }
  const loaders=source('migration/cloudflare/app/persistence/private-canonical-content.mjs');
  assert.match(loaders,/published\.privatePageReleases/);
  assert.match(loaders,/published\.privateSpaceReleases/);
  for(const path of ['migration/cloudflare/editor-publication-api.mjs',
    'migration/cloudflare/editor-demo-client.mjs',
    'migration/cloudflare/app/admin/editor-spaces-draft.mjs']){
    assert.doesNotMatch(source(path),/privatePageReleases\s*=/);
    assert.doesNotMatch(source(path),/privateSpaceReleases\s*=/);
  }
});

test('M011-D: UI does not claim disabled draft writes succeeded',()=>{
  const ui=source('migration/cloudflare/app/admin/editor-member-spaces-integration.mjs');
  assert.match(ui,/save\.disabled=true/);
  assert.match(ui,/publish\.disabled=true/);
  assert.match(ui,/Modifications locales non sauvegardées/);
  assert.match(ui,/fermeture de la page = perte des modifications/);
});

test('M011-D: historic public media routes still precede the Worker asset fallback',()=>{
  const worker=source('migration/cloudflare/production-worker.mjs');
  assert.match(worker,/path\.startsWith\("\/media\/"\)\|\|path\.startsWith\("\/letter\/"\)/);
  assert.match(worker,/handleMedia\(request,env\)/);
});
