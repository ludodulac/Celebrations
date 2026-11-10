// M09: pure page lifecycle rules. No browser, storage, network or publication.
// Existing IDs, order, legacy implicit-public visibility and unknown fields stay intact.
export function createPageModel(){
 const visibilityLabels={draft:'Brouillon',published:'Publiée',hidden:'Masquée'};
 const fixedStages=['accueil-celebration','preparation','mercredi','jeudi','vendredi',
  'samedi','dimanche','apres-celebration'];
 const plannedPattern=/^plan-(michael|gabriel|raphael|ouriel)-\d{4}-\d{2}-\d{2}$/;
 function pageSlug(page,celebrationId){
  if(page.group==='page')return page.id;
  const suffix='-'+String(celebrationId||'');
  return suffix!=='-'&&String(page.id).endsWith(suffix)?
   String(page.id).slice(0,-suffix.length):
   String(page.id).slice(0,String(page.id).lastIndexOf('-'));
 }
 function groupPages(pages,group){
  // Never sort: the editor's existing stored order is the only authority.
  return (pages||[]).filter(page=>group==='footer'?
   page.group==='page'&&page.placement==='footer':
   group==='page'?page.group==='page'&&page.placement!=='footer':
   page.group===group);
 }
 function activePageId(pages,group,currentId){
  const visible=groupPages(pages,group);
  return visible.some(p=>p.id===currentId)?currentId:visible[0]?.id??currentId;
 }
 function createPage(group,name,uid,celebrationId){
  const isCelebration=group==='celebration';
  return {
   id:isCelebration?'extra-'+uid+'-'+String(celebrationId||'demo'):'neutral-'+uid,
   name,group:group==='footer'?'page':group,
   ...(group==='footer'?{placement:'footer'}:{}),visibility:'draft',
   blocks:[{id:1,kind:'heading',text:name,align:'center'}]
  };
 }
 function removablePage(page,celebrationId){
  const suffix='-'+String(celebrationId||'');
  const general=page?.group==='page'&&/^neutral-[0-9a-f-]{30,45}$/.test(page.id);
  const extra=page?.group==='celebration'&&
   /^extra-[0-9a-f-]{30,45}-/.test(page.id)&&page.id.endsWith(suffix);
  return {allowed:!!(general||extra),general:!!general};
 }
 function pageVisibility(page){
  // Legacy pages without 'visibility' were public. Never expose actual
  // draft/hidden pages merely because of the refactor.
  return Object.hasOwn(visibilityLabels,page?.visibility)?page.visibility:'published';
 }
 function celebrationVisibility(entry,shared={}){
  const current=shared[entry.id]||entry.visibility;
  return Object.hasOwn(visibilityLabels,current)?current:
   String(entry.id||'').startsWith('plan-')?'draft':'published';
 }
 function publicationIntent(kind,item,visibility){
  if(!Object.hasOwn(visibilityLabels,visibility))return null;
  return kind==='page'?{kind:'page',pageId:item.id,visibility}:
   {kind:'celebration',visibility};
 }
 function editorUrl(celebrationId){
  return '/__editor/demo-preparation?celebration='+encodeURIComponent(celebrationId)+'&tab=celebrations';
 }
 function validPlannedId(id){return typeof id==='string'&&plannedPattern.test(id)}
 function plannedEntry(id,archangel,date,title,customTitle){
  return {id,archangel,date,year:date.slice(0,4),title:title.slice(0,100),
   customTitle,kind:'planned',visibility:'draft'};
 }
 function validSharedPage(page){
  return page?.group==='page'&&Array.isArray(page.blocks)&&
   (page.id==='neutral-accueil-general'||/^neutral-[0-9a-f-]{30,45}$/.test(page.id));
 }
 return {visibilityLabels,fixedStages,pageSlug,groupPages,activePageId,createPage,
  removablePage,pageVisibility,celebrationVisibility,publicationIntent,
  editorUrl,validPlannedId,plannedEntry,validSharedPage};
}
