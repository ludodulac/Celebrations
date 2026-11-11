// M009-D — cross-branch compatibility only. Offline, invented data, no Cloudflare writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveVerifiedMember} from '../migration/cloudflare/app/security/member-private-access.mjs';
import {resolveExplicitMemberIdentity} from '../migration/cloudflare/app/security/member-identity-links.mjs';
import {publicSnapshot,publishedMedia} from '../migration/cloudflare/editor-publication-api.mjs';
import {isPrivateMediaReference,isPrivateMediaRecord}
  from '../migration/cloudflare/app/security/public-media-boundary.mjs';
import {handleMedia} from '../migration/cloudflare/media-gateway.mjs';
import {projectPublishedLanguage} from '../migration/cloudflare/app/application/public-language-release.mjs';

const SITE='https://www.ronde-des-archanges-universelle.eu';
const source=path=>readFileSync(new URL('../migration/cloudflare/'+path,import.meta.url),'utf8');
const personId='person:550e8400-e29b-41d4-a716-446655440000';

test('M009-D regression: M008-C now rejects email equality without an approved identity link',async()=>{
  const token='t'.repeat(64),email='synthetic@example.org';
  const queries=[];
  const db={prepare(sql){
    queries.push(sql);
    return {bind(){return {first:async()=>{
      if(sql.includes('FROM celebrations_participant_sessions'))
        return {email,expires_at:new Date(Date.now()+3600000).toISOString()};
      if(sql.includes('FROM celebrations_directory_people d'))
        return {person_id:personId,email_normalized:email};
      if(sql.includes('FROM celebrations_directory_identity_links'))
        return null; // no independently approved identity link
      throw Error('Unexpected SQL in isolated identity fixture: '+sql);
    }}}};
  }};
  const request=new Request(SITE+'/private/fixture',{headers:{authorization:'Bearer '+token}});
  const env={DB:db};
  assert.equal(await resolveVerifiedMember(request,env),null,
    'matching participant and directory email cannot grant member identity');
  assert.equal(await resolveExplicitMemberIdentity(request,env),null,
    'no independent administrative approval means no identity');
  assert.equal(queries.some(q=>q.includes('d.email_normalized=?')),false);
  assert.ok(queries.some(q=>q.includes('celebrations_directory_identity_links')));
  assert.ok(queries.some(q=>q.includes('celebrations_directory_identity_claims')));
  for(const worker of ['production-worker.mjs','staging-worker.mjs']){
    const code=source(worker);
    assert.equal(code.includes('member-private-access.mjs'),false);
    assert.equal(code.includes('member-identity-links.mjs'),false);
    assert.equal(code.includes('member-directory-admin-service.mjs'),false);
  }
});

test('M009-D projection/public media share one private namespace boundary',()=>{
  const publicPdf='/media/archives/programme-historique.pdf';
  const privatePdf='/media/private-members/secret-fixture.pdf';
  const published={shared:{homeId:'neutral-accueil-general',pages:[
    {id:'neutral-accueil-general',group:'page',name:'Accueil',visibility:'published',
      blocks:[{id:1,kind:'button',text:'PDF historique',href:publicPdf}]},
    {id:'neutral-private',group:'page',name:'SECRET_PRIVATE_PAGE',visibility:'published',
      accessPolicy:{mode:'SELECTED_TYPES',typeIds:['member-type:choir']},
      blocks:[{id:2,kind:'button',text:'SECRET_LINK',href:privatePdf}]}
  ]},drafts:{},plans:[],celebrationVisibility:{}};
  const state={version:1,shared:structuredClone(published.shared),drafts:{},plans:[],
    published,mediaCatalogue:[
      {type:'pdf',src:publicPdf,name:'Programme public',source:'historical',general:true},
      {type:'pdf',src:privatePdf,name:'SECRET_PRIVATE_PDF',source:'historical',general:true,
        visibility:'private'}
    ]};
  const projected=publicSnapshot(state,'41');
  const htmlOrJson=JSON.stringify(projected);
  assert.ok(htmlOrJson.includes('programme-historique.pdf'));
  assert.equal(htmlOrJson.includes('SECRET_PRIVATE_PAGE'),false);
  assert.equal(htmlOrJson.includes('SECRET_LINK'),false);
  const index=publishedMedia(state);
  assert.equal(index.some(x=>x.src===publicPdf),true);
  assert.equal(index.some(x=>x.src===privatePdf),false);
  assert.equal(isPrivateMediaReference(privatePdf),true);
  assert.equal(isPrivateMediaRecord({src:privatePdf,general:true}),true);
  assert.equal(isPrivateMediaReference(publicPdf),false);
  const fr=projectPublishedLanguage(projected,published,SITE+'/?lang=fr');
  assert.equal(JSON.stringify(fr).includes('SECRET_PRIVATE_PAGE'),false);
});

test('M009-D old public PDF route remains usable; private fixture blocked before R2 read',async()=>{
  const publicKey='archives/programme-historique.pdf';
  const secretKey='private-members/secret-fixture.pdf';
  const calls=[];
  const env={
    MEDIA_ACL:{prepare(){return {bind(key){calls.push('acl:'+key);return {
      first:async()=>({approved:1,revoked_at:null})}}}}},
    MEDIA_BUCKET:{async get(key){
      calls.push('r2:'+key);
      return {size:4,body:new TextEncoder().encode('%PDF'),httpEtag:'synthetic-etag'};
    }}
  };
  const pdf=await handleMedia(new Request(SITE+'/media/'+publicKey),env);
  assert.equal(pdf.status,200);
  assert.equal(pdf.headers.get('content-type'),'application/pdf');
  assert.equal(await pdf.text(),'%PDF');
  assert.ok(calls.includes('r2:'+publicKey));
  calls.length=0;
  const denied=await handleMedia(new Request(SITE+'/media/'+secretKey),env);
  assert.equal(denied.status,404);
  assert.equal(calls.some(x=>x.startsWith('r2:')),false,
    'legacy gateway must never read a private object');
  assert.equal(calls.some(x=>x.startsWith('acl:')),false,
    'legacy gateway must reject namespace before ACL lookup');
  assert.match(denied.headers.get('cache-control')||'',/no-store/);
});
