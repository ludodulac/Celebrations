// One directory, using the existing authenticated, audited server commands.
import {adminDialog} from './admin-dialog.mjs';
export function mountMemberDirectoryAdmin(root,{transport,styleNonce,celebrations=[],onCategories=()=>{}}={}){
 const doc=root.ownerDocument;
 const n=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e};
 const b=(text,action)=>{const e=n('button',text);e.type='button';e.className='btn';e.onclick=action;return e};
 const label=(text,input)=>{const e=n('label');e.className='field';e.append(n('span',text),input);return e};
 const input=(type='text',value='')=>{const e=n('input');e.type=type;e.value=value;e.maxLength=120;return e};
 const select=(items,value='')=>{const e=n('select');for(const [id,name]of items){const o=n('option',name);o.value=id;e.append(o)}e.value=value;return e};
 const names=celebrations.filter(c=>/^\d+$/.test(String(c.id))).map(c=>[String(c.id),c.title||[c.archangel,c.year].filter(Boolean).join(' ')]);
 const celebrationName=id=>names.find(x=>x[0]===String(id))?.[1]||'Célébration archivée';
 let types=[],members=[],selected='',search='',celebrationId='',typeId='',cursor='',cursors=[],next=null,busy=false,destroyed=false,epoch=0;
 const shell=n('section');shell.className='member-directory-009b';
 const status=n('p','Chargement…');status.setAttribute('role','status');
 const people=n('section');people.className='m019-people';
 const categories=n('section');categories.className='m019-categories';
 shell.append(status,people,categories);root.replaceChildren(shell);
 const call=async command=>{const r=await transport(command);if(!r?.ok)throw Error(r?.error||'Enregistrement impossible. Réessayez.');return r.data??r.result??r};
 const activeTypes=()=>types.filter(t=>!t.disabled).map(t=>[t.id,t.name]);
 async function run(action,message='Enregistré.'){
  if(busy)return;busy=true;shell.setAttribute('aria-busy','true');status.textContent='Enregistrement…';
  try{await action();await reload();status.textContent=message}catch(e){status.textContent=e.message}finally{busy=false;shell.removeAttribute('aria-busy')}
 }
 async function reload(){
  const attempt=++epoch;
  const data=await call({method:'GET',action:'snapshot',search,cursor,celebrationId,typeId,limit:50});
  if(destroyed||attempt!==epoch)return;
  types=data.types;members=data.members;next=data.nextCursor;onCategories(types);
  renderPeople();renderCategories();
 }
 function renderPeople(){
  people.replaceChildren(n('h2','Membres'));
  const form=n('form');form.className='m019-member-form card';
  const given=input(),family=input(),email=input('email');given.required=family.required=email.required=true;
  const category=select([['','Choisir une catégorie'],...activeTypes()]);
  const celebration=select([['','Choisir une célébration'],...names]);celebration.required=true;
  const save=b('Enregistrer');save.type='submit';
  form.append(label('Prénom',given),label('Nom',family),label('E-mail',email),label('Catégorie',category),label('Célébration',celebration),save);
  form.onsubmit=event=>{event.preventDefault();if(!form.reportValidity())return;
   void run(async()=>{
    const result=await call({method:'POST',action:'create_person',givenName:given.value.trim(),familyName:family.value.trim(),email:email.value.trim(),displayName:'',typeIds:category.value?[category.value]:[],celebrationId:celebration.value});
    selected=result.result?.id||'';search='';cursor='';cursors=[];celebrationId=celebration.value;typeId=category.value;
   },'Membre enregistré et inscrit.');
  };
  people.append(form);
  const filter=n('form');filter.className='m019-filters';
  const choices=[['','Toutes les célébrations']];
  for(const [id,name]of names){choices.push([id+'|',name]);for(const t of types)choices.push([id+'|'+t.id,name+' — '+t.name+(t.disabled?' (désactivée)':'')])}
  const chosen=select(choices,celebrationId?celebrationId+'|'+typeId:'');
  const query=input('search',search);query.placeholder='Nom ou e-mail';query.setAttribute('aria-label','Rechercher un membre');
  const find=b('Rechercher');find.type='submit';
  const apply=async()=>{if(busy)return;[celebrationId,typeId]=chosen.value.split('|');celebrationId||='';typeId||='';search=query.value.trim();cursor='';cursors=[];try{await reload();status.textContent='Liste actualisée.'}catch(e){status.textContent=e.message}};
  chosen.onchange=()=>void apply();filter.onsubmit=e=>{e.preventDefault();void apply()};
  filter.append(label('Célébration',chosen),query,find);people.append(filter);
  const list=n('div');list.className='m019-member-list';
  if(!members.length)list.append(n('p','Aucun membre inscrit'),b('Ajouter un membre',()=>given.focus()));
  for(const member of members){const row=n('div');row.className='card';row.append(n('strong',member.name||member.emailNormalized),n('p',member.emailNormalized),b('Modifier',()=>void editPerson(member.id)));list.append(row)}
  people.append(list);
  if(cursors.length||next){const pager=n('div');const back=b('Précédent',()=>{cursor=cursors.pop()||'';void reload().catch(e=>status.textContent=e.message)});back.disabled=!cursors.length;
   const forward=b('Suivant',()=>{cursors.push(cursor);cursor=next;void reload().catch(e=>status.textContent=e.message)});forward.disabled=!next;pager.append(back,forward);people.append(pager)}
 }
 async function editPerson(id){
  if(busy)return;
  try{
   const detail=await call({method:'GET',action:'person_detail',personId:id});if(destroyed)return;
   const person=detail.person;
   const result=await adminDialog(doc,{title:'Modifier le membre',fields:[
    {name:'givenName',label:'Prénom',value:person.givenName,required:true},{name:'familyName',label:'Nom',value:person.familyName,required:true},
    {name:'email',label:'E-mail',type:'email',value:person.emailNormalized,required:true}],confirm:'Enregistrer'});
   if(result)await run(()=>call({method:'POST',action:'update_person',personId:id,expectedRevision:person.revision,changes:result}),'Fiche enregistrée.');
   // A single expandable sheet keeps advanced multiple assignments out of creation.
   await showAssignments(id);
  }catch(e){status.textContent=e.message}
 }
 async function showAssignments(id){
  const data=await call({method:'GET',action:'person_detail',personId:id});
  const old=people.querySelector('.m019-assignments');old?.remove();
  const card=n('section');card.className='card m019-assignments';card.tabIndex=-1;
  card.append(n('h3','Inscriptions de '+(data.person.givenName||data.person.emailNormalized)),b('Fermer',()=>card.remove()));
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
  const add=b('Ajouter');add.type='submit';form.append(name,add);form.onsubmit=e=>{e.preventDefault();void run(()=>call({method:'POST',action:'create_type',name:name.value.trim()}),'Catégorie ajoutée.');};categories.append(form);
  for(const type of types){const row=n('div');row.className='card';row.append(n('strong',type.name),n('span',type.disabled?' · Désactivée':''),b('Renommer',async()=>{const r=await adminDialog(doc,{title:'Renommer la catégorie',fields:[{name:'name',label:'Nom',value:type.name,required:true,maxLength:120}]});if(r)await run(()=>call({method:'POST',action:'rename_type',typeId:type.id,expectedRevision:type.revision,name:r.name}));}),b(type.disabled?'Activer':'Désactiver',()=>void run(()=>call({method:'POST',action:'disable_type',typeId:type.id,expectedRevision:type.revision,disabled:!type.disabled}),'Catégorie actualisée. Les inscriptions sont conservées.')));categories.append(row)}
 }
 reload().then(()=>{status.textContent='';}).catch(e=>status.textContent='Chargement impossible : '+e.message);
 return {reload,destroy(){destroyed=true;++epoch;root.replaceChildren()}};
}
