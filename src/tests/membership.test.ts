import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { GET, POST } from "../app/api/hub/route.ts";
import { store } from "../lib/hub-store.ts";
import { demoAccounts } from "../lib/hub-demo.ts";
import { joinedProjectIds, isMyProject } from "../lib/hub-membership.ts";
import type { HubRequest, Project } from "../lib/hub-types.ts";

test("My projects includes only owned projects and accepted join requests", () => {
  const request = {project_id:"joined", applicant_id:"me", kind:"contribution", status:"Accepted"} as HubRequest;
  const joined = joinedProjectIds([request, {...request, project_id:"idea", kind:"idea"},
    {...request, project_id:"pending", status:"Received"},
    {...request, project_id:"other", applicant_id:"someone-else"}], "me");
  assert.deepEqual([...joined], ["joined"]);
  const project = {id:"joined", owner_id:"owner", visibility:"public"} as Project;
  assert.equal(isMyProject(project, "me", joined), true);
  assert.equal(isMyProject({...project, visibility:"private"}, "me", joined), false);
  assert.equal(isMyProject({...project, id:"pending"}, "me", joined), false);
  assert.equal(isMyProject({...project, visibility:"private"}, "owner", joined), true);
  assert.equal(isMyProject(project, undefined, joined), false);
  assert.equal(joinedProjectIds([request]).size, 0);
});

test("accepted projects load beyond Explore pagination without granting editing or anonymous private access", async () => {
  process.env.YAKKEEPER_LOCAL_DEMO="true";
  process.env.YAKKEEPER_LOCAL_DB=path.join(mkdtempSync(path.join(tmpdir(),"yak-membership-")),"test.sqlite");
  const call=async(body?:unknown,cookie="") => {
    const req=new Request("http://127.0.0.1:3000/api/hub", {method:body?"POST":"GET",
      headers:{host:"127.0.0.1:3000",origin:"http://127.0.0.1:3000",cookie},
      ...(body?{body:JSON.stringify(body)}:{})});
    return body ? POST(req) : GET(req);
  };
  const login=await call({action:"demoLogin",user_id:demoAccounts[1].id});
  const cookie=login.headers.get("set-cookie")!.split(";")[0];
  const db=store(true);
  const project=await db.save("yak_projects",{owner_id:demoAccounts[0].id, repo_id:700,
    title:"Joined project",visibility:"public",created_at:"2000-01-01T00:00:00Z"});
  for(let i=0;i<25;i++) await db.save("yak_projects",{owner_id:demoAccounts[0].id,repo_id:701+i,
    title:"Other project",visibility:"public"});
  const request=await db.save("yak_interactions",{project_id:project.id, owner_id:demoAccounts[0].id,
    applicant_id:demoAccounts[1].id,kind:"contribution",status:"Received"});
  const read=async(session=cookie)=>(await (await call(undefined,session)).json());
  assert.equal((await read()).projects.some((p:Project)=>p.id===project.id),false);
  await db.patch("yak_interactions",String(request.id),{status:"Accepted"});
  const accepted=await read();
  assert.equal(accepted.hasMore,true);
  assert.equal(accepted.projects.filter((p:Project)=>p.id===project.id).length,1);
  assert.equal(isMyProject(accepted.projects.find((p:Project)=>p.id===project.id),accepted.user.id,
    joinedProjectIds(accepted.sent,accepted.user.id)),true);
  assert.equal((await read("")).projects.some((p:Project)=>p.id===project.id),false);
  assert.equal((await call({action:"deleteProject",id:project.id},cookie)).status,403);
  for(const visibility of ["private","archived"]) {
    await db.patch("yak_projects",String(project.id),{visibility});
    assert.equal((await read()).projects.some((p:Project)=>p.id===project.id),false);
    assert.equal((await read("")).projects.some((p:Project)=>p.id===project.id),false);
  }
  await db.patch("yak_projects",String(project.id),{visibility:"public"});
  await db.patch("yak_interactions",String(request.id),{status:"Declined"});
  assert.equal((await read()).projects.some((p:Project)=>p.id===project.id),false);
});
