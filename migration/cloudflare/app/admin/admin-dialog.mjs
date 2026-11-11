// Shared native-site dialog: no browser prompts; text only, focus restored.
export function adminDialog(document,{title='Confirmer',message='',fields=[],confirm='Valider',cancel='Annuler'}={}){
 return new Promise(resolve=>{
  const previous=document.activeElement,dialog=document.createElement('dialog');
  dialog.className='admin-dialog';
  const form=document.createElement('form');form.method='dialog';
  const heading=document.createElement('h2');heading.textContent=title;heading.id='dialog-'+crypto.randomUUID();
  dialog.setAttribute('aria-labelledby',heading.id);form.append(heading);
  const note=document.createElement('p');note.textContent=message;form.append(note);
  const controls={};
  for(const f of fields){
   if(f.multiple||f.radio){
    const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=f.label;group.append(legend);
    const inputs=[];
    for(const [value,name] of f.options){const row=document.createElement('label'),check=document.createElement('input');check.type=f.radio?'radio':'checkbox';check.name=f.name;check.value=value;check.checked=f.radio?f.value===value:(f.value??[]).includes(value);row.append(check,document.createTextNode(name));group.append(row);inputs.push(check)}
    controls[f.name]={get value(){return f.radio?inputs.find(x=>x.checked)?.value:inputs.filter(x=>x.checked).map(x=>x.value)}};form.append(group);continue;
   }
   const label=document.createElement('label'),caption=document.createElement('span');caption.textContent=f.label;
   const input=document.createElement(f.options?'select':'input');
   if(f.options)for(const [value,name] of f.options){const o=document.createElement('option');o.value=value;o.textContent=name;input.append(o)}
   else input.type=f.type||'text';
   input.value=f.value??'';input.required=!!f.required;
   if(f.maxLength)input.maxLength=f.maxLength;
   controls[f.name]=input;label.append(caption,input);form.append(label);
  }
  const actions=document.createElement('div');actions.className='admin-dialog-actions';
  const no=document.createElement('button');no.type='button';no.textContent=cancel;no.className='btn';
  const yes=document.createElement('button');yes.type='submit';yes.textContent=confirm;yes.className='btn primary';
  let finished=false;
  const finish=value=>{if(finished)return;finished=true;dialog.close();dialog.remove();previous?.focus();resolve(value)};
  no.onclick=()=>finish(null);dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null)});
  form.onsubmit=event=>{event.preventDefault();if(form.reportValidity())finish(Object.fromEntries(Object.entries(controls).map(([k,v])=>[k,v.value])))};
  actions.append(no,yes);form.append(actions);dialog.append(form);document.body.append(dialog);dialog.showModal();
  (form.querySelector('input,select')||yes).focus();
 });
}
