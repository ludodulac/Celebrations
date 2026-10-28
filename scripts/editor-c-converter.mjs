// Mission C: deterministic, loss-preserving draft-only conversion from the nine legacy D1 collections.
// Rich historic objects are typed reference blocks, NOT coerced into text/image/button blocks.
// No R2 object, source record, slug, audience flag or public publication is changed.
import {createHash} from 'node:crypto';

export const TABLES=[
 'celebrations_celebrations','celebrations_steps','celebrations_events',
 'celebrations_contents','celebrations_event_contents','celebrations_step_contents',
 'celebrations_links','celebrations_footer_drafts',
 'celebrations_committee_letters','celebrations_public_settings'
];
const ORDER=['Préparation','Mercredi','Jeudi','Vendredi','Samedi','Dimanche','Après célébration'];
const DAY_SLUGS=['preparation','mercredi','jeudi','vendredi','samedi','dimanche','apres-celebration'];
const LEGAL=['mentions-legales','confidentialite','cookies'];
const sha=s=>createHash('sha256').update(s).digest('hex');
export function stableId(s){
 const h=sha(String(s));
 return [h.slice(0,8),h.slice(8,12),'4'+h.slice(13,16),'8'+h.slice(17,20),h.slice(20,32)].join('-');
}
const cmp=(a,b)=>String(a).localeCompare(String(b),'fr',{numeric:true});
const byOrder=(a,b)=>Number(a.sort_order??999)-Number(b.sort_order??999)||cmp(a.event_time||'',b.event_time||'')||cmp(a.id,b.id);
const rowOrder=(a,b)=>cmp(a.id??a.slug??a.step_key,b.id??b.slug??b.step_key);
const key=(table,row)=>String(row.id??row.slug??(row.event_id+'|'+row.content_id));
const routeId=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'sans-nom';

