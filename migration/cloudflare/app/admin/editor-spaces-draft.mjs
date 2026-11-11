// M011-C: transient editorial workspace over the canonical M005 domain.
// It NEVER writes to localStorage, D1, R2, the legacy editor state or a Worker.
// IDs created here are provisional; a trusted server must allocate final IDs.
import {
  createCelebrationSpace, addSpaceToCelebration, getCelebrationSpaces,
  duplicateCelebration
} from '../domain/celebration-spaces.mjs';
import {ACCESS_MODES, SPACE_VISIBILITIES} from '../domain/member-access.mjs';

const copy = value => JSON.parse(JSON.stringify(value));
const newId = kind => 'draft-' + kind + ':' + crypto.randomUUID();
const requiredId = id => {
  if(typeof id !== 'string' || !id.trim() || id.trim() !== id) {
    throw new TypeError('Identifiant de célébration invalide');
  }
  return id;
};

export function createSpacesDraftWorkspace(celebrations = [], {allocateId = newId} = {}) {
  if(!Array.isArray(celebrations) || typeof allocateId !== 'function')
    throw new TypeError('Catalogue et allocateur attendus');
  // No reference to the legacy state or server snapshot escapes into mutations.
  const original = copy(celebrations);
  let current = copy(celebrations), undo = [], redo = [];
  function snapshot() { return copy(current); }
  function index(celebrationId) {
    const pos = current.findIndex(c => String(c.id) === String(celebrationId));
    if(pos < 0) throw new RangeError('Célébration inconnue');
    return pos;
  }
  function change(mutator) {
    const next = copy(current);
    mutator(next);
    undo.push(snapshot());
    if(undo.length > 30) undo.shift();
    current = next; redo = [];
    return snapshot();
  }
  function lookup(celebrationId, spaceId) {
    const celebration = current[index(celebrationId)];
    const space = getCelebrationSpaces(celebration).find(s => s.id === spaceId);
    if(!space) throw new RangeError('Espace inconnu');
    return {celebration,space};
  }
  function policyFor(visibility, mode, typeIds = []) {
    if(visibility === SPACE_VISIBILITIES.PUBLIC)
      return {mode:ACCESS_MODES.PUBLIC};
    if(!Object.values(ACCESS_MODES).includes(mode))
      throw new TypeError('Politique inconnue');
    return mode === ACCESS_MODES.SELECTED_TYPES
      ? {mode, typeIds:[...new Set(typeIds)]} : {mode};
  }
  return {
    list: snapshot,
    get(celebrationId) { return copy(current[index(celebrationId)]); },
    spaces(celebrationId) { return getCelebrationSpaces(current[index(celebrationId)]); },
    getSpace(celebrationId,spaceId) { return lookup(celebrationId,spaceId).space; },
    get changed() { return JSON.stringify(current) !== JSON.stringify(original); },
    get canUndo() { return undo.length > 0; },
    get canRedo() { return redo.length > 0; },
    addSpace(celebrationId,{name,visibility=SPACE_VISIBILITIES.PRIVATE,
      mode=ACCESS_MODES.PUBLIC,typeIds=[]}={}) {
      if(typeof name !== 'string' || !name.trim() || name.trim().length > 120)
        throw new TypeError('Nom d’espace requis (120 caractères maximum)');
      const id = requiredId(allocateId('space'));
      const space = createCelebrationSpace({id,celebrationId:String(celebrationId),
        name:name.trim(),visibility,
        accessPolicy:policyFor(visibility,mode,typeIds),pages:[]});
      change(items => {const pos=index(celebrationId);
        items[pos]=addSpaceToCelebration(items[pos],space);});
      return id;
    },
    updateSpace(celebrationId,spaceId,{name,visibility,mode,typeIds=[]}={}) {
      const {space}=lookup(celebrationId,spaceId);
      const nextVisibility=visibility??space.visibility;
      const nextMode=mode??space.accessPolicy.mode;
      const nextName=name??space.name;
      if(typeof nextName!=='string'||!nextName.trim())
        throw new TypeError('Nom requis');
      const nextSpace=createCelebrationSpace({...space,name:nextName.trim(),
        visibility:nextVisibility,
        accessPolicy:policyFor(nextVisibility,nextMode,typeIds)});
      change(items=>{const c=items[index(celebrationId)];
        c.spaces=c.spaces.map(s=>s.id===spaceId?nextSpace:s);
        getCelebrationSpaces(c);
      });
    },
    addPage(celebrationId,spaceId,{title}={}) {
      if(typeof title!=='string' || !title.trim() || title.trim().length>160)
        throw new TypeError('Titre de page requis');
      const {space}=lookup(celebrationId,spaceId);
      const id=requiredId(allocateId('page'));
      const nextSpace=createCelebrationSpace({...space,pages:[
        ...space.pages,{id,celebrationId:String(celebrationId),spaceId,
          title:title.trim(),blocks:[],visibility:'draft',
          publicationStatus:'draft',accessPolicy:{mode:ACCESS_MODES.PUBLIC}}
      ]});
      change(items=>{const c=items[index(celebrationId)];
        c.spaces=c.spaces.map(s=>s.id===spaceId?nextSpace:s);
        getCelebrationSpaces(c);
      });
      return id;
    },
    updatePagePolicy(celebrationId,spaceId,pageId,{mode,typeIds=[]}={}) {
      const {space}=lookup(celebrationId,spaceId);
      if(!space.pages.some(p=>p.id===pageId))throw new RangeError('Page inconnue');
      if(!Object.values(ACCESS_MODES).includes(mode)||
        (mode===ACCESS_MODES.SELECTED_TYPES&&(!Array.isArray(typeIds)||!typeIds.length||!typeIds.every(isMemberTypeId))))
        throw new TypeError('Politique de page invalide');
      const accessPolicy=policyFor(SPACE_VISIBILITIES.PRIVATE,mode,typeIds);
      const nextSpace=createCelebrationSpace({...space,pages:space.pages.map(p=>p.id===pageId?{...p,accessPolicy}:p)});
      change(items=>{const c=items[index(celebrationId)];
        c.spaces=c.spaces.map(s=>s.id===spaceId?nextSpace:s);
        getCelebrationSpaces(c);
      });
    },
    // M005 owns cloning, ID remapping, translation and media references,
    // draft lifecycle, and removal of every individual member enrollment.
    duplicate(celebrationId) {
      const source=current[index(celebrationId)];
      const newCelebrationId=requiredId(allocateId('celebration'));
      const spaceIds={},pageIds={};
      for(const space of getCelebrationSpaces(source)) {
        spaceIds[space.id]=requiredId(allocateId('space'));
        for(const page of space.pages) pageIds[String(page.id)]=requiredId(allocateId('page'));
      }
      for(const page of source.pages??[]) pageIds[String(page.id)]=requiredId(allocateId('page'));
      const duplicate=duplicateCelebration(source,{
        id:newCelebrationId,spaceIds,pageIds,
        reservedSpaceIds:current.flatMap(c=>(c.spaces??[]).map(s=>s.id)),
        reservedPageIds:current.flatMap(c=>[...(c.pages??[]).map(p=>p.id),
          ...(c.spaces??[]).flatMap(s=>s.pages.map(p=>p.id))])
      });
      change(items=>{if(items.some(c=>String(c.id)===newCelebrationId))
        throw new TypeError('Identifiant déjà utilisé');
        items.push(duplicate);});
      return newCelebrationId;
    },
    undo() {if(!undo.length)return false; redo.push(snapshot());current=undo.pop();return true;},
    redo() {if(!redo.length)return false; undo.push(snapshot());current=redo.pop();return true;},
    discard() {current=copy(original);undo=[];redo=[];return snapshot();}
  };
}
