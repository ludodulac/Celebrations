// M048 — genuine desktop/mobile hero assets, with one canonical setting.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_HOME_ENTRY_BUTTON,normalizeHomeEntryButton,
 validHomeEntryButton,validHomeImageUrl} from '../migration/cloudflare/app/domain/editor-home-entry-button.mjs';
import {projectPublicPage} from '../migration/cloudflare/app/domain/editor-public-projection-security.mjs';
import {TRIAL_SITE_CLIENT} from '../migration/cloudflare/editor-trial-site-client.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {M033_SPLASH_HOME_CSS} from '../migration/cloudflare/editor-trial-site-page.mjs';
const source=readFileSync(new URL('../migration/cloudflare/editor-demo-client-source.js',import.meta.url),'utf8');

test('responsive image defaults are two real optimized image files',()=>{
 for(const [key,name] of [['desktopImage','ordinateur'],['mobileImage','telephone']]){
  const value=DEFAULT_HOME_ENTRY_BUTTON[key];
  assert.equal(value,'/assets/home/automne-'+name+'.webp');
  const data=readFileSync(new URL('../assets/home/automne-'+name+'.webp',import.meta.url));
  assert.equal(data.toString('ascii',0,4),'RIFF');
  assert.equal(data.toString('ascii',8,12),'WEBP');
  assert.ok(data.byteLength>25000&&data.byteLength<160000);
 }
});
test('old saved home buttons gain default image paths without losing their colours',()=>{
 const old={...DEFAULT_HOME_ENTRY_BUTTON};delete old.desktopImage;delete old.mobileImage;
 old.background='#334455';old.positionY=30;old.label='Bienvenue';
 assert.equal(validHomeEntryButton(old),true);
 const normalized=normalizeHomeEntryButton(old);
 assert.equal(normalized.background,'#334455'.toUpperCase());
 assert.equal(normalized.positionY,30);
 assert.equal(normalized.desktopImage,DEFAULT_HOME_ENTRY_BUTTON.desktopImage);
 assert.equal(normalized.mobileImage,DEFAULT_HOME_ENTRY_BUTTON.mobileImage);
});
test('safe image choices, no private path injection or javascript',()=>{
 for(const ok of ['/media/new/image-123.webp','/media/media/archive.jpeg',
  '/assets/home/automne-ordinateur.webp','https://example.org/hero.png',''])
  assert.equal(validHomeImageUrl(ok),true,ok);
 for(const bad of ['javascript:alert(1)','//evil.test/a.jpg','/private-members/secret.jpg',
  '/media/../secret.jpg','http://example.org/hero.jpg'])
  assert.equal(validHomeImageUrl(bad),false,bad);
});
test('published page carries canonical image choices, not private preview-only data',()=>{
 const page={id:'neutral-accueil-general',group:'page',visibility:'published',name:'Accueil',
  homeEntryButton:{...DEFAULT_HOME_ENTRY_BUTTON},blocks:[{id:'photo',kind:'image',src:'/media/new/image.jpg'}]};
 const publicPage=projectPublicPage(page);
 assert.equal(publicPage.homeEntryButton.mobileImage,DEFAULT_HOME_ENTRY_BUTTON.mobileImage);
 assert.equal(publicPage.homeEntryButton.desktopImage,DEFAULT_HOME_ENTRY_BUTTON.desktopImage);
});
test('native picture chooses phone 9:16 or desktop 16:9 without duplicate images',()=>{
 assert.doesNotThrow(()=>new Function(TRIAL_SITE_CLIENT));
 assert.doesNotThrow(()=>new Function(DEMO_CLIENT));
 assert.match(TRIAL_SITE_CLIENT,/make\('picture','m048-splash-picture'\)/);
 assert.match(TRIAL_SITE_CLIENT,/mobile\.media='\(max-width: 700px\)'/);
 assert.match(TRIAL_SITE_CLIENT,/mobile\.srcset=mobileSplashSource/);
 assert.match(TRIAL_SITE_CLIENT,/image\.src=splashSource/);
 assert.match(TRIAL_SITE_CLIENT,/welcomeButton\.desktopImage/);
 assert.match(M033_SPLASH_HOME_CSS,/\.footer\{display:none!important\}/);
 assert.match(M033_SPLASH_HOME_CSS,/100svh - 62px/);
 assert.match(M033_SPLASH_HOME_CSS,/site-nav-title/);
});
test('administration offers both image proportions and existing media picker',()=>{
 assert.match(source,/Image d’accueil — ordinateur/);
 assert.match(source,/Image d’accueil — téléphone/);
 assert.match(source,/16:9 \(ex\. 1920 × 1080\)/);
 assert.match(source,/9:16 \(ex\. 1080 × 1920\)/);
 assert.match(source,/showImagePicker\(imageTarget\)/);
 assert.match(source,/Appliquer l’accueil sur le site/);
});

test('admin preview uses published viewport geometry and updates on image selection',()=>{
 assert.match(source,/m049-home-viewport/);
 assert.match(source,/1440 × 900/);
 assert.match(source,/390 × 844/);
 assert.match(source,/updateImage\(\);modify\(\)/);
 const style=readFileSync(new URL('../migration/cloudflare/app/styles/admin/style.mjs',import.meta.url),'utf8');
 assert.match(style,/aspect-ratio:1440 \/ 824/);
 assert.match(style,/aspect-ratio:390 \/ 782/);
 assert.match(style,/object-fit:cover!important/);
 assert.match(style,/object-position:center top!important/);
});

// CI probe: verify the exact desktop/mobile preview tests on this branch.
