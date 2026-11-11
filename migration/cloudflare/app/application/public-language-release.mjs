// M008-A — server-side PUBLIC projection. Private M004 editor variants never reach the visitor.
// Only explicitly published language registry and per-page releases are consumed.
import {createPreparedLanguageRegistry as createLanguageRegistry,selectLanguage,setPageTranslation,resolvePageTranslation}
 from '../domain/editor-localization.mjs';
import {activePublicLanguages,languageFromUrl} from '../domain/public-language-navigation.mjs';
import {eligiblePublicPage,projectPublicPage} from '../domain/editor-public-projection-security.mjs';

const hasOwn=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const clone=value=>structuredClone(value);
// Visitor pages consume names and rendered blocks. Other translation fields
// are editor-only aggregates and must never be serialized verbatim.
const publicFields=['name','blocks'];

export function publishedLanguageRegistry(published){
 try{return {...createLanguageRegistry(published?.languageRegistry),defaultLanguageId:'fr'}}
 catch{return createLanguageRegistry()} // Old publication always remains French.
}

export function localizedPublishedPage(page,registry,languageId,releases={}){
 // Canonical identity, routing, publication and access fields are NEVER localized.
 const canonical={...clone(page)};
 for(const field of ['translations','localization','publishedTranslations'])
  delete canonical[field];
 const release=hasOwn(releases,String(canonical.id))?releases[String(canonical.id)]:null;
 const content=release?.publication==='published'&&
  String(release.pageId)===String(canonical.id)&&
  release.variants&&typeof release.variants==='object'&&!Array.isArray(release.variants)
  ?release.variants:null;
 let withPublished=canonical;
 if(content)for(const [id,variant] of Object.entries(content)){
  // Fail closed on disabled, malformed and stale releases.
  if(!registry.languages.some(lang=>lang.id===id&&lang.active))continue;
  try{withPublished=setPageTranslation(withPublished,registry,id,variant)}
  catch{} // Invalid releases do not erase the original French page.
 }
 let result;
 try{result=resolvePageTranslation(withPublished,registry,languageId)}
 catch{return projectPublicPage(canonical)}
 if(!result)return null; // No active published version: never re-enable a disabled source language.
 const rendered={...canonical};
 for(const field of publicFields)
  if(hasOwn(result.content,field))rendered[field]=clone(result.content[field]);
 const projected=projectPublicPage(rendered);
 if(projected)Object.assign(projected,{languageId:result.languageId,
  requestedLanguageId:languageId,usedFallback:result.languageId!==languageId});
 return projected;
}

export function publishedLanguageOptions(snapshot,published,registry,selected,url){
 const pages=[...(snapshot.shared?.pages||[]),
  ...(snapshot.celebrationVisible?snapshot.record?.pages||[]:[]),
  ...(snapshot.record?.spaces||[]).flatMap(s=>s.pages||[])];
 const available=new Set(['fr']);
 for(const page of pages)for(const lang of registry.languages){
  const resolved=localizedPublishedPage(page,registry,lang.id,{...(published?.privateTranslationReleases||{}),...(published?.translationReleases||{})});
  if(resolved?.languageId===lang.id&&resolved.blocks.length)available.add(lang.id);
 }
 const options=activePublicLanguages(registry,selected,url).filter(l=>available.has(l.id));
 return options.length>1?options:[];
}

export function projectPublishedLanguage(snapshot,published,requestUrl,availabilitySnapshot=snapshot){
 const registry=publishedLanguageRegistry(published);
 const requested=languageFromUrl(requestUrl);
 const selected=selectLanguage(registry,requested);
 const releases={...(published?.privateTranslationReleases||{}),...(published?.translationReleases||{})};
 const mapPages=pages=>(pages||[]).map(page=>localizedPublishedPage(page,registry,selected.languageId,releases)).filter(Boolean);
 const shared={...snapshot.shared,pages:mapPages(snapshot.shared?.pages)};
 const record=snapshot.record?{...snapshot.record,
  pages:mapPages(snapshot.record.pages),
  ...(snapshot.record.spaces?{spaces:snapshot.record.spaces.map(s=>({...s,pages:mapPages(s.pages)}))}:{})}:null;
 return {...snapshot,shared,record,publicLanguage:{
  selectedLanguageId:selected.languageId,
  usedFallback:selected.usedFallback,
  options:publishedLanguageOptions(availabilitySnapshot,published,registry,selected.languageId,requestUrl)
 }};
}

// A translation can only be published from an existing PRIVATE M004 variant
// after a separate authorized publication command. Never publish a missing page.
export function publishLanguageCommand(state,published,body){
 const registry=createLanguageRegistry(state.localization?.registry);
 if(body.kind==='language-registry'){
  published.languageRegistry=clone(registry);
  return {languageRegistryPublished:true};
 }
 const pageId=body.pageId,languageId=body.languageId;
 if(typeof pageId!=='string'||typeof languageId!=='string'||languageId==='fr'||
    !['published','draft'].includes(body.visibility))
  throw new TypeError('Commande de traduction invalide');
 const all=[...(published.shared?.pages||[]),
  ...(published.drafts?.[body.celebration]?.pages||[])];
 const page=all.find(p=>p.id===pageId&&eligiblePublicPage(p));
 if(!page)throw new RangeError('La page originale doit être publiée auparavant');
 const language=registry.languages.find(lang=>lang.id===languageId&&lang.active);
 const publicRegistry=publishedLanguageRegistry(published);
 if(!language||!publicRegistry.languages.some(lang=>lang.id===languageId&&lang.active))
  throw new RangeError('Publiez d’abord le registre avec cette langue activée');
 const releases=published.translationReleases||={};
 const original=releases[pageId];
 const variants={...(original?.publication==='published'?original.variants:{})};
 if(body.visibility==='published'){
  const draft=state.localization?.pages?.[pageId]?.[languageId];
  if(!draft)throw new RangeError('Traduction privée inexistante');
  // M003 validates the complete variant and forbids changing IDs or permissions.
  const checked=setPageTranslation(page,registry,languageId,draft);
  variants[languageId]=clone(checked.translations[languageId]);
 }else delete variants[languageId];
 if(Object.keys(variants).length)
  releases[pageId]={publication:'published',pageId,variants};
 else delete releases[pageId];
 return {pageId,languageId,translationVisibility:body.visibility};
}
