// M012-B: D1 session exclusively issued by the M012-A challenge protocol.
// This module never uses legacy editor cookies or Supabase tokens.
import {mountExistingEditorMemberSpaces} from './editor-member-spaces-integration.mjs';

export function createEditorD1Session({origin,fetchImpl=globalThis.fetch,cryptoImpl=globalThis.crypto,onChange=()=>{}}={}){
  const base=new URL(origin);
  if(base.origin!==origin || (base.protocol!=='https:' && !(base.protocol==='http:' && ['127.0.0.1','localhost'].includes(base.hostname))))
    throw Error('Origine sécurisée requise');
  let token=null,expires=0,generation=0;
  const enc=new TextEncoder(),hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
  const clear=()=>{token=null;expires=0;generation++;onChange(false);};
  const connected=()=>!!token&&expires>Date.now();
  const request=async(path,{method='POST',body,query,bearer}={})=>{
    const url=new URL(path,base);
    if(url.origin!==origin)throw Error('Origine interdite');
    for(const [k,v] of Object.entries(query||{}))if(v!==null&&v!==undefined&&v!=='')url.searchParams.set(k,String(v));
    const headers={accept:'application/json'};
    if(bearer)headers.authorization='Bearer '+bearer;
    if(body!==undefined)headers['content-type']='application/json';
    const response=await fetchImpl(url.href,{method,headers,credentials:'omit',cache:'no-store',redirect:'error',
      ...(body!==undefined?{body:JSON.stringify(body)}:{})});
    if(response.status===401&&bearer&&bearer===token)clear();
    if(!response.headers.get('content-type')?.toLowerCase().includes('application/json'))
      throw Error('Route administrative indisponible ('+response.status+')');
    const result=await response.json();
    if(!response.ok||result?.ok!==true)throw Object.assign(Error((typeof result?.error==='string'?result.error:'Requête administrative refusée')+' ('+response.status+')'),{status:response.status,saved:result?.saved===true});
    return result;
  };
  const auth=(body,bearer)=>request('/api/admin/editor-session',{body,bearer});
  async function login(password){
    if(!password||token)throw Error('Déconnexion préalable ou mot de passe requis');
    const attempt=++generation;
    const challenge=await auth({action:'challenge'});
    if(typeof challenge.salt!=='string'||!challenge.salt||typeof challenge.challenge!=='string'||!challenge.challenge||challenge.iterations!==180000)
      throw Error('Défi D1 invalide');
    const key=await cryptoImpl.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
    password='';
    const derived=hex(await cryptoImpl.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(challenge.salt),iterations:180000,hash:'SHA-256'},key,256));
    const hmac=await cryptoImpl.subtle.importKey('raw',enc.encode(derived),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const response=hex(await cryptoImpl.subtle.sign('HMAC',hmac,enc.encode('celebrations-admin-login-v1:'+origin+':'+challenge.challenge)));
    const result=await auth({action:'login',challenge:challenge.challenge,response});
    if(attempt!==generation)throw Error('Connexion interrompue');
    const end=Date.parse(result.expires_at);
    if(typeof result.token!=='string'||!result.token||!Number.isFinite(end)||end<=Date.now())
      throw Error('Session D1 non confirmée');
    token=result.token;expires=end;onChange(true);
  }
  async function logout(){
    const bearer=token;clear();
    if(bearer)await auth({action:'logout'},bearer);
  }
  async function send(command,path,queryKeys){
    if(!['GET','POST'].includes(command?.method))return {ok:false,error:'Commande invalide'};
    if(!connected()){
      if(token)clear();
      return {ok:false,error:'Non connecté à D1'};
    }
    const bearer=token;
    try{
      const data=Object.fromEntries(Object.entries(command).filter(([k])=>k!=='method'));
      const options=command.method==='GET'?{query:Object.fromEntries(Object.entries(data).filter(([k])=>queryKeys.includes(k)))}:{body:data};
      const result=await request(path,{method:command.method,bearer,...options});
      if(bearer!==token)return {ok:false,error:'Session terminée'};
      return result;
    }catch(e){return {ok:false,error:e.message||'Service D1 indisponible',status:e.status,saved:e.saved===true};}
  }
  const transport=command=>send(command,'/api/admin/member-directory',['action','search','cursor','limit','personId']);
  const privateTransport=command=>send(command,'/api/admin/private-editor',['celebration']);
  return {login,logout,connected,transport,privateTransport};
}

export function mountRealEditorMemberSpaces(root,{celebrations,currentCelebrationId,styleNonce,css='',origin=location.origin}={}){
  const doc=root.ownerDocument,node=(tag,text)=>{const x=doc.createElement(tag);if(text!==undefined)x.textContent=text;return x;};
  const shell=node('section'),style=node('style');if(styleNonce)style.nonce=styleNonce;style.textContent=css;
  const authBox=node('section');authBox.className='member-session-box';
  const heading=node('h2','Connexion administrateur D1'),status=node('p','Non connecté à D1');
  status.setAttribute('role','status');
  const form=node('form'),label=node('label','Mot de passe administrateur D1 '),input=node('input');
  input.type='password';input.required=true;input.autocomplete='current-password';label.append(input);
  const login=node('button','Se connecter à D1');login.type='submit';login.className='btn';
  const logout=node('button','Se déconnecter de D1');logout.type='button';logout.className='btn';logout.hidden=true;
  form.append(label,login);
  authBox.append(heading,node('p','Connexion distincte du code d’accès historique. Aucun jeton historique n’est utilisé.'),status,form,logout);
  const body=node('div');shell.append(style,authBox,body);root.replaceChildren(shell);
  let mounted,busy=false;
  const session=createEditorD1Session({origin,onChange:active=>{
    form.hidden=active;logout.hidden=!active;
    status.textContent=active?'Session D1 confirmée.':'Non connecté à D1';
    mounted?.refreshMembers();
    mounted?.sessionChanged(active);
  }});
  mounted=mountExistingEditorMemberSpaces(body,{transport:session.transport,privateTransport:session.privateTransport,isConnected:session.connected,celebrations,currentCelebrationId,styleNonce});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    busy=true;login.disabled=true;status.textContent='Connexion D1 en cours…';
    let password=input.value;input.value='';
    try{const pending=session.login(password);password='';await pending;}
    catch(e){status.textContent='Connexion D1 impossible : '+(e.message||'erreur réseau');}
    finally{busy=false;login.disabled=false;}
  });
  logout.addEventListener('click',async()=>{
    if(busy)return;busy=true;login.disabled=true;logout.disabled=true;
    try{await session.logout();status.textContent='Déconnexion D1 confirmée.';}
    catch{status.textContent='Session effacée localement ; révocation serveur non confirmée.';}
    finally{busy=false;login.disabled=false;logout.disabled=false;}
  });
  return {get changed(){return mounted.changed;},getDraft:()=>mounted.getDraft()};
}
