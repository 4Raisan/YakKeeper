import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {GET,POST} from "../app/api/hub/route.ts";
import {blankProject} from "../lib/hub-types.ts";
import {demoAccounts} from "../lib/hub-demo.ts";

test("four personas: two owners, four repositories, eight applications and isolated reviews",async t=>{
  process.env.YAKKEEPER_LOCAL_DEMO="true";
  process.env.YAKKEEPER_LOCAL_DB=path.join(mkdtempSync(path.join(tmpdir(),"yakkeeper-matrix-")),"matrix.sqlite");
  t.mock.method(globalThis,"fetch",async()=>{throw Error("Matrix tests must stay offline");});
  const call=async(body?:unknown,cookie="")=>{
    const request=new Request("http://127.0.0.1:3000/api/hub",{method:body?"POST":"GET",headers:{host:"127.0.0.1:3000",origin:"http://127.0.0.1:3000",cookie},...(body?{body:JSON.stringify(body)}:{})});
    const response=body?await POST(request):await GET(request);
    return {status:response.status,data:await response.json(),cookie:response.headers.get("set-cookie")?.split(";")[0] || ""};
  };
  const sessions=await Promise.all(demoAccounts.map(account=>call({action:"demoLogin",user_id:account.id})));
  const [ownerA,applicantA,ownerB,applicantB]=sessions.map(s=>s.cookie);
  assert.ok(sessions.every(s=>s.status===200));
  const publish=async(repo_id:number,cookie:string)=>{
    const project={...blankProject,repo_id,needs:"Frontend, documentation"};
    assert.equal((await call({action:"saveProject",project},cookie)).status,200);
    return project;
  };
  const inputs=[await publish(900000001,ownerA),await publish(900000101,ownerA),await publish(900000003,ownerB),await publish(900000103,ownerB)];
  const projects=(await call()).data.projects;
  assert.equal(projects.length,4);
  assert.equal(new Set(projects.map((p:{repo_id:number})=>p.repo_id)).size,4);
  const ownA=projects.filter((p:{owner_id:string})=>p.owner_id===demoAccounts[0].id);
  const ownB=projects.filter((p:{owner_id:string})=>p.owner_id===demoAccounts[2].id);
  assert.equal(ownA.length,2);assert.equal(ownB.length,2);
  assert.equal((await call({action:"saveProject",id:ownA[0].id,project:inputs.find(p=>p.repo_id===ownA[0].repo_id)},ownerB)).status,403);
  const submit=(id:string)=>({action:"submit",project_id:id,kind:"contribution",website:"",message:"I can build the interface and improve the documentation."});
  assert.equal((await call(submit(ownA[0].id),ownerA)).status,400);
  for(const cookie of [applicantA,applicantB]) for(const project of projects) assert.equal((await call(submit(project.id),cookie)).status,200);
  for(const cookie of [ownerA,ownerB]) {
    const state=(await call(undefined,cookie)).data;
    assert.equal(state.inbox.length,4);
    assert.ok(state.inbox.every((r:{owner_id:string})=>r.owner_id===state.user.id));
    assert.equal(state.sent.length,0);
  }
  for(const cookie of [applicantA,applicantB]) {
    const state=(await call(undefined,cookie)).data;
    assert.equal(state.inbox.length,0);assert.equal(state.sent.length,4);
    assert.ok(state.sent.every((r:{applicant_id:string})=>r.applicant_id===state.user.id));
  }
  const anonymous=(await call()).data;
  assert.equal(anonymous.inbox.length,0);assert.equal(anonymous.sent.length,0);
  const request=(await call(undefined,ownerA)).data.inbox.find((r:{applicant_id:string})=>r.applicant_id===demoAccounts[1].id);
  assert.equal((await call({action:"status",id:request.id,status:"Accepted"},ownerB)).status,403);
  assert.equal((await call({action:"status",id:request.id,status:"Accepted"},applicantA)).status,403);
  assert.equal((await call({action:"status",id:request.id,status:"Accepted"},ownerA)).status,200);
  assert.equal((await call(undefined,applicantA)).data.sent.find((r:{id:string})=>r.id===request.id).status,"Accepted");
  assert.ok((await call(undefined,ownerB)).data.inbox.every((r:{status:string})=>r.status==="Received"));
  assert.equal((await call(submit(projects[0].id),applicantA)).status,409);
  assert.equal((await call({action:"saveProject",id:ownB[0].id,project:{...inputs.find(p=>p.repo_id===ownB[0].repo_id),visibility:"private"}},ownerB)).status,200);
  assert.equal((await call()).data.projects.length,3);
  assert.equal((await call(submit(ownB[0].id),applicantB)).status,404);
  assert.equal((await call(undefined,ownerB)).data.projects.length,4);
  assert.equal((await call({action:"moderate",id:request.id,decision:"Archived"},ownerB)).status,403);
  assert.equal((await call({action:"demoLogout"},applicantA)).status,200);
  assert.equal((await call(undefined,applicantA)).data.user,null);
  assert.equal((await call({action:"demoSeed"})).status,200);
  const seeded=(await call(undefined,ownerA)).data;
  assert.equal(seeded.projects.length,3); // Existing private listing stays private.
  assert.equal((await call({action:"demoSeed"})).status,200);
  assert.equal((await call(undefined,ownerA)).data.inbox.length,seeded.inbox.length);
  const hosted=new Request("https://example.com/api/hub",{method:"POST",headers:{origin:"https://example.com"},body:JSON.stringify({action:"demoSeed"})});
  assert.equal((await POST(hosted)).status,404);
});

test("sandbox loader creates a repeatable four-person workspace without touching live hosts",async()=>{
  process.env.YAKKEEPER_LOCAL_DEMO="true";
  process.env.YAKKEEPER_LOCAL_DB=path.join(mkdtempSync(path.join(tmpdir(),"yakkeeper-seed-")),"seed.sqlite");
  const send=async(body:unknown,cookie="")=>POST(new Request("http://127.0.0.1:3000/api/hub",{method:"POST",headers:{host:"127.0.0.1:3000",origin:"http://127.0.0.1:3000",cookie},body:JSON.stringify(body)}));
  assert.equal((await send({action:"demoSeed"})).status,200);
  assert.equal((await send({action:"demoSeed"})).status,200);
  for(const index of [0,1,2,3]) {
    const login=await send({action:"demoLogin",user_id:demoAccounts[index].id});
    const cookie=login.headers.get("set-cookie")!.split(";")[0];
    const state=await (await GET(new Request("http://127.0.0.1:3000/api/hub",{headers:{host:"127.0.0.1:3000",cookie}}))).json();
    assert.equal(state.projects.length,4);
    assert.equal(state.inbox.length,index===0 || index===2 ? 4 : 0);
    assert.equal(state.sent.length,index===1 || index===3 ? 4 : 0);
  }
});
