// M011-C: local Chromium on 1440/390/320, synthetic member API only.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';

const root=process.cwd(),secret='fake-local-admin-token',requests=[];
const people=Array.from({length:126},(_,i)=>({
 id:'person:550e8400-e29b-41d4-a716-'+String(i+1).padStart(12,'0'),
 name:i===125?'Camille Extrême':'Personne '+String(i).padStart(3,'0'),
 emailNormalized:'person'+String(i).padStart(3,'0')+'@example.test',revision:0
}));
const types=[{id:'member-type:choir',name:'Chorale',revision:0,disabled:false}];
const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/migration/cloudflare/app/admin/editor-member-spaces.css"></head>
<body class="admin-app">
<nav><button data-admin="home">Accueil</button>
<button data-admin="celebrations">Programme</button>
<button data-admin="media">Bibliothèque</button>
<button data-admin="members-spaces">Membres et espaces</button></nav>
<main id="panel">Ancien éditeur</main>
<script>
const panel=document.getElementById('panel');
const state={adminCelebrationId:41,celebrations:[{
  id:41,archangel:'Gabriel',year:'2026',
  days:[{key:'1',label:'Ouverture',text:'Ne pas effacer ce texte'}],
  spaces:[]
}]};
window.demoState=state;
window.celebrationsAdminReady=Promise.resolve(true);
window.getCelebrationsAdminToken=()=> 'fake-local-admin-token';
let setTab=function(tab){
  panel.textContent='Ancienne interface : '+tab;
  document.querySelectorAll('[data-admin]').forEach(b=>
    b.classList.toggle('active',b.dataset.admin===tab));
};
document.querySelectorAll('[data-admin]').forEach(b=>
  b.addEventListener('click',()=>setTab(b.dataset.admin)));
setTab('home');
</script>
<script src="/tests/fixtures/m011c-legacy-member-bridge.js"></script>
</body></html>`;
const mime={'.mjs':'text/javascript','.js':'text/javascript','.css':'text/css'};
const server=createServer(async(req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1');
  if(u.pathname==='/'){
    res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);return;
  }
  if(u.pathname==='/api/admin/member-directory'){
    if(req.headers.authorization!=='Bearer '+secret){
      res.writeHead(401,{'content-type':'application/json'});
      res.end(JSON.stringify({ok:false,error:'Admin required'}));return;
    }
    const action=u.searchParams.get('action');
    requests.push({action,method:req.method});
    let data;
    if(req.method==='GET'&&action==='snapshot'){
      const search=(u.searchParams.get('search')||'').toLowerCase();
      const cursor=u.searchParams.get('cursor')||'';
      const filtered=[...people].sort((a,b)=>a.emailNormalized.localeCompare(b.emailNormalized))
        .filter(p=>p.emailNormalized>cursor)
        .filter(p=>[p.name,p.emailNormalized].some(s=>s.toLowerCase().includes(search)));
      const page=filtered.slice(0,50);
      data={members:page,types,memberships:[],pages:[],spaces:[],enrollments:[],
        hasMorePeople:filtered.length>50,
        nextCursor:filtered.length>50?page.at(-1).emailNormalized:null};
    }else if(req.method==='GET'&&action==='person_detail'){
      const p=people.find(p=>p.id===u.searchParams.get('personId'));
      data={person:{...p,givenName:'Camille'},types:[],celebrations:[],enrollments:[]};
    }else if(req.method==='GET'&&action==='pending_claims'){
      data=[];
    }else if(req.method==='POST'){
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      requests.push({body});data={id:'local-only'};
    }else{res.writeHead(400).end();return;}
    res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
    res.end(JSON.stringify({ok:true,data}));return;
  }
  const path=resolve(root,'.'+decodeURIComponent(u.pathname));
  if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}
  try{res.setHeader('content-type',mime[extname(path)]||'text/plain');
    res.end(await readFile(path));}catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
  browser=await chromium.launch({headless:true});
  for(const width of [1440,390,320]) {
    const page=await browser.newPage({viewport:{width,height:860},
      isMobile:width<500,hasTouch:width<500});
    const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.getByRole('button',{name:'Membres et espaces'}).click();
    await page.getByRole('heading',{name:'Annuaire et droits des membres'}).waitFor();
    await page.getByText('Page 1 · 50 personnes affichées').waitFor();
    assert.equal(await page.getByRole('heading',{
      name:'Types de membres et autorisations'}).count(),1);
    await page.getByRole('button',{name:'Page suivante'}).click();
    await page.getByText('Page 2 · 50 personnes affichées').waitFor();
    await page.getByRole('button',{name:'Page précédente'}).click();
    await page.getByText('Page 1 · 50 personnes affichées').waitFor();
    await page.getByRole('searchbox',{name:'Rechercher une personne'}).fill('Camille');
    await page.getByRole('button',{name:'Rechercher'}).click();
    await page.getByText('Page 1 · 1 personnes affichées').waitFor();
    await page.getByRole('button',{name:'Espaces des célébrations'}).click();
    assert.equal(await page.getByRole('button',{name:'Enregistrer les espaces'}).isDisabled(),true);
    assert.equal(await page.getByRole('button',{name:'Publier / appliquer les droits'}).isDisabled(),true);
    await page.getByPlaceholder('Nom de l’espace').fill('Salle des participants');
    await page.getByRole('button',{name:'Créer dans le brouillon'}).click();
    await page.getByRole('heading',{name:'Salle des participants'}).waitFor();
    await page.getByPlaceholder('Titre de la nouvelle page').fill('Document d’accueil');
    await page.getByRole('button',{name:'Préparer une page'}).click();
    await page.getByText('Document d’accueil — brouillon / contenu et langues conservés').waitFor();
    await page.getByRole('button',{name:'Annuler la modification'}).click();
    assert.equal(await page.getByText('Document d’accueil — brouillon / contenu et langues conservés').count(),0);
    await page.getByRole('button',{name:'Rétablir'}).click();
    await page.getByText('Document d’accueil — brouillon / contenu et langues conservés').waitFor();
    await page.getByRole('button',{name:'Dupliquer en brouillon'}).click();
    await page.getByText(/Copie locale indépendante/).waitFor();
    const original=await page.evaluate(()=>window.demoState.celebrations[0]);
    assert.equal(original.days[0].text,'Ne pas effacer ce texte');
    assert.deepEqual(original.spaces,[]);
    await page.getByRole('button',{name:'Accueil'}).click();
    await page.getByText('Ancienne interface : home').waitFor();
    await page.getByRole('button',{name:'Membres et espaces'}).click();
    await page.getByRole('heading',{name:'Annuaire et droits des membres'}).waitFor();
    const overflow=await page.evaluate(()=>
      document.documentElement.scrollWidth-document.documentElement.clientWidth);
    assert.ok(overflow<=1,'horizontal overflow at '+width+': '+overflow);
    assert.deepEqual(pageErrors,[],'browser error at '+width);
    await page.close();
  }
  assert.equal(requests.some(r=>r.method==='POST'),false);
  console.log('M011C_BROWSER_EXISTING_EDITOR_1440_390_320_OK');
}finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
