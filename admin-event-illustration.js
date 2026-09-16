// Image d’illustration propre au rendez-vous, distincte des contenus associés.
(function(){
  const KIND='event-illustration';
  const marker=e=>(e?.links||[]).find(l=>l.kind===KIND);
  const illustrationId=e=>{const m=marker(e);return m?String(m.url||'').replace(/^content:/,''):''};
  const setIllustration=(e,id)=>{
    const keep=(e.links||[]).filter(l=>l.kind!==KIND);
    e.links=id?[...keep,{label:'Image d’illustration',url:'content:'+id,kind:KIND}]:keep;
  };
  const usableIllustrations=()=>state.contents.filter(x=>(x.type==='Image'&&x.sourceType==='file'&&x.storagePath)||x.hasCover);
  const imagePath=c=>c.type==='Image'&&c.sourceType==='file'?c.storagePath:c.coverStoragePath;
  const imageUrl=c=>{const p=imagePath(c);return p&&typeof supabaseMediaUrl==='function'?supabaseMediaUrl(p):''};
  const galleryHtml=(images,current)=>`<div id="evtIllustrationGallery" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:10px;margin-top:8px">
    <button type="button" data-illustration-id="" aria-label="Aucune illustration" style="min-height:92px;border:2px solid ${current?'#ddd':'var(--accent)'};border-radius:10px;background:#fff;cursor:pointer;padding:8px"><span style="font-size:28px;display:block">∅</span><span class="meta">Aucune</span></button>
    ${images.map(img=>{const id=String(img.id),url=imageUrl(img);return `<button type="button" data-illustration-id="${esc(id)}" title="${esc(img.name||'Illustration')}" aria-label="${esc(img.name||'Illustration')}" style="height:92px;border:3px solid ${id===current?'var(--accent)':'transparent'};border-radius:10px;background:#f4f4f4;cursor:pointer;padding:2px;overflow:hidden"><img src="${esc(url)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:7px;display:block"></button>`}).join('')}
  </div>`;

  window.showDayEventForm=function(dayKey,eventId=null){
    const c=selected(),e=eventId!=null?state.events.find(x=>String(x.id)===String(eventId)):null,target=document.getElementById('dayEventForm');if(!target)return;
    let currentIllustration=illustrationId(e);
    const images=usableIllustrations();
    target.innerHTML=`<div class="notice" style="margin-bottom:14px">
      <div class="form-grid">
        <label class="field"><span>Heure</span><input id="evtTime" type="time" value="${esc(e?.time||'')}"></label>
        <label class="field"><span>Visible pour</span><select id="evtGroup">${groupOptions(e?.audience||'all')}</select></label>
        <label class="field full"><span>Titre</span><input id="evtTitle" value="${esc(e?.title||'')}"></label>
        <label class="field full"><span>Description</span><textarea id="evtDesc">${esc(e?.description||'')}</textarea></label>
      </div>
      <div class="card" style="margin-top:14px;border-left:5px solid var(--accent)">
        <div class="eyebrow">Choisir une illustration</div>
        <div class="meta" style="margin:5px 0 10px">Clique simplement sur une image. Le nom n’est affiché qu’en info-bulle si tu en as besoin.</div>
        ${galleryHtml(images,currentIllustration)}
        <input id="evtIllustration" type="hidden" value="${esc(currentIllustration)}">
        <label class="field" style="margin-top:12px"><span>Ou importer / remplacer l’illustration</span><input id="evtIllustrationFile" type="file" accept="image/*"></label>
      </div>
      <h4>Documents et contenus associés</h4>
      <div class="meta" style="margin-bottom:8px">Ces éléments apparaissent comme pièces jointes. Ils ne définissent pas l’image principale du rendez-vous.</div>
      ${contentChecks(e?.contentIds||[],'evtContent')}
      <div class="actions" style="margin-top:10px"><button class="btn small" id="createEventContent">+ Créer un contenu</button></div>
      <div id="eventInlineContent"></div>
      <div class="actions" style="margin-top:14px"><button class="btn primary" id="saveEventBtn">${e?'Enregistrer':'Ajouter'}</button><button class="btn" id="cancelEventBtn">Annuler</button></div>
    </div>`;

    const gallery=document.getElementById('evtIllustrationGallery');
    gallery.onclick=ev=>{
      const b=ev.target.closest('[data-illustration-id]');if(!b)return;
      currentIllustration=b.dataset.illustrationId||'';evtIllustration.value=currentIllustration;
      gallery.querySelectorAll('[data-illustration-id]').forEach(x=>x.style.borderColor=(x.dataset.illustrationId||'')===currentIllustration?'var(--accent)':'transparent');
    };
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
