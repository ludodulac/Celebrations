// M006 — Accessible, optional public language selector.
// Prepared DOM component; not injected into the shared public renderer yet.
// No HTML string injection, global event listener, private storage or editor API.
const flagImage=/^(?:\/)?(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:svg|png|webp|gif)$/i;

function appendFlag(parent,flag,doc) {
 const value=typeof flag==='string'?flag:'';
 if(value&&!value.includes('..')&&flagImage.test(value)) {
  const image=doc.createElement('img');
  image.className='public-language-flag';
  image.setAttribute('alt','');
  image.setAttribute('loading','lazy');
  image.setAttribute('src',value.startsWith('/')?value:'/'+value);
  parent.append(image);
 }else{
  const span=doc.createElement('span');
  span.className='public-language-flag';
  span.textContent=value||'🌐';
  parent.append(span);
 }
}

function addLanguageLabel(parent,option,doc) {
 appendFlag(parent,option.flag,doc);
 const name=doc.createElement('span');
 name.textContent=option.name;
 name.className='public-language-name';
 parent.append(name);
}

export function renderPublicLanguageSelector(container,options,{label='Choisir la langue'}={}) {
 if(!container||!container.ownerDocument||
    !Array.isArray(options)||!options.length)
  throw new TypeError('Conteneur DOM et langues publiques requises.');
 const doc=container.ownerDocument;
 const details=doc.createElement('details');
 details.className='public-language-selector';
 const summary=doc.createElement('summary');
 summary.setAttribute('aria-label',label);
 const selected=options.find(option=>option.selected)||options[0];
 addLanguageLabel(summary,selected,doc);
 details.append(summary);
 const list=doc.createElement('ul');
 list.className='public-language-options';
 for(const option of options){
  const row=doc.createElement('li'),link=doc.createElement('a');
  // href has already been built by the pure M006 same-origin router.
  link.setAttribute('href',option.href);
  link.setAttribute('hreflang',option.id);
  link.setAttribute('lang',option.id);
  if(option.selected)link.setAttribute('aria-current','true');
  addLanguageLabel(link,option,doc);
  row.append(link);list.append(row);
 }
 details.append(list);
 container.replaceChildren(details);
 return details;
}
