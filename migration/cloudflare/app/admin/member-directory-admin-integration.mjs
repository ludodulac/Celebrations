// M009-B opt-in bridge INSIDE the existing administration: reuses M007-B UI.
// The parent editor supplies an ADMIN-authenticated server transport.
// This is a UI only; the server rechecks the admin session and DB state.
// No Worker entrypoint imports this component yet.
import {mountMemberAccessAdmin} from './member-access-admin-ui.mjs';
import {createMemberAdminState} from './member-access-admin-model.mjs';

export function mountMemberDirectoryAdmin(root,{transport,styleNonce}={}) {
  if(!root?.ownerDocument || typeof root.replaceChildren!=='function' ||
     typeof transport!=='function') throw new TypeError('Admin root/transport required');
  const document=root.ownerDocument;
  let ui=null, state=null, selected='', destroyed=false, busy=false;
  let search='',pageCursors=[''],pageInfo={hasMorePeople:false,nextCursor:null};
  const node=(tag,text='')=>{
    const n=document.createElement(tag);
    n.textContent=text;
    return n;
  };
  const style=node('style');
  if(styleNonce)style.nonce=styleNonce;
  style.textContent=[
    '.member-directory-009b{max-width:100%;overflow-wrap:anywhere}',
    '.member-directory-009b .member-admin-layout{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:1rem}',
    '.member-directory-009b input,.member-directory-009b select,.member-directory-009b button{max-width:100%;min-height:40px}',
    '.member-directory-009b .member-admin-card{min-width:0}',
    '.member-directory-009b .member-dir-tools{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:1rem}',
    '.member-directory-009b fieldset{min-width:0}',
    '.member-directory-009b .member-dir-pager{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center}',
    '.member-directory-009b .member-dir-search{display:flex;flex-wrap:wrap;gap:.6rem}',
    '@media(max-width:720px){.member-directory-009b .member-dir-tools{display:block}.member-directory-009b button{min-height:44px}}'
  ].join('\n');
  const wrapper=node('section');
  wrapper.className='member-directory-009b';
  const heading=node('h2','Annuaire et droits des membres');
  const message=node('p','Chargement de l’annuaire…');
  message.setAttribute('role','status');
  const searchTools=node('div');
  const base=node('div');
  const tools=node('div');
  tools.className='member-dir-tools';
  wrapper.append(heading,message,searchTools,base,tools);
  root.replaceChildren(style,wrapper);

  const call=async command=>{
    const response=await transport(command);
    if(!response?.ok) throw new Error(response?.error||'Opération refusée');
    return response.data??response.result??response;
  };
  function label(text,control) {
    const element=node('label');
    element.append(node('span',text),control);
    return element;
  }
  function button(text,type='button') {
    const element=node('button',text);element.type=type;return element;
  }
  function selectedPerson() {return state?.members.find(person=>person.id===selected);}
  function status(text) {if(!destroyed) message.textContent=text;}
  function memberCommand(next,detail) {
    const kind=detail?.kind;
    if(kind==='type-created') {
      const t=next.types.find(t=>!state.types.some(old=>old.id===t.id));
      if(t) return {action:'create_type',typeId:t.id,name:t.name};
    }
    if(kind==='type-renamed') {
      const t=next.types.find(t=>state.types.some(old=>old.id===t.id && old.name!==t.name));
      if(t) return {action:'rename_type',typeId:t.id,name:t.name,
        expectedRevision:state.types.find(old=>old.id===t.id).revision??0};
    }
    if(kind==='membership-updated') {
      const changed=next.members.find(person=>{
        const old=state.memberships.filter(m=>m.memberId===person.id).map(m=>m.typeId).sort();
        const current=next.memberships.filter(m=>m.memberId===person.id).map(m=>m.typeId).sort();
        return JSON.stringify(old)!==JSON.stringify(current);
      });
      if(changed) return {action:'set_person_types',personId:changed.id,
        typeIds:next.memberships.filter(m=>m.memberId===changed.id).map(m=>m.typeId),
        expectedRevision:changed.revision??0};
    }
    // Page policy writes are intentionally blocked until the canonical
    // publication pipeline and per-page optimistic-lock contracts are ready.
    return null;
  }
  async function reload() {
    const incoming=await call({method:'GET',action:'snapshot',search,
      cursor:pageCursors.at(-1),limit:50});
    if(destroyed)return;
    pageInfo={hasMorePeople:!!incoming.hasMorePeople,
      nextCursor:incoming.nextCursor??null};
    state=createMemberAdminState(incoming);
    if(!state.members.some(p=>p.id===selected)) selected=state.members[0]?.id||'';
    if(ui) ui.setState(state);
    else ui=mountMemberAccessAdmin(base,{initialState:state,
      pagePolicyWritable:false,
      warningText:'Annuaire D1 relié au service administrateur vérifié. ' +
        'Les autorisations de pages ne sont pas encore sauvegardées dans le moteur éditorial ; ' +
        'aucun espace privé n’est activé en production.',onChange:(next,detail)=>{
      if(busy || destroyed) return;
      const command=memberCommand(next,detail);
      if(!command) {
        ui.setState(state);
        status('Politique de page non sauvegardée : raccordement éditorial requis.');
        return;
      }
      busy=true;
      status('Enregistrement sécurisé…');
      call({method:'POST',...command}).then(reload).then(()=>{
        status('Modification enregistrée et état D1 rechargé.');
      }).catch(error=>{
        ui.setState(state);
        status('Écriture refusée : '+error.message);
      }).finally(()=>{busy=false;});
    }});
    renderSearchTools();
    renderTools();
  }
  function renderSearchTools() {
    searchTools.replaceChildren();
    const form=node('form');form.className='member-dir-search';
    const input=node('input');
    input.type='search';input.value=search;input.maxLength=120;
    input.placeholder='Nom ou adresse e-mail';input.setAttribute('aria-label','Rechercher une personne');
    form.append(input,button('Rechercher','submit'));
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(busy)return;
      busy=true;search=input.value.trim();pageCursors=[''];
      try{await reload();status('Résultats de la recherche actualisés.');}
      catch(e){status('Recherche indisponible : '+e.message);}
      finally{busy=false;}
    });
    const pager=node('div');pager.className='member-dir-pager';
    const previous=button('Page précédente');
    previous.disabled=pageCursors.length===1;
    previous.addEventListener('click',async()=>{
      if(busy||pageCursors.length===1)return;
      busy=true;const old=pageCursors.pop();
      try{await reload();}catch(e){pageCursors.push(old);status(e.message);}
      finally{busy=false;}
    });
    const next=button('Page suivante');
    next.disabled=!pageInfo.hasMorePeople||!pageInfo.nextCursor;
    next.addEventListener('click',async()=>{
      if(busy||!pageInfo.nextCursor)return;
      busy=true;pageCursors.push(pageInfo.nextCursor);
      try{await reload();}catch(e){pageCursors.pop();status(e.message);}
      finally{busy=false;}
    });
    const position=node('span','Page '+pageCursors.length+
      ' · '+state.members.length+' personnes affichées');
    pager.append(previous,position,next);
    searchTools.append(form,pager);
  }
  async function refreshDetails(target) {
    if(!target) return null;
    return call({method:'GET',action:'person_detail',personId:target});
  }
  function renderTools() {
    tools.replaceChildren();
    const createCard=node('section');createCard.className='member-admin-card';
    createCard.append(node('h3','Créer un contact'));
    const createForm=node('form');
    const email=node('input');email.type='email';email.required=true;
    email.placeholder='prenom@exemple.fr';
    const given=node('input');given.maxLength=120;
    const family=node('input');family.maxLength=120;
    const display=node('input');display.maxLength=120;
    const createError=node('p');createError.setAttribute('role','alert');
    createForm.append(label('Adresse e-mail',email),label('Prénom',given),
      label('Nom',family),label('Nom affiché',display),
      button('Créer la personne','submit'),createError);
    createForm.addEventListener('submit',async event=>{
      event.preventDefault();if(busy)return;busy=true;
      try{
        await call({method:'POST',action:'create_person',email:email.value,
          givenName:given.value,familyName:family.value,displayName:display.value});
        search=email.value.trim();pageCursors=[''];
        await reload();status('Personne créée avec un identifiant permanent.');
      }catch(e){createError.textContent=e.message;}
      finally{busy=false;}
    });
    createCard.append(createForm);tools.append(createCard);
    const card=node('section');
    card.className='member-admin-card';
    card.append(node('h3','Participations et espaces privés'));
    if(!state.members.length) {
      card.append(node('p','Aucune personne chargée.'));tools.append(card);
      return;
    }
    const selector=node('select');
    for(const person of state.members) {
      const option=node('option',person.name||person.id);
      option.value=person.id;option.selected=person.id===selected;
      selector.append(option);
    }
    selector.addEventListener('change',()=>{
      selected=selector.value;
      renderTools();
    });
    card.append(label('Personne du répertoire D1',selector));
    const details=node('div','Chargement des participations…');
    card.append(details);
    refreshDetails(selected).then(data=>{
      if(destroyed || selected!==data.person.id) return;
      details.replaceChildren();
      details.append(node('p','Identifiant permanent : '+data.person.id));
      const editForm=node('form');
      const contactEmail=node('input');contactEmail.type='email';contactEmail.required=true;
      contactEmail.value=data.person.emailNormalized??'';
      const contactGiven=node('input');contactGiven.maxLength=120;
      contactGiven.value=data.person.givenName??'';
      const contactFamily=node('input');contactFamily.maxLength=120;
      contactFamily.value=data.person.familyName??'';
      const contactDisplay=node('input');contactDisplay.maxLength=120;
      contactDisplay.value=data.person.displayName??'';
      const editError=node('p');editError.setAttribute('role','alert');
      editForm.append(label('Courriel',contactEmail),label('Prénom',contactGiven),
        label('Nom',contactFamily),label('Nom affiché',contactDisplay),
        button('Mettre à jour la personne','submit'),editError);
      editForm.addEventListener('submit',async event=>{
        event.preventDefault();if(busy)return;busy=true;
        try {
          await call({method:'POST',action:'update_person',personId:data.person.id,
            expectedRevision:data.person.revision??0,
            changes:{email:contactEmail.value,givenName:contactGiven.value,
              familyName:contactFamily.value,displayName:contactDisplay.value}});
          await reload();status('Fiche mise à jour.');
        }catch(e){editError.textContent=e.message;}
        finally{busy=false;}
      });
      details.append(editForm);
      details.append(node('p','Célébrations : '+
        (data.celebrations.map(x=>x.celebrationId).join(', ')||'aucune')));
      details.append(node('p','Espaces privés : '+
        (data.enrollments.map(x=>x.spaceId).join(', ')||'aucun')));
      function removeLink(text,command) {
        const control=button(text);
        control.addEventListener('click',async()=>{
          if(busy)return;
          busy=true;
          try {
            await call({method:'POST',expectedRevision:data.person.revision??0,...command});
            await reload();status('Association retirée par le serveur.');
          }catch(e){status('Suppression refusée : '+e.message);}
          finally {busy=false;}
        });
        details.append(control);
      }
      for(const link of data.enrollments)
        removeLink('Désinscrire : '+link.spaceId,
          {action:'remove_enrollment',personId:selected,spaceId:link.spaceId});
      for(const link of data.celebrations)
        removeLink('Retirer la participation : '+link.celebrationId,
          {action:'remove_celebration',personId:selected,
            celebrationId:link.celebrationId});
    }).catch(()=>{details.textContent='Données non disponibles.';});
    const form=node('form');
    const celebration=node('input');
    celebration.required=true;
    celebration.placeholder='ID numérique de la célébration';
    celebration.inputMode='numeric';
    const add=button('Ajouter la participation','submit');
    const formError=node('p');formError.setAttribute('role','alert');
    form.append(label('Célébration',celebration),add,formError);
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if(busy) return;
      busy=true;
      try {
        await call({method:'POST',action:'add_celebration',personId:selected,
          expectedRevision:selectedPerson()?.revision??0,
          celebrationId:celebration.value});
        await reload();status('Participation ajoutée.');
      } catch(e) {formError.textContent=e.message;}
      finally {busy=false;}
    });
    card.append(form);
    const enrollForm=node('form');
    const space=node('input');
    space.required=true;space.placeholder='ID permanent de l’espace privé';
    const enrollError=node('p');enrollError.setAttribute('role','alert');
    enrollForm.append(label('Espace',space),
      button('Inscrire individuellement','submit'),enrollError);
    enrollForm.addEventListener('submit',async event=>{
      event.preventDefault();if(busy)return;
      busy=true;
      try {
        await call({method:'POST',action:'enroll_space',personId:selected,
          expectedRevision:selectedPerson()?.revision??0,spaceId:space.value});
        await reload();status('Inscription vérifiée par le serveur.');
      } catch(e) {enrollError.textContent=e.message;}
      finally {busy=false;}
    });
    card.append(enrollForm);
    tools.append(card);

    const types=node('section');types.className='member-admin-card';
    types.append(node('h3','Suspension des types'));
    for(const type of state.types) {
      const row=node('div');
      const toggle=button((type.disabled?'Réactiver : ':'Suspendre : ')+type.name);
      toggle.addEventListener('click',async()=>{
        if(busy)return;busy=true;
        try {
          await call({method:'POST',action:'disable_type',typeId:type.id,
            expectedRevision:type.revision??0,disabled:!type.disabled});
          await reload();status('Catalogue D1 actualisé.');
        }catch(e){status('Écriture refusée : '+e.message);}
        finally {busy=false;}
      });
      row.append(toggle);types.append(row);
    }
    tools.append(types);
    const claims=node('section');claims.className='member-admin-card';
    claims.append(node('h3','Rapprochements d’identité (validation manuelle)'));
    const note=node('p','Une correspondance d’e-mail ne constitue pas une preuve. '+
      'L’administrateur doit vérifier indépendamment l’identité avant validation.');
    claims.append(note);
    call({method:'GET',action:'pending_claims'}).then(items=>{
      if(destroyed)return;
      for(const item of items) {
        const form=node('form');
        form.append(node('p','Compte : '+item.participantEmail+
          ' ; personne : '+item.personId+' ('+(item.displayName||item.directoryEmail)+')'));
        const method=node('select');
        for(const [id,title] of [
          ['','Choisir une vérification'],
          ['in_person','Contrôle en personne'],
          ['independent_records','Documents indépendants'],
          ['video_verified','Vérification vidéo']
        ]) {
          const option=node('option',title);option.value=id;method.append(option);
        }
        const checked=node('input');checked.type='checkbox';
        const confirmation=label('Je confirme avoir vérifié indépendamment l’identité',
          checked);
        const approve=button('Valider le rapprochement','submit');
        const reject=button('Refuser la demande');
        const err=node('p');err.setAttribute('role','alert');
        form.append(label('Méthode',method),confirmation,approve,reject,err);
        const review=async approved=>{
          if(busy)return;
          if(approved && (!checked.checked || !method.value)) {
            err.textContent='Vérification indépendante obligatoire.';return;
          }
          busy=true;
          try {
            await call({method:'POST',action:'review_claim',claimId:item.claimId,
              approve:approved,verificationMethod:approved?method.value:undefined});
            await reload();status('Décision inscrite au journal.');
          }catch(e){err.textContent=e.message;}
          finally {busy=false;}
        };
        form.addEventListener('submit',event=>{event.preventDefault();review(true);});
        reject.addEventListener('click',()=>review(false));
        claims.append(form);
      }
      if(!items.length) claims.append(node('p','Aucune demande en attente.'));
    }).catch(()=>{claims.append(node('p','Demandes indisponibles.'));});
    tools.append(claims);
  }

  reload().then(()=>status('Annuaire D1 chargé.')).catch(err=>{
    status('Administration indisponible : '+err.message);
  });
  return {reload,destroy(){destroyed=true;ui?.destroy();root.replaceChildren();}};
}
