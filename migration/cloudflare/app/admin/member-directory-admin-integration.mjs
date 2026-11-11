// One directory, using the existing authenticated, audited server commands.
import {adminDialog} from './admin-dialog.mjs';
export function categoryAbbreviation(name){
 return String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(/[^a-zA-Z0-9]+/).filter(Boolean).map(word=>word[0]).join('').toUpperCase().slice(0,16);
}
export function mountMemberDirectoryAdmin(root,{transport,styleNonce,celebrations=[],onCategories=()=>{}}={}){
 const doc=root.ownerDocument;
 const n=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e};
 const b=(text,action)=>{const e=n('button',text);e.type='button';e.className='btn';e.onclick=action;return e};
 const label=(text,input)=>{input.setAttribute('aria-label',text);const e=n('label');e.className='field';e.append(n('span',text),input);return e};
 const input=(type='text',value='')=>{const e=n('input');e.type=type;e.value=value;e.maxLength=120;return e};
 const select=(items,value='')=>{const e=n('select');for(const [id,name]of items){const o=n('option',name);o.value=id;e.append(o)}e.value=value;return e};
 const names=[...new Map(celebrations.filter(c=>/^\d+$/.test(String(c.id))).map(c=>[String(c.id),c.title||[c.archangel,c.year].filter(Boolean).join(' ')])).entries()];
 const celebrationName=id=>names.find(x=>x[0]===String(id))?.[1]||'Célébration archivée';
 let types=[],members=[],memberships=[],selected='',search='',celebrationId='',typeId='',cursor='',cursors=[],next=null,busy=false,destroyed=false,epoch=0;
 const shell=n('section');shell.className='member-directory-009b';
 const status=n('p','Chargement…');status.setAttribute('role','status');
 const people=n('section');people.className='m019-people';
 const categories=n('section');categories.className='m019-categories';
 shell.append(status,people,categories);root.replaceChildren(shell);
 const call=async command=>{const r=await transport(command);if(!r?.ok)throw Object.assign(Error(r?.error||'Enregistrement impossible. Réessayez.'),{status:r?.status});return r.data??r.result??r};
 const activeTypes=()=>types.filter(t=>!t.disabled).map(t=>[t.id,t.name]);
 async function run(action,message='Enregistré.'){
  if(busy)return;busy=true;shell.inert=true;shell.setAttribute('aria-busy','true');status.textContent='Enregistrement…';
  try{await action();await reload();status.textContent=message}catch(e){status.textContent=e.message}finally{busy=false;shell.inert=false;shell.removeAttribute('aria-busy')}
 }
 async function reload(){
  const attempt=++epoch;
  const data=await call({method:'GET',action:'snapshot',search,cursor,celebrationId,typeId,limit:50,sort:'name'});
  if(destroyed||attempt!==epoch)return;
  types=data.types;members=data.members;memberships=data.memberships||[];next=data.nextCursor;onCategories(types);
  renderPeople();renderCategories();
 }
 function renderPeople(){
  people.replaceChildren();
  const heading=n('div');heading.className='m019-member-header';
  const title=n('h2','Membres');
  const addMember=b('+ Ajouter un membre',()=>{
    form.hidden=!form.hidden;
    addMember.setAttribute('aria-expanded',String(!form.hidden));
    if(!form.hidden){given.focus();form.scrollIntoView?.({block:'nearest'});}
  });
  addMember.setAttribute('aria-expanded','false');
  heading.append(title,addMember);people.append(heading);

  // Creation remains available but never occupies the everyday directory.
  const form=n('form');form.className='m019-member-form card';form.hidden=true;
  const given=input(),family=input(),email=input('email');
  given.required=family.required=email.required=true;
  const category=select([['','Choisir une catégorie'],...activeTypes()]);category.required=true;
  const celebration=select([['','Choisir une célébration'],...names]);celebration.required=true;
  const save=b('Enregistrer');save.type='submit';
  form.append(label('Prénom',given),label('Nom',family),label('E-mail',email),
    label('Catégorie',category),label('Célébration',celebration),save);
  form.onsubmit=event=>{event.preventDefault();if(!form.reportValidity())return;
   if(!given.value.trim()||!family.value.trim()){status.textContent='Renseignez le prénom et le nom.';return;}
   void run(async()=>{
    const command={method:'POST',action:'create_person',givenName:given.value.trim(),familyName:family.value.trim(),email:email.value.trim(),displayName:'',typeIds:category.value?[category.value]:[],celebrationId:celebration.value};
    let result;
    try{result=await call(command)}catch(error){
      if(error.status&&error.status<500||/e-mail existe déjà/.test(error.message))throw error;
      // Lost server responses must never create duplicate people.
      const check=await call({method:'GET',action:'snapshot',search:command.email,limit:50});
      const member=check.members.find(p=>p.emailNormalized===command.email.trim().toLowerCase());
      if(!member)throw error;
      const detail=await call({method:'GET',action:'person_detail',personId:member.id});
      if(detail.person.givenName!==command.givenName||detail.person.familyName!==command.familyName||
        !detail.celebrations.some(c=>String(c.celebrationId)===command.celebrationId)||
        !command.typeIds.every(id=>detail.types.some(t=>t.typeId===id)))throw error;
      result={result:member};
    }
    selected=result.result?.id||'';search='';cursor='';cursors=[];
    celebrationId=celebration.value;typeId=category.value;
   },'Membre enregistré et inscrit.');
  };
  people.append(form);

  const filter=n('form');filter.className='m019-filters';
  const query=input('search',search);
  query.className='m019-search';query.placeholder='Nom, prénom ou e-mail';
  query.setAttribute('aria-label','Rechercher un membre');
  const selectedCelebration=select([['','Toutes les célébrations'],...names],celebrationId);
  const selectedCategory=select([['','Toutes les catégories'],...types.map(t=>[t.id,t.name+(t.disabled?' (désactivée)':'')])],typeId);
  const apply=async(restoreFocus=false)=>{
    if(busy)return;
    const shouldRefocus=restoreFocus&&doc.activeElement===query;
    const caret=shouldRefocus?query.selectionStart:null;
    search=query.value.trim();celebrationId=selectedCelebration.value;typeId=selectedCategory.value;
    cursor='';cursors=[];
    try{
      await reload();status.textContent='';
      if(shouldRefocus){
        const current=people.querySelector('.m019-search');current?.focus();
        if(caret!=null)current?.setSelectionRange(caret,caret);
      }
    }catch(e){status.textContent=e.message;}
  };
  let typingTimer;
  query.addEventListener('input',()=>{
    clearTimeout(typingTimer);
    typingTimer=setTimeout(()=>void apply(true),280);
  });
  filter.onsubmit=e=>{e.preventDefault();clearTimeout(typingTimer);void apply(true);};
  selectedCelebration.onchange=()=>void apply();
  selectedCategory.onchange=()=>void apply();
  const reset=b('Effacer les filtres',()=>{
    query.value='';selectedCelebration.value='';selectedCategory.value='';
    clearTimeout(typingTimer);void apply();
  });
  const first=n('div');first.className='m019-filter-search';
  const find=b('Rechercher');find.type='submit';first.append(query,find);
  filter.append(first,label('Célébration',selectedCelebration),
    label('Catégorie',selectedCategory),reset);
  people.append(filter);

  const pageInfo=n('p','Page '+(cursors.length+1)+' · '+members.length+
    (members.length>1?' membres affichés':' membre affiché'));
  pageInfo.className='m019-page-info';pageInfo.setAttribute('aria-live','polite');
  people.append(pageInfo);
  const list=n('div');list.className='m019-member-list';
  if(!members.length){
    list.append(n('p',search||celebrationId||typeId
      ?'Aucun membre ne correspond à cette recherche.':'Aucun membre inscrit.'));
  }
  const categoryLabels=new Map(types.map(t=>[t.id,t.name]));
  for(const member of members){
    const row=b('',()=>void showAssignments(member.id).catch(e=>status.textContent=e.message));
    row.className='m019-member-row';row.setAttribute('aria-label','Ouvrir la fiche de '+(member.name||member.emailNormalized));
    const identity=n('span');identity.className='m019-member-identity';
    identity.append(n('strong',member.name||member.emailNormalized),
      n('small',member.emailNormalized));
    row.append(identity);
    const belonging=new Set((memberships||[]).filter(t=>t.memberId===member.id)
      .map(t=>categoryLabels.get(t.typeId)).filter(Boolean));
    if(belonging.size){const badge=n('small',[...belonging].slice(0,2).join(' · '));
      badge.className='m019-member-categories';row.append(badge);}
    list.append(row);
  }
  people.append(list);
  if(cursors.length||next){
    const pager=n('div');pager.className='m019-pager';
    const back=b('Précédent',()=>{
      cursor=cursors.pop()||'';void reload().catch(e=>status.textContent=e.message);
    });back.disabled=!cursors.length;
    const forward=b('Suivant',()=>{
      cursors.push(cursor);cursor=next;void reload().catch(e=>status.textContent=e.message);
    });forward.disabled=!next;
    pager.append(back,forward);people.append(pager);
  }
 }
 async function editPerson(id){
  if(busy)return;
  try{
   const detail=await call({method:'GET',action:'person_detail',personId:id});if(destroyed)return;
   const person=detail.person;
   const result=await adminDialog(doc,{title:'Modifier le membre',fields:[
    {name:'givenName',label:'Prénom',value:person.givenName,required:true},{name:'familyName',label:'Nom',value:person.familyName,required:true},
    {name:'email',label:'E-mail',type:'email',value:person.emailNormalized,required:true}],confirm:'Enregistrer'});
   if(!result)return;
   await run(()=>call({method:'POST',action:'update_person',personId:id,expectedRevision:person.revision,changes:result}),'Fiche enregistrée.');
   // A single expandable sheet keeps advanced multiple assignments out of creation.
   await showAssignments(id);
  }catch(e){status.textContent=e.message}
 }
 async function showAssignments(id){
  const data=await call({method:'GET',action:'person_detail',personId:id});
  const old=people.querySelector('.m019-assignments');old?.remove();
  const card=n('section');card.className='card m019-assignments';card.tabIndex=-1;
  card.append(n('h3','Inscriptions de '+(data.person.givenName||data.person.emailNormalized)),b('Modifier',()=>void editPerson(id)),b('Fermer',()=>card.remove()));
  const stateLabel={not_invited:'Invitation à préparer',invited:'Invitation à activer',active:'Compte activé',revoked:'Accès révoqué'};
  const access=n('p','Accès : '+(stateLabel[data.access?.status]||'Invitation à préparer'));access.setAttribute('role','status');card.append(access);
  const languageSelect=select([['fr','Français'],['en','English'],['es','Español'],['de','Deutsch'],['pt','Português'],['it','Italiano'],['ar','العربية'],['zh','中文']]);
  if(data.access?.status!=='active'){
   const invite=b(data.access?.status==='invited'?'Renvoyer l’invitation':'Préparer et envoyer l’invitation',async()=>{
    const checked=await adminDialog(doc,{title:'Vérification administrative',message:'Confirmez que vous autorisez précisément cette personne et avez vérifié son identité indépendamment de la seule adresse e-mail.',confirm:'Confirmer et inviter'});
    if(!checked)return;
    await run(async()=>{
     const response=await call({method:'POST',action:'invite_member',personId:id,verified:true,language:languageSelect.value});
     const mail=response.result?.mail;
     if(mail!=='sent'&&mail!=='not_required')throw Error(mail==='unconfigured'?'Invitation préparée, mais aucun e-mail envoyé : Brevo n’est pas encore configuré.':'Invitation préparée, mais envoi non confirmé. Vérifiez Brevo avant de réessayer.');
    },'Invitation envoyée.');await showAssignments(id);
   });
   card.append(label('Langue de l’e-mail',languageSelect),invite);
  }
  if(data.access?.status==='active'||data.access?.status==='invited'){
   card.append(b('Révoquer l’accès',async()=>{
    const yes=await adminDialog(doc,{title:'Révoquer l’accès',message:'Les sessions en cours seront invalidées immédiatement. Les inscriptions historiques seront préservées.',confirm:'Révoquer'});
    if(!yes)return;
    await run(()=>call({method:'POST',action:'revoke_member',personId:id}),'Accès révoqué.');await showAssignments(id);
   }));
  }
  const form=n('form'),checks=[];
  const typeBox=n('fieldset');typeBox.append(n('legend','Catégories'));
  for(const type of types){const check=input('checkbox');check.checked=data.types.some(t=>t.typeId===type.id);check.disabled=!!type.disabled;checks.push([type,check]);typeBox.append(label(type.name+(type.disabled?' (désactivée)':''),check))}
  const save=b('Enregistrer les catégories');save.type='submit';form.append(typeBox,save);
  form.onsubmit=e=>{e.preventDefault();void run(()=>call({method:'POST',action:'set_person_types',personId:id,expectedRevision:data.person.revision,typeIds:checks.filter(([,c])=>c.checked).map(([t])=>t.id)}),'Catégories enregistrées.').then(()=>showAssignments(id))};card.append(form);
  for(const link of data.celebrations){const row=n('p',celebrationName(link.celebrationId));row.append(b('Retirer l’inscription',async()=>{
   if(!await adminDialog(doc,{title:'Retirer l’inscription',message:'Ce membre perdra l’accès à '+celebrationName(link.celebrationId)+'.',confirm:'Retirer'}))return;
   await run(()=>call({method:'POST',action:'remove_celebration',personId:id,expectedRevision:data.person.revision,celebrationId:link.celebrationId}),'Inscription retirée. L’accès est révoqué.');await showAssignments(id);
  }));card.append(row)}
  const available=names.filter(([cid])=>!data.celebrations.some(l=>String(l.celebrationId)===cid));
  if(available.length){const addForm=n('form'),target=select(available),add=b('Ajouter une inscription');add.type='submit';addForm.append(label('Célébration',target),add);addForm.onsubmit=e=>{e.preventDefault();void run(()=>call({method:'POST',action:'add_celebration',personId:id,expectedRevision:data.person.revision,celebrationId:target.value}),'Inscription ajoutée.').then(()=>showAssignments(id))};card.append(addForm)}
  const claims=await call({method:'GET',action:'pending_claims'});
  for(const claim of claims.filter(c=>c.personId===id)){
   const row=n('p','Connexion en attente : '+claim.participantEmail);
   row.append(b('Vérifier l’identité',async()=>{
    const decision=await adminDialog(doc,{title:'Vérifier l’identité',message:'Une adresse e-mail identique ne suffit pas. Confirmez uniquement après une vérification indépendante.',fields:[{name:'method',label:'Vérification effectuée',required:true,options:[['','Choisir'],['in_person','En personne'],['independent_records','Documents indépendants'],['video_verified','En vidéo']]}],confirm:'Confirmer l’identité'});
    if(decision)await run(()=>call({method:'POST',action:'review_claim',claimId:claim.claimId,approve:true,verificationMethod:decision.method}),'Identité vérifiée.');
   }),b('Refuser',()=>void run(()=>call({method:'POST',action:'review_claim',claimId:claim.claimId,approve:false}),'Demande refusée.')));card.append(row);
  }
  people.append(card);card.focus();
 }
 function renderCategories(){
  categories.replaceChildren(n('h2','Catégories'));
  const form=n('form'),name=input();name.required=true;name.placeholder='Nouvelle catégorie';name.setAttribute('aria-label','Nouvelle catégorie');
  const abbreviation=input();abbreviation.maxLength=16;abbreviation.setAttribute('aria-label','Sigle administratif');abbreviation.placeholder='Sigle administratif';let manual=false;abbreviation.oninput=()=>{manual=true};name.oninput=()=>{if(!manual)abbreviation.value=categoryAbbreviation(name.value)};
  const add=b('Ajouter');add.type='submit';form.append(label('Nom de la catégorie',name),label('Sigle administratif',abbreviation),add);form.onsubmit=e=>{e.preventDefault();void run(()=>call({method:'POST',action:'create_type',name:name.value.trim(),abbreviation:abbreviation.value.trim()||categoryAbbreviation(name.value)}),'Catégorie ajoutée.');};categories.append(form);
  const disabled=n('details');disabled.append(n('summary','Catégories désactivées ('+types.filter(t=>t.disabled).length+')'));
  for(const type of types){const row=n('div');row.className='card';row.append(n('strong',type.name+' — '+(type.abbreviation||categoryAbbreviation(type.name))),n('span',type.disabled?' · Désactivée':''),b('Renommer',async()=>{const r=await adminDialog(doc,{title:'Renommer la catégorie',fields:[{name:'name',label:'Nom',value:type.name,required:true,maxLength:120},{name:'abbreviation',label:'Sigle administratif',value:type.abbreviation||categoryAbbreviation(type.name),required:true,maxLength:16}]});if(r)await run(()=>call({method:'POST',action:'rename_type',typeId:type.id,expectedRevision:type.revision,name:r.name,abbreviation:r.abbreviation}));}),b(type.disabled?'Activer':'Désactiver',()=>void run(()=>call({method:'POST',action:'disable_type',typeId:type.id,expectedRevision:type.revision,disabled:!type.disabled}),'Catégorie actualisée. Les inscriptions sont conservées.')));(type.disabled?disabled:categories).append(row)}
  if(types.some(t=>t.disabled))categories.append(disabled);
 }
 reload().then(()=>{status.textContent='';}).catch(e=>status.textContent='Chargement impossible : '+e.message);
 return {reload,destroy(){destroyed=true;++epoch;root.replaceChildren()}};
}
