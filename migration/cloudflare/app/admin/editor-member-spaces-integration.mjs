// M011-C — the existing admin panel mounts the existing M007-B/M010-B directory.
// Space preparation uses M005 inside a disposable editor draft; no new dashboard,
// storage API, private routes, publication, migrations or real member fixtures.
import {mountMemberDirectoryAdmin} from './member-directory-admin-integration.mjs';
import {createSpacesDraftWorkspace} from './editor-spaces-draft.mjs';
import {ACCESS_MODES,SPACE_VISIBILITIES} from '../domain/member-access.mjs';

export function mountExistingEditorMemberSpaces(root,{
  transport,privateTransport,isConnected=()=>false,celebrations=[],currentCelebrationId=null,allocateId,styleNonce,canDuplicate=()=>true
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
  let celebrationId=selected(),memberMount=null,destroyed=false;
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
    if(showSpaces){renderSpaces();if(canonical&&isConnected()&&!snapshot&&!busy&&!needsReload)void loadCanonical();}
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
    let message;
    try{
      const result=await privateTransport({method:'GET',celebration:celebrationId});
      if(attempt!==epoch)return;
      if(!result.ok)throw Error(result.error||'Chargement refusé');
      applySnapshot(result);
      message='Espaces chargés depuis R2 — révision '+snapshot.revision+'.';
    }catch(e){if(attempt!==epoch)return;needsReload=true;message='Chargement impossible : '+e.message;}
    finally{if(attempt===epoch){busy=false;renderSpaces(message);}}
  }
  async function mutate(action,fields={}){
    if(!ready())return;
    const attempt=++epoch;busy=true;renderSpaces('Commande serveur en cours…');
    let message;
    try{
      const result=await privateTransport({method:'POST',action,celebration:celebrationId,expectedRevision:snapshot.revision,...fields});
      if(attempt!==epoch)return;
      if(!result.ok){
        needsReload=true;
        throw Error((result.saved?'R2 a enregistré la commande ; confirmation D1 incomplète. ':'')+(result.error||'Commande refusée')+' — Rechargez avant toute nouvelle tentative.');
      }
      applySnapshot(result);
      message=action==='save'?'Brouillon enregistré, identifiants serveur et révision '+snapshot.revision+' confirmés.':
        'Commande confirmée — révision '+snapshot.revision+(snapshot.privateReleaseReady?' ; confirmation D1 obtenue.':' ; accès privé non confirmé.');
    }catch(e){if(attempt!==epoch)return;needsReload=true;message='Commande non confirmée : '+e.message;}
    finally{if(attempt===epoch){busy=false;renderSpaces(message);}}
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
      const visibility=node('select');
      for(const [value,text] of [['PRIVATE','Privé'],['PUBLIC','Public']]){
        const option=node('option',text);option.value=value;
        option.selected=space.visibility===value;visibility.append(option);
      }
      const mode=node('select');
      for(const [value,text] of [
        [ACCESS_MODES.PUBLIC,'Invitation seule (sans type)'],
        [ACCESS_MODES.ALL_PRIVATE_TYPES,'Tout type de membre privé'],
        [ACCESS_MODES.SELECTED_TYPES,'Types sélectionnés']]){
        const option=node('option',text);option.value=value;
        option.selected=space.accessPolicy.mode===value;mode.append(option);
      }
      const types=field('text','member-type:choir, member-type:team',500);
      types.value=(space.accessPolicy.typeIds||[]).join(', ');
      const updateControls=()=>{
        mode.disabled=visibility.value===SPACE_VISIBILITIES.PUBLIC;
        types.disabled=mode.disabled||mode.value!==ACCESS_MODES.SELECTED_TYPES;
      };
      visibility.addEventListener('change',updateControls);
      mode.addEventListener('change',updateControls);updateControls();
      const saveSpace=button('Préparer ces paramètres');
      if(canonical){visibility.disabled=!space.id.startsWith('draft-space:')||!ready();saveSpace.disabled=!ready();}
      saveSpace.type='submit';
      edit.append(label('Nom',title),label('Visibilité',visibility),
        label('Politique M002',mode),label('Identifiants des types autorisés',types),saveSpace);
      edit.addEventListener('submit',event=>{
        event.preventDefault();if(canonical&&!ready())return;
        try {
          const ids=types.value.split(',').map(s=>s.trim()).filter(Boolean);
          workspace.updateSpace(celebrationId,space.id,{name:title.value,
            visibility:visibility.value,mode:mode.value,typeIds:ids});
          renderSpaces('Politique modifiée dans le brouillon seulement.');
        }catch(e){renderSpaces('Politique refusée : '+e.message);}
      });
      const pages=node('div');pages.className='member-spaces-pages';
      pages.append(node('h4','Pages de cet espace'));
      for(const page of space.pages){
        const row=node('p',(page.title||page.name||page.id)+' — brouillon / '+
          'contenu et langues conservés');
        const editPage=button('Ouvrir l’édition de page');
        editPage.disabled=true;editPage.title='Raccordement au moteur de pages et sauvegarde sécurisée requis';
        row.append(' ',editPage);
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
          const policyMode=node('select');
          for(const [value,caption] of [
            [ACCESS_MODES.PUBLIC,'Accès de l’espace (sans restriction supplémentaire)'],
            [ACCESS_MODES.ALL_PRIVATE_TYPES,'Tout type de membre privé'],
            [ACCESS_MODES.SELECTED_TYPES,'Types sélectionnés']]){
            const option=node('option',caption);option.value=value;
            option.selected=(page.accessPolicy?.mode??ACCESS_MODES.PUBLIC)===value;policyMode.append(option);
          }
          const policyTypes=field('text','member-type:choir, member-type:team',500);
          policyTypes.value=(page.accessPolicy?.typeIds||[]).join(', ');
          const sync=()=>{policyTypes.disabled=!ready()||policyMode.value!==ACCESS_MODES.SELECTED_TYPES;};
          policyMode.disabled=!ready();policyMode.addEventListener('change',sync);sync();
          const prepare=button('Préparer les droits de la page');prepare.type='submit';prepare.disabled=!ready();
          policyForm.append(label('Politique de la page '+(page.name||page.title||page.id),policyMode),
            label('Types autorisés de la page',policyTypes),prepare);
          policyForm.addEventListener('submit',event=>{
            event.preventDefault();if(!ready())return;
            try{
              workspace.updatePagePolicy(celebrationId,space.id,page.id,{mode:policyMode.value,
                typeIds:policyTypes.value.split(',').map(s=>s.trim()).filter(Boolean)});
              renderSpaces('Droits de page préparés. Enregistrez les espaces pour les confirmer.');
            }catch(e){renderSpaces('Politique refusée : '+e.message);}
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
    const visibility=node('select');
    for(const [value,text] of [['PRIVATE','Privé — par inscription'],['PUBLIC','Public']]){
      const option=node('option',text);option.value=value;visibility.append(option);
    }
    const add=button('Créer dans le brouillon');add.type='submit';if(canonical)add.disabled=!ready();
    create.append(label('Nom',name),label('Visibilité',visibility),add);
    create.addEventListener('submit',event=>{
      event.preventDefault();if(canonical&&!ready())return;
      try {
        workspace.addSpace(celebrationId,{name:name.value,visibility:visibility.value});
        renderSpaces('Espace préparé : non enregistré, non publié.');
      }catch(e){renderSpaces('Création refusée : '+e.message);}
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
