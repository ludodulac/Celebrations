import {validHomeEntryButton,normalizeHomeEntryButton} from './editor-home-entry-button.mjs';
// M009-A — explicit, fail-closed anonymous projection for published editor data.
// This is a DATA boundary, not an authorization engine. Reuse canonical M002 rules.
import {canAccessPage,canAccessPolicy,ACCESS_MODES} from './member-access.mjs';

const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const clone=x=>structuredClone(x);
const visibility=x=>x===undefined||x===null||x==='published';
const publicAudience=x=>x===undefined||x===null||x==='all'||x==='public';
const publicFlags=x=>object(x)&&x.private!==true&&x.isPrivate!==true&&
 x.restricted!==true&&visibility(x.visibility)&&
 !['draft','hidden','private','restricted'].includes(String(x.status||'').toLowerCase())&&
 !['draft','hidden','private','restricted'].includes(String(x.publicationStatus||'').toLowerCase())&&
 publicAudience(x.audience)&&(!own(x,'accessPolicy')||
 canAccessPolicy(x.accessPolicy)&&x.accessPolicy?.mode===ACCESS_MODES.PUBLIC)&&
 !own(x,'spaceId');

export function eligiblePublicPage(page){
 return publicFlags(page)&&typeof page.id==='string'&&page.id.length>0&&
 Array.isArray(page.blocks)&&canAccessPage(page);
}

export function eligiblePublicPlan(plan){
 return publicFlags(plan)&&typeof plan.id==='string'&&plan.id.startsWith('plan-');
}

// Do not serialize routes to private spaces, admin APIs, bearer links or
// known unpublished IDs. Never infer access from client flags or query strings.
export function allowedPublicLink(value,blockedIds=[]){
 if(typeof value!=='string'||!value||value.length>2000||/[\u0000-\u001f\\]/.test(value)||
  value.startsWith('//'))return false;
 try{
  const url=new URL(value,'https://www.ronde-des-archanges-universelle.eu');
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return false;
  if(url.origin==='https://www.ronde-des-archanges-universelle.eu'){
   if(/^\/(?:private|members?|committee|admin)(?:\/|$)/i.test(url.pathname)||
      /^\/api\/(?!editor-trial-audio(?:\/|$))/i.test(url.pathname)||
      /^\/__editor(?:\/|$)/i.test(url.pathname)&&url.pathname!=='/__editor/voir-le-site')
    return false;
  }
  if(/(?:^|\/)(?:committee|private|drafts?|members?)(?:\/|$)/i.test(decodeURIComponent(url.pathname)))
   return false;
  const exposed=decodeURIComponent(url.pathname+url.search+url.hash);
  if(blockedIds.some(id=>typeof id==='string'&&id.length>=5&&exposed.includes(id)))
   return false;
  return true;
 }catch{return false}
}

const BLOCK_FIELDS=['id','kind','text','rich','bold','italic','color','size','align',
 'widthPct','fullBleed','layout','presentation','thickness','displayAsButton','atTime'];
const SECTION_STYLE_FIELDS=['border','width','color','shadow'];
function projectBlock(block,blockedIds,depth=0){
 if(!object(block)||depth>12||block.hideOnSite===true||!publicFlags(block))return null;
 if(typeof block.kind!=='string'||block.kind.length>32)return null;
 const result={};
 for(const field of BLOCK_FIELDS)
  if(own(block,field)&&['string','number','boolean'].includes(typeof block[field]))
   result[field]=block[field];
 // IDs are safe canonical identifiers; never include assetId/remoteKey, which
 // can name unpublished objects in the editor bucket.
 if(block.kind==='section'){
  if(!Array.isArray(block.columns)||block.columns.length>6)return null;
  result.columns=block.columns.map(column=>Array.isArray(column)?
   column.map(child=>projectBlock(child,blockedIds,depth+1)).filter(Boolean):[]);
  if(object(block.style)){
   const style={};
   for(const field of SECTION_STYLE_FIELDS)
    if(['string','number','boolean'].includes(typeof block.style[field]))
     style[field]=block.style[field];
   result.style=style;
  }
  for(const key of ['columnAlignments','columnButtonLayouts'])
   if(Array.isArray(block[key]))result[key]=block[key].slice(0,6)
    .map(v=>typeof v==='string'?v:'');
 }else{
  for(const key of ['href','src','cover']){
   if(typeof block[key]==='string'&&block[key]){
    if(!allowedPublicLink(block[key],blockedIds))return null;
    result[key]=block[key];
   }
  }
  if((block.kind==='image'||block.kind==='audio')&&!result.src)return null;
  if((block.kind==='button'||block.kind==='video')&&!result.href)return null;
 }
 return result;
}

