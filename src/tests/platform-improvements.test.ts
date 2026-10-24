import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {GET,POST} from "../app/api/hub/route.ts";
import {store} from "../lib/hub-store.ts";
import {demoAccounts} from "../lib/hub-demo.ts";
import {blankProject} from "../lib/hub-types.ts";

async function fixture() {
  process.env.YAKKEEPER_LOCAL_DEMO="true";
  process.env.YAKKEEPER_LOCAL_DB=path.join(mkdtempSync(path.join(tmpdir(),"yak-upgrades-")),"test.sqlite");
  const call=async(body?:unknown,cookie="",query="")=>{
    const req=new Request("http://127.0.0.1:3000/api/hub"+query,{method:body?"POST":"GET",
      headers:{host:"127.0.0.1:3000",origin:"http://127.0.0.1:3000",cookie},...(body?{body:JSON.stringify(body)}:{})});
    const r=body?await POST(req):await GET(req);
    return {status:r.status,data:await r.json(),cookie:r.headers.get("set-cookie")?.split(";")[0]||""};
  };
  const sessions=await Promise.all(demoAccounts.map(a=>call({action:"demoLogin",user_id:a.id})));
  const [owner,member,stranger,other]=sessions.map(s=>s.cookie);
  const db=store(true);
  const project=await db.save("yak_projects",{...blankProject,repo_id:800,owner_id:demoAccounts[0].id,
    owner_login:demoAccounts[0].github_login,title:"Invited team",repo:"https://github.com/4Raisan/YakKeeper",join_policy:"invite_only"});
  const board=(cookie=owner,id=project.id,query="")=>call(undefined,cookie,"?resource=board&project_id="+id+query);
  const invite=(cookie=owner,id=project.id)=>call({action:"inviteMember",project_id:id,username:"asha-demo",expected_github_id:demoAccounts[1].github_id},cookie);
  return {call,db,owner,member,stranger,other,project,board,invite};
}

test("public invite-only project: verified invitations, consent, member removal and project isolation",async()=>{
  const {call,db,owner,member,stranger,project,board,invite}=await fixture();
  assert.ok((await call()).data.projects.some((p:{id:string})=>p.id===project.id));
  const submission={action:"submit",project_id:project.id,kind:"contribution",website:"",message:"I can help improve the project with tests."};
  assert.equal((await call(submission,member)).status,403);
  assert.equal((await call({...submission,kind:"idea"},member)).status,200);
  assert.equal((await invite(stranger)).status,403);
  assert.equal((await invite()).status,200);
  assert.equal((await invite()).status,409);
  assert.equal((await board(member)).status,403);
  const pending=(await call(undefined,member)).data.invitations[0];
  assert.equal(pending.project_title,"Invited team");
  assert.equal((await call(undefined,stranger)).data.invitations.length,0);
  assert.equal((await call({action:"respondInvite",id:pending.id,decision:"accept"},stranger)).status,403);
  assert.equal((await call({action:"respondInvite",id:pending.id,decision:"accept"},member)).status,200);
  assert.equal((await board(member)).status,200);
  assert.equal((await call(undefined,member)).data.projects.find((p:{id:string})=>p.id===project.id).is_member,true);
  const another=await db.save("yak_projects",{...blankProject,repo_id:801,owner_id:demoAccounts[0].id,title:"Other team"});
  assert.equal((await invite(owner,another.id)).status,200);
  const invite2=(await call(undefined,member)).data.invitations[0];
  assert.equal((await call({action:"respondInvite",id:invite2.id,decision:"accept"},member)).status,200);
  await db.patch("yak_projects",String(project.id),{visibility:"private"});
  assert.equal((await board(member)).status,403);
  assert.equal((await call(undefined,"","?resource=project&project_id="+project.id)).status,404);
  assert.equal((await call(undefined,member,"?resource=project&project_id="+project.id)).status,404);
  await db.patch("yak_projects",String(project.id),{visibility:"public"});
  assert.equal((await call({action:"removeMember",project_id:project.id,id:pending.id},stranger)).status,403);
  assert.equal((await call({action:"removeMember",project_id:another.id,id:pending.id},owner)).status,404);
  assert.equal((await call({action:"removeMember",project_id:project.id,id:pending.id},owner)).status,200);
  assert.equal((await board(member)).status,403);
  assert.equal((await board(member,another.id)).status,200);
  assert.equal((await call({action:"respondInvite",id:pending.id,decision:"accept"},member)).status,403);
  assert.equal((await call(undefined,member)).data.projects.find((p:{id:string})=>p.id===project.id)?.is_member,false);
  assert.equal((await call({action:"deleteProject",id:project.id,confirm:true},owner)).status,200);
  assert.equal((await db.find("yak_members",{project_id:project.id})).length,0);
});

