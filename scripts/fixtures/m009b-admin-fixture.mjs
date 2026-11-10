// M010-B: isolated browser fixture for the existing M007-B member dashboard.
// All records are invented; this transport has no production API or credentials.
import {mountMemberDirectoryAdmin} from '../../migration/cloudflare/app/admin/member-directory-admin-integration.mjs';
const id='person:550e8400-e29b-41d4-a716-446655440000';
const types=[{id:'member-type:choir',name:'Chorale',disabled:false,revision:0}];
const members=[{id,name:'Alice',emailNormalized:'alice@example.org',revision:0}];
for(let i=0;i<125;i++)members.push({
 id:'person:550e8400-e29b-41d4-a716-'+String(i+10).padStart(12,'0'),
 name:i===124?'Personne Extrême':'Personne '+String(i).padStart(3,'0'),
 emailNormalized:'user'+String(i).padStart(3,'0')+'@example.org',revision:0
});
const memberships=[{memberId:id,typeId:'member-type:choir'}];
const transport=async c=>{
 if(c.method==='GET' && c.action==='snapshot') {
  const search=(c.search||'').toLowerCase();
  const entries=[...members].sort((a,b)=>a.emailNormalized.localeCompare(b.emailNormalized))
   .filter(p=>p.emailNormalized>(c.cursor||''))
   .filter(p=>!search||[p.name,p.emailNormalized].some(s=>s.toLowerCase().includes(search)));
  const limit=Math.min(Number(c.limit||50),100),page=entries.slice(0,limit);
  return {ok:true,data:{types,members:page,
    memberships:memberships.filter(m=>page.some(p=>p.id===m.memberId)),
    pages:[],spaces:[],enrollments:[],hasMorePeople:entries.length>limit,
    nextCursor:entries.length>limit?page.at(-1).emailNormalized:null}};
 }
 if(c.method==='GET' && c.action==='person_detail') {
  const person=members.find(p=>p.id===c.personId);
  return person?{ok:true,data:{person:{...person,givenName:person.name},
    types:memberships.filter(m=>m.memberId===person.id),
    celebrations:person.id===id?[{celebrationId:'41'}]:[],
    enrollments:person.id===id?[{spaceId:'space:41:chapel',celebrationId:'41'}]:[]}}:
    {ok:false,error:'Unknown person'};
 }
 if(c.method==='GET' && c.action==='pending_claims') return {ok:true,data:[]};
 if(c.method==='POST' && c.action==='create_person') {
  if(members.some(p=>p.emailNormalized===c.email.toLowerCase()))
    return {ok:false,error:'Duplicate email'};
  const person={id:'person:550e8400-e29b-41d4-a716-'+String(members.length+10).padStart(12,'0'),
    name:c.displayName||c.givenName||c.email,emailNormalized:c.email.toLowerCase(),revision:0};
  members.push(person);return {ok:true,result:person};
 }
 if(c.method==='POST' && c.action==='create_type') {
  types.push({id:c.typeId,name:c.name,disabled:false,revision:0});
  return {ok:true,result:{id:c.typeId}};
 }
 if(c.method==='POST') {
  const target=members.find(p=>p.id===c.personId)||types.find(t=>t.id===c.typeId);
  if(target&&c.expectedRevision!==target.revision)
    return {ok:false,error:'Conflit de version'};
  if(c.action==='rename_type')target.name=c.name;
  if(c.action==='disable_type')target.disabled=c.disabled;
  if(c.action==='update_person'){
    target.emailNormalized=c.changes.email.toLowerCase();
    target.name=c.changes.displayName||c.changes.givenName||target.emailNormalized;
  }
  if(c.action==='set_person_types'){
    for(let i=memberships.length-1;i>=0;i--)
      if(memberships[i].memberId===c.personId)memberships.splice(i,1);
    for(const typeId of c.typeIds)
      memberships.push({memberId:c.personId,typeId});
  }
  if(target)target.revision++;
  return {ok:true,result:{}};
 }
 return {ok:false,error:'Invalid fake request'};
};
window.mount=mountMemberDirectoryAdmin(document.querySelector('#admin'),{transport});
