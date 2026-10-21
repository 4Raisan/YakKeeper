import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { GET, POST } from "../app/api/hub/route.ts";
import { blankProject } from "../lib/hub-types.ts";
import { localEnabled } from "../lib/hub-store.ts";
const owner = "11111111-1111-4111-8111-111111111111",
  member = "22222222-2222-4222-8222-222222222222";
test("persistent local platform: publishing, two users, applications, privacy, moderation and access control", async () => {
  process.env.YAKKEEPER_LOCAL_DEMO = "true";
  process.env.YAKKEEPER_LOCAL_DB = path.join(
    mkdtempSync(path.join(tmpdir(), "yakkeeper-test-")),
    "test.sqlite",
  );
  const invoke = async (
    body?: unknown,
    cookie = "",
    origin = "http://127.0.0.1:3000",
  ) => {
    const req = new Request("http://127.0.0.1:3000/api/hub", {
      method: body ? "POST" : "GET",
      headers: { host: "127.0.0.1:3000", origin, cookie },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = body ? await POST(req) : await GET(req);
    return {
      status: result.status,
      data: await result.json(),
      cookie: result.headers.get("set-cookie")?.split(";")[0] || "",
    };
  };
  assert.equal(localEnabled(new Request("https://example.com/api/hub")), false);
  assert.equal(
    localEnabled(
      new Request("http://localhost/api/hub", {
        headers: { host: "example.com" },
      }),
    ),
    false,
  );
  assert.equal(
    (
      await invoke(
        { action: "demoLogin", user_id: owner },
        "",
        "https://bad.example",
      )
    ).status,
    403,
  );
  assert.equal((await invoke({action: "demoLogin", user_id: owner, oversized: "x".repeat(24001)})).status,413);
  const a = await invoke({ action: "demoLogin", user_id: owner });
  assert.ok(a.cookie);
  assert.equal(a.status, 200);
  const b = await invoke({ action: "demoLogin", user_id: member });
  assert.equal(b.status, 200);
  assert.equal((await invoke()).data.user, null);
  const project = {
    ...blankProject,
    repo_id: 900000001,
    title: "Local test project",
    summary: "Find a frontend teammate for this project.",
    description: "A project to test actual persistent saves and permissions.",
    needs: "React, design",
  };
  assert.equal((await invoke({ action: "saveProject", project })).status, 401);
  assert.equal(
    (await invoke({ action: "saveProject", project }, a.cookie)).status,
    200,
  );
  const initial = await invoke();
  assert.equal(initial.data.projects.length, 1);
  const id = initial.data.projects[0].id;
  assert.equal(
    (await invoke({ action: "saveProject", project }, a.cookie)).status,
    409,
  );
  assert.equal(
    (await invoke({ action: "saveProject", id, project }, b.cookie)).status,
    403,
  );
  assert.equal(
    (
      await invoke(
        {
          action: "saveProject",
          id,
          project: { ...project, repo_id: 900000002 },
        },
        a.cookie,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await invoke(
        { action: "saveProject", project: { ...project, repo_id: 900000002 } },
        b.cookie,
      )
    ).status,
    200,
  );
  const second = (await invoke()).data.projects.find(
    (p: { owner_id: string }) => p.owner_id === member,
  );
  // Administration does not silently grant edit rights over another publisher's project.
  assert.equal(
    (
      await invoke(
        {
          action: "saveProject",
          id: second.id,
          project: { ...project, repo_id: 900000002 },
        },
        a.cookie,
      )
    ).status,
    403,
  );
  const proposal = {
    action: "submit",
    project_id: id,
    kind: "contribution",
    message: "I can build the React pages and contribute on weekends.",
    website: "",
  };
  assert.equal((await invoke(proposal)).status, 401);
  assert.equal((await invoke(proposal, a.cookie)).status, 400);
  assert.equal(
    (await invoke({ ...proposal, website: "spam" }, b.cookie)).status,
    400,
  );
  assert.equal(
    (await invoke({ ...proposal, applicant_login: "forged-admin" }, b.cookie))
      .status,
    200,
  );
  assert.equal((await invoke(proposal, b.cookie)).status, 409);
  const received = (await invoke(undefined, a.cookie)).data.inbox;
  assert.equal(received.length, 1);
  assert.equal(received[0].applicant_login, "asha-demo");
  assert.equal((await invoke()).data.inbox.length, 0);
  assert.equal((await invoke(undefined, b.cookie)).data.inbox.length, 0);
  assert.equal((await invoke(undefined, b.cookie)).data.sent.length, 1);
  assert.equal(
    (
      await invoke(
        { action: "status", id: received[0].id, status: "Accepted" },
        b.cookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await invoke(
        { action: "status", id: received[0].id, status: "Accepted" },
        a.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await invoke(undefined, b.cookie)).data.sent[0].status,
    "Accepted",
  );
  assert.equal(
    (await invoke({ action: "block", user_id: member }, a.cookie)).status,
    200,
  );
  assert.equal(
    (await invoke({ ...proposal, kind: "idea" }, b.cookie)).status,
    403,
  );
  assert.equal(
    (await invoke({ action: "block", user_id: member }, a.cookie)).status,
    200,
  );
  assert.equal(
    (
      await invoke(
        {
          action: "saveProject",
          id,
          project: { ...project, contributions_open: false },
        },
        a.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await invoke({ ...proposal, kind: "idea" }, b.cookie)).status,
    409,
  );
  assert.equal(
    (
      await invoke(
        {
          action: "saveProject",
          id,
          project: { ...project, visibility: "private" },
        },
        a.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await invoke()).data.projects.some((p: { id: string }) => p.id === id),
    false,
  );
  assert.equal(
    (await invoke(undefined, a.cookie)).data.projects.some(
      (p: { id: string }) => p.id === id,
    ),
    true,
  );
  assert.equal(
    (await invoke({ action: "saveProject", id, project }, a.cookie)).status,
    200,
  );
  assert.equal(
    (
      await invoke(
        {
          action: "report",
          project_id: id,
          reason: "Misleading project information needs review.",
        },
        b.cookie,
      )
    ).status,
    200,
  );
  const report = (await invoke(undefined, a.cookie)).data.reports[0];
  assert.ok(report);
  assert.equal((await invoke(undefined, b.cookie)).data.reports.length, 0);
  assert.equal(
    (
      await invoke(
        { action: "moderate", id: report.id, decision: "Archived" },
        b.cookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await invoke(
        { action: "moderate", id: report.id, decision: "Archived" },
        a.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await invoke()).data.projects.some((p: { id: string }) => p.id === id),
    false,
  );
  assert.equal(
    (await invoke({ action: "saveProject", id, project }, a.cookie)).status,
    403,
  );
  assert.equal(
    (
      await invoke(
        {
          action: "profile",
          profile: {
            bio: "Learning React",
            skills: "React",
            availability: "Weekends",
            timezone: "Asia/Kolkata",
            github_login: "forged",
          },
        },
        b.cookie,
      )
    ).status,
    200,
  );
  const profile = (await invoke(undefined, b.cookie)).data.user;
  assert.equal(profile.github_login, "asha-demo");
  assert.equal(profile.bio, "Learning React");
  assert.equal("email" in profile, false);
  assert.equal((await invoke({ action: "demoLogout" }, b.cookie)).status, 200);
  assert.equal((await invoke(undefined, b.cookie)).data.user, null);
  delete process.env.YAKKEEPER_LOCAL_DEMO;
  delete process.env.YAKKEEPER_LOCAL_DB;
});
