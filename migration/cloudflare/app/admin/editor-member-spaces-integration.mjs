// M011-C — the existing admin panel mounts the existing M007-B/M010-B directory.
// Space preparation uses M005 inside a disposable editor draft; no new dashboard,
// storage API, private routes, publication, migrations or real member fixtures.
import {adminDialog} from './admin-dialog.mjs';
import {mountMemberDirectoryAdmin} from './member-directory-admin-integration.mjs';
import {createSpacesDraftWorkspace} from './editor-spaces-draft.mjs';
import {ACCESS_MODES,SPACE_VISIBILITIES} from '../domain/member-access.mjs';

export function mountExistingEditorMemberSpaces(root,{
  transport,privateTransport,isConnected=()=>false,celebrations=[],currentCelebrationId=null,allocateId,styleNonce,canDuplicate=()=>true,onEditPage,onCategories=()=>{}
}={}) {
  if(!root?.ownerDocument||typeof root.replaceChildren!=='function' ||
     typeof transport!=='function')throw new TypeError('Existing editor root and admin transport required');
  const doc=root.ownerDocument;
  const node=(tag,text)=>{
    const el=doc.createElement(tag);
    if(text!==undefined)el.textContent=text;
    return el;
  };
  const button=(text)=>{const el=node('button',text);el.type='button';el.className='btn';return el;};
  const label=(text,control)=>{control.setAttribute('aria-label',text);const el=node('label');el.className='field';
    el.append(node('span',text),control);return el;};
  const field=(type,placeholder='',maxLength=120)=>{
    const el=node('input');el.type=type;el.placeholder=placeholder;el.maxLength=maxLength;return el;};
  const clone=items=>JSON.parse(JSON.stringify(items));
  const selected=()=>currentCelebrationId!=null &&
    workspace.list().some(x=>String(x.id)===String(currentCelebrationId))
    ? String(currentCelebrationId):String(workspace.list()[0]?.id??'');
  const canonical=typeof privateTransport==='function';
  const catalogue=clone(celebrations).map(({id,archangel,year})=>({id,archangel,year}));
  const newWorkspace=items=>createSpacesDraftWorkspace(clone(items),allocateId?{allocateId}:{});
  let workspace=newWorkspace(canonical?catalogue:celebrations);
  let snapshot=null,busy=false,needsReload=false,epoch=0;
  const ready=()=>canonical&&isConnected()&&snapshot!==null&&!needsReload&&!busy;
  let celebrationId=selected(),memberMount=null,destroyed=false,memberTypes=[];
  const activeTypes=()=>memberTypes.filter(t=>t.disabled!==true&&t.disabled!==1);
  function accessChoice(policy,visibility){
    if(visibility===SPACE_VISIBILITIES.PUBLIC)return 'PUBLIC';
    if(policy?.mode===ACCESS_MODES.SELECTED_TYPES)
      return policy.typeIds?.length===1?'CATEGORY:'+policy.typeIds[0]:'MULTI';
    return 'REGISTERED';
  }
  function pagePolicyChoice(policy){
    if(policy?.mode===ACCESS_MODES.SELECTED_TYPES)
      return policy.typeIds?.length===1?'CATEGORY:'+policy.typeIds[0]:'MULTI';
    return policy?.mode===ACCESS_MODES.ALL_PRIVATE_TYPES?'REGISTERED':'PUBLIC';
  }
  function selectedTypeIds(choices,previous){
    const ids=[...new Set(choices??previous?.typeIds??[])];
    if(!ids.length)throw Error('Sélectionnez au moins une catégorie');
    if(ids.some(id=>!activeTypes().some(type=>type.id===id)&&!(previous?.typeIds||[]).includes(id)))
      throw Error('Catégorie inconnue ou désactivée');
    return ids;
  }
  function categoryChecks(previous){
    const area=node('fieldset');area.className='member-spaces-category-checks';
    area.append(node('legend','Catégories sélectionnées (choix multiples)'));
    const selected=new Set(previous?.typeIds||[]),inputs=[];
    for(const type of memberTypes){
      const entry=node('label'),check=node('input');
      check.type='checkbox';check.value=type.id;check.checked=selected.has(type.id);
      check.disabled=type.disabled===true||type.disabled===1;
      entry.append(check,doc.createTextNode(' '+type.name+(check.disabled?' (désactivée)':'')));
      area.append(entry);inputs.push(check);
    }
    return {area,
      selected:()=>inputs.filter(x=>x.checked).map(x=>x.value),
      attach:select=>{
        const toggle=()=>{area.hidden=select.value!=='MULTI';};
        select.addEventListener('change',toggle);toggle();
      }};
  }
  function pagePolicyFromChoice(value,previous,choices){
    if(value==='PUBLIC')return {mode:ACCESS_MODES.PUBLIC};
    if(value==='REGISTERED')return {mode:ACCESS_MODES.ALL_PRIVATE_TYPES};
    if(value==='MULTI')
      return {mode:ACCESS_MODES.SELECTED_TYPES,typeIds:selectedTypeIds(choices,previous)};
    if(value.startsWith('CATEGORY:')){
      const typeId=value.slice(9);
      if(!activeTypes().some(t=>t.id===typeId))throw Error('Catégorie inconnue');
      return {mode:ACCESS_MODES.SELECTED_TYPES,typeIds:[typeId]};
    }
    throw Error('Visibilité inconnue');
  }
  function pagePolicyOptions(previous){
    const select=node('select'),current=pagePolicyChoice(previous);
    const options=[['PUBLIC','Public'],['REGISTERED','Privé — Tous les inscrits']];
    options.push(['MULTI','Privé — catégories sélectionnées']);
    if(current.startsWith('CATEGORY:')&&!activeTypes().some(t=>t.id===current.slice(9)))
      options.push([current,'Privé — catégorie existante conservée']);
    options.push(...activeTypes().map(t=>['CATEGORY:'+t.id,'Privé — '+t.name]));
    for(const [key,title] of options){
      const option=node('option',title);option.value=key;option.selected=key===current;select.append(option);
    }
    return select;
  }
  function accessPolicyFromChoice(value,previous,choices){
    if(value==='MULTI')
      return {visibility:SPACE_VISIBILITIES.PRIVATE,
        mode:ACCESS_MODES.SELECTED_TYPES,typeIds:selectedTypeIds(choices,previous)};

    if(value==='PUBLIC')return {visibility:SPACE_VISIBILITIES.PUBLIC,
      mode:ACCESS_MODES.PUBLIC,typeIds:[]};
    if(value==='REGISTERED')return {visibility:SPACE_VISIBILITIES.PRIVATE,
      mode:ACCESS_MODES.PUBLIC,typeIds:[]};
    if(value.startsWith('CATEGORY:')){
      const typeId=value.slice(9);
      if(!activeTypes().some(t=>t.id===typeId))throw Error('Catégorie inconnue');
      return {visibility:SPACE_VISIBILITIES.PRIVATE,
        mode:ACCESS_MODES.SELECTED_TYPES,typeIds:[typeId]};
    }
    throw Error('Visibilité inconnue');
  }
  function accessOptions({policy,visibility}){
    const select=node('select');
    const value=accessChoice(policy,visibility);
    const options=[['PUBLIC','Public'],['REGISTERED','Privé — Tous les inscrits']];
    options.push(['MULTI','Privé — catégories sélectionnées']);
    if(value.startsWith('CATEGORY:')&&!activeTypes().some(t=>t.id===value.slice(9)))
      options.push([value,'Privé — catégorie existante conservée']);
    options.push(...activeTypes().map(t=>['CATEGORY:'+t.id,'Privé — '+t.name]));
    for(const [key,title] of options){
      const option=node('option',title);option.value=key;option.selected=key===value;
      select.append(option);
    }
    return select;
  }
  async function reloadCategoryNames(){
    if(!isConnected())return;
    const raw=await transport({method:'GET',action:'snapshot',limit:1});
    if(!raw?.ok)throw Error(raw?.error||'Catégories indisponibles');
    const loaded=raw.data??raw.result??raw;
    if(!Array.isArray(loaded.types))throw Error('Types non confirmés');
    memberTypes=loaded.types;
  }
  const container=node('section');container.className='admin-member-spaces-011c';
  const header=node('div');header.className='admin-view-head';
  header.append(node('h1','Membres'));
  const tabs=node('div');tabs.className='member-spaces-tabs';
  const peopleTab=button('Membres');
  const spacesTab=button('Versions des célébrations');
  peopleTab.setAttribute('aria-controls','member-spaces-directory');
  spacesTab.setAttribute('aria-controls','member-spaces-workspace');
  tabs.append(peopleTab,spacesTab);
  const warning=node('p',canonical?'Les droits sont vérifiés à chaque consultation.':'Les espaces se préparent ici sans sauvegarde. '+
    'La publication et les politiques de pages restent désactivées tant que '+
    'leur écriture sécurisée côté serveur n’est pas raccordée.');
  warning.className='notice';warning.setAttribute('role','note');
  const directory=node('section');directory.id='member-spaces-directory';
  const spaces=node('section');spaces.id='member-spaces-workspace';spaces.hidden=true;
  container.append(header,tabs,warning,directory,spaces);
  root.replaceChildren(container);
  // Mount only once: the existing M007-B component owns type/member changes.
  function refreshMembers(){
    if(destroyed)return;
    memberMount?.destroy();
    memberMount=mountMemberDirectoryAdmin(directory,{transport,styleNonce,celebrations,onCategories});
  }
  refreshMembers();
  function activate(showSpaces) {
    if(destroyed)return;
    directory.hidden=showSpaces;spaces.hidden=!showSpaces;
    peopleTab.classList.toggle('primary',!showSpaces);
    spacesTab.classList.toggle('primary',showSpaces);
    peopleTab.setAttribute('aria-pressed',String(!showSpaces));
    spacesTab.setAttribute('aria-pressed',String(showSpaces));
    if(showSpaces){
      renderSpaces();
      if(canonical&&isConnected()){
        void reloadCategoryNames().then(()=>{if(!destroyed&&!spaces.hidden)renderSpaces();})
          .catch(e=>{if(!destroyed&&!spaces.hidden)renderSpaces('Catégories : '+e.message)});
        if(!snapshot&&!busy&&!needsReload)void loadCanonical();
      }
    }
  }
  peopleTab.addEventListener('click',()=>activate(false));
  spacesTab.addEventListener('click',()=>activate(true));

  function applySnapshot(result){
    if(!result?.ok||!Number.isSafeInteger(result.revision)||!result.record||!Array.isArray(result.record.spaces??[]))
      throw Error('Réponse canonique non confirmée');
    if(!catalogue.some(c=>String(c.id)===celebrationId))throw Error('Célébration inconnue');
    workspace=newWorkspace(catalogue.map(c=>String(c.id)===celebrationId?{...c,spaces:result.record.spaces??[]}:c));
    snapshot=result;needsReload=false;
  }
  async function loadCanonical(){
    if(!canonical||!isConnected()||busy||!celebrationId)return;
    if(workspace.changed&&!await adminDialog(doc,{title:'Recharger',message:'Abandonner les modifications non enregistrées ?'}))return;
    const attempt=++epoch;busy=true;renderSpaces('Chargement canonique…');
    let message,loaded=null;
    try{
      const result=await privateTransport({method:'GET',celebration:celebrationId});
      if(attempt!==epoch)return;
      if(!result.ok)throw Error(result.error||'Chargement refusé');
      applySnapshot(result);loaded=snapshot;
      message='Contenus chargés.';
    }catch(e){if(attempt!==epoch)return;needsReload=true;message='Chargement impossible : '+e.message;}
    finally{if(attempt===epoch){busy=false;renderSpaces(message);}}
    return loaded;
  }
  async function mutate(action,fields={}){
    if(!ready())return;
    const attempt=++epoch;busy=true;renderSpaces('Commande serveur en cours…');
    let message,outcome={ok:false,error:'Commande interrompue'};
    try{
      const result=await privateTransport({method:'POST',action,celebration:celebrationId,expectedRevision:snapshot.revision,...fields});
      if(attempt!==epoch)return;
      if(!result.ok){
        needsReload=true;
        throw Error((result.saved?'Le brouillon est enregistré, mais la publication n’est pas confirmée. ':'')+(result.error||'Commande refusée')+' — Rechargez avant toute nouvelle tentative.');
      }
      applySnapshot(result);outcome=result;
      message=action==='save'?'Brouillon enregistré.':
        'Modification enregistrée.';
    }catch(e){if(attempt!==epoch)return;needsReload=true;message='Commande non confirmée : '+e.message;outcome={ok:false,error:e.message};}
    finally{if(attempt===epoch){busy=false;renderSpaces(message);}}
    return outcome;
  }

  // The visual editor owns the block controls. This adapter only exposes the
  // already-authorized canonical R2 command, with server revision arbitration.
  function openCanonicalPage(spaceId,pageId,languageId='fr') {
    if(!ready()||workspace.changed||typeof onEditPage!=='function')return;
    const cid=celebrationId;
    const find=()=>workspace.spaces(cid).find(s=>s.id===spaceId)?.pages.find(p=>p.id===pageId);
    const page=find();
    if(!page||page.id.startsWith('draft-page:'))return;
    if(languageId!=='fr'&&!snapshot?.languageRegistry?.languages?.some(x=>x.id===languageId))
      throw Error('Langue non créée par l’administrateur');
    // The existing visual block editor handles each manually authored variant.
    // Never copy French blocks into a missing language variant.
    const localized=canonical=>{
      const copy={...clone(canonical),group:canonical.group||'celebration'};
      if(languageId==='fr')return copy;
      const content=copy.translations?.[languageId];
      return {...copy,name:content?.name??'Titre à rédiger',
        blocks:clone(content?.blocks??[])};
    };
    const check=()=>{
      if(destroyed||cid!==celebrationId||!ready()||workspace.changed||!find())
        throw Error('Session ou révision indisponible : rechargez les espaces.');
    };
    const command=async(action,fields)=>{
      check();
      const result=await mutate(action,fields);
      if(!result?.ok)throw Error(result?.error||'Commande canonique non confirmée');
      return clone(find());
    };
    onEditPage({
      languageId,
      page:localized(page),
      save:async({name,blocks})=>{
        check();
        if(typeof name!=='string'||!name.trim()||!Array.isArray(blocks))
          throw Error('Page ou blocs invalides');
        const spaces=workspace.spaces(cid);
        const space=spaces.find(s=>s.id===spaceId);
        const position=space?.pages.findIndex(p=>p.id===pageId);
        if(position<0||position===undefined)throw Error('Page inconnue');
        // Replace only the canonical page content, never its identity or ACL.
        const original=space.pages[position];
        if(languageId==='fr'){
          space.pages[position]={...original,name:name.trim(),blocks:clone(blocks)};
        }else{
          space.pages[position]={...original,translations:{
            ...(original.translations||{}),[languageId]:{name:name.trim(),blocks:clone(blocks)}
          }};
        }
        await command('save',{spaces});
        return localized(find());
      },
      reload:async()=>{
        if(!isConnected()||cid!==celebrationId)throw Error('Session expirée');
        const result=await loadCanonical();
        if(!result||!find())throw Error('Rechargement impossible');
        return localized(find());
      },
      publish:()=>command('publish',{kind:'page',id:pageId,spaceId}),
      unpublish:()=>command('unpublish',{kind:'page',id:pageId,spaceId}),
      isPublished:()=>!!snapshot?.pageReleases?.some(x=>x.pageId===pageId)
    });
  }
  function sessionChanged(active){
    if(!canonical)return;
    ++epoch;busy=false;needsReload=false;snapshot=null;workspace=newWorkspace(catalogue);
    if(!spaces.hidden){renderSpaces();if(active)void loadCanonical();}
    else spaces.replaceChildren();
  }
  async function createVersion(source=null,sourceLanguage='fr',categoryId='',pageTitle=''){
    if(!ready())return;
    const languages=snapshot.languageRegistry.languages;
    const currentSpace=source?workspace.spaces(celebrationId).find(s=>s.pages.some(p=>p.id===source.id)):null;
    const fields=[{name:'title',label:'Titre de la page',value:source?.name||pageTitle,required:true,maxLength:160},
      {name:'category',label:'Catégorie',value:categoryId,options:[['','Tous les inscrits'],...activeTypes().map(t=>[t.id,t.name])]},
      {name:'language',label:'Langue',options:languages.map(l=>[l.id,l.name]),value:sourceLanguage}];
    if(source){
      const options=[];
      for(const s of workspace.spaces(celebrationId))for(const p of s.pages){
        options.push([p.id+'|fr',s.name+' — '+p.name+' — Français']);
        for(const [id,version]of Object.entries(p.translations||{}))options.push([p.id+'|'+id,s.name+' — '+version.name+' — '+(languages.find(l=>l.id===id)?.name||id)]);
      }
      fields.unshift({name:'source',label:'Version à copier',value:source.id+'|'+sourceLanguage,options});
    }
    const answer=await adminDialog(doc,{title:source?'Dupliquer en brouillon':'Ajouter une version',fields,confirm:'Créer le brouillon'});
    if(!answer)return;
    try{
      let target=workspace.spaces(celebrationId).find(s=>
        answer.category?s.accessPolicy.mode===ACCESS_MODES.SELECTED_TYPES&&s.accessPolicy.typeIds?.length===1&&s.accessPolicy.typeIds[0]===answer.category:
        s.visibility===SPACE_VISIBILITIES.PRIVATE&&s.accessPolicy.mode===ACCESS_MODES.PUBLIC);
      if(!target){
        workspace.addSpace(celebrationId,{name:activeTypes().find(t=>t.id===answer.category)?.name||'Tous les inscrits',
          visibility:SPACE_VISIBILITIES.PRIVATE,mode:answer.category?ACCESS_MODES.SELECTED_TYPES:ACCESS_MODES.PUBLIC,
          typeIds:answer.category?[answer.category]:[],accessScope:'CELEBRATION'});
        target=workspace.spaces(celebrationId).at(-1);
      }
      // Copies contain content only. Category is the administrator's explicit
      // target selection; people, enrollment and release ledgers are untouched.
      let content;
      if(answer.source){const [pid,lang]=answer.source.split('|');const page=workspace.spaces(celebrationId).flatMap(s=>s.pages).find(p=>p.id===pid);content=lang==='fr'?page:page?.translations?.[lang];}
      const next=workspace.spaces(celebrationId);
      const targetSpace=next.find(s=>s.id===target.id);
      let page=targetSpace.pages.find(p=>p.name===answer.title);
      if(page&&(answer.language==='fr'||page.translations?.[answer.language]))
        throw Error('Cette version existe déjà. Choisissez un autre titre ou une autre langue.');
      if(!page){page={id:'draft-page:'+crypto.randomUUID(),name:answer.title,blocks:[],accessPolicy:{mode:ACCESS_MODES.PUBLIC}};targetSpace.pages.push(page)}
      if(answer.language==='fr')page.blocks=clone(content?.blocks||[]);
      else page.translations={...page.translations,[answer.language]:{name:answer.title,blocks:clone(content?.blocks||[])}};
      const result=await mutate('save',{spaces:next});
      if(!result?.ok)return;
      const saved=snapshot.record.spaces.find(s=>s.name===targetSpace.name)?.pages.find(p=>p.name===answer.title);
      if(saved)openCanonicalPage(snapshot.record.spaces.find(s=>s.pages.some(p=>p.id===saved.id)).id,saved.id,answer.language);
    }catch(e){renderSpaces(e.message)}
  }
  function renderSpaces(message=''){
    if(destroyed)return;
    spaces.replaceChildren();
    const status=node('p',message);status.setAttribute('role','status');spaces.append(status);
    const choice=node('select');choice.setAttribute('aria-label','Célébration');
    for(const c of workspace.list()){const o=node('option',c.title||[c.archangel,c.year].filter(Boolean).join(' '));o.value=String(c.id);choice.append(o)}
    choice.value=celebrationId;choice.disabled=busy;
    choice.onchange=()=>{celebrationId=choice.value;snapshot=null;needsReload=false;workspace=newWorkspace(catalogue);renderSpaces();void loadCanonical()};
    spaces.append(label('Célébration',choice));
    if(!snapshot){
      spaces.append(node('p',isConnected()?'Chargement des versions…':'Connectez-vous pour consulter les versions.'));
      return;
    }
    const add=button('＋ Ajouter une version');add.disabled=!ready();add.onclick=()=>void createVersion();spaces.append(add);
    const source=workspace.spaces(celebrationId).flatMap(s=>s.pages)[0];
    if(source){const duplicate=button('Dupliquer en brouillon');duplicate.disabled=!ready();duplicate.onclick=()=>void createVersion(source);spaces.append(duplicate);}
    if(!snapshot.privateReleaseReady&&snapshot.pageReleases.length){
      spaces.append(node('p','La publication doit encore être confirmée avant de donner accès aux membres.'));
      const retry=button('Terminer la publication');retry.onclick=()=>void mutate('reconcile');spaces.append(retry);
    }
    if(needsReload){const retry=button('Recharger');retry.onclick=()=>void loadCanonical();spaces.append(retry)}
    for(const space of workspace.spaces(celebrationId)){
      const card=node('section');card.className='card member-spaces-card';card.append(node('h3',space.name));
      for(const page of space.pages){
        const langs=snapshot.languageRegistry.languages.filter(l=>l.id==='fr'?(page.blocks.length>0||!Object.keys(page.translations||{}).length):!!page.translations?.[l.id]);
        for(const lang of langs){
          const released=snapshot.pageReleases.some(p=>p.pageId===page.id);
          const row=node('div');row.className='member-spaces-version';
          const name=lang.id==='fr'?page.name:page.translations[lang.id].name;
          const open=button(name+' — '+lang.name+' · '+(released?'Publiée':'Brouillon'));
          open.onclick=()=>openCanonicalPage(space.id,page.id,lang.id);open.disabled=!ready();row.append(open);

          const release=button(released?'Dépublier':'Publier');release.disabled=!ready();
          release.onclick=async()=>{
            if(!await adminDialog(doc,{title:released?'Dépublier la page':'Publier la page',message:released?'Retirer cette page et ses versions du site ?':'Publier les versions rédigées de cette page ?',confirm:released?'Dépublier':'Publier'}))return;
            if(released){await mutate('unpublish',{kind:'page',id:page.id,spaceId:space.id});return}
            if(snapshot.celebrationVisibility!=='published'){renderSpaces('Publiez d’abord la célébration depuis Célébrations.');return}
            if(!snapshot.spaceReleases.some(s=>s.spaceId===space.id)){
              const r=await mutate('publish',{kind:'space',id:space.id});if(!r?.ok)return;
            }
            await mutate('publish',{kind:'page',id:page.id,spaceId:space.id});
          };
          row.append(release);card.append(row);
        }
      }
      spaces.append(card);
    }
    if(!workspace.spaces(celebrationId).length)spaces.append(node('p','Aucune version par catégorie. Les pages générales restent dans l’éditeur.'));
  }
  activate(false);
  return {
    getDraft:()=>workspace.list(),
    refreshMembers,sessionChanged,
    get changed(){return workspace.changed;},
    showSpaces(){activate(true);},
    async openVersion(typeId,languageId='fr',title=''){
      directory.hidden=true;spaces.hidden=false;await reloadCategoryNames();await loadCanonical();
      const space=workspace.spaces(celebrationId).find(s=>typeId?
        s.accessPolicy.typeIds?.includes(typeId):s.accessPolicy.mode===ACCESS_MODES.PUBLIC);
      const page=space?.pages.find(p=>p.name===title)||space?.pages[0];
      if(page)openCanonicalPage(space.id,page.id,languageId);
      else await createVersion(null,languageId,typeId,title);
    },
    showMembers(){activate(false);container.classList.remove('m019-category-mode');},
    showCategories(){activate(false);container.classList.add('m019-category-mode');},
    destroy(){destroyed=true;++epoch;memberMount?.destroy();root.replaceChildren();}
  };
}
