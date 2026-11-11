// M011-C — the existing admin panel mounts the existing M007-B/M010-B directory.
// Space preparation uses M005 inside a disposable editor draft; no new dashboard,
// storage API, private routes, publication, migrations or real member fixtures.
import {mountMemberDirectoryAdmin} from './member-directory-admin-integration.mjs';
import {createSpacesDraftWorkspace} from './editor-spaces-draft.mjs';
import {ACCESS_MODES,SPACE_VISIBILITIES} from '../domain/member-access.mjs';

export function createMemberDirectoryTransport({
  fetchImpl=globalThis.fetch,tokenProvider=()=>globalThis.getCelebrationsAdminToken?.()||'',
  origin=globalThis.location?.origin
}={}) {
  if(typeof fetchImpl!=='function'||!origin)throw new TypeError('Same-origin admin transport required');
  const base=new URL('/api/admin/member-directory',origin);
  if(base.origin!==origin)throw new TypeError('Cross-origin API forbidden');
  return async command=>{
    if(!['GET','POST'].includes(command?.method))throw new TypeError('Invalid method');
    const token=tokenProvider();
    if(typeof token!=='string'||!token) return {ok:false,error:'Session administrateur absente'};
    const url=new URL(base);
    const options={method:command.method,credentials:'same-origin',cache:'no-store',
      redirect:'error',headers:{authorization:'Bearer '+token,accept:'application/json'}};
    if(command.method==='GET'){
      for(const key of ['action','search','cursor','limit','personId']){
        if(command[key]!==undefined && command[key]!==null && command[key]!=='')
          url.searchParams.set(key,String(command[key]));
      }
    }else{
      options.headers['content-type']='application/json';
      options.body=JSON.stringify(Object.fromEntries(Object.entries(command)
        .filter(([key])=>key!=='method')));
    }
    try {
      const response=await fetchImpl(url.toString(),options);
      if(!response.headers.get('content-type')?.toLowerCase().includes('application/json'))
        throw new Error('Route administrative indisponible');
      const result=await response.json();
      if(!response.ok||!result?.ok)
        return {ok:false,error:result?.error||('Accès refusé ('+response.status+')')};
      return result;
    }catch(error){
      return {ok:false,error:'Route administrateur non activée ou indisponible : '+
        (error?.message||'échec réseau')};
    }
  };
}

export function mountExistingEditorMemberSpaces(root,{
  transport,celebrations=[],currentCelebrationId=null,allocateId
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
  const workspace=createSpacesDraftWorkspace(clone(celebrations),
    allocateId?{allocateId}:{});
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
  const warning=node('p','Les espaces se préparent ici sans sauvegarde. '+
    'La publication et les politiques de pages restent désactivées tant que '+
    'leur écriture sécurisée côté serveur n’est pas raccordée.');
  warning.className='notice';warning.setAttribute('role','note');
  const directory=node('section');directory.id='member-spaces-directory';
  const spaces=node('section');spaces.id='member-spaces-workspace';spaces.hidden=true;
  container.append(header,tabs,warning,directory,spaces);
  root.replaceChildren(container);
  // Mount only once: the existing M007-B component owns type/member changes.
  memberMount=mountMemberDirectoryAdmin(directory,{transport});
  function activate(showSpaces) {
    if(destroyed)return;
    directory.hidden=showSpaces;spaces.hidden=!showSpaces;
    peopleTab.classList.toggle('primary',!showSpaces);
    spacesTab.classList.toggle('primary',showSpaces);
    peopleTab.setAttribute('aria-pressed',String(!showSpaces));
    spacesTab.setAttribute('aria-pressed',String(showSpaces));
    if(showSpaces)renderSpaces();
  }
  peopleTab.addEventListener('click',()=>activate(false));
  spacesTab.addEventListener('click',()=>activate(true));

  function renderSpaces(message='') {
    if(destroyed)return;
    spaces.replaceChildren();
    const note=node('p','Atelier de préparation local, non enregistré : fermeture de la page = perte des modifications. '+
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
      workspace.discard();celebrationId=selected();
      renderSpaces('Brouillon abandonné. Les contenus existants sont inchangés.');
    });
    const save=button('Enregistrer les espaces');
    save.disabled=true;save.title='Écriture serveur des espaces non disponible';
    const publish=button('Publier / appliquer les droits');
    publish.disabled=true;publish.title='Publication privée et politiques de pages non raccordées';
    commands.append(undo,redo,discard,save,publish);
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
    choice.addEventListener('change',()=>{celebrationId=choice.value;renderSpaces();});
    const choose=node('div');choose.className='member-spaces-actions';
    choose.append(label('Célébration',choice));
    const duplicate=button('Dupliquer en brouillon');
    duplicate.addEventListener('click',()=>{
      try {
        celebrationId=workspace.duplicate(celebrationId);
        renderSpaces('Copie locale indépendante : pages et traductions conservées, '+
          'inscriptions individuelles exclues, publication désactivée.');
      }catch(e){renderSpaces('Duplication refusée : '+e.message);}
    });
    choose.append(duplicate);spaces.append(choose);
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
      saveSpace.type='submit';
      edit.append(label('Nom',title),label('Visibilité',visibility),
        label('Politique M002',mode),label('Identifiants des types autorisés',types),saveSpace);
      edit.addEventListener('submit',event=>{
        event.preventDefault();
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
        row.append(' ',editPage);pages.append(row);
      }
      const addPage=node('form');addPage.className='member-spaces-form';
      const pageName=field('text','Titre de la nouvelle page',160);
      const addPageButton=button('Préparer une page');
      addPageButton.type='submit';
      addPage.append(label('Nouvelle page',pageName),addPageButton);
      addPage.addEventListener('submit',event=>{
        event.preventDefault();
        try{workspace.addPage(celebrationId,space.id,{title:pageName.value});
          renderSpaces('Page préparée en brouillon, non publiée.');
        }catch(e){renderSpaces('Page refusée : '+e.message);}
      });
      card.append(name,id,badge,edit,pages,addPage);list.append(card);
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
    const add=button('Créer dans le brouillon');add.type='submit';
    create.append(label('Nom',name),label('Visibilité',visibility),add);
    create.addEventListener('submit',event=>{
      event.preventDefault();
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
    get changed(){return workspace.changed;},
    showSpaces(){activate(true);},
    showMembers(){activate(false);},
    destroy(){destroyed=true;memberMount?.destroy();root.replaceChildren();}
  };
}