test("invitation verification uses stable GitHub IDs, handles renames and cancellation",async t=>{
  const {call,db,owner,member,project,board}=await fixture();
  t.mock.method(globalThis,"fetch",async()=>Response.json({id:76543,login:"new-login",type:"User"}));
  assert.equal((await call({action:"inviteMember",project_id:project.id,username:"old-login",expected_github_id:"wrong-id"},owner)).status,409);
  assert.equal((await call({action:"inviteMember",project_id:project.id,username:"old-login",expected_github_id:"76543"},owner)).status,200);
  const pending=(await db.find("yak_members",{github_id:"76543"}))[0];
  assert.equal(pending.login,"new-login");
  assert.equal((await call({action:"respondInvite",id:pending.id,decision:"accept"},member)).status,403);
  await db.patch("yak_members",String(pending.id),{github_id:demoAccounts[1].github_id});
  assert.equal((await call({action:"removeMember",project_id:project.id,id:pending.id},owner)).status,200);
  assert.equal((await call({action:"respondInvite",id:pending.id,decision:"accept"},member)).status,403);
  assert.equal((await board(member)).status,403);
});

test("an owner can revoke membership on a private listing without republishing it",async()=>{
  const {call,db,owner,member,project,invite}=await fixture();
  await invite();
  const pending=(await call(undefined,member)).data.invitations[0];
  await call({action:"respondInvite",id:pending.id,decision:"accept"},member);
  await db.patch("yak_projects",String(project.id),{visibility:"private"});
  assert.equal((await call({action:"removeMember",project_id:project.id,id:pending.id},owner)).status,200);
  assert.equal((await db.find("yak_members",{id:pending.id}))[0].status,"removed");
  assert.equal((await call(undefined,"","?resource=project&project_id="+project.id)).status,404);
});

test("accepted membership survives more than 100 newer applications and owner removal revokes it",async()=>{
  const {call,db,owner,member,project,board}=await fixture();
  const accepted=await db.save("yak_interactions",{project_id:project.id,owner_id:demoAccounts[0].id,applicant_id:demoAccounts[1].id,
    applicant_login:"asha-demo",name:"Asha",kind:"contribution",status:"Accepted",created_at:"2000-01-01T00:00:00Z"});
  for(let i=0;i<105;i++) await db.save("yak_interactions",{project_id:project.id,owner_id:demoAccounts[0].id,applicant_id:demoAccounts[1].id,kind:"idea",status:"Received"});
  const state=(await call(undefined,member)).data;
  assert.equal(state.sent.some((r:{id:string})=>r.id===accepted.id),false);
  assert.equal(state.projects.find((p:{id:string})=>p.id===project.id).is_member,true);
  const membership=(await db.find("yak_members",{project_id:project.id}))[0];
  assert.equal((await call({action:"removeMember",project_id:project.id,id:membership.id},owner)).status,200);
  assert.equal((await board(member)).status,403);
  assert.equal((await db.find("yak_interactions",{id:accepted.id}))[0].status,"Declined");
});

