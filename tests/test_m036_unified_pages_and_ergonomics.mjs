import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {editorLoginPage} from '../migration/cloudflare/editor-site-access.mjs';
import {projectPublicPage} from '../migration/cloudflare/app/domain/editor-public-projection-security.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {TRIAL_SITE_CLIENT} from '../migration/cloudflare/editor-trial-site-client.mjs';
import {M033_SPLASH_HOME_CSS} from '../migration/cloudflare/editor-trial-site-page.mjs';
const src=readFileSync(new URL('../migration/cloudflare/editor-demo-client-source.js',import.meta.url),'utf8');
const publicPage=readFileSync(new URL('../migration/cloudflare/editor-trial-site-page.mjs',import.meta.url),'utf8');
const adminPage=readFileSync(new URL('../migration/cloudflare/editor-demo-preparation-page.mjs',import.meta.url),'utf8');
test('M036: existing author-controlled Bienvenue text is never automatically hidden',()=>{
 assert.ok(!TRIAL_SITE_CLIENT.includes('previousWelcomeReplaced'));
 assert.ok(!TRIAL_SITE_CLIENT.includes("b?.kind==='text'&&String(b.text||'').trim().toLocaleLowerCase('fr')==='bienvenue'"));
 assert.match(TRIAL_SITE_CLIENT,/for\(const b of page.blocks\|\|\[\]\)/);
 assert.match(TRIAL_SITE_CLIENT,/appendPageBlock\(b,segment\)/);
 assert.doesNotThrow(()=>new Function(TRIAL_SITE_CLIENT));
 assert.doesNotThrow(()=>new Function(DEMO_CLIENT));
});
test('M036: personal pages are in visitor nav before Célébrations and Médiathèque',()=>{
 const start=TRIAL_SITE_CLIENT.indexOf('const general=el(\'general-navigation\')');
 const group=TRIAL_SITE_CLIENT.slice(start,TRIAL_SITE_CLIENT.indexOf('const menu=el(\'menu-toggle\')',start));
 const p=group.indexOf("for(const p of pages.filter(p=>p.group==='page'");
 const c=group.indexOf("t('✧ Célébrations')");
 const m=group.indexOf("t('▧ Médiathèque générale')");
 assert.ok(p>=0&&c>p&&m>c);
 assert.match(TRIAL_SITE_CLIENT,/const fixed=rows\.find\(p=>p\.id==='neutral-accueil-general'\)/,
  'Accueil général is always home; no optional home assignment');
 assert.ok(!src.includes("b('Définir comme accueil'"));
 assert.match(src,/Modifier le nom/);
});
test('M036: all pages share the same width and minimum height, image never cropped',()=>{
 assert.match(M033_SPLASH_HOME_CSS,/width:min\(940px,calc\(100vw - 24px\)\)/);
 assert.match(M033_SPLASH_HOME_CSS,/min-height:clamp\(510px,66svh,780px\)/);
 assert.match(M033_SPLASH_HOME_CSS,/\.m033-splash-image\{[^}]*height:auto!important/);
 assert.match(M033_SPLASH_HOME_CSS,/object-fit:contain!important/);
 assert.match(M033_SPLASH_HOME_CSS,/\.m036-image-edge-to-edge/);
 assert.match(src,/Image sur toute la largeur de la page/);
 assert.match(src,/x\.fullBleed=full\.checked/);
 assert.doesNotMatch(src,/function makeHome\(p\)/);
});
test('M036: full-width property passes safe published projection; private page still excluded',()=>{
 const p={id:'neutral-123e4567-e89b-42d3-a456-426614174000',
  name:'Images',group:'page',visibility:'published',blocks:[
   {id:1,kind:'heading',text:'Mon titre'},
   {id:2,kind:'image',src:'/media/media/123.jpg',widthPct:100,fullBleed:true}
  ]};
 const pub=projectPublicPage(p);
 assert.equal(pub.blocks[0].text,'Mon titre');
 assert.equal(pub.blocks[1].fullBleed,true);
 assert.equal(pub.blocks[1].widthPct,100);
 assert.equal(projectPublicPage({...p,accessPolicy:{mode:'ALL_PRIVATE_TYPES'}}),null);
 assert.match(TRIAL_SITE_CLIENT,/b\.fullBleed===true&&root===main/);
});
test('M036: star is a native public link, duplicate button removed, draft preview preserved',()=>{
 assert.match(adminPage,/m036-public-star/);
 assert.match(adminPage,/aria-label="Ouvrir le site public"/);
 assert.match(adminPage,/target="_blank"/);
 assert.ok(!adminPage.includes('id="view-site-btn"'));
 assert.match(adminPage,/id="preview-btn"/);
 assert.match(src,/m036SettingsDismissBound/);
 assert.match(src,/current\.open&&!current\.contains\(event\.target\)/);
 assert.match(src,/event\.key==='Escape'/);
});
test('M036: login eye works under a nonce CSP without touching server PIN verifier',async()=>{
 const response=await editorLoginPage(new Request('https://ronde-des-archanges-universelle.eu/admin.html'),{
  ADMIN_PASSWORD_HASH:'a'.repeat(64)
 });
 assert.equal(response.status,200);
 const html=await response.text(),csp=response.headers.get('content-security-policy');
 assert.match(html,/name="code" type="password"/);
 assert.match(html,/id="pin-eye" type="button"/);
 assert.match(html,/aria-label="Afficher le code"/);
 assert.match(html,/input\.type=visible\?'text':'password'/);
 const scriptNonce=html.match(/<script nonce="([a-f0-9]+)">/);
 assert.ok(scriptNonce);
 assert.ok(csp.includes("script-src 'nonce-"+scriptNonce[1]+"'"));
 assert.match(html,/<form action="\/api\/editor-access" method="post">/);
 assert.match(html,/name="_csrf"/);
 assert.match(csp,/form-action 'self'/);
});
