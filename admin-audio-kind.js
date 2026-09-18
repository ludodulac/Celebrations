const AUDIO_KINDS=['Chants audio','Audios parlés'];
const AUDIO_KIND_VALUES={'Chants audio':'chant','Audios parlés':'spoken'};
function canonicalAudioKind(c){
  if(!c||c.type!=='Audio')return '';
  if(c.category==='Chants audio'||String(c.audioKind||'').toLowerCase()==='chant')return 'Chants audio';
  if(c.category==='Audios parlés'||['spoken','parle','parlé','speech'].includes(String(c.audioKind||'').toLowerCase()))return 'Audios parlés';
  return '';
}
function applyAudioKind(c,kind){
  if(!c||c.type!=='Audio'||!AUDIO_KINDS.includes(kind))return false;
  c.category=kind;c.audioKind=AUDIO_KIND_VALUES[kind];ensureCategory(kind);return true;
}
window.canonicalAudioKind=canonicalAudioKind;
window.applyAudioKind=applyAudioKind;
AUDIO_KINDS.forEach(ensureCategory);
saveState(state);

function audioKindField(value='Audios parlés',marker='audioKind'){
  return `<label class="field audio-kind-field"><span>Type d’audio</span><select data-audio-kind="${marker}" required><option value="">Choisir</option>${AUDIO_KINDS.map(x=>`<option value="${x}" ${x===value?'selected':''}>${x}</option>`).join('')}</select></label>`;
}

function installAudioKindFields(root=document){
  root.querySelectorAll('#mediaForm').forEach(form=>{
    const active=document.querySelector('.type-card.active')?.dataset.type;
    if(active==='Audio'&&!form.querySelector('[data-audio-kind=global]'))form.querySelector('.form-grid')?.insertAdjacentHTML('afterbegin',audioKindField('', 'global'));
  });
  root.querySelectorAll('[data-f=type]').forEach(type=>{
    if(type.dataset.audioKindBound)return;type.dataset.audioKindBound='1';
    const sync=()=>{const card=type.closest('.card');if(!card)return;card.querySelector('.audio-kind-field')?.remove();if(type.value==='Audio')type.closest('.form-grid')?.insertAdjacentHTML('beforeend',audioKindField('', 'inline'))};
    type.addEventListener('change',()=>setTimeout(sync,0));sync();
  });
}

const audioObserver=new MutationObserver(()=>installAudioKindFields());
audioObserver.observe(document.getElementById('panel'),{childList:true,subtree:true});
installAudioKindFields();

const editContentBeforeAudioKind=editContent;
editContent=function(id){
  editContentBeforeAudioKind(id);
  const c=state.contents.find(x=>x.id===id);if(!c||c.type!=='Audio')return;
  const value=canonicalAudioKind(c)||'Audios parlés';
  const grid=document.querySelector('#panel .form-grid');if(grid&&!document.querySelector('[data-audio-kind=edit]'))grid.insertAdjacentHTML('beforeend',audioKindField(value,'edit'));
  const save=document.getElementById('saveContentEdit');if(save){const old=save.onclick;save.onclick=async ev=>{const kind=document.querySelector('[data-audio-kind=edit]')?.value;if(!kind)return toast('Choisissez Chant audio ou Audio parlé');applyAudioKind(c,kind);await old?.call(save,ev);saveState(state)}}
};