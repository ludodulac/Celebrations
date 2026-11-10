// Fake admin transport for the M009-B browser-only mobile fixture.
import {mountMemberDirectoryAdmin} from '../../migration/cloudflare/app/admin/member-directory-admin-integration.mjs';
const id='person:550e8400-e29b-41d4-a716-446655440000';
const types=[{id:'member-type:choir',name:'Chorale',disabled:false}];
const members=[{id,name:'Alice',emailNormalized:'alice@example.org'}];
const memberships=[{memberId:id,typeId:'member-type:choir'}];
const transport=async c=>{
 if(c.method==='GET' && c.action==='snapshot')
  return {ok:true,data:{types,members,memberships,pages:[],spaces:[],enrollments:[]}};
 if(c.method==='GET' && c.action==='person_detail')
  return {ok:true,data:{person:{id},types:memberships,celebrations:[{celebrationId:'41'}],
    enrollments:[{spaceId:'space:41:chapel',celebrationId:'41'}]}};
 if(c.method==='GET' && c.action==='pending_claims') return {ok:true,data:[]};
 if(c.method==='POST' && c.action==='create_type') {
  types.push({id:c.typeId,name:c.name,disabled:false});
  return {ok:true,result:{id:c.typeId}};
 }
 if(c.method==='POST' && c.action==='rename_type') {
  types.find(t=>t.id===c.typeId).name=c.name;
  return {ok:true,result:{id:c.typeId}};
 }
 if(c.method==='POST' && c.action==='disable_type') {
  types.find(t=>t.id===c.typeId).disabled=c.disabled;
  return {ok:true,result:{disabled:c.disabled}};
 }
 if(c.method==='POST') return {ok:true,result:{}};
 return {ok:false,error:'Invalid fake request'};
};
window.mount=mountMemberDirectoryAdmin(document.querySelector('#admin'),{transport});
