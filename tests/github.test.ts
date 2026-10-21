import { test } from "node:test";
import assert from "node:assert/strict";
import { githubProfile, ownedRepo, publicRepos } from "../lib/hub-github.ts";
import { identity } from "../lib/hub-auth.ts";
test("GitHub discovery is read-only, paginated, owner-bound, and revalidated before saving", async (t) => {
  let privateRepo = false;
  let ownership = 12345;
  let hits = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const r = new Request(input, init);
      assert.equal(r.method, "GET");
      assert.equal(r.headers.has("authorization"), false);
      hits++;
      if (r.url.includes("/user/12345"))
        return Response.json({
          id: 12345,
          login: "builder",
          name: "Builder",
          avatar_url: "",
        });
      if (r.url.includes("/users/builder/repos?")) {
        assert.equal(new URL(r.url).searchParams.get("page"), "2");
        return Response.json([
          {
            id: 101,
            name: "project",
            owner: { id: 12345, login: "builder" },
            private: false,
          },
          { id: 102, private: true },
        ]);
      }
      return Response.json({
        id: 101,
        owner: { id: ownership },
        private: privateRepo,
      });
    },
  );
  assert.equal((await githubProfile("12345")).login, "builder");
  assert.equal((await publicRepos("builder", 2)).length, 1);
  assert.equal((await ownedRepo(101, "12345")).id, 101);
  privateRepo = true;
  await assert.rejects(() => ownedRepo(101, "12345"), /public repository/);
  privateRepo = false;
  ownership = 999;
  await assert.rejects(() => ownedRepo(101, "12345"), /owned by/);
  assert.ok(hits >= 5);
  await assert.rejects(() => githubProfile("../admin"), /Reconnect/);
});
test("editable metadata cannot claim a GitHub identity or administrator role", async (t) => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test";
  process.env.SUPABASE_SECRET_KEY = "test";
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      id: "11111111-1111-4111-8111-111111111111",
      email: "forged@example.com",
      identities: [],
      user_metadata: {
        provider: "github",
        provider_id: "12345",
        role: "owner",
      },
    }),
  );
  await assert.rejects(
    () =>
      identity(
        new Request("https://yakkeeper.example/api/hub", {
          headers: { authorization: "Bearer forged" },
        }),
        false,
      ),
    /Connect your GitHub/,
  );
});
