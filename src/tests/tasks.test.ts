import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { GET, POST } from "../app/api/hub/route.ts";
import { store } from "../lib/hub-store.ts";
import { demoAccounts } from "../lib/hub-demo.ts";

test("shared boards: membership, lifecycle, self-assignment, isolation, revocation and cleanup", async () => {
  process.env.YAKKEEPER_LOCAL_DEMO = "true";
  process.env.YAKKEEPER_LOCAL_DB = path.join(mkdtempSync(path.join(tmpdir(), "yak-tasks-")), "test.sqlite");
  const call = async (body?: unknown, cookie = "", query = "") => {
    const req = new Request("http://127.0.0.1:3000/api/hub" + query, {
      method: body ? "POST" : "GET", headers: {host:"127.0.0.1:3000", origin:"http://127.0.0.1:3000", cookie},
      ...(body ? {body: JSON.stringify(body)} : {}),
    });
    const response = body ? await POST(req) : await GET(req);
    return {status: response.status, data: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] || ""};
  };
  const [owner, member, stranger, ideaUser] = await Promise.all(demoAccounts.map(async a =>
    (await call({action:"demoLogin", user_id:a.id})).cookie));
  const db = store(true);
  const project = await db.save("yak_projects", {owner_id:demoAccounts[0].id, repo_id:500, title:"Team project", visibility:"public"});
  const other = await db.save("yak_projects", {owner_id:demoAccounts[2].id, repo_id:501, title:"Other project", visibility:"public"});
  const application = await db.save("yak_interactions", {project_id:project.id, owner_id:demoAccounts[0].id,
    applicant_id:demoAccounts[1].id, kind:"contribution", status:"Received"});
  await db.save("yak_interactions", {project_id:project.id, owner_id:demoAccounts[0].id,
    applicant_id:demoAccounts[3].id, kind:"idea", status:"Accepted"});
  const board = (cookie = owner, id = project.id) => call(undefined, cookie, "?resource=board&project_id=" + id);
  const create = (cookie = owner, task: unknown = {title:"Build the task board", description:"Ship a useful shared workspace"}) =>
    call({action:"createTask", project_id:project.id, task}, cookie);
  assert.equal((await board("")).status, 401);
  assert.equal((await board(member)).status, 403);
  assert.equal((await board(stranger)).status, 403);
  assert.equal((await board(ideaUser)).status, 403);
  assert.equal((await create(member)).status, 403);
  assert.equal((await create(owner, {title:"  "})).status, 400);
  assert.equal((await create(owner, {title:"x".repeat(161)})).status, 400);
  assert.equal((await create()).status, 200);
  const task = (await board()).data.tasks[0];
  assert.equal(task.status, "Future");
  assert.equal(task.author_id, demoAccounts[0].id);
  await db.patch("yak_interactions", String(application.id), {status:"Accepted"});
  assert.equal((await board(member)).status, 200);
  const change = (action: string, fields: Record<string,unknown>, cookie = member, project_id = project.id) =>
    call({action, project_id, id:task.id, ...fields}, cookie);
  assert.equal((await change("taskStatus", {status:"Ongoing"}, stranger)).status, 403);
  assert.equal((await change("taskStatus", {status:"Ongoing"}, stranger, other.id)).status, 404);
  assert.equal((await change("taskStatus", {status:"invalid"})).status, 400);
  assert.equal((await change("workOnTask", {working:"yes"})).status, 400);
  assert.equal((await change("taskStatus", {status:"Ongoing"})).status, 200);
  assert.equal((await change("workOnTask", {working:true, user_id:demoAccounts[2].id, login:"forged"})).status, 200);
  assert.equal((await change("workOnTask", {working:true})).status, 200);
  assert.equal((await change("workOnTask", {working:true}, owner)).status, 200);
  let state = (await board()).data;
  assert.equal(state.workers.length, 2);
  assert.ok(state.workers.some((w: {user_id:string; login:string}) => w.user_id === demoAccounts[1].id && w.login === demoAccounts[1].github_login));
  assert.equal((await change("workOnTask", {working:false})).status, 200);
  state = (await board()).data;
  assert.equal(state.workers.length, 1);
  assert.equal(state.workers[0].user_id, demoAccounts[0].id);
  assert.equal((await change("taskStatus", {status:"Finished"})).status, 200);
  assert.equal((await board(member)).data.tasks[0].status, "Finished");
  assert.equal((await change("workOnTask", {working:true})).status, 409);
  assert.equal((await change("taskStatus", {status:"Future"})).status, 200);
  assert.equal((await board()).data.tasks[0].status, "Future");
  const block = await db.save("yak_blocks", {owner_id:demoAccounts[0].id, blocked_id:demoAccounts[1].id});
  assert.equal((await board(member)).status, 403);
  assert.equal((await change("taskStatus", {status:"Finished"})).status, 403);
  await db.remove("yak_blocks", String(block.id));
  await db.patch("yak_interactions", String(application.id), {status:"Declined"});
  assert.equal((await board(member)).status, 403);
  await db.patch("yak_interactions", String(application.id), {status:"Accepted"});
  for (const visibility of ["private", "archived"]) {
    await db.patch("yak_projects", String(project.id), {visibility});
    assert.equal((await board(member)).status, 403);
    assert.equal((await board()).status, 200);
  }
  assert.equal((await create()).status, 409);
  await db.patch("yak_projects", String(project.id), {visibility:"public"});
  const noOrigin = await POST(new Request("http://127.0.0.1:3000/api/hub", {method:"POST", headers:{origin:"https://evil.example",cookie:owner},
    body:JSON.stringify({action:"taskStatus",project_id:project.id,id:task.id,status:"Finished"})}));
  assert.equal(noOrigin.status, 403);
  assert.equal((await call({action:"deleteProject",id:project.id,confirm:true},owner)).status, 200);
  assert.equal((await db.find("yak_tasks", {project_id:project.id})).length, 0);
  assert.equal((await db.find("yak_task_workers", {task_id:task.id})).length, 0);
  assert.equal((await board()).status, 404);
});
