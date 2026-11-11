// M006 — Public language navigation. No storage, DOM, network or publication writes.
// Reuses M003 translation resolution and M002 canonical authorization.
// IMPORTANT: NEVER read editorState.localization, page.translations or private drafts.
// The optional release is a dedicated PUBLICATION artifact from a trusted server.
import {
 createLanguageRegistry, selectLanguage, setPageTranslation,
 resolvePageTranslation, projectPageMenu
} from './editor-localization.mjs';
import {canAccessPage} from './member-access.mjs';
import {createPublicVisitorModel} from './editor-public-visitor-model.mjs';

export const LANGUAGE_QUERY_PARAMETER = 'lang';
const hasOwn=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const mediaOrAdmin=/^\/(?:api|media|letter|__editor|admin)(?:\/|$)/i;
// Only this legacy __editor path is the PUBLIC visitor renderer, not administration.
const publicVisitorRoute=path=>path==='/__editor/voir-le-site';
const fileExtension=/\.(?:pdf|mp3|wav|mp4|webm|mov|jpe?g|png|gif|webp|svg|avif|zip|docx?|xlsx?)(?:$)/i;

export function languageFromUrl(currentUrl) {
 try { return new URL(currentUrl).searchParams.get(LANGUAGE_QUERY_PARAMETER); }
 catch { return null; }
}

// Only same-origin SITE navigation links get a language parameter. Existing
// media/PDF addresses, external destinations, paths, other queries and hashes
// remain unchanged. Page identity and route slugs are NEVER translated.
export function withLanguageInInternalLink(href, languageId, currentUrl) {
 if(typeof href!=='string'||!href) return href;
 try {
  const base=new URL(currentUrl),target=new URL(href,base);
  if(!['http:','https:'].includes(target.protocol)||target.origin!==base.origin||
     (mediaOrAdmin.test(target.pathname)&&!publicVisitorRoute(target.pathname))||fileExtension.test(target.pathname))
   return href;
  target.searchParams.set(LANGUAGE_QUERY_PARAMETER,languageId);
  return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(href)
   ?target.href:target.pathname+target.search+target.hash;
 } catch { return href; }
}

export function activePublicLanguages(registry,requestedLanguageId,currentUrl) {
 const r=createLanguageRegistry(registry);
 const selected=selectLanguage(r,requestedLanguageId);
 return r.languages.filter(lang=>lang.active).map(lang=>({
  id:lang.id,name:lang.name,flag:lang.flag||'🌐',
  selected:lang.id===selected.languageId,
  href:withLanguageInInternalLink(currentUrl,lang.id,currentUrl)
 }));
}

function canonicalPage(page) {
 // Explicitly discard any embedded variants: M004's editor translations are
 // private until a separate, authorized publication operation publishes them.
 const clean={...page};
 delete clean.translations;
 delete clean.localization;
 delete clean.publishedTranslations;
 return clean;
}

function publicVersion(page,registry,release) {
 let clean=canonicalPage(page);
 // This shape is intentionally NOT compatible with M004's private
 // localization.pages[pageId][lang] object. A future server must atomically
 // produce this dedicated artifact when publishing a page, not when saving.
 if(!release||release.publication!=='published'||
    String(release.pageId)!==String(page.id)||
    !release.variants||typeof release.variants!=='object'||
    Array.isArray(release.variants))return clean;
 for(const [languageId,content] of Object.entries(release.variants)) {
  try {
   clean=setPageTranslation(clean,registry,languageId,content);
  } catch {
   // An invalid or stale released variant is NOT displayed. Use the normal
   // M003 fallback, and never broaden publication or authorization.
  }
 }
 return clean;
}

function safeCanonicalHref(href,currentUrl) {
 if(typeof href!=='string'||!href||/^[\s\x00-\x1f]/.test(href))return null;
 try {
  const base=new URL(currentUrl),target=new URL(href,base);
  if(!['http:','https:'].includes(target.protocol)||target.origin!==base.origin||
     mediaOrAdmin.test(target.pathname)||fileExtension.test(target.pathname))
   return null;
  return href;
 }catch{return null;}
}

/**
 * Prepare an authorized public menu and its translated content.
 *
 * snapshot: ONLY the existing /api/editor-publication response (ok:true).
 * registry: validated M003 registry from a trusted public configuration.
 * publishedPageReleases: ONLY server-published snapshots, NOT M004 drafts.
 * context: trusted M002 identity/enrollments from server (never browser flags).
 * hrefForPage: existing canonical router function; never generate new slugs.
 *
 * An untouched 2026 public endpoint provides no publishedPageReleases, so it
 * safely renders only the original published French page content.
 */
export function preparePublicLanguageNavigation({
 snapshot,registry,requestedLanguageId,currentUrl,
 publishedPageReleases={},context={},hrefForPage
}={}) {
 const view=createPublicVisitorModel().publicSnapshot(snapshot);
 if(!view)return null; // malformed/failed public response: no public menu
 const r=createLanguageRegistry(registry);
 const requested=requestedLanguageId===undefined
  ?languageFromUrl(currentUrl):requestedLanguageId;
 const selected=selectLanguage(r,requested);
 const pages=[...view.shared.pages,
  ...(view.visible?view.record?.pages??[]:[])];
 const eligible=[],seen=new Set(),hrefs=new Map();
 for(const page of pages) {
  if(!page||!canAccessPage(page,context))continue;
  const key=String(page.id);
  if(seen.has(key))continue;
  seen.add(key);
  // Never infer a route from localized name or reconstruct a page identifier.
  const canonical=typeof hrefForPage==='function'?hrefForPage(page):page.href;
  hrefs.set(key,safeCanonicalHref(canonical,currentUrl));
  eligible.push(publicVersion(page,r,hasOwn(publishedPageReleases,key)
   ?publishedPageReleases[key]:null));
 }
 // Reuse M003's canonical-ID projection rather than a second translation engine.
 // M003 keeps its historical safe display fallback where a public
 // translation is not yet ready. This displays existing French text; it
 // NEVER creates or translates page content automatically.
 const projected=projectPageMenu(eligible,r,selected.languageId);
 const byId=new Map(eligible.map(page=>[String(page.id),page]));
 const menu=projected.map(item=>{
  const resolved=resolvePageTranslation(byId.get(String(item.pageId)),r,selected.languageId);
  const href=hrefs.get(String(item.pageId));
  return {...item,href:href===null?null:withLanguageInInternalLink(
   href,selected.languageId,currentUrl),
   // Only localized editorial fields are returned; no editor localization,
   // ACL internals or unpublished private drafts are serialized.
   content:resolved.content};
 });
 return {
  selectedLanguageId:selected.languageId,
  requestedLanguageId:selected.requestedLanguageId,
  usedFallback:selected.usedFallback,
  options:activePublicLanguages(r,selected.languageId,currentUrl),
  menu
 };
}

// M008-A — reuse M006's strict same-origin router inside the nonce-protected
// visitor renderer for page-content buttons. External and media links untouched.
export function publicLanguageLinksInlineSource(){
 return [
  'const LANGUAGE_QUERY_PARAMETER='+JSON.stringify(LANGUAGE_QUERY_PARAMETER)+';',
  'const mediaOrAdmin='+mediaOrAdmin.toString()+';',
  'const fileExtension='+fileExtension.toString()+';',
  'const publicVisitorRoute='+publicVisitorRoute.toString()+';',
  withLanguageInInternalLink.toString()
 ].join('\n');
}
