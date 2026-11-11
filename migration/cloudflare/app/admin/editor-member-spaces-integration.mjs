// M011-C — the existing admin panel mounts the existing M007-B/M010-B directory.
// Space preparation uses M005 inside a disposable editor draft; no new dashboard,
// storage API, private routes, publication, migrations or real member fixtures.
import {mountMemberDirectoryAdmin} from './member-directory-admin-integration.mjs';
import {createSpacesDraftWorkspace} from './editor-spaces-draft.mjs';
import {ACCESS_MODES,SPACE_VISIBILITIES} from '../domain/member-access.mjs';

export function mountExistingEditorMemberSpaces(root,{
  transport,privateTransport,isConnected=()=>false,celebrations=[],currentCelebrationId=null,allocateId,styleNonce,canDuplicate=()=>true,onEditPage
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
  const label=(text,control)=>{const el=node('label');el.className='field';
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
  function pagePolicyFromChoice(value,previous){
    if(value==='PUBLIC')return {mode:ACCESS_MODES.PUBLIC};
    if(value==='REGISTERED')return {mode:ACCESS_MODES.ALL_PRIVATE_TYPES};
    if(value==='MULTI'&&previous?.mode===ACCESS_MODES.SELECTED_TYPES)
      return {mode:ACCESS_MODES.SELECTED_TYPES,typeIds:[...previous.typeIds]};
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
    if(current==='MULTI')options.push(['MULTI',
      'Privé — '+(previous.typeIds||[]).map(id=>memberTypes.find(t=>t.id===id)?.name||'Catégorie conservée').join(' + ')]);
    if(current.startsWith('CATEGORY:')&&!activeTypes().some(t=>t.id===current.slice(9)))
      options.push([current,'Privé — catégorie existante conservée']);
    options.push(...activeTypes().map(t=>['CATEGORY:'+t.id,'Privé — '+t.name]));
    for(const [key,title] of options){
      const option=node('option',title);option.value=key;option.selected=key===current;select.append(option);
    }
    return select;
  }
  function accessPolicyFromChoice(value,previous){
    if(value==='MULTI'&&previous?.mode===ACCESS_MODES.SELECTED_TYPES)
      return {visibility:SPACE_VISIBILITIES.PRIVATE,
        mode:ACCESS_MODES.SELECTED_TYPES,typeIds:[...previous.typeIds]};

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
    if(value==='MULTI')options.push(['MULTI','Privé — '+(policy.typeIds||[])
      .map(id=>memberTypes.find(t=>t.id===id)?.name||'Catégorie conservée').join(' + ')]);
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
  header.append(node('h1','Membres et espaces'));
  const tabs=node('div');tabs.className='member-spaces-tabs';
  const peopleTab=button('Contacts et autorisations');
  const spacesTab=button('Espaces des célébrations');
  peopleTab.setAttribute('aria-controls','member-spaces-directory');
  spacesTab.setAttribute('aria-controls','member-spaces-workspace');
  tabs.append(peopleTab,spacesTab);
  const warning=node('p',canonical?'Écriture D1/R2 isolée : chargement serveur requis. Les accès privés du site officiel restent désactivés.':'Les espaces se préparent ici sans sauvegarde. '+
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
    memberMount=mountMemberDirectoryAdmin(directory,{transport,styleNonce});
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
    if(workspace.changed&&!doc.defaultView.confirm('Recharger depuis le serveur et abandonner les modifications locales ?'))return;
    const attempt=++epoch;busy=true;renderSpaces('Chargement canonique…');
    let message,loaded=null;
    try{
      const result=await privateTransport({method:'GET',celebration:celebrationId});
      if(attempt!==epoch)return;
      if(!result.ok)throw Error(result.error||'Chargement refusé');
      applySnapshot(result);loaded=snapshot;
      message='Espaces chargés depuis R2 — révision '+snapshot.revision+'.';
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
        throw Error((result.saved?'R2 a enregistré la commande ; confirmation D1 incomplète. ':'')+(result.error||'Commande refusée')+' — Rechargez avant toute nouvelle tentative.');
      }
      applySnapshot(result);outcome=result;
      message=action==='save'?'Brouillon enregistré, identifiants serveur et révision '+snapshot.revision+' confirmés.':
        'Commande confirmée — révision '+snapshot.revision+(snapshot.privateReleaseReady?' ; confirmation D1 obtenue.':' ; accès privé non confirmé.');
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
      const copy=clone(canonical);
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
  function renderSpaces(message='') {
    if(destroyed)return;
    spaces.replaceChildren();
    const note=node('p',canonical?'Les modifications restent locales jusqu’à confirmation du serveur. En cas de conflit, rechargez avant toute nouvelle écriture.':'Atelier de préparation local, non enregistré : fermeture de la page = perte des modifications. '+
      'Les identifiants de brouillon seront remplacés par des identifiants serveur. '+
      'Aucun accès privé et aucun média ne sont publiés.');
    note.className='member-spaces-disclaimer';spaces.append(note);
    const status=node('p',message|| (workspace.changed ?
      'Modifications locales non sauvegardées.':'Aucun changement local.'));
    status.setAttribute('role','status');status.className='member-spaces-status';
    const commands=node('div');commands.className='member-spaces-actions';
    const undo=button('Annuler la modification');
    undo.disabled=!workspace.canUndo;undo.addEventListener('click',()=>{
      workspace.undo();renderSpaces('Dernière modification annulée (mémoire uniquement).');
    });
    const redo=button('Rétablir');
    redo.disabled=!workspace.canRedo;redo.addEventListener('click',()=>{
      workspace.redo();renderSpaces('Modification rétablie (mémoire uniquement).');
    });
    const discard=button('Abandonner le brouillon');
    discard.disabled=!workspace.changed;
    discard.addEventListener('click',()=>{
      workspace.discard();if(!canonical)celebrationId=selected();
      renderSpaces('Brouillon abandonné. Les contenus existants sont inchangés.');
    });
    const save=button('Enregistrer les espaces');
    save.disabled=true;save.title='Écriture serveur des espaces non disponible';
    const publish=button('Publier / appliquer les droits');
    publish.disabled=true;publish.title='Publication privée et politiques de pages non raccordées';
    commands.append(undo,redo,discard,save,publish);
    if(canonical){
      const load=button('Recharger les espaces depuis le serveur');
      load.disabled=!isConnected()||busy;
      load.addEventListener('click',()=>void loadCanonical());
      commands.append(load);
      save.disabled=!ready()||!workspace.changed;
      save.title='Enregistrement canonique avec contrôle de révision';
      save.addEventListener('click',()=>void mutate('save',{spaces:workspace.spaces(celebrationId)}));
      publish.hidden=true;
      undo.disabled=busy||!workspace.canUndo;redo.disabled=busy||!workspace.canRedo;discard.disabled=busy||!workspace.changed;
      if(snapshot){
        commands.append(node('p','Révision '+snapshot.revision+' · célébration '+snapshot.celebrationVisibility+
          ' · '+(snapshot.privateReleaseReady?'confirmation D1 présente':'accès privé non confirmé')));
        const release=button('Publier la célébration (visibilité)');
        release.disabled=!ready()||workspace.changed||snapshot.celebrationVisibility==='published'||!snapshot.record.spaces?.length;
        release.addEventListener('click',()=>{if(doc.defaultView.confirm('Publier explicitement la visibilité de cette célébration dans cet environnement isolé ?'))void mutate('celebration-visibility',{visibility:'published'});});
        const reconcile=button('Réconcilier la confirmation D1');
        reconcile.disabled=!ready()||workspace.changed||snapshot.privateReleaseReady;
        reconcile.addEventListener('click',()=>void mutate('reconcile'));
        commands.append(release,reconcile);
        // One canonical celebration; category and language are content variants.
        const celebration=workspace.list().find(x=>String(x.id)===celebrationId);
        const michael=String(celebration?.archangel||'').normalize('NFD')
          .replace(/[\u0300-\u036f]/g,'').toLowerCase().includes('michael');
        const policyForm=node('form');policyForm.className='member-spaces-form';
        const overall=pagePolicyOptions(snapshot.celebrationAccessPolicy);
        overall.disabled=!ready()||workspace.changed||michael;
        const apply=button('Enregistrer la visibilité');apply.type='submit';
        apply.disabled=overall.disabled;
        policyForm.append(label('Célébration : Public ou Privé',overall),apply);
        if(michael)policyForm.append(node('p','Michaël reste public dans les langues préparées.'));
        policyForm.addEventListener('submit',event=>{
          event.preventDefault();if(!ready()||workspace.changed||michael)return;
          try{
            const accessPolicy=pagePolicyFromChoice(overall.value,snapshot.celebrationAccessPolicy);
            void mutate('celebration-access',{accessPolicy});
          }catch(e){renderSpaces('Visibilité refusée : '+e.message)}
        });
        commands.append(policyForm);
      }
    }
    spaces.append(status,commands);
    const celebrations=workspace.list();
    if(!celebrations.length){
      spaces.append(node('p','Aucune célébration disponible dans cet éditeur.'));
      return;
    }
    if(!celebrations.some(c=>String(c.id)===celebrationId))
      celebrationId=String(celebrations[0].id);
    const choice=node('select');
    choice.setAttribute('aria-label','Célébration à préparer');
    celebrations.forEach(c=>{
      const option=node('option',(c.archangel||'Célébration')+' '+(c.year||'')+' — '+c.id);
      option.value=String(c.id);option.selected=String(c.id)===celebrationId;choice.append(option);
    });
    choice.disabled=canonical&&(busy||workspace.changed);
    choice.addEventListener('change',()=>{celebrationId=choice.value;if(canonical){snapshot=null;needsReload=false;workspace=newWorkspace(catalogue);renderSpaces();void loadCanonical();}else renderSpaces();});
    const choose=node('div');choose.className='member-spaces-actions';
    choose.append(label('Célébration',choice));
    const duplicate=button('Dupliquer en brouillon');
    duplicate.disabled=!canDuplicate(celebrationId);
    if(duplicate.disabled)duplicate.title='Ouvrez cette célébration dans l’éditeur pour charger ses pages avant duplication';
    duplicate.addEventListener('click',()=>{
      try {
        celebrationId=workspace.duplicate(celebrationId);
        renderSpaces('Copie locale indépendante : pages et traductions conservées, '+
          'inscriptions individuelles exclues, publication désactivée.');
      }catch(e){renderSpaces('Duplication refusée : '+e.message);}
    });
    if(!canonical)choose.append(duplicate);spaces.append(choose);
    if(canonical&&!snapshot){spaces.append(node('p',isConnected()?'Chargez les espaces canoniques avant toute modification.':'Connectez-vous à D1 pour consulter ou modifier les espaces.'));return;}
    const existing=workspace.spaces(celebrationId);
    const list=node('div');list.className='member-spaces-grid';
    existing.forEach(space=>{
      const card=node('section');card.className='card member-spaces-card';
      const name=node('h3',space.name||space.id);
      const id=node('code',space.id);
      const badge=node('p',(space.visibility==='PRIVATE'?'Privé (inscription individuelle requise)':'Public')+
        ' · '+space.pages.length+' page(s) · mode '+space.accessPolicy.mode);
      const edit=node('form');edit.className='member-spaces-form';
      const title=field('text','Nom',120);title.value=space.name||'';
      const access=accessOptions({policy:space.accessPolicy,visibility:space.visibility});
      const saveSpace=button('Préparer ces choix');saveSpace.type='submit';
      if(canonical)saveSpace.disabled=!ready();
      edit.append(label('Nom',title),label('Public / Privé et catégorie',access),saveSpace);
      if(space.visibility==='PRIVATE'&&space.accessScope!=='CELEBRATION')
        edit.append(node('small','Espace historique : inscription individuelle conservée.'));
      edit.addEventListener('submit',event=>{
        event.preventDefault();if(canonical&&!ready())return;
        try{
          const selected=accessPolicyFromChoice(access.value,space.accessPolicy);
          workspace.updateSpace(celebrationId,space.id,{
            name:title.value,visibility:selected.visibility,mode:selected.mode,
            typeIds:selected.typeIds
          });
          renderSpaces('Visibilité préparée. Enregistrez les espaces.');
        }catch(e){renderSpaces('Choix refusé : '+e.message)}
      });
      const pages=node('div');pages.className='member-spaces-pages';
      pages.append(node('h4','Pages de cet espace'));
      for(const page of space.pages){
        const row=node('p',(page.title||page.name||page.id)+' — brouillon / '+
          'contenu et langues conservés');
        const language=node('select');
        const configured=snapshot?.languageRegistry?.languages??[{id:'fr',name:'Français'}];
        for(const entry of configured){
          const option=node('option',entry.name+(entry.active?'':' (brouillon)'));
          option.value=entry.id;language.append(option);
        }
        const editPage=button('Rédiger dans cette langue');
        editPage.disabled=!canonical||!ready()||workspace.changed||page.id.startsWith('draft-page:')||typeof onEditPage!=='function';
        editPage.title=editPage.disabled?'Enregistrez d’abord la page et vérifiez la session D1.':'Même éditeur de blocs, contenu indépendant par langue';
        editPage.addEventListener('click',()=>openCanonicalPage(space.id,page.id,language.value));
        row.append(' ',label('Langue de la page',language),editPage);
        if(canonical){
          const released=snapshot.pageReleases?.some(x=>x.pageId===page.id);
          row.append(node('span',released?' · publication enregistrée':' · non publiée'));
          const release=button('Publier cette page');
          release.disabled=!ready()||workspace.changed||!snapshot.spaceReleases?.some(x=>x.spaceId===space.id)||page.id.startsWith('draft-page:');
          release.addEventListener('click',()=>{if(doc.defaultView.confirm('Publier explicitement cette page ?'))void mutate('publish',{kind:'page',id:page.id,spaceId:space.id});});
          const revoke=button('Dépublier cette page');revoke.disabled=!ready()||workspace.changed||!released;
          revoke.addEventListener('click',()=>{if(doc.defaultView.confirm('Retirer la publication de cette page ?'))void mutate('unpublish',{kind:'page',id:page.id,spaceId:space.id});});
          row.append(release,revoke);
        }
        pages.append(row);
        if(canonical){
          const policyForm=node('form');policyForm.className='member-spaces-form';
          const accessPage=pagePolicyOptions(page.accessPolicy??{mode:ACCESS_MODES.PUBLIC});
          accessPage.disabled=!ready();
          const prepare=button('Préparer les droits de la page');prepare.type='submit';prepare.disabled=!ready();
          policyForm.append(label('Page : Public ou Privé / catégorie',accessPage),prepare);
          if(space.visibility==='PRIVATE')policyForm.append(node('small',
            'Cette page reste réservée aux personnes autorisées à la célébration et à cet espace.'));
          policyForm.addEventListener('submit',event=>{
            event.preventDefault();if(!ready())return;
            try{
              const selected=pagePolicyFromChoice(accessPage.value,page.accessPolicy);
              workspace.updatePagePolicy(celebrationId,space.id,page.id,{
                mode:selected.mode,typeIds:selected.typeIds??[]
              });
              renderSpaces('Droits de page préparés. Enregistrez les espaces.');
            }catch(e){renderSpaces('Droits refusés : '+e.message)}
          });
          pages.append(policyForm);
        }
      }
      const addPage=node('form');addPage.className='member-spaces-form';
      const pageName=field('text','Titre de la nouvelle page',160);
      const addPageButton=button('Préparer une page');
      addPageButton.type='submit';
      addPage.append(label('Nouvelle page',pageName),addPageButton);
      addPage.addEventListener('submit',event=>{
        event.preventDefault();if(canonical&&!ready())return;
        try{workspace.addPage(celebrationId,space.id,{title:pageName.value});
          renderSpaces('Page préparée en brouillon, non publiée.');
        }catch(e){renderSpaces('Page refusée : '+e.message);}
      });
      card.append(name,id,badge,edit,pages,addPage);
      if(canonical){
        addPageButton.disabled=!ready();
        const released=snapshot.spaceReleases?.some(x=>x.spaceId===space.id);
        card.append(node('p',released?'Publication de l’espace enregistrée (accès selon confirmation D1).':'Espace non publié.'));
        const release=button('Publier cet espace');
        release.disabled=!ready()||workspace.changed||snapshot.celebrationVisibility!=='published'||space.id.startsWith('draft-space:');
        release.addEventListener('click',()=>{if(doc.defaultView.confirm('Publier cet espace, sans publier ses pages ?'))void mutate('publish',{kind:'space',id:space.id});});
        const revoke=button('Dépublier cet espace');
        revoke.disabled=!ready()||workspace.changed||!released;
        revoke.addEventListener('click',()=>{if(doc.defaultView.confirm('Retirer la publication de cet espace et de ses pages ?'))void mutate('unpublish',{kind:'space',id:space.id});});
        card.append(release,revoke);
      }
      list.append(card);
    });
    if(!existing.length)list.append(node('p','Aucun espace dans cette célébration.'));
    spaces.append(list);
    const create=node('form');create.className='card member-spaces-create';
    create.append(node('h3','Préparer un espace pour cette célébration'));
    const name=field('text','Nom de l’espace',120);name.required=true;
    const access=accessOptions({policy:{mode:ACCESS_MODES.PUBLIC},visibility:SPACE_VISIBILITIES.PRIVATE});
    access.value='REGISTERED';
    const add=button('Créer dans le brouillon');add.type='submit';if(canonical)add.disabled=!ready();
    create.append(label('Nom',name),label('Public / Privé et catégorie',access),add);
    create.addEventListener('submit',event=>{
      event.preventDefault();if(canonical&&!ready())return;
      try{
        const chosen=accessPolicyFromChoice(access.value);
        workspace.addSpace(celebrationId,{name:name.value,visibility:chosen.visibility,
          mode:chosen.mode,typeIds:chosen.typeIds,accessScope:'CELEBRATION'});
        renderSpaces('Version préparée pour cette célébration : pas une deuxième célébration.');
      }catch(e){renderSpaces('Création refusée : '+e.message)}
    });
    spaces.append(create);
  }
  activate(false);
  return {
    getDraft:()=>workspace.list(),
    refreshMembers,sessionChanged,
    get changed(){return workspace.changed;},
    showSpaces(){activate(true);},
    showMembers(){activate(false);},
    destroy(){destroyed=true;++epoch;memberMount?.destroy();root.replaceChildren();}
  };
}
