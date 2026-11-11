// Actual isolated workerd/Miniflare, real local D1 binding, never deployed.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Miniflare} from 'miniflare';
import {build} from 'esbuild';
import {flags,schemaFiles,schema,exerciseLifecycle,exerciseReplayRace,request,PATH} from '../tests/fixtures/m012a-editor-session-http.mjs';
const temp=await mkdtemp(join(tmpdir(),'celebrations-m012a-'));
try{
 for(const name of ['production','staging']){
  const outfile=join(temp,name+'.mjs');
  await build({entryPoints:['migration/cloudflare/'+name+'-worker.mjs'],bundle:true,
   platform:'node',format:'esm',target:'es2022',outfile,external:['node:*']});
  const mf=new Miniflare({
   modules:true,scriptPath:outfile,compatibilityDate:'2026-08-06',
   compatibilityFlags:['nodejs_compat'],bindings:flags,
   d1Databases:{DB:'11111111-1111-4111-8111-111111111111'},
   d1Persist:false,port:0
  });
  try{
   const db=await mf.getD1Database('DB');
   // SQL files use one statement per terminating line. CREATE TRIGGER
   // blocks end in END; and are submitted as single complete statements.
   for(const file of schemaFiles){
    let sql='';
    for(const line of schema(file).split('\n')){
     if(!line.trim()||line.trimStart().startsWith('--'))continue;
     sql+=(sql?'\n':'')+line;
     if(!line.trimEnd().endsWith(';'))continue;
     if(/^CREATE TRIGGER/i.test(sql)&&!/\bEND;\s*$/i.test(sql))continue;
     await db.prepare(sql).run();
     sql='';
    }
    assert.equal(sql,'','unfinished SQL statement: '+file);
   }
   const fetch=req=>mf.dispatchFetch(req.url,{method:req.method,headers:[...req.headers],
    ...(req.method==='POST'?{body:req.body,duplex:'half'}:{})});
   await exerciseLifecycle(fetch,db);
   await db.prepare('DELETE FROM celebrations_admin_sessions').run();
   await exerciseReplayRace(fetch,db);
   for(const host of ['ronde-des-archanges-universelle.eu','www.ronde-des-archanges-universelle.eu']){
    const r=await fetch(request(PATH,{host,origin:'https://'+host}));
    assert.equal(r.status,404);
   }
   console.log('M012A_WORKERD_REAL_LOCAL_D1_PASS '+name);
  }finally{await mf.dispose()}
 }
}finally{await rm(temp,{recursive:true,force:true})}
