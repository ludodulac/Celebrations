import test from 'node:test';
import assert from 'node:assert/strict';
import {projectPublicPage} from '../migration/cloudflare/app/domain/editor-public-projection-security.mjs';
import {TRIAL_SITE_CLIENT,TRIAL_SITE_STYLE} from '../migration/cloudflare/editor-trial-site-client.mjs';
import {Script} from 'node:vm';
const page=margins=>({id:'neutral-accueil-general',group:'page',visibility:'published',blocks:[{id:1,kind:'section',layout:'columns',columnTopMargins:margins,columns:[[{id:2,kind:'text',text:'Visible'}],[]]}]});
test('column margins survive anonymous projection with bounds and two columns only',()=>{
 assert.deepEqual(projectPublicPage(page(['21.8',900,55])).blocks[0].columnTopMargins,[22,500]);
 assert.deepEqual(projectPublicPage(page([-15,'invalid'])).blocks[0].columnTopMargins,[0,0]);
 assert.equal(projectPublicPage({...page([20,40]),private:true}),null);
});
test('recovered visitor document renderer parses and retains desktop column rules',()=>{
 new Script(TRIAL_SITE_CLIENT);
 assert.ok(TRIAL_SITE_CLIENT.includes("card.append(title,actions,locationLabel)"));
 assert.ok(TRIAL_SITE_CLIENT.includes("const marker='Ouvrir le PDF'"));
 assert.ok(TRIAL_SITE_STYLE.includes('padding-top:var(--column-desktop-top,0px)'));
 assert.ok(TRIAL_SITE_STYLE.includes('@media(min-width:681px)'));
});