test("task editing and archives preserve participants and enforce creator/owner permissions",async()=>{
  const {call,db,owner,member,stranger,project,board,invite}=await fixture();
  await invite();const invitation=(await call(undefined,member)).data.invitations[0];
  await call({action:"respondInvite",id:invitation.id,decision:"accept"},member);
  await call({action:"createTask",project_id:project.id,task:{title:"Original task"}},member);
  const task=(await board()).data.tasks[0];
  const change=(action:string,fields:Record<string,unknown>,cookie=owner)=>call({action,project_id:project.id,id:task.id,...fields},cookie);
  await change("workOnTask",{working:true},member);
  assert.equal((await change("editTask",{task:{title:"Not allowed"}},stranger)).status,403);
  assert.equal((await change("editTask",{task:{title:"Corrected task",description:"Updated details"}},member)).status,200);
  assert.equal((await change("editTask",{task:{title:" "}},member)).status,400);
  assert.equal((await change("archiveTask",{archived:true},member)).status,403);
  assert.equal((await change("archiveTask",{archived:true})).status,200);
  assert.equal((await board()).data.tasks.length,0);
  const archived=(await board(member,project.id,"&archived=true")).data;
  assert.equal(archived.tasks[0].title,"Corrected task");assert.equal(archived.workers.length,1);
  assert.equal((await change("taskStatus",{status:"Finished"},member)).status,409);
  assert.equal((await change("archiveTask",{archived:false})).status,200);
  assert.equal((await board()).data.workers.length,1);
  assert.equal((await board()).data.tasks[0].title,"Corrected task");
  // Owner may edit a task created by a member.
  assert.equal((await change("editTask",{task:{title:"Owner correction"}})).status,200);
  // Another accepted member cannot edit a task they did not create.
  await db.save("yak_members",{project_id:project.id,github_id:demoAccounts[2].github_id,login:"maya-demo",user_id:demoAccounts[2].id,status:"active"});
  assert.equal((await change("editTask",{task:{title:"Other member edit"}},stranger)).status,403);
});

test("archiving frees active capacity, restore respects capacity, and archived history is paginated",async()=>{
  const {call,db,owner,project,board}=await fixture();
  const tasks=[];
  for(let i=0;i<200;i++) tasks.push(await db.save("yak_tasks",{project_id:project.id,author_id:demoAccounts[0].id,title:"Task "+i,status:"Future"}));
  assert.equal((await call({action:"createTask",project_id:project.id,task:{title:"Full board"}},owner)).status,409);
  const archive=(id:unknown,archived:boolean)=>call({action:"archiveTask",project_id:project.id,id,archived},owner);
  assert.equal((await archive(tasks[0].id,true)).status,200);
  assert.equal((await call({action:"createTask",project_id:project.id,task:{title:"New task"}},owner)).status,200);
  assert.equal((await archive(tasks[0].id,false)).status,409);
  await archive(tasks[1].id,true);
  assert.equal((await archive(tasks[0].id,false)).status,200);
  for(let i=2;i<54;i++) await archive(tasks[i].id,true);
  const page1=(await board(owner,project.id,"&archived=true")).data;
  const page2=(await board(owner,project.id,"&archived=true&archive_page=2")).data;
  assert.equal(page1.tasks.length,50);assert.equal(page1.hasMore,true);
  assert.equal(page2.tasks.length,3);assert.equal(page2.hasMore,false);
  assert.ok(!page1.tasks.some((a:{id:string})=>page2.tasks.some((b:{id:string})=>a.id===b.id)));
});

test("project share endpoint shows starter task without team data; saves validate repository issue links",async()=>{
  const {call,db,owner,project}=await fixture();
  await db.patch("yak_projects",String(project.id),{starter_title:"Test mobile sign-in",starter_time:"30 minutes",starter_url:"https://github.com/4Raisan/YakKeeper/issues/1"});
  const state=await call(undefined,"","?resource=project&project_id="+project.id);
  assert.equal(state.status,200);assert.equal(state.data.projects.length,1);
  assert.equal(state.data.projects[0].starter_title,"Test mobile sign-in");
  assert.deepEqual(state.data.inbox,[]);assert.deepEqual(state.data.invitations,[]);
  assert.equal(state.data.tasks,undefined);assert.equal(state.data.members,undefined);
  await db.patch("yak_projects",String(project.id),{visibility:"archived"});
  assert.equal((await call(undefined,"","?resource=project&project_id="+project.id)).status,404);
  const bad={...blankProject,repo_id:900000001,starter_title:"Starter",starter_url:"https://github.com/someone/else/issues/1"};
  assert.equal((await call({action:"saveProject",project:bad},owner)).status,400);
});
