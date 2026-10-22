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

test("GitHub descriptions may be absent or short without blocking publication", async () => {
  const {repositoryDisplay} = await import("../lib/hub-github.ts");
  const repo = {name:"Tiny",description:"Hi",language:"Go"} as unknown as import("../lib/hub-types.ts").Repo;
  assert.deepEqual(repositoryDisplay(repo), {title:"Tiny",summary:"Hi",description:"Hi",tags:"Go"});
  assert.match(repositoryDisplay({...repo,description:"",language:""}).description,/Explore Tiny on GitHub/);
});

test("linked identities use GitHub even when another provider comes first",async t=>{
  process.env.NEXT_PUBLIC_SUPABASE_URL="https://identity-test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="fake";
  process.env.SUPABASE_SECRET_KEY="fake";
  const profile={id:"55555555-5555-4555-8555-555555555555",github_id:"812345",github_login:"identity-builder",avatar_url:"",name:"Builder",role:"collaborator"};
  let providerCalls=0;
  t.mock.method(globalThis,"fetch",async(input:RequestInfo|URL,init?:RequestInit)=>{
    const request=new Request(input,init);
    if(request.url.includes("/auth/v1/user")) return Response.json({id:profile.id,identities:[{provider:"google",identity_data:{sub:"999"}},{provider:"github",identity_data:{sub:"812345"}}],user_metadata:{provider_id:"999",role:"owner"}});
    if(request.url.includes("api.github.com/user/812345")){providerCalls++;return Response.json({id:812345,login:profile.github_login,name:"Builder",avatar_url:""});}
    if(request.url.includes("/rest/v1/yak_profiles"))return Response.json(profile);
    throw Error("Unexpected identity request");
  });
  const user=await identity(new Request("https://yakkeeper.example/api/hub",{headers:{authorization:"Bearer test-token"}}),false);
  assert.equal(user?.github_id,"812345");assert.equal(user?.role,"collaborator");assert.equal(providerCalls,1);
});

test("Google-only identities cannot publish and rejected sessions cannot use GitHub lookup",async t=>{
  process.env.NEXT_PUBLIC_SUPABASE_URL="https://identity-test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="fake";
  process.env.SUPABASE_SECRET_KEY="fake";
  let unauthorized=false;
  t.mock.method(globalThis,"fetch",async(input:RequestInfo|URL,init?:RequestInit)=>{
    const request=new Request(input,init);assert.ok(request.url.includes("/auth/v1/user"));
    return unauthorized ? Response.json({msg:"Invalid token"},{status:401}) : Response.json({id:"id",identities:[{provider:"google",identity_data:{sub:"812345"}}],user_metadata:{provider_id:"812345",provider:"github"}});
  });
  const request=new Request("https://yakkeeper.example/api/hub",{headers:{authorization:"Bearer test-token"}});
  await assert.rejects(()=>identity(request,false),/Connect your GitHub/);
  unauthorized=true;await assert.rejects(()=>identity(request,false),/sign in again/);
});
