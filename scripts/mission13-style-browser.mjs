// M13 — Visual CSS fixture. No production requests or user data.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {DEMO_CSS} from '../migration/cloudflare/editor-demo-style.mjs';
import {ADMIN_STAGE_LAYOUT} from '../migration/cloudflare/app/styles/admin/stage-layout.mjs';
import {TRIAL_SITE_STYLE} from '../migration/cloudflare/editor-trial-site-client.mjs';

const DIR='artifacts/mission13/style-fixture';
await mkdir(DIR,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const matrix=[
 {name:'ordinateur',width:1280,height:840,mobile:false},
 {name:'telephone',width:390,height:844,mobile:true}
];
let checks=0;
try{
 for(const {name,width,height,mobile} of matrix){
  const context=await browser.newContext({viewport:{width,height},
   isMobile:mobile,hasTouch:mobile,locale:'fr-FR',reducedMotion:'reduce',serviceWorkers:'block'});
  const page=await context.newPage();
  page.on('pageerror',error=>{throw error});
  const markup=`<!doctype html><html lang="fr"><head><meta charset="utf-8">
   <meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
   <div class="shell stage-editor">
    <aside class="rail"><nav><button class="navbtn active">Pages</button></nav></aside>
    <div class="content"><header class="topbar"><div>Administration</div>
     <div class="actions"><button class="editor-undo-button">↶</button>
      <button class="btn primary">Enregistrer</button></div></header>
     <main class="main"><div class="layout">
      <div class="panel"><h2>Pages</h2><div class="list">
       <button class="item active">Mercredi</button><button class="item">Jeudi</button></div></div>
      <div class="canvas"><div class="block is-selected">
       <p class="ed">Texte fictif</p><div class="tools"><button>Modifier</button></div>
       <div class="block-validate-actions"><button>Valider</button></div>
      </div></div>
     </div></main>
    </div></div></body></html>`;
  await page.setContent(markup);
  await page.addStyleTag({content:DEMO_CSS});
  await page.addStyleTag({content:ADMIN_STAGE_LAYOUT});
  for(const modalKind of ['image-picker-dialog','file-picker-dialog','insert-file-dialog']){
   const dialog=await page.evaluate(kind=>{
    const dlg=document.createElement('dialog');dlg.className=kind;
    dlg.id='dialog-under-test';
    dlg.innerHTML='<header><h2>Fichiers de la célébration</h2></header>'+
      '<div style="height:100px;overflow:auto">Une image fictive, un PDF fictif</div>'+
      '<footer><button id="close-dialog" type="button">Fermer</button></footer>';
    document.querySelector('.stage-editor').append(dlg);
    dlg.querySelector('#close-dialog').onclick=()=>dlg.close();
    dlg.showModal();
    return dlg.className;
   },modalKind);
   assert.equal(dialog,modalKind);
   const element=page.locator('#dialog-under-test');
   const rect=await element.boundingBox();
   assert.ok(rect,'Dialog visible '+modalKind);
   assert.ok(rect.x>=-1&&rect.x+rect.width<=width+1,
    modalKind+' must fit the horizontal '+width+'px viewport: '+JSON.stringify(rect));
   assert.ok(rect.y>=-1&&rect.y+rect.height<=height+1,
    modalKind+' must fit the vertical '+height+'px viewport: '+JSON.stringify(rect));
   const state=await element.evaluate(dlg=>{
    const r=dlg.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
    const hit=document.elementFromPoint(x,y);
    return {top:dlg===hit||dlg.contains(hit),open:dlg.open,
     scrollOverflow:document.documentElement.scrollWidth>innerWidth+1,
     cssPosition:getComputedStyle(dlg).position,zIndex:getComputedStyle(dlg).zIndex};
   });
   assert.ok(state.top,'Actual pointer target must be inside the topmost modal: '+modalKind);
   assert.equal(state.open,true);
   assert.equal(state.scrollOverflow,false,'No horizontal scrolling behind '+modalKind);
   await page.screenshot({path:`${DIR}/admin-${name}-${modalKind}.png`,fullPage:false});
   await page.keyboard.press('Escape');
   assert.equal(await element.evaluate(dlg=>dlg.open),false,
    'Escape closes '+modalKind+' without leaving an overlay');
   await element.evaluate(dlg=>dlg.remove());
   checks++;
  }
  const columns=await page.locator('.stage-editor .list').evaluate(el=>{
   const style=getComputedStyle(el);
   return {display:style.display,
    columns:style.gridTemplateColumns.split(' ').filter(Boolean).length};
  });
  assert.equal(columns.display,'grid');
  assert.equal(columns.columns,2,'stage local overrides retain the two-column page listing');
  await page.setContent(`<!doctype html><html lang="fr"><head>
   <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
   </head><body><nav class="site-menu-bar">Accueil · Célébrations · Médiathèque générale</nav>
   <main class="site-paper"><div class="trial-content-section" data-layout="columns">
    <div class="trial-content-columns">
     <div class="trial-content-column"><h2 class="trial-heading">Titre</h2>
      <p class="trial-paragraph">Texte de colonne gauche</p></div>
     <div class="trial-content-column"><figure class="trial-figure">Image fictive</figure>
      <div class="trial-video"><button class="trial-video-trigger">Vidéo</button>
       <div class="trial-video-title">Titre sous la miniature</div></div></div>
    </div></div>
    <hr class="trial-custom-divider"></main></body></html>`);
  await page.addStyleTag({content:TRIAL_SITE_STYLE});
  const geometry=await page.evaluate(()=>{
   const container=document.querySelector('.trial-content-columns');
   const cols=[...container.children].map(el=>{const r=el.getBoundingClientRect();
    return {x:r.x,y:r.y,width:r.width,height:r.height}});
   const style=getComputedStyle(container);
   const paper=document.querySelector('.site-paper').getBoundingClientRect();
   const title=document.querySelector('.trial-video-title');
   return {cols,gridTemplate:style.gridTemplateColumns,
    paper:{x:paper.x,width:paper.width},
    titleSize:getComputedStyle(title).fontSize,
    titleIsBelow: title.getBoundingClientRect().top>=
     document.querySelector('.trial-video-trigger').getBoundingClientRect().bottom,
    scrollOverflow:document.documentElement.scrollWidth>innerWidth+1};
  });
  assert.equal(geometry.cols.length,2);
  if(mobile){
   assert.ok(geometry.cols[1].y>geometry.cols[0].y+5,
    'At 390px the two columns must be stacked vertically');
  }else{
   assert.ok(Math.abs(geometry.cols[1].y-geometry.cols[0].y)<4,
    'At 1280px the two columns remain side by side');
  }
  assert.equal(geometry.titleSize,'14px');
  assert.equal(geometry.titleIsBelow,true);
  assert.equal(geometry.scrollOverflow,false);
  await page.screenshot({path:`${DIR}/visiteurs-${name}.png`,fullPage:false});
  console.log('M13_CSS_BROWSER_PASS '+JSON.stringify({name,width,height,dialogs:3,
   grid:geometry.gridTemplate,titleSize:geometry.titleSize,
   stacked:mobile,overflow:false}));
  checks++;
  await context.close();
 }
}finally{await browser.close()}
assert.equal(checks,8);