export function projectPublicPage(page,blockedIds=[]){
 if(!eligiblePublicPage(page))return null;
 const projected={
  id:page.id,
  name:typeof page.name==='string'?page.name:'',
  ...(page.group==='page'&&validHomeEntryButton(page.homeEntryButton)?
   {homeEntryButton:normalizeHomeEntryButton(page.homeEntryButton)}:{}),
  ...(typeof page.menuLabel==='string'&&page.menuLabel.trim().length>0&&page.menuLabel.length<=95&&
   !/[\\\\\u0000-\u001f\u007f]/.test(page.menuLabel)?{menuLabel:page.menuLabel.trim()}:{}),
  group:page.group==='page'?'page':'celebration',
  visibility:'published',
  blocks:page.blocks.map(block=>projectBlock(block,blockedIds)).filter(Boolean)
 };
 if(page.placement==='footer'&&projected.group==='page')projected.placement='footer';
 return projected;
}

export function projectPublicPlan(plan){
 if(!eligiblePublicPlan(plan))return null;
 const clean={id:plan.id,visibility:'published'};
 for(const key of ['title','archangel','date','year','kind'])
  if(typeof plan[key]==='string')clean[key]=plan[key];
 if(typeof plan.customTitle==='boolean')clean.customTitle=plan.customTitle;
 return clean;
}

export function projectPublicMediaItem(item,blockedIds=[]){
 if(!publicFlags(item)||!['image','video','pdf','audio','file'].includes(item.type)||
  !allowedPublicLink(item.src,blockedIds))return null;
 const src=item.src;
 const result={id:item.type+'|'+src,type:item.type,src,
  name:typeof item.name==='string'?item.name.slice(0,120):'Média',
  source:['uploaded','historical','link'].includes(item.source)?item.source:'link',
  general:item.general===true,uses:[]};
 for(const use of Array.isArray(item.uses)?item.uses:[]){
  if(!object(use)||typeof use.pageId!=='string'||typeof use.celebrationId!=='string'||
     blockedIds.includes(use.pageId))continue;
  result.uses.push({
   pageId:use.pageId,
   pageName:typeof use.pageName==='string'?use.pageName.slice(0,180):'Page',
   celebrationId:use.celebrationId,
   slug:typeof use.slug==='string'?use.slug:'',
   group:use.group==='page'?'page':'celebration'
  });
 }
 return result;
}

export function privatePublicationIds(state,published){
 const blocked=new Set(),publicPageIds=new Set(),publicPlanIds=new Set();
 for(const page of published?.shared?.pages||[])
  if(eligiblePublicPage(page))publicPageIds.add(page.id);
 for(const record of Object.values(published?.drafts||{}))
  for(const page of record?.pages||[])
   if(eligiblePublicPage(page))publicPageIds.add(page.id);
 for(const plan of published?.plans||[])
  if(eligiblePublicPlan(plan))publicPlanIds.add(plan.id);
 const inspect=(p,owner)=>{
  if(!p||typeof p.id!=='string'||publicPageIds.has(p.id))return;
  if(!eligiblePublicPage(p)){
   blocked.add(p.id);
   if(p.id.startsWith('extra-')&&owner&&p.id.endsWith('-'+owner))
    blocked.add(p.id.slice(0,-owner.length-1));
  }
 };
 for(const aggregate of [state,published]){
  for(const page of aggregate?.shared?.pages||[])inspect(page,'');
  for(const [id,record] of Object.entries(aggregate?.drafts||{})){
   for(const page of record?.pages||[])inspect(page,id);
   for(const space of record?.spaces||[]){
    if(typeof space?.id==='string')blocked.add(space.id);
    for(const page of space?.pages||[])if(typeof page?.id==='string')blocked.add(page.id);
   }
  }
  for(const plan of aggregate?.plans||[])
   if(!eligiblePublicPlan(plan)&&typeof plan?.id==='string'&&!publicPlanIds.has(plan.id))
    blocked.add(plan.id);
 }
 return [...blocked];
}

export function projectPublicPages(pages,blockedIds=[]){
 return (Array.isArray(pages)?pages:[])
  .map(page=>projectPublicPage(page,blockedIds)).filter(Boolean);
}