function block(sourceTable,sourceId,kind,data){
 const source_id=String(sourceId);
 return {
  block_id:stableId('legacy-block:'+sourceTable+':'+source_id),
  kind,source_table:sourceTable,source_id,
  data
 };
}
function page(sourceKey,originalRoute,title,celebrationId=null,stepKey=null){
 const id=stableId('legacy-page:'+sourceKey);
 const route='/__editor/legacy/'+routeId(sourceKey).slice(0,150);
 return {id,source_key:sourceKey,route_path:route,original_route:originalRoute,
  title:String(title||'Page historique'),celebration_id:celebrationId,step_key:stepKey,
  blocks:[]};
}
function add(p,b){p.blocks.push(b);return p}
function final(p){
 p.blocks=p.blocks.map((b,i)=>({...b,position:i}));
 p.source_hash=sha(JSON.stringify({
  key:p.source_key,original_route:p.original_route,title:p.title,
  celebration_id:p.celebration_id,step_key:p.step_key,blocks:p.blocks
 }));
 return p;
}
export function convertLegacy(input,{staticPages={}}={}){
 const rows={};
 for(const t of TABLES){
  if(!Array.isArray(input[t]))throw new Error('Missing legacy table '+t);
  rows[t]=[...input[t]].sort(rowOrder);
 }
 const notes=[],pages=[];
 const [ce,steps,events,contents,ec,sc,links,footer,committee,settings]=TABLES.map(t=>rows[t]);
 const indexedContents=new Map(contents.map(x=>[String(x.id),x]));
 const indexedEvents=new Map(events.map(x=>[String(x.id),x]));
 const claimed=new Map(TABLES.map(t=>[t,new Set()]));
 function mark(table,x){claimed.get(table).add(typeof x==='string'?x:JSON.stringify(x))}
 const seen=(table,row)=>mark(table,table==='celebrations_event_contents'?String(row.event_id)+'|'+String(row.content_id):
  table==='celebrations_step_contents'?String(row.celebration_id)+'|'+String(row.step_key)+'|'+String(row.content_id):
  table==='celebrations_public_settings'?String(row.id):String(row.id??row.slug));
 const home=page('home','/','Accueil général');
 add(home,block('static','index.html#welcome-home','static_html_snapshot',
  {html:String(staticPages['index.html']||''),render_policy:'sanitize_and_review',display_route:'/'}));
 for(const id of ['home-intro-2026','home-reliance-2026']){
  const row=indexedContents.get(id);
  if(row)add(home,block('celebrations_contents',id,'legacy_featured_content',{content_id:id}));
 }
 pages.push(final(home));
 const allLinks=new Set();
 for(const c of ce){
  seen('celebrations_celebrations',c);
  const overview=page('celebration:'+c.id,'/','Célébration '+String(c.archangel)+' '+String(c.year||''),c.id);
  add(overview,block('celebrations_celebrations',c.id,'celebration_record',{record:c,
   future_not_auto_public:true}));
  pages.push(final(overview));
  for(let i=0;i<ORDER.length;i++){
   const stage=ORDER[i];
   const found=steps.filter(x=>String(x.celebration_id)===String(c.id)&&x.step_key===stage);
   const record=found[0]||null;
   const p=page('celebration:'+c.id+':step:'+stage,'/'+DAY_SLUGS[i],c.archangel+' — '+stage,c.id,stage);
   if(record){
    seen('celebrations_steps',record);
    add(p,block('celebrations_steps',record.id,'legacy_day',{record,show_exact_dates:true}));
   }else{
    notes.push('missing_step:'+c.id+':'+stage);
    add(p,block('system',c.id+':'+stage,'missing_stage',{stage,exists:false}));
   }
   const dayEvents=events.filter(x=>String(x.celebration_id)===String(c.id)&&x.step_key===stage).sort(byOrder);
   for(const event of dayEvents){
    seen('celebrations_events',event);
    const assoc=ec.filter(x=>String(x.event_id)===String(event.id)).sort(byOrder);
    for(const a of assoc){
     seen('celebrations_event_contents',a);
     if(!indexedContents.has(String(a.content_id)))notes.push('missing_content_ref:'+a.content_id);
    }
    const eventLinks=links.filter(x=>String(x.event_id??'')===String(event.id)).sort(byOrder);
    for(const l of eventLinks){seen('celebrations_links',l);allLinks.add(String(l.id))}
    add(p,block('celebrations_events',event.id,'legacy_event',{
     record:event,
     ordered_content_refs:assoc.map(a=>({content_id:a.content_id,sort_order:a.sort_order})),
     links:eventLinks.map(l=>({id:l.id,label:l.label,url:l.url,sort_order:l.sort_order,link_type:l.link_type}))
    }));
   }
   const dayLinks=links.filter(x=>!x.event_id&&String(x.celebration_id)===String(c.id)&&x.step_key===stage).sort(byOrder);
   for(const l of dayLinks){seen('celebrations_links',l);allLinks.add(String(l.id));add(p,block('celebrations_links',l.id,'legacy_link',{record:l}))}
   const dayContents=sc.filter(x=>String(x.celebration_id)===String(c.id)&&x.step_key===stage).sort(byOrder);
   for(const relation of dayContents){
    seen('celebrations_step_contents',relation);
    if(!indexedContents.has(String(relation.content_id)))notes.push('missing_content_ref:'+relation.content_id);
    add(p,block('celebrations_step_contents',c.id+':'+stage+':'+relation.content_id,'legacy_step_content_ref',
      {celebration_id:relation.celebration_id,step_key:relation.step_key,
       content_id:relation.content_id,sort_order:relation.sort_order}));
   }
   pages.push(final(p));
  }
 }
 const programa=page('programme','/programme','Programme');
 for(const s of settings){
  seen('celebrations_public_settings',s);
  add(programa,block('celebrations_public_settings',s.id,'visibility_setting',{record:s}));
 }
 pages.push(final(programa));
 const library=page('bibliotheque','/bibliotheque','Bibliothèque');
 add(library,block('system','catalogue','library_index',{total:contents.length,source_table:'celebrations_contents'}));
 pages.push(final(library));
 // Exactly one source-catalog block per content, including unused/private records.
 // Never generate R2 copies or URLs from file keys.
 const CHUNK=40;
 for(let pos=0;pos<contents.length;pos+=CHUNK){
  const part=contents.slice(pos,pos+CHUNK);
  const p=page('catalogue-part:'+Math.floor(pos/CHUNK),'/bibliotheque','Catalogue historique '+(Math.floor(pos/CHUNK)+1));
  for(const item of part){
   seen('celebrations_contents',item);
   add(p,block('celebrations_contents',item.id,'legacy_resource',{record:item,
      external_visibility:item.audience||'all',requires_existing_media_gateway:true}));
  }
  pages.push(final(p));
 }
 // Global links without an exact event/day, preserved but not falsely attached.
 const unlinked=links.filter(x=>!allLinks.has(String(x.id))).sort(byOrder);
 if(unlinked.length){
  const p=page('unassigned-links','/','Liens sans emplacement exact');
  for(const l of unlinked){seen('celebrations_links',l);add(p,block('celebrations_links',l.id,'legacy_link_unassigned',{record:l}))}
  pages.push(final(p));
  notes.push('unassigned_links:'+unlinked.length);
 }
 // No event or step relation should be silently lost.
 const strayEvents=events.filter(x=>!claimed.get('celebrations_events').has(String(x.id)));
 if(strayEvents.length){
  const p=page('unassigned-events','/programme','Événements sans étape canonique');
  for(const e of strayEvents){seen('celebrations_events',e);add(p,block('celebrations_events',e.id,'legacy_event_unassigned',{record:e}))}
  pages.push(final(p));
  notes.push('unassigned_events:'+strayEvents.length);
 }
 const strayRelations=ec.filter(x=>!claimed.get('celebrations_event_contents').has(String(x.event_id)+'|'+String(x.content_id)));
 const straySteps=sc.filter(x=>!claimed.get('celebrations_step_contents').has(String(x.celebration_id)+'|'+String(x.step_key)+'|'+String(x.content_id)));
 if(strayRelations.length||straySteps.length){
  const p=page('unassigned-relations','/programme','Associations à réexaminer');
  for(const r of strayRelations){seen('celebrations_event_contents',r);add(p,block('celebrations_event_contents',r.event_id+':'+r.content_id,'legacy_unassigned_event_attachment',{record:r}))}
  for(const r of straySteps){seen('celebrations_step_contents',r);add(p,block('celebrations_step_contents',r.celebration_id+':'+r.step_key+':'+r.content_id,'legacy_unassigned_step_attachment',{record:r}))}
  pages.push(final(p));
  notes.push('unassigned_relations:'+(strayRelations.length+straySteps.length));
 }
 for(const slug of LEGAL){
  const p=page('legal:'+slug,'/'+slug+'.html',slug);
  for(const draft of footer.filter(x=>x.slug===slug).sort((a,b)=>Number(a.draft_number)-Number(b.draft_number))){
   seen('celebrations_footer_drafts',draft);
   add(p,block('celebrations_footer_drafts',draft.id,'legal_draft',{record:draft,
      do_not_publish_without_approval:true}));
  }
  add(p,block('static',slug+'.html','static_html_snapshot',
    {html:String(staticPages[slug+'.html']||''),render_policy:'sanitize_and_review'}));
  pages.push(final(p));
 }
 const otherFooter=footer.filter(x=>!LEGAL.includes(x.slug));
 if(otherFooter.length){
  const p=page('unassigned-legal','/','Brouillons légaux non reconnus');
  for(const row of otherFooter){seen('celebrations_footer_drafts',row);add(p,block('celebrations_footer_drafts',row.id,'legal_draft_unassigned',{record:row}))}
  pages.push(final(p));notes.push('unassigned_legal:'+otherFooter.length);
 }
 const committeePage=page('committee-private','/letter','PDF comité — NON LISTÉS');
 for(const letter of committee){
  seen('celebrations_committee_letters',letter);
  add(committeePage,block('celebrations_committee_letters',letter.id,'committee_unlisted_pdf',
   {record:letter,visibility:'unlisted_by_link',never_show_in_public_library:true}));
 }
 pages.push(final(committeePage));
 for(const [key,route] of [['apres-la-ronde/index.html','/apres-la-ronde'],['concepteur.html','/concepteur.html']]){
  const p=page('static:'+key,route,route);
  add(p,block('static',key,'static_html_snapshot',{html:String(staticPages[key]||''),render_policy:'sanitize_and_review'}));
  pages.push(final(p));
 }
 // Assert no rows are silently omitted; do not count empty stage placeholders as converted content.
 const coverage={};
 for(const table of TABLES){
  const records=rows[table];
  const count=claimed.get(table).size;
  coverage[table]={source:records.length,represented:count,missing:Math.max(0,records.length-count)};
  if(count!==records.length)notes.push('UNREPRESENTED:'+table+':'+(records.length-count));
 }
 const ids=new Set(),routes=new Set();
 for(const p of pages){
  if(ids.has(p.id)||routes.has(p.route_path))throw new Error('Duplicate converted page key or route: '+p.source_key);
  ids.add(p.id);routes.add(p.route_path);
  if(p.blocks.length>64)notes.push('BLOCK_LIMIT:'+p.source_key+':'+p.blocks.length);
  const bIds=new Set(p.blocks.map(b=>b.block_id));
  if(bIds.size!==p.blocks.length)throw Error('Duplicate blocks: '+p.source_key);
 }
 return {pages,coverage,notes:notes.sort(),statistics:{
  pages:pages.length,blocks:pages.reduce((n,p)=>n+p.blocks.length,0),
  celebrations:ce.length,days:pages.filter(p=>p.step_key!==null).length,
  source_contents:contents.length,source_events:events.length,
  committee_pdfs:committee.length,
  unpublished_pages:pages.length
 }};
}
