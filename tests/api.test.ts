import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GET,POST} from '../app/api/hub/route.ts';
import {blankProject} from '../lib/hub-types.ts';

test('API integration: saving, refresh, privacy, ownership, requests and auth failures (mock Supabase transport)',async(t)=>{
 const owner='6de1f311-d2ce-4b3b-b52f-0b71d78cd454',member='78879313-d5a3-4110-8031-7c7b4c9f0631';
 type Row=Record<string,unknown>;
 const tables:Record<string,Row[]>={yak_profiles:[{id:owner,email:'owner@example.com',name:'4Raisan',role:'owner'},{id:member,email:'member@example.com',name:'Member',role:'collaborator'}],yak_projects:[],yak_interactions:[],yak_invitations:[]};
 const envBefore={...process.env};
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://test.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';process.env.SUPABASE_SECRET_KEY='sb_secret_test';process.env.OWNER_EMAIL='owner@example.com';delete process.env.META_WHATSAPP_TOKEN;
 t.mock.method(globalThis,'fetch',async(input:RequestInfo|URL,init?:RequestInit)=>{
  const req=new Request(input,init),url=new URL(req.url),headers=req.headers;
  if(url.pathname==='/auth/v1/user'){
   const id=headers.get('authorization')==='Bearer owner-token'?owner:headers.get('authorization')==='Bearer member-token'?member:null;
   return Response.json(id?{id,email:id===owner?'owner@example.com':'member@example.com',email_confirmed_at:'2026-10-19T00:00:00Z',user_metadata:{}}:{message:'Invalid JWT',code:'bad_jwt'},{status:id?200:401});
  }
  if(url.pathname==='/rest/v1/rpc/yak_limit_submission')return Response.json(true);
  const table=url.pathname.split('/').pop()!;assert.ok(tables[table],`Unexpected API ${url.pathname}`);
  const selected=tables[table].filter(row=>[...url.searchParams].every(([key,value])=>['select','order'].includes(key)||value==='is.null'?['select','order'].includes(key)||row[key]==null:value.startsWith('eq.')?String(row[key])===value.slice(3):true));
  if(req.method==='POST'){
   const data=await req.json() as Row;const row={id:crypto.randomUUID(),created_at:new Date().toISOString(),updated_at:new Date().toISOString(),status:'Received',notification:'not configured',...data};tables[table].push(row);
   return headers.get('prefer')?.includes('return=representation')?Response.json(headers.get('accept')?.includes('vnd.pgrst.object')?row:[row],{status:201}):new Response(null,{status:201});
  }
  if(req.method==='PATCH'){const data=await req.json();for(const row of selected)Object.assign(row,data);return new Response(null,{status:204});}
  if(req.method==='DELETE'){tables[table]=tables[table].filter(row=>!selected.includes(row));return new Response(null,{status:204});}
  const fields=url.searchParams.get('select');const projected=fields&&fields!=='*'?selected.map(row=>Object.fromEntries(fields.split(',').map(key=>[key,row[key]]))):selected;
  if(headers.get('accept')?.includes('vnd.pgrst.object'))return Response.json(projected[0]||null);
  return Response.json(projected);
 });
 async function api(body?:unknown,token?:string,extra:Record<string,string>={}){
  const req=new Request('http://127.0.0.1:3000/api/hub',{method:body?'POST':'GET',headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000','x-forwarded-for':'192.0.2.1',...(token?{authorization:'Bearer '+token}:{}),...extra},...(body?{body:JSON.stringify(body)}:{})});
  const response=body?await POST(req):await GET(req);return {status:response.status,data:await response.json()};
 }
 try{
  assert.equal((await api(undefined,'invalid-token')).status,401);
  assert.equal((await api(undefined,undefined,{'oai-authenticated-user-id':owner})).data.user,null);
  const project={...blankProject,title:'Saved project',summary:'A test of save and reload behavior.',description:'Project data should survive independent API reads and keep private records hidden.'};
  assert.equal((await api({action:'saveProject',project},'owner-token')).status,200);
  const publicState=await api();assert.equal(publicState.data.projects[0].title,'Saved project');assert.equal(publicState.data.projects[0].owner_name,'4Raisan');
  const id=publicState.data.projects[0].id;
  assert.equal((await api({action:'saveProject',id,project:{...project,title:'Edited project'}},'member-token')).status,403);
  assert.equal((await api({action:'saveProject',id,project:{...project,title:'Edited project'}},'owner-token')).status,200);
  assert.equal((await api()).data.projects[0].title,'Edited project');
  assert.equal((await api({action:'submit',project_id:id,kind:'idea',name:'Visitor',email:'visitor@example.com',message:'A useful idea for improving the project details.',website:''})).status,200);
  assert.equal((await api()).data.inbox.length,0);
  const ownerState=await api(undefined,'owner-token');assert.equal(ownerState.data.inbox.length,1);
  assert.equal((await api(undefined,'member-token')).data.inbox.length,0);
  assert.equal((await api({action:'status',id:ownerState.data.inbox[0].id,status:'Reviewing'},'member-token')).status,404);
  assert.equal((await api({action:'status',id:ownerState.data.inbox[0].id,status:'Reviewing'},'owner-token')).status,200);
  assert.equal((await api({action:'invite',email:'invitee@example.com'},'member-token')).status,403);
  const invite=await api({action:'invite',email:'invitee@example.com'},'owner-token');assert.equal(invite.status,200);assert.ok(invite.data.token);
  const invites=(await api(undefined,'owner-token')).data.invites;assert.equal(invites.length,1);
  assert.equal('hash' in invites[0],false);assert.equal('token' in invites[0],false);
  assert.equal((await api({action:'saveProject',id,project:{...project,visibility:'private'}},'owner-token')).status,200);
  assert.equal((await api()).data.projects.length,0);assert.equal((await api(undefined,'owner-token')).data.projects.length,1);
  assert.equal((await api({action:'saveProject',project})).status,401);
  assert.equal((await api({action:'saveProject',project},'owner-token',{origin:'https://bad.example'})).status,403);
 }finally{for(const key of Object.keys(process.env))if(!(key in envBefore))delete process.env[key];Object.assign(process.env,envBefore);}
});
