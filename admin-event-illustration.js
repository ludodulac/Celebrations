// Image d’illustration propre au rendez-vous, distincte des contenus associés.
(function(){
  const KIND='event-illustration';
  const marker=e=>(e?.links||[]).find(l=>l.kind===KIND);
  const illustrationId=e=>{const m=marker(e);return m?String(m.url||'').replace(/^content:/,''):''};
  const setIllustration=(e,id)=>{
    const keep=(e.links||[]).filter(l=>l.kind!==KIND);
    e.links=id?[...keep,{label:'Image d’illustration',url:'content:'+id,kind:KIND}]:keep;
  };

  window.showDayEventForm=function(dayKey,eventId=null){
    const c=selected(),e=eventId!=null?state.events.find(x=>String(x.id)===String(eventId)):null,target=document.getElementById('dayEventForm');if(!target)return;
    const currentIllustration=illustrationId(e);
    const images=state.contents.filter(x=>x.type==='Image'&&x.sourceType==='file');
    target.innerHTML=`<div class="notice" style="margin-bottom:14px">
      <div class="form-grid">
        <label class="field"><span>Heure</span><input id="evtTime" type="time" value="${esc(e?.time||'')}"></label>
        <label class="field"><span>Visible pour</span><select id="evtGroup">${groupOptions(e?.audience||'all')}</select></label>
        <label class="field full"><span>Titre</span><input id="evtTitle" value="${esc(e?.title||'')}"></label>
        <label class="field full"><span>Description</span><textarea id="evtDesc">${esc(e?.description||'')}</textarea></label>
      </div>
      <div class="card" style="margin-top:14px;border-left:5px solid var(--accent)">
        <div class="eyebrow">Illustration du rendez-vous</div>
        <div class="meta" style="margin:5px 0 10px">Cette image apparaît en haut à gauche du rendez-vous. Elle est indépendante des documents associés.</div>
        <label class="field"><span>Choisir une image existante</span><select id="evtIllustration"><option value="">Aucune illustration</option>${images.map(img=>`<option value="${esc(String(img.id))}" ${String(img.id)===currentIllustration?'selected':''}>${esc(img.name)}</option>`).join('')}</select></label>
        <label class="field" style="margin-top:10px"><span>Ou importer / remplacer l’illustration</span><input id="evtIllustrationFile" type="file" accept="image/*"></label>
      </div>
      <h4>Documents et contenus associés</h4>
      <div class="meta" style="margin-bottom:8px">Ces éléments apparaissent comme pièces jointes. Ils ne définissent pas l’image principale du rendez-vous.</div>
      ${contentChecks(e?.contentIds||[],'evtContent')}
      <div class="actions" style="margin-top:10px"><button class="btn small" id="createEventContent">+ Créer un contenu</button></div>
      <div id="eventInlineContent"></div>
      <div class="actions" style="margin-top:14px"><button class="btn primary" id="saveEventBtn">${e?'Enregistrer':'Ajouter'}</button><button class="btn" id="cancelEventBtn">Annuler</button></div>
    </div>`;

    document.getElementById('cancelEventBtn').onclick=()=>{target.innerHTML=''};
    document.getElementById('createEventContent').onclick=()=>renderInlineContentCreator('eventInlineContent',id=>{
      const ids=[...document.querySelectorAll('input[name=evtContent]:checked')].map(x=>x.value);ids.push(String(id));
      document.querySelectorAll('input[name=evtContent]').forEach(x=>x.checked=ids.includes(String(x.value)));
    });

    document.getElementById('saveEventBtn').onclick=async()=>{
      const title=evtTitle.value.trim();if(!title)return toast('Indiquez un titre');
      let illustration=evtIllustration.value||'';
      const file=evtIllustrationFile.files[0];
      if(file){
        if(!file.type.startsWith('image/'))return toast('L’illustration doit être une image');
        const id=Date.now();
        const item={id,name:`Illustration — ${title}`,type:'Image',category:'Images',audience:'all',description:'Illustration du rendez-vous',sourceType:'file',url:'',text:'',fileName:file.name,mimeType:file.type||'',storagePath:'',hasCover:false};
        await putMedia(id,file);state.contents.push(item);illustration=String(id);
      }
      const contentIds=[...document.querySelectorAll('input[name=evtContent]:checked')].map(x=>{const raw=x.value;return /^\d+$/.test(raw)?Number(raw):raw});
      const data={celebrationId:c.id,dayKey,time:evtTime.value,title,audience:evtGroup.value,description:evtDesc.value,contentIds};
      let saved=e;
      if(saved)Object.assign(saved,data);else{saved={id:Date.now()+1,...data,links:[],sortOrder:state.events.filter(x=>x.celebrationId===c.id&&x.dayKey===dayKey).length};state.events.push(saved)}
      setIllustration(saved,illustration);
      saveState(state);editDay(dayKey);toast('Rendez-vous enregistré');
    };
  };
})();
